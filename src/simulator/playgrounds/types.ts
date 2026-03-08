export const SUPPORTED_TERRAIN_TYPES = ["flat", "ellipsoid"] as const;

export type TerrainType = (typeof SUPPORTED_TERRAIN_TYPES)[number];

export interface SpawnPoint {
  longitude: number;
  latitude: number;
  height: number;
}

export interface ObstacleBox {
  type: "box";
  position: { lon: number; lat: number; height: number };
  dimensions: { length: number; width: number; height: number };
  heading?: number;
}

export interface ObstacleCylinder {
  type: "cylinder";
  position: { lon: number; lat: number; height: number };
  length: number;
  topRadius: number;
  bottomRadius?: number;
}

export interface ObstacleRing {
  type: "ring";
  position: { lon: number; lat: number; height: number };
  innerRadius: number;
  outerRadius: number;
  heading?: number;
}

export type Obstacle = ObstacleBox | ObstacleCylinder | ObstacleRing;

export interface Waypoint {
  id: string;
  position: { lon: number; lat: number; height: number };
  radius: number;
}

export interface Playground {
  id: string;
  name: string;
  spawn: SpawnPoint;
  terrain: TerrainType;
  obstacles: Obstacle[];
  waypoints?: Waypoint[];
  timeLimit?: number;
}

export function assertSupportedTerrainType(
  terrain: string,
): asserts terrain is TerrainType {
  if (!SUPPORTED_TERRAIN_TYPES.includes(terrain as TerrainType)) {
    throw new Error(
      `Unsupported playground terrain "${terrain}". Supported terrain types: ${SUPPORTED_TERRAIN_TYPES.join(", ")}.`,
    );
  }
}
