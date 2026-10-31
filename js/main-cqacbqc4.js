// site/js/gfx3d/boss-profiles.js
var TOAD_CLIPS = { idle: "idle", walk: "walk", gape: "gape", lash_lunge: "lash_lunge", lash_strike: "lash_strike", lash_recover: "lash_recover", crouch: "crouch", leap: "leap", land: "land", croak: "croak", hurt: "hurt", dead: "dead", pounce: "pounce", flinch_l: "flinch_l", flinch_r: "flinch_r", flinch_heavy: "flinch_heavy" };
var same = (names) => Object.fromEntries(names.map((n) => [n, n]));
var BOSS_MODELS2 = {
  gnasher: {
    url: "art3d/gnasher.gltf",
    chest: "art3d/chests/bog/chest.gltf",
    fx: ["gnasher"],
    height: 30.6,
    radius: 17.6,
    stride: 8.7,
    clips: TOAD_CLIPS,
    toad: true,
    legs: [["thigh", "shin", "foot"], ["upperarm", "forearm", "hand"]],
    feet: { stanceH: 1.6, stepAt: 2, stepTime: 0.14, stepLift: 1.6, maxStepping: 2 },
    watching: ["idle", "walk", "gape", "lash_lunge", "croak", "crouch"],
    life: {},
    seeThrough: [{ r: 1, h: 0.55, y: 0.45 }]
  },
  crab: {
    seeThrough: [{ r: 0.6, h: 0.3, y: 0.3 }, { r: 0.4, h: 0.35, y: 0.65, off: -0.15 }],
    seeThroughLimbs: [
      { from: "claw_L", to: ["claw_L", 0.00195, 0.40254, -0.02512], r: 13, n: 5 },
      { from: "claw_L", to: "finger_L", r: 11, n: 3 },
      { from: "finger_L", to: ["claw_L", 0.00195, 0.40254, -0.02512], r: 11, n: 4 }
    ],
    slump: 0.12,
    immuneGlow: true,
    flashR: 45,
    killFlash: 0.25,
    fx: ["crab"],
    url: "art3d/crab/crab.gltf",
    chest: "art3d/chests/crystal/chest.gltf",
    height: 102.53,
    radius: 71.3,
    stride: 30.9,
    clips: same(["idle", "walk", "raise", "slam", "slam_rec", "grab", "grab_rel", "grab_toss", "chain_throw", "call", "cleave", "cleave_a", "cleave_b"]),
    placeholders: { leap: [[0, "raise", 0.99]] },
    windups: [],
    after: { slam: "slam_rec", grab: (w) => w?.grab ? "grab_toss" : "grab_rel" },
    poses: { recover: "idle", phase: "call", roar: "call", hurt: "slam_rec" },
    finish: ["cleave", "cleave_b", "call"],
    timing: {
      combo: { raise: [[0, 0.15], [0.61, 1.15], [0.86, 1.4]] },
      geyser: { raise: [[0, 0.75], [0.2, 1.15], [0.45, 1.4]] },
      geyserRoll: { raise: [[0, 0.75], [0.2, 1.15], [0.45, 1.4]] },
      entrance: { raise: [[0, 0], [0.84, 0.2], [0.95, 1.15], [1, 1.4]] },
      burrow: { raise: [[0, 0], [2.016, 0.2], [2.28, 1.15], [2.4, 1.4]] }
    },
    climb: {
      stand: [[20, -44.3], [-9.9, -61.5], [-37.4, -61], [-56.1, -46.5], [16.5, 46.6], [-13.6, 63.3], [-39.3, 60.6], [-57.2, 46.6]],
      claws: [["claw_merus_L", "claw_carpus_L", "claw_L", [0.00195, 0.40254, -0.02512]], ["claw_merus_R", "claw_carpus_R", "finger_R", [0.00386, 0.13902, -0.00065]]],
      rock: 0.035,
      hz: 2.2
    },
    sink: 4,
    floorGuard: ["L", "R"].map((s) => ({ bones: [`claw_carpus_${s}`, `claw_${s}`, `finger_${s}`], pivot: `claw_merus_${s}` })),
    guardBlows: ["slam", "grab", "cleave", "spin", "chain"],
    guardRate: 8,
    legs: [1, 2, 3, 4].map((i) => [`basis_{s}${i}`, `carpus_{s}${i}`, `dactyl_{s}${i}`]),
    feet: { stanceH: 2.3, stepAt: 8.6, stepTime: 0.15, stepLift: 5.75, maxStepping: 4, reachStep: 0.3, pin: true },
    toeTips: [["dactyl_L1", 0.0821], ["dactyl_L2", 0.0756], ["dactyl_L3", 0.0708], ["dactyl_L4", 0.0725], ["dactyl_R1", 0.075], ["dactyl_R2", 0.0749], ["dactyl_R3", 0.069], ["dactyl_R4", 0.0703]],
    watching: ["idle", "walk"],
    flip: false,
    shadow: { length: 0.12, opacity: 0.85, softness: 6, reach: 220, tint: [0.16, 0.13, 0.13], pool: { r: 100, core: 0.35, k: 1 } },
    life: { lookDeg: 22 },
    holdShake: { bones: ["claw_merus_L", "claw_carpus_L"], lift: 0.1, amp: 0.09, from: 0.15 },
    inertia: { lean: 0.00005, max: 0.045, freq: 1.8, zeta: 0.45 },
    light: { fill: 16769744, fillAmt: 0.8, rim: 16757898, rimAmt: 0.42, max: 1, tint: 0.25, sat: 1, smooth: true, backRim: 16752752, backRimAmt: 0.5, hilite: 1.05 }
  },
  cinder: {
    seeThrough: [{ r: 0.5, h: 0.5, y: 0.55 }],
    fx: [],
    url: "art3d/cinder.gltf",
    chest: "art3d/chests/inferno/chest.gltf",
    height: 34,
    radius: 16,
    stride: 0.16 * 34,
    clips: { ...same(["idle", "walk", "cast", "release", "veil", "veiled", "hurt", "dead", "nova"]), seated: "veiled" },
    placeholders: { opening: [[0, "cast", 2.3], [3.6, "release", 0.6], [4.2, "idle", 1]] },
    stand: { float: 5, turns: 3 },
    loops: ["seated"],
    windups: ["cast", "veil"],
    after: { cast: "release" },
    poses: { recover: "idle", phase: "cast", roar: "release" },
    faceTag: "storm",
    ripeRim: true,
    heroGuard: ["L", "R"].map((s) => ({ bones: [`forearm_${s}`, `hand_${s}`, ...["index", "middle", "ring", "pinky", "thumb"].flatMap((f) => [1, 2, 3].map((k) => `${f}_0${k}_${s}`))], pivot: `upperarm_${s}` })),
    legs: [["thigh", "shin", "foot"]],
    feet: { stanceH: 0.4, stepAt: 2, stepTime: 0.16, stepLift: 1.4, maxStepping: 1 },
    watching: ["idle", "walk", "cast"],
    life: { body: "hips", spine1: "spine_01", spine2: "chest" },
    light: { fill: 16771280, fillAmt: 0.9, rim: 16756848, rimAmt: 0.3, max: 1.05, tint: 0.15, sat: 0.95 },
    cloth: {
      sets: [
        {
          chains: ["L", "R"].map((sd) => [`cloth_sleeve_${sd}_01`, `cloth_sleeve_${sd}_02`]),
          hang: 0.6,
          maxDeg: 25,
          tune: { stiff: 0.022, damp: 0.06, gravity: 80 },
          colliders: [["upperarm_*", "forearm_*", 0.05], ["forearm_*", "hand_*", 0.04], ["hips", "neck", 0.11]]
        },
        {
          chains: ["fl", "l", "bl", "br", "r", "fr"].map((t) => [`cloth_skirt_${t}_01`, `cloth_skirt_${t}_02`]),
          pairs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
          tune: { stiff: 0.03, damp: 0.05, maxDeg: 30, carryFlat: 0.7 },
          colliders: [["thigh_*", "shin_*", 0.05], ["shin_*", "foot_*", 0.04]]
        }
      ],
      kicks: { release: { speed: 45, up: 12 }, hurt: { speed: 25, up: 6 } }
    },
    pits: { from: 80, to: 150 }
  }
};

export { BOSS_MODELS2 };
