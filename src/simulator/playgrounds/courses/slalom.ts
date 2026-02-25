import type { Playground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const BASE_HEIGHT = 50;

export const slalomPlayground: Playground = {
  id: "slalom",
  name: "Slalom",
  spawn: {
    longitude: BASE_LON,
    latitude: BASE_LAT,
    height: BASE_HEIGHT + 20,
  },
  terrain: "flat",
  obstacles: [
    { type: "cylinder", position: { lon: BASE_LON + 0.001, lat: BASE_LAT, height: BASE_HEIGHT }, length: 15, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.002, lat: BASE_LAT + 0.0005, height: BASE_HEIGHT }, length: 15, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.003, lat: BASE_LAT, height: BASE_HEIGHT }, length: 15, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.004, lat: BASE_LAT - 0.0005, height: BASE_HEIGHT }, length: 15, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.005, lat: BASE_LAT, height: BASE_HEIGHT }, length: 15, topRadius: 3 },
    { type: "cylinder", position: { lon: BASE_LON + 0.006, lat: BASE_LAT + 0.0005, height: BASE_HEIGHT }, length: 15, topRadius: 3 },
  ],
  waypoints: [
    { id: "wp1", position: { lon: BASE_LON + 0.001, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
    { id: "wp2", position: { lon: BASE_LON + 0.003, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
    { id: "wp3", position: { lon: BASE_LON + 0.005, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
    { id: "wp4", position: { lon: BASE_LON + 0.007, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
  ],
  timeLimit: 120,
};
