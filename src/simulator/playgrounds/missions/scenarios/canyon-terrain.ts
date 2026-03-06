import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;

// Canyon floor is H=0, plateau top is at H+14
// Webots: left ridge at x=-18, right ridge at x=38, plateau at x=60,y=50 at altitude 14m

export const canyonTerrainMission: MissionPlayground = {
  id: "mission-canyon-terrain",
  name: "B2: Canyon Terrain",
  missionType: "altitude-climb",
  missionGoal: "Reach the firefighter on the elevated plateau. You will need to ascend significantly — the target is high above the canyon floor.",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 5 },
  terrain: "flat",
  timeLimit: 300,
  ascentTarget: 14,  // meters AGL — matches Webots plateau height

  missionTargets: [
    {
      id: "plateau-target",
      position: { lon: BASE_LON + 0.00054, lat: BASE_LAT + 0.00045, height: H + 15 },
      arrivalRadius: 12,
      label: "Elevated Plateau (Red Crate)",
    },
  ],

  obstacles: [
    // Canyon left wall — tall narrow box
    {
      type: "box",
      position: { lon: BASE_LON - 0.000162, lat: BASE_LAT + 0.000270, height: H + 7 },
      dimensions: { length: 8, width: 80, height: 14 },
      heading: 0,
      color: { red: 0.52, green: 0.47, blue: 0.40 },
    },
    // Canyon right wall
    {
      type: "box",
      position: { lon: BASE_LON + 0.000342, lat: BASE_LAT + 0.000270, height: H + 8 },
      dimensions: { length: 8, width: 80, height: 16 },
      heading: 0,
      color: { red: 0.50, green: 0.45, blue: 0.38 },
    },
    // Elevated plateau block
    {
      type: "box",
      position: { lon: BASE_LON + 0.00054, lat: BASE_LAT + 0.00045, height: H + 7 },
      dimensions: { length: 20, width: 20, height: 14 },
      heading: 0,
      color: { red: 0.48, green: 0.43, blue: 0.37 },
    },
    // Target marker on plateau top
    {
      type: "marker", id: "plateau-target",
      position: { lon: BASE_LON + 0.00054, lat: BASE_LAT + 0.00045, height: H + 14 },
      color: { red: 0.9, green: 0.1, blue: 0.1 },
      poleHeight: 3, poleWidth: 2,
    },
    // Rock spires in canyon floor
    { type: "box", position: { lon: BASE_LON + 0.000090, lat: BASE_LAT + 0.000180, height: H + 4 }, dimensions: { length: 4, width: 4, height: 8 }, heading: 0, color: { red: 0.47, green: 0.44, blue: 0.40 } },
    { type: "box", position: { lon: BASE_LON + 0.000162, lat: BASE_LAT + 0.000360, height: H + 5 }, dimensions: { length: 5, width: 5, height: 10 }, heading: 0, color: { red: 0.50, green: 0.46, blue: 0.41 } },
    { type: "box", position: { lon: BASE_LON + 0.000072, lat: BASE_LAT + 0.000495, height: H + 3 }, dimensions: { length: 4, width: 4, height: 6 }, heading: 0, color: { red: 0.48, green: 0.44, blue: 0.39 } },
    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000045, lat: BASE_LAT + 0.000135, height: H + 2 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000198, lat: BASE_LAT + 0.000315, height: H + 2.5 }, length: 8, topRadius: 4 },
    // Massive density boost (5-6x) — distributed on edges and floor
    // Massive density boost (5-6x) — REDUCED CANOPY & SPAWN CLEARANCE
    { type: "tree", position: { lon: -122.4000641, lat: 37.7997632, height: 0 }, trunkHeight: 10.0, trunkRadius: 0.39, canopyRadius: 2.4, variant: "pine" },
    { type: "tree", position: { lon: -122.4000533, lat: 37.8003372, height: 0 }, trunkHeight: 11.8, trunkRadius: 0.44, canopyRadius: 1.9, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999348, lat: 37.7995802, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.39, canopyRadius: 1.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3999373, lat: 37.7996761, height: 0 }, trunkHeight: 10.0, trunkRadius: 0.44, canopyRadius: 2.5, variant: "oak" },
    { type: "tree", position: { lon: -122.3999602, lat: 37.8003678, height: 0 }, trunkHeight: 11.3, trunkRadius: 0.48, canopyRadius: 1.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3998730, lat: 37.7996390, height: 0 }, trunkHeight: 9.8, trunkRadius: 0.36, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3999014, lat: 37.7996739, height: 0 }, trunkHeight: 9.5, trunkRadius: 0.48, canopyRadius: 2.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3997261, lat: 37.7996379, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.43, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3997451, lat: 37.7999707, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.42, canopyRadius: 2.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997712, lat: 37.8001093, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.37, canopyRadius: 2.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3997025, lat: 37.8002807, height: 0 }, trunkHeight: 12.3, trunkRadius: 0.42, canopyRadius: 2.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996253, lat: 37.7995619, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.37, canopyRadius: 2.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995998, lat: 37.7997107, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.47, canopyRadius: 2.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3995778, lat: 37.7998170, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.42, canopyRadius: 2.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995921, lat: 37.7999727, height: 0 }, trunkHeight: 11.8, trunkRadius: 0.36, canopyRadius: 1.9, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996041, lat: 37.8001993, height: 0 }, trunkHeight: 10.4, trunkRadius: 0.46, canopyRadius: 2.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994599, lat: 37.7995955, height: 0 }, trunkHeight: 8.3, trunkRadius: 0.35, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3995122, lat: 37.7997315, height: 0 }, trunkHeight: 10.0, trunkRadius: 0.41, canopyRadius: 2.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3994852, lat: 37.7999246, height: 0 }, trunkHeight: 9.2, trunkRadius: 0.50, canopyRadius: 2.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994650, lat: 37.8001257, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.37, canopyRadius: 2.5, variant: "pine" },
    { type: "tree", position: { lon: -122.3994662, lat: 37.8001843, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.42, canopyRadius: 2.0, variant: "pine" },
    { type: "tree", position: { lon: -122.3995071, lat: 37.8003337, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.50, canopyRadius: 2.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3993419, lat: 37.7996223, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.39, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3994068, lat: 37.7997267, height: 0 }, trunkHeight: 8.1, trunkRadius: 0.49, canopyRadius: 2.5, variant: "oak" },
    { type: "tree", position: { lon: -122.3994079, lat: 37.7998091, height: 0 }, trunkHeight: 9.3, trunkRadius: 0.46, canopyRadius: 2.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3994138, lat: 37.7999633, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.41, canopyRadius: 1.9, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993392, lat: 37.8001912, height: 0 }, trunkHeight: 12.6, trunkRadius: 0.39, canopyRadius: 2.4, variant: "oak" },
    { type: "tree", position: { lon: -122.3993525, lat: 37.8003083, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.40, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3992830, lat: 37.7997654, height: 0 }, trunkHeight: 12.6, trunkRadius: 0.42, canopyRadius: 2.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3992827, lat: 37.7998523, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.42, canopyRadius: 2.8, variant: "cypress" },
    { type: "tree", position: { lon: -122.3992334, lat: 37.7999898, height: 0 }, trunkHeight: 12.9, trunkRadius: 0.50, canopyRadius: 2.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3992559, lat: 37.8000830, height: 0 }, trunkHeight: 10.9, trunkRadius: 0.48, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3992505, lat: 37.8002040, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.48, canopyRadius: 2.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.3992341, lat: 37.8003656, height: 0 }, trunkHeight: 9.9, trunkRadius: 0.37, canopyRadius: 2.3, variant: "oak" },
  ],
};
