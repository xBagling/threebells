// Planted feet (docs/3D-PLAN.md 7.3) — for EVERY legged creature that moves on the ground (the hero,
// Gnasher, and any added later: rig-model skill, section 8): a distance-driven cycle alone still lets feet slide on curves,
// on reversals and while the body turns, so a foot that is on the ground is held there.
//
// Each frame, after the clip is sampled: a foot whose sole is within a small height of the ground
// is in stance; the frame it lands, its world spot is remembered, and while it stays in stance a
// two-bone IK (thigh, shin, foot) pulls the leg so the foot stays on that spot, the knee bending in
// the plane it already bends in. When the clip lifts the foot, the lock lets go over 50 ms.
// Everything here works on three's bone objects in world space and reuses its vectors (no
// allocation per frame).
//
// Standing, turning on the spot (the owner, 2026-10-02: the feet stayed where he stopped, so a turn
// twisted his legs into each other): with `standing` on, a locked foot whose spot has fallen more
// than `stepAt` from where the pose puts it now (the pose turns with him) takes a step — lifted on a
// low arc over `stepTime` to where the pose wants it, and locked there again — one foot at a time,
// the one furthest behind first. Moving, the clip's own steps do this, and a planted foot is meant
// to fall behind, so it is off.
import { Vector3, Quaternion } from "../three-lib.js?v=48fd128-df87a96f";

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vT = new Vector3();
const vPole = new Vector3();
const vHip = new Vector3();
const vKnee = new Vector3();
const vFoot = new Vector3();
const vTmp = new Vector3();
const qA = new Quaternion();
const qP = new Quaternion();
const qW = new Quaternion();
/** How long (s) a low reading of a foot stays its floor: the floor is the lowest over the last FLOOR_SPAN to 1.5 × FLOOR_SPAN. */
const FLOOR_SPAN = 1;

/** Rotate `bone` (in world terms) so that its child at world `from` swings towards world `to`. */
function aimBone(bone, from, to, amount) {
  bone.getWorldPosition(vA);
  vB.subVectors(from, vA).normalize();
  vC.subVectors(to, vA).normalize();
  if (vB.lengthSq() < 1e-8 || vC.lengthSq() < 1e-8) return;
  qA.setFromUnitVectors(vB, vC);
  if (amount < 1) qA.slerp(qW.identity(), 1 - amount);
  // world rotation → local: q_local' = q_parent⁻¹ · qA · q_parent · q_local
  bone.parent.getWorldQuaternion(qP);
  bone.getWorldQuaternion(qW);
  qW.premultiply(qA);
  bone.quaternion.copy(qP.invert().multiply(qW));
  bone.updateMatrixWorld(true);
}

/**
 * `legs`: [{ thigh, shin, foot }] bones (the floor at world height 0); `stanceH` how close to it a
 * sole counts as planted (world units).
 */
export function makeFeet(legs, { stanceH = 0.9, stepAt = 2.2, stepTime = 0.17, stepLift = 1.3, maxStepping = 1, lead = 0.6 } = {}) {
  const state = legs.map(() => ({ locked: false, spot: new Vector3(), weight: 0, from: new Vector3(), to: new Vector3(), stepT: -1, vel: new Vector3(), last: null, floor: Infinity, bins: [Infinity, Infinity, Infinity], binT: 0 }));
  const poseAt = legs.map(() => new Vector3()); // where the pose puts each foot this frame
  const orderI = new Int32Array(legs.length), orderD = new Float64Array(legs.length); // (the feet to step, furthest first)
  return {
    /** After the pose is sampled and the model's world matrices are current. `dt` sim-view seconds. */
    apply(dt, { enabled = true, standing = false, ground = 0 } = {}) {
      // Where the pose puts each foot now, before anything holds it.
      legs.forEach((leg, i) => {
        leg.foot.getWorldPosition(poseAt[i]);
        // How fast the pose carries the foot (the body sliding: a step lands a little ahead of it).
        const st = state[i];
        if (st.last && dt > 1e-4) st.vel.subVectors(poseAt[i], st.last).divideScalar(dt);
        else st.vel.set(0, 0, 0);
        (st.last ||= new Vector3()).copy(poseAt[i]);
      });
      // Steps: the feet furthest from where the pose wants them, if far enough, up to `maxStepping` at
      // once (a creature sliding without its walk — a cast that creeps him on — trots to keep up).
      // (sorted in place in two kept arrays, furthest first, ties in leg order as the sort it replaces kept them: a filter,
      // a map, an array a leg and a sort, every frame he sat)
      if (standing && enabled) {
        let stepping = 0, n = 0;
        for (let i = 0; i < state.length; i++) {
          const st = state[i];
          if (st.stepT >= 0) stepping++;
          const d = st.locked && st.stepT < 0 ? Math.hypot(st.spot.x - poseAt[i].x, st.spot.z - poseAt[i].z) : 0;
          if (!(d > stepAt)) continue;
          let k = n++;
          for (; k > 0 && orderD[k - 1] < d; k--) (orderD[k] = orderD[k - 1]), (orderI[k] = orderI[k - 1]);
          (orderD[k] = d), (orderI[k] = i);
        }
        for (let k = 0; k < n; k++) {
          if (stepping >= maxStepping) break;
          const i = orderI[k];
          state[i].from.copy(state[i].spot);
          state[i].stepT = 0;
          stepping++;
        }
      }
      legs.forEach((leg, i) => {
        const st = state[i];
        leg.foot.getWorldPosition(vT);
        // Planted: the foot bone within `stanceH` of the lowest it has been (its sole's height above the
        // bone differs per rig: the toad's ankle bones sit 2–3 units up even flat on the grass, so a
        // test against the ground itself never locked his feet and he glided).
        // (heights over the ground it stands on — the Ash Floor's stairs and altar raise it, floorh3d.js)
        const yRel = vT.y - ground;
        // (the lowest over the last FLOOR_SPAN to 1.5×, in three bins of half of it: the lowest ever, one low reading — his
        // lash's lunge put two feet 2-3 under the ground — kept those feet unplanted for the rest of the fight, never once
        // between two of his leaps, .scratch/fix/boss.mjs; the window is long against a step, so a foot held up for one
        // never becomes the floor)
        if (enabled) {
          st.bins[0] = Math.min(st.bins[0], yRel);
          if ((st.binT += dt) >= FLOOR_SPAN / 2) (st.binT = 0), (st.bins[2] = st.bins[1]), (st.bins[1] = st.bins[0]), (st.bins[0] = yRel);
          st.floor = Math.min(st.bins[0], st.bins[1], st.bins[2]);
        }
        const inStance = enabled && yRel - Math.max(0, st.floor) < stanceH;
        if (st.stepT >= 0) {
          // Stepping: from where it stood to where the pose wants it now, on a low arc; then planted.
          st.stepT += dt / stepTime;
          const k = Math.min(1, st.stepT);
          const e = k * k * (3 - 2 * k);
          st.to.copy(poseAt[i]).addScaledVector(st.vel, stepTime * (1 - k) * lead);
          st.spot.set(st.from.x + (st.to.x - st.from.x) * e, 0, st.from.z + (st.to.z - st.from.z) * e);
          st.lift = Math.sin(Math.PI * k) * stepLift;
          st.locked = enabled;
          // (switched off mid-step: let go this frame too — held locked for it, the weight rose and the leg was pulled)
          if (k >= 1 || !enabled) (st.stepT = -1), (st.lift = 0), st.spot.copy(poseAt[i]);
        } else {
          st.lift = 0;
          if (inStance && !st.locked) {
            st.locked = true;
            st.spot.copy(vT);
          }
          if (!inStance) st.locked = false;
        }
        // In 25 ms, out over 50 ms.
        st.weight = st.locked ? Math.min(1, st.weight + dt / 0.025) : Math.max(0, st.weight - dt / 0.05);
        if (st.weight <= 0.001) return;
        // Where the foot should be: its locked spot (held at the height the clip gives it, lifted
        // while it steps).
        vT.set(st.spot.x, vT.y + (st.lift || 0), st.spot.z);
        // Two-bone IK: first bend the knee so hip→foot spans the right distance, then aim the thigh.
        const hip = leg.thigh.getWorldPosition(vHip);
        const knee = leg.shin.getWorldPosition(vKnee);
        const foot = leg.foot.getWorldPosition(vFoot);
        const a = hip.distanceTo(knee);
        const b = knee.distanceTo(foot);
        const want = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, hip.distanceTo(vT)));
        const now = hip.distanceTo(foot);
        // The knee angle for `want`, against the one it has: bend the shin about the knee.
        const cosWant = (a * a + b * b - want * want) / (2 * a * b);
        const cosNow = (a * a + b * b - now * now) / (2 * a * b);
        const delta = Math.acos(Math.max(-1, Math.min(1, cosWant))) - Math.acos(Math.max(-1, Math.min(1, cosNow)));
        if (Math.abs(delta) > 1e-4) {
          // The bend axis: perpendicular to the leg's plane (hip, knee, foot).
          vPole.subVectors(knee, hip).cross(vTmp.subVectors(foot, knee)).normalize();
          if (vPole.lengthSq() > 0.5) {
            leg.shin.parent.getWorldQuaternion(qP);
            leg.shin.getWorldQuaternion(qW);
            qA.setFromAxisAngle(vPole, -delta * st.weight);
            qW.premultiply(qA);
            leg.shin.quaternion.copy(qP.invert().multiply(qW));
            leg.shin.updateMatrixWorld(true);
          }
        }
        leg.foot.getWorldPosition(vFoot);
        aimBone(leg.thigh, vFoot, vT, st.weight);
      });
    },
    reset() {
      for (const st of state) (st.locked = false), (st.weight = 0), (st.stepT = -1), (st.lift = 0), (st.floor = Infinity), st.bins.fill(Infinity), (st.binT = 0);
    },
    /** Each foot's state (locked, weight, floor …), for the probes. */
    get state() {
      return state;
    },
  };
}
