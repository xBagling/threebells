// The fight's glints (the owner, 2026-10-09: "add particles to more effects to make it feel more responsive and cool,
// it can be subtle for some things e.g hitting the toad"): additive sparkles, a flash where a blow lands, a ring going
// out over the grass, and a few sparks circling a point (a staggered boss's dazed stars). On top of the painted
// particles (gfx/particles.js, which stay as they were: blood, dust, earth); these are light — they glow (the bloom)
// and never linger. Positions are the sim's (x, y) on the ground and a height in 3D units; time is the view's.
import { Color } from "./three-lib.js?v=df092a6";
import { billboard, sprites, sparkFrag } from "./fxsprites3d.js?v=df092a6";
import { rng } from "../util.js?v=df092a6";

const cols = (...h) => h.map((x) => new Color(x));
export const GLINT = {
  white: cols("#ffffff", "#fff6dc", "#e8f2ff"),
  gold: cols("#ffd66b", "#fff3c4", "#ffcf5a"),
  steel: cols("#eef4ff", "#cfe0ff", "#ffffff"),
  red: cols("#ff6b5a", "#ffb0a0", "#ff3d3d"),
  mint: cols("#8fffd0", "#e6fff2", "#5ff0b0"),
  green: cols("#b6f06b", "#e0ff9a", "#7ad63a"),
  dazed: cols("#fff07a", "#ffffff", "#ffd23d"),
};
const FLASHES = 10;
const RINGS = 10;

export function makeSparks3D() {
  const rand = rng(53);
  const sp = sprites(900, sparkFrag, true);
  const flashes = Array.from({ length: FLASHES }, () => ({ m: billboard(5, { size: [1, 1], anchor: [0.5, 0.5] }), t0: null, life: 0, size: 0, a: 1 }));
  const rings = Array.from({ length: RINGS }, () => ({ m: billboard(2, { size: [1, 1], flat: true }), t0: null, life: 0, r: 0, a: 1 }));
  const orbits = []; // { x, z, h, r, until, cols, n }
  let now = 0;
  let fi = 0;
  let ri = 0;
  const pick = (list) => list[Math.floor(rand() * list.length)];

  return {
    objects: [sp.mesh, ...flashes.map((f) => f.m), ...rings.map((r) => r.m)],
    /** n sparkles from a point: out at `speed` (round, or `dir` ± spread/2 in sim radians), up at `up`. */
    burst(x, z, h, n, { speed = 40, up = 20, spread = Math.PI * 2, dir = 0, life = 0.4, size = 1.6, grav = 60, drag = 0.92, palette = GLINT.white } = {}) {
      for (let i = 0; i < n; i++) {
        const a = dir + (rand() - 0.5) * spread;
        const s = speed * (0.4 + rand() * 0.8);
        const c = pick(palette);
        sp.add({ x, y: h, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.3 + rand()), t: 0, life: life * (0.6 + rand() * 0.8), size: size * (0.7 + rand() * 0.6), r: c.r, g: c.g, b: c.b, spin: rand() * 6.3, spinV: (rand() - 0.5) * 6, grav, drag, tw: 0 });
      }
    },
    /** Motes drifting up from round a point, for `n` of them over the ground circle of radius `r`. */
    rise(x, z, r, n, { h = 1, up = 22, life = 1.0, size = 1.5, palette = GLINT.gold } = {}) {
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * Math.sqrt(rand());
        const c = pick(palette);
        sp.add({ x: x + Math.cos(a) * d, y: h + rand() * 4, z: z + Math.sin(a) * d, vx: 0, vz: 0, vy: up * (0.5 + rand() * 0.8), t: 0, life: life * (0.6 + rand() * 0.8), size: size * (0.7 + rand() * 0.6), r: c.r, g: c.g, b: c.b, spin: 0, spinV: 0, grav: 0, drag: 1, tw: 12 + rand() * 10, ph: rand() * 6.3 });
      }
    },
    /** A flash where something lands: a hot core and a four-pointed star, `size` across, gone in `life` s. */
    flash(x, z, h, { size = 12, life = 0.14, col = 0xfff6d8, a = 1.4 } = {}) {
      const f = flashes[fi++ % FLASHES];
      f.m.position.set(x, h, z);
      f.m.material.uniforms.uCol.value.set(col);
      Object.assign(f, { t0: now, life, size, a });
    },
    /** A ring going out over the ground to radius `r`. */
    ring(x, z, { r = 20, life = 0.45, col = 0xfff2c0, a = 0.9 } = {}) {
      const g = rings[ri++ % RINGS];
      g.m.position.set(x, 0.25, z);
      g.m.material.uniforms.uCol.value.set(col);
      Object.assign(g, { t0: now, life, r, a });
    },
    /** Three sparks circling (x, z) at height h and radius r until `until` (view time), each with a tail. */
    orbit(key, x, z, h, r, until) {
      const o = orbits.find((q) => q.key === key);
      if (o) Object.assign(o, { x, z, h, r, until });
      else orbits.push({ key, x, z, h, r, until, palette: GLINT.dazed, n: 3, acc: 0 });
    },
    update(t) {
      const dt = Math.max(0, Math.min(0.1, t - now));
      now = t;
      for (const f of flashes) {
        const k = f.t0 == null ? 1 : (now - f.t0) / f.life;
        f.m.visible = k >= 0 && k < 1;
        if (!f.m.visible) continue;
        const s = f.size * (0.7 + 0.6 * k);
        f.m.material.uniforms.uSize.value = { x: s, y: s };
        f.m.material.uniforms.uA.value = f.a * (1 - k) * (1 - k);
      }
      for (const g of rings) {
        const k = g.t0 == null ? 1 : (now - g.t0) / g.life;
        g.m.visible = k >= 0 && k < 1;
        if (!g.m.visible) continue;
        const R = 3 + g.r * (1 - Math.pow(1 - k, 2.5));
        g.m.material.uniforms.uSize.value = { x: R * 2, y: R * 2 };
        g.m.material.uniforms.uA.value = g.a * (1 - k);
      }
      for (let i = orbits.length - 1; i >= 0; i--) {
        const o = orbits[i];
        if (now > o.until) {
          orbits.splice(i, 1);
          continue;
        }
        o.acc += dt * 45;
        while (o.acc >= 1) {
          o.acc -= 1;
          for (let j = 0; j < o.n; j++) {
            const a = now * 4.2 + (j * Math.PI * 2) / o.n;
            const c = o.palette[j % o.palette.length];
            sp.add({ x: o.x + Math.cos(a) * o.r, y: o.h + Math.sin(now * 5 + j * 2) * 1.2, z: o.z + Math.sin(a) * o.r * 0.8, vx: 0, vz: 0, vy: 0, t: 0, life: 0.35, size: 2.2, grow: -0.85, r: c.r, g: c.g, b: c.b, spin: 0, spinV: 0, grav: 0, drag: 1, tw: 0 });
          }
        }
      }
      sp.step(dt, now);
    },
    clear() {
      sp.clear();
      orbits.length = 0;
    },
    dispose() {
      sp.dispose();
      for (const f of [...flashes, ...rings]) (f.m.geometry.dispose(), f.m.material.dispose());
    },
  };
}
