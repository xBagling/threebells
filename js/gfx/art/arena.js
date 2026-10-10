// The three arenas, drawn once each at boot as a single pixel image the renderer blits under
// everything. Each is a round floor with a rim you can't cross, and a dark surround that the camera
// never quite reaches the edge of.
//
// They share the shape so the fights are fair: the same circle, the same radius, the same starting
// corner. Only the ground under your feet changes.
import { canvas, sprite, blob, ell, clump, rng, d4, shadeIdx, tufts } from "../pixel.js?v=df092a6";
const TAU = Math.PI * 2;

const ARENA_R = 150; // world units; the sim uses the same number
const PAD = 64; // painted ground outside the rim, so a tall screen never sees its edge
const ARENA_SIZE = (ARENA_R + PAD) * 2;

const L = [-0.5, -0.86];

/** Everything the three arenas have in common: the disc, its rim and the dark beyond. */
function base(fill, rim, beyond) {
  const S = ARENA_SIZE;
  const c = canvas(S, S, beyond[0]);
  const cx = S / 2;
  const cy = S / 2;
  // The dark ground outside: flat, mottled, unwalkable — and dithered away to nothing before it
  // reaches the edge of the image, so the arena reads as an island in the dark rather than a
  // square of picture sitting on a black page.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2, y - S / 2);
      const k = (d - (ARENA_R + 3)) / (PAD - 3); // 0 at the rim, 1 at the edge of the image
      if (k > 0 && d4(x * 3, y * 5) < k * k) continue; // left empty: the void shows through
      const v = 0.3 + (d4(x * 3, y * 3) - 0.5) * 0.5 - Math.max(0, k) * 0.5;
      c.set(x, y, beyond[shadeIdx(v, beyond.length, x, y)]);
    }
  // The floor itself.
  ell(c, cx, cy, ARENA_R, ARENA_R, (x, y, d) => fill(c, x, y, d, x - cx, y - cy));
  // A raised rim: a bright top edge and a shadow inside it, so the disc reads as solid ground.
  for (let a = 0; a < Math.PI * 2; a += 0.002) {
    const co = Math.cos(a);
    const si = Math.sin(a);
    for (let k = 0; k < 4; k++) {
      const up = si < -0.25; // the far side catches the light
      c.set(cx + co * (ARENA_R - k), cy + si * (ARENA_R - k), rim[up ? Math.min(rim.length - 1, 2 + (k < 2 ? 1 : 0)) : k < 2 ? 1 : 0]);
    }
  }
  // An inner shadow, a dozen pixels deep, so the middle feels lit and the edges don't.
  ell(c, cx, cy, ARENA_R, ARENA_R, (x, y, d) => {
    if (d < 0.84) return;
    const k = (d - 0.84) / 0.16;
    if (d4(x * 5, y * 5) > k * 0.7) return;
    if (c.get(x, y) === "_") return;
    c.set(x, y, "SH");
  });
  return c;
}

// ---------------------------------------------------------------------------------------------
// I · The Sunken Bog. Wet mud in a ring of black water, lily pads, reeds and glowing caps.
// ---------------------------------------------------------------------------------------------
function bog() {
  const MUD = ["MU", "Mu", "MU2", "a3"];
  const c = base(
    (cc, x, y, d, dx, dy) => {
      const v = 0.34 + (1 - d) * 0.42 + (d4(x * 2, y) - 0.5) * 0.3 - (dy / ARENA_R) * 0.12;
      cc.set(x, y, MUD[shadeIdx(v, MUD.length, x, y)]);
    },
    ["G1", "G2", "z3", "z4"],
    ["q1", "D1", "q1", "q2"]
  );
  const S = ARENA_SIZE;
  const cx = S / 2;
  const cy = S / 2;
  const r = rng(5);
  // Puddles catching the sky.
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.86;
    const px = cx + Math.cos(a) * ARENA_R * k;
    const py = cy + Math.sin(a) * ARENA_R * k;
    const rx = 5 + r() * 13;
    ell(c, px, py, rx, rx * 0.55, (x, y, dd) => c.set(x, y, dd > 0.78 ? "G1" : dd > 0.4 ? "q2" : "q3"));
    for (let k2 = 0; k2 < 3; k2++) c.set(px - rx * 0.4 + k2, py - rx * 0.2, "q4");
  }
  // Moss creeping in from the rim.
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const k = 0.72 + r() * 0.24;
    clump(c, cx + Math.cos(a) * ARENA_R * k, cy + Math.sin(a) * ARENA_R * k, 3 + r() * 5, ["G1", "G2", "G3", "G4"], 900 + i, L);
  }
  // Reeds round the water's edge, outside the ring.
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const rr = ARENA_R + 3 + r() * (PAD - 6);
    const bx = cx + Math.cos(a) * rr;
    const by = cy + Math.sin(a) * rr;
    const hgt = 6 + r() * 10;
    for (let t = 0; t < hgt; t++) c.set(bx + Math.sin(t * 0.3) * 1.2, by - t, t > hgt - 3 ? "G4" : t % 3 ? "G2" : "G1");
  }
  // Glowing caps, the only warm light in the place.
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const k = 0.55 + r() * 0.42;
    const px = Math.round(cx + Math.cos(a) * ARENA_R * k);
    const py = Math.round(cy + Math.sin(a) * ARENA_R * k);
    c.set(px, py, "K");
    c.set(px - 1, py - 1, "GB");
    c.set(px, py - 1, "GP");
    c.set(px + 1, py - 1, "GB");
    c.set(px, py - 2, "GB");
  }
  tufts(c, 120, cx - ARENA_R, cy - ARENA_R, ARENA_R * 2, ARENA_R * 2, "G2", 41, (x, y) => Math.hypot(x - cx, y - cy) > ARENA_R - 6);
  return c;
}

// ---------------------------------------------------------------------------------------------
// II · The Ash Floor. Cracked black glass over something still burning underneath.
// ---------------------------------------------------------------------------------------------
function ash() {
  const FLOOR = ["K", "AS", "As", "AW"];
  const c = base(
    (cc, x, y, d) => {
      const v = 0.05 + (1 - d) * 0.3 + (d4(x, y * 2) - 0.5) * 0.26;
      cc.set(x, y, FLOOR[shadeIdx(v, FLOOR.length, x, y)]);
    },
    ["F1", "F2", "As", "AW"],
    ["K", "E", "K", "AS"]
  );
  const S = ARENA_SIZE;
  const cx = S / 2;
  const cy = S / 2;
  const r = rng(13);
  // Cracks, spreading from the middle outward, lit from below.
  for (let i = 0; i < 40; i++) {
    let a = r() * Math.PI * 2;
    const start = r() * TAU;
    const sd = Math.sqrt(r()) * (ARENA_R - 30);
    let px = cx + Math.cos(start) * sd;
    let py = cy + Math.sin(start) * sd;
    const len = 30 + r() * 90;
    for (let t = 0; t < len; t++) {
      a += (r() - 0.5) * 0.35;
      px += Math.cos(a);
      py += Math.sin(a);
      if (Math.hypot(px - cx, py - cy) > ARENA_R - 4) break;
      const heat = 1 - t / len;
      c.set(px, py, heat > 0.55 ? "F4" : heat > 0.25 ? "F3" : "F2");
      if (r() < 0.4) c.set(px + 1, py, "F1");
    }
  }
  // Drifts of soft ash.
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.9;
    blob(c, cx + Math.cos(a) * ARENA_R * k, cy + Math.sin(a) * ARENA_R * k, 6 + r() * 14, 3 + r() * 6, ["K", "AS", "As"], L, 300 + i, 0.24);
  }
  // Braziers, burning at four points round the rim.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = Math.round(cx + Math.cos(a) * (ARENA_R + 11));
    const py = Math.round(cy + Math.sin(a) * (ARENA_R + 11));
    blob(c, px, py + 4, 5, 3, ["o1", "o2", "o3"], L, 400 + i);
    for (let y = 0; y < 7; y++) for (let x = -3 + Math.floor(y / 3); x <= 3 - Math.floor(y / 3); x++) c.set(px + x, py + 3 - y, "o2");
    blob(c, px, py - 5, 4, 4, ["F2", "F3", "F4", "F5", "F6"], [0, 0], 410 + i, 0.4);
  }
  // Embers still glowing in the dark outside.
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const rr = ARENA_R + 2 + r() * (PAD - 4);
    c.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r() < 0.4 ? "F3" : "F2");
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// III · The Drowned Hall. Flagstones under an inch of water, with the sea waiting outside.
// ---------------------------------------------------------------------------------------------
function hall() {
  const STONE = ["o1", "o2", "o3", "o4"];
  const c = base(
    (cc, x, y, d) => {
      // Flagstones, 18 across, with wet mortar between them.
      const gx = Math.floor(x / 18);
      const gy = Math.floor(y / 14);
      const inx = x - gx * 18;
      const iny = y - gy * 14;
      const seam = inx < 1 || iny < 1;
      const tone = d4(gx * 31, gy * 17);
      const v = seam ? 0.06 : 0.3 + tone * 0.3 + (1 - d) * 0.3 + (d4(x, y) - 0.5) * 0.16;
      cc.set(x, y, STONE[shadeIdx(v, STONE.length, x, y)]);
    },
    ["D1", "D2", "D4", "D5"],
    ["D1", "n1", "D1", "D2"]
  );
  const S = ARENA_SIZE;
  const cx = S / 2;
  const cy = S / 2;
  const r = rng(29);
  // A shallow skin of water: pale, moving sheets that pool toward the middle.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - cx, y - cy) / ARENA_R;
      if (d > 0.99) continue;
      const n = (Math.sin(x * 0.42 + Math.cos(y * 0.31) * 1.6) + Math.sin(y * 0.55 - x * 0.12)) * 0.25 + 0.5;
      if (n > 0.86 - (1 - d) * 0.06) c.set(x, y, n > 0.94 ? "D5" : "D3");
    }
  // Barnacles and kelp crowding the rim.
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const k = 0.78 + r() * 0.2;
    clump(c, cx + Math.cos(a) * ARENA_R * k, cy + Math.sin(a) * ARENA_R * k, 2.5 + r() * 4, ["z1", "z2", "z3", "z4"], 600 + i, L);
  }
  // The drain the water is running into, dead centre — and where the flood starts.
  ell(c, cx, cy, 13, 13, (x, y, d) => c.set(x, y, d > 0.85 ? "o1" : d > 0.5 ? "D1" : "K"));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (let t = -12; t <= 12; t++) c.set(cx + Math.cos(a) * t, cy + Math.sin(a) * t, "o2");
  }
  // Foam out where the sea is.
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2;
    const rr = ARENA_R + 2 + r() * (PAD - 3);
    c.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r() < 0.3 ? "D6" : r() < 0.6 ? "D5" : "D3");
  }
  return c;
}

export function buildArenas() {
  const mk = (c) => ({ bg: [sprite(c.grid, 0.5, 0.5)] });
  return { bog: mk(bog()), ash: mk(ash()), hall: mk(hall()) };
}
