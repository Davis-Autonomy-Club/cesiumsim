# Cesium FPV Drone Simulator (v1)

High-fidelity first-person drone simulator built with CesiumJS and optional Google Photorealistic 3D Tiles.

## What you get in v1

- First-person drone flight with mouse-look and inertial controls
- Streaming global terrain via Cesium World Terrain
- Google Photorealistic 3D Tiles enabled by default (hardcoded API key)
- Automatic fallback to OSM buildings when Google tiles are not configured
- Real-time HUD with speed, altitude, heading, attitude, and geo-position

## Run

From `/Users/nilsfleig/Projects/cesiumsim`:

```bash
python3 -m http.server 4173
```

Then open:

- `http://localhost:4173`

Optional (override Google key):

- `http://localhost:4173/?googleApiKey=YOUR_GOOGLE_MAPS_API_KEY`

## Cesium token

`app.js` includes your provided Cesium default access token so the simulator boots without extra setup.

You can override at runtime:

- `http://localhost:4173/?cesiumToken=YOUR_TOKEN`

## Controls

- `W A S D`: translate in local drone axes
- `Space`: rise
- `Shift`: descend
- `Mouse`: look/yaw-pitch
- `Arrow keys`: fine yaw/pitch trim
- `Q / E`: roll
- `Ctrl`: boost
- `R`: reset to spawn location

## Notes

- Google Photorealistic 3D Tiles use the hardcoded API key in `app.js`; URL/localStorage values can still override it.
- The app falls back to Cesium + OSM data automatically if Google tiles are unavailable.
