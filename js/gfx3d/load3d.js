// The way into the 3D view (a test, docs/3D-PLAN.md 2.6). main.js imports this only when 3D is
// chosen, so the 2D game never downloads any of it. preload3D() fetches three.js (the vendored
// bundle), the models and the garden's painted swatches, and resolves to the renderer factory once everything is ready — a fight
// only starts after that, so a slow load never spends the day's life. The models are loaded once
// per page; each fight builds its own copies on its own graphics context.
let ready = null;

/** The hero: the painted model once it exists (art3d/hero.gltf), else the CC0 mannequin. */
const HERO_URLS = ["art3d/hero.gltf", "art3d/dev/ual-mannequin.glb"];

// (no HEAD first: each model asked whether it existed before loading it, a round trip more for every one — the loader's own
// failure moves on to the next just the same)
async function loadFirst(loader, urls) {
  for (const url of urls) {
    try {
      const g = await loader.loadAsync(url);
      return { url, scene: g.scene, animations: g.animations };
    } catch {
      // try the next one
    }
  }
  return null;
}

/** The arenas drawn as a pre-rendered backdrop (backdrop3d.js; public/art3d/<id>/): asked for only these, no 404s for the rest. */
const BACKDROP_ARENAS = new Set(["ash", "bog"]);
/** The painted arenas, by id: assets.backdrops (here so a boss's arena can load before the models are in). */
const backdrops = {};

/**
 * three.js, the hero, Gnasher and the garden, plus any other boss the caller names whose model exists (boss-profiles.js:
 * `{ bosses: ["king"] }` — the bench asks for its boss), and each named boss's painted arena — loaded alongside the models,
 * not after them (it waited for them: 2.7 s more before the Bog Shrine's first byte at 20 Mbit/s). A later call naming a
 * boss not loaded yet loads it into the same assets.
 */
export function preload3D({ bosses = [] } = {}) {
  if (!ready)
    ready = (async () => {
      const [{ makeRenderer3D }, { GLTFLoader }, { loadGardenPaint }] = await Promise.all([import("./render3d.js?v=79a60b0-466c2a40"), import("./gltf.js?v=79a60b0-466c2a40"), import("./paint3d.js?v=79a60b0-466c2a40")]);
      const loader = new GLTFLoader();
      // The garden's painted swatches (paint3d.js, M4b): null when they are missing, and the
      // garden is then drawn in M4a's flat colours. It never rejects.
      const [hero, gnasher, garden] = await Promise.all([loadFirst(loader, HERO_URLS), loadFirst(loader, ["art3d/gnasher.gltf"]), loadGardenPaint()]);
      // (the 3D bell — 3.2 MB — only for a fight that will draw it: loadBosses)
      const assets = { hero, gnasher, garden, bell: null, bosses: { gnasher }, backdrops };
      const r = { assets, loader, makeRenderer: (canvas, opts = {}) => makeRenderer3D(canvas, { ...opts, assets }), missing: (id) => missing(r, id) };
      return r;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  if (!bosses.length) return ready;
  const arenas = loadArenas(bosses);
  return ready.then(async (r) => (await arenas, loadBosses(r, bosses)));
}

/**
 * Each asset loaded once, however many ask at once: the load in flight per key (an arena's id, "boss:<id>"), and an entry
 * already in place is never replaced. (Two preload3D({ bosses: [id] }) at once — main.js before a fight and the fight's own —
 * both downloaded the arena, and the second replaced assets.backdrops[id] after the fight had started on the first: the edit
 * mode then painted the owner's corrections into one copy while the shader showed the other.) A load that failed (null) is
 * not kept: the next call tries again (kept as null, `a in backdrops` held and main.js never asked for it again).
 */
const loading = new Map();
function once(key, has, load) {
  if (has()) return Promise.resolve();
  if (!loading.has(key)) loading.set(key, load().finally(() => loading.delete(key)));
  return loading.get(key);
}

let bossInfo = null; // (the bosses' content and model profiles, imported once)
const info = () => (bossInfo ??= Promise.all([import("../content/bosses.js?v=79a60b0-466c2a40"), import("./boss-profiles.js?v=79a60b0-466c2a40")]).then(([{ BOSSES }, { BOSS_MODELS }]) => ({ BOSSES, BOSS_MODELS })));
const arenaOf = (BOSSES, id) => (BACKDROP_ARENAS.has(BOSSES[id]?.arena) ? BOSSES[id].arena : null);
// (the bench's &refcam=0 draws the 30° picture, where the painted bell is not: the 3D one stands there)
const REFCAM_OFF = typeof location !== "undefined" && new URLSearchParams(location.search).get("refcam") === "0";
/** A boss whose fight begins at the bell (content/bosses.js entrance) where his arena has no painted bell of its own (the
 *  Bog Shrine's is cut out of its picture, backdrop3d.js makeRefBell): the garden's 3D bell stands in. */
const wantsBell = (BOSSES, id) => {
  if (BOSSES[id]?.entrance !== "bell") return false;
  const bd = backdrops[arenaOf(BOSSES, id)];
  return REFCAM_OFF || !bd?.refBell;
};

/** The named bosses' painted arenas (backdrop3d.js: the Ash Floor for Sister Cinder, the Bog Shrine for Gnasher). */
async function loadArenas(ids) {
  const { BOSSES } = await info();
  const { loadBackdrop } = await import("./backdrop3d.js?v=79a60b0-466c2a40");
  await Promise.all(
    ids
      .map((id) => arenaOf(BOSSES, id))
      .filter(Boolean)
      .map((a) => once(a, () => backdrops[a] != null, async () => {
        const bd = await loadBackdrop(a);
        if (bd && backdrops[a] == null) backdrops[a] = bd;
      })),
  );
}

/** Load the named bosses' models (those with a profile and a file) into the preloaded assets, and the 3D bell where one of
 *  them needs it (after its arena: whether that has a bell of its own). */
async function loadBosses(r, ids) {
  const { BOSSES, BOSS_MODELS } = await info();
  const bell = ids.some((id) => wantsBell(BOSSES, id))
    ? once("bell", () => !!r.assets.bell, async () => {
        const a = await loadFirst(r.loader, ["art3d/bell/bell.gltf"]);
        if (a && !r.assets.bell) r.assets.bell = a;
      })
    : null;
  await Promise.all([
    bell,
    ...ids
      .filter((id) => BOSS_MODELS[id])
      .map((id) => once(`boss:${id}`, () => !!r.assets.bosses[id], async () => {
        const a = await loadFirst(r.loader, [BOSS_MODELS[id].url]);
        if (a && !r.assets.bosses[id]) r.assets.bosses[id] = a;
      })),
  ]);
  return r;
}

/** What a fight with this boss still lacks (its model, its painted arena, the 3D bell it would draw): main.js loads it
 *  behind the loading card before the fight. Synchronous once the boss content is in (it is, after any preload). */
function missing(r, id) {
  if (!bossSync) return true;
  const { BOSSES, BOSS_MODELS } = bossSync;
  const a = arenaOf(BOSSES, id);
  return (!!BOSS_MODELS[id] && !r.assets.bosses[id]) || (!!a && !backdrops[a]) || (wantsBell(BOSSES, id) && !r.assets.bell);
}
let bossSync = null;
info().then((x) => (bossSync = x), () => {});

/** Camp 2.0 (camp3d.js): the 3D view and the village's painting, depth and moving parts, into the preloaded assets. */
export async function preloadCamp(id = "camp2") {
  const r = await preload3D();
  const B = backdrops;
  await once(id, () => B[id] != null, async () => {
    const { loadCamp } = await import("./camp3d.js?v=79a60b0-466c2a40");
    const bd = await loadCamp(id);
    if (bd && B[id] == null) B[id] = bd;
  });
  if (!B[id]) throw new Error("camp2 missing");
  return r;
}
