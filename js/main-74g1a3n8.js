import {
  bt,
  ii,
  ol,
  Xs
} from "./main-6mhe1mqq.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/texload.js
var UA = typeof navigator !== "undefined" ? navigator.userAgent : "";
var SAFARI = /^((?!chrome|android).)*safari/i.test(UA) ? Number((UA.match(/Version\/(\d+)/) || [])[1] || 0) : -1;
var FIREFOX = UA.includes("Firefox") ? Number((UA.match(/Firefox\/(\d+)/) || [])[1] || 0) : -1;
var BITMAP = typeof createImageBitmap === "function" && typeof fetch === "function" && !(SAFARI >= 0 && SAFARI < 17) && !(FIREFOX >= 0 && FIREFOX < 98);
var OPTS = { imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "none" };
function pictureLoader() {
  const tl = new Xs;
  if (!BITMAP)
    return tl;
  return {
    async loadAsync(url) {
      const r = await fetch(tl.manager.resolveURL(url));
      if (!r.ok)
        throw new Error(`${url}: ${r.status}`);
      const bmp = await createImageBitmap(await r.blob(), OPTS);
      const t = new ol(bmp);
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    }
  };
}
var rawTex = (t, filter = bt, more = {}) => Object.assign(t, { colorSpace: ii, flipY: false, generateMipmaps: false, minFilter: filter, magFilter: filter }, more);

export { pictureLoader, rawTex };
