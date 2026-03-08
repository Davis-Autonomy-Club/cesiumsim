import type {
  EvaluationCompletionStatus,
  EvaluationEndReason,
  EvaluationPathMetrics,
  UnifiedEvaluationResult,
} from "./types";

export type LegacyCourseBenchmarkReason =
  | "success"
  | "timeout"
  | "manual_stop";

export interface LegacyCourseMetricsLike {
  collisionCount: number;
  waypointsReached: Set<string> | string[];
  startTime: number;
  elapsedTime: number;
  pathDistance: number;
  straightLineDistance: number;
  success: boolean;
  score: number;
}

export interface LegacyCourseBenchmarkResultLike {
  metrics: LegacyCourseMetricsLike;
  completed: boolean;
  reason: LegacyCourseBenchmarkReason;
}

export interface MissionStatusLike {
  state: "idle" | "playing" | "complete" | "failed";
  levelIndex: number;
  levelName: string;
  briefing: string;
  activeObjective: string;
  objectiveIndex: number;
  totalObjectives: number;
  distanceToTarget: number;
  holdProgress: number;
  timeRemaining: number;
  elapsedTime: number;
}

export interface CourseEvaluationAdapterInput {
  result: LegacyCourseBenchmarkResultLike;
  scenarioId: string;
  seed?: number | string | null;
  episodeId?: string;
  runId?: string;
  pilotType?: string;
  totalWaypoints?: number | null;
}

export interface MissionEvaluationAdapterInput {
  status: MissionStatusLike;
  scenarioId?: string;
  seed?: number | string | null;
  episodeId?: string;
  runId?: string;
  pilotType?: string;
  startedAtSeconds?: number | null;
  collisions?: number;
  score?: number | null;
  endReason?: EvaluationEndReason;
  pathMetrics?: Partial<EvaluationPathMetrics>;
}

export interface CourseScenarioSpecificMetrics {
  legacySuccess: boolean;
  waypointIdsReached: string[];
}

export interface MissionScenarioSpecificMetrics {
  levelIndex: number;
  levelName: string;
  briefing: string;
  activeObjective: string;
  holdProgress: number;
  timeRemainingSeconds: number;
}

export function adaptCourseBenchmarkResult(
  input: CourseEvaluationAdapterInput,
): UnifiedEvaluationResult<CourseScenarioSpecificMetrics> {
  const { result } = input;
  const waypointIdsReached = Array.from(result.metrics.waypointsReached);
  const totalWaypoints = input.totalWaypoints ?? waypointIdsReached.length;
  const waypointsReached = waypointIdsReached.length;
  const pathDistanceMeters = result.metrics.pathDistance;
  const straightLineDistanceMeters = result.metrics.straightLineDistance;
  const efficiencyRatio =
    straightLineDistanceMeters > 0
      ? straightLineDistanceMeters / Math.max(pathDistanceMeters, 1)
      : null;
  const completionRatio =
    totalWaypoints > 0 ? waypointsReached / totalWaypoints : result.completed ? 1 : 0;

  return {
    episode: {
      source: "course-benchmark",
      episodeId: input.episodeId,
      runId: input.runId,
      pilotType: input.pilotType,
      startedAtSeconds: result.metrics.startTime,
    },
    scenarioId: input.scenarioId,
    seed: input.seed ?? null,
    completionStatus: getCourseCompletionStatus(result),
    endReason: result.reason,
    collisions: {
      count: result.metrics.collisionCount,
      hadAny: result.metrics.collisionCount > 0,
    },
    elapsedTimeSeconds: result.metrics.elapsedTime,
    pathMetrics: {
      pathDistanceMeters,
      straightLineDistanceMeters,
      efficiencyRatio,
      distanceToTargetMeters: null,
      waypointsReached,
      totalWaypoints,
      completionRatio,
    },
    score: result.metrics.score,
    scenarioSpecificMetrics: {
      legacySuccess: result.metrics.success,
      waypointIdsReached,
    },
  };
}

export function adaptMissionBenchmarkResult(
  input: MissionEvaluationAdapterInput,
): UnifiedEvaluationResult<MissionScenarioSpecificMetrics> {
  const { status } = input;
  const scenarioId =
    input.scenarioId ?? `mission-${slugify(status.levelName)}`;
  const totalObjectives = status.totalObjectives;
  const completionRatio =
    totalObjectives > 0 ? status.objectiveIndex / totalObjectives : null;
  const basePathMetrics: EvaluationPathMetrics = {
    pathDistanceMeters: null,
    straightLineDistanceMeters: null,
    efficiencyRatio: null,
    distanceToTargetMeters:
      status.distanceToTarget >= 0 ? status.distanceToTarget : null,
    waypointsReached: status.objectiveIndex,
    totalWaypoints: totalObjectives,
    completionRatio,
  };

  return {
    episode: {
      source: "mission-benchmark",
      episodeId: input.episodeId,
      runId: input.runId,
      pilotType: input.pilotType,
      startedAtSeconds: input.startedAtSeconds ?? null,
    },
    scenarioId,
    seed: input.seed ?? null,
    completionStatus: getMissionCompletionStatus(status.state),
    endReason: input.endReason ?? getMissionEndReason(status),
    collisions: {
      count: input.collisions ?? 0,
      hadAny: (input.collisions ?? 0) > 0,
    },
    elapsedTimeSeconds: status.elapsedTime,
    pathMetrics: {
      ...basePathMetrics,
      ...input.pathMetrics,
    },
    score: input.score ?? null,
    scenarioSpecificMetrics: {
      levelIndex: status.levelIndex,
      levelName: status.levelName,
      briefing: status.briefing,
      activeObjective: status.activeObjective,
      holdProgress: status.holdProgress,
      timeRemainingSeconds: status.timeRemaining,
    },
  };
}

function getCourseCompletionStatus(
  result: LegacyCourseBenchmarkResultLike,
): EvaluationCompletionStatus {
  if (result.reason === "manual_stop") {
    return "aborted";
  }

  return result.completed ? "completed" : "failed";
}

function getMissionCompletionStatus(
  state: MissionStatusLike["state"],
): EvaluationCompletionStatus {
  switch (state) {
    case "complete":
      return "completed";
    case "failed":
      return "failed";
    case "playing":
      return "in_progress";
    case "idle":
      return "not_started";
  }
}

function getMissionEndReason(
  status: MissionStatusLike,
): EvaluationEndReason {
  switch (status.state) {
    case "complete":
      return "success";
    case "failed":
      return status.timeRemaining <= 0 ? "timeout" : "objective_failed";
    case "playing":
      return "in_progress";
    case "idle":
      return "not_started";
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
