// Loading the paintings.
//
// The arenas and the start screen are painted on this PC with Qwen-Image-Edit and cut to size by
// tools/pixelate.py (see docs/ART-PIPELINE.md). They live in public/art/ as ordinary PNGs.
//
// Everything else — the hero, the bosses, the plants, the icons — is still generated in the
// browser from the pixel kit, because a character needs dozens of frames that agree with each
// other and a diffusion model cannot give you that.
//
// If a painting is missing the game falls back to the procedural version of the same thing. That
// is not a fallback for its own sake: it is what lets the art be regenerated at any time without
// the game ever being broken in between.
const cache = new Map();

/** Load a PNG into an image, or null if it is not there. Never throws. */
export function loadImage(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
  cache.set(url, p);
  return p;
}

/**
 * An art file by name, WebP first (tools/webp.py writes one beside every PNG, at a quarter of the
 * weight) and the PNG if there is no WebP yet.
 */
export async function loadArt(base) {
  return (await loadImage(`${base}.webp`)) || (await loadImage(`${base}.png`));
}

/** An image and, if one was made, its glow mask — the pixels the renderer treats as light. */
export async function loadPainting(name) {
  const [img, glow] = await Promise.all([loadArt(`art/${name}`), loadArt(`art/${name}-glow`)]);
  if (!img) return null;
  return { img, glow, w: img.width, h: img.height };
}

/** Wrap a loaded image so it can be blitted exactly like a generated sprite. */
export function asSprite(img, ax = 0.5, ay = 0.5, ppu = 1) {
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0);
  // `ppu` is how many of this image's pixels make one world unit, and `smooth` asks the renderer
  // to filter it when it scales — painted art wants that, generated pixel art does not.
  return { cv, w: cv.width, h: cv.height, ax: cv.width * ax, ay: cv.height * ay, ppu, smooth: true };
}
