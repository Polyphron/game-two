import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildContourLinePositions,
  createTerrainVisuals,
  updateTerrainVisuals,
} from "../src/render/terrainVisuals";
import { TerrainField } from "../src/terrain/TerrainField";

describe("terrain visual line layer", () => {
  it("builds contour-like iso-height segments instead of a regular grid", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 20 });
    const positions = buildContourLinePositions(terrain, {
      contourCount: 10,
      lift: 0.65,
      steps: 36,
    });

    expect(positions.length).toBeGreaterThan(0);

    let diagonalSegments = 0;
    const contourHeights = new Set<string>();

    for (let i = 0; i < positions.length; i += 6) {
      const ax = positions[i];
      const ay = positions[i + 1];
      const az = positions[i + 2];
      const bx = positions[i + 3];
      const by = positions[i + 4];
      const bz = positions[i + 5];

      expect(ay).toBeCloseTo(by, 5);
      contourHeights.add(ay.toFixed(2));

      if (Math.abs(ax - bx) > 0.001 && Math.abs(az - bz) > 0.001) {
        diagonalSegments += 1;
      }
    }

    expect(contourHeights.size).toBeLessThanOrEqual(10);
    expect(diagonalSegments).toBeGreaterThan(positions.length / 6 / 4);
  });

  it("uses dense shader particles as the dominant terrain layer", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);
    const contourParticles = group.getObjectByName("terrain-contour-particles") as THREE.Points;
    const mapParticles = group.getObjectByName("terrain-map-particles") as THREE.Points;
    const thinLines = group.getObjectByName("terrain-topographic-lines") as THREE.LineSegments;

    expect(contourParticles).toBeInstanceOf(THREE.Points);
    expect(mapParticles).toBeInstanceOf(THREE.Points);
    expect(thinLines).toBeInstanceOf(THREE.LineSegments);
    expect(contourParticles.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(mapParticles.material).toBeInstanceOf(THREE.ShaderMaterial);

    const contourPointCount = contourParticles.geometry.getAttribute("position").count;
    const mapPointCount = mapParticles.geometry.getAttribute("position").count;
    const lineVertexCount = thinLines.geometry.getAttribute("position").count;

    expect(contourPointCount + mapPointCount).toBeGreaterThan(lineVertexCount * 3);
    expect(mapPointCount).toBeGreaterThan(25_000);
  });

  it("stores uneven signal confidence and loose scan anomalies", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);
    const mapParticles = group.getObjectByName("terrain-map-particles") as THREE.Points;
    const anomalies = group.getObjectByName("terrain-scan-anomalies") as THREE.Points;
    const signalQuality = mapParticles.geometry.getAttribute("aSignalQuality");
    const values = signalQuality.array as ArrayLike<number>;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < values.length; i += Math.max(1, Math.floor(values.length / 1000))) {
      min = Math.min(min, values[i]);
      max = Math.max(max, values[i]);
    }

    expect(signalQuality.count).toBe(mapParticles.geometry.getAttribute("position").count);
    expect(max - min).toBeGreaterThan(0.4);
    expect(anomalies).toBeInstanceOf(THREE.Points);
    expect(anomalies.geometry.getAttribute("position").count).toBeGreaterThan(300);
  });

  it("updates sonar uniforms on both particle layers", () => {
    const terrain = new TerrainField({ seed: 21, size: 256, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);

    updateTerrainVisuals(group, {
      playerPosition: { x: 8, y: 12, z: -16 },
      sonarRadius: 84,
      sonarReveal: 0.72,
      time: 3.4,
    });

    for (const name of ["terrain-contour-particles", "terrain-map-particles"]) {
      const points = group.getObjectByName(name) as THREE.Points;
      const material = points.material as THREE.ShaderMaterial;

      expect(material.uniforms.uSonarRadius.value).toBe(84);
      expect(material.uniforms.uSonarReveal.value).toBeCloseTo(0.72);
      expect(material.uniforms.uTime.value).toBeCloseTo(3.4);
      expect(material.uniforms.uPassiveRange.value).toBeGreaterThan(60);
      expect(material.uniforms.uSonarOrigin.value.x).toBe(8);
      expect(material.uniforms.uSonarOrigin.value.z).toBe(-16);
    }
  });
});
