import type { Playground } from "../types";

const BASE_LON = -122.4;
const BASE_LAT = 37.8;
const BASE_HEIGHT = 50;

export const ringCoursePlayground: Playground = {
  id: "ring-course",
  name: "Ring Course",
  spawn: {
    longitude: BASE_LON,
    latitude: BASE_LAT,
    height: BASE_HEIGHT + 20,
  },
  terrain: "flat",
  obstacles: [
    { type: "ring", position: { lon: BASE_LON + 0.001, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, innerRadius: 8, outerRadius: 12 },
    { type: "ring", position: { lon: BASE_LON + 0.002, lat: BASE_LAT + 0.0003, height: BASE_HEIGHT + 35 }, innerRadius: 8, outerRadius: 12 },
    { type: "ring", position: { lon: BASE_LON + 0.003, lat: BASE_LAT, height: BASE_HEIGHT + 45 }, innerRadius: 8, outerRadius: 12 },
    { type: "ring", position: { lon: BASE_LON + 0.004, lat: BASE_LAT - 0.0003, height: BASE_HEIGHT + 35 }, innerRadius: 8, outerRadius: 12 },
    { type: "ring", position: { lon: BASE_LON + 0.005, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, innerRadius: 8, outerRadius: 12 },
  ],
  waypoints: [
    { id: "ring1", position: { lon: BASE_LON + 0.001, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 10 },
    { id: "ring2", position: { lon: BASE_LON + 0.002, lat: BASE_LAT + 0.0003, height: BASE_HEIGHT + 35 }, radius: 10 },
    { id: "ring3", position: { lon: BASE_LON + 0.003, lat: BASE_LAT, height: BASE_HEIGHT + 45 }, radius: 10 },
    { id: "ring4", position: { lon: BASE_LON + 0.004, lat: BASE_LAT - 0.0003, height: BASE_HEIGHT + 35 }, radius: 10 },
    { id: "ring5", position: { lon: BASE_LON + 0.005, lat: BASE_LAT, height: BASE_HEIGHT + 25 }, radius: 10 },
  ],
  timeLimit: 90,
};
