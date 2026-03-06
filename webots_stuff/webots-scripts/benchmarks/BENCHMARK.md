# DAC Benchmark Suite

This folder contains the benchmarking environment for the **Webots + ArduPilot LLM-Controlled Drone**. It evaluates the drone's ability to navigate complex scenarios using Vision-Language Models (VLMs) like GPT-4o.

## Architecture

The benchmark suite wraps the core flight script (`llm-controlled-script/main.py`) without modifying its internal LLM reasoning loop.

This wrap-around approach consists of three files per benchmark:
1. **`main.py`**: The orchestrator. Sets the mission goal, starts the metrics thread, runs the flight, and triggers final VLM grading upon landing.
2. **`concurrent_metrics.py`**: A background thread that connects directly to the MAVLink UDP port (`14550`). It polls GPS coordinates at 1Hz, allowing us to actively track Euclidean drift, altitude, and zonal progression without slowing down the drone.
3. **`vid_based_metrics.py`**: Runs post-flight. It stitches the logged frames (`iteration_*.jpg`) into a 2fps video (`mission_video.mp4`) and queries GPT-4o with a custom benchmarking prompt to grade subjective behavioral traits.

All results are automatically logged to the `llm-controlled-script/drone_logs/mission_TIMESTAMP/` directory alongside the standard flight logs.

## The Scenarios

The suite currently features 4 unique environments designed to test different robotic capabilities.

### 1. Benchmark 1 — Forest
* **Goal**: Navigate through trees to deliver supplies to a red crate.
* **Concurrent Metrics**: Tracks `zone_progression` by monitoring latitudinal progression past 3 distinct map thresholds.
* **VLM Evaluation**: Grades `navigation_persistence_score` (1-10); evaluates if the drone made meaningful forward progress or stalled in place.

### 2. Benchmark 2 — Canyon
* **Goal**: Ascend to reach a firefighter on an elevated plateau.
* **Concurrent Metrics**: Tracks `max_altitude_m` and `ascent_attempted` (did it climb > 5 meters?).
* **VLM Evaluation**: Grades `vertical_intent_score` (1-10); evaluates if the drone actively attempted a sustained climb rather than just searching laterally.

### 3. Benchmark 3 — Firefighter (Target Discrimination)
* **Goal**: Deliver supplies to Team Alpha (Red marker). Avoid Team Bravo (Blue marker).
* **Concurrent Metrics**: Tracks `wrong_target_approached` (< 20m from Blue) and `correct_target_reached` (< 5m from Red). 
* **VLM Evaluation**: Returns a boolean `distractor_engagement` flag indicating if the drone got confused and flew towards the wrong color initially.

### 4. Benchmark 4 — Multi-stop (Waypoints)
* **Goal**: Stop at the Yellow marker, then continue to the Red marker. 
* **Concurrent Metrics**: Records timestamps (`wp1_time`, `wp2_time`) upon arriving < 5m of each coordinate to verify sequential delivery.
* **VLM Evaluation**: Returns a boolean `sequence_awareness` flag evaluating if the drone visibly reoriented and pushed towards the second stop after reaching the first.

---

## How to Run a Benchmark

1. Ensure ArduPilot SITL is running and your Webots world is loaded.
2. Ensure `OPENAI_API_KEY` is set in `llm-controlled-script/.env`.
3. Run the specific benchmark's orchestrator script:

```bash
python3 benchmarks/benchmark_1_forest/main.py
```

*Note: Once complete, check the generated `metrics_concurrent.json` and `metrics_vlm.json` inside the newest `drone_logs/` mission folder.*
