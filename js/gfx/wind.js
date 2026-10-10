// Wind.
//
// One field the whole game reads, so a gust crosses the arena as one thing: the reeds on the
// upwind side bend before the ones on the far side, and the fireflies get pushed along with them.
// It is a travelling wave with a slow breathing base, plus gust fronts that sweep the floor from
// one side — enough to read as weather for a few sines and an exp per lookup.
//
// Anything rooted in the ground — grass, reeds, flowers, a hanging lantern, a boss's kelp — is
// drawn with a shear rather than a shift (the `lean` of render.js's blit): the base stays planted
// and the top leans. That is what separates wind from a sprite sliding about.
// Gusts come from one direction — the one the base wave travels in — and each is a front that
// sweeps across the floor: a sharp leading edge, then a tail that dies away behind it.
const DIR_X = 0.946;
const DIR_Y = 0.324;
const FRONT_SPEED = 150; // units a second: it crosses a 236-unit floor in about a second and a half
const FRONT_START = -200; // it sets off from beyond the upwind edge

export function makeWind({ speed = 26, gustEvery = 7.5, strength = 1 } = {}) {
  let t = 0;
  let gustFrom = -1e9; // when the current gust front set off
  let nextGust = 3;
  /** How much of a gust is at (x, y) right now: 0 before the front arrives, 1 at it, fading after. */
  const gustAt = (x, y) => {
    const u = FRONT_START + (t - gustFrom) * FRONT_SPEED - (x * DIR_X + y * DIR_Y); // > 0 once it has passed
    if (u < -48) return 0;
    return u < 0 ? Math.exp(-((u / 16) ** 2)) : Math.exp(-u / 110);
  };
  return {
    step(dt) {
      t += dt;
      // Gusts arrive on their own schedule; between them there is only the base breeze.
      if (t > nextGust) {
        gustFrom = t;
        nextGust = t + gustEvery * (0.6 + Math.random() * 0.9);
      }
    },
    get t() {
      return t;
    },
    /**
     * How far the top of something rooted at (x, y) should lean, in pixels, for a given
     * flexibility. A blade of grass is 1, a tree trunk is 0.05, a hanging bell is 0.3.
     */
    at(x, y, flex = 1) {
      // The travelling part: a wave moving across the arena at `speed`.
      const phase = (x * 0.035 + y * 0.012) - t * (speed * 0.035);
      const base = Math.sin(phase) * 0.6 + Math.sin(phase * 2.3 + 1.7) * 0.25;
      const breath = Math.sin(t * 0.7) * 0.3 + 0.7;
      // The gust: the reeds on the upwind side bow first and the far ones a moment later.
      const g = gustAt(x, y) * (Math.sin(phase * 1.3) * 0.3 + 0.8);
      return (base * breath + g * 1.8) * strength * flex;
    },
    /** The push on something in the air — a firefly, an ember, a leaf. */
    drift(x, y, flex = 1) {
      const w = this.at(x, y, flex);
      return [w * 6, w * 1.4];
    },
    /** How much gust is at the middle of the floor, for anything that wants the weather as one number. */
    get gust() {
      return gustAt(0, 0);
    },
  };
}
