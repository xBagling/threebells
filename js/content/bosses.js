// The three bosses. Each is a list of moves; a move is a length, an animation clip, and a handful
// of timed beats that spawn telegraphs. The picker chooses the next move from the ones the current
// phase allows, weighted, never the same one twice running.
//
// The rule every move follows: what is drawn on the floor is exactly what will hurt you, and it is
// drawn for long enough to walk out of. Difficulty comes from how the moves overlap, not from
// hiding them.
import { KIND } from "../sim/hazards.js?v=8898846";
import { TAU } from "../util.js?v=8898846";

const beats = (...list) => list.sort((a, b) => a.at - b.at);

// =============================================================================================
// I · Gnasher, the Meadow Toad
// =============================================================================================
const gnasher = {
  id: "gnasher",
  tier: 1,
  name: "Gnasher",
  title: "the Meadow Toad",
  // Name-card lines tell who the boss is, never how to beat him (the owner, 7.5); the training yard teaches.
  blurb: "The meadow's oldest resident. He has kept this garden since the first bell, and he does not share.",
  arena: "bog",
  art: "gnasher",
  hp: 700,
  radius: 26,
  // What you cannot walk through (World.bodyBlock), the drawn toad's own footprint: the hero can come
  // up close enough almost to touch him (the owner, 2026-10-02). Hits and reach still use `radius`.
  body: 15,
  hitH: 34,
  // A real fight with him starts at the bell: the hero strikes it, and he leaps in (World, FIGHT.entrance).
  entrance: "bell", // how far up the sprite the hittable body reaches
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
            w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 48, tele: 1.0, active: 0.14, fade: 0.35, dmg: 22, tag: "slam" });
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
      cast: { name: "Croak", from: 0.15, to: 2.2, heal: 0.1 },
      beats: beats({ at: 0.15, do: (w) => w.sound("cast") }, {
        at: 2.2,
        do(w, b) {
          w.heal(b, b.hpMax * 0.1);
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
    // Two lashes, the second arriving just as a panicked dodge would be ending. The first attack
    // string in the game, and what teaches you not to spend the roll early.
    doubleLash: {
      weight: 2.2,
      dur: 2.5,
      clip: "gape",
      // No tracking: the first line is laid where he looks as it starts, and it is the second
      // that re-aims. A tracked first lash would leave too little time between lock and hit.
      motion: [
        { at: 0.62, dur: 0.16, dist: 12 },
        { at: 1.62, dur: 0.16, dist: 16 },
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
        { at: 1.62, do: (w, b) => (w.clip(b, "lash"), w.shake(5), w.sound("lash")) }
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
              w.hazard({ kind: KIND.CIRCLE, x: b.jumpTo[0], y: b.jumpTo[1], r: 44, tele: 0.62, active: 0.12, fade: 0.25, dmg: 16, tag: "slam" });
            },
          },
          {
            at: 0.82 + i * 1.0,
            do(w, b) {
              if (b.jumpTo) (b.x = b.jumpTo[0]), (b.y = b.jumpTo[1]), (b.jumpTo = null);
              w.shake(6);
              w.sound("slam");
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
const cinder = {
  id: "cinder",
  tier: 2,
  name: "Sister Cinder",
  title: "of the Ash Floor",
  blurb: "She tended the shrine's fire until it answered her. Now she feeds it everyone who comes.",
  arena: "ash",
  art: "cinder",
  hp: 800,
  radius: 20,
  hitH: 46,
  contact: 12,
  poise: 150,
  moveSpeed: 44,
  drift: true, // she keeps her distance
  gap: [0.75, 1.15],
  phases: [
    { at: 1.0, moves: ["lanes", "rain", "nova"], gapScale: 1 },
    { at: 0.65, moves: ["lanes", "rain", "nova", "veil", "chase", "sweep"], gapScale: 0.88, line: "Ash gathers round her." },
    { at: 0.3, moves: ["storm", "rain", "nova", "chase", "veil", "sweep"], gapScale: 0.72, line: "The floor remembers every fire." },
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
      beats: beats(
        ...[0, 1, 2, 3, 4].map((i) => ({
          at: 0.2 + i * 0.24,
          do(w) {
            const p = w.player;
            const a = w.rand() * TAU;
            const d = i === 0 ? 0 : 20 + w.rand() * 70;
            w.hazard({ kind: KIND.CIRCLE, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 30, tele: 1.0, active: 0.16, fade: 0.3, dmg: 18, tag: "rain" });
          },
        })),
        { at: 1.2, do: (w) => w.sound("fire") }
      ),
      recover: 0.75,
    },
    // A ring that runs outward: the safe place is right next to her.
    nova: {
      weight: 2.2,
      dur: 2.3,
      clip: "cast",
      beats: beats(
        { at: 0.1, do: (w, b) => w.hazard({ kind: KIND.RING, x: b.x, y: b.y, r: 60, r0: 34, tele: 1.15, active: 0.7, fade: 0.25, expand: 180, dmg: 24, tag: "nova" }) },
        { at: 1.25, do: (w, b) => (w.shake(7), w.sound("nova"), w.clip(b, "idle")) }
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
const king = {
  id: "king",
  tier: 3,
  name: "The Drowned King",
  title: "who kept the tide",
  blurb: "The sea took his hall, his crown and his breath. He still drags his anchor through the dark.",
  arena: "hall",
  art: "king",
  hp: 800,
  radius: 24,
  hitH: 52,
  contact: 16,
  poise: 190,
  moveSpeed: 34,
  gap: [0.85, 1.25],
  phases: [
    { at: 1.0, moves: ["slam", "tide", "chain"], gapScale: 1 },
    { at: 0.65, moves: ["slam", "tide", "chain", "hands", "crossTide", "combo"], gapScale: 0.85, line: "The water is coming in." },
    { at: 0.3, moves: ["flood", "slam", "crossTide", "hands", "combo"], gapScale: 0.7, line: "The hall floods. Find the shallows." },
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
    chain: {
      weight: 2,
      dur: 2.6,
      clip: "raise",
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
            w.add("hand", b.x + Math.cos(a) * d, b.y + Math.sin(a) * d);
          }
          w.say("Something comes up through the floor.");
          w.sound("hands");
          w.clip(b, "idle");
        },
      }),
      recover: 0.7,
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
            const spots = [
              [Math.cos(a) * 82, Math.sin(a) * 82],
              [Math.cos(a + Math.PI) * 82, Math.sin(a + Math.PI) * 82],
            ];
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
export const bossAt = (tier) => BOSSES[BOSS_ORDER[tier - 1]];
