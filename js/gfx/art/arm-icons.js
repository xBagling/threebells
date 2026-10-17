// The arms' icons (content/weapons.js): one per weapon and shield, drawn from a few numbers along the diagonal — the
// pommel or butt at the bottom left, the striking end at the top right — and outlined as the hand-drawn icons are
// (icons.js), so each one reads by its shape at button size: a blade's length and width, a guard, a curve, a head.
// Returned as rows of the icon palette's letters (icons.js `M`).
const N = 12;

/**
 * A weapon along the diagonal, by sections from the butt (u = 0) to the end (u = L): the grip leather to the guard,
 * `guard` its half-width in gold, a `blade` of half-width `width` (steel, its leading side shining) that tapers to the
 * point over `taper`, curved back by `curve`; or, with no blade, a haft of wood to a `head` ("axe", "hammer", "club",
 * "flange", "knob") of half-width `hw` and length `hl`.
 */
function draw({ guard = 1.6, blade = 0, px = 2, taper = 1.6, curve = 0, head = null, hw = 2, hl = 3, metalHaft = false }) {
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  // (a 45° line is `px` pixels wide in each row: the axis on a pixel's middle for an odd width, between two for an even
  // one — anything else breaks into a dotted staircase)
  const width = px * 0.354 + 0.02;
  const a = [1.1, N - 1.1 - (px % 2 ? 0 : 0.5)];
  const d = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2]; // across, toward the lower right (the leading edge's side)
  const L = (N - 2.2) * Math.SQRT2;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const px = i + 0.5 - a[0], py = j + 0.5 - a[1];
      const u = px * d[0] + py * d[1];
      let v = px * n[0] + py * n[1];
      if (u < 0 || u > L + 0.2) continue;
      let c = null;
      if (blade) {
        const b0 = L - blade;
        if (u < 0.7) c = Math.abs(v) < Math.max(0.75, width) ? "y" : null; // the pommel
        else if (u < b0 - 0.4) c = Math.abs(v) < Math.min(width, 0.75) ? "n" : null; // the grip
        else if (u < b0 + 0.5) c = Math.abs(v) < guard ? "y" : null; // the guard
        else {
          const k = (u - b0) / blade;
          v += curve * k * k; // (a curved blade bends back from its edge)
          const w = width * Math.min(1, (L - u) / taper);
          if (Math.abs(v) < w) c = v > w * 0.15 ? "B" : "b";
        }
      } else {
        const h0 = L - hl;
        const shaft = Math.abs(v) < width;
        if (u < h0 + 0.3 && shaft) c = metalHaft ? "s" : u < 2.2 ? "n" : "N";
        if (u >= h0) {
          const k = (u - h0) / hl; // 0 at the head's foot, 1 at its end
          if (head === "axe") {
            // a bearded blade to the leading side, its edge curved, the haft running on through it
            const out = hw * Math.sin(Math.PI * Math.min(1, 0.15 + k * 0.85)) + 0.3;
            if (v > -width && v < out) c = v > out - 0.9 ? "b" : "s";
            else if (shaft) c = "N";
          } else if (head === "hammer") {
            if (Math.abs(v) < hw && k > 0.25) c = v < -hw + 0.9 ? "S" : "s";
            else if (shaft) c = "N";
          } else if (head === "club") {
            const w = 0.55 + (hw - 0.55) * Math.sin(Math.PI * 0.5 * Math.min(1, k * 1.3));
            if (Math.abs(v) < w * Math.min(1, (L - u + 0.6) / 1.2)) c = (i + j) % 3 === 0 && hw > 1.9 && k > 0.35 ? "s" : v > w * 0.3 ? "N" : "n";
          } else if (head === "flange") {
            const w = k < 0.2 ? 0.8 : hw * (0.75 + 0.25 * Math.cos(k * Math.PI * 4));
            if (Math.abs(v) < w * Math.min(1, (L - u + 0.5) / 1.0)) c = Math.abs(v) > 0.9 ? "y" : "s";
          } else if (head === "knob") {
            if (Math.hypot(u - (L - hw), v) < hw) c = "q";
            else if (shaft) c = "N";
          }
        }
      }
      if (c) g[j][i] = c;
    }
  }
  return outline(g);
}

/** A shield face-on: "round" (a buckler, its boss gold), "heater" (flat top, a point below), "tower" (tall). */
function shield(kind) {
  const g = Array.from({ length: N }, () => Array(N).fill("."));
  const cx = N / 2, cy = N / 2;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = i + 0.5 - cx, y = j + 0.5 - cy;
      let inside = false;
      if (kind === "round") inside = Math.hypot(x, y) < 4.6;
      else if (kind === "heater") inside = y < 0.5 ? Math.abs(x) < 4.2 && y > -4.6 : Math.abs(x) < 4.2 * Math.sqrt(Math.max(0, 1 - ((y - 0.5) / 4.6) ** 2)) && y < 5.1;
      else inside = Math.abs(x) < 3.4 && Math.abs(y) < 5.1;
      if (!inside) continue;
      let c = x < -1.2 ? "s" : "S";
      if (kind === "round" && Math.hypot(x, y) < 1.3) c = "y";
      if (kind === "heater" && Math.abs(x) < 0.6 && y > -3.6 && y < 3.6) c = "y";
      if (kind === "heater" && Math.abs(y + 0.5) < 0.6 && Math.abs(x) < 3.6) c = "y";
      if (kind === "tower" && (Math.abs(y + 2.6) < 0.5 || Math.abs(y - 2.6) < 0.5)) c = "o";
      if (kind === "tower" && Math.abs(x) < 0.9 && Math.abs(y) < 0.9) c = "y";
      g[j][i] = c;
    }
  }
  return outline(g);
}

function outline(g) {
  const out = g.map((r) => r.slice());
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (g[j][i] !== ".") continue;
      if ((g[j - 1]?.[i] ?? ".") !== "." || (g[j + 1]?.[i] ?? ".") !== "." || (g[j][i - 1] ?? ".") !== "." || (g[j][i + 1] ?? ".") !== ".") out[j][i] = "K";
    }
  }
  return out.map((r) => r.join(""));
}

/** Every weapon's and shield's icon, by its id in content/weapons.js. */
export const ARM_ICONS = {
  shortsword: draw({ blade: 6.4, px: 2, guard: 1.5, taper: 1.2 }),
  sword: draw({ blade: 9.0, px: 2, guard: 1.8 }),
  longsword: draw({ blade: 10.4, px: 2, guard: 2.2, taper: 1.2 }),
  greatsword: draw({ blade: 10.2, px: 3, guard: 2.4, taper: 1.5 }),
  colossal: draw({ blade: 10.8, px: 5, guard: 2.8, taper: 0.9 }),
  scimitar: draw({ blade: 9.0, px: 3, guard: 1.5, curve: 2.6, taper: 2.6 }),
  katana: draw({ blade: 9.4, px: 2, guard: 1.2, curve: 0.8, taper: 1.4 }),
  club: draw({ px: 2, head: "club", hw: 1.7, hl: 7 }),
  greatclub: draw({ px: 2, head: "club", hw: 2.6, hl: 8 }),
  scepter: draw({ px: 2, head: "flange", hw: 2.5, hl: 4.6, metalHaft: true }),
  axe: draw({ px: 2, head: "axe", hw: 3.3, hl: 4.4 }),
  greataxe: draw({ px: 2, head: "axe", hw: 4.2, hl: 6 }),
  hammer: draw({ px: 2, head: "hammer", hw: 2.2, hl: 3 }),
  greathammer: draw({ px: 2, head: "hammer", hw: 3.2, hl: 4.4 }),
  staff: draw({ px: 2, head: "knob", hw: 1.4, hl: 2.6 }),
  buckler: shield("round"),
  heater: shield("heater"),
  greatshield: shield("tower"),
};
