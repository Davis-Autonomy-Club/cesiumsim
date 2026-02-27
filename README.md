# Cesium FPV Drone Simulator (v1)

High-fidelity first-person drone simulator built with CesiumJS and Google Photorealistic 3D Tiles (via Cesium Ion).

## What you get in v1

- First-person drone flight with mouse-look and inertial controls
- Streaming global terrain via Cesium World Terrain
- Google Photorealistic 3D Tiles loaded through Cesium Ion (asset 2275207) — no separate Google API key needed
- Automatic fallback to OSM buildings when 3D tiles fail to load
- Real-time HUD with speed, altitude, heading, attitude, and geo-position

## Run

```bash
npm run dev
```

Then open:

- `http://localhost:5173`

## Cesium token

The app uses a Cesium Ion token from the `.env` file (`VITE_CESIUM_TOKEN`) to authenticate all tile requests.

You can override at runtime:

- `http://localhost:5173/?cesiumToken=YOUR_TOKEN`

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

- Google Photorealistic 3D Tiles are served through Cesium Ion asset 2275207, authenticated via the Cesium Ion access token.
- The app falls back to Cesium + OSM data automatically if 3D tiles are unavailable.
