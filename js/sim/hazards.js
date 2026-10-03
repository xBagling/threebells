// Telegraphs: the red shapes on the floor that say "not here, not in a moment".
//
// Every boss attack is one of these. A hazard has three lives: it is drawn but harmless while it
// winds up, it hurts for a short window, and then it fades. Readability is the whole point, so the
// wind-up is at least half a second (tools/test.mjs asserts it, apart from the shock-waves that
// follow a slam) and the shape it draws is exactly the shape that will hurt you — never a hint of it.
import { clamp, TAU, angleDiff } from "../util.js?v=8898846";

export const KIND = { CIRCLE: "circle", RING: "ring", CONE: "cone", LANE: "lane", WAVE: "wave", FLOOD: "flood" };

let nextId = 1;

/**
 * Make a hazard.
 *  kind, x, y and the shape fields for that kind
 *  tele:   seconds of wind-up (drawn, harmless)
 *  active: seconds it hurts for
 *  fade:   seconds it lingers, harmless, afterwards
 *  dmg:    damage on contact
 *  every:  if set, it can hit again after this many seconds (lingering fire); otherwise once
 *  grow:   the radius the shape reaches by the end of the wind-up (for a closing circle)
 *  expand: units a second the radius grows while active (for an outward wave)
 *  spin:   radians a second the angle turns while active (for a sweep)
 *  vx, vy: units a second the whole shape travels while active
 *  hidden: seconds at the start of the wind-up when nothing is drawn yet (the Hushed affix)
 *  follow: drawn from the boss along his facing, and turned with him until his move commits
 */
export function hazard(opts) {
  return {
    id: nextId++,
    kind: KIND.CIRCLE,
    x: 0,
    y: 0,
    r: 40,
    r0: 0,
    a: 0,
    half: 0.6,
    len: 100,
    w: 22,
    tele: 0.9,
    active: 0.2,
    fade: 0.25,
    dmg: 22,
    every: 0,
    grow: 0,
    expand: 0,
    spin: 0,
    vx: 0,
    vy: 0,
    style: "hot", // "hot" (dodge it) | "cold" (a slow, safe-looking one) | "safe" (stand here)
    t: 0,
    done: false,
    cool: 0,
    hitOnce: false,
    tag: "",
    ...opts,
  };
}

/** Is it on the floor for anyone to see yet? Harmless either way until the wind-up runs out. */
export const shown = (h) => h.t >= (h.hidden || 0);
export const phaseOf = (h) => (h.t < h.tele ? "tele" : h.t < h.tele + h.active ? "active" : "fade");
/** 0 → 1 across the wind-up; 1 once it is live. */
export const teleK = (h) => clamp(h.t / Math.max(0.0001, h.tele), 0, 1);

/** The radius the shape is drawn and tested at right now. */
export function radiusOf(h) {
  const p = phaseOf(h);
  if (p === "tele") return h.grow ? h.r0 + (h.r - h.r0) * teleK(h) : h.r;
  const live = h.t - h.tele;
  return h.r + h.expand * live;
}

export function stepHazard(h, dt) {
  h.t += dt;
  if (phaseOf(h) === "active") {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.a += h.spin * dt;
    if (h.cool > 0) h.cool -= dt;
  }
  if (h.t >= h.tele + h.active + h.fade) h.done = true;
}

/** Is (px, py) with radius pr inside the hazard's shape as it stands now? */
export function hits(h, px, py, pr) {
  const r = radiusOf(h);
  const dx = px - h.x;
  const dy = py - h.y;
  const d = Math.hypot(dx, dy);
  switch (h.kind) {
    case KIND.CIRCLE:
      return d <= r + pr;
    case KIND.RING:
      return d <= r + pr && d >= h.r0 - pr;
    case KIND.WAVE:
      return Math.abs(d - r) <= h.w / 2 + pr;
    case KIND.CONE: {
      if (d > r + pr || d < h.r0 - pr) return false;
      if (d < 1) return true;
      const a = Math.atan2(dy, dx);
      // Widen the test a little near the point, so the hero's body is not clipped by a hair.
      const slack = Math.atan2(pr, Math.max(4, d));
      return Math.abs(angleDiff(h.a, a)) <= h.half + slack;
    }
    case KIND.FLOOD: {
      // The whole floor hurts except the marked shallows; standing half-in does not save you.
      for (const [sx, sy, sr] of h.safe) if (Math.hypot(px - sx, py - sy) <= sr - pr * 0.4) return false;
      return true;
    }
    case KIND.LANE: {
      // A flat-ended strip from (x, y) along a: len long, w wide — the rectangle that is drawn.
      // The body touches it if the nearest point of the rectangle is within its radius; a capsule
      // test would reach w/2 past each drawn end.
      const ux = Math.cos(h.a);
      const uy = Math.sin(h.a);
      const along = dx * ux + dy * uy;
      const across = Math.abs(-dx * uy + dy * ux);
      const out = Math.max(0, -along, along - h.len);
      const side = Math.max(0, across - h.w / 2);
      return Math.hypot(out, side) <= pr;
    }
    default:
      return false;
  }
}

/**
 * Should this hazard damage the player this tick? Handles "once per hazard" and "every n seconds".
 * Returns the damage, or 0.
 */
export function damageFor(h, px, py, pr) {
  if (phaseOf(h) !== "active") return 0;
  if (!h.every && h.hitOnce) return 0;
  if (h.every && h.cool > 0) return 0;
  if (!hits(h, px, py, pr)) return 0;
  if (h.every) h.cool = h.every;
  else h.hitOnce = true;
  return h.dmg;
}

/** Where the shape pushes you from, for knockback. */
export function sourceOf(h, px, py) {
  if (h.kind === KIND.WAVE || h.kind === KIND.RING) {
    const a = Math.atan2(py - h.y, px - h.x);
    return [h.x + Math.cos(a) * (radiusOf(h) - 10), h.y + Math.sin(a) * (radiusOf(h) - 10)];
  }
  return [h.x, h.y];
}

export { TAU };
