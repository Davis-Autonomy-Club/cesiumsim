import { SeededRng, formatSeedToken, type Seed } from "./rng";
import type {
  LightingPreset,
  WeatherPreset,
  WorldConfiguration,
} from "./types";

const WEATHER_PRESETS: readonly WeatherPreset[] = [
  "clear",
  "breezy",
  "hazy",
  "overcast",
];

const LIGHTING_PRESETS: readonly LightingPreset[] = [
  "dawn",
  "day",
  "dusk",
];

export interface WorldConfigurationGeneratorInput {
  seed: Seed;
  scenarioId: string;
}

export function generateWorldConfiguration(
  input: WorldConfigurationGeneratorInput,
): WorldConfiguration {
  const rng = new SeededRng(`${input.seed}:world:${input.scenarioId}`);
  const variantIndex = rng.nextInt(0, 1000);

  return {
    configId: `world-${slugify(input.scenarioId)}-${formatSeedToken(input.seed)}`,
    scenarioId: input.scenarioId,
    variantIndex,
    spawnOffset: {
      eastMeters: rng.nextInt(-25, 26),
      northMeters: rng.nextInt(-25, 26),
      altitudeMeters: rng.nextInt(0, 21),
    },
    weatherPreset: rng.pick(WEATHER_PRESETS),
    lightingPreset: rng.pick(LIGHTING_PRESETS),
    obstacleDensity: Number((0.1 + rng.nextFloat() * 0.6).toFixed(3)),
    tags: buildWorldTags(input.scenarioId),
    parameters: {
      windSpeedMetersPerSecond: Number((rng.nextFloat() * 12).toFixed(3)),
      visibilityMeters: 500 + rng.nextInt(0, 1501),
      variantIndex,
    },
  };
}

function buildWorldTags(scenarioId: string): readonly string[] {
  if (scenarioId.includes("fire")) {
    return ["operations", "wildfire"];
  }
  if (scenarioId.includes("city") || scenarioId.includes("downtown")) {
    return ["urban", "dense"];
  }
  if (scenarioId.includes("davis")) {
    return ["campus", "mixed-density"];
  }
  if (scenarioId.startsWith("mission-")) {
    return ["mission", "scripted"];
  }
  return ["generic"];
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
