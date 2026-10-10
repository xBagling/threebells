// The save. Gold, what you have unlocked, what is in your two slots, how this week has gone, and
// your record: what you have felled, when first, and how many weeks you have cleared.
//
// Losing weeks of progress to a cleared browser would sting far more than losing a quiz streak, so
// there is a save code (export/import) from day one, as the house rules say.
import { CONFIG } from "./config.js?v=df092a6";
import { dayNumber, weekNumber, dateKey } from "./daily.js?v=df092a6";
import { STARTING_ITEMS, ITEMS } from "./content/items.js?v=df092a6";
import { BOSS_ORDER } from "./content/bosses.js?v=df092a6";
import { WEAPONS } from "./content/weapons.js?v=df092a6";

const KEY = CONFIG.SAVE_KEY;

export const UPGRADES = {
  blade: { name: "Whetstone", icon: "sword", desc: "+6% damage a level", max: 5, cost: (l) => 120 + l * 90, mod: (l) => ({ dmg: 1 + l * 0.06 }) },
  cloak: { name: "Padded Cloak", icon: "shield", desc: "+8 health a level", max: 5, cost: (l) => 110 + l * 85, mod: (l) => ({ hp: l * 8 }) },
  boots: { name: "Soft Boots", icon: "roll", desc: "Rolls cost 5% less a level", max: 5, cost: (l) => 100 + l * 80, mod: (l) => ({ rollCost: 1 - l * 0.05 }) },
};

function blank() {
  return {
    v: 1,
    id: Math.random().toString(36).slice(2, 10), // used only to make your loot rolls yours
    gold: 0,
    items: [...STARTING_ITEMS],
    loadout: ["flask", "knives"],
    // what he holds: weapon ids (content/weapons.js) for his main (sword) hand and his off hand (null: empty)
    arms: { main: "sword", off: null },
    upgrades: { blade: 0, cloak: 0, boots: 0 },
    week: { n: 0, cleared: [], best: 0 },
    // `blessing` is the day's pick, made once and kept for every scored fight that day: a blessing
    // id, "none" for going without, or null while it is still to make.
    // `live` is the tier of a scored fight that has started and not yet ended (0 when none is on);
    // `left` says the day was spent by leaving one, so the title can say so.
    today: { key: "", used: false, tier: 1, blessing: null, done: false, live: 0, left: false },
    // Your record, shown at camp. There is no streak: a day missed costs nothing (the owner's 2.12).
    kills: { gnasher: 0, cinder: 0, king: 0 },
    firsts: {}, // boss id → the day you first felled it
    weeksCleared: 0, // weeks in which you felled all three
    history: [], // one entry a day, newest last, capped
    seenHelp: false,
    settings: { sound: true, music: true, shake: 1, holdToAttack: true, hand: "right" },
  };
}

let save = blank();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) save = migrate({ ...blank(), ...JSON.parse(raw) });
  } catch {
    save = blank();
  }
  rollOver();
  return save;
}
function migrate(s) {
  s.settings = { ...blank().settings, ...(s.settings || {}) };
  s.upgrades = { ...blank().upgrades, ...(s.upgrades || {}) };
  s.kills = { ...blank().kills, ...(s.kills || {}) };
  s.today = { ...blank().today, ...(s.today || {}) }; // saves from before the live-fight marker
  // Saves from before the day's pick was kept wrote null for going without as well as for no pick
  // yet. A day that has already had a scored fight had made its pick, so there null means without.
  if (s.today.used && !s.today.blessing) s.today.blessing = "none";
  if (!Array.isArray(s.items) || !s.items.length) s.items = [...STARTING_ITEMS];
  s.items = s.items.filter((i) => ITEMS[i]);
  if (!Array.isArray(s.loadout) || s.loadout.length !== 2) s.loadout = ["flask", "knives"];
  s.loadout = s.loadout.map((i) => (i && s.items.includes(i) ? i : null));
  // saves from before the weapons: the sword alone
  const a = s.arms && typeof s.arms === "object" ? s.arms : {};
  s.arms = { main: WEAPONS[a.main]?.kind === "weapon" ? a.main : "sword", off: a.off && WEAPONS[a.off] ? a.off : null };
  // Saves from before the weeks-cleared counter start it from what they do remember, and one
  // behind that is brought up to it. Saves from before the streak was dropped lose theirs.
  s.weeksCleared = Math.max(Number(s.weeksCleared) || 0, clearedWeeksIn(s));
  delete s.streak;
  delete s.bestStreak;
  return s;
}
/** The weeks a save can show were cleared: each week in the history with a win over Boss III, and
 *  this week if all three are down. It forgets some (the history is capped), so it is only a floor. */
function clearedWeeksIn(s) {
  const weeks = new Set((Array.isArray(s.history) ? s.history : []).filter((h) => h && h.won && h.tier >= BOSS_ORDER.length).map((h) => weekNumber(h.d)));
  if (s.week && Array.isArray(s.week.cleared) && s.week.cleared.length >= BOSS_ORDER.length) weeks.add(s.week.n);
  return weeks.size;
}
export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* a full or private store: play on, just don't remember */
  }
}
export const get = () => save;

/** Roll the day and the week over if the calendar has moved on. */
export function rollOver() {
  const day = dayNumber();
  const week = weekNumber(day);
  const key = dateKey();
  if (save.week.n !== week) {
    // A new week: the three come back from the first (the preview season), unbeaten ones included.
    // Gold, kills, unlocks and everything else earned stay.
    save.week = { n: week, cleared: [], best: 0 };
  }
  if (save.today.key === key && save.today.live) {
    // A scored fight of today's was still on when the page went away — closed, reloaded, or left
    // some other way. That is a death, and nothing is paid for it: the life was spent at the start.
    const tier = save.today.live;
    recordLoss(tier, 0);
    save.today.left = true;
    endDay({ tier, won: false, left: true });
  }
  if (save.today.key !== key) {
    // A marker left from an earlier day goes with the rest of that day: its life was spent then.
    save.today = { key, used: false, tier: nextTier(), blessing: null, done: false, live: 0, left: false };
  }
  persist();
}

/** The lowest boss of the week you have not yet felled, or 0 when the week is cleared. */
export function nextTier() {
  for (let t = 1; t <= BOSS_ORDER.length; t++) if (!save.week.cleared.includes(t)) return t;
  return 0;
}
export const weekCleared = () => nextTier() === 0;
/** Today is spent once a fight has started and then ended in a death, or was left before it ended. */
export const canFight = () => !save.today.done;

/** The day's blessing, picked once: it lasts every scored fight that day. Going without (no id) is
 *  a pick too, kept as "none". A pick already made stands, and practice never calls this. */
export function chooseBlessing(id) {
  if (!save.today.blessing) {
    save.today.blessing = id || "none";
    persist();
  }
  return save.today.blessing;
}

/** A scored fight begins, and the day's life with it. The marker stays in the save until the fight
 *  is settled, so a page that goes away first finds it on the next load and counts a death. */
export function startFight(tier) {
  save.today.used = true;
  save.today.tier = tier;
  save.today.live = tier;
  persist();
}

/** A win: bank the gold, mark the boss down, and leave the day open for the next one. */
export function recordWin(tier, gold, drops) {
  save.today.live = 0;
  if (!save.week.cleared.includes(tier)) {
    save.week.cleared.push(tier);
    // The win that fells the week's last standing boss clears the week. A victory lap fells no new
    // one, so it never counts the same week twice.
    if (save.week.cleared.length === BOSS_ORDER.length) save.weeksCleared++;
  }
  save.week.cleared.sort();
  save.gold += gold;
  const id = BOSS_ORDER[tier - 1];
  save.kills[id] = (save.kills[id] || 0) + 1;
  if (!save.firsts[id]) save.firsts[id] = dayNumber();
  for (const d of drops || []) if (!save.items.includes(d)) save.items.push(d);
  save.week.best = Math.max(save.week.best, tier);
  persist();
}

/** A death: the day is over. The gold is scaled to how far you got — a loss is never wasted. */
export function recordLoss(tier, gold) {
  save.today.live = 0;
  save.today.done = true;
  save.gold += gold;
  persist();
}

/** The day is over — a death, the last boss down, or a fight left mid-way — with a line for the history. */
export function endDay(entry) {
  save.today.done = true;
  if (entry) {
    save.history.push({ d: dayNumber(), ...entry });
    if (save.history.length > 200) save.history.shift();
  }
  persist();
}

// ---------------------------------------------------------------------------------------------
// Camp: buying things.
// ---------------------------------------------------------------------------------------------
export function buyItem(id) {
  const it = ITEMS[id];
  if (!it || save.items.includes(id) || save.gold < it.cost) return false;
  save.gold -= it.cost;
  save.items.push(id);
  persist();
  return true;
}
export function buyUpgrade(key) {
  const u = UPGRADES[key];
  const lvl = save.upgrades[key] || 0;
  if (!u || lvl >= u.max) return false;
  const cost = u.cost(lvl);
  if (save.gold < cost) return false;
  save.gold -= cost;
  save.upgrades[key] = lvl + 1;
  persist();
  return true;
}
export function setSlot(i, id) {
  if (id && !save.items.includes(id)) return false;
  if (id && save.loadout[1 - i] === id) save.loadout[1 - i] = null;
  save.loadout[i] = id;
  persist();
  return true;
}
/** What he holds: `hand` "main" (a weapon) or "off" (a weapon, a shield, or null for empty). */
export function setArm(hand, id) {
  if (hand === "main" && WEAPONS[id]?.kind !== "weapon") return false;
  if (hand === "off" && id && !WEAPONS[id]) return false;
  save.arms = { ...save.arms, [hand]: id || null };
  persist();
  return true;
}
export function setSetting(k, v) {
  save.settings[k] = v;
  persist();
}

/** Every permanent bonus rolled into the mods the sim understands. */
export function playerMods() {
  const m = { dmg: 1, speed: 1, rollCost: 1, hp: 0, iFrames: 0, lifesteal: 0, crit: 0 };
  for (const [k, u] of Object.entries(UPGRADES)) {
    const lvl = save.upgrades[k] || 0;
    if (!lvl) continue;
    const got = u.mod(lvl);
    for (const [s, v] of Object.entries(got)) m[s] = s === "hp" ? m[s] + v : typeof v === "number" && (s === "dmg" || s === "speed" || s === "rollCost") ? m[s] * v : v;
  }
  return m;
}

// ---------------------------------------------------------------------------------------------
// Save codes
// ---------------------------------------------------------------------------------------------
export function exportCode() {
  const slim = { v: save.v, id: save.id, gold: save.gold, items: save.items, loadout: save.loadout, arms: save.arms, upgrades: save.upgrades, week: save.week, kills: save.kills, firsts: save.firsts, weeksCleared: save.weeksCleared };
  const json = JSON.stringify(slim);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
export function importCode(code) {
  try {
    const bin = atob(code.trim().replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.items)) return false;
    save = migrate({ ...blank(), ...save, ...obj });
    rollOver();
    persist();
    return true;
  } catch {
    return false;
  }
}
export function wipe() {
  save = blank();
  rollOver();
  persist();
}
