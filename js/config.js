// Every number the fight is tuned with, in one place. World units are pixels of the pixel-art
// canvas; the hero is about 20 of them tall and the arena is 300 across.
//
// Timings are in seconds and are all multiples of the 1/60 s tick, so the same input at the same
// time always gives the same fight — which is what lets a run be replayed and checked later.

export const CONFIG = {
  NAME: "Three Bells",
  // Week 1 starts here, and every week turns over on this weekday. Set it to the Monday the game
  // actually goes live before launch — moving it afterwards would renumber everybody's history.
  LAUNCH_DATE: "2026-09-21",
  // Shown on the title and on every boss's name card. The same three bosses come back each week
  // until there are more to rotate, and this says so. It is only a label: nothing resets with it.
  SEASON: "Preview season",
  RULES_VERSION: 1,
  SAVE_KEY: "threebells.v1",
};

export const TICK = 1 / 60;
export const MAX_FRAME = 0.25; // never simulate more than this in one animation frame

export const ARENA = {
  // The floor's radius, in world units. Seen isometrically a circle of R covers R·2√2 across and
  // R·√2 down, so 118 is what fits a phone held upright at a whole-number pixel size. Change it
  // and the fights need re-tuning — tools/test.mjs will say so.
  R: 118,
  WALL_BOUNCE: 0.35,
};

export const PLAYER = {
  radius: 6,
  hp: 120, // six hearts; a telegraphed hit takes about a fifth of it
  speed: 94, // units a second at a full stick
  accel: 1400, // reaches top speed in about 0.07 s — snappy, not slippery
  friction: 1500,
  // The stick keeps steering him through a swing (the owner: he "should not become limited and stand
  // still while he is attacking"), a little slower while the blade is out; never a lunge of its own.
  swingMove: 0.8,
  // The roll is the whole game: a fixed distance, a window you cannot be hit in, and a tail you
  // are committed to. Dark Souls' shape, tuned for a top-down arena.
  roll: {
    dist: 66,
    time: 0.42,
    iFrom: 0.06, // invulnerable from here…
    iTo: 0.3, //  …to here (0.24 s of it)
    recover: 0.1, // you cannot act during this tail, but input is buffered
    cost: 28,
    curve: (t) => 1 - Math.pow(1 - t, 2.6), // fast out of the gate, coasting at the end
  },
  // A three-hit chain. Each swing commits you; the third is slow and hits hard.
  combo: [
    { wind: 0.11, active: 0.08, recover: 0.2, dmg: 11, arc: 1.9, range: 27, cost: 12, poise: 10, fx: "swing" },
    { wind: 0.1, active: 0.08, recover: 0.22, dmg: 12, arc: 2.0, range: 27, cost: 12, poise: 10, fx: "swing" },
    { wind: 0.17, active: 0.11, recover: 0.34, dmg: 21, arc: 2.5, range: 31, cost: 20, poise: 22, fx: "heavy" },
  ],
  comboWindow: 0.42, // how long after a swing the next one still chains
  stamina: 100,
  staminaRegen: 46, // a second
  staminaDelay: 0.45, // after spending, before it starts coming back
  exhaustedDelay: 0.9, // longer if you emptied the bar
  hurtTime: 0.26,
  hurtIFrames: 0.6,
  knockback: 120,
  bufferTime: 0.18, // how early a press still counts
};

export const FIGHT = {
  enrage: 180, // after three minutes the boss stops playing fair
  enrageRamp: 12, // and over these seconds its damage climbs to lethal
  intro: 2.2, // the boss's name card
  // The bell entrance (a boss with `entrance: "bell"`, in a real fight; the owner, 2026-10-02): the
  // bell at the back of the garden, which the hero strikes to call the boss; then the boss leaps in
  // from beyond the wall, lands with a shake that staggers the hero a few steps back, and the name
  // card follows. Seconds after the strike: the leap starts at `ring`, takes `leap`, and the card
  // comes up `settle` after the landing.
  entrance: { bell: [-58, -58], bellR: 8, postR: 7, hookX: 0.4615, postH: 40, ring: 0.75, leap: 1.0, apex: 150, settle: 1.0, landAhead: 46, stagger: 110, staggerTime: 0.8 },
  victory: 2.6,
  hitstopHit: 0.055, // the freeze when you land a blow
  hitstopHeavy: 0.1,
  hitstopTaken: 0.11,
  deathSlow: 1.6, // seconds of slow motion when you die
};

/** Hearts on the bar. Health is one number; the hearts are how it is shown. */
export const HEART_VALUE = 20;

export const COLOURS = {
  telegraph: "#ff4d4d",
  telegraphSoft: "rgba(255,77,77,0.22)",
  telegraphEdge: "rgba(255,120,110,0.85)",
  safe: "#8fffd0",
  warn: "#ffd24d",
};
