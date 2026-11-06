import {
  __preload,
  BACKDROP_ARENAS
} from "./main-wh4yj0z0.js?v=bf1d10c-62b06777";

// site/js/gfx3d/load3d.js
var ready = null;
var core = null;
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
function preload3D({ bosses = [], lean = false } = {}) {
  if (!ready) {
    let opened;
    core = new Promise((go) => opened = go);
    ready = (async () => {
      const [{ makeRenderer3D }, { GLTFLoader }, { loadGardenPaint }, { BOSS_MODELS }] = await Promise.all([(__preload("xts8kb1b"), import("./render3d-xts8kb1b.js?v=bf1d10c-62b06777")), (__preload("qv4jc8dc"), import("./gltf-qv4jc8dc.js?v=bf1d10c-62b06777")), (__preload("svjc2gav"), import("./paint3d-svjc2gav.js?v=bf1d10c-62b06777")), (__preload("n6f72qce"), import("./boss-profiles-n6f72qce.js?v=bf1d10c-62b06777"))]);
      const loader = new GLTFLoader;
      const assets = { hero: null, gnasher: null, garden: null, bell: null, bosses: {}, chests: {}, backdrops };
      const r = { assets, loader, makeRenderer: (canvas, opts = {}) => makeRenderer3D(canvas, { ...opts, assets }), missing: (id) => missing(r, id) };
      opened(r);
      const [hero, gnasher, garden] = await Promise.all([loadFirst(loader, HERO_URLS), lean ? null : loadFirst(loader, [BOSS_MODELS.gnasher.url]), lean ? null : loadGardenPaint()]);
      Object.assign(assets, { hero, garden });
      if (gnasher)
        assets.gnasher = gnasher, assets.bosses.gnasher = gnasher;
      return r;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  if (!bosses.length)
    return ready;
  const arenas = loadArenas(bosses, lean);
  return Promise.all([ready, (lean ? core : ready).then((r) => loadBosses(r, bosses, arenas))]).then(([r]) => {
    for (const id of bosses)
      backdrops[arenaOf(bossSync.BOSSES, id)]?.fetchHi?.();
    return r;
  });
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
var info = () => bossInfo ??= Promise.all([(__preload("04v7w43j"), import("./bosses-04v7w43j.js?v=bf1d10c-62b06777")), (__preload("n6f72qce"), import("./boss-profiles-n6f72qce.js?v=bf1d10c-62b06777"))]).then(([{ BOSSES }, { BOSS_MODELS }]) => ({ BOSSES, BOSS_MODELS }));
var arenaOf = (BOSSES, id) => BACKDROP_ARENAS.has(BOSSES[id]?.arena) ? BOSSES[id].arena : null;
var REFCAM_OFF = typeof location !== "undefined" && new URLSearchParams(location.search).get("refcam") === "0";
var wantsBell = (BOSSES, id) => {
  if (BOSSES[id]?.entrance !== "bell")
    return false;
  const bd = backdrops[arenaOf(BOSSES, id)];
  return REFCAM_OFF || !bd?.refBell && !bd?.bell3d;
};
async function loadArenas(ids, lean) {
  const { BOSSES } = await info();
  const { loadBackdrop } = await (__preload("yh93cp7x"), import("./backdrop3d-yh93cp7x.js?v=bf1d10c-62b06777"));
  await Promise.all(ids.map((id) => arenaOf(BOSSES, id)).filter(Boolean).map((a) => once(a, () => backdrops[a] != null, async () => {
    const bd = await loadBackdrop(a, { lean });
    if (bd && backdrops[a] == null)
      backdrops[a] = bd;
  })));
}
async function loadBosses(r, ids, arenas) {
  const { BOSSES, BOSS_MODELS } = await info();
  const bell = arenas.then(() => ids.some((id) => wantsBell(BOSSES, id)) ? once("bell", () => !!r.assets.bell, async () => {
    const a = await loadFirst(r.loader, ["art3d/bell/bell.gltf"]);
    if (a && !r.assets.bell)
      r.assets.bell = a;
  }) : null);
  await Promise.all([
    bell,
    ...ids.filter((id) => BOSS_MODELS[id]).map((id) => once(`boss:${id}`, () => !!r.assets.bosses[id], async () => {
      const a = await loadFirst(r.loader, [BOSS_MODELS[id].url]);
      if (a && !r.assets.bosses[id])
        r.assets.bosses[id] = a;
      if (a && id === "gnasher")
        r.assets.gnasher ??= a;
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
    const { loadCamp } = await (__preload("r7n72ntc"), import("./camp3d-r7n72ntc.js?v=bf1d10c-62b06777"));
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
