// main.js — Training mode entry point
// Wires up the RL environment, exposes API to console, handles manual keyboard control

import { RLEnv } from './rl-env.js';

const HUD = {
  level: document.getElementById('hud-level'),
  task: document.getElementById('hud-task'),
  difficulty: document.getElementById('hud-difficulty'),
  episode: document.getElementById('hud-episode'),
  step: document.getElementById('hud-step'),
  reward: document.getElementById('hud-reward'),
  agl: document.getElementById('hud-agl'),
  speed: document.getElementById('hud-speed'),
  status: document.getElementById('hud-status'),
};

let env = null;
let episodeCount = 0;

function updateHud() {
  if (!env) return;
  const info = env.getEnvInfo();
  const state = env._getDroneState();

  HUD.level.textContent = info.currentLevel;
  HUD.task.textContent = env.curriculum.getCurrentTask().name;
  HUD.difficulty.textContent = info.difficulty.toFixed(2);
  HUD.episode.textContent = episodeCount;
  HUD.step.textContent = env.episodeStep;
  HUD.reward.textContent = env.episodeReward.toFixed(1);
  HUD.agl.textContent = `${state.agl.toFixed(1)} m`;
  HUD.speed.textContent = `${state.speed.toFixed(1)} m/s`;
}

async function boot() {
  HUD.status.textContent = 'Booting Cesium...';

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const startLevel = parseInt(params.get('level') || '1', 10);

  env = new RLEnv('cesiumContainer', {
    startLevel,
    manualMode: true,
  });

  await env.init();
  HUD.status.textContent = 'Ready. Press R to start.';

  // First reset
  env.reset();
  episodeCount++;
  HUD.status.textContent = 'Flying (manual)';

  // Start the manual control loop + HUD updates
  env.startManualLoop();

  // HUD update loop
  setInterval(updateHud, 100);

  // Extra keyboard handlers for training-specific commands
  document.addEventListener('keydown', (e) => {
    // R: reset episode
    if (e.code === 'KeyR') {
      e.preventDefault();
      env.reset();
      episodeCount++;
      HUD.status.textContent = 'Flying (manual)';
    }

    // 1-5: set level
    if (e.code >= 'Digit1' && e.code <= 'Digit5') {
      const level = parseInt(e.code.replace('Digit', ''), 10);
      env.curriculum.currentLevel = level;
      env.curriculum.difficulty = 0;
      env.curriculum.episodeHistory = [];
      env.reset();
      episodeCount++;
      HUD.status.textContent = `Level ${level}: ${env.curriculum.getCurrentTask().name}`;
    }

    // N: take one random action step
    if (e.code === 'KeyN') {
      e.preventDefault();
      const action = [
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ];
      const result = env.step(action);
      console.log('Random step:', {
        reward: result.reward.toFixed(3),
        done: result.done,
        info: result.info,
      });
      if (result.done) {
        HUD.status.textContent = `Done: ${result.info.termination || 'unknown'}`;
      }
    }

    // T: run 100 random-action episodes (non-blocking batches)
    if (e.code === 'KeyT') {
      e.preventDefault();
      runRandomEpisodes(100);
    }
  });

  // Expose to global scope for console testing
  window.rlEnv = env;
  window.rlReset = () => {
    env.reset();
    episodeCount++;
    return env.observe();
  };
  window.rlStep = (action) => env.step(action);
  window.rlObserve = () => env.observe();
  window.rlInfo = () => env.getEnvInfo();

  console.log('[RL Training] Ready. Global API:');
  console.log('  rlReset()         — reset episode, returns observation');
  console.log('  rlStep([f,s,v,y]) — step with action [-1,1]^4, returns {observation, reward, done, info}');
  console.log('  rlObserve()       — get current observation');
  console.log('  rlInfo()          — get environment info');
  console.log('  rlEnv             — full RLEnv instance');
}

async function runRandomEpisodes(count) {
  HUD.status.textContent = `Running ${count} random episodes...`;
  console.log(`[RL Training] Running ${count} random-action episodes...`);

  const results = { success: 0, timeout: 0, crash: 0, outOfBounds: 0, other: 0 };
  const rewards = [];
  const stepCounts = [];

  for (let ep = 0; ep < count; ep++) {
    env.reset();
    episodeCount++;
    let totalReward = 0;
    let steps = 0;

    while (!env.done && steps < 2000) {
      const action = [
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ];
      const result = env.step(action);
      totalReward += result.reward;
      steps++;

      if (result.done) {
        const term = result.info.termination || 'other';
        if (term === 'timeout') results.timeout++;
        else if (term === 'crash') results.crash++;
        else if (term === 'out_of_bounds') results.outOfBounds++;
        else if (result.info.success) results.success++;
        else results.other++;
        break;
      }
    }

    rewards.push(totalReward);
    stepCounts.push(steps);

    // Yield to browser every 10 episodes
    if (ep % 10 === 0) {
      HUD.status.textContent = `Random episodes: ${ep + 1}/${count}`;
      updateHud();
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const avgSteps = stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length;

  console.log(`[RL Training] ${count} episodes complete:`);
  console.log(`  Avg reward: ${avgReward.toFixed(1)}`);
  console.log(`  Avg steps: ${avgSteps.toFixed(1)}`);
  console.log(`  Results:`, results);

  HUD.status.textContent = `Done. Avg reward: ${avgReward.toFixed(1)}`;
}

boot().catch(err => {
  console.error('[RL Training] Boot failed:', err);
  HUD.status.textContent = 'Boot failed — see console';
});
