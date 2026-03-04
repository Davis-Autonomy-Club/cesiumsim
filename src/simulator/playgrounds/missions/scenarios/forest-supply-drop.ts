import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;

export const forestSupplyDropMission: MissionPlayground = {
  id: "mission-forest-supply-drop",
  name: "B1: Forest Supply Drop",
  missionType: "supply-drop",
  missionGoal: "Navigate through the forest and deliver supplies to the firefighter at the RED supply crate.",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 15 },
  terrain: "flat",
  timeLimit: 300,

  // Logical targets — what FlightMetrics checks
  missionTargets: [
    {
      id: "red-crate",
      position: { lon: BASE_LON + 0.00072, lat: BASE_LAT + 0.00054, height: H + 1.5 },
      arrivalRadius: 8,
      label: "Red Supply Crate",
    },
  ],

  // Zone thresholds — lon offsets drone must pass to be in each zone
  // Mirrors Webots lat thresholds of 30m, 55m, 70m
  zoneThresholds: [
    { id: "zone1", minLon: BASE_LON + 0.00027 },  // ~30m
    { id: "zone2", minLon: BASE_LON + 0.00049 },  // ~55m
    { id: "zone3", minLon: BASE_LON + 0.00063 },  // ~70m
  ],

  obstacles: [
    // Base camp clearing — yellow crate at spawn
    {
      type: "marker", id: "base-camp", position: { lon: BASE_LON, lat: BASE_LAT, height: H },
      color: { red: 1.0, green: 0.9, blue: 0.0 }, poleHeight: 3, poleWidth: 3,
      hasClearingCircle: true, clearingRadius: 15
    },

    // Target — red supply crate
    {
      type: "marker", id: "red-crate", position: { lon: BASE_LON + 0.00072, lat: BASE_LAT + 0.00054, height: H },
      color: { red: 0.9, green: 0.1, blue: 0.1 }, poleHeight: 3, poleWidth: 3,
      hasClearingCircle: true, clearingRadius: 12
    },

    // Forest — mirrors Webots cluster placement converted to lon/lat offsets
    // Cluster 1: near base
    { type: "tree", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000072, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000198, lat: BASE_LAT + 0.000108, height: H }, trunkHeight: 10, trunkRadius: 0.5, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000180, lat: BASE_LAT - 0.000045, height: H }, trunkHeight: 8, trunkRadius: 0.4, canopyRadius: 3.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000135, lat: BASE_LAT - 0.000090, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000108, lat: BASE_LAT + 0.000135, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },

    // Cluster 2: mid-route dense section (~35–42m out)
    { type: "tree", position: { lon: BASE_LON + 0.000315, lat: BASE_LAT + 0.000225, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000342, lat: BASE_LAT + 0.000270, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000288, lat: BASE_LAT + 0.000252, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000360, lat: BASE_LAT + 0.000198, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000270, lat: BASE_LAT + 0.000288, height: H }, trunkHeight: 10, trunkRadius: 0.4, canopyRadius: 4, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000324, lat: BASE_LAT + 0.000315, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 3.8, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000378, lat: BASE_LAT + 0.000243, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4, variant: "cypress" },

    // Cluster 3: near target (~65–75m out)
    { type: "tree", position: { lon: BASE_LON + 0.000585, lat: BASE_LAT + 0.000450, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000630, lat: BASE_LAT + 0.000495, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000612, lat: BASE_LAT + 0.000432, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000648, lat: BASE_LAT + 0.000468, height: H }, trunkHeight: 10, trunkRadius: 0.4, canopyRadius: 3.8, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000675, lat: BASE_LAT + 0.000522, height: H }, trunkHeight: 12, trunkRadius: 0.55, canopyRadius: 5.5, variant: "oak" },

    // Boulders — large sphere obstacles
    { type: "cylinder", position: { lon: BASE_LON + 0.000270, lat: BASE_LAT + 0.000180, height: H + 4 }, length: 8, topRadius: 4 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000522, lat: BASE_LAT + 0.000378, height: H + 5 }, length: 10, topRadius: 5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000405, lat: BASE_LAT + 0.000495, height: H + 3.5 }, length: 7, topRadius: 3.5 },
  ],
};
