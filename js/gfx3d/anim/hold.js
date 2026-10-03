// The model bench's hold (dev-anim3d.js; docs/3D-PLAN.md 6.9 gate G7, 6.10 gates G8 and G10): a
// character posed by hand instead of by the sim — one named clip held at one time, or the rest pose,
// and on top of either one joint bent towards a limit. The game never uses it: only the bench sets
// `bench.on` (before it makes the renderer), and only then does hero3d.js or boss3d.js make a hold
// and leave it here for the bench to drive. While a hold has a request, the character's update
// calls `pose()` in place of the picker, the sampler's layers and the blend, and switches off its
// own procedural layers (each file says which).
//
// The limits (G7). Every bendable joint gets one to three axes in its own bone frame — flex (the
// bone's x), side (z) and twist (y, along the bone) — or, for a hinge (elbow, knee, jaw), the one
// axis its clips actually bend it about, from the key furthest from rest, with the twist taken out
// and the sign the clips bend it. Each axis has a sensible range by joint group (below), widened to
// whatever the clips themselves reach, so the test never stops short of what a clip does. The root,
// the hips (the toad's body) and the weapon socket are not bent: every vertex turns with them.
import { Quaternion, Vector3 } from "../three-lib.js?v=8898846";
import { twoBoneIK, setWorldQuaternion } from "./ik.js?v=8898846";

/** Set by dev-anim3d.js only; the characters leave their holds here. */
export const bench = { on: false, hero: null, boss: null };

/** Ranges in degrees: a number n means ±n; [lo, hi] a range (for a hinge, + = the way its clips bend it). */
const GROUPS = {
  hero: [
    [/^root$|hips|weapon/, null],
    [/spine/, "spine", { flex: 30, side: 30, twist: 30 }],
    [/neck|head/, "neck", { flex: 40, side: 40, twist: 40 }],
    [/shoulder/, "clavicle", { flex: 20, side: 20 }],
    [/upper_?arm/, "shoulder", { flex: 90, side: 90, twist: 45 }],
    [/forearm/, "elbow", { hinge: [-10, 140], twist: 45 }],
    [/hand/, "wrist", { flex: 60, side: 30 }],
    // (a hip bends forward far, back hardly at all: 80° back is past any leg and any clip — they
    // reach 40° — and the cape can only go up with it as a slab; the table's 30° is widened to the clips')
    [/thigh/, "hip", { flex: [-80, 30], side: 45, twist: 30 }],
    [/shin/, "knee", { hinge: [-10, 140] }],
    [/foot/, "ankle", { flex: 40, side: 20 }],
    [/toe/, "toe", { flex: 30 }],
    // The cloth's own bones (50_rig_hero.py, hero_cloth.py): flex swings the tabard forward (−) and
    // the cape back (+), side to either side — the ranges the rig's solver keeps them in.
    // (The tabard: the clips swing it forward 42° at most (the roll); at 70 it folded up by the sword
    // hand showing its unpainted inside, torn — the G7 re-review; its inside is painted now
    // (tools/3d/hero_texfix.py) and it is tested to 48.)
    [/tabard/, "cloth", { flex: [-48, 12], side: 18 }],
    [/cape/, "cloth", { flex: [-20, 60], side: 24 }],
  ],
  toad: [
    [/^root$|^body$/, null],
    [/^spine/, "spine", { flex: 30, side: 30, twist: 20 }],
    // (A toad has next to no neck: his clips turn the head ±17° at most. At ±40 to the side or about
    // its length the chin's skin, which the throat and sac carry, tore — a jagged cream edge and a dark
    // gap under the chin, a dark seam across the jaw: the G7 re-review. Tested to ±28.)
    [/^head$/, "neck", { flex: 40, side: 28, twist: 28 }],
    [/^jaw$/, "jaw", { hinge: [-5, 40] }],
    // The tongue lies in the mouth's floor, as wide as the closed mouth lets it: turned 30° sideways
    // with the mouth shut its edge came out through the cream throat (the review's red sliver). The
    // clips turn it 0..11°; tested to ±15.
    [/^tongue/, "tongue", { flex: 30, side: 15 }],
    [/^(belly|throat|sac)$/, "jiggle", { flex: 20, side: 20 }],
    [/^(eye|lid|cheek)_/, "face", { flex: 20, side: 20 }],
    // (Flexed + the front leg swings back under him: at +90 it folded into his belly and left a dark
    // wedge between them, a pose no toad takes — the G7 re-review. His clips swing it back 22° at
    // most; tested to +50. Forward (−) it reaches out at the hero, to 90.)
    [/^upperarm_/, "shoulder", { flex: [-90, 50], side: 60, twist: 30 }],
    [/^forearm_/, "elbow", { hinge: [-10, 120] }],
    [/^hand_/, "wrist", { flex: 60, side: 30 }],
    [/^finger_/, "finger", { flex: 40, side: 20 }],
    // The toad's hind leg sits folded on the ground, so swinging it whole at the hip (flex, in the
    // leg's own plane: 51_rig_frog.py) drives the foot into the ground (+) or up behind the haunch (−)
    // long before any skin bends: ±80 showed the review a foot sunk out of sight and its underside
    // edge-on. His clips swing it −45..+28, and his feet are kept on the ground as they do
    // (61_frog_anims.py); tested to −60..+45.
    // Its side (z) lifts the haunch out of the body sideways: + swings its cut face, sunk in the flank
    // at rest, out into view (the review's faceted sheet over the haunch at +45) and the foot up off
    // the ground, which no clip does (they reach −39..+15); tested to −45..+20. Whichever way it
    // turns, the foot is kept on the ground as the clips keep it (makeHold's groundFoot).
    [/^thigh_/, "hip", { flex: [-60, 45], side: [-45, 20], twist: 30 }],
    // The toad's knee rests folded (thigh and shin 56° apart: 51_rig_frog.py): it unfolds (−, about
    // the shin's x, the knee's own axis) and folds (+) a little further. Unfolded on its own, with the
    // thigh still reaching forward, the lower leg swings forward and down into the ground (his leap
    // unfolds it with the thigh swung back: 61_frog_anims.py), so it is tested a little past what the
    // clips reach (−50..+56). (As a hinge like the hero's, −20..140 with + the way the clips' furthest
    // key bends it, the sheet turned the shin 140° through the haunch and the ground — the review's
    // "spike" and "flat slab" at +140 — and which way + went changed with each build's keys.)
    // (Unfolded to −65 the shin, seen from his left, thinned to a stick: the G7 re-review. Tested to
    // −55, past the clips' −50.)
    [/^shin_/, "knee", { flex: [-55, 45] }],
    // The hind foot lies along the ground under the haunch: flexed up (−) it turns its toes up into
    // the haunch right above it (at −60 only their pink tips showed, poking out of the haunch's skin
    // above the ankle). The clips lift it to −24 at most; tested to −30. Down (+) to 60.
    [/^foot_/, "ankle", { flex: [-30, 60], side: 30 }],
    [/^toe_/, "toe", { flex: 40 }],
  ],
};
const DEG = Math.PI / 180;
const AXES = { flex: [1, 0, 0], side: [0, 0, 1], twist: [0, 1, 0] };
const qA = new Quaternion();
const qB = new Quaternion();
const vA = new Vector3();

/** GLTFLoader drops "." from node names ("DEF-hand.L" → "DEF-handL"); either spelling finds the bone. */
export const cleanName = (n) => String(n).replace(/[\s[\].:/]/g, "");

/** The rotation from rest to a key, in the bone's rest frame, as a rotation vector (radians). */
function rotVec(rest, x, y, z, w, out) {
  qA.copy(rest).invert().multiply(qB.set(x, y, z, w));
  if (qA.w < 0) qA.set(-qA.x, -qA.y, -qA.z, -qA.w);
  const s = Math.hypot(qA.x, qA.y, qA.z);
  if (s < 1e-9) return out.set(0, 0, 0);
  const ang = 2 * Math.atan2(s, qA.w);
  return out.set((qA.x / s) * ang, (qA.y / s) * ang, (qA.z / s) * ang);
}

/** Every key of every clip for this bone, as rotation vectors from rest. */
function keysOf(bone, rest, clips) {
  const out = [];
  for (const c of clips) {
    for (const t of c.tracks) {
      if (t.name !== `${bone.name}.quaternion`) continue;
      const v = t.values;
      for (let i = 0; i < v.length; i += 4) out.push(rotVec(rest, v[i], v[i + 1], v[i + 2], v[i + 3], new Vector3()));
    }
  }
  return out;
}

function jointTable(bones, rest, clips, rig) {
  const groups = GROUPS[rig] || GROUPS.hero;
  const out = [];
  bones.forEach((bone, i) => {
    const g = groups.find(([re]) => re.test(bone.name));
    if (!g || !g[1]) return;
    const [, group, spec] = g;
    const keys = keysOf(bone, rest[i].q, clips);
    const axes = [];
    for (const [label, r] of Object.entries(spec)) {
      let vec;
      if (label === "hinge") {
        // The clips' own hinge: the key furthest from rest, its twist taken out.
        let best = null;
        for (const k of keys) if (!best || k.length() > best.length()) best = k;
        vec = best && best.length() > 5 * DEG ? new Vector3(best.x, 0, best.z) : new Vector3(1, 0, 0);
        if (vec.lengthSq() < 1e-8) vec.set(1, 0, 0);
        vec.normalize();
      } else vec = new Vector3(...AXES[label]);
      let [lo, hi] = Array.isArray(r) ? r : [-r, r];
      // The clips' own reach along this axis.
      let clipLo = 0;
      let clipHi = 0;
      for (const k of keys) {
        const d = k.dot(vec) / DEG;
        clipLo = Math.min(clipLo, d);
        clipHi = Math.max(clipHi, d);
      }
      const table = [lo, hi];
      lo = Math.min(lo, Math.floor(clipLo));
      hi = Math.max(hi, Math.ceil(clipHi));
      axes.push({ axis: label, vec: vec.toArray().map((v) => +v.toFixed(4)), lo, hi, table, clips: [Math.round(clipLo), Math.round(clipHi)] });
    }
    out.push({ name: bone.name, group, axes });
  });
  return out;
}

/**
 * A character's hold. `root` its object in the world (the bench measures it), `bones` its
 * skeleton's bones, `sampler` its sampler (anim/sampler.js), `clips` the AnimationClips the sampler
 * plays (the hero's mirrored ones), `names` our clip names → the file's, `rig` "hero" | "toad",
 * `extra` clips the character poses itself ({ name: { duration, base, layers? } }: `base` is sampled
 * at its start first — or, with `layers(time)`, the sampler is given those layers — then `pose()`
 * hands the clip back to the caller).
 */
export function makeHold({ root = null, bones, sampler, clips, names, rig, extra = {} }) {
  const rest = bones.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone(), s: b.scale.clone() }));
  let req = null;
  let table = null;
  const joints = () => (table ||= jointTable(bones, rest, clips, rig));
  const clipOf = (ours) => clips.find((c) => c.name === (names[ours] || ours));
  const loops = (clip) =>
    !!clip &&
    clip.tracks.every((t) => {
      const n = t.getValueSize();
      const v = t.values;
      for (let i = 0; i < n; i++) if (Math.abs(v[i] - v[v.length - n + i]) > 2e-3) return false;
      return true;
    });
  // The hero's cloth follows a thigh or knee bent from rest as the rig's own solver poses it in every
  // clip (50_rig_hero.py cloth_follow: the file's clothFollow extras, a table by joint, axis and
  // angle; a knee's hinge read on its flex, the part of the hinge about the bone's x), so the
  // deformation sheet shows the tabard and the cape moving with the leg as the clips do.
  let follow;
  const followOf = () => {
    if (follow === undefined) {
      follow = null;
      root?.traverse((o) => {
        if (!follow && o.userData?.clothFollow) follow = o.userData.clothFollow;
      });
    }
    return follow;
  };
  function followCloth(joint, a, angle) {
    const f = followOf();
    const hinge = a.axis === "hinge";
    const deg = hinge ? angle * a.vec[0] : angle;
    const rows = f?.joints && Object.entries(f.joints).find(([n]) => cleanName(n) === joint)?.[1]?.[hinge ? "flex" : a.axis];
    if (!rows?.length) return;
    const x = Math.max(rows[0][0], Math.min(rows[rows.length - 1][0], deg));
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1][0] < x) i++;
    const u = rows[i + 1][0] > rows[i][0] ? (x - rows[i][0]) / (rows[i + 1][0] - rows[i][0]) : 0;
    f.bones.forEach((name, k) => {
      const bone = bones.find((b) => b.name === cleanName(name));
      if (!bone) return;
      const at = (j) => rows[i][j] + (rows[i + 1][j] - rows[i][j]) * u;
      const out = at(1 + 2 * k) * DEG * f.out[k];
      const side = at(2 + 2 * k) * DEG;
      // hero_cloth.rot_local: the length swung out (about the bone's x), then to the side (about its z)
      bone.quaternion.multiply(qA.setFromAxisAngle(vA.set(0, 0, 1), side)).multiply(qB.setFromAxisAngle(vA.set(1, 0, 0), out));
    });
  }
  // The toad's hind foot kept on the ground while his hip is bent, as the clips plant it
  // (61_frog_anims.py, key_all's ground() with `_plant` "legs": the leg solved as two bones so the
  // heel stands at its resting height where the turn carried it, the foot then laid flat as at rest).
  // His leg rests folded with the foot along the ground, so a hip turned on its own swung the folded
  // shin and foot up into the haunch or down through the ground — at −60 the review saw a flat slab
  // with the foot out of sight — a pose no clip shows. The knee and ankle rows stay single-joint.
  const byName = (n) => bones.find((b) => b.name === n);
  const topOf = (o) => {
    while (o.parent) o = o.parent;
    return o;
  };
  function toadLeg(name) {
    const m = /^thigh_([LR])$/.exec(name);
    if (!m) return null;
    const leg = { thigh: byName(`thigh_${m[1]}`), shin: byName(`shin_${m[1]}`), foot: byName(`foot_${m[1]}`), toe: byName(`toe_${m[1]}`) };
    return leg.thigh && leg.shin && leg.foot ? leg : null;
  }
  function restFoot(leg) {
    topOf(leg.thigh).updateMatrixWorld(true);
    leg.heel0 = leg.foot.getWorldPosition(new Vector3());
    leg.q0 = leg.foot.getWorldQuaternion(new Quaternion());
  }
  function groundFoot(leg) {
    topOf(leg.thigh).updateMatrixWorld(true);
    const heel = leg.foot.getWorldPosition(new Vector3());
    twoBoneIK(leg.thigh, leg.shin, leg.foot, new Vector3(heel.x, leg.heel0.y, heel.z), null, 1);
    setWorldQuaternion(leg.foot, leg.q0);
  }
  return {
    rig,
    root,
    get active() {
      return req != null;
    },
    get request() {
      return req;
    },
    /**
     * `r` = { clip, time } (seconds) and/or { joint, axis, amount } (amount −1..1: −1 the axis's low
     * limit, 0 rest, 1 its high limit); null gives the character back to the sim.
     */
    set(r) {
      req = r;
    },
    clips() {
      const own = Object.keys(sampler.durations).map((name) => ({ name, duration: sampler.durations[name], loop: loops(clipOf(name)) }));
      const more = Object.entries(extra).map(([name, e]) => ({ name, duration: e.duration, loop: false, procedural: true }));
      return [...own, ...more];
    },
    joints() {
      return joints().map(({ name, group, axes }) => ({ name, group, axes: axes.map(({ axis, lo, hi, table, clips }) => ({ axis, lo, hi, table, clips })) }));
    },
    /** The angle (degrees) a request bends its joint to, or null. */
    angleOf(r = req) {
      const a = this.axisOf(r);
      if (!a) return null;
      const k = Math.max(-1, Math.min(1, Number(r.amount) || 0));
      return k >= 0 ? k * a.hi : -k * a.lo;
    },
    axisOf(r = req) {
      if (!r?.joint) return null;
      const j = joints().find((x) => x.name === cleanName(r.joint));
      if (!j) return null;
      return j.axes.find((a) => a.axis === r.axis) || j.axes[0];
    },
    /**
     * Pose the skeleton from the request: the rest pose, then the clip at its time, then the bend.
     * Returns { clip, time } when the clip is one of `extra` (the caller poses that itself), else null.
     */
    pose() {
      if (!req) return null;
      bones.forEach((b, i) => {
        b.quaternion.copy(rest[i].q);
        b.position.copy(rest[i].p);
        b.scale.copy(rest[i].s);
      });
      // With no clip on, the sampler poses every animated bone at its original (rest) value, so it is
      // back in step with the bones whatever was held before; the clip below then poses from there.
      sampler.apply([]);
      let own = null;
      if (req.clip) {
        const e = extra[req.clip];
        const name = e ? e.base : req.clip;
        const dur = sampler.durations[name];
        const t = e ? Math.max(0, Math.min(e.duration, Number(req.time) || 0)) : Number(req.time) || 0;
        // (An extra with `layers` is posed from the layers it gives for t: the game's own clips at the
        // game's own times for it.)
        if (e?.layers) sampler.apply(e.layers(t));
        else if (dur) sampler.apply([{ clip: name, time: e ? 0 : Math.max(0, Math.min(dur - 1e-4, t)), weight: 1 }]);
        if (e) own = { clip: req.clip, time: t };
      }
      const a = this.axisOf();
      if (a) {
        const bone = bones.find((b) => b.name === cleanName(req.joint));
        const leg = !req.clip && rig === "toad" ? toadLeg(bone.name) : null;
        if (leg) restFoot(leg);
        bone.quaternion.multiply(qA.setFromAxisAngle(vA.fromArray(a.vec), this.angleOf() * DEG));
        if (!req.clip) followCloth(bone.name, a, this.angleOf());
        if (leg) groundFoot(leg);
      }
      return own;
    },
  };
}
