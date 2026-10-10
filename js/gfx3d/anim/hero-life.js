// The hero's living layers (his movement guide, https://claude.ai/code/artifact/0c0e4898-519c-49d9-bfef-bd16e6bf4c8a,
// "Standing", "Starts, stops and turns", "Hit reactions" and "Secondary motion"): what runs on top of
// every clip, every frame, so he is never still and reacts to what no clip anticipated. Applied after
// the clip, the facing, the lean and the shoulders, before the cut's body, the planted feet and the
// arms (hero3d.js): a weight shift moves his hips and feet.js keeps his soles where they stand.
//
//   breath        a breath every 3–5 s (12–18 a minute), quicker for a few seconds after running or
//                 fighting: the chest lifts and the collarbones rise on the inhale (40%), the exhale
//                 longer (60%)
//   sway          standing, the hips drift a few millimetres on three slow waves (0.13, 0.29, 0.41 Hz):
//                 never a clean sine, never fully still
//   weight shift  standing, his weight is always on one leg (contrapposto): the hips over it, tipped
//                 up on its side and settled a little lower (the free knee bends), the shoulders tipped
//                 the other way; every 4–8 s it moves to the other leg over 0.7 s
//   fingers       standing or walking, now and then (5–9 s) the free hand's fingers flex and relax
//   look-at       the head and neck turn towards the boss (at most 50°), the chest only past 25°
//                 (at most 10° more), on springs, the chest slower; not in a swing, a roll, a hurt or
//                 the fall, and not when the boss is behind him
//   rock          starting and stopping: the chest carries on past the hips and rocks back (an
//                 underdamped spring driven by the sim's acceleration, about 5° at a stop from a run),
//                 the hanging arms swing on and come back (`sway`, used by swing3d.js applyArms)
//   idle          standing still a while (the owner, 2026-10-03: "let him move his body slightly so that
//                 he feels alive, e.g. moving his right hand slightly forward and back"), never two
//                 parts on one rhythm: the hands drift forward and back on slow uneven waves, the
//                 right more than the sword hand, a beat behind the breath; the chest turns and tips a
//                 little; the head drifts; now and then he glances aside (shorter with the boss in
//                 front of him); and every 9–15 s, the longer he has stood, one small fidget in turn —
//                 a re-grip of the sword, a roll of the shoulders with a stretch of the neck, a deep
//                 breath, a flick of the blade's tip, the right hand clenched and let go
//   hit           a hit pops the chest straight into a lean away from the blow (14°) and springs
//                 back, the arms flung the other way; in the hit-stop he shakes side to side, the
//                 shake shrinking
//
// Every schedule is a pure function of the fight's view time, and every spring moves only when time
// does, so a hit-stop (the same time drawn twice) poses him exactly the same.
import { Vector3, Quaternion } from "../three-lib.js?v=df092a6";
import { turnWorld, twoBoneIK, setWorldQuaternion, shiftWorld } from "./ik.js?v=df092a6";
import { springStep, smoothstep } from "./procedural.js?v=df092a6";
import { schedule, lastBefore } from "./toad-life.js?v=df092a6";
import { FORE } from "../../config.js?v=df092a6";

/** The guide's numbers, in shares of his height (H), seconds and degrees. */
export const HERO_LIFE = Object.freeze({
  breath: { rest: 4.0, tired: 2.4, inhale: 0.4, chestDeg: 2.0, clavDeg: 2.8, recover: 6 },
  sway: { amp: 0.006, hz: [0.13, 0.29, 0.41], rollDeg: 0.6 },
  shift: { every: [4, 8], time: 0.7, dist: 0.022, hipDeg: 3, chestDeg: 4.5, drop: 0.012 },
  fingers: { every: [5, 9], time: 1.4, rad: 0.38 },
  look: { maxDeg: 50, neckShare: 0.4, chestFrom: 25, chestMax: 10, behind: 110, freq: 2.4, zeta: 0.8, chestFreq: 1.5 },
  rock: { gain: 0.022, freq: 2.2, zeta: 0.45, maxDeg: 9 },
  arms: { gain: 0.011, freq: 1.4, zeta: 0.32, max: 0.09 },
  hit: { chestDeg: 14, armKick: 0.9, shake: 0.03, shakeHz: 28, shakeTime: 0.13 },
  idle: {
    after: 2, // seconds standing before the idle's own motions begin (they fade in over 1.5 s)
    hands: { hz: [0.16, 0.27, 0.43], free: 0.026, sword: 0.011, side: 0.008, breath: 0.007, lag: 0.08 },
    chest: { yawDeg: 1.5, rollDeg: 0.8, hz: [0.09, 0.21, 0.34] },
    head: { yawDeg: 3, pitchDeg: 1.6, hz: [0.17, 0.31, 0.47] },
    glance: { every: [6, 11], deg: [18, 32], hold: [0.5, 1.1], turn: 0.3, boss: 0.5 },
    fidget: { every: [9, 15], after: 4, time: [1.6, 1.9, 2.6, 1.1, 1.3] },
    grip: { rollDeg: 14, loosen: 0.35 },
    shoulders: { upDeg: 6, backDeg: 5, neckDeg: 7 },
    deep: { chestDeg: 3.2, clavDeg: 4, headDeg: 3 },
    flick: { deg: 16 },
    clench: { rad: 0.75 },
  },
});

/** The idle's fidgets, in the order they take turns. */
export const FIDGETS = Object.freeze(["grip", "shoulders", "deep", "flick", "clench"]);
/** A smooth bump over u in 0..1 (0 at both ends, 1 in the middle). */
const bump = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2);
/** A number in 0..1 from an index (the schedules' moments get their own sizes, the same every time). */
const hash01 = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** Three slow waves summed, in −1..1: never a clean sine, so nothing visibly loops. */
const waves = (t, hz, ph = 0) =>
  (Math.sin(t * 2 * Math.PI * hz[0] + ph) + 0.6 * Math.sin(t * 2 * Math.PI * hz[1] + 1.7 + ph * 1.3) + 0.35 * Math.sin(t * 2 * Math.PI * hz[2] + 0.4 + ph * 2.1)) / 1.95;

/** How fast the idle's own motions fade once he moves (half-life, s). */
const LIVE_OUT = 0.1;
const UP = new Vector3(0, 1, 0);
const vA = new Vector3();
const vB = new Vector3();
const vF = new Vector3();
const vR = new Vector3();
const qA = new Quaternion();
const qTilt = new Quaternion();
const vTilt = new Vector3();
const D = Math.PI / 180;
const vK = new Vector3();
const vM = new Vector3();

/** The breath's shape over one cycle (0..1): up over the inhale, down over the longer exhale. */
export function breathAt(u, inhale = HERO_LIFE.breath.inhale) {
  const x = u - Math.floor(u);
  return x < inhale ? smoothstep(0, inhale, x) : 1 - smoothstep(inhale, 1, x);
}

/**
 * `rig` = hero3d's rig (hips, spine[], chest, neck, head, arm, off), `H` his height in world units.
 * Returns { apply, hit, reset, sway (world offset for the hanging hands), fingers (extra curl, rad) }.
 */
export function makeHeroLife(rig, H) {
  const L = HERO_LIFE;
  const shifts = schedule(41, L.shift.every);
  const flexes = schedule(53, L.fingers.every);
  const glances = schedule(67, L.idle.glance.every);
  const fidgets = schedule(71, L.idle.fidget.every);
  const st = {
    phase: 0,
    tired: 0,
    idleW: 0,
    lookW: 0,
    head: { x: 0, v: 0 },
    chest: { x: 0, v: 0 },
    rockF: { x: 0, v: 0 },
    rockS: { x: 0, v: 0 },
    armF: { x: 0, v: 0 },
    armS: { x: 0, v: 0 },
    hitAt: -1,
    hitDir: new Vector3(),
    idleSince: null,
    live: 0,
    fidAt: null,
    glAt: null, // the glance under way (started while he stood: carried as he moves off, never begun after)
    fidget: null, // { kind, u, i } this frame, for afterArms
    flexW: 1, // the free hand's flex weight, on its own time (runW·moveW crossed its band in 2-3 frames)
    stretchTilt: 0, // how far the neck stretch tipped the head to the side this frame (rad; hero3d's levelling leaves it)
  };
  const out = { sway: new Vector3(), swayFree: new Vector3(), swaySword: new Vector3(), fingers: 0, loosen: 0, shake: new Vector3() };
  // each leg's ankle and foot as the clip has them, held through the weight shift (the hips move,
  // the feet do not: re-solved by a two-bone IK, the knee bending the way it already bends)
  const held = (rig.legs || []).map((l) => ({ ...l, at: new Vector3(), q: new Quaternion() }));

  function reset() {
    for (const k of ["head", "chest", "rockF", "rockS", "armF", "armS"]) st[k].x = st[k].v = 0;
    st.hitAt = -1;
  }

  /** A bone's tilt to the side in the world (rad): its X axis's rise. */
  function sideTilt(b) {
    b.getWorldQuaternion(qTilt);
    return Math.asin(Math.max(-1, Math.min(1, vTilt.set(1, 0, 0).applyQuaternion(qTilt).y)));
  }

  /** The bones a chest turn is shared over (the upper spine), and how. */
  function turnChest(axis, ang, w) {
    if (Math.abs(ang * w) < 1e-6) return;
    const sp = rig.spine;
    const a = sp.at(-2) || rig.chest;
    const b = sp.at(-1) || rig.chest;
    qA.setFromAxisAngle(axis, ang * w * 0.55);
    turnWorld(a, qA);
    qA.setFromAxisAngle(axis, ang * w * 0.45);
    turnWorld(b, qA);
  }

  return {
    reset,
    get sway() {
      return out.sway;
    },
    get fingers() {
      return out.fingers;
    },
    /** The idle's drift of the free and the sword hand (world offsets, added to their hanging targets). */
    get swayFree() {
      return out.swayFree;
    },
    get swaySword() {
      return out.swaySword;
    },
    /** How far the sword hand's fingers open (rad), re-gripping in a fidget. */
    get loosen() {
      return out.loosen;
    },
    /** How far the idle's neck stretch tipped the head to the side this frame (rad, world): kept by the levelling. */
    get stretchTilt() {
      return st.stretchTilt;
    },
    /** The fidget under way, if any ({ kind, u }: its name and how far through, 0..1). */
    get fidget() {
      return st.fidget;
    },
    /** A hit landed on him: (dx, dz) = the world direction it pushes him; `now` real seconds. */
    hit(dx, dz, now) {
      const n = Math.hypot(dx, dz);
      if (n < 1e-6) return;
      st.hitDir.set(dx / n, 0, dz / n);
      st.hitAt = now;
      // (popped straight into the lean, then sprung back: the pose at contact is the one held in the stop)
      const ang = L.hit.chestDeg * D;
      st.rockF.x = 0;
      st.rockS.x = 0;
      st.kick = { ang, arm: L.hit.armKick };
    },
    /**
     * After the arms are posed (hero3d.js, past applyArms): the sword-hand fidgets — the re-grip (the
     * forearm rolled to and fro, the sword with it) and the flick (the blade's tip lifted twice).
     */
    afterArms(faceWorld, w = 1) {
      const fd = st.fidget;
      if (!fd || !rig.arm?.fore || !rig.arm.hand || w <= 1e-3) return;
      const I = L.idle;
      if (fd.kind === "grip") {
        rig.arm.fore.getWorldPosition(vA);
        rig.arm.hand.getWorldPosition(vB);
        vK.subVectors(vB, vA).normalize();
        // (the left forearm's roll; the right one's its mirror, FORE)
        qA.setFromAxisAngle(vK, FORE * I.grip.rollDeg * D * Math.sin(fd.u * 4 * Math.PI) * bump(fd.u) * st.live * w);
        turnWorld(rig.arm.fore, qA);
      } else if (fd.kind === "flick") {
        vR.set(-Math.sin(faceWorld), 0, Math.cos(faceWorld));
        qA.setFromAxisAngle(vR, I.flick.deg * D * Math.max(0, Math.sin(fd.u * 4 * Math.PI)) * bump(fd.u) * st.live * w);
        turnWorld(rig.arm.hand, qA);
      }
    },
    /**
     * `ctx` = { t (view s), now (real s), faceWorld, moveW, runW, ax, az (the sim's acceleration, world),
     * standing, acting (a swing, a roll, a hurt), alive, bodyW (0 in a swing: the chest and shoulders
     * carry the blade), lookAt ({ x, z } or null) }. Returns the hero object's shake offset (world).
     */
    apply(dt, ctx) {
      const step = dt > 1e-5;
      st.stretchTilt = 0;
      const t = ctx.t;
      const fx = Math.cos(ctx.faceWorld);
      const fz = Math.sin(ctx.faceWorld);
      vF.set(fx, 0, fz); // his forward
      vR.set(-fz, 0, fx); // his right
      const bodyW = ctx.alive ? ctx.bodyW : 0;
      // --- weights that fade with what he is doing
      const idleOn = ctx.alive && ctx.standing && !ctx.acting ? 1 : 0;
      if (step) st.idleW += (idleOn - st.idleW) * (1 - Math.pow(2, -dt / 0.25));
      // how long he has stood: the idle's own motions come in after a moment, the fidgets later still
      if (idleOn) st.idleSince ??= t;
      else st.idleSince = null;
      const I = L.idle;
      const stood = st.idleSince == null ? 0 : t - st.idleSince;
      // (in as he stands a while; out over LIVE_OUT once he moves, never cut: a start mid re-grip moved the
      // sword hand 5.8° and the tip 0.84 units in one frame — the CODE lens)
      const liveT = st.idleSince == null ? 0 : st.idleW * smoothstep(I.after, I.after + 1.5, stood);
      st.live = liveT >= st.live ? liveT : !step ? st.live : liveT + (st.live - liveT) * Math.pow(2, -dt / LIVE_OUT);
      st.fidget = null;
      if (st.live > 1e-3) {
        // (the fidget under way carries on, fading, once he moves)
        if (st.idleSince != null) {
          const f = lastBefore(fidgets, t);
          if (f && f.t >= st.idleSince + I.fidget.after) st.fidAt = f;
        }
        const f = st.fidAt;
        if (f) {
          const kind = FIDGETS[f.i % FIDGETS.length];
          const u = (t - f.t) / I.fidget.time[f.i % FIDGETS.length];
          if (u >= 0 && u < 1) st.fidget = { kind, u, i: f.i };
        }
      }
      // --- the springs: rock and arms from the sim's acceleration, in his own frame
      if (step) {
        const aF = ctx.ax * fx + ctx.az * fz;
        const aS = ctx.ax * -fz + ctx.az * fx;
        const clampA = (a) => Math.max(-2500, Math.min(2500, a));
        // (not by a roll's own push: the roll's clip carries the chest, and the rock tipped it 8° more)
        const drive = ctx.roll ? 0 : 1;
        // (a stop's rock only: at a start the chest tipped back 4.4°, against the start's lean forward)
        st.rockF.v -= L.rock.gain * clampA(Math.min(0, aF)) * dt * drive;
        st.rockS.v -= L.rock.gain * clampA(aS) * dt * drive;
        st.armF.v -= L.arms.gain * clampA(aF) * dt * drive;
        st.armS.v -= L.arms.gain * clampA(aS) * dt * drive;
        springStep(st.rockF, 0, L.rock.freq, L.rock.zeta, dt);
        springStep(st.rockS, 0, L.rock.freq, L.rock.zeta, dt);
        springStep(st.armF, 0, L.arms.freq, L.arms.zeta, dt);
        springStep(st.armS, 0, L.arms.freq, L.arms.zeta, dt);
        // breathing quickens after running or fighting and calms over L.breath.recover seconds
        const busy = ctx.alive ? Math.max(ctx.moveW * ctx.runW, ctx.acting ? 1 : 0) : 0;
        st.tired = busy > st.tired ? st.tired + (busy - st.tired) * Math.min(1, dt / 1.5) : st.tired * Math.pow(2, -dt / (L.breath.recover / 2));
        st.phase += dt / (L.breath.rest + (L.breath.tired - L.breath.rest) * st.tired);
      }
      // a hit: popped at once, even in the hit-stop's frozen time (the pose at contact is the one held)
      if (st.kick) {
        // the push in his frame: the chest pops away from the blow, the arms are flung the other way
        const pF = st.hitDir.x * fx + st.hitDir.z * fz;
        const pS = st.hitDir.x * -fz + st.hitDir.z * fx;
        st.rockF.x = pF * st.kick.ang;
        st.rockS.x = pS * st.kick.ang;
        st.rockF.v = st.rockS.v = 0;
        st.armF.v -= pF * st.kick.arm;
        st.armS.v -= pS * st.kick.arm;
        st.kick = null;
      }
      const soft = (x, max) => max * Math.tanh(x / max);
      // --- the rock and a hit's lean: the upper spine tipped about the horizontal axis across it
      const rf = soft(st.rockF.x, L.rock.maxDeg * D * 1.8);
      const rs = soft(st.rockS.x, L.rock.maxDeg * D * 1.8);
      if (rig.spine.length && (Math.abs(rf) > 1e-5 || Math.abs(rs) > 1e-5)) {
        // (a turn about his right axis tips the chest back, about his forward tips it to his right:
        // a + rock is forward or to his right)
        vA.copy(vR).multiplyScalar(-rf).addScaledVector(vF, rs);
        const ang = vA.length();
        if (ang > 1e-6) turnChest(vA.normalize(), ang, ctx.alive ? Math.max(bodyW, ctx.hurt ? 1 : 0) : 0);
      }
      // the hanging hands swing on (applyArms adds this to their targets)
      out.sway.copy(vF).multiplyScalar(soft(st.armF.x, L.arms.max) * H).addScaledVector(vR, soft(st.armS.x, L.arms.max) * H);
      if (!ctx.alive) out.sway.set(0, 0, 0);
      // --- breath: the chest lifts (tipped back) and the collarbones rise
      const b = breathAt(st.phase) * (ctx.alive ? 1 - 0.7 * ctx.moveW * ctx.runW : 0);
      // (the deep-breath and shoulder-roll fidgets ride on the breath's own bones)
      const fd = st.fidget;
      const deep = fd?.kind === "deep" ? bump(fd.u) * st.live : 0;
      const roll = fd?.kind === "shoulders" ? bump(fd.u) * st.live : 0;
      const chestUp = L.breath.chestDeg * b + I.deep.chestDeg * deep;
      const clavUp = L.breath.clavDeg * b + I.deep.clavDeg * deep + I.shoulders.upDeg * roll;
      if ((chestUp > 1e-4 || clavUp > 1e-4) && bodyW > 1e-3) {
        turnChest(vR, chestUp * D, bodyW);
        for (const a of [rig.arm, rig.off]) {
          if (!a?.shoulder || !a.upper) continue;
          a.shoulder.getWorldPosition(vA);
          a.upper.getWorldPosition(vB).sub(vA); // the collarbone
          const sgn = Math.sign(vB.dot(vR)) || 1; // which side it is on
          qA.setFromAxisAngle(vF, -sgn * clavUp * D * bodyW); // its tip up
          turnWorld(a.shoulder, qA);
          if (roll > 1e-4) {
            // and rolled back at the top of the shrug (its tip round behind, about the vertical)
            qA.setFromAxisAngle(UP, sgn * I.shoulders.backDeg * D * Math.sin(Math.PI * Math.min(1, fd.u * 1.3)) * st.live * bodyW);
            turnWorld(a.shoulder, qA);
          }
        }
      }
      // --- standing: weight on one leg, a slow sway
      if (rig.hips && st.idleW > 1e-3) {
        const S = L.shift;
        // (the side alternating from the left he starts on: the first shift moves him onto the right —
        // its parity was the other way, and his hips jumped across in one frame 3.4 s into standing; and
        // past the schedule's lap, the lap before's last shift holds till this lap's first)
        const last = lastBefore(shifts, t) ?? (t >= shifts.span ? lastBefore(shifts, Math.floor(t / shifts.span) * shifts.span - 1e-6) : null);
        // (as found with the sword in his left hand; all of it mirrored with the sword in his right, FORE — kept, the
        // weight on the same leg tilted him under a right-handed swing's held arm 3.7° off the hitbox)
        const side = FORE * (last ? (last.i % 2 ? -1 : 1) : -1); // +1: on his right leg
        const from = -side;
        const k = last ? smoothstep(0, S.time, t - last.t) : 1;
        const w = from + (side - from) * k; // −1 left … +1 right
        const sw = L.sway;
        const drift = (sw.amp * H) / 3;
        const dx = FORE * drift * (Math.sin(t * 2 * Math.PI * sw.hz[0]) + Math.sin(t * 2 * Math.PI * sw.hz[1] + 1.3) + 0.6 * Math.sin(t * 2 * Math.PI * sw.hz[2] + 2.1));
        const dz = drift * (Math.sin(t * 2 * Math.PI * sw.hz[1] + 0.4) + 0.8 * Math.sin(t * 2 * Math.PI * sw.hz[2] + 4.0));
        for (const l of held) {
          l.foot.getWorldPosition(l.at);
          l.foot.getWorldQuaternion(l.q);
        }
        vA.copy(vR).multiplyScalar((w * S.dist * H + dx) * st.idleW).addScaledVector(vF, dz * st.idleW);
        // (and a little lower: the hip over the standing leg rises, and with the hips at their height
        // the standing leg fell short of the grass and its heel lifted 0.33)
        vA.y -= Math.abs(w) * S.drop * H * st.idleW;
        shiftWorld(rig.hips, vA);
        // the hip over the standing leg up (a roll about his forward), the shoulders the other way
        // (a turn about his forward lowers his right side)
        qA.setFromAxisAngle(vF, -w * S.hipDeg * D * st.idleW + (dx / (sw.amp * H)) * sw.rollDeg * D * st.idleW);
        turnWorld(rig.hips, qA);
        turnChest(vF, w * (S.hipDeg + S.chestDeg) * D, st.idleW * bodyW);
        for (const l of held) {
          l.thigh.getWorldPosition(vM);
          l.shin.getWorldPosition(vK);
          vM.add(l.at).multiplyScalar(0.5);
          vK.sub(vM);
          if (vK.lengthSq() < 1e-8) vK.copy(vF);
          twoBoneIK(l.thigh, l.shin, l.foot, l.at, vK.normalize(), 1);
          setWorldQuaternion(l.foot, l.q);
        }
      }
      // --- look-at: head and neck first, the chest past 25°
      if (step) {
        const Lk = L.look;
        let want = 0;
        let on = 0;
        if (ctx.lookAt && ctx.alive && !ctx.acting && rig.head) {
          rig.head.getWorldPosition(vA);
          const rel = Math.atan2(ctx.lookAt.z - vA.z, ctx.lookAt.x - vA.x) - ctx.faceWorld;
          const r = Math.atan2(Math.sin(rel), Math.cos(rel));
          on = 1 - smoothstep((Lk.behind - 20) * D, Lk.behind * D, Math.abs(r));
          want = Math.max(-Lk.maxDeg * D, Math.min(Lk.maxDeg * D, r));
        }
        // a glance aside now and then while he stands (shorter with the boss to watch)
        // (picked only while he stands: with the stand's start gone, a glance due after he moved off began)
        if (st.idleSince != null) {
          const g0 = lastBefore(glances, t);
          st.glAt = g0 && g0.t >= st.idleSince + I.after ? g0 : null;
        }
        const g = st.live > 1e-3 ? st.glAt : null;
        if (g) {
          const G = I.glance;
          const hold = G.hold[0] + (G.hold[1] - G.hold[0]) * hash01(g.i + 7);
          const u = t - g.t;
          const e = smoothstep(0, G.turn, u) * (1 - smoothstep(G.turn + hold, G.turn * 2.4 + hold, u));
          if (e > 0) {
            const size = (G.deg[0] + (G.deg[1] - G.deg[0]) * hash01(g.i)) * D * (g.i % 2 ? 1 : -1) * (ctx.lookAt ? G.boss : 1);
            want += size * e * st.live;
            on = Math.max(on, e * st.live);
          }
        }
        st.lookW += (on - st.lookW) * (1 - Math.pow(2, -dt / 0.15));
        springStep(st.head, want, Lk.freq, Lk.zeta, dt);
        const past = Math.sign(want) * Math.min(Lk.chestMax * D, Math.max(0, Math.abs(want) - Lk.chestFrom * D) * 0.4);
        springStep(st.chest, past, Lk.chestFreq, Lk.zeta, dt);
      }
      // (a world yaw toward a larger atan2(z, x) is a turn about −up)
      const look = st.head.x * st.lookW;
      if (Math.abs(look) > 1e-5 && rig.neck && rig.head) {
        qA.setFromAxisAngle(UP, -look * L.look.neckShare);
        turnWorld(rig.neck, qA);
        qA.setFromAxisAngle(UP, -look * (1 - L.look.neckShare));
        turnWorld(rig.head, qA);
      }
      if (Math.abs(st.chest.x * st.lookW) > 1e-5) turnChest(UP, -st.chest.x * st.lookW, bodyW);
      // --- the idle's slow drift: the chest turns and tips a little, the head wanders, the neck
      // stretches in its fidget; the hands drift forward and back (applyArms adds them)
      out.swayFree.set(0, 0, 0);
      out.swaySword.set(0, 0, 0);
      out.loosen = 0;
      if (st.live > 1e-3) {
        const lv = st.live;
        turnChest(UP, waves(t, I.chest.hz, 0.9) * I.chest.yawDeg * D, lv * bodyW);
        turnChest(vF, waves(t, I.chest.hz, 2.3) * I.chest.rollDeg * D, lv * bodyW);
        if (rig.head) {
          qA.setFromAxisAngle(UP, waves(t, I.head.hz, 0.2) * I.head.yawDeg * D * lv);
          turnWorld(rig.head, qA);
          const nod = waves(t, I.head.hz, 3.1) * I.head.pitchDeg + (fd?.kind === "deep" ? I.deep.headDeg * bump(fd.u) : 0);
          qA.setFromAxisAngle(vR, nod * D * lv);
          turnWorld(rig.head, qA);
          if (fd?.kind === "shoulders") {
            // the neck stretched to one side and back, the other side the next time
            qA.setFromAxisAngle(vF, (fd.i % 2 ? 1 : -1) * I.shoulders.neckDeg * D * bump(Math.min(1, fd.u * 1.15)) * lv);
            const before = sideTilt(rig.head);
            turnWorld(rig.neck || rig.head, qA);
            st.stretchTilt = sideTilt(rig.head) - before;
          }
        }
        // the hands: forward and back on their own waves, a beat behind the breath (the arms overlap the chest)
        const Hd = I.hands;
        const lagB = breathAt(st.phase - Hd.lag);
        out.swayFree.copy(vF).multiplyScalar((waves(t, Hd.hz, 0.5) * Hd.free + lagB * Hd.breath) * H * lv);
        out.swayFree.addScaledVector(vR, FORE * waves(t, Hd.hz, 4.2) * Hd.side * H * lv);
        out.swaySword.copy(vF).multiplyScalar((waves(t, Hd.hz, 2.6) * Hd.sword + lagB * Hd.breath * 0.6) * H * lv);
        if (fd?.kind === "grip") out.loosen = I.grip.loosen * bump(Math.min(1, Math.max(0, (fd.u - 0.2) / 0.6))) * lv;
      }
      // --- the free hand's fingers, now and then (and clenched in its fidget)
      out.fingers = st.fidget?.kind === "clench" ? I.clench.rad * bump(st.fidget.u) * st.live : 0;
      // (eased off as he runs, not switched: at runW·moveW 0.5 the flex fell 6-15° in one frame)
      // (and on its own time, 0.3 s at most from one to the other: a running start or a roll's end crossed the band
      // in 2-3 frames, 6.6-9.9° of curl a frame)
      const flexT = ctx.alive ? 1 - smoothstep(0.25, 0.75, ctx.runW * ctx.moveW) : 0;
      if (step) st.flexW += Math.max(-dt / 0.3, Math.min(dt / 0.3, flexT - st.flexW));
      const flexW = st.flexW;
      if (flexW > 1e-3) {
        const last = lastBefore(flexes, t);
        if (last) {
          const u = (t - last.t) / L.fingers.time;
          if (u < 1) out.fingers = Math.max(out.fingers, Math.sin(u * Math.PI) * L.fingers.rad * flexW);
        }
      }
      // --- the hit-stop shake: side to side across the blow, on real time, shrinking
      out.shake.set(0, 0, 0);
      const age = ctx.now - st.hitAt;
      if (st.hitAt >= 0 && age >= 0 && age < L.hit.shakeTime) {
        const a = L.hit.shake * H * (1 - age / L.hit.shakeTime) * Math.sin(age * 2 * Math.PI * L.hit.shakeHz);
        out.shake.set(-st.hitDir.z * a, 0, st.hitDir.x * a);
      }
      return out.shake;
    },
  };
}
