// training-world.js — Stripped-down Cesium viewer for RL training
// Flat terrain (EllipsoidTerrainProvider), no Google tiles, no Three.js overlay

/**
 * Create a minimal Cesium viewer for RL training.
 * @param {string} containerId - DOM element ID for the viewer
 * @returns {Promise<Cesium.Viewer>}
 */
export async function createTrainingViewer(containerId) {
  const viewer = new Cesium.Viewer(containerId, {
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    animation: false,
    timeline: false,
    fullscreenButton: false,
    sceneModePicker: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    shouldAnimate: false,
    baseLayerPicker: false,
    scene3DOnly: true,
    requestRenderMode: true,
    orderIndependentTranslucency: false,
    contextOptions: {
      webgl: {
        alpha: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
        antialias: false,
        stencil: false,
        preserveDrawingBuffer: true, // needed for readPixels frame capture
      },
    },
  });

  // Disable user camera interaction — drone controls the camera
  viewer.scene.screenSpaceCameraController.enableInputs = false;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.globe.enableLighting = false;
  viewer.scene.globe.maximumScreenSpaceError = 2.0;
  viewer.scene.globe.showGroundAtmosphere = false;
  viewer.scene.highDynamicRange = false;

  // Disable all sky elements
  viewer.scene.skyAtmosphere.show = false;
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
  if (viewer.scene.sun) viewer.scene.sun.show = false;
  viewer.scene.moon.show = false;
  viewer.scene.backgroundColor = new Cesium.Color(0.5, 0.6, 0.8, 1.0); // light sky blue
  viewer.scene.fog.enabled = false;
  viewer.scene.shadowMap.enabled = false;
  viewer.shadows = false;

  // Freeze clock
  viewer.clock.shouldAnimate = false;
  viewer.clock.multiplier = 0;
  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2024-06-21T12:00:00Z');

  // Disable post-processing
  if (viewer.scene.postProcessStages?.fxaa) {
    viewer.scene.postProcessStages.fxaa.enabled = false;
  }
  if ('msaaSamples' in viewer.scene) {
    viewer.scene.msaaSamples = 1;
  }

  viewer.resolutionScale = 1.0;

  // Remove default imagery layer (satellite basemap) — we use a solid color ground plane
  viewer.imageryLayers.removeAll();

  return viewer;
}

/**
 * Create a solid-color ground rectangle entity for the arena.
 * @param {Cesium.Viewer} viewer
 * @param {number} arenaSize - side length in meters
 * @param {Cesium.Color} color - ground color
 * @param {number} centerLon - center longitude in degrees (default 0)
 * @param {number} centerLat - center latitude in degrees (default 0)
 * @returns {Cesium.Entity}
 */
export function createGroundPlane(viewer, arenaSize, color, centerLon = 0, centerLat = 0) {
  // Convert meters to approximate degrees (at equator, 1 deg ≈ 111,320 m)
  const halfDeg = (arenaSize / 2) / 111320;

  return viewer.entities.add({
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(
        centerLon - halfDeg,
        centerLat - halfDeg,
        centerLon + halfDeg,
        centerLat + halfDeg,
      ),
      height: 0,
      material: color,
    },
  });
}

/**
 * Remove all entities from viewer.
 * @param {Cesium.Viewer} viewer
 */
export function clearArena(viewer) {
  viewer.entities.removeAll();
}

/**
 * Set the background sky color for training.
 * @param {Cesium.Viewer} viewer
 * @param {Cesium.Color} color
 */
export function setBackgroundColor(viewer, color) {
  viewer.scene.backgroundColor = color;
}

/**
 * Set the camera FOV.
 * @param {Cesium.Viewer} viewer
 * @param {number} fovRadians
 */
export function setCameraFOV(viewer, fovRadians) {
  viewer.camera.frustum.fov = fovRadians;
}
