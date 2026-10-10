// The 3D view of a fight (a test, docs/3D-PLAN.md). makeRenderer3D gives fight.js everything
// gfx/render.js does — the same contract (2.2) — so the fight loop, the sim, the input and the
// HUD are exactly the 2D game's. The sim is only read: positions are moved between ticks inside
// lerpWorld and put back, as in 2D, and everything else the view needs lives in its own records.
//
// Each frame: the camera is built from the 2D camera (camera3d.js), the scene is drawn into a
// low-resolution target, the markings into a second one (hazards3d.js), and the final pass
// enlarges the scene with hard edges, grades it and lays the markings on top (post3d.js). Text is
// a plain canvas over it (overlay3d.js).
//
// A failure in here never touches the fight: beforeStep, consume and lerpWorld catch their own
// errors, and three failed frames in a row, or a lost graphics context that does not come back,
// call onFail, and fight.js carries on in 2D.
import { WebGLRenderer, Scene, OrthographicCamera, Color, Mesh, Group, MeshLambertMaterial, MeshBasicMaterial, CapsuleGeometry, SphereGeometry, BoxGeometry, PCFShadowMap, Sprite, SpriteMaterial, CanvasTexture, NearestFilter, SRGBColorSpace, Vector3, MeshDepthMaterial } from "./three-lib.js?v=df092a6";
import { cameraFrame, texelFactor, H_TO_3D } from "./camera3d.js?v=df092a6";
import { makeLerp3D } from "./lerp3d.js?v=df092a6";
import { makeLeap } from "./leap3d.js?v=df092a6";
import { makePost } from "./post3d.js?v=df092a6";
import { makeHazardLayer } from "./hazards3d.js?v=df092a6";
import { makeParticleMesh, makeBlob } from "./fx3d.js?v=df092a6";
import { makeOverlay } from "./overlay3d.js?v=df092a6";
import { makeLookUniforms, paintMaterial, makeBrushNoise } from "./materials3d.js?v=df092a6";
import { makeHero3D } from "./hero3d.js?v=df092a6";
import { makeBoss3D } from "./boss3d.js?v=df092a6";
import { makeHeroFx } from "./herofx3d.js?v=df092a6";
import { makeLights3D } from "./lights3d.js?v=df092a6";
import { MOODS, applyMood } from "./moods3d.js?v=df092a6";
import { gardenLayout, R_SEEN } from "./layout3d.js?v=df092a6";
import { makeWind } from "../gfx/wind.js?v=df092a6";
import { makeTongue, TONGUE_COLOR } from "./tongue3d.js?v=df092a6";
import { BOSS_MODELS } from "./boss-profiles.js?v=df092a6";
import { makeDebug3D, makeBenchOverlays } from "./debug3d.js?v=df092a6";
import { TIERS, startTier, saveTier, afterFight, makeTierMonitor } from "./tiers3d.js?v=df092a6";
import { buildGarden } from "./arena3d.js?v=df092a6";
import { gardenTextures } from "./paint3d.js?v=df092a6";
import { fadeTargets, makeFader } from "./fade3d.js?v=df092a6";
import { makeLife3D } from "./life3d.js?v=df092a6";
import { makeBossRecord, bossAnimState } from "./anim/boss-anim3d.js?v=df092a6";
import { dampAngle, springStep } from "./anim/procedural.js?v=df092a6";
import { makeParticles, PAL } from "../gfx/particles.js?v=df092a6";
import { STATE, moveOf, jumpLift } from "../sim/player.js?v=df092a6";
import { KIND, radiusOf } from "../sim/hazards.js?v=df092a6";
import { PLAYER, ARENA, FORE, sweepDir, FIGHT } from "../config.js?v=df092a6";
import { clamp, rng } from "../util.js?v=df092a6";
import { ART, frameOf } from "../gfx/atlas.js?v=df092a6";
import { makeDressing } from "../gfx/dressing.js?v=df092a6";
import { makeBell3D } from "./bell3d.js?v=df092a6";
import { makeChest3D } from "./chest3d.js?v=df092a6";
import { makeSparks3D, GLINT } from "./sparks3d.js?v=df092a6";

const HERO_H = 19.6; // 3D units (24 screen units × √⅔, docs/3D-PLAN.md 2.5)
const TOAD_H = 27.8;
const TOAD_R_DEFAULT = 16; // D13a: about the image's toad (radius 15–16); the sim's radius stays 26

/** Where a thing faces: a model whose front is +Z turned to world angle θ. */
const yawOf = (theta) => Math.PI / 2 - theta;

/** Is this a phone or a tablet: is a finger its main pointer? */
function touchFirst() {
  try {
    return matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function makeRenderer3D(canvasEl, { debug = {}, onCue = null, aimPreview = null, onFail = null, texel = null, aa = null, assets = {} } = {}) {
  // `aa`: a smoothing try from the fight screen (?smooth=): its pixel size, upscale, multisampling.
  // Without one (and without the bench's own switches): on a phone or tablet (a finger is its main
  // pointer) 2 screen pixels per texel with 4x multisampling and sharp-bilinear enlarging (try 5); on
  // a desktop the native resolution with 4x multisampling (try 6) — the owner's picks, 2026-10-02.
  // `legacy` keeps the old hard texels.
  if (!aa && texel == null && debug.texel == null && !debug.upscale && !debug.msaa) aa = touchFirst() ? { texel: 2, msaa: 4, upscale: "sharp" } : { texel: 1, msaa: 4 };
  if (aa?.legacy) aa = null;
  if (aa?.texel != null && texel == null) texel = aa.texel;
  const gl = new WebGLRenderer({ canvas: canvasEl, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
  // three.js only logs a shader that fails to compile; here it counts as a failure, so the fight
  // falls back to 2D rather than going on with something missing.
  gl.debug.onShaderError = (ctx, program, vs, fs) => {
    const log = [ctx.getProgramInfoLog(program), ctx.getShaderInfoLog(vs), ctx.getShaderInfoLog(fs)].filter(Boolean).join(" | ");
    console.error("3D view: a shader failed to compile", log);
    fail("shader");
  };
  // Gnasher's drawn body radius: the bench's &toadR= shows D13's other option (23) side by side.
  const TOAD_R = Number(debug.toadR) || TOAD_R_DEFAULT;
  gl.setPixelRatio(1);
  gl.autoClear = false;
  gl.info.autoReset = false; // counted per frame (the FPS panel), not per render call
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = PCFShadowMap;
  const post = makePost(gl, { upscale: aa?.upscale || debug.upscale || ((texel ?? debug.texel) < 1 ? "linear" : null), msaa: aa?.msaa || debug.msaa, fxaa: aa?.fxaa || debug.fxaa });
  const marks = makeHazardLayer();
  const overlay = makeOverlay(canvasEl);
  const lerp = makeLerp3D();
  const leap = makeLeap();
  const parts = makeParticles(99);
  const partMesh = makeParticleMesh();

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 3000);
  // The uniforms every paint material shares: sun mask and pool, lanterns, wind, fade groups.
  const look = makeLookUniforms();
  look.uNoise.value = makeBrushNoise(rng(5)); // brush noise, made by our own code
  const CLEAR = new Color(0x0b140a);
  // The garden's painted swatches (paint3d.js, M4b) as this renderer's textures, shared by every
  // garden material and kept across a re-planting; null (M4a's flat colours) when they did not
  // load, or with the bench's ?paint=0.
  const paint = debug.paint === 0 ? null : gardenTextures(assets.garden, gl);

  // --- light (lights3d.js): the sun, its dapples and pool, the teal sky ---------------------------------
  // The dapples take the canopies' own positions (layout3d.js), so tree shadows lie under the trees.
  const canopies = gardenLayout(1).trees.map((t) => ({ x: t.canopy.x, y: t.canopy.y, r: t.canopy.rx }));
  const lights = makeLights3D(scene, look, { rand: rng(11), trees: canopies });
  // The same wind as 2D (gfx/wind.js): its gust fronts, on real time, drive the grass, flowers and
  // leaves through the shared uniforms. Its randomness is its own, never the sim's.
  const wind = makeWind({ speed: 26, gustEvery: 7.5 });
  const sun = lights.sun;
  // The look lab's knobs (bench ?sun= &sky= &pool= &poolFloor= &lant=), for tuning against the
  // target (G1); ?pool= scales the pool's 60 × 40 (1 is the default).
  if (debug.sun != null) sun.intensity = debug.sun;
  if (debug.sky != null) lights.sky.intensity = debug.sky;
  if (debug.pool != null) look.uPool.value.set(0, 0, 60 * debug.pool, 40 * debug.pool);
  if (debug.poolFloor != null) look.uPoolFloor.value = debug.poolFloor;
  if (debug.lant != null) look.uLantPower.value = debug.lant;
  if (debug.albedo) look.uAlbedo.value = 1; // the bench's ?albedo=1: base colours only, unlit
  // A lighting mood (moods3d.js), for exploring other looks: the bench's &mood=<id>.
  const mood = MOODS[debug.mood] || null;
  if (mood) applyMood(mood, { sun, sky: lights.sky, look, clear: CLEAR });
  // The quality tier (tiers3d.js): chosen per device, checked during the name card.
  const fixedTier = TIERS[debug.tier3d] ? debug.tier3d : null; // the bench's ?tier3d=, if it names a tier
  let tierName = fixedTier || startTier();
  let bloomOn = TIERS[tierName].bloom;
  const tierMon = makeTierMonitor();
  const applyTier = () => {
    const t = TIERS[tierName];
    if (sun.shadow.mapSize.x !== t.shadow) {
      sun.shadow.mapSize.set(t.shadow, t.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    bloomOn = t.bloom;
  };
  applyTier();

  // --- the garden (arena3d.js, docs/3D-PLAN.md 4): floor, walls, lanterns, trees, bushes, grass… --------
  // Grey box for now (M4a: flat colours); the ground beyond fades into the clear colour. Built for
  // the tier; built again if the name card drops one (the counts are the tier's, layout3d.js).
  let garden = null;
  function plantGarden() {
    if (garden) {
      scene.remove(garden.group);
      garden.dispose();
    }
    garden = buildGarden(look, { seed: 1, tier: TIERS[tierName] ? tierName : "high", paint });
    scene.add(garden.group);
    // Layer 2: every mesh that carries fade groups (trees, lanterns, bushes, the topiary, flowers),
    // so the fade pass draws only those.
    garden.group.traverse((o) => o.isMesh && o.geometry?.getAttribute("aGroup") && o.layers.enable(2));
    if (debug.garden === 0) garden.group.visible = false; // the bench's ?garden=0, to measure what it costs
  }
  plantGarden();
  const fader = makeFader(garden.fadeGroups); // the groups are the layout's, the same at every tier
  // The lanterns lit: on Low only those nearest the fight, a change of set cross-fading over 0.3 s.
  const lantOn = new Float32Array(8).fill(1);
  // Lights are picked by layer too: without these the fade layer would be drawn unlit (black).
  lights.sun.layers.enable(2);
  lights.sky.layers.enable(2);
  // Pollen over the lawn, petals from the two blossom trees (4.12).
  const blossom = gardenLayout(1).trees.filter((t) => t.id === "T0" || t.id === "T1").map((t) => t.canopy);
  const life = makeLife3D(look, { trees: blossom, wind, rand: rng(29), painted: !!paint?.atlas }); // painted: the picked petals' colours (M4b)
  scene.add(life.mesh, life.glow);

  // --- placeholders: the hero and the toad ----------------------------------------------------------------
  const heroMat = new MeshLambertMaterial({ color: 0x2c7a78 });
  const hero = new Group();
  const heroBody = new Group(); // turns, tilts and squashes about the feet
  hero.add(heroBody);
  const capsule = new Mesh(new CapsuleGeometry(4, HERO_H - 8, 6, 12), heroMat);
  capsule.position.y = HERO_H / 2;
  const nose = new Mesh(new BoxGeometry(2.2, 2.2, 3), new MeshLambertMaterial({ color: 0xe6d3a8 }));
  nose.position.set(0, HERO_H - 4, 4.2);
  const swordPivot = new Group();
  swordPivot.position.set(0, HERO_H * 0.5, 0);
  const sword = new Mesh(new BoxGeometry(0.9, 0.9, 16), new MeshLambertMaterial({ color: 0xd9e0ea, emissive: 0x303844 }));
  sword.position.set(0, 0, 10);
  swordPivot.add(sword);
  heroBody.add(capsule, nose, swordPivot);
  for (const m of [capsule, nose, sword]) m.castShadow = true;
  const heroBlob = makeBlob(6.5, 0.38);
  scene.add(hero, heroBlob);
  // The skinned hero (the mannequin until the painted model exists), in place of the capsule.
  const heroModel = assets.hero ? makeHero3D(assets.hero, look) : null;
  if (heroModel) {
    hero.visible = false;
    scene.add(heroModel.object);
    if (heroModel.cape) scene.add(heroModel.cape.mesh);
  }
  const heroFx = heroModel ? makeHeroFx(scene, heroModel) : null;

  const toadMat = paintMaterial(look, { color: 0x3f8a2e, char: true });
  const toad = new Group();
  const toadBody = new Group();
  toad.add(toadBody);
  const belly = new Mesh(new SphereGeometry(1, 24, 16), toadMat);
  belly.scale.set(TOAD_R, TOAD_H / 2, TOAD_R);
  belly.position.y = TOAD_H / 2;
  const cream = new Mesh(new SphereGeometry(1, 20, 12), new MeshLambertMaterial({ color: 0xefe2b8 }));
  cream.scale.set(TOAD_R * 0.72, TOAD_H * 0.36, TOAD_R * 0.5);
  cream.position.set(0, TOAD_H * 0.42, TOAD_R * 0.62);
  const eyes = [-1, 1].map((s) => {
    const e = new Mesh(new SphereGeometry(3.2, 12, 8), new MeshLambertMaterial({ color: 0xe6a21c, emissive: 0x3a2400 }));
    e.position.set(s * 6.5, TOAD_H * 0.86, TOAD_R * 0.55);
    const pupil = new Mesh(new SphereGeometry(1.6, 8, 6), new MeshBasicMaterial({ color: 0x120c06 }));
    pupil.position.set(0, 0.3, 2.3);
    e.add(pupil);
    return e;
  });
  // The throat sac, the open mouth and the tongue (the tongue is its own tube, tongue3d.js).
  const sac = new Mesh(new SphereGeometry(1, 16, 12), paintMaterial(look, { color: 0xe8dca8, char: true }));
  sac.position.set(0, TOAD_H * 0.3, TOAD_R * 1.02);
  const mouth = new Mesh(new SphereGeometry(1, 16, 8), new MeshBasicMaterial({ color: 0x3a0c12 }));
  mouth.position.set(0, TOAD_H * 0.52, TOAD_R * 0.86);
  const tongue = makeTongue(paintMaterial(look, { color: TONGUE_COLOR, char: true }));
  scene.add(tongue.mesh);
  toadBody.add(belly, cream, ...eyes, sac, mouth);
  // The rigged boss (the placeholder's shapes hide; its tongue and blob stay in use): the fight's own
  // model when one is loaded (boss-profiles.js; load3d.js loads what the fight asks for), else Gnasher's.
  // Made when the world's boss is first drawn: the renderer exists before the fight's world.
  // (Gnasher's is made at once, as before: the model bench reads its clips before the first frame.)
  let bossModel = assets.gnasher ? makeBoss3D(assets.gnasher, look) : null;
  let bossFor = "gnasher";
  let bossR = TOAD_R;
  if (bossModel) {
    toadBody.visible = false;
    scene.add(bossModel.object);
  }
  function ensureBoss(w) {
    const id = w.spec?.id;
    const want = id && id !== "gnasher" && assets.bosses?.[id] && BOSS_MODELS[id] ? id : "gnasher";
    if (bossFor === want) return;
    bossFor = want;
    if (bossModel) scene.remove(bossModel.object);
    const asset = want === "gnasher" ? assets.gnasher : assets.bosses[want];
    bossModel = asset ? makeBoss3D(asset, look, BOSS_MODELS[want]) : null;
    bossR = want === "gnasher" ? TOAD_R : BOSS_MODELS[want].radius;
    toadBody.visible = !bossModel;
    if (bossModel) scene.add(bossModel.object);
  }
  for (const m of [belly, cream, ...eyes]) m.castShadow = true;
  const toadBlob = makeBlob(TOAD_R * 1.08, 0.42);
  scene.add(toad, toadBlob);
  // The bell of a bell entrance (bell3d.js), shown only while the world has one.
  const bell3d = assets.bell ? makeBell3D(assets.bell, look, FIGHT.entrance) : null;
  if (bell3d) scene.add(bell3d.group);
  // The chest after a win (chest3d.js), shown only once the world has one.
  const chest3d = makeChest3D(look);
  scene.add(...chest3d.objects);
  // The fight's glints (sparks3d.js): a flash where a blow lands, rings over the grass, sparkles, dazed stars.
  const sparks = makeSparks3D();
  scene.add(...sparks.objects);

  // Adds and shots: small pools of spheres.
  const shotGeo = new SphereGeometry(1, 10, 8);
  const shotMat = new MeshLambertMaterial({ color: 0x9ac455, emissive: 0x4a6a18 });
  const adds = [];
  const shots = [];
  const pool = (list, make) => (i) => list[i] || (list[i] = make());
  // Adds (Gnasher's flies) are cards of their 2D frames, facing the camera (a proof-of-concept
  // exception to the painted-only rule, D16), with a contact blob; a tiny 3D fly is the upgrade.
  const texOf = new Map(); // 2D sprite canvas → texture
  const cardTex = (spr) => {
    let t = texOf.get(spr.cv);
    if (!t) {
      t = new CanvasTexture(spr.cv);
      t.magFilter = NearestFilter;
      t.minFilter = NearestFilter;
      t.colorSpace = SRGBColorSpace;
      texOf.set(spr.cv, t);
    }
    return t;
  };
  const addAt = pool(adds, () => {
    const g = new Sprite(new SpriteMaterial({ transparent: true, alphaTest: 0.3, toneMapped: false }));
    g.center.set(0.5, 0);
    const blob = makeBlob(4, 0.3);
    scene.add(g, blob);
    return { g, blob };
  });
  const shotAt = pool(shots, () => {
    const m = new Mesh(shotGeo, shotMat.clone()); // its own, to fade out at the edge
    m.material.transparent = true;
    const blob = makeBlob(2.2, 0.45);
    scene.add(m, blob);
    return { m, blob };
  });
  // The garden's critters (4.12): 2D's own dressing, picked the way 2D picks it (by the painting's
  // look, not the arena id: 4 beetles and 5 moths in the meadow), wandering and bolting from the
  // fight on the same events; drawn as cards of their 2D frames (D16) with a contact blob.
  let dressing = null;
  let dressedFor = null;
  const critters = [];
  const flipped = new Map(); // 2D sprite canvas → its mirrored texture
  const critterTex = (spr, flip) => {
    if (!flip) return cardTex(spr);
    let t = flipped.get(spr.cv);
    if (!t) {
      t = cardTex(spr).clone();
      t.repeat.x = -1;
      t.offset.x = 1;
      t.needsUpdate = true;
      flipped.set(spr.cv, t);
    }
    return t;
  };
  const critterAt = pool(critters, () => {
    const g = new Sprite(new SpriteMaterial({ transparent: true, alphaTest: 0.3, toneMapped: false, color: 0xb8b8b8 }));
    const blob = makeBlob(2.2, 0.3);
    scene.add(g, blob);
    return { g, blob };
  });
  function poseCritters(w, dt) {
    if (debug.critters === 0) return; // the bench's ?critters=0: the markings check wants a bare floor
    if (dressedFor !== w.spec.arena) {
      const painted = ART.arena[w.spec.arena];
      dressing = makeDressing(painted?.look || w.spec.arena, 1, { plants: !painted?.iso });
      dressedFor = w.spec.arena;
    }
    if (w.state === "fight" && w.boss) dressing.step(dt, w, wind);
    let i = 0;
    for (const c of dressing.critters) {
      const spr = frameOf(c.set, c.t + c.ph, c.def.fps);
      if (!spr) continue;
      const o = critterAt(i++);
      const flip = Math.cos(c.a) < 0;
      o.g.visible = o.blob.visible = true;
      o.g.material.map = critterTex(spr, flip);
      const sc = 1 / (spr.ppu || 1) / Math.SQRT2; // sprite pixels are 2D screen units
      o.g.scale.set(spr.w * sc, spr.h * sc, 1);
      o.g.center.set(flip ? 1 - spr.ax / spr.w : spr.ax / spr.w, 1 - spr.ay / spr.h);
      o.g.position.set(c.x, (c.z || 0) * H_TO_3D, c.y);
      o.blob.position.set(c.x, 0.08, c.y);
      o.blob.material.opacity = o.blob.userData.baseOpacity * (c.z > 1 ? 0.6 : 1);
    }
    for (; i < critters.length; i++) critters[i].g.visible = critters[i].blob.visible = false;
  }
  scene.add(partMesh.mesh);
  // Layer 1 is the glow layer (3D-PLAN 5.6): only true light sources go on it — lantern flames and
  // glass, the motes faintly, and of the particles only the lit ones (steel sparks, fire, gold,
  // brine and mint; not blood, dust or bog; fx3d.js). Drawn a second time against the scene's depth.
  partMesh.mesh.layers.enable(1);
  const dbg = makeDebug3D(scene); // the admin menu's hitboxes
  const bench = makeBenchOverlays(scene, gardenLayout(1), { bogplane: !!debug.bogplane, layout: !!debug.layout });

  // --- flashes, on real time ---------------------------------------------------------------------------
  let hurtFlash = 0;
  let healFlash = 0;
  let toadHitT = -1;
  let heroHurtT = -1;
  let lastNow = 0;

  // --- sizing: the canvas at exact device pixels ----------------------------------------------------
  let devSize = null;
  let ro = null;
  try {
    ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const box = e.devicePixelContentBoxSize?.[0];
      if (box) devSize = [box.inlineSize, box.blockSize];
    });
    ro.observe(canvasEl, { box: "device-pixel-content-box" });
  } catch {
    try {
      ro?.observe(canvasEl);
    } catch {
      ro = null;
    }
  }
  let lastCss = [320, 320];
  function fitCamera(cam) {
    const r = canvasEl.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) lastCss = [Math.max(200, Math.round(r.width)), Math.max(200, Math.round(r.height))];
    const [cssW, cssH] = lastCss;
    const dpr = window.devicePixelRatio || 1;
    const devW = devSize && Math.abs(devSize[0] / dpr - cssW) < 2 ? devSize[0] : Math.round(cssW * dpr);
    const { w, h } = cam.fit(cssW, cssH, devW / cssW);
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
      gl.setSize(w, h, false);
    }
    overlay.resize(w, h);
    return { w, h };
  }

  // --- between ticks (lerp3d), each wrapped so a view error never reaches the sim ---------------------
  let failed = false; // a view that fell back to 2D does not count its fight towards the tier
  const fail = (why, err) => {
    failed = true;
    if (typeof console !== "undefined") console.error(`3D view: ${why}`, err);
    onFail?.(why);
  };
  function beforeStep(w) {
    try {
      lerp.beforeStep(w);
    } catch (err) {
      fail("beforeStep", err);
    }
  }
  function lerpWorld(w, alpha) {
    try {
      return lerp.lerpWorld(w, alpha);
    } catch (err) {
      fail("lerpWorld", err);
      return () => {};
    }
  }

  // --- what the sim reported (2D's consume, render.js, with heights in 3D) -------------------------------
  function consume(events, w) {
    try {
      lerp.afterStep();
      for (const e of events) {
        switch (e.t) {
          case "hit":
            toadHitT = lastNow;
            // (his hit lean and hard blink, anim/toad-life.js: away from the hero)
            if (bossModel && w.boss && w.player) bossModel.hit(w.boss.x - w.player.x, w.boss.y - w.player.y, e.heavy || e.crit, lerp.viewTime(w));
            P(e.x, e.y, e.crit ? 18 : 12, { speed: 130, life: 0.3, cols: e.crit ? PAL.gold : PAL.steel, dir: e.a, spread: 2.1, size: 1.6, z: 14 });
            P(e.x, e.y, 6, { speed: 70, life: 0.45, cols: PAL.blood, dir: e.a, spread: 1.4, grav: 120, vz: 30, z: 12, size: 1.4 });
            {
              // the blow lands: a small hot flash at the cut and a few glints off it (subtle; a heavy or a crit more,
              // and a ring from under him), and a little of his slime flung off
              const big = e.heavy || e.crit;
              sparks.flash(e.x, e.y, 11, { size: big ? 20 : 11, life: big ? 0.18 : 0.1, a: big ? 1.6 : 1.0, col: e.crit ? 0xffe9a8 : 0xfff6e8 });
              sparks.burst(e.x, e.y, 11, big ? 12 : 5, { speed: big ? 75 : 45, up: 25, dir: e.a, spread: 2.2, life: 0.3, size: big ? 1.8 : 1.3, palette: e.crit ? GLINT.gold : GLINT.white });
              if (big && w.boss) sparks.ring(w.boss.x, w.boss.y, { r: 34, life: 0.35, a: 0.45 });
              P(e.x, e.y, big ? 7 : 4, { speed: 60, life: 0.5, cols: PAL.bog, dir: e.a, spread: 1.6, grav: 160, vz: 40, z: 12, size: 1.3 });
            }
            dressing?.startle(e.x, e.y, 40);
            break;
          case "hurt":
            heroHurtT = lastNow;
            P(e.x, e.y, 16, { speed: 110, life: 0.42, cols: PAL.blood, grav: 140, vz: 40, z: 14, size: 1.6 });
            // (struck: a red-white flash on him, sparks off it, a ring knocked out round his feet)
            sparks.flash(e.x, e.y, 11, { size: 18, life: 0.16, col: 0xffd2c4, a: 1.3 });
            sparks.burst(e.x, e.y, 11, 9, { speed: 60, up: 30, life: 0.35, size: 1.5, palette: GLINT.red });
            sparks.ring(e.x, e.y, { r: 18, life: 0.3, col: 0xff8070, a: 0.6 });
            hurtFlash = 0.42;
            break;
          case "roll":
            P(e.x, e.y, 10, { speed: 34, life: 0.42, cols: ["#5f6b3a", "#47512b", "#3a4424"], dir: e.a + Math.PI, spread: 1.5, size: 1.8, kind: "dust", z: 2 });
            sparks.burst(e.x, e.y, 6, 5, { speed: 26, up: 8, dir: e.a + Math.PI, spread: 1.2, life: 0.3, size: 1.1, grav: 0, palette: GLINT.steel }); // (a breath of air behind him)
            dressing?.startle(e.x, e.y, 30);
            break;
          case "swing":
            P(e.x, e.y, 5, { speed: 60, life: 0.2, cols: PAL.steel, dir: e.a, spread: 1.2, z: 12, size: 1.3 });
            break;
          case "blocked":
          case "parry":
          case "guardBreak": {
            // A blow on his raised guard (world.js guard()): sparks off it toward the blow, the guard knocked back
            // (hero3d.js guardHit); a parry rings bright gold, a guard break throws sparks wide.
            const gx = e.x + Math.cos(e.a) * 7, gy = e.y + Math.sin(e.a) * 7;
            const parry = e.t === "parry", broke = e.t === "guardBreak";
            P(gx, gy, parry ? 22 : broke ? 26 : 12, { speed: parry ? 150 : broke ? 140 : 110, life: parry ? 0.4 : 0.3, cols: parry ? PAL.gold : PAL.steel, dir: e.a, spread: broke ? 3 : 1.8, z: 13, size: parry ? 1.7 : 1.4 });
            heroModel?.guardHit?.(parry ? "parry" : broke ? "break" : "block");
            sparks.flash(gx, gy, 12, { size: parry ? 26 : broke ? 22 : 13, life: parry ? 0.22 : 0.14, col: parry ? 0xffe08a : 0xe8f2ff, a: parry ? 1.8 : 1.2 });
            if (parry || broke) sparks.ring(e.x, e.y, { r: parry ? 30 : 22, life: 0.4, col: parry ? 0xffd66b : 0xcfe0ff, a: 0.7 });
            break;
          }
          case "shieldUp":
          case "shielded":
            P(e.x, e.y, e.t === "shieldUp" ? 18 : 14, { speed: 80, life: 0.45, cols: ["#9fd8ff", "#e2f6ee"], z: 12, size: 1.5 });
            sparks.ring(e.x, e.y, { r: e.t === "shieldUp" ? 24 : 16, life: 0.4, col: 0x9fd8ff, a: 0.7 });
            break;
          case "death":
            P(e.x, e.y, 30, { speed: 120, life: 0.8, cols: PAL.blood, grav: 180, vz: 60, z: 14, size: 1.8 });
            sparks.flash(e.x, e.y, 10, { size: 26, life: 0.3, col: 0xffb0a0, a: 1.4 });
            sparks.ring(e.x, e.y, { r: 30, life: 0.6, col: 0xff5a4a, a: 0.6 });
            hurtFlash = 1;
            break;
          case "pop": {
            const cols = e.kind === "fly" ? PAL.bog : e.kind === "ember" ? PAL.fire : PAL.brine;
            P(e.x, e.y, 16, { speed: 90, life: 0.45, cols, grav: 60, vz: 30, z: 8, size: 1.5 });
            sparks.flash(e.x, e.y, 6, { size: 10, life: 0.12, col: e.kind === "fly" ? 0xd6f06b : 0xfff0c0 });
            break;
          }
          case "burst":
            P(e.x, e.y, 14, { speed: 100, life: 0.35, cols: e.art === "ember" ? PAL.fire : e.art === "wave" ? PAL.brine : PAL.bog, z: 8, size: 1.5 });
            break;
          case "blink":
            P(e.x, e.y, 16, { speed: 60, life: 0.4, cols: PAL.mint, z: 12, size: 1.4 });
            P(e.nx, e.ny, 16, { speed: 60, life: 0.4, cols: PAL.mint, z: 12, size: 1.4 });
            break;
          case "heal":
            P(e.x, e.y, 14, { speed: 26, life: 0.7, cols: PAL.mint, vz: 34, grav: -10, z: 8, size: 1.4 });
            sparks.rise(e.x, e.y, 9, 24, { up: 26, life: 1.0, size: 1.5, palette: GLINT.mint });
            sparks.ring(e.x, e.y, { r: 18, life: 0.5, col: 0x8fffd0, a: 0.7 });
            healFlash = 0.6;
            break;
          case "fire": {
            const h = e.h;
            const n = h.kind === KIND.CIRCLE ? 16 : 24;
            const cols = h.friendly ? PAL.mint : h.style === "cold" ? PAL.fire : PAL.bog;
            for (let i = 0; i < n; i++) {
              const pt = pointIn(h);
              if (pt) parts.one(pt[0], pt[1], { speed: 40, life: 0.5, cols, vz: 40, grav: 90, z: 2, size: 1.5 });
            }
            dressing?.startleShape(h);
            break;
          }
          case "bell":
            // The bell struck: it swings, and a few bright flecks fly off it.
            bell3d?.strike(e.a, lastNow);
            sparks.flash(e.x, e.y, 22, { size: 30, life: 0.25, col: 0xffe08a, a: 1.6 });
            sparks.ring(e.x, e.y, { r: 46, life: 0.7, col: 0xffd66b, a: 0.7 });
            P(e.x, e.y, 14, { speed: 90, life: 0.5, cols: PAL.gold, z: 20, size: 1.4, spread: 6.3 });
            dressing?.startle(e.x, e.y, 70);
            break;
          case "entrance":
            // He lands: a ring of dust thrown out all round, clods and grass kicked up, everything nearby bolts.
            P(e.x, e.y, 70, { speed: 210, life: 0.75, cols: ["#6b6a3c", "#55562f", "#7d7a49", "#3f4226"], spread: 6.3, size: 2.4, kind: "dust", z: 2 });
            P(e.x, e.y, 26, { speed: 120, life: 0.6, cols: ["#4f6b2a", "#3c5320", "#6a5a34"], spread: 6.3, grav: 260, vz: 90, z: 4, size: 1.8 });
            landBurst(e.x, e.y, 1.6);
            sparks.ring(e.x, e.y, { r: 80, life: 0.6, col: 0xf0e2b8, a: 0.55 });
            dressing?.startle(e.x, e.y, 160);
            break;
          case "chest":
            chest3d.drop(lastNow);
            break;
          case "chestLand":
            // it lands: dust thrown out round it, a shake (the sim's), the garden's critters bolt
            chest3d.land(lastNow);
            P(e.x, e.y, 34, { speed: 120, life: 0.6, cols: ["#d8cfae", "#c2b48a", "#a89b72"], spread: 6.3, size: 2.6, kind: "dust", z: 2 });
            dressing?.startle(e.x, e.y, 90);
            break;
          case "chestOpen":
            chest3d.open(lastNow, e.a);
            dressing?.startle(e.x, e.y, 140);
            break;
          case "bossLand":
            // A hop coming down (content/bosses.js): the same earth thrown up round him, smaller.
            landBurst(e.x, e.y, e.small ? 0.7 : 1);
            sparks.ring(e.x, e.y, { r: e.small ? 34 : 48, life: 0.45, col: 0xf0e2b8, a: 0.4 });
            dressing?.startle(e.x, e.y, e.small ? 70 : 110);
            break;
          case "sfx": {
            // moments that only send a sound: shown too
            const b = w.boss;
            if (!b || b.hidden) break;
            if (e.name === "phase") {
              // a new phase: a ring of force off him and red motes up round him
              sparks.ring(b.x, b.y, { r: 80, life: 0.7, col: 0xff6a4a, a: 0.8 });
              sparks.rise(b.x, b.y, bossR, 40, { up: 30, life: 1.1, size: 1.8, palette: GLINT.red });
            } else if (e.name === "enrage") {
              sparks.flash(b.x, b.y, bossTop() * 0.8, { size: 34, life: 0.3, col: 0xff8060, a: 1.4 });
              sparks.rise(b.x, b.y, bossR, 50, { up: 34, life: 1.3, size: 1.9, palette: GLINT.red });
            } else if (e.name === "cast") {
              sparks.ring(b.x, b.y, { r: bossR + 14, life: 0.6, col: 0xb6f06b, a: 0.5 });
            } else if (e.name === "hop") {
              sparks.ring(b.x, b.y, { r: bossR + 10, life: 0.35, col: 0xf0e2b8, a: 0.35 });
              P(b.x, b.y, 18, { speed: 90, life: 0.5, cols: ["#7d7a49", "#6b6a3c", "#8c8358"], spread: 6.3, size: 2.2, kind: "dust", z: 2 });
            } else if (e.name === "throw" && w.player) {
              sparks.burst(w.player.x, w.player.y, 12, 6, { speed: 70, up: 10, dir: w.player.face, spread: 0.8, life: 0.25, size: 1.2, grav: 0, palette: GLINT.steel });
            }
            break;
          }
          case "jump":
            // off the ground: a puff of dust from his feet, a breath of air
            P(e.x, e.y, 10, { speed: 50, life: 0.4, cols: ["#7d7a49", "#6b6a3c", "#8c8358"], spread: 6.3, size: 2, kind: "dust", z: 1 });
            sparks.ring(e.x, e.y, { r: 12, life: 0.3, col: 0xf0e8d0, a: 0.4 });
            break;
          case "jumpLand":
            P(e.x, e.y, 12, { speed: 60, life: 0.45, cols: ["#7d7a49", "#6b6a3c", "#8c8358"], spread: 6.3, size: 2.2, kind: "dust", z: 1 });
            break;
          case "vault":
            // cleared it: a bright shimmer under him as it passes
            sparks.burst(e.x, e.y, 3, 10, { speed: 50, up: 10, life: 0.35, size: 1.5, grav: 0, palette: GLINT.gold });
            sparks.ring(e.x, e.y, { r: 16, life: 0.35, col: 0xffe08a, a: 0.7 });
            break;
          case "graze":
            // a shot rolled through: a shimmer where it passed him
            sparks.burst(e.x, e.y, 9, 6, { speed: 30, up: 12, life: 0.3, size: 1.2, grav: 0, palette: GLINT.white });
            break;
          case "spawn":
            P(e.x, e.y, 12, { speed: 50, life: 0.4, cols: e.kind === "ember" ? PAL.fire : e.kind === "hand" ? PAL.brine : PAL.bog, z: 4, size: 1.4 });
            dressing?.startle(e.x, e.y, 30);
            break;
        }
      }
    } catch (err) {
      fail("consume", err);
    }
  }
  /**
   * His weight coming down (the owner, 2026-10-09: "more impactful ... some particles sprouting up around him on the
   * landing"): from all round the rim of his body, clods, grass and chips of stone thrown up and out, falling back
   * under gravity, and a low ring of dust rolling out along the ground. `k` scales it: 1 a hop, 1.6 his arrival.
   */
  function landBurst(x, y, k = 1) {
    const r = bossR * 0.95;
    const n = Math.round(40 * k);
    const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + parts.rand() * 0.3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      // ("drop" keeps its size as it flies, a "spark" would shrink away: clods, turf, stone chips)
      P(px, py, 1, { dir: a, spread: 0.7, speed: 80 * k, life: 1.0, cols: ["#4a3a1f", "#6b5634", "#5a4527"], grav: 560, vz: 260 * k, z: 3, size: sz(3, 5), drag: 0.97, kind: "drop" });
      P(px, py, 1, { dir: a, spread: 1, speed: 60 * k, life: 0.9, cols: ["#5f8a2e", "#7aa33a", "#a6c94a"], grav: 420, vz: 210 * k, z: 4, size: sz(2.2, 3.4), drag: 0.96, kind: "drop" });
      if (i % 2 === 0) P(px, py, 1, { dir: a, spread: 0.5, speed: 110 * k, life: 0.8, cols: ["#b3ab98", "#d2cab4"], grav: 640, vz: 300 * k, z: 3, size: sz(1.6, 2.6), kind: "drop" });
      // a pale ring of dust rolling out low, which reads on any ground and over a red mark
      P(px, py, 1, { dir: a, spread: 0.4, speed: 170 * k, life: 0.6, cols: ["#d8cfae", "#c2b48a", "#a89b72"], size: sz(2.6, 4.2), kind: "dust", z: 2, drag: 0.9 });
    }
  }
  const P = (x, y, n, o) => parts.burst(x, y, n, o);
  /** A point inside a hazard, for its burst (the view's own random, never the sim's). */
  function pointIn(h) {
    const rand = parts.rand;
    for (let k = 0; k < 10; k++) {
      const r = radiusOf(h);
      let x;
      let y;
      if (h.kind === KIND.LANE) {
        const t = rand() * h.len;
        const s = (rand() - 0.5) * h.w;
        x = h.x + Math.cos(h.a) * t - Math.sin(h.a) * s;
        y = h.y + Math.sin(h.a) * t + Math.cos(h.a) * s;
      } else {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * (h.kind === KIND.FLOOD ? ARENA.R : r + (h.w || 0));
        x = h.x + Math.cos(a) * d;
        y = h.y + Math.sin(a) * d;
      }
      if (Math.hypot(x, y) <= ARENA.R) return [x, y];
    }
    return null;
  }

  // --- the hero's own sounds and dust (2D's heroDust and heroSwingCues, render.js) -----------------------
  // From the sim's clocks and the run's distance phase, so each lands exactly with the picture:
  // a step (and a puff) as each foot lands, the roll's landing, the whoosh as the blade goes live,
  // the heavy's slam where its blade meets the ground.
  const cueState = { state: -1, step: -1, t: 0, planted: [], armed: [] };
  function heroCues(p, s, pick) {
    const dust = (x, y, n, speed, dir, spread) => parts.burst(x, y, n, { speed, life: 0.5, cols: ["#5f6b3a", "#47512b", "#3a4424"], dir, spread, size: 1.6, kind: "dust", z: 1, vz: 12, grav: 30 });
    const back = Math.atan2(-s.vy, -s.vx);
    // A step as each foot plants (the legs' own state, anim/stride.js: the phase's marks no longer sit
    // on the touchdowns once the stride follows the speed — they fired 0.1 s early), the puff at it.
    const feet = heroModel?.stride?.state || [];
    // (armed only once the foot has really left the grass since: a foot let go and planted again where
    // it lay was a phantom step, 172 of them in 692 test runs)
    feet.forEach((f, i) => {
      const was = cueState.planted[i];
      cueState.planted[i] = f.mode === 1;
      if (f.lo > 0.3) cueState.armed[i] = true;
      if (pick.moveW > 0.3 && f.mode === 1 && was === false && cueState.armed[i] !== false) {
        cueState.armed[i] = false;
        const at = f.spot;
        dust(at.x || p.x, at.z || p.y, 3, 22, back, 1.2);
        onCue?.("step", "meadow");
      }
    });
    const fresh = s.state !== cueState.state || p.step !== cueState.step || s.t < cueState.t;
    const from = fresh ? -1 : cueState.t;
    if (s.state === STATE.ROLL && from < 0.202 && s.t >= 0.202) {
      dust(p.x, p.y, 7, 34, back, 2.2);
      onCue?.("rollLand");
    }
    if (s.state === STATE.ATTACK) {
      const c = moveOf(p);
      const heavy = c.fx === "heavy";
      if (from < c.wind && s.t >= c.wind) onCue?.(heavy ? "whooshHeavy" : "whoosh", p.step); // (the cut: each has its own swing, audio.js SAMPLES)
      if (heavy && from < c.wind + c.active && s.t >= c.wind + c.active) {
        // Where the blade bites the grass (heroCues runs after the model is posed), not a fixed
        // 18 units ahead: the 3D heavy lands at its own reach and angle.
        const tip = heroModel?.bladeTipXY();
        const tx = tip ? tip.x : p.x + Math.cos(p.face) * 18;
        const ty = tip ? tip.y : p.y + Math.sin(p.face) * 18;
        dust(tx, ty, 10, 46, p.face, 3);
        sparks.ring(tx, ty, { r: 20, life: 0.3, col: 0xf0e8d0, a: 0.5 });
        onCue?.("slamGround");
      }
    }
    cueState.state = s.state;
    cueState.step = p.step;
    cueState.t = s.t;
  }

  // The glints that last while something does (sparks3d.js): his dazed stars while he is staggered, green motes off
  // him while he croaks to heal, and gold rising from him as his body fades after the win.
  let glintAcc = 0;
  const bossTop = () => (bossFor === "gnasher" ? TOAD_H : (BOSS_MODELS[bossFor]?.height ?? bossR * 1.6));
  function glints(w, now) {
    const b = w.boss;
    if (!b || b.hidden) return;
    const dt = Math.max(0, Math.min(0.1, now - (glints.last ?? now)));
    glints.last = now;
    if (b.stagger > 0 && b.hp > 0) sparks.orbit("daze", toadAt.x, toadAt.y, bossTop() + 4, 9, now + 0.05);
    glintAcc += dt;
    while (glintAcc >= 1 / 30) {
      glintAcc -= 1 / 30;
      if (b.casting && b.hp > 0 && w.state === "fight") sparks.rise(toadAt.x, toadAt.y, bossR * 0.8, 1, { h: 4, up: 20, life: 0.9, size: 1.5, palette: GLINT.green });
      if (w.state === "won" && lerp.stateT(w) > 0.4 && lerp.stateT(w) < 2.3) sparks.rise(toadAt.x, toadAt.y, bossR * 0.9, 3, { h: 2, up: 28, life: 1.2, size: 1.7, palette: GLINT.gold });
    }
  }

  // --- posing the placeholders ------------------------------------------------------------------------
  function poseHero(w, now) {
    const p = w.player;
    const s = lerp.hero(w);
    heroBlob.position.set(p.x, 0.08, p.y);
    heroBlob.scale.setScalar(1 - 0.45 * jumpLift(s)); // (his shadow smaller as he goes up)
    if (heroModel) {
      const flash = now - heroHurtT < 0.2 ? 0.8 * (1 - (now - heroHurtT) / 0.2) : 0;
      // The i-frame blink after a hurt (not the roll's, which the afterimages show).
      const blink = p.iFrames > 0 && p.state !== STATE.ROLL && Math.floor(now * 16) % 2 === 0 ? 0.45 : 1;
      // (the boss for his look-at, where it is drawn; real time for the hit-stop's shake)
      // (after a win, the chest waiting to be opened)
      const look = w.boss && !w.boss.hidden && w.boss.hp > 0 ? { x: w.boss.x, z: w.boss.y } : w.chest?.landed && w.chest.openAt == null ? { x: w.chest.x, z: w.chest.y } : null;
      const pick = heroModel.update(p, s, { t: lerp.viewTime(w), stateT: lerp.stateT(w), worldState: w.state }, { flash, alpha: blink, now, lookAt: look });
      heroFx.update(p, s, lerp.viewTime(w));
      heroCues(p, s, pick);
      return;
    }
    hero.position.set(p.x, 0, p.y);
    heroBody.rotation.set(0, yawOf(s.face), 0);
    heroBody.scale.set(1, 1, 1);
    heroBody.position.set(0, 0, 0);
    capsule.rotation.set(0, 0, 0);
    capsule.position.set(0, HERO_H / 2, 0);
    swordPivot.rotation.set(0, 0, 0);
    swordPivot.visible = true;
    if (s.state === STATE.ROLL) {
      // A tumble along the facing, over the roll's time.
      const u = clamp(s.t / PLAYER.roll.time, 0, 1);
      const spin = u * Math.PI * 2;
      capsule.position.set(0, 6 + Math.sin(u * Math.PI) * 2, 0);
      capsule.rotation.set(spin, 0, 0);
      heroBody.scale.set(1, 0.85, 1);
      swordPivot.visible = false;
    } else if (s.state === STATE.ATTACK) {
      const c = moveOf(p);
      // The blade sweeps the way the hitbox does: from face − dir·arc/2 to face + dir·arc/2 (config.js sweepDir).
      const k = s.t < c.wind ? 0 : clamp((s.t - c.wind) / c.active, 0, 1);
      const wind = s.t < c.wind ? s.t / c.wind : 1;
      const off = sweepDir(c) * (-c.arc / 2 + c.arc * k - (1 - wind) * 0.25);
      swordPivot.rotation.set(0, -off, 0);
    } else if (s.state === STATE.HURT) {
      heroBody.rotation.x = -0.25;
    } else if (p.dead || s.state === STATE.DEAD) {
      const u = clamp(lerp.stateT(w) / 0.45, 0, 1);
      heroBody.rotation.x = -u * Math.PI * 0.48;
    } else {
      // Standing or running: a little lean into the run and a bob.
      const sp = Math.hypot(s.vx, s.vy);
      const lean = clamp(sp / PLAYER.speed, 0, 1) * 0.16;
      heroBody.rotation.x = lean;
      heroBody.position.y = sp > 5 ? Math.abs(Math.sin(lerp.viewTime(w) * 11)) * 0.9 : Math.sin(lerp.viewTime(w) * 2.1) * 0.2;
      swordPivot.rotation.set(0, 0.9 * FORE, 0); // (held out at the sword side)
    }
    const flash = p.flash > 0 || now - heroHurtT < 0.12;
    heroMat.emissive.setHex(flash ? 0xffffff : 0x000000);
    heroMat.emissiveIntensity = flash ? 0.8 : 0;
  }

  // Gnasher (docs/3D-PLAN.md 7.4): the picker (anim/boss-anim3d.js) decides the clip and the
  // procedural pieces; until his rigged model exists (M7) the placeholder shows them as squash,
  // the lunge's lurch, the throat sac, the open mouth — and the real tongue, drawn from the lane.
  const bossRec = makeBossRecord();
  let toadYaw = null;
  const toadSquash = { x: 1, v: 0 };
  let lastViewT = null;
  const toadAt = { x: 0, y: 0, lift: 0 }; // where he is drawn this frame, for the fades
  function poseToad(w, now) {
    const b = w.boss;
    if (!b) return;
    ensureBoss(w);
    // Not yet in the garden (a bell entrance before he leaps in): nowhere to be seen.
    // (gone too once the chest has come: his body faded away in the win, render3d's uDissolve below)
    const gone = b.hidden || w.state === "chest" || w.state === "looted";
    toad.visible = toadBlob.visible = !gone;
    if (bossModel) bossModel.object.visible = !gone;
    if (gone) return;
    const s = lerp.boss(w);
    const viewT = lerp.viewTime(w);
    const dt = lastViewT == null ? 0 : Math.max(0, Math.min(0.1, viewT - lastViewT));
    lastViewT = viewT;
    const at = leap(b, s.moveT);
    const lift = at.lift * H_TO_3D;
    toadAt.x = at.x;
    toadAt.y = at.y;
    toadAt.lift = lift;
    const pick = bossModel ? bossModel.update(b, s, w, { t: viewT }, at, lift) : bossAnimState(bossRec, b, s, w, { t: viewT });
    const rec = bossModel ? bossModel.record : bossRec;
    toad.position.set(at.x, lift, at.y);
    // He turns visibly, then commits: a 100 ms damper on his facing.
    const want = yawOf(s.face);
    toadYaw = toadYaw == null ? want : dampAngle(toadYaw, want, 0.1, dt);
    toadBody.rotation.set(0, toadYaw, 0);
    // Squash on a spring towards the picker's target (landings overshoot), breathing on top.
    const sy = springStep(toadSquash, pick.squash, 5, 0.5, dt) * (1 + pick.breathe * 0.02);
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    toadBody.scale.set(sxz, sy, sxz * (1 + pick.lurch * 0.12));
    toadBody.position.set(0, 0, 0);
    toadBody.rotation.x = (b.stagger > 0 ? -0.18 : 0) + pick.lurch * 0.14 + (pick.clip === "dead" ? -Math.PI * 0.45 * pick.u : 0);
    sac.scale.setScalar(Math.max(0.001, pick.sac) * 6.5);
    sac.visible = pick.sac > 0.02;
    mouth.scale.set(TOAD_R * 0.62, Math.max(0.02, pick.mouth) * 4.5, 3);
    mouth.visible = pick.mouth > 0.02;
    // The tongue, from the live lash lane: out in 0.08 s, held while live, drawn back as it fades.
    const h = pick.tongue;
    if (h) {
      const hp = lerp.hazard(h);
      const ph = h.t - h.tele;
      const k = ph <= h.active ? Math.min(1, (viewT - rec.strikeAt) / 0.08) : Math.max(0, 1 - (ph - h.active) / Math.max(0.05, h.fade)) * (1 + 0.08 * Math.sin((ph - h.active) * 40));
      const mx = at.x + Math.cos(hp.a) * TOAD_R * 0.7;
      const mz = at.y + Math.sin(hp.a) * TOAD_R * 0.7;
      tongue.update([mx, lift + TOAD_H * 0.4, mz], h, hp, k);
    } else tongue.update(null, null, null, 0);
    // The hit flash: towards white (never red, the telegraph colour), on real time; the Horn's
    // stagger tints it grey-blue while immune, as in 2D.
    const since = now - toadHitT;
    for (const m of bossModel ? bossModel.materials : [toadMat]) {
      m.userData.paint.uFlash.value = since < 0.12 ? 0.75 * (1 - since / 0.12) : 0;
      m.userData.paint.uTintAmt.value = b.immune ? 0.45 : 0;
      m.userData.paint.uDissolve.value = w.state === "won" ? Math.max(0, (lerp.stateT(w) - 0.6) / 1.6) : 0;
    }
    // While airborne his shadow-map shadow would land off to the side (a false landing spot), so
    // only the blob under him stays.
    for (const m of [belly, cream, ...eyes]) m.castShadow = lift < 2;
    const shrink = 1 - clamp(lift / 40, 0, 0.45);
    toadBlob.position.set(at.x, 0.08, at.y);
    toadBlob.scale.set(bossR * 1.08 * shrink, 1, bossR * 1.08 * shrink);
    toadBlob.material.opacity = toadBlob.userData.baseOpacity * (0.5 + 0.5 * shrink);
  }

  function poseAddsAndShots(w) {
    let i = 0;
    for (const a of w.adds) {
      const set = ART.add[a.type];
      if (!set) continue;
      const dying = !a.alive;
      if (dying && a.dying > 0.4) continue;
      const spr = dying ? frameOf(ART.add[a.type === "fly" ? "popGreen" : a.type === "ember" ? "popFire" : "popWater"], a.dying, 9, false) : frameOf(set, a.t, a.type === "fly" ? 16 : 7);
      if (!spr) continue;
      const o = addAt(i++);
      o.g.visible = true;
      o.blob.visible = !dying;
      o.g.material.map = cardTex(spr);
      o.g.material.color.setScalar(a.flash > 0 ? 3 : 1);
      o.g.material.opacity = dying ? Math.max(0, 1 - a.dying / 0.4) : a.spawn > 0 ? 1 - a.spawn : 1;
      // Sprite pixels are 2D screen units; a view unit is √2 of them.
      const sc = (dying ? 1.4 : 1.3) / (spr.ppu || 1) / Math.SQRT2;
      o.g.scale.set(spr.w * sc, spr.h * sc, 1);
      const lift = (dying ? 6 : a.spawn > 0 ? a.spawn * 14 : 0) * H_TO_3D;
      o.g.position.set(a.x, 6 + lift, a.y);
      o.blob.position.set(a.x, 0.08, a.y);
    }
    for (; i < adds.length; i++) adds[i].g.visible = adds[i].blob.visible = false;
    let j = 0;
    for (const s of w.shots) {
      if (s.dead) continue;
      const o = shotAt(j++);
      // Near the edge it fades out (4.11): from where it stops being able to hurt (r 116 plus its
      // radius) to R + 10, where the sim drops it, so it is gone before it would fly into a wall.
      const r0 = R_SEEN + (s.r || 6);
      const k = clamp(1 - (Math.hypot(s.x, s.y) - r0) / (ARENA.R + 10 - r0), 0, 1);
      o.m.material.opacity = k;
      o.blob.material.opacity = o.blob.userData.baseOpacity * k;
      o.m.visible = o.blob.visible = k > 0.01;
      const r = (s.r || 6) * 0.6;
      o.m.scale.setScalar(r);
      o.m.position.set(s.x, 5, s.y);
      o.blob.position.set(s.x, 0.08, s.y);
    }
    for (; j < shots.length; j++) shots[j].m.visible = shots[j].blob.visible = false;
  }

  // --- the frame -------------------------------------------------------------------------------------------
  let badFrames = 0;
  const frameTimes = [];
  let lastT = 0;
  // The shaders compile in the background while the name card is up (M9): until they are ready
  // the intro's frames are skipped, so the card's own animation never stalls on a shader link.
  // A fight frame never waits; it draws, compiling whatever is left.
  let compiled = false;
  const ready = Promise.resolve()
    .then(() => (gl.compileAsync ? Promise.all([gl.compileAsync(scene, camera), gl.compileAsync(marks.scene, camera)]) : null))
    .catch(() => {})
    // The garden's textures upload now too (plan 9.6, critique #4), not on the first intro frame,
    // which the tier monitor measures. One that fails here just uploads when it is first drawn.
    .then(() => {
      for (const t of paint?.textures || [])
        try {
          gl.initTexture(t);
        } catch {
          // left to the first frame that draws it
        }
    })
    .then(() => {
      compiled = true;
    });
  function draw(w, cam, now) {
    if (!compiled && w.state === "intro") return;
    try {
      drawFrame(w, cam, now);
      badFrames = 0;
    } catch (err) {
      if (++badFrames >= 3) fail("draw", err);
      else if (typeof console !== "undefined") console.error("3D view: frame failed", err);
    }
  }
  /**
   * The bench's close look (dev-fight.html ?closeup=hero|boss): the same camera, lights and procedural
   * poses as the game, only placed round one character — `yaw` degrees round from the game's own view
   * direction (0 = as the game sees him, 180 = from behind), `pitch` degrees up, `span` world units tall.
   */
  const closeAt = new Vector3();
  function closeCamera(c, w, f) {
    const who = c.who === "boss" ? w.boss : w.player;
    if (!who) return;
    const h = c.h ?? (c.who === "boss" ? 14 : 9);
    const base = Math.atan2(f.pos[0] - f.target[0], f.pos[2] - f.target[2]);
    // (&cface=<deg>: the yaw from his facing instead — the camera that far round from his front, toward his right)
    const yaw = c.face != null ? Math.PI / 2 - (who.face + (c.face * Math.PI) / 180) : base + ((c.yaw || 0) * Math.PI) / 180;
    const pitch = ((c.pitch ?? 20) * Math.PI) / 180;
    const span = c.span || 30;
    const aspect = (f.right - f.left) / (f.top - f.bottom);
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.left = (-span / 2) * aspect;
    camera.right = (span / 2) * aspect;
    camera.near = 1;
    camera.far = 2000;
    // (&cfocus=grip: on the sword's grip, where the hand holds it)
    const at = c.focus === "grip" && heroModel?.sword ? heroModel.sword.group.getWorldPosition(closeAt) : closeAt.set(who.x, h, who.y);
    camera.position.set(at.x + Math.cos(pitch) * Math.sin(yaw) * 400, at.y + Math.sin(pitch) * 400, at.z + Math.cos(pitch) * Math.cos(yaw) * 400);
    camera.lookAt(at);
    camera.updateProjectionMatrix();
  }

  // The warm-up (the owner, 2026-10-09: "I notice some lagspikes now and then"): three.js builds a material's shader
  // and uploads its textures the first time it is drawn, and compileAsync above only reaches what is visible then. A
  // fight's first-time things are hidden at the start — the boss behind the wall until the bell (his paint, his shadow's
  // skinned depth shader, 5 textures: a 100 ms frame as he leapt in), the hero's see-through i-frame blink (3 shaders: 74
  // ms at the first hurt), the knives, the hazard marks, the roll's afterimages, the tongue, the flies — so each one
  // stalled a frame mid-fight, measured on this PC's GPU (a phone pays several times that). Here, on the first frame
  // (and again when the boss model changes), everything is drawn once, off screen, as it will be: every object shown,
  // uncropped, on every layer, the hero's paint see-through, one fly and one shot from the pools; then put back.
  let warmedFor = null;
  function warm() {
    warmedFor = bossFor;
    const fly = frameOf(ART.add.fly, 0, 16);
    const a0 = addAt(0);
    if (fly) a0.g.material.map = cardTex(fly);
    const s0 = shotAt(0);
    const shown = [];
    const see = [];
    // (every shader is built for the lights it is lit by: a light stays as seen now — one in a hidden group off too)
    // (each character's skinned meshes get a depth material of their own for the shadow: three.js shares one among
    // every caster, and picks its shader again, map or not, skinned or not, with the light count of the moment, as the
    // draw order happens to switch — the toad first drawn after an unskinned caster built a new one as he landed)
    scene.traverse((o) => {
      if (o.isSkinnedMesh && o.castShadow && !o.customDepthMaterial) o.customDepthMaterial = new MeshDepthMaterial();
    });
    const lit = new Map();
    for (const root of [scene, marks.scene])
      root.traverse((o) => {
        if (!o.isLight) return;
        let on = true;
        for (let a = o; a; a = a.parent) on &&= a.visible;
        lit.set(o, on);
      });
    const all = (root) =>
      root.traverse((o) => {
        shown.push([o, o.visible, o.frustumCulled]);
        o.visible = lit.has(o) ? lit.get(o) : true;
        o.frustumCulled = false;
      });
    all(scene);
    all(marks.scene);
    heroModel?.object.traverse((o) => {
      for (const m of [o.material].flat()) if (m?.userData?.paint && !m.transparent) (m.transparent = true), see.push(m);
    });
    const layers = camera.layers.mask;
    camera.layers.enableAll();
    try {
      // (a shadow pass compiles its depth shaders with the lights of the scene's last pass: after the glow pass (layer
      // 1) or the fades (layer 2), no sun — so the shadows are drawn once after each of those as well; one left out
      // was the toad's 100 ms frame)
      gl.setRenderTarget(post.scene);
      gl.render(scene, camera);
      const shadowsWere = gl.shadowMap.autoUpdate;
      for (const layer of [1, 2]) {
        camera.layers.set(layer);
        gl.shadowMap.autoUpdate = false;
        gl.render(scene, camera);
        gl.shadowMap.autoUpdate = shadowsWere;
        camera.layers.enableAll();
        gl.render(scene, camera);
      }
      gl.setRenderTarget(post.decal);
      gl.render(marks.scene, camera);
    } catch (err) {
      console.error("3D view: warm-up failed", err); // (only a first-time stall saved; the frame goes on)
    } finally {
      for (const [o, v, c] of shown) (o.visible = v), (o.frustumCulled = c);
      for (const m of see) m.transparent = false;
      camera.layers.mask = layers;
      a0.g.visible = a0.blob.visible = s0.m.visible = s0.blob.visible = false;
    }
  }

  function drawFrame(w, cam, now) {
    const { w: vw, h: vh } = fitCamera(cam);
    const dt = Math.max(0, Math.min(0.1, now - lastNow));
    lastNow = now;
    hurtFlash = Math.max(0, hurtFlash - dt * 4);
    healFlash = Math.max(0, healFlash - dt * 1.8);

    const k = texelFactor(cam, { override: texel ?? debug.texel ?? null });
    const f = cameraFrame(cam, k);
    post.ensure(f.W, f.H);
    camera.left = f.left;
    camera.right = f.right;
    camera.top = f.top;
    camera.bottom = f.bottom;
    camera.near = f.near;
    camera.far = f.far;
    camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(f.target[0], f.target[1], f.target[2]);
    camera.updateProjectionMatrix();
    if (debug.closeup) closeCamera(debug.closeup, w, f);
    wind.step(dt);
    look.uWind.value.set(0.946, 0.324, wind.gust, now);
    look.uTexelWorld.value = (f.right - f.left) / f.W; // one low-resolution texel, in world units
    // The pool of sun sits on the hero (his in-between position: fight.js lerps the world before
    // drawing), the dapples drift.
    lights.update(w.player.x, w.player.y, now);

    gl.info.reset();
    // The garden: the flames flicker, and the lantern light term follows them (docs/3D-PLAN.md 4.10).
    garden.update(now);
    life.update(dt, now);
    look.uLantCount.value = Math.min(8, garden.lanterns.length);
    const lit = TIERS[tierName].lanterns;
    const near = garden.lanterns
      .map((l, i) => [Math.hypot(l.x - f.target[0], l.z - f.target[2]), i])
      .sort((a, b) => a[0] - b[0])
      .slice(0, lit)
      .map(([, i]) => i);
    for (let i = 0; i < look.uLantCount.value; i++) {
      const want = near.includes(i) ? 1 : 0;
      lantOn[i] = want > lantOn[i] ? Math.min(want, lantOn[i] + dt / 0.3) : Math.max(want, lantOn[i] - dt / 0.3);
      const l = garden.lanterns[i];
      look.uLant.value[i].set(l.x, l.y, l.z, l.w * lantOn[i]);
    }
    heroModel?.setView(f.W, f.H);
    chest3d.setView(f.W, f.H);
    bossModel?.setView(f.W, f.H);
    poseHero(w, now);
    poseToad(w, now);
    bell3d?.update(w, now);
    chest3d.update(w, now, camera);
    glints(w, now);
    sparks.update(now);
    poseAddsAndShots(w);
    poseCritters(w, dt);
    // (the grip's close look aimed again now the hero is posed: from last frame's pose it trailed the grip)
    if (debug.closeup?.focus === "grip") closeCamera(debug.closeup, w, f);
    partMesh.update(parts);
    dbg.update(w, debug.showHitboxes);

    // Which props fade this frame (fade3d.js): every one not fully opaque is dropped from the main
    // pass through the mask and drawn on the fade layer at its own opacity.
    const targets = debug.fade === 0 || debug.empty ? 0 : fadeTargets(garden.fadeGroups, w, { toadR: TOAD_R, toad: w.boss ? toadAt : null, aim: aimPreview?.(), hazAt: (h) => lerp.hazard(h) });
    const fades = fader.step(targets, dt);
    look.uFadeMask.value = fades.mask;
    look.uFadeA.value = fades.alpha;
    // The bench's empty stage (dev-fight.html ?empty=1): only the looked-at character and the lights,
    // on plain grey — nothing of the garden in front of a limb being judged (the owner, 2026-10-03).
    if (debug.empty) {
      const keep = debug.closeup?.who === "boss" ? [bossModel?.object] : [heroModel?.object, heroModel?.cape?.mesh];
      // (the hero's trails and afterimages keep their own say: a cut is judged with its trail)
      const own = debug.closeup?.who === "boss" ? [] : heroFx?.objects || [];
      for (const o of scene.children) if (!own.includes(o)) o.visible = o.isLight || keep.includes(o);
    }
    if (warmedFor !== bossFor && !debug.empty) warm();
    gl.setRenderTarget(post.scene);
    gl.setClearColor(debug.empty ? 0x8a8f94 : CLEAR, 1);
    gl.clear(true, true, false);
    gl.render(scene, camera);

    // Props that would hide the fight: dropped above (the mask), drawn here on their own layer,
    // only where they stand in front of what the main pass drew (4.11).
    const faded = look.uFadeMask.value !== 0;
    if (faded) {
      gl.setRenderTarget(post.fade);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false);
      look.uFadeMode.value = 1;
      look.tSceneDepth.value = post.scene.depthTexture;
      look.uFadeTex.value.set(f.W, f.H);
      camera.layers.set(2);
      const sw = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      gl.render(scene, camera);
      gl.shadowMap.autoUpdate = sw;
      camera.layers.set(0);
      look.uFadeMode.value = 0;
      // Unbound again: left bound, the next main pass (which writes that depth) would read it too —
      // a feedback loop, and WebGL drops every draw that has it bound.
      look.tSceneDepth.value = null;
    }

    // The glow layer, against the scene's own depth, so nothing hidden glows through a tree; only
    // drawn while there is bloom to make from it.
    if (bloomOn > 0) {
      gl.setRenderTarget(post.emissive);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, false, false);
      camera.layers.set(1);
      const shadowsWere = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      partMesh.glowPass(true);
      gl.render(scene, camera);
      partMesh.glowPass(false);
      gl.shadowMap.autoUpdate = shadowsWere;
      camera.layers.set(0);
    }

    gl.setRenderTarget(post.decal);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    if (!debug.empty && marks.update(w, (h) => lerp.hazard(h), now, aimPreview?.(), w.player, cam.zoom, post.scene.depthTexture, f.W, f.H)) gl.render(marks.scene, camera);

    const low = Math.max(0, 1 - w.player.hp / (w.player.hpMax * 0.35));
    const [sx0, sy0, sw0, sh0] = cam.safe();
    post.finish(f, vw, vh, { hurt: Math.min(0.65, hurtFlash * 1.4 + low * 0.3), heal: healFlash, focus: [sx0 + sw0 / 2, sy0 + sh0 / 2], grade: debug.grade ?? 1, lift: debug.lift ?? 0, bloom: debug.albedo ? 0 : bloomOn && mood?.bloom != null ? mood.bloom : bloomOn, fade: faded, mood, ...(mood?.vignette != null ? { vignette: mood.vignette } : {}), ...(debug.albedo ? { vignette: 0 } : {}) });

    // The tier: at the end of the name card drop one if frames are too slow; in the fight, only
    // cheap cuts (bloom and its glow pass off, then half the shadow map: a new map, no new shaders).
    const verdict = tierMon.frame(performance.now(), w.state === "intro");
    if (fixedTier) {
      // the bench asked for this tier: no drops, no cuts
    } else if (verdict?.drop && TIERS[tierName].next) {
      tierName = TIERS[tierName].next;
      applyTier();
      plantGarden();
      saveTier(tierName);
    } else if (verdict?.cut === 1) bloomOn = 0;
    else if (verdict?.cut === 2 && sun.shadow.mapSize.x > 512) {
      sun.shadow.mapSize.divideScalar(2);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    let stats = null;
    if (debug.fps) {
      const t = performance.now();
      if (lastT) frameTimes.push(t - lastT);
      lastT = t;
      if (frameTimes.length > 120) frameTimes.shift();
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const med = sorted[sorted.length >> 1] || 16.7;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || med;
      const info = gl.info.render;
      stats = [`fps ${(1000 / med).toFixed(0)}  p95 ${p95.toFixed(1)} ms`, `draws ${info.calls}  tris ${info.triangles}`, `k ${k}  scene ${f.W}x${f.H}  hero ${((24 * cam.closeZoom) / k).toFixed(0)} texels`, `tier ${tierName}  refresh ${(1000 / tierMon.refreshMs).toFixed(0)} Hz  programs ${gl.info.programs?.length ?? "?"}`];
    }
    overlay.draw(w, cam, stats);
  }

  // --- a lost context: pause (fight.js), wait up to 2 s for it to come back, else 2D --------------------
  let lostTimer = 0;
  const onLost = (e) => {
    e.preventDefault();
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => fail("context lost"), 2000);
  };
  const onRestored = () => clearTimeout(lostTimer);
  canvasEl.addEventListener("webglcontextlost", onLost);
  canvasEl.addEventListener("webglcontextrestored", onRestored);

  // Sizing runs outside draw (fight.js calls it on a resize), so it has its own guard.
  function guardedFit(cam) {
    try {
      return fitCamera(cam);
    } catch (err) {
      fail("fitCamera", err);
      return { w: 1, h: 1 };
    }
  }

  function destroy() {
    // A smooth fight counts towards starting the next one a tier up (tiers3d.js).
    if (!fixedTier && !failed) afterFight(tierName, tierMon.smooth);
    clearTimeout(lostTimer);
    canvasEl.removeEventListener("webglcontextlost", onLost);
    canvasEl.removeEventListener("webglcontextrestored", onRestored);
    ro?.disconnect();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
    });
    chest3d.dispose();
    sparks.dispose();
    paint?.dispose(); // shared by the garden's materials, so they never free them themselves
    partMesh.dispose();
    life.dispose();
    bench.dispose();
    marks.dispose();
    post.dispose();
    overlay.dispose();
    gl.dispose();
    gl.forceContextLoss();
  }

  return {
    draw,
    /** Resolves once the shaders are compiled (the benches wait for it before a capture). */
    ready,
    beforeStep,
    lerpWorld,
    consume,
    parts,
    lights: { flash() {}, frame() {} },
    wind,
    resize: guardedFit,
    dress() {},
    seedAmbient() {},
    fitCamera: guardedFit,
    destroy,
    /** The placeholders cue no sounds of their own: fight.js plays the swing on the press. */
    /** True with the skinned hero: its own clocks cue the swing, so the button press does not. */
    get cuesHeroSounds() {
      return !!heroModel;
    },
    get usingGL() {
      return true;
    },
    get buffer() {
      return null;
    },
    /** For the bench and the tests. */
    three: { gl, scene, camera, post, look },
  };
}
