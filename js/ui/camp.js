// Camp: where the gold goes. Two slots to fill, a peddler with things to unlock, a smith with
// three upgrade tracks, your record, and the save code.
//
// Nothing here can be bought with money — only with gold you earned in a fight. The fight has to be
// the same fight for everybody.
import { html, raw } from "../util.js?v=8898846";
import { sfx } from "../audio.js?v=8898846";
import { ITEMS, ITEM_IDS } from "../content/items.js?v=8898846";
import { get as getSave, buyItem, buyUpgrade, setSlot, setSetting, UPGRADES, exportCode, importCode, wipe } from "../store.js?v=8898846";
import { iconCanvas } from "./touch.js?v=8898846";
import { BOSS_ORDER, BOSSES } from "../content/bosses.js?v=8898846";
import { dayLabel } from "../daily.js?v=8898846";

export function renderCamp(root, { onBack }) {
  let picking = null; // which slot is waiting for a choice

  function draw() {
    const save = getSave();
    const owned = ITEM_IDS.filter((id) => save.items.includes(id));
    const locked = ITEM_IDS.filter((id) => !save.items.includes(id));

    const slotCard = (i) => {
      const id = save.loadout[i];
      const it = id ? ITEMS[id] : null;
      return html`<button class="slot-card ${picking === i ? "is-picking" : ""} ${it ? "" : "is-empty"}" data-pick="${i}" type="button">
        <span class="sc-key">${i + 1}</span>
        <span class="sc-ic">${raw(it ? iconCanvas(it.icon, 34) : "")}</span>
        <span class="sc-name">${it ? it.name : "Empty"}</span>
        <span class="sc-desc">${it ? it.desc : "Tap to fill"}</span>
      </button>`;
    };

    const itemRow = (id, ownedNow) => {
      const it = ITEMS[id];
      const inUse = save.loadout.includes(id);
      const canBuy = !ownedNow && save.gold >= it.cost && it.unlock === "shop";
      const fromBoss = !ownedNow && it.unlock !== "shop" && it.unlock !== "start";
      return html`<div class="shop-row ${ownedNow ? "is-owned" : "is-locked"}">
        <span class="sr-ic">${raw(iconCanvas(it.icon, 26))}</span>
        <span class="sr-text">
          <b>${it.name}</b>
          <i>${it.desc}${it.charges != null ? ` · ${it.charges} a fight` : it.cooldown ? ` · ${it.cooldown}s` : ""}</i>
          <em>${it.long}</em>
        </span>
        ${ownedNow
          ? html`<span class="sr-tag">${inUse ? "Carried" : "Owned"}</span>`
          : fromBoss
            ? html`<span class="sr-tag sr-drop">Fell ${BOSSES[it.unlock]?.name || it.unlock}</span>`
            : html`<button class="btn btn-buy" data-buy="${id}" type="button" ${canBuy ? "" : raw("disabled")}>${it.cost}g</button>`}
      </div>`;
    };

    const upgradeRow = (key) => {
      const u = UPGRADES[key];
      const lvl = save.upgrades[key] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : u.cost(lvl);
      return html`<div class="shop-row">
        <span class="sr-ic">${raw(iconCanvas(u.icon, 26))}</span>
        <span class="sr-text">
          <b>${u.name} ${raw(`<span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</span>`)}</b>
          <i>${u.desc}</i>
        </span>
        ${maxed ? html`<span class="sr-tag">Full</span>` : html`<button class="btn btn-buy" data-up="${key}" type="button" ${save.gold >= cost ? "" : raw("disabled")}>${cost}g</button>`}
      </div>`;
    };

    root.innerHTML = html`<section class="screen camp">
      <header class="sc-head">
        <button class="btn btn-back" data-back type="button">← Back</button>
        <h2>Camp</h2>
        <span class="sc-gold">${raw(iconCanvas("coin", 16))} ${save.gold}</span>
      </header>

      <div class="sc-body">
        <h3 class="sc-h3">What you carry</h3>
        <p class="sc-note">Two buttons. Everything else is your sword and your roll.</p>
        <div class="slot-row">${raw(slotCard(0))}${raw(slotCard(1))}</div>
        ${picking != null
          ? html`<div class="picker">
              <div class="picker-head">Put in slot ${picking + 1}</div>
              <div class="picker-list">
                <button class="pick-item" data-set="" type="button"><span>Empty</span></button>
                ${raw(owned.map((id) => `<button class="pick-item ${save.loadout[picking] === id ? "is-on" : ""}" data-set="${id}" type="button">${iconCanvas(ITEMS[id].icon, 22)}<span>${ITEMS[id].name}</span></button>`).join(""))}
              </div>
            </div>`
          : ""}

        <h3 class="sc-h3">The peddler</h3>
        ${raw(owned.map((id) => itemRow(id, true)).join(""))}
        ${raw(locked.map((id) => itemRow(id, false)).join(""))}

        <h3 class="sc-h3">The smith</h3>
        <p class="sc-note">Small, permanent, and never enough to win a fight for you.</p>
        ${raw(Object.keys(UPGRADES).map(upgradeRow).join(""))}

        <h3 class="sc-h3">The week</h3>
        <div class="week-grid">
          ${raw(
            BOSS_ORDER.map((id, i) => {
              const b = BOSSES[id];
              const felled = save.week.cleared.includes(i + 1);
              return `<div class="week-cell ${felled ? "is-felled" : ""}">
                <b>${["I", "II", "III"][i]}</b><span>${b.name}</span>
                <i>${felled ? "Felled" : "Standing"}</i>
              </div>`;
            }).join("")
          )}
        </div>

        <h3 class="sc-h3">Your record</h3>
        <p class="sc-note">How often each has fallen to you, and the day it first did.</p>
        <div class="week-grid">
          ${raw(
            BOSS_ORDER.map((id) => {
              const n = save.kills[id] || 0;
              const first = save.firsts[id];
              return `<div class="week-cell ${n ? "is-felled" : ""}">
                <b>${n}</b><span>${BOSSES[id].name}</span>
                <i>${first ? `First ${dayLabel(first)}` : "Not yet"}</i>
              </div>`;
            }).join("")
          )}
        </div>
        <div class="record-weeks"><span>Weeks cleared</span><b>${save.weeksCleared || 0}</b></div>

        <h3 class="sc-h3">Keep your save</h3>
        <p class="sc-note">Gear and gold live in this browser. Copy the code somewhere safe.</p>
        <div class="save-row">
          <input class="save-code" data-code readonly value="${exportCode()}" aria-label="Your save code" />
          <button class="btn" data-copy type="button">Copy</button>
        </div>
        <div class="save-row">
          <input class="save-code" data-in placeholder="Paste a save code" aria-label="Paste a save code" />
          <button class="btn" data-load type="button">Load</button>
        </div>
        <div class="sc-msg" data-msg aria-live="polite"></div>

        <h3 class="sc-h3">Settings</h3>
        ${raw(
          [
            ["sound", "Sound"],
            ["music", "The drone under the fight"],
            ["holdToAttack", "Hold to keep swinging"],
          ]
            .map(([k, label]) => `<label class="opt"><input type="checkbox" data-opt="${k}" ${save.settings[k] ? "checked" : ""}><span>${label}</span></label>`)
            .join("")
        )}
        <label class="opt"><input type="checkbox" data-opt="hand" ${save.settings.hand === "left" ? "checked" : ""}><span>Left-handed on-screen controls</span></label>
        <label class="opt opt-range"><span>Screen shake</span><input type="range" min="0" max="1.4" step="0.1" data-shake value="${save.settings.shake}"></label>
        <button class="btn btn-quiet btn-wipe" data-wipe type="button">Start again from nothing</button>
      </div>
    </section>`;

    const $ = (s) => root.querySelector(s);
    const msg = (t) => ($("[data-msg]").textContent = t);
    $("[data-back]").onclick = () => (sfx.click(), onBack());
    for (const el of root.querySelectorAll("[data-pick]")) el.onclick = () => (sfx.click(), (picking = picking === +el.dataset.pick ? null : +el.dataset.pick), draw());
    for (const el of root.querySelectorAll("[data-set]"))
      el.onclick = () => {
        setSlot(picking, el.dataset.set || null);
        sfx.click();
        picking = null;
        draw();
      };
    for (const el of root.querySelectorAll("[data-buy]"))
      el.onclick = () => {
        if (buyItem(el.dataset.buy)) (sfx.coin(), msg(`${ITEMS[el.dataset.buy].name} is yours.`), draw());
        else sfx.deny();
      };
    for (const el of root.querySelectorAll("[data-up]"))
      el.onclick = () => {
        if (buyUpgrade(el.dataset.up)) (sfx.coin(), draw());
        else sfx.deny();
      };
    for (const el of root.querySelectorAll("[data-opt]"))
      el.onchange = () => {
        const k = el.dataset.opt;
        setSetting(k, k === "hand" ? (el.checked ? "left" : "right") : el.checked);
        window.dispatchEvent(new CustomEvent("tb-settings"));
      };
    $("[data-shake]").oninput = (e) => setSetting("shake", Number(e.target.value));
    $("[data-copy]").onclick = async () => {
      const el = $("[data-code]");
      el.select();
      try {
        await navigator.clipboard.writeText(el.value);
        msg("Copied.");
      } catch {
        msg("Select it and copy by hand.");
      }
      sfx.click();
    };
    $("[data-load]").onclick = () => {
      const v = $("[data-in]").value;
      if (!v.trim()) return;
      if (importCode(v)) (sfx.coin(), msg("Loaded."), draw());
      else (sfx.deny(), msg("That code did not read."));
    };
    let armed = false;
    $("[data-wipe]").onclick = (e) => {
      if (!armed) {
        armed = true;
        e.target.textContent = "Really? This cannot be undone.";
        e.target.classList.add("is-armed");
        return;
      }
      wipe();
      sfx.deny();
      draw();
    };
  }

  draw();
  return () => {};
}
