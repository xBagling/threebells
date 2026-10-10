// The painted hero's cape and tabard as cloth (his movement guide, "Anatomy and rig": the cape and
// tabard overlap and follow through on every move). The model's cloth is skinned to bones the clips
// key (hero_cloth: three cape chains of two bones each from the waist, and the tabard), so on its own
// it moved exactly with the body and stopped on the same frame. Here each of those bones gets a
// "dynamic bone" on top of the clip: its tip is a verlet particle with inertia, pulled back towards
// where the clip has it, held at the bone's length from the bone's head, pushed out of the legs
// (capsules round the thighs and shins), and the bone is turned to point at it — at most MAX_DEG off
// the clip's own. Starts leave the cloth behind, stops swing it on, turns fling it out, and it settles.
//
// Fixed substeps (1/120 s) so the feel is the same at any frame rate; no step when time does not move
// (a hit-stop draws the same pose); a jump of the body (a respawn, the bench) starts the cloth afresh.
import { Vector3, Quaternion } from "../three-lib.js?v=df092a6";
import { turnWorld } from "./ik.js?v=df092a6";

export const CLOTH = Object.freeze({
  step: 1 / 120,
  stiff: 0.035, // the share of the way back to the clip's tip each substep
  damp: 0.05, // the share of its speed lost each substep
  gravity: 60, // world units/s² (the clip already hangs it; this only weighs the swing down)
  maxDeg: 38,
  wind: 30, // world units/s² per unit of the garden's wind
  pad: 0.35, // how far outside a leg's capsule the cloth stays, world units
  // How much of the hips' own movement each frame carries the cloth along with it (not inertia): all
  // of the run's bounce (10% of his height twice a cycle shook the cape down from its streaming
  // angle, 51° to 25°), most of a steady run; starts, stops and turns still swing it.
  carryUp: 1,
  carryFlat: 0.6,
  // Neighbouring chains (`pairs`) never spread more than this times their spacing on the clip: simulated one by one,
  // a leg pushing one chain out and not the next, or the two swinging to opposite edges of their cones, tore the cape
  // between them — 12.7× in a roll from a run (.scratch/shoulder/gametear.mjs). Pulled back toward each other, half
  // each, then held at their bones' lengths again.
  spread: 1.25,
});

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vD = new Vector3();
const vH = new Vector3();
const qA = new Quaternion();
const Q_ID = new Quaternion();

/** The point on segment ab nearest p, into `out`. */
function nearest(a, b, p, out) {
  vD.subVectors(b, a);
  const l2 = vD.lengthSq();
  const u = l2 > 1e-9 ? Math.max(0, Math.min(1, vC.subVectors(p, a).dot(vD) / l2)) : 0;
  return out.copy(a).addScaledVector(vD, u);
}

/**
 * `chains` = [[bone, …], …] (each chain root first); `tailLen(bone)` the world length of a chain's
 * last bone (the others reach their child's head); `legs` = [{ a: bone, b: bone, r }] capsules (world r).
 */
export function makeCloth(chains, legs, tailLen, { pairs = [] } = {}) {
  const links = chains.map((bones) =>
    bones.map((bone, i) => ({ bone, next: bones[i + 1] || null, last: i === bones.length - 1, p: new Vector3(), prev: new Vector3(), tip: new Vector3(), head: new Vector3(), len: 0, lenLocal: 0, on: false }))
  );
  const levels = Math.max(0, ...links.map((ch) => ch.length));
  /**
   * A link's particle brought inside its cone (CLOTH.maxDeg off the clip's tip, about its head). Leaves in qA the
   * clip's tip turned onto it (false: no turn, a degenerate link).
   */
  function coneIn(k) {
    vB.subVectors(k.tip, k.head).normalize();
    vC.subVectors(k.p, k.head).normalize();
    if (vB.lengthSq() < 0.5 || vC.lengthSq() < 0.5) return false;
    qA.setFromUnitVectors(vB, vC);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(qA.w)));
    const max = (curMax * Math.PI) / 180;
    if (ang > max) {
      qA.slerp(Q_ID, 1 - max / ang);
      k.p.copy(k.head).addScaledVector(vB.applyQuaternion(qA).normalize(), k.len);
    }
    return true;
  }
  const caps = legs.map((l) => ({ ...l, pa: new Vector3(), pb: new Vector3() }));
  let acc = 0;
  let curMax = CLOTH.maxDeg; // (the cone this frame: apply's extra.maxDeg)
  let lastRoot = null;

  /** Where the clip has a link's tip (world), and its length. */
  function animTip(k, out) {
    const head = k.bone.getWorldPosition(vA);
    if (k.next) {
      k.next.getWorldPosition(out);
      k.len = out.distanceTo(head);
      return out;
    }
    // the last bone: along its own +Y (Blender's head → tail) for the given world length
    const s = k.bone.getWorldScale(vB).y || 1;
    k.len = tailLen(k.bone);
    return k.bone.localToWorld(out.set(0, k.len / s, 0));
  }

  return {
    reset() {
      for (const ch of links) for (const k of ch) k.on = false;
      acc = 0;
    },
    /**
     * `root` the hips' world position (a jump starts the cloth afresh), `wind` world (x, z) accel share; `extra` an added
     * world acceleration { x, y, z } (units/s²) and a wider cone `maxDeg` — the baked jump's cape streaming out behind him.
     */
    apply(dt, root, windX = 0, windZ = 0, extra = null) {
      curMax = extra?.maxDeg ?? CLOTH.maxDeg;
      if (lastRoot && root.distanceTo(lastRoot) > 40) this.reset();
      if (lastRoot) {
        // the body's move this frame, carried (CLOTH.carryUp, carryFlat): position and history alike
        vA.subVectors(root, lastRoot);
        vA.set(vA.x * CLOTH.carryFlat, vA.y * CLOTH.carryUp, vA.z * CLOTH.carryFlat);
        for (const ch of links) for (const k of ch) if (k.on) (k.p.add(vA), k.prev.add(vA));
      }
      (lastRoot ??= new Vector3()).copy(root);
      for (const c of caps) {
        c.a.getWorldPosition(c.pa);
        c.b.getWorldPosition(c.pb);
      }
      acc += dt;
      const n = Math.min(8, Math.floor(acc / CLOTH.step));
      acc = n === 8 ? 0 : acc - n * CLOTH.step;
      const h = CLOTH.step;
      // level by level (each chain's first bones, then their second ones), so neighbouring chains can be held
      // together (CLOTH.spread) before their bones turn
      for (let j = 0; j < levels; j++) {
        for (const ch of links) {
          const k = ch[j];
          if (!k) continue;
          k.bone.updateMatrixWorld(true);
          const tip = animTip(k, k.tip);
          const head = k.bone.getWorldPosition(k.head);
          if (!k.on) {
            k.p.copy(tip);
            k.prev.copy(tip);
            k.on = true;
          }
          for (let i = 0; i < n; i++) {
            // verlet: x += (x − x_old)(1 − damp) + a h²
            vB.subVectors(k.p, k.prev).multiplyScalar(1 - CLOTH.damp);
            k.prev.copy(k.p);
            k.p.add(vB);
            k.p.x += windX * CLOTH.wind * h * h;
            k.p.z += windZ * CLOTH.wind * h * h;
            k.p.y -= CLOTH.gravity * h * h;
            if (extra) (k.p.x += extra.x * h * h), (k.p.y += extra.y * h * h), (k.p.z += extra.z * h * h);
            // back towards the clip's tip
            k.p.lerp(tip, CLOTH.stiff);
            // out of the legs
            for (const c of caps) {
              nearest(c.pa, c.pb, k.p, vC);
              const d = k.p.distanceTo(vC);
              const r = c.r + CLOTH.pad;
              if (d < r && d > 1e-6) k.p.sub(vC).multiplyScalar(r / d).add(vC);
            }
            // at the bone's length from its head
            vB.subVectors(k.p, head);
            const l = vB.length();
            if (l > 1e-6) k.p.copy(head).addScaledVector(vB, k.len / l);
          }
          // (into its cone before the chains are held together: cut back after, chain by chain, it undid the hold —
          // in a roll's tuck neighbours stood 25-40° apart at the cone's edge and its middle)
          coneIn(k);
        }
        // neighbouring chains held together (CLOTH.spread)
        for (const [ia, ib] of pairs) {
          const a = links[ia]?.[j];
          const b = links[ib]?.[j];
          if (!a?.on || !b?.on) continue;
          const lim = a.tip.distanceTo(b.tip) * CLOTH.spread;
          vB.subVectors(b.p, a.p);
          const d = vB.length();
          if (d <= lim || d < 1e-6) continue;
          vB.multiplyScalar((d - lim) / (2 * d));
          a.p.add(vB);
          b.p.sub(vB);
          for (const k of [a, b]) {
            vC.subVectors(k.p, k.head);
            const l = vC.length();
            if (l > 1e-6) k.p.copy(k.head).addScaledVector(vC, k.len / l);
            coneIn(k);
          }
        }
        for (const ch of links) {
          const k = ch[j];
          // the bone turned to point at its particle, at most maxDeg off the clip's own (and the particle brought back
          // inside the cone, so it does not keep pulling past it)
          if (k && coneIn(k)) turnWorld(k.bone, qA);
        }
      }
    },
  };
}
