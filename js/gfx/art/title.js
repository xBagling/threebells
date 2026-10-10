// The start screen, painted in pixels at boot: a broken chapel arch on a hill at night, three
// bells hanging in it, and a brazier burning underneath. Pocket Quest's title is a glowing round
// door in a dark wood; this is its harder sibling — same night, same one warm light to walk toward.
//
// The scene is one image. The lights that breathe over it come back as a list of points, so the
// title screen can animate them without redrawing a single pixel.
import { canvas, sprite, canopy, trunk, clump, blob, ell, tufts, rng, d4, shadeIdx, tone } from "../pixel.js?v=df092a6";

const W = 384;
const H = 280;
const NIGHT = ["j1", "j2", "j3", "j4", "j5"];
const BARK = ["k1", "k2", "k3", "k4"];
const GRASS = ["K", "e1", "e1", "e2", "e3"];
const STONE = ["p1", "s5", "s4", "s1", "s2"];
const L = [-0.55, -0.82];

export function buildTitle() {
  const c = canvas(W, H);
  const r = rng(1337);
  const HORIZON = 176; // low enough that the arch and its bells clear the wordmark above them

  // --- sky ------------------------------------------------------------------------------------
  const SKY = ["n1", "n1", "n2", "n2", "n3", "n4"];
  for (let y = 0; y < HORIZON; y++) {
    const t = y / HORIZON;
    for (let x = 0; x < W; x++) c.set(x, y, SKY[shadeIdx(0.08 + t * 0.62 + (d4(x, y * 2) - 0.5) * 0.12, SKY.length, x, y)]);
  }
  const stars = [];
  for (let i = 0; i < 150; i++) {
    const x = Math.round(r() * W);
    const y = Math.round(r() * (HORIZON - 14));
    const bright = r();
    c.set(x, y, bright > 0.85 ? "w" : bright > 0.5 ? "mo" : "bl");
    if (bright > 0.9) stars.push([x, y, bright]);
  }
  // The moon, low and to the right, with a soft halo already in the sky.
  const moon = [300, 40, 15];
  ell(c, moon[0], moon[1], moon[2] + 8, moon[2] + 8, (x, y, d) => {
    if (d < 0.55 || d4(x, y) > (1 - d) * 1.5) return;
    c.set(x, y, "n4");
  });
  ell(c, moon[0], moon[1], moon[2], moon[2], (x, y, d) => c.set(x, y, d > 0.78 ? "q" : "mo"));
  ell(c, moon[0] + 5, moon[1] - 3, 3, 3, (x, y) => c.set(x, y, "q"));
  ell(c, moon[0] - 4, moon[1] + 5, 2, 2, (x, y) => c.set(x, y, "q"));

  // --- far hills --------------------------------------------------------------------------------
  for (let x = 0; x < W; x++) {
    const h = HORIZON - 12 - Math.sin(x * 0.014) * 9 - Math.sin(x * 0.037 + 2) * 5;
    for (let y = Math.round(h); y < HORIZON; y++) c.set(x, y, y < h + 2 ? "n5" : "n2");
  }

  // --- the hill the chapel stands on --------------------------------------------------------------
  const hillTop = (x) => HORIZON + 22 - Math.cos((x / W - 0.5) * 2.3) * 30;
  for (let x = 0; x < W; x++) {
    const top = hillTop(x);
    for (let y = Math.round(top); y < H; y++) {
      const t = (y - top) / (H - top);
      let i = shadeIdx(0.1 + t * 0.44 + (d4(x, y) - 0.5) * 0.2, GRASS.length, x, y);
      c.set(x, y, GRASS[i]);
    }
  }

  // --- the arch ----------------------------------------------------------------------------------
  const AX = 192; // the middle of the arch
  const AY = Math.round(hillTop(AX)); // where it meets the ground
  const piers = [
    [AX - 44, AX - 26],
    [AX + 26, AX + 44],
  ];
  for (const [x0, x1] of piers) {
    for (let y = AY - 96; y < AY + 4; y++)
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / (x1 - x0);
        const rough = d4(x * 2, Math.floor(y / 7)) * 0.3;
        const brick = (Math.floor(y / 7) + Math.floor(x / 6)) % 2 ? 0.06 : 0;
        const v = 0.28 + (1 - u) * 0.46 + rough - brick - (y > AY - 30 ? 0.12 : 0);
        c.set(x, y, STONE[shadeIdx(v, STONE.length, x, y)]);
      }
  }
  // The span: a thick arc between the piers, broken open at the top left.
  for (let a = Math.PI; a <= Math.PI * 2 + 0.02; a += 0.004) {
    for (let k = 0; k < 15; k++) {
      const rr = 44 + k;
      const x = AX + Math.cos(a) * rr;
      const y = AY - 96 + Math.sin(a) * rr * 0.92;
      if (a > Math.PI * 1.1 && a < Math.PI * 1.19 && k > 4) continue; // where the span cracked
      const v = 0.3 + (Math.cos(a) < 0 ? 0.4 : 0.12) + (14 - k) / 40 + (d4(x, y) - 0.5) * 0.2;
      c.set(x, y, STONE[shadeIdx(v, STONE.length, x, y)]);
    }
  }
  // Rubble where the span fell.
  for (let i = 0; i < 26; i++) {
    const x = AX - 84 + r() * 44;
    const y = AY - 4 + r() * 16;
    blob(c, x, y, 2 + r() * 4, 1.5 + r() * 3, ["p1", "s5", "s4", "s1"], L, 800 + i);
  }
  // Moss climbing the stone.
  for (let i = 0; i < 26; i++) {
    const [x0, x1] = piers[i % 2];
    clump(c, x0 + r() * (x1 - x0), AY - 6 - r() * 62, 2 + r() * 3.5, ["j1", "j2", "j3", "j4"], 820 + i, L);
  }

  // --- the three bells ----------------------------------------------------------------------------
  const bells = [];
  const BELL_Y = AY - 92;
  [-24, 0, 24].forEach((ox, i) => {
    const bx = AX + ox;
    const scale = i === 1 ? 1.25 : 1;
    const bw = Math.round(9 * scale);
    const bh = Math.round(11 * scale);
    const by = BELL_Y + (i === 1 ? 6 : 0);
    // The hanger.
    for (let y = BELL_Y - 12; y < by - bh; y++) c.set(bx, y, "o2");
    c.set(bx - 1, by - bh - 1, "o3");
    c.set(bx + 1, by - bh - 1, "o3");
    // The bell: a dome flaring to a lip, in old bronze.
    for (let y = -bh; y <= 0; y++) {
      const t = (y + bh) / bh;
      const half = Math.round(bw * (0.42 + t * t * 0.58));
      for (let x = -half; x <= half; x++) {
        const u = x / Math.max(1, half);
        const v = 0.3 - u * 0.36 + (1 - t) * 0.12 + (d4(bx + x, by + y) - 0.5) * 0.14;
        c.set(bx + x, by + y, ["Cr", "Gd", "GD", "y"][Math.max(0, shadeIdx(v, 4, bx + x, by + y))]);
      }
      if (y === 0) for (let x = -half - 1; x <= half + 1; x++) c.set(bx + x, by + 1, "K");
    }
    for (let x = -bw; x <= bw; x++) c.set(bx + x, by, "Cr");
    c.set(bx, by + 2, "K");
    c.set(bx, by + 3, "Cr");
    bells.push([bx, by - bh / 2, bw]);
  });

  // --- the brazier, the one warm thing --------------------------------------------------------------
  const BRZ = [AX, AY + 10];
  blob(c, BRZ[0], BRZ[1] + 6, 11, 4, ["p1", "s5", "s4"], L, 900);
  for (let y = 0; y < 9; y++) for (let x = -8 + Math.floor(y / 2); x <= 8 - Math.floor(y / 2); x++) c.set(BRZ[0] + x, BRZ[1] + 4 - y, y > 6 ? "s4" : "s5");
  for (let y = 0; y < 10; y++) c.set(BRZ[0] - 9 + (y % 2), BRZ[1] + 5 + Math.floor(y / 3), "s5");
  blob(c, BRZ[0], BRZ[1] - 8, 8, 7, ["F2", "F3", "F4", "F5", "F6"], [0, -0.3], 910, 0.35);
  blob(c, BRZ[0], BRZ[1] - 13, 4, 5, ["F4", "F5", "F6", "w"], [0, -0.4], 911, 0.4);
  // Light spilling onto the grass and up the piers.
  ell(c, BRZ[0], BRZ[1] + 12, 42, 14, (x, y, d) => {
    if (d4(x * 3, y * 3) > (1 - d) * 0.6) return;
    const cur = c.get(x, y);
    if (cur === "_" || cur === undefined) return;
    c.set(x, y, d < 0.22 ? "O" : d < 0.55 ? "w1" : "f4");
  });
  for (const [x0, x1] of piers)
    for (let y = AY - 34; y < AY + 2; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - BRZ[0], (y - BRZ[1]) * 1.6) / 70;
        if (d > 1 || d4(x * 2, y * 2) > (1 - d) * 0.6) continue;
        c.set(x, y, d < 0.5 ? "f2" : "f3");
      }

  // --- trees either side ---------------------------------------------------------------------------
  const treeAt = (x, base, scale, seed) => {
    trunk(c, x - 4 * scale, x + 4 * scale, base - 78 * scale, base, BARK, x < W / 2 ? 1 : -1, 12 * scale, seed);
    canopy(c, x, base - 86 * scale, 46 * scale, 30 * scale, NIGHT, seed + 3, L, 20, 0.34);
  };
  treeAt(26, H + 10, 1.25, 11);
  treeAt(358, H + 14, 1.35, 23);
  treeAt(74, H - 2, 0.8, 31);
  treeAt(316, H - 6, 0.85, 37);
  // Bushes tucking the tree feet into the hill.
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    if (Math.abs(x - AX) < 70) continue;
    clump(c, x, hillTop(x) + 4 + r() * 22, 4 + r() * 6, ["j1", "j2", "j3", "j4"], 950 + i, L);
  }
  tufts(c, 260, 0, HORIZON + 6, W, H - HORIZON - 6, "e4", 77);

  // --- glowing caps along the path, the way Pocket Quest lights its door ------------------------------
  const caps = [];
  for (let i = 0; i < 16; i++) {
    const x = Math.round(AX - 120 + r() * 240);
    if (Math.abs(x - AX) < 22) continue;
    const y = Math.round(hillTop(x) + 12 + r() * (H - hillTop(x) - 16));
    c.set(x, y, "K");
    c.set(x - 1, y - 1, "mb");
    c.set(x, y - 1, "q5");
    c.set(x + 1, y - 1, "mb");
    caps.push([x, y - 1, 1 + r() * 1.6]);
  }

  // --- a path up to the arch -------------------------------------------------------------------------
  for (let t = 0; t <= 1; t += 0.002) {
    const y = H - t * (H - (AY + 10));
    const x = AX + Math.sin(t * 2.4) * 18 * (1 - t);
    const half = 16 * (1 - t * 0.55);
    for (let k = -half; k <= half; k++) {
      const u = Math.abs(k) / half;
      if (d4(x + k, y) < u * 0.8) continue;
      c.set(x + k, y, ["p1", "f4", "f3"][shadeIdx(0.25 + (1 - u) * 0.45 + (d4(x + k, y * 2) - 0.5) * 0.3, 3, x + k, y)]);
    }
  }

  // Relight the whole hill: cold moonlight everywhere, warm firelight near the brazier, and
  // everything further from both falling away into the dark. No dithering — a smooth wash reads as
  // night, a dithered one reads as dirt.
  tone(c, (x, y) => {
    const fd = Math.hypot((x - BRZ[0]) / 78, (y - (BRZ[1] + 6)) / 34);
    const fire = Math.max(0, 1 - fd) ** 1.6;
    const vd = Math.hypot((x - AX) / (W * 0.58), (y - (AY - 6)) / (H * 0.7));
    const dark = 1 - Math.min(1, Math.max(0, (vd - 0.45) / 0.72)) * 0.72;
    const moon = 0.66 + 0.1 * (1 - y / H);
    return [dark * (moon + fire * 0.75), dark * (moon * 0.96 + fire * 0.5), dark * (moon * 1.12 + fire * 0.12)];
  });

  return {
    img: sprite(c.grid, 0.5, 0.5),
    w: W,
    h: H,
    focus: [BRZ[0], BRZ[1] - 8],
    fire: [BRZ[0], BRZ[1] - 8, 16],
    moon,
    bells,
    stars,
    caps,
    arch: [AX, AY - 96],
  };
}
