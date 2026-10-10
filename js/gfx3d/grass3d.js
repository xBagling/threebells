// Grass tufts (docs/3D-PLAN.md 4.4): one InstancedMesh of opaque blade clumps. Opaque tapered
// blades rather than alpha-cut cards, so the GPU pays no overdraw or discard for them. Each clump
// is six blades of three triangles (18 per clump); the instances are the tufts layout3d.js
// scatters, so the Bun layout test checks exactly these heights: at most 1.3 on the lawn, taller in
// the bed and at wall bases, and never taller than the rule allows on the camera half.
//
// Blades face the camera (their width runs along screen right), so none is ever seen edge-on, and
// their normals point straight up, so a tuft shades like the ground it grows from. Lawn tufts write
// flattened depth (a marking paints over them as over bare ground); all bend in the wind by their
// height squared. They cast no shadow and receive one on Medium and High.
import { Color, InstancedBufferAttribute } from "./three-lib.js?v=df092a6";
import { paintMaterial, GROUND_SHADE_LIFT } from "./materials3d.js?v=df092a6";
import { floorRootAt } from "./paint3d.js?v=df092a6";
import { RIGHT } from "./camera3d.js?v=df092a6";
import { TUFT_REACH } from "./layout3d.js?v=df092a6";
import { Geo, lin, mix3, patchPaint, WIND_BY_HEIGHT, instanced, fillMatrices } from "./props3d.js?v=df092a6";

// Root to lit tip (V23): the root sits in the floor's dark greens, the tips catch the light.
const ROOT = lin(0x1d3514);
const MID = lin(0x5e7224);
const TIP = lin(0xa8b034);

/** One clump, unit-sized: roots within radius 0.55, tips within TUFT_REACH, height about 1. */
export function tuftGeo(rand) {
  const g = new Geo();
  const up = [0, 1, 0];
  const R = RIGHT;
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * 2 * Math.PI + (rand() - 0.5) * 0.8;
    const rr = 0.15 + rand() * 0.4;
    const root = [Math.cos(a) * rr, 0, Math.sin(a) * rr];
    // Lean outwards, more for the outer blades; the tip stays inside the reach the layout allows.
    const la = a + (rand() - 0.5) * 0.9;
    const lean = Math.min(0.25 + rand() * 0.4, TUFT_REACH - rr - 0.05);
    const hb = 0.62 + rand() * 0.38;
    const w = 0.3 + rand() * 0.12;
    const tip = [root[0] + Math.cos(la) * lean, hb, root[2] + Math.sin(la) * lean];
    const midC = [root[0] + Math.cos(la) * lean * 0.3, hb * 0.55, root[2] + Math.sin(la) * lean * 0.3];
    const side = (c, s) => [c[0] + R[0] * s, c[1], c[2] + R[2] * s];
    const bl = side(root, -w / 2);
    const br = side(root, w / 2);
    const ml = side(midC, -w * 0.33);
    const mr = side(midC, w * 0.33);
    g.triN(bl, br, mr, up, up, up, ROOT, ROOT, MID);
    g.triN(bl, mr, ml, up, up, up, ROOT, MID, MID);
    g.triN(ml, mr, tip, up, up, up, MID, MID, TIP);
  }
  // triN winds by the (upward) normals; turn every blade to face the camera instead.
  const p = g.p;
  for (let i = 0; i < p.length; i += 9) {
    const e1 = [p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]];
    const e2 = [p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (f[0] * Math.SQRT1_2 + f[2] * Math.SQRT1_2 < 0) {
      for (const arr of [g.p, g.c]) for (let k = 0; k < 3; k++) [arr[i + 3 + k], arr[i + 6 + k]] = [arr[i + 6 + k], arr[i + 3 + k]];
    }
  }
  return g.build();
}

/** How dark a tuft's root sits against the floor under it (plan 4.4: in the floor's dark greens). */
export const ROOT_K = 0.8;

/**
 * The grass: one InstancedMesh of the scattered tufts (the first `count` of them). `roots` is the
 * painted macro map's CPU samples (paint3d.js floorRootAt) or null: with them every tuft's root
 * colour is the floor's albedo under it × ROOT_K × its own tint, baked at build time into the
 * per-tuft attribute aRoot (critique #19: no vertex texture fetch), which takes the place of ROOT
 * at the root vertices and eases into M4a's MID up the blade; without them the root is ROOT (M4a).
 */
export function buildGrass(look, geo, tufts, count, { receive = true, roots = null } = {}) {
  const mat = paintMaterial(look, { vertexColors: true, wind: 1, flatten: true, shadeLift: GROUND_SHADE_LIFT });
  const rootPatch = roots
    ? [
        ["#include <common>", "#include <common>\nattribute vec3 aRoot;"],
        // Only the root vertices (y 0) take it: the blades' mid vertices (y 0.34–0.55) keep M4a's
        // MID, as a height ramp to 0.55 dulled them by up to a third (the lit tufts' bright
        // tips dropped out of the capture's highlights).
        ["#include <color_vertex>", "#include <color_vertex>\nvColor.rgb = mix(aRoot, vColor.rgb, step(0.01, position.y));"],
      ]
    : [];
  patchPaint(mat, roots ? "grass:root" : "grass", { vert: [WIND_BY_HEIGHT, ...rootPatch] });
  const n = Math.min(count, tufts.length);
  const mesh = instanced(geo, mat, n, { receive });
  fillMatrices(
    mesh,
    tufts.slice(0, n).map((t) => [t.x, 0, t.y, t.yaw, t.cr, t.h, t.cr])
  );
  // A little variety per tuft: some yellower, some bluer, lighter and darker.
  const c = new Color();
  const warm = lin(0xfff0a0);
  const cool = lin(0xa8d0b0);
  const aRoot = roots ? new Float32Array(Math.max(1, n) * 3) : null;
  tufts.slice(0, n).forEach((t, i) => {
    const k = 0.82 + t.tone * 0.33;
    const tint = t.tone > 0.5 ? mix3([1, 1, 1], warm, (t.tone - 0.5) * 0.5) : mix3([1, 1, 1], cool, (0.5 - t.tone) * 0.5);
    mesh.setColorAt(i, c.setRGB(tint[0] * k, tint[1] * k, tint[2] * k));
    if (aRoot) {
      const m = floorRootAt(roots, t.x, t.y);
      for (let q = 0; q < 3; q++) aRoot[i * 3 + q] = m[q] * ROOT_K * tint[q] * k;
    }
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // The geometry is the page's cached tuft (arena3d.js), so the attribute is set per build.
  if (aRoot) geo.setAttribute("aRoot", new InstancedBufferAttribute(aRoot, 3));
  return mesh;
}
