import socket
import struct
import numpy as np
import cv2
import time
import os
import threading
from datetime import datetime

class CameraStream:
    def __init__(self, host="127.0.0.1", port=5599):
        self.host = host
        self.port = port
        self.running = False
        self.frame_count = 0
        self.output_dir = None
        self.socket = None
        self.thread = None
        self.latest_frame = None
        self.lock = threading.Lock()

    def connect(self):
        """Establish connection to the camera server"""
        print("Connecting to camera stream...")
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(5.0)
            self.socket.connect((self.host, self.port))
            self.socket.settimeout(None)
            print("✓ Camera connected")
            return True
        except Exception as e:
            print(f"❌ Camera connection failed: {e}")
            return False

    def start_recording(self, output_dir=None):
        """Start the background thread to continuously capture and save frames"""
        if self.running:
            print("Camera is already running.")
            return

        if output_dir:
            self.output_dir = output_dir
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_dir = f"camera_frames_{timestamp}"
            
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"Saving camera frames to: {self.output_dir}/")

        self.running = True
        self.thread = threading.Thread(target=self._stream_loop, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop the camera stream and close connection"""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        self.socket = None
        print(f"✓ Camera stream closed. Total frames saved: {self.frame_count}")

    def get_latest_frame(self):
        """Return the most recently captured frame safely"""
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None

    def capture_single_frame(self, timeout=5.0):
        """Capture a single frame on demand (blocking) - mainly for initial setup or low-rate usage"""
        # If running in background thread, just get the latest frame
        if self.running:
            start_time = time.time()
            while time.time() - start_time < timeout:
                frame = self.get_latest_frame()
                if frame is not None:
                    return frame
                time.sleep(0.1)
            return None

        # Otherwise, if not running continuously, open a temporary connection or use existing
        # NOTE: The original script opened a new connection for each 'get_current_pic' if not streaming.
        # We will support a persistent connection but manual read if not threaded.
        
        if not self.socket:
            if not self.connect():
                return None
        
        try:
            return self._read_frame_from_socket()
        except Exception as e:
            print(f"Error capturing frame: {e}")
            return None
        finally:
            # If we are in "single shot" mode (not threaded), we might want to close or keep open.
            # unique connection logic from original script suggests ephemeral connections were used for 'get_current_pic'.
            # But let's keep it open for efficiency if the caller manages it, or close if this method manages it.
            # To be safe and mimic 'get_current_pic' which opens/closes every time:
            if not self.running: 
                self.socket.close()
                self.socket = None

    def _read_frame_from_socket(self):
        """Internal helper to read one frame protocol from the socket"""
        header_size = struct.calcsize("=HH")
        
        # Receive header
        header = b''
        while len(header) < header_size:
            chunk = self.socket.recv(header_size - len(header))
            if not chunk:
                raise ConnectionError("Connection closed by server")
            header += chunk
        
        width, height = struct.unpack("=HH", header)

        # Receive image data
        bytes_to_read = width * height
        img = b''
        while len(img) < bytes_to_read:
            chunk_size = min(bytes_to_read - len(img), 4096)
            chunk = self.socket.recv(chunk_size)
            if not chunk:
                raise ConnectionError("Connection closed while receiving image")
            img += chunk

        if len(img) != bytes_to_read:
            raise ValueError(f"Image size mismatch: expected {bytes_to_read}, got {len(img)}")

        # Convert to numpy array
        img_array = np.frombuffer(img, dtype=np.uint8)
        return img_array.reshape((height, width))

    def _stream_loop(self):
        """Background loop for continuous capturing"""
        # Ensure connected
        if not self.socket:
            if not self.connect():
                self.running = False
                return

        while self.running:
            try:
                img_array = self._read_frame_from_socket()
                
                # Update latest frame
                with self.lock:
                    self.latest_frame = img_array
                
                # Save to disk
                if self.output_dir:
                    frame_filename = f"{self.output_dir}/frame_{self.frame_count:06d}.jpg"
                    cv2.imwrite(frame_filename, img_array)
                    
                    if self.frame_count % 10 == 0:
                        print(f"📸 Saved frame {self.frame_count}")
                    
                    self.frame_count += 1
            
            except (socket.timeout, OSError) as e:
                print(f"Socket error in loop: {e}")
                break
            except Exception as e:
                print(f"Error in camera loop: {e}")
                time.sleep(0.1)
                
        # Cleanup happens in stop()
