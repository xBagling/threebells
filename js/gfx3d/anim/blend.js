// Inertialization for the 3D characters (docs/3D-PLAN.md 7.2): every change of clip starts from
// the pose actually on screen and settles into the new one with a short half-life, so a roll, a
// swing or a hurt never pops, and nothing ever stalls the way a frozen-snapshot crossfade does.
//
// Each bone keeps the pose last shown. When the clip changes, the difference between that pose and
// the new target is stored as an offset (a rotation per bone, and a position for bones that move);
// every frame after, the offset shrinks by half every `halfLife` seconds of sim-view time, so a
// hit-stop holds it too. A change interrupted by another simply takes a new offset from what is
// showing, so chains of changes never pop either.
import { Quaternion, Vector3 } from "../three-lib.js?v=df092a6";

const IDENT = new Quaternion();
const tmpQ = new Quaternion();

export function makeInertializer(bones) {
  const shownQ = bones.map((b) => b.quaternion.clone());
  const shownP = bones.map((b) => b.position.clone());
  const offQ = bones.map(() => new Quaternion());
  const offP = bones.map(() => new Vector3());
  let half = 0.07;
  let age = 1e9;
  let primed = false;
  const index = new Map(bones.map((b, i) => [b, i]));

  return {
    /** How much of the last change's offset is still on (1 at the change, falling to 0). */
    get weight() {
      return Math.pow(2, -age / Math.max(1e-4, half));
    },
    /**
     * Re-record `which` bones as shown, after layers that pose them past the clip (the hero's legs,
     * solved by anim/stride.js): the next change then blends from the pose truly on screen, not the
     * clip's (a roll out of a planted stride otherwise started from legs the screen never showed).
     */
    capture(which) {
      for (const b of which) {
        const i = index.get(b);
        if (i == null) continue;
        shownQ[i].copy(b.quaternion);
        shownP[i].copy(b.position);
      }
    },
    /**
     * Call after the sampler has posed the target. `halfLife` is non-null on the frame a change
     * happened; `dt` is sim-view seconds since the last frame.
     */
    apply(halfLife, dt) {
      if (!primed) {
        bones.forEach((b, i) => (shownQ[i].copy(b.quaternion), shownP[i].copy(b.position)));
        primed = true;
        return;
      }
      if (halfLife != null) {
        // A new change: the offset is what is showing, relative to the new target.
        for (let i = 0; i < bones.length; i++) {
          offQ[i].copy(shownQ[i]).multiply(tmpQ.copy(bones[i].quaternion).invert());
          offP[i].copy(shownP[i]).sub(bones[i].position);
        }
        half = halfLife;
        age = 0;
      } else age += dt;
      const f = Math.pow(2, -age / Math.max(1e-4, half));
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i];
        if (f > 1e-3) {
          tmpQ.copy(IDENT).slerp(offQ[i], f);
          b.quaternion.premultiply(tmpQ);
          b.position.addScaledVector(offP[i], f);
        }
        shownQ[i].copy(b.quaternion);
        shownP[i].copy(b.position);
      }
    },
  };
}
