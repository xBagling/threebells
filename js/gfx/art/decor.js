// The things growing on the floor and wandering across it.
//
// These are deliberately *not* baked into the arena picture. A reed painted into the floor is a
// stain; a reed drawn as its own sprite can bend when the wind crosses the arena, and that one
// difference is most of what makes a place feel alive.
//
// Every plant carries a `flex`: how far the wind bends its top. Grass is 1, a stone is 0.
import { canvas, sprite, rows, blob, ell, rng, d4, shadeIdx } from "../pixel.js?v=8898846";

const MAP = {
  k: "K",
  g: "G2", G: "G4", h: "GB",
  e: "e2", E: "e4", l: "g4",
  m: "mb", M: "q5",
  p: "p", P: "PK", y: "Y", o: "O",
  f: "F3", F: "F5", w: "w",
  z: "z2", Z: "z4",
  b: "b1", B: "b3",
  s: "o2", S: "o4",
  d: "D3", D: "D5",
  a: "AS", A: "AW",
};
const map = (ch) => MAP[ch] || ch;
const g = (list) => {
  const r = rows(list);
  const c = canvas(r[0].length, r.length);
  c.stamp(r, 0, 0, 1, map);
  return c.grid;
};

// --- plants ------------------------------------------------------------------------------------
/** A reed: tall, thin, and the most obviously wind-blown thing on the floor. */
function reed(h, shade, seed) {
  const c = canvas(7, h);
  const r = rng(seed);
  for (let b = 0; b < 3 + Math.floor(r() * 3); b++) {
    const x0 = 2 + Math.round((r() - 0.5) * 3);
    const len = h * (0.55 + r() * 0.45);
    const bow = (r() - 0.5) * 2.2;
    for (let t = 0; t < len; t++) {
      const k = t / len;
      c.set(x0 + bow * k * k, h - 1 - t, t > len - 3 ? shade[2] : t % 5 === 0 ? shade[0] : shade[1]);
    }
  }
  return c.grid;
}
/** A tuft of grass: four or five blades from one root. */
function tuft(w, h, shade, seed) {
  const c = canvas(w, h);
  const r = rng(seed);
  for (let b = 0; b < 4 + Math.floor(r() * 3); b++) {
    const x0 = w / 2 + (r() - 0.5) * (w - 2);
    const len = h * (0.5 + r() * 0.5);
    const lean = (x0 - w / 2) * 0.5 + (r() - 0.5);
    for (let t = 0; t < len; t++) {
      const k = t / len;
      c.set(x0 + lean * k, h - 1 - t, t > len - 2 ? shade[2] : shade[t % 3 === 0 ? 0 : 1]);
    }
  }
  return c.grid;
}
/** A flower: a stalk and a head of two or three pixels. */
function flower(h, stem, petal, seed) {
  const c = canvas(5, h);
  const r = rng(seed);
  const bow = (r() - 0.5) * 1.6;
  for (let t = 0; t < h - 2; t++) c.set(2 + bow * (t / h), h - 1 - t, stem);
  const top = 1;
  c.set(2, top, petal[1]);
  c.set(1, top, petal[0]);
  c.set(3, top, petal[0]);
  c.set(2, top + 1, petal[0]);
  if (r() < 0.5) c.set(2, top - 1, petal[1]);
  return c.grid;
}
/** A glowing cap. The bright pixels are picked up by the renderer as their own light. */
function cap(size, seed) {
  const c = canvas(size * 2 + 1, size * 2 + 2);
  const cx = size;
  blob(c, cx, size + 1, size * 0.45, size * 0.9, ["K", "q", "s"], [0, -1], seed); // stalk
  blob(c, cx, size * 0.7, size, size * 0.62, ["mB", "mb", "q4", "q5"], [-0.4, -0.8], seed + 1, 0.1);
  c.set(cx - 1, size * 0.4, "w");
  return c.grid;
}
const KELP = [
  g([".z.", "zZz", ".z.", "zZ.", ".z.", ".zZ", ".z.", "zz."]),
  g(["..z", ".zZ", ".z.", "Zz.", ".z.", ".zZ", ".z.", ".zz"]),
];
const PEBBLE = g([".kk.", "kSSk", "kssk", ".kk."]);
const BONE = g(["..k..", ".kwk.", "kwwwk", ".kwk.", "..k.."]);
/** A tuft of flame rooted in a crack: the ash floor's version of grass. */
function emberTuft(h, seed) {
  const c = canvas(7, h);
  const r = rng(seed);
  for (let b = 0; b < 3; b++) {
    const x0 = 3 + Math.round((r() - 0.5) * 3);
    const len = h * (0.5 + r() * 0.5);
    for (let t = 0; t < len; t++) {
      const k = t / len;
      c.set(x0 + (r() - 0.5) * k * 2, h - 1 - t, k > 0.8 ? "F6" : k > 0.5 ? "F5" : k > 0.2 ? "F4" : "F3");
    }
  }
  return c.grid;
}

// --- critters ------------------------------------------------------------------------------------
const BEETLE = [
  g(["k.k", "kGk", "GhG", "kGk"]),
  g([".k.", "kGk", "GhG", "k.k"]),
];
const FROG = [
  g([".k.k.", "kGyGk", "GGGGG", "kG.Gk"]),
  g(["k...k", "kGyGk", "GGGGG", ".kGk."]),
];
const MINNOW = [
  g([".dd..", "dDDdk", ".dd.."]),
  g(["..dd.", "kdDDd", "..dd."]),
];
const MOTH = [
  g([".w.w.", "wAkAw", ".w.w."]),
  g(["w...w", ".AkA.", "w...w"]),
];
const SPARKFLY = [g(["y"]), g(["w"])];

export function buildDecor() {
  const S = (gr, ay = 1) => sprite(gr, 0.5, ay);
  const NIGHT = ["e1", "e3", "e5"];
  const DRY = ["G1", "G3", "GB"];
  const ASHY = ["AS", "As", "AW"];

  return {
    plant: {
      // name: [sprites], and the flex the dressing layer reads off PLANT_FLEX below.
      reedTall: [reed(22, NIGHT, 1), reed(19, NIGHT, 2), reed(24, NIGHT, 3)].map((x) => S(x)),
      reedShort: [reed(13, NIGHT, 4), reed(11, NIGHT, 5)].map((x) => S(x)),
      grass: [tuft(9, 7, DRY, 6), tuft(11, 6, DRY, 7), tuft(8, 8, DRY, 8)].map((x) => S(x)),
      flower: [flower(9, "g", ["p", "PK"], 9), flower(8, "g", ["Y", "y"], 10), flower(10, "g", ["V", "q"], 11)].map((x) => S(x)),
      cap: [cap(4, 12), cap(3, 13), cap(5, 14)].map((x) => S(x)),
      kelp: KELP.map((x) => S(x)),
      emberTuft: [emberTuft(11, 15), emberTuft(8, 16), emberTuft(14, 17)].map((x) => S(x)),
      pebble: [S(PEBBLE)],
      bone: [S(BONE)],
      ashTuft: [tuft(10, 6, ASHY, 18), tuft(8, 5, ASHY, 19)].map((x) => S(x)),
    },
    critter: {
      beetle: BEETLE.map((x) => S(x, 0.9)),
      frog: FROG.map((x) => S(x, 0.9)),
      minnow: MINNOW.map((x) => S(x, 0.6)),
      moth: MOTH.map((x) => S(x, 0.5)),
      sparkfly: SPARKFLY.map((x) => S(x, 0.5)),
    },
  };
}

/** How far the wind bends each kind. A reed whips; a pebble does not move. */
export const PLANT_FLEX = {
  reedTall: 1.5,
  reedShort: 1.0,
  grass: 0.8,
  flower: 1.2,
  cap: 0.25,
  kelp: 0.9,
  emberTuft: 0.6,
  pebble: 0,
  bone: 0,
  ashTuft: 0.7,
};

/**
 * What grows where, and how much of it.
 *
 * Sparse on purpose. The floor is painted with its own moss and mushrooms already; everything
 * here is *extra*, and its whole job is to be the part that moves. Doubling up turned the arena
 * into a flowerbed and buried the two things a player has to be able to see — the boss and the
 * red shape on the ground.
 */
export const ARENA_PLANTS = {
  bog: [
    ["reedTall", 30, "rim"],
    ["reedShort", 18, "rim"],
    ["grass", 22, "floor"],
    ["flower", 9, "floor"],
    ["pebble", 8, "floor"],
  ],
  ash: [
    ["emberTuft", 10, "floor"],
    ["ashTuft", 16, "floor"],
    ["pebble", 10, "floor"],
    ["bone", 5, "floor"],
  ],
  hall: [
    ["kelp", 22, "rim"],
    ["grass", 8, "rim"],
    ["pebble", 12, "floor"],
    ["bone", 4, "floor"],
  ],
};

/** Which small things wander each arena. */
export const ARENA_CRITTERS = {
  bog: [["frog", 3], ["beetle", 3], ["sparkfly", 10]],
  ash: [["beetle", 2], ["moth", 5], ["sparkfly", 7]],
  hall: [["minnow", 5], ["beetle", 2], ["sparkfly", 6]],
  meadow: [["beetle", 4], ["moth", 5]],
  "meadow-night": [["beetle", 2], ["moth", 3], ["sparkfly", 12]],
};
