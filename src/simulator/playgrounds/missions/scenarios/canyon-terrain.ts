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
    { type: "tree", position: { lon: -122.4001065, lat: 37.7996807, height: 0 }, trunkHeight: 13.0, trunkRadius: 0.54, canopyRadius: 4.2, variant: "pine" },
    { type: "tree", position: { lon: -122.4000525, lat: 37.7998439, height: 0 }, trunkHeight: 11.1, trunkRadius: 0.42, canopyRadius: 4.7, variant: "pine" },
    { type: "tree", position: { lon: -122.4000993, lat: 37.8002319, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.50, canopyRadius: 4.7, variant: "pine" },
    { type: "tree", position: { lon: -122.4000691, lat: 37.8003542, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.51, canopyRadius: 3.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999686, lat: 37.7995533, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.58, canopyRadius: 4.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.4000158, lat: 37.7997570, height: 0 }, trunkHeight: 9.2, trunkRadius: 0.47, canopyRadius: 4.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3999417, lat: 37.7999345, height: 0 }, trunkHeight: 8.6, trunkRadius: 0.46, canopyRadius: 4.9, variant: "oak" },
    { type: "tree", position: { lon: -122.4000262, lat: 37.8001134, height: 0 }, trunkHeight: 11.3, trunkRadius: 0.52, canopyRadius: 3.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3999722, lat: 37.8002290, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.43, canopyRadius: 5.1, variant: "pine" },
    { type: "tree", position: { lon: -122.3999888, lat: 37.8003198, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.57, canopyRadius: 4.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3998342, lat: 37.7995638, height: 0 }, trunkHeight: 11.2, trunkRadius: 0.44, canopyRadius: 4.2, variant: "oak" },
    { type: "tree", position: { lon: -122.3998859, lat: 37.7999622, height: 0 }, trunkHeight: 12.8, trunkRadius: 0.43, canopyRadius: 5.2, variant: "oak" },
    { type: "tree", position: { lon: -122.3999066, lat: 37.8000982, height: 0 }, trunkHeight: 8.7, trunkRadius: 0.44, canopyRadius: 3.7, variant: "pine" },
    { type: "tree", position: { lon: -122.3998256, lat: 37.8002773, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.52, canopyRadius: 5.3, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997478, lat: 37.7997553, height: 0 }, trunkHeight: 8.1, trunkRadius: 0.58, canopyRadius: 5.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3997404, lat: 37.7998742, height: 0 }, trunkHeight: 12.6, trunkRadius: 0.43, canopyRadius: 5.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3997688, lat: 37.8003318, height: 0 }, trunkHeight: 11.0, trunkRadius: 0.53, canopyRadius: 4.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996086, lat: 37.7996269, height: 0 }, trunkHeight: 9.8, trunkRadius: 0.52, canopyRadius: 4.3, variant: "cypress" },
    { type: "tree", position: { lon: -122.3996487, lat: 37.7997213, height: 0 }, trunkHeight: 8.9, trunkRadius: 0.43, canopyRadius: 5.3, variant: "pine" },
    { type: "tree", position: { lon: -122.3996559, lat: 37.7998207, height: 0 }, trunkHeight: 12.9, trunkRadius: 0.59, canopyRadius: 5.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3996655, lat: 37.7999848, height: 0 }, trunkHeight: 12.6, trunkRadius: 0.47, canopyRadius: 4.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3995916, lat: 37.8001190, height: 0 }, trunkHeight: 8.2, trunkRadius: 0.45, canopyRadius: 3.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995783, lat: 37.8002115, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.56, canopyRadius: 4.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3996035, lat: 37.8003328, height: 0 }, trunkHeight: 10.3, trunkRadius: 0.58, canopyRadius: 3.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3994760, lat: 37.7995532, height: 0 }, trunkHeight: 8.3, trunkRadius: 0.44, canopyRadius: 4.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3995347, lat: 37.7997416, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.44, canopyRadius: 4.5, variant: "pine" },
    { type: "tree", position: { lon: -122.3994973, lat: 37.7998437, height: 0 }, trunkHeight: 9.3, trunkRadius: 0.55, canopyRadius: 4.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3995148, lat: 37.7999455, height: 0 }, trunkHeight: 9.9, trunkRadius: 0.44, canopyRadius: 3.8, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995345, lat: 37.8000820, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.58, canopyRadius: 5.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.3994925, lat: 37.8003272, height: 0 }, trunkHeight: 8.1, trunkRadius: 0.59, canopyRadius: 4.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3994254, lat: 37.7996230, height: 0 }, trunkHeight: 11.1, trunkRadius: 0.44, canopyRadius: 4.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993597, lat: 37.7997626, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.48, canopyRadius: 4.2, variant: "pine" },
    { type: "tree", position: { lon: -122.3994277, lat: 37.7998573, height: 0 }, trunkHeight: 9.9, trunkRadius: 0.56, canopyRadius: 3.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993475, lat: 37.8000060, height: 0 }, trunkHeight: 12.3, trunkRadius: 0.44, canopyRadius: 3.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993858, lat: 37.8001098, height: 0 }, trunkHeight: 12.3, trunkRadius: 0.52, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3993585, lat: 37.8001883, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.52, canopyRadius: 3.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3993391, lat: 37.8003039, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.50, canopyRadius: 5.2, variant: "oak" },
    { type: "tree", position: { lon: -122.3993065, lat: 37.7996090, height: 0 }, trunkHeight: 11.1, trunkRadius: 0.55, canopyRadius: 5.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3992672, lat: 37.8000044, height: 0 }, trunkHeight: 9.4, trunkRadius: 0.57, canopyRadius: 4.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3992704, lat: 37.8001055, height: 0 }, trunkHeight: 9.0, trunkRadius: 0.51, canopyRadius: 4.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3992756, lat: 37.8002869, height: 0 }, trunkHeight: 8.2, trunkRadius: 0.49, canopyRadius: 3.8, variant: "pine" },
  ],
};
