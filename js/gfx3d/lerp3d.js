// Between ticks, for the 3D view. Pure: no three.js, runs under Bun.
//
// The sim steps at a fixed 60 Hz and only positions are drawn between ticks in 2D (render.js
// beforeStep / lerpWorld). On a 120 or 144 Hz screen a skeleton driven straight from the sim's
// clocks and facing would still step at 60 Hz, so the 3D view keeps its own copy of the last tick
// for each thing it animates and draws the in-between value (docs/3D-PLAN.md 2.4):
//
//   positions    x, y of the hero, the boss, adds and shots, moved inside lerpWorld and put back
//                after the frame, exactly as in 2D (TELEPORT: a longer jump is drawn as a jump)
//   clocks       p.t, b.clipT, world.stateT: in between when the state or clip did not change on
//                the last tick; counted from the change when it did
//   facings      along the shortest arc
//   velocities   in between, for leaning and stepping
//   hazards      their own x, y, a in between, kept here (the hazards are never moved)
//   view clock   counts every tick that was not frozen in hitstop: it runs through the name card,
//                the fall and the victory (the sim's own clocks stop outside the fight), holds in
//                hitstop and pause, and follows world.slow and the admin slow-time and frame-step
//
// Nothing here ever writes to the world except the positions inside lerpWorld, which are always
// put back; nothing calls world.rand.
import { TICK } from "../config.js?v=8898846";

export const TELEPORT = 40;

const lerp = (a, b, t) => a + (b - a) * t;
/** The angle part-way from a to b, the short way round. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
/**
 * A clock in between two ticks. `sameRun` is false when the state or clip changed on the last tick:
 * the clock restarted then, so it is counted back from the change rather than from before it.
 */
export function lerpClock(prev, cur, sameRun, alpha) {
  if (!sameRun) return Math.max(0, cur - (1 - alpha) * TICK);
  return lerp(prev, cur, alpha);
}

export function makeLerp3D() {
  const prevPos = new WeakMap(); // entity → [x, y]
  const prevHaz = new WeakMap(); // hazard → { x, y, a, t }
  let prevP = null; // the hero's last tick: { t, state, face, vx, vy }
  let prevB = null; // the boss's: { clipT, clip, face, vx, vy, moveT }
  let prevW = null; // the world's: { stateT, state }
  let frozen = false;
  let viewT = 0; // seconds of sim-view time
  let alphaNow = 0;

  function movers(w) {
    const out = [w.player];
    if (w.boss) out.push(w.boss);
    for (const a of w.adds) out.push(a);
    for (const s of w.shots) out.push(s);
    return out;
  }

  return {
    /** Call just before each world.step. */
    beforeStep(w) {
      for (const e of movers(w)) prevPos.set(e, [e.x, e.y]);
      for (const h of w.hazards) prevHaz.set(h, { x: h.x, y: h.y, a: h.a ?? 0, t: h.t ?? 0 });
      const p = w.player;
      prevP = { t: p.t, state: p.state, face: p.face, vx: p.vx, vy: p.vy };
      const b = w.boss;
      prevB = b ? { clipT: b.clipT, clip: b.clip, face: b.face, vx: b.vx, vy: b.vy, moveT: b.moveT } : null;
      prevW = { stateT: w.stateT, state: w.state };
      frozen = w.hitstop > 0;
    },
    /** Call once after each world.step (from consume): the view clock counts the tick if it moved. */
    afterStep() {
      if (!frozen) viewT += TICK;
    },
    /** Move positions `alpha` of the way through the last tick; returns the function that puts them back. */
    lerpWorld(w, alpha) {
      alphaNow = alpha;
      const moved = [];
      try {
        if (alpha >= 0 && alpha < 1) {
          for (const e of movers(w)) {
            const was = prevPos.get(e);
            if (!was) continue;
            const dx = e.x - was[0];
            const dy = e.y - was[1];
            if (dx === 0 && dy === 0) continue;
            if (dx * dx + dy * dy > TELEPORT * TELEPORT) continue;
            moved.push([e, e.x, e.y]);
            e.x = was[0] + dx * alpha;
            e.y = was[1] + dy * alpha;
          }
        }
      } catch (err) {
        for (const [e, x, y] of moved) (e.x = x), (e.y = y);
        throw err;
      }
      return () => {
        for (const [e, x, y] of moved) {
          e.x = x;
          e.y = y;
        }
      };
    },
    /** The alpha of the frame being drawn. */
    get alpha() {
      return alphaNow;
    },
    /** Sim-view seconds for the frame being drawn (holds still in hitstop). */
    viewTime(w) {
      return w.hitstop > 0 ? viewT : viewT + alphaNow * TICK;
    },
    /** The hero's in-between clock, facing and velocity. */
    hero(w) {
      const p = w.player;
      const a = alphaNow;
      if (!prevP) return { t: p.t, face: p.face, vx: p.vx, vy: p.vy, state: p.state };
      return {
        state: p.state,
        t: lerpClock(prevP.t, p.t, prevP.state === p.state && p.t >= prevP.t, a),
        face: lerpAngle(prevP.face, p.face, a),
        vx: lerp(prevP.vx, p.vx, a),
        vy: lerp(prevP.vy, p.vy, a),
      };
    },
    /** The boss's. */
    boss(w) {
      const b = w.boss;
      const a = alphaNow;
      if (!prevB) return { clip: b.clip, clipT: b.clipT, face: b.face, vx: b.vx, vy: b.vy, moveT: b.moveT };
      const same = prevB.clip === b.clip && b.clipT >= prevB.clipT;
      return {
        clip: b.clip,
        clipT: lerpClock(prevB.clipT, b.clipT, same, a),
        face: lerpAngle(prevB.face, b.face, a),
        vx: lerp(prevB.vx, b.vx, a),
        vy: lerp(prevB.vy, b.vy, a),
        moveT: b.moveT >= prevB.moveT ? lerp(prevB.moveT, b.moveT, a) : b.moveT,
      };
    },
    /** world.stateT in between (death and victory run on it). */
    stateT(w) {
      if (!prevW) return w.stateT;
      return lerpClock(prevW.stateT, w.stateT, prevW.state === w.state && w.stateT >= prevW.stateT, alphaNow);
    },
    /** A hazard's position and angle in between; the hazard itself is never moved. */
    hazard(h) {
      const was = prevHaz.get(h);
      if (!was) return { x: h.x, y: h.y, a: h.a ?? 0 };
      const a = alphaNow;
      return { x: lerp(was.x, h.x, a), y: lerp(was.y, h.y, a), a: lerpAngle(was.a, h.a ?? 0, a) };
    },
  };
}
