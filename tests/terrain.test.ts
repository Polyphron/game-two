import { describe, expect, it } from "vitest";
import { WORLD } from "../src/game/constants";
import { createInitialState } from "../src/game/state";
import { TerrainField } from "../src/terrain/TerrainField";

describe("TerrainField", () => {
  it("returns deterministic heights for the same seed", () => {
    const a = new TerrainField({ seed: 20260514 });
    const b = new TerrainField({ seed: 20260514 });
    const differentSeed = new TerrainField({ seed: 20260515 });

    const samples = [
      [0, 0],
      [12.5, -48.25],
      [-100, 96],
      [255.5, -255.5]
    ] as const;

    for (const [x, z] of samples) {
      expect(a.heightAt(x, z)).toBeCloseTo(b.heightAt(x, z), 8);
    }

    const totalDifference = samples.reduce((sum, [x, z]) => {
      return sum + Math.abs(a.heightAt(x, z) - differentSeed.heightAt(x, z));
    }, 0);
    expect(totalDifference).toBeGreaterThan(0.01);
  });

  it("starts the player above terrain with safe clearance for risky seeds", () => {
    for (const seed of [0, 2, 7]) {
      const state = createInitialState(seed);
      const { x, y, z } = state.player.position;
      const clearance = y - state.terrain.heightAt(x, z);

      expect(clearance).toBeGreaterThanOrEqual(WORLD.safeClearance);
    }
  });

  it("detects terrain occlusion between two low points across a ridge", () => {
    const terrain = new TerrainField({ seed: 7, size: 256, scale: 36, amplitude: 24 });
    const a = { x: -84, y: terrain.heightAt(-84, 0) + 1.1, z: 0 };
    const b = { x: 84, y: terrain.heightAt(84, 0) + 1.1, z: 0 };

    expect(terrain.hasTerrainOcclusion(a, b)).toBe(true);
  });

  it("gives stronger cover below local ridges than at exposed high altitude", () => {
    const terrain = new TerrainField({ seed: 20260514, size: 256, scale: 42, amplitude: 20 });
    const tuckedY = terrain.heightAt(-70, 0) + 2;
    const exposedY = terrain.localRidgeHeight(-70, 0, 36) + 16;

    expect(terrain.coverAt(-70, 0, tuckedY)).toBeGreaterThan(terrain.coverAt(-70, 0, exposedY));
  });
});
