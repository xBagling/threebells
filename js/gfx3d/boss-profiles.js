// Each boss's 3D model and how the game drives it (boss3d.js): the file, its drawn height (game
// units), the drawn footprint for its shadow, how far one walk cycle carries it, the picker's keys to
// the model's clips, which clips are wind-ups (played over the first part of the sim's window, then
// held), which clip follows another (a spell's release), its legs for planted feet and turn-in-place
// steps (anim/feet.js: every legged creature), and its living layers (anim/toad-life.js).
//
// Gnasher is the toad of the game; the King and Cinder were rigged on 2026-10-03 (docs/KING-MOVEMENT.md,
// docs/CINDER-MOVEMENT.md) and are drawn on the bench (`dev-fight.html?boss=king`) until they are offered.

/** Gnasher's clips, picker key → model clip. */
const TOAD_CLIPS = { idle: "idle", walk: "walk", gape: "gape", lash_lunge: "lash_lunge", lash_strike: "lash_strike", lash_recover: "lash_recover", crouch: "crouch", leap: "leap", land: "land", croak: "croak", hurt: "hurt", dead: "dead", pounce: "pounce" };
const same = (names) => Object.fromEntries(names.map((n) => [n, n]));

export const BOSS_MODELS = {
  gnasher: {
    url: "art3d/gnasher.gltf",
    height: 27.8,
    radius: 16,
    stride: 7.9,
    clips: TOAD_CLIPS,
    toad: true, // (the tongue, the cut mouth's lip, the sac, the toad's light and smoothing)
    // hind legs thigh-shin-foot, front legs upperarm-forearm-hand (SkinTokens' names, 53_anim_toad.py)
    legs: [["thigh", "shin", "foot"], ["upperarm", "forearm", "hand"]],
    feet: { stanceH: 1.6, stepAt: 2.0, stepTime: 0.14, stepLift: 1.6, maxStepping: 2 },
    watching: ["idle", "walk", "gape", "lash_lunge", "croak", "crouch"],
    life: {},
  },
  king: {
    url: "art3d/king.gltf",
    height: 42,
    radius: 22,
    stride: 0.3 * 42, // (56_stump_king.py: STRIDE 0.30 of his height a cycle)
    clips: same(["idle", "walk", "raise", "slam", "cleave", "call", "flood", "chain_throw", "hurt", "dead"]),
    windups: ["raise", "call"],
    // his legs' real joints (56_stump_king.py): the hip stub to the knee, the "thigh" to the ankle, the
    // "shin" the block of his foot
    legs: [["hip", "thigh", "shin"]],
    feet: { stanceH: 1.2, stepAt: 3.0, stepTime: 0.22, stepLift: 2.6, maxStepping: 1 },
    watching: ["idle", "walk", "raise", "call"],
    life: { body: "hips", spine1: "spine_01", spine2: "spine_02" },
    light: { fill: 0xfff0d8, fillAmt: 0.85, rim: 0xffe39a, rimAmt: 0.22, max: 1.0, tint: 0.2, sat: 0.95 },
  },
  cinder: {
    url: "art3d/cinder.gltf",
    height: 34,
    radius: 16,
    stride: 0.16 * 34, // (58_anim_cinder.py: small shuffling steps, 0.16 of her height a cycle)
    clips: same(["idle", "walk", "cast", "release", "veil", "veiled", "hurt", "dead"]),
    windups: ["cast", "veil"],
    after: { cast: "release" }, // (the spell leaves her as the sim's cast ends)
    legs: [["thigh", "shin", "foot"]],
    feet: { stanceH: 1.0, stepAt: 2.0, stepTime: 0.16, stepLift: 1.4, maxStepping: 1 },
    watching: ["idle", "walk", "cast"],
    life: { body: "hips", spine1: "spine_01", spine2: "chest" },
    light: { fill: 0xffe8d0, fillAmt: 0.9, rim: 0xffb070, rimAmt: 0.3, max: 1.05, tint: 0.15, sat: 0.95 },
  },
};
