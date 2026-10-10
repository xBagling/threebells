// The small screens between fights: choosing the day's blessing, the results, and how to play.
import { html, raw, mmss, untilNext } from "../util.js?v=df092a6";
import { sfx } from "../audio.js?v=df092a6";
import { iconCanvas } from "./touch.js?v=df092a6";
import { dailyBlessings, dayNumber, weekNumber, weekModifier } from "../daily.js?v=df092a6";
import { get as getSave } from "../store.js?v=df092a6";
import { ITEMS } from "../content/items.js?v=df092a6";
import { BOSS_ORDER } from "../content/bosses.js?v=df092a6";

/** Pick one of three, the same three everyone is offered today. Only the day's first scored fight
 *  shows this (the pick lasts every fight that day); practice shows it every time, as a free pick. */
export function renderBlessing(root, { spec, tier, practice }, onPick) {
  const day = dayNumber();
  const three = dailyBlessings(day);
  const mod = weekModifier(weekNumber(day));
  root.innerHTML = html`<section class="screen bless">
    <div class="bl-head">
      <div class="bl-kicker">Before the doors open</div>
      <h2>${practice ? "Take one blessing" : "Take today's blessing"}</h2>
      <p class="bl-note">Everyone playing today is offered these three. ${practice ? "This is practice — nothing counts, and your pick for the day stays as it is." : "What you take, or going without, lasts every fight today. Once you step in, the day is spent."}</p>
    </div>
    <div class="bl-cards">
      ${raw(
        three
          .map(
            (b, i) => `<button class="bl-card" data-b="${b.id}" type="button" style="--i:${i}">
              <span class="bl-ic">${iconCanvas(b.icon, 30)}</span>
              <b>${b.name}</b>
              <i>${b.desc}</i>
              <em>${b.long}</em>
            </button>`
          )
          .join("")
      )}
    </div>
    <div class="bl-foot">
      <span class="bl-boss">Next: <b>${spec.name}</b>, ${spec.title}${mod.id !== "none" ? ` · ${mod.name}` : ""}</span>
      <button class="btn btn-quiet" data-none type="button">Go without one</button>
    </div>
  </section>`;
  for (const el of root.querySelectorAll("[data-b]"))
    el.onclick = () => {
      sfx.open();
      el.classList.add("is-taken");
      setTimeout(() => onPick(three.find((b) => b.id === el.dataset.b)), 320);
    };
  root.querySelector("[data-none]").onclick = () => (sfx.click(), onPick(null));
}

/**
 * What happened, what it was worth, and what you can do next — a card of frosted glass over the garden as the fight
 * left it (the owner, 2026-10-09: "Improve the 'Felled' screen to a more pretty interface ... a bit see through so
 * that we can see the arena in the background"; fight.js keeps drawing under it). The numbers count up, the loot comes
 * in one by one with a glint across it.
 */
export function renderResult(root, { result, spec, tier, gold, drops, practice, canContinue, nextSpec }, { onNext, onCamp, onTitle, onRetry }) {
  const won = result.won;
  const left = result.bossHpLeft / result.bossHpMax;
  const share = shareText({ result, spec, tier, gold, practice });
  const secs = Math.round(result.time);
  root.innerHTML = html`<section class="screen result ${won ? "is-won" : "is-lost"}">
    <div class="rs-card">
      <div class="rs-mark"><i class="rs-rays"></i>${raw(won ? BELL_SVG : SKULL_SVG)}</div>
      <div class="rs-kicker">${practice ? (won ? "Practice · felled" : "Practice") : won ? "Felled" : "You fell"}</div>
      <h2 class="rs-name">${spec.name}</h2>
      ${won ? html`<p class="rs-line">Down in ${mmss(result.time)}${result.clean ? " — and never touched." : ""}</p>` : html`<p class="rs-line">${Math.ceil(left * 100)}% of ${spec.name} still standing.</p>`}

      <div class="rs-grid">
        <div style="--i:0"><b data-count="${secs}" data-clock>${mmss(result.time)}</b><i>on the clock</i></div>
        <div style="--i:1"><b data-count="${result.damageDealt}">${result.damageDealt}</b><i>damage dealt</i></div>
        <div style="--i:2"><b data-count="${result.hitsTaken}">${result.hitsTaken}</b><i>hits taken</i></div>
        <div style="--i:3"><b data-count="${result.hpLeft != null ? Math.ceil(result.hpLeft) : 0}">${result.hpLeft != null ? Math.ceil(result.hpLeft) : 0}</b><i>health left</i></div>
      </div>

      <div class="rs-loot">
        <div class="rs-loot-h">${won ? "Loot" : "Salvaged"}</div>
        <div class="rs-gold" style="--i:0">${raw(iconCanvas("coin", 26))}<b data-count="${gold}" data-suffix="g">${gold}g</b><i>${practice ? "not banked — practice" : "earned"}</i></div>
        ${raw((drops || []).map((d, i) => `<div class="rs-drop" style="--i:${i + 1}">${iconCanvas(ITEMS[d].icon, 28)}<span><b>${ITEMS[d].name}</b><i>${ITEMS[d].desc}</i></span><em>new</em></div>`).join(""))}
      </div>

      <details class="rs-share">
        <summary>Share the result</summary>
        <pre data-share>${share}</pre>
        <button class="btn" data-copy type="button">Copy result</button>
      </details>

      <div class="rs-actions">
        ${won && canContinue ? html`<button class="btn btn-go" data-next type="button">Straight on to ${nextSpec ? nextSpec.name : "the next"} →</button>` : ""}
        ${practice ? html`<button class="btn btn-go" data-retry type="button">Again</button>` : ""}
        ${!won && !practice ? html`<div class="rs-tomorrow">Your next life is in ${untilNext()}.</div>` : ""}
        <div class="rs-row">
          <button class="btn" data-camp type="button">Camp</button>
          <button class="btn btn-quiet" data-title type="button">The hill</button>
        </div>
      </div>
    </div>
  </section>`;

  sfx[won ? "bellSmall" : "lose"]();
  const $ = (s) => root.querySelector(s);
  $("[data-camp]").onclick = () => (sfx.click(), onCamp());
  $("[data-title]").onclick = () => (sfx.click(), onTitle());
  if ($("[data-next]")) $("[data-next]").onclick = () => (sfx.click(), onNext());
  if ($("[data-retry]")) $("[data-retry]").onclick = () => (sfx.click(), onRetry());
  $("[data-copy]").onclick = async () => {
    try {
      await navigator.clipboard.writeText(share);
      $("[data-copy]").textContent = "Copied";
    } catch {
      $("[data-copy]").textContent = "Select it and copy";
    }
    sfx.click();
  };
  // The numbers count up from nothing as their tiles come in (what is written above is the end: without a clock, as
  // in the tests, that is what shows).
  const counts = root.querySelectorAll?.("[data-count]") || [];
  if (counts.length && typeof requestAnimationFrame === "function") {
    const t0 = performance.now() + 250;
    const show = (el, v) => (el.textContent = el.hasAttribute("data-clock") ? mmss(v) : `${Math.round(v)}${el.dataset.suffix || ""}`);
    const tick = (now) => {
      let going = false;
      counts.forEach((el, i) => {
        const k = Math.min(1, Math.max(0, (now - t0 - i * 90) / 900));
        show(el, Number(el.dataset.count) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) going = true;
      });
      if (going && root.isConnected !== false) requestAnimationFrame(tick);
    };
    counts.forEach((el) => show(el, 0));
    requestAnimationFrame(tick);
  }
}

// The result card's mark, drawn smooth (the owner, 2026-10-09: the pixel bell was "too pixly"): a gold bell, lit from
// the top left, with its clapper swinging; for a loss, a pale skull.
const BELL_SVG = `<svg class="rs-icon" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="rsBell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#ffd66b"/><stop offset=".75" stop-color="#d99a22"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>
    <linearGradient id="rsLip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9801c"/><stop offset=".4" stop-color="#ffe7a0"/><stop offset="1" stop-color="#a06a14"/></linearGradient>
  </defs>
  <path d="M32 5a4 4 0 0 1 4 4v2.2c9 1.9 14.5 9.6 14.5 19.3 0 8.4 2.4 13.2 6.2 16.7 1 .9.4 2.6-1 2.6H8.3c-1.4 0-2-1.7-1-2.6 3.8-3.5 6.2-8.3 6.2-16.7 0-9.7 5.5-17.4 14.5-19.3V9a4 4 0 0 1 4-4z" fill="url(#rsBell)" stroke="#5a3a08" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M19 27c.6-6 4.2-10.6 9.5-12" fill="none" stroke="#fffbe8" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
  <rect x="6.5" y="47.5" width="51" height="5.5" rx="2.75" fill="url(#rsLip)" stroke="#5a3a08" stroke-width="1.4"/>
  <circle cx="35" cy="57.5" r="4.6" fill="url(#rsBell)" stroke="#5a3a08" stroke-width="1.4"/>
</svg>`;
const SKULL_SVG = `<svg class="rs-icon" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="rsBone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf4e6"/><stop offset=".6" stop-color="#d9cdb6"/><stop offset="1" stop-color="#8f8372"/></linearGradient></defs>
  <path d="M32 6C18.7 6 9 15.3 9 28c0 7.4 3.2 12.4 8 15.4V52a4 4 0 0 0 4 4h22a4 4 0 0 0 4-4v-8.6c4.8-3 8-8 8-15.4C55 15.3 45.3 6 32 6z" fill="url(#rsBone)" stroke="#3a2f2a" stroke-width="1.6" stroke-linejoin="round"/>
  <ellipse cx="22.5" cy="30" rx="6.2" ry="7" fill="#2a1a1c"/><ellipse cx="41.5" cy="30" rx="6.2" ry="7" fill="#2a1a1c"/>
  <path d="M32 37.5l-3.6 6.5h7.2z" fill="#2a1a1c"/>
  <path d="M25 49v6M32 49v6M39 49v6" stroke="#3a2f2a" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Spoiler-free: the boss is the same for everyone, so naming it gives nothing away. */
function shareText({ result, spec, tier, gold, practice }) {
  const save = getSave();
  const week = weekNumber();
  const roman = ["I", "II", "III"][tier - 1] || "?";
  // A bell for one you felled, a skull for the one that stopped you, a blank for one still standing.
  // On a victory lap the week's three bells are all rung already, so the marks are today's run
  // instead, or a death on the lap would never show: the lap goes from Boss I in order, so the ones
  // before this fight were felled on the way to it. (The win that clears the week reads the same
  // either way.) Practice keeps the week's marks.
  const lap = !practice && save.week.cleared.length === BOSS_ORDER.length;
  const felled = (t) => (lap ? t < tier || (t === tier && result.won) : save.week.cleared.includes(t));
  const marks = BOSS_ORDER.map((_, i) => i + 1).map((t) => (felled(t) ? "🔔" : t === tier && !result.won ? "💀" : "⬛")).join("");
  const bar = result.won ? "" : ` · ${Math.ceil((result.bossHpLeft / result.bossHpMax) * 100)}% left`;
  return [`Three Bells · week ${week}`, `${marks}  ${spec.name} (${roman})${bar}`, `⏱ ${mmss(result.time)} · ⚔ ${result.damageDealt}${result.clean ? " · untouched" : ` · ${result.hitsTaken} hits taken`}`].join("\n");
}

export function renderHelp(root, onClose) {
  root.innerHTML = html`<div class="modal" data-modal>
    <div class="modal-box">
      <h2>How this goes</h2>
      <ol class="help-list">
        <li><b>Three bosses a week.</b> The same three come back every Monday with a new twist, and the week starts again from the first. Everything you earn is kept.</li>
        <li><b>One life a day.</b> The attempt is spent the moment the fight starts. Die and you come back tomorrow, better geared and knowing more.</li>
        <li><b>Win and carry straight on.</b> Your health refills and the next boss opens the same day.</li>
        <li><b>Practise any time.</b> Any boss you have reached this week, from the hill, as often as you like. It never counts and pays nothing.</li>
        <li><b>The roll is the game.</b> There is a window in the middle of it where nothing can touch you. Learn where it is.</li>
        <li><b>Everything red on the floor is honest.</b> What is drawn is what will hurt, and it is drawn long enough to leave.</li>
        <li><b>Gold is never wasted.</b> Even a death pays, scaled to how far you got.</li>
      </ol>
      <div class="help-keys">
        <div><b>WASD</b><span>move</span></div>
        <div><b>Mouse</b><span>aim</span></div>
        <div><b>Click / J</b><span>attack</span></div>
        <div><b>Shift</b><span>roll</span></div>
        <div><b>Space</b><span>jump</span></div>
        <div><b>1 · 2</b><span>your slots</span></div>
        <div><b>Esc</b><span>pause</span></div>
      </div>
      <p class="help-foot">On a phone: the stick is wherever your left thumb lands; the buttons are under your right — the small one jumps.</p>
      <button class="btn btn-go" data-close type="button">Got it</button>
    </div>
  </div>`;
  const close = () => (sfx.click(), onClose());
  root.querySelector("[data-close]").onclick = close;
  root.querySelector("[data-modal]").onclick = (e) => {
    if (e.target === e.currentTarget) close();
  };
}
