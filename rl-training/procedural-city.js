// procedural-city.js — Grid layout, street network, building/waypoint/LZ placement
// All geometry is Cesium entities (extruded polygons, polylines, ellipses)

const CELL_SIZE = 30; // meters per grid cell

// 7 high-contrast building colors (base, before domain randomization hue shift)
const DEFAULT_BUILDING_COLORS = [
  Cesium.Color.RED,
  Cesium.Color.BLUE,
  Cesium.Color.GREEN,
  Cesium.Color.YELLOW,
  Cesium.Color.ORANGE,
  new Cesium.Color(0.6, 0.2, 0.8, 1.0), // purple
  Cesium.Color.WHITE,
];

// Waypoint beam constants (from incident-overlay.js pattern)
const BEAM_HEIGHT = 150;
const BEAM_WIDTH_OUTER = 12;
const BEAM_WIDTH_INNER = 4;
const BEAM_GLOW_OUTER = 0.5;
const BEAM_GLOW_INNER = 0.25;
const BEAM_TAPER = 0.5;
const GROUND_MARKER_RADIUS = 5;

// Landing zone constants
const LZ_RADIUS = 8;
const LZ_CLEARANCE = 15; // minimum distance from buildings

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Convert grid cell (col, row) to (lon, lat) in degrees.
 * Arena centered at (centerLon, centerLat), cell (0,0) is bottom-left corner.
 */
function cellToLonLat(col, row, gridCols, gridRows, centerLon, centerLat, arenaSize) {
  const halfSize = arenaSize / 2;
  const metersPerDeg = 111320; // at equator
  const xMeters = (col + 0.5) * CELL_SIZE - halfSize;
  const yMeters = (row + 0.5) * CELL_SIZE - halfSize;
  return {
    lon: centerLon + xMeters / metersPerDeg,
    lat: centerLat + yMeters / metersPerDeg,
  };
}

/**
 * Convert meters offset to degrees offset (at equator).
 */
function metersToDeg(meters) {
  return meters / 111320;
}

/**
 * Generate a grid layout with streets and building placement cells.
 * @param {object} config
 * @returns {{ grid: number[][], gridCols: number, gridRows: number, streets: Set<string> }}
 */
function generateGrid(config) {
  const { arenaSize, corridorWidth = 20 } = config;
  const gridCols = Math.floor(arenaSize / CELL_SIZE);
  const gridRows = Math.floor(arenaSize / CELL_SIZE);

  // 0 = empty, 1 = street, 2 = building candidate
  const grid = Array.from({ length: gridRows }, () => new Array(gridCols).fill(2));
  const streets = new Set();

  // Street width in cells (at least 1, round up)
  const streetCells = Math.max(1, Math.round(corridorWidth / CELL_SIZE));

  // Generate E/W streets (horizontal)
  const numEW = randInt(3, Math.min(5, Math.floor(gridRows / 4)));
  const ewSpacing = Math.floor(gridRows / (numEW + 1));
  for (let i = 1; i <= numEW; i++) {
    const baseRow = i * ewSpacing;
    for (let sw = 0; sw < streetCells; sw++) {
      const row = baseRow + sw;
      if (row >= 0 && row < gridRows) {
        for (let col = 0; col < gridCols; col++) {
          grid[row][col] = 1;
          streets.add(`${col},${row}`);
        }
      }
    }
  }

  // Generate N/S streets (vertical)
  const numNS = randInt(3, Math.min(5, Math.floor(gridCols / 4)));
  const nsSpacing = Math.floor(gridCols / (numNS + 1));
  for (let i = 1; i <= numNS; i++) {
    const baseCol = i * nsSpacing;
    for (let sw = 0; sw < streetCells; sw++) {
      const col = baseCol + sw;
      if (col >= 0 && col < gridCols) {
        for (let row = 0; row < gridRows; row++) {
          grid[row][col] = 1;
          streets.add(`${col},${row}`);
        }
      }
    }
  }

  return { grid, gridCols, gridRows, streets };
}

/**
 * Create a building entity (extruded polygon) at a given position.
 * Reuses the creative-mode.js pattern.
 */
function createBuilding(viewer, lon, lat, width, depth, height, color) {
  const halfW = metersToDeg(width / 2);
  const halfD = metersToDeg(depth / 2);

  const entity = viewer.entities.add({
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray([
        lon - halfW, lat - halfD,
        lon + halfW, lat - halfD,
        lon + halfW, lat + halfD,
        lon - halfW, lat + halfD,
      ]),
      height: 0,
      extrudedHeight: height,
      material: color.withAlpha(0.85),
      outline: true,
      outlineColor: color.withAlpha(1.0),
    },
  });

  return {
    entity,
    lon,
    lat,
    width,
    depth,
    height,
    color,
  };
}

/**
 * Create a waypoint marker (beam + ground disc + label).
 * Reuses incident-overlay.js pattern.
 */
function createWaypoint(viewer, lon, lat, label, color, active = true) {
  const entities = [];
  const alpha = active ? 1.0 : 0.3;

  // Outer glow beam
  entities.push(viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lon, lat, 0,
        lon, lat, BEAM_HEIGHT,
      ]),
      width: BEAM_WIDTH_OUTER,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: BEAM_GLOW_OUTER,
        taperPower: BEAM_TAPER,
        color: color.withAlpha(0.15 * alpha),
      }),
    },
  }));

  // Inner core beam
  entities.push(viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lon, lat, 0,
        lon, lat, BEAM_HEIGHT,
      ]),
      width: BEAM_WIDTH_INNER,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: BEAM_GLOW_INNER,
        taperPower: BEAM_TAPER,
        color: color.withAlpha(0.7 * alpha),
      }),
    },
  }));

  // Ground disc
  entities.push(viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
      semiMajorAxis: GROUND_MARKER_RADIUS,
      semiMinorAxis: GROUND_MARKER_RADIUS,
      height: 0.1, // slightly above ground to avoid z-fighting
      material: color.withAlpha(0.3 * alpha),
      outline: true,
      outlineColor: color.withAlpha(0.8 * alpha),
      outlineWidth: 2,
    },
  }));

  // Label
  entities.push(viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, BEAM_HEIGHT * 0.8),
    label: {
      text: label,
      font: 'bold 14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 5000, 0.4),
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.55),
      backgroundPadding: new Cesium.Cartesian2(8, 5),
    },
  }));

  return { entities, lon, lat, label, active };
}

/**
 * Create a landing zone (green disc with white cross pattern).
 */
function createLandingZone(viewer, lon, lat) {
  const entities = [];

  // Green ground disc
  entities.push(viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
      semiMajorAxis: LZ_RADIUS,
      semiMinorAxis: LZ_RADIUS,
      height: 0.05,
      material: Cesium.Color.GREEN.withAlpha(0.4),
      outline: true,
      outlineColor: Cesium.Color.GREEN.withAlpha(0.9),
      outlineWidth: 3,
    },
  }));

  // White cross — N/S line
  const crossLen = metersToDeg(LZ_RADIUS * 0.7);
  entities.push(viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lon, lat - crossLen, 0.2,
        lon, lat + crossLen, 0.2,
      ]),
      width: 3,
      material: Cesium.Color.WHITE.withAlpha(0.9),
    },
  }));

  // White cross — E/W line
  entities.push(viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lon - crossLen, lat, 0.2,
        lon + crossLen, lat, 0.2,
      ]),
      width: 3,
      material: Cesium.Color.WHITE.withAlpha(0.9),
    },
  }));

  // "LZ" label
  entities.push(viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 15),
    label: {
      text: 'LZ',
      font: 'bold 16px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 2000, 0.4),
    },
  }));

  return { entities, lon, lat, radius: LZ_RADIUS };
}

/**
 * Check if a cell is far enough from all buildings.
 */
function isClearOfBuildings(lon, lat, buildings, clearance) {
  const clearanceDeg = metersToDeg(clearance);
  for (const b of buildings) {
    const dx = lon - b.lon;
    const dy = lat - b.lat;
    if (Math.sqrt(dx * dx + dy * dy) < clearanceDeg) return false;
  }
  return true;
}

/**
 * Check line-of-sight between two points (no building in the way).
 * Simple axis-aligned check: verifies no building center is within threshold of the line.
 */
function hasLineOfSight(lon1, lat1, lon2, lat2, buildings, threshold = 0.00015) {
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return true;

  for (const b of buildings) {
    // Project building center onto line segment
    const t = Math.max(0, Math.min(1,
      ((b.lon - lon1) * dx + (b.lat - lat1) * dy) / (len * len)
    ));
    const projLon = lon1 + t * dx;
    const projLat = lat1 + t * dy;
    const dist = Math.sqrt((b.lon - projLon) ** 2 + (b.lat - projLat) ** 2);
    if (dist < threshold) return false;
  }
  return true;
}

/**
 * Generate a complete procedural city.
 * @param {Cesium.Viewer} viewer
 * @param {object} config - from TaskCurriculum.getGenerationConfig() + domain randomization
 * @returns {object} cityInfo
 */
export function generateCity(viewer, config) {
  const {
    arenaSize = 400,
    buildingCount = 10,
    waypointCount = 1,
    lzCount = 0,
    maxBuildingHeight = 50,
    corridorWidth = 20,
    buildingColors = DEFAULT_BUILDING_COLORS,
    heightMultiplier = 1.0,
    centerLon = 0,
    centerLat = 0,
    level = 2,
    targetColorName = null, // for Level 4 — which color the target building should be
  } = config;

  const allEntities = [];
  const buildings = [];
  const waypoints = [];
  const landingZones = [];

  // Generate grid with streets
  const { grid, gridCols, gridRows, streets } = generateGrid({ arenaSize, corridorWidth });

  // Collect building candidate cells
  const candidates = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (grid[row][col] === 2) {
        candidates.push({ col, row });
      }
    }
  }

  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Place buildings
  const numBuildings = Math.min(buildingCount, candidates.length);
  let targetBuildingIdx = -1;

  // For Level 4: designate one building as the target with a unique color
  if (level === 4 && targetColorName) {
    targetBuildingIdx = 0; // first building is the target
  }

  for (let i = 0; i < numBuildings; i++) {
    const { col, row } = candidates[i];
    const pos = cellToLonLat(col, row, gridCols, gridRows, centerLon, centerLat, arenaSize);

    const width = rand(10, 40);
    const depth = rand(10, 40);
    const height = rand(8, maxBuildingHeight) * heightMultiplier;

    let color;
    if (i === targetBuildingIdx) {
      // Target building gets specific color
      const colorMap = {
        red: Cesium.Color.RED,
        blue: Cesium.Color.BLUE,
        green: Cesium.Color.GREEN,
        yellow: Cesium.Color.YELLOW,
        orange: Cesium.Color.ORANGE,
        purple: new Cesium.Color(0.6, 0.2, 0.8, 1.0),
        white: Cesium.Color.WHITE,
      };
      color = colorMap[targetColorName] || pick(buildingColors);
    } else {
      color = pick(buildingColors);
    }

    const building = createBuilding(viewer, pos.lon, pos.lat, width, depth, height, color);
    building.isTarget = (i === targetBuildingIdx);
    building.colorName = i === targetBuildingIdx ? targetColorName : null;
    buildings.push(building);
    allEntities.push(building.entity);
  }

  // Collect empty street cells for waypoint/LZ placement
  const emptyCells = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (grid[row][col] === 1) {
        const pos = cellToLonLat(col, row, gridCols, gridRows, centerLon, centerLat, arenaSize);
        if (isClearOfBuildings(pos.lon, pos.lat, buildings, 20)) {
          emptyCells.push(pos);
        }
      }
    }
  }

  // Shuffle empty cells
  for (let i = emptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
  }

  // Place waypoints
  let wpIdx = 0;
  const wpColor = Cesium.Color.CYAN;
  for (let i = 0; i < waypointCount && wpIdx < emptyCells.length; i++) {
    const pos = emptyCells[wpIdx++];

    // Verify line-of-sight to previous waypoint (if any)
    if (waypoints.length > 0) {
      const prev = waypoints[waypoints.length - 1];
      if (!hasLineOfSight(prev.lon, prev.lat, pos.lon, pos.lat, buildings)) {
        // Try next cell
        i--;
        continue;
      }
    }

    const wp = createWaypoint(viewer, pos.lon, pos.lat, `WP-${i + 1}`, wpColor, i === 0);
    waypoints.push(wp);
    allEntities.push(...wp.entities);
  }

  // Place landing zones
  for (let i = 0; i < lzCount && wpIdx < emptyCells.length; i++) {
    const pos = emptyCells[wpIdx++];
    if (isClearOfBuildings(pos.lon, pos.lat, buildings, LZ_CLEARANCE)) {
      const lz = createLandingZone(viewer, pos.lon, pos.lat);
      landingZones.push(lz);
      allEntities.push(...lz.entities);
    }
  }

  // Find a valid spawn position (empty street cell away from buildings)
  let spawnPos = { lon: centerLon, lat: centerLat };
  for (const cell of emptyCells) {
    if (isClearOfBuildings(cell.lon, cell.lat, buildings, 20)) {
      spawnPos = cell;
      break;
    }
  }

  return {
    buildings,
    waypoints,
    landingZones,
    allEntities,
    spawnPos,
    grid,
    gridCols,
    gridRows,
    arenaSize,
    centerLon,
    centerLat,
  };
}

/**
 * Set waypoint active state (for visual pulsing).
 * @param {object} waypoint - waypoint object from generateCity
 * @param {boolean} active
 */
export function setWaypointActive(waypoint, active) {
  waypoint.active = active;
  // Update beam alpha
  const alpha = active ? 1.0 : 0.15;
  for (const entity of waypoint.entities) {
    if (entity.polyline) {
      // Recreating material is the simplest approach for Cesium
      // In production, use CallbackProperty for animation
    }
    // Toggle visibility for completed waypoints
    entity.show = active || false; // hide completed waypoints
  }
}

/**
 * Deactivate (hide) a reached waypoint.
 * @param {object} waypoint
 */
export function deactivateWaypoint(waypoint) {
  waypoint.active = false;
  for (const entity of waypoint.entities) {
    entity.show = false;
  }
}
