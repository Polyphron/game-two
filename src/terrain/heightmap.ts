export type HeightmapData = {
  readonly width: number;
  readonly height: number;
  readonly values: Float32Array;
};

export type HeightmapInput = {
  readonly width: number;
  readonly height: number;
  readonly values: ArrayLike<number>;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smootherstep(t: number): number {
  const n = clamp01(t);
  return n * n * n * (n * (n * 6 - 15) + 10);
}

export function createHeightmapData(input: HeightmapInput): HeightmapData {
  if (input.width < 2 || input.height < 2) {
    throw new Error("Heightmap must be at least 2x2 samples.");
  }

  if (input.values.length !== input.width * input.height) {
    throw new Error("Heightmap value count must match width * height.");
  }

  const values = new Float32Array(input.values.length);
  for (let i = 0; i < input.values.length; i += 1) {
    values[i] = clamp01(input.values[i]);
  }

  return {
    width: input.width,
    height: input.height,
    values,
  };
}

export function sampleHeightmap(heightmap: HeightmapData, x: number, z: number, terrainSize: number): number {
  const halfSize = terrainSize / 2;
  const u = clamp01((x + halfSize) / terrainSize) * (heightmap.width - 1);
  const v = clamp01((z + halfSize) / terrainSize) * (heightmap.height - 1);
  const x0 = Math.floor(u);
  const z0 = Math.floor(v);
  const x1 = Math.min(heightmap.width - 1, x0 + 1);
  const z1 = Math.min(heightmap.height - 1, z0 + 1);
  const tx = smootherstep(u - x0);
  const tz = smootherstep(v - z0);
  const row0 = z0 * heightmap.width;
  const row1 = z1 * heightmap.width;
  const a = heightmap.values[row0 + x0];
  const b = heightmap.values[row0 + x1];
  const c = heightmap.values[row1 + x0];
  const d = heightmap.values[row1 + x1];

  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

export async function loadHeightmapDataFromImage(url: string): Promise<HeightmapData> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`Failed to load heightmap image: ${url}`));
    element.src = url;
  });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not create 2D canvas context for heightmap.");
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const values = new Float32Array(canvas.width * canvas.height);

  for (let pixel = 0, sample = 0; pixel < pixels.length; pixel += 4, sample += 1) {
    const luminance = pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722;
    values[sample] = luminance / 255;
  }

  return createHeightmapData({
    width: canvas.width,
    height: canvas.height,
    values,
  });
}
