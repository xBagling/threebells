// Which of Gnasher's clips to show, and at what time, plus the procedural pieces that go with
// them (docs/3D-PLAN.md 7.4): a pure function of the sim's state and the view's own records. No
// three.js; tested under Bun.
//
//   idle            breathing; the walk (STRIDE units a cycle, by distance) when he moves over 8 u/s
//   gape, crouch    wind-ups PLAY over the first 45% of the clip, then HOLD — as in 2D, the hold is
//                   where the player decides
//   lash            the lunge (mouth open, body thrown forward) until his lane FIRES, then the
//                   strike, then a slow, open recovery (the punish window). The strike waits for
//                   the hazard, not the clip change: with today's beats the clip changes before
//                   the lane goes live
//   leap            up, air, down, stretched over the same take-off-to-landing time as the arc
//   land            (view-only) a squash when a leap comes down
//   croak           in, loop, out by clip time; the throat sac by the cast's progress when there is
//                   one, else by the clip's
//   hurt            the stagger: the whole 2.4 s window (rear back, slump, push up)
//   dead            sags down where he sits (the head drooping, the legs splaying), then held
import { clipLength } from "../../gfx/pose.js?v=48fd128-df87a96f";
import { phaseOf } from "../../sim/hazards.js?v=48fd128-df87a96f";
import { smoothstep } from "./procedural.js?v=48fd128-df87a96f";
import { schedule, lastBefore } from "./toad-life.js?v=48fd128-df87a96f";

// Standing between his moves he fidgets (the owner, 2026-10-15: "Make gnashers movement during the fight a bit more dynamic,
// more specifically when he is just standing still without any attack"): every 2.5-5 s one of — his throat puffing out with
// a half-open grunt, a heavy squat and rise, a lean at the hero, a little hop-shuffle in place. A pure function of view time
// (a hit-stop poses him the same); only while he sits idle, and eased in and out so a move cuts in cleanly.
const FIDGET = schedule(0x70ad, [2.5, 5]);
const FIDGET_TIME = [1.1, 0.8, 0.9, 0.5];
function fidget(t) {
  const f = lastBefore(FIDGET, t);
  if (!f) return null;
  const kind = (f.i * 7 + 3) % 4, u = (t - f.t) / FIDGET_TIME[kind];
  return u >= 0 && u < 1 ? { kind, u } : null;
}

export const WIND_SHARE = 0.45;
// World units a walk cycle covers: what his planted front feet travel back in one cycle of the 3D
// walk clip (61_frog_anims.py, measured from the built clip: about 9.4). At 2D's 46 (gfx/boss-anim.js,
// sized to the 2D sheets) his feet slid over the grass at four to five times their own pace — the
// G10 re-review's unchecked foot sliding, measured.
export const STRIDE = 7.9; // (the sitting toad's walk, 53_anim_toad.py: 0.045 of his 0.158 height a cycle × TOAD_H 27.8; the old toad's was 10)
export const LAND_TIME = 0.4;
/** The stagger's length (world.js: a broken poise sets b.stagger to 2.4): the hurt clip spans it. */
const STAGGER_TIME = 2.4;
/** The death clip's length (53_anim_toad.py: 42 frames at 30 fps; clipLength gives "dead" 1.4). */
const DEAD_TIME = 1.4;
/** One breath of the idle (his guide: every 2.0–2.4 s); enraged, everything 15% faster. */
const BREATH = 2.2;
const ENRAGE_PACE = 1.15;
const MOVING = 8;
const TELEPORT = 40;
/** Half-lives of the blend into each kind of change (7.5). */
const BOSS_BLEND = { windup: 0.07, strike: 0.03, recover: 0.06, idle: 0.08, leap: 0.03, land: 0.03, hurt: 0.035, dead: 0.06, walk: 0.08 };

/** The sim's clips Gnasher's picker handles itself (lash, wind-ups, leaps…); another boss's own clips go to its profile. */
const GNASHER_CASES = { dead: 1, hurt: 1, gape: 1, crouch: 1, lash: 1, leap: 1, croak: 1, roar: 1 };

/**
 * The picker's own record. `opts` (boss-profiles.js, through boss3d.js): the boss's stride, its clips,
 * its wind-ups, the clip that follows another, the clips' lengths in seconds. Gnasher's by default.
 */
export function makeBossRecord(opts = {}) {
  return { walk: 0, last: null, clip: null, landAt: -1, key: "", strikeAt: -1, strikeH: null, idle: 0, lastT: null, stride: opts.stride || STRIDE, clips: opts.clips || null, windups: new Set(opts.windups || []), after: opts.after || {}, durations: opts.durations || {}, afterAt: -1, afterClip: null, placeholders: opts.placeholders || {}, loops: new Set(opts.loops || []) };
}

/** His own live lash/hold hazard, if one is out (the tongue is drawn from it). */
function liveTongue(w) {
  for (const h of w.hazards) {
    if (h.friendly || (h.tag !== "lash" && h.tag !== "hold")) continue;
    const ph = phaseOf(h);
    if (ph === "active" || ph === "fade") return h;
    // (and in the last 0.07 s of its wind-up: the tongue is out the moment the lane strikes, not a few frames after the
    // hit — 2026-10-15)
    if (ph === "tele" && h.tele - h.t < 0.07) return h;
  }
  return null;
}
/** A lash/hold still winding up (the strike is coming). */
function pendingTongue(w) {
  for (const h of w.hazards) if (!h.friendly && (h.tag === "lash" || h.tag === "hold") && phaseOf(h) === "tele") return h;
  return null;
}

/**
 * `b` the boss (x, y in between), `s` = lerp3d.boss(w), `view` = { t, now }, `w` the world.
 * Returns { clip, time (0..1 of the clip), key, blendHalfLife, squash, lurch, sac, mouth, tongue }.
 */
export function bossAnimState(rec, b, s, w, view) {
  let moved = 0;
  if (rec.last) {
    const d = Math.hypot(b.x - rec.last[0], b.y - rec.last[1]);
    if (d < TELEPORT) moved = d;
  }
  rec.last = [b.x, b.y];
  const dt = rec.lastT == null ? 0 : Math.max(0, Math.min(0.1, view.t - rec.lastT));
  rec.lastT = view.t;
  if (rec.clip === "leap" && s.clip !== "leap") rec.landAt = view.t;
  // (a clip that follows another when the sim's ends: Cinder's release after her cast)
  if (rec.clip && rec.clip !== s.clip && rec.after[rec.clip] && s.clip === "idle") [rec.afterAt, rec.afterClip] = [view.t, rec.after[rec.clip]];
  rec.clip = s.clip;
  const speed = Math.hypot(s.vx, s.vy);
  const len = clipLength(b);
  const u = len > 0 ? Math.min(1, s.clipT / len) : 1;
  const out = { clip: "idle", u: 0, key: "idle", squash: 1, lurch: 0, sac: 0, mouth: 0, tongue: null, breathe: Math.sin(view.t * ((Math.PI * 2) / 2.8)) };

  // A lunge inside the move (motion windows): stepping stops, the body is thrown forward.
  const inLunge = (b.move?.motion || []).some((m) => b.moveT >= m.at && b.moveT <= m.at + m.dur);

  // Another boss's own clips (boss-profiles.js): a wind-up plays over the first part of the sim's window
  // and holds (as Gnasher's gape and crouch); any other clip it has plays once, over its own length.
  const own = rec.clips && !(s.clip in GNASHER_CASES) && rec.clips[s.clip] && s.clip !== "idle" && s.clip !== "walk";
  const afterOn = rec.afterClip && s.clip === "idle" && view.t - rec.afterAt < (rec.durations[rec.afterClip] || 0.5);
  // (a clip the model has not got yet stood in for by its own clips by the sim clip's clock — Sister Cinder's opening, till the
  // owner's video of it is made: boss-profiles.js placeholders, [from, clip, spread over s])
  const stand = rec.placeholders[s.clip];
  let place = null;
  if (stand) for (const e of stand) if (s.clipT >= e[0]) place = e;
  switch (place ? "_place" : own ? "_own" : afterOn ? "_after" : s.clip) {
    case "_place": {
      out.clip = out.key = place[1];
      out.u = place[1] === "idle" ? ((s.clipT - place[0]) / 2.4) % 1 : Math.min(1, (s.clipT - place[0]) / place[2]);
      break;
    }
    case "_own": {
      out.clip = s.clip;
      out.key = s.clip;
      if (rec.windups.has(s.clip)) out.u = Math.min(1, u / WIND_SHARE);
      else if (rec.loops.has(s.clip)) out.u = (s.clipT / (rec.durations[rec.clips[s.clip]] || 1)) % 1; // (a held wait, looping)
      else out.u = Math.min(1, s.clipT / (rec.durations[s.clip] || len || 1));
      break;
    }
    case "_after": {
      out.clip = rec.afterClip;
      out.key = rec.afterClip;
      out.u = Math.min(1, (view.t - rec.afterAt) / (rec.durations[rec.afterClip] || 0.5));
      break;
    }
    case "dead":
      out.clip = "dead";
      out.u = Math.min(1, s.clipT / DEAD_TIME);
      out.key = "dead";
      // (the clip itself sags him down where he sits, so only a little settling squash on top)
      out.squash = 1 - 0.06 * smoothstep(0.5, 1, out.u);
      break;
    case "hurt":
      out.clip = "hurt";
      // The stagger: rear back, slump onto the chin, push up at the end, over the whole window.
      out.u = Math.min(1, s.clipT / STAGGER_TIME);
      out.key = "hurt";
      out.squash = 0.92 + 0.08 * smoothstep(0, 0.4, s.clipT);
      break;
    case "gape":
    case "crouch": {
      out.clip = s.clip;
      out.u = Math.min(1, u / WIND_SHARE); // plays, then holds
      out.key = s.clip;
      if (s.clip === "crouch") out.squash = 1 - 0.15 * smoothstep(0, 1, out.u);
      // (his held attack: reared and holding, he trembles and his throat swells, more as the strike nears — a charge
      // building, so holding back reads as a choice, 2026-10-15)
      if (s.clip === "crouch" && b.lastMove === "hold" && b.move) {
        const k = smoothstep(0.25, 1.72, b.moveT);
        out.squash += 0.025 * k * Math.sin(view.t * 52);
        out.lurch = 0.12 * k * Math.sin(view.t * 37);
        out.sac = k * (0.55 + 0.25 * Math.sin(view.t * Math.PI * 7));
      }
      if (s.clip === "gape") out.mouth = smoothstep(0, 1, out.u) * 0.7;
      break;
    }
    case "lash": {
      const live = liveTongue(w);
      out.clip = "lash";
      out.mouth = 1;
      if (live) {
        // The strike: from the moment the lane fired.
        if (rec.strikeH !== live) {
          rec.strikeH = live;
          rec.strikeAt = view.t;
        }
        out.key = "lash_strike";
        out.tongue = live;
        out.u = 0.4 + 0.6 * Math.min(1, (view.t - rec.strikeAt) / 0.8);
      } else if (pendingTongue(w)) {
        out.key = "lash_lunge";
        out.u = 0.25;
        out.lurch = 1;
      } else {
        // Spit, or after the lane: the recovery, mouth still open.
        out.key = rec.strikeH ? "lash_recover" : "lash_strike";
        out.u = Math.min(1, u);
        out.mouth = 1 - smoothstep(0.5, 1, u);
      }
      break;
    }
    case "leap":
      out.clip = "leap";
      out.u = u;
      out.key = "leap";
      out.squash = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 3));
      break;
    case "roar": {
      // His arrival's croak at the hero (sim/world.js stepEntrance): the gape thrown wide fast, the throat sac swelling,
      // held, then closing as the name card comes
      out.clip = "gape";
      out.key = "gape";
      out.u = Math.min(1, s.clipT / 0.22);
      const open = smoothstep(0, 0.22, s.clipT) * (1 - smoothstep(0.95, 1.2, s.clipT));
      out.mouth = open;
      out.sac = open * (0.7 + 0.3 * Math.sin(view.t * Math.PI * 6));
      out.squash = 1 + 0.05 * open;
      break;
    }
    case "croak": {
      out.clip = "croak";
      out.u = u;
      out.key = "croak";
      const k = b.casting ? b.casting.k ?? u : u;
      out.sac = smoothstep(0, 0.15, s.clipT) * (1 - smoothstep(len - 0.2, len, s.clipT)) * (0.75 + 0.25 * Math.sin(view.t * Math.PI * 4)) * (0.6 + 0.4 * k);
      break;
    }
    default: {
      // Idle: a landing squash first, then idle or walk.
      if (rec.landAt >= 0 && view.t - rec.landAt < LAND_TIME) {
        const lt = view.t - rec.landAt;
        out.clip = "land";
        out.key = "land";
        out.u = lt / LAND_TIME;
        out.squash = lt < 0.06 ? 0.75 : 0.75 + 0.3 * Math.sin(Math.min(1, (lt - 0.06) / 0.14) * Math.PI * 0.5) - 0.05 * smoothstep(0.2, 0.4, lt);
      } else if (speed > MOVING) {
        rec.walk += moved;
        out.clip = "walk";
        out.key = "walk";
        out.u = (rec.walk / rec.stride) % 1;
      } else {
        out.clip = "idle";
        out.key = "idle";
        rec.idle = (rec.idle + (dt / BREATH) * (w?.enraged ? ENRAGE_PACE : 1)) % 1;
        out.u = rec.idle;
        // (his fidgets, only after a second of sitting: not as a move ends)
        rec.idleSince = rec.wasIdle ? rec.idleSince : view.t;
        rec.wasIdle = true;
        const fg = view.t - rec.idleSince > 1 ? fidget(view.t) : null;
        if (fg) {
          const bell = Math.sin(Math.PI * fg.u);
          // (the model takes squash at 35% and the sac at 20% a unit: boss3d.js — these are sized for that)
          if (fg.kind === 0) ((out.sac = 2.2 * smoothstep(0, 0.35, fg.u) * (1 - smoothstep(0.7, 1, fg.u))), (out.mouth = 0.18 * bell));
          else if (fg.kind === 1) out.squash = 1 - 0.3 * Math.sin(Math.PI * Math.min(1, fg.u * 1.6)) + 0.12 * smoothstep(0.6, 0.8, fg.u) * (1 - smoothstep(0.8, 1, fg.u));
          else if (fg.kind === 2) out.lurch = 0.7 * bell;
          else out.squash = 1 + 0.25 * Math.sin(Math.PI * 2 * fg.u) * (1 - fg.u);
        }
      }
    }
  }
  if (out.key !== "idle") rec.wasIdle = false;
  // (a lash lane live while he still gapes: the double lash's second lane fires a tick before its "lash" clip, and the hit's
  // freeze held the gape — the hero was struck by a lane with no tongue in it, 2026-10-15. The tongue is out with the lane)
  if (!out.tongue && s.clip === "gape") {
    const lv = liveTongue(w);
    if (lv) (out.tongue = lv), (out.mouth = 1);
  }
  if (inLunge) out.lurch = Math.max(out.lurch, 0.8);
  out.blendHalfLife = null;
  if (out.key !== rec.key) {
    const k = out.key;
    out.blendHalfLife = k === "lash_strike" ? BOSS_BLEND.strike : k === "lash_recover" ? BOSS_BLEND.recover : k === "gape" || k === "crouch" || k === "lash_lunge" ? BOSS_BLEND.windup : BOSS_BLEND[k] ?? BOSS_BLEND.idle;
    rec.key = k;
  }
  return out;
}
