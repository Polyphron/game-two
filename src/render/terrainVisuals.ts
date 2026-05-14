import * as THREE from "three";
import type { TerrainField } from "../terrain/TerrainField";
import { hash2 } from "../terrain/noise";

const MAP_PARTICLE_STEPS = 220;
const LINE_CONTOUR_STEPS = 88;
const LINE_CONTOUR_COUNT = 22;
const PARTICLE_CONTOUR_STEPS = 132;
const PARTICLE_CONTOUR_COUNT = 72;
const TERRAIN_HEIGHT_LIFT = 0.65;
const DOT_JITTER = 0.58;
const CONTOUR_PARTICLE_SPACING = 1.2;
const SONAR_RING_SEGMENTS = 180;

function terrainPosition(terrain: TerrainField, ix: number, iz: number): [number, number, number] {
  const halfSize = terrain.size / 2;
  const cellSize = terrain.size / MAP_PARTICLE_STEPS;
  const jitterX = (hash2(terrain.seed, ix, iz) - 0.5) * cellSize * DOT_JITTER;
  const jitterZ = (hash2(terrain.seed + 19, ix, iz) - 0.5) * cellSize * DOT_JITTER;
  const edgeX = ix === 0 || ix === MAP_PARTICLE_STEPS ? 0 : jitterX;
  const edgeZ = iz === 0 || iz === MAP_PARTICLE_STEPS ? 0 : jitterZ;
  const x = -halfSize + (ix / MAP_PARTICLE_STEPS) * terrain.size + edgeX;
  const z = -halfSize + (iz / MAP_PARTICLE_STEPS) * terrain.size + edgeZ;
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

const particleVertexShader = `
  attribute float aPhase;
  attribute float aSize;
  attribute float aSonarGain;

  uniform float uBaseOpacity;
  uniform float uSonarRadius;
  uniform float uSonarReveal;
  uniform float uTime;
  uniform float uWaveStrength;
  uniform vec3 uSonarOrigin;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vWave;

  void main() {
    vec3 displaced = position;
    vec2 delta = position.xz - uSonarOrigin.xz;
    float distanceFromPulse = length(delta);
    float waveBand = exp(-pow((distanceFromPulse - uSonarRadius) / 9.5, 2.0)) * uSonarReveal * aSonarGain;
    float wake = exp(-pow((distanceFromPulse - max(0.0, uSonarRadius - 22.0)) / 38.0, 2.0)) * uSonarReveal * 0.18;
    float shimmer = 0.5 + 0.5 * sin(distanceFromPulse * 0.16 - uTime * 9.0 + aPhase * 6.28318);
    vec2 direction = distanceFromPulse > 0.001 ? normalize(delta) : vec2(0.0, 1.0);

    displaced.y += waveBand * (3.2 + shimmer * 2.6);
    displaced.xz += direction * waveBand * 0.75;

    vec4 modelViewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = clamp(aSize * (1.0 + waveBand * 1.15) * (300.0 / max(80.0, -modelViewPosition.z)), 0.7, 4.0);

    vColor = color;
    vWave = waveBand;
    vAlpha = clamp(uBaseOpacity + waveBand * uWaveStrength + wake + shimmer * 0.045, 0.0, 1.0);
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vWave;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float radius = length(centered);
    float core = smoothstep(0.48, 0.12, radius);
    float halo = smoothstep(0.5, 0.0, radius) * vWave * 0.42;
    vec3 hotColor = mix(vColor, vec3(0.34, 1.0, 0.9), clamp(vWave * 0.8, 0.0, 1.0));
    float alpha = (core + halo) * vAlpha;

    if (alpha < 0.01) {
      discard;
    }

    gl_FragColor = vec4(hotColor, alpha);
  }
`;

function createParticleMaterial(baseOpacity: number, waveStrength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseOpacity: { value: baseOpacity },
      uSonarOrigin: { value: new THREE.Vector3() },
      uSonarRadius: { value: 0 },
      uSonarReveal: { value: 0 },
      uTime: { value: 0 },
      uWaveStrength: { value: waveStrength }
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });
}

type ParticleAttributes = {
  colors: number[];
  phases: number[];
  positions: number[];
  sizes: number[];
  sonarGains: number[];
};

function pushParticle(
  attributes: ParticleAttributes,
  position: [number, number, number],
  color: [number, number, number],
  phase: number,
  size: number,
  sonarGain: number
): void {
  attributes.positions.push(position[0], position[1], position[2]);
  attributes.colors.push(color[0], color[1], color[2]);
  attributes.phases.push(phase);
  attributes.sizes.push(size);
  attributes.sonarGains.push(sonarGain);
}

function createParticleGeometry(attributes: ParticleAttributes): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(attributes.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(attributes.colors, 3));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(attributes.phases, 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(attributes.sizes, 1));
  geometry.setAttribute("aSonarGain", new THREE.Float32BufferAttribute(attributes.sonarGains, 1));
  return geometry;
}

function buildMapParticleAttributes(terrain: TerrainField): ParticleAttributes {
  const attributes: ParticleAttributes = {
    colors: [],
    phases: [],
    positions: [],
    sizes: [],
    sonarGains: []
  };

  for (let iz = 0; iz <= MAP_PARTICLE_STEPS; iz += 1) {
    for (let ix = 0; ix <= MAP_PARTICLE_STEPS; ix += 1) {
      const [x, y, z] = terrainPosition(terrain, ix, iz);
      const colorPhase = hash2(terrain.seed + 37, ix, iz);
      const depthGlow = Math.max(0, Math.min(1, (-y + terrain.amplitude * 0.32) / Math.max(1, terrain.amplitude)));
      const signalNoise = hash2(terrain.seed + 101, ix, iz);

      pushParticle(
        attributes,
        [x, y, z],
        [
          0.03 + colorPhase * 0.08 + depthGlow * 0.05,
          0.56 + colorPhase * 0.24 + depthGlow * 0.22,
          0.66 + colorPhase * 0.22 + depthGlow * 0.26
        ],
        signalNoise,
        1.35 + signalNoise * 1.05,
        0.72 + depthGlow * 0.45
      );
    }
  }

  return attributes;
}

function buildContourParticleAttributes(terrain: TerrainField, linePositions: number[]): ParticleAttributes {
  const attributes: ParticleAttributes = {
    colors: [],
    phases: [],
    positions: [],
    sizes: [],
    sonarGains: []
  };

  for (let i = 0; i < linePositions.length; i += 6) {
    const ax = linePositions[i];
    const ay = linePositions[i + 1] + 0.2;
    const az = linePositions[i + 2];
    const bx = linePositions[i + 3];
    const by = linePositions[i + 4] + 0.2;
    const bz = linePositions[i + 5];
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    const samples = Math.max(2, Math.ceil(length / CONTOUR_PARTICLE_SPACING));

    for (let sample = 0; sample <= samples; sample += 1) {
      const t = sample / samples;
      const phaseSeed = Math.floor(i * 0.17 + sample * 13.7);
      const jitter = hash2(terrain.seed + 251, phaseSeed, sample) - 0.5;
      const x = ax + (bx - ax) * t + jitter * 0.34;
      const y = ay + (by - ay) * t + Math.abs(jitter) * 0.18;
      const z = az + (bz - az) * t + (hash2(terrain.seed + 503, phaseSeed, sample) - 0.5) * 0.34;
      const colorPhase = hash2(terrain.seed + 401, phaseSeed, sample);

      pushParticle(
        attributes,
        [x, y, z],
        [0.02 + colorPhase * 0.08, 0.66 + colorPhase * 0.24, 0.8 + colorPhase * 0.16],
        colorPhase,
        1.05 + colorPhase * 0.75,
        1.1
      );
    }
  }

  return attributes;
}

export function createTerrainVisuals(terrain: TerrainField): THREE.Group {
  const group = new THREE.Group();
  group.name = "terrain-two-layer-visuals";

  const contourParticleLines = buildContourLinePositions(terrain, {
    contourCount: PARTICLE_CONTOUR_COUNT,
    lift: TERRAIN_HEIGHT_LIFT,
    steps: PARTICLE_CONTOUR_STEPS
  });
  const contourParticles = new THREE.Points(
    createParticleGeometry(buildContourParticleAttributes(terrain, contourParticleLines)),
    createParticleMaterial(0.28, 0.48)
  );
  contourParticles.name = "terrain-contour-particles";

  const mapParticles = new THREE.Points(
    createParticleGeometry(buildMapParticleAttributes(terrain)),
    createParticleMaterial(0.5, 0.5)
  );
  mapParticles.name = "terrain-map-particles";

  const linePositions = buildContourLinePositions(terrain, {
    contourCount: LINE_CONTOUR_COUNT,
    lift: TERRAIN_HEIGHT_LIFT,
    steps: LINE_CONTOUR_STEPS
  });
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));

  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x1cf6ff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  lines.name = "terrain-topographic-lines";

  const sonarRingPositions: number[] = [];
  for (let i = 0; i <= SONAR_RING_SEGMENTS; i += 1) {
    const theta = (i / SONAR_RING_SEGMENTS) * Math.PI * 2;
    sonarRingPositions.push(Math.cos(theta), TERRAIN_HEIGHT_LIFT + 0.85, Math.sin(theta));
  }
  const sonarRingGeometry = new THREE.BufferGeometry();
  sonarRingGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sonarRingPositions, 3));
  const sonarRing = new THREE.Line(
    sonarRingGeometry,
    new THREE.LineBasicMaterial({
      color: 0xff9f00,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  sonarRing.name = "terrain-sonar-ground-ring";

  group.add(lines, contourParticles, mapParticles, sonarRing);
  return group;
}

export type TerrainVisualUpdate = {
  playerPosition: { x: number; y: number; z: number };
  sonarRadius: number;
  sonarReveal: number;
  time: number;
};

export function updateTerrainVisuals(group: THREE.Group, update: TerrainVisualUpdate): void {
  const contourParticles = group.getObjectByName("terrain-contour-particles") as THREE.Points | undefined;
  const mapParticles = group.getObjectByName("terrain-map-particles") as THREE.Points | undefined;
  const lines = group.getObjectByName("terrain-topographic-lines") as THREE.LineSegments | undefined;
  const sonarRing = group.getObjectByName("terrain-sonar-ground-ring") as THREE.Line | undefined;
  const shimmer = 0.5 + Math.sin(update.time * 2.4) * 0.5;
  const reveal = Math.max(0, Math.min(1, update.sonarReveal));

  for (const points of [contourParticles, mapParticles]) {
    if (points && points.material instanceof THREE.ShaderMaterial) {
      points.material.uniforms.uSonarOrigin.value.set(
        update.playerPosition.x,
        update.playerPosition.y,
        update.playerPosition.z
      );
      points.material.uniforms.uSonarRadius.value = update.sonarRadius;
      points.material.uniforms.uSonarReveal.value = reveal;
      points.material.uniforms.uTime.value = update.time;
    }
  }

  if (lines && lines.material instanceof THREE.LineBasicMaterial) {
    lines.material.opacity = 0.045 + reveal * 0.11 + shimmer * 0.01;
  }

  if (sonarRing && sonarRing.material instanceof THREE.LineBasicMaterial) {
    const radius = Math.max(1, update.sonarRadius);
    sonarRing.visible = reveal > 0.01;
    sonarRing.position.set(update.playerPosition.x, update.playerPosition.y, update.playerPosition.z);
    sonarRing.scale.set(radius, 1, radius);
    sonarRing.material.opacity = reveal * 0.78;
  }
}
