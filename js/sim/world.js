// The fight itself: one arena, one hero, one boss, and everything either of them puts on the floor.
//
// The sim is deterministic — a fixed 1/60 s tick, a seeded random, and no reading of the clock — so
// the same inputs always give the same fight. That is what will later let the server re-play a run
// instead of believing it, and what lets a death be watched back.
import { PLAYER, FIGHT, TICK } from "../config.js?v=48fd128-df87a96f";
import { arenaShape } from "./arena.js?v=48fd128-df87a96f";
import { clamp, angleDiff, rng as makeRng, hashSeed, reached, TICK_EPS, TAU, lerp } from "../util.js?v=48fd128-df87a96f";
import { makePlayer, stepPlayer, swingArc, bladeHits, hurtPlayer, staggerPlayer, setArms, armCounter, STATE, inAir } from "./player.js?v=48fd128-df87a96f";
import { hazard, stepHazard, damageFor, phaseOf, sourceOf, hits, KIND, jumpable } from "./hazards.js?v=48fd128-df87a96f";
import { ITEMS } from "../content/items.js?v=48fd128-df87a96f";
import { FEEL, stopFor, shakeFor } from "../feel.js?v=48fd128-df87a96f";

const ADDS = {
  fly: { hp: 34, r: 7, speed: 68, dmg: 8, contact: 0.8, art: "fly", gold: 1 },
  ember: { hp: 46, r: 8, speed: 34, dmg: 0, contact: 0, art: "ember", boom: [24, 46], gold: 2 },
  hand: { hp: 70, r: 9, speed: 40, dmg: 14, contact: 1.1, art: "hand", root: 0.7, gold: 2 },
};

/** Drop in place what fails `keep`: the tick's lists are pruned without a new array each (5 a tick, 300 a second). */
function compact(list, keep) {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (keep(list[i])) list[n++] = list[i];
  list.length = n;
}
/** Is a move's clock in its window [w0, w1), to the tick (util.js reached)? */
const within = (t, w0, w1) => reached(t, w0) && !reached(t, w1);
const notDone = (h) => !h.done;
const notDead = (s) => !s.dead;
const addLeft = (a) => a.alive || a.dying < 0.45;
const floating = (f) => f.t < 0.9;
/** An arena's own bell (content/arenas.js "bell": its place, its radius, its frame's posts), solid. */
const ownBell = (AB) => ({ x: AB.at[0], y: AB.at[1], r: AB.r, struckAt: -1, solids: [[AB.at[0], AB.at[1], AB.r], ...AB.posts] });
/** Sister Cinder's bubble's solid radius (her opening's and her seal's: cinder3d.js BUBBLE_R draws it). */
const BUBBLE_R = 18;

export class World {
  /**
   * `debug` is the admin menu's switch panel. The sim reads it but never imports it, so the rules
   * stay testable headlessly and nothing in here depends on there being a screen.
   */
  constructor({ boss, blessing = null, loadout = [null, null], arms = null, mods = {}, seed = 1, practice = false, debug = null, entrance = false }) {
    this.debug = debug || {};
    this.spec = boss;
    // Where the fight can go: the circle, or the arena's own floor (sim/arena.js — the Ash Floor's walls, stairs and altar)
    this.arena = arenaShape(boss.arena);
    // (a shot dies this far past the edge: 10 round the circle; over a shaped floor's walls further, so one crossing a
    // corner by the stairs to the altar does not vanish in mid-air)
    this.shotSpan = this.arena.poly ? 40 : 10;
    this.rand = makeRng(seed);
    // Which move comes next, and the pause before it, draw from their own stream: on the one stream, a crit roll or a knife's
    // spin moved every draw after it, and the hero's swings changed which attack the boss chose.
    this.bossRand = makeRng(hashSeed(`moves:${seed}`));
    this.hazardId = 0; // (the fight's own count: a replay gets the same ids — hazards.js)
    this.phaseMoves = []; // (each phase's moves that exist, made once — startMove)
    this.bossFell = false; // (the boss went down while the hero stood: a death later in the same tick is still a win — step)
    this.still = { mx: 0, my: 0, aim: 0, attack: false, roll: false, slot0: false, slot1: false, pause: false }; // (the hero with no say)
    this.practice = practice;
    this.blessing = blessing;
    this.time = 0; // seconds of fight, not counting the intro
    this.state = "intro"; // (bell → entrance →) intro → fight → won | lost
    this.stateT = 0;

    this.player = makePlayer(mods);
    // What he holds ({ main, off } weapon ids, content/weapons.js; the sword alone unless chosen otherwise)
    setArms(this.player, arms);
    this.player.slots = loadout;
    this.player.charges = loadout.map((id) => (id && ITEMS[id] ? ITEMS[id].charges ?? 0 : 0));
    this.player.cooldowns = [0, 0];

    this.boss = {
      x: 0,
      y: -60,
      vx: 0,
      vy: 0,
      face: Math.PI / 2,
      hp: boss.hp,
      hpMax: boss.hp,
      r: boss.radius,
      body: boss.body ?? boss.radius, // the solid body (bodyBlock); r is what hits and is hit
      hurt: boss.hurt ?? [boss.radius, boss.radius], // what the hero's blade must touch (resolveSwing)
      hitH: boss.hitH,
      clip: "idle",
      clipT: 0,
      clipOnce: false,
      move: null,
      moveT: 0,
      moveDone: 0,
      gap: 1.2,
      phase: 0,
      poise: boss.poise,
      poiseMax: boss.poise,
      stagger: 0,
      immune: false,
      airborne: false,
      flash: 0,
      lastMove: "",
      used: {},
      casting: null,
      dying: 0,
    };

    // The bell entrance (FIGHT.entrance): only in a real fight (main.js passes `entrance`), and only
    // for a boss that has one. The bots, the tests and the benches start at the name card as before.
    // The bell is a solid thing at the back of the garden; the boss is nowhere until it is struck.
    if (entrance && boss.entrance === "bell") {
      const E = FIGHT.entrance;
      this.state = "bell";
      // Solid: the bell, and the post's stone foot, which stands back along its arm (across the screen
      // to the left: bell3d.js stands the model the same way) — for the hero and the boss, the whole fight.
      const reach = E.hookX * E.postH;
      // (an arena with its own bell — the Bog Shrine's, painted in its frame: content/arenas.js "bell", its place and its
      // frame's posts — else the garden's)
      const AB = this.arena.bell;
      this.bell = AB
        ? ownBell(AB)
        : { x: E.bell[0], y: E.bell[1], r: E.bellR, struckAt: -1, solids: [[E.bell[0], E.bell[1], E.bellR], [E.bell[0] - Math.SQRT1_2 * reach, E.bell[1] + Math.SQRT1_2 * reach, E.postR]] };
      // Sister Cinder waits on her arena's seat (content/bosses.js "opening", content/arenas.js "ash".bell.seat): there from the
      // start, sitting in her bubble — solid, out of reach — until the bell is struck (stepOpening). Everyone else is nowhere.
      if (boss.opening && AB?.seat) {
        const b = this.boss;
        b.home = [b.x, b.y]; // (where a fight without it starts her: she comes down to it — stepOpening)
        [b.x, b.y] = AB.seat;
        b.face = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        b.immune = true;
        this.opening = boss.opening;
        this.bubble = { x: b.x, y: b.y, r: BUBBLE_R };
        this.clip(b, "seated");
      } else {
        this.boss.hidden = true;
        this.boss.airborne = true;
      }
    }
    // Sister Cinder's bubble in the fight (content/bosses.js cinder.moves.seal: sealed in it she cannot be hurt till the bell is
    // struck): the move she has for it, and her floor's bell standing solid and strikeable in every fight on it — the bots', the
    // tests', practice — not only after a real fight's entrance (a move with no bell to answer it is never chosen: startMove)
    this.sealMove = Object.values(boss.moves).find((m) => m.seal) || null;
    if (this.sealMove && !this.bell && this.arena.bell) this.bell = ownBell(this.arena.bell);
    this.hazards = [];
    this.shots = [];
    this.adds = [];
    this.chest = null; // after a win (stepChest)
    this.floaters = []; // damage numbers
    this.events = []; // consumed by the renderer and audio each frame
    this.messages = []; // { text, t }
    this.shakeAmt = 0;
    this.hitstop = 0;
    this.slow = 1;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.hitsTaken = 0;
    this.potionsUsed = 0;
    this.enraged = false;
    this.clean = true;
    this.buffs = []; // timed effects from items and blessings
    this.slowField = 1; // < 1 while Frost Nova is up: the boss, adds and shots all crawl
    // The week's affix. daily.js sets it before the fight starts; stepAffix runs the parts of it
    // that need a hand in every tick. It lives in here, not in the fight screen, so a re-played
    // run gets the same eruptions and the same extra adds as the one that was played.
    this.affix = null;
    this.affixT = 0;
    this.frenzied = false;
  }

  // -------------------------------------------------------------------------------------------
  // The API the boss scripts call.
  // -------------------------------------------------------------------------------------------
  hazard(opts) {
    const h = hazard(opts, ++this.hazardId);
    // Hushed: the mark appears late on the floor. The boss winds up exactly as long as ever, so
    // its body still tells you, and the mark is never on the floor for less than half a second.
    const hush = this.affix?.hush;
    if (hush && !h.friendly && h.tele > 0.5) h.hidden = Math.min(h.tele * (1 - hush), h.tele - 0.5);
    this.hazards.push(h);
    this.events.push({ t: "telegraph", h });
    return h;
  }
  shot(o) {
    this.shots.push({ x: o.x, y: o.y, vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed, speed: o.speed, r: o.r || 6, dmg: o.dmg || 14, art: o.art || "bog", life: o.life || 5, homing: o.homing || 0, spin: this.rand() * TAU, tag: o.tag || "", dead: false });
  }
  add(type, x, y) {
    const d = ADDS[type];
    if (!d) return;
    const a = { type, x, y, vx: 0, vy: 0, hp: d.hp, hpMax: d.hp, r: d.r, def: d, alive: true, t: 0, cool: 0, flash: 0, spawn: 0.5, dying: 0 };
    this.adds.push(a);
    this.events.push({ t: "spawn", x, y, kind: type });
  }
  detonate(a, dmg, r) {
    a.alive = false;
    a.dying = 0.3;
    this.hazard({ kind: KIND.CIRCLE, x: a.x, y: a.y, r, tele: 0.5, active: 0.14, fade: 0.25, dmg, tag: "boom" });
  }
  safeZones(spots, r, tele, active) {
    const safe = spots.map(([x, y]) => [x, y, r]);
    this.hazard({ kind: KIND.FLOOD, x: 0, y: 0, safe, r: this.arena.R, tele, active, fade: 0.3, dmg: 22, every: 0.6, tag: "flood" });
  }
  clip(b, name) {
    b.clip = name;
    b.clipT = 0;
  }
  heal(b, amount) {
    b.hp = Math.min(b.hpMax, b.hp + amount);
    this.floaters.push({ x: b.x, y: b.y - this.spec.hitH, v: `+${Math.round(amount)}`, kind: "heal", t: 0 });
  }
  say(text) {
    this.messages.push({ text, t: 0 });
    if (this.messages.length > 3) this.messages.shift();
  }
  sound(name) {
    this.events.push({ t: "sfx", name });
  }
  /** A boss coming down from a hop (`small`: one of a run of short ones): for the view's burst of earth round him. */
  landed(b, small = false) {
    this.events.push({ t: "bossLand", x: b.x, y: b.y, small });
  }
  shake(a) {
    this.shakeAmt = Math.min(22, this.shakeAmt + a);
  }
  /** A hit-stop of `s` seconds (feel.js): the longest of what lands together when FEEL.stopMax, else this one. */
  freeze(s) {
    if (!(s > 0)) return;
    this.hitstop = FEEL.stopMax ? Math.max(this.hitstop, s) : s;
  }
  /** A timed effect. on() runs now, off() when it expires (or when the fight ends: endBuffs). */
  buff(name, dur, on, off) {
    const old = this.buffs.find((b) => b.name === name);
    if (old) {
      old.t = 0;
      old.dur = dur;
      return;
    }
    on?.(this, this.player);
    this.buffs.push({ name, t: 0, dur, off });
  }
  stepBuffs(dt) {
    let n = 0;
    for (const b of this.buffs) {
      b.t += dt;
      if (b.t >= b.dur) b.off?.(this, this.player);
      else this.buffs[n++] = b;
    }
    this.buffs.length = n;
  }
  /** Every effect still on runs its off() (won or lost: a Tide Lantern's speed walked him to the chest at 125%). */
  endBuffs() {
    for (const b of this.buffs) b.off?.(this, this.player);
    this.buffs.length = 0;
  }
  aimAtPlayer() {
    return Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
  }

  /** Fire whatever is in slot i. Returns true if something happened. */
  useSlot(i) {
    const p = this.player;
    const id = p.slots[i];
    if (!id) return false;
    const item = ITEMS[id];
    if (!item) return false;
    if (p.cooldowns[i] > 0) return false;
    if (item.charges != null && p.charges[i] <= 0) return false;
    if (item.use(this, p) === false) return false;
    if (item.charges != null) p.charges[i] -= 1;
    p.cooldowns[i] = (item.cooldown || 0) * (p.cdScale || 1);
    if (item.kind === "potion") this.potionsUsed++;
    this.events.push({ t: "sfx", name: item.sound || "use" });
    return true;
  }

  // -------------------------------------------------------------------------------------------
  // One tick.
  // -------------------------------------------------------------------------------------------
  step(intent, dt = TICK) {
    this.events.length = 0;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      // The world holds still, but the camera keeps shaking so the hit still lands.
      this.shakeAmt *= 0.9;
      return this.events;
    }
    this.stateT += dt;
    for (const m of this.messages) m.t += dt;

    if (this.state === "bell" || this.state === "entrance") {
      this.stepEntrance(intent, dt);
      return this.events;
    }
    if (this.state === "intro") {
      if (this.stateT >= FIGHT.intro) this.setState("fight");
      this.stepBossIdle(dt);
      return this.events;
    }
    if (this.state === "won" || this.state === "lost") {
      this.stepDying(dt);
      if (this.state === "won") this.stepChest(intent, dt);
      return this.events;
    }
    if (this.state === "chest" || this.state === "looted") {
      this.stepChest(intent, dt);
      return this.events;
    }

    this.time += dt;
    if (!this.enraged && !this.debug.noEnrage && this.time >= FIGHT.enrage) {
      this.enraged = true;
      this.say("Enraged. Finish it.");
      this.sound("enrage");
    }

    this.stepBuffs(dt);
    this.blessing?.tick?.(this, this.player, dt);
    if (this.player.regen) this.player.hp = Math.min(this.player.hpMax, this.player.hp + this.player.regen * dt);
    stepPlayer(this.player, intent, dt, this, this.events);
    this.stepBoss(dt);
    this.stepSeal();
    this.bodyBlock();
    this.blockBell();
    this.stepAffix(dt);
    this.stepAdds(dt);
    this.stepShots(dt);
    this.stepHazards(dt);
    this.resolveSwing();
    this.strikeBell();
    this.stepFloaters(dt);

    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
    // (a boss felled earlier in the tick — a knife in stepShots — wins, though a glob after it in the same tick killed the hero)
    if (this.boss.hp <= 0 && (this.bossFell || !this.player.dead)) this.setState("won");
    else if (this.player.dead) this.setState("lost");
    return this.events;
  }

  /**
   * The bell entrance. "bell": the hero walks the empty garden (no items: nothing to use them on) and
   * strikes the bell with the sword; "entrance": the bell rings, the boss leaps in from beyond the
   * back wall on a high arc (drawn by leap3d.js from `move.airborne` and `move.apex`), lands ahead
   * of the hero with a heavy shake, and the hero reels a few steps back; then the name card.
   */
  stepEntrance(intent, dt) {
    const E = FIGHT.entrance;
    const p = this.player;
    const b = this.boss;
    const bell = this.bell;
    const still = this.still;
    still.aim = p.face;
    // (through her opening the hero walks free — its wall of fire is an attack to step out of, its burning ground lasts)
    // (held still while her name card shows, as in any name card)
    const free = this.state === "bell" || (this.opening && this.introT == null);
    stepPlayer(p, free ? { ...intent, slot0: false, slot1: false } : still, dt, this, this.events);
    this.blockBell();
    if (this.state === "bell") {
      const arc = swingArc(p);
      if (arc) {
        if (bladeHits(arc, bell.x, bell.y, bell.r)) {
          bell.struckAt = this.stateT;
          this.events.push({ t: "bell", x: bell.x, y: bell.y, a: arc.a });
          // (the Drowned Hall's is a small hand bell on a post: its own small ring; the big one answers it below)
          this.sound(this.arena.bell?.small ? "bellSmall" : "bell");
          this.shake(5);
          this.hitstop = 0.07;
          this.setState("entrance");
        }
      }
    } else if (this.opening) this.stepOpening(dt);
    else {
      const t = this.stateT;
      // The big bell answers the small one (the Drowned Hall, content/arenas.js "hall".bell.answer; the owner's pick, 2026-10-19:
      // "the hero rings the SMALL bell, and the BIG bell answers"): its hum swells under the small bell's ring, then its boom —
      // and the King comes after it (bell.ring, past the boom, in place of FIGHT.entrance.ring)
      const ans = this.arena.bell?.answer;
      if (ans && !bell.hummed && t >= ans.hum) (bell.hummed = true), this.sound("bellHum");
      if (ans && !bell.answered && t >= ans.boom) {
        bell.answered = true;
        this.events.push({ t: "bellAnswer", x: ans.at[0], y: ans.at[1] });
        this.sound("bellBoom");
        this.shake(7);
      }
      if (b.hidden && t >= (this.arena.bell?.ring ?? E.ring)) {
        // Where he lands: beside the hero across the screen (to whichever side leans to the middle of
        // the garden), a little toward the middle — never between him and the camera, where the toad
        // hid him — from beyond the back wall.
        const right = [Math.SQRT1_2, -Math.SQRT1_2];
        const side = -p.x * right[0] - p.y * right[1] >= 0 ? 1 : -1;
        const cl = Math.hypot(p.x, p.y) || 1;
        // (an arena's own bell stands at its edge — the Bog Shrine's at the top of its steps, where across the screen is
        // the narrow platform: there he comes down into the clearing before the hero, toward its middle)
        const own = !!this.arena.bell;
        let ax = own ? -p.x / cl : right[0] * side + (-p.x / cl) * 0.35;
        let ay = own ? -p.y / cl : right[1] * side + (-p.y / cl) * 0.35;
        const n = Math.hypot(ax, ay);
        let lx = p.x + (ax / n) * E.landAhead;
        let ly = p.y + (ay / n) * E.landAhead;
        const land = { x: lx, y: ly };
        this.arena.keep(land, b.r + 8);
        (lx = land.x), (ly = land.y);
        // From outside the arena (the owner, 2026-10-15: "Gnashers entry is real bad, he needs to come from out of the
        // arena" — he took off from the middle of the clearing; then from the screen's side he was off it nearly the whole
        // leap): on the hero's line through where he lands, beyond the floor's edge — out of the water in front — he leaps
        // in at the hero, the camera holding the hero and that spot (fight.js), and comes down already facing him.
        const ux = (lx - p.x) / (Math.hypot(lx - p.x, ly - p.y) || 1), uy = (ly - p.y) / (Math.hypot(lx - p.x, ly - p.y) || 1);
        let d = 0;
        for (; d < 600; d += 4) {
          // (marched out from the landing until the floor's edge stops him, then E.fromOut further)
          const o = { x: lx + ux * d, y: ly + uy * d };
          this.arena.keep(o, 0);
          if (Math.hypot(o.x - (lx + ux * d), o.y - (ly + uy * d)) > 1) break;
        }
        b.x = lx + ux * (d + E.fromOut);
        b.y = ly + uy * (d + E.fromOut);
        b.entryFrom = [b.x, b.y];
        b.jumpTo = [lx, ly];
        b.face = Math.atan2(ly - b.y, lx - b.x);
        b.move = { id: "entrance", airborne: [0, E.leap], apex: E.apex, beats: [{ at: E.leap }] };
        b.moveT = 0;
        b.hidden = false;
        b.airborne = true;
        // (a boss without a leap of his own plays his own clips for it — the Drowned King: his anchor raised as he comes up out
        // of the sea, slammed down as he lands, a call at the hero for the roar; content/bosses.js entranceClips)
        this.clip(b, this.spec.entranceClips?.leap ?? "leap");
        this.sound(this.spec.entranceSounds?.leap ?? "hop");
        this.events.push({ t: "entranceLeap", x: b.x, y: b.y });
      }
      if (b.move?.id === "entrance") {
        b.moveT += dt;
        // (across the screen facing where he flies, then over the second half of the leap turned to the hero: he lands
        // already looking at him, no turn on the ground)
        const u = Math.min(1, Math.max(0, (b.moveT / E.leap - 0.45) / 0.45));
        const fly = Math.atan2(b.jumpTo[1] - b.entryFrom[1], b.jumpTo[0] - b.entryFrom[0]);
        const look = Math.atan2(p.y - b.jumpTo[1], p.x - b.jumpTo[0]);
        let dA = look - fly;
        dA = Math.atan2(Math.sin(dA), Math.cos(dA));
        b.face = fly + dA * u * u * (3 - 2 * u);
        if (reached(b.moveT, E.leap)) {
          b.x = b.jumpTo[0];
          b.y = b.jumpTo[1];
          b.jumpTo = null;
          b.move = null;
          b.moveT = 0;
          b.airborne = false;
          b.landedAt = t;
          b.face = Math.atan2(p.y - b.y, p.x - b.x);
          this.clip(b, this.spec.entranceClips?.land ?? "land");
          this.shake(22);
          this.hitstop = 0.09;
          this.sound(this.spec.entranceSounds?.land ?? "arrive"); // (his own, heavier than a hop's landing: the owner, 2026-10-09)
          this.events.push({ t: "entrance", x: b.x, y: b.y });
          staggerPlayer(p, b.x, b.y, E.stagger, E.staggerTime);
          p.face = Math.atan2(b.y - p.y, b.x - p.x);
        }
      }
      if (b.landedAt != null && t >= b.landedAt + E.settle) {
        this.clip(b, "idle");
        this.setState("intro");
      } else if (b.landedAt != null && !b.roared && t >= b.landedAt + E.roarAt) {
        // (landed, he croaks at the hero, mouth wide: the owner, 2026-10-15: "when he lands he could do a big croak sound
        // while opening his mouth")
        b.roared = true;
        this.clip(b, this.spec.entranceClips?.roar ?? "roar");
        this.sound(this.spec.entranceSounds?.roar ?? "roar");
        this.shake(6);
      }
    }
    b.clipT += dt;
    this.stepFloaters(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
  }

  /**
   * Sister Cinder's opening, from the bell's strike (content/bosses.js "opening": its beats, in seconds from the strike): her
   * bubble pops as the bell's ring reaches her, she rises and spins in a charge of fire, the wall's mark is laid from her down
   * the floor to the arena's `wall` end, it goes live as she thrusts it out and leaves burning ground along it, she sinks to her
   * feet, and the fight starts; her name card shows between her spin and her wall. Its marks run on the fight's own rules (stepHazards); the hero walks free (stepEntrance).
   */
  stepOpening(dt) {
    const O = this.opening;
    const b = this.boss;
    const t = this.stateT;
    if (!b.popped && t >= O.pop) {
      b.popped = true;
      this.bubble = null;
      this.events.push({ t: "bubblePop", x: b.x, y: b.y });
      this.events.push({ t: "wake", x: b.x, y: b.y, speed: O.shock.speed });
      this.sound("bubblePop");
      this.sound("emberBoom"); // (her waking's weight: a deep boom under the pop)
      this.shake(16);
      this.hitstop = 0.09; // (Gnasher's landing's)
      this.clip(b, "opening"); // (one clip from here to the end — the owner's video of it, boss-profiles.js till then)
      b.clipT = t - O.pop;
    }
    // her waking's shockwave, rolling out over the floor: the hero staggered back from her where it reaches him (Gnasher's
    // landing does it at once — stepEntrance — but he lands beside the hero; she wakes across the floor)
    const p = this.player;
    if (b.popped && !b.shocked && (t - O.pop) * O.shock.speed >= Math.hypot(p.x - b.x, p.y - b.y)) {
      b.shocked = true;
      if (!inAir(p)) {
        staggerPlayer(p, b.x, b.y, O.shock.push, O.shock.time);
        p.face = Math.atan2(b.y - p.y, b.x - p.x);
        this.shake(6);
        this.events.push({ t: "shockHit", x: p.x, y: p.y });
      }
    }
    // her name card, after her spin and before her wall (the fight screen shows it by introT, FIGHT.intro long)
    this.introT = t >= O.card && t < O.card + FIGHT.intro ? t - O.card : null;
    if (!b.charging && t >= O.spin[0]) {
      b.charging = true;
      this.sound("charge");
    }
    const W = this.arena.bell.wall;
    if (!b.marked && t >= O.mark) {
      b.marked = true;
      const a = Math.atan2(W[1] - b.y, W[0] - b.x);
      b.face = a;
      const w = O.wall;
      b.wallH = this.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len: Math.hypot(W[0] - b.x, W[1] - b.y), w: w.w, tele: O.fire - O.mark, active: w.active, fade: w.fade, dmg: w.dmg, tag: "wall" });
    }
    // (on the tick its mark goes live — after stepHazards below — so its shake, its sound and its burning ground land with it)
    this.stepHazards(dt);
    if (!b.fired && b.wallH && phaseOf(b.wallH) !== "tele") {
      b.fired = true;
      this.shake(12);
      this.sound("fireWall");
      // its burning ground: her lanes' (content/bosses.js lanes), every so far along it
      const B = O.burn, h = b.wallH;
      for (let d = B.every * 0.6; d < h.len - 6; d += B.every) this.hazard({ kind: KIND.CIRCLE, x: h.x + Math.cos(h.a) * d, y: h.y + Math.sin(h.a) * d, r: B.r, tele: B.tele, active: B.active, fade: B.fade, dmg: B.dmg, every: B.tick, style: "cold", tag: "burn" });
    }
    // she comes down from the altar to where every other fight starts her (the floor's middle) as she sinks to her feet: left
    // on the altar she held its corner the whole fight — her drift keeps her from the hero, and the altar is a dead end — and the
    // bots took 10 to 30 points less of her (.scratch/cinder-polish/probe/openbal.mjs)
    if (b.fired && b.home && t >= O.descend[0]) {
      const u = Math.min(1, (t - O.descend[0]) / (O.descend[1] - O.descend[0])), e = u * u * (3 - 2 * u);
      const [sx, sy] = this.arena.bell.seat;
      b.x = sx + (b.home[0] - sx) * e;
      b.y = sy + (b.home[1] - sy) * e;
      b.face = Math.atan2(this.player.y - b.y, this.player.x - b.x);
    }
    if (b.popped) this.bodyBlock();
    if (t >= O.end) {
      b.immune = false;
      b.wallH = null;
      this.opening = null;
      this.introT = null;
      this.clip(b, "idle");
      this.setState("fight"); // (her name card has been: sim/world.js above)
    }
  }

  /** The bell and its post are solid (a bell entrance): nothing walks through them — nor Sister Cinder's bubble while it stands. */
  blockBell() {
    if (this.bubble) {
      const o = this.player, q = this.bubble, touch = q.r + PLAYER.radius, d = Math.hypot(o.x - q.x, o.y - q.y);
      if (d < touch) {
        const a = d > 1e-6 ? Math.atan2(o.y - q.y, o.x - q.x) : Math.PI / 2;
        o.x = q.x + Math.cos(a) * touch;
        o.y = q.y + Math.sin(a) * touch;
      }
    }
    if (!this.bell) return;
    const out = (o, r) => {
      for (const [x, y, sr] of this.bell.solids) {
        const touch = sr + r;
        const d = Math.hypot(o.x - x, o.y - y);
        if (d < touch) {
          const a = d > 1e-6 ? Math.atan2(o.y - y, o.x - x) : Math.PI / 4;
          o.x = x + Math.cos(a) * touch;
          o.y = y + Math.sin(a) * touch;
        }
      }
    };
    out(this.player, PLAYER.radius);
    // (sealed, her bubble kept off the bell: sat over it, it walled the bell off from the hero who must strike it)
    if (!this.boss.hidden && !this.boss.airborne) out(this.boss, this.boss.sealed ? this.bubble.r : this.boss.body);
  }

  /**
   * Sister Cinder seals herself in her bubble (content/bosses.js cinder.moves.seal, its `seal` beat): blows glance off it
   * (resolveSwing, hitBossFlat: a "ward", not a clang), it goes with her (stepSeal) and is solid to the hero (blockBell), and she
   * fights on from inside it until the bell is struck (strikeBell).
   */
  seal(b) {
    if (b.sealed || !this.bell) return;
    b.sealed = true;
    b.immune = true;
    b.unsealAt = null;
    this.bubble = { x: b.x, y: b.y, r: BUBBLE_R, at: this.time };
    this.events.push({ t: "seal", x: b.x, y: b.y });
    this.say("Sealed — strike the bell.");
  }

  /** Her bubble goes with her; the bell's ring reaching her pops it (strikeBell). */
  stepSeal() {
    const b = this.boss;
    if (!b.sealed) return;
    this.bubble.x = b.x;
    this.bubble.y = b.y;
    if (b.unsealAt != null && reached(this.time, b.unsealAt)) this.unseal();
  }

  /** Popped: as in her opening (the "bubblePop" event), with a smaller shockwave ("wake", small, view only) and no stagger of the
   *  hero — she was not asleep in it, she was fighting; open to blows again at once, not to be sealed again for `seal.rest` s. */
  unseal() {
    const b = this.boss, q = this.bubble, S = this.sealMove.seal;
    b.sealed = false;
    b.unsealAt = null;
    const m = b.move;
    b.immune = !!(m?.immune && within(b.moveT, m.immune[0], m.immune[1]));
    this.bubble = null;
    b.sealRest = this.time + S.rest;
    this.events.push({ t: "bubblePop", x: q.x, y: q.y });
    this.events.push({ t: "wake", x: q.x, y: q.y, speed: S.shock, small: true });
    this.sound("bubblePop");
    this.shake(8);
    this.freeze(0.06);
  }

  /** A blow glancing off her bubble (blade, knife or spell): nothing taken, shown — the film ripples where it was struck, its
   *  own glassy ring (cinder3d.js ward, audio.js bubbleWard) and a "Sealed" over it, at most one a 0.5 s. */
  ward(x, y, a) {
    this.events.push({ t: "ward", x, y, a });
    this.sound("bubbleWard");
    this.freeze(FEEL.clang.stop);
    this.shake(FEEL.clang.shake);
    const b = this.boss;
    if (!(this.time - (b.wardSaid ?? -9) < 0.5)) {
      b.wardSaid = this.time;
      this.floaters.push({ x, y: y - 14, v: "Sealed", kind: "shield", t: 0 });
    }
  }

  /**
   * The bell struck in the fight (her floor's, solid and strikeable in every fight with a seal: the constructor): it swings and
   * rings, and if she is sealed its ring pops her bubble `seal.ring` s later, as it reaches her. Once a swing.
   */
  strikeBell() {
    const bell = this.bell, p = this.player;
    if (!bell || !this.sealMove || p.hitThisSwing?.has("bell")) return;
    const arc = swingArc(p);
    if (!arc || !bladeHits(arc, bell.x, bell.y, bell.r)) return;
    p.hitThisSwing.add("bell");
    bell.struckAt = this.time;
    this.events.push({ t: "bell", x: bell.x, y: bell.y, a: arc.a });
    this.sound("bell");
    this.shake(5);
    this.freeze(0.07);
    const b = this.boss;
    if (b.sealed && b.unsealAt == null) b.unsealAt = this.time + this.sealMove.seal.ring;
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    if (s === "won" || s === "lost") this.endBuffs();
    if (s === "won") {
      this.boss.dying = 0;
      this.clip(this.boss, "dead");
      this.sound("bell");
      this.sound("bossDeath"); // (his last croak, 2026-10-09)
      this.shake(FEEL.kill.shake);
      this.freeze(FEEL.kill.stop);
      if (FEEL.kill.slow > 0) this.slow = FEEL.kill.slow; // (the killing blow in slow motion, easing back: stepDying)
      this.events.push({ t: "bossDeath", x: this.boss.x, y: this.boss.y });
    }
    if (s === "lost") {
      this.sound("death");
      this.slow = 0.22;
    }
  }

  /**
   * The chest after a win (FIGHT.chest). "won": the boss's body fades and the hero holds his victory; `wait` s in, the
   * chest falls from the sky where the boss fell (on the floor, `clear` from the hero) and the floor is cleared of what
   * is left (marks, shots, flies). It lands `drop` s later: "chest", the hero walks free (nothing can hurt him now)
   * and a blow of the blade opens it: "looted", the hero's swing plays out with no new input, and the fight screen
   * puts the result card up `open` s later. The run's result was settled at the kill (fight.js): none of this counts.
   */
  stepChest(intent, dt) {
    const C = FIGHT.chest;
    const p = this.player;
    if (this.state === "won") {
      if (!this.chest && this.stateT >= C.wait) {
        const b = this.boss;
        const keep = () => {
          const o = { x, y };
          this.arena.keep(o, C.r + 24);
          (x = o.x), (y = o.y);
        };
        let x = b.x;
        let y = b.y;
        keep();
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < C.clear) {
          // (off the hero: on along the line from him, or, from his own spot, the way he faces)
          const a = d > 1e-3 ? Math.atan2(y - p.y, x - p.x) : p.face;
          x = p.x + Math.cos(a) * C.clear;
          y = p.y + Math.sin(a) * C.clear;
          keep();
        }
        this.chest = { x, y, r: C.r, t: 0, landed: false, openAt: null };
        for (const a of this.adds)
          if (a.alive) {
            a.alive = false;
            a.dying = 0;
            this.events.push({ t: "pop", x: a.x, y: a.y, kind: a.type });
          }
        this.hazards = [];
        this.shots = [];
        this.events.push({ t: "chest", x, y });
      }
      if (this.chest) {
        this.chest.t += dt;
        if (this.chest.t >= C.drop) {
          this.chest.landed = true;
          this.events.push({ t: "chestLand", x: this.chest.x, y: this.chest.y });
          this.sound("chestLand");
          this.shake(8);
          this.setState("chest");
        }
      }
      return;
    }
    const c = this.chest;
    c.t += dt;
    const still = this.still;
    still.aim = p.face;
    stepPlayer(p, this.state === "chest" ? { ...intent, slot0: false, slot1: false } : still, dt, this, this.events);
    // (solid, as the bell is)
    const touch = c.r + PLAYER.radius;
    const dd = Math.hypot(p.x - c.x, p.y - c.y);
    if (dd < touch) {
      const a = dd > 1e-6 ? Math.atan2(p.y - c.y, p.x - c.x) : Math.PI / 4;
      p.x = c.x + Math.cos(a) * touch;
      p.y = c.y + Math.sin(a) * touch;
    }
    if (this.state === "chest") {
      const arc = swingArc(p);
      if (arc && bladeHits(arc, c.x, c.y, c.r)) {
        c.openAt = c.t;
        this.events.push({ t: "chestOpen", x: c.x, y: c.y, a: arc.a });
        this.sound("chestOpen");
        this.sound("chestMusic");
        this.shake(10);
        this.hitstop = 0.08;
        this.setState("looted");
      }
    }
    this.stepFloaters(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
  }

  stepDying(dt) {
    this.boss.clipT += dt;
    this.stepFloaters(dt);
    for (const h of this.hazards) stepHazard(h, dt);
    compact(this.hazards, notDone);
    this.shakeAmt = Math.max(0, this.shakeAmt - 30 * dt);
    if (this.state === "lost" || this.state === "won") this.slow = Math.min(1, this.slow + dt * 0.5);
  }

  stepBossIdle(dt) {
    this.boss.clipT += dt;
  }

  // -------------------------------------------------------------------------------------------
  // Boss: phases, the move scheduler, and drifting toward or away from the player.
  // -------------------------------------------------------------------------------------------
  stepBoss(dtRaw) {
    const dt = dtRaw * this.slowField;
    const b = this.boss;
    const spec = this.spec;
    b.clipT += dt;
    if (b.flash > 0) b.flash -= dt;

    // Phase changes, announced once each.
    const frac = b.hp / b.hpMax;
    let ph = 0;
    for (let i = 0; i < spec.phases.length; i++) if (frac <= spec.phases[i].at) ph = i;
    if (ph > b.phase) {
      b.phase = ph;
      const line = spec.phases[ph].line;
      if (line) this.say(line);
      this.sound("phase");
      this.shake(FEEL.phase.shake);
      this.freeze(FEEL.phase.stop);
      this.events.push({ t: "phase", x: b.x, y: b.y, phase: ph });
      // A phase change clears the floor, so you are never killed by the change itself.
      for (const h of this.hazards) if (phaseOf(h) === "tele") h.done = true;
      // (the move ends as a poise break ends one — hitBoss: left on, a croak cut short kept its cast bar, a veil its
      // immunity and a hop its airborne until the next move started)
      b.move = null;
      b.casting = null;
      b.immune = !!b.sealed; // (sealed in her bubble she stays so: unseal)
      b.airborne = false;
      b.jumpTo = null;
      this.clip(b, "idle");
      b.gap = 0.8;
      b.stagger = 0;
      b.poise = b.poiseMax;
    }

    if (this.debug.freezeBoss) return;
    if (b.stagger > 0) {
      b.stagger -= dt;
      b.immune = false;
      b.airborne = false; // knocked out of a leap, it is on the ground: solid, and open to hits
      if (b.stagger <= 0) {
        this.clip(b, "idle");
        b.poise = b.poiseMax;
        b.gap = 0.5;
      }
      return;
    }

    if (b.move) {
      const m = b.move;
      // A beat fires on the tick its moment is passed: from < at <= moveT. On a move's first tick
      // `from` stands just before zero, so a beat at 0 fires too — with a plain `from = 0` it never
      // did, and Gnasher's lash drew nothing and hit nothing. (reached: a beat at 0.45 s is the 27th tick, not the 28th)
      const from = b.moveT > 0 ? b.moveT : -1;
      b.moveT += dt;
      for (const beat of m.beats) if (!reached(from, beat.at) && reached(b.moveT, beat.at)) beat.do(this, b);

      // --- tracking, then commitment -----------------------------------------------------------
      // A Souls boss turns to follow you while it winds up and then *stops*, so the moment it
      // commits is the moment you can move. Knowing when that moment is, for each attack, is the
      // whole of learning a fight — so it has to be a property of the move, not a global.
      if (m.track != null && !reached(b.moveT, m.track)) {
        const want = this.aimAtPlayer();
        const rate = (m.trackRate ?? 3.2) * dt;
        b.face += clamp(angleDiff(b.face, want), -rate, rate);
        // A mark laid with `follow` is drawn from him along his facing, and turns with him until
        // he commits — so the floor never shows a line his body has already turned away from.
        // It also stops, for good, half a second before it goes live, counted on the mark's own
        // clock: Frost Nova slows his tracking but not the mark's wind-up, and following to the
        // end of a slowed track left the lash locked for 0.15 s.
        for (const h of this.hazards) {
          if (!h.follow || phaseOf(h) !== "tele") continue;
          if (reached(h.t, h.tele - 0.5)) { // (reached: 18 ticks of 1/60 add up to 0.29999…)
            h.follow = false;
            continue;
          }
          h.a = b.face;
          h.x = b.x;
          h.y = b.y;
        }
      }

      // --- root motion ---------------------------------------------------------------------------
      // The boss is carried by its own animation: a lunge travels, a backstep retreats. Without
      // this an attack is a decal that appears near a statue; with it the attack is the boss
      // arriving.
      if (m.motion) {
        for (const seg of m.motion) {
          const t0 = Math.max(from, seg.at);
          const t1 = Math.min(b.moveT, seg.at + seg.dur);
          if (t1 <= t0) continue;
          const ease = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), seg.pow ?? 2.4);
          const k = ease((t1 - seg.at) / seg.dur) - ease((t0 - seg.at) / seg.dur);
          const a = b.face + (seg.turn || 0);
          b.x += Math.cos(a) * seg.dist * k;
          b.y += Math.sin(a) * seg.dist * k;
        }
      }
      b.airborne = !!(m.airborne && within(b.moveT, m.airborne[0], m.airborne[1]));
      b.immune = !!(m.immune && within(b.moveT, m.immune[0], m.immune[1])) || !!b.sealed;
      // A cast is a window you can break with enough damage.
      b.casting = m.cast && within(b.moveT, m.cast.from, m.cast.to) ? { name: m.cast.name, k: (b.moveT - m.cast.from) / (m.cast.to - m.cast.from) } : null;
      if (reached(b.moveT, m.dur)) {
        b.move = null;
        b.casting = null;
        b.immune = !!b.sealed;
        b.airborne = false;
        this.clip(b, "idle");
        const [lo, hi] = spec.gap;
        b.gap = (lo + this.bossRand() * (hi - lo)) * (spec.phases[b.phase].gapScale || 1) * (m.recover ? 1 : 0.6) * (this.enraged ? 0.55 : 1) * (this.frenzied ? 0.6 : 1);
      }
    } else {
      b.gap -= dt;
      if (b.gap <= 0) this.startMove();
      // Between moves he closes the distance, or keeps it.
      const p = this.player;
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const want = spec.drift ? 120 : 62;
      const sgn = d > want + 18 ? 1 : d < want - 18 ? -1 : 0;
      const sp = spec.moveSpeed * (this.enraged ? 1.3 : 1) * (this.frenzied ? 1.35 : 1);
      b.vx = lerp(b.vx, Math.cos(a) * sp * sgn, 0.12);
      b.vy = lerp(b.vy, Math.sin(a) * sp * sgn, 0.12);
      b.face = a;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    this.arena.keep(b, b.r + 6);
    // (damped in a move too: no move sets his velocity — a lunge is root motion, a hop jumpTo — and the walk he started a
    // move with carried him on at full pace through all of it: Gnasher slid 39 units through a croak)
    b.vx *= 0.9;
    b.vy *= 0.9;
  }

  /**
   * Standing in the boss pushes you out of it, and that is all. A melee fight has to let you
   * stand in its face; everything that hurts is drawn on the floor first. The one exception is
   * the enrage, where simply being near it is meant to kill you.
   *
   * Its own step, so it holds while the boss is staggered or frozen too — a reeling boss is still
   * something you cannot walk through.
   */
  bodyBlock() {
    const b = this.boss;
    const p = this.player;
    const pd = Math.hypot(p.x - b.x, p.y - b.y);
    const touch = b.body + PLAYER.radius;
    if (pd < touch && !b.airborne) {
      const a = Math.atan2(p.y - b.y, p.x - b.x) || 0;
      p.x = b.x + Math.cos(a) * touch;
      p.y = b.y + Math.sin(a) * touch;
      if (this.enraged && this.spec.contact) this.damagePlayer(this.spec.contact * 2, b.x, b.y); // (the sound: its "hurt" event, fight.js)
    }
  }

  /** The parts of the week's affix that need a hand in every tick rather than a one-off change. */
  stepAffix(dt) {
    const a = this.affix;
    if (!a) return;
    this.affixT += dt;
    if (a.volcanic && this.affixT >= a.volcanic) {
      // The ground erupts under you: a slow circle, so it moves you rather than kills you.
      this.affixT = 0;
      const p = this.player;
      this.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 26, tele: 1.1, active: 0.14, fade: 0.3, dmg: 16, tag: "volcanic" });
    }
    if (a.swarm && this.affixT >= a.swarm) {
      this.affixT = 0;
      const ang = this.rand() * TAU;
      const kind = this.spec.arena === "ash" ? "ember" : this.spec.arena === "hall" ? "hand" : "fly";
      this.add(kind, ...this.arena.edge(ang, 8));
    }
    if (a.frenzy && !this.frenzied && this.boss.hp / this.boss.hpMax < 1 / 3) {
      // Faster between moves and faster on its feet. The moves themselves keep their timings, so
      // every telegraph still lasts as long as it ever did.
      this.frenzied = true;
      this.say(`${this.spec.name} is frenzied.`);
      this.sound("enrage");
      this.shake(8);
    }
  }

  startMove() {
    const b = this.boss;
    const spec = this.spec;
    const names = (this.phaseMoves[b.phase] ||= spec.phases[b.phase].moves.filter((n) => spec.moves[n]));
    // (one pass: what the phase allows now, and of that what was not just used)
    const allowed = [];
    const pool = [];
    for (const n of names) {
      const m = spec.moves[n];
      if (m.once && (b.used[n] || 0) >= m.once) continue;
      if (m.minHp && b.hp / b.hpMax < m.minHp) continue;
      // (her seal: never while sealed, nor within its rest after a pop, nor with no bell to answer it — and sealed, no move that
      // makes her immune itself, the veil: she is already, and its ash would hide her bubble)
      if (m.seal && (b.sealed || !this.bell || this.time < (b.sealRest ?? 0))) continue;
      if (b.sealed && m.immune) continue;
      allowed.push(n);
      if (n !== b.lastMove) pool.push(n);
    }
    const list = pool.length ? pool : allowed;
    if (!list.length) return;
    let total = 0;
    for (const n of list) total += spec.moves[n].weight || 1;
    let r = this.bossRand() * total;
    let chosen = list[0];
    for (const n of list) {
      r -= spec.moves[n].weight || 1;
      if (r <= 0) {
        chosen = n;
        break;
      }
    }
    const m = spec.moves[chosen];
    b.move = m;
    b.moveT = 0;
    b.lastMove = chosen;
    b.used[chosen] = (b.used[chosen] || 0) + 1;
    this.clip(b, m.clip || "idle");
    this.events.push({ t: "move", name: chosen });
  }

  // -------------------------------------------------------------------------------------------
  // Adds, shots, hazards
  // -------------------------------------------------------------------------------------------
  stepAdds(dtRaw) {
    const dt = dtRaw * this.slowField;
    const p = this.player;
    for (const a of this.adds) {
      if (a.flash > 0) a.flash -= dt;
      if (!a.alive) {
        a.dying += dt;
        continue;
      }
      a.t += dt;
      if (a.spawn > 0) {
        a.spawn -= dt;
        continue;
      }
      const ang = Math.atan2(p.y - a.y, p.x - a.x);
      const sp = a.def.speed * (this.enraged ? 1.25 : 1);
      a.vx = lerp(a.vx, Math.cos(ang) * sp, 0.06);
      a.vy = lerp(a.vy, Math.sin(ang) * sp, 0.06);
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      this.arena.keep(a, a.r);
      if (a.cool > 0) a.cool -= dt;
      if (a.def.dmg && a.cool <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < a.r + PLAYER.radius) {
        if (this.damagePlayer(a.def.dmg, a.x, a.y)) a.cool = a.def.contact; // (the sound: its "hurt" event, fight.js)
      }
    }
    compact(this.adds, addLeft);
  }

  stepShots(dtRaw) {
    const p = this.player;
    const b = this.boss;
    // (the boss's shots crawl under Frost Nova as he and his adds do — slowField; the hero's own fly at full pace)
    const slowed = dtRaw * this.slowField;
    for (const s of this.shots) {
      const dt = s.tag === "friendly" ? dtRaw : slowed;
      s.life -= dt;
      if (s.tag === "friendly") {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.spin += dt * 9;
        if (!b.airborne && !b.immune && Math.hypot(b.x - s.x, b.y - s.y) < s.r + b.r) {
          this.hitBossFlat(s.dmg, s.x, s.y);
          if (s.burn) this.hazard({ kind: KIND.CIRCLE, x: s.x, y: s.y, r: 26, tele: 0.1, active: 3.2, fade: 0.3, dmg: 0, every: 0.6, style: "safe", tag: "friendlyField", friendly: 7 });
          s.dead = true;
          continue;
        }
        let struck = false;
        for (const a of this.adds) if (a.alive && Math.hypot(a.x - s.x, a.y - s.y) < s.r + a.r) { this.hurtAdd(a, s.dmg); struck = true; break; }
        if (struck || this.arena.out(s.x, s.y) > this.shotSpan || s.life <= 0) s.dead = true;
        continue;
      }
      if (s.homing) {
        const want = Math.atan2(p.y - s.y, p.x - s.x);
        const cur = Math.atan2(s.vy, s.vx);
        const na = cur + clamp(angleDiff(cur, want), -s.homing * dt, s.homing * dt);
        s.vx = Math.cos(na) * s.speed;
        s.vy = Math.sin(na) * s.speed;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += dt * 6;
      if (this.arena.out(s.x, s.y) > this.shotSpan || s.life <= 0) s.dead = true;
      else if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + PLAYER.radius) {
        if (this.damagePlayer(s.dmg, s.x, s.y)) {
          s.dead = true;
          this.events.push({ t: "burst", x: s.x, y: s.y, art: s.art });
          this.sound("splat");
        } else if (p.iFrames > 0) {
          // Rolled through it: the shot still passes, but it looks like a near miss.
          this.events.push({ t: "graze", x: s.x, y: s.y });
        }
      }
    }
    compact(this.shots, notDead);
  }

  stepHazards(dt) {
    const p = this.player;
    for (const h of this.hazards) {
      // A brand-new hazard counts as coming out of its wind-up, so one with no wind-up at all (a
      // ripple, Frost Nova) still announces that it went off.
      const was = h.t === 0 ? "tele" : phaseOf(h);
      stepHazard(h, dt);
      if (was === "tele" && phaseOf(h) === "active") this.events.push({ t: "fire", h });
      if (h.friendly) {
        const b = this.boss;
        // (h.cool counts down in stepHazard alone: a second count here ran Caltrops' 0.7 s at 0.35, 23 bites in 8 s, not 11)
        const ready = !h.every || h.cool <= 0;
        if (ready && !b.airborne && !b.immune && phaseOf(h) === "active" && !h.hitBoss && hits(h, b.x, b.y, b.r)) {
          if (h.every) h.cool = h.every;
          else h.hitBoss = true;
          this.hitBossFlat(h.friendly, b.x, b.y - 10);
        }
        for (const a of this.adds) if (a.alive && this.addHit(h, a)) this.hurtAdd(a, h.friendly);
        continue;
      }
      // (a low attack passes under him while he is up in a jump: once, a "vault" for the view and the ear)
      const over = jumpable(h) && inAir(p) && phaseOf(h) === "active" && hits(h, p.x, p.y, PLAYER.radius);
      if (over && !h.vaulted) {
        h.vaulted = true;
        this.events.push({ t: "vault", x: p.x, y: p.y });
        this.sound("vault");
      }
      const dmg = over ? 0 : damageFor(h, p.x, p.y, PLAYER.radius);
      if (dmg) {
        const [sx, sy] = sourceOf(h, p.x, p.y);
        const got = this.damagePlayer(dmg, sx, sy);
        if (got) {
          // (the sound: its "hurt" event, played by fight.js — a second one here played every hurt twice)
          // (a parry, a block or a shield that took it all stops the chain too: it dragged him in through a parry)
          if (h.pull && got !== "stopped") {
            // The chain drags you to the far end of itself.
            h.caught = true; // (for the view: the King's chain held on him while he is dragged in, gfx3d/kingchain3d.js)
            const a = h.a + Math.PI;
            p.vx = Math.cos(a) * 520;
            p.vy = Math.sin(a) * 520;
          }
        }
      }
      // Some hazards hurt whatever else is standing in them too.
      if (h.tag === "boom" || h.tag === "storm") {
        for (const a of this.adds) if (a.alive && this.addHit(h, a)) this.hurtAdd(a, h.dmg);
      }
    }
    compact(this.hazards, notDone);
  }

  /**
   * Does hazard h hurt add a this tick? Each add keeps its own count with each hazard — once, or once every h.every s —
   * apart from the hero's (h.hitOnce, h.cool) and the boss's: on the shared count an ember caught in a boom spent it and
   * the hero in it went unhurt, and with only the last field's id on the add two fields overlapping hurt it every tick
   * (1001 damage in 2 s, not 55).
   */
  addHit(h, a) {
    if (phaseOf(h) !== "active" || !hits(h, a.x, a.y, a.r)) return false;
    const seen = (h.addHits ||= new Map());
    const at = seen.get(a);
    if (at != null && (!h.every || !reached(h.t - at, h.every))) return false;
    seen.set(a, h.t);
    return true;
  }

  stepFloaters(dt) {
    for (const f of this.floaters) f.t += dt;
    compact(this.floaters, floating);
  }

  // -------------------------------------------------------------------------------------------
  // Damage
  // -------------------------------------------------------------------------------------------
  damagePlayer(dmg, fromX, fromY) {
    if (this.debug.god) return false;
    if (this.affix?.hardHits) dmg *= this.affix.hardHits; // Brittle: it staggers sooner, and hits harder
    let scaled = this.enraged ? dmg * (1 + clamp((this.time - FIGHT.enrage) / FIGHT.enrageRamp, 0, 1) * 5) : dmg;
    const p0 = this.player;
    if (p0.state === STATE.GUARD && p0.iFrames <= 0 && !p0.dead) {
      const g = this.guard(p0, scaled, fromX, fromY);
      if (g === "stopped") return "stopped";
      if (g != null) scaled = g;
    }
    if (p0.shield > 0 && p0.iFrames <= 0 && !p0.dead) {
      const soaked = Math.min(p0.shield, scaled);
      p0.shield -= soaked;
      p0.shieldHits = (p0.shieldHits || 0) + 1; // so a shield spent by a hit can be told from one that ran out
      scaled -= soaked;
      this.events.push({ t: "shielded", x: p0.x, y: p0.y });
      this.sound("clang");
      this.floaters.push({ x: p0.x, y: p0.y - 30, v: String(Math.round(soaked)), kind: "shield", t: 0 });
      if (scaled < 1) {
        p0.iFrames = Math.max(p0.iFrames, 0.3);
        return "stopped";
      }
    }
    const before = this.player.hp;
    const landed = hurtPlayer(this.player, scaled, fromX, fromY, this.events);
    if (!landed) return false;
    this.damageTaken += before - this.player.hp;
    this.hitsTaken++;
    this.blessing?.onHurt?.(this, this.player);
    this.clean = false;
    this.freeze(stopFor(FEEL.taken, scaled));
    this.shake(shakeFor(FEEL.taken, scaled));
    this.floaters.push({ x: this.player.x, y: this.player.y - 26, v: `-${Math.round(scaled)}`, kind: "taken", t: 0 });
    return true;
  }

  /**
   * A hit on a raised guard (content/weapons.js `guard`), from the front half: a buckler raised just in time parries
   * it (nothing taken, nothing spent, his guard counter ready); otherwise the guard stops `negate` of it and the
   * rest comes through, and it costs stamina by how hard the hit was against the guard's stability — run dry, the
   * guard breaks (he reels, the rest of the hit lands). Returns "stopped", the damage still to take, or null (not
   * from in front: the guard does nothing).
   */
  guard(p, dmg, fromX, fromY) {
    const g = p.arms.guard;
    const from = Math.atan2(fromY - p.y, fromX - p.x);
    if (Math.abs(angleDiff(p.face, from)) > 1.25) return null;
    if (g.parry > 0 && p.t <= g.parry + TICK_EPS) {
      armCounter(p);
      p.iFrames = Math.max(p.iFrames, 0.25);
      this.events.push({ t: "parry", x: p.x, y: p.y, a: from });
      this.sound("clang");
      if (FEEL.audio.parry) this.sound("parry");
      this.hitstop = Math.max(this.hitstop, FEEL.parry.stop);
      this.shake(FEEL.parry.shake);
      this.floaters.push({ x: p.x, y: p.y - 30, v: "Parry", kind: "shield", t: 0 });
      return "stopped";
    }
    const cost = dmg * Math.max(0.15, 1.6 - g.stability / 60);
    if (cost > p.stamina) {
      // the guard breaks: stamina spent, he reels, what the guard could not hold lands
      p.stamina = 0;
      p.exhausted = true;
      p.staminaWait = PLAYER.exhaustedDelay;
      this.events.push({ t: "guardBreak", x: p.x, y: p.y, a: from });
      this.sound("clang");
      this.freeze(FEEL.guardBreak.stop);
      this.shake(FEEL.guardBreak.shake);
      const rest = dmg * (1 - g.negate * 0.5);
      if (rest < 1) {
        staggerPlayer(p, fromX, fromY, 60, 0.6);
        return "stopped";
      }
      return rest;
    }
    p.stamina -= cost;
    p.staminaWait = PLAYER.staminaDelay;
    armCounter(p);
    this.events.push({ t: "blocked", x: p.x, y: p.y, a: from });
    this.sound("clang");
    this.shake(FEEL.block.shake);
    this.freeze(FEEL.block.stop);
    const through = dmg * (1 - g.negate);
    if (through < 1) {
      p.iFrames = Math.max(p.iFrames, 0.3);
      // pushed back a little behind the guard
      p.vx -= Math.cos(from) * 40;
      p.vy -= Math.sin(from) * 40;
      this.floaters.push({ x: p.x, y: p.y - 30, v: "0", kind: "shield", t: 0 });
      return "stopped";
    }
    return through;
  }

  /** The player's blade, resolved once per tick against the boss and every add. */
  resolveSwing() {
    const p = this.player;
    const arc = swingArc(p);
    if (!arc) return;
    const b = this.boss;
    // The blade must touch the drawn body: the boss's `hurt` ellipse turned with him, an add's circle.
    // (a paired attack's second blade, the off hand's, sweeps its own arc: either one lands the hit)
    const touch = (x, y, al, ac, f) => bladeHits(arc, x, y, al, ac, f) || (arc.alt ? bladeHits(arc.alt, x, y, al, ac, f) : null);
    // (sealed, her bubble's film is what the blade meets: held off by its wall 24 from her middle — blockBell — the sword's 14.3
    // reached 9.7 from it, short of her drawn body's 6.5 in front, and a blow on the bubble showed nothing)
    const at = !p.hitThisSwing.has("boss") && !b.airborne ? (b.sealed ? touch(b.x, b.y, this.bubble.r, this.bubble.r, 0) : touch(b.x, b.y, b.hurt[0], b.hurt[1], b.face)) : null;
    if (at) {
      p.hitThisSwing.add("boss");
      if (b.sealed) this.ward(at.x, at.y, arc.a);
      else if (b.immune) {
        this.events.push({ t: "clang", x: at.x, y: at.y });
        this.sound("clang");
        this.freeze(FEEL.clang.stop);
        this.shake(FEEL.clang.shake);
      } else {
        this.hitBoss(arc, at);
      }
    }
    for (const a of this.adds) {
      if (!a.alive || p.hitThisSwing.has(a)) continue;
      if (!touch(a.x, a.y, a.r, a.r, 0)) continue;
      p.hitThisSwing.add(a);
      this.hurtAdd(a, arc.dmg);
      this.hitstop = Math.max(this.hitstop, FEEL.add.stop);
    }
  }

  hitBoss(arc, at = null) {
    const b = this.boss;
    const p = this.player;
    // (no draw at all with no crit chance: it moved the fight's stream on every blow)
    const crit = p.mods.crit > 0 && this.rand() < p.mods.crit;
    const dmg = this.debug.oneShot ? b.hp : Math.round(arc.dmg * (crit ? 2 : 1) * (b.stagger > 0 ? 1.5 : 1));
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp <= 0 && !this.player.dead) this.bossFell = true;
    b.flash = 0.1;
    this.damageDealt += dmg;
    // (a heavy: the chain's slow finisher, any great weapon's slam, a guard counter)
    const heavy = arc.heavy ?? arc.step === 2;
    const fp = heavy ? FEEL.heavy : FEEL.hit;
    this.freeze(stopFor(fp, dmg) + (crit ? FEEL.crit.stop : 0));
    this.shake(shakeFor(fp, dmg) + (crit ? FEEL.crit.shake : 0));
    this.sound(heavy || (crit && FEEL.audio.crit) ? "hitHeavy" : "hit");
    if (crit && FEEL.audio.crit) this.sound("crit");
    this.sound("bossHurt"); // (his own cry with the blade's — the owner, 2026-10-08: "so that we can hear it get hurt")
    // (the spark where the blade met him)
    const hx = at ? at.x : b.x + Math.cos(arc.a) * b.r * 0.6;
    const hy = (at ? at.y : b.y + Math.sin(arc.a) * b.r * 0.6) - this.spec.hitH * 0.4;
    this.events.push({ t: "hit", x: hx, y: hy, a: arc.a, crit, heavy, dmg });
    this.floaters.push({ x: hx, y: hy, v: String(dmg), kind: crit ? "crit" : b.stagger > 0 ? "crit" : "dmg", t: 0 });
    if (p.mods.lifesteal) {
      p.hp = Math.min(p.hpMax, p.hp + dmg * p.mods.lifesteal);
      this.floaters.push({ x: p.x, y: p.y - 30, v: `+${Math.round(dmg * p.mods.lifesteal)}`, kind: "heal", t: 0 });
    }

    // Poise: enough damage during a cast breaks it, and that is the real opening.
    b.poise -= arc.poise + dmg * 0.45;
    if (b.poise <= 0) {
      b.poise = b.poiseMax;
      if (b.casting || b.move) {
        b.move = null;
        b.casting = null;
        b.immune = false;
        b.stagger = 2.4;
        this.clip(b, "hurt");
        this.say(`${this.spec.name} reels.`);
        this.sound("stagger");
        this.shake(FEEL.stagger.shake);
        this.freeze(FEEL.stagger.stop);
        this.events.push({ t: "stagger", x: b.x, y: b.y, a: arc.a });
        for (const h of this.hazards) if (phaseOf(h) === "tele") h.done = true;
      }
    }
  }

  /** Damage from a bomb, a knife or a spell: no poise, no combo, still a number on screen. */
  hitBossFlat(dmg, x, y) {
    const b = this.boss;
    if (b.sealed && !b.airborne) return this.ward(x, y, Math.atan2(b.y - y, b.x - x));
    if (b.immune || b.airborne) {
      this.events.push({ t: "clang", x: b.x, y: b.y });
      return;
    }
    const d = Math.round(dmg * (b.stagger > 0 ? 1.5 : 1));
    b.hp = Math.max(0, b.hp - d);
    if (b.hp <= 0 && !this.player.dead) this.bossFell = true;
    b.flash = 0.1;
    this.damageDealt += d;
    this.shake(FEEL.flat.shake);
    this.freeze(FEEL.flat.stop);
    this.sound("hit");
    this.sound("bossHurt");
    this.events.push({ t: "hit", x, y, a: Math.atan2(b.y - y, b.x - x), crit: false, dmg: d });
    this.floaters.push({ x, y: y - 8, v: String(d), kind: "dmg", t: 0 });
  }

  hurtAdd(a, dmg) {
    a.hp -= dmg;
    a.flash = 0.1;
    this.floaters.push({ x: a.x, y: a.y - 12, v: String(Math.round(dmg)), kind: "dmg", t: 0 });
    this.events.push({ t: "hit", x: a.x, y: a.y, a: 0, crit: false });
    this.sound("hit");
    if (a.hp <= 0 && a.alive) {
      a.alive = false;
      a.dying = 0;
      this.events.push({ t: "pop", x: a.x, y: a.y, kind: a.type });
      if (a.def.boom) this.hazard({ kind: KIND.CIRCLE, x: a.x, y: a.y, r: a.def.boom[1], tele: 0.5, active: 0.14, fade: 0.25, dmg: a.def.boom[0], tag: "boom" });
    }
  }

  // -------------------------------------------------------------------------------------------
  // What the run is worth when it ends.
  // -------------------------------------------------------------------------------------------
  result() {
    return {
      won: this.state === "won" || this.state === "chest" || this.state === "looted", // (the chest after a win: FIGHT.chest)
      time: this.time,
      hpLeft: Math.max(0, this.player.hp),
      hpMax: this.player.hpMax,
      bossHpLeft: Math.max(0, this.boss.hp),
      bossHpMax: this.boss.hpMax,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      hitsTaken: this.hitsTaken,
      potionsUsed: this.potionsUsed,
      clean: this.clean && this.potionsUsed === 0,
      enraged: this.enraged,
      boss: this.spec.id,
      tier: this.spec.tier,
    };
  }
}
