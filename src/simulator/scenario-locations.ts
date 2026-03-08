export interface ScenarioLocation {
  longitude: number;
  latitude: number;
  height: number;
}

export const START_LOCATION: ScenarioLocation = {
  longitude: -122.3933,
  latitude: 37.7937,
  height: 190.0,
};

export const UCD_LOCATION: ScenarioLocation = {
  longitude: -121.7617,
  latitude: 38.5382,
  height: 200.0,
};

export const BEU_FIRE_PERIMETER_LOCATION: ScenarioLocation = {
  longitude: -121.419,
  latitude: 36.1456,
  height: 0,
};

export const AIRLINE_FIRE_LOCATION: ScenarioLocation = {
  longitude: -121.20523,
  latitude: 36.67424,
  height: 393.2,
};
