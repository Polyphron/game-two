import * as THREE from "three";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
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
    new THREE.SphereGeometry(34, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xe9ffff
    })
  );
  moon.name = "bright-celestial-body";
  moon.position.set(166, 172, -330);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(48, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x39f6ff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  halo.name = "cyan-celestial-halo";
  halo.position.copy(moon.position);

  group.add(stars, halo, moon);
  return group;
}
