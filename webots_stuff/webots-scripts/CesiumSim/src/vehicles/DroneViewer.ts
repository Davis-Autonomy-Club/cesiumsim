import * as Cesium from 'cesium';
import { Scene } from '../core/Scene';
import { Updatable } from '../core/GameLoop';

/**
 * DroneViewer - Clean 3D Drone Model Viewer
 * 
 * A minimal drone entity for visualization purposes only.
 * Provides a beautiful drone model on 3D tiles with camera tracking.
 */
export class DroneViewer implements Updatable {
  public entity: Cesium.Entity;
  public model: Cesium.Model | null = null;
  
  private scene: Scene;
  
  // Position state
  public position: Cesium.Cartesian3;
  public heading: number = 0;
  
  // Attitude (for visual display)
  private roll: number = 0;
  private pitch: number = 0;
  private yaw: number = 0;
  
  // Model Configuration - CesiumDrone GLB
  private readonly DRONE_MODEL_URL = 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb';
  private readonly MODEL_SCALE = 1.0;
  private readonly HEADING_OFFSET = Cesium.Math.toRadians(90);  // Model faces +X, align to North
  
  constructor(scene: Scene, startPos: Cesium.Cartesian3) {
    this.scene = scene;
    this.position = Cesium.Cartesian3.clone(startPos);
    
    // Create placeholder entity (hidden once model loads)
    this.entity = this.scene.viewer.entities.add({
      position: startPos,
      box: {
        dimensions: new Cesium.Cartesian3(0.8, 0.8, 0.3),
        material: Cesium.Color.fromCssColorString('#00FFAA').withAlpha(0.8),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    });
    
    // Load 3D drone model
    this.loadDroneModel();
    
    console.log('[DroneViewer] Initialized at position');
  }
  
  /**
   * Load CesiumDrone GLB Model
   */
  private async loadDroneModel(): Promise<void> {
    try {
      console.log('[DroneViewer] Loading drone model...');
      
      const hpr = new Cesium.HeadingPitchRoll(this.HEADING_OFFSET, 0, 0);
      const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
        this.position,
        hpr,
        Cesium.Ellipsoid.WGS84,
        Cesium.Transforms.localFrameToFixedFrameGenerator('north', 'west')
      );
      
      this.model = await Cesium.Model.fromGltfAsync({
        url: this.DRONE_MODEL_URL,
        modelMatrix: modelMatrix,
        scale: this.MODEL_SCALE,
        minimumPixelSize: 64,
        maximumScale: 20,
        shadows: Cesium.ShadowMode.DISABLED,
        silhouetteColor: Cesium.Color.fromCssColorString('#00FF88'),
        silhouetteSize: 0.0,
        color: Cesium.Color.WHITE,
        colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
        colorBlendAmount: 0.0,
      });
      
      this.scene.viewer.scene.primitives.add(this.model);
      
      await this.model.readyEvent;
      
      // Enable propeller animations
      if (this.model.activeAnimations) {
        try {
          this.model.activeAnimations.addAll({
            loop: Cesium.ModelAnimationLoop.REPEAT,
            multiplier: 3.0,
          });
          console.log('[DroneViewer] Propeller animations enabled');
        } catch {
          // Fallback: individual animations
          for (let i = 0; i < 4; i++) {
            try {
              this.model.activeAnimations.add({
                index: i,
                loop: Cesium.ModelAnimationLoop.REPEAT,
                multiplier: 3.0,
              });
            } catch { /* ignore */ }
          }
        }
      }
      
      // Hide placeholder box
      if (this.entity.box) {
        this.entity.box.show = new Cesium.ConstantProperty(false);
      }
      
      console.log('[DroneViewer] Model loaded successfully');
      
    } catch (error) {
      console.error('[DroneViewer] Model load failed:', error);
      console.log('[DroneViewer] Using fallback box');
      
      this.model = null;
      if (this.entity.box) {
        this.entity.box.show = new Cesium.ConstantProperty(true);
      }
    }
  }
  
  /**
   * Update loop - syncs entity with current state
   */
  update(_dt: number): void {
    // Update entity position
    this.entity.position = new Cesium.ConstantPositionProperty(this.position);
    
    // Create orientation
    const hpr = new Cesium.HeadingPitchRoll(this.yaw, this.pitch, this.roll);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(this.position, hpr);
    this.entity.orientation = new Cesium.ConstantProperty(orientation);
    
    // Update 3D model matrix
    if (this.model) {
      const correctedHpr = new Cesium.HeadingPitchRoll(
        this.yaw + this.HEADING_OFFSET,
        this.pitch,
        this.roll
      );
      const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
        this.position,
        correctedHpr,
        Cesium.Ellipsoid.WGS84,
        Cesium.Transforms.localFrameToFixedFrameGenerator('north', 'west')
      );
      this.model.modelMatrix = modelMatrix;
    }
  }
  
  // Public API for camera compatibility
  
  getPosition(): Cesium.Cartesian3 {
    return this.position;
  }
  
  getHeading(): number {
    return this.heading;
  }
  
  /**
   * Set drone position (for external control if needed)
   */
  setPosition(lon: number, lat: number, alt: number): void {
    this.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  }
  
  /**
   * Set drone attitude (for external control if needed)
   */
  setAttitude(roll: number, pitch: number, yaw: number): void {
    this.roll = roll;
    this.pitch = pitch;
    this.yaw = yaw;
    this.heading = yaw;
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    if (this.model) {
      this.scene.viewer.scene.primitives.remove(this.model);
    }
    this.scene.viewer.entities.remove(this.entity);
    console.log('[DroneViewer] Destroyed');
  }
}
