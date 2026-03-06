#!/usr/bin/env python3
"""
LLM-Controlled Drone Mission (Refactored)
"""

import os
import time
import json
import threading
from datetime import datetime
from dotenv import load_dotenv

from drone import Drone
from camera import CameraStream
from navigator import LLMNavigator

load_dotenv()

# Global state for background hover
hover_active = False
drone_instance = None

def continuous_hover():
    """Background thread function to keep drone stable while LLM thinks"""
    global hover_active, drone_instance
    while hover_active and drone_instance:
        # Send neutral RC override (active stabilization)
        # Using drone_instance internal method would be better, but we can access public methods
        # However, drone.hover() is blocking for duration. We want non-blocking 20Hz updates.
        # We need a non-blocking 'send_hover_packet' method or similar in Drone.
        # Since we didn't expose one, we can use the private _send_rc_override if we want,
        # or better: add a method to Drone class. For now, accessing private member _send_rc_override is practical.
        if drone_instance.master:
            drone_instance._send_rc_override(1500, 1500, 1500, 1500)
        time.sleep(0.05)


DEFAULT_GOAL = "Go as close to the blue tower as possible"

def run_mission(goal=None, stop_event=None):
    global hover_active, drone_instance
    
    if goal is None:
        goal = DEFAULT_GOAL
    
    # 1. Setup Logging
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mission_log_dir = os.path.join(SCRIPT_DIR, f"drone_logs/mission_{timestamp}")
    os.makedirs(mission_log_dir, exist_ok=True)
    print(f"📂 Created mission log directory: {mission_log_dir}")

    # 2. Initialize Components
    drone = Drone()
    drone_instance = drone  # Set global for thread
    
    camera = CameraStream()
    navigator = LLMNavigator()

    # 3. Connection & Arming
    try:
        drone.connect()
        camera_connected = camera.connect()
        
        if not camera_connected:
            raise Exception("Camera connection failed")
            
        # Start background frame recording for video metrics
        camera.start_recording(os.path.join(mission_log_dir, "camera_frames"))
            
        if not drone.arm():
            raise Exception("Failed to arm drone")
        
        # 4. Takeoff
        drone.takeoff(duration=6, throttle=1700)
        drone.hover(3)
        
        # 5. Mission Loop
        # goal is now passed as an argument
        iteration = 0
        max_iterations = 50
        
        print(f"\n🎯 MISSION START: {goal}\n")
        
        conversation = []
        
        # Capture initial frame just to verify
        current_pic = camera.capture_single_frame()
        if current_pic is None:
            raise Exception("Failed to capture initial frame")
            
        goal_achieved = False
        
        while not goal_achieved and iteration < max_iterations:
            if stop_event and stop_event.is_set():
                print("\n🛑 Mission stopped by external event")
                break
                
            iteration += 1
            print(f"\n{'='*40}\n🔄 ITERATION {iteration}\n{'='*40}\n")
            
            # Start Background Hover
            print("🔄 Starting hover thread...")
            hover_active = True
            hover_thread = threading.Thread(target=continuous_hover, daemon=True)
            hover_thread.start()
            
            # Get LLM Action
            print("🧠 Requesting LLM analysis...")
            try:
                # Note: get_action saves image to mission_log_dir
                llm_response, prompt, image_path = navigator.get_action(
                    current_pic, 
                    goal, 
                    mission_log_dir=mission_log_dir, 
                    iteration=iteration
                )
            except Exception as e:
                print(f"❌ LLM Error: {e}")
                hover_active = False # Stop hover thread
                break
            
            # Stop Background Hover
            hover_active = False
            hover_thread.join()
            print("✓ Hover thread stopped")
            
            # Log Conversation
            conversation.append({
                "PROMPT": prompt,
                "RESPONSE": llm_response,
                "IMAGE_PATH": image_path,
                "ITERATION": iteration,
                "TIMESTAMP": datetime.now().isoformat()
            })
            with open(os.path.join(mission_log_dir, "log.json"), "w") as f:
                json.dump(conversation, f, indent=2)

            # Display Decision
            print("\n📋 LLM DECISION:")
            print(f"   Action: {llm_response.get('action')}")
            print(f"   Magnitude: {llm_response.get('magnitude')}")
            print(f"   Reasoning: {llm_response.get('reasoning')}")
            
            if llm_response.get("goal_achieved", False):
                print("\n🎉 GOAL ACHIEVED!")
                goal_achieved = True
                break
                
            # Add to History
            navigator.add_to_history(llm_response)
            
            # Execute Action
            print(f"\n🚁 EXECUTING: {llm_response.get('action', 'UNKNOWN').upper()}")
            try:
                # Handle actions
                action = llm_response.get('action')
                magnitude = llm_response.get('magnitude')
                
                if action == 'hover':
                    drone.hover(3)
                elif action == 'land':
                    drone.land()
                    goal_achieved = True
                elif action == 'rotate_clockwise':
                    drone.rotate(magnitude, direction='clockwise')
                elif action == 'rotate_counterclockwise':
                    drone.rotate(magnitude, direction='counter-clockwise')
                else:
                    # For translations (forward, backward, left, right, ascend, descend)
                    drone.move(action, magnitude if magnitude else 'medium')
                    
                    # Apply brake for translations (excluding vertical movement if we want to follow legacy strictly)
                    # Legacy script only braked for [forward, backward, left, right]
                    if action in ['forward', 'backward', 'left', 'right']:
                        drone.brake(action)
                
                # Stabilization hover
                drone.hover(2)
                    
            except Exception as e:
                print(f"❌ Execution Error: {e}")
                break
                
            # Capture Next Frame
            print("\n📸 Capturing new frame...")
            current_pic = camera.capture_single_frame()
            if current_pic is None:
                print("❌ Failed to capture frame")
                break
                
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        hover_active = False
        print("\n🛬 STARTING LANDING SEQUENCE")
        if drone:
            try:
                drone.land()
                drone.disarm()
            except:
                pass
        
        if camera:
            camera.stop()
            
        print("\n✅ MISSION FINISHED")

if __name__ == "__main__":
    run_mission()
