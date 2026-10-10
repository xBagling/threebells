// The hero in 3D (docs/3D-PLAN.md 7.3): a skinned model posed every frame from the sim, never
// played on a timer. The painted hero (public/art3d/hero.gltf) when it is there, else the free
// Quaternius mannequin (CC0, public/art3d/dev/) on the same kind of skeleton.
//
// Per frame: the picker (anim/hero-anim3d.js) turns the in-between sim state into clip layers; the
// sampler poses the skeleton; inertialization smooths any change of clip; then the body turns
// towards where it should face through a damper (never a snap), leans into acceleration and curves
// on a spring, and squashes on landings and hits. On top of the clips (anim/swing3d.js): a cut is
// posed from the sim's own swing clock — the weight, the twist, the sword arm and the free arm —
// over the planted feet; standing and moving, the sword is carried at the hip in front, the blade
// along the facing (V50), turned out or in on the sword side as far as it takes to show past the
// body from the camera. In a roll, a hurt, the death and the win the clip's own arm holds it.
import { Group, SkinnedMesh, SkeletonUtils, Quaternion, Vector3, Matrix4 } from "./three-lib.js?v=df092a6";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=df092a6";
import { makeSampler } from "./anim/sampler.js?v=df092a6";
import { makeInertializer } from "./anim/blend.js?v=df092a6";
import { makeHeroRecord, heroAnimState, gaitAt, WALK_CYCLE, RUN_PHASE, JUMP_LOAD } from "./anim/hero-anim3d.js?v=df092a6";
import { makeHeroStride, soleContacts } from "./anim/stride.js?v=df092a6";
import { makeHeroLife } from "./anim/hero-life.js?v=df092a6";
import { makeCloth } from "./anim/cloth.js?v=df092a6";
import { makeCape } from "./cape3d.js?v=df092a6";
import { twoBoneIK, setWorldQuaternion, turnWorld } from "./anim/ik.js?v=df092a6";
import { fitBodySkin, makeBodyProxy, weaponSamples } from "./anim/bodyproxy.js?v=df092a6";
import { handAt, reachShoulder, bladeAt, poseOfDrawn, carryPose, carryBase, carryYaw, carryTurned, applyCutBody, applyCarryStance, CARRY_STANCE, SWORD_STANCE, applyArms, toWorld, fromWorld, blendWorld, makePoseBlend, keyedCarryW, keyedBackLift, viewLift, KEYED_FOLLOW, keyedBack, freeRunArm, carryAsDrawn, forearmRoll, CARRY_R } from "./anim/swing3d.js?v=df092a6";
import { makeSword } from "./sword3d.js?v=df092a6";
import { SWORD_BAKE } from "./anim/sword-bake.js?v=df092a6";
import { JUMP_BAKE } from "./anim/jump-bake.js?v=df092a6";
import { makeWeapon, depthBelow } from "./weapons3d.js?v=df092a6";
import { WEAPONS } from "../content/weapons.js?v=df092a6";
import { smoothNormals } from "./smooth3d.js?v=df092a6";
import { mirrorClips } from "./anim/mirror.js?v=df092a6";
import { bench, makeHold } from "./anim/hold.js?v=df092a6";
import { dampAngle, springCritical, springStep, wrapAngle, smoothstep } from "./anim/procedural.js?v=df092a6";
import { PLAYER, FORE } from "../config.js?v=df092a6";
import { STATE, moveOf } from "../sim/player.js?v=df092a6";

export const HERO_H = 19.6;
/** How much deeper the outline hull is drawn than the body (polygon offset; see the hull below). */
export const HULL_OFFSET = Object.freeze({ factor: 10, units: 40 });
/** The painted hero's normals relaxed this much at load (smooth3d.js). */
const HERO_SMOOTH = Object.freeze({ passes: 4, amount: 0.6 });
/** Geometries already smoothed (clones share their asset's geometry). */
const smoothed = new WeakSet();

/** GLTFLoader drops "." and other reserved characters from node names ("DEF-hand.R" → "DEF-handR"). */
const clean = (n) => n.replace(/[\s[\].:/]/g, "");
const isBone = (o, n) => o.isBone && (o.name === n || o.name === clean(n));

// The sword is in the hand config.js PLAYER.swordHand names — the right (the owner, 2026-10-07: "update it fully so
// that the main hand is the right hand"; the left from 2026-09-30, D7). The library's clips and the painted hero's
// file are stored right-handed (50_rig_hero.py bakes hero_clips.py's left-handed poses mirrored), so they play as
// stored; with the sword in the left hand they were played mirrored (anim/mirror.js). Every cut stays a forehand:
// the sim's arcs sweep the sword hand's way (config.js FORE).

/** The mannequin's clips, by our names (the painted hero's file will use our names directly). */
const MANNEQUIN = {
  height: 1.829,
  yaw: 0, // its front, turned onto +Z
  names: { idle: "Sword_Idle", walk: "Walk_Loop", run: "Jog_Fwd_Loop", roll: "Roll", swing1: "Sword_Attack", swing2: "Sword_Attack", swing3: "Sword_Attack", hurt: "Hit_Chest", death: "Death01", victory: "Idle_Loop" },
  hand: `DEF-hand.${PLAYER.swordHand}`,
  mirror: PLAYER.swordHand !== "R", // (the library is right-handed)
  colors: { M_Main: 0x2a6a66, M_Joints: 0x23262c },
};

/** The painted hero (tools/3d/blender/50_rig_hero.py): clips named by the game's contract, its own texture. */
const PAINTED = {
  height: null, // measured
  yaw: 0,
  names: { idle: "idle", walk: "walk", run: "run", roll: "roll", swing1: "swing1", swing2: "swing2", swing3: "swing3", swing1b: "swing1b", swing2b: "swing2b", swing3b: "swing3b", hurt: "hurt", death: "death", victory: "victory" },
  hand: `DEF-hand.${PLAYER.swordHand}`,
  mirror: PLAYER.swordHand !== "R", // its clips are stored right-handed, as the library's
  colors: {},
  // Its swings are keyed to the sim's own timing (50_rig_hero.py, hero_clips.py: each swing's wind-up,
  // live window and recovery are PLAYER.combo's, the blade on swingArc's sweep through the live
  // window), so the fight plays them — on the picker's time warp, onto marks that are the sim's own
  // times — instead of posing swing3d.js's cut over the idle. (The mannequin's library Sword_Attack
  // is a ground slam: it keeps swing3d.js.) Each swing's end is keyed twice, swingN and swingNb,
  // blended by where the camera stands (keyedLayers).
  keyedCuts: true,
};

/**
 * The character light (materials3d.js, PAINT_CHAR): the hero's side towards the camera gets no sun
 * (it stands behind the fight), so a warm fill from the camera's side keeps his paint readable, as
 * the target shows him; the rim on his sun side is a soft warm light, not a gilt line. The light
 * reaches his paint mostly grey (tint: that much of its own colour) and on a knee to at most max×
 * the paint, so the lit steel stays steel grey and the teal hood and cape stay teal (the target's
 * muted teal on the side the camera sees, about half the paint's light). His colour muted to 0.9 of
 * the paint's (sat): at 1 the hood and cape read an emerald teal (hue ~164°, saturation ~0.9 on the
 * game's frames), the target's a greyer teal (176°, 0.68); at 0.9 they measure 0.65 (0.8 went to
 * 0.49, grey) — the fourth review's hood question. The hue is the owner's texture B's own and stays.
 */
// (The G8 re-review: at 0.8 the fill left him a small dark teal blob at the game camera, where the
// target shows him lit and readable; 1.35 brings the camera side up to about three quarters of the
// paint, the knee (max) a little higher so the lit side keeps its form.)
export const HERO_LIGHT = { fill: 0xffe4c4, fillAmt: 1.35, rim: 0xffd98a, rimAmt: 0.5, max: 1.2, tint: 0.15, sat: 0.9 };

/** The world centre (rest pose) of the vertices `bone` carries at least half of, or null. */
function fistCentre(skinned, bone) {
  const sum = new Vector3();
  const v = new Vector3();
  let n = 0;
  for (const m of skinned) {
    const k = m.skeleton.bones.indexOf(bone);
    if (k < 0) continue;
    const pos = m.geometry.attributes.position;
    const si = m.geometry.attributes.skinIndex;
    const sw = m.geometry.attributes.skinWeight;
    if (!pos || !si || !sw) continue;
    m.updateMatrixWorld(true);
    m.skeleton.update();
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === k) w += sw.getComponent(i, c);
      if (w < 0.5) continue;
      m.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(m.matrixWorld); // (the skinned position, as drawn)
      sum.add(v);
      n++;
    }
  }
  return n >= 8 ? sum.multiplyScalar(1 / n) : null;
}

/** A character's light on its paint material (materials3d.js PAINT_CHAR): fill, rim and the knee. */
export function charLight(m, L) {
  const p = m.userData.paint;
  p.uFill.value.setHex(L.fill).multiplyScalar(L.fillAmt);
  p.uRimCol.value.setHex(L.rim);
  p.uRimAmt.value = L.rimAmt;
  m.defines.PAINT_CHAR_MAX = L.max.toFixed(3);
  m.defines.PAINT_CHAR_TINT = L.tint.toFixed(3);
  m.defines.PAINT_CHAR_SAT = L.sat.toFixed(3);
  if (L.pale) m.defines.PAINT_CHAR_PALE = L.pale.toFixed(3);
}

/** Each asset's clips mirrored once, not once per fight. */
const mirrored = new WeakMap();
const tipXY = new Vector3();
const clipsFor = (asset, spec) => {
  if (!spec.mirror) return asset.animations;
  let c = mirrored.get(asset);
  if (!c) mirrored.set(asset, (c = mirrorClips(asset.animations)));
  return c;
};

// The free hand walking: the palm turned toward the thigh (the knuckles' line WALK_PALM out from straight ahead) by at
// most WALK_ROLL_MAX. (Its arm is placed by its own angles, swing3d.js CARRY_ARM.walkFree.)
// (0.1: the knuckles' line by the hand's own +Z, palmToThigh; at 0.6 on the old axis the palm faced back and down)
const WALK_PALM = 0.1;
const WALK_ROLL_MAX = 0.87;
// How much of the standing free hand's bend at the wrist is taken out (the rest: a slight curl to the palm).
const FREE_STRAIGHT = 0.8;
// The lean spring (Hz, damping ratio): a little under critical, so a start's lean overshoots a touch.
const LEAN_HZ = 1.4;
// The start's and stop's lean: from the speed's change over this long (s, a low-pass half-life).
const LEAN_SLOW = 0.15;
// How much of the head's tilt to the side is taken out, standing, moving and swinging.
const HEAD_LEVEL = 0.7;
// How far (rad) the moving carry's yaw may follow the swinging hand from the side the stride's middle chose.
const YAW_SPAN = 0.5;
// Seconds into his death at which the sword falls from his hand (he is on his knees: hero_clips.py death).
const SWORD_DROP = 0.8;
const qTmp = new Quaternion();
const LEAN_ZETA = 0.62;
// A sharp reversal's hip dip (a push on the squash spring, as a landing's 1.6).
const PIVOT_DIP = 1.6;
// How far each collarbone is turned forward round the vertical (rad), in every movement.
const SHOULDER_FWD = 0.26;
// Standing (the owner's references, 2026-10-03: "the whole shoulder/arm/hands look cramped"), each collarbone
// turned to STAND_CLAV_FWD ahead of square-out instead (the idle clip held the free side's 22° ahead and the
// sword side's 6° back: with the rounding on top, the free shoulder 37° forward, narrow and hunched), and
// dropped to STAND_CLAV_ELEV below the chest's level (the clip held the free shoulder 12° higher than the sword
// side's): the shoulders down, level and wide.
// (Measured along the collarbone's line, its head to the shoulder joint. Since the joints moved into the arms
// (move_arm_joints.py) that line rises 12° and runs 8° back at bind, where it fell 10° and ran 11° forward: the
// targets keep their offsets from bind — 0.17 and −0.5 before — so the shoulders stand where the owner approved.)
const STAND_CLAV_FWD = -0.173;
const STAND_CLAV_ELEV = -0.123;
// Moving, each collarbone rounded `fwd` (not SHOULDER_FWD's 15°: on the walk and run clips' own that held them
// 15-31° forward) and dropped `drop` (rad; they rode 12° higher than standing): he walked and ran hunched.
const MOVE_CLAV = Object.freeze({ fwd: 0.08, drop: 0.2 });
// Standing, the hilt let turn this far in a loose fist (rad), the tip dropping: a hammer grip squares the blade
// to the forearm, so a hanging arm held it level and a relaxed wrist could tip it at most 25° down. The
// references' blades hang forward and down. Back to the fist's own grip as he moves or swings.
const GRIP_LOOSE = (44 * Math.PI) / 180;
const GRIP_TIME = 0.1;
const GRIP_MOVE = [(30 * Math.PI) / 180, (18 * Math.PI) / 180]; // walking, running
const GRIP_EASE = 0.35;
// Standing, the free hand's fingers this share of their relaxed curl: a loose hand, not a fist.
const FREE_OPEN = 0.6;
// Walking, the free hand's fingers this times their relaxed curl.
const WALK_CURL = 1.35;
// Moving, the free hand turned this far at the wrist (rad: walking, running; negative bends it toward the
// forearm's line), so elbow, wrist and glove make one line.
const MOVE_WRIST_UP = [(-15 * Math.PI) / 180, (-35 * Math.PI) / 180];
const vClF = new Vector3();
const vClR = new Vector3();
const qClD = new Quaternion();
/**
 * Where in the stride (phase, after the left foot's touchdown) the free hand reaches the front of its
 * swing, by speed (u/s): measured on the walk and run clips as played (phasefit.mjs). The sword arm
 * swings opposite it.
 */
const SWING_LEAD = [[9, 0.046], [18, 0.043], [25, -0.014], [35, -0.036], [47, -0.064], [60, -0.093], [75, -0.101], [94, -0.104]];
/**
 * The share of each spine bone's (and the neck's and head's) turn about its own line the run keeps. (0.2 since the
 * girdle follows the arms, GIRDLE: the collarbones swinging with them add to the shoulder line's turn — at 0.4 it
 * turned 42-47° a stride, at 0.2 28-33°, the chest ±11° on the hips.)
 */
const RUN_TWIST = 0.2;
/**
 * The share of the collarbones' own clip turn kept while moving, by the whole moving weight (walk and jog too):
 * none. The walk and run clips swing them against the arms — at a run each collarbone went back as its arm swung
 * forward (r −0.96) — and GIRDLE now moves them with the arms.
 */
const RUN_CLAV = 0;
/**
 * The shoulder girdle following its arm (the owner, 2026-10-04: "You have to improve the shoulder area, it is stiff
 * and not moving at all"). Measured on the game path, the collarbones moved 1° standing, 3-4° walking while the
 * arms swung 15-36°, ran against the arms, and stood still through swings 2-3 (the free one 0.0°): the pauldrons,
 * skinned to them, never moved. After the arms are posed each collarbone is turned by a share of its upper arm's
 * swing in the chest's frame — forward with the arm (protraction), back with it, up as it rises past `up0` and as
 * it swings back — as a real girdle gives about a third of an arm's rise (Inman) and protracts with its swing.
 * (`up0` 40°, past the standing arms' hang — 35° out since the shoulder joints moved into the arms: at 30° a
 * hanging arm's sway lifted its own shoulder against the stand's weight shift, the shoulders tipping with the hips.)
 * Shares per radian of the arm's: `fwd`, `back`, `up`, `upBack`; each part at most `max` (rad), never past
 * `cap` (rad) above the collarbone's bind elevation (the heavy's and the win's clips raise it themselves); moving
 * at most `slew` rad per 1/60 s (a hurt's first frames). The free collarbone in a swing is also drawn back by
 * `trunk` of the chest's turn on the hips toward the sword side. A pinned hand (a keyed swing, a roll, a hurt, the
 * fall, the win) keeps its place within `bend` (rad) more elbow fold and `reach` of the arm's length.
 * Tried: 0.45 back put the free elbow into the back of the belt pouch in a fifth of sprint frames; weighting the
 * pauldron to the upper arm instead stretched its rim 3-48× (.scratch/shoulder/, 2026-10-04).
 */
const DEG = Math.PI / 180;
const GIRDLE = Object.freeze({ fwd: 0.25, back: 0.3, up: 0.3, up0: 40 * DEG, upBack: 0.35, max: 20 * DEG, cap: 45 * DEG, trunk: 0.15, slew: 3 * DEG, bend: 12 * DEG, reach: 0.985 });
/**
 * How much of its upper arm's turn (from rest, in the collarbone's frame) each shoulder plate's helper bone takes
 * (DEF-pauldron.L/R, tools/3d/rig/add_pauldron_bones.py: the outer shoulder's collarbone weight moved onto it) —
 * the owner, 2026-10-04, with a blue line from the top of the plate down the outside of the upper arm: "The
 * shoulder plate should be a part of the whole shoulder". On the collarbone alone the plate stayed on the body
 * while the arm swung out from under it. Since the re-skin of 2026-10-08 (the owner: "make sure to fix it in blender",
 * the shoulders and plates crumpling and clipping in the movement test; tools/3d/rig/RESKIN-2026-10-08.md) the arms,
 * shoulders and chest carry SkinTokens' fresh weights, and the helpers get the same share back
 * (add_pauldron_bones.py --reweight): left empty, the plates rode the collarbone and the paired club's off blade
 * ran 8.7° off its arc against the body proxy (4.2° with them).
 */
const PAULDRON_FOLLOW = 0.9;
// ...up to PAULDRON_CAP[0] of the plate's own turn, then easing toward at most PAULDRON_CAP[1] (rad): an arm raised
// overhead slides up under its plate (in the heavy's wind-up and the win, followed all the way, the plate's top
// tore from the hood's shoulder cape 6-7×). Standing, walking and running stay under the first.
const PAULDRON_CAP = [(45 * Math.PI) / 180, (70 * Math.PI) / 180];
// ...and, carried (not in a cut), less of it as the arm comes up in front of him (its line's share forward of the chest,
// from `from` to `to`, the follow down by `k`): raised forward the plate's top tipped back up through the hood's shoulder
// cape — a hole there in every two-handed carry, the weapon's lower grip held out in front (173 faces inside out behind
// the shoulders, 81 now; 71 with the plates left still). Standing, walking and running stay under `from` (at most 0.53);
// in a cut it is followed in full (less, the arm slid out from under its plate: the sword's seam ×2.3 → ×3.4).
const PAULDRON_FORWARD = Object.freeze({ k: 0.7, from: 0.5, to: 0.85 });
/** The free collarbone's own fade of the shoulder block into and out of a swing (s): at the sword arm's 0.08-0.1 s it stepped 5-8° a frame as a combo started and ended. */
const FREE_FADE = 0.25;
const tw0 = new Quaternion();
const tw1 = new Quaternion();
const pA = { s: new Vector3(), e: new Vector3(), f: new Vector3(), q: new Quaternion() };
function swingLead(v) {
  const T = SWING_LEAD;
  if (v <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (v <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (v - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
}
const UP = new Vector3(0, 1, 0);
/**
 * A clip's sword arm brought to the clip's grip (holdAuthored): the most of the arm's length it reaches
 * (the elbow kept bent), how much the clip's own elbow side counts against the side the hand's line wants
 * (its pull at most this share of the hand's), and how far the grip may slide in the fist (world units:
 * along its own line, and across).
 */
const HOLD = Object.freeze({ reach: 0.985, clip: 0.15, along: 0.45, across: 0.1 });
/**
 * The sword hand's fist (degrees, the curl about each finger bone's stored axis; add_fingers.py's grip is
 * 88/44, the second knuckle half what a fist closes).
 */
const FIST = Object.freeze({ "DEF-fingers1": 80, "DEF-fingers2": 78 });
/**
 * The sword in the fist as a hammer grip (the owner, 2026-10-04: "make it look like the hand ... is actually
 * gripping around the grip shaft"; docs/HERO-HANDS.md "The grip through the fist"). In the hand bone's own frame
 * (world units; x toward the palm, y from the wrist to the knuckles, z along the knuckle row to the index):
 * the grip's line `th` degrees off the knuckle row toward the fingers (the pommel toward the heel of the hand,
 * the blade out past the index and thumb), through `at` (the grip's middle); the edge along the knuckles' line
 * (a punch's), the flat to the back of the hand. Measured (.scratch/grip): the grip as it was, taken from the
 * rest pose, ran 44° off the row through the palm by the wrist — 70 of 80 rays out from its line started inside
 * the palm's flesh, and its pommel end ran into the wrist, so the fist read as a mitten with a guard on top;
 * along this line rays out from the grip's surface meet the closed fist on every side from -0.4 to 0.2, on 9 or
 * more of 12 from -0.5 to 0.3 (under the guard, 0.4-0.5, on 4-8), the guard resting on the index, the pommel out
 * under the little finger. The glove's
 * fingers are short (0.65 against a palm 1.46 wide), so they wrap the fist's edge, not a hole round the grip.
 */
const GRIP_FIT = Object.freeze({ th: 20, at: [0.1, 0.2, 0] });
/**
 * The sword hand's thumb over the index finger, as a hammer grip closes (its turn from rest, as a quaternion in
 * its parent's frame: 45° about its root, the tip onto the curled index's back at the hand frame's 0.63, 0.13,
 * 0.69). Its stored curl (add_fingers.py, 54°) swung it out beside the guard; the worst glove edge round it 1.85×
 * there against 2.16× before.
 */
const THUMB_GRIP = Object.freeze([-0.37788, -0.02747, -0.02934, 0.92498]);
/** The free hand running: a runner's fist, closed but not clenched (degrees; at 50/60/30 it read as an open claw). */
const RUN_FIST = Object.freeze({ "DEF-fingers1": 75, "DEF-fingers2": 80, "DEF-thumb": 45 });
/**
 * The hips lead the two flat cuts (melee animation's kinetic chain, hips → chest → arm → blade: the owner, 2026-10-04,
 * "improve the sword swings to be more realistic and proper to triple aaa game logic"; docs/HERO-HANDS.md "The
 * hips lead the cut"). Measured on the game path (.scratch/grip/chain.mjs): the keyed clips turned the hips only
 * 9-16° through a cut (the chest 72-104°), so every cut was swung from the shoulders. Per cut (degrees, about the
 * vertical, in the cut's own sense): `coil` back over the first 40% of the wind-up (HIP_TURN), then already
 * turning forward — a fifth of the drive in by the release, while the chest is still wound (the hips ahead of the
 * shoulders) — and on to 85% of `drive` through the live window, fastest at its start, the rest of it over the
 * follow-through (HIP_HOLD of the recovery), back to square by HIP_BACK of it. Now the hips turn 46-52° a flat
 * cut, coiling 12-22° first, and peak with the chest or a frame before it (swing1: both at frame 8; swing2: hips,
 * chest, arm, blade at frames 31-34). The thighs take the turn back too (the feet keep the clip's). Two
 * spine bones give the turn back, so the chest, the arms and the blade are the clip's own: the hitbox is
 * untouched. Followed by a stiff spring (HIP_HZ), so a chained cut takes it over without a jump.
 */
// (The heavy keeps the clip's own hips: a cleave down into a lunge, its drive the drop, 2.5 units forward. Any turn
// of its hips swung the cape over the blade as it is drawn out of the grass — seen from 90°, 7-10 frames with under
// a tenth of the blade clear of his outline, where the check allows 6.)
const HIP_DRIVE = Object.freeze([{ coil: 14, drive: 24 }, { coil: 16, drive: 26 }, { coil: 0, drive: 0 }]);
const HIP_HZ = 14;
const HIP_HOLD = 0.2; // (of the recovery: the follow-through,
const HIP_BACK = 0.75; // and back to square by here)
const HIP_TURN = 0.4; // (of the wind-up: where the hips stop coiling and start into the cut)
/** A guard with the weapon (no shield in the off hand): the blade held up across in front of him (a cut pose's channels,
 *  swing3d.js: yaw across, rising, the hand at chest height in front, the edge out). */
// (Elden Ring's weapon guard: the blade raised upright before him, angled across, its flat to the foe, the hand forward of
// the chest; posed by the hand's place — `kin` 0 — not the carry's arm angles, which kept the hand down at his hip; the
// old pose, the blade level across his chest at r 1.25, ran 0.6-0.8 through it)
// Held in both hands, the weapon is laid across his front instead, low and well out (.scratch/weapons/guardsweep.mjs:
// raised upright, a great weapon's blade ran 0.6-1.0 through the capelet his hood drapes over his chest).
const WEAPON_GUARD = Object.freeze({ kin: 0, hang: 0, soft: 0, hfwd: 0, wlim: 0, wcap: 0, ...(globalThis.__wguard ?? { r: 0.45, pitch: 1.05, psi: -0.1, hh: 0.95, reach: 0.62, edge: 0 }) });
const WEAPON_GUARD_TWO = Object.freeze({ ...WEAPON_GUARD, ...(globalThis.__wguard2 ?? { r: 1.25, pitch: 0.4, psi: 0, hh: 0.75, reach: 0.9, edge: 0 }) });
/** Behind a raised shield, a one-handed weapon held ready out at its own side, the blade up and forward (Elden Ring's
 *  block: the weapon kept back beside him, ready to strike round the shield). */
// (held at his middle, as he carries it, the shield arm crossed it there: the longsword's crossguard 0.48 in the shield
// hand's wrist all through the block, the hand caught between that wrist and his chest)
// (in the right hand a little lower, hh 0.72: at 0.8 the blade's base came 0.4-0.5 into his right shoulder raising and
// letting go of the block — the right shoulder joint sits 0.11 off the left's mirror)
const SHIELD_READY = Object.freeze({ ...WEAPON_GUARD, ...(globalThis.__shieldReady ?? { r: -0.45, pitch: 0.8, psi: -1.2, hh: FORE > 0 ? 0.8 : 0.72, reach: 0.68, edge: 0 }) });
/**
 * The other weapons' carries (content/weapons.js `carry`), as a cut pose's channels (swing3d.js: `r` the yaw from the
 * facing, + to his right; `pitch` + up; `psi` the hand's bearing, − his sword side; `hh` its height, 1 the shoulder;
 * `reach` a share of the arm). Elden Ring's great weapons rest over the shoulder in both grips (docs/WEAPONS.md).
 */
/** A pose of these as made for the sword in the left hand (`r` and `psi` from the facing), mirrored for the right. */
const sided = (q) => (FORE > 0 || !q ? q : { ...q, r: -q.r, psi: -q.psi });
const WEAPON_CARRY = Object.freeze({
  shoulder: { r: -3.0, pitch: 0.25, psi: -0.45, hh: 0.95, reach: 0.35, edge: 0.2 },
  // (higher and further out than first set, 0.72 / 0.5: the pommel at the grip's foot lay against his belly; the blade
  // up at his eyes' height, as chūdan no kamae holds it — .scratch/weapons/chudan.mjs)
  chudan: { r: 0.05, pitch: 0.65, psi: -0.1, hh: 0.85, reach: 0.72, edge: 1 },
  // (held near its foot since 2026-10-04: slanted across before him, its head up to his far side — swept clear of him
  // with the lower hand on its grip, .scratch/weapons/staffcarry.mjs)
  // (in the right hand reached a little further out, 0.56: at 0.5 its foot sat 0.18 in his left hip)
  staff: { r: 1.2, pitch: 0.7, psi: 0.1, hh: 0.88, reach: FORE > 0 ? 0.5 : 0.56, edge: 0 },
});
/** How the avoidance works: the clearance kept, turns per frame, the most one turn may be, how near the wrist a point
 *  must be to move the wrist rather than turn the hand. */
// (`reachCap`: through a cut's live window the hands move out along the blade only until its tip is that share of the
// hitbox's reach — not at all, and a great sword's pommel stayed in his belly wherever its blade pointed straight out
// from him, 0.4-0.7 deep: the grip's foot is 2.8 behind the upper fist, the hands 3.5-4.3 out)
// (`tauIn` 0.008, iters 10, maxMoved 2.5, maxTurned 1.3: at 0.025, 6, 1.6, 0.9 a great weapon swung on or off his
// shoulder by a raised guard, a roll or a late press went through him for 2-3 frames before the eased correction caught
// up, 0.4-0.9 deep — the colossal sword beside a shield in 2.7% of its chain's frames, 0.2% now; the tip's worst jerk
// no higher, .scratch/weapons/jerk.mjs)
// (`points` 4500, `reach` 0.7: with 2500 and 0.9 his body was a blur near the skin — a hand-axe's haft foot 0.45 in him
// read as 0.07, and nothing kept it out; a third fewer touching frames, 0.16 ms a frame more)
const AVOID = Object.freeze({ points: 4500, margin: 0.12, iters: 10, gain: 1.3, maxTurn: 0.5, maxTurned: 1.3, maxMoved: 2.5, turnFrom: [1.0, 2.2], tauIn: 0.008, tauOut: 0.08, reachCap: 1.05, reach: 0.7, ...(globalThis.__avoidCfg ?? {}) });
/** How much of the other arm's length the lower grip of a two-handed weapon may be from its shoulder before the weapon
 *  is brought towards it (offPass). */
const TWO_REACH = 0.95;
// The one-handed sword's place for the other hand when a cut takes it in both (sword3d.js: its grip −0.45…0.5 is the
// sword hand's, the pommel at −0.62): cupped round the pommel below the sword hand, as the man in the owner's video holds it.
const SWORD_TWO_OFF = -0.95;
const CUT_OUT = globalThis.__cutOut ?? 0.4; // (a fitted cut's eased hand-over to the stand, s: cutW)
/** How long (s) the over-the-shoulder carry takes to let go of a great weapon as a cut takes the arm. */
// (0.08: at once a great hammer's haft stood in his hood for a cut's first frame, gone now; 0.15 dragged the weapon
// into the guard's way)
const SHOULDER_LET_GO = 0.08;
// the carry stance (swing3d.js CARRY_STANCE) taken over this long standing, let go over this long (a cut, a start)
const STANCE_IN = 0.35, STANCE_OUT = 0.15, STANCE_WAIT = 0.25;
/** The over-the-shoulder carry (hero3d.js shoulderCarry): from the weapon-side shoulder joint, in shares of his height,
 *  [forward, out to the weapon side, up] — the grip (the fist's), and the point on the top of the shoulder the weapon's
 *  length passes over (its cowl and collar stand 2.1-2.4 over the joint's line, the hood's flare higher nearer the neck:
 *  .scratch/weapons/shoulder.mjs). */
// (`rollBase`: every weapon rolled a little about its length, the lower edge out — edge-on its lower quillon lay in his
// forearm, 0.25; `pairShift` the two hands moved up the grip by that share of how far past the greatsword's the lower one
// holds; swept on every great weapon standing and walking, .scratch/weapons/carrysweep.mjs: no part of any of them in him, the
// greatsword 0.08 off the cowl, the lower hand 0.26 from its grip, the blade rising 36° — Elden Ring's Claymore carry
// rises ~25-35°; `depth` the greatsword's own depth below its line where it crosses, each weapon raised or lowered by
// its own: depthBelow)
// (the owner's side view of the great club, 2026-10-05, "the hands placed correctly, and the club above his
// shoulderblade": the fists low in front of the shoulder, at its joint's height, the near arm reaching out to them nearly
// straight, the weapon rising ~45° back over the top of the shoulder behind the hood — `grip` [0.17, −0.08, 0.01] and
// `rest` [0.01, 0.06, 0.19], from [0.19, −0.1, 0.03] and [0.06, 0.08, 0.19], whose fists stood at his chin and the weapon
// flatter, ~30° (the rest at [0, 0.04, 0.18], in nearer his neck where the hood rises, sank the great club 0.33 into it
// and a great weapon went 0.44-0.48 into him coming back from its guard); `twist` the fists turned 1.4 rad round the haft, so both close over it from above, knuckles up and out
// (the weapon turned back by as much: the same edge up); `offBack` the lower hand's elbow pulled that far back as
// well as out and down — it rose level with the shoulder)
// (on the right shoulder 0.01 further forward and up: at the left's rest a great hammer came back onto it 0.39-0.41 in
// him after its chain, a one-handed great club beside a raised shield 0.37 — the right shoulder joint sits 0.11 off
// the left's mirror; swept against tools/test.mjs, 2026-10-07)
const SHOULDER_CARRY = Object.freeze({ grip: [0.17, -0.08, 0.01], rest: FORE > 0 ? [0.01, 0.06, 0.19] : [0.02, 0.06, 0.2], twist: 1.4, offBack: 0.6, depth: 0.52, perDepth: { grip: [0.0185, 0.0185, 0], rest: [0, 0.037, 0] }, roll: 0.3, rollBase: -0.4, pairShift: 1.5, depthShift: 1.51, shieldOut: 0.03, shieldGripOut: 0.06 });
/** A two-handed cut: the hand's bearing drawn in toward his middle, so the other hand reaches the lower grip, and the
 *  arms long (`w` how far the other hand is on). */
// (long: Elden Ring's two-handed cuts reach as far as its one-handed ones, the arms out straight at the hit — drawn
// in a little shorter, ×0.88, a great sword's grip foot and pommel, 2.8 behind the upper fist, went into his belly
// wherever its blade pointed out from him: 6.5% of the greatsword's chain's frames, 1.1% at ×1.25; HAND_REACH.two
// re-measured with it, content/weapons.js)
// (less of it the higher the hands go: raised for an overhead they were drawn in over the middle of his hooded head, the
// crossguard in the hood — Elden Ring raises them over the weapon-side shoulder)
// (and low, finishing a chop, they are carried further out in front of his hips, the arms long: drawn in there, the
// pommel turned back into his belly)
/** Any other weapon's cut one-handed: the hand carried further out when it is low (finishing a chop, the pommel turned back
 *  into his belt). */
/** How far (rad) a two-handed sweep's hands are held off the blade's own line, by how far the grip's foot is behind the
 *  upper fist (`from`..`to`, units): none for the greatsword's 2.85, all of it for the colossal sword's 3.4. */
// (0.45: the colossal sword's chain in him 3.7% of its frames → its cuts none, the drawn tip on its hitbox, ≤ 3° off;
// on the greatsword, partly, it went the other way, 0.4 → 1.1-2.2%)
const TWO_LEAD = Object.freeze({ by: 0.45, from: 2.9, to: 3.4 });
// (and out when raised, as a two-handed cut's: an axe's or hammer's overhead finisher brought the fist down past his face,
// the haft's foot through the front of his hood — 0.45 deep, unseen by the body the weapons are kept out of, the hood's
// inside left hollow there; 0.5: the fist 3.4 from his head through the chop, 3.2 at 0.3, the arm near straight —
// the overheads' drawn tips 1.05-1.07 of their reach for it)
// (by `aimW`, let go of over a recovery as the tip's aim is — swing3d.js bladeAt: kept, a sword's cut ended 0.2 of the
// arm out from the carry it hands over to, and the blade made a detour in the hand-over)
const lowOut = (pose) => ({ ...pose, reach: pose.reach + (pose.aimW ?? 1) * (0.2 * Math.min(1, Math.max(0, (0.55 - (pose.hh ?? 0)) / 0.55)) + 0.5 * Math.min(1, Math.max(0, ((pose.hh ?? 0) - 1.05) / 0.45))) });
const twoHandCut = (pose, w, butt) => {
  const up = Math.min(1, Math.max(0, ((pose.hh ?? 0) - 1.05) / 0.45));
  const low = Math.min(1, Math.max(0, (0.55 - (pose.hh ?? 0)) / 0.55));
  const out = { ...pose, psi: pose.psi * (1 - 0.55 * w * (1 - up)), reach: pose.reach * (1 + 0.25 * w) + 0.12 * w * up + (globalThis.__lowReach ?? 0.2) * w * low };
  // (a grip whose foot is far behind the upper fist — the colossal sword's pommel 3.4 behind it, further than his arms
  // reach out from his middle — swept with the hands off the blade's line, so the grip passes beside him: along it, at
  // the hit the pommel went 0.8 into his belly whatever his arms did)
  const lead = TWO_LEAD.by * smoothstep(TWO_LEAD.from, TWO_LEAD.to, butt);
  if (lead > 0 && pose.dir) out.psi = out.psi + (out.r - pose.dir * lead - out.psi) * w;
  return out;
};
/** A cut pose mirrored across his facing (a paired attack's off blade): the yaw, the hand's bearing, the roll and twist. */
const mirrorCut = (q) => ({ ...q, r: -q.r, psi: -(q.psi ?? 0), roll: -(q.roll ?? 0), twist: -(q.twist ?? 0), dir: -(q.dir ?? 1) });
/** The sword's tip from the middle of its grip (sword3d.js SWORD.tip). */
const SWORD_TIP = 8.98;
/** The clips the sword is carried over (the rest hold it in the clip's own hand). */
const CARRIED = new Set(["idle", "walk", "run"]);

export function makeHero3D(asset, look, { spec = asset.animations.some((a) => a.name === "idle") ? PAINTED : MANNEQUIN } = {}) {
  const obj = new Group(); // at the hero's feet, in the world
  const turn = new Group(); // facing, lean and squash, about the feet
  turn.rotation.order = "YXZ";
  obj.add(turn);
  const model = SkeletonUtils.clone(asset.scene);
  let height = spec.height;
  if (!height) {
    // Measured from the model itself (metres), feet at 0.
    let top = 0;
    asset.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingBox();
        top = Math.max(top, o.geometry.boundingBox.max.y);
      }
    });
    height = top || 1.8;
  }
  const s = HERO_H / height;
  model.scale.setScalar(s);
  model.rotation.y = spec.yaw;
  turn.add(model);

  // Materials: one paint material per part (a character's flash must not flash anything else),
  // and a skinned outline hull on the same skeleton.
  const mats = [];
  const hulls = [];
  const skinned = [];
  model.traverse((o) => {
    if (o.isSkinnedMesh) skinned.push(o);
  });
  for (const o of skinned) {
    const name = o.material?.name || "M_Main";
    const map = o.material?.map || null; // the painted hero keeps its texture
    // The painted hero's normals smoothed once per asset (smooth3d.js): the cape's crumples came out
    // as dark angular patches of the fill's lower band (the re-review, seen from behind).
    if (map && !smoothed.has(o.geometry)) {
      smoothed.add(o.geometry);
      smoothNormals(o.geometry, HERO_SMOOTH);
    }
    // Its sides as the file has them (the rigged hero's is double-sided): the remeshed cloth has small
    // folds whose faces point inwards, which a flung cape or a raised arm turns to the camera — drawn
    // one-sided, each showed as a black hole through the cape (the roll's review).
    const m = paintMaterial(look, { color: map ? 0xffffff : spec.colors[name] ?? 0x2a6a66, map, char: true, side: o.material?.side });
    charLight(m, HERO_LIGHT);
    o.material = m;
    o.castShadow = true;
    o.receiveShadow = true;
    mats.push(m);
    const hull = new SkinnedMesh(o.geometry, outlineMaterial(look, { color: 0x100f0b, warm: 0x5a4a10, px: 1.3 }));
    // The hull's back faces sit only a hair behind the front surface wherever the remeshed cloth
    // crumples (the cape's small folds), so pushed out in screen space they came through it as
    // black slivers and holes all over the resting cape seen from behind (the re-review). Drawn a
    // little deeper, the hull shows only where nothing of the body is in front of it: the outline.
    hull.material.polygonOffset = true;
    hull.material.polygonOffsetFactor = HULL_OFFSET.factor;
    hull.material.polygonOffsetUnits = HULL_OFFSET.units;
    hull.bind(o.skeleton, o.bindMatrix);
    hull.frustumCulled = false;
    o.frustumCulled = false;
    o.parent.add(hull);
    hulls.push(hull);
  }

  const bones = [];
  skinned[0]?.skeleton.bones.forEach((b) => bones.push(b));
  const byName = (n) => bones.find((b) => isBone(b, n));
  const side = /\.L$|_L$/.test(spec.hand) ? "L" : "R";
  const other = side === "L" ? "R" : "L";
  const armOf = (sd) => ({ shoulder: byName(`DEF-shoulder.${sd}`), upper: byName(`DEF-upper_arm.${sd}`), fore: byName(`DEF-forearm.${sd}`), hand: byName(`DEF-hand.${sd}`), pauldron: byName(`DEF-pauldron.${sd}`) });
  const arm = armOf(side);
  // (finger bones: tools/3d/rig/add_fingers.py)
  const fingersIn = !!byName(`DEF-fingers1.${side}`);

  // The sword (sword3d.js), in the sword hand: built in game units, the hand's scale taken off. Its
  // frame is set from the rest pose, where the arm hangs and the fist holds the blade pointing ahead
  // with its edge upright; every clip then carries it as the fist turns, and the carry and the cuts
  // turn the hand to point it (anim/swing3d.js).
  // (the main hand's weapon: the sword unless he holds another, swapped by `equip`)
  let sword = makeSword(look);
  const grip = { q: new Quaternion(), p: new Vector3() };
  let authored = null;
  if (arm.hand) {
    model.updateMatrixWorld(true);
    const qModel = model.getWorldQuaternion(new Quaternion());
    const qHand = arm.hand.getWorldQuaternion(new Quaternion());
    grip.q.copy(qHand.invert().multiply(qModel));
    const hs = arm.hand.getWorldScale(new Vector3()).x;
    const a = new Vector3();
    const b = new Vector3();
    const armLen = arm.upper && arm.fore ? arm.upper.getWorldPosition(a).distanceTo(arm.fore.getWorldPosition(b)) + b.distanceTo(arm.hand.getWorldPosition(a)) : HERO_H * 0.32;
    // The grip: the rig's weapon socket on the sword hand when it has one (50_rig_hero.py puts it
    // where the fist closes), else about 11% of the arm's length past the wrist, where that is.
    // Without a socket, the middle of the mesh's own fist (the rest-pose vertices the hand bone
    // mostly carries). (The new man's fingers were carried by his forearms, so his hand turned without
    // them and the sword stood apart from his fingers: tools/3d/rig/fix_hand_weights.py moved them.)
    const socket = arm.hand.children.find((o) => o.isBone && /^weapon/i.test(o.name));
    // Every clip keys the socket where it was made with the sword (past the fingertips; add_fingers.py
    // moved its rest place into the closed fist): in a clip holding the sword the arm is bent so the
    // fist meets that path (holdAuthored).
    if (socket && (fingersIn || socket.userData?.authored)) authored = socket;
    const fist = socket ? null : fistCentre(skinned, arm.hand);
    // (the frame every clip was made with, the sword on the socket: holdAuthored keeps its blade)
    grip.clip = grip.q.clone();
    if (socket && fingersIn) {
      // The hammer grip through the closed fist (GRIP_FIT), the edge signed as the rest frame's; `seat` how far
      // its middle lies from the socket's rest (hanging, the wrist stays where it hung: swing3d.js).
      const th = (GRIP_FIT.th * Math.PI) / 180;
      const ax = new Vector3(0, Math.sin(th), Math.cos(th));
      const edge = new Vector3(0, 1, 0).addScaledVector(ax, -ax.y).normalize();
      if (edge.dot(new Vector3(0, 1, 0).applyQuaternion(grip.q)) < 0) edge.negate();
      grip.q.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(edge, ax), edge, ax));
      // (GRIP_FIT.at is in the left hand's frame: the rig's right-hand bones are their left twins with local x flipped)
      grip.p.set(GRIP_FIT.at[0] * (side === "L" ? 1 : -1), GRIP_FIT.at[1], GRIP_FIT.at[2]).multiplyScalar(1 / hs);
      grip.seat = grip.p.clone().sub(socket.position);
    } else if (socket) grip.p.copy(socket.position);
    else if (fist) grip.p.copy(arm.hand.worldToLocal(fist));
    else grip.p.set(0, (armLen * 0.11) / hs, 0);
    sword.group.position.copy(grip.p);
    sword.group.quaternion.copy(grip.q);
    sword.group.scale.setScalar(1 / hs);
    arm.hand.add(sword.group);
  }
  // The off hand's grip (a shield's handle, an off-hand weapon, the lower hand on a two-handed one): the main hand's
  // hammer grip mirrored across his body at rest — the same fist, the other hand. (Reflected, the frame's handedness
  // flips: its flat, X, is made again from the mirrored edge and line.)
  const offArm = armOf(other);
  const offGrip = { q: new Quaternion(), p: new Vector3(), ok: false };
  if (arm.hand && offArm.hand && arm.upper && offArm.upper) {
    model.updateMatrixWorld(true);
    const lat = offArm.upper.getWorldPosition(new Vector3()).sub(arm.upper.getWorldPosition(new Vector3()));
    const mid = offArm.upper.getWorldPosition(new Vector3()).add(arm.upper.getWorldPosition(new Vector3())).multiplyScalar(0.5);
    lat.normalize();
    const refl = (v) => v.addScaledVector(lat, -2 * v.dot(lat));
    const w = sword.group.matrixWorld;
    const o = new Vector3().setFromMatrixPosition(w);
    const ex = new Vector3(), ey = new Vector3(), ez = new Vector3();
    w.extractBasis(ex, ey, ez);
    const at = refl(o.clone().sub(mid)).add(mid);
    const y2 = refl(ey.clone().normalize()), z2 = refl(ez.clone().normalize());
    const x2 = new Vector3().crossVectors(y2, z2);
    const qW = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x2, y2, z2));
    offArm.hand.updateMatrixWorld(true);
    offGrip.p.copy(offArm.hand.worldToLocal(at));
    offGrip.q.copy(offArm.hand.getWorldQuaternion(new Quaternion()).invert().multiply(qW));
    offGrip.hs = offArm.hand.getWorldScale(new Vector3()).x;
    offGrip.ok = true;
  }

  // The fingers (docs/HERO-HANDS.md; bones and their curls from tools/3d/rig/add_fingers.py, in each
  // bone's extras): the sword hand closed round the grip, the free hand gently curled. Each bone's rest
  // rotation is its hand's own, so its pose is one turn about its stored axis.
  // (THUMB_GRIP is the left thumb's; the right thumb's is its mirror, the rig's R bones being their L twins x-flipped)
  const thumbGrip = (bone) => (/L$/.test(bone.name) ? THUMB_GRIP : [THUMB_GRIP[0], -THUMB_GRIP[1], -THUMB_GRIP[2], THUMB_GRIP[3]]);
  const fingers = ["fingers1", "fingers2", "thumb"]
    .flatMap((n) => ["L", "R"].map((sd) => ({ bone: byName(`DEF-${n}.${sd}`), sd })))
    .filter((f) => f.bone?.userData?.curl)
    .map((f) => ({ bone: f.bone, sword: f.sd === side, axis: new Vector3().fromArray(f.bone.userData.curl).normalize(), grip: ((FIST[f.bone.name.replace(/[LR]$/, "")] ?? f.bone.userData.grip) * Math.PI) / 180, relaxed: (f.bone.userData.relaxed * Math.PI) / 180, run: ((RUN_FIST[f.bone.name.replace(/[LR]$/, "")] ?? f.bone.userData.relaxed) * Math.PI) / 180 }))
    // (the sword hand's thumb closed over the index as a whole turn, THUMB_GRIP, not about its stored axis)
    .map((f) => (f.sword && /^DEF-thumb/.test(f.bone.name) ? { ...f, gripQ: new Quaternion().fromArray(thumbGrip(f.bone)), relQ: new Quaternion().setFromAxisAngle(f.axis, f.relaxed) } : f))
    // (the off hand's: closed as a fist when it holds a shield, a weapon or the lower grip of a two-handed one)
    .map((f) => (f.sword ? f : { ...f, gripAngle: ((FIST[f.bone.name.replace(/[LR]$/, "")] ?? f.bone.userData.grip) * Math.PI) / 180 }))
    // (the other hand's thumb, on a two-handed grip, over its index as the sword hand's: THUMB_GRIP mirrored — curled
    // about its own axis it stood up beside the grip, a thumbs-up on the owner's great club)
    // (`__offThumb`: an absolute quaternion for that thumb, to compare)
    .map((f) => (!f.sword && /^DEF-thumb/.test(f.bone.name) ? { ...f, holdQ: new Quaternion().fromArray(globalThis.__offThumb ?? thumbGrip(f.bone)) } : f));
  // A clip holding the sword (a keyed swing, the roll, the hurt, the death, the win) was authored
  // with it on the old socket, past the fingertips; the sword is in the fist now (docs/HERO-HANDS.md),
  // so the arm is bent, the shoulder lending reach, until the fist's grip is where the clip had the
  // sword, the hand's turn kept: the clip's blade arcs stay as they were (the blade-clear checks).
  const qLoosen = new Quaternion();
  // (the hand's turn that keeps a clip's blade with the grip refitted: the clip held the sword at grip.clip)
  const gripFix = grip.clip ? grip.clip.clone().multiply(grip.q.clone().invert()) : new Quaternion();
  const hA = { r: new Quaternion(), r2: new Quaternion(), q: new Quaternion(), t: new Vector3(), o: new Vector3(), s: new Vector3(), e: new Vector3(), w: new Vector3(), x: new Vector3(), pole: new Vector3(), goal: new Vector3(), goalW: 0 };
  function holdAuthored(w) {
    hA.goalW = 0;
    if (w <= 1e-3 || !authored || !arm.hand || !arm.fore || !arm.upper) return;
    arm.hand.updateMatrixWorld(true);
    arm.hand.getWorldQuaternion(hA.q);
    const hs = arm.hand.getWorldScale(hA.s).x;
    hA.t.copy(authored.position).applyMatrix4(arm.hand.matrixWorld);
    hA.q.multiply(gripFix); // (the hand turned round the refitted grip: the clip's blade where it was)
    hA.o.copy(grip.p).multiplyScalar(hs).applyQuaternion(hA.q);
    hA.t.sub(hA.o); // the wrist that puts the fist's grip on the authored grip
    arm.upper.getWorldPosition(hA.s);
    arm.fore.getWorldPosition(hA.e);
    arm.hand.getWorldPosition(hA.w);
    const armLen = hA.s.distanceTo(hA.e) + hA.e.distanceTo(hA.w);
    // (the clip's elbow off its shoulder-wrist line, and that over the upper arm's half: how clearly it bends)
    hA.x.subVectors(hA.w, hA.s).normalize();
    hA.pole.subVectors(hA.e, hA.s);
    const bendK = Math.min(1, hA.pole.addScaledVector(hA.x, -hA.pole.dot(hA.x)).length() / (0.5 * hA.s.distanceTo(hA.e)));
    hA.x.copy(hA.pole);
    hA.pole.copy(hA.e).sub(hA.s.add(hA.w).multiplyScalar(0.5));
    if (hA.pole.lengthSq() < 1e-8) hA.pole.set(0, -1, 0);
    hA.pole.normalize();
    hA.goal.copy(hA.t).add(hA.o); // (where the clip has the grip: the slide's goal)
    reachShoulder(arm, hA.t, armLen, w);
    // (never at full stretch: the wrist kept within HOLD.reach of the arm, the elbow bent — locked straight
    // through a quarter to a half of every cut, the hilt sliding out of the fist the rest of the way)
    arm.upper.getWorldPosition(hA.s);
    const most = HOLD.reach * armLen;
    if (hA.t.distanceTo(hA.s) > most) hA.t.sub(hA.s).setLength(most).add(hA.s);
    // (the elbow swung round the shoulder-wrist line to where the hand's own line wants the forearm: the
    // clips' own wrists bend 104-179°; the hand's world turn, and the blade, are kept. The clip's own side
    // counts only where the hand's line runs along the arm and gives none — by how clearly the clip bends
    // the elbow, at most HOLD.clip. Measured with the elbow at 0.44 of the arm (2026-10-04): the clip's
    // side half and half with the hand's — the two lie 130-180° apart through the heavy's cut — left no
    // direction at all, and the elbow jerked 3.1 u/frame² in a frame seen from behind; this way its largest
    // jerk over every swing, roll, hurt, death and win is 1.74, against 2.31 before the elbow moved.)
    if (rig.handRest) {
      hA.e.copy(arm.hand.position).normalize().applyQuaternion(hA.r.copy(hA.q).multiply(hA.r2.copy(rig.handRest).invert())); // the forearm's ideal line
      hA.w.subVectors(hA.t, hA.s).normalize();
      hA.e.addScaledVector(hA.w, -hA.e.dot(hA.w)).negate();
      hA.x.addScaledVector(hA.w, -hA.x.dot(hA.w));
      if (hA.x.lengthSq() > 1e-10) hA.e.addScaledVector(hA.x.normalize(), HOLD.clip * bendK);
      if (hA.e.lengthSq() > 1e-8) hA.pole.copy(hA.e).normalize();
    }
    twoBoneIK(arm.upper, arm.fore, arm.hand, hA.t, hA.pole, w);
    setWorldQuaternion(arm.hand, hA.q, w);
    // (the hand's turn about the forearm's line given to the forearm, the hand kept as the clip has it)
    if (rig.handRest) forearmRoll(arm, rig.handRest, w);
    hA.goalW = w;
  }
  // What the arm cannot reach, the grip slides out along the fist to meet: the sword goes where the
  // pose or the clip wants it, the fist as close as the arm allows (a loose grip at full stretch).
  // Standing, carrying and most of every swing the grip is wholly in the fist; only at the cuts'
  // full stretch does the hilt slide, at most HOLD.along along the grip and HOLD.across across it.
  const vAx = new Vector3();
  const gS = { want: new Vector3(), at: new Vector3(), q: new Quaternion() };
  function slideGrip() {
    sword.group.position.copy(grip.p);
    const wa = rig.gripGoalW || 0;
    const wb = hA.goalW || 0;
    if (wa + wb <= 1e-3) return;
    gS.want.set(0, 0, 0);
    if (wa > 0) gS.want.addScaledVector(rig.gripGoal, wa);
    if (wb > 0) gS.want.addScaledVector(hA.goal, wb);
    gS.want.multiplyScalar(1 / (wa + wb));
    arm.hand.updateMatrixWorld(true);
    gS.at.copy(grip.p).applyMatrix4(arm.hand.matrixWorld);
    gS.want.sub(gS.at); // world: how far the fist fell short
    const hs = arm.hand.getWorldScale(hA.s).x;
    const len = gS.want.length() / hs;
    if (len < 0.05) return;
    arm.hand.getWorldQuaternion(gS.q).invert();
    gS.want.applyQuaternion(gS.q).multiplyScalar(1 / hs); // (hand units)
    // Along the grip's own line only, at most HOLD.along (the fist further up or down the grip, two fingers
    // always on it), and HOLD.across sideways: what the arm still cannot reach, the sword falls short
    // there, its turn the clip's (it slid up to 1.95 units, 1.9 of it sideways, out of the fist, or onto
    // the blade in swing2's hit).
    vAx.set(0, 0, 1).applyQuaternion(grip.q);
    const al = gS.want.dot(vAx);
    gS.want.addScaledVector(vAx, -al);
    const ac = gS.want.length();
    if (ac > HOLD.across / hs) gS.want.multiplyScalar(HOLD.across / hs / ac);
    gS.want.addScaledVector(vAx, Math.max(-HOLD.along / hs, Math.min(HOLD.along / hs, al)));
    sword.group.position.add(gS.want);
  }
  // The loose grip (GRIP_LOOSE): the sword turned in the fist about the axis square to the blade and the hand's
  // line, toward the fingers — the tip dropping as the pommel rises against the heel of the hand. Both the arm
  // solve and the sword use grip.q, so the arm holds the turned grip as its own.
  const gripQ0 = grip.q.clone();
  const vGt = new Vector3();
  const qGt = new Quaternion();
  let gripTiltNow = 0;
  let standOpen = 0; // how much he stands (the loose grip, the open free hand)
  let openW = 0; // the free hand opened, on its own time
  let walkCurlW = 0; // and curled a little more walking
  function tiltGrip(a) {
    if (Math.abs(a - gripTiltNow) > 1e-5) {
      gripTiltNow = a;
      vGt.set(0, 0, 1).applyQuaternion(gripQ0).cross(UP).normalize(); // (UP: the hand's own line, in its frame)
      grip.q.copy(qGt.setFromAxisAngle(vGt, a)).multiply(gripQ0);
    }
    if (sword.group.parent === arm.hand) sword.group.quaternion.copy(grip.q);
  }
  const sampler = makeSampler(model, clipsFor(asset, spec), spec.names);
  const inert = makeInertializer(bones);
  // Planted feet (anim/feet.js): the legs by the skeleton's own bone names.
  const legs = ["L", "R"].map((sd) => ({ thigh: byName(`DEF-thigh.${sd}`), shin: byName(`DEF-shin.${sd}`), foot: byName(`DEF-foot.${sd}`), toe: byName(`DEF-toe.${sd}`) })).filter((l) => l.thigh && l.shin && l.foot && l.toe);
  // The legs on the ground at every speed (anim/stride.js): the soles' heel, ball and toe tip measured
  // once, on the bind pose (before any clip: the hand rests below are taken from it too).
  obj.updateMatrixWorld(true);
  // (the clips played as stored, the right foot is the one landing at the gait's tdL; mirrored, the left)
  const feet = makeHeroStride(legs, byName("DEF-hips"), soleContacts(legs, skinned), model, { lead: spec.mirror ? 0 : 1 });
  // The legs alone, walking or running under a swing he moves through (hero-anim3d.js `legs`).
  const legBones = ["thigh", "shin", "foot", "toe"].flatMap((n) => ["L", "R"].map((sd) => byName(`DEF-${n}.${sd}`))).filter(Boolean);
  // (the bones the legs' layer poses past the clip: re-recorded for the blend, anim/blend.js capture)
  const legBlend = [...legBones, byName("DEF-hips")].filter(Boolean);
  const legQ = legBones.map((b) => b.quaternion.clone());
  // The cape: verlet chains from the shoulders (cape3d.js), on the neck bone, off the legs.
  const neck = byName("DEF-neck") || byName("DEF-spine.003");
  const capeMat = paintMaterial(look, { color: 0x1c5548, char: true });
  // Only for a model without a cape of its own (the mannequin): the painted hero's cape is part of
  // its mesh until step D separates it onto its own chains.
  const cape = neck && spec === MANNEQUIN ? makeCape(capeMat, { length: 12.5, width: 6.5 }) : null;
  const capeRoot = new Vector3();
  const capeFwd = new Vector3();
  const capeRight = new Vector3();
  const capeWind = new Vector3();
  const swChest = new Vector3();
  const walkQ = new Quaternion();
  const swHand = new Vector3();
  let shoulderW = 1;
  const clavFix = new Map(); // each collarbone's stand turn and drop (rad), as last measured standing
  let clavW = 1; // how much of them is on
  let rollTurnW = 1; // (the shoulders' rounding, out in a roll's tuck)
  let shoulderWF = 1; // (the free collarbone's shoulderW and clavW, on its own slower fade: FREE_FADE)
  let clavWF = 1;
  let offLW = 1; // the free wrist's share of the run's hand (into a hurt it goes within 0.03 s)
  const rollA = new Vector3();
  const rollX = new Vector3();
  const rollT = new Vector3();
  const rollOut = new Vector3();
  const offTip = byName(`DEF-fingers1.${other}`);
  /**
   * The free forearm rolled so the palm faces the thigh, thumb ahead, by `w`: the knuckles' line turned
   * toward the front of the forearm, WALK_PALM of the way out; the hand stays where it is.
   */
  function palmToThigh(w, faceWorld) {
    if (w <= 1e-3 || !rig.off?.fore || !rig.off.hand) return;
    rig.off.fore.getWorldPosition(swChest);
    rig.off.hand.getWorldPosition(swHand);
    rollA.copy(swHand).sub(swChest).normalize(); // the forearm's line
    rig.chest.getWorldPosition(swChest);
    const out = Math.sign((swHand.x - swChest.x) * -Math.sin(faceWorld) + (swHand.z - swChest.z) * Math.cos(faceWorld)) || 1;
    rollOut.set(-Math.sin(faceWorld) * out, 0, Math.cos(faceWorld) * out);
    rollT.copy(rollOut).cross(rollA).multiplyScalar(out); // ahead, square to the forearm
    rollT.multiplyScalar(Math.cos(WALK_PALM)).addScaledVector(rollOut, Math.sin(WALK_PALM));
    // (the knuckles' line is the hand's +Z — its +X is the palm's normal: rolled onto the target, the palm
    // faced 53° back from the thigh and the knuckles pointed 50° inward: the HANDS lens)
    rollX.set(0, 0, 1).applyQuaternion(rig.off.hand.getWorldQuaternion(walkQ));
    rollX.addScaledVector(rollA, -rollX.dot(rollA));
    rollT.addScaledVector(rollA, -rollT.dot(rollA));
    if (rollX.lengthSq() > 1e-6 && rollT.lengthSq() > 1e-6) {
      rollX.normalize();
      rollT.normalize();
      const turn = Math.atan2(rollA.dot(rollOut.copy(rollX).cross(rollT)), rollX.dot(rollT));
      walkQ.setFromAxisAngle(rollA, Math.max(-WALK_ROLL_MAX, Math.min(WALK_ROLL_MAX, turn)) * w);
      turnWorld(rig.off.fore, walkQ);
    }
  }
  // The shoulder girdle after its arm (GIRDLE). `pinW` how much the hand is held where it is (a keyed swing's
  // blade is the hitbox's); `trunkW` how much the chest's turn on the hips draws the collarbone back (the free arm
  // in a swing); `dt` < 0: no slew (the bench's held poses).
  const gV = Array.from({ length: 9 }, () => new Vector3());
  const gQ = Array.from({ length: 5 }, () => new Quaternion());
  const gSq = new Vector3();
  const gBind = new Map(); // each collarbone's bind elevation in the chest's frame (rad)
  const gPrev = new Map(); // and its last protraction and elevation (rad), for the slew
  function followGirdle(a, pinW, trunkW, dt) {
    if (!a?.shoulder || !a.upper || !a.fore || !a.hand || !rig.chest) return;
    const [S, E, W, C, X, Up, F, P, T] = gV;
    const [Qh, Qu, Qf, Qt, Keep] = gQ;
    for (const b of [rig.chest, a.shoulder, a.upper, a.fore, a.hand]) b.quaternion.normalize();
    rig.chest.updateMatrixWorld(true);
    a.upper.getWorldPosition(S);
    a.fore.getWorldPosition(E);
    a.hand.getWorldPosition(W);
    a.hand.getWorldQuaternion(Qh).normalize();
    a.upper.getWorldQuaternion(Qu).normalize();
    a.fore.getWorldQuaternion(Qf).normalize();
    const Lu = S.distanceTo(E);
    const Lf = E.distanceTo(W);
    // (the chest's own frame: in a roll's tuck the facing's is far off the trunk)
    rig.chest.getWorldQuaternion(Qt);
    Up.set(0, 1, 0).applyQuaternion(Qt).normalize();
    F.set(0, 0, 1).applyQuaternion(Qt);
    F.addScaledVector(Up, -F.dot(Up)).normalize();
    a.shoulder.getWorldPosition(C);
    C.subVectors(S, C); // the collarbone
    X.subVectors(E, S).normalize(); // the upper arm
    const flex = Math.asin(Math.max(-1, Math.min(1, X.dot(F))));
    const raise = Math.acos(Math.max(-1, Math.min(1, -X.dot(Up))));
    let prot = flex >= 0 ? GIRDLE.fwd * flex : GIRDLE.back * flex;
    if (trunkW > 1e-3 && rig.legs.length === 2 && rig.arm?.shoulder && rig.arm.upper) {
      // (the chest's turn on the hips, + the sword shoulder ahead: the free collarbone drawn back as the strike
      // brings the sword shoulder round, forward in the wind-up)
      rig.legs[0].thigh.getWorldPosition(P);
      rig.legs[1].thigh.getWorldPosition(T).sub(P);
      P.crossVectors(Up, T);
      P.addScaledVector(Up, -P.dot(Up)).normalize(); // the hips' forward
      const ang = Math.atan2(T.crossVectors(P, F).dot(Up), P.dot(F));
      rig.arm.upper.getWorldPosition(T);
      rig.arm.shoulder.getWorldPosition(P);
      T.sub(P);
      const sg = Math.sign(P.crossVectors(Up, T).dot(F)) || 1;
      prot -= GIRDLE.trunk * ang * sg * trunkW;
    }
    prot = Math.max(-GIRDLE.max, Math.min(GIRDLE.max, prot));
    let elev = Math.max(0, Math.min(GIRDLE.max, GIRDLE.up * Math.max(0, raise - GIRDLE.up0) + GIRDLE.upBack * Math.max(0, -flex)));
    const pv = gPrev.get(a);
    if (pv && dt >= 0) {
      const m = GIRDLE.slew * dt * 60;
      prot = pv.p + Math.max(-m, Math.min(m, prot - pv.p));
      elev = pv.e + Math.max(-m, Math.min(m, elev - pv.e));
    }
    gPrev.set(a, { p: prot, e: elev });
    T.copy(C).normalize();
    const eNow = Math.asin(Math.max(-1, Math.min(1, T.dot(Up))));
    if (gBind.has(a)) elev = Math.min(elev, Math.max(0, gBind.get(a) + GIRDLE.cap - eNow));
    // (one turn, protraction about the chest's up and elevation about the collarbone's own horizontal; for a pinned
    // hand only its part about the collar head → wrist line, which moves the shoulder joint round the wrist and so
    // keeps the elbow's bend)
    const sP = Math.sign(T.crossVectors(C, F).dot(Up)) || 1;
    const Om = X.copy(Up).multiplyScalar(sP * prot).addScaledVector(T.copy(C).cross(Up).normalize(), elev);
    const pin = pinW > 1e-3;
    if (pin) {
      a.shoulder.getWorldPosition(P);
      P.subVectors(W, P).normalize();
      const along = Om.dot(P);
      Om.multiplyScalar(1 - pinW).addScaledVector(P, along * pinW);
    }
    const omL = Om.length();
    if (omL < 1e-6) return;
    Om.multiplyScalar(1 / omL);
    // (the elbow's side, kept for the re-solve: the old elbow off the old shoulder-wrist line)
    P.subVectors(W, S).normalize();
    T.subVectors(E, S);
    T.addScaledVector(P, -T.dot(P));
    const bendAt = (d) => Math.PI - Math.acos(Math.max(-1, Math.min(1, (Lu * Lu + Lf * Lf - d * d) / (2 * Lu * Lf))));
    const d0 = S.distanceTo(W);
    Keep.copy(a.shoulder.quaternion);
    const tryK = (k) => {
      a.shoulder.quaternion.copy(Keep);
      a.shoulder.updateMatrixWorld(true);
      if (k <= 0) return true;
      turnWorld(a.shoulder, Qt.setFromAxisAngle(Om, omL * k));
      if (!pin) return true;
      const d1 = a.upper.getWorldPosition(E).distanceTo(W);
      return d1 <= Math.max(d0, GIRDLE.reach * (Lu + Lf)) + 1e-4 && (bendAt(Math.min(d1, Lu + Lf)) - bendAt(Math.min(d0, Lu + Lf))) * pinW <= GIRDLE.bend;
    };
    if (!tryK(1)) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 10; i++) {
        const m = (lo + hi) / 2;
        if (tryK(m)) lo = m;
        else hi = m;
      }
      tryK(lo);
    }
    // (the arm carried: its bones' world turns as they were, the hand going with the shoulder joint)
    setWorldQuaternion(a.upper, Qu);
    setWorldQuaternion(a.fore, Qf);
    setWorldQuaternion(a.hand, Qh);
    if (pin) {
      // (or held: the wrist back where it was by pinW, the elbow on its side, the hand's world turn kept)
      a.hand.getWorldPosition(E).lerp(W, pinW);
      twoBoneIK(a.upper, a.fore, a.hand, E, T.lengthSq() > 1e-8 ? T.normalize() : null, 1);
      setWorldQuaternion(a.hand, Qh);
    }
  }
  // The cut and the carry (anim/swing3d.js).
  const rig = {
    height: HERO_H,
    side,
    hips: byName("DEF-hips"),
    spine: ["DEF-spine.001", "DEF-spine.002", "DEF-spine.003"].map(byName).filter(Boolean),
    chest: byName("DEF-spine.003") || byName("DEF-spine.002") || byName("DEF-hips"),
    neck: byName("DEF-neck"),
    head: byName("DEF-head"),
    arm,
    off: offArm,
    legs,
    grip,
    // (the sword hand's rest rotation on the forearm, taken before any clip: the standing wrist, swing3d.js)
    handRest: arm.hand ? arm.hand.quaternion.clone() : null,
    // (and the sword forearm's rest on the upper arm: its twist, swing3d.js untwistForearm)
    foreRest: arm.fore ? arm.fore.quaternion.clone() : null,
    upperRest: arm.upper ? arm.upper.quaternion.clone() : null,
    offRest: offArm.fore ? { fore: offArm.fore.quaternion.clone(), upper: offArm.upper.quaternion.clone() } : null,
  };
  const offRest = rig.off?.hand ? rig.off.hand.quaternion.clone() : null;
  // (each collarbone's bind elevation in the chest's frame, before any clip: GIRDLE.cap)
  if (rig.chest) {
    model.updateMatrixWorld(true);
    const up = new Vector3(0, 1, 0).applyQuaternion(rig.chest.getWorldQuaternion(new Quaternion()));
    for (const a of [rig.arm, rig.off]) {
      if (!a?.shoulder || !a.upper) continue;
      const c = a.upper.getWorldPosition(new Vector3()).sub(a.shoulder.getWorldPosition(new Vector3())).normalize();
      gBind.set(a, Math.asin(Math.max(-1, Math.min(1, c.dot(up)))));
    }
  }
  // The run's chest, made a runner's (the TORSO and TARGETS lenses): the clip twists the chest ±43° a stride
  // (a runner's thorax ±12-18°) on a pelvis that does not turn, the neck and head counter-twisting as much.
  // Each of spine.002, spine.003, the neck and the head keeps RUN_TWIST of its turn about its own line (the
  // swing-twist split of its turn from rest), by the run's weight on the body; before the blend, so
  // inert.apply records it as the clip's own pose. (The run's free arm: swing3d.js freeRunArm.)
  const twistBones = ["DEF-spine.002", "DEF-spine.003", "DEF-neck", "DEF-head"].map(byName).filter(Boolean);
  const twistRest = twistBones.map((b) => b.quaternion.clone());
  const clavBones = [rig.arm?.shoulder, rig.off?.shoulder].filter(Boolean);
  const clavRest = clavBones.map((b) => b.quaternion.clone());
  function keepTwist(w, wc) {
    if (w < 1e-3 && wc < 1e-3) return;
    const k = 1 - (1 - RUN_TWIST) * w;
    // (and the collarbones' own clip motion, by the whole moving weight `wc`: it swings them against the arms;
    // GIRDLE moves them with the arms instead)
    const kc = 1 - (1 - RUN_CLAV) * wc;
    clavBones.forEach((b, i) => b.quaternion.copy(tw0.copy(clavRest[i]).slerp(b.quaternion, kc)));
    twistBones.forEach((b, i) => {
      tw0.copy(twistRest[i]).invert().multiply(b.quaternion);
      if (tw0.w < 0) tw0.set(-tw0.x, -tw0.y, -tw0.z, -tw0.w);
      tw1.set(0, tw0.y, 0, tw0.w).normalize();
      const a = 2 * Math.atan2(tw1.y, tw1.w);
      tw0.multiply(tw1.invert()); // the swing
      tw1.setFromAxisAngle(UP, a * k);
      b.quaternion.copy(twistRest[i]).multiply(tw0).multiply(tw1);
    });
  }
  const canCut = !!(rig.hips && arm.upper && arm.fore && arm.hand);
  // The hips' lead in a cut (HIP_DRIVE): where the phase puts them (radians, in the cut's own sense), followed.
  const hipS = { x: 0, v: 0 };
  const qHip = new Quaternion();
  const hipCounter = ["DEF-spine.001", "DEF-spine.002"].map(byName).filter(Boolean);
  function hipGoal(step, t) {
    const c = PLAYER.combo[step];
    const H = HIP_DRIVE[step] || HIP_DRIVE[0];
    const coil = (H.coil * Math.PI) / 180;
    const drive = (H.drive * Math.PI) / 180;
    if (t < c.wind) {
      const u = t / c.wind;
      return u < HIP_TURN ? -coil * smoothstep(0, 1, u / HIP_TURN) : -coil + (coil + 0.2 * drive) * smoothstep(0, 1, (u - HIP_TURN) / (1 - HIP_TURN));
    }
    if (t < c.wind + c.active) { const u = (t - c.wind) / c.active; return drive * (0.2 + 0.65 * (1 - (1 - u) * (1 - u))); }
    const u = (t - c.wind - c.active) / c.recover;
    return u < HIP_HOLD ? drive * (0.85 + 0.15 * smoothstep(0, 1, u / HIP_HOLD)) : drive * (1 - smoothstep(0, 1, (u - HIP_HOLD) / (HIP_BACK - HIP_HOLD)));
  }
  // (the thighs given the turn back as well: the pelvis turns over the legs, the feet keep the clip's own turn —
  // turned with the hips they swung 25° flat on the grass a cut and swing1 took an extra step to right them)
  const hipLegs = ["DEF-thigh.L", "DEF-thigh.R"].map(byName).filter(Boolean);
  const qHipBack = new Quaternion();
  function hipDrive(s, p, dt, first, inSwing = true) {
    // (only while the picker plays a swing: a killing cut's win, or a death, lets go at once — it stayed 16.5° on
    // through the whole victory)
    const goal = s.state === STATE.ATTACK && inSwing ? hipGoal(Math.min(2, p.step || 0), s.t) : 0;
    if (first) [hipS.x, hipS.v] = [goal, 0];
    else if (dt > 0) springStep(hipS, goal, HIP_HZ, 1, dt);
    if (Math.abs(hipS.x) < 1e-4 || !hipCounter.length) return;
    // (the sim's cut sweeps its yaw up, face − arc/2 to face + arc/2 for the left hand's forehand: a turn about the
    // world's up by −angle; the other way round for the right hand's, FORE)
    turnWorld(rig.hips, qHip.setFromAxisAngle(UP, -FORE * hipS.x));
    qHipBack.copy(qHip).invert();
    for (const b of hipLegs) turnWorld(b, qHipBack);
    for (const b of hipCounter) turnWorld(b, qHipBack, 1 / hipCounter.length);
  }
  // --- His arms (content/weapons.js): the main hand's weapon swapped in for the sword, the off hand's weapon or shield,
  // the lower hand on a two-handed weapon, a shield raised in a guard.
  let offWeapon = null;
  let armsNow = { main: "sword", off: null, twoHanded: false, offAct: "guard" };
  let offHoldW = 0; // how closed the off hand is round what it holds
  let guardW = 0; // how far the guard is raised
  // A blow on the raised guard knocks it back toward him and tips its top back, dying away in about a quarter second
  // (Elden Ring's guard-hit recoil; a guard break harder; a parry flicks it out instead).
  let guardKick = 0;
  let twoW = 0; // how far the lower hand is on a two-handed grip
  let carryRest = null; // where a cut recovers to: the weapon's own carry (the hero's frame), null for the sword's guard
  let offCut = null; // the off arm's cut pose this frame (world form), and how far it is on
  let offCutW = 0;
  const handScale = arm.hand ? arm.hand.getWorldScale(new Vector3()).x : 1;
  function equip(arms) {
    if (!arms || !arm.hand) return;
    // (a hafted great weapon one-handed held at its haft's foot: content/weapons.js tipIn)
    const slideOf = (id, two) => (!two && WEAPONS[id]?.foot ? -WEAPONS[id].foot : 0);
    if (arms.main !== armsNow.main || slideOf(arms.main, arms.twoHanded) !== (sword.info?.slide ?? 0)) {
      const was = sword;
      const at = { p: was.group.position.clone(), q: was.group.quaternion.clone(), parent: was.group.parent };
      at.parent?.remove(was.group);
      was.dispose?.();
      sword = makeWeapon(arms.main, look, { slide: slideOf(arms.main, arms.twoHanded) });
      sword.group.position.copy(at.p);
      sword.group.quaternion.copy(at.q);
      sword.group.scale.setScalar(1 / handScale);
      (at.parent || arm.hand).add(sword.group);
    }
    if (arms.off !== armsNow.off) {
      if (offWeapon) {
        offWeapon.group.parent?.remove(offWeapon.group);
        offWeapon.dispose();
        offWeapon = null;
      }
      if (arms.off && offGrip.ok) {
        offWeapon = makeWeapon(WEAPONS[arms.off]?.model || arms.off, look, { slide: slideOf(arms.off, false) });
        offWeapon.group.position.copy(offGrip.p);
        offWeapon.group.quaternion.copy(offWeapon.info.shield ? shieldGrip : offGrip.q);
        offWeapon.group.scale.setScalar(1 / offGrip.hs);
        offArm.hand.add(offWeapon.group);
      }
    }
    // (a new weapon's carry is its own: the last one's, as drawn, put a great club 0.1 into him at rest)
    if (arms.main !== armsNow.main) carryRest = null;
    armsNow = arms;
    if (WEAPONS[arms.main]?.carry === "shoulder") shoulderDepth = depthBelow(sword, 2 + (sword.info?.carrySlide ?? 0), 5.5 + (sword.info?.carrySlide ?? 0)); // (where it lies on the shoulder: carrySlide further up it)
    mainSamples = samplesOf(sword, arms.twoHanded);
    offSamples = offWeapon ? samplesOf(offWeapon) : null;
    // the tip as a share of his height (the heavy's slam onto the grass, swing3d.js applyArms)
    const st = sword.info?.strike?.[1];
    rig.tipH = (st ? Math.hypot(st[1], st[2]) : SWORD_TIP) / HERO_H;
    rig.tipLead = st ? Math.atan2(st[1], st[2]) : 0;
  }
  // The baked combo's pose at the video's time `t` (seconds), by `w`; the legs and the hips' place by `w` less the walk.
  const bakeBones = SWORD_BAKE ? SWORD_BAKE.bones.map(byName) : [];
  const bqA = new Quaternion(), bqB = new Quaternion(), bvA = new Vector3();
  // (`span`: how much of the video this frame covers; played faster than it was filmed — the game's pace runs it up to
  // 5× — the pose is the mean over that stretch, as a camera's blur: one sample, the video's quick let-go of the grip
  // took two hundredths of a second and the free hand flew off at 400 u/s²)
  const bAcc = [0, 0, 0, 0], bH = [0, 0, 0];
  function bakeSample(t, i, out) {
    const B = SWORD_BAKE, n = B.bones.length, q = B.q;
    const x = Math.min(B.frames - 1 - 1e-6, Math.max(0, (t - B.t0) * B.fps)), f = Math.floor(x), u = x - f;
    const ia = (f * n + i) * 4, ib = ((f + 1) * n + i) * 4;
    return out.set(q[ia], q[ia + 1], q[ia + 2], q[ia + 3]).slerp(bqB.set(q[ib], q[ib + 1], q[ib + 2], q[ib + 3]), u);
  }
  // (at the game's pace the video's clock runs 3-4× fast, and its slow sways came out a tremble — 10.6 px off a smooth
  // path, half the motion above 4 Hz; the owner, 2026-10-08: "all the body parts look like they have parkinsons". So the
  // pose is smoothed in the game's time: a Gaussian over ±2 of its frames, centred (the blade not behind the hitbox),
  // only where the clock runs faster than the video's own)
  const bakePre = [], bqC = new Quaternion(), bqD = new Quaternion();
  const BAKE_GS = globalThis.__bakeGS ?? 1.5, HAND_GS = globalThis.__handGS ?? 0.5; // (the smoothing's width, game frames)
  const BAKE_OFF = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map((o) => o * BAKE_GS), BAKE_W = BAKE_OFF.map((o) => Math.exp(-(o * o) / (2 * BAKE_GS * BAKE_GS)));
  // How much of a sword cut the other hand holds the grip: the baked combo's own share at its clock (SWORD_BAKE.both —
  // the owner, 2026-10-08: the free hand "looks retarded so make sure that that hand is also holding on to the sword
  // during the attacks"), else the cut's track's.
  function cutBothOf(cut) {
    const B = SWORD_BAKE;
    if (!B?.both || cut?.clipT == null) return cut?.both ?? 0;
    const x = Math.min(B.frames - 1 - 1e-6, Math.max(0, (cut.clipT - B.t0) * B.fps)), f = Math.floor(x);
    return B.both[f] + (B.both[f + 1] - B.both[f]) * (x - f);
  }
  function applyBake(t, w, moveW, span, dt) {
    const B = SWORD_BAKE;
    const wl = w * (1 - Math.min(1, moveW));
    const fast = span > 1.5 * dt;
    const n = fast ? BAKE_OFF.length : 1, at = (j) => (fast ? t + span * BAKE_OFF[j] : t), wt = (j) => (fast ? BAKE_W[j] : 1);
    let wSum = 0;
    for (let j = 0; j < n; j++) wSum += wt(j);
    bakeBones.forEach((bone, i) => {
      if (!bone) return;
      bAcc.fill(0);
      let ref = null;
      bakePre[i] = (bakePre[i] ?? new Quaternion()).copy(bone.quaternion);
      for (let j = 0; j < n; j++) {
        const s = bakeSample(at(j), i, bqA);
        if (!ref) ref = s.clone();
        const sg = (s.x * ref.x + s.y * ref.y + s.z * ref.z + s.w * ref.w < 0 ? -1 : 1) * wt(j);
        bAcc[0] += sg * s.x; bAcc[1] += sg * s.y; bAcc[2] += sg * s.z; bAcc[3] += sg * s.w;
      }
      bqA.set(bAcc[0], bAcc[1], bAcc[2], bAcc[3]).normalize();
      bone.quaternion.slerp(bqA, B.legs[i] ? wl : w);
    });
    bH.fill(0);
    for (let j = 0; j < n; j++) {
      const x = Math.min(B.frames - 1 - 1e-6, Math.max(0, (at(j) - B.t0) * B.fps)), f = Math.floor(x), u = x - f;
      const h = B.hips, ia = f * 3, ib = (f + 1) * 3;
      for (let d = 0; d < 3; d++) bH[d] += ((h[ia + d] + (h[ib + d] - h[ia + d]) * u) * wt(j)) / wSum;
    }
    rig.hips.position.lerp(bvA.set(bH[0], bH[1], bH[2]), wl);
    obj.updateMatrixWorld(true);
    // The sword hand's turn in the world as the bake has it unsmoothed (its chain's own turns at this moment): it sets the
    // blade, held to the hitbox through the live window — smoothed with the rest, the chop's tip jolted (849-1297 u/s²)
    if (fast && arm.hand) {
      const chain = [];
      for (let b = arm.hand; b && b !== rig.hips.parent; b = b.parent) chain.unshift(b);
      // (lightly blurred itself, ±HAND_GS of a game frame: unblurred, the blade stepped frame to frame)
      bAcc.fill(0);
      let ref = null;
      for (const o of [-1, -0.5, 0, 0.5, 1]) {
        rig.hips.parent.getWorldQuaternion(bqC);
        for (const b of chain) {
          const i = bakeBones.indexOf(b);
          bqC.multiply(i >= 0 ? bqD.copy(bakePre[i]).slerp(bakeSample(t + o * HAND_GS * span, i, bqA), B.legs[i] ? wl : w) : b.quaternion);
        }
        if (!ref) ref = bqC.clone();
        const g = Math.exp(-2 * o * o) * (bqC.dot(ref) < 0 ? -1 : 1);
        bAcc[0] += g * bqC.x; bAcc[1] += g * bqC.y; bAcc[2] += g * bqC.z; bAcc[3] += g * bqC.w;
      }
      setWorldQuaternion(arm.hand, bqC.set(bAcc[0], bAcc[1], bAcc[2], bAcc[3]).normalize());
      arm.hand.updateMatrixWorld(true);
    }
  }
  // Overlapping action over the baked combo (the owner, 2026-10-08: "natural movements like a real physics"): the chest,
  // neck, head and the free arm follow the bake through damped springs, as mass does — trailing the motion that drives
  // them a little and settling with a small overshoot, the way animators add follow-through on top of keyed or captured
  // motion. The sword arm and the legs stay exact: the blade is held to the hitbox, the feet to the ground. In real time,
  // so it acts the same at the video's tempo and the game's. (f Hz, ζ damping; the free arm's let go while the hand
  // holds the pommel)
  const ARM_F = globalThis.__armF ?? 7;
  const SPRINGS = [["DEF-spine003", 5, 0.8], ["DEF-neck", 4, 0.85], ["DEF-head", 3.5, 0.85], ["DEF-shoulderL", 4.5, 0.8], ["DEF-upper_armL", ARM_F, 0.75, true], ["DEF-forearmL", ARM_F, 0.75, true], ["DEF-handL", ARM_F, 0.75, true]]
    .map(([n, f, z, off]) => ({ bone: byName(n), w0: 2 * Math.PI * f, z, off, q: new Quaternion(), v: new Vector3(), on: false }))
    .filter((sp) => sp.bone);
  const spE = new Quaternion(), spV = new Vector3(), spQ = new Quaternion();
  function springPass(dt, w) {
    const SW = globalThis.__springW ?? 1;
    for (const sp of SPRINGS) {
      // (always running, following whatever pose there is, its weight alone fading in and out: reset each time the weight
      // touched nothing, between two cuts, the free hand snapped back — 230 u/s² at 2.72 s)
      sp.wS = dt > 0 ? (sp.wS ?? 0) + (w * SW * (sp.off ? 1 - Math.min(1, cutBothS) : 1) - (sp.wS ?? 0)) * Math.min(1, dt / 0.08) : 0;
      const wt = sp.wS;
      const tgt = sp.bone.quaternion;
      if (!(dt > 0)) { sp.q.copy(tgt); sp.v.set(0, 0, 0); sp.on = true; continue; }
      if (!sp.on) { sp.q.copy(tgt); sp.v.set(0, 0, 0); sp.on = true; }
      // (the miss as a turn — its axis times its angle, the short way — pulling the spring, damped by its spin)
      spE.copy(tgt).multiply(spQ.copy(sp.q).invert());
      if (spE.w < 0) spE.set(-spE.x, -spE.y, -spE.z, -spE.w);
      const s1 = Math.sqrt(Math.max(0, 1 - spE.w * spE.w)), ang = 2 * Math.acos(Math.min(1, spE.w));
      spV.set(spE.x, spE.y, spE.z).multiplyScalar(s1 > 1e-6 ? ang / s1 : 2);
      const h = Math.min(dt, 1 / 30);
      sp.v.addScaledVector(spV, sp.w0 * sp.w0 * h).multiplyScalar(1 / (1 + 2 * sp.z * sp.w0 * h));
      const a = sp.v.length() * h;
      if (a > 1e-9) sp.q.premultiply(spQ.setFromAxisAngle(spV.copy(sp.v).normalize(), a)).normalize();
      // (never more than 25° from the bake: a hard stop of the spring, not a flail)
      const dev = 2 * Math.acos(Math.min(1, Math.abs(sp.q.dot(tgt))));
      if (dev > 0.44) sp.q.copy(tgt).slerp(sp.q, 0.44 / dev);
      if (wt > 1e-4) sp.bone.quaternion.slerp(sp.q, wt);
    }
    obj.updateMatrixWorld(true);
  }
  // The lower hand on a two-handed grip, a shield carried or raised: after the main arm is posed, the off arm reaches
  // for its place (two-bone IK) and its hand turns to hold (setWorldQuaternion), by its weight.
  const oT = new Vector3(), oP = new Vector3(), oQ = new Quaternion(), oQ2 = new Quaternion(), oQ3 = new Quaternion(), oX = new Vector3(), oY = new Vector3(), oZ = new Vector3(), oM = new Matrix4(), oB = new Vector3();
  function offReach(target, qHand, w, poleOut = 1, poleAdd = null) {
    if (w <= 1e-3 || !offArm.upper || !offArm.fore || !offArm.hand) return;
    // (the wrist that puts the grip at `target` with the hand at `qHand`)
    oP.copy(offGrip.p).multiplyScalar(offGrip.hs).applyQuaternion(qHand);
    oT.copy(target).sub(oP);
    // the elbow out to the off side and down
    offArm.upper.getWorldPosition(oX);
    arm.upper.getWorldPosition(oY);
    oZ.subVectors(oX, oY).setY(0).normalize().multiplyScalar(poleOut).add(oY.set(0, -0.6, 0));
    if (poleAdd) oZ.add(poleAdd); // (and back, on a great weapon's shoulder carry: SHOULDER_CARRY.offBack)
    oZ.normalize();
    twoBoneIK(offArm.upper, offArm.fore, offArm.hand, oT, oZ, w);
    setWorldQuaternion(offArm.hand, qHand, w);
  }
  // A swing's cut for swing3d.js: the sword's own combo by its step (as it always was), any other move wrapped once
  // with the chain's next move (a buffered press winds into its coil).
  const chains = new WeakMap();
  function chainSpec(p) {
    const mv = moveOf(p);
    if (!mv.pose || mv.pose === "keyed" || !p.moveset) return Math.min(2, p.step || 0);
    const list = p.moveset;
    let wrapped = chains.get(list);
    if (!wrapped) chains.set(list, (wrapped = list.map((m, i) => ({ ...m, next: list[(i + 1) % list.length] }))));
    return wrapped[Math.min(p.step || 0, wrapped.length - 1)];
  }
  // (a shield in the off hand: its face, +Y, out past the knuckles — the grip frame's edge, mirrored from the sword's,
  // runs the other way, so the frame turned half round the handle)
  const shieldGrip = offGrip.q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI));
  // The off arm swinging a cut (an off-hand chain, or the off blade of a paired attack): the pose's grip place round
  // the chest and the weapon's turn, as applyArms does the sword arm's (swing3d.js `hold`), the hand set to hold it.
  const vCh = new Vector3(), vD2 = new Vector3(), vE2 = new Vector3(), vX2 = new Vector3(), qB2 = new Quaternion();
  function offSwing(pose, w) {
    if (w <= 1e-3 || !offWeapon || !offArm.upper || !rig.chest) return;
    rig.chest.getWorldPosition(vCh);
    const hipY = rig.hips.getWorldPosition(oX).y;
    const shY = offArm.upper.getWorldPosition(oY).y;
    const armLen = oY.distanceTo(offArm.fore.getWorldPosition(oZ)) + oZ.distanceTo(offArm.hand.getWorldPosition(oT));
    const at = new Vector3(vCh.x + Math.cos(pose.psiW) * pose.reach * armLen, hipY + pose.hh * (shY - hipY), vCh.z + Math.sin(pose.psiW) * pose.reach * armLen);
    const cp = Math.cos(pose.pitch);
    vD2.set(Math.cos(pose.a) * cp, Math.sin(pose.pitch), Math.sin(pose.a) * cp);
    const dE = pose.dir ?? 1;
    vE2.set(-Math.sin(pose.a) * dE, pose.tv ?? 0, Math.cos(pose.a) * dE).normalize().multiplyScalar(pose.edge ?? 1).addScaledVector(UP, 1 - (pose.edge ?? 1));
    vE2.addScaledVector(vD2, -vE2.dot(vD2));
    if (vE2.lengthSq() < 1e-6) vE2.set(0, 1, 0).addScaledVector(vD2, -vD2.y);
    vE2.normalize();
    vX2.crossVectors(vE2, vD2);
    qB2.setFromRotationMatrix(oM.makeBasis(vX2, vE2, vD2));
    const q = qB2.clone().multiply(oQ.copy(offWeapon.group.quaternion).invert());
    offReach(at, q, w);
  }
  // A weapon's cut aimed by its tip, not its blade's line (any weapon but the keyed sword): the hitbox runs out from his
  // middle along the sim's yaw, and the drawn hand is off to the side of that line (out at the sword side, or drawn in
  // for a two-handed grip), so the blade is turned by as much as puts hand + weapon on the line — the swept tip where
  // the sim sweeps it (the hand's place from handAt, the solver's own model).
  const hAt = [0, 0, 0];
  // (an axe's or hammer's striking edge lies off the haft's line, ahead in the sweep: `tipLead`, turned back by that)
  function aimTip(pose, face, sweep = 0) {
    if (!pose || typeof cutStep === "number" || !(rig.tipH > 0)) return pose; // (not the sword's own stepped combo: its blade is its hitbox already)
    handAt(pose, face, hAt);
    const a = face + pose.r;
    const len = rig.tipH * Math.cos(pose.pitch ?? 0);
    if (len < 0.05) return pose;
    const perp = hAt[0] * Math.sin(a) - hAt[2] * Math.cos(a);
    const k = Math.max(-0.95, Math.min(0.95, perp / len));
    // (by `aimW`: let go of over a recovery, swing3d.js bladeAt)
    return { ...pose, r: pose.r + (Math.asin(k) - Math.sign(sweep) * FORE * (rig.tipLead || 0)) * (pose.aimW ?? 1) }; // (ahead the way it sweeps in the world)
  }
  // ...and an off-hand cut's, the same for the off weapon (its hand modelled as the sword hand's mirror image).
  function aimTipOff(pose, face, sweep = 0) {
    const st = offWeapon?.info?.strike?.[1];
    if (!pose || !st) return pose;
    handAt(mirrorCut(pose), face, hAt);
    const fx = Math.cos(face), fz = Math.sin(face);
    const along = hAt[0] * fx + hAt[2] * fz;
    const hx = 2 * along * fx - hAt[0], hz = 2 * along * fz - hAt[2]; // (mirrored back across his facing)
    const a = face + pose.r;
    const len = (Math.hypot(st[1], st[2]) / HERO_H) * Math.cos(pose.pitch ?? 0);
    if (len < 0.05) return pose;
    const perp = hx * Math.sin(a) - hz * Math.cos(a);
    const k = Math.max(-0.95, Math.min(0.95, perp / len));
    return { ...pose, r: pose.r + Math.asin(k) - Math.sign(sweep) * FORE * Math.atan2(st[1], st[2]) };
  }
  // Over the shoulder (Elden Ring's "Over the Shoulder" stance set: every great weapon, both grips — the owner,
  // 2026-10-04: "greatsword is stabbed through chest but should be held over the shoulder exactly as in elden ring").
  // Built from his own bones each frame, so it stays on the shoulder as he walks, turns and breathes: the hands up in
  // front of the chest a little to the weapon side, the blade laid back over the weapon-side shoulder on its edge,
  // its flat to the side, resting on the top of the shoulder (its cowl and collar, measured over the skinned mesh)
  // and running on up behind; the sword arm reaches it by two-bone IK, the elbow down. SHOULDER_CARRY: the grip's and
  // the rest's places from the weapon-side shoulder joint (forward, out to the weapon side, up), in his height's shares.
  // --- Keeping what he holds out of him (anim/bodyproxy.js): his own skin, sparsely, skinned each frame; after the
  // arms are posed, any part of a weapon that would be in him turns the hand (about the wrist) just far enough to take
  // it out, the deepest first, a few times over; what is too near the fist to turn out moves the wrist instead.
  const body = skinned[0]?.geometry.attributes.skinIndex ? makeBodyProxy(skinned[0], fitBodySkin(skinned[0], { n: AVOID.points }), { reach: AVOID.reach }) : null;
  let mainSamples = null, offSamples = null;
  // (all of it but the grip in the fists: from the lower hand's place on a two-handed one; a shield's grip is its centre)
  // (only what the fists cover: from half a hand below the lower one — 0.9 below it left a great sword's whole pommel
  // unwatched, and it went into his armpit)
  // (the lower hand's stretch only when it holds it: a two-handed weapon in one hand beside a shield had its whole bare
  // grip below the fist left unwatched, and it lay in his belly)
  const samplesOf = (w, two = false) => (w.info?.shield ? weaponSamples(w, [-1, 1], 0.6) : weaponSamples(w, [Math.min(-0.5, two ? (w.info?.off ?? 0) - 0.45 : 0), 1.0]));
  const aV = { p: new Vector3(), n: new Vector3(), h: new Vector3(), v: new Vector3(), ax: new Vector3(), q: new Quaternion(), qh: new Quaternion(), best: new Vector3(), bn: new Vector3(), t: new Vector3(), pole: new Vector3() };
  // (each weapon's correction as applied: a turn of the hand about the wrist and a shift of the wrist, eased towards the
  // solved one each frame — in over AVOID.tauIn, let go over AVOID.tauOut: solved from scratch each frame it popped)
  const avoidState = new Map();
  const aS = { su: new Quaternion(), sf: new Quaternion(), sh: new Quaternion(), q0: new Quaternion(), h0: new Vector3(), qu: new Quaternion(), qf: new Quaternion(), qh: new Quaternion(), qT: new Quaternion(), dT: new Vector3(), tgt: new Vector3() };
  // the deepest of the weapon's points in him now (into aV.best, aV.bn; its own place along it into aV.z)
  function deepest(w, samples) {
    w.group.updateWorldMatrix(true, false);
    let deep = -Infinity;
    for (const sp of samples) {
      aV.p.copy(sp).applyMatrix4(w.group.matrixWorld);
      const d = body.depth(aV.p, AVOID.margin, aV.n);
      if (d > deep) (deep = d), aV.best.copy(aV.p), aV.bn.copy(aV.n), (aV.z = sp.z);
    }
    return deep;
  }
  function solveOut(w, a, samples, turnW) {
    let deep = deepest(w, samples);
    let turned = 0, moved = 0;
    for (let it = 0; it < AVOID.iters && deep > 1e-3; it++) {
      a.hand.getWorldPosition(aV.h);
      aV.v.subVectors(aV.best, aV.h);
      const L = aV.v.length();
      // (far out along the weapon the hand turns about the wrist; near the fist, and anywhere behind it — a pommel, a
      // haft's foot, where a turn would swing the whole length round to move it — the hands move out instead)
      const turn = aV.z > 0 ? smoothstep(AVOID.turnFrom[0], AVOID.turnFrom[1], L) * turnW : 0;
      aS.su.copy(a.upper.quaternion), aS.sf.copy(a.fore.quaternion), aS.sh.copy(a.hand.quaternion);
      let ang = 0, step = 0;
      if (turn > 1e-3) {
        aV.ax.crossVectors(aV.v, aV.bn);
        if (aV.ax.lengthSq() > 1e-10) {
          aV.ax.normalize();
          ang = Math.min(AVOID.maxTurn, Math.atan2(deep, L) * AVOID.gain, AVOID.maxTurned - turned) * turn;
          a.hand.getWorldQuaternion(aV.qh);
          aV.q.setFromAxisAngle(aV.ax, ang).multiply(aV.qh);
          setWorldQuaternion(a.hand, aV.q, 1);
        }
      }
      if (turn < 1 - 1e-3) {
        step = Math.min(deep * AVOID.gain * (1 - turn), AVOID.maxMoved - moved);
        a.hand.getWorldQuaternion(aV.qh);
        a.fore.getWorldPosition(aV.pole).sub(a.upper.getWorldPosition(aV.t));
        aV.t.copy(aV.h).addScaledVector(aV.bn, step);
        twoBoneIK(a.upper, a.fore, a.hand, aV.t, aV.pole.normalize(), 1);
        setWorldQuaternion(a.hand, aV.qh, 1);
      }
      a.hand.updateMatrixWorld(true);
      // (kept only if it took the weapon further out; else undone, and that is as far as it goes)
      const now = deepest(w, samples);
      if (now >= deep - 1e-3 || (ang < 1e-4 && step < 1e-4)) {
        a.upper.quaternion.copy(aS.su), a.fore.quaternion.copy(aS.sf), a.hand.quaternion.copy(aS.sh);
        a.upper.updateMatrixWorld(true);
        break;
      }
      (deep = now), (turned += ang), (moved += step);
    }
  }
  // (how far into a cut's live window: none before it to a twentieth of a second before, all through it, none again a
  // twentieth after)
  const liveShare = (p, s) => {
    if (s.state !== STATE.ATTACK) return 0;
    const mv = moveOf(p);
    const a = mv.wind, b = mv.wind + mv.active;
    return s.t < a ? smoothstep(a - 0.05, a, s.t) : s.t <= b ? 1 : 1 - smoothstep(b, b + 0.05, s.t);
  };
  // how much further out the weapon's tip may go before it is past AVOID.reachCap of the hitbox's reach (`range`), on
  // the ground from his middle
  const tipRoom = (w, range) => {
    if (!w?.tip || !(range > 0)) return Infinity;
    w.group.updateWorldMatrix(true, false);
    aV.p.copy(w.tip).applyMatrix4(w.group.matrixWorld);
    return AVOID.reachCap * range - Math.hypot(aV.p.x - obj.position.x, aV.p.z - obj.position.z);
  };
  function avoidBody(w, a, samples, dt, turnW, room) {
    if (!body || !w || !samples?.length || !a.hand || globalThis.__noAvoid) return 0;
    let st = avoidState.get(a);
    if (!st || st.w !== w) avoidState.set(a, (st = { w, q: new Quaternion(), d: new Vector3() }));
    // the pose as it came, kept, then the full correction solved for it
    a.hand.getWorldQuaternion(aS.q0);
    a.hand.getWorldPosition(aS.h0);
    aS.qu.copy(a.upper.quaternion), aS.qf.copy(a.fore.quaternion), aS.qh.copy(a.hand.quaternion);
    solveOut(w, a, samples, turnW);
    a.hand.getWorldQuaternion(aS.qT).multiply(aV.q.copy(aS.q0).invert()); // the turn it took (world)
    a.hand.getWorldPosition(aS.dT).sub(aS.h0); // the wrist's shift
    // back to the pose as it came, and the eased correction applied to it
    a.upper.quaternion.copy(aS.qu), a.fore.quaternion.copy(aS.qf), a.hand.quaternion.copy(aS.qh);
    a.upper.updateMatrixWorld(true);
    if (dt > 0) {
      const more = 2 * Math.acos(Math.min(1, Math.abs(aS.qT.w))) > 2 * Math.acos(Math.min(1, Math.abs(st.q.w))) || aS.dT.lengthSq() > st.d.lengthSq();
      const k = 1 - Math.exp(-dt / (more ? AVOID.tauIn : AVOID.tauOut));
      st.q.slerp(aS.qT, k);
      st.d.lerp(aS.dT, k);
    } else if (dt < 0) (st.q.copy(aS.qT), st.d.copy(aS.dT));
    // (through a cut's live window, where the blade's line is the hitbox's, the hands only move out, the blade's turn
    // kept: `turnW` 0 there)
    if (st.d.lengthSq() > 1e-8) {
      aS.tgt.copy(aS.h0).add(st.d);
      // (and along the blade's own bearing, out from him, no further than its tip may go past the hitbox's end: `room`)
      if (turnW < 1) {
        w.group.updateWorldMatrix(true, false);
        aV.v.set(0, 0, 1).transformDirection(w.group.matrixWorld).setY(0);
        if (aV.v.lengthSq() > 1e-8) {
          aV.v.normalize();
          const over = st.d.dot(aV.v) - Math.max(0, room);
          if (over > 0) aS.tgt.addScaledVector(aV.v, -over * (1 - turnW));
        }
      }
      a.fore.getWorldPosition(aV.pole).sub(a.upper.getWorldPosition(aV.t));
      twoBoneIK(a.upper, a.fore, a.hand, aS.tgt, aV.pole.normalize(), 1);
    }
    setWorldQuaternion(a.hand, aV.q.identity().slerp(st.q, turnW).multiply(aS.q0), 1);
    a.hand.updateMatrixWorld(true);
    return 1;
  }
  const Z_AXIS = new Vector3(0, 0, 1);
  let carryTwist = 0; // (the hands' turn round a weapon on the shoulder this frame: SHOULDER_CARRY.twist)
  let carrySlideNow = 0; // (how far up its haft the hands hold a weapon on the shoulder this frame: weapons3d.js carrySlide)
  const sC = { sl: new Vector3(), qT: new Quaternion(), q2: new Quaternion(), rel: new Matrix4(), sc: new Vector3(), S: new Vector3(), O: new Vector3(), U: new Vector3(0, 1, 0), F: new Vector3(), out: new Vector3(), G: new Vector3(), R: new Vector3(), D: new Vector3(), Y: new Vector3(), X: new Vector3(), q: new Quaternion(), qh: new Quaternion(), qg: new Quaternion(), t: new Vector3(), pole: new Vector3(), m: new Matrix4() };
  let shoulderDepth = 0.52; // the weapon's depth below its line where it lies on the shoulder (equip)
  function shoulderCarry(w) {
    if (w <= 1e-3 || !arm.upper || !arm.fore || !arm.hand || !offArm.upper) return;
    const C = globalThis.__shoulder ?? SHOULDER_CARRY;
    const H = HERO_H;
    arm.upper.getWorldPosition(sC.S);
    offArm.upper.getWorldPosition(sC.O);
    // his frame from the shoulder line: out to the weapon side, forward square to it, up
    sC.out.subVectors(sC.S, sC.O).setY(0).normalize();
    sC.F.crossVectors(sC.out, sC.U).normalize();
    if (side === "R") sC.F.negate(); // (the other hand's weapon side: forward the other way round the cross)
    // (a broader weapon than the greatsword held a little further out in front and laid a little further out on the
    // shoulder, its depth past the greatsword's `dd`: the colossal sword's slab hit his chin and its quillon his chest)
    const dd = shoulderDepth - (C.depth ?? 0.52);
    const pg = C.perDepth?.grip ?? [0, 0, 0], pr = C.perDepth?.rest ?? [0, 0, 0];
    sC.G.copy(sC.S).addScaledVector(sC.F, (C.grip[0] + pg[0] * dd) * H).addScaledVector(sC.out, (C.grip[1] + pg[1] * dd) * H).addScaledVector(sC.U, (C.grip[2] + pg[2] * dd) * H);
    sC.R.copy(sC.S).addScaledVector(sC.F, (C.rest[0] + pr[0] * dd) * H).addScaledVector(sC.out, (C.rest[1] + pr[1] * dd) * H).addScaledVector(sC.U, (C.rest[2] + pr[2] * dd) * H + dd);
    // (a broad one laid further out on the shoulder behind a raised shield, `shieldOut` of his height for the colossal
    // sword's depth past the greatsword's: hunched behind the shield his hood came into its line, 0.13-0.39; lifted, the
    // greatsword's own came into the hood, 0.5)
    const sw2 = offWeapon?.info?.shield ? guardW * Math.max(0, dd) / 0.545 : 0;
    if (sw2 > 0) sC.R.addScaledVector(sC.out, (C.shieldOut ?? 0) * sw2 * H);
    // (and the fist further out to the weapon side, `shieldGripOut`: the shield hand came across his chest in front of
    // it and the grip's foot lay in that wrist, 0.2-0.5)
    if (offWeapon?.info?.shield && guardW > 0) sC.G.addScaledVector(sC.out, (C.shieldGripOut ?? 0) * guardW * H);
    sC.D.subVectors(sC.R, sC.G).normalize(); // the weapon's length, from the grip back over the shoulder
    // (two-handed, the hands as a pair round the grip's place: the upper one moved up the weapon by a share of how far
    // past the greatsword's the lower one holds — the colossal sword's lower grip, at its foot, was out of the arm's reach)
    // (and a broad one's by its depth past the greatsword's, `depthShift`: the colossal sword's as before its grip was
    // made one for two hands side by side — moved up its old long one, 0.83, it lay clear of his hood)
    if (armsNow.twoHanded && sword.info?.off != null) sC.G.addScaledVector(sC.D, Math.max(0, -sword.info.off - 2.35) * (globalThis.__shoulderShift ?? C.pairShift ?? 0) + Math.max(0, dd) * (C.depthShift ?? 0));
    // (a hafted weapon held `carrySlide` higher up its haft on the shoulder: it slides down through the fists along its own
    // line, so the fists stay and its foot stands out below the lower one — the owner's side view of the great club)
    const slideC = (sword.info?.carrySlide ?? 0) * w;
    if (slideC) sC.G.addScaledVector(sC.D, -slideC);
    // on its edge: the edge (+Y) up, square to the length, the flat to the side — a broad one rolled out a little,
    // its upper edge leaned away from his head (`roll` per unit of depth past the greatsword's)
    const roll = (C.rollBase ?? 0) + Math.min(C.rollMax ?? 0.6, Math.max(0, (shoulderDepth - (C.depth ?? 0.52)) * (C.roll ?? 0)));
    sC.Y.copy(sC.U).multiplyScalar(Math.cos(roll)).addScaledVector(sC.out, Math.sin(roll));
    sC.Y.addScaledVector(sC.D, -sC.Y.dot(sC.D)).normalize();
    sC.X.crossVectors(sC.Y, sC.D);
    sC.qg.setFromRotationMatrix(sC.m.makeBasis(sC.X, sC.Y, sC.D)); // the weapon's turn in the world
    // the hand that puts the weapon there, holding it as it sits in the fist now (whatever stands between them)
    sword.group.position.lerp(grip.p, w); // (wholly in the fist: no slide)
    if (slideC) sword.group.position.addScaledVector(sC.sl.set(0, 0, 1).applyQuaternion(sword.group.quaternion), -slideC * sword.group.scale.x);
    carrySlideNow = slideC;
    arm.hand.updateMatrixWorld(true);
    sC.rel.copy(arm.hand.matrixWorld).invert().multiply(sword.group.matrixWorld);
    sword.group.matrixWorld.decompose(sC.t, sC.q, sC.sc);
    // (the hands turned round the weapon's length by `twist`, the weapon not: its round grip turns in the fists — so
    // they wrap over it from above, knuckles up and back, as the owner's reference holds a great club on the shoulder;
    // as the weapon's own turn put them, beside it, the fingers stood up past the grip)
    const twist = FORE * (C.twist ?? 0); // (a turn about the weapon's own line: the right hand's the other way round)
    sC.qT.setFromAxisAngle(Z_AXIS, twist);
    sC.m.compose(sC.G, sC.q2.copy(sC.qg).multiply(sC.qT), sC.sc).multiply(sC.rel.invert());
    sC.m.decompose(sC.t, sC.qh, sC.sc);
    // the elbow down and a little out to the weapon side
    sC.pole.set(0, -1, 0).addScaledVector(sC.out, 0.35).normalize();
    twoBoneIK(arm.upper, arm.fore, arm.hand, sC.t, sC.pole, w);
    setWorldQuaternion(arm.hand, sC.qh, w);
    if (rig.handRest) forearmRoll(arm, rig.handRest, w);
    if (twist) {
      sword.group.quaternion.multiply(sC.qT.setFromAxisAngle(Z_AXIS, -twist * w));
      sword.group.updateMatrixWorld(true);
      carryTwist = twist * w; // (the lower hand turned with it: offPass)
    }
  }
  // The lower hand on the grip: where the weapon's own `off` place is (`gripOff` along it), the hand turned to hold it as
  // the main hand does, by `twoW` (offPass; and again over the baked sword combo, whose both-hands share sets it).
  function gripOffHand(twoW, gripOff, faceWorld) {
    sword.group.updateWorldMatrix(true, false);
    oP.set(0, 0, gripOff + carrySlideNow).applyMatrix4(sword.group.matrixWorld);
    // (the lower grip out of the arm's reach — held at the grip's foot as Elden Ring holds them: the weapon comes to
    // it, the sword hand moved towards the other shoulder by what is wanting, the weapon's turn kept)
    offArm.upper.getWorldPosition(oX);
    const offLen = oX.distanceTo(offArm.fore.getWorldPosition(oY)) + oY.distanceTo(offArm.hand.getWorldPosition(oZ));
    const want = oP.distanceTo(oX) - TWO_REACH * offLen;
    if (want > 1e-3) {
      arm.hand.getWorldQuaternion(oQ2);
      arm.hand.getWorldPosition(oT).addScaledVector(oY.subVectors(oX, oP).normalize(), want * twoW);
      arm.fore.getWorldPosition(oZ).sub(arm.upper.getWorldPosition(oY));
      twoBoneIK(arm.upper, arm.fore, arm.hand, oT, oZ.normalize(), 1);
      setWorldQuaternion(arm.hand, oQ2, 1);
      arm.hand.updateMatrixWorld(true);
      sword.group.updateWorldMatrix(true, false);
      oP.set(0, 0, gripOff + carrySlideNow).applyMatrix4(sword.group.matrixWorld);
    }
    reachShoulder(offArm, oP, offLen, twoW);
    sword.group.getWorldQuaternion(oQ);
    if (carryTwist) oQ.multiply(oQ2.setFromAxisAngle(Z_AXIS, carryTwist));
    oQ.multiply(oQ2.copy(offGrip.q).invert());
    // (on the shoulder carry the elbow back by his side as well, the forearm coming forward to the haft — the owner's
    // reference: out and down only, it rose level with the shoulder and the arm reached out straight)
    const back = shoulderLetGo * ((globalThis.__shoulder ?? SHOULDER_CARRY).offBack ?? 0);
    offReach(oP.clone(), oQ.clone(), twoW, 0.6, back > 0 ? oB.set(-Math.cos(faceWorld), 0, -Math.sin(faceWorld)).multiplyScalar(back) : null);
  }
  function offPass(p, s, faceWorld, dt, live) {
    const shield = !!offWeapon?.info?.shield;
    const guarding = s.state === STATE.GUARD && live;
    guardW = dt > 0 ? guardW + Math.max(-dt / 0.12, Math.min(dt / 0.08, (guarding ? 1 : 0) - guardW)) : guarding ? 1 : 0;
    if (dt > 0) guardKick *= Math.exp(-dt / 0.09);
    const twoWant = armsNow.twoHanded && live && s.state !== STATE.ROLL ? 1 : 0;
    twoW = dt > 0 ? twoW + Math.max(-dt / 0.1, Math.min(dt / 0.1, twoWant - twoW)) : twoWant;
    // (a one-handed sword's cut that takes the other hand onto the grip for a while — the owner's video, 2026-10-07: up
    // onto the pommel as the backhand rises, through the overhead chop and its low hold — by its track's `both`)
    // (let go of over at least 0.15 s: at the game's pace the video's let-go, 0.1 s of it, is 0.02 s, and the free hand
    // flew off the pommel at 360 u/s² — taken on as fast as the track asks)
    // (over the baked combo, let go of with the bake itself as it fades into the stand after the last cut — by its own
    // 0.15 s, the hand left the grip in a straight dash, 101 u/s, stopping dead)
    const bakedBoth = !!SWORD_BAKE?.both && cut?.clipT != null;
    const bothTo = !offWeapon && cut && live && (s.state === STATE.ATTACK || bakedBoth) ? Math.min(1, Math.max(0, cutBothOf(cut))) * cutW : 0;
    cutBothS = dt > 0 ? Math.max(bothTo, cutBothS - dt / 0.15) : bothTo;
    const gripW = Math.max(twoW, cutBothS);
    const gripOff = sword.info?.off ?? (cutBothS > 0 ? SWORD_TWO_OFF : null);
    offHoldW = Math.max(offWeapon ? 1 : 0, gripW);
    if (!offArm.hand) return;
    // The lower hand on the grip: where the weapon's own `off` place is, the hand turned to hold it as the main hand does.
    if (gripW > 1e-3 && gripOff != null) gripOffHand(gripW, gripOff, faceWorld);
    // The free hand where a sword cut fitted to the owner's video has it (its track's oh*: in front of the belt through
    // the draw, out to the side for balance at the whip — it hung by his thigh, the video's held up with the elbow bent),
    // given up to the grip as the other hand takes the sword.
    // (not under the keyed combo's bake, which poses that arm itself: under it, the video's free hand sat 120-170° of
    // forearm away from the bake's, and the fade between them flipped the arm half round — the owner's "teleporting in")
    const ohW = !offWeapon && cut && live && s.state === STATE.ATTACK && !SWORD_BAKE?.both ? Math.min(1, Math.max(0, cut.ohw ?? 0)) * cutW * (1 - gripW) : 0;
    if (ohW > 1e-3 && arm.upper && offArm.upper) {
      // (his own frame, not his shoulders': the cut's twist turns the chest half round, and out along the shoulder line
      // the hand went 0.18 of his height wide of where the video has it)
      const fw = oB.set(Math.cos(faceWorld), 0, Math.sin(faceWorld));
      offArm.upper.getWorldPosition(oX);
      arm.upper.getWorldPosition(oY);
      const side = new Vector3(-fw.z, 0, fw.x);
      const out = side.multiplyScalar(oX.sub(oY).dot(side) >= 0 ? 1 : -1); // (towards his off side)
      const at = obj.position.clone().addScaledVector(fw, (cut.ohf ?? 0) * HERO_H).addScaledVector(out, (cut.ohs ?? 0) * HERO_H);
      at.y = obj.position.y + (cut.ohu ?? 0.5) * HERO_H;
      offReach(at, offArm.hand.getWorldQuaternion(oQ3), ohW, 1);
    }
    // An off-hand chain's cut, or a paired attack's off blade (the main blade's pose mirrored across his facing).
    if (offCutW > 1e-3 && offCut && offWeapon && !shield) {
      offSwing(offCut, offCutW);
      return;
    }
    if (shield) {
      // A shield: carried at his side, its face out to the side, on the hanging forearm; raised in a guard in front of
      // his chest, its face to the front, a greatshield planted lower before him. (Its frame: face +Y, height +Z.)
      offArm.upper.getWorldPosition(oX);
      arm.upper.getWorldPosition(oY);
      const offSide = oX.clone().sub(oY).setY(0).normalize();
      const fwd = new Vector3(Math.cos(faceWorld), 0, Math.sin(faceWorld)); // (a facing in world x, z, as the sim's)
      const big = offWeapon.info.shield.kind === "great";
      const H = HERO_H;
      const root = obj.position;
      // carried: low at the side, a little forward
      const carryAt = root.clone().addScaledVector(offSide, big ? 0.27 * H : 0.24 * H).addScaledVector(fwd, big ? 0.12 * H : 0.06 * H).setY(big ? 0.4 * H : 0.47 * H);
      // (each frame an orthonormal basis: face along `y`, height up, the third their cross product)
      const basis = (y, q) => {
        const Y = y.clone().setY(0).normalize();
        const Z = new Vector3(0, 1, 0);
        return q.setFromRotationMatrix(oM.makeBasis(new Vector3().crossVectors(Y, Z), Y, Z));
      };
      const carryQ = basis(offSide, oQ);
      // raised: in front of the chest, a little to the off side
      const guardAt = root.clone().addScaledVector(fwd, (big ? 0.3 : 0.33) * H).addScaledVector(offSide, 0.06 * H).setY((big ? 0.43 : 0.62) * H);
      // (within the arm's reach — asked 0.33 of his height ahead, the arm was straight and its hand 0.25 out — so a
      // blow's knock back moves it: measured 0.06 of a 1.4 knock with the place out of reach)
      offArm.upper.getWorldPosition(oT);
      const armLen = oT.distanceTo(offArm.fore.getWorldPosition(oZ)) + oZ.distanceTo(offArm.hand.getWorldPosition(oP));
      const out = guardAt.distanceTo(oT);
      if (out > armLen * 0.92) guardAt.sub(oT).multiplyScalar((armLen * 0.92) / out).add(oT);
      guardAt.addScaledVector(fwd, -guardKick * 0.07 * H).y += guardKick * 0.015 * H;
      const guardQ = basis(fwd, oQ2);
      // (the blow tips its top back toward him: about the axis across his front)
      if (Math.abs(guardKick) > 1e-3) guardQ.premultiply(oQ3.setFromAxisAngle(oX.crossVectors(fwd, UP).normalize(), guardKick * 0.36));
      const at = carryAt.lerp(guardAt, smoothstep(0, 1, guardW));
      const q = carryQ.clone().slerp(guardQ, smoothstep(0, 1, guardW)).multiply(oQ.copy(shieldGrip).invert());
      // (less of the carry while the main hand swings: the body turns, the shield goes with the forearm)
      const w = Math.max(guardW, s.state === STATE.ATTACK ? 0.55 : 0.9);
      offReach(at, q, w);
    }
  }

  /** The hips as the clip and the stride have them, without the drive, for `fn` (the blend's record of them). */
  function withoutHipDrive(fn) {
    const on = Math.abs(hipS.x) >= 1e-4 && hipCounter.length; // (hipS only moves in hipDrive: keyed cuts, canCut)
    if (on) turnWorld(rig.hips, qHip.setFromAxisAngle(UP, FORE * hipS.x));
    fn();
    if (on) turnWorld(rig.hips, qHip.setFromAxisAngle(UP, -FORE * hipS.x));
  }
  // The living layers (anim/hero-life.js): breath, sway, weight on one leg, look-at, the stop's rock,
  // a hit's lean and shake. The hanging hands' swing from them reaches applyArms as `rig.sway`.
  const life = canCut ? makeHeroLife(rig, HERO_H) : null;
  if (life) [rig.sway, rig.swayFree, rig.swaySword] = [life.sway, life.swayFree, life.swaySword];
  // The painted hero's cape and tabard as cloth over the clip (anim/cloth.js): the clips key their
  // bones, so alone they moved exactly with the body and stopped with it.
  const clothChains = [["cape.001.L", "cape.002.L"], ["cape.001", "cape.002"], ["cape.001.R", "cape.002.R"], ["tabard"]]
    .map((ch) => ch.map((n) => byName(`DEF-${n}`)))
    .filter((ch) => ch.every(Boolean));
  const tabard = byName("DEF-tabard");
  const clothLegs = ["L", "R"].flatMap((sd) => [
    { a: byName(`DEF-thigh.${sd}`), b: byName(`DEF-shin.${sd}`), r: 0.07 * HERO_H },
    { a: byName(`DEF-shin.${sd}`), b: byName(`DEF-foot.${sd}`), r: 0.055 * HERO_H },
  ]).filter((c) => c.a && c.b);
  const clothLen = new Vector3();
  // (a chain's last bone: as long as the one before it; the tabard to the middle of the thigh)
  // (the cape's three chains held together side by side: CLOTH.spread)
  const capeIdx = clothChains.map((ch, i) => (ch[0] !== tabard ? i : -1)).filter((i) => i >= 0);
  const clothPairs = capeIdx.slice(1).map((i, k) => [capeIdx[k], i]);
  const cloth = !cape && clothChains.length ? makeCloth(clothChains, clothLegs, (b) => (b === tabard ? 0.2 * HERO_H : b.getWorldPosition(clothLen).distanceTo(b.parent.getWorldPosition(swHand))), { pairs: clothPairs }) : null;
  const colliderBones = ["DEF-hips", "DEF-thigh.L", "DEF-thigh.R", "DEF-shin.L", "DEF-shin.R"].map(byName).filter(Boolean);
  const balls = colliderBones.map((b, i) => ({ bone: b, c: new Vector3(), r: i === 0 ? 3.2 : 2.1 }));
  const rec = makeHeroRecord({ lead: spec.mirror ? "L" : "R" });
  // Swing marks in clip seconds (the picker's time warp). Keyed cuts: the clip's own times are the
  // sim's (wind-up, live window, recovery), so the warp is exact. Otherwise the game poses the cuts
  // itself, over the idle, and the marks only matter for a clip it never shows.
  const sw = sampler.durations.swing1 || 1;
  // (Keyed: the follow-through's end too, which a buffered next swing holds: hero_clips.py FOLLOW.)
  const marks = spec.keyedCuts
    ? Object.fromEntries(PLAYER.combo.map((c, i) => [`swing${i + 1}`, { windEnd: c.wind, liveEnd: c.wind + c.active, end: c.wind + c.active + c.recover, followHold: c.wind + c.active + KEYED_FOLLOW[i] * c.recover }]))
    : { swing1: { windEnd: sw * 0.32, liveEnd: sw * 0.5, end: sw }, swing2: { windEnd: sw * 0.32, liveEnd: sw * 0.5, end: sw }, swing3: { windEnd: sw * 0.3, liveEnd: sw * 0.52, end: sw } };
  // The model bench's hold (anim/hold.js), made only on the bench. Besides the file's clips it holds
  // the game's own cuts, cut1–cut3, as a fight shows them out of the idle at that swing time: for
  // swing3d.js's cuts, the idle's first frame with the cut; for keyed cuts, the file's swing (on the
  // picker's time warp) with the carry over it as far as the fight has it on (keyedCarryW: out of the
  // carry in the wind-up, back into it on the way back), so a review sees what the fight shows.
  const cuts = Object.fromEntries(PLAYER.combo.map((c, i) => [`cut${i + 1}`, spec.keyedCuts ? { duration: c.wind + c.active + c.recover, base: `swing${i + 1}`, layers: (t) => keyedLayers(heroAnimState(makeHeroRecord({ lead: spec.mirror ? "L" : "R" }), { x: 0, y: 0, step: i, buffer: null }, { state: STATE.ATTACK, t, face: benchFace, vx: 0, vy: 0 }, { t: 0, stateT: 0, worldState: "fight" }, sampler.durations, marks).layers, keyedBack(benchFace)) } : { duration: c.wind + c.active + c.recover, base: "idle" }]));
  // Each keyed swing ends two ways (hero_clips.py swingN and swingNb): where the camera sees his back
  // and left (swing3d.js keyedBack) the picker's swingN is played as swingNb. The choice is made as a
  // swing starts and kept to its end (`swingB`, below), so a swing never switches clips part way.
  const keyedLayers = (layers, back) => (spec.keyedCuts && back ? layers.map((l) => (/^swing\d$/.test(l.clip) && sampler.durations[`${l.clip}b`] ? { ...l, clip: `${l.clip}b` } : l)) : layers);
  let benchFace = 0; // (the facing a held cut1–3 is shown at)
  const hold = bench.on ? (bench.hero = makeHold({ root: obj, bones, sampler, clips: clipsFor(asset, spec), names: spec.names, rig: "hero", extra: cuts })) : null;

  const benchPickFor = (r) => {
    const run = r.clip === "run" ? 1 : 0;
    const move = r.clip === "idle" ? 0 : 1;
    const u = (Number(r.time) || 0) / (sampler.durations[r.clip] || 1);
    return { key: "loco", moveW: move, runW: run, locoW: 1, settle: 0, phase: (((run ? u - RUN_PHASE : u) % 1) + 1) % 1, gait: move ? gaitAt(run ? PLAYER.speed : WALK_CYCLE, run) : null };
  };
  let yaw = null;
  const lean = { roll: 0, rollV: 0, pitch: 0, pitchV: 0 };
  const leanS = { x: 0, v: 0 };
  let accX = 0;
  let accZ = 0;
  let headX = 0;
  let headZ = 0;
  let slowVx = 0;
  let slowVz = 0;
  let slowSp = 0;
  let stabW = 0;
  let fistW = 0;
  let pivotAt = -9;
  const squash = { x: 1, v: 0 };
  let lastVx = 0;
  let lastVy = 0;
  let lastT = null;
  let lastPhase = null;
  let lastObjX = null;
  let lastObjZ = null;
  const feetCtx = {};
  let lastState = -1;
  // The procedural layers' own state: how much the carry and the cut are on, the cut being shown
  // (and the facing it is for), and the sword pose last shown (a new cut starts from it).
  let carryW = 1;
  let cutW = 0, cutOutT = 0, cutWRel = 0; // (cutOutT, cutWRel: a fitted cut's eased hand-over to the stand)
  let afterCut = false; // (a cut handing over to the carry: the arm kept wholly posed until the carry is in)
  let plateSwingW = 0; // (the shoulder plates followed in full in a swing: PAULDRON_FORWARD)
  let stanceW = 0; // (the carry stance's weight: swing3d.js CARRY_STANCE, STANCE_IN/OUT)
  let stanceIdleT = 9; // (how long he has been idle or moving: STANCE_WAIT)
  let stanceHipW = 0, stanceCarried = 0; // (its hips' and legs' part as shown, and as the blend's record held it at the last change of clip)
  const stOut = new Vector3(), stO = new Vector3();
  let shoulderLetGo = 0; // (the over-the-shoulder carry's weight as it is let go of: SHOULDER_LET_GO)
  let cut = null;
  let cutFace = 0;
  let cutStep = -1;
  let lastCutStep = -1; // (the last cut shown of the sword's stepped combo: its keyed way home, SWORD_BAKE.ret)
  let cutT = 0;
  let cutFrom = null;
  let chainFrom = null;
  const cutHipP = new Vector3(), cutHipQ = new Quaternion(), cutHipQi = new Quaternion();
  // The jump's body (the owner, 2026-10-09: "let the hero bend his knees slightly as in a real jump, both in the jump and
  // in the landing ... the jumps should look different depending on speed"; best practice: a crouch to load, an
  // explosive extension, the legs tucked (standing) or split (running) in the air, reaching down, and the knees taking
  // the landing, the body pitched a little forward). `r` 0 a standing jump .. 1 a running leap, by his speed at the
  // take-off. The crouches are the hips lowered over planted feet (the leg IK bends the knees); in the air the legs are
  // turned about his side axis. Times are the sim's (PLAYER.jump); the landing's give runs on after the jump ends.
  const JUMP_LEGS = {
    // both knees pulled up high, the feet under him (the owner's video of a standing jump, 2026-10-10)
    tuck: { thighs: [-1.25, -1.25], shins: [1.8, 1.8] },
    split: { thighs: [-1.0, 0.45], shins: [0.5, 1.35] }, // the lead knee up and forward, the trailing foot kicked up behind
  };
  const jb = { r: 0, landAt: null, was: false, at: null, fromG: null, fromAt: null, w: 0, fromCut: false };
  // The standing jump as the owner's video (2026-10-10: "Make the standing still jump animation look like in this
  // video"; .scratch/jumpref): a deep crouch, folded forward over the knees, the arms swung back and down; the push
  // with both arms thrown up over his head; the knees pulled up high; the arms opened wide as he comes down; a deep
  // landing, leaning in, arms out. Its poses, at the game's own pace (the video takes 2.5 s; the jump is 0.62 s, and
  // a jump over an attack has to answer the button). A running leap keeps its own shape (r → 1).
  // (load: the crouch; loadPitch: folded forward over it — 0.34 buried his head, the video's chest is forward and its
  // head up; back: the arms swung back as he loads — strong, since it lasts 0.08 s and the arms' follow-through springs
  // take the edge off it; 1.4 put the blade 0.47 into his leg jumping out of a roll and 0.79 out of a cut, 1.0 keeps
  // every case under 0.35 — tools/3d/anim/probes/jump.mjs; extend: the legs driven straight before the knees come up, s; reach: down for the ground, s)
  // (land: the landing's give — 2.8 sat him far lower than the video's landing; headUp: the head kept looking ahead
  // over the lean, a share of it)
  // (backOut, upOut: the arms swung back AND out to his side as he loads, and up in a V — straight back put the blade
  // 0.8 into his leg, and straight up with the elbows bent 0.7 put the free hand 0.9 into his hood; tools/3d/anim/probes/jump.mjs)
  const JUMP_STAND = { headUp: 0.75, load: 2.3, loadPitch: 0.2, height: 1.2, land: 2.0, landPitch: 0.3, back: 1.0, backOut: 0.6, up: 2.0, upOut: 0.4, upFore: 0.3, wide: 1.2, landWide: 0.8, extend: 0.07, reach: 0.2 };
  /** The arms and chest in a jump (after the arms are placed; the springs then give it follow-through). */
  function jumpArms(j, faceWorld, now) {
    if (j.up + j.out + j.brace + j.back + Math.abs(j.curl) < 1e-3 || !rig.chest) return;
    // (a great weapon on the shoulder is held in both hands: the arms and chest stay with it — moved even a fifth as
    // much, its haft came 0.37-0.43 into him just after the landing, tools/test.mjs)
    if (WEAPONS[armsNow.main]?.carry === "shoulder") return;
    const F = jV.set(Math.cos(faceWorld), 0, Math.sin(faceWorld));
    jL.set(F.z, 0, -F.x); // (his left: up × forward)
    // the chest: arched back a touch with the push, curled over the tuck at the top, tipped forward to meet the ground
    turnWorld(rig.chest, jQ.setFromAxisAngle(jL, 0.09 * j.curl + 0.13 * j.brace));
    const r = j.r;
    const st = 1 - r; // (a standing jump: the video's big arms)
    const S = JUMP_STAND;
    // the head up, looking ahead over the lean of the crouches (the video: the chest goes forward, never the gaze)
    if (rig.head) turnWorld(rig.head, jQ.setFromAxisAngle(jL, -S.headUp * st * (j.pitch + 0.13 * j.brace)));
    const drift = 0.08 * Math.sin(now * 7) * j.out; // (never quite still at the top)
    rig.chest.getWorldPosition(jC);
    jO.crossVectors(F, UP).negate(); // (where a turn about his facing moves a hanging hand)
    for (const [a, sdSide] of [[rig.arm, side], [rig.off, side === "R" ? "L" : "R"]]) {
      if (!a?.upper) continue;
      // which way about his facing is OUT for this arm, from where its shoulder is: away from the chest (a fixed sign per
      // hand turned the free arm into him, 0.9 deep, tools/3d/anim/probes/jump.mjs)
      const sd = Math.sign(jO.dot(a.upper.getWorldPosition(jA).sub(jC))) || 1;
      // up and forward with the push (a running leap: the arm on the lead leg's side back, the other forward)
      const lead = sdSide === "R" ? 1 : -1; // (the right leg leads: the left arm comes forward)
      // (standing: thrown right up over his head, the sword arm too, as in the video)
      const swing = -S.up * st + (lead > 0 ? 0.35 : -0.75) * r;
      const k = a === rig.arm ? 0.6 + 0.3 * st : 1; // (in a leap the sword arm less: swung high it read as an attack)
      // FIRST out to his side, while the arm still hangs (turned out after it was swung forward, the turn about his
      // facing only spun it about itself: the forward-pointing arm stayed in front of his chest, 0.9 in him) — for
      // balance at the top (standing: wide open, coming down), out as he lands, back-and-out as he loads, a V going up
      turnWorld(a.upper, jQ.setFromAxisAngle(F, k * (sd * ((0.5 - 0.15 * r) * r + S.wide * st) * j.out + sd * (0.25 + (S.landWide - 0.25) * st) * j.brace + sd * st * (S.backOut * j.back + S.upOut * j.up))));
      // then back and down as he loads, up with the push, held a little up while open at the top, forward as he braces
      turnWorld(a.upper, jQ.setFromAxisAngle(jL, k * (S.back * st * j.back + swing * j.up - 0.45 * st * j.out - 0.35 * j.brace + drift)));
      if (a.fore) turnWorld(a.fore, jQ.setFromAxisAngle(jL, k * (-S.upFore * st * j.up - 0.35 * j.out - 0.2 * j.brace))); // (the elbows bent, soft)
    }
  }
  const jL = new Vector3(), jV = new Vector3(), jQ = new Quaternion(), jC = new Vector3(), jO = new Vector3(), jA = new Vector3();
  /** The jump's shape this frame: { lift 0..1, drop (u), pitch (rad), legs 0..1 }. */
  function jumpShape(s, now) {
    const J = PLAYER.jump;
    const inJump = s.state === STATE.JUMP;
    if (inJump && !jb.was) {
      jb.r = Math.max(0, Math.min(1, (Math.hypot(s.vx, s.vy) - 25) / 55));
      // (the baked jump's clock from the press; one still playing is blended out of over JB_FROM)
      if (jb.at != null && now - jb.at < (JUMP_BAKE?.end ?? 0)) (jb.fromG = now - jb.at), (jb.fromAt = now);
      jb.at = now - s.t;
      jb.fromCut = cutW > 1e-3; // (out of a cut: its arms let go of slower, JB_IN_CUT)
    }
    if (inJump && s.t >= J.time && jb.landAt == null) jb.landAt = now - (s.t - J.time);
    if (!inJump && jb.was && jb.landAt == null) jb.landAt = now;
    // (a landing's give is not cut short by the next jump: its crouch carries into the new one's — cut, the body
    // jumped 2 units up in one frame, a jump straight after a landing)
    jb.was = inJump;
    const r = jb.r;
    const out = { lift: 0, drop: 0, pitch: 0, legs: 0, r, up: 0, out: 0, brace: 0, curl: 0, back: 0 };
    const st = 1 - r;
    const S = JUMP_STAND;
    const loadMax = S.load * st + 0.9 * r;
    if (inJump && s.t < J.time) {
      const t = s.t;
      const load = loadMax * smoothstep(0, 1, Math.min(1, t / JUMP_LOAD)); // into the crouch
      const free = Math.max(0, 1 - (t - JUMP_LOAD) / 0.05); // and out of it, fast
      out.drop = t < JUMP_LOAD ? load : load * free;
      const u = Math.max(0, (t - JUMP_LOAD) / (J.time - JUMP_LOAD));
      // (a running leap: its soles at PLAYER.jump.height at the top, as the baked
      // standing jump's — 0.75 left them at 7.7 against its 9, the owner: "Also fix it for the running jump", 2026-10-10)
      out.lift = t < JUMP_LOAD ? 0 : 4 * u * (1 - u) * (S.height * st + 0.9 * r);
      // tucked, then reaching down — not straight: a quarter of the bend kept, braced for the ground
      // (with a great weapon on his shoulder straight down: its head hangs at his knees, see the drop below)
      const reach = WEAPONS[armsNow.main]?.carry === "shoulder" ? 1 : 0.75;
      // (standing: the legs driven straight first, the knees up after, and reaching down sooner — the video)
      const tin = JUMP_LOAD + 0.02 + S.extend * st, tout = J.time - 0.13 - S.reach * st;
      out.legs = smoothstep(tin, tin + 0.1, t) * (1 - reach * smoothstep(tout, tout + 0.1, t));
      // (the arms and the body in the air, the owner: "the arms and body must move a bit too since he is not static, and
      // before he is landing he should brace slightly for impact": up with the push, out for balance at the top, then
      // forward and down, the chest tipping over them, as the ground comes)
      out.up = smoothstep(0.04, 0.18, t) * (1 - smoothstep(0.22, 0.34, t)); // (the push's swing over 0.14 s: in 0.1 the hands hit 300 u/s)
      out.out = smoothstep(0.2, 0.32, t) * (1 - smoothstep(J.time - 0.18, J.time - 0.08, t));
      out.brace = smoothstep(J.time - 0.17, J.time - 0.04, t);
      out.curl = out.out * (1 - r) - 0.6 * out.up;
      out.back = smoothstep(0, 1, Math.min(1, t / JUMP_LOAD)) * (1 - smoothstep(JUMP_LOAD, JUMP_LOAD + 0.05, t)); // (the arms back as he loads)
      out.pitch = (S.loadPitch * st + 0.1 * r) * (out.drop / loadMax) + 0.16 * r * out.legs;
    }
    if (jb.landAt != null) {
      const tau = now - jb.landAt;
      if (tau >= 0 && tau < 0.34) {
        const env = tau < 0.06 ? tau / 0.06 : 1 - smoothstep(0.06, 0.34, tau); // the knees give, then he rises
        out.drop = Math.max(out.drop, (S.land * st + 1.3 * r) * env);
        // (the arms come back in as he rises; a new jump takes them over through its load — the brace's arms out added to
        // its swing up put the free arm's upper half above his shoulder, 0.6-1.0 into the pauldron, tools/3d/anim/probes/jump.mjs twice)
        const next = inJump && s.t < J.time ? 1 - smoothstep(0, JUMP_LOAD, s.t) : 1;
        out.brace = Math.max(out.brace, (1 - smoothstep(0.08, 0.34, tau)) * next);
        out.pitch = Math.max(out.pitch, (S.landPitch * st + 0.2 * r) * env);
      } else if (tau >= 0.34) jb.landAt = null;
    }
    // (a great weapon on his shoulder hangs low in front of his knees: with it he jumps stiffer — a full crouch put
    // the knees 0.4-0.5 into its head, tools/test.mjs)
    if (WEAPONS[armsNow.main]?.carry === "shoulder") out.drop *= 0.45;
    // (no forward tip of his whole body while the baked jump plays: its key poses carry their own lean, posed without it —
    // tipped as well, every pose leaned twice)
    const baking = JUMP_BAKE && !globalThis.__noJumpBake && jb.at != null && now - jb.at < JUMP_BAKE.end && WEAPONS[armsNow.main]?.carry !== "shoulder";
    if (globalThis.__noJumpPitch || baking) out.pitch *= r;
    return out;
  }
  // The baked standing jump (anim/jump-bake.js): every body joint as the owner's video has it, on the time since the press,
  // over everything posed so far, by how much of a standing jump it is; let go of over JB_OUT when he moves, rolls, cuts
  // or is hit after landing.
  const jbBones = JUMP_BAKE ? JUMP_BAKE.bones.map(byName) : [];
  // (JB_IN_CUT: out of a cut over 0.08 s — over 0.03 the sword hand went from 4 to 391 u/s in a frame, jump.mjs fromCut)
  const JB_OUT = 0.08, JB_FROM = 0.08, JB_IN = 0.03, JB_IN_CUT = 0.06, JB_END = 0.2;
  const jbQ = new Quaternion(), jbQ2 = new Quaternion(), jbV = new Vector3(), jbV2 = new Vector3();
  function jbFrame(g, i, q) {
    const B = JUMP_BAKE, x = Math.min(B.frames - 1 - 1e-6, Math.max(0, g * B.fps)), f = Math.floor(x), u = x - f, n = B.bones.length;
    const a = (f * n + i) * 4, b = ((f + 1) * n + i) * 4;
    jbQ2.set(B.q[b], B.q[b + 1], B.q[b + 2], B.q[b + 3]);
    return q.set(B.q[a], B.q[a + 1], B.q[a + 2], B.q[a + 3]).slerp(jbQ2, u);
  }
  function jbScalar(arr, g, k = 1, d = 0) {
    const B = JUMP_BAKE, x = Math.min(B.frames - 1 - 1e-6, Math.max(0, g * B.fps)), f = Math.floor(x), u = x - f;
    return arr[f * k + d] + (arr[(f + 1) * k + d] - arr[f * k + d]) * u;
  }
  function applyJumpBake(s, now, dt) {
    const B = JUMP_BAKE;
    // (not with a great weapon on the shoulder: held in both hands, its haft went 0.17-0.40 into him under the baked
    // body — it keeps the jump made for it, jumpShape and jumpArms; tools/test.mjs)
    if (!B || jb.at == null || globalThis.__noJumpBake || WEAPONS[armsNow.main]?.carry === "shoulder") return (jb.w = 0);
    const g = now - jb.at;
    if (g < 0 || g >= B.end) return (jb.w = 0);
    // (on until he does anything else: in the jump, and standing still after it)
    const on = s.state === STATE.JUMP || (s.state === STATE.IDLE && Math.hypot(s.vx, s.vy) < 3);
    jb.w = on ? 1 : Math.max(0, jb.w - (dt > 0 ? dt / JB_OUT : 1));
    if (s.state === STATE.JUMP && g < 0.05) jb.w = 1;
    // (eased in over JB_IN from the stand the press found, and out over its last JB_END into the stand: cut in and out,
    // the whole body stepped in one frame)
    const w = jb.w * (1 - jb.r) * smoothstep(0, jb.fromCut ? JB_IN_CUT : JB_IN, g + 1 / 60) * (1 - smoothstep(B.end - JB_END, B.end, g));
    if (w < 1e-3) return 0;
    const fromW = jb.fromG != null ? 1 - smoothstep(0, JB_FROM, now - jb.fromAt) : 0;
    if (fromW <= 0) jb.fromG = null;
    jbBones.forEach((bone, i) => {
      if (!bone) return;
      jbFrame(g, i, jbQ);
      if (fromW > 0) jbQ.slerp(jbFrame(jb.fromG, i, new Quaternion()), fromW);
      bone.quaternion.slerp(jbQ, w);
    });
    jbV.set(jbScalar(B.hp, g, 3, 0), jbScalar(B.hp, g, 3, 1), jbScalar(B.hp, g, 3, 2));
    if (fromW > 0) jbV.lerp(jbV2.set(jbScalar(B.hp, jb.fromG, 3, 0), jbScalar(B.hp, jb.fromG, 3, 1), jbScalar(B.hp, jb.fromG, 3, 2)), fromW);
    rig.hips.position.lerp(jbV, w);
    let y = jbScalar(B.y, g);
    if (fromW > 0) y += (jbScalar(B.y, jb.fromG) - y) * fromW;
    obj.position.y += (y - obj.position.y) * w;
    obj.updateMatrixWorld(true);
    // (the soles kept out of the grass, the baked legs over the planted feet)
    feet.keepOut(0);
    return w;
  }
  // The shoulder plates onto their arms as they are posed now (the tools call it too: a pose solved onto the arms is
  // checked with its plates where the game will put them — tools/3d/anim/jump-from-video.mjs)
  function followPauldrons() {
    for (const [a, rest] of [[rig.arm, rig.upperRest], [rig.off, rig.offRest?.upper]]) {
      if (!a?.pauldron || !a.upper || !rest) continue;
      const ang = rest.angleTo(a.upper.quaternion);
      let h = (globalThis.__paulK ?? PAULDRON_FOLLOW) * ang;
      // (the upper arm's line, its share forward of his chest: PAULDRON_FORWARD)
      a.upper.getWorldPosition(pA.s);
      a.fore.getWorldPosition(pA.e).sub(pA.s).normalize();
      rig.chest.getWorldQuaternion(pA.q);
      pA.f.set(0, 0, 1).applyQuaternion(pA.q).setY(0).normalize();
      h *= 1 - PAULDRON_FORWARD.k * (1 - smoothstep(0, 1, plateSwingW)) * smoothstep(PAULDRON_FORWARD.from, PAULDRON_FORWARD.to, pA.e.dot(pA.f));
      if (h > PAULDRON_CAP[0]) h = PAULDRON_CAP[0] + (PAULDRON_CAP[1] - PAULDRON_CAP[0]) * Math.tanh((h - PAULDRON_CAP[0]) / (PAULDRON_CAP[1] - PAULDRON_CAP[0]));
      a.pauldron.quaternion.copy(rest).slerp(a.upper.quaternion, ang > 1e-6 ? h / ang : 0);
    }
  }
  // The cape through the baked jump as the owner's video has it (2026-10-10: "the cape should be included"): hanging at the
  // top, lifting behind him as he comes down, streaming out flat behind through the landing (video 2.42-3.04 s), falling back
  // as he rises — a push back and up on the cloth along that curve, its cone widened to let it out. (CAPE_JUMP: the push,
  // units/s² — the cloth's pull back to the clip balances a/504 units of offset; the cape is ~6 long)
  const CAPE_JUMP = { back: 3200, up: 1700, maxDeg: 100 };
  const jcV = { x: 0, y: 0, z: 0, maxDeg: 38 };
  function jumpCape(now, faceWorld) {
    if (!JUMP_BAKE || jb.at == null || jb.w <= 0) return null;
    const g = now - jb.at, k = jb.w * (1 - jb.r) * smoothstep(0.34, 0.52, g) * (1 - smoothstep(0.82, 1.02, g));
    if (k < 1e-3) return null;
    jcV.x = -Math.cos(faceWorld) * CAPE_JUMP.back * k; jcV.z = -Math.sin(faceWorld) * CAPE_JUMP.back * k; jcV.y = CAPE_JUMP.up * k;
    jcV.maxDeg = 38 + (CAPE_JUMP.maxDeg - 38) * k;
    return jcV;
  }
  let cutTrack = false; // (the cut shown is a fitted track: swing3d.js trackAt)
  let bothHands = false;
  let bakeLastT = null; // (the baked combo's clock last frame: applyBake)
  let cutBothS = 0; // (the other hand's hold on a sword cut's grip, let go of gently: offPass)
  let cutBuffered = false;
  const cutBlend = makePoseBlend();
  let shown = null;
  let shownW = 0; // how much of the arm that pose held
  // The carry's yaw (swing3d.js carryYaw), on a spring: it turns the blade out or in to show past
  // the body as the facing changes, and swings it across when the other side shows clearly more.
  let carryR = null;
  let carryRV = 0;
  // A keyed swing (the painted hero's own): its step, time, and how much carry it started from.
  let keyedStep = -1;
  let keyedT = 0;
  let keyedFrom = 0;
  // How much of the free arm the hang IK has (offW; the carry's weight but for a swing buffered next, which
  // keeps the clip's free arm), and what it started a keyed swing from.
  let offW = 1;
  let offFrom = 1;
  let keyedLift = 0;
  // Whether the keyed swing under way plays its b clip (keyedLayers), for which step, and its time.
  let swingB = false;
  let swingBStep = -1;
  let swingBT = 0;
  // The sword let go in his death (the guide: it falls from his hand as he drops to his knees): where
  // it was let go (world), and since when; null while it is in his hand.
  const drop = { at: null, from: new Vector3(), q: new Quaternion(), to: new Vector3(), qTo: new Quaternion(), local: { p: new Vector3(), q: new Quaternion(), s: new Vector3() } };

  // The cape is simulated in world space, so the renderer adds its mesh to the scene itself (never
  // under the hero's moving transform).
  return {
    object: obj,
    /** The hand holding the main weapon, "L" or "R", and the other (the checks pick bones by role). */
    side,
    other,
    cape,
    /** The living layers (anim/hero-life.js), read by the checks (the fidget under way). */
    life,
    /** The legs on the ground (anim/stride.js), read by the checks (each foot's state). */
    stride: feet,
    model,
    /** The sword's frame (sword3d.js): the blade runs from `bladeBase` to `bladeTip` in it. */
    get blade() {
      return sword.group;
    },
    /** The blade that strikes now (the trail's: an off-hand chain's is the off weapon's), with its ends. */
    strikeOf(p) {
      const off = p?.hand === "off" && !armsNow.paired && offWeapon && !offWeapon.info?.shield;
      const w = off ? offWeapon : sword;
      return { group: w.group, base: w.base, tip: w.tip };
    },
    /** A blow on the raised guard (world.js guard()): "block" knocks it back, "break" harder, "parry" flicks it out. */
    guardHit(kind) {
      guardKick = kind === "parry" ? -0.7 : kind === "break" ? 1.8 : 1;
    },
    /** His body as the weapons are kept out of it (anim/bodyproxy.js), and the main weapon's points: for the checks. */
    get bodyProxy() {
      return body;
    },
    /** Both hands on the weapon now (a two-handed grip, or a sword cut that takes the other hand on): for the checks. */
    get bothHands() {
      return bothHands;
    },
    /** The cut's pose this frame (swing3d.js bladeAt), for the tools. */
    get cutPose() {
      return cut;
    },
    /** The shoulder plates onto the arms as posed now (for the tools: hero3d.js followPauldrons). */
    followPauldrons() {
      followPauldrons();
    },
    get mainSamples() {
      return mainSamples;
    },
    /** A paired attack's second blade (the off weapon, sweeping the mirror arc), or null. */
    pairedOf(p) {
      const on = p?.state === STATE.ATTACK && p.hand === "off" && armsNow.paired && offWeapon && !offWeapon.info?.shield;
      return on ? { group: offWeapon.group, base: offWeapon.base, tip: offWeapon.tip } : null;
    },
    get bladeBase() {
      return sword.base;
    },
    get bladeTip() {
      return sword.tip;
    },
    get sword() {
      return sword;
    },
    /** The off hand's weapon or shield (null when it is empty), and the arms both were made for. */
    get offWeapon() {
      return offWeapon;
    },
    get arms() {
      return armsNow;
    },
    /**
     * Where the blade's tip is as last posed, on the ground in the sim's plane ({ x, y }; world x
     * and z). The heavy's slam dust belongs here, where the blade meets the ground out at his right
     * (swingArc's end), not straight ahead along the facing (render3d.js heroCues).
     */
    bladeTipXY(out = { x: 0, y: 0 }) {
      sword.group.updateWorldMatrix(true, false);
      sword.group.localToWorld(tipXY.copy(sword.tip));
      out.x = tipXY.x;
      out.y = tipXY.z;
      return out;
    },
    materials: mats,
    /**
     * Pose for this frame. `p` is the hero (x, y in between), `s` = lerp3d.hero(w), `view` =
     * { t, stateT, worldState }, `flash` 0..1 (real time), `alpha` for the i-frame blink.
     */
    update(p, s, view, { flash = 0, alpha = 1, now = null, lookAt = null } = {}) {
      const real = now ?? view.t;
      const first = lastT == null;
      const dt = first ? 0 : Math.max(0, Math.min(0.1, view.t - lastT));
      lastT = view.t;
      // (up off the ground in a jump: PLAYER.jump.height at the top of its arc)
      const jumpNow = jumpShape(s, real);
      // (the crouches lower the whole of him, his weapon with him, over his planted feet: the leg IK bends the knees —
      // lowering only the hips left a great weapon's carry up where it was, half a unit into him)
      obj.position.set(p.x, jumpNow.lift * PLAYER.jump.height - jumpNow.drop, p.y);
      const pick = heroAnimState(rec, p, s, view, sampler.durations, marks);
      if (p.arms && (p.arms.main !== armsNow.main || p.arms.off !== armsNow.off || p.arms.twoHanded !== armsNow.twoHanded)) equip(p.arms);
      // (a keyed swing only for the sword's own chain; any other weapon's moves are posed on the sim's clock, swing3d.js)
      const mvNow = s.state === STATE.ATTACK ? moveOf(p) : null;
      const keyedNow = spec.keyedCuts && (!mvNow || !mvNow.pose || mvNow.pose === "keyed");
      // On the bench a hold (anim/hold.js) poses the body instead of the picker. Off while held: the
      // picker's layers, the blend, lean, squash and planted feet; the facing snaps. A held cut1–3 is
      // the game's cut at that time, a held idle, walk or run carries the sword as the game does.
      const held = hold?.active ? hold : null;
      benchFace = s.face;
      const own = held ? held.pose() : null;
      // (a held idle, walk or run: the arms below as the game poses them, from a pick made up for the clip — the
      // walk at its own pace, the run at a sprint, where its clip plays unwarped: game phase = clip phase − RUN_PHASE)
      const bReq = held?.request;
      const benchPick = held && canCut && bReq?.clip && !bReq.joint && CARRIED.has(bReq.clip) ? benchPickFor(bReq) : null;
      if (benchPick) keepTwist(benchPick.runW * benchPick.moveW, benchPick.moveW);
      // A cut is driven by the sim's swing clock (swing3d.js), over the guard stance — unless the
      // model keys its own (then the picker plays swing1–3 on that clock).
      const cutting = !held && canCut && !keyedNow && s.state === STATE.ATTACK;
      if (!held) {
        // (A keyed swing's b clip or not: chosen from the facing as the swing starts, kept to its end.)
        if (s.state === STATE.ATTACK) {
          const st = Math.min(2, p.step || 0);
          if (st !== swingBStep || s.t < swingBT - 1e-6) [swingBStep, swingB] = [st, keyedBack(pick.face)];
          swingBT = s.t;
        } else swingBStep = -1;
        // (the idle on the picker's own clock, view.t: at a quarter of it, as it was, the body jumped to another frame of
        // the idle as a cut began and ended — a hitch the owner's video at its own tempo showed)
        const layers = cutting ? [{ clip: "idle", time: view.t % (sampler.durations.idle || 1), weight: 1 }] : keyedLayers(pick.layers, swingB);
        const legsW = pick.legsW > 0.01 && pick.legs?.length ? pick.legsW : 0;
        if (legsW) {
          sampler.apply(pick.legs);
          legBones.forEach((b, i) => legQ[i].copy(b.quaternion));
          feet.captureGait(); // (where the walk/run alone puts the feet, before the body is mixed in)
        }
        sampler.apply(layers);
        if (legsW) legBones.forEach((b, i) => b.quaternion.slerp(legQ[i], legsW));
        // (the run's chest twist, by the run's weight on the body: never in a swing)
        const moveBody = pick.moveW * smoothstep(0, 1, pick.locoW ?? 1);
        keepTwist((pick.runW ?? 0) * moveBody, moveBody);
        inert.apply(pick.blendHalfLife, dt);
        if (pick.blendHalfLife != null) stanceCarried = stanceHipW; // (the carry stance's hips as the blend now holds them)
        if (spec.keyedCuts && canCut) hipDrive(s, p, dt, first, keyedNow && /^swing\d/.test(pick.key || ""));
      }

      // Facing: a critically damped turn, never a snap.
      const want = Math.PI / 2 - (held ? s.face : pick.face);
      if (yaw == null || held) yaw = want;
      yaw = dampAngle(yaw, want, pick.faceHalfLife, dt);
      turn.rotation.y = yaw;
      const faceWorld = Math.PI / 2 - yaw;

      // Lean into acceleration and curves: from the in-between velocity, through a spring.
      if (dt > 0) {
        const ax = (s.vx - lastVx) / dt;
        const ay = (s.vy - lastVy) / dt;
        lastVx = s.vx;
        lastVy = s.vy;
        const f = pick.face;
        const fwd = ax * Math.cos(f) + ay * Math.sin(f);
        const sideA = -ax * Math.sin(f) + ay * Math.cos(f);
        const on = pick.lean ? 1 : 0;
        // (INTO the curve: sideA > 0 is a push to his right, and a turn of `turn` about +Z tips him to his right;
        // −sideA leaned him out of every turn, −4.95° in a 90° turn at a sprint: the TORSO lens)
        const rollT = on * Math.max(-0.17, Math.min(0.17, (sideA / 900) * 0.17));
        // (forward into a start and back at a stop from the speed's change over LEAN_SLOW: the sim's ramps last
        // four frames, and from the acceleration alone the spring reached 1.6° of its 5.7°)
        const kS = 1 - Math.pow(2, -dt / LEAN_SLOW);
        slowVx += (s.vx - slowVx) * kS;
        slowVz += (s.vy - slowVz) * kS;
        slowSp += (Math.hypot(s.vx, s.vy) - slowSp) * kS;
        // (the speed's change, not the velocity's: a turn at speed is not a start — it leaned him 3.2° forward
        // in a 90° turn at a sprint, 5.3° in a reversal; past 90° the old way counts against the new one, so a
        // reversal still pushes off into the new way, as the pivot below intends)
        const sl = Math.hypot(slowVx, slowVz);
        const cosT = sl > 1 ? (slowVx * Math.cos(f) + slowVz * Math.sin(f)) / sl : 1;
        const dv = s.vx * Math.cos(f) + s.vy * Math.sin(f) - slowSp * Math.min(1, 1 + 2 * cosT);
        const pitchT = on * Math.max(-0.1, Math.min(0.12, (dv / PLAYER.speed) * 0.12 + (fwd / 900) * 0.04));
        // (a little under critical damping: the lean overshoots a touch and settles, the guide's start)
        leanS.x = lean.roll;
        leanS.v = lean.rollV;
        springStep(leanS, rollT, LEAN_HZ, LEAN_ZETA, dt);
        [lean.roll, lean.rollV] = [leanS.x, leanS.v];
        leanS.x = lean.pitch;
        leanS.v = lean.pitchV;
        springStep(leanS, pitchT, LEAN_HZ, LEAN_ZETA, dt);
        [lean.pitch, lean.pitchV] = [leanS.x, leanS.v];
        [accX, accZ] = [ax, ay];
        // A sharp reversal at speed (the guide's "Starts, stops and turns"): the velocity now against
        // where it was heading a moment ago (a 0.12 s memory) — he plants, the hips drop, and he pushes
        // off the other way (a dip on the squash spring; the lean spring leans him into the new way).
        const sp = Math.hypot(s.vx, s.vy);
        const k = 1 - Math.pow(2, -dt / 0.12);
        headX += (s.vx - headX) * k;
        headZ += (s.vy - headZ) * k;
        const hm = Math.hypot(headX, headZ);
        if (sp > 40 && hm > 20 && (s.vx * headX + s.vy * headZ) / (sp * hm) < -0.2 && view.t - pivotAt > 0.35 && on) {
          squash.v -= PIVOT_DIP;
          pivotAt = view.t;
        }
      }
      if (held) lean.roll = lean.rollV = lean.pitch = lean.pitchV = 0;
      turn.rotation.x = lean.pitch + jumpNow.pitch; // (and the jump's lean over the crouch and in a leap)
      turn.rotation.z = lean.roll;

      // Squash: a landing from a roll, a hurt, the heavy's slam; volume kept (sxz = 1/√sy).
      if (s.state !== lastState) {
        if (lastState === STATE.ROLL && s.state !== STATE.ROLL) squash.v -= 1.6;
        if (s.state === STATE.JUMP) squash.v += 1.8; // (the take-off's stretch)
        if (lastState === STATE.JUMP && s.state !== STATE.JUMP) squash.v -= 1.4;
        if (s.state === STATE.HURT) {
          squash.v -= 2.2;
          // the blow's push: the knock-back's direction (else straight back from his facing)
          const n = Math.hypot(s.vx, s.vy);
          if (n > 1) life?.hit(s.vx / n, s.vy / n, real);
          else life?.hit(-Math.cos(s.face), -Math.sin(s.face), real);
        }
        lastState = s.state;
      }
      if (mvNow?.fx === "heavy") {
        const c = mvNow;
        if (s.t > c.wind + c.active && s.t < c.wind + c.active + 0.03) squash.v -= 0.6;
      }
      if (held) [squash.x, squash.v] = [1, 0];
      const sy = springStep(squash, 1, 4.5, 0.55, dt);
      const sxz = 1 / Math.sqrt(Math.max(0.6, sy));
      turn.scale.set(sxz, sy, sxz);
      obj.updateMatrixWorld(true);
      // The shoulders rounded forward in every movement (the owner, 2026-10-03: "a bit too rotated back
      // so the arms does not come enough forward"): each collarbone turned about the vertical so its
      // tip, and the arm hanging from it, comes SHOULDER_FWD further round to the front. Before the arm
      // IK, which then reaches from there. The sword arm's eases out over a swing (0.1 s): its keyed path
      // is the hitbox's, and the turned shoulder moved the blade up to 16° off it.
      // (held as it was through a hit-stop's redraw: snapped to its target there, the collarbones turned 12° on
      // the first frozen frame of a hit mid-swing)
      const swingW = s.state === STATE.ATTACK ? 0 : 1;
      shoulderW = dt > 0 ? shoulderW + Math.max(-dt / 0.1, Math.min(dt / 0.1, swingW - shoulderW)) : first ? swingW : shoulderW;
      // (and out over a roll's tuck: about the chest's up, with the trunk pitched far forward, it swung the free
      // arm down to the tucked legs and the fingers went 0.44 u into the boot)
      const rollTo = s.state === STATE.ROLL ? 0 : 1;
      rollTurnW = dt > 0 ? rollTurnW + Math.max(-dt / 0.1, Math.min(dt / 0.1, rollTo - rollTurnW)) : first ? rollTo : rollTurnW;
      // (its own weight: out within 0.08 s into a hurt, a roll or a swing — the clip's arm hung from the dropped
      // shoulder and the sword forearm went 0.5 u into the hip in a hurt's first frames — 0.1 s otherwise)
      const clavT = held ? 0 : (1 - pick.moveW) * (pick.key === "loco" ? 1 : pick.settle || 0);
      const clavOut = pick.key === "loco" || pick.settle > 0 ? 0.1 : 0.08;
      clavW = dt > 0 ? clavW + Math.max(-dt / clavOut, Math.min(dt / 0.1, clavT - clavW)) : first ? clavT : clavW;
      // (the free collarbone on its own, slower fade: FREE_FADE — out of the stand at the sword side's pace unless
      // swinging, where its stand fix leaving at 0.08 s stepped it 5-8° a frame)
      shoulderWF = dt > 0 ? shoulderWF + Math.max(-dt / FREE_FADE, Math.min(dt / FREE_FADE, swingW - shoulderWF)) : first ? swingW : shoulderWF;
      const outF = s.state === STATE.ATTACK ? FREE_FADE : clavOut;
      clavWF = dt > 0 ? clavWF + Math.max(-dt / outF, Math.min(dt / FREE_FADE, clavT - clavWF)) : first ? clavT : clavWF;
      const moveS = held ? 0 : pick.moveW * smoothstep(0, 1, pick.locoW ?? 1);
      for (const a of [rig.arm, rig.off]) {
        if (!a?.shoulder || !a.upper) continue;
        const free = a === rig.off;
        const w = (free ? smoothstep(0, 1, shoulderWF) : shoulderW) * rollTurnW;
        if (w < 1e-3) continue;
        const standS = smoothstep(0, 1, free ? clavWF : clavW);
        a.shoulder.getWorldPosition(swChest);
        a.upper.getWorldPosition(swHand).sub(swChest);
        const fx = Math.cos(faceWorld), fz = Math.sin(faceWorld);
        const sgn = Math.sign(swHand.z * fx - swHand.x * fz) || 1; // (c × fwd).y: the turn that brings the tip ahead
        // (about the chest's own up, not the world's: mid-roll, the trunk 95° off upright, the world's turned
        // the rounding into a 15° shrug)
        swChest.set(0, 1, 0).applyQuaternion(rig.chest.getWorldQuaternion(walkQ));
        // (the stand's turn and drop measured on the idle clip while he wholly stands, and faded out from there:
        // measured afresh from the walk or run clip blending in, the collarbone lurched and the elbow jumped 1 u)
        const fix = clavFix.get(a) ?? clavFix.set(a, { yaw: null, drop: 0 }).get(a);
        const measure = standS > 0.98 || fix.yaw == null;
        // (moving, MOVE_CLAV: less rounded than the full SHOULDER_FWD and dropped — rounded and riding 12° higher
        // than the stand's, he walked and ran hunched)
        let ang = SHOULDER_FWD + (MOVE_CLAV.fwd - SHOULDER_FWD) * moveS;
        if (standS > 1e-3) {
          if (measure) {
            vClF.set(fx, 0, fz).addScaledVector(swChest, -(fx * swChest.x + fz * swChest.z)).normalize();
            vClR.crossVectors(vClF, swChest);
            const cur = Math.atan2(swHand.dot(vClF), Math.abs(swHand.dot(vClR)));
            fix.yaw = Math.max(-0.7, Math.min(0.7, STAND_CLAV_FWD - cur)) - SHOULDER_FWD;
          }
          ang += fix.yaw * standS;
        }
        walkQ.setFromAxisAngle(swChest, sgn * ang * w);
        turnWorld(a.shoulder, walkQ);
        if (standS > 1e-3 || moveS > 1e-3) {
          a.shoulder.getWorldPosition(vClF);
          a.upper.getWorldPosition(vClR).sub(vClF).normalize();
          // (against the world's up: he stands upright whenever this is on, and the idle clip's chest is rolled)
          if (measure && standS > 1e-3) fix.drop = Math.max(0, Math.min(0.45, Math.asin(Math.max(-1, Math.min(1, vClR.y))) - STAND_CLAV_ELEV));
          vClF.crossVectors(vClR, UP).normalize();
          turnWorld(a.shoulder, qClD.setFromAxisAngle(vClF, -(fix.drop * standS + MOVE_CLAV.drop * moveS) * w));
        }
      }
      // The living layers, over the clip and before the feet and arms (anim/hero-life.js).
      if (life) {
        if (held) life.reset();
        else {
          const acting = s.state === STATE.ATTACK || s.state === STATE.ROLL || s.state === STATE.HURT;
          const alive = !p.dead && s.state !== STATE.DEAD && view.worldState !== "lost";
          const shake = life.apply(dt, { t: view.t, now: real, faceWorld, moveW: pick.moveW, runW: pick.runW ?? 1, ax: accX, az: accZ, standing: pick.key === "loco" && (pick.legsOn ?? 0) < 0.15, acting, hurt: s.state === STATE.HURT, roll: s.state === STATE.ROLL, alive, bodyW: shoulderW, lookAt: lookAt && view.worldState !== "won" ? lookAt : null });
          if (shake.lengthSq() > 0) {
            obj.position.add(shake);
            obj.updateMatrixWorld(true);
          }
          // The head kept level (HEAD_LEVEL of its tilt to the side taken out, the neck 40%, the head 60%): the
          // idle clip cocks it 5-7°, the weight shift tipped it a further ±4.4° every 4-8 s and the curve lean
          // with it. Not in a roll, a hurt or the fall, where the clip's head is the reaction.
          const stabT = alive && (s.state === STATE.IDLE || s.state === STATE.MOVE || s.state === STATE.ATTACK || s.state === STATE.LOCKED) ? HEAD_LEVEL : 0;
          stabW = dt > 0 ? stabW + Math.max(-dt / 0.15, Math.min(dt / 0.15, stabT - stabW)) : stabW;
          if (stabW > 1e-3 && rig.head && rig.neck) {
            rig.head.getWorldQuaternion(walkQ);
            // (the idle's neck stretch, a fidget, is not levelled away: hero-life.js stretchTilt)
            const tilt = Math.asin(Math.max(-1, Math.min(1, swChest.set(1, 0, 0).applyQuaternion(walkQ).y))) - life.stretchTilt;
            swHand.set(0, 0, 1).applyQuaternion(walkQ);
            turnWorld(rig.neck, walkQ.setFromAxisAngle(swHand, -tilt * stabW * 0.4));
            turnWorld(rig.head, walkQ.setFromAxisAngle(swHand, -tilt * stabW * 0.6));
          }
        }
      }

      if (held) {
        // The bench: a held cut fully on, a held carry as the game carries.
        const req = held.request;
        tiltGrip(0); // (a held cut: the fist's own grip; a held idle sets its own below)
        if (own && canCut && spec.keyedCuts) {
          // A keyed cut: the swing's clip is posed (hold.js, at the picker's time); the carry over it. The hand
          // turned round the refitted grip and the hips' lead, as the fight has them (the review: without
          // holdAuthored's gripFix a held cut drew its blade 27° off the fight's).
          const step = Number(own.clip.slice(3)) - 1;
          hipDrive({ state: STATE.ATTACK, t: own.time }, { step }, 0, true);
          const w = keyedCarryW(step, own.time, 1);
          holdAuthored(1 - w);
          const k = keyedBackLift(step, own.time, w, faceWorld);
          const c = carryPose(0, 0, 0, faceWorld);
          if (w > 0) applyArms(rig, toWorld(k > 0 ? viewLift(c, faceWorld, 0, 0, k) : c, faceWorld), w, w, faceWorld);
        } else if (req?.clip && !req.joint && !benchPick && canCut && spec.keyedCuts) {
          holdAuthored(1); // (a held roll, hurt, death or win: the sword where the fight draws it)
        } else if (own && canCut) {
          const c = bladeAt(Number(own.clip.slice(3)) - 1, own.time, s.face, false, null);
          applyCutBody(rig, c, 1, s.face, faceWorld);
          applyArms(rig, toWorld(c, s.face), 1, 1, faceWorld);
        }
        carryW = 1;
        offW = 1;
        keyedLift = 0;
        cutW = 0;
        cut = shown = carryR = null;
      } else {
        // The cut's pose on the sim's swing clock; a new swing starts from the pose last shown.
        if (cutting) {
          const step = chainSpec(p);
          lastCutStep = p.step ?? -1;
          const buffered = p.buffer === "attack" || p.buffer === "off";
          if (step !== cutStep || s.t < cutT - 1e-6 || !cut) {
            cutStep = step;
            // The sword as it is held, from the body's own facing: a press aimed off the way he
            // faces turns the whole body (the sim turns him at once, the body follows in ~50 ms),
            // and the turn carries the sword round with it — the wind-up only draws it back.
            const flowing = !!(cutTrack && cutBuffered && cutW > 0.999); // (a fitted cut run on into the chain's next)
            cutFrom = shown ? fromWorld(shown, faceWorld) : null;
            if (cutFrom && flowing) cutFrom.flow = true;
            if (!(p.step > 0)) chainFrom = cutFrom; // (where the chain began: a fitted cut's lone recovery comes home there)
            // It starts from that pose, so it is on at once as far as that pose was (a fade-in
            // over the carry would add the gap between the two to the draw-back's speed).
            if (cutFrom) cutW = Math.max(cutW, shownW);
            cutBlend.reset();
            cutBuffered = buffered;
          }
          cutT = s.t;
          // A press buffered (or dropped) partway through a recovery changes where the sword is
          // going: the change is blended in (swing3d.js makePoseBlend), never snapped.
          // (a weapon without its own carry recovers into the carry as the press found it, not the guard: into the guard, the
          // carry then took over in 80 ms — a snap down to the hip the owner's video at its own tempo showed; into the
          // carry as it moves now, the hand chased its sway and the blade shook)
          // (a sword cut fitted to the owner's video comes home, unchained, to where the chain began: to the pose its own
          // press found it in, cut 3's would rise back to the high two-handed hold it starts from)
          const home = /^sw\d$/.test(mvNow.pose || "") && chainFrom ? chainFrom : cutFrom;
          const b = bladeAt(step, s.t, s.face, buffered, cutFrom, carryRest ?? (home && { ...home, direct: true }));
          cutTrack = !!b.track;
          cut = cutBlend.apply(b, buffered !== cutBuffered, b.track ? 0.08 : 0.04, dt);
          cutBuffered = buffered;
          // The cut's frame: the body's facing at the press, onto the sim's own by the live window
          // (where the blade must be on the hitbox).
          const wind = mvNow.wind;
          cutFace = s.face + wrapAngle(faceWorld - s.face) * (1 - smoothstep(0, wind, s.t));
        } else cutStep = -1;
        // In over 40 ms (a cut out of a roll does not pop), out over 80 ms after the swing ends — 120 ms for a weapon
        // without a carry of its own (in 80 ms a cut cut short mid-slash crossed back to the carry at 3.4 units a frame; a
        // swing that runs its course ends on the carry anyway); a great weapon's shoulder carry takes it in 80 (longer,
        // it came back onto the shoulder 0.4-0.5 in him).
        // (a fitted cut that ends in the video's guard — the chop — hands over to the stand over 0.3 s: its guard holds the
        // hand at the hip, the stand the owner chose by the thigh, 0.13 of his height lower)
        // (eased, the fitted cut's: at a steady rate the hand-over started at full speed — the blade tip from 10 to 116 u/s in a
        // frame as the chop's guard began to leave, 6.58 s of the owner's video)
        if (cutting) (cutW = Math.min(1, cutW + dt / 0.04)), (cutOutT = 0), (cutWRel = cutW);
        else if (cutTrack && !WEAPONS[armsNow.main]?.carry) {
          cutOutT += dt;
          // A lone first or second cut of the baked combo goes home by its own keyed return (SWORD_BAKE.ret), played on,
          // then let go of over 0.12 s — faded into the stand joint by joint, its arms swung through him (0.7-0.9 deep;
          // the owner, 2026-10-08: "The arms are clipping through the body on the way back")
          const ret = SWORD_BAKE?.ret?.[lastCutStep];
          if (ret && cut?.clipT != null) {
            cut.clipT = ret[0] + Math.min(ret[1], cutOutT);
            cut.clipW = 1;
            cutW = cutWRel * (1 - smoothstep(0.6 * ret[1], ret[1] + 0.15, cutOutT)); // (let go of over its last part: the stand it keys is the bench's, not quite the one he stands in now — let go of after it, the hand stepped 210 u/s)
          } else cutW = cutWRel * (1 - smoothstep(0, CUT_OUT, cutOutT));
        }
        else cutW = Math.max(0, cutW - dt / (WEAPONS[armsNow.main]?.carry ? 0.08 : 0.12));
        // (a jump takes the body over through its load: the cut's way home played on under it, the arms and blade stayed in
        // the cut's pose as he crouched — the blade 0.89 into him, the forearms 1.2-1.7 in his belt; let go of over 0.12 s, still 0.79; over
        // 0.06, 0.40 — the cut itself reaches 0.83; tools/3d/anim/probes/jump.mjs fromCut)
        if (s.state === STATE.JUMP && !cutting) cutW = Math.min(cutW, 1 - smoothstep(0, 0.06, s.t));
        if (cutW <= 0) cut = null;
        // The carry: on while standing and moving (and in the intro), off in a roll, a hurt, the
        // death and the win, where the clip's arm holds the sword.
        const carryOn = pick.key === "loco" ? 1 : pick.settle || 0;
        // Into a keyed swing the carry is gone by the middle of the wind-up, and wholly: the arm IK
        // bends the elbow towards its pole at any weight, so a carry still fading out bent the clip's
        // arms (the blade lagged the hitbox by up to 11° through swing1's live window).
        const keyedCut = keyedNow && s.state === STATE.ATTACK;
        if (keyedCut) {
          // Over a keyed swing the carry goes out in the wind-up and comes back in from the
          // follow-through's end, a next swing buffered or not (swing3d.js keyedCarryW): the swing's
          // guard is the same at every facing, the carry is turned to show. Never in the live window.
          const step = Math.min(2, p.step || 0);
          if (step !== keyedStep || s.t < keyedT - 1e-6) [keyedStep, keyedFrom, offFrom] = [step, carryW, offW];
          keyedT = s.t;
          carryW = keyedCarryW(step, s.t, keyedFrom);
          // (the free arm: back on the hang only if no next swing is buffered — held at the follow-through, the
          // chest still turned 46° on the hips, the hang IK put the forearm into the belt and cape for 0.15 s)
          const offTo = keyedCarryW(step, s.t, offFrom);
          offW = p.buffer === "attack" ? Math.min(offW, offTo) : Math.min(offTo, offW + dt / 0.05);
          keyedLift = keyedBackLift(step, s.t, carryW, faceWorld);
        } else {
          keyedStep = -1;
          keyedLift = 0;
          carryW = carryOn + (carryW - carryOn) * Math.pow(2, -dt / (carryOn ? 0.05 : 0.025));
          offW = offW < carryW ? carryW + (offW - carryW) * Math.pow(2, -dt / 0.05) : carryW;
        }
        // (what the cut moved the hips by is kept, to be taken out of the record the next change of clip blends from)
        cutHipP.copy(rig.hips.position);
        cutHipQ.copy(rig.hips.quaternion);
        if (cut) applyCutBody(rig, cut, cutW, cutFace, faceWorld);
        cutHipP.subVectors(rig.hips.position, cutHipP); // (the move, in the hips' parent's frame)
        cutHipQ.copy(cutHipQi.copy(rig.hips.quaternion).multiply(cutHipQ.invert())); // (the turn A: after = A · before)
        // Standing with a great weapon on his shoulder, the carry stance (swing3d.js CARRY_STANCE): as far as it is held
        // there (last frame's weight) and he stands; in over STANCE_IN, let go over STANCE_OUT (a cut or a start)
        // (only idle or moving: in a chain's recovery the weapon comes back towards his shoulder, and the stance coming in
        // with it stepped a foot between the swings, which the next press cut short — 1.14 in a frame)
        // (and only once he has been so STANCE_WAIT: a press a moment after a swing's end found the stance coming back in)
        stanceIdleT = s.state === STATE.IDLE || s.state === STATE.MOVE ? stanceIdleT + dt : 0;
        // (and the sword alone in his hand, standing: the guard he stands in at the start of the owner's video of its cuts —
        // knees bent, leaning in over them — whose first frames the cuts are fitted from)
        const swordStance = armsNow.main === "sword" && !offWeapon;
        const stanceTo = (WEAPONS[armsNow.main]?.carry === "shoulder" ? shoulderLetGo : swordStance ? 1 : 0) * (stanceIdleT >= STANCE_WAIT ? 1 - smoothstep(0, 1, pick.moveW ?? 0) : 0);
        stanceW = dt > 0 ? stanceW + Math.max(-dt / STANCE_OUT, Math.min(dt / STANCE_IN, stanceTo - stanceW)) : first ? stanceTo : stanceW;
        // (its hips and legs only as far as the blend does not still hold them: at a change of clip the blend's record of
        // the pose has the stance in it, fading as the blend does — added on top in full, it counted twice and the hips
        // jumped 1.5 at each swing's press; recorded without it, the legs bent for the lowered hips lifted both feet 1.0)
        const wS = smoothstep(0, 1, stanceW);
        stanceHipW = Math.max(0, wS - stanceCarried * inert.weight);
        if (wS > 1e-3 && arm.upper && offArm.upper) {
          arm.upper.getWorldPosition(stOut);
          stOut.sub(offArm.upper.getWorldPosition(stO)).setY(0).normalize();
          applyCarryStance(rig, wS, faceWorld, stOut, globalThis.__stance ?? (swordStance ? SWORD_STANCE : CARRY_STANCE), stanceHipW);
        } else stanceHipW = 0;
      }

      // Feet held where they landed while standing, moving, swinging or reeling (not in a roll, a
      // fall or the victory), after everything else has placed the body.
      // (in a jump only while he is on the ground: the crouch before it, and the landing)
      const groundJump = s.state === STATE.JUMP && (s.t < JUMP_LOAD || s.t >= PLAYER.jump.time);
      if (jumpNow.legs > 1e-3) {
        // in the air: the legs tucked (a standing jump) or split (a running leap), by his speed at the take-off
        jL.set(Math.cos(faceWorld), 0, Math.sin(faceWorld));
        jL.set(jL.z, 0, -jL.x);
        const A = JUMP_LEGS.tuck, B = JUMP_LEGS.split, r = jumpNow.r;
        legs.forEach((lg, i) => {
          const k = i === 1 ? 0 : 1; // (the right leg leads a leap)
          turnWorld(lg.thigh, jQ.setFromAxisAngle(jL, (A.thighs[k] * (1 - r) + B.thighs[k] * r) * jumpNow.legs));
          turnWorld(lg.shin, jQ.setFromAxisAngle(jL, (A.shins[k] * (1 - r) + B.shins[k] * r) * jumpNow.legs));
        });
      }
      const planted = !held && s.state !== STATE.ROLL && (s.state !== STATE.JUMP || groundJump) && s.state !== STATE.DEAD && !p.dead && view.worldState !== "won" && view.worldState !== "lost";
      // (a jump of the drawn position — a respawn, the bench — starts the feet afresh: the planted
      // spots stayed behind and the legs stretched back for 20 frames)
      if (!planted || (lastObjX != null && Math.hypot(obj.position.x - lastObjX, obj.position.z - lastObjZ) > 40)) feet.reset();
      [lastObjX, lastObjZ] = [obj.position.x, obj.position.z];
      // The legs: the gait's stride warped to the speed, feet planted on their soles (anim/stride.js);
      // standing, a turn moves his feet round with him in steps. Shoved by a hard blow (a hurt faster
      // than 25 u/s), nothing is planted: the feet go with the clip, kept on the grass. In a roll, the
      // fall and the win nothing is planted either, but the soles are still kept out of the grass.
      const g = pick.gait;
      const vel = Math.hypot(s.vx, s.vy);
      const fc = feetCtx;
      fc.enabled = planted;
      fc.floorOnly = !held && !planted;
      fc.moving = pick.legsW || 0;
      fc.k = g ? g.k : 1;
      fc.phase = pick.phase;
      fc.r = g ? g.r : 0;
      fc.bobR = g ? g.r * (pick.legsW || 0) : 0;
      fc.tdL = g ? g.tdL : 0.48;
      fc.C = g ? g.C : 13;
      fc.speed = vel;
      fc.slide = s.state === STATE.HURT && vel > 25;
      fc.back = !!pick.strideBack;
      fc.travel = vel > 0.5 ? Math.atan2(s.vy, s.vx) + (pick.strideBack ? Math.PI : 0) : null;
      fc.face = faceWorld;
      fc.faceTo = held ? faceWorld : pick.face; // (the facing the body is turning to)
      fc.blend = held ? 0 : inert.weight;
      fc.tight = held ? 0 : smoothstep(0, 1, stanceW); // (into the carry stance after a stop: its steps nearer)
      fc.dPhase = lastPhase == null ? 0 : ((((pick.phase - lastPhase) % 1) + 1.5) % 1) - 0.5;
      const fr = feet.apply(dt, fc);
      lastPhase = pick.phase;
      rec.rear = fr.rear;
      // the legs as solved recorded as shown, so the next change of clip blends from them
      // (recorded without the hip drive: the blend's record of the spine above is from before it, so on a change
      // of clip mid-cut — a hurt, the death, a roll, the win — the hips' turn counted twice and the chest, arms and
      // blade jumped 8-20° in one frame)
      // (and without the cut's own move of the hips, for the same reason: a cut ended mid-way, its weight still forward,
      // the change to the stand counted it twice — the hips 0.6 further forward and 0.46 down in one frame)
      withoutHipDrive(() => {
        rig.hips.position.sub(cutHipP);
        rig.hips.quaternion.premultiply(cutHipQi.copy(cutHipQ).invert());
        inert.capture(legBlend);
        rig.hips.quaternion.premultiply(cutHipQ);
        rig.hips.position.add(cutHipP);
      });

      if ((!held || benchPick) && canCut) {
        const pk = benchPick ?? pick;
        // The arms last: the sword hand (carry and cut blended), the free hand. The carry turned
        // along the sword side to show past the body, its yaw on a spring (never a flick).
        // Walking and running both arms are placed by their own angles (swing3d.js CARRY_ARM; the free arm
        // walking by walkFree, running by free), swung opposite each other from the stride's phase (below).
        // (the moving body's own layers fade out over a swing, a roll or a hurt and back after: locoW)
        const locoW = smoothstep(0, 1, pk.locoW ?? 1);
        const wWalk = pk.moveW * (1 - (pk.runW ?? 1)) * locoW;
        // The free hand's wrist, standing and walking: back most of the way to its rest on the forearm — a
        // hanging hand, near straight. The walk clip held it bent up square to the forearm, palm up
        // ("it looks like he has broken his hand", the owner, 2026-10-03); the run's is left as it is.
        // (into a hurt the straightening comes in within 0.03 s, not locoW's 0.1 s: the hurt clip's own bent free
        // wrist showed for 3-4 frames, 51-59°)
        offLW = pk.key !== "hurt" ? (pk.locoW ?? 1) : Math.min(pk.locoW ?? 1, Math.max(0, offLW - dt / 0.03));
        if (offRest) rig.off.hand.quaternion.slerp(offRest, 0.8 * (1 - (pk.runW ?? 1) * pk.moveW * smoothstep(0, 1, offLW)));
        // Walking, the free forearm rolled so the palm faces the thigh, thumb ahead: the walk clip turns
        // it palm back, so at the front of the swing the hand lay flat, palm down, over the belt pouch
        // (the owner, 2026-10-03: "it looks like he has broken his hand"). The knuckles' line is turned
        // toward the front of the forearm, WALK_PALM of the way out; the hand stays where it is.
        palmToThigh(wWalk, faceWorld);
        // The sword arm's swing, opposite the free arm's, from the stride's own phase: −1 back, 1 forward,
        // centred. The free hand reaches the front of its swing SWING_LEAD after the left foot's touchdown
        // (phasefit.mjs, the walk and run clips). (From the free hand's own lead over the chest it was off
        // centre: −1.13..+0.63 at a sprint, held at −1 a fifth of the time, never forward at 9 u/s.)
        const gt = pk.gait;
        const gv = gt?.v ?? 0;
        const swing = gt ? -Math.cos(2 * Math.PI * (pk.phase - gt.tdL - swingLead(gv))) : null;
        // (its size: growing with the walk's speed, then the run's — CARRY_ARM's swing at full sprint)
        const rW = pk.runW ?? 1;
        const base = carryBase(pk.moveW, pk.phase, view.t, swing, rW, shoulderW, gv);
        // (running, the free arm a runner's, CARRY_ARM.free: by the run's weight, never in a swing)
        freeRunArm(rig, base, base.fkin * locoW, faceWorld);
        // (the yaw that shows the blade, from where the moving arm really puts the hand)
        // (not while the carry is wholly off in a roll, a hurt, the fall or the win: carryYaw's 41-yaw search
        // ran every frame for nothing; the yaw is taken afresh as the carry comes back)
        if (carryW < 1e-3 && (pk.key === "roll" || pk.key === "hurt" || pk.key === "death" || pk.key === "victory")) carryR = null;
        else {
          // (the side chosen on the stride's middle, swing 0, then the swinging hand's own best on that side, within
          // YAW_SPAN of it: chosen from the swinging hand alone, the best side changed twice a stride at some
          // facings and the blade whipped 90° round, its tip 1.8 u a frame)
          const drawn = carryAsDrawn(rig, base, faceWorld, obj.position);
          let wantR;
          if (swing == null) wantR = carryYaw(drawn, faceWorld, carryR);
          else {
            const mid = carryBase(pk.moveW, pk.phase, view.t, 0, rW, shoulderW, gv);
            const dr = base.r - mid.r;
            const rMid = carryYaw(carryAsDrawn(rig, mid, faceWorld, obj.position), faceWorld, carryR == null ? null : carryR - dr);
            wantR = carryYaw(drawn, faceWorld, Math.max(CARRY_R[0], Math.min(CARRY_R[1], rMid + dr)), YAW_SPAN);
          }
          if (carryR == null) [carryR, carryRV] = [wantR, 0];
          else [carryR, carryRV] = springCritical(carryR, carryRV, wantR, 0.08, dt);
        }
        // (Coming back in over a keyed swing's follow-through, raised: swing3d.js keyedBackLift.)
        const turned = carryTurned(base, carryR ?? base.r);
        // (a weapon with its own carry — over the shoulder, a katana's low guard, a staff across — posed by the hand's
        // place as a cut is, WEAPON_CARRY; two-handed cuts bring the hand in toward his middle, where the other joins it)
        const ck = WEAPONS[armsNow.main]?.carry;
        // (over the shoulder: as last drawn there, once it has been — the channels' own shoulder pose points the blade
        // back through him, and a chain's end faded the arm towards it while shoulderCarry came in: the colossal sword's
        // fist jumped 0.7 and its blade went 0.5 into his hood for three frames)
        // (its bearing kept the carry's own, which turns his chest away from the weapon a little: as drawn, square, the
        // hood stood 0.1-0.2 into a great club's or colossal sword's line at rest)
        const own = ck === "shoulder" && carryRest ? { ...carryRest, psi: sided(WEAPON_CARRY.shoulder).psi } : sided(globalThis.__carryPose?.[ck] ?? WEAPON_CARRY[ck]);
        const carry = ck ? toWorld({ ...turned, kin: 0, hang: 0, soft: 0, hfwd: 0, wlim: 0, wcap: 0, ...own }, faceWorld) : toWorld(keyedLift > 0 ? viewLift(turned, faceWorld, 0, 0, keyedLift) : turned, faceWorld);
        // (where a cut recovers to: the weapon's own carry, if it has one — over the shoulder as last drawn, below)
        if (!ck) carryRest = null;
        else if (ck !== "shoulder") carryRest = fromWorld(carry, faceWorld);
        // (an off-hand chain swings the off arm: the main arm stays in its carry; a paired attack swings both, the off
        // blade the main one's mirror image across his facing — the sim's second blade sweeps that arc — aimed by its tip
        // as an off-hand cut is: unaimed, the off tip ran 9-17° off arc.alt, .scratch/weapons/stance.mjs)
        const offHandCut = !!cut && p.hand === "off" && !armsNow.paired;
        const pairedCut = !!cut && p.hand === "off" && armsNow.paired;
        offCut = offHandCut ? toWorld(aimTipOff(cut, cutFace, moveOf(p).sweep), cutFace) : pairedCut ? toWorld(aimTipOff(mirrorCut(cut), cutFace, -moveOf(p).sweep), cutFace) : null;
        offCutW = offCut ? cutW : 0;
        let upper = cut && !offHandCut ? blendWorld(carry, toWorld(aimTip(twoW > 1e-3 ? twoHandCut(cut, twoW, -(sword.info?.off ?? 0) + 0.5) : keyedNow ? cut : lowOut(cut), cutFace, moveOf(p).sweep), cutFace), cutW) : carry;
        // A guard with the weapon itself (no shield): the blade held up across in front of him, edge out (WEAPON_GUARD).
        // (a blow on it drives the blade in toward him and up: guardKick)
        const WG = sided(armsNow.twoHanded ? WEAPON_GUARD_TWO : WEAPON_GUARD);
        // (a weapon over the shoulder comes off it and goes back round in front of him, not the short way, straight back
        // through his hood: blendWorld's `front`)
        const onShoulder = WEAPONS[armsNow.main]?.carry === "shoulder";
        if (guardW > 1e-3 && !offWeapon?.info?.shield) upper = blendWorld(upper, toWorld({ ...carry, ...fromWorld(carry, faceWorld), ...WG, reach: WG.reach - 0.12 * guardKick, hh: WG.hh + 0.06 * guardKick, pitch: WG.pitch + 0.15 * guardKick }, faceWorld), smoothstep(0, 1, guardW), onShoulder ? faceWorld : null);
        else if (guardW > 1e-3 && !onShoulder) upper = blendWorld(upper, toWorld({ ...carry, ...fromWorld(carry, faceWorld), ...sided(SHIELD_READY) }, faceWorld), smoothstep(0, 1, guardW));
        // The two weights add: while a cut fades in over a carry fading out, the arm stays wholly
        // posed (the larger alone dipped to half, and the blade swung half-way to the clip's own).
        // (and a cut handing over to the carry wanted back, carryOn: wholly posed — the cut out in 80 ms, the carry in on
        // its slower half-life, the arm dipped to 0.69 posed and the clip's own arm swung the blade out and back)
        // (held until the carry is wholly in, not only while the cut fades: let go as the cut reached 0, the arm dropped
        // to the carry's 0.69 in one frame)
        const carryWant = pk.key === "loco" ? 1 : pk.settle || 0;
        // (not a weapon with a carry of its own: over the shoulder its carry poses the arm itself, and held posed here its
        // weapon came back onto the shoulder 0.39-0.44 in him)
        if (cutW > 0 && !WEAPONS[armsNow.main]?.carry) afterCut = true;
        else if (carryW > 0.999 || carryWant <= 0) afterCut = false;
        const wArm = Math.min(1, Math.max(carryW + cutW, afterCut ? carryWant : 0));
        // (the loose grip standing: GRIP_LOOSE)
        standOpen = (1 - pk.moveW) * (1 - cutW) * Math.max(locoW, pk.settle || 0);
        // (walking and running a looser grip too, GRIP_MOVE: from the fist's own the walk's blade rose with the
        // swing and the cap on it turned the whole arm back — it never came forward of his hip)
        const moveOpen = pk.moveW * (1 - cutW) * locoW;
        // (closing over GRIP_TIME at most: let go of with a cut's own fade-in, 0.04 s, the hilt turned 40° in
        // the fist at 1000°/s, twice the cut's speed in its wind-up; done before any swing's live window)
        // (only a weapon hanging at his side as the sword does: one with its own carry — over the shoulder, held before
        // him, across — is held fast, as Elden Ring's are; turned 44° in the fist the greatsword's grip came out of the
        // hand under its crossguard, the fingers open beside it)
        const gT = WEAPONS[armsNow.main]?.carry ? 0 : carryW * (standOpen * GRIP_LOOSE + moveOpen * (GRIP_MOVE[0] + (GRIP_MOVE[1] - GRIP_MOVE[0]) * (pk.runW ?? 1)));
        // (and loosening over GRIP_EASE: a grip relaxes slowly — at the cut's pace the settle after a win turned the
        // blade 22° a frame)
        tiltGrip(dt > 0 ? gripTiltNow + Math.max(-dt / GRIP_TIME, Math.min(dt / GRIP_EASE, (gT - gripTiltNow) / GRIP_LOOSE)) * GRIP_LOOSE : first ? gT : gripTiltNow);
        holdAuthored(1 - wArm);
        applyArms(rig, upper, wArm, Math.min(1, offW * (1 - pk.moveW) + cutW), faceWorld);
        slideGrip();
        // Standing, the free hand straight on its forearm (all but a slight curl towards the palm) and
        // its palm to the thigh, thumb ahead, as walking (the owner, 2026-10-03: "his right hand is still
        // in a dumb position while standing still" — the hand cocked 23° forward and in at the wrist).
        // (faded with locoW, not switched with the clip's key: the free hand turned 22-28° in one frame at
        // every standing swing's start and end)
        const wStand = (1 - pk.moveW) * (1 - cutW) * Math.max(locoW, pk.settle || 0);
        // (walking too, gone by the run's fist: the hand's rest on the forearm is itself cocked 20-25° off its
        // line, so walking, with the hand slerped back to that rest, it showed bent 20-26° — the owner,
        // 2026-10-04: "his wrist of the right hand is still bending too much when he is walking")
        // (and running, the runner's fist in line with its forearm — the owner, 2026-10-04: "the same issue when he
        // is running" — its palm to the body too: left at the run arm's roll it faced down at the back of the swing
        // and forward at the front, the forearm rolled 26-52° off the stand's)
        const wRunH = (pk.runW ?? 1) * pk.moveW * (1 - cutW) * locoW;
        const wPalm = Math.max(wStand, wWalk, wRunH);
        const wStraight = Math.max(wPalm, wRunH);
        if (wStraight > 1e-3 && rig.off?.fore && rig.off.hand && offTip) {
          rig.off.fore.getWorldPosition(swChest);
          rig.off.hand.getWorldPosition(swHand);
          rollA.copy(swHand).sub(swChest).normalize(); // the forearm's line
          offTip.getWorldPosition(rollT).sub(swHand).normalize(); // the hand's
          walkQ.setFromUnitVectors(rollT, rollA);
          turnWorld(rig.off.hand, walkQ, FREE_STRAIGHT * wStraight);
          if (wPalm > 1e-3) palmToThigh(wPalm, faceWorld);
        }
        // Moving, the free hand turned at the wrist (MOVE_WRIST_UP, about its own Z) so the glove carries on from the
        // forearm in one line — the owner, 2026-10-04, with red lines on a frame: elbow, wrist and knuckles should
        // be straight, not a V ("the wrist joint between the hand and underarm still looks like it is bent
        // extremely unnatural, while when he is standing still now it looks good"). Measured as he drew it, the
        // elbow → wrist → the glove's fingers (.scratch/stance/redline.mjs): standing 13°, walking 19-22°,
        // running 35°; with this 5-8° at every speed. (The bone line wrist → knuckle bone read 5° on the same
        // frames: it does not follow the glove.)
        if (rig.off?.hand) {
          const mw = pk.moveW * (1 - cutW) * locoW;
          if (mw > 1e-3) {
            const up = MOVE_WRIST_UP[0] + (MOVE_WRIST_UP[1] - MOVE_WRIST_UP[0]) * (pk.runW ?? 1);
            walkQ.setFromAxisAngle(rollOut.set(0, 0, 1), (side === "L" ? 1 : -1) * up * mw);
            rig.off.hand.quaternion.multiply(walkQ);
            rig.off.hand.updateMatrixWorld(true);
          }
        }
        // the idle's sword-hand fidgets (a re-grip, a flick of the tip), over the posed arm
        if (life && !held && wStand > 1e-3) life.afterArms(faceWorld, wStand);
        // The shoulder girdle after its arm (GIRDLE), the arms carried or their hands pinned; unsquashed, as the
        // shoulder block above works.
        {
          const sq = Math.abs(turn.scale.y - 1) > 1e-6;
          if (sq) {
            gSq.copy(turn.scale);
            turn.scale.set(1, 1, 1);
            obj.updateMatrixWorld(true);
          }
          followGirdle(rig.arm, Math.min(1, Math.max(1 - carryW, cutW)), 0, held ? -1 : dt);
          followGirdle(rig.off, 0, 1 - shoulderW, held ? -1 : dt);
          if (sq) {
            turn.scale.copy(gSq);
            obj.updateMatrixWorld(true);
          }
        }
        // a great weapon over the shoulder, as far as he carries it (not in a cut, its own guard, a roll, a hurt, the fall)
        // (kept there behind a raised shield: let go, it fell back to the channels' carry, the blade or haft pointing
        // back straight through his chest and out behind him, 1.0 deep all through the guard)
        // (and let go of over SHOULDER_LET_GO as a cut takes the arm — the body plays the swing's clip from its first frame,
        // and dropped at once the weapon stood where the cut's channels only come near the carry: a great hammer's haft in
        // his hood for that frame)
        const shoulderHeld = WEAPONS[armsNow.main]?.carry === "shoulder" && !held;
        carryTwist = 0;
        carrySlideNow = 0;
        const carryNow = shoulderHeld && (pk.key === "loco" || pick.settle) ? smoothstep(0, 1, Math.min(carryW, 1 - cutW) * (1 - (offWeapon?.info?.shield ? 0 : guardW))) : 0;
        shoulderLetGo = !shoulderHeld ? 0 : dt > 0 ? Math.max(carryNow, shoulderLetGo - dt / SHOULDER_LET_GO) : carryNow;
        if (shoulderHeld && shoulderLetGo > 1e-3) {
          shoulderCarry(shoulderLetGo);
          // (and recorded as drawn: a cut starts from the weapon on his shoulder, not from the channels' own carry —
          // which put the blade through his chest for its first frame)
          sword.group.updateWorldMatrix(true, false);
          sword.group.getWorldPosition(sC.t);
          sC.D.set(0, 0, 1).transformDirection(sword.group.matrixWorld);
          sC.t.addScaledVector(sC.D, carrySlideNow); // (the fist's place on it, not its foot's: carrySlide)
          const drawn = poseOfDrawn(upper, sC.t, sC.D, obj.position, HERO_H);
          if (carryNow > 0.5) carryRest = fromWorld(drawn, faceWorld);
          upper = blendWorld(upper, drawn, shoulderLetGo);
        }
        // what he holds kept out of him: the main weapon (on a two-handed grip before the lower hand takes it, else after
        // the other arm is posed — a raised shield's arm crosses in front of him: the longsword's crossguard sat 0.48 in
        // the shield hand's wrist), the off one after
        const mainClear = () => {
          obj.updateMatrixWorld(true);
          body.update();
          if (!mainSamples) mainSamples = samplesOf(sword, armsNow.twoHanded);
          // (the arm holding it left out, and the other too on a two-handed grip — or while a sword cut has the other hand
          // on it: counted as his body, the hand round the pommel shoved the sword off it; the sword's own swings and carry
          // are measured clear already — only its guard; none through a live window)
          bothHands = armsNow.twoHanded || (!offWeapon && !!cut && cutBothOf(cut) * cutW > 1e-3);
          body.skipArms(bothHands ? "LR" : side);
          // (its own keyed swings only: a paired attack poses it as any other weapon — its pommel went 0.45 into him in
          // the cross)
          const swordOwn = WEAPONS[armsNow.main]?.keyed && s.state !== STATE.GUARD && keyedNow;
          const live = liveShare(p, s), mv = live > 0 ? moveOf(p) : null;
          if (!swordOwn) avoidBody(sword, arm, mainSamples, first ? -1 : dt, 1 - live, mv && mv.shape !== "thrust" && p.hand !== "off" ? tipRoom(sword, mv.range) : 0);
        };
        // (both hands on it — a two-handed grip, or a sword cut that takes the other hand on for a while — the weapon is
        // kept out of him first and the other hand then put on it: the other way round, the sword moved off the hand
        // that held it, 0.3-1.4 off through the high two-handed hold)
        const bothNow = armsNow.twoHanded || (!offWeapon && !!cut && cutBothOf(cut) * cutW > 1e-3);
        if (body && !held && bothNow) mainClear();
        // the off hand last (after the girdle, which turns its collarbone): the lower hand on a two-handed grip, a
        // shield carried or raised
        offPass(p, s, faceWorld, dt, !held && pk.key !== "death" && pk.key !== "victory");
        if (body && !held && !bothNow) mainClear();
        if (body && !held && offWeapon && offSamples && !offWeapon.info?.shield) {
          body.skipArms(other);
          const live = liveShare(p, s), mv = live > 0 ? moveOf(p) : null;
          avoidBody(offWeapon, offArm, offSamples, first ? -1 : dt, 1 - live, mv && mv.shape !== "thrust" ? tipRoom(offWeapon, p.hand === "off" ? mv.range : (mv.altRange ?? mv.range)) : 0);
        }
        shown = wArm > 0.5 ? upper : null;
        shownW = wArm;
      }
      // The sword's combo as baked from the owner's video, joint for joint (anim/sword-bake.js): over everything posed so
      // far, by the cut's weight — the legs less as he walks, so the stride keeps his feet under him; none in a jump after
      // its first 0.05 s, whose crouch and tuck are the legs' (a cut's weight still fading as he jumped posed them over the
      // planted feet: both soles went 2.1-2.75 into the grass with the crouch — and 1.0 over 0.05 s, so they are lifted out
      // after it too; let go of at once, the feet hopped 1.0 up; tools/3d/anim/probes/jump.mjs fromCut)
      if (SWORD_BAKE && !held && cut?.track && cut.clipT != null && cutW > 1e-3 && !globalThis.__noBake) {
        applyBake(cut.clipT, cutW * (cut.clipW ?? 1), s.state === STATE.JUMP ? smoothstep(0, 0.05, s.t) : pick.moveW ?? 0, bakeLastT != null && cut.clipT > bakeLastT && cut.clipT - bakeLastT < 0.1 ? cut.clipT - bakeLastT : 0, dt); // (a leap of the clock — into a lone cut's keyed way home — is no motion to blur over: blurred, it mixed the second and third cuts into a frame)
        bakeLastT = cut.clipT;
        // (the other hand back onto the grip over the bake, held as offPass holds it: the bake's own arm only brings it there)
        if (SWORD_BAKE.both && !offWeapon && cutBothS > 1e-3) gripOffHand(cutBothS, sword.info?.off ?? SWORD_TWO_OFF, faceWorld);
        // (the bake poses the legs after the stride: in a jump's crouch the soles kept out of the grass again)
        if (s.state === STATE.JUMP) feet.keepOut(0);
      } else bakeLastT = null;
      // the jump's arms and chest on top of it all (under the bake, a cut still fading as he jumped wrote over them: the
      // free arm stayed in its cut pose, 0.55 into him at the top — tools/3d/anim/probes/jump.mjs fromCut), then the springs
      if (!held) jumpArms(jumpNow, faceWorld, real);
      springPass(dt, SWORD_BAKE && !held && cut?.track && cut.clipT != null && cutW > 1e-3 && !globalThis.__noBake ? cutW * (cut.clipW ?? 1) : 0);
      // (the baked jump last, after the springs: before them, their follow-through dragged the baked arms back toward the
      // last pose — the free arm 0.51 into his torso at the top, where the bake has it clear; tools/3d/anim/probes/jump.mjs)
      if (!held) applyJumpBake(s, real, dt);
      // The shoulder plates with their arms (PAULDRON_FOLLOW), every frame — held poses too; a clip alone leaves them
      // at rest, on the collarbone. (In a swing, eased over 0.1 s: followed in full — PAULDRON_FORWARD.)
      const swinging = s.state === STATE.ATTACK && !held ? 1 : 0;
      plateSwingW = dt > 0 ? plateSwingW + Math.max(-dt / 0.1, Math.min(dt / 0.1, swinging - plateSwingW)) : swinging;
      followPauldrons();
      if (cloth) {
        if (held) cloth.reset();
        else cloth.apply(dt, rig.hips.getWorldPosition(capeRoot), look.uWind.value.x * (1 + look.uWind.value.z), look.uWind.value.y * (1 + look.uWind.value.z), jumpCape(real, faceWorld));
      }
      // The sword falls from his hand at SWORD_DROP into his death: let go where it is, it drops and
      // tips over onto the grass beside him (0.22 s), and lies there; back in his hand when he lives.
      const dying = !held && pick.key === "death";
      const dt0 = dying ? pick.deathT : 0;
      if (dying && dt0 >= SWORD_DROP && sword.group.parent === arm.hand) {
        drop.local.p.copy(sword.group.position);
        drop.local.q.copy(sword.group.quaternion);
        drop.local.s.copy(sword.group.scale);
        sword.group.updateWorldMatrix(true, false);
        sword.group.getWorldPosition(drop.from);
        sword.group.getWorldQuaternion(drop.q);
        obj.attach(sword.group);
        drop.at = dt0;
        // lying flat on the grass, the blade along where it pointed, a little out from him
        sword.group.updateWorldMatrix(true, false);
        const tip = sword.group.localToWorld(swHand.copy(sword.tip)).sub(drop.from);
        const yawB = Math.atan2(tip.x, tip.z);
        drop.qTo.setFromAxisAngle(UP, yawB).multiply(walkQ.setFromAxisAngle(rollOut.set(0, 0, 1), Math.PI / 2));
        drop.to.copy(drop.from).setY(0.25);
      }
      if (drop.at != null && sword.group.parent !== arm.hand) {
        if (!dying) {
          arm.hand.add(sword.group);
          sword.group.position.copy(drop.local.p);
          sword.group.quaternion.copy(drop.local.q);
          sword.group.scale.copy(drop.local.s);
          drop.at = null;
        } else {
          const u = Math.min(1, (dt0 - drop.at) / 0.22);
          const f = u * u; // falling: slow, then fast
          swChest.lerpVectors(drop.from, drop.to, f);
          walkQ.copy(drop.q).slerp(drop.qTo, f);
          obj.updateWorldMatrix(true, false);
          sword.group.position.copy(obj.worldToLocal(swChest));
          sword.group.quaternion.copy(obj.getWorldQuaternion(qTmp).invert().multiply(walkQ));
          sword.group.updateMatrixWorld(true);
        }
      }
      const flex = life && !held ? life.fingers : 0;
      const loosen = life && !held ? life.loosen : 0;
      // Running, the free hand a loose fist (a runner's: the fingers curled, the thumb on the index), not
      // the relaxed open hand of the stand and walk, by the run's weight; after the sword drops in the
      // death, the sword hand opens over 0.45 s (it stayed clenched round nothing).
      // (the fist closes and opens over 0.5 s at most (the stand's open hand and the closed fist are further apart): by the weights alone it moved 7-9° a frame as a swing
      // or a roll began at a run)
      const fistT0 = held ? (benchPick ? benchPick.runW * benchPick.moveW : 0) : (pick.runW ?? 0) * pick.moveW * smoothstep(0, 1, pick.locoW ?? 1);
      // (the free hand a fist through the baked jump, as the owner's video has it — open, the fingers splayed)
      const fistT = Math.max(fistT0, held ? 0 : jb.w * (1 - jb.r));
      fistW = held ? fistT : dt <= 0 ? fistW : fistW + Math.max(-dt / 0.5, Math.min(dt / 0.5, fistT - fistW));
      const fist = smoothstep(0, 1, fistW);
      const open = dying ? smoothstep(SWORD_DROP, SWORD_DROP + 0.45, dt0) : 0;
      // (eased over 0.5 s: switched with the stand's weight the fingers moved 4° a frame)
      openW = held ? 0 : dt > 0 ? openW + Math.max(-dt / 0.5, Math.min(dt / 0.5, standOpen - openW)) : openW;
      // (walking, a little more curled, WALK_CURL: straight on the forearm at the front of the swing the relaxed
      // hand read as reaching out flat)
      const walkT = held ? 0 : pick.moveW * (1 - (pick.runW ?? 1)) * smoothstep(0, 1, pick.locoW ?? 1);
      walkCurlW = held ? 0 : dt > 0 ? walkCurlW + Math.max(-dt / 0.3, Math.min(dt / 0.3, walkT - walkCurlW)) : walkCurlW;
      const relK = (1 - (1 - FREE_OPEN) * smoothstep(0, 1, openW)) * (1 + (WALK_CURL - 1) * smoothstep(0, 1, walkCurlW));
      for (const f of fingers) {
        const rel = f.relaxed * relK;
        if (f.gripQ) {
          f.bone.quaternion.slerpQuaternions(f.gripQ, f.relQ, open);
          if (loosen) f.bone.quaternion.premultiply(qLoosen.setFromAxisAngle(f.axis, -loosen));
        } else if (!f.sword && offHoldW > 1e-3) {
          const free = rel + flex + (f.run - rel) * fist;
          if (f.holdQ) f.bone.quaternion.setFromAxisAngle(f.axis, free).slerp(f.holdQ, offHoldW * (1 - open));
          else f.bone.quaternion.setFromAxisAngle(f.axis, free + (f.gripAngle - free) * offHoldW * (1 - open));
        } else f.bone.quaternion.setFromAxisAngle(f.axis, f.sword ? f.grip + (f.relaxed - f.grip) * open - loosen : rel + flex + (f.run - rel) * fist);
      }
      if (cape) {
        neck.getWorldPosition(capeRoot);
        capeRoot.y -= 0.6;
        capeFwd.set(Math.sin(yaw), 0, Math.cos(yaw));
        capeRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
        for (const bl of balls) bl.bone.getWorldPosition(bl.c);
        // The garden's wind (the look's uWind), plus a draught from running.
        const wv = look.uWind.value;
        capeWind.set(wv.x * (60 + wv.z * 90), 0, wv.y * (60 + wv.z * 90)).addScaledVector(capeFwd, -Math.hypot(s.vx, s.vy) * 1.5);
        cape.update(capeRoot, capeFwd, capeRight, capeWind, balls, dt);
        cape.mesh.material.userData.paint.uFlash.value = flash;
      }
      for (const m of [...mats, ...sword.materials, ...(offWeapon?.materials || [])]) {
        m.userData.paint.uFlash.value = flash;
        m.userData.paint.uAlpha.value = alpha;
        m.transparent = alpha < 0.999;
      }
      for (const h of [...hulls, ...sword.hulls, ...(offWeapon?.hulls || [])]) h.material.userData.outline.uAlpha.value = alpha;
      return pick;
    },
    /** The hull width needs the render target's size in texels. */
    setView(W, H) {
      for (const h of [...hulls, ...sword.hulls, ...(offWeapon?.hulls || [])]) h.material.userData.outline.uView.value.set(W, H);
    },
    dispose() {
      sampler.dispose();
      obj.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
      });
    },
  };
}
