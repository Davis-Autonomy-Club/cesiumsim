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

    // Forest zone 1: between base and Alpha (north corridor)
    { type: "tree", position: { lon: BASE_LON + 0.000045, lat: BASE_LAT + 0.000198, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000072, lat: BASE_LAT + 0.000252, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000108, lat: BASE_LAT + 0.000288, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000054, lat: BASE_LAT + 0.000342, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000126, lat: BASE_LAT + 0.000378, height: H }, trunkHeight: 12, trunkRadius: 0.55, canopyRadius: 5.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000081, lat: BASE_LAT + 0.000432, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000117, lat: BASE_LAT + 0.000495, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000063, lat: BASE_LAT + 0.000540, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },

    // Forest zone 2: between base and Bravo (east corridor)
    { type: "tree", position: { lon: BASE_LON + 0.000198, lat: BASE_LAT + 0.000054, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000252, lat: BASE_LAT + 0.000081, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000315, lat: BASE_LAT + 0.000063, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000378, lat: BASE_LAT + 0.000108, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000432, lat: BASE_LAT + 0.000072, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000495, lat: BASE_LAT + 0.000099, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000558, lat: BASE_LAT + 0.000054, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "cypress" },

    // Central visual complexity
    { type: "tree", position: { lon: BASE_LON + 0.000270, lat: BASE_LAT + 0.000270, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000315, lat: BASE_LAT + 0.000225, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000360, lat: BASE_LAT + 0.000315, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000225, height: H + 2 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000450, lat: BASE_LAT + 0.000270, height: H + 2.5 }, length: 8, topRadius: 4 },
  ],
};
