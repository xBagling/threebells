// Generated from tools/bot.mjs by tools/sync-bot.mjs — do not edit.
import { World } from "./sim/world.js?v=8898846";
import { STATE } from "./sim/player.js?v=8898846";
import { hits, phaseOf, radiusOf, shown } from "./sim/hazards.js?v=8898846";
import { PLAYER, ARENA, TICK, FIGHT } from "./config.js?v=8898846";
import { blessedMods } from "./content/blessings.js?v=8898846";
import { rng, clamp, TAU, angleDiff } from "./util.js?v=8898846";

export const SKILLS = {
  casual: { react: 0.34, dodge: 0.45, greed: 0.8, potionAt: 0.3, rollSkill: 0.3, aimJitter: 0.25 },
  keen: { react: 0.2, dodge: 0.78, greed: 0.55, potionAt: 0.45, rollSkill: 0.7, aimJitter: 0.12 },
  expert: { react: 0.11, dodge: 0.96, greed: 0.35, potionAt: 0.55, rollSkill: 0.95, aimJitter: 0.04 },
};

/** How bad is standing at (x, y) about to be? Higher is worse; 0 is clear. */
function danger(w, x, y, lookahead, skill, arriveIn = 0) {
  let d = 0;
  for (const h of w.hazards) {
    if (h.friendly || !shown(h)) continue; // a mark that is not on the floor yet cannot be read
    const ph = phaseOf(h);
    if (ph === "fade") continue;
    const until = h.tele - h.t - arriveIn; // < 0 once it is live, allowing for the walk there
    if (until > lookahead) continue; // too far off to matter yet
    if (until < -h.active - 0.1 && !h.every) continue; // already been and gone
    if (!hits(h, x, y, PLAYER.radius + 3)) continue;
    // A thing about to go off is worse than one that just did.
    d += h.dmg * (until <= 0 ? 1 : 0.6 + 0.4 * (1 - until / lookahead)) * (1 + (1 - skill.dodge));
  }
  for (const s of w.shots) {
    if (s.tag === "friendly") continue;
    // Where it will be in half a second.
    for (const t of [0.12, 0.3, 0.55]) {
      const px = s.x + s.vx * t;
      const py = s.y + s.vy * t;
      if (Math.hypot(px - x, py - y) < s.r + PLAYER.radius + 4) d += s.dmg * (1 - t);
    }
  }
  for (const a of w.adds) if (a.alive && a.def.dmg && Math.hypot(a.x - x, a.y - y) < a.r + PLAYER.radius + 6) d += a.def.dmg;
  const b = w.boss;
  if (!b.airborne && Math.hypot(b.x - x, b.y - y) < b.r + PLAYER.radius + 2) d += w.spec.contact * 3;
  // Do not walk off the edge.
  const r = Math.hypot(x, y);
  if (r > ARENA.R - PLAYER.radius - 4) d += (r - (ARENA.R - PLAYER.radius - 4)) * 6;
  return d;
}

/** The soonest a hazard we are standing in will go off, or Infinity. */
function incoming(w, x, y) {
  let soonest = Infinity;
  for (const h of w.hazards) {
    if (h.friendly || !shown(h) || phaseOf(h) !== "tele") continue;
    if (!hits(h, x, y, PLAYER.radius + 2)) continue;
    soonest = Math.min(soonest, h.tele - h.t);
  }
  return soonest;
}

export function makeBot(skill = SKILLS.keen, seed = 1) {
  const rand = rng(seed);
  let reactT = 0;
  let seen = { x: 0, y: 0, t: 0 }; // what the bot last "noticed", delayed by its reaction time
  return function think(w, dt) {
    const p = w.player;
    const out = { mx: 0, my: 0, aim: null, attack: false, roll: false, slot0: false, slot1: false, pause: false };
    if (w.state !== "fight" || p.dead) return out;

    reactT -= dt;
    // A player watching the floor sees a telegraph as soon as it is drawn, so the bot looks about
    // a second and a half ahead; how *quickly* it acts on what it sees is the skill.
    const look = 1.5;

    // --- where to stand -----------------------------------------------------------------------
    const want = w.spec.radius + 16; // where the bot likes to stand: just inside its own reach
    const pull = (x, y) => Math.abs(Math.hypot(x - w.boss.x, y - w.boss.y) - want) * 0.06 * skill.greed;
    const here = danger(w, p.x, p.y, look, skill) + pull(p.x, p.y);
    let best = { d: here - 0.001, ax: 0, ay: 0 };
    // Two rings: one step, and one as far as a second of walking would carry you. Big telegraphs
    // need the far ring — a single short probe lands inside the same circle and looks no better.
    for (const step of [34, 76]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const nx = p.x + Math.cos(a) * step;
        const ny = p.y + Math.sin(a) * step;
        // Judge the far ring by when you would actually arrive there.
        const dd = danger(w, nx, ny, look, skill, step / PLAYER.speed) + pull(nx, ny) + (step > 40 ? 0.4 : 0);
        if (dd < best.d) best = { d: dd, ax: Math.cos(a), ay: Math.sin(a) };
      }
    }
    // React late: a casual player is still walking where they were a third of a second ago.
    if (reactT <= 0) {
      seen = { x: best.ax, y: best.ay, t: 0 };
      reactT = skill.react * (0.6 + rand() * 0.8);
    }
    out.mx = seen.x;
    out.my = seen.y;

    // --- aim ---------------------------------------------------------------------------------
    const ba = Math.atan2(w.boss.y - p.y, w.boss.x - p.x);
    // The nearest add, if one is closer than the boss, gets the blade instead.
    let tx = w.boss.x;
    let ty = w.boss.y;
    let td = Math.hypot(w.boss.x - p.x, w.boss.y - p.y) - w.spec.radius;
    for (const a of w.adds) {
      if (!a.alive) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y) - a.r;
      if (d < td) {
        td = d;
        tx = a.x;
        ty = a.y;
      }
    }
    out.aim = Math.atan2(ty - p.y, tx - p.x) + (rand() - 0.5) * skill.aimJitter;

    // --- roll --------------------------------------------------------------------------------
    // Walking out is nearly always better than rolling: a roll costs stamina, half a second of
    // commitment and all your attack uptime. So the bot only rolls when walking will not do —
    // which is the same rule a good player plays by.
    const soon = incoming(w, p.x, p.y);
    const R = PLAYER.roll;
    const canWalkOut = best.d < 0.6 && soon > 0.45; // a step clears it, with time to take the step
    const trapped = here > 1 && !canWalkOut;
    const canRoll = p.stamina >= R.cost * p.mods.rollCost && !p.exhausted;
    if (canRoll && trapped) {
      // The press wants to land so that the hit arrives in the middle of the window. How close to
      // that a bot gets is the whole of its skill.
      const ideal = (R.iFrom + R.iTo) / 2;
      const slack = 0.26 - skill.rollSkill * 0.18; // expert: ±0.09 s, casual: ±0.21 s
      const timed = Number.isFinite(soon) && Math.abs(soon - ideal) < slack;
      const panic = soon < R.iFrom; // too late to walk, too late to time it — go anyway
      if ((timed || panic || !Number.isFinite(soon)) && rand() < skill.dodge) {
        out.roll = true;
        out.mx = best.ax || Math.cos(ba + Math.PI);
        out.my = best.ay || Math.sin(ba + Math.PI);
        // An expert will roll straight through the boss to end up behind it, where it is safe.
        if (timed && rand() < skill.rollSkill * 0.4) {
          out.mx = Math.cos(ba);
          out.my = Math.sin(ba);
        }
      }
    }

    // --- swing -------------------------------------------------------------------------------
    const inRange = td < PLAYER.combo[0].range - 4;
    const safeEnough = here < 1 && soon > 0.45;
    if (!out.roll && inRange && (safeEnough || rand() < skill.greed * 0.25) && p.stamina > 18) out.attack = true;

    // --- the two slots -------------------------------------------------------------------------
    if (!out.roll && p.hp / p.hpMax < skill.potionAt) {
      for (let i = 0; i < 2; i++) {
        const id = p.slots[i];
        if (id && (id === "flask" || id === "salve") && p.charges[i] > 0 && p.cooldowns[i] <= 0 && safeEnough) {
          out[`slot${i}`] = true;
          break;
        }
      }
    }
    if (!out.roll && !out.attack && safeEnough && rand() < 0.4) {
      for (let i = 0; i < 2; i++) {
        const id = p.slots[i];
        if (!id || id === "flask" || id === "salve") continue;
        if (p.cooldowns[i] <= 0 && (p.charges[i] > 0 || p.charges[i] === 0)) {
          out[`slot${i}`] = true;
          break;
        }
      }
    }
    return out;
  };
}

/** Play one fight to the end. Returns the result plus a little extra for the balance report. */
export function playFight({ spec, skillName = "keen", seed = 1, mods = {}, loadout = ["flask", "knives"], blessing = null, maxSeconds = 260 }) {
  const skill = SKILLS[skillName];
  // The blessing goes in exactly as the fight screen puts it in: its mods folded into the hero's,
  // the World handed it (so its tick and onHurt hooks run), and its apply() run once.
  const base = { dmg: 1, speed: 1, rollCost: 1, hp: 0, iFrames: 0, lifesteal: 0, crit: 0, ...mods };
  const w = new World({ boss: spec, blessing, loadout, mods: blessedMods(base, blessing, PLAYER.hp), seed, practice: true });
  if (blessing?.apply) blessing.apply(w);
  const bot = makeBot(skill, seed * 7919 + 13);
  let t = 0;
  let intro = 0;
  while (w.state !== "won" && w.state !== "lost" && t < maxSeconds) {
    const intent = w.state === "intro" ? { mx: 0, my: 0, aim: null } : bot(w, TICK);
    w.step(intent, TICK);
    t += TICK;
    if (w.hitstop > 0) intro++;
  }
  const r = w.result();
  r.timedOut = t >= maxSeconds;
  return r;
}
