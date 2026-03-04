import * as Cesium from 'cesium';
import { Scene } from '../core/Scene';
import { DroneViewer } from '../vehicles/DroneViewer';
import { Updatable } from '../core/GameLoop';

/**
 * Unreal Engine-style SpringArm camera using Cesium's lookAtTransform.
 * Uses ENU (East-North-Up) local frame for correct orbit at any Earth position.
 */
export class SpringArmCamera implements Updatable {
  private scene: Scene;
  private target: DroneViewer;

  // Spring arm state
  private armLength = 25;
  private targetArmLength = 25;
  private azimuth = 0;
  private targetAzimuth = 0;
  private elevation = Cesium.Math.toRadians(-25);
  private targetElevation = Cesium.Math.toRadians(-25);
  
  // Heading follow
  private followTargetHeading = true;
  private headingOffset = Math.PI;
  private currentHeadingFollow = 0;
  private targetHeadingFollow = 0;

  // Constraints
  private readonly MIN_ARM = 5;
  private readonly MAX_ARM = 150;
  private readonly MIN_ELEV = Cesium.Math.toRadians(-85);
  private readonly MAX_ELEV = Cesium.Math.toRadians(-5);

  // Damping
  private readonly ZOOM_DAMP = 0.08;
  private readonly ORBIT_DAMP = 0.10;
  private readonly HEADING_DAMP = 0.03;

  // Input sensitivity
  private readonly WHEEL_SPEED = 0.002;
  private readonly TRACKPAD_SPEED = 0.015;
  private readonly ORBIT_SPEED = 0.004;
  private readonly KEY_ZOOM = 5;
  private readonly KEY_ORBIT = Cesium.Math.toRadians(15);

  // Input state
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  // Bound handlers
  private onWheel: (e: WheelEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onContext: (e: Event) => void;

  private panel: HTMLElement | null = null;

  constructor(scene: Scene, target: DroneViewer) {
    this.scene = scene;
    this.target = target;

    const heading = this.getDroneHeadingENU();
    this.currentHeadingFollow = this.targetHeadingFollow = heading;

    this.disableCesiumControls();

    this.onWheel = this.handleWheel.bind(this);
    this.onMouseDown = this.handleMouseDown.bind(this);
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onMouseUp = this.handleMouseUp.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onContext = (e: Event) => e.preventDefault();

    this.setupListeners();
    this.createPanel();
  }

  private getDroneHeadingENU(): number {
    // Return heading in Cesium ENU format (North=0, CW+)
    return this.target.getHeading();
  }

  private disableCesiumControls(): void {
    this.scene.viewer.trackedEntity = undefined;
    const c = this.scene.viewer.scene.screenSpaceCameraController;
    c.enableRotate = c.enableTranslate = c.enableZoom = false;
    c.enableTilt = c.enableLook = c.enableInputs = false;
  }

  private setupListeners(): void {
    const canvas = this.scene.viewer.canvas;
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('contextmenu', this.onContext);
    canvas.style.cursor = 'grab';
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const speed = e.ctrlKey ? this.TRACKPAD_SPEED : this.WHEEL_SPEED;
    const delta = (e.ctrlKey ? e.deltaY : Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100)) * speed;
    this.targetArmLength = Cesium.Math.clamp(this.targetArmLength * (1 + delta), this.MIN_ARM, this.MAX_ARM);
    this.updatePanel();
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.scene.viewer.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.targetAzimuth += (e.clientX - this.lastX) * this.ORBIT_SPEED;
    this.targetElevation = Cesium.Math.clamp(
      this.targetElevation - (e.clientY - this.lastY) * this.ORBIT_SPEED,
      this.MIN_ELEV, this.MAX_ELEV
    );
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.updatePanel();
  }

  private handleMouseUp(e: MouseEvent): void {
    if ([0, 1, 2].includes(e.button)) {
      this.isDragging = false;
      this.scene.viewer.canvas.style.cursor = 'grab';
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case 'r': case 'R': this.reset(); break;
      case '+': case '=': this.zoomIn(); break;
      case '-': case '_': this.zoomOut(); break;
      case '[': this.orbitLeft(); break;
      case ']': this.orbitRight(); break;
      case 'ArrowUp': this.tiltUp(); e.preventDefault(); break;
      case 'ArrowDown': this.tiltDown(); e.preventDefault(); break;
    }
  }

  public zoomIn(): void {
    this.targetArmLength = Math.max(this.MIN_ARM, this.targetArmLength - this.KEY_ZOOM);
  }

  public zoomOut(): void {
    this.targetArmLength = Math.min(this.MAX_ARM, this.targetArmLength + this.KEY_ZOOM);
  }

  public orbitLeft(): void {
    this.targetAzimuth -= this.KEY_ORBIT;
  }

  public orbitRight(): void {
    this.targetAzimuth += this.KEY_ORBIT;
  }

  public tiltUp(): void {
    this.targetElevation = Math.min(this.MAX_ELEV, this.targetElevation + Cesium.Math.toRadians(5));
  }

  public tiltDown(): void {
    this.targetElevation = Math.max(this.MIN_ELEV, this.targetElevation - Cesium.Math.toRadians(5));
  }

  public reset(): void {
    this.targetArmLength = this.armLength = 25;
    this.targetAzimuth = this.azimuth = 0;
    this.targetElevation = this.elevation = Cesium.Math.toRadians(-25);
    this.currentHeadingFollow = this.targetHeadingFollow = this.getDroneHeadingENU();
    this.updatePanel();
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpAngle(cur: number, tgt: number, t: number): number {
    let diff = tgt - cur;
    while (diff > Math.PI) diff -= Cesium.Math.TWO_PI;
    while (diff < -Math.PI) diff += Cesium.Math.TWO_PI;
    return cur + diff * t;
  }

  update(_dt: number): void {
    const pos = this.target.getPosition();
    if (!pos) return;

    // Smooth interpolation
    this.armLength = this.lerp(this.armLength, this.targetArmLength, this.ZOOM_DAMP);
    this.azimuth = this.lerpAngle(this.azimuth, this.targetAzimuth, this.ORBIT_DAMP);
    this.elevation = this.lerp(this.elevation, this.targetElevation, this.ORBIT_DAMP);

    if (this.followTargetHeading) {
      this.targetHeadingFollow = this.getDroneHeadingENU();
      this.currentHeadingFollow = this.lerpAngle(this.currentHeadingFollow, this.targetHeadingFollow, this.HEADING_DAMP);
    }

    const finalHeading = this.currentHeadingFollow + this.headingOffset + this.azimuth;
    const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(pos);

    this.scene.viewer.camera.lookAtTransform(
      enuTransform,
      new Cesium.HeadingPitchRange(finalHeading, this.elevation, this.armLength)
    );

    if (Math.random() < 0.1) this.updatePanel();
  }

  private createPanel(): void {
    document.getElementById('camera-controls')?.remove();

    const panel = document.createElement('div');
    panel.id = 'camera-controls';
    panel.innerHTML = `
      <style>
        #camera-controls {
          position: absolute; top: 16px; right: 16px;
          background: rgba(0,0,0,0.9); color: #0f8;
          font: 11px 'JetBrains Mono', monospace;
          padding: 14px; border-radius: 10px;
          border: 1px solid rgba(0,255,136,0.4);
          z-index: 100; min-width: 200px;
          backdrop-filter: blur(8px);
        }
        #camera-controls h4 { margin: 0 0 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,255,136,0.3); color: #fff; font-size: 13px; }
        #camera-controls .row { display: flex; gap: 6px; margin-bottom: 8px; }
        #camera-controls button {
          flex: 1; padding: 10px 6px;
          background: rgba(0,255,136,0.12); border: 1px solid rgba(0,255,136,0.35);
          color: #0f8; font: inherit; cursor: pointer; border-radius: 6px; transition: all 0.12s;
        }
        #camera-controls button:hover { background: rgba(0,255,136,0.25); border-color: #0f8; }
        #camera-controls button:active { background: rgba(0,255,136,0.4); transform: scale(0.97); }
        #camera-controls .display { background: rgba(0,0,0,0.6); padding: 10px 12px; border-radius: 6px; margin-top: 10px; line-height: 1.7; }
        #camera-controls .label { color: #888; }
        #camera-controls .value { color: #0f8; float: right; font-weight: 600; }
        #camera-controls .rst { background: rgba(255,80,80,0.15)!important; border-color: rgba(255,80,80,0.4)!important; color: #f66!important; }
      </style>
      <h4>CAMERA</h4>
      <div class="row"><button id="cam-zi">Zoom +</button><button id="cam-zo">Zoom −</button></div>
      <div class="row"><button id="cam-ol">◀ Orbit</button><button id="cam-or">Orbit ▶</button></div>
      <div class="row"><button id="cam-tu">▲ Tilt</button><button id="cam-td">▼ Tilt</button></div>
      <div class="row"><button id="cam-rs" class="rst">⟲ Reset</button></div>
      <div class="display">
        <div><span class="label">Arm:</span> <span class="value" id="cam-arm">25.0m</span></div>
        <div><span class="label">Azimuth:</span> <span class="value" id="cam-az">0.0°</span></div>
        <div><span class="label">Elevation:</span> <span class="value" id="cam-el">−25.0°</span></div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    document.getElementById('cam-zi')?.addEventListener('click', () => this.zoomIn());
    document.getElementById('cam-zo')?.addEventListener('click', () => this.zoomOut());
    document.getElementById('cam-ol')?.addEventListener('click', () => this.orbitLeft());
    document.getElementById('cam-or')?.addEventListener('click', () => this.orbitRight());
    document.getElementById('cam-tu')?.addEventListener('click', () => this.tiltUp());
    document.getElementById('cam-td')?.addEventListener('click', () => this.tiltDown());
    document.getElementById('cam-rs')?.addEventListener('click', () => this.reset());
  }

  private updatePanel(): void {
    const arm = document.getElementById('cam-arm');
    const az = document.getElementById('cam-az');
    const el = document.getElementById('cam-el');
    if (arm) arm.textContent = `${this.armLength.toFixed(1)}m`;
    if (az) az.textContent = `${Cesium.Math.toDegrees(this.azimuth).toFixed(1)}°`;
    if (el) el.textContent = `${Cesium.Math.toDegrees(this.elevation).toFixed(1)}°`;
  }

  destroy(): void {
    const canvas = this.scene.viewer.canvas;
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    canvas.removeEventListener('contextmenu', this.onContext);
    this.panel?.remove();
    this.scene.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
}
