import { describe, expect, it } from "vitest";
import { createSonarPulse, triggerSonarPulse, updateSonarPulse } from "../src/radar/sonarPulse";

describe("sonar pulse", () => {
  it("jumps to full reveal when triggered", () => {
    const sonar = createSonarPulse();
    triggerSonarPulse(sonar);

    expect(sonar.reveal).toBe(1);
    expect(sonar.radius).toBe(0);
  });

  it("expands while fading back into uncertainty", () => {
    const sonar = createSonarPulse();
    triggerSonarPulse(sonar);
    updateSonarPulse(sonar, 0.9);

    expect(sonar.radius).toBeGreaterThan(40);
    expect(sonar.reveal).toBeGreaterThan(0);
    expect(sonar.reveal).toBeLessThan(1);

    updateSonarPulse(sonar, 4);
    expect(sonar.reveal).toBe(0);
  });
});
