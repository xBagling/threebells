// The three bosses. Each is a list of moves; a move is a length, an animation clip, and a handful
// of timed beats that spawn telegraphs. The picker chooses the next move from the ones the current
// phase allows, weighted, never the same one twice running.
//
// The rule every move follows: what is drawn on the floor is exactly what will hurt you, and it is
// drawn for long enough to walk out of. Difficulty comes from how the moves overlap, not from
// hiding them.
import { KIND } from "../sim/hazards.js?v=48fd128-df87a96f";
import { TAU } from "../util.js?v=48fd128-df87a96f";

/** How long Gnasher's landing shockwave takes to spread to the edge of its circle (sim/hazards.js sweep). */
export const SLAM_SWEEP = 0.3; // (0.42 -> 0.3: the owner, 2026-10-15, "reach the edges in 0.3 seconds")
/** His landings' shockwave radius: the hop's and the frenzy's short hops' (48 and 44 until the owner, 2026-10-15: "make the
 *  shockwaves radius 15% larger"). The view's ripple uses the same (render3d.js bossLand). */
export const SLAM_R = 55;
export const SLAM_R_SMALL = 51;
const beats = (...list) => list.sort((a, b) => a.at - b.at);

// =============================================================================================
// I · Gnasher, the Meadow Toad
// =============================================================================================
const gnasher = {
  id: "gnasher",
  music: false, // (the bog's own sounds only: no fight music, no drone — the owner, 2026-10-15)
  tier: 1,
  name: "Gnasher",
  title: "the Meadow Toad",
  // Name-card lines tell who the boss is, never how to beat him (the owner, 7.5); the training yard teaches.
  blurb: "The meadow's oldest resident. He has kept this garden since the first bell, and he does not share.",
  arena: "bog",
  art: "gnasher",
  hp: 350, // (halved: the owner, 2026-10-09, "lower the toads healing to half, and also his life to half")
  radius: 26,
  // What you cannot walk through (World.bodyBlock), the drawn toad's own footprint: the hero can come
  // up close enough almost to touch him (the owner, 2026-10-02). His own reach still uses `radius`; the hero's blade, `hurt`.
  body: 15,
  // What the hero's blade must touch (sim/player.js bladeHits): the drawn toad's half-depth along his facing and
  // half-width across, measured on the fight's model (16.6 front, 16.4 back, 14.8 to the sides; the owner,
  // 2026-10-04: the sword hit "long outside" him against the 26).
  hurt: [16.5, 15],
  hitH: 34, // how far up the sprite the hittable body reaches
  // A real fight with him starts at the bell: the hero strikes it, and he leaps in (World, FIGHT.entrance).
  entrance: "bell",
  contact: 14,
  poise: 130, // damage that staggers him out of a cast
  moveSpeed: 26,
  gap: [0.85, 1.35], // the pause between moves, at the first phase
  phases: [
    { at: 1.0, moves: ["lash", "hop", "croak"], gapScale: 1 },
    { at: 0.6, moves: ["lash", "hop", "croak", "spit", "doubleLash", "hold"], gapScale: 0.85, line: "He puffs up, and the meadow goes quiet." },
    { at: 0.3, moves: ["lash", "hop", "spit", "flies", "frenzy", "doubleLash", "hold"], gapScale: 0.7, line: "Gnasher stops waiting." },
  ],
  moves: {
    // A long tongue down a line he locks in at the start of the wind-up.
    lash: {
      weight: 3,
      dur: 1.5,
      clip: "gape",
      // He follows you for the first third of the wind-up and then commits. Move early and he
      // moves with you — the tongue's line on the floor swings with his head — and move on the
      // commit and the tongue goes where you were. Locked for half a second before it lands.
      track: 0.3,
      motion: [{ at: 0.72, dur: 0.18, dist: 14 }],
      beats: beats(
        {
          at: 0,
          do(w, b) {
            const a = w.aimAtPlayer();
            b.face = a;
            w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 210, w: 26, tele: 0.8, active: 0.16, fade: 0.3, dmg: 17, tag: "lash", follow: true });
          },
        },
        { at: 0.72, do: (w, b) => (w.clip(b, "lash"), w.shake(3), w.sound("lash")) }
      ),
      recover: 0.95, // the window you swing in
    },
    // He crouches, jumps, and comes down where you were standing a moment ago.
    hop: {
      weight: 2.5,
      dur: 1.85,
      clip: "crouch",
      track: 0.44,
      beats: beats(
        {
          at: 0.45,
          do(w, b) {
            const p = w.player;
            b.jumpTo = [p.x, p.y];
            w.clip(b, "leap");
            // (live from his landing, 0.85 s on, its shockwave spreading out over SLAM_SWEEP s: it hurts as the ripple reaches you —
            // was live 0.15 s after he landed, everywhere in it at once; the owner, 2026-10-15)
            w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: SLAM_R, tele: 0.85, active: SLAM_SWEEP + 0.03, sweep: SLAM_SWEEP, fade: 0.35, dmg: 22, tag: "slam" });
            w.sound("hop");
          },
        },
        {
          at: 1.3,
          do(w, b) {
            if (b.jumpTo) (b.x = b.jumpTo[0]), (b.y = b.jumpTo[1]), (b.jumpTo = null);
            w.clip(b, "idle");
            w.shake(8);
            w.sound("slam");
            w.landed(b); // (the earth thrown up round him, render3d.js)
          },
        }
      ),
      recover: 0.8,
      airborne: [0.45, 1.3], // he cannot be hit while up there
    },
    // The one cast in the fight. Let it finish and he takes a bite out of your progress.
    croak: {
      weight: 1.6,
      dur: 2.6,
      clip: "croak",
      cast: { name: "Croak", from: 0.15, to: 2.2, heal: 0.05 },
      beats: beats({ at: 0.15, do: (w) => w.sound("cast") }, {
        at: 2.2,
        do(w, b) {
          w.heal(b, b.hpMax * 0.05); // (halved, 2026-10-09)
          w.say("Gnasher swallows his wounds.");
        },
      }),
      recover: 0.7,
      minHp: 0.25, // he stops trying to heal once he is nearly done
    },
    // Three globs in a fan; they travel slowly enough to walk between.
    spit: {
      weight: 2,
      dur: 1.5,
      clip: "gape",
      track: 0.5,
      beats: beats({
        at: 0.55,
        do(w, b) {
          const a = w.aimAtPlayer();
          for (const off of [-0.44, 0, 0.44]) w.shot({ x: b.x, y: b.y - 10, a: a + off, speed: 96, r: 7, dmg: 14, art: "bog", life: 4, tag: "glob" });
          w.clip(b, "lash");
          w.sound("spit");
        },
      }),
      recover: 0.7,
    },
    // Three lashes, each arriving just as a panicked dodge from the one before would be ending. The first attack
    // string in the game, and what teaches you not to spend the roll early.
    doubleLash: {
      weight: 2.2,
      dur: 3.5,
      clip: "gape",
      // Three lashes now (the owner, 2026-10-15: "When he stick out his tongue twice to attack, he should do it 3 times in a
      // row instead of 2"; the id stays doubleLash, saves and tests name it). No tracking: the first line is laid where he
      // looks as it starts, and the second and third re-aim. A tracked first lash would leave too little time between lock
      // and hit.
      motion: [
        { at: 0.62, dur: 0.16, dist: 12 },
        { at: 1.62, dur: 0.16, dist: 16 },
        { at: 2.62, dur: 0.16, dist: 16 },
      ],
      beats: beats(
        {
          at: 0,
          do(w, b) {
            b.face = w.aimAtPlayer();
            w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a: b.face, len: 190, w: 24, tele: 0.62, active: 0.14, fade: 0.25, dmg: 15, tag: "lash" });
          },
        },
        { at: 0.62, do: (w, b) => (w.clip(b, "lash"), w.shake(3), w.sound("lash")) },
        {
          at: 1.0,
          do(w, b) {
            // The second re-aims: rolling the first and then strolling is not enough.
            const a = w.aimAtPlayer();
            b.face = a;
            w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 200, w: 28, tele: 0.62, active: 0.16, fade: 0.3, dmg: 18, tag: "lash" });
            w.clip(b, "gape");
          },
        },
        { at: 1.62, do: (w, b) => (w.clip(b, "lash"), w.shake(5), w.sound("lash")) },
        {
          at: 2.0,
          do(w, b) {
            // The third re-aims again: the same lane and timing as the second
            const a = w.aimAtPlayer();
            b.face = a;
            w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 200, w: 28, tele: 0.62, active: 0.16, fade: 0.3, dmg: 18, tag: "lash" });
            w.clip(b, "gape");
          },
        },
        { at: 2.62, do: (w, b) => (w.clip(b, "lash"), w.shake(6), w.sound("lash")) }
      ),
      recover: 1.15,
    },
    // The held attack. He rears — and then does not come. Rolling on the wind-up is the mistake
    // every Souls player makes once, and this is where the game teaches it.
    hold: {
      weight: 1.8,
      dur: 2.9,
      clip: "croak",
      track: 1.25,
      motion: [{ at: 1.72, dur: 0.22, dist: 26, pow: 3 }],
      beats: beats(
        { at: 0.2, do: (w, b) => (w.clip(b, "crouch"), w.sound("cast")) },
        {
          at: 1.25,
          do(w, b) {
            // Drawn on the floor a beat before it lands, and held. The floor is telling the truth
            // the whole time; the temptation is to believe the animation instead.
            w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.62, r: 92, tele: 0.72, active: 0.18, fade: 0.35, dmg: 24, tag: "hold" });
          },
        },
        { at: 1.72, do: (w, b) => (w.clip(b, "lash"), w.shake(9), w.sound("slam")) },
        { at: 2.2, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 1.0,
    },
    // Below a third he calls the flies in, and the arena stops being empty.
    flies: {
      weight: 1.4,
      dur: 1.9,
      clip: "croak",
      once: 2, // at most twice in a fight
      beats: beats({
        at: 1.0,
        do(w, b) {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU + w.rand() * 0.6;
            w.add("fly", b.x + Math.cos(a) * 44, b.y + Math.sin(a) * 44);
          }
          w.say("Flies boil out of the mud.");
          w.sound("swarm");
        },
      }),
      recover: 0.6,
    },
    // Three short hops, back to back, with almost no gap.
    frenzy: {
      weight: 2,
      dur: 3.2,
      clip: "crouch",
      beats: beats(
        ...[0, 1, 2].flatMap((i) => [
          {
            at: 0.25 + i * 1.0,
            do(w, b) {
              const p = w.player;
              b.jumpTo = [p.x + (w.rand() - 0.5) * 30, p.y + (w.rand() - 0.5) * 30];
              w.clip(b, "leap");
              // (live from his landing, its shockwave spreading as the hop's — was 0.05 s after, everywhere at once)
              w.hazard({ kind: KIND.CIRCLE, x: b.jumpTo[0], y: b.jumpTo[1], r: SLAM_R_SMALL, tele: 0.57, active: SLAM_SWEEP + 0.03, sweep: SLAM_SWEEP, fade: 0.25, dmg: 16, tag: "slam" });
            },
          },
          {
            at: 0.82 + i * 1.0,
            do(w, b) {
              if (b.jumpTo) (b.x = b.jumpTo[0]), (b.y = b.jumpTo[1]), (b.jumpTo = null);
              w.shake(6);
              w.sound("slam");
              w.landed(b, true);
              w.clip(b, "idle");
            },
          },
        ])
      ),
      recover: 0.9,
    },
  },
};

// =============================================================================================
// II · Sister Cinder
// =============================================================================================
/** Her rain's five fireballs, one on the hero and four round him, landing one after another (her rain, and her seal's). */
const rainBeats = () => [
  ...[0, 1, 2, 3, 4].map((i) => ({
    at: 0.2 + i * 0.24,
    do(w) {
      const p = w.player;
      const a = w.rand() * TAU;
      const d = i === 0 ? 0 : 20 + w.rand() * 70;
      w.hazard({ kind: KIND.CIRCLE, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 30, tele: 1.0, active: 0.16, fade: 0.3, dmg: 18, tag: "rain" });
    },
  })),
  { at: 1.2, do: (w) => w.sound("fire") },
];
const cinder = {
  id: "cinder",
  tier: 2,
  name: "Sister Cinder",
  title: "of the Ash Floor",
  blurb: "She tended the shrine's fire until it answered her. Now she feeds it everyone who comes.",
  arena: "ash",
  art: "cinder",
  // Her opening (the owner, 2026-10-20: "for her spawn, i would like for her to sit down at the altar circle in the beginning
  // with a transparent bubble around her, and when a bell is rang, which you need to add somewhere accessible in the arena, the
  // bubble will pop and the boss will start to spin and be engulfed in flames that are charged and then being used as an first
  // initial attack that spans over the map from her position to the bottom, like a wall of fire"): a real fight starts at the
  // Ash Floor's bell (content/arenas.js "ash".bell; sim/world.js stepOpening), she waiting at its `seat` on the altar in her
  // bubble. Seconds from the strike: the bubble pops as the bell's ring reaches her (pop), she rises and spins three turns
  // faster and faster in a charge of fire (spin), the wall's mark is laid down the floor from her to its `wall` end (mark: 1.3 s
  // of warning, the experts' boss may go short but not here — it is the fight's first lesson), she thrusts it out (fire), comes
  // down from the altar to the floor's middle where any other fight starts her (descend — sim/world.js stepOpening: left up there
  // she held the altar's corner all fight) and sinks to her feet (settle). The hero walks free
  // through it all; a hero standing at the bell is
  // 59 units off the wall's middle, 35 clear of it. Damage in her lanes' class; it leaves her lanes' burning ground behind
  // along it. (The beats follow the owner's video brief for her opening clip, prompt_entrance.txt: rise, three turns, fists
  // to the chest, the thrust, the sink — boss-profiles.js holds the placeholder clips till it is made.)
  entrance: "bell",
  // Reordered (the owner, 2026-10-21: "the boss text should show after the rotating animation and fire up, but before the
  // attack. Also make the wake up animation feel heavier with a small shockwave similar to how the hero is staggered in the bog
  // with gnashers appearance"): she wakes heavily as the bubble pops — a hitstop, a shake, and a shockwave rolling out over the
  // floor at `shock.speed` that staggers the hero where it reaches him (Gnasher's landing shove, softer: 70 for 0.55 s, his
  // 110 for 0.8) — rises slowly, spins in her charge, then holds it burning while her name card shows (`card`, FIGHT.intro
  // long; the hero held still as in any name card), and only then lays the wall's mark, thrusts it out and comes down; the
  // fight starts at `end` (no second card).
  opening: {
    pop: 0.4,
    shock: { speed: 300, push: 70, time: 0.55 },
    spin: [1.3, 2.7],
    card: 2.7,
    mark: 4.9,
    fire: 6.2,
    descend: [6.5, 7.6],
    settle: 7.6,
    end: 7.8,
    wall: { w: 36, active: 0.3, fade: 0.4, dmg: 24 },
    burn: { every: 46, r: 20, tele: 0.5, active: 3.0, fade: 0.5, dmg: 8, tick: 0.55 },
  },
  hp: 800,
  radius: 20,
  // The drawn Cinder (as the toad's `hurt` and `body`): 6.0 in front, 6.7 behind, her sleeves 11 to the sides; the
  // skirt's hem 8 round. At `body` 20 (the radius) the hero could not come near enough to reach her front.
  body: 8,
  hurt: [6.5, 11],
  hitH: 46,
  contact: 12,
  poise: 150,
  moveSpeed: 44,
  drift: true, // she keeps her distance
  gap: [0.75, 1.15],
  phases: [
    { at: 1.0, moves: ["lanes", "rain", "nova"], gapScale: 1 },
    { at: 0.65, moves: ["lanes", "rain", "nova", "veil", "chase", "sweep", "seal"], gapScale: 0.88, line: "Ash gathers round her." },
    { at: 0.3, moves: ["storm", "rain", "nova", "chase", "veil", "sweep", "seal"], gapScale: 0.72, line: "The floor remembers every fire." },
  ],
  moves: {
    // Two lines through her, at right angles; they leave fire behind.
    lanes: {
      weight: 3,
      dur: 2.0,
      clip: "cast",
      beats: beats(
        {
          at: 0.1,
          do(w, b) {
            const a = w.aimAtPlayer() + (w.rand() - 0.5) * 0.5;
            for (const off of [0, Math.PI / 2]) {
              w.hazard({ kind: KIND.LANE, x: b.x - Math.cos(a + off) * 200, y: b.y - Math.sin(a + off) * 200, a: a + off, len: 400, w: 30, tele: 1.05, active: 0.2, fade: 0.3, dmg: 24, tag: "lane" });
            }
          },
        },
        { at: 1.15, do: (w, b) => (w.shake(5), w.sound("fire"), w.clip(b, "idle")) },
        {
          at: 1.2,
          do(w, b) {
            // The fire lingers where the lines crossed.
            for (let i = 0; i < 4; i++) {
              const a = w.rand() * TAU;
              const d = w.rand() * 90;
              w.hazard({ kind: KIND.CIRCLE, x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r: 22, tele: 0.5, active: 3.4, fade: 0.5, dmg: 8, every: 0.55, style: "cold", tag: "burn" });
            }
          },
        }
      ),
      recover: 0.85,
    },
    // Five pools, landing one after another, so you are always walking.
    rain: {
      weight: 2.6,
      dur: 2.8,
      clip: "cast",
      beats: beats(...rainBeats()),
      recover: 0.75,
    },
    // Her bubble in the fight (the owner, 2026-10-21: "i want to reuse that bubble effect in cinder sister during the fight
    // sometime when she spawn some attack and she will be immortal until you hit the bell again"): she throws her rain of fire
    // and seals herself in her opening's bubble as she does — its film drawn up round her from the floor for `seal.at` s (the
    // telegraph, its glassy swell the sound; a blow still lands till it closes, and one that breaks her poise stops it), then
    // sealed (sim/world.js seal): blows glance off the film, and she fights on from inside it, every move but this and the veil,
    // until the hero strikes the Ash Floor's bell (content/arenas.js "ash".bell); its ring pops the bubble `seal.ring` s later as
    // in her opening, with a smaller shockwave (`seal.shock`, view only) and no stagger. Twice a fight at most (`once`), never
    // again within `seal.rest` s of a pop, never back to back; from her second phase. The rain is the rain's own, its damage
    // unchanged. Weight 1.2 of 14.8 in her second phase (and of 14.4 in her last). On the balance sweep's 40 fights a skill
    // (.scratch/cinder-bubble/cost.mjs) she sealed 7 times against the keen bot and 16 against the expert, each held 2.4-2.6 s
    // till the bot rang the bell; their wins, her health left and their hits as without it (keen 73% left, expert 54%).
    seal: {
      weight: 1.2,
      dur: 2.8,
      clip: "cast",
      once: 2,
      seal: { at: 0.9, ring: 0.3, rest: 30, shock: 260 },
      beats: beats(...rainBeats(), { at: 0, do: (w) => w.sound("bubbleSeal") }, { at: 0.9, do: (w, b) => w.seal(b) }),
      recover: 0.75,
    },
    // A ring that runs outward: the safe place is right next to her.
    nova: {
      weight: 2.2,
      dur: 2.3,
      // her own nova, made from the owner's video (she gathers, flings her arms up as the ring goes live at 1.25 s, settles
      // by 2.3 s): view only, the beats below are unchanged except that she no longer drops to idle at the burst
      clip: "nova",
      beats: beats(
        { at: 0.1, do: (w, b) => w.hazard({ kind: KIND.RING, x: b.x, y: b.y, r: 60, r0: 34, tele: 1.15, active: 0.7, fade: 0.25, expand: 180, dmg: 24, tag: "nova" }) },
        { at: 1.25, do: (w, b) => (w.shake(7), w.sound("nova")) }
      ),
      recover: 0.9,
    },
    // She wraps herself in ash and cannot be hurt. Three embers come out; each one left alive
    // when the veil drops goes off in your face.
    veil: {
      weight: 1.8,
      dur: 6.4,
      clip: "veil",
      immune: [0.5, 5.6],
      beats: beats(
        {
          at: 0.5,
          do(w, b) {
            w.clip(b, "veiled");
            w.say("Ash Veil — break the embers.");
            w.sound("veil");
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * TAU + 0.5;
              w.add("ember", b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 60);
            }
          },
        },
        {
          at: 5.6,
          do(w, b) {
            w.clip(b, "idle");
            // Anything still burning goes off where it stands.
            for (const a of w.adds) if (a.type === "ember" && a.alive) w.detonate(a, 26, 48);
          },
        }
      ),
      recover: 0.8,
    },
    // One slow flame that follows you. Outrun it or roll through it.
    // She crosses the arena and the floor burns where she passed: root motion doing the work a
    // decal cannot, because the danger is where she *went*.
    sweep: {
      weight: 2.2,
      dur: 2.6,
      clip: "cast",
      track: 0.55,
      motion: [{ at: 0.8, dur: 0.85, dist: 150, pow: 1.6 }],
      beats: beats(
        { at: 0.55, do: (w) => (w.say("She moves."), w.sound("fire")) },
        ...[0, 1, 2, 3, 4, 5].map((i) => ({
          at: 0.82 + i * 0.14,
          do(w, b) {
            w.hazard({ kind: KIND.CIRCLE, x: b.x, y: b.y, r: 24, tele: 0.5, active: 2.4, fade: 0.4, dmg: 9, every: 0.6, style: "cold", tag: "burn" });
          },
        })),
        { at: 1.8, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.9,
    },
    chase: {
      weight: 1.8,
      dur: 1.6,
      clip: "cast",
      track: 0.6,
      beats: beats({
        at: 0.6,
        do(w, b) {
          w.shot({ x: b.x, y: b.y - 20, a: w.aimAtPlayer(), speed: 74, r: 6, dmg: 20, art: "ember", life: 7, homing: 1.9, tag: "chase" });
          w.sound("fire");
        },
      }),
      recover: 0.7,
    },
    // The last phase: a cone that sweeps all the way round, twice.
    storm: {
      weight: 2.6,
      dur: 4.4,
      clip: "cast",
      beats: beats(
        {
          at: 0.2,
          do(w, b) {
            const dir = w.rand() < 0.5 ? 1 : -1;
            w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: w.aimAtPlayer(), half: 0.45, r: 320, r0: 26, tele: 1.0, active: 2.6, fade: 0.3, dmg: 20, every: 0.5, spin: dir * 2.5, tag: "storm" });
            w.say("Firestorm.");
          },
        },
        { at: 1.2, do: (w) => (w.shake(5), w.sound("storm")) }
      ),
      recover: 1.0,
    },
  },
};

// =============================================================================================
// III · The Drowned King
// =============================================================================================
// His geysers (the owner, 2026-10-19: "I think one part of the fight should be that it could spray up water from the 4
// watersinks"): the Drowned Hall's four round drain grates (content/arenas.js "hall".grates, read off the painting through its
// camera: tools/hall/walkgrid.py) burst — about a second of water rising and bubbling in the grate with its wet ring spreading
// on the floor round it (the view: gfx3d/geyser3d.js; its red marking only in Demo mode, as Gnasher's), then a column of water
// 0.6 s live in a circle of Gnasher's small-slam class round it. Four points round the middle stand in where a floor has none.
// Tuned on the bots (.scratch/hall/probe/bal.mjs, 200 runs a skill): the old circle 0% keen / 3.5% expert, the hall's floor alone
// the same, the hall with geysers 0% / 6.0% — its band (keen 0-30%, expert under 40%) kept. A geyser is a breather as much as a
// threat (2.9 s moves and weights 1.8/2.0 gave the experts 12%): its moves short (1.6 and 1.9 s), weights 1.5 and 1.7.
export const GEYSER = { r: 50, tele: 1.0, active: 0.6, fade: 0.35, dmg: 20 };
const gratesOf = (w) => w.arena?.grates || [[-70, -20], [-30, 70], [80, 10], [85, 100]];
const geyserAt = (w, [x, y]) => w.hazard({ kind: KIND.CIRCLE, x, y, r: GEYSER.r, tele: GEYSER.tele, active: GEYSER.active, fade: GEYSER.fade, dmg: GEYSER.dmg, tag: "geyser" });
/** The grates nearest the hero first (by index). */
const gratesByNear = (w) => {
  const p = w.player;
  return gratesOf(w).map((g, i) => [Math.hypot(g[0] - p.x, g[1] - p.y), i]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
};
const king = {
  id: "king",
  tier: 3,
  name: "The Drowned King",
  title: "who kept the tide",
  blurb: "The sea took his hall, his crown and his breath. He still drags his anchor through the dark.",
  arena: "hall",
  art: "king",
  // A real fight with him starts at the hall's small bell (the owner's pick, 2026-10-19: "the hero rings the SMALL bell, and
  // the BIG bell answers"): struck, the great bell at the back answers it, and he comes up out of the sea onto the floor
  // (World, FIGHT.entrance; content/arenas.js "hall".bell). He has no leap or roar of his own: his anchor raised in the air,
  // slammed down as he lands, a call at the hero — and the sea's splash as he leaves it, his anchor's slam, the tide's rush.
  entrance: "bell",
  entranceClips: { leap: "raise", land: "slam", roar: "call" },
  entranceSounds: { leap: "splashBig", land: "slam", roar: "wave" },
  hp: 800,
  radius: 24,
  // The drawn King (the stump, without the anchor and chain he holds): 10.3 in front, 8.6 behind, his arms out to
  // 20 at the sides; his trunk 11 round near the ground.
  body: 11,
  hurt: [10, 20],
  hitH: 52,
  contact: 16,
  poise: 190,
  moveSpeed: 34,
  gap: [0.85, 1.25],
  phases: [
    { at: 1.0, moves: ["slam", "tide", "chain"], gapScale: 1 },
    { at: 0.65, moves: ["slam", "tide", "chain", "hands", "crossTide", "combo", "geyser", "spin"], gapScale: 0.85, line: "The water is coming in." },
    { at: 0.3, moves: ["flood", "slam", "crossTide", "hands", "combo", "geyserRoll", "spin"], gapScale: 0.7, line: "The hall floods. Find the shallows." },
  ],
  moves: {
    // The anchor goes up, then down, and the floor throws two rings out after it.
    slam: {
      weight: 3,
      dur: 2.4,
      clip: "raise",
      // He turns to you as the anchor goes up and commits the moment the landing is marked.
      track: 0.3,
      motion: [{ at: 1.28, dur: 0.2, dist: 22, pow: 3 }],
      beats: beats(
        {
          at: 0.3,
          do(w, b) {
            const p = w.player;
            b.face = Math.atan2(p.y - b.y, p.x - b.x);
            // Live at 1.4, the tick the anchor lands and the ripples leave it — not after them.
            w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 54, tele: 1.1, active: 0.16, fade: 0.35, dmg: 25, tag: "slam" });
            b.slamAt = [p.x, p.y];
          },
        },
        {
          at: 1.4,
          do(w, b) {
            w.clip(b, "slam");
            w.shake(11);
            w.sound("slam");
            const [sx, sy] = b.slamAt || [b.x, b.y];
            w.hazard({ kind: KIND.WAVE, x: sx, y: sy, r: 24, w: 18, tele: 0, active: 0.8, fade: 0.2, expand: 165, dmg: 11, tag: "ripple" });
            w.hazard({ kind: KIND.WAVE, x: sx, y: sy, r: 24, w: 18, tele: 0.34, active: 0.8, fade: 0.2, expand: 165, dmg: 11, tag: "ripple" });
          },
        },
        { at: 1.9, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.9,
    },
    // A band of water crosses the whole floor. Walk to the side it came from.
    tide: {
      weight: 2.6,
      dur: 3.0,
      clip: "call",
      beats: beats(
        {
          at: 0.2,
          do(w, b) {
            const a = w.rand() * TAU;
            const R = 170;
            w.hazard({ kind: KIND.LANE, x: b.x + Math.cos(a) * -R, y: b.y + Math.sin(a) * -R, a, len: R * 2, w: 62, tele: 1.3, active: 0.9, fade: 0.3, dmg: 20, tag: "tide" });
          },
        },
        { at: 1.35, do: (w) => (w.shake(6), w.sound("wave")) },
        { at: 2.4, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.85,
    },
    // Two bands at once, leaving one narrow quarter of the floor.
    crossTide: {
      weight: 2.2,
      dur: 3.2,
      clip: "call",
      beats: beats(
        {
          at: 0.2,
          do(w, b) {
            const a = w.rand() * TAU;
            const R = 180;
            for (const off of [0, Math.PI / 2]) {
              const aa = a + off;
              w.hazard({ kind: KIND.LANE, x: b.x + Math.cos(aa) * -R, y: b.y + Math.sin(aa) * -R, a: aa, len: R * 2, w: 54, tele: 1.4, active: 0.85, fade: 0.3, dmg: 21, tag: "tide" });
            }
          },
        },
        { at: 1.5, do: (w) => (w.shake(7), w.sound("wave")) },
        { at: 2.6, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.9,
    },
    // A chain snaps out. If it catches you it drags you in, and what follows is his anchor.
    // (his chain thrown with his chain arm — the model's chain_throw, its chain snapping out 0.7 s in, started 0.35 s into the
    // move so the throw lands as the lane goes live at 1.05; it was his anchor raised, the chain never leaving his side. The
    // chain itself is drawn whirling, paid out along the whole lane and reeled back: gfx3d/kingchain3d.js — the owner,
    // 2026-10-21: "make it so that his chain is expandable on his attacks so that he can do big swings with it")
    chain: {
      weight: 2,
      dur: 2.6,
      clip: "idle",
      track: 0.35,
      beats: beats(
        {
          at: 0.2,
          do(w, b) {
            const a = w.aimAtPlayer();
            b.face = a;
            w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: 240, w: 20, tele: 0.85, active: 0.18, fade: 0.25, dmg: 12, tag: "chain", pull: true, follow: true });
          },
        },
        { at: 0.35, do: (w, b) => w.clip(b, "chain_throw") },
        { at: 1.05, do: (w) => (w.sound("chain"), w.shake(4)) },
        {
          at: 1.5,
          do(w, b) {
            w.clip(b, "slam");
            w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.7, r: 78, tele: 0.62, active: 0.16, fade: 0.3, dmg: 23, tag: "cleave" });
          },
        },
        { at: 2.25, do: (w, b) => (w.shake(8), w.clip(b, "idle")) }
      ),
      recover: 0.8,
    },
    // Three swings, each re-aimed, the last the heaviest and the slowest. By Boss III you are
    // expected to roll through all three rather than run from any of them.
    combo: {
      weight: 2.6,
      dur: 4.1,
      clip: "raise",
      track: 0.2,
      motion: [
        { at: 0.72, dur: 0.16, dist: 16 },
        { at: 1.74, dur: 0.16, dist: 18 },
        { at: 3.0, dur: 0.26, dist: 30, pow: 3 },
      ],
      beats: beats(
        {
          at: 0.05,
          do(w, b) {
            b.face = w.aimAtPlayer();
            w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.72, r: 74, tele: 0.66, active: 0.14, fade: 0.26, dmg: 17, tag: "cleave", follow: true });
          },
        },
        { at: 0.72, do: (w, b) => (w.clip(b, "slam"), w.shake(5), w.sound("slam")) },
        {
          at: 1.06,
          do(w, b) {
            b.face = w.aimAtPlayer();
            w.clip(b, "raise");
            w.hazard({ kind: KIND.CONE, x: b.x, y: b.y, a: b.face, half: 0.8, r: 78, tele: 0.66, active: 0.14, fade: 0.26, dmg: 17, tag: "cleave" });
          },
        },
        { at: 1.74, do: (w, b) => (w.clip(b, "slam"), w.shake(6), w.sound("slam")) },
        {
          at: 2.1,
          do(w, b) {
            // The third is slower and bigger, and it is drawn while you are still recovering from
            // rolling the second. That overlap is the whole difficulty of Boss III.
            b.face = w.aimAtPlayer();
            w.clip(b, "raise");
            w.hazard({ kind: KIND.CIRCLE, x: b.x + Math.cos(b.face) * 40, y: b.y + Math.sin(b.face) * 40, r: 52, tele: 0.86, active: 0.18, fade: 0.36, dmg: 25, tag: "slam" });
          },
        },
        {
          at: 3.0,
          do(w, b) {
            w.clip(b, "slam");
            w.shake(11);
            w.sound("slam");
            w.hazard({ kind: KIND.WAVE, x: b.x + Math.cos(b.face) * 40, y: b.y + Math.sin(b.face) * 40, r: 18, w: 16, tele: 0, active: 0.6, fade: 0.2, expand: 140, dmg: 10, tag: "ripple" });
          },
        },
        { at: 3.55, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 1.2,
    },
    // The chain spin (the owner, 2026-10-21: "Add one attack where he is winding up the chain a couple of rounds around his body,
    // and then do a rotating spin to release the chain in an aoe attack effect around him"): the circle round him is marked as he
    // winds the chain round his body, faster and wider, three rounds in its 1.5 s of warning — then he spins once on the spot
    // and lets it fly out, the anchor sweeping a whole round at the circle's edge, everything inside it struck (the chain, his
    // spin and the burst are the view's: gfx3d/kingchain3d.js, boss3d.js `spinTag`, render3d.js). Its 84 is past his cleaves'
    // 78: from beside him (25) the hero runs clear in 0.63 s at 94 a second, or rolls through it. Damage in his cleaves' and
    // slams' class (17-25).
    // (its recovery short, 0.4: at 0.9, the wind-up's free hits and the wait after it took the expert bots from 3% wins to 18%;
    // at 0.4 they win 5% over 80 runs — his difficulty as it was, Boss III a wall)
    spin: {
      weight: 1.5,
      dur: 2.2,
      clip: "call",
      beats: beats(
        {
          at: 0.15,
          do(w, b) {
            w.hazard({ kind: KIND.CIRCLE, x: b.x, y: b.y, r: 84, tele: 1.5, active: 0.25, fade: 0.35, dmg: 22, tag: "spin" });
            w.sound("chain");
          },
        },
        { at: 1.65, do: (w, b) => (w.clip(b, "cleave"), w.shake(8), w.sound("slam")) },
        { at: 2.1, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.4,
    },
    // Hands come up out of the water and walk at you.
    hands: {
      weight: 1.6,
      dur: 2.2,
      clip: "call",
      beats: beats({
        at: 1.0,
        do(w, b) {
          for (let i = 0; i < 3; i++) {
            const a = w.rand() * TAU;
            const d = 70 + w.rand() * 60;
            // (up through the floor, never the sea round the Drowned Hall's: on its own floor's shape a hand could rise past the
            // edge and was pulled back onto it a tick later — the sim holds every add 9 inside, sim/world.js stepAdds)
            const o = { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d };
            w.arena?.keep?.(o, 9); // (the stand-in worlds of the checks and pose.js have no floor)
            w.add("hand", o.x, o.y);
          }
          w.say("Something comes up through the floor.");
          w.sound("hands");
          w.clip(b, "idle");
        },
      }),
      recover: 0.7,
    },
    // The water is coming in: he raises his anchor and slams it down, and the drain grate nearest you bursts — and, half the
    // time, the next nearest 0.45 s after it.
    geyser: {
      weight: 1.5,
      dur: 1.6,
      clip: "raise",
      beats: beats(
        {
          at: 0.45,
          do(w, b) {
            w.clip(b, "slam");
            w.shake(6);
            w.sound("slam");
            const near = gratesByNear(w);
            b.geysers = w.rand() < 0.5 ? near.slice(0, 2) : near.slice(0, 1);
            geyserAt(w, gratesOf(w)[b.geysers[0]]);
          },
        },
        { at: 0.9, do: (w, b) => b.geysers?.length > 1 && geyserAt(w, gratesOf(w)[b.geysers[1]]) },
        { at: 1.3, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.5,
    },
    // The hall floods: all four grates in turn, 0.4 s apart, from the one nearest you on round the floor — the last one bursts
    // as the first is spent, so there is always a dry grate to run to.
    geyserRoll: {
      weight: 1.7,
      dur: 1.9,
      clip: "raise",
      beats: beats(
        {
          at: 0.45,
          do(w, b) {
            w.clip(b, "slam");
            w.shake(7);
            w.sound("slam");
            const G = gratesOf(w), first = gratesByNear(w)[0];
            const ang = (i) => Math.atan2(G[i][1], G[i][0]);
            const turn = (i) => (ang(i) - ang(first) + 4 * Math.PI) % (2 * Math.PI);
            b.geysers = G.map((_, i) => i).sort((a, c) => turn(a) - turn(c));
            geyserAt(w, G[b.geysers[0]]);
          },
        },
        ...[1, 2, 3].map((k) => ({ at: 0.45 + 0.4 * k, do: (w, b) => b.geysers?.[k] != null && geyserAt(w, gratesOf(w)[b.geysers[k]]) })),
        { at: 1.4, do: (w, b) => w.clip(b, "idle") }
      ),
      recover: 0.6,
    },
    // The last phase. The whole floor drowns except two shallows, and they move.
    flood: {
      weight: 3.4,
      dur: 9.0,
      clip: "flood",
      beats: beats(
        { at: 0.2, do: (w) => (w.say("The hall floods."), w.sound("flood"), w.shake(6)) },
        ...[0, 1, 2, 3].map((i) => ({
          at: 1.2 + i * 1.9,
          do(w, b) {
            // Two safe discs, marked in green; everywhere else takes damage in a moment.
            const a = w.rand() * TAU;
            // (on the Drowned Hall's own floor — longer than wide, its dais up the stair — a shallow 82 out could lie half over the
            // sea: each kept 30 inside the edge, so most of its 40 is floor the hero can stand on. On the old circle (R 118) none
            // moves: 82 is already 36 inside)
            const spots = [
              [Math.cos(a) * 82, Math.sin(a) * 82],
              [Math.cos(a + Math.PI) * 82, Math.sin(a + Math.PI) * 82],
            ].map(([x, y]) => {
              const o = { x, y };
              w.arena?.keep?.(o, 30);
              return [o.x, o.y];
            });
            w.safeZones(spots, 40, 1.1, 1.5);
          },
        })),
        { at: 8.6, do: (w, b) => (w.clip(b, "idle"), w.say("The water falls back.")) }
      ),
      recover: 1.1,
      immune: [0.0, 0.6],
    },
  },
};

export const BOSSES = { gnasher, cinder, king };
// The bosses offered, in the week's order. The game is drawn in 3D only, so only the bosses made in
// 3D are here; Cinder and the King keep their fights above and join once their 3D models exist.
export const BOSS_ORDER = ["gnasher"];
/** Every boss with a 3D model (a profile in gfx3d/boss-profiles.js): the admin menu tests any of them. */
export const MODELLED = ["gnasher", "cinder", "king"];
