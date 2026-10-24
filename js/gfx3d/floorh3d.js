// The ground's height under a point of the floor, for the view (the sim is flat). Zero everywhere, except on an arena whose
// json carries a "walk" grid (tools/arena/walkable.py): the Ash Floor's stairs rise to its altar, 14.5 units up (the owner,
// 2026-10-12: "It should be possible to go up the stairs to the altar as well"). Everything drawn standing on the floor —
// the hero and his feet, the boss and hers, adds, shots, shadows, sparks, the chest, the telegraphs, damage numbers — takes
// its height from here.
let grid = null; // { x0, z0, cell, n, h: Float32Array }

/** Use an arena's height grid (ash.json "walk": heights in quarter units), or none (flat). */
export function setFloorHeights(walk) {
  grid = walk ? { x0: walk.x0, z0: walk.z0, cell: walk.cell, n: walk.n, h: Float32Array.from(walk.h, (v) => v / 4) } : null;
}

/** The ground's height at (x, z) on the floor (sim x, y), bilinear over the grid. */
export function floorAt(x, z) {
  if (!grid) return 0;
  const { x0, z0, cell, n, h } = grid;
  // (the grid's values are at the cells' middles)
  const fx = (x - x0) / cell - 0.5, fz = (z - z0) / cell - 0.5;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return 0;
  const u = fx - i, v = fz - j;
  const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Whether any arena heights are in use. */
export const hasFloorHeights = () => grid != null;
