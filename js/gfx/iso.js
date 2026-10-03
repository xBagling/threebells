// The isometric projection, and the rules that keep it pixel-perfect.
//
// The simulation is flat: the arena is a circle on a plane and everything in sim/ works in those
// plain (x, y) world units. Only the renderer knows the world is seen at an angle. That split is
// deliberate — collision, dodging and the bots all stay simple, and the view can be changed
// without touching a line of the fight.
//
// The projection is the classic 2:1:
//
//     screen.x = (x - y) · KX
//     screen.y = (x + y) · KY          KX = 1, KY = 0.5
//
// so one world unit east goes one pixel right and half a pixel down, and a circle on the ground
// comes out as an ellipse twice as wide as it is tall. A floor of radius R occupies
// R·√2·2 across and R·√2 down.
//
// Pixel-perfection is not a setting, it is three rules, and every one of them is load-bearing:
//
//  1. the world is drawn into a buffer at one buffer pixel per screen unit — never a fraction
//  2. that buffer is blown up to the display by a whole number, never 2.37
//  3. anything drawn on the ground is rasterised by testing world-space distance per pixel, not
//     by asking the 2D canvas to fill an ellipse — a filled path is anti-aliased, and a soft grey
//     edge on a red circle is exactly the artefact this is meant to avoid
export const KX = 1;
export const KY = 0.5;
/** How far the iso footprint of a circle of radius R reaches, across and down. */
export const ISO_W = (r) => r * Math.SQRT2 * KX * 2;
export const ISO_H = (r) => r * Math.SQRT2 * KY * 2;

/** World → screen, in screen units (which are buffer pixels). */
export const toScreen = (x, y) => [(x - y) * KX, (x + y) * KY];
export const sx = (x, y) => (x - y) * KX;
export const sy = (x, y) => (x + y) * KY;
/** Screen → world, for the mouse and for rasterising ground shapes. */
export function toWorld(px, py) {
  const a = px / (2 * KX);
  const b = py / (2 * KY);
  return [a + b, b - a];
}

/**
 * A direction the player pushed, in screen terms, turned into the world direction it should mean.
 * Pushing up the screen has to walk the character up the screen — which on the ground is
 * north-west. Without this every control feels rotated by forty-five degrees, which is the single
 * most common mistake in an isometric game.
 */
export function dirToWorld(mx, my) {
  const wx = mx / (2 * KX) + my / (2 * KY);
  const wy = -mx / (2 * KX) + my / (2 * KY);
  const m = Math.hypot(wx, wy);
  return m > 0.0001 ? [wx / m, wy / m] : [0, 0];
}
/** A world angle → the angle it appears to point at on screen, for choosing a sprite's facing. */
export function screenAngle(worldAngle) {
  return Math.atan2(Math.sin(worldAngle) * KY + Math.cos(worldAngle) * KY, Math.cos(worldAngle) * KX - Math.sin(worldAngle) * KX);
}
/** Depth order: what is further down the screen is drawn later. */
export const depth = (x, y) => (x + y) * KY;

/**
 * Rasterise a ground shape one pixel at a time, with hard edges.
 *
 * `inside(wx, wy)` is asked in *world* space, so a circle stays a circle in the sim's terms and
 * comes out correctly squashed on screen for free — and the edge lands on exactly the pixels it
 * should, with no anti-aliasing anywhere.
 *
 * `shade(wx, wy, px, py)` returns a colour or null. Returning null for some pixels is how the
 * dithered interiors are done.
 */
export function rasterGround(img, ox, oy, bounds, inside, shade) {
  const { data, width, height } = img;
  const x0 = Math.max(0, Math.floor(bounds[0]));
  const y0 = Math.max(0, Math.floor(bounds[1]));
  const x1 = Math.min(width, Math.ceil(bounds[2]));
  const y1 = Math.min(height, Math.ceil(bounds[3]));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const [wx, wy] = toWorld(px - ox, py - oy);
      if (!inside(wx, wy)) continue;
      const c = shade(wx, wy, px, py);
      if (!c) continue;
      const i = (py * width + px) * 4;
      // Painted over whatever is there, weighted by the colour's own alpha — but the *edge* is
      // always hard, because a pixel is either inside the shape or it is not.
      const a = c[3];
      data[i] = data[i] + (c[0] - data[i]) * a;
      data[i + 1] = data[i + 1] + (c[1] - data[i + 1]) * a;
      data[i + 2] = data[i + 2] + (c[2] - data[i + 2]) * a;
      data[i + 3] = 255;
    }
  }
}

/** The screen-space box a circle of radius r at (x, y) covers, plus a margin. */
export function circleBounds(x, y, r, ox, oy, pad = 2) {
  const [cx, cy] = toScreen(x, y);
  const hw = r * Math.SQRT2 * KX + pad;
  const hh = r * Math.SQRT2 * KY + pad;
  return [ox + cx - hw, oy + cy - hh, ox + cx + hw, oy + cy + hh];
}

/** An ordered dither, for the inside of a ground shape. Stable in world space so it does not crawl. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const dither = (px, py) => (BAYER[((py % 4) + 4) % 4][((px % 4) + 4) % 4] + 0.5) / 16;
