// The fight itself: one arena, one hero, one boss, and everything either of them puts on the floor.
//
// The sim is deterministic — a fixed 1/60 s tick, a seeded random, and no reading of the clock — so
// the same inputs always give the same fight. That is what will later let the server re-play a run
// instead of believing it, and what lets a death be watched back.
import { ARENA, PLAYER, FIGHT, TICK } from "../config.js?v=8898846";
import { clamp, angleDiff, rng as makeRng, TAU, lerp } from "../util.js?v=8898846";
import { makePlayer, stepPlayer, swingArc, hurtPlayer, staggerPlayer, STATE } from "./player.js?v=8898846";
import { hazard, stepHazard, damageFor, phaseOf, radiusOf, sourceOf, hits, KIND } from "./hazards.js?v=8898846";
import { ITEMS } from "../content/items.js?v=8898846";

const ADDS = {
  fly: { hp: 34, r: 7, speed: 68, dmg: 8, contact: 0.8, art: "fly", gold: 1 },
  ember: { hp: 46, r: 8, speed: 34, dmg: 0, contact: 0, art: "ember", boom: [24, 46], gold: 2 },
  hand: { hp: 70, r: 9, speed: 40, dmg: 14, contact: 1.1, art: "hand", root: 0.7, gold: 2 },
};

export class World {
  /**
   * `debug` is the admin menu's switch panel. The sim reads it but never imports it, so the rules
   * stay testable headlessly and nothing in here depends on there being a screen.
   */
  constructor({ boss, blessing = null, loadout = [null, null], mods = {}, seed = 1, practice = false, debug = null, entrance = false }) {
    this.debug = debug || {};
    this.spec = boss;
    this.rand = makeRng(seed);
    this.practice = practice;
    this.blessing = blessing;
    this.time = 0; // seconds of fight, not counting the intro
    this.state = "intro"; // (bell → entrance →) intro → fight → won | lost
    this.stateT = 0;

    this.player = makePlayer(mods);
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
      hitH: boss.hitH,
      clip: "idle",
      clipT: 0,
      clipOnce: false,
      move: null,
      moveT: 0,
      moveDone: 0,
      gap: FIGHT.intro * 0 + 1.2,
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
      this.bell = { x: E.bell[0], y: E.bell[1], r: E.bellR, struckAt: -1, solids: [[E.bell[0], E.bell[1], E.bellR], [E.bell[0] - Math.SQRT1_2 * reach, E.bell[1] + Math.SQRT1_2 * reach, E.postR]] };
      this.boss.hidden = true;
      this.boss.airborne = true;
    }
    this.hazards = [];
    this.shots = [];
    this.adds = [];
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
    this.log = []; // for the share and for stats
  }

  // -------------------------------------------------------------------------------------------
  // The API the boss scripts call.
  // -------------------------------------------------------------------------------------------
  hazard(opts) {
    const h = hazard(opts);
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
    this.hazard({ kind: KIND.FLOOD, x: 0, y: 0, safe, r: ARENA.R, tele, active, fade: 0.3, dmg: 22, every: 0.6, tag: "flood" });
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
  shake(a) {
    this.shakeAmt = Math.min(22, this.shakeAmt + a);
  }
  /** A timed effect. on() runs now, off() when it expires (or when the fight ends). */
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
  hasBuff(name) {
    return this.buffs.some((b) => b.name === name);
  }
  stepBuffs(dt) {
    for (const b of this.buffs) b.t += dt;
    for (const b of this.buffs) if (b.t >= b.dur) b.off?.(this, this.player);
    this.buffs = this.buffs.filter((b) => b.t < b.dur);
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
    this.bodyBlock();
    this.blockBell();
    this.stepAffix(dt);
    this.stepAdds(dt);
    this.stepShots(dt);
    this.stepHazards(dt);
    this.resolveSwing();
    this.stepFloaters(dt);

    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
    if (this.player.dead) this.setState("lost");
    else if (this.boss.hp <= 0) this.setState("won");
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
    const still = { mx: 0, my: 0, aim: p.face, attack: false, roll: false, slot0: false, slot1: false, pause: false };
    stepPlayer(p, this.state === "bell" ? { ...intent, slot0: false, slot1: false } : still, dt, this, this.events);
    this.blockBell();
    if (this.state === "bell") {
      const arc = swingArc(p);
      if (arc) {
        const dx = bell.x - arc.x;
        const dy = bell.y - arc.y;
        const dd = Math.hypot(dx, dy);
        if (dd <= arc.r + bell.r && (dd < 4 || Math.abs(angleDiff(arc.a, Math.atan2(dy, dx))) <= arc.half + Math.atan2(bell.r, Math.max(6, dd)))) {
          bell.struckAt = this.stateT;
          this.events.push({ t: "bell", x: bell.x, y: bell.y, a: arc.a });
          this.sound("bell");
          this.shake(5);
          this.hitstop = 0.07;
          this.setState("entrance");
        }
      }
    } else {
      const t = this.stateT;
      if (b.hidden && t >= E.ring) {
        // Where he lands: beside the hero across the screen (to whichever side leans to the middle of
        // the garden), a little toward the middle — never between him and the camera, where the toad
        // hid him — from beyond the back wall.
        const right = [Math.SQRT1_2, -Math.SQRT1_2];
        const side = -p.x * right[0] - p.y * right[1] >= 0 ? 1 : -1;
        const cl = Math.hypot(p.x, p.y) || 1;
        let ax = right[0] * side + (-p.x / cl) * 0.35;
        let ay = right[1] * side + (-p.y / cl) * 0.35;
        const n = Math.hypot(ax, ay);
        let lx = p.x + (ax / n) * E.landAhead;
        let ly = p.y + (ay / n) * E.landAhead;
        const ld = Math.hypot(lx, ly);
        const lim = ARENA.R - b.r - 8;
        if (ld > lim) (lx *= lim / ld), (ly *= lim / ld);
        const back = [-Math.SQRT1_2, -Math.SQRT1_2];
        b.x = lx + back[0] * 190 + right[0] * 60 * side;
        b.y = ly + back[1] * 190 + right[1] * 60 * side;
        b.jumpTo = [lx, ly];
        b.face = Math.atan2(ly - b.y, lx - b.x);
        b.move = { id: "entrance", airborne: [0, E.leap], apex: E.apex, beats: [{ at: E.leap }] };
        b.moveT = 0;
        b.hidden = false;
        b.airborne = true;
        this.clip(b, "leap");
        this.sound("hop");
      }
      if (b.move?.id === "entrance") {
        b.moveT += dt;
        if (b.moveT >= E.leap) {
          b.x = b.jumpTo[0];
          b.y = b.jumpTo[1];
          b.jumpTo = null;
          b.move = null;
          b.moveT = 0;
          b.airborne = false;
          b.landedAt = t;
          b.face = Math.atan2(p.y - b.y, p.x - b.x);
          this.clip(b, "land");
          this.shake(22);
          this.hitstop = 0.09;
          this.sound("slam");
          this.events.push({ t: "entrance", x: b.x, y: b.y });
          staggerPlayer(p, b.x, b.y, E.stagger, E.staggerTime);
          p.face = Math.atan2(b.y - p.y, b.x - p.x);
        }
      }
      if (b.landedAt != null && t >= b.landedAt + E.settle) {
        this.clip(b, "idle");
        this.setState("intro");
      }
    }
    b.clipT += dt;
    this.stepFloaters(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
  }

  /** The bell and its post are solid (a bell entrance): nothing walks through them. */
  blockBell() {
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
    if (!this.boss.hidden && !this.boss.airborne) out(this.boss, this.boss.body);
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    if (s === "won") {
      this.boss.dying = 0;
      this.clip(this.boss, "dead");
      this.sound("bell");
      this.shake(14);
    }
    if (s === "lost") {
      this.sound("death");
      this.slow = 0.22;
    }
  }

  stepDying(dt) {
    this.boss.clipT += dt;
    this.stepFloaters(dt);
    for (const h of this.hazards) stepHazard(h, dt);
    this.hazards = this.hazards.filter((h) => !h.done);
    this.shakeAmt = Math.max(0, this.shakeAmt - 30 * dt);
    if (this.state === "lost") this.slow = Math.min(1, this.slow + dt * 0.5);
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
      this.shake(9);
      // A phase change clears the floor, so you are never killed by the change itself.
      for (const h of this.hazards) if (phaseOf(h) === "tele") h.done = true;
      b.move = null;
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
      // did, and Gnasher's lash drew nothing and hit nothing.
      const from = b.moveT > 0 ? b.moveT : -1;
      b.moveT += dt;
      for (const beat of m.beats) if (from < beat.at && b.moveT >= beat.at) beat.do(this, b);

      // --- tracking, then commitment -----------------------------------------------------------
      // A Souls boss turns to follow you while it winds up and then *stops*, so the moment it
      // commits is the moment you can move. Knowing when that moment is, for each attack, is the
      // whole of learning a fight — so it has to be a property of the move, not a global.
      if (m.track != null && b.moveT < m.track) {
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
          if (h.t >= h.tele - 0.5 - 1e-6) { // the epsilon: 18 ticks of 1/60 add up to 0.29999…
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
      b.airborne = !!(m.airborne && b.moveT >= m.airborne[0] && b.moveT < m.airborne[1]);
      b.immune = !!(m.immune && b.moveT >= m.immune[0] && b.moveT < m.immune[1]);
      // A cast is a window you can break with enough damage.
      b.casting = m.cast && b.moveT >= m.cast.from && b.moveT < m.cast.to ? { name: m.cast.name, k: (b.moveT - m.cast.from) / (m.cast.to - m.cast.from) } : null;
      if (b.moveT >= m.dur) {
        b.move = null;
        b.casting = null;
        b.immune = false;
        b.airborne = false;
        this.clip(b, "idle");
        const [lo, hi] = spec.gap;
        b.gap = (lo + this.rand() * (hi - lo)) * (spec.phases[b.phase].gapScale || 1) * (m.recover ? 1 : 0.6) * (this.enraged ? 0.55 : 1) * (this.frenzied ? 0.6 : 1);
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
    const dd = Math.hypot(b.x, b.y);
    const lim = ARENA.R - b.r - 6;
    if (dd > lim) {
      b.x = (b.x / dd) * lim;
      b.y = (b.y / dd) * lim;
    }
    if (!b.move) {
      b.vx *= 0.9;
      b.vy *= 0.9;
    }
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
      if (this.enraged && this.spec.contact && this.damagePlayer(this.spec.contact * 2, b.x, b.y)) this.sound("hurt");
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
      this.add(kind, Math.cos(ang) * (ARENA.R - 8), Math.sin(ang) * (ARENA.R - 8));
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
    const allowed = spec.phases[b.phase].moves.filter((n) => {
      const m = spec.moves[n];
      if (!m) return false;
      if (m.once && (b.used[n] || 0) >= m.once) return false;
      if (m.minHp && b.hp / b.hpMax < m.minHp) return false;
      return true;
    });
    const pool = allowed.filter((n) => n !== b.lastMove);
    const list = pool.length ? pool : allowed;
    if (!list.length) return;
    let total = 0;
    for (const n of list) total += spec.moves[n].weight || 1;
    let r = this.rand() * total;
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
      const d = Math.hypot(a.x, a.y);
      if (d > ARENA.R - a.r) {
        a.x = (a.x / d) * (ARENA.R - a.r);
        a.y = (a.y / d) * (ARENA.R - a.r);
      }
      if (a.cool > 0) a.cool -= dt;
      if (a.def.dmg && a.cool <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < a.r + PLAYER.radius) {
        if (this.damagePlayer(a.def.dmg, a.x, a.y)) {
          a.cool = a.def.contact;
          this.sound("hurt");
        }
      }
    }
    this.adds = this.adds.filter((a) => a.alive || a.dying < 0.45);
  }

  stepShots(dt) {
    const p = this.player;
    const b = this.boss;
    for (const s of this.shots) {
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
        if (struck || Math.hypot(s.x, s.y) > ARENA.R + 10 || s.life <= 0) s.dead = true;
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
      if (Math.hypot(s.x, s.y) > ARENA.R + 10 || s.life <= 0) s.dead = true;
      else if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + PLAYER.radius) {
        if (this.damagePlayer(s.dmg, s.x, s.y)) {
          s.dead = true;
          this.events.push({ t: "burst", x: s.x, y: s.y, art: s.art });
        } else if (p.iFrames > 0) {
          // Rolled through it: the shot still passes, but it looks like a near miss.
          this.events.push({ t: "graze", x: s.x, y: s.y });
        }
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
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
        if (h.every && h.cool > 0) h.cool -= dt;
        const ready = !h.every || h.cool <= 0;
        if (ready && !b.airborne && !b.immune && phaseOf(h) === "active" && !h.hitBoss && hits(h, b.x, b.y, b.r)) {
          if (h.every) h.cool = h.every;
          else h.hitBoss = true;
          this.hitBossFlat(h.friendly, b.x, b.y - 10);
        }
        if (ready) for (const a of this.adds) if (a.alive && phaseOf(h) === "active" && a.zap !== h.id + "_" + Math.floor(h.t * 2) && hits(h, a.x, a.y, a.r)) {
          a.zap = h.id + "_" + Math.floor(h.t * 2);
          this.hurtAdd(a, h.friendly);
        }
        continue;
      }
      const dmg = damageFor(h, p.x, p.y, PLAYER.radius);
      if (dmg) {
        const [sx, sy] = sourceOf(h, p.x, p.y);
        if (this.damagePlayer(dmg, sx, sy)) {
          this.sound("hurt");
          if (h.pull) {
            // The chain drags you to the far end of itself.
            const a = h.a + Math.PI;
            p.vx = Math.cos(a) * 520;
            p.vy = Math.sin(a) * 520;
          }
        }
      }
      // Some hazards hurt whatever else is standing in them too.
      if (h.tag === "boom" || h.tag === "storm") {
        for (const a of this.adds) if (a.alive && damageFor(h, a.x, a.y, a.r) > 0) this.hurtAdd(a, h.dmg);
      }
    }
    this.hazards = this.hazards.filter((h) => !h.done);
  }

  stepFloaters(dt) {
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 0.9);
  }

  // -------------------------------------------------------------------------------------------
  // Damage
  // -------------------------------------------------------------------------------------------
  damagePlayer(dmg, fromX, fromY) {
    if (this.debug.god) return false;
    if (this.affix?.hardHits) dmg *= this.affix.hardHits; // Brittle: it staggers sooner, and hits harder
    let scaled = this.enraged ? dmg * (1 + clamp((this.time - FIGHT.enrage) / FIGHT.enrageRamp, 0, 1) * 5) : dmg;
    const p0 = this.player;
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
        return true;
      }
    }
    const before = this.player.hp;
    const landed = hurtPlayer(this.player, scaled, fromX, fromY, this.events);
    if (!landed) return false;
    this.damageTaken += before - this.player.hp;
    this.hitsTaken++;
    this.blessing?.onHurt?.(this, this.player);
    this.clean = false;
    this.hitstop = FIGHT.hitstopTaken;
    this.shake(7);
    this.floaters.push({ x: this.player.x, y: this.player.y - 26, v: `-${Math.round(scaled)}`, kind: "taken", t: 0 });
    return true;
  }

  /** The player's blade, resolved once per tick against the boss and every add. */
  resolveSwing() {
    const p = this.player;
    const arc = swingArc(p);
    if (!arc) return;
    const b = this.boss;
    const inArc = (x, y, r) => {
      const dx = x - arc.x;
      const dy = y - arc.y;
      const d = Math.hypot(dx, dy);
      if (d > arc.r + r) return false;
      if (d < 4) return true;
      return Math.abs(angleDiff(arc.a, Math.atan2(dy, dx))) <= arc.half + Math.atan2(r, Math.max(6, d));
    };

    if (!p.hitThisSwing.has("boss") && !b.airborne && inArc(b.x, b.y, b.r)) {
      p.hitThisSwing.add("boss");
      if (b.immune) {
        this.events.push({ t: "clang", x: b.x, y: b.y });
        this.sound("clang");
        this.hitstop = 0.05;
      } else {
        this.hitBoss(arc);
      }
    }
    for (const a of this.adds) {
      if (!a.alive || p.hitThisSwing.has(a)) continue;
      if (!inArc(a.x, a.y, a.r)) continue;
      p.hitThisSwing.add(a);
      this.hurtAdd(a, arc.dmg);
      this.hitstop = Math.max(this.hitstop, 0.03);
    }
  }

  hitBoss(arc) {
    const b = this.boss;
    const p = this.player;
    const crit = this.rand() < (p.mods.crit || 0);
    const dmg = this.debug.oneShot ? b.hp : Math.round(arc.dmg * (crit ? 2 : 1) * (b.stagger > 0 ? 1.5 : 1));
    b.hp = Math.max(0, b.hp - dmg);
    b.flash = 0.1;
    this.damageDealt += dmg;
    this.hitstop = arc.step === 2 ? FIGHT.hitstopHeavy : FIGHT.hitstopHit;
    this.shake(arc.step === 2 ? 6 : 3);
    this.sound(arc.step === 2 ? "hitHeavy" : "hit");
    const hx = b.x + Math.cos(arc.a) * b.r * 0.6;
    const hy = b.y + Math.sin(arc.a) * b.r * 0.6 - this.spec.hitH * 0.4;
    this.events.push({ t: "hit", x: hx, y: hy, a: arc.a, crit, heavy: arc.step === 2 });
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
        this.shake(10);
        for (const h of this.hazards) if (phaseOf(h) === "tele") h.done = true;
      }
    }
  }

  /** Damage from a bomb, a knife or a spell: no poise, no combo, still a number on screen. */
  hitBossFlat(dmg, x, y) {
    const b = this.boss;
    if (b.immune || b.airborne) {
      this.events.push({ t: "clang", x: b.x, y: b.y });
      return;
    }
    const d = Math.round(dmg * (b.stagger > 0 ? 1.5 : 1));
    b.hp = Math.max(0, b.hp - d);
    b.flash = 0.1;
    this.damageDealt += d;
    this.shake(3);
    this.sound("hit");
    this.events.push({ t: "hit", x, y, a: Math.atan2(b.y - y, b.x - x), crit: false });
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
      won: this.state === "won",
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

export { STATE, ADDS, phaseOf, radiusOf, KIND };
