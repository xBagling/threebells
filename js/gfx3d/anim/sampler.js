// Poses a skeleton at exactly the clip times the picker chose (docs/3D-PLAN.md 7.2).
//
// Every clip is a three.js AnimationAction, but none ever runs on its own clock: each frame the
// chosen actions get their time and weight set by hand, the rest are switched off, and the mixer is
// evaluated once with a zero time step. Then an inertialization pass (blend.js) smooths any change
// of clip, and the procedural layers go on top.
//
// The mixer writes a property only when the value it works out differs from the one it worked out
// last time (PropertyMixer.apply compares its own two buffers, never the object). So when the clip
// time repeats — a hit-stop, a held wind-up, the bench's still frame — it writes nothing, and
// everything layered on top of the sampled pose last frame (the blend's offsets, the cut, the feet,
// the springs, the sac) would be layered on again, and grow every frame. So the sampled pose is kept:
// before each evaluation every animated object is put back to exactly what the mixer gave it last
// time, and the mixer then writes whatever changed. Every frame starts from the clean sampled pose,
// whether the time moved or not.
import { AnimationMixer, LoopRepeat } from "../three-lib.js?v=8898846";

/**
 * `root` is the character's object tree, `clips` its AnimationClips, `names` maps our clip names
 * (idle, walk, run, roll, swing1…) to the clip names in the file. Returns { durations, apply }.
 */
export function makeSampler(root, clips, names) {
  const mixer = new AnimationMixer(root);
  const actions = new Map();
  const durations = {};
  for (const [ours, theirs] of Object.entries(names)) {
    const clip = clips.find((c) => c.name === theirs);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    a.setLoop(LoopRepeat, Infinity);
    a.enabled = false;
    a.play();
    actions.set(ours, a);
    durations[ours] = clip.duration;
  }
  // What the mixer may touch, and what the layers above it touch: every bone, and every node a
  // clip names. Their position, rotation and scale as sampled, kept between frames.
  const kept = new Set();
  root.traverse((o) => o.isBone && kept.add(o));
  for (const clip of clips)
    for (const t of clip.tracks) {
      const node = t.name.slice(0, t.name.lastIndexOf(".")); // "<node>.<property>"
      const o = node === root.name || node === root.uuid ? root : root.getObjectByName(node);
      if (o?.isObject3D) kept.add(o);
    }
  const objs = [...kept];
  const sampled = objs.map((o) => ({ p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
  const live = new Set();
  return {
    durations,
    mixer,
    /** Set the layers ([{ clip, time, weight }]) and evaluate. */
    apply(layers) {
      const now = new Set();
      for (const l of layers) {
        const a = actions.get(l.clip);
        if (!a || l.weight <= 0) continue;
        if (now.has(l.clip)) {
          a.setEffectiveWeight(a.getEffectiveWeight() + l.weight);
          continue;
        }
        now.add(l.clip);
        a.enabled = true;
        a.time = l.time;
        a.setEffectiveWeight(l.weight);
      }
      for (const name of live) if (!now.has(name)) actions.get(name).enabled = false;
      live.clear();
      for (const n of now) live.add(n);
      // Back to the pose the mixer gave last frame (it writes only what changes), then evaluate.
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const k = sampled[i];
        o.position.copy(k.p);
        o.quaternion.copy(k.q);
        o.scale.copy(k.s);
      }
      mixer.update(0);
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const k = sampled[i];
        k.p.copy(o.position);
        k.q.copy(o.quaternion);
        k.s.copy(o.scale);
      }
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  };
}
