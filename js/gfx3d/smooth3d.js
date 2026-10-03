// Smoothed normals for the painted characters (docs/3D-PLAN.md 7.3, the G7/G10 re-review).
//
// The characters are voxel-remeshed scans: their surfaces are covered in small crumples (the cape's
// folds, the toad's belly), and the file's normals follow every one. The character light steps the
// fill into three flat bands (materials3d.js PAINT_CHAR), so each crumple came out as an angular
// patch of a darker band — the cape's blotches seen from behind, the stair-stepped edge between the
// toad's lit and shaded cream. Their texture is already the lit painting, so the light only needs
// the large forms: here the normals are rebuilt smooth across UV seams (the copies of one point
// share one normal) and then relaxed over the surface `passes` times, each normal moved towards the
// average of its neighbours' — the bands then follow the body, not the crumples.
//
// Pure (BufferGeometry in, its normal attribute rewritten); runs once per asset at load.

/**
 * Rewrite `geometry`'s normals: area-weighted, welded by position (to `eps`), then relaxed `passes`
 * times by `amount` towards the neighbours' mean. Returns the geometry.
 */
export function smoothNormals(geometry, { passes = 3, amount = 0.6, eps = 1e-4 } = {}) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  if (!n) return geometry;
  // Weld by position — only copies whose file normals face the same way (a closed mouth's lips, or
  // the two caps of a cut, lie on one another facing apart: they stay two).
  const key = new Map();
  const weld = new Int32Array(n);
  let m = 0;
  const q = 1 / eps;
  const fn = geometry.attributes.normal;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`;
    let list = key.get(k);
    if (!list) key.set(k, (list = []));
    let w = -1;
    for (const [id, j] of list) {
      if (!fn || fn.getX(i) * fn.getX(j) + fn.getY(i) * fn.getY(j) + fn.getZ(i) * fn.getZ(j) > 0) {
        w = id;
        break;
      }
    }
    if (w < 0) list.push([(w = m++), i]);
    weld[i] = w;
  }
  const index = geometry.index ? geometry.index.array : null;
  const tris = index ? index.length / 3 : n / 3;
  const vi = (t, c) => (index ? index[t * 3 + c] : t * 3 + c);
  // Area-weighted face normals onto the welded points; the neighbours as edges.
  let N = new Float32Array(m * 3);
  const nb = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < tris; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const ux = pos.getX(b) - ax, uy = pos.getY(b) - ay, uz = pos.getZ(b) - az;
    const vx = pos.getX(c) - ax, vy = pos.getY(c) - ay, vz = pos.getZ(c) - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const wa = weld[a], wb = weld[b], wc = weld[c];
    for (const w of [wa, wb, wc]) {
      N[w * 3] += fx;
      N[w * 3 + 1] += fy;
      N[w * 3 + 2] += fz;
    }
    nb[wa].add(wb).add(wc);
    nb[wb].add(wa).add(wc);
    nb[wc].add(wa).add(wb);
  }
  const norm = (A) => {
    for (let w = 0; w < m; w++) {
      const l = Math.hypot(A[w * 3], A[w * 3 + 1], A[w * 3 + 2]) || 1;
      A[w * 3] /= l;
      A[w * 3 + 1] /= l;
      A[w * 3 + 2] /= l;
    }
  };
  norm(N);
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(m * 3);
    for (let w = 0; w < m; w++) {
      let sx = 0, sy = 0, sz = 0;
      for (const o of nb[w]) {
        sx += N[o * 3];
        sy += N[o * 3 + 1];
        sz += N[o * 3 + 2];
      }
      const k = nb[w].size || 1;
      out[w * 3] = N[w * 3] + (sx / k - N[w * 3]) * amount;
      out[w * 3 + 1] = N[w * 3 + 1] + (sy / k - N[w * 3 + 1]) * amount;
      out[w * 3 + 2] = N[w * 3 + 2] + (sz / k - N[w * 3 + 2]) * amount;
    }
    norm(out);
    N = out;
  }
  const attr = geometry.attributes.normal;
  for (let i = 0; i < n; i++) {
    const w = weld[i];
    attr.setXYZ(i, N[w * 3], N[w * 3 + 1], N[w * 3 + 2]);
  }
  attr.needsUpdate = true;
  return geometry;
}
