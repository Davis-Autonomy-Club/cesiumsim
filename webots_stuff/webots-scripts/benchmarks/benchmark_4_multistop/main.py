#!/usr/bin/env python3
import sys
import os
import threading
import select
import tty
import termios
from datetime import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
llm_path = os.path.join(project_root, 'llm-controlled-script')

if llm_path not in sys.path:
    sys.path.insert(0, llm_path)

from main import run_mission
from concurrent_metrics import run_concurrent_metrics
from vid_based_metrics import run_vid_metrics

GOAL = 'First deliver to the YELLOW marker (Team Alpha). Once you reach it, then navigate to the RED marker (Team Bravo).'
SCENARIO_ID = 'benchmark_4_multistop'

def keyboard_listener(stop_event):
    print("\n⌨️  Press 'q' at any time to stop the mission gracefully.")
    fd = sys.stdin.fileno()
    try:
        old_settings = termios.tcgetattr(fd)
    except termios.error:
        # Not a TTY
        return
        
    try:
        tty.setcbreak(fd)
        while not stop_event.is_set():
            if select.select([sys.stdin], [], [], 0.5)[0]:
                ch = sys.stdin.read(1)
                if ch.lower() == 'q':
                    print("\n🛑 'q' pressed. Stopping mission...")
                    stop_event.set()
                    break
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

def main():
    # Build the log_dir path BEFORE calling run_mission so metrics thread knows where to write
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_dir = os.path.join(llm_path, f'drone_logs/mission_{timestamp}')

    # Start concurrent metrics in background
    stop_event = threading.Event()
    t = threading.Thread(
        target=run_concurrent_metrics,
        args=(stop_event, log_dir, SCENARIO_ID),
        daemon=True
    )
    t.start()

    # Start keyboard listener
    kb_thread = threading.Thread(target=keyboard_listener, args=(stop_event,), daemon=True)
    kb_thread.start()

    # Run the mission
    run_mission(goal=GOAL, stop_event=stop_event)

    # Signal metrics thread to stop and wait
    stop_event.set()
    t.join(timeout=5)

    # Run video-based metrics after mission completes
    run_vid_metrics(log_dir, SCENARIO_ID)


if __name__ == '__main__':
    main()
