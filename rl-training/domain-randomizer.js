// domain-randomizer.js — Per-episode visual + physics randomization

const GROUND_COLORS = [
  { r: 0.45, g: 0.45, b: 0.45 }, // gray
  { r: 0.55, g: 0.40, b: 0.28 }, // brown
  { r: 0.30, g: 0.50, b: 0.25 }, // green
  { r: 0.20, g: 0.22, b: 0.20 }, // dark
  { r: 0.50, g: 0.48, b: 0.40 }, // tan
  { r: 0.35, g: 0.35, b: 0.30 }, // dark olive
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shift a Cesium.Color's hue by a random amount.
 * @param {Cesium.Color} color
 * @param {number} maxShiftDeg - max hue shift in degrees
 * @returns {Cesium.Color}
 */
function hueShift(color, maxShiftDeg) {
  // Convert RGB to HSL, shift hue, convert back
  const r = color.red, g = color.green, b = color.blue;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  // Apply shift
  h += rand(-maxShiftDeg, maxShiftDeg) / 360;
  if (h < 0) h += 1;
  if (h > 1) h -= 1;

  // HSL to RGB
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1 / 3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }

  return new Cesium.Color(r2, g2, b2, color.alpha);
}

/**
 * Generate a full set of randomized parameters for one episode.
 * @param {number} difficulty - scalar [0, 1]
 * @returns {object} randomized episode config
 */
export function randomizeEpisode(difficulty = 0.5) {
  const gc = pick(GROUND_COLORS);
  const groundColor = new Cesium.Color(
    gc.r + rand(-0.05, 0.05),
    gc.g + rand(-0.05, 0.05),
    gc.b + rand(-0.05, 0.05),
    1.0,
  );

  // Building colors — 7 base colors, each hue-shifted
  const baseColors = [
    Cesium.Color.RED,
    Cesium.Color.BLUE,
    Cesium.Color.GREEN,
    Cesium.Color.YELLOW,
    Cesium.Color.ORANGE,
    new Cesium.Color(0.6, 0.2, 0.8, 1.0), // purple
    Cesium.Color.WHITE,
  ];
  const buildingColors = baseColors.map(c => hueShift(c, 15));

  // Building height multiplier
  const heightMultiplier = rand(0.7, 1.3);

  // Wind
  const windSpeed = rand(0, 10) * difficulty;
  const windDirection = rand(0, 2 * Math.PI);
  const turbulenceIntensity = rand(0, 0.3) * difficulty;

  // Camera FOV (100-140 deg)
  const fovDeg = rand(100, 140);
  const fovRad = Cesium.Math.toRadians(fovDeg);

  // Fog
  const fogDensity = rand(0, 0.001) * difficulty;

  // Spawn heading
  const spawnHeading = rand(0, 2 * Math.PI);

  // Arena rotation
  const arenaRotation = rand(0, 2 * Math.PI);

  // Sky color variation
  const skyColor = new Cesium.Color(
    0.5 + rand(-0.1, 0.1),
    0.6 + rand(-0.1, 0.1),
    0.8 + rand(-0.05, 0.05),
    1.0,
  );

  return {
    groundColor,
    buildingColors,
    heightMultiplier,
    windSpeed,
    windDirection,
    turbulenceIntensity,
    fovRad,
    fogDensity,
    spawnHeading,
    arenaRotation,
    skyColor,
  };
}
