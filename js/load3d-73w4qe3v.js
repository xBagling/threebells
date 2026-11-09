import {
  __preload,
  BACKDROP_ARENAS
} from "./main-fbvedqc5.js?v=052f365-86c048e2";

// site/js/gfx3d/load3d.js
var tbMark = (n) => {
  try {
    performance.mark("tb:" + n);
  } catch {}
};
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
function preload3D({ bosses = [], lean = false, hi = true } = {}) {
  if (!ready) {
    let opened;
    core = new Promise((go) => opened = go);
    ready = (async () => {
      const [{ makeRenderer3D }, { GLTFLoader }, { loadGardenPaint }, { BOSS_MODELS }] = await Promise.all([(__preload("xx87sy3g"), import("./render3d-xx87sy3g.js?v=052f365-86c048e2")), (__preload("hy8wrs0p"), import("./gltf-hy8wrs0p.js?v=052f365-86c048e2")), (__preload("48h2rvav"), import("./paint3d-48h2rvav.js?v=052f365-86c048e2")), (__preload("ny6g9683"), import("./boss-profiles-ny6g9683.js?v=052f365-86c048e2"))]);
      const loader = new GLTFLoader;
      const assets = { hero: null, gnasher: null, garden: null, bell: null, bosses: {}, chests: {}, backdrops };
      const r = { assets, loader, makeRenderer: (canvas, opts = {}) => makeRenderer3D(canvas, { ...opts, assets }), missing: (id) => missing(r, id) };
      opened(r);
      tbMark("core");
      const [hero, gnasher, garden] = await Promise.all([loadFirst(loader, HERO_URLS), lean ? null : loadFirst(loader, [BOSS_MODELS.gnasher.url]), lean ? null : loadGardenPaint()]);
      tbMark("core-in");
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
    if (hi)
      for (const id of bosses)
        backdrops[arenaOf(bossSync.BOSSES, id)]?.fetchHi?.();
    return r;
  });
}
var fetchHi = (id) => backdrops[arenaOf(bossSync?.BOSSES || {}, id)]?.fetchHi?.() || Promise.resolve();
async function prefetch(id, { hi = false, extra = [] } = {}) {
  const get = (u) => fetch(u, { priority: "low" }).then((r) => r.ok ? r.arrayBuffer() : null).catch(() => null);
  const gltf = (u) => fetch(u, { priority: "low" }).then((r) => r.ok ? r.json() : null).then((g) => {
    const dir = u.slice(0, u.lastIndexOf("/") + 1);
    const bufs = (g?.buffers || []).filter((b) => !b.extensions?.EXT_meshopt_compression?.fallback);
    return Promise.all([...bufs, ...g?.images || []].map((b) => b.uri && !b.uri.startsWith("data:") ? get(dir + b.uri) : null));
  }).catch(() => null);
  const some = async (urls, n = 4) => {
    const q = [...urls];
    await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => {
      while (q.length)
        await q.shift()();
    }));
  };
  if (id === "camp2") {
    const { campFiles } = await (__preload("1pxp3v4p"), import("./camp3d-1pxp3v4p.js?v=052f365-86c048e2"));
    return some((await campFiles(id)).map((u) => () => get(u)));
  }
  const { BOSSES, BOSS_MODELS } = await info();
  const P = BOSS_MODELS[id], a = arenaOf(BOSSES, id);
  const meta = a ? await fetch(`art3d/${a}/${a}.json`, { priority: "low" }).then((r) => r.ok ? r.json() : null, () => null) : null;
  const ref = meta?.ref ? (await (__preload("rj0h0nxq"), import("./backdrop3d-rj0h0nxq.js?v=052f365-86c048e2"))).refFiles(a, meta) : { files: [], gltf: [], hi: [] };
  if (hi)
    return some(ref.hi.map((u) => () => get(u)));
  const jobs = [...ref.files.map((u) => () => get(u)), ...ref.gltf.map((u) => () => gltf(u))];
  if (P?.url)
    jobs.push(() => gltf(P.url));
  if (P?.chest)
    jobs.push(() => gltf(P.chest));
  for (const u of [...Object.values(P?.files || {}), ...extra])
    jobs.push(() => get(u));
  return some(jobs);
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
var info = () => bossInfo ??= Promise.all([(__preload("b12f7b88"), import("./bosses-b12f7b88.js?v=052f365-86c048e2")), (__preload("ny6g9683"), import("./boss-profiles-ny6g9683.js?v=052f365-86c048e2"))]).then(([{ BOSSES }, { BOSS_MODELS }]) => ({ BOSSES, BOSS_MODELS }));
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
  const { loadBackdrop } = await (__preload("rj0h0nxq"), import("./backdrop3d-rj0h0nxq.js?v=052f365-86c048e2"));
  await Promise.all(ids.map((id) => arenaOf(BOSSES, id)).filter(Boolean).map((a) => once(a, () => backdrops[a] != null, async () => {
    tbMark("arena:" + a);
    const bd = await loadBackdrop(a, { lean });
    tbMark("arena-in:" + a);
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
      tbMark("model:" + id);
      const a = await loadFirst(r.loader, [BOSS_MODELS[id].url]);
      tbMark("model-in:" + id);
      if (a && !r.assets.bosses[id])
        r.assets.bosses[id] = a;
      if (a && id === "gnasher")
        r.assets.gnasher ??= a;
    })),
    ...ids.filter((id) => BOSS_MODELS[id]?.chest).map((id) => once(`chest:${id}`, () => r.assets.chests[id] !== undefined, async () => {
      tbMark("chest:" + id);
      const a = await loadFirst(r.loader, [BOSS_MODELS[id].chest]);
      tbMark("chest-in:" + id);
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
    const { loadCamp } = await (__preload("1pxp3v4p"), import("./camp3d-1pxp3v4p.js?v=052f365-86c048e2"));
    tbMark("campload");
    const bd = await loadCamp(id);
    tbMark("campload-in");
    if (bd && B[id] == null)
      B[id] = bd;
  });
  if (!B[id])
    throw new Error("camp2 missing");
  return r;
}
export {
  fetchHi,
  prefetch,
  preload3D,
  preloadCamp
};
