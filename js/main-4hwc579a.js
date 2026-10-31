var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __chunkGraphs;
var __chunkSeen;
var __chunkNonce;
var __preload = (id, seenOnly) => {
  for (var [base, graph, ids] of __chunkGraphs || [])
    for (var stack = [id], g = globalThis, d = g.document, head, j, node, k, link;j = stack.pop(); )
      if (!__chunkSeen[j] && (node = graph[j])) {
        __chunkSeen[j] = 1;
        for (k = 1;k < node.length; k++)
          stack.push(ids[node[k]]);
        if (!seenOnly && j !== id && (head = d && d.head)) {
          if (__chunkNonce === undefined)
            __chunkNonce = (k = d.querySelector("meta[property=csp-nonce]")) && (k.nonce || k.getAttribute("nonce")) || "";
          link = d.createElement("link");
          link.rel = "modulepreload";
          link.crossOrigin = "";
          if (__chunkNonce)
            link.nonce = __chunkNonce;
          link.href = new g.URL(node[0], base);
          head.appendChild(link);
        }
      }
};
var __chunks = (base, ids, nodes, entry) => {
  for (var graph = {}, i = 0;i < ids.length; i++)
    graph[ids[i]] = nodes[i];
  (__chunkGraphs ||= []).push([base, graph, ids]);
  __chunkSeen ||= {};
  __preload(ids[entry], 1);
};

// site/js/util.js
var clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
var lerp = (a, b, t) => a + (b - a) * t;
var TAU = Math.PI * 2;
var angleDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI)
    d -= TAU;
  if (d < -Math.PI)
    d += TAU;
  return d;
};
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = s + 1831565813 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var TICK_EPS = 0.000001;
var reached = (t, at) => t >= at - TICK_EPS;
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0;i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function pickN(list, n, rand) {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length)
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
var msUntilMidnight = () => {
  const d = new Date;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next - d;
};
var roman = (n) => {
  if (!Number.isInteger(n) || n < 1)
    return "";
  let s = "";
  for (const [v, r] of [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]])
    for (;n >= v; n -= v)
      s += r;
  return s;
};
var mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
var untilNext = () => {
  const m = Math.ceil(msUntilMidnight() / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
};
var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

class Html extends String {
}
var raw = (s) => new Html(s == null ? "" : String(s));
var piece = (v) => {
  if (v == null || v === false)
    return "";
  if (v instanceof Html)
    return String(v);
  if (Array.isArray(v))
    return v.map(piece).join("");
  return esc(v);
};
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0;i < values.length; i++)
    out += piece(values[i]) + strings[i + 1];
  return new Html(out);
}

// site/js/gfx/pixel.js
var P = {
  K: "#120c1a",
  E: "#161022",
  w: "#f8f4ea",
  Y: "#ffd66b",
  y: "#fff3c4",
  O: "#f29f38",
  R: "#d9502f",
  r: "#b8402c",
  G: "#6fbf5a",
  g: "#3f8a44",
  d: "#2a5a30",
  H: "#b6f5cf",
  m: "#1b3e24",
  p: "#ff8fa3",
  B: "#7a4b2a",
  b: "#a3683a",
  n: "#4a2c16",
  V: "#8b6fd8",
  v: "#5e44a8",
  q: "#b8b0d6",
  s: "#e8e2c8",
  a: "#e9dcc0",
  A: "#c9b48a",
  s1: "#5d5a6e",
  s2: "#6c6880",
  s3: "#7a7690",
  s4: "#4a475a",
  s5: "#3a3748",
  c1: "#46506e",
  c2: "#56607e",
  c3: "#39415c",
  c4: "#2c3350",
  w1: "#7a4e2c",
  w2: "#8c5c34",
  w3: "#6a4224",
  w4: "#a06a3c",
  w5: "#4e3018",
  f1: "#8a6a4e",
  f2: "#9c7a5a",
  f3: "#7a5c42",
  f4: "#6a4e38",
  n1: "#0e1230",
  n2: "#171d48",
  n3: "#232a60",
  n4: "#2e2a6a",
  n5: "#3b2f6e",
  h1: "#2f6a3a",
  h2: "#3d7e44",
  h3: "#4f9450",
  h4: "#265a32",
  t1: "#2d8a86",
  t2: "#1f6a68",
  t3: "#44a8a0",
  sc: "#c9463a",
  sk: "#f0c49a",
  t: "#2d8a86",
  T: "#1f6a68",
  u: "#1f6a68",
  gl: "#ffe7a0",
  mo: "#eef2ff",
  bl: "#8fb0ff",
  fr: "#ff7a2a",
  j1: "#0b1c22",
  j2: "#11303a",
  j3: "#1a4642",
  j4: "#285e4e",
  j5: "#3f7c5e",
  j6: "#6aa07a",
  l1: "#1c3a24",
  l2: "#2a5430",
  l3: "#3f7436",
  l4: "#5f963e",
  l5: "#8cbc4c",
  l6: "#c8e070",
  k1: "#140e14",
  k2: "#281c24",
  k3: "#3c2c3a",
  k4: "#56445a",
  k5: "#6a6488",
  b1: "#3a2618",
  b2: "#5a3c24",
  b3: "#7a5434",
  b4: "#a07446",
  e1: "#16302e",
  e2: "#1e4034",
  e3: "#28543c",
  e4: "#366848",
  e5: "#4c8256",
  g1: "#355e28",
  g2: "#4a7c30",
  g3: "#64983a",
  g4: "#8cb84a",
  g5: "#bcd86a",
  z1: "#1f3a2c",
  z2: "#2e5838",
  z3: "#4a7a44",
  z4: "#7aa856",
  q1: "#15304a",
  q2: "#1e4a66",
  q3: "#377896",
  q4: "#86ccd8",
  q5: "#e2f6ee",
  o1: "#343a4e",
  o2: "#485068",
  o3: "#626c88",
  o4: "#8a94ae",
  x1: "#6a6858",
  x2: "#8a8872",
  x3: "#b0ac90",
  p1: "#2e2a3a",
  p2: "#3e384a",
  p3: "#524a5e",
  a1: "#9a7a50",
  a2: "#b89668",
  a3: "#7a5e3e",
  a4: "#d4b684",
  pk: "#f4a8c0",
  PK: "#ffe0ea",
  sp: "#e6fff2",
  sg: "#8fffd0",
  mb: "#7ae4ff",
  mB: "#2e8ab8",
  ff: "#e4ff8a",
  H1: "#1a4a5a",
  H2: "#12333f",
  H3: "#256b78",
  H4: "#0c2029",
  M1: "#4a4e63",
  M2: "#6a7089",
  M3: "#98a0b8",
  M4: "#33364a",
  L1: "#6b4326",
  L2: "#8c5a33",
  L3: "#4a2c18",
  BL: "#cfd9e8",
  Bl: "#9fb0c8",
  BK: "#eef4ff",
  SK: "#f0c49a",
  Sk: "#c98f66",
  G1: "#1d3a22",
  G2: "#2f5c2c",
  G3: "#487d34",
  G4: "#6aa03e",
  G5: "#9ac455",
  GB: "#c9e07a",
  GP: "#d6f06b",
  MU: "#3b3524",
  Mu: "#4e462f",
  MU2: "#5f5539",
  F1: "#4a1208",
  F2: "#8a2408",
  F3: "#d6500f",
  F4: "#ff8a1e",
  F5: "#ffce54",
  F6: "#fff3c0",
  AS: "#3a3440",
  As: "#544c5c",
  AW: "#8b8296",
  D1: "#0a1c33",
  D2: "#103c58",
  D3: "#1d5a7a",
  D4: "#2f89a6",
  D5: "#63c2cf",
  D6: "#b6f0f2",
  CR: "#d8b64a",
  Cr: "#9a7c2a",
  SH: "#0a0812",
  WR: "#ff4d4d",
  Wr: "#8c1f22",
  WY: "#ffd24d",
  GD: "#ffcf5a",
  Gd: "#c99a28"
};
var hex = (v) => {
  const h = P[v] || v;
  if (typeof h !== "string" || !/^#[0-9a-f]{6}$/i.test(h))
    throw new Error(`unknown colour ${v}`);
  return h;
};
var d4 = (x, y) => {
  let h = Math.round(x) * 374761393 + Math.round(y) * 668265263 >>> 0;
  h = Math.imul(h ^ h >>> 13, 1274126177) >>> 0;
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
var shadeIdx = (v, n, x, y) => {
  const k = Math.max(0, Math.min(n - 1, v * (n - 1)));
  const i = Math.floor(k);
  return Math.min(n - 1, k - i > d4(x, y) ? i + 1 : i);
};
function canvas(W, H, fill = "_") {
  const grid = Array.from({ length: H }, () => Array(W).fill(fill));
  const set = (x, y, v) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H)
      grid[y][x] = v;
  };
  const get = (x, y) => grid[Math.round(y)]?.[Math.round(x)];
  const over = (x, y, v) => {
    const cur = get(x, y);
    if (cur !== undefined && cur !== "_")
      set(x, y, v);
  };
  const stamp = (rows, ox, oy, sc = 1, map = null) => rows.forEach((row, yy) => [...row].forEach((ch, xx) => {
    if (ch === ".")
      return;
    const c = map ? map(ch) : ch;
    if (c === null || c === "." || c === undefined)
      return;
    for (let i = 0;i < sc; i++)
      for (let j = 0;j < sc; j++)
        set(ox + xx * sc + i, oy + yy * sc + j, c);
  }));
  const rect = (x, y, w, h, v) => {
    for (let j = 0;j < h; j++)
      for (let i = 0;i < w; i++)
        set(x + i, y + j, v);
  };
  return { grid, set, get, over, stamp, rect, W, H };
}
function rows(list) {
  const w = Math.max(...list.map((r) => r.length));
  if (list[0].length !== w)
    throw new Error(`ragged sprite: first row is ${list[0].length}, widest is ${w}`);
  return list.map((r) => r.padEnd(w, "."));
}
function ell(c, cx, cy, rx, ry, fn) {
  for (let y = Math.floor(-ry);y <= ry; y++)
    for (let x = Math.floor(-rx);x <= rx; x++) {
      const d = (x / rx) ** 2 + (y / ry) ** 2;
      if (d <= 1)
        fn(cx + x, cy + y, d, x, y);
    }
}
function blob(c, cx, cy, rx, ry, shades, L = [-0.55, -0.83], seed = 1, jitter = 0.16) {
  const r = rng(seed);
  ell(c, cx, cy, rx, ry, (x, y, d, dx, dy) => {
    const s = dx / rx * L[0] + dy / ry * L[1];
    const v = 0.5 + s * 0.45 - d * 0.16 + (r() - 0.5) * jitter;
    c.set(x, y, shades[shadeIdx(v, shades.length, x, y)]);
  });
}
function clump(c, cx, cy, rr, shades, seed, L = [-0.6, -0.8]) {
  const r = rng(seed);
  const R = Math.ceil(rr * 1.2 + 1);
  for (let y = -R;y <= R; y++)
    for (let x = -R;x <= R; x++) {
      const ang = Math.atan2(y, x);
      const edge = rr * (1 + 0.13 * Math.sin(ang * 5 + seed) + 0.07 * Math.sin(ang * 11 + seed * 2));
      const dd = Math.hypot(x, y);
      if (dd > edge)
        continue;
      const s = (x * L[0] + y * L[1]) / edge;
      let v = 0.46 + s * 0.5 - dd / edge * 0.12 + (r() - 0.5) * 0.2;
      let i = shadeIdx(v, shades.length, cx + x, cy + y);
      if (dd > edge - 1.1 && s < 0.1)
        i = 0;
      c.set(cx + x, cy + y, shades[i]);
    }
}
function canopy(c, cx, cy, rx, ry, shades, seed, L, count = 18, size = 0.34) {
  const r = rng(seed);
  const cl = [];
  for (let i = 0;i < count; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.82;
    cl.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, (rx + ry) / 2 * (size + r() * 0.16)]);
  }
  cl.sort((p, q) => p[1] - q[1]).forEach(([x, y, s], i) => clump(c, x, y, s, shades, seed * 31 + i, L));
}
function trunk(c, x0, x1, top, bottom, shades, lit = -1, flare = 10, seed = 2) {
  const r = rng(seed);
  const cols = Array.from({ length: 200 }, () => r());
  for (let y = top;y < bottom; y++) {
    const f = Math.max(0, y - (bottom - flare)) / flare;
    const ex = f * f * flare * 1.2;
    const L = x0 - ex;
    const R = x1 + ex;
    for (let x = Math.floor(L);x <= R; x++) {
      const u = (x - L) / Math.max(1, R - L);
      let v = lit < 0 ? 1 - u : u;
      v = 0.15 + v * 0.75;
      const cn = cols[(x + 400) % 200];
      if (cn < 0.22 && (y + Math.floor(cn * 40)) % 7 !== 0)
        v -= 0.3;
      if (x === Math.floor(L) || x >= Math.floor(R))
        v = 0;
      c.set(x, y, shades[shadeIdx(v, shades.length, x, y)]);
    }
  }
}
function tufts(c, n, x0, y0, w, h, shade, seed = 9, avoid = () => false) {
  const r = rng(seed);
  for (let i = 0;i < n; i++) {
    const x = Math.round(x0 + r() * w);
    const y = Math.round(y0 + r() * h);
    if (avoid(x, y))
      continue;
    c.set(x, y, shade);
    c.set(x - 1, y - 1, shade);
    c.set(x + 1, y - 1, shade);
    if (r() < 0.5)
      c.set(x, y - 2, shade);
  }
}
function outline(c, ink = "K", diagonal = true) {
  const { W, H, grid } = c;
  const add = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y][x] !== "_";
  for (let y = 0;y < H; y++)
    for (let x = 0;x < W; x++) {
      if (solid(x, y))
        continue;
      const orth = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
      const diag = diagonal && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1));
      if (orth || diag)
        add.push([x, y]);
    }
  add.forEach(([x, y]) => c.set(x, y, ink));
}
function tone(c, fn) {
  const cache = new Map;
  const q = (v) => Math.round(v * 24) / 24;
  for (let y = 0;y < c.H; y++)
    for (let x = 0;x < c.W; x++) {
      const v = c.grid[y][x];
      if (v === "_" || v === undefined)
        continue;
      const m = fn(x, y);
      if (!m)
        continue;
      const rm = q(m[0]);
      const gm = q(m[1]);
      const bm = q(m[2]);
      if (rm >= 1 && gm >= 1 && bm >= 1)
        continue;
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
var CVS = typeof OffscreenCanvas !== "undefined" ? (w, h) => new OffscreenCanvas(w, h) : (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
function toCanvas(grid) {
  const H = grid.length;
  const W = grid[0].length;
  const cv = CVS(W, H);
  const ctx = cv.getContext("2d", { willReadFrequently: false });
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const cache = new Map;
  const rgb = (v) => {
    let c = cache.get(v);
    if (c)
      return c;
    const h = hex(v);
    c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    cache.set(v, c);
    return c;
  };
  for (let y = 0;y < H; y++)
    for (let x = 0;x < W; x++) {
      const v = grid[y][x];
      if (v === "_" || v === undefined)
        continue;
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
function sprite(grid, ax = 0.5, ay = 1) {
  const cv = toCanvas(grid);
  return { cv, w: cv.width, h: cv.height, ax: Math.round(cv.width * ax), ay: Math.round(cv.height * ay), grid };
}

// site/js/gfx/art/adds.js
var MAP = {
  k: "K",
  g: "G2",
  G: "G4",
  y: "Y",
  w: "w",
  v: "q",
  V: "V",
  f: "F3",
  F: "F5",
  e: "F4",
  o: "F6",
  d: "D2",
  D: "D4",
  l: "D6",
  b: "z2",
  s: "AS"
};
var map = (ch) => MAP[ch] || ch;
var g = (list) => {
  const r = rows(list);
  const c = canvas(r[0].length, r.length);
  c.stamp(r, 0, 0, 1, map);
  return c.grid;
};
var FLY = [
  g([".v...v.", "Kv.K.vK", ".KgggK.", "KgGGGgK", "KgGyGgK", ".KgggK.", "..KKK.."]),
  g(["vv...vv", ".K.K.K.", ".KgggK.", "KgGGGgK", "KgGyGgK", ".KgggK.", "..KKK.."])
];
var EMBER = [
  g(["...K...", "..KfK..", ".KfFfK.", "KfFoFfK", "KfFFFfK", ".KefeK.", "..KKK.."]),
  g(["..K.K..", ".KfKfK.", ".KFoFK.", "KfFoFfK", "KeFFFeK", ".KefeK.", "..KKK.."]),
  g(["...K...", "..KFK..", ".KFoFK.", "KFoooFK", "KfFoFfK", ".KefeK.", "..KKK.."])
];
var HAND = [
  g(["..K.K..", ".KdKdK.", "KdDdDdK", "KdDDDdK", ".KdDDdK", "..KddK.", "...KK.."]),
  g(["K.K.K.K", "KdKdKdK", "KdDdDdK", "KdDDDDK", "KdDDDdK", ".KdddK.", "..KKK.."])
];
function pop(i, cols) {
  const S = 11;
  const c = canvas(S * 2, S * 2);
  const r = rng(300 + i * 11);
  const R = 3 + i * 3;
  for (let k = 0;k < 10 - i * 2; k++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.6 + r() * 0.6);
    c.set(S + Math.cos(a) * d, S + Math.sin(a) * d, cols[Math.floor(r() * cols.length)]);
    c.set(S + Math.cos(a) * (d - 1), S + Math.sin(a) * (d - 1), cols[0]);
  }
  return c.grid;
}
function buildAdds() {
  const S = (gr) => sprite(gr, 0.5, 0.86);
  return {
    add: {
      fly: FLY.map(S),
      ember: EMBER.map(S),
      hand: HAND.map(S),
      popGreen: [0, 1, 2].map((i) => sprite(pop(i, ["G2", "G4", "GB"]), 0.5, 0.5)),
      popFire: [0, 1, 2].map((i) => sprite(pop(i, ["F3", "F5", "F6"]), 0.5, 0.5)),
      popWater: [0, 1, 2].map((i) => sprite(pop(i, ["D3", "D5", "D6"]), 0.5, 0.5))
    }
  };
}

// site/js/gfx/art/decor.js
var MAP2 = {
  k: "K",
  g: "G2",
  G: "G4",
  h: "GB",
  e: "e2",
  E: "e4",
  l: "g4",
  m: "mb",
  M: "q5",
  p: "p",
  P: "PK",
  y: "Y",
  o: "O",
  f: "F3",
  F: "F5",
  w: "w",
  z: "z2",
  Z: "z4",
  b: "b1",
  B: "b3",
  s: "o2",
  S: "o4",
  d: "D3",
  D: "D5",
  a: "AS",
  A: "AW"
};
var map2 = (ch) => MAP2[ch] || ch;
var g2 = (list) => {
  const r = rows(list);
  const c = canvas(r[0].length, r.length);
  c.stamp(r, 0, 0, 1, map2);
  return c.grid;
};
function reed(h, shade, seed) {
  const c = canvas(7, h);
  const r = rng(seed);
  for (let b = 0;b < 3 + Math.floor(r() * 3); b++) {
    const x0 = 2 + Math.round((r() - 0.5) * 3);
    const len = h * (0.55 + r() * 0.45);
    const bow = (r() - 0.5) * 2.2;
    for (let t = 0;t < len; t++) {
      const k = t / len;
      c.set(x0 + bow * k * k, h - 1 - t, t > len - 3 ? shade[2] : t % 5 === 0 ? shade[0] : shade[1]);
    }
  }
  return c.grid;
}
function tuft(w, h, shade, seed) {
  const c = canvas(w, h);
  const r = rng(seed);
  for (let b = 0;b < 4 + Math.floor(r() * 3); b++) {
    const x0 = w / 2 + (r() - 0.5) * (w - 2);
    const len = h * (0.5 + r() * 0.5);
    const lean = (x0 - w / 2) * 0.5 + (r() - 0.5);
    for (let t = 0;t < len; t++) {
      const k = t / len;
      c.set(x0 + lean * k, h - 1 - t, t > len - 2 ? shade[2] : shade[t % 3 === 0 ? 0 : 1]);
    }
  }
  return c.grid;
}
function flower(h, stem, petal, seed) {
  const c = canvas(5, h);
  const r = rng(seed);
  const bow = (r() - 0.5) * 1.6;
  for (let t = 0;t < h - 2; t++)
    c.set(2 + bow * (t / h), h - 1 - t, stem);
  const top = 1;
  c.set(2, top, petal[1]);
  c.set(1, top, petal[0]);
  c.set(3, top, petal[0]);
  c.set(2, top + 1, petal[0]);
  if (r() < 0.5)
    c.set(2, top - 1, petal[1]);
  return c.grid;
}
function cap(size, seed) {
  const c = canvas(size * 2 + 1, size * 2 + 2);
  const cx = size;
  blob(c, cx, size + 1, size * 0.45, size * 0.9, ["K", "q", "s"], [0, -1], seed);
  blob(c, cx, size * 0.7, size, size * 0.62, ["mB", "mb", "q4", "q5"], [-0.4, -0.8], seed + 1, 0.1);
  c.set(cx - 1, size * 0.4, "w");
  return c.grid;
}
var KELP = [
  g2([".z.", "zZz", ".z.", "zZ.", ".z.", ".zZ", ".z.", "zz."]),
  g2(["..z", ".zZ", ".z.", "Zz.", ".z.", ".zZ", ".z.", ".zz"])
];
var PEBBLE = g2([".kk.", "kSSk", "kssk", ".kk."]);
var BONE = g2(["..k..", ".kwk.", "kwwwk", ".kwk.", "..k.."]);
function emberTuft(h, seed) {
  const c = canvas(7, h);
  const r = rng(seed);
  for (let b = 0;b < 3; b++) {
    const x0 = 3 + Math.round((r() - 0.5) * 3);
    const len = h * (0.5 + r() * 0.5);
    for (let t = 0;t < len; t++) {
      const k = t / len;
      c.set(x0 + (r() - 0.5) * k * 2, h - 1 - t, k > 0.8 ? "F6" : k > 0.5 ? "F5" : k > 0.2 ? "F4" : "F3");
    }
  }
  return c.grid;
}
var BEETLE = [
  g2(["k.k", "kGk", "GhG", "kGk"]),
  g2([".k.", "kGk", "GhG", "k.k"])
];
var FROG = [
  g2([".k.k.", "kGyGk", "GGGGG", "kG.Gk"]),
  g2(["k...k", "kGyGk", "GGGGG", ".kGk."])
];
var MINNOW = [
  g2([".dd..", "dDDdk", ".dd.."]),
  g2(["..dd.", "kdDDd", "..dd."])
];
var MOTH = [
  g2([".w.w.", "wAkAw", ".w.w."]),
  g2(["w...w", ".AkA.", "w...w"])
];
var SPARKFLY = [g2(["y"]), g2(["w"])];
function buildDecor() {
  const S = (gr, ay = 1) => sprite(gr, 0.5, ay);
  const NIGHT = ["e1", "e3", "e5"];
  const DRY = ["G1", "G3", "GB"];
  const ASHY = ["AS", "As", "AW"];
  return {
    plant: {
      reedTall: [reed(22, NIGHT, 1), reed(19, NIGHT, 2), reed(24, NIGHT, 3)].map((x) => S(x)),
      reedShort: [reed(13, NIGHT, 4), reed(11, NIGHT, 5)].map((x) => S(x)),
      grass: [tuft(9, 7, DRY, 6), tuft(11, 6, DRY, 7), tuft(8, 8, DRY, 8)].map((x) => S(x)),
      flower: [flower(9, "g", ["p", "PK"], 9), flower(8, "g", ["Y", "y"], 10), flower(10, "g", ["V", "q"], 11)].map((x) => S(x)),
      cap: [cap(4, 12), cap(3, 13), cap(5, 14)].map((x) => S(x)),
      kelp: KELP.map((x) => S(x)),
      emberTuft: [emberTuft(11, 15), emberTuft(8, 16), emberTuft(14, 17)].map((x) => S(x)),
      pebble: [S(PEBBLE)],
      bone: [S(BONE)],
      ashTuft: [tuft(10, 6, ASHY, 18), tuft(8, 5, ASHY, 19)].map((x) => S(x))
    },
    critter: {
      beetle: BEETLE.map((x) => S(x, 0.9)),
      frog: FROG.map((x) => S(x, 0.9)),
      minnow: MINNOW.map((x) => S(x, 0.6)),
      moth: MOTH.map((x) => S(x, 0.5)),
      sparkfly: SPARKFLY.map((x) => S(x, 0.5))
    }
  };
}
var PLANT_FLEX = {
  reedTall: 1.5,
  reedShort: 1,
  grass: 0.8,
  flower: 1.2,
  cap: 0.25,
  kelp: 0.9,
  emberTuft: 0.6,
  pebble: 0,
  bone: 0,
  ashTuft: 0.7
};
var ARENA_PLANTS = {
  bog: [
    ["reedTall", 30, "rim"],
    ["reedShort", 18, "rim"],
    ["grass", 22, "floor"],
    ["flower", 9, "floor"],
    ["pebble", 8, "floor"]
  ],
  ash: [
    ["emberTuft", 10, "floor"],
    ["ashTuft", 16, "floor"],
    ["pebble", 10, "floor"],
    ["bone", 5, "floor"]
  ],
  hall: [
    ["kelp", 22, "rim"],
    ["grass", 8, "rim"],
    ["pebble", 12, "floor"],
    ["bone", 4, "floor"]
  ]
};
var ARENA_CRITTERS = {
  bog: [["frog", 3], ["beetle", 3], ["sparkfly", 10]],
  ash: [["beetle", 2], ["moth", 5], ["sparkfly", 7]],
  hall: [["minnow", 5], ["beetle", 2], ["sparkfly", 6]],
  meadow: [["beetle", 4], ["moth", 5]],
  "meadow-night": [["beetle", 2], ["moth", 3], ["sparkfly", 12]]
};

// site/js/gfx/art/fx.js
function crescent(R, spread, th, colours, lead = 0) {
  const S = Math.ceil(R + th + 2);
  const c = canvas(S * 2, S * 2);
  const cx = S;
  const cy = S;
  for (let y = -S;y < S; y++)
    for (let x = -S;x < S; x++) {
      const d = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      if (Math.abs(a) > spread / 2)
        continue;
      const edge = Math.abs(a) / (spread / 2);
      const t = th * (1 - edge * edge * 0.75);
      const off = d - R + lead * edge;
      if (Math.abs(off) > t / 2)
        continue;
      const k = 1 - Math.abs(off) / (t / 2);
      const i = Math.min(colours.length - 1, Math.floor(k * colours.length * (1 - edge * 0.35)));
      c.set(cx + x, cy + y, colours[Math.max(0, i)]);
    }
  return c.grid;
}
function orb(r, colours, seed = 3) {
  const S = Math.ceil(r) + 2;
  const c = canvas(S * 2, S * 2);
  blob(c, S, S, r, r, colours, [-0.4, -0.7], seed, 0.18);
  outline(c, "K", true);
  return c.grid;
}
function spark(n, len, colours, seed) {
  const S = len + 3;
  const c = canvas(S * 2, S * 2);
  const r = rng(seed);
  for (let i = 0;i < n; i++) {
    const a = i / n * Math.PI * 2 + r() * 0.5;
    const l = len * (0.5 + r() * 0.5);
    for (let t = 1;t < l; t++)
      c.set(S + Math.cos(a) * t, S + Math.sin(a) * t, colours[Math.min(colours.length - 1, Math.floor(t / l * colours.length))]);
  }
  return c.grid;
}
function puff(i, colours) {
  const S = 14;
  const c = canvas(S * 2, S * 2);
  const r = rng(90 + i * 7);
  const R = 3 + i * 3.2;
  for (let k = 0;k < 9 - i; k++) {
    const a = r() * Math.PI * 2;
    const rr = R * (0.7 + r() * 0.5);
    blob(c, S + Math.cos(a) * rr, S + Math.sin(a) * rr * 0.55, 3.4 - i * 0.55, 2.6 - i * 0.45, colours, [-0.3, -0.8], 300 + i * 13 + k);
  }
  return c.grid;
}
var COIN = rows(["..KKK..", ".KyyyK.", "KyGGyK.", "KyGGyK.", "KyGGyK.", ".KyyyK.", "..KKK.."]);
var COIN_MAP = (ch) => ({ y: "GD", G: "Gd" })[ch] || ch;
var HEARTLET = rows([".KK.KK.", "KppKppK", "KpPppPK", "KppppPK", ".KpppK.", "..KpK..", "...K..."]);
var HEART_MAP = (ch) => ({ p: "R", P: "p" })[ch] || ch;
var SHARD = rows(["..K..", ".KsK.", "KsSsK", "KsSsK", ".KsK.", "..K.."]);
var SHARD_MAP = (ch) => ({ s: "mb", S: "q5" })[ch] || ch;
var BELL = rows([
  "...KK...",
  "..KyyK..",
  ".KyGGyK.",
  "KyGGGGyK",
  "KyGGGGyK",
  "KyGGGGyK",
  "KKKKKKKK",
  "...KK..."
]);
var BELL_MAP = (ch) => ({ y: "GD", G: "Gd" })[ch] || ch;
function buildFx() {
  const grid = (rowsIn, map) => {
    const c = canvas(rowsIn[0].length, rowsIn.length);
    c.stamp(rowsIn, 0, 0, 1, map);
    return c.grid;
  };
  const S = (g) => sprite(g, 0.5, 0.5);
  const steel = ["Bl", "BL", "BK", "w"];
  const bog = ["G2", "G4", "GB", "GP"];
  const fire = ["F2", "F3", "F4", "F5", "F6"];
  const water = ["D2", "D3", "D5", "D6"];
  const out = {
    slash: {
      swing: [crescent(13, 2.1, 5, steel, 2), crescent(16, 2.5, 7, steel, 0), crescent(19, 2.2, 4, ["Bl", "BL", "BK"], -2)],
      heavy: [crescent(15, 2.6, 6, steel, 3), crescent(19, 3, 9, steel, 0), crescent(23, 2.6, 5, ["Bl", "BL"], -3)]
    },
    shot: {
      bog: [orb(5, bog, 3), orb(6, bog, 9)],
      ember: [orb(4, fire, 5), orb(5, fire, 15)],
      wave: [orb(5, water, 7), orb(6, water, 17)],
      glob: [orb(8, ["G1", "G2", "G3", "GB"], 23)]
    },
    hit: {
      steel: [spark(9, 7, ["w", "BK", "Bl"], 31), spark(7, 10, ["BK", "Bl", "s1"], 41)],
      flesh: [spark(8, 6, ["R", "r", "Wr"], 51), spark(6, 9, ["r", "Wr"], 61)],
      block: [spark(10, 5, ["y", "Y", "O"], 71)]
    },
    dust: {
      roll: [0, 1, 2, 3].map((i) => puff(i, ["p1", "p2", "p3", "o3"])),
      land: [0, 1, 2, 3].map((i) => puff(i, ["x1", "x2", "x3", "a4"])),
      ash: [0, 1, 2, 3].map((i) => puff(i, ["AS", "As", "AW", "w"]))
    },
    pick: {
      coin: [grid(COIN, COIN_MAP)],
      heart: [grid(HEARTLET, HEART_MAP)],
      shard: [grid(SHARD, SHARD_MAP)],
      bell: [grid(BELL, BELL_MAP)]
    }
  };
  for (const set of Object.values(out))
    for (const [k, list] of Object.entries(set))
      set[k] = list.map(S);
  return out;
}

// site/js/gfx/art/arm-icons.js
var N = 12;
function draw({ guard = 1.6, blade = 0, px = 2, taper = 1.6, curve = 0, head = null, hw = 2, hl = 3, metalHaft = false }) {
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  const width = px * 0.354 + 0.02;
  const a = [1.1, N - 1.1 - (px % 2 ? 0 : 0.5)];
  const d = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const L = (N - 2.2) * Math.SQRT2;
  for (let j = 0;j < N; j++) {
    for (let i = 0;i < N; i++) {
      const px = i + 0.5 - a[0], py = j + 0.5 - a[1];
      const u = px * d[0] + py * d[1];
      let v = px * n[0] + py * n[1];
      if (u < 0 || u > L + 0.2)
        continue;
      let c = null;
      if (blade) {
        const b0 = L - blade;
        if (u < 0.7)
          c = Math.abs(v) < Math.max(0.75, width) ? "y" : null;
        else if (u < b0 - 0.4)
          c = Math.abs(v) < Math.min(width, 0.75) ? "n" : null;
        else if (u < b0 + 0.5)
          c = Math.abs(v) < guard ? "y" : null;
        else {
          const k = (u - b0) / blade;
          v += curve * k * k;
          const w = width * Math.min(1, (L - u) / taper);
          if (Math.abs(v) < w)
            c = v > w * 0.15 ? "B" : "b";
        }
      } else {
        const h0 = L - hl;
        const shaft = Math.abs(v) < width;
        if (u < h0 + 0.3 && shaft)
          c = metalHaft ? "s" : u < 2.2 ? "n" : "N";
        if (u >= h0) {
          const k = (u - h0) / hl;
          if (head === "axe") {
            const out = hw * Math.sin(Math.PI * Math.min(1, 0.15 + k * 0.85)) + 0.3;
            if (v > -width && v < out)
              c = v > out - 0.9 ? "b" : "s";
            else if (shaft)
              c = "N";
          } else if (head === "hammer") {
            if (Math.abs(v) < hw && k > 0.25)
              c = v < -hw + 0.9 ? "S" : "s";
            else if (shaft)
              c = "N";
          } else if (head === "club") {
            const w = 0.55 + (hw - 0.55) * Math.sin(Math.PI * 0.5 * Math.min(1, k * 1.3));
            if (Math.abs(v) < w * Math.min(1, (L - u + 0.6) / 1.2))
              c = (i + j) % 3 === 0 && hw > 1.9 && k > 0.35 ? "s" : v > w * 0.3 ? "N" : "n";
          } else if (head === "flange") {
            const w = k < 0.2 ? 0.8 : hw * (0.75 + 0.25 * Math.cos(k * Math.PI * 4));
            if (Math.abs(v) < w * Math.min(1, (L - u + 0.5) / 1))
              c = Math.abs(v) > 0.9 ? "y" : "s";
          } else if (head === "knob") {
            if (Math.hypot(u - (L - hw), v) < hw)
              c = "q";
            else if (shaft)
              c = "N";
          }
        }
      }
      if (c)
        g[j][i] = c;
    }
  }
  return outline2(g);
}
function shield(kind) {
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  const cx = N / 2, cy = N / 2;
  for (let j = 0;j < N; j++) {
    for (let i = 0;i < N; i++) {
      const x = i + 0.5 - cx, y = j + 0.5 - cy;
      let inside = false;
      if (kind === "round")
        inside = Math.hypot(x, y) < 4.6;
      else if (kind === "heater")
        inside = y < 0.5 ? Math.abs(x) < 4.2 && y > -4.6 : Math.abs(x) < 4.2 * Math.sqrt(Math.max(0, 1 - ((y - 0.5) / 4.6) ** 2)) && y < 5.1;
      else
        inside = Math.abs(x) < 3.4 && Math.abs(y) < 5.1;
      if (!inside)
        continue;
      let c = x < -1.2 ? "s" : "S";
      if (kind === "round" && Math.hypot(x, y) < 1.3)
        c = "y";
      if (kind === "heater" && Math.abs(x) < 0.6 && y > -3.6 && y < 3.6)
        c = "y";
      if (kind === "heater" && Math.abs(y + 0.5) < 0.6 && Math.abs(x) < 3.6)
        c = "y";
      if (kind === "tower" && (Math.abs(y + 2.6) < 0.5 || Math.abs(y - 2.6) < 0.5))
        c = "o";
      if (kind === "tower" && Math.abs(x) < 0.9 && Math.abs(y) < 0.9)
        c = "y";
      g[j][i] = c;
    }
  }
  return outline2(g);
}
function outline2(g) {
  const out = g.map((r) => r.slice());
  for (let j = 0;j < N; j++) {
    for (let i = 0;i < N; i++) {
      if (g[j][i] !== ".")
        continue;
      if ((g[j - 1]?.[i] ?? ".") !== "." || (g[j + 1]?.[i] ?? ".") !== "." || (g[j][i - 1] ?? ".") !== "." || (g[j][i + 1] ?? ".") !== ".")
        out[j][i] = "K";
    }
  }
  return out.map((r) => r.join(""));
}
var ARM_ICONS = {
  shortsword: draw({ blade: 6.4, px: 2, guard: 1.5, taper: 1.2 }),
  sword: draw({ blade: 9, px: 2, guard: 1.8 }),
  longsword: draw({ blade: 10.4, px: 2, guard: 2.2, taper: 1.2 }),
  greatsword: draw({ blade: 10.2, px: 3, guard: 2.4, taper: 1.5 }),
  colossal: draw({ blade: 10.8, px: 5, guard: 2.8, taper: 0.9 }),
  scimitar: draw({ blade: 9, px: 3, guard: 1.5, curve: 2.6, taper: 2.6 }),
  katana: draw({ blade: 9.4, px: 2, guard: 1.2, curve: 0.8, taper: 1.4 }),
  club: draw({ px: 2, head: "club", hw: 1.7, hl: 7 }),
  greatclub: draw({ px: 2, head: "club", hw: 2.6, hl: 8 }),
  scepter: draw({ px: 2, head: "flange", hw: 2.5, hl: 4.6, metalHaft: true }),
  axe: draw({ px: 2, head: "axe", hw: 3.3, hl: 4.4 }),
  greataxe: draw({ px: 2, head: "axe", hw: 4.2, hl: 6 }),
  hammer: draw({ px: 2, head: "hammer", hw: 2.2, hl: 3 }),
  greathammer: draw({ px: 2, head: "hammer", hw: 3.2, hl: 4.4 }),
  staff: draw({ px: 2, head: "knob", hw: 1.4, hl: 2.6 }),
  buckler: shield("round"),
  heater: shield("heater"),
  greatshield: shield("tower")
};

// site/js/gfx/art/icons.js
var M = {
  r: "R",
  p: "p",
  k: "Wr",
  y: "GD",
  Y: "y",
  o: "Gd",
  s: "M3",
  S: "M1",
  b: "BL",
  B: "BK",
  c: "Bl",
  g: "G4",
  G: "GP",
  f: "F4",
  F: "F6",
  e: "F3",
  w: "w",
  q: "mb",
  Q: "q5",
  v: "V",
  V: "q",
  n: "L1",
  N: "L2",
  d: "H2",
  h: "H1",
  z: "AS",
  Z: "AW"
};
var map3 = (ch) => M[ch] || ch;
var I = {
  heart: rows([".KKK.KKK.", "KrrrKrrrK", "KrppKrrrK", "KrpprrrrK", "KrrrrrrrK", ".KrrrrrK.", "..KrrrK..", "...KrK...", "....K...."]),
  heartEmpty: rows([".KKK.KKK.", "KKKKKKKKK", "KK.KK..KK", "KK....K.K", "K.......K", ".K.....K.", "..K...K..", "...K.K...", "....K...."]),
  stamina: rows(["...KK...", "..KYYK..", ".KYyyK..", "KYyyK...", ".KyyYK..", "..KyyYK.", "...KYK..", "...KK..."]),
  coin: rows(["..KKKK..", ".KyyyyK.", "KyYooYyK", "KyoYYoyK", "KyoYYoyK", "KyYooYyK", ".KyyyyK.", "..KKKK.."]),
  bell: rows(["...KK...", "..KyyK..", ".KyYYyK.", "KyYYYYyK", "KyYYYYyK", "KyYYYYyK", "KKKKKKKK", "...KK..."]),
  skull: rows(["..KKKK..", ".KwwwwK.", "KwKwwKwK", "KwKwwKwK", "KwwwwwwK", "KwKwKwwK", ".KwwwwK.", "..K.K.K."]),
  potion: rows(["..KKK...", "..KnK...", ".KKKKK..", "KrrrrrK.", "KrpprrK.", "KrrrrrK.", "KrrrrrK.", ".KKKKK.."]),
  shield: rows([".KKKKKK.", "KsSSSSsK", "KsyYYysK", "KsSyySsK", "KsSSSSsK", ".KsSSsK.", "..KsSK..", "...KK..."]),
  bomb: rows(["....Kf..", "...KFK..", "..KKK...", ".KzzzK..", "KzZzzzK.", "KzzzzzK.", "KzzzzzK.", ".KKKKK.."]),
  dagger: rows(["...KK...", "..KbBK..", "..KbBK..", "..KbBK..", ".KKKKKK.", "..KyyK..", "..KnnK..", "...KK..."]),
  firebolt: rows(["...K....", "..KfK...", ".KfFfK..", "KfFFFfK.", "KfFFFfK.", "KefFFeK.", ".KeffeK.", "..KKK..."]),
  frost: rows(["...K....", ".K.K.K..", "..KQK...", "KKKqKKK.", "..KQK...", ".K.K.K..", "...K....", "........"]),
  jump: rows(["...KK...", "..KqqK..", ".KqQQqK.", "KKKqqKKK", "..KqqK..", "..KqqK..", "........", "KKKKKKK."]),
  dash: rows(["........", "K..K..K.", ".K..K..K", "KKKqQKKK", ".K..K..K", "K..K..K.", "........", "........"]),
  heal: rows(["...KK...", "...KK...", "KKKKKKK.", "KGGGGGK.", "KKKKKKK.", "...KK...", "...KK...", "........"]),
  caltrop: rows(["K..K..K.", ".K.K.K..", "..KsK...", "KKKsKKK.", "..KsK...", ".K.K.K..", "K..K..K.", "........"]),
  lantern: rows(["..KKK...", ".KKKKK..", "KYyyYK..", "KyyyyK..", "KyyyyK..", "KYyyYK..", ".KKKKK..", "..KKK..."]),
  stone: rows([".KKKK...", "KvVVvK..", "KvVVVvK.", "KvVVVvK.", ".KvVvK..", "..KKK...", "........", "........"]),
  horn: rows([".....KK.", "...KKyK.", ".KKyyyK.", "KyyyyK..", "KyyyK...", "KyyK....", ".KK.....", "........"]),
  roll: rows(["..KKKK..", ".KhhhhK.", "KhKddKhK", "KhdddhhK", "KhddhhhK", "KhhhhhhK", ".KhhhhK.", "..KKKK.."]),
  sword: rows(["....KK..", "...KbBK.", "..KbBK..", ".KbBK...", "KKbKK...", "KyKK....", "KnK.....", "KK......"]),
  cog: rows(["..K..K..", ".KKKKKK.", "KKsSSsKK", ".KSKKSK.", ".KSKKSK.", "KKsSSsKK", ".KKKKKK.", "..K..K.."]),
  book: rows([".KKKKKK.", "KnNNNNnK", "KnNwwNnK", "KnNwwNnK", "KnNwwNnK", "KnNNNNnK", ".KKKKKK.", "........"]),
  arrowL: rows(["...K....", "..KK....", ".KKKKKK.", "KKKKKKK.", ".KKKKKK.", "..KK....", "...K....", "........"]),
  star: rows(["...K....", "...Y....", "..KYK...", "KKYYYKK.", "..KYK...", "...Y....", "...K....", "........"])
};
function buildIcons() {
  const out = {};
  for (const [name, g] of [...Object.entries(I), ...Object.entries(ARM_ICONS).map(([id, g]) => [`arm_${id}`, g])]) {
    const c = canvas(g[0].length, g.length);
    c.stamp(g, 0, 0, 1, map3);
    out[name] = [sprite(c.grid, 0.5, 0.5)];
  }
  return { ui: out };
}

// site/js/gfx/art/title.js
var W = 384;
var H = 280;
var NIGHT = ["j1", "j2", "j3", "j4", "j5"];
var BARK = ["k1", "k2", "k3", "k4"];
var GRASS = ["K", "e1", "e1", "e2", "e3"];
var STONE = ["p1", "s5", "s4", "s1", "s2"];
var L = [-0.55, -0.82];
function buildTitle() {
  const c = canvas(W, H);
  const r = rng(1337);
  const HORIZON = 176;
  const SKY = ["n1", "n1", "n2", "n2", "n3", "n4"];
  for (let y = 0;y < HORIZON; y++) {
    const t = y / HORIZON;
    for (let x = 0;x < W; x++)
      c.set(x, y, SKY[shadeIdx(0.08 + t * 0.62 + (d4(x, y * 2) - 0.5) * 0.12, SKY.length, x, y)]);
  }
  const stars = [];
  for (let i = 0;i < 150; i++) {
    const x = Math.round(r() * W);
    const y = Math.round(r() * (HORIZON - 14));
    const bright = r();
    c.set(x, y, bright > 0.85 ? "w" : bright > 0.5 ? "mo" : "bl");
    if (bright > 0.9)
      stars.push([x, y, bright]);
  }
  const moon = [300, 40, 15];
  ell(c, moon[0], moon[1], moon[2] + 8, moon[2] + 8, (x, y, d) => {
    if (d < 0.55 || d4(x, y) > (1 - d) * 1.5)
      return;
    c.set(x, y, "n4");
  });
  ell(c, moon[0], moon[1], moon[2], moon[2], (x, y, d) => c.set(x, y, d > 0.78 ? "q" : "mo"));
  ell(c, moon[0] + 5, moon[1] - 3, 3, 3, (x, y) => c.set(x, y, "q"));
  ell(c, moon[0] - 4, moon[1] + 5, 2, 2, (x, y) => c.set(x, y, "q"));
  for (let x = 0;x < W; x++) {
    const h = HORIZON - 12 - Math.sin(x * 0.014) * 9 - Math.sin(x * 0.037 + 2) * 5;
    for (let y = Math.round(h);y < HORIZON; y++)
      c.set(x, y, y < h + 2 ? "n5" : "n2");
  }
  const hillTop = (x) => HORIZON + 22 - Math.cos((x / W - 0.5) * 2.3) * 30;
  for (let x = 0;x < W; x++) {
    const top = hillTop(x);
    for (let y = Math.round(top);y < H; y++) {
      const t = (y - top) / (H - top);
      let i = shadeIdx(0.1 + t * 0.44 + (d4(x, y) - 0.5) * 0.2, GRASS.length, x, y);
      c.set(x, y, GRASS[i]);
    }
  }
  const AX = 192;
  const AY = Math.round(hillTop(AX));
  const piers = [
    [AX - 44, AX - 26],
    [AX + 26, AX + 44]
  ];
  for (const [x0, x1] of piers) {
    for (let y = AY - 96;y < AY + 4; y++)
      for (let x = x0;x <= x1; x++) {
        const u = (x - x0) / (x1 - x0);
        const rough = d4(x * 2, Math.floor(y / 7)) * 0.3;
        const brick = (Math.floor(y / 7) + Math.floor(x / 6)) % 2 ? 0.06 : 0;
        const v = 0.28 + (1 - u) * 0.46 + rough - brick - (y > AY - 30 ? 0.12 : 0);
        c.set(x, y, STONE[shadeIdx(v, STONE.length, x, y)]);
      }
  }
  for (let a = Math.PI;a <= Math.PI * 2 + 0.02; a += 0.004) {
    for (let k = 0;k < 15; k++) {
      const rr = 44 + k;
      const x = AX + Math.cos(a) * rr;
      const y = AY - 96 + Math.sin(a) * rr * 0.92;
      if (a > Math.PI * 1.1 && a < Math.PI * 1.19 && k > 4)
        continue;
      const v = 0.3 + (Math.cos(a) < 0 ? 0.4 : 0.12) + (14 - k) / 40 + (d4(x, y) - 0.5) * 0.2;
      c.set(x, y, STONE[shadeIdx(v, STONE.length, x, y)]);
    }
  }
  for (let i = 0;i < 26; i++) {
    const x = AX - 84 + r() * 44;
    const y = AY - 4 + r() * 16;
    blob(c, x, y, 2 + r() * 4, 1.5 + r() * 3, ["p1", "s5", "s4", "s1"], L, 800 + i);
  }
  for (let i = 0;i < 26; i++) {
    const [x0, x1] = piers[i % 2];
    clump(c, x0 + r() * (x1 - x0), AY - 6 - r() * 62, 2 + r() * 3.5, ["j1", "j2", "j3", "j4"], 820 + i, L);
  }
  const bells = [];
  const BELL_Y = AY - 92;
  [-24, 0, 24].forEach((ox, i) => {
    const bx = AX + ox;
    const scale = i === 1 ? 1.25 : 1;
    const bw = Math.round(9 * scale);
    const bh = Math.round(11 * scale);
    const by = BELL_Y + (i === 1 ? 6 : 0);
    for (let y = BELL_Y - 12;y < by - bh; y++)
      c.set(bx, y, "o2");
    c.set(bx - 1, by - bh - 1, "o3");
    c.set(bx + 1, by - bh - 1, "o3");
    for (let y = -bh;y <= 0; y++) {
      const t = (y + bh) / bh;
      const half = Math.round(bw * (0.42 + t * t * 0.58));
      for (let x = -half;x <= half; x++) {
        const u = x / Math.max(1, half);
        const v = 0.3 - u * 0.36 + (1 - t) * 0.12 + (d4(bx + x, by + y) - 0.5) * 0.14;
        c.set(bx + x, by + y, ["Cr", "Gd", "GD", "y"][Math.max(0, shadeIdx(v, 4, bx + x, by + y))]);
      }
      if (y === 0)
        for (let x = -half - 1;x <= half + 1; x++)
          c.set(bx + x, by + 1, "K");
    }
    for (let x = -bw;x <= bw; x++)
      c.set(bx + x, by, "Cr");
    c.set(bx, by + 2, "K");
    c.set(bx, by + 3, "Cr");
    bells.push([bx, by - bh / 2, bw]);
  });
  const BRZ = [AX, AY + 10];
  blob(c, BRZ[0], BRZ[1] + 6, 11, 4, ["p1", "s5", "s4"], L, 900);
  for (let y = 0;y < 9; y++)
    for (let x = -8 + Math.floor(y / 2);x <= 8 - Math.floor(y / 2); x++)
      c.set(BRZ[0] + x, BRZ[1] + 4 - y, y > 6 ? "s4" : "s5");
  for (let y = 0;y < 10; y++)
    c.set(BRZ[0] - 9 + y % 2, BRZ[1] + 5 + Math.floor(y / 3), "s5");
  blob(c, BRZ[0], BRZ[1] - 8, 8, 7, ["F2", "F3", "F4", "F5", "F6"], [0, -0.3], 910, 0.35);
  blob(c, BRZ[0], BRZ[1] - 13, 4, 5, ["F4", "F5", "F6", "w"], [0, -0.4], 911, 0.4);
  ell(c, BRZ[0], BRZ[1] + 12, 42, 14, (x, y, d) => {
    if (d4(x * 3, y * 3) > (1 - d) * 0.6)
      return;
    const cur = c.get(x, y);
    if (cur === "_" || cur === undefined)
      return;
    c.set(x, y, d < 0.22 ? "O" : d < 0.55 ? "w1" : "f4");
  });
  for (const [x0, x1] of piers)
    for (let y = AY - 34;y < AY + 2; y++)
      for (let x = x0;x <= x1; x++) {
        const d = Math.hypot(x - BRZ[0], (y - BRZ[1]) * 1.6) / 70;
        if (d > 1 || d4(x * 2, y * 2) > (1 - d) * 0.6)
          continue;
        c.set(x, y, d < 0.5 ? "f2" : "f3");
      }
  const treeAt = (x, base, scale, seed) => {
    trunk(c, x - 4 * scale, x + 4 * scale, base - 78 * scale, base, BARK, x < W / 2 ? 1 : -1, 12 * scale, seed);
    canopy(c, x, base - 86 * scale, 46 * scale, 30 * scale, NIGHT, seed + 3, L, 20, 0.34);
  };
  treeAt(26, H + 10, 1.25, 11);
  treeAt(358, H + 14, 1.35, 23);
  treeAt(74, H - 2, 0.8, 31);
  treeAt(316, H - 6, 0.85, 37);
  for (let i = 0;i < 40; i++) {
    const x = r() * W;
    if (Math.abs(x - AX) < 70)
      continue;
    clump(c, x, hillTop(x) + 4 + r() * 22, 4 + r() * 6, ["j1", "j2", "j3", "j4"], 950 + i, L);
  }
  tufts(c, 260, 0, HORIZON + 6, W, H - HORIZON - 6, "e4", 77);
  const caps = [];
  for (let i = 0;i < 16; i++) {
    const x = Math.round(AX - 120 + r() * 240);
    if (Math.abs(x - AX) < 22)
      continue;
    const y = Math.round(hillTop(x) + 12 + r() * (H - hillTop(x) - 16));
    c.set(x, y, "K");
    c.set(x - 1, y - 1, "mb");
    c.set(x, y - 1, "q5");
    c.set(x + 1, y - 1, "mb");
    caps.push([x, y - 1, 1 + r() * 1.6]);
  }
  for (let t = 0;t <= 1; t += 0.002) {
    const y = H - t * (H - (AY + 10));
    const x = AX + Math.sin(t * 2.4) * 18 * (1 - t);
    const half = 16 * (1 - t * 0.55);
    for (let k = -half;k <= half; k++) {
      const u = Math.abs(k) / half;
      if (d4(x + k, y) < u * 0.8)
        continue;
      c.set(x + k, y, ["p1", "f4", "f3"][shadeIdx(0.25 + (1 - u) * 0.45 + (d4(x + k, y * 2) - 0.5) * 0.3, 3, x + k, y)]);
    }
  }
  tone(c, (x, y) => {
    const fd = Math.hypot((x - BRZ[0]) / 78, (y - (BRZ[1] + 6)) / 34);
    const fire = Math.max(0, 1 - fd) ** 1.6;
    const vd = Math.hypot((x - AX) / (W * 0.58), (y - (AY - 6)) / (H * 0.7));
    const dark = 1 - Math.min(1, Math.max(0, (vd - 0.45) / 0.72)) * 0.72;
    const moon = 0.66 + 0.1 * (1 - y / H);
    return [dark * (moon + fire * 0.75), dark * (moon * 0.96 + fire * 0.5), dark * (moon * 1.12 + fire * 0.12)];
  });
  return {
    img: sprite(c.grid, 0.5, 0.5),
    w: W,
    h: H,
    focus: [BRZ[0], BRZ[1] - 8],
    fire: [BRZ[0], BRZ[1] - 8, 16],
    moon,
    bells,
    stars,
    caps,
    arch: [AX, AY - 96]
  };
}

// site/js/release.js
var RELEASE = globalThis.__TB_RELEASE || "";
var FILES = { "art/bog.json": "4000c6cebc", "art/bog.png": "eaa061ab1f", "art/bog.webp": "99dff4c5dc", "art/hall.json": "4edb90ed2f", "art/title-tall.json": "b72d4c35f4", "art/title-tall.png": "46185e69d4", "art/title-tall.webp": "37bf7aba40", "art/title.json": "7f546dff16", "art/title.png": "b7846d3de0", "art/title.webp": "4893084a89", "art/ui/bell-lost-ash.webp": "6e9a04b946", "art/ui/bell-lost-salt.webp": "fef8f40756", "art/ui/bell-lost.webp": "a2142320bd", "art/ui/bell-won-ash.webp": "3134afb95f", "art/ui/bell-won-salt.webp": "dd3f41e447", "art/ui/bell-won.webp": "8de1fbc73d", "art3d/ash/ash-bell.webp": "630f753c1f", "art3d/ash/ash-bell3d.bin": "6899557ec1", "art3d/ash/ash-bell3d.gltf": "ac7f7df269", "art3d/ash/ash-bell3d.json": "81b26a0be0", "art3d/ash/ash-bell3d.webp": "8d2448bf0a", "art3d/ash/ash-color.webp": "ca1b1ae560", "art3d/ash/ash-depth.png": "3670e0e9da:webp", "art3d/ash/ash-fx.png": "8f6c6aa896:webp", "art3d/ash/ash-lines.json": "6c711bf927", "art3d/ash/ash-pieces.bin": "6c0dc602d8", "art3d/ash/ash-ref-hi.webp": "abb4113f9a", "art3d/ash/ash-ref.webp": "9f4e373439", "art3d/ash/ash-refdepth.png": "5eaf9d6808:webp", "art3d/ash/ash.json": "66df0794ff", "art3d/bell/bell.bin": "861f735ec7", "art3d/bell/bell.gltf": "403698b031", "art3d/bell/bell.json": "f83efe17cd", "art3d/bell/Image_0.webp": "671dc1e299", "art3d/bell/Image_1.webp": "68e58c1545", "art3d/bog/bog-bell.webp": "5ab0f24e30", "art3d/bog/bog-color.webp": "2456609502", "art3d/bog/bog-depth.png": "6a4131374b:webp", "art3d/bog/bog-edit.bin": "8c785d290e", "art3d/bog/bog-fx.png": "cf0bd8d2b7:webp", "art3d/bog/bog-life.png": "5d1e1c8656:webp", "art3d/bog/bog-life2.png": "889b765373:webp", "art3d/bog/bog-lines.json": "217f29f638", "art3d/bog/bog-pieces.bin": "03e7a095df", "art3d/bog/bog-ref-hi.webp": "2cb1749397", "art3d/bog/bog-ref.webp": "e374a45c34", "art3d/bog/bog-refdepth.png": "7d6e6c476b:webp", "art3d/bog/bog.json": "f4757bfff4", "art3d/camp2/camp2-c00.webp": "5c904c455e", "art3d/camp2/camp2-c01.webp": "afc4f9738e", "art3d/camp2/camp2-c10.webp": "d10003bd54", "art3d/camp2/camp2-c11.webp": "034654dfda", "art3d/camp2/camp2-crown.png": "869c335415:webp", "art3d/camp2/camp2-depth.png": "f3c3296e1a:webp", "art3d/camp2/camp2-e00.webp": "0751072155", "art3d/camp2/camp2-e01.webp": "1279e895ef", "art3d/camp2/camp2-e10.webp": "77348401c1", "art3d/camp2/camp2-e11.webp": "ac799d8831", "art3d/camp2/camp2-edit.bin": "6fbb96be69", "art3d/camp2/camp2-fx.png": "9c7f5e5464:webp", "art3d/camp2/camp2-gdepth.png": "0fa2e07546:webp", "art3d/camp2/camp2-lines.json": "15da7ffe71", "art3d/camp2/camp2-m00.webp": "aa3e760b95", "art3d/camp2/camp2-m01.webp": "dc1fe15b90", "art3d/camp2/camp2-m10.webp": "4644819b66", "art3d/camp2/camp2-m11.webp": "a95397f845", "art3d/camp2/camp2-odepth.png": "2cb3a35f6e:webp", "art3d/camp2/camp2-pdepth.png": "2c12bac288:webp", "art3d/camp2/camp2-pieces.bin": "fd7dfc9e8d", "art3d/camp2/camp2-view.json": "b9ec51bcb4", "art3d/camp2/camp2.json": "4fd8c43040", "art3d/chests/bog/bog.webp": "2ed73256a8", "art3d/chests/bog/chest.bin": "f3d98eaac8", "art3d/chests/bog/chest.gltf": "e362aa4fac", "art3d/chests/bog/texture_pbr_20250901.webp": "f5a1dbc82e", "art3d/chests/crystal/chest.bin": "32c1b8fa11", "art3d/chests/crystal/chest.gltf": "b0e4072682", "art3d/chests/crystal/crystal.webp": "c9261ea3bc", "art3d/chests/crystal/texture_pbr_20250901.webp": "a7f26f295d", "art3d/chests/inferno/chest.bin": "d4446857aa", "art3d/chests/inferno/chest.gltf": "b5db48391c", "art3d/chests/inferno/inferno.webp": "df548f79f9", "art3d/chests/inferno/texture_pbr_20250901.webp": "1769bcf415", "art3d/cinder-nova.bin": "ffb4972a8f", "art3d/cinder-tex-0.webp": "1a54709181", "art3d/cinder-tex-1.webp": "5c074ba6bb", "art3d/cinder.bin": "4e4b6e44c4", "art3d/cinder.gltf": "3b0eee9c85", "art3d/crab/crab.bin": "5b22e93736", "art3d/crab/crab.gltf": "39d0645943", "art3d/crab/texture_pbr_20250901.webp": "6b08d6e572", "art3d/garden/atlas.json": "5f061b88fd", "art3d/garden/atlas.png": "66597d634b:webp", "art3d/garden/atlas.webp": "66597d634b", "art3d/garden/meadow-floor.png": "b93af1547c:webp", "art3d/garden/meadow-floor.webp": "b93af1547c", "art3d/garden/meadow-grass-tile.png": "efec08332b:webp", "art3d/garden/meadow-grass-tile.webp": "efec08332b", "art3d/garden/meadow-terrace-tile.png": "53bf8dfbe9:webp", "art3d/garden/meadow-terrace-tile.webp": "53bf8dfbe9", "art3d/garden/tiles.json": "fbf2683293", "art3d/gnasher-low-albedo.webp": "0401e56d6f", "art3d/gnasher-tex-0.webp": "c764cc4870", "art3d/gnasher-tex-1.webp": "4265462a9c", "art3d/gnasher.bin": "0369462858", "art3d/gnasher.gltf": "8103195b5a", "art3d/hero-tex-0.webp": "d8086abb4a", "art3d/hero-tex-1.webp": "4fc9d86d83", "art3d/hero.bin": "19d313ef43", "art3d/hero.gltf": "a2972ba898", "art3d/meadow.layout.json": "b1fee5f026", "art3d/salt/salt-bell3d.bin": "4276f974be", "art3d/salt/salt-bell3d.gltf": "365d1e3bed", "art3d/salt/salt-bell3d.json": "c32679c432", "art3d/salt/salt-bell3d.webp": "a067d0b30a", "art3d/salt/salt-color.webp": "57aa6b1e07", "art3d/salt/salt-crust.webp": "986f275c36", "art3d/salt/salt-depth.png": "0ed3ace45b:webp", "art3d/salt/salt-edit.bin": "6a30d4cda7", "art3d/salt/salt-fx.png": "bb36d1b452:webp", "art3d/salt/salt-hole.webp": "add6ed1cd2", "art3d/salt/salt-life.png": "ad08da454b:webp", "art3d/salt/salt-lines.json": "91b454b6b0", "art3d/salt/salt-pieces.bin": "fcd1374d48", "art3d/salt/salt-ref-hi.webp": "821928a3b7", "art3d/salt/salt-ref.webp": "f5755a4d9d", "art3d/salt/salt-refdepth.png": "ded0e8ac7d:webp", "art3d/salt/salt.json": "2dd417eeb8", "audio/amb_ash.mp3": "23b91ab949", "audio/amb_bog.mp3": "124c2ace24", "audio/amb_meadow.mp3": "2fcd1e337c", "audio/amb_salt.mp3": "a843cf5a6a", "audio/ash_veil.mp3": "d335e915a9", "audio/bell_small.mp3": "568d7591b3", "audio/bell_strike.mp3": "858f14f5d1", "audio/bird_takeoff.mp3": "a2f7de20b2", "audio/brine_surge.mp3": "2fbca45acf", "audio/bubble_pop.mp3": "eb4b2c8469", "audio/bubble_seal.mp3": "d50536aea1", "audio/bubble_ward.mp3": "1f298813df", "audio/chest_land.mp3": "c05677fc15", "audio/chest_open.mp3": "89d73fe56f", "audio/cinder_cast.mp3": "0cb223b608", "audio/cinder_death.mp3": "afda66ccba", "audio/cinder_pain_a.mp3": "76c4140041", "audio/cinder_pain_b.mp3": "b596711de0", "audio/cinder_pain_c.mp3": "0c3db90852", "audio/cinder_phase.mp3": "1e39be9881", "audio/cinder_rise.mp3": "63f00d1af6", "audio/cinder_stagger.mp3": "3e324178fc", "audio/crab_burst.mp3": "d75a3d36b1", "audio/crab_hum.mp3": "2a1435993b", "audio/crab_hurt.mp3": "bc2e9e5558", "audio/crab_pincer.mp3": "cb063101a0", "audio/crab_rumble.mp3": "dfd06a4f6e", "audio/crab_step_a.mp3": "6d5f565c35", "audio/crab_step_b.mp3": "f8c0195466", "audio/crab_step_c.mp3": "b662935430", "audio/crab_thud_a.mp3": "6c6c0adcbe", "audio/crab_thud_b.mp3": "a70c9a0638", "audio/crystal_erupt.mp3": "b3984b111f", "audio/ember_boom.mp3": "bd4066040e", "audio/fire_bolt.mp3": "6e2d4f7d0c", "audio/fire_charge.mp3": "1f378c23ee", "audio/fire_ignite.mp3": "edf04bf62d", "audio/fire_impact.mp3": "7ee39c1492", "audio/fire_lanes.mp3": "ef7e98ec9c", "audio/fire_nova.mp3": "8160baee5b", "audio/fire_storm.mp3": "e6d08a4db6", "audio/fire_sweep.mp3": "aedce6c0dc", "audio/fire_throw.mp3": "8b149e8271", "audio/fire_wall.mp3": "abb4fadfef", "audio/fly_buzz_rise.mp3": "493671e07c", "audio/fly_dive.mp3": "b67cd3971e", "audio/frog_plop.mp3": "458f6197b2", "audio/goo_splat.mp3": "7c3a657a62", "audio/hero_dash.mp3": "7c2214279d", "audio/hero_death.mp3": "543edf2018", "audio/hero_drink.mp3": "90457a492f", "audio/hero_grunt_a.mp3": "7711275982", "audio/hero_grunt_b.mp3": "a1d01725b6", "audio/hero_grunt_c.mp3": "ddd6f0932f", "audio/hero_hurt.mp3": "1521a1e237", "audio/hero_hurt_heavy.mp3": "62acfb7cfe", "audio/hero_jump.mp3": "ddaa93a956", "audio/hero_jump_land.mp3": "b8562e69e1", "audio/knife_throw.mp3": "f17f1a7258", "audio/magic_buff.mp3": "1f436ba43b", "audio/mus_chest.mp3": "50f4e298b9", "audio/mus_fight.json": "3e059e091d", "audio/mus_fight.mp3": "b6e5bf0a34", "audio/riposte_strike.mp3": "85d3ffe244", "audio/sword_clang.mp3": "c93f8d6a7b", "audio/sword_hit.mp3": "e109de06bd", "audio/sword_hit_heavy.mp3": "e26e2c0ed0", "audio/sword_swing_1.mp3": "5f0afcb30e", "audio/sword_swing_2.mp3": "4922bf432c", "audio/sword_swing_3.mp3": "b32927eae4", "audio/toad_arrive.mp3": "2ff950ec7c", "audio/toad_croak.mp3": "35af673fc7", "audio/toad_crouch_gulp.mp3": "7bf38ea7ff", "audio/toad_death.mp3": "de9d631b6e", "audio/toad_enrage.mp3": "6b04fccb57", "audio/toad_flies.mp3": "9ac82acab0", "audio/toad_hop.mp3": "99a7e84483", "audio/toad_hurt.mp3": "d78a79bafd", "audio/toad_land.mp3": "5c47ba258e", "audio/toad_pain_a.mp3": "d1252dad35", "audio/toad_pain_b.mp3": "ba4a11b1ff", "audio/toad_pain_c.mp3": "67935973f2", "audio/toad_phase.mp3": "6dfaac5af1", "audio/toad_spit.mp3": "4170069086", "audio/toad_throat_fill.mp3": "c4cc5487e6", "audio/toad_tongue_draw.mp3": "4d4ec5ab8f", "audio/toad_tongue_lash.mp3": "0c3f37958a", "audio/water_splash.mp3": "9a5ce2b388", "audio/water_splash_big.mp3": "a689bd3f59" };
var MODS3D = globalThis.__TB_MODS3D || [];
function stampUrl(u) {
  if (!RELEASE || typeof u !== "string" || !/^(art|art3d|audio)\/[^?#]+$/.test(u))
    return u;
  const f = FILES[u];
  if (!f)
    return `${u}?v=${RELEASE}`;
  const [v, as] = f.split(":");
  return `${as ? `${u}.${as}` : u}?v=${v}`;
}

// site/js/gfx/painted.js
var cache = new Map;
function loadImage(url) {
  if (cache.has(url))
    return cache.get(url);
  const p = new Promise((resolve) => {
    const im = new Image;
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = stampUrl(url);
  });
  cache.set(url, p);
  return p;
}
async function loadArt(base) {
  return await loadImage(`${base}.webp`) || await loadImage(`${base}.png`);
}
async function loadPainting(name) {
  const img = await loadArt(`art/${name}`);
  if (!img)
    return null;
  return { img, w: img.width, h: img.height };
}
function asSprite(img, ax = 0.5, ay = 0.5, ppu = 1) {
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0);
  return { cv, w: cv.width, h: cv.height, ax: cv.width * ax, ay: cv.height * ay, ppu, smooth: true };
}

// site/js/sim/hazards.js
var KIND = { CIRCLE: "circle", RING: "ring", CONE: "cone", LANE: "lane", WAVE: "wave", FLOOD: "flood" };
var jumpable = (h) => h.low ?? (h.kind === KIND.RING || h.kind === KIND.WAVE);
var nextId = 1;
function hazard(opts, id = nextId++) {
  return {
    id,
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
    sweep: 0,
    spin: 0,
    vx: 0,
    vy: 0,
    style: "hot",
    t: 0,
    done: false,
    cool: 0,
    hitOnce: false,
    tag: "",
    ...opts
  };
}
var shown = (h) => h.t >= (h.hidden || 0);
var phaseOf = (h) => h.t < h.tele ? "tele" : h.t < h.tele + h.active ? "active" : "fade";
var teleK = (h) => clamp(h.t / Math.max(0.0001, h.tele), 0, 1);
var SWEEP0 = 0.12;
function radiusOf(h) {
  const p = phaseOf(h);
  if (p === "tele")
    return h.grow ? h.r0 + (h.r - h.r0) * teleK(h) : h.r;
  const live = h.t - h.tele;
  if (h.sweep)
    return h.r * (SWEEP0 + (1 - SWEEP0) * clamp(live / h.sweep, 0, 1));
  return h.r + h.expand * live;
}
function stepHazard(h, dt) {
  h.t += dt;
  if (phaseOf(h) === "active") {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.a += h.spin * dt;
    if (h.cool > 0)
      h.cool -= dt;
  }
  if (h.t >= h.tele + h.active + h.fade)
    h.done = true;
}
function laneSpan(h) {
  if (!h.advance || phaseOf(h) === "tele")
    return [0, h.len];
  const front = h.advance * (h.t - h.tele);
  return [clamp(front - h.band, 0, h.len), clamp(front, 0, h.len)];
}
function hits(h, px, py, pr) {
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
      if (d > r + pr || d < h.r0 - pr)
        return false;
      if (d < 1)
        return true;
      const a = Math.atan2(dy, dx);
      const slack = Math.atan2(pr, Math.max(4, d));
      return Math.abs(angleDiff(h.a, a)) <= h.half + slack;
    }
    case KIND.FLOOD: {
      for (const [sx, sy, sr] of h.safe)
        if (Math.hypot(px - sx, py - sy) <= sr - pr * 0.4)
          return false;
      return true;
    }
    case KIND.LANE: {
      const ux = Math.cos(h.a);
      const uy = Math.sin(h.a);
      const along = dx * ux + dy * uy;
      const across = Math.abs(-dx * uy + dy * ux);
      const [s0, s1] = laneSpan(h);
      if (s1 <= s0)
        return false;
      const out = Math.max(0, s0 - along, along - s1);
      const side = Math.max(0, across - h.w / 2);
      return Math.hypot(out, side) <= pr;
    }
    default:
      return false;
  }
}
function damageFor(h, px, py, pr) {
  if (phaseOf(h) !== "active")
    return 0;
  if (!h.every && h.hitOnce)
    return 0;
  if (h.every && h.cool > 0)
    return 0;
  if (!hits(h, px, py, pr))
    return 0;
  if (h.every)
    h.cool = h.every;
  else
    h.hitOnce = true;
  return h.dmg;
}
function sourceOf(h, px, py) {
  if (h.kind === KIND.WAVE || h.kind === KIND.RING) {
    const a = Math.atan2(py - h.y, px - h.x);
    return [h.x + Math.cos(a) * (radiusOf(h) - 10), h.y + Math.sin(a) * (radiusOf(h) - 10)];
  }
  return [h.x, h.y];
}

// site/js/content/climb.js
var CLIMB = {
  gap: 0.05,
  claws: [0.17, 0.5],
  rip: 0.42,
  legs: [0.66, 0.69, 0.71, 0.73, 0.67, 0.7, 0.71, 0.74],
  reach: 0.05,
  stand: 0.9,
  hole: [-26, 0],
  holeR: [56, 46],
  face0: 2.6665,
  gap0: [0, -22],
  opens: [[0.05, 0.28], [0.17, 0.52], [0.3, 0.6], [0.42, 1]],
  clawAt: 0.45,
  inside: 0.82,
  raise: 0.3,
  lip: 1.05,
  tuck: 0.1,
  punch: 5,
  crawl: [0.82, 0.87],
  step: 0.04,
  shift: 30,
  body: [[0, 1, 0.96], [0.12, 0.95, 0.96], [0.3, 0.74, 0.96], [0.42, 0.62, 0.92], [0.5, 0.42, 0.72], [0.58, 0.3, 0.58], [0.64, 0.2, 0.48], [0.72, 0.08, 0.22], [0.84, 0.05, 0.15], [0.94, 0, 0], [1, 0, 0]],
  dive: [[0, 0, 0], [0.06, 0, 0], [0.16, 0.05, 0.15], [0.28, 0.08, 0.22], [0.36, 0.2, 0.48], [0.42, 0.3, 0.58], [0.5, 0.42, 0.72], [0.58, 0.62, 0.92], [0.7, 0.74, 0.96], [0.88, 0.95, 0.96], [1, 1, 0.96]],
  diveWarp: [[0, 1], [0.6, 0.56], [1, 0]],
  burrowK: 1.1,
  burrowTurn: 0.45,
  burrowAt: [-26, 0],
  burrowFoot: 80,
  clawFold: [[1.4, 0.9], 0.66, 0.54]
};
var EDGE = [0.881, 0.899, 0.922, 0.948, 0.976, 1.01, 1.05, 1.077, 1.073, 1.054, 1.043, 1.047, 1.057, 1.059, 1.053, 1.048, 1.046, 1.044, 1.042, 1.042, 1.05, 1.067, 1.082, 1.079, 1.067, 1.055, 1.044, 1.035, 1.033, 1.041, 1.061, 1.085, 1.1, 1.109, 1.112, 1.098, 1.074, 1.05, 1.026, 1.005, 0.989, 0.974, 0.961, 0.951, 0.944, 0.936, 0.928, 0.923, 0.923, 0.926, 0.925, 0.912, 0.896, 0.885, 0.882, 0.884, 0.889, 0.897, 0.905, 0.907, 0.903, 0.898, 0.895, 0.895, 0.902, 0.912, 0.925, 0.938, 0.951, 0.96, 0.965, 0.971, 0.978, 0.982, 0.979, 0.97, 0.961, 0.957, 0.958, 0.963, 0.968, 0.97, 0.967, 0.955, 0.936, 0.915, 0.897, 0.881, 0.868, 0.857, 0.85, 0.846, 0.847, 0.85, 0.857, 0.867];
CLIMB.edge = EDGE;
function holeEdge(a) {
  const E = CLIMB.edge, n = E.length, t = (a / (Math.PI * 2) % 1 + 1) % 1 * n, i = Math.floor(t) % n, f = t - Math.floor(t);
  return E[i] + (E[(i + 1) % n] - E[i]) * f;
}
function rimToward(p, k = 1, open = 1, c = CLIMB.hole) {
  const [RX, RY] = CLIMB.holeR, a = Math.atan2((p[1] - c[1]) / RY, (p[0] - c[0]) / RX), e = holeEdge(a) * k * open;
  return [c[0] + RX * e * Math.cos(a), c[1] + RY * e * Math.sin(a)];
}
function rimAt(a, k = 1, open = 1, c = CLIMB.hole) {
  const [RX, RY] = CLIMB.holeR, e = holeEdge(a) * k * open;
  return [c[0] + RX * e * Math.cos(a), c[1] + RY * e * Math.sin(a)];
}
function gapAt(u, H = HOLE0, out = { open: 0, c: [0, 0] }) {
  let open = 0;
  for (const [at, o] of CLIMB.opens)
    if (u >= at)
      open = o;
  const m = Math.min(1, Math.max(0, (open - CLIMB.opens[0][1]) / (1 - CLIMB.opens[0][1]))), { g0: g, c: h } = H;
  out.open = open * H.k;
  out.c[0] = g[0] + (h[0] - g[0]) * m;
  out.c[1] = g[1] + (h[1] - g[1]) * m;
  return out;
}
function climbPose(u, K = CLIMB.body) {
  for (let i = 1;i < K.length; i++) {
    if (u > K[i][0] && i < K.length - 1)
      continue;
    const [u0, d0, p0] = K[i - 1], [u1, d1, p1] = K[i];
    const k = 1 - (1 - Math.min(1, Math.max(0, (u - u0) / (u1 - u0)))) ** 3;
    return { depth: d0 + (d1 - d0) * k, pitch: p0 + (p1 - p0) * k };
  }
  return { depth: 0, pitch: 0 };
}
var HOLE0 = Object.freeze({ c: CLIMB.hole, g0: CLIMB.gap0, k: 1, a0: 0 });
var turnTo = (face) => {
  const d = (CLIMB.face0 ?? face) - face, c = Math.cos(d), s = Math.sin(d);
  return { his: ([f, r]) => [f * c - r * s, f * s + r * c], hole: ([f, r]) => [f * c + r * s, -f * s + r * c] };
};
var holes = new Map;
function holeFor(face) {
  let H = holes.get(face);
  if (H)
    return H;
  if (holes.size > 16)
    holes.clear();
  const { hole } = turnTo(face);
  H = Object.freeze({ c: hole(CLIMB.burrowAt), g0: hole(CLIMB.gap0), k: CLIMB.burrowK, a0: face - (CLIMB.face0 ?? face) });
  holes.set(face, H);
  return H;
}
function divePose(u, w = 0.035) {
  let d = 0, p = 0;
  for (let i = -2;i <= 2; i++) {
    const q = climbPose(Math.min(1, Math.max(0, u + i * w / 2)));
    d += q.depth, p += q.pitch;
  }
  return { depth: d / 5, pitch: p / 5 };
}
function burrowFace(want) {
  const wrap = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
  const f0 = CLIMB.face0, base = Math.abs(wrap(want - f0)) <= Math.PI / 2 ? f0 : f0 + Math.PI;
  return base + Math.min(CLIMB.burrowTurn, Math.max(-CLIMB.burrowTurn, wrap(want - base)));
}
function diveU(s) {
  const W = CLIMB.diveWarp;
  if (s <= 0)
    return W[0][1];
  for (let i = 1;i < W.length; i++)
    if (s <= W[i][0])
      return W[i - 1][1] + (W[i][1] - W[i - 1][1]) * (s - W[i - 1][0]) / (W[i][0] - W[i - 1][0]);
  return W[W.length - 1][1];
}
function holeWorld(x, y, fr, out = { x: 0, y: 0 }) {
  const f0 = CLIMB.face0, c = Math.cos(f0), s = Math.sin(f0);
  out.x = x + fr[0] * c - fr[1] * s;
  out.y = y + fr[0] * s + fr[1] * c;
  return out;
}
function rimDist(dx, dy, open) {
  const f0 = CLIMB.face0, c = Math.cos(f0), s = Math.sin(f0), [RX, RY] = CLIMB.holeR;
  const lf = dx * c + dy * s, lr = -dx * s + dy * c, n = Math.hypot(lf / RX, lr / RY);
  if (n < 0.000000001)
    return open * RY * 0.85;
  return open * holeEdge(Math.atan2(lr / RY, lf / RX)) * Math.hypot(lf, lr) / n;
}
var HOLE_FIT = [[1, 13, 13]];
function fitHole(w, c, open, pts = null, rings = HOLE_FIT) {
  const f0 = CLIMB.face0, cf = Math.cos(f0), sf = Math.sin(f0), [RX, RY] = CLIMB.holeR, q = { x: 0, y: 0 }, S = w.bell?.solids || [];
  let best = 0, bx = 0, by = 0;
  const need = (px, py, m, br) => {
    if (m != null) {
      q.x = px, q.y = py;
      w.arena?.keep?.(q, m, true);
      const dx = q.x - px, dy = q.y - py, L = dx * dx + dy * dy;
      if (L > best)
        best = L, bx = dx, by = dy;
    }
    if (br != null)
      for (let j = 0;j < S.length; j++) {
        const ex = px - S[j][0], ey = py - S[j][1], d = Math.hypot(ex, ey), t = S[j][2] + br;
        if (d >= t)
          continue;
        const k = (t - d) / (d || 1), L = (t - d) ** 2;
        if (L > best)
          best = L, bx = ex * k, by = ey * k;
      }
  };
  for (let round = 0;round < 16; round++) {
    best = 0;
    for (const [out, m, br] of rings)
      for (let i = 0;i < 24; i++) {
        const a = i / 24 * Math.PI * 2, e = open * out * holeEdge(a), lf = RX * e * Math.cos(a), lr = RY * e * Math.sin(a);
        need(c.x + lf * cf - lr * sf, c.y + lf * sf + lr * cf, m, br);
      }
    if (pts)
      for (const [dx, dy, m, br] of pts)
        need(c.x + dx, c.y + dy, m, br);
    if (best < 0.01)
      return true;
    c.x += bx;
    c.y += by;
  }
  return false;
}

// site/js/content/bosses.js
var SLAM_SWEEP2 = 0.3;
var SLAM_R2 = 55;
var SLAM_R_SMALL2 = 51;
var beats = (...list) => list.sort((a, b) => a.at - b.at);
var gnasherClassic = {
  id: "gnasher",
  music: false,
  tier: 1,
  name: "Gnasher",
  title: "the Meadow Toad",
  blurb: "The meadow's oldest resident. He has kept this garden since the first bell, and he does not share.",
  arena: "bog",
  art: "gnasher",
  hp: 350,
  radius: 26,
  body: 15,
  hurt: [16.5, 15],
  hitH: 34,
  entrance: "bell",
  contact: 14,
  poise: 130,
  moveSpeed: 26,
  gap: [0.85, 1.35],
  phases: [
    { at: 1, moves: ["lash", "hop", "croak"], gapScale: 1 },
    { at: 0.6, moves: ["lash", "hop", "croak", "spit", "doubleLash", "hold"], gapScale: 0.85, line: "He puffs up, and the meadow goes quiet." },
    { at: 0.3, moves: ["lash", "hop", "spit", "flies", "frenzy", "doubleLash", "hold"], gapScale: 0.7, line: "Gnasher stops waiting." }
  ],
  moves: {
    lash: {
      weight: 3,
      dur: 1.5,
      clip: "gape",
      track: 0.3,
      motion: [{ at: 0.72, dur: 0.18, dist: 14 }],
      beats: beats({
        at: 0,
        do(w, b) {
          const a = w.aimAtPlayer();
          b.face = a;
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 210, w: 26, tele: 0.8, active: 0.16, fade: 0.3, dmg: 17, tag: "lash", low: true, follow: true });
        }
      }, { at: 0.72, do: (w, b) => (w.clip(b, "lash"), w.shake(3), w.sound("lash")) }),
      recover: 0.95
    },
    hop: {
      weight: 2.5,
      dur: 1.85,
      clip: "crouch",
      track: 0.44,
      beats: beats({
        at: 0.45,
        do(w, b) {
          const p = w.player;
          b.jumpTo = [p.x, p.y];
          w.clip(b, "leap");
          w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: SLAM_R2, tele: 0.85, active: SLAM_SWEEP2 + 0.03, sweep: SLAM_SWEEP2, fade: 0.35, dmg: 22, tag: "slam" });
          w.sound("hop");
        }
      }, {
        at: 1.3,
        do(w, b) {
          if (b.jumpTo)
            b.x = b.jumpTo[0], b.y = b.jumpTo[1], b.jumpTo = null;
          w.clip(b, "idle");
          w.shake(8);
          w.sound("slam");
          w.landed(b);
        }
      }),
      recover: 0.8,
      airborne: [0.45, 1.3]
    },
    croak: {
      weight: 1.6,
      dur: 2.6,
      clip: "croak",
      cast: { name: "Croak", from: 0.15, to: 2.2, heal: 0.05 },
      beats: beats({ at: 0.15, do: (w) => w.sound("cast") }, {
        at: 2.2,
        do(w, b) {
          w.heal(b, b.hpMax * 0.05);
          w.say("Gnasher swallows his wounds.");
        }
      }),
      recover: 0.7,
      minHp: 0.25
    },
    spit: {
      weight: 2,
      dur: 1.5,
      clip: "gape",
      track: 0.5,
      beats: beats({
        at: 0.55,
        do(w, b) {
          const a = w.aimAtPlayer();
          for (const off of [-0.44, 0, 0.44])
            w.shot({ x: b.x, y: b.y - 10, a: a + off, speed: 96, r: 7, dmg: 14, art: "bog", life: 4, tag: "glob" });
          w.clip(b, "lash");
          w.sound("spit");
        }
      }),
      recover: 0.7
    },
    doubleLash: {
      weight: 2.2,
      dur: 3.5,
      clip: "gape",
      motion: [
        { at: 0.62, dur: 0.16, dist: 12 },
        { at: 1.62, dur: 0.16, dist: 16 },
        { at: 2.62, dur: 0.16, dist: 16 }
      ],
      beats: beats({
        at: 0,
        do(w, b) {
          b.face = w.aimAtPlayer();
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 190, w: 24, tele: 0.62, active: 0.14, fade: 0.25, dmg: 15, tag: "lash", low: true });
        }
      }, { at: 0.62, do: (w, b) => (w.clip(b, "lash"), w.shake(3), w.sound("lash")) }, {
        at: 1,
        do(w, b) {
          const a = w.aimAtPlayer();
          b.face = a;
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 200, w: 28, tele: 0.62, active: 0.16, fade: 0.3, dmg: 18, tag: "lash", low: true });
          w.clip(b, "gape");
        }
      }, { at: 1.62, do: (w, b) => (w.clip(b, "lash"), w.shake(5), w.sound("lash")) }, {
        at: 2,
        do(w, b) {
          const a = w.aimAtPlayer();
          b.face = a;
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 200, w: 28, tele: 0.62, active: 0.16, fade: 0.3, dmg: 18, tag: "lash", low: true });
          w.clip(b, "gape");
        }
      }, { at: 2.62, do: (w, b) => (w.clip(b, "lash"), w.shake(6), w.sound("lash")) }),
      recover: 1.15
    },
    hold: {
      weight: 1.8,
      dur: 2.9,
      clip: "croak",
      track: 1.25,
      motion: [{ at: 1.72, dur: 0.22, dist: 26, pow: 3 }],
      beats: beats({ at: 0.2, do: (w, b) => (w.clip(b, "crouch"), w.sound("cast")) }, {
        at: 1.25,
        do(w, b) {
          w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.62, r: 92, tele: 0.72, active: 0.18, fade: 0.35, dmg: 24, tag: "hold" });
        }
      }, { at: 1.72, do: (w, b) => w.clip(b, "lash") }, { at: 1.95, do: (w) => (w.shake(9), w.sound("slam")) }, { at: 2.2, do: (w, b) => w.clip(b, "idle") }),
      recover: 1
    },
    flies: {
      weight: 1.4,
      dur: 1.9,
      clip: "croak",
      once: 2,
      beats: beats({
        at: 1,
        do(w, b) {
          for (let i = 0;i < 3; i++) {
            const a = i / 3 * TAU + w.rand() * 0.6;
            w.add("fly", b.x + Math.cos(a) * 44, b.y + Math.sin(a) * 44);
          }
          w.say("Flies boil out of the mud.");
          w.sound("swarm");
        }
      }),
      recover: 0.6
    },
    frenzy: {
      weight: 2,
      dur: 3.2,
      clip: "crouch",
      beats: beats(...[0, 1, 2].flatMap((i) => [
        {
          at: 0.25 + i * 1,
          do(w, b) {
            const p = w.player;
            b.jumpTo = [p.x + (w.rand() - 0.5) * 30, p.y + (w.rand() - 0.5) * 30];
            w.clip(b, "leap");
            w.sound("hop");
            w.hazard({ kind: KIND.CIRCLE, x: b.jumpTo[0], y: b.jumpTo[1], r: SLAM_R_SMALL2, tele: 0.57, active: SLAM_SWEEP2 + 0.03, sweep: SLAM_SWEEP2, fade: 0.25, dmg: 16, tag: "slam" });
          }
        },
        {
          at: 0.82 + i * 1,
          do(w, b) {
            if (b.jumpTo)
              b.x = b.jumpTo[0], b.y = b.jumpTo[1], b.jumpTo = null;
            w.shake(6);
            w.sound("slam");
            w.landed(b, true);
            w.clip(b, "idle");
          }
        }
      ])),
      recover: 0.9
    }
  }
};
var C = gnasherClassic.moves;
var ACID_R = 32;
var ACID_LIVE = 5;
var gnasher = {
  ...gnasherClassic,
  turnRate: 2.6,
  souls: {
    dmg: 1.75,
    recover: true,
    gap: [0.2, 0.45],
    staggerAnytime: true,
    poiseRegen: 13,
    crit: 2.5,
    critStop: 0.2,
    critShake: 12,
    iFrames: 0.08,
    drinkLock: 0.5,
    range: true,
    phasePause: 1.8,
    answers: { move: "squash", greed: [3, 2.5], back: [60, 1.92, 0.8], drink: [150, "lash"], chase: { after: ["lash"], dist: 110, p: 0.5, move: "hop" } }
  },
  moves: {
    squash: {
      clip: "crouch",
      dur: 0.95,
      hops: [[0.3, 0.87]],
      beats: beats({ at: 0, do: (w) => w.sound("windHop") }, {
        at: 0.3,
        do(w, b) {
          b.jumpTo = [b.x, b.y];
          w.clip(b, "leap");
          w.sound("hop");
          w.hazard({ kind: KIND.CIRCLE, x: b.x, y: b.y, r: SLAM_R_SMALL2, tele: 0.57, active: SLAM_SWEEP2 + 0.03, sweep: SLAM_SWEEP2, fade: 0.25, dmg: 18, tag: "slam" });
        }
      }, {
        at: 0.87,
        do(w, b) {
          if (b.jumpTo)
            b.x = b.jumpTo[0], b.y = b.jumpTo[1], b.jumpTo = null;
          w.shake(6);
          w.sound("slam");
          w.landed(b, true);
          w.clip(b, "recover");
        }
      }),
      recover: 0.9
    },
    lash: {
      ...C.lash,
      range: [40, 220],
      beats: beats({
        at: 0,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 0.15);
          w.sound("windLash");
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 210, w: 26, tele: 0.8, active: 0.1, fade: 0.3, dmg: 17, tag: "lash", low: true, follow: true });
        }
      }, { at: 0.72, do: (w, b) => (w.clip(b, "lash"), w.shake(3), w.sound("lash")) }),
      recover: 0.5
    },
    hop: {
      ...C.hop,
      range: [70, Infinity],
      recover: 1.3,
      beats: beats({ at: 0, do: (w) => w.sound("windHop") }, ...C.hop.beats.map((bt) => bt.at === 1.3 ? { at: 1.3, do: (w, b) => (bt.do(w, b), w.clip(b, "recover")) } : bt))
    },
    croak: { ...C.croak, range: [70, Infinity], recover: 0.4 },
    spit: {
      ...C.spit,
      range: [60, Infinity],
      beats: beats({
        at: 0.55,
        do(w, b) {
          const at = { x: w.player.x, y: w.player.y };
          w.turnBossToward(Math.atan2(at.y - b.y, at.x - b.x), 0.4);
          w.arena?.keep?.(at, ACID_R * 0.5);
          w.hazard({ kind: KIND.CIRCLE, x: at.x, y: at.y, r: ACID_R, tele: 0.9, active: ACID_LIVE, fade: 0.8, dmg: 7, every: 0.5, tag: "acid", low: true, from: [b.x, b.y] });
          w.clip(b, "lash");
          w.sound("spit");
        }
      }),
      recover: 0.45
    },
    doubleLash: {
      ...C.doubleLash,
      range: [40, 220],
      beats: beats({
        at: 0,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 0.35);
          w.sound("windLash");
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 190, w: 24, tele: 0.62, active: 0.1, fade: 0.25, dmg: 15, tag: "lash", low: true });
        }
      }, { at: 0.62, do: (w, b) => (w.clip(b, "lash"), w.shake(3), w.sound("lash")) }, {
        at: 1,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 0.65);
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 200, w: 28, tele: 0.62, active: 0.1, fade: 0.3, dmg: 18, tag: "lash", low: true });
          w.clip(b, "gape");
        }
      }, { at: 1.62, do: (w, b) => (w.clip(b, "lash"), w.shake(5), w.sound("lash")) }, {
        at: 2,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 0.65);
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 200, w: 28, tele: 0.62, active: 0.1, fade: 0.3, dmg: 18, tag: "lash", low: true });
          w.clip(b, "gape");
        }
      }, { at: 2.62, do: (w, b) => (w.clip(b, "lash"), w.shake(6), w.sound("lash")) }),
      recover: 1.3
    },
    hold: {
      ...C.hold,
      range: [0, 80],
      beats: beats({ at: 0.2, do: (w, b) => (w.clip(b, "crouch"), w.sound("cast")) }, { at: 1.25, do: (w, b) => w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.62, r: 92, tele: 0.72, active: 0.1, fade: 0.35, dmg: 24, tag: "hold" }) }, { at: 1.4, do: (w, b) => (w.clip(b, "rear"), w.sound("windHold")) }, { at: 1.72, do: (w, b) => w.clip(b, "lash") }, { at: 1.95, do: (w) => (w.shake(9), w.sound("slam")) }),
      recover: 1.4
    },
    flies: {
      ...C.flies,
      beats: beats({
        at: 1,
        do(w, b) {
          for (let i = 0;i < 3; i++) {
            const a = i / 3 * TAU + w.rand() * 0.6;
            w.add("diver", b.x + Math.cos(a) * 44, b.y + Math.sin(a) * 44);
          }
          w.say("Flies boil out of the mud.");
          w.sound("swarm");
        }
      }),
      recover: 0.5
    },
    frenzy: {
      ...C.frenzy,
      range: [0, 120],
      recover: 1.4,
      hops: [0, 1, 2].map((i) => [0.25 + i, 0.82 + i]),
      beats: beats(...[0, 1, 2].flatMap((i) => [
        {
          at: 0.25 + i,
          do(w, b) {
            const p = w.player;
            b.jumpTo = [p.x + (w.rand() - 0.5) * 30, p.y + (w.rand() - 0.5) * 30];
            w.clip(b, "leap");
            w.sound("hop");
            w.hazard({ kind: KIND.CIRCLE, x: b.jumpTo[0], y: b.jumpTo[1], r: SLAM_R_SMALL2, tele: 0.57, active: SLAM_SWEEP2 + 0.03, sweep: SLAM_SWEEP2, fade: 0.25, dmg: 22, tag: "slam" });
          }
        },
        {
          at: 0.82 + i,
          do(w, b) {
            if (b.jumpTo)
              b.x = b.jumpTo[0], b.y = b.jumpTo[1], b.jumpTo = null;
            w.shake(6);
            w.sound("slam");
            w.landed(b, true);
            w.clip(b, i === 2 ? "recover" : "idle");
          }
        }
      ]))
    },
    hopLash: {
      ...C.hop,
      dur: 2.4,
      range: [70, Infinity],
      beats: beats({ at: 0, do: (w) => w.sound("windHop") }, ...C.hop.beats.filter((x) => x.at < 1.3), {
        at: 1.3,
        do(w, b) {
          if (b.jumpTo)
            b.x = b.jumpTo[0], b.y = b.jumpTo[1], b.jumpTo = null;
          w.shake(8);
          w.sound("slam");
          w.landed(b);
          w.clip(b, "gape");
          w.sound("windLash");
          w.turnBossToward(w.aimAtPlayer(), 0.6);
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 200, w: 26, tele: 0.62, active: 0.1, fade: 0.3, dmg: 17, tag: "lash", low: true });
        }
      }, { at: 1.84, do: (w, b) => (w.clip(b, "lash"), w.shake(4), w.sound("lash")) }),
      recover: 1
    }
  },
  phases: gnasherClassic.phases.map((ph, i) => i === 2 ? { ...ph, moves: ph.moves.map((n) => n === "hop" ? "hopLash" : n) } : ph)
};
var rainBeats = () => [
  ...[0, 1, 2, 3, 4].map((i) => ({
    at: 0.2 + i * 0.24,
    do(w) {
      const p = w.player;
      const a = w.rand() * TAU;
      const d = i === 0 ? 0 : 20 + w.rand() * 70;
      w.hazard({ kind: KIND.CIRCLE, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 30, tele: 1, active: 0.16, fade: 0.3, dmg: 18, tag: "rain" });
    }
  })),
  { at: 1.2, do: (w) => w.sound("fire") }
];
var cinderClassic = {
  id: "cinder",
  tier: 2,
  name: "Sister Cinder",
  title: "of the Ash Floor",
  blurb: "She tended the shrine's fire until it answered her. Now she feeds it everyone who comes.",
  arena: "ash",
  art: "cinder",
  entrance: "bell",
  mechanics: ["bubble", "cinderOpening", "cinderSeal"],
  opening: {
    card: 0.3,
    pop: 2.6,
    shock: { speed: 300, push: 70, time: 0.55 },
    spin: [3.5, 4.9],
    mark: 4.9,
    fire: 6.2,
    descend: [6.5, 7.6],
    settle: 7.6,
    end: 7.8,
    wall: { w: 36, speed: 125, band: 30, fade: 0.4, dmg: 24 }
  },
  hp: 800,
  radius: 20,
  body: 8,
  hurt: [6.5, 11],
  hitH: 46,
  contact: 12,
  poise: 150,
  moveSpeed: 44,
  drift: true,
  gap: [0.75, 1.15],
  phases: [
    { at: 1, moves: ["lanes", "rain", "nova"], gapScale: 1 },
    { at: 0.65, moves: ["lanes", "rain", "nova", "veil", "chase", "sweep", "seal"], gapScale: 0.88, line: "Ash gathers round her." },
    { at: 0.3, moves: ["storm", "rain", "nova", "chase", "veil", "sweep", "seal"], gapScale: 0.72, line: "The floor remembers every fire." }
  ],
  moves: {
    lanes: {
      weight: 3,
      dur: 2,
      clip: "cast",
      beats: beats({
        at: 0.1,
        do(w, b) {
          const a = w.aimAtPlayer() + (w.rand() - 0.5) * 0.5;
          for (const off of [0, Math.PI / 2]) {
            w.hazard({ kind: KIND.LANE, x: b.x - Math.cos(a + off) * 200, y: b.y - Math.sin(a + off) * 200, a: a + off, len: 400, w: 30, tele: 1.05, active: 0.2, fade: 0.3, dmg: 24, tag: "lane" });
          }
        }
      }, { at: 1.15, do: (w, b) => (w.shake(5), w.sound("fire"), w.clip(b, "idle")) }, {
        at: 1.2,
        do(w, b) {
          for (let i = 0;i < 4; i++) {
            const a = w.rand() * TAU;
            const d = w.rand() * 90;
            w.hazard({ kind: KIND.CIRCLE, x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r: 22, tele: 0.5, active: 3.4, fade: 0.5, dmg: 8, every: 0.55, style: "cold", tag: "burn" });
          }
        }
      }),
      recover: 0.85
    },
    rain: {
      weight: 2.6,
      dur: 2.8,
      clip: "cast",
      beats: beats(...rainBeats()),
      recover: 0.75
    },
    seal: {
      weight: 1.2,
      dur: 2.8,
      clip: "cast",
      once: 2,
      seal: { at: 0.9, ring: 0.3, rest: 30, shock: 260 },
      beats: beats(...rainBeats(), { at: 0, do: (w) => w.sound("bubbleSeal") }, { at: 0.9, do: (w, b) => w.act("seal", b) }),
      recover: 0.75
    },
    nova: {
      weight: 2.2,
      dur: 2.3,
      clip: "nova",
      beats: beats({ at: 0.1, do: (w, b) => w.hazard({ kind: KIND.RING, x: b.x, y: b.y, r: 60, r0: 34, tele: 1.15, active: 0.7, fade: 0.25, expand: 180, dmg: 24, tag: "nova" }) }, { at: 1.25, do: (w, b) => (w.shake(7), w.sound("nova")) }),
      recover: 0.9
    },
    veil: {
      weight: 1.8,
      dur: 6.4,
      clip: "veil",
      immune: [0.5, 5.6],
      beats: beats({
        at: 0.5,
        do(w, b) {
          w.clip(b, "veiled");
          w.say("Ash Veil — break the embers.");
          w.sound("veil");
          for (let i = 0;i < 3; i++) {
            const a = i / 3 * TAU + 0.5;
            w.add("ember", b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 60);
          }
        }
      }, {
        at: 5.6,
        do(w, b) {
          w.clip(b, "idle");
          for (const a of w.adds)
            if (a.type === "ember" && a.alive)
              w.detonate(a, 26, 48);
        }
      }),
      recover: 0.8
    },
    sweep: {
      weight: 2.2,
      dur: 2.6,
      clip: "cast",
      track: 0.55,
      motion: [{ at: 0.8, dur: 0.85, dist: 150, pow: 1.6 }],
      beats: beats({ at: 0.55, do: (w) => (w.say("She moves."), w.sound("fire")) }, ...[0, 1, 2, 3, 4, 5].map((i) => ({
        at: 0.82 + i * 0.14,
        do(w, b) {
          w.hazard({ kind: KIND.CIRCLE, x: b.x, y: b.y, r: 24, tele: 0.5, active: 2.4, fade: 0.4, dmg: 9, every: 0.6, style: "cold", tag: "burn" });
        }
      })), { at: 1.8, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.9
    },
    chase: {
      weight: 1.8,
      dur: 1.6,
      clip: "cast",
      track: 0.6,
      beats: beats({
        at: 0.6,
        do(w, b) {
          w.shot({ x: b.x, y: b.y - 20, a: w.aimAtPlayer(), speed: 74, r: 6, dmg: 20, art: "ember", life: 7, homing: 1.9, tag: "chase" });
          w.sound("fire");
        }
      }),
      recover: 0.7
    },
    storm: {
      weight: 2.6,
      dur: 4.4,
      clip: "cast",
      beats: beats({
        at: 0.2,
        do(w, b) {
          const dir = w.rand() < 0.5 ? 1 : -1;
          w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: w.aimAtPlayer(), half: 0.45, r: 320, r0: 26, tele: 1, active: 2.6, fade: 0.3, dmg: 20, every: 0.5, spin: dir * 2.5, tag: "storm", hurtsAdds: true });
          w.say("Firestorm.");
        }
      }, { at: 1.2, do: (w) => (w.shake(5), w.sound("storm")) }),
      recover: 1
    }
  }
};
var CC = cinderClassic.moves;
var letGo = (m, at) => ({ ...m, beats: beats(...m.beats, { at, do: (w, b) => w.clip(b, "release") }) });
var cinder = {
  ...cinderClassic,
  turnRate: 3.5,
  souls: { dmg: 1.5, recover: true, gap: [0.2, 0.45], staggerAnytime: true, poiseRegen: 15, crit: 2.5, critStop: 0.2, critShake: 12, iFrames: 0.08, drinkLock: 0.5, range: true, phasePause: 1.8, rollLive: { live: 0.1, tags: ["lane", "rain", "boom"] } },
  moves: {
    ...CC,
    lanes: { ...CC.lanes, range: [90, Infinity], recover: 0.9 },
    rain: letGo({ ...CC.rain, recover: 0.9 }, 1.2),
    nova: { ...CC.nova, range: [0, 100], recover: 1.3 },
    veil: { ...CC.veil, recover: 1.2 },
    chase: letGo({ ...CC.chase, range: [110, Infinity], recover: 0.5 }, 0.6),
    sweep: { ...CC.sweep, range: [60, 230], recover: 1 },
    storm: letGo({ ...CC.storm, recover: 1.4 }, 3.8),
    seal: letGo({ ...CC.seal, recover: 0.8 }, 1.2)
  }
};
var GEYSER = { r: 50, tele: 1, active: 0.6, fade: 0.35, dmg: 20 };
var gratesOf = (w) => w.arena?.grates || [[-70, -20], [-30, 70], [80, 10], [85, 100]];
var geyserAt = (w, [x, y]) => w.hazard({ kind: KIND.CIRCLE, x, y, r: GEYSER.r, tele: GEYSER.tele, active: GEYSER.active, fade: GEYSER.fade, dmg: GEYSER.dmg, tag: "geyser" });
var gratesByNear = (w) => {
  const p = w.player;
  return gratesOf(w).map((g, i) => [Math.hypot(g[0] - p.x, g[1] - p.y), i]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
};
var crabClassic = {
  id: "crab",
  tier: 3,
  name: "The Crystal Crab",
  title: "who carries the cathedral",
  blurb: "A hermit grew too big for any shell, so he took a cathedral. The bells inside it still ring when he walks.",
  arena: "salt",
  art: "king",
  entrance: "bell",
  entranceFrom: "below",
  entranceRise: 1.9,
  entranceSettle: 2.75,
  entranceClips: { leap: "raise", land: "slam", roar: "call" },
  entranceSounds: { leap: "rumble", land: "slam", roar: "enrage" },
  hp: 800,
  radius: 24,
  body: 11,
  hurt: [10, 20],
  hitH: 60,
  frame: { r: 72, top: 107 },
  contact: 16,
  poise: 190,
  moveSpeed: 34,
  gap: [0.85, 1.25],
  turnRate: 1.1,
  blockers: [
    [17.8, 49.6, 6.9],
    [18.1, -50.8, 6.9],
    [-11.3, 64.1, 6.9],
    [-11.2, -63.8, 6.9],
    [-39.1, 61.9, 6.9],
    [-38.8, -62.8, 6.9],
    [-59.3, 46.5, 6.9],
    [-59, -47.3, 6.9],
    [44.4, 27.8, 9.8],
    [55.3, 21.2, 10.3],
    [64.6, 11.6, 9.8]
  ],
  phases: [
    { at: 1, moves: ["slam", "tide", "chain", "grab"], gapScale: 1 },
    { at: 0.65, moves: ["slam", "tide", "chain", "grab", "crossTide", "combo", "geyser", "spin"], gapScale: 0.85, line: "The cathedral's bells begin to hum." },
    { at: 0.3, moves: ["flood", "slam", "crossTide", "grab", "combo", "geyserRoll", "spin"], gapScale: 0.7, line: "Brine floods the flats. Find the shallows." }
  ],
  moves: {
    slam: {
      weight: 3,
      dur: 2.4,
      clip: "raise",
      track: 0.3,
      motion: [{ at: 1.28, dur: 0.2, dist: 22, pow: 3 }],
      beats: beats({
        at: 0.3,
        do(w, b) {
          const p = w.player;
          w.turnBossToward(Math.atan2(p.y - b.y, p.x - b.x), 0.3);
          w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 54, tele: 1.1, active: 0.16, fade: 0.35, dmg: 25, tag: "slam" });
          b.slamAt = [p.x, p.y];
        }
      }, {
        at: 1.4,
        do(w, b) {
          w.clip(b, "slam");
          w.shake(11);
          w.sound("slam");
          const [sx, sy] = b.slamAt || [b.x, b.y];
          w.hazard({ kind: KIND.WAVE, x: sx, y: sy, r: 24, w: 18, tele: 0, active: 0.8, fade: 0.2, expand: 165, dmg: 11, tag: "ripple" });
          w.hazard({ kind: KIND.WAVE, x: sx, y: sy, r: 24, w: 18, tele: 0.34, active: 0.8, fade: 0.2, expand: 165, dmg: 11, tag: "ripple" });
        }
      }, { at: 1.9, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.9
    },
    tide: {
      weight: 2.6,
      dur: 3,
      clip: "call",
      beats: beats({
        at: 0.2,
        do(w, b) {
          const a = w.rand() * TAU;
          const R = 170;
          w.hazard({ kind: KIND.LANE, x: b.x + Math.cos(a) * -R, y: b.y + Math.sin(a) * -R, a, len: R * 2, w: 62, tele: 1.3, active: 0.9, fade: 0.3, dmg: 20, tag: "tide" });
        }
      }, { at: 1.35, do: (w) => (w.shake(6), w.sound("wave")) }, { at: 2.4, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.85
    },
    crossTide: {
      weight: 2.2,
      dur: 3.2,
      clip: "call",
      beats: beats({
        at: 0.2,
        do(w, b) {
          const a = w.rand() * TAU;
          const R = 180;
          for (const off of [0, Math.PI / 2]) {
            const aa = a + off;
            w.hazard({ kind: KIND.LANE, x: b.x + Math.cos(aa) * -R, y: b.y + Math.sin(aa) * -R, a: aa, len: R * 2, w: 54, tele: 1.4, active: 0.85, fade: 0.3, dmg: 21, tag: "tide" });
          }
        }
      }, { at: 1.5, do: (w) => (w.shake(7), w.sound("wave")) }, { at: 2.6, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.9
    },
    grab: {
      weight: 2.2,
      dur: 2.4,
      clip: "grab",
      track: 0.6,
      beats: beats({
        at: 0.6,
        do(w, b) {
          const [x, y] = w.bossPoint(76, 16);
          w.hazard({ kind: KIND.CIRCLE, x, y, r: 26, tele: 0.85, active: 0.15, fade: 0.3, dmg: 12, tag: "grab", grab: { hold: 1.4, dmg: 14, at: [76, 7], toss: { from: [52, 46], out: 52, time: 1 } } });
        }
      }, { at: 1.45, do: (w) => (w.sound("chain"), w.shake(5)) }),
      recover: 0.9
    },
    chain: {
      weight: 2,
      dur: 2.6,
      clip: "idle",
      track: 0.35,
      beats: beats({
        at: 0.2,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 0.2);
          const a = b.face;
          w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 240, w: 20, tele: 0.85, active: 0.18, fade: 0.25, dmg: 12, tag: "chain", pull: true, follow: true });
        }
      }, { at: 0.35, do: (w, b) => w.clip(b, "chain_throw") }, { at: 1.05, do: (w) => (w.sound("chain"), w.shake(4)) }, {
        at: 1.5,
        do(w, b) {
          w.clip(b, "cleave_b");
          w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.7, r: 78, tele: 0.62, active: 0.16, fade: 0.3, dmg: 23, tag: "cleave" });
        }
      }, { at: 2.25, do: (w, b) => (w.shake(8), w.clip(b, "idle")) }),
      recover: 0.8
    },
    combo: {
      weight: 2.6,
      dur: 4.1,
      clip: "cleave_a",
      track: 0.2,
      motion: [
        { at: 0.72, dur: 0.16, dist: 16 },
        { at: 1.74, dur: 0.16, dist: 18 },
        { at: 3, dur: 0.26, dist: 30, pow: 3 }
      ],
      beats: beats({
        at: 0.05,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 0.3);
          w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.72, r: 74, tele: 0.66, active: 0.14, fade: 0.26, dmg: 17, tag: "cleave", follow: true });
        }
      }, { at: 0.72, do: (w) => (w.shake(5), w.sound("slam")) }, {
        at: 1.06,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 1);
          w.clip(b, "cleave_b");
          w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.8, r: 78, tele: 0.66, active: 0.14, fade: 0.26, dmg: 17, tag: "cleave" });
        }
      }, { at: 1.74, do: (w) => (w.shake(6), w.sound("slam")) }, {
        at: 2.1,
        do(w, b) {
          w.turnBossToward(w.aimAtPlayer(), 1);
          w.clip(b, "raise");
          w.hazard({ kind: KIND.CIRCLE, x: b.x + Math.cos(b.face) * 40, y: b.y + Math.sin(b.face) * 40, r: 52, tele: 0.86, active: 0.18, fade: 0.36, dmg: 25, tag: "slam" });
        }
      }, {
        at: 3,
        do(w, b) {
          w.clip(b, "slam");
          w.shake(11);
          w.sound("slam");
          w.hazard({ kind: KIND.WAVE, x: b.x + Math.cos(b.face) * 40, y: b.y + Math.sin(b.face) * 40, r: 18, w: 16, tele: 0, active: 0.6, fade: 0.2, expand: 140, dmg: 10, tag: "ripple" });
        }
      }, { at: 3.55, do: (w, b) => w.clip(b, "idle") }),
      recover: 1.2
    },
    spin: {
      weight: 1.5,
      dur: 2.2,
      clip: "call",
      beats: beats({
        at: 0.15,
        do(w, b) {
          w.hazard({ kind: KIND.CIRCLE, x: b.x, y: b.y, r: 84, tele: 1.5, active: 0.25, fade: 0.35, dmg: 22, tag: "spin" });
          w.sound("chain");
        }
      }, { at: 1.65, do: (w, b) => (w.clip(b, "cleave"), w.shake(8), w.sound("slam")) }, { at: 2.1, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.4
    },
    geyser: {
      weight: 1.5,
      dur: 1.6,
      clip: "raise",
      beats: beats({
        at: 0.45,
        do(w, b) {
          w.clip(b, "slam");
          w.shake(6);
          w.sound("slam");
          const near = gratesByNear(w);
          b.geysers = w.rand() < 0.5 ? near.slice(0, 2) : near.slice(0, 1);
          geyserAt(w, gratesOf(w)[b.geysers[0]]);
        }
      }, { at: 0.9, do: (w, b) => b.geysers?.length > 1 && geyserAt(w, gratesOf(w)[b.geysers[1]]) }, { at: 1.3, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.5
    },
    geyserRoll: {
      weight: 1.7,
      dur: 1.9,
      clip: "raise",
      beats: beats({
        at: 0.45,
        do(w, b) {
          w.clip(b, "slam");
          w.shake(7);
          w.sound("slam");
          const G = gratesOf(w), first = gratesByNear(w)[0];
          const ang = (i) => Math.atan2(G[i][1], G[i][0]);
          const turn = (i) => (ang(i) - ang(first) + 4 * Math.PI) % (2 * Math.PI);
          b.geysers = G.map((_, i) => i).sort((a, c) => turn(a) - turn(c));
          geyserAt(w, G[b.geysers[0]]);
        }
      }, ...[1, 2, 3].map((k) => ({ at: 0.45 + 0.4 * k, do: (w, b) => b.geysers?.[k] != null && geyserAt(w, gratesOf(w)[b.geysers[k]]) })), { at: 1.4, do: (w, b) => w.clip(b, "idle") }),
      recover: 0.6
    },
    flood: {
      weight: 3.4,
      dur: 9,
      clip: "flood",
      beats: beats({ at: 0.2, do: (w) => (w.say("Brine floods the flats."), w.sound("flood"), w.shake(6)) }, ...[0, 1, 2, 3].map((i) => ({
        at: 1.2 + i * 1.9,
        do(w, b) {
          const a = w.rand() * TAU;
          const spots = [
            [Math.cos(a) * 82, Math.sin(a) * 82],
            [Math.cos(a + Math.PI) * 82, Math.sin(a + Math.PI) * 82]
          ].map(([x, y]) => {
            const o = { x, y };
            w.arena?.keep?.(o, 30);
            return [o.x, o.y];
          });
          w.safeZones(spots, 40, 1.1, 1.5);
        }
      })), { at: 8.6, do: (w, b) => (w.clip(b, "idle"), w.say("The water falls back.")) }),
      recover: 1.1,
      immune: [0, 0.6]
    }
  }
};
var KC = crabClassic.moves;
var rebeat = (m, ch) => ({ ...m, beats: beats(...m.beats.flatMap((bt) => {
  const k = Object.keys(ch).find((a) => Math.abs(a - bt.at) < 0.000001);
  return k == null ? [bt] : ch[k] ? [ch[k]] : [];
})) });
var crab = {
  ...crabClassic,
  blockers: crabClassic.blockers.map((bl, i) => i < 8 ? [bl[0], bl[1], 5.5] : bl),
  entranceRise: 2.6,
  entranceAt: [40, 8],
  entranceSettle: 1.5,
  intro: 1.5,
  frameR: 62,
  souls: {
    dmg: 1.5,
    recover: true,
    gap: [0.2, 0.45],
    staggerAnytime: true,
    poiseRegen: 19,
    crit: 2.5,
    critStop: 0.2,
    critShake: 12,
    iFrames: 0.08,
    drinkLock: 0.5,
    range: false,
    phasePause: 1.8,
    rollLive: { live: 0.1, tags: ["slam", "cleave", "grab", "spin", "erupt"] },
    legsSolid: true,
    legs: { n: 8, r: 7, dmg: 0.25, poise: 0.25, cripple: 40, period: 1.2, halt: 0.3, slow: 0.12, line: "His legs falter." }
  },
  phases: crabClassic.phases.map((ph, i) => i ? { ...ph, moves: [...ph.moves, "burrow"] } : ph),
  moves: {
    ...KC,
    slam: rebeat({ ...KC.slam, recover: 1.2 }, { 1.9: null }),
    tide: rebeat({ ...KC.tide, recover: 0.9 }, { 1.35: { at: 1.5, do: (w) => (w.shake(6), w.sound("wave")) } }),
    crossTide: rebeat({ ...KC.crossTide, recover: 1 }, { 1.5: { at: 1.6, do: (w) => (w.shake(7), w.sound("wave")) } }),
    grab: { ...KC.grab, recover: 1.2 },
    chain: rebeat({ ...KC.chain, recover: 0.8 }, { 2.25: { at: 2.12, do: (w) => (w.shake(8), w.sound("clawSwipe")) } }),
    combo: rebeat({ ...KC.combo, recover: 1.5 }, { 0.72: { at: 0.72, do: (w) => (w.shake(5), w.sound("clawSwipe")) }, 1.74: { at: 1.74, do: (w) => (w.shake(6), w.sound("clawSwipe")) } }),
    spin: { ...KC.spin, recover: 1.3 },
    geyser: { ...KC.geyser, recover: 0.6 },
    geyserRoll: { ...KC.geyserRoll, recover: 0.8 },
    flood: { ...KC.flood, recover: 1.4 },
    burrow: crabBurrow()
  }
};
function crabBurrow() {
  const hop = 0.4, land = 0.95, DIVE = [land, 1.6], RISE = [3, 2.4], ROAR = 0.3, CALL = 1.35;
  const pick = DIVE[0] + DIVE[1], up = RISE[0] + RISE[1], rip = RISE[0] + RISE[1] * CLIMB.rip;
  const spotFor = (c, face) => {
    const [f, r] = CLIMB.burrowAt;
    return { x: c.x - (f * Math.cos(face) - r * Math.sin(face)), y: c.y - (f * Math.sin(face) + r * Math.cos(face)) };
  };
  const placeHole = (w, b, c, face) => {
    const co = Math.cos(face), sn = Math.sin(face), s = spotFor({ x: 0, y: 0 }, face);
    const pts = [[s.x, s.y, b.r + 7, b.body]];
    for (const [fwd, left, r] of w.spec?.blockers || [])
      pts.push([s.x + co * fwd + sn * left, s.y + sn * fwd - co * left, 2, r + 1]);
    const { x: x0, y: y0 } = c, t = { x: 0, y: 0 };
    let best = null;
    for (const r of [0, 25, 50, 80]) {
      for (let i = 0;i < (r ? 8 : 1); i++) {
        t.x = x0 + r * Math.cos(i / 8 * Math.PI * 2), t.y = y0 + r * Math.sin(i / 8 * Math.PI * 2);
        if (!fitHole(w, t, CLIMB.burrowK, pts))
          continue;
        const d = Math.hypot(t.x - x0, t.y - y0);
        if (!best || d < best.d)
          best = { x: t.x, y: t.y, d };
      }
      if (best)
        break;
    }
    if (best)
      c.x = best.x, c.y = best.y;
    return c;
  };
  return {
    clip: "leap",
    dur: up + ROAR + CALL,
    apex: 24,
    hops: [[hop, land]],
    turn: [hop, land],
    under: [land, RISE[0] + RISE[1] * CLIMB.stand],
    climb: { dive: DIVE, rise: RISE, shutDive: [0.1, 1.1], shutRise: [ROAR + CALL, 2.2] },
    beats: beats({ at: 0, do: (w) => w.sound("rumble") }, {
      at: hop,
      do(w, b) {
        const p = w.player, dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1, go = Math.min(40, Math.max(0, d - 30));
        const face = burrowFace(Math.atan2(dy, dx));
        const c = placeHole(w, b, holeWorld(b.x + dx / d * go, b.y + dy / d * go, holeFor(face).c), face);
        const s = spotFor(c, face);
        b.jumpTo = [s.x, s.y];
        b.turnFrom = b.face, b.turnTo = face;
        w.hazard({ kind: KIND.CIRCLE, x: s.x, y: s.y, r: 52, tele: land - hop, active: 0.18, fade: 0.3, dmg: 22, tag: "slam" });
      }
    }, {
      at: land,
      do(w, b) {
        if (b.jumpTo)
          b.x = b.jumpTo[0], b.y = b.jumpTo[1], b.jumpTo = null;
        b.vx = 0, b.vy = 0;
        w.pit(b, DIVE[0], DIVE[1], false, pick + 0.1, 1.1);
        w.shake(9);
        w.sound("slam");
        w.landed(b);
        w.clip(b, "slam");
      }
    }, { at: land + 0.25, do: (w, b) => w.clip(b, "raise") }, {
      at: pick,
      do(w, b) {
        const c = { x: w.player.x, y: w.player.y }, face = burrowFace(Math.hypot(c.x, c.y) > 20 ? Math.atan2(-c.y, -c.x) : b.face);
        placeHole(w, b, c, face);
        const s = spotFor(c, face);
        b.face = face, b.x = s.x, b.y = s.y, b.vx = 0, b.vy = 0;
        w.hazard({ kind: KIND.CIRCLE, x: c.x, y: c.y, r: 80, tele: rip - pick, active: 0.15, fade: 0.35, dmg: 26, tag: "erupt" });
      }
    }, {
      at: RISE[0],
      do(w, b) {
        w.pit(b, RISE[0], RISE[1], true, up + ROAR + CALL, 2.2);
        w.clip(b, "raise");
      }
    }, { at: up, do: (w, b) => (w.shake(12), w.sound("slam"), w.clip(b, "slam")) }, { at: up + ROAR, do: (w, b) => (w.shake(6), w.sound("enrage"), w.clip(b, "call")) }),
    recover: 0.6
  };
}
var BOSSES2 = { gnasher, cinder, crab };
var CLASSIC2 = { gnasher: gnasherClassic, cinder: cinderClassic, crab: crabClassic };
var BOSS_ORDER2 = ["gnasher"];
var MODELLED2 = ["gnasher", "cinder", "crab"];

// site/js/gfx/atlas.js
var ART = { add: {}, fx: {}, arena: {}, icon: {}, decor: null, title: null, titleTall: null };
var idle = () => new Promise((r) => setTimeout(r, 0));
async function loadPaintings() {
  const arenas = BOSS_ORDER2.map((id) => BOSSES2[id].arena);
  const sidecars = await Promise.all(arenas.map((n) => fetch(`art/${n}.json`).then((r) => r.ok ? r.json() : null).catch(() => null)));
  arenas.forEach((name, i) => {
    const cut = sidecars[i];
    if (cut)
      ART.arena[name] = { painted: true, iso: !!cut.iso, look: cut.look || name };
  });
  const [title, tall] = await Promise.all(["title", "title-tall"].map(async (name) => {
    const pic = await loadPainting(name);
    const anchors = pic && await fetch(`art/${name}.json`).then((r) => r.ok ? r.json() : null).catch(() => null);
    return anchors ? { ...anchors, img: asSprite(pic.img), w: pic.w, h: pic.h, smooth: true } : null;
  }));
  if (title)
    ART.title = title;
  if (tall)
    ART.titleTall = tall;
  return sidecars.filter(Boolean).length + (title ? 1 : 0);
}
async function buildArt(onProgress = () => {}) {
  const steps = [
    ["the small things", () => Object.assign(ART.add, buildAdds().add)],
    ["what grows here", () => ART.decor = buildDecor()],
    ["steel and sparks", () => Object.assign(ART.fx, buildFx())],
    ["icons", () => Object.assign(ART.icon, buildIcons().ui)],
    ["the title", () => ART.title = buildTitle()]
  ];
  for (let i = 0;i < steps.length; i++) {
    onProgress(i / steps.length, steps[i][0]);
    steps[i][1]();
    await idle();
  }
  try {
    const n = await loadPaintings();
    if (n)
      console.info(`[art] ${n} painting(s) loaded`);
  } catch (err) {
    console.warn("[art] paintings could not be loaded, using the generated ones:", err.message);
  }
  onProgress(1, "");
}
function ensure() {
  if (!ART.decor)
    ART.decor = buildDecor();
}
function frameOf(clip, t, fps = 10, loop = true) {
  if (!clip || !clip.length)
    return null;
  const i = Math.floor(t * fps);
  return clip[loop ? (i % clip.length + clip.length) % clip.length : Math.min(clip.length - 1, Math.max(0, i))];
}

// site/js/gfx/iso.js
var KX = 1;
var KY = 0.5;
var ISO_W = (r) => r * Math.SQRT2 * KX * 2;
var ISO_H = (r) => r * Math.SQRT2 * KY * 2;
var toScreen = (x, y) => [(x - y) * KX, (x + y) * KY];
function toWorld(px, py) {
  const a = px / (2 * KX);
  const b = py / (2 * KY);
  return [a + b, b - a];
}
var VIEW = { ky: KY };
function dirToWorld(mx, my) {
  const wx = mx / (2 * KX) + my / (2 * VIEW.ky);
  const wy = -mx / (2 * KX) + my / (2 * VIEW.ky);
  const m = Math.hypot(wx, wy);
  return m > 0.0001 ? [wx / m, wy / m] : [0, 0];
}

// site/js/config.js
var CONFIG = {
  NAME: "Three Bells",
  LAUNCH_DATE: "2026-09-21",
  SEASON: "Preview season",
  RULES_VERSION: 1,
  SAVE_KEY: "threebells.v1"
};
var TICK = 1 / 60;
var MAX_FRAME = 0.25;
var ARENA = {
  R: 118,
  WALL_BOUNCE: 0.35
};
var PLAYER = {
  swordHand: "R",
  radius: 6,
  hp: 120,
  speed: 94,
  accel: 1400,
  friction: 1500,
  swingMove: 0.8,
  jump: { time: 0.62, air: [0.1, 0.52], height: 9, steer: 0.85, cost: 16, recover: 0.08 },
  roll: {
    dist: 66,
    time: 0.42,
    iFrom: 0.06,
    iTo: 0.3,
    recover: 0.1,
    cost: 28,
    curve: (t) => 1 - Math.pow(1 - t, 2.6)
  },
  combo: [
    { wind: 0.11, active: 0.08, recover: 0.2, dmg: 11, arc: 1.9, range: 14.3, cost: 12, poise: 10, fx: "swing" },
    { wind: 0.1, active: 0.08, recover: 0.22, dmg: 12, arc: 2, range: 14.3, cost: 12, poise: 10, fx: "swing" },
    { wind: 0.17, active: 0.11, recover: 0.34, dmg: 21, arc: 2.5, range: 14.3, cost: 20, poise: 22, fx: "heavy" }
  ],
  comboWindow: 0.42,
  stamina: 100,
  staminaRegen: 46,
  staminaDelay: 0.45,
  exhaustedDelay: 0.9,
  hurtTime: 0.26,
  hurtIFrames: 0.6,
  knockback: 120,
  bufferTime: 0.18
};
var FORE = PLAYER.swordHand === "R" ? -1 : 1;
var sweepDir = (move) => ((move?.sweep ?? 0) < 0 ? -1 : 1) * FORE;
var FIGHT = {
  enrage: 180,
  enrageRamp: 12,
  intro: 2.2,
  entrance: { bell: [-58, -58], bellR: 8, postR: 7, hookX: 0.4615, postH: 40, ring: 0.75, leap: 1.25, apex: 60, settle: 1.5, roarAt: 0.3, landAhead: 76, fromOut: 30, stagger: 110, staggerTime: 0.8 },
  victory: 2.6,
  chest: { wait: 1.9, drop: 0.55, r: 9, clear: 34, open: 3.6 },
  hitstopHit: 0.055,
  hitstopHeavy: 0.1,
  hitstopTaken: 0.11,
  deathSlow: 1.6
};
var SHAKE_MAX = 22;
var BUBBLE_R = 18;
var HEART_VALUE = 20;

// site/js/content/arenas.js
var ARENA_SHAPES = { ash: { poly: [[-83.9, -87.3], [-97.7, -108], [-105.8, -120.3], [-120.1, -132.8], [-126.6, -144.4], [-127.9, -156.7], [-97.8, -189], [-83.6, -187.1], [-75.4, -174.7], [-70.1, -158.4], [-56.1, -146.9], [-39.8, -133.9], [-22.2, -149.5], [-3.6, -152.3], [22.4, -147.7], [42.1, -134.8], [63.2, -106.5], [86.7, -73.4], [110.9, -46.1], [123.2, -29.6], [135.7, -10.4], [136.2, 8.7], [131.2, 20.2], [125.3, 30.4], [124.8, 55.2], [120.1, 63.9], [112.6, 61.6], [105.1, 69.2], [108.8, 79.2], [107.8, 87.7], [117.1, 95.1], [122.2, 102.8], [117.9, 112.6], [123, 119.2], [130.1, 117], [135.5, 124.1], [129.8, 131.8], [117.1, 143.9], [106.8, 151.4], [98.3, 153.1], [89.3, 149.2], [81.8, 144.2], [72.8, 136.4], [64.6, 131.4], [61.5, 125.1], [61.4, 116.2], [48.4, 120.6], [35.8, 114.9], [28.2, 122.7], [16.7, 123.7], [-2.4, 125.9], [-21.2, 127.1], [-39.2, 122.3], [-57.5, 106.7], [-76.8, 84.5], [-96.5, 59.5], [-115.5, 36.4], [-127.4, 16.2], [-128.9, -2.7], [-130, -24.1], [-120.4, -48.7]], bell: { at: [-91.8, -5.4], r: 12, posts: [[-78.7, -17.8, 7.07], [-104.2, 7.6, 7.08]], standing: true, seat: [-95.9, -155.3], wall: [129.5, 124.7] } }, camp2: { grid: { x0: -421, y0: -470, cell: 1, nx: 709, ny: 745, rows: [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [116, 2], [116, 3], [116, 3], [116, 4], [116, 5], [116, 6], [116, 6], [116, 6], [117, 5], [117, 5], [117, 5], [117, 5], [117, 5], [117, 5], [116, 7], [115, 9], [116, 9], [116, 9], [116, 10], [116, 11], [116, 11], [116, 11], [117, 10], [117, 11], [117, 11], [117, 12], [116, 13], [115, 15], [115, 16], [115, 16], [115, 17], [115, 17], [115, 18], [114, 19], [114, 20], [114, 21], [114, 21], [115, 21], [115, 1, 120, 16], [121, 16], [122, 15], [122, 17], [122, 18], [121, 20], [121, 20], [120, 22], [119, 24], [117, 26], [115, 29], [116, 30], [116, 30], [116, 29], [116, 15, 137, 7], [116, 14, 138, 6, 212, 3], [116, 13, 139, 5, 165, 6, 212, 14], [116, 13, 139, 6, 165, 7, 212, 15], [116, 13, 140, 6, 165, 9, 211, 18], [116, 14, 141, 6, 152, 2, 164, 10, 210, 20], [116, 15, 142, 6, 151, 4, 163, 12, 206, 25], [116, 18, 143, 15, 161, 15, 181, 1, 203, 29], [116, 19, 143, 40, 199, 34], [115, 21, 144, 40, 189, 1, 198, 35], [116, 20, 144, 29, 176, 9, 188, 2, 198, 36], [116, 21, 144, 14, 161, 11, 177, 14, 197, 38], [116, 22, 143, 14, 162, 9, 178, 14, 196, 39], [116, 23, 142, 14, 163, 8, 178, 58], [116, 40, 164, 7, 178, 58], [116, 40, 164, 8, 180, 57], [115, 42, 164, 9, 181, 55], [115, 43, 163, 12, 182, 54], [115, 44, 162, 13, 182, 54], [114, 61, 182, 10, 195, 42], [113, 30, 147, 29, 181, 10, 196, 42], [113, 29, 151, 7, 162, 4, 169, 8, 180, 10, 197, 48], [112, 29, 170, 20, 197, 50, 291, 8], [111, 24, 171, 19, 197, 52, 292, 15], [110, 24, 178, 13, 196, 55, 292, 19], [109, 17, 185, 7, 195, 2, 200, 54, 292, 21], [108, 17, 189, 3, 201, 55, 292, 23], [107, 17, 203, 55, 292, 25], [107, 17, 205, 55, 293, 27], [106, 17, 206, 56, 293, 29], [106, 17, 208, 55, 294, 29], [105, 18, 210, 55, 294, 29], [104, 19, 212, 55, 294, 30], [104, 19, 215, 54, 294, 30], [103, 19, 218, 57, 294, 31], [102, 20, 222, 9, 236, 40, 294, 31], [101, 21, 227, 4, 237, 43, 294, 31], [100, 21, 238, 5, 246, 6, 255, 25, 293, 32], [99, 22, 239, 2, 248, 3, 256, 24, 292, 34], [98, 23, 257, 24, 287, 40], [97, 23, 258, 24, 286, 43], [96, 24, 258, 71], [96, 24, 258, 71], [95, 25, 258, 70], [94, 26, 261, 67], [94, 25, 262, 66], [94, 25, 263, 65], [94, 25, 263, 65], [94, 25, 263, 65], [93, 27, 263, 65], [92, 27, 263, 65], [92, 26, 265, 62], [92, 25, 267, 60], [92, 25, 268, 59], [92, 24, 272, 55], [91, 24, 273, 54], [90, 24, 274, 53], [89, 24, 275, 52], [89, 24, 275, 52], [88, 24, 275, 52], [87, 24, 275, 52], [86, 25, 275, 52], [86, 25, 275, 52], [86, 25, 276, 1, 280, 47], [86, 25, 281, 46], [86, 24, 282, 45], [86, 24, 282, 45], [86, 23, 282, 45], [85, 24, 281, 47], [85, 23, 281, 46], [85, 23, 282, 45], [85, 23, 283, 44], [85, 23, 285, 42], [85, 24, 288, 39], [86, 21, 290, 37], [86, 20, 294, 33], [86, 19, 297, 30], [86, 19, 299, 28], [87, 18, 303, 24], [87, 18, 305, 22], [87, 18, 308, 19], [88, 17, 309, 18], [88, 17, 312, 15], [88, 17, 315, 11], [88, 16, 316, 10], [88, 16, 318, 8], [89, 15, 320, 5], [89, 16], [89, 17], [89, 20], [89, 21], [89, 21], [88, 22], [87, 24], [86, 25], [86, 25], [87, 25], [87, 25], [88, 24], [88, 24], [88, 24], [87, 25], [87, 25], [88, 24], [88, 24], [88, 25], [87, 27], [87, 28], [87, 29], [87, 29], [87, 30], [87, 30], [88, 30], [88, 31], [89, 31], [89, 31], [90, 31], [90, 31], [90, 32], [92, 31], [92, 32], [93, 31], [94, 30], [95, 30], [96, 30], [97, 30], [98, 29], [100, 28], [101, 27], [102, 27], [103, 26], [104, 26], [105, 25], [105, 26], [106, 26], [107, 26], [107, 26], [107, 27], [108, 26], [29, 5, 44, 1, 111, 23], [29, 10, 43, 4, 112, 23], [30, 17, 113, 22], [30, 17, 114, 20], [31, 17, 114, 20], [31, 18, 114, 20], [31, 18, 115, 20], [31, 19, 116, 19], [31, 19, 117, 19], [31, 20, 117, 20], [32, 18, 117, 21], [32, 17, 117, 20], [32, 17, 117, 19], [35, 13, 111, 1, 116, 20], [36, 11, 111, 25], [37, 10, 111, 26], [37, 10, 110, 28], [38, 9, 109, 31], [38, 9, 109, 31], [39, 8, 109, 31], [39, 9, 109, 31], [39, 10, 108, 25, 136, 4], [38, 11, 109, 23, 137, 3], [37, 13, 109, 22, 138, 2], [35, 16, 109, 22, 138, 2], [34, 17, 110, 21, 138, 2], [31, 21, 110, 22, 137, 3], [30, 23, 110, 21, 136, 4], [29, 25, 110, 20, 137, 3], [28, 27, 110, 20, 137, 3], [28, 28, 110, 20, 137, 3], [28, 29, 111, 20, 136, 4], [28, 30, 111, 21, 135, 6], [28, 32, 112, 29], [29, 32, 68, 1, 113, 28], [29, 41, 113, 28], [29, 42, 113, 28], [30, 43, 113, 28], [31, 43, 113, 29], [31, 44, 113, 29], [31, 46, 114, 28], [31, 47, 115, 27], [31, 48, 115, 27], [31, 50, 115, 21, 139, 3], [30, 53, 115, 20, 140, 2], [29, 60, 115, 19], [28, 66, 114, 20], [28, 68, 113, 21], [27, 71, 112, 23], [26, 73, 110, 26], [26, 113], [25, 114], [24, 114], [21, 117], [21, 117], [21, 117], [21, 118], [21, 119], [21, 119], [23, 119], [24, 119], [25, 118], [26, 117], [28, 115], [29, 115], [32, 2, 37, 108], [40, 106], [44, 103, 236, 1], [46, 102, 233, 5], [47, 106, 233, 9], [48, 106, 233, 10], [51, 103, 233, 15], [53, 103, 231, 14, 248, 6], [55, 102, 230, 14, 249, 4], [56, 104, 229, 14, 250, 2], [58, 103, 230, 13, 250, 1], [60, 102, 230, 11, 250, 1], [62, 102, 230, 10, 249, 2], [64, 101, 230, 9, 248, 4], [68, 98, 230, 8, 246, 6], [76, 93, 230, 8, 246, 6, 440, 1], [79, 92, 230, 8, 246, 7, 440, 2], [81, 92, 230, 9, 247, 7, 439, 6], [85, 90, 230, 4, 237, 3, 248, 8, 439, 10], [87, 91, 230, 3, 238, 3, 248, 7, 439, 16], [90, 90, 229, 3, 239, 2, 248, 6, 440, 15], [92, 93, 229, 3, 239, 2, 248, 6, 441, 14], [93, 100, 229, 3, 239, 2, 248, 6, 441, 15], [95, 30, 128, 68, 229, 4, 238, 3, 248, 7, 441, 15], [97, 27, 129, 70, 228, 6, 237, 2, 247, 9, 441, 15], [98, 25, 130, 71, 227, 11, 246, 10, 441, 16], [101, 22, 131, 71, 227, 10, 246, 10, 440, 17], [103, 20, 131, 73, 226, 11, 247, 8, 440, 17], [107, 17, 131, 74, 226, 11, 247, 8, 440, 17], [114, 10, 131, 77, 225, 13, 247, 8, 439, 18], [119, 6, 130, 83, 223, 16, 246, 8, 438, 20], [121, 5, 129, 87, 222, 18, 245, 9, 437, 21], [124, 130, 441, 17], [126, 128, 442, 16], [128, 126, 443, 15], [131, 123, 443, 15], [140, 114, 443, 15], [142, 112, 442, 16], [144, 110, 441, 16], [145, 109, 439, 18], [146, 109, 438, 19], [147, 108, 436, 21], [149, 106, 436, 20], [151, 105, 436, 19], [153, 103, 435, 20], [154, 101, 435, 20], [157, 97, 435, 20], [160, 94, 436, 20], [163, 91, 437, 20], [167, 88, 438, 20], [169, 87, 438, 20], [171, 87, 438, 21], [173, 86, 438, 21], [174, 86, 438, 21], [176, 85, 438, 21], [178, 84, 438, 21], [180, 83, 438, 21], [181, 83, 437, 22], [183, 82, 436, 22], [186, 80, 435, 23], [189, 78, 435, 23], [191, 77, 435, 23], [195, 74, 435, 22], [198, 72, 435, 22], [204, 67, 435, 21], [214, 58, 435, 21], [221, 53, 435, 21], [226, 49, 435, 21], [228, 48, 434, 21], [236, 42, 353, 5, 434, 20], [237, 42, 351, 14, 434, 20], [238, 42, 347, 21, 434, 20], [239, 43, 347, 25, 434, 19], [239, 1, 243, 41, 348, 25, 434, 19], [244, 41, 348, 26, 377, 2, 433, 20], [245, 42, 348, 31, 433, 19], [246, 43, 348, 32, 433, 19], [247, 44, 348, 33, 433, 19], [247, 46, 348, 34, 433, 20], [247, 48, 299, 5, 348, 35, 433, 20], [247, 59, 348, 36, 433, 20], [251, 59, 348, 37, 432, 21], [252, 60, 348, 38, 432, 21], [253, 65, 346, 41, 431, 21], [253, 68, 343, 45, 431, 21], [253, 70, 342, 47, 430, 22], [254, 71, 340, 49, 429, 23], [255, 72, 335, 55, 428, 24], [256, 135, 428, 24], [258, 134, 428, 24], [259, 134, 429, 23, 548, 1], [260, 135, 429, 24, 547, 3], [261, 135, 429, 24, 543, 7], [263, 134, 428, 23, 542, 9], [265, 133, 427, 23, 542, 9], [266, 134, 426, 23, 542, 10], [268, 133, 425, 24, 541, 11], [272, 133, 424, 25, 541, 11], [276, 137, 417, 33, 541, 11], [278, 173, 541, 11], [281, 172, 541, 11], [283, 170, 541, 11], [285, 169, 541, 10], [286, 168, 541, 10], [288, 166, 541, 10], [290, 165, 540, 10], [294, 161, 540, 10], [298, 158, 539, 11], [300, 156, 538, 12], [302, 155, 538, 14], [304, 153, 538, 16], [308, 150, 537, 12, 550, 6], [311, 147, 536, 13, 550, 8], [316, 143, 535, 14, 550, 10], [321, 139, 535, 13, 550, 12], [324, 136, 534, 14, 550, 14], [325, 136, 534, 14, 550, 16], [328, 134, 534, 14, 550, 19], [330, 133, 533, 14, 550, 20], [331, 132, 532, 15, 550, 20], [332, 132, 531, 16, 550, 20], [334, 132, 531, 15, 550, 20], [335, 132, 531, 14, 549, 21], [336, 132, 531, 13, 549, 21], [337, 131, 530, 13, 549, 22], [338, 131, 529, 13, 549, 22], [339, 131, 526, 15, 549, 22], [339, 131, 524, 16, 549, 22], [340, 61, 407, 65, 523, 16, 549, 22], [340, 59, 411, 60, 523, 16, 549, 22], [340, 59, 413, 58, 522, 16, 549, 22], [340, 58, 415, 56, 520, 17, 549, 22], [341, 56, 417, 55, 519, 18, 550, 21], [342, 51, 419, 54, 519, 18, 551, 20], [342, 47, 422, 58, 519, 18, 551, 21], [342, 45, 428, 9, 441, 40, 511, 2, 518, 18, 552, 20], [342, 44, 434, 2, 442, 40, 510, 4, 517, 19, 553, 19], [343, 42, 443, 41, 507, 29, 554, 18], [344, 40, 443, 43, 503, 20, 526, 9, 554, 18], [344, 39, 443, 55, 501, 21, 527, 7, 555, 17], [345, 37, 443, 78, 528, 6, 556, 16], [345, 37, 444, 77, 528, 6, 557, 15], [345, 36, 446, 75, 529, 6, 557, 15], [346, 35, 447, 68, 519, 2, 529, 7, 558, 14], [346, 35, 449, 65, 529, 6, 559, 13], [346, 35, 451, 62, 528, 6, 560, 3], [346, 35, 452, 61, 523, 1, 527, 5], [346, 35, 453, 60, 523, 8], [346, 34, 454, 60, 524, 6], [346, 34, 455, 60, 525, 4], [346, 33, 456, 60, 525, 4], [346, 33, 458, 60, 525, 3], [346, 31, 459, 60, 524, 3], [346, 30, 461, 59, 523, 3], [346, 29, 464, 62], [347, 27, 465, 61], [347, 26, 467, 59], [347, 26, 468, 58], [347, 26, 469, 58], [230, 4, 347, 25, 470, 57], [229, 5, 347, 25, 471, 56], [228, 7, 251, 9, 346, 26, 472, 55], [228, 8, 239, 22, 346, 26, 473, 53], [228, 34, 265, 2, 346, 26, 473, 53], [227, 41, 346, 25, 474, 52], [227, 41, 345, 26, 475, 52], [226, 43, 346, 24, 475, 53], [225, 45, 347, 23, 476, 53], [224, 49, 348, 22, 477, 54], [221, 57, 349, 21, 477, 54], [220, 60, 350, 20, 477, 53], [220, 60, 350, 20, 478, 51], [220, 60, 350, 20, 478, 50], [220, 60, 350, 21, 479, 48], [220, 60, 349, 22, 479, 47], [220, 60, 349, 22, 480, 45], [220, 61, 348, 23, 480, 44], [220, 62, 348, 24, 480, 13, 496, 28], [220, 63, 348, 24, 480, 12, 497, 26], [220, 64, 347, 26, 478, 13, 498, 25], [220, 65, 347, 26, 477, 14, 498, 25], [220, 66, 347, 27, 475, 16, 498, 24], [220, 66, 346, 28, 475, 16, 498, 21], [220, 66, 346, 29, 475, 16, 498, 20], [220, 67, 346, 29, 475, 16, 498, 20], [220, 68, 346, 30, 475, 16, 498, 20], [220, 69, 346, 31, 474, 17, 498, 20], [221, 69, 346, 31, 473, 18, 498, 21], [221, 70, 345, 33, 473, 18, 498, 22], [221, 71, 345, 34, 472, 11, 487, 4, 498, 22], [221, 72, 345, 34, 471, 11, 488, 1, 498, 23], [222, 71, 345, 35, 470, 11, 498, 23], [222, 70, 344, 37, 470, 11, 497, 24], [223, 69, 344, 38, 470, 11, 497, 25], [223, 69, 344, 39, 470, 12, 496, 26], [224, 10, 237, 56, 344, 40, 470, 13, 487, 1, 495, 27], [225, 8, 238, 56, 298, 2, 341, 43, 470, 19, 494, 28], [225, 7, 239, 62, 305, 2, 340, 45, 470, 51], [226, 6, 240, 85, 339, 47, 470, 51], [227, 5, 242, 88, 338, 49, 470, 51], [228, 5, 243, 88, 337, 51, 470, 51], [229, 5, 246, 87, 336, 53, 470, 50], [229, 6, 247, 143, 470, 50], [230, 7, 248, 142, 470, 50], [231, 7, 248, 142, 471, 49], [231, 8, 248, 142, 471, 49], [232, 10, 247, 143, 472, 47], [232, 11, 246, 145, 472, 47], [232, 160, 473, 10, 486, 33], [233, 160, 397, 2, 473, 9, 487, 33], [233, 167, 474, 7, 488, 32], [233, 172, 474, 7, 488, 32], [232, 176, 475, 6, 488, 33], [231, 179, 475, 5, 488, 33], [231, 180, 476, 1, 488, 33], [231, 183, 488, 34], [231, 184, 487, 35], [231, 185, 487, 35], [231, 95, 329, 87, 486, 37], [230, 95, 330, 87, 485, 38], [227, 68, 298, 26, 331, 87, 475, 2, 484, 39], [226, 52, 288, 6, 299, 25, 332, 87, 474, 50], [226, 48, 300, 24, 332, 34, 370, 50, 423, 3, 473, 7, 487, 37], [226, 44, 302, 23, 332, 33, 371, 57, 472, 7, 488, 36], [226, 43, 303, 6, 312, 12, 331, 33, 372, 59, 470, 8, 489, 35], [227, 42, 314, 1, 334, 30, 372, 63, 469, 7, 489, 36], [228, 41, 343, 21, 372, 72, 464, 10, 489, 36, 529, 5], [228, 40, 344, 20, 373, 75, 460, 13, 488, 37, 528, 10], [230, 38, 345, 20, 374, 76, 457, 7, 487, 51], [231, 36, 347, 19, 376, 87, 483, 52], [233, 34, 348, 15, 377, 85, 482, 52], [233, 28, 265, 2, 351, 11, 378, 83, 481, 52, 552, 3], [235, 25, 352, 9, 380, 81, 479, 54, 551, 7], [236, 23, 353, 8, 381, 80, 478, 55, 550, 9, 563, 1], [236, 23, 353, 8, 384, 78, 477, 57, 548, 19], [238, 20, 354, 8, 386, 77, 467, 68, 547, 23], [239, 19, 354, 9, 387, 155, 546, 25], [240, 18, 354, 11, 388, 183], [242, 15, 353, 12, 389, 182, 605, 3], [244, 12, 352, 13, 391, 180, 605, 8], [246, 9, 351, 14, 397, 173, 604, 11, 620, 3, 627, 1], [248, 7, 351, 14, 399, 171, 604, 32], [251, 4, 351, 14, 400, 170, 601, 36], [253, 2, 351, 15, 400, 83, 486, 84, 599, 42, 659, 5], [351, 15, 402, 80, 487, 93, 597, 47, 659, 7], [352, 14, 403, 78, 488, 96, 593, 54, 659, 6], [352, 14, 404, 77, 488, 161, 658, 7], [352, 14, 405, 76, 488, 162, 657, 8], [351, 16, 406, 75, 488, 163, 654, 12], [351, 16, 408, 11, 422, 60, 487, 180], [350, 17, 409, 10, 428, 55, 486, 187, 678, 1], [353, 14, 415, 2, 430, 251], [354, 14, 431, 9, 444, 49, 496, 186], [355, 13, 432, 7, 445, 47, 497, 74, 574, 108], [355, 13, 446, 8, 460, 31, 498, 72, 575, 108], [355, 13, 446, 6, 462, 29, 498, 68, 576, 108], [355, 13, 450, 1, 463, 27, 498, 67, 576, 108], [355, 10, 463, 21, 487, 3, 498, 66, 576, 109], [355, 5, 363, 1, 464, 19, 488, 1, 498, 66, 575, 111], [355, 4, 466, 16, 504, 60, 574, 2, 579, 107], [354, 4, 468, 14, 505, 60, 571, 4, 580, 107], [353, 4, 469, 13, 506, 12, 523, 43, 570, 4, 581, 107], [353, 3, 469, 14, 514, 3, 524, 10, 537, 37, 581, 107], [353, 2, 470, 14, 528, 5, 538, 36, 581, 107], [353, 2, 471, 14, 488, 1, 531, 1, 539, 35, 581, 108], [354, 1, 471, 18, 539, 33, 581, 1, 603, 43, 649, 40], [354, 1, 474, 15, 543, 20, 610, 35, 650, 40], [354, 1, 476, 13, 549, 1, 553, 6, 621, 23, 651, 39], [477, 13, 624, 20, 651, 19, 673, 17], [478, 13, 626, 18, 651, 18, 674, 16], [478, 15, 629, 16, 652, 16, 675, 15], [478, 15, 637, 8, 652, 16, 675, 15], [478, 16, 640, 5, 652, 16, 675, 3, 681, 9], [478, 16, 643, 3, 651, 14, 683, 7], [477, 18, 653, 1, 687, 1], [478, 16], [479, 14], [479, 14], [480, 13], [480, 14], [480, 15], [480, 16], [480, 17], [479, 18], [478, 19], [479, 18], [480, 17], [480, 16], [480, 16], [480, 16], [480, 16], [480, 16], [479, 16], [478, 16], [476, 18], [476, 18], [476, 18], [476, 18], [475, 19], [474, 19], [474, 19], [475, 17], [475, 17], [475, 17], [475, 17], [475, 17], [475, 17], [475, 17], [475, 17], [475, 17], [476, 15], [476, 15], [477, 14], [477, 14], [477, 13], [477, 13], [477, 13], [477, 13], [477, 13], [476, 14], [475, 14], [474, 15], [473, 16], [472, 17], [473, 16], [474, 15], [475, 14], [476, 13], [476, 12], [476, 12], [476, 12], [475, 13], [475, 14], [475, 14], [476, 13], [476, 12], [476, 11], [476, 11], [476, 11], [476, 10], [476, 10], [476, 10], [475, 12], [474, 14], [474, 15], [474, 15], [474, 15], [473, 15], [472, 15], [472, 14], [473, 13], [474, 12], [475, 12], [475, 13], [475, 15], [475, 15], [474, 16], [473, 17], [472, 18], [470, 17], [470, 16], [471, 14], [473, 12], [455, 3, 478, 7], [436, 1, 450, 9, 479, 7], [430, 29, 480, 7, 490, 1], [431, 29, 480, 11], [431, 29, 480, 11], [431, 29, 480, 11], [431, 29, 479, 13], [431, 29, 478, 15], [430, 30, 478, 16], [430, 30, 479, 15], [430, 30, 479, 16, 501, 1], [430, 30, 479, 17, 500, 4], [429, 32, 479, 26], [428, 34, 478, 31], [428, 35, 470, 2, 477, 33, 514, 1], [428, 36, 467, 48], [428, 87], [429, 87], [430, 86], [431, 85], [432, 84], [433, 83], [434, 83], [435, 82], [436, 81], [437, 81], [438, 80], [438, 80], [439, 80], [440, 80], [441, 80], [442, 81], [443, 82], [445, 82], [446, 82], [447, 81], [448, 81], [449, 81], [450, 84], [451, 86], [452, 13, 470, 70], [454, 10, 475, 12, 490, 51], [457, 5, 477, 9, 491, 53], [481, 4, 492, 58], [492, 54, 549, 2], [493, 52], [501, 43, 561, 6], [503, 41, 560, 9], [505, 39, 559, 11], [507, 38, 550, 2, 557, 13, 596, 4], [508, 38, 549, 21, 594, 7, 610, 4], [510, 61, 580, 5, 591, 11, 609, 6], [511, 61, 576, 10, 589, 14, 608, 12], [512, 108], [514, 106], [515, 106], [517, 105, 628, 2], [519, 117], [520, 116], [523, 113], [525, 111], [533, 102], [534, 101], [536, 99], [539, 33, 575, 60], [544, 15, 562, 9, 576, 59], [546, 12, 563, 7, 577, 20, 602, 32], [552, 5, 564, 6, 577, 19, 604, 29], [565, 5, 577, 18, 604, 28], [565, 5, 577, 18, 605, 26], [576, 18, 605, 25], [578, 16, 605, 24], [585, 10, 605, 23], [589, 6, 605, 22], [592, 4, 604, 22], [594, 3, 603, 22], [597, 27], [600, 23], [603, 19], [605, 15], [608, 9], [610, 5], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []], margin: 8, glide: 8 }, spawn: [-58.5, 13.5] }, bog: { poly: [[-199.4, -132.4], [-177.5, -157.2], [-156.3, -152.8], [-125, -138.9], [-98.9, -119], [-75.4, -117.8], [-52.2, -119.7], [-27.4, -118.1], [-5.7, -118.8], [17.2, -110.3], [38.4, -94.4], [52.5, -71.2], [68, -59.3], [82.5, -42.3], [94.7, -20.3], [105.6, -7.7], [113.6, 10.7], [117.5, 26.8], [120.1, 44.8], [121.4, 60.9], [123.1, 75.4], [123.5, 85.3], [127.6, 93.4], [132.4, 102.9], [118.9, 117.6], [109, 112], [98.4, 112.1], [87.5, 111.1], [75, 111.7], [64.8, 111.8], [49.8, 113.1], [29.2, 113.8], [11, 114.2], [-2.7, 110.4], [-16.1, 95.8], [-31.2, 83.2], [-53.9, 62.6], [-80.7, 40], [-111, 13.5], [-135.8, -12.7], [-142.2, -33.9], [-142.2, -51], [-137.4, -64.6], [-137.4, -74.7], [-173.2, -106.2]], bell: { at: [-170.2, -120.5], r: 12, posts: [[-184.1, -112.2, 4], [-155.5, -143.5, 4]] } }, hall: { poly: [[-110.1, -187.8], [-72.7, -225.2], [-59.1, -211], [-39.9, -184.9], [-31.7, -164.3], [-1, -135.9], [23.3, -115], [47, -85.6], [70.6, -52], [90.7, -20.2], [104.5, 5.3], [112.5, 20.1], [104.8, 32.6], [100.1, 42.1], [113.4, 61.9], [119, 76.4], [117, 85.9], [112.2, 95.2], [106.4, 105.7], [98.3, 117.3], [93.4, 125.7], [99.4, 135], [94.1, 143.5], [84.2, 150.2], [73.6, 148], [66.9, 148.7], [54, 141.3], [43, 138.6], [30.2, 137.6], [18.5, 132.9], [4.1, 123.6], [1.7, 114.4], [-6.5, 97.3], [-24.7, 86.1], [-40, 71], [-50.2, 54.5], [-55.7, 38.8], [-67.4, 18], [-87.5, -4.2], [-106.5, -28.3], [-115.1, -48.1], [-118, -66], [-122.7, -88.1], [-130.1, -100], [-128.1, -107.3], [-118.7, -115.3], [-109.2, -122.2], [-103.4, -130.6], [-89.9, -137.2], [-94.2, -150.7], [-100.8, -168.2]], bell: { at: [-132.2, -107.2], r: 4.2, posts: [[-126, -113.3, 5.3]], small: true, answer: { at: [-256.3, -169.1], hum: 0.25, boom: 1.05 }, ring: 1.45 }, grates: [[-73.5, -22], [-28.7, 69.1], [79.6, 11.8], [84.8, 99.9]] }, salt: { poly: [[-181.2, -48.4], [-171.7, -75.8], [-144, -110.8], [-120.6, -137.7], [-95.5, -162.9], [-71.5, -180.6], [-46, -179.1], [-23, -180], [2.7, -162.4], [25.9, -151.7], [58.1, -118], [79.7, -91.8], [97.8, -63.5], [106.4, -41.9], [107.6, -20.8], [121.3, 2], [134.7, 24.3], [133.8, 46.2], [127.5, 73.3], [140.5, 94.2], [131.2, 110.3], [127.7, 128.4], [118.9, 141.1], [104, 144.2], [81.7, 126], [64.2, 108.9], [40.7, 93.4], [15.4, 102.1], [-7.8, 109.4], [-36.3, 115.8], [-59.5, 116.5], [-85.3, 104.3], [-123.7, 71.8], [-150.9, 41.8], [-160.5, 17.8], [-168.2, -8.7], [-174.1, -37.8]], bell: { at: [-98.6, 66.7], r: 16.2, posts: [[-99.4, 43.5, 10.02], [-101.9, 89.8, 10.14]], standing: true } } };

// site/js/content/walkedits.js
var WALK_EDITS = { camp2: { x0: -421, y0: -470, cell: 1, nx: 709, ny: 745, add: [[38, 112, 4], [39, 112, 4], [40, 112, 3], [41, 112, 4], [42, 112, 4], [43, 112, 4], [44, 112, 4], [45, 112, 4], [46, 112, 4], [47, 112, 5], [48, 112, 5], [49, 112, 5], [50, 112, 5], [51, 112, 4], [52, 112, 3], [53, 113, 2], [54, 113, 2], [55, 113, 2], [56, 113, 2], [57, 113, 2], [58, 113, 1], [62, 114, 1], [63, 114, 1], [63, 116, 4], [64, 114, 7], [65, 115, 7], [66, 115, 7], [67, 115, 7], [68, 115, 6], [69, 115, 6], [70, 115, 5], [71, 115, 4], [72, 115, 2], [77, 131, 6], [78, 130, 8], [78, 144, 2], [79, 129, 10], [79, 144, 3], [80, 129, 10], [80, 145, 3], [81, 129, 11], [81, 146, 3], [82, 130, 11], [82, 147, 3], [83, 131, 11], [83, 148, 3], [83, 155, 8], [84, 134, 9], [84, 158, 3], [84, 183, 3], [85, 135, 8], [85, 183, 5], [86, 136, 8], [86, 184, 5], [87, 136, 8], [87, 173, 3], [87, 185, 3], [87, 190, 8], [88, 115, 1], [88, 137, 7], [88, 158, 3], [88, 172, 5], [88, 191, 6], [89, 115, 1], [89, 138, 5], [89, 157, 5], [89, 171, 7], [89, 192, 4], [90, 115, 1], [90, 139, 3], [90, 156, 7], [90, 171, 7], [91, 114, 2], [91, 156, 8], [91, 171, 7], [92, 114, 2], [92, 156, 8], [92, 172, 8], [93, 114, 1], [93, 157, 7], [93, 173, 8], [94, 114, 1], [94, 158, 5], [94, 175, 7], [95, 114, 1], [95, 159, 3], [95, 175, 7], [96, 113, 1], [96, 175, 7], [96, 192, 3], [97, 176, 5], [97, 191, 5], [98, 158, 4], [98, 166, 3], [98, 177, 3], [98, 190, 7], [99, 158, 5], [99, 190, 7], [100, 190, 7], [101, 191, 5], [102, 126, 3], [102, 182, 3], [102, 192, 3], [102, 197, 3], [103, 125, 4], [103, 185, 4], [103, 192, 9], [104, 124, 5], [104, 188, 15], [105, 124, 4], [105, 191, 14], [106, 123, 5], [106, 194, 10], [107, 123, 5], [107, 199, 3], [108, 123, 5], [109, 123, 4], [110, 123, 4], [111, 122, 5], [112, 122, 5], [112, 235, 1], [113, 122, 5], [113, 236, 1], [114, 121, 6], [114, 237, 1], [114, 243, 3], [114, 252, 3], [115, 121, 6], [115, 238, 1], [115, 241, 7], [115, 251, 5], [116, 121, 6], [116, 240, 17], [117, 120, 6], [117, 241, 17], [118, 120, 6], [118, 243, 15], [119, 120, 6], [119, 245, 13], [120, 120, 5], [120, 246, 12], [121, 120, 5], [121, 251, 10], [122, 119, 5], [122, 254, 8], [123, 119, 5], [123, 257, 6], [124, 119, 5], [124, 259, 4], [125, 119, 5], [125, 261, 2], [126, 120, 3], [127, 119, 4], [128, 118, 5], [129, 117, 6], [130, 117, 6], [131, 116, 7], [132, 115, 7], [133, 114, 8], [134, 113, 8], [135, 113, 8], [136, 112, 9], [137, 111, 9], [138, 111, 9], [139, 111, 8], [140, 111, 8], [141, 111, 8], [142, 110, 8], [143, 110, 8], [144, 109, 8], [145, 109, 8], [146, 108, 9], [147, 108, 9], [148, 108, 9], [149, 108, 8], [150, 109, 7], [151, 107, 9], [152, 106, 10], [153, 105, 11], [154, 105, 11], [155, 105, 11], [156, 105, 11], [157, 105, 7], [158, 105, 7], [159, 105, 7], [160, 105, 7], [161, 104, 8], [162, 104, 8], [163, 104, 8], [164, 105, 7], [165, 106, 6], [166, 109, 3], [167, 110, 2], [168, 110, 2], [169, 110, 2], [170, 111, 2], [171, 111, 2], [172, 111, 2], [173, 112, 1], [289, 244, 2], [290, 243, 5], [291, 243, 7], [292, 241, 9], [293, 240, 9], [294, 239, 9], [295, 238, 8], [296, 238, 8], [296, 252, 1], [297, 238, 8], [298, 229, 1], [298, 239, 8], [299, 229, 1], [299, 234, 3], [299, 240, 8], [300, 229, 1], [300, 233, 5], [300, 241, 7], [301, 232, 7], [301, 241, 7], [302, 232, 7], [302, 241, 7], [303, 232, 7], [303, 241, 7], [304, 125, 3], [304, 233, 5], [304, 241, 7], [305, 124, 5], [305, 234, 3], [305, 239, 8], [305, 456, 1], [306, 123, 7], [306, 238, 8], [306, 457, 1], [307, 123, 8], [307, 237, 9], [307, 457, 1], [308, 123, 8], [308, 237, 10], [308, 457, 2], [309, 124, 7], [309, 237, 10], [309, 457, 3], [310, 124, 7], [310, 238, 9], [310, 457, 3], [311, 125, 5], [311, 239, 7], [311, 458, 2], [312, 126, 3], [312, 240, 5], [312, 458, 2], [313, 440, 1], [313, 458, 3], [314, 440, 2], [314, 458, 3], [315, 254, 1], [315, 440, 3], [315, 458, 3], [316, 254, 2], [316, 440, 3], [316, 458, 2], [317, 254, 2], [317, 440, 3], [317, 458, 3], [318, 254, 2], [318, 440, 2], [318, 458, 3], [319, 254, 2], [319, 440, 1], [319, 457, 4], [320, 254, 2], [320, 457, 4], [321, 255, 1], [321, 457, 4], [322, 255, 2], [322, 457, 4], [323, 255, 3], [323, 456, 5], [324, 256, 2], [324, 455, 6], [325, 256, 3], [325, 455, 6], [326, 255, 4], [326, 455, 6], [327, 254, 6], [327, 455, 6], [328, 254, 6], [328, 456, 5], [329, 254, 7], [329, 457, 5], [330, 255, 6], [330, 458, 4], [331, 256, 6], [331, 458, 3], [332, 258, 4], [332, 459, 2], [333, 259, 4], [333, 459, 2], [334, 260, 4], [334, 459, 2], [335, 261, 4], [335, 459, 2], [336, 262, 4], [336, 459, 2], [337, 263, 3], [337, 459, 3], [338, 264, 3], [338, 459, 3], [339, 265, 3], [339, 458, 3], [340, 266, 3], [340, 458, 4], [341, 267, 4], [341, 458, 4], [342, 268, 4], [342, 458, 4], [343, 269, 4], [343, 457, 5], [344, 270, 4], [344, 457, 5], [345, 271, 5], [345, 456, 6], [346, 272, 5], [346, 456, 6], [347, 218, 3], [347, 274, 5], [347, 362, 2], [347, 366, 2], [347, 456, 6], [348, 221, 5], [348, 275, 5], [348, 355, 15], [348, 456, 6], [349, 224, 4], [349, 276, 6], [349, 354, 18], [349, 455, 7], [350, 227, 9], [350, 278, 6], [350, 358, 17], [350, 454, 7], [351, 229, 8], [351, 279, 6], [351, 365, 12], [351, 454, 7], [352, 231, 7], [352, 280, 8], [352, 368, 10], [352, 454, 7], [353, 233, 6], [353, 282, 10], [353, 372, 8], [353, 453, 8], [354, 235, 4], [354, 240, 3], [354, 284, 10], [354, 373, 9], [354, 453, 8], [355, 238, 6], [355, 285, 10], [355, 374, 3], [355, 379, 4], [355, 453, 7], [356, 239, 6], [356, 287, 11], [356, 379, 5], [356, 452, 8], [357, 241, 5], [357, 289, 10], [357, 347, 1], [357, 380, 5], [357, 452, 8], [358, 243, 4], [358, 291, 11], [358, 347, 1], [358, 381, 5], [358, 452, 9], [359, 245, 2], [359, 293, 11], [359, 347, 1], [359, 382, 5], [359, 453, 7], [360, 295, 4], [360, 304, 1], [360, 346, 2], [360, 383, 5], [360, 453, 8], [361, 346, 2], [361, 384, 5], [361, 453, 8], [362, 346, 2], [362, 385, 5], [362, 453, 8], [363, 346, 2], [363, 386, 5], [363, 453, 8], [364, 387, 4], [364, 452, 10], [365, 388, 4], [365, 452, 10], [366, 389, 4], [366, 452, 9], [367, 389, 5], [367, 452, 9], [368, 390, 4], [368, 452, 9], [369, 391, 4], [369, 427, 1], [369, 452, 9], [370, 392, 4], [370, 426, 2], [370, 452, 9], [371, 393, 4], [371, 425, 4], [371, 452, 9], [372, 395, 5], [372, 423, 6], [372, 453, 8], [373, 396, 5], [373, 403, 2], [373, 423, 6], [373, 453, 8], [374, 397, 11], [374, 423, 5], [374, 451, 9], [374, 539, 3], [375, 398, 15], [375, 417, 10], [375, 450, 10], [375, 539, 3], [376, 400, 16], [376, 417, 9], [376, 449, 12], [376, 538, 4], [377, 401, 24], [377, 449, 12], [377, 538, 3], [378, 405, 19], [378, 449, 12], [378, 538, 3], [379, 413, 4], [379, 450, 11], [379, 538, 3], [380, 451, 10], [380, 538, 3], [381, 453, 7], [381, 537, 4], [382, 453, 7], [382, 537, 4], [383, 454, 6], [383, 537, 4], [384, 454, 6], [384, 537, 4], [385, 454, 5], [385, 537, 4], [386, 455, 4], [386, 537, 3], [387, 455, 4], [387, 537, 3], [388, 456, 4], [388, 536, 3], [389, 456, 4], [389, 536, 2], [390, 457, 3], [390, 536, 2], [391, 457, 3], [391, 537, 1], [392, 458, 3], [393, 458, 3], [394, 459, 3], [395, 460, 2], [396, 460, 2], [397, 461, 1], [398, 462, 1], [400, 463, 1], [401, 464, 1], [402, 546, 2], [403, 528, 3], [403, 545, 3], [404, 520, 2], [404, 524, 3], [404, 528, 3], [404, 544, 4], [405, 468, 2], [405, 516, 14], [405, 543, 5], [406, 469, 3], [406, 513, 1], [406, 515, 14], [406, 542, 5], [407, 470, 3], [407, 512, 14], [407, 541, 5], [408, 470, 4], [408, 512, 12], [408, 540, 6], [409, 403, 4], [409, 472, 3], [409, 512, 11], [409, 539, 7], [410, 399, 3], [410, 405, 4], [410, 471, 4], [410, 512, 11], [410, 539, 5], [411, 399, 3], [411, 471, 6], [411, 511, 11], [411, 538, 6], [412, 471, 7], [412, 511, 9], [412, 537, 7], [413, 472, 9], [413, 484, 1], [413, 509, 10], [413, 537, 6], [414, 473, 14], [414, 508, 11], [414, 537, 6], [415, 389, 4], [415, 480, 11], [415, 508, 11], [415, 537, 6], [416, 387, 3], [416, 437, 4], [416, 481, 15], [416, 498, 1], [416, 506, 5], [416, 513, 5], [416, 536, 6], [417, 386, 4], [417, 438, 2], [417, 441, 1], [417, 482, 19], [417, 502, 2], [417, 506, 4], [417, 514, 3], [417, 536, 4], [418, 387, 3], [418, 484, 23], [418, 536, 2], [419, 384, 1], [419, 486, 17], [419, 523, 3], [419, 535, 2], [420, 383, 2], [420, 498, 3], [420, 522, 5], [420, 534, 2], [421, 382, 3], [421, 521, 7], [421, 534, 2], [422, 382, 1], [422, 521, 7], [422, 534, 2], [423, 381, 2], [423, 521, 8], [423, 535, 2], [424, 381, 1], [424, 515, 4], [424, 521, 8], [424, 536, 2], [425, 514, 15], [425, 535, 3], [426, 513, 15], [426, 534, 4], [427, 513, 10], [427, 524, 3], [427, 532, 6], [428, 513, 10], [428, 531, 7], [429, 514, 10], [429, 530, 8], [430, 515, 10], [430, 529, 9], [431, 516, 9], [431, 529, 9], [432, 518, 7], [432, 528, 10], [433, 519, 5], [433, 527, 12], [434, 520, 3], [434, 526, 13], [435, 526, 13], [436, 526, 13], [437, 526, 13], [438, 526, 12], [439, 527, 11], [440, 527, 10], [441, 527, 10], [442, 527, 8], [443, 526, 9], [444, 526, 9], [445, 526, 8], [446, 527, 7], [447, 528, 5], [448, 529, 4], [449, 531, 1], [450, 531, 1], [454, 476, 3], [455, 476, 3], [456, 476, 4], [456, 525, 1], [457, 474, 6], [457, 524, 3], [458, 474, 6], [458, 493, 3], [458, 524, 3], [459, 474, 6], [459, 492, 5], [459, 523, 4], [460, 474, 4], [460, 491, 7], [460, 523, 5], [461, 474, 3], [461, 491, 7], [461, 523, 4], [462, 474, 1], [462, 491, 7], [462, 522, 5], [463, 474, 1], [463, 491, 7], [463, 519, 8], [464, 474, 1], [464, 491, 7], [464, 518, 9], [465, 491, 7], [465, 518, 8], [466, 491, 7], [466, 518, 8], [467, 491, 7], [467, 518, 8], [468, 491, 7], [468, 519, 6], [469, 491, 7], [469, 520, 5], [470, 483, 4], [470, 491, 7], [470, 520, 5], [471, 482, 6], [471, 489, 9], [471, 521, 4], [472, 481, 17], [472, 521, 4], [473, 292, 3], [473, 481, 16], [473, 521, 4], [474, 292, 5], [474, 481, 16], [474, 522, 4], [475, 292, 8], [475, 482, 14], [475, 522, 4], [476, 293, 9], [476, 483, 4], [476, 488, 7], [476, 522, 4], [477, 294, 4], [477, 300, 3], [477, 489, 5], [477, 522, 3], [478, 301, 3], [478, 521, 4], [479, 521, 4], [480, 521, 5], [481, 521, 5], [482, 520, 6], [483, 520, 6], [484, 390, 2], [484, 520, 6], [485, 390, 3], [485, 520, 5], [486, 390, 4], [486, 520, 5], [487, 390, 5], [487, 519, 6], [488, 391, 5], [488, 519, 6], [489, 392, 5], [489, 519, 6], [490, 393, 4], [490, 520, 5], [491, 520, 5], [492, 520, 5], [493, 521, 3], [494, 521, 4], [495, 521, 4], [496, 522, 4], [497, 522, 4], [498, 522, 3], [499, 326, 3], [499, 416, 4], [499, 483, 2], [499, 523, 3], [500, 325, 5], [500, 417, 5], [500, 483, 2], [500, 523, 3], [501, 295, 3], [501, 324, 7], [501, 418, 5], [501, 483, 1], [501, 523, 3], [502, 296, 3], [502, 324, 8], [502, 419, 5], [502, 524, 2], [503, 324, 8], [503, 366, 4], [503, 420, 3], [503, 480, 7], [503, 524, 1], [504, 325, 7], [504, 365, 6], [504, 480, 8], [504, 524, 2], [505, 364, 8], [505, 480, 9], [505, 524, 2], [506, 364, 8], [506, 480, 9], [506, 525, 2], [507, 364, 8], [507, 478, 11], [507, 525, 4], [508, 364, 9], [508, 477, 11], [508, 525, 3], [509, 365, 9], [509, 472, 1], [509, 475, 12], [509, 538, 2], [510, 366, 4], [510, 371, 5], [510, 471, 12], [510, 535, 7], [511, 363, 7], [511, 373, 4], [511, 463, 3], [511, 468, 14], [511, 534, 9], [512, 362, 8], [512, 376, 2], [512, 461, 20], [512, 533, 16], [513, 361, 9], [513, 379, 1], [513, 461, 18], [513, 533, 18], [514, 361, 9], [514, 380, 1], [514, 461, 17], [514, 533, 17], [515, 361, 9], [515, 382, 2], [515, 462, 15], [515, 534, 14], [516, 362, 8], [516, 383, 3], [516, 463, 4], [516, 535, 12], [516, 603, 3], [516, 608, 3], [517, 363, 7], [517, 384, 3], [517, 542, 4], [517, 603, 10], [517, 617, 1], [518, 365, 5], [518, 385, 3], [518, 572, 3], [518, 597, 17], [518, 616, 10], [519, 365, 5], [519, 386, 3], [519, 571, 5], [519, 594, 11], [519, 608, 24], [520, 365, 5], [520, 387, 4], [520, 571, 6], [520, 594, 11], [520, 613, 23], [521, 365, 5], [521, 389, 8], [521, 570, 8], [521, 581, 6], [521, 594, 10], [521, 615, 5], [521, 623, 4], [521, 628, 15], [522, 365, 5], [522, 390, 9], [522, 570, 19], [522, 591, 2], [522, 594, 10], [522, 636, 8], [523, 365, 5], [523, 391, 9], [523, 570, 31], [523, 637, 10], [524, 366, 4], [524, 393, 7], [524, 483, 3], [524, 570, 29], [524, 641, 9], [525, 366, 5], [525, 394, 8], [525, 482, 5], [525, 580, 17], [525, 644, 7], [525, 655, 4], [526, 366, 5], [526, 396, 7], [526, 481, 7], [526, 584, 9], [526, 647, 6], [526, 655, 4], [527, 366, 5], [527, 398, 6], [527, 481, 7], [527, 649, 9], [527, 665, 3], [528, 366, 5], [528, 400, 5], [528, 481, 7], [528, 650, 7], [528, 665, 4], [529, 367, 4], [529, 403, 3], [529, 481, 7], [529, 651, 3], [529, 666, 6], [530, 367, 4], [530, 407, 1], [530, 419, 3], [530, 482, 5], [530, 667, 6], [530, 677, 3], [531, 367, 5], [531, 419, 9], [531, 483, 3], [531, 673, 1], [531, 677, 1], [531, 679, 2], [532, 367, 5], [532, 413, 2], [532, 417, 13], [532, 681, 1], [533, 368, 4], [533, 415, 16], [533, 440, 4], [533, 493, 3], [533, 682, 1], [534, 368, 3], [534, 417, 11], [534, 439, 6], [534, 492, 5], [534, 571, 3], [534, 682, 2], [535, 368, 3], [535, 442, 4], [535, 491, 7], [535, 570, 5], [535, 683, 1], [536, 368, 3], [536, 445, 1], [536, 491, 7], [536, 566, 10], [536, 684, 1], [537, 368, 2], [537, 490, 2], [537, 493, 5], [537, 565, 11], [537, 684, 1], [538, 484, 3], [538, 496, 2], [538, 564, 12], [538, 685, 1], [539, 483, 5], [539, 564, 11], [540, 482, 7], [540, 564, 10], [540, 576, 3], [541, 482, 7], [541, 565, 6], [541, 575, 5], [542, 482, 6], [542, 518, 5], [542, 566, 4], [542, 574, 7], [543, 483, 6], [543, 517, 7], [543, 534, 3], [543, 574, 7], [544, 484, 6], [544, 515, 13], [544, 533, 5], [544, 574, 7], [545, 485, 3], [545, 489, 2], [545, 516, 6], [545, 523, 8], [545, 532, 7], [545, 574, 7], [546, 489, 2], [546, 527, 3], [546, 532, 7], [546, 572, 9], [546, 582, 21], [546, 646, 3], [547, 489, 2], [547, 537, 2], [547, 563, 30], [547, 595, 15], [547, 645, 5], [548, 473, 3], [548, 489, 1], [548, 559, 28], [548, 607, 2], [548, 614, 7], [548, 644, 7], [549, 474, 3], [549, 555, 26], [549, 619, 4], [549, 644, 7], [549, 670, 3], [550, 474, 4], [550, 557, 19], [550, 577, 4], [550, 644, 7], [550, 669, 5], [551, 474, 4], [551, 561, 4], [551, 567, 3], [551, 572, 4], [551, 579, 1], [551, 645, 7], [551, 668, 7], [552, 474, 4], [552, 645, 7], [552, 668, 7], [553, 475, 3], [553, 645, 7], [553, 668, 7], [554, 475, 3], [554, 648, 2], [554, 666, 5], [554, 672, 2], [555, 476, 1], [555, 667, 1], [556, 476, 2], [556, 494, 2], [557, 477, 2], [557, 493, 3], [558, 477, 2], [558, 493, 3], [559, 477, 3], [559, 493, 3], [560, 477, 3], [560, 494, 2], [561, 478, 2], [561, 495, 1], [562, 478, 2], [563, 478, 2], [570, 479, 1], [571, 478, 2], [572, 477, 3], [573, 477, 2], [671, 518, 3], [672, 519, 3], [673, 520, 4], [674, 521, 4], [675, 523, 4], [676, 525, 3], [677, 527, 3], [678, 528, 3], [679, 528, 4], [680, 529, 5], [681, 530, 6], [682, 534, 3], [683, 537, 2], [684, 540, 1], [685, 541, 1], [688, 546, 3], [689, 545, 7], [690, 544, 12], [691, 544, 14], [692, 544, 15], [692, 570, 5], [693, 545, 5], [693, 552, 5], [693, 570, 11], [693, 585, 11], [694, 546, 3], [694, 570, 24], [694, 601, 9], [695, 571, 9], [695, 585, 6], [695, 602, 7], [696, 572, 4], [696, 586, 3], [696, 603, 5], [697, 620, 1], [698, 620, 6], [699, 621, 6], [700, 622, 6], [708, 572, 3], [709, 559, 3], [709, 571, 5], [710, 558, 5], [710, 570, 7], [711, 557, 7], [711, 570, 7], [712, 555, 10], [712, 570, 7], [713, 557, 8], [713, 570, 1]], rem: [[25, 116, 2], [26, 116, 3], [27, 116, 3], [28, 116, 4], [29, 116, 5], [30, 116, 6], [31, 116, 6], [32, 116, 6], [33, 117, 5], [34, 117, 5], [35, 117, 5], [36, 117, 5], [37, 117, 5], [38, 118, 4], [39, 119, 4], [40, 120, 4], [41, 121, 4], [42, 122, 3], [43, 123, 3], [44, 125, 2], [45, 126, 1], [283, 236, 1], [284, 233, 1], [284, 237, 1], [285, 233, 1], [285, 238, 4], [286, 233, 1], [286, 240, 3], [287, 244, 4], [288, 248, 6], [289, 249, 4], [290, 250, 2], [291, 250, 1], [296, 440, 1], [297, 440, 2], [298, 439, 6], [299, 439, 10], [300, 439, 16], [301, 440, 5], [301, 446, 9], [302, 441, 4], [302, 451, 2], [302, 454, 1], [303, 441, 1], [303, 455, 1], [310, 439, 1], [311, 438, 2], [312, 437, 4], [320, 439, 1], [321, 438, 2], [322, 436, 3], [323, 436, 3], [324, 436, 3], [325, 435, 4], [326, 435, 5], [327, 435, 5], [328, 436, 3], [329, 437, 2], [352, 347, 3], [353, 347, 4], [354, 348, 2], [415, 434, 1], [416, 428, 8], [417, 434, 2], [417, 442, 2], [418, 443, 2], [419, 443, 4], [420, 443, 7], [421, 443, 8], [422, 444, 13], [423, 446, 12], [424, 447, 13], [425, 449, 13], [426, 451, 12], [427, 452, 12], [428, 453, 12], [429, 454, 11], [430, 455, 11], [431, 456, 10], [432, 458, 9], [433, 459, 9], [434, 461, 8], [435, 464, 5], [436, 465, 4], [437, 467, 3], [438, 468, 2], [445, 474, 1], [446, 475, 1], [447, 475, 2], [448, 476, 2], [449, 477, 1], [450, 477, 1], [451, 477, 2], [467, 474, 1], [468, 473, 2], [469, 473, 2], [470, 472, 3], [471, 471, 4], [472, 470, 5], [473, 470, 5], [474, 470, 5], [475, 470, 5], [476, 470, 5], [477, 470, 5], [478, 470, 6], [479, 470, 6], [480, 470, 6], [481, 470, 5], [482, 470, 5], [483, 470, 5], [484, 470, 6], [485, 471, 13], [486, 471, 14], [487, 472, 14], [488, 472, 15], [489, 473, 10], [489, 486, 1], [490, 473, 9], [490, 487, 1], [491, 474, 7], [491, 488, 1], [492, 474, 7], [492, 488, 1], [493, 475, 6], [493, 488, 1], [494, 475, 5], [494, 488, 1], [495, 476, 1], [495, 488, 2], [496, 488, 2], [497, 487, 3], [498, 487, 3], [499, 486, 4], [500, 487, 3], [501, 475, 2], [502, 474, 7], [503, 473, 7], [504, 472, 7], [505, 470, 8], [506, 469, 7], [507, 464, 10], [508, 460, 13], [509, 457, 7], [510, 453, 10], [511, 454, 4], [511, 461, 1], [540, 355, 1], [541, 354, 4], [542, 353, 4], [543, 353, 3], [544, 353, 2], [545, 353, 2], [546, 354, 1], [547, 354, 1], [548, 354, 1], [644, 455, 3], [645, 450, 9], [646, 443, 16], [647, 444, 16], [648, 446, 14], [649, 450, 10], [650, 452, 8], [651, 453, 7], [652, 454, 6], [653, 455, 5], [654, 456, 4], [655, 457, 3], [656, 458, 3], [657, 460, 2], [658, 470, 1], [700, 629, 1], [701, 630, 6], [702, 631, 5], [703, 632, 4], [704, 633, 3], [705, 634, 1], [706, 634, 1], [707, 634, 1], [708, 634, 1], [709, 633, 2], [710, 633, 1], [711, 632, 1]] }, bog: { x0: -216, y0: -174, cell: 1, nx: 365, ny: 308, add: [[94, 263, 3], [95, 264, 4], [96, 265, 6], [97, 265, 8], [98, 266, 9], [99, 266, 11], [100, 267, 12], [101, 268, 13], [102, 268, 15], [103, 269, 16], [104, 271, 16], [105, 272, 17], [106, 273, 18], [107, 275, 17], [108, 276, 18], [109, 277, 18], [110, 279, 17], [111, 280, 17], [112, 281, 17], [113, 282, 17], [114, 284, 15], [115, 285, 15], [116, 286, 15], [117, 286, 16], [118, 287, 16], [119, 288, 15], [120, 289, 15], [121, 290, 15], [122, 291, 14], [123, 292, 14], [124, 292, 14], [125, 293, 14], [126, 294, 13], [127, 295, 12], [128, 296, 11], [129, 297, 11], [130, 297, 12], [131, 298, 11], [132, 299, 11], [133, 299, 12], [134, 300, 11], [135, 301, 11], [136, 301, 12], [137, 302, 11], [138, 302, 12], [139, 303, 11], [140, 303, 12], [141, 304, 12], [142, 304, 12], [143, 305, 12], [144, 306, 11], [145, 306, 12], [146, 307, 12], [147, 307, 12], [148, 308, 12], [149, 308, 12], [150, 309, 12], [151, 309, 12], [152, 310, 12], [153, 311, 13], [154, 311, 15], [155, 312, 16], [156, 313, 16], [157, 314, 16], [158, 315, 16], [159, 316, 16], [160, 317, 16], [161, 317, 17], [162, 318, 17], [163, 319, 18], [164, 320, 18], [165, 321, 18], [166, 322, 18], [167, 322, 19], [168, 323, 18], [169, 323, 19], [170, 323, 19], [171, 324, 19], [172, 324, 19], [173, 325, 18], [174, 325, 19], [175, 326, 18], [176, 326, 18], [177, 326, 18], [178, 327, 17], [179, 327, 17], [180, 328, 16], [181, 328, 16], [182, 329, 15], [183, 329, 15], [184, 330, 14], [185, 330, 14], [186, 330, 14], [187, 330, 14], [188, 331, 13], [189, 331, 13], [190, 331, 13], [191, 331, 13], [192, 331, 13], [193, 332, 12], [194, 332, 12], [195, 332, 12], [196, 332, 12], [197, 333, 11], [198, 333, 11], [199, 333, 11], [200, 333, 11], [201, 334, 10], [202, 334, 10], [203, 334, 9], [204, 334, 9], [205, 334, 9], [206, 126, 1], [206, 334, 9], [207, 126, 2], [207, 334, 9], [208, 126, 3], [208, 335, 8], [209, 127, 3], [209, 335, 8], [210, 127, 4], [210, 335, 8], [211, 128, 4], [211, 335, 8], [212, 129, 5], [212, 335, 8], [213, 130, 5], [213, 335, 8], [214, 130, 6], [214, 335, 8], [215, 131, 6], [215, 336, 7], [216, 132, 6], [216, 336, 7], [217, 133, 6], [217, 336, 7], [218, 133, 8], [218, 336, 7], [219, 134, 8], [219, 336, 7], [220, 135, 8], [220, 336, 8], [221, 136, 8], [221, 336, 8], [222, 137, 8], [222, 336, 8], [223, 138, 9], [223, 336, 8], [224, 139, 9], [224, 337, 8], [225, 140, 9], [225, 337, 8], [226, 141, 9], [226, 337, 8], [227, 142, 9], [227, 337, 8], [228, 143, 9], [228, 337, 8], [229, 144, 10], [229, 337, 8], [230, 145, 10], [230, 337, 8], [231, 146, 10], [231, 337, 8], [232, 147, 10], [232, 337, 9], [233, 148, 10], [233, 337, 9], [234, 150, 10], [234, 337, 9], [235, 151, 10], [235, 337, 9], [236, 152, 10], [236, 338, 7], [237, 153, 10], [237, 338, 7], [238, 155, 9], [238, 338, 7], [239, 156, 9], [239, 338, 7], [240, 157, 9], [240, 338, 6], [241, 159, 8], [241, 338, 6], [242, 160, 9], [242, 338, 6], [243, 162, 8], [243, 338, 6], [244, 163, 8], [244, 339, 3], [245, 165, 7], [245, 339, 2], [246, 167, 6], [246, 339, 1], [247, 169, 5], [248, 171, 4], [249, 173, 3], [250, 176, 1], [251, 178, 1], [286, 317, 9], [287, 318, 10], [288, 319, 10], [289, 320, 11], [290, 321, 12], [291, 323, 12], [292, 324, 10], [293, 326, 7]], rem: [[17, 38, 4], [18, 37, 10], [19, 36, 16], [20, 35, 21], [21, 34, 26], [22, 33, 30], [23, 33, 32], [24, 32, 35], [25, 31, 38], [26, 30, 42], [27, 29, 45], [28, 28, 48], [29, 27, 51], [30, 26, 55], [31, 26, 57], [32, 25, 60], [33, 24, 63], [34, 23, 67], [35, 22, 70], [36, 21, 72], [37, 20, 74], [38, 19, 37], [38, 57, 38], [39, 18, 36], [39, 56, 41], [40, 18, 35], [40, 56, 42], [41, 17, 35], [41, 55, 44], [42, 17, 34], [42, 54, 47], [43, 18, 32], [43, 53, 49], [44, 19, 30], [44, 52, 51], [45, 20, 28], [45, 51, 54], [46, 21, 26], [46, 50, 56], [47, 22, 24], [47, 49, 58], [48, 23, 22], [48, 48, 61], [49, 24, 20], [49, 47, 63], [50, 25, 19], [50, 46, 18], [50, 69, 42], [51, 26, 17], [51, 46, 18], [51, 71, 42], [52, 27, 15], [52, 46, 17], [52, 73, 41], [53, 28, 13], [53, 45, 17], [53, 75, 40], [54, 29, 11], [54, 43, 18], [54, 77, 39], [54, 161, 4], [55, 30, 9], [55, 42, 18], [55, 78, 46], [55, 156, 8], [55, 173, 9], [55, 201, 10], [56, 31, 8], [56, 41, 18], [56, 80, 43], [56, 157, 6], [56, 177, 5], [56, 183, 31], [57, 32, 7], [57, 40, 19], [57, 81, 42], [57, 186, 30], [58, 33, 25], [58, 83, 39], [58, 191, 28], [59, 34, 4], [59, 39, 19], [59, 85, 36], [59, 195, 27], [60, 35, 22], [60, 85, 35], [60, 198, 27], [61, 36, 21], [61, 86, 27], [61, 200, 27], [62, 37, 19], [62, 88, 24], [62, 202, 28], [63, 38, 18], [63, 90, 20], [63, 204, 29], [64, 39, 17], [64, 93, 15], [64, 206, 28], [65, 40, 15], [65, 95, 7], [65, 208, 28], [66, 41, 14], [66, 211, 26], [67, 42, 13], [67, 212, 26], [68, 44, 11], [68, 214, 26], [69, 45, 9], [69, 216, 25], [70, 46, 8], [70, 218, 24], [71, 47, 7], [71, 220, 24], [72, 48, 6], [72, 222, 23], [73, 49, 5], [73, 225, 21], [74, 52, 1], [74, 227, 21], [75, 229, 20], [76, 230, 20], [77, 232, 20], [78, 234, 19], [79, 235, 19], [80, 237, 18], [81, 239, 17], [82, 241, 15], [83, 242, 15], [84, 244, 13], [85, 246, 12], [86, 248, 11], [87, 250, 9], [88, 252, 8], [89, 255, 5], [90, 257, 4], [91, 259, 3], [94, 73, 3], [95, 74, 5], [96, 75, 6], [97, 77, 5], [98, 78, 5], [99, 79, 5], [100, 79, 7], [101, 79, 8], [102, 79, 9], [103, 79, 10], [104, 79, 10], [105, 79, 11], [106, 79, 12], [107, 79, 13], [108, 79, 13], [109, 79, 14], [110, 78, 15], [111, 78, 16], [112, 78, 16], [113, 77, 18], [114, 77, 18], [115, 76, 19], [116, 76, 20], [117, 76, 20], [118, 75, 21], [119, 75, 21], [120, 75, 22], [121, 74, 23], [122, 74, 23], [123, 74, 23], [124, 74, 23], [125, 74, 23], [126, 74, 24], [127, 74, 24], [128, 74, 24], [129, 74, 24], [130, 74, 24], [131, 74, 25], [132, 74, 25], [133, 74, 25], [134, 74, 25], [135, 74, 26], [136, 74, 26], [137, 74, 26], [138, 74, 26], [139, 74, 27], [140, 74, 27], [141, 74, 27], [142, 75, 26], [143, 75, 27], [144, 75, 27], [145, 75, 27], [146, 76, 26], [147, 76, 27], [148, 76, 27], [149, 77, 26], [150, 77, 26], [151, 77, 27], [152, 78, 26], [153, 78, 26], [154, 78, 27], [155, 78, 27], [156, 79, 26], [157, 79, 27], [158, 79, 27], [159, 80, 26], [160, 80, 26], [161, 80, 26], [162, 81, 26], [163, 82, 25], [164, 83, 24], [165, 84, 23], [166, 85, 22], [167, 86, 21], [168, 87, 21], [169, 88, 20], [170, 89, 19], [171, 90, 18], [172, 91, 18], [173, 92, 17], [174, 93, 17], [175, 94, 16], [176, 95, 15], [177, 96, 15], [178, 96, 15], [179, 97, 14], [180, 98, 14], [181, 99, 13], [182, 100, 12], [183, 101, 11], [184, 102, 11], [185, 103, 10], [186, 104, 10], [187, 105, 10], [188, 106, 9], [189, 107, 9], [190, 108, 9], [191, 110, 7], [192, 111, 7], [193, 112, 7], [194, 113, 6], [195, 114, 6], [196, 115, 6], [197, 116, 5], [198, 118, 4], [199, 119, 3], [200, 120, 3], [201, 121, 2], [202, 122, 2], [203, 123, 2], [204, 124, 1], [248, 338, 1], [249, 338, 1], [250, 337, 2], [251, 337, 2], [252, 337, 2], [253, 336, 3], [254, 336, 3], [255, 336, 3], [256, 336, 3], [257, 336, 3], [258, 336, 3], [259, 337, 3], [260, 337, 3], [261, 337, 4], [262, 337, 4], [263, 337, 5], [264, 337, 5], [265, 337, 6], [266, 338, 5], [267, 338, 6], [268, 338, 6], [269, 338, 7], [270, 339, 6], [271, 339, 7], [272, 339, 7], [273, 340, 7], [274, 340, 7], [275, 205, 7], [275, 340, 8], [276, 206, 8], [276, 341, 7], [277, 207, 9], [277, 341, 7], [278, 208, 9], [278, 342, 5], [279, 209, 10], [279, 343, 3], [280, 210, 10], [280, 343, 2], [281, 211, 11], [282, 212, 14], [283, 212, 17], [284, 214, 18], [285, 217, 17], [286, 221, 15], [287, 224, 14]] } };

// site/js/sim/arena.js
function arenaShape(id) {
  let shape = SHAPES.get(id);
  if (shape)
    return shape;
  const sh = ARENA_SHAPES[id];
  const ed = WALK_EDITS[id];
  shape = ed && sh ? shapeFromCells(walkCells(id, ed), sh) : sh?.grid ? gridShape(sh.grid, sh.spawn) : sh?.poly ? polygon(sh.poly) : CIRCLE;
  if (sh?.bell || sh?.grates)
    shape = { ...shape, ...sh.bell ? { bell: sh.bell } : {}, ...sh.grates ? { grates: sh.grates } : {} };
  shape = Object.freeze(shape);
  SHAPES.set(id, shape);
  return shape;
}
var SHAPES = new Map;
function walkCells(id, ed = null) {
  const sh = ARENA_SHAPES[id];
  if (!sh)
    return null;
  let g;
  if (sh.grid) {
    const { x0, y0, cell, nx, ny, margin = 0 } = sh.grid;
    g = { x0, y0, cell, nx, ny, margin, inside: new Uint8Array(nx * ny) };
    sh.grid.rows.forEach((runs, j) => {
      for (let k = 0;k < runs.length; k += 2)
        g.inside.fill(1, j * nx + runs[k], j * nx + runs[k] + runs[k + 1]);
    });
  } else if (sh.poly) {
    const xs = sh.poly.map((p) => p[0]), ys = sh.poly.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)) - 16, y0 = Math.floor(Math.min(...ys)) - 16;
    const nx = Math.ceil(Math.max(...xs)) + 16 - x0, ny = Math.ceil(Math.max(...ys)) + 16 - y0;
    g = { x0, y0, cell: 1, nx, ny, margin: 0, inside: new Uint8Array(nx * ny) };
    const n = sh.poly.length;
    const xs2 = [];
    for (let j = 0;j < ny; j++) {
      const y = y0 + j + 0.5;
      xs2.length = 0;
      for (let a = 0, b = n - 1;a < n; b = a++) {
        const [ax, ay] = sh.poly[b], [bx, by] = sh.poly[a];
        if (ay > y !== by > y)
          xs2.push((bx - ax) * (y - ay) / (by - ay) + ax);
      }
      xs2.sort((p, q) => p - q);
      let k = 0;
      for (let i = 0;i < nx; i++) {
        const x = x0 + i + 0.5;
        while (k < xs2.length && xs2[k] <= x)
          k++;
        if (xs2.length - k & 1)
          g.inside[j * nx + i] = 1;
      }
    }
  } else
    return null;
  if (ed && ed.nx === g.nx && ed.ny === g.ny && ed.x0 === g.x0 && ed.y0 === g.y0) {
    for (const [j, i, c] of ed.add || [])
      g.inside.fill(1, j * g.nx + i, j * g.nx + i + c);
    for (const [j, i, c] of ed.rem || [])
      g.inside.fill(0, j * g.nx + i, j * g.nx + i + c);
  } else if (ed) {
    console.warn(`walk edits for "${id}" left off: drawn on grid ${ed.x0},${ed.y0} ${ed.nx}x${ed.ny}, the floor's is now ${g.x0},${g.y0} ${g.nx}x${g.ny}`);
  }
  return g;
}
function shapeFromCells(c, sh = {}) {
  const rows = [];
  for (let j = 0;j < c.ny; j++) {
    const r = [];
    let i = 0;
    while (i < c.nx) {
      if (!c.inside[j * c.nx + i]) {
        i++;
        continue;
      }
      const a = i;
      while (i < c.nx && c.inside[j * c.nx + i])
        i++;
      r.push(a, i - a);
    }
    rows.push(r);
  }
  const g = { ...sh.grid || {}, x0: c.x0, y0: c.y0, cell: c.cell, nx: c.nx, ny: c.ny, margin: c.margin, rows };
  if (!sh.grid)
    g.smooth = 1;
  const shape = gridShape(g, sh.spawn || [0, 0]);
  if (sh.poly)
    shape.poly = sh.poly;
  return shape;
}
var CIRCLE = {
  R: ARENA.R,
  poly: null,
  out: (x, y) => Math.hypot(x, y) - ARENA.R,
  keep(o, m) {
    const d = Math.hypot(o.x, o.y);
    const lim = ARENA.R - m;
    if (d <= lim)
      return null;
    const k = lim / d;
    o.x *= k;
    o.y *= k;
    return [o.x / d, o.y / d];
  },
  edge: (a, m) => [Math.cos(a) * (ARENA.R - m), Math.sin(a) * (ARENA.R - m)]
};
function polygon(pts) {
  const n = pts.length;
  const R = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
  const near = { qx: 0, qy: 0, d: 0, inside: false };
  function nearest(x, y) {
    let best = Infinity, qx = 0, qy = 0, inside = false;
    for (let i = 0, j = n - 1;i < n; j = i++) {
      const A = pts[j], B = pts[i], ax = A[0], ay = A[1], bx = B[0], by = B[1];
      if (ay > y !== by > y && x < (bx - ax) * (y - ay) / (by - ay) + ax)
        inside = !inside;
      const ex = bx - ax, ey = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
      const px = ax + ex * t, py = ay + ey * t;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < best)
        best = d, qx = px, qy = py;
    }
    near.qx = qx;
    near.qy = qy;
    near.d = Math.sqrt(best);
    near.inside = inside;
    return near;
  }
  return {
    R,
    poly: pts,
    out(x, y) {
      const { d, inside } = nearest(x, y);
      return inside ? -d : d;
    },
    keep(o, m) {
      let moved = null;
      for (let k = 0;k < 3; k++) {
        const { qx, qy, d, inside } = nearest(o.x, o.y);
        if (inside && d >= m - 0.000001)
          break;
        let nx = inside ? qx - o.x : o.x - qx, ny = inside ? qy - o.y : o.y - qy;
        const l = Math.hypot(nx, ny);
        if (l < 0.000000001)
          nx = qx, ny = qy;
        const ln = Math.hypot(nx, ny) || 1;
        nx /= ln;
        ny /= ln;
        o.x = qx - nx * m;
        o.y = qy - ny * m;
        moved = [nx, ny];
      }
      return moved;
    },
    edge(a, m) {
      const dx = Math.cos(a), dy = Math.sin(a);
      let t = R;
      for (let i = 0, j = n - 1;i < n; j = i++) {
        const [ax, ay] = pts[j], [bx, by] = pts[i];
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 0.000000000001)
          continue;
        const s = (ax * ey - ay * ex) / den;
        const u = (ax * dy - ay * dx) / den;
        if (s > 0 && u >= 0 && u <= 1)
          t = Math.min(t, s);
      }
      const r = Math.max(0, t - m);
      return [dx * r, dy * r];
    }
  };
}
function gridShape(g, spawn = [0, 0]) {
  const { x0, y0, cell, nx, ny } = g;
  const inside = new Uint8Array(nx * ny);
  g.rows.forEach((runs, j) => {
    for (let k = 0;k < runs.length; k += 2)
      inside.fill(1, j * nx + runs[k], j * nx + runs[k] + runs[k + 1]);
  });
  const shift = g.margin || 0;
  const dist = (want) => {
    const d = new Float32Array(nx * ny).fill(1e9);
    for (let i = 0;i < nx * ny; i++)
      if (inside[i] !== want)
        d[i] = 0;
    const D = Math.SQRT2;
    for (let j = 0;j < ny; j++)
      for (let i = 0;i < nx; i++) {
        const k = j * nx + i;
        if (i > 0)
          d[k] = Math.min(d[k], d[k - 1] + 1);
        if (j > 0) {
          d[k] = Math.min(d[k], d[k - nx] + 1);
          if (i > 0)
            d[k] = Math.min(d[k], d[k - nx - 1] + D);
          if (i < nx - 1)
            d[k] = Math.min(d[k], d[k - nx + 1] + D);
        }
      }
    for (let j = ny - 1;j >= 0; j--)
      for (let i = nx - 1;i >= 0; i--) {
        const k = j * nx + i;
        if (i < nx - 1)
          d[k] = Math.min(d[k], d[k + 1] + 1);
        if (j < ny - 1) {
          d[k] = Math.min(d[k], d[k + nx] + 1);
          if (i < nx - 1)
            d[k] = Math.min(d[k], d[k + nx + 1] + D);
          if (i > 0)
            d[k] = Math.min(d[k], d[k + nx - 1] + D);
        }
      }
    return d;
  };
  const din = dist(1), dout = dist(0);
  const sd = new Float32Array(nx * ny);
  for (let i = 0;i < nx * ny; i++)
    sd[i] = (inside[i] ? -(din[i] - 0.5) : dout[i] - 0.5) * cell - shift;
  if (g.smooth) {
    const r = Math.ceil(g.smooth * 3), k = [];
    for (let i = -r;i <= r; i++)
      k.push(Math.exp(-(i * i) / (2 * g.smooth * g.smooth)));
    const ks = k.reduce((a, b) => a + b, 0);
    const tmp = new Float32Array(nx * ny);
    for (let j = 0;j < ny; j++)
      for (let i = 0;i < nx; i++) {
        let acc = 0;
        for (let q = -r;q <= r; q++)
          acc += k[q + r] * sd[j * nx + Math.min(nx - 1, Math.max(0, i + q))];
        tmp[j * nx + i] = acc / ks;
      }
    for (let j = 0;j < ny; j++)
      for (let i = 0;i < nx; i++) {
        let acc = 0;
        for (let q = -r;q <= r; q++)
          acc += k[q + r] * tmp[Math.min(ny - 1, Math.max(0, j + q)) * nx + i];
        sd[j * nx + i] = acc / ks;
      }
  }
  const at = (i, j) => sd[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  const out = (x, y) => {
    const fx = (x - x0) / cell - 0.5, fy = (y - y0) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    const off = Math.max(0, x0 - x, x - (x0 + nx * cell), y0 - y, y - (y0 + ny * cell));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v + off;
  };
  const xs = [x0, x0 + nx * cell], ys = [y0, y0 + ny * cell];
  return {
    R: Math.max(...xs.flatMap((x) => ys.map((y) => Math.hypot(x, y)))),
    poly: [[xs[0], ys[0]], [xs[1], ys[0]], [xs[1], ys[1]], [xs[0], ys[1]]],
    spawn,
    out,
    glide: !!g.glide,
    wideNormal(x, y) {
      const e = typeof g.glide === "number" ? g.glide : 6;
      const gx = out(x + e, y) - out(x - e, y), gy = out(x, y + e) - out(x, y - e), l = Math.hypot(gx, gy) || 1;
      return [gx / l, gy / l];
    },
    keep(o, m, hold = false) {
      let moved = null;
      for (let k = 0;k < 4; k++) {
        const d = out(o.x, o.y) + m;
        if (d <= 0)
          break;
        const e = 0.5;
        let gx = out(o.x + e, o.y) - out(o.x - e, o.y), gy = out(o.x, o.y + e) - out(o.x, o.y - e);
        const l = Math.hypot(gx, gy) || 1;
        gx /= l;
        gy /= l;
        o.x -= gx * (d + 0.05);
        o.y -= gy * (d + 0.05);
        moved = [gx, gy];
      }
      if (hold && moved && out(o.x, o.y) + m > 0.5) {
        const [ex, ey] = this.edge(Math.atan2(o.y - spawn[1], o.x - spawn[0]), m), l = Math.hypot(o.x - ex, o.y - ey) || 1;
        moved = [(o.x - ex) / l, (o.y - ey) / l];
        o.x = ex;
        o.y = ey;
      }
      return moved;
    },
    edge(a, m) {
      const c = Math.cos(a), sn = Math.sin(a);
      let lo = -1;
      let r = 0;
      for (;r < 800; r += 2) {
        if (out(spawn[0] + c * r, spawn[1] + sn * r) > -m)
          break;
        lo = r;
      }
      if (lo < 0)
        return spawn;
      let hi = Math.min(r, lo + 2);
      for (let k = 0;k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (out(spawn[0] + c * mid, spawn[1] + sn * mid) > -m)
          hi = mid;
        else
          lo = mid;
      }
      return [spawn[0] + c * lo, spawn[1] + sn * lo];
    }
  };
}

// site/js/content/weapons.js
var HAND_REACH = {
  one: { flat: 4.26, rise: 4.21, fall: 4.52, overhead: 4.26, thrust: 6.63, bash: 5, sw1: 5.32, sw2: 5.32, sw3: 5.32 },
  two: { flat: 3.99, rise: 4.03, fall: 4.3, overhead: 4.79, thrust: 6, bash: 5 },
  off: { flat: 4.5, rise: 4.57, fall: 4.67, overhead: 4.57, thrust: 6.88, bash: 5, pairedFlat: 4.2, pairedCross: 4.41 }
};
var reachOf = (grip, pose) => HAND_REACH[grip][pose] ?? HAND_REACH.one[pose] ?? 4.3;
var tipIn = (w, grip) => w.tip + (grip !== "two" ? w.foot ?? 0 : 0);
var m = (pose, sweep, wind, active, recover, dmg, arc, cost, poise, extra = {}) => ({ pose, sweep, wind, active, recover, dmg, arc, cost, poise, shape: pose === "thrust" || pose === "bash" ? "thrust" : pose === "overhead" ? "slam" : "arc", fx: extra.heavy ? "heavy" : "swing", ...extra });
var WEAPONS = {
  sword: {
    name: "Sword",
    cls: "straight",
    kind: "weapon",
    tip: 8.98,
    hands: "one",
    keyed: true,
    moves: PLAYER.combo.map((c, i) => ({ ...c, ...i === 2 ? { active: 0.15 } : {}, pose: `sw${i + 1}`, sweep: i === 1 ? -1 : 1, shape: "arc", step: i })),
    paired: [m("pairedFlat", 1, 0.12, 0.09, 0.24, 16, 2.2, 16, 14), m("pairedCross", -1, 0.13, 0.09, 0.3, 18, 2, 16, 16)],
    guard: { negate: 0.55, stability: 25, parry: 0, speed: 0.6 }
  },
  shortsword: {
    name: "Shortsword",
    cls: "straight",
    kind: "weapon",
    tip: 7.1,
    hands: "one",
    moves: [m("flat", 1, 0.085, 0.06, 0.15, 21, 1.7, 8, 6), m("flat", -1, 0.068, 0.06, 0.15, 21, 1.7, 8, 6), m("rise", 1, 0.077, 0.06, 0.15, 21, 1.7, 8, 6), m("flat", -1, 0.068, 0.06, 0.15, 21, 1.7, 8, 6), m("thrust", 0, 0.119, 0.07, 0.25, 36, 0.25, 11, 12, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.09, 0.07, 0.2, 26, 2, 12, 10), m("pairedCross", -1, 0.09, 0.07, 0.24, 28, 1.9, 12, 12)],
    guard: { negate: 0.5, stability: 20, parry: 0, speed: 0.65 }
  },
  longsword: {
    name: "Longsword",
    cls: "straight",
    kind: "weapon",
    tip: 11,
    hands: "two",
    carry: "chudan",
    moves: [m("fall", 1, 0.111, 0.08, 0.2, 10, 2, 13, 11), m("flat", -1, 0.111, 0.08, 0.2, 10, 2.1, 13, 11), m("rise", 1, 0.111, 0.08, 0.2, 10, 2, 13, 11), m("flat", -1, 0.093, 0.08, 0.2, 10, 2.1, 13, 11), m("fall", -1, 0.153, 0.09, 0.338, 16, 2.1, 17, 22, { heavy: true })],
    two: [m("fall", 1, 0.119, 0.08, 0.213, 12, 2, 14, 13), m("overhead", 0, 0.111, 0.08, 0.213, 12, 0.5, 14, 13), m("rise", -1, 0.119, 0.08, 0.213, 12, 2, 14, 13), m("overhead", 0, 0.102, 0.08, 0.213, 12, 0.5, 14, 13), m("fall", -1, 0.153, 0.09, 0.338, 19, 2.1, 18, 26, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.14, 0.09, 0.28, 12, 2.3, 18, 16), m("pairedCross", -1, 0.15, 0.09, 0.32, 13, 2.1, 18, 18)],
    guard: { negate: 0.6, stability: 30, parry: 0, speed: 0.6 }
  },
  greatsword: {
    name: "Greatsword",
    cls: "greatsword",
    kind: "weapon",
    tip: 14.2,
    hands: "two",
    carry: "shoulder",
    moves: [m("flat", 1, 0.128, 0.1, 0.338, 8, 2.4, 20, 22), m("flat", -1, 0.128, 0.1, 0.338, 8, 2.4, 20, 22), m("flat", 1, 0.136, 0.1, 0.338, 8, 2.4, 20, 22), m("fall", -1, 0.187, 0.11, 0.425, 11, 2.3, 26, 44, { heavy: true })],
    two: [m("fall", 1, 0.128, 0.1, 0.338, 8, 2.3, 22, 26, { armor: 1 }), m("overhead", 0, 0.153, 0.11, 0.35, 9, 0.5, 23, 26, { armor: 1 }), m("fall", -1, 0.136, 0.1, 0.338, 9, 2.3, 22, 26, { armor: 1 }), m("overhead", 0, 0.204, 0.12, 0.45, 12, 0.5, 28, 52, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedFlat", 1, 0.3, 0.13, 0.48, 10, 2.6, 32, 40, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 }
  },
  colossal: {
    name: "Colossal Sword",
    cls: "colossal",
    kind: "weapon",
    tip: 20.1,
    hands: "two",
    carry: "shoulder",
    moves: [m("flat", 1, 0.145, 0.12, 0.475, 5, 3, 28, 40, { armor: 1 }), m("flat", -1, 0.187, 0.12, 0.475, 6, 3, 28, 40, { armor: 1 }), m("flat", 1, 0.17, 0.13, 0.575, 7, 3, 32, 80, { armor: 1, heavy: true })],
    two: [m("flat", 1, 0.136, 0.12, 0.475, 5, 3, 30, 46, { armor: 1 }), m("flat", -1, 0.179, 0.12, 0.475, 5, 3, 30, 46, { armor: 1 }), m("overhead", 0, 0.187, 0.13, 0.575, 7, 0.5, 34, 92, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedFlat", 1, 0.44, 0.17, 0.64, 7, 3.2, 40, 64, { armor: 1, heavy: true })],
    guard: { negate: 0.75, stability: 45, parry: 0, speed: 0.45 }
  },
  scimitar: {
    name: "Scimitar",
    cls: "curved",
    kind: "weapon",
    tip: 9.2,
    hands: "one",
    moves: [m("flat", 1, 0.111, 0.07, 0.2, 14, 1.9, 9, 7), m("flat", -1, 0.111, 0.07, 0.2, 14, 1.9, 9, 7), m("rise", 1, 0.102, 0.07, 0.2, 14, 2, 9, 7), m("fall", -1, 0.102, 0.07, 0.2, 14, 2, 9, 7), m("flat", 1, 0.136, 0.08, 0.3, 22, 2.4, 12, 14, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.09, 0.08, 0.18, 14, 2.4, 12, 10), m("pairedCross", -1, 0.09, 0.08, 0.18, 14, 2.4, 12, 10), m("pairedFlat", 1, 0.12, 0.09, 0.28, 18, 2.6, 14, 14)],
    guard: { negate: 0.5, stability: 20, parry: 0, speed: 0.65 }
  },
  katana: {
    name: "Katana",
    cls: "katana",
    kind: "weapon",
    tip: 9.8,
    hands: "two",
    carry: "chudan",
    moves: [m("flat", 1, 0.111, 0.07, 0.238, 13, 2, 11, 9), m("flat", -1, 0.119, 0.07, 0.238, 13, 2, 11, 9), m("flat", 1, 0.111, 0.07, 0.238, 13, 2, 11, 9), m("flat", -1, 0.111, 0.07, 0.238, 13, 2, 11, 9), m("fall", -1, 0.145, 0.08, 0.338, 20, 2.1, 14, 18, { heavy: true })],
    two: [m("fall", 1, 0.119, 0.08, 0.238, 15, 2, 12, 11), m("rise", -1, 0.128, 0.08, 0.238, 15, 2, 12, 11), m("fall", 1, 0.111, 0.08, 0.238, 15, 2, 12, 11), m("rise", -1, 0.111, 0.08, 0.238, 15, 2, 12, 11), m("overhead", 0, 0.145, 0.09, 0.338, 23, 0.5, 15, 22, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.12, 0.08, 0.24, 14, 2.3, 15, 15), m("pairedCross", -1, 0.12, 0.08, 0.26, 14, 2.2, 15, 16)],
    guard: { negate: 0.55, stability: 25, parry: 0, speed: 0.6 }
  },
  club: {
    name: "Club",
    cls: "hammer",
    kind: "weapon",
    tip: 6.85,
    hands: "one",
    moves: [m("fall", -1, 0.111, 0.08, 0.238, 26, 1.6, 12, 15), m("flat", 1, 0.111, 0.08, 0.238, 26, 1.7, 12, 15), m("fall", -1, 0.111, 0.08, 0.238, 26, 1.6, 12, 15), m("flat", 1, 0.111, 0.08, 0.238, 26, 1.7, 12, 15), m("overhead", 0, 0.153, 0.09, 0.338, 41, 0.5, 15, 30, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.15, 0.09, 0.3, 33, 1.9, 18, 24)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 }
  },
  greatclub: {
    name: "Great Club",
    cls: "greathammer",
    kind: "weapon",
    tip: 14.1,
    foot: 2.25,
    hands: "two",
    carry: "shoulder",
    moves: [m("overhead", 0, 0.153, 0.12, 0.513, 9, 0.55, 30, 50, { armor: 1 }), m("overhead", 0, 0.221, 0.13, 0.513, 10, 0.55, 32, 50, { armor: 1 }), m("overhead", 0, 0.238, 0.14, 0.6, 12, 0.55, 34, 100, { armor: 1, heavy: true, ground: true })],
    two: [m("flat", 1, 0.153, 0.12, 0.513, 10, 2.8, 32, 56, { armor: 1 }), m("flat", -1, 0.213, 0.13, 0.513, 11, 2.8, 34, 56, { armor: 1 }), m("flat", 1, 0.23, 0.14, 0.6, 14, 2.8, 36, 112, { armor: 1, heavy: true })],
    paired: [m("pairedFlat", 1, 0.4, 0.15, 0.6, 9, 2.8, 38, 64, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 }
  },
  scepter: {
    name: "Scepter",
    cls: "hammer",
    kind: "weapon",
    tip: 8.7,
    hands: "one",
    moves: [m("fall", -1, 0.119, 0.08, 0.238, 15, 1.7, 12, 14), m("flat", 1, 0.119, 0.08, 0.238, 15, 1.8, 12, 14), m("fall", -1, 0.119, 0.08, 0.238, 15, 1.7, 12, 14), m("flat", 1, 0.119, 0.08, 0.238, 15, 1.8, 12, 14), m("thrust", 0, 0.162, 0.09, 0.338, 23, 0.3, 15, 28, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.15, 0.09, 0.3, 19, 2, 18, 22)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 }
  },
  axe: {
    name: "Axe",
    cls: "axe",
    kind: "weapon",
    tip: 6.9,
    hands: "one",
    moves: [m("fall", -1, 0.111, 0.08, 0.225, 25, 1.8, 12, 13), m("fall", 1, 0.111, 0.08, 0.225, 25, 1.8, 12, 13), m("fall", -1, 0.128, 0.08, 0.225, 28, 1.8, 12, 13), m("rise", 1, 0.119, 0.08, 0.225, 28, 1.8, 12, 13), m("overhead", 0, 0.153, 0.09, 0.325, 40, 0.5, 15, 26, { heavy: true })],
    paired: [m("pairedCross", -1, 0.15, 0.09, 0.3, 31, 2, 18, 20)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 }
  },
  greataxe: {
    name: "Greataxe",
    cls: "greataxe",
    kind: "weapon",
    tip: 13.4,
    foot: 2.65,
    hands: "two",
    carry: "shoulder",
    moves: [m("overhead", 0, 0.119, 0.11, 0.4, 7, 0.5, 24, 36), m("overhead", 0, 0.145, 0.11, 0.4, 7, 0.5, 24, 36), m("overhead", 0, 0.153, 0.11, 0.4, 7, 0.5, 24, 36), m("overhead", 0, 0.17, 0.12, 0.5, 10, 0.5, 28, 72, { heavy: true, ground: true })],
    two: [m("overhead", 0, 0.119, 0.11, 0.4, 9, 0.5, 26, 42, { armor: 1 }), m("fall", -1, 0.145, 0.11, 0.4, 9, 2.4, 26, 42, { armor: 1 }), m("overhead", 0, 0.145, 0.11, 0.4, 9, 0.5, 26, 42, { armor: 1 }), m("overhead", 0, 0.162, 0.12, 0.5, 13, 0.5, 30, 84, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedCross", -1, 0.34, 0.14, 0.56, 9, 2.6, 36, 56, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 }
  },
  hammer: {
    name: "Hammer",
    cls: "hammer",
    kind: "weapon",
    tip: 7.9,
    hands: "one",
    moves: [m("fall", -1, 0.119, 0.08, 0.238, 16, 1.7, 13, 17), m("flat", 1, 0.119, 0.08, 0.238, 16, 1.7, 13, 17), m("overhead", 0, 0.119, 0.08, 0.238, 16, 0.5, 13, 17), m("flat", -1, 0.119, 0.08, 0.238, 16, 1.7, 13, 17), m("overhead", 0, 0.162, 0.09, 0.338, 25, 0.5, 16, 34, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.16, 0.09, 0.32, 22, 1.9, 19, 26)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 }
  },
  greathammer: {
    name: "Great Hammer",
    cls: "greathammer",
    kind: "weapon",
    tip: 15.3,
    foot: 2.65,
    hands: "two",
    carry: "shoulder",
    moves: [m("overhead", 0, 0.128, 0.11, 0.388, 6, 0.5, 26, 44), m("flat", 1, 0.136, 0.11, 0.388, 7, 2.6, 26, 44), m("flat", -1, 0.145, 0.11, 0.388, 7, 2.6, 26, 44), m("overhead", 0, 0.145, 0.12, 0.475, 9, 0.5, 30, 88, { heavy: true, ground: true })],
    two: [m("overhead", 0, 0.128, 0.11, 0.388, 7, 0.5, 28, 50, { armor: 1 }), m("flat", 1, 0.162, 0.11, 0.388, 8, 2.6, 28, 50, { armor: 1 }), m("flat", -1, 0.162, 0.11, 0.388, 8, 2.6, 28, 50, { armor: 1 }), m("overhead", 0, 0.196, 0.12, 0.475, 10, 0.5, 32, 100, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedFlat", 1, 0.42, 0.16, 0.62, 8, 2.8, 40, 70, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 }
  },
  staff: {
    name: "Staff",
    cls: "staff",
    kind: "weapon",
    tip: 13.5,
    hands: "two",
    carry: "staff",
    moves: [m("flat", 1, 0.145, 0.09, 0.238, 8, 2, 12, 10), m("flat", -1, 0.145, 0.09, 0.238, 8, 2, 12, 10), m("overhead", 0, 0.187, 0.1, 0.325, 12, 0.5, 14, 20, { heavy: true })],
    two: [m("flat", 1, 0.145, 0.09, 0.238, 8, 2, 12, 11), m("flat", -1, 0.145, 0.09, 0.238, 8, 2, 12, 11), m("overhead", 0, 0.187, 0.1, 0.325, 13, 0.5, 14, 22, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.18, 0.1, 0.34, 10, 2.2, 15, 14)],
    guard: { negate: 0.5, stability: 20, parry: 0, speed: 0.6 }
  },
  buckler: {
    name: "Small Shield",
    cls: "smallshield",
    kind: "shield",
    tip: 2,
    hands: "one",
    moves: [m("bash", 0, 0.119, 0.07, 0.188, 7, 0.4, 9, 9), m("bash", 0, 0.093, 0.07, 0.188, 7, 0.4, 9, 9)],
    guard: { negate: 0.82, stability: 45, parry: 0.2, speed: 0.75 }
  },
  heater: {
    name: "Medium Shield",
    cls: "shield",
    kind: "shield",
    tip: 2.9,
    hands: "one",
    moves: [m("bash", 0, 0.119, 0.08, 0.2, 8, 0.4, 11, 11), m("bash", 0, 0.102, 0.08, 0.2, 8, 0.4, 11, 11)],
    guard: { negate: 1, stability: 56, parry: 0, speed: 0.6 }
  },
  greatshield: {
    name: "Greatshield",
    cls: "greatshield",
    kind: "shield",
    tip: 6.7,
    hands: "one",
    moves: [m("bash", 0, 0.17, 0.1, 0.263, 12, 0.5, 15, 20), m("bash", 0, 0.17, 0.1, 0.263, 12, 0.5, 15, 20)],
    guard: { negate: 1, stability: 75, parry: 0, speed: 0.42, counter: true }
  }
};
var WEAPON_IDS = Object.keys(WEAPONS);
var ENABLED_WEAPONS = new Set(["sword", "greatsword", "colossal", "club", "greatclub"]);
var armable = (id) => !!WEAPONS[id] && (WEAPONS[id].kind === "shield" || ENABLED_WEAPONS.has(id));
var DEFAULT_ARMS = Object.freeze({ main: "sword", off: null });
for (const w of Object.values(WEAPONS)) {
  for (const [grip, list] of [["one", w.moves], ["two", w.two], ["off", w.paired]])
    for (const mv of list || [])
      if (mv.range == null)
        mv.range = +(reachOf(grip, mv.pose) + tipIn(w, grip)).toFixed(2);
}
function settleArms({ main = "sword", off = null } = {}) {
  const M = WEAPONS[main]?.kind === "weapon" && (globalThis.__allWeapons || armable(main)) ? WEAPONS[main] : WEAPONS.sword;
  const O = off && (globalThis.__allWeapons || armable(off)) ? WEAPONS[off] || null : null;
  const twoHanded = !O && M.hands === "two" && !!M.two;
  const paired = !!O && O.kind === "weapon" && O.cls === M.cls && !!M.paired;
  const offAct = O ? O.kind === "shield" ? "guard" : paired ? "paired" : "attack" : "jump";
  const arms = { main: M === WEAPONS[main] ? main : "sword", off: O ? off : null, twoHanded, paired, offAct, guard: O?.kind === "shield" ? O.guard : M.guard };
  arms.mainList = twoHanded ? M.two : M.moves;
  const pairedList = O && O !== M ? M.paired.map((mv) => ({ ...mv, altRange: +(reachOf("off", mv.pose) + tipIn(O, "off")).toFixed(2) })) : M.paired;
  arms.offList = offAct === "paired" ? pairedList : offAct === "attack" ? O.moves.map((mv) => ({ ...mv, sweep: -mv.sweep || 0, dmg: Math.round(mv.dmg * 0.9), range: +(reachOf("off", mv.pose) + tipIn(O, "off")).toFixed(2), off: true })) : null;
  return arms;
}

// site/js/sim/events.js
var EV = Object.freeze({
  bell: "bell",
  bellAnswer: "bellAnswer",
  blink: "blink",
  blocked: "blocked",
  bossDeath: "bossDeath",
  bossLand: "bossLand",
  bubblePop: "bubblePop",
  burst: "burst",
  chest: "chest",
  chestLand: "chestLand",
  chestOpen: "chestOpen",
  lame: "lame",
  clang: "clang",
  death: "death",
  drink: "drink",
  entrance: "entrance",
  entranceLeap: "entranceLeap",
  fire: "fire",
  flyDive: "flyDive",
  flyHover: "flyHover",
  graze: "graze",
  guardBreak: "guardBreak",
  guardUp: "guardUp",
  heal: "heal",
  hit: "hit",
  hurt: "hurt",
  jump: "jump",
  jumpLand: "jumpLand",
  move: "move",
  parry: "parry",
  phase: "phase",
  pop: "pop",
  riposte: "riposte",
  roll: "roll",
  seal: "seal",
  sfx: "sfx",
  shieldUp: "shieldUp",
  shielded: "shielded",
  shockHit: "shockHit",
  slot: "slot",
  spawn: "spawn",
  stagger: "stagger",
  swing: "swing",
  telegraph: "telegraph",
  vault: "vault",
  wake: "wake",
  ward: "ward"
});

// site/js/sim/player.js
var CIRCLE2 = arenaShape(null);
var STATE = { IDLE: 0, MOVE: 1, ROLL: 2, ATTACK: 3, HURT: 4, DEAD: 5, LOCKED: 6, GUARD: 7, JUMP: 8 };
var COUNTER = Object.freeze({ window: 0.6, dmg: 1.35 });
function makePlayer(mods = {}) {
  return {
    x: 0,
    y: 72,
    vx: 0,
    vy: 0,
    face: -Math.PI / 2,
    aim: -Math.PI / 2,
    state: STATE.IDLE,
    t: 0,
    hp: PLAYER.hp + (mods.hp || 0),
    hpMax: PLAYER.hp + (mods.hp || 0),
    stamina: PLAYER.stamina,
    staminaMax: PLAYER.stamina,
    staminaWait: 0,
    exhausted: false,
    iFrames: 0,
    step: 0,
    chain: 0,
    hitThisSwing: null,
    chainArmed: false,
    buffer: null,
    bufferT: 0,
    anim: 0,
    rollDir: 0,
    dead: false,
    mods: { dmg: 1, speed: 1, rollCost: 1, iFrames: 0, lifesteal: 0, ...mods },
    slots: [null, null],
    cooldowns: [0, 0],
    charges: [0, 0],
    flash: 0,
    shield: 0,
    hitLag: 0,
    arms: settleArms(DEFAULT_ARMS),
    moveset: PLAYER.combo,
    hand: "main",
    counterT: 0,
    counter: false
  };
}
function setArms(p, loadout) {
  p.arms = settleArms(loadout || DEFAULT_ARMS);
  p.moveset = p.arms.mainList;
  p.hand = "main";
  p.step = 0;
  p.chain = 0;
  return p.arms;
}
var moveOf = (p) => p.riposte > 0 && p.riposteMove || (p.moveset || PLAYER.combo)[Math.min(p.step || 0, (p.moveset || PLAYER.combo).length - 1)];
var RIPOSTE = Object.freeze({ wind: 0.17, recover: 0.12 });
var rollTotal = PLAYER.roll.time + PLAYER.roll.recover;
function actionable(p) {
  if (p.state === STATE.DEAD || p.state === STATE.LOCKED)
    return false;
  if (p.state === STATE.HURT)
    return reached(p.t, p.hurtFor || PLAYER.hurtTime);
  if (p.state === STATE.ROLL)
    return reached(p.t, rollTotal);
  if (p.state === STATE.JUMP)
    return reached(p.t, PLAYER.jump.time + PLAYER.jump.recover);
  if (p.state === STATE.ATTACK)
    return reached(p.t, swingLen(p));
  return true;
}
function rollCancelable(p) {
  if (p.state !== STATE.ATTACK)
    return false;
  const s = moveOf(p);
  return reached(p.t, s.wind + s.active * 0.5);
}
var swingLen = (p) => {
  const s = moveOf(p);
  return s.wind + s.active + s.recover;
};
function spend(p, cost) {
  p.stamina = Math.max(0, p.stamina - cost);
  p.staminaWait = p.stamina <= 0.5 ? PLAYER.exhaustedDelay : PLAYER.staminaDelay;
  if (p.stamina <= 0.5)
    p.exhausted = true;
}
var canSpend = (p, cost) => !p.exhausted && p.stamina >= Math.min(cost, 1);
function startRoll(p, dirX, dirY) {
  const moving = Math.hypot(dirX, dirY) > 0.15;
  p.rollDir = moving ? Math.atan2(dirY, dirX) : p.face;
  p.face = p.rollDir;
  p.state = STATE.ROLL;
  p.t = 0;
  p.anim = 0;
  p.step = 0;
  p.chain = 0;
  spend(p, PLAYER.roll.cost * p.mods.rollCost);
}
function startSwing(p, aim, hand = "main") {
  const moves = hand === "off" ? p.arms.offList || p.arms.mainList : p.arms.mainList;
  const same = p.hand === hand && p.moveset === moves;
  p.counter = hand === "main" && p.counterT > 0;
  if (p.riposteReady || p.riposte) {
    p.riposte = hand === "main" ? p.riposteReady || 0 : 0;
    if (p.riposte) {
      p.counter = false;
      const last = moves[moves.length - 1];
      p.riposteMove = { ...last, wind: last.wind + RIPOSTE.wind, recover: last.recover + RIPOSTE.recover };
    }
  }
  const next = p.counter || p.riposte ? moves.length - 1 : same && p.chain > 0 ? (p.step + 1) % moves.length : 0;
  p.moveset = moves;
  p.hand = hand;
  p.counterT = 0;
  p.step = next;
  p.state = STATE.ATTACK;
  p.t = 0;
  p.anim = 0;
  p.face = aim;
  p.hitThisSwing = new Set;
  p.chain = 0;
  p.chainArmed = false;
  spend(p, moves[next].cost);
  return next;
}
function startGuard(p, aim) {
  p.state = STATE.GUARD;
  p.t = 0;
  p.anim = 0;
  p.face = aim;
  p.step = 0;
  p.chain = 0;
}
function stepPlayer(p, intent, dt, world, out) {
  p.t += dt;
  p.anim += dt;
  if (p.iFrames > 0)
    p.iFrames -= dt;
  if (p.flash > 0)
    p.flash -= dt;
  if (p.chain > 0)
    p.chain -= dt;
  if (p.counterT > 0)
    p.counterT -= dt;
  for (let i = 0;i < 2; i++)
    if (p.cooldowns[i] > 0)
      p.cooldowns[i] = Math.max(0, p.cooldowns[i] - dt);
  if (p.staminaWait > 0)
    p.staminaWait -= dt;
  else if (p.stamina < p.staminaMax) {
    p.stamina = Math.min(p.staminaMax, p.stamina + PLAYER.staminaRegen * (p.mods.staminaScale || 1) * (p.state === STATE.GUARD ? 0.4 : 1) * dt);
    if (p.exhausted && p.stamina > p.staminaMax * 0.25)
      p.exhausted = false;
  }
  if (p.state === STATE.DEAD) {
    p.vx *= 0.86;
    p.vy *= 0.86;
    move(p, dt, world);
    return;
  }
  const steered = Math.hypot(intent.mx, intent.my) > 0.08 ? Math.atan2(intent.my, intent.mx) : null;
  if (p.state !== STATE.ROLL)
    p.aim = intent.aim != null ? intent.aim : steered ?? p.face;
  if (intent.roll)
    p.buffer = "roll", p.bufferT = PLAYER.bufferTime;
  else if (intent.attack)
    p.buffer = "attack", p.bufferT = PLAYER.bufferTime;
  else if (intent.off && p.arms.offAct === "jump")
    p.buffer = "jump", p.bufferT = PLAYER.bufferTime;
  else if (intent.off && p.arms.offAct !== "guard")
    p.buffer = "off", p.bufferT = PLAYER.bufferTime;
  else if (intent.slot0)
    p.buffer = "slot0", p.bufferT = PLAYER.bufferTime;
  else if (intent.slot1)
    p.buffer = "slot1", p.bufferT = PLAYER.bufferTime;
  if (p.bufferT > 0)
    p.bufferT -= dt;
  else
    p.buffer = null;
  const want = p.buffer;
  const free = actionable(p) || p.state === STATE.GUARD;
  const wantGuard = p.arms.offAct === "guard" && !!(intent.offHeld || intent.off);
  if (want === "roll" && (free || rollCancelable(p)) && canSpend(p, PLAYER.roll.cost)) {
    p.buffer = null;
    startRoll(p, intent.mx, intent.my);
    out.push({ t: EV.roll, x: p.x, y: p.y, a: p.rollDir });
  } else if ((want === "attack" || want === "off") && free && canSpend(p, (want === "off" && p.arms.offList || p.arms.mainList)[0].cost)) {
    p.buffer = null;
    const step = startSwing(p, p.aim, want === "off" ? "off" : "main");
    out.push({ t: EV.swing, step, hand: p.hand, x: p.x, y: p.y, a: p.face, counter: p.counter });
  } else if (want === "jump" && free && canSpend(p, PLAYER.jump.cost)) {
    p.buffer = null;
    p.state = STATE.JUMP;
    p.t = 0;
    p.anim = 0;
    spend(p, PLAYER.jump.cost);
    out.push({ t: EV.jump, x: p.x, y: p.y, a: p.face });
  } else if (wantGuard && !want && actionable(p) && p.state !== STATE.GUARD) {
    startGuard(p, p.aim);
    out.push({ t: EV.guardUp, x: p.x, y: p.y });
  } else if ((want === "slot0" || want === "slot1") && free) {
    const i = want === "slot0" ? 0 : 1;
    if (world && world.useSlot(i)) {
      p.buffer = null;
      out.push({ t: EV.slot, i });
    }
  }
  const R = PLAYER.roll;
  if (p.state === STATE.ROLL) {
    if (p.t < R.time) {
      const k = R.curve(p.t / R.time) - R.curve(Math.max(0, p.t - dt) / R.time);
      const d = k * R.dist;
      p.vx = Math.cos(p.rollDir) * d / dt;
      p.vy = Math.sin(p.rollDir) * d / dt;
      const from = R.iFrom - p.mods.iFrames / 2;
      const to = R.iTo + p.mods.iFrames / 2;
      if (reached(p.t, from) && !reached(p.t, to))
        p.iFrames = Math.max(p.iFrames, 0.02);
    } else {
      p.vx *= 0.8;
      p.vy *= 0.8;
    }
    if (reached(p.t, rollTotal))
      toGround(p, intent);
  } else if (p.state === STATE.JUMP) {
    const J = PLAYER.jump;
    if (!reached(p.t, J.time))
      steer(p, intent, dt, J.steer);
    else
      p.vx *= 0.7, p.vy *= 0.7;
    if (Math.hypot(intent.mx, intent.my) > 0.08 && !reached(p.t, J.time))
      p.face = Math.atan2(p.vy, p.vx);
    if (!reached(p.t - dt, J.time) && reached(p.t, J.time))
      out.push({ t: EV.jumpLand, x: p.x, y: p.y });
    if (reached(p.t, J.time + J.recover))
      toGround(p, intent);
  } else if (p.state === STATE.GUARD) {
    steer(p, intent, dt, p.arms.guard.speed);
    p.face = p.aim;
    if (!wantGuard)
      toGround(p, intent);
  } else if (p.state === STATE.ATTACK) {
    const s = moveOf(p);
    steer(p, intent, dt, !reached(p.t, s.wind + s.active) ? PLAYER.swingMove : 1);
    if (!p.chainArmed && reached(p.t, s.wind + s.active)) {
      p.chainArmed = true;
      p.chain = s.recover + PLAYER.comboWindow;
    }
    if (reached(p.t, swingLen(p)))
      toGround(p, intent);
  } else if (p.state === STATE.LOCKED) {
    p.vx = 0;
    p.vy = 0;
    if (p.lockFor && reached(p.t, p.lockFor))
      p.lockFor = 0, toGround(p, intent);
  } else if (p.state === STATE.HURT) {
    const k = p.tossed ? 1 : p.hurtFor ? 0.93 : 0.9;
    p.vx *= k;
    p.vy *= k;
    if (reached(p.t, p.hurtFor || PLAYER.hurtTime))
      p.hurtFor = 0, p.tossed = 0, toGround(p, intent);
  } else {
    const m = Math.hypot(intent.mx, intent.my);
    steer(p, intent, dt, 1);
    if (m > 0.08) {
      p.state = STATE.MOVE;
      if (intent.aim == null || intent.aimAuto)
        p.face = Math.atan2(intent.my, intent.mx);
      else
        p.face = p.aim;
    } else {
      p.state = STATE.IDLE;
      if (intent.aim != null && !intent.aimAuto)
        p.face = p.aim;
    }
  }
  move(p, dt, world);
}
function steer(p, intent, dt, mul) {
  const m = Math.hypot(intent.mx, intent.my);
  if (m > 0.08) {
    const push = m > 0.98 ? 1 : m;
    const sp = PLAYER.speed * p.mods.speed * (p.exhausted ? 0.82 : 1) * push * mul;
    const nx = intent.mx / Math.max(1, m);
    const ny = intent.my / Math.max(1, m);
    const w = p.wishBuf ||= { x: 0, y: 0, m: 0, sp: 0 };
    w.x = nx, w.y = ny, w.m = Math.hypot(nx, ny), w.sp = sp;
    p.wish = w;
    p.vx += nx * PLAYER.accel * dt;
    p.vy += ny * PLAYER.accel * dt;
    const v = Math.hypot(p.vx, p.vy);
    if (v > sp) {
      p.vx = p.vx / v * sp;
      p.vy = p.vy / v * sp;
    }
  } else {
    p.wish = null;
    const v = Math.hypot(p.vx, p.vy);
    const drop = PLAYER.friction * dt;
    if (v <= drop)
      p.vx = 0, p.vy = 0;
    else {
      p.vx -= p.vx / v * drop;
      p.vy -= p.vy / v * drop;
    }
  }
}
function toGround(p, intent) {
  p.state = Math.hypot(intent.mx, intent.my) > 0.08 ? STATE.MOVE : STATE.IDLE;
  p.t = 0;
  p.anim = 0;
}
function move(p, dt, world) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const arena = world?.arena ?? CIRCLE2;
  const n = arena.keep(p, PLAYER.radius + 2);
  if (n) {
    const [nx, ny] = n;
    const into = p.vx * nx + p.vy * ny;
    if (into > 0) {
      p.vx -= nx * into;
      p.vy -= ny * into;
      const w = p.state === STATE.MOVE ? p.wish : null;
      if (arena.glide && w && w.m > 0) {
        const [nx, ny] = arena.wideNormal ? arena.wideNormal(p.x, p.y) : n;
        const wn = w.x * nx + w.y * ny;
        let tx = w.x - wn * nx, ty = w.y - wn * ny;
        const tl = Math.hypot(tx, ty);
        if (tl > 0.000001) {
          tx /= tl;
          ty /= tl;
          const want = w.sp * Math.min(1, tl / w.m / 0.5);
          const cur = p.vx * tx + p.vy * ty;
          if (want > cur) {
            p.x += tx * (want - Math.max(0, cur)) * dt;
            p.y += ty * (want - Math.max(0, cur)) * dt;
            arena.keep(p, PLAYER.radius + 2);
            p.vx = tx * want;
            p.vy = ty * want;
          }
        }
      }
    }
  }
}
function swingArc(p) {
  if (p.state !== STATE.ATTACK)
    return null;
  const s = moveOf(p);
  if (!reached(p.t, s.wind) || p.t > s.wind + s.active + TICK_EPS)
    return null;
  const k = Math.min(1, Math.max(0, (p.t - s.wind) / s.active));
  const k0 = Math.max(0, (p.t - TICK - s.wind) / s.active);
  const k1 = p.t + TICK > s.wind + s.active ? 1 : k;
  if (s.shape === "thrust") {
    return arcOf(p, s, k, p.face, p.face, p.face, s.range * (0.72 + 0.28 * k1));
  }
  const dir = sweepDir(s);
  const from = p.face - dir * s.arc / 2;
  const at = (u) => from + dir * s.arc * u;
  const arc = arcOf(p, s, k, at(k), at(k0), at(k1), s.range);
  if (/^paired/.test(s.pose || "")) {
    const from2 = p.face + dir * s.arc / 2;
    const at2 = (u) => from2 - dir * s.arc * u;
    arc.alt = arcOf(p, s, k, at2(k), at2(k0), at2(k1), s.altRange ?? s.range);
  }
  return arc;
}
var arcOf = (p, s, k, a, a0, a1, r) => ({
  x: p.x,
  y: p.y,
  half: s.arc * 0.34,
  dmg: s.dmg * p.mods.dmg * (p.counter ? COUNTER.dmg : 1),
  poise: s.poise * (p.counter ? COUNTER.dmg : 1),
  step: p.step,
  k,
  move: s,
  hand: p.hand,
  heavy: s.fx === "heavy" || p.counter || p.riposte > 0,
  riposte: p.riposte || 0,
  a,
  a0,
  a1,
  r
});
var BLADE = { from: 2, width: 0.6, stepA: 0.05, stepR: 0.75 };
function bladeHits(arc, x, y, along, across = along, face = 0) {
  const da = arc.a1 - arc.a0;
  const na = Math.max(1, Math.ceil(Math.abs(da) / BLADE.stepA));
  const nr = Math.max(1, Math.ceil((arc.r - BLADE.from) / BLADE.stepR));
  const c = Math.cos(face), s = Math.sin(face);
  const fa = along + BLADE.width, fc = across + BLADE.width;
  for (let i = 0;i <= na; i++) {
    const a = arc.a0 + da * i / na;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0;j <= nr; j++) {
      const r = BLADE.from + (arc.r - BLADE.from) * j / nr;
      const px = arc.x + ca * r, py = arc.y + sa * r;
      const dx = px - x, dy = py - y;
      const u = (dx * c + dy * s) / fa, v = (-dx * s + dy * c) / fc;
      if (u * u + v * v <= 1)
        return { x: px, y: py };
    }
  }
  return null;
}
function staggerPlayer(p, fromX, fromY, speed, time) {
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
  p.state = STATE.HURT;
  p.t = 0;
  p.anim = 0;
  p.hurtFor = time;
  p.tossed = 0;
  p.buffer = null;
  p.chain = 0;
}
function hurtPlayer(p, dmg, fromX, fromY, out) {
  if (p.iFrames > 0 || p.state === STATE.DEAD)
    return false;
  const mv = p.state === STATE.ATTACK ? moveOf(p) : null;
  if (mv?.armor && !reached(p.t, mv.wind + mv.active) && p.hp - dmg > 0) {
    p.hp -= dmg;
    p.iFrames = 0.3;
    p.flash = 0.18;
    out.push({ t: EV.hurt, x: p.x, y: p.y, dmg, armor: true, a: Math.atan2(p.y - fromY, p.x - fromX) });
    return true;
  }
  p.hp -= dmg;
  p.iFrames = PLAYER.hurtIFrames;
  p.flash = 0.18;
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  p.vx = Math.cos(a) * PLAYER.knockback;
  p.vy = Math.sin(a) * PLAYER.knockback;
  p.hurtFor = 0;
  p.tossed = 0;
  p.buffer = null;
  p.chain = 0;
  if (p.lockFor)
    p.lockFor = 0;
  if (p.hp <= 0) {
    p.hp = 0;
    p.state = STATE.DEAD;
    p.dead = true;
    p.t = 0;
    out.push({ t: EV.death, x: p.x, y: p.y });
  } else {
    p.state = STATE.HURT;
    p.t = 0;
    p.anim = 0;
    out.push({ t: EV.hurt, x: p.x, y: p.y, dmg, a: Math.atan2(p.y - fromY, p.x - fromX) });
  }
  return true;
}
var armCounter = (p) => p.counterT = COUNTER.window;
var jumpLift = (p) => p.state === STATE.JUMP && p.t < PLAYER.jump.time ? 4 * (p.t / PLAYER.jump.time) * (1 - p.t / PLAYER.jump.time) : 0;
var inAir = (p) => p.state === STATE.JUMP && reached(p.t, PLAYER.jump.air[0]) && !reached(p.t, PLAYER.jump.air[1]);

// site/js/content/places.js
var PLACES = {
  bog: { backdrop: true, ambient: "amb_bog", step: "meadow", swarm: "fly" },
  ash: { backdrop: true, ambient: "amb_ash", step: "meadow", swarm: "ember" },
  hall: { backdrop: true, ambient: null, step: "hall", swarm: "hand", mechanics: ["hallAnswer"] },
  salt: {
    backdrop: true,
    ambient: "amb_salt",
    step: "ash",
    swarm: null,
    shadows: { rotation: 38, length: 1.2, opacity: 0.55, softness: 3, reach: 28.8, tint: [0.46, 0.43, 0.45] },
    reflect: { strength: 0.95, fade: 144, reach: 0, blurGrow: 0.02, smear: 2.5, tint: [1, 0.88, 0.86], blur: 1.5, ripple: 0.0012, tol: 2.5 },
    ink: { color: 11440274, warm: 15519932, width: 0.3 },
    trail: { edge: [0.5, 0.74, 1], body: [0.3, 0.46, 0.72], alpha: 1.45, ghost: 5660794 }
  }
};
function tryArena(spec, search = globalThis.location?.search || "") {
  const a = new URLSearchParams(search).get("arena");
  if (spec && a && PLACES[a]?.backdrop)
    spec.arena = a;
  return spec;
}
var GARDEN = { backdrop: false, ambient: "amb_meadow", step: "meadow", swarm: "fly" };
var placeOf = (id) => PLACES[id] || GARDEN;
var BACKDROP_ARENAS = new Set(Object.keys(PLACES).filter((id) => PLACES[id].backdrop));

// site/js/audio.js
var ac = null;
var master = null;
var lowpass = null;
var musicGain = null;
var enabled = true;
var musicStop = null;
function ensure2() {
  if (ac)
    return ac;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C)
    return null;
  ac = new C;
  master = ac.createGain();
  master.gain.value = 0.55;
  lowpass = ac.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 20000;
  master.connect(lowpass).connect(ac.destination);
  musicGain = ac.createGain();
  musicGain.gain.value = 0.3;
  musicGain.connect(master);
  return ac;
}
function unlock() {
  const c = ensure2();
  if (c && c.state !== "running" && c.state !== "closed")
    c.resume();
  loadSamples();
}
function sleepAudio() {
  if (ac && ac.state === "running")
    ac.suspend();
}
function wakeAudio() {
  if (ac && ac.state !== "running" && ac.state !== "closed")
    ac.resume();
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", () => document.hidden ? sleepAudio() : wakeAudio());
  window.addEventListener("pagehide", sleepAudio);
  window.addEventListener("pageshow", () => !document.hidden && wakeAudio());
  const onGesture = () => !document.hidden && wakeAudio();
  for (const ev of ["pointerdown", "pointerup", "touchend", "keydown"])
    window.addEventListener(ev, onGesture, { capture: true, passive: true });
}
function setEnabled(v) {
  enabled = v;
  if (master)
    master.gain.value = v ? 0.55 : 0;
}
function setMusic(v) {
  if (musicGain)
    musicGain.gain.value = v ? 0.3 : 0;
}
var now = () => ac ? ac.currentTime : 0;
function tone2({ type = "sine", f = 440, f2 = null, t = 0.12, a = 0.004, g = 0.3, delay = 0, curve = "exp", to = null }) {
  const c = ensure2();
  if (!c || !enabled)
    return;
  const o = c.createOscillator();
  const gn = c.createGain();
  o.type = type;
  const t0 = now() + delay;
  o.frequency.setValueAtTime(f, t0);
  if (f2)
    (curve === "exp" ? o.frequency.exponentialRampToValueAtTime : o.frequency.linearRampToValueAtTime).call(o.frequency, Math.max(1, f2), t0 + t);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(g, t0 + a);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(gn).connect(to || master);
  o.start(t0);
  o.stop(t0 + t + 0.02);
}
var NOISE_LEN = 2;
var noiseBuf = null;
function noise({ t = 0.14, g = 0.3, type = "lowpass", f = 1200, f2 = null, q = 1, delay = 0 }) {
  const c = ensure2();
  if (!c || !enabled)
    return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * NOISE_LEN), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0;i < d.length; i++)
      d[i] = Math.random() * 2 - 1;
  }
  t = Math.min(t, NOISE_LEN);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const flt = c.createBiquadFilter();
  flt.type = type;
  const t0 = now() + delay;
  flt.frequency.setValueAtTime(f, t0);
  if (f2)
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + t);
  flt.Q.value = q;
  const gn = c.createGain();
  gn.gain.setValueAtTime(g, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(flt).connect(gn).connect(master);
  src.start(t0, Math.random() * (NOISE_LEN - t));
  src.stop(t0 + t);
}
var STEPS = {
  hall: (v) => {
    noise({ t: 0.12, g: 0.07, type: "bandpass", f: 2200 * v, f2: 900, q: 1.4 });
    noise({ t: 0.06, g: 0.04, type: "highpass", f: 4200 * v });
  },
  meadow: (v) => {
    noise({ t: 0.09, g: 0.05, type: "bandpass", f: 3600 * v, f2: 2200, q: 0.8 });
    tone2({ type: "sine", f: 105 * v, f2: 65, t: 0.05, g: 0.035 });
  },
  ash: (v) => {
    noise({ t: 0.07, g: 0.08, type: "highpass", f: 2600 * v, f2: 1400 });
    tone2({ type: "sine", f: 95 * v, f2: 60, t: 0.06, g: 0.05 });
  },
  mud: (v) => {
    noise({ t: 0.1, g: 0.08, type: "lowpass", f: 700 * v, f2: 240 });
    tone2({ type: "sine", f: 120 * v, f2: 70, t: 0.07, g: 0.05 });
  }
};
STEPS["meadow-night"] = STEPS.meadow;
var S = {
  swing: () => (noise({ t: 0.09, g: 0.16, type: "bandpass", f: 2600, f2: 900, q: 1.2 }), tone2({ type: "triangle", f: 620, f2: 260, t: 0.08, g: 0.06 })),
  hit: () => {
    noise({ t: 0.08, g: 0.3, type: "highpass", f: 1400, f2: 500 });
    tone2({ type: "square", f: 180, f2: 70, t: 0.09, g: 0.16 });
  },
  hitHeavy: () => {
    noise({ t: 0.16, g: 0.4, type: "lowpass", f: 2400, f2: 260 });
    tone2({ type: "sawtooth", f: 140, f2: 46, t: 0.2, g: 0.22 });
  },
  clang: () => {
    tone2({ type: "square", f: 1180, f2: 740, t: 0.22, g: 0.12 });
    tone2({ type: "square", f: 1770, f2: 1200, t: 0.16, g: 0.06, delay: 0.01 });
  },
  roll: () => noise({ t: 0.22, g: 0.14, type: "lowpass", f: 900, f2: 200 }),
  step: (ground = "bog") => {
    const v = 0.85 + Math.random() * 0.3;
    (STEPS[ground] || STEPS.mud)(v);
  },
  rollLand: () => {
    noise({ t: 0.16, g: 0.16, type: "lowpass", f: 900, f2: 160 });
    tone2({ type: "sine", f: 130, f2: 55, t: 0.14, g: 0.12 });
  },
  whoosh: () => {
    const v = 0.9 + Math.random() * 0.2;
    noise({ t: 0.13, g: 0.16, type: "bandpass", f: 3000 * v, f2: 700, q: 1.3 });
    tone2({ type: "triangle", f: 640 * v, f2: 240, t: 0.1, g: 0.05 });
  },
  whooshHeavy: () => {
    noise({ t: 0.22, g: 0.22, type: "bandpass", f: 1900, f2: 380, q: 1.1 });
    tone2({ type: "sawtooth", f: 260, f2: 90, t: 0.2, g: 0.07 });
  },
  slamGround: () => {
    noise({ t: 0.3, g: 0.3, type: "lowpass", f: 1500, f2: 110 });
    tone2({ type: "sine", f: 96, f2: 38, t: 0.34, g: 0.24 });
    noise({ t: 0.12, g: 0.1, type: "highpass", f: 2800, f2: 1600, delay: 0.02 });
  },
  hurt: () => {
    tone2({ type: "sawtooth", f: 300, f2: 90, t: 0.22, g: 0.2 });
    noise({ t: 0.16, g: 0.18, type: "lowpass", f: 900, f2: 200 });
  },
  death: () => {
    tone2({ type: "sawtooth", f: 220, f2: 40, t: 1.1, g: 0.24 });
    tone2({ type: "sine", f: 110, f2: 26, t: 1.4, g: 0.18, delay: 0.05 });
    noise({ t: 0.9, g: 0.12, type: "lowpass", f: 700, f2: 90 });
  },
  drink: () => tone2({ type: "sine", f: 300, f2: 760, t: 0.3, g: 0.16 }),
  heal: () => (tone2({ type: "sine", f: 520, f2: 880, t: 0.34, g: 0.12 }), tone2({ type: "sine", f: 780, f2: 1320, t: 0.3, g: 0.07, delay: 0.06 })),
  throw: () => noise({ t: 0.08, g: 0.18, type: "bandpass", f: 3200, f2: 1400, q: 2 }),
  cast: () => tone2({ type: "triangle", f: 220, f2: 900, t: 0.4, g: 0.12 }),
  roar: () => (tone2({ type: "sawtooth", f: 110, f2: 70, t: 0.6, g: 0.14 }), noise({ t: 0.5, g: 0.08, type: "lowpass", f: 600, f2: 200 })),
  blink: () => (tone2({ type: "sine", f: 1200, f2: 300, t: 0.18, g: 0.12 }), noise({ t: 0.12, g: 0.1, type: "highpass", f: 2000 })),
  frost: () => (tone2({ type: "sine", f: 1600, f2: 420, t: 0.5, g: 0.1 }), noise({ t: 0.4, g: 0.1, type: "highpass", f: 3000, f2: 900 })),
  shieldUp: () => (tone2({ type: "triangle", f: 400, f2: 700, t: 0.3, g: 0.12 }), tone2({ type: "sine", f: 900, t: 0.4, g: 0.05, delay: 0.05 })),
  buff: () => tone2({ type: "triangle", f: 340, f2: 620, t: 0.35, g: 0.12 }),
  horn: () => (tone2({ type: "sawtooth", f: 150, f2: 110, t: 0.8, g: 0.2 }), tone2({ type: "sawtooth", f: 226, f2: 166, t: 0.75, g: 0.1, delay: 0.02 })),
  use: () => tone2({ type: "triangle", f: 500, f2: 700, t: 0.12, g: 0.1 }),
  deny: () => tone2({ type: "square", f: 180, f2: 120, t: 0.12, g: 0.1 }),
  lash: () => (noise({ t: 0.18, g: 0.26, type: "bandpass", f: 1800, f2: 400, q: 1.5 }), tone2({ type: "sawtooth", f: 420, f2: 110, t: 0.18, g: 0.12 })),
  hop: () => tone2({ type: "sine", f: 160, f2: 420, t: 0.3, g: 0.14 }),
  slam: () => {
    noise({ t: 0.4, g: 0.45, type: "lowpass", f: 1400, f2: 90 });
    tone2({ type: "sine", f: 110, f2: 32, t: 0.5, g: 0.3 });
  },
  spit: () => noise({ t: 0.16, g: 0.2, type: "bandpass", f: 900, f2: 300, q: 1 }),
  swarm: () => tone2({ type: "sawtooth", f: 90, f2: 130, t: 0.7, g: 0.1 }),
  fire: () => noise({ t: 0.5, g: 0.2, type: "lowpass", f: 2600, f2: 400 }),
  nova: () => {
    noise({ t: 0.6, g: 0.3, type: "lowpass", f: 3000, f2: 200 });
    tone2({ type: "sawtooth", f: 240, f2: 60, t: 0.5, g: 0.16 });
  },
  veil: () => noise({ t: 0.9, g: 0.16, type: "bandpass", f: 700, f2: 1800, q: 0.7 }),
  storm: () => noise({ t: 1.2, g: 0.18, type: "bandpass", f: 1400, q: 0.6 }),
  wave: () => noise({ t: 0.8, g: 0.26, type: "lowpass", f: 1800, f2: 220 }),
  chain: () => {
    for (let i = 0;i < 5; i++)
      tone2({ type: "square", f: 900 + i * 60, f2: 700, t: 0.05, g: 0.05, delay: i * 0.035 });
  },
  hands: () => (noise({ t: 0.5, g: 0.2, type: "lowpass", f: 900, f2: 200 }), tone2({ type: "sawtooth", f: 80, f2: 160, t: 0.5, g: 0.12 })),
  flood: () => (noise({ t: 1.6, g: 0.3, type: "lowpass", f: 2400, f2: 180 }), tone2({ type: "sine", f: 70, f2: 40, t: 1.4, g: 0.2 })),
  stagger: () => (tone2({ type: "square", f: 300, f2: 120, t: 0.3, g: 0.16 }), noise({ t: 0.3, g: 0.2, type: "lowpass", f: 1800, f2: 300 })),
  riposte: () => (noise({ t: 0.5, g: 0.34, type: "lowpass", f: 2600, f2: 160 }), tone2({ type: "sine", f: 90, f2: 36, t: 0.5, g: 0.3 }), tone2({ type: "triangle", f: 1320, f2: 1250, t: 0.6, g: 0.05, delay: 0.03 })),
  flyBuzz: () => tone2({ type: "sawtooth", f: 160, f2: 420, t: 0.5, g: 0.05 }),
  flyDive: () => noise({ t: 0.25, g: 0.14, type: "bandpass", f: 1800, f2: 500, q: 1.2 }),
  windHold: () => tone2({ type: "sine", f: 70, f2: 150, t: 0.5, g: 0.12 }),
  phaseRoar: () => tone2({ type: "sawtooth", f: 110, f2: 70, t: 0.6, g: 0.14, delay: 0.5 }),
  clawSwipe: () => (noise({ t: 0.34, g: 0.22, type: "bandpass", f: 360, f2: 1300, q: 0.9 }), tone2({ type: "triangle", f: 1900, f2: 1500, t: 0.14, g: 0.03, delay: 0.05 })),
  ashClang: () => (noise({ t: 0.16, g: 0.16, type: "lowpass", f: 520, f2: 180 }), noise({ t: 0.3, g: 0.05, type: "highpass", f: 2800, f2: 4200 })),
  acidHiss: () => (noise({ t: 0.7, g: 0.07, type: "highpass", f: 3200, f2: 5200 }), noise({ t: 0.35, g: 0.05, type: "bandpass", f: 900, f2: 500, q: 1.2 })),
  windHop: () => (tone2({ type: "sine", f: 120, f2: 60, t: 0.25, g: 0.14 }), noise({ t: 0.2, g: 0.08, type: "lowpass", f: 700 })),
  windLash: () => noise({ t: 0.3, g: 0.08, type: "bandpass", f: 900, f2: 400, q: 1 }),
  cinderCast: () => (noise({ t: 1.1, g: 0.1, type: "bandpass", f: 500, f2: 2200, q: 0.8 }), tone2({ type: "sine", f: 120, f2: 240, t: 1, a: 0.6, g: 0.06 })),
  fireLanes: () => (noise({ t: 1, g: 0.3, type: "lowpass", f: 3200, f2: 300 }), tone2({ type: "sawtooth", f: 90, f2: 50, t: 0.6, g: 0.1 })),
  fireThrow: () => noise({ t: 0.35, g: 0.16, type: "bandpass", f: 900, f2: 3200, q: 1.1 }),
  fireImpact: () => (noise({ t: 0.6, g: 0.3, type: "lowpass", f: 2600, f2: 200 }), tone2({ type: "sine", f: 110, f2: 40, t: 0.35, g: 0.18 })),
  fireNova: () => (noise({ t: 0.9, g: 0.32, type: "lowpass", f: 3000, f2: 180 }), tone2({ type: "sawtooth", f: 200, f2: 50, t: 0.6, g: 0.14 })),
  ashVeil: () => noise({ t: 1.2, g: 0.16, type: "bandpass", f: 600, f2: 1600, q: 0.7 }),
  emberBoom: () => (noise({ t: 0.5, g: 0.28, type: "lowpass", f: 3200, f2: 300 }), tone2({ type: "square", f: 180, f2: 60, t: 0.2, g: 0.1 })),
  fireSweep: () => noise({ t: 0.9, g: 0.22, type: "bandpass", f: 700, f2: 2400, q: 0.8 }),
  fireBolt: () => noise({ t: 0.5, g: 0.18, type: "bandpass", f: 1400, f2: 500, q: 1 }),
  fireStorm: () => noise({ t: 2.6, g: 0.2, type: "bandpass", f: 900, f2: 1600, q: 0.5 }),
  fireIgnite: () => noise({ t: 0.6, g: 0.14, type: "lowpass", f: 1600, f2: 300 }),
  cinderHurt: () => noise({ t: 0.25, g: 0.12, type: "highpass", f: 2600, f2: 1200 }),
  cinderStagger: () => (noise({ t: 0.5, g: 0.18, type: "bandpass", f: 1200, f2: 400, q: 0.9 }), tone2({ type: "sine", f: 300, f2: 120, t: 0.4, g: 0.08 })),
  cinderPhase: () => (noise({ t: 1.2, g: 0.26, type: "lowpass", f: 2400, f2: 220 }), tone2({ type: "sawtooth", f: 80, f2: 160, t: 0.9, g: 0.12 })),
  cinderDeath: () => (noise({ t: 2.2, g: 0.2, type: "highpass", f: 3000, f2: 600 }), tone2({ type: "sine", f: 220, f2: 60, t: 1.6, g: 0.1 })),
  cinderRise: () => (noise({ t: 1.2, g: 0.22, type: "lowpass", f: 600, f2: 3000 }), tone2({ type: "sine", f: 90, f2: 180, t: 1, g: 0.1 })),
  bubblePop: () => (tone2({ type: "sine", f: 1400, f2: 2600, t: 0.12, g: 0.14 }), noise({ t: 0.3, g: 0.14, type: "highpass", f: 5000, f2: 2500 })),
  bubbleSeal: () => (tone2({ type: "sine", f: 520, f2: 1560, t: 1.2, a: 0.5, g: 0.07 }), noise({ t: 1.1, g: 0.06, type: "bandpass", f: 2400, f2: 5200, q: 0.8 })),
  bubbleWard: () => (tone2({ type: "sine", f: 1900, f2: 1500, t: 0.25, g: 0.1 }), tone2({ type: "sine", f: 640, f2: 560, t: 0.3, g: 0.08 })),
  charge: () => (noise({ t: 1.8, g: 0.22, type: "lowpass", f: 300, f2: 2400 }), tone2({ type: "sawtooth", f: 55, f2: 140, t: 1.8, a: 1, g: 0.1 })),
  fireWall: () => (noise({ t: 1.4, g: 0.36, type: "lowpass", f: 3400, f2: 220 }), tone2({ type: "sawtooth", f: 80, f2: 40, t: 1, g: 0.16 })),
  phase: () => {
    tone2({ type: "sawtooth", f: 120, f2: 300, t: 0.7, g: 0.18 });
    noise({ t: 0.6, g: 0.16, type: "lowpass", f: 1200 });
  },
  enrage: () => {
    for (let i = 0;i < 3; i++)
      tone2({ type: "sawtooth", f: 200 + i * 40, f2: 90, t: 0.5, g: 0.12, delay: i * 0.1 });
  },
  bell: () => {
    [1, 2.4, 3.2, 4.6].forEach((m, i) => tone2({ type: "sine", f: 262 * m, t: 2.6 - i * 0.3, g: 0.2 / (i + 1.4), a: 0.002 }));
    tone2({ type: "sine", f: 131, t: 3.2, g: 0.1 });
    noise({ t: 0.12, g: 0.12, type: "highpass", f: 4000 });
  },
  bellHum: () => {
    tone2({ type: "sine", f: 65, t: 1.1, a: 0.8, g: 0.12 });
    tone2({ type: "sine", f: 130, t: 1, a: 0.75, g: 0.045 });
    noise({ t: 0.9, g: 0.05, type: "lowpass", f: 260 });
  },
  bellBoom: () => {
    loadSamples();
    if (!playSample("bell_strike", 0.9, 0, 0.5))
      [1, 2.4, 3.2, 4.6].forEach((m, i) => tone2({ type: "sine", f: 98 * m, t: 4.2 - i * 0.6, g: 0.22 / (i + 1.4), a: 0.003 }));
    tone2({ type: "sine", f: 49, t: 4.5, a: 0.01, g: 0.17 });
    tone2({ type: "sine", f: 98, t: 3.2, a: 0.01, g: 0.06 });
    noise({ t: 0.25, g: 0.1, type: "lowpass", f: 700 });
  },
  geyserRumble: () => {
    noise({ t: 1, g: 0.14, type: "lowpass", f: 140, f2: 420 });
    tone2({ type: "sine", f: 46, f2: 70, t: 1, a: 0.6, g: 0.09 });
  },
  kingSlam: () => {
    loadSamples();
    if (!playSample("water_splash_big", 0.7, 0, 0.85))
      S.slam();
    S.slamGround();
  },
  kingHurt: () => {
    if (now() - lastCry < CRY_GAP)
      return;
    lastCry = now();
    loadSamples();
    playSample("sword_hit_heavy", 0.3, 0.04, 0.55);
  },
  kingStagger: () => {
    loadSamples();
    if (!playSample("sword_hit_heavy", 0.55, 0, 0.45))
      S.stagger();
    playSample("water_splash", 0.3);
  },
  kingPhase: () => {
    loadSamples();
    if (!playSample("bell_strike", 0.45, 0, 0.6))
      S.phase();
  },
  kingDeath: () => {
    loadSamples();
    if (!playSample("water_splash_big", 0.7, 0, 0.7))
      S.slam();
    if (!playSample("bell_strike", 0.6, 0.4, 0.5))
      S.death();
  },
  crabSlam: () => {
    loadSamples();
    if (!playSample(Math.random() < 0.5 ? "crab_thud_a" : "crab_thud_b", 0.85, 0, 0.8))
      S.slam();
    S.slamGround();
  },
  crabRumble: () => {
    loadSamples();
    playSample("crab_thud_b", 0.55, 0, 0.55);
    playSample("crab_thud_a", 0.45, 0.25, 0.6);
    S.slamGround();
  },
  crabBellsBelow: () => {
    loadSamples();
    playSample("bell_strike", 0.22, 0.05, 0.42);
    playSample("bell_strike", 0.14, 0.5, 0.47);
  },
  crabBurst: () => {
    loadSamples();
    if (!playSample("crab_thud_a", 0.9, 0, 0.75))
      S.slam();
    playSample("sword_hit_heavy", 0.35, 0.02, 0.6);
  },
  crabHurt: () => {
    if (now() - lastCry < CRY_GAP)
      return;
    lastCry = now();
    loadSamples();
    if (!playSample("crab_hurt", 0.4))
      playSample("sword_hit_heavy", 0.3, 0.04, 0.55);
  },
  crabPhase: () => {
    loadSamples();
    playSample("crab_hum", 0.55);
    if (!playSample("bell_strike", 0.4, 0.15, 0.6))
      S.phase();
  },
  crabStagger: () => {
    loadSamples();
    if (!playSample("sword_hit_heavy", 0.55, 0, 0.45))
      S.stagger();
  },
  crabDeath: () => {
    loadSamples();
    if (!playSample("crab_thud_a", 0.95, 0, 0.65))
      S.slam();
    if (!playSample("bell_strike", 0.6, 0.4, 0.5))
      S.death();
  },
  click: () => (tone2({ type: "triangle", f: 700, f2: 1000, t: 0.06, g: 0.1 }), noise({ t: 0.03, g: 0.05, type: "highpass", f: 3000 })),
  coin: () => (tone2({ type: "square", f: 1200, t: 0.06, g: 0.08 }), tone2({ type: "square", f: 1800, t: 0.12, g: 0.06, delay: 0.05 })),
  win: () => [0, 4, 7, 12].forEach((s, i) => tone2({ type: "triangle", f: 330 * Math.pow(2, s / 12), t: 0.5, g: 0.12, delay: i * 0.1 })),
  lose: () => [0, -2, -5, -9].forEach((s, i) => tone2({ type: "triangle", f: 330 * Math.pow(2, s / 12), t: 0.7, g: 0.1, delay: i * 0.14 })),
  open: () => tone2({ type: "sine", f: 300, f2: 620, t: 0.25, g: 0.1 })
};
var oneOf = (files, pick) => Object.assign(pick, { files });
var filesOf = (table) => [...new Set(Object.values(table).flatMap(([pick]) => pick.files || [pick()]))];
var SAMPLES = {
  whoosh: [oneOf(["sword_swing_2", "sword_swing_1"], (step) => step === 1 ? "sword_swing_2" : "sword_swing_1"), 0.5],
  swing: [() => "sword_swing_1", 0.5],
  whooshHeavy: [() => "sword_swing_1", 0.6],
  hit: [() => "sword_hit", 0.55],
  hitHeavy: [() => "sword_hit_heavy", 0.65],
  clang: [() => "sword_clang", 0.45],
  crit: [() => "sword_clang", 0.3, 0.02],
  parry: [() => "bell_small", 0.4],
  lash: [() => "toad_tongue_lash", 0.6],
  hop: [() => "toad_hop", 0.55],
  slam: [() => "toad_land", 0.75],
  arrive: [() => "toad_arrive", 0.9],
  chestLand: [() => "chest_land", 0.7],
  chestOpen: [() => "chest_open", 0.75],
  chestMusic: [() => "mus_chest", 0.5],
  spit: [() => "toad_spit", 0.55],
  cast: [() => "toad_croak", 0.6],
  roar: [() => "toad_croak", 1],
  stagger: [() => "toad_hurt", 0.6],
  swarm: [() => "toad_flies", 0.4],
  bell: [() => "bell_strike", 0.6],
  bellSmall: [() => "bell_small", 0.5],
  roll: [() => "hero_dash", 0.45],
  hurt: [oneOf(["hero_hurt", "hero_hurt_heavy"], (dmg) => dmg >= 20 ? "hero_hurt_heavy" : "hero_hurt"), 0.6],
  hurtVoice: [oneOf(["hero_grunt_a", "hero_grunt_b", "hero_grunt_c"], () => ["hero_grunt_a", "hero_grunt_b", "hero_grunt_c"][Math.floor(Math.random() * 3)]), 0.5],
  death: [() => "hero_death", 0.6],
  bossDeath: [() => "toad_death", 0.65],
  enrage: [() => "toad_enrage", 0.6],
  phase: [() => "toad_phase", 0.6],
  throw: [() => "knife_throw", 0.5],
  buff: [() => "magic_buff", 0.45],
  shieldUp: [() => "magic_buff", 0.45],
  splat: [() => "goo_splat", 0.5],
  graze: [() => "sword_swing_2", 0.22],
  jump: [() => "hero_jump", 0.5],
  jumpLand: [() => "hero_jump_land", 0.5],
  vault: [() => "sword_swing_1", 0.3],
  drink: [() => "hero_drink", 0.5],
  riposte: [() => "riposte_strike", 0.85],
  flyBuzz: [() => "fly_buzz_rise", 0.45],
  flyDive: [() => "fly_dive", 0.45],
  windHold: [() => "toad_throat_fill", 0.6],
  phaseRoar: [() => "toad_croak", 1, 0.5],
  windHop: [() => "toad_crouch_gulp", 0.55],
  windLash: [() => "toad_tongue_draw", 0.5],
  birdsFlee: [() => "bird_takeoff", 0.35],
  frogPlop: [() => "frog_plop", 0.35],
  wade: [() => "water_splash", 0.22],
  splashBig: [() => "water_splash_big", 0.55],
  bossHurt: [oneOf(["toad_pain_a", "toad_pain_b", "toad_pain_c"], () => now() - lastCry < CRY_GAP ? null : (lastCry = now(), ["toad_pain_a", "toad_pain_b", "toad_pain_c"][Math.floor(Math.random() * 3)])), 0.5, 0.06]
};
var COMMON_FILES = filesOf(SAMPLES);
var BOSS_SAMPLES = {
  cinder: {
    cinderCast: [() => "cinder_cast", 0.35],
    fireLanes: [() => "fire_lanes", 0.6],
    fireThrow: [() => "fire_throw", 0.3],
    fireImpact: [() => "fire_impact", 0.5],
    fireNova: [() => "fire_nova", 0.65],
    ashVeil: [() => "ash_veil", 0.5],
    emberBoom: [() => "ember_boom", 0.55],
    fireSweep: [() => "fire_sweep", 0.5],
    fireBolt: [() => "fire_bolt", 0.45],
    fireStorm: [() => "fire_storm", 0.55],
    fireIgnite: [() => "fire_ignite", 0.3],
    cinderHurt: [oneOf(["cinder_pain_a", "cinder_pain_b", "cinder_pain_c"], () => now() - lastCry < CRY_GAP ? null : (lastCry = now(), ["cinder_pain_a", "cinder_pain_b", "cinder_pain_c"][Math.floor(Math.random() * 3)])), 0.45, 0.06],
    cinderStagger: [() => "cinder_stagger", 0.55],
    cinderPhase: [() => "cinder_phase", 0.6],
    cinderDeath: [() => "cinder_death", 0.9],
    cinderRise: [() => "cinder_rise", 0.55],
    bubblePop: [() => "bubble_pop", 0.8],
    bubbleSeal: [() => "bubble_seal", 0.6],
    bubbleWard: [() => "bubble_ward", 0.5],
    charge: [() => "fire_charge", 0.55],
    fireWall: [() => "fire_wall", 0.7]
  },
  crab: {
    crabStep: [oneOf(["crab_step_a", "crab_step_b", "crab_step_c"], () => ["crab_step_a", "crab_step_b", "crab_step_c"][Math.floor(Math.random() * 3)]), 0.18],
    crabThud: [oneOf(["crab_thud_a", "crab_thud_b"], () => Math.random() < 0.5 ? "crab_thud_a" : "crab_thud_b"), 0.5],
    crabRumble: [() => "crab_rumble", 0.3],
    crabBurst: [() => "crab_burst", 0.9],
    crystalErupt: [() => "crystal_erupt", 0.45],
    crabPincer: [() => "crab_pincer", 0.6],
    brineSurge: [() => "brine_surge", 0.85]
  }
};
for (const own of Object.values(BOSS_SAMPLES))
  Object.assign(SAMPLES, own);
var VOICES = {
  cinder: { phaseRoar: null, clang: "ashClang", fire: null, splat: null, nova: "fireNova", storm: "fireStorm", veil: "ashVeil", bossHurt: "cinderHurt", bossDeath: "cinderDeath", phase: "cinderPhase", enrage: "cinderPhase", stagger: "cinderStagger" },
  king: { slam: "kingSlam", arrive: "kingSlam", bossHurt: "kingHurt", stagger: "kingStagger", phase: "kingPhase", enrage: "kingPhase", bossDeath: "kingDeath", cast: null, roar: null, spit: null, splat: null, lash: null, hop: null, swarm: null }
};
VOICES.crab = { ...VOICES.king, phaseRoar: null, slam: "crabSlam", arrive: "crabSlam", stagger: "crabStagger", bossDeath: "crabDeath", rumble: "crabRumble", bossHurt: "crabHurt", phase: "crabPhase", enrage: "crabPhase", wave: "brineSurge", flood: "brineSurge", chain: null };
var VOICE_FILES = Object.fromEntries(Object.entries(BOSS_SAMPLES).map(([id, own]) => [id, filesOf(own)]));
var voice = null;
var voiceFiles = null;
function setVoice(id) {
  voice = VOICES[id] || null;
  voiceFiles = VOICE_FILES[id] || null;
  if (samplesAsked && voiceFiles)
    for (const n of voiceFiles)
      loadSample(n);
}
var CRY_GAP = 0.2;
var lastCry = -1;
var RATE_JITTER = 0.04;
var buffers = new Map;
var samplesAsked = false;
function loadSamples() {
  const c = ensure2();
  if (!c || samplesAsked || typeof fetch !== "function")
    return;
  samplesAsked = true;
  for (const n of COMMON_FILES)
    loadSample(n);
  for (const n of voiceFiles || [])
    loadSample(n);
  if (ambientWanted)
    loadSample(ambientName);
  if (fightWanted)
    loadSample(FIGHT_MUSIC);
}
function loadSample(n) {
  const c = ensure2();
  if (!c || buffers.has(n) || typeof fetch !== "function")
    return;
  buffers.set(n, null);
  if (n === FIGHT_MUSIC)
    fetch("audio/mus_fight.json").then((r) => r.ok ? r.json() : Promise.reject(r.status)).then((j) => (fightLoop = j[FIGHT_MUSIC], fightWanted && startFightMusic())).catch(() => {});
  fetch(`audio/${n}.mp3`).then((r) => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then((b) => c.decodeAudioData(b)).then((buf) => (buffers.set(n, buf), n === ambientName && ambientWanted && startAmbient(ambientName), n === FIGHT_MUSIC && fightWanted && startFightMusic())).catch(() => buffers.delete(n));
}
function playSample(name, gain, delay = 0, rate = 1) {
  const c = ensure2();
  if (name == null)
    return true;
  const buf = buffers.get(name);
  if (!c || !enabled || !buf)
    return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = name.startsWith("mus_") ? 1 : rate * (1 + (Math.random() * 2 - 1) * RATE_JITTER);
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(now() + delay);
  if (name.startsWith("mus_")) {
    const cue = { src, g };
    musicCues.add(cue);
    src.onended = () => musicCues.delete(cue);
  }
  return true;
}
var musicCues = new Set;
function stopMusicCues(sec = 0.3) {
  if (!ac)
    return;
  for (const { src, g } of musicCues) {
    g.gain.cancelScheduledValues(now());
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + sec);
    try {
      src.stop(now() + sec + 0.02);
    } catch {}
  }
  musicCues.clear();
}
var AMBIENT_GAIN = 0.16;
var ambient = null;
var ambientWanted = false;
var ambientName = "amb_meadow";
function startAmbient(name = "amb_meadow") {
  ambientWanted = true;
  ambientName = name;
  const c = ensure2();
  loadSamples();
  loadSample(name);
  const buf = buffers.get(name);
  if (!c || !buf || ambient)
    return;
  const d = buf.getChannelData(0);
  let a = 0, z = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < 0.0001)
    a++;
  while (z > a && Math.abs(d[z]) < 0.0001)
    z--;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = a / buf.sampleRate;
  src.loopEnd = z / buf.sampleRate;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(AMBIENT_GAIN, now() + 2);
  src.connect(g).connect(master);
  src.start(now(), src.loopStart);
  ambient = { src, g };
}
function ambientLevel(k, s = 1.5) {
  if (!ambient)
    return;
  const g = ambient.g.gain;
  g.cancelScheduledValues(now());
  g.setValueAtTime(Math.max(0.0001, g.value), now());
  g.exponentialRampToValueAtTime(Math.max(0.0001, AMBIENT_GAIN * k), now() + s);
}
function stopAmbient() {
  ambientWanted = false;
  if (!ambient)
    return;
  const { src, g } = ambient;
  ambient = null;
  g.gain.cancelScheduledValues(now());
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now());
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 1);
  src.stop(now() + 1.05);
}
var FIGHT_MUSIC = "mus_fight";
var FIGHT_GAIN = 0.3;
var FIGHT_FADE = 2.5;
var fightLoop = null;
var fightWanted = false;
var fightNow = null;
function startFightMusic() {
  fightWanted = true;
  const c = ensure2();
  loadSamples();
  loadSample(FIGHT_MUSIC);
  const buf = buffers.get(FIGHT_MUSIC);
  if (!c || !buf || !fightLoop || fightNow)
    return;
  stopDrone();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = fightLoop.start;
  src.loopEnd = fightLoop.end;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(FIGHT_GAIN, now() + FIGHT_FADE);
  src.connect(g).connect(musicGain);
  src.start(now(), fightLoop.start);
  fightNow = { src, g };
}
function stopFightMusic(sec = 1) {
  fightWanted = false;
  if (!fightNow)
    return;
  const { src, g } = fightNow;
  fightNow = null;
  g.gain.cancelScheduledValues(now());
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now());
  g.gain.exponentialRampToValueAtTime(0.0001, now() + sec);
  src.stop(now() + sec + 0.05);
}
S.bellSmall = (...a) => S.bell(...a);
S.arrive = (...a) => S.slam(...a);
S.chestLand = (...a) => S.slamGround(...a);
S.chestOpen = (...a) => S.win(...a);
var sfx = new Proxy({}, {
  get: (_, k) => {
    if (voice && k in voice) {
      if (voice[k] === null)
        return () => {};
      k = voice[k];
    }
    const made = S[k];
    const smp = SAMPLES[k];
    if (!smp)
      return made || (() => {});
    return (...args) => {
      loadSamples();
      if (!playSample(smp[0](...args), smp[1], smp[2] || 0))
        made?.(...args);
    };
  }
});
function stopDrone() {
  if (musicStop)
    musicStop();
  musicStop = null;
}
function duck(sec, floor) {
  if (!lowpass || !ac || !(floor > 0))
    return;
  const f = lowpass.frequency, t = now();
  f.cancelScheduledValues(t);
  f.setValueAtTime(floor, t);
  f.setValueAtTime(floor, t + sec);
  f.exponentialRampToValueAtTime(20000, t + sec + 0.12);
}

// site/js/feel.js
var FEEL = {
  hit: { stop: 0.04, perDmg: 0.0025, max: 0.085, shake: 3, shakePerDmg: 0 },
  heavy: { stop: 0.1, perDmg: 0, max: 0.1, shake: 6, shakePerDmg: 0 },
  crit: { stop: 0, shake: 0 },
  flat: { stop: 0, shake: 3 },
  add: { stop: 0.03 },
  clang: { stop: 0.05, shake: 0 },
  taken: { stop: 0.08, perDmg: 0.0025, max: 0.165, shake: 7, shakePerDmg: 0 },
  parry: { stop: 0.1, shake: 4 },
  block: { stop: 0, shake: 3 },
  guardBreak: { stop: 0, shake: 0 },
  stagger: { stop: 0.15, shake: 10 },
  phase: { stop: 0.14, shake: 9 },
  kill: { stop: 0.25, shake: 14, slow: 0.3 },
  stopMax: false,
  cam: { kick: 0.3, punch: 0.05 },
  numbers: { pop: 0.5, size: 0.35 },
  flash: { hit: 0.75, heavy: 1, kill: 1, dur: 0.12, hold: 0.02, screenKill: 0.4 },
  killZoom: { amt: 0.12, hold: 0.5 },
  chestZoom: { amt: 0.25, hold: 2.9 },
  hud: { chipHold: 0.45, heartHit: 0.35 },
  haptics: { hit: 10, heavy: 22, hurt: 40, stagger: 50, kill: 90 },
  bossNudge: 0.1,
  bossNudgeMax: 3,
  audio: { duck: 1100, crit: true, parry: true },
  bursts: { stagger: 18, kill: 30, clang: 8 },
  bossFlinch: 1,
  heavyTrail: { inner: 0.35, body: 0.16, edge: 0.85, linger: 0.06 },
  blast: { rain: 0.32, boom: 0.4, reach: 140 },
  footfall: { trauma: 0.16, reach: 170, gap: 0.2 }
};
var stopFor = (f, dmg = 0) => Math.min(f.max ?? f.stop, f.stop + (f.perDmg || 0) * dmg) || 0;
var shakeFor = (f, dmg = 0) => (f.shake || 0) + (f.shakePerDmg || 0) * dmg;

// site/js/view-pref.js
var can = null;
var maxTex = 4096;
function canView3D() {
  if (can !== null)
    return can;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    can = !!gl;
    if (gl)
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    can = false;
  }
  return can;
}
function maxTextureSize() {
  canView3D();
  return maxTex;
}

export { __export, __preload, __chunks, clamp, lerp, TAU, angleDiff, rng, TICK_EPS, reached, hashSeed, pickN, roman, mmss, untilNext, raw, html, PLANT_FLEX, ARENA_PLANTS, ARENA_CRITTERS, RELEASE, MODS3D, stampUrl, KIND, jumpable, hazard, shown, phaseOf, teleK, radiusOf, stepHazard, hits, damageFor, sourceOf, CLIMB, holeEdge, rimToward, rimAt, gapAt, climbPose, HOLE0, turnTo, holeFor, divePose, diveU, holeWorld, rimDist, SLAM_SWEEP2, SLAM_R2, SLAM_R_SMALL2, BOSSES2, CLASSIC2, BOSS_ORDER2, MODELLED2, ART, buildArt, ensure, frameOf, KY, ISO_W, ISO_H, toScreen, toWorld, VIEW, dirToWorld, CONFIG, TICK, MAX_FRAME, ARENA, PLAYER, FORE, sweepDir, FIGHT, SHAKE_MAX, BUBBLE_R, HEART_VALUE, ARENA_SHAPES, WALK_EDITS, arenaShape, walkCells, shapeFromCells, WEAPONS, WEAPON_IDS, armable, settleArms, EV, STATE, makePlayer, setArms, moveOf, stepPlayer, swingArc, bladeHits, staggerPlayer, hurtPlayer, armCounter, jumpLift, inAir, tryArena, placeOf, BACKDROP_ARENAS, unlock, setEnabled, setMusic, setVoice, stopMusicCues, startAmbient, ambientLevel, stopAmbient, stopFightMusic, sfx, stopDrone, duck, FEEL, stopFor, shakeFor, canView3D, maxTextureSize };
