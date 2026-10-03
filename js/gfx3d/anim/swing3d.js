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
import { Vector3, Quaternion, Matrix4 } from "../three-lib.js?v=8898846";
import { PLAYER } from "../../config.js?v=8898846";
import { RIGHT as CAM_RIGHT, UP as CAM_UP, BACK as CAM_BACK } from "../camera3d.js?v=8898846";
import { wrapAngle, smoothstep } from "./procedural.js?v=8898846";
import { turnWorld, setWorldQuaternion, twoBoneIK } from "./ik.js?v=8898846";

const CHANNELS = ["r", "pitch", "psi", "hh", "reach", "shift", "dip", "lean", "roll", "off", "edge", "ground", "twist", "hang", "soft", "hfwd"];

/**
 * The guard (V50, the target image): the sword hand low at the left hip, a little in front; the
 * blade ahead and raised 20°, turned out to the sword side as the target holds it, so it shows past
 * the body from behind (the view of most of a fight) as well as from in front.
 */
export const GUARD = Object.freeze({ r: -0.75, pitch: 0.35, psi: -1.1, hh: 0.08, reach: 0.55, shift: 0, dip: 0, lean: 0, roll: 0, off: 0.6, edge: 0, ground: 0, twist: 0, hang: 0, soft: 0, hfwd: 0 });

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
/** The follow-through's share of the recovery; with a next cut buffered, how long it is held, and how far the sword then goes into the next cut's coil. */
export const FOLLOW = 0.35;
export const HOLD = 0.36;
export const READY = 0.6;
/** The wind-up's draw-back never turns the blade faster than this share of the cut's own speed (windPlan). */
export const WIND_MAX = 0.92;

const lerp = (a, b, u) => a + (b - a) * u;
/** Channel by channel, `a` towards `b` by `u` (a new object). */
export function mixPose(a, b, u) {
  const out = {};
  for (const c of CHANNELS) out[c] = lerp(a[c] ?? GUARD[c], b[c] ?? GUARD[c], u);
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
    pose.pitch += bump * Math.max(0, 1.3 - Math.max(a.pitch ?? 0, b.pitch));
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
  const u = Math.min(1, Math.max(0, (wrapAngle(TOWARD - face) + half) / key.c.arc));
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
function liveLiftsFor(step, key, face) {
  const id = `${step}:${face}`;
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
  const turn = Math.min(1, Math.max(0, (psi - HEAVY_END.square) / (L1.psi - HEAVY_END.square)));
  // As the live window will show them: the hand out past the body wherever it would be behind it.
  // (...and reaches out further, the arm straight, so the blade lands clear of the body.)
  const out = (1 - turn) * HEAVY_END.outReach;
  const q = viewLift({ ...L1, psi, hh, twist: L1.twist * turn, reach: L1.reach + out }, face, 0, 1);
  q.pitch = groundPitch(q, face);
  // (The bite sinks the hand as designed out at his right; kept on the sword side, driven down
  // steeply, it holds it where it is, the blade as steep.)
  const f = viewLift({ ...F, r: fr, psi: psi + HEAVY_END.follow, hh: hh + (F.hh - L1.hh) * turn, twist: F.twist * turn, reach: F.reach + (L1.reach - F.reach) * (1 - turn) + out }, face, 0, hand);
  f.pitch = groundPitch(f, face);
  return [q, f, out];
}
/** Its share on screen, with a margin: a drawn arm puts the hand up to a twentieth of his height nearer his middle than handAt's (the painted hero and the mannequin, measured), and a blade just clear of the cape would go behind it — the mean of the two. */
const showsSure = (x, face) => 0.5 * (bladeShows(x, face, HEAVY_END.widen) + bladeShows({ ...x, reach: x.reach - HEAVY_END.margin }, face, HEAVY_END.widen));
function heavyEnd(L1, F, face) {
  const id = `${face}`;
  let got = heavyEnds.get(id);
  if (got) return got;
  if (heavyEnds.size > 96) heavyEnds.clear();
  const [p0, p1] = HEAVY_END.psi;
  const [h0, h1] = HEAVY_END.hh;
  for (let i = 0; i <= 29; i++) {
    const psi = p0 + ((p1 - p0) * i) / 29;
    for (let j = 0; j <= 14; j++) {
      const hh = h0 + ((h1 - h0) * j) / 14;
      // The impact must show: the slam is seen landing.
      const [q, , out] = heavyGround(L1, F, psi, hh, face);
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
        if (!got || score > got.score) got = { score, psi, hh, pitch: q.pitch, twist: q.twist, out, stop };
      }
    }
  }
  // Then the bite: the hilt levered round, the tip still in the grass, as far back from the arc's
  // end towards the sword side as it takes to show (the slam's yaw is only the sim's through the
  // live window; after it, driven on out at his right seen from behind, it went behind the cape).
  const turn = got.twist / (L1.twist || 1);
  let best = null;
  for (let i = 0; i <= 16; i++) {
    const fr = got.stop - (HEAVY_END.lever * i) / 16;
    const [, f] = heavyGround(L1, F, got.psi, got.hh, face, fr);
    if (f.pitch < -HEAVY_END.steep) continue;
    // (Kept on the sword side, it is levered well round, towards the next cut's coil there; out at
    // his right as designed, only as far as it takes to show.)
    const aim = turn >= 1 ? got.stop : L1.r - HEAVY_END.leverAim;
    const score = 10 * Math.min(HEAVY_END.show, showsSure(f, face)) - HEAVY_END.leverCost * Math.abs(fr - aim);
    if (!best || score > best.score) best = { score, r: fr, pitch: f.pitch };
  }
  const r = best ? best.r : got.stop;
  const pitch = best ? best.pitch : got.pitch;
  got.F = { r, pitch, psi: got.psi + HEAVY_END.follow, hh: got.hh + (F.hh - L1.hh) * turn, twist: F.twist * turn, reach: F.reach + (L1.reach - F.reach) * (1 - turn) + got.out };
  got.reach = L1.reach + got.out;
  heavyEnds.set(id, got);
  return got;
}

/** A cut's four keys with their yaw filled in from the arc, and the live speeds (the heavy's end for facing `face`: heavyEnd). */
function keysOf(step, face = null) {
  const c = PLAYER.combo[step] || PLAYER.combo[0];
  const k = CUTS[Math.min(CUTS.length - 1, Math.max(0, step))];
  const half = c.arc / 2;
  const v = c.arc / c.active; // the live yaw speed, rad/s
  const L0 = { ...k.L0, r: -half };
  const L1 = { ...k.L1, r: half };
  // The follow-through leaves at the live speed and slows to a stop (1 − (1 − u)ⁿ starts at n×;
  // the heavy's blade bites into the ground and stops sooner, and stays in it: heavyEnd).
  const tf = (k.follow ?? FOLLOW) * c.recover;
  const n = k.bite ?? 3;
  let Fr = half + (v * tf) / n;
  let Fe = null;
  if (k.late && face != null) {
    const e = heavyEnd(L1, { ...k.F, r: Fr }, face);
    Object.assign(L1, { psi: e.psi, hh: e.hh, pitch: e.pitch, twist: e.twist, reach: e.reach });
    Fe = e.F;
    Fr = e.stop; // (where the blade stops in the ground, levered round from there to F.r)
  }
  const pv = (L1.psi - L0.psi) / c.active;
  const F = { ...k.F, r: Fr, psi: L1.psi + Math.min(0.6, (pv * tf) / n), ...Fe };
  const C = { ...k.C, r: -half + k.C.r };
  return { step, c, k, C, L0, L1, F, v, pv, n, Fr };
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
  const depth = L0.r - C.r; // the coil's depth past the arc's start, as designed
  const { k0 } = liveLiftsFor(key.step, key, face);
  const at = (T2) => {
    // The release goes from rest onto the live speed: a coil between a third and two thirds of
    // v·T2 behind the arc's start keeps its speed rising all the way (a Hermite, 0 to v). A shorter
    // release starts from a coil that much nearer the arc's start in every channel (the blade's
    // rise too), so it never turns the blade faster than the designed one.
    const f = T2 / T2n;
    const D = Math.min(Math.max(depth * f, (v * T2) / 3), (2 * v * T2) / 3);
    const coil = mixPose(L0, C, f);
    coil.r = L0.r - D;
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
function planFor(step, start, key, face) {
  let list = start === GUARD ? guardPlans.get(face) : startPlans.get(start);
  if (!list) {
    list = [];
    if (start !== GUARD) startPlans.set(start, list);
    else {
      if (guardPlans.size > 64) guardPlans.clear();
      guardPlans.set(face, list);
    }
  }
  const got = list[step];
  if (got && got.face === face) return got;
  return (list[step] = { ...windPlan(start, key, face), face });
}

/**
 * The cut at swing time `t` (seconds since the swing began) of combo step `step`, facing `face`
 * (the sim's, world radians). `buffered`: a next swing is buffered (hold the follow-through).
 * `from`: the pose the swing starts from (the last one shown, its r and psi from this `face`), else
 * the guard; pass the same object every frame of a swing (its wind-up plan is kept with it).
 * Returns the pose, plus `a` (the blade's world yaw), `phase` and `heavy`.
 */
export function bladeAt(step, t, face, buffered = false, from = null) {
  const key = keysOf(step, face);
  const { c, k, L0, L1, F, v, pv } = key;
  const start = from || GUARD;
  const { k0, k1, kF, wF } = liveLiftsFor(step, key, face);
  const side = towardSide(key, face);
  let pose;
  let phase;
  if (t < c.wind) {
    phase = "wind";
    const { T2, C } = planFor(step, start, key, face);
    const t1 = c.wind - T2;
    if (t < t1) {
      // The draw-back: out of the start briskly, settling into the coil (anticipation).
      const u = Math.max(0, t) / t1;
      pose = travel(start, C, drawEase(u), u);
    } else {
      // The release: from the coil, accelerating, onto the arc's start at the live speed (the
      // hand where the live window has it: out past the body if it would be behind it).
      const u = (t - t1) / T2;
      const to = viewLift(towardPush({ ...L0 }, face, side), face, 0, 1, k0);
      pose = mixPose(C, to, smoothstep(0, 1, u));
      pose.r = hermite(C.r, to.r, 0, v * T2, u);
      pose.psi = hermite(C.psi, to.psi, 0, pv * T2, u);
    }
  } else if (t <= c.wind + c.active) {
    // Live: straight through, as swingArc (no easing: a cut snaps).
    phase = "live";
    const u = (t - c.wind) / c.active;
    pose = mixPose(L0, L1, u);
    pose.r = -c.arc / 2 + c.arc * u;
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
    viewLift(towardPush(pose, face, side), face, 0, 1, k0 * (1 - s) + k1 * s);
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
      const base = mixPose(L1, F, followEase(u, key.n));
      // (The heavy's yaw: carried on past the arc's end until it stops in the ground, then levered
      // back round as it bites, as far as heavyEnd turned the held pose to show.)
      if (k.late) base.r = L1.r + (key.Fr - L1.r) * followEase(u, key.n) + (F.r - key.Fr) * smoothstep(k.bitten ?? 0, 1, u);
      // (Past the camera's line of sight as the live window left it, as long as it points at it.)
      pose = viewLift(towardPush(base, face, side), face, s * wF, 1 + (COIL_OUT - 1) * s, k1 * (1 - s) + kF * s);
      // (The heavy's tip stays in the grass while the blade bites, then comes up out of it.)
      pose.ground = k.late ? 1 - s : 0;
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
        const to = viewLift(mixPose(F, keysOf((step + 1) % PLAYER.combo.length).C, READY), face, 1);
        pose = travel(held(), to, smoothstep(0, 1, u), u, face, (k.midLift ?? MID_LIFT) * Math.sin(Math.PI * u) ** 2);
      }
    } else {
      // Back to the guard (turned to show as well, less: the way back is already about as fast as
      // the cut), where the carry takes it over.
      phase = "recover";
      pose = mixPose(held(), viewLift({ ...GUARD }, face, REST_LIFT), smoothstep(0, 1, (rr - fol) / (1 - fol)));
    }
  }
  pose.a = face + pose.r;
  pose.phase = phase;
  pose.heavy = c.fx === "heavy";
  pose.tv = k.tv;
  pose.h = pose.hh; // kept for older callers: the hand's height share
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
 * behind the body (0.6 left the heavy's blade hidden for six more frames from behind and his right).
 */
export const KEYED_BACK_IN = 0.3;
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
export const KEYED_LIFT_SPAN = Object.freeze({ full: (70 * Math.PI) / 180, none: (110 * Math.PI) / 180 });
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
  const x = wrapAngle(faceWorld - AWAY);
  return x >= KEYED_BACK.from && x <= KEYED_BACK.to;
}

/**
 * How the sword is carried while standing and moving, as the hero holds it (before it is turned to
 * show, carryPose): the guard, breathing a little; moving, the sword arm swings with the stride as a
 * running arm does (the owner, 2026-10-02: held still at the hip it "looks derpy"), the elbow bent
 * and the blade held ahead and down: forward and up in front of the hip at `swing` 1, back past the
 * hip and low at −1. `move` 0..1 (from standing to moving), `phase` the stride (0..1), `t`
 * sim-view seconds; `swing` −1..1, where the sword hand is in its swing — hero3d.js passes the free
 * arm's own swing mirrored (the running clip moves the free arm), so the two arms keep time
 * opposite each other; without it, from the phase.
 */
export function carryBase(move, phase, t, swing = null, runW = 1, relax = 1) {
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
  const idle = { ...GUARD, r: -0.6 - 0.2 * relax, pitch: -0.34 + 0.14 * relax, psi: -1.19, reach: 0.6, hh: -0.16 + 0.02 * Math.sin((t * Math.PI * 2) / 2.4), hang: 1, soft: 1, hfwd: HANG.fwd * relax };
  const s = Math.max(-1, Math.min(1, swing ?? Math.sin(phase * Math.PI * 2)));
  // (The blade swings with the hand: turned in and tipped up as the hand comes forward, trailing out
  // and down as it goes back, never held still ahead like a lance. Searched against the carry's
  // checks in tools/test.mjs: at least 45% of the blade showing at every facing, 52% at worst.)
  const run = { ...GUARD, r: -0.4 + 0.5 * s, pitch: 0.2 * s, psi: -1.2 + 0.95 * s, hh: 0.26 + 0.24 * s, reach: 0.5 + 0.08 * Math.abs(s), off: 0.6 };
  // Walking (the owner, 2026-10-03: "while walking his elbows should be more relaxed and swing a little
  // bit more"; the run "looks perfect" and stays as it is): the swing a little wider, the hand a little
  // lower, and the arm never at full stretch (`soft`), so the elbow keeps a bend through the stride.
  // Mostly hanging (`hang` 0.7): above it the hand rode up by the belt and bent 42-66° at the wrist
  // to aim the blade forward ("broken"); at 0.7 the wrist keeps 28-40°, the elbow 33-44°.
  const walk = { ...GUARD, r: -0.45 + 0.55 * s, pitch: 0.15 * s - 0.08, psi: -1.18 + 1.05 * s, hh: 0.14 + 0.26 * s, reach: 0.48 + 0.06 * Math.abs(s), off: 0.6, soft: 1, hang: 0.7, hfwd: HANG.fwd * relax };
  return mixPose(idle, mixPose(walk, run, runW), move);
}

/**
 * The carry's yaw range (from the facing): always on the sword side, from trailing out behind the
 * shoulder (facing up the screen and to the right, the sword side turned away, that is where it
 * shows) to just short of straight ahead. Never across the front: a cut out of the carry would have
 * to whip the blade back round in its 0.1 s wind-up (every cut starts on the sword side).
 */
export const CARRY_R = Object.freeze([-2.1, -0.1]);
/** A carry pose turned to yaw `r`: the hand follows the blade round the hip. */
export function carryTurned(base, r) {
  return { ...base, r, psi: base.psi + (r - base.r) * 0.55, reach: base.reach + Math.max(0, base.r - r) * 0.06 };
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
 * the best of all.
 */
export function carryYaw(base, faceWorld, rNow = null) {
  const [r0, r1] = CARRY_R;
  const J = [];
  let best = 0;
  for (let i = 0; i < CARRY_STEPS; i++) {
    const r = r0 + ((r1 - r0) * i) / (CARRY_STEPS - 1);
    J.push(Math.min(SHOW_ENOUGH, bladeShows(carryTurned(base, r), faceWorld)) - TURN_COST * Math.abs(r - base.r));
    if (J[i] > J[best]) best = i;
  }
  if (rNow != null) {
    // Uphill from where the carry is: the best on its own side.
    let i = Math.round(((Math.min(r1, Math.max(r0, rNow)) - r0) / (r1 - r0)) * (CARRY_STEPS - 1));
    for (;;) {
      const up = i + 1 < CARRY_STEPS && J[i + 1] > J[i] ? i + 1 : -1;
      const down = i > 0 && J[i - 1] > J[i] ? i - 1 : -1;
      const next = up < 0 ? down : down < 0 ? up : J[up] >= J[down] ? up : down;
      if (next < 0) break;
      i = next;
    }
    if (J[i] >= J[best] - SWAP) best = i;
  }
  return r0 + ((r1 - r0) * best) / (CARRY_STEPS - 1);
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
/** The sword side: the hero is left-handed in 3D (D7), −1 his left (as `r` and `psi` count). */
const SWORD_SIDE = -1;
const SHOW_N = 16;
/** Is the point (hero-relative, in heights) behind the hero's body or hood, from the camera, or under the ground? The body's axis at (`cx`, `cz`). */
function hiddenAt(x0, y, z0, widen = 1, cx = 0, cz = 0) {
  if (y < 0) return true;
  const x = x0 - cx;
  const z = z0 - cz;
  const [bx, by, bz] = CAM_BACK;
  const a = bx * bx + bz * bz;
  const b = x * bx + z * bz;
  for (const [rad, y0, y1] of [
    [FIG.body * widen, 0, FIG.neck],
    [FIG.hood * widen, FIG.neck, 1],
  ]) {
    // The ray to the camera, (x, y, z) + s·BACK for s ≥ 0, through the column?
    const c = x * x + z * z - rad * rad;
    const disc = b * b - a * c;
    if (disc < 0) continue;
    const q = Math.sqrt(disc);
    const s0 = Math.max(0, (-b - q) / a, (y0 - y) / by);
    const s1 = Math.min((-b + q) / a, (y1 - y) / by);
    if (s1 > s0) return true;
  }
  return false;
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
export function handAt(pose, faceWorld) {
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
  return [hx, hy, hz];
}

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
  const [hx, hy, hz] = handAt(pose, faceWorld);
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
  const twist = twistOf(pose, face, faceWorld) * weight;
  turnWorld(rig.hips, qA.setFromAxisAngle(UP, -twist * 0.3));
  // The chest: the rest of the twist, the lean and the side bend, over the spine.
  const share = [0.3, 0.35, 0.35];
  rig.spine.forEach((b, i) => {
    const k = share[i] ?? 1 / rig.spine.length;
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
 * The sword hand (and the sword in it) and the free hand. `pose` is a cut or carry pose whose `a`
 * and `psiW` are world angles; `rig`: { hips, chest, arm: { upper, fore, hand }, off: { … }, grip:
 * { q, p } (the sword's rotation and position in the hand bone), height }. `wArm` blends the sword
 * arm in, `wOff` the free arm.
 */
/** The most the shoulder (clavicle) turns forward to lend the sword arm reach. */
export const CLAVICLE_MAX = 0.35;
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
/** The standing free arm's hang: how far it leans out from the body and forward (tangents), and how much of its length it reaches (a little straighter than SOFT_REACH: at 0.97 the forearm swung 30° ahead and the hand dangled in front of the belt pouch). */
export const HANG_FREE = Object.freeze({ out: 0.24, fwd: 0.07, reach: 0.985 });
/** The most of its length a `soft` arm reaches: an elbow never locked straight ("stiff as a stick"). */
export const SOFT_REACH = 0.97;
const vSoft = new Vector3();
const vWrist = new Vector3();
const vHang = new Vector3();
const vHang2 = new Vector3();

/** The most of the hand's turn about its own long axis the forearm takes over (radians: 50°). */
export const ROLL_MAX = 0.87;
const qRoll = new Quaternion();
const qRollT = new Quaternion();
const qRollI = new Quaternion();
/**
 * A turn of the hand about its own long axis is the forearm's (the radius rolling over the ulna), not the
 * wrist's: that part of the hand's turn from rest goes to the forearm, up to ROLL_MAX, and the hand
 * keeps the rest, so the hand ends where it was and only the bend is left at the wrist. (Aiming the
 * sword turned the hand 41° from the forearm while standing — "it looks like he has broken his hand",
 * the owner, 2026-10-03; 32° of it was this roll.) The hand's long axis is its own +Y.
 */
function forearmRoll(arm, rest, w) {
  qRoll.copy(rest).invert().multiply(arm.hand.quaternion); // the wrist's turn from rest, in the hand's rest frame
  let a = 2 * Math.atan2(qRoll.y, qRoll.w);
  a = wrapAngle(a);
  a = Math.max(-ROLL_MAX, Math.min(ROLL_MAX, a)) * w;
  if (Math.abs(a) < 1e-4) return;
  qRoll.setFromAxisAngle(Y_AXIS, a);
  qRollT.copy(rest).multiply(qRoll).multiply(qRollI.copy(rest).invert()); // the same turn, in the forearm's frame
  arm.fore.quaternion.multiply(qRollT);
  arm.hand.quaternion.premultiply(qRollI.copy(qRollT).invert());
  arm.fore.updateMatrixWorld(true);
}
const Y_AXIS = new Vector3(0, 1, 0);

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
      vE.set(-Math.sin(pose.a), pose.tv ?? 0, Math.cos(pose.a)).normalize().multiplyScalar(pose.edge).addScaledVector(UP, 1 - pose.edge);
      vE.addScaledVector(vD, -vE.dot(vD));
      if (vE.lengthSq() < 1e-6) vE.set(0, 1, 0).addScaledVector(vD, -vD.y);
      vE.normalize();
      vX.crossVectors(vE, vD);
      qS.setFromRotationMatrix(mB.makeBasis(vX, vE, vD));
      // The hand's world rotation that holds the sword so, and the wrist that puts the grip there.
      qH.copy(qS).multiply(qA.copy(rig.grip.q).invert());
      vB.copy(rig.grip.p).multiplyScalar(hs).applyQuaternion(qH);
      vG.subVectors(vT, vB);
      const soft = pose.soft ?? 0;
      if (soft > 1e-3) {
        // (standing and walking: the wrist kept inside the arm's full stretch, so the elbow keeps a
        // relaxed bend; the grip comes with it, so the sword stays in the fist)
        arm.upper.getWorldPosition(vSoft);
        const most = armLen * (1 - (1 - SOFT_REACH) * soft);
        if (vG.distanceTo(vSoft) > most) {
          vG.sub(vSoft).setLength(most).add(vSoft);
          vT.addVectors(vG, vB);
        }
      }
      if (soft < 1 - 1e-3) reachShoulder(arm, vG, armLen, wArm * (1 - soft));
      twoBoneIK(arm.upper, arm.fore, arm.hand, vG, vPole, wArm);
      setWorldQuaternion(arm.hand, qH, wArm);
      if (rig.handRest) forearmRoll(arm, rig.handRest, wArm);
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
        const drop = (gy + GROUND_DEPTH * rig.height) / (FIG.tip * rig.height);
        const want = -Math.min(GROUND_STEEPEST, Math.asin(Math.min(1, Math.max(-1, drop))));
        pitch = lerp(pose.pitch, want, ground);
        vT.y -= Math.max(0, gy + GROUND_DEPTH * rig.height - FIG.tip * rig.height * Math.sin(GROUND_STEEPEST)) * ground;
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

/** A pose's r and psi as world angles (a, psiW), for `face`. */
export function toWorld(pose, face) {
  return { ...pose, a: face + pose.r, psiW: face + pose.psi };
}

/** Two world poses blended (the angles the short way round). */
export function blendWorld(a, b, u) {
  const out = mixPose(a, b, u);
  out.a = a.a + wrapAngle(b.a - a.a) * u;
  out.psiW = a.psiW + wrapAngle(b.psiW - a.psiW) * u;
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
  return {
    apply(pose, jumped, halfLife, dt) {
      if (jumped && shown) {
        off = {};
        for (const c of CHANNELS) off[c] = shown[c] - pose[c];
        age = 0;
        half = Math.max(1e-3, halfLife);
      } else age += dt;
      const f = off ? Math.pow(2, -age / half) : 0;
      if (f < 1e-3) off = null;
      const out = { ...pose };
      if (off) for (const c of CHANNELS) out[c] += off[c] * f;
      if (off) out.a = out.a - pose.r + out.r;
      shown = out;
      return out;
    },
    reset() {
      shown = off = null;
    },
  };
}
