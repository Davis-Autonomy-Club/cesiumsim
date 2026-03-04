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
    // Sparse trees on canyon edges
    { type: "tree", position: { lon: BASE_LON - 0.000045, lat: BASE_LAT + 0.000090, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000225, lat: BASE_LAT + 0.000072, height: H }, trunkHeight: 10, trunkRadius: 0.5, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON - 0.000072, lat: BASE_LAT + 0.000405, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
  ],
};
