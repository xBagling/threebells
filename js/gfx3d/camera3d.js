// The 3D camera, worked out from the 2D one (gfx/camera.js) every frame. Pure maths, no three.js,
// so it runs under Bun (tools/test.mjs checks it against cam.toBuffer).
//
// The 2D projection is screen = (x − y, (x + y)/2): the view from an elevation where sin α = 1/2,
// so α = 30°, yaw 45°. An orthographic camera looking down that line with the world laid out as
// (X, Y, Z) = (x, height, y) draws every ground point on exactly the pixel the 2D view draws it on,
// so the framing, the fairness rule and mouse and touch aim all keep working unchanged.
//
// It also snaps the view to a whole-texel grid (docs/3D-PLAN.md 3.5): the scene is drawn into a
// low-resolution target, k device pixels per texel, with the camera moved onto the texel grid so
// that still things always land on the same texels and never shimmer; the part-texel difference is
// handed to the final pass, which shifts the enlarged picture back, so camera motion stays smooth.
import { toWorld } from "../gfx/iso.js?v=8898846";

const S2 = Math.SQRT2;
const S6 = Math.sqrt(6);
/** From the target towards the camera. */
export const BACK = [S6 / 4, 0.5, S6 / 4];
/** Screen right and screen up, as world directions. */
export const RIGHT = [1 / S2, 0, -1 / S2];
export const UP = [-S2 / 4, Math.sqrt(3) / 2, -S2 / 4];
/** A true height of 1 shows as this many screen units: 2D heights (screen units) × H_TO_3D = 3D heights. */
export const SCREEN_PER_HEIGHT = Math.sqrt(1.5);
export const H_TO_3D = Math.sqrt(2 / 3);
/** How far the camera stands back. Any distance works for an orthographic camera. */
export const DIST = 1000;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Whole device pixels per texel, so the hero is about `heroTexels` tall (3D-PLAN 3.5: 76 texels,
 * as in the target image). `override` is the bench's ?texel=.
 */
export function texelFactor(cam, { override = null, heroTexels = 76 } = {}) {
  // Under 1: supersampled, but never past 4096 texels a side (a phone's buffer limit).
  if (override != null && override > 0) return override < 1 ? Math.max(override, cam.vw / 4092, cam.vh / 4092) : Math.max(1, Math.round(override));
  return Math.max(1, Math.round((24 * cam.closeZoom) / heroTexels));
}

/**
 * The camera for this frame. `k` is device pixels per texel (1 = native, no low-resolution look).
 * Returns the camera position and target (world, three.js axes), the orthographic frustum in view
 * units, the render target size W×H in texels, and the offsets the final pass shifts by, in buffer
 * pixels: display pixel (X, Y) shows texel ((X − offX)/k, (Y − offY)/k), Y measured down.
 */
export function cameraFrame(cam, k = 1) {
  const P = S2 * cam.zoom; // buffer pixels per view unit
  // The point camera.js puts at the middle of the safe rectangle, shake included.
  const fx = cam.x - 0.5 * cam.shakeX;
  const fy = cam.y - 0.5 * cam.shakeY;
  const [gx, gy] = toWorld(fx, fy);
  const T = [gx, 0, gy];
  const [sx, sy, sw, sh] = cam.safe();
  const cx0 = sx + sw / 2;
  const cy0 = sy + sh / 2;
  const s = k / P; // one texel, in view units
  const a = dot(T, RIGHT);
  const b = dot(T, UP);
  const a0 = Math.round(a / s) * s;
  const b0 = Math.round(b / s) * s;
  const ea = a - a0;
  const eb = b - b0;
  const target = [T[0] - ea * RIGHT[0] - eb * UP[0], T[1] - ea * RIGHT[1] - eb * UP[1], T[2] - ea * RIGHT[2] - eb * UP[2]];
  const pos = [target[0] + BACK[0] * DIST, target[1] + BACK[1] * DIST, target[2] + BACK[2] * DIST];
  const W = Math.ceil(cam.vw / k) + 4;
  const H = Math.ceil(cam.vh / k) + 4;
  const ci = Math.floor(cx0 / k) + 2;
  const cj = Math.floor(cy0 / k) + 2;
  return {
    pos,
    target,
    up: [0, 1, 0],
    left: -ci * s,
    right: (W - ci) * s,
    top: cj * s,
    bottom: -(H - cj) * s,
    near: 1,
    far: DIST * 3,
    W,
    H,
    k,
    offX: cx0 - ci * k - ea * P,
    offY: cy0 - cj * k + eb * P,
    pxPerUnit: P,
  };
}

/**
 * Where a world point (x on the ground, height h in 3D units, y on the ground) lands in the
 * buffer, through a frame from cameraFrame — the same maths the GPU does, for tests and for the
 * overlay. Returns [X, Y] in buffer pixels, Y down.
 */
export function projectFrame(f, x, h, y) {
  const d = [x - f.pos[0], h - f.pos[1], y - f.pos[2]];
  const a = dot(d, RIGHT);
  const v = dot(d, UP);
  // Texel coordinates in the low-resolution target, then shifted out to buffer pixels.
  const s = (f.right - f.left) / f.W;
  const i = (a - f.left) / s;
  const j = (f.top - v) / s;
  return [i * f.k + f.offX, j * f.k + f.offY];
}

/** A 2D height (screen units above the ground) in 3D units. */
export const heightTo3D = (h) => h * H_TO_3D;
