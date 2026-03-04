import time
from pymavlink import mavutil
from utils import (
    DISTANCE_PARAMS, DEGREES_PER_SECOND, NEUTRAL,
    ROLL_LEFT, ROLL_RIGHT, PITCH_FORWARD, PITCH_BACKWARD,
    THROTTLE_UP, THROTTLE_DOWN, YAW_LEFT, YAW_RIGHT
)

class Drone:
    def __init__(self, connection_string='udp:127.0.0.1:14550'):
        self.connection_string = connection_string
        self.master = None
        self.is_armed = False

    def connect(self):
        print(f"Connecting to drone at {self.connection_string}...")
        self.master = mavutil.mavlink_connection(self.connection_string)
        self.master.wait_heartbeat()
        print(f"✓ Connected to system {self.master.target_system}")
        
        # Disable arming checks for SITL
        print("Disabling arming checks...")
        self.master.mav.param_set_send(
            self.master.target_system,
            self.master.target_component,
            b'ARMING_SKIPCHK',
            -1,
            mavutil.mavlink.MAV_PARAM_TYPE_REAL32
        )
        time.sleep(2)
        
        # Wait for EKF to converge before proceeding
        print("Waiting for AHRS/EKF to converge...")
        self._wait_for_ekf(timeout=60)
        
        self.set_mode('ALT_HOLD')


    def _wait_for_ekf(self, timeout=60):
        """Poll EKF_STATUS_REPORT until attitude + altitude are healthy"""
        start = time.time()
        while time.time() - start < timeout:
            msg = self.master.recv_match(type='EKF_STATUS_REPORT', blocking=True, timeout=2)
            if msg:
                # Flags: bit0=attitude, bit1=vel_horiz, bit2=vel_vert, bit3=pos_horiz, bit4=pos_vert, bit5=terrain
                # For ALT_HOLD we need at minimum: attitude (0x01) + pos_vert/alt (0x10)
                healthy = (msg.flags & 0x01) and (msg.flags & 0x10)
                if healthy:
                    print(f"✓ EKF healthy (flags=0x{msg.flags:02x})")
                    return True
            time.sleep(0.5)
        print("⚠ EKF did not converge in time, proceeding anyway...")
        return False

    def set_mode(self, mode):
        print(f"Setting mode to {mode}...")
        self.master.set_mode(mode)
        time.sleep(2)

    def arm(self):
        print("\nArming...")
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            1, 0, 0, 0, 0, 0, 0
        )
        
        # Wait for ACK first
        print("Waiting for arm confirmation...")
        ack = self.master.recv_match(
            type='COMMAND_ACK', 
            blocking=True, 
            timeout=10
        )
        if ack and ack.result == mavutil.mavlink.MAV_RESULT_ACCEPTED:
            print("✓ Arm command accepted")
        
        # Clear any stale heartbeats from before arming
        while self.master.recv_match(type='HEARTBEAT', blocking=False):
            pass
            
        # Then confirm via HEARTBEAT (up to 30s)
        for _ in range(60):          # ← was 10, now 60 (30 seconds)
            time.sleep(0.5)
            msg = self.master.recv_match(type='HEARTBEAT', blocking=True, timeout=2)
            if msg:
                self.is_armed = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
                if self.is_armed:
                    print("✓ Vehicle ARMED - Ready to fly!")
                    return True
        
        print("⚠ Couldn't confirm armed status.")
        return False

    def disarm(self):
        """Disarm the drone"""
        # Neutralize channels first
        self._send_rc_override(NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL)
        time.sleep(1)
        
        print("Disarming...")
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            0, 0, 0, 0, 0, 0, 0
        )
        time.sleep(2)
        self.is_armed = False

    def takeoff(self, duration=6, throttle=1700):
        """Takeoff sequence"""
        print(f"\n🚁 Taking off...")
        self._execute_rc_command(duration, 1500, 1500, throttle, 1500)

    def land(self, duration=4):
        """Landing sequence"""
        print("Landing...")
        # Hover first
        self.hover(2)
        
        print("Descending...")
        # Gentle descent
        self._execute_rc_command(duration, 1500, 1500, 1300, 1500)
        
        # Final approach (slower)
        print("Final approach...")
        self._execute_rc_command(2, 1500, 1500, 1450, 1500)
        
        # Ramp down
        print("Touchdown ramp...")
        steps = 30
        for i in range(steps):
            throt = int(1450 - (1450 - 1100) * (i / steps))
            self._send_rc_override(1500, 1500, throt, 1500)
            time.sleep(0.1)
            
        # Cut throttle
        self._execute_rc_command(1, 1500, 1500, 1000, 1500)

    def hover(self, duration=3):
        """Hover active stabilization"""
        print(f"Hovering for {duration}s...")
        self._execute_rc_command(duration, 1500, 1500, 1500, 1500)

    def move(self, direction, magnitude='medium'):
        """Execute movement based on LLM direction."""
        action = direction.lower()
        
        if action == 'forward':
            self._move_forward_physical(magnitude)
        elif action == 'backward':
            self._move_backward_physical(magnitude)
        elif action == 'left':
            self._move_left_physical(magnitude)
        elif action == 'right':
            self._move_right_physical(magnitude)
        elif action == 'ascend':
            self._ascend_physical(magnitude)
        elif action == 'descend':
            self._descend_physical(magnitude)
        else:
            print(f"Unknown move command: {action}")

    def rotate(self, degrees, direction='clockwise'):
        """Rotate the drone by specified degrees"""
        if degrees is None:
            degrees = 90
            
        if isinstance(degrees, str):
            try:
                degrees = int(degrees)
            except:
                degrees = 90
        
        duration = degrees / DEGREES_PER_SECOND
        yaw_val = YAW_RIGHT if direction == 'clockwise' else YAW_LEFT
        arrow = "↻" if direction == 'clockwise' else "↺"
        
        print(f"{arrow} Rotating {degrees}° {direction}")
        self._execute_rc_command(duration, NEUTRAL, NEUTRAL, NEUTRAL, yaw_val)

    def brake(self, action_name, magnitude='short'):
        """Apply counter-momentum braking based on the last action taken"""
        print(f"Applying brake for action: {action_name}")
        
        if action_name == 'forward':
            self._move_backward_physical(magnitude)
        elif action_name == 'backward':
            self._move_forward_physical(magnitude)
        elif action_name == 'right':
            self._move_left_physical(magnitude)
        elif action_name == 'left':
            self._move_right_physical(magnitude)
        
        self.hover(4)

    def _move_forward_physical(self, magnitude='medium'):
        """Physically moves forward (Pitch 1400)"""
        duration = DISTANCE_PARAMS.get(magnitude, DISTANCE_PARAMS['medium'])
        print("Moving forward (Pitch 1400)")
        
        # BRAKE PHASE: 1s pulse of 1450 (Legacy behavior)
        for _ in range(10):
            self._send_rc_override(NEUTRAL, PITCH_BACKWARD + 50, NEUTRAL, NEUTRAL)
            time.sleep(0.1)
        
        # MOVEMENT PHASE
        self._execute_rc_command(duration, NEUTRAL, PITCH_BACKWARD, NEUTRAL, NEUTRAL)

    def _move_backward_physical(self, magnitude='medium'):
        """Physically moves backward (Pitch 1600)"""
        duration = DISTANCE_PARAMS.get(magnitude, DISTANCE_PARAMS['medium'])
        print("Moving backward (Pitch 1600)")
        
        # BRAKE PHASE: 1s pulse of 1650
        for _ in range(10):
            self._send_rc_override(NEUTRAL, PITCH_FORWARD + 50, NEUTRAL, NEUTRAL)
            time.sleep(0.1)
            
        # MOVEMENT PHASE
        self._execute_rc_command(duration, NEUTRAL, PITCH_FORWARD, NEUTRAL, NEUTRAL)

    def _move_right_physical(self, magnitude='medium'):
        """Physically moves right (Roll 1600)"""
        duration = DISTANCE_PARAMS.get(magnitude, DISTANCE_PARAMS['medium'])
        print("Moving right (Roll 1600)")
        
        # BRAKE PHASE: 1s pulse of 1650
        for _ in range(10):
            self._send_rc_override(ROLL_LEFT + 50, NEUTRAL, NEUTRAL, NEUTRAL)
            time.sleep(0.1)
            
        # MOVEMENT PHASE
        self._execute_rc_command(duration, ROLL_LEFT, NEUTRAL, NEUTRAL, NEUTRAL)

    def _move_left_physical(self, magnitude='medium'):
        """Physically moves left (Roll 1400)"""
        duration = DISTANCE_PARAMS.get(magnitude, DISTANCE_PARAMS['medium'])
        print("Moving left (Roll 1400)")
        
        # BRAKE PHASE: 1s pulse of 1350
        for _ in range(10):
            self._send_rc_override(ROLL_RIGHT - 50, NEUTRAL, NEUTRAL, NEUTRAL)
            time.sleep(0.1)
            
        # MOVEMENT PHASE
        self._execute_rc_command(duration, ROLL_RIGHT, NEUTRAL, NEUTRAL, NEUTRAL)

    def _ascend_physical(self, magnitude='medium'):
        """Ascend sequence"""
        duration = DISTANCE_PARAMS.get(magnitude, DISTANCE_PARAMS['medium'])
        print("Ascending")
        self._execute_rc_command(duration, NEUTRAL, NEUTRAL, THROTTLE_UP, NEUTRAL)

    def _descend_physical(self, magnitude='medium'):
        """Descend sequence"""
        duration = DISTANCE_PARAMS.get(magnitude, DISTANCE_PARAMS['medium'])
        print("Descending")
        self._execute_rc_command(duration, NEUTRAL, NEUTRAL, THROTTLE_DOWN, NEUTRAL)

    def get_position(self):
        """Returns (lat_deg, lon_deg, alt_m) as floats, or None on timeout."""
        msg = self.master.recv_match(
            type='GLOBAL_POSITION_INT',
            blocking=True,
            timeout=1.0
        )
        if msg:
            return (msg.lat / 1e7, msg.lon / 1e7, msg.alt / 1000.0)
        return None

    def _execute_rc_command(self, duration, roll, pitch, throttle, yaw, pitch_override=None):
        """Low level RC sender"""
        # Note: pitch argument in channel override is arg 2
        p = pitch_override if pitch_override is not None else pitch
        
        iterations = int(duration * 10)
        for _ in range(iterations):
            self._send_rc_override(roll, p, throttle, yaw)
            time.sleep(0.1)

    def _send_rc_override(self, roll, pitch, throttle, yaw):
        self.master.mav.rc_channels_override_send(
            self.master.target_system,
            self.master.target_component,
            int(roll), int(pitch), int(throttle), int(yaw),
            0, 0, 0, 0
        )
