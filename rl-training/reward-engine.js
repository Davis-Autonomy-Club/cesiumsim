// reward-engine.js — Per-step reward computation and episode termination

const WAYPOINT_REACH_RADIUS = 10;  // meters — close enough counts as "reached"
const BUILDING_PROXIMITY_THRESHOLD = 10; // meters — penalty zone
const CRASH_SPEED_THRESHOLD = 3.0; // m/s — impact speed that counts as crash
const LAND_HORIZONTAL_TOLERANCE = 8; // meters
const LAND_AGL_THRESHOLD = 1.5; // meters
const LAND_SPEED_THRESHOLD = 0.5; // m/s
const LAND_HOLD_DURATION = 2.0; // seconds

/**
 * Compute distance between two lon/lat positions in meters (equirectangular approximation).
 */
function distanceMeters(lon1, lat1, lon2, lat2) {
  const dx = (lon2 - lon1) * 111320;
  const dy = (lat2 - lat1) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute bearing from (lon1, lat1) to (lon2, lat2) in radians.
 */
function bearing(lon1, lat1, lon2, lat2) {
  const dx = (lon2 - lon1) * 111320;
  const dy = (lat2 - lat1) * 111320;
  return Math.atan2(dx, dy); // north = 0, east = pi/2
}

/**
 * Reward engine for RL training.
 */
export class RewardEngine {
  constructor() {
    this.reset();
  }

  /**
   * Reset the reward engine for a new episode.
   * @param {object} config - task generation config (from curriculum)
   * @param {object} cityInfo - generated city info
   */
  reset(config = {}, cityInfo = {}) {
    this.config = config;
    this.cityInfo = cityInfo;
    this.rewards = config.rewards || {};
    this.level = config.level || 1;
    this.elapsed = 0;
    this.timeout = config.timeout || 60;
    this.done = false;
    this.success = false;
    this.info = {};

    // Level-specific state
    this.currentWaypointIndex = 0;
    this.currentObjectiveIndex = 0;
    this.hoverStartTime = -1;
    this.hoverAccumulator = 0;
    this.landStartTime = -1;
    this.landAccumulator = 0;
    this.prevDistToTarget = null;
    this.prevAltitude = null;
    this.subObjectivesCompleted = 0;

    // Objectives for Level 5
    this.objectives = config.objectives || [];
  }

  /**
   * Compute reward for one step.
   * @param {object} state - drone state
   * @param {number} dt - time step in seconds
   * @returns {{ reward: number, done: boolean, success: boolean, info: object }}
   */
  step(state, dt) {
    this.elapsed += dt;
    let reward = 0;
    const info = {};

    // Check timeout
    if (this.elapsed >= this.timeout) {
      this.done = true;
      this.success = false;
      info.termination = 'timeout';
      return { reward: -10, done: true, success: false, info };
    }

    // Check crash (hit ground too fast)
    if (state.agl < 0.5 && Math.abs(state.verticalSpeed) > CRASH_SPEED_THRESHOLD) {
      this.done = true;
      this.success = false;
      info.termination = 'crash';
      return { reward: this.rewards.crash || -20, done: true, success: false, info };
    }

    // Check out-of-bounds
    if (this.cityInfo.arenaSize) {
      const halfSize = this.cityInfo.arenaSize / 2;
      const dx = (state.lon - (this.cityInfo.centerLon || 0)) * 111320;
      const dy = (state.lat - (this.cityInfo.centerLat || 0)) * 111320;
      if (Math.abs(dx) > halfSize + 20 || Math.abs(dy) > halfSize + 20) {
        this.done = true;
        this.success = false;
        info.termination = 'out_of_bounds';
        return { reward: -15, done: true, success: false, info };
      }
    }

    // Level-specific reward
    switch (this.level) {
      case 1:
        reward += this._rewardLevel1(state, dt, info);
        break;
      case 2:
        reward += this._rewardLevel2(state, dt, info);
        break;
      case 3:
        reward += this._rewardLevel3(state, dt, info);
        break;
      case 4:
        reward += this._rewardLevel4(state, dt, info);
        break;
      case 5:
        reward += this._rewardLevel5(state, dt, info);
        break;
    }

    return { reward, done: this.done, success: this.success, info };
  }

  // ── Level 1: Hover & Land ──

  _rewardLevel1(state, dt, info) {
    let reward = 0;
    const targetAlt = this.config.hoverAltitude || 10;
    const hoverDuration = this.config.hoverDuration || 5;

    if (!this.hoverCompleted) {
      // Phase 1: Hover at target altitude
      const altError = Math.abs(state.agl - targetAlt);

      // Altitude accuracy reward (denser when close)
      if (altError < 2.0) {
        reward += (this.rewards.altitudeHoldAccuracy || 2.0) * (1 - altError / 2.0);
        this.hoverAccumulator += dt;
      } else {
        reward -= 0.1; // penalty for being far from target
        this.hoverAccumulator = Math.max(0, this.hoverAccumulator - dt * 0.5);
      }

      // Oscillation penalty (vertical speed when should be hovering)
      if (altError < 3.0) {
        reward += (this.rewards.oscillationPenalty || -0.5) * Math.abs(state.verticalSpeed);
      }

      // Drift penalty
      const drift = state.speed;
      if (drift > 1.0) {
        reward += (this.rewards.driftPenalty || -0.3) * drift;
      }

      // Check hover duration met
      if (this.hoverAccumulator >= hoverDuration) {
        this.hoverCompleted = true;
        info.hoverComplete = true;
        reward += 20; // bonus for completing hover
      }
    } else {
      // Phase 2: Land at start position
      const landReward = this._checkLanding(state, dt,
        this.cityInfo.spawnPos?.lon || 0,
        this.cityInfo.spawnPos?.lat || 0,
      );
      reward += landReward;

      if (this.landAccumulator >= LAND_HOLD_DURATION) {
        this.done = true;
        this.success = true;
        info.termination = 'landed';
        reward += this.rewards.landSuccess || 50;
      }
    }

    return reward;
  }

  // ── Level 2: Fly to Waypoint ──

  _rewardLevel2(state, dt, info) {
    let reward = 0;
    const wp = this.cityInfo.waypoints?.[0];
    if (!wp) return 0;

    const dist = distanceMeters(state.lon, state.lat, wp.lon, wp.lat);

    // Distance reduction reward
    if (this.prevDistToTarget !== null) {
      const distReduction = this.prevDistToTarget - dist;
      reward += distReduction * (this.rewards.distanceReduction || 1.0);
    }
    this.prevDistToTarget = dist;

    // Heading alignment reward
    const targetBearing = bearing(state.lon, state.lat, wp.lon, wp.lat);
    const headingError = Math.cos(state.heading - targetBearing);
    reward += headingError * (this.rewards.headingAlignment || 0.1);

    // Time penalty
    reward += this.rewards.timePenalty || -0.05;

    // Check arrival
    if (dist < WAYPOINT_REACH_RADIUS) {
      this.done = true;
      this.success = true;
      info.termination = 'arrival';
      reward += this.rewards.arrival || 100;
    }

    return reward;
  }

  // ── Level 3: Multi-Waypoint Route ──

  _rewardLevel3(state, dt, info) {
    let reward = 0;
    const wps = this.cityInfo.waypoints || [];
    if (this.currentWaypointIndex >= wps.length) return 0;

    const wp = wps[this.currentWaypointIndex];
    const dist = distanceMeters(state.lon, state.lat, wp.lon, wp.lat);

    // Distance reduction to current waypoint
    if (this.prevDistToTarget !== null) {
      const distReduction = this.prevDistToTarget - dist;
      reward += distReduction * (this.rewards.distanceReduction || 1.0);
    }
    this.prevDistToTarget = dist;

    // Building proximity penalty
    for (const b of (this.cityInfo.buildings || [])) {
      const bDist = distanceMeters(state.lon, state.lat, b.lon, b.lat);
      if (bDist < BUILDING_PROXIMITY_THRESHOLD) {
        reward += this.rewards.buildingProximityPenalty || -0.5;
        break;
      }
    }

    // Check waypoint reached
    if (dist < WAYPOINT_REACH_RADIUS) {
      this.currentWaypointIndex++;
      this.prevDistToTarget = null;
      info.waypointReached = this.currentWaypointIndex;

      if (this.currentWaypointIndex >= wps.length) {
        // All waypoints reached
        this.done = true;
        this.success = true;
        info.termination = 'all_waypoints';
        reward += this.rewards.finalWaypoint || 100;
      } else {
        reward += this.rewards.waypointReached || 30;
      }
    }

    return reward;
  }

  // ── Level 4: Text-Conditioned Navigation ──

  _rewardLevel4(state, dt, info) {
    let reward = 0;

    // Find target building
    const target = (this.cityInfo.buildings || []).find(b => b.isTarget);
    if (!target) return 0;

    const dist = distanceMeters(state.lon, state.lat, target.lon, target.lat);

    // Distance reduction
    if (this.prevDistToTarget !== null) {
      const distReduction = this.prevDistToTarget - dist;
      reward += distReduction * (this.rewards.distanceReduction || 1.0);
    }
    this.prevDistToTarget = dist;

    // Target in FOV bonus (rough approximation — check if target bearing is within FOV cone)
    const targetBearing = bearing(state.lon, state.lat, target.lon, target.lat);
    const bearingDiff = Math.abs(targetBearing - state.heading);
    const normalizedDiff = Math.min(bearingDiff, 2 * Math.PI - bearingDiff);
    if (normalizedDiff < Math.PI / 3) { // ~60 deg half-cone
      reward += this.rewards.targetInFOV || 0.3;
    }

    // Check arrival at correct target
    if (dist < WAYPOINT_REACH_RADIUS * 2) {
      this.done = true;
      this.success = true;
      info.termination = 'correct_target';
      reward += this.rewards.correctTarget || 150;
    }

    // Check if drone is near a wrong building (penalty)
    for (const b of (this.cityInfo.buildings || [])) {
      if (b.isTarget) continue;
      const bDist = distanceMeters(state.lon, state.lat, b.lon, b.lat);
      if (bDist < WAYPOINT_REACH_RADIUS) {
        reward += this.rewards.wrongTarget || -20;
        info.wrongTarget = true;
        break;
      }
    }

    return reward;
  }

  // ── Level 5: Multi-Step Mission ──

  _rewardLevel5(state, dt, info) {
    let reward = 0;

    if (this.currentObjectiveIndex >= this.objectives.length) {
      // All objectives completed
      this.done = true;
      this.success = true;
      info.termination = 'mission_complete';
      reward += this.rewards.missionComplete || 200;
      return reward;
    }

    const objective = this.objectives[this.currentObjectiveIndex];

    if (objective.type === 'building') {
      const target = (this.cityInfo.buildings || []).find(
        b => b.colorName === objective.color
      );
      if (target) {
        const dist = distanceMeters(state.lon, state.lat, target.lon, target.lat);
        if (this.prevDistToTarget !== null) {
          reward += (this.prevDistToTarget - dist) * (this.rewards.distanceReduction || 1.0);
        }
        this.prevDistToTarget = dist;

        if (dist < WAYPOINT_REACH_RADIUS * 2) {
          this.currentObjectiveIndex++;
          this.prevDistToTarget = null;
          this.subObjectivesCompleted++;
          reward += this.rewards.subObjective || 50;
          info.objectiveCompleted = this.subObjectivesCompleted;
        }
      }
    } else if (objective.type === 'waypoint') {
      const wp = (this.cityInfo.waypoints || [])[objective.index];
      if (wp) {
        const dist = distanceMeters(state.lon, state.lat, wp.lon, wp.lat);
        if (this.prevDistToTarget !== null) {
          reward += (this.prevDistToTarget - dist) * (this.rewards.distanceReduction || 1.0);
        }
        this.prevDistToTarget = dist;

        if (dist < WAYPOINT_REACH_RADIUS) {
          this.currentObjectiveIndex++;
          this.prevDistToTarget = null;
          this.subObjectivesCompleted++;
          reward += this.rewards.subObjective || 50;
          info.objectiveCompleted = this.subObjectivesCompleted;
        }
      }
    } else if (objective.type === 'land') {
      const lz = (this.cityInfo.landingZones || [])[0];
      if (lz) {
        const dist = distanceMeters(state.lon, state.lat, lz.lon, lz.lat);
        if (this.prevDistToTarget !== null) {
          reward += (this.prevDistToTarget - dist) * (this.rewards.distanceReduction || 1.0);
        }
        this.prevDistToTarget = dist;

        const landReward = this._checkLanding(state, dt, lz.lon, lz.lat);
        reward += landReward;

        if (this.landAccumulator >= LAND_HOLD_DURATION) {
          this.currentObjectiveIndex++;
          this.subObjectivesCompleted++;
          reward += this.rewards.subObjective || 50;
          info.objectiveCompleted = this.subObjectivesCompleted;
        }
      }
    }

    return reward;
  }

  // ── Landing check helper ──

  _checkLanding(state, dt, targetLon, targetLat) {
    let reward = 0;
    const dist = distanceMeters(state.lon, state.lat, targetLon, targetLat);
    const isClose = dist < LAND_HORIZONTAL_TOLERANCE;
    const isLow = state.agl < LAND_AGL_THRESHOLD;
    const isSlow = state.speed < LAND_SPEED_THRESHOLD &&
                   Math.abs(state.verticalSpeed) < LAND_SPEED_THRESHOLD;

    if (isClose && isLow && isSlow) {
      this.landAccumulator += dt;
      reward += 1.0; // reward for holding landing position
    } else {
      this.landAccumulator = Math.max(0, this.landAccumulator - dt * 2);
      // Incentivize approaching the LZ
      if (this.prevDistToTarget !== null) {
        reward += (this.prevDistToTarget - dist) * 0.5;
      }
    }

    return reward;
  }
}
