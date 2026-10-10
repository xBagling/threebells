// Which of the hero's clips to show, and at what time and weight: a pure function of the sim's
// state and the view's own records (docs/3D-PLAN.md 7.2, 7.3). No three.js; tested under Bun.
//
// Clips are never played on their own timer. Every frame this picker turns the (in-between) sim
// state into layers { clip, time, weight }, and the sampler poses the skeleton at exactly those
// times, so hit-stop, slow motion and the admin frame-step freeze or slow the hero for free:
//
//   idle / walk / run   blended by speed, one shared phase driven by DISTANCE travelled (the feet
//                       do not slide), 40 units a cycle walking and 66 running
//   roll                p.t over the roll and its recovery
//   swings              a time warp: the sim's wind-up, live window and recovery land on the clip's
//                       own marks, so the blade is live exactly when the hitbox is; a buffered next
//                       swing holds the follow-through instead of flashing the rest pose; moving
//                       through one, `legs` (walk/run) at `legsW` for the legs alone
//   hurt                p.t over the stagger
//   death, victory      world.stateT (p.t stops when the fight ends)
//
// It also says where the body should face (the velocity while running, the attacker when knocked
// back, the aim otherwise) and how quickly to turn, and which kind of change just happened, so the
// blend knows how fast to settle.
import { PLAYER } from "../../config.js?v=df092a6";
import { STATE, moveOf } from "../../sim/player.js?v=df092a6";
import { smoothstep, springCritical } from "./procedural.js?v=df092a6";

// The gait by speed (his movement guide, "Locomotion at every speed"; the owner, 2026-10-03: "make it
// look good in all movement speeds"). The cadence rises with speed as a person's does (scaled to his
// legs: Wu 2019, Murakami 2017 walking; Patoz 2022, Kong 2008 running), the stride is the speed over
// it, and the clips' own strides are warped to it by the legs' IK (anim/stride.js, k ≤ 1: shorter
// steps, never a slide). He walks to 13 u/s and runs from 30 (a person changes at about 2 m/s, 22
// u/s); the run is sampled on a phase a little behind the walk's (their contacts line up) and, at
// jogging speeds, with its stance stretched in time (the sprint clip made a jog). Before: slow walks
// mixed the idle in (both feet locked and dragged at 8–14 u/s) and the walk played at up to 4.8× its
// pace up to 47 u/s, the legs then slowing as he sped up.
export const WALK_CYCLE = 13; // the walk clip's own cycle (k = 1)
const RUN_CLIP_CYCLE = 48.5; // the run clip's own cycle by its forefoot (k = 1, no remap)
export const RUN_PHASE = -0.15; // the run is sampled at phase + RUN_PHASE (contacts line up with the walk's)
const RUN_H0 = 0.08; // half the run clip's stance, in phase
// [speed u/s, cycles per second]
const CADENCE = [[1.5, 0.4], [2, 0.47], [4, 0.62], [6, 0.74], [9, 0.88], [13, 1.02], [18, 1.18], [25, 1.34], [35, 1.41], [47, 1.5], [60, 1.62], [75, 1.79], [94, 2.13]];
export const GAIT = {
  runFrom: 13, // the walk turns into the run between these speeds (u/s) ...
  runTo: 30,
  runRamp: 0.1, // ... its weight moving at most 1 per this long (s: a start crossed the band in a frame)
  dutyA: 0.6, // the run's stance stretched by this at a jog, less and less to dutyTo
  dutyFrom: 30,
  dutyTo: 70,
  legsFrom: 0.6, // the legs' gait weight by speed ...
  legsTo: 1.6,
  legsRise: [0.12, 0.04], // ... rising at most 1 per this long, from a slow start to a fast one (s)
  legsFall: 0.18, // ... and falling over this long once the body has stopped
  upperFall: 0.25, // the body back to the stand over this long once stopped
  upperHalf: 0.06, // ... and into the walk/run on a critically damped spring with this half-life (s): from the
  // smoothed speed it jumped 0 → 0.62 → 1 in two frames at a full-stick start, and 0.2 → 1 in one at a restart
  locoRamp: 0.1, // the moving body's own layers (the run's twist, the free arm, the walk block) in and out of a
  // swing, a roll or a hurt over this long (s): forced to 0 and back under the swing's key, both arms jumped
  stillAfter: 0.05, // the body counts as stopped after this long under 1 u/s
  upperFrom: 1, // the body (idle into walk/run) by speed
  upperTo: 12,
  vHalf: 0.05, // the gait's speed, smoothed (s)
};
export function cadenceAt(v) {
  const T = CADENCE;
  if (v <= T[0][0]) return T[0][1] * (v / T[0][0]);
  for (let i = 1; i < T.length; i++)
    if (v <= T[i][0]) {
      const [a, fa] = T[i - 1];
      const [b, fb] = T[i];
      return fa + ((fb - fa) * (v - a)) / (b - a);
    }
  const [b, fb] = T[T.length - 1];
  return (fb * v) / b; // above the table: the top cycle kept
}
/** Stance half-width (game phase) of the run when remapped by amount A: h - A sin(4 pi h)/(4 pi) = RUN_H0. */
export function runHalf(A) {
  let h = Math.min(0.24, RUN_H0 / Math.max(0.1, 1 - 0.5 * A));
  for (let i = 0; i < 12; i++) {
    const f = h - (A * Math.sin(4 * Math.PI * h)) / (4 * Math.PI) - RUN_H0;
    const d = 1 - A * Math.cos(4 * Math.PI * h);
    h -= f / Math.max(0.05, d);
  }
  return h;
}
/** Game phase -> run clip phase (RUN_PHASE applied): x - A sin(4 pi x)/(4 pi), centred on the run's stances. */
export function runClipPhase(u, A) {
  const c = 0.755; // L stance centre in game phase (run touchdown 0.675, toe-off 0.835 with the offset)
  const x = u - c;
  const g = x - (A * Math.sin(4 * Math.PI * x)) / (4 * Math.PI);
  return (((c + g + RUN_PHASE) % 1) + 1) % 1;
}
/** The gait at speed `v` (the walk/run weight `rIn` if given, else by speed), into `out` if given. */
export function gaitAt(v, rIn = null, out = {}) {
  const G = GAIT;
  const vv = Math.max(v, 1.5);
  let C = vv / cadenceAt(vv);
  const r = rIn ?? smoothstep(G.runFrom, G.runTo, v);
  const A = G.dutyA * (1 - smoothstep(G.dutyFrom, G.dutyTo, v));
  const h = runHalf(A);
  const natRun = (RUN_CLIP_CYCLE * RUN_H0) / h;
  const natural = WALK_CYCLE * (1 - r) + natRun * r;
  let k = C / natural;
  if (k > 1) {
    k = 1;
    C = natural;
  }
  const legsW = smoothstep(G.legsFrom, G.legsTo, v);
  const upperW = smoothstep(G.upperFrom, G.upperTo, v);
  // expected touchdown phase of the left foot (walk heel strike 0.48, remapped run 0.755 - h)
  const tdL = 0.48 * (1 - r) + (0.755 - h) * r;
  return Object.assign(out, { v, C, r, A, h, k, natural, legsW, upperW, tdL });
}
/** The cycle at full speed (a run's half-cycle distance moves the phase by half). */
export const RUN_CYCLE = gaitAt(PLAYER.speed).C;
const TELEPORT = 40;
/** Seconds the victory's raised sword is held before he settles into the stand. */
export const VICTORY_HOLD = 1.2;
/** Half-lives of the blend into each kind of change (7.2). */
/** The jump's crouch before he leaves the ground (s; hero3d.js jumpShape). */
export const JUMP_LOAD = 0.08;
// (jumpAir, jumpLand: the jump's own phases — leaving the ground and touching it again are changes of key, so the blend
// eases the legs out of their planted crouch and back into it; one key for the whole jump snapped the feet at the
// take-off, 555 u/s in one frame, tools/3d/anim/probes/jump.mjs)
export const BLEND = { jump: 0.04, jumpAir: 0.035, jumpLand: 0.03, roll: 0.025, swing: 0.03, hurt: 0.035, land: 0.03, loco: 0.07, death: 0.06, victory: 0.15 };

// `lead`: the foot that lands at the gait's tdL in the clips as shown ("L" played mirrored, "R" as stored)
export function makeHeroRecord({ lead = "L" } = {}) {
  return { lead, phase: 0, last: null, key: "", runW: 0, moveW: 0, legsW: 0, gait: null, vS: null, vV: 0, rS: null, stillT: 0, lastT: null, rear: lead, wasMoving: 0, faceHold: null, knock: false, lastSpeed: 0 };
}

/**
 * The gait at the (smoothed) speed, and the stride's phase moved on by `moved` units. Called every
 * frame by every branch (a roll, the death and the win with no distance), so the gait never comes
 * back from a roll still running at the speed it had before it (he stood in a frozen run, then snapped).
 */
function stride(rec, speed, moved, t) {
  const G = GAIT;
  const dt = rec.lastT == null ? 0 : Math.max(0, Math.min(0.1, t - rec.lastT));
  // Stopped (the body still a moment): the gait's shape held as it was (a frozen phase must not morph
  // walk → run → stand in two frames), the legs and the body faded out by time, not by the falling
  // speed (which held them a frozen stride for up to 11 frames, then dropped them in one or two); the
  // smoothed speed held too, so going again before the legs are down picks up from the same shape
  // (let fall, the shape snapped to the slower one in a frame). Once they are down, it falls freely.
  rec.stillT = speed < 1 ? rec.stillT + dt : 0;
  const stopped = rec.stillT > G.stillAfter && rec.gait;
  if (!stopped || rec.legsW <= 0) {
    if (rec.vS == null) [rec.vS, rec.vV] = [speed, 0];
    else [rec.vS, rec.vV] = springCritical(rec.vS, rec.vV, speed, G.vHalf, dt);
    rec.vS = Math.max(0, rec.vS);
    // the walk/run weight on its own time
    const rT = smoothstep(G.runFrom, G.runTo, rec.vS);
    rec.rS = rec.rS == null ? rT : rec.rS + Math.max(-dt / G.runRamp, Math.min(dt / G.runRamp, rT - rec.rS));
  }
  const g = stopped ? rec.gait : gaitAt(rec.vS, rec.rS, rec.gait || {});
  // the body's weight on its own time: back to the stand by time once stopped, into the walk/run on a
  // spring (never a step: the inertializer does not blend within 'loco')
  const uT = stopped ? 0 : g.upperW;
  if (rec.uW == null) [rec.uW, rec.uV] = [uT, 0];
  else if (stopped) [rec.uW, rec.uV] = [Math.max(0, rec.uW - dt / G.upperFall), 0];
  else {
    [rec.uW, rec.uV] = springCritical(rec.uW, rec.uV, uT, G.upperHalf, dt);
    if (rec.uW > 1) [rec.uW, rec.uV] = [1, 0];
    if (rec.uW < 0) [rec.uW, rec.uV] = [0, 0];
  }
  g.upperW = rec.uW;
  // the legs' weight: towards its target, rising fast for a fast start (the sim's first ticks are
  // already 23 and 47 u/s), falling over legsFall
  const want = stopped ? 0 : smoothstep(G.legsFrom, G.legsTo, rec.vS);
  const rise = G.legsRise[0] + (G.legsRise[1] - G.legsRise[0]) * smoothstep(5, 30, speed);
  const was = rec.legsW;
  rec.legsW = dt <= 0 ? (rec.gait ? was : want) : want > was ? Math.min(want, was + dt / rise) : Math.max(want, was - dt / G.legsFall);
  g.legsW = rec.legsW;
  // A start from standing: the phase seeded so the rear foot lifts first (the idle has L behind) —
  // only from the stand itself: going again while the body still carries the stride (a stop-go tap, a
  // restart before the body is back in the stand) goes on from the frozen phase (re-seeded, 0.87 → 0.12,
  // both arms and the chest jumped half a stride in one frame).
  if (was < 0.05 && rec.legsW >= 0.05 && !stopped && !(rec.uW >= 0.05)) rec.phase = rec.rear === rec.lead ? 0.1 : 0.6;
  rec.runW = g.r;
  rec.moveW = g.upperW;
  rec.gait = g;
  if (!stopped) rec.phase = (((rec.phase + moved / g.C) % 1) + 1) % 1;
  return { moveW: g.legsW, runW: g.r, g };
}
const runT = (rec, g, dur) => runClipPhase(rec.phase, g.A) * dur;
/** The legs walking and running on the stride's phase (`st` stride()'s), pushed onto `legs`; returns their weight. */
function strideLegs(legs, rec, st, dur) {
  if (!(st.moveW > 0)) return 0;
  if (st.runW < 1) legs.push({ clip: "walk", time: rec.phase * dur("walk"), weight: 1 - st.runW });
  if (st.runW > 0) legs.push({ clip: "run", time: runT(rec, st.g, dur("run")), weight: st.runW });
  return st.moveW;
}

/**
 * `s` is the in-between hero (lerp3d.hero): { state, t, face, vx, vy }; `p` the hero (x, y already
 * in between); `view` { t: sim-view seconds, stateT, worldState }; `clips` { name: duration };
 * `marks` the swing marks { swing1: { windEnd, liveEnd, end, followHold? } … } in clip seconds
 * (`followHold`: the follow-through's end, held while a next swing is buffered).
 */
export function heroAnimState(rec, p, s, view, clips, marks) {
  // Distance travelled this frame, from the drawn position (a hop or a respawn is not a stride).
  let moved = 0;
  if (rec.last) {
    const d = Math.hypot(p.x - rec.last[0], p.y - rec.last[1]);
    if (d < TELEPORT) moved = d;
  }
  rec.last = [p.x, p.y];
  const speed = Math.hypot(s.vx, s.vy);
  const dur = (c) => clips[c] || 1;
  const layers = [];
  const legs = [];
  let legsW = 0;
  let key;
  let face = s.face;
  let faceHalf = 0.03;
  let lean = true;
  let deathT = 0;
  let settle = 0; // (the victory back in the stand: the carry comes on with it, hero3d.js)

  if (view.worldState === "won") {
    key = "victory";
    // The sword raised and held, then he settles into the relaxed stand (the guide's victory).
    const back = smoothstep(dur("victory") + VICTORY_HOLD, dur("victory") + VICTORY_HOLD + 0.8, view.stateT);
    layers.push({ clip: "victory", time: Math.min(view.stateT, dur("victory") - 1e-3), weight: 1 - back });
    if (back > 0) layers.push({ clip: "idle", time: view.t % dur("idle"), weight: back });
    settle = back;
    lean = false;
    // (from a stand: the sim's velocity is frozen at the win, and fed to the gait it held a sprint's arms
    // through the whole settle back into the stand)
    stride(rec, 0, 0, view.t);
  } else if (view.worldState === "lost" || s.state === STATE.DEAD || p.dead) {
    key = "death";
    // (timed from the frame he died, on the view's clock: the world's turns to "lost" a tick later and
    // its clock till then is the whole fight's, which showed him lying dead before he fell; his own
    // stops with the sim)
    if (rec.key !== "death") rec.deathAt = view.t;
    deathT = view.t - rec.deathAt;
    layers.push({ clip: "death", time: Math.min(deathT, dur("death") - 1e-3), weight: 1 });
    lean = false;
    stride(rec, speed, 0, view.t);
  } else if (view.worldState === "intro") {
    key = "loco";
    layers.push({ clip: "idle", time: view.t % dur("idle"), weight: 1 });
    stride(rec, 0, 0, view.t);
  } else if (s.state === STATE.JUMP) {
    // A jump (sim/player.js; the body's rise is hero3d.js's): out of the stand into the run's widest stride — one knee
    // up, the other leg back — held through the air, and back into the stand as he lands.
    key = s.t < JUMP_LOAD ? "jump" : s.t < PLAYER.jump.time ? "jumpAir" : "jumpLand";
    // (the stand under it: the crouches, the tuck or the split and the lean are hero3d.js's, jumpShape)
    layers.push({ clip: "idle", time: view.t % dur("idle"), weight: 1 });
    lean = false;
    stride(rec, 0, 0, view.t);
  } else if (s.state === STATE.ROLL) {
    key = "roll";
    const total = PLAYER.roll.time + PLAYER.roll.recover;
    layers.push({ clip: "roll", time: Math.min(1, s.t / total) * (dur("roll") - 1e-3), weight: 1 });
    // Turned to the roll's own heading during the crouch (the first 34 ms), not snapped (the in-between
    // velocity, turning from the old run's to the roll's, made the body zigzag 145° then back 124°; a
    // half-life of 0.012 put 62% of a turn in one frame).
    faceHalf = s.t < 0.034 ? 0.03 : 0.02;
    face = p.rollDir ?? (speed > 1 ? Math.atan2(s.vy, s.vx) : s.face);
    lean = false;
    // (the gait's speed kept as it was before the roll, never raised by the roll's own: from a stand
    // it brought the legs in at the roll's end)
    stride(rec, Math.min(speed, rec.vS ?? 0), 0, view.t);
  } else if (s.state === STATE.ATTACK && /^sw\d$/.test(moveOf(p)?.pose || "")) {
    // A cut fitted to the owner's video (the one-handed sword's, anim/sword-tracks.js) carries its whole body in its
    // track: under it the idle, not the old keyed swing's lunge — at each join of the chain that clip changed under him
    // and his hips jumped 1.25 in a frame. (one key for all of them: no blend between the chained cuts)
    key = "swingT";
    layers.push({ clip: "idle", time: view.t % dur("idle"), weight: 1 });
    legsW = strideLegs(legs, rec, stride(rec, speed, moved, view.t), dur);
    faceHalf = s.t < 0.05 ? 0.012 : 0.03;
  } else if (s.state === STATE.ATTACK) {
    const step = Math.min(2, p.step || 0);
    const clip = `swing${step + 1}`;
    key = clip;
    const c = PLAYER.combo[step];
    const m = marks?.[clip] || { windEnd: dur(clip) * 0.3, liveEnd: dur(clip) * 0.5, end: dur(clip) };
    let time, rawT;
    if (s.t < c.wind) time = (s.t / c.wind) * m.windEnd;
    else if (s.t < c.wind + c.active) time = m.windEnd + ((s.t - c.wind) / c.active) * (m.liveEnd - m.windEnd); // no easing: a cut snaps
    else {
      const rec0 = s.t - c.wind - c.active;
      const u = Math.min(1, rec0 / Math.max(0.01, c.recover));
      time = m.liveEnd + (1 - (1 - u) * (1 - u)) * (m.end - m.liveEnd);
      rawT = time;
      // A buffered next swing holds the follow-through rather than showing the rest pose: the
      // clip's own follow-through end (`followHold`) where the marks give one, exactly (held past
      // it, the painted hero's clips went on into their way back and held that).
      if (p.buffer === "attack") {
        const u0 = 0.35;
        // (a press after the follow-through's end holds the clip where it has got to: never back in time — it
        // jumped back 0.07 s in one frame, then stood still)
        const reached = rec.swStep === step && s.t >= rec.swSimT - 1e-6 ? rec.swTime : -Infinity;
        time = Math.min(time, Math.max(m.followHold ?? m.liveEnd + (1 - (1 - u0) * (1 - u0)) * (m.end - m.liveEnd), reached));
      }
    }
    if (rawT === undefined) rawT = time;
    // (a hold let go before the swing ends — the buffered press ran out, or a roll press replaced it — catches
    // up on the eased recovery at up to twice its own pace, never in one frame: both arms jumped 3.5-5 u)
    if (rec.swStep === step && s.t >= rec.swSimT - 1e-6 && rec.swTime < (rec.swRaw ?? -Infinity) - 1e-6 && time > rec.swTime) {
      const pace = (m.end - m.liveEnd) / Math.max(0.01, c.recover);
      time = Math.min(time, rec.swTime + Math.max(rawT - rec.swRaw, 2 * pace * (s.t - rec.swSimT)));
    }
    [rec.swStep, rec.swSimT, rec.swTime, rec.swRaw] = [step, s.t, time, rawT];
    layers.push({ clip, time: Math.min(time, dur(clip) - 1e-3), weight: 1 });
    // Moving through a swing (the stick steers him, sim/player.js): the legs walk or run under the
    // cut, on the same distance-driven phase, so the feet do not slide.
    // (backing off through a swing: the legs walk backwards, along the travel)
    const backS = speed > 1 && s.vx * Math.cos(s.face) + s.vy * Math.sin(s.face) < -0.3 * speed;
    rec.strideBack = backS;
    legsW = strideLegs(legs, rec, stride(rec, speed, backS ? -moved : moved, view.t), dur);
    faceHalf = s.t < 0.05 ? 0.012 : 0.03;
  } else if (s.state === STATE.HURT) {
    key = "hurt";
    // He keeps his facing (the guide: he never turns by himself; turning to the attacker and back
    // snapped him round half a turn after a blow from behind). The clip is a blow from the front,
    // thrown back: it carries the reaction as far as the blow came from in front, the rest stands
    // and the hit's lean (hero-life.js) tips him away from wherever it came from.
    const front = speed > 5 ? Math.max(0, -(s.vx * Math.cos(s.face) + s.vy * Math.sin(s.face)) / speed) : 1;
    // (none of it from behind or the side: thrown back by a blow from behind, he read as hit from the front)
    const hw = front;
    layers.push({ clip: "hurt", time: Math.min(1, s.t / PLAYER.hurtTime) * (dur("hurt") - 1e-3), weight: hw });
    if (hw < 1) layers.push({ clip: "idle", time: view.t % dur("idle"), weight: 1 - hw });
    rec.knock = true;
    // Still sliding back once the clip's flinch is done (the bell entrance's stagger slides him for
    // longer): the legs step backwards under it, the walk played in reverse, not a glide.
    const back = s.vx * Math.cos(s.face) + s.vy * Math.sin(s.face) < 0;
    rec.strideBack = back;
    // (the gait's speed kept as it was, as the roll's: the knock-back's 108 u/s brought the run's body in, and
    // a hit standing ended in 0.3 s of the run clip at speed 0)
    const st = stride(rec, Math.min(speed, rec.vS ?? 0), back ? -moved : moved, view.t);
    const on = smoothstep(0.7 * PLAYER.hurtTime, PLAYER.hurtTime, s.t) * st.moveW;
    if (on > 0.01) {
      legsW = on;
      legs.push({ clip: "walk", time: rec.phase * dur("walk"), weight: 1 });
    }
    faceHalf = 0.02;
  } else {
    // Standing and moving: one blend, one phase, driven by distance.
    key = "loco";
    // Still sliding from a knock-back (slowing, no stick): he keeps his facing and steps backwards
    // with it, not round to run away from the blow (the walk played backwards, its phase run back).
    if (rec.knock && (speed < 4 || speed > rec.lastSpeed + 0.5)) rec.knock = false;
    const sliding = rec.knock && speed > 4;
    // backing: sliding from a blow, or a slow step back with the facing held (fast, he turns to run)
    // (against the face actually shown: the last run's is held only 0.13 s, as below)
    const fh = rec.wasMoving > 0 && view.t - rec.wasMoving < 0.13 && rec.faceHold != null ? rec.faceHold : s.face;
    const back = (sliding && s.vx * Math.cos(s.face) + s.vy * Math.sin(s.face) < 0) || (!sliding && speed > 1 && speed <= 8 && s.vx * Math.cos(fh) + s.vy * Math.sin(fh) < -0.3 * speed);
    rec.strideBack = back;
    const st = stride(rec, speed, back ? -moved : moved, view.t);
    const { runW, g } = st;
    // The body: idle into walk/run by the upper weight (slow, the arms hang and the trunk stands);
    // the legs: walk/run at full weight whenever moving (warped to the stride, stride.js).
    const up = g.upperW;
    if (up < 1) layers.push({ clip: "idle", time: view.t % dur("idle"), weight: 1 - up });
    if (up > 0) {
      if (runW < 1) layers.push({ clip: "walk", time: rec.phase * dur("walk"), weight: up * (1 - runW) });
      if (runW > 0) layers.push({ clip: "run", time: runT(rec, g, dur("run")), weight: up * runW });
    }
    legsW = strideLegs(legs, rec, st, dur);
    // Running faces where it goes, not where it aims (else the legs would run backwards).
    if (sliding) face = s.face;
    else if (speed > 8) face = Math.atan2(s.vy, s.vx);
    else if (rec.wasMoving > 0 && view.t - rec.wasMoving < 0.13 && rec.faceHold != null) face = rec.faceHold;
    if (speed > 8 && !sliding) {
      rec.wasMoving = view.t;
      rec.faceHold = face;
    }
  }

  rec.lastSpeed = speed;
  // the moving body's own layers, faded in and out of the actions (GAIT.locoRamp)
  {
    const dt = rec.lastT == null ? 0 : Math.max(0, Math.min(0.1, view.t - rec.lastT));
    const want = key === "loco" ? 1 : 0;
    rec.locoW = rec.locoW == null || dt <= 0 ? (rec.locoW ?? want) : rec.locoW + Math.max(-dt / GAIT.locoRamp, Math.min(dt / GAIT.locoRamp, want - rec.locoW));
  }
  rec.lastT = view.t;
  let half = null;
  if (key !== rec.key) {
    const kind = key.startsWith("swing") ? "swing" : key;
    half = BLEND[kind] ?? BLEND.loco;
    rec.key = key;
  }
  return { layers, legs, legsW, key, blendHalfLife: half, face, faceHalfLife: faceHalf, lean, speed, phase: rec.phase, moveW: rec.moveW, runW: rec.runW, locoW: rec.locoW, deathT, settle, gait: rec.gait, legsOn: legsW, strideBack: !!rec.strideBack };
}
