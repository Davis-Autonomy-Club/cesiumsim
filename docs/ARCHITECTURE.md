# Runtime Architecture

This document declares the canonical runtime architecture for `cesiumsim`.

It is an architectural contract for future work. It does not change the live simulator wiring in this ticket.

## Canonical Runtime Modules

### `src/main.ts`

- Canonical browser runtime entrypoint for the simulator.
- Owns top-level runtime composition inside `src/**`.
- New simulator startup wiring should begin here, not in root JavaScript files.

### `src/simulator/**`

- Canonical home for simulator runtime logic.
- Includes simulator state, controllers, HUD wiring, and simulator-specific support modules.
- New simulator behavior changes should be implemented here.

### `src/evaluation/**`

- Reserved canonical namespace for future evaluation workflows.
- Intended for scoring, replay analysis, measurement, and other non-gym evaluation runtimes.
- New evaluation code should be created here when that work begins.
- Shared benchmark result types and compatibility adapters live here.

### `src/gym/**`

- Reserved canonical namespace for future gym or environment integration work.
- Intended for environment wrappers, adapters, and training-facing runtime APIs.
- New gym-facing code should be created here when that work begins.

## Legacy Runtime Surface

The root JavaScript runtime remains in the repository for compatibility and reference, but it is legacy and reference-only.

This includes runtime modules outside `src/**`, including:

- `app.js`
- `agl-ceiling.js`
- `geospatial-overlay.js`
- `incident-overlay.js`
- `creative-mode/**`
- `flight-physics/**`

Rules for this legacy surface:

- Do not add new runtime features to it.
- Do not use it as the template for new modules.
- Do not delete it in this stage.
- Read it only when porting the smallest necessary behavior into `src/**`.

## Current Boundary

- Existing root HTML files may still reference legacy runtime entrypoints.
- Existing `src/**` folders outside the canonical module list may remain during migration.
- Those existing files do not change the canonical top-level module layout declared above.

## Playground Terrain

- Playground terrain support under `src/simulator/playgrounds/**` is intentionally limited to `flat` and `ellipsoid`.
- `flat` and `ellipsoid` currently both use Cesium's no-relief ellipsoid terrain provider.
- `procedural-hills` is not implemented and is rejected at runtime instead of silently falling back.

## Contributor Contract

- New runtime code must live under `src/**`.
- New top-level runtime modules must follow the canonical module layout in this document.
- If future work needs a new top-level runtime namespace, update this document in the same change.

## Tooling Contract

- TypeScript source root is `src/`.
- Type checking is scoped to `src/**/*.ts` and `src/**/*.d.ts`.
- Contributors should keep `npm run typecheck` and `npm run lint` green for code under `src/**`.
