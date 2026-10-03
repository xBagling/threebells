// The admin menu: everything that would otherwise mean playing the game to get somewhere.
//
// Open it with `~` (or a five-finger tap on a phone), or land on any page with #admin. It is not
// hidden behind a build flag on purpose — a daily game has to be testable on the device it will
// be played on, and the things in here cost nothing to ship: none of them can touch a scored run,
// because everything they start is a practice run.
//
// What it is for, in order of how often it gets used:
//  · jump straight into any boss, at any phase, with any blessing
//  · make yourself unkillable, or make the boss paper, while you read an attack
//  · step a single frame at a time through a wind-up
//  · skip the day, hand yourself gold, unlock every item, wipe the save
//  · look at the art sheet and the renderer bench
import { html, raw } from "../util.js?v=8898846";
import { sfx } from "../audio.js?v=8898846";
import { BOSSES, MODELLED } from "../content/bosses.js?v=8898846";

/** The bosses to test: every one with a 3D model (the game offers only BOSS_ORDER; here any of them). */
const TEST_BOSSES = MODELLED.filter((id) => BOSSES[id]).sort((a, b) => BOSSES[a].tier - BOSSES[b].tier);
import { BLESSINGS } from "../content/blessings.js?v=8898846";
import { ITEMS, ITEM_IDS } from "../content/items.js?v=8898846";
import { MODIFIERS, dayNumber, weekNumber } from "../daily.js?v=8898846";
import { get as getSave, persist, wipe, setSlot } from "../store.js?v=8898846";

/** Live switches the fight loop and the sim read every frame. Off by default, all of them. */
export const DEBUG = {
  god: false, // nothing can hurt you
  oneShot: false, // your first hit kills the boss
  slow: 1, // time scale
  step: false, // frozen; `.` advances one tick
  stepOnce: false,
  showHitboxes: false,
  showLights: false,
  freezeBoss: false,
  noEnrage: false,
  fps: false,
};

let host = null;
let onJump = null;
let state = { boss: TEST_BOSSES[0], phase: 0, blessing: null, modifier: "none" };

export function setAdminHandlers(handlers) {
  onJump = handlers.onJump;
}

const row = (label, body) => html`<div class="ad-row"><span class="ad-k">${label}</span><span class="ad-v">${raw(body)}</span></div>`;
const toggle = (key, label) => `<button class="ad-t ${DEBUG[key] ? "is-on" : ""}" data-toggle="${key}">${label}</button>`;

export function isAdminOpen() {
  return !!host;
}

export function closeAdmin() {
  if (!host) return;
  host.remove();
  host = null;
}

export function openAdmin() {
  if (host) return closeAdmin();
  const save = getSave();
  host = document.createElement("div");
  host.className = "admin";
  host.innerHTML = html`<div class="ad-box" role="dialog" aria-label="Admin">
    <header class="ad-head">
      <b>Admin</b>
      <span class="ad-sub">day ${dayNumber()} · week ${weekNumber()} · ${save.gold}g</span>
      <button class="ad-x" data-close type="button" aria-label="Close">✕</button>
    </header>

    <div class="ad-body">
      ${raw(
        row(
          "Fight",
          `<div class="ad-chips">${TEST_BOSSES.map((id) => `<button class="ad-c ${state.boss === id ? "is-on" : ""}" data-boss="${id}">${["I", "II", "III"][BOSSES[id].tier - 1] || ""} ${BOSSES[id].name}</button>`).join("")}</div>`
        )
      )}
      ${raw(
        row(
          "Start at",
          `<div class="ad-chips">${["100%", "60%", "30%"].map((l, i) => `<button class="ad-c ${state.phase === i ? "is-on" : ""}" data-phase="${i}">${l}</button>`).join("")}</div>`
        )
      )}
      ${raw(
        row(
          "Blessing",
          `<div class="ad-chips"><button class="ad-c ${!state.blessing ? "is-on" : ""}" data-bless="">none</button>${Object.values(BLESSINGS)
            .map((b) => `<button class="ad-c ${state.blessing === b.id ? "is-on" : ""}" data-bless="${b.id}">${b.name}</button>`)
            .join("")}</div>`
        )
      )}
      ${raw(
        row(
          "Affix",
          `<div class="ad-chips">${Object.values(MODIFIERS)
            .map((m) => `<button class="ad-c ${state.modifier === m.id ? "is-on" : ""}" data-mod="${m.id}">${m.name}</button>`)
            .join("")}</div>`
        )
      )}
      <button class="btn btn-go ad-go" data-go type="button">Drop into the fight →</button>

      ${raw(
        row(
          "While fighting",
          `<div class="ad-chips">
            ${toggle("god", "God")}
            ${toggle("oneShot", "One-shot")}
            ${toggle("freezeBoss", "Freeze boss")}
            ${toggle("noEnrage", "No enrage")}
            ${toggle("showHitboxes", "Hitboxes")}
            ${toggle("showLights", "Lights")}
            ${toggle("fps", "FPS")}
          </div>`
        )
      )}
      ${raw(
        row(
          "Time",
          `<div class="ad-chips">${[0.15, 0.35, 1, 2]
            .map((v) => `<button class="ad-c ${DEBUG.slow === v ? "is-on" : ""}" data-slow="${v}">${v}×</button>`)
            .join("")}${toggle("step", "Frame step")}<span class="ad-note">then <b>.</b> for one frame</span></div>`
        )
      )}

      ${raw(
        row(
          "Save",
          `<div class="ad-chips">
            <button class="ad-c" data-gold="500">+500g</button>
            <button class="ad-c" data-gold="5000">+5000g</button>
            <button class="ad-c" data-unlock>Unlock every item</button>
            <button class="ad-c" data-freeday>Reopen today</button>
            <button class="ad-c" data-clearweek>Clear the week</button>
            <button class="ad-c ad-danger" data-wipe>Wipe</button>
          </div>`
        )
      )}
      ${raw(
        row(
          "Tools",
          `<div class="ad-chips">
            <a class="ad-c" href="dev-art.html" target="_blank" rel="noopener">Art sheet</a>
            <a class="ad-c" href="dev-fight.html?bot=1&t=20" target="_blank" rel="noopener">Renderer bench</a>
            <a class="ad-c" href="dev-fight.html?shapes=1&t=2" target="_blank" rel="noopener">Telegraph shapes</a>
          </div>`
        )
      )}
      <div class="ad-msg" data-msg aria-live="polite"></div>
      <div class="ad-keys"><b>~</b> admin · <b>.</b> one frame · <b>Esc</b> close</div>
    </div>
  </div>`;
  document.body.append(host);
  sfx.open();

  const $ = (s) => host.querySelector(s);
  const msg = (t) => ($("[data-msg]").textContent = t);
  const redraw = () => {
    closeAdmin();
    openAdmin();
  };

  $("[data-close]").onclick = closeAdmin;
  host.addEventListener("click", (e) => {
    if (e.target === host) closeAdmin();
  });
  for (const el of host.querySelectorAll("[data-boss]")) el.onclick = () => ((state.boss = el.dataset.boss), redraw());
  for (const el of host.querySelectorAll("[data-phase]")) el.onclick = () => ((state.phase = +el.dataset.phase), redraw());
  for (const el of host.querySelectorAll("[data-bless]")) el.onclick = () => ((state.blessing = el.dataset.bless || null), redraw());
  for (const el of host.querySelectorAll("[data-mod]")) el.onclick = () => ((state.modifier = el.dataset.mod), redraw());
  for (const el of host.querySelectorAll("[data-toggle]"))
    el.onclick = () => {
      DEBUG[el.dataset.toggle] = !DEBUG[el.dataset.toggle];
      el.classList.toggle("is-on", DEBUG[el.dataset.toggle]);
      sfx.click();
    };
  for (const el of host.querySelectorAll("[data-slow]"))
    el.onclick = () => {
      DEBUG.slow = +el.dataset.slow;
      redraw();
    };
  for (const el of host.querySelectorAll("[data-gold]"))
    el.onclick = () => {
      getSave().gold += +el.dataset.gold;
      persist();
      sfx.coin();
      redraw();
    };
  $("[data-unlock]").onclick = () => {
    const s = getSave();
    s.items = [...ITEM_IDS];
    persist();
    sfx.coin();
    msg("every item unlocked");
  };
  $("[data-freeday]").onclick = () => {
    const s = getSave();
    s.today.done = false;
    s.today.used = false;
    s.today.live = 0; // a fight still on as the day reopens must not count as left on the next load
    s.today.left = false;
    s.today.blessing = null; // and the day's blessing is picked again
    persist();
    msg("today is open again");
    sfx.click();
  };
  $("[data-clearweek]").onclick = () => {
    const s = getSave();
    s.week.cleared = [];
    persist();
    msg("the week is standing again");
    sfx.click();
  };
  let armed = false;
  $("[data-wipe]").onclick = (e) => {
    if (!armed) {
      armed = true;
      e.target.textContent = "Really?";
      return;
    }
    wipe();
    sfx.deny();
    msg("wiped");
  };
  $("[data-go]").onclick = () => {
    sfx.click();
    closeAdmin();
    onJump?.({ boss: state.boss, phase: state.phase, blessing: state.blessing ? BLESSINGS[state.blessing] : null, modifier: MODIFIERS[state.modifier] });
  };
}

/** Wire the keys once, from main. */
export function installAdminKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote" || (e.key === "~" && !e.repeat)) {
      e.preventDefault();
      openAdmin();
    } else if (e.code === "Escape" && host) {
      closeAdmin();
    } else if (e.code === "Period" && DEBUG.step) {
      DEBUG.stepOnce = true;
    }
  });
  // A five-finger tap on a phone, which nothing else in the game uses.
  window.addEventListener("touchstart", (e) => {
    if (e.touches.length >= 5) openAdmin();
  });
  if (location.hash === "#admin") setTimeout(openAdmin, 400);
}
