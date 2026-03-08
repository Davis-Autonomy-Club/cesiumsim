# Getting Started

## Prerequisites

- Node.js `20.19+` or `22.12+`
- npm
- A Cesium Ion access token
- Python 3 if you plan to use the optional QGroundControl bridge

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file:

   ```bash
   cp .env.example .env
   ```

3. Add the required values:

   - `VITE_CESIUM_TOKEN`: required for the simulator and training world
   - `VITE_GEMINI_API_KEY`: optional, only for Gemini-assisted simulator features

## Start The App

Run the Vite development server:

```bash
npm run dev
```

Vite is configured to serve this project on `http://localhost:4173/`.

Use these URLs:

- `http://localhost:4173/` for the main simulator
- `http://localhost:4173/training.html` for the training world

## Optional QGroundControl Bridge

If you want QGroundControl integration, keep the Vite server running and start the bridge separately:

```bash
./start-sitl.sh
```

Then open QGroundControl. The bridge exposes:

- WebSocket input on `ws://localhost:8089`
- MAVLink UDP output on `127.0.0.1:14550`

The bridge is optional. It does not replace `npm run dev` as the way to start the project.

## Troubleshooting

- If the app loads but Cesium assets fail, verify `VITE_CESIUM_TOKEN` is present in `.env`.
- If `http://localhost:4173/` does not open, confirm `npm run dev` is still running and that port `4173` is available.
- If QGroundControl shows no vehicle, confirm `./start-sitl.sh` is running before checking QGC comm link settings.
