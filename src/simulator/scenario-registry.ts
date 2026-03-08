import {
  AIRLINE_FIRE_LOCATION,
  BEU_FIRE_PERIMETER_LOCATION,
  START_LOCATION,
  UCD_LOCATION,
  type ScenarioLocation,
} from "./scenario-locations";
export type { ScenarioLocation } from "./scenario-locations";

export type ScenarioKind = "course" | "mission";

export interface ScenarioMetadata {
  id: string;
  name: string;
  kind: ScenarioKind;
  family: string;
  tags: string[];
  defaultTimeLimit: number | null;
}

export interface CourseScenario extends ScenarioMetadata {
  kind: "course";
  location: ScenarioLocation;
  statusText?: string;
}

export interface MissionScenario extends ScenarioMetadata {
  kind: "mission";
}

export type ScenarioDefinition = CourseScenario | MissionScenario;

export const COURSE_SCENARIOS: CourseScenario[] = [
  {
    id: "course-downtown-san-francisco",
    name: "Downtown San Francisco",
    kind: "course",
    family: "playground",
    tags: ["sandbox", "urban", "default-start"],
    defaultTimeLimit: null,
    location: START_LOCATION,
  },
  {
    id: "course-uc-davis",
    name: "UC Davis",
    kind: "course",
    family: "playground",
    tags: ["sandbox", "campus"],
    defaultTimeLimit: null,
    location: UCD_LOCATION,
  },
  {
    id: "course-beu-fire-perimeter",
    name: "BEU Fire Perimeter",
    kind: "course",
    family: "operations",
    tags: ["sandbox", "wildfire", "fire-perimeter"],
    defaultTimeLimit: null,
    location: BEU_FIRE_PERIMETER_LOCATION,
    statusText: "Teleported to BEU (San Benito-Monterey) fire perimeter region.",
  },
  {
    id: "course-airline-fire",
    name: "Airline Fire",
    kind: "course",
    family: "operations",
    tags: ["sandbox", "wildfire", "incident"],
    defaultTimeLimit: null,
    location: AIRLINE_FIRE_LOCATION,
    statusText: "Teleported to Airline Fire incident area (July 2024).",
  },
];

export const MISSION_SCENARIOS: MissionScenario[] = [
  {
    id: "mission-first-flight",
    name: "First Flight",
    kind: "mission",
    family: "training",
    tags: ["tutorial", "waypoint"],
    defaultTimeLimit: 45,
  },
  {
    id: "mission-takeoff-and-land",
    name: "Takeoff & Land",
    kind: "mission",
    family: "training",
    tags: ["tutorial", "altitude", "landing"],
    defaultTimeLimit: 60,
  },
  {
    id: "mission-waypoint-run",
    name: "Waypoint Run",
    kind: "mission",
    family: "training",
    tags: ["navigation", "waypoint"],
    defaultTimeLimit: 90,
  },
  {
    id: "mission-city-navigation",
    name: "City Navigation",
    kind: "mission",
    family: "training",
    tags: ["navigation", "urban"],
    defaultTimeLimit: 150,
  },
  {
    id: "mission-find-the-target",
    name: "Find the Target",
    kind: "mission",
    family: "training",
    tags: ["targeting", "urban"],
    defaultTimeLimit: 120,
  },
];

export const ALL_SCENARIOS: ScenarioDefinition[] = [
  ...COURSE_SCENARIOS,
  ...MISSION_SCENARIOS,
];

export const SCENARIO_REGISTRY = Object.fromEntries(
  ALL_SCENARIOS.map((scenario) => [scenario.id, scenario]),
) as Record<string, ScenarioDefinition>;

export const DEFAULT_SIMULATOR_SCENARIO_ID = "course-downtown-san-francisco";

export const SIMULATOR_TELEPORT_BUTTON_SCENARIOS = [
  { buttonId: "teleport-ucd", scenarioId: "course-uc-davis" },
  { buttonId: "teleport-beu", scenarioId: "course-beu-fire-perimeter" },
  { buttonId: "teleport-airline", scenarioId: "course-airline-fire" },
] as const;

export function getScenario(id: string): ScenarioDefinition {
  const scenario = SCENARIO_REGISTRY[id];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${id}`);
  }
  return scenario;
}

export function getCourseScenario(id: string): CourseScenario {
  const scenario = getScenario(id);
  if (scenario.kind !== "course") {
    throw new Error(`Scenario is not a course: ${id}`);
  }
  return scenario;
}
