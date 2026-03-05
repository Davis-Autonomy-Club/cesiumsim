export type TerrainType = "flat" | "ellipsoid" | "procedural-hills";
export type WaypointMode = "any" | "ordered";

export interface SpawnPoint {
  longitude: number;
  latitude: number;
  height: number;
}

export interface ObstacleBox {
  type: "box";
  collidable?: boolean;
  position: { lon: number; lat: number; height: number };
  dimensions: { length: number; width: number; height: number };
  heading?: number;
}

export interface ObstacleCylinder {
  type: "cylinder";
  collidable?: boolean;
  position: { lon: number; lat: number; height: number };
  length: number;
  topRadius: number;
  bottomRadius?: number;
}

export interface ObstacleRing {
  type: "ring";
  collidable?: boolean;
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
  description?: string;
  spawn: SpawnPoint;
  terrain: TerrainType;
  obstacles: Obstacle[];
  waypoints?: Waypoint[];
  waypointMode?: WaypointMode;
  timeLimit?: number;
}
