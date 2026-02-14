import { initGeospatialOverlay, updateGeospatialOverlay, getCloudImmersionState, CLOUD_BAND_CORE_BOTTOM } from './geospatial-overlay.js';
import { initCreativeMode, isCreativeModeActive, enterCreativeMode, exitCreativeMode, updateCreativeMode, getFreeCamReadout, setHighlightVisible } from './creative-mode/creative-mode.js';

(function main() {
  const DEFAULT_CESIUM_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjMmFjOWQwNy1lYTA5LTRmZWUtODNkOS1jYTAyNWM0OGVkMmMiLCJpZCI6Mzc3Mzg3LCJpYXQiOjE3NjgxNzAyNDN9.rAi0BHXk9BUPEfYxockPHQxu9qvCJ8ifJS0duz7HUl0";
  const DEFAULT_GOOGLE_MAPS_API_KEY =
    "AIzaSyDZoPrWVs0BJHxIYSA0-ijn15jN9P1y2M4";

  const START_LOCATION = {
    longitude: -122.3933,
    latitude: 37.7937,
    height: 190.0,
  };

  const UCD_LOCATION = {
    longitude: -121.7617,
    latitude: 38.5382,
    height: 200.0,
  };

  const FLIGHT = {
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

  /* ─── Building collision configuration ─── */
  const BUILDING_COLLISION = {
    enabled: true,
    activationAltitudeAGL: 500,   // only check below this AGL altitude (meters)
    minimumClearance: 6.0,         // min distance above building rooftops (meters)
    forwardCheckDistance: 80,      // forward ray check distance (meters)
    wallStopDistance: 5,          // full stop when wall is this close (meters)
    deflectionStrength: 1,      // velocity kill factor at closest range (0-1)
    pushbackDistance: 3.0,         // meters to push back from wall on hard collision
  };

  const HUD = {
    speed: document.getElementById("hud-speed"),
    altitudeAgl: document.getElementById("hud-altitude-agl"),
    altitudeMsl: document.getElementById("hud-altitude-msl"),
    heading: document.getElementById("hud-heading"),
    attitude: document.getElementById("hud-attitude"),
    position: document.getElementById("hud-position"),
    buildingCol: document.getElementById("hud-building-col"),
    datasetStatus: document.getElementById("dataset-status"),
    flightStatus: document.getElementById("flight-status"),
  };

  if (!window.Cesium) {
    HUD.datasetStatus.textContent = "Cesium failed to load. Refresh and try again.";
    HUD.flightStatus.textContent = "Startup aborted.";
    return;
  }

  const KEY_BLOCKLIST = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyS",
    "KeyA",
    "KeyD",
    "KeyC",
    "KeyG",
    "KeyQ",
    "KeyE",
  ]);

  const query = new URLSearchParams(window.location.search);
  const configuredCesiumToken =
    query.get("cesiumToken") ||
    window.localStorage.getItem("cesiumToken") ||
    DEFAULT_CESIUM_TOKEN;
  const configuredGoogleApiKey =
    query.get("googleApiKey") ||
    window.localStorage.getItem("googleApiKey") ||
    DEFAULT_GOOGLE_MAPS_API_KEY;

  if (query.has("cesiumToken")) {
    window.localStorage.setItem("cesiumToken", query.get("cesiumToken"));
  }
  if (query.has("googleApiKey")) {
    window.localStorage.setItem("googleApiKey", query.get("googleApiKey"));
  }

  Cesium.Ion.defaultAccessToken = configuredCesiumToken;
  if (configuredGoogleApiKey && Cesium.GoogleMaps) {
    Cesium.GoogleMaps.defaultApiKey = configuredGoogleApiKey;
  }

  const drone = {
    position: Cesium.Cartesian3.fromDegrees(
      START_LOCATION.longitude,
      START_LOCATION.latitude,
      START_LOCATION.height,
    ),
    horizontalVelocity: new Cesium.Cartesian3(0.0, 0.0, 0.0),
    verticalSpeed: 0.0,
    heading: Cesium.Math.toRadians(200.0),
    visualPitch: 0.0,
    visualRoll: 0.0,
    orientation: new Cesium.Quaternion(0, 0, 0, 1),
    lastGroundHeight: 0.0,
  };

  const scratch = {
    hpr: new Cesium.HeadingPitchRoll(),
    transform: new Cesium.Matrix4(),
    forward: new Cesium.Cartesian3(),
    right: new Cesium.Cartesian3(),
    up: new Cesium.Cartesian3(),
    horizontalForward: new Cesium.Cartesian3(),
    horizontalRight: new Cesium.Cartesian3(),
    verticalStep: new Cesium.Cartesian3(),
    acceleration: new Cesium.Cartesian3(),
    velocityStep: new Cesium.Cartesian3(),
    movementStep: new Cesium.Cartesian3(),
    cameraOffset: new Cesium.Cartesian3(),
    cameraPosition: new Cesium.Cartesian3(),
    upOffset: new Cesium.Cartesian3(),
    cartographic: new Cesium.Cartographic(),
    surfaceNormal: new Cesium.Cartesian3(),
    // Building collision scratch
    buildingRayDirection: new Cesium.Cartesian3(),
    buildingCartographic: new Cesium.Cartographic(),
  };

  const keyState = new Set();
  let viewer = null;
  let lastTime = performance.now();

  /* ─── Drone Cesium entity state ─── */
  const droneHpr = new Cesium.HeadingPitchRoll();
  const droneModelOrientation = new Cesium.Quaternion();
  let droneEntity = null;

  /* ─── Camera mode ─── */
  const CAMERA_CHASE = 0;
  const CAMERA_FPV = 1;
  let cameraMode = CAMERA_CHASE;
  const CHASE_FOV = Cesium.Math.toRadians(119.6);
  const FPV_FOV = Cesium.Math.toRadians(140.0);
  const FPV_PITCH_DOWN = Cesium.Math.toRadians(-45.0);
  let fpvOverlay = null;
  let fpvHudAlt = null;
  let fpvHudSpd = null;

  /* ─── Dynamic resolution scaling ─── */
  const DRS = {
    frameTimeSum: 0,
    frameCount: 0,
    evalInterval: 30,         // evaluate every N frames
    targetLowMs: 14,          // above ~70 fps → scale up
    targetHighMs: 20,         // below ~50 fps → scale down
    minScale: 0.6,
    maxScale: 1.0,
    currentScale: 1.0,
    stepDown: 0.05,
    stepUp: 0.02,
  };

  function updateDynamicResolution(dt) {
    if (!viewer) return;
    DRS.frameTimeSum += dt;
    DRS.frameCount++;
    if (DRS.frameCount >= DRS.evalInterval) {
      const avgMs = (DRS.frameTimeSum / DRS.frameCount) * 1000;
      if (avgMs > DRS.targetHighMs && DRS.currentScale > DRS.minScale) {
        DRS.currentScale = Math.max(DRS.minScale, DRS.currentScale - DRS.stepDown);
      } else if (avgMs < DRS.targetLowMs && DRS.currentScale < DRS.maxScale) {
        DRS.currentScale = Math.min(DRS.maxScale, DRS.currentScale + DRS.stepUp);
      }
      viewer.resolutionScale = DRS.currentScale * (window.devicePixelRatio || 1.0);
      DRS.frameTimeSum = 0;
      DRS.frameCount = 0;
    }
  }

  /* ─── Building collision state ─── */
  let buildingCollisionActive = false;   // true when below activation altitude
  let lastBuildingHitDistance = Infinity; // distance to nearest forward obstacle

  /* ─── Cloud immersion state ─── */
  let cloudFogOverlay = null;
  let currentCloudImmersion = 0; // smoothed 0..1
  let currentCesiumFade = 1.0;   // smoothed terrain visibility (0=hidden, 1=visible)
  let googleTilesRef = null;      // reference to 3D tileset primitive
  let osmBuildingsRef = null;     // reference to OSM buildings primitive

  /* ─── Speed multiplier ─── */
  const SPEED_TIERS = [1, 3, 5, 10, 20];
  let speedTierIndex = 0;
  let speedMultiplier = SPEED_TIERS[0];

  function setSpeedTier(index) {
    speedTierIndex = Math.max(0, Math.min(index, SPEED_TIERS.length - 1));
    speedMultiplier = SPEED_TIERS[speedTierIndex];
    updateSpeedTierHUD();
  }

  function updateSpeedTierHUD() {
    const el = document.getElementById("hud-speed-tier");
    if (el) {
      el.textContent = `${speedMultiplier}x`;
    }
    // Update button states
    SPEED_TIERS.forEach((tier, i) => {
      const btn = document.getElementById(`speed-btn-${tier}`);
      if (btn) {
        btn.classList.toggle("active", i === speedTierIndex);
      }
    });
  }

  function setFlightStatus(text, isWarning) {
    HUD.flightStatus.textContent = text;
    HUD.flightStatus.style.color = isWarning ? "#ffd36f" : "#d9ecff";
  }

  function isDown(code) {
    return keyState.has(code);
  }

  function updateDroneOrientation() {
    scratch.hpr.heading = drone.heading;
    scratch.hpr.pitch = drone.visualPitch;
    scratch.hpr.roll = drone.visualRoll;

    Cesium.Transforms.headingPitchRollQuaternion(
      drone.position,
      scratch.hpr,
      Cesium.Ellipsoid.WGS84,
      Cesium.Transforms.eastNorthUpToFixedFrame,
      drone.orientation,
    );
  }

  function updateWorldAxes() {
    // Compute ENU-to-ECEF matrix (position only, no HPR rotation baked in)
    Cesium.Transforms.eastNorthUpToFixedFrame(
      drone.position,
      Cesium.Ellipsoid.WGS84,
      scratch.transform,
    );

    const ch = Math.cos(drone.heading), sh = Math.sin(drone.heading);
    const cp = Math.cos(drone.visualPitch), sp = Math.sin(drone.visualPitch);
    const cr = Math.cos(drone.visualRoll), sr = Math.sin(drone.visualRoll);

    // Forward (nose direction) in ENU — visual only
    scratch.acceleration.x = sh * cp;
    scratch.acceleration.y = ch * cp;
    scratch.acceleration.z = sp;
    Cesium.Matrix4.multiplyByPointAsVector(scratch.transform, scratch.acceleration, scratch.forward);
    Cesium.Cartesian3.normalize(scratch.forward, scratch.forward);

    // Right and Up before roll (in ENU)
    const ux = -sh * sp, uy = -ch * sp, uz = cp;
    const rx = ch, ry = -sh, rz = 0;

    // Apply roll rotation around the forward axis
    scratch.acceleration.x = cr * rx - sr * ux;
    scratch.acceleration.y = cr * ry - sr * uy;
    scratch.acceleration.z = cr * rz - sr * uz;
    Cesium.Matrix4.multiplyByPointAsVector(scratch.transform, scratch.acceleration, scratch.right);
    Cesium.Cartesian3.normalize(scratch.right, scratch.right);

    scratch.acceleration.x = cr * ux + sr * rx;
    scratch.acceleration.y = cr * uy + sr * ry;
    scratch.acceleration.z = cr * uz + sr * rz;
    Cesium.Matrix4.multiplyByPointAsVector(scratch.transform, scratch.acceleration, scratch.up);
    Cesium.Cartesian3.normalize(scratch.up, scratch.up);
  }

  function updateHorizontalAxes() {
    // Heading-only forward/right in ECEF (no pitch — used for movement and camera)
    Cesium.Transforms.eastNorthUpToFixedFrame(
      drone.position,
      Cesium.Ellipsoid.WGS84,
      scratch.transform,
    );
    const ch = Math.cos(drone.heading), sh = Math.sin(drone.heading);
    // Forward in ENU: heading only, no pitch
    scratch.acceleration.x = sh;
    scratch.acceleration.y = ch;
    scratch.acceleration.z = 0.0;
    Cesium.Matrix4.multiplyByPointAsVector(scratch.transform, scratch.acceleration, scratch.horizontalForward);
    Cesium.Cartesian3.normalize(scratch.horizontalForward, scratch.horizontalForward);
    // Right in ENU
    scratch.acceleration.x = ch;
    scratch.acceleration.y = -sh;
    scratch.acceleration.z = 0.0;
    Cesium.Matrix4.multiplyByPointAsVector(scratch.transform, scratch.acceleration, scratch.horizontalRight);
    Cesium.Cartesian3.normalize(scratch.horizontalRight, scratch.horizontalRight);
  }

  function applyOrientationInput(dt) {
    // Left/Right arrows: pure yaw (heading rotation only, no visual effect)
    const turnInput = (isDown("ArrowRight") ? 1 : 0) - (isDown("ArrowLeft") ? 1 : 0);
    drone.heading += turnInput * FLIGHT.yawRate * dt;
    drone.heading = Cesium.Math.zeroToTwoPi(drone.heading);

    // Up/Down arrows: forward/backward movement input (drives visual pitch)
    const moveInput = (isDown("ArrowUp") ? 1 : 0) - (isDown("ArrowDown") ? 1 : 0);

    // A/D keys: lateral strafe input (drives visual roll)
    const strafeInput = (isDown("KeyD") ? 1 : 0) - (isDown("KeyA") ? 1 : 0);

    // Target visual pitch: forward (ArrowUp) → nose down (negative pitch)
    const targetPitch = -moveInput * FLIGHT.maxVisualPitch;
    // Target visual roll: strafe right (D) → tilt right (positive roll)
    const targetRoll = strafeInput * FLIGHT.maxVisualRoll;

    // Exponential lerp toward targets
    const tiltAlpha = 1.0 - Math.exp(-FLIGHT.visualTiltRate * dt);
    const returnAlpha = 1.0 - Math.exp(-FLIGHT.visualTiltReturn * dt);

    const pitchAlpha = moveInput !== 0 ? tiltAlpha : returnAlpha;
    const rollAlpha = strafeInput !== 0 ? tiltAlpha : returnAlpha;

    drone.visualPitch = Cesium.Math.lerp(drone.visualPitch, targetPitch, pitchAlpha);
    drone.visualRoll = Cesium.Math.lerp(drone.visualRoll, targetRoll, rollAlpha);

    drone.visualPitch = Cesium.Math.clamp(drone.visualPitch, -FLIGHT.maxVisualPitch, FLIGHT.maxVisualPitch);
    drone.visualRoll = Cesium.Math.clamp(drone.visualRoll, -FLIGHT.maxVisualRoll, FLIGHT.maxVisualRoll);
  }

  function applyDroneMovement(dt) {
    const sm = speedMultiplier;

    // ── Horizontal channel: Up/Down arrows → forward/back, A/D → strafe ──
    const moveInput = (isDown("ArrowUp") ? 1 : 0) - (isDown("ArrowDown") ? 1 : 0);
    const strafeInput = (isDown("KeyD") ? 1 : 0) - (isDown("KeyA") ? 1 : 0);

    if (moveInput !== 0) {
      Cesium.Cartesian3.multiplyByScalar(
        scratch.horizontalForward,
        moveInput * FLIGHT.horizontalAcceleration * sm * dt,
        scratch.velocityStep,
      );
      Cesium.Cartesian3.add(drone.horizontalVelocity, scratch.velocityStep, drone.horizontalVelocity);
    }

    if (strafeInput !== 0) {
      Cesium.Cartesian3.multiplyByScalar(
        scratch.horizontalRight,
        strafeInput * FLIGHT.horizontalAcceleration * sm * dt,
        scratch.velocityStep,
      );
      Cesium.Cartesian3.add(drone.horizontalVelocity, scratch.velocityStep, drone.horizontalVelocity);
    }

    // Horizontal drag (exponential)
    const hDrag = Math.exp(-FLIGHT.horizontalDrag * dt);
    Cesium.Cartesian3.multiplyByScalar(drone.horizontalVelocity, hDrag, drone.horizontalVelocity);

    // Clamp horizontal speed
    const effectiveMaxH = FLIGHT.maxHorizontalSpeed * sm;
    const hSpeed = Cesium.Cartesian3.magnitude(drone.horizontalVelocity);
    if (hSpeed > effectiveMaxH) {
      Cesium.Cartesian3.multiplyByScalar(
        drone.horizontalVelocity,
        effectiveMaxH / hSpeed,
        drone.horizontalVelocity,
      );
    }

    // ── Vertical channel: W/S → thrust along surface normal ──
    const vertInput = (isDown("KeyW") ? 1 : 0) - (isDown("KeyS") ? 1 : 0);

    if (vertInput !== 0) {
      drone.verticalSpeed += vertInput * FLIGHT.verticalAcceleration * sm * dt;
    }

    // Vertical drag (exponential)
    drone.verticalSpeed *= Math.exp(-FLIGHT.verticalDrag * dt);

    // Clamp vertical speed
    const effectiveMaxV = FLIGHT.maxVerticalSpeed * sm;
    drone.verticalSpeed = Cesium.Math.clamp(drone.verticalSpeed, -effectiveMaxV, effectiveMaxV);

    // ── Combine into position update ──
    // Horizontal movement
    Cesium.Cartesian3.multiplyByScalar(drone.horizontalVelocity, dt, scratch.movementStep);
    Cesium.Cartesian3.add(drone.position, scratch.movementStep, drone.position);

    // Vertical movement along surface normal
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(drone.position, scratch.surfaceNormal);
    Cesium.Cartesian3.multiplyByScalar(scratch.surfaceNormal, drone.verticalSpeed * dt, scratch.verticalStep);
    Cesium.Cartesian3.add(drone.position, scratch.verticalStep, drone.position);
  }

  function enforceTerrainClearance() {
    Cesium.Cartographic.fromCartesian(drone.position, Cesium.Ellipsoid.WGS84, scratch.cartographic);
    const sampledGround = viewer.scene.globe.getHeight(scratch.cartographic);
    if (Number.isFinite(sampledGround)) {
      drone.lastGroundHeight = sampledGround;
    }
    const minHeight = drone.lastGroundHeight + FLIGHT.minimumClearance;
    if (scratch.cartographic.height < minHeight) {
      scratch.cartographic.height = minHeight;
      Cesium.Cartesian3.fromRadians(
        scratch.cartographic.longitude,
        scratch.cartographic.latitude,
        scratch.cartographic.height,
        Cesium.Ellipsoid.WGS84,
        drone.position,
      );

      // Kill downward vertical speed
      if (drone.verticalSpeed < 0.0) {
        drone.verticalSpeed = 0.0;
      }

      // Strip any downward component from horizontal velocity
      Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(drone.position, scratch.surfaceNormal);
      const hVertComponent = Cesium.Cartesian3.dot(drone.horizontalVelocity, scratch.surfaceNormal);
      if (hVertComponent < 0.0) {
        Cesium.Cartesian3.multiplyByScalar(scratch.surfaceNormal, hVertComponent, scratch.velocityStep);
        Cesium.Cartesian3.subtract(drone.horizontalVelocity, scratch.velocityStep, drone.horizontalVelocity);
      }
    }
  }

  /* ─── Building collision (rooftop + wall) ───
   * Uses scene.sampleHeight() for height-based collision (terrain + 3D tiles)
   * and scene.pickFromRay() for forward wall detection.
   * Only active below BUILDING_COLLISION.activationAltitudeAGL to keep cost low.
   */
  function enforceBuildingCollision() {
    if (!BUILDING_COLLISION.enabled || !viewer || !viewer.scene) return;

    buildingCollisionActive = false;
    lastBuildingHitDistance = Infinity;

    // Need sampleHeight support (requires WebGL depth texture)
    const scene = viewer.scene;
    const hasSampleHeight = scene.sampleHeightSupported;
    const hasPickFromRay = typeof scene.pickFromRay === 'function';

    if (!hasSampleHeight && !hasPickFromRay) return;

    // Compute current AGL to decide activation
    Cesium.Cartographic.fromCartesian(
      drone.position, Cesium.Ellipsoid.WGS84, scratch.buildingCartographic,
    );
    const agl = scratch.buildingCartographic.height - drone.lastGroundHeight;
    if (agl > BUILDING_COLLISION.activationAltitudeAGL) return;

    buildingCollisionActive = true;

    // Build exclusion list (exclude the F-22 so we don't self-collide)
    const excludeList = droneEntity ? [droneEntity] : [];

    /* ── 1. Height-based collision (rooftop) ──
     * scene.sampleHeight returns the height of the tallest scene geometry
     * (terrain + 3D tiles) at the given lat/lon. If the drone is below that
     * height, it gets pushed up — prevents flying through rooftops. */
    if (hasSampleHeight) {
      const sceneHeight = scene.sampleHeight(scratch.buildingCartographic, excludeList);
      if (Number.isFinite(sceneHeight)) {
        const minHeight = sceneHeight + BUILDING_COLLISION.minimumClearance;
        if (scratch.buildingCartographic.height < minHeight) {
          // Snap drone above the building
          scratch.buildingCartographic.height = minHeight;
          Cesium.Cartesian3.fromRadians(
            scratch.buildingCartographic.longitude,
            scratch.buildingCartographic.latitude,
            scratch.buildingCartographic.height,
            Cesium.Ellipsoid.WGS84,
            drone.position,
          );

          // Kill downward vertical speed
          if (drone.verticalSpeed < 0.0) {
            drone.verticalSpeed = 0.0;
          }

          // Strip any downward component from horizontal velocity
          Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(drone.position, scratch.surfaceNormal);
          const hVertComponent = Cesium.Cartesian3.dot(drone.horizontalVelocity, scratch.surfaceNormal);
          if (hVertComponent < 0.0) {
            Cesium.Cartesian3.multiplyByScalar(
              scratch.surfaceNormal, hVertComponent, scratch.velocityStep,
            );
            Cesium.Cartesian3.subtract(drone.horizontalVelocity, scratch.velocityStep, drone.horizontalVelocity);
          }
        }
      }
    }

    /* ── 2. Forward wall collision ──
     * Cast a ray in the drone's forward direction. If it hits scene geometry
     * within forwardCheckDistance, progressively brake; if within wallStopDistance,
     * fully stop and push the drone back. */
    if (hasPickFromRay) {
      const speed = Cesium.Cartesian3.magnitude(drone.horizontalVelocity);
      if (speed > 1.0) {
        // Forward ray
        const forwardRay = new Cesium.Ray(drone.position, scratch.forward);
        const forwardHit = scene.pickFromRay(forwardRay, excludeList);

        if (forwardHit && forwardHit.position) {
          const distance = Cesium.Cartesian3.distance(drone.position, forwardHit.position);
          lastBuildingHitDistance = distance;

          if (distance < BUILDING_COLLISION.forwardCheckDistance) {
            // Progressive braking: closer → stronger
            const t = 1.0 - (distance / BUILDING_COLLISION.forwardCheckDistance);
            const deflection = t * t * BUILDING_COLLISION.deflectionStrength; // quadratic ramp
            Cesium.Cartesian3.multiplyByScalar(
              drone.horizontalVelocity, 1.0 - deflection, drone.horizontalVelocity,
            );

            // Hard stop + pushback when very close to a wall
            if (distance < BUILDING_COLLISION.wallStopDistance) {
              // Push drone backward away from the wall
              Cesium.Cartesian3.multiplyByScalar(
                scratch.forward,
                -BUILDING_COLLISION.pushbackDistance,
                scratch.velocityStep,
              );
              Cesium.Cartesian3.add(drone.position, scratch.velocityStep, drone.position);

              // Kill all velocity
              drone.horizontalVelocity.x = 0.0;
              drone.horizontalVelocity.y = 0.0;
              drone.horizontalVelocity.z = 0.0;
              drone.verticalSpeed = 0.0;
            }
          }
        }
      }
    }
  }

  function updateCamera() {
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(drone.position, scratch.surfaceNormal);

    if (cameraMode === CAMERA_FPV) {
      // FPV: camera at drone position, looking forward-and-down at 45 degrees
      // Direction = cos(45)*forward + sin(45)*(-up) in ECEF
      const cf = Math.cos(FPV_PITCH_DOWN); // cos(-45) ≈ 0.707
      const sf = Math.sin(FPV_PITCH_DOWN); // sin(-45) ≈ -0.707
      scratch.cameraOffset.x = cf * scratch.horizontalForward.x + sf * scratch.surfaceNormal.x;
      scratch.cameraOffset.y = cf * scratch.horizontalForward.y + sf * scratch.surfaceNormal.y;
      scratch.cameraOffset.z = cf * scratch.horizontalForward.z + sf * scratch.surfaceNormal.z;
      Cesium.Cartesian3.normalize(scratch.cameraOffset, scratch.cameraOffset);

      // Up vector: perpendicular to direction, in the forward-up plane
      scratch.upOffset.x = -sf * scratch.horizontalForward.x + cf * scratch.surfaceNormal.x;
      scratch.upOffset.y = -sf * scratch.horizontalForward.y + cf * scratch.surfaceNormal.y;
      scratch.upOffset.z = -sf * scratch.horizontalForward.z + cf * scratch.surfaceNormal.z;
      Cesium.Cartesian3.normalize(scratch.upOffset, scratch.upOffset);

      viewer.camera.setView({
        destination: drone.position,
        orientation: {
          direction: scratch.cameraOffset,
          up: scratch.upOffset,
        },
      });

      // Update FPV telemetry
      if (fpvHudAlt && fpvHudSpd) {
        Cesium.Cartographic.fromCartesian(drone.position, Cesium.Ellipsoid.WGS84, scratch.cartographic);
        const agl = Math.max(0.0, scratch.cartographic.height - drone.lastGroundHeight);
        const spd = Cesium.Cartesian3.magnitude(drone.horizontalVelocity);
        fpvHudAlt.textContent = `ALT ${agl.toFixed(1)} m`;
        fpvHudSpd.textContent = `SPD ${spd.toFixed(1)} m/s`;
      }
    } else {
      // Chase camera: behind and above drone
      Cesium.Cartesian3.multiplyByScalar(
        scratch.horizontalForward,
        FLIGHT.cameraForwardOffset,
        scratch.cameraOffset,
      );
      Cesium.Cartesian3.multiplyByScalar(scratch.surfaceNormal, FLIGHT.cameraUpOffset, scratch.upOffset);
      Cesium.Cartesian3.add(drone.position, scratch.cameraOffset, scratch.cameraPosition);
      Cesium.Cartesian3.add(scratch.cameraPosition, scratch.upOffset, scratch.cameraPosition);

      // Look above the drone so it sits in the lower part of the viewport
      Cesium.Cartesian3.multiplyByScalar(scratch.surfaceNormal, FLIGHT.cameraLookAboveOffset, scratch.verticalStep);
      Cesium.Cartesian3.add(drone.position, scratch.verticalStep, scratch.cameraOffset);
      Cesium.Cartesian3.subtract(scratch.cameraOffset, scratch.cameraPosition, scratch.cameraOffset);
      Cesium.Cartesian3.normalize(scratch.cameraOffset, scratch.cameraOffset);

      viewer.camera.setView({
        destination: scratch.cameraPosition,
        orientation: {
          direction: scratch.cameraOffset,
          up: scratch.surfaceNormal,
        },
      });
    }
  }

  function updateHudReadout() {
    if (isCreativeModeActive()) {
      const r = getFreeCamReadout();
      HUD.speed.textContent = `${(r.speedMs * 3.6).toFixed(1)} km/h`;
      HUD.altitudeAgl.textContent = `${r.agl.toFixed(1)} m`;
      HUD.altitudeMsl.textContent = `${r.altMsl.toFixed(1)} m`;
      HUD.heading.textContent = `${r.headingDeg.toFixed(1)} deg`;
      HUD.attitude.textContent = `0.0 deg / 0.0 deg`;
      HUD.position.textContent = `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`;
      if (HUD.buildingCol) {
        HUD.buildingCol.textContent = 'OFF';
        HUD.buildingCol.style.color = '';
      }
      return;
    }

    Cesium.Cartographic.fromCartesian(drone.position, Cesium.Ellipsoid.WGS84, scratch.cartographic);
    const speedMetersPerSecond = Cesium.Cartesian3.magnitude(drone.horizontalVelocity);
    const agl = Math.max(0.0, scratch.cartographic.height - drone.lastGroundHeight);
    const headingDeg = Cesium.Math.toDegrees(Cesium.Math.zeroToTwoPi(drone.heading));
    const pitchDeg = Cesium.Math.toDegrees(drone.visualPitch);
    const rollDeg = Cesium.Math.toDegrees(drone.visualRoll);

    HUD.speed.textContent = `${(speedMetersPerSecond * 3.6).toFixed(1)} km/h`;
    HUD.altitudeAgl.textContent = `${agl.toFixed(1)} m`;
    HUD.altitudeMsl.textContent = `${scratch.cartographic.height.toFixed(1)} m`;
    HUD.heading.textContent = `${headingDeg.toFixed(1)} deg`;
    HUD.attitude.textContent = `${pitchDeg.toFixed(1)} deg / ${rollDeg.toFixed(1)} deg`;
    HUD.position.textContent =
      `${Cesium.Math.toDegrees(scratch.cartographic.latitude).toFixed(5)}, ` +
      `${Cesium.Math.toDegrees(scratch.cartographic.longitude).toFixed(5)}`;

    // Building collision HUD
    if (HUD.buildingCol) {
      if (!BUILDING_COLLISION.enabled) {
        HUD.buildingCol.textContent = 'OFF';
        HUD.buildingCol.style.color = '';
      } else if (!buildingCollisionActive) {
        HUD.buildingCol.textContent = 'STANDBY';
        HUD.buildingCol.style.color = '#888';
      } else if (lastBuildingHitDistance < BUILDING_COLLISION.wallStopDistance) {
        HUD.buildingCol.textContent = `WALL ${lastBuildingHitDistance.toFixed(0)}m`;
        HUD.buildingCol.style.color = '#ff4444';
      } else if (lastBuildingHitDistance < BUILDING_COLLISION.forwardCheckDistance) {
        HUD.buildingCol.textContent = `WARN ${lastBuildingHitDistance.toFixed(0)}m`;
        HUD.buildingCol.style.color = '#ffaa00';
      } else {
        HUD.buildingCol.textContent = 'ACTIVE';
        HUD.buildingCol.style.color = '#44ff44';
      }
    }
  }

  function resetPosition() {
    teleportTo(START_LOCATION);
  }

  function teleportTo(location) {
    drone.position = Cesium.Cartesian3.fromDegrees(
      location.longitude,
      location.latitude,
      location.height,
    );
    drone.horizontalVelocity = new Cesium.Cartesian3(0.0, 0.0, 0.0);
    drone.verticalSpeed = 0.0;
    drone.heading = Cesium.Math.toRadians(200.0);
    drone.visualPitch = 0.0;
    drone.visualRoll = 0.0;
    updateDroneOrientation();
    updateHorizontalAxes();
    updateWorldAxes();
    updateCamera();
  }

  function setupInputHandlers() {
    document.addEventListener("keydown", (event) => {
      keyState.add(event.code);
      if (KEY_BLOCKLIST.has(event.code)) {
        event.preventDefault();
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        if (isCreativeModeActive()) { exitCreativeMode(); setHighlightVisible(false); }
        resetPosition();
        setFlightStatus("Flight active. W/S ascend/descend, arrows move/yaw, A/D strafe.", false);
      }
      if (event.code === "KeyC") {
        event.preventDefault();
        if (!isCreativeModeActive()) toggleCameraMode();
      }
      if (event.code === "KeyG") {
        event.preventDefault();
        if (isCreativeModeActive()) {
          exitCreativeMode();
          setHighlightVisible(false);
          setFlightStatus("Flight active. W/S ascend/descend, arrows move/yaw, A/D strafe.", false);
        } else {
          if (cameraMode === CAMERA_FPV) toggleCameraMode();
          drone.visualPitch = 0;
          drone.visualRoll = 0;
          enterCreativeMode(drone.position, drone.heading);
          setHighlightVisible(true);
          setFlightStatus("Creative Mode active. G to return to drone.", false);
        }
      }
      // Speed tier keys: 1 = 1x, 2 = 3x, 3 = 5x, 4 = 10x
      if (event.code === "Digit1") setSpeedTier(0);
      if (event.code === "Digit2") setSpeedTier(1);
      if (event.code === "Digit3") setSpeedTier(2);
      if (event.code === "Digit4") setSpeedTier(3);
      if (event.code === "Digit5") setSpeedTier(4);
    });

    document.addEventListener("keyup", (event) => {
      keyState.delete(event.code);
    });

    // Speed tier button clicks
    SPEED_TIERS.forEach((tier, i) => {
      const btn = document.getElementById(`speed-btn-${tier}`);
      if (btn) {
        btn.addEventListener("click", () => setSpeedTier(i));
      }
    });
    updateSpeedTierHUD();

    const ucdBtn = document.getElementById("teleport-ucd");
    if (ucdBtn) {
      ucdBtn.addEventListener("click", () => {
        if (isCreativeModeActive()) { exitCreativeMode(); setHighlightVisible(false); }
        teleportTo(UCD_LOCATION);
        setFlightStatus("Flight active. W/S ascend/descend, arrows move/yaw, A/D strafe.", false);
        ucdBtn.blur();
      });
    }
  }

  async function buildViewer() {
    let terrainProvider = new Cesium.EllipsoidTerrainProvider();
    try {
      terrainProvider = await Cesium.createWorldTerrainAsync({
        requestWaterMask: false,
        requestVertexNormals: false,
      });
    } catch (error) {
      console.warn("Falling back to ellipsoid terrain provider:", error);
    }

    viewer = new Cesium.Viewer("cesiumContainer", {
      terrainProvider,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      sceneModePicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      shouldAnimate: true,
      baseLayerPicker: false,
      scene3DOnly: true,
      requestRenderMode: true,
      // Enable transparent canvas so three-geospatial sky shows through
      orderIndependentTranslucency: false,
      contextOptions: {
        webgl: {
          alpha: true,
          premultipliedAlpha: true,
          powerPreference: 'high-performance',
          antialias: false,
          stencil: false,
        },
      },
    });

    viewer.scene.screenSpaceCameraController.enableInputs = false;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.maximumScreenSpaceError = 2.0;
    viewer.scene.globe.preloadSiblings = false;
    viewer.scene.globe.tileCacheSize = 100;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.highDynamicRange = false;

    // Disable Cesium's built-in sky — three-geospatial provides a physically-accurate replacement
    viewer.scene.skyAtmosphere.show = false;
    if (viewer.scene.skyBox) {
      viewer.scene.skyBox.show = false;
    }
    if (viewer.scene.sun) {
      viewer.scene.sun.show = false;
    }
    viewer.scene.moon.show = false;
    viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0003;
    viewer.scene.fog.screenSpaceErrorFactor = 4.0;
    viewer.scene.shadowMap.enabled = false;
    viewer.shadows = false;
    // Lock time to noon at San Francisco for consistent sun lighting & cloud visibility.
    // Solar noon at longitude −122.4° ≈ 20:10 UTC.  Summer solstice for max daylight.
    viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2024-06-21T20:00:00Z');
    viewer.clock.shouldAnimate = false;   // freeze — never advance to night
    viewer.clock.multiplier = 0;

    if (viewer.scene.postProcessStages && viewer.scene.postProcessStages.fxaa) {
      viewer.scene.postProcessStages.fxaa.enabled = true;
    }
    if ("msaaSamples" in viewer.scene) {
      viewer.scene.msaaSamples = 1;
    }

    viewer.resolutionScale = window.devicePixelRatio || 1.0;
    viewer.camera.frustum.fov = Cesium.Math.toRadians(119.6);
  }

  async function loadWorldDetailLayers() {
    let datasetStatus = "Cesium World Terrain";
    let usedGooglePhotorealisticTiles = false;

    if (
      configuredGoogleApiKey &&
      Cesium.GoogleMaps &&
      typeof Cesium.createGooglePhotorealistic3DTileset === "function"
    ) {
      try {
        Cesium.GoogleMaps.defaultApiKey = configuredGoogleApiKey;
        let googleTiles = null;
        try {
          googleTiles = await Cesium.createGooglePhotorealistic3DTileset({
            onlyUsingWithGoogleGeocoder: true,
          });
        } catch (innerError) {
          googleTiles = await Cesium.createGooglePhotorealistic3DTileset();
          console.warn(
            "Google tile policy option failed, loaded tileset with default options:",
            innerError,
          );
        }
        viewer.scene.primitives.add(googleTiles);
        googleTilesRef = googleTiles;  // keep reference for cloud occlusion

        // ── Flight-sim LOD: HD nearby, aggressively degrade distant tiles ──
        googleTiles.maximumScreenSpaceError = 4;
        // Dynamic SSE: increase error tolerance for tiles near the horizon
        googleTiles.dynamicScreenSpaceError = true;
        googleTiles.dynamicScreenSpaceErrorDensity = 2.46e-4;
        googleTiles.dynamicScreenSpaceErrorFactor = 24.0;
        googleTiles.dynamicScreenSpaceErrorHeightFalloff = 0.25;
        // Foveated: prioritize center-of-screen tile loading
        googleTiles.foveatedScreenSpaceError = true;
        googleTiles.foveatedConeSize = 0.1;
        googleTiles.foveatedMinimumScreenSpaceErrorRelaxation = 0.0;
        googleTiles.foveatedTimeDelay = 0.2;
        // Aggressively cull tile requests while camera is in motion
        googleTiles.cullRequestsWhileMoving = true;
        googleTiles.cullRequestsWhileMovingMultiplier = 60.0;
        // Memory budget
        googleTiles.cacheBytes = 512 * 1024 * 1024;
        googleTiles.maximumCacheOverflowBytes = 256 * 1024 * 1024;
        // Progressive: show low-res placeholders first, then refine
        googleTiles.progressiveResolutionHeightFraction = 0.3;
        googleTiles.preloadFlightDestinations = true;
        googleTiles.preferLeaves = false;

        datasetStatus = "Google Photorealistic 3D Tiles + Cesium lighting";
        usedGooglePhotorealisticTiles = true;
      } catch (error) {
        console.warn("Google Photorealistic 3D Tiles failed to load:", error);
      }
    }

    if (!usedGooglePhotorealisticTiles) {
      try {
        const osmBuildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(osmBuildings);
        osmBuildingsRef = osmBuildings;  // keep reference for cloud occlusion

        // ── Flight-sim LOD for OSM buildings ──
        osmBuildings.maximumScreenSpaceError = 8;
        osmBuildings.dynamicScreenSpaceError = true;
        osmBuildings.dynamicScreenSpaceErrorDensity = 2.46e-4;
        osmBuildings.dynamicScreenSpaceErrorFactor = 24.0;
        osmBuildings.foveatedScreenSpaceError = true;
        osmBuildings.foveatedConeSize = 0.1;
        osmBuildings.foveatedTimeDelay = 0.2;
        osmBuildings.cullRequestsWhileMoving = true;
        osmBuildings.cullRequestsWhileMovingMultiplier = 60.0;
        osmBuildings.cacheBytes = 256 * 1024 * 1024;
        osmBuildings.maximumCacheOverflowBytes = 128 * 1024 * 1024;

        datasetStatus = "Cesium World Terrain + OSM Buildings";
      } catch (error) {
        console.warn("OSM Buildings failed to load:", error);
      }
    }

    HUD.datasetStatus.textContent = `Active world stack: ${datasetStatus}`;
  }

  /* ─── Cloud Immersion Update ─── */
  function createCloudFogOverlay() {
    cloudFogOverlay = document.createElement('div');
    cloudFogOverlay.id = 'cloud-fog-overlay';
    cloudFogOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 3;
      opacity: 0;
      transition: opacity 0.15s ease;
      background: radial-gradient(
        ellipse at 50% 50%,
        rgba(220, 225, 235, 0.97) 0%,
        rgba(195, 205, 220, 0.93) 35%,
        rgba(175, 185, 200, 0.88) 65%,
        rgba(160, 170, 185, 0.82) 100%
      );
      mix-blend-mode: normal;
    `;
    document.body.insertBefore(cloudFogOverlay, document.getElementById('hud'));
  }

  function createFpvOverlay() {
    fpvOverlay = document.createElement('div');
    fpvOverlay.id = 'fpv-overlay';
    fpvOverlay.style.cssText = `
      position: fixed; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 5; display: none;
    `;

    // Vignette layer
    const vignette = document.createElement('div');
    vignette.style.cssText = `
      position: absolute; inset: 0;
      background: radial-gradient(
        ellipse 70% 65% at 50% 50%,
        transparent 0%,
        transparent 45%,
        rgba(0,0,0,0.18) 62%,
        rgba(0,0,0,0.45) 78%,
        rgba(0,0,0,0.82) 100%
      );
    `;
    fpvOverlay.appendChild(vignette);

    // Letterbox bars
    const barStyle = `position: absolute; left: 0; right: 0; height: 3.5%; background: #000;`;
    const topBar = document.createElement('div');
    topBar.style.cssText = barStyle + 'top: 0;';
    const bottomBar = document.createElement('div');
    bottomBar.style.cssText = barStyle + 'bottom: 0;';
    fpvOverlay.appendChild(topBar);
    fpvOverlay.appendChild(bottomBar);

    // Film grain (animated noise via CSS)
    const grain = document.createElement('div');
    grain.style.cssText = `
      position: absolute; inset: 0; opacity: 0.06; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 128px 128px;
      animation: fpv-grain 0.08s steps(2) infinite;
    `;
    fpvOverlay.appendChild(grain);

    // Slight color tint for cinematic warmth
    const tint = document.createElement('div');
    tint.style.cssText = `
      position: absolute; inset: 0; opacity: 0.07;
      background: linear-gradient(180deg, rgba(255,180,100,0.3) 0%, transparent 40%, rgba(80,120,200,0.2) 100%);
      mix-blend-mode: overlay;
    `;
    fpvOverlay.appendChild(tint);

    // FPV telemetry HUD
    const hudContainer = document.createElement('div');
    hudContainer.style.cssText = `
      position: absolute; bottom: 6%; left: 50%; transform: translateX(-50%);
      display: flex; gap: 2.5rem; align-items: baseline;
      font-family: 'Space Mono', monospace; font-size: 1.05rem;
      color: rgba(255,255,255,0.88); text-shadow: 0 0 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7);
      letter-spacing: 0.04em;
    `;

    fpvHudAlt = document.createElement('span');
    fpvHudAlt.textContent = 'ALT 0.0 m';
    fpvHudSpd = document.createElement('span');
    fpvHudSpd.textContent = 'SPD 0.0 m/s';

    hudContainer.appendChild(fpvHudAlt);
    hudContainer.appendChild(fpvHudSpd);
    fpvOverlay.appendChild(hudContainer);

    document.body.appendChild(fpvOverlay);

    // Inject grain animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fpv-grain {
        0% { transform: translate(0,0); }
        100% { transform: translate(-8px, -8px); }
      }
    `;
    document.head.appendChild(style);
  }

  function toggleCameraMode() {
    cameraMode = cameraMode === CAMERA_CHASE ? CAMERA_FPV : CAMERA_CHASE;
    if (cameraMode === CAMERA_FPV) {
      viewer.camera.frustum.fov = FPV_FOV;
      if (fpvOverlay) fpvOverlay.style.display = 'block';
      if (droneEntity) droneEntity.show = false;
      setHighlightVisible(true);
    } else {
      viewer.camera.frustum.fov = CHASE_FOV;
      if (fpvOverlay) fpvOverlay.style.display = 'none';
      if (droneEntity) droneEntity.show = true;
      setHighlightVisible(false);
    }
  }

  function updateCloudImmersion(dt) {
    if (!cloudFogOverlay || !viewer) return;

    // Get current altitude MSL from the drone's cartographic position
    Cesium.Cartographic.fromCartesian(drone.position, Cesium.Ellipsoid.WGS84, scratch.cartographic);
    const altitudeMSL = scratch.cartographic.height;

    const cloudState = getCloudImmersionState(altitudeMSL);

    // Smooth the immersion factor to prevent jarring transitions
    const lerpSpeed = 4.0; // how fast to transition (higher = faster)
    const alpha = 1.0 - Math.exp(-lerpSpeed * dt);
    currentCloudImmersion += (cloudState.immersion - currentCloudImmersion) * alpha;

    // Clamp near-zero to zero to prevent perpetual micro-opacity
    if (currentCloudImmersion < 0.005) currentCloudImmersion = 0;
    if (currentCloudImmersion > 0.995) currentCloudImmersion = 1;

    /* ─── Fog overlay (in-cloud whiteout) ─── */
    cloudFogOverlay.style.opacity = currentCloudImmersion.toFixed(3);

    /* ─── Three.js overlay z-index ─── */
    // Overlay stays at z-index 0 (behind Cesium at z-index 1).
    // Below clouds: terrain renders on top of sky, clouds visible through transparent sky areas.
    // In/above clouds: Cesium terrain is hidden → Cesium canvas is transparent → overlay shows through.
    // The drone is a Cesium entity so it always renders on the Cesium canvas (z-index 1), visible above overlay.

    /* ─── Cesium terrain / tile visibility ─── */
    // Compute target fade: 0 = hidden, 1 = visible.
    //   below      → 1.0  (terrain fully visible)
    //   entering   → fades with immersion (fog covers terrain anyway)
    //   inside / exiting / above → 0.0  (terrain hidden, cloud tops visible)
    let targetFade;
    if (cloudState.state === 'below') {
      targetFade = 1.0;
    } else if (cloudState.state === 'entering') {
      targetFade = 1.0 - cloudState.immersion;
    } else {
      targetFade = 0.0;
    }

    // Smooth the fade
    currentCesiumFade += (targetFade - currentCesiumFade) * alpha;
    if (currentCesiumFade < 0.01) currentCesiumFade = 0;
    if (currentCesiumFade > 0.99) currentCesiumFade = 1;

    // Apply visibility to Cesium globe
    if (viewer.scene.globe) {
      viewer.scene.globe.show = currentCesiumFade > 0.01;
    }

    // Apply visibility to 3D tile primitives
    if (googleTilesRef) {
      googleTilesRef.show = currentCesiumFade > 0.01;
    }
    if (osmBuildingsRef) {
      osmBuildingsRef.show = currentCesiumFade > 0.01;
    }

    // Disable Cesium fog & post-processing when terrain is hidden to ensure
    // the Cesium canvas is fully transparent and the Three.js overlay shows through.
    if (currentCesiumFade < 0.01) {
      viewer.scene.fog.enabled = false;
    } else {
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = currentCesiumFade < 1.0
        ? 0.0003 + (1.0 - currentCesiumFade) * 0.005
        : 0.0003;
    }
  }

  function stepFrame(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now - lastTime) / 1000.0));
    lastTime = now;

    if (isCreativeModeActive()) {
      updateCreativeMode(dt, keyState, speedMultiplier, FLIGHT, viewer);
    } else {
      applyOrientationInput(dt);
      updateHorizontalAxes();
      applyDroneMovement(dt);
      enforceTerrainClearance();
      updateHorizontalAxes();     // recompute at final position
      updateDroneOrientation();
      updateWorldAxes();
      enforceBuildingCollision();
      updateCamera();
    }
    updateHudReadout();

    // Update cloud immersion effects (fog overlay + Cesium visibility)
    updateCloudImmersion(dt);

    // Adaptive resolution scaling to maintain smooth FPS
    updateDynamicResolution(dt);

    // Update drone entity orientation (heading correction for GLTF model orientation)
    droneHpr.heading = drone.heading + Math.PI * 1.5;
    droneHpr.pitch = drone.visualPitch;
    droneHpr.roll = drone.visualRoll;
    Cesium.Transforms.headingPitchRollQuaternion(
      drone.position,
      droneHpr,
      Cesium.Ellipsoid.WGS84,
      Cesium.Transforms.eastNorthUpToFixedFrame,
      droneModelOrientation,
    );

    // Render the three-geospatial atmospheric overlay in sync with the Cesium camera.
    // Wrapped in try-catch so overlay errors never break the flight loop.
    try { updateGeospatialOverlay(viewer); } catch (_) { }
  }

  async function init() {
    HUD.datasetStatus.textContent = "Booting Cesium viewer and streaming terrain...";
    try {
      await buildViewer();
      await loadWorldDetailLayers();

      // Add drone as a Cesium entity so it renders on the Cesium canvas (z-index 1),
      // always visible above the Three.js sky/cloud overlay (z-index 0).
      droneEntity = viewer.entities.add({
        position: new Cesium.CallbackProperty(() => drone.position, false),
        orientation: new Cesium.CallbackProperty(() => droneModelOrientation, false),
        model: {
          uri: '/assets/drone.glb',
          minimumPixelSize: 64,
          scale: 1.0,
        },
      });

      setupInputHandlers();

      // Create the cloud fog overlay element
      createCloudFogOverlay();
      createFpvOverlay();
      initCreativeMode(viewer);

      resetPosition();
      lastTime = performance.now();

      // Use requestAnimationFrame for tightest possible frame pacing —
      // syncs directly with the display refresh rate for zero-lag input.
      function frameLoop() {
        stepFrame(performance.now());
        viewer.scene.requestRender();
        requestAnimationFrame(frameLoop);
      }
      requestAnimationFrame(frameLoop);

      setFlightStatus(
        "Flight active. W/S ascend/descend, arrows move/yaw, A/D strafe.",
        false,
      );

      // Initialize the three-geospatial atmospheric overlay asynchronously.
      // This precomputes atmosphere textures and streams cloud data — it can
      // take several seconds but must never block the flight loop.
      initGeospatialOverlay(viewer).catch((err) => {
        console.error('[init] Atmospheric overlay failed to initialize:', err);
      });
    } catch (error) {
      console.error(error);
      HUD.datasetStatus.textContent = "Initialization failed.";
      setFlightStatus("Check browser console for the startup error.", true);
    }
  }

  init();
})();
