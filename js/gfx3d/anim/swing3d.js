// The hero's sword cuts and the way he carries the sword (docs/3D-PLAN.md 7.3), driven by the sim's
// own swing clock, so the blade agrees with the hitbox by construction.
//
// The sim's live blade (player.js swingArc) always sweeps from face − arc/2 to face + arc/2 across
// the live window — from the hero's left to his right, a forehand for the left-handed hero (D7) —
// for every cut. Library combos alternate direction and the heavy is an overhead slam, so neither
// can show it. Here a cut is a pose worked out from the swing's time, channel by channel:
//
//   r, pitch       the blade: its yaw from the facing (world yaw = face + r) and its rise
//   psi, hh, reach the sword hand: its bearing from the chest (from the facing), its height (0 the
//                  hip, 1 the shoulder, more above) and its distance (a share of the arm's length)
//   shift, dip     the weight: back (−1) or forward (1) over the planted feet, and the knees' bend
//   lean, roll     the torso bending forward, and sideways (to the right +)
//   twist          the torso turned further into the cut than the hand takes it (radians, right +)
//   off            the free hand: reaching forward (0) or pulled back to the hip (1)
//   edge           the blade's edge: upright (0), or leading the sweep (1)
//   ground         how far the blade's rise is set instead from the drawn grip's height so the tip
//                  meets the grass (the heavy; applyArms)
//
// and the body follows the hand: the torso twists after it (the hips a little, the chest more, the
// head turned back to the target), the sword arm reaches by two-bone IK, the free arm balances.
// The phases, each on the sim's own clock:
//
//   wind-up    draw back: from where the sword is (the carry, the guard, or where the last cut was
//              held) into a coil past the arc's start — the weight back, the torso wound up, the
//              hand high by the shoulder (swing1), low by the hip (swing2) or over the head (swing3);
//              then the release, accelerating, to arrive at the arc's start at the live window's own
//              speed. The wind-up is as short as the sim's (0.1–0.17 s) whatever the sword's start,
//              so the plan fits the start (windPlan): the further the blade has to come back, the
//              shallower the coil and the shorter the release, so the draw-back never turns the
//              blade faster than the cut itself — the cut stays the fastest thing on screen
//   live       the yaw runs straight from face − arc/2 to face + arc/2, exactly swingArc's (a cut
//              snaps: no easing); the weight drives forward, the torso unwinds
//   recovery   the follow-through (the first 35%; the heavy's 45%, its blade biting into the ground
//              and levered out) carries on past the arc's end, slowing from the
//              live speed; then back to the guard — or, with a next swing buffered, held a moment
//              and brought round over the top part of the way into the next cut's coil
//
// swing1 is a flat forehand at chest height, swing2 a rising diagonal from the hip to over the
// shoulder, swing3 (the heavy) a big diagonal cleave: lifted over the head as it starts across (so
// it shows above the hood even from behind, the view of most of a fight), then chopped down into the
// ground, the body dropping into a lunge and turning into it, the tip in the grass by the live
// window's end (applyArms sets the last of the fall from the drawn grip) and biting there before it
// is drawn out. Where it lands is worked out per facing (heavyEnd): out at his right, as designed,
// wherever that shows; seen from behind, where it would land behind the cape, the hand stays on the
// sword side and drives the blade down steeply beside him, levered round towards the sword side as
// it bites. All three sweep the sim's yaw range; their heights are the view's own.
//
// The sword is carried on the sword side (never across the front: a cut out of the carry would
// have to whip it back round in the wind-up), turned out or in as far as it takes to show past the
// body from where the camera stands (bladeShows, a small model of the hero's silhouette). A cut is
// turned to show as well, at every facing (viewLift): wherever it would point straight away from
// the camera the blade goes up over the hood and the hand out past the body; where a live
// window's end (or the coil it is released from) would not show, the blade is raised there as far
// as it takes (keyLift); where it sweeps past the line to the camera it passes over or under it,
// never end-on (towardPush). The yaw through the live window is always the sim's.
//
// The pure part (bladeAt, carryPose, bladeShows, mixPose) has no three.js objects and is tested
// under Bun (tools/test.mjs); applyCutBody and applyArms pose a skeleton.
import { Vector3, Quaternion, Matrix4 } from "../three-lib.js?v=df092a6";
import { PLAYER, FORE, sweepDir } from "../../config.js?v=df092a6";
import { RIGHT as CAM_RIGHT, UP as CAM_UP, BACK as CAM_BACK } from "../camera3d.js?v=df092a6";
import { wrapAngle, smoothstep } from "./procedural.js?v=df092a6";
import { turnWorld, setWorldQuaternion, twoBoneIK } from "./ik.js?v=df092a6";
import * as SWORD_TRACKS from "./sword-tracks.js?v=df092a6";

// (`dir`: which way the cut sweeps its yaw, +1 a forehand, −1 a backhand — the leading edge goes that way)
const CHANNELS = ["r", "pitch", "psi", "hh", "reach", "shift", "dip", "lean", "roll", "off", "edge", "ground", "twist", "hang", "soft", "hfwd", "kin", "th", "el", "ab", "inw", "wlim", "wcap", "fkin", "fth", "fel", "fab", "finw", "dir", "both", "ohf", "ohs", "ohu", "ohw"];

/**
 * The guard (V50, the target image): the sword hand low at the sword-side hip, a little in front; the
 * blade ahead and raised 20°, turned out to the sword side as the target holds it, so it shows past
 * the body from behind (the view of most of a fight) as well as from in front. (r, psi and dir by FORE:
 * the numbers are the left hand's, mirrored for the right.)
 */
export const GUARD = Object.freeze({ r: -0.75 * FORE, pitch: 0.35, psi: -1.1 * FORE, hh: 0.08, reach: 0.55, shift: 0, dip: 0, lean: 0, roll: 0, off: 0.6, edge: 0, ground: 0, twist: 0, hang: 0, soft: 0, hfwd: 0, kin: 0, th: 0, el: 0, ab: 0, inw: 0, wlim: 0, wcap: 0, fkin: 0, fth: 0, fel: 0, fab: 0, finw: 0, dir: FORE, both: 0, ohf: 0, ohs: 0, ohu: 0, ohw: 0 });

/**
 * Each cut's keys: C the coil at the end of the draw-back (its r counted from the arc's start), L0
 * and L1 the live window's ends (their r is the arc's, exactly), F the end of the follow-through
 * (its r and psi carry on at the live speed). `lift` is the draw-back's share of the wind-up, `tv`
 * how much the sweep climbs (+) or falls (−), for the leading edge.
 */
const CUTS = [
  {
    // swing1: a flat forehand. Drawn back high by the left shoulder, the blade pointing back and up.
    lift: 0.55,
    tv: -0.15,
    C: { r: -0.7, pitch: 0.42, psi: -1.3, hh: 0.95, reach: 0.55, shift: -0.7, dip: 0.3, lean: -0.06, roll: -0.05, off: 0, edge: 0.6 },
    L0: { pitch: 0.08, psi: -0.8, hh: 0.8, reach: 0.86, shift: -0.3, dip: 0.55, lean: 0.06, roll: 0, off: 0.3, edge: 1 },
    L1: { pitch: -0.1, psi: 0.8, hh: 0.58, reach: 0.9, shift: 0.8, dip: 0.6, lean: 0.16, roll: 0.05, off: 1, edge: 1 },
    F: { pitch: -0.3, hh: 0.45, reach: 0.72, shift: 1, dip: 0.5, lean: 0.2, roll: 0.06, off: 1, edge: 0.6 },
  },
  {
    // swing2: a rising diagonal. Drawn back low behind the left hip, the blade pointing back and
    // down; it sweeps up across the front and finishes over the right shoulder.
    lift: 0.55,
    tv: 0.5,
    C: { r: -0.7, pitch: -0.42, psi: -1.25, hh: -0.12, reach: 0.62, shift: -0.5, dip: 0.7, lean: 0.14, roll: -0.08, off: 0, edge: 0.5 },
    L0: { pitch: -0.22, psi: -0.85, hh: 0.05, reach: 0.86, shift: -0.2, dip: 0.6, lean: 0.12, roll: -0.04, off: 0.3, edge: 1 },
    L1: { pitch: 0.38, psi: 0.85, hh: 0.95, reach: 0.9, shift: 0.7, dip: 0.22, lean: 0.02, roll: 0.06, off: 1, edge: 1 },
    F: { pitch: 0.62, hh: 1.25, reach: 0.72, shift: 0.9, dip: 0.12, lean: -0.04, roll: 0.08, off: 1, edge: 0.6 },
  },
  {
    // swing3, the heavy: a diagonal cleave. Lifted over the head (the weight back, leaning away);
    // through the live window it goes on up over the hood as it starts across (`arch`), then chops
    // down, faster and faster (`late`), to the ground out at the right, the body dropping into it.
    lift: 0.58,
    tv: -0.9,
    arch: { pitch: 0.5, hh: 0.3 },
    late: true,
    // After it: the blade bites into the ground and stops there (`bite`: 10× the follow-through's
    // average speed at first, slowing), is held in it a moment (`bitten`, a share of a longer
    // follow-through, `follow` of the recovery) and is then drawn up out of it, turned to show.
    bite: 10.5,
    // Brought up out of the ground and round for a next cut, it is turned to show all the way
    // (it crosses from his far side to the sword side, behind the hood from behind).
    midLift: 0.75,
    follow: 0.45,
    bitten: 0.3,
    rise: 1,
    C: { r: -0.55, pitch: 0.95, psi: -0.55, hh: 1.6, reach: 0.5, shift: -0.8, dip: 0.05, lean: -0.18, roll: -0.12, off: 0.15, edge: 0.3 },
    L0: { pitch: 0.85, psi: -0.7, hh: 1.5, reach: 0.78, shift: -0.2, dip: 0.3, lean: 0.02, roll: -0.05, off: 0.5, edge: 1 },
    L1: { pitch: -0.52, psi: 1.1, hh: -0.5, reach: 0.75, shift: 1, dip: 1.4, lean: 0.55, roll: 0.24, off: 1, edge: 1, twist: 0.9 },
    F: { pitch: -0.58, hh: -0.58, reach: 0.7, shift: 1, dip: 1.4, lean: 0.57, roll: 0.24, off: 1, edge: 0.7, twist: 0.95 },
  },
];
/**
 * The other weapons' cuts (content/weapons.js `pose`), on the same keys: a move names its template and its sweep
 * (+1 from his left to his right, the sword's forehand; −1 the mirror image, a backhand). Melee practice, as Elden
 * Ring's movesets show it: drawn back against the cut (the coil), the hand leading the blade through, the body
 * turning and dropping into it, carried on past the arc's end and slowing (docs/WEAPONS.md).
 *   flat      a level sweep at chest height (the sword's swing1)
 *   rise      low behind the hip, up across the front to over the far shoulder (swing2)
 *   fall      high over the near shoulder, down across the front to the far hip
 *   overhead  lifted over the head, the blade back and up, chopped straight down in front (a great weapon's
 *             slam: onto the ground, `ground`)
 *   thrust    drawn back at the hip, driven straight out along the facing, the arm long
 *   bash      a shield driven out in front from the chest
 */
const TEMPLATES = {
  s1: CUTS[0],
  s2: CUTS[1],
  s3: CUTS[2],
  flat: CUTS[0],
  rise: CUTS[1],
  fall: {
    lift: 0.55,
    tv: -0.6,
    C: { r: -0.6, pitch: 0.75, psi: -1.2, hh: 1.35, reach: 0.55, shift: -0.6, dip: 0.25, lean: -0.08, roll: -0.06, off: 0.1, edge: 0.5 },
    L0: { pitch: 0.45, psi: -0.8, hh: 1.15, reach: 0.85, shift: -0.2, dip: 0.4, lean: 0.05, roll: 0, off: 0.3, edge: 1 },
    L1: { pitch: -0.38, psi: 0.85, hh: 0.3, reach: 0.9, shift: 0.8, dip: 0.65, lean: 0.22, roll: 0.06, off: 1, edge: 1 },
    F: { pitch: -0.5, hh: 0.15, reach: 0.72, shift: 1, dip: 0.55, lean: 0.24, roll: 0.07, off: 1, edge: 0.6 },
  },
  overhead: {
    lift: 0.6,
    tv: -1,
    drop: true,
    C: { r: -0.25, pitch: 1.35, psi: -0.4, hh: 1.75, reach: 0.45, shift: -0.7, dip: 0.1, lean: -0.2, roll: -0.04, off: 0.2, edge: 0.3 },
    L0: { pitch: 1.0, psi: -0.25, hh: 1.7, reach: 0.7, shift: -0.2, dip: 0.25, lean: -0.02, roll: 0, off: 0.4, edge: 1 },
    L1: { pitch: -0.55, psi: 0.12, hh: 0.15, reach: 0.88, shift: 1, dip: 1.15, lean: 0.48, roll: 0.02, off: 1, edge: 1 },
    F: { pitch: -0.62, hh: -0.05, reach: 0.82, shift: 1, dip: 1.2, lean: 0.5, roll: 0.02, off: 1, edge: 0.7 },
  },
  thrust: {
    lift: 0.6,
    tv: 0,
    straight: true,
    C: { r: 0, pitch: 0.06, psi: -0.6, hh: 0.62, reach: 0.32, shift: -0.65, dip: 0.45, lean: -0.05, roll: -0.03, off: 0.4, edge: 0.1 },
    L0: { pitch: 0.03, psi: -0.3, hh: 0.66, reach: 0.58, shift: -0.1, dip: 0.5, lean: 0.08, roll: 0, off: 0.7, edge: 0.1 },
    L1: { pitch: -0.02, psi: -0.05, hh: 0.7, reach: 1.0, shift: 1, dip: 0.72, lean: 0.24, roll: 0, off: 1, edge: 0.1 },
    F: { pitch: -0.06, hh: 0.66, reach: 0.9, shift: 0.9, dip: 0.6, lean: 0.2, roll: 0, off: 1, edge: 0.1 },
  },
  bash: {
    lift: 0.6,
    tv: 0,
    straight: true,
    C: { r: 0, pitch: 0.9, psi: -0.4, hh: 0.85, reach: 0.3, shift: -0.6, dip: 0.4, lean: -0.05, roll: 0, off: 0.5, edge: 0 },
    L0: { pitch: 0.95, psi: -0.2, hh: 0.85, reach: 0.5, shift: -0.1, dip: 0.45, lean: 0.06, roll: 0, off: 0.7, edge: 0 },
    L1: { pitch: 1.0, psi: 0, hh: 0.85, reach: 0.95, shift: 1, dip: 0.6, lean: 0.2, roll: 0, off: 1, edge: 0 },
    F: { pitch: 1.0, hh: 0.8, reach: 0.85, shift: 0.9, dip: 0.55, lean: 0.18, roll: 0, off: 1, edge: 0 },
  },
};
// The one-handed swords' chain, after the owner's video (2026-10-07, a front view): numbers as for the sword in the
// left hand (sweep +1 from his left to his right), mirrored for the right as every template is.
// sw1, a flat forehand: drawn up upright beside the sword shoulder, the weight back; slashed level at chest height
// across the front, the chest turning with it; carried on to the far hip, the blade raised up on the far side.
TEMPLATES.sw1Posed = {
  lift: 0.75,
  drawOut: 0.3,
  tv: 0,
  C: { r: -0.4, pitch: 1.75, psi: -1.35, hh: 1.35, reach: 0.55, shift: -0.4, dip: 0.45, lean: -0.05, roll: -0.05, off: 0.5, edge: 0.5, twist: -0.25 },
  L0: { pitch: 0.0, psi: -0.7, hh: 0.98, reach: 0.92, shift: 0, dip: 0.3, lean: 0.03, roll: 0, off: 0.4, edge: 1, twist: 0 },
  L1: { pitch: -0.02, psi: 0.9, hh: 0.92, reach: 0.92, shift: 0.6, dip: 0.35, lean: 0.08, roll: 0.05, off: 0.9, edge: 1, twist: 0.45 },
  F: { pitch: 0.85, psi: 1.2, hh: 0.75, reach: 0.6, shift: 0.6, dip: 0.3, lean: 0.06, roll: 0.06, off: 1, edge: 0.6, twist: 0.6 },
};
// (sw1 as fitted frame by frame to the owner's video: anim/sword-tracks.js, .scratch/swingref/fit.mjs — the posed keys
// above were its first, hand-set try: "It is wrong. Follow it frame by frame". The fit keeps their body: the weight,
// the dip, and the chest wound back on the draw and turned round after the blade, as the video's man turns his back
// half to us on the follow)
// The three as tracks over the whole swing (follow 1: the recovery too, the video's man going from each cut on into the
// next; a lone cut let go of into the carry from `back` of its recovery on — the chop late, its own track coming home).
// (each played to its end on its own: the keyed combo's bake, 2026-10-08 — let go of from 0.45 of the recovery, a lone
// first or second cut dropped the whole baked body in 5 frames, the other hand flying off the grip at 115 u/s — the
// owner: "teleporting back after the first and second hit"; the third, played to its end, "looks fine")
for (const [name, back] of [["sw1", 1], ["sw2", 1], ["sw3", 1]]) { // (from 0.45 of the recovery: a press usually comes by 0.4, at the game's pace 0.12 s before the end — earlier, its switch back onto the track was felt; later, a lone cut came home in 0.08 s, the hand 164 u/s²)
  const tr = SWORD_TRACKS[`${name.toUpperCase()}_TRACK`];
  const vt = SWORD_TRACKS.SWORD_TIMES?.[Number(name.slice(2)) - 1]; // (the video's own wind, live and recovery: trackAt)
  const gv = SWORD_TRACKS.SWORD_GAME_WARP?.[Number(name.slice(2)) - 1]; // (and at the game's pace: trackAt)
  const c0 = SWORD_TRACKS.SWORD_STARTS?.[Number(name.slice(2)) - 1]; // (where in the video it starts: the baked body's clock)
  const freeLive = !!SWORD_TRACKS.SWORD_FREE_LIVE?.[Number(name.slice(2)) - 1]; // (its live window's yaw its own: trackAt)
  // (where the cut before ended on its clock, at the pace it is played now: the video's live end, its own end, its recovery)
  const i0 = Number(name.slice(2)) - 2;
  const prevEnd = i0 >= 0 ? () => {
    const pc = PLAYER.combo[i0], [pW, pA, pR] = SWORD_TRACKS.SWORD_TIMES[i0], pE = pW + pA + pR;
    const pg = SWORD_TRACKS.SWORD_GAME_WARP?.[i0];
    const same = Math.abs(pc.recover - pR) <= 0.03 * pR + 0.02; // (at the video's own tempo: its own clock)
    return same || !pg ? [pW + pA, pE, pc.recover] : [pg[2], pE, pc.recover];
  } : null;
  TEMPLATES[name] = tr ? fromTrack(tr, { follow: 1, back, vt, gv, freeLive, c0, prevEnd }) : TEMPLATES.sw1Posed; // (before a fit: the hand-set keys)
}
TEMPLATES.pairedFlat = TEMPLATES.flat;
/** The cut templates, read by the fitting tools (.scratch/swingref/fit.mjs). */
export { TEMPLATES };
/** A template replaced by a fitted track (the fitting tools; the game reads anim/sword-tracks.js). */
export function setTrack(name, track, extra = {}) {
  TEMPLATES[name] = fromTrack(track, { follow: TEMPLATES[name]?.follow, back: TEMPLATES[name]?.back, vt: TEMPLATES[name]?.vt, freeLive: TEMPLATES[name]?.freeLive, ...extra });
  specs = new WeakMap();
}
/** The cut plans made anew (the fitting tools, after changing a template). */
export function clearSpecs() {
  specs = new WeakMap();
}
TEMPLATES.pairedCross = TEMPLATES.fall;
/** The lateral channels a backhand turns the other way. */
const MIRRORED = ["psi", "roll", "twist"];
/** A cut's keys mirrored across the facing (a template made sweeping +1, for one sweeping −1). */
const mirrorKeys = (t) => ({ ...t, C: mirrorPose(t.C), L0: mirrorPose(t.L0), L1: mirrorPose(t.L1), F: mirrorPose(t.F), ...(t.track ? { track: t.track.map((q) => ({ ...mirrorPose(q), r: -q.r })) } : {}) });

/**
 * A template from a dense track of poses ([{ ph: "w" | "l" | "f", u, r, pitch, psi, hh, reach, … }]: the wind-up, the
 * live window and the follow-through, each by its own share `u`, so the shape keeps whatever the timing) — fitted frame by
 * frame to a reference (the owner's video of the one-handed sword, 2026-10-07: "follow it frame by frame"). C, L0, L1 and
 * F are its last wind-up key, the live window's ends and its last key, for what reads a template's keys. `r` is the yaw
 * from the facing as made sweeping +1 (the live window's own is the arc's, exactly: trackAt).
 */
export function fromTrack(track, extra = {}) {
  const last = (ph) => track.filter((q) => q.ph === ph).at(-1);
  const first = (ph) => track.find((q) => q.ph === ph);
  const pick = (q) => { const o = { ...q }; delete o.ph; delete o.u; return o; };
  return { lift: 0.6, tv: 0, ...extra, track, C: pick(last("w")), L0: pick(first("l")), L1: pick(last("l")), F: pick(last("f")) };
}
/** Monotone cubic (Fritsch–Carlson) through (ts, vs) at t: no overshoot between keys, flat at the ends. */
function pchipAt(ts, vs, t, open = false, m0 = null) {
  const n = ts.length;
  const slope = (j) => (vs[j + 1] - vs[j]) / Math.max(1e-9, ts[j + 1] - ts[j]);
  // (`open`: a clock, not a pose — carried on at its end segments' own rates, flat it slowed to a stop at both ends)
  if (t <= ts[0]) return open ? vs[0] + (t - ts[0]) * (m0 ?? slope(0)) : vs[0];
  if (t >= ts[n - 1]) return open ? vs[n - 1] + (t - ts[n - 1]) * slope(n - 2) : vs[n - 1];
  let i = 0;
  while (i < n - 2 && ts[i + 1] <= t) i++;
  const m = (j) => {
    if (j <= 0) return m0 ?? (open ? slope(0) : 0);
    if (j >= n - 1) return open ? slope(n - 2) : 0;
    const d0 = slope(j - 1), d1 = slope(j);
    if (d0 * d1 <= 0) return 0;
    const h0 = ts[j] - ts[j - 1], h1 = ts[j + 1] - ts[j];
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / d0 + w2 / d1);
  };
  const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h;
  const h00 = (1 + 2 * u) * (1 - u) ** 2, h10 = u * (1 - u) ** 2, h01 = u * u * (3 - 2 * u), h11 = u * u * (u - 1);
  return h00 * vs[i] + h10 * h * m(i) + h01 * vs[i + 1] + h11 * h * m(i + 1);
}
const TRACK_CH = ["r", "pitch", "psi", "hh", "reach", "shift", "dip", "lean", "roll", "twist", "off", "edge", "both", "ohf", "ohs", "ohu", "ohw"]; // (both: the off hand on the grip, 0…1; oh*: the free hand's place — forward, out to his off side and up, shares of his height — and its weight)
// The blend out of the stand into a fitted cut: the whole wind up to 0.12 s, longer for a long wind (a quarter of it, at
// most 0.3 s) — at the video's tempo the draw is 1.5 s, and 0.12 s of it jolted the blade tip (87) and the free hand
// (40) out of the stand; the game's pace (winds of ~0.15 s) is unchanged
const intoT = (tW) => Math.min(tW, Math.max(0.12, Math.min(0.25 * tW, 0.3)));
/** A tracked cut at time t (bladeAt): out of `start` into the track over its first stretch, the track, the arc's own yaw
 *  through the live window, and back into `to` (or the guard) after the follow-through, as a keyed one goes. */
function trackAt(key, t, start, to, face, buffered = false) {
  const { c, k, dir } = key;
  const fol = k.follow ?? FOLLOW;
  const tW = c.wind, tL = c.wind + c.active, tF = tL + fol * c.recover;
  let ts = k.track.map((q) => (q.ph === "w" ? q.u * tW : q.ph === "l" ? tW + q.u * c.active : tL + q.u * fol * c.recover));
  let warp = (tt) => tt;
  // A track with the video's own phase lengths (`vt`: wind, live, recovery in its seconds) is played on the video's
  // clock, the game's time carried onto it by one smooth curve through the phase ends: each phase sped up on its own
  // (the wind ×15 at the game's pace, the live window ×0.5), the blade's speed jumped 30× at the joins — the hand 547
  // u/s² at the live window. At the video's tempo the curve is the video's clock exactly.
  if (k.vt && fol >= 1) {
    const [vW, vA, vR] = k.vt;
    const vE = vW + vA + vR, tE = tL + c.recover;
    ts = k.track.map((q) => (q.ph === "w" ? q.u * vW : q.ph === "l" ? vW + q.u * vA : vW + vA + q.u * vR));
    const near = (g, v) => Math.abs(g - v) <= 0.03 * v + 0.02;
    let V = [0, vW, vW + vA, vE];
    if (!(near(tW, vW) && near(c.active, vA) && near(c.recover, vR))) {
      // At the game's own pace the video's cut is sped up about evenly (ρ, its length over the swing's): the game's
      // live window shows as much of the video about the whip as that pace takes in (the yaw still the sim's sweep),
      // the wind-up the stretch before it — a press starts that far into the video's slow draw (or the chop's long
      // high hold), blended in from where he was. (Phase by phase — the wind ×15, the live window ×0.5 — the hand
      // jerked 3-4 times as hard as the keyed swings had: 493 u/s² against 132; the chop raced through its hold.)
      // (the live window at most twice the video's own live stretch: at ρ the chop's showed 0.6 s of it, hold and all, its
      // tip 1080 u/s)
      const rho = vE / tE, mid = vW + vA / 2, span = Math.min(2 * vA, Math.max(vA, rho * c.active));
      const a0 = Math.max(0.02 * vE, mid - span / 2), a1 = Math.min(0.98 * vE, mid + span / 2);
      V = [Math.max(0, Math.min(a0 - 0.02, a0 - rho * tW)), a0, a1, vE];
      // (or as chosen for the least jerk of the tip at the game's own timing: .scratch/swingref/warpopt.mjs)
      if (k.gv) V = [k.gv[0], k.gv[1], k.gv[2], vE];
    }
    const G = [0, tW, tL, tE];
    // (a cut the last one ran on into starts at the pace that one's clock ended at, and speeds up from there: each at its
    // own, the video ran 4.5× faster from one frame to the next at the join of cuts 2 and 3, the hand jerked 240 u/s²)
    let m0 = null;
    if (start.flow && k.prevEnd) {
      const [pvA1, pvE, pRec] = k.prevEnd(), rate = (pvE - pvA1) / Math.max(1e-4, pRec);
      m0 = Math.min(rate, V[1] / Math.max(1e-4, tW) * 3); // (no faster than three times the wind's own mean pace)
    }
    warp = (tt) => pchipAt(G, V, tt, true, m0);
  }
  const atV = (tv) => {
    const o = {};
    for (const ch of TRACK_CH) {
      const vs = k.track.map((q) => q[ch]);
      if (vs.every(Number.isFinite)) o[ch] = pchipAt(ts, vs, tv);
    }
    return o;
  };
  const at = (tt) => atV(warp(tt));
  let pose, phase, aimW = 1;
  if (fol >= 1) {
    // A track over the whole swing, recovery and all (the video's man goes from each cut on into the next): with the
    // next press in, it is played to its end, which is where the next cut's own track begins; without, from `back`
    // of the recovery on it is let go of into `to` (the carry), so a lone cut still comes home. Out of the pose the
    // press found over at most 0.12 s (a quarter of the wind at the video's slow draw was 0.42 s, the track's own
    // draw-up lost under the carry for its first frames).
    // (a cut the last one ran on into: its own track from the first frame, the two tracks sharing the pose at the join —
    // blended out of the pose shown, which carries no body, the hips dropped 1.25 in a frame and the hand with them)
    // (and one that starts further on in the video than its first frame, out of the track's own first pose — the join
    // — over a little of the wind: from the pose shown, which carries no body, the hips would drop)
    const skip = warp(0) > 1e-3;
    pose = start.flow ? (skip ? mixPose(atV(0), at(t), smoothstep(0, Math.min(0.3 * tW, 0.1), t)) : at(t)) : mixPose(start, at(t), smoothstep(0, intoT(tW), t)); // (over the wind, at most 0.12 s at the game's pace: a quarter, two frames, jerked the hand 320 u/s²; 0.6 of it, out of the stand's low hand, 280 — intoT)
    phase = t < tW ? "wind" : t <= tL ? "live" : "recover";
    // (the sim's sweep, exactly — unless the track's own yaw was fitted to keep the tip on the hitbox (`freeLive`): the
    // chop's blade points near straight down through its sweep, and a yaw forced on it fought the video's, the blade
    // rising back 30° just before the live window and standing still in it)
    if (phase === "live" && !k.freeLive) pose.r = dir * (-c.arc / 2 + (c.arc * (t - tW)) / c.active);
    // The blade aimed out from his middle (hero3d.js aimTip, onto the hitbox) only about the live window, eased in
    // over the wind's last quarter and out over the recovery's first: held all through, it turned the high hold's blade
    // up off his head (65° on the screen where the video lays it back at 15-30°).
    aimW = t < tW ? smoothstep(0.75 * tW, tW, t) : t <= tL ? 1 : 1 - smoothstep(tL, tL + 0.25 * c.recover, t);
    // (`back` 1: the cut ends on its own track — the chop, whose video ends in his guard; the stand after it comes in
    // once the cut is over, hero3d.js)
    if (phase === "recover" && !buffered && (k.back ?? 0.3) < 1) {
      const u = Math.min(1, (t - tL) / Math.max(1e-4, c.recover));
      const w = smoothstep(k.back ?? 0.3, 1, u);
      if (w > 0) {
        const both = pose.both ?? 0, ohw = pose.ohw ?? 0;
        pose = mixPose(pose, to ?? GUARD, w);
        pose.both = both * (1 - w);
        pose.ohw = ohw * (1 - w);
        aimW *= 1 - w;
      }
    }
  } else if (t <= tF) {
    pose = mixPose(start, at(t), smoothstep(0, Math.max(ts[1] ?? 0, 0.25 * tW), t)); // (from the carry over a quarter of the wind: over the first key alone, 0.07 s, the hand jumped 220 u/s)
    phase = t < tW ? "wind" : t <= tL ? "live" : "follow";
    if (phase === "live") pose.r = dir * (-c.arc / 2 + (c.arc * (t - tW)) / c.active); // (the sim's sweep, exactly)
  } else {
    const u = Math.min(1, (t - tF) / Math.max(1e-4, c.recover * (1 - fol)));
    phase = "recover";
    aimW = 1 - smoothstep(0, 1, u);
    pose = mixPose(at(tF), to ?? GUARD, smoothstep(0, 1, u));
    pose.reach += RECOVER_OUT * Math.sin(Math.PI * u) ** 2;
  }
  pose.a = face + pose.r;
  pose.aimW = aimW;
  // (the edge's lead turned over from the last cut's through the first 60% of the wind-up: a forehand run on into a
  // backhand flipped it in a frame — the sword rolled half round in his fist, the hand jumping 176 u/s² at the join)
  const d0 = Number.isFinite(start.dir) ? start.dir : key.dir;
  pose.dir = d0 + (key.dir - d0) * smoothstep(0, 0.6 * tW, t);
  pose.tv = k.tv ?? 0;
  pose.phase = phase;
  pose.track = true;
  // (the video's own time here and how far the cut holds to it, for the baked whole-body pose: hero3d.js)
  if (k.c0 != null) {
    // (out of the last cut's track, a press further on in the video is reached over the same blend the pose takes —
    // jumped to, the body jumped with it; out of the stand the body fades in over it)
    const into = fol >= 1 ? smoothstep(0, start.flow ? Math.min(0.3 * tW, 0.1) : intoT(tW), t) : 1;
    pose.clipT = k.c0 + (start.flow && warp(0) > 1e-3 ? warp(t) * into : warp(t));
    pose.clipW = (start.flow ? 1 : into) * (aimW < 1 && phase === "recover" && !buffered && (k.back ?? 0.3) < 1 ? 1 - smoothstep(k.back ?? 0.3, 1, Math.min(1, (t - tL) / Math.max(1e-4, c.recover))) : 1);
  }
  return pose;
}
const mirrorPose = (q) => {
  const out = { ...q };
  for (const ch of MIRRORED) if (out[ch] != null) out[ch] = -out[ch];
  return out;
};

/**
 * A cut to pose: a combo step (the sword's three, as always) or a move ({ pose, sweep, wind, active, recover, arc,
 * fx, … }, with `next` the chain's next move for a buffered press). Kept per move, so its plans are made once.
 */
let specs = new WeakMap();
export function cutSpec(move) {
  if (typeof move === "number") {
    const step = Math.min(2, Math.max(0, move));
    // (the sword's three as made for the left hand, sweeping +1; mirrored for the right, FORE)
    return (specs.stepped ||= [0, 1, 2].map((i) => ({ id: `s${i}`, step: i, k: FORE > 0 ? CUTS[i] : mirrorKeys(CUTS[i]), c: PLAYER.combo[i], dir: FORE, next: null })))[step];
  }
  let got = specs.get(move);
  if (!got) {
    const t = TEMPLATES[move.pose === "keyed" ? `s${(move.step ?? 0) + 1}` : move.pose] || TEMPLATES.flat;
    // (its way round in the world, as the sim's arc has it: config.js sweepDir; the templates are made for +1)
    const dir = sweepDir(move);
    const k = dir > 0 ? t : mirrorKeys(t);
    got = { id: `m${specs.n = (specs.n || 0) + 1}`, step: move.step ?? -1, k, c: move, dir, next: null };
    specs.set(move, got);
  }
  if (move.next) got.next = cutSpec(move.next);
  return got;
}

/** The most another weapon's blade is raised to show in a live window (keyLift, viewLift's `k`). */
const LIVE_LIFT_CAP = 0.3;
/** The follow-through's share of the recovery; with a next cut buffered, how long it is held, and how far the sword then goes into the next cut's coil. */
export const FOLLOW = 0.35;
/** The most a follow-through carries the blade on past its arc's end, and the furthest round from the facing it goes (rad). */
// (0.5 and 1.8: at 0.8 and 2.3 a great club's shaft still went across his hips after its flat sweeps — 4.9% of its
// chain's frames, 1.3% now; the sword's own cuts never reach either)
export const FOLLOW_MAX = 0.5;
export const FOLLOW_TURN = 1.8;
export const HOLD = 0.36;
export const READY = 0.6;
/** The wind-up's draw-back never turns the blade faster than this share of the cut's own speed (windPlan). */
export const WIND_MAX = 0.92;

const lerp = (a, b, u) => a + (b - a) * u;
/** How much further out (a share of the arm) a sword's hand is carried across his front on the way back to the carry. */
const RECOVER_OUT = Number(globalThis.__recoverOut ?? 0.5);
const KIN_ANGLES = new Set(["th", "el", "ab", "inw", "fth", "fel", "fab", "finw"]);
const OH_PLACE = ["ohf", "ohs", "ohu"];
/** Channel by channel, `a` towards `b` by `u` (a new object). */
export function mixPose(a, b, u) {
  const out = {};
  // (a channel a key leaves out, or one that came out not a number, is the guard's: a NaN let through a blend
  // poisoned every spring and bone after it, for good)
  for (const c of CHANNELS) {
    const va = Number.isFinite(a[c]) ? a[c] : GUARD[c];
    // (the arm's own angles, weighed by `kin`/`fkin`, kept where they were when the other end has none: blended to the
    // guard's zeros as their weight faded, a cut's wind-up out of the carry bent the hand's path — a lurch the owner's
    // video at its own tempo showed)
    out[c] = lerp(va, Number.isFinite(b[c]) ? b[c] : KIN_ANGLES.has(c) ? va : GUARD[c], u);
  }
  // (the free hand's place from whichever end has it on: out of a pose without one — the stand — its zeros, the ground
  // under his feet, drew the hand down through his knees for the first frames of the cut; only its weight blends)
  const wa = Number.isFinite(a.ohw) ? a.ohw : 0, wb = Number.isFinite(b.ohw) ? b.ohw : 0;
  if (wa < 1e-3 || wb < 1e-3) for (const c of OH_PLACE) out[c] = (wa >= wb ? a : b)[c] ?? 0;
  return out;
}
/** Cubic Hermite from p0 (speed v0) to p1 (speed v1), speeds in units per whole segment. */
const hermite = (p0, p1, v0, v1, u) => {
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * v0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * v1;
};

/**
 * From pose `a` to pose `b` by `e` (the eased share; `u` the plain one). A long way round (from one
 * side of the body to the other) goes up and over, the blade raised as it turns, as a sword is
 * brought round — not swept back through the front, faster than a cut. Then, by `w`, turned to
 * show from the camera (viewLift) at the body's facing `face`.
 */
function travel(a, b, e, u, face = 0, w = 0, wHand = w) {
  const pose = mixPose(a, b, e);
  const far = smoothstep(1.2, 3, Math.abs(b.r - (a.r ?? 0)));
  if (far > 0) {
    const bump = Math.sin(Math.PI * u) ** 2 * far;
    // (up to it from where the blend has it: short of it by the higher end's rise, the way from a one-handed greatsword's
    // far-side follow-through over to his shoulder went by at 40°, its long grip's pommel slanting back into his belly)
    pose.pitch += bump * Math.max(0, 1.3 - pose.pitch);
    pose.hh += bump * 0.35;
  }
  return viewLift(pose, face, w, wHand);
}

/**
 * Where the camera is, as the blade sees it: the world yaw pointing straight away from it (the
 * view line, behind the body), and its height above the ground (radians).
 */
const AWAY = Math.atan2(-CAM_BACK[2], -CAM_BACK[0]);
const TOWARD = wrapAngle(AWAY + Math.PI);
const CAM_ELEV = Math.asin(CAM_BACK[1] / Math.hypot(...CAM_BACK));
/**
 * The rise a blade is given where it would not show (viewLift): the blade's rise and the hand's
 * height it goes up to; how wide round the view line pointing away (behind the body, hood and
 * cape) and pointing at the camera (seen end-on, a stub) it is given; and the sword hand, behind
 * the body, brought out to the side of it by up to `side` (radians of its bearing).
 */
export const SHOW_LIFT = Object.freeze({ pitch: 1.05, hh: 1.0, width: 1.5, toward: 0.55, rise: 0.45, side: 0.6, reach: 1, across: 1.2 });
/** How much the sword is turned to show on the way round for a next cut, between its two ends (which are turned in full). */
const MID_LIFT = 0.6;
/** How much the guard a cut recovers to is turned to show. */
const REST_LIFT = 0.7;
/** How much further out the hand goes in the coil and after the follow-through than in the live window (viewLift's `wHand`). */
const COIL_OUT = 2.5;
const cosWin = (x) => (x >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x));

/**
 * A pose (r, psi from the body's facing `face`; changed in place and returned) turned to show from
 * the camera. The review: between cuts the blade vanished for up to 13 frames wherever it pointed
 * straight away from the camera (behind the hood and cape: at 225°, seen from behind, and as much
 * at 90–135° and 270–300°, the blade out at the side pointing up the screen), or straight at it (a
 * stub). It was fixed at 225° alone, by the yaw from the facing; this goes by the yaw from the
 * camera, so it holds at every facing.
 *
 *   w      near the view line the blade goes up over the hood and the hand to the shoulder, the
 *          more the nearer (a wide cosine round it, so turning past it adds little to the blade's
 *          speed); pointing at the camera at about its own height, the blade rises out of the line
 *          of sight
 *   wHand  a hand behind the body from the camera goes out to its side, the arm stretched (more
 *          than 1: further out)
 *   fixed  a rise given whatever the yaw: a live window's end's, worked out for the swing (keyLift)
 *
 * bladeAt uses it so the blade never has to move faster for it: pointwise only where the blade
 * slows (the follow-through) or not at all (the hand, the fixed rise); elsewhere at the ends of a
 * move, the move itself carrying the change.
 */
export function viewLift(pose, face, w, wHand = w, fixed = 0) {
  let k = fixed;
  if (w > 0) {
    const a = face + pose.r;
    const away = cosWin(Math.abs(wrapAngle(a - AWAY)) / SHOW_LIFT.width);
    const toward = cosWin(Math.abs(wrapAngle(a - TOWARD)) / SHOW_LIFT.toward) * cosWin(Math.abs(pose.pitch - CAM_ELEV) / SHOW_LIFT.rise);
    k += (1 - fixed) * w * Math.max(away, toward);
  }
  if (k > 0) {
    pose.pitch += k * Math.max(0, SHOW_LIFT.pitch - pose.pitch);
    pose.hh += k * Math.max(0, SHOW_LIFT.hh - pose.hh);
  }
  if (wHand > 0) {
    // The hand, if it is behind the body from the camera, out to the side it is already on (none
    // straight behind, where either side would do: it moves smoothly through), the arm stretched
    // so the hand is out past the body's edge.
    const x = wrapAngle(face + pose.psi - AWAY) / SHOW_LIFT.width;
    if (Math.abs(x) < 1) {
      // (Never further round the far side than the sword arm reaches: bladeShows' shoulder.)
      const f = -SWORD_SIDE; // across the body, from the sword side
      const across = f * wHand * SHOW_LIFT.side * Math.sin(Math.PI * x);
      pose.psi += f * (across <= 0 ? across : Math.min(across, Math.max(0, SHOW_LIFT.across - f * pose.psi)));
      pose.reach += Math.min(1, wHand) * cosWin(Math.abs(x)) * Math.max(0, SHOW_LIFT.reach - pose.reach);
    }
  }
  return pose;
}

/**
 * A cut sweeping past the line to the camera (the review: swing2 at the default facing, 0°, its
 * rising blade pointing straight at the camera mid-sweep, a stub at the shoulder, readable only
 * through the trail): where the blade's yaw nears the camera's, its rise is pushed away from the
 * camera's own elevation, to `clear` at least, on the side the sweep passes it (`sign`, fixed for
 * the swing: +1 over, −1 under), within `width` of the line. The yaw stays the sim's. `amount`
 * eases it in and out (the release, the follow-through).
 */
const TOWARD_PUSH = Object.freeze({ width: 1.2, clear: 0.5 });
/** The heavy's fall through its live window: faster and faster (its rise and the hand's height, as a share of the way down). */
const fall = (u) => u ** 1.6;
function towardPush(pose, face, sign, amount = 1) {
  if (!sign || amount <= 0) return pose;
  const w = cosWin(Math.abs(wrapAngle(face + pose.r - TOWARD)) / TOWARD_PUSH.width) * amount;
  const short = TOWARD_PUSH.clear - sign * (pose.pitch - CAM_ELEV);
  if (w > 0 && short > 0) pose.pitch += sign * short * w;
  return pose;
}
/** Which side of the camera's line of sight a cut's sweep passes (towardPush), at facing `face`. */
function towardSide(key, face) {
  const { k, L0, L1 } = key;
  const half = key.c.arc / 2;
  const u = Math.min(1, Math.max(0, (key.dir * wrapAngle(TOWARD - face) + half) / key.c.arc));
  // (The heavy's rise as its live window has it: falling faster and faster, over the hood first.)
  const pitch = k.late ? lerp(L0.pitch, L1.pitch, fall(u)) + (k.arch?.pitch ?? 0) * 45.5625 * u * u * (1 - u) ** 4 : mixPose(L0, L1, u).pitch;
  return pitch >= CAM_ELEV ? 1 : -1;
}

/** The follow-through's easing: leaving at `n`× its average speed (the live speed), slowing to a stop. */
const followEase = (u, n) => 1 - (1 - u) ** n;
/** The share of the blade that must show at a live window's ends (keyLift). */
const SHOW_MIN = 0.3;
/**
 * How far (viewLift's `w`, 0..1) a live window's end must be turned for SHOW_MIN of its blade to
 * show at facing `face`: none where it shows already, as little as it takes elsewhere. The cut's
 * yaw is the sim's, so where it starts or ends pointing straight away from the camera the blade
 * can only show by rising over the hood (swing2 drawn back low at the left hip, seen from 270–300°,
 * vanished through its whole wind-up). A key, so it is fixed for the swing: no pop from frame to frame.
 */
function keyLift(key, face, hand = 1, view = 0) {
  const shows = (w) => bladeShows(viewLift({ ...key }, face, view, hand, w), face);
  if (shows(0) >= SHOW_MIN) return 0;
  if (shows(1) < SHOW_MIN) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (shows(mid) >= SHOW_MIN) hi = mid;
    else lo = mid;
  }
  return hi;
}
/** The lifts for a cut's live window's ends at a facing (keyLift): the heavy's slam stays on the ground. */
const liveLifts = new Map();
function liveLiftsFor(key, face) {
  const id = `${key.id}:${face}`;
  let got = liveLifts.get(id);
  if (!got) {
    if (liveLifts.size > 96) liveLifts.clear();
    // The end's lift covers the start of the follow-through too (where the window lift, eased in,
    // is still small): a cut whose follow-through heads straight away from the camera ends raised.
    // (Each as shown: past the camera's line of sight, towardPush — lifted from the pose as it
    // came, a blade pointing at the camera from under its line would be raised through it.)
    const side = towardSide(key, face);
    let k1 = 0;
    if (!key.k.late) for (const u of [0, 0.2, 0.4, 0.6]) k1 = Math.max(k1, keyLift(towardPush(mixPose(key.L1, key.F, followEase(u, key.n)), face, side), face));
    // The start's covers the coil it is released from (as designed, and halfway to the arc's
    // start), so the release does not have to lift or drop the blade.
    let k0 = keyLift(towardPush({ ...key.L0 }, face, side), face);
    for (const f of [1, 0.5]) k0 = Math.max(k0, keyLift(mixPose(key.L0, key.C, f), face, COIL_OUT));
    // The follow-through's end, where the sword is held for a next cut or from where it goes back
    // to the guard: turned to show (viewLift). The heavy's is not turned: it stays driven into the
    // ground, levered round to show by heavyEnd (drawn up over the hood at its yaw, out at his
    // right, it passed behind the cape on the way), and is raised only as far as it takes to show
    // where that is not enough.
    const wF = key.k.late ? 0 : 1;
    const kF = key.k.late ? keyLift(key.F, face, COIL_OUT, wF) : 0;
    got = { k0, k1, kF, wF };
    liveLifts.set(id, got);
  }
  return got;
}

/**
 * Where the heavy's blade meets the ground at facing `face`: the sword hand's bearing and height at
 * the live window's end (`L1` the designed end, its yaw the arc's) and the rise that puts the tip in
 * the grass from there (groundPitch). As designed — the hand low out at his right, the blade
 * slanting down out along the arc's end — wherever that shows from the camera. Seen from behind
 * (the target image's 180°) that end lies beyond the body, behind the cape, and the left hand cannot
 * reach out past it: there the hand stays on the sword side, higher, and the blade is driven down
 * steeply into the ground beside him, still on the arc's yaw (the review: its descent and ground
 * contact hidden behind the cape, the tip stopping 4–5 units above the grass). Pure; kept per facing.
 */
const HEAVY_END = Object.freeze({ show: 0.45, psi: [-1.4, 1.5], hh: [-0.5, 0.9], psiCost: 0.05, hhCost: 0.08, follow: 0, steep: 1.32, margin: 0.15, square: -0.3, lever: 1.6, leverCost: 0.06, widen: 1, outReach: 0.3, stopCost: 0.2, leverAim: 0.6 });
const heavyEnds = new Map();
/** The heavy's ground poses for a hand at `psi`, `hh`: the impact (from `L1`) and the bite's end (from `F`), each tip in the grass. */
function heavyGround(L1, F, psi, hh, face, fr = F.r, hand = COIL_OUT) {
  // The torso turns into the cleave as far as the hand goes out to his right (a hand kept on the
  // sword side keeps the chest square: turned, it would carry the hand round in front).
  const turn = Math.min(1, Math.max(0, (psi - FORE * HEAVY_END.square) / (L1.psi - FORE * HEAVY_END.square)));
  // As the live window will show them: the hand out past the body wherever it would be behind it.
  // (...and reaches out further, the arm straight, so the blade lands clear of the body.)
  const out = (1 - turn) * HEAVY_END.outReach;
  // (a key without a twist has none: every weapon's template, and the sword's own cuts — NaN here spread through the
  // body for good, the hero's torso and arms vanishing after the first heavy slam with a weapon's chain)
  const q = viewLift({ ...L1, psi, hh, twist: (L1.twist ?? 0) * turn, reach: L1.reach + out }, face, 0, 1);
  q.pitch = groundPitch(q, face);
  // (The bite sinks the hand as designed out at his right; kept on the sword side, driven down
  // steeply, it holds it where it is, the blade as steep.)
  const f = viewLift({ ...F, r: fr, psi: psi + FORE * HEAVY_END.follow, hh: hh + (F.hh - L1.hh) * turn, twist: (F.twist ?? 0) * turn, reach: F.reach + (L1.reach - F.reach) * (1 - turn) + out }, face, 0, hand);
  f.pitch = groundPitch(f, face);
  return [q, f, out, turn];
}
/** Its share on screen, with a margin: a drawn arm puts the hand up to a twentieth of his height nearer his middle than handAt's (the painted hero and the mannequin, measured), and a blade just clear of the cape would go behind it — the mean of the two. */
const showsSure = (x, face) => 0.5 * (bladeShows(x, face, HEAVY_END.widen) + bladeShows({ ...x, reach: x.reach - HEAVY_END.margin }, face, HEAVY_END.widen));
function heavyEnd(L1, F, face) {
  const id = `${face}`;
  let got = heavyEnds.get(id);
  if (got) return got;
  if (heavyEnds.size > 96) heavyEnds.clear();
  // (the search as made for the left hand, mirrored for the right: FORE)
  const [p0, p1] = FORE > 0 ? HEAVY_END.psi : [-HEAVY_END.psi[1], -HEAVY_END.psi[0]];
  const [h0, h1] = HEAVY_END.hh;
  for (let i = 0; i <= 29; i++) {
    const psi = p0 + ((p1 - p0) * i) / 29;
    for (let j = 0; j <= 14; j++) {
      const hh = h0 + ((h1 - h0) * j) / 14;
      // The impact must show: the slam is seen landing.
      const [q, , out, turn] = heavyGround(L1, F, psi, hh, face);
      // (Never straight down, where the blade would have no yaw left to follow the arc with.)
      if (q.pitch < -HEAVY_END.steep) continue;
      // (Showing comes first, up to `show`; then as near the design as it can be.) As it lands, and
      // as it is carried on into the ground past the arc's end: all the way, as designed, or
      // stopped sooner where that would take it behind him.
      const land = showsSure(q, face);
      for (let s = 0; s <= 3; s++) {
        const stop = F.r - ((F.r - L1.r) * 0.95 * s) / 3;
        const bite = heavyGround(L1, F, psi, hh, face, stop, 1)[1];
        if (bite.pitch < -HEAVY_END.steep) continue;
        const show = Math.min(land, showsSure(bite, face));
        const score = 10 * Math.min(HEAVY_END.show, show) - HEAVY_END.psiCost * Math.abs(psi - L1.psi) - HEAVY_END.hhCost * Math.abs(hh - L1.hh) - (HEAVY_END.stopCost * s) / 3;
        if (!got || score > got.score) got = { score, psi, hh, pitch: q.pitch, twist: q.twist, out, stop, turn };
      }
    }
  }
  // Then the bite: the hilt levered round, the tip still in the grass, as far back from the arc's
  // end towards the sword side as it takes to show (the slam's yaw is only the sim's through the
  // live window; after it, driven on out at his right seen from behind, it went behind the cape).
  const turn = got.turn;
  let best = null;
  for (let i = 0; i <= 16; i++) {
    const fr = got.stop - (FORE * HEAVY_END.lever * i) / 16;
    const [, f] = heavyGround(L1, F, got.psi, got.hh, face, fr);
    if (f.pitch < -HEAVY_END.steep) continue;
    // (Kept on the sword side, it is levered well round, towards the next cut's coil there; out at
    // his right as designed, only as far as it takes to show.)
    const aim = turn >= 1 ? got.stop : L1.r - FORE * HEAVY_END.leverAim;
    const score = 10 * Math.min(HEAVY_END.show, showsSure(f, face)) - HEAVY_END.leverCost * Math.abs(fr - aim);
    if (!best || score > best.score) best = { score, r: fr, pitch: f.pitch };
  }
  const r = best ? best.r : got.stop;
  const pitch = best ? best.pitch : got.pitch;
  got.F = { r, pitch, psi: got.psi + FORE * HEAVY_END.follow, hh: got.hh + (F.hh - L1.hh) * turn, twist: (F.twist ?? 0) * turn, reach: F.reach + (L1.reach - F.reach) * (1 - turn) + got.out };
  got.reach = L1.reach + got.out;
  heavyEnds.set(id, got);
  return got;
}

/** A cut's four keys with their yaw filled in from the arc, and the live speeds (the heavy's end for facing `face`: heavyEnd). */
function keysOf(step, face = null) {
  const sp = typeof step === "object" && step.k ? step : cutSpec(step);
  const { c, k, dir } = sp;
  const half = c.arc / 2;
  const v = c.arc / c.active; // the live yaw speed, rad/s (its size: `dir` is which way)
  const L0 = { ...k.L0, r: -half * dir };
  const L1 = { ...k.L1, r: half * dir };
  // The follow-through leaves at the live speed and slows to a stop (1 − (1 − u)ⁿ starts at n×;
  // the heavy's blade bites into the ground and stops sooner, and stays in it: heavyEnd).
  const tf = (k.follow ?? FOLLOW) * c.recover;
  const n = k.bite ?? 3;
  // (carried on at most FOLLOW_MAX past the arc's end, and never round past FOLLOW_TURN from the facing: a colossal
  // sword's long recovery at its live speed carried the slab 80° on, 165° round, wrapped about his body)
  let Fr = dir * Math.min(half + Math.min((v * tf) / n, FOLLOW_MAX), Math.max(half, FOLLOW_TURN));
  let Fe = null;
  if (k.late && face != null) {
    const e = heavyEnd(L1, { ...k.F, r: Fr }, face);
    Object.assign(L1, { psi: e.psi, hh: e.hh, pitch: e.pitch, twist: e.twist, reach: e.reach });
    Fe = e.F;
    Fr = e.stop; // (where the blade stops in the ground, levered round from there to F.r)
  }
  const pv = (L1.psi - L0.psi) / c.active;
  const F = { ...k.F, r: Fr, psi: L1.psi + FORE * Math.min(0.6, (FORE * pv * tf) / n), ...Fe };
  const C = { ...k.C, r: dir * (-half + k.C.r) };
  // (a straight thrust or bash points along the facing all through: the sim's thrust is a line, not an arc)
  if (k.straight) {
    for (const q of [C, L0, L1]) q.r = 0;
    Fr = 0;
  }
  return { id: sp.id, sp, dir, c, k, C, L0, L1, F: k.straight ? { ...F, r: 0 } : F, v, pv, n, Fr };
}

/** The draw-back's easing: out of the start briskly, settling into the coil (anticipation). */
const drawEase = (u) => 1 - (1 - u) * (1 - u) * (1 + 1.25 * u);
/** A pose's blade direction (a unit vector, the yaw from the facing). */
const dirOf = (q) => {
  const cp = Math.cos(q.pitch);
  return [Math.cos(q.r) * cp, Math.sin(q.pitch), Math.sin(q.r) * cp];
};
const angleBetween = (x, y) => Math.acos(Math.max(-1, Math.min(1, x[0] * y[0] + x[1] * y[1] + x[2] * y[2])));

/**
 * The wind-up's plan out of `start` for a cut's keys: `T2` the release's time, `C` the coil. As
 * designed (the release `1 − lift` of the wind-up, the coil C) when the draw-back fits; else, the
 * further the blade has to come back (a carry turned out ahead, a chained cut's hold), the shorter
 * the release and the shallower the coil (it still accelerates onto the arc's start at the live
 * speed), until the draw-back's peak turning speed — the blade's direction, yaw and rise together —
 * is at most WIND_MAX of the cut's own. Pure; kept per start (a cut's start is fixed).
 */
function windPlan(start, key, face) {
  const { c, k, C, L0, v } = key;
  const W = c.wind;
  const T2n = (1 - k.lift) * W;
  const depth = key.dir * (L0.r - C.r); // the coil's depth past the arc's start, as designed
  const { k0 } = liveLiftsFor(key, face);
  const at = (T2) => {
    // The release goes from rest onto the live speed: a coil between a third and two thirds of
    // v·T2 behind the arc's start keeps its speed rising all the way (a Hermite, 0 to v). A shorter
    // release starts from a coil that much nearer the arc's start in every channel (the blade's
    // rise too), so it never turns the blade faster than the designed one.
    const f = T2 / T2n;
    const D = Math.min(Math.max(depth * f, (v * T2) / 3), (2 * v * T2) / 3);
    const coil = mixPose(L0, C, f);
    coil.r = L0.r - key.dir * D;
    // The sword hand out past the body where it would be behind it, drawn back further out to the
    // side than in the live window; the blade raised as far as the arc's start is (keyLift), so the
    // release does not have to lift it.
    viewLift(coil, face, 0, COIL_OUT, k0);
    // The draw-back's peak turning speed (the blade's direction, 12 steps through it).
    let peak = 0;
    let prev = dirOf(travel(start, coil, 0, 0));
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      const d = dirOf(travel(start, coil, drawEase(u), u));
      peak = Math.max(peak, (angleBetween(prev, d) * 12) / (W - T2));
      prev = d;
    }
    return { T2, C: coil, peak };
  };
  let plan = at(T2n);
  if (plan.peak <= WIND_MAX * v) return plan;
  // Shorter releases only lower the peak (a shallower coil, a longer draw-back): the longest that fits.
  let lo = 0.12 * W;
  let hi = T2n;
  plan = at(lo);
  if (plan.peak > WIND_MAX * v) return plan;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const p = at(mid);
    if (p.peak <= WIND_MAX * v) (lo = mid), (plan = p);
    else hi = mid;
  }
  return plan;
}
const guardPlans = new Map();
const startPlans = new WeakMap();
function planFor(start, key, face) {
  let list = start === GUARD ? guardPlans.get(face) : startPlans.get(start);
  if (!list) {
    list = {};
    if (start !== GUARD) startPlans.set(start, list);
    else {
      if (guardPlans.size > 64) guardPlans.clear();
      guardPlans.set(face, list);
    }
  }
  const got = list[key.id];
  if (got && got.face === face) return got;
  return (list[key.id] = { ...windPlan(start, key, face), face });
}

/**
 * The cut at swing time `t` (seconds since the swing began) of combo step `step`, facing `face`
 * (the sim's, world radians). `buffered`: a next swing is buffered (hold the follow-through).
 * `from`: the pose the swing starts from (the last one shown, its r and psi from this `face`), else
 * the guard; pass the same object every frame of a swing (its wind-up plan is kept with it).
 * Returns the pose, plus `a` (the blade's world yaw), `phase` and `heavy`.
 */
export function bladeAt(step, t, face, buffered = false, from = null, to = null) {
  const key = keysOf(step, face);
  const { c, k, L0, L1, F, v, pv } = key;
  const start = from || GUARD;
  if (k.track) return trackAt(key, t, start, to, face, buffered);
  const { k0, k1, kF, wF } = liveLiftsFor(key, face);
  const side = towardSide(key, face);
  let pose;
  let aimW = 1;
  let phase;
  if (t < c.wind) {
    phase = "wind";
    const { T2, C } = planFor(start, key, face);
    const t1 = c.wind - T2;
    if (t < t1) {
      // The draw-back: out of the start briskly, settling into the coil (anticipation).
      const u = Math.max(0, t) / t1;
      pose = travel(start, C, drawEase(u), u);
      // (`drawOut`: the hand carried that much further out on the way up — the sword's, lifted out of the hanging carry,
      // brought its pommel 0.47 into his hip at some facings)
      if (k.drawOut) pose.reach += k.drawOut * Math.sin(Math.PI * u) ** 2;
    } else {
      // The release: from the coil, accelerating, onto the arc's start at the live speed (the
      // hand where the live window has it: out past the body if it would be behind it).
      const u = (t - t1) / T2;
      const to = viewLift(towardPush({ ...L0 }, face, side), face, 0, 1, k0);
      pose = mixPose(C, to, smoothstep(0, 1, u));
      pose.r = hermite(C.r, to.r, 0, key.dir * (k.straight ? 0 : v) * T2, u);
      pose.psi = hermite(C.psi, to.psi, 0, pv * T2, u);
    }
  } else if (t <= c.wind + c.active) {
    // Live: straight through, as swingArc (no easing: a cut snaps).
    phase = "live";
    const u = (t - c.wind) / c.active;
    pose = mixPose(L0, L1, u);
    pose.r = k.straight ? 0 : key.dir * (-c.arc / 2 + c.arc * u);
    if (k.drop) {
      // An overhead chops down faster and faster; a great weapon's lands on the ground (its `ground`).
      pose.pitch = lerp(L0.pitch, L1.pitch, fall(u));
      pose.hh = lerp(L0.hh, L1.hh, fall(u));
      if (c.ground) pose.ground = smoothstep(0.5, 1, u);
    }
    if (k.late) {
      // The heavy chops down faster and faster (the rise and the hand's height; the yaw is the sim's).
      pose.pitch = lerp(L0.pitch, L1.pitch, fall(u));
      pose.hh = lerp(L0.hh, L1.hh, fall(u));
      // Onto the ground by the window's end: the drawn hand's own height sets the last of the
      // blade's fall (applyArms), so the tip meets the grass whatever the figure.
      pose.ground = smoothstep(0.5, 1, u);
    }
    if (k.arch) {
      // ...and goes up over the hood first: a lift peaking a third of the way across, eased in from
      // the release (no kick at the live window's start).
      const b = 45.5625 * u * u * (1 - u) ** 4;
      pose.pitch += k.arch.pitch * b;
      pose.hh += k.arch.hh * b;
    }
    // The yaw is the sim's. Where an end would not show from the camera the blade is raised there
    // as far as it takes (keyLift), eased across the window; the hand comes out past the body
    // wherever it would be behind it; pointing at the camera, the blade passes over or under it.
    const s = smoothstep(0, 1, u);
    // (another weapon's lift is kept small in the live window: raised to show, a long blade's tip comes in toward him —
    // the colossal sword's finisher lost half its reach — and its own length shows it)
    const cap = typeof step === "number" ? 1 : LIVE_LIFT_CAP;
    viewLift(towardPush(pose, face, side), face, 0, 1, Math.min(cap, k0 * (1 - s) + k1 * s));
  } else {
    const rr = Math.min(1, (t - c.wind - c.active) / Math.max(0.01, c.recover));
    // After the live window the sword is turned to show from the camera (viewLift), eased in
    // through the follow-through as the blade slows, and eased out again into the rest. The
    // follow-through's end as it is held: turned to show, raised as far again as it takes (kF).
    const fol = k.follow ?? FOLLOW;
    const hold = fol + (HOLD - FOLLOW);
    const held = () => viewLift(towardPush({ ...F }, face, side), face, wF, COIL_OUT, kF);
    if (rr <= fol) {
      phase = "follow";
      const u = rr / fol;
      // (The heavy's blade stops sooner, in the ground, and bites there a moment before the lift.)
      const s = smoothstep(k.bitten ?? 0, k.rise ?? 1, u);
      // (only the yaw — and the hand's bearing with it — leaves at the live speed; the rise, the height, the reach and
      // the body ease in from the live window's own still values: eased like the yaw, the blade's rise jumped from
      // nothing to 11 rad/s in a frame, a kick at the slash's end the owner's video at its own tempo showed)
      const fe = followEase(u, key.n);
      const base = mixPose(L1, F, smoothstep(0, 1, u));
      base.r = L1.r + (F.r - L1.r) * fe;
      base.psi = L1.psi + (F.psi - L1.psi) * fe;
      // (The heavy's yaw: carried on past the arc's end until it stops in the ground, then levered
      // back round as it bites, as far as heavyEnd turned the held pose to show.)
      if (k.late) base.r = L1.r + (key.Fr - L1.r) * followEase(u, key.n) + (F.r - key.Fr) * smoothstep(k.bitten ?? 0, 1, u);
      // (Past the camera's line of sight as the live window left it, as long as it points at it.)
      pose = viewLift(towardPush(base, face, side), face, s * wF, 1 + (COIL_OUT - 1) * s, k1 * (1 - s) + kF * s);
      // (The heavy's tip stays in the grass while the blade bites, then comes up out of it.)
      pose.ground = k.late || (k.drop && c.ground) ? 1 - s : 0;
    } else if (buffered) {
      // A next cut is coming: never back to the guard (2D's rule: never flash the resting pose).
      // The follow-through is held a moment, then the sword goes round, over the top, part of the
      // way into the next cut's coil; the next wind-up's plan brings it the rest of the way.
      // (Turned to show at both ends and moved between them: turned on the way, by the blade's
      // yaw as it goes, the turn would add to its speed, and it already goes round at about the
      // cut's own.)
      if (rr <= hold) {
        phase = "follow";
        pose = held();
      } else {
        phase = "ready";
        const u = (rr - hold) / (1 - hold);
        const nextKey = key.sp.next ? keysOf(key.sp.next) : keysOf(typeof step === "number" ? (step + 1) % PLAYER.combo.length : key.sp);
        const to = viewLift(mixPose(F, nextKey.C, READY), face, 1);
        pose = travel(held(), to, smoothstep(0, 1, u), u, face, (k.midLift ?? MID_LIFT) * Math.sin(Math.PI * u) ** 2);
      }
    } else {
      // Back to the guard (turned to show as well, less: the way back is already about as fast as
      // the cut), where the carry takes it over.
      phase = "recover";
      // (into the weapon's own carry when it has one, `to`, the hero's frame: a great weapon recovering through the
      // sword's guard at his hip dragged its pommel through his belly on the way up to his shoulder)
      // (into a carry, round the outside and over the top as a next cut's coil is reached: travel — blended straight, a
      // colossal sword's blade swept through his chest and its guard past his hood on the way to his shoulder)
      const u = (rr - fol) / (1 - fol);
      // (`to.direct`: a weapon without a carry of its own, back to the carry as the press found it, straight, as into
      // the guard — round the outside and over the top, the way great weapons go back onto the shoulder, the blade
      // humped up and dropped)
      // (the tip's aim onto the hitbox — hero3d.js aimTip — let go of over the way back: kept, it swung the blade as
      // the hand crossed the body)
      aimW = 1 - smoothstep(0, 1, u);
      // (`to.direct` held a little further out on the way across his front, RECOVER_OUT at its middle: blended straight,
      // the pommel went 0.58 into his belly and only the body's avoidance kept it out, a jitter at the video's tempo)
      if (to?.direct) {
        pose = mixPose(held(), to, smoothstep(0, 1, u));
        pose.reach += RECOVER_OUT * Math.sin(Math.PI * u) ** 2;
      } else pose = to ? travel(held(), { ...to }, smoothstep(0, 1, u), u, face, (k.midLift ?? MID_LIFT) * Math.sin(Math.PI * u) ** 2) : mixPose(held(), viewLift({ ...GUARD }, face, REST_LIFT), smoothstep(0, 1, u));
    }
  }
  pose.a = face + pose.r;
  pose.aimW = aimW;
  pose.dir = k.drop || k.straight ? 0 : key.dir; // (an overhead chop leads with its edge straight down, a thrust with its point)
  pose.phase = phase;
  pose.heavy = c.fx === "heavy";
  pose.tv = k.tv;
  return pose;
}

/**
 * How much of the carry (turned to show, carryPose) is kept over a keyed swing (the painted hero
 * plays its own swing1–3, hero3d.js keyedCuts), at swing time `t` of combo step `step`. A keyed
 * swing starts and ends in the guard, the same whatever the facing — at 45° (facing the camera) its
 * blade points straight at it, and the heavy's recovery settled into that stub for nine frames. So
 * the carry fades out over the first half of the wind-up from `from` (how much of it was on when
 * the swing began) and back in from the follow-through's end (keyedFollowT) over the first
 * KEYED_BACK_IN of the way back into the guard, whether or not a next swing is buffered: the clip's
 * own way back is the same at every facing, the carry is turned to show, so the sword never passes
 * along the camera's line of sight or behind the body on the way (the clip's recovery once went
 * 'over the top' for that, and parked the blade upright in front of his face: the third review).
 * (A buffered next swing once kept the carry off and held the clip's follow-through to the end of
 * the recovery: at the default facing swing2's lay across his chest, a thin line on the armour, for
 * ten frames while the heavy was buffered — the fourth review. The picker still holds the body's
 * follow-through then, hero-anim3d.js; the sword arm is back in the carry.) Never in the live
 * window: there the clip's blade is the hitbox's.
 */
export function keyedCarryW(step, t, from = 1) {
  const c = PLAYER.combo[step] || PLAYER.combo[0];
  const end = c.wind + c.active + c.recover;
  const out = from * (1 - smoothstep(0, 0.5 * c.wind, t));
  const tf = keyedFollowT(step);
  const back = smoothstep(tf, tf + KEYED_BACK_IN * (end - tf), t);
  return Math.max(out, back);
}

/**
 * The keyed swings' follow-through ends (tools/3d/blender/hero_clips.py FOLLOW, which tools/test.mjs
 * checks against this), a share of the recovery in clip time: swing1 and swing2 carried on out at his
 * right, the heavy stopped short, biting into the ground.
 */
export const KEYED_FOLLOW = Object.freeze([0.35, 0.35, 0.18]);
/**
 * The share of the way back (from the follow-through's end to the swing's) over which the carry comes
 * back in (keyedCarryW): quick, since half-way between the clip's pose and the carry the blade can lie
 * behind the body (0.6 and up left swing1's blade under 15% for 3 frames at 270-293°, the 16-facing check's
 * limit is 2), but not so quick that it snaps: at 0.3 (with the arm IK blending only its goal) the sword
 * elbow went 1→24→79→57→31° in four frames and the blade turned up to 110-172°/frame; at 0.5, with the
 * IK blending its joints' rotations (ik.js), 40-56°/frame.
 */
export const KEYED_BACK_IN = 0.5;
/**
 * How far the carry is raised (viewLift's `fixed`, towards SHOW_LIFT's rise) while it comes back in
 * over a keyed swing's follow-through, from carry weight `w` (keyedCarryW) at swing time `t`: a
 * per-bone blend from the clip's pose (the heavy's blade down in the grass) to the carry swings the
 * blade forward and down on the way, along the camera's line of sight from behind and his left — the
 * verifier's stub at 247.5°, 0.354 s (show 0.15, 236°–281° each one frame under 15%). Raised the
 * blade lifts out of the ground first: fully until the carry is half on, then less, none once it is
 * wholly on (the carry itself is untouched), never before the follow-through's end (never in the live
 * window, where the clip's blade is the hitbox's). The heavy's only: swing1 and swing2 end with the
 * blade already raised, and lifting theirs left one frame under 15% at 135° and 315°. And only with
 * his back to the camera (body facing `faceWorld` within KEYED_LIFT_SPAN.full of straight away, none
 * past .none): from in front the bite reads as it is, the blade levered out of the grass like the 2D
 * slam, and lifting it early turned it at the camera.
 */
const KEYED_LIFT_SPAN = Object.freeze({ full: (70 * Math.PI) / 180, none: (110 * Math.PI) / 180 });
export function keyedBackLift(step, t, w, faceWorld) {
  if (step !== 2 || t <= keyedFollowT(step) || w <= 0 || w >= 1) return 0;
  const off = Math.abs(wrapAngle(faceWorld - AWAY));
  const seen = 1 - smoothstep(KEYED_LIFT_SPAN.full, KEYED_LIFT_SPAN.none, off);
  return seen * Math.min(1, 2 * (1 - w));
}
/**
 * The sim's swing time at which a keyed swing's clip reaches its follow-through's end: the picker
 * eases the recovery onto the clip (hero-anim3d.js, 1 − (1 − u)² of it), so the clip gets there at
 * u = 1 − √(1 − KEYED_FOLLOW).
 */
export function keyedFollowT(step) {
  const c = PLAYER.combo[step] || PLAYER.combo[0];
  const f = KEYED_FOLLOW[Math.min(KEYED_FOLLOW.length - 1, Math.max(0, step))];
  return c.wind + c.active + c.recover * (1 - Math.sqrt(1 - f));
}

/**
 * Each keyed swing ends two ways (hero_clips.py swingN and swingNb, the same up to the live window's
 * end). Where a swing ends is the sim's yaw, the arc's end out at his right, so where the camera sees
 * his back and left it points away from it, behind the body and cape (the third review: at 180° the
 * heavy's impact and bite showed no blade; swing1's held follow-through vanished for twelve frames at
 * 158°). There the b clips end another way: swing1b and swing2b carry the follow-through out in front
 * with the blade raised; swing3b lands out at his left, the blade driven down steeply beside him and
 * levered round towards the front as it bites. The window of body facings, from the facing straight
 * away from the camera (radians, − his left turned towards the camera), where the b clip is played.
 * One or the other, chosen as the swing starts and kept to its end (hero3d.js), never a blend: two
 * steep blades on two arm poses blended by bone came out up to 7.6° off the hitbox's yaw. (To +35°,
 * not +20°: from 20° to 35° — the camera behind him and to his right — the heavy's landing out at his
 * right was behind his body for twelve frames, its b landing beside him shows: the fourth review.)
 */
export const KEYED_BACK = Object.freeze({ from: (-120 * Math.PI) / 180, to: (35 * Math.PI) / 180 });
/** Whether a keyed swing plays its b clip at body facing `faceWorld` (sim radians): inside KEYED_BACK's window. */
export function keyedBack(faceWorld) {
  // (the window as found for the left hand; mirrored about the camera's line for the right, FORE)
  const x = FORE * wrapAngle(faceWorld - AWAY);
  return x >= KEYED_BACK.from && x <= KEYED_BACK.to;
}

/**
 * The moving carry's arms (the upper-body design, 2026-10-03), by speed `v` (u/s): each arm swings from
 * its shoulder, opposite the other, the elbow keeping a bend — never the hand alone out of the arm's reach
 * (the sprint carry's target was beyond it: the sword elbow locked half of every stride, then snapped, the
 * wrist bent 125° and the hilt slid out of the fist; the sword arm pumped from the elbow, with the wrong
 * leg). Degrees, in the trunk's own frame (applyArms kinWrist):
 *   th  the upper arm forward of hanging: its mean and its swing (+ forward)
 *   el  the elbow's bend: its mean and its swing (more bent at the front, as a runner's)
 *   ab  the arm out from the side (clear of the belt pouches and the thighs); abBack more at the back
 *   inw the forearm turned in towards the middle (a runner's hands head for the midline, never across)
 * The free arm running (walking, walkFree): its shoulder range growing with speed, the elbow open — 30-36° at
 * the front of the swing, 46-54° at the back — not a sprinter's 90° (the owner, 2026-10-04, red lines on a frame:
 * at 90°, the forearm turned in across the chest, the arm read from the side as a V at the wrist; his upper arm,
 * forearm and fist in one line forward and down). The sword arm: the walk's from the owner's walk (elbow 33-44°),
 * its swing about half the free arm's (a weighted arm swings less: Pontzer); the run's a sword arm's, the elbow
 * 37-45°: with a hammer grip a forearm raised past ~60° can only hold the blade upright, and the wrist would have
 * to bend back past 45° to level it.
 * Out from the side (the owner, 2026-10-04, red and yellow lines on a frame: "he is pressing his upper arm towards
 * his body too much"): with the shoulder joint moved to the ball of the arm (tools/3d/rig/move_arm_joints.py) and
 * the shoulder re-skinned, the visible upper arm reads ~8° less out than its bone (the deltoid's bulge; 8.6° at
 * rest), and at the old angles it hung 6-8° out walking and running on the free side, 14-16° on the sword side.
 * Now 22° (sword) and 16-19° (free) visibly out, the elbows clear of the body, and the forearms turned in (inw)
 * so the hands stay as near the body as before (the free fist at a sprint 2.2-4.4 out from the hips).
 */
export const CARRY_ARM = Object.freeze({
  walk: { th: -2, thA: [4, 14], el: 34, elA: 6, ab: 28, abBack: 4, inw: 10 },
  // (the owner, 2026-10-04, red lines on a sprint frame from the front: the sword arm's shoulder → hand line 17°
  // out, the hand ~3.75 out from the buckle — measured in that view (.scratch/shoulder/screenarm.mjs) it read 14°
  // and 3.37: the forearm turned in less, 8° not 16, and the arm 27° out: 17°, 3.67)
  // (in the right hand, on the side of the belt pouch at the back of his right hip, out 35°, 16° more at the back: at
  // the left hand's 27° and 8°, running, the pommel went 0.5-0.76 into the pouch in 1-2% of a run's frames — the free
  // arm there had been taken out for the same pouch; .scratch/weapons/clip.mjs)
  run: { th: -4, thK: 0.6, el: 42, elA: -5, ab: FORE > 0 ? 27 : 35, abBack: FORE > 0 ? 8 : 16, inw: 8 },
  // the free arm walking (the owner, 2026-10-04: "the arms are still bad posture when walking"): swung from the
  // shoulder, the elbow soft and bending a little more at the front, the hand passing the hip clear of it — the
  // walk clip's own arm hardly swung from the shoulder and lifted the forearm 51° at the front, a tray carried
  walkFree: { th: -4, thA: [4, 18], el: 14, elA: 10, ab: 34, inw: 14 },
  // (the owner, 2026-10-04, after the elbow fix: "the hand and underarm could be a bit closer to the body while
  // running" — at 22° out and 56° at the back, set on the old rig to clear the belt pouch, the fist swung 3.2-5.8
  // units out from the hips, walking 3.5-3.9. Then: the upper arm out from the shoulder, the forearm turned in —
  // the elbow clear of the body, the fist near it; out 22° more at the back of the swing, where the longer, true
  // upper arm put the forearm into the pouch at the back of his hip: 0.4 deep in a third of sprint frames at 6°.
  // Walking 34° out for the same reason, 0.42 deep in 13% at 28°.) Then, the owner, 2026-10-04, red lines on a
  // sprint frame from the front: the free arm's shoulder → hand line 20° out — at the back of the swing it read 54°
  // in his view (.scratch/shoulder/screenarm.mjs), the fist 5.4 out from the buckle; set to his line (22° out, none
  // more at the back, the swing back 0.45 of the forward: 26° and 4.3), he asked for halfway between: 23.5° out,
  // 11° more at the back, the swing back 0.725 of the forward (a runner's arm drives forward further than back) —
  // 40° and 5.0 at his frame, 8-40° through a sprint stride. At the back of a sprint stride the point of the elbow
  // grazes the back of the hip, under the cape, at most 0.18 deep (.scratch/verify/elbowpt/probe.mjs; swung back as
  // far with the arm in at 22°, the forearm went 0.24 into the pouch in 12% of frames)
  free: { th: -6, thA: [22, 44], thBack: 0.725, el: [38, 44], elA: [-8, -10], ab: 23.5, abBack: 11, inw: 16 },
});
const DEG = Math.PI / 180;
/**
 * The arms' angles standing (the owner's references, 2026-10-03: "the whole shoulder/arm/hands look cramped
 * and awkward" — a swordsman's stand, the arms held out clear of the body, not hanging against it): the sword
 * arm 40° out from the side (visibly ~32°: on the old rig 30° read 27°, and the owner, 2026-10-04, found the upper
 * arms pressed to the body; at 32-36° swing2's buffered follow-through, blending back to the stand, lay over his
 * leg a frame longer than tools/test.mjs allows at 68°) and 14° back, the forearm hanging near straight down from a soft elbow (the
 * soft stretch bends it ~34°), so the blade can hang forward and down from a relaxed wrist. Placed by these
 * angles as the moving carry's are (`kin`), so a start or a stop blends angle to angle. The free arm's (fth…)
 * are for the run's free arm to blend from; standing it hangs (HANG_FREE).
 */
// (Over a swing — `relax` 0, the carry coming back in over its follow-through — the upper arm only this share as
// far back: back at the stand's, the returning blade lay across his body a frame longer than a tenth of a second.)
const STAND_TH_SWING = 0.43;
const STAND_AB_SWING = 0.8; // (and only this share as far out)
const HANG_ANGLES = Object.freeze({ th: -14 * DEG, el: 18 * DEG, ab: 40 * DEG, inw: 0, fth: 0, fel: 24 * DEG, fab: 16 * DEG, finw: 0 });
/** The run's swing amplitudes by speed: 0 at 25 u/s (the jog), 1 at 94 (the sprint). */
const runK = (v) => Math.max(0, Math.min(1, ((v ?? 94) - 25) / 69));
/**
 * How the sword is carried while standing and moving, as the hero holds it (before it is turned to
 * show, carryPose), and where the moving arms are (CARRY_ARM): the guard, breathing a little; moving, the
 * sword arm swings with the stride as a running arm does (the owner, 2026-10-02: held still at the hip it
 * "looks derpy"), the elbow bent and the blade held ahead and down: forward and up in front of the hip at
 * `swing` 1, back past the hip and low at −1. `move` 0..1 (from standing to moving), `phase` the stride
 * (0..1), `t` sim-view seconds; `swing` −1..1, where the sword hand is in its swing — hero3d.js passes it
 * from the stride's phase, opposite the free arm's; without it, from the phase. `runW` the run's weight,
 * `relax` the shoulders' rounding (0 in a swing), `v` the gait's speed (u/s; null: a sprint).
 */
export function carryBase(move, phase, t, swing = null, runW = 1, relax = 1, v = null) {
  // Standing: relaxed, not on guard (the owner, 2026-10-02: the hands "in a kinda awkward position",
  // both tucked in front of his belly, the blade held level across him) — the sword arm hanging at
  // his side and a little in front of his hip (the owner: "slightly in front of his hips, not behind"),
  // within the arm's easy reach so the grip sits in his hand, the blade angled a little down and
  // turned out (kept near the guard, so a cut out of it winds up no faster than the cut itself). His cuts still start from GUARD.
  // (the owner's picture, 2026-10-03: both arms hang straight at his sides, the gloves beside the upper
  // thighs below the belt, the sword hand low by the leg with the blade forward and down — at hh 0.04
  // and psi −0.9 the forearm folded across onto the belt pouch)
  // `hang`: the sword hand where the arm hangs straight from the shoulder (applyArms, HANG), a target it
  // can reach — his arms are short (3.9 units shoulder to wrist), and a lower one slid the hilt out of
  // his fist. psi, reach and hh stay for the blend into a cut.
  // (The wrist: r −0.9, pitch −0.16 would rest the hand straighter, 17°, but hid the blade behind him
  // at some facings; the hand's turn about its own line goes to the forearm instead: applyArms
  // forearmRoll, 25° left at the wrist.)
  // (the references' stand, 2026-10-03: the arm out from the body by its angles, `kin`, the blade hanging
  // forward and down from the hand, a relaxed wrist, `wlim` — and the hilt let turn in a loose fist,
  // hero3d.js GRIP_LOOSE)
  // (r and psi as the left hand's, mirrored for the right: FORE)
  const idle = { ...GUARD, r: (-0.6 - 0.2 * relax) * FORE, pitch: -0.34 - 0.2 * relax, psi: -1.19 * FORE, reach: 0.6, hh: -0.16 + 0.02 * Math.sin((t * Math.PI * 2) / 2.4), hang: 1, soft: 1, hfwd: HANG.fwd * relax, kin: 1, ...HANG_ANGLES, th: HANG_ANGLES.th * (STAND_TH_SWING + (1 - STAND_TH_SWING) * relax), ab: HANG_ANGLES.ab * (STAND_AB_SWING + (1 - STAND_AB_SWING) * relax) };
  const s = Math.max(-1, Math.min(1, swing ?? Math.sin(phase * Math.PI * 2)));
  // (The blade swings with the hand: turned in and tipped up as the hand comes forward, trailing out
  // and down as it goes back, never held still ahead like a lance. Searched against the carry's
  // checks in tools/test.mjs: at least 45% of the blade showing at every facing, 52% at worst.)
  // (psi/hh/reach stay as bladeShows' model of where the hand is; the arm itself is CARRY_ARM's, `kin`.
  // The run's blade is turned out further at the front of the swing: with the forearm raised, a blade
  // pointing ahead needs more bend toward the little finger than a wrist has, wlim.)
  const A = CARRY_ARM;
  const k = runK(v);
  const fA = A.free.thA[0] + (A.free.thA[1] - A.free.thA[0]) * k;
  const sf = -s; // the free arm, opposite
  const run = {
    ...GUARD, r: (-0.55 + 0.3 * s) * FORE, pitch: 0.1 * s - 0.15, psi: (-1.2 + 0.95 * s) * FORE, hh: 0.26 + 0.24 * s, reach: 0.5 + 0.08 * Math.abs(s), off: 0.6, soft: 1, kin: 1, wlim: 1,
    th: (A.run.th + A.run.thK * fA * s) * DEG, el: (A.run.el + A.run.elA * s) * DEG, ab: (A.run.ab + A.run.abBack * 0.5 * (1 - s)) * DEG, inw: A.run.inw * DEG,
    fkin: 1, fth: (A.free.th + fA * sf * (sf < 0 ? A.free.thBack ?? 1 : 1)) * DEG, fel: (A.free.el[0] + (A.free.el[1] - A.free.el[0]) * k + (A.free.elA[0] + (A.free.elA[1] - A.free.elA[0]) * k) * sf) * DEG, fab: (A.free.ab + A.free.abBack * 0.5 * (1 - sf)) * DEG, finw: A.free.inw * 0.5 * (1 + sf) * DEG,
  };
  // Walking (the owner, 2026-10-03: "while walking his elbows should be more relaxed and swing a little
  // bit more"): the arm never at full stretch (`soft`), so the elbow keeps a bend through the stride, the
  // swing growing with the walk's speed (at 4 u/s, where the legs walk, it swung 0.4°).
  const wv = v ?? 13;
  const wK = Math.min(1, Math.max(0, (wv - 4) / 9));
  const wA = (A.walk.thA[0] + (A.walk.thA[1] - A.walk.thA[0]) * wK) * Math.min(1, wv / 4);
  const fwA = (A.walkFree.thA[0] + (A.walkFree.thA[1] - A.walkFree.thA[0]) * wK) * Math.min(1, wv / 4);
  const walk = {
    ...GUARD, r: (-0.45 + 0.55 * s) * FORE, pitch: 0.12 * s - 0.3, psi: (-1.18 + 1.05 * s) * FORE, hh: 0.14 + 0.26 * s, reach: 0.48 + 0.06 * Math.abs(s), off: 0.6, soft: 1, hang: 0.7, hfwd: HANG.fwd * relax, kin: 1, wlim: 1, wcap: 1,
    th: (A.walk.th + wA * s) * DEG, el: (A.walk.el + A.walk.elA * s) * DEG, ab: (A.walk.ab + A.walk.abBack * 0.5 * (1 - s)) * DEG, inw: A.walk.inw * DEG,
    fkin: 1, fth: (A.walkFree.th + fwA * sf) * DEG, fel: (A.walkFree.el + A.walkFree.elA * 0.5 * (1 + sf)) * DEG, fab: A.walkFree.ab * DEG, finw: A.walkFree.inw * DEG,
  };
  return mixPose(idle, mixPose(walk, run, runW), move);
}

/**
 * The carry's yaw range (from the facing): always on the sword side, from trailing out behind the
 * shoulder (facing up the screen and to the right, the sword side turned away, that is where it
 * shows) to just short of straight ahead. Never across the front: a cut out of the carry would have
 * to whip the blade back round in its 0.1 s wind-up (every cut starts on the sword side).
 */
// (kept ascending: [−2.1, −0.1] with the sword in the left hand, its mirror in the right)
export const CARRY_R = Object.freeze(FORE > 0 ? [-2.1, -0.1] : [0.1, 2.1]);
/** A carry pose turned to yaw `r`: the hand follows the blade round the hip. */
export function carryTurned(base, r) {
  return { ...base, r, psi: base.psi + (r - base.r) * 0.55, reach: base.reach + Math.max(0, FORE * (base.r - r)) * 0.06 };
}
/** How much of the blade counts as showing (share of its length on screen), how much a turn away from the hero's own carry costs, and how much better the other side must be to swing over to it. */
const SHOW_ENOUGH = 0.62;
const TURN_COST = 0.1;
const SWAP = 0.08;
const CARRY_STEPS = 41;

/**
 * The yaw the carry should turn to at facing `faceWorld`: the hero's own (base.r) wherever the blade
 * shows well enough; else turned out or in along the sword side as little as it takes to show the
 * most of it (bladeShows). A blade along the view is hidden behind the body or foreshortened to a
 * stub, so at some facings the best yaw lies on the far side of that line: `rNow` (the yaw shown
 * now) keeps the carry on its own side of it until the other side shows clearly more — no flicking
 * between the two as the facing wanders (hero3d.js swings it across on a spring). Without `rNow`,
 * the best of all. With `span`, only the climb from `rNow`, at most `span` (rad) from it: the side is
 * already chosen (hero3d.js chooses it on the stride's middle, then the swinging hand's best near it).
 */
const carryJ = new Float64Array(CARRY_STEPS);
export function carryYaw(base, faceWorld, rNow = null, span = null) {
  const [r0, r1] = CARRY_R;
  const N = CARRY_STEPS;
  const rAt = (i) => r0 + ((r1 - r0) * i) / (N - 1);
  // (a step's worth: the share of the blade showing, up to enough, less the cost of turning from the hero's own)
  const J = carryJ;
  const score = (i) => (J[i] = Math.min(SHOW_ENOUGH, bladeShows(carryTurned(base, rAt(i)), faceWorld)) - TURN_COST * Math.abs(rAt(i) - base.r));
  const i0 = rNow == null ? -1 : Math.round(((Math.min(r1, Math.max(r0, rNow)) - r0) / (r1 - r0)) * (N - 1));
  // (the side already chosen: only the steps within `span` scored, the climb kept among them)
  const lo = span == null || i0 < 0 ? 0 : Math.max(0, i0 - Math.floor((span / (r1 - r0)) * (N - 1)));
  const hi = span == null || i0 < 0 ? N - 1 : Math.min(N - 1, i0 + Math.floor((span / (r1 - r0)) * (N - 1)));
  let best = lo;
  for (let i = lo; i <= hi; i++) if (score(i) > J[best]) best = i;
  if (i0 >= 0) {
    // Uphill from where the carry is: the best on its own side.
    let i = i0;
    for (;;) {
      const up = i + 1 <= hi && J[i + 1] > J[i] ? i + 1 : -1;
      const down = i - 1 >= lo && J[i - 1] > J[i] ? i - 1 : -1;
      const next = up < 0 ? down : down < 0 ? up : J[up] >= J[down] ? up : down;
      if (next < 0) break;
      i = next;
    }
    if (span != null || J[i] >= J[best] - SWAP) best = i;
  }
  return rAt(best);
}

/**
 * How the sword is carried (the guard standing, ahead and down running: carryBase), and, given the
 * body's facing `faceWorld`, turned along the sword side to show past the body (carryYaw; `rNow` as
 * there). hero3d.js springs the yaw itself; this is the pose at the yaw it wants.
 */
export function carryPose(move, phase, t, faceWorld = null, rNow = null) {
  const base = carryBase(move, phase, t);
  return faceWorld == null ? base : carryTurned(base, carryYaw(base, faceWorld, rNow));
}

/**
 * The hero, for bladeShows, in shares of his height (the painted hero, measured at rest): the hips
 * and the shoulders (hh 0 and 1), the sword arm's length, the blade from the grip (guard to tip),
 * and his silhouette — the body and cape a column this wide up to the hood, the hood narrower; and
 * the sword shoulder's joint (out from the chest, its height) with how far the arm reaches from it
 * to the grip (the painted hero's bones: 3.29 units out, at 12.6, the arm 4.35 plus the hand).
 */
const FIG = { hip: 0.41, shoulder: 0.69, arm: 0.242, guard: 0.04, tip: 0.458, body: 0.2, neck: 0.8, hood: 0.15, out: 0.168, shoulderY: 0.64, reach: 0.235, chest: 0.16 };
/** The sword side, as `r` and `psi` count (−1 his left): config.js FORE — his right with the sword in his right hand. */
const SWORD_SIDE = -FORE;
const SHOW_N = 16;
/** Is the point (hero-relative, in heights) behind the hero's body or hood, from the camera, or under the ground? The body's axis at (`cx`, `cz`). */
function hiddenAt(x0, y, z0, widen = 1, cx = 0, cz = 0) {
  if (y < 0) return true;
  const x = x0 - cx;
  const z = z0 - cz;
  // (the body column, then the hood's: no arrays made — carryYaw asks this 700 times a frame)
  return behindColumn(x, y, z, FIG.body * widen, 0, FIG.neck) || behindColumn(x, y, z, FIG.hood * widen, FIG.neck, 1);
}
const CAM_A = CAM_BACK[0] * CAM_BACK[0] + CAM_BACK[2] * CAM_BACK[2];
/** The ray to the camera, (x, y, z) + s·BACK for s ≥ 0, through the column of radius `rad` from y0 to y1? */
function behindColumn(x, y, z, rad, y0, y1) {
  const b = x * CAM_BACK[0] + z * CAM_BACK[2];
  const c = x * x + z * z - rad * rad;
  const disc = b * b - CAM_A * c;
  if (disc < 0) return false;
  const q = Math.sqrt(disc);
  const s0 = Math.max(0, (-b - q) / CAM_A, (y0 - y) / CAM_BACK[1]);
  const s1 = Math.min((-b + q) / CAM_A, (y1 - y) / CAM_BACK[1]);
  return s1 > s0;
}

/**
 * Where the sword hand (the grip) is for a pose at the body's facing `faceWorld`, hero-relative in
 * heights, as applyArms and applyCutBody put it: round the chest at the hand's bearing, at its height
 * between the hips and the shoulder, the weight's shift and drop and the torso's lean carrying the
 * chest, shoulder and hips with them. The hand only gets as far as the arm reaches from its shoulder
 * (applyArms' IK stretches the arm straight towards a grip out of reach): the sword shoulder out at
 * the side of the chest, turned with the torso's twist (twistOf). A grip asked for across the body
 * stops well short of it.
 */
export function handAt(pose, faceWorld, out = [0, 0, 0]) {
  const psiW = faceWorld + pose.psi;
  const reach = pose.reach * FIG.arm;
  const lean = pose.lean ?? 0;
  const fwd = (pose.shift ?? 0) * 0.1;
  const drop = (pose.dip ?? 0) * 0.075;
  const bend = (FIG.shoulderY - FIG.hip) * (1 - Math.cos(lean));
  const fx = Math.cos(faceWorld);
  const fz = Math.sin(faceWorld);
  const chest = fwd + Math.sin(lean) * FIG.chest;
  const hip = FIG.hip - drop;
  const shoulderY = FIG.shoulderY - drop - bend;
  let hx = fx * chest + Math.cos(psiW) * reach;
  let hy = hip + pose.hh * (FIG.shoulder - drop - bend - hip);
  let hz = fz * chest + Math.sin(psiW) * reach;
  const sb = faceWorld + twistOf(pose, 0, 0) + (SWORD_SIDE * Math.PI) / 2;
  const ahead = fwd + Math.sin(lean) * (FIG.shoulderY - FIG.hip);
  const sx = Math.cos(sb) * FIG.out + fx * ahead;
  const sz = Math.sin(sb) * FIG.out + fz * ahead;
  const gap = Math.hypot(hx - sx, hy - shoulderY, hz - sz);
  if (gap > FIG.reach) {
    const k = FIG.reach / gap;
    hx = sx + (hx - sx) * k;
    hy = shoulderY + (hy - shoulderY) * k;
    hz = sz + (hz - sz) * k;
  }
  out[0] = hx;
  out[1] = hy;
  out[2] = hz;
  return out;
}
const HAND_TMP = [0, 0, 0];

/** The blade's rise (radians) that puts its tip GROUND_DEPTH (a share of his height) into the ground from the hand as handAt places it. */
export const GROUND_DEPTH = 0.04;
/** The steepest the drawn blade is driven down (applyArms), radians. */
const GROUND_STEEPEST = 1.45;
export function groundPitch(pose, faceWorld) {
  const hy = handAt(pose, faceWorld)[1];
  return -Math.asin(Math.min(1, (hy + GROUND_DEPTH) / FIG.tip));
}

/**
 * How much of the blade shows on screen for a sword pose (r, pitch from the facing; psi, hh and
 * reach placing the hand as applyArms does) at the body's facing `faceWorld`: its length on screen,
 * not behind the body or hood, as a share of its whole length (1 lying across the screen in plain
 * view; 0 hidden, or pointing straight at the camera). `widen` scales the silhouette's width (a
 * margin for a pose that must show for sure).
 */
export function bladeShows(pose, faceWorld, widen = 1) {
  const a = faceWorld + pose.r;
  const hand = handAt(pose, faceWorld, HAND_TMP);
  const hx = hand[0];
  const hy = hand[1];
  const hz = hand[2];
  const cp = Math.cos(pose.pitch);
  const dx = Math.cos(a) * cp;
  const dy = Math.sin(pose.pitch);
  const dz = Math.sin(a) * cp;
  // The body goes forward with the weight and the lean (a lunge: the hips, the front leg, the cape).
  const ahead = (pose.shift ?? 0) * 0.1 + Math.sin(pose.lean ?? 0) * FIG.chest * 0.5;
  const cx = Math.cos(faceWorld) * ahead;
  const cz = Math.sin(faceWorld) * ahead;
  let seen = 0;
  let px = 0;
  let py = 0;
  let pv = false;
  for (let i = 0; i <= SHOW_N; i++) {
    const s = FIG.guard + ((FIG.tip - FIG.guard) * i) / SHOW_N;
    const x = hx + dx * s;
    const y = hy + dy * s;
    const z = hz + dz * s;
    const sx = x * CAM_RIGHT[0] + y * CAM_RIGHT[1] + z * CAM_RIGHT[2];
    const sy = x * CAM_UP[0] + y * CAM_UP[1] + z * CAM_UP[2];
    const v = !hiddenAt(x, y, z, widen, cx, cz);
    if (i > 0) seen += ((v ? 0.5 : 0) + (pv ? 0.5 : 0)) * Math.hypot(sx - px, sy - py);
    px = sx;
    py = sy;
    pv = v;
  }
  return seen / (FIG.tip - FIG.guard);
}

// --- posing a skeleton -----------------------------------------------------------------------------------
const UP = new Vector3(0, 1, 0);
const vF = new Vector3();
const vR = new Vector3();
const vA = new Vector3();
const vB = new Vector3();
const vP = new Vector3();
const vD = new Vector3();
const vE = new Vector3();
const vX = new Vector3();
const vG = new Vector3();
const vPole = new Vector3();
const vT = new Vector3();
const qArm = [new Quaternion(), new Quaternion(), new Quaternion(), new Quaternion()];
const qA = new Quaternion();
const qB = new Quaternion();
const qS = new Quaternion();
const qH = new Quaternion();
const mB = new Matrix4();
const footP = [new Vector3(), new Vector3()];
const footQ = [new Quaternion(), new Quaternion()];

function frame(faceWorld) {
  vF.set(Math.cos(faceWorld), 0, Math.sin(faceWorld));
  vR.set(-Math.sin(faceWorld), 0, Math.cos(faceWorld)); // the hero's right (world angles grow clockwise from above)
}
/** How a chest turn is shared over the spine's bones, from the bottom (an evenly shared one past them). */
const SPINE_SHARE = [0.3, 0.35, 0.35];

/** The torso's twist for a pose: after the sword hand, from the body's own facing. */
export const twistOf = (pose, face, faceWorld) => Math.max(-1.25, Math.min(1.25, 0.65 * wrapAngle(face + pose.psi - faceWorld) + (pose.twist ?? 0)));

/**
 * The body under a cut: the weight shifted and dropped over the planted feet, the hips and chest
 * twisted after the sword hand, the torso leaning, the head turned back to the target; then the legs
 * put back so the feet stay exactly where they stood. `rig`: { hips, spine: [bones], neck, head,
 * legs: [{ thigh, shin, foot }], height }. World matrices must be current. `face` the sim's facing,
 * `faceWorld` the body's own (they differ while it turns).
 */
export function applyCutBody(rig, pose, weight, face, faceWorld) {
  if (weight <= 1e-3 || !rig.hips) return;
  frame(faceWorld);
  const H = rig.height;
  rig.legs.forEach((l, i) => {
    l.foot.getWorldPosition(footP[i]);
    l.foot.getWorldQuaternion(footQ[i]);
  });
  // The weight: forward along the facing and down (the knees take it).
  rig.hips.getWorldPosition(vA);
  vA.addScaledVector(vF, pose.shift * 0.1 * H * weight);
  vA.y -= pose.dip * 0.075 * H * weight;
  rig.hips.parent.worldToLocal(vA);
  rig.hips.position.copy(vA);
  rig.hips.updateMatrixWorld(true);
  const twist = (twistOf(pose, face, faceWorld) + (globalThis.__twistAdd ?? 0)) * weight; // (__twistAdd: the bench's &twistadd=, for measuring)
  turnWorld(rig.hips, qA.setFromAxisAngle(UP, -twist * 0.3));
  // The chest: the rest of the twist, the lean and the side bend, over the spine.
  rig.spine.forEach((b, i) => {
    const k = SPINE_SHARE[i] ?? 1 / rig.spine.length;
    qA.setFromAxisAngle(UP, -twist * 0.7 * k);
    qB.setFromAxisAngle(vR, -pose.lean * weight * k); // forward: the top towards the facing
    qA.multiply(qB);
    qB.setFromAxisAngle(vF, pose.roll * weight * k);
    qA.multiply(qB);
    turnWorld(b, qA);
  });
  // The head keeps on the target.
  if (rig.neck) turnWorld(rig.neck, qA.setFromAxisAngle(UP, twist * 0.45).multiply(qB.setFromAxisAngle(vR, pose.lean * weight * 0.4)));
  if (rig.head) turnWorld(rig.head, qA.setFromAxisAngle(UP, twist * 0.25));
  // The feet stay planted: each leg reaches back to where its foot stood, the knee in its own plane.
  rig.legs.forEach((l, i) => {
    twoBoneIK(l.thigh, l.shin, l.foot, footP[i], null, 1);
    setWorldQuaternion(l.foot, footQ[i]);
  });
}

/**
 * Standing with a great weapon over the shoulder: a fighter's stance, not a stroll's (the owner's side view of the
 * great club, 2026-10-05: "make his stance look exactly like in this image"). The foot on the free side a step
 * ahead with its knee bent, the weapon side's a step behind, its toe turned out; the hips down between them and
 * turned with the legs, the chest kept square; the back leaned into the weight, the head brought back up to look
 * ahead. In shares of his height (lead, rear, dip, shift) and radians (lean, hipTurn, rearOut; neck: the share of
 * the lean the neck takes back).
 */
// (the feet 0.09 of his height further apart along his facing than the idle's, which already stands the free foot a little
// ahead: twice that, 0.22-0.25, stood him twice as wide as the reference, the back foot well out behind the cape; the
// hips 0.05 down, which is what bends the front knee; the lean 14°, the neck taking 60% of it back; each foot `narrow` in
// towards the line under his hips and the knees turned `kneeFwd` of the way to ahead — the idle's feet stand 0.31 of his
// height apart, 45% wider than his shoulders, and dropped over them his knees bowed out like a sumo's from the front)
export const CARRY_STANCE = Object.freeze({ lead: 0.03, rear: 0.06, dip: 0.05, shift: 0.03, lean: 0.25, hipTurn: 0.15, rearOut: 0.3, neck: 0.6, narrow: 0.045, kneeFwd: 0.8 });
/** The one-handed sword's own standing guard, as the owner's video of its cuts opens (2026-10-07): the same parts. (the feet square, as
 * his; leaned 0.32 — at 0.38 the shoulders lagged the hips' tip as his weight changed legs: tools/test.mjs) */
export const SWORD_STANCE = Object.freeze({ lead: 0, rear: 0, dip: 0.06, shift: 0.02, lean: 0.32, hipTurn: 0, rearOut: 0, neck: 0.5, narrow: 0, kneeFwd: 0.8 });
const vSt = new Vector3(), vSb = new Vector3(), vSc = new Vector3(), vSd = new Vector3();
/**
 * The carry stance by `weight` (0..1), over the pose as it stands, before the feet are planted (anim/stride.js
 * then steps each foot to where it puts it). `out` (horizontal, unit): towards the weapon side. Its hips and legs by
 * `wHips` (what a change of clip's blend does not already hold of them), the chest and head by `weight`.
 */
export function applyCarryStance(rig, weight, faceWorld, out, C = CARRY_STANCE, wHips = weight) {
  if (weight <= 1e-3 || !rig.hips || rig.legs.length < 2) return;
  frame(faceWorld);
  const H = rig.height;
  const w = wHips;
  const sgn = out.dot(vR) >= 0 ? 1 : -1; // (+1: the weapon on his right)
  rig.hips.getWorldPosition(vA);
  // the leading leg: the one on the free side
  let lead = 0, best = Infinity;
  rig.legs.forEach((l, i) => {
    l.foot.getWorldPosition(footP[i]);
    l.foot.getWorldQuaternion(footQ[i]);
    const o = l.thigh.getWorldPosition(vSt).sub(vA).dot(out);
    if (o < best) (best = o), (lead = i);
  });
  rig.legs.forEach((l, i) => {
    // (in towards the line under his hips by `narrow`: the idle's feet stand 0.31 of his height apart, and bent over
    // them the knees bowed out)
    const o = vSt.subVectors(footP[i], vA).dot(vR);
    footP[i].addScaledVector(vR, -Math.sign(o) * Math.min(Math.abs(o) * 0.5, (C.narrow ?? 0) * H) * w);
    if (i === lead) footP[i].addScaledVector(vF, C.lead * H * w);
    else {
      footP[i].addScaledVector(vF, -C.rear * H * w);
      footQ[i].premultiply(qA.setFromAxisAngle(UP, -sgn * C.rearOut * w)); // (the toe out to the weapon side)
    }
  });
  // the hips: down between the feet, a little over the leading one, turned with the legs (the leading hip forward)
  vA.addScaledVector(vF, C.shift * H * w);
  vA.y -= C.dip * H * w;
  rig.hips.parent.worldToLocal(vA);
  rig.hips.position.copy(vA);
  rig.hips.updateMatrixWorld(true);
  turnWorld(rig.hips, qA.setFromAxisAngle(UP, -sgn * C.hipTurn * w));
  const turn = -sgn * C.hipTurn * weight; // (the hips' whole turn, the blend's share with it)
  // the chest: the hips' turn taken back, the lean forward
  // (kept square: turned on with the hips, the free shoulder forward as a batter stands, his back came round to a camera
  // behind him and the fists went out of sight behind it — not the owner's view)
  rig.spine.forEach((b, i) => {
    const k = SPINE_SHARE[i] ?? 1 / rig.spine.length;
    qA.setFromAxisAngle(UP, -turn * k);
    qB.setFromAxisAngle(vR, -C.lean * weight * k); // forward: the top towards the facing
    turnWorld(b, qA.multiply(qB));
  });
  if (rig.neck) turnWorld(rig.neck, qA.setFromAxisAngle(vR, C.lean * weight * C.neck));
  // the legs to their feet, each knee turned towards ahead (and a little out) by `kneeFwd` of the way from its own plane
  rig.legs.forEach((l, i) => {
    l.thigh.getWorldPosition(vA);
    l.shin.getWorldPosition(vSt).sub(vA);
    vSb.subVectors(footP[i], vA).normalize();
    vSt.addScaledVector(vSb, -vSt.dot(vSb)).normalize(); // (the knee's own way out of the hip-to-foot line)
    const o = vSc.subVectors(vA, rig.hips.getWorldPosition(vSd)).dot(vR) >= 0 ? 1 : -1;
    vSc.copy(vF).addScaledVector(vR, 0.3 * o).normalize().lerp(vSt, 1 - (C.kneeFwd ?? 0) * w).normalize();
    twoBoneIK(l.thigh, l.shin, l.foot, footP[i], vSc, 1);
    setWorldQuaternion(l.foot, footQ[i]);
  });
}

/** The most the shoulder (clavicle) turns forward to lend the sword arm reach. */
const CLAVICLE_MAX = 0.35;
const vC1 = new Vector3();
const vC2 = new Vector3();
const qC = new Quaternion();
const Q_ID = new Quaternion();
/**
 * A grip past the arm's reach brings the shoulder forward to meet it, as a real arm reaches (the
 * clavicle turns before the elbow locks). The hero's grip sits in his closed fist since the finger
 * bones (docs/HERO-HANDS.md); the socket used to hang 0.7 units past his fingertips, and the cuts'
 * reach was set with that long hand, so without this the extended cuts stopped short behind him.
 */
export function reachShoulder(arm, target, armLen, w) {
  if (!arm.shoulder) return;
  const s = arm.shoulder.getWorldPosition(vC1);
  const u = arm.upper.getWorldPosition(vC2).sub(s);
  const over = target.distanceTo(arm.upper.getWorldPosition(vC2)) - 0.98 * armLen;
  if (over <= 0) return;
  const clav = u.length();
  u.normalize();
  vC2.subVectors(target, s).normalize();
  qC.setFromUnitVectors(u, vC2);
  const full = 2 * Math.acos(Math.min(1, Math.abs(qC.w)));
  if (full < 1e-5) return;
  const ang = Math.min(full, over / Math.max(1e-5, clav), CLAVICLE_MAX);
  qC.slerp(Q_ID, 1 - ang / full);
  turnWorld(arm.shoulder, qC, w);
}

/** The standing arm's hang: how far it leans along the hand's bearing and forward (tangents), its length (share of the arm) and the fist's (share of his height). */
export const HANG = Object.freeze({ lean: 0.14, fwd: 0.15, len: 0.92, fist: 0.035 });
/** The standing free arm's hang: how far it leans out from the body and forward (tangents), and how much of its length it reaches (a little straighter than SOFT_REACH: at 0.97 the forearm swung 30° ahead and the hand dangled in front of the belt pouch). Out 36° (0.72: on the re-jointed, re-skinned arm the visible upper arm 27° out, as the owner approved the stand at 0.6 on the old rig), clear of the belt pouch and the cape with a gap, as the owner's references hang (at 0.24 the arm lay against the body: "cramped"); the elbow a little softer. */
export const HANG_FREE = Object.freeze({ out: 0.72, fwd: 0.16, reach: 0.985 });
/** The most of its length a `soft` arm reaches: an elbow never locked straight ("stiff as a stick"). */
export const SOFT_REACH = 0.97;
/** The knee over which a moving arm's reach eases into SOFT_REACH (a share of the arm). */
const SOFT_KNEE = 0.03;
const vSoft = new Vector3();
const vWrist = new Vector3();
const vHang = new Vector3();
const vHang2 = new Vector3();

// Standing, the elbow swivelled round the shoulder-wrist line only as far as it takes to bring the forearm's
// line within HANG_WRIST of the line the hand's world turn wants (the bend left at the wrist once forearmRoll
// has turned it): at facings where the blade's aim turns the hand, the wrist bent 44-51°.
// None wherever the hang already rests within it, so the owner's hanging arm is kept at the facings seen.
const HANG_WRIST = 0.61;
const vSwE = new Vector3();
const vSwS = new Vector3();
const vSwX = new Vector3();
const vSwN = new Vector3();
const vSwP = new Vector3();
const vSwT = new Vector3();
const vSwM = new Vector3();
const qSw = new Quaternion();
const qSw2 = new Quaternion();
/** How far (0..1) the pole must swing toward −e (e square to S→G) for the forearm to lie within HANG_WRIST of
 * e; twoBoneIK's elbow rebuilt in closed form. Leaves the swung-to pole in vSwT. */
function hangSwivel(arm, S, G, pole0, e) {
  const a = S.distanceTo(arm.fore.getWorldPosition(vSwM));
  const b = vSwM.distanceTo(arm.hand.getWorldPosition(vSwT));
  vSwX.subVectors(G, S);
  const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, vSwX.length()));
  vSwX.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const o = Math.sqrt(Math.max(0, a * a - along * along));
  vSwT.copy(e).addScaledVector(vSwX, -e.dot(vSwX));
  if (vSwT.lengthSq() < 1e-8) return 0;
  vSwT.normalize().negate();
  const th = (k) => {
    vSwP.copy(pole0).lerp(vSwT, k).normalize();
    vSwN.copy(vSwP).addScaledVector(vSwX, -vSwP.dot(vSwX));
    if (vSwN.lengthSq() < 1e-8) return Math.PI;
    vSwN.normalize();
    vSwM.copy(S).addScaledVector(vSwX, along).addScaledVector(vSwN, o);
    return Math.acos(Math.max(-1, Math.min(1, vSwM.subVectors(G, vSwM).normalize().dot(e))));
  };
  let t0 = th(0);
  if (t0 <= HANG_WRIST) return 0;
  const K = 20;
  for (let k = 1; k <= K; k++) {
    const t1 = th(k / K);
    if (t1 <= HANG_WRIST) return (k - 1 + (t0 - HANG_WRIST) / Math.max(1e-6, t0 - t1)) / K;
    t0 = t1;
  }
  return 1;
}
// A walking blade kept at or below this pitch (rad): the straightened wrist tipped it up to +14° at the front
// of each step (the owner's walk: "low by the thigh with the blade forward and down").
const WALK_PITCH_MAX = (-3 * Math.PI) / 180;
const vCapD = new Vector3();
const vCapK = new Vector3();
const qCap = new Quaternion();
/**
 * The most of the hand's turn about the forearm's line the forearm takes over (radians: 86°, about a forearm's
 * pronation or supination from neutral; 50° before: the moving carry turns its blade out by the forearm's
 * roll, 85-98° needed at 270° to show it).
 */
export const ROLL_MAX = 1.5;
const qRoll = new Quaternion();
const qRollT = new Quaternion();
const qRollI = new Quaternion();
const vRollAx = new Vector3();
/**
 * A turn of the hand about its own long axis is the forearm's (the radius rolling over the ulna), not the
 * wrist's: that part of the hand's turn from rest goes to the forearm, up to `max`, and the hand
 * keeps the rest, so the hand ends where it was and only the bend is left at the wrist. (Aiming the
 * sword turned the hand 41° from the forearm while standing — "it looks like he has broken his hand",
 * the owner, 2026-10-03; 32° of it was this roll.) The roll is about the forearm's own line (elbow to
 * wrist: the hand bone's place on the forearm), so the wrist stays exactly where the IK put it. (About
 * the hand's rest +Y, 14.4° off that line, a 50° roll moved the wrist 0.24 units off its goal and the
 * hilt slid that far out of the fist at every speed from 9 to 60 u/s: the ARMS lens.)
 */
export function forearmRoll(arm, rest, w, max = ROLL_MAX) {
  qRoll.copy(arm.hand.quaternion).multiply(qRollI.copy(rest).invert()); // the wrist's turn from rest, in the forearm's frame
  if (qRoll.w < 0) qRoll.set(-qRoll.x, -qRoll.y, -qRoll.z, -qRoll.w);
  vRollAx.copy(arm.hand.position);
  if (vRollAx.lengthSq() < 1e-10) return;
  vRollAx.normalize(); // the forearm's line, in its own frame
  let a = 2 * Math.atan2(qRoll.x * vRollAx.x + qRoll.y * vRollAx.y + qRoll.z * vRollAx.z, qRoll.w);
  a = wrapAngle(a);
  a = Math.max(-max, Math.min(max, a)) * w;
  if (Math.abs(a) < 1e-4) return;
  qRollT.setFromAxisAngle(vRollAx, a);
  arm.fore.quaternion.multiply(qRollT);
  arm.hand.quaternion.premultiply(qRollI.copy(qRollT).invert());
  arm.fore.updateMatrixWorld(true);
}
const Y_AXIS = new Vector3(0, 1, 0);
const qUt = new Quaternion();
/**
 * The forearm's turn about its own line (from its rest on the upper arm) taken off by `w`, the hand kept
 * where it is in the world: the clip's forearm twist, which the arm's IK carries over, is not the carry's.
 */
export function untwistForearm(arm, foreRest, w, upperRest = null, keepHand = true) {
  if (w <= 1e-3) return;
  // (the upper arm's turn about its own line first, the forearm kept where it is in the world)
  if (upperRest) untwistBone(arm.upper, arm.fore, upperRest, w);
  untwistBone(arm.fore, arm.hand, foreRest, w, keepHand);
}
function untwistBone(bone, child, rest, w, keepChild = true) {
  qUt.copy(rest).invert().multiply(bone.quaternion);
  if (qUt.w < 0) qUt.set(-qUt.x, -qUt.y, -qUt.z, -qUt.w);
  vRollAx.copy(child.position);
  if (vRollAx.lengthSq() < 1e-10) return;
  vRollAx.normalize();
  const tau = wrapAngle(2 * Math.atan2(qUt.x * vRollAx.x + qUt.y * vRollAx.y + qUt.z * vRollAx.z, qUt.w)) * w;
  if (Math.abs(tau) < 1e-4) return;
  qUt.setFromAxisAngle(vRollAx, -tau);
  bone.quaternion.multiply(qUt);
  if (keepChild) child.quaternion.premultiply(qUt.invert());
  bone.updateMatrixWorld(true);
}
/**
 * What a wrist can bend, from the hand's rest on the forearm (radians; the HANDS lens: a real wrist
 * reaches about 70-80° toward the palm, 60-70° back, 30-35° toward the little finger and 20° toward the
 * thumb); a turn about the hand's own line beyond the forearm's roll, `twist`.
 */
export const WRIST_LIMIT = Object.freeze({ flex: 1.2, ext: 1.0, uln: 0.6, rad: 0.35, twist: 0.2 });
const qW0 = new Quaternion();
const qW1 = new Quaternion();
const qW2 = new Quaternion();
const vW0 = new Vector3();
/**
 * The hand's bend kept inside WRIST_LIMIT, by `w` (after forearmRoll has taken the twist): the hand's
 * turn from its rest split into a twist about its own line (+Y) and a swing, the swing's two parts
 * (flexion toward the palm, deviation toward the thumb) clamped each. `sd` −1 the left hand (its palm
 * is +X), +1 the right.
 */
export function limitWrist(arm, rest, w, sd = -1) {
  if (w <= 1e-3) return;
  const L = WRIST_LIMIT;
  qW0.copy(rest).invert().multiply(arm.hand.quaternion);
  if (qW0.w < 0) qW0.set(-qW0.x, -qW0.y, -qW0.z, -qW0.w);
  qW1.set(0, qW0.y, 0, qW0.w).normalize(); // twist
  qW2.copy(qW0).multiply(qRollI.copy(qW1).invert()); // swing
  if (qW2.w < 0) qW2.set(-qW2.x, -qW2.y, -qW2.z, -qW2.w);
  const sa = 2 * Math.acos(Math.min(1, qW2.w));
  const sn = Math.sin(sa / 2);
  const rx = sn > 1e-6 ? (qW2.x / sn) * sa : 0;
  const rz = sn > 1e-6 ? (qW2.z / sn) * sa : 0;
  const flex = sd < 0 ? -rz : rz;
  const dev = rx;
  const tw = wrapAngle(2 * Math.atan2(qW1.y, qW1.w));
  const flex2 = Math.max(-L.ext, Math.min(L.flex, flex));
  const dev2 = Math.max(-L.uln, Math.min(L.rad, dev));
  const tw2 = Math.max(-L.twist, Math.min(L.twist, tw));
  if (flex2 === flex && dev2 === dev && tw2 === tw) return;
  vW0.set(dev2, 0, sd < 0 ? -flex2 : flex2);
  const ang = vW0.length();
  if (ang > 1e-9) qW2.setFromAxisAngle(vW0.multiplyScalar(1 / ang), ang);
  else qW2.identity();
  qW1.setFromAxisAngle(Y_AXIS, tw2);
  qW0.copy(rest).multiply(qW2).multiply(qW1);
  arm.hand.quaternion.slerp(qW0, w);
  arm.hand.updateMatrixWorld(true);
}

const vKin = new Vector3();
const vKinPole = new Vector3();
const vKu = new Vector3();
const vKf = new Vector3();
const vKd = new Vector3();
const vKt = new Vector3();
const vKl = new Vector3();
/**
 * An arm's wrist for a moving carry's angles (th, el, ab, inw: CARRY_ARM), in the trunk's own frame (up the
 * hips → chest line, forward the facing square to it, out on the arm's own side, `side`): the upper arm
 * from the shoulder joint `th` forward of hanging and `ab` out, the forearm `el` further forward and
 * `inw` in. Into `out`; the elbow's pole (a direction from the shoulder) into `pole`. frame() first.
 */
function kinWrist(rig, arm, th, el, ab, inw, side, out, pole) {
  rig.hips.getWorldPosition(vKt);
  rig.chest.getWorldPosition(vKd);
  vKt.subVectors(vKd, vKt).normalize(); // up the trunk
  vKf.copy(vF).addScaledVector(vKt, -vF.dot(vKt)).normalize(); // forward, square to it
  vKl.copy(vR).multiplyScalar(side); // out on the sword side
  arm.upper.getWorldPosition(out);
  arm.fore.getWorldPosition(vKu);
  const Lu = out.distanceTo(vKu);
  const Lf = vKu.distanceTo(arm.hand.getWorldPosition(vKd));
  const ph = th + el;
  // hanging, out from the side
  vKd.copy(vKt).multiplyScalar(-Math.cos(ab)).addScaledVector(vKl, Math.sin(ab));
  vKu.copy(vKd).multiplyScalar(Math.cos(th)).addScaledVector(vKf, Math.sin(th)).normalize();
  pole.copy(vKu);
  out.addScaledVector(vKu, Lu); // the elbow
  vKu.copy(vKd).multiplyScalar(Math.cos(ph)).addScaledVector(vKf, Math.sin(ph)).normalize();
  vKu.multiplyScalar(Math.cos(inw)).addScaledVector(vKl, -Math.sin(inw)).normalize();
  out.addScaledVector(vKu, Lf); // the wrist
  // (the elbow's side: the upper arm less the forearm, square to the shoulder-wrist line on any bend — the upper
  // arm alone lay along that line on the stand's near-straight arm, the bend's side was the leftover and turned
  // with every change of the angles: the elbow jumped 1 u as a start blended the run's in)
  pole.sub(vKu);
  if (pole.lengthSq() < 1e-8) pole.copy(vKd);
  return out;
}

/**
 * A moving carry seen as bladeShows models it (psi, hh, reach: the hand round the body axis, as a share of
 * his height), from where its arm angles really put the grip (kinWrist) on the posed skeleton — so the
 * carry's yaw (carryYaw) turns the blade to show from where the hand is, not from where the old carry put
 * it. Blended by the pose's `kin`. `root` the hero's place on the ground (world). A new object.
 */
export function carryAsDrawn(rig, pose, faceWorld, root) {
  const kin = pose.kin ?? 0;
  if (kin <= 1e-3 || !rig.arm?.upper) return pose;
  frame(faceWorld);
  const side = rig.side === "R" ? 1 : -1;
  kinWrist(rig, rig.arm, pose.th ?? 0, pose.el ?? 0, pose.ab ?? 0, pose.inw ?? 0, side, vKin, vKinPole);
  // (the grip a fist past the wrist, along the forearm: kinWrist leaves the forearm's line in vKu)
  vKin.addScaledVector(vKu, HANG.fist * rig.height);
  const H = rig.height;
  const dx = (vKin.x - root.x) / H;
  const dz = (vKin.z - root.z) / H;
  const psi = wrapAngle(Math.atan2(dz, dx) - faceWorld);
  const reach = Math.hypot(dx, dz) / FIG.arm;
  const hh = (vKin.y / H - FIG.hip) / (FIG.shoulder - FIG.hip);
  return { ...pose, psi: pose.psi + wrapAngle(psi - pose.psi) * kin, reach: pose.reach + (reach - pose.reach) * kin, hh: pose.hh + (hh - pose.hh) * kin };
}

/**
 * The free arm running (pose fth, fel, fab, finw: CARRY_ARM.free), by `w`: the run clip's own free arm,
 * pumping the whole sprint at every speed and held 48° out, replaced by a runner's swinging opposite the
 * sword arm; its hand keeps the clip's turn on the forearm.
 */
export function freeRunArm(rig, pose, w, faceWorld) {
  const off = rig.off;
  if (!off?.upper || !off.fore || !off.hand || w <= 1e-3) return;
  frame(faceWorld);
  const side = rig.side === "R" ? -1 : 1; // the free side
  kinWrist(rig, off, pose.fth ?? 0, pose.fel ?? 0, pose.fab ?? 0, pose.finw ?? 0, side, vKin, vKinPole);
  twoBoneIK(off.upper, off.fore, off.hand, vKin, vKinPole, w);
  // (on a forearm at rest about its own line, as the sword arm's: a runner's loose fist, the palm to the body
  // and the thumb up — the clip's forearm twist left the palm facing down, a paddle)
  if (rig.offRest) untwistForearm(off, rig.offRest.fore, w, rig.offRest.upper, false);
}

/**
 * The sword hand (and the sword in it) and the free hand. `pose` is a cut or carry pose whose `a`
 * and `psiW` are world angles; `rig`: { hips, chest, arm: { upper, fore, hand }, off: { … }, grip:
 * { q, p } (the sword's rotation and position in the hand bone), height }. `wArm` blends the sword
 * arm in, `wOff` the free arm.
 */
export function applyArms(rig, pose, wArm, wOff, faceWorld) {
  const { arm, off } = rig;
  if (!arm?.upper || (wArm <= 1e-3 && wOff <= 1e-3)) return;
  frame(faceWorld);
  rig.chest.getWorldPosition(vP);
  const hipY = rig.hips.getWorldPosition(vA).y;
  const shY = arm.upper.getWorldPosition(vB).y;
  const armLen = vB.distanceTo(arm.fore.getWorldPosition(vA)) + vA.distanceTo(arm.hand.getWorldPosition(vG));
  const side = rig.side === "R" ? 1 : -1; // the sword side: −1 the hero's left
  if (wArm > 1e-3) {
    // Where the grip goes: round the chest at the hand's bearing, at its height.
    const reach = pose.reach * armLen;
    vT.set(vP.x + Math.cos(pose.psiW) * reach, hipY + pose.hh * (shY - hipY), vP.z + Math.sin(pose.psiW) * reach);
    const hang = pose.hang ?? 0;
    if (hang > 1e-3) {
      // Standing (the owner's picture, 2026-10-03): the arm hanging straight from the shoulder, tipped a
      // little forward and out, the grip at the arm's own length plus the fist's — reachable, so the
      // sword stays in the hand.
      arm.upper.getWorldPosition(vHang);
      // (leaning along the hand's own bearing round the chest, psiW: the carry turns that to keep the
      // blade on show from the camera, so the hanging hand swings round with it)
      // (and forward, the arm a little ahead of the body as a relaxed one hangs: the owner, 2026-10-03,
      // "the arms does not come enough forward")
      vHang2.set(Math.cos(pose.psiW) * HANG.lean, -1, Math.sin(pose.psiW) * HANG.lean).addScaledVector(vF, pose.hfwd ?? 0).normalize();
      vHang.addScaledVector(vHang2, armLen * HANG.len + HANG.fist * rig.height);
      vT.lerp(vHang, hang);
      // (the hanging hand swinging on as he stops, or flung by a hit: hero-life.js)
      if (rig.sway) vT.addScaledVector(rig.sway, hang);
      if (rig.swaySword) vT.addScaledVector(rig.swaySword, hang);
    }
    // The elbow: down and out; out and back with the hand overhead; down and in across the body.
    const across = smoothstep(0, 1, side * -1 * (pose.psi ?? 0));
    const high = smoothstep(0.8, 1.6, pose.hh);
    vPole.copy(vR).multiplyScalar(side * (0.7 * (1 - across) + 0.1));
    vPole.addScaledVector(vF, -0.3 * (1 - across) + 0.35 * across - 0.3 * high);
    vPole.y = -0.9 + 0.8 * high;
    vPole.normalize();
    arm.hand.getWorldScale(vA);
    const hs = vA.x;
    const hold = (pitch) => {
      // Which way the blade points, and its edge: upright in the guard, leading the sweep in a cut.
      const cp = Math.cos(pitch);
      vD.set(Math.cos(pose.a) * cp, Math.sin(pitch), Math.sin(pose.a) * cp);
      const dE = pose.dir ?? 1; // (the edge leads the way the cut sweeps: a backhand's the other way)
      vE.set(-Math.sin(pose.a) * dE, pose.tv ?? 0, Math.cos(pose.a) * dE).normalize().multiplyScalar(pose.edge).addScaledVector(UP, 1 - pose.edge);
      vE.addScaledVector(vD, -vE.dot(vD));
      if (vE.lengthSq() < 1e-6) vE.set(0, 1, 0).addScaledVector(vD, -vD.y);
      vE.normalize();
      vX.crossVectors(vE, vD);
      qS.setFromRotationMatrix(mB.makeBasis(vX, vE, vD));
      // The hand's world rotation that holds the sword so, and the wrist that puts the grip there.
      qH.copy(qS).multiply(qA.copy(rig.grip.q).invert());
      vB.copy(rig.grip.p).multiplyScalar(hs).applyQuaternion(qH);
      vG.subVectors(vT, vB);
      // (hanging, the wrist where it hung with the grip on the socket, before it was seated in the fist (hero3d.js GRIP_FIT):
      // the owner's standing pose kept)
      const kin = pose.kin ?? 0;
      const hangW = (pose.hang ?? 0) * (1 - kin);
      if (hangW > 1e-3 && rig.grip.seat) vG.addScaledVector(vWrist.copy(rig.grip.seat).multiplyScalar(hs).applyQuaternion(qH), hangW);
      const soft = pose.soft ?? 0;
      // (standing and walking: the wrist kept inside the arm's full stretch, so the elbow keeps a relaxed
      // bend; the grip comes with it, so the sword stays in the fist. Eased in over the first 0.15 of
      // `soft`, not switched: all-or-nothing, a stop from a run moved the hilt 0.78 units in one frame.)
      // (over the whole of it, not its first 0.15: a cut's wind-up blends `soft` out of the carry, and played slowly —
      // the owner's video's tempo, 2026-10-07 — the hand lurched as the clamp let go in the blend's last stretch)
      const ks = smoothstep(0, 1, soft);
      if (ks > 1e-3) {
        arm.upper.getWorldPosition(vSoft);
        const most = armLen * (1 - (1 - SOFT_REACH) * soft);
        if (vG.distanceTo(vSoft) > most) vG.lerp(vWrist.copy(vG).sub(vSoft).setLength(most).add(vSoft), ks);
      }
      // Moving (`kin`): the wrist where the arm's own angles put it (CARRY_ARM: the upper arm swung from
      // the shoulder, the elbow bent), always within reach; the elbow bends toward where those angles put
      // it. Blended from the hanging wrist as clamped above (from the unclamped one the elbow stayed at the
      // soft stretch through half of every start and stop). The hanging hand's sway (a stop's swing-on, a
      // hit's fling) rides on it as on the hang.
      if (kin > 1e-3) {
        kinWrist(rig, arm, pose.th ?? 0, pose.el ?? 0, pose.ab ?? 0, pose.inw ?? 0, side, vKin, vKinPole);
        const hang = pose.hang ?? 0;
        if (rig.sway) vKin.addScaledVector(rig.sway, hang);
        if (rig.swaySword) vKin.addScaledVector(rig.swaySword, hang);
        vG.lerp(vKin, kin);
        vPole.lerp(vKinPole, kin).normalize();
        // (and the sway's overreach kept inside the soft stretch too: eased in over a knee, not cut — the stand's
        // straight arm is held by it and the walk's is not, and a hard limit kinked the elbow 0.9 u/frame² as a
        // start or a stop crossed it)
        if (ks > 1e-3) {
          const most = armLen * (1 - (1 - SOFT_REACH) * soft);
          const knee = SOFT_KNEE * armLen;
          const r = vG.distanceTo(vSoft);
          if (r > most - knee) vG.lerp(vWrist.copy(vG).sub(vSoft).setLength(most - knee * Math.exp(-(r - most + knee) / knee)).add(vSoft), ks);
        }
      }
      if (ks > 1e-3 || kin > 1e-3) vT.addVectors(vG, vB);
      if (soft < 1 - 1e-3) reachShoulder(arm, vG, armLen, wArm * (1 - soft));
      // (standing, the elbow swung round only as far as the wrist needs: hangSwivel; only with the carry all but
      // wholly on — part-blended with a swing clip's arm, the swung pole straightened the elbow, 7°)
      const swv = (pose.hang ?? 0) * (1 - kin) * smoothstep(0.8, 1, wArm);
      if (swv > 1e-3 && rig.handRest) {
        vSwE.copy(arm.hand.position).normalize().applyQuaternion(qSw.copy(qH).multiply(qSw2.copy(rig.handRest).invert()));
        arm.upper.getWorldPosition(vSwS);
        const k = hangSwivel(arm, vSwS, vG, vPole, vSwE) * swv;
        if (k > 1e-4) vPole.lerp(vSwT, k).normalize();
      }
      twoBoneIK(arm.upper, arm.fore, arm.hand, vG, vPole, wArm);
      setWorldQuaternion(arm.hand, qH, wArm);
      // (moving, the forearm's own twist from the clip taken off first: the roll that turns the blade out
      // is then counted from a forearm at rest, as a real one is, its ±ROLL_MAX from there)
      if (kin > 1e-3 && rig.foreRest) untwistForearm(arm, rig.foreRest, wArm * kin, rig.upperRest);
      if (rig.handRest) forearmRoll(arm, rig.handRest, wArm);
      // (the bend left at the wrist kept to what a wrist can do: the blade gives way, in the carry only —
      // a cut's blade is the hitbox's; the grip stays in the fist, where the hand put it)
      // (only on a carry's own arm, kin: blended into a cut's wind-up, where the blade swings far round from
      // the forearm, the limiter's turn about the hand's line wrapped past half a turn and flipped the hand —
      // the tip jumped 5 units in 1/240 s. Faded out while the blade is still near the carry's.)
      const wlimP = (pose.wlim ?? 0) * smoothstep(0.4, 1, kin);
      const wlim = wlimP * wArm;
      if (wlim > 1e-3 && rig.handRest) {
        limitWrist(arm, rig.handRest, wlim, side);
        vWrist.copy(rig.grip.p).applyMatrix4(arm.hand.matrixWorld);
        vT.lerp(vWrist, Math.min(1, wlimP));
        // (walking, the blade no higher than WALK_PITCH_MAX: the whole arm turned back at the shoulder by the
        // excess, so it swings a little less far forward just where the straight wrist would tip the blade up)
        const capW = Math.min(1, pose.wcap ?? 0) * Math.min(1, wlim);
        if (capW > 1e-3) {
          vCapD.set(0, 0, 1).applyQuaternion(arm.hand.getWorldQuaternion(qCap).multiply(rig.grip.q));
          const ex = Math.asin(Math.max(-1, Math.min(1, vCapD.y))) - WALK_PITCH_MAX;
          if (ex > 0 && vCapD.x * vCapD.x + vCapD.z * vCapD.z > 1e-6) {
            vCapK.set(vCapD.x, 0, vCapD.z).normalize().cross(UP).normalize();
            turnWorld(arm.upper, qCap.setFromAxisAngle(vCapK, -ex * capW));
            vWrist.copy(rig.grip.p).applyMatrix4(arm.hand.matrixWorld);
            vT.lerp(vWrist, Math.min(1, wlimP));
          }
        }
      }
    };
    const ground = pose.ground ?? 0;
    if (ground > 1e-3) {
      // The heavy's tip into the grass: the rise worked out again from where the arm actually put
      // the grip (a grip out of reach stops short, higher), from the arm's own pose each time.
      const bonesA = [arm.upper, arm.fore, arm.hand, arm.shoulder].filter(Boolean);
      bonesA.forEach((b, i) => qArm[i].copy(b.quaternion));
      let pitch = pose.pitch;
      for (let pass = 0; pass < 3; pass++) {
        if (pass) {
          bonesA.forEach((b, i) => b.quaternion.copy(qArm[i]));
          (arm.shoulder || arm.upper).updateMatrixWorld(true);
        }
        hold(pitch);
        const gy = arm.hand.getWorldPosition(vA).add(vB).y;
        // (Never quite straight down, where the blade would lose its yaw: a grip too high for that
        // is brought down as far as it lacks, the arm reaching lower.)
        const drop = (gy + GROUND_DEPTH * rig.height) / ((rig.tipH ?? FIG.tip) * rig.height);
        const want = -Math.min(GROUND_STEEPEST, Math.asin(Math.min(1, Math.max(-1, drop))));
        pitch = lerp(pose.pitch, want, ground);
        vT.y -= Math.max(0, gy + GROUND_DEPTH * rig.height - (rig.tipH ?? FIG.tip) * rig.height * Math.sin(GROUND_STEEPEST)) * ground;
      }
    } else hold(pose.pitch);
    // (where the pose wanted the grip, for the hand's grip slide: hero3d.js)
    (rig.gripGoal ??= new Vector3()).copy(vT);
    rig.gripGoalW = wArm;
  } else rig.gripGoalW = 0;
  if (off?.upper && wOff > 1e-3) {
    // The free hand: forward in balance (0), hanging at the hip (0.6), pulled back after a cut (1).
    const o = pose.off;
    // (hanging at 0.6: by his side, a little in front of his hip, not tucked against his belly)
    // (out clear of his hip and thigh plates: at 0.46 the hand sank into his side)
    // (hanging: beside the thigh below the belt, a touch forward — the owner's picture, 2026-10-03)
    const fwd = o < 0.6 ? lerp(0.5, 0.3, o / 0.6) : lerp(0.3, -0.15, (o - 0.6) / 0.4);
    const out = o < 0.6 ? lerp(0.3, 0.88, o / 0.6) : lerp(0.88, 0.6, (o - 0.6) / 0.4);
    const up = o < 0.6 ? lerp(0.6, -0.42, o / 0.6) : lerp(-0.42, 0.05, (o - 0.6) / 0.4);
    vG.copy(vP).addScaledVector(vF, fwd * armLen).addScaledVector(vR, -side * out * armLen);
    vG.y = hipY + up * (shY - hipY);
    off.upper.getWorldPosition(vSoft);
    const offLen = vSoft.distanceTo(off.fore.getWorldPosition(vA)) + vA.distanceTo(off.hand.getWorldPosition(vB));
    // Standing (`hang`), the free arm hangs as the sword arm does: straight down from the shoulder, a
    // little out and forward, the hand beside the thigh (the owner, 2026-10-03: "his right hand is
    // still in a dumb position while standing still" — aimed at a point by the hip, the forearm angled
    // in and the hand sat in front of the belt pouch, cocked in at the wrist).
    const hangOff = pose.hang ?? 0;
    if (hangOff > 1e-3) {
      vHang2.copy(vR).multiplyScalar(-side * HANG_FREE.out).addScaledVector(vF, HANG_FREE.fwd);
      vHang2.y = -1;
      vHang.copy(vSoft).addScaledVector(vHang2.normalize(), offLen * HANG_FREE.reach);
      vG.lerp(vHang, hangOff);
    }
    if (rig.sway) vG.add(rig.sway);
    if (rig.swayFree) vG.addScaledVector(rig.swayFree, hangOff);
    // (never at full stretch: the free arm's elbow keeps a relaxed bend too)
    const reachMax = offLen * lerp(SOFT_REACH, HANG_FREE.reach, hangOff);
    if (vG.distanceTo(vSoft) > reachMax) vG.sub(vSoft).setLength(reachMax).add(vSoft);
    // (the elbow out and down; hanging, behind, as a relaxed arm's is — out, it winged the forearm in)
    vPole.copy(vR).multiplyScalar(-side * lerp(0.6, 0.15, hangOff)).addScaledVector(vF, lerp(-0.2, -0.8, hangOff));
    vPole.y = lerp(-0.8, -0.4, hangOff);
    twoBoneIK(off.upper, off.fore, off.hand, vG, vPole.normalize(), wOff);
  }
}

/**
 * A world pose (toWorld's form) for a weapon as it is drawn: its grip at `grip` and its length along `dir` (world), the
 * hero standing at `root` (world), `height` tall — the blade's yaw and rise, the hand's bearing, height and reach as
 * handAt counts them; the other channels from `pose`. So a cut starting from a carry posed some other way (the shoulder
 * carry, by IK on his bones) starts from where the weapon is, not from the channels' own carry (hero3d.js).
 */
export function poseOfDrawn(pose, grip, dir, root, height) {
  const dx = (grip.x - root.x) / height, dz = (grip.z - root.z) / height;
  return {
    ...pose,
    a: Math.atan2(dir.z, dir.x),
    pitch: Math.asin(Math.max(-1, Math.min(1, dir.y))),
    psiW: Math.atan2(dz, dx),
    reach: Math.hypot(dx, dz) / FIG.arm,
    hh: (grip.y / height - FIG.hip) / (FIG.shoulder - FIG.hip),
  };
}
/** A pose's r and psi as world angles (a, psiW), for `face`. */
export function toWorld(pose, face) {
  return { ...pose, a: face + pose.r, psiW: face + pose.psi };
}

/** Two world poses blended (the angles the short way round). */
export function blendWorld(a, b, u, front = null) {
  const out = mixPose(a, b, u);
  // (the short way round; or, given his facing `front`, the way round in front of him: from out at one side over to
  // behind the other shoulder the short way passes straight back through him)
  if (front == null) {
    out.a = a.a + wrapAngle(b.a - a.a) * u;
    out.psiW = a.psiW + wrapAngle(b.psiW - a.psiW) * u;
  } else {
    out.a = front + lerp(wrapAngle(a.a - front), wrapAngle(b.a - front), u);
    out.psiW = front + lerp(wrapAngle(a.psiW - front), wrapAngle(b.psiW - front), u);
  }
  out.tv = lerp(a.tv ?? 0, b.tv ?? 0, u);
  return out;
}

/** A world pose seen from a (new) facing: its r and psi from `face`. */
export function fromWorld(pose, face) {
  return { ...pose, r: wrapAngle(pose.a - face), psi: wrapAngle(pose.psiW - face) };
}

/**
 * Inertialization for a cut's pose (as blend.js does for the bones): when the pose it is given
 * jumps — a next swing buffered halfway through a recovery that was heading for the guard — the
 * jump is kept as an offset that halves every `halfLife` seconds of sim-view time, so the sword
 * goes on from where it is shown. `apply(pose, jumped, halfLife, dt)` returns the pose to show.
 */
export function makePoseBlend() {
  let shown = null;
  let off = null;
  let age = 0;
  let half = 0.04;
  let last = null, last2 = null; // (the last two poses asked for)
  return {
    apply(pose, jumped, halfLife, dt) {
      if (jumped && shown) {
        // (only the channels both have: a cut that leaves one out — every weapon's template leaves out a dozen —
        // made `undefined − undefined`, NaN, and a press buffered in a recovery spread it through the hips, the
        // springs and the cape for good: the hero's torso and arms vanished after a few chained swings)
        // From where the old pose would be this frame — its last move carried on — not from where it was shown last
        // frame: from that, the blade stood still for a frame at every press buffered in a recovery (63 → 1 → 65 u/s).
        const fOld = off ? Math.pow(2, -(age + dt) / half) : 0;
        const next = {};
        for (const c of CHANNELS) {
          const a = last?.[c], b = last2?.[c];
          const pred = Number.isFinite(a) ? (Number.isFinite(b) ? 2 * a - b : a) : NaN;
          next[c] = Number.isFinite(pred) && Number.isFinite(pose[c]) ? pred + (off?.[c] ?? 0) * fOld - pose[c] : 0;
        }
        off = next;
        age = 0;
        half = Math.max(1e-3, halfLife);
      } else age += dt;
      last2 = last;
      last = pose;
      const f = off ? Math.pow(2, -age / half) : 0;
      if (f < 1e-3) off = null;
      const out = { ...pose };
      if (off) for (const c of CHANNELS) if (off[c] && Number.isFinite(out[c])) out[c] += off[c] * f;
      if (off && Number.isFinite(out.a) && Number.isFinite(pose.r)) out.a = out.a - pose.r + out.r;
      shown = out;
      return out;
    },
    reset() {
      shown = off = last = last2 = null;
    },
  };
}
