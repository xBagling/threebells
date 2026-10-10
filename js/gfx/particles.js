// Particles. One flat array of small structs, reused rather than reallocated (gfx3d/fx3d.js draws them).
//
// Kinds, and what each is for:
//   spark  a hit landing — fast, short-lived, bright
//   dust   feet and rolls — slow, rising, dim
//   ember  Cinder's arena, and anything burning
//   drop   blood and brine — arcs and lands
//   ring   a flat expanding circle, for a wave going out
//   mote   drifting ambience, never dies
import { rng, TAU } from "../util.js?v=df092a6";

const MAX = 900;

export function makeParticles(seed = 7) {
  const rand = rng(seed);
  const p = [];
  for (let i = 0; i < MAX; i++) p.push({ live: false, x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, t: 0, life: 1, size: 1, col: "#fff", fade: 1, grav: 0, drag: 1, kind: "spark" });
  let head = 0;

  const take = () => {
    for (let i = 0; i < MAX; i++) {
      const q = p[(head + i) % MAX];
      if (!q.live) {
        head = (head + i + 1) % MAX;
        return q;
      }
    }
    head = (head + 1) % MAX;
    return p[head];
  };

  const api = {
    list: p,
    rand,
    /** A burst of n particles from a point. */
    burst(x, y, n, opts = {}) {
      const { speed = 90, spread = TAU, dir = 0, life = 0.4, size = 1, cols = ["#fff"], grav = 0, drag = 0.9, z = 4, vz = 0, kind = "spark" } = opts;
      for (let i = 0; i < n; i++) {
        const a = dir + (rand() - 0.5) * spread;
        const sp = speed * (0.45 + rand() * 0.8);
        const q = take();
        q.live = true;
        q.x = x;
        q.y = y;
        q.vx = Math.cos(a) * sp;
        q.vy = Math.sin(a) * sp;
        q.z = z;
        q.vz = vz * (0.5 + rand());
        q.t = 0;
        q.life = life * (0.6 + rand() * 0.8);
        q.size = typeof size === "function" ? size(rand()) : size;
        q.col = cols[Math.floor(rand() * cols.length)];
        q.grav = grav;
        q.drag = drag;
        q.kind = kind;
      }
    },
    one(x, y, opts = {}) {
      api.burst(x, y, 1, opts);
    },
    step(dt) {
      for (const q of p) {
        if (!q.live) continue;
        q.t += dt;
        if (q.t >= q.life) {
          q.live = false;
          continue;
        }
        const d = Math.pow(q.drag, dt * 60);
        q.vx *= d;
        q.vy *= d;
        q.vz -= q.grav * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z = Math.max(0, q.z + q.vz * dt);
      }
    },
  };
  return api;
}

export const PAL = {
  steel: ["#eef4ff", "#cfd9e8", "#9fb0c8"],
  blood: ["#d9502f", "#b8402c", "#8c1f22"],
  bog: ["#6aa03e", "#9ac455", "#d6f06b"],
  fire: ["#ffce54", "#ff8a1e", "#d6500f"],
  ash: ["#8b8296", "#544c5c", "#3a3440"],
  brine: ["#b6f0f2", "#63c2cf", "#2f89a6"],
  gold: ["#ffcf5a", "#ffd66b", "#c99a28"],
  dust: ["#626c88", "#485068", "#343a4e"],
  mint: ["#8fffd0", "#e6fff2"],
};
