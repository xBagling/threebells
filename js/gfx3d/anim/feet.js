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
import { Vector3, Quaternion } from "../three-lib.js?v=8898846";

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
 * `legs`: [{ thigh, shin, foot }] bones. `ground` the world height of the floor; `stanceH` how
 * close to it a sole counts as planted (world units).
 */
export function makeFeet(legs, { stanceH = 0.9, stepAt = 2.2, stepTime = 0.17, stepLift = 1.3, maxStepping = 1, lead = 0.6 } = {}) {
  const state = legs.map(() => ({ locked: false, spot: new Vector3(), weight: 0, from: new Vector3(), to: new Vector3(), stepT: -1, vel: new Vector3(), last: null, floor: Infinity }));
  const poseAt = legs.map(() => new Vector3()); // where the pose puts each foot this frame
  return {
    /** After the pose is sampled and the model's world matrices are current. `dt` sim-view seconds. */
    apply(dt, { enabled = true, ground = 0, standing = false } = {}) {
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
      if (standing && enabled) {
        let stepping = state.filter((st) => st.stepT >= 0).length;
        const order = state
          .map((st, i) => [i, st.locked && st.stepT < 0 ? Math.hypot(st.spot.x - poseAt[i].x, st.spot.z - poseAt[i].z) : 0])
          .filter(([, d]) => d > stepAt)
          .sort((a, b) => b[1] - a[1]);
        for (const [i] of order) {
          if (stepping >= maxStepping) break;
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
        if (enabled) st.floor = Math.min(st.floor, vT.y);
        const inStance = enabled && vT.y - Math.max(ground, st.floor) < stanceH;
        if (st.stepT >= 0) {
          // Stepping: from where it stood to where the pose wants it now, on a low arc; then planted.
          st.stepT += dt / stepTime;
          const k = Math.min(1, st.stepT);
          const e = k * k * (3 - 2 * k);
          st.to.copy(poseAt[i]).addScaledVector(st.vel, stepTime * (1 - k) * lead);
          st.spot.set(st.from.x + (st.to.x - st.from.x) * e, 0, st.from.z + (st.to.z - st.from.z) * e);
          st.lift = Math.sin(Math.PI * k) * stepLift;
          st.locked = true;
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
      for (const st of state) (st.locked = false), (st.weight = 0), (st.stepT = -1), (st.lift = 0);
    },
  };
}
