// One card generator for every leafy mass in the garden (docs/3D-PLAN.md 4.7, 4.8): the five tree
// canopies, the topiary, the front bushes, the near hedges, the hedge mounds in the camera-side
// wall and the moss patches on the flank walls. All of it is one InstancedMesh, so one draw in the
// main pass and one in the shadow pass; a per-instance fade group lets a whole tree or bush fade.
//
// Each card is a small alpha-cut cluster of stamped leaves or blossoms (V19). For M4a the clusters
// are drawn by code into a tiny atlas; in M4b (step 5 of the M4b design) each card also names one
// of the owner's painted cells (paint3d.js CARD_CELLS), and when the garden's atlas has them all
// the cards draw those instead. Leaf, conifer, hedge and moss cells are ratio cells: the texel over
// the cell's mean scales the card's M4a colour, so the tuned brightness stays. Blossom cells are
// albedo cells: drawn as painted, times a colour factor that keeps the M4a shading (the teal
// towards the undersides, the dark rim, a little per-card tone). ?paint=0 is exactly the M4a look.
//
// Cards all face halfway between the camera and the sun, so both see them at about 77% of full
// size: the view sees the stamps, and the shadow map sees the same stamps (their gaps become the
// dapples). Their shading normal is not the card's but the mass's: it points out from the volume's
// centre, so a canopy shades like one ball — bright upper right, dark lower left (V27, V29).
import { PlaneGeometry, InstancedBufferAttribute, DoubleSide, Matrix4, Quaternion, Vector3 } from "./three-lib.js?v=8898846";
import { paintMaterial, paintDepth } from "./materials3d.js?v=8898846";
import { BACK, RIGHT, UP } from "./camera3d.js?v=8898846";
import { CARD } from "./layout3d.js?v=8898846";
import { patchPaint, instanced, norm, lin, mix3, mul3, cardAtlas } from "./props3d.js?v=8898846";
import { CARD_CELLS, cellTable, atlasCells } from "./paint3d.js?v=8898846";

const SUN = norm([0, 0.906, -0.423]); // towards the sun (5.2)

/** Math.hypot is slow in V8; the garden is built from many thousands of these. */
const hyp = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c);
const FACE = norm([BACK[0] + SUN[0], BACK[1] + SUN[1], BACK[2] + SUN[2]]);

// The atlas: 2 × 2 cells of 32². 0: leaf cluster (4-point stars), 1: blossom cluster (5-petal
// rounds), 2: conifer sprig, 3: lumpy hedge and moss.
const CELL = 32;
export function clusterAtlas(rand) {
  const S = CELL * 2;
  const data = new Uint8Array(S * S * 4);
  const shapes = {
    star: (dx, dy, r) => Math.pow(Math.abs(dx), 0.8) + Math.pow(Math.abs(dy), 0.8) < Math.pow(r, 0.8),
    petal: (dx, dy, r) => hyp(dx, dy) < r * (0.74 + 0.26 * Math.cos(5 * Math.atan2(dy, dx))),
    needle: (dx, dy, r) => {
      const a = Math.atan2(dy, dx);
      const d = hyp(dx, dy);
      return d < r && Math.abs(Math.sin(3.5 * a)) < 0.45 + 0.6 * (1 - d / r);
    },
    blob: (dx, dy, r) => hyp(dx, dy) < r,
  };
  // A big stamp in the middle and smaller ones round it: the cluster fills most of its cell, so a
  // few hundred cards close a canopy (4.7) while its edge stays jagged.
  const draw = (cx, cy, kind, stamps) => {
    const list = [];
    for (let i = 0; i < stamps; i++) {
      const a = (i / stamps) * 2 * Math.PI + rand() * 0.8;
      const d = i === 0 ? 0 : 6.5 + rand() * 2.5;
      list.push({ x: CELL / 2 + Math.cos(a) * d, y: CELL / 2 + Math.sin(a) * d, r: i === 0 ? 10 + rand() * 2 : 6.5 + rand() * 2, rot: rand() * 6.28, lum: 0.78 + rand() * 0.22 });
    }
    for (let j = 2; j < CELL - 2; j++)
      for (let i = 2; i < CELL - 2; i++) {
        let hit = null;
        for (const s of list) {
          const dx0 = i + 0.5 - s.x;
          const dy0 = j + 0.5 - s.y;
          const dx = dx0 * Math.cos(s.rot) + dy0 * Math.sin(s.rot);
          const dy = -dx0 * Math.sin(s.rot) + dy0 * Math.cos(s.rot);
          if (shapes[kind](dx, dy, s.r)) hit = { s, e: hyp(dx, dy) / s.r };
        }
        if (!hit) continue;
        // Each stamp a flat dab, a touch darker at its edge so overlapping stamps stay apart.
        const v = Math.round(255 * hit.s.lum * (hit.e > 0.7 ? 0.8 : 1));
        const o = ((cy * CELL + j) * S + cx * CELL + i) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
  };
  draw(0, 0, "star", 6);
  draw(1, 0, "petal", 6);
  draw(0, 1, "needle", 5);
  draw(1, 1, "blob", 7);
  return cardAtlas(data, S, S);
}
export const CELLS = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5],
];

// Albedos by palette, from the target's measured colours (V27–V31, V36): light and shade come from
// the lighting, so these sit between the image's lit and mid values. `paint` lists the painted
// cells a card of that entry may draw (the choice rides on the colour's own r(), so the painted
// build draws no extra random numbers and its cards are the flat build's to the bit).
const LEAF = ["leafA", "leafB", "leafC", "leafD"];
const WHITE = ["whiteA", "whiteB", "whiteC", "whiteD"];
const PAL = {
  pink: [{ cols: [0xe8c4c4, 0xd8a8ae, 0xc8909a, 0xf0d8d0, 0xb88088], cell: 1, w: 1, paint: ["pinkA", "pinkB", "pinkC"] }],
  // T2's painted white cells carry their own leaves (about 42% cream, 50% green, 8% gold), so the
  // green entry draws them too, two cards in three, and leaf cells (its M4a green) the third: the
  // flat build's 45% cream cards come out at the same cream share of T2 on screen painted
  // (critique #8, V28; about 13% of the canopy's box either way). Leaf cells alone for the green
  // entry would halve the blossom. G3 fix, both builds: the cream entry went from 45% to 62% of the
  // cards and its yellow #fde9ac to a pink-white #f2e2dc — T2's middle measured 8–11% cream and a
  // warm yellow cast where the target's is 29% cream, white leaning pink (V28).
  white: [
    { cols: [0x5d7a2a, 0x4a6a22, 0x6e7e2c], cell: 0, w: 0.38, paint: [...WHITE, "leafA", "leafC"] },
    { cols: [0xf4ecd8, 0xe8dcc0, 0xf2e2dc], cell: 1, w: 0.62, paint: WHITE },
  ],
  green: [{ cols: [0x4f7a26, 0x3f6a20, 0x5e8a2c], cell: 0, w: 1, paint: LEAF }],
  conifer: [{ cols: [0x3f7634, 0x33662c, 0x4a843a], cell: 2, w: 1, paint: ["conA", "conB", "conC"] }],
  topiary: [{ cols: [0x587c22, 0x4a6e1e, 0x648628], cell: 0, w: 1, paint: LEAF }],
  bush: [{ cols: [0x4a7a28, 0x558230, 0x3e6c22], cell: 0, w: 1, paint: LEAF }],
  hedge: [{ cols: [0x0f2a16, 0x18351a, 0x22401e], cell: 3, w: 1, paint: ["hedgeA", "hedgeB", "hedgeC", "hedgeD"] }],
  shrub: [{ cols: [0x557a22, 0x486218], cell: 0, w: 1, paint: LEAF }],
  moss: [{ cols: [0x5b6a1e, 0x46581a, 0x4e6019], cell: 3, w: 1, paint: ["mossA", "mossB", "mossC"] }],
};
const UNDER = lin(0x06140e); // bush and canopy undersides (#010f0e, V33)
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// Each entry's mean luminance, for the per-card tone of albedo cells.
for (const list of Object.values(PAL)) for (const e of list) e.lum = e.cols.reduce((s, h) => s + lum(lin(h)), 0) / e.cols.length;
// Each palette's mean luminance (its entries weighted): an albedo cell is scaled to it, so a painted
// blossom tree keeps its flat build's brightness whatever its swatch's own mean (pink's is about
// 10% under M4a's pinks; the picked cells also carry a few leaves).
const PAL_LUM = Object.fromEntries(Object.entries(PAL).map(([k, list]) => [k, list.reduce((s, e) => s + e.w * e.lum, 0) / list.reduce((s, e) => s + e.w, 0)]));
/** T2's big five-petal flowers (V28: about 7), spread over its front. */
const BIG_FLOWERS = 7;

/**
 * Every card of every foliage volume in the layout: [{ p, bn, s, col, cell, group, roll, jit,
 * paint, under, rim, tone }]. `cell` is the procedural atlas's cell, `paint` the painted one's
 * name. `share` is the tier's share of cards (Low keeps 60% through a seeded mask, a little larger).
 */
export function foliageCards(L, rng, share = 1) {
  const cards = [];
  for (const v of L.foliage) {
    const r = rng(v.seed);
    const [s0, s1] = CARD[v.kind];
    const pal = PAL[v.palette];
    const grow = share < 1 ? 1 / Math.sqrt(share) : 1;
    const first = cards.length;
    for (let i = 0; i < v.count; i++) {
      const keep = r();
      let p;
      let bn;
      if (v.shape === "ellipsoid") {
        let dx;
        let dy;
        let dz;
        do {
          dx = r() * 2 - 1;
          dy = r() * 2 - 1;
          dz = r() * 2 - 1;
        } while (dx * dx + dy * dy + dz * dz > 1 || dx * dx + dy * dy + dz * dz < 0.02);
        const n = hyp(dx, dy, dz);
        const t = v.kind === "bush" || v.kind === "topiary" ? 0.82 + 0.18 * Math.sqrt(r()) : 0.66 + 0.34 * Math.sqrt(r());
        p = [v.x + (dx / n) * v.rx * t, v.cy + (dy / n) * v.ry * t, v.y + (dz / n) * v.rx * t];
        if (v.floor != null && p[1] < v.floor) p[1] = v.floor + r() * 0.6;
        bn = norm([dx / n / v.rx, dy / n / v.ry + 0.8 / v.ry, dz / n / v.rx]);
      } else if (v.shape === "cone") {
        const u = 1 - Math.sqrt(r());
        const a = r() * 2 * Math.PI;
        const tier = 0.86 + 0.14 * Math.sin(u * Math.PI * 7);
        const rad = v.rx * (1 - u) * tier * (0.72 + 0.28 * Math.sqrt(r()));
        p = [v.x + Math.cos(a) * rad, v.y0 + u * (v.y1 - v.y0), v.y + Math.sin(a) * rad];
        bn = norm([Math.cos(a), (v.rx / (v.y1 - v.y0)) * 1.6 + 0.2, Math.sin(a)]);
      } else {
        // A box (hedges, moss patches) or a half-ellipsoid mound, in its own frame: t along the
        // wall, n out from the centre, and y up.
        const nx = Math.cos(v.ang);
        const nz = Math.sin(v.ang);
        const H = v.y1 - v.y0;
        let lx;
        let ly;
        let lz;
        if (v.shape === "mound") {
          let dx;
          let dy;
          let dz;
          do {
            dx = r() * 2 - 1;
            dy = r();
            dz = r() * 2 - 1;
          } while (dx * dx + dy * dy + dz * dz > 1 || dx * dx + dy * dy + dz * dz < 0.05);
          const n = hyp(dx, dy, dz);
          const t = 0.72 + 0.28 * Math.sqrt(r());
          lx = (dx / n) * v.hl * t;
          ly = (dy / n) * H * t;
          lz = (dz / n) * v.hd * t;
        } else {
          const top = 4 * v.hl * v.hd;
          const sideT = 2 * v.hl * H;
          const sideN = 2 * v.hd * H;
          const u = r() * (top + 2 * sideT + 2 * sideN);
          const a = r() * 2 - 1;
          const b = r();
          if (u < top) [lx, ly, lz] = [a * v.hl, H - r() * 0.8, (r() * 2 - 1) * v.hd];
          else if (u < top + 2 * sideT) [lx, ly, lz] = [a * v.hl, b * H, (u < top + sideT ? 1 : -1) * (v.hd - r() * 0.6)];
          else [lx, ly, lz] = [(u < top + 2 * sideT + sideN ? 1 : -1) * (v.hl - r() * 0.6), b * H, a * v.hd];
        }
        p = [v.cx - nz * lx + nx * lz, v.y0 + ly, v.cy + nx * lx + nz * lz];
        const bx = lx / v.hl;
        const by = v.shape === "mound" ? ly / H + 0.3 : (ly / H) * 1.2 - 0.2;
        const bz = lz / Math.max(v.hd, 1);
        bn = norm([-nz * bx + nx * bz, by + 0.3, nx * bx + nz * bz]);
      }
      // Pick a colour and a cell from the palette.
      let pick = pal[0];
      const pu = r();
      let acc = 0;
      for (const e of pal) {
        acc += e.w;
        if (pu <= acc) {
          pick = e;
          break;
        }
      }
      // One r() picks the colour and, from its fraction, the painted cell (no new r() calls).
      const rc = r() * pick.cols.length;
      const base = lin(pick.cols[Math.floor(rc)]);
      const paint = pick.paint[Math.floor((rc % 1) * pick.paint.length)];
      let col = base;
      let under = 0;
      let rim = 1;
      if (bn[1] < -0.2) col = mix3(col, UNDER, (under = Math.min(1, (-bn[1] - 0.2) * 1.4)));
      if (v.rim) {
        // A near-black rim where the bush's cards thin out towards its silhouette (4.8).
        const f = 1 - Math.abs(bn[0] * BACK[0] + bn[1] * BACK[1] + bn[2] * BACK[2]);
        const k = Math.min(1, Math.max(0, (f - 0.55) / 0.4));
        col = mul3(col, (rim = 1 - 0.4 * k * k * (3 - 2 * k)));
      }
      const size = (s0 + (s1 - s0) * r()) * grow;
      const roll = r() * 2 * Math.PI;
      const jit = [r() - 0.5, r() - 0.5, r() - 0.5];
      if (keep > share) continue;
      // `under` and `rim` are the M4a shading an albedo cell's colour factor keeps (critique #15);
      // `tone` its colour's brightness against its entry's, for a little per-card variety.
      const tone = Math.min(1.15, Math.max(0.85, Math.sqrt(lum(base) / pick.lum)));
      cards.push({ p, bn, s: size, col, cell: pick.cell, group: v.group, roll, jit, paint, under, rim, tone, palLum: PAL_LUM[v.palette], cream: pick.cell === 1 });
    }
    if (v.palette === "white") bigFlowers(v, cards.slice(first), (s0 + 0.7 * (s1 - s0)) * grow);
  }
  return cards;
}

/**
 * T2's big five-petal flowers (V28, "about 7"): the whiteBigA/B cells go to the cream cards most
 * in front, from the camera, of the canopy's outer shell, at least a fifth of its width apart so
 * they spread over it rather than bunch in the middle, and among the largest cards (`minS`; the
 * target's flowers are about 3 units across, and card sizes stay CARD's). Only the painted build
 * draws them.
 */
function bigFlowers(v, cards, minS) {
  const C = [v.x, v.cy, v.y];
  const front = (c) => (c.p[0] - C[0]) * BACK[0] + (c.p[1] - C[1]) * BACK[1] + (c.p[2] - C[2]) * BACK[2];
  const scr = (c) => [0, 1].map((k) => [RIGHT, UP][k].reduce((s, a, i) => s + a * (c.p[i] - C[i]), 0));
  const gap = 0.4 * v.rx;
  const picked = [];
  for (const c of cards.filter((c) => c.cream && c.s >= minS).sort((a, b) => front(b) - front(a))) {
    const s = scr(c);
    if (picked.some((o) => Math.hypot(o.s[0] - s[0], o.s[1] - s[1]) < gap)) continue;
    c.ref = c.paint; // its brightness stays scaled as its white cell's (paintArrays), so the flower stands out
    c.paint = picked.length % 2 ? "whiteBigB" : "whiteBigA";
    picked.push({ c, s });
    if (picked.length === BIG_FLOWERS) break;
  }
}

// A card's turn: facing between the camera and the sun (FACE), rolled about that, then tipped a
// little by its jitter.
const q0 = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...FACE));
const qr = new Quaternion();
const qj = new Quaternion();
const Z = new Vector3(0, 0, 1);
const jitAxis = new Vector3();
export function cardQuat(c, q = new Quaternion()) {
  qr.setFromAxisAngle(Z, c.roll);
  jitAxis.set(c.jit[0], c.jit[1] * 0.5, c.jit[2]).normalize();
  qj.setFromAxisAngle(jitAxis, hyp(c.jit[0], c.jit[2]) * 0.8);
  return q.copy(qj).multiply(q0).multiply(qr);
}

/** The per-card arrays (matrices, colours, ball normals, cells, groups), worked out once per card list. */
function cardArrays(cards) {
  if (cards.arrays) return cards.arrays;
  const n = cards.length;
  const A = { n, mat: new Float32Array(n * 16), col: new Float32Array(n * 3), bn: new Float32Array(n * 3), cell: new Float32Array(n * 2), grp: new Float32Array(n) };
  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const sc = new Vector3();
  cards.forEach((c, i) => {
    cardQuat(c, q);
    m.compose(pos.set(c.p[0], c.p[1], c.p[2]), q, sc.set(c.s, c.s, 1));
    m.toArray(A.mat, i * 16);
    A.col.set(c.col, i * 3);
    A.bn.set(c.bn, i * 3);
    A.cell.set(CELLS[c.cell], i * 2);
    A.grp[i] = c.group;
  });
  cards.arrays = A;
  return A;
}

/**
 * The linear mean of each procedural cell's opaque texels (level 0). The flat build's colour is the
 * card's albedo times these greys (about 0.67–0.80), so the painted build folds the same factor
 * into its colours: a painted ratio cell averages 1 (texel over mean), and without it the painted
 * foliage would come out a quarter to a half brighter than the G1-approved flat look.
 */
export function clusterGrey(atlas) {
  const { data, width: W } = atlas.mipmaps[0];
  const cs = W / 2;
  return CELLS.map(([cu, cv]) => {
    let s = 0;
    let n = 0;
    for (let y = 0; y < cs; y++)
      for (let x = 0; x < cs; x++) {
        const o = ((cv * W + y) * W + cu * W + x) * 4;
        if (data[o + 3] > 127) (s += lin1(data[o])), n++;
      }
    return n ? s / n : 1;
  });
}
const lin1 = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/**
 * The painted build's per-card arrays, cached per atlas (its cells' modes and means): the painted
 * cell's id (CARD_CELLS order) and the instance colour. A ratio cell keeps the card's M4a colour
 * (the texel over the cell's mean adds the painting's detail); an albedo cell (blossom) draws its
 * painted colour times a colour factor — the M4a rim, the per-card tone, and towards the undersides
 * a mix to the teal #06140e over the cell's mean, so a texel near the mean lands on the teal as the
 * flat card does (critique #15; a grey factor would drop the tint) — and scaled so its cell's mean
 * luminance meets its palette's (PAL_LUM, clamped to 0.8–1.25). Both carry the procedural
 * cell's grey (`grey`, clusterGrey), which the flat build's colour is multiplied by.
 */
export function paintArrays(cards, cells, grey) {
  const cache = cards.painted || (cards.painted = new Map());
  let P = cache.get(cells);
  if (P) return P;
  const n = cards.length;
  P = { id: new Float32Array(n), col: new Float32Array(n * 3) };
  const ids = Object.fromEntries(CARD_CELLS.map((name, i) => [name, i]));
  cards.forEach((c, i) => {
    const cell = cells[c.paint];
    const ratio = cell.mode === "ratio";
    const g = grey[c.cell] * (ratio ? 1 : Math.min(1.25, Math.max(0.8, c.palLum / lum(cells[c.ref || c.paint].mean))));
    P.id[i] = ids[c.paint];
    for (let k = 0; k < 3; k++) P.col[i * 3 + k] = g * (ratio ? c.col[k] : c.rim * c.tone * (1 - c.under + (c.under * UNDER[k]) / cell.mean[k]));
  });
  cache.set(cells, P);
  return P;
}

/**
 * The foliage's fill (paintMaterial's fill: linear irradiance added after the shade tint), painted
 * or flat (G3 fix). The sun stands behind the fight, so the side of a canopy the camera sees is
 * mostly its own shadow; under the teal sky alone the pink tree's shade came out dark teal (55% of
 * T0's canopy against the target's 0.5%) and only 20% of it read pink (the target: 55%). A rose
 * leaning fill keeps the shaded blossom a dim mauve-pink, as painted: the pink canopy's middle now measures
 * mean sRGB (0.418, 0.294, 0.228), L 0.316, 54% pink, against the target's (0.423, 0.295, 0.276),
 * 0.321, 55% (.scratch/3d/g3/canopy.py on the target-garden capture). The hedges and bushes take the same
 * fill on their dark greens (a small lift; their tuned albedos set the colour).
 */
export const FOLIAGE_FILL = [0.7, 0.42, 0.5];

/**
 * The foliage mesh: one InstancedMesh of cards with the ball normals, the atlas cells and a
 * shadow twin that sways with the same wind (5.3).
 */
export function buildFoliage(look, cards, atlasRand, paint = null) {
  const own = clusterAtlas(atlasRand);
  const A = cardArrays(cards);
  // Painted only when the garden's atlas has every card cell (paint3d.js cellTable); else M4a.
  const table = cellTable(paint, CARD_CELLS);
  const P = table ? paintArrays(cards, paint.cells, clusterGrey(own)) : null;
  if (P) own.dispose(); // only its greys were needed
  const atlas = P ? paint.atlas : own;
  const geo = new PlaneGeometry(1, 1);
  geo.setAttribute("aBallN", new InstancedBufferAttribute(A.bn, 3));
  geo.setAttribute("aGroup", new InstancedBufferAttribute(A.grp, 1));

  const mat = paintMaterial(look, { map: atlas, alphaTest: 0.5, wind: 2, group: true, fill: FOLIAGE_FILL });
  const depth = paintDepth(look, { wind: 2, map: atlas, alphaTest: 0.5 });
  const ballN = [["#include <common>", "#include <common>\nattribute vec3 aBallN;"], ["#include <defaultnormal_vertex>", "vec3 transformedNormal = normalMatrix * aBallN;"]];
  if (P) {
    // The painted cells: a float cell id under its own name (the flat build's `aCell` is a vec2;
    // one name declared with two types would not compile, critique #2), PlaneGeometry's uv flipped
    // in v (the cell's top row at the card's top), and the same table and texture object on the
    // shadow twin so the dapples are the painted cards' (critique #14: the program key carries the
    // table's size, the attribute and the flip).
    geo.setAttribute("aCardCell", new InstancedBufferAttribute(P.id, 1));
    patchPaint(mat, "cards", { vert: ballN });
    // Read at mip level 3 at most (paint3d.js atlasCells): the wide pull-back keeps the blossom's
    // pink and cream apart from its leaves instead of melting a card into one dull colour.
    for (const m of [mat, depth]) atlasCells(m, table, { attr: "aCardCell", flipV: true, key: "cards", maxLevel: 3, size: paint.atlas.image.width });
  } else {
    geo.setAttribute("aCell", new InstancedBufferAttribute(A.cell, 2));
    const cellUv = ["#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = vMapUv * 0.5 + aCell;"];
    patchPaint(mat, "cards", { vert: [[ballN[0][0], `${ballN[0][1]}\nattribute vec2 aCell;`], ballN[1], cellUv] });
    patchPaint(depth, "cards", { vert: [["#include <common>", "#include <common>\nattribute vec2 aCell;"], cellUv] });
  }
  mat.shadowSide = DoubleSide; // the cards face the sun: the shadow pass must not cull them as back faces
  mat.addEventListener("dispose", () => {
    if (atlas === own) own.dispose(); // only our own clusterAtlas: the painted one is the renderer's, shared
    depth.dispose();
  });

  const mesh = instanced(geo, mat, A.n, { cast: true, receive: true });
  mesh.customDepthMaterial = depth;
  mesh.instanceMatrix.array.set(A.mat);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor = new InstancedBufferAttribute((P ? P.col : A.col).slice(), 3);
  return mesh;
}
