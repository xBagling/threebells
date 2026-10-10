// The frame round the fight: your health and stamina at the bottom left (bottom right when the
// left-handed touch controls put their buttons there), the boss's bar across the top, the clock,
// and whatever the fight has to say.
//
// It is DOM rather than canvas, so text stays crisp and a screen reader has something to read; the
// icons in it are the same pixel sprites the game draws with.
import { html, raw, clamp, mmss } from "../util.js?v=df092a6";
import { HEART_VALUE, FIGHT } from "../config.js?v=df092a6";
import { ITEMS } from "../content/items.js?v=df092a6";
import { iconCanvas } from "./touch.js?v=df092a6";

export function mountHud(root, { spec, modifier, blessing, tier, practice }) {
  root.innerHTML = html`<div class="hud">
    <div class="hud-top">
      <div class="hud-boss">
        <div class="hud-boss-line">
          <span class="hud-tier">${["I", "II", "III"][tier - 1] || "?"}</span>
          <span class="hud-boss-name">${spec.name}</span>
          <span class="hud-boss-hp" data-bosspct>100%</span>
        </div>
        <div class="hud-bar hud-bar-boss"><i data-bosshp style="width:100%"></i><u data-bosschip style="width:100%"></u></div>
        <div class="hud-cast" data-cast hidden><span data-castname>Croak</span><i data-castbar></i></div>
      </div>
      <div class="hud-meta">
        <span class="hud-clock" data-clock>0:00</span>
        ${modifier && modifier.id !== "none" ? html`<span class="hud-affix" title="${modifier.desc}">${modifier.name}</span>` : ""}
        ${blessing ? html`<span class="hud-bless" title="${blessing.desc}">${blessing.name}</span>` : ""}
        ${practice ? raw('<span class="hud-practice">Practice</span>') : ""}
      </div>
    </div>

    <div class="hud-says" data-says aria-live="polite"></div>

    <div class="hud-bottom">
      <div class="hud-vitals">
        <div class="hud-hearts" data-hearts aria-label="Health"></div>
        <div class="hud-bar hud-bar-stam"><i data-stam style="width:100%"></i></div>
      </div>
      <div class="hud-slots" data-slots></div>
    </div>
    <button class="hud-pause" data-pause type="button" aria-label="Pause"><span>❚❚</span></button>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const heartsEl = $("[data-hearts]");
  const stamEl = $("[data-stam]");
  const bossHp = $("[data-bosshp]");
  const bossChip = $("[data-bosschip]");
  const bossPct = $("[data-bosspct]");
  const castWrap = $("[data-cast]");
  const castBar = $("[data-castbar]");
  const castName = $("[data-castname]");
  const clock = $("[data-clock]");
  const says = $("[data-says]");
  const slotsEl = $("[data-slots]");

  let heartN = 0;
  let chip = 1;
  let lastSaid = "";

  function buildHearts(n) {
    heartN = n;
    heartsEl.innerHTML = Array.from({ length: n }, (_, i) => `<span class="hud-heart" data-h="${i}">${iconCanvas("heart", 18)}${iconCanvas("heartEmpty", 18)}</span>`).join("");
  }

  function buildSlots(p, keys) {
    slotsEl.innerHTML = [0, 1]
      .map((i) => {
        const id = p.slots[i];
        const item = id ? ITEMS[id] : null;
        if (!item) return `<div class="hud-slot is-empty"><span class="hud-key">${keys[i]}</span></div>`;
        return `<div class="hud-slot" data-slot="${i}" title="${item.name}">
          ${iconCanvas(item.icon, 22)}
          <span class="hud-key">${keys[i]}</span>
          <span class="hud-slot-cd" data-scd="${i}"></span>
          <span class="hud-slot-n" data-sn="${i}"></span>
        </div>`;
      })
      .join("");
  }

  return {
    buildHearts,
    buildSlots,
    /** Called every animation frame. */
    update(w) {
      const p = w.player;
      const n = Math.max(1, Math.ceil(p.hpMax / HEART_VALUE));
      if (n !== heartN) buildHearts(n);
      const full = p.hp / HEART_VALUE;
      for (let i = 0; i < heartN; i++) {
        const el = heartsEl.children[i];
        const v = clamp(full - i, 0, 1);
        el.style.setProperty("--v", v);
        el.classList.toggle("is-low", i === 0 && v > 0 && v < 0.5);
      }
      stamEl.style.width = `${(p.stamina / p.staminaMax) * 100}%`;
      stamEl.parentElement.classList.toggle("is-spent", p.exhausted);

      const frac = w.boss.hp / w.boss.hpMax;
      bossHp.style.width = `${frac * 100}%`;
      chip += (frac - chip) * 0.08;
      if (chip < frac) chip = frac;
      bossChip.style.width = `${chip * 100}%`;
      bossPct.textContent = `${Math.ceil(frac * 100)}%`;
      bossHp.parentElement.classList.toggle("is-immune", w.boss.immune);

      const c = w.boss.casting;
      castWrap.hidden = !c;
      if (c) {
        castName.textContent = c.name;
        castBar.style.width = `${c.k * 100}%`;
      }

      const left = Math.max(0, FIGHT.enrage - w.time);
      clock.textContent = mmss(left);
      clock.classList.toggle("is-soon", left < 30);
      clock.classList.toggle("is-enraged", w.enraged);
      if (w.enraged) clock.textContent = "ENRAGED";

      const m = w.messages[w.messages.length - 1];
      if (m && m.t < 2.6) {
        if (m.text !== lastSaid) {
          lastSaid = m.text;
          says.innerHTML = `<span class="hud-say">${m.text}</span>`;
        }
        says.style.opacity = m.t > 2 ? String(1 - (m.t - 2) / 0.6) : "1";
      } else {
        says.style.opacity = "0";
        lastSaid = "";
      }

      for (let i = 0; i < 2; i++) {
        const id = p.slots[i];
        if (!id) continue;
        const item = ITEMS[id];
        const cd = slotsEl.querySelector(`[data-scd="${i}"]`);
        const sn = slotsEl.querySelector(`[data-sn="${i}"]`);
        if (!cd) continue;
        const k = clamp(p.cooldowns[i] / ((item.cooldown || 1) * (p.cdScale || 1)), 0, 1); // Well Stocked shortens it
        cd.style.setProperty("--k", k);
        cd.classList.toggle("is-cd", k > 0.001);
        if (item.charges != null) sn.textContent = p.charges[i];
        cd.closest(".hud-slot").classList.toggle("is-spent", (item.charges != null && p.charges[i] <= 0) || k > 0.001);
      }
    },
    onPause(fn) {
      const btn = $("[data-pause]");
      // The fight's input listens on the whole page, so a press on the button would also swing the
      // blade on the way to pausing. The button keeps its presses to itself.
      for (const ev of ["pointerdown", "mousedown", "touchstart"]) btn.addEventListener(ev, (e) => e.stopPropagation());
      btn.addEventListener("click", fn);
    },
  };
}
