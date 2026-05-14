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
    let ridgeCrossing: { leftX: number; rightX: number; z: number } | null = null;

    for (let z = -96; z <= 96 && !ridgeCrossing; z += 16) {
      for (let leftX = -116; leftX <= 52; leftX += 8) {
        const midX = leftX + 32;
        const rightX = leftX + 64;
        const leftHeight = terrain.heightAt(leftX, z);
        const midHeight = terrain.heightAt(midX, z);
        const rightHeight = terrain.heightAt(rightX, z);

        if (midHeight > leftHeight + 8 && midHeight > rightHeight + 8) {
          ridgeCrossing = { leftX, rightX, z };
          break;
        }
      }
    }

    expect(ridgeCrossing).not.toBeNull();

    const a = {
      x: ridgeCrossing!.leftX,
      y: terrain.heightAt(ridgeCrossing!.leftX, ridgeCrossing!.z) + 1.1,
      z: ridgeCrossing!.z
    };
    const b = {
      x: ridgeCrossing!.rightX,
      y: terrain.heightAt(ridgeCrossing!.rightX, ridgeCrossing!.z) + 1.1,
      z: ridgeCrossing!.z
    };

    expect(terrain.hasTerrainOcclusion(a, b)).toBe(true);
  });

  it("gives stronger cover below local ridges than at exposed high altitude", () => {
    const terrain = new TerrainField({ seed: 20260514, size: 256, scale: 42, amplitude: 20 });
    const tuckedY = terrain.heightAt(-70, 0) + 2;
    const exposedY = terrain.localRidgeHeight(-70, 0, 36) + 16;

    expect(terrain.coverAt(-70, 0, tuckedY)).toBeGreaterThan(terrain.coverAt(-70, 0, exposedY));
  });

  it("creates a dramatic default topology with deep valleys and high ridges", () => {
    const terrain = new TerrainField({ seed: 20260514 });
    let minHeight = Infinity;
    let maxHeight = -Infinity;

    for (let z = -220; z <= 220; z += 20) {
      for (let x = -220; x <= 220; x += 20) {
        const height = terrain.heightAt(x, z);
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
      }
    }

    expect(maxHeight - minHeight).toBeGreaterThan(58);
    expect(minHeight).toBeLessThan(-10);
    expect(maxHeight).toBeGreaterThan(35);
    expect(terrain.size).toBeGreaterThanOrEqual(768);
  });
});
