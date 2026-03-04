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
    { type: "tree", position: { lon: -122.4001063, lat: 37.7999356, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.43, canopyRadius: 3.8, variant: "cypress" },
    { type: "tree", position: { lon: -122.4001261, lat: 37.8000254, height: 0 }, trunkHeight: 11.6, trunkRadius: 0.42, canopyRadius: 3.8, variant: "oak" },
    { type: "tree", position: { lon: -122.4001227, lat: 37.8001792, height: 0 }, trunkHeight: 10.6, trunkRadius: 0.58, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.4000620, lat: 37.8003347, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.55, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.4000971, lat: 37.8004242, height: 0 }, trunkHeight: 11.1, trunkRadius: 0.53, canopyRadius: 5.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.4001244, lat: 37.8004674, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.42, canopyRadius: 4.8, variant: "oak" },
    { type: "tree", position: { lon: -122.4001183, lat: 37.8006108, height: 0 }, trunkHeight: 8.0, trunkRadius: 0.40, canopyRadius: 5.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3999792, lat: 37.7998709, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.51, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.4000044, lat: 37.8000871, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.49, canopyRadius: 3.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3999778, lat: 37.8001634, height: 0 }, trunkHeight: 12.1, trunkRadius: 0.57, canopyRadius: 4.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999941, lat: 37.8003392, height: 0 }, trunkHeight: 10.3, trunkRadius: 0.46, canopyRadius: 4.2, variant: "pine" },
    { type: "tree", position: { lon: -122.4000249, lat: 37.8003967, height: 0 }, trunkHeight: 9.0, trunkRadius: 0.53, canopyRadius: 4.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3998618, lat: 37.7999329, height: 0 }, trunkHeight: 12.8, trunkRadius: 0.41, canopyRadius: 5.5, variant: "oak" },
    { type: "tree", position: { lon: -122.3999196, lat: 37.7999873, height: 0 }, trunkHeight: 10.6, trunkRadius: 0.55, canopyRadius: 5.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999077, lat: 37.8000642, height: 0 }, trunkHeight: 11.7, trunkRadius: 0.54, canopyRadius: 5.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.3998607, lat: 37.8001946, height: 0 }, trunkHeight: 12.2, trunkRadius: 0.41, canopyRadius: 4.3, variant: "pine" },
    { type: "tree", position: { lon: -122.3999079, lat: 37.8003304, height: 0 }, trunkHeight: 10.2, trunkRadius: 0.40, canopyRadius: 3.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999155, lat: 37.8004394, height: 0 }, trunkHeight: 12.0, trunkRadius: 0.55, canopyRadius: 5.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3998888, lat: 37.8006380, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.41, canopyRadius: 5.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997729, lat: 37.7998709, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.56, canopyRadius: 4.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3998097, lat: 37.8000380, height: 0 }, trunkHeight: 10.2, trunkRadius: 0.52, canopyRadius: 4.6, variant: "pine" },
    { type: "tree", position: { lon: -122.3998318, lat: 37.8000684, height: 0 }, trunkHeight: 10.9, trunkRadius: 0.46, canopyRadius: 4.3, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997627, lat: 37.8003329, height: 0 }, trunkHeight: 8.8, trunkRadius: 0.52, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3997830, lat: 37.8004056, height: 0 }, trunkHeight: 8.3, trunkRadius: 0.56, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3998114, lat: 37.8005185, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.59, canopyRadius: 5.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3997804, lat: 37.8005760, height: 0 }, trunkHeight: 9.1, trunkRadius: 0.49, canopyRadius: 4.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997331, lat: 37.7998881, height: 0 }, trunkHeight: 10.1, trunkRadius: 0.49, canopyRadius: 4.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997196, lat: 37.7999667, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.57, canopyRadius: 3.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3996723, lat: 37.8001289, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.58, canopyRadius: 5.3, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997112, lat: 37.8002381, height: 0 }, trunkHeight: 11.3, trunkRadius: 0.48, canopyRadius: 5.1, variant: "pine" },
    { type: "tree", position: { lon: -122.3997236, lat: 37.8002626, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.41, canopyRadius: 3.6, variant: "pine" },
    { type: "tree", position: { lon: -122.3997094, lat: 37.8003808, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.46, canopyRadius: 5.0, variant: "pine" },
    { type: "tree", position: { lon: -122.3996060, lat: 37.7998673, height: 0 }, trunkHeight: 8.9, trunkRadius: 0.44, canopyRadius: 4.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3995999, lat: 37.8000214, height: 0 }, trunkHeight: 11.0, trunkRadius: 0.43, canopyRadius: 4.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3996081, lat: 37.8000912, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.50, canopyRadius: 3.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3995756, lat: 37.8002019, height: 0 }, trunkHeight: 8.3, trunkRadius: 0.57, canopyRadius: 4.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3995618, lat: 37.8002624, height: 0 }, trunkHeight: 11.3, trunkRadius: 0.54, canopyRadius: 4.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3995987, lat: 37.8004799, height: 0 }, trunkHeight: 11.2, trunkRadius: 0.46, canopyRadius: 4.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995767, lat: 37.8006013, height: 0 }, trunkHeight: 10.9, trunkRadius: 0.42, canopyRadius: 5.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3995025, lat: 37.7998728, height: 0 }, trunkHeight: 12.6, trunkRadius: 0.54, canopyRadius: 4.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3994892, lat: 37.8001037, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.51, canopyRadius: 4.5, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995012, lat: 37.8001679, height: 0 }, trunkHeight: 8.7, trunkRadius: 0.59, canopyRadius: 5.1, variant: "pine" },
    { type: "tree", position: { lon: -122.3994687, lat: 37.8003267, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.43, canopyRadius: 3.5, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994919, lat: 37.8003863, height: 0 }, trunkHeight: 13.0, trunkRadius: 0.41, canopyRadius: 4.3, variant: "pine" },
    { type: "tree", position: { lon: -122.3995289, lat: 37.8005233, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.45, canopyRadius: 4.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993975, lat: 37.7999059, height: 0 }, trunkHeight: 8.3, trunkRadius: 0.41, canopyRadius: 5.3, variant: "pine" },
    { type: "tree", position: { lon: -122.3994201, lat: 37.8000360, height: 0 }, trunkHeight: 8.3, trunkRadius: 0.51, canopyRadius: 3.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3993936, lat: 37.8001183, height: 0 }, trunkHeight: 9.8, trunkRadius: 0.56, canopyRadius: 3.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994130, lat: 37.8002831, height: 0 }, trunkHeight: 12.2, trunkRadius: 0.50, canopyRadius: 3.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3994132, lat: 37.8004009, height: 0 }, trunkHeight: 12.5, trunkRadius: 0.50, canopyRadius: 5.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3994136, lat: 37.8004619, height: 0 }, trunkHeight: 11.7, trunkRadius: 0.54, canopyRadius: 4.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3994271, lat: 37.8006309, height: 0 }, trunkHeight: 11.2, trunkRadius: 0.57, canopyRadius: 4.4, variant: "pine" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000225, height: H + 2 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000450, lat: BASE_LAT + 0.000270, height: H + 2.5 }, length: 8, topRadius: 4 },
  ],
};
