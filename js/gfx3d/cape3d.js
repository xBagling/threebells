// The hero's cape (docs/3D-PLAN.md 7.3): three verlet chains of joints hanging from the shoulders
// and the back, stepped at a fixed 240 Hz on sim-view time (so a hit-stop freezes it, and the
// result is the same at any screen rate), driven by the body's own movement and the garden's wind,
// kept off the legs (spheres), out of the ground and behind the body. A cloth panel is laid through
// the chains every frame. Each joint's speed is clamped, so nothing whips through in one step.
import { Mesh, BufferGeometry, BufferAttribute, Float32BufferAttribute, DynamicDrawUsage, Vector3, DoubleSide } from "./three-lib.js?v=8898846";

const CHAINS = 3; // left, middle, right
const JOINTS = 6; // per chain, the first pinned at the shoulders
const COLS = 7; // panel columns across (the chains are spread through them)
const STEP = 1 / 240;

export function makeCape(material, { length = 12, width = 7, flare = 1.6 } = {}) {
  const seg = length / (JOINTS - 1);
  const pts = Array.from({ length: CHAINS * JOINTS }, () => ({ p: new Vector3(), q: new Vector3(), a: new Vector3() }));
  let primed = false;
  let acc = 0;

  const geo = new BufferGeometry();
  const pos = new Float32Array(COLS * JOINTS * 3);
  const uv = new Float32Array(COLS * JOINTS * 2);
  const idx = [];
  for (let r = 0; r < JOINTS; r++)
    for (let c = 0; c < COLS; c++) {
      uv[(r * COLS + c) * 2] = c / (COLS - 1);
      uv[(r * COLS + c) * 2 + 1] = 1 - r / (JOINTS - 1);
      if (r < JOINTS - 1 && c < COLS - 1) {
        const a = r * COLS + c;
        idx.push(a, a + COLS, a + 1, a + 1, a + COLS, a + COLS + 1);
      }
    }
  geo.setIndex(idx);
  const pa = new BufferAttribute(pos, 3);
  pa.setUsage(DynamicDrawUsage);
  geo.setAttribute("position", pa);
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  const mesh = new Mesh(geo, material);
  mesh.material.side = DoubleSide;
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  const anchor = new Vector3();
  const lastRoot = new Vector3(); // where the shoulders were last frame
  const fwd = new Vector3();
  const right = new Vector3();
  const tmp = new Vector3();
  const colliders = []; // { c: Vector3, r }

  return {
    mesh,
    /**
     * `root` the body's world position at the shoulders' height; `forward`, `rightDir` unit world
     * vectors of the body; `wind` a world vector (units/s²); `balls` [{ c, r }] body colliders;
     * `dt` sim-view seconds since the last frame.
     */
    update(root, forward, rightDir, wind, balls, dt) {
      fwd.copy(forward);
      right.copy(rightDir);
      colliders.length = 0;
      for (const b of balls) colliders.push(b);
      // The pinned tops: across the shoulders, a little behind the neck.
      const pin = (ci) => anchor.copy(root).addScaledVector(right, ((ci - 1) * width) / 2).addScaledVector(fwd, -1.2);
      // A jump no run or roll could make (a restart, a bench teleport): hang it afresh rather than
      // stretch it across the floor.
      if (primed && lastRoot.distanceToSquared(root) > 20 * 20) primed = false;
      lastRoot.copy(root);
      if (!primed) {
        for (let ci = 0; ci < CHAINS; ci++)
          for (let j = 0; j < JOINTS; j++) {
            const o = pts[ci * JOINTS + j];
            pin(ci);
            o.p.copy(anchor).addScaledVector(fwd, -0.4 * j).y -= seg * j;
            o.q.copy(o.p);
          }
        primed = true;
      }
      acc = Math.min(acc + dt, 0.1);
      while (acc >= STEP) {
        acc -= STEP;
        for (let ci = 0; ci < CHAINS; ci++) {
          for (let j = 0; j < JOINTS; j++) {
            const o = pts[ci * JOINTS + j];
            if (j === 0) {
              pin(ci);
              o.q.copy(o.p);
              o.p.copy(anchor);
              continue;
            }
            // Verlet with damping, gravity and the wind (stronger lower down).
            tmp.subVectors(o.p, o.q).multiplyScalar(0.985);
            const v = tmp.length();
            if (v > 2.2) tmp.multiplyScalar(2.2 / v); // no whipping through in one step
            o.q.copy(o.p);
            o.p.add(tmp);
            o.p.y -= 160 * STEP * STEP; // gravity: the hero is about 10.9 units a metre; a heavy-ish cloth
            o.p.addScaledVector(wind, STEP * STEP * (0.4 + j / JOINTS));
          }
          // Constraints: segment lengths (a few passes), the ground, the body, behind the back.
          for (let it = 0; it < 3; it++)
            for (let j = 1; j < JOINTS; j++) {
              const a = pts[ci * JOINTS + j - 1].p;
              const b = pts[ci * JOINTS + j].p;
              const flareSeg = seg * (1 + (flare - 1) * (j / JOINTS) * 0.3);
              tmp.subVectors(b, a);
              const d = tmp.length() || 1e-6;
              b.addScaledVector(tmp, (flareSeg - d) / d);
              if (b.y < 0.3) b.y = 0.3;
              for (const col of colliders) {
                tmp.subVectors(b, col.c);
                const dd = tmp.length();
                if (dd < col.r) b.addScaledVector(tmp, (col.r - dd) / (dd || 1e-6));
              }
              // Never in front of the body's back plane (a cape hangs behind).
              tmp.subVectors(b, root);
              const ahead = tmp.dot(fwd) + 0.6;
              if (ahead > 0) b.addScaledVector(fwd, -ahead);
            }
        }
      }
      // Lay the panel through the chains, flaring towards the hem.
      for (let r = 0; r < JOINTS; r++)
        for (let c = 0; c < COLS; c++) {
          const u = (c / (COLS - 1)) * (CHAINS - 1);
          const i0 = Math.min(CHAINS - 2, Math.floor(u));
          const t = u - i0;
          const A = pts[i0 * JOINTS + r].p;
          const B = pts[(i0 + 1) * JOINTS + r].p;
          tmp.lerpVectors(A, B, t);
          const spread = ((c / (COLS - 1)) - 0.5) * (r / (JOINTS - 1)) * (flare - 1) * width * 0.5;
          tmp.addScaledVector(right, spread);
          const o = (r * COLS + c) * 3;
          pos[o] = tmp.x;
          pos[o + 1] = tmp.y;
          pos[o + 2] = tmp.z;
        }
      pa.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    },
    reset() {
      primed = false;
    },
    dispose() {
      geo.dispose();
    },
  };
}
