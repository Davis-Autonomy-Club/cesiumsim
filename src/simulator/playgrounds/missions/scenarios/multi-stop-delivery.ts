import type { MissionPlayground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const H = 0;
// WP1 (YELLOW) at Webots (35,35) → ~35m north & 35m east
// WP2 (RED) at Webots (75,20) → ~20m north & 75m east

export const multiStopDeliveryMission: MissionPlayground = {
  id: "mission-multi-stop-delivery",
  name: "B4: Multi-Stop Delivery",
  missionType: "multi-stop",
  missionGoal: "First deliver to the YELLOW marker (Team Alpha). Once you reach it, then navigate to the RED marker (Team Bravo).",
  spawn: { longitude: BASE_LON, latitude: BASE_LAT, height: H + 15 },
  terrain: "flat",
  timeLimit: 360,

  missionTargets: [
    {
      id: "wp1",
      position: { lon: BASE_LON + 0.000398, lat: BASE_LAT + 0.000317, height: H },
      arrivalRadius: 5,
      isDistractor: false,
      label: "Waypoint 1 (YELLOW) — deliver first",
    },
    {
      id: "wp2",
      position: { lon: BASE_LON + 0.000852, lat: BASE_LAT + 0.000181, height: H },
      arrivalRadius: 5,
      isDistractor: false,
      label: "Waypoint 2 (RED) — deliver second",
    },
  ],

  obstacles: [
    // Base depot (white/grey box at spawn)
    { type: "box", position: { lon: BASE_LON, lat: BASE_LAT, height: H + 1.5 }, dimensions: { length: 4, width: 4, height: 3 }, heading: 0, color: { red: 0.85, green: 0.85, blue: 0.85 } },

    // WP1 — YELLOW marker
    {
      type: "marker", id: "wp1",
      position: { lon: BASE_LON + 0.000398, lat: BASE_LAT + 0.000317, height: H },
      color: { red: 1.0, green: 0.85, blue: 0.0 },
      poleHeight: 7, poleWidth: 2, hasClearingCircle: true, clearingRadius: 10
    },

    // WP2 — RED marker
    {
      type: "marker", id: "wp2",
      position: { lon: BASE_LON + 0.000852, lat: BASE_LAT + 0.000181, height: H },
      color: { red: 0.9, green: 0.08, blue: 0.08 },
      poleHeight: 7, poleWidth: 2, hasClearingCircle: true, clearingRadius: 10
    },

    // Massive density boost (5-6x) — distributed between all waypoints
    // Massive density boost (5-6x) — REDUCED CANOPY & SPAWN CLEARANCE
    { type: "tree", position: { lon: -122.3999908, lat: 37.8003666, height: 0 }, trunkHeight: 11.2, trunkRadius: 0.38, canopyRadius: 2.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999997, lat: 37.8004907, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.43, canopyRadius: 2.0, variant: "cypress" },
    { type: "tree", position: { lon: -122.4000109, lat: 37.8005691, height: 0 }, trunkHeight: 12.1, trunkRadius: 0.40, canopyRadius: 2.1, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999335, lat: 37.7995166, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.38, canopyRadius: 2.5, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999468, lat: 37.7996387, height: 0 }, trunkHeight: 9.3, trunkRadius: 0.35, canopyRadius: 2.3, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999351, lat: 37.8003632, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.40, canopyRadius: 2.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3999370, lat: 37.8004845, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.37, canopyRadius: 2.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.3999298, lat: 37.8006243, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.41, canopyRadius: 1.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3998782, lat: 37.7995130, height: 0 }, trunkHeight: 11.9, trunkRadius: 0.38, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3998774, lat: 37.7996160, height: 0 }, trunkHeight: 13.0, trunkRadius: 0.39, canopyRadius: 2.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3998670, lat: 37.7997103, height: 0 }, trunkHeight: 12.5, trunkRadius: 0.44, canopyRadius: 1.9, variant: "cypress" },
    { type: "tree", position: { lon: -122.3998634, lat: 37.7998656, height: 0 }, trunkHeight: 8.1, trunkRadius: 0.42, canopyRadius: 2.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3998592, lat: 37.7999882, height: 0 }, trunkHeight: 12.9, trunkRadius: 0.50, canopyRadius: 2.6, variant: "cypress" },
    { type: "tree", position: { lon: -122.3998818, lat: 37.8000813, height: 0 }, trunkHeight: 10.9, trunkRadius: 0.48, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3998764, lat: 37.8002024, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.48, canopyRadius: 2.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.3998394, lat: 37.8003665, height: 0 }, trunkHeight: 9.9, trunkRadius: 0.37, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3997676, lat: 37.7994021, height: 0 }, trunkHeight: 9.1, trunkRadius: 0.50, canopyRadius: 2.6, variant: "pine" },
    { type: "tree", position: { lon: -122.3997693, lat: 37.7995471, height: 0 }, trunkHeight: 10.8, trunkRadius: 0.44, canopyRadius: 2.2, variant: "cypress" },
    { type: "tree", position: { lon: -122.3997232, lat: 37.7997527, height: 0 }, trunkHeight: 10.1, trunkRadius: 0.44, canopyRadius: 2.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3997737, lat: 37.7998935, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.42, canopyRadius: 2.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3997865, lat: 37.7999912, height: 0 }, trunkHeight: 10.0, trunkRadius: 0.43, canopyRadius: 2.5, variant: "oak" },
    { type: "tree", position: { lon: -122.3997779, lat: 37.8002365, height: 0 }, trunkHeight: 9.0, trunkRadius: 0.43, canopyRadius: 2.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3996608, lat: 37.7995419, height: 0 }, trunkHeight: 8.1, trunkRadius: 0.42, canopyRadius: 2.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3996223, lat: 37.7999995, height: 0 }, trunkHeight: 12.2, trunkRadius: 0.41, canopyRadius: 2.0, variant: "pine" },
    { type: "tree", position: { lon: -122.3996609, lat: 37.8002686, height: 0 }, trunkHeight: 8.9, trunkRadius: 0.40, canopyRadius: 2.4, variant: "oak" },
    { type: "tree", position: { lon: -122.3995851, lat: 37.8003966, height: 0 }, trunkHeight: 10.5, trunkRadius: 0.38, canopyRadius: 2.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3994838, lat: 37.7994179, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.39, canopyRadius: 2.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3995417, lat: 37.7998743, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.44, canopyRadius: 2.4, variant: "cypress" },
    { type: "tree", position: { lon: -122.3995406, lat: 37.8000980, height: 0 }, trunkHeight: 13.0, trunkRadius: 0.39, canopyRadius: 2.4, variant: "oak" },
    { type: "tree", position: { lon: -122.3994598, lat: 37.8004749, height: 0 }, trunkHeight: 10.7, trunkRadius: 0.42, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3993859, lat: 37.7995577, height: 0 }, trunkHeight: 11.9, trunkRadius: 0.38, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3993569, lat: 37.7996470, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.40, canopyRadius: 2.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3993469, lat: 37.7997398, height: 0 }, trunkHeight: 11.5, trunkRadius: 0.41, canopyRadius: 1.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3993881, lat: 37.7998512, height: 0 }, trunkHeight: 10.2, trunkRadius: 0.43, canopyRadius: 2.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3993753, lat: 37.8000329, height: 0 }, trunkHeight: 8.9, trunkRadius: 0.45, canopyRadius: 1.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3993325, lat: 37.8003299, height: 0 }, trunkHeight: 11.3, trunkRadius: 0.46, canopyRadius: 2.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3992785, lat: 37.7994329, height: 0 }, trunkHeight: 12.5, trunkRadius: 0.41, canopyRadius: 2.5, variant: "cypress" },
    { type: "tree", position: { lon: -122.3992219, lat: 37.7996503, height: 0 }, trunkHeight: 11.7, trunkRadius: 0.42, canopyRadius: 2.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3992219, lat: 37.7997263, height: 0 }, trunkHeight: 11.1, trunkRadius: 0.43, canopyRadius: 2.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3993040, lat: 37.7998608, height: 0 }, trunkHeight: 10.8, trunkRadius: 0.44, canopyRadius: 2.6, variant: "oak" },
    { type: "tree", position: { lon: -122.3993006, lat: 37.8000182, height: 0 }, trunkHeight: 9.0, trunkRadius: 0.45, canopyRadius: 1.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3992762, lat: 37.8002031, height: 0 }, trunkHeight: 8.4, trunkRadius: 0.46, canopyRadius: 2.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3992869, lat: 37.8003484, height: 0 }, trunkHeight: 12.0, trunkRadius: 0.44, canopyRadius: 2.1, variant: "pine" },
    { type: "tree", position: { lon: -122.3991657, lat: 37.7994283, height: 0 }, trunkHeight: 9.4, trunkRadius: 0.57, canopyRadius: 3.9, variant: "pine" },
    { type: "tree", position: { lon: -122.3990979, lat: 37.7995594, height: 0 }, trunkHeight: 9.5, trunkRadius: 0.51, canopyRadius: 4.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3991311, lat: 37.7996013, height: 0 }, trunkHeight: 12.7, trunkRadius: 0.47, canopyRadius: 3.6, variant: "pine" },
    { type: "tree", position: { lon: -122.3991027, lat: 37.7997151, height: 0 }, trunkHeight: 11.1, trunkRadius: 0.48, canopyRadius: 4.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3991019, lat: 37.8001580, height: 0 }, trunkHeight: 10.1, trunkRadius: 0.59, canopyRadius: 4.6, variant: "pine" },
    { type: "tree", position: { lon: -122.3991534, lat: 37.8002744, height: 0 }, trunkHeight: 8.8, trunkRadius: 0.42, canopyRadius: 4.7, variant: "cypress" },
    { type: "tree", position: { lon: -122.3991829, lat: 37.8005086, height: 0 }, trunkHeight: 11.0, trunkRadius: 0.53, canopyRadius: 3.8, variant: "pine" },
    { type: "tree", position: { lon: -122.3990651, lat: 37.7993950, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.51, canopyRadius: 4.4, variant: "oak" },
    { type: "tree", position: { lon: -122.3990305, lat: 37.7996709, height: 0 }, trunkHeight: 10.3, trunkRadius: 0.58, canopyRadius: 4.1, variant: "pine" },
    { type: "tree", position: { lon: -122.3990132, lat: 37.7997811, height: 0 }, trunkHeight: 11.9, trunkRadius: 0.54, canopyRadius: 4.4, variant: "oak" },
    { type: "tree", position: { lon: -122.3990069, lat: 37.8000261, height: 0 }, trunkHeight: 10.2, trunkRadius: 0.45, canopyRadius: 3.9, variant: "oak" },
    { type: "tree", position: { lon: -122.3990374, lat: 37.8001639, height: 0 }, trunkHeight: 9.7, trunkRadius: 0.55, canopyRadius: 4.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3989748, lat: 37.8002821, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.44, canopyRadius: 4.1, variant: "oak" },
    { type: "tree", position: { lon: -122.3988773, lat: 37.7994448, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.42, canopyRadius: 4.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3989048, lat: 37.7995030, height: 0 }, trunkHeight: 11.2, trunkRadius: 0.56, canopyRadius: 5.4, variant: "pine" },
    { type: "tree", position: { lon: -122.3988558, lat: 37.7999124, height: 0 }, trunkHeight: 8.5, trunkRadius: 0.44, canopyRadius: 5.3, variant: "oak" },
    { type: "tree", position: { lon: -122.3989462, lat: 37.8000117, height: 0 }, trunkHeight: 9.6, trunkRadius: 0.53, canopyRadius: 4.7, variant: "oak" },
    { type: "tree", position: { lon: -122.3988876, lat: 37.8001064, height: 0 }, trunkHeight: 12.4, trunkRadius: 0.59, canopyRadius: 5.0, variant: "oak" },
    { type: "tree", position: { lon: -122.3989063, lat: 37.8002138, height: 0 }, trunkHeight: 11.4, trunkRadius: 0.44, canopyRadius: 4.8, variant: "oak" },
    { type: "tree", position: { lon: -122.3988827, lat: 37.8004907, height: 0 }, trunkHeight: 8.8, trunkRadius: 0.50, canopyRadius: 4.3, variant: "pine" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000227, lat: BASE_LAT + 0.000271, height: H + 2 }, length: 6, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000546, lat: BASE_LAT + 0.000271, height: H + 2.5 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000773, lat: BASE_LAT + 0.000136, height: H + 2 }, length: 6, topRadius: 3 },
  ],
};
