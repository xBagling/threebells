// Gnasher in 3D (docs/3D-PLAN.md 7.4): his rigged model (tools/3d/blender/51_rig_frog.py) posed
// every frame from the sim through his picker (anim/boss-anim3d.js), never played on a timer.
//
// The picker names one of his clips and how far through it he is (0..1); the sampler poses the
// skeleton there; inertialization smooths each change (a strike snaps in 30 ms, a wind-up settles
// in 70); his facing turns through a 100 ms damper, so he visibly turns and then commits. The
// throat sac swells with the croak's own progress, and squash rides on top as a spring.
import { BufferGeometry, Group, SkeletonUtils, Vector3 } from "./three-lib.js?v=8898846";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=8898846";
import { charLight } from "./hero3d.js?v=8898846";
import { smoothNormals } from "./smooth3d.js?v=8898846";

/** His normals relaxed this much at load (smooth3d.js); clones share the asset's geometry. */
export const TOAD_SMOOTH = Object.freeze({ passes: 4, amount: 0.6 });
/** How much deeper his outline hull is drawn than his body (polygon offset; see the hull below). */
export const TOAD_HULL_OFFSET = Object.freeze({ factor: 24, units: 120 });
const smoothed = new WeakSet();
import { makeSampler } from "./anim/sampler.js?v=8898846";
import { makeInertializer } from "./anim/blend.js?v=8898846";
import { makeBossRecord, bossAnimState } from "./anim/boss-anim3d.js?v=8898846";
import { dampAngle, springStep, wrapAngle } from "./anim/procedural.js?v=8898846";
import { makeToadLife } from "./anim/toad-life.js?v=8898846";
import { BOSS_MODELS } from "./boss-profiles.js?v=8898846";
import { bench, makeHold } from "./anim/hold.js?v=8898846";
import { makeFeet } from "./anim/feet.js?v=8898846";
import { tongueMouth, makeTongue, TONGUE_COLOR } from "./tongue3d.js?v=8898846";

/**
 * The model bench's tongue (G10 re-review: the bench's lash clips showed an open mouth and no
 * tongue, which only the renderer draws, from the live lane — so they could not be compared with the
 * 2D lash's long curled tongue). On the bench alone, while lash_strike or lash_recover is held, the
 * game's own tongue tube (tongue3d.js) is drawn from his mouth along his facing: out over the first
 * 30% of the strike and held, drawn back through the recovery with the renderer's wobble. Its reach
 * is cut to `len` (the game's lane runs 210 units, off any review frame).
 */
export const BENCH_TONGUE = Object.freeze({ len: 24, out: 0.3, back: 0.75 });
/** How far out the bench's tongue is (0..1) for a held clip at `u` (0..1 of it). */
export function benchTongueK(clip, u) {
  if (clip === "lash_strike") return Math.min(1, u / BENCH_TONGUE.out);
  if (clip === "lash_recover") return Math.max(0, 1 - u / BENCH_TONGUE.back) * (1 + 0.08 * Math.sin(u * 40));
  return 0;
}

export const TOAD_H = 27.8;
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
export const TOAD_LIGHT = { fill: 0xfff0d8, fillAmt: 0.7, rim: 0xffe39a, rimAmt: 0.18, max: 0.95, tint: 0.35, sat: 0.88, pale: 0.6 };

/**
 * The outline hull's geometry: the model's own, less the triangles its `_hull` attribute (0 or 1 a
 * vertex, 51_rig_frog.py) leaves out — the mouth's inside and the tongue, where a hull showed as a
 * thin olive line across the open mouth. The same attribute buffers (the skinning included), only
 * its own index. A model without the attribute keeps every triangle.
 */
export function hullGeometry(geo) {
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

/** Gnasher's picker keys → his clips (one each); every boss's are in boss-profiles.js. */
const CLIPS = BOSS_MODELS.gnasher.clips;

/**
 * A boss's model, posed every frame from the sim. `profile` (boss-profiles.js) says how big it is
 * drawn, its clips, its legs and its living layers; Gnasher's by default.
 */
export function makeBoss3D(asset, look, profile = BOSS_MODELS.gnasher) {
  const P = profile;
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
    const inside = /^(mouth|tongue)/.test(o.material?.name || "");
    const m = paintMaterial(look, { color: map ? 0xffffff : inside ? o.material.color.getHex() : 0x3f8a2e, map, char: true });
    // The character light (materials3d.js, PAINT_CHAR): the sun is behind the fight, so his side
    // towards the camera needs the fill to show the target's green, cream belly and amber eyes.
    charLight(m, P.light || TOAD_LIGHT);
    o.material = m;
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
    o.parent.add(hull);
  }
  const bones = skinned[0]?.skeleton.bones || [];
  const sac = bones.find((b) => b.name === "sac");
  // Planted feet and turn-in-place steps (anim/feet.js), as the hero has: all four of his feet held
  // where they land, and stepped round when he turns on the spot (the owner, 2026-10-02/03: every
  // legged creature that moves on the ground does this). Hind legs thigh-shin-foot, front legs
  // upperarm-forearm-hand, as SkinTokens' names for him (53_anim_toad.py).
  const bone = (n) => bones.find((b) => b.name === n) || null;
  // (the profile names each leg's three bones, upper-lower-foot, without the side: a toad's four, a biped's two)
  const legs = ["L", "R"].flatMap((sd) => (P.legs || []).map(([a, b, c]) => ({ thigh: bone(`${a}_${sd}`), shin: bone(`${b}_${sd}`), foot: bone(`${c}_${sd}`) }))).filter((l) => l.thigh && l.shin && l.foot);
  // His living layers (anim/toad-life.js): the belly and sac springs, look-at, blinks, the sitting
  // weight shifts and swallows, hit leans — his movement guide's "procedural layers". (Another boss
  // gets those its bones allow: look-at, the hit lean, the start/stop rock.)
  const life = bones.length && P.life ? makeToadLife(bones, turn, P.life) : null;
  const feet = legs.length ? makeFeet(legs, P.feet) : null;
  const tongueBase = bones.find((b) => b.name === "tongue_base") || null;
  // Where the lashing tongue leaves him: just inside his lips, carried by the tongue's root (which the
  // jaw carries). At rest the root lies a fifth of the way from the jaw's hinge to the lower lip
  // (51_rig_frog.py), so the lips are four times that step on; the point three steps on, in the root's
  // own frame, stays just inside the open mouth whatever the jaw and the head do.
  const jawBone = bones.find((b) => b.name === "jaw") || null;
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
  const mouthAt = (out) => {
    obj.updateMatrixWorld(true);
    return tongueBase.localToWorld(out.copy(lipLocal));
  };
  if (tongueBase && jawBone) tongueMouth.at = () => (mouthAt(tongueAt), [tongueAt.x, tongueAt.y, tongueAt.z]);
  // On the model bench every clip the model holds can be shown (a new character's own moves); in the
  // game only the fight's clips are sampled.
  const names = bench.on ? { ...CLIPS, ...Object.fromEntries(asset.animations.map((a) => [a.name, a.name])) } : CLIPS;
  const sampler = makeSampler(model, asset.animations, names);
  const inert = makeInertializer(bones);
  const rec = makeBossRecord({ stride: P.stride, clips: CLIPS, windups: P.windups, after: P.after, durations: sampler.durations });
  // The model bench's hold (anim/hold.js), made only on the bench.
  const hold = bench.on ? (bench.boss = makeHold({ root: obj, bones, sampler, clips: asset.animations, names, rig: P.toad ? "toad" : "boss" })) : null;
  const benchTongue = hold && tongueBase && jawBone ? makeTongue(paintMaterial(look, { color: TONGUE_COLOR, char: true })) : null;
  const benchMouth = new Vector3();
  let yaw = null;
  const squash = { x: 1, v: 0 };
  let lastT = null;

  return {
    object: obj,
    materials: mats,
    record: rec,
    /** `b` (x, y in between), `s` = lerp3d.boss, `w`, `view` = { t }, `at` the drawn hop point. */
    update(b, s, w, view, at, lift) {
      const dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, view.t - lastT));
      lastT = view.t;
      const pick = bossAnimState(rec, b, s, w, view);
      // On the bench a hold (anim/hold.js) poses him instead of the picker. Off while held: the
      // picker's clip, the blend, the sac's swell and the squash; the facing snaps. (The renderer's
      // tongue, flash and dissolve are its own and stay as they are.)
      const held = !!hold?.active;
      if (held) hold.pose();
      else {
        const clip = CLIPS[pick.key] || CLIPS[pick.clip] || "idle";
        const dur = sampler.durations[clip] || 1;
        sampler.apply([{ clip, time: Math.min(dur - 1e-3, pick.u * dur), weight: 1 }]);
        inert.apply(pick.blendHalfLife, dt);
        // The croak clip swells the sac to 2D's full bubble itself; the cast's progress adds a pulse.
        if (sac) sac.scale.multiplyScalar(1 + pick.sac * 0.2);
      }
      obj.position.set(at.x, lift, at.y);
      const want = Math.PI / 2 - s.face;
      yaw = yaw == null || held ? want : dampAngle(yaw, want, 0.1, dt);
      turn.rotation.y = yaw;
      if (held) [squash.x, squash.v] = [1, 0];
      const sy = springStep(squash, held ? 1 : 1 + (pick.squash - 1) * 0.35, 5, 0.5, dt);
      const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
      turn.scale.set(sxz, sy, sxz);
      if (life) {
        obj.updateMatrixWorld(true);
        const key = held ? "" : CLIPS[pick.key] || CLIPS[pick.clip] || "idle";
        if (held) life.reset();
        const hero = w?.player;
        const lookYaw = !held && hero && WATCHING.has(key) ? wrapAngle(Math.PI / 2 - Math.atan2(hero.y - at.y, hero.x - at.x) - yaw) : null;
        life.apply(held ? 0 : dt, { t: view.t, lookYaw, sitting: key === "idle", alive: key !== "dead" && !held });
      }
      if (feet) {
        // On the ground and not leaping, landing or dying: feet held; sitting still, turn-steps.
        obj.updateMatrixWorld(true);
        const clip = CLIPS[pick.key] || CLIPS[pick.clip] || "idle";
        const grounded = !held && lift < 0.5 && !b.airborne && !/^(leap|land|dead|hurt)$/.test(clip);
        if (!grounded) feet.reset();
        feet.apply(dt, { enabled: grounded, standing: clip !== "walk" });
      }
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
    },
    setView(W, H) {
      model.traverse((o) => o.material?.userData?.outline?.uView.value.set(W, H));
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
  };
}
