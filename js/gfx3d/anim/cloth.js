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
// (a hit-stop draws the same pose); a jump of the body (a respawn, the bench) starts the cloth afresh. The bones are drawn
// at the cloth as it would be the frame's leftover part of a substep on (its last step's motion carried on by that
// share): at 144 Hz a frame holds 0.83 of a substep, so drawn as stepped the cloth stood still one frame and jumped two
// steps' worth the next; carried on, at 60 Hz (two whole steps a frame) it is drawn exactly as stepped.
//
// The bosses' cloth uses the same (2026-10-20, Sister Cinder's sleeves and robe: boss3d.js, boss-profiles.js `cloth`): each
// set of chains its own tuning over CLOTH (`tune`), its own colliders, and per chain a wider cone (`maxDeg`) and a `hang` —
// the share of the way from the clip's direction to straight down that the chain rests at, so a wide sleeve on a raised arm
// falls back along it toward her shoulder instead of standing out where the clip carried it. `kick` flings the cloth out
// from a centre (a burst of fire).
import { Vector3, Quaternion } from "../three-lib.js?v=48fd128-df87a96f";
import { turnWorld } from "./ik.js?v=48fd128-df87a96f";

export const CLOTH = Object.freeze({
  step: 1 / 120,
  // (the most substeps a frame: hero3d.js's dt is at most 0.1 s, 12 steps — at 8 a frame under 15 fps lost the rest of its
  // time; a longer frame drops its backlog, never carried into the next)
  maxSteps: 12,
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
const vR = new Vector3(); // (the point a link is drawn at)
const qA = new Quaternion();
const Q_ID = new Quaternion();

/** The point on segment ab nearest p, into `out`. */
function nearest(a, b, p, out) {
  vD.subVectors(b, a);
  const l2 = vD.lengthSq();
  const u = l2 > 1e-9 ? Math.max(0, Math.min(1, vC.subVectors(p, a).dot(vD) / l2)) : 0;
  return out.copy(a).addScaledVector(vD, u);
}

const DOWN = new Vector3(0, -1, 0);
const qH = new Quaternion();

/**
 * `chains` = [[bone, …], …] (each chain root first); `tailLen(bone)` the world length of a chain's
 * last bone (the others reach their child's head); `legs` = [{ a: bone, b: bone, r }] capsules (world r) the cloth
 * stays out of. `tune` overrides CLOTH's numbers for this cloth; `per` = one { maxDeg, hang } (or null) per chain.
 */
export function makeCloth(chains, legs, tailLen, { pairs = [], tune = null, per = [] } = {}) {
  const T = tune ? { ...CLOTH, ...tune } : CLOTH;
  const links = chains.map((bones, ci) =>
    bones.map((bone, i) => ({ bone, next: bones[i + 1] || null, last: i === bones.length - 1, p: new Vector3(), prev: new Vector3(), tip: new Vector3(), aim: new Vector3(), head: new Vector3(), len: 0, lenLocal: 0, on: false, maxDeg: per[ci]?.maxDeg ?? null, hang: per[ci]?.hang ?? 0 }))
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
    // (a chain's own cone, else this cloth's; apply's extra.maxDeg only ever widens it)
    const max = (Math.max(k.maxDeg ?? T.maxDeg, curMax) * Math.PI) / 180;
    if (ang > max) {
      qA.slerp(Q_ID, 1 - max / ang);
      k.p.copy(k.head).addScaledVector(vB.applyQuaternion(qA).normalize(), k.len);
    }
    return true;
  }
  const caps = legs.map((l) => ({ ...l, pa: new Vector3(), pb: new Vector3() }));
  let acc = 0;
  let curMax = 0; // (a wider cone this frame: apply's extra.maxDeg)
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
    /** Fling the cloth out from `center` (world) at `speed` units/s across the ground and `up` units/s upward. */
    kick(center, speed, up = 0) {
      for (const ch of links)
        for (const k of ch) {
          if (!k.on) continue;
          vB.set(k.p.x - center.x, 0, k.p.z - center.z);
          if (vB.lengthSq() < 1e-9) continue;
          vB.normalize().multiplyScalar(speed * T.step);
          vB.y = up * T.step;
          k.prev.sub(vB);
        }
    },
    /**
     * `root` the hips' world position (a jump starts the cloth afresh), `wind` world (x, z) accel share; `extra` an added
     * world acceleration { x, y, z } (units/s²) and a wider cone `maxDeg` — the baked jump's cape streaming out behind him.
     */
    apply(dt, root, windX = 0, windZ = 0, extra = null) {
      curMax = extra?.maxDeg ?? 0;
      if (lastRoot && root.distanceTo(lastRoot) > 40) this.reset();
      if (lastRoot) {
        // the body's move this frame, carried (CLOTH.carryUp, carryFlat): position and history alike
        vA.subVectors(root, lastRoot);
        vA.set(vA.x * T.carryFlat, vA.y * T.carryUp, vA.z * T.carryFlat);
        for (const ch of links) for (const k of ch) if (k.on) (k.p.add(vA), k.prev.add(vA));
      }
      (lastRoot ??= new Vector3()).copy(root);
      for (const c of caps) {
        c.a.getWorldPosition(c.pa);
        c.b.getWorldPosition(c.pb);
      }
      acc += dt;
      // (a hair's allowance: a frame of 1/60 s read back from the view's clock is 1.9999999 steps as often as 2, and the cloth
      // then stepped once and three times on alternate frames)
      let n = Math.floor(acc / T.step + 1e-6);
      if (n > T.maxSteps) (n = T.maxSteps), (acc = 0);
      else acc -= n * T.step;
      const lead = Math.min(1, Math.max(0, acc / T.step)); // (the share of the next substep this frame already holds)
      const h = T.step;
      // level by level (each chain's first bones, then their second ones), so neighbouring chains can be held
      // together (CLOTH.spread) before their bones turn
      for (let j = 0; j < levels; j++) {
        for (const ch of links) {
          const k = ch[j];
          if (!k) continue;
          k.bone.updateMatrixWorld(true);
          const tip = animTip(k, k.tip);
          const head = k.bone.getWorldPosition(k.head);
          k.aim.copy(tip);
          if (k.hang > 0) {
            // (the clip's direction turned that share of the way to straight down, about the bone's head)
            vB.subVectors(tip, head).normalize();
            if (vB.lengthSq() > 0.5) k.aim.copy(head).addScaledVector(vB.applyQuaternion(qH.setFromUnitVectors(vB, DOWN).slerp(Q_ID, 1 - k.hang)), k.len);
          }
          if (!k.on) {
            k.p.copy(tip);
            k.prev.copy(tip);
            k.on = true;
          }
          for (let i = 0; i < n; i++) {
            // verlet: x += (x − x_old)(1 − damp) + a h²
            vB.subVectors(k.p, k.prev).multiplyScalar(1 - T.damp);
            k.prev.copy(k.p);
            k.p.add(vB);
            k.p.x += windX * T.wind * h * h;
            k.p.z += windZ * T.wind * h * h;
            k.p.y -= T.gravity * h * h;
            if (extra) (k.p.x += extra.x * h * h), (k.p.y += extra.y * h * h), (k.p.z += extra.z * h * h);
            // back towards the clip's tip (or the way down from it a chain hangs)
            k.p.lerp(k.aim, T.stiff);
            // out of the legs
            for (const c of caps) {
              nearest(c.pa, c.pb, k.p, vC);
              const d = k.p.distanceTo(vC);
              const r = c.r + T.pad;
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
          const lim = a.tip.distanceTo(b.tip) * T.spread;
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
          // inside the cone, so it does not keep pulling past it) — at the particle carried on by the frame's `lead`
          if (!k || !coneIn(k)) continue;
          if (lead > 1e-9) {
            vR.copy(k.p);
            k.p.addScaledVector(vB.subVectors(k.p, k.prev), lead);
            vB.subVectors(k.p, k.head);
            const l = vB.length();
            if (l > 1e-6) k.p.copy(k.head).addScaledVector(vB, k.len / l);
            const ok = coneIn(k);
            k.p.copy(vR);
            if (!ok) continue;
          }
          turnWorld(k.bone, qA);
        }
      }
    },
  };
}
