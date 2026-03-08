import { generateProceduralWorldMetadata } from "./procedural-world-metadata";
import { generateTaskSpecification } from "./task-specification";
import { generateWorldConfiguration } from "./world-configuration";
import type { EpisodeConfiguration, EpisodeManifestEntry, EpisodeManifestSplit } from "./types";

const TRAIN_SCENARIO_IDS = [
  "course-downtown-san-francisco",
  "course-uc-davis",
  "mission-first-flight",
  "mission-takeoff-and-land",
  "mission-waypoint-run",
] as const;

const DEV_SCENARIO_IDS = [
  "course-beu-fire-perimeter",
  "mission-city-navigation",
] as const;

const TEST_SCENARIO_IDS = [
  "course-airline-fire",
  "mission-find-the-target",
] as const;

export const TRAIN_EPISODE_MANIFEST = buildManifest(
  "train",
  TRAIN_SCENARIO_IDS,
  "gym-train-v1",
);

export const DEV_EPISODE_MANIFEST = buildManifest(
  "dev",
  DEV_SCENARIO_IDS,
  "gym-dev-v1",
);

export const TEST_EPISODE_MANIFEST = buildManifest(
  "test",
  TEST_SCENARIO_IDS,
  "gym-test-v1",
);

export const EPISODE_MANIFESTS = {
  train: TRAIN_EPISODE_MANIFEST,
  dev: DEV_EPISODE_MANIFEST,
  test: TEST_EPISODE_MANIFEST,
} as const;

export const EXAMPLE_EPISODE_MANIFEST = TRAIN_EPISODE_MANIFEST[0];

function buildManifest(
  split: EpisodeManifestSplit,
  scenarioIds: readonly string[],
  seedPrefix: string,
): EpisodeManifestEntry[] {
  return scenarioIds.map((scenarioId, index) => {
    const seed = `${seedPrefix}:${index}:${scenarioId}`;
    const config = buildEpisodeConfiguration(seed, scenarioId);

    return {
      episodeId: `${split}-${String(index).padStart(3, "0")}-${slugify(scenarioId)}`,
      split,
      seed,
      scenarioId,
      config,
    };
  });
}

function buildEpisodeConfiguration(
  seed: string,
  scenarioId: string,
): EpisodeConfiguration {
  const task = generateTaskSpecification({
    seed: `${seed}:task`,
    scenarioId,
  });
  const world = generateWorldConfiguration({
    seed: `${seed}:world`,
    scenarioId,
  });
  const proceduralWorld = generateProceduralWorldMetadata({
    seed: `${seed}:procedural`,
    scenarioId,
    worldConfiguration: world,
  });

  return {
    task,
    world,
    proceduralWorld,
  };
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
