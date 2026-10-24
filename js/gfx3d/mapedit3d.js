// The owner's own corrections to a painted map's cut-outs (the edit mode, ui/mapedit.js — the owner, 2026-10-13: "create a
// mode where i can mark on the images manually and update it ... on all current maps that are using this technology"): per
// pixel of the map's depth grid (Camp 2.0's camp2-pdepth.png at 1x, the Ash Floor's ash-refdepth.png at 2x)
//   add   0..255  how much of it stands in front of whoever is behind it (a rail the split missed)
//   rem   0..255  how much of it never covers anyone (a piece wrongly cut out)
//   dep   u16     the depth of what `add` adds, in the depth map's own units (mapedit.js: from what it rests on)
//   pc    u16     (Camp 2.0) which object a pixel belongs to, when the owner changed it (his own numbers from 40000, or the
//                 map's), 0: the map's own (camp2-pieces.bin, tools/camp2/pieces.py)
//   lines         (Camp 2.0) his baselines, { object: [[x, y], ...] } in image px, left to right: the object covers whoever
//                 stands behind its line (render3d.js campCover); an object without one covers wherever they overlap
// stored as art3d/<id>/<id>-edit.bin (gzip of "TBE2", w, h, add, rem, dep, pc little-endian, then the lines as JSON with its
// byte length before it; "TBE1" files, without pc and lines, are still read), drawn by camp3d.js and backdrop3d.js (tEdit:
// R add, G rem, B a comment's area; tEditD: dep, R high, G low; tPiece: the object of each pixel, R high, G low).
import { DataTexture, RGBAFormat, RGFormat, UnsignedByteType, LinearFilter, NearestFilter, NoColorSpace } from "./three-lib.js?v=48fd128-df87a96f";

/** The first number of the owner's own objects (the map's are 1..30000, tools/camp2/pieces.py). */
export const OWN_PIECES = 40000;

/** Read one: null when the map has none (or it is not this grid's size). `size`: the grid's { w, h }, or a promise of it —
 *  the file is fetched meanwhile (camp3d.js and backdrop3d.js know the size only once the depth map has loaded, and
 *  fetching after it put this file and the pieces' two behind the 1-4 MB depth: 0.3-0.6 s more before a fight). */
export async function loadEdit(id, size) {
  try {
    const [r, { w, h }] = await Promise.all([fetch(`art3d/${id}/${id}-edit.bin`, { cache: "no-cache" }), size]);
    if (!r.ok) return null;
    const e = parseEdit(await gunzipMaybe(new Uint8Array(await r.arrayBuffer())));
    return e && e.w === w && e.h === h ? withTextures(e) : null;
  } catch {
    return null;
  }
}

// (n little-endian u16s from byte `at`, copied in one go where this machine is little-endian too — every phone and PC — and
// the bytes lie on an even address; a byte at a time took 0.1 s a plane on the Bog Shrine's 8.6 M pixels)
const LE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
function u16le(buf, at, n) {
  if (LE && (buf.byteOffset + at) % 2 === 0) return new Uint16Array(buf.buffer.slice(buf.byteOffset + at, buf.byteOffset + at + n * 2));
  const out = new Uint16Array(n);
  for (let i = 0, o = at; i < n; i++, o += 2) out[i] = buf[o] | (buf[o + 1] << 8);
  return out;
}

export async function gunzipMaybe(buf) {
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

export function parseEdit(buf) {
  const tag = buf.length >= 12 ? String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) : "";
  if (tag !== "TBE1" && tag !== "TBE2") return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const w = dv.getUint32(4, true), h = dv.getUint32(8, true), n = w * h;
  if (buf.length < 12 + n * (tag === "TBE2" ? 6 : 4)) return null;
  const add = buf.slice(12, 12 + n), rem = buf.slice(12 + n, 12 + 2 * n);
  const dep = u16le(buf, 12 + 2 * n, n), pc = new Uint16Array(n);
  let lines = {}, next = OWN_PIECES;
  if (tag === "TBE2") {
    pc.set(u16le(buf, 12 + 4 * n, n));
    const at = 12 + 6 * n, len = buf.length >= at + 4 ? dv.getUint32(at, true) : 0;
    if (len) {
      const j = JSON.parse(new TextDecoder().decode(buf.subarray(at + 4, at + 4 + len)));
      lines = j.lines || {};
      next = j.next || next;
    }
  }
  return { w, h, add, rem, dep, pc, lines, next, com: new Uint8Array(n) };
}

export function packEdit(e) {
  const n = e.w * e.h, js = new TextEncoder().encode(JSON.stringify({ lines: e.lines || {}, next: e.next || OWN_PIECES }));
  const out = new Uint8Array(12 + n * 6 + 4 + js.length), dv = new DataView(out.buffer);
  out.set([84, 66, 69, 50]);
  dv.setUint32(4, e.w, true);
  dv.setUint32(8, e.h, true);
  out.set(e.add, 12);
  out.set(e.rem, 12 + n);
  for (let i = 0, o = 12 + 2 * n; i < n; i++, o += 2) (out[o] = e.dep[i] & 255), (out[o + 1] = e.dep[i] >> 8);
  for (let i = 0, o = 12 + 4 * n; i < n; i++, o += 2) (out[o] = e.pc[i] & 255), (out[o + 1] = e.pc[i] >> 8);
  dv.setUint32(12 + 6 * n, js.length, true);
  out.set(js, 12 + 6 * n + 4);
  return out;
}

/** An empty one for a grid. */
export function emptyEdit(w, h) {
  const n = w * h;
  return withTextures({ w, h, add: new Uint8Array(n), rem: new Uint8Array(n), dep: new Uint16Array(n), pc: new Uint16Array(n), lines: {}, next: OWN_PIECES, com: new Uint8Array(n) });
}

/** Camp 2.0's objects (art3d/<id>/<id>-pieces.bin, tools/camp2/pieces.py): { w, h, ids }, or null. `size` as loadEdit's. */
export async function loadPieces(id, size, auto = false) {
  try {
    // (the first-guess lines, what "Add line" starts from, fetched alongside rather than after)
    const lines = fetch(`art3d/${id}/${id}-lines.json`, { cache: "no-cache" }).then((q) => (q.ok ? q.json() : null), () => null);
    const [r, { w, h }] = await Promise.all([fetch(`art3d/${id}/${id}-pieces.bin`, { cache: "no-cache" }), size]);
    if (!r.ok) return null;
    const buf = await gunzipMaybe(new Uint8Array(await r.arrayBuffer()));
    if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== "TBP1") return null;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const pw = dv.getUint32(4, true), ph = dv.getUint32(8, true);
    if (pw !== w || ph !== h) return null;
    const ids = u16le(buf, 12, w * h);
    const guess = await lines;
    return { w, h, ids, guess: guess?.lines || {}, auto };
  } catch {
    return null;
  }
}

/** The line an object has now: his own, else (a painted arena) its guess; null for none. */
export function lineOf(e, id) {
  const L = e.lines?.[id];
  if (L) return L.length ? L : null;
  return e.autoLines ? e.pieces?.guess?.[id] || null : null;
}
/** Every object that has a line now (ids as strings). */
export function linedIds(e) {
  const out = new Set(Object.keys(e.lines || {}));
  if (e.autoLines) for (const k in e.pieces?.guess || {}) out.add(k);
  return out;
}

/** The object of each pixel (his own, else the map's) as a texture: `e.pid` (CPU), `e.pidTex` (R high byte, G low). */
export function attachPieces(e, pieces) {
  e.pieces = pieces;
  // (a painted arena's objects start with their guessed lines on — they stood by their depth before, a grass tuft in front of
  // the hero or behind him — the camp's start with none; his own line, or [] for "no line", wins either way)
  e.autoLines = !!pieces.auto;
  e.pid = new Uint16Array(e.w * e.h);
  e.pidData = new Uint8Array(e.w * e.h * 2);
  e.pidTex = new DataTexture(e.pidData, e.w, e.h, RGFormat, UnsignedByteType);
  const t = e.pidTex;
  (t.colorSpace = NoColorSpace), (t.flipY = false), (t.generateMipmaps = false), (t.unpackAlignment = 1);
  t.minFilter = t.magFilter = NearestFilter;
  fillPid(e, 0, 0, e.w, e.h);
  t.needsUpdate = true;
  return e;
}

function withTextures(e) {
  const n = e.w * e.h;
  e.covData = new Uint8Array(n * 4);
  e.depData = new Uint8Array(n * 2);
  e.cov = new DataTexture(e.covData, e.w, e.h, RGBAFormat, UnsignedByteType);
  e.depTex = new DataTexture(e.depData, e.w, e.h, RGFormat, UnsignedByteType);
  for (const t of [e.cov, e.depTex]) (t.colorSpace = NoColorSpace), (t.flipY = false), (t.generateMipmaps = false), (t.unpackAlignment = 1);
  e.cov.minFilter = e.cov.magFilter = LinearFilter; // (soft painted edges, read smoothly)
  e.depTex.minFilter = e.depTex.magFilter = NearestFilter; // (16 bits in two bytes: never blended)
  fillCov(e, 0, 0, e.w, e.h); // (no objects yet: attachPieces fills theirs)
  e.cov.needsUpdate = e.depTex.needsUpdate = true;
  return e;
}

/** The textures' bytes from the planes, over a rectangle. */
export function fill(e, x0, y0, x1, y1) {
  fillCov(e, x0, y0, x1, y1);
  if (e.pid) fillPid(e, x0, y0, x1, y1);
}
// (in two, so each part is filled once as a map loads: withTextures filled both planes over the whole map — 8.6 M pixels on
// the Bog Shrine — and attachPieces then all of it again for its objects)
function fillCov(e, x0, y0, x1, y1) {
  const { w, add, rem, com, dep, covData, depData } = e;
  // (a whole pixel a write where this machine is little-endian — every phone and PC: the same bytes, a quarter of the stores; a
  // byte at a time it took 0.45 s of a phone's load on the Bog Shrine, 2026-10-21 tools/loadtime.mjs)
  if (LE && covData.byteOffset % 4 === 0 && depData.byteOffset % 2 === 0) {
    const c32 = e.c32?.buffer === covData.buffer ? e.c32 : (e.c32 = new Uint32Array(covData.buffer, covData.byteOffset, covData.length >> 2));
    const d16 = e.d16?.buffer === depData.buffer ? e.d16 : (e.d16 = new Uint16Array(depData.buffer, depData.byteOffset, depData.length >> 1));
    for (let y = y0; y < y1; y++)
      for (let x = x0, i = y * w + x0; x < x1; x++, i++) {
        c32[i] = (add[i] | (rem[i] << 8) | (com[i] << 16) | 0xff000000) >>> 0;
        const d = dep[i];
        d16[i] = (d >> 8) | ((d & 255) << 8); // (its high byte first, as the shader reads it)
      }
    return;
  }
  for (let y = y0; y < y1; y++)
    for (let x = x0, i = y * w + x0; x < x1; x++, i++) {
      const o = i * 4;
      covData[o] = add[i]; covData[o + 1] = rem[i]; covData[o + 2] = com[i]; covData[o + 3] = 255;
      depData[i * 2] = dep[i] >> 8; depData[i * 2 + 1] = dep[i] & 255;
    }
}
function fillPid(e, x0, y0, x1, y1) {
  const { w, add, rem, pc, pid, pidData, pieces } = e;
  if (LE && pidData.byteOffset % 2 === 0) {
    // (two bytes a write, as fillCov: the same bytes)
    const p16 = e.p16?.buffer === pidData.buffer ? e.p16 : (e.p16 = new Uint16Array(pidData.buffer, pidData.byteOffset, pidData.length >> 1)), ids = pieces.ids;
    for (let y = y0; y < y1; y++)
      for (let x = x0, i = y * w + x0; x < x1; x++, i++) {
        const masked = rem[i] < 128 && (add[i] >= 8 || ids[i] !== 0);
        const p = (pid[i] = masked ? pc[i] || ids[i] : 0);
        p16[i] = (p >> 8) | ((p & 255) << 8);
      }
    return;
  }
  for (let y = y0; y < y1; y++)
    for (let x = x0, i = y * w + x0; x < x1; x++, i++) {
      // (only where it is masked: a pixel cleared — or never masked — belongs to no object, so an object cleared away
      // entirely is gone, nothing left to pick — the owner, 2026-10-15: "i still can select areas that i have cleared")
      // (a Mask stroke's faint fringe counts — it carries its stroke's object, mapedit.js stamp)
      const masked = rem[i] < 128 && (add[i] >= 8 || pieces.ids[i] !== 0);
      const p = (pid[i] = masked ? pc[i] || pieces.ids[i] : 0);
      pidData[i * 2] = p >> 8; pidData[i * 2 + 1] = p & 255;
    }
}
