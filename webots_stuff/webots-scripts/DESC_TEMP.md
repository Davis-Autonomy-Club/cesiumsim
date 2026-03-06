# DAC Benchmark Suite & Webots Autonomous Drone Codebase

This document provides an extremely in-depth codebase ingestion and architectural breakdown of the Webots + ArduPilot Drone Simulation repository, specifically focusing on the LLM-controlled autonomous flight functionality and the newly integrated DAC Benchmark Suite.

---

## 🏗️ High-Level Architecture

The system consists of three major layers:
1. **Simulation Layer (Webots + ArduPilot SITL)**: Simulates physics, environments (forest, city, canyon), and provides the core flight controller.
2. **Execution Layer (`llm-controlled-script/`)**: Bridges the MAVLink protocol with Python, establishing communication with the camera feed and drone telemetry.
3. **AI/Decision & Benchmarking Layer**: Feeds camera frames to a Vision-Language Model (VLM, namely GPT-4o) to decide movements, whilst concurrent metrics threads run in the background tracking performance according to specific benchmark scenarios.

---

## 🌳 Codebase File Tree

```text
webots/
├── .gitignore
├── CesiumSim/                        # Experimental secondary engine using Mapbox/Cesium
├── DAC_Benchmark_Implementation_Brief_v2.pdf  # The overarching specification for benchmarks
├── DESC_TEMP.md                      # This ingestion document
├── README.md                         # Root repository instructions & setup guide
├── city.wbt                          # Webots World: Generic City
├── crazyflie.wbt                     # Webots World: Standard Crazyflie
├── crazyflie_city.wbt                # Webots World: Crazyflie in City
├── crazyflie_fixed.parm              # ArduPilot parameter configurations
├── drone_city_env.wbt                # Webots World: Drone City Environment
├── benchmarks/                       # 🏆 DAC Benchmark Suite (Evaluations)
│   ├── main.py                       # Global benchmarking wrapper script
│   ├── benchmark_1_forest/           # Target: Navigate forest, reach red supply crate
│   │   ├── main.py
│   │   ├── concurrent_metrics.py     # Tracks GPS zonal progression
│   │   └── vid_based_metrics.py      # VLM Evaluation: navigation_persistence_score
│   ├── benchmark_2_canyon/           # Target: Ascend to reached elevated firefighter
│   │   ├── main.py
│   │   ├── concurrent_metrics.py     # Tracks max_alt and ascent attempts
│   │   └── vid_based_metrics.py      # VLM Evaluation: vertical_intent_score
│   ├── benchmark_3_firefighter/      # Target: Reach Team Alpha(Red), Avoid Team Bravo(Blue)
│   │   ├── main.py
│   │   ├── concurrent_metrics.py     # Tracks correct target and distractor approach errors
│   │   └── vid_based_metrics.py      # VLM Evaluation: distractor_engagement
│   └── benchmark_4_multistop/        # Target: Sequential delivery (Yellow then Red)
│       ├── main.py
│       ├── concurrent_metrics.py     # Tracks waypoint sequential timings
│       └── vid_based_metrics.py      # VLM Evaluation: sequence_awareness
└── llm-controlled-script/            # 🧠 Core LLM navigation & Drone Control
    ├── .env                          # API keys (OpenAI API key)
    ├── README.md                     # Specific documentation for the LLM runner
    ├── camera.py                     # Camera stream and socket connection
    ├── drone.py                      # MAVLink wrapper and physical action class
    ├── main.py                       # The standard infinite evaluation loop
    ├── navigator.py                  # The AI "Brain" - structures prompts and calls OpenAI
    ├── requirements.txt              # Standard Python dependencies
    ├── utils.py                      # Configurations and MAVLink constants/PWM values
    ├── view_logs.py                  # Python HTTP server for mission log visualization
    ├── drone_logs/                   # 📁 Outputs from missions (Frames, JSON, Videos)
    ├── examples/                     # 📁 Standalone test scripts (takeoff, frames, motors)
    ├── frontend/                     # 📁 Web Dashboard HTML/JS/CSS for log viewing
    └── legacy/                       # 📁 Old implementations (pre-refactoring)
```

---

## 📄 Detailed File Descriptions

### 1. The Core LLM Engine (`llm-controlled-script/`)

#### `main.py`
The orchestrator of the autonomous drone flight.
*   **Initialization**: Bootstraps the `Drone`, `CameraStream`, and `LLMNavigator`. Connects and arms the drone, taking off to a hover state.
*   **The Mission Loop**: Runs a continuous loop (max 50 iterations):
    1.  Starts a background `continuous_hover` thread (sending neutral PWM 1500 to keep the drone from drifting in SITL).
    2.  Captures the current frame from `camera.py`.
    3.  Calls `navigator.get_action()` to ask GPT-4o what to do.
    4.  Stops the hover thread and executes the returned action via `drone.py` (e.g., `drone.move('forward', 'medium')`).
    5.  Logs the prompt, response, and images to `drone_logs/log.json`.

#### `drone.py`
The hardware/simulator abstraction layer. Maps semantic commands to physical MAVLink RC overrides.
*   `connect()`, `arm()`, `disarm()`, `takeoff()`, `land()`.
*   `get_position()`: Uses `GLOBAL_POSITION_INT` to return real-time `(lat, lon, alt)` tuples.
*   `move(direction, magnitude)`: Translates directions ('forward', 'left', 'ascend', etc.) to underlying physical private methods (`_move_forward_physical()`).
*   `_execute_rc_command()`: The lowest level abstraction converting duration and PWM signals (roll, pitch, throttle, yaw) into `rc_channels_override_send` MAVLink commands.

#### `navigator.py`
The "Brain". Handles interaction with the OpenAI Vision-Language Model.
*   `get_action()`: Takes the current camera frame, base64 encodes it, formats the mission history, and constructs the prompt asking GPT-4o for its next move.
*   Enforces JSON output via prompt engineering and `_clean_json()`. Handles fallback logic if the API fails formatting (`_create_fallback()`).

#### `camera.py`
TCP socket client for streaming raw Webots camera data.
*   Connects to `127.0.0.1:5599`.
*   Reads binary frame structures (Header: `uint16` width, `uint16` height -> followed by byte data).
*   Can run a `_stream_loop()` on a background daemon thread to continuously grab frames, storing the most recent in memory and saving historic frames to disk.

#### `utils.py`
Global constants and helper functions.
*   PWM constants (`ROLL_LEFT = 1600`, `PITCH_FORWARD = 1600`, `NEUTRAL = 1500`, etc.).
*   Distance timing parameters (Short=1.0s, Medium=2.0s, Long=3.0s).
*   OpenCV to Base64 image encoding.

#### `view_logs.py` & `frontend/`
A local webserver (using `http.server`) to visualize the AI's decision-making process. The `frontend/` contains `index.html`, `styles.css`, and `script.js` which fetch the `log.json` and images from `drone_logs/` to render a human-readable dashboard showing exactly what the drone saw and why it made specific decisions.

---

### 2. The Benchmarking Suite (`benchmarks/`)

The benchmark suite adds an evaluation layer *around* the core `llm-controlled-script/main.py` execution without modifying the underlying drone logic. Each benchmark focuses on a unique environment and requires the drone to accomplish specific goals tracking different metrics.

#### Global Wrapper
*   **`benchmarks/main.py`**: A generic wrapper around `run_mission`. Rarely used directly now that specific benchmarks are implemented.

#### Benchmark Structure (Identical across all 4 scenarios)
Every scenario in `benchmark_X_name/` features three files:
1.  **`main.py`**:
    *   Defines the scenario specific `GOAL` and `SCENARIO_ID`.
    *   Creates the timestamped `log_dir` ahead of time to share between threads.
    *   Fires up the `run_concurrent_metrics` thread (Daemon).
    *   Calls `run_mission(goal=GOAL)` blocking the main thread.
    *   Once the mission is complete, stops the daemon and triggers `run_vid_metrics`.
2.  **`concurrent_metrics.py`**:
    *   Connects an independent MAVLink listener to `udp:127.0.0.1:14550`.
    *   Continuously polls GPS coordinates (at ~1Hz) using `GLOBAL_POSITION_INT` while the drone flies.
    *   Calculates Euclidean distances or latitudinal progression to generate `metrics_concurrent.json`.
3.  **`vid_based_metrics.py`**:
    *   Fires _after_ the drone has landed.
    *   Stitches all `iteration_*.jpg` files from the mission log into a `mission_video.mp4` running at 2fps.
    *   Subsamples the frames and sends them to GPT-4o with a highly specific VLM prompt designed to grade the drone's "behavior" or "intent" (e.g., did it try to climb? did it get distracted?), outputting to `metrics_vlm.json`.

#### The 4 Scenarios:

*   **`benchmark_1_forest` (Forest Progression)**
    *   **Goal**: Reach the red supply crate through the forest.
    *   **Metrics**: Tracks `zone_progression` based on latitudinal thresholds (Proxies: >30, >55, >70). VLM evaluates `"navigation_persistence_score"` (Did it make forward progress or spin?).

*   **`benchmark_2_canyon` (Vertical Ascent)**
    *   **Goal**: Reach the firefighter on an elevated plateau.
    *   **Metrics**: Tracks `max_altitude_m` and whether an `ascent_attempt` (>5m) was made. VLM evaluates `"vertical_intent_score"` (Did it try to climb towards the target?).

*   **`benchmark_3_firefighter` (Distractor Avoidance)**
    *   **Goal**: Deliver to Team Alpha (Red). Avoid Team Bravo (Blue).
    *   **Metrics**: Monitors distance to specific coordinates. Logs `wrong_target_approached` if it gets within 20m of the blue marker, and checks which target it landed at (<5m radius). VLM evaluates `"distractor_engagement"`.

*   **`benchmark_4_multistop` (Sequential Waypoints)**
    *   **Goal**: Deliver to Yellow marker *first*, then to the Red marker.
    *   **Metrics**: Tracks independent waypoint temporal arrival sequences (`wp1_time` vs `wp2_time`). VLM evaluates `"sequence_awareness"` (Did the drone re-orient itself after the first stop?).

---

## 📜 Standard Execution Flow

1. **User calls a benchmark**: `python3 benchmarks/benchmark_1_forest/main.py`.
2. Background thread (`concurrent_metrics.py`) starts silently listening on MAVLink.
3. `llm-controlled-script/main.py` takes over.
    - Connects to `CameraStream`.
    - `Drone.connect()`, `arm()`, `takeoff()`.
4. Drone captures frame `iteration_001.jpg`.
5. `LLMNavigator` asks GPT-4o what to do. Drone hovers while waiting.
6. GPT-4o responds `{"action": "forward", "magnitude": "medium"}`.
7. `Drone._move_forward_physical()` sends MAVLink channel overrides affecting Pitch.
8. Meanwhile, `concurrent_metrics.py` tracks the newly shifted GPS coordinates.
9. Drone repeats Steps 4-8 until goal achieved or 50 iterations hit.
10. Drone lands. Main script exits.
11. Benchmark thread captures final GPS state and saves `metrics_concurrent.json`.
12. `vid_based_metrics.py` kicks in, stitches the video, runs a final grading VLM call, and outputs `metrics_vlm.json`. Everything is saved cleanly into `drone_logs/`.
