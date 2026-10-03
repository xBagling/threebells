// What makes an arena a place rather than a floor: the plants growing on it and the small things
// living in it.
//
// Plants are scattered from a fixed seed per arena (render.js passes 1), so everyone sees the same
// reeds in the same spots on every visit — the dressing is part of the level, not decoration
// sprinkled at random per session. Critters start from the same seed but wander with Math.random:
// they are outside the sim, and nothing they do can touch the fight.
//
// Plants never move on their own; they lean with the shared wind field. Critters wander, and
// scatter — away from whatever did it — when the hero rushes near, the boss moves past, or the
// floor lights up under them. Nothing here can touch the fight: the dressing layer is not in the sim.
import { ART } from "./atlas.js?v=8898846";
import { PLANT_FLEX, ARENA_PLANTS, ARENA_CRITTERS } from "./art/decor.js?v=8898846";
import { HUE } from "./lights.js?v=8898846";
import { rng, TAU, clamp, lerp } from "../util.js?v=8898846";
import { ARENA } from "../config.js?v=8898846";
import { hits, sourceOf, KIND as SHAPE } from "../sim/hazards.js?v=8898846";

const R = ARENA.R;

export function makeDressing(arena, seed = 1, { plants: withPlants = true } = {}) {
  const rand = rng(seed * 7919 + 17);
  const plants = [];
  const critters = [];

  // --- plants --------------------------------------------------------------------------------
  for (const [kind, count, where] of withPlants ? ARENA_PLANTS[arena] || [] : []) {
    const set = ART.decor?.plant?.[kind];
    if (!set || !set.length) continue;
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      // "rim" grows in the band round the edge, "floor" anywhere but the middle — the middle is
      // where the fight happens and nothing may clutter it.
      // "rim" hugs the painted edge from just inside it; anything further out floats in the void.
      const d = where === "rim" ? R * (0.86 + rand() * 0.15) : R * Math.sqrt(0.08 + rand() * 0.74);
      plants.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        spr: set[Math.floor(rand() * set.length)],
        flex: PLANT_FLEX[kind] ?? 0.6,
        flip: rand() < 0.5,
        kind,
        ph: rand() * TAU,
        // A cap or a flame is also a light; the renderer picks these up.
        lit: kind === "cap" ? HUE.cap : kind === "emberTuft" ? HUE.ember : null,
        litR: kind === "cap" ? 22 + rand() * 12 : 18 + rand() * 10,
      });
    }
  }
  // Draw the far ones first so the near ones overlap them.
  // Back to front along the isometric depth axis, so a near reed overlaps a far one.
  plants.sort((a, b) => a.x + a.y - (b.x + b.y));

  // --- critters -------------------------------------------------------------------------------
  const KIND = {
    beetle: { speed: 13, turn: 0.9, flee: 34, fleeSpeed: 46, fps: 7, ground: true, rest: [1.2, 3.5] },
    frog: { speed: 0, turn: 0, flee: 46, fleeSpeed: 0, fps: 5, ground: true, hop: [1.6, 4.2] },
    minnow: { speed: 26, turn: 2.4, flee: 40, fleeSpeed: 78, fps: 9, ground: true, rest: [0.5, 1.6] },
    moth: { speed: 17, turn: 1.6, flee: 30, fleeSpeed: 40, fps: 11, ground: false, orbit: true },
    sparkfly: { speed: 8, turn: 0.7, flee: 22, fleeSpeed: 30, fps: 6, ground: false, glow: true },
  };
  for (const [kind, count] of ARENA_CRITTERS[arena] || []) {
    const def = KIND[kind];
    const set = ART.decor?.critter?.[kind];
    if (!def || !set) continue;
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const d = R * Math.sqrt(rand()) * 0.92;
      critters.push({
        kind,
        def,
        set,
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        z: def.ground ? 0 : 6 + rand() * 20,
        a: rand() * TAU,
        v: 0,
        t: rand() * 4,
        wait: rand() * 2,
        hop: 0,
        ph: rand() * TAU,
        startled: 0,
        fromX: 0, // what it is running from
        fromY: 0,
      });
    }
  }

  /** Send a critter running from (x, y). It picks its line once, so it does not jitter as it goes. */
  function scare(c, x, y, dur) {
    const fresh = c.startled <= 0 || Math.hypot(x - c.fromX, y - c.fromY) > 12;
    c.startled = Math.max(c.startled, dur);
    if (!fresh) return;
    c.fromX = x;
    c.fromY = y;
    c.a = Math.atan2(c.y - y, c.x - x) + (Math.random() - 0.5) * 0.5;
  }

  // Where the boss was last frame. Root motion moves it without a velocity, so its speed is read
  // from how far it went — smoothed over about a sixth of a second, because the sim moves in whole
  // 1/60 s ticks and a 120 Hz frame sees either no tick or one.
  let bossX = null;
  let bossY = 0;
  let bossSpeed = 0;

  return {
    plants,
    critters,

    /** Critters live here. dt is real time; they are outside the sim on purpose. */
    step(dt, world, wind) {
      const p = world.player;
      const b = world.boss;
      if (bossX != null && dt > 0) bossSpeed += (Math.hypot(b.x - bossX, b.y - bossY) / dt - bossSpeed) * (1 - Math.exp(-dt / 0.16));
      bossX = b.x;
      bossY = b.y;
      for (const c of critters) {
        const d = c.def;
        c.t += dt;
        if (c.startled > 0) c.startled -= dt;

        // Something big and fast coming near sends them running from it; so does a floor lighting
        // up under them (startle(), below), and then they run from where it lit.
        const dp = Math.hypot(p.x - c.x, p.y - c.y);
        if (dp < d.flee && Math.hypot(p.vx, p.vy) > 40) scare(c, p.x, p.y, 0.5);
        // The boss is bigger, so it is noticed from further off — whenever it is on the move, even
        // at the slow drift between attacks (15–25 units a second).
        if (bossSpeed > 10 && Math.hypot(b.x - c.x, b.y - c.y) < d.flee + b.r * 1.5) scare(c, b.x, b.y, 0.7);
        if (c.hop > 0) c.hop -= dt;
        if (c.startled > 0) {
          if (d.hop) {
            // A frog flees the only way it moves: in hops.
            if (c.hop <= 0) c.hop = 0.42;
            c.v = 84;
          } else c.v = d.fleeSpeed || d.speed * 2.5;
        } else if (d.hop) {
          // A frog sits, then jumps, then sits again.
          c.wait -= dt;
          if (c.hop <= 0 && c.wait <= 0) {
            c.hop = 0.42;
            c.a = Math.random() * TAU;
            c.wait = d.hop[0] + Math.random() * (d.hop[1] - d.hop[0]);
          }
          c.v = c.hop > 0 ? 62 : 0;
        } else {
          c.wait -= dt;
          if (c.wait <= 0) {
            c.a += (Math.random() - 0.5) * d.turn * 2;
            c.v = d.speed * (0.4 + Math.random() * 0.9);
            c.wait = d.rest ? d.rest[0] + Math.random() * (d.rest[1] - d.rest[0]) : 1 + Math.random();
          }
          c.v = lerp(c.v, d.speed, dt * 0.6);
        }

        // Moths circle the nearest light; fireflies just drift.
        if (d.orbit) c.a += Math.sin(c.t * 1.7 + c.ph) * dt * 2.4;
        if (!d.ground) {
          const [wx, wy] = wind.drift(c.x, c.y, 0.5);
          c.x += wx * dt;
          c.y += wy * dt;
          c.z = clamp(c.z + Math.sin(c.t * 1.3 + c.ph) * dt * 9, 3, 30);
        }
        c.x += Math.cos(c.a) * c.v * dt;
        c.y += Math.sin(c.a) * c.v * dt;
        // Turn back at the edge rather than piling up against it.
        const r = Math.hypot(c.x, c.y);
        const lim = R - 6;
        if (r > lim) {
          c.x = (c.x / r) * lim;
          c.y = (c.y / r) * lim;
          c.a = Math.atan2(-c.y, -c.x) + (Math.random() - 0.5);
        }
        if (c.hop > 0) c.z = Math.sin((1 - c.hop / 0.42) * Math.PI) * 9;
        else if (d.ground) c.z = 0;
      }
    },

    /** Anything landing on the floor scatters whatever was standing there, away from where it hit. */
    startle(x, y, r) {
      for (const c of critters) if (Math.hypot(c.x - x, c.y - y) < r) scare(c, x, y, 0.9);
    },

    /**
     * A hazard going off scatters whatever is in it or at its edge — out of the shape that lit up:
     * sideways out of a lane, away from a ring's line, away from the middle of anything else.
     */
    startleShape(h) {
      for (const c of critters) {
        if (!hits(h, c.x, c.y, 12)) continue;
        if (h.kind === SHAPE.LANE) {
          const ux = Math.cos(h.a);
          const uy = Math.sin(h.a);
          const along = (c.x - h.x) * ux + (c.y - h.y) * uy;
          scare(c, h.x + ux * along, h.y + uy * along, 0.9);
        } else {
          const [fx, fy] = sourceOf(h, c.x, c.y);
          scare(c, fx, fy, 0.9);
        }
      }
    },

    /** Plants that are also lights. Called once a frame by the renderer. */
    lights(add) {
      for (const p of plants) if (p.lit) add(p.x, p.y - 4, p.litR, p.lit, p.kind === "emberTuft" ? 0.55 : 0.42, 1.7);
    },

    /** Fireflies are lights too, and they pulse. */
    critterLights(add, now) {
      for (const c of critters) {
        if (!c.def.glow) continue;
        const k = 0.35 + 0.65 * Math.max(0, Math.sin(now * 1.9 + c.ph));
        add(c.x, c.y - c.z, 13, HUE.gold, 0.32 * k, 1.9);
      }
    },
  };
}
