export type HudElements = {
  speed: HTMLElement;
  altitudeAgl: HTMLElement;
  altitudeMsl: HTMLElement;
  heading: HTMLElement;
  attitude: HTMLElement;
  position: HTMLElement;
  datasetStatus: HTMLElement;
  flightStatus: HTMLElement;
  benchmarkRunner: HTMLElement;
  runBenchmarkBtn: HTMLButtonElement;
  benchmarkMaxTime: HTMLInputElement;
  missionToast: HTMLElement;
  runBatchBtn: HTMLButtonElement;
  addTrialBtn: HTMLButtonElement;
  startBatchBtn: HTMLButtonElement;
  batchSetupContainer: HTMLElement;
  batchTrialsTable: HTMLTableElement;
  batchResultsDialog: HTMLElement;
  batchResultsTable: HTMLTableElement;
  exportXlsxBtn: HTMLButtonElement;
  batchCloseBtn: HTMLButtonElement;
  batchAutoProceed: HTMLInputElement;
};

export type FpvOverlayElements = {
  overlay: HTMLDivElement;
  altitude: HTMLSpanElement;
  speed: HTMLSpanElement;
};

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Expected element with id "${id}" to exist.`);
  }
  return element;
}

export function getHudElements(): HudElements {
  return {
    speed: getRequiredElement("hud-speed"),
    altitudeAgl: getRequiredElement("hud-altitude-agl"),
    altitudeMsl: getRequiredElement("hud-altitude-msl"),
    heading: getRequiredElement("hud-heading"),
    attitude: getRequiredElement("hud-attitude"),
    position: getRequiredElement("hud-position"),
    datasetStatus: getRequiredElement("dataset-status"),
    flightStatus: getRequiredElement("flight-status"),
    benchmarkRunner: getRequiredElement("benchmark-runner-panel"),
    runBenchmarkBtn: getRequiredElement("run-benchmark-btn") as HTMLButtonElement,
    benchmarkMaxTime: getRequiredElement("benchmark-max-time") as HTMLInputElement,
    missionToast: getRequiredElement("mission-toast"),
    runBatchBtn: getRequiredElement("run-benchmark-batch-btn") as HTMLButtonElement,
    addTrialBtn: getRequiredElement("add-trial-btn") as HTMLButtonElement,
    startBatchBtn: getRequiredElement("start-batch-btn") as HTMLButtonElement,
    batchSetupContainer: getRequiredElement("batch-setup-container"),
    batchTrialsTable: getRequiredElement("batch-trials-table") as HTMLTableElement,
    batchResultsDialog: getRequiredElement("batch-results-dialog"),
    batchResultsTable: getRequiredElement("batch-results-table") as HTMLTableElement,
    exportXlsxBtn: getRequiredElement("export-xlsx-btn") as HTMLButtonElement,
    batchCloseBtn: getRequiredElement("batch-close-btn") as HTMLButtonElement,
    batchAutoProceed: getRequiredElement("batch-auto-proceed") as HTMLInputElement,
  };
}

export function setFlightStatus(
  hud: HudElements,
  text: string,
  isWarning: boolean,
): void {
  hud.flightStatus.textContent = text;
  hud.flightStatus.style.color = isWarning ? "#ffd36f" : "#d9ecff";
}

export function updateSpeedTierHud(
  speedTierIndex: number,
  speedMultiplier: number,
  speedTiers: number[],
): void {
  const valueElement = document.getElementById("hud-speed-tier");
  if (valueElement) {
    valueElement.textContent = `${speedMultiplier}x`;
  }

  speedTiers.forEach((tier, index) => {
    const button = document.getElementById(`speed-btn-${tier}`);
    if (button) {
      button.classList.toggle("active", index === speedTierIndex);
    }
  });
}

export function createCloudFogOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = "cloud-fog-overlay";
  overlay.style.cssText = `
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

  const hud = document.getElementById("hud");
  if (hud) {
    document.body.insertBefore(overlay, hud);
  } else {
    document.body.appendChild(overlay);
  }

  return overlay;
}

export function createFpvOverlay(): FpvOverlayElements {
  const overlay = document.createElement("div");
  overlay.id = "fpv-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 5; display: none;
  `;

  const vignette = document.createElement("div");
  vignette.style.cssText = `
    position: absolute; inset: 0;
    background: radial-gradient(
      ellipse 70% 65% at 50% 50%,
      transparent 0%,
      transparent 45%,
      rgba(0,0,0,0.18) 62%,
      rgba(0,0,0,0.45) 78%,
      rgba(0,0,0,0.82) 100%
    );
  `;
  overlay.appendChild(vignette);

  const barStyle = "position: absolute; left: 0; right: 0; height: 3.5%; background: #000;";
  const topBar = document.createElement("div");
  topBar.style.cssText = `${barStyle}top: 0;`;
  const bottomBar = document.createElement("div");
  bottomBar.style.cssText = `${barStyle}bottom: 0;`;
  overlay.appendChild(topBar);
  overlay.appendChild(bottomBar);

  const grain = document.createElement("div");
  grain.style.cssText = `
    position: absolute; inset: 0; opacity: 0.06; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 128px 128px;
    animation: fpv-grain 0.08s steps(2) infinite;
  `;
  overlay.appendChild(grain);

  const tint = document.createElement("div");
  tint.style.cssText = `
    position: absolute; inset: 0; opacity: 0.07;
    background: linear-gradient(180deg, rgba(255,180,100,0.3) 0%, transparent 40%, rgba(80,120,200,0.2) 100%);
    mix-blend-mode: overlay;
  `;
  overlay.appendChild(tint);

  const hudContainer = document.createElement("div");
  hudContainer.style.cssText = `
    position: absolute; bottom: 6%; left: 50%; transform: translateX(-50%);
    display: flex; gap: 2.5rem; align-items: baseline;
    font-family: 'Space Mono', monospace; font-size: 1.05rem;
    color: rgba(255,255,255,0.88); text-shadow: 0 0 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7);
    letter-spacing: 0.04em;
  `;

  const altitude = document.createElement("span");
  altitude.textContent = "ALT 0.0 m";

  const speed = document.createElement("span");
  speed.textContent = "SPD 0.0 m/s";

  hudContainer.appendChild(altitude);
  hudContainer.appendChild(speed);
  overlay.appendChild(hudContainer);

  document.body.appendChild(overlay);

  if (!document.getElementById("fpv-overlay-keyframes")) {
    const style = document.createElement("style");
    style.id = "fpv-overlay-keyframes";
    style.textContent = `
      @keyframes fpv-grain {
        0% { transform: translate(0,0); }
        100% { transform: translate(-8px, -8px); }
      }
    `;
    document.head.appendChild(style);
  }

  return { overlay, altitude, speed };
}

export function createCollisionDialog(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = "collision-dialog";
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(20, 0, 0, 0.9);
    border: 2px solid #ff4444;
    padding: 2rem;
    color: #fff;
    font-family: 'Space Mono', monospace;
    z-index: 100;
    text-align: center;
    display: none;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 0 30px rgba(255, 0, 0, 0.4);
    min-width: 300px;
  `;

  const title = document.createElement("h1");
  title.textContent = "YOU COLLIDED";
  title.style.cssText = "color: #ff4444; margin: 0; font-size: 2.5rem; letter-spacing: 0.1em;";
  overlay.appendChild(title);

  const stats = document.createElement("div");
  stats.id = "collision-stats";
  stats.style.cssText = "text-align: left; margin: 1rem 0; font-size: 1.1rem; line-height: 1.6;";
  overlay.appendChild(stats);

  const reloadBtn = document.createElement("button");
  reloadBtn.id = "collision-reload-btn";
  reloadBtn.textContent = "RELOAD MISSION";
  reloadBtn.style.cssText = `
    margin-top: 1.5rem;
    padding: 0.8rem 1.5rem;
    background: #ff4444;
    color: white;
    border: none;
    font-family: 'Space Mono', monospace;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
    letter-spacing: 0.1em;
  `;
  reloadBtn.onmouseover = () => { reloadBtn.style.background = "#ff6666"; };
  reloadBtn.onmouseout = () => { reloadBtn.style.background = "#ff4444"; };
  reloadBtn.onclick = () => { window.location.reload(); };
  overlay.appendChild(reloadBtn);

  const nextBtn = document.createElement("button");
  nextBtn.id = "collision-next-btn";
  nextBtn.textContent = "NEXT TRIAL";
  nextBtn.style.cssText = `
    margin-top: 0.5rem;
    padding: 0.8rem 1.5rem;
    background: #4ade80;
    color: #02050a;
    border: none;
    font-family: 'Space Mono', monospace;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
    letter-spacing: 0.1em;
    display: none;
  `;
  nextBtn.onmouseover = () => { nextBtn.style.background = "#5bff91"; };
  nextBtn.onmouseout = () => { nextBtn.style.background = "#4ade80"; };
  overlay.appendChild(nextBtn);

  document.body.appendChild(overlay);
  return overlay;
}

export function showCollisionDialog(
  overlay: HTMLDivElement,
  data: { time: string; object: string; distanceToGoal: string },
  onNext?: () => void
): void {
  const stats = overlay.querySelector("#collision-stats");
  if (stats) {
    stats.innerHTML = `
      <div>=> Time into mission: ${data.time}</div>
      <div>=> Collision object: ${data.object}</div>
      <div>=> Distance from goal: ${data.distanceToGoal}</div>
    `;
  }

  const reloadBtn = overlay.querySelector("#collision-reload-btn") as HTMLElement;
  const nextBtn = overlay.querySelector("#collision-next-btn") as HTMLElement;

  if (onNext) {
    if (reloadBtn) reloadBtn.style.display = "none";
    if (nextBtn) {
      nextBtn.style.display = "block";
      nextBtn.onclick = () => {
        overlay.style.display = "none";
        onNext();
      };
    }
  } else {
    if (reloadBtn) reloadBtn.style.display = "block";
    if (nextBtn) nextBtn.style.display = "none";
  }

  overlay.style.display = "flex";
}

export function showMissionToast(text: string): void {
  const toast = document.getElementById("mission-toast");
  if (toast) {
    toast.textContent = text;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
  }
}

export function showBenchmarkResults(
  title: string,
  metrics: any,
  scenarioId: string,
  onNext?: () => void
): void {
  const dialog = document.getElementById("benchmark-results-dialog");
  const content = document.getElementById("benchmark-metrics-content");
  const titleEl = document.getElementById("benchmark-results-title");
  const closeBtn = document.getElementById("benchmark-close-btn");

  if (!dialog || !content || !titleEl || !closeBtn) return;

  titleEl.textContent = title;

  let html = `<div class="metric-row"><span class="metric-label">Time Taken</span><span class="metric-value">${metrics.timeToCompletionS}s</span></div>`;
  html += `<div class="metric-row"><span class="metric-label">Collisions</span><span class="metric-value">${metrics.collisionCount}</span></div>`;

  if (scenarioId === "mission-forest-supply-drop") {
    html += `<div class="metric-row"><span class="metric-label">Zone Progression</span><span class="metric-value">${metrics.zoneProgression}</span></div>`;
  } else if (scenarioId === "mission-canyon-terrain") {
    html += `<div class="metric-row"><span class="metric-label">Max Altitude</span><span class="metric-value">${metrics.maxAltitudeM}m</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Ascent Attempted</span><span class="metric-value">${metrics.ascentAttempted ? "Yes" : "No"}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Final Altitude</span><span class="metric-value">${metrics.altitudeAtCompletion}m</span></div>`;
  } else if (scenarioId === "mission-firefighter-id") {
    html += `<div class="metric-row"><span class="metric-label">Correct Target</span><span class="metric-value">${metrics.correctTargetReached}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Wrong Target Approach</span><span class="metric-value">${metrics.wrongTargetApproached ? "Yes" : "No"}</span></div>`;
  } else if (scenarioId === "mission-multistop-delivery") {
    html += `<div class="metric-row"><span class="metric-label">Waypoint 1</span><span class="metric-value">${metrics.waypoint1Reached ? "Reached" : "Missed"}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Waypoint 2</span><span class="metric-value">${metrics.waypoint2Reached ? "Reached" : "Missed"}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Correct Sequence</span><span class="metric-value">${metrics.correctSequence ? "Yes" : "No"}</span></div>`;
    if (metrics.timeToWaypoint1S) {
      html += `<div class="metric-row"><span class="metric-label">Split (WP1)</span><span class="metric-value">${metrics.timeToWaypoint1S}s</span></div>`;
    }
  }

  content.innerHTML = html;
  dialog.style.display = "flex";

  if (onNext) {
    closeBtn.textContent = "Next Trial";
    closeBtn.style.background = "#4ade80";
    closeBtn.style.color = "#02050a";
    closeBtn.onclick = () => {
      dialog.style.display = "none";
      onNext();
    };
  } else {
    closeBtn.textContent = "Dismiss";
    closeBtn.style.background = ""; // Reset to CSS default
    closeBtn.style.color = "";
    closeBtn.onclick = () => {
      dialog.style.display = "none";
    };
  }
}

export function showBatchResults(
  hud: HudElements,
  results: any[]
): void {
  const tableBody = hud.batchResultsTable.querySelector("tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  results.forEach(res => {
    const row = document.createElement("tr");

    // Determine the primary metric based on scenario
    let metricValue = "N/A";
    if (res.metrics.zoneProgression) metricValue = res.metrics.zoneProgression;
    else if (res.metrics.maxAltitudeM) metricValue = `${res.metrics.maxAltitudeM.toFixed(1)}m`;
    else if (res.metrics.correctTargetReached) metricValue = res.metrics.correctTargetReached;
    else if (res.metrics.waypoint2Reached !== undefined) metricValue = res.metrics.waypoint2Reached ? "WP2 Done" : (res.metrics.waypoint1Reached ? "WP1 Done" : "None");

    const successClass = res.success ? "status-yes" : "status-no";
    const successText = res.success ? "Yes" : "No";

    row.innerHTML = `
      <td>${res.trialName}</td>
      <td>${res.timeRequirement}s</td>
      <td class="${successClass}">${successText}</td>
      <td>${res.actualTime.toFixed(1)}s</td>
      <td style="color: #aaa; font-size: 0.7rem;">${res.reason || ""}</td>
      <td>${res.distanceToGoal || "N/A"}</td>
      <td>${res.metrics.collisionCount}</td>
      <td style="font-weight: bold;">${metricValue}</td>
    `;
    tableBody.appendChild(row);
  });

  hud.batchResultsDialog.style.display = "flex";

  hud.batchCloseBtn.onclick = () => {
    hud.batchResultsDialog.style.display = "none";
  };
}
