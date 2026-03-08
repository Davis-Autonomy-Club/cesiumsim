# CesiumSim

CesiumSim is a Vite-based browser simulator with an optional MAVLink bridge for QGroundControl.

## Startup

Use exactly one local startup flow for development:

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite dev server runs on `http://localhost:4173/`.

Use Node.js `20.19+` or `22.12+` so Vite 7 starts without engine warnings.

Open:

- `http://localhost:4173/` for the simulator
- `http://localhost:4173/training.html` for the training world

## Environment Variables

Create a local `.env` file from `.env.example`.

- `VITE_CESIUM_TOKEN` is required for Cesium Ion terrain and imagery.
- `VITE_GEMINI_API_KEY` is optional and is only needed for Gemini-powered simulator features under `src/simulator/**`.

## Optional QGroundControl Bridge

The browser app still starts with `npm run dev`. If you also want MAVLink output for QGroundControl, run the bridge in a second terminal:

```bash
./start-sitl.sh
```

The bridge listens on `ws://localhost:8089` and forwards MAVLink to `udpout:127.0.0.1:14550`.

## Architecture

Canonical runtime structure is documented in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Contributing

New runtime code must live under `src/**`. Root JavaScript runtime files are legacy/reference-only. See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor rules.

## More Detail

See [GETTING_STARTED.md](./GETTING_STARTED.md) for the full setup sequence and troubleshooting notes.
