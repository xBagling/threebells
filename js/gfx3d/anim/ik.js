// Two-bone IK and world-space bone turns and moves for the 3D characters' procedural layers (docs/3D-PLAN.md
// 7.3): the sword arm and the off hand in the cuts and the carry (swing3d.js), the legs when the cut
// shifts the hips over planted feet. Everything works on three's bone objects in world space, after
// the pose is sampled and the model's world matrices are current, and reuses its vectors (no
// allocation per frame).
import { Vector3, Quaternion } from "../three-lib.js?v=df092a6";

const tA = new Vector3(); // aimAt's own
const tB = new Vector3();
const tC = new Vector3();
const vA = new Vector3();
const vC = new Vector3();
const vE = new Vector3();
const vN = new Vector3();
const vX = new Vector3();
const vS = new Vector3();
const vM = new Vector3();
const vW = new Vector3();
const qA = new Quaternion();
const qP = new Quaternion();
const qW = new Quaternion();
const IDENT = new Quaternion();
const vO = new Vector3(); // shiftWorld's own

/** Turn `bone` by the world rotation `q` (partly, by `amount`), about its own origin. */
export function turnWorld(bone, q, amount = 1) {
  qA.copy(q);
  if (amount < 1) qA.slerp(IDENT, 1 - amount);
  bone.parent.getWorldQuaternion(qP);
  bone.getWorldQuaternion(qW);
  qW.premultiply(qA);
  bone.quaternion.copy(qP.invert().multiply(qW));
  bone.updateMatrixWorld(true);
}

/** Move `bone` by the world offset `off` (its parent's frame does the rest). */
export function shiftWorld(bone, off) {
  bone.getWorldPosition(vO).add(off);
  bone.parent.worldToLocal(vO);
  bone.position.copy(vO);
  bone.updateMatrixWorld(true);
}

/** Set `bone`'s world rotation to `q` (partly, by `amount`: a slerp from the one it has). */
export function setWorldQuaternion(bone, q, amount = 1) {
  bone.parent.getWorldQuaternion(qP).invert();
  qW.copy(qP).multiply(q); // the local rotation that gives `q`
  if (amount < 1) bone.quaternion.slerp(qW, amount);
  else bone.quaternion.copy(qW);
  bone.updateMatrixWorld(true);
}

/** Turn `bone` so the point `from` (world, carried by the bone) swings onto the direction of `to`. */
function aimAt(bone, from, to, amount = 1) {
  bone.getWorldPosition(tA);
  tB.subVectors(from, tA);
  tC.subVectors(to, tA);
  if (tB.lengthSq() < 1e-10 || tC.lengthSq() < 1e-10) return;
  qA.setFromUnitVectors(tB.normalize(), tC.normalize());
  turnWorld(bone, qA, amount);
}

/**
 * Two-bone IK: `upper` (shoulder or hip), `lower` (elbow or knee), `end` (wrist or ankle) bones.
 * Moves `end` onto `target` (world), the middle joint bending towards `pole` (a world direction from
 * the root), and blends by `weight`. Lengths come from the pose itself, so any scale works; an
 * out-of-reach target is reached for in a straight line. Returns how far off the end stays.
 */
export function twoBoneIK(upper, lower, end, target, pole, weight = 1) {
  if (weight <= 1e-4) return 0;
  // At part weight the solve is made in full and the two joints' rotations blended from where they
  // were by `weight` (the elbow's plane with them). Blending only the goal, as before, put the elbow
  // on the pole's plane at any weight above zero, so every fade of an arm's IK started or ended with
  // the elbow jumping (a stop from a run: the free elbow 0.99 units in one frame; after a hit, the
  // sword elbow 1.13: the CODE lens).
  const part = weight < 1 - 1e-4;
  if (part) {
    qU0.copy(upper.quaternion);
    qL0.copy(lower.quaternion);
  }
  upper.getWorldPosition(vS);
  lower.getWorldPosition(vM);
  end.getWorldPosition(vW);
  const a = vS.distanceTo(vM);
  const b = vM.distanceTo(vW);
  vE.copy(target);
  vX.subVectors(vE, vS);
  const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, vX.length()));
  vX.normalize();
  // The middle joint: along the root→goal line by the law of cosines, pushed out towards the pole.
  const along = (a * a - b * b + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(0, a * a - along * along));
  // No pole: the middle joint keeps the side it bends to now.
  if (pole) vN.copy(pole).addScaledVector(vX, -pole.dot(vX));
  if (!pole || vN.lengthSq() < 1e-8) vN.subVectors(vM, vS).addScaledVector(vX, -vC.subVectors(vM, vS).dot(vX));
  if (vN.lengthSq() < 1e-8) vN.set(0, -1, 0).addScaledVector(vX, vX.y);
  vN.normalize();
  const mid = vC.copy(vS).addScaledVector(vX, along).addScaledVector(vN, out);
  aimAt(upper, vM, mid, 1);
  end.getWorldPosition(vW);
  lower.getWorldPosition(vM);
  const goal = vA.copy(vS).addScaledVector(vX, d);
  aimAt(lower, vW, goal, 1);
  if (part) {
    upper.quaternion.copy(qU0.slerp(upper.quaternion, weight));
    lower.quaternion.copy(qL0.slerp(lower.quaternion, weight));
    upper.updateMatrixWorld(true);
    end.getWorldPosition(vW);
    return vW.distanceTo(vE.lerpVectors(vW, target, weight));
  }
  end.getWorldPosition(vW);
  return vW.distanceTo(vE);
}
const qU0 = new Quaternion();
const qL0 = new Quaternion();
