import * as THREE from "three";
import type { TerrainField } from "../terrain/TerrainField";
import { hash2 } from "../terrain/noise";

const MAP_PARTICLE_STEPS = 256;
const LINE_CONTOUR_STEPS = 88;
const LINE_CONTOUR_COUNT = 22;
const PARTICLE_CONTOUR_STEPS = 132;
const PARTICLE_CONTOUR_COUNT = 72;
const TERRAIN_HEIGHT_LIFT = 0.65;
const DOT_JITTER = 0.58;
const CONTOUR_PARTICLE_SPACING = 1.2;
const ANOMALY_PARTICLE_COUNT = 720;
const PASSIVE_SCAN_RANGE = 156;
const PARTICLE_FOG_RANGE = 320;
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

function offsetLinePositions(positions: number[], xOffset: number): number[] {
  const offset = [...positions];
  for (let i = 0; i < offset.length; i += 3) {
    offset[i] += xOffset;
  }
  return offset;
}

const particleVertexShader = `
  attribute float aPhase;
  attribute float aSize;
  attribute float aSonarGain;
  attribute float aSignalQuality;

  uniform float uBaseOpacity;
  uniform float uFogRange;
  uniform float uPassiveRange;
  uniform float uSonarRadius;
  uniform float uSonarReveal;
  uniform float uTime;
  uniform float uWaveStrength;
  uniform vec3 uSonarOrigin;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vSignal;
  varying float vWave;

  void main() {
    vec3 displaced = position;
    vec2 delta = position.xz - uSonarOrigin.xz;
    float distanceFromPulse = length(delta);
    float waveBand = exp(-pow((distanceFromPulse - uSonarRadius) / 9.5, 2.0)) * uSonarReveal * aSonarGain;
    float wake = exp(-pow((distanceFromPulse - max(0.0, uSonarRadius - 38.0)) / 64.0, 2.0)) * uSonarReveal * 0.44;
    float shimmer = 0.5 + 0.5 * sin(distanceFromPulse * 0.16 - uTime * 9.0 + aPhase * 6.28318);
    float nearSignal = 1.0 - smoothstep(uPassiveRange * 0.48, uPassiveRange, distanceFromPulse);
    float fogSignal = 1.0 - smoothstep(uPassiveRange * 0.75, uFogRange, distanceFromPulse);
    float pingSignal = clamp(waveBand * 1.2 + wake * 1.55, 0.0, 1.0);
    float sensorSignal = clamp(max(nearSignal, pingSignal) * max(0.16, fogSignal), 0.0, 1.0);
    float dropout = smoothstep(0.08, 0.78, aSignalQuality + sensorSignal * 0.32 + shimmer * 0.18);
    vec2 direction = distanceFromPulse > 0.001 ? normalize(delta) : vec2(0.0, 1.0);

    displaced.y += waveBand * (3.2 + shimmer * 2.6);
    displaced.xz += direction * waveBand * 0.75;

    vec4 modelViewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = clamp(aSize * (1.0 + waveBand * 1.1) * (420.0 / max(80.0, -modelViewPosition.z)), 1.0, 7.2);

    vColor = color;
    vSignal = sensorSignal;
    vWave = waveBand;
    vAlpha = clamp((uBaseOpacity * sensorSignal + waveBand * uWaveStrength + wake * 0.32 + shimmer * 0.035) * dropout, 0.0, 1.0);
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSignal;
  varying float vWave;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float split = 0.105 + vWave * 0.05;
    float red = smoothstep(0.44, 0.13, length(centered + vec2(split, 0.0)));
    float green = smoothstep(0.44, 0.13, length(centered));
    float blue = smoothstep(0.44, 0.13, length(centered - vec2(split, 0.0)));
    float core = max(max(red, green), blue);
    float halo = smoothstep(0.5, 0.0, length(centered)) * (0.1 + vSignal * 0.12 + vWave * 0.34);
    vec3 scanColor = vec3(red * (0.34 + vColor.r), green * vColor.g, blue * vColor.b);
    vec3 hotColor = mix(scanColor, vec3(0.28, 1.0, 0.9), clamp(vWave * 0.45, 0.0, 1.0));
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
      uFogRange: { value: PARTICLE_FOG_RANGE },
      uPassiveRange: { value: PASSIVE_SCAN_RANGE },
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
  signalQualities: number[];
  sizes: number[];
  sonarGains: number[];
};

function pushParticle(
  attributes: ParticleAttributes,
  position: [number, number, number],
  color: [number, number, number],
  phase: number,
  signalQuality: number,
  size: number,
  sonarGain: number
): void {
  attributes.positions.push(position[0], position[1], position[2]);
  attributes.colors.push(color[0], color[1], color[2]);
  attributes.phases.push(phase);
  attributes.signalQualities.push(signalQuality);
  attributes.sizes.push(size);
  attributes.sonarGains.push(sonarGain);
}

function createParticleGeometry(attributes: ParticleAttributes): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(attributes.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(attributes.colors, 3));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(attributes.phases, 1));
  geometry.setAttribute("aSignalQuality", new THREE.Float32BufferAttribute(attributes.signalQualities, 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(attributes.sizes, 1));
  geometry.setAttribute("aSonarGain", new THREE.Float32BufferAttribute(attributes.sonarGains, 1));
  return geometry;
}

function buildMapParticleAttributes(terrain: TerrainField): ParticleAttributes {
  const attributes: ParticleAttributes = {
    colors: [],
    phases: [],
    positions: [],
    signalQualities: [],
    sizes: [],
    sonarGains: []
  };

  for (let iz = 0; iz <= MAP_PARTICLE_STEPS; iz += 1) {
    for (let ix = 0; ix <= MAP_PARTICLE_STEPS; ix += 1) {
      const [x, y, z] = terrainPosition(terrain, ix, iz);
      const colorPhase = hash2(terrain.seed + 37, ix, iz);
      const depthGlow = Math.max(0, Math.min(1, (-y + terrain.amplitude * 0.32) / Math.max(1, terrain.amplitude)));
      const signalNoise = hash2(terrain.seed + 101, ix, iz);
      const confidenceNoise = hash2(terrain.seed + 641, ix * 3, iz * 5);
      const ridgeBreak = Math.abs(hash2(terrain.seed + 857, Math.floor(x * 0.17), Math.floor(z * 0.17)) - 0.5) * 0.42;

      pushParticle(
        attributes,
        [x, y, z],
        [
          0.03 + colorPhase * 0.08 + depthGlow * 0.05,
          0.56 + colorPhase * 0.24 + depthGlow * 0.22,
          0.66 + colorPhase * 0.22 + depthGlow * 0.26
        ],
        signalNoise,
        Math.max(0.04, Math.min(1, confidenceNoise * 0.82 + depthGlow * 0.24 - ridgeBreak)),
        2.05 + signalNoise * 1.55,
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
    signalQualities: [],
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
      const confidence = hash2(terrain.seed + 887, phaseSeed, sample);

      pushParticle(
        attributes,
        [x, y, z],
        [0.02 + colorPhase * 0.08, 0.66 + colorPhase * 0.24, 0.8 + colorPhase * 0.16],
        colorPhase,
        0.28 + confidence * 0.72,
        1.55 + colorPhase * 1.15,
        1.1
      );
    }
  }

  return attributes;
}

function buildAnomalyParticleAttributes(terrain: TerrainField): ParticleAttributes {
  const attributes: ParticleAttributes = {
    colors: [],
    phases: [],
    positions: [],
    signalQualities: [],
    sizes: [],
    sonarGains: []
  };
  const halfSize = terrain.size / 2;

  for (let i = 0; i < ANOMALY_PARTICLE_COUNT; i += 1) {
    const x = (hash2(terrain.seed + 1201, i, 0) - 0.5) * terrain.size * 1.05;
    const z = (hash2(terrain.seed + 1207, i, 1) - 0.5) * terrain.size * 1.05;
    const ground = terrain.heightAt(
      Math.max(-halfSize, Math.min(halfSize, x)),
      Math.max(-halfSize, Math.min(halfSize, z))
    );
    const y = ground + 5 + hash2(terrain.seed + 1213, i, 2) * 46;
    const phase = hash2(terrain.seed + 1223, i, 3);
    const warm = hash2(terrain.seed + 1229, i, 4);

    pushParticle(
      attributes,
      [x, y, z],
      [0.08 + warm * 0.22, 0.74 + warm * 0.18, 0.68 + warm * 0.28],
      phase,
      0.45 + phase * 0.55,
      1.7 + phase * 1.6,
      0.35 + phase * 0.35
    );
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
    createParticleMaterial(0.46, 0.48)
  );
  contourParticles.name = "terrain-contour-particles";

  const mapParticles = new THREE.Points(
    createParticleGeometry(buildMapParticleAttributes(terrain)),
    createParticleMaterial(0.92, 0.42)
  );
  mapParticles.name = "terrain-map-particles";
  const anomalyParticles = new THREE.Points(
    createParticleGeometry(buildAnomalyParticleAttributes(terrain)),
    createParticleMaterial(0.48, 0.36)
  );
  anomalyParticles.name = "terrain-scan-anomalies";

  const linePositions = buildContourLinePositions(terrain, {
    contourCount: LINE_CONTOUR_COUNT,
    lift: TERRAIN_HEIGHT_LIFT,
    steps: LINE_CONTOUR_STEPS
  });
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  const redLineGeometry = new THREE.BufferGeometry();
  redLineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(offsetLinePositions(linePositions, -0.18), 3));
  const blueLineGeometry = new THREE.BufferGeometry();
  blueLineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(offsetLinePositions(linePositions, 0.18), 3));

  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x1cf6ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  lines.name = "terrain-topographic-lines";
  const redLines = new THREE.LineSegments(
    redLineGeometry,
    new THREE.LineBasicMaterial({
      color: 0xff1b2d,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  redLines.name = "terrain-topographic-lines-red";
  const blueLines = new THREE.LineSegments(
    blueLineGeometry,
    new THREE.LineBasicMaterial({
      color: 0x2458ff,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  blueLines.name = "terrain-topographic-lines-blue";

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

  group.add(redLines, blueLines, lines, contourParticles, mapParticles, anomalyParticles, sonarRing);
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
  const anomalyParticles = group.getObjectByName("terrain-scan-anomalies") as THREE.Points | undefined;
  const lines = group.getObjectByName("terrain-topographic-lines") as THREE.LineSegments | undefined;
  const sonarRing = group.getObjectByName("terrain-sonar-ground-ring") as THREE.Line | undefined;
  const shimmer = 0.5 + Math.sin(update.time * 2.4) * 0.5;
  const reveal = Math.max(0, Math.min(1, update.sonarReveal));

  for (const points of [contourParticles, mapParticles, anomalyParticles]) {
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
  if (anomalyParticles) {
    anomalyParticles.rotation.y = Math.sin(update.time * 0.17) * 0.025;
    anomalyParticles.rotation.x = Math.cos(update.time * 0.13) * 0.012;
  }

  if (lines && lines.material instanceof THREE.LineBasicMaterial) {
    lines.visible = true;
  }

  if (sonarRing && sonarRing.material instanceof THREE.LineBasicMaterial) {
    const radius = Math.max(1, update.sonarRadius);
    sonarRing.visible = reveal > 0.01;
    sonarRing.position.set(update.playerPosition.x, update.playerPosition.y, update.playerPosition.z);
    sonarRing.scale.set(radius, 1, radius);
    sonarRing.material.opacity = reveal * 0.78;
  }
}
