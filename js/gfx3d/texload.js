// The painted maps' pictures decoded off the page's thread (2026-10-16). three.js's TextureLoader hands WebGL an <img>,
// which the browser decodes there and then, inside the first frame that draws it: the Bog Shrine's 4x picture and its depth
// map held the fight's first frame 0.4-0.8 s on this PC (a phone several times that). createImageBitmap decodes while the
// rest is still downloading, on threads of its own, and hands WebGL the finished pixels — the same bytes on the GPU
// (checked: every byte of the depth maps, the picture, the life map). Its options are WebGL's own for raw data: no colour
// conversion, no premultiplying, no turning; flipY is not WebGL's to do for a bitmap, so these textures are never flipped
// (every caller here sets flipY false anyway).
//
// Where createImageBitmap's options are not to be trusted — Safari before 17, Firefox before 98, as three.js's own GLTFLoader
// judges it — the TextureLoader as before.
import { CanvasTexture, TextureLoader } from "./three-lib.js?v=79a60b0-466c2a40";

const UA = typeof navigator !== "undefined" ? navigator.userAgent : "";
const SAFARI = /^((?!chrome|android).)*safari/i.test(UA) ? Number((UA.match(/Version\/(\d+)/) || [])[1] || 0) : -1;
const FIREFOX = UA.includes("Firefox") ? Number((UA.match(/Firefox\/(\d+)/) || [])[1] || 0) : -1;
const BITMAP = typeof createImageBitmap === "function" && typeof fetch === "function" && !(SAFARI >= 0 && SAFARI < 17) && !(FIREFOX >= 0 && FIREFOX < 98);
const OPTS = { imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "none" };

/** A loader with TextureLoader's loadAsync(url): the texture's image an ImageBitmap where it can be. */
export function pictureLoader() {
  const tl = new TextureLoader();
  if (!BITMAP) return tl;
  return {
    async loadAsync(url) {
      // (through the loading manager, as TextureLoader goes: the published site's version in the address, main.js)
      const r = await fetch(tl.manager.resolveURL(url));
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      const bmp = await createImageBitmap(await r.blob(), OPTS);
      const t = new CanvasTexture(bmp); // (three.js's own way to hold a bitmap: a Texture, ready to upload)
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    },
  };
}
