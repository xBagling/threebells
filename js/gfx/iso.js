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
