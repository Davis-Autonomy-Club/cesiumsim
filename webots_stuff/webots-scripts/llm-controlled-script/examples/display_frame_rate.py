#!/usr/bin/env python3

"""
Object tracking script for WebotsArduVehicle camera feed.
Supports multiple tracking methods:
1. Color-based tracking
2. OpenCV built-in trackers (CSRT, KCF, etc.)
3. Background subtraction
4. Template matching
"""

import cv2
import socket
import struct
import numpy as np

# Configuration
TRACKING_METHOD = "color"  # Options: "color", "tracker", "background", "template"
TARGET_COLOR_LOWER = np.array([0, 100, 100])    # HSV lower bound (red)
TARGET_COLOR_UPPER = np.array([10, 255, 255])   # HSV upper bound

# Connect to WebotsArduVehicle
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(10)

print("Connecting to camera feed...")
try:
    s.connect(("127.0.0.1", 5599))
    print("✓ Connected successfully!")
except Exception as e:
    print(f"✗ Connection failed: {e}")
    exit(1)

s.settimeout(None)
header_size = struct.calcsize("=HH")

# Tracking variables
tracker = None
tracking_initialized = False
bbox = None
background_subtractor = None
template = None

# For color tracking
def track_by_color(frame):
    """Track object by color in HSV space"""
    # Convert grayscale to BGR, then to HSV
    frame_bgr = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
    
    # Create mask for target color
    mask = cv2.inRange(hsv, TARGET_COLOR_LOWER, TARGET_COLOR_UPPER)
    
    # Clean up mask
    mask = cv2.erode(mask, None, iterations=2)
    mask = cv2.dilate(mask, None, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Find largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        if area > 100:  # Minimum area threshold
            # Get bounding box
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # Calculate center
            cx, cy = x + w//2, y + h//2
            
            # Draw on frame
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 255, 255), 2)
            cv2.circle(frame, (cx, cy), 5, (255, 255, 255), -1)
            cv2.putText(frame, f"Area: {int(area)}", (x, y-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            return frame, (cx, cy, area)
    
    return frame, None

# For OpenCV tracker
def track_with_opencv_tracker(frame, first_frame=False):
    """Track object using OpenCV's built-in trackers"""
    global tracker, bbox, tracking_initialized
    
    frame_bgr = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    
    if first_frame or not tracking_initialized:
        # Select ROI on first frame
        print("Select object to track, then press ENTER or SPACE")
        bbox = cv2.selectROI("Select Object", frame_bgr, False)
        cv2.destroyWindow("Select Object")
        
        # Initialize tracker (CSRT is most accurate, KCF is faster)
        tracker = cv2.TrackerCSRT_create()  # or cv2.TrackerKCF_create()
        tracker.init(frame_bgr, bbox)
        tracking_initialized = True
        return frame, None
    
    # Update tracker
    success, bbox = tracker.update(frame_bgr)
    
    if success:
        x, y, w, h = [int(v) for v in bbox]
        cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 255, 255), 2)
        cx, cy = x + w//2, y + h//2
        cv2.circle(frame, (cx, cy), 5, (255, 255, 255), -1)
        return frame, (cx, cy, w*h)
    else:
        cv2.putText(frame, "Tracking lost!", (50, 50),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        return frame, None

# For background subtraction
def track_with_background_subtraction(frame):
    """Track moving objects using background subtraction"""
    global background_subtractor
    
    if background_subtractor is None:
        background_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500, varThreshold=16, detectShadows=True
        )
    
    # Apply background subtraction
    fg_mask = background_subtractor.apply(frame)
    
    # Clean up mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Filter by area and find largest
        valid_contours = [c for c in contours if cv2.contourArea(c) > 500]
        
        if valid_contours:
            largest_contour = max(valid_contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 255, 255), 2)
            cx, cy = x + w//2, y + h//2
            cv2.circle(frame, (cx, cy), 5, (255, 255, 255), -1)
            
            return frame, (cx, cy, w*h)
    
    return frame, None

# Main loop
frame_count = 0
first_frame = True

print(f"Starting object tracking using method: {TRACKING_METHOD}")
print("Press 'q' to quit, 'r' to reinitialize tracker")

try:
    while True:
        # Receive header
        header = s.recv(header_size)
        if len(header) != header_size:
            print("Header size mismatch")
            break

        # Parse header
        width, height = struct.unpack("=HH", header)

        # Receive image
        bytes_to_read = width * height
        img = bytes()
        while len(img) < bytes_to_read:
            img += s.recv(min(bytes_to_read - len(img), 4096))

        # Convert to numpy array (make a writable copy)
        frame = np.frombuffer(img, np.uint8).reshape((height, width)).copy()
        
        # Apply tracking method
        tracked_info = None
        
        if TRACKING_METHOD == "color":
            frame, tracked_info = track_by_color(frame)
            
        elif TRACKING_METHOD == "tracker":
            frame, tracked_info = track_with_opencv_tracker(frame, first_frame)
            first_frame = False
            
        elif TRACKING_METHOD == "background":
            frame, tracked_info = track_with_background_subtraction(frame)
        
        # Display tracking info
        if tracked_info:
            cx, cy, size = tracked_info
            cv2.putText(frame, f"Position: ({cx}, {cy})", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Size: {int(size)}", (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Display frame count and method
        cv2.putText(frame, f"Method: {TRACKING_METHOD}", (10, height-40),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(frame, f"Frame: {frame_count}", (10, height-10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Display
        cv2.imshow("Object Tracking", frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            # Reinitialize tracker
            tracking_initialized = False
            tracker = None
            background_subtractor = None
            print("Tracker reinitialized")
        
        frame_count += 1

except KeyboardInterrupt:
    print("\n✓ Stopped by user")
finally:
    s.close()
    cv2.destroyAllWindows()
    print(f"Total frames processed: {frame_count}")