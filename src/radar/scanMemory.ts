export type ScanMemory = {
  readonly baseline: number;
  readonly decayPerSecond: number;
  dirty: boolean;
  readonly resolution: number;
  readonly size: number;
  readonly values: Uint8Array<ArrayBuffer>;
};

export type ScanMemoryOptions = {
  baseline?: number;
  decayPerSecond?: number;
  resolution?: number;
  size: number;
};

type Point2 = {
  x: number;
  z: number;
};

type RevealArea = {
  origin: Point2;
  radius: number;
  strength: number;
};

type RevealWave = {
  origin: Point2;
  radius: number;
  reveal: number;
  width: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toByte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function fromByte(value: number): number {
  return value / 255;
}

function worldToGrid(memory: ScanMemory, x: number, z: number): { gx: number; gz: number } {
  const halfSize = memory.size / 2;
  const gx = clamp01((x + halfSize) / memory.size) * (memory.resolution - 1);
  const gz = clamp01((z + halfSize) / memory.size) * (memory.resolution - 1);
  return { gx, gz };
}

function gridToWorld(memory: ScanMemory, gx: number, gz: number): Point2 {
  const halfSize = memory.size / 2;
  return {
    x: (gx / (memory.resolution - 1)) * memory.size - halfSize,
    z: (gz / (memory.resolution - 1)) * memory.size - halfSize,
  };
}

function writeMax(memory: ScanMemory, index: number, value: number): void {
  const next = toByte(value);
  if (next > memory.values[index]) {
    memory.values[index] = next;
    memory.dirty = true;
  }
}

export function createScanMemory(options: ScanMemoryOptions): ScanMemory {
  const resolution = options.resolution ?? 128;
  const baseline = clamp01(options.baseline ?? 0.055);
  const values = new Uint8Array(new ArrayBuffer(resolution * resolution));
  values.fill(toByte(baseline));

  return {
    baseline,
    decayPerSecond: options.decayPerSecond ?? 0.045,
    dirty: true,
    resolution,
    size: options.size,
    values,
  };
}

export function decayScanMemory(memory: ScanMemory, deltaSeconds: number): void {
  const decay = Math.max(0, deltaSeconds) * memory.decayPerSecond;
  if (decay <= 0) {
    return;
  }

  let changed = false;
  for (let i = 0; i < memory.values.length; i += 1) {
    const current = fromByte(memory.values[i]);
    const next = Math.max(memory.baseline, current - decay);
    const byte = toByte(next);
    if (byte !== memory.values[i]) {
      memory.values[i] = byte;
      changed = true;
    }
  }

  memory.dirty = memory.dirty || changed;
}

export function revealScanMemoryArea(memory: ScanMemory, reveal: RevealArea): void {
  const radius = Math.max(0.001, reveal.radius);
  const strength = clamp01(reveal.strength);

  for (let gz = 0; gz < memory.resolution; gz += 1) {
    for (let gx = 0; gx < memory.resolution; gx += 1) {
      const point = gridToWorld(memory, gx, gz);
      const distance = Math.hypot(point.x - reveal.origin.x, point.z - reveal.origin.z);
      const falloff = 1 - smoothstep(distance / radius);
      if (falloff > 0) {
        writeMax(memory, gz * memory.resolution + gx, memory.baseline + falloff * strength * (1 - memory.baseline));
      }
    }
  }
}

export function revealScanMemoryWave(memory: ScanMemory, reveal: RevealWave): void {
  const width = Math.max(0.001, reveal.width);
  const strength = clamp01(reveal.reveal);

  for (let gz = 0; gz < memory.resolution; gz += 1) {
    for (let gx = 0; gx < memory.resolution; gx += 1) {
      const point = gridToWorld(memory, gx, gz);
      const distance = Math.hypot(point.x - reveal.origin.x, point.z - reveal.origin.z);
      const wave = Math.exp(-Math.pow((distance - reveal.radius) / width, 2));
      if (wave > 0.01) {
        writeMax(memory, gz * memory.resolution + gx, memory.baseline + wave * strength * (1 - memory.baseline));
      }
    }
  }
}

export function sampleScanMemory(memory: ScanMemory, x: number, z: number): number {
  const { gx, gz } = worldToGrid(memory, x, z);
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(memory.resolution - 1, x0 + 1);
  const z1 = Math.min(memory.resolution - 1, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const row0 = z0 * memory.resolution;
  const row1 = z1 * memory.resolution;
  const a = fromByte(memory.values[row0 + x0]);
  const b = fromByte(memory.values[row0 + x1]);
  const c = fromByte(memory.values[row1 + x0]);
  const d = fromByte(memory.values[row1 + x1]);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;

  return top + (bottom - top) * tz;
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}
