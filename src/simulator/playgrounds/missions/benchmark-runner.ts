import type { MissionPlayground } from "./types";
import type { MissionMetricsResult } from "./flight-metrics";
import { MissionFlightMetrics } from "./flight-metrics";

export type MissionBenchmarkResult = {
  metrics: MissionMetricsResult;
  completed: boolean;
  reason: "success" | "timeout" | "manual_stop";
};

export type MissionBenchmarkCallbacks = {
  getDronePosition: () => { lon: number; lat: number; altAgl: number; altMsl: number; heading: number };
  toCartesian: (lon: number, lat: number, h: number) => { x: number; y: number; z: number };
  recordCollision: () => void;    // called when the existing collision system fires
};

export function createMissionBenchmarkRunner(
  mission: MissionPlayground,
  callbacks: MissionBenchmarkCallbacks
) {
  const metrics = new MissionFlightMetrics(
    mission.id,
    mission.missionTargets,
    mission.zoneThresholds ?? [],
    mission.ascentTarget ?? 5
  );

  let running = false;
  let stopRequested = false;

  return {
    getMetrics() {
      return metrics;
    },

    start() {
      metrics.reset();
      running = true;
      stopRequested = false;
    },

    stop() {
      stopRequested = true;
    },

    isRunning() {
      return running;
    },

    // Called every frame from stepFrame() instead of (or alongside) the general runner
    tick(_dt: number): { done: boolean; result?: MissionBenchmarkResult } {
      if (!running) return { done: false };

      if (stopRequested) {
        running = false;
        return {
          done: true,
          result: {
            metrics: metrics.getResult(),
            completed: false,
            reason: "manual_stop",
          },
        };
      }

      const pos = callbacks.getDronePosition();
      const elapsed = metrics.getResult().timeToCompletionS;

      // Timeout check
      if (mission.timeLimit && elapsed >= mission.timeLimit) {
        running = false;
        return {
          done: true,
          result: {
            metrics: metrics.getResult(),
            completed: metrics.isComplete(mission.missionType),
            reason: "timeout",
          },
        };
      }

      // Update metrics this frame
      metrics.update(pos.lon, pos.lat, pos.altAgl, callbacks.toCartesian);

      // Check completion
      if (metrics.isComplete(mission.missionType)) {
        running = false;
        return {
          done: true,
          result: {
            metrics: metrics.getResult(),
            completed: true,
            reason: "success",
          },
        };
      }

      return { done: false };
    },

    getResult(): MissionMetricsResult {
      return metrics.getResult();
    },
  };
}
