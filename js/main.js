// The shell: which screen is up, and what the day allows.
//
//   the hill (title) → take a blessing → the fight → what happened → camp, or straight on
//
// One life a day. It is spent the moment a fight starts, so closing the tab mid-fight costs it —
// which is the whole point of a daily. And one blessing a day: taken before the day's first fight,
// it lasts every fight after it.
import { buildArt } from "./gfx/atlas.js?v=79a60b0-466c2a40";
import { makeInput, isTouchDevice } from "./input.js?v=79a60b0-466c2a40";
import { load, get as getSave, rollOver, nextTier, chooseBlessing, startFight, recordWin, recordLoss, endDay, playerMods, persist } from "./store.js?v=79a60b0-466c2a40";
import { dayNumber, weekNumber, weekModifier, fightSeed, practiceSeed } from "./daily.js?v=79a60b0-466c2a40";
import { BOSS_ORDER, BOSSES } from "./content/bosses.js?v=79a60b0-466c2a40";
import { BOSS_DROPS } from "./content/items.js?v=79a60b0-466c2a40";
import { BLESSINGS, blessedMods } from "./content/blessings.js?v=79a60b0-466c2a40";
import { renderTitle } from "./ui/title.js?v=79a60b0-466c2a40";
import { renderCamp } from "./ui/camp.js?v=79a60b0-466c2a40";
import { renderCamp2 } from "./ui/camp2.js?v=79a60b0-466c2a40";
import { renderBlessing, renderResult, renderHelp } from "./ui/screens.js?v=79a60b0-466c2a40";
import { runFight } from "./ui/fight.js?v=79a60b0-466c2a40";
import { sfx, setEnabled, setMusic, unlock, stopMusicCues } from "./audio.js?v=79a60b0-466c2a40";
import { installAdminKeys, setAdminHandlers } from "./ui/admin.js?v=79a60b0-466c2a40";
import { html } from "./util.js?v=79a60b0-466c2a40";
import { PLAYER } from "./config.js?v=79a60b0-466c2a40";
import { canView3D } from "./view-pref.js?v=79a60b0-466c2a40";
import { RELEASE, MODS3D, stampUrl } from "./release.js?v=79a60b0-466c2a40";

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

// The published site names a version in every file's address (release.js; js/boot.js sets __TB_RELEASE before this module
// loads): every art/, art3d/ or audio/ address the game fetches by itself, through fetch and three.js's loaders. On the dev
// server there is no release and nothing changes.
if (RELEASE && typeof window !== "undefined" && window.fetch) {
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => f(stampUrl(u), o);
}
/** The 3D view's loader, with three.js's default loading manager stamping the release too (a TextureLoader made with no
 *  manager of its own hands back that default one; the bundle does not export it by name). Its modules are asked for all at
 *  once first (release.js MODS3D): found one import level at a time they came in over seven round trips, 0.85 s at 60 ms. */
let modsAsked = false;
function askMods3D() {
  if (modsAsked || !MODS3D.length) return;
  modsAsked = true;
  for (const href of MODS3D) {
    const l = document.createElement("link");
    l.rel = "modulepreload";
    l.href = href;
    document.head.appendChild(l);
  }
}
const load3dModule = () => {
  askMods3D();
  return RELEASE ? import("./gfx3d/three-lib.js?v=79a60b0-466c2a40").then((t) => (new t.TextureLoader().manager.setURLModifier(stampUrl), import("./gfx3d/load3d.js?v=79a60b0-466c2a40"))) : import("./gfx3d/load3d.js?v=79a60b0-466c2a40");
};

function preload3D(bosses = []) {
  if (!loading3D)
    loading3D = load3dModule()
      .then((m) => m.preload3D())
      .then((got) => (view3D = got))
      .catch((err) => {
        loading3D = null;
        throw err;
      });
  // (a boss being tested from the admin menu, or one with a painted arena, has its own model and arena loaded into the same
  // view — the arena alongside the rest, not after it: load3d.js)
  return bosses.length ? load3dModule().then((m) => m.preload3D({ bosses })).then((got) => (view3D = got)) : loading3D;
}
/** A boss whose arena is a painted backdrop not loaded yet (load3d.js: the Ash Floor, the Bog Shrine) — Gnasher's model is always
 *  loaded, so his arena was never asked for (2026-10-14: his fight still showed the garden). A load that came back empty
 *  (null) is not loaded either. */
const ARENA_ART = new Set(["ash", "bog"]);
function needsArena(id) {
  const a = BOSSES[id]?.arena;
  return !!(a && ARENA_ART.has(a) && view3D && !view3D.assets.backdrops?.[a]);
}
/** Anything the boss's fight still lacks: his model, his painted arena, the 3D bell where it would stand (load3d.js missing). */
const needs3D = (id) => !view3D || view3D.missing(id);
/** Can this device draw the fight at all (WebGL2)? Asked once, and remembered. */
const canPlay = () => (canTell3D ??= canView3D());
const NO_VIEW = "This device cannot draw the game: it needs WebGL2, which this browser does not offer.";

function show(fn) {
  teardown();
  teardown = () => {};
  // (every screen starts from nothing held and nothing playing on: a key, a pad button or a thumb still down as the last screen
  // went sent no "up" to this one, and the chest's tune ran on into the next fight)
  input?.reset();
  stopMusicCues();
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
      onCamp2: toCamp2,
      onHelp: () => renderHelp(modal, () => (modal.innerHTML = "")),
      onPractice: (tier, boss) => toBlessing(tier, true, boss), // any boss reached this week, or a preview of one made in 3D
      noView: canPlay() ? "" : NO_VIEW,
    })
  );
  // In the background; a fight waits for it if need be. Then the next scored fight's boss and painted arena (the Bog Shrine:
  // 5 MB), while the hill and the blessing are up — fetched only after the tap, "Begin" sat behind "Setting up the arena…"
  // for the whole of it (2026-10-16: 6 s at 20 Mbit/s).
  if (canPlay())
    preload3D()
      .then(() => preload3D([BOSS_ORDER[Math.min(BOSS_ORDER.length, Math.max(1, nextTier() || 1)) - 1]]))
      .catch(() => {});
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
// `bosses`: the fight's boss, his model and painted arena loaded too; `loaded()`: whether what came back is enough to start
// (a scored fight needs its painted arena — it never goes on in the garden instead).
function preloadThen(go, bosses = [], loaded = () => true) {
  if (pending3D) return;
  pending3D = true;
  let done = false;
  const what = bosses.length ? "arena" : "garden";
  modal.innerHTML = html`<div class="modal load3d" role="dialog" aria-label="Loading">
    <div class="modal-box"><p>Setting up the ${what}…</p><button class="btn btn-quiet" data-cancel type="button">Cancel</button></div>
  </div>`;
  const close = () => ((done = true), (pending3D = false), (modal.innerHTML = ""));
  modal.querySelector("[data-cancel]").onclick = () => (sfx.click(), close());
  const timer = setTimeout(() => {
    if (done) return;
    close();
    notice(`The ${what} is taking too long to load. Check the connection and try again.`);
  }, 20000);
  preload3D(bosses).then(
    () => {
      if (done) return;
      clearTimeout(timer);
      close();
      if (loaded()) go();
      else notice(`The ${what} could not load. Check the connection and try again.`);
    },
    () => {
      if (done) return;
      clearTimeout(timer);
      close();
      notice(`The ${what} could not load. Check the connection and try again.`);
    }
  );
}

function toCamp() {
  show((root) => renderCamp(root, { onBack: toTitle }));
}

// Camp 2.0 (the owner, 2026-10-12): the village to walk round, next to the old camp (which stays). It needs the 3D view and
// the village's painting loaded first (load3d.js preloadCamp), behind the same small card a fight waits behind.
let campLoading = false;
function toCamp2() {
  if (!canPlay()) return notice(NO_VIEW);
  if (campLoading) return;
  campLoading = true;
  modal.innerHTML = html`<div class="modal load3d" role="dialog" aria-label="Loading"><div class="modal-box"><p>Walking into the village…</p></div></div>`;
  load3dModule() // (the published site's addresses stamped, the modules asked for at once: as a fight's)
    .then((m) => m.preloadCamp())
    .then(
      (r) => {
        campLoading = false;
        modal.innerHTML = "";
        show((root) => renderCamp2(root, { input, makeRenderer: r.makeRenderer, onBack: toTitle }));
      },
      () => {
        campLoading = false;
        modal.innerHTML = "";
        notice("The village could not load. Check the connection and try again.");
      }
    );
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
  // its model and its painted arena first (once), behind the loading card — extra taps meanwhile do nothing: then the fight.
  // A failed load starts no scored fight (the day's life is not spent on the garden); practice may go on in the garden.
  if (!extra.loaded && needs3D(spec.id)) return preloadThen(() => toFight(tier, blessing, practice, { ...extra, loaded: true }), [spec.id], () => practice || !needsArena(spec.id));
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
  // `?camp2=1` walks straight into Camp 2.0's village (for a look on a phone or a headless capture).
  if (new URLSearchParams(location.search).get("camp2") === "1") {
    save.seenHelp = true;
    toCamp2();
    return;
  }
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
