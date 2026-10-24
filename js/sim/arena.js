// The floor's shape: where the fight can go. Every arena is the plain circle of ARENA.R unless content/arenas.js gives it a
// polygon — the Ash Floor's, from its image (the owner, 2026-10-12: "It should be possible to go up the stairs to the altar as
// well, improve the boundary of the arena"). The circle's arithmetic is exactly what the sim always did, so the other fights
// play as before. Pure: no randomness, no clock.
import { ARENA } from "../config.js?v=48fd128-df87a96f";
import { ARENA_SHAPES } from "../content/arenas.js?v=48fd128-df87a96f";
import { WALK_EDITS } from "../content/walkedits.js?v=48fd128-df87a96f";

/**
 * The shape for an arena id:
 *   R             the farthest the floor reaches from the middle (what sizes the camera's widest view and the floods)
 *   out(x, y)     how far a point is outside the edge (negative: inside, by that much)
 *   keep(o, m)    puts o ({x, y}) back at least m inside the edge; returns the outward normal [nx, ny] if it had to, else null
 *   edge(a, m)    the point m inside the edge straight out from the middle at angle a
 *   poly          the polygon, or null for the circle
 */
export function arenaShape(id) {
  // (made once an id: the Bog's walk edits over its grid took 60-80 ms every World. Frozen, as every fight of that arena
  // shares it — nothing writes into a shape; the map editor swaps a whole new one into w.arena)
  let shape = SHAPES.get(id);
  if (shape) return shape;
  const sh = ARENA_SHAPES[id];
  const ed = WALK_EDITS[id];
  shape = ed && sh ? shapeFromCells(walkCells(id, ed), sh) : sh?.grid ? gridShape(sh.grid, sh.spawn) : sh?.poly ? polygon(sh.poly) : CIRCLE;
  // (its own bell, where it has one: the Bog Shrine's — world.js, the bell entrance; and the Drowned Hall's drain grates, the
  // King's geysers' places — content/bosses.js)
  if (sh?.bell || sh?.grates) shape = { ...shape, ...(sh.bell ? { bell: sh.bell } : {}), ...(sh.grates ? { grates: sh.grates } : {}) };
  shape = Object.freeze(shape);
  SHAPES.set(id, shape);
  return shape;
}
const SHAPES = new Map();
/** Forget the shapes made (one id's, or all): for when the walk edits change while the page runs (ui/mapedit.js saves). */
export function forgetArenaShape(id) {
  if (id === undefined) SHAPES.clear();
  else SHAPES.delete(id);
}

/**
 * The walk area as cells, for the edit mode and the owner's changes: the map's own grid (Camp 2.0), or its polygon filled
 * into one (the Ash Floor: 1-unit cells, the floor's edge itself — its margin is the body's, as for the polygon); with
 * `ed` (content/walkedits.js) laid over it. { x0, y0, cell, nx, ny, margin, inside: Uint8Array }
 */
export function walkCells(id, ed = null) {
  const sh = ARENA_SHAPES[id];
  if (!sh) return null;
  let g;
  if (sh.grid) {
    const { x0, y0, cell, nx, ny, margin = 0 } = sh.grid;
    g = { x0, y0, cell, nx, ny, margin, inside: new Uint8Array(nx * ny) };
    sh.grid.rows.forEach((runs, j) => {
      for (let k = 0; k < runs.length; k += 2) g.inside.fill(1, j * nx + runs[k], j * nx + runs[k] + runs[k + 1]);
    });
  } else if (sh.poly) {
    const xs = sh.poly.map((p) => p[0]), ys = sh.poly.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)) - 16, y0 = Math.floor(Math.min(...ys)) - 16;
    const nx = Math.ceil(Math.max(...xs)) + 16 - x0, ny = Math.ceil(Math.max(...ys)) + 16 - y0;
    g = { x0, y0, cell: 1, nx, ny, margin: 0, inside: new Uint8Array(nx * ny) };
    const n = sh.poly.length;
    // (a row at a time: where each edge crosses it, worked out once, then the cells walked left to right — the same
    // even-odd test with the same crossings as a cell at a time, which tried every edge for each of the floor's 100,000
    // cells as a fight loaded)
    const xs2 = [];
    for (let j = 0; j < ny; j++) {
      const y = y0 + j + 0.5;
      xs2.length = 0;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const [ax, ay] = sh.poly[b], [bx, by] = sh.poly[a];
        if (ay > y !== by > y) xs2.push(((bx - ax) * (y - ay)) / (by - ay) + ax);
      }
      xs2.sort((p, q) => p - q);
      // (inside: an odd number of crossings to the right of the cell's middle, x < crossing)
      let k = 0;
      for (let i = 0; i < nx; i++) {
        const x = x0 + i + 0.5;
        while (k < xs2.length && xs2[k] <= x) k++;
        if ((xs2.length - k) & 1) g.inside[j * nx + i] = 1;
      }
    }
  } else return null;
  if (ed && ed.nx === g.nx && ed.ny === g.ny && ed.x0 === g.x0 && ed.y0 === g.y0) {
    for (const [j, i, c] of ed.add || []) g.inside.fill(1, j * g.nx + i, j * g.nx + i + c);
    for (const [j, i, c] of ed.rem || []) g.inside.fill(0, j * g.nx + i, j * g.nx + i + c);
  } else if (ed) {
    // (the owner's edits are runs on the grid they were drawn on: laid on a rebuilt grid they would land in the wrong cells,
    // so they are left off — said aloud, as before this they went silently)
    console.warn(`walk edits for "${id}" left off: drawn on grid ${ed.x0},${ed.y0} ${ed.nx}x${ed.ny}, the floor's is now ${g.x0},${g.y0} ${g.nx}x${g.ny}`);
  }
  return g;
}

/** A floor shape from cells (walkCells): the grid's own, with the map's polygon kept for what draws it (the Ash Floor's). */
export function shapeFromCells(c, sh = {}) {
  const rows = [];
  for (let j = 0; j < c.ny; j++) {
    const r = [];
    let i = 0;
    while (i < c.nx) {
      if (!c.inside[j * c.nx + i]) {
        i++;
        continue;
      }
      const a = i;
      while (i < c.nx && c.inside[j * c.nx + i]) i++;
      r.push(a, i - a);
    }
    rows.push(r);
  }
  const g = { ...(sh.grid || {}), x0: c.x0, y0: c.y0, cell: c.cell, nx: c.nx, ny: c.ny, margin: c.margin, rows };
  if (!sh.grid) g.smooth = 1;
  const shape = gridShape(g, sh.spawn || [0, 0]);
  if (sh.poly) shape.poly = sh.poly;
  return shape;
}

const CIRCLE = {
  R: ARENA.R,
  poly: null,
  out: (x, y) => Math.hypot(x, y) - ARENA.R,
  keep(o, m) {
    const d = Math.hypot(o.x, o.y);
    const lim = ARENA.R - m;
    if (d <= lim) return null;
    const k = lim / d;
    o.x *= k;
    o.y *= k;
    return [o.x / d, o.y / d]; // (as the player's wall slide always took it, the floats unchanged)
  },
  edge: (a, m) => [Math.cos(a) * (ARENA.R - m), Math.sin(a) * (ARENA.R - m)],
};

function polygon(pts) {
  const n = pts.length;
  const R = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
  /** The nearest point of the edge to (x, y), and whether (x, y) is inside. */
  function nearest(x, y) {
    let best = Infinity, qx = 0, qy = 0, inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = pts[j], [bx, by] = pts[i];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      const ex = bx - ax, ey = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
      const px = ax + ex * t, py = ay + ey * t;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < best) (best = d), (qx = px), (qy = py);
    }
    return { qx, qy, d: Math.sqrt(best), inside };
  }
  return {
    R,
    poly: pts,
    out(x, y) {
      const { d, inside } = nearest(x, y);
      return inside ? -d : d;
    },
    keep(o, m) {
      let moved = null;
      // (a few rounds: in a corner the edge it is pushed off may bring it within m of the other)
      for (let k = 0; k < 3; k++) {
        const { qx, qy, d, inside } = nearest(o.x, o.y);
        if (inside && d >= m - 1e-6) break;
        // the outward normal: from the point to the edge when inside, from the edge to the point when outside
        let nx = inside ? qx - o.x : o.x - qx, ny = inside ? qy - o.y : o.y - qy;
        const l = Math.hypot(nx, ny);
        if (l < 1e-9) (nx = qx), (ny = qy); // (exactly on the edge: outward is away from the middle, near enough)
        const ln = Math.hypot(nx, ny) || 1;
        nx /= ln; ny /= ln;
        o.x = qx - nx * m;
        o.y = qy - ny * m;
        moved = [nx, ny];
      }
      return moved;
    },
    edge(a, m) {
      // the nearest crossing of the ray from the middle with the edge, then m back toward the middle
      const dx = Math.cos(a), dy = Math.sin(a);
      let t = R;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [ax, ay] = pts[j], [bx, by] = pts[i];
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const s = (ax * ey - ay * ex) / den; // along the ray
        const u = (ax * dy - ay * dx) / den; // along the edge
        if (s > 0 && u >= 0 && u <= 1) t = Math.min(t, s);
      }
      const r = Math.max(0, t - m);
      return [dx * r, dy * r];
    },
  };
}

// A floor given as a grid of walkable cells (Camp 2.0: its paths, stairs, bridges and docks, any shape, holes and all). Its
// signed distance to the edge is worked out once (a two-pass chamfer over the cells, in units: negative inside); `keep`
// slides a body down its slope back in, `out` reads it between the cells' middles.
function gridShape(g, spawn = [0, 0]) {
  const { x0, y0, cell, nx, ny } = g;
  const inside = new Uint8Array(nx * ny);
  g.rows.forEach((runs, j) => {
    for (let k = 0; k < runs.length; k += 2) inside.fill(1, j * nx + runs[k], j * nx + runs[k] + runs[k + 1]);
  });
  // (g.margin: the grid holds where a body's MIDDLE may stand — the region a body of that margin keeps clear of everything,
  // worked out by the tool that made it — so the edge is moved out by it here: "out" then measures as for any floor, and
  // keep(o, margin) holds the middle on exactly that region. Growing the region instead, for the sim to shrink back, filled
  // the gaps round a single post on a path, and Camp 2.0's hero stood on fence posts — tools/camp2/clip.py.)
  const shift = g.margin || 0;
  // (the distance, in cells, from each cell to the nearest cell of the other kind)
  const dist = (want) => {
    const d = new Float32Array(nx * ny).fill(1e9);
    for (let i = 0; i < nx * ny; i++) if (inside[i] !== want) d[i] = 0;
    const D = Math.SQRT2;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 1);
        if (j > 0) {
          d[k] = Math.min(d[k], d[k - nx] + 1);
          if (i > 0) d[k] = Math.min(d[k], d[k - nx - 1] + D);
          if (i < nx - 1) d[k] = Math.min(d[k], d[k - nx + 1] + D);
        }
      }
    for (let j = ny - 1; j >= 0; j--)
      for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i;
        if (i < nx - 1) d[k] = Math.min(d[k], d[k + 1] + 1);
        if (j < ny - 1) {
          d[k] = Math.min(d[k], d[k + nx] + 1);
          if (i < nx - 1) d[k] = Math.min(d[k], d[k + nx + 1] + D);
          if (i > 0) d[k] = Math.min(d[k], d[k + nx - 1] + D);
        }
      }
    return d;
  };
  const din = dist(1), dout = dist(0);
  const sd = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) sd[i] = (inside[i] ? -(din[i] - 0.5) : dout[i] - 0.5) * cell - shift;
  // (g.smooth: the distance field blurred, in cells — the walk edge of a painted floor is a staircase of 1-unit cells, and
  // its every inside corner caught the hero as he slid along it: held one way for 2 s, 56% of runs in Camp 2.0 stopped dead
  // — the owner, 2026-10-12: "the pathing should be smooth so that there are no hard edges to get stuck in suddenly";
  // tools/camp2/stuck.mjs)
  if (g.smooth) {
    const r = Math.ceil(g.smooth * 3), k = [];
    for (let i = -r; i <= r; i++) k.push(Math.exp(-(i * i) / (2 * g.smooth * g.smooth)));
    const ks = k.reduce((a, b) => a + b, 0);
    const tmp = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let acc = 0;
        for (let q = -r; q <= r; q++) acc += k[q + r] * sd[j * nx + Math.min(nx - 1, Math.max(0, i + q))];
        tmp[j * nx + i] = acc / ks;
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let acc = 0;
        for (let q = -r; q <= r; q++) acc += k[q + r] * tmp[Math.min(ny - 1, Math.max(0, j + q)) * nx + i];
        sd[j * nx + i] = acc / ks;
      }
  }
  const at = (i, j) => sd[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  const out = (x, y) => {
    const fx = (x - x0) / cell - 0.5, fy = (y - y0) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    // (off the grid: outside, by how far)
    const off = Math.max(0, x0 - x, x - (x0 + nx * cell), y0 - y, y - (y0 + ny * cell));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v + off;
  };
  const xs = [x0, x0 + nx * cell], ys = [y0, y0 + ny * cell];
  return {
    R: Math.max(...xs.flatMap((x) => ys.map((y) => Math.hypot(x, y)))),
    // (the grid's rectangle: what the camera frames at its widest)
    poly: [[xs[0], ys[0]], [xs[1], ys[0]], [xs[1], ys[1]], [xs[0], ys[1]]],
    spawn,
    out,
    glide: !!g.glide, // (player.js move: keep his speed sliding along the edge — a walk, not a fight)
    // (the edge's outward direction judged over g.glide units either side — its line, not the bump under the hand)
    wideNormal(x, y) {
      const e = typeof g.glide === "number" ? g.glide : 6;
      const gx = out(x + e, y) - out(x - e, y), gy = out(x, y + e) - out(x, y - e), l = Math.hypot(gx, gy) || 1;
      return [gx / l, gy / l];
    },
    keep(o, m) {
      let moved = null;
      for (let k = 0; k < 4; k++) {
        const d = out(o.x, o.y) + m;
        if (d <= 0) break;
        const e = 0.5;
        let gx = out(o.x + e, o.y) - out(o.x - e, o.y), gy = out(o.x, o.y + e) - out(o.x, o.y - e);
        const l = Math.hypot(gx, gy) || 1;
        gx /= l; gy /= l;
        o.x -= gx * (d + 0.05);
        o.y -= gy * (d + 0.05);
        moved = [gx, gy];
      }
      return moved;
    },
    edge(a, m) {
      // (along the ray from the spawn, the last point still m inside: found in 2-unit steps, then halved down to a hair —
      // the steps alone left it anywhere up to 2 further in)
      const c = Math.cos(a), sn = Math.sin(a);
      let lo = -1;
      let r = 0;
      for (; r < 800; r += 2) {
        if (out(spawn[0] + c * r, spawn[1] + sn * r) > -m) break;
        lo = r;
      }
      if (lo < 0) return spawn;
      let hi = Math.min(r, lo + 2);
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (out(spawn[0] + c * mid, spawn[1] + sn * mid) > -m) hi = mid;
        else lo = mid;
      }
      return [spawn[0] + c * lo, spawn[1] + sn * lo];
    },
  };
}
