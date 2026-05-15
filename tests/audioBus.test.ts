import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioBus, type AudioCue } from "../src/audio/AudioBus";

class FakeAudioNode {
  connect() {
    return this;
  }
}

class FakeGainNode extends FakeAudioNode {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

class FakeOscillatorNode extends FakeAudioNode {
  type = "sine";
  frequency = { value: 0 };
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static created = 0;
  static closed = 0;

  currentTime = 12;
  destination = new FakeAudioNode();

  constructor() {
    FakeAudioContext.created += 1;
  }

  createOscillator() {
    return new FakeOscillatorNode();
  }

  createGain() {
    return new FakeGainNode();
  }

  close() {
    FakeAudioContext.closed += 1;
    return Promise.resolve();
  }
}

describe("AudioBus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeAudioContext.created = 0;
    FakeAudioContext.closed = 0;
  });

  it("records cues without throwing when Web Audio is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const bus = new AudioBus();

    expect(() => bus.trigger("ping")).not.toThrow();

    expect(bus.lastCue).toBe("ping");
    expect(bus.triggeredCount).toBe(1);
  });

  it("creates AudioContext lazily only after an enabled cue trigger", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const bus = new AudioBus();

    bus.setEnabled(true);
    expect(FakeAudioContext.created).toBe(0);

    bus.trigger("laser");

    expect(FakeAudioContext.created).toBe(1);
    expect(bus.lastCue).toBe("laser");
    expect(bus.triggeredCount).toBe(1);
  });

  it("does not record or create audio while disabled", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const bus = new AudioBus();

    bus.setEnabled(false);
    bus.trigger("alert");

    expect(FakeAudioContext.created).toBe(0);
    expect(bus.lastCue).toBeUndefined();
    expect(bus.triggeredCount).toBe(0);
  });

  it("closes disposable contexts", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const bus = new AudioBus();

    bus.trigger("hit");
    bus.dispose();

    expect(FakeAudioContext.closed).toBe(1);
  });

  it("accepts every overnight HUD cue", () => {
    vi.stubGlobal("AudioContext", undefined);
    const bus = new AudioBus();
    const cues: AudioCue[] = ["ping", "laser", "missile", "hit", "kill", "alert", "boost"];

    for (const cue of cues) {
      bus.trigger(cue);
    }

    expect(bus.lastCue).toBe("boost");
    expect(bus.triggeredCount).toBe(cues.length);
  });
});
