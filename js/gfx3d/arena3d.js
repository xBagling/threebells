// The garden, put together (docs/3D-PLAN.md 4): the floor and the outer ground, the far hedges,
// the wall's stone, the trunks, one foliage card mesh for every canopy, bush, hedge and moss
// patch, apples and clovers with their outline hulls, lanterns with their hulls, flames and panes,
// the flowers and lupines, the grass, and the contact blobs. Everything is placed by layout3d.js
// (pure, and checked by the Bun layout tests) and built by the generators in props3d.js,
// foliage3d.js, grass3d.js and ground3d.js. No collision: the sim knows nothing of any of it.
//
// The CPU geometry is built once per page for a seed and tier (9.3) and shared by every fight's
// renderer, each of which uploads it to its own graphics context; materials are per renderer,
// because they share that renderer's `look` uniforms.
//
// Draws (main pass): outer ground, floor, far hedges, stone, trunks, foliage, apples + hull,
// lanterns + hull, flames, panes, clovers + hull, flowers, grass, contact blobs — 17. Shadow pass:
// stone, trunks, foliage, apples, lanterns, clovers — 6.
import { Group } from "./three-lib.js?v=8898846";
import { rng } from "../util.js?v=8898846";
import { gardenLayout, scatter, TIERS, CLOVER } from "./layout3d.js?v=8898846";
import { buildStoneGeo, STONE_LIGHT, buildTrunkGeo, BARK_LIGHT, lanternGeo, lanternHullGeo, lanternLightGeos, lanternLightMaterials, lanternPaint, LANTERN_LIGHT, appleGeo, applePaintGeo, appleDepth, APPLE_FILL, cloverGeos, flowerGeo, flowerMaterial, flowerInstances, flowerBox, paintMaterial, outlineMaterial, flattenHull, instanced, plain, fillMatrices, inst } from "./props3d.js?v=8898846";
import { foliageCards, buildFoliage } from "./foliage3d.js?v=8898846";
import { tuftGeo, buildGrass } from "./grass3d.js?v=8898846";
import { buildFloor, buildOuterGround, buildFarHedges, buildBlobs, floorMacro } from "./ground3d.js?v=8898846";
import { cellTable, atlasCells, barkCells, STONE_CELLS, APPLE_CELLS, CLOVER_CELLS, FLOWER_CELLS } from "./paint3d.js?v=8898846";

const cpu = new Map();

/** The garden's CPU side for a seed and tier: layout, scatter and every generated geometry. */
function cpuGarden(seed, tier) {
  const key = `${seed}:${tier}`;
  if (cpu.has(key)) return cpu.get(key);
  const T = TIERS[tier] || TIERS.high;
  const L = gardenLayout(seed);
  // Always the High tier's tufts: a lower tier draws the first N of them (4.4).
  const scat = scatter(rng(seed * 31 + 3), { tufts: TIERS.high.tufts, flowers: T.flowers }, L);
  const r = rng(seed * 977 + 5);
  const c = {
    L,
    scat,
    T,
    stone: buildStoneGeo(L),
    trunks: buildTrunkGeo(L, rng),
    lantern: lanternGeo(),
    lanternHull: lanternHullGeo(),
    lights: lanternLightGeos(L, r),
    apple: appleGeo(),
    clover: cloverGeos(),
    flower: flowerGeo(),
    flowers: flowerInstances(L, scat, r),
    tuft: tuftGeo(r),
    cards: foliageCards(L, rng, T.cards),
    atlasSeed: seed * 13 + 1,
  };
  cpu.set(key, c);
  return c;
}

/** Outline hulls take the size of whatever they are drawn into, in texels (materials3d.js). */
function sizeHull(mesh) {
  const u = mesh.material.userData.outline;
  mesh.onBeforeRender = (renderer) => {
    const rt = renderer.getRenderTarget();
    if (rt) u.uView.value.set(rt.width, rt.height);
  };
  return mesh;
}

/**
 * Whether the floor draws the painted macro map (M4b step 8): exactly ground3d.js floorMacro's
 * test (the map, its root samples and tiles.json floor.terraceBase), so the blob trim and the tuft
 * roots never assume a map the floor does not draw.
 */
export function floorUsesMacro(paint) {
  return !!floorMacro(paint);
}

/**
 * The static contact blobs, [x, y, radius, strength] each: under L3, L5 and BB1–BB5 (past the
 * shadow map and the macro map's reach), and, without the macro map (M4a), under the bed's trunks,
 * plinths and the topiary too; the macro map bakes those as contact bands (tools/3d/floor.py).
 */
export function contactSpots(L, macro) {
  const spots = [];
  for (const l of L.lanterns) if (!macro || l.r > 140) spots.push([l.x, l.y, l.r > 140 ? 6.5 : 5.5, l.r > 140 ? 0.6 : 0.45]);
  for (const b of L.bushes) spots.push([b.x, b.y, b.radius * 1.05, 0.62]);
  if (!macro) {
    for (const t of L.trees) spots.push([t.x, t.y, t.flare + 2.5, 0.5]);
    spots.push([L.topiary.x, L.topiary.y, L.topiary.radius + 1.5, 0.55]);
  }
  return spots;
}

/**
 * Build the garden for one renderer. `look` is that renderer's shared paint uniforms. Returns
 * { group, lanterns, fadeGroups, update(now), dispose() }: `lanterns` are the flame positions in
 * three coordinates, with `w` their strength × flicker, for the lantern light term (4.10);
 * `fadeGroups` the 16 fade groups (trees, lanterns, front bushes, the topiary; 4.11).
 * `paint` is the renderer's painted swatches (paint3d.js gardenTextures, M4b), or null for M4a's
 * flat colours; its textures are the renderer's, so dispose() never frees them.
 */
export function buildGarden(look, { seed = 1, tier = "high", paint = null } = {}) {
  const C = cpuGarden(seed, tier);
  const { L, scat, T } = C;
  const group = new Group();
  group.name = "garden";
  const add = (m) => (group.add(m), m);

  // The ground.
  add(buildOuterGround());
  add(buildFloor(look, paint));
  add(buildFarHedges(L));

  // Stone: blocks, capstones, copings, moss strips and the pillar. Painted (M4b) only when the
  // atlas has every stone cell; each texel then scales the flat colour by texel / cell mean.
  // Painted or flat, it takes the light the same way (STONE_LIGHT: its fill and lantern response).
  const stoneCells = cellTable(paint, STONE_CELLS);
  const stoneMat = stoneCells ? atlasCells(paintMaterial(look, { vertexColors: true, map: paint.atlas, ...STONE_LIGHT }), stoneCells, { key: "stone" }) : paintMaterial(look, { vertexColors: true, ...STONE_LIGHT });
  add(plain(C.stone, stoneMat, { cast: true, receive: true }));
  // Trunks (a fade group per tree, per vertex). Painted (M4b) when the atlas has the bark cell:
  // the bark repeats mirrored round and along each tube and scales the flat colour (ratio mode).
  const barkCell = cellTable(paint, ["bark"]);
  // Painted or flat, the trunks take the light the same way (BARK_LIGHT: a fill and the sun's lit edge).
  add(plain(C.trunks, barkCell ? barkCells(paintMaterial(look, { vertexColors: true, group: true, map: paint.atlas, ...BARK_LIGHT }), barkCell, paint.atlas.image.width) : paintMaterial(look, { vertexColors: true, group: true, ...BARK_LIGHT }), { cast: true }));
  // Every canopy, the topiary, the bushes, hedges, mounds and moss: one card mesh.
  add(buildFoliage(look, C.cards, rng(C.atlasSeed), paint));

  // Apples, riding their tree's fade group, with a thin dark outline. Painted (M4b) when the atlas
  // has the apple's cells: the body by its view projection (the glint upper right) and the stem
  // and leaf on a card above it (albedo cells; the leaf card casts no shadow and has no outline).
  const atlasSize = paint?.atlas?.image?.width || 1024;
  const apples = L.trees.flatMap((t) => t.apples.map((a) => ({ ...a, group: t.group })));
  const appleCells = cellTable(paint, APPLE_CELLS);
  const appleGeoUsed = appleCells ? (C.applePaint ||= applePaintGeo()) : C.apple;
  for (const g of new Set([C.apple, appleGeoUsed])) g.setAttribute("aGroup", inst(apples.map((a) => a.group), 1));
  const appleAt = apples.map((a) => [a.x, a.h, a.y, 0]);
  const appleMat = appleCells ? atlasCells(paintMaterial(look, { map: paint.atlas, alphaTest: 0.5, group: true, fill: APPLE_FILL }), appleCells, { key: "apple", maxLevel: 3, size: atlasSize }) : paintMaterial(look, { color: 0xb11d34, group: true, fill: APPLE_FILL });
  const appleMesh = add(instanced(appleGeoUsed, appleMat, apples.length, { cast: true }));
  if (appleCells) {
    const depth = appleDepth();
    appleMesh.customDepthMaterial = depth;
    appleMat.addEventListener("dispose", () => depth.dispose());
  }
  fillMatrices(appleMesh, appleAt);
  fillMatrices(add(sizeHull(instanced(C.apple, outlineMaterial(look, { color: 0x1a0708, warm: 0x3a1a08, px: 1.0, group: true }), apples.length))), appleAt);

  // Lanterns, their hull, flames and panes. `flick` is every lantern's flicker, shared by the flames,
  // the panes and (painted) the body's gold glow, in the hull's instance order (aLant).
  const flick = new Float32Array(8).fill(1);
  const lgrp = L.lanterns.map((l) => l.group);
  // Painted (M4b step 7) when the atlas has the lantern cell: the painting is the albedo and its
  // gold glows with the lantern's own flame (props3d.js lanternPaint).
  const lanternCell = cellTable(paint, ["lantern"]);
  const lanternGeoUsed = lanternCell ? (C.lanternPaint ||= lanternGeo({ paint: true })) : C.lantern;
  lanternGeoUsed.setAttribute("aGroup", inst(lgrp, 1));
  lanternGeoUsed.setAttribute("aLant", inst(L.lanterns.map((_, i) => i), 1));
  C.lanternHull.setAttribute("aGroup", inst(lgrp, 1));
  const lanAt = L.lanterns.map((l) => [l.x, 0, l.y, 0]);
  const lanternMat = lanternCell ? lanternPaint(paintMaterial(look, { vertexColors: true, group: true, lantLit: false, map: paint.atlas, ...LANTERN_LIGHT }), lanternCell.box[0], flick, { size: atlasSize }) : paintMaterial(look, { vertexColors: true, group: true, lantLit: false, ...LANTERN_LIGHT });
  fillMatrices(add(instanced(lanternGeoUsed, lanternMat, L.lanterns.length, { cast: true })), lanAt);
  fillMatrices(add(sizeHull(instanced(C.lanternHull, outlineMaterial(look, { color: 0x171410, group: true }), L.lanterns.length))), lanAt);
  const lm = lanternLightMaterials(look, flick);
  // Flames and panes are true light sources: they go on the glow layer (layer 1) too (5.6).
  add(plain(C.lights.flameGeo, lm.flame)).layers.enable(1);
  const panes = add(plain(C.lights.paneGeo, lm.pane));
  panes.renderOrder = 2;
  panes.layers.enable(1);

  // Clovers and their hull; on the lawn both write flattened depth (4.11). Painted (M4b) when the
  // atlas has the clover cells: a painted leaf and its light veins scale each leaf's dome shading
  // (ratio cells); the warm glints are their own albedo (atlasCells glints).
  const clAt = L.clovers.map((c) => [c.x, 0, c.y, c.yaw, c.across / CLOVER.across]);
  const cloverCells = cellTable(paint, CLOVER_CELLS);
  const cloverMat = cloverCells ? atlasCells(paintMaterial(look, { vertexColors: true, flatten: true, map: paint.atlas }), cloverCells, { key: "clover", maxLevel: 1, size: atlasSize, glints: true }) : paintMaterial(look, { vertexColors: true, flatten: true });
  const clovers = add(instanced(C.clover.geo, cloverMat, clAt.length, { cast: true, receive: true }));
  const cloverHull = add(sizeHull(instanced(C.clover.hull, flattenHull(outlineMaterial(look, { color: 0x010906, warm: 0x1a2a08 })), clAt.length)));
  fillMatrices(clovers, clAt);
  fillMatrices(cloverHull, clAt);
  // Each clover's soft shadow (V24) and the dark under its leaves (V8), drawn before the clovers
  // (render order 0.5 then 1; buildBlobs under): the leaves stand under 2 units, so the sun's own
  // shadow (it falls towards +z, the screen's lower left) hardly shows past them, where the
  // target's C1 and C2 sit in a shadow reaching about a third of their size out on that side.
  clovers.renderOrder = cloverHull.renderOrder = 1;
  add(buildBlobs(L.clovers.map((c) => [c.x, c.y + 0.28 * c.across, 0.6 * c.across, 0.75]), { under: true }));

  // Flowers and lupines. Painted (M4b) when the atlas has every flower cell: each part's box is
  // its painted cell's; else the drawn atlas's (flowerBox), as the flat build.
  const F = C.flowers;
  const flowerCells = cellTable(paint, FLOWER_CELLS);
  const boxOf = flowerCells ? (n) => flowerCells.box[FLOWER_CELLS.indexOf(n)].toArray() : flowerBox;
  C.flower.setAttribute("aFlower", inst(F.flower, 4));
  C.flower.setAttribute("aHead", inst(F.head.flatMap(boxOf), 4));
  C.flower.setAttribute("aLeaf", inst(F.leaf.flatMap(boxOf), 4));
  C.flower.setAttribute("aGroup", inst(F.group, 1));
  const flowerMat = flowerCells ? flowerMaterial(look, { atlas: paint.atlas, stem: boxOf("stem"), size: atlasSize }) : flowerMaterial(look);
  fillMatrices(add(instanced(C.flower, flowerMat, F.list.length, { receive: true })), F.list);

  // Grass: the tier's first N tufts; shadows received on Medium and High only. With the painted
  // macro map each tuft's root takes the floor's own colour under it (baked per tuft, M4b step 8).
  const macro = floorUsesMacro(paint);
  add(buildGrass(look, C.tuft, scat.tufts, T.tufts, { receive: tier !== "low", roots: macro ? paint.floorRoots : null }));
  add(buildBlobs(contactSpots(L, macro)));

  // The lantern light term's inputs, and the flicker (the view's own rng, a phase per lantern).
  const lanterns = L.lanterns.map((l) => ({ x: l.x, y: l.flame, z: l.y, w: 1 }));
  const fr = rng(seed * 7 + 99);
  const phase = lanterns.map(() => fr() * 6.283);
  const freq = lanterns.map(() => 5 + fr() * 5);
  const jitter = lanterns.map(() => 0);
  let lastStep = -1;
  function update(now) {
    lm.time.value = now;
    // ±4–8% at 5–10 Hz: a sine per lantern and a random step nine times a second (4.10).
    const step = Math.floor(now * 9);
    if (step !== lastStep) {
      lastStep = step;
      for (let i = 0; i < jitter.length; i++) jitter[i] = (fr() - 0.5) * 0.06;
    }
    for (let i = 0; i < lanterns.length; i++) {
      const f = 1 + 0.04 * Math.sin(2 * Math.PI * freq[i] * now + phase[i]) + jitter[i];
      lanterns[i].w = f;
      flick[i] = f;
    }
  }
  update(0);

  function dispose() {
    group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
    });
  }

  return { group, lanterns, fadeGroups: L.groups.map((g) => ({ ...g })), update, dispose };
}
