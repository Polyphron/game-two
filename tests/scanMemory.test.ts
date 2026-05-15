import { describe, expect, it } from "vitest";
import {
  createScanMemory,
  decayScanMemory,
  revealScanMemoryArea,
  revealScanMemoryWave,
  sampleScanMemory,
} from "../src/radar/scanMemory";

describe("scan memory", () => {
  it("starts as a low-confidence map instead of full blindness", () => {
    const memory = createScanMemory({ size: 100, resolution: 16, baseline: 0.06 });

    expect(sampleScanMemory(memory, 0, 0)).toBeCloseTo(0.06, 2);
    expect(sampleScanMemory(memory, 48, -48)).toBeCloseTo(0.06, 2);
  });

  it("writes high confidence only where the sonar wave has swept", () => {
    const memory = createScanMemory({ size: 100, resolution: 32, baseline: 0.04 });

    revealScanMemoryWave(memory, {
      origin: { x: 0, z: 0 },
      radius: 30,
      reveal: 1,
      width: 8,
    });

    expect(sampleScanMemory(memory, 30, 0)).toBeGreaterThan(0.75);
    expect(sampleScanMemory(memory, 0, 0)).toBeLessThan(0.18);
  });

  it("decays scan confidence back toward the baseline", () => {
    const memory = createScanMemory({
      size: 100,
      resolution: 32,
      baseline: 0.05,
      decayPerSecond: 0.25,
    });

    revealScanMemoryArea(memory, {
      origin: { x: 0, z: 0 },
      radius: 20,
      strength: 0.9,
    });
    const revealed = sampleScanMemory(memory, 0, 0);
    decayScanMemory(memory, 2);

    expect(revealed).toBeGreaterThan(0.85);
    expect(sampleScanMemory(memory, 0, 0)).toBeLessThan(revealed);
    expect(sampleScanMemory(memory, 0, 0)).toBeGreaterThanOrEqual(0.05);
  });
});
