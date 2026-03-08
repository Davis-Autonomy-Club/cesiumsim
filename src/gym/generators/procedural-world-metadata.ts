import { SeededRng, formatSeedToken, type Seed } from "./rng";
import type {
  ProceduralWorldMetadata,
  WorldConfiguration,
  WorldTopology,
} from "./types";

const TOPOLOGIES: readonly WorldTopology[] = [
  "corridor",
  "grid",
  "perimeter",
  "hub-and-spoke",
];

export interface ProceduralWorldMetadataGeneratorInput {
  seed: Seed;
  scenarioId: string;
  worldConfiguration: WorldConfiguration;
}

export function generateProceduralWorldMetadata(
  input: ProceduralWorldMetadataGeneratorInput,
): ProceduralWorldMetadata {
  const rng = new SeededRng(`${input.seed}:metadata:${input.scenarioId}`);
  const layoutSeed = `${input.seed}:layout:${input.worldConfiguration.variantIndex}`;
  const topology = rng.pick(TOPOLOGIES);

  return {
    metadataId: `meta-${slugify(input.scenarioId)}-${formatSeedToken(input.seed)}`,
    scenarioId: input.scenarioId,
    layoutSeed,
    topology,
    assetProfile: selectAssetProfile(input.scenarioId),
    tags: buildMetadataTags(input.scenarioId, topology),
    attributes: {
      layoutChecksum: formatSeedToken(layoutSeed),
      weatherPreset: input.worldConfiguration.weatherPreset,
      lightingPreset: input.worldConfiguration.lightingPreset,
      obstacleDensity: input.worldConfiguration.obstacleDensity,
    },
  };
}

function selectAssetProfile(scenarioId: string): string {
  if (scenarioId.includes("fire")) {
    return "wildfire-response";
  }
  if (scenarioId.includes("davis")) {
    return "campus-navigation";
  }
  if (scenarioId.startsWith("mission-")) {
    return "mission-training";
  }
  return "urban-navigation";
}

function buildMetadataTags(
  scenarioId: string,
  topology: WorldTopology,
): readonly string[] {
  const scope = scenarioId.startsWith("mission-") ? "mission" : "course";
  return [scope, topology, selectAssetProfile(scenarioId)];
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
