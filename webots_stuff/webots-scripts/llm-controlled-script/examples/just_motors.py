#!/usr/bin/env python3

"""
Motor control with detailed status monitoring
"""

from pymavlink import mavutil
import time

# Connect
print("Connecting...")
master = mavutil.mavlink_connection('udp:127.0.0.1:14550')
master.wait_heartbeat()
print(f"✓ Connected to system {master.target_system}")

# Check what messages we're receiving
print("\nChecking SERVO_OUTPUT_RAW messages...")
msg = master.recv_match(type='SERVO_OUTPUT_RAW', blocking=True, timeout=5)
if msg:
    print(f"✓ Receiving servo outputs:")
    print(f"  Motor 1: {msg.servo1_raw}")
    print(f"  Motor 2: {msg.servo2_raw}")
    print(f"  Motor 3: {msg.servo3_raw}")
    print(f"  Motor 4: {msg.servo4_raw}")
else:
    print("✗ Not receiving servo output messages")

# Set to GUIDED mode
print("\nSetting GUIDED mode...")
master.set_mode('GUIDED')
time.sleep(1)

# Arm with force
print("Arming...")
master.mav.command_long_send(
    master.target_system,
    master.target_component,
    mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
    0,
    1,      # arm
    21196,  # force
    0, 0, 0, 0, 0
)

# Wait and check armed status
time.sleep(2)
msg = master.recv_match(type='HEARTBEAT', blocking=True, timeout=3)
if msg:
    armed = msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED
    print(f"✓ Armed status: {bool(armed)}")

# Send throttle commands
print("\n=== Spinning motors at 60% throttle ===")

for i in range(50):
    # Send RC override
    master.mav.rc_channels_override_send(
        master.target_system,
        master.target_component,
        1500,  # chan1 (roll) - centered
        1500,  # chan2 (pitch) - centered
        1600,  # chan3 (throttle) - 60%
        1500,  # chan4 (yaw) - centered
        0, 0, 0, 0
    )
    
    # Check motor outputs every 10 iterations
    if i % 10 == 0:
        msg = master.recv_match(type='SERVO_OUTPUT_RAW', blocking=False)
        if msg:
            print(f"\n  Motor outputs at t={i*0.1:.1f}s:")
            print(f"    M1: {msg.servo1_raw}, M2: {msg.servo2_raw}, M3: {msg.servo3_raw}, M4: {msg.servo4_raw}")
        else:
            print(f"  t={i*0.1:.1f}s - throttle: 60%", end='\r')
    
    time.sleep(0.1)

# Stop motors
print("\n\nStopping motors...")
master.mav.rc_channels_override_send(
    master.target_system,
    master.target_component,
    1500, 1500, 1000, 1500, 0, 0, 0, 0
)
time.sleep(1)

# Check final motor state
msg = master.recv_match(type='SERVO_OUTPUT_RAW', blocking=True, timeout=2)
if msg:
    print(f"Final motor outputs:")
    print(f"  M1: {msg.servo1_raw}, M2: {msg.servo2_raw}, M3: {msg.servo3_raw}, M4: {msg.servo4_raw}")

# Disarm
print("\nDisarming...")
master.mav.command_long_send(
    master.target_system,
    master.target_component,
    mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
    0,
    0,  # disarm
    0, 0, 0, 0, 0, 0
)
time.sleep(1)

print("\n✓ Done! Check Webots - did the props spin?")