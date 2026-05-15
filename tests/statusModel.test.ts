import { describe, expect, it } from "vitest";
import { buildStatusModel } from "../src/hud/statusModel";

describe("buildStatusModel", () => {
  it("formats quiet empty-sector status compactly", () => {
    const status = buildStatusModel({
      threat: "idle",
      contactCount: 0,
      strongestContact: 0,
      missile: 1,
      heat: 0,
      sectorCleared: 0,
    });

    expect(status).toEqual({
      threatLabel: "QUIET",
      contactText: "0 | 0%",
      missileText: "MSL 100%",
      heatText: "HEAT 0%",
      sectorText: "SECTOR 0%",
    });
  });

  it("rounds and clamps gameplay percentages for HUD display", () => {
    const status = buildStatusModel({
      threat: "attacking",
      contactCount: 12.8,
      strongestContact: 1.25,
      missile: -0.2,
      heat: 0.473,
      sectorCleared: 0.666,
    });

    expect(status.threatLabel).toBe("ATTACKING");
    expect(status.contactText).toBe("12 | 100%");
    expect(status.missileText).toBe("MSL 0%");
    expect(status.heatText).toBe("HEAT 47%");
    expect(status.sectorText).toBe("SECTOR 67%");
  });

  it("derives readable threat labels from contact pressure when no explicit threat is provided", () => {
    expect(buildStatusModel({ contactCount: 0, strongestContact: 0 }).threatLabel).toBe("QUIET");
    expect(buildStatusModel({ contactCount: 1, strongestContact: 0.35 }).threatLabel).toBe("CONTACT");
    expect(buildStatusModel({ contactCount: 3, strongestContact: 0.82 }).threatLabel).toBe("THREAT");
  });
});
