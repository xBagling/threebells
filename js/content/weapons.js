// The hero's arms (the owner, 2026-10-04: "the same ability to select different weapons for our hero ... in either
// the right hand, or left hand, or dual wield", after Elden Ring). Data only: the sim (sim/player.js) reads the
// moves and guards, the renderer (gfx3d/weapons3d.js) builds the model of the same id, and the checks hold the
// two to each other (a move's reach is the drawn weapon's tip).
//
// How the hands work, as in Elden Ring:
//   main hand (his sword hand)  the attack button: the weapon's light chain (R1).
//   off hand                     the off-hand button (L1):
//     a shield                   raise it and hold: a guard (`guard`), a buckler parries if raised just in time;
//     the same class of weapon   a paired attack (power stance): both weapons together, their own chain;
//     another weapon             that weapon's chain, struck with the off hand (mirrored);
//     nothing                    a two-handed weapon is held in both hands (its `two` chain, harder), and the
//                                button guards with the weapon itself (a poor guard).
//   a guard just after blocking  the next attack is a guard counter: the chain's last move, harder.
//
// A move: `pose` the cut's shape (the renderer's moveset, anim/moves3d.js), `sweep` +1 the sword hand's forehand
// across the facing (config.js FORE: from his right to his left with the sword in his right hand) or −1 back, `shape` "arc" (the blade sweeps its yaw), "thrust" (it
// drives straight along the facing) or "slam" (it falls from above onto a narrow line); wind/active/recover
// seconds; dmg, poise (stagger dealt), cost (stamina), arc (radians swept), `armor` (hyper-armour: hits in the
// wind-up and the live window do not stagger him), `reach` the hand's distance from his middle in the live
// window (the range is that plus the weapon's tip). The sword's moves are the game's combo (config.js), as before.
//
// The timing, shapes, poise and hyper-armour are Elden Ring's (docs/WEAPONS.md). The damage is not: it is balanced so
// every chain does about the sword's damage per second of fight in the bots' hands against every boss (within ±15%,
// casual, keen and expert; `bun tools/weapon-balance.mjs`, `--tune` to level a new weapon). With Elden Ring's per-hit
// numbers a colossal sword won Boss I in 16-20 s (5.7× the sword's damage per second) and a shortsword lost it (0.47×):
// reach is worth that much here, since a long weapon fights from beyond most of a boss's reach. So a long weapon hits
// softer per blow and a short one harder (you stand in the boss's face), and the heavy ones keep their stagger.
import { PLAYER } from "../config.js?v=df092a6";

/**
 * Where the drawn hand is, out from his middle on the ground, through each kind of cut's live window (world units),
 * one-handed, two-handed (drawn in toward his middle, where the other hand joins it, the arms long) and with the off
 * hand: a move's range is this plus its weapon's tip, so the hitbox ends where the drawn tip does. Measured on the game
 * path, every weapon's every chain (.scratch/weapons/reach.mjs: the tip's distance out against the range, its mean over
 * the live windows; the two-handed again 2026-10-05, the arms made long, .scratch/weapons/reachmean.mjs — they were
 * 3.31-3.71). The sword keeps its own combo's 14.3.
 */
export const HAND_REACH = {
  // (sw1-sw3: the one-handed swords' chain after the owner's video, 2026-10-07 — the sword's own combo reach, 14.3 less
  // its tip, until measured on another sword)
  one: { flat: 4.26, rise: 4.21, fall: 4.52, overhead: 4.26, thrust: 6.63, bash: 5.0, sw1: 5.32, sw2: 5.32, sw3: 5.32 },
  two: { flat: 3.99, rise: 4.03, fall: 4.3, overhead: 4.79, thrust: 6.0, bash: 5.0 },
  off: { flat: 4.5, rise: 4.57, fall: 4.67, overhead: 4.57, thrust: 6.88, bash: 5.0, pairedFlat: 4.2, pairedCross: 4.41 },
};
const reachOf = (grip, pose) => HAND_REACH[grip][pose] ?? HAND_REACH.one[pose] ?? 4.3;
/** The striking end's distance from the hand in a grip: a hafted great weapon in one hand is held at its haft's foot,
 *  `foot` below the upper hand's place, as Elden Ring holds one — held where the upper hand of two goes, the haft's
 *  foot stood out below the fist into his belly (the great hammer beside a shield in 9.9% of its chain's frames). */
const tipIn = (w, grip) => w.tip + (grip !== "two" ? w.foot ?? 0 : 0);

const m = (pose, sweep, wind, active, recover, dmg, arc, cost, poise, extra = {}) => ({ pose, sweep, wind, active, recover, dmg, arc, cost, poise, shape: pose === "thrust" || pose === "bash" ? "thrust" : pose === "overhead" ? "slam" : "arc", fx: extra.heavy ? "heavy" : "swing", ...extra });

/**
 * How a weapon is carried when it is not swinging (`carry`): the sword's own carry unless it names one —
 *   shoulder  a great weapon resting over his sword-side shoulder, the blade or head behind him (Elden Ring's
 *             great weapons, both grips: "over the shoulder", docs/WEAPONS.md)
 *   chudan    a katana held low before him in both hands, its point toward the foe
 *   staff     a staff held slanting across in front of him
 *
 * Every weapon and shield. `tip` the striking end's distance from the main grip (the model's, weapons3d.js),
 * `hands` "one" or "two" (held in both when the off hand is empty), `cls` its class (paired attacks need the
 * same class in both hands), `moves` the one-handed light chain, `two` the two-handed one, `paired` the power
 * stance's, `guard` how it guards { negate (share of the hit stopped), stability (how little stamina a block
 * costs), parry (seconds after raising that a block parries), speed (walking share while guarding) }.
 */
export const WEAPONS = {
  sword: {
    name: "Sword", cls: "straight", kind: "weapon", tip: 8.98, hands: "one", keyed: true,
    // (the three cuts as key poses from animation practice, 2026-10-08 — the owner: "fix the attack animations. No need
    // to follow the video before"; .scratch/combo2/keycombo.mjs → gfx3d/anim/sword-bake.js: a flat forehand; a rising
    // backhand, its blade sweeping the other way, from his off side to his sword side (the owner approved the rule
    // change), ending over the shoulder; a diagonal chop from there, carried out past the far hip)
    // (the third's live window 0.18 s, the owner's video's chop — the owner, 2026-10-08: at 0.11 the chop came 1.6× fast and
    // the blade tip jolted at the game's pace; the sword's own, the shared combo the keyed swings were made for unchanged)
    moves: PLAYER.combo.map((c, i) => ({ ...c, ...(i === 2 ? { active: 0.18 } : {}), pose: `sw${i + 1}`, sweep: i === 1 ? -1 : 1, shape: "arc", step: i })),
    paired: [m("pairedFlat", 1, 0.12, 0.09, 0.24, 16, 2.2, 16, 14), m("pairedCross", -1, 0.13, 0.09, 0.3, 18, 2.0, 16, 16)],
    guard: { negate: 0.55, stability: 25, parry: 0, speed: 0.6 },
  },
  shortsword: {
    name: "Shortsword", cls: "straight", kind: "weapon", tip: 7.1, hands: "one",
    moves: [m("flat", 1, 0.085, 0.06, 0.15, 21, 1.7, 8, 6), m("flat", -1, 0.068, 0.06, 0.15, 21, 1.7, 8, 6), m("rise", 1, 0.077, 0.06, 0.15, 21, 1.7, 8, 6), m("flat", -1, 0.068, 0.06, 0.15, 21, 1.7, 8, 6), m("thrust", 0, 0.119, 0.07, 0.25, 36, 0.25, 11, 12, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.09, 0.07, 0.2, 26, 2.0, 12, 10), m("pairedCross", -1, 0.09, 0.07, 0.24, 28, 1.9, 12, 12)],
    guard: { negate: 0.5, stability: 20, parry: 0, speed: 0.65 },
  },
  longsword: {
    name: "Longsword", cls: "straight", kind: "weapon", tip: 11.0, hands: "two", carry: "chudan",
    moves: [m("fall", 1, 0.111, 0.08, 0.2, 10, 2.0, 13, 11), m("flat", -1, 0.111, 0.08, 0.2, 10, 2.1, 13, 11), m("rise", 1, 0.111, 0.08, 0.2, 10, 2.0, 13, 11), m("flat", -1, 0.093, 0.08, 0.2, 10, 2.1, 13, 11), m("fall", -1, 0.153, 0.09, 0.338, 16, 2.1, 17, 22, { heavy: true })],
    two: [m("fall", 1, 0.119, 0.08, 0.213, 12, 2.0, 14, 13), m("overhead", 0, 0.111, 0.08, 0.213, 12, 0.5, 14, 13), m("rise", -1, 0.119, 0.08, 0.213, 12, 2.0, 14, 13), m("overhead", 0, 0.102, 0.08, 0.213, 12, 0.5, 14, 13), m("fall", -1, 0.153, 0.09, 0.338, 19, 2.1, 18, 26, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.14, 0.09, 0.28, 12, 2.3, 18, 16), m("pairedCross", -1, 0.15, 0.09, 0.32, 13, 2.1, 18, 18)],
    guard: { negate: 0.6, stability: 30, parry: 0, speed: 0.6 },
  },
  greatsword: {
    name: "Greatsword", cls: "greatsword", kind: "weapon", tip: 14.2, hands: "two", carry: "shoulder",
    moves: [m("flat", 1, 0.128, 0.1, 0.338, 8, 2.4, 20, 22), m("flat", -1, 0.128, 0.1, 0.338, 8, 2.4, 20, 22), m("flat", 1, 0.136, 0.1, 0.338, 8, 2.4, 20, 22), m("fall", -1, 0.187, 0.11, 0.425, 11, 2.3, 26, 44, { heavy: true })],
    two: [m("fall", 1, 0.128, 0.1, 0.338, 8, 2.3, 22, 26, { armor: 1 }), m("overhead", 0, 0.153, 0.11, 0.35, 9, 0.5, 23, 26, { armor: 1 }), m("fall", -1, 0.136, 0.1, 0.338, 9, 2.3, 22, 26, { armor: 1 }), m("overhead", 0, 0.204, 0.12, 0.45, 12, 0.5, 28, 52, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedFlat", 1, 0.3, 0.13, 0.48, 10, 2.6, 32, 40, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 },
  },
  colossal: {
    name: "Colossal Sword", cls: "colossal", kind: "weapon", tip: 20.1, hands: "two", carry: "shoulder",
    moves: [m("flat", 1, 0.145, 0.12, 0.475, 5, 3.0, 28, 40, { armor: 1 }), m("flat", -1, 0.187, 0.12, 0.475, 6, 3.0, 28, 40, { armor: 1 }), m("flat", 1, 0.17, 0.13, 0.575, 7, 3.0, 32, 80, { armor: 1, heavy: true })],
    two: [m("flat", 1, 0.136, 0.12, 0.475, 5, 3.0, 30, 46, { armor: 1 }), m("flat", -1, 0.179, 0.12, 0.475, 5, 3.0, 30, 46, { armor: 1 }), m("overhead", 0, 0.187, 0.13, 0.575, 7, 0.5, 34, 92, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedFlat", 1, 0.44, 0.17, 0.64, 7, 3.2, 40, 64, { armor: 1, heavy: true })],
    guard: { negate: 0.75, stability: 45, parry: 0, speed: 0.45 },
  },
  scimitar: {
    name: "Scimitar", cls: "curved", kind: "weapon", tip: 9.2, hands: "one",
    moves: [m("flat", 1, 0.111, 0.07, 0.2, 14, 1.9, 9, 7), m("flat", -1, 0.111, 0.07, 0.2, 14, 1.9, 9, 7), m("rise", 1, 0.102, 0.07, 0.2, 14, 2.0, 9, 7), m("fall", -1, 0.102, 0.07, 0.2, 14, 2.0, 9, 7), m("flat", 1, 0.136, 0.08, 0.3, 22, 2.4, 12, 14, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.09, 0.08, 0.18, 14, 2.4, 12, 10), m("pairedCross", -1, 0.09, 0.08, 0.18, 14, 2.4, 12, 10), m("pairedFlat", 1, 0.12, 0.09, 0.28, 18, 2.6, 14, 14)],
    guard: { negate: 0.5, stability: 20, parry: 0, speed: 0.65 },
  },
  katana: {
    name: "Katana", cls: "katana", kind: "weapon", tip: 9.8, hands: "two", carry: "chudan",
    moves: [m("flat", 1, 0.111, 0.07, 0.238, 13, 2.0, 11, 9), m("flat", -1, 0.119, 0.07, 0.238, 13, 2.0, 11, 9), m("flat", 1, 0.111, 0.07, 0.238, 13, 2.0, 11, 9), m("flat", -1, 0.111, 0.07, 0.238, 13, 2.0, 11, 9), m("fall", -1, 0.145, 0.08, 0.338, 20, 2.1, 14, 18, { heavy: true })],
    two: [m("fall", 1, 0.119, 0.08, 0.238, 15, 2.0, 12, 11), m("rise", -1, 0.128, 0.08, 0.238, 15, 2.0, 12, 11), m("fall", 1, 0.111, 0.08, 0.238, 15, 2.0, 12, 11), m("rise", -1, 0.111, 0.08, 0.238, 15, 2.0, 12, 11), m("overhead", 0, 0.145, 0.09, 0.338, 23, 0.5, 15, 22, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.12, 0.08, 0.24, 14, 2.3, 15, 15), m("pairedCross", -1, 0.12, 0.08, 0.26, 14, 2.2, 15, 16)],
    guard: { negate: 0.55, stability: 25, parry: 0, speed: 0.6 },
  },
  club: {
    name: "Club", cls: "hammer", kind: "weapon", tip: 6.85, hands: "one",
    moves: [m("fall", -1, 0.111, 0.08, 0.238, 26, 1.6, 12, 15), m("flat", 1, 0.111, 0.08, 0.238, 26, 1.7, 12, 15), m("fall", -1, 0.111, 0.08, 0.238, 26, 1.6, 12, 15), m("flat", 1, 0.111, 0.08, 0.238, 26, 1.7, 12, 15), m("overhead", 0, 0.153, 0.09, 0.338, 41, 0.5, 15, 30, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.15, 0.09, 0.3, 33, 1.9, 18, 24)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 },
  },
  greatclub: {
    name: "Great Club", cls: "greathammer", kind: "weapon", tip: 14.1, foot: 2.25, hands: "two", carry: "shoulder",
    moves: [m("overhead", 0, 0.153, 0.12, 0.513, 9, 0.55, 30, 50, { armor: 1 }), m("overhead", 0, 0.221, 0.13, 0.513, 10, 0.55, 32, 50, { armor: 1 }), m("overhead", 0, 0.238, 0.14, 0.6, 12, 0.55, 34, 100, { armor: 1, heavy: true, ground: true })],
    two: [m("flat", 1, 0.153, 0.12, 0.513, 10, 2.8, 32, 56, { armor: 1 }), m("flat", -1, 0.213, 0.13, 0.513, 11, 2.8, 34, 56, { armor: 1 }), m("flat", 1, 0.23, 0.14, 0.6, 14, 2.8, 36, 112, { armor: 1, heavy: true })],
    paired: [m("pairedFlat", 1, 0.4, 0.15, 0.6, 9, 2.8, 38, 64, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 },
  },
  scepter: {
    name: "Scepter", cls: "hammer", kind: "weapon", tip: 8.7, hands: "one",
    moves: [m("fall", -1, 0.119, 0.08, 0.238, 15, 1.7, 12, 14), m("flat", 1, 0.119, 0.08, 0.238, 15, 1.8, 12, 14), m("fall", -1, 0.119, 0.08, 0.238, 15, 1.7, 12, 14), m("flat", 1, 0.119, 0.08, 0.238, 15, 1.8, 12, 14), m("thrust", 0, 0.162, 0.09, 0.338, 23, 0.3, 15, 28, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.15, 0.09, 0.3, 19, 2.0, 18, 22)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 },
  },
  axe: {
    name: "Axe", cls: "axe", kind: "weapon", tip: 6.9, hands: "one",
    moves: [m("fall", -1, 0.111, 0.08, 0.225, 25, 1.8, 12, 13), m("fall", 1, 0.111, 0.08, 0.225, 25, 1.8, 12, 13), m("fall", -1, 0.128, 0.08, 0.225, 28, 1.8, 12, 13), m("rise", 1, 0.119, 0.08, 0.225, 28, 1.8, 12, 13), m("overhead", 0, 0.153, 0.09, 0.325, 40, 0.5, 15, 26, { heavy: true })],
    paired: [m("pairedCross", -1, 0.15, 0.09, 0.3, 31, 2.0, 18, 20)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 },
  },
  greataxe: {
    name: "Greataxe", cls: "greataxe", kind: "weapon", tip: 13.4, foot: 2.65, hands: "two", carry: "shoulder",
    moves: [m("overhead", 0, 0.119, 0.11, 0.4, 7, 0.5, 24, 36), m("overhead", 0, 0.145, 0.11, 0.4, 7, 0.5, 24, 36), m("overhead", 0, 0.153, 0.11, 0.4, 7, 0.5, 24, 36), m("overhead", 0, 0.17, 0.12, 0.5, 10, 0.5, 28, 72, { heavy: true, ground: true })],
    two: [m("overhead", 0, 0.119, 0.11, 0.4, 9, 0.5, 26, 42, { armor: 1 }), m("fall", -1, 0.145, 0.11, 0.4, 9, 2.4, 26, 42, { armor: 1 }), m("overhead", 0, 0.145, 0.11, 0.4, 9, 0.5, 26, 42, { armor: 1 }), m("overhead", 0, 0.162, 0.12, 0.5, 13, 0.5, 30, 84, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedCross", -1, 0.34, 0.14, 0.56, 9, 2.6, 36, 56, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 },
  },
  hammer: {
    name: "Hammer", cls: "hammer", kind: "weapon", tip: 7.9, hands: "one",
    moves: [m("fall", -1, 0.119, 0.08, 0.238, 16, 1.7, 13, 17), m("flat", 1, 0.119, 0.08, 0.238, 16, 1.7, 13, 17), m("overhead", 0, 0.119, 0.08, 0.238, 16, 0.5, 13, 17), m("flat", -1, 0.119, 0.08, 0.238, 16, 1.7, 13, 17), m("overhead", 0, 0.162, 0.09, 0.338, 25, 0.5, 16, 34, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.16, 0.09, 0.32, 22, 1.9, 19, 26)],
    guard: { negate: 0.5, stability: 25, parry: 0, speed: 0.6 },
  },
  greathammer: {
    name: "Great Hammer", cls: "greathammer", kind: "weapon", tip: 15.3, foot: 2.65, hands: "two", carry: "shoulder",
    moves: [m("overhead", 0, 0.128, 0.11, 0.388, 6, 0.5, 26, 44), m("flat", 1, 0.136, 0.11, 0.388, 7, 2.6, 26, 44), m("flat", -1, 0.145, 0.11, 0.388, 7, 2.6, 26, 44), m("overhead", 0, 0.145, 0.12, 0.475, 9, 0.5, 30, 88, { heavy: true, ground: true })],
    two: [m("overhead", 0, 0.128, 0.11, 0.388, 7, 0.5, 28, 50, { armor: 1 }), m("flat", 1, 0.162, 0.11, 0.388, 8, 2.6, 28, 50, { armor: 1 }), m("flat", -1, 0.162, 0.11, 0.388, 8, 2.6, 28, 50, { armor: 1 }), m("overhead", 0, 0.196, 0.12, 0.475, 10, 0.5, 32, 100, { armor: 1, heavy: true, ground: true })],
    paired: [m("pairedFlat", 1, 0.42, 0.16, 0.62, 8, 2.8, 40, 70, { armor: 1, heavy: true })],
    guard: { negate: 0.7, stability: 40, parry: 0, speed: 0.5 },
  },
  staff: {
    name: "Staff", cls: "staff", kind: "weapon", tip: 13.5, hands: "two", carry: "staff",
    moves: [m("flat", 1, 0.145, 0.09, 0.238, 8, 2.0, 12, 10), m("flat", -1, 0.145, 0.09, 0.238, 8, 2.0, 12, 10), m("overhead", 0, 0.187, 0.1, 0.325, 12, 0.5, 14, 20, { heavy: true })],
    two: [m("flat", 1, 0.145, 0.09, 0.238, 8, 2.0, 12, 11), m("flat", -1, 0.145, 0.09, 0.238, 8, 2.0, 12, 11), m("overhead", 0, 0.187, 0.1, 0.325, 13, 0.5, 14, 22, { heavy: true })],
    paired: [m("pairedFlat", 1, 0.18, 0.1, 0.34, 10, 2.2, 15, 14)],
    guard: { negate: 0.5, stability: 20, parry: 0, speed: 0.6 },
  },
  buckler: {
    name: "Small Shield", cls: "smallshield", kind: "shield", tip: 2.0, hands: "one",
    moves: [m("bash", 0, 0.119, 0.07, 0.188, 7, 0.4, 9, 9), m("bash", 0, 0.093, 0.07, 0.188, 7, 0.4, 9, 9)],
    guard: { negate: 0.82, stability: 45, parry: 0.2, speed: 0.75 },
  },
  heater: {
    name: "Medium Shield", cls: "shield", kind: "shield", tip: 2.9, hands: "one",
    moves: [m("bash", 0, 0.119, 0.08, 0.2, 8, 0.4, 11, 11), m("bash", 0, 0.102, 0.08, 0.2, 8, 0.4, 11, 11)],
    guard: { negate: 1, stability: 56, parry: 0, speed: 0.6 },
  },
  greatshield: {
    name: "Greatshield", cls: "greatshield", kind: "shield", tip: 6.7, hands: "one",
    moves: [m("bash", 0, 0.17, 0.1, 0.263, 12, 0.5, 15, 20), m("bash", 0, 0.17, 0.1, 0.263, 12, 0.5, 15, 20)],
    guard: { negate: 1, stability: 75, parry: 0, speed: 0.42, counter: true },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
/** The weapons he can take up for now (the owner, 2026-10-05: "disable all the weapons (keep all shields) except the
 *  sword, shortsword, longsword, greatsword, colossal sword, Club, and great club"); every shield stays. The rest keep
 *  their data and checks, only the camp no longer offers them. */
export const ENABLED_WEAPONS = new Set(["sword", "shortsword", "longsword", "greatsword", "colossal", "club", "greatclub"]);
export const armable = (id) => !!WEAPONS[id] && (WEAPONS[id].kind === "shield" || ENABLED_WEAPONS.has(id));
/** What the hero carries unless he chose otherwise: the sword, the off hand empty (as he always was). */
export const DEFAULT_ARMS = Object.freeze({ main: "sword", off: null });

// Every move's range: the hand's reach in its kind of cut and grip plus the weapon's tip (the sword's own combo keeps 14.3).
for (const w of Object.values(WEAPONS)) {
  for (const [grip, list] of [["one", w.moves], ["two", w.two], ["off", w.paired]]) for (const mv of list || []) if (mv.range == null) mv.range = +(reachOf(grip, mv.pose) + tipIn(w, grip)).toFixed(2);
}

/** The arms a loadout gives, settled: the off hand empty for a two-hander gives the two-handed grip. */
export function settleArms({ main = "sword", off = null } = {}) {
  // (a shield is never the main hand's; one no longer offered, from an older save, falls back: ENABLED_WEAPONS)
  const M = WEAPONS[main]?.kind === "weapon" && (globalThis.__allWeapons || armable(main)) ? WEAPONS[main] : WEAPONS.sword;
  const O = off && (globalThis.__allWeapons || armable(off)) ? WEAPONS[off] || null : null;
  const twoHanded = !O && M.hands === "two" && !!M.two;
  const paired = !!O && O.kind === "weapon" && O.cls === M.cls && !!M.paired;
  // the off-hand button: a shield's guard, a paired attack, the off weapon's own chain, or (empty) the main weapon's guard
  // (with no shield the off button jumps — the owner, 2026-10-09, in place of guarding with the weapon itself)
  const offAct = O ? (O.kind === "shield" ? "guard" : paired ? "paired" : "attack") : "jump";
  const arms = { main: M === WEAPONS[main] ? main : "sword", off: O ? off : null, twoHanded, paired, offAct, guard: O?.kind === "shield" ? O.guard : M.guard };
  // (each chain made once, so a chain's next press knows it is the same chain): `mainList` the main hand's (one- or
  // two-handed); `offList` the off-hand button's — paired (both), or the off weapon's own (mirrored: it sweeps the other
  // way), null for a guard
  arms.mainList = twoHanded ? M.two : M.moves;
  // (paired with another weapon of the class, the off blade reaches as far as its own tip: `altRange`, swingArc's alt)
  const pairedList = O && O !== M ? M.paired.map((mv) => ({ ...mv, altRange: +(reachOf("off", mv.pose) + tipIn(O, "off")).toFixed(2) })) : M.paired;
  arms.offList = offAct === "paired" ? pairedList : offAct === "attack" ? O.moves.map((mv) => ({ ...mv, sweep: -mv.sweep || 0, dmg: Math.round(mv.dmg * 0.9), range: +(reachOf("off", mv.pose) + tipIn(O, "off")).toFixed(2), off: true })) : null;
  return arms;
}
