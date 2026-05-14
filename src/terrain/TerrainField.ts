import { WORLD } from "../game/constants";
import { fbm } from "./noise";

interface TerrainFieldOptions {
  seed?: number;
  size?: number;
  scale?: number;
  amplitude?: number;
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class TerrainField {
  readonly seed: number;
  readonly size: number;
  readonly scale: number;
  readonly amplitude: number;

  constructor(options: TerrainFieldOptions = {}) {
    this.seed = options.seed ?? 20260514;
    this.size = options.size ?? WORLD.terrainSize;
    this.scale = options.scale ?? WORLD.terrainScale;
    this.amplitude = options.amplitude ?? WORLD.terrainAmplitude;
  }

  heightAt(x: number, z: number): number {
    const nx = x / this.scale;
    const nz = z / this.scale;
    const halfSize = this.size / 2;
    const edgeX = Math.abs(x) / halfSize;
    const edgeZ = Math.abs(z) / halfSize;

    const meanderX = Math.sin(nz * 0.72 + fbm(nx * 0.18, nz * 0.18, this.seed + 301, 3) * 1.4) * this.scale * 1.25;
    const trenchCenter = x - meanderX;
    const centralTrench = -1.2 * Math.exp(-Math.pow(trenchCenter / (this.scale * 0.48), 2));
    const shoulderRidges = 0.82 * Math.exp(-Math.pow((Math.abs(trenchCenter) - this.scale * 1.58) / (this.scale * 0.36), 2));
    const farRidges = 0.34 * Math.exp(-Math.pow((Math.abs(x) - this.scale * 3.55) / (this.scale * 0.92), 2));
    const basinA =
      -0.46 *
      Math.exp(
        -(
          Math.pow((x + this.scale * 1.55) / (this.scale * 2.25), 2) +
          Math.pow((z - this.scale * 1.15) / (this.scale * 1.65), 2)
        )
      );
    const basinB =
      -0.34 *
      Math.exp(
        -(
          Math.pow((x - this.scale * 1.05) / (this.scale * 1.85), 2) +
          Math.pow((z + this.scale * 2.0) / (this.scale * 2.3), 2)
        )
      );
    const edgeLift = Math.pow(Math.max(edgeX, edgeZ), 2) * 0.26;
    const broadNoise = fbm(nx * 0.55, nz * 0.55, this.seed, 4) * 0.24;
    const fractureNoise = fbm(nx * 0.9 + 4.8, nz * 0.9 - 2.1, this.seed + 409, 4);
    const canyonCuts = -0.34 * Math.exp(-Math.pow(fractureNoise / 0.13, 2));
    const cliffNoise = Math.abs(fbm(nx * 1.65 - 7.3, nz * 1.35 + 2.6, this.seed + 733, 4));
    const cliffBands = Math.pow(cliffNoise, 2.35) * 0.27;
    const brokenRidges = Math.abs(fbm(nx * 1.1 + 9.7, nz * 1.1 - 3.4, this.seed + 17, 3)) * 0.25;
    const crackNoiseA = fbm(nx * 3.0 + 1.8, nz * 2.55 - 6.2, this.seed + 1009, 4);
    const crackNoiseB = fbm(nx * 4.4 - 3.7, nz * 3.8 + 5.1, this.seed + 1409, 3);
    const hairlineCracks =
      -0.11 * Math.exp(-Math.pow(crackNoiseA / 0.045, 2)) -
      0.07 * Math.exp(-Math.pow(crackNoiseB / 0.055, 2));
    const stoneFacets = Math.pow(Math.abs(fbm(nx * 5.0 + 8.1, nz * 4.7 - 2.4, this.seed + 1601, 3)), 2.65) * 0.1;
    const talusRubble = Math.abs(fbm(nx * 7.4 - 1.3, nz * 6.8 + 4.6, this.seed + 1907, 2)) * 0.045;

    return (
      centralTrench +
      shoulderRidges +
      farRidges +
      basinA +
      basinB +
      canyonCuts +
      cliffBands +
      edgeLift +
      broadNoise +
      brokenRidges +
      hairlineCracks +
      stoneFacets +
      talusRubble
    ) * this.amplitude;
  }

  coverAt(x: number, z: number, y: number): number {
    const ground = this.heightAt(x, z);
    const ridge = this.localRidgeHeight(x, z, this.scale * 0.85);
    const ridgeShadow = clamp01((ridge - y) / Math.max(1, this.amplitude * 0.65));
    const groundHugging = clamp01((WORLD.skimClearance - Math.max(0, y - ground)) / WORLD.skimClearance);
    const altitudePenalty = clamp01((y - ridge) / Math.max(1, this.amplitude));

    return clamp01(ridgeShadow * 0.78 + groundHugging * 0.22 - altitudePenalty * 0.35);
  }

  localRidgeHeight(x: number, z: number, radius: number): number {
    const samples = Math.max(4, Math.ceil(radius / Math.max(4, this.scale / 4)));
    let ridge = this.heightAt(x, z);

    for (let ix = -samples; ix <= samples; ix += 1) {
      for (let iz = -samples; iz <= samples; iz += 1) {
        const ox = (ix / samples) * radius;
        const oz = (iz / samples) * radius;
        if (ox * ox + oz * oz <= radius * radius) {
          ridge = Math.max(ridge, this.heightAt(x + ox, z + oz));
        }
      }
    }

    return ridge;
  }

  hasTerrainOcclusion(a: Point3, b: Point3): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const distance = Math.hypot(dx, dy, dz);
    const steps = Math.max(8, Math.ceil(distance / Math.max(2, this.scale / 6)));

    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      const z = a.z + dz * t;

      if (this.heightAt(x, z) > y) {
        return true;
      }
    }

    return false;
  }
}
