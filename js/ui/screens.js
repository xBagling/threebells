// The small screens between fights: choosing the day's blessing, the results, and how to play.
import { html, raw, mmss, untilNext } from "../util.js?v=8898846";
import { sfx } from "../audio.js?v=8898846";
import { iconCanvas } from "./touch.js?v=8898846";
import { dailyBlessings, dayNumber, weekNumber, weekModifier } from "../daily.js?v=8898846";
import { get as getSave } from "../store.js?v=8898846";
import { ITEMS } from "../content/items.js?v=8898846";
import { BOSS_ORDER } from "../content/bosses.js?v=8898846";

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
  return () => {};
}

/** What happened, what it was worth, and what you can do next. */
export function renderResult(root, { result, spec, tier, gold, drops, practice, canContinue, nextSpec }, { onNext, onCamp, onTitle, onRetry }) {
  const won = result.won;
  const left = result.bossHpLeft / result.bossHpMax;
  const share = shareText({ result, spec, tier, gold, practice });
  root.innerHTML = html`<section class="screen result ${won ? "is-won" : "is-lost"}">
    <div class="rs-mark">${raw(iconCanvas(won ? "bell" : "skull", 46))}</div>
    <div class="rs-kicker">${practice ? "Practice" : won ? "Felled" : "You fell"}</div>
    <h2>${spec.name}</h2>
    ${won ? html`<p class="rs-line">Down in ${mmss(result.time)}${result.clean ? " — and never touched." : ""}</p>` : html`<p class="rs-line">${Math.ceil(left * 100)}% of ${spec.name} still standing.</p>`}

    <div class="rs-grid">
      <div><b>${mmss(result.time)}</b><i>on the clock</i></div>
      <div><b>${result.damageDealt}</b><i>damage dealt</i></div>
      <div><b>${result.hitsTaken}</b><i>hits taken</i></div>
      <div><b>${gold}g</b><i>${practice ? "not banked" : "earned"}</i></div>
    </div>

    ${drops && drops.length
      ? html`<div class="rs-drop">
          <div class="rs-drop-h">It dropped</div>
          ${raw(drops.map((d) => `<div class="rs-drop-row">${iconCanvas(ITEMS[d].icon, 24)}<b>${ITEMS[d].name}</b><i>${ITEMS[d].desc}</i></div>`).join(""))}
        </div>`
      : ""}

    <div class="rs-share">
      <pre data-share>${share}</pre>
      <button class="btn" data-copy type="button">Copy result</button>
    </div>

    <div class="rs-actions">
      ${won && canContinue ? html`<button class="btn btn-go" data-next type="button">Straight on to ${nextSpec ? nextSpec.name : "the next"} →</button>` : ""}
      ${practice ? html`<button class="btn btn-go" data-retry type="button">Again</button>` : ""}
      ${!won && !practice ? html`<div class="rs-tomorrow">Your next life is in ${untilNext()}.</div>` : ""}
      <button class="btn" data-camp type="button">Camp</button>
      <button class="btn btn-quiet" data-title type="button">The hill</button>
    </div>
  </section>`;

  sfx[won ? "bell" : "lose"]();
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
  return () => {};
}

/** Spoiler-free: the boss is the same for everyone, so naming it gives nothing away. */
export function shareText({ result, spec, tier, gold, practice }) {
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
        <div><b>Space</b><span>roll</span></div>
        <div><b>1 · 2</b><span>your slots</span></div>
        <div><b>Esc</b><span>pause</span></div>
      </div>
      <p class="help-foot">On a phone: the stick is wherever your left thumb lands; the four buttons are under your right.</p>
      <button class="btn btn-go" data-close type="button">Got it</button>
    </div>
  </div>`;
  const close = () => (sfx.click(), onClose());
  root.querySelector("[data-close]").onclick = close;
  root.querySelector("[data-modal]").onclick = (e) => {
    if (e.target === e.currentTarget) close();
  };
}
