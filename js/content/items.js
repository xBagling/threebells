// The two slots you fill yourself. Everything here is unlocked by looting a boss or bought at the
// camp with gold, then dragged into one of the two buttons you carry into a fight.
//
// Nothing here is bought with money, only with gold you earn — the fight has to be the same fight
// for everyone.
import { KIND } from "../sim/hazards.js?v=8898846";
import { PLAYER } from "../config.js?v=8898846";
import { clamp, TAU } from "../util.js?v=8898846";

/**
 * kind:     "potion" (charges, no cooldown to speak of) | "spell" (a cooldown) | "throw"
 * charges:  how many uses a fight, or null for cooldown-only
 * cooldown: seconds
 * cost:     gold at the camp; drops are free
 * unlock:   how you first get it — "start", a boss id, or "shop"
 */
export const ITEMS = {
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
      if (p.hp >= p.hpMax) return false;
      p.hp = Math.min(p.hpMax, p.hp + 42);
      w.floaters.push({ x: p.x, y: p.y - 30, v: "+42", kind: "heal", t: 0 });
      w.events.push({ t: "heal", x: p.x, y: p.y });
      return true;
    },
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
    },
  },
  bomb: {
    id: "bomb",
    name: "Fire Bomb",
    icon: "bomb",
    kind: "throw",
    charges: 3,
    cooldown: 1.0,
    cost: 140,
    unlock: "gnasher",
    sound: "throw",
    desc: "Lobbed. 48 in a wide circle.",
    long: "Lands 70 paces out and takes the adds with it. Mind your own feet.",
    use(w, p) {
      const d = 70;
      w.hazard({ kind: KIND.CIRCLE, x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d, r: 42, tele: 0.55, active: 0.14, fade: 0.3, dmg: 0, tag: "friendlyBoom", friendly: 48 });
      return true;
    },
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
      w.buff("bulwark", 6, null, (ww, pp) => (pp.shield = 0));
      return true;
    },
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
    },
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
      w.buff("frost", 4, (ww) => (ww.slowField = 0.45), (ww) => (ww.slowField = 1));
      return true;
    },
  },
  blink: {
    id: "blink",
    name: "Blink",
    icon: "dash",
    kind: "spell",
    charges: null,
    cooldown: 7,
    cost: 210,
    unlock: "king",
    sound: "blink",
    desc: "Step 96 paces, untouchable.",
    long: "Not faster than a roll — further, and through things a roll cannot cross.",
    use(w, p) {
      const d = 96;
      let nx = p.x + Math.cos(p.aim) * d;
      let ny = p.y + Math.sin(p.aim) * d;
      const r = Math.hypot(nx, ny);
      const lim = 150 - PLAYER.radius - 2;
      if (r > lim) {
        nx = (nx / r) * lim;
        ny = (ny / r) * lim;
      }
      w.events.push({ t: "blink", x: p.x, y: p.y, nx, ny });
      p.x = nx;
      p.y = ny;
      p.iFrames = Math.max(p.iFrames, 0.3);
      return true;
    },
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
    },
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
      w.clip(b, "hurt");
      w.say(`${w.spec.name} reels.`);
      w.shake(9);
      for (const h of w.hazards) if (h.t < h.tele) h.done = true;
      return true;
    },
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
      w.buff(
        "stone",
        6,
        (ww, pp) => (pp.mods.dmg *= 1.7),
        (ww, pp) => (pp.mods.dmg /= 1.7)
      );
      return true;
    },
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
      w.buff(
        "lantern",
        5,
        (ww, pp) => (pp.mods.speed *= 1.25),
        (ww, pp) => (pp.mods.speed /= 1.25)
      );
      return true;
    },
  },
  salve: {
    id: "salve",
    name: "Kelp Salve",
    icon: "heal",
    kind: "potion",
    charges: 1,
    cooldown: 1,
    cost: 160,
    unlock: "king",
    sound: "drink",
    desc: "Heals 30 now and 40 over 8 s.",
    long: "Slower than the flask, and worth more if you drink it before you need it.",
    use(w, p) {
      p.hp = Math.min(p.hpMax, p.hp + 30);
      w.floaters.push({ x: p.x, y: p.y - 30, v: "+30", kind: "heal", t: 0 });
      // …and five a second for the next eight, whether you remember it or not.
      w.buff(
        "salveDrip",
        8,
        (ww, pp) => (pp.regen = (pp.regen || 0) + 5),
        (ww, pp) => (pp.regen = Math.max(0, (pp.regen || 0) - 5))
      );
      return true;
    },
  },
};

export const ITEM_IDS = Object.keys(ITEMS);
export const STARTING_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].unlock === "start");
/** What a boss can drop the first time you beat it. */
export const BOSS_DROPS = { gnasher: "bomb", cinder: "firebolt", king: "blink" };
export const SHOP_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].unlock === "shop" || ITEMS[id].cost > 0);
