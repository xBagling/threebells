// The day's blessing. Before the day's first fight you pick one of three, or go without, and the
// pick lasts every fight that day. The three are chosen from the date, so everyone alive that day
// is offered the same choice. It is the one thing that makes the same boss play differently on
// Tuesday than it did on Monday.
export const BLESSINGS = {
  glass: {
    id: "glass",
    name: "Glasscannon",
    icon: "sword",
    desc: "+45% damage, −25% health",
    long: "For the day you already know the fight and just want it over.",
    mods: { dmg: 1.45, hpScale: 0.75 },
  },
  ironhide: {
    id: "ironhide",
    name: "Ironhide",
    icon: "shield",
    desc: "+30% health, −8% speed",
    long: "One more mistake than you would otherwise get.",
    mods: { hpScale: 1.3, speed: 0.92 },
  },
  feather: {
    id: "feather",
    name: "Feather-step",
    icon: "roll",
    desc: "Rolls cost 45% less, and last a little longer",
    long: "More rolls, and a wider window inside each one.",
    mods: { rollCost: 0.55, iFrames: 0.05 },
  },
  thirst: {
    id: "thirst",
    name: "Red Thirst",
    icon: "heart",
    desc: "10% of the damage you deal comes back",
    long: "Rewards staying in, which is exactly when it is hardest to.",
    mods: { lifesteal: 0.1 },
  },
  duellist: {
    id: "duellist",
    name: "Duellist",
    icon: "star",
    desc: "A quarter of your hits land twice",
    long: "Swingy. Some days it wins the fight on its own.",
    mods: { crit: 0.25 },
  },
  fleet: {
    id: "fleet",
    name: "Fleet",
    icon: "dash",
    desc: "+14% speed, stamina back a quarter faster",
    long: "Never the strongest pick, never the wrong one.",
    mods: { speed: 1.14, staminaScale: 1.25 },
  },
  stocked: {
    id: "stocked",
    name: "Well Stocked",
    icon: "potion",
    desc: "+1 charge on both slots, cooldowns 20% shorter",
    long: "Turns two buttons into three.",
    mods: {},
    apply(w) {
      w.player.charges = w.player.charges.map((c) => (c > 0 ? c + 1 : c));
      w.player.cdScale = 0.8;
    },
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
      // +12% of your damage per hit, added rather than compounded: the tenth hit takes you to
      // 2.2×, not 3.1×. Scaled in place so any other damage bonus is kept as it is.
      const n = (p.spite || 0) + 1;
      p.mods.dmg *= (1 + 0.12 * n) / (1 + 0.12 * (n - 1));
      p.spite = n;
      w.say(`Spite ×${n}`);
    },
  },
  patience: {
    id: "patience",
    name: "Patience",
    icon: "book",
    desc: "Stand still for a second and a shield forms",
    long: "Punishes panic. Stand, read the tell, then move.",
    mods: {},
    tick(w, p, dt) {
      // One shield per second of stillness, not one per tick: once a hit has spent any of it,
      // another cannot form for five seconds. (Refilled every tick, standing still made you
      // immune to anything under 30.) Only a hit counts — another shield running out does not.
      if ((p.shieldHits || 0) > (p.patienceHits || 0)) p.patienceCool = 5;
      p.patienceHits = p.shieldHits || 0;
      if (p.patienceCool > 0) p.patienceCool -= dt;
      const still = Math.hypot(p.vx, p.vy) < 12 && p.state !== 3; // 3: mid-swing
      p.patienceT = still ? (p.patienceT || 0) + dt : 0;
      if (p.patienceT > 1 && p.shield < 30 && !(p.patienceCool > 0)) {
        p.shield = 30;
        w.events.push({ t: "shieldUp", x: p.x, y: p.y });
      }
    },
  },
};

export const BLESSING_IDS = Object.keys(BLESSINGS);

/**
 * The hero's mods with a blessing's `mods` folded in. The fight screen and the balance bot both go
 * through this, so a blessing measured by the bots is the blessing the player gets.
 * `baseHp` is the hero's health before any bonus (PLAYER.hp).
 */
export function blessedMods(mods, blessing, baseHp) {
  const out = { ...mods };
  const m = blessing?.mods;
  if (!m) return out;
  if (m.dmg) out.dmg = (out.dmg ?? 1) * m.dmg;
  if (m.speed) out.speed = (out.speed ?? 1) * m.speed;
  if (m.rollCost) out.rollCost = (out.rollCost ?? 1) * m.rollCost;
  if (m.iFrames) out.iFrames = (out.iFrames ?? 0) + m.iFrames;
  if (m.lifesteal) out.lifesteal = (out.lifesteal ?? 0) + m.lifesteal;
  if (m.crit) out.crit = (out.crit ?? 0) + m.crit;
  // A blessing that changes health scales the real total, not a hard-coded hundred.
  if (m.hpScale) out.hp = Math.round((baseHp + (out.hp ?? 0)) * m.hpScale) - baseHp;
  if (m.staminaScale) out.staminaScale = m.staminaScale;
  return out;
}
