import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/game/state";
import { createHeightmapData, sampleHeightmap } from "../src/terrain/heightmap";
import { TerrainField } from "../src/terrain/TerrainField";

describe("heightmap terrain", () => {
  it("samples normalized heightmap data with bilinear smoothing", () => {
    const heightmap = createHeightmapData({
      width: 2,
      height: 2,
      values: [0, 0.5, 0.5, 1],
    });

    expect(sampleHeightmap(heightmap, -1, -1, 2)).toBeCloseTo(0);
    expect(sampleHeightmap(heightmap, 1, 1, 2)).toBeCloseTo(1);
    expect(sampleHeightmap(heightmap, 0, 0, 2)).toBeCloseTo(0.5);
  });

  it("uses the heightmap as the primary topology with gentle procedural detail", () => {
    const heightmap = createHeightmapData({
      width: 3,
      height: 3,
      values: [
        0.9, 0.9, 0.9,
        0.9, 0.05, 0.9,
        0.9, 0.9, 0.9,
      ],
    });
    const terrain = new TerrainField({
      seed: 99,
      size: 120,
      scale: 42,
      amplitude: 30,
      heightmap,
      proceduralDetail: 0.08,
    });

    const canyonFloor = terrain.heightAt(0, 0);
    const highPlateau = terrain.heightAt(52, 52);
    const nearCenterA = terrain.heightAt(0, 0);
    const nearCenterB = terrain.heightAt(3, 3);

    expect(canyonFloor).toBeLessThan(-20);
    expect(highPlateau).toBeGreaterThan(20);
    expect(Math.abs(nearCenterA - nearCenterB)).toBeLessThan(5);
  });

  it("can create initial game state from a preloaded heightmap terrain", () => {
    const heightmap = createHeightmapData({
      width: 2,
      height: 2,
      values: [0.2, 0.8, 0.8, 0.2],
    });
    const terrain = new TerrainField({ seed: 7, size: 160, amplitude: 24, heightmap });
    const state = createInitialState(7, terrain);

    expect(state.terrain).toBe(terrain);
    expect(state.player.position.y).toBeGreaterThan(terrain.heightAt(state.player.position.x, state.player.position.z));
  });
});
