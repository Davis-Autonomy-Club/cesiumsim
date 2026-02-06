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

  const FLIGHT = {
    forwardAcceleration: 44.0,
    strafeAcceleration: 34.0,
    verticalAcceleration: 28.0,
    maxSpeedMetersPerSecond: 92.0,
    linearDrag: 1.5,
    boostMultiplier: 1.7,
    mouseSensitivity: 0.00175,
    keyboardYawRate: Cesium.Math.toRadians(60.0),
    keyboardPitchRate: Cesium.Math.toRadians(42.0),
    rollRate: Cesium.Math.toRadians(72.0),
    autoLevelRollRate: 5.6,
    maxPitch: Cesium.Math.toRadians(85.0),
    maxRoll: Cesium.Math.toRadians(82.0),
    minimumClearance: 4.0,
    cameraForwardOffset: 0.65,
    cameraUpOffset: 0.4,
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
    engageBtn: document.getElementById("engage-btn"),
  };

  if (!window.Cesium) {
    HUD.datasetStatus.textContent = "Cesium failed to load. Refresh and try again.";
    HUD.flightStatus.textContent = "Startup aborted.";
    return;
  }

  const KEY_BLOCKLIST = new Set([
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ShiftLeft",
    "ShiftRight",
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
  let pointerLocked = false;
  let mouseDeltaX = 0.0;
  let mouseDeltaY = 0.0;
  let viewer = null;
  let lastTime = performance.now();

  function setFlightStatus(text, isWarning) {
    HUD.flightStatus.textContent = text;
    HUD.flightStatus.style.color = isWarning ? "#ffd36f" : "#d9ecff";
  }

  function isDown(code) {
    return keyState.has(code);
  }

  function updatePointerLockState() {
    if (!viewer) {
      return;
    }
    pointerLocked = document.pointerLockElement === viewer.canvas;
    if (pointerLocked) {
      HUD.engageBtn.textContent = "FPV Controls Engaged";
      setFlightStatus(
        "FPV active. Mouse steers orientation; keyboard controls thrust.",
        false,
      );
    } else {
      HUD.engageBtn.textContent = "Engage FPV Controls";
      setFlightStatus(
        "FPV paused (mouse unlocked). Click Engage or click the viewport.",
        true,
      );
    }
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
    Cesium.Transforms.headingPitchRollToFixedFrame(
      drone.position,
      scratch.hpr,
      Cesium.Ellipsoid.WGS84,
      Cesium.Transforms.eastNorthUpToFixedFrame,
      scratch.transform,
    );
    Cesium.Matrix4.multiplyByPointAsVector(
      scratch.transform,
      Cesium.Cartesian3.UNIT_Y,
      scratch.forward,
    );
    Cesium.Matrix4.multiplyByPointAsVector(
      scratch.transform,
      Cesium.Cartesian3.UNIT_X,
      scratch.right,
    );
    Cesium.Matrix4.multiplyByPointAsVector(
      scratch.transform,
      Cesium.Cartesian3.UNIT_Z,
      scratch.up,
    );
    Cesium.Cartesian3.normalize(scratch.forward, scratch.forward);
    Cesium.Cartesian3.normalize(scratch.right, scratch.right);
    Cesium.Cartesian3.normalize(scratch.up, scratch.up);
  }

  function applyOrientationInput(dt) {
    if (pointerLocked) {
      drone.heading -= mouseDeltaX * FLIGHT.mouseSensitivity;
      drone.pitch -= mouseDeltaY * FLIGHT.mouseSensitivity;
    }
    mouseDeltaX = 0.0;
    mouseDeltaY = 0.0;

    const yawInput = (isDown("ArrowRight") ? 1 : 0) - (isDown("ArrowLeft") ? 1 : 0);
    const pitchInput = (isDown("ArrowUp") ? 1 : 0) - (isDown("ArrowDown") ? 1 : 0);
    const rollInput = (isDown("KeyE") ? 1 : 0) - (isDown("KeyQ") ? 1 : 0);

    drone.heading += yawInput * FLIGHT.keyboardYawRate * dt;
    drone.pitch += pitchInput * FLIGHT.keyboardPitchRate * dt;
    drone.roll += rollInput * FLIGHT.rollRate * dt;

    if (rollInput === 0) {
      const alpha = 1.0 - Math.exp(-FLIGHT.autoLevelRollRate * dt);
      drone.roll = Cesium.Math.lerp(drone.roll, 0.0, alpha);
    }

    drone.pitch = Cesium.Math.clamp(drone.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch);
    drone.roll = Cesium.Math.clamp(drone.roll, -FLIGHT.maxRoll, FLIGHT.maxRoll);
    drone.heading = Cesium.Math.zeroToTwoPi(drone.heading);
  }

  function applyTranslationalInput(dt) {
    const forwardInput = (isDown("KeyW") ? 1 : 0) - (isDown("KeyS") ? 1 : 0);
    const strafeInput = (isDown("KeyD") ? 1 : 0) - (isDown("KeyA") ? 1 : 0);
    const verticalInput = (isDown("Space") ? 1 : 0) - (isDown("ShiftLeft") || isDown("ShiftRight") ? 1 : 0);
    const boost = isDown("ControlLeft") || isDown("ControlRight") ? FLIGHT.boostMultiplier : 1.0;

    scratch.acceleration.x = 0.0;
    scratch.acceleration.y = 0.0;
    scratch.acceleration.z = 0.0;

    Cesium.Cartesian3.multiplyByScalar(
      scratch.forward,
      forwardInput * FLIGHT.forwardAcceleration * boost,
      scratch.velocityStep,
    );
    Cesium.Cartesian3.add(scratch.acceleration, scratch.velocityStep, scratch.acceleration);

    Cesium.Cartesian3.multiplyByScalar(
      scratch.right,
      strafeInput * FLIGHT.strafeAcceleration,
      scratch.velocityStep,
    );
    Cesium.Cartesian3.add(scratch.acceleration, scratch.velocityStep, scratch.acceleration);

    Cesium.Cartesian3.multiplyByScalar(
      scratch.up,
      verticalInput * FLIGHT.verticalAcceleration,
      scratch.velocityStep,
    );
    Cesium.Cartesian3.add(scratch.acceleration, scratch.velocityStep, scratch.acceleration);

    Cesium.Cartesian3.multiplyByScalar(scratch.acceleration, dt, scratch.velocityStep);
    Cesium.Cartesian3.add(drone.velocity, scratch.velocityStep, drone.velocity);

    const drag = Math.exp(-FLIGHT.linearDrag * dt);
    Cesium.Cartesian3.multiplyByScalar(drone.velocity, drag, drone.velocity);

    const speed = Cesium.Cartesian3.magnitude(drone.velocity);
    if (speed > FLIGHT.maxSpeedMetersPerSecond) {
      Cesium.Cartesian3.multiplyByScalar(
        drone.velocity,
        FLIGHT.maxSpeedMetersPerSecond / speed,
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
    Cesium.Cartesian3.multiplyByScalar(
      scratch.forward,
      FLIGHT.cameraForwardOffset,
      scratch.cameraOffset,
    );
    Cesium.Cartesian3.multiplyByScalar(scratch.up, FLIGHT.cameraUpOffset, scratch.upOffset);
    Cesium.Cartesian3.add(drone.position, scratch.cameraOffset, scratch.cameraPosition);
    Cesium.Cartesian3.add(scratch.cameraPosition, scratch.upOffset, scratch.cameraPosition);

    viewer.camera.setView({
      destination: scratch.cameraPosition,
      orientation: {
        heading: drone.heading,
        pitch: drone.pitch,
        roll: drone.roll,
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
    drone.position = Cesium.Cartesian3.fromDegrees(
      START_LOCATION.longitude,
      START_LOCATION.latitude,
      START_LOCATION.height,
    );
    drone.velocity = new Cesium.Cartesian3(0.0, 0.0, 0.0);
    drone.heading = Cesium.Math.toRadians(200.0);
    drone.pitch = Cesium.Math.toRadians(-2.0);
    drone.roll = 0.0;
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
    });

    document.addEventListener("keyup", (event) => {
      keyState.delete(event.code);
    });

    document.addEventListener("mousemove", (event) => {
      if (!pointerLocked) {
        return;
      }
      mouseDeltaX += event.movementX;
      mouseDeltaY += event.movementY;
    });

    document.addEventListener("pointerlockchange", updatePointerLockState);

    HUD.engageBtn.addEventListener("click", () => {
      viewer.canvas.requestPointerLock();
    });

    viewer.canvas.addEventListener("click", () => {
      if (!pointerLocked) {
        viewer.canvas.requestPointerLock();
      }
    });
  }

  async function buildViewer() {
    let terrainProvider = new Cesium.EllipsoidTerrainProvider();
    try {
      terrainProvider = await Cesium.createWorldTerrainAsync({
        requestWaterMask: true,
        requestVertexNormals: true,
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
      requestRenderMode: false,
    });

    viewer.scene.screenSpaceCameraController.enableInputs = false;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.maximumScreenSpaceError = 0.85;
    viewer.scene.highDynamicRange = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.moon.show = false;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0001;
    viewer.scene.shadowMap.enabled = true;
    viewer.shadows = true;
    viewer.clock.shouldAnimate = true;
    viewer.clock.multiplier = 1.0;

    if (viewer.scene.postProcessStages && viewer.scene.postProcessStages.fxaa) {
      viewer.scene.postProcessStages.fxaa.enabled = true;
    }
    if ("msaaSamples" in viewer.scene) {
      viewer.scene.msaaSamples = 4;
    }

    viewer.resolutionScale = Math.min(2.0, window.devicePixelRatio || 1.0);
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
        datasetStatus = "Cesium World Terrain + OSM Buildings";
      } catch (error) {
        console.warn("OSM Buildings failed to load:", error);
      }
    }

    HUD.datasetStatus.textContent = `Active world stack: ${datasetStatus}`;
  }

  function stepFrame(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000.0));
    lastTime = now;

    applyOrientationInput(dt);
    updateDroneOrientation();
    updateWorldAxes();
    applyTranslationalInput(dt);
    enforceTerrainClearance();
    updateDroneOrientation();
    updateWorldAxes();
    updateCamera();
    updateHudReadout();
  }

  async function init() {
    HUD.datasetStatus.textContent = "Booting Cesium viewer and streaming terrain...";
    try {
      await buildViewer();
      await loadWorldDetailLayers();
      setupInputHandlers();

      resetPosition();
      lastTime = performance.now();
      viewer.clock.onTick.addEventListener(() => {
        stepFrame(performance.now());
      });

      setFlightStatus(
        "Click Engage to lock pointer and start first-person flight.",
        true,
      );
    } catch (error) {
      console.error(error);
      HUD.datasetStatus.textContent = "Initialization failed.";
      setFlightStatus("Check browser console for the startup error.", true);
    }
  }

  init();
})();
