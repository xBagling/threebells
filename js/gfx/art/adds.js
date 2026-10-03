// The small things bosses send at you: Gnasher's flies, Cinder's embers, and the hands that come
// up through the Drowned King's floor. All tiny, all readable at a glance, all one hit from dead.
import { canvas, sprite, rows, blob, ell, outline, rng } from "../pixel.js?v=8898846";

const MAP = {
  k: "K",
  g: "G2",
  G: "G4",
  y: "Y",
  w: "w",
  v: "q",
  V: "V",
  f: "F3",
  F: "F5",
  e: "F4",
  o: "F6",
  d: "D2",
  D: "D4",
  l: "D6",
  b: "z2",
  s: "AS",
};
const map = (ch) => MAP[ch] || ch;

const g = (list) => {
  const r = rows(list);
  const c = canvas(r[0].length, r.length);
  c.stamp(r, 0, 0, 1, map);
  return c.grid;
};

// A bog fly: fat body, blur of wings, one red eye.
const FLY = [
  g([".v...v.", "Kv.K.vK", ".KgggK.", "KgGGGgK", "KgGyGgK", ".KgggK.", "..KKK.."]),
  g(["vv...vv", ".K.K.K.", ".KgggK.", "KgGGGgK", "KgGyGgK", ".KgggK.", "..KKK.."]),
];

// One of Sister Cinder's embers, still burning and getting brighter.
const EMBER = [
  g(["...K...", "..KfK..", ".KfFfK.", "KfFoFfK", "KfFFFfK", ".KefeK.", "..KKK.."]),
  g(["..K.K..", ".KfKfK.", ".KFoFK.", "KfFoFfK", "KeFFFeK", ".KefeK.", "..KKK.."]),
  g(["...K...", "..KFK..", ".KFoFK.", "KFoooFK", "KfFoFfK", ".KefeK.", "..KKK.."]),
];

// A drowned hand, coming up out of the water.
const HAND = [
  g(["..K.K..", ".KdKdK.", "KdDdDdK", "KdDDDdK", ".KdDDdK", "..KddK.", "...KK.."]),
  g(["K.K.K.K", "KdKdKdK", "KdDdDdK", "KdDDDDK", "KdDDDdK", ".KdddK.", "..KKK.."]),
];

/** A small pop when one of them dies. */
function pop(i, cols) {
  const S = 11;
  const c = canvas(S * 2, S * 2);
  const r = rng(300 + i * 11);
  const R = 3 + i * 3;
  for (let k = 0; k < 10 - i * 2; k++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.6 + r() * 0.6);
    c.set(S + Math.cos(a) * d, S + Math.sin(a) * d, cols[Math.floor(r() * cols.length)]);
    c.set(S + Math.cos(a) * (d - 1), S + Math.sin(a) * (d - 1), cols[0]);
  }
  return c.grid;
}

export function buildAdds() {
  const S = (gr) => sprite(gr, 0.5, 0.86);
  return {
    add: {
      fly: FLY.map(S),
      ember: EMBER.map(S),
      hand: HAND.map(S),
      popGreen: [0, 1, 2].map((i) => sprite(pop(i, ["G2", "G4", "GB"]), 0.5, 0.5)),
      popFire: [0, 1, 2].map((i) => sprite(pop(i, ["F3", "F5", "F6"]), 0.5, 0.5)),
      popWater: [0, 1, 2].map((i) => sprite(pop(i, ["D3", "D5", "D6"]), 0.5, 0.5)),
    },
  };
}
