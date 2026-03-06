import base64
import cv2
import numpy as np

# Distance parameters (durations in seconds)
DISTANCE_PARAMS = {
    'short': 1.0,
    'medium': 2.0,
    'long': 3.0
}

# PWM values for different movement types for MAVLink RC override
# Note: These values are specific to the drone configuration
ROLL_LEFT = 1600     # Left strafe
ROLL_RIGHT = 1400    # Right strafe
PITCH_FORWARD = 1600   # Forward
PITCH_BACKWARD = 1400  # Backward
THROTTLE_UP = 1700
THROTTLE_DOWN = 1300
YAW_LEFT = 1400   # Counter-clockwise rotation
YAW_RIGHT = 1600  # Clockwise rotation
NEUTRAL = 1500

# Rotation parameters
DEGREES_PER_SECOND = 30  # Approximate rotation speed

def encode_image_from_array(img_array):
    """Encode numpy array directly to base64 without saving to disk"""
    success, buffer = cv2.imencode('.jpg', img_array)
    if not success:
        raise ValueError("Failed to encode image")
    return base64.b64encode(buffer).decode('utf-8')

def configure_distances(short=1.0, medium=2.0, long=3.0):
    """Customize distance parameters"""
    global DISTANCE_PARAMS
    DISTANCE_PARAMS['short'] = short
    DISTANCE_PARAMS['medium'] = medium
    DISTANCE_PARAMS['long'] = long
    print(f"✓ Distance parameters updated: Short={short}s, Medium={medium}s, Long={long}s")

def configure_rotation_speed(degrees_per_second):
    """Adjust rotation speed calibration"""
    global DEGREES_PER_SECOND
    DEGREES_PER_SECOND = degrees_per_second
    print(f"✓ Rotation speed set to {degrees_per_second}°/s")
