// The Warden's state machine. Everything that makes the character feel good lives here:
//
//  · a roll you are committed to, with a window in the middle where nothing can touch you
//  · swings that plant your feet where you stand, chaining into a three-hit combo
//  · an input buffer, so a press during a recovery still comes out
//  · roll-cancelling out of a swing once the blade has passed, the way Souls games allow
//  · stamina you can run dry, with a longer wait if you do
//
// The sim runs at a fixed 1/60 s. Nothing here reads the clock or the DOM.
import { PLAYER, ARENA, TICK, sweepDir } from "../config.js?v=df092a6";
import { DEFAULT_ARMS, settleArms } from "../content/weapons.js?v=df092a6";

export const STATE = { IDLE: 0, MOVE: 1, ROLL: 2, ATTACK: 3, HURT: 4, DEAD: 5, LOCKED: 6, GUARD: 7, JUMP: 8 };

/** How long after a block the next attack is a guard counter (s), and how much harder it lands. */
export const COUNTER = Object.freeze({ window: 0.6, dmg: 1.35 });

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
    // What he holds (content/weapons.js): the settled arms, the chain the swing under way comes from and which
    // hand struck it ("main", "off"), and the guard counter's window after a block.
    arms: settleArms(DEFAULT_ARMS),
    moveset: PLAYER.combo,
    hand: "main",
    counterT: 0,
    counter: false,
  };
}

/** Arm the hero: { main, off } weapon ids (content/weapons.js); the main chain is ready. */
export function setArms(p, loadout) {
  p.arms = settleArms(loadout || DEFAULT_ARMS);
  p.moveset = p.arms.mainList;
  p.hand = "main";
  p.step = 0;
  p.chain = 0;
  return p.arms;
}

/** The move of the swing under way (or about to be): its timing, reach, shape. */
export const moveOf = (p) => (p.moveset || PLAYER.combo)[Math.min(p.step || 0, (p.moveset || PLAYER.combo).length - 1)];

const rollTotal = PLAYER.roll.time + PLAYER.roll.recover;

/** Can the player start something new right now? */
function actionable(p) {
  if (p.state === STATE.DEAD || p.state === STATE.LOCKED) return false;
  if (p.state === STATE.HURT) return p.t >= (p.hurtFor || PLAYER.hurtTime);
  if (p.state === STATE.ROLL) return p.t >= rollTotal;
  if (p.state === STATE.JUMP) return p.t >= PLAYER.jump.time + PLAYER.jump.recover;
  if (p.state === STATE.ATTACK) return p.t >= swingLen(p);
  return true;
}
/** From the active window of a swing on, a roll may cancel out of it. */
function rollCancelable(p) {
  if (p.state !== STATE.ATTACK) return false;
  const s = moveOf(p);
  return p.t >= s.wind + s.active * 0.5;
}
const swingLen = (p) => {
  const s = moveOf(p);
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
}

function startSwing(p, aim, hand = "main") {
  // The chain goes on within one hand's moves; a press with the other hand starts that hand's chain afresh. A press
  // in the guard counter's window is the main chain's last move, harder (a guard counter).
  const moves = hand === "off" ? p.arms.offList || p.arms.mainList : p.arms.mainList;
  const same = p.hand === hand && p.moveset === moves;
  p.counter = hand === "main" && p.counterT > 0;
  const next = p.counter ? moves.length - 1 : same && p.chain > 0 ? (p.step + 1) % moves.length : 0;
  p.moveset = moves;
  p.hand = hand;
  p.counterT = 0;
  p.step = next;
  p.state = STATE.ATTACK;
  p.t = 0;
  p.anim = 0;
  p.face = aim;
  p.hitThisSwing = new Set();
  p.chain = 0;
  p.chainArmed = false;
  spend(p, moves[next].cost);
  return next;
}

function startGuard(p, aim) {
  p.state = STATE.GUARD;
  p.t = 0;
  p.anim = 0;
  p.face = aim;
  p.step = 0;
  p.chain = 0;
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
  if (p.counterT > 0) p.counterT -= dt;
  for (let i = 0; i < 2; i++) if (p.cooldowns[i] > 0) p.cooldowns[i] = Math.max(0, p.cooldowns[i] - dt);

  // Stamina comes back after a pause, and a little faster once you are above a quarter (slowly behind a raised
  // guard, as in the Souls games).
  if (p.staminaWait > 0) p.staminaWait -= dt;
  else if (p.stamina < p.staminaMax) {
    p.stamina = Math.min(p.staminaMax, p.stamina + PLAYER.staminaRegen * (p.mods.staminaScale || 1) * (p.state === STATE.GUARD ? 0.4 : 1) * dt);
    if (p.exhausted && p.stamina > p.staminaMax * 0.25) p.exhausted = false;
  }

  if (p.state === STATE.DEAD) {
    p.vx *= 0.86;
    p.vy *= 0.86;
    move(p, dt);
    return;
  }

  // Aim always tracks, even mid-swing: the hero keeps their eyes on the boss.
  // With nothing aiming (the phone's auto-aim before the boss is there, keys without the mouse) it is the way
  // he faces: the last aim was kept, and every swing on the bell screen went up the screen. While the stick is pushed it
  // is the way he is steered: mid-swing he keeps facing the cut, so a chain run on through a turn went on swinging the
  // first cut's way (the owner, 2026-10-08, on a phone with nothing about: "the target direction gets stuck. I want it
  // to hit the way im steering").
  const steered = Math.hypot(intent.mx, intent.my) > 0.08 ? Math.atan2(intent.my, intent.mx) : null;
  if (p.state !== STATE.ROLL) p.aim = intent.aim != null ? intent.aim : steered ?? p.face;

  // --- buffer ---------------------------------------------------------------------------------
  if (intent.roll) (p.buffer = "roll"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.attack) (p.buffer = "attack"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.off && p.arms.offAct === "jump") (p.buffer = "jump"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.off && p.arms.offAct !== "guard") (p.buffer = "off"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.slot0) (p.buffer = "slot0"), (p.bufferT = PLAYER.bufferTime);
  else if (intent.slot1) (p.buffer = "slot1"), (p.bufferT = PLAYER.bufferTime);
  if (p.bufferT > 0) p.bufferT -= dt;
  else p.buffer = null;

  const want = p.buffer;
  // (a raised guard is let go of, or dropped for a roll or a swing, at once)
  const free = actionable(p) || p.state === STATE.GUARD;
  const wantGuard = p.arms.offAct === "guard" && !!(intent.offHeld || intent.off);

  // --- start something ------------------------------------------------------------------------
  if (want === "roll" && (free || rollCancelable(p)) && canSpend(p, PLAYER.roll.cost)) {
    p.buffer = null;
    startRoll(p, intent.mx, intent.my);
    out.push({ t: "roll", x: p.x, y: p.y, a: p.rollDir });
  } else if ((want === "attack" || want === "off") && free && canSpend(p, ((want === "off" && p.arms.offList) || p.arms.mainList)[0].cost)) {
    p.buffer = null;
    const step = startSwing(p, p.aim, want === "off" ? "off" : "main");
    out.push({ t: "swing", step, hand: p.hand, x: p.x, y: p.y, a: p.face, counter: p.counter });
  } else if (want === "jump" && free && canSpend(p, PLAYER.jump.cost)) {
    p.buffer = null;
    p.state = STATE.JUMP;
    p.t = 0;
    p.anim = 0;
    spend(p, PLAYER.jump.cost);
    out.push({ t: "jump", x: p.x, y: p.y, a: p.face });
  } else if (wantGuard && !want && actionable(p) && p.state !== STATE.GUARD) {
    startGuard(p, p.aim);
    out.push({ t: "guardUp", x: p.x, y: p.y });
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
  } else if (p.state === STATE.JUMP) {
    // In the air: steered a little slower than on foot, facing where he aims; down again, a beat to land.
    const J = PLAYER.jump;
    if (p.t < J.time) steer(p, intent, dt, J.steer);
    else (p.vx *= 0.7), (p.vy *= 0.7);
    if (Math.hypot(intent.mx, intent.my) > 0.08 && p.t < J.time) p.face = Math.atan2(p.vy, p.vx);
    if (p.t - dt < J.time && p.t >= J.time) out.push({ t: "jumpLand", x: p.x, y: p.y });
    if (p.t >= J.time + J.recover) toGround(p, intent);
  } else if (p.state === STATE.GUARD) {
    // Behind the guard: walking slowly (the shield's or weapon's own pace), facing where he aims; let go, he drops it.
    steer(p, intent, dt, p.arms.guard.speed);
    p.face = p.aim;
    if (!wantGuard) toGround(p, intent);
  } else if (p.state === STATE.ATTACK) {
    const s = moveOf(p);
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
    if (p.t >= swingLen(p)) toGround(p, intent);
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
  const s = moveOf(p);
  if (p.t < s.wind || p.t > s.wind + s.active) return null;
  const k = (p.t - s.wind) / s.active; // 0 → 1 across the swing
  // What the blade swept since the last tick, a0 → a1 (bladeHits): from the previous tick's angle, and on the last
  // live tick on to the cut's end, so no target slips between two ticks (one tick turns it 0.4 rad).
  const k0 = Math.max(0, (p.t - TICK - s.wind) / s.active);
  const k1 = p.t + TICK > s.wind + s.active ? 1 : k;
  const dmg = s.dmg * p.mods.dmg * (p.counter ? COUNTER.dmg : 1);
  const base = { x: p.x, y: p.y, half: s.arc * 0.34, dmg, poise: s.poise * (p.counter ? COUNTER.dmg : 1), step: p.step, k, move: s, hand: p.hand, heavy: s.fx === "heavy" || p.counter };
  if (s.shape === "thrust") {
    // straight out along the facing, the point driving forward: the reach grows to the full range at the end
    const r = (u) => s.range * (0.72 + 0.28 * u);
    return { ...base, a: p.face, a0: p.face, a1: p.face, r: r(k1) };
  }
  // an arc (a slam is a narrow one): from one side of the facing to the other, `sweep` -1 the other way round —
  // the way the sword hand's forehand goes (FORE: from his right to his left with the sword in his right hand)
  const dir = sweepDir(s);
  const from = p.face - (dir * s.arc) / 2;
  const at = (u) => from + dir * s.arc * u;
  const arc = { ...base, a: at(k), a0: at(k0), a1: at(k1), r: s.range };
  // paired: the off hand's blade sweeps the mirror arc at the same time
  if (/^paired/.test(s.pose || "")) {
    const from2 = p.face + (dir * s.arc) / 2;
    const at2 = (u) => from2 - dir * s.arc * u;
    arc.alt = { ...base, a: at2(k), a0: at2(k0), a1: at2(k1), r: s.altRange ?? s.range };
  }
  return arc;
}

// The blade as a strip from the hand out to the tip (swingArc's r, the drawn tip) with its half-width, sampled
// across what it swept this tick. The owner, 2026-10-04: "the sword must hit the actual target's hitbox", not
// connect well outside it — before, a cut counted ±0.65-0.85 rad round the blade against the sim's hit radius
// (the toad's 26 round a body drawn 15-16.6 out).
const BLADE = { from: 2, width: 0.6, stepA: 0.05, stepR: 0.75 };

/** Where the swept blade first touches an ellipse at (x, y), semi-axes `along` (on angle `face`) and `across`
 *  (a circle: along = across), or null. */
export function bladeHits(arc, x, y, along, across = along, face = 0) {
  const da = arc.a1 - arc.a0;
  const na = Math.max(1, Math.ceil(Math.abs(da) / BLADE.stepA));
  const nr = Math.max(1, Math.ceil((arc.r - BLADE.from) / BLADE.stepR));
  const c = Math.cos(face), s = Math.sin(face);
  const fa = along + BLADE.width, fc = across + BLADE.width;
  for (let i = 0; i <= na; i++) {
    const a = arc.a0 + (da * i) / na;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j <= nr; j++) {
      const r = BLADE.from + ((arc.r - BLADE.from) * j) / nr;
      const px = arc.x + ca * r, py = arc.y + sa * r;
      const dx = px - x, dy = py - y;
      const u = (dx * c + dy * s) / fa, v = (-dx * s + dy * c) / fc;
      if (u * u + v * v <= 1) return { x: px, y: py };
    }
  }
  return null;
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
  // Hyper-armour: a great weapon's swing goes on through a hit in its wind-up and live window (the damage still lands).
  const mv = p.state === STATE.ATTACK ? moveOf(p) : null;
  if (mv?.armor && p.t < mv.wind + mv.active && p.hp - dmg > 0) {
    p.hp -= dmg;
    p.iFrames = 0.3;
    p.flash = 0.18;
    out.push({ t: "hurt", x: p.x, y: p.y, dmg, armor: true });
    return true;
  }
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

/** Raise the guard counter's window (a block just landed). */
export const armCounter = (p) => (p.counterT = COUNTER.window);

/** How high he is in a jump, 0..1 of PLAYER.jump.height (a parabola over its time), and whether a low attack passes under. */
export const jumpLift = (p) => (p.state === STATE.JUMP && p.t < PLAYER.jump.time ? 4 * (p.t / PLAYER.jump.time) * (1 - p.t / PLAYER.jump.time) : 0);
export const inAir = (p) => p.state === STATE.JUMP && p.t >= PLAYER.jump.air[0] && p.t < PLAYER.jump.air[1];
