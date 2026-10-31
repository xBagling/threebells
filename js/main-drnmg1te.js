import {
  toWorld
} from "./main-4hwc579a.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/camera3d.js
var S2 = Math.SQRT2;
var S6 = Math.sqrt(6);
var BACK = [S6 / 4, 0.5, S6 / 4];
var RIGHT = [1 / S2, 0, -1 / S2];
var UP = [-S2 / 4, Math.sqrt(3) / 2, -S2 / 4];
var H_TO_3D = Math.sqrt(2 / 3);
var DIST = 1000;
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function texelFactor(cam, { override = null, heroTexels = 76 } = {}) {
  if (override != null && override > 0)
    return override < 1 ? Math.max(override, cam.vw / 4092, cam.vh / 4092) : Math.max(1, Math.round(override));
  return Math.max(1, Math.round(24 * cam.closeZoom / heroTexels));
}
function cameraFrame(cam, k = 1) {
  const P = S2 * cam.zoom * (1 + (cam.punch || 0));
  const fx = cam.x - 0.5 * cam.shakeX;
  const fy = cam.y - 0.5 * cam.shakeY;
  const [gx, gy] = toWorld(fx, fy);
  const T = [gx, 0, gy];
  const [sx, sy, sw, sh] = cam.safe();
  const cx0 = sx + sw / 2;
  const cy0 = sy + sh / 2;
  const s = k / P;
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
    pxPerUnit: P
  };
}

export { BACK, RIGHT, UP, H_TO_3D, texelFactor, cameraFrame };
