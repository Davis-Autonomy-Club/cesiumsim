// ### What this file does
// Shows the Airline Fire wildfire incident on the 3D map.
// Draws glowing vertical beams at key locations (staging site, landing zone,
// fire origin, fire station) and a delivery route line between them.

// ### Visual settings for beams, route line, and labels
const BEAM_HEIGHT        = 2500;   // meters above base elevation
const BEAM_WIDTH_INNER   = 8;
const BEAM_WIDTH_OUTER   = 20;
const BEAM_GLOW_INNER    = 0.25;
const BEAM_GLOW_OUTER    = 0.5;
const BEAM_TAPER         = 0.8;
const ROUTE_WIDTH        = 5;
const ROUTE_GLOW         = 0.2;
const GROUND_MARKER_RADIUS = 40;   // meters
const LABEL_FONT         = '13px "Space Mono", monospace';
const DIST_LABEL_FONT    = 'bold 15px "Space Mono", monospace';

// ### Incident information and real-world coordinates for each location
const INCIDENT = {
  name:  'Airline Fire',
  date:  'July 2–5, 2024',
  acres: '1,295',
  unit:  'CAL FIRE BEU',
};

/*
 * Coordinates rationale (see researchReport.md):
 *
 *  SPATIAL LAYOUT (north → south):
 *
 *    Staging Site ──── Hwy 25 / Panoche Rd (paved road access)
 *         |
 *      ~1 mi          drone flies south, never crosses the fire
 *         |
 *        LZ ────────── northern fire perimeter, open rangeland clearing
 *         |             (crews fight from the "black" / already-burned side)
 *       ~0.4 mi
 *         |
 *    Fire Origin ───── center of the 1,295-acre burn area
 *
 *  - Fire Origin: exact from Cal Fire incident page.
 *  - Staging Site: Hwy 25 (Airline Hwy) north of fire — the only paved
 *    access for apparatus in this remote rangeland.
 *  - Landing Zone: on the northern fire perimeter where crews are
 *    stationed. Open clearing on the "black" (already-burned) side of
 *    the fire line. The drone approaches from the north and never
 *    overflies the active fire. ~1 mi from staging (PRD avg distance).
 *  - Beaver Dam Station: Cal Fire Station 61, closest permanent BEU
 *    facility at 5300 Hernandez-Coalinga Rd, Paicines.
 */
const POINTS = [
  {
    key: 'staging',
    name: 'Staging Site',
    subtitle: 'Fire Truck / Drone Launch',
    lat: 36.6750,
    lon: -121.2050,
    css: '#00aaff',
    elev: 330,
  },
  {
    key: 'lz',
    name: 'Landing Zone (LZ)',
    subtitle: 'Crew Perimeter — Open Clearing',
    lat: 36.6640,
    lon: -121.2160,
    css: '#00ff88',
    elev: 410,
  },
  {
    key: 'origin',
    name: 'Fire Origin',
    subtitle: 'Ignition Point',
    lat: 36.6592,
    lon: -121.2211,
    css: '#ff4444',
    elev: 420,
  },
  {
    key: 'beaverDam',
    name: 'Beaver Dam Station',
    subtitle: 'CAL FIRE Station 61',
    lat: 36.6350,
    lon: -121.0650,
    css: '#ffaa00',
    elev: 280,
  },
];

const ROUTE = { fromKey: 'staging', toKey: 'lz', css: '#ffd700' };

// ### Internal state
let entities = [];
let visible  = true;
let routeDistMiles = 0;

// ### Distance calculator — measures miles between two GPS coordinates on a sphere
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ### Create the 3D beacons, ground markers, labels, and delivery route on the map

export function initIncidentOverlay(viewer) {
  // Beacon beams at each point
  for (const pt of POINTS) {
    const color = Cesium.Color.fromCssColorString(pt.css);

    // Outer glow (wider, translucent halo)
    entities.push(viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          pt.lon, pt.lat, pt.elev,
          pt.lon, pt.lat, pt.elev + BEAM_HEIGHT,
        ]),
        width: BEAM_WIDTH_OUTER,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: BEAM_GLOW_OUTER,
          taperPower: BEAM_TAPER,
          color: color.withAlpha(0.15),
        }),
      },
    }));

    // Inner core beam
    entities.push(viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          pt.lon, pt.lat, pt.elev,
          pt.lon, pt.lat, pt.elev + BEAM_HEIGHT,
        ]),
        width: BEAM_WIDTH_INNER,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: BEAM_GLOW_INNER,
          taperPower: BEAM_TAPER,
          color: color.withAlpha(0.7),
        }),
      },
    }));

    // Ground disc (clamped to terrain)
    entities.push(viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat),
      ellipse: {
        semiMajorAxis: GROUND_MARKER_RADIUS,
        semiMinorAxis: GROUND_MARKER_RADIUS,
        height: 0,
        material: color.withAlpha(0.3),
        outline: true,
        outlineColor: color.withAlpha(0.8),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    }));

    // Label near beam base
    entities.push(viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.elev + 120),
      label: {
        text: `${pt.name}\n${pt.subtitle}`,
        font: LABEL_FONT,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        pixelOffset: new Cesium.Cartesian2(14, -6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.55),
        backgroundPadding: new Cesium.Cartesian2(8, 5),
        scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 50000, 0.4),
        translucencyByDistance: new Cesium.NearFarScalar(5000, 1.0, 80000, 0.3),
      },
    }));
  }

  // Delivery-route polyline (staging → LZ)
  const from = POINTS.find(p => p.key === ROUTE.fromKey);
  const to   = POINTS.find(p => p.key === ROUTE.toKey);
  if (from && to) {
    const routeColor = Cesium.Color.fromCssColorString(ROUTE.css);
    const routeElev  = Math.max(from.elev, to.elev) + 50;

    entities.push(viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          from.lon, from.lat, routeElev,
          to.lon,   to.lat,   routeElev,
        ]),
        width: ROUTE_WIDTH,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: ROUTE_GLOW,
          color: routeColor.withAlpha(0.8),
        }),
      },
    }));

    routeDistMiles = haversine(from.lat, from.lon, to.lat, to.lon);

    // Distance label at midpoint
    const midLat = (from.lat + to.lat) / 2;
    const midLon = (from.lon + to.lon) / 2;

    entities.push(viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(midLon, midLat, routeElev + 60),
      label: {
        text: `${routeDistMiles.toFixed(2)} mi`,
        font: DIST_LABEL_FONT,
        fillColor: routeColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
        backgroundPadding: new Cesium.Cartesian2(10, 6),
        scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 30000, 0.5),
      },
    }));
  }
}

// ### Build the legend panel in the bottom-right corner showing incident details

export function buildIncidentLegend() {
  const body = document.getElementById('incident-body');
  if (!body) return;

  // Incident info
  const info = document.createElement('div');
  info.id = 'incident-info';
  info.innerHTML =
    `<strong>${INCIDENT.name}</strong> &mdash; ${INCIDENT.date}<br>` +
    `${INCIDENT.acres} acres &middot; ${INCIDENT.unit}`;
  body.appendChild(info);

  // Legend items
  const legend = document.createElement('div');
  legend.id = 'incident-legend';

  for (const pt of POINTS) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML =
      `<span class="legend-dot" style="background:${pt.css}"></span>` +
      `<span class="legend-label">${pt.name}</span>` +
      `<span class="legend-sub">${pt.subtitle}</span>`;
    legend.appendChild(item);
  }

  // Route legend entry
  const routeItem = document.createElement('div');
  routeItem.className = 'legend-item';
  routeItem.innerHTML =
    `<span class="legend-line" style="background:${ROUTE.css}"></span>` +
    `<span class="legend-label">Delivery Route</span>` +
    `<span class="legend-sub">${routeDistMiles.toFixed(2)} mi</span>`;
  legend.appendChild(routeItem);

  body.appendChild(legend);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'incident-actions';
  actions.innerHTML =
    `<button id="incident-toggle-btn" class="speed-btn" type="button">HIDE</button>` +
    `<button id="incident-teleport-btn" class="speed-btn" type="button">FLY TO</button>`;
  body.appendChild(actions);

  // Collapse / expand header toggle
  const header = document.getElementById('incident-header');
  const arrow  = document.getElementById('incident-arrow');
  if (header) {
    header.addEventListener('click', () => {
      body.classList.toggle('collapsed');
      if (arrow) {
        arrow.style.transform = body.classList.contains('collapsed')
          ? 'rotate(-90deg)' : '';
      }
    });
  }
}

// ### Show or hide all incident markers

export function toggleIncidentOverlay() {
  visible = !visible;
  for (const e of entities) e.show = visible;
  return visible;
}

export function isOverlayVisible() {
  return visible;
}

// ### Camera position for the "Fly To" button — shows an overview of the fire area
export const AIRLINE_FIRE_LOCATION = {
  longitude: -121.20523,
  latitude:  36.67424,
  height:    393.2,  // 1290ft MSL / 250ft AGL
};
