// The camera and the hand feeling the fight's blows (feel.js: a kick along a blow, a zoom punch on the big moments, a buzz on
// phones), and the sim's shake into the camera's trauma — one place, used by the fight (ui/fight.js) and the bench
// (dev-fight.js &feel=1) alike, so a film shows what the game does.
import { FEEL, shakeFor } from "../feel.js?v=48fd128-df87a96f";

/** After a tick: `shake` the player's shake setting (0..1.4), `buzz` whether this device may vibrate. */
export function feelView(events, cam, world, shake = 1, buzz = true) {
  const C = FEEL.cam, H = FEEL.haptics;
  const vib = (ms) => buzz && ms > 0 && shake > 0 && typeof navigator !== "undefined" && navigator.vibrate?.(ms);
  for (const e of events) {
    if (e.t === "hit" && e.dmg != null) {
      const f = e.heavy ? FEEL.heavy : FEEL.hit;
      if (C.kick) cam.kickAlong(Math.cos(e.a), Math.sin(e.a), C.kick * shakeFor(f, e.dmg) * shake);
      if (C.punch && (e.heavy || e.crit)) cam.punchIn(C.punch * 0.5 * shake);
      vib(e.heavy || e.crit ? H.heavy : H.hit);
    }
    if (e.t === "hurt" && e.a != null) {
      if (C.kick) cam.kickAlong(Math.cos(e.a), Math.sin(e.a), C.kick * shakeFor(FEEL.taken, e.dmg) * shake);
      vib(H.hurt);
    }
    if (e.t === "fire" && FEEL.blast?.[e.h?.tag] && world.player && !e.h.friendly) {
      // (a blast landing near him: FEEL.blast)
      const d = Math.hypot(e.h.x - world.player.x, e.h.y - world.player.y);
      const k = Math.max(0, 1 - d / FEEL.blast.reach);
      if (k > 0) cam.trauma = Math.max(cam.trauma, FEEL.blast[e.h.tag] * k * shake);
    }
    if (e.t === "stagger") { if (C.punch) cam.punchIn(C.punch * shake); vib(H.stagger); }
    if (e.t === "bossDeath") {
      // (the killing blow: the camera closes in and holds there before it lets go — feel.js killZoom)
      const K = FEEL.killZoom;
      if (K.amt) cam.punchIn(K.amt * shake, K.hold);
      else if (C.punch) cam.punchIn(C.punch * 1.5 * shake);
      vib(H.kill);
      // (and a white flash over the whole screen — feel.js flash.screenKill)
      if (FEEL.flash.screenKill > 0 && typeof document !== "undefined") {
        const el = document.createElement("div");
        el.style.cssText = `position:fixed;inset:0;background:#fff;pointer-events:none;z-index:50;opacity:${FEEL.flash.screenKill * Math.min(1, shake)};transition:opacity .35s ease-out`;
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => (el.style.opacity = "0")));
        setTimeout(() => el.remove(), 500);
      }
    }
  }
  cam.trauma = Math.max(cam.trauma, Math.min(1, world.shakeAmt / 22) * shake);
}
