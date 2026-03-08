import type { JsonValue } from "../types";
import type { Seed } from "./rng";

export type EpisodeManifestSplit = "train" | "dev" | "test";

export type TaskObjectiveFamily =
  | "navigation"
  | "inspection"
  | "response"
  | "survey";

export type TaskDifficultyTier = "easy" | "medium" | "hard";

export type WeatherPreset = "clear" | "breezy" | "hazy" | "overcast";

export type LightingPreset = "dawn" | "day" | "dusk";

export type WorldTopology =
  | "corridor"
  | "grid"
  | "perimeter"
  | "hub-and-spoke";

export interface TaskSpecification {
  taskId: string;
  scenarioId: string;
  objectiveFamily: TaskObjectiveFamily;
  difficultyTier: TaskDifficultyTier;
  timeLimitSeconds: number;
  rewardWeights: Readonly<{
    completion: number;
    efficiency: number;
    safety: number;
  }>;
  tags: readonly string[];
  parameters: Readonly<Record<string, JsonValue>>;
}

export interface WorldConfiguration {
  configId: string;
  scenarioId: string;
  variantIndex: number;
  spawnOffset: Readonly<{
    eastMeters: number;
    northMeters: number;
    altitudeMeters: number;
  }>;
  weatherPreset: WeatherPreset;
  lightingPreset: LightingPreset;
  obstacleDensity: number;
  tags: readonly string[];
  parameters: Readonly<Record<string, JsonValue>>;
}

export interface ProceduralWorldMetadata {
  metadataId: string;
  scenarioId: string;
  layoutSeed: Seed;
  topology: WorldTopology;
  assetProfile: string;
  tags: readonly string[];
  attributes: Readonly<Record<string, JsonValue>>;
}

export interface EpisodeConfiguration {
  task: TaskSpecification;
  world: WorldConfiguration;
  proceduralWorld: ProceduralWorldMetadata;
}

export interface EpisodeManifestEntry {
  episodeId: string;
  split: EpisodeManifestSplit;
  seed: Seed;
  scenarioId: string;
  config: EpisodeConfiguration;
}

export interface EpisodeMetrics {
  values: Readonly<Record<string, JsonValue>>;
}

export type EpisodeEndReason =
  | "completed"
  | "timeout"
  | "collision"
  | "manual_stop"
  | "aborted"
  | "unknown";

export interface EpisodeRecord<
  ConfigType extends EpisodeConfiguration = EpisodeConfiguration,
  MetricsType extends EpisodeMetrics = EpisodeMetrics,
> {
  episodeId: string;
  seed: Seed;
  scenarioId: string;
  config: ConfigType;
  metrics: MetricsType;
  endReason: EpisodeEndReason;
}
