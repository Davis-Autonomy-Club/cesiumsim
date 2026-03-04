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

    // Tree cluster 1: base to WP1
    { type: "tree", position: { lon: BASE_LON + 0.000136, lat: BASE_LAT + 0.000109, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000204, lat: BASE_LAT + 0.000163, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000250, lat: BASE_LAT + 0.000090, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000170, lat: BASE_LAT + 0.000226, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000284, lat: BASE_LAT + 0.000199, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },

    // Tree cluster 2: flanking WP1
    { type: "tree", position: { lon: BASE_LON + 0.000318, lat: BASE_LAT + 0.000379, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000477, lat: BASE_LAT + 0.000253, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000511, lat: BASE_LAT + 0.000379, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },

    // Tree cluster 3: between WP1 and WP2
    { type: "tree", position: { lon: BASE_LON + 0.000591, lat: BASE_LAT + 0.000289, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000659, lat: BASE_LAT + 0.000226, height: H }, trunkHeight: 10, trunkRadius: 0.45, canopyRadius: 4.5, variant: "oak" },
    { type: "tree", position: { lon: BASE_LON + 0.000705, lat: BASE_LAT + 0.000316, height: H }, trunkHeight: 9, trunkRadius: 0.4, canopyRadius: 4, variant: "cypress" },
    { type: "tree", position: { lon: BASE_LON + 0.000625, lat: BASE_LAT + 0.000163, height: H }, trunkHeight: 11, trunkRadius: 0.5, canopyRadius: 5, variant: "pine" },
    { type: "tree", position: { lon: BASE_LON + 0.000739, lat: BASE_LAT + 0.000253, height: H }, trunkHeight: 12, trunkRadius: 0.55, canopyRadius: 5.5, variant: "oak" },

    // Boulders
    { type: "cylinder", position: { lon: BASE_LON + 0.000227, lat: BASE_LAT + 0.000271, height: H + 2 }, length: 6, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000546, lat: BASE_LAT + 0.000271, height: H + 2.5 }, length: 7, topRadius: 3.5 },
    { type: "cylinder", position: { lon: BASE_LON + 0.000773, lat: BASE_LAT + 0.000136, height: H + 2 }, length: 6, topRadius: 3 },
  ],
};
