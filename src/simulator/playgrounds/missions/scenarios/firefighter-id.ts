import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;
// Alpha (correct, RED): lon offset ~+90m east, lat offset ~+620m north → in degrees: +0.00081 lon, +0.00561 lat ... 
// Actually scale to match ~70-80m routes. Webots: Alpha at (10,70), Bravo at (70,10)
// Scale 1 degree lon ≈ 88000m at 37.8°N, 1 degree lat ≈ 110540m
// 70m north ≈ +0.000633 lat, 70m east ≈ +0.000795 lon

export const firefighterIdMission: MissionPlayground = {
  id: "mission-firefighter-id",
  name: "B3: Firefighter Identification",
  missionType: "target-id",
  missionGoal: "Deliver supplies to Team Alpha, identified by the RED marker. Do NOT go to the blue marker — that is Team Bravo.",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 15 },
  terrain: "flat",
  timeLimit: 300,

  missionTargets: [
    {
      id: "alpha",
      position: { lon: BASE_LON + 0.000090, lat: BASE_LAT + 0.000633, height: H },
      arrivalRadius: 5,
      isDistractor: false,
      label: "Team Alpha (RED)",
    },
    {
      id: "bravo",
      position: { lon: BASE_LON + 0.000633, lat: BASE_LAT + 0.000090, height: H },
      arrivalRadius: 20,   // wider "danger zone" for penalizing approach
      isDistractor: true,
      label: "Team Bravo (BLUE) — WRONG TARGET",
    },
  ],

  obstacles: [
    // Team Alpha — RED marker (correct target)
    {
      type: "marker", id: "alpha",
      position: { lon: BASE_LON + 0.000090, lat: BASE_LAT + 0.000633, height: H },
      color: { red: 0.9, green: 0.08, blue: 0.08 },
      poleHeight: 8, poleWidth: 2, hasClearingCircle: true, clearingRadius: 12
    },

    // Team Bravo — BLUE marker (distractor)
    {
      type: "marker", id: "bravo",
      position: { lon: BASE_LON + 0.000633, lat: BASE_LAT + 0.000090, height: H },
      color: { red: 0.08, green: 0.25, blue: 0.9 },
      poleHeight: 8, poleWidth: 2, hasClearingCircle: true, clearingRadius: 12
    },

    // Massive density boost (5-6x) — filling corridors and center
    // Massive density boost (5-6x) — REDUCED CANOPY & SPAWN CLEARANCE
    { type: "tree", position: { lon: -122.4000928, lat: 37.8003108, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.42, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.4000717, lat: 37.8004184, height: 0 }, trunkHeight: 10.8, trunkRadius: 0.48, canopyRadius: 2.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.4000609, lat: 37.8005141, height: 0 }, trunkHeight: 12.5, trunkRadius: 0.43, canopyRadius: 1.9, variant: "oak" },
    { type: "tree", position: { lon: -122.4000670, lat: 37.8006087, height: 0 }, trunkHeight: 9.1, trunkRadius: 0.36, canopyRadius: 2.1, variant: "pine" },
    { type: "tree", position: { lon: -122.4000214, lat: 37.8003256, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.42, canopyRadius: 2.5, variant: "pine" },
    { type: "tree", position: { lon: -122.3999745, lat: 37.8003658, height: 0 }, trunkHeight: 8.7, trunkRadius: 0.44, canopyRadius: 2.3, variant: "pine" },
    { type: "tree", position: { lon: -122.3999886, lat: 37.8004855, height: 0 }, trunkHeight: 10.4, trunkRadius: 0.43, canopyRadius: 2.5, variant: "pine" },
    { type: "tree", position: { lon: -122.4000233, lat: 37.8005738, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.41, canopyRadius: 2.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3998744, lat: 37.8002832, height: 0 }, trunkHeight: 9.4, trunkRadius: 0.47, canopyRadius: 2.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999300, lat: 37.8003745, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.46, canopyRadius: 2.6, variant: "pine" },
    { type: "tree", position: { lon: -122.3999063, lat: 37.8004976, height: 0 }, trunkHeight: 10.3, trunkRadius: 0.45, canopyRadius: 2.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3999059, lat: 37.8006282, height: 0 }, trunkHeight: 10.0, trunkRadius: 0.35, canopyRadius: 1.9, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997679, lat: 37.8002380, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.39, canopyRadius: 2.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3997711, lat: 37.8003334, height: 0 }, trunkHeight: 12.6, trunkRadius: 0.37, canopyRadius: 2.5, variant: "oak" },
    { type: "tree", position: { lon: -122.3997812, lat: 37.8003666, height: 0 }, trunkHeight: 12.2, trunkRadius: 0.40, canopyRadius: 2.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3997770, lat: 37.8004966, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.47, canopyRadius: 2.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3997937, lat: 37.8006345, height: 0 }, trunkHeight: 10.4, trunkRadius: 0.38, canopyRadius: 2.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3996828, lat: 37.7998710, height: 0 }, trunkHeight: 10.5, trunkRadius: 0.41, canopyRadius: 2.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3997189, lat: 37.8000214, height: 0 }, trunkHeight: 10.6, trunkRadius: 0.42, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3996760, lat: 37.8002312, height: 0 }, trunkHeight: 10.6, trunkRadius: 0.45, canopyRadius: 1.9, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996854, lat: 37.8003324, height: 0 }, trunkHeight: 10.1, trunkRadius: 0.44, canopyRadius: 1.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3996901, lat: 37.8003929, height: 0 }, trunkHeight: 11.6, trunkRadius: 0.46, canopyRadius: 2.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996932, lat: 37.8005298, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.43, canopyRadius: 2.5, variant: "pine" },
    { type: "tree", position: { lon: -122.3996663, lat: 37.8005689, height: 0 }, trunkHeight: 8.8, trunkRadius: 0.35, canopyRadius: 2.5, variant: "oak" },
    { type: "tree", position: { lon: -122.3995908, lat: 37.7998879, height: 0 }, trunkHeight: 8.8, trunkRadius: 0.42, canopyRadius: 2.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3995635, lat: 37.7999765, height: 0 }, trunkHeight: 9.2, trunkRadius: 0.49, canopyRadius: 2.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996143, lat: 37.8000967, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.40, canopyRadius: 2.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3996207, lat: 37.8001874, height: 0 }, trunkHeight: 9.0, trunkRadius: 0.43, canopyRadius: 2.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3995621, lat: 37.8002919, height: 0 }, trunkHeight: 12.9, trunkRadius: 0.40, canopyRadius: 1.8, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995997, lat: 37.8003964, height: 0 }, trunkHeight: 11.3, trunkRadius: 0.44, canopyRadius: 2.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996025, lat: 37.8004826, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.47, canopyRadius: 2.3, variant: "pine" },
    { type: "tree", position: { lon: -122.3995871, lat: 37.8005751, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.37, canopyRadius: 2.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3995130, lat: 37.8000002, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.44, canopyRadius: 2.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3995147, lat: 37.8000963, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.46, canopyRadius: 1.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3994715, lat: 37.8001821, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.39, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3995036, lat: 37.8003354, height: 0 }, trunkHeight: 8.1, trunkRadius: 0.45, canopyRadius: 2.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3994942, lat: 37.8006323, height: 0 }, trunkHeight: 11.8, trunkRadius: 0.36, canopyRadius: 2.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994187, lat: 37.7999824, height: 0 }, trunkHeight: 9.2, trunkRadius: 0.43, canopyRadius: 2.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994267, lat: 37.8000602, height: 0 }, trunkHeight: 9.1, trunkRadius: 0.50, canopyRadius: 1.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3994307, lat: 37.8001699, height: 0 }, trunkHeight: 9.9, trunkRadius: 0.48, canopyRadius: 1.8, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993619, lat: 37.8002863, height: 0 }, trunkHeight: 9.3, trunkRadius: 0.44, canopyRadius: 2.5, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993717, lat: 37.8003895, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.44, canopyRadius: 2.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993838, lat: 37.8005218, height: 0 }, trunkHeight: 9.3, trunkRadius: 0.40, canopyRadius: 2.4, variant: "pine" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000225, height: H + 2 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000450, lat: BASE_LAT + 0.000270, height: H + 2.5 }, length: 8, topRadius: 4 },
  ],
};
