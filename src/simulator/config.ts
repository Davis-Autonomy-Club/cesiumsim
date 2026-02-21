export const DEFAULT_CESIUM_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjMmFjOWQwNy1lYTA5LTRmZWUtODNkOS1jYTAyNWM0OGVkMmMiLCJpZCI6Mzc3Mzg3LCJpYXQiOjE3NjgxNzAyNDN9.rAi0BHXk9BUPEfYxockPHQxu9qvCJ8ifJS0duz7HUl0";

export const DEFAULT_GOOGLE_MAPS_API_KEY =
  "AIzaSyDZoPrWVs0BJHxIYSA0-ijn15jN9P1y2M4";

export const GEMINI_API_KEY = "AIzaSyDQdSe1QCJwz7PyyuvMxsHNOOHaVQb4Ako";

export const START_LOCATION = {
  longitude: -122.3933,
  latitude: 37.7937,
  height: 190.0,
};

export const UCD_LOCATION = {
  longitude: -121.7617,
  latitude: 38.5382,
  height: 200.0,
};

export const FLIGHT = {
  horizontalAcceleration: 22.0,
  maxHorizontalSpeed: 20.0,
  horizontalDrag: 6.0,
  verticalAcceleration: 14.0,
  maxVerticalSpeed: 10.0,
  verticalDrag: 5.0,
  yawRate: Cesium.Math.toRadians(90.0),
  maxVisualPitch: Cesium.Math.toRadians(25.0),
  maxVisualRoll: Cesium.Math.toRadians(15.0),
  visualTiltRate: 5.0,
  visualTiltReturn: 6.0,
  minimumClearance: 2.0,
  cameraForwardOffset: -18.0,
  cameraUpOffset: 6.0,
  cameraLookAboveOffset: 6.0,
};

export const BUILDING_COLLISION = {
  enabled: true,
  activationAltitudeAGL: 500,
  minimumClearance: 6.0,
  forwardCheckDistance: 80,
  wallStopDistance: 5,
  deflectionStrength: 1,
  pushbackDistance: 3.0,
};

export const CHASE_FOV = Cesium.Math.toRadians(119.6);
export const FPV_FOV = Cesium.Math.toRadians(140.0);
export const FPV_PITCH_DOWN = Cesium.Math.toRadians(-45.0);

export const CAMERA_CHASE = 0;
export const CAMERA_FPV = 1;

export const SPEED_TIERS = [1, 3, 5, 10];

export const KEY_BLOCKLIST = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "KeyC",
  "KeyV",
]);

export const GEMINI_PILOT_PROMPT = `You are piloting an FPV drone in a 3D city simulator. You see the live camera feed.

Your mission: fly between buildings without hitting them. Navigate through streets and gaps.

You control the drone by outputting a sequence of movement commands. Each command is:
DIRECTION-SPEED-TIME

DIRECTION: FORWARD, BACKWARD, LEFT, RIGHT, UP, DOWN
SPEED: speed multiplier (integer). 10 is slow/careful, 30 is moderate, 60 is fast, 100 is very fast. Use lower speeds near buildings.
TIME: duration in seconds (1-5)

You can chain multiple commands, one per line. Example:
FORWARD-30-3
LEFT-20-2
FORWARD-50-4
UP-15-1

Rules:
- Look at the video feed and decide where to go next
- If buildings are close, slow down and steer around them
- Prefer flying forward through open spaces between buildings
- If you're about to hit something, go UP or turn LEFT/RIGHT
- Output ONLY the commands, nothing else. No explanation. 3-6 commands per response.`;

export const DIRECTION_KEYS: Record<string, string> = {
  FORWARD: "ArrowUp",
  BACKWARD: "ArrowDown",
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  UP: "KeyW",
  DOWN: "KeyS",
};
