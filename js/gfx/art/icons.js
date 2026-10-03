// Icons: hearts, the stamina pip, coins, and one per item and spell you can slot. All hand-drawn,
// never emoji — the house rule from Dusk Hunt onward.
import { canvas, sprite, rows } from "../pixel.js?v=8898846";

const M = {
  r: "R", // deep red
  p: "p", // pink highlight
  k: "Wr", // dark red
  y: "GD",
  Y: "y",
  o: "Gd",
  s: "M3",
  S: "M1",
  b: "BL",
  B: "BK",
  c: "Bl",
  g: "G4",
  G: "GP",
  f: "F4",
  F: "F6",
  e: "F3",
  w: "w",
  q: "mb",
  Q: "q5",
  v: "V",
  V: "q",
  n: "L1",
  N: "L2",
  d: "H2",
  h: "H1",
  z: "AS",
  Z: "AW",
};
const map = (ch) => M[ch] || ch;

const I = {
  // ---- the bar ----
  heart: rows([".KKK.KKK.", "KrrrKrrrK", "KrppKrrrK", "KrpprrrrK", "KrrrrrrrK", ".KrrrrrK.", "..KrrrK..", "...KrK...", "....K...."]),
  heartEmpty: rows([".KKK.KKK.", "KKKKKKKKK", "KK.KK..KK", "KK....K.K", "K.......K", ".K.....K.", "..K...K..", "...K.K...", "....K...."]),
  stamina: rows(["...KK...", "..KYYK..", ".KYyyK..", "KYyyK...", ".KyyYK..", "..KyyYK.", "...KYK..", "...KK..."]),
  coin: rows(["..KKKK..", ".KyyyyK.", "KyYooYyK", "KyoYYoyK", "KyoYYoyK", "KyYooYyK", ".KyyyyK.", "..KKKK.."]),
  bell: rows(["...KK...", "..KyyK..", ".KyYYyK.", "KyYYYYyK", "KyYYYYyK", "KyYYYYyK", "KKKKKKKK", "...KK..."]),
  skull: rows(["..KKKK..", ".KwwwwK.", "KwKwwKwK", "KwKwwKwK", "KwwwwwwK", "KwKwKwwK", ".KwwwwK.", "..K.K.K."]),

  // ---- the two slots you fill yourself ----
  potion: rows(["..KKK...", "..KnK...", ".KKKKK..", "KrrrrrK.", "KrpprrK.", "KrrrrrK.", "KrrrrrK.", ".KKKKK.."]),
  shield: rows([".KKKKKK.", "KsSSSSsK", "KsyYYysK", "KsSyySsK", "KsSSSSsK", ".KsSSsK.", "..KsSK..", "...KK..."]),
  bomb: rows(["....Kf..", "...KFK..", "..KKK...", ".KzzzK..", "KzZzzzK.", "KzzzzzK.", "KzzzzzK.", ".KKKKK.."]),
  dagger: rows(["...KK...", "..KbBK..", "..KbBK..", "..KbBK..", ".KKKKKK.", "..KyyK..", "..KnnK..", "...KK..."]),
  firebolt: rows(["...K....", "..KfK...", ".KfFfK..", "KfFFFfK.", "KfFFFfK.", "KefFFeK.", ".KeffeK.", "..KKK..."]),
  frost: rows(["...K....", ".K.K.K..", "..KQK...", "KKKqKKK.", "..KQK...", ".K.K.K..", "...K....", "........"]),
  dash: rows(["........", "K..K..K.", ".K..K..K", "KKKqQKKK", ".K..K..K", "K..K..K.", "........", "........"]),
  heal: rows(["...KK...", "...KK...", "KKKKKKK.", "KGGGGGK.", "KKKKKKK.", "...KK...", "...KK...", "........"]),
  caltrop: rows(["K..K..K.", ".K.K.K..", "..KsK...", "KKKsKKK.", "..KsK...", ".K.K.K..", "K..K..K.", "........"]),
  lantern: rows(["..KKK...", ".KKKKK..", "KYyyYK..", "KyyyyK..", "KyyyyK..", "KYyyYK..", ".KKKKK..", "..KKK..."]),
  stone: rows([".KKKK...", "KvVVvK..", "KvVVVvK.", "KvVVVvK.", ".KvVvK..", "..KKK...", "........", "........"]),
  horn: rows([".....KK.", "...KKyK.", ".KKyyyK.", "KyyyyK..", "KyyyK...", "KyyK....", ".KK.....", "........"]),

  // ---- screens and buttons ----
  roll: rows(["..KKKK..", ".KhhhhK.", "KhKddKhK", "KhdddhhK", "KhddhhhK", "KhhhhhhK", ".KhhhhK.", "..KKKK.."]),
  sword: rows(["....KK..", "...KbBK.", "..KbBK..", ".KbBK...", "KKbKK...", "KyKK....", "KnK.....", "KK......"]),
  cog: rows(["..K..K..", ".KKKKKK.", "KKsSSsKK", ".KSKKSK.", ".KSKKSK.", "KKsSSsKK", ".KKKKKK.", "..K..K.."]),
  book: rows([".KKKKKK.", "KnNNNNnK", "KnNwwNnK", "KnNwwNnK", "KnNwwNnK", "KnNNNNnK", ".KKKKKK.", "........"]),
  arrowL: rows(["...K....", "..KK....", ".KKKKKK.", "KKKKKKK.", ".KKKKKK.", "..KK....", "...K....", "........"]),
  star: rows(["...K....", "...Y....", "..KYK...", "KKYYYKK.", "..KYK...", "...Y....", "...K....", "........"]),
};

export function buildIcons() {
  const out = {};
  for (const [name, g] of Object.entries(I)) {
    const c = canvas(g[0].length, g.length);
    c.stamp(g, 0, 0, 1, map);
    out[name] = [sprite(c.grid, 0.5, 0.5)];
  }
  return { ui: out };
}

export const ICON_NAMES = Object.keys(I);
