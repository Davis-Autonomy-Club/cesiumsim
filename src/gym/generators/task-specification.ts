import { SeededRng, formatSeedToken, type Seed } from "./rng";
import type {
  TaskDifficultyTier,
  TaskObjectiveFamily,
  TaskSpecification,
} from "./types";

const OBJECTIVE_FAMILIES: readonly TaskObjectiveFamily[] = [
  "navigation",
  "inspection",
  "response",
  "survey",
];

const DIFFICULTY_TIERS: readonly TaskDifficultyTier[] = [
  "easy",
  "medium",
  "hard",
];

export interface TaskSpecificationGeneratorInput {
  seed: Seed;
  scenarioId: string;
}

export function generateTaskSpecification(
  input: TaskSpecificationGeneratorInput,
): TaskSpecification {
  const rng = new SeededRng(`${input.seed}:task:${input.scenarioId}`);
  const difficultyTier = rng.pick(DIFFICULTY_TIERS);
  const objectiveFamily = rng.pick(OBJECTIVE_FAMILIES);
  const targetCount = rng.nextInt(1, 5);
  const precisionMeters = rng.nextInt(5, 16);
  const timeLimitSeconds = 180 + rng.nextInt(0, 181);

  return {
    taskId: `task-${slugify(input.scenarioId)}-${formatSeedToken(input.seed)}`,
    scenarioId: input.scenarioId,
    objectiveFamily,
    difficultyTier,
    timeLimitSeconds,
    rewardWeights: {
      completion: roundWeight(0.55 + rng.nextFloat() * 0.2),
      efficiency: roundWeight(0.15 + rng.nextFloat() * 0.15),
      safety: roundWeight(0.2 + rng.nextFloat() * 0.15),
    },
    tags: buildTaskTags(input.scenarioId, objectiveFamily, difficultyTier),
    parameters: {
      targetCount,
      precisionMeters,
      allowRecovery: difficultyTier !== "hard",
    },
  };
}

function buildTaskTags(
  scenarioId: string,
  objectiveFamily: TaskObjectiveFamily,
  difficultyTier: TaskDifficultyTier,
): readonly string[] {
  const scope = scenarioId.startsWith("mission-") ? "mission" : "course";
  return [scope, objectiveFamily, difficultyTier];
}

function roundWeight(value: number): number {
  return Number(value.toFixed(3));
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
