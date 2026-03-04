# LLM-Controlled Drone Script Manual

This folder contains a Python-based autonomous drone controller that uses a Multi-Modal Large Language Model (LLM) (specifically GPT-4o) to make navigation decisions based on visual input.

## 📂 Folder Structure

The code is modularized into specific components for better maintainability and readability.

*   **`main.py`**
    *   **Purpose**: The entry point of the application.
    *   **Functionality**: Orchestrates the entire mission loop. It initializes connections, manages the background hovering thread, captures images, queries the LLM, logs data, and executes drone movements.

*   **`drone.py`**
    *   **Purpose**: Abstracts the drone hardware/simulation interface.
    *   **Functionality**: Handles MAVLink communication via `pymavlink`. Includes methods for properties like `connect()`, `takeoff()`, `land()`, `hover()`, and `move()`. It translates high-level commands (e.g., "forward") into specific RC channel overrides.
`
*   **`camera.py`**
    *   **Purpose**: Manages the camera feed.
    *   **Functionality**: Connects to a TCP camera server (listening on port 5599) to receive video frames. Supports both on-demand single frame capture and continuous threading streaming.

*   **`navigator.py`**
    *   **Purpose**: The "Brain" of the operation.
    *   **Functionality**: Interacts with the OpenAI API. It constructs the prompt with the current image and mission history, sends it to the LLM, and parses the JSON response into actionable commands.

*   **`utils.py`**
    *   **Purpose**: Shared utilities and configuration.
    *   **Functionality**: Stores constants (PWM values, timing parameters) and helper functions (base64 image encoding).

*   **`view_logs.py`**
    *   **Purpose**: Local web server for the dashboard.
    *   **Functionality**: Serves the mission logs through a web interface.

*   **`frontend/`**
    *   **Purpose**: Visual dashboard.
    *   **Functionality**: HTML/JS/CSS files that display the mission progress, images, and LLM reasoning in the browser.

*   **`drone_logs/`**
    *   **Purpose**: Mission history storage.
    *   **Functionality**: Stores timestamped folders containing captured images and `log.json` for each mission.

*   **`examples/`**
    *   **Purpose**: Utility and testing scripts.
    *   **Functionality**: Contains standalone scripts for testing takeoff, camera, motors, etc.

*   **`requirements.txt`**
    *   **Purpose**: Dependency management.
    *   **Functionality**: Lists all Python packages required to run the scripts.

*   **`legacy/`**
    *   **Purpose**: Backup of previous versions.
    *   **Functionality**: Contains the original non-refactored scripts.

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have Python 3.8+ installed. You can install all required libraries using the provided `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 2. External Systems

The script expects two external services to be running locally:

1.  **Drone Simulator (or Hardware)**:
    *   Must be accessible via MAVLink UDP at `127.0.0.1:14550`.
    *   Example: Webots with a drone controller enabling external control.

2.  **Camera Server**:
    *   Must be a TCP server accessible at `127.0.0.1:5599` that streams raw image data.

### 3. Environment Setup

Create a `.env` file in this directory (or the parent directory) to store your API key:

```bash
# .env
OPENAI_API_KEY=sk-your-api-key-here
```

### 4. Running the Mission

To start the autonomous mission, run the main script:

```bash
python3 main.py
```

### 5. Viewing Mission Logs

To visualize the mission results in your browser, run the log viewer:

```bash
python3 view_logs.py
```
This will open a dashboard at `http://localhost:8000`.

### 6. Execution Logic

1.  **Initialization**: The drone connects, arms, and takes off.
2.  **Mission Loop**:
    *   **Observe**: Captures a snapshot from the camera.
    *   **Think**: Sends the image + mission history to GPT-4o.
    *   **Act**: Executes the movement command returned by the AI.
    *   ** Stabilize**: A background thread sends continuous "neutral" commands to keep the drone stable while the AI is thinking.
3.  **Logs**: Mission logs (images and conversation JSON) are saved to `drone_logs/mission_YYYYMMDD_HHMMSS`.

## ⚠️ Troubleshooting

*   **"Camera connection failed"**: Ensure your camera server is running and listening on port 5599.
*   **"Connection closed by server"**: The image format might not match the expected protocol (Header: `width(H) height(H)`, Data: `bytes`).
*   **Drone merely hovers**: Check if the LLM is returning valid JSON or if "hover" is being selected as a fallback. Check logs in `drone_logs/`.
