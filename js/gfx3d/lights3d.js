// The 3D view's light (docs/3D-PLAN.md 5.1–5.3): the target image's golden-hour, backlit garden.
//
//   sun         high (65°) and from the far side (sim −y, the upper right of the screen), warm,
//               casting the one shadow map; its light is stepped with the shadow and the dapples
//               in every paint material, so shadow edges come out hard and notched as in the image
//   dapples     a mask of leaf-shaped light and shade fixed to the world (the canopies' shadow),
//               made here by our own code from a seed — 3 levels of grey, broken leafy edges
//   the pool    a soft ellipse of sunlight fixed round the hero: its centre is his drawn position every
//               frame, so it moves with him exactly, as a Diablo-style light radius does (the owner,
//               2026-10-01: it used to trail the fight slowly, the camera focus leaning 30% towards
//               him on a 1.75 s half-life); outside it only a little sun gets through, so the garden
//               round him stays in cool teal shade — the image's brightest spot is right under the hero
//   sky         a hemisphere light: teal from above, dark green from below, about a sixth of the sun
import { DirectionalLight, HemisphereLight, DataTexture, RGBAFormat, LinearFilter, ClampToEdgeWrapping, Vector3 } from "./three-lib.js?v=df092a6";

const SUN_DIR = new Vector3(0, 0.906, -0.423).normalize();

/**
 * The leaf dapples over ±160 units, 512², three grey levels: clusters of leaf-shaped openings where
 * sun comes through, round the tree positions `trees` ([{ x, y, r }], sim units) and scattered
 * patches elsewhere. Pure pixel work from `rand`; deterministic.
 */
function makeSunMask(rand, trees) {
  const size = 512;
  const span = 320;
  const f = new Float32Array(size * size).fill(1); // 1 = full sun
  const toPx = (w) => ((w + span / 2) / span) * size;
  // Tree shadows: a soft dark disc per canopy, pushed away from the sun (the sun is at −y, so the
  // shadow falls towards +y), with leafy openings punched through it.
  const stamp = (cx, cy, r, value, leafy) => {
    const x0 = Math.max(0, Math.floor(cx - r - 2));
    const x1 = Math.min(size - 1, Math.ceil(cx + r + 2));
    const y0 = Math.max(0, Math.floor(cy - r - 2));
    const y1 = Math.min(size - 1, Math.ceil(cy + r + 2));
    const lobes = leafy ? 5 + Math.floor(rand() * 3) : 0;
    const ph = rand() * Math.PI * 2;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const a = Math.atan2(dy, dx);
        const rr = r * (leafy ? 0.72 + 0.28 * Math.abs(Math.cos((a * lobes) / 2 + ph)) : 1);
        if (dx * dx + dy * dy <= rr * rr) f[y * size + x] = Math.min(f[y * size + x], value);
      }
  };
  // A hole of sun, or a softer half-lit patch.
  const hole = (x, y, r, v) => {
    for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(size - 1, Math.ceil(y + r)); yy++)
      for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(size - 1, Math.ceil(x + r)); xx++)
        if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) f[yy * size + xx] = Math.max(f[yy * size + xx], v);
  };
  for (const t of trees) {
    const cx = toPx(t.x);
    const cy = toPx(t.y + t.r * 0.55);
    const rpx = (t.r / span) * size;
    stamp(cx, cy, rpx, 0.12, false);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * rpx * 0.9;
      hole(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.5 + rand() * 4, rand() < 0.5 ? 1 : 0.55);
    }
  }
  // Scattered leaf shadows over the rest of the ground: small leafy stamps, fewer in the middle.
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const cxw = (x / size) * span - span / 2;
    const cyw = (y / size) * span - span / 2;
    const d = Math.hypot(cxw, cyw);
    if (d < 60 && rand() < 0.7) continue;
    stamp(x, y, 2 + rand() * 6, rand() < 0.6 ? 0.55 : 0.12, true);
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    // Three levels, as the image's dapples are painted.
    const v = f[i] > 0.8 ? 255 : f[i] > 0.4 ? 140 : 30;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function makeLights3D(scene, look, { trees = [], rand } = {}) {
  const sun = new DirectionalLight(0xffe9a0, 11); // tuned against the target (G1 look lab): lit grass ~0.55
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -160;
  sc.right = 160;
  sc.top = 160;
  sc.bottom = -160;
  sc.near = 1;
  sc.far = 500;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  // The sun never moves, so the shadow never crawls: fixed over the garden's middle.
  sun.position.copy(SUN_DIR).multiplyScalar(250);
  sun.target.position.set(0, 0, 0);
  const sky = new HemisphereLight(0x2b5a58, 0x1a2410, 2.4);
  scene.add(sun, sun.target, sky);

  look.uSunMask.value = makeSunMask(rand, trees);
  look.uSunMaskScale.value.set(1 / 320, 1 / 320, 0.5, 0.5);
  look.uPoolOn.value = 1;

  return {
    sun,
    sky,
    /**
     * Once a frame, on real time: the pool's centre on the hero's drawn (in-between) position
     * `heroX`, `heroY` — no easing, no lag; the leaf shadows drift a little (±0.5 units, slowly).
     */
    update(heroX, heroY, now) {
      look.uPool.value.x = heroX;
      look.uPool.value.y = heroY;
      look.uSunDrift.value.set(Math.sin(now * 1.3) * 0.5, Math.cos(now * 1.1) * 0.35);
    },
    dispose() {
      look.uSunMask.value.dispose?.();
    },
  };
}
