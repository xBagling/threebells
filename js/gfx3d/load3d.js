// The way into the 3D view (a test, docs/3D-PLAN.md 2.6). main.js imports this only when 3D is
// chosen, so the 2D game never downloads any of it. preload3D() fetches three.js (the vendored
// bundle), the models and the garden's painted swatches, and resolves to the renderer factory once everything is ready — a fight
// only starts after that, so a slow load never spends the day's life. The models are loaded once
// per page; each fight builds its own copies on its own graphics context.
let ready = null;

/** The hero: the painted model once it exists (art3d/hero.gltf), else the CC0 mannequin. */
const HERO_URLS = ["art3d/hero.gltf", "art3d/dev/ual-mannequin.glb"];

async function loadFirst(loader, urls) {
  for (const url of urls) {
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) continue;
      const g = await loader.loadAsync(url);
      return { url, scene: g.scene, animations: g.animations };
    } catch {
      // try the next one
    }
  }
  return null;
}

/**
 * three.js, the hero, Gnasher, the garden and the bell, plus any other boss the caller names whose
 * model exists (boss-profiles.js: `{ bosses: ["king"] }` — the bench asks for its boss; the game only
 * offers Gnasher today). A later call naming a boss not loaded yet loads it into the same assets.
 */
export function preload3D({ bosses = [] } = {}) {
  if (ready) return bosses.length ? ready.then((r) => loadBosses(r, bosses)) : ready;
  if (!ready)
    ready = (async () => {
      const [{ makeRenderer3D }, { GLTFLoader }, { loadGardenPaint }] = await Promise.all([import("./render3d.js?v=8898846"), import("./gltf.js?v=8898846"), import("./paint3d.js?v=8898846")]);
      const loader = new GLTFLoader();
      // The garden's painted swatches (paint3d.js, M4b): null when they are missing, and the
      // garden is then drawn in M4a's flat colours. It never rejects.
      const [hero, gnasher, garden, bell] = await Promise.all([loadFirst(loader, HERO_URLS), loadFirst(loader, ["art3d/gnasher.gltf"]), loadGardenPaint(), loadFirst(loader, ["art3d/bell/bell.gltf"])]);
      const assets = { hero, gnasher, garden, bell, bosses: { gnasher } };
      const r = { assets, loader, makeRenderer: (canvas, opts = {}) => makeRenderer3D(canvas, { ...opts, assets }) };
      return loadBosses(r, bosses);
    })().catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

/** Load the named bosses' models (those with a profile and a file) into the preloaded assets. */
async function loadBosses(r, ids) {
  const { BOSS_MODELS } = await import("./boss-profiles.js?v=8898846");
  await Promise.all(
    ids
      .filter((id) => BOSS_MODELS[id] && !r.assets.bosses[id])
      .map(async (id) => {
        const a = await loadFirst(r.loader, [BOSS_MODELS[id].url]);
        if (a) r.assets.bosses[id] = a;
      }),
  );
  return r;
}
