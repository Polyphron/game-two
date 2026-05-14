import { describe, expect, it } from "vitest";
import { buildContourLinePositions } from "../src/render/terrainVisuals";
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
});
