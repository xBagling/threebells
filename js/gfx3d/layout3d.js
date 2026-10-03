// The garden's layout, as data (docs/3D-PLAN.md 4.2–4.11). PURE — no three.js — so the Bun layout
// tests read exactly the numbers the 3D view builds from: where every prop stands, the wall's
// blocks and heights by angle, where the grass and flowers are scattered, and which of them may
// never hide the lawn.
//
// Angles: θ is measured from the camera's direction (sim angle π/4). θ = 0 is the bottom of the
// screen, −90° screen right, +90° screen left, 180° the back. Positions are sim (x, y); the 3D view
// puts a point at three (x, height, y).
//
// The one rule everything here serves (4.11): a point at height h hides exactly one ground point,
// the one √3·h behind it along sim (−1, −1)/√2. So nothing opaque that does not fade may stand
// taller than hMax(r, θ), or it would hide ground the fight can reach (r < 116). Props that must
// be taller (trees, lanterns, the front bushes, the topiary) are fade groups instead.
//
// For M4a the grass density is worked out here from the layout (denser at wall bases, round bushes
// and trunks, sparse in the fighting middle) rather than read from meadow-density.bin; scatter()
// keeps the same shape so the bytes can replace the function later.
import { ARENA } from "../config.js?v=8898846";
import { rng } from "../util.js?v=8898846";
import { RIGHT, UP } from "./camera3d.js?v=8898846";
import MEADOW from "../../art3d/meadow.layout.json" with { type: "json" };

export const DEG = Math.PI / 180;
/** Math.hypot is slow in V8; the garden is built from many thousands of these. */
const hyp = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c);

/** Ground within this must stay visible: the hero's body reaches 116 (4.2). */
export const R_SEEN = ARENA.R - 2;
/** Every solid footprint lies at or beyond this. */
export const R_SOLID = ARENA.R + 1;
/** Ground cover rooted inside this is lawn cover: flattened depth, and the lawn's height caps. */
export const R_FLAT = ARENA.R + 2;
/** A point at height h hides the ground √3·h (cot 30°) behind it. */
export const HIDE = Math.sqrt(3);
const HIDE_XY = HIDE / Math.SQRT2;
/** Lawn cover caps (4.2): tufts, clovers, flowers. */
export const LAWN_CAP = { tuft: 1.3, clover: 2, flower: 3 };
/** Per quality tier (9.4). `cards` is the share of foliage cards kept. */
export const TIERS = {
  low: { tufts: 1500, flowers: 90, cards: 0.6 },
  medium: { tufts: 2500, flowers: 150, cards: 1 },
  high: { tufts: 4000, flowers: 150, cards: 1 },
};

/** The sim point at radius r and angle θ (degrees). */
export function at(r, thDeg) {
  const a = Math.PI / 4 + thDeg * DEG;
  return [r * Math.cos(a), r * Math.sin(a)];
}
/** θ of a sim point, in radians, (−π, π]. */
export function thetaOf(x, y) {
  let t = Math.atan2(y, x) - Math.PI / 4;
  if (t <= -Math.PI) t += 2 * Math.PI;
  else if (t > Math.PI) t -= 2 * Math.PI;
  return t;
}
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrap = (t) => (t > Math.PI ? t - 2 * Math.PI : t <= -Math.PI ? t + 2 * Math.PI : t);

/**
 * Where the flank turns into the back arc: over |θ| 140–155° (4.2). The flank runs on past the
 * lanterns L1 (−126°) and L4 (132°) and T2 (−144°), so they stand against a straight flank on its
 * narrow bed as in the target, where the corner falls between T2 and B1; B1 (−159°) and the back
 * trunks stand in front of the back arc.
 */
const BACK_ARC = [140 * DEG, 155 * DEG];
/** 0 on the flanks and the camera side, easing to 1 on the back arc (θ in radians): the wall's radius, heights and stone colour follow it. */
export const backArc = (th) => smooth(BACK_ARC[0], BACK_ARC[1], Math.abs(th));
/** The wall's inner face at θ (radians): 128, easing to 136 on the back arc, so B1 and the back trunks stand in front of it (4.2). */
export const wallR = (th) => 128 + 8 * backArc(th);
export const WALL_DEPTH = 7;

/**
 * The tallest a point at radius r, angle θ (radians) may be without hiding ground inside r 116
 * (4.11). Infinity where it cannot hide the lawn at all (the back half, and the far flanks).
 */
export function hMax(r, th) {
  const c = Math.cos(th);
  const s = r * Math.sin(th);
  if (c <= 0 || Math.abs(s) >= R_SEEN) return Infinity;
  return (r * c - Math.sqrt(R_SEEN * R_SEEN - s * s)) / HIDE;
}
export const hMaxAt = (x, y) => hMax(hyp(x, y), thetaOf(x, y));
/** How far from the centre the ground a point at (x, y, height h) hides lies. */
export const hiddenR = (x, y, h) => hyp(x - HIDE_XY * h, y - HIDE_XY * h);

// --- the props (4.2): measured on bog.png, pushed out until the zone rules hold ----------------------

/** The lantern, from the ground up (4.9). Square in plan, sides on the world axes: a corner points at the camera. */
export const LANTERN = { plinth: 7, plinthH: 2.5, post: 5, postH: 22, tray: 8, trayH: 1, head: 6.5, roof: 9, roofH: 3, finial: 1, height: 36, flame: 28.75 };
/** The clover (4.5): three domed leaves, each tilted 15° towards the camera about its own centre, so its near edge touches the ground. Sizes are across the whole clover; 12.7 is the big one. */
export const CLOVER = { across: 12.7, leafR: 3.05, leafD: 3.3, dome: 0.4, tilt: 15 };
/** A flower head is a card tilted this far towards the camera (4.5, V3). */
export const FLOWER_TILT = 20;
/** Foliage card sizes (world units) by kind: the largest card's half-diagonal bounds how far past its volume a card can reach. */
export const CARD = { canopy: [1.6, 3.0], bush: [1.7, 2.8], topiary: [1.3, 2.2], hedge: [1.8, 3.2], mound: [1.1, 1.9], moss: [1.0, 1.8], conifer: [1.4, 2.4] };
/** A lupine: florets (cards this size) stacked up its stem, and big five-finger leaves at its foot. */
export const LUPINE = { floret: 4.4, jitter: 1, leaf: 5, leafH: 1.2 };
/** Moss strips on the copings, and how far anything may sway (half a texel at the widest zoom, rounded up). */
export const MOSS_H = 0.35;
const SWAY = 0.5;

// Where each prop stands lives in public/art3d/meadow.layout.json, so the owner can move one
// without touching code; the layout tests then check every rule again.
const LANTERNS = MEADOW.lanterns.map((l) => [l.id, l.r, l.th]);
const TREES = MEADOW.trees;
const TOPIARY = MEADOW.topiary;
const BUSHES = MEADOW.bushes;
const LUPINES = MEADOW.lupines;
// bog.png's lawn clovers (sim x, y, across), then those in the bed (r, θ, across).
const LAWN_CLOVERS = MEADOW.lawnClovers.map((c) => [c.x, c.y, c.across]);
const BED_CLOVERS = MEADOW.bedClovers.map((c) => [c.r, c.th, c.across]);
const PILLAR = MEADOW.pillar;
const HEDGES = MEADOW.hedges;
/** Hedge mounds in gaps of the camera-side wall (4.6), and moss patches on the flank walls' inner faces (V31), by angle. */
const MOUNDS = MEADOW.mounds;
const MOSS_PATCHES = MEADOW.mossPatches;

// --- the wall (4.6) ---------------------------------------------------------------------------------------

/** An oriented box on the ground plan: centre, the angle of its depth axis (radial), half length and depth, bottom and top. */
function box(cx, cy, ang, hl, hd, y0, y1, extra = {}) {
  return { cx, cy, ang, hl, hd, y0, y1, ...extra };
}
/** The four plan corners of a box. */
export function boxCorners(b) {
  const nx = Math.cos(b.ang);
  const ny = Math.sin(b.ang);
  const tx = -ny;
  const ty = nx;
  return [
    [b.cx - tx * b.hl - nx * b.hd, b.cy - ty * b.hl - ny * b.hd],
    [b.cx + tx * b.hl - nx * b.hd, b.cy + ty * b.hl - ny * b.hd],
    [b.cx + tx * b.hl + nx * b.hd, b.cy + ty * b.hl + ny * b.hd],
    [b.cx - tx * b.hl + nx * b.hd, b.cy - ty * b.hl + ny * b.hd],
  ];
}
/** Points along a box's plan outline, at most `step` apart (a chord can dip towards the circle). */
function outline(b, step = 1) {
  const c = boxCorners(b);
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = c[i];
    const [bx, by] = c[(i + 1) % 4];
    const n = Math.max(1, Math.ceil(hyp(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return pts;
}
/** The lowest hMax over a box's plan: the tallest it may be. */
const allowedTop = (b) => Math.min(...outline(b, 0.5).map(([x, y]) => hMaxAt(x, y)));

/** A block laid as a chord along the wall between angles t0 and t1 (radians). */
function chord(t0, t1, rIn, depth, set, turn) {
  const tc = (t0 + t1) / 2;
  const a = Math.PI / 4 + tc;
  const rc = rIn + depth / 2 + set;
  const len = 2 * (rIn + depth) * Math.sin((t1 - t0) / 2);
  return { cx: rc * Math.cos(a), cy: rc * Math.sin(a), ang: a + turn, len, tc };
}

function buildWall(seed) {
  const r = rng(seed * 7919 + 101);
  const N = 60;
  const slot = (2 * Math.PI) / N;
  const b = Array.from({ length: N }, (_, k) => -Math.PI + (k + (r() - 0.5) * 0.36) * slot);
  const span = (k) => [b[k], k + 1 < N ? b[k + 1] : b[0] + 2 * Math.PI];
  const centre = (k) => wrap((span(k)[0] + span(k)[1]) / 2);
  const gaps = new Set(MOUNDS.map((m) => [...b.keys()].reduce((best, k) => (Math.abs(wrap(centre(k) - m * DEG)) < Math.abs(wrap(centre(best) - m * DEG)) ? k : best), 0)));
  const TALL = 55 * DEG;
  const tall = (k) => Math.abs(centre(k)) >= TALL;
  // Course heights for the tall wall, smooth in θ so neighbours meet: flanks 2 courses of 5–6
  // plus coping (10–13 in all), the back 2 courses of 4.3 (face 8.6, V30).
  const phase = r() * 6.28;
  const backness = backArc;
  const H1 = (t) => 5.4 + 0.4 * Math.sin(3 * t + phase) + (4.3 - 5.4) * backness(t);
  const H2 = (t) => H1(t) + 5.0 + 0.4 * Math.sin(5 * t + phase * 2) + (4.3 - 5.0) * backness(t);
  const COPE = (t) => 0.8 - 0.2 * backness(t);

  const pieces = [];
  const mounds = [];
  for (let k = 0; k < N; k++) {
    const [t0, t1] = span(k);
    const tc = centre(k);
    const rIn = wallR(tc);
    const depth = 6.4 + r() * 1.2;
    const set = (r() - 0.5) * 0.6;
    const turn = (r() - 0.5) * 3 * DEG;
    const shade = Math.floor(r() * 3);
    const chips = Array.from({ length: 8 }, () => (r() < 0.14 ? 0.9 + r() * 0.8 : 0));
    const mossy = r();
    const ch = chord(t0, t1, rIn, depth, set, turn);
    if (gaps.has(k)) {
      // A hedge mound fills the gap, no taller than the rule allows (with its cards' reach).
      const m = CARD.mound[1] * 0.71 + SWAY;
      const env = box(ch.cx, ch.cy, ch.ang, ch.len / 2 + m, depth / 2 + 0.5 + m, 0, 0);
      const h = Math.min(6, allowedTop(env) - 0.4 - m);
      mounds.push({ id: `M${mounds.length + 1}`, cx: ch.cx, cy: ch.cy, ang: ch.ang, hl: ch.len / 2, hd: depth / 2 + 0.5, h, cards: 85 }); // 85, not M4a's 70: the painted hedge cells cover less of a card (M4b step 5)
      continue;
    }
    const hl = ch.len / 2 - 0.15;
    const hd = depth / 2;
    if (!tall(k)) {
      // The camera side: one course and a capstone that overhangs it by 0.5, lit top, dark front (V32).
      const capH = 1.2 + r() * 0.3;
      const moss = mossy < 0.55;
      const cap = box(ch.cx, ch.cy, ch.ang, hl + 0.2, hd + 0.5, 0, 0, { kind: "cap", shade, chips: chips.map((c) => c * 0.6) });
      const top = Math.min(5.3 + r() * 0.6 + capH, allowedTop(cap) - 0.4 - (moss ? MOSS_H : 0));
      cap.y0 = top - capH;
      cap.y1 = top;
      pieces.push(box(ch.cx, ch.cy, ch.ang, hl, hd, 0, cap.y0, { kind: "block", course: 1, shade, chips, low: true }), cap);
      // A moss strip over part of the cap, off to one side (the cap stays mostly bare stone, V32).
      if (moss) {
        const f = 0.25 + r() * 0.25;
        const off = (r() < 0.5 ? -1 : 1) * hl * (1 - f) * 0.9;
        pieces.push(box(ch.cx - Math.sin(ch.ang) * off, ch.cy + Math.cos(ch.ang) * off, ch.ang, hl * f, hd + 0.1, top, top + MOSS_H, { kind: "moss" }));
      }
      continue;
    }
    // Two courses (the second laid half a block over, below) and a thin coping.
    const cope = COPE(tc);
    const moss = mossy < 0.4;
    const coping = box(ch.cx, ch.cy, ch.ang, hl + 0.1, hd + 0.3, 0, 0, { kind: "coping", shade });
    let c1 = H1(tc);
    let c2 = H2(tc);
    const lim = allowedTop(coping) - 0.4 - (moss ? MOSS_H : 0) - cope;
    if (c2 > lim) {
      c1 *= lim / c2;
      c2 = lim;
    }
    coping.y0 = c2;
    coping.y1 = c2 + cope;
    pieces.push(box(ch.cx, ch.cy, ch.ang, hl, hd, 0, c1, { kind: "block", course: 1, shade, chips }), coping);
    if (moss) pieces.push(box(ch.cx, ch.cy, ch.ang, hl * (0.45 + r() * 0.45), hd, coping.y1, coping.y1 + MOSS_H, { kind: "moss" }));
  }
  // The second course, half a block over: from the centre of each tall block to the next one's.
  for (let k = 0; k < N; k++) {
    if (!tall(k) || gaps.has(k)) continue;
    const k2 = (k + 1) % N;
    const [t0a, t1a] = span(k);
    let s0 = (t0a + t1a) / 2;
    let s1;
    if (tall(k2)) {
      const [t0b, t1b] = span(k2);
      s1 = (t0b + t1b) / 2 + (k2 === 0 ? 2 * Math.PI : 0);
    } else s1 = t1a;
    // The first tall block also carries a half block from its own start.
    const k0 = (k + N - 1) % N;
    const parts = [[s0, s1]];
    if (!tall(k0)) parts.unshift([t0a, s0]);
    for (const [u0, u1] of parts) {
      const tc = wrap((u0 + u1) / 2);
      const rIn = wallR(tc);
      const depth = 6.2 + r() * 1.0;
      const ch = chord(u0, u1, rIn, depth, (r() - 0.5) * 0.5, (r() - 0.5) * 2 * DEG);
      const y0 = Math.min(H1(wrap(u0)), H1(wrap(u1)), H1(tc));
      // Under its coping, which the first pass sized to the rule.
      const under = pieces.filter((p) => p.kind === "coping" && hyp(p.cx - ch.cx, p.cy - ch.cy) < 16).map((p) => p.y0);
      const y1 = under.length ? Math.min(...under) : H2(tc);
      if (y1 - y0 < 1) continue;
      pieces.push(box(ch.cx, ch.cy, ch.ang, ch.len / 2 - 0.15, depth / 2, y0, y1, { kind: "block", course: 2, shade: Math.floor(r() * 3), chips: Array.from({ length: 8 }, () => (r() < 0.12 ? 0.9 + r() * 0.7 : 0)) }));
    }
  }
  // The pillar (V36): four stacked blocks and a cap, on the terrace behind the back-left wall.
  const [px, py] = at(PILLAR.r, PILLAR.th);
  const pa = Math.PI / 4 + PILLAR.th * DEG;
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const hh = PILLAR.h / 4.6 + (r() - 0.5) * 0.6;
    const w = PILLAR.w / 2 - 0.2 + r() * 0.3;
    pieces.push(box(px + (r() - 0.5) * 0.3, py + (r() - 0.5) * 0.3, pa + (r() - 0.5) * 0.08, w, w, y, y + hh, { kind: "pillar", shade: Math.floor(r() * 3), chips: Array.from({ length: 8 }, () => (r() < 0.2 ? 0.8 : 0)) }));
    y += hh;
  }
  pieces.push(box(px, py, pa, PILLAR.w / 2 + 0.5, PILLAR.w / 2 + 0.5, y, y + 1.4, { kind: "cap", shade: 1, chips: [] }));
  return { pieces, mounds };
}

// --- the whole garden ---------------------------------------------------------------------------------

const cache = new Map();

/**
 * The garden for a seed: every prop's place and size, the wall's pieces, the foliage volumes and
 * the 16 fade groups. The same seed always gives the same garden (the view's own rng, never
 * world.rand). Cached: callers must not change what they get.
 */
export function gardenLayout(seed = 1, { fresh = false } = {}) {
  if (!fresh && cache.has(seed)) return cache.get(seed);
  const r = rng(seed * 104729 + 17);
  const groups = [];
  const group = (name, kind, x, y, radius, height, parts = null) => {
    const g = { id: groups.length + 1, name, kind, x, z: y, radius, height };
    if (parts) g.parts = parts; // its shape for the fade test (fade3d.js); else a column 0..height
    groups.push(g);
    return g.id;
  };

  const trees = TREES.map((t) => {
    const [x, y] = at(t.r, t.th);
    // A slight lean, mostly outwards (away from the lawn), for the trunk and the canopy above it.
    const la = Math.PI / 4 + t.th * DEG + (r() - 0.5) * 1.2;
    const lean = t.kind === "conifer" ? 0 : 1 + r() * 1.2;
    const topX = x + Math.cos(la) * lean;
    const topY = y + Math.sin(la) * lean;
    const cone = t.kind === "conifer";
    const canopy = cone ? { shape: "cone", x: topX, y: topY, y0: t.bottom, y1: t.bottom + t.h, rx: t.w / 2 } : { shape: "ellipsoid", x: topX, y: topY, cy: t.bottom + t.h / 2, rx: t.w / 2, ry: t.h / 2 };
    const top = cone ? canopy.y1 : canopy.cy + canopy.ry;
    const id = group(t.id, "tree", x, y, t.w / 2 + lean, top);
    // What can hide the fight, as upright columns (fade3d.js): the root flare, the trunk up to the
    // canopy, and the canopy itself from its bottom up — the lawn under a canopy stays seen.
    groups[id - 1].parts = [
      { x, z: y, r: t.flare, y0: 0, y1: 1 },
      { x: (x + topX) / 2, z: (y + topY) / 2, r: t.base * 1.2 + lean / 2, y0: 0, y1: t.bottom },
      cone ? { x: topX, z: topY, r: t.w / 2, y0: t.bottom, y1: top } : { x: topX, z: topY, r: canopy.rx, cy: canopy.cy, ry: canopy.ry },
    ];
    // Apples on the camera-facing, upper half of the canopy (4.7).
    const apples = [];
    for (let i = 0; i < t.apples; i++) {
      let dx;
      let dy;
      let dz;
      do {
        dx = r() * 2 - 1;
        dy = r() * 1.6 - 0.5;
        dz = r() * 2 - 1;
      } while (dx * dx + dy * dy + dz * dz > 1 || dx + dz < 0.2);
      const n = hyp(dx, dy, dz) || 1;
      apples.push({ x: canopy.x + (dx / n) * canopy.rx * 0.97, y: canopy.y + (dz / n) * canopy.rx * 0.97, h: canopy.cy + (dy / n) * canopy.ry * 0.97 });
    }
    return { ...t, x, y, topX, topY, group: id, fade: true, canopy, apples, seed: Math.floor(r() * 1e9) };
  });

  const lanterns = LANTERNS.map(([name, rr, th]) => {
    const [x, y] = at(rr, th);
    return { id: name, r: rr, th, x, y, group: group(name, "lantern", x, y, LANTERN.roof * 0.71, LANTERN.height), fade: true, flame: LANTERN.flame };
  });

  const bushes = BUSHES.map((b) => {
    const [x, y] = at(b.r, b.th);
    return { ...b, x, y, radius: b.w / 2, cy: b.h * 0.45, ry: b.h * 0.55, group: group(b.id, "bush", x, y, b.w / 2, b.h, [{ x, z: y, r: b.w / 2, cy: b.h * 0.45, ry: b.h * 0.55 }]), fade: true, seed: Math.floor(r() * 1e9) };
  });
  const [tx, ty] = at(TOPIARY.r, TOPIARY.th);
  const topiary = { ...TOPIARY, x: tx, y: ty, cy: TOPIARY.radius * 0.96, group: group(TOPIARY.id, "topiary", tx, ty, TOPIARY.radius, TOPIARY.radius * 1.96, [{ x: tx, z: ty, r: TOPIARY.radius, cy: TOPIARY.radius * 0.96, ry: TOPIARY.radius }]), fade: true, seed: Math.floor(r() * 1e9) };

  const { pieces, mounds } = buildWall(seed);
  const lupines = LUPINES.map((l) => {
    const [x, y] = at(l.r, l.th);
    return { ...l, x, y, florets: 12 + Math.floor(r() * 5) };
  });
  const clovers = [
    ...LAWN_CLOVERS.map(([x, y, s]) => ({ x, y, across: s, yaw: (r() - 0.5) * 60 * DEG })),
    ...BED_CLOVERS.map(([rr, th, s]) => {
      const [x, y] = at(rr, th);
      return { x, y, across: s, yaw: (r() - 0.5) * 60 * DEG };
    }),
  ];
  const hedges = HEDGES.map((h) => {
    const [x, y] = at(h.r, h.th);
    return { ...h, cx: x, cy: y, ang: Math.PI / 4 + h.th * DEG, hl: h.len / 2, hd: h.depth / 2, seed: Math.floor(r() * 1e9) };
  });
  const mossPatches = MOSS_PATCHES.map((th, i) => {
    const t = th * DEG;
    const rr = wallR(t) - 0.3;
    const [x, y] = at(rr, th);
    return { id: `MP${i + 1}`, cx: x, cy: y, ang: Math.PI / 4 + t, hl: 2 + r() * 1.5, hd: 0.5, y0: 2 + r() * 3, y1: 6 + r() * 3, cards: 26 };
  });

  // The foliage volumes: one card generator fills them all (foliage3d.js).
  const foliage = [
    ...trees.map((t) => ({ id: t.id, group: t.group, palette: t.tint, kind: t.kind === "conifer" ? "conifer" : "canopy", ...t.canopy, count: t.cards, seed: t.seed })),
    { id: topiary.id, group: topiary.group, palette: "topiary", kind: "topiary", shape: "ellipsoid", x: tx, y: ty, cy: topiary.cy, rx: topiary.radius, ry: topiary.radius, count: topiary.cards, seed: topiary.seed, floor: 0.4 },
    ...bushes.map((b) => ({ id: b.id, group: b.group, palette: "bush", kind: "bush", shape: "ellipsoid", x: b.x, y: b.y, cy: b.cy, rx: b.radius, ry: b.ry, count: b.cards, seed: b.seed, floor: 0.4, rim: true })),
    ...hedges.map((h) => ({ id: h.id, group: 0, palette: h.lit ? "shrub" : "hedge", kind: "hedge", shape: "box", cx: h.cx, cy: h.cy, ang: h.ang, hl: h.hl, hd: h.hd, y0: 0, y1: h.h, count: h.cards, seed: h.seed })),
    ...mounds.map((m) => ({ id: m.id, group: 0, palette: "hedge", kind: "mound", shape: "mound", cx: m.cx, cy: m.cy, ang: m.ang, hl: m.hl, hd: m.hd, y0: 0, y1: m.h, count: m.cards, seed: Math.floor(r() * 1e9) })),
    ...mossPatches.map((m) => ({ id: m.id, group: 0, palette: "moss", kind: "moss", shape: "box", cx: m.cx, cy: m.cy, ang: m.ang, hl: m.hl, hd: m.hd, y0: m.y0, y1: m.y1, count: m.cards, seed: Math.floor(r() * 1e9) })),
  ];

  // The far hedge ring (4.8): flat dark silhouettes facing the camera, r 220–300. On the camera
  // side they stand further out and lower, so they never cover the front bushes.
  const farHedges = [];
  const FAR_HEDGE_MIN_R = 216; // past the floor's end (210, ground3d.js), on the outer ground
  const NF = 22;
  for (let i = 0; i < NF; i++) {
    const th = -180 + (i + 0.5 + (r() - 0.5) * 0.5) * (360 / NF);
    const front = Math.abs(th) < 60;
    const rr = front ? 272 + r() * 28 : 222 + r() * 78;
    const [x, y] = at(rr, th);
    const w = 60 + r() * 30;
    const H = front ? 18 + r() * 8 : 20 + r() * 20;
    const n = 12;
    const ph = r() * 6.28;
    const tops = [];
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const along = (s - 0.5) * w;
      // Along screen right, which is sim (1, −1)/√2.
      let vx = x + along * Math.SQRT1_2;
      let vy = y - along * Math.SQRT1_2;
      // Off the floor (G3 fix): screen right is not square to the radius, so a hedge's ends could
      // come in to r 186, standing on the lit terrace (the floor runs to 210) as a hard-edged dark
      // box at the frame's corner. Pushed out radially to the outer ground; no random numbers move.
      const vr = Math.hypot(vx, vy);
      if (vr < FAR_HEDGE_MIN_R) (vx *= FAR_HEDGE_MIN_R / vr), (vy *= FAR_HEDGE_MIN_R / vr);
      const env = Math.sqrt(Math.max(0, 1 - Math.pow(2 * s - 1, 4)));
      let h = H * env * (0.72 + 0.18 * Math.sin(ph + s * 9.1) + 0.1 * r());
      h = Math.max(1, Math.min(h, hMaxAt(vx, vy) - 0.4));
      tops.push([vx, vy, h]);
    }
    farHedges.push({ x, y, w, tops, shade: r() });
  }

  const L = { seed, trees, lanterns, bushes, topiary, lupines, clovers, hedges, mounds, mossPatches, pieces, foliage, farHedges, groups };
  if (!fresh) cache.set(seed, L);
  return L;
}

// --- where the grass and flowers go (4.4, 4.5) ------------------------------------------------------------

/**
 * Circles nothing small is rooted inside: trunks, plinths, the topiary, bushes, the pillar, hedges,
 * lupine feet, and the clovers. A clover's circle is its leaves' reach (across / 2) and is marked
 * (a fourth entry, true): whatever grows beside it must clear it with its own reach too, a
 * flower's head or a tuft's blade tips, so the clovers stand clear as in the target (M4b step 6;
 * M4a let a daisy head cover C2's right leaf). The clovers are the only circles inside the lawn.
 * Clearing the circle on the ground is not enough on screen (a head 2 up on its stem, on the
 * camera's side, still drew over a clover's near leaves): scatter also keeps each flower and tuft
 * off every clover as the camera sees them (coversClover).
 */
function keepOut(L) {
  const c = [];
  for (const k of L.clovers) c.push([k.x, k.y, k.across / 2, true]);
  for (const t of L.trees) c.push([t.x, t.y, t.flare + 0.4]);
  for (const l of L.lanterns) c.push([l.x, l.y, (LANTERN.plinth / 2) * Math.SQRT2 + 0.3]);
  for (const b of L.bushes) c.push([b.x, b.y, b.radius * 0.75]);
  c.push([L.topiary.x, L.topiary.y, L.topiary.radius * 0.9]);
  for (const h of L.hedges) c.push([h.cx, h.cy, hyp(h.hl, h.hd) * 0.8]);
  for (const l of L.lupines) c.push([l.x, l.y, 2]);
  const [px, py] = at(PILLAR.r, PILLAR.th);
  c.push([px, py, PILLAR.w * 0.75 + 0.4]);
  return c;
}
/** Rings where the grass grows thick: round the feet of bushes, trunks, plinths and the topiary. */
function thickRings(L) {
  return [...L.trees.map((t) => [t.x, t.y, t.flare]), ...L.lanterns.map((l) => [l.x, l.y, 4.5]), ...L.bushes.map((b) => [b.x, b.y, b.radius]), [L.topiary.x, L.topiary.y, L.topiary.radius]];
}

/** Seeded smooth value noise in 0..1, for patchy density (a stand-in for the sun mask's dapple edges). */
function makeNoise(rand, cell = 26) {
  const N = 32;
  const v = Float32Array.from({ length: N * N }, () => rand());
  const at2 = (i, j) => v[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  return (x, y) => {
    const fx = x / cell + 500;
    const fy = y / cell + 500;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    let tx = fx - i;
    let ty = fy - j;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = at2(i, j) + (at2(i + 1, j) - at2(i, j)) * tx;
    const b = at2(i, j + 1) + (at2(i + 1, j + 1) - at2(i, j + 1)) * tx;
    return a + (b - a) * ty;
  };
}

/** The tallest a tuft or flower rooted at (x, y), reaching `reach` sideways, may be outside the lawn. */
function coverLimit(x, y, reach) {
  // Nothing on the back half (or far round the flanks) can hide the lawn: skip the ring.
  if (Math.abs(thetaOf(x, y)) > 100 * DEG) return Infinity;
  let m = hMaxAt(x, y);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 2 * Math.PI;
    m = Math.min(m, hMaxAt(x + Math.cos(a) * reach, y + Math.sin(a) * reach));
  }
  return m;
}
/** Where a tuft's blade tips can reach, as a multiple of its clump radius (blades lean out). */
export const TUFT_REACH = 1.3;

// The camera's screen axes (camera3d.js RIGHT, UP): a ground point (x, y) at height h lands at
// toScreen(x, y, h). A ground step towards the camera (along x + y) moves down the screen by GV
// (0.5) per unit, and height moves up it by HV (0.87): so a flower's head on its stem shows well
// above its root, and a keep-out circle on the ground cannot keep it off a clover on screen.
const GV = Math.hypot(UP[0], UP[2]);
const HV = UP[1];
export const toScreen = (x, y, h = 0) => [x * RIGHT[0] + y * RIGHT[2], x * UP[0] + y * UP[2] + h * HV];

/**
 * Whether a shape drawn near clover k covers any of it on screen. The clover draws inside its
 * leaves' reach on the ground (across / 2) swept up to cloverTop: on screen, an ellipse R across
 * and R·GV tall swept up by cloverTop·HV. The shape is an ellipse ra across and rv tall centred at
 * screen (a, v) and swept `down` the screen from there (a stem or blades reaching to the ground).
 * The ellipse of the summed half-axes holds the two shapes' whole Minkowski sum (support functions
 * add, and the ellipse norm is subadditive), so no overlap is ever missed.
 */
export function coversClover(k, a, v, ra, rv, down) {
  const [ca, cv] = toScreen(k.x, k.y);
  const R = k.across / 2;
  const da = a - ca;
  const dv0 = v - cv;
  const dv = dv0 - Math.max(0, Math.min(cloverTop(k.across) * HV + down, dv0));
  return (da / (R + ra)) ** 2 + (dv / (R * GV + rv)) ** 2 < 1;
}

/**
 * A ground flower's parts on screen, as discs [a, v, r, down] (flowerGeo, flowerInstances): the head
 * card (head wide, its centre on the stem's top, half a head plus the sway), the stem (0.32 wide,
 * swept to the ground) and the leaf card (0.55 head, at 0.3 of it right, 0.1 towards the camera and
 * 0.15 up; its tilted, turned card within 0.68 of its size, the instance's ±20° yaw within 0.1 more).
 */
export function flowerDiscs(x, y, head, stem) {
  const [a, v] = toScreen(x, y, stem);
  const lf = head * 0.55;
  const F = Math.SQRT1_2;
  const [la, lv] = toScreen(x + (RIGHT[0] * 0.3 + F * 0.1) * lf, y + (RIGHT[2] * 0.3 + F * 0.1) * lf, 0.15 * lf);
  return [
    [a, v, head / 2 + SWAY, 0],
    [a, v, 0.16 + SWAY, stem * HV],
    [la, lv, lf * 0.78, 0],
  ];
}
/** A tuft on screen: its blade tips' reach on the ground (plus the sway) swept up to its height h. */
export function tuftShape(x, y, cr, h) {
  const reach = cr * TUFT_REACH + SWAY;
  const [a, v] = toScreen(x, y, h);
  return [a, v, reach, reach * GV, h * HV];
}

/**
 * Scatter the grass tufts and the flowers. `rand` is a seeded rng; `counts` = { tufts, flowers }.
 * A tier's tufts are the first N of any larger count (their own random stream), so the instance
 * count can drop mid-fight. Returns { tufts: [{x, y, h, cr, yaw, tone}], flowers: [{x, y, z, kind,
 * head, stem, tilt, top, group, lawn}] }. Heights are what the geometry builds: a tuft's tips reach
 * h; a flower's head card tops out at `top` above the ground.
 */
export function scatter(rand, counts, L = gardenLayout(1)) {
  const rt = rng(Math.floor(rand() * 4294967296));
  const rf = rng(Math.floor(rand() * 4294967296));
  const noise = makeNoise(rng(Math.floor(rand() * 4294967296)));
  const out = keepOut(L);
  const rings = thickRings(L);
  // Every keep-out circle but the clovers' lies past the lawn, so lawn points test only those.
  // `reach` is how far the thing rooted at (x, y) spreads sideways: it must clear a clover by that.
  const lawnOut = out.filter((c) => c[3]);
  const blocked = (x, y, pad = 0, reach = 0) => (x * x + y * y > 110 * 110 ? out : lawnOut).some(([cx, cy, cr, clover]) => hyp(x - cx, y - cy) < cr + pad + (clover ? reach : 0));
  // ...and nothing rooted near a clover may draw over it on screen: `shapes` are [a, v, ra, rv,
  // down] (coversClover). Only clovers within 16 of the root can be reached (a stem is at most 3,
  // a head 5.5 across, a clover 12.7).
  const onClover = (x, y, shapes) => L.clovers.some((k) => hyp(x - k.x, y - k.y) < k.across / 2 + 16 && shapes.some(([a, v, ra, rv, down]) => coversClover(k, a, v, ra, rv, down)));
  const flowerOnClover = (x, y, head, stem) => onClover(x, y, flowerDiscs(x, y, head, stem).map(([a, v, r, down]) => [a, v, r, r, down]));
  const underWall = (x, y) => {
    const rr = hyp(x, y);
    const rw = wallR(thetaOf(x, y));
    return rr > rw - 0.6 && rr < rw + WALL_DEPTH + 0.6;
  };

  // Tufts come from four places, each drawn directly (no wasted tries over the empty terrace): the
  // lawn (sparse in the fighting middle, thicker towards its edge and in patches), the bed (thick),
  // the foot of the wall's outer face, and rings round the feet of bushes, trunks, plinths and the
  // topiary. Each tuft picks its place at random, so any first N of them are spread the same way.
  const ZONES = [0.55, 0.28, 0.085, 0.085];
  const tufts = [];
  for (let guard = 0; tufts.length < counts.tufts && guard < counts.tufts * 40; guard++) {
    const zu = rt();
    const a = rt() * 2 * Math.PI;
    const u = rt();
    const cr = 0.75 + rt() * 0.75;
    const yaw = (rt() - 0.5) * 50 * DEG;
    const tone = rt();
    const hr = rt();
    const keep = rt();
    let x;
    let y;
    if (zu < ZONES[0]) {
      const rr = ARENA.R * Math.sqrt(u);
      x = rr * Math.cos(a);
      y = rr * Math.sin(a);
      if (keep > (0.05 + 0.2 * smooth(78, 116, rr) + 0.2 * smooth(0.58, 0.8, noise(x, y))) / 0.45) continue;
    } else if (zu < ZONES[0] + ZONES[1] + ZONES[2]) {
      const rw = wallR(wrap(a - Math.PI / 4));
      const rr = zu < ZONES[0] + ZONES[1] ? Math.sqrt(ARENA.R * ARENA.R + u * (rw * rw - ARENA.R * ARENA.R)) : rw + WALL_DEPTH + 0.7 + u * 6 * u;
      x = rr * Math.cos(a);
      y = rr * Math.sin(a);
    } else {
      const [cx, cy, crr] = rings[Math.floor(keep * rings.length)];
      const d = crr + u * u * 6;
      x = cx + d * Math.cos(a);
      y = cy + d * Math.sin(a);
      if (hyp(x, y) > 196) continue;
    }
    const rr = hyp(x, y);
    if (underWall(x, y) || blocked(x, y, cr * 0.5, cr * (TUFT_REACH - 0.5))) continue;
    let h;
    if (rr < R_FLAT) h = rr < 80 ? 0.7 + hr * 0.45 : 0.8 + hr * 0.5;
    else {
      h = 1.3 + 2.6 * Math.pow(hr, 0.8);
      h = Math.min(h, coverLimit(x, y, cr * TUFT_REACH + SWAY) - 0.1);
      if (h < 0.6) continue;
    }
    if (onClover(x, y, [tuftShape(x, y, cr, h)])) continue;
    tufts.push({ x, y, h, cr, yaw, tone });
  }

  // Flowers: some along the lawn's edge (as in bog.png), some on the front bushes, the rest in the
  // bed and at the terrace's edges.
  const flowers = [];
  const total = counts.flowers;
  const nLawn = Math.round(total * 0.19);
  const nBush = Math.min(L.bushes.reduce((s, b) => s + b.flowers, 0), Math.round(total * 0.16));
  const kindOf = (u, front) => (u < 0.55 ? "daisy" : u < 0.85 || !front ? "buttercup" : "cosmos");
  const HEAD = { daisy: 5, buttercup: 3, cosmos: 4.4 };
  const sinT = Math.sin(FLOWER_TILT * DEG);
  for (let guard = 0; flowers.length < nLawn && guard < 5000; guard++) {
    const a = rf() * 2 * Math.PI;
    const rr = 100 + rf() * 17;
    const x = rr * Math.cos(a);
    const y = rr * Math.sin(a);
    const kind = rf() < 0.65 ? "daisy" : "buttercup";
    const head = HEAD[kind] * (0.85 + rf() * 0.15);
    const stem = Math.min(2.1, LAWN_CAP.flower - (head / 2) * sinT - 0.02) * (0.7 + rf() * 0.3);
    if (blocked(x, y, 1, head / 2) || flowerOnClover(x, y, head, stem)) continue;
    flowers.push({ x, y, z: 0, kind, head, stem, tilt: FLOWER_TILT, top: stem + (head / 2) * sinT, group: 0, lawn: true });
  }
  let left = nBush;
  for (const b of L.bushes) {
    for (let i = 0; i < b.flowers && left > 0; i++, left--) {
      // On the bush's upper, camera-facing side.
      let dx;
      let dy;
      let dz;
      do {
        dx = rf() * 2 - 1;
        dy = rf();
        dz = rf() * 2 - 1;
      } while (dx * dx + dy * dy + dz * dz > 1 || dx + dz < 0.3 || dy < 0.2);
      const n = hyp(dx, dy, dz);
      const kind = rf() < 0.6 ? "daisy" : "cosmos";
      const head = HEAD[kind] * (0.8 + rf() * 0.2);
      const z = b.cy + (dy / n) * b.ry * 0.95;
      const stem = 0.3 + rf() * 0.4;
      flowers.push({ x: b.x + (dx / n) * b.radius * 0.95, y: b.y + (dz / n) * b.radius * 0.95, z, kind, head, stem, tilt: FLOWER_TILT, top: z + stem + (head / 2) * sinT, group: b.group, lawn: false });
    }
  }
  for (let guard = 0; flowers.length < total && guard < 20000; guard++) {
    const a = rf() * 2 * Math.PI;
    const th = wrap(a - Math.PI / 4);
    const rw = wallR(th);
    const bed = rf() < 0.7;
    const rr = bed ? R_FLAT + 0.5 + rf() * (rw - R_FLAT - 1.5) : rw + WALL_DEPTH + 1 + rf() * 6;
    const x = rr * Math.cos(a);
    const y = rr * Math.sin(a);
    const kind = kindOf(rf(), Math.abs(th) < 60 * DEG);
    const head = HEAD[kind] * (0.8 + rf() * 0.2);
    let stem = 1.5 + rf() * 1.5;
    if (blocked(x, y, 1, head / 2)) continue;
    const lim = coverLimit(x, y, head / 2 + SWAY) - (head / 2) * sinT - 0.1;
    if (lim < 0.8) continue;
    stem = Math.min(stem, lim);
    if (flowerOnClover(x, y, head, stem)) continue;
    flowers.push({ x, y, z: 0, kind, head, stem, tilt: FLOWER_TILT, top: stem + (head / 2) * sinT, group: 0, lawn: false });
  }
  return { tufts, flowers };
}

// --- the floor's painted decals (M4b step 8) --------------------------------------------------------------

/** The terrace's slab lattice (ground3d.js floorAlbedo, tools/3d/tiles.py): slabs of 10 × 8 on the world axes, grout 8 texels of 12.8 a unit wide. */
export const SLAB = { w: 10, d: 8, grout: 8 / 12.8 };
/**
 * The floor's decals, drawn by the floor shader from atlas cells (albedo; M4b design D-f, their
 * places are G3 picks): { cell, x, y, hx, hy, yaw }. (x, y) is the centre (sim), hx and hy the half
 * size along the decal's own axes, and yaw turns its u axis from sim +x towards +y.
 *   - the engraved slab (V35), snapped onto one slab of the terrace lattice near r 176, θ −147°
 *     (the back-right terrace, between T1's canopy and L1's cap in the reference framing and near
 *     the middle of the wide one; the design's θ −140° put it at the frame's right edge), inset by
 *     half the grout so the tile's own grout still frames it. u runs along +x and v along +y, as
 *     the cut maps the painted rhombus (tools/3d/cuts.py slab_engraved).
 *   - four stepping stones (V36) on the front terrace, r 183–189, θ −12.5° to −21.5°, in front of
 *     BB2 (the design's back-left arc, θ 150–162°, lies off screen in the reference framing and at
 *     the wide one's left edge behind H1). Their cells are painted on screen (the stone's top face
 *     stretched to a circle), so u runs along screen right: yaw −45°. `rim` darkens the floor
 *     just round a round decal towards the contact colour (the stone set into the terrace), and
 *     `tone` scales its albedo (1 if absent): the painted stones came out twice the terrace's
 *     linear brightness, pale discs where the target's stepping stones are dark grey.
 * At most 5 (the floor shader's uniform arrays).
 */
export const FLOOR_DECALS = (() => {
  const [sx, sy] = at(176, -147);
  const cx = (Math.floor(sx / SLAB.w) + 0.5) * SLAB.w;
  const cy = (Math.floor(sy / SLAB.d) + 0.5) * SLAB.d;
  const g = SLAB.grout / 2;
  const slab = { cell: "slabEngraved", x: cx, y: cy, hx: SLAB.w / 2 - g, hy: SLAB.d / 2 - g, yaw: 0 };
  const stones = [
    [183, -12.5, 3.3],
    [188, -15.5, 3.0],
    [183.5, -18.5, 3.4],
    [189, -21.5, 3.1],
  ].map(([r, th, rad], i) => {
    const [x, y] = at(r, th);
    return { cell: `step${i}`, x, y, hx: rad, hy: rad, yaw: -Math.PI / 4, rim: 0.8, tone: 0.6 };
  });
  return [slab, ...stones];
})();

// --- what the layout tests read ---------------------------------------------------------------------------

/** A clover's highest point: its leaves' far edges, plus the dome, scaled from the big clover. */
export const cloverTop = (across) => (across / CLOVER.across) * (2 * CLOVER.leafR * Math.sin(CLOVER.tilt * DEG) + CLOVER.dome);

/** Every solid footprint: { id, kind, minR } with its nearest point to the centre. */
export function solidFootprints(L) {
  const fp = [];
  const circle = (id, kind, x, y, rad) => fp.push({ id, kind, minR: hyp(x, y) - rad });
  const poly = (id, kind, pts) => {
    let m = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      m = Math.min(m, hyp(ax + dx * t, ay + dy * t));
    }
    fp.push({ id, kind, minR: m });
  };
  for (const t of L.trees) circle(t.id, "trunk", t.x, t.y, t.flare);
  const h = LANTERN.plinth / 2;
  for (const l of L.lanterns)
    poly(l.id, "plinth", [
      [l.x - h, l.y - h],
      [l.x + h, l.y - h],
      [l.x + h, l.y + h],
      [l.x - h, l.y + h],
    ]);
  circle(L.topiary.id, "topiary", L.topiary.x, L.topiary.y, L.topiary.radius);
  for (const b of L.bushes) circle(b.id, "bush", b.x, b.y, b.radius);
  L.pieces.forEach((p, i) => poly(`${p.kind}${i}`, p.kind, boxCorners(p)));
  for (const hd of L.hedges) poly(hd.id, "hedge", boxCorners(hd));
  for (const m of L.mounds) poly(m.id, "mound", boxCorners(m));
  return fp;
}

/**
 * Every point of every opaque prop that does not fade, as { id, x, y, h }: the wall's pieces (their
 * plan outline at the top, densely), the pillar, the hedges, mounds and moss patches (their volume
 * plus the reach of their cards), the lupines, the far hedge cards, and the scattered ground cover
 * outside the lawn. None may hide ground inside r 116 (4.11).
 */
export function opaqueSamples(L, scat) {
  const s = [];
  for (const p of L.pieces) for (const [x, y] of outline(p, 1)) s.push({ id: p.kind, x, y, h: p.y1 });
  for (const v of L.foliage) {
    if (v.group || v.shape === "ellipsoid" || v.shape === "cone") continue;
    const m = CARD[v.kind][1] * 0.71 + SWAY;
    for (const [x, y] of outline({ ...v, hl: v.hl + m, hd: v.hd + m }, 1)) s.push({ id: v.id, x, y, h: v.y1 + m });
  }
  const fm = LUPINE.floret * 0.71 + LUPINE.jitter + SWAY; // a floret card's reach
  const lm = LUPINE.leaf * 0.71 + SWAY;
  for (const l of L.lupines)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      s.push({ id: l.id, x: l.x + Math.cos(a) * fm, y: l.y + Math.sin(a) * fm, h: l.h + fm });
      s.push({ id: l.id, x: l.x + Math.cos(a) * lm, y: l.y + Math.sin(a) * lm, h: LUPINE.leafH + lm });
    }
  for (const f of L.farHedges) for (const [x, y, h] of f.tops) s.push({ id: "farHedge", x, y, h });
  for (const c of L.clovers) {
    if (hyp(c.x, c.y) < R_FLAT) continue;
    const reach = c.across / 2;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      s.push({ id: "bedClover", x: c.x + Math.cos(a) * reach, y: c.y + Math.sin(a) * reach, h: cloverTop(c.across) });
    }
  }
  if (scat) {
    for (const t of scat.tufts) {
      if (hyp(t.x, t.y) < R_FLAT) continue;
      const reach = t.cr * TUFT_REACH + SWAY;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 2 * Math.PI;
        s.push({ id: "bedTuft", x: t.x + Math.cos(a) * reach, y: t.y + Math.sin(a) * reach, h: t.h });
      }
    }
    for (const f of scat.flowers) {
      if (f.lawn || f.group) continue;
      const reach = f.head / 2 + SWAY;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 2 * Math.PI;
        s.push({ id: "bedFlower", x: f.x + Math.cos(a) * reach, y: f.y + Math.sin(a) * reach, h: f.top });
      }
    }
  }
  return s;
}

/** Everything rooted on the lawn (r < 120), with its height: { kind, x, y, top }. */
export function lawnCover(L, scat) {
  const c = [];
  for (const t of scat.tufts) if (hyp(t.x, t.y) < R_FLAT) c.push({ kind: "tuft", x: t.x, y: t.y, top: t.h });
  for (const k of L.clovers) if (hyp(k.x, k.y) < R_FLAT) c.push({ kind: "clover", x: k.x, y: k.y, top: cloverTop(k.across) });
  for (const f of scat.flowers) if (hyp(f.x, f.y) < R_FLAT && !f.group) c.push({ kind: "flower", x: f.x, y: f.y, top: f.top });
  return c;
}
