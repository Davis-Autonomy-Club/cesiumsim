import {
  getCloudImmersionState,
  initGeospatialOverlay,
  updateGeospatialOverlay,
} from "../overlay/geospatial-overlay";
import {
  BUILDING_COLLISION,
  CAMERA_CHASE,
  CAMERA_FPV,
  CHASE_FOV,
  DEFAULT_CESIUM_TOKEN,
  DEFAULT_GOOGLE_MAPS_API_KEY,
  FLIGHT,
  FPV_FOV,
  FPV_PITCH_DOWN,
  KEY_BLOCKLIST,
  SPEED_TIERS,
  START_LOCATION,
  UCD_LOCATION,
} from "./config";
import { GeminiController } from "./gemini-controller";
import {
  createCloudFogOverlay,
  createFpvOverlay,
  getHudElements,
  setFlightStatus,
  updateSpeedTierHud,
} from "./hud";

export function startSimulator(): void {
  const HUD = getHudElements();

  if (!window.Cesium) {
    HUD.datasetStatus.textContent = "Cesium failed to load. Refresh and try again.";
    HUD.flightStatus.textContent = "Startup aborted.";
    return;
  }

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
    const token = query.get("cesiumToken");
    if (token) {
      window.localStorage.setItem("cesiumToken", token);
    }
  }
  if (query.has("googleApiKey")) {
    const apiKey = query.get("googleApiKey");
    if (apiKey) {
      window.localStorage.setItem("googleApiKey", apiKey);
    }
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
    buildingCartographic: new Cesium.Cartographic(),
    surfaceNormal: new Cesium.Cartesian3(),
  };

  const keyState = new Set<string>();
  let viewer: any = null;
  let lastTime = performance.now();

  /* ─── Drone Cesium entity state ─── */
  const droneHpr = new Cesium.HeadingPitchRoll();
  const droneModelOrientation = new Cesium.Quaternion();
  let droneEntity: any = null;

  /* ─── Camera mode ─── */
  let cameraMode = CAMERA_CHASE;
  let fpvOverlay: HTMLDivElement | null = null;
  let fpvHudAlt: HTMLSpanElement | null = null;
  let fpvHudSpd: HTMLSpanElement | null = null;

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

  /* ─── Cloud immersion state ─── */
  let cloudFogOverlay: HTMLDivElement | null = null;
  let currentCloudImmersion = 0; // smoothed 0..1
  let currentCesiumFade = 1.0;   // smoothed terrain visibility (0=hidden, 1=visible)
  let googleTilesRef: any = null;      // reference to 3D tileset primitive
  let osmBuildingsRef: any = null;     // reference to OSM buildings primitive

  /* ─── Speed multiplier ─── */
  let speedTierIndex = 0;
  let speedMultiplier = SPEED_TIERS[0];

  function setSpeedTier(index: number) {
    speedTierIndex = Math.max(0, Math.min(index, SPEED_TIERS.length - 1));
    speedMultiplier = SPEED_TIERS[speedTierIndex];
    updateSpeedTierHud(speedTierIndex, speedMultiplier, SPEED_TIERS);
  }

  function isDown(code: string): boolean {
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

  function enforceBuildingCollision(): void {
    if (!BUILDING_COLLISION.enabled || !viewer || !viewer.scene) {
      return;
    }

    const scene = viewer.scene;
    const hasSampleHeight = scene.sampleHeightSupported;
    const hasPickFromRay = typeof scene.pickFromRay === "function";
    if (!hasSampleHeight && !hasPickFromRay) {
      return;
    }

    Cesium.Cartographic.fromCartesian(
      drone.position,
      Cesium.Ellipsoid.WGS84,
      scratch.buildingCartographic,
    );
    const agl = scratch.buildingCartographic.height - drone.lastGroundHeight;
    if (agl > BUILDING_COLLISION.activationAltitudeAGL) {
      return;
    }

    const excludeList = droneEntity ? [droneEntity] : [];

    if (hasSampleHeight) {
      const sceneHeight = scene.sampleHeight(
        scratch.buildingCartographic,
        excludeList,
      );
      if (Number.isFinite(sceneHeight)) {
        const minHeight = sceneHeight + BUILDING_COLLISION.minimumClearance;
        if (scratch.buildingCartographic.height < minHeight) {
          scratch.buildingCartographic.height = minHeight;
          Cesium.Cartesian3.fromRadians(
            scratch.buildingCartographic.longitude,
            scratch.buildingCartographic.latitude,
            scratch.buildingCartographic.height,
            Cesium.Ellipsoid.WGS84,
            drone.position,
          );

          if (drone.verticalSpeed < 0.0) {
            drone.verticalSpeed = 0.0;
          }

          Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
            drone.position,
            scratch.surfaceNormal,
          );
          const hVertComponent = Cesium.Cartesian3.dot(
            drone.horizontalVelocity,
            scratch.surfaceNormal,
          );
          if (hVertComponent < 0.0) {
            Cesium.Cartesian3.multiplyByScalar(
              scratch.surfaceNormal,
              hVertComponent,
              scratch.velocityStep,
            );
            Cesium.Cartesian3.subtract(
              drone.horizontalVelocity,
              scratch.velocityStep,
              drone.horizontalVelocity,
            );
          }
        }
      }
    }

    if (hasPickFromRay) {
      const speed = Cesium.Cartesian3.magnitude(drone.horizontalVelocity);
      if (speed <= 1.0) {
        return;
      }

      const forwardRay = new Cesium.Ray(drone.position, scratch.forward);
      const forwardHit = scene.pickFromRay(forwardRay, excludeList);
      if (!forwardHit || !forwardHit.position) {
        return;
      }

      const distance = Cesium.Cartesian3.distance(
        drone.position,
        forwardHit.position,
      );
      if (distance >= BUILDING_COLLISION.forwardCheckDistance) {
        return;
      }

      const t = 1.0 - distance / BUILDING_COLLISION.forwardCheckDistance;
      const deflection = t * t * BUILDING_COLLISION.deflectionStrength;
      Cesium.Cartesian3.multiplyByScalar(
        drone.horizontalVelocity,
        1.0 - deflection,
        drone.horizontalVelocity,
      );

      if (distance < BUILDING_COLLISION.wallStopDistance) {
        Cesium.Cartesian3.multiplyByScalar(
          scratch.forward,
          -BUILDING_COLLISION.pushbackDistance,
          scratch.velocityStep,
        );
        Cesium.Cartesian3.add(
          drone.position,
          scratch.velocityStep,
          drone.position,
        );

        drone.horizontalVelocity.x = 0.0;
        drone.horizontalVelocity.y = 0.0;
        drone.horizontalVelocity.z = 0.0;
        drone.verticalSpeed = 0.0;
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

  const geminiController = new GeminiController({
    getViewer: () => viewer,
    keyState,
    setSpeedMultiplier: (value) => {
      speedMultiplier = value;
    },
    resetSpeed: () => {
      setSpeedTier(0);
    },
  });

  function setupInputHandlers() {
    document.addEventListener("keydown", (event) => {
      keyState.add(event.code);
      if (KEY_BLOCKLIST.has(event.code)) {
        event.preventDefault();
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        resetPosition();
      }
      if (event.code === "KeyC") {
        event.preventDefault();
        toggleCameraMode();
      }
      if (event.code === "KeyV") {
        event.preventDefault();
        geminiController.toggle();
      }
      // Speed tier keys: 1 = 1x, 2 = 3x, 3 = 5x, 4 = 10x
      if (event.code === "Digit1") setSpeedTier(0);
      if (event.code === "Digit2") setSpeedTier(1);
      if (event.code === "Digit3") setSpeedTier(2);
      if (event.code === "Digit4") setSpeedTier(3);
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
    updateSpeedTierHud(speedTierIndex, speedMultiplier, SPEED_TIERS);

    const ucdBtn = document.getElementById("teleport-ucd");
    if (ucdBtn) {
      ucdBtn.addEventListener("click", () => {
        teleportTo(UCD_LOCATION);
        // Remove focus from button so keyboard controls work immediately
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

  function toggleCameraMode() {
    cameraMode = cameraMode === CAMERA_CHASE ? CAMERA_FPV : CAMERA_CHASE;
    if (cameraMode === CAMERA_FPV) {
      viewer.camera.frustum.fov = FPV_FOV;
      if (fpvOverlay) fpvOverlay.style.display = 'block';
      if (droneEntity) droneEntity.show = false;
    } else {
      viewer.camera.frustum.fov = CHASE_FOV;
      if (fpvOverlay) fpvOverlay.style.display = 'none';
      if (droneEntity) droneEntity.show = true;
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

  function stepFrame(now: number): void {
    const dt = Math.min(0.033, Math.max(0.001, (now - lastTime) / 1000.0));
    lastTime = now;

    applyOrientationInput(dt);
    updateHorizontalAxes();
    applyDroneMovement(dt);
    enforceTerrainClearance();
    updateHorizontalAxes();     // recompute at final position
    updateDroneOrientation();
    updateWorldAxes();
    enforceBuildingCollision();
    updateCamera();
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
    try {
      updateGeospatialOverlay(viewer);
    } catch (_) {
      // Keep the simulation loop running if overlay rendering fails.
    }
  }

  async function init(): Promise<void> {
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
      cloudFogOverlay = createCloudFogOverlay();
      const fpv = createFpvOverlay();
      fpvOverlay = fpv.overlay;
      fpvHudAlt = fpv.altitude;
      fpvHudSpd = fpv.speed;

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
        HUD,
        "Flight active. W/S ascend/descend, arrows move/yaw, A/D strafe.",
        false,
      );

      // Initialize the three-geospatial atmospheric overlay asynchronously.
      // This precomputes atmosphere textures and streams cloud data — it can
      // take several seconds but must never block the flight loop.
      initGeospatialOverlay(viewer).catch((err: unknown) => {
        console.error("[init] Atmospheric overlay failed to initialize:", err);
      });
    } catch (error) {
      console.error(error);
      HUD.datasetStatus.textContent = "Initialization failed.";
      setFlightStatus(HUD, "Check browser console for the startup error.", true);
    }
  }

  init();
}
