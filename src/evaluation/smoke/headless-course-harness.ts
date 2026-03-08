import {
  createCourseEvaluationLifecycle,
  type CourseScenarioSpecificMetrics,
  type LegacyCourseMetricsLike,
} from "../adapters";
import type { UnifiedEvaluationResult } from "../types";
import { createAutopilot } from "../../simulator/autopilot";
import type { Waypoint } from "../../simulator/playgrounds/types";
import type { ScenarioLocation } from "../../simulator/scenario-registry";
import type {
  SmokeBenchmarkScenario,
  SmokeBenchmarkThresholds,
} from "./course-scenarios";

const METERS_PER_LATITUDE_DEGREE = 110_540;
const FIXED_STEP_SECONDS = 0.1;
const FORWARD_SPEED_METERS_PER_SECOND = 18;
const STRAFE_SPEED_METERS_PER_SECOND = 9;
const VERTICAL_SPEED_METERS_PER_SECOND = 6;
const YAW_RATE_RADIANS_PER_SECOND = 2.4;
const INITIAL_HEADING_RADIANS = 0;

type LocalPoint = {
  x: number;
  y: number;
  z: number;
};

type FlightState = {
  position: LocalPoint;
  heading: number;
  elapsedTimeSeconds: number;
  pathDistanceMeters: number;
  collisionCount: number;
  waypointIdsReached: string[];
  groundContact: boolean;
};

export interface SmokeBenchmarkCheckResult {
  name: "completion" | "timeout" | "collisions";
  passed: boolean;
  expected: boolean | number;
  actual: boolean | number;
}

export interface SmokeBenchmarkCaseResult {
  routeId: string;
  scenarioId: string;
  scenarioName: string;
  thresholds: SmokeBenchmarkThresholds;
  checks: SmokeBenchmarkCheckResult[];
  pass: boolean;
  stepsExecuted: number;
  evaluation: UnifiedEvaluationResult<CourseScenarioSpecificMetrics>;
}

export interface SmokeBenchmarkSuiteResult {
  suiteId: "autopilot-course-smoke";
  deterministic: true;
  pilotType: "autopilot";
  stepSeconds: number;
  seed: 0;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  results: SmokeBenchmarkCaseResult[];
}

export function runSmokeBenchmarkSuite(
  scenarios: SmokeBenchmarkScenario[],
): SmokeBenchmarkSuiteResult {
  const results = scenarios.map(runSmokeBenchmarkCase);
  const passed = results.filter((result) => result.pass).length;

  return {
    suiteId: "autopilot-course-smoke",
    deterministic: true,
    pilotType: "autopilot",
    stepSeconds: FIXED_STEP_SECONDS,
    seed: 0,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
    },
    results,
  };
}

export function runSmokeBenchmarkCase(
  benchmarkScenario: SmokeBenchmarkScenario,
): SmokeBenchmarkCaseResult {
  const { routeId, scenario, thresholds, waypoints } = benchmarkScenario;
  const autopilot = createAutopilot({ waypoints });
  const state = createInitialState(scenario.location);

  const lifecycle = createCourseEvaluationLifecycle(
    {
      getElapsedTime: () => state.elapsedTimeSeconds,
      getMetrics: () => buildLegacyMetrics(scenario.location, waypoints, thresholds, state),
      isComplete: () => state.waypointIdsReached.length === waypoints.length,
    },
    {
      scenarioId: scenario.id,
      maxDurationSeconds: thresholds.maxElapsedTimeSeconds,
      totalWaypoints: waypoints.length,
      pilotType: "autopilot",
      episodeId: `smoke-${scenario.id}`,
      runId: "autopilot-course-smoke",
      seed: 0,
    },
  );

  lifecycle.controller.start();
  markReachedWaypoints(scenario.location, waypoints, state);

  let stepsExecuted = 0;
  let evaluation:
    | UnifiedEvaluationResult<CourseScenarioSpecificMetrics>
    | undefined;

  while (lifecycle.controller.isRunning()) {
    const position = toGlobalPoint(scenario.location, state.position);
    const input = autopilot.computeInput(
      position.lon,
      position.lat,
      position.height,
      state.heading,
    );

    advanceFlightState(state, scenario.location, input, FIXED_STEP_SECONDS);
    markReachedWaypoints(scenario.location, waypoints, state);
    stepsExecuted += 1;

    const tickResult = lifecycle.tick();
    if (tickResult.done) {
      evaluation = tickResult.result;
      break;
    }
  }

  const finalEvaluation = roundEvaluationResult(
    evaluation ?? lifecycle.controller.finalize(),
  );
  const checks = evaluateThresholds(finalEvaluation, thresholds);

  return {
    routeId,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    thresholds,
    checks,
    pass: checks.every((check) => check.passed),
    stepsExecuted,
    evaluation: finalEvaluation,
  };
}

function createInitialState(origin: ScenarioLocation): FlightState {
  return {
    position: {
      x: 0,
      y: 0,
      z: origin.height,
    },
    heading: INITIAL_HEADING_RADIANS,
    elapsedTimeSeconds: 0,
    pathDistanceMeters: 0,
    collisionCount: 0,
    waypointIdsReached: [],
    groundContact: false,
  };
}

function advanceFlightState(
  state: FlightState,
  origin: ScenarioLocation,
  input: { forward: number; strafe: number; vertical: number; yaw: number },
  dtSeconds: number,
): void {
  const previousPosition = clonePosition(state.position);
  state.heading = normalizeHeading(
    state.heading + input.yaw * YAW_RATE_RADIANS_PER_SECOND * dtSeconds,
  );

  const eastVelocity =
    input.forward *
      FORWARD_SPEED_METERS_PER_SECOND *
      Math.sin(state.heading) +
    input.strafe *
      STRAFE_SPEED_METERS_PER_SECOND *
      Math.cos(state.heading);
  const northVelocity =
    input.forward *
      FORWARD_SPEED_METERS_PER_SECOND *
      Math.cos(state.heading) -
    input.strafe *
      STRAFE_SPEED_METERS_PER_SECOND *
      Math.sin(state.heading);
  const verticalVelocity = input.vertical * VERTICAL_SPEED_METERS_PER_SECOND;

  state.position.x += eastVelocity * dtSeconds;
  state.position.y += northVelocity * dtSeconds;

  const baseHeight = origin.height;
  const nextHeight = state.position.z + verticalVelocity * dtSeconds;
  const hitGround = nextHeight <= baseHeight && verticalVelocity < 0;
  state.position.z = Math.max(baseHeight, nextHeight);
  if (hitGround && !state.groundContact) {
    state.collisionCount += 1;
  }
  state.groundContact = hitGround;

  state.elapsedTimeSeconds = roundNumber(state.elapsedTimeSeconds + dtSeconds);
  state.pathDistanceMeters = roundNumber(
    state.pathDistanceMeters + distanceBetween(previousPosition, state.position),
  );
}

function markReachedWaypoints(
  origin: ScenarioLocation,
  waypoints: readonly Waypoint[],
  state: FlightState,
): void {
  for (const waypoint of waypoints) {
    if (state.waypointIdsReached.includes(waypoint.id)) {
      continue;
    }

    const waypointLocal = toLocalPoint(origin, waypoint.position);
    if (distanceBetween(state.position, waypointLocal) <= waypoint.radius) {
      state.waypointIdsReached.push(waypoint.id);
    }
  }
}

function buildLegacyMetrics(
  origin: ScenarioLocation,
  waypoints: readonly Waypoint[],
  thresholds: SmokeBenchmarkThresholds,
  state: FlightState,
): LegacyCourseMetricsLike {
  const completed = state.waypointIdsReached.length === waypoints.length;
  const withinTimeLimit =
    state.elapsedTimeSeconds <= thresholds.maxElapsedTimeSeconds;
  const noCollisions = state.collisionCount === 0;
  const straightLineDistance = distanceBetween(
    { x: 0, y: 0, z: origin.height },
    state.position,
  );
  const pathEfficiency =
    straightLineDistance > 0
      ? straightLineDistance / Math.max(state.pathDistanceMeters, 1)
      : 1;
  const waypointScore =
    waypoints.length > 0 ? state.waypointIdsReached.length / waypoints.length : 1;
  const collisionPenalty = Math.max(0, 1 - state.collisionCount * 0.2);
  const timeBonus = withinTimeLimit ? 1 : 0.5;
  const score =
    (waypointScore * 0.5 + pathEfficiency * 0.2 + collisionPenalty * 0.3) *
    timeBonus;

  return {
    collisionCount: state.collisionCount,
    waypointsReached: new Set(state.waypointIdsReached),
    startTime: 0,
    elapsedTime: state.elapsedTimeSeconds,
    pathDistance: state.pathDistanceMeters,
    straightLineDistance: roundNumber(straightLineDistance),
    success: completed && withinTimeLimit && noCollisions,
    score: roundNumber(score),
  };
}

function evaluateThresholds(
  evaluation: UnifiedEvaluationResult<CourseScenarioSpecificMetrics>,
  thresholds: SmokeBenchmarkThresholds,
): SmokeBenchmarkCheckResult[] {
  return [
    {
      name: "completion",
      passed:
        !thresholds.requireCompletion ||
        evaluation.completionStatus === "completed",
      expected: thresholds.requireCompletion,
      actual: evaluation.completionStatus === "completed",
    },
    {
      name: "timeout",
      passed:
        thresholds.allowTimeout || evaluation.endReason !== "timeout",
      expected: !thresholds.allowTimeout,
      actual: evaluation.endReason === "timeout",
    },
    {
      name: "collisions",
      passed: evaluation.collisions.count <= thresholds.maxCollisions,
      expected: thresholds.maxCollisions,
      actual: evaluation.collisions.count,
    },
  ];
}

function roundEvaluationResult(
  result: UnifiedEvaluationResult<CourseScenarioSpecificMetrics> | undefined,
): UnifiedEvaluationResult<CourseScenarioSpecificMetrics> {
  if (!result) {
    throw new Error("Smoke benchmark did not produce a final evaluation result.");
  }

  return {
    ...result,
    seed: result.seed ?? 0,
    episode: {
      ...result.episode,
      startedAtSeconds:
        result.episode.startedAtSeconds === undefined ||
        result.episode.startedAtSeconds === null
          ? 0
          : roundNumber(result.episode.startedAtSeconds),
    },
    elapsedTimeSeconds: roundNumber(result.elapsedTimeSeconds),
    pathMetrics: {
      pathDistanceMeters: roundNullableNumber(result.pathMetrics.pathDistanceMeters),
      straightLineDistanceMeters: roundNullableNumber(
        result.pathMetrics.straightLineDistanceMeters,
      ),
      efficiencyRatio: roundNullableNumber(result.pathMetrics.efficiencyRatio),
      distanceToTargetMeters: roundNullableNumber(
        result.pathMetrics.distanceToTargetMeters,
      ),
      waypointsReached: result.pathMetrics.waypointsReached,
      totalWaypoints: result.pathMetrics.totalWaypoints,
      completionRatio: roundNullableNumber(result.pathMetrics.completionRatio),
    },
    score: roundNullableNumber(result.score),
    scenarioSpecificMetrics: result.scenarioSpecificMetrics
      ? {
          ...result.scenarioSpecificMetrics,
          waypointIdsReached: [...result.scenarioSpecificMetrics.waypointIdsReached],
        }
      : undefined,
  };
}

function toLocalPoint(
  origin: ScenarioLocation,
  point: { lon: number; lat: number; height: number },
): LocalPoint {
  const metersPerLongitudeDegree = getMetersPerLongitudeDegree(origin.latitude);
  return {
    x: (point.lon - origin.longitude) * metersPerLongitudeDegree,
    y: (point.lat - origin.latitude) * METERS_PER_LATITUDE_DEGREE,
    z: point.height,
  };
}

function toGlobalPoint(origin: ScenarioLocation, point: LocalPoint) {
  const metersPerLongitudeDegree = getMetersPerLongitudeDegree(origin.latitude);
  return {
    lon: origin.longitude + point.x / metersPerLongitudeDegree,
    lat: origin.latitude + point.y / METERS_PER_LATITUDE_DEGREE,
    height: point.z,
  };
}

function getMetersPerLongitudeDegree(latitude: number): number {
  return 111_320 * Math.cos((latitude * Math.PI) / 180);
}

function clonePosition(position: LocalPoint): LocalPoint {
  return {
    x: position.x,
    y: position.y,
    z: position.z,
  };
}

function distanceBetween(a: LocalPoint, b: LocalPoint): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2),
  );
}

function normalizeHeading(heading: number): number {
  let nextHeading = heading;
  while (nextHeading > Math.PI) {
    nextHeading -= Math.PI * 2;
  }
  while (nextHeading < -Math.PI) {
    nextHeading += Math.PI * 2;
  }
  return nextHeading;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(3));
}

function roundNullableNumber(value: number | null): number | null {
  return value === null ? null : roundNumber(value);
}
