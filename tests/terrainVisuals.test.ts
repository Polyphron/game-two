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
    const lineMaterial = thinLines.material as THREE.LineBasicMaterial;

    expect(contourPointCount + mapPointCount).toBeGreaterThan(lineVertexCount * 3);
    expect(mapPointCount).toBeGreaterThan(80_000);
    expect(lineMaterial.opacity).toBeLessThan(0.1);
  });

  it("stores uneven signal confidence and loose scan anomalies", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);
    const mapParticles = group.getObjectByName("terrain-map-particles") as THREE.Points;
    const anomalies = group.getObjectByName("terrain-scan-anomalies") as THREE.Points;
    const signalQuality = mapParticles.geometry.getAttribute("aSignalQuality");
    const sizes = mapParticles.geometry.getAttribute("aSize");
    const confidenceValues = signalQuality.array as ArrayLike<number>;
    const sizeValues = sizes.array as ArrayLike<number>;
    let confidenceMin = Infinity;
    let confidenceMax = -Infinity;
    let sizeMin = Infinity;
    let sizeMax = -Infinity;

    for (let i = 0; i < confidenceValues.length; i += Math.max(1, Math.floor(confidenceValues.length / 1000))) {
      confidenceMin = Math.min(confidenceMin, confidenceValues[i]);
      confidenceMax = Math.max(confidenceMax, confidenceValues[i]);
      sizeMin = Math.min(sizeMin, sizeValues[i]);
      sizeMax = Math.max(sizeMax, sizeValues[i]);
    }

    expect(signalQuality.count).toBe(mapParticles.geometry.getAttribute("position").count);
    expect(confidenceMax - confidenceMin).toBeGreaterThan(0.4);
    expect(sizeMax - sizeMin).toBeGreaterThan(2);
    expect(anomalies).toBeInstanceOf(THREE.Points);
    expect(anomalies.geometry.getAttribute("position").count).toBeGreaterThan(800);
  });

  it("updates sonar uniforms on both particle layers", () => {
    const terrain = new TerrainField({ seed: 21, size: 256, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);

    updateTerrainVisuals(group, {
      playerYaw: Math.PI / 2,
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
      expect(material.uniforms.uPassiveRange.value).toBeGreaterThan(140);
      expect(material.uniforms.uFogRange.value).toBeGreaterThan(material.uniforms.uPassiveRange.value);
      expect(material.uniforms.uBeamRange.value).toBeGreaterThan(material.uniforms.uFogRange.value);
      expect(material.uniforms.uBeamWidth.value).toBeGreaterThan(0.55);
      expect(material.uniforms.uSensorForward.value.x).toBeCloseTo(1);
      expect(material.uniforms.uSensorForward.value.z).toBeCloseTo(0);
      expect(material.uniforms.uSonarOrigin.value.x).toBe(8);
      expect(material.uniforms.uSonarOrigin.value.z).toBe(-16);
    }
  });

  it("configures sonar pings as a fading wind wake through particles", () => {
    const terrain = new TerrainField({ seed: 21, size: 256, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);
    const mapParticles = group.getObjectByName("terrain-map-particles") as THREE.Points;
    const material = mapParticles.material as THREE.ShaderMaterial;

    expect(material.uniforms.uPulseWidth.value).toBeGreaterThan(5);
    expect(material.uniforms.uWakeWidth.value).toBeGreaterThan(material.uniforms.uPulseWidth.value * 3);
    expect(material.uniforms.uWindStrength.value).toBeGreaterThan(1);
    expect(material.vertexShader).toContain("windPush");
    expect(material.fragmentShader).toContain("vWake");
  });

  it("keeps thin contour line opacity stable while particles fade", () => {
    const terrain = new TerrainField({ seed: 21, size: 256, scale: 42, amplitude: 34 });
    const group = createTerrainVisuals(terrain);
    const lines = group.getObjectByName("terrain-topographic-lines") as THREE.LineSegments;
    const material = lines.material as THREE.LineBasicMaterial;
    const initialOpacity = material.opacity;

    updateTerrainVisuals(group, {
      playerPosition: { x: 0, y: 12, z: 0 },
      sonarRadius: 160,
      sonarReveal: 0.95,
      time: 8,
    });

    expect(material.opacity).toBe(initialOpacity);
  });
});
