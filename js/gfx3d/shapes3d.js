// The telegraph shapes as the 3D view draws them. Pure: no three.js, runs under Bun.
//
// A marking must show exactly what hurts (docs/3D-PLAN.md 8.1): the decal shader in hazards3d.js
// evaluates these same formulas per pixel, and tools/test.mjs checks them against the sim's own
// hits(h, x, y, 0) on a grid for every kind. They are 2D's shapePath (render.js), written as
// signed distances so the shader can draw a hard edge and a one-texel stroke from one number.
import { KIND, radiusOf } from "../sim/hazards.js?v=df092a6";
import { ARENA } from "../config.js?v=df092a6";

/** Kinds as numbers, for the shader's uniform arrays. */
export const KIND_ID = { [KIND.CIRCLE]: 0, [KIND.RING]: 1, [KIND.WAVE]: 2, [KIND.CONE]: 3, [KIND.LANE]: 4, [KIND.FLOOD]: 5 };

const wrap = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

/**
 * Signed distance from world (px, py) to the drawn shape: negative inside, positive outside.
 * `x, y, a` default to the hazard's own; the view passes in-between ones (lerp3d).
 */
export function shapeDist(h, px, py, { x = h.x, y = h.y, a = h.a, r = radiusOf(h) } = {}) {
  const dx = px - x;
  const dy = py - y;
  const d = Math.hypot(dx, dy);
  switch (h.kind) {
    case KIND.CIRCLE:
      return d - r;
    case KIND.RING:
      return Math.max(d - r, h.r0 - d);
    case KIND.WAVE:
      return Math.abs(d - r) - h.w / 2;
    case KIND.CONE: {
      const radial = Math.max(d - r, h.r0 - d);
      if (d < 1) return radial; // as hits(): right at the point, the angle does not count
      const off = Math.abs(wrap(Math.atan2(dy, dx) - a)) - h.half;
      // Distance to the side edges, measured along the arc (good enough near the edge, which is
      // where the stroke is drawn); the inside test is exact.
      return Math.max(radial, off > 0 ? Math.sin(Math.min(off, Math.PI / 2)) * d : off * d);
    }
    case KIND.LANE: {
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const along = dx * ux + dy * uy - h.len / 2;
      const across = -dx * uy + dy * ux;
      const qx = Math.abs(along) - h.len / 2;
      const qy = Math.abs(across) - h.w / 2;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0);
    }
    case KIND.FLOOD: {
      let s = Math.hypot(px, py) - ARENA.R;
      for (const [sx, sy, sr] of h.safe || []) s = Math.max(s, sr - Math.hypot(px - sx, py - sy));
      return s;
    }
    default:
      return Infinity;
  }
}

/** Is (px, py) inside the shape as drawn (and on the floor)? */
export const insideDrawn = (h, px, py, o) => shapeDist(h, px, py, o) <= 0 && Math.hypot(px, py) <= ARENA.R + 2;
