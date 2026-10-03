// Lights.
//
// A light is a position, a radius, a colour and an intensity. They come from three places:
//
//   the arena   braziers, glowing caps, caustics — placed once when the fight starts
//   the fight   every telegraph, every shot, the boss's eyes, the hero's blade on a swing
//   a moment    a hit, a heal, a death — a bright flash that fades in a fraction of a second
//
// Flicker is deliberate and cheap: a fire is two sine waves at awkward frequencies plus a little
// noise, which reads as a flame far better than a random number every frame does.
import { rng, TAU, clamp } from "../util.js?v=8898846";
import { toWorld } from "./iso.js?v=8898846";

export const HUE = {
  fire: [1.0, 0.62, 0.26],
  ember: [1.0, 0.45, 0.14],
  bog: [0.55, 1.0, 0.42],
  cap: [0.36, 0.86, 1.0],
  brine: [0.42, 0.9, 1.0],
  moon: [0.72, 0.8, 1.0],
  steel: [0.85, 0.92, 1.0],
  gold: [1.0, 0.84, 0.42],
  blood: [1.0, 0.24, 0.22],
  warn: [1.0, 0.3, 0.26],
  mint: [0.56, 1.0, 0.82],
};

export function makeLights(seed = 3) {
  const rand = rng(seed);
  /** Lights that live as long as the fight does. */
  const fixed = [];
  /** Lights created and destroyed by the fight; rebuilt from the world every frame. */
  const live = [];
  /** One-off flashes, with their own clocks. */
  const flashes = [];
  let t = 0;

  const api = {
    /** A light that stays put: a brazier, a glowing cap, a shaft of light. */
    place(x, y, r, colour, i = 1, flicker = 0) {
      fixed.push({ x, y, r, colour, i, flicker, ph: rand() * TAU, sharp: 1.5 });
      return fixed[fixed.length - 1];
    },
    clearFixed() {
      fixed.length = 0;
    },
    /** A light for this frame only. The renderer calls this while walking the world. */
    frame(x, y, r, colour, i = 1, sharp = 1.4) {
      live.push({ x, y, r, colour, i, sharp });
    },
    /** A flash that fades: a hit, a spell, a death. */
    flash(x, y, r, colour, i = 1.6, life = 0.22) {
      flashes.push({ x, y, r, colour, i, life, t: 0, sharp: 1.1 });
    },
    step(dt) {
      t += dt;
      for (const f of flashes) f.t += dt;
      for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t >= flashes[i].life) flashes.splice(i, 1);
      live.length = 0;
    },
    /**
     * Everything alight this frame, in world units. `toBuffer` turns them into buffer pixels.
     * A light off the edge of the view is dropped before it can take up one of the shader's slots.
     */
    collect(toBuffer, w, h, zoom = 1) {
      const out = [];
      const push = (l, i) => {
        const [bx, by] = toBuffer(l.x, l.y);
        // A light's radius is given in world units; on screen it is that many zoomed pixels.
        const r = l.r * zoom;
        if (bx < -r || by < -r || bx > w + r || by > h + r) return;
        out.push({ x: bx, y: by, r, i, colour: l.colour, sharp: l.sharp ?? 1.4 });
      };
      for (const l of fixed) {
        // Two waves that never line up, so a fire never looks like it is on a timer.
        const f = l.flicker ? 1 + (Math.sin(t * 7.3 + l.ph) * 0.5 + Math.sin(t * 17.1 + l.ph * 2) * 0.28 + Math.sin(t * 2.7 + l.ph) * 0.22) * l.flicker : 1;
        push(l, l.i * f);
      }
      for (const l of live) push(l, l.i);
      for (const f of flashes) {
        const k = 1 - f.t / f.life;
        push(f, f.i * k * k);
      }
      return out;
    },
    get time() {
      return t;
    },
  };
  return api;
}

/**
 * The mood each arena is lit and graded in.
 *
 * The ambient is high on purpose. A painted arena arrives *already lit* — the artist (here, a
 * diffusion model) has put the shadows in. Treating it as an unlit albedo and relighting it from
 * scratch double-darkens everything and the floor goes black. So ambient carries the painting
 * through at close to full strength, and the dynamic lights are accents laid over the top: a
 * brazier throwing a little more warmth, a telegraph washing the ground red, the hero's own small
 * glow. That is the difference between lighting a painting and fighting it.
 */
export const ARENA_LIGHT = {
  bog: {
    ambient: [0.78, 0.84, 0.92],
    tint: [0.96, 1.0, 1.0],
    saturation: 1.14,
    contrast: 1.06,
    vignette: 0.5,
    bloom: 0.33,
    autoThresh: 0.86,
    autoAmt: 0,
  },
  ash: {
    ambient: [0.7, 0.66, 0.7],
    tint: [1.04, 0.97, 0.94],
    saturation: 1.2,
    contrast: 1.1,
    vignette: 0.58,
    bloom: 0.45,
    threshold: 0.62,
    autoThresh: 0.76,
    autoAmt: 0,
  },
  hall: {
    ambient: [0.76, 0.84, 0.94],
    tint: [0.94, 1.0, 1.05],
    saturation: 1.08,
    contrast: 1.05,
    vignette: 0.52,
    bloom: 0.3,
    autoThresh: 0.86,
    autoAmt: 0,
  },
  // Looks a painting can take instead of its arena's own (tools/iso-arena.py --look). A meadow in
  // daylight is painted fully lit, so ambient carries it through almost untouched and the grade
  // stays light; the lanterns are the only lights.
  meadow: {
    ambient: [0.97, 0.96, 0.92],
    tint: [1.02, 1.0, 0.97],
    saturation: 1.02,
    contrast: 1.02,
    vignette: 0.32,
    bloom: 0.22,
    autoThresh: 0.9,
    autoAmt: 0,
  },
  "meadow-night": {
    ambient: [0.82, 0.86, 0.96],
    tint: [0.97, 1.0, 1.03],
    saturation: 1.04,
    contrast: 1.04,
    vignette: 0.48,
    bloom: 0.34,
    autoThresh: 0.86,
    autoAmt: 0,
  },
};

/** The colour of the lights read out of each look's glow mask; anything else glows like a bog cap. */
export const GLOW_HUE = { ash: HUE.fire, hall: HUE.brine, meadow: HUE.gold, "meadow-night": HUE.gold };

/**
 * Read the lights straight out of the painting.
 *
 * tools/pixelate.py writes a glow mask beside every painting: which pixels are giving off light.
 * Rather than placing braziers by hand and hoping they line up with the art, this finds the bright
 * blobs in that mask and puts a light on each one. Repaint the arena and its lights move with it.
 *
 * The mask is a picture of the isometric view, not a map of the floor: its pixels are screen
 * units times the painting's ppu, centred on the middle of the arena. Each blob is turned back
 * into screen units and then through the inverse projection, so the light lands in world space
 * exactly under the pixels that glow. (Reading the mask as a top-down grid put every light about
 * forty-five degrees round from its brazier.)
 */
export function lightsFromGlow(lights, glowSprite, hue, maxLights = 10) {
  if (!glowSprite) return 0;
  const W = glowSprite.w ?? glowSprite.cv.width;
  const H = glowSprite.h ?? glowSprite.cv.height;
  const ppu = glowSprite.ppu || 1;
  // Sampled down to a grid of the same aspect as the painting; light is low-frequency anyway.
  const NX = 96;
  const NY = Math.max(1, Math.round((NX * H) / W));
  const c = document.createElement("canvas");
  c.width = NX;
  c.height = NY;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(glowSprite.cv, 0, 0, NX, NY);
  const d = g.getImageData(0, 0, NX, NY).data;
  const cells = [];
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const v = d[(y * NX + x) * 4];
      if (v <= 40) continue;
      // Cell centre → screen units from the arena's middle → world units on the floor.
      const sx = ((x + 0.5) * (W / NX) - W / 2) / ppu;
      const sy = ((y + 0.5) * (H / NY) - H / 2) / ppu;
      const [wx, wy] = toWorld(sx, sy);
      cells.push({ wx, wy, v });
    }
  cells.sort((a, b) => b.v - a.v);
  // Keep the brightest, but never two lights on top of each other.
  const taken = [];
  for (const cell of cells) {
    if (taken.length >= maxLights) break;
    if (taken.some((t) => Math.hypot(t.wx - cell.wx, t.wy - cell.wy) < 32)) continue;
    taken.push(cell);
    lights.place(cell.wx, cell.wy, 40 + (cell.v / 255) * 46, hue, 0.3 + (cell.v / 255) * 0.5, 0.22);
  }
  return taken.length;
}

/** The lights an arena is born with. Positions are world units; (0,0) is the middle of the floor. */
export function seedArenaLights(lights, arena, R, rand = Math.random) {
  lights.clearFixed();
  if (arena === "bog") {
    for (let i = 0; i < 14; i++) {
      const a = rand() * TAU;
      const d = (0.35 + rand() * 0.6) * R;
      lights.place(Math.cos(a) * d, Math.sin(a) * d, 26 + rand() * 18, HUE.cap, 0.5 + rand() * 0.3, 0.18);
    }
    lights.place(0, 0, R * 1.5, HUE.moon, 0.18, 0);
  } else if (arena === "ash") {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      lights.place(Math.cos(a) * (R + 11), Math.sin(a) * (R + 11), 108, HUE.fire, 1.05, 0.34);
    }
    // The cracks themselves glow; a few broad lights stand in for hundreds of thin ones.
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU;
      const d = rand() * R * 0.8;
      lights.place(Math.cos(a) * d, Math.sin(a) * d, 44 + rand() * 30, HUE.ember, 0.4 + rand() * 0.25, 0.3);
    }
  } else if (arena === "meadow-night") {
    lights.place(0, 0, R * 1.5, HUE.moon, 0.16, 0); // the moon over the whole field
  } else if (arena === "hall") {
    lights.place(0, 0, R * 1.3, HUE.brine, 0.3, 0.06);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      lights.place(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, 40, HUE.brine, 0.35, 0.12);
    }
  }
}

export { clamp };
