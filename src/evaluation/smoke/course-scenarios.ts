import type { Waypoint } from "../../simulator/playgrounds/types";
import {
  COURSE_SCENARIOS,
  type CourseScenario,
  type ScenarioLocation,
} from "../../simulator/scenario-registry";

interface SmokeWaypointOffset {
  id: string;
  eastMeters: number;
  northMeters: number;
  heightOffsetMeters: number;
  radiusMeters: number;
}

interface SmokeRouteConfig {
  routeId: string;
  timeLimitSeconds: number;
  offsets: SmokeWaypointOffset[];
}

export interface SmokeBenchmarkThresholds {
  requireCompletion: boolean;
  allowTimeout: boolean;
  maxCollisions: number;
  maxElapsedTimeSeconds: number;
}

export interface SmokeBenchmarkScenario {
  routeId: string;
  scenario: CourseScenario;
  waypoints: Waypoint[];
  thresholds: SmokeBenchmarkThresholds;
}

const METERS_PER_LATITUDE_DEGREE = 110_540;

const ROUTE_CONFIGS: Record<string, SmokeRouteConfig> = {
  "course-downtown-san-francisco": {
    routeId: "downtown-zigzag",
    timeLimitSeconds: 42,
    offsets: [
      { id: "wp-1", eastMeters: 0, northMeters: 55, heightOffsetMeters: 25, radiusMeters: 18 },
      { id: "wp-2", eastMeters: 28, northMeters: 115, heightOffsetMeters: 32, radiusMeters: 18 },
      { id: "wp-3", eastMeters: -12, northMeters: 175, heightOffsetMeters: 28, radiusMeters: 18 },
      { id: "wp-4", eastMeters: 8, northMeters: 228, heightOffsetMeters: 24, radiusMeters: 20 },
    ],
  },
  "course-uc-davis": {
    routeId: "campus-arc",
    timeLimitSeconds: 44,
    offsets: [
      { id: "wp-1", eastMeters: 0, northMeters: 65, heightOffsetMeters: 22, radiusMeters: 18 },
      { id: "wp-2", eastMeters: 35, northMeters: 135, heightOffsetMeters: 26, radiusMeters: 18 },
      { id: "wp-3", eastMeters: 18, northMeters: 210, heightOffsetMeters: 22, radiusMeters: 20 },
    ],
  },
  "course-beu-fire-perimeter": {
    routeId: "perimeter-sweep",
    timeLimitSeconds: 48,
    offsets: [
      { id: "wp-1", eastMeters: 0, northMeters: 80, heightOffsetMeters: 28, radiusMeters: 18 },
      { id: "wp-2", eastMeters: 44, northMeters: 160, heightOffsetMeters: 34, radiusMeters: 18 },
      { id: "wp-3", eastMeters: -16, northMeters: 248, heightOffsetMeters: 30, radiusMeters: 20 },
    ],
  },
  "course-airline-fire": {
    routeId: "incident-zigzag",
    timeLimitSeconds: 44,
    offsets: [
      { id: "wp-1", eastMeters: 0, northMeters: 58, heightOffsetMeters: 24, radiusMeters: 18 },
      { id: "wp-2", eastMeters: -30, northMeters: 126, heightOffsetMeters: 30, radiusMeters: 18 },
      { id: "wp-3", eastMeters: 18, northMeters: 194, heightOffsetMeters: 24, radiusMeters: 20 },
    ],
  },
};

export const SMOKE_BENCHMARK_SCENARIOS: SmokeBenchmarkScenario[] =
  COURSE_SCENARIOS.map((scenario) => {
    const routeConfig = ROUTE_CONFIGS[scenario.id];
    if (!routeConfig) {
      throw new Error(`Missing smoke benchmark route config for ${scenario.id}.`);
    }

    return {
      routeId: routeConfig.routeId,
      scenario,
      waypoints: routeConfig.offsets.map((offset) =>
        createWaypoint(scenario.location, offset),
      ),
      thresholds: {
        requireCompletion: true,
        allowTimeout: false,
        maxCollisions: 0,
        maxElapsedTimeSeconds: routeConfig.timeLimitSeconds,
      },
    };
  });

function createWaypoint(
  origin: ScenarioLocation,
  offset: SmokeWaypointOffset,
): Waypoint {
  const metersPerLongitudeDegree =
    111_320 * Math.cos((origin.latitude * Math.PI) / 180);

  return {
    id: offset.id,
    position: {
      lon: origin.longitude + offset.eastMeters / metersPerLongitudeDegree,
      lat: origin.latitude + offset.northMeters / METERS_PER_LATITUDE_DEGREE,
      height: origin.height + offset.heightOffsetMeters,
    },
    radius: offset.radiusMeters,
  };
}
