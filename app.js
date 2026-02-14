import { initGeospatialOverlay, updateGeospatialOverlay, getCloudImmersionState, CLOUD_BAND_CORE_BOTTOM } from './geospatial-overlay.js';

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
    forwardAcceleration: 44.0,
    brakeDragMultiplier: 4.0,
    maxSpeedMetersPerSecond: 92.0,
    linearDrag: 1.5,
    keyboardYawRate: Cesium.Math.toRadians(55.0),
    keyboardPitchRate: Cesium.Math.toRadians(40.0),
    rollRate: Cesium.Math.toRadians(65.0),
    autoLevelRollRate: 4.0,
    maxPitch: Cesium.Math.toRadians(85.0),
    maxRoll: Cesium.Math.toRadians(75.0),
    minimumClearance: 4.0,
    // 3rd person camera: behind and above the plane
    cameraForwardOffset: -25.0,
    cameraUpOffset: 8.0,
  };

  const HUD = {
    speed: document.getElementById("hud-speed"),
    altitudeAgl: document.getElementById("hud-altitude-agl"),
    altitudeMsl: document.getElementById("hud-altitude-msl"),
    heading: document.getElementById("hud-heading"),
    attitude: document.getElementById("hud-attitude"),
    position: document.getElementById("hud-position"),
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
    "KeyG",
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
    velocity: new Cesium.Cartesian3(0.0, 0.0, 0.0),
    heading: Cesium.Math.toRadians(200.0),
    pitch: Cesium.Math.toRadians(-2.0),
    roll: 0.0,
    orientation: new Cesium.Quaternion(0, 0, 0, 1),
    lastGroundHeight: 0.0,
  };

  const scratch = {
    hpr: new Cesium.HeadingPitchRoll(),
    transform: new Cesium.Matrix4(),
    forward: new Cesium.Cartesian3(),
    right: new Cesium.Cartesian3(),
    up: new Cesium.Cartesian3(),
    acceleration: new Cesium.Cartesian3(),
    velocityStep: new Cesium.Cartesian3(),
    movementStep: new Cesium.Cartesian3(),
    cameraOffset: new Cesium.Cartesian3(),
    cameraPosition: new Cesium.Cartesian3(),
    upOffset: new Cesium.Cartesian3(),
    cartographic: new Cesium.Cartographic(),
    surfaceNormal: new Cesium.Cartesian3(),
  };

  const keyState = new Set();
  let viewer = null;
  let lastTime = performance.now();

  /* ─── F-22 Cesium entity state ─── */
  const f22Hpr = new Cesium.HeadingPitchRoll();
  const f22Orientation = new Cesium.Quaternion();
  let f22Entity = null;

  /* ─── Control surface input state (for F-22 animation) ─── */
  let currentRollInput = 0;
  let currentPitchInput = 0;
  let currentYawInput = 0;

  /* ─── Landing gear ─── */
  let gearDeployed = true;
  let gearTransition = 1.0; // 1.0 = deployed, 0.0 = retracted
  const gearScale = new Cesium.Cartesian3(1, 1, 1);

  /* ─── Control surface deflection limits (radians) ─── */
  /* Realistic F-22 deflections — subtle movement, never detaches from wing */
  const SURFACE_LIMITS = {
    aileron: Cesium.Math.toRadians(5),     // outer wing flaps — gentle roll
    flap: Cesium.Math.toRadians(3),        // inner wing flaps — follow ailerons subtly
    elevator: Cesium.Math.toRadians(30),   // rear stabilizers — unchanged (user confirmed OK)
    rudder: Cesium.Math.toRadians(8),      // V-tails — coordinated yaw
  };

  /* ─── Smoothed surface deflection angles ─── */
  const surfaceAngle = {
    leftAileron: 0, rightAileron: 0,
    leftFlap: 0, rightFlap: 0,
    leftElevator: 0, rightElevator: 0,
    leftRudder: 0, rightRudder: 0,
  };

  /* ─── Scratch quaternions for nodeTransformations ─── */
  const surfaceQuat = {
    leftAileron: new Cesium.Quaternion(0, 0, 0, 1),
    rightAileron: new Cesium.Quaternion(0, 0, 0, 1),
    leftFlap: new Cesium.Quaternion(0, 0, 0, 1),
    rightFlap: new Cesium.Quaternion(0, 0, 0, 1),
    leftElevator: new Cesium.Quaternion(0, 0, 0, 1),
    rightElevator: new Cesium.Quaternion(0, 0, 0, 1),
    leftRudder: new Cesium.Quaternion(0, 0, 0, 1),
    rightRudder: new Cesium.Quaternion(0, 0, 0, 1),
  };

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
  let cloudFogOverlay = null;
  let currentCloudImmersion = 0; // smoothed 0..1
  let currentCesiumFade = 1.0;   // smoothed terrain visibility (0=hidden, 1=visible)
  let googleTilesRef = null;      // reference to 3D tileset primitive
  let osmBuildingsRef = null;     // reference to OSM buildings primitive

  /* ─── Speed multiplier ─── */
  const SPEED_TIERS = [1, 3, 5, 10];
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
    scratch.hpr.pitch = drone.pitch;
    scratch.hpr.roll = drone.roll;

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
    const cp = Math.cos(drone.pitch), sp = Math.sin(drone.pitch);
    const cr = Math.cos(drone.roll), sr = Math.sin(drone.roll);

    // Forward (nose direction) in ENU: heading + pitch determine thrust vector
    //   East  = sin(heading) * cos(pitch)
    //   North = cos(heading) * cos(pitch)
    //   Up    = sin(pitch)
    scratch.acceleration.x = sh * cp;
    scratch.acceleration.y = ch * cp;
    scratch.acceleration.z = sp;
    Cesium.Matrix4.multiplyByPointAsVector(scratch.transform, scratch.acceleration, scratch.forward);
    Cesium.Cartesian3.normalize(scratch.forward, scratch.forward);

    // Right and Up before roll (in ENU)
    const ux = -sh * sp, uy = -ch * sp, uz = cp;   // up_no_roll
    const rx = ch, ry = -sh, rz = 0;    // right_no_roll

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

  function applyOrientationInput(dt) {
    // Left/Right arrows: coordinated turn (roll + yaw)
    const turnInput = (isDown("ArrowRight") ? 1 : 0) - (isDown("ArrowLeft") ? 1 : 0);

    // Up/Down arrows: pitch (nose up / nose down) — holds angle when released
    const pitchInput = (isDown("ArrowUp") ? 1 : 0) - (isDown("ArrowDown") ? 1 : 0);

    // Track control surface inputs for F-22 animation
    const surfaceSmooth = 1.0 - Math.exp(-12.0 * dt);
    currentRollInput += (turnInput - currentRollInput) * surfaceSmooth;
    currentPitchInput += (pitchInput - currentPitchInput) * surfaceSmooth;
    currentYawInput += (turnInput - currentYawInput) * surfaceSmooth;

    // Roll + yaw from turn input (coordinated turn)
    drone.roll += turnInput * FLIGHT.rollRate * dt;
    drone.heading += turnInput * FLIGHT.keyboardYawRate * dt;

    // Pitch from up/down arrows — NO auto-level, pitch holds its angle
    drone.pitch += pitchInput * FLIGHT.keyboardPitchRate * dt;

    // Auto-level roll only (not pitch)
    if (turnInput === 0) {
      const alpha = 1.0 - Math.exp(-FLIGHT.autoLevelRollRate * dt);
      drone.roll = Cesium.Math.lerp(drone.roll, 0.0, alpha);
    }

    drone.pitch = Cesium.Math.clamp(drone.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch);
    drone.roll = Cesium.Math.clamp(drone.roll, -FLIGHT.maxRoll, FLIGHT.maxRoll);
    drone.heading = Cesium.Math.zeroToTwoPi(drone.heading);
  }

  function applyTranslationalInput(dt) {
    // W = thrust forward, S = brake (increased drag)
    const thrustInput = isDown("KeyW") ? 1 : 0;
    const brakeInput = isDown("KeyS") ? 1 : 0;
    const sm = speedMultiplier;

    // Thrust along the plane's forward vector only
    scratch.acceleration.x = 0.0;
    scratch.acceleration.y = 0.0;
    scratch.acceleration.z = 0.0;

    Cesium.Cartesian3.multiplyByScalar(
      scratch.forward,
      thrustInput * FLIGHT.forwardAcceleration * sm,
      scratch.velocityStep,
    );
    Cesium.Cartesian3.add(scratch.acceleration, scratch.velocityStep, scratch.acceleration);

    Cesium.Cartesian3.multiplyByScalar(scratch.acceleration, dt, scratch.velocityStep);
    Cesium.Cartesian3.add(drone.velocity, scratch.velocityStep, drone.velocity);

    // Drag: much heavier when braking
    const dragCoeff = brakeInput ? FLIGHT.linearDrag * FLIGHT.brakeDragMultiplier : FLIGHT.linearDrag;
    const drag = Math.exp(-dragCoeff * dt);
    Cesium.Cartesian3.multiplyByScalar(drone.velocity, drag, drone.velocity);

    const effectiveMaxSpeed = FLIGHT.maxSpeedMetersPerSecond * sm;
    const speed = Cesium.Cartesian3.magnitude(drone.velocity);
    if (speed > effectiveMaxSpeed) {
      Cesium.Cartesian3.multiplyByScalar(
        drone.velocity,
        effectiveMaxSpeed / speed,
        drone.velocity,
      );
    }

    Cesium.Cartesian3.multiplyByScalar(drone.velocity, dt, scratch.movementStep);
    Cesium.Cartesian3.add(drone.position, scratch.movementStep, drone.position);
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

      Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(drone.position, scratch.surfaceNormal);
      const verticalSpeed = Cesium.Cartesian3.dot(drone.velocity, scratch.surfaceNormal);
      if (verticalSpeed < 0.0) {
        Cesium.Cartesian3.multiplyByScalar(
          scratch.surfaceNormal,
          verticalSpeed,
          scratch.velocityStep,
        );
        Cesium.Cartesian3.subtract(drone.velocity, scratch.velocityStep, drone.velocity);
      }
    }
  }

  function updateCamera() {
    // Use geodetic surface normal (true world-up) so the horizon stays level.
    // The F-22 model visually rolls in the viewport; the sky never tilts.
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(drone.position, scratch.surfaceNormal);

    // Camera position: behind along forward, above along world-up
    Cesium.Cartesian3.multiplyByScalar(
      scratch.forward,
      FLIGHT.cameraForwardOffset,
      scratch.cameraOffset,
    );
    Cesium.Cartesian3.multiplyByScalar(scratch.surfaceNormal, FLIGHT.cameraUpOffset, scratch.upOffset);
    Cesium.Cartesian3.add(drone.position, scratch.cameraOffset, scratch.cameraPosition);
    Cesium.Cartesian3.add(scratch.cameraPosition, scratch.upOffset, scratch.cameraPosition);

    // Look directly AT the plane — F-22 always centered in viewport
    Cesium.Cartesian3.subtract(drone.position, scratch.cameraPosition, scratch.cameraOffset);
    Cesium.Cartesian3.normalize(scratch.cameraOffset, scratch.cameraOffset);

    viewer.camera.setView({
      destination: scratch.cameraPosition,
      orientation: {
        direction: scratch.cameraOffset,
        up: scratch.surfaceNormal,
      },
    });
  }

  function updateHudReadout() {
    Cesium.Cartographic.fromCartesian(drone.position, Cesium.Ellipsoid.WGS84, scratch.cartographic);
    const speedMetersPerSecond = Cesium.Cartesian3.magnitude(drone.velocity);
    const agl = Math.max(0.0, scratch.cartographic.height - drone.lastGroundHeight);
    const headingDeg = Cesium.Math.toDegrees(Cesium.Math.zeroToTwoPi(drone.heading));
    const pitchDeg = Cesium.Math.toDegrees(drone.pitch);
    const rollDeg = Cesium.Math.toDegrees(drone.roll);

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
    drone.velocity = new Cesium.Cartesian3(0.0, 0.0, 0.0);
    drone.heading = Cesium.Math.toRadians(200.0);
    drone.pitch = Cesium.Math.toRadians(-2.0);
    drone.roll = 0.0;
    gearDeployed = true;
    gearTransition = 1.0;
    updateDroneOrientation();
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
        resetPosition();
      }
      // Speed tier keys: 1 = 1x, 2 = 3x, 3 = 5x, 4 = 10x
      if (event.code === "Digit1") setSpeedTier(0);
      if (event.code === "Digit2") setSpeedTier(1);
      if (event.code === "Digit3") setSpeedTier(2);
      if (event.code === "Digit4") setSpeedTier(3);
      // Landing gear toggle
      if (event.code === "KeyG") {
        gearDeployed = !gearDeployed;
      }
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
    viewer.camera.frustum.fov = Cesium.Math.toRadians(92.0);
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
    // The F-22 is a Cesium entity so it always renders on the Cesium canvas (z-index 1), visible above overlay.

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

  function updateControlSurfaces(dt) {
    const smooth = 1.0 - Math.exp(-10.0 * dt);

    // Ailerons: opposite deflection for roll
    surfaceAngle.leftAileron += (-currentRollInput * SURFACE_LIMITS.aileron - surfaceAngle.leftAileron) * smooth;
    surfaceAngle.rightAileron += (currentRollInput * SURFACE_LIMITS.aileron - surfaceAngle.rightAileron) * smooth;

    // Inner flaps: follow ailerons with smaller deflection
    surfaceAngle.leftFlap += (-currentRollInput * SURFACE_LIMITS.flap - surfaceAngle.leftFlap) * smooth;
    surfaceAngle.rightFlap += (currentRollInput * SURFACE_LIMITS.flap - surfaceAngle.rightFlap) * smooth;

    // Elevators: same direction for pitch
    const elevTarget = currentPitchInput * SURFACE_LIMITS.elevator;
    surfaceAngle.leftElevator += (elevTarget - surfaceAngle.leftElevator) * smooth;
    surfaceAngle.rightElevator += (elevTarget - surfaceAngle.rightElevator) * smooth;

    // Rudders: opposite for yaw
    surfaceAngle.leftRudder += (currentYawInput * SURFACE_LIMITS.rudder - surfaceAngle.leftRudder) * smooth;
    surfaceAngle.rightRudder += (-currentYawInput * SURFACE_LIMITS.rudder - surfaceAngle.rightRudder) * smooth;

    // Build quaternions from axis-angle (X axis for flaps/elevators, Z for rudders)
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, surfaceAngle.leftAileron, surfaceQuat.leftAileron);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, surfaceAngle.rightAileron, surfaceQuat.rightAileron);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, surfaceAngle.leftFlap, surfaceQuat.leftFlap);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, surfaceAngle.rightFlap, surfaceQuat.rightFlap);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, surfaceAngle.leftElevator, surfaceQuat.leftElevator);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, surfaceAngle.rightElevator, surfaceQuat.rightElevator);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, surfaceAngle.leftRudder, surfaceQuat.leftRudder);
    Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, surfaceAngle.rightRudder, surfaceQuat.rightRudder);

    // Landing gear smooth retraction/deployment
    const gearTarget = gearDeployed ? 1.0 : 0.0;
    gearTransition += (gearTarget - gearTransition) * (1.0 - Math.exp(-3.0 * dt));
    if (gearTransition < 0.01) gearTransition = 0;
    if (gearTransition > 0.99) gearTransition = 1;
    gearScale.x = gearTransition;
    gearScale.y = gearTransition;
    gearScale.z = gearTransition;
  }

  function stepFrame(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now - lastTime) / 1000.0));
    lastTime = now;

    applyOrientationInput(dt);
    updateDroneOrientation();
    updateWorldAxes();
    applyTranslationalInput(dt);
    enforceTerrainClearance();
    updateWorldAxes();          // re-derive axes at final position for camera
    updateCamera();
    updateHudReadout();

    // Update control surface deflections and landing gear
    updateControlSurfaces(dt);

    // Update cloud immersion effects (fog overlay + Cesium visibility)
    updateCloudImmersion(dt);

    // Adaptive resolution scaling to maintain smooth FPS
    updateDynamicResolution(dt);

    // Update F-22 entity orientation (heading correction: +π for GLTF +Z nose, +π/2 for 90° CW)
    f22Hpr.heading = drone.heading + Math.PI * 1.5;
    f22Hpr.pitch = drone.pitch;
    f22Hpr.roll = drone.roll;
    Cesium.Transforms.headingPitchRollQuaternion(
      drone.position,
      f22Hpr,
      Cesium.Ellipsoid.WGS84,
      Cesium.Transforms.eastNorthUpToFixedFrame,
      f22Orientation,
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

      // Add F-22 as a Cesium entity so it renders on the Cesium canvas (z-index 1),
      // always visible above the Three.js sky/cloud overlay (z-index 0).
      f22Entity = viewer.entities.add({
        position: new Cesium.CallbackProperty(() => drone.position, false),
        orientation: new Cesium.CallbackProperty(() => f22Orientation, false),
        model: {
          uri: '/assets/f22.glb',
          minimumPixelSize: 64,
          scale: 1.0,
          nodeTransformations: {
            // Hide ground plane and bottom reference
            Ground: { scale: new Cesium.Cartesian3(0, 0, 0) },
            bottom1: { scale: new Cesium.Cartesian3(0, 0, 0) },
            // Ailerons (outer flaps)
            'F22_model1:Left_Outer_Flap': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.leftAileron, false),
            },
            'F22_model1:Right_Outer_Flap': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.rightAileron, false),
            },
            // Inner flaps
            'F22_model1:Left_Inner_Flap': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.leftFlap, false),
            },
            'F22_model1:Right_Inner_Flap': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.rightFlap, false),
            },
            // Elevators
            'F22_model1:Left_Elevator': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.leftElevator, false),
            },
            'F22_model1:Right_Elevator': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.rightElevator, false),
            },
            // Rudders (V-tails)
            'F22_model1:Left_Yaw': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.leftRudder, false),
            },
            'F22_model1:Right_Yaw': {
              rotation: new Cesium.CallbackProperty(() => surfaceQuat.rightRudder, false),
            },
            // Landing gear (smooth retract/deploy)
            'F22_model1:Front_Landing_Gear_Grp': {
              scale: new Cesium.CallbackProperty(() => gearScale, false),
            },
            'F22_model1:Left_Landing_Gear_Grp': {
              scale: new Cesium.CallbackProperty(() => gearScale, false),
            },
            'F22_model1:Right_Landing_Gear_Grp': {
              scale: new Cesium.CallbackProperty(() => gearScale, false),
            },
          },
        },
      });

      setupInputHandlers();

      // Create the cloud fog overlay element
      createCloudFogOverlay();

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
        "Flight active. W thrust, S brake, arrows control pitch and turn.",
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
