// Quality tiers for the 3D view, chosen automatically (docs/3D-PLAN.md 9.4). No player option.
//
//   before the fight   the tier this device settled on last time (localStorage), else High on a
//                      desktop or a many-core high-density phone, Medium on other phones
//   the name card      2.2 s when nothing can be pressed: measure the display's refresh interval
//                      (the median frame gap) and how long frames really take; if the slow ones
//                      (p90) are over the budget, drop a tier before the fight starts — changing
//                      the shadow map size or the lights rebuilds shaders, so only here
//   during the fight   only cheap changes: after 30 frames in a row over 1.25× the budget, cut the
//                      next thing on the list (bloom and its glow pass, then half the shadow map)
//   between fights     after three fights in a row with almost no slow frames, the next fight
//                      starts a tier up (the name card drops it again if that was too much)
//
// Here: the renderer's side of a tier (shadow map size, lanterns lit, bloom). The garden's side
// (grass tufts, flowers, the share of leaf cards) is layout3d.js's TIERS, under the same names.
export const TIERS = {
  low: { shadow: 512, lanterns: 4, bloom: 0, next: null },
  medium: { shadow: 1024, lanterns: 5, bloom: 0.35, next: "low" },
  high: { shadow: 2048, lanterns: 5, bloom: 0.35, next: "medium" },
};
const KEY = "threebells.tier3d";
const CALM = "threebells.tier3dCalm"; // smooth fights in a row since the tier last changed

export function startTier() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && TIERS[saved]) return saved;
  } catch {
    // no storage: decide afresh
  }
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (!coarse) return "high";
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 && (window.devicePixelRatio || 1) >= 3 ? "high" : "medium";
}

export function saveTier(t) {
  try {
    localStorage.setItem(KEY, t);
    localStorage.setItem(CALM, "0");
  } catch {
    // fine: it is only a head start next time
  }
}

/**
 * At the end of a fight: `smooth` if its frames almost never ran slow. Three smooth fights in a
 * row on a lower tier and the next one starts a tier up. Returns the tier saved, or null.
 */
export function afterFight(tier, smooth) {
  try {
    const calm = smooth ? Number(localStorage.getItem(CALM) || 0) + 1 : 0;
    const up = Object.keys(TIERS).find((k) => TIERS[k].next === tier);
    if (calm >= 3 && up) {
      saveTier(up);
      return up;
    }
    localStorage.setItem(CALM, String(calm));
  } catch {
    // no storage: every fight decides afresh anyway
  }
  return null;
}

/**
 * Watches frame times. `frame(now, intro)` once per drawn frame (ms, from performance.now()).
 * Returns what to do: { drop: true } once, at the end of the name card, if the tier is too heavy;
 * { cut: n } during the fight when the n-th free cut is due.
 */
export function makeTierMonitor() {
  const gaps = [];
  let last = null;
  let refresh = 1000 / 60;
  let decided = false;
  let over = 0;
  let cuts = 0;
  let fightFrames = 0;
  let slowFrames = 0;
  return {
    get refreshMs() {
      return refresh;
    },
    /** The fight ran smoothly: at least 600 frames, under 1% of them over 1.25× the budget, no cuts. */
    get smooth() {
      return fightFrames >= 600 && slowFrames < fightFrames * 0.01 && cuts === 0;
    },
    frame(now, intro) {
      const gap = last == null ? null : now - last;
      last = now;
      if (gap == null || gap > 250) return null; // a pause or a hidden tab, not a slow frame
      if (intro) {
        gaps.push(gap);
        return null;
      }
      if (!decided) {
        decided = true;
        if (gaps.length >= 20) {
          const sorted = [...gaps].sort((a, b) => a - b);
          const med = sorted[sorted.length >> 1];
          // Snap to a real refresh rate: 60, 90, 120 or 144 Hz.
          refresh = [1000 / 144, 1000 / 120, 1000 / 90, 1000 / 60].reduce((b, r) => (Math.abs(r - med) < Math.abs(b - med) ? r : b), 1000 / 60);
          const p90 = sorted[Math.floor(sorted.length * 0.9)];
          if (p90 > refresh * 1.5) return { drop: true, refresh, p90 };
        }
        return null;
      }
      fightFrames++;
      if (gap > refresh * 1.25) slowFrames++;
      over = gap > refresh * 1.25 ? over + 1 : 0;
      if (over >= 30) {
        over = 0;
        return { cut: ++cuts };
      }
      return null;
    },
  };
}
