// The garden's painted swatches (docs/3D-PLAN.md M4b; the plan of record is the M4b design, 2–3):
// the owner's picked paintings, cut and packed by tools/3d/atlas.py and tools/3d/tiles.py into
// art3d/garden/ — one atlas of cells (atlas.json names each cell's box, its mode and its mean) and
// the floor's tiles (tiles.json).
//
// loadGardenPaint() runs once per page (load3d.js) and never fails: a file that is missing, does
// not decode, or does not match the size and hash its JSON records (a stale WebP next to a new
// atlas.json, critique #9) is simply left out, and whatever is left out stays M4a's flat colour.
// gardenTextures() wraps what was loaded as textures for one renderer (one graphics context);
// every material of that renderer shares them, and the renderer disposes them in destroy().
//
// Cells are chosen by fixed ids, never by baked atlas boxes (design D-e): a generator writes a
// cell id per vertex or per instance, and the shader looks the box and 1 / mean up in uniform
// arrays filled from atlas.json (cellTable, atlasCells). A mesh is painted only if every cell it
// names is in the atlas; otherwise it stays M4a.
import { CanvasTexture, SRGBColorSpace, RepeatWrapping, ClampToEdgeWrapping, NearestFilter, LinearFilter, Vector3, Vector4 } from "./three-lib.js?v=8898846";
import { cardMips, mipTexture, patchPaint, STONE_CELLS, APPLE_CELLS, CLOVER_CELLS } from "./props3d.js?v=8898846";

const DIR = "art3d/garden/";

/** The wall's stone cells, by id (props3d.js buildStoneGeo writes these ids per vertex, and owns the list). */
export { STONE_CELLS };
/** The apple's cells, body and leaf card (props3d.js applePaintGeo), and the clover's (cloverGeos), by id. */
export { APPLE_CELLS, CLOVER_CELLS };
/** The foliage card cells, in a fixed order (foliage3d.js writes these ids per card). */
export const CARD_CELLS = [
  "leafA", "leafB", "leafC", "leafD",
  "pinkA", "pinkB", "pinkC",
  "whiteA", "whiteB", "whiteC", "whiteD", "whiteBigA", "whiteBigB",
  "conA", "conB", "conC",
  "hedgeA", "hedgeB", "hedgeC", "hedgeD",
  "mossA", "mossB", "mossC",
];
/** The flowers' cells (props3d.js flowerInstances names them; flowerBox is each one's drawn fallback). */
export const FLOWER_CELLS = ["stem", "daisyA", "daisyB", "buttercup", "cosmos", "flowerLeaf", "lupineFloret", "lupineLeaf"];
/** The floor's tiles and macro map, as tiles.json names them. */
const TILES = ["grass", "terrace", "floor"];

/** FNV-1a, 32 bits, over a file's bytes, as 8 lower-case hex digits (what atlas.py and tiles.py record). */
export function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function fetchJSON(name) {
  try {
    const r = await fetch(DIR + name);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/**
 * One image, `.webp` first, then `.png`, decoded without premultiplying or colour conversion.
 * `meta` is its record in atlas.json / tiles.json ({ w, h, webp: { bytes, fnv1a32 }, png: {…} });
 * a file is used only if its byte count and hash match the record and it decodes to w × h.
 */
async function fetchImage(file, meta) {
  if (!meta || typeof createImageBitmap !== "function") return null;
  for (const ext of ["webp", "png"]) {
    const want = meta[ext];
    if (!want) continue;
    try {
      const r = await fetch(`${DIR}${file}.${ext}`);
      if (!r.ok) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length !== want.bytes || fnv1a32(buf) !== want.fnv1a32) {
        console.warn(`3D view: ${file}.${ext} does not match its record (stale file?); not used`);
        continue;
      }
      const bmp = await createImageBitmap(new Blob([buf], { type: `image/${ext}` }), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
      if (bmp.width === meta.w && bmp.height === meta.h) return bmp;
      bmp.close?.();
    } catch {
      // try the next format
    }
  }
  return null;
}

/** An ImageBitmap's RGBA bytes (every atlas cell's alpha is 0 or 255, so a premultiplied canvas loses nothing used). */
function pixelsOf(bmp) {
  const { width: w, height: h } = bmp;
  const cv = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
}

async function loadAtlas() {
  const json = await fetchJSON("atlas.json");
  const img = json?.image;
  if (!img || !json.cells || img.w !== json.size || img.h !== json.size) return null;
  const bmp = await fetchImage("atlas", img);
  if (!bmp) return null;
  try {
    const t0 = performance.now();
    const mips = cardMips(pixelsOf(bmp), img.w, img.h, { linear: true }); // ratio cells divide by a linear mean (critique #12)
    return { cells: json.cells, size: json.size, mips, ms: performance.now() - t0 };
  } finally {
    bmp.close?.();
  }
}

/** The macro map's texels a tuft's root reads (floorRootAt): ROOT_N² texels, each the linear mean of a block of the map's (its mip level 2). */
const ROOT_N = 256;

/**
 * The macro map at ROOT_N², linear RGB (Float32Array, row by row, rows following +z as the map's),
 * for the grass roots, baked into a per-tuft attribute at build time (critique #19: no vertex
 * texture fetch). Null if the map is not the expected square.
 */
function rootSamples(bmp) {
  const n = bmp.width;
  if (bmp.height !== n || n % ROOT_N) return null;
  const px = pixelsOf(bmp);
  const k = n / ROOT_N;
  const lut = new Float32Array(256).map((_, i) => ((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))(i / 255));
  const out = new Float32Array(ROOT_N * ROOT_N * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 4;
      const q = (((j / k) | 0) * ROOT_N + ((i / k) | 0)) * 3;
      out[q] += lut[px[o]];
      out[q + 1] += lut[px[o + 1]];
      out[q + 2] += lut[px[o + 2]];
    }
  const w = 1 / (k * k);
  for (let q = 0; q < out.length; q++) out[q] *= w;
  return out;
}

/**
 * The floor's albedo at a sim point (x, y) from the macro map's root samples (linear RGB, bilinear,
 * clamped to the map, as the floor shader clamps it): [r, g, b]. `over` is the map's half size.
 */
export function floorRootAt(roots, x, y, over = 160) {
  const f = (v) => Math.min(ROOT_N - 1, Math.max(0, (v / (2 * over) + 0.5) * ROOT_N - 0.5));
  const fx = f(x);
  const fy = f(y);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(ROOT_N - 1, x0 + 1);
  const y1 = Math.min(ROOT_N - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (i, j, c) => roots[(j * ROOT_N + i) * 3 + c];
  return [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x1, y0, c) * tx) * (1 - ty) + (at(x0, y1, c) * (1 - tx) + at(x1, y1, c) * tx) * ty);
}

async function loadTiles() {
  const json = await fetchJSON("tiles.json");
  if (!json) return {};
  const out = {};
  await Promise.all(
    TILES.map(async (name) => {
      const meta = json[name];
      const bitmap = meta?.file ? await fetchImage(meta.file, meta) : null;
      if (!bitmap) return;
      if (name !== "floor") return void (out[name] = { meta, bitmap });
      // The macro map: its root samples too, or it is not used (the tufts and the floor must agree).
      let roots = null;
      try {
        roots = rootSamples(bitmap);
      } catch {
        roots = null;
      }
      if (roots) out[name] = { meta, bitmap, roots };
      else bitmap.close?.();
    }),
  );
  return out;
}

/**
 * Everything painted the garden needs, loaded once per page: { atlas: { cells, size, mips, ms },
 * grass, terrace, floor: { meta, bitmap } } with any part null, or null if nothing loaded.
 * Never rejects.
 */
export async function loadGardenPaint() {
  try {
    const [atlas, tiles] = await Promise.all([loadAtlas().catch(() => null), loadTiles().catch(() => ({}))]);
    const garden = { atlas, grass: tiles.grass || null, terrace: tiles.terrace || null, floor: tiles.floor || null };
    return atlas || garden.grass || garden.terrace || garden.floor ? garden : null;
  } catch {
    return null;
  }
}

/**
 * The garden's textures for one renderer: { atlas, cells, grass, terrace, floor, floorRoots, meta,
 * textures, dispose() }, a part null where it did not load, or null for no paint at all (M4a). The
 * atlas is one texture shared by every material; the tiles repeat and the macro map (`floor`)
 * clamps. `floorRoots` is the macro map's CPU samples for the grass roots (floorRootAt), shared by
 * every renderer of the page.
 */
export function gardenTextures(garden, gl) {
  if (!garden) return null;
  const textures = [];
  const out = { atlas: null, cells: null, grass: null, terrace: null, floor: null, floorRoots: null, meta: {}, textures, dispose: () => textures.forEach((t) => t.dispose()) };
  if (garden.atlas) {
    out.atlas = mipTexture(garden.atlas.mips);
    out.atlas.name = "garden-atlas";
    out.cells = garden.atlas.cells;
    textures.push(out.atlas);
  }
  const aniso = Math.max(1, Math.min(4, gl?.capabilities?.getMaxAnisotropy?.() || 1));
  for (const name of TILES) {
    const src = garden[name];
    if (!src) continue;
    const t = new CanvasTexture(src.bitmap);
    t.name = `garden-${name}`;
    t.colorSpace = SRGBColorSpace;
    t.flipY = false;
    t.wrapS = t.wrapT = name === "floor" ? ClampToEdgeWrapping : RepeatWrapping;
    // The tiles' painted texels stay crisp; the macro map (0.31 units a texel, soft colour and
    // contact gradients) is smooth. Minification stays trilinear with mips (the default).
    t.magFilter = name === "floor" ? LinearFilter : NearestFilter;
    t.anisotropy = aniso;
    out[name] = t;
    out.meta[name] = src.meta;
    if (name === "floor") out.floorRoots = src.roots;
    textures.push(t);
  }
  return textures.length ? out : null;
}

/**
 * The uniform table for a list of cell names: { box: Vector4[] (u, v, w, h; v down, as atlas.json),
 * inv: Vector3[] (1 / mean for a ratio cell, 1 for an albedo cell) }, or null if the atlas is
 * missing or lacks any of them — that mesh then stays M4a.
 */
export function cellTable(paint, names) {
  const cells = paint?.atlas && paint.cells;
  if (!cells) return null;
  const box = [];
  const inv = [];
  for (const n of names) {
    const c = cells[n];
    if (!c || !Array.isArray(c.uv) || c.uv.length !== 4) return null;
    box.push(new Vector4(c.uv[0], c.uv[1], c.uv[2], c.uv[3]));
    const m = c.mode === "ratio" && Array.isArray(c.mean) ? c.mean : null;
    if (m && !m.every((x) => x > 1e-4)) return null;
    inv.push(m ? new Vector3(1 / m[0], 1 / m[1], 1 / m[2]) : new Vector3(1, 1, 1));
  }
  return { box, inv };
}

/**
 * The trunks' painted bark (design step 4): the tubes' uv (props3d.js tube: u 0 → 2 once round, v
 * along the tube) repeats the bark cell mirrored both ways, abs(fract(uv / 2) · 2 − 1), so the
 * seam down the tube (u 0 = u 2) and every repeat meet the same texel on both sides. The mip level
 * comes from the smooth uv's own gradient (textureGrad), so the fract jump never picks a tiny mip
 * along a line. The gradient is capped at 8 atlas texels (mip level 3): at a trunk's silhouette u
 * races across a pixel, and a deeper level would reach past the cell's 8-texel pad into its
 * neighbours (a green texel, times the bark's 1 / mean, came out a bright green block on T1's lit
 * edge). Ratio mode: the texel over the cell's mean scales M4a's vertex colour. `table` is
 * cellTable(paint, ["bark"]); `size` the atlas's width in texels.
 */
export function barkCells(mat, table, size = 1024) {
  const own = { uBark: { value: table.box[0] }, uBarkInv: { value: table.inv[0] }, uBarkGrad: { value: 8 / size } };
  mat.userData.bark = own;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, own);
  };
  return patchPaint(mat, "paint:bark", {
    vert: [
      ["#include <common>", "#include <common>\nvarying vec2 vRep;"],
      ["#include <uv_vertex>", "#include <uv_vertex>\nvRep = uv;"],
    ],
    frag: [
      ["#include <common>", "#include <common>\nvarying vec2 vRep;\nuniform vec4 uBark;\nuniform vec3 uBarkInv;\nuniform float uBarkGrad;"],
      [
        "#include <map_fragment>",
        `{
           vec2 t = abs(fract(vRep * 0.5) * 2.0 - 1.0);
           vec2 gx = dFdx(vRep) * uBark.zw;
           vec2 gy = dFdy(vRep) * uBark.zw;
           gx *= min(1.0, uBarkGrad / max(length(gx), 1e-9));
           gy *= min(1.0, uBarkGrad / max(length(gy), 1e-9));
           vec4 sampledDiffuseColor = textureGrad(map, uBark.xy + t * uBark.zw, gx, gy);
           diffuseColor *= sampledDiffuseColor;
           diffuseColor.rgb *= uBarkInv;
         }`,
      ],
    ],
  });
}

/**
 * Point a paint material (or its depth twin) at atlas cells: the float attribute `attr` holds the
 * cell id, which picks the box its unit uv is mapped into (flipped in v for PlaneGeometry cards)
 * and the colour factor the texel is multiplied by (ratio cells: 1 / the cell's mean). The program
 * key carries the table's size, the attribute, the flip and the level cap (critique #14); `attr`
 * can be a new name where a mesh already declares an `aCell` of another type (critique #2).
 *
 * `maxLevel` (with `size`, the atlas's width in texels) caps the mip level the cells are read at:
 * the texel gradient is clamped to 2^maxLevel atlas texels, as barkCells does. The foliage cards
 * use 3: at the wide pull-back a card is only a few screen texels, and levels 4–5 would melt a
 * painted blossom cell's pink and green into one dull colour (the flat build's grey cells do not
 * care) and reach past the cells' 8-texel pad into their neighbours.
 *
 * `glints`: a texel whose linear red passes .45–.6 is its own albedo, not a ratio of the vertex
 * colour (applied after the vertex colours). A ratio cell's painted glint (the clover's warm
 * specks, V24; garden-atlas.json "glints") times a dark leaf's rim colour came out a dull brown
 * speck; as albedo it takes the light like the leaf round it. No leaf texel comes near: the
 * clover ramp's top step is red .08. The cell's mean (so its 1 / mean) leaves the glints out
 * (atlas.py lin_mean), so its leaf texels come out as bright as a glint-free cell's.
 */
export function atlasCells(mat, table, { attr = "aCell", flipV = false, key = "cells", maxLevel = null, size = 1024, glints = false } = {}) {
  const N = table.box.length;
  const own = { uCellBox: { value: table.box }, uCellInv: { value: table.inv }, uCellGrad: { value: maxLevel == null ? 1 : 2 ** maxLevel / size } };
  mat.userData.cells = own;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, own);
  };
  const uv = flipV ? "vec2(uv.x, 1.0 - uv.y)" : "uv";
  const read =
    maxLevel == null
      ? `#include <map_fragment>
         vec4 cellTexel = vec4(0.0);
         #ifdef USE_MAP
           ${glints ? "cellTexel = texture2D(map, vMapUv);" : ""}
         #endif`
      : `vec4 cellTexel = vec4(0.0);
         #ifdef USE_MAP
         {
           vec2 gx = dFdx(vMapUv);
           vec2 gy = dFdy(vMapUv);
           gx *= min(1.0, uCellGrad / max(length(gx), 1e-9));
           gy *= min(1.0, uCellGrad / max(length(gy), 1e-9));
           cellTexel = textureGrad(map, vMapUv, gx, gy);
           diffuseColor *= cellTexel;
         }
         #endif`;
  const glint = glints ? [["#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, cellTexel.rgb, smoothstep(0.45, 0.6, cellTexel.r));"]] : [];
  return patchPaint(mat, `paint:${key}:${attr}:${N}:${flipV ? 1 : 0}:${maxLevel ?? "-"}:${glints ? "g" : "-"}`, {
    vert: [
      ["#include <common>", `#include <common>\nattribute float ${attr};\nuniform vec4 uCellBox[${N}];\nuniform vec3 uCellInv[${N}];\nvarying vec3 vCellInv;`],
      ["#include <uv_vertex>", `#include <uv_vertex>\n{ int ci = int(${attr} + 0.5); vec4 b = uCellBox[ci]; vMapUv = b.xy + ${uv} * b.zw; vCellInv = uCellInv[ci]; }`],
    ],
    frag: [
      ["#include <common>", "#include <common>\nvarying vec3 vCellInv;\nuniform float uCellGrad;"],
      ["#include <map_fragment>", `${read}\ndiffuseColor.rgb *= vCellInv;`],
      ...glint,
    ],
  });
}
