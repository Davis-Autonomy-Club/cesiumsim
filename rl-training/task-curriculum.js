// task-curriculum.js — Task definitions, text templates, difficulty progression

/**
 * Task level configurations.
 * Each level defines arena size, building count range, waypoint/LZ setup,
 * timeout, and reward structure.
 */
export const TASK_LEVELS = [
  // Level 1: Hover & Land
  {
    level: 1,
    name: 'Hover & Land',
    arenaSize: 100,
    buildingCount: [0, 0],
    waypointCount: 0,
    lzCount: 0, // land at start position
    timeout: 30,
    hoverAltitude: 10,
    hoverDuration: 5,
    textInstruction: null,
    rewards: {
      altitudeHoldAccuracy: 2.0,  // per step, based on altitude error
      oscillationPenalty: -0.5,
      driftPenalty: -0.3,
      landSuccess: 50,
      crash: -20,
    },
  },
  // Level 2: Fly to Waypoint
  {
    level: 2,
    name: 'Fly to Waypoint',
    arenaSize: 400,
    buildingCount: [0, 4],
    waypointCount: 1,
    lzCount: 0,
    timeout: 60,
    waypointDistance: [50, 150],
    textInstruction: null,
    rewards: {
      distanceReduction: 1.0,
      headingAlignment: 0.1,
      timePenalty: -0.05,
      arrival: 100,
      crash: -30,
    },
  },
  // Level 3: Multi-Waypoint Route
  {
    level: 3,
    name: 'Multi-Waypoint Route',
    arenaSize: 600,
    buildingCount: [10, 25],
    waypointCount: [3, 5],
    lzCount: 0,
    timeout: 120,
    textInstruction: null,
    rewards: {
      distanceReduction: 1.0,
      waypointReached: 30,
      finalWaypoint: 100,
      buildingProximityPenalty: -0.5, // when within 10m
      crash: -30,
    },
  },
  // Level 4: Text-Conditioned Navigation
  {
    level: 4,
    name: 'Text-Conditioned Navigation',
    arenaSize: 600,
    buildingCount: [15, 30],
    waypointCount: 0,
    lzCount: 1,
    timeout: 90,
    textInstruction: 'template', // uses text templates
    rewards: {
      distanceReduction: 1.0,
      correctTarget: 150,
      wrongTarget: -20,
      targetInFOV: 0.3,
      crash: -30,
    },
  },
  // Level 5: Multi-Step Mission
  {
    level: 5,
    name: 'Multi-Step Mission',
    arenaSize: 800,
    buildingCount: [20, 40],
    waypointCount: [2, 4],
    lzCount: [1, 2],
    timeout: 180,
    textInstruction: 'mission', // full text paragraph
    rewards: {
      subObjective: 50,
      missionComplete: 200,
      distanceReduction: 1.0,
      crash: -30,
    },
  },
];

// Text instruction templates for Level 4
const LEVEL4_TEMPLATES = [
  'Fly to the {color} building',
  'Navigate to the {color} building on the {direction}',
  'Land near the tall {color} building',
  'Fly to the {size} {color} building',
  'Go to the {color} building and hover above it',
];

// Mission templates for Level 5
const LEVEL5_TEMPLATES = [
  'Fly to the {color1} building, then through the {wpLabel} waypoint, then land at the landing zone',
  'Navigate to {wpLabel}, fly past the {color1} building, then land at the LZ near the {color2} buildings',
  'Go through {wpLabel1} and {wpLabel2}, then land at the landing zone',
  'Fly to the {color1} building, continue to {wpLabel}, then land',
];

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'white'];
const DIRECTIONS = ['north', 'south', 'east', 'west'];
const SIZES = ['tall', 'short', 'large', 'small'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a text instruction for Level 4.
 * @param {object} cityInfo - info about the generated city (target building color, etc.)
 * @returns {{ text: string, targetColor: string }}
 */
export function generateLevel4Instruction(cityInfo) {
  const targetColor = cityInfo.targetColor || pick(COLORS);
  const template = pick(LEVEL4_TEMPLATES);
  const text = template
    .replace('{color}', targetColor)
    .replace('{direction}', pick(DIRECTIONS))
    .replace('{size}', pick(SIZES));
  return { text, targetColor };
}

/**
 * Generate a mission instruction for Level 5.
 * @param {object} cityInfo - info about the generated city
 * @returns {{ text: string, objectives: Array }}
 */
export function generateLevel5Mission(cityInfo) {
  const color1 = cityInfo.buildingColors?.[0] || pick(COLORS);
  const color2 = cityInfo.buildingColors?.[1] || pick(COLORS);
  const wpLabels = (cityInfo.waypoints || []).map((_, i) => `WP-${i + 1}`);
  const template = pick(LEVEL5_TEMPLATES);

  const text = template
    .replace('{color1}', color1)
    .replace('{color2}', color2)
    .replace('{wpLabel}', wpLabels[0] || 'WP-1')
    .replace('{wpLabel1}', wpLabels[0] || 'WP-1')
    .replace('{wpLabel2}', wpLabels[1] || 'WP-2');

  // Build sub-objectives list from the template
  const objectives = [];
  if (template.includes('{color1} building')) {
    objectives.push({ type: 'building', color: color1 });
  }
  for (let i = 0; i < wpLabels.length && i < 2; i++) {
    if (template.includes(`{wpLabel${i > 0 ? i + 1 : ''}}`) || template.includes('{wpLabel}')) {
      objectives.push({ type: 'waypoint', index: i });
    }
  }
  objectives.push({ type: 'land' });

  return { text, objectives };
}

/**
 * Manages curriculum progression across episodes.
 */
export class TaskCurriculum {
  constructor(startLevel = 1) {
    this.currentLevel = Math.max(1, Math.min(startLevel, TASK_LEVELS.length));
    this.difficulty = 0.0; // [0, 1] within current level
    this.episodeHistory = []; // recent results for advancement logic
    this.historyWindow = 100;
    this.advanceThreshold = 0.8; // >80% success to advance
    this.retreatThreshold = 0.3; // <30% success to retreat
  }

  /**
   * Get the current task level config.
   * @returns {object}
   */
  getCurrentTask() {
    return TASK_LEVELS[this.currentLevel - 1];
  }

  /**
   * Resolve a range value (either a number or [min, max] array).
   * @param {number|number[]} value
   * @returns {number}
   */
  resolveRange(value) {
    if (Array.isArray(value)) {
      return randInt(value[0], value[1]);
    }
    return value;
  }

  /**
   * Get generation config for the current level, with difficulty scaling.
   * @returns {object}
   */
  getGenerationConfig() {
    const task = this.getCurrentTask();
    const d = this.difficulty;

    const buildingCount = this.resolveRange(task.buildingCount);
    const waypointCount = this.resolveRange(task.waypointCount);
    const lzCount = this.resolveRange(task.lzCount);

    // Difficulty scales building height, corridor width, timeout
    const maxBuildingHeight = 8 + d * 72;  // 8-80m
    const corridorWidth = 25 - d * 10;     // 25-15m
    const timeout = task.timeout * (1.0 - d * 0.3); // reduce timeout at high difficulty

    return {
      level: task.level,
      arenaSize: task.arenaSize,
      buildingCount,
      waypointCount,
      lzCount,
      maxBuildingHeight,
      corridorWidth,
      timeout,
      textInstruction: task.textInstruction,
      rewards: task.rewards,
      hoverAltitude: task.hoverAltitude,
      hoverDuration: task.hoverDuration,
      waypointDistance: task.waypointDistance,
      difficulty: d,
    };
  }

  /**
   * Report the result of an episode for curriculum advancement.
   * @param {boolean} success - whether the episode was successful
   */
  reportEpisodeResult(success) {
    this.episodeHistory.push(success ? 1 : 0);
    if (this.episodeHistory.length > this.historyWindow) {
      this.episodeHistory.shift();
    }

    // Only evaluate after enough episodes
    if (this.episodeHistory.length < 20) return;

    const successRate = this.episodeHistory.reduce((a, b) => a + b, 0) / this.episodeHistory.length;

    if (successRate > this.advanceThreshold) {
      if (this.difficulty < 1.0) {
        // Increase difficulty within level
        this.difficulty = Math.min(1.0, this.difficulty + 0.1);
      } else if (this.currentLevel < TASK_LEVELS.length) {
        // Advance to next level
        this.currentLevel++;
        this.difficulty = 0.0;
        this.episodeHistory = [];
        console.log(`[Curriculum] Advanced to Level ${this.currentLevel}: ${this.getCurrentTask().name}`);
      }
    } else if (successRate < this.retreatThreshold) {
      if (this.difficulty > 0.0) {
        // Decrease difficulty within level
        this.difficulty = Math.max(0.0, this.difficulty - 0.1);
      } else if (this.currentLevel > 1) {
        // Retreat to previous level
        this.currentLevel--;
        this.difficulty = 0.5;
        this.episodeHistory = [];
        console.log(`[Curriculum] Retreated to Level ${this.currentLevel}: ${this.getCurrentTask().name}`);
      }
    }
  }

  /**
   * Get a one-hot task ID vector for levels 1-3 (used instead of text embedding).
   * @returns {number[]} length-5 one-hot vector
   */
  getTaskOneHot() {
    const vec = new Array(5).fill(0);
    vec[this.currentLevel - 1] = 1;
    return vec;
  }
}
