// Gnasher in 3D (docs/3D-PLAN.md 7.4): his rigged model (tools/3d/blender/51_rig_frog.py) posed
// every frame from the sim through his picker (anim/boss-anim3d.js), never played on a timer.
//
// The picker names one of his clips and how far through it he is (0..1); the sampler poses the
// skeleton there; inertialization smooths each change (a strike snaps in 30 ms, a wind-up settles
// in 70); his facing turns through a 100 ms damper, so he visibly turns and then commits. The
// throat sac swells with the croak's own progress, and squash rides on top as a spring.
import { floorAt } from "./floorh3d.js?v=48fd128-df87a96f";
import { BufferGeometry, Group, Quaternion, SkeletonUtils, Vector3 } from "./three-lib.js?v=48fd128-df87a96f";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=48fd128-df87a96f";
import { DoubleSide } from "./three-lib.js?v=48fd128-df87a96f";
import { charLight } from "./hero3d.js?v=48fd128-df87a96f";
import { smoothNormals } from "./smooth3d.js?v=48fd128-df87a96f";

/** His normals relaxed this much at load (smooth3d.js); clones share the asset's geometry. */
const TOAD_SMOOTH = Object.freeze({ passes: 4, amount: 0.6 });
/** How much deeper his outline hull is drawn than his body (polygon offset; see the hull below). */
const TOAD_HULL_OFFSET = Object.freeze({ factor: 24, units: 120 });
const smoothed = new WeakSet();
import { makeSampler } from "./anim/sampler.js?v=48fd128-df87a96f";
import { makeInertializer } from "./anim/blend.js?v=48fd128-df87a96f";
import { makeBossRecord, bossAnimState } from "./anim/boss-anim3d.js?v=48fd128-df87a96f";
import { dampAngle, smoothstep, springStep, wrapAngle } from "./anim/procedural.js?v=48fd128-df87a96f";
import { makeToadLife } from "./anim/toad-life.js?v=48fd128-df87a96f";
import { BOSS_MODELS } from "./boss-profiles.js?v=48fd128-df87a96f";
import { bench, makeHold } from "./anim/hold.js?v=48fd128-df87a96f";
import { makeFeet } from "./anim/feet.js?v=48fd128-df87a96f";
import { makeCloth } from "./anim/cloth.js?v=48fd128-df87a96f";
import { tongueMouth, makeTongue, TONGUE_COLOR } from "./tongue3d.js?v=48fd128-df87a96f";
import { FEEL } from "../feel.js?v=48fd128-df87a96f";
import { FIGHT } from "../config.js?v=48fd128-df87a96f";
const ENTRANCE_LEAP = FIGHT.entrance.leap;
const flipV = new Vector3();

/** Walking legs under another clip (update): his drawn speed (u/s) from which they fade in, at which they are whole, past
 *  which a move's own lunge or leap keeps its pose, and the fade's time (s). (His walk is 26 u/s; the lash's lunge 78.) */
const WALK_LEGS = Object.freeze({ from: 6, to: 16, max: 55, ease: 0.15 });
/** His forward lean and his head's own turn eased toward their aims at these rates (1/s): a share 1 - e^(-k·dt) a frame, so a
 *  frame's step is the same at any rate — at 60 Hz the 8/60 and 9/60 the old min(1, dt·8), min(1, dt·9) took (k = -60·ln(1 - 8/60)). */
const LURCH_K = 8.586, HEADYAW_K = 9.751;
/**
 * The model bench's tongue (G10 re-review: the bench's lash clips showed an open mouth and no
 * tongue, which only the renderer draws, from the live lane — so they could not be compared with the
 * 2D lash's long curled tongue). On the bench alone, while lash_strike or lash_recover is held, the
 * game's own tongue tube (tongue3d.js) is drawn from his mouth along his facing: out over the first
 * 30% of the strike and held, drawn back through the recovery with the renderer's wobble. Its reach
 * is cut to `len` (the game's lane runs 210 units, off any review frame).
 */
const BENCH_TONGUE = Object.freeze({ len: 24, out: 0.3, back: 0.75 });
/** How far out the bench's tongue is (0..1) for a held clip at `u` (0..1 of it). */
export function benchTongueK(clip, u) {
  if (clip === "lash_strike") return Math.min(1, u / BENCH_TONGUE.out);
  if (clip === "lash_recover") return Math.max(0, 1 - u / BENCH_TONGUE.back) * (1 + 0.08 * Math.sin(u * 40));
  return 0;
}

const TOAD_H = 27.8;
/**
 * His character light: the fill from the camera's side, and a soft warm rim (see hero3d.js
 * HERO_LIGHT). His paint's greens run to lime; the target's toad is a clearly muted green, so the
 * light reaches him a little darker than the hero (max) and his colour a little muted (sat), with
 * more of the warm light's own colour than the hero (tint), which leans his blue-greens towards the
 * target's yellow-green. His pale cream belly keeps more of its light (pale), so it stays the
 * target's bright cream beside the dimmer green; the amber eyes still read.
 */
// (The G10 re-review: next to the target's painted look he read glossy and plastic — the rim's hard
// light band round his whole outline on top of the smooth lit skin. The rim is kept faint now.)
// (smooth: the fill turns smoothly, no stepped bands; backRim: the lanterns behind the fight as a warm band round his outline —
// the owner's pick of a hand-painted look, 2026-10-14, "make sure that the lightning and everything else matches the reference")
const TOAD_LIGHT = { fill: 0xfff0d8, fillAmt: 0.7, rim: 0xffe39a, rimAmt: 0.18, max: 0.95, tint: 0.35, sat: 1.0, pale: 0.6, smooth: true, backRim: 0xff9a30, backRimAmt: 0.7 };

/**
 * The outline hull's geometry: the model's own, less the triangles its `_hull` attribute (0 or 1 a
 * vertex, 51_rig_frog.py) leaves out — the mouth's inside and the tongue, where a hull showed as a
 * thin olive line across the open mouth. The same attribute buffers (the skinning included), only
 * its own index. A model without the attribute keeps every triangle.
 */
function hullGeometry(geo) {
  const keep = geo.getAttribute("_hull");
  if (!keep || !geo.index) return geo;
  const src = geo.index.array;
  const out = [];
  for (let i = 0; i < src.length; i += 3) {
    const a = src[i];
    const b = src[i + 1];
    const c = src[i + 2];
    if (keep.getX(a) > 0.5 && keep.getX(b) > 0.5 && keep.getX(c) > 0.5) out.push(a, b, c);
  }
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) g.setAttribute(name, attr);
  g.setIndex(out);
  g.boundingBox = geo.boundingBox;
  g.boundingSphere = geo.boundingSphere;
  return g;
}

/**
 * A boss's model, posed every frame from the sim. `profile` (boss-profiles.js) says how big it is
 * drawn, its clips, its legs and its living layers; Gnasher's by default.
 */
export function makeBoss3D(asset, look, profile = BOSS_MODELS.gnasher) {
  const P = profile;
  /** Its picker keys → its clips (one each; boss-profiles.js). */
  const CLIPS = P.clips;
  /** The clips during which it watches the hero (look-at, anim/toad-life.js): not in the air, struck down, or mid-strike. */
  const WATCHING = new Set(P.watching || ["idle", "walk"]);
  const obj = new Group();
  const turn = new Group();
  obj.add(turn);
  const model = SkeletonUtils.clone(asset.scene);
  let top = 0;
  asset.scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox();
      // (the box of the model as built: three.js widens a morphed geometry's box by each shape's whole reach — Cinder's
      // armpit shapes, 2026-10-20, put her top 0.039 above her hood and drew her 10% small, her shadow's camera wider too)
      if (o.geometry.morphAttributes?.position?.length) {
        const p = o.geometry.attributes.position;
        const box = o.geometry.boundingBox.makeEmpty();
        for (let i = 0; i < p.count; i++) box.expandByPoint(flipV.fromBufferAttribute(p, i));
      }
      top = Math.max(top, o.geometry.boundingBox.max.y);
    }
  });
  model.scale.setScalar(P.height / (top || 2.55));
  turn.add(model);
  const mats = [];
  const skinned = [];
  model.traverse((o) => o.isSkinnedMesh && skinned.push(o));
  // A model not rigged yet (a new toad being looked at on the bench) is painted and outlined the same
  // way, its hull a plain mesh.
  const painted = [];
  const insideMats = [];
  let lurchS = 0;
  let headYawS = 0; // (the head's own turn, eased: the wide tongue's sweep)
  const hulls = []; // (the inside of his mouth: pushed back only while it is shut — update)
  model.traverse((o) => o.isMesh && painted.push(o));
  for (const o of painted) {
    const map = o.material?.map || null;
    // His normals smoothed once per asset (smooth3d.js): the remeshed belly's crumples gave the fill's
    // bands a hard stair-stepped edge across the cream (G10 re-review).
    if (P.toad && map && !smoothed.has(o.geometry)) {
      smoothed.add(o.geometry);
      smoothNormals(o.geometry, TOAD_SMOOTH);
    }
    // The inside of his mouth and his tongue are their own flat colours (53_anim_toad.py: "mouth",
    // "mouth_throat", "tongue"); anything else untextured is a model not painted yet, drawn green.
    const inName = o.material?.name || ""; // (read before the paint replaces the material: it has no name)
    const inside = /^(mouth|tongue)/.test(inName);
    const m = paintMaterial(look, { color: map ? 0xffffff : inside ? o.material.color.getHex() : 0x3f8a2e, map, char: true });
    // The character light (materials3d.js, PAINT_CHAR): the sun is behind the fight, so his side
    // towards the camera needs the fill to show the target's green, cream belly and amber eyes.
    charLight(m, P.light || TOAD_LIGHT);
    o.material = m;
    if (inside) {
      // (the inside of his mouth sits a hair under his closed lips: slivers of it poked through as jagged red bits along the
      // mouth's line — the owner, 2026-10-14: "bad jagging coloring around the mouth". Drawn a little deeper, it shows only
      // where the mouth truly opens)
      m.polygonOffset = true;
      m.polygonOffsetFactor = 6;
      m.polygonOffsetUnits = 12;
      insideMats.push(m);
      // (the lining and the throat unlit, their own deep red and near-black: lit like his skin, every facet of the lining
      // caught the lanterns and the warm back rim, and opened the mouth read as bright orange shards — the owner,
      // 2026-10-15: "Improve the mouth and lip area more of the toad to be a bit less jaggy". A mouth's inside is in its own
      // shade; the tongue keeps the light)
      if (/^mouth/.test(inName)) {
        m.userData.unlit = true; // (render3d.js keeps uTintAmt at 1 for it, where it sets every boss material's tint)
        m.userData.paint.uTintCol.value.setHex(inName === "mouth" ? 0x4a0e12 : 0x1e0507);
        m.userData.paint.uTintAmt.value = 1;
      }
      // (both sides: seen from the side as the jaw drops, its back faces were culled and the mouth's corners were holes)
      m.side = DoubleSide;
    }
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    mats.push(m);
    if (inside) continue; // (no outline inside the mouth: it drew dark lines round the gums and tongue)
    const hull = new (o.constructor)(hullGeometry(o.geometry), outlineMaterial(look, { color: 0x0f2014, warm: 0x6e5d0f, px: 1.3 }));
    // Drawn deeper than the body (as hero3d.js HULL_OFFSET, more: his folds are deeper): where the
    // throat, sac and belly fold, the hull's back faces came through the cream as thin dark slivers
    // and a crack (G10 re-review); deeper, it only shows round his outline.
    hull.material.polygonOffset = true;
    hull.material.polygonOffsetFactor = TOAD_HULL_OFFSET.factor;
    hull.material.polygonOffsetUnits = TOAD_HULL_OFFSET.units;
    if (o.isSkinnedMesh) hull.bind(o.skeleton, o.bindMatrix);
    hull.frustumCulled = false;
    hull.userData.of = o; // (whose outline it is: the King's chain hides its own with it, kingchain3d.js)
    hull.userData.noShadow = true; // (his projected shadow's silhouette is the body: the hull is the same shape again, shadow3d.js)
    o.parent.add(hull);
    hulls.push(hull);
  }
  const bones = skinned[0]?.skeleton.bones || [];
  const sac = bones.find((b) => b.name === "sac");
  // Planted feet and turn-in-place steps (anim/feet.js), as the hero has: all four of his feet held
  // where they land, and stepped round when he turns on the spot (the owner, 2026-10-02/03: every
  // legged creature that moves on the ground does this). Hind legs thigh-shin-foot, front legs
  // upperarm-forearm-hand, as SkinTokens' names for him (53_anim_toad.py).
  const bone = (n) => bones.find((b) => b.name === n) || null;
  const boneCache = new Map(); // (boneAt's lookups, once each)
  // (the profile names each leg's three bones, upper-lower-foot, without the side: a toad's four, a biped's two)
  const legs = ["L", "R"].flatMap((sd) => (P.legs || []).map(([a, b, c]) => ({ thigh: bone(`${a}_${sd}`), shin: bone(`${b}_${sd}`), foot: bone(`${c}_${sd}`) }))).filter((l) => l.thigh && l.shin && l.foot);
  // His living layers (anim/toad-life.js): the belly and sac springs, look-at, blinks, the sitting
  // weight shifts and swallows, hit leans — his movement guide's "procedural layers". (Another boss
  // gets those its bones allow: look-at, the hit lean, the start/stop rock.)
  const life = bones.length && P.life ? makeToadLife(bones, turn, P.life) : null;
  const feet = legs.length ? makeFeet(legs, P.feet) : null;
  // Cloth over the clips (anim/cloth.js, as the hero's cape and tabard): each of the profile's `cloth.sets` a makeCloth of
  // its chains (bone names; each chain root first), its colliders ([a, b, r]: a capsule from bone a to bone b, r a share of
  // her drawn height; "*" stands for each side) and its tuning. Sister Cinder's wide sleeves and robe (2026-10-20,
  // tools/3d/blender/cinder_cloth.py): the clips key the chains where the cloth went before (the robe follows her legs),
  // the springs add the lag, the sway and the flare; `kicks` fling it out as a clip starts (a spell's release).
  const clothRoot = new Vector3();
  const clothV = [new Vector3(), new Vector3()];
  const cloths = (P.cloth?.sets || [])
    .map((set) => {
      const chains = set.chains.map((ch) => ch.map(bone));
      if (!chains.length || !chains.every((ch) => ch.every(Boolean))) return null;
      const caps = (set.colliders || [])
        .flatMap(([a, b, r]) => (a.includes("*") ? ["L", "R"].map((sd) => [a.replace("*", sd), b.replace("*", sd), r]) : [[a, b, r]]))
        .map(([a, b, r]) => ({ a: bone(a), b: bone(b), r: r * P.height }))
        .filter((c) => c.a && c.b);
      // (a chain's last bone as long as the one before it: glTF keeps no bone tails)
      const tail = (bn) => bn.getWorldPosition(clothV[0]).distanceTo(bn.parent.getWorldPosition(clothV[1]));
      return makeCloth(chains, caps, tail, { pairs: set.pairs || [], tune: set.tune || null, per: chains.map(() => ({ maxDeg: set.maxDeg ?? null, hang: set.hang || 0 })) });
    })
    .filter(Boolean);
  const clothHips = cloths.length ? bone(P.cloth.root || "hips") : null;
  let clothClip = null;
  const tongueBase = bones.find((b) => b.name === "tongue_base") || null;
  // Where the lashing tongue leaves him: just inside his lips, carried by the tongue's root (which the
  // jaw carries). At rest the root lies a fifth of the way from the jaw's hinge to the lower lip
  // (51_rig_frog.py), so the lips are four times that step on; the point three steps on, in the root's
  // own frame, stays just inside the open mouth whatever the jaw and the head do.
  const jawBone = bones.find((b) => b.name === "jaw") || null;
  const jawRest = jawBone ? jawBone.quaternion.clone() : null;
  const lipLocal = new Vector3();
  if (tongueBase && jawBone) {
    // Measured on the model itself: forward from the jaw's hinge through the root, the front-most point
    // of his skin near the root's height and on his middle line — the lips — and the tongue leaves
    // from 85% of the way there from the root, just inside them. (The old toad's rule, the lips three
    // root-steps on from the hinge, put the new toad's tongue nine units ahead of his face at eye
    // height: a red stub in mid-air, the owner, 2026-10-03.)
    obj.updateMatrixWorld(true);
    const hinge = jawBone.getWorldPosition(new Vector3());
    const root = tongueBase.getWorldPosition(new Vector3());
    const fwd = root.clone().sub(hinge);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
    fwd.normalize();
    const side = new Vector3(fwd.z, 0, -fwd.x);
    let best = -Infinity;
    const lip = root.clone();
    const v = new Vector3();
    const tall = TOAD_H;
    for (const m of skinned) {
      const pos = m.geometry.attributes.position;
      m.skeleton.update();
      for (let i = 0; i < pos.count; i += 2) {
        m.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(m.matrixWorld);
        const d = v.clone().sub(root);
        if (Math.abs(d.y) > 0.06 * tall || Math.abs(d.dot(side)) > 0.05 * tall) continue;
        const f = d.dot(fwd);
        if (f > best) (best = f), lip.copy(v);
      }
    }
    if (best > 0) lip.lerpVectors(root, lip, 0.85);
    else lip.copy(root);
    tongueBase.worldToLocal(lipLocal.copy(lip));
  }
  const tongueAt = new Vector3();
  // (only the tongue root's own chain brought up to date — the same world matrix it would have after the whole model's update,
  // which ran for each call: once a frame while the tongue is out, on top of update's own)
  const mouthAt = (out) => {
    tongueBase.updateWorldMatrix(true, false);
    return tongueBase.localToWorld(out.copy(lipLocal));
  };
  const mouthFn = tongueBase && jawBone ? () => (mouthAt(tongueAt), [tongueAt.x, tongueAt.y, tongueAt.z]) : null;
  if (mouthFn) tongueMouth.at = mouthFn;
  if (mouthFn) tongueMouth.skinned = skinned; // (his skin, for the probes measuring the mouth's opening: .scratch/tongue)
  // The armpits' corrective shapes (profile `pits`; Cinder's "pit_side_L/R", "pit_fwd_L/R", cinder_cloth.py): raised past her
  // shoulders an arm stretches the robe under it, and the shapes fill the armpit out. Each upper arm's angle off the chest's
  // own down (read in the chest's frame, so a bow or a lean is not a raise), eased in from `from` to `to` degrees, shared
  // between the sideways and the forward shape by where round her it points — the same rule as tools/3d/rig/rom_cinder.py.
  const pits = P.pits ? makePits(P.pits) : null;
  function makePits(conf) {
    const chest = bone(conf.chest || "chest");
    const arms = ["L", "R"].map((sd) => ({ sd, up: bone(`upperarm_${sd}`), fore: bone(`forearm_${sd}`) }));
    const meshes = [];
    model.traverse((o) => o.morphTargetInfluences?.length && meshes.push(o));
    const dict = meshes.find((m) => m.morphTargetDictionary)?.morphTargetDictionary;
    if (!chest || !dict || arms.some((a) => !a.up || !a.fore)) return null;
    const slots = arms.map(({ sd }) => [dict[`pit_side_${sd}`], dict[`pit_fwd_${sd}`]]);
    if (slots.some(([a, b]) => a == null || b == null)) return null;
    obj.updateMatrixWorld(true);
    const qc = chest.getWorldQuaternion(new Quaternion()).invert();
    const down = new Vector3(0, -1, 0).applyQuaternion(qc);
    const flat = (v) => v.addScaledVector(down, -v.dot(down)).normalize();
    const side = flat(arms[0].up.getWorldPosition(new Vector3()).sub(arms[1].up.getWorldPosition(new Vector3())).applyQuaternion(qc));
    const fwd = flat(new Vector3(0, 0, 1).applyQuaternion(qc)); // (her front at rest: the file's +Z)
    const q = new Quaternion();
    const d = new Vector3();
    const h = new Vector3();
    const out = { L: [0, 0], R: [0, 0] };
    return {
      out,
      apply() {
        chest.getWorldQuaternion(q).invert();
        arms.forEach(({ sd, up, fore }, i) => {
          fore.getWorldPosition(d).sub(up.getWorldPosition(h)).applyQuaternion(q).normalize();
          const ang = (Math.acos(Math.max(-1, Math.min(1, d.dot(down)))) * 180) / Math.PI;
          const u = smoothstep(conf.from, conf.to, ang);
          h.copy(d).addScaledVector(down, -d.dot(down));
          const a = Math.abs(h.dot(side));
          const f = Math.max(0, h.dot(fwd));
          const fs = f / (a + f + 1e-6);
          out[sd][0] = u * (1 - fs);
          out[sd][1] = u * fs;
          for (const m of meshes) {
            m.morphTargetInfluences[slots[i][0]] = out[sd][0];
            m.morphTargetInfluences[slots[i][1]] = out[sd][1];
          }
        });
      },
    };
  }
  // On the model bench every clip the model holds can be shown (a new character's own moves); in the
  // game only the fight's clips are sampled.
  // (and on the fight bench's &bossclip=, dev-fight.js: any clip of the file, played on the bench's clock)
  const names = bench.on || globalThis.__bossClip ? { ...CLIPS, ...Object.fromEntries(asset.animations.map((a) => [a.name, a.name])) } : CLIPS;
  const sampler = makeSampler(model, asset.animations, names);
  const inert = makeInertializer(bones);
  // (a placeholder only for a clip the model lacks: once the opening's video clip is installed, it plays — boss-profiles.js)
  const placeholders = Object.fromEntries(Object.entries(P.placeholders || {}).filter(([k]) => !sampler.durations[CLIPS[k] || k]));
  const rec = makeBossRecord({ stride: P.stride, clips: CLIPS, windups: P.windups, after: P.after, durations: sampler.durations, placeholders, loops: P.loops });
  // The model bench's hold (anim/hold.js), made only on the bench.
  const hold = bench.on ? (bench.boss = makeHold({ root: obj, bones, sampler, clips: asset.animations, names, rig: P.toad ? "toad" : "boss" })) : null;
  const benchTongue = hold && tongueBase && jawBone ? makeTongue() : null;
  const benchMouth = new Vector3();
  let yaw = null;
  const squash = { x: 1, v: 0 };
  let lastT = null;
  // (the walking legs under another clip: WALK_LEGS)
  const legBones = bones.filter((bn) => /^(thigh|shin|foot|toe|upperarm|forearm|hand|finger)/.test(bn.name));
  const legPose = legBones.map(() => new Quaternion());
  let legsW = 0, legsPhase = 0, lastAt = null;
  // (a flinch laid over his clip when a blade lands — feel.js bossFlinch: flinch_l / flinch_r by the side the blade comes
  // from, flinch_heavy for the 3rd cut or a crit, 53_anim_toad.py. Laid on as each bone's change from the flinch's first
  // frame (his rest), so he keeps his move — a boss's hyper-armour — and the legs are left to his clip and planted feet.
  // It runs on sim-view time, so a hit-stop holds it at the impact.)
  const upper = bones.filter((bn) => !legBones.includes(bn));
  const flinchRest = {}; // clip → each upper bone's first-frame pose
  const fDelta = upper.map(() => ({ q: new Quaternion(), p: new Vector3(), s: new Vector3(1, 1, 1) }));
  let flinch = null; // { clip, t0 }
  const qInv = new Quaternion();
  function sampleFlinch(t) {
    const fd = flinch && sampler.durations[flinch.clip];
    const ft = flinch ? t - flinch.t0 : -1;
    if (!fd || ft < 0 || ft >= fd || !(FEEL.bossFlinch > 0)) return false;
    if (!flinchRest[flinch.clip]) {
      sampler.apply([{ clip: flinch.clip, time: 0, weight: 1 }]);
      flinchRest[flinch.clip] = upper.map((bn) => ({ q: bn.quaternion.clone(), p: bn.position.clone(), s: bn.scale.clone() }));
    }
    const rest = flinchRest[flinch.clip];
    sampler.apply([{ clip: flinch.clip, time: ft, weight: 1 }]);
    upper.forEach((bn, i) => {
      const d = fDelta[i], r = rest[i];
      d.q.copy(qInv.copy(r.q).invert().multiply(bn.quaternion)).slerp(qInv.identity(), 1 - FEEL.bossFlinch);
      d.p.subVectors(bn.position, r.p).multiplyScalar(FEEL.bossFlinch);
      d.s.set(bn.scale.x / r.s.x, bn.scale.y / r.s.y, bn.scale.z / r.s.z).subScalar(1).multiplyScalar(FEEL.bossFlinch).addScalar(1);
    });
    return true;
  }

  return {
    object: obj,
    materials: mats,
    record: rec,
    /** The armpits' corrective shapes this frame ({ L: [side, fwd], R: … }), for probes; null without them. */
    pits: pits?.out || null,
    /** `b` (x, y in between), `s` = lerp3d.boss, `w`, `view` = { t }, `at` the drawn hop point. */
    update(b, s, w, view, at, lift) {
      const dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, view.t - lastT));
      lastT = view.t;
      // (Sister Cinder's opening while its clip is stood in for: risen off the altar, turning, sunk back — boss-profiles.js stand)
      const O = w?.spec?.opening, st = placeholders.opening && P.stand && O && s.clip === "opening" ? P.stand : null;
      let spinA = 0;
      if (st) {
        const T = s.clipT, k0 = O.spin[0] - O.pop, k1 = O.spin[1] - O.pop;
        // (her waking heavy — the owner, 2026-10-21: "make the wake up animation feel heavier": the shell's break drops her 2.5
        // units into a crouch for a beat, then she is hauled up slowly, ease-in, to her float)
        const dip = T < 0.45 ? Math.sin((Math.PI * T) / 0.45) : 0;
        lift += st.float * smoothstep(0.3, k0, T) * smoothstep(0.3, k0, T) * (1 - smoothstep(O.fire - O.pop, O.settle - O.pop, T)) - 2.5 * dip;
        const u = Math.min(1, Math.max(0, (T - k0) / (k1 - k0)));
        spinA = st.turns * Math.PI * 2 * u * u; // (faster and faster: whole turns, so she ends facing as she began)
      }
      // (a spin on the spot as a mark tagged P.spinTag goes live — the Drowned King's chain spin, content/bosses.js "spin": turned
      // back 30° through its warning as he winds the chain, then once round over its live window and 0.2 s after, easing out,
      // the same way round as his chain flies, kingchain3d.js; a whole turn, so he ends facing as he began)
      if (P.spinTag && w?.hazards) {
        for (const h of w.hazards) {
          if (h.tag !== P.spinTag || h.done) continue;
          const u = Math.min(1, Math.max(0, (h.t - h.tele) / (h.active + 0.2))), e = 1 - (1 - u) * (1 - u);
          spinA += 0.52 * smoothstep(0, h.tele, h.t) * (1 - e) - Math.PI * 2 * e;
        }
      }
      const pick = bossAnimState(rec, b, s, w, view);
      const forced = globalThis.__bossClip?.clip && sampler.durations[globalThis.__bossClip.clip] ? globalThis.__bossClip : null;
      if (forced) {
        forced.t0 ??= view.t;
        const fd = sampler.durations[forced.clip];
        Object.assign(pick, { key: forced.clip, u: (((view.t - forced.t0) * forced.speed) % fd) / fd });
      }
      const clip = forced ? forced.clip : CLIPS[pick.key] || CLIPS[pick.clip] || "idle";
      // On the bench a hold (anim/hold.js) poses him instead of the picker. Off while held: the
      // picker's clip, the blend, the sac's swell and the squash; the facing snaps. (The renderer's
      // tongue, flash and dissolve are its own and stay as they are.)
      const held = !!hold?.active;
      if (held) hold.pose();
      else {
        const dur = sampler.durations[clip] || 1;
        const flinching = sampleFlinch(view.t);
        // Walking legs under any other clip while he travels at a walk (the owner, 2026-10-08: "Sometimes the toad
        // 'floats' while it is moving while preparing for an attack ... the legs should also move if he is turning or
        // moving"): the sim keeps his walking drift through a move's wind-up (26 u/s, in 1116 of 1248 move frames), and
        // the wind-up clips stand still, so he glided. The walk clip's leg bones, on its own phase from the distance
        // drawn, are laid over the clip's by his speed (from WALK_LEGS.from to .to); a lunge or a leap (faster than
        // .max) is its own motion and keeps its pose.
        const moved = lastAt && dt > 0 ? Math.hypot(at.x - lastAt.x, at.y - lastAt.y) : 0;
        const spd = dt > 0 ? moved / dt : 0;
        lastAt = { x: at.x, y: at.y };
        const own = clip === CLIPS.walk || /^(leap|land|dead|hurt)$/.test(pick.key || "") || lift > 0.5;
        const wantLegs = !own && !globalThis.__noWalkLegs && spd < WALK_LEGS.max ? smoothstep(WALK_LEGS.from, WALK_LEGS.to, spd) : 0;
        legsW = dt > 0 ? legsW + Math.max(-dt / WALK_LEGS.ease, Math.min(dt / WALK_LEGS.ease, wantLegs - legsW)) : wantLegs;
        if (legsW > 1e-3 && sampler.durations.walk) {
          legsPhase = (legsPhase + moved / (P.stride || 8)) % 1;
          sampler.apply([{ clip: "walk", time: legsPhase * sampler.durations.walk, weight: 1 }]);
          legBones.forEach((bn, i) => legPose[i].copy(bn.quaternion));
        }
        sampler.apply([{ clip, time: Math.min(dur - 1e-3, pick.u * dur), weight: 1 }]);
        // (open, the inside of his mouth is drawn where it is: pushed back it left holes and slivers at the mouth's corners as
        // the jaw dropped — the owner, 2026-10-15: "when he is opening his mouth it looks jaggy")
        if (jawBone && jawRest && insideMats.length) {
          const open = jawBone.quaternion.angleTo(jawRest) > 0.05;
          for (const m of insideMats) m.polygonOffset = !open;
          // (and his ink outline, a shell pushed out round him, showed through the open mouth as dark-green and yellow
          // slivers at its corners: off while it is open)
          for (const h of hulls) {
            h.material.color.setHex(open ? 0x1c0606 : 0x0f2014);
            h.material.userData.outline.uWarm.value.setHex(open ? 0x1c0606 : 0x6e5d0f);
          }
        }
        if (legsW > 1e-3) legBones.forEach((bn, i) => bn.quaternion.slerp(legPose[i], legsW));
        inert.apply(pick.blendHalfLife, dt);
        if (flinching) upper.forEach((bn, i) => (bn.quaternion.multiply(fDelta[i].q), bn.position.add(fDelta[i].p), bn.scale.multiply(fDelta[i].s)));
        // The croak clip swells the sac to 2D's full bubble itself; the cast's progress adds a pulse.
        if (sac) sac.scale.multiplyScalar(1 + pick.sac * 0.2);
      }
      const groundY = floorAt(at.x, at.y); // (the ground where it stands: the Ash Floor's stairs and altar, floorh3d.js)
      obj.position.set(at.x, groundY + lift, at.y);
      const want = Math.PI / 2 - s.face;
      yaw = yaw == null || held ? want : dampAngle(yaw, want, 0.1, dt);
      turn.rotation.order = "YXZ";
      turn.rotation.y = yaw + spinA;
      // (a lean at the hero: the picker's lurch, his idle glare and a lunge's throw, as a forward tilt — 2026-10-15)
      lurchS = held ? 0 : lurchS + (pick.lurch - lurchS) * (1 - Math.exp(-LURCH_K * dt));
      turn.rotation.x = lurchS * 0.16;
      if (held) [squash.x, squash.v] = [1, 0];
      const sy = springStep(squash, held ? 1 : 1 + (pick.squash - 1) * 0.35, 5, 0.5, dt);
      const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
      turn.scale.set(sxz, sy, sxz);
      // His leap in (the bell entrance): a full forward somersault through the air (the owner, 2026-10-15: "when gnasher jumps in
      // he should make some movement in the air, it is kinda undramatic right now"): stretched long as he launches, tucked into
      // a ball as he turns over the top, opened out long again to land feet first and facing the hero — turned about his
      // middle, not his feet
      turn.position.set(0, 0, 0);
      // (Gnasher's only: the Drowned King comes up out of the sea upright, his anchor raised — boss-profiles.js flip)
      if (!held && b.move?.id === "entrance" && b.airborne && P.flip !== false) {
        const k = Math.min(1, Math.max(0, s.moveT / ENTRANCE_LEAP));
        const fu = smoothstep(0.12, 0.82, k);
        const tuck = Math.sin(Math.PI * fu);
        const reach = 1 - tuck;
        turn.rotation.x += fu * Math.PI * 2;
        turn.scale.set(sxz * (1 + 0.12 * tuck), sy * (1 - 0.22 * tuck + 0.1 * reach * (k < 0.5 ? 1 : 0.6)), sxz * (1 - 0.1 * tuck + 0.08 * reach));
        const hc = P.height * 0.45;
        flipV.set(0, hc, 0).applyEuler(turn.rotation);
        turn.position.set(-flipV.x, hc - flipV.y, -flipV.z);
      }
      if (life) {
        obj.updateMatrixWorld(true);
        const key = held ? "" : clip;
        if (held) life.reset();
        const hero = w?.player;
        const lookYaw = !held && hero && WATCHING.has(key) ? wrapAngle(Math.PI / 2 - Math.atan2(hero.y - at.y, hero.x - at.x) - yaw) : null;
        // (his head turned to a facing of its own — the wide tongue's sweep, render3d.js `headFace`: exact while it sweeps
        // (`headSnap`), eased in its wind-up and back after; the neck's own turn, as the look-at)
        const headWant = !held && s.headFace != null ? wrapAngle(Math.PI / 2 - s.headFace - yaw) : 0;
        headYawS = s.headSnap ? headWant : headYawS + (headWant - headYawS) * (1 - Math.exp(-HEADYAW_K * dt));
        life.apply(held ? 0 : dt, { t: view.t, lookYaw: s.headFace != null ? null : lookYaw, headYaw: headYawS, sitting: key === "idle", alive: key !== "dead" && !held });
      }
      if (feet) {
        // On the ground and not leaping, landing or dying: feet held; sitting still, turn-steps.
        obj.updateMatrixWorld(true);
        const grounded = !held && lift < 0.5 && lift > -0.5 && w.state !== "won" && !b.airborne && !/^(leap|land|dead|hurt)$/.test(clip);
        if (!grounded) feet.reset();
        feet.apply(dt, { enabled: grounded, standing: clip !== "walk" && legsW < 0.5, ground: groundY });
      }
      if (cloths.length) {
        obj.updateMatrixWorld(true);
        clothHips.getWorldPosition(clothRoot);
        if (held) for (const c of cloths) c.reset();
        else {
          const kick = clip !== clothClip ? P.cloth.kicks?.[clip] : null;
          if (kick) for (const c of cloths) c.kick(clothRoot, kick.speed, kick.up || 0);
          const wv = look?.uWind?.value;
          for (const c of cloths) c.apply(dt, clothRoot, wv ? wv.x * (1 + wv.z) : 0, wv ? wv.y * (1 + wv.z) : 0);
        }
        clothClip = held ? null : clip;
      }
      if (pits) pits.apply();
      if (benchTongue) {
        // (in the world beside him: the tube is built in world coordinates)
        if (obj.parent && benchTongue.mesh.parent !== obj.parent) obj.parent.add(benchTongue.mesh);
        const r = held ? hold.request : null;
        const dur = (r?.clip && sampler.durations[r.clip]) || 1;
        const k = r?.clip && !r.joint ? benchTongueK(r.clip, Math.min(1, (Number(r.time) || 0) / dur)) : 0;
        if (k > 0) {
          const m = mouthAt(benchMouth);
          benchTongue.update([m.x, m.y, m.z], { kind: "lane", len: BENCH_TONGUE.len }, { x: at.x, y: at.y, a: s.face }, k, 3.2);
        } else benchTongue.update(null, null, null, 0);
      }
      return pick;
    },
    /** A blade landed on him: `pushX`, `pushZ` the world direction from the hero to him; `heavy` a finisher. */
    hit(pushX, pushZ, heavy, t) {
      life?.hit(pushX, pushZ, heavy, t);
      // (his left in the world is (cos yaw, -sin yaw) on the ground: the hero there, against the push, is a blade from his left)
      const y = yaw ?? 0;
      const clip = heavy ? "flinch_heavy" : -pushX * Math.cos(y) + pushZ * Math.sin(y) > 0 ? "flinch_l" : "flinch_r";
      if (sampler.durations[clip]) flinch = { clip, t0: t };
    },
    /**
     * Where one of its bones is this frame (world, three.js axes, into `out`), or null when it has none. Sister Cinder's fire
     * hangs off her hands, chest and head (cinder3d.js), so it stays in her hands whatever clip plays — her attacks' clips are
     * being remade from the owner's videos (docs/MONSTER-ANIM-FROM-VIDEO.md). Call after update().
     */
    boneAt(name, out) {
      let b = boneCache.get(name);
      if (b === undefined) boneCache.set(name, (b = bone(name)));
      return b ? b.getWorldPosition(out) : null;
    },
    /** Its ink outline shown or not: hidden while its body dissolves or burns away (the hull left behind read as a dark ghost). */
    outline(on) {
      for (const h of hulls) h.visible = on && !h.userData.off; // (off: the King's chain's, drawn by kingchain3d.js)
    },
    /** The outlines are pushed out in render-target texels: his hulls are the only outlined meshes (no walk of the model). */
    setView(W, H) {
      for (const h of hulls) h.material.userData.outline?.uView.value.set(W, H);
    },
    /**
     * Where his tongue leaves the mouth this frame (world, three.js axes, into `out`): just inside
     * the lips, carried by the root of the tongue on the mouth's floor (the `tongue_base` bone,
     * 51_rig_frog.py). The lashing tongue (tongue3d.js) starts here, through `tongueMouth`, rather
     * than at the fixed height its caller passes. Null when the model has no such bone. Call after
     * update().
     */
    mouth(out) {
      if (!tongueBase || !jawBone) return null;
      return mouthAt(out);
    },
    /**
     * Gone from the fight (render3d.js ensureBoss, destroy): what is his own freed — the hulls' index lists, his paint and
     * outline materials, the depth materials made for his shadow pass — and the tongue no longer started from his mouth. The
     * asset's geometry and textures are shared by every copy (SkeletonUtils.clone; the hulls share its attribute buffers),
     * so they are left alone.
     */
    dispose() {
      obj.parent?.remove(obj);
      if (tongueMouth.at === mouthFn) tongueMouth.at = null;
      if (tongueMouth.skinned === skinned) tongueMouth.skinned = null;
      for (const h of hulls) {
        const g = h.geometry;
        if (!skinned.some((m) => m.geometry === g) && !painted.some((m) => m.geometry === g)) {
          // (its attributes are the body's: taken off first, or disposing it would free the body's buffers with it)
          for (const name of Object.keys(g.attributes)) g.deleteAttribute(name);
          g.dispose();
        }
        h.material.dispose();
      }
      for (const m of mats) m.dispose();
      model.traverse((o) => o.customDepthMaterial?.dispose());
      if (benchTongue) {
        benchTongue.mesh.parent?.remove(benchTongue.mesh);
        benchTongue.dispose?.();
      }
    },
  };
}
