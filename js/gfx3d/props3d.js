// The garden's solid props, built by code (docs/3D-PLAN.md 4.5–4.9): the wall's stone (blocks,
// capstones, copings, moss strips and the pillar, one merged mesh), the lanterns (instanced, with an
// outline hull, flame cards and amber panes), the trunks (one merged mesh), apples and clovers
// (instanced, with hulls), and the flowers and lupines (one instanced card mesh).
//
// Flat colours for M4a: every colour is a vertex or instance colour taken from the target's
// palette (1.3, V22–V36), as an albedo the lighting then brightens or shades; the painted atlas
// replaces them in M4b. Sizes and places come from layout3d.js, so the Bun layout tests check the
// very numbers built here.
//
// Also the small mesh-building kit the other garden files share (Geo, lin, patches for the paint
// material).
import { BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Mesh, ShaderMaterial, DataTexture, RGBAFormat, SRGBColorSpace, NearestFilter, NearestMipmapNearestFilter, CustomBlending, AddEquation, OneFactor, ZeroFactor, Color, Matrix4, Quaternion, Vector3, Vector4, SphereGeometry, MeshDepthMaterial, RGBADepthPacking } from "./three-lib.js?v=df092a6";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=df092a6";
import { RIGHT, UP, BACK } from "./camera3d.js?v=df092a6";
import { LANTERN, CLOVER, FLOWER_TILT, LUPINE, DEG, backArc, thetaOf, hyp, smooth } from "./layout3d.js?v=df092a6";

// --- the kit ------------------------------------------------------------------------------------------

/** An sRGB hex as linear [r, g, b], which is what vertex and instance colours hold. */
const linCache = new Map();
export function lin(hex) {
  let v = linCache.get(hex);
  if (!v) {
    const c = new Color(hex);
    v = [c.r, c.g, c.b];
    linCache.set(hex, v);
  }
  return v;
}
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul3 = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => {
  const l = hyp(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Rotate v about a unit axis by angle (Rodrigues). */
function rotAxis(v, k, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}
/**
 * A triangle soup: positions, normals, colours, and optionally a fade-group id, UVs and an atlas
 * cell id (`aCell`, a float; paint3d.js atlasCells) per vertex.
 */
export class Geo {
  constructor({ group = false, uv = false, cell = false } = {}) {
    this.p = [];
    this.n = [];
    this.c = [];
    this.g = group ? [] : null;
    this.u = uv ? [] : null;
    this.k = cell ? [] : null;
  }
  v(p, n, c, g = 0, u = null, k = 0) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(c[0], c[1], c[2]);
    if (this.g) this.g.push(g);
    if (this.u) this.u.push(u ? u[0] : 0, u ? u[1] : 0);
    if (this.k) this.k.push(k);
  }
  /**
   * A flat triangle, wound to face away from `inside` (when given). `uvf(point, normal)` gives
   * each corner's UV, worked out after the winding flip so a UV always stays on its own corner;
   * `cell` is the triangle's atlas cell id.
   */
  tri(a, b, c, ca, cb = ca, cc = ca, g = 0, inside = null, uvf = null, cell = 0) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = hyp(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    if (inside && nx * ((a[0] + b[0] + c[0]) / 3 - inside[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - inside[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - inside[2]) < 0) {
      [b, c] = [c, b];
      [cb, cc] = [cc, cb];
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const n = [nx, ny, nz];
    this.v(a, n, ca, g, uvf ? uvf(a, n) : null, cell);
    this.v(b, n, cb, g, uvf ? uvf(b, n) : null, cell);
    this.v(c, n, cc, g, uvf ? uvf(c, n) : null, cell);
  }
  /** A triangle with its own normals (smooth), wound to face the way the normals do (UVs swapped with their corners); `cell` its atlas cell id. */
  triN(a, b, c, na, nb, nc, ca, cb = ca, cc = ca, g = 0, ua = null, ub = null, uc = null, cell = 0) {
    const f = cross(sub(b, a), sub(c, a));
    if (dot(f, [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]]) < 0) {
      this.v(a, na, ca, g, ua, cell);
      this.v(c, nc, cc, g, uc, cell);
      this.v(b, nb, cb, g, ub, cell);
    } else {
      this.v(a, na, ca, g, ua, cell);
      this.v(b, nb, cb, g, ub, cell);
      this.v(c, nc, cc, g, uc, cell);
    }
  }
  build() {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(this.p, 3));
    geo.setAttribute("normal", new Float32BufferAttribute(this.n, 3));
    geo.setAttribute("color", new Float32BufferAttribute(this.c, 3));
    if (this.g) geo.setAttribute("aGroup", new Float32BufferAttribute(this.g, 1));
    if (this.u) geo.setAttribute("uv", new Float32BufferAttribute(this.u, 2));
    if (this.k) geo.setAttribute("aCell", new Float32BufferAttribute(this.k, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}

/** An axis-aligned box of flat faces; `col(faceNormal)` colours each face (`uvf` and `cell` as Geo.tri). */
function aabb(geo, x0, y0, z0, x1, y1, z1, col, g = 0, uvf = null, cell = 0) {
  const P = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const inside = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces = [
    [[0, 2, 6, 4], [-1, 0, 0]],
    [[1, 3, 7, 5], [1, 0, 0]],
    [[0, 1, 5, 4], [0, -1, 0]],
    [[2, 3, 7, 6], [0, 1, 0]],
    [[0, 1, 3, 2], [0, 0, -1]],
    [[4, 5, 7, 6], [0, 0, 1]],
  ];
  for (const [q, n] of faces) {
    const c = typeof col === "function" ? col(n) : col;
    geo.tri(P(q[0]), P(q[1]), P(q[2]), c, c, c, g, inside, uvf, cell);
    geo.tri(P(q[0]), P(q[2]), P(q[3]), c, c, c, g, inside, uvf, cell);
  }
}

/** A box for an outline hull: each corner's normal points out along its diagonal, so the pushed-out hull stays closed. */
function hullBox(geo, x0, y0, z0, x1, y1, z1, g = 0) {
  const P = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const N = (i) => norm([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
  const k = [0, 0, 0];
  for (const q of [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]]) {
    geo.triN(P(q[0]), P(q[1]), P(q[2]), N(q[0]), N(q[1]), N(q[2]), k, k, k, g);
    geo.triN(P(q[0]), P(q[2]), P(q[3]), N(q[0]), N(q[2]), N(q[3]), k, k, k, g);
  }
}

/**
 * Wrap a paint material's shader: `vert` and `frag` are [search, replace] pairs applied after the
 * paint material's own, and `key` keeps the program apart from the plain variant.
 */
export function patchPaint(m, key, { vert = [], frag = [] } = {}) {
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    for (const [a, b] of vert) sh.vertexShader = sh.vertexShader.replace(a, b);
    for (const [a, b] of frag) sh.fragmentShader = sh.fragmentShader.replace(a, b);
  };
  const k0 = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${k0()}:${key}`;
  return m;
}
/** Grass and flowers bend by their height above the ground (the instance scale included), not by the raw attribute. */
export const WIND_BY_HEIGHT = ["clamp(position.y / 4.0, 0.0, 1.0)", "clamp(pw.y / 4.0, 0.0, 1.0)"];
/** Lawn cover's outline hull writes the flattened depth too (the paint material's 1.9·Y, materials3d.js), so a clover's outline never cuts a marking (4.11) and stays behind its own leaves. */
export function flattenHull(m) {
  return patchPaint(m, "flat", {
    vert: [
      ["#include <common>", "#include <common>\nuniform float uFlatR;"],
      [
        "vec4 mvPosition = viewMatrix * pw;",
        `vec4 mvPosition = viewMatrix * pw;
         {
           vec4 root = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           #ifdef USE_INSTANCING
             root = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           #endif
           if (length(root.xz) < uFlatR) mvPosition.z -= 1.9 * max(pw.y, 0.0);
         }`,
      ],
    ],
  });
}
/**
 * An RGBA atlas for alpha-cut cards, with its own mip chain: each level keeps a texel wherever at
 * least half of the four below it are opaque (its colour their average). Averaged mips would fade
 * thin stamps below the cut and the cards would vanish at a distance; these keep their coverage
 * (4.7), so no alpha sharpening is needed.
 */
export function cardAtlas(data, W, H) {
  return mipTexture(cardMips(data, W, H));
}
/**
 * cardAtlas's mip chain, on its own (pure: no three.js): [{ data, width, height }, …] from the
 * full size down to 1 × 1. The painted garden atlas (paint3d.js) builds it once per page and every
 * renderer wraps it with mipTexture.
 *
 * `linear` averages the colours in linear light instead of as sRGB bytes (critique #12): the
 * painted atlas's ratio cells divide by a linear mean, and a byte average would make every lower
 * level a few percent darker (up to about 12% on a contrasty cell), so the wide pull-back, which
 * reads mip 2–3, would dim the painted garden. The procedural atlases keep the byte average, so
 * the flat M4a look (?paint=0) is unchanged.
 */
const S2L = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});
const L2S = new Uint8Array(16384).map((_, i) => {
  const c = i / 16383;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
});
export function cardMips(data, W, H, { linear = false } = {}) {
  const get = linear ? (v) => S2L[v] : (v) => v;
  const put = linear ? (a) => L2S[Math.min(16383, Math.round(a * 16383))] : (a) => a;
  const mips = [{ data, width: W, height: H }];
  let src = data;
  let w = W;
  let h = H;
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1);
    const nh = Math.max(1, h >> 1);
    const dst = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++)
      for (let x = 0; x < nw; x++) {
        let n = 0;
        let a0 = 0;
        let a1 = 0;
        let a2 = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const o = (Math.min(h - 1, y * 2 + dy) * w + Math.min(w - 1, x * 2 + dx)) * 4;
            if (src[o + 3] > 127) {
              n++;
              a0 += get(src[o]);
              a1 += get(src[o + 1]);
              a2 += get(src[o + 2]);
            }
          }
        const o = (y * nw + x) * 4;
        if (n >= 2) {
          dst[o] = put(a0 / n);
          dst[o + 1] = put(a1 / n);
          dst[o + 2] = put(a2 / n);
          dst[o + 3] = 255;
        }
      }
    mips.push({ data: dst, width: nw, height: nh });
    src = dst;
    w = nw;
    h = nh;
  }
  return mips;
}
/** A card texture from a cardMips chain: sRGB, hard texels, the nearest mip. */
export function mipTexture(mips) {
  const t = new DataTexture(mips[0].data, mips[0].width, mips[0].height, RGBAFormat);
  t.mipmaps = mips;
  t.generateMipmaps = false;
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestMipmapNearestFilter;
  t.needsUpdate = true;
  return t;
}

/** A per-instance attribute from an array. */
export const inst = (arr, size) => new InstancedBufferAttribute(new Float32Array(arr), size);

/** Instance matrices from a list of [x, y, z, yaw, sx, sy, sz]. */
export function fillMatrices(mesh, list) {
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const p = new Vector3();
  const s = new Vector3();
  list.forEach((t, i) => {
    q.setFromAxisAngle(up, t[3] || 0);
    m.compose(p.set(t[0], t[1], t[2]), q, s.set(t[4] ?? 1, t[5] ?? t[4] ?? 1, t[6] ?? t[4] ?? 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

// --- the wall's stone (4.6) -----------------------------------------------------------------------------

// Albedos, tuned in the target-garden capture against the image's colours (V30–V32, 4.6). The
// faces the camera sees are in the sun's shade (the sun is behind the wall): the teal sky and the
// stone's own fill (STONE_LIGHT) land them on the image's shade values. Away from the hero the
// tops take the sun at the pool's floor (0.3) and come out near their V values without the
// lanterns (with the hero by the wall, the pool, centred on him since D15 changed, lights the tops
// beside him fully); the lanterns
// warm the flanks' copings and faces and the camera-side stones by L3 and L5.
/** The flanks' and the back's blocks: blue-grey, #101720 / #19212d / #222a38 on the back (V30). */
const STONE = [lin(0x3e4a5d), lin(0x475469), lin(0x36404f)];
/**
 * The camera side's blocks, under the capstones: a grey a little to the blue side, so their fronts
 * read near #26252b in the shade (V32) and L3's orange light browns them (#5e4934 in the image)
 * rather than turning them orange.
 */
const STONE_LOW = lin(0x50535e);
/**
 * The camera side's lit capstone tops, #65533b…#9f8452 (V32): warm, as the golden sun at the pool's
 * floor leaves them tan (away from the hero, whom the pool is centred on); one tone per cap by its shade (1, 0.8, 1.15), so the row is not one flat
 * band; the painted capTop cell adds the lit plane inside each top.
 */
const CAP_TOP = [1, 0.8, 1.15].map((k) => mul3(lin(0x60584f), k));
const CAP_SIDE = lin(0x56545c); // and their dark fronts, #26252b
/**
 * The flanks' copings: #a1764a→#dfaa5c by a lantern (V31). The same warm grey as the capstone tops
 * (not the blue-grey of the blocks), so the one gold light the tops take (STONE_LIGHT) lands the
 * copings by L1/L2 on #dfaa5c and the capstones by L3 on #c7a262 alike.
 */
const COPING = lin(0x5c544a);
/** The back arc's: the thin cool highlight #3e4150 (V30). Copings between blend by backArc. */
const COPING_BACK = lin(0x34395a);
const MOSS_TOP = lin(0x4a561c); // lit #5b6219 (4.6)
const MOSS_SIDE = lin(0x3a4a16);
/**
 * How the stone takes the light (paintMaterial's fill and lant; arena3d.js, painted or flat). The
 * fill (linear irradiance, a little blue) keeps the faces in the sun's shade a readable blue-grey
 * where the teal sky alone left them black. The lantern term is its plain one (4.10) with N·L
 * wrapped by 1, 2.9 times as strong and rolled off softly at 5: a flame stands 17 units above
 * the flank's coping and more than that from the faces under it, and the image still warms the
 * coping beside every lantern to #dfaa5c and the faces to #634832 / #885635 (V31); the roll-off
 * keeps the coping between L1 and L2, which both light, from adding up past the lit colour.
 * Warm up-facing stone (the copings and capstone tops; materials3d.js keeps the green moss and the
 * blue-grey blocks on the plain term) takes 1.5 times the light before the roll-off and a gold tint
 * on the flame's orange (top, tint): L3 and L5 stand on the terrace 29–43 units from the capstones
 * they light (r 160 and 168, as the plan places them), yet the image lights those tops to #97774c /
 * #c7a262 (V32) and to about #dfb972 by the flame, a paler gold than the orange #885635 it gives
 * the faces. The faces keep the plain orange. The moss on the stone (green albedo, any facing;
 * materials3d.js) takes the flame's light with about half its red (`green`): the plain orange times the
 * moss's green came out ochre by L1–L3, where the image keeps that moss yellow-green (#8b9231 up to
 * #b8bc44 by L1's head, r/g about 0.95). The rest of the garden keeps the plain term.
 */
export const STONE_LIGHT = { fill: [0.9, 0.85, 0.95], lant: { k: 2.9, wrap: 1, sat: 5, top: 0.5, tint: [0.9, 1.6, 4], green: [0.48, 1, 3] } };

/**
 * A bevelled box laid on a layout piece (centre, radial angle, half length and depth, y0..y1).
 * Each corner has its own bevel, so a chipped corner is just a big one. `col(y, kind, top)` gives
 * a vertex's colour: kind is "face", "bevel" (the joints: near-black) or "corner".
 */
function chamfer(geo, b, { bevel = 0.3, chips = [], col, split = 0, uvf = null, cellOf = null }) {
  const hh = (b.y1 - b.y0) / 2;
  const my = (b.y0 + b.y1) / 2;
  const nx = Math.cos(b.ang);
  const nz = Math.sin(b.ang);
  const W = (lx, ly, lz) => [b.cx - nz * lx + nx * lz, my + ly, b.cy + nx * lx + nz * lz];
  const inside = [b.cx, my, b.cy];
  const lim = Math.min(b.hl, hh, b.hd) * 0.8;
  const P = [];
  for (let i = 0; i < 8; i++) {
    const sx = i & 4 ? 1 : -1;
    const sy = i & 2 ? 1 : -1;
    const sz = i & 1 ? 1 : -1;
    const e = Math.min(bevel + (chips[i] || 0), lim);
    P.push({ x: W(sx * b.hl, sy * (hh - e), sz * (b.hd - e)), y: W(sx * (b.hl - e), sy * hh, sz * (b.hd - e)), z: W(sx * (b.hl - e), sy * (hh - e), sz * b.hd) });
  }
  const C = (p, kind, top) => col(p[1], kind, top);
  const tri = (a, bb, c, kind, top = false) => geo.tri(a, bb, c, C(a, kind, top), C(bb, kind, top), C(c, kind, top), 0, inside, uvf, cellOf ? cellOf(kind, top) : 0);
  const quad = (q, kind, top = false) => {
    tri(q[0], q[1], q[2], kind, top);
    tri(q[0], q[2], q[3], kind, top);
  };
  const side = (q) => {
    // A side face, split near its foot so the contact darkness stays in the lowest units.
    const ys = b.y0 + split;
    const lo = Math.min(...q.map((p) => p[1]));
    const hi = Math.max(...q.map((p) => p[1]));
    if (!split || ys <= lo + 0.05 || ys >= hi - 0.05) return quad(q, "face");
    const idx = [0, 1, 2, 3];
    const bot = idx.filter((i) => q[i][1] < (lo + hi) / 2);
    const partner = (i) => [(i + 1) % 4, (i + 3) % 4].find((j) => q[j][1] > (lo + hi) / 2);
    if (bot.length !== 2) return quad(q, "face");
    const [b0, b1] = bot;
    const t0 = partner(b0);
    const t1 = partner(b1);
    if (t0 === undefined || t1 === undefined || t0 === t1) return quad(q, "face");
    const at = (i, j) => {
      const t = (ys - q[i][1]) / (q[j][1] - q[i][1]);
      return [q[i][0] + (q[j][0] - q[i][0]) * t, ys, q[i][2] + (q[j][2] - q[i][2]) * t];
    };
    const m0 = at(b0, t0);
    const m1 = at(b1, t1);
    quad([q[b0], q[b1], m1, m0], "face");
    quad([m0, m1, q[t1], q[t0]], "face");
  };
  side([4, 6, 7, 5].map((i) => P[i].x));
  side([0, 2, 3, 1].map((i) => P[i].x));
  side([1, 5, 7, 3].map((i) => P[i].z));
  side([0, 4, 6, 2].map((i) => P[i].z));
  quad([2, 6, 7, 3].map((i) => P[i].y), "face", true);
  quad([0, 4, 5, 1].map((i) => P[i].y), "face");
  // The twelve edge bevels: the joints between blocks.
  for (const [sy, sz] of [[0, 0], [2, 0], [0, 1], [2, 1]]) quad([P[sy | sz].y, P[4 | sy | sz].y, P[4 | sy | sz].z, P[sy | sz].z], "bevel", sy > 0);
  for (const [sx, sz] of [[0, 0], [4, 0], [0, 1], [4, 1]]) quad([P[sx | sz].x, P[sx | 2 | sz].x, P[sx | 2 | sz].z, P[sx | sz].z], "bevel");
  for (const [sx, sy] of [[0, 0], [4, 0], [0, 2], [4, 2]]) quad([P[sx | sy].x, P[sx | sy | 1].x, P[sx | sy | 1].y, P[sx | sy].y], "bevel", sy > 0);
  for (let i = 0; i < 8; i++) tri(P[i].x, P[i].y, P[i].z, "corner", (i & 2) > 0);
}

/**
 * The wall's atlas cells, by id: buildStoneGeo writes these ids per vertex (`aCell`), and the
 * painted stone material looks each one's box and mean up (paint3d.js, which re-exports this).
 */
export const STONE_CELLS = ["stoneA", "stoneB", "stoneC", "stoneChip", "capTop", "mossStrip", "mossTop"];
const CELL = Object.fromEntries(STONE_CELLS.map((n, i) => [n, i]));
/** The painting's density on the stone: 11 texels per unit, so a 128 × 64 cell spans 11.6 × 5.8 units. */
const TEX_PER_UNIT = 11;
const CELL_W = 128 / TEX_PER_UNIT;
const CELL_H = 64 / TEX_PER_UNIT;
const MOSS_H = 32 / TEX_PER_UNIT;
/** A piece's hash in [0, 1), from its index alone (no rand(): the garden's random stream stays M4a's). */
const hash01 = (i) => (Math.imul(i + 1, 0x9e3779b1) >>> 0) / 4294967296;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Box UVs for a layout piece, as Geo.tri's `uvf(point, normal)`, in the cell's unit square (u right,
 * v down: 0 is the painting's top row). The point and normal go into the piece's own frame (the
 * inverse of chamfer's W), and the normal's dominant local axis picks the projection: the long
 * faces (±lz) run along the piece, the ends (±lx) across it, the top and bottom (±ly) lie flat; v
 * is anchored at the top of the side faces. A face longer than the cell stretches to fit; a shorter
 * one starts at a hashed offset along the leftover span. Every face but a moss strip's sides is
 * mirrored in u and v by the piece's hash, so neighbouring capstones do not show their painted lit
 * plane in the same corner and neighbouring blocks of one shade (one cell) not the same mottling.
 * `band` squeezes the side faces' v into part of the cell (the moss strip's lower quarter), unmirrored.
 */
function stoneUV(b, index, { cellH = CELL_H, band = null } = {}) {
  const hh = (b.y1 - b.y0) / 2;
  const my = (b.y0 + b.y1) / 2;
  const nx = Math.cos(b.ang);
  const nz = Math.sin(b.ang);
  const sl = Math.max(2 * b.hl, CELL_W);
  const sd = Math.max(2 * b.hd, CELL_W);
  const u0 = hash01(2 * index) * (1 - (2 * b.hl) / sl);
  const u1 = hash01(2 * index + 1) * (1 - (2 * b.hd) / sd);
  const sh = Math.max(2 * hh, cellH);
  const st = Math.max(2 * b.hd, cellH);
  const mirror = hash01(7 * index + 5003);
  const fu = (u) => (mirror < 0.5 ? 1 - u : u);
  const fv = (v) => ((mirror * 4) % 1 < 0.5 ? 1 - v : v);
  return (p, n) => {
    const dx = p[0] - b.cx;
    const dz = p[2] - b.cy;
    const lx = -nz * dx + nx * dz;
    const ly = p[1] - my;
    const lz = nx * dx + nz * dz;
    const ax = Math.abs(-nz * n[0] + nx * n[2]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(nx * n[0] + nz * n[2]);
    if (ay >= ax && ay >= az) return [fu(clamp01(u0 + (lx + b.hl) / sl)), fv(clamp01((lz + b.hd) / st))];
    const u = clamp01(az >= ax ? u0 + (lx + b.hl) / sl : u1 + (lz + b.hd) / sd);
    if (band) return [u, clamp01(band[0] + (band[1] - band[0]) * clamp01((hh - ly) / (2 * hh || 1)))];
    return [fu(u), fv(clamp01((hh - ly) / sh))];
  };
}

/**
 * All the stone: every wall piece of the layout and the pillar, merged into one mesh. Its vertex
 * colours are M4a's flat ones; the painted build (M4b) multiplies each by its cell's texel over the
 * cell's mean (ratio mode), so the UVs and cell ids ride along without changing a colour.
 */
export function buildStoneGeo(L) {
  const geo = new Geo({ uv: true, cell: true });
  L.pieces.forEach((p, index) => {
    const course1 = p.kind === "block" && p.course === 1;
    const base = p.low ? STONE_LOW : STONE[p.shade ?? 0];
    const foot = p.y0;
    let col;
    if (p.kind === "moss") col = (y, kind, top) => mul3(top ? MOSS_TOP : MOSS_SIDE, kind === "face" ? 1 : 0.7);
    else if (p.kind === "cap")
      col = (y, kind, top) => {
        const c = top && kind === "face" ? CAP_TOP[p.shade ?? 0] : CAP_SIDE;
        return mul3(c, kind === "face" ? 1 : kind === "bevel" ? (top ? 0.75 : 0.5) : 0.45);
      };
    else if (p.kind === "coping") {
      const cop = mix3(COPING, COPING_BACK, backArc(thetaOf(p.cx, p.cy)));
      col = (y, kind, top) => mul3(top ? cop : base, kind === "face" ? 1 : 0.6);
    }
    else
      col = (y, kind, top) => {
        let f = kind === "face" ? 1 : kind === "bevel" ? 0.38 : 0.3;
        if (top) f *= 1.2;
        if (course1 || p.kind === "pillar") f *= 0.12 + 0.88 * smooth(0, 1.5, y - foot);
        return mul3(base, f * (0.9 + 0.1 * Math.min(1, y / 10)));
      };
    if (p.kind === "moss" || p.kind === "coping") {
      // Thin slabs: plain boxes (12 triangles, not 44), which keeps the stone near its 6k budget.
      const nx = Math.cos(p.ang);
      const nz = Math.sin(p.ang);
      const my = (p.y0 + p.y1) / 2;
      const hh = (p.y1 - p.y0) / 2;
      const W = (lx, ly, lz) => [p.cx - nz * lx + nx * lz, my + ly, p.cy + nx * lx + nz * lz];
      const inside = [p.cx, my, p.cy];
      const P = (i) => W(i & 4 ? p.hl : -p.hl, i & 2 ? hh : -hh, i & 1 ? p.hd : -p.hd);
      const moss = p.kind === "moss";
      const uvf = stoneUV(p, index, moss ? { cellH: MOSS_H, band: [0.75, 1] } : {});
      for (const q of [[0, 4, 5, 1], [2, 6, 7, 3], [0, 2, 3, 1], [4, 6, 7, 5], [0, 4, 6, 2], [1, 5, 7, 3]]) {
        const top = q[0] === 2;
        const c = col(top ? p.y1 : my, "face", top);
        // A moss slab's top is mossTop (the cushions' interiors): the strip's cushion-boundary lines
        // would cross it as parallel stripes. Its sides keep the strip's lower quarter.
        const cell = moss ? (top ? CELL.mossTop : CELL.mossStrip) : top ? CELL.stoneB : p.shade ?? 0;
        geo.tri(P(q[0]), P(q[1]), P(q[2]), c, c, c, 0, inside, uvf, cell);
        geo.tri(P(q[0]), P(q[2]), P(q[3]), c, c, c, 0, inside, uvf, cell);
      }
      return;
    }
    // A cap's lit top is the warm capTop cell; a block with two or more chipped corners the chipped
    // stone; everything else its shade's stone.
    const stone = p.kind === "block" && (p.chips || []).filter(Boolean).length >= 2 ? CELL.stoneChip : p.shade ?? 0;
    const cellOf = p.kind === "cap" ? (kind, top) => (top && kind === "face" ? CELL.capTop : stone) : () => stone;
    chamfer(geo, p, { bevel: 0.32, chips: p.chips || [], col, split: course1 || (p.kind === "pillar" && foot === 0) ? 1.5 : 0, uvf: stoneUV(p, index), cellOf });
  });
  return geo.build();
}

// --- trunks (4.7) ---------------------------------------------------------------------------------------

const BARK_DARK = lin(0x141112);
const BARK = lin(0x331e0f);
const BARK_HI = lin(0x3d2614);
/**
 * How the trunks take the light (paintMaterial's fill and sunRim; arena3d.js, painted or flat).
 * The trunks stand at r 124, outside the sun's pool unless the hero stands by them (it is centred
 * on him, D15), and always under their own canopies' shadow, where
 * the plain terms left them black (#000000); the image keeps the bark a dark brown, #141112 →
 * #331e0f (V27), with the sun's hard lit edge #83611d down the screen-right side. The fill (linear
 * irradiance, a little blue like the shade) lands the body on those values; the rim light on
 * BARK_HI gives the lit edge.
 */
export const BARK_LIGHT = { fill: [1.6, 2.0, 3.0], sunRim: { light: [12.8, 17.4, 4.65], edge: 0.55 } };

/** The bark's painting repeats every BARK_V units along a tube (the cell's height; 16 texels a unit). */
const BARK_V = 8;

/**
 * A tube along a path of { p: [x, y, z], r, lobes? } rings, with smooth normals, and UVs for the
 * painted bark (M4b): u runs 0 → 2 once round (nAround = 2: the bark shader repeats the cell
 * mirrored, so u = 0 and u = 2 land on the same texel and the duplicated seam vertex shows no
 * seam); v is (v0 + the running distance between ring centres) / BARK_V. u starts on the camera's
 * right silhouette at the tube's middle ring (the direction square to the tube and the view), so
 * the two mirror lines round the tube fall on its silhouettes, not down its lit front. The start
 * is one angle for the whole tube, so u follows the mesh's own edges ring to ring (no twist, no
 * quad sweeping a repeat). Returns each ring's v0 + arc (the branches start from the trunk's). The
 * colours and their 3 rand() calls per ring are M4a's.
 */
function tube(geo, path, sides, g, rand, v0 = 0) {
  const frame = (i) => {
    const a = path[Math.max(0, i - 1)].p;
    const b = path[Math.min(path.length - 1, i + 1)].p;
    const T = norm(sub(b, a));
    const ref = Math.abs(T[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const N = norm(cross(ref, T));
    return { T, N, B: cross(T, N) };
  };
  const mid = frame(path.length >> 1);
  const S = cross(mid.T, BACK);
  const start = Math.atan2(dot(S, mid.B), dot(S, mid.N));
  let arc = v0;
  const arcs = [];
  const rings = path.map((node, i) => {
    const { N, B } = frame(i);
    const shade = mix3(BARK_DARK, node.p[1] > 3 ? BARK_HI : BARK, Math.min(1, Math.max(0, node.p[1] / 6))).map((v) => v * (0.85 + rand() * 0.3));
    if (i > 0) arc += hyp(node.p[0] - path[i - 1].p[0], node.p[1] - path[i - 1].p[1], node.p[2] - path[i - 1].p[2]);
    arcs.push(arc);
    const pts = [];
    for (let s = 0; s <= sides; s++) {
      const ang = ((s % sides) / sides) * 2 * Math.PI;
      const lobe = node.lobes ? node.lobes(ang) : 1;
      const d = [N[0] * Math.cos(ang) + B[0] * Math.sin(ang), N[1] * Math.cos(ang) + B[1] * Math.sin(ang), N[2] * Math.cos(ang) + B[2] * Math.sin(ang)];
      const u = [((s / sides) * 2 * Math.PI - start) / Math.PI, arc / BARK_V];
      pts.push({ p: [node.p[0] + d[0] * node.r * lobe, node.p[1] + d[1] * node.r * lobe, node.p[2] + d[2] * node.r * lobe], n: d, c: shade, u });
    }
    return pts;
  });
  for (let i = 0; i + 1 < rings.length; i++)
    for (let s = 0; s < sides; s++) {
      const a = rings[i][s];
      const b = rings[i][s + 1];
      const c = rings[i + 1][s + 1];
      const d = rings[i + 1][s];
      geo.triN(a.p, b.p, c.p, a.n, b.n, c.n, a.c, b.c, c.c, g, a.u, b.u, c.u);
      geo.triN(a.p, c.p, d.p, a.n, c.n, d.n, a.c, c.c, d.c, g, a.u, c.u, d.u);
    }
  return arcs;
}

/** Every trunk, forked and flared, with branches into the lower canopy: one merged mesh (group per tree). */
export function buildTrunkGeo(L, rng) {
  const geo = new Geo({ group: true, uv: true });
  for (const [ti, t] of L.trees.entries()) {
    const rand = rng(t.seed);
    // Each tree's bark starts at its own place in the repeat (a hash, no rand()), so the trees'
    // mirror lines do not stand at one height.
    const v0 = hash01(ti + 9001) * 2 * BARK_V;
    const x0 = t.x;
    const z0 = t.y;
    const dx = t.topX - x0;
    const dz = t.topY - z0;
    const ph = rand() * 6.28;
    const flare = (ang) => 1 + ((t.flare - t.base) / t.base) * Math.pow(0.5 + 0.5 * Math.cos(5 * ang + ph), 2);
    const half = (ang) => 1 + 0.45 * ((t.flare - t.base) / t.base) * Math.pow(0.5 + 0.5 * Math.cos(5 * ang + ph), 2);
    const H = t.fork;
    const along = (y) => {
      const u = Math.min(1, Math.max(0, y / H));
      return [x0 + dx * Math.pow(u, 1.5) + Math.sin(u * 5 + ph) * 0.25, y, z0 + dz * Math.pow(u, 1.5) + Math.cos(u * 4 + ph) * 0.25];
    };
    if (t.kind === "conifer") {
      tube(geo, [{ p: [x0, -0.6, z0], r: t.base, lobes: flare }, { p: [x0, 1, z0], r: t.base * 1.1 }, { p: [x0, 7, z0], r: t.base * 0.7 }], 7, t.group, rand, v0);
      continue;
    }
    const path = [{ p: along(-0.6), r: t.base, lobes: flare }, { p: along(0.5), r: t.base, lobes: half }, { p: along(2), r: t.base * 1.12 }];
    for (let y = 5; y < H; y += 4) path.push({ p: along(y), r: t.base * (1.05 - 0.3 * (y / H)) });
    const top = along(H);
    path.push({ p: top, r: t.base * 0.72 });
    const trunkArcs = tube(geo, path, t.kind === "round" ? 8 : 10, t.group, rand, v0);
    const vTop = trunkArcs[trunkArcs.length - 1];
    // The fork: two or three branches up and out into the canopy, and thin twigs off them that
    // show through the canopy's gaps (V27).
    const nb = t.kind === "round" ? 3 : 2 + (rand() < 0.5 ? 1 : 0);
    const reach = t.canopy.ry ?? 12;
    for (let k = 0; k < nb; k++) {
      const az = ph + (k / nb) * 2 * Math.PI + (rand() - 0.5) * 0.6;
      const out = 0.45 + rand() * 0.35;
      const dir = norm([Math.cos(az) * out, 1, Math.sin(az) * out]);
      const len = reach * (0.6 + rand() * 0.3);
      const pts = [];
      for (let i = 0; i <= 3; i++) {
        const u = i / 3;
        pts.push({ p: [top[0] + dir[0] * len * u + Math.cos(az) * u * u * 2, top[1] + dir[1] * len * u, top[2] + dir[2] * len * u + Math.sin(az) * u * u * 2], r: t.base * (0.62 - 0.42 * u) });
      }
      const branchArcs = tube(geo, pts, 7, t.group, rand, vTop);
      const mid = pts[1].p;
      const tw = norm([Math.cos(az + 0.9) * 1.2, 0.35, Math.sin(az + 0.9) * 1.2]);
      const tl = 5 + rand() * 3;
      tube(geo, [{ p: mid, r: 0.4 }, { p: [mid[0] + tw[0] * tl * 0.5, mid[1] + tw[1] * tl * 0.5, mid[2] + tw[2] * tl * 0.5], r: 0.28 }, { p: [mid[0] + tw[0] * tl, mid[1] + tw[1] * tl + 1, mid[2] + tw[2] * tl], r: 0.15 }], 5, t.group, rand, branchArcs[1]);
    }
  }
  return geo.build();
}

// --- lanterns (4.9) ----------------------------------------------------------------------------------------

const WOOD = lin(0x21120e);
/**
 * The iron's shade (M4b step 7 fix): the plinth, head posts and rails. Under the body's fill
 * (LANTERN_LIGHT, set so the post's #21120e wood lands on V34's #21120e) M4a's #171410 iron came
 * out #1d1912-#1e1a12 on the L1 plinth, where V34 has #171410 (the target's own plinth about
 * #151313): the plinth's faces catch more of the fill than the post's. 0.68 of it in linear light
 * lands it there, flat (the albedo) and painted (the vertex colour; the cell keeps #171410's mean).
 */
export const LANTERN_IRON_SHADE = 0.68;
const IRON = mul3(lin(0x171410), LANTERN_IRON_SHADE);
// The flat build's gold (the painted build paints it and keys its glow from the painting). M4a's
// #8a5528 rendered a copper tray and roof (#d1722c, #ff9040 at the top); step 7's #593518 still
// gave the tray a median #894a1c-#b36422, against the target tray's #5b2f13 (docs/refs/3d-target.jpg,
// V34: dark wood, its bevels gold-lit). #39200c lands the flat tray's median there.
const TRIM = lin(0x39200c);
// The flat roof's colour (step 7 fix; lanternGeo): the wood's.
const ROOF = WOOD;
const ONE = [1, 1, 1];

/**
 * The lantern's painted cell (M4b design step 7, critique #7): its regions as [x, y, w, h] texels
 * of the 256 × 256 cell, v down. tools/3d/cuts.py LANTERN_UV builds the cell from the same table
 * (tools/test.mjs checks they agree). Every edge is on the 8-texel grid (the cell sits on it in the
 * atlas too), the regions lie at least 8 texels apart, and the gaps between them hold wood or iron
 * only, never gold (cuts.py fills each from its nearest dark texel; tools/test.mjs checks the
 * cell), so every 8-aligned block is one material and the mip levels the runtime reads (capped at
 * 3: 8-texel blocks) never average wood and gold into one texel.
 *   post  stiles, rails and the recessed core, projected over the whole post per face, so the
 *         9-slice's borders (8 and 14 texels) fall on the 0.8-unit stiles and the 1.4-unit rails
 *   iron  plinth, head posts and rails, the tray's top; a face spans min(1, extent / 6.4) of it
 *   gold  the tray's lip, the roof's lip, the finial (from its top row: the lit bevel's 4 rows,
 *         then shade), and the tray's sides from row 8 (the shade only); spans as the iron's
 *   roof  one hip-roof facet: apex → (192, 4), its left corner (as seen) → (130, 94), its right → (254, 94)
 */
export const LANTERN_UV = { post: [0, 0, 48, 224], iron: [56, 0, 64, 64], gold: [56, 72, 64, 24], roof: [128, 0, 128, 96] };
export const LANTERN_CELL = 256;
const LANT_TPU = 10; // iron and gold texels per world unit (64 texels = 6.4 units)
/**
 * The gold's glow key: smoothstep over a texel's linear luminance (critique #7). The painted gold
 * is the GOLD palette, one family: #954b12 0.115, #b47139 0.218, #e6a127 0.425, #fcd349 0.678, so
 * every gold texel is fully keyed (its glow then scales with its own colour, the dark gold glowing
 * least); the wood and iron ramps (M4a's #21120e and #171410 × 0.55–1.83) stay under 0.02, fully
 * off. tools/test.mjs checks both against the cell's palettes.
 */
export const LANTERN_GLOW = [0.03, 0.09];
/**
 * How the lantern's body takes the light, painted or flat (M4a baseline, fixed at M4b step 7): it
 * is left out of its own flame's term (PAINT_NOLANT, 4.9), and in the sun's shade the teal sky
 * alone left its #21120e wood and #171410 iron pure black (#000000 on screen), where the target's
 * posts read those very colours (V34). A warm flat fill (the flame's spill down the post and the
 * garden's bounce), linear irradiance, lands them there.
 */
export const LANTERN_LIGHT = { fill: [6.4, 5.2, 5.2] };

/** A point's coordinates on an axis-aligned face as seen from outside: [right, down]. */
function faceAB(p, n) {
  if (n[0]) return [n[0] > 0 ? -p[2] : p[2], -p[1]];
  if (n[2]) return [n[2] > 0 ? p[0] : -p[0], -p[1]];
  return [p[0], n[1] > 0 ? p[2] : -p[2]];
}

/**
 * One lantern, square in plan with its sides on the world axes (so a corner points at the camera), 36 tall.
 * `paint`: the painted build (M4b) — UVs into the lantern cell (LANTERN_UV) and white vertex colours
 * (0.65 on the post's recessed core and LANTERN_IRON_SHADE on the iron, as the flat build's shades),
 * the painting giving the colours. The flat build (no UVs) has M4a's triangles and normals to the
 * bit; its colours are step 7's (the iron's shade, the darker TRIM, the roof WOOD to the apex).
 */
export function lanternGeo({ paint = false } = {}) {
  const g = new Geo({ uv: paint });
  const Lt = LANTERN;
  const R = LANTERN_UV;
  const S = LANTERN_CELL;
  const CORE = [0.65, 0.65, 0.65]; // the painted post core's shade (the flat build's WOOD × 0.65)
  const IRON_K = [LANTERN_IRON_SHADE, LANTERN_IRON_SHADE, LANTERN_IRON_SHADE];
  const col = (c) => (!paint || c === CORE ? c : c === IRON ? IRON_K : ONE);
  // A box face's UV in a region: its [right, down] extent laid from the region's top-left corner,
  // spanning min(1, extent / 6.4) of it, half a texel in from every edge.
  // "goldShade": the gold region below its lit bevel (rows 8 on, the shade's #954b12; cuts.py
  // LANTERN_GOLD_ROWS), for the tray's sides: the lip above them is the bevel (V34).
  const regionUV = (region, a, b, a0, a1, b0, b1, fit = false) => {
    const [X, Y, W, H] = region === "goldShade" ? [R.gold[0], R.gold[1] + 8, R.gold[2], R.gold[3] - 8] : R[region];
    const sa = fit ? W : Math.max(1, Math.min(W, (a1 - a0) * LANT_TPU));
    const sb = fit ? H : Math.max(1, Math.min(H, (b1 - b0) * LANT_TPU));
    const fa = a1 > a0 ? (a - a0) / (a1 - a0) : 0;
    const fb = b1 > b0 ? (b - b0) / (b1 - b0) : 0;
    return [(X + 0.5 + fa * (sa - 1)) / S, (Y + 0.5 + fb * (sb - 1)) / S];
  };
  const corners = (x0, y0, z0, x1, y1, z1) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
  const range = (pts, n) => {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const q of pts) {
      const [a, b] = faceAB(q, n);
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    return [a0, a1, b0, b1];
  };
  // `region(n)`: the region a face with normal n takes; `over`: the box whose extents it spans (the post's pieces span the whole post).
  const boxUV = (region, pts, over = pts) => (p, n) => {
    const reg = typeof region === "function" ? region(n) : region;
    const [a, b] = faceAB(p, n);
    const r = range(over, n);
    return reg === "post" && n[1] ? postTopUV(a, b, r) : regionUV(reg, a, b, ...r, reg === "post");
  };
  // A rail's top or bottom (the bottom rail's ledge shows): the rail band of the 9-slice, across the post.
  const postTopUV = (a, b, [a0, a1, b0, b1]) => {
    const [X, Y, W] = R.post;
    return [(X + 0.5 + ((a - a0) / (a1 - a0)) * (W - 1)) / S, (Y + 0.5 + ((b - b0) / (b1 - b0)) * 13) / S];
  };
  const box = (x0, y0, z0, x1, y1, z1, c, region, over) => {
    const pts = corners(x0, y0, z0, x1, y1, z1);
    aabb(g, x0, y0, z0, x1, y1, z1, typeof c === "function" ? (n) => col(c(n)) : col(c), 0, paint ? boxUV(region, pts, over) : null);
  };
  const sq = (h, y0, y1, c, region, over) => box(-h, y0, -h, h, y1, h, c, region, over);
  // A stepped plinth, 7 × 7 × 2.5 in two steps.
  sq(Lt.plinth / 2, 0, 1.25, IRON, "iron");
  sq(Lt.plinth / 2 - 0.6, 1.25, Lt.plinthH, IRON, "iron");
  // The post, 5 × 5 × 22, with a 0.4-deep recessed panel on each face: a core, corner stiles, rails.
  const p0 = Lt.plinthH;
  const p1 = p0 + Lt.postH;
  const h = Lt.post / 2;
  const post = corners(-h, p0, -h, h, p1, h);
  sq(h - 0.4, p0, p1, paint ? CORE : mul3(WOOD, 0.65), "post", post);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) box(sx > 0 ? h - 0.8 : -h, p0, sz > 0 ? h - 0.8 : -h, sx > 0 ? h : -h + 0.8, p1, sz > 0 ? h : -h + 0.8, WOOD, "post", post);
  sq(h, p0, p0 + 1.4, WOOD, "post", post);
  sq(h, p1 - 1.4, p1, WOOD, "post", post);
  // The tray, 8 × 8 × 1, with a 0.5 lip.
  const t0 = p1;
  const t1 = t0 + Lt.trayH;
  const th = Lt.tray / 2;
  sq(th, t0, t1, (n) => (n[1] ? IRON : TRIM), (n) => (n[1] ? "iron" : "goldShade"));
  box(-th, t1, -th, th, t1 + 0.5, -th + 0.4, TRIM, "gold");
  box(-th, t1, th - 0.4, th, t1 + 0.5, th, TRIM, "gold");
  box(-th, t1, -th + 0.4, -th + 0.4, t1 + 0.5, th - 0.4, TRIM, "gold");
  box(th - 0.4, t1, -th + 0.4, th, t1 + 0.5, th - 0.4, TRIM, "gold");
  // The glass head, 6.5 on a side: corner posts 0.8 and a frame top and bottom (the panes are their own mesh).
  const hy0 = t1;
  const hy1 = hy0 + Lt.head;
  const hh = Lt.head / 2;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) box(sx > 0 ? hh - 0.8 : -hh, hy0, sz > 0 ? hh - 0.8 : -hh, sx > 0 ? hh : -hh + 0.8, hy1, sz > 0 ? hh : -hh + 0.8, IRON, "iron");
  for (const [y0, y1] of [[hy0, hy0 + 0.5], [hy1 - 0.5, hy1]]) {
    box(-hh, y0, -hh, hh, y1, -hh + 0.5, IRON, "iron");
    box(-hh, y0, hh - 0.5, hh, y1, hh, IRON, "iron");
    box(-hh, y0, -hh + 0.5, -hh + 0.5, y1, hh - 0.5, IRON, "iron");
    box(hh - 0.5, y0, -hh + 0.5, hh, y1, hh - 0.5, IRON, "iron");
  }
  // A pyramid hip roof overhanging to 9 × 9, with a lip, and a finial.
  const rh = Lt.roof / 2;
  sq(rh, hy1, hy1 + 0.5, TRIM, "gold");
  const apex = [0, hy1 + Lt.roofH, 0];
  const base = [[-rh, hy1 + 0.5, -rh], [rh, hy1 + 0.5, -rh], [rh, hy1 + 0.5, rh], [-rh, hy1 + 0.5, rh]];
  const inside = [0, hy1 + 1, 0];
  // Seen from outside, base[i] is a facet's right corner and base[i + 1] its left (the painting's left facet, not mirrored).
  const [RX, RY] = R.roof;
  const roofUV = (i) => (p) => (p === apex ? [(RX + 64) / S, (RY + 4) / S] : p === base[i] ? [(RX + 126) / S, (RY + 94) / S] : [(RX + 2) / S, (RY + 94) / S]);
  // The flat roof is WOOD to the apex (step 7 fix): M4a's TRIM × 1.2 at the apex shaded it up to a
  // flat mid-brown slab (median #5b3114) against the target's dark roof (about #3a2418, V34) and
  // the painted one's #3d2214, whose wood keeps WOOD's mean. The painted roof's gold is its hips
  // (cuts.py LANTERN_HIP), which a flat colour cannot draw.
  for (let i = 0; i < 4; i++) g.tri(base[i], base[(i + 1) % 4], apex, col(ROOF), col(ROOF), col(ROOF), 0, inside, paint ? roofUV(i) : null);
  const f0 = hy1 + Lt.roofH - 0.5;
  box(-0.45, f0, -0.45, 0.45, f0 + 0.5, 0.45, TRIM, "gold");
  const fa = [0, Lt.height, 0];
  const fb = [[-0.45, f0 + 0.5, -0.45], [0.45, f0 + 0.5, -0.45], [0.45, f0 + 0.5, 0.45], [-0.45, f0 + 0.5, 0.45]];
  const [GX, GY] = R.gold;
  // The finial's facets take the gold's lit bevel only (rows 0-3; step 7 fix): down to row 12 they
  // were mostly the shade's #954b12, a dark stub on the roof where V34's finial is gold-lit.
  const finUV = (i) => (p) => (p === fa ? [(GX + 5) / S, (GY + 0.5) / S] : p === fb[i] ? [(GX + 9.5) / S, (GY + 3.5) / S] : [(GX + 0.5) / S, (GY + 3.5) / S]);
  for (let i = 0; i < 4; i++) g.tri(fb[i], fb[(i + 1) % 4], fa, col(TRIM), col(TRIM), col(TRIM), 0, [0, f0 + 0.6, 0], paint ? finUV(i) : null);
  return g.build();
}

/**
 * The painted lantern's material patch (design step 7): the cell's box maps the unit UVs, read with
 * the texel gradient capped at mip level 3 (8 atlas texels; the regions are 8 apart on the 8-texel
 * grid with dark-only gaps, so no level read mixes wood and gold), the texel is the albedo (vertex
 * colours white but for the post core's and the iron's shades), and
 * the painted gold glows: texel × LANTERN_GLOW key × its lantern's flicker × uGlowK × (luminance /
 * 0.115)^uGlowPow, added as emission. The flicker is the shared per-lantern array (arena3d.js `flick`, the flames' own, by
 * the `aLant` instance attribute), never uLant.w, which Low zeroes for the far lanterns.
 *
 * The GOLD values are V34's gold as seen, lit by the flame, not an albedo: under the body's fill
 * (LANTERN_LIGHT, which lands the wood on V34's #21120e) the gold as a plain albedo came out
 * #d47a2e with a blown-out #ffff61 top against the target tray's #653012 / #d48e27. So a gold
 * texel reflects only `goldLit` of the light and its look is mostly its glow, which flickers.
 * `glowK` is the darkest gold's (#954b12, linear luminance 0.115) glow; a lighter texel glows by
 * (its luminance / 0.115)^glowPow more, so the bevels stand out of the shade as in the target
 * (the tray's median #5b2f13 against its p90 #c57e2a, 5.4× in linear red, where the palette alone
 * spans 3.2×). With goldLit 0.12, glowK 0.22 and no power the tray was a solid glowing band
 * (median #a15f1b); these land the L1 tray at median #572e0b, p90 #c38724 (target-garden). The
 * fill (LANTERN_LIGHT) would light a gold texel as much as its glow does, so goldLit is small.
 */
const LANTERN_GOLD_LOOK = { goldLit: 0.005, glowK: 0.105, glowPow: 1.5 };
export function lanternPaint(mat, box, flick, { size = 1024 } = {}) {
  const own = { uLantBox: { value: box }, uFlick: { value: flick }, uGlowK: { value: LANTERN_GOLD_LOOK.glowK }, uGoldLit: { value: LANTERN_GOLD_LOOK.goldLit }, uGlowPow: { value: LANTERN_GOLD_LOOK.glowPow }, uLantGrad: { value: 8 / size } };
  mat.userData.lantern = own;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, own);
  };
  const [lo, hi] = LANTERN_GLOW.map((v) => v.toFixed(4));
  return patchPaint(mat, `paint:lantern:${flick.length}`, {
    vert: [
      ["#include <common>", "#include <common>\nattribute float aLant;\nvarying float vLant;\nuniform vec4 uLantBox;"],
      ["#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = uLantBox.xy + uv * uLantBox.zw;\nvLant = aLant;"],
    ],
    frag: [
      ["#include <common>", `#include <common>\nvarying float vLant;\nuniform float uFlick[${flick.length}];\nuniform float uGlowK;\nuniform float uGoldLit;\nuniform float uGlowPow;\nuniform float uLantGrad;`],
      [
        "#include <map_fragment>",
        `vec4 lantTexel = vec4(0.0);
         float lantKey = 0.0;
         float lantLum = 0.115;
         #ifdef USE_MAP
         {
           vec2 gx = dFdx(vMapUv);
           vec2 gy = dFdy(vMapUv);
           gx *= min(1.0, uLantGrad / max(length(gx), 1e-9));
           gy *= min(1.0, uLantGrad / max(length(gy), 1e-9));
           lantTexel = textureGrad(map, vMapUv, gx, gy);
           lantLum = dot(lantTexel.rgb, vec3(0.2126, 0.7152, 0.0722));
           lantKey = smoothstep(${lo}, ${hi}, lantLum);
           diffuseColor.rgb *= lantTexel.rgb * mix(1.0, uGoldLit, lantKey);
         }
         #endif`,
      ],
      [
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += lantTexel.rgb * lantKey * uFlick[int(vLant + 0.5)] * uGlowK * pow(max(lantLum, 1e-4) / 0.115, uGlowPow);`,
      ],
    ],
  });
}

/** The lantern's outline hull: its silhouette as a few closed boxes. */
export function lanternHullGeo() {
  const g = new Geo();
  const Lt = LANTERN;
  const sq = (h, y0, y1) => hullBox(g, -h, y0, -h, h, y1, h);
  sq(Lt.plinth / 2, 0, Lt.plinthH);
  sq(Lt.post / 2, Lt.plinthH, Lt.plinthH + Lt.postH);
  const t0 = Lt.plinthH + Lt.postH;
  sq(Lt.tray / 2, t0, t0 + Lt.trayH + 0.5);
  sq(Lt.head / 2, t0 + Lt.trayH, t0 + Lt.trayH + Lt.head);
  const r0 = t0 + Lt.trayH + Lt.head;
  sq(Lt.roof / 2, r0, r0 + 0.5);
  // The roof pyramid: the apex's normal points up, the eaves' out and down.
  const rh = Lt.roof / 2;
  const apex = [0, r0 + Lt.roofH, 0];
  const base = [[-rh, r0 + 0.5, -rh], [rh, r0 + 0.5, -rh], [rh, r0 + 0.5, rh], [-rh, r0 + 0.5, rh]];
  const k = [0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const a = base[i];
    const b = base[(i + 1) % 4];
    g.triN(a, b, apex, norm([a[0], 0.3, a[2]]), norm([b[0], 0.3, b[2]]), [0, 1, 0], k);
  }
  hullBox(g, -0.45, r0 + Lt.roofH - 0.5, -0.45, 0.45, Lt.height, 0.45);
  return g.build();
}

// Flames: tongue cards facing the camera, drawn opaque (alpha-cut) and emissive; the amber panes
// are drawn after them, additively and without writing depth, so the flame shows through both
// visible panes (4.9). Both carry the fade group of their lantern.
const FADE_GLSL = /* glsl */ `
  uniform int uFadeMask;
  uniform int uFadeMode;
  uniform sampler2D tSceneDepth;
  uniform vec2 uFadeTex;
  uniform float uFadeA[17];
  varying float vGroup;
  float fadeA() { return uFadeMode == 1 ? uFadeA[int(vGroup + 0.5)] : 1.0; }
  bool faded() {
    int g = int(vGroup + 0.5);
    bool f = g > 0 && ((uFadeMask >> g) & 1) == 1;
    // The fade layer draws a prop only where it is in front of what the main pass drew there.
    if (uFadeMode == 1 && f && texture2D(tSceneDepth, gl_FragCoord.xy / uFadeTex).r < gl_FragCoord.z) return true;
    return (uFadeMode == 0 && f) || (uFadeMode == 1 && !f);
  }
`;
const FLAME_VERT = /* glsl */ `
  attribute float aLant;
  attribute float aGroup;
  attribute float aPhase;
  uniform float uTime;
  uniform float uFlick[8];
  varying vec2 vUv;
  varying float vF;
  varying float vGroup;
  varying float vPh;
  void main() {
    vUv = uv;
    vF = uFlick[int(aLant + 0.5)];
    vGroup = aGroup;
    vPh = aPhase;
    vec3 p = position;
    // The tip wavers along screen right; the base stays on the wick.
    float w = sin(uTime * 7.1 + aPhase * 6.0) * 0.22 + sin(uTime * 12.7 + aPhase * 2.3) * 0.1;
    p += vec3(0.7071, 0.0, -0.7071) * w * uv.y * uv.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uBody;
  varying vec2 vUv;
  varying float vF;
  varying float vPh;
  ${FADE_GLSL}
  void main() {
    if (faded()) discard;
    float y = vUv.y;
    float x = vUv.x * 2.0 - 1.0 + 0.16 * y * sin(y * 7.0 - uTime * 9.0 + vPh * 5.0);
    float w = 1.75 * sqrt(max(y, 0.0)) * pow(max(1.0 - y, 0.0), 1.1) * (0.92 + 0.12 * vF);
    float a = abs(x) / max(w, 1e-3);
    if (a > 1.0 || y > 0.98) discard;
    vec3 c = a < 0.42 && y < 0.62 ? uCore : a < 0.75 ? uMid : uBody;
    gl_FragColor = vec4(c * (0.85 + 0.3 * vF), fadeA());
  }
`;
const PANE_VERT = /* glsl */ `
  attribute float aLant;
  attribute float aGroup;
  uniform float uFlick[8];
  varying vec2 vUv;
  varying float vF;
  varying float vGroup;
  void main() {
    vUv = uv;
    vF = uFlick[int(aLant + 0.5)];
    vGroup = aGroup;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;
const PANE_FRAG = /* glsl */ `
  uniform vec3 uAmberLo;
  uniform vec3 uAmberHi;
  varying vec2 vUv;
  varying float vF;
  ${FADE_GLSL}
  void main() {
    if (faded()) discard;
    // Brighter towards the flame, in the middle of the pane.
    vec2 d = (vUv - vec2(0.5, 0.45)) * vec2(1.6, 1.2);
    float glow = clamp(1.0 - length(d), 0.0, 1.0);
    gl_FragColor = vec4(mix(uAmberLo, uAmberHi, glow) * (0.55 + 0.45 * glow) * vF * 0.9, 1.0);
  }
`;

/** Flame cards and amber panes for every lantern, merged: { flameGeo, paneGeo }. */
export function lanternLightGeos(L, rand) {
  const flame = new Geo({ uv: true });
  const pane = new Geo({ uv: true });
  const fl = { lant: [], grp: [], ph: [] };
  const pl = { lant: [], grp: [] };
  const R = RIGHT; // screen right, as a world direction
  const n0 = [0, 0, 0];
  L.lanterns.forEach((l, i) => {
    const c = [l.x, l.flame, l.y];
    // Three tongues: a tall one in the middle, two smaller either side, slightly behind. G3 fix: the
    // head's corner post stands between the camera and the flame (V34: a corner points at the
    // camera), and M4a's tongues (2.7 units across) showed only as one bright slit either side of
    // it, two eyes in a dark head; wide enough now to fill both visible panes with fire as painted.
    for (const [off, w, hgt, y0] of [[0, 4.4, 5.1, -2.3], [-1.35, 2.8, 3.8, -2.0], [1.4, 2.7, 3.6, -2.1]]) {
      const ph = rand();
      const o = [c[0] + R[0] * off - 0.2 * Math.abs(off), c[1] + y0, c[2] + R[2] * off - 0.2 * Math.abs(off)];
      const P = (u, v) => [o[0] + R[0] * (u - 0.5) * w, o[1] + v * hgt, o[2] + R[2] * (u - 0.5) * w];
      const k = [1, 1, 1];
      flame.triN(P(0, 0), P(1, 0), P(1, 1), n0, n0, n0, k, k, k, 0, [0, 0], [1, 0], [1, 1]);
      flame.triN(P(0, 0), P(1, 1), P(0, 1), n0, n0, n0, k, k, k, 0, [0, 0], [1, 1], [0, 1]);
      for (let v = 0; v < 6; v++) (fl.lant.push(i), fl.grp.push(l.group), fl.ph.push(ph));
    }
    // Four panes between the corner posts, just inside the frame.
    const hh = LANTERN.head / 2 - 0.25;
    const y0 = LANTERN.plinthH + LANTERN.postH + LANTERN.trayH + 0.5;
    const y1 = y0 + LANTERN.head - 1;
    const w = LANTERN.head / 2 - 0.8;
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = l.x + ax * hh;
      const cz = l.y + az * hh;
      const tx = az;
      const tz = -ax;
      const P = (u, v) => [cx + tx * (u - 0.5) * 2 * w, v, cz + tz * (u - 0.5) * 2 * w];
      const k = [1, 1, 1];
      const nn = [ax, 0, az];
      pane.triN(P(0, y0), P(1, y0), P(1, y1), nn, nn, nn, k, k, k, 0, [0, 0], [1, 0], [1, 1]);
      pane.triN(P(0, y0), P(1, y1), P(0, y1), nn, nn, nn, k, k, k, 0, [0, 0], [1, 1], [0, 1]);
      for (let v = 0; v < 6; v++) (pl.lant.push(i), pl.grp.push(l.group));
    }
  });
  const flameGeo = flame.build();
  flameGeo.setAttribute("aLant", new Float32BufferAttribute(fl.lant, 1));
  flameGeo.setAttribute("aGroup", new Float32BufferAttribute(fl.grp, 1));
  flameGeo.setAttribute("aPhase", new Float32BufferAttribute(fl.ph, 1));
  const paneGeo = pane.build();
  paneGeo.setAttribute("aLant", new Float32BufferAttribute(pl.lant, 1));
  paneGeo.setAttribute("aGroup", new Float32BufferAttribute(pl.grp, 1));
  return { flameGeo, paneGeo };
}

/** The flame and pane materials; `flick` is the shared per-lantern flicker array (length 8). */
export function lanternLightMaterials(look, flick) {
  const shared = { uFadeMask: look.uFadeMask, uFadeMode: look.uFadeMode, tSceneDepth: look.tSceneDepth, uFadeTex: look.uFadeTex, uFadeA: look.uFadeA, uFlick: { value: flick }, uTime: { value: 0 } };
  const flame = new ShaderMaterial({
    uniforms: { ...shared, uCore: { value: new Color(0xfbf2a8) }, uMid: { value: new Color(0xfcd349) }, uBody: { value: new Color(0xe99b2b) } },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    toneMapped: false,
  });
  const pane = new ShaderMaterial({
    uniforms: { ...shared, uAmberLo: { value: new Color(0x954b12) }, uAmberHi: { value: new Color(0xd07b26) } },
    vertexShader: PANE_VERT,
    fragmentShader: PANE_FRAG,
    transparent: true,
    depthWrite: false,
    // Added light that leaves alpha alone: on the fade layer the pane then fades with its lantern
    // instead of lifting that layer's alpha to full.
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    toneMapped: false,
  });
  return { flame, pane, time: shared.uTime };
}

// --- apples (4.7) ---------------------------------------------------------------------------------------

const APPLE_R = 2.25;
/** The flat apple (M4a) and every apple's outline hull: a sphere. */
export function appleGeo() {
  return new SphereGeometry(APPLE_R, 10, 7);
}

/**
 * The apples' flat fill (paintMaterial `fill`, linear irradiance): in the target the apples stay
 * red all round (V27: #b11d34, shade #6f1125) where the sun term alone left each one's lower half
 * black under its canopy. About #6f1125 / #b11d34 of the albedo, in their shade.
 */
export const APPLE_FILL = [1.2, 1.1, 1.1];
/** The painted apple's atlas cells (M4b): its body, and the stem and leaf above it (plan 4.7). */
export const APPLE_CELLS = ["apple", "appleLeaf"];
/**
 * Where the painting lies on the apple (M4b step 6): small 37's boxes (tools/3d/cuts.py APPLE_BODY
 * and APPLE_LEAF, the cells stretched over them). The body box covers the sphere's outline as seen
 * from the camera, mirrored in u so the painting's upper-left glint lands upper right (4.7, V16);
 * the leaf box lies on a card above it on the same mapping, `depth` in front of the sphere's
 * middle, so its stem runs on into the body's stem where the two meet over the top edge.
 */
export const APPLE_PAINT = { body: [285, 290, 729, 712], leaf: [452, 148, 712, 304], depth: 1.2 };

/**
 * The painted apple: the sphere with its uv overwritten by the view projection (u = .5 − p·RIGHT /
 * 4.5, v = .5 − p·UP / 4.5; v down the painting), cell 0, plus the stem-and-leaf card facing the
 * camera, cell 1 (a float `aCell` per vertex, paint3d.js atlasCells). The sphere's positions,
 * normals and triangles are appleGeo's; the hull stays appleGeo, so the leaf has no outline.
 */
export function applePaintGeo() {
  const s = appleGeo();
  const sp = s.getAttribute("position").array;
  const sn = s.getAttribute("normal").array;
  const n = sp.length / 3;
  const pos = [...sp];
  const nor = [...sn];
  const uv = [];
  const cell = [];
  for (let i = 0; i < n; i++) {
    const p = [sp[3 * i], sp[3 * i + 1], sp[3 * i + 2]];
    uv.push(0.5 - dot(p, RIGHT) / (2 * APPLE_R), 0.5 - dot(p, UP) / (2 * APPLE_R));
    cell.push(0);
  }
  // The painting's x and y as screen offsets from the apple's middle (x mirrored), from the body box.
  const [bx0, by0, bx1, by1] = APPLE_PAINT.body;
  const sx = (x) => APPLE_R - (2 * APPLE_R * (x - bx0)) / (bx1 - bx0);
  const sy = (y) => APPLE_R - (2 * APPLE_R * (y - by0)) / (by1 - by0);
  const [lx0, ly0, lx1, ly1] = APPLE_PAINT.leaf;
  const d = APPLE_PAINT.depth;
  const at = (a, b) => [a * RIGHT[0] + b * UP[0] + d * BACK[0], a * RIGHT[1] + b * UP[1] + d * BACK[1], a * RIGHT[2] + b * UP[2] + d * BACK[2]];
  // Screen left is the painting's right (x1: u 1), screen top its top (y0: v 0).
  const corners = [
    [at(sx(lx1), sy(ly0)), [1, 0]],
    [at(sx(lx1), sy(ly1)), [1, 1]],
    [at(sx(lx0), sy(ly1)), [0, 1]],
    [at(sx(lx0), sy(ly0)), [0, 0]],
  ];
  for (const [p, t] of corners) {
    pos.push(...p);
    nor.push(...BACK);
    uv.push(...t);
    cell.push(1);
  }
  // RIGHT × UP = BACK, so screen-anticlockwise corners face the camera.
  const index = [...s.index.array, n, n + 1, n + 2, n, n + 2, n + 3];
  s.dispose();
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setAttribute("aCell", new Float32BufferAttribute(cell, 1));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * The painted apple's shadow twin: the sphere as the default depth material casts it, the leaf
 * card (cell 1) clipped away, so no card-shaped shadow falls however the sun is set.
 */
export function appleDepth() {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aCell;").replace("#include <project_vertex>", "#include <project_vertex>\nif (aCell > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);");
  };
  m.customProgramCacheKey = () => "appledepth";
  return m;
}

// --- clovers (4.5) ---------------------------------------------------------------------------------------

/**
 * The clover: three heart-shaped domed leaves, each a closed shell (a domed top and a flat
 * underside, so the outline hull has back faces to draw), tilted 15° towards the camera about its
 * own centre and lifted so its near edge touches the ground. Returns { geo, hull }: the same
 * shape, with shading normals and with hull normals (the rim's pointing straight out).
 *
 * The shaded shape also carries the painted leaf (M4b step 6): each leaf's uv lays one painted
 * heart leaf over it, its notch at the leaf's tip and its base, where the veins meet, at the
 * clover's middle (u across the leaf, v from the tip in; the top and the underside centres at
 * .5, .5), worked out before the tilt; and a cell id per vertex (CLOVER_CELLS): the right-hand
 * leaf takes cloverA, with V24's warm glints on its upper-right rim, the other two cloverB.
 */
export const CLOVER_CELLS = ["cloverA", "cloverB"];
export function cloverGeos() {
  const { leafR: R, leafD: D, dome, tilt } = CLOVER;
  const lift = R * Math.sin(tilt * DEG);
  const main = new Geo({ uv: true, cell: true });
  const hull = new Geo();
  // The dome's colours (painted: scaled by the leaf's texel over its mean). M4a's #4e8a33 #3a7228
  // #24501c #173812 drew bright lime pads, 1.5x the lawn beside C2 (focus 80,51), where the
  // target's C1 sits dark (median 0.9x its lawn, the lit tops about 1.3x, the near rims about
  // 0.2x): the tops are those scaled in linear light by (.58, .40, .88) — less green, as the
  // target's olive leaves — and the rim and underside by about half that again.
  const LIGHT = lin(0x3b5930);
  const MID = lin(0x2b4a25);
  const DARK = lin(0x112311);
  const UNDER = lin(0x071408);
  const k0 = [0, 0, 0];
  const up = [0, 1, 0];
  for (let k = 0; k < 3; k++) {
    // One leaf points up the screen (away from the camera), two towards its lower corners.
    const phi = (-135 + k * 120) * DEG;
    const c = [D * Math.cos(phi), lift, D * Math.sin(phi)];
    const tiltP = (p) => {
      const q = rotAxis(sub(p, c), RIGHT, tilt * DEG);
      return [q[0] + c[0], q[1] + c[1], q[2] + c[2]];
    };
    const tiltN = (n) => norm(rotAxis(n, RIGHT, tilt * DEG));
    // The painted leaf's frame: `out` from the clover's middle through the leaf, `side` across it.
    const out = [Math.cos(phi), 0, Math.sin(phi)];
    const side = [-Math.sin(phi), 0, Math.cos(phi)];
    const leafUV = (o) => [0.5 + (0.5 * dot(o, side)) / (1.035 * R), 0.5 - (0.5 * dot(o, out)) / (1.035 * R)];
    const cell = k === 1 ? 0 : 1;
    const rim = [];
    const inner = [];
    for (let j = 0; j < 12; j++) {
      let a = (j / 12) * 2 * Math.PI;
      const aw = a > Math.PI ? a - 2 * Math.PI : a;
      const rho = R * (1 - 0.3 * Math.exp(-((aw / 0.33) ** 2))) * (1 + 0.035 * Math.cos(6 * a));
      a += phi;
      const d = [Math.cos(a), 0, Math.sin(a)];
      rim.push({ p: tiltP([c[0] + d[0] * rho, c[1], c[2] + d[2] * rho]), n: tiltN([d[0] * 0.6, 1, d[2] * 0.6]), h: tiltN(d), u: leafUV(mul3(d, rho)) });
      inner.push({ p: tiltP([c[0] + d[0] * rho * 0.55, c[1] + dome * 0.7, c[2] + d[2] * rho * 0.55]), n: tiltN([d[0] * 0.3, 1, d[2] * 0.3]), h: tiltN([d[0] * 0.5, 1, d[2] * 0.5]), u: leafUV(mul3(d, rho * 0.55)) });
    }
    const mid = [0.5, 0.5];
    const top = { p: tiltP([c[0], c[1] + dome, c[2]]), n: tiltN(up), h: tiltN(up) };
    const bot = { p: tiltP([c[0], c[1] - 0.12, c[2]]), n: tiltN([0, -1, 0]), h: tiltN([0, -1, 0]) };
    for (let j = 0; j < 12; j++) {
      const a = inner[j];
      const b = inner[(j + 1) % 12];
      const ra = rim[j];
      const rb = rim[(j + 1) % 12];
      main.triN(top.p, a.p, b.p, top.n, a.n, b.n, LIGHT, MID, MID, 0, mid, a.u, b.u, cell);
      main.triN(a.p, ra.p, rb.p, a.n, ra.n, rb.n, MID, DARK, DARK, 0, a.u, ra.u, rb.u, cell);
      main.triN(a.p, rb.p, b.p, a.n, rb.n, b.n, MID, DARK, MID, 0, a.u, rb.u, b.u, cell);
      main.triN(bot.p, rb.p, ra.p, bot.n, bot.n, bot.n, UNDER, UNDER, UNDER, 0, mid, rb.u, ra.u, cell);
      hull.triN(top.p, a.p, b.p, top.h, a.h, b.h, k0);
      hull.triN(a.p, ra.p, rb.p, a.h, ra.h, rb.h, k0);
      hull.triN(a.p, rb.p, b.p, a.h, rb.h, b.h, k0);
      // The underside faces down; its hull normals too, so the hull's back faces close the rim.
      hull.triN(bot.p, rb.p, ra.p, bot.h, [rb.h[0], -0.3, rb.h[2]], [ra.h[0], -0.3, ra.h[2]], k0);
    }
  }
  return { geo: main.build(), hull: hull.build() };
}

// --- flowers and lupines (4.5) --------------------------------------------------------------------------

// The flower atlas, drawn by code: 4 × 2 cells of 32². Row 0: daisy, buttercup, cosmos, lupine
// floret. Row 1: leaf, lupine leaf, stem, spare. (Painted cells replace these in M4b.)
const FCELL = 32;
const FLOWER_GRID = { daisy: [0, 0], buttercup: [1, 0], cosmos: [2, 0], lupine: [3, 0], leaf: [0, 1], lupineLeaf: [1, 1], stem: [2, 1] };
/**
 * The flower heads' flat fill (paintMaterial `fill`, linear irradiance): in the target a daisy in a
 * tree's shade stays a warm light grey (petals #b3ad93 beside T0), a painted accent; the teal sky
 * alone left the heads there dark teal (#18463f), under the lawn's own shade; with this fill they
 * come out #b6b69d. Near white, so it barely warms a hue (a lupine's purple). Heads only: the
 * stems and leaves keep the lawn's shade.
 */
const FLOWER_FILL = [1.4, 1.3, 1.1];
/**
 * The painted cells the flowers name (paint3d.js FLOWER_CELLS) and the drawn cell each falls back
 * to: the two painted daisies share the drawn one.
 */
export const FLOWER_PROC = { stem: "stem", daisyA: "daisy", daisyB: "daisy", buttercup: "buttercup", cosmos: "cosmos", flowerLeaf: "leaf", lupineFloret: "lupine", lupineLeaf: "lupineLeaf" };
/**
 * A painted cell's box in the drawn atlas (u, v, width, height, as atlas.json's; the card's unit
 * uv is in painting coordinates, v down): the flat build's own UVs to the texel, (cx + .06 + .88u) / 4
 * across and (cy + .06 + .88 (1 − v)) / 2 up the atlas's rows.
 */
export function flowerBox(name) {
  const [cx, cy] = FLOWER_GRID[FLOWER_PROC[name]];
  return [(cx + 0.06) / 4, (cy + 0.94) / 2, 0.22, -0.44];
}

function flowerAtlas() {
  const W = FCELL * 4;
  const H = FCELL * 2;
  const data = new Uint8Array(W * H * 4);
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const cell = ([cx, cy], fn) => {
    for (let j = 0; j < FCELL; j++)
      for (let i = 0; i < FCELL; i++) {
        const u = ((i + 0.5) / FCELL) * 2 - 1;
        const v = ((j + 0.5) / FCELL) * 2 - 1;
        const c = fn(u, v, hyp(u, v), Math.atan2(v, u));
        if (!c) continue;
        const o = ((cy * FCELL + j) * W + cx * FCELL + i) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
  };
  cell(FLOWER_GRID.daisy, (u, v, r, a) => (r < 0.3 ? hex(r < 0.18 ? 0xe8b030 : 0xe0a020) : r < 0.94 && (Math.cos(6 * a) > -0.35 || r < 0.42) ? hex(r > 0.78 ? 0xd6d6c8 : 0xf0ece0) : null));
  cell(FLOWER_GRID.buttercup, (u, v, r, a) => (r < 0.24 ? hex(0xc88006) : r < 0.9 * (0.72 + 0.28 * Math.cos(5 * a)) ? hex(r > 0.6 ? 0xc88a10 : 0xe0a818) : null));
  cell(FLOWER_GRID.cosmos, (u, v, r, a) => (r < 0.22 ? hex(0xe0b030) : r < 0.95 * (0.66 + 0.34 * Math.abs(Math.cos(4 * a))) ? hex(r > 0.65 ? 0xd04060 : 0xe05a7a) : null));
  cell(FLOWER_GRID.lupine, (u, v) => {
    // Three pea flowers in a little cluster.
    for (const [cx, cy, rr, col] of [[-0.35, -0.2, 0.42, 0x8a58c8], [0.35, -0.15, 0.4, 0x9e6ad8], [0, 0.35, 0.44, 0xb48ae6]]) if (hyp(u - cx, v - cy) < rr) return hex(col);
    return null;
  });
  cell(FLOWER_GRID.leaf, (u, v) => {
    const t = (v + 1) / 2;
    const w = 0.55 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
    return Math.abs(u) < w ? hex(Math.abs(u) < 0.06 ? 0x5a8a34 : 0x3a6a24) : null;
  });
  cell(FLOWER_GRID.lupineLeaf, (u, v, r, a) => (r < 0.95 && r > 0.08 && Math.cos(5 * (a - 0.3)) > 0.7 - 0.5 * r ? hex(0x3f6e2a) : r < 0.12 ? hex(0x355e22) : null));
  cell(FLOWER_GRID.stem, () => hex(0x2f5a20));
  return cardAtlas(data, W, H);
}

/**
 * The flower card: a stem quad (part 0) facing the camera, a head card (part 1) lying flat but
 * tilted towards the camera, and a leaf card (part 2) at the root. The shader sizes each part per
 * instance (aFlower: head size, stem height, leaf size, stem width) and lays the head's and the
 * leaf's atlas cells over them (aHead, aLeaf: boxes), so one mesh draws daisies, buttercups,
 * cosmos and lupine florets. Its uv is a unit square in painting coordinates (v down): the
 * stem's whole cell (it samples the middle), and each card with the painting's top up the screen.
 */
export function flowerGeo() {
  const g = new Geo({ uv: true });
  const part = [];
  const R = RIGHT;
  const F = [Math.SQRT1_2, 0, Math.SQRT1_2]; // towards the camera, on the ground
  const tiltN = (n, ang) => norm(rotAxis(n, R, ang));
  const up = [0, 1, 0];
  const w = [1, 1, 1];
  // Stem: the middle of the stem cell (a solid colour).
  const S = (s, y) => [R[0] * s, y, R[2] * s];
  const st = [0.5, 0.5];
  g.triN(S(-0.5, 0), S(0.5, 0), S(0.5, 1), up, up, up, w, w, w, 0, st, st, st);
  g.triN(S(-0.5, 0), S(0.5, 1), S(-0.5, 1), up, up, up, w, w, w, 0, st, st, st);
  for (let i = 0; i < 6; i++) part.push(0);
  // A flat card of unit size, centred on `o`, tilted `ang` about screen right (far side up).
  const card = (o, ang, rot, p) => {
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const P = (u, v) => {
      const a = (u - 0.5) * cr - (v - 0.5) * sr;
      const b = (u - 0.5) * sr + (v - 0.5) * cr;
      // u runs along screen right, v up the screen (away from the camera).
      const q = rotAxis([R[0] * a - F[0] * b, 0, R[2] * a - F[2] * b], R, ang);
      return [o[0] + q[0], o[1] + q[1], o[2] + q[2]];
    };
    const n = tiltN(up, ang);
    const U = (u, v) => [u, 1 - v]; // the painting's top row up the screen
    g.triN(P(0, 0), P(1, 0), P(1, 1), n, n, n, w, w, w, 0, U(0, 0), U(1, 0), U(1, 1));
    g.triN(P(0, 0), P(1, 1), P(0, 1), n, n, n, w, w, w, 0, U(0, 0), U(1, 1), U(0, 1));
    for (let i = 0; i < 6; i++) part.push(p);
  };
  card([0, 0, 0], FLOWER_TILT * DEG, 0, 1);
  card([R[0] * 0.3 + F[0] * 0.1, 0.15, R[2] * 0.3 + F[2] * 0.1], 35 * DEG, 0.6, 2);
  const geo = g.build();
  geo.deleteAttribute("color");
  geo.setAttribute("aPart", new Float32BufferAttribute(part, 1));
  return geo;
}

/**
 * The flower material: the paint material with the per-instance sizing and atlas cells. Each part
 * lays its unit uv into a box (u, v, width, height): the stem into `stem` (a uniform), the head
 * and the leaf into their instance's aHead and aLeaf (see flowerBox). `atlas` is the garden's
 * painted atlas (M4b, its boxes from paint3d.js cellTable; the renderer's, shared, never freed
 * here), read at mip level 3 at most (`size` its width in texels): a flower is a few texels
 * across at the wide pull-back, and a deeper level would reach past a cell's 8-texel pad. With
 * no atlas, the drawn one (flowerAtlas) and its boxes: exactly the flat build.
 */
export function flowerMaterial(look, { atlas = null, stem = null, size = 1024 } = {}) {
  const map = atlas || flowerAtlas();
  const m = paintMaterial(look, { map, alphaTest: 0.5, wind: 1, flatten: true, group: true, fill: FLOWER_FILL });
  const own = { uStem: { value: new Vector4(...(stem || flowerBox("stem"))) }, uFlowerGrad: { value: 8 / size } };
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    Object.assign(sh.uniforms, own);
  };
  // The flat fill lights the heads only: the stems and leaves keep the lawn's shade.
  const headFill = ["reflectedLight.indirectDiffuse += uShadeFill * BRDF_Lambert(diffuseColor.rgb);", "reflectedLight.indirectDiffuse += uShadeFill * BRDF_Lambert(diffuseColor.rgb) * vFlowerHead;"];
  patchPaint(m, atlas ? "flower:paint" : "flower", {
    vert: [
      ["#include <common>", "#include <common>\nattribute float aPart;\nattribute vec4 aFlower;\nattribute vec4 aHead;\nattribute vec4 aLeaf;\nuniform vec4 uStem;\nvarying float vFlowerHead;"],
      [
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vFlowerHead = aPart > 0.5 && aPart < 1.5 ? 1.0 : 0.0;
         if (aPart < 0.5) { transformed.xz *= aFlower.w; transformed.y *= aFlower.y; }
         else if (aPart < 1.5) { transformed = transformed * aFlower.x + vec3(0.0, aFlower.y, 0.0); }
         else { transformed *= aFlower.z; }`,
      ],
      ["#include <uv_vertex>", "#include <uv_vertex>\n{ vec4 b = aPart > 1.5 ? aLeaf : (aPart > 0.5 ? aHead : uStem); vMapUv = b.xy + uv * b.zw; }"],
      WIND_BY_HEIGHT,
    ],
    frag: atlas
      ? [
          ["#include <common>", "#include <common>\nuniform float uFlowerGrad;\nvarying float vFlowerHead;"],
          headFill,
          [
            "#include <map_fragment>",
            `{
               vec2 gx = dFdx(vMapUv);
               vec2 gy = dFdy(vMapUv);
               gx *= min(1.0, uFlowerGrad / max(length(gx), 1e-9));
               gy *= min(1.0, uFlowerGrad / max(length(gy), 1e-9));
               diffuseColor *= textureGrad(map, vMapUv, gx, gy);
             }`,
          ],
        ]
      : [["#include <common>", "#include <common>\nvarying float vFlowerHead;"], headFill],
  });
  if (!atlas) m.addEventListener("dispose", () => map.dispose()); // only the drawn atlas is ours
  return m;
}

/**
 * The flower instances: the scattered flowers, then the lupines (4.5): a spike of florets on one
 * stem, big five-finger leaves at the foot. Returns { list: [x, y, z, yaw], flower, head, leaf,
 * group }: `head` and `leaf` name each instance's painted cells (paint3d.js FLOWER_CELLS; the
 * daisies take daisyA and daisyB by turns); flowerBox gives the drawn fallback's.
 */
export function flowerInstances(L, scat, rand) {
  const list = [];
  const flower = [];
  const head = [];
  const leaf = [];
  const group = [];
  let daisies = 0;
  for (const f of scat.flowers) {
    list.push([f.x, f.z, f.y, (rand() - 0.5) * 40 * DEG]);
    const onBush = f.group > 0;
    flower.push(f.head, f.stem, onBush ? 0 : f.head * 0.55, onBush ? 0 : 0.32);
    head.push(f.kind === "daisy" ? (daisies++ % 2 ? "daisyB" : "daisyA") : f.kind);
    leaf.push("flowerLeaf");
    group.push(f.group);
  }
  for (const l of L.lupines) {
    const n = l.florets;
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const y = l.h * (0.38 + 0.62 * u) - LUPINE.floret * 0.2;
      const s = LUPINE.floret * (1 - 0.35 * u);
      const jx = (rand() - 0.5) * LUPINE.jitter * Math.SQRT2 * (1 - 0.5 * u);
      list.push([l.x + jx, 0, l.y - jx, (rand() - 0.5) * 60 * DEG]);
      flower.push(s, y, k === 0 ? LUPINE.leaf : 0, k === n - 1 ? 0.55 : 0);
      head.push("lupineFloret");
      leaf.push("lupineLeaf");
      group.push(0);
    }
  }
  return { list, flower, head, leaf, group };
}

/** A mesh with the lantern/flower-style extras set up the usual way for the garden. */
export function instanced(geo, mat, n, { cast = false, receive = false } = {}) {
  const m = new InstancedMesh(geo, mat, n);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.frustumCulled = false;
  return m;
}
export function plain(geo, mat, { cast = false, receive = false } = {}) {
  const m = new Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.frustumCulled = false;
  return m;
}
export { outlineMaterial, paintMaterial };
