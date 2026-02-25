import type { Playground, Obstacle } from "./types";

export type PlaygroundLoadResult = {
  terrainProvider: Cesium.TerrainProvider;
  obstacleEntities: Cesium.Entity[];
  skipWorldDetailLayers: boolean;
};

export function loadPlayground(
  playground: Playground,
  viewer: Cesium.Viewer,
  excludeFromPicking?: Cesium.Entity[]
): PlaygroundLoadResult {
  const obstacleEntities: Cesium.Entity[] = [];

  for (const obs of playground.obstacles) {
    const entity = createObstacleEntity(obs);
    if (entity) {
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
  viewer: Cesium.Viewer,
  obstacleEntities: Cesium.Entity[]
): void {
  for (const entity of obstacleEntities) {
    viewer.entities.remove(entity);
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
