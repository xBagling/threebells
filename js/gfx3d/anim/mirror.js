// Mirrored clips, for a left-handed hero in 3D (D7, decided by the owner 2026-09-30): the library's
// clips are right-handed (UAL's Sword_Idle holds the sword in the right hand), so every clip is
// mirrored at load — each .L bone's track swapped with its .R twin, and every rotation and position
// reflected across the body's middle (the model's local x → −x). On a skeleton whose rest pose is
// itself mirror-symmetric (UAL's is; our rig fits UAL's), that turns each clip into its exact
// mirror image: the grip, the lean and the step all change sides together.
//
// The reflection of a rotation across the plane x = 0, written in frames that mirror each other, is
// (qx, qy, qz, qw) → (qx, −qy, −qz, qw); a position is (x, y, z) → (−x, y, z). Checked bone by bone
// against the reflected world positions of the original pose (tools/test.mjs).
import { AnimationClip } from "../three-lib.js?v=8898846";

/** GLTFLoader turns "DEF-hand.L" into "DEF-handL"; both spellings pair up. */
function twinOf(name, names) {
  const m = /^(.*?)(\.?)([LR])$/.exec(name);
  if (!m) return null;
  const other = `${m[1]}${m[2]}${m[3] === "L" ? "R" : "L"}`;
  return names.has(other) ? other : null;
}

/** One clip, mirrored. Tracks are "<node>.<property>"; only nodes with a twin are swapped. */
export function mirrorClip(clip) {
  const nodes = new Set(clip.tracks.map((t) => t.name.slice(0, t.name.lastIndexOf("."))));
  const tracks = clip.tracks.map((t) => {
    const dot = t.name.lastIndexOf(".");
    const node = t.name.slice(0, dot);
    const prop = t.name.slice(dot + 1);
    const out = t.clone();
    out.name = `${twinOf(node, nodes) || node}.${prop}`;
    const v = out.values;
    if (prop === "quaternion") {
      for (let i = 0; i < v.length; i += 4) {
        v[i + 1] = -v[i + 1];
        v[i + 2] = -v[i + 2];
      }
    } else if (prop === "position") {
      for (let i = 0; i < v.length; i += 3) v[i] = -v[i];
    }
    return out;
  });
  return new AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

export const mirrorClips = (clips) => clips.map(mirrorClip);
