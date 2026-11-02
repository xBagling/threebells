import {
  __preload,
  BACKDROP_ARENAS
} from "./main-8rd3fg5z.js?v=8a852a6-6e389bbf";

// site/js/gfx3d/load3d.js
var ready = null;
var HERO_URLS = ["art3d/hero.gltf", "art3d/dev/ual-mannequin.glb"];
async function loadFirst(loader, urls) {
  for (const url of urls) {
    try {
      const g = await loader.loadAsync(url);
      return { url, scene: g.scene, animations: g.animations };
    } catch {}
  }
  return null;
}
var backdrops = {};
function preload3D({ bosses = [] } = {}) {
  if (!ready)
    ready = (async () => {
      const [{ makeRenderer3D }, { GLTFLoader }, { loadGardenPaint }, { BOSS_MODELS }] = await Promise.all([(__preload("ba1bfphp"), import("./render3d-ba1bfphp.js?v=8a852a6-6e389bbf")), (__preload("qv4jc8dc"), import("./gltf-qv4jc8dc.js?v=8a852a6-6e389bbf")), (__preload("4qgrvjyr"), import("./paint3d-4qgrvjyr.js?v=8a852a6-6e389bbf")), (__preload("p019r9js"), import("./boss-profiles-p019r9js.js?v=8a852a6-6e389bbf"))]);
      const loader = new GLTFLoader;
      const [hero, gnasher, garden] = await Promise.all([loadFirst(loader, HERO_URLS), loadFirst(loader, [BOSS_MODELS.gnasher.url]), loadGardenPaint()]);
      const assets = { hero, gnasher, garden, bell: null, bosses: { gnasher }, chests: {}, backdrops };
      const r = { assets, loader, makeRenderer: (canvas, opts = {}) => makeRenderer3D(canvas, { ...opts, assets }), missing: (id) => missing(r, id) };
      return r;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  if (!bosses.length)
    return ready;
  const arenas = loadArenas(bosses);
  return ready.then(async (r) => (await arenas, loadBosses(r, bosses)));
}
var loading = new Map;
function once(key, has, load) {
  if (has())
    return Promise.resolve();
  if (!loading.has(key))
    loading.set(key, load().finally(() => loading.delete(key)));
  return loading.get(key);
}
var bossInfo = null;
var info = () => bossInfo ??= Promise.all([(__preload("6zhbvbc2"), import("./bosses-6zhbvbc2.js?v=8a852a6-6e389bbf")), (__preload("p019r9js"), import("./boss-profiles-p019r9js.js?v=8a852a6-6e389bbf"))]).then(([{ BOSSES }, { BOSS_MODELS }]) => ({ BOSSES, BOSS_MODELS }));
var arenaOf = (BOSSES, id) => BACKDROP_ARENAS.has(BOSSES[id]?.arena) ? BOSSES[id].arena : null;
var REFCAM_OFF = typeof location !== "undefined" && new URLSearchParams(location.search).get("refcam") === "0";
var wantsBell = (BOSSES, id) => {
  if (BOSSES[id]?.entrance !== "bell")
    return false;
  const bd = backdrops[arenaOf(BOSSES, id)];
  return REFCAM_OFF || !bd?.refBell && !bd?.bell3d;
};
async function loadArenas(ids) {
  const { BOSSES } = await info();
  const { loadBackdrop } = await (__preload("56b0kd0s"), import("./backdrop3d-56b0kd0s.js?v=8a852a6-6e389bbf"));
  await Promise.all(ids.map((id) => arenaOf(BOSSES, id)).filter(Boolean).map((a) => once(a, () => backdrops[a] != null, async () => {
    const bd = await loadBackdrop(a);
    if (bd && backdrops[a] == null)
      backdrops[a] = bd;
  })));
}
async function loadBosses(r, ids) {
  const { BOSSES, BOSS_MODELS } = await info();
  const bell = ids.some((id) => wantsBell(BOSSES, id)) ? once("bell", () => !!r.assets.bell, async () => {
    const a = await loadFirst(r.loader, ["art3d/bell/bell.gltf"]);
    if (a && !r.assets.bell)
      r.assets.bell = a;
  }) : null;
  await Promise.all([
    bell,
    ...ids.filter((id) => BOSS_MODELS[id]).map((id) => once(`boss:${id}`, () => !!r.assets.bosses[id], async () => {
      const a = await loadFirst(r.loader, [BOSS_MODELS[id].url]);
      if (a && !r.assets.bosses[id])
        r.assets.bosses[id] = a;
    })),
    ...ids.filter((id) => BOSS_MODELS[id]?.chest).map((id) => once(`chest:${id}`, () => r.assets.chests[id] !== undefined, async () => {
      const a = await loadFirst(r.loader, [BOSS_MODELS[id].chest]);
      if (r.assets.chests[id] === undefined)
        r.assets.chests[id] = a || false;
    }))
  ]);
  return r;
}
function missing(r, id) {
  if (!bossSync)
    return true;
  const { BOSSES, BOSS_MODELS } = bossSync;
  const a = arenaOf(BOSSES, id);
  return !!BOSS_MODELS[id] && !r.assets.bosses[id] || !!a && !backdrops[a] || wantsBell(BOSSES, id) && !r.assets.bell || !!BOSS_MODELS[id]?.chest && r.assets.chests[id] === undefined;
}
var bossSync = null;
info().then((x) => bossSync = x, () => {});
async function preloadCamp(id = "camp2") {
  const r = await preload3D();
  const B = backdrops;
  await once(id, () => B[id] != null, async () => {
    const { loadCamp } = await (__preload("h8n5j04r"), import("./camp3d-h8n5j04r.js?v=8a852a6-6e389bbf"));
    const bd = await loadCamp(id);
    if (bd && B[id] == null)
      B[id] = bd;
  });
  if (!B[id])
    throw new Error("camp2 missing");
  return r;
}
export {
  preload3D,
  preloadCamp
};
