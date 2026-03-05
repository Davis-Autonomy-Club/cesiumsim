import type { Playground, Obstacle, Waypoint } from "./types";

const WAYPOINT_STYLE = {
  active: Cesium.Color.fromCssColorString("#ff9f1c"),
  upcoming: Cesium.Color.fromCssColorString("#4cc9f0"),
  reached: Cesium.Color.fromCssColorString("#52b788"),
  labelOutline: Cesium.Color.BLACK,
};

export type WaypointEntities = {
  id: string;
  marker: Cesium.Entity;
  radiusBubble: Cesium.Entity;
};

export type PlaygroundLoadResult = {
  terrainProvider: Cesium.TerrainProvider;
  obstacleEntities: Cesium.Entity[];
  waypointEntities: WaypointEntities[];
  skipWorldDetailLayers: boolean;
};

export function loadPlayground(
  playground: Playground,
  viewer: Cesium.Viewer,
  excludeFromPicking?: Cesium.Entity[]
): PlaygroundLoadResult {
  const obstacleEntities: Cesium.Entity[] = [];
  const waypointEntities: WaypointEntities[] = [];

  for (const obs of playground.obstacles) {
    const entity = createObstacleEntity(obs);
    if (entity) {
      viewer.entities.add(entity);
      obstacleEntities.push(entity);
    }
  }

  const waypoints = playground.waypoints ?? [];
  for (let i = 0; i < waypoints.length; i++) {
    const wpBundle = createWaypointEntities(waypoints[i], i + 1);
    viewer.entities.add(wpBundle.radiusBubble);
    viewer.entities.add(wpBundle.marker);
    waypointEntities.push(wpBundle);
  }

  applyWaypointVisualState(
    waypointEntities,
    waypoints,
    playground.waypointMode ?? "ordered",
    new Set<string>()
  );

  const terrainProvider =
    playground.terrain === "flat" || playground.terrain === "ellipsoid"
      ? new Cesium.EllipsoidTerrainProvider()
      : new Cesium.EllipsoidTerrainProvider();

  return {
    terrainProvider,
    obstacleEntities,
    waypointEntities,
    skipWorldDetailLayers: true,
  };
}

export function unloadPlayground(
  viewer: Cesium.Viewer,
  obstacleEntities: Cesium.Entity[],
  waypointEntities: WaypointEntities[] = []
): void {
  for (const entity of obstacleEntities) {
    viewer.entities.remove(entity);
  }
  for (const wp of waypointEntities) {
    viewer.entities.remove(wp.marker);
    viewer.entities.remove(wp.radiusBubble);
  }
}

export function applyWaypointVisualState(
  waypointEntities: WaypointEntities[],
  waypoints: Waypoint[] | undefined,
  waypointMode: Playground["waypointMode"],
  reachedIds: Set<string>
): void {
  if (!waypoints?.length || waypointEntities.length === 0) {
    return;
  }

  const mode = waypointMode ?? "ordered";
  const activeId =
    mode === "ordered"
      ? waypoints.find((wp) => !reachedIds.has(wp.id))?.id
      : null;

  for (const wpEntity of waypointEntities) {
    if (reachedIds.has(wpEntity.id)) {
      setWaypointStyle(wpEntity, "reached");
      continue;
    }
    if (activeId && wpEntity.id === activeId) {
      setWaypointStyle(wpEntity, "active");
      continue;
    }
    setWaypointStyle(wpEntity, mode === "ordered" ? "upcoming" : "active");
  }
}

function createObstacleEntity(obs: Obstacle): Cesium.Entity | null {
  const position = Cesium.Cartesian3.fromDegrees(
    obs.position.lon,
    obs.position.lat,
    obs.position.height
  );

  if (obs.type === "box") {
    const heading = obs.heading ?? 0;
    return new Cesium.Entity({
      position,
      box: {
        dimensions: new Cesium.Cartesian3(
          obs.dimensions.length,
          obs.dimensions.width,
          obs.dimensions.height
        ),
        material: Cesium.Color.GRAY.withAlpha(0.8),
        outline: true,
        outlineColor: Cesium.Color.DARKGRAY,
      },
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(heading),
          0,
          0
        ),
        Cesium.Ellipsoid.WGS84,
        Cesium.Transforms.eastNorthUpToFixedFrame
      ),
    });
  }

  if (obs.type === "cylinder") {
    return new Cesium.Entity({
      position,
      cylinder: {
        length: obs.length,
        topRadius: obs.topRadius,
        bottomRadius: obs.bottomRadius ?? obs.topRadius,
        material: Cesium.Color.GRAY.withAlpha(0.8),
        outline: true,
        outlineColor: Cesium.Color.DARKGRAY,
      },
    });
  }

  if (obs.type === "ring") {
    const innerRadius = obs.innerRadius;
    const outerRadius = obs.outerRadius;
    const segments = 32;
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
      position,
      Cesium.Ellipsoid.WGS84,
      new Cesium.Matrix4()
    );
    const outerPositions: Cesium.Cartesian3[] = [];
    const innerPositions: Cesium.Cartesian3[] = [];
    const headingRad = Cesium.Math.toRadians(obs.heading ?? 0);
    const cosH = Math.cos(headingRad);
    const sinH = Math.sin(headingRad);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const ox = (cosA * cosH - sinA * sinH) * outerRadius;
      const oy = (cosA * sinH + sinA * cosH) * outerRadius;
      const ix = (cosA * cosH - sinA * sinH) * innerRadius;
      const iy = (cosA * sinH + sinA * cosH) * innerRadius;
      const outer = new Cesium.Cartesian3(ox, oy, 0);
      const inner = new Cesium.Cartesian3(ix, iy, 0);
      Cesium.Matrix4.multiplyByPoint(transform, outer, outer);
      Cesium.Matrix4.multiplyByPoint(transform, inner, inner);
      outerPositions.push(outer);
      innerPositions.push(inner);
    }
    const hierarchy = new Cesium.PolygonHierarchy(outerPositions, [
      new Cesium.PolygonHierarchy(innerPositions.reverse()),
    ]);
    return new Cesium.Entity({
      position,
      polygon: {
        hierarchy,
        extrudedHeight: 1,
        height: 0,
        material: Cesium.Color.CYAN.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
      },
    });
  }

  return null;
}

function createWaypointEntities(waypoint: Waypoint, index: number): WaypointEntities {
  const position = Cesium.Cartesian3.fromDegrees(
    waypoint.position.lon,
    waypoint.position.lat,
    waypoint.position.height
  );

  const radiusBubble = new Cesium.Entity({
    position,
    ellipsoid: {
      radii: new Cesium.Cartesian3(waypoint.radius, waypoint.radius, waypoint.radius),
      material: WAYPOINT_STYLE.upcoming.withAlpha(0.16),
      outline: true,
      outlineColor: WAYPOINT_STYLE.upcoming.withAlpha(0.9),
      outlineWidth: 1,
    },
  });

  const marker = new Cesium.Entity({
    position,
    point: {
      pixelSize: 10,
      color: WAYPOINT_STYLE.upcoming,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1.5,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: `${index}. ${waypoint.id}`,
      font: "600 13px 'JetBrains Mono', monospace",
      fillColor: WAYPOINT_STYLE.upcoming,
      outlineColor: WAYPOINT_STYLE.labelOutline,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  return {
    id: waypoint.id,
    marker,
    radiusBubble,
  };
}

function setWaypointStyle(entity: WaypointEntities, state: "active" | "upcoming" | "reached"): void {
  const color = WAYPOINT_STYLE[state];
  const point = entity.marker.point;
  if (point) {
    point.color = color;
    point.pixelSize = state === "active" ? 12 : 10;
  }

  const label = entity.marker.label;
  if (label) {
    label.fillColor = color;
  }

  const bubble = entity.radiusBubble.ellipsoid;
  if (bubble) {
    bubble.material = color.withAlpha(state === "reached" ? 0.08 : 0.16);
    bubble.outlineColor = color.withAlpha(0.92);
  }
}
