// One intent, three ways of producing it: keyboard and mouse, a gamepad, or the on-screen stick
// and buttons. The sim never learns which was used.
//
//   mx, my   the movement stick, −1…1 each. Its length is how hard it is pushed, and the sim
//            scales the hero's top speed by it: a half push walks, a full push runs. A key is
//            always a full push, and so is a stick from 85% of the way out
//   aim      where the blade points, in radians, or null to face the way you are moving
//   attack   true on the tick the press happened, not while held
//   roll, slot0, slot1   the same
//
// Presses are edges because the sim may run several ticks in one animation frame; an edge is
// handed to exactly one tick, which is also why a buffered press feels honest.
//
// On a phone the aim is automatic (the fight screen points it at the nearest enemy every frame)
// until a thumb drags off a button. Once it is off the button, and more than AIM_DRAG css px from
// where it pressed, the press is aimed along the drag instead. An item thrown along the aim goes
// that way when the thumb comes up. The sword swings on the press, so a drag aims that swing only
// if it has not come out yet; after that the drag steers the held swings, and letting go never adds
// a swing of its own. The live drag is `aimPreview`, for the aim line.
//
// Some presses the hero cannot take yet are kept here rather than handed straight to the sim,
// whose buffer holds one press for a sixth of a second — too short to outlast a roll or a heavy
// swing. An attack pressed on the same tick as a roll waits for the roll, and an aimed press let
// go mid-swing waits for the swing; each is handed over once the hero is nearly free.
import { clamp, TAU } from "./util.js?v=8898846";
import { dirToWorld } from "./gfx/iso.js?v=8898846";
import { PLAYER, TICK } from "./config.js?v=8898846";
import { STATE } from "./sim/player.js?v=8898846";

/**
 * Does this device have a touchscreen at all? Deliberately generous: a touchscreen laptop counts,
 * and the on-screen controls then step aside the moment a mouse or a key is used. Being wrong the
 * other way — a phone with no controls on screen — leaves the player with nothing to press.
 */
// `?touch=1` forces the touch controls on — for checking the phone layout from a desktop browser
// or a headless capture, neither of which reports itself as a touch device.
export const isTouchDevice = () =>
  new URLSearchParams(location.search).get("touch") === "1" || matchMedia("(hover: none) and (pointer: coarse)").matches || navigator.maxTouchPoints > 0;

const KEYMAP = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  Space: "roll", ShiftLeft: "roll", ShiftRight: "roll",
  KeyJ: "attack", KeyK: "roll",
  Digit1: "slot0", KeyQ: "slot0",
  Digit2: "slot1", KeyE: "slot1",
  Escape: "pause", KeyP: "pause",
};

/** How far (css px) a thumb drags before the press is aimed — and it has to be off the button too —
 *  and how close it has to come back before it is a plain press again: a little less, and back on
 *  the button by more than the difference, so the edge does not flicker. */
export const AIM_DRAG = 20;
const AIM_DROP = 14;
/** The touch stick: no push inside this share of its ring, a full run from this share on. */
const STICK_DEAD = 0.14;
const STICK_FULL = 0.85;
/** The gamepad's left stick has a wider dead zone of its own, and runs from the same point. */
const PAD_DEAD = 0.22;
/** The longest a kept press waits for the hero: a little past the longest thing he can be busy
 *  with (the heavy swing, 0.62 s). After that it is forgotten, as the sim forgets an old press. */
const WAIT_MAX = 0.8;

/** A screen-space angle → the ground angle that points the same way on screen. */
const toWorldAngle = (a) => {
  const [wx, wy] = dirToWorld(Math.cos(a), Math.sin(a));
  return Math.atan2(wy, wx);
};

/** How far out a stick is (0 at rest, 1 at the rim) → how hard the hero is asked to move: nothing
 *  inside the dead zone, then a straight rise to a whole 1 at `full`. */
const ramp = (m, dead, full) => (m <= dead ? 0 : Math.min(1, (m - dead) / (full - dead)));

/**
 * A stick's position (−1…1 each, length 1 at the rim) → the push the sim is handed: the same
 * direction, with a length of 0 in the dead zone, rising straight through the middle to exactly 1
 * from `full` of the way out.
 */
export function stickPush(x, y, dead = STICK_DEAD, full = STICK_FULL) {
  const m = Math.hypot(x, y);
  const k = ramp(m, dead, full);
  return k ? [(x / m) * k, (y / m) * k] : [0, 0];
}

/** Seconds until the hero can start something new: sim/player.js's actionable(), as a wait. */
function busyFor(p) {
  if (p.state === STATE.ROLL) return PLAYER.roll.time + PLAYER.roll.recover - p.t;
  if (p.state === STATE.ATTACK) {
    const s = PLAYER.combo[p.step];
    return s.wind + s.active + s.recover - p.t;
  }
  if (p.state === STATE.HURT) return PLAYER.hurtTime - p.t;
  if (p.state === STATE.DEAD || p.state === STATE.LOCKED) return Infinity;
  return 0;
}

export function makeInput(canvasEl) {
  const held = new Set();
  const pressed = new Set(); // edges waiting to be consumed
  let mouse = { x: 0, y: 0, inside: false, down: false };
  let pointerAim = null; // radians, from the mouse or the right stick
  let touchMove = { x: 0, y: 0, active: false };
  let touchAim = null;
  // "key" | "pad" | "touch". It decides which prompts the HUD shows and whether the on-screen
  // stick is up — so a phone has to start on "touch", or the controls would be hidden until the
  // player touched something that is not there.
  let lastKind = isTouchDevice() ? "touch" : "key";
  let padIndex = null;
  const padPrev = {};
  let enabled = true;
  // The thumbs on the touch buttons, by button: whether a drag can aim it, whether it acts when let
  // go rather than when pressed, the ground angle it is dragged to (null until it is off the button
  // and far enough), where it went down from the button's centre and the button's radius, and, for
  // the sword, whether a swing has come out since it went down.
  const thumbs = new Map(); // name → { name, aims, onRelease, aim, order, out, x, y, r }
  let aimOrder = 0;
  // A press kept back until the hero can take it: { name, aim, rolled, t, state, twin }.
  let waiting = null;
  // A kept press once handed over with its own aim, while the sim still holds it in its buffer.
  let handed = null;

  const press = (name) => {
    if (!enabled) return;
    pressed.add(name);
  };
  /** The thumb dragged most recently past the threshold, if any is. */
  const aimedThumb = () => {
    let best = null;
    for (const t of thumbs.values()) if (t.aim != null && (!best || t.order > best.order)) best = t;
    return best;
  };

  const onKeyDown = (e) => {
    const n = KEYMAP[e.code];
    if (!n) return;
    if (e.repeat) return;
    if (e.code === "Space") e.preventDefault();
    lastKind = "key";
    held.add(n);
    press(n);
  };
  const onKeyUp = (e) => {
    const n = KEYMAP[e.code];
    if (n) held.delete(n);
  };
  const onBlur = () => (held.clear(), (mouse.down = false));

  const onMove = (e) => {
    const r = canvasEl.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.inside = true;
    if (e.pointerType === "mouse") lastKind = "key";
  };
  const onDown = (e) => {
    // A touch anywhere brings the on-screen controls back once a key or the mouse has sent them
    // away. It has to be anywhere: while they are away they are hidden, so no touch lands on them.
    if (e.pointerType === "touch") lastKind = "touch";
    if (e.pointerType !== "mouse") return;
    onMove(e);
    lastKind = "key";
    if (e.button === 0) (mouse.down = true), press("attack");
    if (e.button === 2) press("roll");
  };
  const onUp = (e) => {
    if (e.pointerType === "mouse" && e.button === 0) mouse.down = false;
  };
  const onContext = (e) => e.preventDefault();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvasEl.addEventListener("pointermove", onMove);
  canvasEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  canvasEl.addEventListener("contextmenu", onContext);

  const api = {
    /** The touch stick: the thumb's offset from where it landed, over the ring's radius (1 at the rim). */
    setStick(x, y) {
      [touchMove.x, touchMove.y] = stickPush(x, y);
      touchMove.active = touchMove.x !== 0 || touchMove.y !== 0;
      if (touchMove.active) lastKind = "touch";
    },
    /**
     * The touch buttons. A thumb goes down on one — `aims`: a drag off it can aim it; `onRelease`:
     * it acts when the thumb comes up rather than now, which is how an item thrown along the aim
     * lets a drag choose where it goes. The sword acts on the press and a drag steers it. `at` is
     * where the thumb went down from the button's centre and `r` the button's radius, in css px, so
     * a drag counts only once it is off the button; left out, any drag long enough counts.
     */
    buttonDown(name, { aims = false, onRelease = false, at = [0, 0], r = 0 } = {}) {
      lastKind = "touch";
      thumbs.set(name, { name, aims, onRelease, aim: null, order: 0, out: false, x: at[0], y: at[1], r });
      held.add(name);
      if (!onRelease) press(name);
    },
    /** The thumb on a button moved: dx, dy in css px from where it went down. True while aimed. */
    buttonMove(name, dx, dy) {
      const t = thumbs.get(name);
      if (!t || !t.aims) return false;
      const d = Math.hypot(dx, dy);
      // How far past the button's rim the thumb is: below 0 while it is still on the button. A
      // thumb that rolls or creeps about on the button is pressing it, not aiming it.
      const past = Math.hypot(t.x + dx, t.y + dy) - t.r;
      if ((d > AIM_DRAG && past > 0) || (t.aim != null && d >= AIM_DROP && past > AIM_DROP - AIM_DRAG)) {
        if (t.aim == null) t.order = ++aimOrder;
        // The drag is a direction on the screen; the sim wants the ground direction that looks the same.
        t.aim = toWorldAngle(Math.atan2(dy, dx));
      } else t.aim = null;
      return t.aim != null;
    },
    /** The thumb came up. `cancel` for a touch the browser took away: it acts on nothing. */
    buttonUp(name, cancel = false) {
      const t = thumbs.get(name);
      thumbs.delete(name);
      held.delete(name);
      if (!t || cancel || !enabled) return;
      if (t.onRelease) {
        // An item thrown along the aim: dragged, it goes that way once the hero can take it;
        // tapped, it goes now, at the nearest.
        if (t.aim != null) waiting = { name, aim: t.aim, rolled: true, t: 0, state: null };
        else press(name);
      } else if (t.aim != null && !t.out) {
        // The sword swung on the press, and letting go adds no swing of its own. But if that swing
        // has not come out yet — the hero was busy — it is the one the drag aims: kept here with
        // the drag's aim until he can take it. If the press already went to the sim, the sim may
        // still hold it too (`twin`); should it let it out first, the kept one is dropped.
        if (waiting && waiting.name === name) waiting.aim = t.aim;
        else waiting = { name, aim: t.aim, rolled: true, t: 0, state: null, twin: !pressed.delete(name) };
      }
    },
    /**
     * While a thumb is dragged off a button past the threshold: { angle, slot } — `angle` the
     * ground angle it aims along, in the sim's own terms (as `player.aim`), and `slot` 0 or 1 for
     * an item button or null for the sword. Otherwise null.
     */
    get aimPreview() {
      const t = aimedThumb();
      return t ? { angle: t.aim, slot: t.name === "slot0" ? 0 : t.name === "slot1" ? 1 : null } : null;
    },
    get kind() {
      return lastKind;
    },
    set enabled(v) {
      enabled = v;
      if (!v) (held.clear(), pressed.clear(), thumbs.clear(), (waiting = null), (handed = null));
      // The stick too, either way: a thumb still on it when a fight's screen is torn down never
      // sends its pointerup, and its last push would walk the hero through the next fight.
      touchMove = { x: 0, y: 0, active: false };
    },
    get enabled() {
      return enabled;
    },
    /** True while the attack button is held — used for hold-to-swing. */
    get attackHeld() {
      return held.has("attack") || mouse.down;
    },
    /** Where the mouse is over the canvas, in canvas pixels. */
    get mouse() {
      return mouse;
    },
    /** Called once an animation frame, before the ticks. Reads the gamepad. */
    poll(camera, hero = null) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (const p of pads) if (p && p.connected && (p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.25))) pad = p;
      if (pad) {
        padIndex = pad.index;
        lastKind = "pad";
        const dz = (v) => (Math.abs(v) < 0.22 ? 0 : (v - Math.sign(v) * 0.22) / 0.78);
        // The left stick's direction comes past a dead zone on each axis, as it always did, and its
        // length from how far it is tilted: a walk part of the way out, a full run near the rim.
        const ax = pad.axes[0] || 0;
        const ay = pad.axes[1] || 0;
        const [dx, dy] = [dz(ax), dz(ay)];
        const d = Math.hypot(dx, dy);
        const k = ramp(Math.hypot(ax, ay), PAD_DEAD, STICK_FULL);
        api._padMove = d ? [(dx / d) * k, (dy / d) * k] : [0, 0];
        const rx = dz(pad.axes[2] || 0);
        const ry = dz(pad.axes[3] || 0);
        api._padAim = Math.hypot(rx, ry) > 0.35 ? Math.atan2(ry, rx) : null;
        const edge = (i, name) => {
          const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
          if (now && !padPrev[i]) press(name);
          padPrev[i] = now;
          if (now) held.add(name);
          else held.delete(name);
        };
        edge(0, "attack"); // A / cross
        edge(7, "attack"); // right trigger
        edge(1, "roll"); // B / circle
        edge(5, "roll"); // right bumper
        edge(2, "slot0"); // X / square
        edge(3, "slot1"); // Y / triangle
        edge(9, "pause");
      } else if (padIndex != null) {
        api._padMove = null;
        api._padAim = null;
      }
      // The mouse aims from the hero, so the camera has to say where the hero is on screen. (It
      // used to aim from the camera's focus, which was near the hero while the camera held the
      // arena's middle; the fight camera's focus is a screen-space point, and aim went 50° off.)
      if (mouse.inside && camera && hero && lastKind === "key") {
        const [hx, hy] = camera.worldToScreen(hero.x, hero.y);
        const dx = mouse.x - hx;
        const dy = mouse.y - hy;
        pointerAim = Math.hypot(dx, dy) > 6 ? Math.atan2(dy, dx) : pointerAim;
      }
    },
    _padMove: null,
    _padAim: null,

    /**
     * The intent for one tick. Edges are handed out once.
     *  p       the hero as the last tick left him. Without it presses go straight through, and
     *          nothing is held for hold-to-swing or kept back for later.
     *  hold    hold-to-swing is on (the camp setting): while the attack button is held, a swing
     *          goes out whenever the last one has passed its blade.
     *  frozen  this tick's step will not move the hero (a hitstop, the name card, the fight
     *          over), so nothing kept back is handed over into it.
     *  closed  and it takes no input at all (the name card, the fight over): a fresh press is lost
     *          in it, so anything kept back is dropped too, or a drag let go on the name card
     *          would throw the moment the fight began.
     */
    consume(p = null, { hold = false, frozen = false, closed = false } = {}) {
      let mx = 0;
      let my = 0;
      if (touchMove.active) {
        mx = touchMove.x;
        my = touchMove.y;
      } else if (api._padMove && (api._padMove[0] || api._padMove[1])) {
        mx = api._padMove[0];
        my = api._padMove[1];
      } else {
        if (held.has("left")) mx -= 1;
        if (held.has("right")) mx += 1;
        if (held.has("up")) my -= 1;
        if (held.has("down")) my += 1;
      }
      const m = Math.hypot(mx, my);
      if (m > 1) {
        mx /= m;
        my /= m;
      }
      // Everything above is what the player pushed *on the screen*. The sim thinks in ground
      // coordinates, and on an isometric ground "up the screen" is north-west. Turning it here
      // means neither the sim nor the player ever has to think about the angle.
      if (m > 0.0001) {
        const [wx, wy] = dirToWorld(mx, my);
        mx = wx * Math.min(1, m);
        my = wy * Math.min(1, m);
      }
      // The aim comes in as a screen angle and leaves as a ground one, for the same reason.
      let aim = null;
      if (lastKind === "pad") aim = api._padAim == null ? null : toWorldAngle(api._padAim);
      else if (lastKind === "touch") aim = touchAim; // already a ground angle: the touch layer aims at a target
      else if (mouse.inside) aim = pointerAim == null ? null : toWorldAngle(pointerAim);
      // The phone's aim is automatic (at the nearest enemy): it points his swings and throws, but a
      // hero standing still does not turn to it (the owner, 2026-10-03: he kept swivelling to whatever
      // was nearest). Any aim the player gives — a drag, a kept press — is not automatic.
      let aimAuto = lastKind === "touch" && aim != null;
      // A thumb dragged off a button aims past all of that, for as long as it is dragged.
      const dragged = aimedThumb();
      if (dragged) (aim = dragged.aim), (aimAuto = false);

      // A swing has just come out (the sim starts one with its clock at 0). A thumb on the sword
      // whose press has gone to the sim has had its swing, so letting go of it keeps nothing back.
      // A kept attack that the sim also held has been let out by the sim first, so it is dropped.
      if (p && p.state === STATE.ATTACK && p.t === 0) {
        const sword = thumbs.get("attack");
        if (sword && !pressed.has("attack")) sword.out = true;
        if (waiting && waiting.twin) waiting = null;
      }

      const take = (n) => {
        if (!pressed.has(n)) return false;
        pressed.delete(n);
        return true;
      };
      const e = { attack: take("attack"), roll: take("roll"), slot0: take("slot0"), slot1: take("slot1") };
      if (!p && waiting) {
        e[waiting.name] = true;
        if (waiting.aim != null) (aim = waiting.aim), (aimAuto = false);
        waiting = null;
      }
      if (p && closed) (waiting = null), (handed = null);
      if (p && !frozen && !closed) {
        // A press handed over with its own aim keeps that aim while the sim still has it buffered,
        // so it goes the way it was dragged even if it comes out a few ticks later.
        if (handed && p.buffer === handed.name) (aim = handed.aim), (aimAuto = false);
        else handed = null;
        // Roll and attack on the same tick: the sim takes the roll and would drop the attack, so
        // the attack waits here and comes out after the roll. Any other new press replaces a kept
        // one, as a newer press replaces an older one in the sim's buffer.
        if (e.roll && e.attack) {
          waiting = { name: "attack", aim: null, rolled: false, t: 0, state: p.state };
          e.attack = false;
        } else if (e.roll || e.attack || e.slot0 || e.slot1) waiting = null;
        if (waiting) {
          waiting.t += TICK;
          // A hit wipes what was queued, as it wipes the sim's buffer.
          const hit = waiting.state != null && p.state === STATE.HURT && waiting.state !== STATE.HURT;
          waiting.state = p.state;
          if (p.state === STATE.ROLL) waiting.rolled = true;
          if (hit || p.state === STATE.DEAD || waiting.t > WAIT_MAX || (!waiting.rolled && waiting.t > PLAYER.bufferTime)) waiting = null;
          // Handed over once the hero is nearly free (the sim's buffer carries it the last few
          // ticks), but never during a roll: a swing that starts on a roll's last tick is aimed
          // where the hero was aiming before it, so the press waits for him to be on his feet.
          else if (waiting.rolled && p.state !== STATE.ROLL && busyFor(p) <= PLAYER.bufferTime / 2) {
            e[waiting.name] = true;
            if (waiting.aim != null) {
              aim = waiting.aim;
              aimAuto = false;
              handed = { name: waiting.name, aim: waiting.aim };
            }
            waiting = null;
          }
        }
        // Holding the attack button keeps the combo going, which is how it has to work on a phone.
        // It never stands in for a fresh press: whatever else was pressed this tick goes first.
        if (hold && !e.attack && !e.roll && !e.slot0 && !e.slot1 && api.attackHeld) {
          const s = PLAYER.combo[p.step];
          if (p.state === STATE.IDLE || p.state === STATE.MOVE || (p.state === STATE.ATTACK && p.chain <= 0 && p.t > s.wind + s.active)) e.attack = true;
        }
      }
      return { mx, my, aim, aimAuto, ...e, pause: take("pause") };
    },
    /** Called between frames when nothing consumed the edges (e.g. while paused). */
    flush() {
      pressed.clear();
      waiting = null;
    },
    setTouchAim(a) {
      touchAim = a;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvasEl.removeEventListener("pointermove", onMove);
      canvasEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      canvasEl.removeEventListener("contextmenu", onContext);
    },
  };
  return api;
}

export { clamp, TAU };
