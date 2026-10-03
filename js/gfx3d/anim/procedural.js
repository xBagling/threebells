// Frame-rate-independent dampers and springs for the 3D view's procedural motion (docs/3D-PLAN.md
// 7.2, 7.3): facing, lean, squash. Pure. Written with half-lives, so "30 ms" means the gap halves
// every 30 ms, whatever the screen's frame rate.
const LN2 = Math.LN2;

export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

/** Move `cur` towards `target`, halving the gap every `halfLife` seconds. */
export const damp = (cur, target, halfLife, dt) => target + (cur - target) * Math.pow(2, -dt / Math.max(1e-5, halfLife));

/** The same for an angle, the short way round. */
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
