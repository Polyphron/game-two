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

    const centerRidge = Math.exp(-Math.pow(x / (this.scale * 1.25), 2)) * 0.9;
    const sideChannels = -0.5 * Math.exp(-Math.pow((Math.abs(x) - this.scale * 2) / (this.scale * 0.8), 2));
    const valleyRun = -0.22 * Math.exp(-Math.pow(z / (this.scale * 3.2), 2));
    const edgeLift = Math.pow(Math.max(edgeX, edgeZ), 2) * 0.26;
    const broadNoise = fbm(nx * 0.55, nz * 0.55, this.seed, 4) * 0.26;
    const brokenRidges = Math.abs(fbm(nx * 1.1 + 9.7, nz * 1.1 - 3.4, this.seed + 17, 3)) * 0.18;

    return (centerRidge + sideChannels + valleyRun + edgeLift + broadNoise + brokenRidges) * this.amplitude;
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
