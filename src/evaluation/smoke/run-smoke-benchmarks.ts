import { SMOKE_BENCHMARK_SCENARIOS } from "./course-scenarios";
import { runSmokeBenchmarkSuite } from "./headless-course-harness";

declare const process:
  | {
      exitCode?: number;
    }
  | undefined;

export function getSmokeBenchmarkResult() {
  return runSmokeBenchmarkSuite(SMOKE_BENCHMARK_SCENARIOS);
}

export function getSmokeBenchmarkJson(): string {
  return JSON.stringify(getSmokeBenchmarkResult(), null, 2);
}

export function runSmokeBenchmarks(): void {
  const suiteResult = getSmokeBenchmarkResult();

  console.log(JSON.stringify(suiteResult, null, 2));

  if (suiteResult.summary.failed > 0 && process) {
    process.exitCode = 1;
  }
}
