// The camera.
//
// A fight camera, not a map. It frames the hero and the boss, close enough that the hero is a real
// presence on screen (about a sixth of the height on a landscape screen, as close as the width
// allows on an upright phone), and follows the action with a little lag.
//
// It frames inside a safe rectangle, not the whole screen: the HUD's strip at the top and, on a
// touch screen, the button block (bottom right in landscape, along the bottom when upright) are
// kept clear, so a thumb or the boss's health bar never sits over the fight. The stick needs no
// room: it appears wherever the thumb lands.
//
// One rule keeps that fair: anything that can hit the hero must be on screen before it goes live.
// Every telegraph that reaches near the hero is added to what the camera must frame, and the
// camera pulls back to fit it — quickly, so a new danger is never hidden — then eases back in once
// it has gone. It never pulls back further than the whole arena.
//
// Shake is a single "trauma" number that decays; every hit adds to it, and it is squared on the
// way out so small hits barely move the frame and big ones really do.
//
// The frame is drawn at the display's own resolution and the world is scaled by a float zoom: the
// art is high-resolution and smoothly filtered, so a whole-number zoom would only cost beauty.
import { clamp, lerp } from "../util.js?v=8898846";
import { ARENA } from "../config.js?v=8898846";
import { ISO_W, ISO_H, toScreen } from "./iso.js?v=8898846";
import { hits, phaseOf, shown } from "../sim/hazards.js?v=8898846";

// Room left round the whole arena at the widest pull-back, in world units.
const MARGIN_X = 36;
const MARGIN_Y = 46;
/** The hero's standing height in world units, and the share of the screen height it should fill. */
const HERO_H = 24;
const HERO_SHARE = 1 / 6;
/** However narrow the screen, at least this much of the floor is visible across it (screen units). */
const MIN_SPAN = 150;
/** Room kept round everything the camera frames (screen units). */
const PAD = 26;
/** A telegraph within this many world units of the hero is something the camera must show. */
const THREAT_REACH = 70;

export function makeCamera() {
  return {
    x: 0, // the screen-space point at the middle of the view
    y: 0,
    focusX: 0,
    focusY: 0,
    zoom: 2, // display pixels per world unit of *screen* space
    closeZoom: 2, // as close as it ever gets
    wideZoom: 1, // the whole arena
    dpr: 1,
    vw: 0, // the drawing buffer, in display pixels (0 until the first fit, so that one counts as new)
    vh: 0,
    cssW: 0,
    cssH: 0,
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
    t: 0,
    /** Room kept clear at each edge, in css pixels (setInsets). */
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    settled: false,

    /** Keep this much of each edge (css pixels) clear of the fight: the HUD, the touch buttons. */
    setInsets({ top = 0, right = 0, bottom = 0, left = 0 } = {}) {
      const i = this.insets;
      if (i.top !== top || i.right !== right || i.bottom !== bottom || i.left !== left) {
        this.insets = { top, right, bottom, left };
        this.recompute();
      }
    },
    /** The safe rectangle, in buffer pixels: [x, y, w, h]. */
    safe() {
      const d = this.dpr;
      const i = this.insets;
      const w = Math.max(64, this.vw - (i.left + i.right) * d);
      const h = Math.max(64, this.vh - (i.top + i.bottom) * d);
      return [i.left * d, i.top * d, w, h];
    },
    recompute() {
      const [, , sw, sh] = this.safe();
      this.wideZoom = Math.min(sw / (ISO_W(ARENA.R) + MARGIN_X * 2), sh / (ISO_H(ARENA.R) + MARGIN_Y * 2));
      const byHeight = (this.vh * HERO_SHARE) / HERO_H;
      const byWidth = sw / MIN_SPAN;
      this.closeZoom = Math.max(this.wideZoom, Math.min(byHeight, byWidth));
    },

    fit(cssW, cssH, dpr = 1) {
      this.dpr = dpr;
      this.cssW = cssW;
      this.cssH = cssH;
      const vw = Math.max(64, Math.round(cssW * dpr));
      const vh = Math.max(64, Math.round(cssH * dpr));
      // A new screen size (the first frame, a resize, a phone turned) snaps the framing rather
      // than easing into it from numbers worked out for another screen.
      if (vw !== this.vw || vh !== this.vh) this.settled = false;
      this.vw = vw;
      this.vh = vh;
      this.recompute();
      if (!this.settled) this.zoom = this.closeZoom;
      return { w: this.vw, h: this.vh, zoom: this.zoom };
    },

    /**
     * Frame the hero, the boss and every telegraph that could reach the hero. `dt` is real time;
     * pass a large one to snap straight to the framing (the renderer bench does).
     */
    follow(p, boss, dt, hazards = []) {
      this.t += dt;
      // What has to be on screen, as screen-space points.
      const pts = [];
      const add = (wx, wy, r = 0) => {
        const [sx, sy] = toScreen(wx, wy);
        pts.push([sx - r, sy - r * 0.5], [sx + r, sy + r * 0.5]);
      };
      add(p.x, p.y, 30);
      const [hx, hy] = toScreen(p.x, p.y);
      pts.push([hx, hy - HERO_H - 8]); // the top of the hero's head
      if (boss) {
        add(boss.x, boss.y, boss.r * 1.4);
        const [bx, by] = toScreen(boss.x, boss.y);
        pts.push([bx, by - (boss.hitH || 40) - 10]);
      }
      for (const h of hazards) {
        if (h.friendly || phaseOf(h) === "fade" || !shown(h)) continue;
        // A flood covers the whole floor, so what has to be seen is where it does not: the
        // nearest shallow always, and any other within a dash of the hero.
        if (h.safe) {
          const byDist = [...h.safe].sort((m, n) => Math.hypot(m[0] - p.x, m[1] - p.y) - Math.hypot(n[0] - p.x, n[1] - p.y));
          byDist.forEach(([sx, sy, sr], i) => {
            if (i === 0 || Math.hypot(sx - p.x, sy - p.y) < 150) add(sx, sy, sr);
          });
          continue;
        }
        if (!hits(h, p.x, p.y, THREAT_REACH)) continue;
        // Its origin if that is on the floor, so the shape can be read from where it starts;
        // otherwise just the floor round the hero, which the reach above already covers.
        if (Math.hypot(h.x, h.y) < ARENA.R + 10) add(h.x, h.y, 16);
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const [, , sw, sh] = this.safe();
      const need = Math.min(sw / (x1 - x0 + PAD * 2), sh / (y1 - y0 + PAD * 2));
      const want = clamp(need, this.wideZoom, this.closeZoom);
      // Out fast (a new danger must be seen now), in slowly (nothing should feel yanked).
      const rate = want < this.zoom ? 0.00002 : 0.12;
      const snap = !this.settled || dt >= 1; // a first frame, a new screen size, or a caller asking
      const k = snap ? 1 : 1 - Math.pow(rate, dt);
      this.zoom = lerp(this.zoom, want, k);
      // Keep the view over the arena: its middle never strays further than the floor goes.
      const lim = ISO_W(ARENA.R) / 2;
      const tx = clamp(cx, -lim, lim);
      const ty = clamp(cy, -ISO_H(ARENA.R) / 2, ISO_H(ARENA.R) / 2);
      const kf = snap ? 1 : 1 - Math.pow(0.002, dt);
      this.focusX = lerp(this.focusX, tx, kf);
      this.focusY = lerp(this.focusY, ty, kf);
      this.settled = true;

      this.trauma = Math.max(0, this.trauma - dt * 1.9);
      const s = this.trauma * this.trauma;
      const f = this.t * 42;
      this.shakeX = Math.sin(f * 1.31) * s * 11;
      this.shakeY = Math.cos(f * 1.07) * s * 11;
      this.x = this.focusX;
      this.y = this.focusY;
    },

    shake(amount) {
      this.trauma = clamp(this.trauma + amount / 22, 0, 1);
    },

    /** Where world (0, 0) sits in the buffer, in display pixels: the view's focus at the middle of the safe rectangle. */
    origin() {
      const [sx, sy, sw, sh] = this.safe();
      return [sx + sw / 2 - this.x * this.zoom + this.shakeX * this.zoom * 0.5, sy + sh / 2 - this.y * this.zoom + this.shakeY * this.zoom * 0.5];
    },

    /** World → buffer pixels. */
    toBuffer(wx, wy) {
      const [ox, oy] = this.origin();
      const [px, py] = toScreen(wx, wy);
      return [ox + px * this.zoom, oy + py * this.zoom];
    },

    /** World → css pixels over the visible canvas, which is what the mouse is measured in. */
    worldToScreen(wx, wy) {
      const [bx, by] = this.toBuffer(wx, wy);
      return [bx / this.dpr, by / this.dpr];
    },
  };
}
