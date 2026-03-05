import type { Playground, Obstacle } from "./types";

export type PlaygroundLoadResult = {
  terrainProvider: any;
  obstacleEntities: any[];
  skipWorldDetailLayers: boolean;
};

export function loadPlayground(
  playground: Playground,
  viewer: any,
  excludeFromPicking?: any[]
): PlaygroundLoadResult {
  const obstacleEntities: any[] = [];

  for (const obs of playground.obstacles) {
    const entities = createObstacleEntity(obs, playground);
    for (const entity of entities) {
      viewer.entities.add(entity);
      obstacleEntities.push(entity);
    }
  }

  const terrainProvider =
    playground.terrain === "flat" || playground.terrain === "ellipsoid"
      ? new Cesium.EllipsoidTerrainProvider()
      : new Cesium.EllipsoidTerrainProvider();

  return {
    terrainProvider,
    obstacleEntities,
    skipWorldDetailLayers: true,
  };
}

export function unloadPlayground(
  viewer: any,
  obstacleEntities: any[]
): void {
  for (const entity of obstacleEntities) {
    viewer.entities.remove(entity);
  }
}

function createObstacleEntity(obs: Obstacle, playground?: Playground): any[] {
  const entities: any[] = [];

  const position = Cesium.Cartesian3.fromDegrees(
    obs.position.lon,
    obs.position.lat,
    obs.position.height
  );

  const getColor = (c?: { red: number; green: number; blue: number; alpha?: number }, fallback?: any) => {
    return c
      ? Cesium.Color.fromBytes(
        Math.round(c.red * 255),
        Math.round(c.green * 255),
        Math.round(c.blue * 255),
        Math.round((c.alpha ?? 1.0) * 255)
      )
      : fallback ?? Cesium.Color.GRAY.withAlpha(1.0);
  };

  if (obs.type === "box") {
    const heading = obs.heading ?? 0;
    const color = getColor(obs.color, Cesium.Color.GRAY.withAlpha(1.0));
    entities.push(new Cesium.Entity({
      position,
      box: {
        dimensions: new Cesium.Cartesian3(
          obs.dimensions.length,
          obs.dimensions.width,
          obs.dimensions.height
        ),
        material: color,
        outline: true,
        outlineColor: color.brighten(0.3, new Cesium.Color()),
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
    }));
  }

  else if (obs.type === "cylinder") {
    const color = getColor(obs.color, Cesium.Color.GRAY.withAlpha(1.0));
    entities.push(new Cesium.Entity({
      position,
      cylinder: {
        length: obs.length,
        topRadius: obs.topRadius,
        bottomRadius: obs.bottomRadius ?? obs.topRadius,
        material: color,
        outline: true,
        outlineColor: color.brighten(0.3, new Cesium.Color()),
      },
    }));
  }

  else if (obs.type === "ring") {
    const innerRadius = obs.innerRadius;
    const outerRadius = obs.outerRadius;
    const segments = 32;
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
      position,
      Cesium.Ellipsoid.WGS84,
      new Cesium.Matrix4()
    );
    const outerPositions: any[] = [];
    const innerPositions: any[] = [];
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
    const color = getColor(obs.color, Cesium.Color.CYAN.withAlpha(0.5));
    entities.push(new Cesium.Entity({
      position,
      polygon: {
        hierarchy,
        extrudedHeight: 1,
        height: 0,
        material: color,
        outline: true,
        outlineColor: color.brighten(0.5, new Cesium.Color()),
      },
    }));
  }

  else if (obs.type === "tree") {
    // Trunk
    let trunkMaterial = Cesium.Color.fromBytes(89, 63, 40, 230); // brown fallback

    // B1 Zone Coloring
    if (playground && playground.id === "mission-forest-supply-drop" && playground.zoneThresholds) {
      const lon = obs.position.lon;
      // Zone 1: Yellow, Zone 2: Green, Zone 3: Red (based on user request: "red green and yellow")
      // User said: "make those zones red green and yellow... tree barks colored as per hte zone"
      // Standard progression: Zone 1 -> Zone 2 -> Zone 3
      // We'll map: Zone 1 (yellow), Zone 2 (green), Zone 3 (red)
      const zone1 = playground.zoneThresholds.find(z => z.id === "zone1")?.minLon ?? -Infinity;
      const zone2 = playground.zoneThresholds.find(z => z.id === "zone2")?.minLon ?? -Infinity;
      const zone3 = playground.zoneThresholds.find(z => z.id === "zone3")?.minLon ?? -Infinity;

      if (lon >= zone3) {
        trunkMaterial = Cesium.Color.fromBytes(255, 50, 50, 255); // Red
      } else if (lon >= zone2) {
        trunkMaterial = Cesium.Color.fromBytes(50, 255, 50, 255); // Green
      } else if (lon >= zone1) {
        trunkMaterial = Cesium.Color.fromBytes(255, 230, 50, 255); // Yellow
      }
    }

    entities.push(new Cesium.Entity({
      position: Cesium.Cartesian3.fromDegrees(obs.position.lon, obs.position.lat, obs.position.height + obs.trunkHeight / 2),
      cylinder: {
        length: obs.trunkHeight,
        topRadius: obs.trunkRadius,
        bottomRadius: obs.trunkRadius,
        material: trunkMaterial,
      },
    }));

    // Canopy
    const canopyHeight = obs.position.height + obs.trunkHeight + obs.canopyRadius * 0.7;
    const canopyColor = obs.variant === "oak"
      ? Cesium.Color.fromBytes(45, 100, 30, 220)   // dark green
      : obs.variant === "cypress"
        ? Cesium.Color.fromBytes(30, 80, 50, 220)    // deep green
        : Cesium.Color.fromBytes(40, 110, 35, 220);  // pine green

    entities.push(new Cesium.Entity({
      position: Cesium.Cartesian3.fromDegrees(obs.position.lon, obs.position.lat, canopyHeight),
      ellipsoid: {
        radii: new Cesium.Cartesian3(obs.canopyRadius, obs.canopyRadius, obs.canopyRadius * 1.3),
        material: canopyColor,
      },
    }));
  }

  else if (obs.type === "marker") {
    const markerColor = getColor(obs.color);
    const polePosition = Cesium.Cartesian3.fromDegrees(
      obs.position.lon, obs.position.lat,
      obs.position.height + obs.poleHeight / 2
    );

    // Pole
    entities.push(new Cesium.Entity({
      position: polePosition,
      box: {
        dimensions: new Cesium.Cartesian3(obs.poleWidth, obs.poleWidth, obs.poleHeight),
        material: markerColor,
        outline: true,
        outlineColor: markerColor.brighten(0.3, new Cesium.Color()),
      },
    }));

    // Flag at top
    const flagPosition = Cesium.Cartesian3.fromDegrees(
      obs.position.lon, obs.position.lat,
      obs.position.height + obs.poleHeight + 1.5
    );
    entities.push(new Cesium.Entity({
      position: flagPosition,
      box: {
        dimensions: new Cesium.Cartesian3(4, 0.2, 2.5),
        material: markerColor,
      },
    }));

    // Ground clearing disc (optional)
    if (obs.hasClearingCircle && obs.clearingRadius) {
      entities.push(new Cesium.Entity({
        position: Cesium.Cartesian3.fromDegrees(obs.position.lon, obs.position.lat, obs.position.height + 0.05),
        ellipse: {
          semiMajorAxis: obs.clearingRadius,
          semiMinorAxis: obs.clearingRadius,
          material: markerColor.withAlpha(0.2),
          outline: true,
          outlineColor: markerColor,
        },
      }));
    }
  }

  return entities;
}
