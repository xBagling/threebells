// The pixel kit: a named palette, a grid "canvas" you set pixels on, a few organic drawing helpers,
// and a way to turn a grid into something the renderer can blit.
//
// Ported from Pocket Quest's tools/forest/kit.mjs (same palette names, same clump/canopy/ground
// helpers, so the two games look like siblings) with the file-writing parts dropped and outline()
// added.

// ---------------------------------------------------------------------------------------------
// Palette. One short name per colour; sprite grids are arrays of strings, one character per pixel,
// with "." meaning "leave this pixel alone". Multi-character names are used via set()/rect().
// ---------------------------------------------------------------------------------------------
const P = {
  // ink, paper, warm lights
  K: "#120c1a", E: "#161022", w: "#f8f4ea", Y: "#ffd66b", y: "#fff3c4", O: "#f29f38", R: "#d9502f", r: "#b8402c",
  G: "#6fbf5a", g: "#3f8a44", d: "#2a5a30", H: "#b6f5cf", m: "#1b3e24", p: "#ff8fa3",
  B: "#7a4b2a", b: "#a3683a", n: "#4a2c16", V: "#8b6fd8", v: "#5e44a8", q: "#b8b0d6", s: "#e8e2c8", a: "#e9dcc0", A: "#c9b48a",
  // stone and wood, warm and cool
  s1: "#5d5a6e", s2: "#6c6880", s3: "#7a7690", s4: "#4a475a", s5: "#3a3748",
  c1: "#46506e", c2: "#56607e", c3: "#39415c", c4: "#2c3350",
  w1: "#7a4e2c", w2: "#8c5c34", w3: "#6a4224", w4: "#a06a3c", w5: "#4e3018",
  f1: "#8a6a4e", f2: "#9c7a5a", f3: "#7a5c42", f4: "#6a4e38",
  n1: "#0e1230", n2: "#171d48", n3: "#232a60", n4: "#2e2a6a", n5: "#3b2f6e",
  h1: "#2f6a3a", h2: "#3d7e44", h3: "#4f9450", h4: "#265a32",
  t1: "#2d8a86", t2: "#1f6a68", t3: "#44a8a0", sc: "#c9463a", sk: "#f0c49a",
  t: "#2d8a86", T: "#1f6a68", u: "#1f6a68",
  gl: "#ffe7a0", mo: "#eef2ff", bl: "#8fb0ff", fr: "#ff7a2a",
  // moonlit leaves, dark to light
  j1: "#0b1c22", j2: "#11303a", j3: "#1a4642", j4: "#285e4e", j5: "#3f7c5e", j6: "#6aa07a",
  // sunlit leaves
  l1: "#1c3a24", l2: "#2a5430", l3: "#3f7436", l4: "#5f963e", l5: "#8cbc4c", l6: "#c8e070",
  // bark by night and by day
  k1: "#140e14", k2: "#281c24", k3: "#3c2c3a", k4: "#56445a", k5: "#6a6488",
  b1: "#3a2618", b2: "#5a3c24", b3: "#7a5434", b4: "#a07446",
  // night grass, day grass
  e1: "#16302e", e2: "#1e4034", e3: "#28543c", e4: "#366848", e5: "#4c8256",
  g1: "#355e28", g2: "#4a7c30", g3: "#64983a", g4: "#8cb84a", g5: "#bcd86a",
  // moss, water, stone, paths
  z1: "#1f3a2c", z2: "#2e5838", z3: "#4a7a44", z4: "#7aa856",
  q1: "#15304a", q2: "#1e4a66", q3: "#377896", q4: "#86ccd8", q5: "#e2f6ee",
  o1: "#343a4e", o2: "#485068", o3: "#626c88", o4: "#8a94ae",
  x1: "#6a6858", x2: "#8a8872", x3: "#b0ac90",
  p1: "#2e2a3a", p2: "#3e384a", p3: "#524a5e",
  a1: "#9a7a50", a2: "#b89668", a3: "#7a5e3e", a4: "#d4b684",
  // magic
  pk: "#f4a8c0", PK: "#ffe0ea", sp: "#e6fff2", sg: "#8fffd0", mb: "#7ae4ff", mB: "#2e8ab8", ff: "#e4ff8a",

  // ---- Three Bells additions ----
  // The hero: a deep-teal hood over steel, warm leather, a pale blade.
  H1: "#1a4a5a", H2: "#12333f", H3: "#256b78", H4: "#0c2029", // hood / cloak, dark → light
  M1: "#4a4e63", M2: "#6a7089", M3: "#98a0b8", M4: "#33364a", // mail and plate
  L1: "#6b4326", L2: "#8c5a33", L3: "#4a2c18", // leather straps
  BL: "#cfd9e8", Bl: "#9fb0c8", BK: "#eef4ff", // blade: steel, shade, shine
  SK: "#f0c49a", Sk: "#c98f66", // skin
  // Bog: sick greens and swamp browns (Gnasher)
  G1: "#1d3a22", G2: "#2f5c2c", G3: "#487d34", G4: "#6aa03e", G5: "#9ac455",
  GB: "#c9e07a", GP: "#d6f06b", // bog glow, poison
  MU: "#3b3524", Mu: "#4e462f", MU2: "#5f5539",
  // Ember: coals, ash and flame (Sister Cinder)
  F1: "#4a1208", F2: "#8a2408", F3: "#d6500f", F4: "#ff8a1e", F5: "#ffce54", F6: "#fff3c0",
  AS: "#3a3440", As: "#544c5c", AW: "#8b8296",
  // Drowned: deep water, brine and bone (the Drowned King)
  D1: "#0a1c33", D2: "#103c58", D3: "#1d5a7a", D4: "#2f89a6", D5: "#63c2cf", D6: "#b6f0f2",
  CR: "#d8b64a", Cr: "#9a7c2a", // the crown
  // shared: shadow, blood, gold, warning
  SH: "#0a0812", WR: "#ff4d4d", Wr: "#8c1f22", WY: "#ffd24d",
  GD: "#ffcf5a", Gd: "#c99a28",
};
/** A colour name (or a literal #rrggbb) → #rrggbb. */
const hex = (v) => {
  const h = P[v] || v;
  if (typeof h !== "string" || !/^#[0-9a-f]{6}$/i.test(h)) throw new Error(`unknown colour ${v}`);
  return h;
};

// ---------------------------------------------------------------------------------------------
// Deterministic noise, so every sprite looks the same on every machine and every reload.
// ---------------------------------------------------------------------------------------------
import { rng } from "../util.js?v=df092a6";
export { rng };
export const d4 = (x, y) => {
  let h = (Math.round(x) * 374761393 + Math.round(y) * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Pick a shade out of `n` for a value in 0..1, dithered so bands break up. */
export const shadeIdx = (v, n, x, y) => {
  const k = Math.max(0, Math.min(n - 1, v * (n - 1)));
  const i = Math.floor(k);
  return Math.min(n - 1, k - i > d4(x, y) ? i + 1 : i);
};

// ---------------------------------------------------------------------------------------------
// The grid canvas.
// ---------------------------------------------------------------------------------------------
export function canvas(W, H, fill = "_") {
  const grid = Array.from({ length: H }, () => Array(W).fill(fill));
  const set = (x, y, v) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = v;
  };
  const get = (x, y) => grid[Math.round(y)]?.[Math.round(x)];
  /** Paint only where something is already painted (keeps a silhouette). */
  const over = (x, y, v) => {
    const cur = get(x, y);
    if (cur !== undefined && cur !== "_") set(x, y, v);
  };
  const stamp = (rows, ox, oy, sc = 1, map = null) =>
    rows.forEach((row, yy) =>
      [...row].forEach((ch, xx) => {
        if (ch === ".") return;
        const c = map ? map(ch) : ch;
        if (c === null || c === "." || c === undefined) return;
        for (let i = 0; i < sc; i++) for (let j = 0; j < sc; j++) set(ox + xx * sc + i, oy + yy * sc + j, c);
      })
    );
  const rect = (x, y, w, h, v) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, v);
  };
  return { grid, set, get, over, stamp, rect, W, H };
}

/**
 * Tidy a hand-written sprite: every row padded with "." to the widest one, so a miscounted row is a
 * harmless short row rather than a silent misalignment. Throws if a row is *longer* than the first,
 * which is nearly always a real typo.
 */
export function rows(list) {
  const w = Math.max(...list.map((r) => r.length));
  if (list[0].length !== w) throw new Error(`ragged sprite: first row is ${list[0].length}, widest is ${w}`);
  return list.map((r) => r.padEnd(w, "."));
}

// ---------------------------------------------------------------------------------------------
// Shape helpers.
// ---------------------------------------------------------------------------------------------
/** Walk an ellipse; fn gets (x, y, d²-ish 0..1, dx, dy). */
export function ell(c, cx, cy, rx, ry, fn) {
  for (let y = Math.floor(-ry); y <= ry; y++)
    for (let x = Math.floor(-rx); x <= rx; x++) {
      const d = (x / rx) ** 2 + (y / ry) ** 2;
      if (d <= 1) fn(cx + x, cy + y, d, x, y);
    }
}
/** A solid, softly shaded blob: lighter toward the light, darker at the rim. */
export function blob(c, cx, cy, rx, ry, shades, L = [-0.55, -0.83], seed = 1, jitter = 0.16) {
  const r = rng(seed);
  ell(c, cx, cy, rx, ry, (x, y, d, dx, dy) => {
    const s = (dx / rx) * L[0] + (dy / ry) * L[1];
    const v = 0.5 + s * 0.45 - d * 0.16 + (r() - 0.5) * jitter;
    c.set(x, y, shades[shadeIdx(v, shades.length, x, y)]);
  });
}
/** One round leaf/moss clump, lit from L. Straight from the forest kit. */
export function clump(c, cx, cy, rr, shades, seed, L = [-0.6, -0.8]) {
  const r = rng(seed);
  const R = Math.ceil(rr * 1.2 + 1);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const ang = Math.atan2(y, x);
      const edge = rr * (1 + 0.13 * Math.sin(ang * 5 + seed) + 0.07 * Math.sin(ang * 11 + seed * 2));
      const dd = Math.hypot(x, y);
      if (dd > edge) continue;
      const s = (x * L[0] + y * L[1]) / edge;
      let v = 0.46 + s * 0.5 - (dd / edge) * 0.12 + (r() - 0.5) * 0.2;
      let i = shadeIdx(v, shades.length, cx + x, cy + y);
      if (dd > edge - 1.1 && s < 0.1) i = 0;
      c.set(cx + x, cy + y, shades[i]);
    }
}
/** A canopy made of many clumps, lower ones drawn in front. */
export function canopy(c, cx, cy, rx, ry, shades, seed, L, count = 18, size = 0.34) {
  const r = rng(seed);
  const cl = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.82;
    cl.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, ((rx + ry) / 2) * (size + r() * 0.16)]);
  }
  cl.sort((p, q) => p[1] - q[1]).forEach(([x, y, s], i) => clump(c, x, y, s, shades, seed * 31 + i, L));
}
/** A trunk with flaring roots; `lit` is -1 for light on the left, 1 for the right. */
export function trunk(c, x0, x1, top, bottom, shades, lit = -1, flare = 10, seed = 2) {
  const r = rng(seed);
  const cols = Array.from({ length: 200 }, () => r());
  for (let y = top; y < bottom; y++) {
    const f = Math.max(0, y - (bottom - flare)) / flare;
    const ex = f * f * flare * 1.2;
    const L = x0 - ex;
    const R = x1 + ex;
    for (let x = Math.floor(L); x <= R; x++) {
      const u = (x - L) / Math.max(1, R - L);
      let v = lit < 0 ? 1 - u : u;
      v = 0.15 + v * 0.75;
      const cn = cols[(x + 400) % 200];
      if (cn < 0.22 && (y + Math.floor(cn * 40)) % 7 !== 0) v -= 0.3;
      if (x === Math.floor(L) || x >= Math.floor(R)) v = 0;
      c.set(x, y, shades[shadeIdx(v, shades.length, x, y)]);
    }
  }
}
export function tufts(c, n, x0, y0, w, h, shade, seed = 9, avoid = () => false) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + r() * w);
    const y = Math.round(y0 + r() * h);
    if (avoid(x, y)) continue;
    c.set(x, y, shade);
    c.set(x - 1, y - 1, shade);
    c.set(x + 1, y - 1, shade);
    if (r() < 0.5) c.set(x, y - 2, shade);
  }
}
/** Put a 1px dark line round everything painted (the classic pixel-art read at a glance). */
export function outline(c, ink = "K", diagonal = true) {
  const { W, H, grid } = c;
  const add = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y][x] !== "_";
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      const orth = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
      const diag = diagonal && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1));
      if (orth || diag) add.push([x, y]);
    }
  add.forEach(([x, y]) => c.set(x, y, ink));
}
/**
 * Relight a finished grid. fn(x, y) returns [r, g, b] multipliers; anything below 1 darkens, and
 * pulling red and green down further than blue is what makes a scene read as moonlight. Colours
 * are quantised so a whole scene still only uses a few hundred of them.
 */
export function tone(c, fn) {
  const cache = new Map();
  const q = (v) => Math.round(v * 24) / 24;
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const v = c.grid[y][x];
      if (v === "_" || v === undefined) continue;
      const m = fn(x, y);
      if (!m) continue;
      const rm = q(m[0]);
      const gm = q(m[1]);
      const bm = q(m[2]);
      if (rm >= 1 && gm >= 1 && bm >= 1) continue;
      const key = v + "|" + rm + "," + gm + "," + bm;
      let out = cache.get(key);
      if (!out) {
        const h = hex(v);
        const ch = (i, mul) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) * mul)));
        out = "#" + [ch(0, rm), ch(1, gm), ch(2, bm)].map((n) => n.toString(16).padStart(2, "0")).join("");
        cache.set(key, out);
      }
      c.grid[y][x] = out;
    }
}

// ---------------------------------------------------------------------------------------------
// Grids → drawable canvases.
// ---------------------------------------------------------------------------------------------
const CVS = typeof OffscreenCanvas !== "undefined" ? (w, h) => new OffscreenCanvas(w, h) : (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

/** A grid → a 1:1 canvas you can drawImage(). */
function toCanvas(grid) {
  const H = grid.length;
  const W = grid[0].length;
  const cv = CVS(W, H);
  const ctx = cv.getContext("2d", { willReadFrequently: false });
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const cache = new Map();
  const rgb = (v) => {
    let c = cache.get(v);
    if (c) return c;
    const h = hex(v);
    c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    cache.set(v, c);
    return c;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = grid[y][x];
      if (v === "_" || v === undefined) continue;
      const [r, g, b] = rgb(v);
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** A sprite: the canvas plus where its "feet" are, so the world can place it by its ground point. */
export function sprite(grid, ax = 0.5, ay = 1) {
  const cv = toCanvas(grid);
  return { cv, w: cv.width, h: cv.height, ax: Math.round(cv.width * ax), ay: Math.round(cv.height * ay), grid };
}
