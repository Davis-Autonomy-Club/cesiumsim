import * as Cesium from 'cesium';

const DAVIS_CA = { longitude: -121.7405, latitude: 38.5449, altitude: 150 };

export class Scene {
  public viewer: Cesium.Viewer;
  public google3DTileset: Cesium.Cesium3DTileset | null = null;

  // Private constructor - use Scene.create() instead
  private constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  public static async create(containerId: string): Promise<Scene> {
    // Avoid Ion defaults (assets 1 & 2) which 404 for this token
    const viewer = new Cesium.Viewer(containerId, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      vrButton: false,
      shadows: true,
      shouldAnimate: true,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
    
    // Clear default imagery to avoid Ion 404s
    viewer.imageryLayers.removeAll();

    viewer.scene.globe.show = true;
    viewer.scene.mode = Cesium.SceneMode.SCENE3D;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;

    // Disable default controls - SpringArmCamera handles camera
    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.enableRotate = ctrl.enableTranslate = ctrl.enableZoom = false;
    ctrl.enableTilt = ctrl.enableLook = ctrl.enableInputs = false;
    
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    const creditContainer = viewer.bottomContainer as HTMLElement;
    if (creditContainer) {
      creditContainer.style.cssText = 'font-size:10px;opacity:0.5';
    }

    const scene = new Scene(viewer);
    const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    
    const isValidKey = googleMapsKey && googleMapsKey !== 'undefined' && googleMapsKey.length > 20;
    
    if (isValidKey) {
      console.log('[MAPS] Using Google Photorealistic 3D Tiles');
      viewer.scene.globe.show = false;
      await scene.loadGoogle3DTiles(googleMapsKey);
    } else {
      console.warn('🌍 Google Maps Key missing - using Cesium fallback');
      await Scene.loadTerrainAndImagery(viewer);
    }

    return scene;
  }

  private static async loadTerrainAndImagery(viewer: Cesium.Viewer): Promise<void> {
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    
    try {
      const imageryProvider = mapboxToken && mapboxToken !== 'undefined'
        ? new Cesium.MapboxImageryProvider({ mapId: 'mapbox.satellite', accessToken: mapboxToken })
        : await Cesium.IonImageryProvider.fromAssetId(3954);
      
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(imageryProvider);
    } catch (e) {
      console.error('Imagery load failed, keeping defaults:', e);
    }
  }

  private async loadGoogle3DTiles(apiKey: string): Promise<void> {
    const url = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`;

    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
        skipLevelOfDetail: true,
        skipScreenSpaceErrorFactor: 16,
        skipLevels: 1,
        dynamicScreenSpaceError: true,
        dynamicScreenSpaceErrorDensity: 0.00278,
        dynamicScreenSpaceErrorFactor: 4.0,
        dynamicScreenSpaceErrorHeightFalloff: 0.25,
        maximumScreenSpaceError: 16,
        cullRequestsWhileMoving: true,
        cullRequestsWhileMovingMultiplier: 60,
        preferLeaves: true,
        immediatelyLoadDesiredLevelOfDetail: false,
        loadSiblings: false,
        cullWithChildrenBounds: true,
        cacheBytes: 1024 * 1024 * 1024,
        maximumCacheOverflowBytes: 512 * 1024 * 1024,
      });

      this.viewer.scene.primitives.add(tileset);
      this.google3DTileset = tileset;
      
      this.viewer.creditDisplay.addStaticCredit(
        new Cesium.Credit('<a href="https://www.google.com/maps" target="_blank">Google Maps</a>', true)
      );
      
      await this.flyToDavis();
    } catch (error) {
      console.error('Google 3D Tiles failed, falling back:', error);
      this.viewer.scene.globe.show = true;
      await Scene.loadTerrainAndImagery(this.viewer);
    }
  }

  public flyToDavis(): Promise<void> {
    const dest = Cesium.Cartesian3.fromDegrees(DAVIS_CA.longitude, DAVIS_CA.latitude, DAVIS_CA.altitude);
    return new Promise(resolve => {
      this.viewer.camera.flyTo({
        destination: dest,
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-20), roll: 0 },
        duration: 2.0,
        complete: resolve,
      });
    });
  }

}

