// His body's surface, sparsely, to keep what he holds out of him (hero3d.js avoidBody; the owner, 2026-10-04: "the
// weapons are clipping through the body of the hero"). The cut poses were shaped for the sword; a longer weapon's far end
// swept through his chest, hood and cape in the coil, the follow-through and the guard. A few hundred points spread
// evenly over his own skin (farthest-point sampling, the arms left out: they hold the weapon), skinned each frame as the
// renderer skins them, with their normals: a point's depth is how far it is behind the nearest three. Capsules fitted to
// the bones were tried first: they held only 75% of the points inside the skin and called 28% inside that were out (the
// hood, the broad flat chest and the cape are no capsules).
import { Vector3, Matrix4 } from "../three-lib.js?v=79a60b0-466c2a40";

/** The surface points: `n` of the mesh's vertices spread evenly, none led by a bone matching `skip`; each with the side
 *  of the arm it is on (`arm`: an L or R upper arm or forearm, else none), so a weapon can leave out the arms holding it. */
export function fitBodySkin(mesh, { n = 700, skip = /hand|finger|thumb|weapon|grip/ } = {}) {
  const P = mesh.geometry.attributes.position, SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight;
  const bones = mesh.skeleton.bones;
  /** The bone that leads vertex `v` (its most weight), or −1. */
  const leader = (v) => {
    let best = -1, bw = 0;
    for (let k = 0; k < 4; k++) if (SW.getComponent(v, k) > bw) (bw = SW.getComponent(v, k)), (best = SI.getComponent(v, k));
    return best;
  };
  const ok = [];
  for (let v = 0; v < P.count; v++) {
    const best = leader(v);
    if (best >= 0 && !skip.test(bones[best].name)) ok.push(v);
  }
  // (no inner faces: a vertex whose outside, a little along its normal, is itself inside him is the inside of a shell —
  // the hood round the face, a fold — and blended in, it called a haft lying on his shoulder half a unit inside)
  const NR = mesh.geometry.attributes.normal;
  if (NR) {
    const G = 0.8, key = (a, b, c) => ((a + 512) * 1024 + (b + 512)) * 1024 + (c + 512);
    const grid = new Map();
    for (const v of ok) {
      const k = key(Math.floor(P.getX(v) / G), Math.floor(P.getY(v) / G), Math.floor(P.getZ(v) / G));
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(v);
    }
    const inside = (x, y, z) => {
      const bd = [Infinity, Infinity, Infinity], bv = [0, 0, 0];
      const ix = Math.floor(x / G), iy = Math.floor(y / G), iz = Math.floor(z / G);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        for (const v of grid.get(key(ix + a, iy + b, iz + c)) || []) {
          const q = (P.getX(v) - x) ** 2 + (P.getY(v) - y) ** 2 + (P.getZ(v) - z) ** 2;
          if (q < bd[2]) {
            if (q < bd[0]) (bd[2] = bd[1]), (bv[2] = bv[1]), (bd[1] = bd[0]), (bv[1] = bv[0]), (bd[0] = q), (bv[0] = v);
            else if (q < bd[1]) (bd[2] = bd[1]), (bv[2] = bv[1]), (bd[1] = q), (bv[1] = v);
            else (bd[2] = q), (bv[2] = v);
          }
        }
      }
      if (!Number.isFinite(bd[2])) return false;
      let sd = 0;
      for (const v of bv) sd += (x - P.getX(v)) * NR.getX(v) + (y - P.getY(v)) * NR.getY(v) + (z - P.getZ(v)) * NR.getZ(v);
      return sd / 3 < -0.02;
    };
    const keep = ok.filter((v) => !inside(P.getX(v) + NR.getX(v) * 0.3, P.getY(v) + NR.getY(v) * 0.3, P.getZ(v) + NR.getZ(v) * 0.3));
    ok.length = 0;
    ok.push(...keep);
  }
  // farthest-point sampling over the bind pose, part by part (each bone's own skin its share of the points, by how much
  // skin it leads): picked over the whole body at once, a point could stand for skin that moves with another bone — a
  // hem led by the hips beside a point on the thigh — and moving apart they left gaps 2.5 wide, a great club's head
  // deep in the hips with no point within reach to tell
  const leadOf = new Map();
  for (const v of ok) {
    const best = leader(v);
    let a = leadOf.get(best);
    if (!a) leadOf.set(best, (a = []));
    a.push(v);
  }
  const px = (v) => P.getX(v), py = (v) => P.getY(v), pz = (v) => P.getZ(v);
  const pick = [];
  for (const group of leadOf.values()) {
    const want = Math.max(3, Math.round((n * group.length) / ok.length));
    const dist = new Float64Array(group.length).fill(Infinity);
    let cur = 0;
    for (let i = 0; i < Math.min(want, group.length); i++) {
      pick.push(group[cur]);
      const x = px(group[cur]), y = py(group[cur]), z = pz(group[cur]);
      let far = 0, at = 0;
      for (let j = 0; j < group.length; j++) {
        const v = group[j];
        const d = (px(v) - x) ** 2 + (py(v) - y) ** 2 + (pz(v) - z) ** 2;
        if (d < dist[j]) dist[j] = d;
        if (dist[j] > far) (far = dist[j]), (at = j);
      }
      cur = at;
    }
  }
  const side = pick.map((v) => {
    const m = /(upper_arm|forearm)\.?([LR])$/.exec(bones[leader(v)].name);
    return m ? m[2] : "";
  });
  return { pick, side };
}

/** The surface points in the world each frame (`update`), and a point's depth behind them with the way out (`depth`). */
export function makeBodyProxy(mesh, { pick, side }, { reach = 0.9 } = {}) {
  const N = pick.length;
  const ARM = Uint8Array.from(side, (s) => (s === "L" ? 1 : s === "R" ? 2 : 0));
  let skipArm = 0; // (1 the left arm, 2 the right, 3 both: the arms holding the weapon now asked about)
  const P = mesh.geometry.attributes.position, NR = mesh.geometry.attributes.normal, SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight;
  const P0 = new Float32Array(N * 3), N0 = new Float32Array(N * 3), W = new Float32Array(N * 4), I = new Int32Array(N * 4);
  pick.forEach((v, i) => {
    P0.set([P.getX(v), P.getY(v), P.getZ(v)], 3 * i);
    N0.set(NR ? [NR.getX(v), NR.getY(v), NR.getZ(v)] : [0, 1, 0], 3 * i);
    for (let k = 0; k < 4; k++) (W[4 * i + k] = SW.getComponent(v, k)), (I[4 * i + k] = SI.getComponent(v, k));
  });
  const X = new Float32Array(N * 3), NX = new Float32Array(N * 3);
  const sk = mesh.skeleton;
  const M = new Float32Array(sk.bones.length * 16);
  const mA = new Matrix4(), mB = new Matrix4(), mT = new Matrix4();
  // (only the bones some point is skinned to: the hands and fingers lead none of them)
  const USED = Int32Array.from(new Set(Array.from(I).filter((b, k) => W[k] !== 0)));
  // (the blend's reach about twice the points' spacing over him; the grid's cells as big, so a query looks only in its own
  // cell and the 26 round it. Measured on 5000 points round his skin, .scratch/weapons/proxyacc.mjs: 1000 points at reach
  // 1.6 erred by 0.20 on average and called 3.4% of them on the wrong side; 2500 at 0.9, by 0.11 and 1.7%)
  const REACH = reach;
  const CELL = reach;
  const n3d = [0, 0, 0], n3i = [0, 0, 0];
  // The grid: a flat box of cells over his points' bounds, filled by a counting sort each frame (each cell's points in
  // their own order, so every sum in `depth` adds in the same order the Map of arrays did) — the Map and an array a cell
  // made each frame were 80% of this file's time (.scratch/fix/prof: 0.66 ms a frame at 4500 points). Each class of point
  // (the body, the left arm, the right) keeps its own bounds: a query more than a cell outside every class it counts has
  // no point in its 27 cells, and is far from him at once.
  const CX = new Int32Array(N), CY = new Int32Array(N), CZ = new Int32Array(N), CELLOF = new Int32Array(N), ITEMS = new Int32Array(N);
  let START = new Int32Array(1);
  let gx0 = 0, gy0 = 0, gz0 = 0, gnx = 0, gny = 0, gnz = 0;
  const box = [0, 1, 2].map(() => new Int32Array(6)); // per class (ARM 0, 1, 2): min x y z, max x y z
  const qb = new Int32Array(6);
  /** The cell's points, as [from, to) in ITEMS, or none (−1 into `rng`). */
  const cellAt = (ix, iy, iz) => {
    const x = ix - gx0, y = iy - gy0, z = iz - gz0;
    if (x < 0 || y < 0 || z < 0 || x >= gnx || y >= gny || z >= gnz) return -1;
    return (x * gny + y) * gnz + z;
  };
  /** Any point counted (not in an arm left out) within a cell of (ix, iy, iz)? */
  const near = (ix, iy, iz) => {
    qb[0] = qb[1] = qb[2] = 1 << 30;
    qb[3] = qb[4] = qb[5] = -(1 << 30);
    for (let c = 0; c < 3; c++) {
      if (c & skipArm) continue;
      const b = box[c];
      if (b[0] > b[3]) continue;
      for (let k = 0; k < 3; k++) (qb[k] = Math.min(qb[k], b[k])), (qb[k + 3] = Math.max(qb[k + 3], b[k + 3]));
    }
    return ix >= qb[0] - 1 && ix <= qb[3] + 1 && iy >= qb[1] - 1 && iy <= qb[4] + 1 && iz >= qb[2] - 1 && iz <= qb[5] + 1;
  };
  return {
    update() {
      // (the skeleton's matrices for this frame's pose, now, mid-frame: the renderer's own update comes after the arms are
      // posed, and the checks read these — tools/test.mjs's blade-on-screen test reads the skinned mesh after the pass)
      sk.update();
      const bm = sk.boneMatrices;
      mT.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
      for (let u = 0; u < USED.length; u++) {
        const b = USED[u];
        mB.fromArray(bm, b * 16);
        mA.copy(mT).multiply(mB).multiply(mesh.bindMatrix);
        M.set(mA.elements, b * 16);
      }
      for (const b of box) (b[0] = b[1] = b[2] = 1 << 30), (b[3] = b[4] = b[5] = -(1 << 30));
      for (let i = 0; i < N; i++) {
        const px = P0[3 * i], py = P0[3 * i + 1], pz = P0[3 * i + 2], nx = N0[3 * i], ny = N0[3 * i + 1], nz = N0[3 * i + 2];
        let x = 0, y = 0, z = 0, a = 0, c = 0, d = 0;
        for (let k = 0; k < 4; k++) {
          const w = W[4 * i + k];
          if (!w) continue;
          const o = I[4 * i + k] * 16;
          x += w * (M[o] * px + M[o + 4] * py + M[o + 8] * pz + M[o + 12]);
          y += w * (M[o + 1] * px + M[o + 5] * py + M[o + 9] * pz + M[o + 13]);
          z += w * (M[o + 2] * px + M[o + 6] * py + M[o + 10] * pz + M[o + 14]);
          a += w * (M[o] * nx + M[o + 4] * ny + M[o + 8] * nz);
          c += w * (M[o + 1] * nx + M[o + 5] * ny + M[o + 9] * nz);
          d += w * (M[o + 2] * nx + M[o + 6] * ny + M[o + 10] * nz);
        }
        const l = Math.sqrt(a * a + c * c + d * d) || 1;
        X[3 * i] = x, X[3 * i + 1] = y, X[3 * i + 2] = z;
        NX[3 * i] = a / l, NX[3 * i + 1] = c / l, NX[3 * i + 2] = d / l;
        const ix = (CX[i] = Math.floor(x / CELL)), iy = (CY[i] = Math.floor(y / CELL)), iz = (CZ[i] = Math.floor(z / CELL));
        const b = box[ARM[i]];
        if (ix < b[0]) b[0] = ix;
        if (iy < b[1]) b[1] = iy;
        if (iz < b[2]) b[2] = iz;
        if (ix > b[3]) b[3] = ix;
        if (iy > b[4]) b[4] = iy;
        if (iz > b[5]) b[5] = iz;
      }
      // the counting sort
      gx0 = Math.min(box[0][0], box[1][0], box[2][0]), gy0 = Math.min(box[0][1], box[1][1], box[2][1]), gz0 = Math.min(box[0][2], box[1][2], box[2][2]);
      gnx = N ? Math.max(box[0][3], box[1][3], box[2][3]) - gx0 + 1 : 0;
      gny = N ? Math.max(box[0][4], box[1][4], box[2][4]) - gy0 + 1 : 0;
      gnz = N ? Math.max(box[0][5], box[1][5], box[2][5]) - gz0 + 1 : 0;
      const cells = gnx * gny * gnz;
      if (START.length < cells + 1) START = new Int32Array(Math.ceil((cells + 1) * 1.5));
      START.fill(0, 0, cells + 1);
      for (let i = 0; i < N; i++) START[(CELLOF[i] = ((CX[i] - gx0) * gny + (CY[i] - gy0)) * gnz + (CZ[i] - gz0)) + 1]++;
      for (let c = 0; c < cells; c++) START[c + 1] += START[c];
      // (placed from the back, the last point first, each cell filled from its end: its points come out in their order)
      for (let i = N - 1; i >= 0; i--) {
        const c = CELLOF[i];
        ITEMS[--START[c + 1]] = i;
      }
      // (START[c + 1] is now each cell's start; shifted down by one, START[c]..START[c + 1] is cell c)
      for (let c = 0; c < cells; c++) START[c] = START[c + 1];
      START[cells] = N;
    },
    /** Which arms to leave out of `depth`: "L", "R", "LR" or "". */
    skipArms(s) {
      skipArm = (s.includes("L") ? 1 : 0) | (s.includes("R") ? 2 : 0);
    },
    /**
     * How far `p` is behind the skin (> 0 inside), past `margin` out from it; `normal` the way out. Far from him: −∞.
     * Smooth: every surface point within REACH weighed by (1 − (d/REACH)²)², its plane's distance and normal blended by
     * those weights (the nearest three alone switched as the third changed, and a weapon kept out by it popped: the
     * greatsword's tip jerked 4× its own motion's worst).
     */
    depth(p, margin, normal) {
      const ix = Math.floor(p.x / CELL), iy = Math.floor(p.y / CELL), iz = Math.floor(p.z / CELL);
      if (!near(ix, iy, iz)) return -Infinity; // (no point it counts in its 27 cells: as the search below finds)
      const R2 = REACH * REACH;
      let sw = 0, sd = 0, nx = 0, ny = 0, nz = 0;
      n3d[0] = n3d[1] = n3d[2] = Infinity;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const cell = cellAt(ix + a, iy + b, iz + c);
        if (cell < 0) continue;
        for (let e = START[cell], end = START[cell + 1]; e < end; e++) {
          const i = ITEMS[e];
          if (ARM[i] & skipArm) continue;
          const dx = p.x - X[3 * i], dy = p.y - X[3 * i + 1], dz = p.z - X[3 * i + 2];
          const q = dx * dx + dy * dy + dz * dz;
          const plane = dx * NX[3 * i] + dy * NX[3 * i + 1] + dz * NX[3 * i + 2];
          if (q < n3d[2]) {
            if (q < n3d[0]) (n3d[2] = n3d[1]), (n3i[2] = n3i[1]), (n3d[1] = n3d[0]), (n3i[1] = n3i[0]), (n3d[0] = q), (n3i[0] = i);
            else if (q < n3d[1]) (n3d[2] = n3d[1]), (n3i[2] = n3i[1]), (n3d[1] = q), (n3i[1] = i);
            else (n3d[2] = q), (n3i[2] = i);
          }
          if (q >= R2) continue;
          const w = (1 - q / R2) ** 2;
          sw += w;
          sd += w * plane;
          nx += w * NX[3 * i], ny += w * NX[3 * i + 1], nz += w * NX[3 * i + 2];
        }
      }
      if (n3d[0] === Infinity) return -Infinity;
      // (further than REACH from every point — well inside, or out past a thin part: the nearest three's planes, as the
      // dense skin is measured; the nearest one's alone called points just past a cape's edge 1.3 inside, for a frame)
      let s;
      if (sw > 1e-6) s = sd / sw;
      else {
        // (the true nearest three, looked for two cells out: the first ring's "nearest" were often on another part)
        n3d[0] = n3d[1] = n3d[2] = Infinity;
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
          const cell = cellAt(ix + a, iy + b, iz + c);
          if (cell < 0) continue;
          for (let e = START[cell], end = START[cell + 1]; e < end; e++) {
            const i = ITEMS[e];
            if (ARM[i] & skipArm) continue;
            const q = (p.x - X[3 * i]) ** 2 + (p.y - X[3 * i + 1]) ** 2 + (p.z - X[3 * i + 2]) ** 2;
            if (q < n3d[2]) {
              if (q < n3d[0]) (n3d[2] = n3d[1]), (n3i[2] = n3i[1]), (n3d[1] = n3d[0]), (n3i[1] = n3i[0]), (n3d[0] = q), (n3i[0] = i);
              else if (q < n3d[1]) (n3d[2] = n3d[1]), (n3i[2] = n3i[1]), (n3d[1] = q), (n3i[1] = i);
              else (n3d[2] = q), (n3i[2] = i);
            }
          }
        }
        let m = 0;
        s = 0;
        nx = ny = nz = 0;
        for (let k = 0; k < 3; k++) {
          const i = n3i[k];
          if (n3d[k] === Infinity) continue;
          s += (p.x - X[3 * i]) * NX[3 * i] + (p.y - X[3 * i + 1]) * NX[3 * i + 1] + (p.z - X[3 * i + 2]) * NX[3 * i + 2];
          nx += NX[3 * i], ny += NX[3 * i + 1], nz += NX[3 * i + 2];
          m++;
        }
        s /= m;
      }
      if (normal) {
        // (deeper than the blend reaches: the nearest point's own way out — "up" there sent a pommel deep in his belly
        // further in)
        normal.set(nx, ny, nz);
        if (normal.lengthSq() < 1e-10) normal.set(0, 1, 0);
        normal.normalize();
      }
      return margin - s;
    },
  };
}

/**
 * Points on a held weapon to keep out of him, in its own space: slices along its whole length every `step`, each slice's
 * outer edges (±Y, its width — a blade's edges, a crossguard's quillons, an axe's head), its sides if it is thick, and its
 * middle — all but the grip's core inside the fists (|x|, |y| < `core` from `fist[0]` to `fist[1]` along it: the lower
 * hand's place too on a two-handed grip; a staff's butt end and a haft's foot are kept).
 */
export function weaponSamples(w, fist = [-0.9, 1.0], core = 0.55, step = 0.6) {
  const slices = new Map();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), p = new Vector3();
  for (const m of w.meshes) {
    const P = m.geometry.attributes.position, I = m.geometry.index;
    const n = I ? I.count : P.count;
    const at = (k, v) => v.fromBufferAttribute(P, I ? I.getX(k) : k);
    for (let t = 0; t < n; t += 3) {
      at(t, a), at(t + 1, b), at(t + 2, c);
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6 - i; j++) {
        p.copy(a).multiplyScalar(1 - i / 6 - j / 6).addScaledVector(b, i / 6).addScaledVector(c, j / 6);
        const k = Math.round(p.z / step);
        const s = slices.get(k) || { lo: Infinity, hi: -Infinity, x: 0 };
        s.lo = Math.min(s.lo, p.y);
        s.hi = Math.max(s.hi, p.y);
        s.x = Math.max(s.x, Math.abs(p.x));
        slices.set(k, s);
      }
    }
  }
  const out = [];
  const inFist = (q) => q.z >= fist[0] && q.z <= fist[1] && Math.abs(q.x) < core && Math.abs(q.y) < core;
  for (const [k, s] of [...slices].sort((x, y) => x[0] - y[0])) {
    const z = k * step;
    const m = (s.lo + s.hi) / 2;
    for (const q of [new Vector3(0, s.lo, z), new Vector3(0, s.hi, z), new Vector3(0, m, z), ...(s.x > 0.4 ? [new Vector3(s.x, m, z), new Vector3(-s.x, m, z)] : [])]) if (!inFist(q)) out.push(q);
  }
  return out;
}
