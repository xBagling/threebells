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
import { Group, SkinnedMesh, SkeletonUtils, Quaternion, Vector3 } from "./three-lib.js?v=8898846";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=8898846";
import { makeSampler } from "./anim/sampler.js?v=8898846";
import { makeInertializer } from "./anim/blend.js?v=8898846";
import { makeHeroRecord, heroAnimState } from "./anim/hero-anim3d.js?v=8898846";
import { makeHeroStride, soleContacts } from "./anim/stride.js?v=8898846";
import { makeHeroLife } from "./anim/hero-life.js?v=8898846";
import { makeCloth } from "./anim/cloth.js?v=8898846";
import { makeCape } from "./cape3d.js?v=8898846";
import { twoBoneIK, setWorldQuaternion, turnWorld } from "./anim/ik.js?v=8898846";
import { reachShoulder, bladeAt, carryPose, carryBase, carryYaw, carryTurned, applyCutBody, applyArms, toWorld, fromWorld, blendWorld, makePoseBlend, keyedCarryW, keyedBackLift, viewLift, KEYED_FOLLOW, keyedBack } from "./anim/swing3d.js?v=8898846";
import { makeSword } from "./sword3d.js?v=8898846";
import { smoothNormals } from "./smooth3d.js?v=8898846";
import { mirrorClips } from "./anim/mirror.js?v=8898846";
import { bench, makeHold } from "./anim/hold.js?v=8898846";
import { dampAngle, springCritical, springStep, wrapAngle, smoothstep } from "./anim/procedural.js?v=8898846";
import { PLAYER } from "../config.js?v=8898846";
import { STATE } from "../sim/player.js?v=8898846";

export const HERO_H = 19.6;
/** How much deeper the outline hull is drawn than the body (polygon offset; see the hull below). */
export const HULL_OFFSET = Object.freeze({ factor: 10, units: 40 });
/** The painted hero's normals relaxed this much at load (smooth3d.js). */
export const HERO_SMOOTH = Object.freeze({ passes: 4, amount: 0.6 });
/** Geometries already smoothed (clones share their asset's geometry). */
const smoothed = new WeakSet();

/** GLTFLoader drops "." and other reserved characters from node names ("DEF-hand.R" → "DEF-handR"). */
const clean = (n) => n.replace(/[\s[\].:/]/g, "");
const isBone = (o, n) => o.isBone && (o.name === n || o.name === clean(n));

// The sword is in the left hand in 3D (D7, the owner, 2026-09-30): every cut then sweeps the way the
// hitbox does as a forehand, as in the target image. The library's clips are right-handed, so both
// heroes play them mirrored (anim/mirror.js); 2D keeps its right-handed sheets.

/** The mannequin's clips, by our names (the painted hero's file will use our names directly). */
const MANNEQUIN = {
  height: 1.829,
  yaw: 0, // its front, turned onto +Z
  names: { idle: "Sword_Idle", walk: "Walk_Loop", run: "Jog_Fwd_Loop", roll: "Roll", swing1: "Sword_Attack", swing2: "Sword_Attack", swing3: "Sword_Attack", hurt: "Hit_Chest", death: "Death01", victory: "Idle_Loop" },
  hand: "DEF-hand.L",
  mirror: true,
  colors: { M_Main: 0x2a6a66, M_Joints: 0x23262c },
};

/** The painted hero (tools/3d/blender/50_rig_hero.py): clips named by the game's contract, its own texture. */
const PAINTED = {
  height: null, // measured
  yaw: 0,
  names: { idle: "idle", walk: "walk", run: "run", roll: "roll", swing1: "swing1", swing2: "swing2", swing3: "swing3", swing1b: "swing1b", swing2b: "swing2b", swing3b: "swing3b", hurt: "hurt", death: "death", victory: "victory" },
  hand: "DEF-hand.L",
  mirror: true, // its clips come from the same right-handed library
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

/** A character's light on its paint material (materials3d.js PAINT_CHAR): fill, rim and the knee. */
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

// The free arm walking (the walk block): the forearm turned at the elbow (rad, negative straightens it), its extra swing
// (WALK_SWING times its lead over the chest as a share of his height, at most WALK_SWING_MAX rad), the palm turned
// toward the thigh (the knuckles' line WALK_PALM out from straight ahead) by at most WALK_ROLL_MAX.
const WALK_ELBOW = -0.1;
const WALK_SWING = 1.2;
const WALK_SWING_MAX = 0.2;
const WALK_PALM = 0.6;
const WALK_ROLL_MAX = 0.87;
// How much of the standing free hand's bend at the wrist is taken out (the rest: a slight curl to the palm).
const FREE_STRAIGHT = 0.8;
// The lean spring (Hz, damping ratio): a little under critical, so a start's lean overshoots a touch.
const LEAN_HZ = 1.4;
// Seconds into his death at which the sword falls from his hand (he is on his knees: hero_clips.py death).
const SWORD_DROP = 0.8;
const qTmp = new Quaternion();
const LEAN_ZETA = 0.62;
// A sharp reversal's hip dip (a push on the squash spring, as a landing's 1.6).
const PIVOT_DIP = 1.6;
// How far each collarbone is turned forward round the vertical (rad), in every movement.
const SHOULDER_FWD = 0.26;
const UP = new Vector3(0, 1, 0);
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
  const armOf = (sd) => ({ shoulder: byName(`DEF-shoulder.${sd}`), upper: byName(`DEF-upper_arm.${sd}`), fore: byName(`DEF-forearm.${sd}`), hand: byName(`DEF-hand.${sd}`) });
  const arm = armOf(side);
  // (finger bones: tools/3d/rig/add_fingers.py)
  const fingersIn = !!byName(`DEF-fingers1.${side}`);

  // The sword (sword3d.js), in the sword hand: built in game units, the hand's scale taken off. Its
  // frame is set from the rest pose, where the arm hangs and the fist holds the blade pointing ahead
  // with its edge upright; every clip then carries it as the fist turns, and the carry and the cuts
  // turn the hand to point it (anim/swing3d.js).
  const sword = makeSword(look);
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
    if (socket) grip.p.copy(socket.position);
    else if (fist) grip.p.copy(arm.hand.worldToLocal(fist));
    else grip.p.set(0, (armLen * 0.11) / hs, 0);
    sword.group.position.copy(grip.p);
    sword.group.quaternion.copy(grip.q);
    sword.group.scale.setScalar(1 / hs);
    arm.hand.add(sword.group);
  }

  // The fingers (docs/HERO-HANDS.md; bones and their curls from tools/3d/rig/add_fingers.py, in each
  // bone's extras): the sword hand closed round the grip, the free hand gently curled. Each bone's rest
  // rotation is its hand's own, so its pose is one turn about its stored axis.
  const fingers = ["fingers1", "fingers2", "thumb"]
    .flatMap((n) => ["L", "R"].map((sd) => ({ bone: byName(`DEF-${n}.${sd}`), sd })))
    .filter((f) => f.bone?.userData?.curl)
    .map((f) => ({ bone: f.bone, sword: f.sd === side, axis: new Vector3().fromArray(f.bone.userData.curl).normalize(), grip: (f.bone.userData.grip * Math.PI) / 180, relaxed: (f.bone.userData.relaxed * Math.PI) / 180 }));
  // A clip holding the sword (a keyed swing, the roll, the hurt, the death, the win) was authored
  // with it on the old socket, past the fingertips; the sword is in the fist now (docs/HERO-HANDS.md),
  // so the arm is bent, the shoulder lending reach, until the fist's grip is where the clip had the
  // sword, the hand's turn kept: the clip's blade arcs stay as they were (the blade-clear checks).
  const hA = { q: new Quaternion(), t: new Vector3(), o: new Vector3(), s: new Vector3(), e: new Vector3(), w: new Vector3(), pole: new Vector3(), goal: new Vector3(), goalW: 0 };
  function holdAuthored(w) {
    hA.goalW = 0;
    if (w <= 1e-3 || !authored || !arm.hand || !arm.fore || !arm.upper) return;
    arm.hand.updateMatrixWorld(true);
    arm.hand.getWorldQuaternion(hA.q);
    const hs = arm.hand.getWorldScale(hA.s).x;
    hA.t.copy(authored.position).applyMatrix4(arm.hand.matrixWorld);
    hA.o.copy(grip.p).multiplyScalar(hs).applyQuaternion(hA.q);
    hA.t.sub(hA.o); // the wrist that puts the fist's grip on the authored grip
    arm.upper.getWorldPosition(hA.s);
    arm.fore.getWorldPosition(hA.e);
    arm.hand.getWorldPosition(hA.w);
    const armLen = hA.s.distanceTo(hA.e) + hA.e.distanceTo(hA.w);
    hA.pole.copy(hA.e).sub(hA.s.add(hA.w).multiplyScalar(0.5));
    if (hA.pole.lengthSq() < 1e-8) hA.pole.set(0, -1, 0);
    hA.pole.normalize();
    reachShoulder(arm, hA.t, armLen, w);
    twoBoneIK(arm.upper, arm.fore, arm.hand, hA.t, hA.pole, w);
    setWorldQuaternion(arm.hand, hA.q, w);
    hA.goal.copy(hA.t).add(hA.o);
    hA.goalW = w;
  }
  // What the arm cannot reach, the grip slides out along the fist to meet: the sword goes where the
  // pose or the clip wants it, the fist as close as the arm allows (a loose grip at full stretch).
  // Standing, carrying and most of every swing the grip is wholly in the fist; only at the cuts'
  // full stretch does the hilt slide, at most the old socket's 1.7 units.
  const GRIP_SLIDE_MAX = 1.8;
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
    gS.want.applyQuaternion(gS.q).multiplyScalar(Math.min(1, GRIP_SLIDE_MAX / len) / hs);
    sword.group.position.add(gS.want);
  }
  const sampler = makeSampler(model, clipsFor(asset, spec), spec.names);
  const inert = makeInertializer(bones);
  // Planted feet (anim/feet.js): the legs by the skeleton's own bone names.
  const legs = ["L", "R"].map((sd) => ({ thigh: byName(`DEF-thigh.${sd}`), shin: byName(`DEF-shin.${sd}`), foot: byName(`DEF-foot.${sd}`), toe: byName(`DEF-toe.${sd}`) })).filter((l) => l.thigh && l.shin && l.foot && l.toe);
  // The legs on the ground at every speed (anim/stride.js): the soles' heel, ball and toe tip measured
  // once, on the bind pose (before any clip: the hand rests below are taken from it too).
  obj.updateMatrixWorld(true);
  const feet = makeHeroStride(legs, byName("DEF-hips"), soleContacts(legs, skinned), model);
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
  const walkFwd = new Vector3();
  const walkAxis = new Vector3();
  const walkQ = new Quaternion();
  const swHand = new Vector3();
  let shoulderW = 1;
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
    rollX.set(1, 0, 0).applyQuaternion(rig.off.hand.getWorldQuaternion(walkQ));
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
    off: armOf(other),
    legs,
    grip,
    // (the sword hand's rest rotation on the forearm, taken before any clip: the standing wrist, swing3d.js)
    handRest: arm.hand ? arm.hand.quaternion.clone() : null,
  };
  const offRest = rig.off?.hand ? rig.off.hand.quaternion.clone() : null;
  const canCut = !!(rig.hips && arm.upper && arm.fore && arm.hand);
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
  const cloth = !cape && clothChains.length ? makeCloth(clothChains, clothLegs, (b) => (b === tabard ? 0.2 * HERO_H : b.getWorldPosition(clothLen).distanceTo(b.parent.getWorldPosition(swHand)))) : null;
  const colliderBones = ["DEF-hips", "DEF-thigh.L", "DEF-thigh.R", "DEF-shin.L", "DEF-shin.R"].map(byName).filter(Boolean);
  const balls = colliderBones.map((b, i) => ({ bone: b, c: new Vector3(), r: i === 0 ? 3.2 : 2.1 }));
  const rec = makeHeroRecord();
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
  const cuts = Object.fromEntries(PLAYER.combo.map((c, i) => [`cut${i + 1}`, spec.keyedCuts ? { duration: c.wind + c.active + c.recover, base: `swing${i + 1}`, layers: (t) => keyedLayers(heroAnimState(makeHeroRecord(), { x: 0, y: 0, step: i, buffer: null }, { state: STATE.ATTACK, t, face: benchFace, vx: 0, vy: 0 }, { t: 0, stateT: 0, worldState: "fight" }, sampler.durations, marks).layers, keyedBack(benchFace)) } : { duration: c.wind + c.active + c.recover, base: "idle" }]));
  // Each keyed swing ends two ways (hero_clips.py swingN and swingNb): where the camera sees his back
  // and left (swing3d.js keyedBack) the picker's swingN is played as swingNb. The choice is made as a
  // swing starts and kept to its end (`swingB`, below), so a swing never switches clips part way.
  const keyedLayers = (layers, back) => (spec.keyedCuts && back ? layers.map((l) => (/^swing\d$/.test(l.clip) && sampler.durations[`${l.clip}b`] ? { ...l, clip: `${l.clip}b` } : l)) : layers);
  let benchFace = 0; // (the facing a held cut1–3 is shown at)
  const hold = bench.on ? (bench.hero = makeHold({ root: obj, bones, sampler, clips: clipsFor(asset, spec), names: spec.names, rig: "hero", extra: cuts })) : null;

  let yaw = null;
  const lean = { roll: 0, rollV: 0, pitch: 0, pitchV: 0 };
  const leanS = { x: 0, v: 0 };
  let accX = 0;
  let accZ = 0;
  let headX = 0;
  let headZ = 0;
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
  let cutW = 0;
  let cut = null;
  let cutFace = 0;
  let cutStep = -1;
  let cutT = 0;
  let cutFrom = null;
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
  let keyedLift = 0;
  // Whether the keyed swing under way plays its b clip (keyedLayers), for which step, and its time.
  let swingB = false;
  let swingBStep = -1;
  let swingBT = 0;
  // How much the blade shows through what covers it (sword3d.js setXray).
  let xrayW = 0;
  // The sword let go in his death (the guide: it falls from his hand as he drops to his knees): where
  // it was let go (world), and since when; null while it is in his hand.
  const drop = { at: null, from: new Vector3(), q: new Quaternion(), to: new Vector3(), qTo: new Quaternion(), local: { p: new Vector3(), q: new Quaternion(), s: new Vector3() } };

  // The cape is simulated in world space, so the renderer adds its mesh to the scene itself (never
  // under the hero's moving transform).
  return {
    object: obj,
    cape,
    /** The living layers (anim/hero-life.js), read by the checks (the fidget under way). */
    life,
    /** The legs on the ground (anim/stride.js), read by the checks (each foot's state). */
    stride: feet,
    model,
    /** The sword's frame (sword3d.js): the blade runs from `bladeBase` to `bladeTip` in it. */
    blade: sword.group,
    bladeBase: sword.base,
    bladeTip: sword.tip,
    sword,
    /** How much the blade shows through what covers it this frame, 0..1 (sword3d.js BLADE_XRAY). */
    get xray() {
      return xrayW;
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
    update(p, s, view, { flash = 0, alpha = 1, hurtFrom = null, now = null, lookAt = null } = {}) {
      const real = now ?? view.t;
      const dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, view.t - lastT));
      lastT = view.t;
      obj.position.set(p.x, 0, p.y);
      const pick = heroAnimState(rec, p, s, view, sampler.durations, marks);
      // On the bench a hold (anim/hold.js) poses the body instead of the picker. Off while held: the
      // picker's layers, the blend, lean, squash and planted feet; the facing snaps. A held cut1–3 is
      // the game's cut at that time, a held idle, walk or run carries the sword as the game does.
      const held = hold?.active ? hold : null;
      benchFace = s.face;
      const own = held ? held.pose() : null;
      // A cut is driven by the sim's swing clock (swing3d.js), over the guard stance — unless the
      // model keys its own (then the picker plays swing1–3 on that clock).
      const cutting = !held && canCut && !spec.keyedCuts && s.state === STATE.ATTACK;
      if (!held) {
        // (A keyed swing's b clip or not: chosen from the facing as the swing starts, kept to its end.)
        if (s.state === STATE.ATTACK) {
          const st = Math.min(2, p.step || 0);
          if (st !== swingBStep || s.t < swingBT - 1e-6) [swingBStep, swingB] = [st, keyedBack(pick.face)];
          swingBT = s.t;
        } else swingBStep = -1;
        const layers = cutting ? [{ clip: "idle", time: (view.t * 0.25) % (sampler.durations.idle || 1), weight: 1 }] : keyedLayers(pick.layers, swingB);
        const legsW = pick.legsW > 0.01 && pick.legs?.length ? pick.legsW : 0;
        if (legsW) {
          sampler.apply(pick.legs);
          legBones.forEach((b, i) => legQ[i].copy(b.quaternion));
          feet.captureGait(); // (where the walk/run alone puts the feet, before the body is mixed in)
        }
        sampler.apply(layers);
        if (legsW) legBones.forEach((b, i) => b.quaternion.slerp(legQ[i], legsW));
        inert.apply(pick.blendHalfLife, dt);
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
        const rollT = on * Math.max(-0.17, Math.min(0.17, (-sideA / 900) * 0.17));
        const pitchT = on * Math.max(-0.1, Math.min(0.1, (fwd / 900) * 0.1));
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
      turn.rotation.x = lean.pitch;
      turn.rotation.z = lean.roll;

      // Squash: a landing from a roll, a hurt, the heavy's slam; volume kept (sxz = 1/√sy).
      if (s.state !== lastState) {
        if (lastState === STATE.ROLL && s.state !== STATE.ROLL) squash.v -= 1.6;
        if (s.state === STATE.HURT) {
          squash.v -= 2.2;
          // the blow's push: the knock-back's direction (else straight back from his facing)
          const n = Math.hypot(s.vx, s.vy);
          if (n > 1) life?.hit(s.vx / n, s.vy / n, real);
          else life?.hit(-Math.cos(s.face), -Math.sin(s.face), real);
        }
        lastState = s.state;
      }
      if (s.state === STATE.ATTACK && p.step === 2) {
        const c = PLAYER.combo[2];
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
      const swingW = s.state === STATE.ATTACK ? 0 : 1;
      shoulderW = dt > 0 ? shoulderW + Math.max(-dt / 0.1, Math.min(dt / 0.1, swingW - shoulderW)) : swingW;
      for (const a of [rig.arm, rig.off]) {
        if (!a?.shoulder || !a.upper) continue;
        const w = shoulderW;
        if (w < 1e-3) continue;
        a.shoulder.getWorldPosition(swChest);
        a.upper.getWorldPosition(swHand).sub(swChest);
        const fx = Math.cos(faceWorld), fz = Math.sin(faceWorld);
        const sgn = Math.sign(swHand.z * fx - swHand.x * fz) || 1; // (c × fwd).y: the turn that brings the tip ahead
        walkQ.setFromAxisAngle(UP, sgn * SHOULDER_FWD * w);
        turnWorld(a.shoulder, walkQ);
      }
      // The living layers, over the clip and before the feet and arms (anim/hero-life.js).
      if (life) {
        if (held) life.reset();
        else {
          const acting = s.state === STATE.ATTACK || s.state === STATE.ROLL || s.state === STATE.HURT;
          const alive = !p.dead && s.state !== STATE.DEAD && view.worldState !== "lost";
          const shake = life.apply(dt, { t: view.t, now: real, faceWorld, moveW: pick.moveW, runW: pick.runW ?? 1, ax: accX, az: accZ, standing: pick.key === "loco" && (pick.legsOn ?? 0) < 0.15, acting, hurt: s.state === STATE.HURT, alive, bodyW: shoulderW, lookAt: lookAt && view.worldState !== "won" ? lookAt : null });
          if (shake.lengthSq() > 0) {
            obj.position.add(shake);
            obj.updateMatrixWorld(true);
          }
        }
      }

      if (held) {
        // The bench: a held cut fully on, a held carry as the game carries.
        const req = held.request;
        if (own && canCut && spec.keyedCuts) {
          // A keyed cut: the swing's clip is posed (hold.js, at the picker's time); the carry over it.
          const step = Number(own.clip.slice(3)) - 1;
          const w = keyedCarryW(step, own.time, 1);
          const k = keyedBackLift(step, own.time, w, faceWorld);
          const c = carryPose(0, 0, 0, faceWorld);
          if (w > 0) applyArms(rig, toWorld(k > 0 ? viewLift(c, faceWorld, 0, 0, k) : c, faceWorld), w, w, faceWorld);
        } else if (own && canCut) {
          const c = bladeAt(Number(own.clip.slice(3)) - 1, own.time, s.face, false, null);
          applyCutBody(rig, c, 1, s.face, faceWorld);
          applyArms(rig, toWorld(c, s.face), 1, 1, faceWorld);
        } else if (canCut && req?.clip && !req.joint && CARRIED.has(req.clip)) {
          const move = req.clip === "idle" ? 0 : 1;
          const c = carryPose(move, req.time / (sampler.durations[req.clip] || 1), req.time, faceWorld);
          applyArms(rig, toWorld(c, faceWorld), 1, 1 - move, faceWorld);
        }
        carryW = 1;
        cutW = 0;
        cut = shown = carryR = null;
      } else {
        // The cut's pose on the sim's swing clock; a new swing starts from the pose last shown.
        if (cutting) {
          const step = Math.min(2, p.step || 0);
          const buffered = p.buffer === "attack";
          if (step !== cutStep || s.t < cutT - 1e-6 || !cut) {
            cutStep = step;
            // The sword as it is held, from the body's own facing: a press aimed off the way he
            // faces turns the whole body (the sim turns him at once, the body follows in ~50 ms),
            // and the turn carries the sword round with it — the wind-up only draws it back.
            cutFrom = shown ? fromWorld(shown, faceWorld) : null;
            // It starts from that pose, so it is on at once as far as that pose was (a fade-in
            // over the carry would add the gap between the two to the draw-back's speed).
            if (cutFrom) cutW = Math.max(cutW, shownW);
            cutBlend.reset();
            cutBuffered = buffered;
          }
          cutT = s.t;
          // A press buffered (or dropped) partway through a recovery changes where the sword is
          // going: the change is blended in (swing3d.js makePoseBlend), never snapped.
          cut = cutBlend.apply(bladeAt(step, s.t, s.face, buffered, cutFrom), buffered !== cutBuffered, 0.04, dt);
          cutBuffered = buffered;
          // The cut's frame: the body's facing at the press, onto the sim's own by the live window
          // (where the blade must be on the hitbox).
          const wind = PLAYER.combo[step].wind;
          cutFace = s.face + wrapAngle(faceWorld - s.face) * (1 - smoothstep(0, wind, s.t));
        } else cutStep = -1;
        // In over 40 ms (a cut out of a roll does not pop), out over 80 ms after the swing ends.
        cutW = cutting ? Math.min(1, cutW + dt / 0.04) : Math.max(0, cutW - dt / 0.08);
        if (cutW <= 0) cut = null;
        // The carry: on while standing and moving (and in the intro), off in a roll, a hurt, the
        // death and the win, where the clip's arm holds the sword.
        const carryOn = pick.key === "loco" ? 1 : pick.settle || 0;
        // Into a keyed swing the carry is gone by the middle of the wind-up, and wholly: the arm IK
        // bends the elbow towards its pole at any weight, so a carry still fading out bent the clip's
        // arms (the blade lagged the hitbox by up to 11° through swing1's live window).
        const keyedCut = spec.keyedCuts && s.state === STATE.ATTACK;
        if (keyedCut) {
          // Over a keyed swing the carry goes out in the wind-up and comes back in from the
          // follow-through's end, a next swing buffered or not (swing3d.js keyedCarryW): the swing's
          // guard is the same at every facing, the carry is turned to show. Never in the live window.
          const step = Math.min(2, p.step || 0);
          if (step !== keyedStep || s.t < keyedT - 1e-6) [keyedStep, keyedFrom] = [step, carryW];
          keyedT = s.t;
          carryW = keyedCarryW(step, s.t, keyedFrom);
          keyedLift = keyedBackLift(step, s.t, carryW, faceWorld);
        } else {
          keyedStep = -1;
          keyedLift = 0;
          carryW = carryOn + (carryW - carryOn) * Math.pow(2, -dt / (carryOn ? 0.05 : 0.025));
        }
        if (keyedCut && carryW < 0.02) carryW = 0;
        if (cut) applyCutBody(rig, cut, cutW, cutFace, faceWorld);
      }

      // Feet held where they landed while standing, moving, swinging or reeling (not in a roll, a
      // fall or the victory), after everything else has placed the body.
      const planted = !held && s.state !== STATE.ROLL && s.state !== STATE.DEAD && !p.dead && view.worldState !== "won" && view.worldState !== "lost";
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
      fc.dPhase = lastPhase == null ? 0 : ((((pick.phase - lastPhase) % 1) + 1.5) % 1) - 0.5;
      const fr = feet.apply(dt, fc);
      lastPhase = pick.phase;
      rec.rear = fr.rear;
      // the legs as solved recorded as shown, so the next change of clip blends from them
      inert.capture(legBlend);

      if (!held && canCut) {
        // The arms last: the sword hand (carry and cut blended), the free hand. The carry turned
        // along the sword side to show past the body, its yaw on a spring (never a flick).
        // The sword arm's swing, opposite the free arm's (the running clip's): where the free hand is
        // ahead of or behind the chest along the facing, as a share of the free arm's swing.
        // Walking, the free arm swings a little wider and its elbow bends a little more (the owner,
        // 2026-10-03), on top of the walk clip and gone by the run: the upper arm turned further the way
        // it already swings, the forearm lifted. (The sword arm follows the free hand's swing, below.)
        const wWalk = pick.moveW * (1 - (pick.runW ?? 1));
        if (wWalk > 1e-3 && rig.off?.upper && rig.off.fore) {
          rig.chest.getWorldPosition(swChest);
          rig.off.hand.getWorldPosition(swHand);
          walkFwd.set(Math.cos(faceWorld), 0, Math.sin(faceWorld));
          const ahead = (swHand.x - swChest.x) * walkFwd.x + (swHand.z - swChest.z) * walkFwd.z;
          walkAxis.set(0, -1, 0).cross(walkFwd); // (turning about it swings a hanging arm forward)
          walkQ.setFromAxisAngle(walkAxis, Math.max(-WALK_SWING_MAX, Math.min(WALK_SWING_MAX, (ahead / HERO_H) * WALK_SWING)) * wWalk);
          turnWorld(rig.off.upper, walkQ);
          walkQ.setFromAxisAngle(walkAxis, WALK_ELBOW * wWalk);
          turnWorld(rig.off.fore, walkQ);
        }
        // The free hand's wrist, standing and walking: back most of the way to its rest on the forearm — a
        // hanging hand, near straight. The walk clip held it bent up square to the forearm, palm up
        // ("it looks like he has broken his hand", the owner, 2026-10-03); the run's is left as it is.
        if (offRest && rig.off?.hand) rig.off.hand.quaternion.slerp(offRest, 0.8 * (1 - (pick.runW ?? 1) * pick.moveW));
        // Walking, the free forearm rolled so the palm faces the thigh, thumb ahead: the walk clip turns
        // it palm back, so at the front of the swing the hand lay flat, palm down, over the belt pouch
        // (the owner, 2026-10-03: "it looks like he has broken his hand"). The knuckles' line is turned
        // toward the front of the forearm, WALK_PALM of the way out; the hand stays where it is.
        palmToThigh(wWalk, faceWorld);
        let swing = null;
        if (pick.moveW > 0 && rig.off?.hand) {
          rig.chest.getWorldPosition(swChest);
          rig.off.hand.getWorldPosition(swHand);
          const ahead = (swHand.x - swChest.x) * Math.cos(faceWorld) + (swHand.z - swChest.z) * Math.sin(faceWorld);
          swing = -ahead / (0.32 * HERO_H * 0.242 * 2.2);
        }
        // (the sword carried as at a jog until 30 u/s and turning into the sprint's carry by 70: the legs'
        // run weight is whole from 30, and with it the wrist bent 112° and the hilt slid out of the fist)
        const base = carryBase(pick.moveW, pick.phase, view.t, swing, pick.armRunW ?? pick.runW ?? 1, shoulderW);
        const wantR = carryYaw(base, faceWorld, carryR);
        if (carryR == null) [carryR, carryRV] = [wantR, 0];
        else [carryR, carryRV] = springCritical(carryR, carryRV, wantR, 0.08, dt);
        // (Coming back in over a keyed swing's follow-through, raised: swing3d.js keyedBackLift.)
        const turned = carryTurned(base, carryR);
        const carry = toWorld(keyedLift > 0 ? viewLift(turned, faceWorld, 0, 0, keyedLift) : turned, faceWorld);
        const upper = cut ? blendWorld(carry, toWorld(cut, cutFace), cutW) : carry;
        // The two weights add: while a cut fades in over a carry fading out, the arm stays wholly
        // posed (the larger alone dipped to half, and the blade swung half-way to the clip's own).
        const wArm = Math.min(1, carryW + cutW);
        holdAuthored(1 - wArm);
        applyArms(rig, upper, wArm, Math.min(1, carryW * (1 - pick.moveW) + cutW), faceWorld);
        slideGrip();
        // Standing, the free hand straight on its forearm (all but a slight curl towards the palm) and
        // its palm to the thigh, thumb ahead, as walking (the owner, 2026-10-03: "his right hand is still
        // in a dumb position while standing still" — the hand cocked 23° forward and in at the wrist).
        const wStand = (1 - pick.moveW) * (1 - cutW) * (pick.key === "loco" ? 1 : pick.settle || 0);
        if (wStand > 1e-3 && rig.off?.fore && rig.off.hand && offTip) {
          rig.off.fore.getWorldPosition(swChest);
          rig.off.hand.getWorldPosition(swHand);
          rollA.copy(swHand).sub(swChest).normalize(); // the forearm's line
          offTip.getWorldPosition(rollT).sub(swHand).normalize(); // the hand's
          walkQ.setFromUnitVectors(rollT, rollA);
          turnWorld(rig.off.hand, walkQ, FREE_STRAIGHT * wStand);
          palmToThigh(wStand, faceWorld);
        }
        // the idle's sword-hand fidgets (a re-grip, a flick of the tip), over the posed arm
        if (life && wStand > 0.5) life.afterArms(faceWorld);
        shown = wArm > 0.5 ? upper : null;
        shownW = wArm;
      }
      if (cloth) {
        if (held) cloth.reset();
        else cloth.apply(dt, rig.hips.getWorldPosition(capeRoot), look.uWind.value.x * (1 + look.uWind.value.z), look.uWind.value.y * (1 + look.uWind.value.z));
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
      for (const f of fingers) f.bone.quaternion.setFromAxisAngle(f.axis, f.sword ? f.grip - loosen : f.relaxed + flex);
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
      // The blade seen through the body and cape in a cut (sword3d.js BLADE_XRAY): on with the swing,
      // the wind-up to the recovery, at every facing (seen from behind, the landings in front of him
      // are behind the cape); off again soon after (the carry is turned to show by itself).
      const xrayOn = held ? !!(own && /^cut\d$/.test(own.clip)) : s.state === STATE.ATTACK;
      xrayW = held ? (xrayOn ? 1 : 0) : xrayOn ? Math.min(1, xrayW + dt / 0.04) : Math.max(0, xrayW - dt / 0.12);
      sword.setXray(xrayW, alpha);
      for (const m of [...mats, ...sword.materials]) {
        m.userData.paint.uFlash.value = flash;
        m.userData.paint.uAlpha.value = alpha;
        m.transparent = alpha < 0.999;
      }
      for (const h of [...hulls, ...sword.hulls]) h.material.userData.outline.uAlpha.value = alpha;
      return pick;
    },
    /** The hull width needs the render target's size in texels. */
    setView(W, H) {
      for (const h of [...hulls, ...sword.hulls]) h.material.userData.outline.uView.value.set(W, H);
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
