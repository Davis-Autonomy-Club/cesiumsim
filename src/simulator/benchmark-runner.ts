import type { FlightMetricsResult } from "./flight-metrics";
import type { Playground } from "./playgrounds/types";
import { createAutopilot } from "./autopilot";

export type PilotType = "autopilot" | "manual" | "gemini";

export type BenchmarkOptions = {
  pilotType: PilotType;
  maxDurationSeconds: number;
  keySequence?: { code: string; duration: number }[];
};

export type BenchmarkResult = {
  metrics: FlightMetricsResult;
  completed: boolean;
  reason: "success" | "timeout" | "manual_stop";
};

export type BenchmarkRunnerCallbacks = {
  getDronePosition: () => { lon: number; lat: number; height: number; heading: number };
  getElapsedTime: () => number;
  getMetrics: () => FlightMetricsResult;
  applyInput: (input: { forward: number; strafe: number; vertical: number; yaw: number }) => void;
  isComplete: () => boolean;
};

export function createBenchmarkRunner(
  playground: Playground,
  callbacks: BenchmarkRunnerCallbacks,
  options: BenchmarkOptions
) {
  const { pilotType, maxDurationSeconds } = options;
  const autopilot = pilotType === "autopilot" ? createAutopilot(playground) : null;
  let running = false;
  let stopRequested = false;

  return {
    start() {
      running = true;
      stopRequested = false;
    },

    stop() {
      stopRequested = true;
    },

    isRunning() {
      return running;
    },

    tick(dt: number): { done: boolean; result?: BenchmarkResult } {
      if (!running || stopRequested) {
        running = false;
        return {
          done: true,
          result: {
            metrics: callbacks.getMetrics(),
            completed: callbacks.isComplete(),
            reason: "manual_stop",
          },
        };
      }

      const elapsed = callbacks.getElapsedTime();
      if (elapsed >= maxDurationSeconds) {
        running = false;
        return {
          done: true,
          result: {
            metrics: callbacks.getMetrics(),
            completed: callbacks.isComplete(),
            reason: "timeout",
          },
        };
      }

      if (callbacks.isComplete()) {
        running = false;
        return {
          done: true,
          result: {
            metrics: callbacks.getMetrics(),
            completed: true,
            reason: "success",
          },
        };
      }

      if (autopilot) {
        const pos = callbacks.getDronePosition();
        const input = autopilot.computeInput(
          pos.lon,
          pos.lat,
          pos.height,
          pos.heading
        );
        callbacks.applyInput(input);
      }

      return { done: false };
    },
  };
}
