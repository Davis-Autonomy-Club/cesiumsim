import type { Playground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const BASE_HEIGHT = 50;

export const mazePlayground: Playground = {
  id: "maze",
  name: "Maze",
  spawn: {
    longitude: BASE_LON,
    latitude: BASE_LAT,
    height: BASE_HEIGHT + 20,
  },
  terrain: "flat",
  obstacles: [
    { type: "box", position: { lon: BASE_LON + 0.0005, lat: BASE_LAT + 0.0003, height: BASE_HEIGHT + 10 }, dimensions: { length: 80, width: 10, height: 20 }, heading: 0 },
    { type: "box", position: { lon: BASE_LON + 0.0005, lat: BASE_LAT - 0.0003, height: BASE_HEIGHT + 10 }, dimensions: { length: 80, width: 10, height: 20 }, heading: 0 },
    { type: "box", position: { lon: BASE_LON + 0.0015, lat: BASE_LAT, height: BASE_HEIGHT + 10 }, dimensions: { length: 60, width: 10, height: 20 }, heading: 90 },
    { type: "box", position: { lon: BASE_LON + 0.0025, lat: BASE_LAT + 0.0003, height: BASE_HEIGHT + 10 }, dimensions: { length: 50, width: 10, height: 20 }, heading: 0 },
    { type: "box", position: { lon: BASE_LON + 0.0025, lat: BASE_LAT - 0.0003, height: BASE_HEIGHT + 10 }, dimensions: { length: 50, width: 10, height: 20 }, heading: 0 },
    { type: "box", position: { lon: BASE_LON + 0.0035, lat: BASE_LAT, height: BASE_HEIGHT + 10 }, dimensions: { length: 40, width: 10, height: 20 }, heading: 90 },
  ],
  waypoints: [
    { id: "start", position: { lon: BASE_LON, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
    { id: "mid", position: { lon: BASE_LON + 0.002, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
    { id: "end", position: { lon: BASE_LON + 0.004, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 15 },
  ],
  timeLimit: 120,
};
