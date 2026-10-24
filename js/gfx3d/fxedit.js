// Camp 2.0's effects as the owner paints them in the edit mode (ui/mapedit.js, the "Effects" view — the owner, 2026-10-14:
// "add a select in the camp Edit as well to add the sakura bloom effect, and the water effect, and the waterfall effect"):
// at the fx map's size (1x of the painting), four planes as runs [row, first, count, value]:
//   water   moving water (camp3d.js: as the map's own)       fall   a waterfall
//   none    the map's own water and waterfalls taken away     petal  where petals fall (shown pink; the petals: `petals`)
// and `petals`: [x, height, z, radius] in the world, each a little "tree" the petals fall from (made by the editor from the
// petal plane), `drop`: the map's cherry trees (camp2-view.json "trees" indices) whose petals he took away.
// Stored as art3d/<id>/<id>-fxedit.json (server.js POST /api/fxedit, backed up first).
import { DataTexture, RGBAFormat, UnsignedByteType, LinearFilter, NoColorSpace } from "./three-lib.js?v=48fd128-df87a96f";

export const FX_PLANES = ["water", "fall", "none", "petal"];

/** Read one: { w, h, planes: {water, fall, none, petal: Uint8Array}, petals, drop, tex }, or an empty one when it has none. */
export async function loadFxEdit(id, size) {
  // (`size`: the fx map's { w, h }, or a promise of it — the file is fetched meanwhile, as mapedit3d.js loadEdit; a missing
  // or unreadable one is none)
  const got = fetch(`art3d/${id}/${id}-fxedit.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const { w, h } = await size;
  const j = await got;
  const e = { w, h, planes: {}, petals: j?.petals || [], drop: j?.drop || [] };
  for (const k of FX_PLANES) {
    const a = (e.planes[k] = new Uint8Array(w * h));
    if (j && j.w === w && j.h === h) for (const [y, x, n, v] of j[k] || []) a.fill(v, y * w + x, y * w + x + n);
  }
  e.data = new Uint8Array(w * h * 4);
  e.tex = new DataTexture(e.data, w, h, RGBAFormat, UnsignedByteType);
  (e.tex.colorSpace = NoColorSpace), (e.tex.flipY = false), (e.tex.generateMipmaps = false), (e.tex.unpackAlignment = 1);
  e.tex.minFilter = e.tex.magFilter = LinearFilter;
  fillFx(e, 0, 0, w, h);
  e.tex.needsUpdate = true;
  return e;
}

/** The texture's bytes from the planes over a rectangle. */
export function fillFx(e, x0, y0, x1, y1) {
  const { w, planes: P, data } = e;
  for (let y = y0; y < y1; y++)
    for (let x = x0, i = y * w + x0; x < x1; x++, i++) {
      const o = i * 4;
      data[o] = P.water[i]; data[o + 1] = P.fall[i]; data[o + 2] = P.none[i]; data[o + 3] = P.petal[i];
    }
}

/** The JSON to save: each plane as runs of equal values. */
export function packFx(e) {
  const out = { v: 1, w: e.w, h: e.h, petals: e.petals, drop: e.drop };
  for (const k of FX_PLANES) {
    const a = e.planes[k], runs = [];
    for (let y = 0; y < e.h; y++) {
      const row = y * e.w;
      let x = 0;
      while (x < e.w) {
        const v = a[row + x];
        if (!v) { x++; continue; }
        const s = x;
        while (x < e.w && a[row + x] === v) x++;
        runs.push([y, s, x - s, v]);
      }
    }
    out[k] = runs;
  }
  return out;
}
