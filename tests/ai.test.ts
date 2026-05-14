import { describe, expect, it } from "vitest";
import { createSector } from "../src/terrain/sector";
import { TerrainField } from "../src/terrain/TerrainField";

const EXPECTED_CLUSTER_COUNT = 5;
const CLUSTER_GAP = 24;

function expectSeparatedClusters(clusters: ReturnType<typeof createSector>["clusters"]): void {
  for (let i = 0; i < clusters.length; i += 1) {
    for (let j = i + 1; j < clusters.length; j += 1) {
      const dx = clusters[i].center.x - clusters[j].center.x;
      const dz = clusters[i].center.z - clusters[j].center.z;
      const distance = Math.hypot(dx, dz);

      expect(distance).toBeGreaterThan(clusters[i].radius + clusters[j].radius + CLUSTER_GAP);
    }
  }
}

describe("createSector", () => {
  it("creates a complete separated enemy sector for radar hunts", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 20 });
    const sector = createSector(terrain, 21);

    expect(sector.clusters).toHaveLength(EXPECTED_CLUSTER_COUNT);
    expectSeparatedClusters(sector.clusters);
  });
});
