// Animating a painted character.
//
// A diffusion model will give you one beautiful sprite. It will not give you twelve frames of a
// walk cycle that agree with each other — try it and the cloak changes shape every frame. So the
// characters here are animated the way a puppet is: one painted sprite, deformed.
//
// Squash, stretch, lean, bob, rock and lift, driven by continuous curves rather than by a frame
// index. That has two real advantages over a sprite sheet:
//
//  · it is smooth at any frame rate — there is no 12-fps stutter in a 144 Hz frame
//  · a wind-up can *hold*, and a Souls wind-up must be able to hold
//
// Every clip below is a function of normalised time over the clip's own length (clipLength), so
// the same curve reads correctly whether the clip lasts four tenths of a second or four seconds.
import { clamp } from "../util.js?v=8898846";

/** The identity pose: no deformation at all. */
export const REST = { sx: 1, sy: 1, lean: 0, bob: 0, lift: 0, rock: 0 };

const ease = (t) => t * t * (3 - 2 * t);
const out = (t) => 1 - (1 - t) * (1 - t);
const spike = (t, at, w) => Math.max(0, 1 - Math.abs(t - at) / w);
/** A squash that conserves area, so a character never looks like it changed weight. */
const squash = (k) => ({ sx: 1 + k, sy: 1 / (1 + k) });

/**
 * Clip → pose. `t` is seconds into the clip, `dur` the clip's whole length.
 * `anim` is a free-running clock for anything that should breathe regardless.
 */
export function poseOf(clip, t, dur, anim = 0) {
  const u = clamp(dur > 0 ? t / dur : 0, 0, 1);
  switch (clip) {
    // --- shared ---------------------------------------------------------------------------------
    case "idle": {
      // Breathing: a slow area-conserving squash, plus a half-pixel rise on the out-breath.
      const b = Math.sin(anim * 1.9);
      const s = squash(b * 0.022);
      return { ...REST, ...s, bob: b * 0.9 };
    }
    case "hurt": {
      const k = out(u);
      return { ...REST, ...squash(0.1 * (1 - k)), lean: -3 * (1 - k), rock: -0.05 * (1 - k) };
    }
    case "dead": {
      // Down onto its side and still.
      const k = ease(u);
      return { ...REST, sx: 1 + k * 0.25, sy: 1 - k * 0.45, lean: k * 9, rock: k * 0.5, bob: -k * 3 };
    }

    // --- Gnasher ----------------------------------------------------------------------------------
    case "croak": {
      // The throat fills. Wide and low, then a shudder at the top.
      const k = ease(u);
      return { ...REST, sx: 1 + k * 0.16, sy: 1 + k * 0.05, bob: -k * 1.5 + Math.sin(anim * 26) * k * 0.6 };
    }
    case "gape": {
      // Rears back, then throws itself forward as the tongue goes.
      const back = spike(u, 0.42, 0.42);
      const out2 = clamp((u - 0.55) / 0.25, 0, 1);
      return { ...REST, ...squash(-0.1 * back + 0.14 * out2), lean: -4 * back + 11 * out2, bob: 1.5 * back };
    }
    case "lash":
      return { ...REST, ...squash(0.16), lean: 13, bob: -1 };
    case "crouch": {
      // Down, and held there: the last third is the hold that makes Gnasher's feint work.
      const k = ease(clamp(u / 0.68, 0, 1));
      return { ...REST, ...squash(0.2 * k), bob: -2 * k };
    }
    case "leap": {
      // Stretched thin in the air, then flattened on landing.
      const k = ease(u);
      return { ...REST, ...squash(-0.22 + k * 0.1), bob: 3 };
    }

    // --- Sister Cinder -------------------------------------------------------------------------------
    case "cast": {
      // Rises, arches back and holds, then snaps forward right at the end, as it goes off.
      const rise = ease(clamp(u / 0.5, 0, 1));
      const snap = clamp((u - 0.8) / 0.16, 0, 1);
      return { ...REST, sy: 1 + rise * 0.06 - snap * 0.05, lean: -5 * rise + 9 * snap, lift: 4 * rise, rock: -0.04 * rise + 0.06 * snap };
    }
    case "veil": {
      const k = ease(u);
      return { ...REST, ...squash(-0.08 * k), lift: 3 * k, bob: Math.sin(anim * 3.4) * 1.4 };
    }
    case "veiled":
      return { ...REST, lift: 4 + Math.sin(anim * 2.2) * 2, rock: Math.sin(anim * 1.3) * 0.03 };

    // --- The Drowned King -----------------------------------------------------------------------------
    case "raise": {
      // Winds up slowly and *holds* at the top — the hold is the whole point.
      const k = ease(clamp(u / 0.55, 0, 1));
      return { ...REST, sy: 1 + k * 0.05, lean: -7 * k, rock: -0.07 * k, bob: -1.5 * k };
    }
    case "slam": {
      const k = clamp(u / 0.35, 0, 1);
      const rec = clamp((u - 0.45) / 0.55, 0, 1);
      return { ...REST, ...squash(0.2 * k * (1 - rec * 0.7)), lean: 16 * k * (1 - rec * 0.8), rock: 0.1 * k * (1 - rec), bob: 2 * k };
    }
    case "call": {
      const k = ease(u);
      return { ...REST, sy: 1 + k * 0.09, sx: 1 - k * 0.03, bob: -3 * k, lean: -3 * k };
    }
    case "flood":
      return { ...REST, sy: 1.07, bob: -2 + Math.sin(anim * 2.6) * 1.2, rock: Math.sin(anim * 1.1) * 0.02 };

    default:
      return { ...REST };
  }
}

/**
 * How long the boss's current clip will actually run, in seconds.
 *
 * A pose is a curve over its clip's own length, and a clip only lasts until the move's next beat
 * changes it — timing every clip against the whole move meant the King's raise peaked 0.08 s
 * before the slam replaced it and Gnasher's held crouch never finished rising. A move's beats are
 * functions, so its clip timeline is read once by running them against a stub that only records
 * clip changes.
 */
export function clipLength(b) {
  if (b.clip === "idle") return 1;
  if (b.clip === "dead") return 1.4;
  const m = b.move;
  if (!m) return 0.6;
  const start = b.moveT - b.clipT; // move time at which the current clip began
  const next = clipTimeline(m).find((e) => e.at > start + 1e-6);
  return Math.max(0.25, (next ? next.at : m.dur) - start);
}

const timelines = new WeakMap();
function clipTimeline(m) {
  let tl = timelines.get(m);
  if (tl) return tl;
  tl = [{ at: 0, clip: m.clip || "idle" }];
  const boss = { x: 0, y: -40, vx: 0, vy: 0, face: Math.PI / 2, hp: 1, hpMax: 1, r: 20, used: {} };
  const noop = () => {};
  const target = { player: { x: 0, y: 40, vx: 0, vy: 0 }, boss, adds: [], hazards: [], shots: [], events: [], rand: () => 0.5, aimAtPlayer: () => Math.PI / 2, hazard: (o) => o };
  // Anything a beat calls that is not stubbed above is a no-op; nothing it does can leak out.
  const fake = new Proxy(target, { get: (t, k) => (k in t ? t[k] : noop) });
  for (const beat of [...m.beats].sort((x, y) => x.at - y.at)) {
    target.clip = (_, name) => tl.push({ at: beat.at, clip: name });
    try {
      beat.do(fake, boss);
    } catch {
      // A beat that needs the real world just contributes no clip change.
    }
  }
  timelines.set(m, tl);
  return tl;
}

/**
 * The hero's own poses. The sprite is one painted figure; the run is a bob, a lean and a
 * conserved squash, which at this size reads as a stride.
 */
export function heroPose(state, t, anim, extra = {}) {
  switch (state) {
    case "run": {
      const p = anim * 9.5;
      const step = Math.abs(Math.sin(p));
      return { ...REST, ...squash(0.05 * Math.cos(p * 2) - 0.03), bob: -step * 2.2, lean: 3 + Math.sin(p) * 1.6, rock: Math.sin(p) * 0.03 };
    }
    case "roll": {
      const u = clamp(t, 0, 1);
      // Tucks, rolls through, and stands back up.
      const tuck = Math.sin(u * Math.PI);
      return { ...REST, sx: 1 + tuck * 0.2, sy: 1 - tuck * 0.42, bob: -tuck * 2, rock: u * 0.9 - 0.1, lean: tuck * 5 };
    }
    case "attack": {
      const { wind = 0.12, active = 0.09, total = 0.4 } = extra;
      if (t < wind) {
        const k = ease(t / wind);
        return { ...REST, lean: -6 * k, ...squash(-0.05 * k), rock: -0.05 * k };
      }
      if (t < wind + active) {
        const k = (t - wind) / active;
        return { ...REST, lean: -6 + 22 * out(k), ...squash(0.12), rock: -0.05 + 0.16 * k, bob: -1 };
      }
      const k = clamp((t - wind - active) / Math.max(0.01, total - wind - active), 0, 1);
      return { ...REST, lean: 16 * (1 - ease(k)), rock: 0.11 * (1 - ease(k)) };
    }
    case "hurt": {
      const k = out(clamp(t / 0.26, 0, 1));
      return { ...REST, lean: -9 * (1 - k), ...squash(0.08 * (1 - k)), rock: -0.1 * (1 - k) };
    }
    case "dead": {
      const k = ease(clamp(t / 0.9, 0, 1));
      return { ...REST, sy: 1 - k * 0.5, sx: 1 + k * 0.2, lean: k * 12, rock: k * 0.7, bob: -k * 2 };
    }
    default: {
      const b = Math.sin(anim * 2.2);
      return { ...REST, ...squash(b * 0.018), bob: b * 0.7 };
    }
  }
}
