// The hero's sword (docs/3D-PLAN.md V50, 6.6), built by code in game units: a blade of 8.2 units
// with a diamond section, a bevelled edge line and a darker fuller, a gold-bronze cross-guard, a
// wrapped brown grip and a small pommel — about 9.8 units in all, under 300 triangles — each part in
// its own flat colours, with an outline hull as the characters have.
//
// Its frame: the origin at the middle of the grip (where the fist closes), +Z along the blade to
// the tip, +Y across the blade from edge to edge, +X out of its flat. The hand holds it there.
import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Color, Vector3, MeshBasicMaterial, GreaterDepth } from "./three-lib.js?v=8898846";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=8898846";

/** Lengths along the sword (game units, from the middle of the grip). */
export const SWORD = { pommel: -0.62, gripLo: -0.45, gripHi: 0.5, guard: 0.78, tip: 8.98, bladeLen: 8.2, width: 0.74, total: 9.83 };

/**
 * The blade seen through whatever stands in front of it, in a cut (hero3d.js sets how much): a pale
 * steel silhouette drawn only where something nearer the camera covers the blade — the hero's own
 * body and cape, most of all. Seen from behind, every landing in front of him is behind the cape
 * (the heavy's impact, five to seven frames from 157° to 250°, the Track A fix round's review), so
 * the blade shows through, as the sword trail does (herofx3d.js TRAIL_XRAY). `opacity` at full
 * weight; never below the grass (`ground`, world height): the bite's buried tip stays buried.
 */
export const BLADE_XRAY = Object.freeze({ color: 0xe4ebe8, opacity: 0.7, ground: 0.02 });

/** The most light the steel takes, as a multiple of its paint (materials3d.js PAINT_METAL), and its rim. */
export const METAL = 1.05;
const RIM_STEEL = 0.2;

const COL = {
  flat: 0xc8ccc7,
  edge: 0xe8e9de,
  fuller: 0x9eaaa2,
  gold: 0xc99a3a,
  goldDark: 0x8f6a24,
  grip: 0x5a3620,
  wrap: 0x3a2214,
};

/** A flat-shaded triangle soup with a colour per corner. */
function soup() {
  const pos = [];
  const col = [];
  const c = new Color();
  const put = (p, hex) => {
    pos.push(p[0], p[1], p[2]);
    c.setHex(hex); // linear, as three's vertex colours want
    col.push(c.r, c.g, c.b);
  };
  return {
    tri(a, b, d, ca, cb = ca, cd = ca) {
      put(a, ca);
      put(b, cb);
      put(d, cd);
    },
    quad(a, b, d, e, ca, cb = ca, cd = ca, ce = ca) {
      // a b d e round the quad
      this.tri(a, b, d, ca, cb, cd);
      this.tri(a, d, e, ca, cd, ce);
    },
    geometry() {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    },
  };
}

/** The same shape, welded, with smooth normals: the outline hull pushes out along them without gaps. */
function hullOf(g) {
  const src = g.getAttribute("position");
  const pos = [];
  const index = [];
  const seen = new Map();
  for (let i = 0; i < src.count; i++) {
    const x = src.getX(i);
    const y = src.getY(i);
    const z = src.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let k = seen.get(key);
    if (k == null) {
      k = pos.length / 3;
      seen.set(key, k);
      pos.push(x, y, z);
    }
    index.push(k);
  }
  const w = new BufferGeometry();
  w.setAttribute("position", new Float32BufferAttribute(pos, 3));
  w.setIndex(index);
  w.computeVertexNormals();
  return w;
}

/** A ring of `n` points round the Z axis at `z`, radii `rx`, `ry`, turned by `rot`. */
const ring = (n, z, rx, ry, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = rot + (i / n) * Math.PI * 2;
  return [Math.cos(a) * rx, Math.sin(a) * ry, z];
});

function bladeGeometry() {
  const s = soup();
  const W = SWORD.width;
  const T = 0.17;
  // The section, counter-clockwise seen from the tip (so the faces point out): an edge on each side
  // (±Y), a bevel, and the ridge down the middle of each flat (±X).
  const sec = (w, t) => [
    [0, w / 2],
    [-t * 0.45, w * 0.3],
    [-t / 2, 0],
    [-t * 0.45, -w * 0.3],
    [0, -w / 2],
    [t * 0.45, -w * 0.3],
    [t / 2, 0],
    [t * 0.45, w * 0.3],
  ];
  const z0 = SWORD.guard;
  const L = SWORD.bladeLen;
  // Base, the fuller's end, the start of the point, just short of the tip.
  const rings = [
    { z: z0, w: W, t: T, fuller: true },
    { z: z0 + L * 0.4, w: W * 0.94, t: T * 0.95, fuller: true },
    { z: z0 + L * 0.74, w: W * 0.84, t: T * 0.85, fuller: false },
    { z: z0 + L * 0.92, w: W * 0.46, t: T * 0.6, fuller: false },
  ].map((r) => ({ ...r, p: sec(r.w, r.t).map(([x, y]) => [x, y, r.z]) }));
  const isBevel = (i) => i === 0 || i === 3 || i === 4 || i === 7; // faces i→i+1 that touch an edge
  const colAt = (r, j) => (j === 2 || j === 6 ? (r.fuller ? COL.fuller : COL.flat) : j === 0 || j === 4 ? COL.edge : COL.flat);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k];
    const B = rings[k + 1];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      // Each corner its own colour: the bevels fade from the bright edge to the silver flat, so the
      // edge reads as a line (solid, the bevels were two fifths of the blade's width, and a cut that
      // shows them to the sky turned half the blade white).
      s.quad(A.p[i], A.p[j], B.p[j], B.p[i], colAt(A, i), colAt(A, j), colAt(B, j), colAt(B, i));
    }
  }
  const tip = [0, 0, SWORD.tip];
  const last = rings[rings.length - 1];
  for (let i = 0; i < 8; i++) s.tri(last.p[i], last.p[(i + 1) % 8], tip, isBevel(i) ? COL.edge : COL.flat, isBevel(i) ? COL.edge : COL.flat, COL.edge);
  // A cap at the base (under the guard, but the hull needs it closed).
  const base = rings[0].p;
  for (let i = 1; i < 7; i++) s.tri(base[0], base[i + 1], base[i], COL.flat);
  return s.geometry();
}

function hiltGeometry() {
  const s = soup();
  // The cross-guard: a bar across the blade (along Y), thicker in the middle, its ends swept a touch
  // towards the blade; a hexagonal section.
  const n = 6;
  const bar = [
    { y: -1.18, r: 0.13, z: 0.2 },
    { y: -0.95, r: 0.17, z: 0.1 },
    { y: -0.3, r: 0.2, z: 0 },
    { y: 0.3, r: 0.2, z: 0 },
    { y: 0.95, r: 0.17, z: 0.1 },
    { y: 1.18, r: 0.13, z: 0.2 },
  ];
  const zc = (SWORD.gripHi + SWORD.guard) / 2;
  const barRing = (b) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(a) * b.r * 1.15, b.y, zc + b.z + Math.sin(a) * b.r];
  });
  const rings = bar.map(barRing);
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const shade = i >= 3 ? COL.goldDark : COL.gold;
      s.quad(rings[k][j], rings[k][i], rings[k + 1][i], rings[k + 1][j], shade); // the ring runs clockwise seen along +Y
    }
  for (const [rg, flip] of [[rings[0], true], [rings[rings.length - 1], false]])
    for (let i = 1; i < n - 1; i++) (flip ? s.tri(rg[0], rg[i], rg[i + 1], COL.gold) : s.tri(rg[0], rg[i + 1], rg[i], COL.gold));
  // The grip: a wrapped hexagonal column, the wraps a darker band.
  const g = [SWORD.gripLo, -0.12, 0.2, SWORD.gripHi].map((z, k) => ring(6, z, k === 1 || k === 2 ? 0.215 : 0.19, k === 1 || k === 2 ? 0.215 : 0.19, Math.PI / 6));
  for (let k = 0; k < g.length - 1; k++)
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      s.quad(g[k][i], g[k][j], g[k + 1][j], g[k + 1][i], k === 1 ? COL.wrap : COL.grip);
    }
  // The pommel: a small faceted ball.
  const pz = SWORD.pommel;
  const top = [0, 0, pz + 0.24];
  const bot = [0, 0, pz - 0.23];
  const mid1 = ring(8, pz + 0.1, 0.25, 0.25);
  const mid2 = ring(8, pz - 0.1, 0.25, 0.25, Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    s.tri(top, mid1[i], mid1[j], COL.gold);
    s.tri(mid1[i], mid2[i], mid1[j], COL.gold);
    s.tri(mid1[j], mid2[i], mid2[j], COL.goldDark);
    s.tri(bot, mid2[j], mid2[i], COL.goldDark);
  }
  return s.geometry();
}

/**
 * The sword: { group (its frame as above), base and tip (the blade's ends in that frame), meshes,
 * hulls (their outline, set with the characters'), materials, triangles }.
 */
export function makeSword(look, { outline = 1.1 } = {}) {
  const group = new Group();
  const bladeMat = paintMaterial(look, { vertexColors: true, char: true, emissive: 0x15181a });
  const hiltMat = paintMaterial(look, { vertexColors: true, char: true });
  // The character light (materials3d.js): the steel a cool white so it reads silver, the hilt the
  // hero's warm fill. The steel's light rolls off at METAL× its paint (PAINT_METAL), so flats turned
  // to the sun in a cut stay silver instead of blowing out to white.
  bladeMat.defines.PAINT_METAL = METAL.toFixed(2);
  const key = bladeMat.customProgramCacheKey;
  bladeMat.customProgramCacheKey = () => `${key()}:metal${METAL}`;
  bladeMat.userData.paint.uFill.value.setHex(0xf2f5ff).multiplyScalar(0.95);
  hiltMat.userData.paint.uFill.value.setHex(0xffe4c4).multiplyScalar(0.8);
  for (const m of [bladeMat, hiltMat]) {
    m.userData.paint.uRimCol.value.setHex(0xfff2c8);
    m.userData.paint.uRimAmt.value = 0.5;
  }
  // A faint rim on the steel: with the edge leading in a cut, the bevels face across the view and
  // all count as silhouette, and a strong rim gilds half the blade white.
  bladeMat.userData.paint.uRimCol.value.setHex(0xf4f6f0);
  bladeMat.userData.paint.uRimAmt.value = RIM_STEEL;
  const bladeGeo = bladeGeometry();
  const hiltGeo = hiltGeometry();
  const blade = new Mesh(bladeGeo, bladeMat);
  const hilt = new Mesh(hiltGeo, hiltMat);
  const hulls = [bladeGeo, hiltGeo].map((g) => new Mesh(hullOf(g), outlineMaterial(look, { color: 0x100f0b, warm: 0x3a3226, px: outline })));
  for (const m of [blade, hilt]) m.castShadow = true;
  // The blade's x-ray (BLADE_XRAY): off until a cut turns it on (setXray).
  const xrayMat = new MeshBasicMaterial({ color: BLADE_XRAY.color, transparent: true, opacity: 0, depthWrite: false, depthFunc: GreaterDepth, toneMapped: false, fog: false });
  const xrayGround = { value: BLADE_XRAY.ground };
  xrayMat.onBeforeCompile = (sh) => {
    sh.uniforms.uXrayGround = xrayGround;
    sh.vertexShader = sh.vertexShader.replace("void main() {", "varying float vXrayY;\nvoid main() {").replace("#include <project_vertex>", "#include <project_vertex>\n  vXrayY = (modelMatrix * vec4(transformed, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform float uXrayGround;\nvarying float vXrayY;\nvoid main() {\n  if (vXrayY < uXrayGround) discard;");
  };
  xrayMat.customProgramCacheKey = () => "blade-xray";
  const xray = new Mesh(bladeGeo, xrayMat);
  xray.renderOrder = 6; // after the opaque world and the trail's own x-ray
  xray.visible = false;
  xray.castShadow = false;
  group.add(blade, hilt, ...hulls, xray);
  const triangles = (bladeGeo.getAttribute("position").count + hiltGeo.getAttribute("position").count) / 3;
  return {
    group,
    base: new Vector3(0, 0, SWORD.guard),
    tip: new Vector3(0, 0, SWORD.tip),
    meshes: [blade, hilt],
    hulls,
    materials: [bladeMat, hiltMat],
    triangles,
    xray,
    /** How much the blade shows through what covers it (0..1 of BLADE_XRAY.opacity), and `alpha` the i-frame blink. */
    setXray(w, alpha = 1) {
      const o = BLADE_XRAY.opacity * Math.max(0, Math.min(1, w)) * alpha;
      xrayMat.opacity = o;
      xray.visible = o > 0.004;
    },
    dispose() {
      xrayMat.dispose();
      for (const o of [blade, hilt, ...hulls]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
  };
}
