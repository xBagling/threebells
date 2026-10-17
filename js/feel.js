// How hits FEEL — the ONE file the autoresearch loop edits for impact (.claude/skills/autoresearch; scored by
// tools/feel-score.mjs: real bot fights, every impact event measured against AAA practice — hit-stop growing with the blow
// as Smash's hitlag does (frames = base + damage share, up to ~20-30 frames on the biggest), light/medium/heavy around
// 9/11/13 frames in fighting games, Eiserloh's trauma² camera shake, every big moment acknowledged, and the freezes never
// adding up to a sluggish fight). The owner, 2026-10-11: "make all the attacks and boss fight feel more impactful, and
// more polished like a triple a game".
// Pure data: the sim (sim/world.js) reads the freezes, shakes and slow motion; the view (gfx3d/render3d.js, gfx/camera.js,
// gfx3d/overlay3d.js, ui/fight.js) reads the rest. Times in seconds; shake in the sim's units (22 = the camera's full
// trauma). Hit-stop freezes both sides alike, so it never changes the fight's difficulty.
export const FEEL = {
  // the hero's blade landing on the boss: a base freeze plus a share per point of damage (Smash-style), capped
  hit: { stop: 0.04, perDmg: 0.0025, max: 0.085, shake: 3, shakePerDmg: 0 },
  heavy: { stop: 0.1, perDmg: 0, max: 0.1, shake: 6, shakePerDmg: 0 },
  crit: { stop: 0, shake: 0 }, // (added on a critical hit)
  flat: { stop: 0, shake: 3 }, // a bomb, knife or spell
  add: { stop: 0.03 }, // a blade into a fly or another add
  clang: { stop: 0.05, shake: 0 }, // the blade on a boss that cannot be hurt now
  taken: { stop: 0.08, perDmg: 0.0025, max: 0.165, shake: 7, shakePerDmg: 0 }, // the hero hit
  parry: { stop: 0.1, shake: 4 },
  block: { stop: 0, shake: 3 },
  guardBreak: { stop: 0, shake: 0 },
  stagger: { stop: 0.15, shake: 10 }, // the boss's poise broken
  phase: { stop: 0.14, shake: 9 }, // the boss into his next phase
  kill: { stop: 0.25, shake: 14, slow: 0.3}, // the killing blow; slow: the time scale it drops to (0 = none), easing back
  // (freezes take the longest of what lands together instead of the last; off = the last one wins, as before)
  stopMax: false,
  // ---- the view ----
  // the camera: a kick along the blow (units per point of sim shake) and a zoom punch (share of the view) on big moments
  cam: { kick: 0.3, punch: 0.05},
  // damage numbers: a pop (scale over the first instant) and size growing with the damage
  numbers: { pop: 0.5, size: 0.35},
  // the boss's white hit-flash: its strength on a hit, a heavy/crit and the kill, how long it fades and how long the first
  // flash holds at full (an impact frame); a white flash over the whole screen on the killing blow (its opacity; 0 = none)
  flash: { hit: 0.75, heavy: 1, kill: 1, dur: 0.12, hold: 0.02, screenKill: 0.4},
  // the killing blow's camera: a zoom in (share) held this long before it eases out (0 = the plain punch)
  killZoom: { amt: 0.12, hold: 0.5},
  // the health bars: the boss bar's chip (the lost part, white) held this long before it drains; the hero's hearts shaking
  // and flashing when he is hit (0 = none)
  hud: { chipHold: 0.45, heartHit: 0.35},
  // phone vibration, ms (0 = none)
  haptics: { hit: 10, heavy: 22, hurt: 40, stagger: 50, kill: 90},
  // the boss's model nudged along a blow (units per point of damage, held through the freeze, springing back; 0 = none —
  // drawn only: where the fight has him never moves)
  bossNudge: 0.1, bossNudgeMax: 3,
  // sound: a muffle under each freeze (the low-pass floor in Hz; 0 = none), a crit's own ring, a parry's own chime
  audio: { duck: 1100, crit: true, parry: true},
  // a burst where the boss's poise breaks and where he dies (particles; 0 = none)
  bursts: { stagger: 18, kill: 30, clang: 8},
  // the heavy cut's sword trail (the 3rd cut, a finisher, a slam) heavier than a light cut's pale blur (the owner's next-step
  // pick, 2026-10-11: "heavier sword trails on the 3rd cut"): where on the blade it starts (a light cut 0.65 — lower = wider),
  // its body and edge opacity (a light cut 0.06 / 0.55), and how much longer it lingers (s; 0 = as a light cut)
  // the boss's keyed flinch laid over his move when a blade lands (gfx3d/boss3d.js; a light cut from his left or right, a
  // heavy one knocks him back on his haunches — keyed in Blender, 53_anim_toad.py): its strength (0 = none, only the lean)
  bossFlinch: 1,
  heavyTrail: { inner: 0.35, body: 0.16, edge: 0.85, linger: 0.06},
};

/** A freeze for a blow of `dmg` on the profile `f` (FEEL.hit, .heavy, .taken). */
export const stopFor = (f, dmg = 0) => Math.min(f.max ?? f.stop, f.stop + (f.perDmg || 0) * dmg) || 0;
/** A shake for a blow of `dmg` on the profile `f`. */
export const shakeFor = (f, dmg = 0) => (f.shake || 0) + (f.shakePerDmg || 0) * dmg;
