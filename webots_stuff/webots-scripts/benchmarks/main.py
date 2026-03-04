#!/usr/bin/env python3
import sys
import os

# Add the llm-controlled-script directory to the path so we can import from it
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
llm_script_path = os.path.join(project_root, "llm-controlled-script")

# Add the directory to sys.path so we can import modules from it
if llm_script_path not in sys.path:
    sys.path.insert(0, llm_script_path)

try:
    # Now we can import main from the llm-controlled-script directory
    import main
    from main import run_mission
except ImportError as e:
    print(f"Error: Could not import run_mission from llm-controlled-script/main.py.")
    print(f"Import error: {e}")
    sys.exit(1)

def main():
    # This is a wrapper for the benchmarks
    # The main purpose is to allow providing a custom goal
    
    custom_goal = "Find the landing pad and land on it"
    
    print(f"🚀 Starting Benchmark Mission")
    print(f"🎯 Goal: {custom_goal}")
    print(f"----------------------------------------")
    
    try:
        run_mission(goal=custom_goal)
    except KeyboardInterrupt:
        print("\n🛑 Benchmark interrupted by user")
    except Exception as e:
        print(f"\n❌ Benchmark failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
