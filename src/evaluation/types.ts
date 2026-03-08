export type EvaluationSource = "course-benchmark" | "mission-benchmark";

export type EvaluationCompletionStatus =
  | "completed"
  | "failed"
  | "aborted"
  | "in_progress"
  | "not_started";

export type EvaluationEndReason =
  | "success"
  | "timeout"
  | "manual_stop"
  | "objective_failed"
  | "collision"
  | "in_progress"
  | "not_started"
  | "unknown";

export interface EvaluationEpisodeMetadata {
  source: EvaluationSource;
  episodeId?: string;
  runId?: string;
  pilotType?: string;
  startedAtSeconds?: number | null;
}

export interface EvaluationCollisionSummary {
  count: number;
  hadAny: boolean;
}

export interface EvaluationPathMetrics {
  pathDistanceMeters: number | null;
  straightLineDistanceMeters: number | null;
  efficiencyRatio: number | null;
  distanceToTargetMeters: number | null;
  waypointsReached: number | null;
  totalWaypoints: number | null;
  completionRatio: number | null;
}

export interface UnifiedEvaluationResult<
  ScenarioSpecificMetrics extends object = Record<string, unknown>,
> {
  episode: EvaluationEpisodeMetadata;
  scenarioId: string;
  seed: number | string | null;
  completionStatus: EvaluationCompletionStatus;
  endReason: EvaluationEndReason;
  collisions: EvaluationCollisionSummary;
  elapsedTimeSeconds: number;
  pathMetrics: EvaluationPathMetrics;
  score: number | null;
  scenarioSpecificMetrics?: ScenarioSpecificMetrics;
}
