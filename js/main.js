import {
  __preload,
  __chunks,
  clamp,
  lerp,
  TAU,
  angleDiff,
  rng,
  TICK_EPS,
  reached,
  hashSeed,
  pickN,
  roman,
  mmss,
  untilNext,
  raw,
  html,
  RELEASE,
  MODS3D,
  stampUrl,
  KIND,
  jumpable,
  hazard,
  shown,
  phaseOf,
  stepHazard,
  hits,
  damageFor,
  sourceOf,
  CLIMB,
  gapAt,
  holeFor,
  holeWorld,
  rimDist,
  BOSSES2,
  CLASSIC2,
  BOSS_ORDER2,
  MODELLED2,
  ART,
  buildArt,
  ensure,
  ISO_W,
  ISO_H,
  toScreen,
  dirToWorld,
  CONFIG,
  TICK,
  MAX_FRAME,
  ARENA,
  PLAYER,
  FIGHT,
  SHAKE_MAX,
  BUBBLE_R,
  HEART_VALUE,
  ARENA_SHAPES,
  WALK_EDITS,
  arenaShape,
  walkCells,
  shapeFromCells,
  WEAPONS,
  WEAPON_IDS,
  armable,
  settleArms,
  EV,
  STATE,
  makePlayer,
  setArms,
  moveOf,
  stepPlayer,
  swingArc,
  bladeHits,
  staggerPlayer,
  hurtPlayer,
  armCounter,
  inAir,
  tryArena,
  placeOf,
  BACKDROP_ARENAS,
  unlock,
  setEnabled,
  setMusic,
  setVoice,
  stopMusicCues,
  startAmbient,
  ambientLevel,
  stopAmbient,
  stopFightMusic,
  sfx,
  stopDrone,
  duck,
  FEEL,
  stopFor,
  shakeFor,
  canView3D
} from "./main-4hwc579a.js?v=88e40de-1ff3b19c";
__chunks(import.meta.url,["m18f7prf","96ecym4y","q3wm931g","zdqbes29","fgk75wn7","4hwc579a","gz6gww92","47hvbmn5","txhfbk9m","qv4jc8dc","b486m087","agd5vtg6","p019r9js","ybx00bvq","74g1a3n8","6mhe1mqq","3vr08xr3","51wysape","jv075w3r","drnmg1te","mknp57za","cqacbqc4","et58xwpz"],[["./main.js",5],["./load3d-96ecym4y.js",5],["./mapedit3d-q3wm931g.js",13,14,15],["./fxedit-zdqbes29.js",16,14,15],["./three-lib-fgk75wn7.js",15],["./main-4hwc579a.js"],["./bosses-gz6gww92.js",5],["./backdrop3d-47hvbmn5.js",17,18,13,14,19,15],["./camp3d-txhfbk9m.js",20,18,13,16,14,19,15],["./gltf-qv4jc8dc.js",15],["./render3d-b486m087.js",15,19,5,21,22,14,13,17,16,20,18],["./paint3d-agd5vtg6.js",22,19,15],["./boss-profiles-p019r9js.js",21],["./main-ybx00bvq.js",15,14],["./main-74g1a3n8.js",15],["./main-6mhe1mqq.js"],["./main-3vr08xr3.js",15,14],["./main-51wysape.js",15,19,14,13,18,5],["./main-jv075w3r.js",15],["./main-drnmg1te.js",5],["./main-mknp57za.js",15,19,14,13,16,18],["./main-cqacbqc4.js"],["./main-et58xwpz.js",15,5,19]],0);

// site/js/input.js
var isTouchDevice = () => new URLSearchParams(location.search).get("touch") === "1" || matchMedia("(hover: none) and (pointer: coarse)").matches || navigator.maxTouchPoints > 0;
var KEYMAP = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "roll",
  ShiftRight: "roll",
  KeyJ: "attack",
  KeyK: "roll",
  Space: "off",
  KeyL: "off",
  KeyF: "off",
  Digit1: "slot0",
  KeyQ: "slot0",
  Digit2: "slot1",
  KeyE: "slot1",
  Escape: "pause",
  KeyP: "pause"
};
var AIM_DRAG = 20;
var AIM_DROP = 14;
var STICK_DEAD = 0.14;
var STICK_FULL = 0.85;
var PAD_DEAD = 0.22;
var PAD_BUTTONS = [
  [0, "attack"],
  [7, "attack"],
  [1, "roll"],
  [5, "roll"],
  [4, "off"],
  [6, "off"],
  [2, "slot0"],
  [3, "slot1"],
  [9, "pause"]
];
var WAIT_MAX = 0.8;
var toWorldAngle = (a) => {
  const [wx, wy] = dirToWorld(Math.cos(a), Math.sin(a));
  return Math.atan2(wy, wx);
};
var ramp = (m, dead, full) => m <= dead ? 0 : Math.min(1, (m - dead) / (full - dead));
function stickPush(x, y, dead = STICK_DEAD, full = STICK_FULL) {
  const m = Math.hypot(x, y);
  const k = ramp(m, dead, full);
  return k ? [x / m * k, y / m * k] : [0, 0];
}
function busyFor(p) {
  if (p.state === STATE.ROLL)
    return PLAYER.roll.time + PLAYER.roll.recover - p.t;
  if (p.state === STATE.ATTACK) {
    const s = moveOf(p);
    return s.wind + s.active + s.recover - p.t;
  }
  if (p.state === STATE.HURT)
    return PLAYER.hurtTime - p.t;
  if (p.state === STATE.DEAD || p.state === STATE.LOCKED)
    return Infinity;
  return 0;
}
function makeInput(canvasEl) {
  const held = new Set;
  const pressed = new Set;
  const mouse = { x: 0, y: 0, inside: false, down: false };
  let pointerAim = null;
  let touchMove = { x: 0, y: 0, active: false };
  let touchAim = null;
  let lastKind = isTouchDevice() ? "touch" : "key";
  let padIndex = null;
  const padPrev = {};
  let padDown = new Set;
  let enabled = true;
  const thumbs = new Map;
  let aimOrder = 0;
  let waiting = null;
  let handed = null;
  const press = (name) => {
    if (!enabled)
      return;
    pressed.add(name);
  };
  const aimedThumb = () => {
    let best = null;
    for (const t of thumbs.values())
      if (t.aim != null && (!best || t.order > best.order))
        best = t;
    return best;
  };
  const onKeyDown = (e) => {
    const n = KEYMAP[e.code];
    if (!n)
      return;
    if (e.repeat)
      return;
    if (e.code === "Space")
      e.preventDefault();
    lastKind = "key";
    held.add(n);
    press(n);
  };
  const onKeyUp = (e) => {
    const n = KEYMAP[e.code];
    if (n)
      held.delete(n);
  };
  const onBlur = () => (held.clear(), mouse.down = false, mouse.offDown = false);
  const onMove = (e) => {
    const r = canvasEl.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.inside = true;
    if (e.pointerType === "mouse")
      lastKind = "key";
  };
  const onDown = (e) => {
    if (e.pointerType === "touch")
      lastKind = "touch";
    if (e.pointerType !== "mouse")
      return;
    onMove(e);
    lastKind = "key";
    if (e.button === 0)
      mouse.down = true, press("attack");
    if (e.button === 1)
      e.preventDefault(), mouse.offDown = true, press("off");
    if (e.button === 2)
      press("roll");
  };
  const onUp = (e) => {
    if (e.pointerType === "mouse" && e.button === 0)
      mouse.down = false;
    if (e.pointerType === "mouse" && e.button === 1)
      mouse.offDown = false;
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
    setStick(x, y) {
      if (!enabled)
        return void (touchMove = { x: 0, y: 0, active: false });
      [touchMove.x, touchMove.y] = stickPush(x, y);
      touchMove.active = touchMove.x !== 0 || touchMove.y !== 0;
      if (touchMove.active)
        lastKind = "touch";
    },
    buttonDown(name, { aims = false, onRelease = false, at = [0, 0], r = 0 } = {}) {
      lastKind = "touch";
      thumbs.set(name, { name, aims, onRelease, aim: null, order: 0, out: false, x: at[0], y: at[1], r });
      held.add(name);
      if (!onRelease)
        press(name);
    },
    buttonMove(name, dx, dy) {
      const t = thumbs.get(name);
      if (!t || !t.aims)
        return false;
      const d = Math.hypot(dx, dy);
      const past = Math.hypot(t.x + dx, t.y + dy) - t.r;
      if (d > AIM_DRAG && past > 0 || t.aim != null && d >= AIM_DROP && past > AIM_DROP - AIM_DRAG) {
        if (t.aim == null)
          t.order = ++aimOrder;
        t.aim = toWorldAngle(Math.atan2(dy, dx));
      } else
        t.aim = null;
      return t.aim != null;
    },
    buttonUp(name, cancel = false) {
      const t = thumbs.get(name);
      thumbs.delete(name);
      held.delete(name);
      if (!t || cancel || !enabled)
        return;
      if (t.onRelease) {
        if (t.aim != null)
          waiting = { name, aim: t.aim, rolled: true, t: 0, state: null };
        else
          press(name);
      } else if (t.aim != null && !t.out) {
        if (waiting && waiting.name === name)
          waiting.aim = t.aim;
        else
          waiting = { name, aim: t.aim, rolled: true, t: 0, state: null, twin: !pressed.delete(name) };
      }
    },
    get aimPreview() {
      const t = aimedThumb();
      return t ? { angle: t.aim, slot: t.name === "slot0" ? 0 : t.name === "slot1" ? 1 : null } : null;
    },
    get kind() {
      return lastKind;
    },
    set enabled(v) {
      enabled = v;
      if (!v)
        held.clear(), pressed.clear(), thumbs.clear(), waiting = null, handed = null;
      touchMove = { x: 0, y: 0, active: false };
    },
    get attackHeld() {
      return held.has("attack") || mouse.down;
    },
    reset() {
      held.clear();
      pressed.clear();
      thumbs.clear();
      waiting = handed = null;
      touchMove = { x: 0, y: 0, active: false };
      mouse.down = mouse.offDown = false;
      for (const k in padPrev)
        delete padPrev[k];
      padDown = new Set;
      api._padMove = api._padAim = null;
    },
    take(name) {
      return pressed.delete(name);
    },
    poll(camera, hero = null) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (const p of pads)
        if (p && p.connected && (p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.25)))
          pad = p;
      const last = pad || (padIndex != null ? pads[padIndex] : null);
      if (last && last.connected) {
        const down = new Set;
        for (const [i, name] of PAD_BUTTONS) {
          const now = !!(last.buttons[i] && last.buttons[i].pressed);
          if (now && !padPrev[i])
            press(name);
          padPrev[i] = now;
          if (now)
            down.add(name);
        }
        for (const n of padDown)
          if (!down.has(n))
            held.delete(n);
        for (const n of down)
          held.add(n);
        padDown = down;
      } else if (padIndex != null) {
        for (const n of padDown)
          held.delete(n);
        padDown = new Set;
        for (const k in padPrev)
          delete padPrev[k];
        padIndex = null;
      }
      if (pad) {
        padIndex = pad.index;
        lastKind = "pad";
        const dz = (v) => Math.abs(v) < 0.22 ? 0 : (v - Math.sign(v) * 0.22) / 0.78;
        const ax = pad.axes[0] || 0;
        const ay = pad.axes[1] || 0;
        const [dx, dy] = [dz(ax), dz(ay)];
        const d = Math.hypot(dx, dy);
        const k = ramp(Math.hypot(ax, ay), PAD_DEAD, STICK_FULL);
        api._padMove = d ? [dx / d * k, dy / d * k] : [0, 0];
        const rx = dz(pad.axes[2] || 0);
        const ry = dz(pad.axes[3] || 0);
        api._padAim = Math.hypot(rx, ry) > 0.35 ? Math.atan2(ry, rx) : null;
      } else {
        api._padMove = null;
        api._padAim = null;
      }
      if (mouse.inside && camera && hero && lastKind === "key") {
        const [hx, hy] = camera.worldToScreen(hero.x, hero.y);
        const dx = mouse.x - hx;
        const dy = mouse.y - hy;
        pointerAim = Math.hypot(dx, dy) > 6 ? Math.atan2(dy, dx) : pointerAim;
      }
    },
    _padMove: null,
    _padAim: null,
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
        if (held.has("left"))
          mx -= 1;
        if (held.has("right"))
          mx += 1;
        if (held.has("up"))
          my -= 1;
        if (held.has("down"))
          my += 1;
      }
      const m = Math.hypot(mx, my);
      if (m > 1) {
        mx /= m;
        my /= m;
      }
      if (m > 0.0001) {
        const [wx, wy] = dirToWorld(mx, my);
        mx = wx * Math.min(1, m);
        my = wy * Math.min(1, m);
      }
      let aim = null;
      if (lastKind === "pad")
        aim = api._padAim == null ? null : toWorldAngle(api._padAim);
      else if (lastKind === "touch")
        aim = touchAim;
      else if (mouse.inside)
        aim = pointerAim == null ? null : toWorldAngle(pointerAim);
      let aimAuto = lastKind === "touch" && aim != null;
      const dragged = aimedThumb();
      if (dragged)
        aim = dragged.aim, aimAuto = false;
      if (p && p.state === STATE.ATTACK && p.t === 0) {
        const sword = thumbs.get("attack");
        if (sword && !pressed.has("attack"))
          sword.out = true;
        if (waiting && waiting.twin)
          waiting = null;
      }
      const take = (n) => {
        if (!pressed.has(n))
          return false;
        pressed.delete(n);
        return true;
      };
      const e = { attack: take("attack"), roll: take("roll"), slot0: take("slot0"), slot1: take("slot1"), off: take("off") };
      if (!p && waiting) {
        e[waiting.name] = true;
        if (waiting.aim != null)
          aim = waiting.aim, aimAuto = false;
        waiting = null;
      }
      if (p && closed)
        waiting = null, handed = null;
      if (p && !frozen && !closed) {
        if (handed && p.buffer === handed.name)
          aim = handed.aim, aimAuto = false;
        else
          handed = null;
        if (e.roll && e.attack) {
          waiting = { name: "attack", aim: null, rolled: false, t: 0, state: p.state };
          e.attack = false;
        } else if (e.roll || e.attack || e.slot0 || e.slot1)
          waiting = null;
        if (waiting) {
          waiting.t += TICK;
          const hit = waiting.state != null && p.state === STATE.HURT && waiting.state !== STATE.HURT;
          waiting.state = p.state;
          if (p.state === STATE.ROLL)
            waiting.rolled = true;
          if (hit || p.state === STATE.DEAD || waiting.t > WAIT_MAX || !waiting.rolled && waiting.t > PLAYER.bufferTime)
            waiting = null;
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
        if (hold && !e.attack && !e.roll && !e.slot0 && !e.slot1 && api.attackHeld) {
          const s = moveOf(p);
          if (p.state === STATE.IDLE || p.state === STATE.MOVE || p.state === STATE.ATTACK && p.chain <= 0 && p.t > s.wind + s.active)
            e.attack = true;
        }
      }
      return { mx, my, aim, aimAuto, ...e, offHeld: held.has("off") || !!mouse.offDown, pause: take("pause") };
    },
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
    }
  };
  return api;
}

// site/js/content/blessings.js
var BLESSINGS = {
  glass: {
    id: "glass",
    name: "Glasscannon",
    icon: "sword",
    desc: "+45% damage, −25% health",
    long: "For the day you already know the fight and just want it over.",
    mods: { dmg: 1.45, hpScale: 0.75 }
  },
  ironhide: {
    id: "ironhide",
    name: "Ironhide",
    icon: "shield",
    desc: "+30% health, −8% speed",
    long: "One more mistake than you would otherwise get.",
    mods: { hpScale: 1.3, speed: 0.92 }
  },
  feather: {
    id: "feather",
    name: "Feather-step",
    icon: "roll",
    desc: "Rolls cost 45% less, and last a little longer",
    long: "More rolls, and a wider window inside each one.",
    mods: { rollCost: 0.55, iFrames: 0.05 }
  },
  thirst: {
    id: "thirst",
    name: "Red Thirst",
    icon: "heart",
    desc: "10% of the damage you deal comes back",
    long: "Rewards staying in, which is exactly when it is hardest to.",
    mods: { lifesteal: 0.1 }
  },
  duellist: {
    id: "duellist",
    name: "Duellist",
    icon: "star",
    desc: "A quarter of your hits land twice",
    long: "Swingy. Some days it wins the fight on its own.",
    mods: { crit: 0.25 }
  },
  fleet: {
    id: "fleet",
    name: "Fleet",
    icon: "dash",
    desc: "+14% speed, stamina back a quarter faster",
    long: "Never the strongest pick, never the wrong one.",
    mods: { speed: 1.14, staminaScale: 1.25 }
  },
  stocked: {
    id: "stocked",
    name: "Well Stocked",
    icon: "potion",
    desc: "+1 charge on both slots, cooldowns 20% shorter",
    long: "Turns two buttons into three.",
    mods: {},
    apply(w) {
      w.player.charges = w.player.charges.map((c) => c > 0 ? c + 1 : c);
      w.player.cdScale = 0.8;
    }
  },
  spite: {
    id: "spite",
    name: "Spite",
    icon: "skull",
    desc: "Every hit you take adds +12% damage, for good",
    long: "The comeback blessing. Losing the first half is how it pays.",
    mods: {},
    apply(w) {
      w.player.spite = 0;
    },
    onHurt(w, p) {
      const n = (p.spite || 0) + 1;
      p.mods.dmg *= (1 + 0.12 * n) / (1 + 0.12 * (n - 1));
      p.spite = n;
      w.say(`Spite ×${n}`);
    }
  },
  patience: {
    id: "patience",
    name: "Patience",
    icon: "book",
    desc: "Stand still for a second and a shield forms",
    long: "Punishes panic. Stand, read the tell, then move.",
    mods: {},
    tick(w, p, dt) {
      if ((p.shieldHits || 0) > (p.patienceHits || 0))
        p.patienceCool = 5;
      p.patienceHits = p.shieldHits || 0;
      if (p.patienceCool > 0)
        p.patienceCool -= dt;
      const still = Math.hypot(p.vx, p.vy) < 12 && p.state !== 3;
      p.patienceT = still ? (p.patienceT || 0) + dt : 0;
      if (p.patienceT > 1 && p.shield < 30 && !(p.patienceCool > 0)) {
        p.shield = 30;
        w.events.push({ t: EV.shieldUp, x: p.x, y: p.y });
      }
    }
  }
};
var BLESSING_IDS = Object.keys(BLESSINGS);
function blessedMods(mods, blessing, baseHp) {
  const out = { ...mods };
  const m = blessing?.mods;
  if (!m)
    return out;
  if (m.dmg)
    out.dmg = (out.dmg ?? 1) * m.dmg;
  if (m.speed)
    out.speed = (out.speed ?? 1) * m.speed;
  if (m.rollCost)
    out.rollCost = (out.rollCost ?? 1) * m.rollCost;
  if (m.iFrames)
    out.iFrames = (out.iFrames ?? 0) + m.iFrames;
  if (m.lifesteal)
    out.lifesteal = (out.lifesteal ?? 0) + m.lifesteal;
  if (m.crit)
    out.crit = (out.crit ?? 0) + m.crit;
  if (m.hpScale)
    out.hp = Math.round((baseHp + (out.hp ?? 0)) * m.hpScale) - baseHp;
  if (m.staminaScale)
    out.staminaScale = m.staminaScale;
  return out;
}

// site/js/daily.js
var [LY, LM, LD] = CONFIG.LAUNCH_DATE.split("-").map(Number);
var LAUNCH = new Date(LY, LM - 1, LD);
var midnight = (d = new Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function dayNumber(at = new Date) {
  return Math.round((midnight(at) - LAUNCH) / 86400000) + 1;
}
var weekNumber = (day = dayNumber()) => Math.floor((day - 1) / 7) + 1;
var dayOfWeek = (day = dayNumber()) => (day - 1) % 7 + 1;
var dateKey = (at = new Date) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
var dateOfDay = (day) => new Date(LY, LM - 1, LD + day - 1, 12);
var dayLabel = (day) => dateOfDay(day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
var MODIFIERS = {
  none: { id: "none", name: "Plain", desc: "No affix this week.", apply: () => {} },
  frenzied: {
    id: "frenzied",
    name: "Frenzied",
    desc: "Below a third of its health, the boss moves and acts far faster.",
    apply: (w) => w.affix = { frenzy: true }
  },
  volcanic: {
    id: "volcanic",
    name: "Volcanic",
    desc: "The ground erupts under you every few seconds. Keep walking.",
    apply: (w) => w.affix = { volcanic: 4.5 }
  },
  brittle: {
    id: "brittle",
    name: "Brittle",
    desc: "The boss staggers a third sooner — but hits a fifth harder.",
    apply: (w) => {
      w.boss.poiseMax = Math.round(w.boss.poiseMax * 0.66);
      w.boss.poise = w.boss.poiseMax;
      w.affix = { hardHits: 1.2 };
    }
  },
  swarming: {
    id: "swarming",
    name: "Swarming",
    desc: "Something extra comes out every twenty seconds.",
    apply: (w) => w.affix = { swarm: 20 }
  },
  hushed: {
    id: "hushed",
    name: "Hushed",
    desc: "Telegraphs are shorter. You have to know the fight.",
    apply: (w) => w.affix = { hush: 0.78 }
  }
};
var MOD_IDS = ["none", "frenzied", "volcanic", "brittle", "swarming", "hushed"];
function weekModifier(week = weekNumber()) {
  if (week <= 1)
    return MODIFIERS.none;
  const r = rng(hashSeed(`tb-mod-${week}`));
  return MODIFIERS[MOD_IDS[1 + Math.floor(r() * (MOD_IDS.length - 1))]];
}
function dailyBlessings(day = dayNumber()) {
  const r = rng(hashSeed(`tb-bless-${day}`));
  return pickN(BLESSING_IDS, 3, r).map((id) => BLESSINGS[id]);
}
var fightSeed = (day, tier) => hashSeed(`tb-fight-${day}-${tier}`);
var practiceSeed = (day, tier, attempt) => hashSeed(`tb-practice-${day}-${tier}-${attempt}`);

// site/js/content/items.js
var ITEMS = {
  flask: {
    id: "flask",
    name: "Ember Flask",
    icon: "potion",
    kind: "potion",
    charges: 2,
    cooldown: 1.2,
    cost: 0,
    unlock: "start",
    sound: "drink",
    desc: "Drink deep. Heals 42.",
    long: "Two swallows a fight. Drinking locks you in place for a moment — pick your window.",
    use(w, p) {
      if (p.hp >= p.hpMax)
        return false;
      p.hp = Math.min(p.hpMax, p.hp + 42);
      w.floaters.push({ x: p.x, y: p.y - 30, v: "+42", kind: "heal", t: 0 });
      w.events.push({ t: EV.heal, x: p.x, y: p.y });
      return true;
    }
  },
  knives: {
    id: "knives",
    name: "Throwing Knives",
    icon: "dagger",
    kind: "throw",
    charges: 5,
    cooldown: 0.42,
    cost: 90,
    unlock: "start",
    sound: "throw",
    desc: "Five knives. 26 each, at range.",
    long: "For the seconds you cannot close. They fly straight and they do not care about armour.",
    use(w, p) {
      w.shot({ x: p.x, y: p.y - 10, a: p.aim, speed: 300, r: 4, dmg: 26, art: "shard", life: 1.4, tag: "friendly" });
      return true;
    }
  },
  bomb: {
    id: "bomb",
    name: "Fire Bomb",
    icon: "bomb",
    kind: "throw",
    charges: 3,
    cooldown: 1,
    cost: 140,
    unlock: "gnasher",
    sound: "throw",
    desc: "Lobbed. 48 in a wide circle.",
    long: "Lands 70 paces out and takes the adds with it. Mind your own feet.",
    use(w, p) {
      const d = 70;
      w.hazard({ kind: KIND.CIRCLE, x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d, r: 42, tele: 0.55, active: 0.14, fade: 0.3, dmg: 0, tag: "friendlyBoom", friendly: 48 });
      return true;
    }
  },
  bulwark: {
    id: "bulwark",
    name: "Bulwark",
    icon: "shield",
    kind: "spell",
    charges: null,
    cooldown: 15,
    cost: 170,
    unlock: "shop",
    sound: "shieldUp",
    desc: "A shield that soaks 70.",
    long: "Not a dodge. A second chance at one, when the floor gives you nowhere to go.",
    use(w, p) {
      p.shield = 70;
      w.buff("bulwark", 6, null, (ww, pp) => pp.shield = 0);
      return true;
    }
  },
  firebolt: {
    id: "firebolt",
    name: "Firebolt",
    icon: "firebolt",
    kind: "spell",
    charges: null,
    cooldown: 6,
    cost: 150,
    unlock: "cinder",
    sound: "cast",
    desc: "44 damage, and it burns.",
    long: "Cinder's own trick, taken off her. It leaves a coal burning where it lands.",
    use(w, p) {
      w.shot({ x: p.x, y: p.y - 10, a: p.aim, speed: 230, r: 6, dmg: 44, art: "ember", life: 2, tag: "friendly", burn: true });
      return true;
    }
  },
  frost: {
    id: "frost",
    name: "Frost Nova",
    icon: "frost",
    kind: "spell",
    charges: null,
    cooldown: 16,
    cost: 190,
    unlock: "shop",
    sound: "frost",
    desc: "Slows everything round you for 4 s.",
    long: "Buys you four seconds to breathe, and four seconds is a phase.",
    use(w, p) {
      w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 82, tele: 0, active: 0.2, fade: 0.4, dmg: 0, style: "safe", tag: "friendlyBoom", friendly: 16 });
      w.buff("frost", 4, (ww) => ww.slowField = 0.45, (ww) => ww.slowField = 1);
      return true;
    }
  },
  blink: {
    id: "blink",
    name: "Blink",
    icon: "dash",
    kind: "spell",
    charges: null,
    cooldown: 7,
    cost: 210,
    unlock: "crab",
    sound: "blink",
    desc: "Step 96 paces, untouchable.",
    long: "Not faster than a roll — further, and through things a roll cannot cross.",
    use(w, p) {
      const d = 96;
      const to = { x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d };
      w.arena.keep(to, PLAYER.radius + 2);
      w.events.push({ t: EV.blink, x: p.x, y: p.y, nx: to.x, ny: to.y });
      p.x = to.x;
      p.y = to.y;
      p.iFrames = Math.max(p.iFrames, 0.3);
      return true;
    }
  },
  caltrops: {
    id: "caltrops",
    name: "Caltrops",
    icon: "caltrop",
    kind: "spell",
    charges: null,
    cooldown: 13,
    cost: 130,
    unlock: "shop",
    sound: "throw",
    desc: "A field that bites for 8 s.",
    long: "Drop them where the boss is going to be, not where it is.",
    use(w, p) {
      w.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 46, tele: 0.2, active: 8, fade: 0.4, dmg: 0, every: 0.7, style: "safe", tag: "friendlyField", friendly: 11 });
      return true;
    }
  },
  horn: {
    id: "horn",
    name: "Horn of Waking",
    icon: "horn",
    kind: "spell",
    charges: null,
    cooldown: 26,
    cost: 240,
    unlock: "shop",
    sound: "horn",
    desc: "Breaks a cast outright.",
    long: "Once every half a minute you can simply say no to whatever is being cast.",
    use(w, p) {
      const b = w.boss;
      b.move = null;
      b.casting = null;
      b.immune = false;
      b.stagger = 2.2;
      if (w.souls?.answers)
        b.answer = null, b.greed = 0, b.backT = 0;
      w.clip(b, "hurt");
      w.say(`${w.spec.name} reels.`);
      w.shake(9);
      for (const h of w.hazards)
        if (h.t < h.tele)
          h.done = true;
      return true;
    }
  },
  stone: {
    id: "stone",
    name: "Ember Stone",
    icon: "stone",
    kind: "spell",
    charges: null,
    cooldown: 22,
    cost: 220,
    unlock: "shop",
    sound: "buff",
    desc: "+70% damage for 6 s.",
    long: "For the window after a stagger. Everything else is a waste of it.",
    use(w, p) {
      w.buff("stone", 6, (ww, pp) => pp.mods.dmg *= 1.7, (ww, pp) => pp.mods.dmg /= 1.7);
      return true;
    }
  },
  lantern: {
    id: "lantern",
    name: "Tide Lantern",
    icon: "lantern",
    kind: "spell",
    charges: null,
    cooldown: 12,
    cost: 120,
    unlock: "shop",
    sound: "buff",
    desc: "Fills your stamina and speeds you up.",
    long: "Empty bar, boss mid-swing. This is the button.",
    use(w, p) {
      p.stamina = p.staminaMax;
      p.exhausted = false;
      p.staminaWait = 0;
      w.buff("lantern", 5, (ww, pp) => pp.mods.speed *= 1.25, (ww, pp) => pp.mods.speed /= 1.25);
      return true;
    }
  },
  salve: {
    id: "salve",
    name: "Kelp Salve",
    icon: "heal",
    kind: "potion",
    charges: 1,
    cooldown: 1,
    cost: 160,
    unlock: "shop",
    sound: "drink",
    desc: "Heals 30 now and 40 over 8 s.",
    long: "Slower than the flask, and worth more if you drink it before you need it.",
    use(w, p) {
      p.hp = Math.min(p.hpMax, p.hp + 30);
      w.floaters.push({ x: p.x, y: p.y - 30, v: "+30", kind: "heal", t: 0 });
      w.buff("salveDrip", 8, (ww, pp) => pp.regen = (pp.regen || 0) + 5, (ww, pp) => pp.regen = Math.max(0, (pp.regen || 0) - 5));
      return true;
    }
  }
};
var ITEM_IDS = Object.keys(ITEMS);
var STARTING_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].unlock === "start");
var BOSS_DROPS = Object.fromEntries(ITEM_IDS.filter((id) => !["start", "shop"].includes(ITEMS[id].unlock)).map((id) => [ITEMS[id].unlock, id]));

// site/js/store.js
var KEY = CONFIG.SAVE_KEY;
var SAVE_V = 2;
var bossAt = (tier) => BOSS_ORDER2[tier - 1] || Object.keys(BOSSES2).find((id) => BOSSES2[id].tier === tier) || `tier${tier}`;
var bossOfOldTier = (t) => Object.keys(BOSSES2).find((id) => BOSSES2[id].tier === t) || BOSS_ORDER2[t - 1] || null;
var UPGRADES = {
  blade: { name: "Whetstone", icon: "sword", desc: "+6% damage a level", max: 5, cost: (l) => 120 + l * 90, mod: (l) => ({ dmg: 1 + l * 0.06 }) },
  cloak: { name: "Padded Cloak", icon: "shield", desc: "+8 health a level", max: 5, cost: (l) => 110 + l * 85, mod: (l) => ({ hp: l * 8 }) },
  boots: { name: "Soft Boots", icon: "roll", desc: "Rolls cost 5% less a level", max: 5, cost: (l) => 100 + l * 80, mod: (l) => ({ rollCost: 1 - l * 0.05 }) }
};
function blank() {
  return {
    v: SAVE_V,
    id: Math.random().toString(36).slice(2, 10),
    gold: 0,
    items: [...STARTING_ITEMS],
    loadout: ["flask", "knives"],
    arms: { main: "sword", off: null },
    upgrades: { blade: 0, cloak: 0, boots: 0 },
    week: { n: 0, cleared: [], best: "" },
    today: { key: "", used: false, tier: 1, blessing: null, done: false, live: 0, left: false },
    kills: Object.fromEntries(Object.keys(BOSSES2).map((id) => [id, 0])),
    firsts: {},
    weeksCleared: 0,
    history: [],
    seenHelp: false,
    settings: { sound: true, music: true, shake: 1, holdToAttack: true, hand: "right", demo: false, classic: false }
  };
}
var save = blank();
function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const was = JSON.parse(raw);
      if (!(num(was?.v, 1) >= SAVE_V) && localStorage.getItem(KEY + ":v1") == null)
        localStorage.setItem(KEY + ":v1", raw);
      save = migrate({ ...blank(), ...was, v: was?.v ?? 1 });
    }
    rollOver();
  } catch {
    try {
      if (raw)
        localStorage.setItem(KEY + ":broken", raw);
    } catch {}
    save = blank();
    rollOver();
  }
  return save;
}
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var num = (v, d = 0) => typeof v === "number" && Number.isFinite(v) ? v : d;
function migrate(s) {
  const b = blank();
  if (!(num(s.v, 1) >= SAVE_V))
    s = toV2(s);
  if (typeof s.id !== "string" || !s.id)
    s.id = b.id;
  s.gold = Math.max(0, num(s.gold));
  s.settings = { ...b.settings, ...isObj(s.settings) ? s.settings : {} };
  s.upgrades = { ...b.upgrades, ...isObj(s.upgrades) ? s.upgrades : {} };
  for (const [k, u] of Object.entries(UPGRADES))
    s.upgrades[k] = Math.min(u.max, Math.max(0, Math.floor(num(s.upgrades[k]))));
  s.kills = { ...b.kills, ...isObj(s.kills) ? s.kills : {} };
  for (const k of Object.keys(s.kills))
    s.kills[k] = Math.max(0, num(s.kills[k]));
  s.firsts = isObj(s.firsts) ? s.firsts : {};
  const wk = isObj(s.week) ? s.week : b.week;
  s.week = { n: num(wk.n), cleared: Array.isArray(wk.cleared) ? [...new Set(wk.cleared.filter((id) => typeof id === "string" && BOSSES2[id]))] : [], best: typeof wk.best === "string" && BOSSES2[wk.best] ? wk.best : "" };
  s.history = Array.isArray(s.history) ? s.history.filter(isObj).slice(-200) : [];
  s.seenHelp = !!s.seenHelp;
  s.today = { ...b.today, ...isObj(s.today) ? s.today : {} };
  if (typeof s.today.key !== "string")
    s.today.key = "";
  s.today.live = typeof s.today.live === "string" && s.today.live ? s.today.live : 0;
  s.today.tier = num(s.today.tier, 1);
  if (s.today.used && !s.today.blessing)
    s.today.blessing = "none";
  if (!Array.isArray(s.items) || !s.items.length)
    s.items = [...STARTING_ITEMS];
  s.items = s.items.filter((i) => ITEMS[i]);
  if (!Array.isArray(s.loadout) || s.loadout.length !== 2)
    s.loadout = ["flask", "knives"];
  s.loadout = s.loadout.map((i) => i && s.items.includes(i) ? i : null);
  const a = s.arms && typeof s.arms === "object" ? s.arms : {};
  s.arms = { main: WEAPONS[a.main]?.kind === "weapon" ? a.main : "sword", off: a.off && WEAPONS[a.off] ? a.off : null };
  s.weeksCleared = Math.max(num(Number(s.weeksCleared)), clearedWeeksIn(s));
  delete s.streak;
  delete s.bestStreak;
  return s;
}
function toV2(s) {
  const wk = isObj(s.week) ? s.week : {};
  const ids = (list) => Array.isArray(list) ? list.map((t) => typeof t === "string" ? t : bossOfOldTier(t)).filter(Boolean) : [];
  const best = typeof wk.best === "string" ? wk.best : num(wk.best) ? bossOfOldTier(num(wk.best)) || "" : "";
  const today = isObj(s.today) ? { ...s.today } : s.today;
  if (isObj(today) && typeof today.live === "number" && today.live)
    today.live = bossOfOldTier(today.live) || 0;
  const history = Array.isArray(s.history) ? s.history.map((h) => isObj(h) && typeof h.tier === "number" && h.boss == null ? (({ tier, ...rest }) => ({ ...rest, boss: bossOfOldTier(tier) }))(h) : h) : s.history;
  return { ...s, v: SAVE_V, week: { ...wk, cleared: ids(wk.cleared), best }, today, history };
}
var tierOfBoss = (id) => BOSS_ORDER2.includes(id) ? BOSS_ORDER2.indexOf(id) + 1 : BOSSES2[id]?.tier ?? 0;
var lastBossWin = (h) => h && h.won && tierOfBoss(h.boss) >= BOSS_ORDER2.length;
var allFelled = (cleared) => BOSS_ORDER2.every((id) => cleared.includes(id));
function clearedWeeksIn(s) {
  const weeks = new Set((Array.isArray(s.history) ? s.history : []).filter(lastBossWin).map((h) => weekNumber(h.d)));
  if (s.week && Array.isArray(s.week.cleared) && allFelled(s.week.cleared))
    weeks.add(s.week.n);
  return weeks.size;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {}
}
var get = () => save;
function rollOver() {
  const day = dayNumber();
  const week = weekNumber(day);
  const key = dateKey();
  if (save.week.n !== week) {
    save.week = { n: week, cleared: [], best: "" };
  }
  if (save.today.key === key && save.today.live) {
    const boss = save.today.live;
    recordLoss(0, 0);
    save.today.left = true;
    endDay({ boss, won: false, left: true });
  }
  if (save.today.key !== key) {
    save.today = { key, used: false, tier: nextTier(), blessing: null, done: false, live: 0, left: false };
  }
  persist();
}
function nextTier() {
  for (let t = 1;t <= BOSS_ORDER2.length; t++)
    if (!save.week.cleared.includes(BOSS_ORDER2[t - 1]))
      return t;
  return 0;
}
var weekCleared = () => nextTier() === 0;
var felled = (tier) => save.week.cleared.includes(bossAt(tier));
var felledCount = () => BOSS_ORDER2.filter((id) => save.week.cleared.includes(id)).length;
function chooseBlessing(id) {
  if (!save.today.blessing) {
    save.today.blessing = id || "none";
    persist();
  }
  return save.today.blessing;
}
function startFight(tier) {
  save.today.used = true;
  save.today.tier = tier;
  save.today.live = bossAt(tier);
  persist();
}
function recordWin(tier, gold, drops) {
  save.today.live = 0;
  const id = bossAt(tier);
  if (!save.week.cleared.includes(id)) {
    save.week.cleared.push(id);
    if (allFelled(save.week.cleared))
      save.weeksCleared++;
  }
  const at = (b) => BOSS_ORDER2.includes(b) ? BOSS_ORDER2.indexOf(b) : BOSS_ORDER2.length;
  save.week.cleared.sort((a, b) => at(a) - at(b));
  save.gold += gold;
  save.kills[id] = (save.kills[id] || 0) + 1;
  if (!save.firsts[id])
    save.firsts[id] = dayNumber();
  for (const d of drops || [])
    if (!save.items.includes(d))
      save.items.push(d);
  if (!save.week.best || at(id) > at(save.week.best))
    save.week.best = id;
  persist();
}
function recordLoss(tier, gold) {
  save.today.live = 0;
  save.today.done = true;
  save.gold += gold;
  persist();
}
function endDay(entry) {
  save.today.done = true;
  if (entry) {
    const { tier, ...rest } = entry;
    save.history.push({ d: dayNumber(), ...rest, ...tier != null ? { boss: bossAt(tier) } : {} });
    if (save.history.length > 200)
      save.history.shift();
  }
  persist();
}
function buyItem(id) {
  const it = ITEMS[id];
  if (!it || save.items.includes(id) || save.gold < it.cost)
    return false;
  save.gold -= it.cost;
  save.items.push(id);
  persist();
  return true;
}
function buyUpgrade(key) {
  const u = UPGRADES[key];
  const lvl = save.upgrades[key] || 0;
  if (!u || lvl >= u.max)
    return false;
  const cost = u.cost(lvl);
  if (save.gold < cost)
    return false;
  save.gold -= cost;
  save.upgrades[key] = lvl + 1;
  persist();
  return true;
}
function setSlot(i, id) {
  if (id && !save.items.includes(id))
    return false;
  if (id && save.loadout[1 - i] === id)
    save.loadout[1 - i] = null;
  save.loadout[i] = id;
  persist();
  return true;
}
function setArm(hand, id) {
  if (hand === "main" && WEAPONS[id]?.kind !== "weapon")
    return false;
  if (hand === "off" && id && !WEAPONS[id])
    return false;
  save.arms = { ...save.arms, [hand]: id || null };
  persist();
  return true;
}
function setSetting(k, v) {
  save.settings[k] = v;
  persist();
}
function playerMods() {
  const m = { dmg: 1, speed: 1, rollCost: 1, hp: 0, iFrames: 0, lifesteal: 0, crit: 0 };
  for (const [k, u] of Object.entries(UPGRADES)) {
    const lvl = save.upgrades[k] || 0;
    if (!lvl)
      continue;
    const got = u.mod(lvl);
    for (const [s, v] of Object.entries(got))
      m[s] = s === "hp" ? m[s] + v : typeof v === "number" && (s === "dmg" || s === "speed" || s === "rollCost") ? m[s] * v : v;
  }
  return m;
}
function exportCode() {
  const slim = { v: save.v, id: save.id, gold: save.gold, items: save.items, loadout: save.loadout, arms: save.arms, upgrades: save.upgrades, week: save.week, kills: save.kills, firsts: save.firsts, weeksCleared: save.weeksCleared };
  const json = JSON.stringify(slim);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes)
    bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function importCode(code) {
  try {
    const bin = atob(code.trim().replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!isObj(obj) || !Array.isArray(obj.items))
      return false;
    const next = migrate({ ...blank(), ...save, ...obj, v: obj.v ?? 1 });
    const prev = save;
    save = next;
    try {
      rollOver();
    } catch {
      save = prev;
      persist();
      return false;
    }
    persist();
    return true;
  } catch {
    return false;
  }
}
function wipe() {
  save = blank();
  rollOver();
  persist();
}

// site/js/ui/title.js
function renderTitle(root, { onBegin, onCamp, onCamp2, onHelp, onSettings, onPractice, noView = "" }) {
  const save = get();
  const day = dayNumber();
  const week = weekNumber(day);
  const tier = nextTier();
  const mod = weekModifier(week);
  const done = save.today.done;
  const left = done && save.today.left;
  const cleared = weekCleared();
  const label = cleared ? "Victory lap" : tier === 1 ? "Boss I waits" : tier === 2 ? "Boss II waits" : "The Crystal Crab waits";
  const reached = BOSS_ORDER2.slice(0, cleared ? BOSS_ORDER2.length : tier).map((id, i) => ({ tier: i + 1, spec: BOSSES2[id] }));
  const previews = MODELLED2.filter((id) => !BOSS_ORDER2.includes(id) && BOSSES2[id]).map((id) => BOSSES2[id]).sort((a, b) => a.tier - b.tier);
  root.innerHTML = html`<section class="title">
    <canvas class="title-canvas" aria-label="The Warden, seen from behind, under an old stone arch whose three bell hooks hang empty, looking out at dawn over a village and the three far shrines where the bells are now"></canvas>
    <div class="title-veil"></div>
    <div class="title-top">
      <div class="tt-kicker">One life a day · ${CONFIG.SEASON}</div>
      <h1 class="tt-name">Three <br />Bells</h1>
      <div class="tt-rule" aria-hidden="true"><i></i><span></span><i></i></div>
    </div>
    <div class="title-bottom">
      <div class="tt-week">Week ${week} · Day ${dayOfWeek(day)} of 7${mod.id !== "none" ? ` · ${mod.name}` : ""}</div>
      ${done ? html`<div class="tt-done">
            <div class="tt-done-line">Today is spent.</div>
            ${left ? html`<div class="tt-sub">You left in the middle of a fight, and that counts as a death.</div>` : ""}
            <div class="tt-sub">Next life in ${untilNext()}</div>
          </div>` : html`<button class="tt-begin" data-begin type="button"><span class="tt-tap">[Tap]</span> ${cleared ? "for a victory lap" : "to face " + (BOSS_ORDER2[tier - 1] === "crab" ? "the Crystal Crab" : "Boss " + roman(tier))}</button>
            <div class="tt-sub">${label} · ${felledCount()} of ${BOSS_ORDER2.length} felled this week</div>`}
      <button class="btn btn-go tt-practise" data-practice type="button">Practise a fight</button>
      ${noView ? html`<div class="tt-sub tt-view">${noView}</div>` : ""}
      <div class="tt-round">
        <button class="rnd" data-camp type="button" aria-label="Camp"><span>Camp</span></button>
        <button class="rnd rnd-camp2" data-camp2 type="button" aria-label="Camp 2.0"><span>Camp 2.0</span></button>
        <button class="rnd" data-help type="button" aria-label="How to play"><span>How</span></button>
        <button class="rnd" data-settings type="button" aria-label="Settings"><span>Settings</span></button>
        <button class="rnd" data-gold type="button" aria-label="Gold" disabled><span>${save.gold}g</span></button>
      </div>
    </div>
    <div class="modal tt-pick" data-pick role="dialog" aria-label="Practice" hidden>
      <div class="modal-box">
        <h2>Practice</h2>
        <p class="pick-note">Any boss you have reached this week, as often as you like. It never counts and pays nothing, and your life and blessing for today stay as they are.</p>
        <div class="pick-list">
          ${reached.map(({ tier: t, spec }) => html`<button class="btn pick-boss" data-practice-tier="${t}" type="button">
              <b>${spec.name}</b><i>Boss ${roman(t)} · ${felled(t) ? "felled this week" : "still standing"}</i>
            </button>`)}
          ${previews.map((spec) => html`<button class="btn pick-boss" data-practice-boss="${spec.id}" type="button">
              <b>${spec.name}</b><i>Boss ${roman(spec.tier)} · preview, not in the season yet</i>
            </button>`)}
        </div>
        <button class="btn btn-quiet" data-pick-close type="button">Not now</button>
      </div>
    </div>
  </section>`;
  const cv = root.querySelector(".title-canvas");
  const ctx = cv.getContext("2d");
  let raf = 0;
  let t0 = performance.now();
  const rand = rng(4242);
  const flies = Array.from({ length: 26 }, () => ({ x: rand(), y: 0.55 + rand() * 0.45, ph: rand() * TAU, sp: 0.2 + rand() * 0.5, r: 0.6 + rand() * 1.2 }));
  const embers = Array.from({ length: 22 }, () => ({ t: rand(), sp: 0.25 + rand() * 0.5, off: (rand() - 0.5) * 22 }));
  const glints = Array.from({ length: 18 }, () => ({ v: rand(), h: rand() * 2 - 1, ph: rand() * TAU, sp: 1.6 + rand() * 2.4 }));
  function fit() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  }
  function draw(now) {
    raf = requestAnimationFrame(draw);
    const tall = ART.titleTall && cv.width / cv.height < Math.sqrt((ART.title?.w / ART.title?.h || 4 / 3) * (ART.titleTall.w / ART.titleTall.h));
    const art = tall ? ART.titleTall : ART.title;
    if (!art)
      return;
    const time = (now - t0) / 1000;
    const u = art.unit || 1;
    ctx.imageSmoothingEnabled = !!art.smooth;
    ctx.imageSmoothingQuality = "high";
    const rendering = art.smooth ? "auto" : "pixelated";
    if (cv.style.imageRendering !== rendering)
      cv.style.imageRendering = rendering;
    const W = cv.width;
    const H = cv.height;
    const s = Math.max(W / art.w, H / art.h);
    const ox = (W - art.w * s) / 2;
    const oy = (H - art.h * s) * 0.42;
    ctx.fillStyle = "#08060e";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(art.img.cv, ox, oy, art.w * s, art.h * s);
    const P = (x, y) => [ox + x * s, oy + y * s];
    const glow = (x, y, r, stops) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      for (const [at, c] of stops)
        g.addColorStop(at, c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };
    ctx.globalCompositeOperation = "lighter";
    if (art.fire) {
      const [fx, fy] = P(art.fire[0], art.fire[1]);
      const flick = 0.72 + Math.sin(time * 7.3) * 0.12 + Math.sin(time * 17.1) * 0.06;
      const fr = art.fire[2] * s * (2.6 + Math.sin(time * 5) * 0.18);
      glow(fx, fy, fr, [[0, `rgba(255, 200, 110, ${0.5 * flick})`], [0.45, `rgba(255, 140, 40, ${0.2 * flick})`], [1, "rgba(255,120,30,0)"]]);
    }
    (art.lanterns || []).forEach(([lx, ly, lr], i) => {
      const [px, py] = P(lx, ly);
      const flick = 0.7 + Math.sin(time * 6.1 + i * 2.3) * 0.13 + Math.sin(time * 15.7 + i) * 0.07;
      glow(px, py, lr * s * (1.9 + Math.sin(time * 4.3 + i) * 0.12), [[0, `rgba(255, 196, 110, ${0.42 * flick})`], [0.5, `rgba(255, 140, 50, ${0.14 * flick})`], [1, "rgba(255,120,30,0)"]]);
    });
    (art.fires || []).forEach(([fx, fy, fr], i) => {
      const [px, py] = P(fx, fy);
      const k = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.9 + i)) + Math.sin(time * 9.7) * 0.06;
      glow(px, py, fr * s * 1.6, [[0, `rgba(255, 120, 50, ${0.26 * k})`], [1, "rgba(255,90,30,0)"]]);
    });
    (art.bells || []).forEach(([bx, by, br], i) => {
      const k = 0.35 + 0.65 * Math.max(0, Math.sin(time * 0.8 - i * 0.7));
      const [px, py] = P(bx, by);
      glow(px, py, br * s * 3.4, [[0, `rgba(255, 214, 107, ${0.3 * k})`], [1, "rgba(255,214,107,0)"]]);
    });
    if (art.sun) {
      const [sx, sy] = P(art.sun[0], art.sun[1]);
      const k = 0.85 + 0.15 * Math.sin(time * 0.6);
      glow(sx, sy, art.sun[2] * s * 4.2, [[0, `rgba(255, 236, 190, ${0.2 * k})`], [0.4, `rgba(255, 200, 130, ${0.08 * k})`], [1, "rgba(255,190,120,0)"]]);
    }
    if (art.glitter) {
      const [gx, g0, g1, gw] = art.glitter;
      for (const g of glints) {
        const k = Math.max(0, Math.sin(time * g.sp + g.ph)) ** 3;
        if (k < 0.02)
          continue;
        const [px, py] = P(gx + g.h * gw * (0.35 + 0.65 * g.v), g0 + (g1 - g0) * g.v);
        glow(px, py, Math.max(1.5, s * u * (0.8 + g.v)), [[0, `rgba(255, 246, 220, ${0.75 * k})`], [1, "rgba(255,240,210,0)"]]);
      }
    }
    if (art.moon) {
      const [mx, my] = P(art.moon[0], art.moon[1]);
      glow(mx, my, art.moon[2] * s * 3.2, [[0, "rgba(220, 232, 255, 0.22)"], [1, "rgba(220,232,255,0)"]]);
    }
    const stars = art.stars || [];
    for (let i = 0;i < stars.length; i++) {
      const [sx, sy, b] = stars[i];
      const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * (1.2 + i % 7 * 0.31) + i));
      const [px, py] = P(sx, sy);
      ctx.fillStyle = `rgba(248, 244, 234, ${k * b * 0.8})`;
      ctx.fillRect(px, py, Math.max(1, s * 0.8 * u), Math.max(1, s * 0.8 * u));
    }
    (art.caps || []).forEach(([cx2, cy2, r], i) => {
      const k = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * (0.7 + r * 0.4) + i * 2.1));
      const [px, py] = P(cx2, cy2);
      glow(px, py, 7 * s * r * u, [[0, `rgba(122, 228, 255, ${0.35 * k})`], [1, "rgba(122,228,255,0)"]]);
    });
    if (art.fire) {
      for (const e of embers) {
        const k = (time * e.sp + e.t) % 1;
        const [px, py] = P(art.fire[0] + e.off * k * u, art.fire[1] - (4 + k * 56) * u);
        ctx.fillStyle = `rgba(255, ${Math.round(170 + 60 * (1 - k))}, 80, ${(1 - k) * 0.8})`;
        ctx.fillRect(px, py, Math.max(1, s * u), Math.max(1, s * u));
      }
    }
    ctx.globalCompositeOperation = "source-over";
    for (const f of flies) {
      const x = (f.x + Math.sin(time * f.sp + f.ph) * 0.05) * W;
      const k = 0.25 + 0.75 * Math.max(0, Math.sin(time * 1.7 + f.ph));
      if (art.motes) {
        const yf = ((f.y - 0.55) / 0.45 * 0.8 + 0.12 - time * f.sp * 0.03 % 1 + 1) % 1;
        const a = k * 0.55 * Math.sin(Math.PI * yf);
        glow(x, yf * H, Math.max(1.5, s * f.r * u * 1.4), [[0, `rgba(255, 240, 200, ${a})`], [1, "rgba(255,240,200,0)"]]);
        continue;
      }
      const y = (f.y + Math.cos(time * f.sp * 0.8 + f.ph) * 0.035) * H;
      ctx.fillStyle = `rgba(228, 255, 138, ${k * 0.85})`;
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, s * f.r * u), Math.max(1, s * f.r * u));
    }
  }
  fit();
  raf = requestAnimationFrame(draw);
  const onResize = () => fit();
  window.addEventListener("resize", onResize);
  const go = (fn) => (e) => {
    e?.stopPropagation();
    unlock();
    sfx.click();
    fn();
  };
  root.querySelector("[data-camp]").onclick = go(onCamp);
  root.querySelector("[data-camp2]").onclick = go(onCamp2);
  root.querySelector("[data-help]").onclick = go(onHelp);
  root.querySelector("[data-settings]").onclick = go(onSettings);
  const beginBtn = root.querySelector("[data-begin]");
  if (beginBtn) {
    let going = false;
    const begin = (e) => {
      e?.stopPropagation();
      if (going)
        return;
      going = true;
      unlock();
      sfx.bellSmall();
      const t = root.querySelector(".title");
      t.classList.add("is-going");
      setTimeout(() => (going = false, t.classList.remove("is-going"), onBegin()), 620);
    };
    beginBtn.onclick = begin;
    root.querySelector(".title-canvas").onclick = begin;
  }
  const pick = root.querySelector("[data-pick]");
  const openPick = (open) => pick.hidden = !open;
  for (const el of root.querySelectorAll("[data-practice]"))
    el.onclick = go(() => openPick(true));
  root.querySelector("[data-pick-close]").onclick = go(() => openPick(false));
  pick.onclick = (e) => {
    if (e.target === e.currentTarget)
      go(() => openPick(false))(e);
  };
  for (const el of root.querySelectorAll("[data-practice-tier]"))
    el.onclick = go(() => onPractice(Number(el.dataset.practiceTier)));
  for (const el of root.querySelectorAll("[data-practice-boss]"))
    el.onclick = go(() => onPractice(BOSSES2[el.dataset.practiceBoss].tier, el.dataset.practiceBoss));
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  };
}

// site/js/ui/domwrite.js
var shown2 = new WeakMap;
function changed(el, key, v) {
  let m = shown2.get(el);
  if (!m)
    shown2.set(el, m = new Map);
  if (m.get(key) === v)
    return false;
  m.set(key, v);
  return true;
}
var setText = (el, v) => void (changed(el, "#text", v) && (el.textContent = v));
var setStyle = (el, key, v) => void (changed(el, key, v) && (el.style[key] = v));
var setVar = (el, name, v) => void (changed(el, name, v) && el.style.setProperty(name, v));

// site/js/ui/touch.js
var AIMED_ITEMS = new Set(["knives", "bomb", "firebolt", "blink"]);
var iconUrls = new Map;
var iconCanvas = (name, px = 30) => {
  const spr = (ART.icon[name] || ART.icon.star)?.[0];
  if (!spr)
    return "";
  let url = iconUrls.get(spr);
  if (!url) {
    const c = document.createElement("canvas");
    c.width = spr.w;
    c.height = spr.h;
    c.getContext("2d").drawImage(spr.cv, 0, 0);
    iconUrls.set(spr, url = c.toDataURL());
  }
  return `<img class="tb-ic" alt="" src="${url}" style="width:${px}px;height:${px * spr.h / spr.w}px">`;
};
function mountTouch(root, input, { loadout, hand = "right", offAct = "guard", offIcon = null }) {
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
  const R = 46;
  let stickId = null;
  let ox = 0;
  let oy = 0;
  const setStick = (x, y) => {
    let dx = x - ox;
    let dy = y - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = dx / d * R;
      dy = dy / d * R;
    }
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
    input.setStick(dx / R, dy / R);
  };
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
    if (stickId !== null)
      return;
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
    if (e.pointerId !== stickId)
      return;
    const r = zone.getBoundingClientRect();
    setStick(e.clientX - r.left, e.clientY - r.top);
    e.preventDefault();
  };
  const letGo = () => {
    if (stickId === null)
      return;
    stickId = null;
    rest();
    input.setStick(0, 0);
  };
  const onZoneUp = (e) => e.pointerId === stickId && letGo();
  zone.addEventListener("pointerdown", onZoneDown);
  zone.addEventListener("pointermove", onZoneMove);
  zone.addEventListener("pointerup", onZoneUp);
  zone.addEventListener("pointercancel", onZoneUp);
  zone.addEventListener("lostpointercapture", onZoneUp);
  const btns = [...root.querySelectorAll("[data-act]")];
  const owners = new Map;
  for (const b of btns) {
    const act = b.dataset.act;
    const id = act === "slot0" ? loadout[0] : act === "slot1" ? loadout[1] : null;
    const aims = act === "attack" || AIMED_ITEMS.has(id);
    const onRelease = aims && act !== "attack";
    b.addEventListener("pointerdown", (e) => {
      if (b.disabled)
        return;
      owners.set(e.pointerId, { act, x: e.clientX, y: e.clientY });
      const box = b.getBoundingClientRect();
      const at = [e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2)];
      b.classList.add("is-down");
      input.buttonDown(act, { aims, onRelease, at, r: box.width / 2 });
      b.setPointerCapture?.(e.pointerId);
      if (navigator.vibrate)
        navigator.vibrate(act === "attack" ? 8 : 12);
      e.preventDefault();
    });
    b.addEventListener("pointermove", (e) => {
      const o = owners.get(e.pointerId);
      if (!o || o.act !== act)
        return;
      b.classList.toggle("is-aiming", input.buttonMove(act, e.clientX - o.x, e.clientY - o.y));
    });
    const up = (cancel) => (e) => {
      const o = owners.get(e.pointerId);
      if (!o || o.act !== act)
        return;
      owners.delete(e.pointerId);
      b.classList.remove("is-down", "is-aiming");
      input.buttonUp(act, cancel);
    };
    b.addEventListener("pointerup", up(false));
    b.addEventListener("pointercancel", up(true));
    b.addEventListener("lostpointercapture", up(true));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const cds = [root.querySelector('[data-cd="0"]'), root.querySelector('[data-cd="1"]')];
  const ns = [root.querySelector('[data-n="0"]'), root.querySelector('[data-n="1"]')];
  const rollCd = root.querySelector('[data-cd="roll"]');
  return {
    release: letGo,
    update(p) {
      for (let i = 0;i < 2; i++) {
        const id = p.slots[i];
        if (!id || !cds[i])
          continue;
        const item = ITEMS[id];
        const total = (item.cooldown || 1) * (p.cdScale || 1);
        const k = clamp(p.cooldowns[i] / total, 0, 1);
        setVar(cds[i], "--k", k);
        cds[i].classList.toggle("is-cd", k > 0.001);
        if (item.charges != null) {
          setText(ns[i], p.charges[i]);
          ns[i].classList.toggle("is-out", p.charges[i] <= 0);
        } else
          setText(ns[i], "");
        const btn = ns[i].closest(".pad-btn");
        btn.classList.toggle("is-spent", item.charges != null && p.charges[i] <= 0 || k > 0.001);
      }
      if (rollCd)
        rollCd.parentElement.classList.toggle("is-spent", p.exhausted || p.stamina < 20);
    },
    destroy() {
      if (stickId !== null)
        input.setStick(0, 0);
      window.removeEventListener("resize", onResize);
      zone.removeEventListener("pointerdown", onZoneDown);
      zone.removeEventListener("pointermove", onZoneMove);
      zone.removeEventListener("pointerup", onZoneUp);
      zone.removeEventListener("pointercancel", onZoneUp);
      zone.removeEventListener("lostpointercapture", onZoneUp);
      root.innerHTML = "";
    }
  };
}

// site/js/ui/settings.js
var CHECKS = [
  ["sound", "Sound"],
  ["music", "The drone under the fight"],
  ["holdToAttack", "Hold to keep swinging"],
  ["demo", "Demo mode: show the red danger markings"],
  ["classic", "Practice the classic bosses (the fights before 2026-10-29)"]
];
function settingsFields() {
  const s = get().settings;
  return CHECKS.map(([k, label]) => `<label class="opt"><input type="checkbox" data-opt="${k}" ${s[k] ? "checked" : ""}><span>${label}</span></label>`).join("") + `<label class="opt"><input type="checkbox" data-opt="hand" ${s.hand === "left" ? "checked" : ""}><span>Left-handed on-screen controls</span></label>` + `<label class="opt opt-range"><span>Screen shake</span><input type="range" min="0" max="1.4" step="0.1" data-shake value="${s.shake}"></label>`;
}
function bindSettings(root) {
  const told = () => window.dispatchEvent(new CustomEvent("tb-settings"));
  for (const el of root.querySelectorAll("[data-opt]"))
    el.onchange = () => {
      const k = el.dataset.opt;
      setSetting(k, k === "hand" ? el.checked ? "left" : "right" : el.checked);
      told();
    };
  const shake = root.querySelector("[data-shake]");
  if (shake)
    shake.oninput = (e) => setSetting("shake", Number(e.target.value));
}
function openSettings(host, onClose = () => {}) {
  host.innerHTML = html`<div class="modal" data-modal role="dialog" aria-label="Settings">
    <div class="modal-box settings-box">
      <h2>Settings</h2>
      ${raw(settingsFields())}
      <button class="btn btn-go" data-close type="button">Done</button>
    </div>
  </div>`;
  bindSettings(host);
  const box = host.querySelector("[data-modal]");
  for (const ev of ["pointerdown", "mousedown", "touchstart"])
    box.addEventListener(ev, (e) => e.stopPropagation());
  let open = true;
  const close = () => {
    if (!open)
      return;
    open = false;
    host.innerHTML = "";
    onClose();
  };
  host.querySelector("[data-close]").onclick = () => (sfx.click(), close());
  box.onclick = (e) => {
    if (e.target === e.currentTarget)
      sfx.click(), close();
  };
  return close;
}

// site/js/ui/camp.js
function renderCamp(root, { onBack }) {
  let picking = null;
  let arming = null;
  function draw() {
    const save = get();
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
    const W_ICON = (w) => !w ? "" : `arm_${WEAPON_IDS.find((id) => WEAPONS[id] === w)}`;
    const feel = (w) => {
      if (!w)
        return "";
      if (w.kind === "shield")
        return `Guard ${Math.round(w.guard.negate * 100)}% · stability ${w.guard.stability}${w.guard.parry ? " · parries" : ""}`;
      const mv = w.moves;
      const avg = mv.reduce((a, m) => a + m.wind + m.active + m.recover, 0) / mv.length;
      const speed = avg < 0.32 ? "Quick" : avg < 0.5 ? "Steady" : avg < 0.75 ? "Heavy" : "Colossal";
      return `${speed} · ${mv.length} in a chain · reach ${Math.round(mv[0].range)}${w.hands === "two" ? " · two hands when the other is empty" : ""}`;
    };
    const armCard = (hand) => {
      const id = save.arms[hand];
      const w = id ? WEAPONS[id] : null;
      return html`<button class="slot-card ${arming === hand ? "is-picking" : ""} ${w ? "" : "is-empty"}" data-arm="${hand}" type="button">
        <span class="sc-key">${hand === "main" ? "Main" : "Off"}</span>
        <span class="sc-ic">${raw(w ? iconCanvas(W_ICON(w), 34) : "")}</span>
        <span class="sc-name">${w ? w.name : "Empty"}</span>
        <span class="sc-desc">${w ? feel(w) : "Tap to fill"}</span>
      </button>`;
    };
    const arms = settleArms(save.arms);
    const offSays = arms.offAct === "jump" ? "Jump: clear a low attack — a tongue lash, a ring or a wave along the ground" : arms.offAct === "guard" ? arms.off ? `${WEAPONS[arms.off].name}: hold to guard` : arms.twoHanded ? `Both hands on the ${WEAPONS[arms.main].name.toLowerCase()}; hold to guard with it` : "Hold to guard with your weapon" : arms.offAct === "paired" ? "Both weapons together (power stance)" : `Strike with the ${WEAPONS[arms.off].name.toLowerCase()}`;
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
        ${ownedNow ? html`<span class="sr-tag">${inUse ? "Carried" : "Owned"}</span>` : fromBoss ? html`<span class="sr-tag sr-drop">Fell ${BOSSES2[it.unlock]?.name || it.unlock}</span>` : html`<button class="btn btn-buy" data-buy="${id}" type="button" ${canBuy ? "" : raw("disabled")}>${it.cost}g</button>`}
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
        <p class="sc-note">Two buttons. Everything else is your arms and your roll.</p>
        <div class="slot-row">${raw(slotCard(0))}${raw(slotCard(1))}</div>
        ${picking != null ? html`<div class="picker">
              <div class="picker-head">Put in slot ${picking + 1}</div>
              <div class="picker-list">
                <button class="pick-item" data-set="" type="button"><span>Empty</span></button>
                ${raw(owned.map((id) => `<button class="pick-item ${save.loadout[picking] === id ? "is-on" : ""}" data-set="${id}" type="button">${iconCanvas(ITEMS[id].icon, 22)}<span>${ITEMS[id].name}</span></button>`).join(""))}
              </div>
            </div>` : ""}

        <h3 class="sc-h3">Your arms</h3>
        <p class="sc-note">The attack button swings your main hand. The off-hand button (L, F or the middle mouse button): ${offSays}.</p>
        <div class="slot-row">${raw(armCard("main"))}${raw(armCard("off"))}</div>
        ${arming ? html`<div class="picker">
              <div class="picker-head">${arming === "main" ? "In your main hand" : "In your off hand"}</div>
              <div class="picker-list">
                ${arming === "off" ? raw(`<button class="pick-item ${!save.arms.off ? "is-on" : ""}" data-weapon="" type="button"><span>Empty</span></button>`) : ""}
                ${raw(WEAPON_IDS.filter((id) => armable(id) && (arming === "off" || WEAPONS[id].kind === "weapon")).map((id) => `<button class="pick-item ${save.arms[arming] === id ? "is-on" : ""}" data-weapon="${id}" type="button">${iconCanvas(W_ICON(WEAPONS[id]), 22)}<span>${WEAPONS[id].name}</span></button>`).join(""))}
              </div>
            </div>` : ""}

        <h3 class="sc-h3">The peddler</h3>
        ${raw(owned.map((id) => itemRow(id, true)).join(""))}
        ${raw(locked.map((id) => itemRow(id, false)).join(""))}

        <h3 class="sc-h3">The smith</h3>
        <p class="sc-note">Small, permanent, and never enough to win a fight for you.</p>
        ${raw(Object.keys(UPGRADES).map(upgradeRow).join(""))}

        <h3 class="sc-h3">The week</h3>
        <div class="week-grid">
          ${raw(BOSS_ORDER2.map((id, i) => {
      const b = BOSSES2[id];
      const felled = save.week.cleared.includes(id);
      return `<div class="week-cell ${felled ? "is-felled" : ""}">
                <b>${roman(i + 1)}</b><span>${b.name}</span>
                <i>${felled ? "Felled" : "Standing"}</i>
              </div>`;
    }).join(""))}
        </div>

        <h3 class="sc-h3">Your record</h3>
        <p class="sc-note">How often each has fallen to you, and the day it first did.</p>
        <div class="week-grid">
          ${raw(BOSS_ORDER2.map((id) => {
      const n = save.kills[id] || 0;
      const first = save.firsts[id];
      return `<div class="week-cell ${n ? "is-felled" : ""}">
                <b>${n}</b><span>${BOSSES2[id].name}</span>
                <i>${first ? `First ${dayLabel(first)}` : "Not yet"}</i>
              </div>`;
    }).join(""))}
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
        ${raw(settingsFields())}
        <button class="btn btn-quiet btn-wipe" data-wipe type="button">Start again from nothing</button>
      </div>
    </section>`;
    const $ = (s) => root.querySelector(s);
    const msg = (t) => $("[data-msg]").textContent = t;
    $("[data-back]").onclick = () => (sfx.click(), onBack());
    for (const el of root.querySelectorAll("[data-pick]"))
      el.onclick = () => (sfx.click(), picking = picking === +el.dataset.pick ? null : +el.dataset.pick, draw());
    for (const el of root.querySelectorAll("[data-set]"))
      el.onclick = () => {
        setSlot(picking, el.dataset.set || null);
        sfx.click();
        picking = null;
        draw();
      };
    for (const el of root.querySelectorAll("[data-arm]"))
      el.onclick = () => (sfx.click(), arming = arming === el.dataset.arm ? null : el.dataset.arm, picking = null, draw());
    for (const el of root.querySelectorAll("[data-weapon]"))
      el.onclick = () => {
        setArm(arming, el.dataset.weapon || null);
        sfx.click();
        arming = null;
        draw();
      };
    for (const el of root.querySelectorAll("[data-buy]"))
      el.onclick = () => {
        if (buyItem(el.dataset.buy))
          sfx.coin(), msg(`${ITEMS[el.dataset.buy].name} is yours.`), draw();
        else
          sfx.deny();
      };
    for (const el of root.querySelectorAll("[data-up]"))
      el.onclick = () => {
        if (buyUpgrade(el.dataset.up))
          sfx.coin(), draw();
        else
          sfx.deny();
      };
    bindSettings(root);
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
      if (!v.trim())
        return;
      if (importCode(v))
        sfx.coin(), msg("Loaded."), draw();
      else
        sfx.deny(), msg("That code did not read.");
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
}

// site/js/sim/mechanics/bubble.js
var bubble = () => ({
  blockSolids(w) {
    if (!w.bubble)
      return;
    const { player: o, bubble: q } = w, touch = q.r + PLAYER.radius, d = Math.hypot(o.x - q.x, o.y - q.y);
    if (d < touch) {
      const a = d > 0.000001 ? Math.atan2(o.y - q.y, o.x - q.x) : Math.PI / 2;
      o.x = q.x + Math.cos(a) * touch;
      o.y = q.y + Math.sin(a) * touch;
    }
  }
});

// site/js/sim/mechanics/cinder-opening.js
var cinderOpening = () => ({
  seat(w, AB) {
    if (!w.spec.opening || !AB?.seat)
      return;
    const b = w.boss;
    b.home = [b.x, b.y];
    [b.x, b.y] = AB.seat;
    b.face = Math.atan2(w.player.y - b.y, w.player.x - b.x);
    b.immune = true;
    w.opening = w.spec.opening;
    w.bubble = { x: b.x, y: b.y, r: BUBBLE_R };
    w.clip(b, "seated");
    return true;
  },
  heroFree: (w) => w.opening ? w.introT == null : undefined,
  stepEntrance(w, dt) {
    const O = w.opening;
    if (!O)
      return;
    const b = w.boss;
    const t = w.stateT + (w.quick ? O.pop - 0.4 : 0);
    if (!b.popped && t >= O.pop) {
      b.popped = true;
      w.bubble = null;
      w.events.push({ t: EV.bubblePop, x: b.x, y: b.y });
      w.events.push({ t: EV.wake, x: b.x, y: b.y, speed: O.shock.speed });
      w.sound("bubblePop");
      w.sound("emberBoom");
      w.shake(16);
      w.hitstop = 0.09;
      w.clip(b, "opening");
      b.clipT = t - O.pop;
    }
    const p = w.player;
    if (b.popped && !b.shocked && (t - O.pop) * O.shock.speed >= Math.hypot(p.x - b.x, p.y - b.y)) {
      b.shocked = true;
      if (!inAir(p)) {
        staggerPlayer(p, b.x, b.y, O.shock.push, O.shock.time);
        p.face = Math.atan2(b.y - p.y, b.x - p.x);
        w.shake(6);
        w.events.push({ t: EV.shockHit, x: p.x, y: p.y });
      }
    }
    w.introT = !w.quick && t >= O.card && t < O.card + FIGHT.intro ? t - O.card : null;
    if (!b.charging && t >= O.spin[0]) {
      b.charging = true;
      w.sound("charge");
    }
    if (!b.marked && t >= O.mark) {
      b.marked = true;
      const W = w.arena.bell.wall;
      const a = p ? Math.atan2(p.y - b.y, p.x - b.x) : Math.atan2(W[1] - b.y, W[0] - b.x);
      b.face = a;
      const wl = O.wall;
      let len = 0;
      for (let d = 2;d <= 480; d += 2)
        if (w.arena.out(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d) <= 0)
          len = d;
      if (p)
        len = Math.max(len, Math.hypot(p.x - b.x, p.y - b.y) + 40);
      b.wallH = w.hazard({ kind: KIND.LANE, x: b.x, y: b.y, a, len, w: wl.w, tele: O.fire - O.mark, active: (len + wl.band) / wl.speed, advance: wl.speed, band: wl.band, fade: wl.fade, dmg: wl.dmg, tag: "wall" });
    }
    w.stepHazards(dt);
    if (!b.fired && b.wallH && phaseOf(b.wallH) !== "tele") {
      b.fired = true;
      w.shake(12);
      w.sound("fireWall");
    }
    if (b.fired && b.home && t >= O.descend[0]) {
      const u = Math.min(1, (t - O.descend[0]) / (O.descend[1] - O.descend[0])), e = u * u * (3 - 2 * u);
      const [sx, sy] = w.arena.bell.seat;
      b.x = sx + (b.home[0] - sx) * e;
      b.y = sy + (b.home[1] - sy) * e;
      b.face = Math.atan2(w.player.y - b.y, w.player.x - b.x);
    }
    if (b.popped)
      w.bodyBlock();
    if (t >= O.end) {
      b.immune = false;
      b.wallH = null;
      w.opening = null;
      w.introT = null;
      w.clip(b, "idle");
      w.setState("fight");
    }
    return true;
  }
});

// site/js/sim/mechanics/cinder-seal.js
var ownBell = (AB) => ({ x: AB.at[0], y: AB.at[1], r: AB.r, struckAt: -1, solids: [[AB.at[0], AB.at[1], AB.r], ...AB.posts] });
var within = (t, w0, w1) => reached(t, w0) && !reached(t, w1);
var cinderSeal = () => {
  let sealMove = null;
  const self = {
    setup(w) {
      sealMove = Object.values(w.spec.moves).find((m) => m.seal) || null;
      if (sealMove && !w.bell && w.arena.bell)
        w.bell = ownBell(w.arena.bell);
    },
    seal(w, b) {
      if (b.sealed || !w.bell)
        return;
      b.sealed = true;
      b.immune = true;
      b.unsealAt = null;
      w.bubble = { x: b.x, y: b.y, r: BUBBLE_R, at: w.time };
      w.events.push({ t: EV.seal, x: b.x, y: b.y });
      w.say("Sealed — strike the bell.");
    },
    afterBoss(w) {
      const b = w.boss;
      if (!b.sealed)
        return;
      w.bubble.x = b.x;
      w.bubble.y = b.y;
      if (b.unsealAt != null && reached(w.time, b.unsealAt))
        self.unseal(w);
    },
    unseal(w) {
      const { boss: b, bubble: q } = w, S = sealMove.seal;
      b.sealed = false;
      b.unsealAt = null;
      const m = b.move;
      b.immune = !!(m?.immune && within(b.moveT, m.immune[0], m.immune[1]));
      w.bubble = null;
      b.sealRest = w.time + S.rest;
      w.events.push({ t: EV.bubblePop, x: q.x, y: q.y });
      w.events.push({ t: EV.wake, x: q.x, y: q.y, speed: S.shock, small: true });
      w.sound("bubblePop");
      w.shake(8);
      w.freeze(0.06);
    },
    afterSwing(w) {
      const { bell, player: p } = w;
      if (!bell || !sealMove || p.hitThisSwing?.has("bell"))
        return;
      const arc = swingArc(p);
      if (!arc || !bladeHits(arc, bell.x, bell.y, bell.r))
        return;
      p.hitThisSwing.add("bell");
      bell.struckAt = w.time;
      w.events.push({ t: EV.bell, x: bell.x, y: bell.y, a: arc.a });
      w.sound("bell");
      w.shake(5);
      w.freeze(0.07);
      const b = w.boss;
      if (b.sealed && b.unsealAt == null)
        b.unsealAt = w.time + sealMove.seal.ring;
    },
    bossSolidR: (w, b) => b.sealed ? w.bubble.r : undefined,
    keepsImmune: (w, b) => !!b.sealed,
    allowMove(w, b, m) {
      if (m.seal && (b.sealed || !w.bell || w.time < (b.sealRest ?? 0)))
        return false;
      if (b.sealed && m.immune)
        return false;
      return;
    },
    shield: (w, b) => b.sealed ? w.bubble : undefined,
    shieldBlow(w, x, y, a) {
      w.events.push({ t: EV.ward, x, y, a });
      w.sound("bubbleWard");
      w.freeze(FEEL.clang.stop);
      w.shake(FEEL.clang.shake);
      const b = w.boss;
      if (!(w.time - (b.wardSaid ?? -9) < 0.5)) {
        b.wardSaid = w.time;
        w.floaters.push({ x, y: y - 14, v: "Sealed", kind: "shield", t: 0 });
      }
    }
  };
  return self;
};

// site/js/sim/mechanics/hall-answer.js
var hallAnswer = () => ({
  entranceTick(w, t) {
    const ans = w.arena.bell?.answer;
    const bell = w.bell;
    if (ans && !bell.hummed && t >= ans.hum)
      bell.hummed = true, w.sound("bellHum");
    if (ans && !bell.answered && t >= ans.boom) {
      bell.answered = true;
      w.events.push({ t: EV.bellAnswer, x: ans.at[0], y: ans.at[1] });
      w.sound("bellBoom");
      w.shake(7);
    }
  }
});

// site/js/sim/mechanics/index.js
var MECHANICS = { bubble, cinderOpening, cinderSeal, hallAnswer };
function mechanicsFor(w, bossIds = [], arenaIds = []) {
  return [...bossIds, ...arenaIds].map((id) => {
    const m = MECHANICS[id];
    if (!m)
      throw new Error(`no such mechanic: ${id}`);
    return m(w);
  });
}

// site/js/sim/world.js
var ADDS = {
  fly: { hp: 34, r: 7, speed: 68, dmg: 8, contact: 0.8, art: "fly", gold: 1 },
  ember: { hp: 46, r: 8, speed: 34, dmg: 0, contact: 0, art: "ember", boom: [24, 46], gold: 2 },
  hand: { hp: 70, r: 9, speed: 40, dmg: 14, contact: 1.1, art: "hand", root: 0.7, gold: 2 },
  diver: { hp: 10, r: 7, speed: 60, dmg: 0, contact: 0, art: "fly", gold: 1, dive: { every: [2.2, 3.2], hover: 0.5, len: 130, w: 14, dmg: 8, rest: 0.7, keep: 70 } }
};
function compact(list, keep) {
  let n = 0;
  for (let i = 0;i < list.length; i++)
    if (keep(list[i]))
      list[n++] = list[i];
  list.length = n;
}
var within2 = (t, w0, w1) => reached(t, w0) && !reached(t, w1);
var notDone = (h) => !h.done;
var notDead = (s) => !s.dead;
var addLeft = (a) => a.alive || a.dying < 0.45;
var floating = (f) => f.t < 0.9;
function hopLanding(b) {
  const { move: m, moveT: t } = b;
  if (!m || !b.jumpTo)
    return null;
  if (m.airborne && t < m.airborne[1])
    return m.airborne[1];
  const h = m.hops?.find((w) => t < w[1]);
  return h ? h[1] : null;
}
var PIT_PUSH = 3;
var PIT_G = { open: 0, c: [0, 0] };
var PIT_M = { x: 0, y: 0 };
var ownBell2 = (AB) => ({ x: AB.at[0], y: AB.at[1], r: AB.r, struckAt: -1, solids: [[AB.at[0], AB.at[1], AB.r], ...AB.posts] });

class World {
  constructor({ boss, blessing = null, loadout = [null, null], arms = null, mods = {}, seed = 1, practice = false, debug = null, entrance = false, quick = false }) {
    this.debug = debug || {};
    this.spec = boss;
    this.arena = arenaShape(boss.arena);
    this.shotSpan = this.arena.poly ? 40 : 10;
    this.rand = rng(seed);
    this.bossRand = rng(hashSeed(`moves:${seed}`));
    this.hazardId = 0;
    this.phaseMoves = [];
    this.bossFell = false;
    this.still = { mx: 0, my: 0, aim: 0, attack: false, roll: false, slot0: false, slot1: false, pause: false };
    this.practice = practice;
    this.blessing = blessing;
    this.time = 0;
    this.state = "intro";
    this.stateT = 0;
    this.player = makePlayer(mods);
    this.souls = boss.souls || null;
    if (this.souls?.iFrames)
      this.player.mods.iFrames += this.souls.iFrames;
    setArms(this.player, arms);
    this.player.slots = loadout;
    this.player.charges = loadout.map((id) => id && ITEMS[id] ? ITEMS[id].charges ?? 0 : 0);
    this.player.cooldowns = [0, 0];
    this.boss = {
      x: 0,
      y: -60,
      vx: 0,
      vy: 0,
      face: Math.PI / 2,
      hp: boss.hp,
      hpMax: boss.hp,
      r: boss.radius,
      body: boss.body ?? boss.radius,
      hurt: boss.hurt ?? [boss.radius, boss.radius],
      hitH: boss.hitH,
      clip: "idle",
      clipT: 0,
      clipOnce: false,
      move: null,
      moveT: 0,
      moveDone: 0,
      gap: 1.2,
      phase: 0,
      poise: boss.poise,
      poiseMax: boss.poise,
      stagger: 0,
      immune: false,
      airborne: false,
      flash: 0,
      lastMove: "",
      used: {},
      casting: null,
      dying: 0
    };
    this.mechs = mechanicsFor(this, boss.mechanics, placeOf(boss.arena).mechanics);
    if (entrance && boss.entrance === "bell") {
      const E = FIGHT.entrance;
      this.state = "bell";
      const reach = E.hookX * E.postH;
      const AB = this.arena.bell;
      this.bell = AB ? ownBell2(AB) : { x: E.bell[0], y: E.bell[1], r: E.bellR, struckAt: -1, solids: [[E.bell[0], E.bell[1], E.bellR], [E.bell[0] - Math.SQRT1_2 * reach, E.bell[1] + Math.SQRT1_2 * reach, E.postR]] };
      if (!this.mechAsk("seat", AB)) {
        this.boss.hidden = true;
        this.boss.airborne = true;
      }
      if (quick) {
        const b = this.bell, p = this.player, d = Math.hypot(b.x, b.y) || 1;
        [p.x, p.y] = [b.x - b.x / d * (b.r + 18), b.y - b.y / d * (b.r + 18)];
        p.face = p.aim = Math.atan2(b.y - p.y, b.x - p.x);
        this.quick = true;
      }
    } else if (this.arena.bell?.standing) {
      this.bell = ownBell2(this.arena.bell);
    }
    this.mechEach("setup");
    this.hazards = [];
    this.grab = null;
    this.shots = [];
    this.adds = [];
    this.chest = null;
    this.floaters = [];
    this.events = [];
    this.messages = [];
    this.shakeAmt = 0;
    this.hitstop = 0;
    this.slow = 1;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.hitsTaken = 0;
    this.potionsUsed = 0;
    this.enraged = false;
    this.clean = true;
    this.buffs = [];
    this.slowField = 1;
    this.affix = null;
    this.affixT = 0;
    this.frenzied = false;
  }
  mechEach(hook, ...args) {
    for (const m of this.mechs)
      m[hook]?.(this, ...args);
  }
  mechAsk(hook, ...args) {
    for (const m of this.mechs) {
      const r = m[hook]?.(this, ...args);
      if (r !== undefined)
        return r;
    }
    return;
  }
  act(name, ...args) {
    return this.mechAsk(name, ...args);
  }
  hazard(opts) {
    const rl = this.souls?.rollLive;
    if (rl && !opts.friendly && rl.tags.includes(opts.tag) && opts.active > rl.live)
      opts = { ...opts, active: rl.live, fade: (opts.fade ?? 0.25) + opts.active - rl.live, drawn: opts.active };
    const h = hazard(opts, ++this.hazardId);
    const hush = this.affix?.hush;
    if (hush && !h.friendly && h.tele > 0.5)
      h.hidden = Math.min(h.tele * (1 - hush), h.tele - 0.5);
    this.hazards.push(h);
    this.events.push({ t: EV.telegraph, h });
    return h;
  }
  shot(o) {
    this.shots.push({ x: o.x, y: o.y, vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed, speed: o.speed, r: o.r || 6, dmg: o.dmg || 14, art: o.art || "bog", life: o.life || 5, homing: o.homing || 0, spin: this.rand() * TAU, tag: o.tag || "", dead: false, burn: !!o.burn });
  }
  add(type, x, y) {
    const d = ADDS[type];
    if (!d)
      return;
    const a = { type, x, y, vx: 0, vy: 0, hp: d.hp, hpMax: d.hp, r: d.r, def: d, alive: true, t: 0, cool: 0, flash: 0, spawn: 0.5, dying: 0 };
    this.adds.push(a);
    this.events.push({ t: EV.spawn, x, y, kind: type });
  }
  detonate(a, dmg, r) {
    a.alive = false;
    a.dying = 0.3;
    this.hazard({ kind: KIND.CIRCLE, x: a.x, y: a.y, r, tele: 0.5, active: 0.14, fade: 0.25, dmg, tag: "boom", hurtsAdds: true });
  }
  safeZones(spots, r, tele, active) {
    const safe = spots.map(([x, y]) => [x, y, r]);
    this.hazard({ kind: KIND.FLOOD, x: 0, y: 0, safe, r: this.arena.R, tele, active, fade: 0.3, dmg: 22, every: 0.6, tag: "flood" });
  }
  clip(b, name) {
    b.clip = name;
    b.clipT = 0;
  }
  heal(b, amount) {
    const was = b.hp;
    b.hp = Math.min(b.hpMax, b.hp + amount);
    const got = Math.round(b.hp - was);
    if (got > 0)
      this.floaters.push({ x: b.x, y: b.y - this.spec.hitH, v: `+${got}`, kind: "heal", t: 0 });
  }
  say(text) {
    this.messages.push({ text, t: 0 });
    if (this.messages.length > 3)
      this.messages.shift();
  }
  sound(name) {
    this.events.push({ t: EV.sfx, name });
  }
  pit(b, at, dur, rise, shut, len) {
    (b.pits ??= []).push({ x: b.x, y: b.y, face: b.face, t: b.moveT - at, dur, rise, s0: shut - at, s1: shut - at + len });
  }
  landed(b, small = false) {
    this.events.push({ t: EV.bossLand, x: b.x, y: b.y, small });
  }
  shake(a) {
    this.shakeAmt = Math.min(SHAKE_MAX, this.shakeAmt + a);
  }
  freeze(s) {
    if (!(s > 0))
      return;
    this.hitstop = FEEL.stopMax ? Math.max(this.hitstop, s) : s;
  }
  buff(name, dur, on, off) {
    const old = this.buffs.find((b) => b.name === name);
    if (old) {
      old.t = 0;
      old.dur = dur;
      return;
    }
    on?.(this, this.player);
    this.buffs.push({ name, t: 0, dur, off });
  }
  stepBuffs(dt) {
    let n = 0;
    for (const b of this.buffs) {
      b.t += dt;
      if (b.t >= b.dur)
        b.off?.(this, this.player);
      else
        this.buffs[n++] = b;
    }
    this.buffs.length = n;
  }
  endBuffs() {
    for (const b of this.buffs)
      b.off?.(this, this.player);
    this.buffs.length = 0;
  }
  aimAtPlayer() {
    return Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
  }
  riposteReady() {
    const b = this.boss, p = this.player;
    if (!(b.stagger > 0) || b.riposted || p.dead)
      return 0;
    const reach = (p.moveset || PLAYER.combo)[(p.moveset || PLAYER.combo).length - 1].range;
    const t = Math.atan2(p.y - b.y, p.x - b.x) - b.face;
    const body = 1 / Math.hypot(Math.cos(t) / b.hurt[0], Math.sin(t) / b.hurt[1]);
    return Math.hypot(p.x - b.x, p.y - b.y) <= body + reach - 1 ? this.souls.crit : 0;
  }
  useSlot(i) {
    const p = this.player;
    const id = p.slots[i];
    if (!id)
      return false;
    const item = ITEMS[id];
    if (!item)
      return false;
    if (p.cooldowns[i] > 0)
      return false;
    if (item.charges != null && p.charges[i] <= 0)
      return false;
    if (item.use(this, p) === false)
      return false;
    if (item.charges != null)
      p.charges[i] -= 1;
    p.cooldowns[i] = (item.cooldown || 0) * (p.cdScale || 1);
    if (item.kind === "potion")
      this.potionsUsed++;
    if (item.kind === "potion" && this.souls?.drinkLock) {
      p.state = STATE.LOCKED;
      p.t = 0;
      p.lockFor = this.souls.drinkLock;
      p.vx = p.vy = 0;
      this.events.push({ t: EV.drink, x: p.x, y: p.y, dur: p.lockFor });
      const D = this.souls.answers?.drink, b = this.boss;
      if (D && !b.move && !(b.recover > 0) && !(b.stagger > 0) && !(b.phaseHold > 0) && !b.hidden && this.state === "fight" && Math.hypot(p.x - b.x, p.y - b.y) < D[0])
        b.answer = D[1], b.gap = 0;
    }
    this.events.push({ t: EV.sfx, name: item.sound || "use" });
    return true;
  }
  step(intent, dt = TICK) {
    this.events.length = 0;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.shakeAmt *= 0.9;
      return this.events;
    }
    this.stateT += dt;
    for (const m of this.messages)
      m.t += dt;
    if (this.state === "bell" || this.state === "entrance") {
      this.stepEntrance(intent, dt);
      return this.events;
    }
    if (this.state === "intro") {
      if (this.stateT >= (this.spec.intro ?? FIGHT.intro))
        this.setState("fight");
      this.stepBossIdle(dt);
      return this.events;
    }
    if (this.state === "won" || this.state === "lost") {
      this.stepDying(dt);
      if (this.state === "won")
        this.stepChest(intent, dt);
      return this.events;
    }
    if (this.state === "chest" || this.state === "looted") {
      this.stepChest(intent, dt);
      return this.events;
    }
    this.time += dt;
    if (!this.enraged && !this.debug.noEnrage && this.time >= FIGHT.enrage) {
      this.enraged = true;
      this.say("Enraged. Finish it.");
      this.sound("enrage");
    }
    this.stepBuffs(dt);
    this.blessing?.tick?.(this, this.player, dt);
    if (this.player.regen)
      this.player.hp = Math.min(this.player.hpMax, this.player.hp + this.player.regen * dt);
    if (this.souls?.crit)
      this.player.riposteReady = this.riposteReady();
    stepPlayer(this.player, intent, dt, this, this.events);
    if (this.souls?.crit && this.player.riposte > 0 && this.player.state === STATE.ATTACK && this.player.t <= dt + 0.000000001 && this.boss.stagger > 0) {
      const m = this.player.riposteMove;
      this.boss.stagger = Math.max(this.boss.stagger, m.wind + m.active + 0.1);
    }
    this.stepBoss(dt);
    this.mechEach("afterBoss");
    this.stepGrab(dt);
    this.bodyBlock();
    this.blockBell();
    this.stepAffix(dt);
    this.stepAdds(dt);
    this.stepShots(dt);
    this.stepHazards(dt);
    this.resolveSwing();
    this.mechEach("afterSwing");
    this.stepFloaters(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
    if (this.boss.hp <= 0 && (this.bossFell || !this.player.dead))
      this.setState("won");
    else if (this.player.dead)
      this.setState("lost");
    return this.events;
  }
  stepEntrance(intent, dt) {
    const E = FIGHT.entrance;
    const p = this.player;
    const b = this.boss;
    const bell = this.bell;
    const still = this.still;
    still.aim = p.face;
    const free = this.state === "bell" || this.mechAsk("heroFree");
    stepPlayer(p, free ? { ...intent, slot0: false, slot1: false } : still, dt, this, this.events);
    this.blockBell();
    if (this.state === "bell") {
      const arc = swingArc(p);
      if (arc) {
        if (bladeHits(arc, bell.x, bell.y, bell.r)) {
          bell.struckAt = this.stateT;
          this.events.push({ t: EV.bell, x: bell.x, y: bell.y, a: arc.a });
          this.sound(this.arena.bell?.small ? "bellSmall" : "bell");
          this.shake(5);
          this.hitstop = 0.07;
          this.setState("entrance");
        }
      }
    } else if (this.mechAsk("stepEntrance", dt)) {} else {
      const t = this.stateT;
      this.mechEach("entranceTick", t);
      if (b.hidden && t >= (this.arena.bell?.ring ?? E.ring)) {
        const right = [Math.SQRT1_2, -Math.SQRT1_2];
        const side = -p.x * right[0] - p.y * right[1] >= 0 ? 1 : -1;
        const cl = Math.hypot(p.x, p.y) || 1;
        const own = !!this.arena.bell;
        let ax = own ? -p.x / cl : right[0] * side + -p.x / cl * 0.35;
        let ay = own ? -p.y / cl : right[1] * side + -p.y / cl * 0.35;
        const n = Math.hypot(ax, ay);
        let lx = this.spec.entranceAt?.[0] ?? p.x + ax / n * E.landAhead;
        let ly = this.spec.entranceAt?.[1] ?? p.y + ay / n * E.landAhead;
        const land = { x: lx, y: ly };
        this.arena.keep(land, b.r + 8);
        lx = land.x, ly = land.y;
        const ux = (lx - p.x) / (Math.hypot(lx - p.x, ly - p.y) || 1), uy = (ly - p.y) / (Math.hypot(lx - p.x, ly - p.y) || 1);
        const below = this.spec.entranceFrom === "below";
        let d = below ? 600 : 0;
        for (;d < 600; d += 4) {
          const o = { x: lx + ux * d, y: ly + uy * d };
          this.arena.keep(o, 0);
          if (Math.hypot(o.x - (lx + ux * d), o.y - (ly + uy * d)) > 1)
            break;
        }
        if (below) {
          const R = this.spec.entranceRise ?? E.leap;
          b.x = lx, b.y = ly, b.entryFrom = [lx, ly], b.jumpTo = null;
          b.face = Math.atan2(p.y - ly, p.x - lx);
          b.move = { id: "entrance", airborne: [0, R], rise: R, beats: [{ at: R }] };
        } else {
          b.x = lx + ux * (d + E.fromOut);
          b.y = ly + uy * (d + E.fromOut);
          b.entryFrom = [b.x, b.y];
          b.jumpTo = [lx, ly];
          b.face = Math.atan2(ly - b.y, lx - b.x);
          b.move = { id: "entrance", airborne: [0, E.leap], apex: E.apex, beats: [{ at: E.leap }] };
        }
        b.moveT = 0;
        b.hidden = false;
        b.airborne = true;
        this.clip(b, this.spec.entranceClips?.leap ?? "leap");
        this.sound(this.spec.entranceSounds?.leap ?? "hop");
        this.events.push({ t: EV.entranceLeap, x: b.x, y: b.y });
      }
      if (b.move?.id === "entrance") {
        b.moveT += dt;
        if (b.jumpTo) {
          const u = Math.min(1, Math.max(0, (b.moveT / E.leap - 0.45) / 0.45));
          const fly = Math.atan2(b.jumpTo[1] - b.entryFrom[1], b.jumpTo[0] - b.entryFrom[0]);
          const look = Math.atan2(p.y - b.jumpTo[1], p.x - b.jumpTo[0]);
          let dA = look - fly;
          dA = Math.atan2(Math.sin(dA), Math.cos(dA));
          b.face = fly + dA * u * u * (3 - 2 * u);
        }
        if (reached(b.moveT, b.move.rise ?? E.leap)) {
          if (b.jumpTo)
            b.x = b.jumpTo[0], b.y = b.jumpTo[1];
          b.jumpTo = null;
          b.move = null;
          b.moveT = 0;
          b.airborne = false;
          b.landedAt = t;
          b.face = Math.atan2(p.y - b.y, p.x - b.x);
          this.clip(b, this.spec.entranceClips?.land ?? "land");
          this.shake(22);
          this.hitstop = 0.09;
          this.sound(this.spec.entranceSounds?.land ?? "arrive");
          this.events.push({ t: EV.entrance, x: b.x, y: b.y });
          staggerPlayer(p, b.x, b.y, E.stagger, E.staggerTime);
          p.face = Math.atan2(b.y - p.y, b.x - p.x);
        }
      }
      if (b.landedAt != null && t >= b.landedAt + (this.quick ? 1.25 : this.spec.entranceSettle ?? E.settle)) {
        this.clip(b, "idle");
        this.setState(this.quick ? "fight" : "intro");
      } else if (b.landedAt != null && !b.roared && t >= b.landedAt + E.roarAt) {
        b.roared = true;
        this.clip(b, this.spec.entranceClips?.roar ?? "roar");
        this.sound(this.spec.entranceSounds?.roar ?? "roar");
        this.shake(6);
      }
    }
    b.clipT += dt;
    this.stepFloaters(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
  }
  bellOut(o, r) {
    const S = this.bell.solids;
    for (let i = 0;i < S.length; i++) {
      const x = S[i][0], y = S[i][1], sr = S[i][2];
      const touch = sr + r;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < touch) {
        const a = d > 0.000001 ? Math.atan2(o.y - y, o.x - x) : Math.PI / 4;
        o.x = x + Math.cos(a) * touch;
        o.y = y + Math.sin(a) * touch;
      }
    }
  }
  blockBell() {
    this.mechEach("blockSolids");
    if (!this.bell)
      return;
    this.bellOut(this.player, PLAYER.radius);
    if (!this.boss.hidden && !this.boss.airborne)
      this.bellOut(this.boss, this.mechAsk("bossSolidR", this.boss) ?? this.boss.body);
    const B = this.boss;
    if (this.souls?.legsSolid && this.spec.blockers && !B.hidden && !B.airborne && !B.move?.rise && !this.grab)
      for (let pass = 0;pass < 2; pass++)
        for (let j = 0;j < this.spec.blockers.length; j++) {
          const bl = this.spec.blockers[j], fwd = bl[0], left = bl[1], r = bl[2];
          const c = Math.cos(B.face), sn = Math.sin(B.face), px = B.x + c * fwd + sn * left, py = B.y + sn * fwd - c * left;
          for (let i = 0;i < this.bell.solids.length; i++) {
            const so = this.bell.solids[i], x = so[0], y = so[1], sr = so[2];
            const touch = sr + r, d = Math.hypot(px - x, py - y);
            if (d >= touch)
              continue;
            const a = d > 0.000001 ? Math.atan2(py - y, px - x) : Math.atan2(B.y - y, B.x - x);
            B.x += Math.cos(a) * (touch - d);
            B.y += Math.sin(a) * (touch - d);
          }
        }
  }
  setState(s) {
    if (this.state === s)
      return;
    this.state = s;
    this.stateT = 0;
    if (s === "won" || s === "lost")
      this.endBuffs();
    if (s === "won") {
      if (this.souls) {
        for (const h of this.hazards)
          if (phaseOf(h) === "tele")
            h.done = true;
      }
      this.boss.dying = 0;
      this.clip(this.boss, "dead");
      this.sound("bell");
      this.sound("bossDeath");
      this.shake(FEEL.kill.shake);
      this.freeze(FEEL.kill.stop);
      if (FEEL.kill.slow > 0)
        this.slow = FEEL.kill.slow;
      this.events.push({ t: EV.bossDeath, x: this.boss.x, y: this.boss.y });
    }
    if (s === "lost") {
      this.sound("death");
      this.slow = 0.22;
      const climbing = this.souls && this.boss.move?.climb && this.boss.moveT >= this.boss.move.climb.dive[0];
      const hopEnd = this.souls && !climbing ? hopLanding(this.boss) : null;
      if (hopEnd != null)
        this.boss.hopEnd = hopEnd;
      if (this.souls && !this.boss.hidden && !climbing && hopEnd == null)
        this.clip(this.boss, "roar");
      if (this.souls && !climbing && hopEnd == null)
        this.boss.move = null, this.boss.casting = null, this.boss.immune = !!this.mechAsk("keepsImmune", this.boss);
      if (this.souls) {
        for (const h of this.hazards)
          if (phaseOf(h) === "tele")
            h.done = true;
      }
      if (this.souls)
        this.boss.stagger = 0, this.boss.phaseHold = 0;
    }
  }
  stepChest(intent, dt) {
    const C = FIGHT.chest;
    const p = this.player;
    if (this.state === "won") {
      if (!this.chest && this.stateT >= C.wait) {
        const b = this.boss;
        const keep = () => {
          const o = { x, y };
          this.arena.keep(o, C.r + 24);
          x = o.x, y = o.y;
        };
        let x = b.x;
        let y = b.y;
        keep();
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < C.clear) {
          const a = d > 0.001 ? Math.atan2(y - p.y, x - p.x) : p.face;
          x = p.x + Math.cos(a) * C.clear;
          y = p.y + Math.sin(a) * C.clear;
          keep();
        }
        this.chest = { x, y, r: C.r, t: 0, landed: false, openAt: null };
        for (const a of this.adds)
          if (a.alive) {
            a.alive = false;
            a.dying = 0;
            this.events.push({ t: EV.pop, x: a.x, y: a.y, kind: a.type });
          }
        this.hazards = [];
        this.shots = [];
        this.events.push({ t: EV.chest, x, y });
      }
      if (this.chest) {
        this.chest.t += dt;
        if (this.chest.t >= C.drop) {
          this.chest.landed = true;
          this.events.push({ t: EV.chestLand, x: this.chest.x, y: this.chest.y });
          this.sound("chestLand");
          this.shake(8);
          this.setState("chest");
        }
      }
      return;
    }
    const c = this.chest;
    c.t += dt;
    const still = this.still;
    still.aim = p.face;
    stepPlayer(p, this.state === "chest" ? { ...intent, slot0: false, slot1: false } : still, dt, this, this.events);
    const touch = c.r + PLAYER.radius;
    const dd = Math.hypot(p.x - c.x, p.y - c.y);
    if (dd < touch) {
      const a = dd > 0.000001 ? Math.atan2(p.y - c.y, p.x - c.x) : Math.PI / 4;
      p.x = c.x + Math.cos(a) * touch;
      p.y = c.y + Math.sin(a) * touch;
    }
    if (this.state === "chest") {
      const arc = swingArc(p);
      if (arc && bladeHits(arc, c.x, c.y, c.r)) {
        c.openAt = c.t;
        this.events.push({ t: EV.chestOpen, x: c.x, y: c.y, a: arc.a });
        this.sound("chestOpen");
        this.sound("chestMusic");
        this.shake(10);
        this.hitstop = 0.08;
        this.setState("looted");
      }
    }
    this.stepFloaters(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - 42 * dt);
  }
  stepDying(dt) {
    this.boss.clipT += dt;
    const b = this.boss, C = this.state === "lost" && b.move?.climb;
    if (this.state === "lost" && b.move && b.hopEnd != null) {
      b.moveT += dt;
      if (reached(b.moveT, b.hopEnd)) {
        if (b.jumpTo)
          b.x = b.jumpTo[0], b.y = b.jumpTo[1], this.arena.keep(b, b.r + 6, true);
        b.jumpTo = null, b.airborne = false, b.move = null, b.casting = null, b.hopEnd = null;
        b.immune = !!this.mechAsk("keepsImmune", b);
        this.clip(b, "roar");
      }
    } else if (C) {
      const under = C.dive[0] + C.dive[1], up = C.rise[0] + C.rise[1];
      if (b.moveT < under)
        b.moveT = Math.min(under, b.moveT + dt);
      else if (b.moveT >= C.rise[0]) {
        b.moveT += dt;
        if (b.moveT >= up)
          b.move = null, b.airborne = false, this.clip(b, "roar");
      }
    }
    this.stepFloaters(dt);
    for (const h of this.hazards)
      stepHazard(h, dt);
    compact(this.hazards, notDone);
    this.shakeAmt = Math.max(0, this.shakeAmt - 30 * dt);
    if (this.state === "lost" || this.state === "won")
      this.slow = Math.min(1, this.slow + dt * 0.5);
  }
  stepBossIdle(dt) {
    this.boss.clipT += dt;
  }
  stepBoss(dtRaw) {
    const dt = dtRaw * this.slowField;
    const b = this.boss;
    const spec = this.spec;
    b.clipT += dt;
    if (b.flash > 0)
      b.flash -= dt;
    if (b.pits)
      for (let i = 0;i < b.pits.length; i++)
        b.pits[i].t += dt;
    const frac = b.hp / b.hpMax;
    let ph = 0;
    for (let i = 0;i < spec.phases.length; i++)
      if (frac <= spec.phases[i].at)
        ph = i;
    if (ph > b.phase && !(this.souls && b.stagger > 0)) {
      b.phase = ph;
      const line = spec.phases[ph].line;
      if (line)
        this.say(line);
      this.sound("phase");
      this.shake(FEEL.phase.shake);
      this.freeze(FEEL.phase.stop);
      this.events.push({ t: EV.phase, x: b.x, y: b.y, phase: ph });
      for (const h of this.hazards)
        if (phaseOf(h) === "tele")
          h.done = true;
      b.move = null;
      b.casting = null;
      b.immune = !!this.mechAsk("keepsImmune", b);
      b.airborne = false;
      b.jumpTo = null;
      this.clip(b, "idle");
      b.gap = 0.8;
      b.stagger = 0;
      b.poise = b.poiseMax;
      if (this.souls?.answers)
        b.answer = null, b.greed = 0, b.backT = 0;
      if (this.souls?.phasePause) {
        b.phaseHold = this.souls.phasePause;
        b.recover = 0;
        b.riposted = false;
        b.immune = true;
        this.clip(b, "phase");
        this.sound("phaseRoar");
        b.gap = this.souls.gap[0];
      }
    }
    if (this.debug.freezeBoss)
      return;
    if (b.phaseHold > 0) {
      b.phaseHold -= dt;
      b.vx *= 0.8;
      b.vy *= 0.8;
      if (b.phaseHold <= 0) {
        b.immune = !!this.mechAsk("keepsImmune", b);
        this.clip(b, "idle");
      }
      return;
    }
    if (this.souls?.poiseRegen) {
      b.poiseT = (b.poiseT || 0) + dt;
      if (b.poiseT > b.poiseMax / this.souls.poiseRegen)
        b.poise = Math.min(b.poiseMax, b.poise + this.souls.poiseRegen * dt);
    }
    if (b.stagger > 0) {
      b.stagger -= dt;
      b.immune = false;
      b.airborne = false;
      if (b.knockT > 0) {
        b.knockT -= dt;
        b.x += b.knockV[0] * dt;
        b.y += b.knockV[1] * dt;
        this.arena.keep(b, b.r + 6, true);
      }
      if (b.stagger <= 0) {
        this.clip(b, "idle");
        b.poise = b.poiseMax;
        b.gap = 0.5;
        if (this.souls)
          b.riposted = false;
      }
      return;
    }
    if (this.souls?.answers)
      this.readFight(b, dt);
    if (b.move) {
      const m = b.move;
      const from = b.moveT > 0 ? b.moveT : -1;
      b.moveT += dt;
      for (const beat of m.beats)
        if (!reached(from, beat.at) && reached(b.moveT, beat.at))
          beat.do(this, b);
      if (m.track != null && !reached(b.moveT, m.track)) {
        const want = this.aimAtPlayer();
        const rate = Math.min(m.trackRate ?? 3.2, spec.turnRate ?? Infinity) * dt;
        b.face += clamp(angleDiff(b.face, want), -rate, rate);
        for (const h of this.hazards) {
          if (!h.follow || phaseOf(h) !== "tele")
            continue;
          if (reached(h.t, h.tele - 0.5)) {
            h.follow = false;
            continue;
          }
          h.a = b.face;
          h.x = b.x;
          h.y = b.y;
        }
      }
      if (m.motion) {
        for (const seg of m.motion) {
          const t0 = Math.max(from, seg.at);
          const t1 = Math.min(b.moveT, seg.at + seg.dur);
          if (t1 <= t0)
            continue;
          const ease = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), seg.pow ?? 2.4);
          const k = ease((t1 - seg.at) / seg.dur) - ease((t0 - seg.at) / seg.dur);
          const a = b.face + (seg.turn || 0);
          b.x += Math.cos(a) * seg.dist * k;
          b.y += Math.sin(a) * seg.dist * k;
        }
      }
      b.airborne = !!(m.airborne && within2(b.moveT, m.airborne[0], m.airborne[1])) || !!m.hops?.some(([h0, h1]) => within2(b.moveT, h0, h1)) || !!(m.under && within2(b.moveT, m.under[0], m.under[1]));
      if (m.turn && b.turnTo != null && reached(b.moveT, m.turn[0])) {
        const k = clamp((b.moveT - m.turn[0]) / (m.turn[1] - m.turn[0]), 0, 1);
        b.face = b.turnFrom + angleDiff(b.turnFrom, b.turnTo) * k * k * (3 - 2 * k);
        if (k >= 1)
          b.turnTo = null;
      }
      b.immune = !!(m.immune && within2(b.moveT, m.immune[0], m.immune[1])) || !!this.mechAsk("keepsImmune", b);
      b.casting = m.cast && within2(b.moveT, m.cast.from, m.cast.to) ? { name: m.cast.name, k: (b.moveT - m.cast.from) / (m.cast.to - m.cast.from) } : null;
      if (reached(b.moveT, m.dur)) {
        b.move = null;
        b.casting = null;
        b.immune = !!this.mechAsk("keepsImmune", b);
        b.airborne = false;
        const gs = spec.phases[b.phase].gapScale || 1;
        if (this.souls?.recover) {
          b.recover = (m.recover || 0) * gs;
          this.clip(b, b.recover > 0 ? "recover" : "idle");
          const [lo, hi] = this.souls.gap;
          b.gap = (lo + this.bossRand() * (hi - lo)) * gs * (this.enraged ? 0.55 : 1) * (this.frenzied ? 0.6 : 1);
          const C = this.souls.answers?.chase;
          if (C && C.after.includes(b.lastMove) && Math.hypot(this.player.x - b.x, this.player.y - b.y) > C.dist && this.bossRand() < C.p) {
            const names = spec.phases[b.phase].moves;
            b.answer = names.includes(C.move + "Lash") ? C.move + "Lash" : C.move;
            b.recover = 0;
            b.gap = 0;
            this.clip(b, "idle");
          }
        } else {
          this.clip(b, "idle");
          const [lo, hi] = spec.gap;
          b.gap = (lo + this.bossRand() * (hi - lo)) * gs * (m.recover ? 1 : 0.6) * (this.enraged ? 0.55 : 1) * (this.frenzied ? 0.6 : 1);
        }
      }
    } else if (b.recover > 0) {
      b.recover -= dt;
      if (b.recover <= 0)
        this.clip(b, "idle");
    } else {
      b.gap -= dt;
      if (b.gap <= 0)
        this.startMove();
      const p = this.player;
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const want = spec.drift ? 120 : 62;
      const sgn = d > want + 18 ? 1 : d < want - 18 ? -1 : 0;
      let sp = spec.moveSpeed * (this.enraged ? 1.3 : 1) * (this.frenzied ? 1.35 : 1);
      if (b.lame && sgn) {
        const L = this.souls.legs;
        b.limpT = (b.limpT || 0) + dt;
        if (b.limpT % L.period / L.period < L.halt)
          sp *= L.slow;
      }
      b.vx = lerp(b.vx, Math.cos(a) * sp * sgn, 0.12);
      b.vy = lerp(b.vy, Math.sin(a) * sp * sgn, 0.12);
      b.face = spec.turnRate ? b.face + clamp(angleDiff(b.face, a), -spec.turnRate * dt, spec.turnRate * dt) : a;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    this.arena.keep(b, b.r + 6, !!this.souls);
    b.vx *= 0.9;
    b.vy *= 0.9;
  }
  bodyBlock() {
    const b = this.boss;
    const p = this.player;
    if (b.pits?.length) {
      for (let i = b.pits.length - 1;i >= 0; i--) {
        const P = b.pits[i], T = P.t;
        if (T >= P.s1) {
          b.pits.splice(i, 1);
          continue;
        }
        if (p.dead || inAir(p))
          continue;
        const H = holeFor(P.face);
        let open;
        if (P.rise)
          open = gapAt(T / P.dur, H, PIT_G).open;
        else
          open = H.k * Math.min(1, Math.max(0, T / 0.2)), PIT_G.c[0] = H.c[0], PIT_G.c[1] = H.c[1];
        if (T > P.s0) {
          const k = (T - P.s0) / (P.s1 - P.s0);
          open *= 1 - k * k * (3 - 2 * k);
        }
        if (open < 0.02)
          continue;
        const m = holeWorld(P.x, P.y, PIT_G.c, PIT_M), dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        const u = T / P.dur, foot = P.rise && u >= CLIMB.rip && u < 1 ? CLIMB.burrowFoot : 0;
        const want = Math.max(rimDist(dx, dy, open), foot) + PLAYER.radius;
        if (d >= want)
          continue;
        const a = d > 0.000001 ? Math.atan2(dy, dx) : P.face + Math.PI, push = Math.min(want - d, PIT_PUSH + Math.hypot(p.vx, p.vy) / 60);
        p.x += Math.cos(a) * push;
        p.y += Math.sin(a) * push;
        this.arena.keep(p, PLAYER.radius + 2);
      }
    }
    const pd = Math.hypot(p.x - b.x, p.y - b.y);
    const touch = b.body + PLAYER.radius;
    if (pd < touch && !b.airborne) {
      const a = Math.atan2(p.y - b.y, p.x - b.x) || 0;
      p.x = b.x + Math.cos(a) * touch;
      p.y = b.y + Math.sin(a) * touch;
      if (this.enraged && this.spec.contact)
        this.damagePlayer(this.spec.contact * 2, b.x, b.y);
    }
    if (this.spec.blockers && !b.airborne && !b.hidden && !this.grab) {
      for (const [fwd, left, r] of this.spec.blockers) {
        const [x, y] = this.bossPoint(fwd, left);
        const t = r + PLAYER.radius;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < t) {
          const a = d > 0.000001 ? Math.atan2(p.y - y, p.x - x) : b.face;
          p.x = x + Math.cos(a) * t;
          p.y = y + Math.sin(a) * t;
        }
      }
    }
  }
  bossPoint(fwd, left) {
    const b = this.boss, c = Math.cos(b.face), s = Math.sin(b.face);
    return [b.x + c * fwd + s * left, b.y + s * fwd - c * left];
  }
  turnBossToward(a, s) {
    const b = this.boss, r = this.spec.turnRate;
    b.face = r ? b.face + clamp(angleDiff(b.face, a), -r * s, r * s) : a;
  }
  startGrab(h) {
    const p = this.player;
    if (p.dead || this.grab)
      return;
    this.grab = { t: 0, hold: h.grab.hold, dmg: h.grab.dmg, at: h.grab.at, toss: h.grab.toss };
    p.state = STATE.LOCKED;
    p.t = 0;
    p.vx = p.vy = 0;
    p.buffer = null;
    this.say("The pincer has you.");
  }
  stepGrab(dt) {
    const g = this.grab;
    if (!g)
      return;
    const b = this.boss, p = this.player;
    if (p.dead || b.hidden) {
      this.grab = null;
      if (!p.dead && p.state === STATE.LOCKED)
        p.state = STATE.IDLE, p.t = 0;
      return;
    }
    g.t += dt;
    [p.x, p.y] = this.bossPoint(g.at[0], g.at[1]);
    this.arena.keep(p, PLAYER.radius);
    p.vx = p.vy = 0;
    if (reached(g.t, g.hold)) {
      this.grab = null;
      p.state = STATE.IDLE;
      p.t = 0;
      p.iFrames = 0;
      this.damagePlayer(g.dmg, b.x, b.y);
      if (g.toss && p.state === STATE.HURT) {
        const [fx, fy] = this.bossPoint(g.toss.from[0], g.toss.from[1]);
        const a = Math.atan2(fy - b.y, fx - b.x), d = Math.hypot(fx - b.x, fy - b.y) + g.toss.out, T = g.toss.time;
        [p.vx, p.vy] = [(b.x + Math.cos(a) * d - p.x) / T, (b.y + Math.sin(a) * d - p.y) / T];
        [p.hurtFor, p.tossed, p.iFrames] = [T, T, Math.max(p.iFrames, T)];
      }
      this.shake(8);
      this.sound("slam");
    }
  }
  stepAffix(dt) {
    const a = this.affix;
    if (!a)
      return;
    this.affixT += dt;
    if (a.volcanic && this.affixT >= a.volcanic) {
      this.affixT = 0;
      const p = this.player;
      this.hazard({ kind: KIND.CIRCLE, x: p.x, y: p.y, r: 26, tele: 1.1, active: 0.14, fade: 0.3, dmg: 16, tag: "volcanic" });
    }
    if (a.swarm && this.affixT >= a.swarm) {
      this.affixT = 0;
      const ang = this.rand() * TAU;
      const kind = placeOf(this.spec.arena).swarm;
      if (kind)
        this.add(kind, ...this.arena.edge(ang, 8));
    }
    if (a.frenzy && !this.frenzied && this.boss.hp / this.boss.hpMax < 1 / 3) {
      this.frenzied = true;
      this.say(`${this.spec.name} is frenzied.`);
      this.sound("enrage");
      this.shake(8);
    }
  }
  startMove() {
    const b = this.boss;
    const spec = this.spec;
    const names = this.phaseMoves[b.phase] ||= spec.phases[b.phase].moves.filter((n) => spec.moves[n]);
    const allowed = [];
    const pool = [];
    for (const n of names) {
      const m = spec.moves[n];
      if (m.once && (b.used[n] || 0) >= m.once)
        continue;
      if (m.minHp && b.hp / b.hpMax < m.minHp)
        continue;
      if (this.mechAsk("allowMove", b, m) === false)
        continue;
      allowed.push(n);
      if (n !== b.lastMove)
        pool.push(n);
    }
    const list = pool.length ? pool : allowed;
    if (b.answer && spec.moves[b.answer]) {
      const n = b.answer;
      b.answer = null;
      return this.beginMove(n);
    }
    if (!list.length)
      return;
    const d = this.souls?.range ? Math.hypot(this.player.x - b.x, this.player.y - b.y) : 0;
    const weightOf = (n) => {
      const m = spec.moves[n], wt = m.weight || 1;
      return this.souls?.range && m.range ? wt * (d >= m.range[0] && d <= m.range[1] ? 3 : 0.25) : wt;
    };
    let total = 0;
    for (const n of list)
      total += weightOf(n);
    let r = this.bossRand() * total;
    let chosen = list[0];
    for (const n of list) {
      r -= weightOf(n);
      if (r <= 0) {
        chosen = n;
        break;
      }
    }
    this.beginMove(chosen);
  }
  beginMove(name) {
    const b = this.boss, m = this.spec.moves[name];
    b.move = m;
    b.moveT = 0;
    b.lastMove = name;
    b.used[name] = (b.used[name] || 0) + 1;
    this.clip(b, m.clip || "idle");
    this.events.push({ t: EV.move, name });
    b.greed = 0;
  }
  readFight(b, dt) {
    const A = this.souls.answers, p = this.player;
    if (!A.back || b.answer || b.recover > 0 || b.stagger > 0 || b.hidden || p.dead)
      return void (b.backT = 0);
    const [r, off, hold] = A.back, dx = p.x - b.x, dy = p.y - b.y;
    const behind = Math.hypot(dx, dy) < r && Math.abs(angleDiff(b.face, Math.atan2(dy, dx))) > off;
    b.backT = behind ? (b.backT || 0) + dt : 0;
    if (b.backT >= hold)
      b.answer = A.move, b.backT = 0;
  }
  greedHit(b) {
    const G = this.souls?.answers?.greed;
    if (!G || b.answer || b.recover > 0 || b.stagger > 0)
      return;
    b.greed = this.time - (b.greedT ?? -1e9) <= G[1] ? (b.greed || 0) + 1 : 1;
    b.greedT = this.time;
    if (b.greed >= G[0])
      b.answer = this.souls.answers.move, b.greed = 0;
  }
  stepAdds(dtRaw) {
    const dt = dtRaw * this.slowField;
    const p = this.player;
    for (const a of this.adds) {
      if (a.flash > 0)
        a.flash -= dt;
      if (!a.alive) {
        a.dying += dt;
        continue;
      }
      a.t += dt;
      if (a.spawn > 0) {
        a.spawn -= dt;
        continue;
      }
      if (a.def.dive) {
        this.stepDiver(a, dt);
        continue;
      }
      const ang = Math.atan2(p.y - a.y, p.x - a.x);
      const sp = a.def.speed * (this.enraged ? 1.25 : 1);
      a.vx = lerp(a.vx, Math.cos(ang) * sp, 0.06);
      a.vy = lerp(a.vy, Math.sin(ang) * sp, 0.06);
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      this.arena.keep(a, a.r);
      if (a.cool > 0)
        a.cool -= dt;
      if (a.def.dmg && a.cool <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < a.r + PLAYER.radius) {
        if (this.damagePlayer(a.def.dmg, a.x, a.y))
          a.cool = a.def.contact;
      }
    }
    compact(this.adds, addLeft);
  }
  stepDiver(a, dt) {
    const D = a.def.dive, p = this.player;
    a.mode ??= "drift";
    a.next ??= D.every[0] + this.rand() * (D.every[1] - D.every[0]);
    a.mt = (a.mt || 0) + dt;
    if (a.mode === "drift" || a.mode === "rest") {
      const ang = Math.atan2(p.y - a.y, p.x - a.x), d = Math.hypot(p.x - a.x, p.y - a.y);
      const near = d > D.keep + 12 ? 1 : d < D.keep - 12 ? -1 : 0;
      const sp = a.def.speed * (this.enraged ? 1.25 : 1) * (a.mode === "rest" ? 0.35 : 1);
      a.vx = lerp(a.vx, (Math.cos(ang) * near + Math.cos(ang + Math.PI / 2) * 0.6) * sp, 0.06);
      a.vy = lerp(a.vy, (Math.sin(ang) * near + Math.sin(ang + Math.PI / 2) * 0.6) * sp, 0.06);
      if (a.mode === "rest" && reached(a.mt, D.rest))
        a.mode = "drift", a.mt = 0;
      if (a.mode === "drift" && (a.next -= dt) <= 0) {
        a.mode = "hover";
        a.mt = 0;
        a.diveA = ang;
        a.lane = this.hazard({ kind: KIND.LANE, x: a.x, y: a.y, a: ang, len: D.len, w: D.w, tele: D.hover, active: 0.1, fade: 0.2, dmg: D.dmg, tag: "dive" });
        this.events.push({ t: EV.flyHover, x: a.x, y: a.y, a: ang, dur: D.hover });
      }
    } else if (a.mode === "hover") {
      a.vx *= 0.8;
      a.vy *= 0.8;
      if (a.lane?.done && !reached(a.mt, D.hover)) {
        a.mode = "drift";
        a.mt = 0;
        a.lane = null;
        a.next = D.every[0] + this.rand() * (D.every[1] - D.every[0]);
      } else if (reached(a.mt, D.hover)) {
        a.mode = "dive";
        a.mt = 0;
        a.from = [a.x, a.y];
        this.events.push({ t: EV.flyDive, x: a.x, y: a.y, a: a.diveA, len: D.len });
      }
    } else if (a.mode === "dive") {
      const k = Math.min(1, a.mt / 0.1);
      a.x = a.from[0] + Math.cos(a.diveA) * D.len * k;
      a.y = a.from[1] + Math.sin(a.diveA) * D.len * k;
      a.vx = a.vy = 0;
      if (k >= 1) {
        a.mode = "rest";
        a.mt = 0;
        a.lane = null;
        a.next = D.every[0] + this.rand() * (D.every[1] - D.every[0]);
      }
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    this.arena.keep(a, a.r);
  }
  stepShots(dtRaw) {
    const p = this.player;
    const b = this.boss;
    const slowed = dtRaw * this.slowField;
    for (const s of this.shots) {
      const dt = s.tag === "friendly" ? dtRaw : slowed;
      s.life -= dt;
      if (s.tag === "friendly") {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.spin += dt * 9;
        if (!b.airborne && !b.immune && Math.hypot(b.x - s.x, b.y - s.y) < s.r + b.r) {
          this.hitBossFlat(s.dmg, s.x, s.y);
          if (s.burn)
            this.hazard({ kind: KIND.CIRCLE, x: s.x, y: s.y, r: 26, tele: 0.1, active: 3.2, fade: 0.3, dmg: 0, every: 0.6, style: "safe", tag: "friendlyField", friendly: 7, art: "coal" });
          s.dead = true;
          continue;
        }
        let struck = false;
        for (const a of this.adds)
          if (a.alive && Math.hypot(a.x - s.x, a.y - s.y) < s.r + a.r) {
            this.hurtAdd(a, s.dmg);
            struck = true;
            break;
          }
        if (struck || this.arena.out(s.x, s.y) > this.shotSpan || s.life <= 0)
          s.dead = true;
        continue;
      }
      if (s.homing) {
        const want = Math.atan2(p.y - s.y, p.x - s.x);
        const cur = Math.atan2(s.vy, s.vx);
        const na = cur + clamp(angleDiff(cur, want), -s.homing * dt, s.homing * dt);
        s.vx = Math.cos(na) * s.speed;
        s.vy = Math.sin(na) * s.speed;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += dt * 6;
      if (this.arena.out(s.x, s.y) > this.shotSpan || s.life <= 0)
        s.dead = true;
      else if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + PLAYER.radius) {
        if (this.damagePlayer(s.dmg, s.x, s.y)) {
          s.dead = true;
          this.events.push({ t: EV.burst, x: s.x, y: s.y, art: s.art });
          this.sound("splat");
        } else if (p.iFrames > 0) {
          this.events.push({ t: EV.graze, x: s.x, y: s.y });
        }
      }
    }
    compact(this.shots, notDead);
  }
  stepHazards(dt) {
    const p = this.player;
    for (const h of this.hazards) {
      const was = h.t === 0 ? "tele" : phaseOf(h);
      stepHazard(h, dt);
      if (was === "tele" && phaseOf(h) === "active")
        this.events.push({ t: EV.fire, h });
      if (h.friendly) {
        const b = this.boss;
        const ready = !h.every || h.cool <= 0;
        if (ready && !b.airborne && !b.immune && phaseOf(h) === "active" && !h.hitBoss && hits(h, b.x, b.y, b.r)) {
          if (h.every)
            h.cool = h.every;
          else
            h.hitBoss = true;
          this.hitBossFlat(h.friendly, b.x, b.y - 10);
        }
        for (const a of this.adds)
          if (a.alive && this.addHit(h, a))
            this.hurtAdd(a, h.friendly);
        continue;
      }
      const over = jumpable(h) && inAir(p) && phaseOf(h) === "active" && hits(h, p.x, p.y, PLAYER.radius);
      if (over && !h.vaulted) {
        h.vaulted = true;
        this.events.push({ t: EV.vault, x: p.x, y: p.y });
        this.sound("vault");
      }
      const dmg = over ? 0 : damageFor(h, p.x, p.y, PLAYER.radius);
      if (dmg) {
        const [sx, sy] = sourceOf(h, p.x, p.y);
        const got = this.damagePlayer(dmg, sx, sy);
        if (got) {
          if (h.grab && got !== "stopped")
            this.startGrab(h);
          if (h.pull && got !== "stopped") {
            h.caught = true;
            const a = h.a + Math.PI;
            p.vx = Math.cos(a) * 520;
            p.vy = Math.sin(a) * 520;
          }
        }
      }
      if (h.hurtsAdds) {
        for (const a of this.adds)
          if (a.alive && this.addHit(h, a))
            this.hurtAdd(a, h.dmg);
      }
    }
    compact(this.hazards, notDone);
  }
  addHit(h, a) {
    if (phaseOf(h) !== "active" || !hits(h, a.x, a.y, a.r))
      return false;
    const seen = h.addHits ||= new Map;
    const at = seen.get(a);
    if (at != null && (!h.every || !reached(h.t - at, h.every)))
      return false;
    seen.set(a, h.t);
    return true;
  }
  stepFloaters(dt) {
    for (const f of this.floaters)
      f.t += dt;
    compact(this.floaters, floating);
  }
  damagePlayer(dmg, fromX, fromY) {
    if (this.debug.god)
      return false;
    if (this.affix?.hardHits)
      dmg *= this.affix.hardHits;
    if (this.souls?.dmg)
      dmg *= this.souls.dmg;
    let scaled = this.enraged ? dmg * (1 + clamp((this.time - FIGHT.enrage) / FIGHT.enrageRamp, 0, 1) * 5) : dmg;
    const p0 = this.player;
    if (p0.state === STATE.GUARD && p0.iFrames <= 0 && !p0.dead) {
      const g = this.guard(p0, scaled, fromX, fromY);
      if (g === "stopped")
        return "stopped";
      if (g != null)
        scaled = g;
    }
    if (p0.shield > 0 && p0.iFrames <= 0 && !p0.dead) {
      const soaked = Math.min(p0.shield, scaled);
      p0.shield -= soaked;
      p0.shieldHits = (p0.shieldHits || 0) + 1;
      scaled -= soaked;
      this.events.push({ t: EV.shielded, x: p0.x, y: p0.y });
      this.sound("clang");
      this.floaters.push({ x: p0.x, y: p0.y - 30, v: String(Math.round(soaked)), kind: "shield", t: 0 });
      if (scaled < 1) {
        p0.iFrames = Math.max(p0.iFrames, 0.3);
        return "stopped";
      }
    }
    const before = this.player.hp;
    const landed = hurtPlayer(this.player, scaled, fromX, fromY, this.events);
    if (!landed)
      return false;
    this.damageTaken += before - this.player.hp;
    this.hitsTaken++;
    this.blessing?.onHurt?.(this, this.player);
    this.clean = false;
    this.freeze(stopFor(FEEL.taken, scaled));
    this.shake(shakeFor(FEEL.taken, scaled));
    this.floaters.push({ x: this.player.x, y: this.player.y - 26, v: `-${Math.round(scaled)}`, kind: "taken", t: 0 });
    return true;
  }
  guard(p, dmg, fromX, fromY) {
    const g = p.arms.guard;
    const from = Math.atan2(fromY - p.y, fromX - p.x);
    if (Math.abs(angleDiff(p.face, from)) > 1.25)
      return null;
    if (g.parry > 0 && p.t <= g.parry + TICK_EPS) {
      armCounter(p);
      p.iFrames = Math.max(p.iFrames, 0.25);
      this.events.push({ t: EV.parry, x: p.x, y: p.y, a: from });
      this.sound("clang");
      if (FEEL.audio.parry)
        this.sound("parry");
      this.hitstop = Math.max(this.hitstop, FEEL.parry.stop);
      this.shake(FEEL.parry.shake);
      this.floaters.push({ x: p.x, y: p.y - 30, v: "Parry", kind: "shield", t: 0 });
      return "stopped";
    }
    const cost = dmg * Math.max(0.15, 1.6 - g.stability / 60);
    if (cost > p.stamina) {
      p.stamina = 0;
      p.exhausted = true;
      p.staminaWait = PLAYER.exhaustedDelay;
      this.events.push({ t: EV.guardBreak, x: p.x, y: p.y, a: from });
      this.sound("clang");
      this.freeze(FEEL.guardBreak.stop);
      this.shake(FEEL.guardBreak.shake);
      const rest = dmg * (1 - g.negate * 0.5);
      if (rest < 1) {
        staggerPlayer(p, fromX, fromY, 60, 0.6);
        return "stopped";
      }
      return rest;
    }
    p.stamina -= cost;
    p.staminaWait = PLAYER.staminaDelay;
    armCounter(p);
    this.events.push({ t: EV.blocked, x: p.x, y: p.y, a: from });
    this.sound("clang");
    this.shake(FEEL.block.shake);
    this.freeze(FEEL.block.stop);
    const through = dmg * (1 - g.negate);
    if (through < 1) {
      p.iFrames = Math.max(p.iFrames, 0.3);
      p.vx -= Math.cos(from) * 40;
      p.vy -= Math.sin(from) * 40;
      this.floaters.push({ x: p.x, y: p.y - 30, v: "0", kind: "shield", t: 0 });
      return "stopped";
    }
    return through;
  }
  resolveSwing() {
    const p = this.player;
    const arc = swingArc(p);
    if (!arc)
      return;
    const b = this.boss;
    const touch = (x, y, al, ac, f) => bladeHits(arc, x, y, al, ac, f) || (arc.alt ? bladeHits(arc.alt, x, y, al, ac, f) : null);
    const sh = this.mechAsk("shield", b);
    let at = !p.hitThisSwing.has("boss") && !b.airborne ? sh ? touch(b.x, b.y, sh.r, sh.r, 0) : touch(b.x, b.y, b.hurt[0], b.hurt[1], b.face) : null;
    let leg = -1;
    const L = this.souls?.legs;
    if (!at && L && !sh && !p.hitThisSwing.has("boss") && !p.hitThisSwing.has("leg") && !b.airborne && !b.hidden) {
      for (let j = 0;j < L.n && !at; j++) {
        const [x, y] = this.bossPoint(this.spec.blockers[j][0], this.spec.blockers[j][1]);
        if (at = touch(x, y, L.r, L.r, 0))
          leg = j;
      }
    }
    if (at) {
      p.hitThisSwing.add(leg >= 0 ? "leg" : "boss");
      if (sh)
        this.mechEach("shieldBlow", at.x, at.y, arc.a);
      else if (b.immune) {
        this.events.push({ t: EV.clang, x: at.x, y: at.y });
        this.sound("clang");
        this.freeze(FEEL.clang.stop);
        this.shake(FEEL.clang.shake);
      } else if (leg >= 0) {
        this.hitLeg(arc, at, leg);
      } else {
        this.hitBoss(arc, at);
      }
    }
    for (const a of this.adds) {
      if (!a.alive || p.hitThisSwing.has(a))
        continue;
      if (!touch(a.x, a.y, a.r, a.r, 0))
        continue;
      p.hitThisSwing.add(a);
      this.hurtAdd(a, arc.dmg);
      this.hitstop = Math.max(this.hitstop, FEEL.add.stop);
    }
  }
  hitBoss(arc, at = null) {
    const b = this.boss;
    const p = this.player;
    const crit = p.mods.crit > 0 && this.rand() < p.mods.crit;
    const ripo = arc.riposte > 0 && b.stagger > 0 && !b.riposted;
    const stag = this.souls ? 1 : b.stagger > 0 ? 1.5 : 1;
    const dmg = this.debug.oneShot ? b.hp : Math.round(arc.dmg * (crit ? 2 : 1) * (ripo ? arc.riposte : stag));
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp <= 0 && !this.player.dead)
      this.bossFell = true;
    b.flash = 0.1;
    this.damageDealt += dmg;
    const heavy = arc.heavy ?? arc.step === 2;
    const fp = heavy ? FEEL.heavy : FEEL.hit;
    this.freeze(stopFor(fp, dmg) + (crit ? FEEL.crit.stop : 0));
    this.shake(shakeFor(fp, dmg) + (crit ? FEEL.crit.shake : 0));
    this.sound(heavy || crit && FEEL.audio.crit ? "hitHeavy" : "hit");
    if (crit && FEEL.audio.crit)
      this.sound("crit");
    this.sound("bossHurt");
    const hx = at ? at.x : b.x + Math.cos(arc.a) * b.r * 0.6;
    const hy = (at ? at.y : b.y + Math.sin(arc.a) * b.r * 0.6) - this.spec.hitH * 0.4;
    this.events.push({ t: EV.hit, x: hx, y: hy, a: arc.a, crit, heavy, dmg });
    this.floaters.push({ x: hx, y: hy, v: String(dmg), kind: crit || ripo ? "crit" : b.stagger > 0 ? "crit" : "dmg", t: 0 });
    if (this.souls?.answers)
      this.greedHit(b);
    if (p.mods.lifesteal) {
      p.hp = Math.min(p.hpMax, p.hp + dmg * p.mods.lifesteal);
      this.floaters.push({ x: p.x, y: p.y - 30, v: `+${Math.round(dmg * p.mods.lifesteal)}`, kind: "heal", t: 0 });
    }
    if (ripo) {
      b.riposted = true;
      b.stagger = Math.min(b.stagger, 0.6);
      b.knockT = 0.25;
      const ka = Math.atan2(b.y - p.y, b.x - p.x);
      b.knockV = [Math.cos(ka) * 64, Math.sin(ka) * 64];
      this.freeze(this.souls.critStop);
      this.shake(this.souls.critShake);
      this.sound("riposte");
      this.events.push({ t: EV.riposte, x: hx, y: hy, a: arc.a, dmg });
    }
    b.poise -= arc.poise + dmg * 0.45;
    if (this.souls)
      b.poiseT = 0;
    this.breakPoise(arc, ripo);
  }
  breakPoise(arc, ripo) {
    const b = this.boss;
    if (b.poise <= 0) {
      b.poise = b.poiseMax;
      if ((b.casting || b.move || this.souls?.staggerAnytime && !b.stagger && !b.phaseHold) && !ripo && (b.hp > 0 || !this.souls)) {
        b.move = null;
        b.casting = null;
        if (this.souls)
          b.recover = 0;
        b.immune = false;
        b.stagger = 2.4;
        if (this.souls?.answers)
          b.answer = null, b.greed = 0, b.backT = 0;
        this.clip(b, "hurt");
        this.say(`${this.spec.name} reels.`);
        this.sound("stagger");
        this.shake(FEEL.stagger.shake);
        this.freeze(FEEL.stagger.stop);
        this.events.push({ t: EV.stagger, x: b.x, y: b.y, a: arc.a });
        for (const h of this.hazards)
          if (phaseOf(h) === "tele")
            h.done = true;
      }
    }
  }
  hitLeg(arc, at, j) {
    const b = this.boss, L = this.souls.legs;
    const dmg = this.debug.oneShot ? b.hp : Math.max(1, Math.round(arc.dmg * L.dmg));
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp <= 0 && !this.player.dead)
      this.bossFell = true;
    b.flash = 0.1;
    this.damageDealt += dmg;
    this.freeze(stopFor(FEEL.hit, dmg));
    this.shake(shakeFor(FEEL.hit, dmg));
    this.sound("hit");
    const [lx, ly] = this.bossPoint(this.spec.blockers[j][0], this.spec.blockers[j][1]);
    this.events.push({ t: EV.hit, x: lx, y: ly, a: arc.a, crit: false, dmg, leg: j });
    this.floaters.push({ x: lx, y: ly - 8, v: String(dmg), kind: "dmg", t: 0 });
    b.poise -= (arc.poise + dmg * 0.45) * L.poise;
    b.poiseT = 0;
    this.breakPoise(arc, false);
    if (this.player.mods.lifesteal) {
      const p = this.player;
      p.hp = Math.min(p.hpMax, p.hp + dmg * p.mods.lifesteal);
      this.floaters.push({ x: p.x, y: p.y - 30, v: `+${Math.round(dmg * p.mods.lifesteal)}`, kind: "heal", t: 0 });
    }
    b.legDmg = (b.legDmg || 0) + dmg;
    if (!b.lame && b.legDmg >= L.cripple && b.hp > 0) {
      b.lame = true;
      b.limpT = 0;
      this.say(L.line);
      this.sound("bossHurt");
      this.shake(FEEL.stagger.shake * 0.5);
      this.events.push({ t: EV.lame, x: b.x, y: b.y, leg: j });
    }
  }
  hitBossFlat(dmg, x, y) {
    const b = this.boss;
    if (this.mechAsk("shield", b) && !b.airborne)
      return this.mechEach("shieldBlow", x, y, Math.atan2(b.y - y, b.x - x));
    if (b.immune || b.airborne) {
      this.events.push({ t: EV.clang, x: b.x, y: b.y });
      return;
    }
    const d = Math.round(dmg * (b.stagger > 0 && !this.souls ? 1.5 : 1));
    b.hp = Math.max(0, b.hp - d);
    if (b.hp <= 0 && !this.player.dead)
      this.bossFell = true;
    b.flash = 0.1;
    this.damageDealt += d;
    this.shake(FEEL.flat.shake);
    this.freeze(FEEL.flat.stop);
    this.sound("hit");
    this.sound("bossHurt");
    this.events.push({ t: EV.hit, x, y, a: Math.atan2(b.y - y, b.x - x), crit: false, dmg: d });
    this.floaters.push({ x, y: y - 8, v: String(d), kind: "dmg", t: 0 });
  }
  hurtAdd(a, dmg) {
    a.hp -= dmg;
    a.flash = 0.1;
    this.floaters.push({ x: a.x, y: a.y - 12, v: String(Math.round(dmg)), kind: "dmg", t: 0 });
    this.events.push({ t: EV.hit, x: a.x, y: a.y, a: 0, crit: false });
    this.sound("hit");
    if (a.hp <= 0 && a.alive) {
      a.alive = false;
      a.dying = 0;
      if (a.lane && phaseOf(a.lane) === "tele")
        a.lane.done = true;
      this.events.push({ t: EV.pop, x: a.x, y: a.y, kind: a.type });
      if (a.def.boom)
        this.hazard({ kind: KIND.CIRCLE, x: a.x, y: a.y, r: a.def.boom[1], tele: 0.5, active: 0.14, fade: 0.25, dmg: a.def.boom[0], tag: "boom", hurtsAdds: true });
    }
  }
  result() {
    return {
      won: this.state === "won" || this.state === "chest" || this.state === "looted",
      time: this.time,
      hpLeft: Math.max(0, this.player.hp),
      hpMax: this.player.hpMax,
      bossHpLeft: Math.max(0, this.boss.hp),
      bossHpMax: this.boss.hpMax,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      hitsTaken: this.hitsTaken,
      potionsUsed: this.potionsUsed,
      clean: this.clean && this.potionsUsed === 0,
      enraged: this.enraged,
      boss: this.spec.id,
      tier: this.spec.tier
    };
  }
}

// site/js/gfx/camera.js
var MARGIN_X = 36;
var MARGIN_Y = 46;
var HERO_H = 24;
var HERO_SHARE = 1 / 6;
var MIN_SPAN = 150;
var PAD = 26;
var THREAT_REACH = 70;
function makeCamera() {
  return {
    x: 0,
    y: 0,
    focusX: 0,
    focusY: 0,
    zoom: 2,
    closeZoom: 2,
    wideZoom: 1,
    dpr: 1,
    vw: 0,
    vh: 0,
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
    t: 0,
    arena: arenaShape(null),
    box: [-ISO_W(ARENA.R) / 2, -ISO_H(ARENA.R) / 2, ISO_W(ARENA.R) / 2, ISO_H(ARENA.R) / 2],
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    settled: false,
    bossFrame: null,
    setInsets({ top = 0, right = 0, bottom = 0, left = 0 } = {}) {
      const i = this.insets;
      if (i.top !== top || i.right !== right || i.bottom !== bottom || i.left !== left) {
        this.insets = { top, right, bottom, left };
        this.recompute();
      }
    },
    setArena(shape) {
      this.arena = shape;
      if (shape.poly) {
        const s = shape.poly.map(([x, y]) => toScreen(x, y));
        this.box = [Math.min(...s.map((p) => p[0])), Math.min(...s.map((p) => p[1])), Math.max(...s.map((p) => p[0])), Math.max(...s.map((p) => p[1]))];
      } else
        this.box = [-ISO_W(ARENA.R) / 2, -ISO_H(ARENA.R) / 2, ISO_W(ARENA.R) / 2, ISO_H(ARENA.R) / 2];
      this.recompute();
    },
    safe() {
      const d = this.dpr;
      const i = this.insets;
      const w = Math.max(64, this.vw - (i.left + i.right) * d);
      const h = Math.max(64, this.vh - (i.top + i.bottom) * d);
      return [i.left * d, i.top * d, w, h];
    },
    recompute() {
      const [, , sw, sh] = this.safe();
      const [bx0, by0, bx1, by1] = this.box;
      this.wideZoom = Math.min(sw / (bx1 - bx0 + MARGIN_X * 2), sh / (by1 - by0 + MARGIN_Y * 2));
      const byHeight = this.vh * HERO_SHARE / HERO_H;
      const byWidth = sw / MIN_SPAN;
      this.closeZoom = Math.max(this.wideZoom, Math.min(byHeight, byWidth));
    },
    fit(cssW, cssH, dpr = 1) {
      this.dpr = dpr;
      const vw = Math.max(64, Math.round(cssW * dpr));
      const vh = Math.max(64, Math.round(cssH * dpr));
      if (vw !== this.vw || vh !== this.vh)
        this.settled = false;
      this.vw = vw;
      this.vh = vh;
      this.recompute();
      if (!this.settled)
        this.zoom = this.closeZoom;
      return { w: this.vw, h: this.vh, zoom: this.zoom };
    },
    follow(p, boss, dt, hazards = []) {
      this.t += dt;
      const pts = [];
      const add = (wx, wy, r = 0) => {
        const [sx, sy] = toScreen(wx, wy);
        pts.push([sx - r, sy - r * 0.5], [sx + r, sy + r * 0.5]);
      };
      add(p.x, p.y, 30);
      const [hx, hy] = toScreen(p.x, p.y);
      pts.push([hx, hy - HERO_H - 8]);
      if (boss) {
        const fr = boss.hpMax != null ? this.bossFrame : null;
        add(boss.x, boss.y, Math.max(boss.r * 1.4, fr?.r ?? 0));
        const [bx, by] = toScreen(boss.x, boss.y);
        pts.push([bx, by - Math.max(boss.hitH || 40, fr?.top ?? 0) - 10]);
      }
      for (const h of hazards) {
        if (h.friendly || phaseOf(h) === "fade" || !shown(h))
          continue;
        if (h.safe) {
          const byDist = [...h.safe].sort((m, n) => Math.hypot(m[0] - p.x, m[1] - p.y) - Math.hypot(n[0] - p.x, n[1] - p.y));
          byDist.forEach(([sx, sy, sr], i) => {
            if (i === 0 || Math.hypot(sx - p.x, sy - p.y) < 150)
              add(sx, sy, sr);
          });
          continue;
        }
        if (!hits(h, p.x, p.y, THREAT_REACH))
          continue;
        if (this.arena.out(h.x, h.y) < 10)
          add(h.x, h.y, 16);
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const [, , sw, sh] = this.safe();
      const need = Math.min(sw / (x1 - x0 + PAD * 2), sh / (y1 - y0 + PAD * 2));
      const want = clamp(need, this.wideZoom, this.closeZoom);
      const rate = want < this.zoom ? 0.00002 : 0.12;
      const snap = !this.settled || dt >= 1;
      const k = snap ? 1 : 1 - Math.pow(rate, dt);
      this.zoom = lerp(this.zoom, want, k);
      const tx = clamp(cx, this.box[0], this.box[2]);
      const ty = clamp(cy, this.box[1], this.box[3]);
      const kf = snap ? 1 : 1 - Math.pow(0.002, dt);
      this.focusX = lerp(this.focusX, tx, kf);
      this.focusY = lerp(this.focusY, ty, kf);
      this.settled = true;
      this.trauma = Math.max(0, this.trauma - dt * 1.9);
      const s = this.trauma * this.trauma;
      const f = this.t * 42;
      const kd = Math.exp(-dt * 16), pd = Math.exp(-dt * 9);
      this.kickX = (this.kickX || 0) * kd;
      this.kickY = (this.kickY || 0) * kd;
      if ((this.punchHold || 0) > 0)
        this.punchHold -= dt;
      else
        this.punch = (this.punch || 0) * pd;
      this.shakeX = Math.sin(f * 1.31) * s * 11 + this.kickX;
      this.shakeY = Math.cos(f * 1.07) * s * 11 + this.kickY;
      this.x = this.focusX;
      this.y = this.focusY;
    },
    kickAlong(dx, dy, amt) {
      const l = Math.hypot(dx, dy) || 1;
      const [sx, sy] = toScreen(dx / l, dy / l);
      const sl = Math.hypot(sx, sy) || 1;
      this.kickX = (this.kickX || 0) + sx / sl * amt;
      this.kickY = (this.kickY || 0) + sy / sl * amt;
    },
    punchIn(amt, hold = 0) {
      this.punch = Math.max(this.punch || 0, amt);
      this.punchHold = Math.max(this.punchHold || 0, hold);
    },
    origin() {
      const [sx, sy, sw, sh] = this.safe();
      return [sx + sw / 2 - this.x * this.zoom + this.shakeX * this.zoom * 0.5, sy + sh / 2 - this.y * this.zoom + this.shakeY * this.zoom * 0.5];
    },
    toBuffer(wx, wy) {
      if (this.proj)
        return this.proj(wx, wy);
      const [ox, oy] = this.origin();
      const [px, py] = toScreen(wx, wy);
      return [ox + px * this.zoom, oy + py * this.zoom];
    },
    worldToScreen(wx, wy) {
      const [bx, by] = this.toBuffer(wx, wy);
      return [bx / this.dpr, by / this.dpr];
    }
  };
}

// site/js/ui/playloop.js
function fixedSteps(loop, dt, tick) {
  loop.acc += dt;
  let guard = 8;
  while (loop.acc >= TICK && guard-- > 0) {
    loop.acc -= TICK;
    const r = tick();
    if (r)
      return r;
  }
}
var padOptions = (player, loadout, hand) => ({ loadout, hand, offAct: player.arms.offAct, offIcon: player.arms.offAct === "jump" ? "jump" : `arm_${player.arms.off || player.arms.main}` });
function followPadKind(state, input, padRoot, pad, hudRoot = null) {
  if (input.kind === state.padKind)
    return;
  state.padKind = input.kind;
  padRoot.classList.toggle("is-on", state.padKind === "touch");
  padRoot.classList.toggle("is-off", state.padKind !== "touch");
  if (state.padKind !== "touch")
    pad.release();
  hudRoot?.classList.toggle("is-touch", state.padKind === "touch");
}
var editToggle = ({ input, padRoot, pad, loop, setEditing }) => (on) => {
  setEditing(on);
  input.enabled = !on;
  input.flush?.();
  padRoot.classList.toggle("is-on", !on && input.kind === "touch");
  padRoot.classList.toggle("is-off", on || input.kind !== "touch");
  if (on)
    pad.release();
  loop.acc = 0;
};
function drawStill(renderer, world, cam, clock, lerp = null) {
  renderer.fitCamera(cam);
  if (lerp == null)
    return renderer.draw(world, cam, clock);
  const restore = renderer.lerpWorld(world, lerp);
  try {
    renderer.draw(world, cam, clock);
  } finally {
    restore();
  }
}

// site/js/gfx/feelview.js
function feelView(events, cam, world, shake = 1, buzz = true) {
  const C = FEEL.cam, H = FEEL.haptics;
  const vib = (ms) => buzz && ms > 0 && shake > 0 && typeof navigator !== "undefined" && navigator.vibrate?.(ms);
  cam.shakeScale = shake;
  for (const e of events) {
    if (e.t === EV.hit && e.dmg != null) {
      const f = e.heavy ? FEEL.heavy : FEEL.hit;
      if (C.kick)
        cam.kickAlong(Math.cos(e.a), Math.sin(e.a), C.kick * shakeFor(f, e.dmg) * shake);
      if (C.punch && (e.heavy || e.crit))
        cam.punchIn(C.punch * 0.5 * shake);
      vib(e.heavy || e.crit ? H.heavy : H.hit);
    }
    if (e.t === EV.hurt && e.a != null) {
      if (C.kick)
        cam.kickAlong(Math.cos(e.a), Math.sin(e.a), C.kick * shakeFor(FEEL.taken, e.dmg) * shake);
      vib(H.hurt);
    }
    if (e.t === EV.fire && FEEL.blast?.[e.h?.tag] && world.player && !e.h.friendly) {
      const d = Math.hypot(e.h.x - world.player.x, e.h.y - world.player.y);
      const k = Math.max(0, 1 - d / FEEL.blast.reach);
      if (k > 0)
        cam.trauma = Math.max(cam.trauma, FEEL.blast[e.h.tag] * k * shake);
    }
    if (e.t === EV.chestOpen && FEEL.chestZoom?.amt)
      cam.punchIn(FEEL.chestZoom.amt * Math.min(1, shake), FEEL.chestZoom.hold);
    if (e.t === EV.stagger) {
      if (C.punch)
        cam.punchIn(C.punch * shake);
      vib(H.stagger);
    }
    if (e.t === EV.riposte) {
      if (C.punch)
        cam.punchIn(C.punch * 1.4 * shake, 0.2);
      vib(H.kill);
    }
    if (e.t === EV.bossDeath) {
      const K = FEEL.killZoom;
      if (K.amt)
        cam.punchIn(K.amt * shake, K.hold);
      else if (C.punch)
        cam.punchIn(C.punch * 1.5 * shake);
      vib(H.kill);
      if (FEEL.flash.screenKill > 0 && typeof document !== "undefined") {
        const el = document.createElement("div");
        el.style.cssText = `position:fixed;inset:0;background:#fff;pointer-events:none;z-index:50;opacity:${FEEL.flash.screenKill * Math.min(1, shake)};transition:opacity .35s ease-out`;
        document.body.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.style.opacity = "0"));
        setTimeout(() => el.remove(), 500);
      }
    }
  }
  cam.trauma = Math.max(cam.trauma, Math.min(1, world.shakeAmt / SHAKE_MAX) * shake);
}

// site/js/ui/hud.js
function mountHud(root, { spec, modifier, blessing, tier, practice }) {
  root.innerHTML = html`<div class="hud">
    <div class="hud-top">
      <div class="hud-boss is-absent">
        <div class="hud-boss-line">
          <span class="hud-tier">${roman(tier) || "?"}</span>
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
  const bossBox = root.querySelector(".hud-boss");
  const bossChip = $("[data-bosschip]");
  const bossPct = $("[data-bosspct]");
  const castWrap = $("[data-cast]");
  const castBar = $("[data-castbar]");
  const castName = $("[data-castname]");
  const clock = $("[data-clock]");
  const says = $("[data-says]");
  const slotsEl = $("[data-slots]");
  let heartN = 0;
  let chip = 1, lastFrac = 1, chipFrom = -1, lastHp = null;
  let lastSaid = "";
  let wonAt = null;
  function buildHearts(n) {
    heartN = n;
    heartsEl.innerHTML = Array.from({ length: n }, (_, i) => `<span class="hud-heart" data-h="${i}">${iconCanvas("heart", 18)}${iconCanvas("heartEmpty", 18)}</span>`).join("");
  }
  function buildSlots(p, keys) {
    slotsEl.innerHTML = [0, 1].map((i) => {
      const id = p.slots[i];
      const item = id ? ITEMS[id] : null;
      if (!item)
        return `<div class="hud-slot is-empty"><span class="hud-key">${keys[i]}</span></div>`;
      return `<div class="hud-slot" data-slot="${i}" title="${item.name}">
          ${iconCanvas(item.icon, 22)}
          <span class="hud-key">${keys[i]}</span>
          <span class="hud-slot-cd" data-scd="${i}"></span>
          <span class="hud-slot-n" data-sn="${i}"></span>
        </div>`;
    }).join("");
  }
  return {
    buildHearts,
    buildSlots,
    update(w) {
      const p = w.player;
      if (bossBox)
        bossBox.classList.toggle("is-absent", !!w.boss?.hidden);
      const n = Math.max(1, Math.ceil(p.hpMax / HEART_VALUE));
      if (n !== heartN)
        buildHearts(n);
      if (lastHp != null && p.hp < lastHp - 0.000001 && FEEL.hud.heartHit > 0) {
        heartsEl.classList.remove("is-hit");
        heartsEl.offsetWidth;
        heartsEl.style.setProperty("--hit-dur", `${FEEL.hud.heartHit}s`);
        heartsEl.classList.add("is-hit");
      }
      lastHp = p.hp;
      const full = p.hp / HEART_VALUE;
      for (let i = 0;i < heartN; i++) {
        const el = heartsEl.children[i];
        const v = clamp(full - i, 0, 1);
        setVar(el, "--v", v);
        el.classList.toggle("is-low", i === 0 && v > 0 && v < 0.5);
      }
      setStyle(stamEl, "width", `${p.stamina / p.staminaMax * 100}%`);
      stamEl.parentElement.classList.toggle("is-spent", p.exhausted);
      const frac = w.boss.hp / w.boss.hpMax;
      setStyle(bossHp, "width", `${frac * 100}%`);
      const tNow = performance.now() / 1000;
      if (frac < lastFrac - 0.000001)
        chipFrom = tNow;
      lastFrac = frac;
      if (tNow - chipFrom >= FEEL.hud.chipHold)
        chip += (frac - chip) * 0.08;
      if (chip < frac)
        chip = frac;
      setStyle(bossChip, "width", `${chip * 100}%`);
      setText(bossPct, `${Math.ceil(frac * 100)}%`);
      bossHp.parentElement.classList.toggle("is-immune", w.boss.immune);
      const c = w.boss.casting;
      castWrap.hidden = !c;
      if (c) {
        setText(castName, c.name);
        setStyle(castBar, "width", `${c.k * 100}%`);
      }
      const left = Math.max(0, FIGHT.enrage - w.time);
      setText(clock, w.enraged ? "ENRAGED" : mmss(left));
      if (w.souls)
        clock.hidden = !w.enraged && left > 30;
      clock.classList.toggle("is-soon", left < 30);
      clock.classList.toggle("is-enraged", w.enraged);
      const m = w.messages[w.messages.length - 1];
      if (m && m.t < 2.6) {
        if (m.text !== lastSaid) {
          lastSaid = m.text;
          says.innerHTML = `<span class="hud-say">${m.text}</span>`;
        }
        const won = w.state === "won" || w.state === "chest" || w.state === "looted";
        if (won && wonAt == null)
          wonAt = performance.now();
        if (!won)
          wonAt = null;
        const gone = won && m.t > w.stateT + 0.000001 ? Math.max(0, 1 - (performance.now() - wonAt) / 300) : 1;
        setStyle(says, "opacity", String((m.t > 2 ? 1 - (m.t - 2) / 0.6 : 1) * gone));
      } else {
        setStyle(says, "opacity", "0");
        lastSaid = "";
      }
      for (let i = 0;i < 2; i++) {
        const id = p.slots[i];
        if (!id)
          continue;
        const item = ITEMS[id];
        const cd = slotsEl.querySelector(`[data-scd="${i}"]`);
        const sn = slotsEl.querySelector(`[data-sn="${i}"]`);
        if (!cd)
          continue;
        const k = clamp(p.cooldowns[i] / ((item.cooldown || 1) * (p.cdScale || 1)), 0, 1);
        setVar(cd, "--k", k);
        cd.classList.toggle("is-cd", k > 0.001);
        if (item.charges != null)
          setText(sn, p.charges[i]);
        cd.closest(".hud-slot").classList.toggle("is-spent", item.charges != null && p.charges[i] <= 0 || k > 0.001);
      }
    },
    onPause(fn) {
      const btn = $("[data-pause]");
      for (const ev of ["pointerdown", "mousedown", "touchstart"])
        btn.addEventListener(ev, (e) => e.stopPropagation());
      btn.addEventListener("click", fn);
    }
  };
}

// site/js/ui/admin.js
var TEST_BOSSES = MODELLED2.filter((id) => BOSSES2[id]).sort((a, b) => BOSSES2[a].tier - BOSSES2[b].tier);
var DEBUG = {
  god: false,
  oneShot: false,
  slow: 1,
  step: false,
  stepOnce: false,
  showHitboxes: false,
  showLights: false,
  freezeBoss: false,
  noEnrage: false,
  fps: false
};
var host = null;
var onJump = null;
var state = { boss: TEST_BOSSES[0], phase: 0, blessing: null, modifier: "none" };
function setAdminHandlers(handlers) {
  onJump = handlers.onJump;
}
var row = (label, body) => html`<div class="ad-row"><span class="ad-k">${label}</span><span class="ad-v">${raw(body)}</span></div>`;
var toggle = (key, label) => `<button class="ad-t ${DEBUG[key] ? "is-on" : ""}" data-toggle="${key}">${label}</button>`;
function isAdminOpen() {
  return !!host;
}
function closeAdmin() {
  if (!host)
    return;
  host.remove();
  host = null;
}
function openAdmin() {
  if (host)
    return closeAdmin();
  const save = get();
  host = document.createElement("div");
  host.className = "admin";
  host.innerHTML = html`<div class="ad-box" role="dialog" aria-label="Admin">
    <header class="ad-head">
      <b>Admin</b>
      <span class="ad-sub">day ${dayNumber()} · week ${weekNumber()} · ${save.gold}g</span>
      <button class="ad-x" data-close type="button" aria-label="Close">✕</button>
    </header>

    <div class="ad-body">
      ${raw(row("Fight", `<div class="ad-chips">${TEST_BOSSES.map((id) => `<button class="ad-c ${state.boss === id ? "is-on" : ""}" data-boss="${id}">${roman(BOSSES2[id].tier)} ${BOSSES2[id].name}</button>`).join("")}</div>`))}
      ${raw(row("Start at", `<div class="ad-chips">${["100%", "60%", "30%"].map((l, i) => `<button class="ad-c ${state.phase === i ? "is-on" : ""}" data-phase="${i}">${l}</button>`).join("")}</div>`))}
      ${raw(row("Blessing", `<div class="ad-chips"><button class="ad-c ${!state.blessing ? "is-on" : ""}" data-bless="">none</button>${Object.values(BLESSINGS).map((b) => `<button class="ad-c ${state.blessing === b.id ? "is-on" : ""}" data-bless="${b.id}">${b.name}</button>`).join("")}</div>`))}
      ${raw(row("Affix", `<div class="ad-chips">${Object.values(MODIFIERS).map((m) => `<button class="ad-c ${state.modifier === m.id ? "is-on" : ""}" data-mod="${m.id}">${m.name}</button>`).join("")}</div>`))}
      <button class="btn btn-go ad-go" data-go type="button">Drop into the fight →</button>

      ${raw(row("While fighting", `<div class="ad-chips">
            ${toggle("god", "God")}
            ${toggle("oneShot", "One-shot")}
            ${toggle("freezeBoss", "Freeze boss")}
            ${toggle("noEnrage", "No enrage")}
            ${toggle("showHitboxes", "Hitboxes")}
            ${toggle("showLights", "Lights")}
            ${toggle("fps", "FPS")}
          </div>`))}
      ${raw(row("Time", `<div class="ad-chips">${[0.15, 0.35, 1, 2].map((v) => `<button class="ad-c ${DEBUG.slow === v ? "is-on" : ""}" data-slow="${v}">${v}×</button>`).join("")}${toggle("step", "Frame step")}<span class="ad-note">then <b>.</b> for one frame</span></div>`))}

      ${raw(row("Save", `<div class="ad-chips">
            <button class="ad-c" data-gold="500">+500g</button>
            <button class="ad-c" data-gold="5000">+5000g</button>
            <button class="ad-c" data-unlock>Unlock every item</button>
            <button class="ad-c" data-freeday>Reopen today</button>
            <button class="ad-c" data-clearweek>Clear the week</button>
            <button class="ad-c ad-danger" data-wipe>Wipe</button>
          </div>`))}
      ${raw(row("Tools", `<div class="ad-chips">
            <a class="ad-c" href="dev-art.html" target="_blank" rel="noopener">Art sheet</a>
            <a class="ad-c" href="dev-fight.html?bot=1&t=20" target="_blank" rel="noopener">Renderer bench</a>
            <a class="ad-c" href="dev-fight.html?shapes=1&t=2" target="_blank" rel="noopener">Telegraph shapes</a>
          </div>`))}
      <div class="ad-msg" data-msg aria-live="polite"></div>
      <div class="ad-keys"><b>~</b> admin · <b>.</b> one frame · <b>Esc</b> close</div>
    </div>
  </div>`;
  document.body.append(host);
  sfx.open();
  const $ = (s) => host.querySelector(s);
  const msg = (t) => $("[data-msg]").textContent = t;
  const redraw = () => {
    closeAdmin();
    openAdmin();
  };
  $("[data-close]").onclick = closeAdmin;
  host.addEventListener("click", (e) => {
    if (e.target === host)
      closeAdmin();
  });
  for (const el of host.querySelectorAll("[data-boss]"))
    el.onclick = () => (state.boss = el.dataset.boss, redraw());
  for (const el of host.querySelectorAll("[data-phase]"))
    el.onclick = () => (state.phase = +el.dataset.phase, redraw());
  for (const el of host.querySelectorAll("[data-bless]"))
    el.onclick = () => (state.blessing = el.dataset.bless || null, redraw());
  for (const el of host.querySelectorAll("[data-mod]"))
    el.onclick = () => (state.modifier = el.dataset.mod, redraw());
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
      get().gold += +el.dataset.gold;
      persist();
      sfx.coin();
      redraw();
    };
  $("[data-unlock]").onclick = () => {
    const s = get();
    s.items = [...ITEM_IDS];
    persist();
    sfx.coin();
    msg("every item unlocked");
  };
  $("[data-freeday]").onclick = () => {
    const s = get();
    s.today.done = false;
    s.today.used = false;
    s.today.live = 0;
    s.today.left = false;
    s.today.blessing = null;
    persist();
    msg("today is open again");
    sfx.click();
  };
  $("[data-clearweek]").onclick = () => {
    const s = get();
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
function installAdminKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote" || e.key === "~" && !e.repeat) {
      e.preventDefault();
      openAdmin();
    } else if (e.code === "Escape" && host) {
      closeAdmin();
    } else if (e.code === "Period" && DEBUG.step) {
      DEBUG.stepOnce = true;
    }
  });
  window.addEventListener("touchstart", (e) => {
    if (e.touches.length >= 5)
      openAdmin();
  });
  if (location.hash === "#admin")
    setTimeout(openAdmin, 400);
}

// site/js/ui/mapedit.js
var emptyEdit;
var packEdit;
var fill;
var lineOfE;
var fillFx;
var packFx;
var TILE = 64;
var EDIT_HEADERS = (type) => ({ "Content-Type": type, "X-TB-Edit": "1" });
function mapEditHere(loc = globalThis.location) {
  if (!loc)
    return false;
  if (new URLSearchParams(loc.search).get("edit") === "1")
    return true;
  const h = loc.hostname.replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168."))
    return true;
  const m = /^172\.(\d+)\./.exec(h);
  return !!m && +m[1] >= 16 && +m[1] <= 31;
}
function mountMapEdit(host, { renderer, onToggle, place = "right", world = () => null, cam = () => null }) {
  const btn = document.createElement("button");
  btn.className = `me-toggle me-at-${place}`;
  btn.type = "button";
  btn.textContent = "Edit map";
  btn.hidden = true;
  host.append(btn);
  let info = null;
  const here = mapEditHere();
  const poll = setInterval(() => {
    if (!here)
      return clearInterval(poll);
    const i = renderer.mapEdit?.info;
    if (i && i.depthImage) {
      info = i;
      btn.hidden = false;
      clearInterval(poll);
    }
  }, 400);
  let ed = null, busy = false, destroyed = false;
  btn.onclick = async () => {
    if (busy)
      return;
    busy = true;
    try {
      if (!ed) {
        const e = await startEditor(host, renderer, info, { world, cam, gone: () => destroyed });
        if (destroyed)
          return void e.close(true);
        ed = e;
        onToggle(true);
        host.classList.add("is-editing");
        btn.textContent = "Done";
        btn.classList.add("is-on");
      } else if (await ed.close()) {
        ed = null;
        host.classList.remove("is-editing");
        btn.textContent = "Edit map";
        btn.classList.remove("is-on");
        onToggle(false);
      }
    } catch (err) {
      if (err !== GONE)
        console.error("map edit:", err);
    } finally {
      busy = false;
    }
  };
  return {
    get on() {
      return !!ed;
    },
    destroy() {
      destroyed = true;
      clearInterval(poll);
      ed?.close(true);
      if (ed?.dirty() && confirm("The map has changes that are not saved. Save them now?"))
        ed.save();
      btn.remove();
    }
  };
}
var GONE = new Error("map edit: the screen went away");
async function startEditor(host, renderer, info, { world, cam, gone = () => false }) {
  ({ emptyEdit, packEdit, fill, lineOf: lineOfE } = await (__preload("q3wm931g"), import("./mapedit3d-q3wm931g.js?v=88e40de-1ff3b19c")));
  ({ fillFx, packFx } = await (__preload("zdqbes29"), import("./fxedit-zdqbes29.js?v=88e40de-1ff3b19c")));
  if (gone())
    throw GONE;
  const { bd, id } = info;
  const canvas = host.querySelector("canvas");
  const rect = () => canvas.getBoundingClientRect();
  const c0 = renderer.refCrop;
  const view = c0 ? { cx: c0.x0 + c0.w / 2, cy: c0.y0 + c0.h / 2, h: c0.h } : { cx: info.IW / 2, cy: info.IH / 2, h: info.IH };
  const hMax = () => {
    const r = rect();
    return Math.max(info.IH, info.IW * r.height / r.width) * 1.15;
  };
  const toImg = (clientX, clientY) => {
    const r = rect();
    const w = view.h * r.width / r.height;
    return [view.cx - w / 2 + (clientX - r.left) / r.width * w, view.cy - view.h / 2 + (clientY - r.top) / r.height * view.h];
  };
  const toScreen = (ix, iy) => {
    const r = rect();
    const w = view.h * r.width / r.height;
    return [(ix - (view.cx - w / 2)) / w * r.width, (iy - (view.cy - view.h / 2)) / view.h * r.height];
  };
  const ui = document.createElement("div");
  ui.className = "me-ui";
  ui.innerHTML = `
    <canvas class="me-walk" data-walk></canvas>
    <canvas class="me-walk" data-fx></canvas>
    <canvas class="me-lines" data-lines></canvas>
    <div class="me-layer" data-layer></div>
    <div class="me-pins" data-pins></div>
    <div class="me-cursor" data-cursor hidden></div>
    <div class="me-bar" role="toolbar" aria-label="Map edit tools">
      <div class="me-group me-modes" role="group" aria-label="What to edit">
        <button type="button" class="me-tool" data-mode="mask">Masks</button>
        <button type="button" class="me-tool" data-mode="walk">Walk area</button>
        <button type="button" class="me-tool" data-mode="fx" hidden>Effects</button>
      </div>
      <div class="me-group" data-tools>
        <button type="button" class="me-tool" data-tool="move" title="Move (1)">Move</button>
        <button type="button" class="me-tool me-add" data-tool="add" title="Mask (2)">Mask</button>
        <button type="button" class="me-tool me-rem" data-tool="rem" title="Clear (3)">Clear</button>
        <button type="button" class="me-tool me-notetool" data-tool="note" title="Note (4)">Note</button>
        <button type="button" class="me-tool me-fxtool" data-tool="water" title="Water (2)"><span class="me-chip" style="background:#2cc8ff"></span>Water</button>
        <button type="button" class="me-tool me-fxtool" data-tool="fall" title="Waterfall (3)"><span class="me-chip" style="background:#e8e8ff"></span>Waterfall</button>
        <button type="button" class="me-tool me-fxtool" data-tool="petal" title="Sakura petals (4)"><span class="me-chip" style="background:#ff7ab4"></span>Petals</button>
        <button type="button" class="me-tool me-fxtool" data-tool="none" title="No effect (5)"><span class="me-chip" style="background:#ff4a3d"></span>No effect</button>
      </div>
      <div class="me-group">
        <button type="button" class="me-btn" data-size="-1" title="Smaller pen ([)" aria-label="Smaller pen">−</button>
        <span class="me-size" data-sizeval title="Pen size, screen pixels"></span>
        <button type="button" class="me-btn" data-size="1" title="Bigger pen (])" aria-label="Bigger pen">+</button>
      </div>
      <div class="me-group">
        <button type="button" class="me-btn" data-zoom="out" title="Zoom out" aria-label="Zoom out">⊖</button>
        <button type="button" class="me-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">⊕</button>
        <button type="button" class="me-btn" data-zoom="fit" title="Whole map">Fit</button>
        <button type="button" class="me-btn" data-show title="Show or hide the colours">Colours</button>
        <button type="button" class="me-btn" data-herohere title="Put the hero in the middle of the view (H)" hidden>Hero here</button>
      </div>
      <div class="me-group">
        <button type="button" class="me-btn" data-undo title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" class="me-btn" data-redo title="Redo (Ctrl+Y)">Redo</button>
        <button type="button" class="me-btn" data-undoall title="Back to how it was when this view was opened">Undo all</button>
        <button type="button" class="me-btn me-primary" data-save title="Save (Ctrl+S)">Save</button>
      </div>
      <div class="me-status" data-status aria-live="polite"></div>
    </div>
    <form class="me-notebox" data-note hidden>
      <label for="me-note-text" data-notelabel>Note about the yellow area</label>
      <textarea id="me-note-text" rows="3" data-notetext placeholder="What should change here?"></textarea>
      <div class="me-notebox-row">
        <button type="submit" class="me-btn me-primary" data-notesave>Add note</button>
        <button type="button" class="me-btn" data-notedel>Discard</button>
        <button type="button" class="me-btn" data-noteclose>Close</button>
      </div>
    </form>
    <div class="me-card" data-card hidden>
      <span data-cardtext></span>
      <div class="me-notebox-row">
        <button type="button" class="me-btn me-primary" data-addline>Add line</button>
        <button type="button" class="me-btn" data-resetline>Reset line</button>
        <button type="button" class="me-btn" data-delline>Remove line</button>
        <button type="button" class="me-btn" data-deldot>Remove point</button>
        <button type="button" class="me-btn" data-cardclose>Close</button>
      </div>
    </div>
    <div class="me-modal" data-modal hidden role="dialog" aria-modal="true" aria-labelledby="me-modal-title">
      <div class="me-modal-card">
        <h3 id="me-modal-title" data-mtitle></h3>
        <p data-mtext></p>
        <div class="me-notebox-row" data-mbtns></div>
      </div>
    </div>`;
  host.append(ui);
  const $ = (s) => ui.querySelector(s);
  const layerEl = $("[data-layer]"), cursor = $("[data-cursor]"), pinsEl = $("[data-pins]"), statusEl = $("[data-status]");
  const walkEl = $("[data-walk]");
  const noteForm = $("[data-note]"), noteText = $("[data-notetext]");
  const setStatus = (t) => statusEl.textContent = t;
  function ask(title, text, buttons) {
    const m = $("[data-modal]");
    $("[data-mtitle]").textContent = title;
    $("[data-mtext]").textContent = text;
    const row = $("[data-mbtns]");
    row.textContent = "";
    return new Promise((done) => {
      for (const [bid, label, cls] of buttons) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `me-btn ${cls || ""}`;
        b.textContent = label;
        b.onclick = () => {
          m.hidden = true;
          done(bid);
        };
        row.append(b);
      }
      m.hidden = false;
      row.querySelector("button")?.focus();
    });
  }
  let hist = [], hpos = 0, savedAt = 0, layer = null, mode = "mask";
  const dirty = () => hpos !== savedAt;
  const syncHist = () => {
    $("[data-undo]").disabled = hpos === 0;
    $("[data-redo]").disabled = hpos >= hist.length;
    $("[data-undoall]").disabled = !hist.length && !layer?.wasSaved();
    $("[data-save]").disabled = !dirty();
    if (dirty())
      setStatus("Not saved");
  };
  const push = (h) => {
    if (savedAt > hpos)
      savedAt = -1;
    hist.length = hpos;
    hist.push(h);
    hpos = hist.length;
    syncHist();
  };
  let stroke = null;
  const undo = () => {
    if (stroke || hpos === 0)
      return;
    hist[--hpos].undo();
    syncHist();
  };
  const redo = () => {
    if (stroke || hpos >= hist.length)
      return;
    hist[hpos++].redo();
    syncHist();
  };
  let sel = 0, selDot = -1;
  const maskLayer = await (async () => {
    if (!bd.editBase)
      bd.editBase = await decodeDepth(info.depthImage);
    const base = bd.editBase;
    if (bd.odepth?.image && !bd.editOdepth)
      bd.editOdepth = await decodeDepth(bd.odepth.image, true);
    const O = bd.editOdepth && bd.editOdepth.w === base.w && bd.editOdepth.h === base.h ? bd.editOdepth : null;
    const { w: gw, h: gh } = base, N = gw * gh;
    const sxg = gw / info.IW, syg = gh / info.IH;
    if (!bd.edit || bd.edit.w !== gw || bd.edit.h !== gh)
      bd.edit = emptyEdit(gw, gh);
    const E = bd.edit;
    if (!bd.editComments)
      bd.editComments = await fetch(`art3d/${id}/${id}-comments.json`, { cache: "no-cache" }).then((r) => r.ok ? r.json() : [], () => []);
    let notes = bd.editComments;
    const draft = new Uint8Array(N), union = new Uint8Array(N);
    const snapshot = () => ({ add: E.add.slice(), rem: E.rem.slice(), pc: E.pc?.slice(), lines: JSON.parse(JSON.stringify(E.lines || {})), next: E.next, notes: JSON.parse(JSON.stringify(notes)) });
    let opened = snapshot(), saved = opened;
    function rebuildUnion() {
      union.fill(0);
      for (const n of notes)
        for (const [y, x, len] of n.runs)
          union.fill(170, y * gw + x, y * gw + x + len);
    }
    rebuildUnion();
    function refresh(x0, y0, x1, y1) {
      const u = info.kind === "camp" ? [Math.max(0, x0), Math.max(0, y0), Math.min(gw, x1), Math.min(gh, y1)] : computeDepth(E, base.d, gw, gh, x0, y0, x1, y1, O);
      for (let y = u[1];y < u[3]; y++)
        for (let x = u[0], i = y * gw + u[0];x < u[2]; x++, i++)
          E.com[i] = Math.max(draft[i], union[i]);
      fill(E, u[0], u[1], u[2], u[3]);
      renderer.mapEdit.upload(E.cov, u[1], u[3]);
      renderer.mapEdit.upload(E.depTex, u[1], u[3]);
      if (E.pidTex)
        renderer.mapEdit.upload(E.pidTex, u[1], u[3]);
    }
    function restore(sn) {
      E.add.set(sn.add);
      E.rem.set(sn.rem);
      if (sn.pc && E.pc)
        E.pc.set(sn.pc);
      E.lines = JSON.parse(JSON.stringify(sn.lines));
      E.next = sn.next;
      notes = bd.editComments = JSON.parse(JSON.stringify(sn.notes));
      draft.fill(0);
      rebuildUnion();
      refresh(0, 0, gw, gh);
      placePins();
      pickPiece(0);
    }
    const depBefore = E.dep.slice();
    refresh(0, 0, gw, gh);
    E.cov.needsUpdate = E.depTex.needsUpdate = true;
    let stale = false;
    for (let i = 0;i < N && !stale; i++)
      if (E.add[i] && E.dep[i] !== depBefore[i])
        stale = true;
    const copyTile = (tx, ty) => {
      const x0 = tx * TILE, y0 = ty * TILE, x1 = Math.min(gw, x0 + TILE), y1 = Math.min(gh, y0 + TILE);
      const o = { tx, ty, add: [], rem: [], draft: [], pc: [] };
      for (let y = y0;y < y1; y++) {
        o.add.push(E.add.slice(y * gw + x0, y * gw + x1));
        o.rem.push(E.rem.slice(y * gw + x0, y * gw + x1));
        o.draft.push(draft.slice(y * gw + x0, y * gw + x1));
        if (E.pc)
          o.pc.push(E.pc.slice(y * gw + x0, y * gw + x1));
      }
      return o;
    };
    const putTile = (o) => {
      const x0 = o.tx * TILE, y0 = o.ty * TILE;
      o.add.forEach((row, j) => E.add.set(row, (y0 + j) * gw + x0));
      o.rem.forEach((row, j) => E.rem.set(row, (y0 + j) * gw + x0));
      o.draft.forEach((row, j) => draft.set(row, (y0 + j) * gw + x0));
      o.pc.forEach((row, j) => E.pc.set(row, (y0 + j) * gw + x0));
    };
    let st = null;
    const snap = (x0, y0, x1, y1) => {
      for (let ty = Math.max(0, Math.floor(y0 / TILE));ty <= Math.min(Math.ceil(gh / TILE) - 1, Math.floor((y1 - 1) / TILE)); ty++)
        for (let tx = Math.max(0, Math.floor(x0 / TILE));tx <= Math.min(Math.ceil(gw / TILE) - 1, Math.floor((x1 - 1) / TILE)); tx++) {
          const k = ty * 1e4 + tx;
          if (!st.tiles.has(k))
            st.tiles.set(k, { before: copyTile(tx, ty) });
        }
    };
    function stamp(ix, iy, Rimg, tool) {
      const gx = ix * sxg, gy = iy * syg, R = Rimg * syg;
      const x0 = Math.max(0, Math.floor(gx - R - 1)), x1 = Math.min(gw, Math.ceil(gx + R + 1));
      const y0 = Math.max(0, Math.floor(gy - R - 1)), y1 = Math.min(gh, Math.ceil(gy + R + 1));
      if (x1 <= x0 || y1 <= y0)
        return;
      snap(x0 - 10, y0 - 10, x1 + 10, y1 + 10);
      const inner = R * 0.45;
      for (let y = y0;y < y1; y++)
        for (let x = x0, i = y * gw + x0;x < x1; x++, i++) {
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
          if (d >= R)
            continue;
          let t = d <= inner ? 1 : 1 - (d - inner) / (R - inner);
          t = t * t * (3 - 2 * t);
          const v = Math.round(255 * t);
          if (tool === "add") {
            E.add[i] = Math.max(E.add[i], v);
            E.rem[i] = Math.min(E.rem[i], 255 - v);
            if (st.piece && (v >= 128 || v >= 8 && !E.pc[i] && !E.pieces?.ids[i]))
              E.pc[i] = st.piece;
          } else if (tool === "rem")
            E.rem[i] = Math.max(E.rem[i], v), E.add[i] = Math.min(E.add[i], 255 - v), draft[i] = Math.min(draft[i], 255 - v);
          else if (tool === "note")
            draft[i] = Math.max(draft[i], v);
        }
      const b = st.box;
      b[0] = Math.min(b[0], x0);
      b[1] = Math.min(b[1], y0);
      b[2] = Math.max(b[2], x1);
      b[3] = Math.max(b[3], y1);
      dirty = dirty ? [Math.min(dirty[0], x0), Math.min(dirty[1], y0), Math.max(dirty[2], x1), Math.max(dirty[3], y1)] : [x0, y0, x1, y1];
      if (!raf)
        raf = requestAnimationFrame(flush);
    }
    let dirty = null, raf = 0;
    function flush() {
      raf = 0;
      if (!dirty)
        return;
      const d = dirty;
      dirty = null;
      refresh(...d);
    }
    const paintEntry = (tiles, box, piece) => ({
      undo: () => (tiles.forEach((t) => putTile(t.before)), refresh(...box), pieces && pickPiece(sel)),
      redo: () => (tiles.forEach((t) => putTile(t.after)), refresh(...box), pieces && pickPiece(sel))
    });
    const clearDraft = (box) => {
      for (let y = box[1];y < box[3]; y++)
        draft.fill(0, y * gw + box[0], y * gw + box[2]);
    };
    let noteOpen = null;
    function openNote(n) {
      noteOpen = n;
      noteForm.hidden = false;
      $("[data-notelabel]").textContent = n ? `Note ${notes.indexOf(n) + 1}` : "Note about the yellow area";
      $("[data-notesave]").textContent = n ? "Keep" : "Add note";
      $("[data-notedel]").textContent = n ? "Delete note" : "Discard";
      noteText.value = n ? n.text : noteText.dataset.draft || "";
      if (matchMedia("(pointer: fine)").matches)
        noteText.focus();
    }
    noteText.oninput = () => {
      if (!noteOpen)
        noteText.dataset.draft = noteText.value;
    };
    noteForm.onsubmit = (e) => {
      e.preventDefault();
      const text = noteText.value.trim();
      if (noteOpen) {
        const n = noteOpen, before = n.text;
        if (text !== before) {
          n.text = text;
          push({ undo: () => n.text = before, redo: () => n.text = text });
        }
        noteForm.hidden = true;
        noteOpen = null;
        return;
      }
      let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
      const runs = [];
      for (let y = 0;y < gh; y++) {
        const row = y * gw;
        let x = 0;
        while (x < gw) {
          if (draft[row + x] < 64) {
            x++;
            continue;
          }
          const a = x;
          while (x < gw && draft[row + x] >= 64)
            x++;
          runs.push([y, a, x - a]);
          x0 = Math.min(x0, a);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y + 1);
        }
      }
      if (!runs.length) {
        setStatus("Paint the area with Note first, then write the note.");
        return;
      }
      let sx = 0, sy = 0, sn = 0;
      for (const [y, a, len] of runs)
        sx += (a + len / 2) * len, sy += (y + 0.5) * len, sn += len;
      const box = [x0, y0, x1, y1];
      const note = {
        id: Date.now().toString(36),
        text,
        map: id,
        made: new Date().toISOString(),
        grid: [gw, gh],
        image: [Math.round(x0 / sxg), Math.round(y0 / syg), Math.round(x1 / sxg), Math.round(y1 / syg)],
        at: [sx / sn, sy / sn],
        box,
        runs
      };
      const draftRows = [];
      for (let y = y0;y < y1; y++)
        draftRows.push(draft.slice(y * gw + x0, y * gw + x1));
      const add = () => {
        notes.push(note);
        clearDraft(box);
        rebuildUnion();
        refresh(...box);
        placePins();
      };
      add();
      noteText.dataset.draft = "";
      noteForm.hidden = true;
      push({
        undo: () => {
          notes = bd.editComments = notes.filter((n) => n !== note);
          draftRows.forEach((row, j) => draft.set(row, (y0 + j) * gw + x0));
          rebuildUnion();
          refresh(...box);
          placePins();
        },
        redo: add
      });
    };
    $("[data-notedel]").onclick = () => {
      if (noteOpen) {
        const note = noteOpen, at = notes.indexOf(note);
        const del = () => {
          notes = bd.editComments = notes.filter((n) => n !== note);
          rebuildUnion();
          refresh(...note.box);
          placePins();
        };
        del();
        push({ undo: () => (notes.splice(at, 0, note), rebuildUnion(), refresh(...note.box), placePins()), redo: del });
      } else {
        let box = null;
        for (let y = 0;y < gh; y++)
          for (let x = 0, i = y * gw;x < gw; x++, i++)
            if (draft[i])
              box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + 1), y + 1] : [x, y, x + 1, y + 1];
        if (box) {
          st = { tiles: new Map, box: [...box] };
          snap(...box);
          clearDraft(box);
          refresh(...box);
          const tiles = [...st.tiles.values()];
          for (const t of tiles)
            t.after = copyTile(t.before.tx, t.before.ty);
          st = null;
          push(paintEntry(tiles, box));
        }
        noteText.dataset.draft = "";
      }
      noteForm.hidden = true;
      noteOpen = null;
    };
    $("[data-noteclose]").onclick = () => {
      noteForm.hidden = true;
      noteOpen = null;
    };
    function placePins() {
      pinsEl.textContent = "";
      if (mode !== "mask")
        return;
      const r = rect();
      notes.forEach((n, k) => {
        const [x, y] = toScreen(n.at[0] / sxg, n.at[1] / syg);
        if (x < -20 || y < -20 || x > r.width + 20 || y > r.height + 20)
          return;
        const p = document.createElement("button");
        p.type = "button";
        p.className = "me-pin";
        p.textContent = String(k + 1);
        p.title = n.text || "Note";
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.onclick = (e) => {
          e.stopPropagation();
          openNote(n);
        };
        pinsEl.append(p);
      });
    }
    return {
      tools: ["move", "add", "rem", "note"],
      get stale() {
        return stale;
      },
      show(on, colours) {
        renderer.mapEdit.setLayers(E.cov, E.depTex, on && colours);
        placePins();
        if (!on)
          noteForm.hidden = true;
      },
      begin(tool) {
        st = { tiles: new Map, box: [gw, gh, 0, 0], piece: 0 };
        if (tool === "add" && E.pid)
          st.piece = sel || E.next++;
      },
      stamp,
      end(keep, tool) {
        if (!st)
          return;
        const s = st;
        st = null;
        if (raf)
          cancelAnimationFrame(raf);
        flush();
        const tiles = [...s.tiles.values()];
        if (!keep || !tiles.length) {
          tiles.forEach((t) => putTile(t.before));
          if (tiles.length)
            refresh(...s.box);
          return;
        }
        for (const t of tiles)
          t.after = copyTile(t.before.tx, t.before.ty);
        push(paintEntry(tiles, s.box, s.piece));
        if (tool === "note")
          openNote(null);
        if (s.piece)
          pickPiece(s.piece);
        else if (tool === "rem" && sel)
          pickPiece(sel);
      },
      placePins,
      opened: () => restore(opened),
      discard: () => restore(saved),
      async save() {
        const snap = snapshot(), packed = packEdit(E), noteJson = JSON.stringify(notes);
        const bin = await gzip(packed);
        const r1 = await fetch(`/api/mapedit?id=${id}`, { method: "POST", body: bin, headers: EDIT_HEADERS("application/octet-stream") });
        if (!r1.ok)
          throw new Error(`masks ${r1.status}`);
        const r2 = await fetch(`/api/mapcomments?id=${id}`, { method: "POST", body: noteJson, headers: EDIT_HEADERS("application/json") });
        if (!r2.ok)
          throw new Error(`notes ${r2.status}`);
        saved = snap;
        stale = false;
      },
      wasSaved: () => saved !== opened,
      rebaseOpened() {
        opened = saved = snapshot();
      }
    };
  })();
  if (gone())
    throw ui.remove(), GONE;
  const walkLayer = (() => {
    const shape = ARENA_SHAPES[id];
    if (!shape || !renderer.mapEdit.toImage)
      return null;
    const C = bd.walkNow ? { ...bd.walkNow, inside: bd.walkNow.inside.slice() } : walkCells(id, WALK_EDITS[id]);
    if (!C)
      return null;
    const { x0, y0, cell, nx, ny } = C;
    const N = nx * ny;
    const cx = new Float32Array((nx + 1) * (ny + 1)), cy = new Float32Array((nx + 1) * (ny + 1));
    for (let j = 0;j <= ny; j++)
      for (let i = 0;i <= nx; i++) {
        const p = renderer.mapEdit.toImage(x0 + i * cell, y0 + j * cell);
        cx[j * (nx + 1) + i] = p[0];
        cy[j * (nx + 1) + i] = p[1];
      }
    const mx = new Float32Array(N), my = new Float32Array(N), hr = new Float32Array(N);
    for (let j = 0;j < ny; j++)
      for (let i = 0;i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + nx + 2;
        mx[j * nx + i] = (cx[a] + cx[b]) / 2;
        my[j * nx + i] = (cy[a] + cy[b]) / 2;
        hr[j * nx + i] = 0.5 * Math.max(Math.abs(cx[b] - cx[a]), Math.abs(cy[b] - cy[a]), Math.abs(cx[a + 1] - cx[a + nx + 1]), Math.abs(cy[a + 1] - cy[a + nx + 1]));
      }
    const BK = 8, bw = Math.ceil(info.IW / BK) + 2, bh = Math.ceil(info.IH / BK) + 2;
    const bOf = (i) => {
      const x = Math.floor(mx[i] / BK) + 1, y = Math.floor(my[i] / BK) + 1;
      return x < 0 || y < 0 || x >= bw || y >= bh ? -1 : y * bw + x;
    };
    const start = new Int32Array(bw * bh + 1), list = new Int32Array(N);
    for (let i = 0;i < N; i++) {
      const b = bOf(i);
      if (b >= 0)
        start[b + 1]++;
    }
    for (let b = 0;b < bw * bh; b++)
      start[b + 1] += start[b];
    const fillAt = start.slice(0, -1);
    for (let i = 0;i < N; i++) {
      const b = bOf(i);
      if (b >= 0)
        list[fillAt[b]++] = i;
    }
    const ws = Math.min(1, 2048 / Math.max(info.IW, info.IH));
    const pic = document.createElement("canvas");
    pic.width = Math.ceil(info.IW * ws);
    pic.height = Math.ceil(info.IH * ws);
    const pg = pic.getContext("2d");
    const P = (ii, jj) => [cx[jj * (nx + 1) + ii] * ws, cy[jj * (nx + 1) + ii] * ws];
    let shown = false, colours = true;
    function draw() {
      pg.clearRect(0, 0, pic.width, pic.height);
      pg.fillStyle = "rgb(60, 235, 110)";
      pg.beginPath();
      for (let j = 0;j < ny; j++) {
        let i = 0;
        while (i < nx) {
          if (!C.inside[j * nx + i]) {
            i++;
            continue;
          }
          const a = i;
          while (i < nx && C.inside[j * nx + i] && i - a < 8)
            i++;
          const q = [P(a, j), P(i, j), P(i, j + 1), P(a, j + 1)];
          pg.moveTo(q[0][0], q[0][1]);
          for (let k = 1;k < 4; k++)
            pg.lineTo(q[k][0], q[k][1]);
          pg.closePath();
        }
      }
      pg.fill();
      blit();
    }
    function blit() {
      const r = rect(), dpr = devicePixelRatio || 1;
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (walkEl.width !== W || walkEl.height !== H)
        walkEl.width = W, walkEl.height = H;
      const g = walkEl.getContext("2d");
      g.clearRect(0, 0, W, H);
      if (!shown || !colours)
        return;
      const w = view.h * r.width / r.height;
      g.globalAlpha = 0.42;
      g.drawImage(pic, (view.cx - w / 2) * ws, (view.cy - view.h / 2) * ws, w * ws, view.h * ws, 0, 0, W, H);
      g.globalAlpha = 1;
    }
    const snapshot = () => C.inside.slice();
    let opened = snapshot(), saved = opened;
    const restore = (s) => (C.inside.set(s), draw());
    let st = null, raf = 0;
    const later = () => {
      if (!raf)
        raf = requestAnimationFrame(() => (raf = 0, draw()));
    };
    function stamp(ix, iy, R, tool) {
      const v = tool === "add" ? 1 : 0;
      const RR = R + 16;
      const bx0 = Math.max(0, Math.floor((ix - RR) / BK) + 1), bx1 = Math.min(bw - 1, Math.floor((ix + RR) / BK) + 1);
      const by0 = Math.max(0, Math.floor((iy - RR) / BK) + 1), by1 = Math.min(bh - 1, Math.floor((iy + RR) / BK) + 1);
      let any = false;
      for (let by = by0;by <= by1; by++)
        for (let bx = bx0;bx <= bx1; bx++) {
          const b = by * bw + bx;
          for (let k = start[b];k < start[b + 1]; k++) {
            const i = list[k];
            if (C.inside[i] === v || Math.hypot(mx[i] - ix, my[i] - iy) > R + hr[i])
              continue;
            if (!st.before.has(i))
              st.before.set(i, C.inside[i]);
            C.inside[i] = v;
            any = true;
          }
        }
      if (any)
        later();
    }
    return {
      tools: ["move", "add", "rem"],
      show(on, c) {
        shown = on;
        colours = c;
        if (on)
          draw();
        else
          blit();
      },
      blit,
      begin() {
        st = { before: new Map };
      },
      stamp,
      end(keep) {
        if (!st)
          return;
        const s = st;
        st = null;
        if (raf)
          cancelAnimationFrame(raf), raf = 0, draw();
        if (!s.before.size)
          return;
        const idx = [...s.before.keys()], before = Uint8Array.from(s.before.values()), after = Uint8Array.from(idx, (i) => C.inside[i]);
        if (!keep) {
          idx.forEach((i, k) => C.inside[i] = before[k]);
          draw();
          return;
        }
        push({ undo: () => (idx.forEach((i, k) => C.inside[i] = before[k]), draw()), redo: () => (idx.forEach((i, k) => C.inside[i] = after[k]), draw()) });
      },
      placePins() {},
      opened: () => restore(opened),
      discard: () => restore(saved),
      async save() {
        const base = walkCells(id);
        const add = [], rem = [];
        for (let j = 0;j < ny; j++)
          for (const [want, out] of [[1, add], [0, rem]]) {
            let i = 0;
            while (i < nx) {
              const k = j * nx + i;
              if (!(C.inside[k] === want && base.inside[k] !== want)) {
                i++;
                continue;
              }
              const a = i;
              while (i < nx && C.inside[j * nx + i] === want && base.inside[j * nx + i] !== want)
                i++;
              out.push([j, a, i - a]);
            }
          }
        const snap = snapshot();
        const r = await fetch(`/api/walkedit?id=${id}`, { method: "POST", body: JSON.stringify({ x0, y0, cell, nx, ny, add, rem }), headers: EDIT_HEADERS("application/json") });
        if (!r.ok)
          throw new Error(`walk ${r.status}`);
        saved = snap;
        bd.walkNow = { ...C, inside: saved.slice() };
        const w = world();
        if (w) {
          w.arena = shapeFromCells({ ...C, inside: saved.slice() }, shape);
          cam()?.setArena?.(w.arena);
        }
      },
      wasSaved: () => saved !== opened,
      rebaseOpened() {
        opened = saved = snapshot();
      }
    };
  })();
  const fxLayer = await (async () => {
    const F = bd.fxEdit;
    if (info.kind !== "camp" || !F || !renderer.mapEdit.refreshPetals)
      return null;
    const { w: fw, h: fh, planes: P } = F, N = fw * fh;
    const sx = fw / info.IW, sy = fh / info.IH;
    const base = await (async () => {
      const img = bd.fx.image, c = document.createElement("canvas");
      c.width = fw;
      c.height = fh;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, fw, fh);
      const px = g.getImageData(0, 0, fw, fh).data, wat = new Uint8Array(N), fal = new Uint8Array(N);
      for (let i = 0;i < N; i++) {
        const r = px[i * 4];
        wat[i] = r < 140 ? Math.min(255, Math.round(r / 127 * 255)) : 0;
        fal[i] = px[i * 4 + 1];
      }
      return { wat, fal };
    })();
    const el = $("[data-fx]");
    const pic = document.createElement("canvas");
    pic.width = fw;
    pic.height = fh;
    const pg = pic.getContext("2d");
    const im = pg.createImageData(fw, fh);
    function paint(x0, y0, x1, y1) {
      const d = im.data;
      for (let y = y0;y < y1; y++)
        for (let x = x0, i = y * fw + x0;x < x1; x++, i++) {
          const no = P.none[i] / 255, wa = Math.max(base.wat[i] / 255 * (1 - no), P.water[i] / 255);
          const fa = Math.max(base.fal[i] / 255 * (1 - no), P.fall[i] / 255), pe = P.petal[i] / 255;
          let r = 0, g = 0, b = 0, a = 0;
          const add = (cr, cg, cb, k) => {
            if (k <= 0)
              return;
            r = r * (1 - k) + cr * k;
            g = g * (1 - k) + cg * k;
            b = b * (1 - k) + cb * k;
            a = Math.max(a, k);
          };
          add(40, 200, 255, wa);
          add(235, 235, 255, fa);
          add(255, 110, 180, pe);
          if (no > 0 && (base.wat[i] || base.fal[i]))
            add(255, 70, 60, no * 0.8);
          const o = i * 4;
          d[o] = r;
          d[o + 1] = g;
          d[o + 2] = b;
          d[o + 3] = Math.round(a * 120);
        }
      pg.putImageData(im, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }
    paint(0, 0, fw, fh);
    let shown = false, colours = true;
    function blit() {
      const r = rect(), dpr = devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (el.width !== W || el.height !== H)
        el.width = W, el.height = H;
      const g = el.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      if (!shown || !colours)
        return;
      const w = view.h * r.width / r.height;
      g.drawImage(pic, (view.cx - w / 2) * sx, (view.cy - view.h / 2) * sy, w * sx, view.h * sy, 0, 0, W, H);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      (bd.meta.trees || []).forEach(([x, top, z, rad], k) => {
        const c = renderer.mapEdit.toImage(x, z, Math.max(0, top - 10));
        if (!c)
          return;
        const [qx, qy] = toScreen(c[0], c[1]), rr = Math.max(8, rad * r.height / view.h);
        const off = F.drop.includes(k);
        g.lineWidth = 3;
        g.strokeStyle = off ? "rgba(160,160,160,0.9)" : "rgba(255,120,190,0.95)";
        g.beginPath();
        g.arc(qx, qy, rr, 0, Math.PI * 2);
        g.stroke();
        if (off) {
          g.beginPath();
          g.moveTo(qx - rr * 0.7, qy - rr * 0.7);
          g.lineTo(qx + rr * 0.7, qy + rr * 0.7);
          g.moveTo(qx + rr * 0.7, qy - rr * 0.7);
          g.lineTo(qx - rr * 0.7, qy + rr * 0.7);
          g.stroke();
        }
      });
    }
    function upload(x0, y0, x1, y1) {
      fillFx(F, x0, y0, x1, y1);
      renderer.mapEdit.upload(F.tex, y0, y1);
      paint(x0, y0, x1, y1);
      blit();
    }
    function emitters() {
      const C = Math.round(40 * sx), out = [];
      for (let cy = 0;cy < fh; cy += C)
        for (let cx = 0;cx < fw; cx += C) {
          let n = 0, m = 0;
          for (let y = cy;y < Math.min(fh, cy + C); y += 2)
            for (let x = cx;x < Math.min(fw, cx + C); x += 2)
              n++, P.petal[y * fw + x] > 127 && m++;
          if (!n || m / n < 0.25)
            continue;
          const g = renderer.mapEdit.toGround((cx + C / 2) / sx, (cy + C / 2) / sy);
          if (g)
            out.push([Math.round(g[0] * 10) / 10, 40, Math.round(g[1] * 10) / 10, 12]);
        }
      return out.slice(0, 40);
    }
    const TL = 64;
    let st = null, dirty = null, raf = 0;
    const tileOf = (tx, ty) => {
      const x0 = tx * TL, y0 = ty * TL, x1 = Math.min(fw, x0 + TL), y1 = Math.min(fh, y0 + TL), o = { tx, ty };
      for (const k in P) {
        o[k] = [];
        for (let y = y0;y < y1; y++)
          o[k].push(P[k].slice(y * fw + x0, y * fw + x1));
      }
      return o;
    };
    const putTile = (o) => {
      const x0 = o.tx * TL, y0 = o.ty * TL;
      for (const k in P)
        o[k].forEach((row, j) => P[k].set(row, (y0 + j) * fw + x0));
    };
    function stamp(ix, iy, Rimg, tool) {
      const gx = ix * sx, gy = iy * sy, R = Rimg * sy;
      const x0 = Math.max(0, Math.floor(gx - R - 1)), x1 = Math.min(fw, Math.ceil(gx + R + 1));
      const y0 = Math.max(0, Math.floor(gy - R - 1)), y1 = Math.min(fh, Math.ceil(gy + R + 1));
      if (x1 <= x0 || y1 <= y0)
        return;
      for (let ty = Math.floor(y0 / TL);ty <= Math.floor((y1 - 1) / TL); ty++)
        for (let tx = Math.floor(x0 / TL);tx <= Math.floor((x1 - 1) / TL); tx++) {
          const k = ty * 1e4 + tx;
          if (!st.tiles.has(k))
            st.tiles.set(k, { before: tileOf(tx, ty) });
        }
      const inner = R * 0.6, plane = { water: P.water, fall: P.fall, petal: P.petal, none: P.none }[tool];
      for (let y = y0;y < y1; y++)
        for (let x = x0, i = y * fw + x0;x < x1; x++, i++) {
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
          if (d >= R)
            continue;
          let t = d <= inner ? 1 : 1 - (d - inner) / (R - inner);
          t = t * t * (3 - 2 * t);
          const v = Math.round(255 * t);
          plane[i] = Math.max(plane[i], v);
          if (tool === "none")
            for (const k of ["water", "fall", "petal"])
              P[k][i] = Math.min(P[k][i], 255 - v);
          else
            P.none[i] = Math.min(P.none[i], 255 - v);
        }
      dirty = dirty ? [Math.min(dirty[0], x0), Math.min(dirty[1], y0), Math.max(dirty[2], x1), Math.max(dirty[3], y1)] : [x0, y0, x1, y1];
      st.box = st.box ? [Math.min(st.box[0], x0), Math.min(st.box[1], y0), Math.max(st.box[2], x1), Math.max(st.box[3], y1)] : [x0, y0, x1, y1];
      if (!raf)
        raf = requestAnimationFrame(flush);
    }
    function flush() {
      raf = 0;
      if (!dirty)
        return;
      const d = dirty;
      dirty = null;
      upload(...d);
    }
    function settlePetals() {
      F.petals = emitters();
      F.drop = (bd.meta.trees || []).flatMap(([x, top, z], k) => {
        const c = renderer.mapEdit.toImage(x, z, Math.max(0, top - 10));
        if (!c)
          return [];
        const i = Math.floor(c[1] * sy) * fw + Math.floor(c[0] * sx);
        return i >= 0 && i < N && P.none[i] > 127 ? [k] : [];
      });
      renderer.mapEdit.refreshPetals();
      blit();
    }
    const snapshot = () => ({ planes: Object.fromEntries(Object.entries(P).map(([k, a]) => [k, a.slice()])), petals: JSON.parse(JSON.stringify(F.petals)), drop: [...F.drop] });
    let opened = snapshot(), saved = opened;
    const restore = (sn) => {
      for (const k in P)
        P[k].set(sn.planes[k]);
      F.petals = JSON.parse(JSON.stringify(sn.petals));
      F.drop = [...sn.drop];
      upload(0, 0, fw, fh);
      renderer.mapEdit.refreshPetals();
    };
    return {
      tools: ["move", "water", "fall", "petal", "none"],
      show(on, c) {
        shown = on;
        colours = c;
        blit();
      },
      blit,
      begin() {
        st = { tiles: new Map, box: null, petals: JSON.parse(JSON.stringify(F.petals)), drop: [...F.drop] };
      },
      stamp,
      end(keep) {
        if (!st)
          return;
        const s0 = st;
        st = null;
        if (raf)
          cancelAnimationFrame(raf), raf = 0;
        flush();
        const tiles = [...s0.tiles.values()];
        if (!tiles.length)
          return;
        if (!keep) {
          tiles.forEach((t) => putTile(t.before));
          upload(...s0.box);
          return;
        }
        for (const t of tiles)
          t.after = tileOf(t.before.tx, t.before.ty);
        settlePetals();
        const after = { petals: JSON.parse(JSON.stringify(F.petals)), drop: [...F.drop] }, box = s0.box;
        const apply = (which, pd) => {
          tiles.forEach((t) => putTile(t[which]));
          F.petals = JSON.parse(JSON.stringify(pd.petals));
          F.drop = [...pd.drop];
          upload(...box);
          renderer.mapEdit.refreshPetals();
        };
        push({ undo: () => apply("before", s0), redo: () => apply("after", after) });
      },
      placePins() {},
      opened: () => restore(opened),
      discard: () => restore(saved),
      async save() {
        const snap = snapshot(), j = packFx(F);
        const r = await fetch(`/api/fxedit?id=${id}`, { method: "POST", body: JSON.stringify(j), headers: EDIT_HEADERS("application/json") });
        if (!r.ok)
          throw new Error(`effects ${r.status}`);
        saved = snap;
      },
      wasSaved: () => saved !== opened,
      rebaseOpened() {
        opened = saved = snapshot();
      }
    };
  })();
  if (gone())
    throw ui.remove(), GONE;
  let colours = true;
  const setView = () => {
    view.h = Math.max(24, Math.min(hMax(), view.h));
    renderer.mapEdit.setView(view);
    layer.placePins();
    if (layer === walkLayer)
      walkLayer.blit();
    if (fxLayer && layer === fxLayer)
      fxLayer.blit();
    drawLines();
  };
  const zoomAt = (clientX, clientY, k) => {
    const r = rect();
    const fx = (clientX - r.left) / r.width - 0.5, fy = (clientY - r.top) / r.height - 0.5;
    const h0 = view.h, w0 = h0 * r.width / r.height;
    view.h = Math.max(24, Math.min(hMax(), h0 * k));
    const w1 = view.h * r.width / r.height;
    view.cx += fx * (w0 - w1);
    view.cy += fy * (h0 - view.h);
    setView();
  };
  let tool = "add", size = 18;
  const setTool = (t) => {
    if (!layer.tools.includes(t))
      t = layer.tools[1];
    tool = t;
    for (const b of ui.querySelectorAll("[data-tool]")) {
      b.classList.toggle("is-on", b.dataset.tool === t);
      b.hidden = !layer.tools.includes(b.dataset.tool);
    }
    layerEl.style.cursor = t === "move" ? "grab" : "none";
    cursor.className = `me-cursor me-c-${t}${mode === "walk" ? " me-walkpen" : ""}`;
    cursor.style.borderColor = { water: "#2cc8ff", fall: "#e8e8ff", petal: "#ff7ab4", none: "#ff4a3d" }[t] || "";
  };
  const setSize = (s) => {
    size = Math.max(2, Math.min(200, Math.round(s)));
    $("[data-sizeval]").textContent = String(size);
    cursor.style.width = cursor.style.height = `${size * 2}px`;
  };
  function setMode(m) {
    mode = m;
    layer = m === "walk" ? walkLayer : m === "fx" ? fxLayer : maskLayer;
    maskLayer.show(m === "mask", colours);
    walkLayer?.show(m === "walk", colours);
    fxLayer?.show(m === "fx", colours);
    for (const b of ui.querySelectorAll("[data-mode]"))
      b.classList.toggle("is-on", b.dataset.mode === m);
    hist = [];
    hpos = savedAt = 0;
    layer.rebaseOpened();
    if (layer.stale)
      savedAt = -1;
    setTool(tool);
    syncHist();
    $("[data-herohere]").hidden = !pieces || m !== "mask";
    pickPiece(0);
    drawLines();
    setStatus(layer.stale ? "Your masks were updated to work like the built-in ones. Press Save to keep that." : m === "walk" ? "Green: where the hero can walk." : m === "fx" ? "Paint where there is moving water, a waterfall or falling sakura petals; No effect takes the map's own away. Pink rings: the trees petals fall from." : pieces ? "Blue covers the hero. In Move, tap a thing to pick it: with a white line it covers him only when he stands behind the line. Drag the hero to try it." : "Blue covers the hero wherever they overlap. Mask adds blue, Clear takes it away.");
  }
  const EP = bd.edit, pieces = !!EP?.pid && !!renderer.mapEdit.toGround;
  const linesEl = $("[data-lines]"), card = $("[data-card]");
  const gsx = EP ? EP.w / info.IW : 1, gsy = EP ? EP.h / info.IH : 1;
  const HERO_H = 19.6;
  const OWN = 40000;
  let outline = null;
  let gest = null;
  const lineOf = (id) => id ? lineOfE(EP, id) : null;
  const clone = (L) => L ? L.map((q) => [q[0], q[1]]) : null;
  const heroFeet = () => {
    const w = world();
    return w ? renderer.mapEdit.toImage(w.player.x, w.player.y, 0) : null;
  };
  const home = pieces && world() ? [world().player.x, world().player.y] : null;
  function pieceAt(ix, iy) {
    const gx = Math.floor(ix * gsx), gy = Math.floor(iy * gsy);
    if (gx < 0 || gy < 0 || gx >= EP.w || gy >= EP.h)
      return 0;
    const p0 = EP.pid[gy * EP.w + gx];
    if (p0)
      return p0;
    const n = new Map;
    const rr = Math.max(5, Math.round(6 * gsx));
    for (let y = Math.max(0, gy - rr);y <= Math.min(EP.h - 1, gy + rr); y++)
      for (let x = Math.max(0, gx - rr);x <= Math.min(EP.w - 1, gx + rr); x++) {
        const q = EP.pid[y * EP.w + x];
        if (q)
          n.set(q, (n.get(q) || 0) + 1);
      }
    let best = 0, bn = 0;
    for (const [q, c] of n)
      if (c > bn)
        best = q, bn = c;
    return best;
  }
  const SPECK = 30;
  function splitPiece(id, ix, iy) {
    const { w, h, pid } = EP;
    const own = [];
    for (let i = 0;i < pid.length; i++)
      if (pid[i] === id)
        own.push(i);
    if (own.length < 2 * SPECK)
      return id;
    const comp = new Int32Array(pid.length).fill(-1), parts = [];
    for (const s of own) {
      if (comp[s] >= 0)
        continue;
      const k = parts.length, list = [s];
      comp[s] = k;
      for (let q = 0;q < list.length; q++) {
        const i = list[q], x = i % w, y = i / w | 0;
        for (let dy = -1;dy <= 1; dy++)
          for (let dx = -1;dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h)
              continue;
            const j = ny * w + nx;
            if (pid[j] === id && comp[j] < 0)
              comp[j] = k, list.push(j);
          }
      }
      parts.push(list);
    }
    const big = parts.filter((p) => p.length >= SPECK);
    if (big.length < 2)
      return id;
    big.sort((a, b) => b.length - a.length);
    const before = [], after = [], L = EP.lines[id] ? clone(EP.lines[id]) : null, made = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const part of big.slice(1)) {
      const nid = EP.next++;
      made.push(nid);
      for (const i of part) {
        before.push(EP.pc[i]);
        after.push(nid);
        const x = i % w, y = i / w | 0;
        if (x < x0)
          x0 = x;
        if (x > x1)
          x1 = x;
        if (y < y0)
          y0 = y;
        if (y > y1)
          y1 = y;
      }
    }
    const idx = big.slice(1).flat();
    const apply = (vals, lines) => {
      idx.forEach((i, n) => EP.pc[i] = vals[n]);
      for (const nid of made)
        lines ? EP.lines[nid] = clone(lines) : delete EP.lines[nid];
      fill(EP, x0, y0, x1 + 1, y1 + 1);
      renderer.mapEdit.upload(EP.pidTex, y0, y1 + 1);
    };
    apply(after, L);
    push({ undo: () => (apply(before, null), pickPiece(id)), redo: () => apply(after, L) });
    const gx = Math.floor(ix * gsx), gy = Math.floor(iy * gsy);
    let best = id, bd2 = Infinity;
    for (const i of own) {
      const d2 = (i % w - gx) ** 2 + ((i / w | 0) - gy) ** 2;
      if (d2 < bd2)
        bd2 = d2, best = pid[i];
    }
    return best;
  }
  function buildOutline() {
    outline = null;
    if (!sel)
      return;
    const { w, h, pid } = EP;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0;y < h; y++) {
      const r = y * w;
      for (let x = 0;x < w; x++)
        if (pid[r + x] === sel) {
          if (x < x0)
            x0 = x;
          if (x > x1)
            x1 = x;
          if (y < y0)
            y0 = y;
          y1 = y;
        }
    }
    if (x1 < 0)
      return;
    x0 = Math.max(0, x0 - 2);
    y0 = Math.max(0, y0 - 2);
    x1 = Math.min(w - 1, x1 + 2);
    y1 = Math.min(h - 1, y1 + 2);
    const W = x1 - x0 + 1, H = y1 - y0 + 1, c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d"), im = g.createImageData(W, H), d = im.data;
    const inP = (x, y) => x >= 0 && y >= 0 && x < w && y < h && pid[y * w + x] === sel;
    for (let y = 0;y < H; y++)
      for (let x = 0;x < W; x++) {
        const gx = x0 + x, gy = y0 + y, a = inP(gx, gy);
        if (a === inP(gx + 1, gy) && a === inP(gx - 1, gy) && a === inP(gx, gy + 1) && a === inP(gx, gy - 1))
          continue;
        const o = (y * W + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = a ? 255 : 16;
        d[o + 3] = a ? 255 : 200;
      }
    g.putImageData(im, 0, 0);
    outline = { c, x0, y0, W, H };
  }
  function drawLines() {
    const r = rect(), dpr = devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (linesEl.width !== W || linesEl.height !== H)
      linesEl.width = W, linesEl.height = H;
    const g = linesEl.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!pieces || mode !== "mask" || !colours)
      return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (outline) {
      const [ax, ay] = toScreen(outline.x0 / gsx, outline.y0 / gsy), [bx, by] = toScreen((outline.x0 + outline.W) / gsx, (outline.y0 + outline.H) / gsy);
      g.imageSmoothingEnabled = false;
      g.drawImage(outline.c, ax, ay, bx - ax, by - ay);
    }
    g.lineCap = g.lineJoin = "round";
    for (const key of [...Object.keys(EP.lines), ...EP.autoLines ? Object.keys(EP.pieces?.guess || {}) : []]) {
      const pts = lineOf(Number(key));
      if (EP.autoLines && Number(key) !== sel)
        continue;
      if (!pts?.length)
        continue;
      const on = Number(key) === sel, sp = pts.map(([x, y]) => toScreen(x, y)), a = sp[0], b = sp[sp.length - 1];
      const ext = Math.max(40, (b[0] - a[0]) * 0.5);
      g.setLineDash([4, 5]);
      g.strokeStyle = "rgba(255, 255, 255, 0.6)";
      g.lineWidth = on ? 2 : 1.5;
      g.beginPath();
      g.moveTo(a[0] - ext, a[1]);
      g.lineTo(a[0], a[1]);
      g.moveTo(b[0], b[1]);
      g.lineTo(b[0] + ext, b[1]);
      g.stroke();
      g.setLineDash([]);
      for (const [lw, col] of [[on ? 6 : 4, "rgba(10, 8, 16, 0.85)"], [on ? 3 : 2, "#ffffff"]]) {
        g.lineWidth = lw;
        g.strokeStyle = col;
        g.beginPath();
        sp.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
        if (sp.length === 1)
          g.lineTo(a[0] + 0.01, a[1]);
        g.stroke();
      }
      if (on)
        sp.forEach(([x, y], k) => {
          g.beginPath();
          g.arc(x, y, k === selDot ? 9 : 7, 0, Math.PI * 2);
          g.fillStyle = k === selDot ? "#ffd447" : "#ffffff";
          g.fill();
          g.lineWidth = 2;
          g.strokeStyle = "rgba(10, 8, 16, 0.9)";
          g.stroke();
        });
    }
    const f = heroFeet();
    if (f) {
      const [x, y] = toScreen(f[0], f[1]);
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = "rgba(10, 8, 16, 0.9)";
      g.stroke();
    }
  }
  function updateCard() {
    card.hidden = !pieces || mode !== "mask" || !sel;
    if (card.hidden)
      return;
    const L = lineOf(sel);
    $("[data-cardtext]").textContent = L ? `This covers him when he stands behind its white line. ${renderer.mapEdit.covers(sel) ? "He is behind it now." : "He is in front of it now."}` : "No line: this covers him wherever they overlap. Add a line to let him walk in front of it too.";
    $("[data-addline]").hidden = !!L;
    $("[data-resetline]").hidden = $("[data-delline]").hidden = !L;
    $("[data-deldot]").hidden = !(L && selDot >= 0 && L.length > 1);
  }
  const laterCard = () => requestAnimationFrame(() => requestAnimationFrame(updateCard));
  function pickPiece(id) {
    if (!pieces)
      return;
    sel = id;
    selDot = -1;
    buildOutline();
    if (sel && !outline)
      sel = 0;
    updateCard();
    drawLines();
  }
  function guessLine(id) {
    const g0 = id < OWN ? EP.pieces?.guess?.[id] : null;
    if (g0?.length)
      return clone(g0);
    if (!outline)
      return null;
    const { x0, y0, W, H } = outline, { w, pid } = EP;
    let lo = -1, sx = 0, n = 0;
    for (let y = y0;y < y0 + H; y++)
      for (let x = x0;x < x0 + W; x++)
        if (pid[y * w + x] === id)
          lo = Math.max(lo, y), sx += x, n++;
    if (!n)
      return null;
    const cx = sx / n;
    let bot = lo;
    for (let y = lo;y >= y0; y--)
      if (pid[y * w + Math.round(cx)] === id) {
        bot = y;
        break;
      }
    return [[cx / gsx, (bot + 1) / gsy]];
  }
  function setLine(id, L) {
    if (L)
      EP.lines[id] = clone(L);
    else if (EP.autoLines)
      EP.lines[id] = [];
    else
      delete EP.lines[id];
    if (selDot >= (L?.length ?? 0))
      selDot = -1;
    drawLines();
    laterCard();
  }
  function lineEdit(id, before, after) {
    setLine(id, after);
    push({ undo: () => setLine(id, before), redo: () => setLine(id, after) });
  }
  const segDist = (x, y, a, b) => {
    const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1)));
    return Math.hypot(a[0] + ex * t - x, a[1] + ey * t - y);
  };
  function hitAt(cx, cy) {
    if (!pieces || mode !== "mask" || !colours)
      return null;
    const r = rect(), x = cx - r.left, y = cy - r.top;
    const L = lineOf(sel), sp = L ? L.map(([a, b]) => toScreen(a, b)) : [];
    for (let k = 0;k < sp.length; k++)
      if (Math.hypot(sp[k][0] - x, sp[k][1] - y) <= 14)
        return { kind: "dot", k };
    const w = world();
    if (w) {
      const f = toScreen(...renderer.mapEdit.toImage(w.player.x, w.player.y, 0)), hd = toScreen(...renderer.mapEdit.toImage(w.player.x, w.player.y, HERO_H));
      const hh = Math.max(14, f[1] - hd[1]);
      if (Math.abs(x - f[0]) <= hh * 0.35 && y >= hd[1] - hh * 0.1 && y <= f[1] + 8)
        return { kind: "hero", off: [f[0] - x, f[1] - y] };
    }
    for (let k = 1;k < sp.length; k++)
      if (segDist(x, y, sp[k - 1], sp[k]) <= 8)
        return { kind: "line", k };
    return null;
  }
  function putHero(ix, iy) {
    const w = world(), g = renderer.mapEdit.toGround(ix, iy);
    if (!w || !g)
      return;
    const o = { x: g[0], y: g[1] };
    w.arena?.keep?.(o, PLAYER.radius + 2);
    w.player.x = o.x;
    w.player.y = o.y;
    renderer.mapEdit.heroMoved();
    drawLines();
    laterCard();
  }
  function dragTo(cx, cy) {
    if ((gest.h.kind === "dot" || gest.h.kind === "line") && sel && !EP.lines[sel] && lineOf(sel))
      EP.lines[sel] = clone(lineOf(sel));
    const h = gest.h, [ix, iy] = toImg(cx, cy), L = lineOf(sel);
    if (h.kind === "dot" && L) {
      L[h.k] = [ix, iy];
      selDot = h.k;
    } else if (h.kind === "line" && L) {
      const [lx, ly] = gest.last;
      for (const q of L)
        q[0] += ix - lx, q[1] += iy - ly;
      gest.last = [ix, iy];
    } else if (h.kind === "hero")
      putHero(...toImg(cx + h.off[0], cy + h.off[1]));
    drawLines();
    laterCard();
  }
  function endGest() {
    const g = gest;
    gest = null;
    if (!g)
      return;
    const L = lineOf(sel);
    if (!g.moved) {
      if (!g.h) {
        const [ix, iy] = toImg(g.x, g.y), id = pieceAt(ix, iy);
        pickPiece(id ? splitPiece(id, ix, iy) : 0);
      } else if (g.h.kind === "dot")
        selDot = g.h.k, updateCard(), drawLines();
      else if (g.h.kind === "line" && L) {
        const [ix, iy] = toImg(g.x, g.y), a = L[g.h.k - 1], b = L[g.h.k];
        const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((ix - a[0]) * ex + (iy - a[1]) * ey) / (ex * ex + ey * ey || 1)));
        const after = clone(L);
        after.splice(g.h.k, 0, [a[0] + ex * t, a[1] + ey * t]);
        selDot = g.h.k;
        lineEdit(sel, g.before, after);
      }
      return;
    }
    if (L && (g.h?.kind === "dot" || g.h?.kind === "line")) {
      const moved = g.h.kind === "dot" ? L[g.h.k] : null;
      L.sort((a, b) => a[0] - b[0]);
      if (moved)
        selDot = L.indexOf(moved);
      lineEdit(sel, g.before, clone(L));
    }
  }
  $("[data-addline]").onclick = () => sel && lineEdit(sel, null, guessLine(sel));
  $("[data-resetline]").onclick = () => {
    if (!sel)
      return;
    if (!EP.autoLines)
      return lineEdit(sel, clone(lineOf(sel)), guessLine(sel));
    const before = EP.lines[sel] ? clone(EP.lines[sel]) : undefined;
    const back = (v) => {
      if (v === undefined)
        delete EP.lines[sel];
      else
        EP.lines[sel] = clone(v);
      drawLines();
      laterCard();
    };
    back(undefined);
    push({ undo: () => back(before), redo: () => back(undefined) });
  };
  $("[data-delline]").onclick = () => sel && (selDot = -1, lineEdit(sel, clone(lineOf(sel)), null));
  $("[data-deldot]").onclick = () => {
    const L = lineOf(sel);
    if (!L || selDot < 0 || L.length < 2)
      return;
    const after = clone(L);
    after.splice(selDot, 1);
    selDot = -1;
    lineEdit(sel, clone(L), after);
  };
  $("[data-cardclose]").onclick = () => pickPiece(0);
  const heroHere = () => pieces && putHero(view.cx, view.cy + view.h * 0.1);
  $("[data-herohere]").onclick = heroHere;
  if (!walkLayer)
    $('[data-mode="walk"]').hidden = true;
  $('[data-mode="fx"]').hidden = !fxLayer;
  setSize(18);
  setMode("mask");
  setView();
  async function settle(what) {
    if (!dirty())
      return true;
    const a = await ask("Save your changes?", `You have changes to the ${mode === "walk" ? "walk area" : mode === "fx" ? "effects" : "masks"} that are not saved. ${what}`, [
      ["save", "Save", "me-primary"],
      ["discard", "Don't save"],
      ["cancel", "Cancel"]
    ]);
    if (a === "cancel")
      return false;
    if (a === "save")
      return doSave();
    layer.discard();
    return true;
  }
  let saving = null;
  function doSave() {
    if (saving)
      return saving.then((ok) => ok && dirty() ? doSave() : ok);
    saving = saveNow().finally(() => saving = null);
    return saving;
  }
  async function saveNow() {
    setStatus("Saving…");
    $("[data-save]").disabled = true;
    const h = hist, at = hpos, mark = hist[at - 1];
    try {
      await layer.save();
      if (hist === h && hist[at - 1] === mark)
        savedAt = at;
      else if (hist === h)
        savedAt = -1;
      syncHist();
      setStatus("Saved. The version before it is kept as a backup.");
      return true;
    } catch (err) {
      console.error("map edit save:", err);
      setStatus("Could not save. Save works only in the game the PC runs (localhost:8083 there, or its Wi-Fi address on a phone at home), not on the live site.");
      syncHist();
      return false;
    }
  }
  const ptrs = new Map;
  let pan = null, pinch = null, spaceDown = false, lastPt = null;
  const penImg = () => size * view.h / rect().height;
  const strokeTo = (clientX, clientY) => {
    const [ix, iy] = toImg(clientX, clientY), R = penImg();
    if (!lastPt) {
      layer.stamp(ix, iy, R, stroke.tool);
      lastPt = [ix, iy];
      return;
    }
    const [lx, ly] = lastPt, L = Math.hypot(ix - lx, iy - ly), step = Math.max(0.5, R * 0.3);
    if (L < step)
      return;
    let s = step;
    for (;s <= L + 0.01; s += step)
      layer.stamp(lx + (ix - lx) * s / L, ly + (iy - ly) * s / L, R, stroke.tool);
    s -= step;
    lastPt = [lx + (ix - lx) * s / L, ly + (iy - ly) * s / L];
  };
  const endStroke = (keep) => {
    if (!stroke)
      return;
    const t = stroke.tool;
    stroke = null;
    lastPt = null;
    layer.end(keep, t);
  };
  layerEl.addEventListener("contextmenu", (e) => e.preventDefault());
  layerEl.addEventListener("dragstart", (e) => e.preventDefault());
  layerEl.addEventListener("pointerdown", (e) => {
    layerEl.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      endStroke(false);
      if (gest)
        gest.moved = true, endGest();
      pan = null;
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (ptrs.size > 2)
      return;
    if (tool === "move" || e.button === 1 || e.button === 2 || spaceDown) {
      if (tool === "move" && e.button === 0 && !spaceDown && pieces) {
        const h = hitAt(e.clientX, e.clientY);
        gest = { x: e.clientX, y: e.clientY, h, moved: false, before: clone(lineOf(sel)), last: toImg(e.clientX, e.clientY) };
        if (h)
          return;
      }
      pan = { x: e.clientX, y: e.clientY };
      layerEl.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0)
      return;
    stroke = { tool };
    layer.begin(tool);
    strokeTo(e.clientX, e.clientY);
  });
  layerEl.addEventListener("pointermove", (e) => {
    const r = rect();
    cursor.hidden = tool === "move" || e.pointerType !== "mouse";
    cursor.style.transform = `translate(${e.clientX - r.left - size}px, ${e.clientY - r.top - size}px)`;
    if (!ptrs.has(e.pointerId))
      return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      view.cx -= (mx - pinch.mx) * view.h / r.height;
      view.cy -= (my - pinch.my) * view.h / r.height;
      if (d > 4 && pinch.d > 4)
        zoomAt(mx, my, pinch.d / d);
      else
        setView();
      pinch = { d, mx, my };
      return;
    }
    if (gest) {
      if (!gest.moved && Math.hypot(e.clientX - gest.x, e.clientY - gest.y) > 5)
        gest.moved = true;
      if (gest.moved && gest.h) {
        dragTo(e.clientX, e.clientY);
        return;
      }
    }
    if (pan) {
      view.cx -= (e.clientX - pan.x) * view.h / r.height;
      view.cy -= (e.clientY - pan.y) * view.h / r.height;
      pan = { x: e.clientX, y: e.clientY };
      setView();
      return;
    }
    if (stroke) {
      const list = e.getCoalescedEvents?.();
      for (const c of list && list.length ? list : [e])
        strokeTo(c.clientX, c.clientY);
    }
  });
  layerEl.addEventListener("pointerup", (e) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2)
      pinch = null;
    if (pan && !ptrs.size) {
      pan = null;
      layerEl.style.cursor = tool === "move" ? "grab" : "none";
    }
    if (stroke && !ptrs.size)
      endStroke(true);
    if (gest && !ptrs.size)
      endGest();
  });
  layerEl.addEventListener("pointercancel", (e) => {
    ptrs.delete(e.pointerId);
    pinch = pan = null;
    endStroke(true);
    if (gest)
      gest.moved = true, endGest();
  });
  layerEl.addEventListener("pointerleave", () => cursor.hidden = true);
  layerEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004));
  }, { passive: false });
  for (const b of ui.querySelectorAll("[data-tool]"))
    b.onclick = () => setTool(b.dataset.tool);
  for (const b of ui.querySelectorAll("[data-mode]"))
    b.onclick = async () => {
      if (b.dataset.mode === mode)
        return;
      if (await settle("You are switching to the other view."))
        setMode(b.dataset.mode);
    };
  for (const b of ui.querySelectorAll("[data-size]"))
    b.onclick = () => setSize(size * (b.dataset.size === "1" ? 1.3 : 0.7692307692307692));
  for (const b of ui.querySelectorAll("[data-zoom]"))
    b.onclick = () => {
      const r = rect();
      if (b.dataset.zoom === "fit") {
        view.cx = info.IW / 2;
        view.cy = info.IH / 2;
        view.h = hMax() / 1.15;
        setView();
      } else
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, b.dataset.zoom === "in" ? 0.6666666666666666 : 1.5);
    };
  $("[data-show]").onclick = () => {
    colours = !colours;
    $("[data-show]").classList.toggle("is-on", colours);
    layer.show(true, colours);
    drawLines();
  };
  $("[data-show]").classList.add("is-on");
  $("[data-undo]").onclick = undo;
  $("[data-redo]").onclick = redo;
  $("[data-undoall]").onclick = async () => {
    const what = mode === "walk" ? "walk area" : mode === "fx" ? "effects" : "masks";
    const a = await ask("Undo all?", `Every change to the ${what} since you opened this view goes back to how it was then.${layer.wasSaved() ? " That includes what you saved since: save again afterwards to keep it that way." : ""}`, [
      ["yes", "Undo all", "me-danger"],
      ["no", "Cancel"]
    ]);
    if (a !== "yes")
      return;
    endStroke(false);
    const savedSince = layer.wasSaved();
    layer.opened();
    hist = [];
    hpos = 0;
    savedAt = savedSince ? -1 : 0;
    syncHist();
    setStatus(savedSince ? "Back to how it was. Not saved yet." : "Back to how it was.");
  };
  $("[data-save]").onclick = () => doSave();
  const onKey = (e) => {
    if (e.target === noteText || !$("[data-modal]").hidden)
      return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z")
      e.preventDefault(), e.shiftKey ? redo() : undo();
    else if ((e.ctrlKey || e.metaKey) && k === "y")
      e.preventDefault(), redo();
    else if ((e.ctrlKey || e.metaKey) && k === "s")
      e.preventDefault(), e.type === "keydown" && !saving && dirty() && doSave();
    else if (k === "[")
      setSize(size / 1.2);
    else if (k === "]")
      setSize(size * 1.2);
    else if (k === " ")
      e.preventDefault(), spaceDown = e.type === "keydown";
    else if (e.type === "keydown" && ["1", "2", "3", "4", "5"].includes(k))
      setTool(layer.tools[Number(k) - 1] || tool);
    else if (e.type === "keydown" && k === "escape")
      noteForm.hidden = true, pickPiece(0);
    else if (e.type === "keydown" && (k === "delete" || k === "backspace") && pieces && selDot >= 0)
      $("[data-deldot]").click();
    else if (e.type === "keydown" && k === "h" && pieces)
      heroHere();
    else
      return;
    e.stopPropagation();
  };
  const onKeyUp = (e) => {
    if (e.key === " ")
      spaceDown = false;
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp, true);
  const onResize = () => setView();
  window.addEventListener("resize", onResize);
  const onLeave = (e) => {
    if (!dirty())
      return;
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", onLeave);
  return {
    dirty,
    save: doSave,
    async close(now = false) {
      endStroke(true);
      if (!now && !await settle("You are leaving the edit mode."))
        return false;
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("beforeunload", onLeave);
      ui.remove();
      const w = world();
      if (home && w) {
        [w.player.x, w.player.y] = home;
        renderer.mapEdit.heroMoved();
      }
      renderer.mapEdit.setView(null);
      maskLayer.show(false, false);
      return true;
    }
  };
}
function computeDepth(E, D, W, H, x0, y0, x1, y1, O = null) {
  const { add, dep } = E;
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(W, x1);
  y1 = Math.min(H, y1);
  let ux0 = x0, ux1 = x1, uy0 = y0, uy1 = y1;
  for (let y = y0;y < y1; y++) {
    let x = x0;
    if (add[y * W + x])
      while (x > 0 && add[y * W + x - 1])
        x--;
    ux0 = Math.min(ux0, x);
    x = x1 - 1;
    if (add[y * W + x])
      while (x < W - 1 && add[y * W + x + 1])
        x++;
    ux1 = Math.max(ux1, x + 1);
  }
  for (let x = x0;x < x1; x++) {
    let y = y0;
    if (add[y * W + x])
      while (y > 0 && add[(y - 1) * W + x])
        y--;
    uy0 = Math.min(uy0, y);
    y = y1 - 1;
    if (add[y * W + x])
      while (y < H - 1 && add[(y + 1) * W + x])
        y++;
    uy1 = Math.max(uy1, y + 1);
  }
  const RW = ux1 - ux0, RH = uy1 - uy0;
  const along = new Float32Array(RW * RH).fill(65535);
  const findO = (row, from, step) => {
    for (let k = from, n = 0;n < 24 && k >= 0 && k < W; k += step, n++)
      if (O.ok[row + k])
        return O.d[row + k];
    return -1;
  };
  const near = (a, b, i0) => {
    let m = 65535;
    for (let k = a;k <= b; k++)
      m = Math.min(m, D[i0 + k]);
    return m;
  };
  for (let y = uy0;y < uy1; y++) {
    const row = y * W;
    let x = ux0;
    while (x < ux1) {
      if (!add[row + x]) {
        x++;
        continue;
      }
      let a = x;
      while (a > 0 && add[row + a - 1])
        a--;
      let b = x;
      while (b < W - 1 && add[row + b + 1])
        b++;
      const Lo = O ? findO(row, a - 1, -1) : -1, Ro = O ? findO(row, b + 1, 1) : -1;
      const useO = Lo >= 0 || Ro >= 0;
      const L = useO ? Lo >= 0 ? Lo : 65535 : a > 0 ? near(Math.max(0, a - 8), a - 1, row) : 65535;
      const R = useO ? Ro >= 0 ? Ro : 65535 : b < W - 1 ? near(b + 1, Math.min(W - 1, b + 8), row) : 65535;
      for (let k = Math.max(a, ux0);k <= Math.min(b, ux1 - 1); k++) {
        let q;
        if (L < 65535 && R < 65535)
          q = b > a ? L + (R - L) * (k - a) / (b - a) : Math.min(L, R);
        else
          q = Math.min(L, R);
        along[(y - uy0) * RW + (k - ux0)] = q;
      }
      x = b + 1;
    }
  }
  for (let x = ux0;x < ux1; x++) {
    let y = uy0;
    while (y < uy1) {
      if (!add[y * W + x]) {
        y++;
        continue;
      }
      let a = y;
      while (a > 0 && add[(a - 1) * W + x])
        a--;
      let b = y;
      while (b < H - 1 && add[(b + 1) * W + x])
        b++;
      let foot = 65535;
      for (let k = b + 1;k <= Math.min(H - 1, b + 3); k++)
        foot = Math.min(foot, D[k * W + x]);
      for (let k = Math.max(a, uy0);k <= Math.min(b, uy1 - 1); k++) {
        const i = k * W + x, j = (k - uy0) * RW + (x - ux0);
        dep[i] = Math.round(Math.min(along[j], foot, D[i], O && O.ok[i] ? O.d[i] : 65535));
      }
      y = b + 1;
    }
  }
  return [ux0, uy0, ux1, uy1];
}
async function decodeDepth(img, flag = false) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const bmp = await createImageBitmap(img, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, w, h).data;
  const d = new Uint16Array(w * h);
  for (let i = 0;i < d.length; i++)
    d[i] = px[i * 4] * 256 + px[i * 4 + 1];
  if (!flag)
    return { w, h, d };
  const ok = new Uint8Array(w * h);
  for (let i = 0;i < ok.length; i++)
    ok[i] = px[i * 4 + 2] > 127 ? 1 : 0;
  return { w, h, d, ok };
}
async function gzip(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}

// site/js/ui/screens.js
function renderBlessing(root, { spec, tier, practice }, onPick) {
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
      ${raw(three.map((b, i) => `<button class="bl-card" data-b="${b.id}" type="button" style="--i:${i}">
              <span class="bl-ic">${iconCanvas(b.icon, 30)}</span>
              <b>${b.name}</b>
              <i>${b.desc}</i>
              <em>${b.long}</em>
            </button>`).join(""))}
    </div>
    <div class="bl-foot">
      <span class="bl-boss">Next: <b>${spec.name}</b>, ${spec.title}${mod.id !== "none" ? ` · ${mod.name}` : ""}</span>
      <button class="btn btn-quiet" data-none type="button">Go without one</button>
    </div>
  </section>`;
  let picking = false;
  for (const el of root.querySelectorAll("[data-b]"))
    el.onclick = () => {
      if (picking)
        return;
      picking = true;
      sfx.open();
      el.classList.add("is-taken");
      setTimeout(() => {
        picking = false;
        el.classList.remove("is-taken");
        onPick(three.find((b) => b.id === el.dataset.b));
      }, 320);
    };
  root.querySelector("[data-none]").onclick = () => picking || (sfx.click(), onPick(null));
}
function renderResult(root, { result, spec, tier, gold, drops, practice, canContinue, nextSpec }, { onNext, onCamp, onTitle, onRetry, onRebless }) {
  const won = result.won;
  const left = result.bossHpLeft / result.bossHpMax;
  const share = shareText({ result, spec, tier, gold, practice });
  const secs = Math.round(result.time);
  root.innerHTML = html`<section class="screen result ${won ? "is-won" : "is-lost"}">
    <div class="rs-card">
      <div class="rs-side">
      <div class="rs-mark"><i class="rs-rays"></i>${raw(won ? BELL_IMG(spec.arena) : LOST_IMG(spec.arena))}</div>
      <div class="rs-kicker">${practice ? won ? "Practice · felled" : "Practice" : won ? "Felled" : "You fell"}</div>
      <h2 class="rs-name">${spec.name}</h2>
      ${won ? html`<p class="rs-line">Down in ${mmss(result.time)}${result.clean ? " — and never touched." : ""}</p>` : html`<p class="rs-line">${Math.ceil(left * 100)}% of ${spec.name} still standing.</p>`}

      <div class="rs-grid">
        <div style="--i:0"><b data-count="${secs}" data-clock>${mmss(result.time)}</b><i>on the clock</i></div>
        <div style="--i:1"><b data-count="${result.damageDealt}">${result.damageDealt}</b><i>damage dealt</i></div>
        <div style="--i:2"><b data-count="${result.hitsTaken}">${result.hitsTaken}</b><i>hits taken</i></div>
        <div style="--i:3"><b data-count="${result.hpLeft != null ? Math.ceil(result.hpLeft) : 0}">${result.hpLeft != null ? Math.ceil(result.hpLeft) : 0}</b><i>health left</i></div>
      </div>
      </div>
      <div class="rs-main">

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
        ${practice && spec?.souls && onRebless ? html`<button class="btn btn-quiet" data-rebless type="button">Pick a blessing</button>` : ""}
        ${!won && !practice ? html`<div class="rs-tomorrow">Your next life is in ${untilNext()}.</div>` : ""}
        <div class="rs-row">
          <button class="btn" data-camp type="button">Camp</button>
          <button class="btn btn-quiet" data-title type="button">The hill</button>
        </div>
      </div>
      </div>
    </div>
  </section>`;
  if (won)
    sfx.bellSmall();
  const $ = (s) => root.querySelector(s);
  $("[data-camp]").onclick = () => (sfx.click(), onCamp());
  $("[data-title]").onclick = () => (sfx.click(), onTitle());
  if ($("[data-next]"))
    $("[data-next]").onclick = () => (sfx.click(), onNext());
  if ($("[data-retry]"))
    $("[data-retry]").onclick = () => (sfx.click(), onRetry());
  if ($("[data-rebless]"))
    $("[data-rebless]").onclick = () => (sfx.click(), onRebless());
  $("[data-copy]").onclick = async () => {
    try {
      await navigator.clipboard.writeText(share);
      $("[data-copy]").textContent = "Copied";
    } catch {
      $("[data-copy]").textContent = "Select it and copy";
    }
    sfx.click();
  };
  const counts = root.querySelectorAll?.("[data-count]") || [];
  if (counts.length && typeof requestAnimationFrame === "function") {
    const t0 = performance.now() + 250;
    const show = (el, v) => el.textContent = el.hasAttribute("data-clock") ? mmss(v) : `${Math.round(v)}${el.dataset.suffix || ""}`;
    const tick = (now) => {
      let going = false;
      counts.forEach((el, i) => {
        const k = Math.min(1, Math.max(0, (now - t0 - i * 90) / 900));
        show(el, Number(el.dataset.count) * (1 - Math.pow(1 - k, 3)));
        if (k < 1)
          going = true;
      });
      if (going && root.isConnected !== false)
        requestAnimationFrame(tick);
    };
    counts.forEach((el) => show(el, 0));
    requestAnimationFrame(tick);
  }
}
var bellFor = (arena, won = true) => `art/ui/bell-${won ? "won" : "lost"}${OWN_BELLS.has(arena) ? `-${arena}` : ""}.webp`;
var OWN_BELLS = new Set(["ash", "salt"]);
var BELL_IMG = (arena) => `<img class="rs-icon rs-bell" src="${bellFor(arena)}" alt="" aria-hidden="true">`;
var LOST_IMG = (arena) => `<img class="rs-icon rs-bell is-cracked" src="${bellFor(arena, false)}" alt="" aria-hidden="true">`;
function shareText({ result, spec, tier, gold, practice }) {
  const save = get();
  const week = weekNumber();
  const numeral = roman(tier) || "?";
  const lap = !practice && weekCleared();
  const felled2 = (t) => lap ? t < tier || t === tier && result.won : felled(t);
  const marks = BOSS_ORDER2.map((_, i) => i + 1).map((t) => felled2(t) ? "\uD83D\uDD14" : t === tier && !result.won ? "\uD83D\uDC80" : "⬛").join("");
  const bar = result.won ? "" : ` · ${Math.ceil(result.bossHpLeft / result.bossHpMax * 100)}% left`;
  return [`Three Bells · week ${week}`, `${marks}  ${spec.name} (${numeral})${bar}`, `⏱ ${mmss(result.time)} · ⚔ ${result.damageDealt}${result.clean ? " · untouched" : ` · ${result.hitsTaken} hits taken`}`].join(`
`);
}
function renderHelp(root, onClose) {
  const touch = isTouchDevice();
  const save = get();
  root.innerHTML = html`<div class="modal" data-modal>
    <div class="modal-box help-box">
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
      ${touch ? html`<div class="help-keys help-touch">${controlsFor("touch", save.settings.hand, settleArms(save.arms).offAct).map(([how, what]) => html`<div><b>${how}</b><span>${what}</span></div>`)}</div>` : html`<div class="help-keys">
            <div><b>WASD</b><span>move</span></div>
            <div><b>Mouse</b><span>aim</span></div>
            <div><b>Click / J</b><span>attack</span></div>
            <div><b>Shift</b><span>roll</span></div>
            <div><b>Space</b><span>jump</span></div>
            <div><b>1 · 2</b><span>your slots</span></div>
            <div><b>Esc</b><span>pause</span></div>
          </div>
          <p class="help-foot">On a phone: the stick is wherever your left thumb lands; the buttons are under your right — the small one jumps.</p>`}
      <button class="btn btn-go" data-close type="button">Got it</button>
    </div>
  </div>`;
  const close = () => (sfx.click(), onClose());
  root.querySelector("[data-close]").onclick = close;
  root.querySelector("[data-modal]").onclick = (e) => {
    if (e.target === e.currentTarget)
      close();
  };
}

// site/js/ui/fight.js
function controlsFor(kind, hand, off = "jump") {
  const offIs = off === "jump" ? "jump — over a low attack" : off === "guard" ? "guard (hold)" : "off-hand attack";
  if (kind === "pad")
    return [["Left stick", "move"], ["Right stick", "aim"], ["A / right trigger", "attack"], ["B / right bumper", "roll"], ["Left bumper", offIs], ["X · Y", "your two slots"]];
  if (kind === "touch")
    return [
      [`${hand === "left" ? "Right" : "Left"} thumb`, "move, wherever it lands; push further to run"],
      ["Aim", "automatic, at the nearest; drag off a button to aim it"],
      ["Big button", "attack"],
      ["The one beside it", "roll"],
      ["The small one by them", offIs],
      ["Two small buttons", "your two slots"]
    ];
  return [["WASD", "move"], ["Mouse", "aim"], ["Left click / J", "attack"], ["Shift / right click", "roll"], ["Space / F / middle click", offIs], ["1 · 2", "your two slots"]];
}
function safeInsets(touchUp, wide, hand = "right") {
  const side = touchUp && wide ? 220 : 0;
  const stick = touchUp && wide ? 120 : 0;
  return { top: 58, right: hand === "left" ? stick : side, bottom: touchUp && !wide ? 215 : 0, left: hand === "left" ? side : stick };
}
var SMOOTH = { 0: { legacy: true }, 4: { texel: 2, upscale: "sharp" }, 5: { texel: 2, msaa: 4, upscale: "sharp" }, 6: { texel: 1, msaa: 4 }, 9: { texel: 0.5 } };
function smoothing() {
  try {
    return SMOOTH[new URLSearchParams(location.search).get("smooth")] || null;
  } catch {
    return null;
  }
}
function runFight(root, opts, onEnd) {
  const { spec, blessing, modifier, loadout, mods, seed, tier, practice, input } = opts;
  ensure();
  root.innerHTML = html`<div class="fight">
    <canvas class="fight-canvas" id="game" aria-label="${spec.name}, ${spec.title}"></canvas>
    <div class="fight-hud" data-hud></div>
    <div class="fight-pad" data-pad></div>
    <div class="fight-over" data-over></div>
  </div>`;
  const canvas = root.querySelector("#game");
  const hudRoot = root.querySelector("[data-hud]");
  const padRoot = root.querySelector("[data-pad]");
  const overRoot = root.querySelector("[data-over]");
  const save = get();
  const world = new World({ boss: spec, blessing, loadout, arms: opts.arms || save.arms, mods, seed, practice, debug: DEBUG, entrance: !opts.phase, quick: !!opts.quick });
  globalThis.__fight = { world, input: opts.input };
  if (opts.phase) {
    const at = spec.phases[Math.min(spec.phases.length - 1, opts.phase)]?.at ?? 1;
    world.boss.hp = Math.max(1, Math.round(world.boss.hpMax * (at - 0.01)));
  }
  if (blessing?.apply)
    blessing.apply(world);
  if (modifier?.apply)
    modifier.apply(world);
  const cam = makeCamera();
  cam.setArena(world.arena);
  cam.bossFrame = world.spec.frame || null;
  globalThis.__fight.cam = cam;
  const rendererOpts = { debug: DEBUG, onCue: (name, arg) => sfx[name]?.(arg), aimPreview: () => input.aimPreview, aa: smoothing(), demoMarks: () => !!save.settings.demo, holdForPrograms: true };
  let canvasEl = canvas;
  let remade = false;
  let viewDead = false;
  const freshCanvas = () => {
    const fresh = document.createElement("canvas");
    fresh.className = canvasEl.className;
    fresh.id = canvasEl.id;
    fresh.setAttribute("aria-label", canvasEl.getAttribute("aria-label") || "");
    canvasEl.replaceWith(fresh);
    canvasEl = fresh;
    return fresh;
  };
  const onFail = () => {
    setTimeout(() => {
      if (!running)
        return;
      if (!ended && world.state === "fight")
        togglePause(true);
      try {
        renderer.destroy?.();
      } catch {}
      const dead = () => {
        viewDead = true;
        warmVeil?.remove();
        warmVeil = null;
        overRoot.insertAdjacentHTML("beforeend", html`<div class="ci-view">The view stopped working on this device. Reload the page to try again.</div>`);
      };
      if (remade)
        return dead();
      remade = true;
      unwatchContext(canvasEl);
      try {
        renderer = opts.makeRenderer(freshCanvas(), { ...rendererOpts, onFail });
        renderer.seedAmbient(spec.arena);
        renderer.fitCamera(cam);
      } catch (err) {
        console.error("3D view: could not be made again", err);
        return dead();
      }
      watchContext(canvasEl);
      contextLost = false;
    }, 0);
  };
  let renderer;
  try {
    renderer = opts.makeRenderer(canvas, { ...rendererOpts, onFail });
  } catch (err) {
    console.error("3D view: could not start", err);
    try {
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {}
    opts.onNoView?.(err);
    return () => {};
  }
  opts.onStart?.();
  globalThis.__fight.view = () => renderer;
  renderer.seedAmbient(spec.arena);
  const hud = mountHud(hudRoot, { spec, modifier, blessing, tier, practice });
  hud.buildHearts(Math.ceil(world.player.hpMax / 20));
  hud.buildSlots(world.player, input.kind === "pad" ? ["X", "Y"] : ["1", "2"]);
  const pad = mountTouch(padRoot, input, padOptions(world.player, loadout, save.settings.hand));
  padRoot.classList.toggle("is-on", input.kind === "touch");
  hudRoot.classList.toggle("is-left", save.settings.hand === "left");
  const padState = { padKind: "" };
  const loop = { acc: 0 };
  let editing = false;
  const editor = mountMapEdit(root.querySelector(".fight"), {
    place: "below",
    world: () => world,
    cam: () => cam,
    renderer: {
      get mapEdit() {
        return renderer.mapEdit;
      },
      get refCrop() {
        return renderer.refCrop;
      }
    },
    onToggle: editToggle({ input, padRoot, pad, loop, setEditing: (on) => editing = on })
  });
  let raf = 0;
  let watchdog = 0;
  let lastFrameAt = performance.now();
  let lastRafAt = performance.now();
  let last = performance.now();
  let running = true;
  let paused = false;
  let ended = false;
  let wasFrozen = false;
  let clock = 0;
  const air = placeOf(spec.arena).ambient;
  if (air)
    startAmbient(air);
  setVoice(spec.id);
  overRoot.innerHTML = html`<div class="card-intro" data-intro ${world.state === "bell" ? raw('style="opacity:0"') : ""}>
    <div class="ci-season">${CONFIG.SEASON}</div>
    <div class="ci-tier">Boss ${roman(tier) || "?"}${practice ? " · practice" : ""}</div>
    <h2 class="ci-name">${spec.name}</h2>
    <div class="ci-title">${spec.title}</div>
    <p class="ci-blurb">${spec.blurb}</p>
    ${modifier && modifier.id !== "none" ? html`<div class="ci-affix"><b>${modifier.name}</b> — ${modifier.desc}</div>` : ""}
  </div>`;
  if (world.state === "bell")
    overRoot.insertAdjacentHTML("beforeend", html`<div class="bell-ask" data-bell>Strike the bell</div>`);
  sfx.open();
  let warmVeil = null;
  if (renderer.warming?.()) {
    root.insertAdjacentHTML("beforeend", html`<div class="modal load3d" data-warm style="animation:none"><div class="modal-box"><p>Setting up the arena…</p><button class="btn btn-quiet" type="button" tabindex="-1" aria-hidden="true" style="visibility:hidden">Cancel</button></div></div>`);
    warmVeil = root.querySelector("[data-warm]");
  }
  function aimForTouch() {
    const p = world.player;
    let best = null;
    let bd = 1e9;
    const consider = (x, y, w) => {
      const d = Math.hypot(x - p.x, y - p.y) * w;
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    };
    if (world.state === "bell" && world.bell)
      consider(world.bell.x, world.bell.y, 1);
    else if (!world.boss.hidden && world.boss.hp > 0)
      consider(world.boss.x, world.boss.y, 1);
    if (world.state === "fight" && world.boss.sealed && world.bell)
      consider(world.bell.x, world.bell.y, 1);
    if (world.chest?.landed && world.chest.openAt == null)
      consider(world.chest.x, world.chest.y, 1);
    for (const a of world.adds)
      if (a.alive)
        consider(a.x, a.y, 1.35);
    input.setTouchAim(best ? Math.atan2(best[1] - p.y, best[0] - p.x) : null);
  }
  function frame(t) {
    if (!running)
      return;
    raf = requestAnimationFrame(frame);
    lastRafAt = performance.now();
    tick(t);
  }
  function tick(t) {
    if (!running)
      return;
    lastFrameAt = t;
    const real = Math.min((t - last) / 1000, MAX_FRAME);
    last = t;
    if (viewDead)
      return;
    if (paused) {
      input.poll(cam, null);
      const resume = input.take("pause") && !ended;
      input.flush();
      if (resume)
        togglePause(false);
      return;
    }
    if (renderer.warming?.())
      return drawStill(renderer, world, cam, clock);
    if (warmVeil) {
      const v = warmVeil;
      warmVeil = null;
      v.style.transition = "opacity 0.25s", v.style.opacity = "0";
      setTimeout(() => v.remove(), 260);
    }
    if (editing)
      return drawStill(renderer, world, cam, clock, Math.min(1, loop.acc / TICK));
    if (contextLost && world.state === "fight" && !ended) {
      togglePause(true);
      return;
    }
    clock += real;
    renderer.fitCamera(cam);
    cam.setInsets(safeInsets(input.kind === "touch", cam.vw >= cam.vh, save.settings.hand));
    input.poll(cam, world.player);
    if (input.kind === "touch")
      aimForTouch();
    let dt = real * (world.state === "lost" || world.state === "won" ? world.slow : 1) * (DEBUG.slow ?? 1);
    if (DEBUG.step) {
      dt = DEBUG.stepOnce ? TICK : 0;
      DEBUG.stepOnce = false;
      loop.acc = 0;
    }
    const stopped = fixedSteps(loop, dt, () => {
      const closed = world.state !== "fight" && world.state !== "bell" && world.state !== "chest";
      const intent = input.consume(world.player, { hold: save.settings.holdToAttack, frozen: world.hitstop > 0 || closed, closed });
      if (isAdminOpen())
        return "break";
      if (intent.pause && !ended) {
        togglePause(true);
        return "return";
      }
      renderer.beforeStep(world);
      const events = world.step(intent, TICK);
      renderer.consume(events, world, cam);
      for (const e of events)
        if (e.t === EV.sfx)
          sfx[e.name]?.();
      for (const e of events) {
        if (e.t === EV.roll)
          sfx.roll();
        if (e.t === EV.jump)
          sfx.jump();
        if (e.t === EV.jumpLand)
          sfx.jumpLand();
        if (e.t === EV.swing && !renderer.cuesHeroSounds)
          sfx.swing();
        if (e.t === EV.hurt) {
          sfx.hurt(e.dmg);
          sfx.hurtVoice();
        }
        if (e.t === EV.bossDeath)
          stopFightMusic(1.5);
        if (e.t === EV.graze)
          sfx.graze();
        if (e.t === EV.flyHover)
          sfx.flyBuzz();
        if (e.t === EV.flyDive)
          sfx.flyDive();
        if (e.t === EV.phase && world.souls && spec.id === "gnasher")
          ambientLevel(0.25, 1.6);
        if (e.t === EV.bossDeath && world.souls && spec.id === "gnasher")
          ambientLevel(1, 4);
      }
      feelView(events, cam, world, save.settings.shake);
      if (world.hitstop > 0.04 && !wasFrozen && FEEL.audio.duck)
        duck(world.hitstop, FEEL.audio.duck);
      wasFrozen = world.hitstop > 0;
      if ((world.state === "won" || world.state === "lost") && !ended)
        finish();
    });
    if (stopped === "return")
      return;
    loop.acc = Math.min(loop.acc, TICK);
    cam.trauma = Math.max(cam.trauma, Math.min(1, world.shakeAmt / SHAKE_MAX) * save.settings.shake);
    const restore = renderer.lerpWorld(world, Math.min(1, loop.acc / TICK));
    try {
      const won = world.state === "won" || world.state === "chest" || world.state === "looted";
      const bz0 = world.boss, arriving = (world.state === "entrance" || world.state === "intro") && world.spec.frameR;
      const bz = arriving ? { ...bz0, r: world.spec.frameR } : bz0, inbound = bz.move?.id === "entrance" && bz.jumpTo ? { ...bz, x: bz.jumpTo[0], y: bz.jumpTo[1] } : bz;
      cam.follow(world.player, won ? world.chest || bz : (bz.hidden || world.state === "bell") && world.bell ? world.bell : inbound, real, world.hazards);
      renderer.parts.step(real);
      renderer.draw(world, cam, clock);
    } finally {
      restore();
    }
    hud.update(world);
    pad.update(world.player);
    followPadKind(padState, input, padRoot, pad, hudRoot);
    const intro = overRoot.querySelector("[data-intro]");
    if (intro) {
      const k = (world.introT ?? world.stateT) / (world.spec?.intro ?? FIGHT.intro);
      if ((world.state === "bell" || world.state === "entrance") && world.introT == null) {
        intro.style.opacity = "0";
      } else if (world.introT != null) {
        intro.style.opacity = String(k < 0.2 ? k / 0.2 : k > 0.82 ? (1 - k) / 0.18 : 1);
      } else if (world.state !== "intro") {
        intro.remove();
      } else {
        intro.style.opacity = String(k < 0.2 ? k / 0.2 : k > 0.82 ? (1 - k) / 0.18 : 1);
      }
    }
    const ask = overRoot.querySelector("[data-bell]");
    const wantAsk = world.state === "bell" || world.state === "fight" && !!world.boss.sealed;
    if (ask && !wantAsk)
      ask.remove();
    else if (!ask && wantAsk)
      overRoot.insertAdjacentHTML("beforeend", html`<div class="bell-ask" data-bell>Strike the bell</div>`);
    const open = overRoot.querySelector("[data-chest]");
    if (world.state === "chest" && !open && world.stateT > 1.2)
      overRoot.insertAdjacentHTML("beforeend", html`<div class="bell-ask chest-ask" data-chest>Strike the chest</div>`);
    if (open && world.state !== "chest")
      open.remove();
    if (world.state === "looted" && world.stateT >= FIGHT.chest.open)
      showResult();
  }
  let settledResult = null;
  function finish() {
    if (ended)
      return;
    ended = true;
    const won = world.state === "won";
    const result = world.result();
    settledResult = result;
    opts.onSettle?.(result, world);
    sfx[won ? "win" : "lose"]();
    hudRoot.classList.add("is-done");
    if (won)
      return;
    input.enabled = false;
    setTimeout(showResult, 2200);
  }
  let shown = false;
  function showResult() {
    if (shown || !running)
      return;
    shown = true;
    input.enabled = false;
    stopDrone();
    stopFightMusic(1);
    padRoot.classList.remove("is-on");
    padRoot.classList.add("is-off");
    pad.release();
    const fightEl = root.querySelector(".fight");
    fightEl.classList.add("is-over");
    const host = document.createElement("div");
    host.className = "fight-result";
    fightEl.append(host);
    onEnd(settledResult, world, host);
  }
  let closeSettings = null;
  function togglePause(on) {
    paused = on;
    input.flush();
    if (!on)
      closeSettings?.();
    root.querySelector(".fight")?.classList.toggle("is-paused", on);
    overRoot.querySelector(".card-pause")?.remove();
    if (on)
      overRoot.insertAdjacentHTML("beforeend", html`<div class="card-pause"><div class="cp-box">
          <img class="cp-bell" src="${bellFor(spec.arena)}" alt="" aria-hidden="true">
          <h2>Paused</h2>
          <div class="cp-rule"></div>
          <p class="cp-note">${practice ? "A practice run. Nothing you do here counts." : "Leaving now counts as a death — the attempt is already spent."}</p>
          <div class="cp-keys">${controlsFor(input.kind, save.settings.hand, world.player.arms.offAct).map(([how, what]) => html`<div><b>${how}</b> ${what}</div>`)}</div>
          <div class="cp-btns">
            <button class="btn btn-go" data-resume type="button">Back to it</button>
            <button class="btn" data-settings type="button">Settings</button>
            <button class="btn btn-quiet" data-quit type="button">Give up</button>
          </div>
        </div></div>`);
    if (on) {
      overRoot.querySelector("[data-resume]").onclick = () => (sfx.click(), togglePause(false));
      overRoot.querySelector("[data-settings]").onclick = () => {
        sfx.click();
        closeSettings = openSettings(document.getElementById("modal"), () => {
          closeSettings = null;
          if (paused && !ended)
            togglePause(true);
        });
      };
      overRoot.querySelector("[data-quit]").onclick = () => {
        sfx.click();
        togglePause(false);
        world.player.hp = 0;
        world.player.dead = true;
        world.setState("lost");
        finish();
      };
    }
  }
  const onResize = () => viewDead || renderer.resize(cam);
  window.addEventListener("resize", onResize);
  const onSettings = () => {
    const left = save.settings.hand === "left";
    padRoot.querySelector(".pad")?.classList.toggle("pad-left", left);
    hudRoot.classList.toggle("is-left", left);
    window.dispatchEvent(new Event("resize"));
  };
  window.addEventListener("tb-settings", onSettings);
  let contextLost = false;
  const onLost = () => {
    contextLost = true;
    if (!ended && !paused && world.state === "fight")
      togglePause(true);
  };
  const onRestored = () => {
    contextLost = false;
  };
  const watchContext = (el) => (el.addEventListener("webglcontextlost", onLost), el.addEventListener("webglcontextrestored", onRestored));
  const unwatchContext = (el) => (el.removeEventListener("webglcontextlost", onLost), el.removeEventListener("webglcontextrestored", onRestored));
  watchContext(canvas);
  const onVis = () => {
    if (document.hidden && !ended && world.state === "fight")
      togglePause(true);
  };
  document.addEventListener("visibilitychange", onVis);
  hud.onPause(() => {
    if (ended || paused)
      return;
    sfx.click();
    togglePause(true);
  });
  const onLeave = (e) => {
    if (ended)
      return;
    e.preventDefault();
    e.returnValue = true;
  };
  if (!practice)
    window.addEventListener("beforeunload", onLeave);
  input.enabled = true;
  raf = requestAnimationFrame((t) => (last = t, frame(t)));
  watchdog = setInterval(() => {
    if (!running || paused || document.hidden)
      return;
    const now = performance.now();
    if (now - lastRafAt > 1000 && now - lastFrameAt > 120)
      tick(now);
  }, 60);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(watchdog);
    stopDrone();
    stopFightMusic(0.5);
    stopAmbient();
    stopMusicCues();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("tb-settings", onSettings);
    closeSettings?.();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("beforeunload", onLeave);
    unwatchContext(canvasEl);
    try {
      renderer.destroy?.();
    } catch {}
    pad.destroy();
    editor.destroy();
    input.enabled = false;
    if (globalThis.__fight?.world === world)
      delete globalThis.__fight;
  };
}

// site/js/ui/camp2.js
var VILLAGE = {
  id: "village",
  tier: 0,
  name: "The Village",
  title: "",
  blurb: "",
  arena: "camp2",
  art: "gnasher",
  hp: 1,
  radius: 1,
  body: 0,
  hurt: [0, 0],
  hitH: 1,
  contact: 0,
  poise: 1,
  moveSpeed: 0,
  gap: [1, 1],
  phases: [{ at: 1, moves: [], gapScale: 1 }],
  moves: {}
};
function renderCamp2(root, { input, makeRenderer, onBack }) {
  ensure();
  root.innerHTML = html`<div class="fight camp2">
    <canvas class="fight-canvas" id="game" aria-label="Camp 2.0: the village"></canvas>
    <div class="fight-pad" data-pad></div>
    <div class="camp2-top">
      <button class="btn btn-quiet camp2-back" data-back type="button">Back</button>
      <div class="camp2-name">Camp 2.0 · the village</div>
    </div>
  </div>`;
  const canvas = root.querySelector("#game");
  const padRoot = root.querySelector("[data-pad]");
  const save = get();
  const world = new World({ boss: VILLAGE, loadout: [null, null], arms: save.arms, seed: 1, practice: true, debug: { god: true, freezeBoss: true, noEnrage: true } });
  world.state = "fight";
  const b = world.boss;
  b.hidden = b.airborne = true;
  b.x = b.y = 1e5;
  const [sx, sy] = world.arena.spawn || [0, 0];
  world.player.x = sx;
  world.player.y = sy;
  world.player.face = Math.PI * 0.25;
  globalThis.__camp2 = { world };
  const cam = makeCamera();
  cam.setArena(world.arena);
  globalThis.__camp2.cam = cam;
  const renderer = makeRenderer(canvas, { debug: {}, onCue: (name, arg) => sfx[name]?.(arg), aa: { texel: 1, msaa: 4 }, holdForPrograms: true });
  globalThis.__camp2.view = () => renderer;
  const pad = mountTouch(padRoot, input, padOptions(world.player, [null, null], save.settings.hand));
  padRoot.classList.toggle("is-on", input.kind === "touch");
  const padState = { padKind: "" };
  startAmbient();
  let raf = 0, last = performance.now(), clock = 0, running = true;
  const loop = { acc: 0 };
  let editing = false;
  const editor = mountMapEdit(root.querySelector(".fight"), {
    renderer,
    world: () => world,
    cam: () => cam,
    onToggle: editToggle({ input, padRoot, pad, loop, setEditing: (on) => editing = on })
  });
  function frame(t) {
    if (!running)
      return;
    raf = requestAnimationFrame(frame);
    const real = Math.min((t - last) / 1000, MAX_FRAME);
    last = t;
    if (editing)
      return drawStill(renderer, world, cam, clock);
    if (renderer.warming?.())
      return drawStill(renderer, world, cam, clock);
    clock += real;
    renderer.fitCamera(cam);
    cam.setInsets({ ...safeInsets(input.kind === "touch", cam.vw >= cam.vh, save.settings.hand), top: 52 });
    input.poll(cam, world.player);
    const stopped = fixedSteps(loop, real, () => {
      const intent = input.consume(world.player, { hold: save.settings.holdToAttack });
      if (intent.pause) {
        leave();
        return "return";
      }
      renderer.beforeStep(world);
      const events = world.step(intent, TICK);
      renderer.consume(events, world, cam);
      for (const e of events) {
        if (e.t === EV.roll)
          sfx.roll();
        if (e.t === EV.jump)
          sfx.jump();
        if (e.t === EV.jumpLand)
          sfx.jumpLand();
        if (e.t === EV.swing && !renderer.cuesHeroSounds)
          sfx.swing();
      }
      world.state = "fight";
    });
    if (stopped === "return")
      return;
    const restore = renderer.lerpWorld(world, loop.acc / TICK);
    try {
      cam.follow(world.player, null, real, []);
      renderer.parts.step(real);
      renderer.draw(world, cam, clock);
    } finally {
      restore();
    }
    pad.update(world.player);
    followPadKind(padState, input, padRoot, pad);
  }
  const leave = () => {
    sfx.click();
    onBack();
  };
  root.querySelector("[data-back]").onclick = leave;
  globalThis.__camp2.tick = (n = 1, mx = 0, my = 0, at = null, extra = null) => {
    running = false;
    renderer.noHold?.();
    if (at)
      [world.player.x, world.player.y] = at;
    for (let i = 0;i < n; i++) {
      const intent = { ...input.consume(world.player, {}), mx, my, ...i === 0 ? extra : null };
      renderer.beforeStep(world);
      renderer.consume(world.step(intent, TICK), world, cam);
      world.state = "fight";
      clock += TICK;
    }
    renderer.fitCamera(cam);
    cam.follow(world.player, null, n * TICK, []);
    renderer.draw(world, cam, clock);
    return [world.player.x, world.player.y];
  };
  globalThis.__camp2.ready = true;
  input.enabled = true;
  raf = requestAnimationFrame((t) => (last = t, frame(t)));
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    stopAmbient();
    try {
      renderer.destroy?.();
    } catch {}
    pad.destroy();
    editor.destroy();
    input.enabled = false;
    delete globalThis.__camp2;
  };
}

// site/js/main.js
var app = document.getElementById("app");
var modal = document.getElementById("modal");
var teardown = () => {};
var input = null;
var practiceTries = 0;
var view3D = null;
var loading3D = null;
var pending3D = false;
var canTell3D = null;
if (RELEASE && typeof window !== "undefined" && window.fetch) {
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => f(stampUrl(u), o);
}
var modsAsked = false;
function askMods3D() {
  if (modsAsked || !MODS3D.length)
    return;
  modsAsked = true;
  for (const href of MODS3D) {
    const l = document.createElement("link");
    l.rel = "modulepreload";
    l.href = href;
    document.head.appendChild(l);
  }
}
var load3dModule = () => {
  askMods3D();
  return RELEASE ? (__preload("fgk75wn7"), import("./three-lib-fgk75wn7.js?v=88e40de-1ff3b19c")).then((t) => (new t.TextureLoader().manager.setURLModifier(stampUrl), __preload("96ecym4y"), import("./load3d-96ecym4y.js?v=88e40de-1ff3b19c"))) : (__preload("96ecym4y"), import("./load3d-96ecym4y.js?v=88e40de-1ff3b19c"));
};
function preload3D(bosses = []) {
  if (!loading3D)
    loading3D = load3dModule().then((m) => m.preload3D()).then((got) => view3D = got).catch((err) => {
      loading3D = null;
      throw err;
    });
  return bosses.length ? load3dModule().then((m) => m.preload3D({ bosses })).then((got) => view3D = got) : loading3D;
}
function needsArena(id) {
  const a = BOSSES2[id]?.arena;
  return !!(a && BACKDROP_ARENAS.has(a) && view3D && !view3D.assets.backdrops?.[a]);
}
var needs3D = (id) => !view3D || view3D.missing(id);
var canPlay = () => canTell3D ??= canView3D();
var NO_VIEW = "This device cannot draw the game: it needs WebGL2, which this browser does not offer.";
function show(fn) {
  teardown();
  teardown = () => {};
  input?.reset();
  stopMusicCues();
  app.innerHTML = "";
  const t = fn(app);
  if (typeof t === "function")
    teardown = t;
  app.scrollTop = 0;
}
function payout(result, tier, practice) {
  if (practice)
    return 0;
  if (result.won) {
    const base = 90 + tier * 70;
    const speed = Math.round(Math.max(0, 1 - result.time / 180) * 60);
    const clean = result.clean ? 70 : result.hitsTaken <= 2 ? 30 : 0;
    return base + speed + clean;
  }
  const got = result.damageDealt / result.bossHpMax;
  return Math.max(8, Math.round(got * (60 + tier * 55)));
}
var classicOn = () => get().settings.classic || new URLSearchParams(location.search).get("classic") === "1";
var specOf = (tier, practice, boss) => {
  const s = practice && boss && BOSSES2[boss] ? BOSSES2[boss] : BOSSES2[BOSS_ORDER2[Math.min(BOSS_ORDER2.length, Math.max(1, tier)) - 1]];
  return practice && classicOn() && CLASSIC2[s.id] ? CLASSIC2[s.id] : s;
};
function dropsFor(tier, practice) {
  if (practice)
    return [];
  const save = get();
  const id = BOSS_ORDER2[tier - 1];
  const item = BOSS_DROPS[id];
  return item && !save.items.includes(item) ? [item] : [];
}
function toTitle() {
  rollOver();
  show((root) => renderTitle(root, {
    onBegin: () => toBlessing(nextTier() || 1, false),
    onCamp: toCamp,
    onCamp2: toCamp2,
    onHelp: () => renderHelp(modal, () => modal.innerHTML = ""),
    onSettings: () => openSettings(modal),
    onPractice: (tier, boss) => toBlessing(tier, true, boss),
    noView: canPlay() ? "" : NO_VIEW
  }));
  if (canPlay())
    preload3D().then(() => preload3D([BOSS_ORDER2[Math.min(BOSS_ORDER2.length, Math.max(1, nextTier() || 1)) - 1]])).catch(() => {});
}
function card(text, { label = "Loading", button = null, onButton = null } = {}) {
  modal.innerHTML = html`<div class="modal load3d" role="dialog" aria-label="${label}">
    <div class="modal-box"><p>${text}</p>${button ? html`<button class="btn btn-quiet" data-cancel type="button">${button}</button>` : ""}</div>
  </div>`;
  if (button)
    modal.querySelector("[data-cancel]").onclick = () => (sfx.click(), onButton());
}
function notice(text) {
  card(text, { label: "Notice", button: "Back", onButton: () => modal.innerHTML = "" });
}
function preloadThen(go, bosses = [], loaded = () => true) {
  if (pending3D)
    return;
  pending3D = true;
  let done = false;
  const what = bosses.length ? "arena" : "garden";
  const close = () => (done = true, pending3D = false, modal.innerHTML = "");
  card(`Setting up the ${what}…`, { button: "Cancel", onButton: close });
  const timer = setTimeout(() => {
    if (done)
      return;
    close();
    notice(`The ${what} is taking too long to load. Check the connection and try again.`);
  }, 20000);
  preload3D(bosses).then(() => {
    if (done)
      return;
    clearTimeout(timer);
    close();
    if (loaded())
      go();
    else
      notice(`The ${what} could not load. Check the connection and try again.`);
  }, () => {
    if (done)
      return;
    clearTimeout(timer);
    close();
    notice(`The ${what} could not load. Check the connection and try again.`);
  });
}
function toCamp() {
  show((root) => renderCamp(root, { onBack: toTitle }));
}
var campLoading = false;
function toCamp2() {
  if (!canPlay())
    return notice(NO_VIEW);
  if (campLoading)
    return;
  campLoading = true;
  card("Walking into the village…");
  load3dModule().then((m) => m.preloadCamp()).then((r) => {
    campLoading = false;
    modal.innerHTML = "";
    show((root) => renderCamp2(root, { input, makeRenderer: r.makeRenderer, onBack: toTitle }));
  }, () => {
    campLoading = false;
    modal.innerHTML = "";
    notice("The village could not load. Check the connection and try again.");
  });
}
function dayMovedOn() {
  const was = get().today.key;
  rollOver();
  if (get().today.key === was)
    return false;
  toTitle();
  return true;
}
function toBlessing(tier, practice, boss = null, more = {}) {
  if (!practice && dayMovedOn())
    return;
  const spec = specOf(tier, practice, boss);
  const picked = get().today.blessing;
  if (!practice && picked)
    return toFight(tier, BLESSINGS[picked] || null, false);
  show((root) => renderBlessing(root, { spec, tier, practice }, (blessing) => {
    if (!practice) {
      if (dayMovedOn())
        return;
      const kept = chooseBlessing(blessing?.id);
      return toFight(tier, BLESSINGS[kept] || null, false);
    }
    toFight(tier, blessing, practice, boss ? { boss, ...more } : { ...more });
  }));
}
var lastPractice = { blessing: null };
function toFight(tier, blessing, practice, extra = {}) {
  const save = get();
  const day = dayNumber();
  const spec = specOf(tier, practice, extra.boss);
  if (!canPlay())
    return notice(NO_VIEW);
  if (!extra.loaded && needs3D(spec.id))
    return preloadThen(() => toFight(tier, blessing, practice, { ...extra, loaded: true }), [spec.id], () => practice || !needsArena(spec.id));
  const modifier = weekModifier(weekNumber(day));
  const seed = practice ? practiceSeed(day, tier, ++practiceTries) : fightSeed(day, tier);
  const mods = blessedMods(playerMods(), blessing, PLAYER.hp);
  if (practice)
    lastPractice = { blessing };
  let settled = null;
  const onSettle = (result) => {
    const gold = payout(result, tier, practice);
    const drops = result.won ? dropsFor(tier, practice) : [];
    if (!practice) {
      if (result.won)
        recordWin(tier, gold, drops);
      else
        recordLoss(tier, gold);
    }
    const more = result.won && tier < BOSS_ORDER2.length && !practice;
    settled = { result, spec, tier, gold, drops, practice, canContinue: more, nextSpec: more ? BOSSES2[BOSS_ORDER2[tier]] : null };
  };
  show((root) => runFight(root, {
    spec,
    blessing,
    modifier: extra.modifier || modifier,
    loadout: save.loadout,
    mods,
    seed,
    tier,
    practice,
    input,
    phase: extra.phase || 0,
    quick: !!extra.quick,
    onSettle,
    makeRenderer: view3D.makeRenderer,
    onStart: () => practice || startFight(tier),
    onNoView: () => (toTitle(), notice("The game's view could not start on this device. Reload the page to try again."))
  }, (_result, _world, host) => toResult(settled, host)));
}
function toResult(info, host = null) {
  const on = (fn) => host ? fn(host) : show(fn);
  on((root) => renderResult(root, info, {
    onNext: () => toBlessing(info.tier + 1, false),
    onCamp: toCamp,
    onTitle: () => {
      if (!info.practice && !info.canContinue)
        endDay({ tier: info.tier, won: info.result.won, time: Math.round(info.result.time) });
      toTitle();
    },
    onRetry: () => info.spec?.souls ? toFight(info.tier, lastPractice.blessing, true, { boss: info.spec.id, quick: true }) : toBlessing(info.tier, true, info.spec?.id),
    onRebless: () => toBlessing(info.tier, true, info.spec?.id, { quick: !!info.spec?.souls })
  }));
}
async function boot() {
  load();
  const save = get();
  setEnabled(save.settings.sound);
  setMusic(save.settings.music);
  window.addEventListener("tb-settings", () => {
    const s = get();
    setEnabled(s.settings.sound);
    setMusic(s.settings.music);
  });
  const bar = document.getElementById("load-bar");
  const what = document.getElementById("load-what");
  await buildArt((k, name) => {
    if (bar)
      bar.style.width = `${Math.round(k * 100)}%`;
    if (what && name)
      what.textContent = name;
  });
  document.getElementById("loading")?.classList.add("is-done");
  setTimeout(() => document.getElementById("loading")?.remove(), 700);
  input = makeInput(document.body);
  input.enabled = false;
  document.body.classList.toggle("is-touch", isTouchDevice());
  const wake = () => (unlock(), window.removeEventListener("pointerdown", wake), window.removeEventListener("keydown", wake));
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
  installAdminKeys();
  setAdminHandlers({ onJump: ({ boss, phase, blessing, modifier }) => toFight(BOSSES2[boss]?.tier || 1, blessing, true, { boss, phase, modifier }) });
  if (new URLSearchParams(location.search).get("camp2") === "1") {
    save.seenHelp = true;
    toCamp2();
    return;
  }
  const pq = new URLSearchParams(location.search).get("practice");
  const practice = Number(pq);
  if (practice >= 1 && practice <= BOSS_ORDER2.length) {
    save.seenHelp = true;
    toFight(practice, null, true);
    return;
  }
  if (pq && BOSSES2[pq]) {
    save.seenHelp = true;
    tryArena(BOSSES2[pq]);
    toFight(BOSSES2[pq].tier || 1, null, true, { boss: pq });
    return;
  }
  toTitle();
  if (!save.seenHelp) {
    save.seenHelp = true;
    persist();
    setTimeout(() => renderHelp(modal, () => modal.innerHTML = ""), 700);
  }
}
boot();
