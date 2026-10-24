// The settings: the same six in the old camp's list and in a card of their own, opened from the hill and from the pause
// card (the owner's pick P06 of the UI review, 2026-10-18: they lived only at the foot of the old camp — not in Camp 2.0,
// not on the hill, not in a fight). A change is saved at once and announced with "tb-settings" (main.js: sound and
// music; fight.js: the left-handed buttons).
import { html, raw } from "../util.js?v=48fd128-df87a96f";
import { sfx } from "../audio.js?v=48fd128-df87a96f";
import { get as getSave, setSetting } from "../store.js?v=48fd128-df87a96f";

const CHECKS = [
  ["sound", "Sound"],
  ["music", "The drone under the fight"],
  ["holdToAttack", "Hold to keep swinging"],
  ["demo", "Demo mode: show the red danger markings"],
];

/** The settings' rows, as markup (the camp puts them under its own heading). */
export function settingsFields() {
  const s = getSave().settings;
  return (
    CHECKS.map(([k, label]) => `<label class="opt"><input type="checkbox" data-opt="${k}" ${s[k] ? "checked" : ""}><span>${label}</span></label>`).join("") +
    `<label class="opt"><input type="checkbox" data-opt="hand" ${s.hand === "left" ? "checked" : ""}><span>Left-handed on-screen controls</span></label>` +
    `<label class="opt opt-range"><span>Screen shake</span><input type="range" min="0" max="1.4" step="0.1" data-shake value="${s.shake}"></label>`
  );
}

/** Wires the rows inside `root`. */
export function bindSettings(root) {
  const told = () => window.dispatchEvent(new CustomEvent("tb-settings"));
  for (const el of root.querySelectorAll("[data-opt]"))
    el.onchange = () => {
      const k = el.dataset.opt;
      setSetting(k, k === "hand" ? (el.checked ? "left" : "right") : el.checked);
      told();
    };
  const shake = root.querySelector("[data-shake]");
  if (shake) shake.oninput = (e) => setSetting("shake", Number(e.target.value)); // (read live by the fight)
}

/** The card over everything (in #modal); returns a function that closes it. */
export function openSettings(host, onClose = () => {}) {
  host.innerHTML = html`<div class="modal" data-modal role="dialog" aria-label="Settings">
    <div class="modal-box settings-box">
      <h2>Settings</h2>
      ${raw(settingsFields())}
      <button class="btn btn-go" data-close type="button">Done</button>
    </div>
  </div>`;
  bindSettings(host);
  // (a press here must not reach a paused fight's page-wide input underneath)
  const box = host.querySelector("[data-modal]");
  for (const ev of ["pointerdown", "mousedown", "touchstart"]) box.addEventListener(ev, (e) => e.stopPropagation());
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    host.innerHTML = "";
    onClose();
  };
  host.querySelector("[data-close]").onclick = () => (sfx.click(), close());
  box.onclick = (e) => {
    if (e.target === e.currentTarget) (sfx.click(), close());
  };
  return close;
}
