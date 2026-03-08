import type {
  Action,
  EnvOptions,
  EpisodeInfo,
  Observation,
  ResetResult,
  StepResult,
} from "./types";

export interface GymEnvironment<
  ActionType extends Action = Action,
  ObservationType extends Observation = Observation,
  InfoType extends EpisodeInfo = EpisodeInfo,
  OptionsType extends EnvOptions = EnvOptions,
> {
  init(options?: OptionsType): void;
  reset(options?: Partial<OptionsType>): ResetResult<ObservationType, InfoType>;
  step(action: ActionType): StepResult<ObservationType, InfoType>;
  observe(): ObservationType;
  close(): void;
}

export class ScaffoldGymEnvironment
  implements GymEnvironment<Action, Observation, EpisodeInfo, EnvOptions>
{
  private initialized = false;
  private closed = false;
  private episodeActive = false;
  private episodeIndex = -1;
  private stepCount = 0;
  private cumulativeReward = 0;
  private options: Required<EnvOptions> = {
    scenarioId: null,
    seed: null,
    maxEpisodeSteps: null,
    metadata: {},
  };
  private lastAction: Action | null = null;
  private lastObservation: Observation = { values: {} };

  init(options: EnvOptions = {}): void {
    this.assertNotClosed();
    this.options = this.mergeOptions(options);
    this.initialized = true;
    this.episodeActive = false;
    this.episodeIndex = -1;
    this.stepCount = 0;
    this.cumulativeReward = 0;
    this.lastAction = null;
    this.lastObservation = this.buildObservation();
  }

  reset(options: Partial<EnvOptions> = {}): ResetResult {
    this.ensureInitialized();
    this.options = this.mergeOptions(options);
    this.episodeIndex += 1;
    this.stepCount = 0;
    this.cumulativeReward = 0;
    this.episodeActive = true;
    this.lastAction = null;
    this.lastObservation = this.buildObservation();

    return {
      observation: this.lastObservation,
      info: this.buildEpisodeInfo(false, false),
    };
  }

  step(action: Action): StepResult {
    this.ensureEpisodeActive();
    this.lastAction = action;
    this.stepCount += 1;

    const reward = 0;
    this.cumulativeReward += reward;

    // Placeholder control flow until the simulator-backed gym wiring exists.
    const terminated = false;
    const truncated =
      this.options.maxEpisodeSteps !== null &&
      this.stepCount >= this.options.maxEpisodeSteps;

    if (terminated || truncated) {
      this.episodeActive = false;
    }

    this.lastObservation = this.buildObservation();

    return {
      observation: this.lastObservation,
      reward,
      terminated,
      truncated,
      info: this.buildEpisodeInfo(terminated, truncated),
    };
  }

  observe(): Observation {
    this.ensureInitialized();
    return this.lastObservation;
  }

  close(): void {
    this.closed = true;
    this.initialized = false;
    this.episodeActive = false;
  }

  private mergeOptions(
    override: Partial<EnvOptions>,
  ): Required<EnvOptions> {
    return {
      scenarioId: override.scenarioId ?? this.options.scenarioId,
      seed: override.seed ?? this.options.seed,
      maxEpisodeSteps: override.maxEpisodeSteps ?? this.options.maxEpisodeSteps,
      metadata: override.metadata ?? this.options.metadata,
    };
  }

  private buildObservation(): Observation {
    return {
      values: {
        initialized: this.initialized,
        episodeActive: this.episodeActive,
        episodeIndex: this.episodeIndex,
        stepCount: this.stepCount,
        scenarioId: this.options.scenarioId,
        seed: this.options.seed,
        lastAction: this.lastAction?.values ?? null,
      },
    };
  }

  private buildEpisodeInfo(
    terminated: boolean,
    truncated: boolean,
  ): EpisodeInfo {
    return {
      episodeId: `episode-${Math.max(this.episodeIndex, 0)}`,
      episodeIndex: this.episodeIndex,
      stepCount: this.stepCount,
      cumulativeReward: this.cumulativeReward,
      scenarioId: this.options.scenarioId,
      seed: this.options.seed,
      terminated,
      truncated,
      metadata: this.options.metadata,
    };
  }

  private ensureInitialized(): void {
    this.assertNotClosed();
    if (!this.initialized) {
      throw new Error("Gym environment must be initialized before use.");
    }
  }

  private ensureEpisodeActive(): void {
    this.ensureInitialized();
    if (!this.episodeActive) {
      throw new Error("Gym environment must be reset before stepping.");
    }
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new Error("Gym environment has already been closed.");
    }
  }
}
