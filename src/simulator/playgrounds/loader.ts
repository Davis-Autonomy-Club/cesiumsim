import {
  assertSupportedTerrainType,
  type Obstacle,
  type Playground,
  type TerrainType,
} from "./types";

export type PlaygroundLoadResult = {
  terrainProvider: any;
  obstacleEntities: any[];
  skipWorldDetailLayers: boolean;
};

export function loadPlayground(
  playground: Playground,
  viewer: any,
): PlaygroundLoadResult {
  assertSupportedTerrainType(playground.terrain);

  const obstacleEntities: any[] = [];

  for (const obstacle of playground.obstacles) {
    const entity = createObstacleEntity(obstacle);
    if (!entity) {
      continue;
    }

    viewer.entities.add(entity);
    obstacleEntities.push(entity);
  }

  return {
    terrainProvider: createTerrainProvider(playground.terrain),
    obstacleEntities,
    skipWorldDetailLayers: true,
  };
}

export function unloadPlayground(
  viewer: any,
  obstacleEntities: any[],
): void {
  for (const entity of obstacleEntities) {
    viewer.entities.remove(entity);
  }
}

function createTerrainProvider(terrain: TerrainType): any {
  switch (terrain) {
    case "flat":
    case "ellipsoid":
      // Both supported playground terrain modes intentionally use Cesium's
      // no-relief ellipsoid provider today. Unsupported terrain must throw.
      return new Cesium.EllipsoidTerrainProvider();
  }
}

function createObstacleEntity(obstacle: Obstacle): any | null {
  const position = Cesium.Cartesian3.fromDegrees(
    obstacle.position.lon,
    obstacle.position.lat,
    obstacle.position.height,
  );

  if (obstacle.type === "box") {
    const heading = obstacle.heading ?? 0;
    return new Cesium.Entity({
      position,
      box: {
        dimensions: new Cesium.Cartesian3(
          obstacle.dimensions.length,
          obstacle.dimensions.width,
          obstacle.dimensions.height,
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
          0,
        ),
        Cesium.Ellipsoid.WGS84,
        Cesium.Transforms.eastNorthUpToFixedFrame,
      ),
    });
  }

  if (obstacle.type === "cylinder") {
    return new Cesium.Entity({
      position,
      cylinder: {
        length: obstacle.length,
        topRadius: obstacle.topRadius,
        bottomRadius: obstacle.bottomRadius ?? obstacle.topRadius,
        material: Cesium.Color.GRAY.withAlpha(0.8),
        outline: true,
        outlineColor: Cesium.Color.DARKGRAY,
      },
    });
  }

  if (obstacle.type === "ring") {
    const segments = 32;
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
      position,
      Cesium.Ellipsoid.WGS84,
      new Cesium.Matrix4(),
    );
    const outerPositions: any[] = [];
    const innerPositions: any[] = [];
    const headingRad = Cesium.Math.toRadians(obstacle.heading ?? 0);
    const cosHeading = Math.cos(headingRad);
    const sinHeading = Math.sin(headingRad);

    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * 2 * Math.PI;
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      const outerX =
        (cosAngle * cosHeading - sinAngle * sinHeading) * obstacle.outerRadius;
      const outerY =
        (cosAngle * sinHeading + sinAngle * cosHeading) * obstacle.outerRadius;
      const innerX =
        (cosAngle * cosHeading - sinAngle * sinHeading) * obstacle.innerRadius;
      const innerY =
        (cosAngle * sinHeading + sinAngle * cosHeading) * obstacle.innerRadius;
      const outer = new Cesium.Cartesian3(outerX, outerY, 0);
      const inner = new Cesium.Cartesian3(innerX, innerY, 0);

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
