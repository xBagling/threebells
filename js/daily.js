// What day it is, what week it is, and everything the date decides: which three bosses are up,
// which modifier is on them, and which three blessings you are offered.
//
// Everything here is a pure function of the date, so two players on the same day see the same
// things without a server ever being asked.
import { CONFIG } from "./config.js?v=8898846";
import { rng, hashSeed, pickN } from "./util.js?v=8898846";
import { BLESSINGS, BLESSING_IDS } from "./content/blessings.js?v=8898846";
import { BOSS_ORDER, BOSSES } from "./content/bosses.js?v=8898846";

const [LY, LM, LD] = CONFIG.LAUNCH_DATE.split("-").map(Number);
const LAUNCH = new Date(LY, LM - 1, LD);

/** Local midnight, so "today" changes when the player's day does. */
const midnight = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Day 1 is launch day. Rounded, not floored: two local midnights either side of a clock change
 * are 23 or 25 hours apart, and flooring 23 hours made the day after the spring change repeat the
 * day before it.
 */
export function dayNumber(at = new Date()) {
  return Math.round((midnight(at) - LAUNCH) / 86400000) + 1;
}
/** Week 1 is launch week; the week turns over on the same weekday launch fell on. */
export const weekNumber = (day = dayNumber()) => Math.floor((day - 1) / 7) + 1;
export const dayOfWeek = (day = dayNumber()) => ((day - 1) % 7) + 1; // 1…7
export const dateKey = (at = new Date()) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
/** The other way round: the date a day number fell on, at noon so no clock change can move it. */
export const dateOfDay = (day) => new Date(LY, LM - 1, LD + day - 1, 12);
/** A day number as a short date the way the player's browser writes one, e.g. "29 Sep 2026". */
export const dayLabel = (day) => dateOfDay(day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// ---------------------------------------------------------------------------------------------
// Weekly modifiers: one affix over all three of the week's bosses.
//
// apply() runs once, before the fight starts. What an affix does from tick to tick — eruptions,
// extra adds, the frenzy, the late telegraphs, the harder hits — is in World (sim/world.js), which
// reads world.affix, so a re-played fight does exactly what the played one did.
// ---------------------------------------------------------------------------------------------
export const MODIFIERS = {
  none: { id: "none", name: "Plain", desc: "No affix this week.", apply: () => {} },
  frenzied: {
    id: "frenzied",
    name: "Frenzied",
    desc: "Below a third of its health, the boss moves and acts far faster.",
    apply: (w) => (w.affix = { frenzy: true }),
  },
  volcanic: {
    id: "volcanic",
    name: "Volcanic",
    desc: "The ground erupts under you every few seconds. Keep walking.",
    apply: (w) => (w.affix = { volcanic: 4.5 }),
  },
  brittle: {
    id: "brittle",
    name: "Brittle",
    desc: "The boss staggers a third sooner — but hits a fifth harder.",
    apply: (w) => {
      w.boss.poiseMax = Math.round(w.boss.poiseMax * 0.66);
      w.boss.poise = w.boss.poiseMax;
      w.affix = { hardHits: 1.2 };
    },
  },
  swarming: {
    id: "swarming",
    name: "Swarming",
    desc: "Something extra comes out every twenty seconds.",
    apply: (w) => (w.affix = { swarm: 20 }),
  },
  hushed: {
    id: "hushed",
    name: "Hushed",
    desc: "Telegraphs are shorter. You have to know the fight.",
    apply: (w) => (w.affix = { hush: 0.78 }),
  },
};
const MOD_IDS = ["none", "frenzied", "volcanic", "brittle", "swarming", "hushed"];

export function weekModifier(week = weekNumber()) {
  if (week <= 1) return MODIFIERS.none; // the first week is the plain one, so the fights can be learned
  const r = rng(hashSeed(`tb-mod-${week}`));
  return MODIFIERS[MOD_IDS[1 + Math.floor(r() * (MOD_IDS.length - 1))]];
}

/** The three bosses this week, easiest first. Only one set exists so far; later weeks rotate. */
export function weekBosses(week = weekNumber()) {
  return BOSS_ORDER.map((id) => BOSSES[id]);
}

/** The three blessings offered today. The same three for everyone. */
export function dailyBlessings(day = dayNumber()) {
  const r = rng(hashSeed(`tb-bless-${day}`));
  return pickN(BLESSING_IDS, 3, r).map((id) => BLESSINGS[id]);
}

/** A seed for one fight, so the boss's random choices are the same for everyone that day. */
export const fightSeed = (day, tier) => hashSeed(`tb-fight-${day}-${tier}`);

/**
 * A seed for one practice run: the day, the boss and which try this is. Practice never plays the
 * day's scored fight move for move — rehearsing that would make the one life a formality — and
 * each try plays a little differently from the last.
 */
export const practiceSeed = (day, tier, attempt) => hashSeed(`tb-practice-${day}-${tier}-${attempt}`);

/** A player-specific seed, for loot rolls: the same kill gives two players different drops. */
export const lootSeed = (playerId, week, tier) => hashSeed(`tb-loot-${playerId}-${week}-${tier}`);
