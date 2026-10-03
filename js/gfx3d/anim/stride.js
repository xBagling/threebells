// The hero's legs on the ground at every speed, from a creep to a sprint (his movement guide,
// "Locomotion at every speed"; the owner, 2026-10-03: "make it look good in all movement speeds").
// The hero's own: feet.js stays as it is for the bosses.
//
// What was wrong (measured, .scratch/loco): slow walks were made by mixing the idle in, which shrank
// the stride and the foot lift, so at 8–14 u/s both feet locked for good and were dragged straight-
// legged behind him; feet.js plants by height alone, so in a walk it pinned a foot mid-swing, held it
// through heel-off at full stretch and snapped it free 2–4 units (3–27 pops a second); and the walk
// played at up to 4.8× its own pace. Here the gait is chosen by speed (hero-anim3d.js gaitAt: cadence,
// walk/run blend, stride warp k) and the legs follow it:
//
//  0. captureGait(): right after the legs layer (the walk/run alone) is sampled, where the GAIT puts
//     each foot (ankle, sole points, foot rotation) and the hips, in the model's own frame — so the
//     body above may be mixed with the idle or a swing without moving the feet;
//  1. apply(), after the lean, squash and living layers: the source pose (the gait's feet blended with
//     the shown pose's by the legs' weight), each foot moved along the stride by (k − 1) × its ball's
//     offset ahead of the hips (the stride warp: shorter steps, never a slide), heights kept;
//  2. contact on real sole points (a hull of the sole, three of them pivots: heel, ball, toe tip): a
//     foot that touches inside its phase window plants at the pivot that touches and rolls heel →
//     ball → tip; it lets go when nothing touches, in deep swing, when its spot pulls too far behind
//     the warped pose, or when a rolled-off leg would straighten; a release fades over a part of a
//     cycle, never faster than a cap;
//  3. floors: no sole point under the grass; walking, a released or swinging foot clears it;
//  4. the pelvis lowered (on a spring) only as far as a leg needs, and the run's bob scaled down;
//  5. two-bone IK per leg, the knee in the clip's own plane, the leg never past EXT_MAX of its length;
//     then the foot's world rotation put back to the source's (the sole keeps the clip's angle).
// Standing (the legs' weight under a half, or the body still), planted feet hold, a foot in the air
// settles, and one at a time steps when it is left behind, far ahead, out to the side or turned.
import { Vector3, Quaternion } from "../three-lib.js?v=8898846";
import { twoBoneIK, setWorldQuaternion } from "./ik.js?v=8898846";
import { springCritical } from "./procedural.js?v=8898846";

export const STRIDE = Object.freeze({
  EPS: 0.1, // a sole point this close to the grass touches it
  EPS_OFF: 0.3, // a planted foot is let go when its lowest point is this high (hysteresis)
  EXT_MAX: 0.995, // the IK never straightens a leg past this share of its length
  EXT_RELEASE: 0.985, // a foot rolled onto its ball or toes is let go when holding it needs more
  PULL: 0.3, // ... or when its spot trails the warped pose by this much (+ PULL_C × the cycle)
  PULL_C: 0.06,
  YAW_MAX: 0.6, // a planted foot keeps its yaw (rad) while the body turns, at most this far from the pose's
  YAW_STEP: 0.5, // standing, a foot turned this far from the pose's takes a step
  SETTLE_TIME: 0.2, // stopping, a foot in the air settles onto the pose's spot over this long, on a low arc
  SETTLE_LIFT: 0.5,
  BOB_RUN: 0.5, // running, the hips' rise and fall kept to this share of the run clip's (its 2.05 u is a sprinter's 19 cm)
  BOB_HALF: 0.25, // the hips' mean height, low-passed (s)
  TRAVEL_MAX: 1.75, // the stride turned at most this far (rad, 100°) off the facing towards the travel
  WALK_MIN: 1.0, // the body's own speed (u/s) below which the feet stand ...
  STAND_AFTER: 0.05, // ... for this long (a reversal passes through 0 in one tick)
  REL_VMAX: 40, // a release's catch-up never moves the foot faster than this (+ REL_VMAX_K × speed) u/s
  REL_VMAX_K: 1.5,
  STEP_SETTLED: 0.15, // standing steps wait till the legs' gait weight is below this (the pose at its stand)
  STEP_AT: 1.6, // standing, a foot this far behind where the pose wants it steps ...
  STEP_AHEAD: 3.2, // ... or this far ahead (no stepping back after a stop) ...
  STEP_SIDE: 1.4, // ... or this far out to the side
  STEP_TIME: 0.16,
  STEP_LIFT: 1.2,
  REL_PHASE: 0.12, // a release fades over this share of a cycle
  REL_TIME: 0.3, // ... or this long, whichever comes first
  REL_FLOOR: 0.12, // a released foot's lowest point is kept at least this high
  FREE_FLOOR: 0.1, // ... and a swinging one, until it is about to land (FREE_LAND of the way to its landing)
  FREE_LAND: 0.85,
  SWING_CLEAR: 0.3, // walking, the swing foot's lowest point is kept this high at mid-swing
  PELVIS_EXT: 0.99, // the hips come down when a leg would need more than this share of its length
  PELVIS_MAX: 1.2,
  PELVIS_HALF: 0.04,
  GATE_ON: [0.4, 0.82], // the left foot may plant in this phase window (the right: +0.5)
  GATE_OFF: [0.27, 0.4], // the left foot is never planted in this one (deep swing)
  GATE_ON_BACK: [0.75, 0.25], // walking backwards the phase runs down: it plants from the reversed toe-off
  SIDE_MIN: 1.2, // each foot's ball kept at least this far to its own side of the hips (no crossing)
  TURN_FADE: [0.35, 0.8], // the stride's turn towards the travel fades out while the body's yaw is this far (rad) behind its facing
  SETTLE_HEEL: 0.5, // standing, a foot touching only by its toe with its heel this high settles instead of planting
  SETTLE_REF: 1.0, // a settle from this high takes the whole SETTLE_TIME, a lower one less (down to SETTLE_MIN of it)
  SETTLE_MIN: 0.4,
  RETARGET: 0.6, // a step or settle follows the pose's spot only this far through (later, a turning body swept it over the grass)
  TURN_RATE: 9, // the stride's axis turns at most this fast (rad/s) off the facing (a backward flip threw the feet 6–11 u)
});

const inWin = (u, [a, b]) => {
  u = ((u % 1) + 1) % 1;
  return a <= b ? u >= a && u < b : u >= a || u < b;
};
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const UPV = new Vector3(0, 1, 0);

/**
 * `legs` = [{ thigh, shin, foot, toe }], `hips` the hips bone, `contacts` from soleContacts, `model` the
 * object the clips pose (its frame holds the captured gait). Returns { captureGait, apply, reset, state }.
 */
export function makeHeroStride(legs, hips, contacts, model) {
  const S = STRIDE;
  const N = legs.length;
  const mk = () => new Vector3();
  // mode: 0 free, 1 planted, 2 letting go (fading), 3 stepping or settling
  const st = legs.map(() => ({ mode: 0, pivot: 0, spot: mk(), tgt: mk(), rel: mk(), relW: 0, relU: 0, relPivot: 1, relYaw: 0, lifted: false, from: mk(), stepT: -1, stepDur: STRIDE.STEP_TIME, stepLift: STRIDE.STEP_LIFT, stepYaw: 0, settle: false, faceLock: 0, dyaw: 0, prog: 1, lo: 0, locked: false, weight: 0 }));
  // the shown and warped pose per foot: ankle (A, A0 before the warp, Aw after), thigh, knee, rotation,
  // the ankle's target, the knee's plane, the sole points (pts, pts0 before the warp)
  const P = contacts.map((c) => ({ A: mk(), A0: mk(), Aw: mk(), Th: mk(), Kn: mk(), Q: new Quaternion(), At: mk(), last: mk(), pole: mk(), q0th: new Quaternion(), q0sh: new Quaternion(), pts: c.pts.map(mk), pts0: c.pts.map(mk) }));
  // the gait's own feet and hips, in the model's frame
  const G = contacts.map((c) => ({ A: mk(), Q: new Quaternion(), pts: c.pts.map(mk) }));
  const gHips = mk();
  let gOn = false;
  const O = mk();
  const F = mk();
  const Gd = mk();
  const Sd = mk();
  const d = mk();
  const tmp = mk();
  const tq = new Quaternion();
  const mq = new Quaternion();
  const qY = new Quaternion();
  let pd = 0;
  let pv = 0;
  let hm = null;
  let standT = 0;
  let gdRel = 0; // the stride axis's turn off the facing, rate-limited
  let lastBlend = 0;
  const L = legs.map(() => 0);
  const out = { rear: "L", pelvis: 0, bob: 0 };
  const lowest = (p) => {
    let lo = Infinity;
    for (const q of p.pts) lo = Math.min(lo, q.y);
    return lo;
  };
  const piv = (i, k) => P[i].pts[contacts[i].pivots[k]];
  const piv0 = (i, k) => P[i].pts0[contacts[i].pivots[k]];
  function touchingPivot(i, g) {
    for (let k = 0; k < 3; k++) if (piv(i, k).y - g < S.EPS) return k;
    return lowest(P[i]) - g < S.EPS ? 2 : -1;
  }
  function worldPts(i, outPts) {
    const c = contacts[i];
    const leg = legs[i];
    for (let j = 0; j < c.pts.length; j++) {
      outPts[j].copy(c.pts[j].p);
      (c.pts[j].bone ? leg.toe : leg.foot).localToWorld(outPts[j]);
    }
  }
  /** The foot turned about the vertical by dy (rad) about the world point (cx, cz): its rotation and ankle target. */
  function turnFoot(p, dy, cx, cz) {
    if (Math.abs(dy) < 1e-5) return;
    qY.setFromAxisAngle(UPV, dy);
    p.Q.premultiply(qY);
    const x = p.At.x - cx;
    const z = p.At.z - cz;
    const c = Math.cos(dy);
    const sn = Math.sin(dy);
    // (three's rotation about +y: x' = x cos + z sin, z' = −x sin + z cos)
    p.At.x = cx + x * c + z * sn;
    p.At.z = cz - x * sn + z * c;
  }
  /**
   * The sole as posed now (the toe keeps the shown pose's own turn, which the points before the IK did
   * not have): any part still under the grass lifts the ankle by as much (a hurt's end and a roll's end
   * sank it 0.3–0.6).
   */
  function liftOut(i, ground, cap) {
    const leg = legs[i];
    const p = P[i];
    leg.toe.updateMatrixWorld(true);
    worldPts(i, p.pts);
    const dep = ground - lowest(p);
    if (dep > 1e-3) {
      p.At.y += dep;
      tmp.subVectors(p.At, p.Th);
      const l2 = tmp.length();
      if (l2 > cap) p.At.copy(p.Th).addScaledVector(tmp, cap / l2);
      // (solved again from the pose the first solve started from: from its result, the residual under
      // the squash's scale moved a planted foot 0.15 in x and z for a lift of 0.02)
      leg.thigh.quaternion.copy(p.q0th);
      leg.shin.quaternion.copy(p.q0sh);
      leg.thigh.updateMatrixWorld(true);
      twoBoneIK(leg.thigh, leg.shin, leg.foot, p.At, p.pole, 1);
      setWorldQuaternion(leg.foot, p.Q);
    }
    leg.foot.getWorldPosition(p.last);
  }
  /** In a roll, the fall and the win (nothing planted): only the soles kept out of the grass. */
  function floorPass(ground) {
    for (const s of st) (s.mode = 0), (s.locked = false), (s.weight = 0), (s.stepT = -1);
    for (let i = 0; i < N; i++) {
      const leg = legs[i];
      const p = P[i];
      leg.foot.updateWorldMatrix(true, true);
      leg.foot.getWorldPosition(p.At);
      leg.foot.getWorldQuaternion(p.Q);
      leg.thigh.getWorldPosition(p.Th);
      leg.shin.getWorldPosition(p.Kn);
      L[i] = p.Th.distanceTo(p.Kn) + p.Kn.distanceTo(p.At);
      p.pole.copy(p.Th).add(p.At).multiplyScalar(0.5);
      p.pole.subVectors(p.Kn, p.pole);
      if (p.pole.lengthSq() < 0.04) continue;
      p.pole.normalize();
      p.q0th.copy(leg.thigh.quaternion);
      p.q0sh.copy(leg.shin.quaternion);
      liftOut(i, ground, S.EXT_MAX * L[i]);
    }
    pd = pv = 0;
    gdRel = 0;
    return out;
  }
  /** Let a foot go: its offset from the pose kept, fading (mode 2); never planted again this frame. */
  function release(s, ox, oz, u) {
    s.mode = 2;
    s.relPivot = s.pivot;
    s.rel.set(ox, 0, oz);
    s.relYaw = s.dyaw;
    s.relW = 1;
    s.relU = ((u % 1) + 1) % 1;
    s.prog = 0;
    s.justRel = true;
    s.lifted = false;
  }
  /** Start a step (or a settle) towards the pose's spot for this foot, `cur` its pivot as posed now. */
  function startStep(s, cur, settle, dur, lift) {
    s.mode = 3;
    s.stepT = 0;
    s.settle = settle;
    s.stepDur = dur;
    s.stepLift = lift;
    s.tgt.set(cur.x, 0, cur.z);
  }

  return {
    // (read by the checks)
    state: st,
    legs,
    contacts,
    poseAt: P.map((p) => p.Aw), // (each foot's ankle as the warped pose puts it, before planting)
    /** Right after the legs layer (the gait alone) is sampled: where it puts the feet, in the model's frame. */
    captureGait() {
      for (let i = 0; i < N; i++) legs[i].toe.updateWorldMatrix(true, false);
      model.getWorldQuaternion(mq).invert();
      for (let i = 0; i < N; i++) {
        const g = G[i];
        legs[i].foot.getWorldPosition(g.A);
        model.worldToLocal(g.A);
        legs[i].foot.getWorldQuaternion(g.Q).premultiply(mq);
        worldPts(i, g.pts);
        for (const q of g.pts) model.worldToLocal(q);
      }
      hips.getWorldPosition(gHips);
      model.worldToLocal(gHips);
      gOn = true;
    },
    /**
     * `ctx` = { enabled, moving (0..1, the legs' gait weight), k (stride warp), phase, r (run weight),
     * tdL (the left foot's touchdown phase), C (u a cycle), speed (u/s), travel (world rad or null),
     * face (world rad), dPhase (the phase's change this frame), slide (shoved: nothing planted), ground }.
     * Returns { rear: "L" | "R" (the foot further back: a start lifts it first), pelvis, bob }.
     */
    apply(dt, ctx) {
      const { enabled = true, moving = 0, k = 1, phase = 0, tdL = 0.48, r = 0, bobR = r, face = 0, faceTo = face, ground = 0, dPhase = 0, C = 13, speed = 99, travel = null, slide = false, back = false, blend = 0, floorOnly = false } = ctx;
      const PULL = S.PULL + S.PULL_C * C;
      // (the gait's feet weighed down while a change of clip is still blending in: the inertializer's
      // offset is on the shown pose, and the raw gait skipped it — roll → run popped a leg 86°; by the
      // root of the blend, since the shown legs carry the offset already and would settle twice as fast)
      const gW = moving * (1 - Math.sqrt(Math.max(0, blend)));
      // a change of clip this frame: a foot still letting go is rebased on the pose now shown
      const fresh = blend - lastBlend > 0.2;
      lastBlend = blend;
      const useG = gOn && gW > 0;
      gOn = false;
      if (floorOnly) return floorPass(ground);
      if (!enabled) {
        this.reset();
        return out;
      }
      // walking: the legs' gait on AND the body going (a stop is a stand at once: planted feet hold,
      // feet in the air settle; the gait's own weights fade after)
      standT = speed < S.WALK_MIN ? standT + dt : 0;
      // (from the first frames of a start: held standing until the legs were half in, the rear foot
      // stayed planted while the body moved off, rode up in the air and was flung out after)
      const walking = moving > 0.05 && standT < S.STAND_AFTER;
      F.set(Math.cos(face), 0, Math.sin(face));
      // the stride's own axis: the way he travels (a swing while moving sideways or back steps that way),
      // the turn faded out while the body's yaw still lags its facing (a reversal or a spin: turned while
      // the body caught up, the feet were thrown 6–15 units in a frame)
      // — and turned at most TURN_RATE: a backward flip of the travel, or a stop inside a sideways swing
      // (no travel), swings it over a few frames instead of one
      let relT = 0;
      if (travel != null) {
        const lag = Math.abs(wrapA(faceTo - face));
        const fade = 1 - (lag <= S.TURN_FADE[0] ? 0 : lag >= S.TURN_FADE[1] ? 1 : ((x) => x * x * (3 - 2 * x))((lag - S.TURN_FADE[0]) / (S.TURN_FADE[1] - S.TURN_FADE[0])));
        relT = fade * Math.max(-S.TRAVEL_MAX, Math.min(S.TRAVEL_MAX, wrapA(travel - face)));
      }
      gdRel += Math.max(-S.TURN_RATE * dt, Math.min(S.TURN_RATE * dt, wrapA(relT - gdRel)));
      Gd.set(Math.cos(face + gdRel), 0, Math.sin(face + gdRel)).multiplyScalar(gW).addScaledVector(F, 1 - gW).normalize();
      Sd.set(-F.z, 0, F.x); // his left-to-right axis
      if (useG) {
        O.copy(gHips);
        model.localToWorld(O);
        model.getWorldQuaternion(mq);
      } else hips.getWorldPosition(O);
      // (by the gait's own weight: the shown pose in a blend was warped last frame already)
      const ke = 1 + (k - 1) * gW;
      const dOf = (q) => (q.x - O.x) * F.x + (q.z - O.z) * F.z;
      // 1. the source pose
      for (let i = 0; i < N; i++) {
        const leg = legs[i];
        const p = P[i];
        leg.foot.getWorldPosition(p.A);
        leg.foot.getWorldQuaternion(p.Q);
        leg.thigh.getWorldPosition(p.Th);
        leg.shin.getWorldPosition(p.Kn);
        L[i] = p.Th.distanceTo(p.Kn) + p.Kn.distanceTo(p.A);
        // the knee's plane, from the shown pose
        p.pole.copy(p.Th).add(p.A).multiplyScalar(0.5);
        p.pole.subVectors(p.Kn, p.pole);
        if (p.pole.lengthSq() < 0.04) p.pole.copy(F);
        p.pole.normalize();
        worldPts(i, p.pts);
        if (useG) {
          const g = G[i];
          tmp.copy(g.A);
          model.localToWorld(tmp);
          p.A.lerp(tmp, gW);
          tq.copy(mq).multiply(g.Q);
          p.Q.slerp(tq, gW);
          for (let j = 0; j < p.pts.length; j++) {
            tmp.copy(g.pts[j]);
            model.localToWorld(tmp);
            p.pts[j].lerp(tmp, gW);
          }
        }
        p.A0.copy(p.A);
        for (let j = 0; j < p.pts.length; j++) p.pts0[j].copy(p.pts[j]);
      }
      // the warp: each foot moved along the stride by (k − 1) × its ball's offset ahead of the hips
      // (the ball: the contact through most of a stance; the ankle pulled 0.6 at heel-off)
      const warp = (i) => {
        const s = st[i];
        const p = P[i];
        const u = phase + (i === 0 ? 0 : 0.5);
        // how far through its swing (backwards, the phase runs down from the release to the toe-off)
        const land = back ? tdL - 0.3 : tdL;
        const td = (((back ? s.relU - land - (i === 0 ? 0 : 0.5) : land + (i === 0 ? 0 : 0.5) - s.relU) % 1) + 1) % 1 || 1;
        s.prog = Math.min(1, ((((back ? s.relU - u : u - s.relU) % 1) + 1) % 1) / td);
        const dx = dOf(piv0(i, 1));
        d.copy(Gd).multiplyScalar(ke * dx).addScaledVector(F, -dx);
        // each foot kept on its own side (a stride turned across the facing crossed the legs through
        // each other: moving sideways through a swing, a third of the frames)
        const sg = Math.sign((p.Th.x - O.x) * Sd.x + (p.Th.z - O.z) * Sd.z) || (i === 0 ? -1 : 1);
        const lat = (piv0(i, 1).x - O.x + d.x) * Sd.x + (piv0(i, 1).z - O.z + d.z) * Sd.z;
        if (sg * lat < S.SIDE_MIN) d.addScaledVector(Sd, sg * (S.SIDE_MIN - sg * lat));
        p.A.copy(p.A0).add(d);
        for (let j = 0; j < p.pts.length; j++) p.pts[j].copy(p.pts0[j]).add(d);
        p.Aw.copy(p.A);
      };
      // 2. contact
      const stepping = st.some((s) => s.mode === 3);
      let order = null;
      for (let i = 0; i < N; i++) {
        const s = st[i];
        const p = P[i];
        const u = phase + (i === 0 ? 0 : 0.5);
        s.justRel = false;
        if (s.mode === 1 && walking) {
          // the roll: heel → ball → tip, the next point planted where it is drawn (heights and the
          // foot's own shape only: the same before and after the warp; the offset turned by the yaw
          // the planted foot is drawn with, else a turn jumped it 0.35 at the hand-over)
          for (let q = s.pivot + 1; q <= 2 && piv0(i, s.pivot).y - ground >= S.EPS; q++) {
            const nx = piv0(i, q);
            if (nx.y - ground < S.EPS) {
              const cur = piv0(i, s.pivot);
              const dy = Math.max(-S.YAW_MAX, Math.min(S.YAW_MAX, wrapA(face - s.faceLock)));
              const c = Math.cos(dy);
              const sn = Math.sin(dy);
              const dx = nx.x - cur.x;
              const dz = nx.z - cur.z;
              s.spot.set(s.spot.x + dx * c + dz * sn, 0, s.spot.z - dx * sn + dz * c);
              s.pivot = q;
              break;
            }
          }
        }
        warp(i);
        const touch = slide ? -1 : touchingPivot(i, ground);
        p.At.copy(p.A);
        // a change of clip: the shown pose already carries this foot's offset from last frame; kept as
        // is, it was added again (a released foot popped 6 at a swing → swing change)
        if (fresh && s.mode === 2) {
          const w = Math.max(0.05, s.relW * s.relW * (3 - 2 * s.relW));
          s.rel.set((p.last.x - p.Aw.x) / w, 0, (p.last.z - p.Aw.z) / w);
          s.relYaw = 0;
        }
        // shoved by a hard blow: nothing planted, the feet go with the clip, kept on the grass
        if (slide && (s.mode === 1 || s.mode === 3)) {
          const cur = piv(i, s.pivot);
          s.dyaw = 0;
          release(s, s.spot.x - cur.x, s.spot.z - cur.z, u);
        }
        // going again in the middle of a step or a settle: let go from where it is shown
        if (walking && s.mode === 3) {
          const cur = piv(i, s.pivot);
          s.settle = false;
          s.dyaw = 0;
          release(s, s.spot.x - cur.x, s.spot.z - cur.z, u);
        }
        if (s.mode === 1) {
          const cur = piv(i, s.pivot);
          const ox = s.spot.x - cur.x;
          const oz = s.spot.z - cur.z;
          p.At.x += ox;
          p.At.z += oz;
          // its yaw kept from the landing: only the body's own turn since then is undone
          s.dyaw = Math.max(-S.YAW_MAX, Math.min(S.YAW_MAX, wrapA(face - s.faceLock)));
          turnFoot(p, s.dyaw, s.spot.x, s.spot.z);
          if (walking) {
            // (only a trailing or sideways pull counts: a foot ahead of the pose is a landing)
            const pull = Math.max(0, -(ox * Gd.x + oz * Gd.z)) + 0.5 * Math.abs(ox * Gd.z - oz * Gd.x);
            const ext = p.Th.distanceTo(p.At) / L[i];
            // (also when the planted point itself has risen: a toe tip held in x and z rode 0.8 up)
            const off = lowest(p) - ground > S.EPS_OFF || cur.y - ground > S.EPS_OFF || inWin(u, S.GATE_OFF) || pull > PULL || (s.pivot > 0 && ext > S.EXT_RELEASE);
            if (off) {
              // the offset before this frame's turn, and the turn taken off the foot (the fade below
              // turns both again by relYaw: twice turned, a release in a turn twitched the foot 50°)
              release(s, ox, oz, u);
              p.Q.premultiply(qY.setFromAxisAngle(UPV, -s.dyaw));
              p.At.copy(p.A);
            }
          } else {
            const ahead = ox * F.x + oz * F.z; // + : the foot stands ahead of where the pose wants it
            const side = Math.abs(ox * F.z - oz * F.x);
            // a step when a foot is left behind, far ahead (a stop leaves the front foot where it
            // landed), out to the side or turned; once the pose has come to its stand; the foot further
            // behind first
            let over = Math.max(-ahead - S.STEP_AT, ahead - S.STEP_AHEAD, side - S.STEP_SIDE, (Math.abs(s.dyaw) - S.YAW_STEP) * 3);
            // a foot the leg can no longer reach (the body turned or stopped past it) steps at once,
            // even while the other is stepping: held, it hung off the grass at the IK's cap
            const unreach = p.Th.distanceTo(p.At) / L[i] > S.EXT_MAX + 0.01;
            if (unreach) over = Math.max(over, 6);
            if ((moving < S.STEP_SETTLED || unreach) && over > 0) (order ||= []).push([i, over + (ahead < 0 ? 2 : 0), unreach]);
          }
        } else if (s.mode === 3) {
          s.stepT += dt / s.stepDur;
          const kk = Math.min(1, s.stepT);
          const e = kk * kk * (3 - 2 * kk);
          const cur = piv(i, s.pivot);
          // to where the pose wants it, a step or a settle alike (a settle held where the stop left it
          // came down out of the leg's reach and hung there), following it only RETARGET of the way
          if (kk < S.RETARGET) s.tgt.set(cur.x, 0, cur.z);
          s.spot.set(s.from.x + (s.tgt.x - s.from.x) * e, 0, s.from.z + (s.tgt.z - s.from.z) * e);
          p.At.x += s.spot.x - cur.x;
          p.At.z += s.spot.z - cur.z;
          p.At.y += Math.sin(Math.PI * kk) * s.stepLift;
          // a settle brings the foot down onto the grass by its end, whatever height the pose holds it at
          if (s.settle) p.At.y -= Math.max(0, lowest(p) - ground) * e;
          turnFoot(p, s.stepYaw * (1 - e), s.spot.x, s.spot.z);
          if (kk >= 1) {
            s.mode = 1;
            s.stepT = -1;
            s.spot.copy(s.tgt);
            s.faceLock = face;
            s.settle = false;
          }
        }
        if (s.mode === 2) {
          // letting go: the offset fades over REL_PHASE of a cycle (or REL_TIME), never faster than the cap
          const relLen = Math.hypot(s.rel.x, s.rel.z);
          const cap = relLen > 1e-3 ? ((S.REL_VMAX + S.REL_VMAX_K * speed) * dt) / (1.5 * relLen) : 1;
          s.relW -= Math.min(cap, Math.abs(dPhase) / S.REL_PHASE + dt / S.REL_TIME);
          if (lowest(p) - ground > S.EPS_OFF) s.lifted = true;
          if (s.relW <= 0) s.mode = 0;
          else {
            const w = s.relW * s.relW * (3 - 2 * s.relW);
            p.At.x += s.rel.x * w;
            p.At.z += s.rel.z * w;
            const pv0 = piv(i, s.relPivot);
            turnFoot(p, s.relYaw * w, pv0.x + s.rel.x * w, pv0.z + s.rel.z * w);
          }
        }
        // stopping: a foot in the air (or letting go, or touching only by its toe with the heel high)
        // settles onto the pose's spot on a low arc
        const heelUp = touch > 0 && piv(i, 0).y - ground > S.SETTLE_HEEL;
        if (!walking && !slide && (s.mode === 0 || s.mode === 2) && (touch < 0 || heelUp)) {
          const w = s.mode === 2 ? s.relW * s.relW * (3 - 2 * s.relW) : 0;
          s.pivot = 1;
          const cur = piv(i, 1);
          s.from.set(cur.x + (p.At.x - p.A.x), 0, cur.z + (p.At.z - p.A.z));
          s.stepYaw = (s.mode === 2 ? s.relYaw : 0) * w;
          s.spot.copy(s.from); // (a release cut short next frame starts from here, not the last plant)
          // the lower foot down sooner (both settling alike, he stood on nothing for up to 15 frames);
          // a foot only lowering its heel, without the arc
          const lo0 = lowest(p) - ground;
          startStep(s, cur, true, S.SETTLE_TIME * Math.max(S.SETTLE_MIN, Math.min(1, lo0 / S.SETTLE_REF)), heelUp ? 0 : S.SETTLE_LIFT);
        }
        // (a released foot plants again only once it has left the grass: re-planted where it lay, the
        // fade had swept it over the grass a frame before)
        if (!s.justRel && (s.mode === 0 || (s.mode === 2 && ((s.relW < 0.5 && s.lifted) || !walking)))) {
          const may = walking ? inWin(u, back ? S.GATE_ON_BACK : S.GATE_ON) : true;
          if (touch >= 0 && may) {
            // planted where it is drawn: a release's remaining offset and turn kept (dropped, the
            // turn snapped back the next frame and the pivot slid 0.29)
            const dy0 = s.mode === 2 ? s.relYaw * s.relW * s.relW * (3 - 2 * s.relW) : 0;
            s.mode = 1;
            s.pivot = touch;
            const cur = piv(i, touch);
            const x = cur.x - p.A.x;
            const z = cur.z - p.A.z;
            const c = Math.cos(dy0);
            const sn = Math.sin(dy0);
            s.spot.set(p.At.x + x * c + z * sn, 0, p.At.z - x * sn + z * c);
            s.faceLock = face - dy0;
            s.dyaw = dy0;
          }
        }
        // 3. floors: never under the grass; walking, a released or swinging foot clears it
        const lo = lowest(p) - ground;
        let lift = Math.max(0, -lo);
        if (walking && (s.mode === 0 || s.mode === 2)) {
          // (a free foot outside its window to plant kept clear too: lying on the grass, it was dragged)
          const free = s.mode === 0 && (s.prog < S.FREE_LAND || !inWin(u, back ? S.GATE_ON_BACK : S.GATE_ON));
          const floor = Math.max(s.mode === 2 ? S.REL_FLOOR : free ? S.FREE_FLOOR : 0, S.SWING_CLEAR * (1 - r) * Math.sin(Math.PI * s.prog));
          lift = Math.max(lift, floor - lo);
        }
        p.At.y += lift;
        s.lo = lo + lift; // (how high its sole is drawn: the footstep cues arm on it)
        s.locked = s.mode === 1 || s.mode === 3;
        s.weight = s.locked ? 1 : s.mode === 2 ? s.relW : 0;
        if (s.mode !== 3) s.stepT = -1;
      }
      // standing steps, one at a time, furthest first, to where the pose wants the foot
      if (order) {
        order.sort((a, b) => b[1] - a[1]);
        const [i0, , unreach] = order[0];
        if (!stepping || unreach) {
          const s = st[i0];
          s.stepYaw = s.dyaw;
          s.from.copy(s.spot);
          startStep(s, piv(i0, s.pivot), false, S.STEP_TIME, S.STEP_LIFT);
        }
      }
      // 4. the pelvis: lowered only as far as a leg needs
      let need = 0;
      for (let i = 0; i < N; i++) {
        const s = st[i];
        if (s.mode === 1 && s.pivot > 0) continue; // (a rolled-off foot is let go instead)
        const p = P[i];
        const h = Math.hypot(p.At.x - p.Th.x, p.At.z - p.Th.z);
        const R = S.PELVIS_EXT * L[i];
        const ok = h < R ? Math.sqrt(R * R - h * h) : 0;
        need = Math.max(need, p.Th.y - p.At.y - ok);
      }
      need = Math.min(S.PELVIS_MAX, Math.max(0, need));
      // (on its spring even in a hit-stop: dt 0 leaves it where it is — snapped, the hips dropped 0.9)
      [pd, pv] = springCritical(pd, pv, need, S.PELVIS_HALF, dt);
      pd = Math.max(0, pd);
      out.pelvis = pd;
      // the run's bob scaled down about the hips' own mean height
      hips.getWorldPosition(tmp);
      // (faded by the run's own weight, not cut when he stops: cut, the hips jumped 0.45 in a frame)
      // (by the run weight as far as the legs are on: standing after a run, the held gait kept it on)
      if (hm == null || bobR <= 0) hm = tmp.y;
      else hm += (tmp.y - hm) * (1 - Math.pow(2, -dt / S.BOB_HALF));
      const bob = -bobR * (1 - S.BOB_RUN) * (tmp.y - hm);
      out.bob = bob;
      if (pd > 1e-4 || Math.abs(bob) > 1e-4) {
        tmp.y += bob - pd;
        hips.parent.worldToLocal(tmp);
        hips.position.copy(tmp);
        hips.updateMatrixWorld(true);
      }
      // 5. IK, the leg's stretch capped, the source's foot angle kept
      for (let i = 0; i < N; i++) {
        const leg = legs[i];
        const p = P[i];
        leg.thigh.getWorldPosition(p.Th);
        tmp.subVectors(p.At, p.Th);
        const len = tmp.length();
        const cap = S.EXT_MAX * L[i];
        if (len > cap) p.At.copy(p.Th).addScaledVector(tmp, cap / len);
        p.q0th.copy(leg.thigh.quaternion);
        p.q0sh.copy(leg.shin.quaternion);
        twoBoneIK(leg.thigh, leg.shin, leg.foot, p.At, p.pole, 1);
        setWorldQuaternion(leg.foot, p.Q);
        liftOut(i, ground, cap);
      }
      // which foot is further back (a start lifts it first)
      const behind = (i) => (P[i].Aw.x - O.x) * F.x + (P[i].Aw.z - O.z) * F.z;
      out.rear = N > 1 && behind(1) < behind(0) ? "R" : "L";
      return out;
    },
    reset() {
      for (const s of st) (s.mode = 0), (s.locked = false), (s.weight = 0), (s.stepT = -1);
      pd = pv = 0;
      gdRel = 0;
    },
  };
}

/**
 * Sole points per leg from the skinned meshes as posed now (call it on the bind pose, before any clip:
 * the hand rests are taken from it too): a hull of the sole (the lowest vertex per 0.2 × 0.35 cell
 * along and across the foot, within 0.6 of the sole), each local to the bone that carries it more
 * (foot or toe); `pivots` [heel, ball, tip] index into it.
 */
export function soleContacts(legs, skinned) {
  const v = new Vector3();
  const res = [];
  for (const leg of legs) {
    const pts = [];
    for (const m of skinned) {
      const fi = m.skeleton.bones.indexOf(leg.foot);
      const ti = m.skeleton.bones.indexOf(leg.toe);
      if (fi < 0) continue;
      const pos = m.geometry.attributes.position;
      const si = m.geometry.attributes.skinIndex;
      const sw = m.geometry.attributes.skinWeight;
      m.skeleton.update();
      for (let i = 0; i < pos.count; i++) {
        let wf = 0;
        let wt = 0;
        for (let c = 0; c < 4; c++) {
          const b = si.getComponent(i, c);
          if (b === fi) wf += sw.getComponent(i, c);
          if (b === ti) wt += sw.getComponent(i, c);
        }
        if (wf + wt < 0.6) continue;
        m.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(m.matrixWorld);
        pts.push({ q: v.clone(), bone: wt > wf ? 1 : 0 });
      }
    }
    const lo = Math.min(...pts.map((x) => x.q.y));
    const a = leg.foot.getWorldPosition(new Vector3());
    const b = leg.toe.getWorldPosition(new Vector3());
    const fw = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const lat = new Vector3(-fw.z, 0, fw.x);
    const along = (q) => (q.x - a.x) * fw.x + (q.z - a.z) * fw.z;
    const side = (q) => (q.x - a.x) * lat.x + (q.z - a.z) * lat.z;
    const bins = new Map();
    for (const x of pts) {
      const key = `${Math.floor(along(x.q) / 0.2)}:${Math.floor(side(x.q) / 0.35)}`;
      const cur = bins.get(key);
      if (!cur || x.q.y < cur.q.y) bins.set(key, x);
    }
    const hull = [...bins.values()].filter((x) => x.q.y < lo + 0.6);
    // the pivots: heel = the lowest point behind the ankle (then the rearmost within 0.05 of it);
    // tip = the frontmost near the sole; ball = under the toe joint, at the sole
    const back = hull.filter((x) => along(x.q) < 0);
    const hy = Math.min(...back.map((x) => x.q.y));
    let heel = null;
    for (const x of back) if (x.q.y < hy + 0.05 && (!heel || along(x.q) < along(heel.q))) heel = x;
    let tip = null;
    for (const x of hull) if (x.q.y < lo + 0.1 && (!tip || along(x.q) > along(tip.q))) tip = x;
    const near = pts.filter((x) => Math.hypot(x.q.x - b.x, x.q.z - b.z) < 0.5);
    const ball = { q: b.clone().setY(Math.min(...near.map((x) => x.q.y))), bone: 1 };
    const all = [heel, ball, tip, ...hull.filter((x) => x !== heel && x !== tip)];
    res.push({ pts: all.map((x) => ({ bone: x.bone, p: (x.bone ? leg.toe : leg.foot).worldToLocal(x.q.clone()) })), pivots: [0, 1, 2] });
  }
  return res;
}
