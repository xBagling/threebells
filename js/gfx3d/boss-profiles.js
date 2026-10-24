// Each boss's 3D model and how the game drives it (boss3d.js): the file, its drawn height (game
// units), the drawn footprint for its shadow, how far one walk cycle carries it, the picker's keys to
// the model's clips, which clips are wind-ups (played over the first part of the sim's window, then
// held), which clip follows another (a spell's release), its legs for planted feet and turn-in-place
// steps (anim/feet.js: every legged creature), and its living layers (anim/toad-life.js).
//
// Gnasher is the toad of the game; the King and Cinder were rigged on 2026-10-03 (docs/KING-MOVEMENT.md,
// docs/CINDER-MOVEMENT.md) and are drawn on the bench (`dev-fight.html?boss=king`) until they are offered.

/** Gnasher's clips, picker key → model clip. */
const TOAD_CLIPS = { idle: "idle", walk: "walk", gape: "gape", lash_lunge: "lash_lunge", lash_strike: "lash_strike", lash_recover: "lash_recover", crouch: "crouch", leap: "leap", land: "land", croak: "croak", hurt: "hurt", dead: "dead", pounce: "pounce", flinch_l: "flinch_l", flinch_r: "flinch_r", flinch_heavy: "flinch_heavy" };
const same = (names) => Object.fromEntries(names.map((n) => [n, n]));

export const BOSS_MODELS = {
  gnasher: {
    url: "art3d/gnasher.gltf",
    // (10% bigger than the 27.8 he was built at, his stride with him — the owner, 2026-10-15: "Increase the size of gnasher by
    // 10%"; only the drawing: the fight's body and reach are the sim's)
    height: 30.6,
    radius: 17.6,
    stride: 8.7,
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
    spinTag: "spin", // (his chain spin turns him once round on the spot: boss3d.js, content/bosses.js "spin")
    flip: false, // (no somersault through his bell entrance's leap, as Gnasher's: boss3d.js — a king comes up upright)
    // His right fist's hole, for the chain drawn at run time (kingchain3d.js): in hand_R's own frame, in game units — the
    // world point is hand_R's world position + its world turn applied to `at` (not localToWorld: the bone's units are the
    // model's, 1/134.7 of these). `at` the hole's middle, `axis` the way through it toward his little finger, where the
    // chain comes out. (56_stump_king.py + king_fists.py, 2026-10-21, the owner: "make the king hold onto his weapons more
    // naturally in the hands": his fingers curled round the chain on the mesh; the fist reaches 3.9 along the axis either
    // way from `at` — the chain goes in at at - 3.9 axis by his thumb and out at at + 3.9 axis — and its hole is r 0.78,
    // the chain's links 2.6 x 2.3 across, pressed up to 0.6 into his fingers' insides, hidden in the fist. The baked chain's
    // first 4 links lie along it, chain_00's head 0.9 outside the thumb's end.)
    chainGrip: { at: [1.14, 3.28, -0.18], axis: [0.583, 0, 0.813] },
    life: { body: "hips", spine1: "spine_01", spine2: "spine_02" },
    light: { fill: 0xfff0d8, fillAmt: 0.85, rim: 0xffe39a, rimAmt: 0.22, max: 1.0, tint: 0.2, sat: 0.95 },
  },
  cinder: {
    url: "art3d/cinder.gltf",
    height: 34,
    radius: 16,
    stride: 0.16 * 34, // (58_anim_cinder.py: small shuffling steps, 0.16 of her height a cycle)
    // ("nova": made from the owner's Gemini video of her, tools/3d/monster-anim/ -> install_nova.py, retimed to the move)
    // ("seated": her opening's wait in her bubble at the altar — the owner, 2026-10-20: she should kneel, but her rig breaks
    // posed sitting and he will film it; till then her "veiled" bundle, as he asked)
    clips: { ...same(["idle", "walk", "cast", "release", "veil", "veiled", "hurt", "dead", "nova"]), seated: "veiled" },
    // Her opening from the bell's strike (content/bosses.js "opening"): one clip, "opening", from the owner's video when it is
    // made (prompt_entrance.txt: rise to float, three turns faster and faster, fists to the chest, a thrust forward and down that
    // releases the wall, sink to her feet) — install it into cinder.gltf as "opening", add it to `clips` above, and delete
    // `placeholders` and `stand` below. Till then (anim/boss-anim3d.js placeholders) her own clips by the opening's clock
    // (seconds from the pop, 0.4 s after the strike: [from, clip, spread over s]): the cast's gather through the rise and the
    // spin to the thrust, the release with the wall, then idle; and `stand`, view only (boss3d.js): risen `float` units off
    // the altar from the pop to the spin, `turns` turns faster and faster through the spin, sunk back from the thrust to the
    // settle (content/bosses.js opening's beats) — which the video will carry itself.
    // (the cast gathered by the spin's end, 2.3 s after the pop, held through her name card and the wall's mark; the release at
    // the thrust, 5.8 s after it: content/bosses.js opening, 2026-10-21)
    placeholders: { opening: [[0, "cast", 2.3], [5.8, "release", 0.6], [6.4, "idle", 1]] },
    stand: { float: 5, turns: 3 },
    loops: ["seated"], // (her wait in the bubble sways on: the veiled bundle looped)
    windups: ["cast", "veil"],
    after: { cast: "release" }, // (the spell leaves her as the sim's cast ends)
    legs: [["thigh", "shin", "foot"]],
    // (stanceH 0.4, not 1.0: her walk lifts a foot only 1.2 (58_anim_cinder.py LIFT 0.035 of her height), so at 1.0 most of
    // each swing counted as planted and held the foot where it was — walking at 15-26 u/s her feet trailed 10.6 units behind
    // her hips, the robe dragged back over them (the clip alone: 6.0; at 0.4: 6.6; at 6 u/s the same as before),
    // .scratch/cinder-cloth/probe/feet.mjs, 2026-10-20)
    feet: { stanceH: 0.4, stepAt: 2.0, stepTime: 0.16, stepLift: 1.4, maxStepping: 1 },
    watching: ["idle", "walk", "cast"],
    life: { body: "hips", spine1: "spine_01", spine2: "chest" },
    light: { fill: 0xffe8d0, fillAmt: 0.9, rim: 0xffb070, rimAmt: 0.3, max: 1.05, tint: 0.15, sat: 0.95 },
    // Her wide sleeves and robe as cloth (2026-10-20, the owner's pick: tools/3d/blender/cinder_cloth.py makes the bones;
    // anim/cloth.js swings them). Radii are shares of her height (34: 0.04 = 1.4 units), measured on the mesh: her shins
    // 0.04, thighs 0.05, bare forearms 0.04, sleeved upper arms 0.05, the trunk 0.11 round the hips-neck line.
    cloth: {
      sets: [
        {
          // the hanging rags under each forearm, lighter and looser than the robe, out of her arms and trunk; they rest
          // 60% of the way to straight down (`hang`), so on a raised arm they fall back toward her shoulder, at most 25° off
          // the sleeve. (Measured at the nova's arms-up frame, tools/3d/rig/hang_cinder.py: the
          // back faces seen from the front, side and game camera, 652 px with no hang, 684 at this; at a 75° cone the rags
          // stood out from the sleeve as flat planks, 1276 px — and 1547 before each rag was put wholly on its chain and
          // the chain turned about the sleeve's rim, cinder_cloth.py)
          chains: ["L", "R"].map((sd) => [`cloth_sleeve_${sd}_01`, `cloth_sleeve_${sd}_02`]),
          hang: 0.6,
          maxDeg: 25,
          tune: { stiff: 0.022, damp: 0.06, gravity: 80 },
          colliders: [["upperarm_*", "forearm_*", 0.05], ["forearm_*", "hand_*", 0.04], ["hips", "neck", 0.11]],
        },
        {
          // the robe's lower half, six chains round her from hips height to the burning hem, neighbours held together;
          // a heavier cloth than the hero's cape (a smaller cone, more of the body's own move carried)
          chains: ["fl", "l", "bl", "br", "r", "fr"].map((t) => [`cloth_skirt_${t}_01`, `cloth_skirt_${t}_02`]),
          pairs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
          tune: { stiff: 0.03, damp: 0.05, maxDeg: 30, carryFlat: 0.7 },
          colliders: [["thigh_*", "shin_*", 0.05], ["shin_*", "foot_*", 0.04]],
        },
      ],
      // (a spell's release and a blow fling the robe and sleeves out: units/s across the ground, and up)
      kicks: { release: { speed: 45, up: 12 }, hurt: { speed: 25, up: 6 } },
    },
    // the armpits' corrective shapes, full at a 150° raise (boss3d.js makePits; tools/3d/rig/rom_cinder.py measures them)
    pits: { from: 80, to: 150 },
  },
};
