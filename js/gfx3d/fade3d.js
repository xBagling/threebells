// Keeping the fight readable (docs/3D-PLAN.md 4.11): nothing may hide the hero, the boss, an add,
// a hostile shot or its dot, the aim line or a live marking. A prop that would — a tree, a lantern,
// a front bush, the topiary, each a "fade group" — is dropped from the main pass and drawn on its
// own layer instead (post3d.js), fading to 35% over 150 ms, so the fight shows through it.
//
// Which groups: tested along the view ray, not by screen boxes (a box test fades the back trees
// whenever the hero walks in front of them). Under this camera the ray from a point towards the
// camera runs 1.732 units over the ground, along sim (1, 1)/√2, for every unit it climbs. A point is
// hidden when that ray passes through a prop. Each group is one or more upright columns (a tree:
// its trunk, and its canopy from the canopy's bottom up); a character is sampled at five heights,
// each ray widened by its radius. Markings and the aim line are ground points: each group keeps
// the lawn cells it hides (a 2-unit grid, made once), and a group fades while a live marking or
// the aim line covers one of them. Pure maths on the sim's numbers and the layout: no three.js.
import { hits, phaseOf, shown } from "../sim/hazards.js?v=df092a6";
import { shapeDist } from "./shapes3d.js?v=df092a6";
import { PLAYER } from "../config.js?v=df092a6";

const RUN = Math.sqrt(3); // ground run per unit of height, along the view ray
const D = Math.SQRT1_2;
export const FADE_OPACITY = 0.35;
export const FADE_TIME = 0.15; // seconds, from opaque to 35% (and back)
const CELL = 2; // the hidden-lawn grid, in sim units
const LAWN = 121; // markings only reach r 120

/** A group's columns: `parts` when the layout gives them (trees), else one column 0..height. */
const columns = (g) => g.parts || [{ x: g.x, z: g.z, r: g.radius, y0: 0, y1: g.height }];

/**
 * Does the view ray from sim (px, pz) at height y pass through part `c`, widened by `widen`? A part
 * is an upright column { x, z, r, y0, y1 }, or an ellipsoid { x, z, r, cy, ry } (a canopy, a bush).
 */
export function rayHits(px, pz, y, c, widen = 0) {
  if (c.ry) {
    // Squash the height so the ellipsoid is a ball of radius r, then meet the ray with it.
    const k = c.r / c.ry;
    const R = c.r + widen;
    const ox = px - c.x;
    const oy = k * (y - c.cy);
    const oz = pz - c.z;
    const vy = k / RUN;
    const a = D * D * 2 + vy * vy;
    const b = 2 * (ox * D + oy * vy + oz * D);
    const cc = ox * ox + oy * oy + oz * oz - R * R;
    const disc = b * b - 4 * a * cc;
    return disc >= 0 && (-b + Math.sqrt(disc)) / (2 * a) > 0;
  }
  const dx = c.x - px;
  const dz = c.z - pz;
  const along = (dx + dz) * D; // ground distance to the column's axis along the ray
  const across = (dx - dz) * D;
  const R = c.r + widen;
  if (Math.abs(across) >= R) return false;
  const half = Math.sqrt(R * R - across * across);
  const sb = along + half;
  if (sb <= 0) return false; // the column is behind the point
  const sa = Math.max(0, along - half);
  return y + sa / RUN < c.y1 && y + sb / RUN > c.y0;
}

const hides = (g, px, pz, y, widen) => columns(g).some((c) => rayHits(px, pz, y, c, widen));

/** The lawn cells (r < 121) a group can hide, as [x, z, …]; made once per group. */
const cellsOf = new WeakMap();
function lawnCells(g) {
  let cells = cellsOf.get(g);
  if (cells) return cells;
  cells = [];
  const cols = columns(g);
  const reach = Math.max(...cols.map((c) => c.r)) + 1;
  const back = Math.max(...cols.map((c) => c.y1 ?? c.cy + c.ry)) * RUN * D + reach; // how far back (in x and in z) it can reach
  const x0 = Math.floor((g.x - back - reach) / CELL) * CELL;
  const z0 = Math.floor((g.z - back - reach) / CELL) * CELL;
  for (let x = x0; x <= g.x + reach; x += CELL)
    for (let z = z0; z <= g.z + reach; z += CELL) if (Math.hypot(x, z) < LAWN && hides(g, x, z, 0, 0)) cells.push(x, z);
  cellsOf.set(g, cells);
  return cells;
}

/**
 * The groups that must fade this frame, as a bit mask (bit g = group g). `w` is the world (positions
 * already in between); `toad` Gnasher's drawn ground point and height { x, y, lift } (his hop is
 * drawn off his sim point); `aim` the aim preview or null; `hazAt(h)` the in-between hazard pose.
 */
export function fadeTargets(groups, w, { toadR = 16, toad = null, aim = null, hazAt = null } = {}) {
  const bodies = [];
  const p = w.player;
  if (!p.dead) bodies.push([p.x, p.y, 4.5, 0, 19.6]); // his drawn half-width, not his 6-unit reach; his height
  const b = w.boss;
  if (b) bodies.push([toad?.x ?? b.x, toad?.y ?? b.y, toadR, toad?.lift ?? 0, 27.8]); // Gnasher's height 27.8
  for (const a of w.adds) if (a.alive) bodies.push([a.x, a.y, a.r || 7, 0, 14]);
  for (const s of w.shots) if (!s.dead && !s.friendly) bodies.push([s.x, s.y, s.r || 6, 0, 5]);
  // Ground things: a marking that can reach the hero soon, and the aim line.
  const live = w.hazards.filter((h) => !h.friendly && shown(h) && phaseOf(h) !== "fade" && hits(h, p.x, p.y, 70));
  let line = null;
  if (aim && !p.dead) {
    const len = aim.slot == null ? (p.moveset?.[0] ?? PLAYER.combo[0]).range + 6 : 64;
    line = { x: p.x, y: p.y, c: Math.cos(aim.angle), s: Math.sin(aim.angle), len };
  }
  let mask = 0;
  for (const g of groups) {
    let on = false;
    for (const [x, z, r, y0, h] of bodies) {
      for (let i = 0; i <= 4 && !on; i++) on = hides(g, x, z, y0 + (h * i) / 4, r);
      if (on) break;
    }
    if (!on && (live.length || line)) {
      const cells = lawnCells(g);
      for (let i = 0; i < cells.length && !on; i += 2) {
        const cx = cells[i];
        const cz = cells[i + 1];
        for (const h of live)
          if (shapeDist(h, cx, cz, hazAt ? hazAt(h) : undefined) <= 0) {
            on = true;
            break;
          }
        if (!on && line) {
          // The line runs from 12 units out; a cell within 3 units of it counts.
          const dx = cx - line.x;
          const dz = cz - line.y;
          const t = dx * line.c + dz * line.s;
          on = t > 12 && t < line.len && Math.abs(dx * line.s - dz * line.c) < 3;
        }
      }
    }
    if (on) mask |= 1 << g.id;
  }
  return mask;
}

/**
 * The fades over time: each group eases to faded while its bit is set and back when it is not,
 * 150 ms each way. `step` returns { mask (every group not fully opaque), alpha } where alpha[g] is
 * the group's opacity on the fade layer (1 … 0.35).
 */
export function makeFader(groups) {
  const n = groups.reduce((m, g) => Math.max(m, g.id), 0) + 1;
  const amount = new Float32Array(n); // 0 opaque … 1 faded
  const alpha = new Float32Array(Math.max(n, 17)).fill(1);
  return {
    step(targets, dt) {
      let mask = 0;
      for (const g of groups) {
        const want = (targets >> g.id) & 1;
        const a = amount[g.id];
        amount[g.id] = want ? Math.min(1, a + dt / FADE_TIME) : Math.max(0, a - dt / FADE_TIME);
        if (amount[g.id] > 0) mask |= 1 << g.id;
        alpha[g.id] = 1 - (1 - FADE_OPACITY) * amount[g.id];
      }
      return { mask, alpha };
    },
  };
}
