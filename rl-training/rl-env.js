// rl-env.js — Gym-like RL interface: reset(), step(action), observe()
// Self-contained drone physics adapted from simulator-app.ts

import { createTrainingViewer, createGroundPlane, clearArena, setBackgroundColor, setCameraFOV } from './training-world.js';
import { generateCity, deactivateWaypoint } from './procedural-city.js';
import { RewardEngine } from './reward-engine.js';
import { TaskCurriculum, generateLevel4Instruction, generateLevel5Mission } from './task-curriculum.js';
import { randomizeEpisode } from './domain-randomizer.js';

// Flight physics constants (matching simulator-app.ts config.ts)
const FLIGHT = {
  horizontalAcceleration: 22.0,
  maxHorizontalSpeed: 20.0,
  horizontalDrag: 6.0,
  verticalAcceleration: 14.0,
  maxVerticalSpeed: 10.0,
  verticalDrag: 5.0,
  yawRate: Math.PI / 2, // 90 deg/s
  maxVisualPitch: Math.PI * 25 / 180,
  maxVisualRoll: Math.PI * 15 / 180,
  visualTiltRate: 5.0,
  visualTiltReturn: 6.0,
  minimumClearance: 2.0,
};

// Observation constants
const FRAME_WIDTH = 160;
const FRAME_HEIGHT = 120;
const FRAME_STACK = 4;
const STATE_VECTOR_SIZE = 12;
const CONTROL_HZ = 10;         // actions per second
const SIM_FPS = 60;
const FRAMES_PER_ACTION = SIM_FPS / CONTROL_HZ; // 6

/**
 * The main RL environment.
 */
export class RLEnv {
  /**
   * @param {string} containerId - DOM element for Cesium viewer
   * @param {object} options
   * @param {number} options.startLevel - starting curriculum level (1-5)
   * @param {boolean} options.manualMode - if true, skip auto-step and allow keyboard control
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.viewer = null;
    this.curriculum = new TaskCurriculum(options.startLevel || 1);
    this.rewardEngine = new RewardEngine();
    this.manualMode = options.manualMode || false;
    this.initialized = false;

    // Drone state
    this.drone = null;
    this.scratch = null;

    // Cesium entities
    this.droneEntity = null;
    this.groundEntity = null;

    // City info from last generation
    this.cityInfo = null;
    this.genConfig = null;
    this.randomConfig = null;

    // Episode state
    this.episodeStep = 0;
    this.episodeReward = 0;
    this.done = true;

    // Frame buffer for stacking
    this.frameBuffer = [];

    // For manual keyboard control
    this.keyState = new Set();

    // Offscreen canvas for frame downscaling
    this._offscreenCanvas = null;
    this._offscreenCtx = null;
  }

  /**
   * Initialize the Cesium viewer. Must be called once before reset().
   */
  async init() {
    this.viewer = await createTrainingViewer(this.containerId);
    this.initialized = true;

    // Create scratch objects for physics (avoid GC pressure)
    this.scratch = {
      transform: new Cesium.Matrix4(),
      horizontalForward: new Cesium.Cartesian3(),
      horizontalRight: new Cesium.Cartesian3(),
      surfaceNormal: new Cesium.Cartesian3(),
      velocityStep: new Cesium.Cartesian3(),
      movementStep: new Cesium.Cartesian3(),
      verticalStep: new Cesium.Cartesian3(),
      acceleration: new Cesium.Cartesian3(),
      cartographic: new Cesium.Cartographic(),
      forward: new Cesium.Cartesian3(),
      cameraOffset: new Cesium.Cartesian3(),
      upOffset: new Cesium.Cartesian3(),
    };

    // Offscreen canvas for frame capture
    this._offscreenCanvas = document.createElement('canvas');
    this._offscreenCanvas.width = FRAME_WIDTH;
    this._offscreenCanvas.height = FRAME_HEIGHT;
    this._offscreenCtx = this._offscreenCanvas.getContext('2d');

    // Keyboard handler for manual mode
    if (this.manualMode) {
      document.addEventListener('keydown', (e) => this.keyState.add(e.code));
      document.addEventListener('keyup', (e) => this.keyState.delete(e.code));
    }

    return this;
  }

  /**
   * Reset the environment for a new episode.
   * @returns {object} initial observation
   */
  reset() {
    if (!this.initialized) throw new Error('Call init() before reset()');

    // Clear previous entities
    clearArena(this.viewer);

    // Get task config from curriculum
    this.genConfig = this.curriculum.getGenerationConfig();

    // Domain randomization
    this.randomConfig = randomizeEpisode(this.genConfig.difficulty);

    // Apply visual randomization
    setBackgroundColor(this.viewer, this.randomConfig.skyColor);
    setCameraFOV(this.viewer, this.randomConfig.fovRad);

    if (this.randomConfig.fogDensity > 0) {
      this.viewer.scene.fog.enabled = true;
      this.viewer.scene.fog.density = this.randomConfig.fogDensity;
    } else {
      this.viewer.scene.fog.enabled = false;
    }

    // Create ground plane
    this.groundEntity = createGroundPlane(
      this.viewer,
      this.genConfig.arenaSize,
      this.randomConfig.groundColor,
    );

    // Generate city (buildings, waypoints, LZs)
    let textInstruction = null;
    let targetColorName = null;
    let objectives = [];

    if (this.genConfig.level === 4) {
      const instrResult = generateLevel4Instruction({});
      textInstruction = instrResult.text;
      targetColorName = instrResult.targetColor;
    } else if (this.genConfig.level === 5) {
      const missionResult = generateLevel5Mission({});
      textInstruction = missionResult.text;
      objectives = missionResult.objectives;
    }

    this.cityInfo = generateCity(this.viewer, {
      ...this.genConfig,
      buildingColors: this.randomConfig.buildingColors,
      heightMultiplier: this.randomConfig.heightMultiplier,
      targetColorName,
    });

    // Store objectives and text for the config
    this.genConfig.objectives = objectives;
    this.genConfig.textInstruction = textInstruction;

    // Reset drone state
    const spawnLon = this.cityInfo.spawnPos.lon;
    const spawnLat = this.cityInfo.spawnPos.lat;
    const spawnHeight = this.genConfig.level === 1 ? 0.5 : 10; // Level 1 starts on ground

    this.drone = {
      position: Cesium.Cartesian3.fromDegrees(spawnLon, spawnLat, spawnHeight),
      horizontalVelocity: new Cesium.Cartesian3(0, 0, 0),
      verticalSpeed: 0,
      heading: this.randomConfig.spawnHeading,
      visualPitch: 0,
      visualRoll: 0,
      lastGroundHeight: 0,
    };

    // Create drone entity (simple point for training, or model if available)
    const droneModelOrientation = new Cesium.Quaternion();
    const droneHpr = new Cesium.HeadingPitchRoll();
    this._droneHpr = droneHpr;
    this._droneModelOrientation = droneModelOrientation;

    this.droneEntity = this.viewer.entities.add({
      position: new Cesium.CallbackProperty(() => this.drone.position, false),
      orientation: new Cesium.CallbackProperty(() => this._droneModelOrientation, false),
      point: {
        pixelSize: 8,
        color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // Reset reward engine
    this.rewardEngine.reset(this.genConfig, this.cityInfo);

    // Reset episode counters
    this.episodeStep = 0;
    this.episodeReward = 0;
    this.done = false;

    // Clear frame buffer
    this.frameBuffer = [];

    // Initial camera update
    this._updateCamera();
    this.viewer.scene.requestRender();

    // Capture initial frames (fill buffer with identical first frame)
    const frame = this._captureFrame();
    for (let i = 0; i < FRAME_STACK; i++) {
      this.frameBuffer.push(frame);
    }

    return this.observe();
  }

  /**
   * Take one action step in the environment.
   * Action is held for FRAMES_PER_ACTION simulation frames (6 frames at 60fps = 10Hz control).
   *
   * @param {number[]} action - 4D continuous [-1, 1]: [forward/back, strafe L/R, ascend/descend, yaw L/R]
   * @returns {{ observation: object, reward: number, done: boolean, info: object }}
   */
  step(action) {
    if (this.done) {
      console.warn('Episode is done. Call reset() to start a new episode.');
      return { observation: this.observe(), reward: 0, done: true, info: { warning: 'episode_done' } };
    }

    // Clamp actions to [-1, 1]
    const a = action.map(v => Math.max(-1, Math.min(1, v)));

    let totalReward = 0;
    let stepInfo = {};
    const dt = 1 / SIM_FPS;

    // Simulate FRAMES_PER_ACTION physics steps with the same action
    for (let f = 0; f < FRAMES_PER_ACTION && !this.done; f++) {
      // Apply physics
      this._applyOrientationInput(a, dt);
      this._updateHorizontalAxes();
      this._applyDroneMovement(a, dt);
      this._enforceTerrainClearance();
      this._updateHorizontalAxes();
      this._enforceBuildingCollision();
      this._updateCamera();

      // Get drone state for reward computation
      const state = this._getDroneState();

      // Compute reward
      const result = this.rewardEngine.step(state, dt);
      totalReward += result.reward;
      this.done = result.done;
      stepInfo = { ...stepInfo, ...result.info };

      if (result.done) {
        this.rewardEngine.success = result.success;
        break;
      }

      // Apply wind (domain randomization)
      this._applyWind(dt);
    }

    // Render and capture frame
    this.viewer.scene.requestRender();
    const frame = this._captureFrame();
    this.frameBuffer.push(frame);
    if (this.frameBuffer.length > FRAME_STACK) {
      this.frameBuffer.shift();
    }

    this.episodeStep++;
    this.episodeReward += totalReward;

    // Report to curriculum if done
    if (this.done) {
      this.curriculum.reportEpisodeResult(this.rewardEngine.success);
      stepInfo.episodeReward = this.episodeReward;
      stepInfo.episodeSteps = this.episodeStep;
      stepInfo.success = this.rewardEngine.success;
    }

    return {
      observation: this.observe(),
      reward: totalReward,
      done: this.done,
      info: stepInfo,
    };
  }

  /**
   * Get the current observation.
   * @returns {{ frames: Uint8Array[], stateVector: Float32Array, taskText: number[] }}
   */
  observe() {
    const state = this._getDroneState();

    // State vector: 12 floats
    const stateVector = new Float32Array([
      state.speed,
      state.verticalSpeed,
      state.agl,
      Math.sin(state.heading),
      Math.cos(state.heading),
      state.pitch,
      state.roll,
      state.distToTarget,
      Math.sin(state.bearingToTarget),
      Math.cos(state.bearingToTarget),
      state.altDiffToTarget,
      state.throttle,
    ]);

    // Task text: one-hot for levels 1-3, placeholder for 4-5
    const taskText = this.curriculum.getTaskOneHot();

    return {
      frames: this.frameBuffer.slice(), // 4-frame stack
      stateVector,
      taskText,
      textInstruction: this.genConfig?.textInstruction || null,
    };
  }

  /**
   * Run the simulation loop for manual keyboard control.
   * Call this instead of step() when manualMode is true.
   */
  startManualLoop() {
    if (!this.manualMode) return;

    const loop = () => {
      if (!this.done) {
        const action = this._keyboardToAction();
        this.step(action);
      }
      requestAnimationFrame(loop);
    };
    // Run at ~10Hz (every 6 frames)
    let frameCount = 0;
    const throttledLoop = () => {
      frameCount++;
      if (frameCount % FRAMES_PER_ACTION === 0 && !this.done) {
        const action = this._keyboardToAction();
        const result = this.step(action);
        if (result.done) {
          console.log(`Episode done: reward=${this.episodeReward.toFixed(1)}, success=${result.info.success}`);
        }
      }
      // Always render
      this._updateCamera();
      this.viewer.scene.requestRender();
      requestAnimationFrame(throttledLoop);
    };
    requestAnimationFrame(throttledLoop);
  }

  // ── Physics (adapted from simulator-app.ts) ──

  _applyOrientationInput(action, dt) {
    const d = this.drone;

    // action[3]: yaw L/R
    d.heading += action[3] * FLIGHT.yawRate * dt;
    d.heading = ((d.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Visual pitch (from forward/back input)
    const targetPitch = -action[0] * FLIGHT.maxVisualPitch;
    const targetRoll = action[1] * FLIGHT.maxVisualRoll;

    const tiltAlpha = 1.0 - Math.exp(-FLIGHT.visualTiltRate * dt);
    const returnAlpha = 1.0 - Math.exp(-FLIGHT.visualTiltReturn * dt);

    const pitchAlpha = Math.abs(action[0]) > 0.1 ? tiltAlpha : returnAlpha;
    const rollAlpha = Math.abs(action[1]) > 0.1 ? tiltAlpha : returnAlpha;

    d.visualPitch += (targetPitch - d.visualPitch) * pitchAlpha;
    d.visualRoll += (targetRoll - d.visualRoll) * rollAlpha;

    d.visualPitch = Math.max(-FLIGHT.maxVisualPitch, Math.min(FLIGHT.maxVisualPitch, d.visualPitch));
    d.visualRoll = Math.max(-FLIGHT.maxVisualRoll, Math.min(FLIGHT.maxVisualRoll, d.visualRoll));
  }

  _updateHorizontalAxes() {
    const d = this.drone;
    const s = this.scratch;

    Cesium.Transforms.eastNorthUpToFixedFrame(d.position, Cesium.Ellipsoid.WGS84, s.transform);

    const ch = Math.cos(d.heading), sh = Math.sin(d.heading);

    // Forward in ENU (heading only)
    s.acceleration.x = sh;
    s.acceleration.y = ch;
    s.acceleration.z = 0;
    Cesium.Matrix4.multiplyByPointAsVector(s.transform, s.acceleration, s.horizontalForward);
    Cesium.Cartesian3.normalize(s.horizontalForward, s.horizontalForward);

    // Right in ENU
    s.acceleration.x = ch;
    s.acceleration.y = -sh;
    s.acceleration.z = 0;
    Cesium.Matrix4.multiplyByPointAsVector(s.transform, s.acceleration, s.horizontalRight);
    Cesium.Cartesian3.normalize(s.horizontalRight, s.horizontalRight);
  }

  _applyDroneMovement(action, dt) {
    const d = this.drone;
    const s = this.scratch;

    // action[0]: forward/back, action[1]: strafe L/R
    const moveInput = action[0];
    const strafeInput = action[1];

    if (Math.abs(moveInput) > 0.05) {
      Cesium.Cartesian3.multiplyByScalar(
        s.horizontalForward,
        moveInput * FLIGHT.horizontalAcceleration * dt,
        s.velocityStep,
      );
      Cesium.Cartesian3.add(d.horizontalVelocity, s.velocityStep, d.horizontalVelocity);
    }

    if (Math.abs(strafeInput) > 0.05) {
      Cesium.Cartesian3.multiplyByScalar(
        s.horizontalRight,
        strafeInput * FLIGHT.horizontalAcceleration * dt,
        s.velocityStep,
      );
      Cesium.Cartesian3.add(d.horizontalVelocity, s.velocityStep, d.horizontalVelocity);
    }

    // Horizontal drag
    const hDrag = Math.exp(-FLIGHT.horizontalDrag * dt);
    Cesium.Cartesian3.multiplyByScalar(d.horizontalVelocity, hDrag, d.horizontalVelocity);

    // Active stabilization when no input
    if (Math.abs(moveInput) < 0.05 && Math.abs(strafeInput) < 0.05) {
      const stabDamping = Math.exp(-12.0 * dt);
      Cesium.Cartesian3.multiplyByScalar(d.horizontalVelocity, stabDamping, d.horizontalVelocity);
    }

    // Deadzone
    const hSpeed = Cesium.Cartesian3.magnitude(d.horizontalVelocity);
    if (hSpeed < 0.1) {
      d.horizontalVelocity.x = 0;
      d.horizontalVelocity.y = 0;
      d.horizontalVelocity.z = 0;
    }

    // Clamp
    if (hSpeed > FLIGHT.maxHorizontalSpeed) {
      Cesium.Cartesian3.multiplyByScalar(
        d.horizontalVelocity,
        FLIGHT.maxHorizontalSpeed / hSpeed,
        d.horizontalVelocity,
      );
    }

    // Vertical: action[2] = ascend/descend
    const vertInput = action[2];
    if (Math.abs(vertInput) > 0.05) {
      d.verticalSpeed += vertInput * FLIGHT.verticalAcceleration * dt;
    }

    d.verticalSpeed *= Math.exp(-FLIGHT.verticalDrag * dt);

    if (Math.abs(vertInput) < 0.05) {
      d.verticalSpeed *= Math.exp(-10.0 * dt);
    }

    if (Math.abs(d.verticalSpeed) < 0.05) {
      d.verticalSpeed = 0;
    }

    d.verticalSpeed = Math.max(-FLIGHT.maxVerticalSpeed, Math.min(FLIGHT.maxVerticalSpeed, d.verticalSpeed));

    // Position update — horizontal
    Cesium.Cartesian3.multiplyByScalar(d.horizontalVelocity, dt, s.movementStep);
    Cesium.Cartesian3.add(d.position, s.movementStep, d.position);

    // Position update — vertical
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(d.position, s.surfaceNormal);
    Cesium.Cartesian3.multiplyByScalar(s.surfaceNormal, d.verticalSpeed * dt, s.verticalStep);
    Cesium.Cartesian3.add(d.position, s.verticalStep, d.position);
  }

  _enforceTerrainClearance() {
    const d = this.drone;
    const s = this.scratch;

    Cesium.Cartographic.fromCartesian(d.position, Cesium.Ellipsoid.WGS84, s.cartographic);
    const sampledGround = this.viewer.scene.globe.getHeight(s.cartographic);
    if (Number.isFinite(sampledGround)) {
      d.lastGroundHeight = sampledGround;
    }

    const minHeight = d.lastGroundHeight + FLIGHT.minimumClearance;
    if (s.cartographic.height < minHeight) {
      s.cartographic.height = minHeight;
      Cesium.Cartesian3.fromRadians(
        s.cartographic.longitude,
        s.cartographic.latitude,
        s.cartographic.height,
        Cesium.Ellipsoid.WGS84,
        d.position,
      );

      if (d.verticalSpeed < 0) {
        d.verticalSpeed = 0;
      }

      // Strip downward horizontal component
      Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(d.position, s.surfaceNormal);
      const hVertComponent = Cesium.Cartesian3.dot(d.horizontalVelocity, s.surfaceNormal);
      if (hVertComponent < 0) {
        Cesium.Cartesian3.multiplyByScalar(s.surfaceNormal, hVertComponent, s.velocityStep);
        Cesium.Cartesian3.subtract(d.horizontalVelocity, s.velocityStep, d.horizontalVelocity);
      }
    }
  }

  _enforceBuildingCollision() {
    const scene = this.viewer.scene;
    if (typeof scene.pickFromRay !== 'function') return;

    const d = this.drone;
    const s = this.scratch;
    const speed = Cesium.Cartesian3.magnitude(d.horizontalVelocity);
    if (speed <= 0.5) return;

    // Forward ray
    const forwardRay = new Cesium.Ray(d.position, s.horizontalForward);
    const excludeList = this.droneEntity ? [this.droneEntity] : [];
    const hit = scene.pickFromRay(forwardRay, excludeList);

    if (hit && hit.position) {
      const distance = Cesium.Cartesian3.distance(d.position, hit.position);
      if (distance < 80) {
        const t = 1.0 - distance / 80;
        const deflection = t * t;
        Cesium.Cartesian3.multiplyByScalar(d.horizontalVelocity, 1.0 - deflection, d.horizontalVelocity);

        if (distance < 5) {
          // Hard stop + pushback
          Cesium.Cartesian3.multiplyByScalar(s.horizontalForward, -3, s.velocityStep);
          Cesium.Cartesian3.add(d.position, s.velocityStep, d.position);
          d.horizontalVelocity.x = 0;
          d.horizontalVelocity.y = 0;
          d.horizontalVelocity.z = 0;
          d.verticalSpeed = 0;
        }
      }
    }
  }

  _applyWind(dt) {
    if (!this.randomConfig || this.randomConfig.windSpeed === 0) return;

    const d = this.drone;
    const s = this.scratch;
    const windSpeed = this.randomConfig.windSpeed;
    const windDir = this.randomConfig.windDirection;
    const turbulence = this.randomConfig.turbulenceIntensity;

    // Wind force in ENU, transformed to ECEF
    Cesium.Transforms.eastNorthUpToFixedFrame(d.position, Cesium.Ellipsoid.WGS84, s.transform);

    const wx = Math.sin(windDir) * windSpeed + (Math.random() - 0.5) * turbulence * windSpeed;
    const wy = Math.cos(windDir) * windSpeed + (Math.random() - 0.5) * turbulence * windSpeed;

    s.acceleration.x = wx * dt;
    s.acceleration.y = wy * dt;
    s.acceleration.z = 0;
    Cesium.Matrix4.multiplyByPointAsVector(s.transform, s.acceleration, s.velocityStep);
    Cesium.Cartesian3.add(d.horizontalVelocity, s.velocityStep, d.horizontalVelocity);
  }

  _updateCamera() {
    const d = this.drone;
    const s = this.scratch;

    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(d.position, s.surfaceNormal);

    // FPV camera: at drone position, looking forward
    this.viewer.camera.setView({
      destination: d.position,
      orientation: {
        direction: s.horizontalForward,
        up: s.surfaceNormal,
      },
    });

    // Update drone entity orientation
    this._droneHpr.heading = d.heading + Math.PI * 1.5;
    this._droneHpr.pitch = d.visualPitch;
    this._droneHpr.roll = d.visualRoll;
    Cesium.Transforms.headingPitchRollQuaternion(
      d.position,
      this._droneHpr,
      Cesium.Ellipsoid.WGS84,
      Cesium.Transforms.eastNorthUpToFixedFrame,
      this._droneModelOrientation,
    );
  }

  // ── State extraction ──

  _getDroneState() {
    const d = this.drone;
    const s = this.scratch;

    Cesium.Cartographic.fromCartesian(d.position, Cesium.Ellipsoid.WGS84, s.cartographic);
    const lon = Cesium.Math.toDegrees(s.cartographic.longitude);
    const lat = Cesium.Math.toDegrees(s.cartographic.latitude);
    const alt = s.cartographic.height;
    const agl = Math.max(0, alt - d.lastGroundHeight);
    const speed = Cesium.Cartesian3.magnitude(d.horizontalVelocity);

    // Compute distance/bearing to current target
    let distToTarget = 0;
    let bearingToTarget = 0;
    let altDiffToTarget = 0;
    const target = this._getCurrentTarget();
    if (target) {
      const dx = (target.lon - lon) * 111320;
      const dy = (target.lat - lat) * 111320;
      distToTarget = Math.sqrt(dx * dx + dy * dy);
      bearingToTarget = Math.atan2(dx, dy);
      altDiffToTarget = (target.alt || 10) - alt;
    }

    return {
      lon,
      lat,
      alt,
      agl,
      speed,
      verticalSpeed: d.verticalSpeed,
      heading: d.heading,
      pitch: d.visualPitch,
      roll: d.visualRoll,
      distToTarget,
      bearingToTarget,
      altDiffToTarget,
      throttle: Math.abs(d.verticalSpeed) / FLIGHT.maxVerticalSpeed,
    };
  }

  _getCurrentTarget() {
    const level = this.genConfig?.level || 1;
    const city = this.cityInfo;
    if (!city) return null;

    if (level === 1) {
      return city.spawnPos ? { lon: city.spawnPos.lon, lat: city.spawnPos.lat, alt: this.genConfig.hoverAltitude || 10 } : null;
    }
    if (level === 2) {
      const wp = city.waypoints?.[0];
      return wp ? { lon: wp.lon, lat: wp.lat, alt: 10 } : null;
    }
    if (level === 3) {
      const idx = this.rewardEngine.currentWaypointIndex;
      const wp = city.waypoints?.[idx];
      return wp ? { lon: wp.lon, lat: wp.lat, alt: 10 } : null;
    }
    if (level === 4) {
      const target = city.buildings?.find(b => b.isTarget);
      return target ? { lon: target.lon, lat: target.lat, alt: target.height } : null;
    }
    if (level === 5) {
      const objIdx = this.rewardEngine.currentObjectiveIndex;
      const obj = this.genConfig.objectives?.[objIdx];
      if (!obj) return null;
      if (obj.type === 'building') {
        const b = city.buildings?.find(b2 => b2.colorName === obj.color);
        return b ? { lon: b.lon, lat: b.lat, alt: b.height } : null;
      }
      if (obj.type === 'waypoint') {
        const wp = city.waypoints?.[obj.index];
        return wp ? { lon: wp.lon, lat: wp.lat, alt: 10 } : null;
      }
      if (obj.type === 'land') {
        const lz = city.landingZones?.[0];
        return lz ? { lon: lz.lon, lat: lz.lat, alt: 0 } : null;
      }
    }
    return null;
  }

  // ── Frame capture ──

  _captureFrame() {
    const canvas = this.viewer.canvas;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      // Fallback: return empty frame
      return new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 3);
    }

    // Read pixels from WebGL canvas
    const w = canvas.width;
    const h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Draw to offscreen canvas for downscaling
    const imageData = new ImageData(new Uint8ClampedArray(pixels.buffer), w, h);

    // WebGL readPixels is bottom-up, flip vertically
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    // Flip and downscale
    this._offscreenCtx.save();
    this._offscreenCtx.translate(0, FRAME_HEIGHT);
    this._offscreenCtx.scale(1, -1);
    this._offscreenCtx.drawImage(tempCanvas, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    this._offscreenCtx.restore();

    // Extract RGB (drop alpha)
    const downscaled = this._offscreenCtx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    const rgb = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 3);
    for (let i = 0, j = 0; i < downscaled.data.length; i += 4, j += 3) {
      rgb[j] = downscaled.data[i];
      rgb[j + 1] = downscaled.data[i + 1];
      rgb[j + 2] = downscaled.data[i + 2];
    }

    return rgb;
  }

  // ── Keyboard to action mapping (for manual testing) ──

  _keyboardToAction() {
    const fwd = (this.keyState.has('ArrowUp') ? 1 : 0) - (this.keyState.has('ArrowDown') ? 1 : 0);
    const strafe = (this.keyState.has('KeyD') ? 1 : 0) - (this.keyState.has('KeyA') ? 1 : 0);
    const vert = (this.keyState.has('KeyW') ? 1 : 0) - (this.keyState.has('KeyS') ? 1 : 0);
    const yaw = (this.keyState.has('ArrowRight') ? 1 : 0) - (this.keyState.has('ArrowLeft') ? 1 : 0);
    return [fwd, strafe, vert, yaw];
  }

  /**
   * Get environment info for external consumers.
   */
  getEnvInfo() {
    return {
      actionSpace: { shape: [4], low: -1, high: 1 },
      observationSpace: {
        frames: { shape: [FRAME_STACK, 3, FRAME_HEIGHT, FRAME_WIDTH] },
        stateVector: { shape: [STATE_VECTOR_SIZE] },
        taskText: { shape: [5] }, // one-hot for levels 1-3
      },
      controlHz: CONTROL_HZ,
      currentLevel: this.curriculum.currentLevel,
      difficulty: this.curriculum.difficulty,
    };
  }

  /**
   * Clean up resources.
   */
  destroy() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    this.initialized = false;
  }
}
