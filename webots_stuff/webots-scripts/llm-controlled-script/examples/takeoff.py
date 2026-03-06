#!/usr/bin/env python3
"""
Crazyflie indoor flight - FIXED timing
"""

from pymavlink import mavutil
import time

# Connect
print("Connecting to Crazyflie SITL...")
master = mavutil.mavlink_connection('udp:127.0.0.1:14550')
master.wait_heartbeat()
print(f"✓ Connected to system {master.target_system}")

# Disable arming checks
print("\nDisabling arming checks...")
master.mav.param_set_send(
    master.target_system,
    master.target_component,
    b'ARMING_SKIPCHK',
    -1,
    mavutil.mavlink.MAV_PARAM_TYPE_REAL32
)
time.sleep(2)

# Wait for AHRS
print("Waiting for AHRS...")
time.sleep(3)

# Set ALT_HOLD mode
print("Setting ALT_HOLD mode...")
master.set_mode('ALT_HOLD')
time.sleep(2)

# Arm
print("\nArming...")
master.mav.command_long_send(
    master.target_system,
    master.target_component,
    mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
    0,
    1,  # arm
    0, 0, 0, 0, 0, 0
)

# Wait longer and check multiple times
print("Waiting for arm confirmation...")
armed = False
for _ in range(10):  # Check 10 times
    time.sleep(0.5)
    msg = master.recv_match(type='HEARTBEAT', blocking=True, timeout=2)
    if msg:
        armed = msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED
        if armed:
            print("✓ Vehicle ARMED - Ready to fly!")
            break

if not armed:
    print("⚠ Couldn't confirm armed status, but trying anyway...")
    print("(ArduPilot console says ARMED, so continuing...)")

# Small delay before flight
time.sleep(1)

# Takeoff
print("\n🚁 TAKING OFF...")
for i in range(100):  # 4 seconds
    master.mav.rc_channels_override_send(
        master.target_system,
        master.target_component,
        1500,  # roll
        1500,  # pitch
        1700,  # throttle 70%
        1500,  # yaw
        0, 0, 0, 0
    )
    if i % 10 == 0:
        print(f"  Climbing... {i/10:.1f}s")
    time.sleep(0.1)

print("✓ At hover altitude\n")

# Hover
print("HOVERING for 5 seconds...")
for i in range(50):
    master.mav.rc_channels_override_send(
        master.target_system,
        master.target_component,
        1500, 1500, 1500, 1500,
        0, 0, 0, 0
    )
    if i % 10 == 0:
        print(f"  Hovering... {i/10:.1f}s")
    time.sleep(0.1)

print()

# Descend
print("DESCENDING...")
for i in range(40):  # 4 seconds
    master.mav.rc_channels_override_send(
        master.target_system,
        master.target_component,
        1500, 1500, 1300, 1500,
        0, 0, 0, 0
    )
    if i % 10 == 0:
        print(f"  Descending... {i/10:.1f}s")
    time.sleep(0.1)

print()

# Final landing
print("LANDING...")
for i in range(20):
    master.mav.rc_channels_override_send(
        master.target_system,
        master.target_component,
        1500, 1500, 1000, 1500,
        0, 0, 0, 0
    )
    time.sleep(0.1)

# Release RC override
master.mav.rc_channels_override_send(
    master.target_system,
    master.target_component,
    0, 0, 0, 0, 0, 0, 0, 0
)

# Disarm
time.sleep(2)
print("\nDISARMING...")
master.mav.command_long_send(
    master.target_system,
    master.target_component,
    mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
    0,
    0,  # disarm
    0, 0, 0, 0, 0, 0
)

time.sleep(2)
print("\n✅ FLIGHT COMPLETE!")
print("🎉 Check Webots - the Crazyflie should have flown!")
