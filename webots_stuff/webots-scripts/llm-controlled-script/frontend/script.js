document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('iterations-container');
  const missionInfo = document.getElementById('mission-info');
  const loader = document.getElementById('loader');
  const template = document.getElementById('iteration-template');
  const selector = document.getElementById('mission-selector');

  // Get mission path from URL
  const urlParams = new URLSearchParams(window.location.search);
  const missionPath = urlParams.get('mission');

  // Load mission list and initialize
  init();

  async function init() {
    await fetchMissions();

    if (missionPath) {
      selector.value = missionPath;
      fetchData(missionPath);
    } else if (selector.options.length > 1) {
      // If no mission in URL, load the latest one (first in the list)
      const latest = selector.options[1].value;
      updateMissionUrl(latest);
      fetchData(latest);
    } else {
      showError('No missions found. Please run a flight first.');
    }
  }

  async function fetchMissions() {
    try {
      const response = await fetch('/api/missions');
      if (!response.ok) return; // Fallback to manual URL if API fails

      const missions = await response.json();
      missions.forEach(path => {
        const option = document.createElement('option');
        option.value = path;
        option.textContent = formatMissionName(path);
        selector.appendChild(option);
      });
    } catch (err) {
      console.warn('Could not fetch mission list:', err);
    }
  }

  function formatMissionName(path) {
    const folderName = path.split('/').pop();
    // Format "mission_20260123_093827" -> "Mission 09:38 23/01/2026"
    const match = folderName.match(/mission_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const [_, y, m, d, hh, mm, ss] = match;
      return `Mission ${hh}:${mm} ${d}/${m}/${y}`;
    }
    return folderName;
  }

  selector.addEventListener('change', (e) => {
    const path = e.target.value;
    if (path) {
      updateMissionUrl(path);
      container.innerHTML = '';
      loader.style.display = 'flex';
      fetchData(path);
    }
  });

  function updateMissionUrl(path) {
    const newUrl = `${window.location.pathname}?mission=${path}`;
    window.history.pushState({ path }, '', newUrl);
  }

  async function fetchData(path) {
    try {
      const response = await fetch(`/${path}/log.json`);
      if (!response.ok) throw new Error(`Failed to load log.json from ${path}`);

      const data = await response.json();
      renderDashboard(data, path);
    } catch (err) {
      console.error(err);
      showError(`Error loading mission data: ${err.message}`);
    }
  }

  function renderDashboard(data, missionDir) {
    loader.style.display = 'none';

    if (!data || data.length === 0) {
      showError('Mission log is empty.');
      return;
    }

    // Header info
    const goal = data[0].PROMPT.match(/Mission goal:\s*(.*?)\s*Recent action history/s)?.[1] || "Drone Navigation Mission";
    missionInfo.innerHTML = `
            <div><span class="label">Mission:</span> ${missionDir.split('/').pop()}</div>
            <div style="margin-top: 4px"><span class="label">Goal:</span> ${goal.trim()}</div>
        `;

    // Render iterations
    data.forEach(item => {
      const clone = template.content.cloneNode(true);
      const card = clone.querySelector('.iteration-card');

      card.querySelector('.iteration-number').textContent = `#${item.ITERATION || '?'}`;
      card.querySelector('.timestamp').textContent = new Date(item.TIMESTAMP).toLocaleString();

      const action = item.RESPONSE.action || 'unknown';
      card.querySelector('.action-tag').textContent = action;
      card.querySelector('.action-tag').style.borderColor = getActionColor(action);
      card.querySelector('.action-tag').style.color = getActionColor(action);

      // Image
      let imgPath = item.IMAGE_PATH || '';
      if (imgPath) {
        // If it's an absolute path, try to make it relative to the served root
        if (imgPath.includes('/drone_logs/')) {
          imgPath = imgPath.substring(imgPath.indexOf('drone_logs/'));
        }
        // Ensure it has a leading slash for the fetch
        if (!imgPath.startsWith('/')) imgPath = '/' + imgPath;
        card.querySelector('.observation-image').src = imgPath;
      }

      // Prompt
      card.querySelector('.prompt-text').textContent = item.PROMPT;
      const toggleBtn = card.querySelector('.toggle-prompt');
      const wrapper = card.querySelector('.prompt-content-wrapper');

      toggleBtn.addEventListener('click', () => {
        const isExpanded = wrapper.classList.toggle('expanded');
        toggleBtn.textContent = isExpanded ? 'Collapse Prompt' : 'Show Full Prompt';
      });

      // Decision
      card.querySelector('.reasoning-text').textContent = item.RESPONSE.reasoning || 'No reasoning provided.';
      card.querySelector('.action-value').textContent = action;
      card.querySelector('.magnitude-value').textContent = item.RESPONSE.magnitude || 'N/A';

      const goalAchieved = item.RESPONSE.goal_achieved === true;
      const goalEl = card.querySelector('.goal-value');
      goalEl.textContent = goalAchieved ? 'TRUE' : 'FALSE';
      goalEl.classList.add(goalAchieved ? 'true' : 'false');

      container.appendChild(clone);
    });
  }

  function getActionColor(action) {
    const colors = {
      'forward': '#58a6ff',
      'backward': '#bc8cff',
      'left': '#3fb950',
      'right': '#d29922',
      'rotate_clockwise': '#f0883e',
      'rotate_counterclockwise': '#f0883e',
      'ascend': '#aff5b4',
      'descend': '#ff7b72',
      'land': '#f85149',
      'hover': '#8b949e'
    };
    return colors[action] || '#8b949e';
  }

  function showError(msg) {
    loader.style.display = 'none';
    const errDiv = document.createElement('div');
    errDiv.className = 'glass-card';
    errDiv.style.padding = '2rem';
    errDiv.style.color = '#f85149';
    errDiv.style.textAlign = 'center';
    errDiv.innerHTML = `<h3>Error</h3><p>${msg}</p>`;
    container.appendChild(errDiv);
  }
});
