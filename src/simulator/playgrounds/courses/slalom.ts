import type { Playground } from "../types";
import {
  boxAt,
  createCourseFrame,
  createTerrainMounds,
  cylinderAt,
  spawnAt,
  waypointAt,
} from "./course-utils";

const FRAME = createCourseFrame(-122.4022, 37.8012);

const SLALOM_ROUTE = [
  { id: "s01_entry", east: 0, north: 0, height: 12, radius: 10 },
  { id: "s02_left_cut", east: 45, north: 24, height: 14, radius: 9 },
  { id: "s03_right_cut", east: 88, north: -26, height: 11, radius: 8 },
  { id: "s04_left_rise", east: 130, north: 31, height: 16, radius: 9 },
  { id: "s05_right_drop", east: 175, north: -34, height: 13, radius: 8 },
  { id: "s06_left_ridge", east: 220, north: 36, height: 20, radius: 8 },
  { id: "s07_right_ridge", east: 265, north: -28, height: 15, radius: 8 },
  { id: "s08_left_high", east: 310, north: 26, height: 22, radius: 8 },
  { id: "s09_right_high", east: 352, north: -20, height: 17, radius: 8 },
  { id: "s10_left_sweep", east: 395, north: 14, height: 18, radius: 9 },
  { id: "s11_right_finish", east: 435, north: -8, height: 13, radius: 9 },
  { id: "s12_exit", east: 470, north: 0, height: 11, radius: 10 },
];

const slalomWaypoints = SLALOM_ROUTE.map((routePoint) =>
  waypointAt(
    routePoint.id,
    FRAME,
    routePoint.east,
    routePoint.north,
    routePoint.height,
    routePoint.radius
  )
);

const slalomGatePylons = SLALOM_ROUTE.flatMap((routePoint, index) => {
  const lateral = index % 2 === 0 ? 18 : -18;
  return [
    cylinderAt(
      FRAME,
      routePoint.east,
      routePoint.north + lateral,
      11,
      22,
      2.9
    ),
    cylinderAt(
      FRAME,
      routePoint.east + 8,
      routePoint.north - lateral * 0.55,
      9,
      18,
      2.4
    ),
  ];
});

const terrainMounds = createTerrainMounds(FRAME, [
  { eastMeters: -10, northMeters: 20, peakHeight: 10, footprintRadius: 24 },
  { eastMeters: 60, northMeters: -32, peakHeight: 12, footprintRadius: 28 },
  { eastMeters: 115, northMeters: 38, peakHeight: 14, footprintRadius: 30 },
  { eastMeters: 175, northMeters: -44, peakHeight: 16, footprintRadius: 32 },
  { eastMeters: 235, northMeters: 45, peakHeight: 15, footprintRadius: 30 },
  { eastMeters: 290, northMeters: -38, peakHeight: 18, footprintRadius: 34 },
  { eastMeters: 345, northMeters: 34, peakHeight: 14, footprintRadius: 26 },
  { eastMeters: 405, northMeters: -28, peakHeight: 12, footprintRadius: 24 },
  { eastMeters: 455, northMeters: 22, peakHeight: 10, footprintRadius: 22 },
]);

export const slalomPlayground: Playground = {
  id: "slalom",
  name: "Technical Slalom",
  description: "Dense pylon weaving with rolling terrain mounds and altitude changes.",
  spawn: spawnAt(FRAME, -45, -6, 16),
  terrain: "procedural-hills",
  waypointMode: "ordered",
  obstacles: [
    ...terrainMounds,
    ...slalomGatePylons,
    boxAt(FRAME, 158, 4, 16, 24, 8, 8, 20),
    boxAt(FRAME, 250, -2, 18, 28, 8, 8, -25),
    boxAt(FRAME, 336, 0, 17, 30, 8, 8, 10),
  ],
  waypoints: slalomWaypoints,
  timeLimit: 170,
};
