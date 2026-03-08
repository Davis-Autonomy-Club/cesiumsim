export type JsonPrimitive = boolean | number | string | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Action {
  values: Readonly<Record<string, JsonValue>>;
}

export interface Observation {
  values: Readonly<Record<string, JsonValue>>;
}

export interface EpisodeInfo {
  episodeId: string;
  episodeIndex: number;
  stepCount: number;
  cumulativeReward: number;
  scenarioId: string | null;
  seed: number | string | null;
  terminated: boolean;
  truncated: boolean;
  metadata: Readonly<Record<string, JsonValue>>;
}

export interface EnvOptions {
  scenarioId?: string | null;
  seed?: number | string | null;
  maxEpisodeSteps?: number | null;
  metadata?: Readonly<Record<string, JsonValue>>;
}

export interface ResetResult<
  ObservationType extends Observation = Observation,
  InfoType extends EpisodeInfo = EpisodeInfo,
> {
  observation: ObservationType;
  info: InfoType;
}

export interface StepResult<
  ObservationType extends Observation = Observation,
  InfoType extends EpisodeInfo = EpisodeInfo,
> {
  observation: ObservationType;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: InfoType;
}
