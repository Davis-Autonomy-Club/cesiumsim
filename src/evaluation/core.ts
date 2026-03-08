import type {
  EvaluationCompletionStatus,
  EvaluationEndReason,
  UnifiedEvaluationResult,
} from "./types";

type EvaluationLifecycleResult = UnifiedEvaluationResult<object>;

export interface EvaluationLifecycleTickResult<
  Result extends EvaluationLifecycleResult = EvaluationLifecycleResult,
> {
  done: boolean;
  result?: Result;
}

export interface EvaluationLifecycleBuildContext<Snapshot> {
  snapshot: Snapshot;
  completionStatus: EvaluationCompletionStatus;
  endReason: EvaluationEndReason;
  collisionCount: number;
}

export interface EvaluationLifecycleOptions<
  Snapshot,
  Result extends EvaluationLifecycleResult,
> {
  maxDurationSeconds?: number | null;
  getElapsedTimeSeconds: (snapshot: Snapshot) => number;
  getCompletionStatus: (snapshot: Snapshot) => EvaluationCompletionStatus;
  buildResult: (context: EvaluationLifecycleBuildContext<Snapshot>) => Result;
  getCollisionCount?: (snapshot: Snapshot) => number | null | undefined;
  getEndReason?: (
    snapshot: Snapshot,
    completionStatus: EvaluationCompletionStatus,
  ) => EvaluationEndReason;
}

export interface EvaluationLifecycleController<
  Snapshot,
  Result extends EvaluationLifecycleResult = EvaluationLifecycleResult,
> {
  start(): void;
  tick(snapshot: Snapshot): EvaluationLifecycleTickResult<Result>;
  stop(): void;
  finalize(snapshot?: Snapshot): Result | undefined;
  isRunning(): boolean;
  getResult(): Result | undefined;
  recordCollision(count?: number): void;
}

export function createEvaluationLifecycle<
  Snapshot,
  Result extends EvaluationLifecycleResult,
>(
  options: EvaluationLifecycleOptions<Snapshot, Result>,
): EvaluationLifecycleController<Snapshot, Result> {
  let running = false;
  let stopRequested = false;
  let lastSnapshot: Snapshot | undefined;
  let finalResult: Result | undefined;
  let collisionCount = 0;

  function start(): void {
    running = true;
    stopRequested = false;
    lastSnapshot = undefined;
    finalResult = undefined;
    collisionCount = 0;
  }

  function tick(snapshot: Snapshot): EvaluationLifecycleTickResult<Result> {
    lastSnapshot = snapshot;
    collisionCount = Math.max(
      collisionCount,
      options.getCollisionCount?.(snapshot) ?? 0,
    );

    if (!running) {
      return { done: true, result: finalResult };
    }

    if (stopRequested) {
      return complete(snapshot, "aborted", "manual_stop");
    }

    const elapsedTimeSeconds = options.getElapsedTimeSeconds(snapshot);
    if (
      options.maxDurationSeconds !== undefined &&
      options.maxDurationSeconds !== null &&
      elapsedTimeSeconds >= options.maxDurationSeconds
    ) {
      return complete(snapshot, "failed", "timeout");
    }

    const completionStatus = options.getCompletionStatus(snapshot);
    if (isTerminalStatus(completionStatus)) {
      return complete(
        snapshot,
        completionStatus,
        options.getEndReason?.(snapshot, completionStatus) ??
          defaultEndReasonFor(completionStatus),
      );
    }

    return { done: false };
  }

  function stop(): void {
    stopRequested = true;
  }

  function finalize(snapshot?: Snapshot): Result | undefined {
    const targetSnapshot = snapshot ?? lastSnapshot;
    if (!targetSnapshot) {
      return finalResult;
    }

    if (finalResult) {
      return finalResult;
    }

    const completionStatus = stopRequested ? "aborted" : options.getCompletionStatus(targetSnapshot);
    const endReason = stopRequested
      ? "manual_stop"
      : options.getEndReason?.(targetSnapshot, completionStatus) ??
        defaultEndReasonFor(completionStatus);

    return complete(targetSnapshot, completionStatus, endReason).result;
  }

  function isRunning(): boolean {
    return running;
  }

  function getResult(): Result | undefined {
    return finalResult;
  }

  function recordCollision(count = 1): void {
    collisionCount += count;
  }

  function complete(
    snapshot: Snapshot,
    completionStatus: EvaluationCompletionStatus,
    endReason: EvaluationEndReason,
  ): EvaluationLifecycleTickResult<Result> {
    running = false;
    finalResult = options.buildResult({
      snapshot,
      completionStatus,
      endReason,
      collisionCount,
    });
    return {
      done: true,
      result: finalResult,
    };
  }

  return {
    start,
    tick,
    stop,
    finalize,
    isRunning,
    getResult,
    recordCollision,
  };
}

function isTerminalStatus(
  completionStatus: EvaluationCompletionStatus,
): completionStatus is "completed" | "failed" | "aborted" {
  return (
    completionStatus === "completed" ||
    completionStatus === "failed" ||
    completionStatus === "aborted"
  );
}

function defaultEndReasonFor(
  completionStatus: EvaluationCompletionStatus,
): EvaluationEndReason {
  switch (completionStatus) {
    case "completed":
      return "success";
    case "failed":
      return "unknown";
    case "aborted":
      return "manual_stop";
    case "in_progress":
      return "in_progress";
    case "not_started":
      return "not_started";
  }
}
