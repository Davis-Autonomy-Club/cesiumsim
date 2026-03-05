import type { Obstacle, SpawnPoint, Waypoint } from "../types";

const METERS_PER_DEG_LAT = 110540;

export type CourseFrame = {
  point: (eastMeters: number, northMeters: number, heightMeters: number) => {
    lon: number;
    lat: number;
    height: number;
  };
};

export type TerrainMoundSpec = {
  eastMeters: number;
  northMeters: number;
  peakHeight: number;
  footprintRadius: number;
  shoulderRadius?: number;
};

export function createCourseFrame(baseLon: number, baseLat: number): CourseFrame {
  const metersPerDegLon = 111320 * Math.cos((baseLat * Math.PI) / 180);
  return {
    point(eastMeters: number, northMeters: number, heightMeters: number) {
      return {
        lon: baseLon + eastMeters / metersPerDegLon,
        lat: baseLat + northMeters / METERS_PER_DEG_LAT,
        height: heightMeters,
      };
    },
  };
}

export function waypointAt(
  id: string,
  frame: CourseFrame,
  eastMeters: number,
  northMeters: number,
  heightMeters: number,
  radius: number
): Waypoint {
  return {
    id,
    position: frame.point(eastMeters, northMeters, heightMeters),
    radius,
  };
}

export function spawnAt(
  frame: CourseFrame,
  eastMeters: number,
  northMeters: number,
  heightMeters: number
): SpawnPoint {
  const position = frame.point(eastMeters, northMeters, heightMeters);
  return {
    longitude: position.lon,
    latitude: position.lat,
    height: position.height,
  };
}

export function cylinderAt(
  frame: CourseFrame,
  eastMeters: number,
  northMeters: number,
  centerHeight: number,
  length: number,
  topRadius: number,
  bottomRadius?: number
): Obstacle {
  return {
    type: "cylinder",
    position: frame.point(eastMeters, northMeters, centerHeight),
    length,
    topRadius,
    bottomRadius,
  };
}

export function boxAt(
  frame: CourseFrame,
  eastMeters: number,
  northMeters: number,
  centerHeight: number,
  length: number,
  width: number,
  height: number,
  heading = 0
): Obstacle {
  return {
    type: "box",
    position: frame.point(eastMeters, northMeters, centerHeight),
    dimensions: { length, width, height },
    heading,
  };
}

export function ringAt(
  frame: CourseFrame,
  eastMeters: number,
  northMeters: number,
  centerHeight: number,
  innerRadius: number,
  outerRadius: number,
  heading = 0
): Obstacle {
  return {
    type: "ring",
    position: frame.point(eastMeters, northMeters, centerHeight),
    innerRadius,
    outerRadius,
    heading,
  };
}

export function createTerrainMounds(frame: CourseFrame, specs: TerrainMoundSpec[]): Obstacle[] {
  return specs.map((spec) => {
    const length = Math.max(2, spec.peakHeight);
    const topRadius = spec.shoulderRadius ?? Math.max(3, spec.footprintRadius * 0.48);
    return cylinderAt(
      frame,
      spec.eastMeters,
      spec.northMeters,
      length * 0.5,
      length,
      topRadius,
      spec.footprintRadius
    );
  });
}
