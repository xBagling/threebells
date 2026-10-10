// Every weapon and shield the hero can hold (the owner, 2026-10-04: "select different weapons for our hero ...
// a shortsword, a normal sword, longsword, greatsword, colossal sword, scimitar, club, great club, katana, scepter,
// axe, great axe, hammer, great hammer, staff, small shield, medium shield, greatshield"), built by code as the
// sword is (sword3d.js): flat-coloured low-poly parts, the steel in the metal paint, an outline hull.
//
// The frame is the sword's: the origin at the middle of the main grip (where the fist closes), +Z along the
// weapon to its tip or head, +Y across it toward the cutting edge (a punch's line from the knuckles), +X out of
// its flat. A shield's face looks along +Y (out past the knuckles), its height along +Z, its width along X, held
// by the handle at the origin.
//
// Sizes are real ones at the hero's scale (the sword, 9.83 units, is an arming sword of about 90 cm: ~10.9 units
// to the metre), the grips a little long for his large gloves. `strike` is the part that hits, base to tip, in
// the weapon's frame: the hitbox's reach is measured to its tip (content/weapons.js).
import { Group, Mesh, Vector3 } from "./three-lib.js?v=df092a6";
import { outlineMaterial } from "./materials3d.js?v=df092a6";
import { soup, hullOf, ring, COL as SC, makeSword, SWORD, weaponMaterials } from "./sword3d.js?v=df092a6";

const COL = {
  ...SC,
  steelDark: 0x9aa3a8,
  iron: 0x7d848a,
  ironDark: 0x5c6267,
  wood: 0x7a5230,
  woodDark: 0x553820,
  woodLight: 0x9a6a3e,
  leather: 0x4a2c18,
  teal: 0x2c6e68,
  tealDark: 0x1f4f4b,
  crystal: 0x7fc4ff,
  crystalDeep: 0x3f7fd0,
  bone: 0xd9cfb4,
};
const TAU = Math.PI * 2;

/** A solid of revolution round Z: `prof` [{ z, r, rx?, ry?, col }], n sides, the ends capped. */
function lathe(s, prof, n = 8, rot = Math.PI / 8) {
  const rings = prof.map((p) => ({ ...p, pts: ring(n, p.z, p.rx ?? p.r, p.ry ?? p.r, rot) }));
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      s.quad(A.pts[i], A.pts[j], B.pts[j], B.pts[i], A.col, A.col, B.col, B.col);
    }
  }
  const a = rings[0], b = rings[rings.length - 1];
  const ca = [0, 0, a.z], cb = [0, 0, b.z];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (a.r > 1e-4 || a.rx > 1e-4) s.tri(ca, a.pts[j], a.pts[i], a.col);
    if (b.r > 1e-4 || b.rx > 1e-4) s.tri(cb, b.pts[i], b.pts[j], b.col);
  }
}

/** A box centred at c with half sizes h, all faces `col` (or [x, y, z] face colours). */
function box(s, c, h, col, colTop = col) {
  const [cx, cy, cz] = c, [hx, hy, hz] = h;
  const P = (x, y, z) => [cx + x * hx, cy + y * hy, cz + z * hz];
  const f = [
    [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), col],
    [P(-1, 1, -1), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), col],
    [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), col],
    [P(-1, -1, 1), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), col],
    [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), colTop],
    [P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1), colTop],
  ];
  for (const [a, b, c2, d, cl] of f) s.quad(a, b, c2, d, cl);
}

/**
 * A blade along +Z from z0, `len` long: a diamond section (double-edged) or, `single`, an edge on +Y and a
 * thick back on −Y; `w(u)` its width and `t(u)` its thickness along it (u 0..1), `sag` how far its middle line
 * bends toward −Y at the tip (a curved sword's back), `fuller` a darker groove down the first part.
 */
function blade(s, { z0, len, w, t, sag = 0, single = false, fuller = 0.4, tipLen = 0.12, n = 7 }) {
  const curve = (u) => -sag * u * u;
  const sec = (u) => {
    const W = w(u), T = t(u), y0 = curve(u);
    if (!single) return [[0, y0 + W / 2], [-T * 0.45, y0 + W * 0.3], [-T / 2, y0], [-T * 0.45, y0 - W * 0.3], [0, y0 - W / 2], [T * 0.45, y0 - W * 0.3], [T / 2, y0], [T * 0.45, y0 + W * 0.3]];
    return [[0, y0 + W / 2], [-T * 0.35, y0 + W * 0.15], [-T / 2, y0 - W * 0.3], [-T * 0.4, y0 - W / 2], [0, y0 - W / 2 - T * 0.1], [T * 0.4, y0 - W / 2], [T / 2, y0 - W * 0.3], [T * 0.35, y0 + W * 0.15]];
  };
  const us = Array.from({ length: n }, (_, i) => (i / (n - 1)) * (1 - tipLen));
  const rings = us.map((u) => ({ u, z: z0 + u * len, p: sec(u).map(([x, y]) => [x, y, z0 + u * len]) }));
  const edgeIdx = single ? [0] : [0, 4];
  const colAt = (r, j) => (edgeIdx.includes(j) ? SC.edge : !single && (j === 2 || j === 6) && r.u < fuller ? SC.fuller : SC.flat);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      s.quad(A.p[i], A.p[j], B.p[j], B.p[i], colAt(A, i), colAt(A, j), colAt(B, j), colAt(B, i));
    }
  }
  const last = rings[rings.length - 1];
  const tip = [0, curve(1) + (single ? w(1) * 0.3 : 0), z0 + len];
  for (let i = 0; i < 8; i++) s.tri(last.p[i], last.p[(i + 1) % 8], tip, colAt(last, i), colAt(last, (i + 1) % 8), SC.edge);
  const base = rings[0].p;
  for (let i = 1; i < 7; i++) s.tri(base[0], base[i + 1], base[i], SC.flat);
  return { base: [0, 0, z0], tip };
}

/** A flat plate from a convex outline in the Y–Z plane (`pts` [y, z]), `t(y)` thick in X: an axe's head. */
function plate(s, pts, t, col, colEdge = col, edgeY = Infinity) {
  const n = pts.length;
  const cy = pts.reduce((a, p) => a + p[0], 0) / n, cz = pts.reduce((a, p) => a + p[1], 0) / n;
  const top = pts.map(([y, z]) => [t(y) / 2, y, z]);
  const bot = pts.map(([y, z]) => [-t(y) / 2, y, z]);
  const C = (y) => (y >= edgeY ? colEdge : col);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s.tri([t(cy) / 2, cy, cz], top[i], top[j], col, C(pts[i][0]), C(pts[j][0]));
    s.tri([-t(cy) / 2, cy, cz], bot[j], bot[i], col, C(pts[j][0]), C(pts[i][0]));
    s.quad(bot[i], bot[j], top[j], top[i], C(pts[i][0]), C(pts[j][0]), C(pts[j][0]), C(pts[i][0]));
  }
}

/** A curved shield face from a convex outline in the X–Z plane, bowed toward +Y by `bow`, `th` thick. */
function shieldFace(s, pts, { th, bow, yFace, face, rim, rimW }) {
  const n = pts.length;
  const span = Math.max(...pts.map(([x]) => Math.abs(x))) || 1;
  const yOf = (x) => yFace - bow * (x / span) ** 2;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n, cz = pts.reduce((a, p) => a + p[1], 0) / n;
  // an inner outline (the painted field) and the outer (the metal rim)
  const inner = pts.map(([x, z]) => [cx + (x - cx) * (1 - rimW), cz + (z - cz) * (1 - rimW)]);
  const F = ([x, z], dy = 0) => [x, yOf(x) + dy, z];
  const B = ([x, z]) => [x, yOf(x) - th, z];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // (wound to face out: the front toward +Y, the back toward −Y, the rim outward)
    s.tri(F([cx, cz], 0.02), F(inner[i], 0.02), F(inner[j], 0.02), face);
    s.quad(F(inner[j], 0.02), F(inner[i], 0.02), F(pts[i]), F(pts[j]), rim);
    s.quad(F(pts[j]), F(pts[i]), B(pts[i]), B(pts[j]), rim);
    s.tri(B([cx, cz]), B(pts[j]), B(pts[i]), COL.woodDark);
  }
}

/** Studs (small boxes) on a shield's face at [x, z] points. */
function studs(s, at, yOf, size, col) {
  for (const [x, z] of at) box(s, [x, yOf(x) + size * 0.6, z], [size, size * 0.6, size], col);
}

/** A grip column round Z from lo to hi, a darker wrap band in the middle, and a pommel below. */
function grip(o, lo, hi, r, { wrap = COL.wrap, col = COL.grip, pommel = "ball", pr = 0.25, pcol = COL.gold } = {}) {
  const m1 = lo + (hi - lo) * 0.33, m2 = lo + (hi - lo) * 0.66;
  lathe(o, [{ z: lo, r, col }, { z: m1, r: r * 1.12, col: wrap }, { z: m2, r: r * 1.12, col }, { z: hi, r, col }], 6, Math.PI / 6);
  if (pommel === "ball") lathe(o, [{ z: lo - pr * 1.9, r: 0.0001, col: pcol }, { z: lo - pr * 1.4, r: pr * 0.9, col: pcol }, { z: lo - pr * 0.6, r: pr, col: pcol }, { z: lo, r: pr * 0.55, col: pcol }], 8);
  else if (pommel === "cap") lathe(o, [{ z: lo - pr * 0.6, r: pr, col: pcol }, { z: lo, r: pr * 0.9, col: pcol }], 8);
}

/** A cross-guard across the blade (along Y) at z, `w` wide. */
function crossGuard(o, z, w, r = 0.18, col = COL.gold) {
  box(o, [0, 0, z], [r * 1.1, w / 2, r], col);
  box(o, [0, w / 2 - r * 0.8, z + r * 0.5], [r * 0.9, r * 0.8, r * 0.9], col);
  box(o, [0, -w / 2 + r * 0.8, z + r * 0.5], [r * 0.9, r * 0.8, r * 0.9], col);
}

/** A haft round Z from lo to hi, `r` thick, wood with a couple of iron bands. */
function haft(o, lo, hi, r, { col = COL.wood, band = COL.ironDark, bands = [] } = {}) {
  lathe(o, [{ z: lo, r: r * 1.05, col: band }, { z: lo + 0.25, r, col }, { z: hi - 0.2, r, col }, { z: hi, r: r * 0.95, col }], 7);
  for (const z of bands) lathe(o, [{ z: z - 0.12, r: r * 1.2, col: band }, { z: z + 0.12, r: r * 1.2, col: band }], 7);
}

// (Two-handed, the lower hand is at the foot of the grip, just above the pommel or the haft's end, as Elden Ring holds
// them: set a hand's breadth higher, what stood out below it — 0.8-1.2 — went into his chest, arm and hood through the
// wind-ups and live windows, .scratch/weapons/trace4.mjs.)
/**
 * The weapons' models: each a builder (m: the metal soup, o: the rest) returning what it adds: `strike`
 * [base, tip] (frame points), `len` (pommel to tip), `off` the second hand's place on the grip (z, for a
 * two-handed hold), `shield` { w, h } for a shield. Keyed by model id (content/weapons.js `model`).
 */
const MODELS = {
  shortsword(m, o) {
    grip(o, -0.42, 0.45, 0.19, { pr: 0.22 });
    crossGuard(o, 0.62, 1.9, 0.15);
    const b = blade(m, { z0: 0.72, len: 6.4, w: (u) => 0.7 - 0.12 * u, t: () => 0.16 });
    return { strike: [b.base, b.tip], len: 7.6, off: null };
  },
  longsword(m, o) {
    grip(o, -1.55, 0.5, 0.19, { pr: 0.27 });
    crossGuard(o, 0.75, 2.9, 0.17);
    const b = blade(m, { z0: 0.85, len: 10.2, w: (u) => 0.72 - 0.2 * u, t: () => 0.17 });
    return { strike: [b.base, b.tip], len: 12.6, off: -1.75 };
  },
  greatsword(m, o) {
    // (a grip for two hands side by side, as Elden Ring's Claymore is held: 2.35 long, the hands a fist apart, its foot
    // and pommel 2.8 behind the upper fist went into his belly wherever the blade pointed out from him — one-handed
    // beside a shield in 3.8% of its chain's frames, 0 now; the pommel modest: at 0.32 it stood 0.6 below the lower
    // hand, into his chest in the overheads)
    grip(o, -1.6, 0.55, 0.22, { pr: 0.24, wrap: COL.leather });
    // (a broad cross, as a Claymore's — 3.2, not 3.8: laid edge-on over the shoulder its lower quillon went into his arm)
    crossGuard(o, 0.85, 3.2, 0.22);
    // a ricasso, then the broad blade
    box(m, [0, 0, 1.45], [0.13, 0.42, 0.55], SC.flat);
    const b = blade(m, { z0: 2.0, len: 12.2, w: (u) => 1.05 - 0.25 * u, t: () => 0.24, fuller: 0.55 });
    return { strike: [b.base, b.tip], len: 14.25, off: -1.6 };
  },
  colossal(m, o) {
    // (two hands side by side too: 2.9 long, its pommel 3.4 behind the upper fist — further than his arms reach out from
    // his middle — in his belly at every hit, 7.4% of its one-handed chain's frames, 2.5% now; the pommel 0.26: 0.36 stood
    // 0.7 below the lower hand)
    grip(o, -1.9, 0.6, 0.26, { pr: 0.26, wrap: COL.leather, pcol: COL.ironDark });
    // (2.6 across, not 3.6 or 3.0: the quillon's end reached into his forearm whenever the wrist turned, and, a colossal
    // sword in each hand, into his chest in the recoveries — 2.5% of frames, 1.3% now)
    crossGuard(o, 0.95, 2.6, 0.3, COL.ironDark);
    // a slab of iron: wide, thick, its point blunt
    const b = blade(m, { z0: 1.15, len: 19.0, w: (u) => 2.15 - 0.35 * u, t: () => 0.5, fuller: 0, tipLen: 0.07 });
    return { strike: [b.base, b.tip], len: 21.6, off: -1.9 };
  },
  scimitar(m, o) {
    grip(o, -0.45, 0.5, 0.19, { pr: 0.24, pommel: "cap" });
    crossGuard(o, 0.66, 1.5, 0.14);
    // single-edged, widening toward the tip, swept back
    const b = blade(m, { z0: 0.76, len: 8.4, w: (u) => 0.62 + 0.4 * Math.sin(u * Math.PI * 0.8), t: () => 0.13, sag: 1.1, single: true, tipLen: 0.14 });
    return { strike: [b.base, b.tip], len: 9.6, off: null };
  },
  katana(m, o) {
    // a long two-hand handle (tsuka), a round guard (tsuba), a slim curved single-edged blade
    grip(o, -2.15, 0.5, 0.2, { pr: 0.21, pommel: "cap", wrap: 0x1c1a24, col: 0x2e2b38, pcol: COL.goldDark });
    lathe(o, [{ z: 0.62, r: 0.62, col: COL.goldDark }, { z: 0.74, r: 0.62, col: COL.goldDark }], 10);
    lathe(o, [{ z: 0.74, r: 0.22, col: COL.gold }, { z: 0.96, r: 0.2, col: COL.gold }], 6);
    const b = blade(m, { z0: 0.96, len: 8.8, w: (u) => 0.46 - 0.08 * u, t: () => 0.12, sag: 0.42, single: true, tipLen: 0.08 });
    return { strike: [b.base, b.tip], len: 11.6, off: -1.9 };
  },
  club(m, o) {
    // a cudgel: a short handle swelling into a heavy knotted head
    lathe(o, [{ z: -0.75, r: 0.2, col: COL.woodDark }, { z: 0.6, r: 0.21, col: COL.wood }, { z: 2.4, r: 0.33, col: COL.wood }, { z: 4.6, r: 0.55, col: COL.woodLight }, { z: 6.2, r: 0.62, col: COL.wood }, { z: 6.85, r: 0.38, col: COL.woodDark }], 7);
    for (const [a, z] of [[0, 4.2], [2.1, 5.2], [4.2, 5.8], [1.0, 6.3], [5.2, 4.8]]) box(o, [Math.cos(a) * 0.6, Math.sin(a) * 0.6, z], [0.14, 0.14, 0.16], COL.woodDark);
    return { strike: [[0, 0, 3.8], [0, 0, 6.85]], len: 7.6, off: null };
  },
  greatclub(m, o) {
    // (the hands a hand's breadth apart on the haft, 2.0 — the owner's side view of the great club on the shoulder,
    // 2026-10-05; 1.65 apart the bulky gloves sat as one fist, 2.25 they stood far apart — and in a cut at its very foot;
    // on the shoulder they hold it `carrySlide` higher up, its foot standing out a fist's length below the lower one as in
    // his picture. A longer haft instead, its foot 3.4 below the upper hand, went 0.9 into his chest at the third
    // two-handed sweep's hit: 2.5% of the chain)
    lathe(o, [{ z: -2.4, r: 0.28, col: COL.woodDark }, { z: 1.0, r: 0.3, col: COL.wood }, { z: 5.5, r: 0.55, col: COL.wood }, { z: 10.0, r: 1.15, col: COL.woodLight }, { z: 13.0, r: 1.35, col: COL.wood }, { z: 14.1, r: 0.8, col: COL.woodDark }], 8);
    lathe(m, [{ z: 9.2, r: 1.08, col: COL.ironDark }, { z: 9.6, r: 1.12, col: COL.ironDark }], 8);
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4, z = 10.4 + (i % 4) * 0.85, r = 1.2 + 0.15 * Math.sin(z);
      box(m, [Math.cos(a) * r, Math.sin(a) * r, z], [0.2, 0.2, 0.2], COL.iron);
    }
    return { strike: [[0, 0, 8.5], [0, 0, 14.1]], len: 16.5, off: -2.0, carrySlide: 1.0 };
  },
  scepter(m, o) {
    // a gilded rod, a flanged head and a jewel
    grip(o, -0.6, 0.6, 0.17, { pommel: "ball", pr: 0.24 });
    lathe(m, [{ z: 0.6, r: 0.16, col: COL.gold }, { z: 6.0, r: 0.15, col: COL.gold }, { z: 6.3, r: 0.3, col: COL.goldDark }, { z: 6.6, r: 0.22, col: COL.gold }], 6);
    lathe(m, [{ z: 6.6, r: 0.2, col: COL.gold }, { z: 7.2, r: 0.42, col: COL.gold }, { z: 7.8, r: 0.36, col: COL.goldDark }, { z: 8.1, r: 0.15, col: COL.gold }], 8);
    lathe(o, [{ z: 7.9, r: 0.0001, col: COL.crystal }, { z: 8.25, r: 0.3, col: COL.crystal }, { z: 8.7, r: 0.0001, col: COL.crystalDeep }], 6);
    return { strike: [[0, 0, 6.4], [0, 0, 8.7]], len: 9.5, off: null, flanges: { z: [6.5, 8.0], n: 6 } };
  },
  axe(m, o) {
    haft(o, -0.8, 6.9, 0.2, { bands: [6.2] });
    // a bearded head, the edge on +Y
    plate(m, [[0.1, 5.6], [1.1, 5.0], [2.2, 4.7], [2.45, 5.8], [2.3, 7.1], [1.1, 6.95], [0.1, 6.75]], (y) => 0.42 - 0.13 * y, COL.iron, SC.edge, 2.0);
    box(m, [0, -0.15, 6.2], [0.3, 0.32, 0.65], COL.ironDark);
    return { strike: [[0, 1.6, 4.9], [0, 2.45, 6.9]], len: 7.7, off: null, edgeY: 2.45 };
  },
  greataxe(m, o) {
    haft(o, -3.0, 14.4, 0.3, { bands: [-1.5, 12.0, 13.6] });
    // a double crescent: the big edge on +Y, a smaller one behind
    plate(m, [[0.2, 10.0], [1.6, 9.0], [3.6, 8.4], [4.1, 10.8], [3.7, 13.4], [1.6, 13.3], [0.2, 12.6]], (y) => 0.6 - 0.11 * y, COL.iron, SC.edge, 3.4);
    plate(m, [[-0.2, 10.6], [-1.3, 10.1], [-2.0, 10.9], [-2.0, 12.2], [-1.3, 12.6], [-0.2, 12.2]], (y) => 0.55 + 0.1 * y, COL.iron, SC.edge, -1.8);
    box(m, [0, 0, 11.4], [0.42, 0.4, 1.3], COL.ironDark);
    lathe(m, [{ z: 14.4, r: 0.3, col: COL.iron }, { z: 15.4, r: 0.0001, col: COL.iron }], 6);
    return { strike: [[0, 3.0, 8.6], [0, 4.1, 13.4]], len: 18.4, off: -2.65, edgeY: 4.1 };
  },
  hammer(m, o) {
    haft(o, -0.8, 7.6, 0.19, { bands: [6.6] });
    box(m, [0, 0.45, 7.35], [0.42, 0.95, 0.55], COL.iron, COL.ironDark);
    box(m, [0, 1.45, 7.35], [0.48, 0.12, 0.6], COL.steelDark);
    plate(m, [[-0.4, 7.0], [-1.6, 7.35], [-0.4, 7.7]], () => 0.3, COL.iron);
    return { strike: [[0, 1.0, 6.8], [0, 1.6, 7.9]], len: 8.8, off: null, headY: 1.55 };
  },
  greathammer(m, o) {
    haft(o, -3.0, 14.2, 0.3, { bands: [-1.5, 12.5] });
    box(m, [0, 0.4, 14.0], [1.15, 2.1, 1.25], COL.iron, COL.ironDark);
    box(m, [0, 2.6, 14.0], [1.25, 0.18, 1.35], COL.steelDark);
    box(m, [0, -1.85, 14.0], [1.25, 0.18, 1.35], COL.steelDark);
    lathe(m, [{ z: 15.2, r: 0.4, col: COL.iron }, { z: 16.0, r: 0.0001, col: COL.iron }], 4);
    return { strike: [[0, 1.5, 12.6], [0, 2.75, 15.3]], len: 19.0, off: -2.65, headY: 2.75 };
  },
  staff(m, o) {
    // a gnarled stave crowned with a glowing crystal in a claw, held near its foot as Elden Ring's staves are swung (held
    // at its middle, its foot 7.4 behind the hand went through his belly in every flat cut, and through the live window)
    // (the lower hand at its foot, -2.9 of -3.4: a hand's breadth further down left the foot in his chest through the
    // two-handed flat cuts)
    lathe(o, [{ z: -3.4, r: 0.18, col: COL.woodDark }, { z: 1.0, r: 0.22, col: COL.wood }, { z: 5.5, r: 0.2, col: COL.woodLight }, { z: 10.0, r: 0.24, col: COL.wood }, { z: 11.3, r: 0.32, col: COL.woodDark }], 6);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      box(o, [Math.cos(a) * 0.38, Math.sin(a) * 0.38, 11.6], [0.11, 0.11, 0.45], COL.woodDark);
    }
    lathe(o, [{ z: 11.3, r: 0.0001, col: COL.crystalDeep }, { z: 12.0, r: 0.5, col: COL.crystal }, { z: 12.6, r: 0.42, col: COL.crystal }, { z: 13.5, r: 0.0001, col: COL.crystalDeep }], 6);
    return { strike: [[0, 0, 9.0], [0, 0, 13.5]], len: 16.9, off: -3.15, glow: [0, 0, 12.3] };
  },
  // Shields: the face looks along +Y; held by the handle at the origin.
  buckler(m, o) {
    // a small round dome with a boss, gripped in the fist
    const prof = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4, r = 2.0 * Math.sin((u * Math.PI) / 2) + 0.0001;
      prof.push({ z: 0.75 + 0.55 * Math.cos((u * Math.PI) / 2), r, col: k === 4 ? COL.goldDark : k === 0 ? COL.gold : COL.iron });
    }
    prof.push({ z: 0.65, r: 2.0, col: COL.goldDark }, { z: 0.55, r: 1.85, col: COL.ironDark });
    // (from the back up to the boss, z rising as every other lathe here: the other way round its faces pointed in,
    // lit from inside, and the dome showed black)
    prof.reverse();
    const g0 = soup();
    lathe(g0, prof, 12, 0);
    lathe(g0, [{ z: 1.3, r: 0.55, col: COL.gold }, { z: 1.62, r: 0.32, col: COL.gold }, { z: 1.72, r: 0.0001, col: COL.goldDark }], 8);
    return { strike: null, len: 4.0, off: null, shield: { w: 4.0, h: 4.0, kind: "small" }, turnZtoY: g0 };
  },
  heater(m, o) {
    // a heater shield: flat top, pointed foot, the hero's teal field and a gilt rim
    const pts = [[-2.3, 2.6], [2.3, 2.6], [2.25, 0.4], [1.6, -1.6], [0, -3.1], [-1.6, -1.6], [-2.25, 0.4]];
    shieldFace(m, pts, { th: 0.32, bow: 0.55, yFace: 0.7, face: COL.teal, rim: COL.gold, rimW: 0.1 });
    box(m, [0, 0.82, 0.6], [0.28, 0.12, 1.1], COL.gold);
    box(m, [0, 0.82, 0.6], [1.0, 0.12, 0.26], COL.gold);
    return { strike: null, len: 5.7, off: null, shield: { w: 4.6, h: 5.7, kind: "medium" } };
  },
  greatshield(m, o) {
    // a tower: tall, curved, banded iron over teal planks, rows of studs
    const pts = [[-3.1, 6.6], [-2.2, 7.1], [0, 7.3], [2.2, 7.1], [3.1, 6.6], [3.1, -5.6], [0, -6.0], [-3.1, -5.6]];
    shieldFace(m, pts, { th: 0.5, bow: 1.1, yFace: 0.9, face: COL.tealDark, rim: COL.iron, rimW: 0.07 });
    const yOf = (x) => 0.9 - 1.1 * (x / 3.1) ** 2;
    // a gilt boss strip down the middle, the studs in rows over the curve
    box(m, [0, yOf(0) + 0.06, 0.6], [0.3, 0.1, 6.0], COL.goldDark);
    studs(m, [-2.4, -0.8, 0.8, 2.4].flatMap((x) => [5.0, 0.6, -3.8].map((z) => [x, z])), yOf, 0.16, COL.steelDark);
    return { strike: null, len: 13.3, off: null, shield: { w: 6.2, h: 13.3, kind: "great" } };
  },
};

/**
 * How far a weapon's surface reaches below its own line (−Y, the edge laid down) between `z0` and `z1` along it: what
 * sits on a shoulder when it is carried over one (hero3d.js shoulderCarry), sampled over its triangles.
 */
export function depthBelow(w, z0, z1) {
  let lo = 0;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), q = new Vector3();
  for (const m of w.meshes) {
    const P = m.geometry.attributes.position, I = m.geometry.index;
    const n = I ? I.count : P.count;
    const at = (k, v) => v.fromBufferAttribute(P, I ? I.getX(k) : k);
    for (let t = 0; t < n; t += 3) {
      at(t, a), at(t + 1, b), at(t + 2, c);
      if (Math.max(a.z, b.z, c.z) < z0 || Math.min(a.z, b.z, c.z) > z1) continue;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8 - i; j++) {
        q.copy(a).multiplyScalar(1 - i / 8 - j / 8).addScaledVector(b, i / 8).addScaledVector(c, j / 8);
        if (q.z >= z0 && q.z <= z1) lo = Math.min(lo, q.y);
      }
    }
  }
  return -lo;
}

/**
 * A weapon or shield by model id: the sword's interface (group, base, tip, meshes, hulls, materials, triangles,
 * dispose) plus `info` { len, strike, off, shield }. "sword" is the hero's own sword (sword3d.js), unchanged.
 */
export function makeWeapon(id, look, { slide = 0 } = {}) {
  if (id === "sword") {
    const s = makeSword(look);
    return { ...s, info: { len: SWORD.total, strike: [[0, 0, SWORD.guard], [0, 0, SWORD.tip]], off: null, shield: null } };
  }
  const build = MODELS[id];
  if (!build) throw new Error(`no weapon model "${id}"`);
  const m = soup();
  const o = soup();
  const info = build(m, o);
  const geos = [];
  const { metal, rest } = weaponMaterials(look);
  const add = (s, mat) => {
    const g = s.geometry();
    if (!g.getAttribute("position")?.count) return;
    if (info.turnZtoY) g.rotateX(-Math.PI / 2); // (a dome built round Z, turned to look along +Y)
    geos.push([g, mat]);
  };
  add(m, metal);
  add(o, rest);
  if (info.turnZtoY) {
    const g = info.turnZtoY.geometry();
    g.rotateX(-Math.PI / 2);
    geos.push([g, metal]);
  }
  if (info.flanges) {
    // the scepter's flanges: one plate copied round the rod
    const f = soup();
    for (let i = 0; i < info.flanges.n; i++) {
      const a = (i / info.flanges.n) * TAU, c = Math.cos(a), sn = Math.sin(a);
      const pts = [[0.12, 6.45], [0.78, 6.85], [0.84, 7.6], [0.12, 8.05]];
      const P = (y, z, x) => [x * c - y * sn, x * sn + y * c, z];
      for (let k = 0; k < pts.length; k++) {
        const [y0, z0] = pts[k], [y1, z1] = pts[(k + 1) % pts.length];
        // (wound so the faces point out: the other way round the plates were inside out, a negative volume)
        f.quad(P(y0, z0, -0.06), P(y1, z1, -0.06), P(y1, z1, 0.06), P(y0, z0, 0.06), COL.gold);
      }
      f.tri(P(0.12, 6.45, 0.06), P(0.78, 6.85, 0.06), P(0.84, 7.6, 0.06), COL.gold);
      f.tri(P(0.12, 6.45, 0.06), P(0.84, 7.6, 0.06), P(0.12, 8.05, 0.06), COL.gold);
      f.tri(P(0.12, 6.45, -0.06), P(0.84, 7.6, -0.06), P(0.78, 6.85, -0.06), COL.goldDark);
      f.tri(P(0.12, 6.45, -0.06), P(0.12, 8.05, -0.06), P(0.84, 7.6, -0.06), COL.goldDark);
    }
    geos.push([f.geometry(), metal]);
  }
  // (held at another place along it, `slide`: that place at the hand — a hafted great weapon one-handed at its foot)
  if (slide) for (const [g] of geos) g.translate(0, 0, -slide);
  const group = new Group();
  const meshes = geos.map(([g, mat]) => new Mesh(g, mat));
  const hulls = geos.map(([g]) => new Mesh(hullOf(g), outlineMaterial(look, { color: 0x100f0b, warm: 0x3a3226, px: 1.1 })));
  for (const me of meshes) me.castShadow = true;
  group.add(...meshes, ...hulls);
  const strike = info.strike && slide ? info.strike.map(([x, y, z]) => [x, y, z - slide]) : info.strike;
  const triangles = geos.reduce((a, [g]) => a + g.getAttribute("position").count / 3, 0);
  return {
    group,
    base: strike ? new Vector3(...strike[0]) : new Vector3(0, 0, 0),
    tip: strike ? new Vector3(...strike[1]) : new Vector3(0, 0, info.len / 2),
    meshes,
    hulls,
    materials: [metal, rest],
    triangles,
    info: { len: info.len, strike, off: info.off != null ? info.off - slide : null, shield: info.shield || null, glow: info.glow || null, slide, carrySlide: info.carrySlide ?? 0 },
    dispose() {
      for (const me of [...meshes, ...hulls]) {
        me.geometry.dispose();
        me.material.dispose();
      }
    },
  };
}
