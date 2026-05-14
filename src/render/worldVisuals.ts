import * as THREE from "three";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function createRadialGlowTexture(): THREE.DataTexture {
  const size = 128;
  const center = (size - 1) / 2;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const distance = Math.min(1, Math.hypot(dx, dy));
      const core = Math.max(0, 1 - distance);
      const alpha = Math.pow(core, 2.35) * 255;
      const index = (y * size + x) * 4;

      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = alpha;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function createGlowSprite(
  texture: THREE.Texture,
  color: THREE.ColorRepresentation,
  opacity: number,
  scale: number,
  name: string
): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })
  );

  sprite.name = name;
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

export function createWorldVisuals(seed: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "starfield-celestial-backdrop";

  const random = seededRandom(seed);
  const starPositions: number[] = [];
  const starCount = 760;

  for (let i = 0; i < starCount; i += 1) {
    const radius = 620 + random() * 640;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 1.4 - 0.52);
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.cos(phi) * radius + 120;
    const z = Math.sin(phi) * Math.sin(theta) * radius - 260;

    starPositions.push(x, y, z);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xdffcff,
      size: 1.25,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    })
  );
  stars.name = "distant-starfield-points";

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(30, 64, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false
    })
  );
  moon.name = "bright-celestial-body";
  moon.position.set(70, 132, -760);

  const glowTexture = createRadialGlowTexture();
  const innerHalo = createGlowSprite(glowTexture, 0xe9ffff, 0.7, 105, "cyan-celestial-inner-halo");
  const bloomHalo = createGlowSprite(glowTexture, 0x42efff, 0.34, 210, "cyan-celestial-bloom-halo");
  const outerGlow = createGlowSprite(glowTexture, 0x0877a4, 0.2, 360, "cyan-celestial-ambient-glow");

  innerHalo.name = "cyan-celestial-inner-halo";
  innerHalo.position.copy(moon.position);
  bloomHalo.position.copy(moon.position);
  outerGlow.position.copy(moon.position);

  group.add(stars, outerGlow, bloomHalo, innerHalo, moon);
  return group;
}
