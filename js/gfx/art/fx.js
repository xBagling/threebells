// Effects: the sword's crescent, hit sparks, roll dust, the things bosses throw, and the small
// pickups that drop. Telegraphs (rings, cones, lanes) are drawn as shapes by the renderer instead —
// they have to stretch and fade, which a sprite can't do.
import { canvas, sprite, rows, blob, outline, rng } from "../pixel.js?v=df092a6";

/**
 * A crescent swipe: an arc of thickness `th` spanning `spread` radians, pointing right. Three
 * frames, each thinner and further out than the last, so a swing widens and thins as it passes.
 */
function crescent(R, spread, th, colours, lead = 0) {
  const S = Math.ceil(R + th + 2);
  const c = canvas(S * 2, S * 2);
  const cx = S;
  const cy = S;
  for (let y = -S; y < S; y++)
    for (let x = -S; x < S; x++) {
      const d = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      if (Math.abs(a) > spread / 2) continue;
      // Taper: thickest in the middle of the sweep, nothing at the tips.
      const edge = Math.abs(a) / (spread / 2);
      const t = th * (1 - edge * edge * 0.75);
      const off = d - R + lead * edge;
      if (Math.abs(off) > t / 2) continue;
      const k = 1 - Math.abs(off) / (t / 2); // 0 at the rim, 1 in the core
      const i = Math.min(colours.length - 1, Math.floor(k * colours.length * (1 - edge * 0.35)));
      c.set(cx + x, cy + y, colours[Math.max(0, i)]);
    }
  return c.grid;
}

/** A round glowing shot with a dark rim, so it reads against any floor. */
function orb(r, colours, seed = 3) {
  const S = Math.ceil(r) + 2;
  const c = canvas(S * 2, S * 2);
  blob(c, S, S, r, r, colours, [-0.4, -0.7], seed, 0.18);
  outline(c, "K", true);
  return c.grid;
}

/** A splash of short lines going out from the middle: the frame a hit lands. */
function spark(n, len, colours, seed) {
  const S = len + 3;
  const c = canvas(S * 2, S * 2);
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const l = len * (0.5 + r() * 0.5);
    for (let t = 1; t < l; t++) c.set(S + Math.cos(a) * t, S + Math.sin(a) * t, colours[Math.min(colours.length - 1, Math.floor((t / l) * colours.length))]);
  }
  return c.grid;
}

/** A puff of dust: a ring of soft blobs that widens and thins over four frames. */
function puff(i, colours) {
  const S = 14;
  const c = canvas(S * 2, S * 2);
  const r = rng(90 + i * 7);
  const R = 3 + i * 3.2;
  for (let k = 0; k < 9 - i; k++) {
    const a = r() * Math.PI * 2;
    const rr = R * (0.7 + r() * 0.5);
    blob(c, S + Math.cos(a) * rr, S + Math.sin(a) * rr * 0.55, 3.4 - i * 0.55, 2.6 - i * 0.45, colours, [-0.3, -0.8], 300 + i * 13 + k);
  }
  return c.grid;
}

// Small things you pick up, all 9–11 px so they read on a busy floor.
const COIN = rows(["..KKK..", ".KyyyK.", "KyGGyK.", "KyGGyK.", "KyGGyK.", ".KyyyK.", "..KKK.."]);
const COIN_MAP = (ch) => ({ y: "GD", G: "Gd" }[ch] || ch);
const HEARTLET = rows([".KK.KK.", "KppKppK", "KpPppPK", "KppppPK", ".KpppK.", "..KpK..", "...K..."]);
const HEART_MAP = (ch) => ({ p: "R", P: "p" }[ch] || ch);
const SHARD = rows(["..K..", ".KsK.", "KsSsK", "KsSsK", ".KsK.", "..K.."]);
const SHARD_MAP = (ch) => ({ s: "mb", S: "q5" }[ch] || ch);
/** The bell: the game's own mark, and what you ring when a boss falls. */
const BELL = rows([
  "...KK...",
  "..KyyK..",
  ".KyGGyK.",
  "KyGGGGyK",
  "KyGGGGyK",
  "KyGGGGyK",
  "KKKKKKKK",
  "...KK...",
]);
const BELL_MAP = (ch) => ({ y: "GD", G: "Gd" }[ch] || ch);

export function buildFx() {
  const grid = (rowsIn, map) => {
    const c = canvas(rowsIn[0].length, rowsIn.length);
    c.stamp(rowsIn, 0, 0, 1, map);
    return c.grid;
  };
  const S = (g) => sprite(g, 0.5, 0.5);

  const steel = ["Bl", "BL", "BK", "w"];
  const bog = ["G2", "G4", "GB", "GP"];
  const fire = ["F2", "F3", "F4", "F5", "F6"];
  const water = ["D2", "D3", "D5", "D6"];

  const out = {
    slash: {
      // Three frames of the player's swing: it leads, peaks, then trails away.
      swing: [crescent(13, 2.1, 5, steel, 2), crescent(16, 2.5, 7, steel, 0), crescent(19, 2.2, 4, ["Bl", "BL", "BK"], -2)],
      // The heavier second swing of the combo.
      heavy: [crescent(15, 2.6, 6, steel, 3), crescent(19, 3.0, 9, steel, 0), crescent(23, 2.6, 5, ["Bl", "BL"], -3)],
    },
    shot: {
      bog: [orb(5, bog, 3), orb(6, bog, 9)],
      ember: [orb(4, fire, 5), orb(5, fire, 15)],
      wave: [orb(5, water, 7), orb(6, water, 17)],
      glob: [orb(8, ["G1", "G2", "G3", "GB"], 23)],
    },
    hit: {
      steel: [spark(9, 7, ["w", "BK", "Bl"], 31), spark(7, 10, ["BK", "Bl", "s1"], 41)],
      flesh: [spark(8, 6, ["R", "r", "Wr"], 51), spark(6, 9, ["r", "Wr"], 61)],
      block: [spark(10, 5, ["y", "Y", "O"], 71)],
    },
    dust: {
      roll: [0, 1, 2, 3].map((i) => puff(i, ["p1", "p2", "p3", "o3"])),
      land: [0, 1, 2, 3].map((i) => puff(i, ["x1", "x2", "x3", "a4"])),
      ash: [0, 1, 2, 3].map((i) => puff(i, ["AS", "As", "AW", "w"])),
    },
    pick: {
      coin: [grid(COIN, COIN_MAP)],
      heart: [grid(HEARTLET, HEART_MAP)],
      shard: [grid(SHARD, SHARD_MAP)],
      bell: [grid(BELL, BELL_MAP)],
    },
  };
  for (const set of Object.values(out)) for (const [k, list] of Object.entries(set)) set[k] = list.map(S);
  return out;
}
