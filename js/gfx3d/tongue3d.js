// Gnasher's tongue (docs/3D-PLAN.md 7.4): a tube along a spline, rebuilt every frame from the lash
// hazard itself, so it cannot disagree with the hitbox. A skinned chain could not reach 210 units,
// and a tongue at mouth height would look as if it missed the lane on the floor, so the spline
// leaves the mouth, comes down to the floor within 15 units and runs along the lane's centre line
// to its end — stopping, with its round tip pad, where the lane's marking is clipped at the floor's
// edge rather than running through the wall. It shoots out in about 0.08 s from the fire, holds
// while the lane is live, and draws back with a little wobble.
import { Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage, SphereGeometry } from "./three-lib.js?v=df092a6";
import { ARENA } from "../config.js?v=df092a6";

const RINGS = 28;
const SIDES = 8;

/**
 * Where the tongue leaves the mouth, from the rigged toad himself: boss3d.js sets `at` to a function
 * giving the root of the tongue in his open mouth this frame (world, [x, y, z]), and the tongue then
 * starts there instead of the point its caller passes (render3d.js's fixed height, at his chest).
 * Null, or a function returning null: the caller's point.
 */
export const tongueMouth = { at: null };
/** His tongue's colour: the lash and the tongue lying in his open mouth (53_anim_toad.py "tongue") are one. */
export const TONGUE_COLOR = 0xd0505f;

export function makeTongue(material) {
  const geo = new BufferGeometry();
  const pos = new Float32Array(RINGS * SIDES * 3);
  const nrm = new Float32Array(RINGS * SIDES * 3);
  const idx = [];
  for (let r = 0; r < RINGS - 1; r++)
    for (let s = 0; s < SIDES; s++) {
      const a = r * SIDES + s;
      const b = r * SIDES + ((s + 1) % SIDES);
      const c = (r + 1) * SIDES + s;
      const d = (r + 1) * SIDES + ((s + 1) % SIDES);
      idx.push(a, c, b, b, c, d);
    }
  geo.setIndex(idx);
  const pa = new BufferAttribute(pos, 3);
  const na = new BufferAttribute(nrm, 3);
  pa.setUsage(DynamicDrawUsage);
  na.setUsage(DynamicDrawUsage);
  geo.setAttribute("position", pa);
  geo.setAttribute("normal", na);
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const tip = new Mesh(new SphereGeometry(1, 10, 8), material);
  tip.castShadow = true;
  mesh.add(tip);
  mesh.visible = false;

  return {
    mesh,
    /**
     * `mouth` [x, y, z] (world); `h` the live lash hazard with its in-between { x, y, a }; `k` how
     * far out it is (0..1). Hidden when `h` is null.
     */
    update(mouth, h, at, k, radius = 4.5) {
      if (!h || k <= 0.001) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const own = tongueMouth.at?.() || null;
      if (own) mouth = own;
      const ux = Math.cos(at.a);
      const uy = Math.sin(at.a);
      // How far along the lane it runs: its length, clipped where the marking ends (R + 2).
      let reach = h.len || 90;
      if (h.kind === "cone") reach = h.r || 90;
      // Solve |at + u·t| = R + 2 for the exit point.
      const bq = at.x * ux + at.y * uy;
      const cq = at.x * at.x + at.y * at.y - (ARENA.R + 2) ** 2;
      const disc = bq * bq - cq;
      if (disc > 0) reach = Math.min(reach, -bq + Math.sqrt(disc));
      const L = Math.max(4, reach * k);
      // It starts at the mouth, not at the lane's own start: the lane stays where he stood when the
      // lash began, and he lunges along it, so measured from there the first stretch of the tongue ran
      // back under and beside his body — seen from behind, a tongue coming out of his side (the owner,
      // 2026-10-03). The distance along the lane counts from his mouth's place on it.
      const d0 = Math.max(0, Math.min(L - 4, (mouth[0] - at.x) * ux + (mouth[2] - at.y) * uy));
      for (let r = 0; r < RINGS; r++) {
        const t = r / (RINGS - 1);
        const d = d0 + t * (L - d0);
        const dm = d - d0; // from the mouth
        // Out of the mouth and down to the floor within 15 units, then along the lane. (A level arc over
        // 35 was tried and looked worse: the owner, 2026-10-03.)
        const drop = Math.min(1, dm / 15);
        const hgt = mouth[1] * (1 - drop * drop * (3 - 2 * drop)) + 1.2 * drop;
        const cx = at.x + ux * d;
        const cz = at.y + uy * d;
        // The first few units bend from the mouth onto the lane's centre line.
        const x = mouth[0] + (cx - mouth[0]) * Math.min(1, dm / 6 + 0.001);
        const z = mouth[2] + (cz - mouth[2]) * Math.min(1, dm / 6 + 0.001);
        // Leaving the toad's own mouth it starts slimmer, so it fits between his lips.
        const rad = radius * (0.7 + 0.3 * (1 - t)) * (own ? Math.min(1, 0.5 + dm / 12) : 1);
        for (let s = 0; s < SIDES; s++) {
          const a = (s / SIDES) * Math.PI * 2;
          // A ring across the lane (side) and up.
          const sx = -uy * Math.cos(a);
          const sz = ux * Math.cos(a);
          const sy = Math.sin(a);
          const o = (r * SIDES + s) * 3;
          pos[o] = x + sx * rad;
          pos[o + 1] = hgt + sy * rad * 0.7;
          pos[o + 2] = z + sz * rad;
          nrm[o] = sx;
          nrm[o + 1] = sy;
          nrm[o + 2] = sz;
        }
      }
      pa.needsUpdate = true;
      na.needsUpdate = true;
      geo.computeBoundingSphere();
      tip.position.set(at.x + ux * L, 1.5, at.y + uy * L);
      tip.scale.setScalar(radius * 1.25);
    },
    dispose() {
      geo.dispose();
      tip.geometry.dispose();
    },
  };
}
