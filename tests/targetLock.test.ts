import { describe, expect, it } from "vitest";
import type { RadarContact } from "../src/radar/radarModel";
import { createTargetLockState, updateTargetLock } from "../src/radar/targetLock";

function contact(clusterId: string, confidence: number): RadarContact {
  return {
    clusterId,
    confidence,
    ageSeconds: 0,
    source: "active-ping",
    lastKnownPosition: { x: 80, y: 8, z: -120 },
    radius: 32,
    roles: ["scout"],
    alert: "investigating",
  };
}

describe("target lock model", () => {
  it("requires sustained right-click lock time before reaching locked state", () => {
    const lock = createTargetLockState();
    const contacts = [contact("cluster-a", 0.82)];

    updateTargetLock(lock, { requesting: true, contacts, deltaSeconds: 0.35 });
    expect(lock.status).toBe("locking");
    expect(lock.targetClusterId).toBe("cluster-a");
    expect(lock.quality).toBeGreaterThan(0);
    expect(lock.quality).toBeLessThan(1);

    updateTargetLock(lock, { requesting: true, contacts, deltaSeconds: 1.1 });
    expect(lock.status).toBe("locked");
    expect(lock.quality).toBe(1);
  });

  it("refuses low fidelity contacts and decays a released lock", () => {
    const lock = createTargetLockState();

    updateTargetLock(lock, { requesting: true, contacts: [contact("weak", 0.2)], deltaSeconds: 1 });
    expect(lock.status).toBe("seeking");
    expect(lock.targetClusterId).toBeUndefined();

    updateTargetLock(lock, { requesting: true, contacts: [contact("strong", 0.9)], deltaSeconds: 1.2 });
    expect(lock.status).toBe("locked");

    updateTargetLock(lock, { requesting: false, contacts: [contact("strong", 0.9)], deltaSeconds: 0.4 });
    expect(lock.status).toBe("lost");
    expect(lock.quality).toBeLessThan(1);
  });

  it("can build a lock from high-confidence last-known radar memory", () => {
    const lock = createTargetLockState();
    const ghost = {
      ...contact("memory", 0.72),
      source: "ghost" as const,
      ageSeconds: 1.4,
    };

    updateTargetLock(lock, { requesting: true, contacts: [ghost], deltaSeconds: 1.2 });

    expect(lock.status).toBe("locked");
    expect(lock.targetClusterId).toBe("memory");
  });
});
