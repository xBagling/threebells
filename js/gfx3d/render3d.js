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
import { floorAt, setFloorHeights } from "./floorh3d.js?v=48fd128-df87a96f";
import { WebGLRenderer, ShaderMaterial, Scene, OrthographicCamera, PerspectiveCamera, Matrix4, Color, Mesh, Group, MeshLambertMaterial, MeshBasicMaterial, SkinnedMesh, CapsuleGeometry, SphereGeometry, BoxGeometry, PCFShadowMap, Sprite, SpriteMaterial, CanvasTexture, NearestFilter, SRGBColorSpace, Vector3, MeshDepthMaterial, RGBAFormat, DataTexture, RGFormat, UnsignedByteType, NoColorSpace } from "./three-lib.js?v=48fd128-df87a96f";
import { cameraFrame, texelFactor, H_TO_3D } from "./camera3d.js?v=48fd128-df87a96f";
import { makeLerp3D } from "./lerp3d.js?v=48fd128-df87a96f";
import { makeLeap } from "./leap3d.js?v=48fd128-df87a96f";
import { makePost } from "./post3d.js?v=48fd128-df87a96f";
import { makeHazardLayer } from "./hazards3d.js?v=48fd128-df87a96f";
import { makeParticleMesh, makeBlob } from "./fx3d.js?v=48fd128-df87a96f";
import { makeOverlay } from "./overlay3d.js?v=48fd128-df87a96f";
import { FEEL } from "../feel.js?v=48fd128-df87a96f";
import { makeLookUniforms, paintMaterial, makeBrushNoise } from "./materials3d.js?v=48fd128-df87a96f";
import { makeHero3D } from "./hero3d.js?v=48fd128-df87a96f";
import { makeBoss3D } from "./boss3d.js?v=48fd128-df87a96f";
import { makeHeroFx } from "./herofx3d.js?v=48fd128-df87a96f";
import { makeLights3D } from "./lights3d.js?v=48fd128-df87a96f";
import { MOODS, applyMood } from "./moods3d.js?v=48fd128-df87a96f";
import { gardenLayout, R_SEEN } from "./layout3d.js?v=48fd128-df87a96f";
import { makeWind } from "../gfx/wind.js?v=48fd128-df87a96f";
import { makeTongue, TONGUE_COLOR, tongueFloor, tongueMouth } from "./tongue3d.js?v=48fd128-df87a96f";
import { SLAM_SWEEP, SLAM_R, SLAM_R_SMALL } from "../content/bosses.js?v=48fd128-df87a96f";
import { BOSS_MODELS } from "./boss-profiles.js?v=48fd128-df87a96f";
import { makeDebug3D, makeBenchOverlays } from "./debug3d.js?v=48fd128-df87a96f";
import { TIERS, startTier, saveTier, afterFight, makeTierMonitor } from "./tiers3d.js?v=48fd128-df87a96f";
import { buildGarden } from "./arena3d.js?v=48fd128-df87a96f";
import { makeBackdrop, makeBackdropFx, makeRefBackdrop, makeRefFlames, makeRefBell } from "./backdrop3d.js?v=48fd128-df87a96f";
import { makeCampBackdrop, makeCampFx } from "./camp3d.js?v=48fd128-df87a96f";
import { lineOf as lineOfE, linedIds } from "./mapedit3d.js?v=48fd128-df87a96f";
import { makeProjectedShadows, watchTree, treeGeneration } from "./shadow3d.js?v=48fd128-df87a96f";
import { makeBogLife } from "./boglife3d.js?v=48fd128-df87a96f";
import { makeGeysers } from "./geyser3d.js?v=48fd128-df87a96f";
import { VIEW, KY, toWorld as isoToWorld } from "../gfx/iso.js?v=48fd128-df87a96f";
import { gardenTextures } from "./paint3d.js?v=48fd128-df87a96f";
import { fadeTargets, makeFader } from "./fade3d.js?v=48fd128-df87a96f";
import { makeLife3D } from "./life3d.js?v=48fd128-df87a96f";
import { makeBossRecord, bossAnimState } from "./anim/boss-anim3d.js?v=48fd128-df87a96f";
import { dampAngle, springStep } from "./anim/procedural.js?v=48fd128-df87a96f";
import { makeParticles, PAL } from "../gfx/particles.js?v=48fd128-df87a96f";
import { STATE, moveOf, jumpLift } from "../sim/player.js?v=48fd128-df87a96f";
import { KIND, radiusOf, hits, phaseOf, shown } from "../sim/hazards.js?v=48fd128-df87a96f";
import { PLAYER, ARENA, FORE, sweepDir, FIGHT } from "../config.js?v=48fd128-df87a96f";
import { clamp, rng } from "../util.js?v=48fd128-df87a96f";
import { ART, frameOf } from "../gfx/atlas.js?v=48fd128-df87a96f";
import { makeDressing } from "../gfx/dressing.js?v=48fd128-df87a96f";
import { makeBell3D } from "./bell3d.js?v=48fd128-df87a96f";
import { passView } from "./passview.js?v=48fd128-df87a96f";
import { makeChest3D } from "./chest3d.js?v=48fd128-df87a96f";
import { makeSparks3D, GLINT } from "./sparks3d.js?v=48fd128-df87a96f";
import { makeCinderFx, EMBER } from "./cinder3d.js?v=48fd128-df87a96f";
import { makeKingChain } from "./kingchain3d.js?v=48fd128-df87a96f";
import { FIRE_TAGS } from "./hazards3d.js?v=48fd128-df87a96f";

const HERO_H = 19.6; // 3D units (24 screen units × √⅔, docs/3D-PLAN.md 2.5)
const TOAD_H = 27.8;
const CHEST_FALL = 150; // (chest3d.js FALL: how high the chest drops from — Gnasher is squashed under it, poseToad)
const TOAD_R_DEFAULT = 16; // D13a: about the image's toad (radius 15–16); the sim's radius stays 26

// (the newest renderer: the module-wide things one sets — the stick's VIEW.ky, the floor's heights, the tongue's floor and mouth,
// window.__shadows, __bogLife — are put back by its destroy() only while no newer one has taken them over)
let liveRenderer = null;

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

export function makeRenderer3D(canvasEl, { debug = {}, onCue = null, aimPreview = null, onFail = null, texel = null, aa = null, assets = {}, demoMarks = null, holdForPrograms = false } = {}) {
  // `aa`: a smoothing try from the fight screen (?smooth=): its pixel size, upscale, multisampling.
  // Without one (and without the bench's own switches): on a phone or tablet (a finger is its main
  // pointer) 2 screen pixels per texel with 4x multisampling and sharp-bilinear enlarging (try 5); on
  // a desktop the native resolution with 4x multisampling (try 6) — the owner's picks, 2026-10-02.
  // `legacy` keeps the old hard texels.
  if (!aa && texel == null && debug.texel == null && !debug.upscale && !debug.msaa) aa = touchFirst() ? { texel: 2, msaa: 4, upscale: "sharp" } : { texel: 1, msaa: 4 };
  if (aa?.legacy) aa = null;
  if (aa?.texel != null && texel == null) texel = aa.texel;
  const gl = new WebGLRenderer({ canvas: canvasEl, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
  const self = {}; // (this renderer, for liveRenderer)
  liveRenderer = self;
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
  // The hero's and the boss's projected shadows (shadow3d.js; docs/SHADOWS.md): their own direction, length, skew and
  // opacity, on whatever the frame's depth holds. Live: window.__shadows.params; the bench's &shrot= &shlen= &shstr=
  // &shskew= &shop= &shsoft= &shoff=x,y &shadow=0.
  const shadows = makeProjectedShadows(gl);
  globalThis.__shadows = shadows;
  {
    const sp = shadows.params, num = (v) => (v == null ? null : Number(v));
    if (debug.shadow != null) sp.on = debug.shadow !== 0 && debug.shadow !== "0";
    for (const [k, key] of [["shrot", "rotation"], ["shlen", "length"], ["shstr", "stretch"], ["shskew", "skew"], ["shop", "opacity"], ["shsoft", "softness"], ["shreach", "reach"]]) if (num(debug[k]) != null) sp[key] = num(debug[k]);
    if (debug.shoff) sp.offset = String(debug.shoff).split(",").map(Number);
  }
  // (a model's size, for its silhouette camera: its meshes' bounds in the world, once)
  const sizeOf = (obj) => {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], v = new Vector3();
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld);
        for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], v.getComponent(k))), (hi[k] = Math.max(hi[k], v.getComponent(k)));
      }
    });
    return { h: hi[1] - lo[1], w: Math.max(hi[0] - lo[0], hi[2] - lo[2]) };
  };
  // (their sun shadows off where the projected one is on: two shadows each in the garden otherwise — once for each model, and
  // again when one's tree changes, a weapon equipped: shadow3d.js watchTree; it walked all three every frame)
  const noSun = (obj) => obj?.traverse((m) => m.isMesh && (m.castShadow = false));
  const noSunFor = { hero: null, cape: null, boss: null, gen: -1 };
  const overlay = makeOverlay(canvasEl);
  const lerp = makeLerp3D();
  const leap = makeLeap();
  const parts = makeParticles(99);
  const partMesh = makeParticleMesh();

  const scene = new Scene();
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 1, 3000);
  let camera = ortho; // (an arena drawn through its image's own camera swaps in `pcam`: ensureArena, refFrame)
  const pcam = new PerspectiveCamera(66, 1, 5, 4000);
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
  let mood = MOODS[debug.mood] || null; // (an arena with its own look sets one too: ensureArena)
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
  let arenaHasBackdrop = false; // (set by ensureArena: a pre-rendered arena hides the garden, through every re-planting)
  let gardenStale = false; // (a tier dropped while it was hidden: planted for the new tier when it shows again)
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
    // (the bench's ?garden=0, to measure what it costs; and never under a pre-rendered arena — a tier drop at the end of
    // the name card re-planted it visible, and the meadow showed through Sister Cinder's Ash Floor: the owner, 2026-10-12)
    garden.group.visible = debug.garden !== 0 && !arenaHasBackdrop;
  }
  plantGarden();
  const fader = makeFader(garden.fadeGroups); // the groups are the layout's, the same at every tier
  // The lanterns lit: on Low only those nearest the fight, a change of set cross-fading over 0.3 s.
  const lantOn = new Float32Array(8).fill(1);
  let lampD = new Float64Array(8); // (each lamp's distance from the camera's aim, this frame)
  // Lights are picked by layer too: without these the fade layer would be drawn unlit (black).
  lights.sun.layers.enable(2);
  lights.sky.layers.enable(2);
  // Pollen over the lawn, petals from the two blossom trees (4.12).
  const blossom = gardenLayout(1).trees.filter((t) => t.id === "T0" || t.id === "T1").map((t) => t.canopy);
  const life = makeLife3D(look, { trees: blossom, wind, rand: rng(29), painted: !!paint?.atlas }); // painted: the picked petals' colours (M4b)
  scene.add(life.mesh, life.glow);

  // --- a pre-rendered arena (backdrop3d.js) in place of the garden, for a fight whose arena has one (the Ash Floor) -----
  // Its own light is in the picture; its mood lights the characters to match, its fires are their lanterns.
  let backdrop = null;
  let backdropFx = null;
  let refBd = null;
  // (the edit mode's own view, ui/mapedit.js: { cx, cy, h } in the image's pixels — the crop's middle and height — or null)
  let editView = null;
  let heroSnap = false; // (the edit mode moved him: hero3d.js plants his feet afresh)
  let refFlames = null; // (the image camera's live fires and candles, in place of its painted ones)
  let refBell = null; // (the image camera's painted bell, cut out to swing when struck: the Bog Shrine's)
  let refAnswer = null; // (and the one that answers it: the Drowned Hall's big bell, case "bellAnswer")
  let bogLife = null; // (the Bog Shrine's splashes, ripples, birds, frogs and dragonflies: boglife3d.js)
  let geysers = null; // (the Drowned King's water columns out of the Drowned Hall's grates: geyser3d.js)
  const REF_FIT = Number(debug.reffit) || 0.8;
  const refFull = new Matrix4();
  const refV = new Vector3();
  const heroPx = [0, 0, 0]; // (the hero in the picture for refBd.setHeroZ: his chest and how far round him, image px)
  /**
   * The image camera's frame: a crop of the image that follows the 2D camera (its focus at the middle of the safe rectangle,
   * as wide as its zoom shows — at the widest pull-back the whole image, so the fairness rule still holds), drawn through
   * pcam with a view offset, and the 2D camera's toBuffer pointed at it (damage numbers, the mouse's aim).
   */
  let refEase = null; // (the crop's springs: its height and middle and their speeds, and the screen and image it was for)
  // (a critically damped spring towards `want` over about T seconds: a move starts from rest and settles without overshoot)
  const spring = (cur, v, want, T, dt) => {
    const o = 2 / T, x = o * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const c = cur - want, t = (v + o * c) * dt;
    return [want + (c + t) * e, (v - o * t) * e];
  };
  // (this frame's scratch, kept: refFrame and campFrame made some thirty small arrays a frame, a closure for cam.proj, a copy
  // of every flood's shallows to sort and four arrays to fit; the same numbers come out)
  const IMG = [0, 0], IMG2 = [0, 0];
  let needX = new Float64Array(64), needY = new Float64Array(64), needN = 0;
  const needAdd = (q) => {
    if (needN === needX.length) {
      const nx = new Float64Array(needN * 2), ny = new Float64Array(needN * 2);
      nx.set(needX), ny.set(needY);
      (needX = nx), (needY = ny);
    }
    (needX[needN] = q[0]), (needY[needN] = q[1]), needN++;
  };
  const fitB = { nx0: 0, nx1: 0, ny0: 0, ny1: 0, h: 0 };
  const recvRef = { tex: null, range: null, rect: [0, 0, 0, 0], near: null, cover: 0, feetY: undefined };
  const projAt = { W: 1, H: 1, k: 1 };
  const projGround = (wx, wy) => {
    refV.set(wx, floorAt(wx, wy), wy).applyMatrix4(pcam.matrixWorldInverse).applyMatrix4(pcam.projectionMatrix); // (on the ground there: the altar is 14.5 up)
    return [((refV.x + 1) / 2) * projAt.W * projAt.k, ((1 - refV.y) / 2) * projAt.H * projAt.k];
  };
  function refFrame(cam, f, vw, vh, wd, dt) {
    const r = refBd.ref;
    const IW = r.image.w, IH = r.image.h;
    // (what the 2D camera frames — its safe rectangle's corners on the ground — projected into the image: the crop holds all
    // of it, so whatever the 2D camera must show, this shows too)
    const toImg = (out, gx, gy, up = 0) => {
      refV.set(gx, floorAt(gx, gy) + up, gy).applyMatrix4(pcam.matrixWorldInverse).applyMatrix4(refFull);
      (out[0] = ((refV.x + 1) / 2) * IW), (out[1] = ((1 - refV.y) / 2) * IH);
      return out;
    };
    const [sx, sy, sw, sh] = cam.safe();
    const z = cam.zoom * (1 + (cam.punch || 0));
    const scX = (bx) => cam.x - 0.5 * cam.shakeX + (bx - (sx + sw / 2)) / z, scY = (by) => cam.y - 0.5 * cam.shakeY + (by - (sy + sh / 2)) / z;
    let ax = Infinity, ay = Infinity, bx_ = -Infinity, by_ = -Infinity;
    for (let c = 0; c < 5; c++) {
      const px = c === 4 ? sx + sw / 2 : c & 1 ? sx + sw : sx, py = c === 4 ? sy + sh / 2 : c & 2 ? sy + sh : sy;
      const g = isoToWorld(scX(px), scY(py));
      const [ix, iy] = toImg(IMG, g[0], g[1]);
      ax = Math.min(ax, ix); ay = Math.min(ay, iy); bx_ = Math.max(bx_, ix); by_ = Math.max(by_, iy);
    }
    const shrink = REF_FIT; // (the iso view's rectangle spans more ground than the fight needs: its corners are mostly margin)
    let h = Math.max((by_ - ay) * shrink, (((bx_ - ax) * shrink) * vh) / vw, IH * 0.45);
    if (h > IH) h = IH;
    let w = (h * vw) / vh;
    if (w > IW) (w = IW), (h = (w * vh) / vw);
    const gm = isoToWorld(scX(sx + sw / 2), scY(sy + sh / 2));
    const [fx, fy] = toImg(IMG, gm[0], gm[1]);
    let x0 = fx - ((sx + sw / 2) / vw) * w, y0 = fy - ((sy + sh / 2) / vh) * h;
    // The fairness rule, kept whatever the shrink — the 2D camera's own (gfx/camera.js follow): the hero and the boss whole,
    // and every telegraph that can reach the hero (within 70 of him) by its origin if that is on the floor and the ground
    // round him. (Holding every telegraph the 2D view could see pulled a landscape screen out to the whole image and past
    // it — the owner, 2026-10-12: "the camera autozoom seems like it has started to glitch".)
    needN = 0;
    if (wd) {
      const p = wd.player;
      needAdd(toImg(IMG, p.x, p.y));
      needAdd(toImg(IMG, p.x, p.y, 28));
      let threat = false;
      for (const hz of wd.hazards) {
        if (hz.friendly || phaseOf(hz) === "fade" || !shown(hz)) continue;
        if (hz.safe) {
          // (a flood: where it does not reach — its nearest shallow)
          let best = null, bd2 = Infinity;
          for (const m of hz.safe) {
            const d = Math.hypot(m[0] - p.x, m[1] - p.y);
            if (d < bd2) (bd2 = d), (best = m);
          }
          needAdd(best ? toImg(IMG, best[0], best[1]) : toImg(IMG, p.x, p.y));
          continue;
        }
        if (!hits(hz, p.x, p.y, 70)) continue;
        threat = true;
        if (floorShape.out(hz.x, hz.y) < 10) needAdd(toImg(IMG, hz.x, hz.y));
      }
      if (threat) for (let k = 0; k < 8; k++) needAdd(toImg(IMG, p.x + Math.cos((k * Math.PI) / 4) * 30, p.y + Math.sin((k * Math.PI) / 4) * 30));
    }
    // (the boss too, when the frame can hold it no wider than the image: a landscape screen is wider than the portrait image
    // for its height, so with her up at the altar and the hero down on the lower terrace it would have to show empty fog
    // beside the image — then the hero and what can reach him come first)
    // (during his leap in from outside the arena, where he will land: the frame holds still and he flies into it — framed
    // on his take-off point it swung off the floor and back, 2026-10-15)
    const entering = wd?.boss?.move?.id === "entrance" && wd.boss.jumpTo;
    const bAtX = entering ? wd.boss.jumpTo[0] : wd?.boss?.x, bAtY = entering ? wd.boss.jumpTo[1] : wd?.boss?.y;
    const wantN = wd?.boss && !wd.boss.hidden ? 2 : 0;
    const needOnly = needN;
    if (wantN) {
      needAdd(toImg(IMG, bAtX, bAtY));
      needAdd(toImg(IMG, bAtX, bAtY, (wd.boss.hitH || 40) + 6));
    }
    if (needOnly && debug.reffair !== 0) {
      // (inside the safe rectangle — clear of the HUD and the touch buttons — with a margin)
      const M = 0.05; // (of the frame's height, at each edge)
      const fx0 = sx / vw, fx1 = (sx + sw) / vw, fy0 = sy / vh, fy1 = (sy + sh) / vh;
      const mx = (M * vh) / vw; // (the same margin as a share of the width)
      const hMax = Math.min(IH, (IW * vh) / vw);
      // (the first n points: the hero's needs, with the boss's two after them)
      const fit = (n) => {
        let nx0 = Infinity, nx1 = -Infinity, ny0 = Infinity, ny1 = -Infinity;
        for (let i = 0; i < n; i++) (nx0 = Math.min(nx0, needX[i])), (nx1 = Math.max(nx1, needX[i])), (ny0 = Math.min(ny0, needY[i])), (ny1 = Math.max(ny1, needY[i]));
        (fitB.nx0 = nx0), (fitB.nx1 = nx1), (fitB.ny0 = ny0), (fitB.ny1 = ny1);
        fitB.h = Math.max(h, (ny1 - ny0) / (fy1 - fy0 - 2 * M), (((nx1 - nx0) / (fx1 - fx0 - 2 * mx)) * vh) / vw);
        return fitB;
      };
      let b = fit(needOnly + wantN);
      if (b.h > hMax) b = fit(needOnly);
      const h2 = Math.min(hMax, b.h);
      if (h2 > h) {
        x0 += (w - (h2 * vw) / vh) / 2;
        y0 += (h - h2) / 2;
        h = h2;
        w = (h * vw) / vh;
      }
      x0 = Math.min(x0, b.nx0 - (fx0 + mx) * w), y0 = Math.min(y0, b.ny0 - (fy0 + M) * h);
      x0 = Math.max(x0, b.nx1 - (fx1 - mx) * w), y0 = Math.max(y0, b.ny1 - (fy1 - M) * h);
    }
    // (never with the hero low on the screen while the picture goes on below him: on a wide screen walking down the clearing
    // he ended at the bottom edge and what lies past the clearing's front was never seen — the owner, 2026-10-15: "the camera
    // tends to have the hero at the bottom of the camera so that we cannot see slightly below the arena". His feet held at
    // most 62% down the frame, as far as the picture reaches; fairness kept — the crop only moves down toward him)
    if (wd && !editView) {
      const feet = toImg(IMG, wd.player.x, wd.player.y);
      const lim = y0 + h * 0.62;
      if (feet[1] > lim) y0 = Math.min(y0 + (feet[1] - lim), Math.max(y0, IH - h));
    }
    // Eased, as the 2D camera eases its zoom: out fast (well inside the shortest wind-up, so a telegraph is on screen before
    // it goes live), back in slowly (the owner, 2026-10-12: "the camera
    // autozoom seems like it has started to glitch" — on a landscape screen the crop snapped by up to 234 image pixels in one
    // frame as the fairness rule above widened it past the image and let it go).
    const snap = !refEase || refEase.vw !== vw || refEase.vh !== vh || refEase.bd !== refBd;
    const cx = x0 + w / 2, cy = y0 + h / 2;
    if (snap) refEase = { h, cx, cy, vh_: 0, vx: 0, vy: 0, vw, vh, bd: refBd };
    else {
      // (a critically damped spring for each — the zoom, the middle's x and y — so a move starts from rest and settles
      // without overshoot: an exponential ease jumped to full speed in one frame, 23 image pixels; out in about 0.15 s,
      // back in over about 0.8 s, the pan in about 0.3 s)
      [refEase.h, refEase.vh_] = spring(refEase.h, refEase.vh_, h, h > refEase.h ? 0.07 : 0.4, dt);
      [refEase.cx, refEase.vx] = spring(refEase.cx, refEase.vx, cx, h > refEase.h ? 0.07 : 0.15, dt);
      [refEase.cy, refEase.vy] = spring(refEase.cy, refEase.vy, cy, h > refEase.h ? 0.07 : 0.15, dt);
      h = refEase.h;
      w = (h * vw) / vh;
      x0 = refEase.cx - w / 2;
      y0 = refEase.cy - h / 2;
    }
    if (editView) {
      // (the edit mode: wherever the owner pans and zooms, past the image's edges too)
      h = editView.h;
      w = (h * vw) / vh;
      x0 = editView.cx - w / 2;
      y0 = editView.cy - h / 2;
      refEase = null;
    } else {
      x0 = w >= IW ? (IW - w) / 2 : Math.max(0, Math.min(IW - w, x0));
      y0 = h >= IH ? (IH - h) / 2 : Math.max(0, Math.min(IH - h, y0));
    }
    if (wd) {
      // (the hero's planar depth: the edit mode's tint shows what is nearer than he is)
      refV.set(wd.player.x, floorAt(wd.player.x, wd.player.y) + HERO_H * 0.5, wd.player.y).applyMatrix4(pcam.matrixWorldInverse);
      // (and where he is in the picture: round him the camp's one truth decides — his chest, as far as his sword reaches)
      const zMid = -refV.z; // (read before toImg reuses refV)
      const px = wd.player.x, py = wd.player.y;
      const [lx, ly] = toImg(IMG, px, py, 0), [hx, hy] = toImg(IMG2, px, py, HERO_H);
      const span = Math.hypot(hx - lx, hy - ly);
      toImg(IMG, px, py, HERO_H * 0.7);
      heroPx[0] = IMG[0], heroPx[1] = IMG[1], heroPx[2] = span * 0.48 * 3;
      refBd.setHeroZ?.(zMid, heroPx);
      // (the objects the owner gave a line: in front of him or behind him by where he stands — campCover)
      refV.set(px, floorAt(px, py), py).applyMatrix4(pcam.matrixWorldInverse).applyMatrix4(refFull);
      campCover(assets.backdrops?.[backdropFor], px, py, ((refV.x + 1) / 2) * IW);
    }
    const ipt = w / (vw / f.k); // image pixels a texel
    pcam.setViewOffset(IW / ipt, IH / ipt, x0 / ipt, y0 / ipt, f.W, f.H);
    pcam.updateProjectionMatrix();
    refBd.setCrop(x0, y0, ipt * f.W, ipt * f.H, f.W, f.H, pcam.near, pcam.far);
    // (the shadows fall on the picture's own depth, as the camp's do: round the hero the shader above moves it — what does not
    // cover him 12 behind his middle, what does 12 before it — and his shadow, cast on that, missed the ground at his feet
    // altogether; the owner, 2026-10-14: "the shadow on the hero ... is nog visible in the bog". Never on what covers him; the
    // arena's shadow falls down the screen, toward the camera, so no fade before his feet as in the camp)
    if (refBd.depthMap && wd) {
      refV.set(wd.player.x, floorAt(wd.player.x, wd.player.y) + HERO_H * 0.5, wd.player.y).applyMatrix4(pcam.matrixWorldInverse);
      const R = recvRef;
      (R.tex = refBd.depthMap.tex), (R.range = refBd.depthMap.range);
      (R.rect[0] = x0 / IW), (R.rect[1] = y0 / IH), (R.rect[2] = (ipt * f.W) / IW), (R.rect[3] = (ipt * f.H) / IH);
      (R.near = null), (R.cover = -refV.z - 12), (R.feetY = undefined);
      shadows.recv = R;
    } else shadows.recv = null;
    refBd.setTime(lastNow);
    f.offX = f.offY = 0;
    (projAt.W = f.W), (projAt.H = f.H), (projAt.k = f.k);
    cam.proj = projGround;
    camera = pcam;
  }
  /**
   * Camp 2.0 through the camera fitted to its painting (camp3d.js, tools/camp2/camera.py): a crop of the painting kept on the
   * hero, one size wherever he walks, so he is drawn bigger as he comes down the picture and smaller up by the shrine, as
   * the painting's own lanterns, stools and doors are (the owner, 2026-10-12: "it became quite strange when you changed his
   * size depending on where in the image he is. Instead look at arena 2 setup" — the old view scaled him by the row he
   * stood on and zoomed the camera back by as much, so the painting swelled and shrank round him as he walked).
   */
  let campRef = null; // (the image camera's numbers, camp2-view.json "ref", while the camp is up)
  // (how much of the hero the picture hides where he stands, 0..1: camp2-view.json "hide", for his silhouette)
  let campHideGrid = null;
  const campHide = (x, y) => {
    const g = campHideGrid;
    if (!g) return 0;
    const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((y - g.z0) / g.cell);
    return i < 0 || j < 0 || i >= g.nx || j >= g.ny ? 0 : g.q[j * g.nx + i] / 20;
  };
  let campEase = null;
  // His silhouette over what covers him (the owner, 2026-10-13: "now there are no marking that he is behind the tree"): how
  // much of him the cut-out covers — the map's (odepth: a thing's depth and where there is one) with the owner's corrections
  // (the edit layer: masked, cleared) — sampled over his figure in the picture, 7 x 12 points, eased. A post before his legs
  // shows none; a tree, a house or a stall does.
  let campOd = null, campOdFor = null, campSilA = 0;
  // Which of the blue's objects cover him now (the owner, 2026-10-14, choosing option 1 of the baseline proposal: "manually
  // mark where the baseline of an object is ... to let the character be both behind and in front of an object, not all objects
  // are necessary, only the ones i want to be able to select and edit"): an object with a line of his (bd.edit.lines,
  // ui/mapedit.js) covers him only while he stands behind that line; every other object covers him wherever they overlap, as
  // before. Behind: his ground point (the sim's x, y — never his height, a jump or his sword) farther from the camera, along his
  // own way from it, than the line's point in his feet's column of the picture, put on the very ground his feet stand on
  // (floorAt) — on the stairs, terraces and bridges too; past its ends the line carries on level. Within half a unit of it the
  // last answer holds, so standing on a line nothing flickers. One answer per object, switched at once (a fade read as glass):
  // the camp's shader (camp3d.js tFlags), his silhouette (campSil) and the edit mode all read this.
  const coverData = new Uint8Array(256 * 256 * 2); // (object k at texel (k & 255, k >> 8), R: 255 covers, 0 not; G: 255 has a line)
  for (let i = 0; i < coverData.length; i += 2) coverData[i] = 255;
  // (object 0 is no object — a mask's faint fringe the Mask pen gave none: it never covers him. As "covers" it was laid over
  // him even when the stroke's own object stood behind him, a thin outline of it across him — the owner, 2026-10-15: "There
  // seems to be a small outline of the marked area even when the hero is behind it")
  coverData[0] = 0;
  const coverTex = new DataTexture(coverData, 256, 256, RGFormat, UnsignedByteType);
  (coverTex.colorSpace = NoColorSpace), (coverTex.flipY = false), (coverTex.generateMipmaps = false), (coverTex.unpackAlignment = 1);
  coverTex.minFilter = coverTex.magFilter = NearestFilter;
  coverTex.needsUpdate = true;
  const coverOn = new Map(); // (object -> covers, for those with a line)
  let coverFor = null;
  const refInv = new Matrix4(), gA = new Vector3(), gB = new Vector3();
  let refInvFor = null; // (refFull's inverse is for this arena's camera: ensureArena sets it null when refFull changes)
  /** The ground point (sim x, y) seen at image px (ix, iy) of the camp's painting: on the ground he walks on (floorAt). */
  function imgToGround(ix, iy, out = [0, 0]) {
    const r = refBd ? refBd.ref : campRef;
    const nx = (ix / r.image.w) * 2 - 1, ny = 1 - (iy / r.image.h) * 2;
    // (inverted once an arena, not for every object's line every frame: 287 objects on the Bog Shrine, 424 on the Ash Floor)
    if (refInvFor !== r) (refInvFor = r), refInv.copy(refFull).invert();
    gA.set(nx, ny, -1).applyMatrix4(refInv).applyMatrix4(pcam.matrixWorld);
    gB.set(nx, ny, 0.5).applyMatrix4(refInv).applyMatrix4(pcam.matrixWorld);
    const dx = gB.x - gA.x, dy = gB.y - gA.y, dz = gB.z - gA.z;
    let h = 0, x = gA.x, z = gA.z;
    for (let k = 0; k < 6 && Math.abs(dy) > 1e-9; k++) {
      const t = (h - gA.y) / dy;
      x = gA.x + dx * t;
      z = gA.z + dz * t;
      h = floorAt(x, z);
    }
    (out[0] = x), (out[1] = z);
    return out;
  }
  // Each line's ground points, worked out once an arena (campCover): an object's line meets the hero's column of the picture
  // only between its two ends; past them the line carries on level from an end, whose ground point never changes — on the
  // painted arenas, where every object has its guessed line (autoLines), that was 287-424 lines taken to the ground through
  // the inverted camera every frame. A line his column crosses is still worked out where it crosses, each time he moves.
  let coverLines = []; // { id, pts, n, lo, hi, g0: [x, z], g1: [x, z] }
  let coverEdit = false; // (the edit mode was on last frame: the owner may have changed any line)
  const coverAt = [NaN, NaN, NaN], gMid = [0, 0];
  function coverBuild(E) {
    const ids = linedIds(E);
    const keep = new Set();
    coverLines = [];
    for (const key of ids) {
      const id = Number(key), pts = lineOfE(E, id);
      if (!pts?.length || !(id > 0 && id < 65536)) continue;
      keep.add(id);
      const n = pts.length;
      coverLines.push({ id, pts, n, lo: pts[0][0], hi: pts[n - 1][0], g0: imgToGround(pts[0][0], pts[0][1]), g1: imgToGround(pts[n - 1][0], pts[n - 1][1]) });
    }
    // (an object whose line went: covers wherever it overlaps him again)
    let changed = false;
    for (const id of [...coverOn.keys()])
      if (!keep.has(id)) {
        coverOn.delete(id);
        if (coverData[id * 2] !== 255 || coverData[id * 2 + 1] !== 0) (coverData[id * 2] = 255), (coverData[id * 2 + 1] = 0), (changed = true);
      }
    return changed;
  }
  /** How far (units) the ground point (hx, hy), seen in image column `col`, stands behind a line (image px, left to right). */
  function lineGap(L, hx, hy, col) {
    const { pts, n } = L;
    let g = L.g0;
    if (n > 1 && col >= L.hi) g = L.g1;
    else if (n > 1 && col > L.lo)
      for (let k = 1; k < n; k++)
        if (col <= pts[k][0]) {
          const a = pts[k - 1], b = pts[k], t = (col - a[0]) / Math.max(1e-6, b[0] - a[0]);
          g = imgToGround(col, a[1] + (b[1] - a[1]) * t, gMid);
          break;
        }
    const [gx, gz] = g;
    const cx = pcam.position.x, cz = pcam.position.z, dx = hx - cx, dz = hy - cz, D = Math.hypot(dx, dz) || 1;
    return D - ((gx - cx) * dx + (gz - cz) * dz) / D;
  }
  function campCover(bd, hx, hy, col) {
    const E = bd?.edit;
    if (!E?.pidTex) return;
    let changed = false, fresh = false;
    if (coverFor !== E) {
      coverFor = E;
      coverOn.clear();
      for (let i = 0; i < coverData.length; i += 2) (coverData[i] = 255), (coverData[i + 1] = 0);
      coverData[0] = 0; // (no object: never covers)
      coverTex.needsUpdate = true;
      (refBd || backdrop)?.setPieces?.(E.pidTex, coverTex, E.w, E.h);
      fresh = true;
    }
    // (the lines again: a new arena, and every frame of the edit mode and the one after it — the owner draws and drags them)
    if (fresh || editView || coverEdit) (changed = coverBuild(E)), (fresh = true);
    coverEdit = !!editView;
    // (and the answers only when he has moved, or the lines did)
    if (!fresh && hx === coverAt[0] && hy === coverAt[1] && col === coverAt[2]) return;
    (coverAt[0] = hx), (coverAt[1] = hy), (coverAt[2] = col);
    for (const L of coverLines) {
      const id = L.id;
      const g = lineGap(L, hx, hy, col), was = coverOn.get(id);
      const on = was === undefined ? g > 0 : was ? g > -0.5 : g > 0.5;
      coverOn.set(id, on);
      const v = on ? 255 : 0;
      if (coverData[id * 2] !== v) (coverData[id * 2] = v), (changed = true);
      if (coverData[id * 2 + 1] !== 255) (coverData[id * 2 + 1] = 255), (changed = true); // (G: it has a line)
    }
    if (changed) coverTex.needsUpdate = true;
  }
  function campSil(lo, hi, hz, dt) {
    const bd = assets.backdrops?.[backdropFor];
    if (!bd?.odepth?.image) return 0;
    if (campOdFor !== bd) {
      campOdFor = bd;
      campOd = bd.odepthPx || null;
      // (read back once a page and kept on the backdrop — its 2068 x 2538 pixels were drawn to a canvas and read back at
      // every visit to the camp; until then, as before, no silhouette)
      if (!campOd && !bd.odepthPxLoading) {
        const img = bd.odepth.image;
        bd.odepthPxLoading = createImageBitmap(img, { colorSpaceConversion: "none", premultiplyAlpha: "none" }).then((bmp) => {
          const c = document.createElement("canvas");
          c.width = bmp.width;
          c.height = bmp.height;
          const g = c.getContext("2d", { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          bd.odepthPx = { w: bmp.width, h: bmp.height, px: g.getImageData(0, 0, bmp.width, bmp.height).data };
          bmp.close?.();
        }, () => {});
      }
    }
    if (!campOd && bd.odepthPx) campOd = bd.odepthPx;
    if (!campOd) return 0;
    const { w: W, h: H, px } = campOd, IW = campRef.image.w, IH = campRef.image.h;
    const E = bd.edit && bd.edit.w === W && bd.edit.h === H ? bd.edit : null;
    const ht = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]);
    let n = 0, cov = 0;
    for (let j = 0; j < 12; j++)
      for (let i = 0; i < 7; i++) {
        const t = (j + 0.5) / 12, u = (i / 6 - 0.5) * 0.3;
        const x = Math.round(((lo[0] + (hi[0] - lo[0]) * t) + u * ht) * (W / IW)), y = Math.round((lo[1] + (hi[1] - lo[1]) * t) * (H / IH));
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = y * W + x;
        n++;
        if (E && E.rem[k] > 127) continue;
        // (the one truth: masked — the map's cut-out (odepth's B marks it) or his own Mask — covers him; no depth)
        // (and only where its object covers him now: an object he stands in front of is no cover — campCover)
        if (((E && E.add[k] > 127) || px[k * 4 + 2] > 127) && (!E?.pid || coverData[E.pid[k] * 2] > 127)) cov++;
      }
    // (from 55% of him covered, full from 80%: behind a tree 83%, a post and its rail across him 69%, a post before his
    // legs 42% — a quarter showed a teal block the shape of every post)
    const want = n ? 0.5 * Math.min(1, Math.max(0, (cov / n - 0.55) / 0.25)) : 0;
    // (eased as he walks; in the edit mode, where the clock stands still, at once: the test hero shows the answer as dragged)
    campSilA = editView ? want : campSilA + (want - campSilA) * Math.min(1, dt / 0.15);
    return campSilA < 0.01 ? 0 : campSilA;
  }
  const campM = [0, 0], campLo = [0, 0], campHi = [0, 0];
  function campFrame(cam, f, vw, vh, wd, dt) {
    const IW = campRef.image.w, IH = campRef.image.h;
    const toImg = (out, gx, gy, up = 0) => {
      refV.set(gx, floorAt(gx, gy) + up, gy).applyMatrix4(pcam.matrixWorldInverse).applyMatrix4(refFull);
      (out[0] = ((refV.x + 1) / 2) * IW), (out[1] = ((1 - refV.y) / 2) * IH);
      return out;
    };
    // (its size: the hero a seventh of the screen's height on an upright phone, a sixth on a wide screen, where he stands in
    // the square's middle — the fight's framing, narrowed by a phone's width, left him a thirteenth: the owner had said "the
    // character is a bit too small"; never wider or taller than the painting)
    const a = toImg(IMG, 0, 0), b = toImg(IMG2, 0, 0, HERO_H);
    let h = Math.min(IH, (IW * vh) / vw, Math.hypot(a[0] - b[0], a[1] - b[1]) * (vw < vh ? 7 : 6));
    let w = (h * vw) / vh;
    // (his middle at the middle of the safe rectangle, as the 2D camera puts him; held inside the painting)
    const [sx, sy, sw, sh] = cam.safe();
    const p = wd.player;
    const [hx, hy] = toImg(IMG, p.x, p.y, HERO_H * 0.5);
    const wx = Math.max(0, Math.min(IW - w, hx - ((sx + sw / 2) / vw) * w)), wy = Math.max(0, Math.min(IH - h, hy - ((sy + sh / 2) / vh) * h));
    // (eased as the Ash Floor's crop pans, about 0.15 s; snapped on a new screen or a jump of a quarter of it — the checks'
    // and films' hero put down somewhere new)
    if (!campEase || campEase.vw !== vw || campEase.vh !== vh || Math.abs(wx - campEase.x) > w / 4 || Math.abs(wy - campEase.y) > h / 4) campEase = { x: wx, y: wy, vx: 0, vy: 0, vw, vh };
    else {
      [campEase.x, campEase.vx] = spring(campEase.x, campEase.vx, wx, 0.15, dt);
      [campEase.y, campEase.vy] = spring(campEase.y, campEase.vy, wy, 0.15, dt);
    }
    let x0 = Math.max(0, Math.min(IW - w, campEase.x)), y0 = Math.max(0, Math.min(IH - h, campEase.y));
    if (editView) {
      // (the edit mode: wherever the owner pans and zooms)
      h = editView.h;
      w = (h * vw) / vh;
      x0 = editView.cx - w / 2;
      y0 = editView.cy - h / 2;
    }
    const cr = (campEase.crop ||= { x0: 0, y0: 0, w: 0, h: 0 });
    (cr.x0 = x0), (cr.y0 = y0), (cr.w = w), (cr.h = h);
    // (where he is, for the crowns that open round him: his middle and his height in the picture, his planar depth)
    if (backdrop?.setHero) {
      const hp = wd.player;
      // (round his chest, 0.62 of his height, and 0.6 of it tall: open from his knees over his head — a bush or a drift of
      // petals before his shins stays, as games keep low foliage; round his middle and 1.05 of him it opened down past his
      // feet and showed the bare map in a pale patch there)
      // (0.7 of his height, 0.48 of it tall: open from his thighs up, the rim fading over his knees — a curve, not a line;
      // blossom before his shins stays)
      const m = toImg(campM, hp.x, hp.y, HERO_H * 0.7), lo = toImg(campLo, hp.x, hp.y, 0), hi = toImg(campHi, hp.x, hp.y, HERO_H);
      campCover(assets.backdrops?.[backdropFor], hp.x, hp.y, lo[0]);
      refV.set(hp.x, floorAt(hp.x, hp.y) + HERO_H * 0.5, hp.y).applyMatrix4(pcam.matrixWorldInverse);
      // (no see-through: behind a house, a lantern or a cloth he is hidden, as the owner asked — "If walking behind e.g a
      // building it should ofc still hide him"; a translucent overlay read as a lantern made of glass)
      backdrop.setHero(m[0], m[1], Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) * 0.48, -refV.z, campSil(lo, hi, -refV.z, dt));
      fig.uFigZ.value = refV.z; // (view space: his middle, for figWrap)
      // (his materials wrapped once — again only when his tree changes, a weapon equipped: shadow3d.js watchTree)
      const ho = heroModel?.object || null, cm = heroModel?.cape?.mesh || null;
      if (figFor.hero !== ho || figFor.cape !== cm || figFor.gen !== treeGeneration()) {
        watchTree(ho);
        watchTree(cm);
        figTag(ho);
        figTag(cm);
        (figFor.hero = ho), (figFor.cape = cm), (figFor.gen = treeGeneration());
      }
    }
    const ipt = w / (vw / f.k); // image pixels a texel
    pcam.setViewOffset(IW / ipt, IH / ipt, x0 / ipt, y0 / ipt, f.W, f.H);
    pcam.updateProjectionMatrix();
    // (his shadow falls on the painting's own depth, not on the one camp3d.js writes round him — shadow3d.js; never on what
    // covers him, nor on anything nearer the camera than his feet)
    if (backdrop?.depthMap) {
      const hp = wd.player;
      refV.set(hp.x, floorAt(hp.x, hp.y), hp.y).applyMatrix4(pcam.matrixWorldInverse);
      const feetZ = -refV.z;
      refV.set(hp.x, floorAt(hp.x, hp.y) + HERO_H * 0.5, hp.y).applyMatrix4(pcam.matrixWorldInverse);
      const R = recvRef;
      (R.tex = backdrop.depthMap.tex), (R.range = backdrop.depthMap.range);
      (R.rect[0] = x0 / IW), (R.rect[1] = y0 / IH), (R.rect[2] = (f.W * ipt) / IW), (R.rect[3] = (f.H * ipt) / IH);
      (R.near = feetZ), (R.cover = -refV.z + 10), (R.feetY = floorAt(hp.x, hp.y));
      shadows.recv = R;
    } else shadows.recv = null;
    f.offX = f.offY = 0;
    (projAt.W = f.W), (projAt.H = f.H), (projAt.k = f.k);
    cam.proj = projGround;
    camera = pcam;
  }
  let backdropFor = null;
  const CAMP_SHADOW_ROT = 170;
  let campShadowWas = null; // (the shadow's direction before Camp 2.0 set its own: back on leaving)
  let floorShape = { R: ARENA.R, out: (x, y) => Math.hypot(x, y) - ARENA.R }; // (the fight's floor, sim/arena.js: set by ensureArena)
  let emberT = 0;
  const emberRand = rng(71); // (the renderer's own randomness, never Math.random)
  const tongueOut = (x, y) => floorShape.out(x, y);
  let arenaKnown = false; // (ensureArena has run: whether the garden shows is known — ready)
  function ensureArena(w) {
    const id = w.spec?.arena;
    if (w.arena) floorShape = w.arena;
    tongueFloor.out = tongueOut;
    if (arenaKnown && backdropFor === id) return;
    arenaKnown = true;
    backdropFor = id;
    if (backdrop) {
      scene.remove(backdrop.main, backdrop.glow, ...backdropFx.objects);
      backdrop.dispose();
      backdropFx.dispose();
      backdrop = backdropFx = null;
    }
    if (refBd) {
      scene.remove(refBd.main, refBd.glow);
      refBd.dispose();
      refBd = null;
    }
    if (refFlames) {
      scene.remove(...refFlames.objects);
      refFlames.dispose();
      refFlames = null;
    }
    if (refBell) {
      scene.remove(refBell.mesh);
      refBell.dispose();
      refBell = null;
    }
    if (refAnswer) {
      scene.remove(refAnswer.mesh);
      refAnswer.dispose();
      refAnswer = null;
    }
    if (bogLife) {
      scene.remove(...bogLife.objects);
      bogLife.dispose();
      bogLife = null;
    }
    if (geysers) {
      scene.remove(...geysers.objects);
      geysers.dispose();
      geysers = null;
    }
    VIEW.ky = KY;
    setFloorHeights(null);
    marks.setFloor(null);
    campRef = campEase = campHideGrid = null;
    coverFor = null; // (a new backdrop: it is handed the objects again, campCover)
    if (campShadowWas != null) (shadows.params.rotation = campShadowWas), (campShadowWas = null);
    const bd = assets.backdrops?.[id];
    arenaHasBackdrop = !!bd;
    if (!bd && gardenStale) (gardenStale = false), plantGarden();
    garden.group.visible = !bd && debug.garden !== 0;
    if (garden.group.visible && gardenTexPending) uploadGardenTex();
    editView = null;
    life.mesh.visible = life.glow.visible = !bd;
    // (the sun's shadow map: under a pre-rendered arena with the projected shadows on, nothing it holds is seen — the
    // characters cast none into it (noSun), the picture takes none (backdrop3d.js / camp3d.js are unlit), and only the chest,
    // the tongue, the flies and the bell were left in it, to darken the characters' paint now and then where it fell on them.
    // Off there: no shadow pass a frame, no map. Set before the first shaders are built (ready waits for the first frame)
    sun.castShadow = !(bd && shadows.params.on);
    if (!bd) return;
    // The image camera (the owner, 2026-10-12, a /goal: "it should look exactly like in the image"): the arena is the
    // image itself, drawn through the camera fitted to it, so every frame is a piece of the image. The pre-rendered 30°
    // picture is the fallback (the bench's &refcam=0, or an image that did not load), fetched only then (backdrop3d.js).
    const useRef = !!(bd.meta.ref && bd.refImage && debug.refcam !== 0);
    // (Camp 2.0's village, camp3d.js: the owner's painting drawn in the game's own view, its own floor — sim/arena.js)
    backdrop = bd.camp ? makeCampBackdrop(bd) : makeBackdrop(bd, { fallback: !useRef });
    if (bd.camp && bd.edit) backdrop.setEdit(bd.edit.cov, bd.edit.depTex);
    backdropFx = bd.camp ? makeCampFx(bd) : makeBackdropFx(bd);
    scene.add(backdrop.main, backdrop.glow, ...backdropFx.objects);
    if (bd.camp && bd.meta.view) {
      // Camp 2.0's image camera (camp2-view.json, tools/camp2/camera.py: fitted to the painting's own lines, 1.0 px rms;
      // scaled by its stools, tables and doors) and its ground's heights (levels.py: the shrine's yard 20 up, the courtyard
      // 10 down, the lower path 24 down, the flights between and the bridges' arches — floorh3d.js lifts whatever stands
      // there, as on the Ash Floor's stairs)
      const r = (campRef = bd.meta.view.ref);
      pcam.fov = r.vfov;
      pcam.aspect = r.image.w / r.image.h;
      // (the near plane just short of the nearest of the painting (camp2-view.json depth.z0, 832): at 5 the depth buffer
      // spent nearly all its steps on empty air, one step was 0.014 units at the hero, and his figure, pressed to 6% of its
      // depth (figWrap), had belt over tunic and arm over chest a step or two apart — small patches of him flashed black as
      // they swapped (the owner, 2026-10-13: "the hero is still flashing black in some small areas here and there"))
      pcam.near = Math.max(5, Math.min(400, (bd.meta.view.depth?.z0 ?? 0) * 0.5));
      pcam.far = 4000;
      pcam.position.set(...r.pos);
      pcam.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...r.right), new Vector3(...r.up), new Vector3(...r.back)));
      pcam.updateMatrixWorld(true);
      pcam.clearViewOffset();
      pcam.updateProjectionMatrix();
      refFull.copy(pcam.projectionMatrix);
      refInvFor = null;
      setFloorHeights(bd.meta.view.walk);
      // (its markings' sheet on the ground's heights: laid before them, it lay flat at 0 under the camp's terraces)
      marks.setFloor(w.arena?.poly ? w.arena : null);
      const hd = bd.meta.view.hide;
      campHideGrid = hd ? { ...hd, q: new Uint8Array(hd.nx * hd.ny) } : null;
      if (hd) hd.rows.forEach((r, j) => { for (let k = 0; k < r.length; k += 3) campHideGrid.q.fill(r[k + 2], j * hd.nx + r[k], j * hd.nx + r[k] + r[k + 1]); });
      // (the stick: 27 degrees down, a step away shows on screen about 0.45 as tall as a step across)
      VIEW.ky = Math.abs(r.back[1]);
      // (his shadow the way the painting's fall: its light comes from the right and the camera's side — the cherry tree's
      // crown lit on its right, its shadow on the grass to its left and a little up; the owner, 2026-10-14: "the background
      // image seems to cast the shadow north west ish". 170: left and a little up the screen (45 is straight down, 135 left,
      // 225 up). The fights keep theirs; the bench's &shrot= still wins)
      if (debug.shrot == null) (campShadowWas = shadows.params.rotation), (shadows.params.rotation = CAMP_SHADOW_ROT);
    } else if (bd.camp) marks.setFloor(w.arena?.poly ? w.arena : null);
    if (useRef) {
      refBd = makeRefBackdrop(bd);
      scene.add(refBd.main, refBd.glow);
      if (bd.edit) refBd.setEdit(bd.edit.cov, bd.edit.depTex);
      refFlames = makeRefFlames(bd);
      if (refFlames) scene.add(...refFlames.objects);
      refBell = makeRefBell(bd);
      if (refBell) scene.add(refBell.mesh);
      refAnswer = makeRefBell(bd, "answer");
      if (refAnswer) scene.add(refAnswer.mesh);
      if (debug.life !== 0) bogLife = makeBogLife(bd, { burst: (x, y, n, o) => parts.burst(x, y, n, o) });
      if (bogLife) scene.add(...bogLife.objects);
      // (an arena with drain grates — the Drowned Hall's, its sim shape's grates — gets the King's geysers drawn)
      if (w.arena?.grates) {
        geysers = makeGeysers(bd, { burst: (x, y, n, o) => parts.burst(x, y, n, o) });
        scene.add(...geysers.objects);
      }
      globalThis.__bogLife = bogLife; // (read only, for the checks; cleared by destroy)
      // (its ground's height: the stairs up to the altar, which the fight can climb — sim/arena.js, floorh3d.js)
      setFloorHeights(bd.meta.walk);
      marks.setFloor(w.arena?.poly ? w.arena : null);
      backdrop.main.visible = backdrop.glow.visible = false;
      for (const o of backdropFx.objects.slice(0, -2)) o.visible = false; // (its painted flames and fog are in the image; the live embers stay)
      const r = bd.meta.ref;
      pcam.fov = r.vfov;
      pcam.aspect = r.image.w / r.image.h;
      // (the near plane just short of the image's nearest (ash.json ref.depth d0 x u, 237 units): see the camp's above)
      pcam.near = Math.max(5, Math.min(100, r.depth.d0 * r.depth.u * 0.4));
      pcam.far = 4000;
      pcam.position.set(...r.pos);
      pcam.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...r.right), new Vector3(...r.up), new Vector3(...r.back)));
      pcam.updateMatrixWorld(true);
      pcam.clearViewOffset();
      pcam.updateProjectionMatrix();
      refFull.copy(pcam.projectionMatrix);
      refInvFor = null;
      // (the stick: a step away from the camera shows on screen about sin(61°) as tall as a step across)
      const el = Math.asin(Math.min(1, Math.abs(r.back[1])));
      VIEW.ky = Math.sin(el);
    }
    if (!mood && MOODS[id]) {
      mood = MOODS[id];
      applyMood(mood, { sun, sky: lights.sky, look, clear: CLEAR });
    }
  }

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
  // His silhouette where something stands in front of him — a house, a stall, a hanging cloth (Camp 2.0; the owner,
  // 2026-10-12: "If walking behind e.g a building it should ofc still hide him"; the way isometric games keep a hidden hero
  // readable): every skinned part drawn once more, before him, on the same bones, only where the picture's depth is nearer
  // than he is (GreaterDepth) by 3 units or more — so the floor at his feet never shows it, a step's riser in front of them
  // does. His cloak's teal through an ordered (4 x 4 Bayer) screen-door — opaque, so no sorting — at up to 45%, on only while
  // a third or more of him is hidden, fully from a half (camp2-view.json "hide", tools/camp2/hidegrid.py), eased in and out.
  // (It was a pale 2 x 2 checker, always on: every post or rail top that hid an ankle showed as a white patch the shape of the
  // post — the owner: "The overlay for some stuff is still not really good"; from a quarter, a post before his shins still
  // lit a teal patch)
  const ghosts = [];
  const ghostA = { value: 0 };
  if (heroModel) {
    // (soft, not a screen-door: an even translucent tint, drawn after him — the 4 x 4 dither read as a pixel pattern laid over
    // every rail and gate in front of him, the owner's "pixel hard edges", 2026-10-13)
    const gm = new MeshBasicMaterial({ color: 0x6fc4bb, depthWrite: false, transparent: true });
    gm.depthFunc = 6; // (GreaterDepth)
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uGhostA = ghostA;
      sh.vertexShader = sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  if (uFigOn < 0.5) { mvPosition.z += 3.0; gl_Position = projectionMatrix * mvPosition; }");
      sh.fragmentShader = sh.fragmentShader.replace(
        "void main() {",
        "uniform float uGhostA;\nvoid main() {",
      ).replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.a = uGhostA;"
      );
    };
    const parts = [];
    heroModel.object.traverse((o) => o.isSkinnedMesh && !o.material?.userData?.outline && parts.push(o));
    for (const o of parts) {
      const g = new SkinnedMesh(o.geometry, gm);
      g.bind(o.skeleton, o.bindMatrix);
      g.position.copy(o.position);
      g.quaternion.copy(o.quaternion);
      g.scale.copy(o.scale);
      g.frustumCulled = false;
      g.renderOrder = -5; // (after the picture, before him: what is in the depth buffer then is only the village)
      g.userData.noShadow = true; // (not in his projected shadow's silhouette, shadow3d.js)
      g.visible = false;
      o.parent.add(g);
      ghosts.push([g, o]);
    }
  }
  // Against a painted backdrop he is sorted as one figure (Camp 2.0; the owner, 2026-10-13: "between the fences right now
  // he is fully hidden, but he should only be hidden behind the actual thing that is in the way", then "the rails does still
  // not working"): the picture's depth is a flat card per thing (a fence's rails on the plane through its foot), and his
  // model is 3D — standing 3.5 units behind a fence, his boots and cloak reached forward past its rails and were drawn over
  // them. Every vertex of his keeps its place on screen, but its depth is pressed towards the depth of his middle, to 6% of
  // its spread: against the picture he is all behind a rail or all in front of it, as painted 2.5D games sort a character by
  // its standing point; within himself, arm before body and cape behind still sort as before. The ghost keeps its 3-unit
  // margin after the pressing. Off everywhere but the camp (uFigOn).
  const fig = { uFigOn: { value: 0 }, uFigZ: { value: 0 } };
  const figWrap = (mat, bias) => {
    if (!mat || mat.userData.fig) return;
    mat.userData.fig = true;
    const before = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
    mat.onBeforeCompile = (sh, r) => {
      before?.call(mat, sh, r);
      sh.uniforms.uFigOn = fig.uFigOn;
      sh.uniforms.uFigZ = fig.uFigZ;
      const at = sh.vertexShader.lastIndexOf("}");
      sh.vertexShader =
        "uniform float uFigOn; uniform float uFigZ;\n" +
        sh.vertexShader.slice(0, at) +
        `  if (uFigOn > 0.5 && projectionMatrix[2][3] < -0.5) {
    float zv = -gl_Position.w;
    float zf = uFigZ + (zv - uFigZ) * 0.06 + ${bias.toFixed(1)};
    gl_Position.z = (projectionMatrix[2][2] * zf + projectionMatrix[3][2]) / -zf * gl_Position.w;
  }
` +
        sh.vertexShader.slice(at);
    };
    mat.customProgramCacheKey = () => `${key ? key() : ""}:fig${bias}`;
    mat.needsUpdate = true;
  };
  const figFor = { hero: null, cape: null, gen: -1 }; // (what figTag last wrapped, campFrame)
  const figTag = (root) =>
    root?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) figWrap(m, ghosts.some(([g]) => g === o) ? 3 : 0);
    });
  for (const [g] of ghosts) figWrap(g.material, 3); // (now: its shader reads uFigOn everywhere)
  // (and the shadow's mask of him: drawn at his true depth it missed the parts of him the one-figure depth had moved, and his
  // shadow fell on what covers him — a dark copy of him over the umbrella; the silhouette cameras are orthographic: untouched)
  figWrap(shadows.silMat, 0);

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
  const tongue = makeTongue(); // (its own wet material, tongue3d.js)
  let tongueBurstH = null; // (the lash whose tip has already slapped down: one burst each)
  let tongueH = null, tongueT0 = 0; // (the lash now out, and the real time it fired)
  let sweepH = null, sweepSide = 1, sweepPrev = null, sweepAngle = null; // (the wide tongue's sweep: its hazard, which way, last angle)
  let croakT = 0, croakRing = 0, holdT = 0; // (the croak's stream and ring, the hold's tremor: their next emission)
  let heroGooT = -1, gooDripT = 0; // (the hero dripping his goo after a hit, until heroGooT)
  const bellTip = new Vector3(); // (the bell's flecks: the blade's tip, case "bell")
  let bellPending = null;
  function bellFlecks(e) {
    let fx = e.x, fy = e.y, fz = 22;
    if (heroModel?.bladeTipWorld) {
      const t = heroModel.bladeTipWorld(bellTip);
      (fx = t.x), (fy = t.z), (fz = Math.max(2, (t.y - floorAt(t.x, t.z)) / H_TO_3D));
    }
    P(fx, fy, 18, { speed: 70, life: 0.7, cols: ["#8a6a34", "#b48a46", "#6e5a2c", "#7d8a52", "#d0aa62"], z: fz, size: (u) => 0.6 + u * 0.8, spread: 6.3, grav: 260, vz: 60, drag: 0.94, kind: "drop" });
    P(fx, fy, 6, { speed: 30, life: 0.9, cols: ["#c9a35c", "#e0c07a"], z: fz + 2, size: 0.6, spread: 6.3, grav: 120, vz: 30, kind: "spark" });
  }
  let snortT = 0; // (his angry snorts, once he rages)

  scene.add(tongue.mesh);
  toadBody.add(belly, cream, ...eyes, sac, mouth);
  // The rigged boss (the placeholder's shapes hide; its tongue and blob stay in use): the fight's own
  // model when one is loaded (boss-profiles.js; load3d.js loads what the fight asks for), else Gnasher's.
  // Made when the world's boss is first drawn: the renderer exists before the fight's world.
  // (Gnasher's is made at once, as before: the model bench reads its clips before the first frame.)
  let bossModel = assets.gnasher ? makeBoss3D(assets.gnasher, look) : null;
  const kingChain = makeKingChain();
  globalThis.__kingChain = kingChain; // (read only, for the checks)
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
    // (the old one freed — its hulls, paint and outline materials, its tongue's mouth (tongue3d.js tongueMouth held the whole
    // model) — not only taken out of the scene; the asset's own geometry and textures stay for the next copy: boss3d.js)
    if (bossModel) bossModel.dispose ? bossModel.dispose() : scene.remove(bossModel.object);
    const asset = want === "gnasher" ? assets.gnasher : assets.bosses[want];
    bossModel = asset ? makeBoss3D(asset, look, BOSS_MODELS[want]) : null;
    bossR = want === "gnasher" ? TOAD_R : BOSS_MODELS[want].radius;
    toadBody.visible = !bossModel;
    if (bossModel) scene.add(bossModel.object);
    // (the King's chain drawn at run time, paid out on his attacks: kingchain3d.js)
    const links = kingChain.attach(want === "king" ? bossModel?.object : null);
    if (links?.length) scene.add(...links);
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
  // Sister Cinder's fire (cinder3d.js, her polish pass 2026-10-20): her hand flames, her spells' fire, smoke, ash and scorch, her
  // fireballs and embers — and the hero's own Firebolt in any fight (it was the toad's green goo ball)
  const cinderFx = makeCinderFx({ sparks });
  scene.add(...cinderFx.objects);
  globalThis.__cinderFx = cinderFx; // (read only, for the checks)
  const cinderCtx = { camera: null, at: (h) => lerp.hazard(h), bone: null, bx: 0, by: 0, clip: "idle", hero: null, intro: null, stateT: 0, cinder: false };
  const cinderBone = (n, o) => bossModel?.boneAt?.(n, o) ?? null;

  // Adds and shots: small pools of spheres.
  const shotGeo = new SphereGeometry(1, 16, 12);
  // Gnasher's spit (the owner, 2026-10-15: "go through the rest of the attacks from gnasher as well and improve the feeling
  // of those"): a wobbling glob of wet bog goo — a yellow-green skin, a darker murky core seen through it, a hard wet
  // highlight and a pale rim — instead of a flat green ball; it drips as it flies and splats where it ends (below).
  const shotMat = new ShaderMaterial({
    transparent: true,
    uniforms: { uA: { value: 1 } },
    vertexShader: `varying vec3 vN, vP; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uA; varying vec3 vN, vP;
      void main() {
        vec3 N = normalize(vN), V = normalize(-vP);
        vec3 L = normalize((viewMatrix * vec4(0.35, 1.0, 0.3, 0.0)).xyz);
        float nv = max(dot(N, V), 0.0);
        vec3 skin = pow(vec3(0.66, 0.82, 0.26), vec3(2.2)), core = pow(vec3(0.20, 0.30, 0.06), vec3(2.2));
        vec3 c = mix(skin, core, smoothstep(0.35, 1.0, nv) * 0.55) * (0.55 + 0.6 * max(dot(N, L), 0.0));
        c += vec3(1.0, 1.0, 0.85) * pow(max(dot(reflect(-L, N), V), 0.0), 40.0) * 1.2;
        c += pow(vec3(0.85, 0.95, 0.55), vec3(2.2)) * pow(1.0 - nv, 2.5) * 0.6;
        gl_FragColor = vec4(c, uA * (0.82 + 0.18 * (1.0 - nv)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const GOO = ["#a6c94a", "#8fb03a", "#c8e070", "#6f8f2a"];
  const shotSeen = new Map(); // (each live glob's last place, for its splat when it ends without hitting)
  const dripT = new Map();
  let frameDt = 0; // (this frame's real dt: drawFrame)
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
  // His flies (content/bosses.js "flies"), in 3D (the owner, 2026-10-15: "improve the feeling of those"; the 2D pixel cards
  // stood flat and blocky in the painted bog): a bloated bog fly — a dark iridescent green abdomen, a bronze thorax, big red
  // eyes, two glassy wings flickering — hovering and bobbing, turned to where it flies, flashing white when struck. Its
  // death keeps the card's pop.
  // (a bottle fly: a metallic blue-green body, a dark head, big red eyes, glassy wings — a first ball-and-red-cap version
  // read as a toy)
  const flyMats = { body: new MeshLambertMaterial({ color: 0x1f6a4a, emissive: 0x0a2e22 }), thorax: new MeshLambertMaterial({ color: 0x24382e, emissive: 0x0c1610 }), head: new MeshLambertMaterial({ color: 0x141a16 }), eye: new MeshLambertMaterial({ color: 0x9a1c12, emissive: 0x3a0806 }), leg: new MeshLambertMaterial({ color: 0x101410 }), wing: new MeshBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.18, depthWrite: false, side: 2 }) };
  const flyLeg = new CapsuleGeometry(0.09, 1.6, 2, 4);
  const flySphere = new SphereGeometry(1, 12, 9);
  const flyWing = new SphereGeometry(1, 10, 4);
  const flies3d = [];
  const flyAt = pool(flies3d, () => {
    const g = new Group();
    const mats = { body: flyMats.body.clone(), thorax: flyMats.thorax.clone(), eye: flyMats.eye };
    const part = (geo, mat, sc, pos) => {
      const m = new Mesh(geo, mat);
      m.scale.set(...sc);
      m.position.set(...pos);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    // (x is forward) the abdomen in three tapering segments, the thorax, the head with its two big eyes, six thin legs
    part(flySphere, mats.body, [1.15, 0.95, 1.0], [-0.9, 0.05, 0]);
    part(flySphere, mats.body, [0.95, 0.8, 0.85], [-1.85, 0.0, 0]);
    part(flySphere, mats.body, [0.6, 0.5, 0.55], [-2.6, -0.05, 0]);
    part(flySphere, mats.thorax, [0.95, 0.9, 0.9], [0.4, 0.2, 0]);
    part(flySphere, flyMats.head, [0.6, 0.6, 0.65], [1.25, 0.2, 0]);
    part(flySphere, mats.eye, [0.42, 0.55, 0.42], [1.45, 0.35, 0.42]);
    part(flySphere, mats.eye, [0.42, 0.55, 0.42], [1.45, 0.35, -0.42]);
    for (const lx of [0.8, 0.3, -0.2]) for (const sd of [-1, 1]) {
      const l = part(flyLeg, flyMats.leg, [1, 1, 1], [lx, -0.75, 0.55 * sd]);
      l.rotation.set(0.55 * sd, 0, (lx - 0.3) * 0.6);
    }
    const wings = [-1, 1].map((sd) => {
      const w = new Mesh(flyWing, flyMats.wing);
      w.scale.set(1.9, 0.04, 0.7);
      const pivot = new Group();
      pivot.position.set(0.3, 0.95, 0.35 * sd);
      w.position.set(-1.3, 0, 0.55 * sd);
      pivot.add(w);
      g.add(pivot);
      return { pivot, sd };
    });
    const blob = makeBlob(3, 0.3);
    scene.add(g, blob);
    return { g, wings, mats, blob, prev: false, prevX: 0, prevY: 0 };
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
    if (debug.critters === 0 || backdrop) return; // the bench's ?critters=0: the markings check wants a bare floor (and a pre-rendered arena has none)
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
      const cg = floorAt(c.x, c.y);
      o.g.position.set(c.x, cg + (c.z || 0) * H_TO_3D, c.y);
      o.blob.position.set(c.x, cg + 0.08, c.y);
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
  let toadHitT = -1, toadHitStr = 0.75; // (the flash's strength: feel.js flash)
  let heroHurtT = -1;
  let lastNow = 0;

  // --- sizing: the canvas at exact device pixels ----------------------------------------------------
  let devSize = null;
  let ro = null;
  // (the canvas's CSS box, measured again only after it may have changed — a resize seen by the observer or the window —
  // where fitCamera asked for it twice a frame, a layout read each time)
  let cssRect = null;
  const cssStale = () => (cssRect = null);
  addEventListener("resize", cssStale);
  try {
    ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const box = e.devicePixelContentBoxSize?.[0];
      if (box) devSize = [box.inlineSize, box.blockSize];
      cssRect = null;
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
    const r = cssRect || canvasEl.getBoundingClientRect();
    // (kept only with an observer to say when it changes, and once it has a size: a canvas not laid out yet is measured again)
    cssRect = ro && r.width > 0 && r.height > 0 ? r : null;
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
            // (a blade into one of his adds — sim/world.js hurtAdd sends a "hit" with no damage on it — is the add's: it flashes
            // itself; the boss's flash, lean and nudge were his on every fly or ember struck)
            if (e.dmg == null) {
              if (bossFor === "cinder") cinderFx.hitAdd(e);
              else P(e.x, e.y, 8, { speed: 100, life: 0.3, cols: PAL.steel, spread: 6.3, size: 1.4, z: 10 });
              dressing?.startle(e.x, e.y, 30);
              break;
            }
            toadHitT = lastNow;
            toadHitStr = e.heavy || e.crit ? FEEL.flash.heavy : FEEL.flash.hit;
            if (FEEL.bossNudge && e.dmg != null && w.boss) (nudge.x += Math.cos(e.a) * FEEL.bossNudge * e.dmg), (nudge.y += Math.sin(e.a) * FEEL.bossNudge * e.dmg);
            // (his hit lean and hard blink, anim/toad-life.js: away from the hero)
            if (bossModel && w.boss && w.player) bossModel.hit(w.boss.x - w.player.x, w.boss.y - w.player.y, e.heavy || e.crit, lerp.viewTime(w));
            if (bossFor === "gnasher") {
              // (a blade into a soft wet toad, not armour — the owner, 2026-10-15, of the fight's other improvements: steel
              // sparks off his skin read as metal): slime and bog water flung off the cut along the blow, a wet splat at it,
              // a small hot flash so the hit still reads; a heavy blow or a crit more, and a ripple out from under him
              const big = e.heavy || e.crit;
              const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
              P(e.x, e.y, big ? 18 : 11, { speed: big ? 95 : 70, life: 0.55, cols: GOO, dir: e.a, spread: 1.6, grav: 420, vz: 70, z: 12, size: sz(1.2, 2.4), drag: 0.94, kind: "water" });
              P(e.x, e.y, big ? 10 : 6, { speed: 55, life: 0.45, cols: ["#e9f6f8", "#cfe6ec", "#ffffff"], dir: e.a, spread: 2.4, grav: 380, vz: 60, z: 12, size: sz(0.8, 1.5), drag: 0.93, kind: "water" });
              sparks.flash(e.x, e.y, 11, { size: big ? 16 : 9, life: big ? 0.14 : 0.08, a: big ? 1.3 : 0.8, col: e.crit ? 0xffe9a8 : 0xf4ffe0 });
              sparks.ring(e.x, e.y, { r: big ? 16 : 10, life: 0.25, col: 0xc8e070, a: 0.7 });
              if (e.crit) sparks.burst(e.x, e.y, 11, 8, { speed: 60, up: 25, dir: e.a, spread: 2.2, life: 0.3, size: 1.5, palette: GLINT.gold });
              if (big && w.boss) {
                sparks.ring(w.boss.x, w.boss.y, { r: 38, life: 0.4, col: 0xe2eef0, a: 0.5 });
                if (bogLife && bogLife.wet(w.boss.x, w.boss.y) > 0.3) bogLife.splash(w.boss.x, w.boss.y, 1.2);
              }
              dressing?.startle(e.x, e.y, 40);
              break;
            }
            if (bossFor === "cinder") {
              // (a blade through a robe of fire, not flesh or steel: embers and ash knocked off along the blow, a warm flash —
              // blood and steel sparks came off her before, 2026-10-20)
              cinderFx.hit(e, e.heavy || e.crit);
              if (e.crit) sparks.burst(e.x, e.y, 13, 8, { speed: 60, up: 25, dir: e.a, spread: 2.2, life: 0.3, size: 1.5, palette: GLINT.gold });
              break;
            }
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
          case "stagger": {
            // (his poise broken: a burst where he reels — a hot gold flash, a shockwave ring, glints flung wide; feel.js)
            const nB = FEEL.bursts.stagger;
            if (!nB) break;
            sparks.flash(e.x, e.y, 18, { size: 34, life: 0.26, col: 0xffe2a0, a: 1.8 });
            sparks.ring(e.x, e.y, { r: 62, life: 0.5, col: 0xffd66b, a: 0.85 });
            sparks.burst(e.x, e.y, 16, nB, { speed: 110, up: 50, life: 0.5, size: 1.9, palette: GLINT.gold });
            if (bossFor === "cinder") cinderFx.stagger(e); // (her flames gutter: sparks and smoke, not the meadow's bits)
            else P(e.x, e.y, Math.round(nB * 0.7), { speed: 90, life: 0.6, cols: PAL.bog, grav: 160, vz: 50, z: 14, size: 1.5 });
            break;
          }
          case "bossDeath": {
            toadHitT = lastNow;
            toadHitStr = FEEL.flash.kill;
            // (the killing blow: a white flash, two shockwave rings, the meadow's motes thrown up; feel.js)
            const nK = FEEL.bursts.kill;
            if (!nK) break;
            sparks.flash(e.x, e.y, 20, { size: 54, life: 0.4, col: 0xfff3d6, a: 2.2 });
            sparks.ring(e.x, e.y, { r: 90, life: 0.7, col: 0xfff0c8, a: 0.9 });
            sparks.ring(e.x, e.y, { r: 50, life: 0.45, col: 0xffd66b, a: 0.8 });
            sparks.burst(e.x, e.y, 20, nK, { speed: 140, up: 70, life: 0.8, size: 2.1, palette: bossFor === "cinder" ? EMBER : GLINT.gold });
            if (bossFor === "cinder") cinderFx.death(e, lastNow); // (her fire going out: embers and smoke)
            else P(e.x, e.y, nK, { speed: 120, life: 0.9, cols: PAL.bog, grav: 150, vz: 70, z: 16, size: 1.7 });
            break;
          }
          case "clang": {
            // (the blade off a boss that cannot be hurt now: steel sparks and a cold flash, so the miss reads; feel.js)
            const nC = FEEL.bursts.clang;
            if (!nC) break;
            sparks.flash(e.x, e.y, 12, { size: 14, life: 0.12, col: 0xe8f2ff, a: 1.3 });
            P(e.x, e.y, nC, { speed: 140, life: 0.3, cols: PAL.steel, spread: 3, z: 13, size: 1.4 });
            break;
          }
          case "hurt":
            heroHurtT = lastNow;
            if (bossFor === "gnasher") {
              // (his blows are wet — tongue, spit, his weight in the mud: a slap of goo and bog water off the hero, and goo
              // dripping off him for a moment after, heroGoo below)
              const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
              P(e.x, e.y, 16, { speed: 70, life: 0.55, cols: GOO, grav: 420, vz: 80, z: 12, size: sz(1.1, 2.2), drag: 0.94, kind: "water" });
              P(e.x, e.y, 10, { speed: 60, life: 0.45, cols: ["#e9f6f8", "#cfe6ec"], grav: 380, vz: 70, z: 8, size: sz(0.8, 1.5), drag: 0.93, kind: "water" });
              heroGooT = lastNow + 0.9;
            }
            // (her fire on him: embers and smoke thrown off him, and he smoulders a moment — cinder3d.js; no blood)
            if (bossFor === "cinder") cinderFx.hurt(e, lastNow);
            else P(e.x, e.y, 16, { speed: 110, life: 0.42, cols: PAL.blood, grav: 140, vz: 40, z: 14, size: 1.6 });
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
            if (e.kind === "fly" && bossFor === "gnasher") {
              // (a fly swatted: a squish of goo, bits of its dark shell and glassy wing flung off, a small ring; the 3D fly
              // vanishes with it — the 2D pop card is not drawn, poseAddsAndShots)
              const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
              const fy = (floorAt(e.x, e.y) + 13) / H_TO_3D;
              P(e.x, e.y, 12, { speed: 55, life: 0.5, cols: GOO, grav: 420, vz: 40, z: fy, size: sz(1.0, 2.0), drag: 0.93, kind: "water" });
              P(e.x, e.y, 6, { speed: 45, life: 0.55, cols: ["#1f6a4a", "#24382e", "#9a1c12"], grav: 380, vz: 50, z: fy, size: sz(1.0, 1.6), drag: 0.93, kind: "water" });
              P(e.x, e.y, 4, { speed: 30, life: 0.6, cols: ["#d8e8ff", "#b8c8d8"], grav: 120, vz: 30, z: fy, size: sz(1.2, 1.8), drag: 0.9, kind: "dust" });
              sparks.ring(e.x, e.y, { r: 12, life: 0.3, col: 0xc8e070, a: 0.7 });
              break;
            }
            if (e.kind === "ember") {
              cinderFx.pop(e); // (one of her embers bursting: its blast is the "boom" mark after it, cinder3d.js)
              break;
            }
            const cols = e.kind === "fly" ? PAL.bog : PAL.brine;
            P(e.x, e.y, 16, { speed: 90, life: 0.45, cols, grav: 60, vz: 30, z: 8, size: 1.5 });
            sparks.flash(e.x, e.y, 6, { size: 10, life: 0.12, col: e.kind === "fly" ? 0xd6f06b : 0xfff0c0 });
            break;
          }
          case "burst":
            if (e.art === "bog") {
              gooSplat(e.x, e.y, 1);
              for (const [sh] of shotSeen) if (sh.dead) sh.hitDone = true; // (its own splat is this one)
              break;
            }
            if (e.art === "ember") {
              cinderFx.burst(e); // (her fireball bursting on him)
              break;
            }
            P(e.x, e.y, 14, { speed: 100, life: 0.35, cols: e.art === "wave" ? PAL.brine : PAL.bog, z: 8, size: 1.5 });
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
          case "telegraph":
            // (a mark laid: the rain's bolt of fire thrown up out of her hands — cinder3d.js)
            if (bossFor === "cinder") cinderFx.telegraph(e.h, cinderFx.hands());
            break;
          case "fire": {
            const h = e.h;
            // (Sister Cinder's marks going live: the blast that lands with each — cinder3d.js; the bog's green specks were all
            // her lanes threw)
            if (bossFor === "cinder" && !h.friendly && FIRE_TAGS.has(h.tag)) {
              cinderFx.fire(h, w, cinderCtx.at);
              dressing?.startleShape(h);
              break;
            }
            // (the Drowned King's chain spin let fly — content/bosses.js "spin", kingchain3d.js: the anchor's round throws the floor's
            // water up in a ring at the circle's edge, spray flung outward, and a pale ring sweeps out to it)
            if (bossFor === "king" && h.tag === "spin") {
              const WATER = ["#cfe6ec", "#9cc4cf", "#e9f6f8", "#7aa7b4"];
              for (let i = 0; i < 64; i++) {
                const a = (i / 64) * Math.PI * 2 + parts.rand() * 0.08, rr = h.r * (0.88 + parts.rand() * 0.12);
                P(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, 1, { dir: a, spread: 0.6, speed: 90, life: 0.8, cols: WATER, grav: 420, vz: 150, z: 2, size: (u) => 1.6 + u * 1.6, drag: 0.96, kind: "water" });
              }
              sparks.ring(h.x, h.y, { r: h.r, life: 0.4, col: 0xcfe6ec, a: 0.75 });
              dressing?.startleShape(h);
              break;
            }
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
            refBell?.strike(e.a, lastNow);
            // (no white flash and gold ring over the blade — the owner, 2026-10-15: "that effect looks ugly, so instead add
            // some small particle effect that is in the same color as the bell": fine flecks of its bronze and green patina
            // knocked off it, falling)
            // (from the sword's tip where it meets the bell, not the bell's middle — the owner, 2026-10-15: drawn after the
            // hero is posed this frame, bellFlecks: read here the tip was a frame behind, 24 units off the bell)
            bellPending = e;
            dressing?.startle(e.x, e.y, 70);
            bogLife?.startle(e.x, e.y, 400);
            break;
          case "bubblePop":
            // (Sister Cinder's bubble burst by the bell's ring: her opening, cinder3d.js)
            cinderFx.bubblePop(e, lastNow);
            dressing?.startle(e.x, e.y, 120);
            break;
          case "wake": {
            // (her waking's thump and shockwave, the bubble's pop: cinder3d.js; `small`, her seal's in the fight popped by the
            // bell — a ring of dust a third as far)
            cinderFx.wake(e, lastNow);
            // (and a pale ring of ash dust rolling out low at the shockwave's own speed, as his landing's: her dark smoke alone was
            // lost on the Ash Floor's dark stone — .scratch/cinder-polish/films/v2-shock.jpg)
            const k = e.small ? 0.35 : 1;
            P(e.x, e.y, Math.round(120 * k), { speed: e.speed, life: 0.95 * k, cols: ["#d8cfbe", "#bfb5a2", "#a39a8a", "#e6d9c0"], spread: 6.3, size: 2.6, kind: "dust", z: 2, drag: 1 });
            P(e.x, e.y, Math.round(60 * k), { speed: e.speed * 0.7, life: 0.8 * k, cols: ["#cfc4ae", "#9d9484"], spread: 6.3, size: 3.4, kind: "dust", z: 3, drag: 0.99 });
            sparks.ring(e.x, e.y, { r: 260 * k, life: 0.95 * Math.sqrt(k), col: 0xffd8a0, a: 0.45 });
            dressing?.startle(e.x, e.y, 400 * k);
            break;
          }
          case "seal":
            // (Sister Cinder sealed in her bubble in the fight — content/bosses.js cinder.moves.seal: cinder3d.js)
            cinderFx.seal(e);
            break;
          case "ward":
            // (a blow glancing off her bubble: its film ripples — cinder3d.js; not the clang's steel sparks)
            cinderFx.ward(e, lastNow);
            break;
          case "shockHit":
            cinderFx.shockHit(e);
            break;
          case "bellAnswer":
            // The big bell answers the small one (the Drowned Hall, sim/world.js stepEntrance; the owner's pick, 2026-10-19:
            // "the hero rings the SMALL bell, and the BIG bell answers"): it swings in its frame, slow and heavy, toward the
            // screen's right
            refAnswer?.strike(-Math.PI / 4, lastNow);
            break;
          case "entrance":
            // He lands: a ring of dust thrown out all round, clods and grass kicked up, everything nearby bolts.
            if (!bogLife && backdropFor !== "hall") {
              P(e.x, e.y, 70, { speed: 210, life: 0.75, cols: ["#6b6a3c", "#55562f", "#7d7a49", "#3f4226"], spread: 6.3, size: 2.4, kind: "dust", z: 2 });
              P(e.x, e.y, 26, { speed: 120, life: 0.6, cols: ["#4f6b2a", "#3c5320", "#6a5a34"], spread: 6.3, grav: 260, vz: 90, z: 4, size: 1.8 });
            }
            landBurst(e.x, e.y, 1.6);
            sparks.ring(e.x, e.y, { r: 80, life: 0.6, col: 0xf0e2b8, a: 0.55 });
            dressing?.startle(e.x, e.y, 160);
            bogLife?.startle(e.x, e.y, 400);
            break;
          case "entranceLeap":
            // (his take-off beyond the floor's edge: out of the water, if it is water there — the Drowned Hall's is all sea)
            if (bogLife && bogLife.wet(e.x, e.y) > 0.5) bogLife.splash(e.x, e.y, 2.2);
            else if (backdropFor === "hall") hallBurst(e.x, e.y, 1.4);
            break;
          case "chest":
            chest3d.drop(lastNow);
            break;
          case "chestLand":
            // it lands: dust thrown out round it, a shake (the sim's), the garden's critters bolt
            chest3d.land(lastNow);
            if (bossFor === "gnasher" && w.boss) squashBurst(w.boss.x, w.boss.y, e.x, e.y);
            // (on Sister Cinder's ashes: grey ash and the last embers thrown up round it)
            if (bossFor === "cinder") cinderFx.ashes(e.x, e.y);
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
            bogLife?.startle(e.x, e.y, e.small ? 90 : 140);
            if (bogLife && bogLife.wet(e.x, e.y) > 0.5) bogLife.splash(e.x, e.y, e.small ? 1.8 : 2.6);
            // (the ground rippling out over the landing's own circle: content/bosses.js SLAM_R, the frenzy's SLAM_R_SMALL)
            bogLife?.shock(e.x, e.y, e.small ? SLAM_R_SMALL : SLAM_R, SLAM_SWEEP);
            break;
          case "sfx": {
            // moments that only send a sound: shown too
            const b = w.boss;
            if (!b || b.hidden) break;
            if (e.name === "phase" && bossFor === "cinder") cinderFx.phase(b); // (fire bursting out of her, her flames flaring)
            else if (e.name === "enrage" && bossFor === "cinder") cinderFx.phase(b);
            else if (e.name === "phase") {
              // a new phase: a ring of force off him and red motes up round him
              sparks.ring(b.x, b.y, { r: 80, life: 0.7, col: 0xff6a4a, a: 0.8 });
              sparks.rise(b.x, b.y, bossR, 40, { up: 30, life: 1.1, size: 1.8, palette: GLINT.red });
            } else if (e.name === "enrage") {
              sparks.flash(b.x, b.y, bossTop() * 0.8, { size: 34, life: 0.3, col: 0xff8060, a: 1.4 });
              sparks.rise(b.x, b.y, bossR, 50, { up: 34, life: 1.3, size: 1.9, palette: GLINT.red });
            } else if (e.name === "spit") {
              // (the spit leaving him: goo sprayed from his mouth after the globs)
              const a = b.face;
              const mx = b.x + Math.cos(a) * bossR * 0.8, my = b.y + Math.sin(a) * bossR * 0.8;
              P(mx, my, 14, { dir: a, spread: 1.1, speed: 70, life: 0.45, cols: GOO, grav: 420, vz: 40, z: 12, size: (u) => 0.8 + u * 1.2, drag: 0.92, kind: "water" });
            } else if (e.name === "cast") {
              sparks.ring(b.x, b.y, { r: bossR + 14, life: 0.6, col: 0xb6f06b, a: 0.5 });
            } else if (e.name === "hop") {
              sparks.ring(b.x, b.y, { r: bossR + 10, life: 0.35, col: 0xf0e2b8, a: 0.35 });
              if (bogLife) P(b.x, b.y, 22, { speed: 60, life: 0.5, cols: ["#cfe6ec", "#9cc4cf", "#4f6b2a", "#6a8a34"], spread: 6.3, size: (u) => 0.5 + u * 0.8, grav: 480, vz: 110, z: 2, drag: 0.95, kind: "water" });
              else P(b.x, b.y, 18, { speed: 90, life: 0.5, cols: ["#7d7a49", "#6b6a3c", "#8c8358"], spread: 6.3, size: 2.2, kind: "dust", z: 2 });
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
            if (e.kind === "fly") {
              // (out of the mud: a boil of mud and water thrown up, a ring, a puff of dark specks — the swarm leaving it)
              const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
              P(e.x, e.y, 12, { speed: 40, spread: Math.PI * 2, life: 0.6, cols: ["#8a6a42", "#6e5434", "#a07c4e"], grav: 520, vz: 110, z: 1, size: sz(1.2, 2.4), drag: 0.94, kind: "water" });
              P(e.x, e.y, 10, { speed: 30, spread: Math.PI * 2, life: 0.5, cols: ["#e9f6f8", "#cfe6ec"], grav: 480, vz: 90, z: 1, size: sz(0.8, 1.6), drag: 0.94, kind: "water" });
              P(e.x, e.y, 14, { speed: 35, spread: Math.PI * 2, life: 0.8, cols: ["#1c2410", "#2a3318"], grav: -20, vz: 30, z: 4, size: sz(0.5, 0.9), drag: 0.9 });
              sparks.ring(e.x, e.y, { r: 20, life: 0.45, col: 0xb6d08a, a: 0.6 });
              if (bogLife && bogLife.wet(e.x, e.y) > 0.3) bogLife.splash(e.x, e.y, 1.0);
              dressing?.startle(e.x, e.y, 30);
              break;
            }
            if (e.kind === "ember") {
              cinderFx.spawn(e); // (out of a burst of flame)
              break;
            }
            P(e.x, e.y, 12, { speed: 50, life: 0.4, cols: e.kind === "hand" ? PAL.brine : PAL.bog, z: 4, size: 1.4 });
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
    // (in the bog: fine water and moss thrown up and aside — the owner, 2026-10-15: "The particles that gnasher makes when he
    // lands are a bit too big and should be a bit more fine detail and should look like water and moss is being thrown up
    // and aside from his landing")
    if (bogLife) return bogBurst(x, y, k);
    if (backdropFor === "hall") return hallBurst(x, y, k);
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
  // The Drowned Hall's wet stone (the King's landing out of the sea, content/bosses.js entrance): sea water thrown up in a crown,
  // grit and torn weed off the flags, a low ring of spray — no garden clods or grass on a sunken floor
  function hallBurst(x, y, k) {
    const r = bossR * 0.9;
    const n = Math.round(44 * k);
    const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
    const WATER = ["#cfe6ec", "#9cc4cf", "#e9f6f8", "#7aa7b4"];
    const GRIT = ["#5d6670", "#47505a", "#3b4a3a", "#56653a"];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + parts.rand() * 0.4;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      P(px, py, 2, { dir: a, spread: 0.6, speed: 75 * k, life: 0.8, cols: WATER, grav: 520, vz: 170 * k, z: 2, size: sz(0.8, 1.6), drag: 0.95, kind: "water" });
      if (i % 2 === 0) P(px, py, 1, { dir: a, spread: 0.8, speed: 90 * k, life: 0.8, cols: GRIT, grav: 640, vz: 110 * k, z: 2, size: sz(0.9, 1.7), drag: 0.95, kind: "drop" });
      if (i % 3 === 0) P(px, py, 1, { dir: a, spread: 0.3, speed: 150 * k, life: 0.5, cols: ["#e4f2f4", "#b9d6dc"], size: sz(1.0, 1.8), kind: "dust", z: 1, drag: 0.9 });
    }
  }
  function bogBurst(x, y, k) {
    const r = bossR * 0.9;
    const n = Math.round(46 * k);
    const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
    const WATER = ["#cfe6ec", "#9cc4cf", "#e9f6f8", "#7aa7b4"];
    const MOSS = ["#4f6b2a", "#3c5320", "#6a8a34", "#2f4219"];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + parts.rand() * 0.4;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      // water: a crown of fine drops, up and out
      P(px, py, 2, { dir: a, spread: 0.6, speed: 70 * k, life: 0.75, cols: WATER, grav: 520, vz: 160 * k, z: 2, size: sz(0.5, 1.1), drag: 0.95, kind: "water" });
      // moss and weed torn up, flung aside, a little heavier
      if (i % 2 === 0) P(px, py, 1, { dir: a, spread: 0.8, speed: 95 * k, life: 0.9, cols: MOSS, grav: 600, vz: 120 * k, z: 2, size: sz(0.7, 1.3), drag: 0.95, kind: "drop" });
      // a low ring of spray rolling out
      if (i % 3 === 0) P(px, py, 1, { dir: a, spread: 0.3, speed: 140 * k, life: 0.45, cols: ["#e4f2f4", "#b9d6dc"], size: sz(0.8, 1.5), kind: "dust", z: 1, drag: 0.9 });
    }
    // and rings on the water where he came down
    bogLife.splash(x, y, 1.6 * k);
  }
  // The tongue's tip slapping down (the owner's pick, concept C, 2026-10-15: "a sticky rounded tip that hits the ground
  // with an impact burst of swamp water, mud and moss flying up and aside, a ring of ripples on the ground, and droplets of
  // saliva"): mud and moss flung up and aside, fine water, pale-pink spit, a low ring of spray and a ripple ring — on the
  // bog's water its own rings too.
  function tongueBurst(x, y) {
    const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
    const wet = !!bogLife && bogLife.wet(x, y) > 0.3;
    // (light enough to read on the dark bog: its own dark mud and moss colours were lost on it)
    const MUD = ["#8a6a42", "#a07c4e", "#6e5434"];
    const MOSS = ["#8fb04a", "#a6c94a", "#79983a"];
    const WATER = ["#e9f6f8", "#cfe6ec", "#ffffff", "#b6d8e0"];
    const SPIT = ["#f6dfe3", "#efc3cc", "#ffffff"];
    // (it rises about half the hero's height, as the concept draws it: v²/2g — the first try flew 54 units up, out of the
    // picture)
    // (sizes in world units — the hero is 19 tall, about 3 px a unit on a phone: the bog's fine 1-unit drops were
    // invisible at the fight's distance; these read as clods and a splash)
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + parts.rand() * 0.5;
      // (from a ring round the tip pad, not its middle: from there the pad and the tongue hid the whole burst)
      const ox = x + Math.cos(a) * 7, oy = y + Math.sin(a) * 7;
      P(ox, oy, 1, { dir: a, spread: 0.5, speed: 40 + parts.rand() * 40, life: 0.7, cols: MUD, grav: 620, vz: 80 + parts.rand() * 50, z: 2, size: sz(2.4, 4.4), drag: 0.96, kind: "water" });
      if (i % 2 === 0) P(ox, oy, 1, { dir: a, spread: 0.7, speed: 55, life: 0.75, cols: MOSS, grav: 560, vz: 100, z: 2, size: sz(2.0, 3.6), drag: 0.95, kind: "water" });
      P(ox, oy, 3, { dir: a, spread: 0.6, speed: 50, life: 0.6, cols: WATER, grav: 520, vz: 115, z: 2, size: sz(1.4, 2.8), drag: 0.95, kind: "water" });
      if (i % 2 === 0) P(ox, oy, 1, { dir: a, spread: 0.3, speed: 130, life: 0.45, cols: ["#e4f2f4", "#d8e8ea"], size: sz(1.6, 2.6), kind: "water", z: 1, drag: 0.9 }); // (round: square dust read as blocks)
    }
    P(x, y, 14, { speed: 70, spread: Math.PI * 2, z: 8, life: 0.55, cols: SPIT, grav: 480, vz: 90, size: sz(1.0, 2.0), drag: 0.95, kind: "water" });
    sparks.ring(x, y, { r: 52, life: 0.55, col: 0xe2eef0, a: 0.85 });
    sparks.ring(x, y, { r: 24, life: 0.35, col: 0xcfe3e6, a: 0.6 });
    if (wet) bogLife.splash(x, y, 1.3);
  }
  // A glob of his spit bursting (on the hero, or on the ground at its end): goo flung out and dripping, a green ring, and
  // on the bog's water rings of its own.
  function gooSplat(x, y, k = 1) {
    const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
    const n = Math.round(16 * k);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + parts.rand() * 0.6;
      P(x, y, 1, { dir: a, spread: 0.5, speed: 40 + parts.rand() * 40, life: 0.6, cols: GOO, grav: 520, vz: 70 + parts.rand() * 60, z: 4, size: sz(1.2, 2.4), drag: 0.94, kind: "water" });
    }
    P(x, y, Math.round(8 * k), { speed: 20, spread: Math.PI * 2, life: 0.5, cols: ["#d8ec8a", "#ffffff"], grav: 300, vz: 50, z: 4, size: sz(0.6, 1.2), drag: 0.9, kind: "water" });
    sparks.ring(x, y, { r: 22 * k + 8, life: 0.4, col: 0xb6e06b, a: 0.7 });
    if (bogLife && bogLife.wet(x, y) > 0.3) bogLife.splash(x, y, 1.0 * k);
  }
  // The chest landing on Gnasher's body (case "chestLand"): he bursts — goo, bog water and mud thrown up and out all round,
  // flecks of his green skin, a sheet of spray low across the ground, two shockwave rings and the pools' own rings — and
  // the chest hits the ground hard: a hot flash under it and a heavy ring of dust.
  function squashBurst(bx, by, cx, cy) {
    const sz = (lo, hi) => (u) => lo + (hi - lo) * u;
    const SKIN = ["#4f7a2a", "#6a9a34", "#3c5a20", "#c8b88a"];
    const MUD = ["#8a6a42", "#6e5434", "#a07c4e"];
    const WATER = ["#e9f6f8", "#cfe6ec", "#ffffff", "#b6d8e0"];
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + parts.rand() * 0.3;
      const r0 = bossR * 0.6;
      const ox = bx + Math.cos(a) * r0, oy = by + Math.sin(a) * r0;
      P(ox, oy, 2, { dir: a, spread: 0.5, speed: 90 + parts.rand() * 80, life: 0.9, cols: GOO, grav: 520, vz: 150 + parts.rand() * 110, z: 3, size: sz(1.6, 3.2), drag: 0.95, kind: "water" });
      P(ox, oy, 1, { dir: a, spread: 0.6, speed: 70 + parts.rand() * 60, life: 1.0, cols: SKIN, grav: 560, vz: 130 + parts.rand() * 90, z: 3, size: sz(1.6, 2.8), drag: 0.95, kind: "water" });
      P(ox, oy, 2, { dir: a, spread: 0.5, speed: 80, life: 0.8, cols: WATER, grav: 500, vz: 170, z: 2, size: sz(1.2, 2.4), drag: 0.95, kind: "water" });
      if (i % 2 === 0) P(ox, oy, 1, { dir: a, spread: 0.6, speed: 60, life: 0.8, cols: MUD, grav: 600, vz: 110, z: 2, size: sz(1.6, 3.0), drag: 0.95, kind: "water" });
      if (i % 2 === 1) P(ox, oy, 1, { dir: a, spread: 0.3, speed: 170, life: 0.55, cols: ["#e4f2f4", "#d8e8ea"], size: sz(2.0, 3.4), kind: "water", z: 1, drag: 0.88 });
    }
    sparks.flash(cx, cy, 6, { size: 40, life: 0.25, col: 0xfff0c8, a: 1.6 });
    sparks.ring(bx, by, { r: 96, life: 0.75, col: 0xe2eef0, a: 0.9 });
    sparks.ring(bx, by, { r: 58, life: 0.5, col: 0xb6e06b, a: 0.8 });
    sparks.ring(cx, cy, { r: 40, life: 0.45, col: 0xfff0c8, a: 0.8 });
    if (bogLife) {
      bogLife.splash(bx, by, 3);
      bogLife.startle(bx, by, 400);
    }
    dressing?.startle(bx, by, 160);
  }
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
        const d = Math.sqrt(rand()) * (h.kind === KIND.FLOOD ? floorShape.R : r + (h.w || 0));
        x = h.x + Math.cos(a) * d;
        y = h.y + Math.sin(a) * d;
      }
      if (floorShape.out(x, y) <= 0) return [x, y];
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
        const fx = at.x || p.x, fy = at.z || p.y;
        // (in one of the bog's pools: water thrown up and a ring on it, and the step a splash — boglife3d.js)
        if (bogLife && bogLife.wet(fx, fy) > 0.5) {
          bogLife.splash(fx, fy, 0.6 + Math.min(0.6, Math.hypot(s.vx, s.vy) / 160));
          onCue?.("step", "hall");
        } else {
          dust(fx, fy, 3, 22, back, 1.2);
          // (the Drowned Hall's flags are wet under a film of sea water: audio.js's "hall" step, a splash in the shallows)
          onCue?.("step", backdropFor === "hall" ? "hall" : "meadow");
        }
      }
    });
    const fresh = s.state !== cueState.state || p.step !== cueState.step || s.t < cueState.t;
    const from = fresh ? -1 : cueState.t;
    if (s.state === STATE.ROLL && from < 0.202 && s.t >= 0.202) {
      if (bogLife && bogLife.wet(p.x, p.y) > 0.5) bogLife.splash(p.x, p.y, 1.6);
      else dust(p.x, p.y, 7, 34, back, 2.2);
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
      if (w.state === "won" && lerp.stateT(w) > 0.4 && lerp.stateT(w) < 2.3) sparks.rise(toadAt.x, toadAt.y, bossR * 0.9, bossFor === "cinder" ? 2 : 3, { h: 2, up: 28, life: 1.2, size: 1.7, palette: bossFor === "cinder" ? EMBER : GLINT.gold });
    }
  }

  // --- posing the placeholders ------------------------------------------------------------------------
  function poseHero(w, now) {
    const p = w.player;
    const s = lerp.hero(w);
    heroBlob.position.set(p.x, floorAt(p.x, p.y) + 0.08, p.y);
    heroBlob.scale.setScalar(1 - 0.45 * jumpLift(s)); // (his shadow smaller as he goes up)
    heroBlob.visible = !(heroModel && shadows.params.on); // (his projected shadow is his shadow: never two)
    if (heroModel) {
      const flash = now - heroHurtT < 0.2 ? 0.8 * (1 - (now - heroHurtT) / 0.2) : 0;
      // The i-frame blink after a hurt (not the roll's, which the afterimages show).
      const blink = p.iFrames > 0 && p.state !== STATE.ROLL && Math.floor(now * 16) % 2 === 0 ? 0.45 : 1;
      // (the boss for his look-at, where it is drawn; real time for the hit-stop's shake)
      // (after a win, the chest waiting to be opened)
      const look = w.boss && !w.boss.hidden && w.boss.hp > 0 ? { x: w.boss.x, z: w.boss.y } : w.chest?.landed && w.chest.openAt == null ? { x: w.chest.x, z: w.chest.y } : null;
      const pick = heroModel.update(p, s, { t: lerp.viewTime(w), stateT: lerp.stateT(w), worldState: w.state, snap: heroSnap }, { flash, alpha: blink, now, lookAt: look });
      heroSnap = false;
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
  let cinderBurn = 0; // (Sister Cinder burning away or into being: poseToad)
  const smoothstep01 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  let lastViewT = null;
  const toadAt = { x: 0, y: 0, lift: 0 }; // where he is drawn this frame, for the fades
  const nudge = { x: 0, y: 0 }; // (his model knocked along a blow, feel.js bossNudge: held through the freeze, springing back)
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
    const at0 = leap(b, s.moveT);
    const nl = Math.hypot(nudge.x, nudge.y);
    if (nl > FEEL.bossNudgeMax) (nudge.x *= FEEL.bossNudgeMax / nl), (nudge.y *= FEEL.bossNudgeMax / nl);
    const at = nl > 1e-3 ? { ...at0, x: at0.x + nudge.x, y: at0.y + nudge.y } : at0;
    const nd = Math.exp(-dt * 11);
    nudge.x *= nd;
    nudge.y *= nd;
    // His death (the owner, 2026-10-15: "instead of the toad falling through the floor, let the chest hit the toad from
    // above splashing the toad into a big particle effect while the toad disappears and the chest heavily hits the ground"):
    // the dead clip slumps him where he fell; the chest (sim/world.js stepChest, dropped on his spot) falls onto him and he
    // is squashed flat under it as it comes down — from when its bottom (chest3d.js: FALL·(1−u²) up) reaches his top — and
    // bursts as it lands (case "chestLand"), hidden from then on (the sim's "chest" state)
    let squashChest = 1;
    if (bossFor === "gnasher" && w.state === "won" && w.chest) {
      const u = Math.min(1, w.chest.t / FIGHT.chest.drop);
      const bottom = CHEST_FALL * (1 - u * u);
      squashChest = clamp(bottom / (bossTop() + 3), 0.18, 1);
    }
    const lift = at.lift * H_TO_3D;
    toadAt.x = at.x;
    toadAt.y = at.y;
    toadAt.lift = lift;
    // (his wide tongue's sweep: his head turns with it, his face along the tongue, the body holding its facing — the owner,
    // 2026-10-15: "his face needs to follow the direction of the tongue", then "he does not move the body rotation but rather
    // turning his head"; last frame's sweep angle, followed exactly — boss3d.js headFace)
    const sweeping = sweepAngle != null && sweepH && w.hazards.includes(sweepH) && sweepH.t - sweepH.tele <= sweepH.active + sweepH.fade;
    if (sweeping) (s.headFace = sweepAngle), (s.headSnap = true);
    else {
      sweepAngle = null;
      // (in its wind-up, once the cone is on the floor, his head turns — smoothly — to the edge his sweep starts from: the side
      // away from the hero; without it he snapped 36° on its first frame)
      const ht = w.hazards.find((x) => x.tag === "hold" && !x.friendly && x.kind === KIND.CONE && phaseOf(x) === "tele");
      if (ht) {
        const hp0 = lerp.hazard(ht);
        if (sweepH !== ht) {
          sweepH = ht;
          sweepSide = Math.cos(hp0.a) * (w.player.y - hp0.y) - Math.sin(hp0.a) * (w.player.x - hp0.x) >= 0 ? 1 : -1;
          sweepPrev = null;
        }
        s.headFace = hp0.a - sweepSide * ht.half;
      }
    }
    const pick = bossModel ? bossModel.update(b, s, w, { t: viewT }, at, lift) : bossAnimState(bossRec, b, s, w, { t: viewT });
    if (bossModel && bossFor === "gnasher") {
      // (flattened under the falling chest, spreading out as he is pressed)
      const bo = bossModel.object;
      const spread = 1 + (1 - squashChest) * 0.55;
      bo.scale.set(spread, squashChest, spread);
      // (his rage, from his second phase, stronger in the last or enraged: snorts of steam between attacks — the glowing red
      // eyes were removed, the owner, 2026-10-15: "Remove the red rage eye effects")
      const rage = w.state === "fight" && b.hp > 0 ? (b.phase >= 2 || w.enraged ? 1 : b.phase >= 1 ? 0.55 : 0) : 0;
      if (rage > 0 && !b.move && !b.hidden) {
        snortT -= dt;
        if (snortT <= 0) {
          snortT = 1.6 + parts.rand() * 1.6 - rage * 0.6;
          const mx = at.x + Math.cos(s.face) * bossR * 0.85, my = at.y + Math.sin(s.face) * bossR * 0.85;
          P(mx, my, 8, { dir: s.face, spread: 0.7, speed: 22, life: 0.9, cols: ["#e8ece4", "#d0d8cc", "#f4f6f0"], grav: -18, vz: 8, z: bossTop() * 0.55 / H_TO_3D, size: (u) => 2.0 + u * 2.0, drag: 0.92, kind: "dust" });
        }
      }
    }
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
    // His croak (the heal: interrupt it): green motes drawn in to him from the floor round him, rising, and a ring
    // pulsing out from him, faster as it nears done — so the cast reads as something to stop (2026-10-15)
    if (b.casting && !b.hidden) {
      const ck = b.casting.k || 0;
      croakT -= dt;
      if (croakT <= 0) {
        croakT = 0.018;
        // (world-unit sizes: under 2 they are specks at the fight's distance; low and drawn in, not floating off)
        const a = parts.rand() * Math.PI * 2, d = bossR + 20 + parts.rand() * 40;
        const px = at.x + Math.cos(a) * d, py = at.y + Math.sin(a) * d;
        P(px, py, 1, { dir: a + Math.PI, spread: 0.1, speed: (d - bossR * 0.6) / 0.7, life: 0.7, cols: ["#8fffd0", "#b6ffd8", "#5fe0a8", "#e6fff2"], grav: -6, vz: 10, z: 1, size: (u) => 2.0 + u * 1.6, drag: 1, kind: "water" });
      }
      croakRing -= dt;
      if (croakRing <= 0) {
        croakRing = 0.7 - 0.35 * ck;
        sparks.ring(at.x, at.y, { r: bossR + 30, life: 0.7, col: 0x8fffd0, a: 0.7 + 0.3 * ck });
      }
    }
    // His held attack's wind-up (content/bosses.js "hold": he rears and holds): the ground tremors under him, grit and
    // water jumping round his feet
    if (b.move && b.lastMove === "hold" && b.moveT > 0.25 && b.moveT < 1.72) {
      holdT -= dt;
      if (holdT <= 0) {
        holdT = 0.06;
        const a = parts.rand() * Math.PI * 2, d = bossR * (0.8 + parts.rand() * 0.5);
        P(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, 1, { dir: a, spread: 0.6, speed: 12, life: 0.35, cols: bogLife ? ["#cfe6ec", "#8a6a42", "#a6c94a"] : ["#7d7a49", "#8c8358"], grav: 500, vz: 50 + parts.rand() * 30, z: 0.5, size: (u) => 0.8 + u * 0.8, drag: 0.9, kind: "water" });
      }
    }
    // The tongue, from the live lash lane: out in 0.08 s, held while live, drawn back as it fades.
    const h = pick.tongue;
    if (h) {
      const hp = lerp.hazard(h);
      const ph = h.t - h.tele;
      // (out on real time: on the fight's clock it stood still through the hit's freeze, and the hero was struck by a
      // lane with no tongue in it for a tenth of a second — 2026-10-15; out in 0.06 s, inside the freeze)
      if (tongueH !== h) (tongueH = h), (tongueT0 = now);
      const k = ph <= h.active ? Math.min(1, (now - tongueT0) / 0.06) : Math.max(0, 1 - (ph - h.active) / Math.max(0.05, h.fade)) * (1 + 0.08 * Math.sin((ph - h.active) * 40));
      const age = Math.max(0, now - tongueT0);
      // His wide tongue (the "hold" cone): a sweep from one edge of the cone to the other while it can hit — the owner,
      // 2026-10-15: "make that more like a tongue sweep from one side to the other so that it fit the hitbox better"
      // (straight down its middle it covered a sliver of a 71° fan). It starts on the side away from the hero and sweeps
      // through him; the tongue bursts on him as it passes his angle, else at its tip where the sweep ends.
      let sweep = null;
      if (h.kind === KIND.CONE) {
        if (sweepH !== h) {
          sweepH = h;
          const cr = Math.cos(hp.a) * (w.player.y - hp.y) - Math.sin(hp.a) * (w.player.x - hp.x);
          sweepSide = cr >= 0 ? 1 : -1;
          sweepPrev = null;
        }
        const su = Math.min(1, age / (0.07 + h.active)); // (out 0.07 s before it fires, done as its live window ends)
        const e = su * su * (3 - 2 * su);
        sweep = hp.a - sweepSide * h.half + sweepSide * 2 * h.half * e;
      }
      const ta = sweep ?? hp.a;
      if (sweep != null) sweepAngle = sweep;
      const hpT = sweep == null ? hp : { ...hp, a: ta };
      const mx = at.x + Math.cos(ta) * TOAD_R * 0.7;
      const mz = at.y + Math.sin(ta) * TOAD_R * 0.7;
      tongue.update([mx, lift + TOAD_H * 0.4, mz], h, hpT, k, 4.5, age);
      if (sweep != null && ph <= h.active + 0.02) {
        // (mud, moss and water thrown off its tip as it drags across the ground)
        P(tongue.tipAt[0], tongue.tipAt[1], 2, { dir: sweep + sweepSide * Math.PI / 2, spread: 0.9, speed: 50, life: 0.5, cols: ["#e9f6f8", "#cfe6ec", "#8fb04a", "#8a6a42"], grav: 520, vz: 90, z: 1, size: (u) => 1.2 + u * 1.4, drag: 0.94, kind: "water" });
        const p = w.player;
        if (tongueBurstH !== h && !p.dead && hits(h, p.x, p.y, 4)) {
          const ah = Math.atan2(p.y - hp.y, p.x - hp.x);
          const rel = (x) => Math.atan2(Math.sin(x - ah), Math.cos(x - ah));
          if (sweepPrev != null && Math.sign(rel(sweepPrev)) !== Math.sign(rel(sweep))) (tongueBurstH = h), tongueBurst(p.x, p.y);
        }
        sweepPrev = sweep;
      }
      if (sweep != null && tongueBurstH !== h && ph > h.active) (tongueBurstH = h), tongueBurst(tongue.tipAt[0], tongue.tipAt[1]);
      // (the tip slapping down, once a lash, as it first reaches full length)
      if (sweep == null && k >= 0.999 && ph <= h.active && tongueBurstH !== h) {
        // (where it strikes the hero, if he is in its lane — the concept's splash bursts round him; else at its tip)
        tongueBurstH = h;
        const p = w.player;
        const ux = Math.cos(hp.a), uy = Math.sin(hp.a);
        const al = (p.x - hp.x) * ux + (p.y - hp.y) * uy;
        const tl = (tongue.tipAt[0] - hp.x) * ux + (tongue.tipAt[1] - hp.y) * uy;
        if (!p.dead && hits(h, p.x, p.y, 4) && al < tl) tongueBurst(hp.x + ux * (al - 4), hp.y + uy * (al - 4));
        else tongueBurst(tongue.tipAt[0], tongue.tipAt[1]);
      }
    } else tongue.update(null, null, null, 0);
    // Sister Cinder burning (materials3d.js, a negative uDissolve): out of a column of fire as the name card comes — formed
    // from her hem up by 0.45 of it — and, killed, crumpling into her robe (her dead clip, 1.4 s) and then burning away from
    // her hood down, 1.0 to 2.1 s after the blow, before the chest falls on her ashes at 2.45 (FIGHT.chest) — "The fire goes
    // out" (docs/CINDER-MOVEMENT.md); the dither fade with gold motes before
    cinderBurn = 0;
    if (bossFor === "cinder") {
      // (no opening: the benches, practice — her opening goes from the bell to the fight, no "intro"; a bell stands in any fight on
      // her floor now, her seal's: sim/world.js)
      if (w.state === "intro") cinderBurn = 1 - smoothstep01((lerp.stateT(w) / FIGHT.intro - 0.08) / 0.37);
      else if (w.state === "won") cinderBurn = smoothstep01((lerp.stateT(w) - 1.0) / 1.1);
    }
    // The hit flash: towards white (never red, the telegraph colour), on real time; the Horn's
    // stagger tints it grey-blue while immune, as in 2D.
    const since = now - toadHitT;
    for (const m of bossModel ? bossModel.materials : [toadMat]) {
      const FL = FEEL.flash, fh = FL.hold || 0;
      m.userData.paint.uFlash.value = since < fh ? toadHitStr : since < fh + FL.dur ? toadHitStr * (1 - (since - fh) / FL.dur) : 0;
      // (the inside of his mouth: its own flat shade, boss3d.js; while he croaks to heal, his skin pulses a soft green — the
      // cast reads at a glance as the thing to stop)
      const healing = !!b.casting && !m.userData.unlit;
      if (!m.userData.unlit) m.userData.paint.uTintCol.value.setHex(healing ? 0x7cf0b4 : 0x8b96b8);
      // (immune through Sister Cinder's opening too — waiting in her bubble, charging — and sealed in it in the fight, but not ashen:
      // the grey-blue tint turned her a white ghost inside the bubble)
      const ashen = b.immune && !b.sealed && !(w.state === "bell" || w.state === "entrance");
      m.userData.paint.uTintAmt.value = m.userData.unlit ? 1 : ashen ? 0.45 : healing ? 0.015 + 0.025 * (0.5 + 0.5 * Math.sin(now * 7)) : 0; // (0.1-0.18, then 0.08, still turned him teal)
      m.userData.paint.uDissolve.value = cinderBurn !== 0 ? -cinderBurn : w.state === "won" && bossFor !== "gnasher" && bossFor !== "cinder" ? Math.max(0, (lerp.stateT(w) - 0.6) / 1.6) : 0; // (Gnasher: the chest lands on him instead)
      if (cinderBurn !== 0) m.userData.paint.uBurnY.value.set(floorAt(at.x, at.y), BOSS_MODELS.cinder.height);
    }
    // (her ink outline off while she burns or fades: left behind it read as a dark ghost of her)
    bossModel?.outline?.(cinderBurn < 0.02 && !(w.state === "won" && bossFor !== "gnasher" && bossFor !== "cinder" && lerp.stateT(w) > 0.6));
    // While airborne his shadow-map shadow would land off to the side (a false landing spot), so
    // only the blob under him stays.
    for (const m of [belly, cream, ...eyes]) m.castShadow = lift < 2;
    const shrink = 1 - clamp(lift / 40, 0, 0.45);
    toadBlob.position.set(at.x, floorAt(at.x, at.y) + 0.08, at.y);
    toadBlob.scale.set(bossR * 1.08 * shrink, 1, bossR * 1.08 * shrink);
    toadBlob.material.opacity = toadBlob.userData.baseOpacity * (0.5 + 0.5 * shrink);
    // (the projected shadow is his shadow: the round blob under it made two — the owner, 2026-10-15: "He is also having two
    // shadows, so he should only use the improved shadow")
    if (bossModel && shadows.params.on) toadBlob.visible = false;
  }

  function poseAddsAndShots(w) {
    let i = 0;
    let fi = 0;
    for (const a of w.adds) {
      if (a.type === "fly" && a.alive) {
        const o = flyAt(fi++);
        o.g.visible = o.blob.visible = true;
        const ag = floorAt(a.x, a.y);
        const t = lastNow * 3 + a.x * 0.13;
        const rise = a.spawn > 0 ? 1 - a.spawn : 1; // (rising out of the mud as it spawns)
        o.g.position.set(a.x, ag + (3 + 10 * rise) + Math.sin(t * 2.3) * 1.5, a.y);
        const dx = o.prev ? a.x - o.prevX : 0, dy = o.prev ? a.y - o.prevY : 0;
        if (Math.hypot(dx, dy) > 0.02) o.yaw = Math.atan2(dy, dx);
        (o.prev = true), (o.prevX = a.x), (o.prevY = a.y);
        o.g.rotation.set(Math.sin(t * 1.7) * 0.15, -(o.yaw ?? 0), 0);
        o.g.scale.setScalar(2.2 * Math.max(0.2, rise)); // (about 12 units long: a third of the hero; at 1.25 a speck)
        const flap = Math.sin(lastNow * 90 + a.x) * 0.9;
        for (const wg of o.wings) wg.pivot.rotation.x = wg.sd * (0.35 + flap * 0.5);
        const hit = a.flash > 0 ? 1 : 0;
        o.mats.body.emissive.setHex(hit ? 0xffffff : 0x0a2e22);
        o.mats.thorax.emissive.setHex(hit ? 0xffffff : 0x0c1610);
        o.blob.position.set(a.x, ag + 0.08, a.y);
        continue;
      }
      const set = ART.add[a.type];
      if (!set) continue;
      const dying = !a.alive;
      if (dying && a.dying > 0.4) continue;
      if (dying && a.type === "fly" && bossFor === "gnasher") continue; // (its squish is particles: case "pop")
      if (a.type === "ember") continue; // (Sister Cinder's embers are balls of fire, cinder3d.js; their 2D cards stood flat and blocky)
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
      const ag = floorAt(a.x, a.y); // (the ground there: the Ash Floor's stairs and altar, floorh3d.js)
      o.g.position.set(a.x, ag + 6 + lift, a.y);
      o.blob.position.set(a.x, ag + 0.08, a.y);
    }
    for (; i < adds.length; i++) adds[i].g.visible = adds[i].blob.visible = false;
    for (; fi < flies3d.length; fi++) (flies3d[fi].g.visible = flies3d[fi].blob.visible = false), (flies3d[fi].prev = false);
    let j = 0;
    for (const s of w.shots) {
      if (s.dead) continue;
      const o = shotAt(j++);
      // Near the edge it fades out (4.11): from where it stops being able to hurt (r 116 plus its
      // radius) to R + 10, where the sim drops it, so it is gone before it would fly into a wall (on a
      // shaped floor, sim/arena.js, from its edge to where the sim drops it there).
      const sr = s.r || 6;
      if (s.art === "ember") {
        // (a fireball — hers or the hero's Firebolt — is fire, drawn by cinder3d.js: not a ball, not a shadow under it)
        o.m.visible = o.blob.visible = false;
        continue;
      }
      const k = clamp(1 - (w.arena.out(s.x, s.y) + (ARENA.R - R_SEEN) - sr) / (w.shotSpan + (ARENA.R - R_SEEN) - sr), 0, 1);
      if (o.m.material.uniforms) o.m.material.uniforms.uA.value = k;
      else o.m.material.opacity = k;
      o.blob.material.opacity = o.blob.userData.baseOpacity * k;
      o.m.visible = o.blob.visible = k > 0.01;
      const r = (s.r || 6) * 0.6;
      const sg = floorAt(s.x, s.y);
      if (s.art === "bog") {
        // (the goo: stretched along its flight, wobbling, bobbing a little; drips falling off behind it)
        const t = lastNow * 9 + (s.spin || 0);
        const wob = 0.1 * Math.sin(t);
        o.m.scale.set(r * (1.22 + wob), r * (0.92 - wob * 0.6), r * (0.95 - wob * 0.4));
        o.m.rotation.set(0, -Math.atan2(s.vy || 0, s.vx || 1), 0);
        o.m.position.set(s.x, sg + 5 + Math.sin(t * 0.7) * 0.6, s.y);
        const seen = shotSeen.get(s);
        if (seen) (seen[0] = s.x), (seen[1] = s.y), (seen[2] = s.art);
        else shotSeen.set(s, [s.x, s.y, s.art]);
        const dt0 = (dripT.get(s) ?? 0) - frameDt;
        if (dt0 <= 0 && k > 0.3) {
          P(s.x, s.y, 1, { speed: 4, life: 0.5, cols: GOO, grav: 260, vz: -6, z: 5 / H_TO_3D, size: (u) => 0.9 + u * 0.9, drag: 0.9, kind: "water" });
          dripT.set(s, 0.05 + parts.rand() * 0.05);
        } else dripT.set(s, dt0);
      } else {
        o.m.scale.setScalar(r);
        o.m.position.set(s.x, sg + 5, s.y);
      }
      o.blob.position.set(s.x, sg + 0.08, s.y);
    }
    // (a glob that ended without hitting him — out of time, off the floor — splats where it was last)
    for (const [s, [x, y, art]] of shotSeen) {
      if (w.shots.includes(s) && !s.dead) continue;
      shotSeen.delete(s);
      dripT.delete(s);
      if (!s.hitDone && art === "bog" && w.arena.out(x, y) < 6) gooSplat(x, y, 0.7);
    }
    for (; j < shots.length; j++) shots[j].m.visible = shots[j].blob.visible = false;
  }

  // --- the frame -------------------------------------------------------------------------------------------
  // (the shadow casters' records, the same each frame: shadow3d.js reads them at once)
  const casters = [];
  const casterHero = { objects: [null, null], at: [0, 0, 0], h: HERO_H, r: HERO_H * 0.95 };
  const casterBoss = { objects: [null, null, null], at: [0, 0, 0], h: 0, r: 0 };
  const pv = new Vector3();
  let badFrames = 0;
  const frameTimes = [];
  let lastT = 0;
  // The shaders compile in the background while the name card is up (M9): until they are ready
  // the intro's frames are skipped, so the card's own animation never stalls on a shader link.
  // And the first frames of any fight wait for them too, up to PREWARM_WAIT (2026-10-21, the owner: "check into why it is loading
  // so slow"): the first frame's warm-up (warm) builds every program the fight will use, and three.js waits on each one's link
  // as it first draws with it — one after another, 0.95 s on this PC and ~4.5 s at a phone's speed (tools/loadtime.mjs CPU 4,
  // the page frozen meanwhile). prewarm() now asks for those same programs first, all at once (KHR_parallel_shader_compile,
  // three.js compileAsync), and the warm-up then finds them linked. A fight frame past the wait never waits; it draws,
  // compiling whatever is left.
  let compiled = false;
  const PREWARM_WAIT = 8000;
  let compileFrom = 0;
  // (begun by the first draw, once ensureArena has said what this fight shows: on a painted arena the garden is hidden and
  // not built, and the sun casts no shadow there — begun at once, the hidden garden was compiled and every lit shader built
  // for a sun shadow it no longer had)
  let startCompile = null;
  const ready = new Promise((go) => (startCompile = go))
    .then(() => prewarm())
    .catch((err) => console.error("3D view: prewarm failed", err))
    // The garden's textures upload now too (plan 9.6, critique #4), not on the first intro frame,
    // which the tier monitor measures — only when it shows (under a painted arena it never does: ensureArena uploads them
    // if one later lets it show).
    .then(() => {
      if (arenaKnown && garden.group.visible) uploadGardenTex();
      else gardenTexPending = true;
    })
    .then(() => {
      compiled = true;
      warmStats.asyncPrograms = gl.info.programs?.length ?? null;
      warmStats.compiled = Math.round(performance.now());
    });
  // (for the load checks, tools/loadtime.mjs: programs built by the background compile, then by the first frame's warm-up and how
  // long it held the page)
  const warmStats = (globalThis.__warmStats = { asyncPrograms: null, warmMs: null, warmPrograms: null, made: Math.round(performance.now()), from: null, compiled: null, drawn: null });
  let gardenTexPending = false, gardenTexDone = false;
  function uploadGardenTex() {
    gardenTexPending = false;
    if (gardenTexDone) return;
    gardenTexDone = true;
    for (const t of paint?.textures || [])
      try {
        gl.initTexture(t);
      } catch {
        // left to the first frame that draws it
      }
  }
  function draw(w, cam, now) {
    if (startCompile) {
      try {
        ensureArena(w);
        // (the frame's own targets made now, at the frame's own size, so the programs are built for what they draw into)
        fitCamera(cam);
        const f0 = cameraFrame(cam, editView ? 1 : texelFactor(cam, { override: texel ?? debug.texel ?? null }));
        post.ensure(f0.W, f0.H);
      } catch (err) {
        console.error("3D view: arena", err);
      }
      compileFrom = performance.now();
      warmStats.from = Math.round(compileFrom);
      startCompile();
      startCompile = null;
    }
    // (the game's fight holds its first frames for them — fight.js `holdForPrograms`; the benches draw their staged ticks at once)
    if (!compiled && (w.state === "intro" || (holdForPrograms && performance.now() - compileFrom < PREWARM_WAIT))) return;
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
  // A weapon equipped after the warm-up (hero3d.js equip, from his tree's change — shadow3d.js watchTree): its paint built
  // see-through too, there and then, as warm() does for the rest of him — else its first i-frame blink (hero3d.js turns his
  // paint transparent only while it blinks) built that shader mid-fight, a one-off stall
  const heroSeen = new WeakSet(); // (his paint materials already built see-through)
  let heroGen = -1;
  function warmHeroNew() {
    if (!heroModel || warmedFor == null || heroGen === treeGeneration()) return;
    watchTree(heroModel.object);
    heroGen = treeGeneration();
    const fresh = [];
    heroModel.object.traverse((o) => {
      for (const m of [o.material].flat()) if (m?.userData?.paint && !m.transparent && !heroSeen.has(m)) heroSeen.add(m), fresh.push(m);
    });
    if (!fresh.length) return;
    for (const m of fresh) m.transparent = true;
    const was = gl.getRenderTarget();
    try {
      // (into the scene's target, as the frame draws him: its colour space is part of the shader — compiled for the screen it
      // was another one, and the blink still built its own)
      gl.setRenderTarget(post.scene);
      gl.compile(heroModel.object, camera, scene);
    } catch (err) {
      console.error("3D view: weapon warm-up failed", err);
    } finally {
      // (put back as warm() puts back the rest of him — no needsUpdate: switched back to an opaque program at once, the
      // see-through one was used by nothing and three.js let it go; measured, the blink then built both again)
      for (const m of fresh) m.transparent = false;
      gl.setRenderTarget(was);
    }
  }
  /** What the warm-up leaves hidden (see warmInner): the garden under a painted arena, the 30° picture, a painted arena's bell. */
  function warmSkip() {
    const skip = new Set();
    if (arenaHasBackdrop || debug.garden === 0) skip.add(garden.group);
    if (arenaHasBackdrop) skip.add(life.mesh).add(life.glow);
    if (refBd && backdrop) {
      skip.add(backdrop.main).add(backdrop.glow);
      for (const o of backdropFx.objects.slice(0, -2)) skip.add(o);
    }
    if (refBell && bell3d) skip.add(bell3d.group);
    if (heroModel) skip.add(hero);
    if (bossModel) skip.add(toadBody);
    return skip;
  }
  /**
   * The warm-up's programs asked for in the background, all at once: the same drawables (warmSkip's left out), each pass as the
   * warm-up and the first frame draw it — the scene into post.scene with every layer, again with only layer 1 and only layer 2
   * (warm's), the glow pass (layer 1, into post.emissive, its own light state) and the fade pass (layer 2, post.fade), the
   * marks into post.decal — the hero's paint see-through as warm() builds it too. three.js builds each program without
   * waiting (compile), then lets the driver link them side by side (compileAsync's KHR_parallel_shader_compile). Only the
   * shadow passes' depth programs are left to warm(): compile has no shadow pass.
   */
  function prewarm() {
    if (!gl.compileAsync || !post.scene) return null;
    const skip = warmSkip();
    const draws = (root, layer) => {
      const out = [];
      const visit = (o) => {
        if (skip.has(o)) return;
        if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && (layer == null || o.layers.isEnabled(layer))) out.push(o);
        for (const c of o.children) visit(c);
      };
      visit(root);
      const g = new Group();
      g.children = out; // (a list for compile to walk, not a parent: nothing is moved)
      return g;
    };
    const see = [];
    heroModel?.object.traverse((o) => {
      for (const m of [o.material].flat()) if (m?.userData?.paint && !m.transparent) (m.transparent = true), see.push(m);
    });
    const was = gl.getRenderTarget(), layers = camera.layers.mask, jobs = [];
    try {
      gl.setRenderTarget(post.scene);
      camera.layers.enableAll();
      jobs.push(gl.compileAsync(draws(scene), camera, scene));
      for (const layer of [1, 2]) {
        camera.layers.set(layer);
        jobs.push(gl.compileAsync(draws(scene, layer), camera, scene));
      }
      gl.setRenderTarget(post.emissive);
      camera.layers.set(1);
      jobs.push(gl.compileAsync(draws(scene, 1), camera, passView(scene, "glow")));
      gl.setRenderTarget(post.fade);
      camera.layers.set(2);
      jobs.push(gl.compileAsync(draws(scene, 2), camera, passView(scene, "fade")));
      gl.setRenderTarget(post.decal);
      camera.layers.enableAll();
      jobs.push(gl.compileAsync(draws(marks.scene), camera, marks.scene));
    } finally {
      for (const m of see) m.transparent = false;
      camera.layers.mask = layers;
      gl.setRenderTarget(was);
    }
    return Promise.all(jobs);
  }
  function warm() {
    const t0 = performance.now(), p0 = gl.info.programs?.length ?? 0;
    try {
      warmInner();
    } finally {
      warmStats.warmMs = Math.round(performance.now() - t0);
      warmStats.warmPrograms = (gl.info.programs?.length ?? 0) - p0;
      warmStats.drawn = Math.round(performance.now());
    }
  }
  function warmInner() {
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
    // (but not what stays hidden by design: under a painted arena the garden and its pollen, the hidden 30° picture and its
    // painted flames and fog (the image camera's), the garden's 3D bell where the painting has its own, the placeholder hero
    // and toad — shown here, each one's shaders were built and its textures sent to the GPU, the garden's
    // atlas and the 30° picture's 20-50 MB, for nothing)
    const skip = warmSkip();
    const all = (root) => {
      const visit = (o) => {
        if (skip.has(o)) return;
        shown.push([o, o.visible, o.frustumCulled]);
        o.visible = lit.has(o) ? lit.get(o) : true;
        o.frustumCulled = false;
        for (const c of o.children) visit(c);
      };
      visit(root);
    };
    all(scene);
    all(marks.scene);
    heroModel?.object.traverse((o) => {
      for (const m of [o.material].flat()) if (m?.userData?.paint && !m.transparent) (m.transparent = true), see.push(m), heroSeen.add(m);
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
    ensureArena(w);
    const { w: vw, h: vh } = fitCamera(cam);
    const dt = Math.max(0, Math.min(0.1, now - lastNow));
    frameDt = dt;
    lastNow = now;
    hurtFlash = Math.max(0, hurtFlash - dt * 4);
    healFlash = Math.max(0, healFlash - dt * 1.8);

    // (the edit mode draws the map at the screen's own resolution: the fight's low-resolution look made it blocks on a phone)
    const k = editView ? 1 : texelFactor(cam, { override: texel ?? debug.texel ?? null });
    const f = cameraFrame(cam, k);
    post.ensure(f.W, f.H);
    camera = ortho;
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
    camera = ortho;
    cam.proj = null;
    fig.uFigOn.value = campRef ? 1 : 0; // (his one-figure depth, figWrap: the camp only)
    if (!campRef) shadows.recv = null;
    if (refBd) refFrame(cam, f, vw, vh, w, dt);
    else if (campRef) campFrame(cam, f, vw, vh, w, dt);
    else if (debug.closeup) closeCamera(debug.closeup, w, f);
    wind.step(dt);
    look.uWind.value.set(0.946, 0.324, wind.gust, now);
    look.uTexelWorld.value = (f.right - f.left) / f.W; // one low-resolution texel, in world units
    // The pool of sun sits on the hero (his in-between position: fight.js lerps the world before
    // drawing), the dapples drift.
    lights.update(w.player.x, w.player.y, now);

    gl.info.reset();
    // The garden: the flames flicker, and the lantern light term follows them (docs/3D-PLAN.md 4.10).
    // (not under a pre-rendered arena, which hides them both and lights the characters with its own fires)
    if (!arenaHasBackdrop) {
      garden.update(now);
      life.update(dt, now);
    }
    backdrop?.update(camera, now);
    if (backdrop) {
      backdropFx.update(now);
      refFlames?.update(now);
      // sparks lifting off the fire bowls now and then (the drifting embers everywhere: backdrop3d.js; the image camera's
      // live fires throw their own)
      emberT = refFlames ? 0 : emberT + dt;
      while (emberT > 0.16) {
        emberT -= 0.16;
        const fire = backdrop.fires[Math.floor(emberRand() * backdrop.fires.length)];
        if (fire) sparks.rise(fire[0], fire[2], 6, 1, { h: fire[1] + 6, up: 26, life: 2.2, size: 1.3, palette: GLINT.gold });
      }
    }
    // (a pre-rendered arena's fire bowls light the characters; the image camera's live fires, flickering with their flames)
    const lamps = refFlames ? refFlames.lanterns(now) : backdrop ? backdrop.lanterns : garden.lanterns;
    look.uLantCount.value = Math.min(8, lamps.length);
    const lit = TIERS[tierName].lanterns;
    // (lit: the `lit` nearest the camera's aim — ranked in place, as the stable sort by distance ranked them, ties by index;
    // the map / sort / slice made five arrays and a pair per lamp each frame)
    if (lampD.length < lamps.length) lampD = new Float64Array(lamps.length);
    for (let j = 0; j < lamps.length; j++) lampD[j] = Math.hypot(lamps[j].x - f.target[0], lamps[j].z - f.target[2]);
    for (let i = 0; i < look.uLantCount.value; i++) {
      let rank = 0;
      for (let j = 0; j < lamps.length; j++) if (lampD[j] < lampD[i] || (lampD[j] === lampD[i] && j < i)) rank++;
      const want = rank < lit ? 1 : 0;
      lantOn[i] = want > lantOn[i] ? Math.min(want, lantOn[i] + dt / 0.3) : Math.max(want, lantOn[i] - dt / 0.3);
      const l = lamps[i];
      look.uLant.value[i].set(l.x, l.y, l.z, l.w * lantOn[i]);
    }
    heroModel?.setView(f.W, f.H);
    chest3d.setView(f.W, f.H);
    bossModel?.setView(f.W, f.H);
    poseHero(w, now);
    warmHeroNew();
    if (bellPending) bellFlecks(bellPending), (bellPending = null);
    if (ghosts.length) {
      // (only when he is mostly hidden — two thirds of him and more, behind a house or a stall: behind a rail, a post, a lantern or a
      // cloth he shows through its gaps and round it, and the tint over them only muddied the cut-out)
      const want = campRef && heroModel.object.visible ? 0.35 * Math.min(1, Math.max(0, (campHide(w.player.x, w.player.y) - 0.65) / 0.15)) : 0;
      ghostA.value += (want - ghostA.value) * Math.min(1, dt / 0.12);
      // (in the camp the see-through is the overlay's: camp3d.js lets ghostA of him show through what stands in front of him;
      // the tinted silhouette is for painted arenas without a cut-out)
      for (const [g, o] of ghosts) g.visible = !backdrop?.meta?.view && ghostA.value > 0.03 && o.visible && heroModel.object.visible;
    }
    poseToad(w, now);
    bell3d?.update(w, now);
    // (a painted bell of the arena's own takes the garden's place: the 3D one stays hidden)
    refAnswer?.update(now);
    if (refBell) {
      refBell.update(now);
      if (bell3d) bell3d.group.visible = false;
    }
    if (geysers) {
      geysers.update(w, now, dt);
      if (!bogLife) refBd?.setRipples(geysers.ripples()), refBd?.setShocks?.(geysers.shocks());
    }
    if (bogLife) {
      bogLife.update(w, now, dt);
      refBd?.setRipples(bogLife.ripples(now));
      refBd?.setShocks?.(bogLife.shocks(now));
    }
    chest3d.update(w, now, camera);
    glints(w, now);
    sparks.update(now);
    poseAddsAndShots(w);
    if (bossFor === "king") kingChain.update(w, toadAt.x, toadAt.y, dt, !!bossModel?.object.visible);
    {
      const c = cinderCtx;
      c.camera = camera;
      c.bone = bossModel?.boneAt ? cinderBone : null;
      c.bx = toadAt.x;
      c.by = toadAt.y;
      c.clip = bossModel?.record?.key || "idle";
      c.hero = w.player;
      c.intro = w.state === "intro" ? lerp.stateT(w) / FIGHT.intro : null; // (her rise out of the fire: a fight with no opening — hers never enters "intro")
      c.stateT = lerp.stateT(w);
      c.cinder = bossFor === "cinder";
      cinderFx.update(w, now, c);
    }
    if (now < heroGooT && w.player && !w.player.dead) {
      gooDripT -= dt;
      if (gooDripT <= 0) {
        gooDripT = 0.06;
        const p = w.player;
        P(p.x + (parts.rand() - 0.5) * 6, p.y + (parts.rand() - 0.5) * 4, 1, { speed: 3, life: 0.45, cols: GOO, grav: 300, vz: -4, z: 8 + parts.rand() * 10, size: (u) => 0.9 + u * 0.8, drag: 0.9, kind: "water" });
      }
    }
    poseCritters(w, dt);
    // (the grip's close look aimed again now the hero is posed: from last frame's pose it trailed the grip)
    if (debug.closeup?.focus === "grip") closeCamera(debug.closeup, w, f);
    partMesh.update(parts);
    dbg.update(w, debug.showHitboxes);

    // Which props fade this frame (fade3d.js): every one not fully opaque is dropped from the main
    // pass through the mask and drawn on the fade layer at its own opacity.
    const targets = debug.fade === 0 || debug.empty || backdrop ? 0 : fadeTargets(garden.fadeGroups, w, { toadR: TOAD_R, toad: w.boss ? toadAt : null, aim: aimPreview?.(), hazAt: (h) => lerp.hazard(h) });
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
      gl.render(passView(scene, "fade"), camera); // (its own light state: passview.js)
      gl.shadowMap.autoUpdate = sw;
      camera.layers.set(0);
      look.uFadeMode.value = 0;
      // Unbound again: left bound, the next main pass (which writes that depth) would read it too —
      // a feedback loop, and WebGL drops every draw that has it bound.
      look.tSceneDepth.value = null;
    }

    // The hero's and the boss's projected shadows, from this frame's depth (shadow3d.js)
    casters.length = 0;
    if (heroModel?.object.visible && !debug.empty) {
      heroModel.object.getWorldPosition(pv);
      const c = casterHero;
      (c.objects[0] = heroModel.object), (c.objects[1] = heroModel.cape?.mesh);
      (c.at[0] = pv.x), (c.at[1] = pv.y), (c.at[2] = pv.z);
      casters.push(c);
    }
    if (bossModel?.object.visible && w.boss && !debug.empty) {
      const bo = bossModel.object;
      if (bo.userData.shadowSize?.of !== bo) bo.userData.shadowSize = { of: bo, ...sizeOf(bo) };
      const sz = bo.userData.shadowSize;
      bo.getWorldPosition(pv);
      const c = casterBoss;
      c.objects[0] = bo;
      // (his chain's links and its anchor, drawn apart from him: kingchain3d.js)
      [c.objects[1], c.objects[2]] = bossFor === "king" ? [kingChain.casters[0] || null, kingChain.casters[1] || null] : [null, null];
      (c.at[0] = pv.x), (c.at[1] = pv.y), (c.at[2] = pv.z);
      (c.h = sz.h), (c.r = Math.max(sz.h, sz.w) * 0.7 + 4);
      casters.push(c);
    }
    if (shadows.params.on) {
      const N = noSunFor, hO = heroModel?.object || null, cM = heroModel?.cape?.mesh || null, bO = bossModel?.object || null;
      if (N.hero !== hO || N.cape !== cM || N.boss !== bO || N.gen !== treeGeneration()) {
        for (const o of [hO, cM, bO]) watchTree(o);
        noSun(hO);
        noSun(cM);
        noSun(bO);
        (N.hero = hO), (N.cape = cM), (N.boss = bO), (N.gen = treeGeneration());
      }
    }
    shadows.render(scene, camera, casters, post.scene.depthTexture, f.W, f.H);
    const cast = shadows.target ? { tex: shadows.target.texture, tint: shadows.params.tint } : null;

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
      gl.render(passView(scene, "glow"), camera); // (its own light state: passview.js)
      partMesh.glowPass(false);
      gl.shadowMap.autoUpdate = shadowsWere;
      camera.layers.set(0);
    }

    gl.setRenderTarget(post.decal);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    // (Gnasher's red ground markings are off — the owner, 2026-10-15: "try and remove the red markings for gnasher, you can
    // keep them so that i can turn them on via Demo mode for testing": his tells are his body, the tongue's wind-up and the
    // ground's ripple where he lands. The settings' Demo mode, `demoMarks`, shows them; the bench shows them unless &demo=0.
    // Friendly marks, the aim line and the shield ring stay.)
    const demoOn = demoMarks ? demoMarks() : debug.demo !== 0;
    const marksOff = bossFor === "gnasher" && !demoOn;
    // (and the Drowned King's geysers: their tell is the water welling in the grate and the floor rippling round it,
    // geyser3d.js — the same rule, their red ring only in Demo mode; his other moves keep theirs)
    const hideMark = marksOff ? (h) => !h.friendly : !demoOn ? (h) => h.tag === "geyser" : null;
    if (!debug.empty && marks.update(w, (h) => lerp.hazard(h), now, aimPreview?.(), w.player, cam.zoom, post.scene.depthTexture, f.W, f.H, hideMark)) gl.render(marks.scene, camera);

    const low = Math.max(0, 1 - w.player.hp / (w.player.hpMax * 0.35));
    const [sx0, sy0, sw0, sh0] = cam.safe();
    // (the image camera: the owner's image is already graded and lit — no grade, vignette or mood colouring over it, only a
    // little bloom from its fires; the hurt edge and heal glow stay, they are the fight's)
    if (refBd || backdrop?.camp) post.finish(f, vw, vh, { hurt: Math.min(0.65, hurtFlash * 1.4 + low * 0.3), heal: healFlash, focus: [sx0 + sw0 / 2, sy0 + sh0 / 2], grade: 0, lift: 0, bloom: bloomOn ? 0.25 : 0, fade: false, mood: {}, vignette: 0, cast });
    else post.finish(f, vw, vh, { hurt: Math.min(0.65, hurtFlash * 1.4 + low * 0.3), heal: healFlash, focus: [sx0 + sw0 / 2, sy0 + sh0 / 2], grade: debug.grade ?? 1, lift: debug.lift ?? 0, bloom: debug.albedo ? 0 : bloomOn && mood?.bloom != null ? mood.bloom : bloomOn, fade: faded, cast, mood, ...(mood?.vignette != null ? { vignette: mood.vignette } : {}), ...(debug.albedo ? { vignette: 0 } : {}) });

    // The tier: at the end of the name card drop one if frames are too slow; in the fight, only
    // cheap cuts (bloom and its glow pass off, then half the shadow map: a new map, no new shaders).
    const verdict = tierMon.frame(performance.now(), w.state === "intro");
    if (fixedTier) {
      // the bench asked for this tier: no drops, no cuts
    } else if (verdict?.drop && TIERS[tierName].next) {
      tierName = TIERS[tierName].next;
      applyTier();
      // (under a pre-rendered arena the garden is never seen: planted again only if it shows again — ensureArena)
      if (arenaHasBackdrop) gardenStale = true;
      else plantGarden();
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
    removeEventListener("resize", cssStale);
    // (the asset's geometry too, as ever: its "dispose" lets go of this renderer's hold on it, and the next renderer, on a new
    // context, uploads it again)
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) for (const m of [].concat(o.material)) m.dispose?.();
      o.customDepthMaterial?.dispose?.(); // (warm's, for the sun's shadow pass)
    });
    // (and the boss let go: his dispose takes the tongue's mouth back, which held the whole old model after the fight)
    bossModel?.dispose?.();
    // (what is not in the scene: the projected shadows' targets and silhouette material, the sun's map, the objects' cover
    // flags, the cards' textures, the brush noise — gl.dispose() below frees none of them)
    shadows.dispose();
    sun.shadow.dispose();
    coverTex.dispose();
    for (const t of texOf.values()) t.dispose();
    for (const t of flipped.values()) t.dispose();
    look.uNoise.value?.dispose?.();
    lights.dispose();
    // (the module-wide things this renderer set, put back — unless a newer renderer has them now: liveRenderer)
    if (liveRenderer === self) {
      liveRenderer = null;
      VIEW.ky = KY;
      setFloorHeights(null);
      tongueFloor.out = null;
      if (globalThis.__shadows === shadows) globalThis.__shadows = null;
      if (globalThis.__bogLife === bogLife) globalThis.__bogLife = null;
      if (globalThis.__cinderFx === cinderFx) globalThis.__cinderFx = null;
    }
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
    /** True while a fight's first frames wait for its programs (prewarm, up to PREWARM_WAIT): fight.js holds the fight meanwhile. */
    warming: () => holdForPrograms && !compiled && (!compileFrom || performance.now() - compileFrom < PREWARM_WAIT),
    /** Stop holding frames for the programs (a check's or film's ticks drawn at once: camp2.js __camp2.tick). */
    noHold: () => (holdForPrograms = false),
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
    /** The image camera's crop this frame ({ x0, y0, w, h } in the image's pixels, the whole render target), or null: for the checks. */
    get refCrop() {
      if (campEase?.crop) return { ...campEase.crop };
      if (!refBd) return null;
      const [x0, y0, w, h] = refBd.main.material.uniforms.uCrop.value;
      const [W, H] = refBd.main.material.uniforms.uTarget.value;
      return { x0, y0, w, h, W, H };
    },
    /**
     * The edit mode (ui/mapedit.js): the map drawn now — its id, image size, depth grid (its image and the edit planes) — or
     * null; its own view; its layers and tint; a part of a layer sent to the GPU.
     */
    mapEdit: {
      get info() {
        const bd = assets.backdrops?.[backdropFor];
        if (!bd) return null;
        if (refBd) return { id: bd.id, kind: "ref", IW: refBd.ref.image.w, IH: refBd.ref.image.h, depthImage: bd.editDepth?.image, bd };
        if (backdrop?.camp && campRef) return { id: bd.id, kind: "camp", IW: campRef.image.w, IH: campRef.image.h, depthImage: bd.editDepth?.image, bd };
        return null;
      },
      setView(v) {
        editView = v ? { ...v } : null;
      },
      /** A point on the ground (game units; `up` above it) in the map's image (its pixels), through the image camera. */
      toImage(gx, gy, up = 0) {
        const r = refBd ? refBd.ref : campRef;
        if (!r) return null;
        refV.set(gx, floorAt(gx, gy) + up, gy).applyMatrix4(pcam.matrixWorldInverse).applyMatrix4(refFull);
        return [((refV.x + 1) / 2) * r.image.w, ((1 - refV.y) / 2) * r.image.h];
      },
      setLayers(cov, dep, show) {
        (refBd || backdrop)?.setEdit?.(cov, dep, show);
      },
      /** (Camp 2.0) the ground point (sim x, y) seen at image px (ix, iy), on the ground the hero walks on. */
      toGround(ix, iy) {
        return campRef || refBd ? imgToGround(ix, iy) : null;
      },
      /** (Camp 2.0) whether an object of the blue covers him where he stands now (campCover): one without a line always does. */
      covers(id) {
        return coverOn.get(id) ?? true;
      },
      /** (Camp 2.0) the petals made again from the map's trees and the owner's painted places (bd.fxEdit, fxedit.js). */
      refreshPetals() {
        const bd = assets.backdrops?.[backdropFor];
        if (!bd?.camp || !backdropFx) return;
        scene.remove(...backdropFx.objects);
        backdropFx.dispose();
        backdropFx = makeCampFx(bd);
        scene.add(...backdropFx.objects);
      },
      /** The hero was put down somewhere new (the edit mode's test hero): his feet start afresh there. */
      heroMoved() {
        heroSnap = true;
      },
      /** Rows y0..y1 (all columns) of a DataTexture already on the GPU, sent again: a full upload of 20 MB each stroke stalled. */
      upload(tex, y0, y1) {
        const p = gl.properties.get(tex);
        const ctx = gl.getContext();
        if (!p.__webglTexture || tex.version === 0 || p.__version !== tex.version) {
          tex.needsUpdate = true;
          return;
        }
        const { width: W, data } = tex.image;
        const ch = tex.format === RGBAFormat ? 4 : 2;
        y0 = Math.max(0, y0 | 0);
        y1 = Math.min(tex.image.height, Math.ceil(y1));
        if (y1 <= y0) return;
        gl.state.bindTexture(ctx.TEXTURE_2D, p.__webglTexture);
        ctx.pixelStorei(ctx.UNPACK_ALIGNMENT, 1);
        ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
        ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        ctx.texSubImage2D(ctx.TEXTURE_2D, 0, 0, y0, W, y1 - y0, ch === 4 ? ctx.RGBA : ctx.RG, ctx.UNSIGNED_BYTE, data.subarray(y0 * W * ch, y1 * W * ch));
      },
    },
    get usingGL() {
      return true;
    },
    get buffer() {
      return null;
    },
    /** For the bench and the tests. */
    three: { gl, scene, camera, post, look },
    /** For the checks: the garden re-planted as a tier drop does it, and whether it shows now. */
    replantGarden() {
      plantGarden();
      return garden.group.visible;
    },
  };
}
