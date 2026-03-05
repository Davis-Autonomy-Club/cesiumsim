import type { Playground } from "../types";
import {
  boxAt,
  createCourseFrame,
  createTerrainMounds,
  cylinderAt,
  ringAt,
  spawnAt,
  waypointAt,
} from "./course-utils";

const FRAME = createCourseFrame(-122.4062, 37.7976);

const RING_ROUTE = [
  { id: "r01_launch", east: 0, north: 0, height: 8, radius: 8, heading: 0 },
  { id: "r02_climb", east: 46, north: 18, height: 12, radius: 8, heading: 24 },
  { id: "r03_crosswind", east: 92, north: -22, height: 16, radius: 7, heading: -28 },
  { id: "r04_ascent", east: 138, north: 24, height: 20, radius: 7, heading: 33 },
  { id: "r05_apex", east: 184, north: -19, height: 25, radius: 7, heading: -36 },
  { id: "r06_spine", east: 230, north: 16, height: 29, radius: 7, heading: 40 },
  { id: "r07_descend", east: 276, north: -14, height: 24, radius: 7, heading: -32 },
  { id: "r08_snap", east: 322, north: 11, height: 19, radius: 7, heading: 19 },
  { id: "r09_glide", east: 368, north: -7, height: 14, radius: 8, heading: -12 },
  { id: "r10_finish", east: 414, north: 0, height: 11, radius: 9, heading: 0 },
];

const ringWaypoints = RING_ROUTE.map((point) =>
  waypointAt(point.id, FRAME, point.east, point.north, point.height, point.radius)
);

const ringObstacles = RING_ROUTE.map((point) =>
  ringAt(FRAME, point.east, point.north, point.height, 6, 9.5, point.heading)
);

const pressurePillars = RING_ROUTE.flatMap((point, index) => {
  const northOffset = index % 2 === 0 ? 14 : -14;
  return [
    cylinderAt(
      FRAME,
      point.east - 5,
      point.north + northOffset,
      Math.max(8, point.height - 2),
      Math.max(16, point.height + 6),
      2.5
    ),
    cylinderAt(
      FRAME,
      point.east + 8,
      point.north - northOffset * 0.8,
      Math.max(7, point.height - 3),
      Math.max(14, point.height + 2),
      2.2
    ),
  ];
});

const terrainMounds = createTerrainMounds(FRAME, [
  { eastMeters: -8, northMeters: 20, peakHeight: 8, footprintRadius: 20 },
  { eastMeters: 70, northMeters: -30, peakHeight: 12, footprintRadius: 26 },
  { eastMeters: 150, northMeters: 34, peakHeight: 16, footprintRadius: 30 },
  { eastMeters: 220, northMeters: -32, peakHeight: 18, footprintRadius: 34 },
  { eastMeters: 292, northMeters: 26, peakHeight: 14, footprintRadius: 28 },
  { eastMeters: 354, northMeters: -24, peakHeight: 11, footprintRadius: 24 },
]);

export const ringCoursePlayground: Playground = {
  id: "ring-course",
  name: "Helix Ring Gauntlet",
  description: "Spiral ring chain with side pressure pillars and rolling terrain.",
  spawn: spawnAt(FRAME, -38, -8, 14),
  terrain: "procedural-hills",
  waypointMode: "ordered",
  obstacles: [
    ...terrainMounds,
    ...ringObstacles,
    ...pressurePillars,
    boxAt(FRAME, 178, 2, 27, 24, 8, 6, 12),
    boxAt(FRAME, 304, -1, 21, 22, 8, 6, -16),
  ],
  waypoints: ringWaypoints,
  timeLimit: 155,
};
