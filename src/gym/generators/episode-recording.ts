import type {
  EpisodeConfiguration,
  EpisodeEndReason,
  EpisodeMetrics,
  EpisodeRecord,
} from "./types";
import type { Seed } from "./rng";

export interface EpisodeRecordInput<
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

export function createEpisodeRecord<
  ConfigType extends EpisodeConfiguration = EpisodeConfiguration,
  MetricsType extends EpisodeMetrics = EpisodeMetrics,
>(
  input: EpisodeRecordInput<ConfigType, MetricsType>,
): EpisodeRecord<ConfigType, MetricsType> {
  return {
    episodeId: input.episodeId,
    seed: input.seed,
    scenarioId: input.scenarioId,
    config: input.config,
    metrics: input.metrics,
    endReason: input.endReason,
  };
}
