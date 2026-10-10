// Gnasher's living layers (his movement guide, https://claude.ai/code/artifact/c90d7798-7195-4596-bec2-e96286d664ce,
// "Secondary motion and procedural layers"): what runs on top of every clip, every frame, so he reacts
// to things no clip anticipated. Applied after the clip is sampled and blended, before the feet are
// planted (anim/feet.js), so a lean or a weight shift keeps his paws where they stand.
//
//   soft tissue   the belly and the throat sac (bones added by 53_anim_toad.py) are damped springs
//                 driven by how the hips accelerate: they lag, overshoot about 30% and settle in
//                 about 0.4 s — a landing slams them down, a start leaves them behind
//   look-at       the neck (spine_01, spine_02: the eyes hang off spine_02, so the head alone would
//                 tear his face from his eyes) turns towards the hero, at most 15°, on a spring with
//                 a little overshoot, before the body's own facing catches up
//   blinks        every 3–6 s, closing in 2 frames, held, opening in 3; one eye a frame behind the other
//   weight shift  sitting, every 4–7 s the hips slide half a unit onto the other hind leg
//   swallow       sitting, every 8–12 s: the eyes press down, the throat dips, the head tips up 3°
//   hit lean      a hit leans him away from the blade (5°, a heavy one 10°) on a spring, the belly
//                 wobbling, a hard blink; the move underneath carries on
//   rock          starting and stopping rock the body against the change of speed (about 2°)
//
// Every schedule is a pure function of the fight's view time, and every spring moves only when time
// does, so a hit-stop (the same time drawn twice) poses him exactly the same.
import { Vector3, Quaternion } from "../three-lib.js?v=df092a6";
import { turnWorld, shiftWorld } from "./ik.js?v=df092a6";
import { springStep, smoothstep } from "./procedural.js?v=df092a6";

/** The guide's numbers, in game units, seconds and degrees. */
export const LIFE = Object.freeze({
  belly: { freq: 2.4, zeta: 0.36, gain: 0.3, max: 1.8 },
  sac: { freq: 3.2, zeta: 0.3, gain: 0.0035, max: 0.25 },
  look: { maxDeg: 15, freq: 2.2, zeta: 0.6, neckShare: 0.45 },
  blink: { every: [3, 6], close: 2 / 30, hold: 1.5 / 30, open: 3 / 30, lag: 1 / 30, shut: 0.12 },
  shift: { every: [4, 7], dist: 0.5, time: 0.5, rollDeg: 1.5 },
  swallow: { every: [8, 12], time: 0.7, headDeg: 3, sac: 0.08, eyes: 0.45 },
  hit: { lightDeg: 5, heavyDeg: 10, freq: 2.6, zeta: 0.42, belly: 22, heavyBelly: 40 },
  // starting and stopping: the body rocks against the change of speed (a stop from his walk tips him
  // forward about 2° and back), on the same spring as a hit's lean
  rock: { gain: 0.027 },
});

/** A seeded list of moments, `every` = [min, max] seconds apart, over `span` seconds (then repeating). */
export function schedule(seed, every, span = 600) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const at = [];
  for (let t = every[0] * rnd(); t < span; t += every[0] + (every[1] - every[0]) * rnd()) at.push(t);
  return { at, span };
}

/** The last moment of `sch` at or before `t` (and its index), or null. */
export function lastBefore(sch, t) {
  const span = sch.span;
  const lap = Math.floor(t / span);
  const tt = t - lap * span;
  let lo = 0;
  let hi = sch.at.length - 1;
  if (hi < 0 || sch.at[0] > tt) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sch.at[mid] <= tt) lo = mid;
    else hi = mid - 1;
  }
  return { t: sch.at[lo] + lap * span, i: lo + lap * sch.at.length };
}

/** How shut an eye is (0 open, 1 shut) `since` seconds after its blink began. */
export function blinkShut(since) {
  const B = LIFE.blink;
  if (since < 0) return 0;
  if (since < B.close) return smoothstep(0, B.close, since);
  if (since < B.close + B.hold) return 1;
  return 1 - smoothstep(B.close + B.hold, B.close + B.hold + B.open, since);
}

const UP = new Vector3(0, 1, 0);
const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const qA = new Quaternion();
const qB = new Quaternion();

/** Scale `bone` along its own local axis (0 x, 1 y, 2 z) by `k`, and all of it by `all`. */
function scaleBone(bone, all, axis = -1, k = 1) {
  bone.scale.multiplyScalar(all);
  if (axis === 0) bone.scale.x *= k;
  if (axis === 1) bone.scale.y *= k;
  if (axis === 2) bone.scale.z *= k;
}

/**
 * `bones` the skeleton's bones, `turn` the group his facing turns (his forward is its +Z, his left
 * its +X). Every offset is in world (game) units. `names` renames the bones it looks for (another
 * boss: the King's hips are "hips"); a bone the model lacks is a layer it does without. Returns
 * { hit, apply, reset }.
 */
export function makeToadLife(bones, turn, names = {}) {
  const by = (n) => bones.find((b) => b.name === n) || null;
  const B = {
    body: by(names.body || "body"),
    spine1: by(names.spine1 || "spine_01"),
    spine2: by(names.spine2 || "spine_02"),
    head: by("head"),
    belly: by("belly"),
    sac: by("sac"),
    eyeL: by("eye_L"),
    eyeR: by("eye_R"),
  };
  const blinks = schedule(11, LIFE.blink.every);
  const shifts = schedule(23, LIFE.shift.every);
  const swallows = schedule(37, LIFE.swallow.every);
  const st = {
    prev: null,
    vel: new Vector3(),
    belly: { p: new Vector3(), v: new Vector3() },
    sac: { x: 0, v: 0 },
    look: { x: 0, v: 0 },
    lookW: 0,
    idleW: 0,
    lean: { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } },
    hitBlink: -1,
    kick: null,
  };
  const ax = { x: 0, v: 0 }; // scratch spring for the belly's three axes

  function reset() {
    st.prev = null;
    st.vel.set(0, 0, 0);
    st.belly.p.set(0, 0, 0);
    st.belly.v.set(0, 0, 0);
    st.sac.x = st.sac.v = 0;
    st.look.x = st.look.v = 0;
    st.lean.x.x = st.lean.x.v = st.lean.z.x = st.lean.z.v = 0;
  }

  return {
    reset,
    /** A blade landed: `push` = world direction from the hero to him (x, z), `heavy` the finisher. */
    hit(pushX, pushZ, heavy, t) {
      const n = Math.hypot(pushX, pushZ) || 1;
      st.kick = { x: pushX / n, z: pushZ / n, heavy: !!heavy };
      st.hitBlink = t;
    },
    /**
     * `ctx` = { t, key (the picker's), lookYaw (radians to turn towards the hero, + = his left, or
     * null), sitting (idle), alive }.
     */
    apply(dt, ctx) {
      const t = ctx.t;
      // --- what the hips do this frame (world), for the springs
      const step = dt > 1e-5;
      if (B.body) {
        B.body.getWorldPosition(vA);
        if (step) {
          if (st.prev) {
            vB.subVectors(vA, st.prev).divideScalar(dt);
            if (vB.length() > 600) vB.copy(st.vel); // a teleport (a reset, a bench jump): no jolt
            vC.subVectors(vB, st.vel).divideScalar(dt); // acceleration
            if (vC.length() > 4000) vC.setLength(4000);
            st.vel.copy(vB);
            // the belly: x'' = −ω²x − 2ζωx' − gain·a, each axis on its own
            const L = LIFE.belly;
            for (const k of ["x", "y", "z"]) {
              ax.x = st.belly.p[k];
              ax.v = st.belly.v[k] - L.gain * vC[k] * dt;
              springStep(ax, 0, L.freq, L.zeta, dt);
              st.belly.p[k] = ax.x;
              st.belly.v[k] = ax.v;
            }
            st.sac.v -= LIFE.sac.gain * vC.y * dt;
            st.lean.x.v -= LIFE.rock.gain * vC.x * dt;
            st.lean.z.v -= LIFE.rock.gain * vC.z * dt;
          }
          st.prev = (st.prev || new Vector3()).copy(vA);
          springStep(st.sac, 0, LIFE.sac.freq, LIFE.sac.zeta, dt);
          // a hit's kick: the lean springs and the belly get a push
          if (st.kick) {
            const H = LIFE.hit;
            const deg = st.kick.heavy ? H.heavyDeg : H.lightDeg;
            const w = Math.PI * 2 * H.freq;
            // (a velocity whose first swing peaks near `deg`: about ω·deg for this damping)
            const v0 = ((deg * Math.PI) / 180) * w * 1.6;
            st.lean.x.v += st.kick.x * v0;
            st.lean.z.v += st.kick.z * v0;
            const bv = st.kick.heavy ? H.heavyBelly : H.belly;
            st.belly.v.x += st.kick.x * bv;
            st.belly.v.z += st.kick.z * bv;
            st.kick = null;
          }
          springStep(st.lean.x, 0, LIFE.hit.freq, LIFE.hit.zeta, dt);
          springStep(st.lean.z, 0, LIFE.hit.freq, LIFE.hit.zeta, dt);
        }
      }
      const alive = ctx.alive !== false;
      // --- weights that fade in and out with what he is doing
      const lookOn = alive && ctx.lookYaw != null ? 1 : 0;
      const idleOn = alive && ctx.sitting ? 1 : 0;
      if (step) {
        st.lookW += (lookOn - st.lookW) * (1 - Math.pow(2, -dt / 0.12));
        st.idleW += (idleOn - st.idleW) * (1 - Math.pow(2, -dt / 0.2));
      }
      // --- hit lean: the hips tip away from the blade (about the horizontal axis across the push)
      if (B.body && (st.lean.x.x || st.lean.z.x)) {
        const ang = Math.hypot(st.lean.x.x, st.lean.z.x);
        if (ang > 1e-5) {
          vA.set(st.lean.z.x, 0, -st.lean.x.x).normalize(); // up × push
          qA.setFromAxisAngle(vA, ang);
          turnWorld(B.body, qA);
        }
      }
      // --- weight shift (sitting): onto one hind leg, then the other
      if (B.body && st.idleW > 1e-3) {
        const S = LIFE.shift;
        const last = lastBefore(shifts, t);
        if (last) {
          const side = last.i % 2 ? 1 : -1;
          const k = smoothstep(0, S.time, t - last.t);
          const from = last.i === 0 ? 0 : -side; // (the first shift starts from the middle)
          const x = (from + (side - from) * k) * S.dist * st.idleW; // from the other side over S.time
          turn.getWorldQuaternion(qB);
          vB.set(1, 0, 0).applyQuaternion(qB).multiplyScalar(x);
          shiftWorld(B.body, vB);
          vC.set(0, 0, 1).applyQuaternion(qB);
          qA.setFromAxisAngle(vC, (-x / S.dist) * ((S.rollDeg * Math.PI) / 180));
          turnWorld(B.body, qA);
        }
      }
      // --- look-at: the neck towards the hero, a spring with a little overshoot
      if (step) {
        const L = LIFE.look;
        const max = (L.maxDeg * Math.PI) / 180;
        const want = lookOn ? Math.max(-max, Math.min(max, ctx.lookYaw)) : 0;
        springStep(st.look, want, L.freq, L.zeta, dt);
      }
      const yaw = st.look.x * st.lookW;
      if (Math.abs(yaw) > 1e-5 && B.spine1 && B.spine2) {
        qA.setFromAxisAngle(UP, yaw * LIFE.look.neckShare);
        turnWorld(B.spine1, qA);
        qA.setFromAxisAngle(UP, yaw * (1 - LIFE.look.neckShare));
        turnWorld(B.spine2, qA);
      }
      // --- swallow (sitting)
      let swallow = 0;
      if (st.idleW > 1e-3) {
        const last = lastBefore(swallows, t);
        if (last) {
          const u = (t - last.t) / LIFE.swallow.time;
          if (u < 1) swallow = Math.sin(u * Math.PI) * st.idleW;
        }
      }
      if (swallow > 0 && B.head) {
        turn.getWorldQuaternion(qB);
        vA.set(1, 0, 0).applyQuaternion(qB); // his left: a turn about it lifts his nose
        qA.setFromAxisAngle(vA, (-LIFE.swallow.headDeg * Math.PI * swallow) / 180);
        turnWorld(B.head, qA);
      }
      // --- the soft tissue's pose
      const soft = (x, max) => max * Math.tanh(x / max);
      if (B.belly) {
        const M = LIFE.belly.max;
        vA.set(soft(st.belly.p.x, M), soft(st.belly.p.y, M), soft(st.belly.p.z, M));
        shiftWorld(B.belly, vA);
      }
      if (B.sac) {
        const s = 1 + soft(st.sac.x, LIFE.sac.max) - LIFE.swallow.sac * swallow;
        scaleBone(B.sac, Math.max(0.5, s));
        if (B.belly) {
          vA.set(soft(st.belly.p.x, 1), soft(st.belly.p.y, 1), soft(st.belly.p.z, 1)).multiplyScalar(0.4);
          shiftWorld(B.sac, vA);
        }
      }
      // --- eyes: blinks (one eye a frame behind), a hit's hard blink, the swallow's press
      const lastBlink = lastBefore(blinks, t);
      const since = lastBlink ? t - lastBlink.t : 99;
      const hard = st.hitBlink >= 0 ? t - st.hitBlink : 99;
      const shutL = alive ? Math.max(blinkShut(since), blinkShut(hard)) : 0;
      const shutR = alive ? Math.max(blinkShut(since - LIFE.blink.lag), blinkShut(hard - LIFE.blink.lag)) : 0;
      const press = 1 - LIFE.swallow.eyes * swallow;
      const open = (k) => (1 - (1 - LIFE.blink.shut) * k) * press;
      if (B.eyeL) scaleBone(B.eyeL, 1, 2, open(shutL));
      if (B.eyeR) scaleBone(B.eyeR, 1, 2, open(shutR));
    },
  };
}
