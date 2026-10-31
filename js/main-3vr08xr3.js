import {
  bt,
  nn,
  mn,
  os
} from "./main-6mhe1mqq.js?v=88e40de-1ff3b19c";
import {
  rawTex
} from "./main-74g1a3n8.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/fxedit.js
var FX_PLANES2 = ["water", "fall", "none", "petal"];
async function loadFxEdit2(id, size) {
  const got = fetch(`art3d/${id}/${id}-fxedit.json`, { cache: "no-cache" }).then((r) => r.ok ? r.json() : null).catch(() => null);
  const { w, h } = await size;
  const j = await got;
  const e = { w, h, planes: {}, petals: j?.petals || [], drop: j?.drop || [] };
  for (const k of FX_PLANES2) {
    const a = e.planes[k] = new Uint8Array(w * h);
    if (j && j.w === w && j.h === h)
      for (const [y, x, n, v] of j[k] || [])
        a.fill(v, y * w + x, y * w + x + n);
  }
  e.data = new Uint8Array(w * h * 4);
  e.tex = new os(e.data, w, h, mn, nn);
  rawTex(e.tex, bt, { unpackAlignment: 1 });
  fillFx2(e, 0, 0, w, h);
  e.tex.needsUpdate = true;
  return e;
}
function fillFx2(e, x0, y0, x1, y1) {
  const { w, planes: P, data } = e;
  for (let y = y0;y < y1; y++)
    for (let x = x0, i = y * w + x0;x < x1; x++, i++) {
      const o = i * 4;
      data[o] = P.water[i];
      data[o + 1] = P.fall[i];
      data[o + 2] = P.none[i];
      data[o + 3] = P.petal[i];
    }
}
function packFx2(e) {
  const out = { v: 1, w: e.w, h: e.h, petals: e.petals, drop: e.drop };
  for (const k of FX_PLANES2) {
    const a = e.planes[k], runs = [];
    for (let y = 0;y < e.h; y++) {
      const row = y * e.w;
      let x = 0;
      while (x < e.w) {
        const v = a[row + x];
        if (!v) {
          x++;
          continue;
        }
        const s = x;
        while (x < e.w && a[row + x] === v)
          x++;
        runs.push([y, s, x - s, v]);
      }
    }
    out[k] = runs;
  }
  return out;
}

export { FX_PLANES2, loadFxEdit2, fillFx2, packFx2 };
