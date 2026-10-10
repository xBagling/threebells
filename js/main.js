// The shell: which screen is up, and what the day allows.
//
//   the hill (title) → take a blessing → the fight → what happened → camp, or straight on
//
// One life a day. It is spent the moment a fight starts, so closing the tab mid-fight costs it —
// which is the whole point of a daily. And one blessing a day: taken before the day's first fight,
// it lasts every fight after it.
import { buildArt } from "./gfx/atlas.js?v=df092a6";
import { makeInput, isTouchDevice } from "./input.js?v=df092a6";
import { load, get as getSave, rollOver, nextTier, chooseBlessing, startFight, recordWin, recordLoss, endDay, playerMods, persist } from "./store.js?v=df092a6";
import { dayNumber, weekNumber, weekModifier, fightSeed, practiceSeed } from "./daily.js?v=df092a6";
import { BOSS_ORDER, BOSSES } from "./content/bosses.js?v=df092a6";
import { BOSS_DROPS } from "./content/items.js?v=df092a6";
import { BLESSINGS, blessedMods } from "./content/blessings.js?v=df092a6";
import { renderTitle } from "./ui/title.js?v=df092a6";
import { renderCamp } from "./ui/camp.js?v=df092a6";
import { renderBlessing, renderResult, renderHelp } from "./ui/screens.js?v=df092a6";
import { runFight } from "./ui/fight.js?v=df092a6";
import { sfx, setEnabled, setMusic, unlock } from "./audio.js?v=df092a6";
import { installAdminKeys, setAdminHandlers } from "./ui/admin.js?v=df092a6";
import { html } from "./util.js?v=df092a6";
import { PLAYER } from "./config.js?v=df092a6";
import { canView3D } from "./view-pref.js?v=df092a6";

const app = document.getElementById("app");
const modal = document.getElementById("modal");
let teardown = () => {};
let input = null;
// Practice runs started since the page loaded. Each one is a new try, and gets a new seed from it.
let practiceTries = 0;

// The fight is drawn in 3D (docs/3D-PLAN.md). The module and its models load in the background from
// the title on, and a fight only starts once they are ready, so a slow or failed load never spends
// the day's life. Only the bosses made in 3D are offered (content/bosses.js BOSS_ORDER).
let view3D = null; // { makeRenderer } once loaded
let loading3D = null; // the load in flight
let pending3D = false; // a fight is waiting for the load: further taps do nothing
let canTell3D = null; // canView3D()'s answer, once asked
function preload3D(bosses = []) {
  // (a boss being tested from the admin menu has its own model loaded into the same view)
  if (view3D) return bosses.some((id) => !view3D.assets.bosses?.[id]) ? import("./gfx3d/load3d.js?v=df092a6").then((m) => m.preload3D({ bosses })) : Promise.resolve(view3D);
  if (!loading3D)
    loading3D = import("./gfx3d/load3d.js?v=df092a6")
      .then((m) => m.preload3D())
      .then((got) => (view3D = got))
      .catch((err) => {
        loading3D = null;
        throw err;
      });
  return loading3D;
}
/** Can this device draw the fight at all (WebGL2)? Asked once, and remembered. */
const canPlay = () => (canTell3D ??= canView3D());
const NO_VIEW = "This device cannot draw the game: it needs WebGL2, which this browser does not offer.";

function show(fn) {
  teardown();
  teardown = () => {};
  app.innerHTML = "";
  const t = fn(app);
  if (typeof t === "function") teardown = t;
  app.scrollTop = 0;
}

// ---------------------------------------------------------------------------------------------
// What a fight was worth.
// ---------------------------------------------------------------------------------------------
function payout(result, tier, practice) {
  if (practice) return 0;
  if (result.won) {
    const base = 90 + tier * 70;
    const speed = Math.round(Math.max(0, 1 - result.time / 180) * 60);
    const clean = result.clean ? 70 : result.hitsTaken <= 2 ? 30 : 0;
    return base + speed + clean;
  }
  // A loss is never wasted: you are paid for the health you took off it.
  const got = result.damageDealt / result.bossHpMax;
  return Math.max(8, Math.round(got * (60 + tier * 55)));
}
// The boss a fight is with: practice may name any boss with a model (the admin menu's test fights, `?practice=king`).
const specOf = (tier, practice, boss) => (practice && boss && BOSSES[boss] ? BOSSES[boss] : BOSSES[BOSS_ORDER[Math.min(BOSS_ORDER.length, Math.max(1, tier)) - 1]]);
function dropsFor(tier, practice) {
  if (practice) return [];
  const save = getSave();
  const id = BOSS_ORDER[tier - 1];
  const item = BOSS_DROPS[id];
  return item && !save.items.includes(item) ? [item] : [];
}

// ---------------------------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------------------------
function toTitle() {
  rollOver();
  show((root) =>
    renderTitle(root, {
      onBegin: () => toBlessing(nextTier() || 1, false),
      onCamp: toCamp,
      onHelp: () => renderHelp(modal, () => (modal.innerHTML = "")),
      onPractice: (tier, boss) => toBlessing(tier, true, boss), // any boss reached this week, or a preview of one made in 3D
      noView: canPlay() ? "" : NO_VIEW,
    })
  );
  if (canPlay()) preload3D().catch(() => {}); // in the background; a fight waits for it if need be
}

// A small card over the screen, with one way back.
function notice(text) {
  modal.innerHTML = html`<div class="modal load3d" role="dialog" aria-label="Notice">
    <div class="modal-box"><p>${text}</p><button class="btn btn-quiet" data-cancel type="button">Back</button></div>
  </div>`;
  modal.querySelector("[data-cancel]").onclick = () => (sfx.click(), (modal.innerHTML = ""));
}

// While the 3D view loads before a fight: a small card, with a way back, and a time limit. A load
// that fails or takes too long says so; the fight does not start, and the day is not touched.
function preloadThen(go) {
  if (pending3D) return;
  pending3D = true;
  let done = false;
  modal.innerHTML = html`<div class="modal load3d" role="dialog" aria-label="Loading">
    <div class="modal-box"><p>Setting up the garden…</p><button class="btn btn-quiet" data-cancel type="button">Cancel</button></div>
  </div>`;
  const close = () => ((done = true), (pending3D = false), (modal.innerHTML = ""));
  modal.querySelector("[data-cancel]").onclick = () => (sfx.click(), close());
  const timer = setTimeout(() => {
    if (done) return;
    close();
    notice("The garden is taking too long to load. Check the connection and try again.");
  }, 20000);
  preload3D().then(
    () => {
      if (done) return;
      clearTimeout(timer);
      close();
      go();
    },
    () => {
      if (done) return;
      clearTimeout(timer);
      close();
      notice("The garden could not load. Check the connection and try again.");
    }
  );
}

function toCamp() {
  show((root) => renderCamp(root, { onBack: toTitle }));
}

// A screen can stay up past midnight — a phone tab often does. So before a scored fight takes the
// day's blessing or its life, the day is brought up to date. If it has moved on, the screen was
// drawn for a day that is over: back to the hill, drawn for the new one, rather than booking
// today's fight to yesterday (where the next load would forget it) with yesterday's blessing.
function dayMovedOn() {
  const was = getSave().today.key;
  rollOver();
  if (getSave().today.key === was) return false;
  toTitle();
  return true;
}

function toBlessing(tier, practice, boss = null) {
  if (!practice && dayMovedOn()) return;
  const spec = specOf(tier, practice, boss);
  // Once the day's pick is made, a scored fight goes straight in with it — 'Straight on', the
  // victory lap, or back from camp. Going without is a pick too. Practice always picks freely and
  // never makes the day's pick.
  const picked = getSave().today.blessing;
  if (!practice && picked) return toFight(tier, BLESSINGS[picked] || null, false);
  show((root) =>
    renderBlessing(root, { spec, tier, practice }, (blessing) => {
      if (!practice) {
        // The blessing screen can be left up past midnight too, with the day before's three on it.
        if (dayMovedOn()) return;
        // The day keeps its first pick: a second tap on the same screen fights with that one.
        const kept = chooseBlessing(blessing?.id);
        return toFight(tier, BLESSINGS[kept] || null, false);
      }
      toFight(tier, blessing, practice, boss ? { boss } : {});
    })
  );
}

function toFight(tier, blessing, practice, extra = {}) {
  const save = getSave();
  const day = dayNumber();
  const spec = specOf(tier, practice, extra.boss);
  // The view is loaded before anything about the fight happens (before the day's life is spent).
  if (!canPlay()) return notice(NO_VIEW);
  if (!view3D) return preloadThen(() => toFight(tier, blessing, practice, extra));
  // its model first (once): then the fight
  if (spec.id !== "gnasher" && !view3D.assets.bosses?.[spec.id] && !extra.loading) return preload3D([spec.id]).then(() => toFight(tier, blessing, practice, { ...extra, loading: true }), () => toFight(tier, blessing, practice, { ...extra, loading: true }));
  const modifier = weekModifier(weekNumber(day));
  // A scored fight plays the day's seed, the same for everyone; practice plays its own (daily.js).
  const seed = practice ? practiceSeed(day, tier, ++practiceTries) : fightSeed(day, tier);

  const mods = blessedMods(playerMods(), blessing, PLAYER.hp);

  // The fight is paid and recorded the moment it ends (onSettle), which also clears the save's
  // live-fight marker; the result screen only comes up once the victory pose or the fall has played.
  let settled = null;
  const onSettle = (result) => {
    const gold = payout(result, tier, practice);
    const drops = result.won ? dropsFor(tier, practice) : []; // before recordWin adds them to the save
    if (!practice) {
      if (result.won) recordWin(tier, gold, drops);
      else recordLoss(tier, gold);
    }
    const more = result.won && tier < BOSS_ORDER.length && !practice;
    settled = { result, spec, tier, gold, drops, practice, canContinue: more, nextSpec: more ? BOSSES[BOSS_ORDER[tier]] : null };
  };

  show((root) =>
    runFight(
      root,
      { spec, blessing, modifier: extra.modifier || modifier, loadout: save.loadout, mods, seed, tier, practice, input, phase: extra.phase || 0, onSettle, makeRenderer: view3D.makeRenderer,
        // The day's life is spent once the view is up and the fight begins, never before.
        onStart: () => practice || startFight(tier),
        onNoView: () => (toTitle(), notice("The game's view could not start on this device. Reload the page to try again.")) },
      (_result, _world, host) => toResult(settled, host)
    )
  );
}

// The result card goes up over the fight (fight.js showResult: the garden still drawn under it); the fight is
// only torn down when a button on it leaves, by the next show().
function toResult(info, host = null) {
  const on = (fn) => (host ? fn(host) : show(fn));
  on((root) =>
    renderResult(root, info, {
      onNext: () => toBlessing(info.tier + 1, false),
      onCamp: toCamp,
      onTitle: () => {
        if (!info.practice && !info.canContinue) endDay({ tier: info.tier, won: info.result.won, time: Math.round(info.result.time) });
        toTitle();
      },
      onRetry: () => toBlessing(info.tier, true, info.spec?.id), // (the same boss again, a preview one too)
    })
  );
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------
async function boot() {
  load();
  const save = getSave();
  setEnabled(save.settings.sound);
  setMusic(save.settings.music);
  window.addEventListener("tb-settings", () => {
    const s = getSave();
    setEnabled(s.settings.sound);
    setMusic(s.settings.music);
  });

  const bar = document.getElementById("load-bar");
  const what = document.getElementById("load-what");
  await buildArt((k, name) => {
    if (bar) bar.style.width = `${Math.round(k * 100)}%`;
    if (what && name) what.textContent = name;
  });
  document.getElementById("loading")?.classList.add("is-done");
  setTimeout(() => document.getElementById("loading")?.remove(), 700);

  // One input for the whole session; the fight screen turns it on and off.
  input = makeInput(document.body);
  input.enabled = false;
  document.body.classList.toggle("is-touch", isTouchDevice());
  // Any first gesture wakes the audio, as browsers insist.
  const wake = () => (unlock(), window.removeEventListener("pointerdown", wake), window.removeEventListener("keydown", wake));
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);

  // The admin menu is always available: a daily game has to be testable on the device it is
  // played on. Everything it starts is a practice run, so it can never touch a scored one.
  installAdminKeys();
  setAdminHandlers({ onJump: ({ boss, phase, blessing, modifier }) => toFight(BOSSES[boss]?.tier || 1, blessing, true, { boss, phase, modifier }) });

  // `?practice=1` (a boss's place in BOSS_ORDER) drops straight into a practice fight with that boss — for looking at a fight
  // (on a phone, in a headless capture) without clicking through. Practice never touches the day.
  // `?practice=king` (any boss with a model, by name) drops into a practice fight with that one.
  const pq = new URLSearchParams(location.search).get("practice");
  const practice = Number(pq);
  if (practice >= 1 && practice <= BOSS_ORDER.length) {
    save.seenHelp = true;
    toFight(practice, null, true);
    return;
  }
  if (pq && BOSSES[pq]) {
    save.seenHelp = true;
    toFight(BOSSES[pq].tier || 1, null, true, { boss: pq });
    return;
  }
  toTitle();
  if (!save.seenHelp) {
    save.seenHelp = true;
    persist();
    setTimeout(() => renderHelp(modal, () => (modal.innerHTML = "")), 700);
  }
}

boot();
