# Webots + ArduPilot Drone Development

This is a monorepo for drone simulation and control using Webots and ArduPilot.

## 🌟 LLM Controlled Drone (Main Feature)

**The core implementation for the autonomous LLM-controlled drone is located in the `llm-controlled-script/` folder.**

- **Folder**: [`llm-controlled-script/`](./llm-controlled-script/)
- **Main Script**: `llm-controlled-script/main.py`
- **Documentation**: See [`llm-controlled-script/README.md`](./llm-controlled-script/README.md) for detailed instructions on how to run the AI drone.

---

## 📂 Consolidation Notice

All peripheral scripts (takeoff, motor tests, etc.) and the frontend have been moved into the `llm-controlled-script/` directory to keep the project organized.

| Category                    | Location                             |
| :-------------------------- | :----------------------------------- |
| **Main Mission**            | `llm-controlled-script/main.py`      |
| **Log Viewer Server**       | `llm-controlled-script/view_logs.py` |
| **Web Dashboard**           | `llm-controlled-script/frontend/`    |
| **Utility/Example Scripts** | `llm-controlled-script/examples/`    |
| **Legacy/Original Scripts** | `llm-controlled-script/legacy/`      |

---

## 🛠 Setup & Installation

Before running any script, make sure ArduPilot SITL is [installed](https://ardupilot.org/dev/docs/sitl-with-webots-python.html) with Webots.

### 1. Setup ArduPilot + SITL

In your root directory:

```bash
git clone https://github.com/ArduPilot/ardupilot.git
git submodule update --init --recursive
```

### 2. Configure World & Parameters

1.  Add `crazyflie_fixed.parm` to `ardupilot/libraries/SITL/examples/Webots_Python/params`.
2.  Add `crazyflie.wbt` (Standard) or `drone_city_env.wbt` (City) to ``.

### 3. Launch Webots (First)

To avoid the common "Python Path" or "Controller failed" errors in Webots, it must be launched from a shell with **any** virtual environment active. You can use the one in this repository:

1. **Activate Environment**:
   ```bash
   # In the root of this 'webots' repo
   source venv/bin/activate
   ```

2. **Run Webots**:
   ```bash
   /Applications/Webots.app/Contents/MacOS/webots
   ```

3. **Open World**: In the Webots menu, open the world you configured in Step 2 (e.g., `crazyflie.wbt` or `drone_city_env.wbt`).

### 4. Launch ArduPilot SITL (Second)

**Note**: You **must** be inside your ArduPilot virtual environment to run this. **Webots must be open and running the world before you run this command.**

Navigate to the `ardupilot/` directory and run:

```bash
./Tools/autotest/sim_vehicle.py -v ArduCopter -w --model webots-python \
 --add-param-file=libraries/SITL/examples/Webots_Python/params/crazyflie_fixed.parm
```

---

## 🏙️ Optional: City Environment with Obstacles

If you want to test the drone in a complex environment with buildings, trees, and obstacles:

1. **Move World File**: Copy `drone_city_env.wbt` from this repo into:
   `rootdir/ardupilot/libraries/SITL/examples/Webots_Python/worlds/`
2. **Setup**: Follow the chronological steps above, ensuring you open `drone_city_env.wbt` in Webots during Step 3.
3. **Control**: Use any of the scripts (e.g., `main.py` or `takeoff.py`) to fly through the city!

### 5. Run Controllers

Once the simulation is running (and the drone is ready), you can run any of the python scripts.

For the LLM Mission:

```bash
cd llm-controlled-script
python3 main.py
```

For basic tests:

```bash
cd llm-controlled-script/examples
python3 takeoff.py
```

To view mission logs/dashboard:

```bash
cd llm-controlled-script
python3 view_logs.py
```

## Other Directories

- **`/CesiumSim`**: Experimental secondary approach for rolling a custom simulation using Cesium/Mapbox.
ardupilot/libraries/SITL/examples/Webots_Python/worlds