# Technical Implementation Plan: Mission Benchmarks in CesiumSim

## What Your Webots Benchmarks Actually Test

Before getting into implementation, here's a precise accounting of what you built in Webots, because the CesiumSim port needs to preserve these semantics exactly.

| Benchmark | Mission Goal | Concurrent Metric | VLM Metric |
|---|---|---|---|
| B1: Forest Supply Drop | Navigate through trees, deliver to red crate | `zone_progression` — did the drone cross latitudinal thresholds at ~30m, ~55m, ~70m into the route? | `navigation_persistence_score` (1–10) — did it make forward progress or spin in place? |
| B2: Canyon Terrain | Ascend to reach a firefighter on an elevated plateau | `max_altitude_m`, `ascent_attempted` (did it ever exceed 5m AGL?) | `vertical_intent_score` (1–10) — did it actually try to climb or just search laterally? |
| B3: Firefighter ID | Go to RED marker (Team Alpha). Ignore BLUE marker (Team Bravo) | `correct_target_reached` (alpha/bravo/neither), `wrong_target_approached` (ever within 20m of Bravo?) | `distractor_engagement` (bool) — did it initially orient toward the wrong color? |
| B4: Multi-Stop Delivery | Visit YELLOW first, then RED — in that order | `waypoint_1_reached`, `waypoint_2_reached`, `correct_sequence` (was WP1 reached before WP2?), `time_to_waypoint_1_s` | `sequence_awareness` (bool) — did it visibly reorient after reaching WP1? |

The Webots architecture ran **two parallel metric passes**: real-time GPS polling from MAVLink (concurrent) + post-flight VLM grading of frame screenshots (video-based). In CesiumSim, you have the same two channels available: real-time position from the `drone` state object in the frame loop, and the Gemini/screenshot pipeline that already exists. The port maps cleanly.

---

## Your Brainstorm — Where You Were Right and Where to Adjust

**Correct:**
- Keep existing playgrounds (`slalom`, `ring-course`, `maze`) in their current folder. Don't touch them.
- Create a new subfolder for your mission environments and metrics.
- Create new Playground objects, a new FlightMetrics class, and a new BenchmarkRunner — they need to be separate from the existing ones because they track completely different things (target discrimination, zone progression, altitude intent) vs. the general ones (collision count, path efficiency).

**One adjustment:**
You don't need to create tree objects from scratch as a separate abstraction. In CesiumSim, a "tree" is just a `cylinder` obstacle with certain proportions (a trunk) topped by an `ellipsoid` canopy — using the existing obstacle types in `loader.ts`. The rendering will be stylized, not photorealistic, which is fine. The mission semantics (navigate through forest) are what matter for LLM evaluation, and the obstacle density is what matters for collision avoidance. You could also use colored `box` obstacles as tree stand-ins if you want something faster to implement. The key insight from your Webots worlds is that trees were purely visual/physical obstacles, not logical entities with special behavior.

**The one genuinely new primitive you need:** Colored marker towers. In Webots these were tall colored boxes with flags. In CesiumSim, this maps to a tall `box` obstacle with a specific color material. The `loader.ts` `createObstacleEntity` only sets gray color right now. You need to extend the obstacle types to support `color` as a property. This is the most important new addition.

---

## Final Directory Structure

```
src/simulator/playgrounds/
├── types.ts                          ← EXTEND (add color to obstacles, add MissionTarget type)
├── loader.ts                         ← EXTEND (respect color field when creating entities)
├── index.ts                          ← EXTEND (export mission benchmarks)
│
├── courses/                          ← UNTOUCHED — existing general playgrounds
│   ├── slalom.ts
│   ├── ring-course.ts
│   ├── maze.ts
│   └── index.ts
│
└── missions/                         ← NEW FOLDER — everything you're adding
    ├── types.ts                      ← Mission-specific types (MissionTarget, ZoneThreshold, etc.)
    ├── loader.ts                     ← Mission-specific entity loader (trees, marker towers)
    ├── flight-metrics.ts             ← NEW — replaces/extends general FlightMetrics for missions
    ├── benchmark-runner.ts           ← NEW — mission-aware runner
    ├── index.ts                      ← Barrel export
    └── scenarios/
        ├── index.ts
        ├── forest-supply-drop.ts     ← B1
        ├── canyon-terrain.ts         ← B2
        ├── firefighter-id.ts         ← B3
        └── multi-stop-delivery.ts    ← B4
```

---

## Step 1: Extend the Obstacle Type System

**File: `src/simulator/playgrounds/types.ts`**

Add `color` as an optional field to all three obstacle types, and add two new types that your missions need: `tree` and `marker`.

```typescript
// ADD to ObstacleBox, ObstacleCylinder, ObstacleRing:
color?: {
  red: number;    // 0.0–1.0
  green: number;
  blue: number;
  alpha?: number; // defaults to 0.9
};

// NEW obstacle type: a tree (cylinder trunk + sphere canopy)
export interface ObstacleTree {
  type: "tree";
  position: { lon: number; lat: number; height: number };
  trunkHeight: number;     // e.g. 8 (meters)
  trunkRadius: number;     // e.g. 0.4
  canopyRadius: number;    // e.g. 4
  variant?: "pine" | "oak" | "cypress";  // affects color only
}

// NEW obstacle type: a colored marker tower (the red/blue/yellow mission targets)
export interface ObstacleMarker {
  type: "marker";
  id: string;              // logical ID — "alpha", "bravo", "wp1", "wp2", etc.
  position: { lon: number; lat: number; height: number };
  color: { red: number; green: number; blue: number };
  poleHeight: number;      // e.g. 8 (meters)
  poleWidth: number;       // e.g. 2
  hasClearingCircle?: boolean;  // flat disc on the ground to mark the zone
  clearingRadius?: number;
}

// ADD to the Obstacle union type:
export type Obstacle = ObstacleBox | ObstacleCylinder | ObstacleRing | ObstacleTree | ObstacleMarker;

// NEW: MissionTarget — a logical zone the drone must visit
export interface MissionTarget {
  id: string;              // matches ObstacleMarker.id
  position: { lon: number; lat: number; height: number };
  arrivalRadius: number;   // meters — drone must come within this distance
  isDistractor?: boolean;  // if true, approaching this is penalized (B3)
  label?: string;          // "Team Alpha (RED)" — used in mission goal string and HUD
}

// NEW: ZoneThreshold — for B1 zone progression tracking
export interface ZoneThreshold {
  id: string;              // "zone1", "zone2", "zone3"
  minLon: number;          // drone must pass this longitude to be "in" this zone
}

// NEW: MissionPlayground extends Playground with mission-specific fields
export interface MissionPlayground extends Playground {
  missionType: "supply-drop" | "altitude-climb" | "target-id" | "multi-stop";
  missionGoal: string;     // the text string given to the LLM
  missionTargets: MissionTarget[];
  zoneThresholds?: ZoneThreshold[];   // B1 only
  ascentTarget?: number;              // B2 only — minimum AGL altitude to achieve
}
```

**File: `src/simulator/playgrounds/loader.ts`**

Extend `createObstacleEntity` to handle `tree` and `marker` types, and respect the `color` field on existing types:

```typescript
// In createObstacleEntity, where it currently hardcodes Cesium.Color.GRAY:
// CHANGE:
material: obs.color
  ? Cesium.Color.fromBytes(
      Math.round(obs.color.red * 255),
      Math.round(obs.color.green * 255),
      Math.round(obs.color.blue * 255),
      Math.round((obs.color.alpha ?? 0.9) * 255)
    )
  : Cesium.Color.GRAY.withAlpha(0.8),

// ADD handler for "tree":
if (obs.type === "tree") {
  // Trunk
  const trunk = new Cesium.Entity({
    position: Cesium.Cartesian3.fromDegrees(obs.position.lon, obs.position.lat, obs.position.height + obs.trunkHeight / 2),
    cylinder: {
      length: obs.trunkHeight,
      topRadius: obs.trunkRadius,
      bottomRadius: obs.trunkRadius,
      material: Cesium.Color.fromBytes(89, 63, 40, 230),  // brown
    },
  });

  // Canopy — position sits on top of trunk
  const canopyHeight = obs.position.height + obs.trunkHeight + obs.canopyRadius * 0.7;
  const canopyColor = obs.variant === "oak"
    ? Cesium.Color.fromBytes(45, 100, 30, 220)   // dark green
    : obs.variant === "cypress"
    ? Cesium.Color.fromBytes(30, 80, 50, 220)    // deep green
    : Cesium.Color.fromBytes(40, 110, 35, 220);  // pine green

  const canopy = new Cesium.Entity({
    position: Cesium.Cartesian3.fromDegrees(obs.position.lon, obs.position.lat, canopyHeight),
    ellipsoid: {
      radii: new Cesium.Cartesian3(obs.canopyRadius, obs.canopyRadius, obs.canopyRadius * 1.3),
      material: canopyColor,
    },
  });

  // Return both — caller must add both to viewer
  // NOTE: loader.ts needs to change to return Entity[] per obstacle,
  //       or you use a wrapper entity group approach.
  // Simplest: add both directly in the loader and push both to obstacleEntities.
}

// ADD handler for "marker":
if (obs.type === "marker") {
  const entities: Cesium.Entity[] = [];
  const markerColor = Cesium.Color.fromBytes(
    Math.round(obs.color.red * 255),
    Math.round(obs.color.green * 255),
    Math.round(obs.color.blue * 255),
    230
  );
  const polePosition = Cesium.Cartesian3.fromDegrees(
    obs.position.lon, obs.position.lat,
    obs.position.height + obs.poleHeight / 2
  );

  // Pole
  entities.push(new Cesium.Entity({
    position: polePosition,
    box: {
      dimensions: new Cesium.Cartesian3(obs.poleWidth, obs.poleWidth, obs.poleHeight),
      material: markerColor,
      outline: true,
      outlineColor: markerColor.brighten(0.3, new Cesium.Color()),
    },
  }));

  // Flag at top
  const flagPosition = Cesium.Cartesian3.fromDegrees(
    obs.position.lon, obs.position.lat,
    obs.position.height + obs.poleHeight + 1.5
  );
  entities.push(new Cesium.Entity({
    position: flagPosition,
    box: {
      dimensions: new Cesium.Cartesian3(4, 0.2, 2.5),
      material: markerColor,
    },
  }));

  // Ground clearing disc (optional)
  if (obs.hasClearingCircle && obs.clearingRadius) {
    entities.push(new Cesium.Entity({
      position: Cesium.Cartesian3.fromDegrees(obs.position.lon, obs.position.lat, obs.position.height + 0.05),
      ellipse: {
        semiMajorAxis: obs.clearingRadius,
        semiMinorAxis: obs.clearingRadius,
        material: markerColor.withAlpha(0.2),
        outline: true,
        outlineColor: markerColor,
      },
    }));
  }

  return entities; // return array
}
```

**Important:** The current `loadPlayground` returns a single `Cesium.Entity | null` per obstacle. Trees and markers return multiple entities. The simplest fix is to change `createObstacleEntity` to always return `Cesium.Entity[]` and update the loop to spread into `obstacleEntities`.

---

## Step 2: The Four Mission Scenario Files

**File: `src/simulator/playgrounds/missions/scenarios/forest-supply-drop.ts`**

```typescript
import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;

export const forestSupplyDropMission: MissionPlayground = {
  id: "mission-forest-supply-drop",
  name: "B1: Forest Supply Drop",
  missionType: "supply-drop",
  missionGoal: "Navigate through the forest and deliver supplies to the firefighter at the RED supply crate.",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 15 },
  terrain: "flat",
  timeLimit: 300,

  // Logical targets — what FlightMetrics checks
  missionTargets: [
    {
      id: "red-crate",
      position: { lon: BASE_LON + 0.00072, lat: BASE_LAT + 0.00054, height: H + 1.5 },
      arrivalRadius: 8,
      label: "Red Supply Crate",
    },
  ],

  // Zone thresholds — lon offsets drone must pass to be in each zone
  // Mirrors Webots lat thresholds of 30m, 55m, 70m
  zoneThresholds: [
    { id: "zone1", minLon: BASE_LON + 0.00027 },  // ~30m
    { id: "zone2", minLon: BASE_LON + 0.00049 },  // ~55m
    { id: "zone3", minLon: BASE_LON + 0.00063 },  // ~70m
  ],

  obstacles: [
    // Base camp clearing — yellow crate at spawn
    { type: "marker", id: "base-camp", position: { lon: BASE_LON, lat: BASE_LAT, height: H },
      color: { red: 1.0, green: 0.9, blue: 0.0 }, poleHeight: 3, poleWidth: 3,
      hasClearingCircle: true, clearingRadius: 15 },

    // Target — red supply crate
    { type: "marker", id: "red-crate", position: { lon: BASE_LON + 0.00072, lat: BASE_LAT + 0.00054, height: H },
      color: { red: 0.9, green: 0.1, blue: 0.1 }, poleHeight: 3, poleWidth: 3,
      hasClearingCircle: true, clearingRadius: 12 },

    // Forest — mirrors Webots cluster placement converted to lon/lat offsets
    // Cluster 1: near base
    { type: "tree", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000072, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000198, lat: BASE_LAT + 0.000108, height: H }, trunkHeight: 10, trunkRadius: 0.5, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000180, lat: BASE_LAT - 0.000045, height: H }, trunkHeight: 8, trunkRadius: 0.4, canopyRadius: 3.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000135, lat: BASE_LAT - 0.000090, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000108, lat: BASE_LAT + 0.000135, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },

    // Cluster 2: mid-route dense section (~35–42m out)
    { type: "tree", position: { lon: BASE_LON + 0.000315, lat: BASE_LAT + 0.000225, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000342, lat: BASE_LAT + 0.000270, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000288, lat: BASE_LAT + 0.000252, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000360, lat: BASE_LAT + 0.000198, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000270, lat: BASE_LAT + 0.000288, height: H }, trunkHeight: 10, trunkRadius: 0.4, canopyRadius: 4, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000324, lat: BASE_LAT + 0.000315, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 3.8, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000378, lat: BASE_LAT + 0.000243, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4, variant: "cypress" },

    // Cluster 3: near target (~65–75m out)
    { type: "tree", position: { lon: BASE_LON + 0.000585, lat: BASE_LAT + 0.000450, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000630, lat: BASE_LAT + 0.000495, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000612, lat: BASE_LAT + 0.000432, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000648, lat: BASE_LAT + 0.000468, height: H }, trunkHeight: 10, trunkRadius: 0.4, canopyRadius: 3.8, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000675, lat: BASE_LAT + 0.000522, height: H }, trunkHeight: 12, trunkRadius: 0.55, canopyRadius: 5.5, variant: "oak" },

    // Boulders — large sphere obstacles
    { type: "cylinder", position: { lon: BASE_LON + 0.000270, lat: BASE_LAT + 0.000180, height: H + 4 }, length: 8, topRadius: 4 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000522, lat: BASE_LAT + 0.000378, height: H + 5 }, length: 10, topRadius: 5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000405, lat: BASE_LAT + 0.000495, height: H + 3.5 }, length: 7, topRadius: 3.5 },
  ],
};
```

**File: `src/simulator/playgrounds/missions/scenarios/canyon-terrain.ts`**

```typescript
import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;

// Canyon floor is H=0, plateau top is at H+14
// Webots: left ridge at x=-18, right ridge at x=38, plateau at x=60,y=50 at altitude 14m

export const canyonTerrainMission: MissionPlayground = {
  id: "mission-canyon-terrain",
  name: "B2: Canyon Terrain",
  missionType: "altitude-climb",
  missionGoal: "Reach the firefighter on the elevated plateau. You will need to ascend significantly — the target is high above the canyon floor.",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 5 },
  terrain: "flat",
  timeLimit: 300,
  ascentTarget: 14,  // meters AGL — matches Webots plateau height

  missionTargets: [
    {
      id: "plateau-target",
      position: { lon: BASE_LON + 0.00054, lat: BASE_LAT + 0.00045, height: H + 15 },
      arrivalRadius: 12,
      label: "Elevated Plateau (Red Crate)",
    },
  ],

  obstacles: [
    // Canyon left wall — tall narrow box
    {
      type: "box",
      position: { lon: BASE_LON - 0.000162, lat: BASE_LAT + 0.000270, height: H + 7 },
      dimensions: { length: 8, width: 80, height: 14 },
      heading: 0,
      color: { red: 0.52, green: 0.47, blue: 0.40 },
    },
    // Canyon right wall
    {
      type: "box",
      position: { lon: BASE_LON + 0.000342, lat: BASE_LAT + 0.000270, height: H + 8 },
      dimensions: { length: 8, width: 80, height: 16 },
      heading: 0,
      color: { red: 0.50, green: 0.45, blue: 0.38 },
    },
    // Elevated plateau block
    {
      type: "box",
      position: { lon: BASE_LON + 0.00054, lat: BASE_LAT + 0.00045, height: H + 7 },
      dimensions: { length: 20, width: 20, height: 14 },
      heading: 0,
      color: { red: 0.48, green: 0.43, blue: 0.37 },
    },
    // Target marker on plateau top
    {
      type: "marker", id: "plateau-target",
      position: { lon: BASE_LON + 0.00054, lat: BASE_LAT + 0.00045, height: H + 14 },
      color: { red: 0.9, green: 0.1, blue: 0.1 },
      poleHeight: 3, poleWidth: 2,
    },
    // Rock spires in canyon floor
    { type: "box", position: { lon: BASE_LON + 0.000090, lat: BASE_LAT + 0.000180, height: H + 4 }, dimensions: { length: 4, width: 4, height: 8 }, heading: 0, color: { red: 0.47, green: 0.44, blue: 0.40 } },
    { type: "box", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000360, height: H + 5 }, dimensions: { length: 5, width: 5, height: 10 }, heading: 0, color: { red: 0.50, green: 0.46, blue: 0.41 } },
    { type: "box", position: { lon: BASE_LON + 0.000072, lat: BASE_LAT + 0.000495, height: H + 3 }, dimensions: { length: 4, width: 4, height: 6 }, heading: 0, color: { red: 0.48, green: 0.44, blue: 0.39 } },
    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000045, lat: BASE_LAT + 0.000135, height: H + 2 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000198, lat: BASE_LAT + 0.000315, height: H + 2.5 }, length: 8, topRadius: 4 },
    // Sparse trees on canyon edges
    { type: "tree", position: { lon: BASE_LON - 0.000045, lat: BASE_LAT + 0.000090, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000225, lat: BASE_LAT + 0.000072, height: H }, trunkHeight: 10, trunkRadius: 0.5, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON - 0.000072, lat: BASE_LAT + 0.000405, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
  ],
};
```

**File: `src/simulator/playgrounds/missions/scenarios/firefighter-id.ts`**

```typescript
import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;
// Alpha (correct, RED): lon offset ~+90m east, lat offset ~+620m north → in degrees: +0.00081 lon, +0.00561 lat ... 
// Actually scale to match ~70-80m routes. Webots: Alpha at (10,70), Bravo at (70,10)
// Scale 1 degree lon ≈ 88000m at 37.8°N, 1 degree lat ≈ 110540m
// 70m north ≈ +0.000633 lat, 70m east ≈ +0.000795 lon

export const firefighterIdMission: MissionPlayground = {
  id: "mission-firefighter-id",
  name: "B3: Firefighter Identification",
  missionType: "target-id",
  missionGoal: "Deliver supplies to Team Alpha, identified by the RED marker. Do NOT go to the blue marker — that is Team Bravo.",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 15 },
  terrain: "flat",
  timeLimit: 300,

  missionTargets: [
    {
      id: "alpha",
      position: { lon: BASE_LON + 0.000090, lat: BASE_LAT + 0.000633, height: H },
      arrivalRadius: 5,
      isDistractor: false,
      label: "Team Alpha (RED)",
    },
    {
      id: "bravo",
      position: { lon: BASE_LON + 0.000633, lat: BASE_LAT + 0.000090, height: H },
      arrivalRadius: 20,   // wider "danger zone" for penalizing approach
      isDistractor: true,
      label: "Team Bravo (BLUE) — WRONG TARGET",
    },
  ],

  obstacles: [
    // Team Alpha — RED marker (correct target)
    { type: "marker", id: "alpha",
      position: { lon: BASE_LON + 0.000090, lat: BASE_LAT + 0.000633, height: H },
      color: { red: 0.9, green: 0.08, blue: 0.08 },
      poleHeight: 8, poleWidth: 2, hasClearingCircle: true, clearingRadius: 12 },

    // Team Bravo — BLUE marker (distractor)
    { type: "marker", id: "bravo",
      position: { lon: BASE_LON + 0.000633, lat: BASE_LAT + 0.000090, height: H },
      color: { red: 0.08, green: 0.25, blue: 0.9 },
      poleHeight: 8, poleWidth: 2, hasClearingCircle: true, clearingRadius: 12 },

    // Forest zone 1: between base and Alpha (north corridor)
    { type: "tree", position: { lon: BASE_LON + 0.000045, lat: BASE_LAT + 0.000198, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000072, lat: BASE_LAT + 0.000252, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000108, lat: BASE_LAT + 0.000288, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000054, lat: BASE_LAT + 0.000342, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000126, lat: BASE_LAT + 0.000378, height: H }, trunkHeight: 12, trunkRadius: 0.55, canopyRadius: 5.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000081, lat: BASE_LAT + 0.000432, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000117, lat: BASE_LAT + 0.000495, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000063, lat: BASE_LAT + 0.000540, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },

    // Forest zone 2: between base and Bravo (east corridor)
    { type: "tree", position: { lon: BASE_LON + 0.000198, lat: BASE_LAT + 0.000054, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000252, lat: BASE_LAT + 0.000081, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000315, lat: BASE_LAT + 0.000063, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000378, lat: BASE_LAT + 0.000108, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000432, lat: BASE_LAT + 0.000072, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000495, lat: BASE_LAT + 0.000099, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000558, lat: BASE_LAT + 0.000054, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "cypress" },

    // Central visual complexity
    { type: "tree", position: { lon: BASE_LON + 0.000270, lat: BASE_LAT + 0.000270, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000315, lat: BASE_LAT + 0.000225, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000360, lat: BASE_LAT + 0.000315, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000225, height: H + 2 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000450, lat: BASE_LAT + 0.000270, height: H + 2.5 }, length: 8, topRadius: 4 },
  ],
};
```

**File: `src/simulator/playgrounds/missions/scenarios/multi-stop-delivery.ts`**

```typescript
import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;
// WP1 (YELLOW) at Webots (35,35) → ~35m north & 35m east
// WP2 (RED) at Webots (75,20) → ~20m north & 75m east

export const multiStopDeliveryMission: MissionPlayground = {
  id: "mission-multi-stop-delivery",
  name: "B4: Multi-Stop Delivery",
  missionType: "multi-stop",
  missionGoal: "First deliver to the YELLOW marker (Team Alpha). Once you reach it, then navigate to the RED marker (Team Bravo).",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 15 },
  terrain: "flat",
  timeLimit: 360,

  missionTargets: [
    {
      id: "wp1",
      position: { lon: BASE_LON + 0.000398, lat: BASE_LAT + 0.000317, height: H },
      arrivalRadius: 5,
      isDistractor: false,
      label: "Waypoint 1 (YELLOW) — deliver first",
    },
    {
      id: "wp2",
      position: { lon: BASE_LON + 0.000852, lat: BASE_LAT + 0.000181, height: H },
      arrivalRadius: 5,
      isDistractor: false,
      label: "Waypoint 2 (RED) — deliver second",
    },
  ],

  obstacles: [
    // Base depot (white/grey box at spawn)
    { type: "box", position: { lon: BASE_LON, lat: BASE_LAT, height: H + 1.5 }, dimensions: { length: 4, width: 4, height: 3 }, heading: 0, color: { red: 0.85, green: 0.85, blue: 0.85 } },

    // WP1 — YELLOW marker
    { type: "marker", id: "wp1",
      position: { lon: BASE_LON + 0.000398, lat: BASE_LAT + 0.000317, height: H },
      color: { red: 1.0, green: 0.85, blue: 0.0 },
      poleHeight: 7, poleWidth: 2, hasClearingCircle: true, clearingRadius: 10 },

    // WP2 — RED marker
    { type: "marker", id: "wp2",
      position: { lon: BASE_LON + 0.000852, lat: BASE_LAT + 0.000181, height: H },
      color: { red: 0.9, green: 0.08, blue: 0.08 },
      poleHeight: 7, poleWidth: 2, hasClearingCircle: true, clearingRadius: 10 },

    // Tree cluster 1: base to WP1
    { type: "tree", position: { lon: BASE_LON + 0.000136, lat: BASE_LAT + 0.000109, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000204, lat: BASE_LAT + 0.000163, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000250, lat: BASE_LAT + 0.000090, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000170, lat: BASE_LAT + 0.000226, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000284, lat: BASE_LAT + 0.000199, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },

    // Tree cluster 2: flanking WP1
    { type: "tree", position: { lon: BASE_LON + 0.000318, lat: BASE_LAT + 0.000379, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000477, lat: BASE_LAT + 0.000253, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000511, lat: BASE_LAT + 0.000379, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },

    // Tree cluster 3: between WP1 and WP2
    { type: "tree", position: { lon: BASE_LON + 0.000591, lat: BASE_LAT + 0.000289, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000659, lat: BASE_LAT + 0.000226, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000705, lat: BASE_LAT + 0.000316, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000625, lat: BASE_LAT + 0.000163, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000739, lat: BASE_LAT + 0.000253, height: H }, trunkHeight: 12, trunkRadius: 0.55, canopyRadius: 5.5, variant: "oak" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000227, lat: BASE_LAT + 0.000271, height: H + 2 }, length: 6, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000546, lat: BASE_LAT + 0.000271, height: H + 2.5 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000773, lat: BASE_LAT + 0.000136, height: H + 2 }, length: 6, topRadius: 3 },
  ],
};
```

---

## Step 3: Mission FlightMetrics

**File: `src/simulator/playgrounds/missions/flight-metrics.ts`**

This is a new class, separate from the general `FlightMetrics`. It tracks the four mission-specific metric categories that match your Webots `concurrent_metrics.py` outputs.

```typescript
import type { MissionTarget, ZoneThreshold } from "./types";

export interface MissionMetricsResult {
  scenarioId: string;
  timeToCompletionS: number;

  // B1 — Forest
  zoneProgression?: "none" | "zone1" | "zone2" | "zone3";

  // B2 — Canyon
  maxAltitudeM?: number;
  ascentAttempted?: boolean;          // ever exceeded ascentThreshold?
  altitudeAtCompletion?: number;

  // B3 — Firefighter ID
  correctTargetReached?: string | "neither";  // "alpha" | "bravo" | "neither"
  wrongTargetApproached?: boolean;

  // B4 — Multi-Stop
  waypoint1Reached?: boolean;
  waypoint2Reached?: boolean;
  correctSequence?: boolean;
  timeToWaypoint1S?: number;

  // Common
  collisionCount: number;
}

export class MissionFlightMetrics {
  private scenarioId: string;
  private targets: MissionTarget[];
  private zoneThresholds: ZoneThreshold[];
  private ascentThreshold: number;

  private startTime: number = 0;
  private collisionCount: number = 0;

  // B1
  private highestZone: "none" | "zone1" | "zone2" | "zone3" = "none";

  // B2
  private maxAltitude: number = 0;
  private ascentAttempted: boolean = false;
  private altitudeAtCompletion: number = 0;

  // B3
  private correctTargetReached: string = "neither";
  private wrongTargetApproached: boolean = false;

  // B4
  private wp1Reached: boolean = false;
  private wp2Reached: boolean = false;
  private wp1Time: number | null = null;
  private wp2Time: number | null = null;

  constructor(scenarioId: string, targets: MissionTarget[], zoneThresholds: ZoneThreshold[] = [], ascentThreshold = 5) {
    this.scenarioId = scenarioId;
    this.targets = targets;
    this.zoneThresholds = zoneThresholds;
    this.ascentThreshold = ascentThreshold;
  }

  reset(): void {
    this.startTime = performance.now() / 1000;
    this.collisionCount = 0;
    this.highestZone = "none";
    this.maxAltitude = 0;
    this.ascentAttempted = false;
    this.altitudeAtCompletion = 0;
    this.correctTargetReached = "neither";
    this.wrongTargetApproached = false;
    this.wp1Reached = false;
    this.wp2Reached = false;
    this.wp1Time = null;
    this.wp2Time = null;
  }

  recordCollision(): void {
    this.collisionCount++;
  }

  // Called every frame from stepFrame()
  update(
    lon: number,
    lat: number,
    altAgl: number,
    toCartesian: (lon: number, lat: number, h: number) => { x: number; y: number; z: number }
  ): void {
    const elapsed = performance.now() / 1000 - this.startTime;

    // B1: Zone progression — based on longitude (east-west progress)
    if (this.zoneThresholds.length > 0) {
      const zones = [...this.zoneThresholds].sort((a, b) => b.minLon - a.minLon); // highest first
      for (const zone of zones) {
        if (lon >= zone.minLon) {
          // Only advance forward, never backward
          const zoneOrder = ["none", "zone1", "zone2", "zone3"];
          if (zoneOrder.indexOf(zone.id as any) > zoneOrder.indexOf(this.highestZone)) {
            this.highestZone = zone.id as any;
          }
          break;
        }
      }
    }

    // B2: Altitude tracking
    if (altAgl > this.maxAltitude) this.maxAltitude = altAgl;
    if (altAgl > this.ascentThreshold) this.ascentAttempted = true;
    this.altitudeAtCompletion = altAgl;

    // B3 + B4: Proximity checks against mission targets
    for (const target of this.targets) {
      const targetCart = toCartesian(target.position.lon, target.position.lat, target.position.height);
      const droneCart = toCartesian(lon, lat, 0);
      const dx = droneCart.x - targetCart.x;
      const dy = droneCart.y - targetCart.y;
      const dz = droneCart.z - targetCart.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (target.isDistractor) {
        // B3: penalize approaching the wrong target
        if (dist < target.arrivalRadius) {
          this.wrongTargetApproached = true;
          if (this.correctTargetReached === "neither") {
            this.correctTargetReached = target.id; // arrived at distractor
          }
        }
      } else {
        // Correct target arrival
        if (dist < target.arrivalRadius) {
          // B3: first correct target
          if (this.correctTargetReached === "neither" && !target.isDistractor) {
            this.correctTargetReached = target.id;
          }
          // B4: waypoint sequencing
          if (target.id === "wp1" && !this.wp1Reached) {
            this.wp1Reached = true;
            this.wp1Time = elapsed;
          }
          if (target.id === "wp2" && !this.wp2Reached) {
            this.wp2Reached = true;
            this.wp2Time = elapsed;
          }
        }
      }
    }
  }

  getResult(): MissionMetricsResult {
    const elapsed = performance.now() / 1000 - this.startTime;
    const correctSequence =
      this.wp1Reached && this.wp2Reached &&
      this.wp1Time !== null && this.wp2Time !== null &&
      this.wp1Time < this.wp2Time;

    return {
      scenarioId: this.scenarioId,
      timeToCompletionS: Math.round(elapsed * 100) / 100,
      zoneProgression: this.highestZone,
      maxAltitudeM: Math.round(this.maxAltitude * 100) / 100,
      ascentAttempted: this.ascentAttempted,
      altitudeAtCompletion: Math.round(this.altitudeAtCompletion * 100) / 100,
      correctTargetReached: this.correctTargetReached,
      wrongTargetApproached: this.wrongTargetApproached,
      waypoint1Reached: this.wp1Reached,
      waypoint2Reached: this.wp2Reached,
      correctSequence,
      timeToWaypoint1S: this.wp1Time !== null ? Math.round(this.wp1Time * 100) / 100 : undefined,
      collisionCount: this.collisionCount,
    };
  }

  // Used by BenchmarkRunner to check if the mission is complete
  isComplete(missionType: string): boolean {
    switch (missionType) {
      case "supply-drop": return this.correctTargetReached !== "neither";
      case "altitude-climb": return this.ascentAttempted && this.maxAltitude >= this.ascentThreshold;
      case "target-id": return this.correctTargetReached !== "neither";
      case "multi-stop": return this.wp1Reached && this.wp2Reached;
      default: return false;
    }
  }
}
```

---

## Step 4: Mission BenchmarkRunner

**File: `src/simulator/playgrounds/missions/benchmark-runner.ts`**

```typescript
import type { MissionPlayground } from "./types";
import type { MissionMetricsResult } from "./flight-metrics";
import { MissionFlightMetrics } from "./flight-metrics";

export type MissionBenchmarkResult = {
  metrics: MissionMetricsResult;
  completed: boolean;
  reason: "success" | "timeout" | "manual_stop";
};

export type MissionBenchmarkCallbacks = {
  getDronePosition: () => { lon: number; lat: number; altAgl: number; altMsl: number; heading: number };
  toCartesian: (lon: number, lat: number, h: number) => { x: number; y: number; z: number };
  recordCollision: () => void;    // called when the existing collision system fires
};

export function createMissionBenchmarkRunner(
  mission: MissionPlayground,
  callbacks: MissionBenchmarkCallbacks
) {
  const metrics = new MissionFlightMetrics(
    mission.id,
    mission.missionTargets,
    mission.zoneThresholds ?? [],
    mission.ascentTarget ?? 5
  );

  let running = false;
  let stopRequested = false;

  return {
    getMetrics() {
      return metrics;
    },

    start() {
      metrics.reset();
      running = true;
      stopRequested = false;
    },

    stop() {
      stopRequested = true;
    },

    isRunning() {
      return running;
    },

    // Called every frame from stepFrame() instead of (or alongside) the general runner
    tick(_dt: number): { done: boolean; result?: MissionBenchmarkResult } {
      if (!running) return { done: false };

      if (stopRequested) {
        running = false;
        return {
          done: true,
          result: {
            metrics: metrics.getResult(),
            completed: false,
            reason: "manual_stop",
          },
        };
      }

      const pos = callbacks.getDronePosition();
      const elapsed = metrics.getResult().timeToCompletionS;

      // Timeout check
      if (mission.timeLimit && elapsed >= mission.timeLimit) {
        running = false;
        return {
          done: true,
          result: {
            metrics: metrics.getResult(),
            completed: metrics.isComplete(mission.missionType),
            reason: "timeout",
          },
        };
      }

      // Update metrics this frame
      metrics.update(pos.lon, pos.lat, pos.altAgl, callbacks.toCartesian);

      // Check completion
      if (metrics.isComplete(mission.missionType)) {
        running = false;
        return {
          done: true,
          result: {
            metrics: metrics.getResult(),
            completed: true,
            reason: "success",
          },
        };
      }

      return { done: false };
    },

    getResult(): MissionMetricsResult {
      return metrics.getResult();
    },
  };
}
```

---

## Step 5: Wire Into simulator-app.ts

These are the exact changes to make in the existing `simulator-app.ts`. Don't rewrite the file — add these surgically.

**Imports to add at top:**
```typescript
import { forestSupplyDropMission } from "./playgrounds/missions/scenarios/forest-supply-drop";
import { canyonTerrainMission } from "./playgrounds/missions/scenarios/canyon-terrain";
import { firefighterIdMission } from "./playgrounds/missions/scenarios/firefighter-id";
import { multiStopDeliveryMission } from "./playgrounds/missions/scenarios/multi-stop-delivery";
import { createMissionBenchmarkRunner } from "./playgrounds/missions/benchmark-runner";
import type { MissionPlayground } from "./playgrounds/missions/types";
```

**New state variables (alongside existing ones):**
```typescript
let activeMissionPlayground: MissionPlayground | null = null;
let missionBenchmarkRunner: ReturnType<typeof createMissionBenchmarkRunner> | null = null;
```

**In `setupInputHandlers()`** — add mission buttons alongside the existing playground buttons:
```typescript
const missionBtns = [
  { id: "mission-forest", mission: forestSupplyDropMission },
  { id: "mission-canyon", mission: canyonTerrainMission },
  { id: "mission-firefighter", mission: firefighterIdMission },
  { id: "mission-multistop", mission: multiStopDeliveryMission },
];
for (const { id, mission } of missionBtns) {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener("click", () => {
      missionBtns.forEach(({ id: oid }) => {
        document.getElementById(oid)?.classList.toggle("active", oid === id);
      });
      switchToMission(mission);
      btn.blur();
    });
  }
}
```

**New `switchToMission()` function:**
```typescript
function switchToMission(mission: MissionPlayground) {
  // Clean up any existing playground or mission
  if (playgroundObstacleEntities.length) {
    unloadPlayground(viewer, playgroundObstacleEntities);
    playgroundObstacleEntities = [];
  }

  // Load mission world (uses the extended mission loader)
  const result = loadMissionAssets(mission, viewer);
  playgroundObstacleEntities = result.obstacleEntities;
  viewer.terrainProvider = result.terrainProvider;
  if (googleTilesRef) googleTilesRef.show = false;
  if (osmBuildingsRef) osmBuildingsRef.show = false;

  activeMissionPlayground = mission;
  activePlayground = null; // clear general playground

  // Initialize mission benchmark runner
  missionBenchmarkRunner = createMissionBenchmarkRunner(mission, {
    getDronePosition: () => {
      Cesium.Cartographic.fromCartesian(drone.position, Cesium.Ellipsoid.WGS84, scratch.cartographic);
      return {
        lon: Cesium.Math.toDegrees(scratch.cartographic.longitude),
        lat: Cesium.Math.toDegrees(scratch.cartographic.latitude),
        altAgl: Math.max(0, scratch.cartographic.height - drone.lastGroundHeight),
        altMsl: scratch.cartographic.height,
        heading: drone.heading,
      };
    },
    toCartesian: (lon, lat, h) => {
      const c = Cesium.Cartesian3.fromDegrees(lon, lat, h);
      return { x: c.x, y: c.y, z: c.z };
    },
    recordCollision: () => flightMetrics.recordCollision(),
  });
  missionBenchmarkRunner.start();

  teleportTo(mission.spawn);
  flightMetrics.reset();
  HUD.datasetStatus.textContent = `Mission: ${mission.name}`;
}
```

**In `stepFrame()`** — add the mission tick after the general flight metrics update:
```typescript
// EXISTING (already there):
flightMetrics.updatePosition(drone.position.x, drone.position.y, drone.position.z);

// ADD after:
if (missionBenchmarkRunner && missionBenchmarkRunner.isRunning()) {
  const tickResult = missionBenchmarkRunner.tick(dt);
  if (tickResult.done && tickResult.result) {
    console.log("[mission] Complete:", tickResult.result);
    // Optionally display final metrics in the HUD
    updateMissionResultHUD(tickResult.result);
    missionBenchmarkRunner = null;
  }
}
```

**In `updateHudReadout()`** — extend the metrics display:
```typescript
// EXISTING metrics display:
metricsEl.textContent = `Collisions: ${result.collisionCount} | Waypoints: ...`;

// ADD: if a mission is active, show mission-specific metrics instead
if (activeMissionPlayground && missionBenchmarkRunner) {
  const mResult = missionBenchmarkRunner.getResult();
  const lines = [
    `Mission: ${activeMissionPlayground.name}`,
    `Time: ${mResult.timeToCompletionS.toFixed(0)}s`,
    mResult.zoneProgression ? `Zone: ${mResult.zoneProgression}` : null,
    mResult.maxAltitudeM !== undefined ? `Max Alt: ${mResult.maxAltitudeM.toFixed(1)}m` : null,
    mResult.wrongTargetApproached !== undefined ? `Wrong Target: ${mResult.wrongTargetApproached ? "YES" : "no"}` : null,
    mResult.correctTargetReached ? `Target: ${mResult.correctTargetReached}` : null,
    mResult.waypoint1Reached !== undefined ? `WP1: ${mResult.waypoint1Reached ? "✓" : "—"} | WP2: ${mResult.waypoint2Reached ? "✓" : "—"}` : null,
    `Collisions: ${mResult.collisionCount}`,
  ].filter(Boolean).join(" | ");
  metricsEl.textContent = lines;
}
```

---

## Step 6: index.html Additions

Add mission buttons to the HUD panel alongside the existing playground buttons:

```html
<!-- Inside the existing panel, after playground buttons -->
<div class="panel-section">
  <div class="panel-label">MISSION BENCHMARKS</div>
  <button id="mission-forest">B1: Forest Supply Drop</button>
  <button id="mission-canyon">B2: Canyon Terrain</button>
  <button id="mission-firefighter">B3: Firefighter ID</button>
  <button id="mission-multistop">B4: Multi-Stop Delivery</button>
</div>
```

---

## What You Noted vs. What's Actually Needed

| Your Note | Reality |
|---|---|
| "Create TREE / OTHER objects" | Partially right. No new asset type needed. Trees = cylinder + ellipsoid using existing Cesium entity primitives. The new thing is the `ObstacleTree` and `ObstacleMarker` type definitions and their rendering code in `loader.ts`. |
| "Create Playground objects" | Correct. Four new `MissionPlayground` objects (extends `Playground` with mission-specific fields). |
| "Create a FLIGHT METRICS script" | Correct and critical. The existing `FlightMetrics` class tracks general metrics. Your missions need `MissionFlightMetrics` in the new `missions/` folder, which tracks zone progression, altitude, target discrimination, and waypoint sequencing. |
| "Create BENCHMARK RUNNER" | Correct. A new `createMissionBenchmarkRunner()` that calls `MissionFlightMetrics.update()` every frame, checks mission-type-specific completion, and surfaces the result. |
| "Keep current worlds, create new folder" | Correct — `missions/` subfolder inside `playgrounds/`. |
| The VLM/video-based metrics from Webots | These don't have a direct CesiumSim equivalent yet (the Gemini controller could do this, but it's not wired). Leave this for a second pass. The concurrent metrics (everything in `MissionFlightMetrics`) are the first priority. |

---

## Implementation Order

1. `src/simulator/playgrounds/types.ts` — Add color, ObstacleTree, ObstacleMarker, MissionTarget, ZoneThreshold, MissionPlayground
2. `src/simulator/playgrounds/loader.ts` — Handle color, tree, marker. Change return type to `Entity[]` per obstacle
3. `src/simulator/playgrounds/missions/types.ts` — Re-export from main types or add mission-specific ones
4. `src/simulator/playgrounds/missions/flight-metrics.ts` — Full MissionFlightMetrics class
5. `src/simulator/playgrounds/missions/benchmark-runner.ts` — createMissionBenchmarkRunner
6. `src/simulator/playgrounds/missions/scenarios/*.ts` — All four scenario files
7. `src/simulator/playgrounds/missions/index.ts` — Barrel export
8. `src/simulator/simulator-app.ts` — switchToMission(), wiring in stepFrame() and HUD
9. `index.html` — Mission buttons