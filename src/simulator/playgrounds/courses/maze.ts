import type { Obstacle, Playground } from "../types";
import {
  boxAt,
  createCourseFrame,
  createTerrainMounds,
  ringAt,
  spawnAt,
  waypointAt,
} from "./course-utils";

const FRAME = createCourseFrame(-122.3972, 37.8034);
const CORRIDOR_HALF_WIDTH = 76;

const MAZE_ROUTE = [
  { id: "m01_entry", east: 0, north: 0, height: 12, radius: 10 },
  { id: "m02_north_cut", east: 54, north: 54, height: 15, radius: 9 },
  { id: "m03_east_hold", east: 116, north: 50, height: 17, radius: 8 },
  { id: "m04_drop_lane", east: 166, north: -46, height: 13, radius: 8 },
  { id: "m05_low_channel", east: 220, north: -48, height: 10, radius: 8 },
  { id: "m06_climb_lane", east: 258, north: 28, height: 22, radius: 8 },
  { id: "m07_upper_switch", east: 304, north: 58, height: 25, radius: 8 },
  { id: "m08_descend_gate", east: 346, north: -20, height: 16, radius: 8 },
  { id: "m09_final_dive", east: 392, north: -48, height: 12, radius: 9 },
  { id: "m10_exit", east: 440, north: 0, height: 11, radius: 10 },
];

const mazeWaypoints = MAZE_ROUTE.map((point) =>
  waypointAt(point.id, FRAME, point.east, point.north, point.height, point.radius)
);

const splitWalls = [
  ...createSplitWall(58, 0, 24),
  ...createSplitWall(122, 40, 24),
  ...createSplitWall(184, -34, 22),
  ...createSplitWall(246, 18, 22),
  ...createSplitWall(308, 52, 24),
  ...createSplitWall(370, -26, 24),
];

const boundaryWalls: Obstacle[] = [
  boxAt(FRAME, 210, CORRIDOR_HALF_WIDTH, 15, 500, 8, 30, 0),
  boxAt(FRAME, 210, -CORRIDOR_HALF_WIDTH, 15, 500, 8, 30, 0),
  boxAt(FRAME, -42, 0, 15, 152, 8, 30, 90),
  boxAt(FRAME, 486, 0, 15, 152, 8, 30, 90),
];

const terrainMounds = createTerrainMounds(FRAME, [
  { eastMeters: 28, northMeters: -30, peakHeight: 10, footprintRadius: 18 },
  { eastMeters: 98, northMeters: 28, peakHeight: 12, footprintRadius: 20 },
  { eastMeters: 170, northMeters: -34, peakHeight: 16, footprintRadius: 24 },
  { eastMeters: 252, northMeters: 36, peakHeight: 18, footprintRadius: 26 },
  { eastMeters: 332, northMeters: -40, peakHeight: 14, footprintRadius: 22 },
  { eastMeters: 412, northMeters: 30, peakHeight: 11, footprintRadius: 20 },
]);

export const mazePlayground: Playground = {
  id: "maze",
  name: "Multilevel Maze",
  description: "Alternating split-wall maze with low tunnels, climbs, and terrain pockets.",
  spawn: spawnAt(FRAME, -32, 0, 16),
  terrain: "procedural-hills",
  waypointMode: "ordered",
  obstacles: [
    ...boundaryWalls,
    ...splitWalls,
    ...terrainMounds,
    ringAt(FRAME, 222, -46, 10, 5.5, 8.5, 0),
    ringAt(FRAME, 304, 56, 25, 6, 9, 0),
    boxAt(FRAME, 208, -8, 17, 30, 10, 8, 0),
    boxAt(FRAME, 288, 32, 27, 28, 10, 8, 0),
    boxAt(FRAME, 344, -30, 20, 26, 10, 8, 0),
  ],
  waypoints: mazeWaypoints,
  timeLimit: 190,
};

function createSplitWall(
  eastMeters: number,
  gapCenterNorthMeters: number,
  gapSizeMeters: number
): Obstacle[] {
  const lowerMax = gapCenterNorthMeters - gapSizeMeters * 0.5;
  const upperMin = gapCenterNorthMeters + gapSizeMeters * 0.5;

  const lowerLength = Math.max(14, lowerMax + CORRIDOR_HALF_WIDTH);
  const upperLength = Math.max(14, CORRIDOR_HALF_WIDTH - upperMin);

  const lowerCenter = -CORRIDOR_HALF_WIDTH + lowerLength * 0.5;
  const upperCenter = upperMin + upperLength * 0.5;

  return [
    boxAt(FRAME, eastMeters, lowerCenter, 14, lowerLength, 8, 28, 90),
    boxAt(FRAME, eastMeters, upperCenter, 14, upperLength, 8, 28, 90),
  ];
}
