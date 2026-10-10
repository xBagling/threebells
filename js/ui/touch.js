// The phone controls: a floating stick under your left thumb, and four buttons under your right —
// attack, roll, and the two slots you filled at camp. The camp's left-handed setting mirrors them.
//
// The stick is floating rather than fixed: it appears wherever your thumb lands in the left half,
// which is the difference between a control that works and one that fights you. How far the thumb
// goes from where it landed is how fast the hero goes: a half push walks, a full push runs.
//
// Every button is at least 56 px and tracks its own pointer id (so two thumbs never steal each
// other's touch). The sword, the roll and most items take effect on press. A thumb dragged off the
// sword or off an item thrown along the aim turns that press into an aimed one (input.js has the
// rules): the sword still swings on the press and the drag steers the swings after it, and such an
// item waits for the thumb to come up, so a drag can choose where it goes and a plain tap still
// throws it at the nearest enemy. A thumb that only rolls about on a button is not a drag.
import { html, raw, clamp } from "../util.js?v=df092a6";
import { ITEMS } from "../content/items.js?v=df092a6";
import { ART } from "../gfx/atlas.js?v=df092a6";

/** The items that go where the hero aims (their use() reads the aim), so a drag can aim them. A
 *  check in tools/test.mjs runs every item and keeps this list honest. */
export const AIMED_ITEMS = new Set(["knives", "bomb", "firebolt", "blink"]);

const iconCanvas = (name, px = 30) => {
  const spr = (ART.icon[name] || ART.icon.star)?.[0];
  if (!spr) return "";
  const c = document.createElement("canvas");
  c.width = spr.w;
  c.height = spr.h;
  c.getContext("2d").drawImage(spr.cv, 0, 0);
  return `<img class="tb-ic" alt="" src="${c.toDataURL()}" style="width:${px}px;height:${(px * spr.h) / spr.w}px">`;
};

export function mountTouch(root, input, { loadout, hand = "right", offAct = "guard", offIcon = null }) {
  const slotBtn = (i) => {
    const id = loadout[i];
    const item = id ? ITEMS[id] : null;
    return html`<button class="pad-btn pad-slot" data-act="slot${i}" type="button" aria-label="${item ? item.name : "Empty slot"}" ${item ? "" : raw("disabled")}>
      <span class="pad-ic">${raw(item ? iconCanvas(item.icon, 26) : "")}</span>
      <span class="pad-cd" data-cd="${i}"></span>
      <span class="pad-n" data-n="${i}"></span>
    </button>`;
  };
  root.innerHTML = html`<div class="pad ${hand === "left" ? "pad-left" : ""}" aria-hidden="false">
    <div class="pad-stick-zone" data-zone="stick">
      <div class="pad-stick is-rest" data-stick><i class="pad-ring"></i><i class="pad-nub"></i></div>
    </div>
    <div class="pad-buttons">
      ${raw(slotBtn(1))} ${raw(slotBtn(0))}
      <button class="pad-btn pad-roll" data-act="roll" type="button" aria-label="Roll">
        <span class="pad-ic">${raw(iconCanvas("roll", 30))}</span>
        <span class="pad-cd" data-cd="roll"></span>
      </button>
      <button class="pad-btn pad-attack" data-act="attack" type="button" aria-label="Attack">
        <span class="pad-ic">${raw(iconCanvas("sword", 38))}</span>
      </button>
      <button class="pad-btn pad-off" data-act="off" type="button" aria-label="${offAct === "guard" ? "Guard" : offAct === "jump" ? "Jump" : "Off-hand attack"}">
        <span class="pad-ic">${raw(iconCanvas(offIcon || (offAct === "guard" ? "shield" : "dagger"), 26))}</span>
      </button>
    </div>
  </div>`;

  const zone = root.querySelector('[data-zone="stick"]');
  const stick = root.querySelector("[data-stick]");
  const nub = root.querySelector(".pad-nub");
  const R = 46; // how far the nub travels, in css pixels
  let stickId = null;
  let ox = 0;
  let oy = 0;

  const setStick = (x, y) => {
    let dx = x - ox;
    let dy = y - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
    // The thumb's offset as a share of the ring. input.js reads it as a walk or a run: nothing in a
    // small dead zone, then faster the further out, and flat out from 85% of the way to the rim.
    input.setStick(dx / R, dy / R);
  };

  // Where the stick waits when no thumb is on it: faint, in the corner of its zone, so it is plain
  // that this side steers. The thumb's position is measured from the zone itself — the stick is drawn
  // inside the zone, and measured from the whole screen it was drawn a zone's height too low, off the
  // bottom of a phone, which is why no stick could be seen under the thumb.
  const rest = () => {
    const r = zone.getBoundingClientRect();
    const left = root.querySelector(".pad-left") !== null;
    stick.classList.add("is-rest");
    stick.style.left = `${left ? r.width - 92 : 92}px`;
    stick.style.top = `${r.height - 104}px`;
    nub.style.transform = "translate(0,0)";
  };
  rest();
  const onResize = () => stickId === null && rest();
  window.addEventListener("resize", onResize);
  const onZoneDown = (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    const r = zone.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    stick.classList.remove("is-rest");
    stick.style.left = `${ox}px`;
    stick.style.top = `${oy}px`;
    nub.style.transform = "translate(0,0)";
    zone.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onZoneMove = (e) => {
    if (e.pointerId !== stickId) return;
    const r = zone.getBoundingClientRect();
    setStick(e.clientX - r.left, e.clientY - r.top);
    e.preventDefault();
  };
  const onZoneUp = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    rest();
    input.setStick(0, 0);
  };
  zone.addEventListener("pointerdown", onZoneDown);
  zone.addEventListener("pointermove", onZoneMove);
  zone.addEventListener("pointerup", onZoneUp);
  zone.addEventListener("pointercancel", onZoneUp);

  // Buttons. Held state matters for attack (hold to keep swinging), and where each thumb went down
  // matters for a drag off it.
  const btns = [...root.querySelectorAll("[data-act]")];
  const owners = new Map(); // pointer id → { act, x, y }
  for (const b of btns) {
    const act = b.dataset.act;
    const id = act === "slot0" ? loadout[0] : act === "slot1" ? loadout[1] : null;
    const aims = act === "attack" || AIMED_ITEMS.has(id);
    const onRelease = aims && act !== "attack";
    b.addEventListener("pointerdown", (e) => {
      if (b.disabled) return;
      owners.set(e.pointerId, { act, x: e.clientX, y: e.clientY });
      // Where on the button the thumb landed, and how big the button is (read before it shrinks
      // under the thumb), so a drag aims only once it has left the button.
      const box = b.getBoundingClientRect();
      const at = [e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2)];
      b.classList.add("is-down");
      input.buttonDown(act, { aims, onRelease, at, r: box.width / 2 });
      b.setPointerCapture?.(e.pointerId);
      if (navigator.vibrate) navigator.vibrate(act === "attack" ? 8 : 12);
      e.preventDefault();
    });
    b.addEventListener("pointermove", (e) => {
      const o = owners.get(e.pointerId);
      if (!o || o.act !== act) return;
      b.classList.toggle("is-aiming", input.buttonMove(act, e.clientX - o.x, e.clientY - o.y));
    });
    // Up is when the thumb comes up, wherever it has gone: dragging off the button is how it aims,
    // so leaving the button is not letting go of it. A touch the browser takes away acts on nothing.
    const up = (cancel) => (e) => {
      const o = owners.get(e.pointerId);
      if (!o || o.act !== act) return;
      owners.delete(e.pointerId);
      b.classList.remove("is-down", "is-aiming");
      input.buttonUp(act, cancel);
    };
    b.addEventListener("pointerup", up(false));
    b.addEventListener("pointercancel", up(true));
    b.addEventListener("lostpointercapture", up(true)); // after a pointerup it finds no owner left
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  const cds = [root.querySelector('[data-cd="0"]'), root.querySelector('[data-cd="1"]')];
  const ns = [root.querySelector('[data-n="0"]'), root.querySelector('[data-n="1"]')];
  const rollCd = root.querySelector('[data-cd="roll"]');

  return {
    /** Keep the buttons honest about cooldowns, charges and stamina. */
    update(p) {
      for (let i = 0; i < 2; i++) {
        const id = p.slots[i];
        if (!id || !cds[i]) continue;
        const item = ITEMS[id];
        const total = (item.cooldown || 1) * (p.cdScale || 1); // Well Stocked shortens it
        const k = clamp(p.cooldowns[i] / total, 0, 1);
        cds[i].style.setProperty("--k", k);
        cds[i].classList.toggle("is-cd", k > 0.001);
        if (item.charges != null) {
          ns[i].textContent = p.charges[i];
          ns[i].classList.toggle("is-out", p.charges[i] <= 0);
        } else ns[i].textContent = "";
        const btn = ns[i].closest(".pad-btn");
        btn.classList.toggle("is-spent", (item.charges != null && p.charges[i] <= 0) || k > 0.001);
      }
      if (rollCd) rollCd.parentElement.classList.toggle("is-spent", p.exhausted || p.stamina < 20);
    },
    destroy() {
      // A thumb still on the stick sends no pointerup once the zone is gone, so let go of it here.
      if (stickId !== null) input.setStick(0, 0);
      window.removeEventListener("resize", onResize);
      zone.removeEventListener("pointerdown", onZoneDown);
      zone.removeEventListener("pointermove", onZoneMove);
      zone.removeEventListener("pointerup", onZoneUp);
      zone.removeEventListener("pointercancel", onZoneUp);
      root.innerHTML = "";
    },
  };
}

export { iconCanvas };
