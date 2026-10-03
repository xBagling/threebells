// Small shared helpers: maths, time, a seeded random, and the tag that builds HTML safely.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
/** The shortest way round from a to b, in radians. */
export const angleDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const approach = (a, b, step) => (Math.abs(b - a) <= step ? b : a + Math.sign(b - a) * step);
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const len = (x, y) => Math.hypot(x, y);
/** Ease curves, named so the call site reads. */
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeIn = (t) => t * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

/** mulberry32: small, fast, and the same everywhere. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A string → a 32-bit seed (FNV-1a). */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/** Pick n distinct items from a list, using a seeded random. */
export function pickN(list, n, rand) {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
export const pick = (list, rand) => list[Math.floor(rand() * list.length)];

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------
export const msUntilMidnight = () => {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next - d;
};
/** "2:48" from seconds. */
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const untilNext = () => {
  const m = Math.ceil(msUntilMidnight() / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
};

// ---------------------------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------------------------
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
/**
 * Markup that has already been escaped. It extends String, so it can go straight to innerHTML and
 * a nested template is recognised rather than escaped a second time.
 */
class Html extends String {}
export const raw = (s) => new Html(s == null ? "" : String(s));
const piece = (v) => {
  if (v == null || v === false) return "";
  if (v instanceof Html) return String(v);
  if (Array.isArray(v)) return v.map(piece).join("");
  return esc(v);
};
/** A tagged template: values are escaped unless they are raw() or another one of these. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += piece(values[i]) + strings[i + 1];
  return new Html(out);
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const on = (el, ev, fn, opts) => (el.addEventListener(ev, fn, opts), () => el.removeEventListener(ev, fn, opts));
