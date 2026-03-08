import type { Waypoint } from "./playgrounds/types";

export interface AutopilotRoute {
  waypoints?: readonly Waypoint[];
}

export type AutopilotInput = {
  forward: number;
  strafe: number;
  vertical: number;
  yaw: number;
};

export type AutopilotState = {
  currentWaypointIndex: number;
  waypoints: readonly Waypoint[];
  reached: boolean;
};

export function createAutopilot(route: AutopilotRoute) {
  const waypoints = route.waypoints ?? [];
  let currentWaypointIndex = 0;

  return {
    getState(): AutopilotState {
      return {
        currentWaypointIndex,
        waypoints,
        reached: currentWaypointIndex >= waypoints.length,
      };
    },

    computeInput(
      droneLon: number,
      droneLat: number,
      droneHeight: number,
      droneHeading: number,
    ): AutopilotInput {
      if (currentWaypointIndex >= waypoints.length) {
        return { forward: 0, strafe: 0, vertical: 0, yaw: 0 };
      }

      const waypoint = waypoints[currentWaypointIndex];
      const targetLon = waypoint.position.lon;
      const targetLat = waypoint.position.lat;
      const targetHeight = waypoint.position.height;

      const dLon =
        (targetLon - droneLon) *
        111_320 *
        Math.cos((droneLat * Math.PI) / 180);
      const dLat = (targetLat - droneLat) * 110_540;
      const dHeight = targetHeight - droneHeight;

      const horizontalDistance = Math.sqrt(dLon * dLon + dLat * dLat);
      const toTargetHeading = Math.atan2(dLon, dLat);
      let headingError = toTargetHeading - droneHeading;
      while (headingError > Math.PI) {
        headingError -= 2 * Math.PI;
      }
      while (headingError < -Math.PI) {
        headingError += 2 * Math.PI;
      }

      if (
        horizontalDistance < waypoint.radius &&
        Math.abs(dHeight) < waypoint.radius
      ) {
        currentWaypointIndex += 1;
        return this.computeInput(
          droneLon,
          droneLat,
          droneHeight,
          droneHeading,
        );
      }

      const forward = Math.cos(headingError) > 0.3 ? 1 : 0;
      const strafe =
        Math.abs(headingError) > 0.3 ? (headingError > 0 ? 1 : -1) : 0;
      const yaw =
        Math.abs(headingError) > 0.2 ? (headingError > 0 ? 1 : -1) : 0;
      const vertical = dHeight > 5 ? 1 : dHeight < -5 ? -1 : 0;

      return { forward, strafe, vertical, yaw };
    },
  };
}
