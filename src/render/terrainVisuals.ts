import * as THREE from "three";
import type { TerrainField } from "../terrain/TerrainField";
import { hash2 } from "../terrain/noise";

const TERRAIN_GRID_STEPS = 84;
const TERRAIN_HEIGHT_LIFT = 0.65;
const CONTOUR_COUNT = 28;
const DOT_JITTER = 0.32;

function terrainPosition(terrain: TerrainField, ix: number, iz: number): [number, number, number] {
  const halfSize = terrain.size / 2;
  const cellSize = terrain.size / TERRAIN_GRID_STEPS;
  const jitterX = (hash2(terrain.seed, ix, iz) - 0.5) * cellSize * DOT_JITTER;
  const jitterZ = (hash2(terrain.seed + 19, ix, iz) - 0.5) * cellSize * DOT_JITTER;
  const edgeX = ix === 0 || ix === TERRAIN_GRID_STEPS ? 0 : jitterX;
  const edgeZ = iz === 0 || iz === TERRAIN_GRID_STEPS ? 0 : jitterZ;
  const x = -halfSize + (ix / TERRAIN_GRID_STEPS) * terrain.size + edgeX;
  const z = -halfSize + (iz / TERRAIN_GRID_STEPS) * terrain.size + edgeZ;
  const y = terrain.heightAt(x, z) + TERRAIN_HEIGHT_LIFT;

  return [x, y, z];
}

export type ContourBuildOptions = {
  contourCount: number;
  lift: number;
  steps: number;
};

type SamplePoint = {
  x: number;
  z: number;
  h: number;
};

function crosses(level: number, a: SamplePoint, b: SamplePoint): boolean {
  return (a.h < level && b.h >= level) || (b.h < level && a.h >= level);
}

function interpolateContour(level: number, a: SamplePoint, b: SamplePoint): [number, number, number] | null {
  const delta = b.h - a.h;
  if (Math.abs(delta) < 0.00001) {
    return null;
  }

  const t = (level - a.h) / delta;
  return [a.x + (b.x - a.x) * t, level, a.z + (b.z - a.z) * t];
}

export function buildContourLinePositions(terrain: TerrainField, options: ContourBuildOptions): number[] {
  const halfSize = terrain.size / 2;
  const samples: SamplePoint[][] = [];
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let iz = 0; iz <= options.steps; iz += 1) {
    const row: SamplePoint[] = [];
    for (let ix = 0; ix <= options.steps; ix += 1) {
      const x = -halfSize + (ix / options.steps) * terrain.size;
      const z = -halfSize + (iz / options.steps) * terrain.size;
      const h = terrain.heightAt(x, z);
      minHeight = Math.min(minHeight, h);
      maxHeight = Math.max(maxHeight, h);
      row.push({ x, z, h });
    }
    samples.push(row);
  }

  const range = Math.max(0.0001, maxHeight - minHeight);
  const positions: number[] = [];

  for (let contour = 1; contour <= options.contourCount; contour += 1) {
    const level = minHeight + range * (contour / (options.contourCount + 1));
    const y = level + options.lift;

    for (let iz = 0; iz < options.steps; iz += 1) {
      for (let ix = 0; ix < options.steps; ix += 1) {
        const bottomLeft = samples[iz][ix];
        const bottomRight = samples[iz][ix + 1];
        const topRight = samples[iz + 1][ix + 1];
        const topLeft = samples[iz + 1][ix];
        const intersections: Array<[number, number, number]> = [];

        if (crosses(level, bottomLeft, bottomRight)) {
          const point = interpolateContour(level, bottomLeft, bottomRight);
          if (point) intersections.push(point);
        }
        if (crosses(level, bottomRight, topRight)) {
          const point = interpolateContour(level, bottomRight, topRight);
          if (point) intersections.push(point);
        }
        if (crosses(level, topRight, topLeft)) {
          const point = interpolateContour(level, topRight, topLeft);
          if (point) intersections.push(point);
        }
        if (crosses(level, topLeft, bottomLeft)) {
          const point = interpolateContour(level, topLeft, bottomLeft);
          if (point) intersections.push(point);
        }

        for (let i = 0; i + 1 < intersections.length; i += 2) {
          const a = intersections[i];
          const b = intersections[i + 1];
          positions.push(a[0], y, a[2], b[0], y, b[2]);
        }
      }
    }
  }

  return positions;
}

export function createTerrainVisuals(terrain: TerrainField): THREE.Group {
  const group = new THREE.Group();
  group.name = "terrain-two-layer-visuals";

  const pointPositions: number[] = [];
  const pointColors: number[] = [];

  for (let iz = 0; iz <= TERRAIN_GRID_STEPS; iz += 1) {
    for (let ix = 0; ix <= TERRAIN_GRID_STEPS; ix += 1) {
      const [x, y, z] = terrainPosition(terrain, ix, iz);
      const colorPhase = hash2(terrain.seed + 37, ix, iz);
      pointPositions.push(x, y, z);
      pointColors.push(0.1 + colorPhase * 0.18, 0.72 + colorPhase * 0.28, 0.78 + colorPhase * 0.2);
    }
  }

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeometry.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));

  const points = new THREE.Points(
    pointGeometry,
    new THREE.PointsMaterial({
      color: 0x67fff0,
      size: 1.35,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  points.name = "terrain-particle-dots";

  const linePositions = buildContourLinePositions(terrain, {
    contourCount: CONTOUR_COUNT,
    lift: TERRAIN_HEIGHT_LIFT,
    steps: TERRAIN_GRID_STEPS
  });
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));

  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x50ff8d,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  lines.name = "terrain-topographic-lines";

  group.add(lines, points);
  return group;
}
