// The Warden's state machine. Everything that makes the character feel good lives here:
//
//  · a roll you are committed to, with a window in the middle where nothing can touch you
//  · swings that plant your feet where you stand, chaining into a three-hit combo
//  · an input buffer, so a press during a recovery still comes out
//  · roll-cancelling out of a swing once the blade has passed, the way Souls games allow
//  · stamina you can run dry, with a longer wait if you do
//
// The sim runs at a fixed 1/60 s. Nothing here reads the clock or the DOM.
import { PLAYER, ARENA, TICK } from "../config.js?v=8898846";
import { clamp, angleDiff, TAU } from "../util.js?v=8898846";

export const STATE = { IDLE: 0, MOVE: 1, ROLL: 2, ATTACK: 3, HURT: 4, DEAD: 5, LOCKED: 6 };

export function makePlayer(mods = {}) {
  return {
    x: 0,
    y: 72, // where you start: south of the middle, well clear of the wall
    vx: 0,
    vy: 0,
    face: -Math.PI / 2, // looking up the screen, at the boss
    aim: -Math.PI / 2,
    state: STATE.IDLE,
    t: 0, // seconds in the current state
    hp: PLAYER.hp + (mods.hp || 0),
    hpMax: PLAYER.hp + (mods.hp || 0),
    stamina: PLAYER.stamina,
    staminaMax: PLAYER.stamina,
    staminaWait: 0,
    exhausted: false,
    iFrames: 0, // seconds of invulnerability left
    step: 0, // which swing of the combo we are on
    chain: 0, // time left to chain the next swing
    hitThisSwing: null, // a Set, so one swing hits a target once
    chainArmed: false, // true once this swing has passed, so the next press chains
    buffer: null, // a queued action
    bufferT: 0,
    anim: 0, // seconds, for picking an animation frame
    rollDir: 0,
    dead: false,
    // Set by items and blessings
    mods: { dmg: 1, speed: 1, rollCost: 1, iFrames: 0, lifesteal: 0, ...mods },
    slots: [null, null], // the two things you brought
    cooldowns: [0, 0],
    charges: [0, 0],
    flash: 0,
    shield: 0, // soaked before health, from the Bulwark and from blessings
    hitLag: 0,
  };
}

const rollTotal = PLAYER.roll.time + PLAYER.roll.recover;

/** Which of the eight compass directions a sprite should use, and whether to mirror it. */
export function facingOf(angle) {
  const a = ((angle % TAU) + TAU) % TAU;
  const oct = Math.round(a / (TAU / 8)) % 8;
  // 0 = right, 2 = down, 4 = left, 6 = up
  if (oct === 2) return { dir: "down", flip: false };
  if (oct === 6) return { dir: "up", flip: false };
  if (oct === 0 || oct === 1 || oct === 7) return { dir: "side", flip: false };
  if (oct === 4 || oct === 3 || oct === 5) return { dir: "side", flip: true };
  return { dir: "down", flip: false };
}

/** Can the player start something new right now? */
function actionable(p) {
  if (p.state === STATE.DEAD || p.state === STATE.LOCKED) return false;
  if (p.state === STATE.HURT) return p.t >= (p.hurtFor || PLAYER.hurtTime);
  if (p.state === STATE.ROLL) return p.t >= rollTotal;
  if (p.state === STATE.ATTACK) return p.t >= swingLen(p.step);
  return true;
}
/** From the active window of a swing on, a roll may cancel out of it. */
function rollCancelable(p) {
  if (p.state !== STATE.ATTACK) return false;
  const s = PLAYER.combo[p.step];
  return p.t >= s.wind + s.active * 0.5;
}
const swingLen = (i) => {
  const s = PLAYER.combo[i];
  return s.wind + s.active + s.recover;
};

function spend(p, cost) {
  p.stamina = Math.max(0, p.stamina - cost);
  p.staminaWait = p.stamina <= 0.5 ? PLAYER.exhaustedDelay : PLAYER.staminaDelay;
  if (p.stamina <= 0.5) p.exhausted = true;
}
const canSpend = (p, cost) => !p.exhausted && p.stamina >= Math.min(cost, 1);

function startRoll(p, dirX, dirY) {
  const moving = Math.hypot(dirX, dirY) > 0.15;
  p.rollDir = moving ? Math.atan2(dirY, dirX) : p.face;
  p.face = p.rollDir;
  p.state = STATE.ROLL;
  p.t = 0;
  p.anim = 0;
  p.step = 0;
  p.chain = 0;
  spend(p, PLAYER.roll.cost * p.mods.rollCost);
  return true;
}

function startSwing(p, aim) {
  const next = p.chain > 0 ? (p.step + 1) % PLAYER.combo.length : 0;
  p.step = next;
  p.state = STATE.ATTACK;
  p.t = 0;
  p.anim = 0;
  p.face = aim;
  p.hitThisSwing = new Set();
  p.chain = 0;
  p.chainArmed = false;
  spend(p, PLAYER.combo[next].cost);
  return next;
}

/**
 * One tick.
 *  intent: { mx, my, aim, attack, roll, slot0, slot1 } — `attack`/`roll` are true on the frame they
 *  were pressed, not while held.
 *  out: a place to push events the renderer and audio react to.
 */
export function stepPlayer(p, intent, dt, world, out) {
  p.t += dt;
  p.anim += dt;
  if (p.iFrames > 0) p.iFrames -= dt;
  if (p.flash > 0) p.flash -= dt;
  if (p.chain > 0) p.chain -= dt;
  for (let i = 0; i < 2; i++) if (p.cooldowns[i] > 0) p.cooldowns[i] = Math.max(0, p.cooldowns[i] - dt);

  // Stamina comes back after a pause, and a little faster once you are above a quarter.
  if (p.staminaWait > 0) p.staminaWait -= dt;
  else if (p.stamina < p.staminaMax) {
    p.stamina = Math.min(p.staminaMax, p.stamina + PLAYER.staminaRegen * (p.mods.staminaScale || 1) * dt);
    if (p.exhausted && p.stamina > p.staminaMax * 0.25) p.exhausted = false;
  }

  if (p.state === STATE.DEAD) {
    p.vx *= 0.86;
    p.vy *= 0.86;
    move(p, dt);
    return;
  }

  // Aim always tracks, even mid-swing: the hero keeps their eyes on the boss.
  if (intent.aim != null && p.state !== STATE.ROLL) p.aim = intent.aim;

  // --- buffer ---------------------------------------------------------------------------------
  if (intent.roll) (p.buffer = "roll"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.attack) (p.buffer = "attack"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.slot0) (p.buffer = "slot0"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.slot1) (p.buffer = "slot1"), (p.bufferT = PLAYER.bufferTime);
  if (p.bufferT > 0) p.bufferT -= dt;
  else p.buffer = null;

  const want = p.buffer;
  const free = actionable(p);

  // --- start something ------------------------------------------------------------------------
  if (want === "roll" && (free || rollCancelable(p)) && canSpend(p, PLAYER.roll.cost)) {
    p.buffer = null;
    startRoll(p, intent.mx, intent.my);
    out.push({ t: "roll", x: p.x, y: p.y, a: p.rollDir });
  } else if (want === "attack" && free && canSpend(p, PLAYER.combo[0].cost)) {
    p.buffer = null;
    const step = startSwing(p, p.aim);
    out.push({ t: "swing", step, x: p.x, y: p.y, a: p.face });
  } else if ((want === "slot0" || want === "slot1") && free) {
    const i = want === "slot0" ? 0 : 1;
    if (world && world.useSlot(i)) {
      p.buffer = null;
      out.push({ t: "slot", i });
    }
  }

  // --- states ---------------------------------------------------------------------------------
  const R = PLAYER.roll;
  if (p.state === STATE.ROLL) {
    if (p.t < R.time) {
      // Position comes from a curve, not from velocity: the distance is always the same.
      const k = R.curve(p.t / R.time) - R.curve(Math.max(0, p.t - dt) / R.time);
      const d = k * R.dist;
      p.vx = (Math.cos(p.rollDir) * d) / dt;
      p.vy = (Math.sin(p.rollDir) * d) / dt;
      const from = R.iFrom - p.mods.iFrames / 2;
      const to = R.iTo + p.mods.iFrames / 2;
      if (p.t >= from && p.t < to) p.iFrames = Math.max(p.iFrames, 0.02);
    } else {
      p.vx *= 0.8;
      p.vy *= 0.8;
    }
    if (p.t >= rollTotal) toGround(p, intent);
  } else if (p.state === STATE.ATTACK) {
    const s = PLAYER.combo[p.step];
    // The stick steers him through the whole swing (the owner: he "should not become limited and
    // stand still while he is attacking"), a little slower while the blade is out, and the swing
    // never pushes him on its own (the owner, earlier: "the character should not move towards the
    // way that he is hitting" — there used to be a short lunge along the facing here). He keeps
    // facing the cut.
    steer(p, intent, dt, p.t < s.wind + s.active ? PLAYER.swingMove : 1);
    // The moment the blade has passed, the next press in the chain becomes legal — which is
    // what makes a three-hit combo feel like one motion rather than three separate swings.
    if (!p.chainArmed && p.t >= s.wind + s.active) {
      p.chainArmed = true;
      p.chain = s.recover + PLAYER.comboWindow;
    }
    if (p.t >= swingLen(p.step)) toGround(p, intent);
  } else if (p.state === STATE.HURT) {
    // (a stagger slides him back further, slowing more gently: a few steps, not a jolt)
    p.vx *= p.hurtFor ? 0.93 : 0.9;
    p.vy *= p.hurtFor ? 0.93 : 0.9;
    if (p.t >= (p.hurtFor || PLAYER.hurtTime)) (p.hurtFor = 0), toGround(p, intent);
  } else {
    // Free movement. How hard the stick is pushed sets the top speed, so a half push walks and a
    // full one runs. A whole push — a key, a stick near its rim, a bot's unit vector — counts as
    // exactly 1, rounding and all, so none of them moves a hair slower than it always did.
    const m = Math.hypot(intent.mx, intent.my);
    steer(p, intent, dt, 1);
    if (m > 0.08) {
      p.state = STATE.MOVE;
      // Face where you are going, unless the mouse is telling you otherwise. (The phone's automatic
      // aim at the nearest enemy is not the player telling him: walking, he faces the way he walks —
      // the owner, 2026-10-03. It still points his swings and throws.)
      if (intent.aim == null || intent.aimAuto) p.face = Math.atan2(intent.my, intent.mx);
      else p.face = p.aim;
    } else {
      p.state = STATE.IDLE;
      // (standing, he faces where the player aims — the mouse, the right stick, a drag — but not the
      // phone's automatic aim at the nearest enemy, which only points his swings and throws)
      if (intent.aim != null && !intent.aimAuto) p.face = p.aim;
    }
  }

  move(p, dt);
}

/** The stick's pull on the velocity, `mul` times the top speed; friction when it is let go. */
function steer(p, intent, dt, mul) {
  const m = Math.hypot(intent.mx, intent.my);
  if (m > 0.08) {
    const push = m > 0.98 ? 1 : m;
    const sp = PLAYER.speed * p.mods.speed * (p.exhausted ? 0.82 : 1) * push * mul;
    const nx = intent.mx / Math.max(1, m);
    const ny = intent.my / Math.max(1, m);
    p.vx += nx * PLAYER.accel * dt;
    p.vy += ny * PLAYER.accel * dt;
    const v = Math.hypot(p.vx, p.vy);
    if (v > sp) {
      p.vx = (p.vx / v) * sp;
      p.vy = (p.vy / v) * sp;
    }
  } else {
    const v = Math.hypot(p.vx, p.vy);
    const drop = PLAYER.friction * dt;
    if (v <= drop) (p.vx = 0), (p.vy = 0);
    else {
      p.vx -= (p.vx / v) * drop;
      p.vy -= (p.vy / v) * drop;
    }
  }
}

function toGround(p, intent) {
  p.state = Math.hypot(intent.mx, intent.my) > 0.08 ? STATE.MOVE : STATE.IDLE;
  p.t = 0;
  p.anim = 0;
}

function move(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const d = Math.hypot(p.x, p.y);
  const lim = ARENA.R - PLAYER.radius - 2;
  if (d > lim) {
    const k = lim / d;
    p.x *= k;
    p.y *= k;
    // Slide along the wall rather than sticking to it.
    const nx = p.x / d;
    const ny = p.y / d;
    const into = p.vx * nx + p.vy * ny;
    if (into > 0) {
      p.vx -= nx * into;
      p.vy -= ny * into;
    }
  }
}

/** The arc a swing sweeps right now, or null if the blade is not out. */
export function swingArc(p) {
  if (p.state !== STATE.ATTACK) return null;
  const s = PLAYER.combo[p.step];
  if (p.t < s.wind || p.t > s.wind + s.active) return null;
  const k = (p.t - s.wind) / s.active; // 0 → 1 across the swing
  const from = p.face - s.arc / 2;
  return { x: p.x, y: p.y, a: from + s.arc * k, half: s.arc * 0.34, r: s.range, dmg: s.dmg * p.mods.dmg, poise: s.poise, step: p.step, k };
}

/** Staggered without being hurt (the boss landing beside him in the bell entrance): pushed back away
 *  from (fromX, fromY) at `speed`, reeling for `time` seconds. */
export function staggerPlayer(p, fromX, fromY, speed, time) {
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
  p.state = STATE.HURT;
  p.t = 0;
  p.anim = 0;
  p.hurtFor = time;
  p.buffer = null;
  p.chain = 0;
}

/** Take a hit. Returns true if it landed. */
export function hurtPlayer(p, dmg, fromX, fromY, out) {
  if (p.iFrames > 0 || p.state === STATE.DEAD) return false;
  p.hp -= dmg;
  p.iFrames = PLAYER.hurtIFrames;
  p.flash = 0.18;
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  p.vx = Math.cos(a) * PLAYER.knockback;
  p.vy = Math.sin(a) * PLAYER.knockback;
  p.hurtFor = 0;
  p.buffer = null;
  p.chain = 0;
  if (p.hp <= 0) {
    p.hp = 0;
    p.state = STATE.DEAD;
    p.dead = true;
    p.t = 0;
    out.push({ t: "death", x: p.x, y: p.y });
  } else {
    p.state = STATE.HURT;
    p.t = 0;
    p.anim = 0;
    out.push({ t: "hurt", x: p.x, y: p.y, dmg });
  }
  return true;
}

export const rollProgress = (p) => (p.state === STATE.ROLL ? clamp(p.t / PLAYER.roll.time, 0, 1) : 0);
export const isInvulnerable = (p) => p.iFrames > 0;
export { angleDiff };
