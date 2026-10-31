import {
  tn,
  bt,
  nn,
  mn,
  ni,
  os
} from "./main-6mhe1mqq.js?v=88e40de-1ff3b19c";
import {
  rawTex
} from "./main-74g1a3n8.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/mapedit3d.js
var OWN_PIECES2 = 40000;
async function loadEdit2(id, size) {
  try {
    const [r, { w, h }] = await Promise.all([fetch(`art3d/${id}/${id}-edit.bin`, { cache: "no-cache" }), size]);
    if (!r.ok)
      return null;
    const e = parseEdit2(await gunzipMaybe2(new Uint8Array(await r.arrayBuffer())));
    return e && e.w === w && e.h === h ? withTextures(e) : null;
  } catch {
    return null;
  }
}
var LE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
function u16le(buf, at, n) {
  if (LE && (buf.byteOffset + at) % 2 === 0)
    return new Uint16Array(buf.buffer.slice(buf.byteOffset + at, buf.byteOffset + at + n * 2));
  const out = new Uint16Array(n);
  for (let i = 0, o = at;i < n; i++, o += 2)
    out[i] = buf[o] | buf[o + 1] << 8;
  return out;
}
async function gunzipMaybe2(buf) {
  if (buf[0] !== 31 || buf[1] !== 139)
    return buf;
  return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}
function parseEdit2(buf) {
  const tag = buf.length >= 12 ? String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) : "";
  if (tag !== "TBE1" && tag !== "TBE2")
    return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const w = dv.getUint32(4, true), h = dv.getUint32(8, true), n = w * h;
  if (buf.length < 12 + n * (tag === "TBE2" ? 6 : 4))
    return null;
  const add = buf.slice(12, 12 + n), rem = buf.slice(12 + n, 12 + 2 * n);
  const dep = u16le(buf, 12 + 2 * n, n), pc = new Uint16Array(n);
  let lines = {}, next = OWN_PIECES2;
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
function packEdit2(e) {
  const n = e.w * e.h, js = new TextEncoder().encode(JSON.stringify({ lines: e.lines || {}, next: e.next || OWN_PIECES2 }));
  const out = new Uint8Array(12 + n * 6 + 4 + js.length), dv = new DataView(out.buffer);
  out.set([84, 66, 69, 50]);
  dv.setUint32(4, e.w, true);
  dv.setUint32(8, e.h, true);
  out.set(e.add, 12);
  out.set(e.rem, 12 + n);
  for (let i = 0, o = 12 + 2 * n;i < n; i++, o += 2)
    out[o] = e.dep[i] & 255, out[o + 1] = e.dep[i] >> 8;
  for (let i = 0, o = 12 + 4 * n;i < n; i++, o += 2)
    out[o] = e.pc[i] & 255, out[o + 1] = e.pc[i] >> 8;
  dv.setUint32(12 + 6 * n, js.length, true);
  out.set(js, 12 + 6 * n + 4);
  return out;
}
function emptyEdit2(w, h) {
  const n = w * h;
  return withTextures({ w, h, add: new Uint8Array(n), rem: new Uint8Array(n), dep: new Uint16Array(n), pc: new Uint16Array(n), lines: {}, next: OWN_PIECES2, com: new Uint8Array(n) });
}
async function loadPieces2(id, size, auto = false) {
  try {
    const lines = fetch(`art3d/${id}/${id}-lines.json`, { cache: "no-cache" }).then((q) => q.ok ? q.json() : null, () => null);
    const [r, { w, h }] = await Promise.all([fetch(`art3d/${id}/${id}-pieces.bin`, { cache: "no-cache" }), size]);
    if (!r.ok)
      return null;
    const buf = await gunzipMaybe2(new Uint8Array(await r.arrayBuffer()));
    if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== "TBP1")
      return null;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const pw = dv.getUint32(4, true), ph = dv.getUint32(8, true);
    if (pw !== w || ph !== h)
      return null;
    const ids = u16le(buf, 12, w * h);
    const guess = await lines;
    return { w, h, ids, guess: guess?.lines || {}, auto };
  } catch {
    return null;
  }
}
function lineOf2(e, id) {
  const L = e.lines?.[id];
  if (L)
    return L.length ? L : null;
  return e.autoLines ? e.pieces?.guess?.[id] || null : null;
}
function linedIds2(e) {
  const out = new Set(Object.keys(e.lines || {}));
  if (e.autoLines)
    for (const k in e.pieces?.guess || {})
      out.add(k);
  return out;
}
function attachPieces2(e, pieces) {
  e.pieces = pieces;
  e.autoLines = !!pieces.auto;
  e.pid = new Uint16Array(e.w * e.h);
  e.pidData = new Uint8Array(e.w * e.h * 2);
  e.pidTex = new os(e.pidData, e.w, e.h, ni, nn);
  const t = e.pidTex;
  rawTex(t, tn, { unpackAlignment: 1 });
  fillPid(e, 0, 0, e.w, e.h);
  t.needsUpdate = true;
  return e;
}
function withTextures(e) {
  const n = e.w * e.h;
  e.covData = new Uint8Array(n * 4);
  e.depData = new Uint8Array(n * 2);
  e.cov = new os(e.covData, e.w, e.h, mn, nn);
  e.depTex = new os(e.depData, e.w, e.h, ni, nn);
  rawTex(e.cov, bt, { unpackAlignment: 1 });
  rawTex(e.depTex, tn, { unpackAlignment: 1 });
  fillCov(e, 0, 0, e.w, e.h);
  e.cov.needsUpdate = e.depTex.needsUpdate = true;
  return e;
}
function fill2(e, x0, y0, x1, y1) {
  fillCov(e, x0, y0, x1, y1);
  if (e.pid)
    fillPid(e, x0, y0, x1, y1);
}
function fillCov(e, x0, y0, x1, y1) {
  const { w, add, rem, com, dep, covData, depData } = e;
  if (LE && covData.byteOffset % 4 === 0 && depData.byteOffset % 2 === 0) {
    const c32 = e.c32?.buffer === covData.buffer ? e.c32 : e.c32 = new Uint32Array(covData.buffer, covData.byteOffset, covData.length >> 2);
    const d16 = e.d16?.buffer === depData.buffer ? e.d16 : e.d16 = new Uint16Array(depData.buffer, depData.byteOffset, depData.length >> 1);
    for (let y = y0;y < y1; y++)
      for (let x = x0, i = y * w + x0;x < x1; x++, i++) {
        c32[i] = (add[i] | rem[i] << 8 | com[i] << 16 | 4278190080) >>> 0;
        const d = dep[i];
        d16[i] = d >> 8 | (d & 255) << 8;
      }
    return;
  }
  for (let y = y0;y < y1; y++)
    for (let x = x0, i = y * w + x0;x < x1; x++, i++) {
      const o = i * 4;
      covData[o] = add[i];
      covData[o + 1] = rem[i];
      covData[o + 2] = com[i];
      covData[o + 3] = 255;
      depData[i * 2] = dep[i] >> 8;
      depData[i * 2 + 1] = dep[i] & 255;
    }
}
function fillPid(e, x0, y0, x1, y1) {
  const { w, add, rem, pc, pid, pidData, pieces } = e;
  if (LE && pidData.byteOffset % 2 === 0) {
    const p16 = e.p16?.buffer === pidData.buffer ? e.p16 : e.p16 = new Uint16Array(pidData.buffer, pidData.byteOffset, pidData.length >> 1), ids = pieces.ids;
    for (let y = y0;y < y1; y++)
      for (let x = x0, i = y * w + x0;x < x1; x++, i++) {
        const masked = rem[i] < 128 && (add[i] >= 8 || ids[i] !== 0);
        const p = pid[i] = masked ? pc[i] || ids[i] : 0;
        p16[i] = p >> 8 | (p & 255) << 8;
      }
    return;
  }
  for (let y = y0;y < y1; y++)
    for (let x = x0, i = y * w + x0;x < x1; x++, i++) {
      const masked = rem[i] < 128 && (add[i] >= 8 || pieces.ids[i] !== 0);
      const p = pid[i] = masked ? pc[i] || pieces.ids[i] : 0;
      pidData[i * 2] = p >> 8;
      pidData[i * 2 + 1] = p & 255;
    }
}

export { OWN_PIECES2, loadEdit2, gunzipMaybe2, parseEdit2, packEdit2, emptyEdit2, loadPieces2, lineOf2, linedIds2, attachPieces2, fill2 };
