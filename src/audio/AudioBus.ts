export type AudioCue = "ping" | "laser" | "missile" | "hit" | "kill" | "alert" | "boost";

type AudioContextConstructor = new () => AudioContext;

const CUE_TONES: Record<AudioCue, { frequency: number; duration: number; gain: number; type: OscillatorType }> = {
  ping: { frequency: 660, duration: 0.09, gain: 0.045, type: "sine" },
  laser: { frequency: 920, duration: 0.055, gain: 0.035, type: "sawtooth" },
  missile: { frequency: 180, duration: 0.14, gain: 0.05, type: "square" },
  hit: { frequency: 130, duration: 0.08, gain: 0.06, type: "triangle" },
  kill: { frequency: 520, duration: 0.16, gain: 0.05, type: "sine" },
  alert: { frequency: 410, duration: 0.12, gain: 0.045, type: "square" },
  boost: { frequency: 260, duration: 0.11, gain: 0.04, type: "sawtooth" },
};

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  const audioGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };

  return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
}

export class AudioBus {
  private enabled = true;
  private context?: AudioContext;
  private cueCount = 0;
  private recentCue?: AudioCue;

  get triggeredCount(): number {
    return this.cueCount;
  }

  get lastCue(): AudioCue | undefined {
    return this.recentCue;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  trigger(cue: AudioCue): void {
    if (!this.enabled) {
      return;
    }

    this.cueCount += 1;
    this.recentCue = cue;

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    this.playTone(context, cue);
  }

  dispose(): void {
    const context = this.context;
    this.context = undefined;

    if (!context || typeof context.close !== "function") {
      return;
    }

    try {
      void context.close().catch(() => undefined);
    } catch {
      // Some browser shims throw if the context is already closed.
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      return undefined;
    }

    try {
      this.context = new AudioContextCtor();
      return this.context;
    } catch {
      this.context = undefined;
      return undefined;
    }
  }

  private playTone(context: AudioContext, cue: AudioCue): void {
    try {
      const tone = CUE_TONES[cue];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime;
      const stopAt = startAt + tone.duration;

      oscillator.type = tone.type;
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(tone.gain, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, stopAt);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(stopAt);
    } catch {
      // Cues are optional feedback; gameplay must continue if audio setup fails.
    }
  }
}
