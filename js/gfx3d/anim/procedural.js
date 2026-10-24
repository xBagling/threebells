// Frame-rate-independent dampers and springs for the 3D view's procedural motion (docs/3D-PLAN.md
// 7.2, 7.3): facing, lean, squash, the follow-through on a bone's turn. Pure. Written with half-lives, so "30 ms" means the
// gap halves every 30 ms, whatever the screen's frame rate.
import { Quaternion, Vector3 } from "../three-lib.js?v=48fd128-df87a96f";
const LN2 = Math.LN2;

export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

/** Move the angle `cur` towards `target` the short way round, halving the gap every `halfLife` seconds. */
export const dampAngle = (cur, target, halfLife, dt) => target - wrapAngle(target - cur) * Math.pow(2, -dt / Math.max(1e-5, halfLife));

/**
 * A critically damped spring (the exact solution, after Daniel Holden): the value and its speed
 * move towards `goal` with no overshoot, settling with the given half-life. Returns [x, v].
 */
export function springCritical(x, v, goal, halfLife, dt) {
  const y = (2 * LN2) / Math.max(1e-5, halfLife);
  const j0 = x - goal;
  const j1 = v + j0 * y;
  const e = Math.exp(-y * dt);
  return [e * (j0 + j1 * dt) + goal, e * (v - j1 * y * dt)];
}
/** springCritical without the array: the value and its speed written into `out` ({ x, v }, which may be the one read). */
export function springCriticalTo(out, x, v, goal, halfLife, dt) {
  const y = (2 * LN2) / Math.max(1e-5, halfLife);
  const j0 = x - goal;
  const j1 = v + j0 * y;
  const e = Math.exp(-y * dt);
  out.x = e * (j0 + j1 * dt) + goal;
  out.v = e * (v - j1 * y * dt);
  return out;
}

/**
 * An under-damped spring (damping ratio `zeta` < 1 overshoots a little), for settles and
 * squash. Semi-implicit Euler in fixed 1/240 s substeps, so it is stable at any frame rate.
 */
export function springStep(s, goal, freq, zeta, dt) {
  const w = Math.PI * 2 * freq;
  let t = dt;
  while (t > 1e-6) {
    const h = Math.min(t, 1 / 240);
    s.v += (-2 * zeta * w * s.v - w * w * (s.x - goal)) * h;
    s.x += s.v * h;
    t -= h;
  }
  return s.x;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The turning springs' substep (s), as springStep's. */
export const SPRING_H = 1 / 240;
/**
 * The substepped turning spring (ω, ζ for SPRING_H steps, springTurn) whose response is the one a spring tuned at (f Hz, ζ)
 * had when stepped once a frame at 60 Hz (semi-implicit, its damping implicit) — hero3d.js's follow-through springs were
 * tuned by eye that way. That step's two eigenvalues λ; their fourth roots the substep's (four substeps a 60 Hz frame); ω and
 * ζ read back from the substep's trace and determinant (det = 1/(1 + 2ζωh), tr = (2 + 2ζωh − ω²h²)/(1 + 2ζωh)). The chest's
 * 5 Hz, ζ 0.8 comes out 4.46 Hz, ζ 0.70.
 */
export function springAt60(f, z) {
  const w = 2 * Math.PI * f, h = 1 / 60, c = 2 * z * w * h;
  const tr = (2 + c - w * w * h * h) / (1 + c), det = 1 / (1 + c);
  const disc = (tr * tr) / 4 - det;
  let tr4, det4;
  if (disc < 0) {
    // (a pair r·e^(±iθ): their fourth roots r^¼·e^(±iθ/4))
    const r = Math.sqrt(det), th = Math.atan2(Math.sqrt(-disc), tr / 2);
    (tr4 = 2 * Math.pow(r, 0.25) * Math.cos(th / 4)), (det4 = Math.sqrt(r));
  } else {
    const l1 = tr / 2 + Math.sqrt(disc), l2 = tr / 2 - Math.sqrt(disc);
    if (!(l2 > 0)) return { w0: w, z };
    (tr4 = Math.pow(l1, 0.25) + Math.pow(l2, 0.25)), (det4 = Math.pow(l1 * l2, 0.25));
  }
  const H = SPRING_H, c4 = 1 / det4 - 1, w4 = Math.sqrt(Math.max(0, 2 + c4 - tr4 * (1 + c4))) / H;
  return w4 > 0 ? { w0: w4, z: c4 / (2 * H * w4) } : { w0: w, z };
}
const tsE = new Quaternion(), tsQ = new Quaternion(), tsV = new Vector3(), tsT = new Quaternion();
/**
 * A damped spring on a turn: `sp` = { q (Quaternion, where it is), v (Vector3, its spin, rad/s), w0, z } pulled toward
 * `tgt` over `dt` seconds in SPRING_H substeps (semi-implicit; the miss as a turn — its axis times its angle, the short
 * way — pulling it, damped by its spin), never further than `maxDev` (rad) from `tgt`. Once a frame, as it was, its
 * implicit damping grew with the frame's length and it ran slow under 30 fps (its step capped at 1/30 s). Given `from`
 * (the target last frame), the substeps follow the target from there to `tgt` across the frame: held at `tgt` the whole
 * frame, a longer frame pulled longer toward where it only ends up (30 Hz against 60 off by up to 3.8° a 20° step).
 */
export function springTurn(sp, tgt, dt, maxDev = Infinity, from = null) {
  for (let t = dt; t > 1e-6; t -= SPRING_H) {
    const h = Math.min(t, SPRING_H);
    const goal = from ? tsT.slerpQuaternions(from, tgt, 1 - (t - h) / dt) : tgt;
    tsE.copy(goal).multiply(tsQ.copy(sp.q).invert());
    if (tsE.w < 0) tsE.set(-tsE.x, -tsE.y, -tsE.z, -tsE.w);
    const s1 = Math.sqrt(Math.max(0, 1 - tsE.w * tsE.w)), ang = 2 * Math.acos(Math.min(1, tsE.w));
    tsV.set(tsE.x, tsE.y, tsE.z).multiplyScalar(s1 > 1e-6 ? ang / s1 : 2);
    sp.v.addScaledVector(tsV, sp.w0 * sp.w0 * h).multiplyScalar(1 / (1 + 2 * sp.z * sp.w0 * h));
    const a = sp.v.length() * h;
    if (a > 1e-9) sp.q.premultiply(tsQ.setFromAxisAngle(tsV.copy(sp.v).normalize(), a)).normalize();
    // (held at maxDev: written `q.copy(tgt).slerp(q, …)` it slerped the target onto itself, and every spring past the stop
    // snapped onto the bake — the head 21° → 2° in one frame of cut 1 at 60 Hz, .scratch/fix/springrate.mjs)
    const dev = 2 * Math.acos(Math.min(1, Math.abs(sp.q.dot(goal))));
    if (dev > maxDev) sp.q.slerpQuaternions(goal, tsQ.copy(sp.q), maxDev / dev);
  }
  return sp.q;
}
