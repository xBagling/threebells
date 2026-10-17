// The Bog Shrine alive (the owner, 2026-10-14: "work on details on the bog such as particles when running in the small water
// pools on the arena, and maybe some small swinging of the treetops etc, be creative and make it feel alive, maybe some small
// critters like birds that sit on some stones and fly away etc"). What the painting cannot do itself:
//   - splashes: a foot, a roll or Gnasher coming down in the clearing's pools throws water drops and rings out on the water
//     (the rings are drawn in the painting's own water by backdrop3d.js, uRip; here only where and when)
//   - now and then a fish rings the swamp's surface
//   - birds on the pillars, statues and stones (bog.json life.perches, tools/bog/life.py): they look about, hop, peck, and
//     take off when the hero comes running, the boss lands or the bell rings, fly off out of the picture and later come
//     back in to a free perch, gliding and flaring to land
//   - frogs on the lily pads (life.lilies): they puff their throats, and hop into the water as he comes near, to surface
//     again a while later
//   - dragonflies darting and hovering over the water
// Only the view: nothing here reaches the sim, and its own random (never Math.random's) drives it. The critters are small
// models lit by the scene's lights, drawn through the image camera and hidden by the painting's per-pixel depth as the hero is.
import { Group, Mesh, SphereGeometry, BoxGeometry, CylinderGeometry, PlaneGeometry, MeshLambertMaterial, MeshBasicMaterial, DoubleSide, Vector3 } from "./three-lib.js?v=79a60b0-466c2a40";
import { rng } from "../util.js?v=79a60b0-466c2a40";
import { sfx } from "../audio.js?v=79a60b0-466c2a40";

const TAU = Math.PI * 2;
const WATER_Y = -4; // (tools/bog/depth.py WATER: the swamp round the clearing; its own pools lie at the grass's 0)

/**
 * `bd`: the loaded backdrop (meta.life, refLife). `opts.burst(x, y, n, o)`: the particles (sim x, y on the ground).
 * Returns { objects, update(w, now, dt), wet(x, y), splash(x, y, k), startle(x, y, r), ripples(now) } — or null.
 */
export function makeBogLife(bd, { burst } = {}) {
  const L = bd?.meta?.life, r = bd?.meta?.ref;
  if (!L || !r || !bd.refLife) return null;
  const rand = rng(0x5eed);
  const IW = r.image.w, IH = r.image.h;
  const f = IH / 2 / Math.tan((r.vfov * Math.PI) / 180 / 2);
  const P = new Vector3(...r.pos), RV = new Vector3(...r.right), UV = new Vector3(...r.up), BK = new Vector3(...r.back);
  const tmp = new Vector3();
  /** A world point -> the picture's pixel. */
  const toImg = (x, y, z) => {
    tmp.set(x, y, z).sub(P);
    const zc = -tmp.dot(BK);
    return [IW / 2 + (tmp.dot(RV) / zc) * f, IH / 2 - (tmp.dot(UV) / zc) * f];
  };
  /** A pixel of the picture -> where its ray meets the level y. */
  const toLevel = (px, py, y) => {
    const a = (px - IW / 2) / f, b = -(py - IH / 2) / f;
    const d = new Vector3().copy(BK).multiplyScalar(-1).addScaledVector(RV, a).addScaledVector(UV, b);
    const t = (y - P.y) / d.y;
    return new Vector3().copy(P).addScaledVector(d, t);
  };

  // --- the water's mask, on the CPU: whether a foot is in a pool -------------------------------------------------------
  // (read back once a page and kept on the backdrop: its 1404 x 1536 pixels were drawn to a canvas and read back at every Bog
  // fight's start)
  if (bd.refLifeMask === undefined) {
    try {
      const im = bd.refLife.image;
      const cv = document.createElement("canvas");
      cv.width = im.width;
      cv.height = im.height;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      cx.drawImage(im, 0, 0);
      bd.refLifeMask = { w: im.width, h: im.height, px: cx.getImageData(0, 0, im.width, im.height).data };
    } catch {
      bd.refLifeMask = null;
    }
  }
  const mask = bd.refLifeMask?.px || null, mw = bd.refLifeMask?.w || 0, mh = bd.refLifeMask?.h || 0;
  const waterAt = (px, py) => {
    if (!mask) return 0;
    const x = Math.round((px / IW) * mw), y = Math.round((py / IH) * mh);
    if (x < 0 || y < 0 || x >= mw || y >= mh) return 0;
    return mask[(y * mw + x) * 4] / 255;
  };
  // (the swamp's open water, for the fish: a spread of its pixels, none in the clearing)
  const fishAt = [];
  if (mask) for (let k = 0; k < 4000 && fishAt.length < 400; k++) {
    const px = rand() * IW, py = rand() * IH;
    if (waterAt(px, py) > 0.9 && waterAt(px + 12, py) > 0.9 && waterAt(px - 12, py) > 0.9 && waterAt(px, py + 6) > 0.9 && waterAt(px, py - 6) > 0.9) {
      const g = toLevel(px, py, WATER_Y);
      if (Math.hypot(g.x, g.z) > 150) fishAt.push([px, py]);
    }
  }

  // --- ripples: rings on the painting's water ----------------------------------------------------------------------------
  const rips = []; // { px, py, t0, k }
  const ripple = (px, py, k, now) => {
    if (rips.length >= 8) rips.shift();
    rips.push({ px, py, t0: now, k });
  };
  let clock = 0;
  // --- shockwaves: the ground rippling round where Gnasher lands (the owner, 2026-10-15: "a small shockwave effect of a
  // rippling effect of the ground around him ... similarly as a waterdrop falling into water ... for the area of the current
  // red ring"): the landing's circle (radius r, world units) seen in the picture as an ellipse — its half axes from the circle's
  // points round it — and the time it started; backdrop3d.js refFrag ripples the painted ground inside it
  const shocks = []; // { cx, cy, rx, ry, t0, sweep }
  const shock = (x, y, r, sweep = 0.42) => {
    const [cx, cy] = toImg(x, 0, y);
    let rx = 1, ry = 1;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU, [qx, qy] = toImg(x + Math.cos(a) * r, 0, y + Math.sin(a) * r);
      rx = Math.max(rx, Math.abs(qx - cx));
      ry = Math.max(ry, Math.abs(qy - cy));
    }
    if (shocks.length >= 2) shocks.shift();
    shocks.push({ cx, cy, rx, ry, t0: clock, sweep });
  };

  // --- splashes ----------------------------------------------------------------------------------------------------------
  const DROP = ["#cfe6ec", "#9cc4cf", "#e9f6f8", "#7aa7b4"];
  let splashes = 0;
  // (their sounds, audio.js: each kind at most once a gap, so a flock or a run through a pool is one sound, not a pile)
  const lastSnd = {};
  const snd = (name, gap) => clock - (lastSnd[name] ?? -9) >= gap && ((lastSnd[name] = clock), sfx[name]());
  function splash(x, y, k = 1, h = 0) {
    splashes++;
    snd(k >= 1.5 ? "splashBig" : "wade", k >= 1.5 ? 0.3 : 0.12);
    const [px, py] = toImg(x, h, y);
    ripple(px, py, Math.min(1, 0.45 + 0.4 * k), clock);
    if (!burst) return;
    const n = Math.round(9 * k);
    // (a crown of drops round where it broke the water, a few thrown higher from its middle; their speed up x 0.71: half as high,
    // the owner, 2026-10-14: "Make the water splashes the half height of what it is today")
    burst(x, y, n, { speed: 30 * k, spread: TAU, life: 0.5, cols: DROP, grav: 520, vz: (70 + 40 * k) * 0.71, z: h + 1, size: (u) => 0.7 + u * 0.9, drag: 0.94, kind: "water" });
    burst(x, y, Math.round(4 * k), { speed: 10, spread: TAU, life: 0.45, cols: ["#e8f4f6", "#bcd9e0"], grav: 520, vz: 110 * k * 0.71, z: h + 1, size: 0.7, drag: 0.9, kind: "water" });
  }
  /** How wet the ground is at a point of the floor (0 dry, 1 a pool). */
  const wet = (x, y, h = 0) => waterAt(...toImg(x, h, y));

  // --- the critters' parts ------------------------------------------------------------------------------------------------
  const geos = [], mats = [];
  const G = (g) => (geos.push(g), g);
  const M = (c, o = {}) => {
    const m = new MeshLambertMaterial({ color: c, ...o });
    mats.push(m);
    return m;
  };
  const sphere = G(new SphereGeometry(1, 12, 9)), box = G(new BoxGeometry(1, 1, 1)), cone = G(new CylinderGeometry(0, 1, 1, 8)), cyl = G(new CylinderGeometry(1, 1, 1, 8));
  const part = (geo, mat, [sx, sy, sz], [x, y, z], parent) => {
    const m = new Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const root = new Group();
  root.name = "bog-life";

  // Birds: a songbird each (a brown wren, a blue kingfisher, a dun sparrow) — made crow-sized, 4.9 units nose to tail: at a
  // songbird's own 2.6 they were 6 screen pixels beside a hero of 45 and read as nothing (frogs and dragonflies the same)
  // (birds smaller, 2026-10-15: "The birds can be a bit smaller")
  const SIZE = { bird: 1.45, frog: 1.6, fly: 1.5 };
  const BIRD_LOOKS = [
    { back: 0x6b4a2e, belly: 0xc9a37a, head: 0x5a3d26, beak: 0x2a2018 },
    { back: 0x2f6fa8, belly: 0xd9874a, head: 0x2a5f93, beak: 0x1a1a1a },
    { back: 0x8a7458, belly: 0xd8c8a8, head: 0x6e5a40, beak: 0x3a2e20 },
  ];
  const eyeMat = M(0x101010);
  function makeBird(look) {
    const g = new Group(), body = new Group();
    g.add(body);
    const mb = M(look.back), mbel = M(look.belly), mh = M(look.head), mk = M(look.beak);
    part(sphere, mb, [0.62, 0.58, 1.0], [0, 0.95, 0], body);
    part(sphere, mbel, [0.52, 0.44, 0.8], [0, 0.78, 0.15], body);
    const head = new Group();
    head.position.set(0, 1.45, 0.78);
    body.add(head);
    part(sphere, mh, [0.44, 0.42, 0.46], [0, 0, 0], head);
    const bk = part(cone, mk, [0.1, 0.42, 0.1], [0, -0.05, 0.6], head);
    bk.rotation.x = Math.PI / 2;
    part(sphere, eyeMat, [0.07, 0.07, 0.07], [0.3, 0.1, 0.22], head);
    part(sphere, eyeMat, [0.07, 0.07, 0.07], [-0.3, 0.1, 0.22], head);
    const tail = part(box, mb, [0.42, 0.07, 0.95], [0, 1.05, -1.15], body);
    tail.rotation.x = -0.35;
    const wings = [-1, 1].map((sgn) => {
      const pv = new Group();
      pv.position.set(0.42 * sgn, 1.2, 0.05);
      body.add(pv);
      const w = part(box, mb, [1.25, 0.06, 0.78], [0.6 * sgn, 0, -0.1], pv);
      w.rotation.y = -0.15 * sgn;
      return { pv, sgn };
    });
    part(cyl, mk, [0.05, 0.5, 0.05], [0.18, 0.28, 0.05], body);
    part(cyl, mk, [0.05, 0.5, 0.05], [-0.18, 0.28, 0.05], body);
    root.add(g);
    return { g, body, head, wings };
  }
  // Frogs: squat and olive, gold-eyed, 3 units long
  function makeFrog() {
    const g = new Group(), body = new Group();
    g.add(body);
    const skin = M(0x5c7a2c), belly = M(0xb9b56a), eye = M(0xd6b236), dark = M(0x2c3a14);
    part(sphere, skin, [1.05, 0.62, 1.35], [0, 0.62, 0], body);
    part(sphere, belly, [0.9, 0.4, 1.1], [0, 0.42, 0.18], body);
    const throat = part(sphere, belly, [0.55, 0.35, 0.4], [0, 0.45, 0.95], body);
    for (const sx of [-1, 1]) {
      part(sphere, eye, [0.3, 0.3, 0.3], [0.48 * sx, 1.15, 0.7], body);
      part(sphere, eyeMat, [0.13, 0.17, 0.1], [0.56 * sx, 1.18, 0.88], body);
      const leg = part(sphere, dark, [0.42, 0.28, 0.9], [0.95 * sx, 0.35, -0.55], body);
      leg.rotation.y = 0.5 * sx;
      part(sphere, skin, [0.2, 0.2, 0.42], [0.62 * sx, 0.25, 0.85], body);
    }
    root.add(g);
    return { g, body, throat };
  }
  // Dragonflies: a teal body and four glassy wings, 3.4 units long
  // (forceSinglePass: a see-through two-sided material is otherwise drawn by three.js as its back faces, then its front, the
  // material marked changed twice each draw — its shader worked out again 24 times a frame for these 12 wings. A flat wing
  // shows one side or the other, never both: one pass draws the very same pixels)
  const wingMat = new MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.38, side: DoubleSide, depthWrite: false, forceSinglePass: true });
  mats.push(wingMat);
  const plane = G(new PlaneGeometry(1, 1));
  function makeFly(c) {
    const g = new Group();
    const mb = M(c, { emissive: c, emissiveIntensity: 0.25 });
    const b = part(cyl, mb, [0.13, 3.0, 0.13], [0, 0, -0.4], g);
    b.rotation.x = Math.PI / 2;
    part(sphere, mb, [0.3, 0.28, 0.34], [0, 0, 1.15], g);
    const wings = [];
    for (const z of [0.55, 0.15]) for (const sx of [-1, 1]) {
      const w = part(plane, wingMat, [1.7, 0.36, 1], [0.95 * sx, 0.12, z], g);
      w.rotation.x = -Math.PI / 2;
      wings.push(w);
    }
    root.add(g);
    return { g, wings };
  }

  // --- birds ---------------------------------------------------------------------------------------------------------------
  // (3.5 toward the camera from the perch's own depth: its body, 4.9 long, half sank behind the statue's face at 1.6)
  const perches = (L.perches || []).map((p) => ({ at: new Vector3(...p).addScaledVector(BK, 3.5), bird: null }));
  const birds = [];
  const nBirds = Math.min(9, perches.length);
  const order = perches.map((_, i) => i).sort(() => rand() - 0.5);
  for (let i = 0; i < nBirds; i++) {
    const m = makeBird(BIRD_LOOKS[i % BIRD_LOOKS.length]);
    m.g.scale.setScalar(SIZE.bird);
    const b = { ...m, state: "perch", perch: perches[order[i]], pos: new Vector3(), vel: new Vector3(), yaw: rand() * TAU, t: 0, next: 1 + rand() * 3, flap: rand() * TAU, headYaw: 0, headTo: 0, peck: 0, hop: 0, wait: 0 };
    b.perch.bird = b;
    b.pos.copy(b.perch.at);
    birds.push(b);
  }
  function takeOff(b, fromX, fromZ) {
    if (b.state !== "perch") return;
    const away = new Vector3(b.pos.x - fromX, 0, b.pos.z - fromZ);
    if (away.lengthSq() < 1) away.set(rand() - 0.5, 0, rand() - 0.5);
    away.normalize();
    const a = Math.atan2(away.z, away.x) + (rand() - 0.5) * 0.9;
    b.vel.set(Math.cos(a) * 30, 34, Math.sin(a) * 30);
    if (b.perch) b.perch.bird = null;
    b.perch = null;
    snd("birdsFlee", 0.5);
    b.state = "flee";
    b.t = 0;
  }
  function stepBird(b, w, dt) {
    const p = w.player, sp = Math.hypot(p.vx || 0, p.vy || 0);
    b.t += dt;
    if (b.state === "perch") {
      const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.y);
      const bossNear = w.boss && !w.boss.hidden && Math.hypot(b.pos.x - w.boss.x, b.pos.z - w.boss.y) < 55;
      // (wary: the perches stand 24-80 beyond the edge he can walk to — off at a run within 75, a walk within 50, 28 still)
      const near = d < (sp > 60 ? 75 : sp > 15 ? 50 : 28);
      if (near || bossNear) return takeOff(b, bossNear && !near ? w.boss.x : p.x, bossNear && !near ? w.boss.y : p.y);
      // (idle: look about, now and then peck at the stone or hop round)
      b.next -= dt;
      if (b.next <= 0) {
        const roll = rand();
        if (roll < 0.55) b.headTo = (rand() - 0.5) * 2.0;
        else if (roll < 0.8) b.peck = 0.35;
        else ((b.hop = 0.28), (b.yaw += (rand() - 0.5) * 2.6));
        b.next = 0.5 + rand() * 2.2;
      }
      b.headYaw += (b.headTo - b.headYaw) * Math.min(1, dt * 14);
      b.peck = Math.max(0, b.peck - dt);
      b.hop = Math.max(0, b.hop - dt);
      b.g.position.copy(b.pos);
      b.g.position.y += b.hop > 0 ? Math.sin((b.hop / 0.28) * Math.PI) * 0.9 : 0;
      b.head.rotation.set(b.peck > 0 ? Math.sin((b.peck / 0.35) * Math.PI) * 0.9 : 0, b.headYaw, 0);
      b.body.rotation.x = b.peck > 0 ? Math.sin((b.peck / 0.35) * Math.PI) * 0.25 : 0;
      // (sitting, the wings fold back along the body: spread flat they read as a cross on the stone)
      for (const wg of b.wings) wg.pv.rotation.set(0, 1.35 * wg.sgn, -0.15 * wg.sgn);
      b.g.rotation.y = b.yaw;
      b.g.visible = true;
      return;
    }
    if (b.state === "flee") {
      // (beating hard up and away, then off out of the picture)
      b.vel.y = Math.max(8, b.vel.y - dt * 12);
      const hs = Math.hypot(b.vel.x, b.vel.z);
      const want = Math.min(95, hs + dt * 70);
      b.vel.x *= want / hs;
      b.vel.z *= want / hs;
      b.pos.addScaledVector(b.vel, dt);
      flapPose(b, dt, 13, 1.15);
      if (b.t > 4.5) ((b.state = "gone"), (b.wait = 6 + rand() * 12), (b.g.visible = false));
      return;
    }
    if (b.state === "gone") {
      b.wait -= dt;
      if (b.wait > 0) return;
      // (back in to a free perch well away from the hero, from far off and high)
      const free = perches.filter((q) => !q.bird && Math.hypot(q.at.x - p.x, q.at.z - p.y) > 90);
      if (!free.length) return void (b.wait = 3);
      const q = free[Math.floor(rand() * free.length)];
      q.bird = b;
      b.perch = q;
      const a = rand() * TAU;
      b.from = new Vector3(q.at.x + Math.cos(a) * 190, q.at.y + 70 + rand() * 30, q.at.z + Math.sin(a) * 190);
      b.pos.copy(b.from);
      b.state = "arrive";
      b.t = 0;
      b.dur = 3.2 + rand() * 1.2;
      b.g.visible = true;
      return;
    }
    if (b.state === "arrive") {
      const q = b.perch;
      // (a run in that slows as it nears, a glide, then a flare of quick beats to land)
      if (Math.hypot(q.at.x - p.x, q.at.z - p.y) < 60) {
        q.bird = null;
        b.perch = null;
        snd("birdsFlee", 0.5);
        b.state = "flee";
        b.t = 0;
        b.vel.set(b.pos.x - q.at.x, 20, b.pos.z - q.at.z).setLength(60);
        return;
      }
      const u = Math.min(1, b.t / b.dur), e = 1 - Math.pow(1 - u, 2.2);
      const prev = b.pos.clone();
      b.pos.lerpVectors(b.from, q.at, e);
      b.pos.y += Math.sin(u * Math.PI) * 8;
      b.vel.copy(b.pos).sub(prev).divideScalar(Math.max(dt, 1e-3));
      flapPose(b, dt, u > 0.85 ? 16 : u > 0.45 ? 0 : 11, u > 0.85 ? 1.2 : 0.9);
      if (u >= 1) ((b.state = "perch"), (b.yaw = Math.atan2(b.vel.x, b.vel.z)), (b.next = 0.4), b.pos.copy(q.at));
    }
  }
  function flapPose(b, dt, hz, amp) {
    b.flap += dt * hz * TAU;
    const glide = hz === 0;
    for (const wg of b.wings) wg.pv.rotation.y = 0;
    for (const wg of b.wings) wg.pv.rotation.z = wg.sgn * (glide ? 0.12 + Math.sin(b.flap * 0.05) * 0.05 : Math.sin(b.flap) * amp + 0.25);
    b.g.position.copy(b.pos);
    b.g.position.y += glide ? 0 : Math.sin(b.flap) * 0.25;
    b.yaw = Math.atan2(b.vel.x, b.vel.z);
    b.g.rotation.y = b.yaw;
    b.body.rotation.x = -Math.atan2(b.vel.y, Math.hypot(b.vel.x, b.vel.z)) * 0.6;
    b.head.rotation.set(0, 0, 0);
  }

  // --- frogs -----------------------------------------------------------------------------------------------------------
  const frogs = (L.lilies || []).slice(0, 5).map((p, i) => {
    const m = makeFrog();
    // (a little toward the camera from the pad's own depth: else it sank half into the painting there)
    const at = new Vector3(p[0], Math.max(p[1], WATER_Y) + 0.15, p[2]).addScaledVector(BK, 1.5);
    const fr = { ...m, at, state: "sit", yaw: rand() * TAU, t: 0, next: 1 + rand() * 4, puff: 0, wait: 0, to: new Vector3() };
    fr.g.position.copy(at);
    fr.g.rotation.y = fr.yaw;
    fr.g.scale.setScalar(SIZE.frog * (0.85 + (i % 3) * 0.12));
    return fr;
  });
  function stepFrog(fr, w, dt) {
    const p = w.player;
    fr.t += dt;
    if (fr.state === "sit") {
      const d = Math.hypot(fr.at.x - p.x, fr.at.z - p.y), sp = Math.hypot(p.vx || 0, p.vy || 0);
      const bossNear = w.boss && !w.boss.hidden && Math.hypot(fr.at.x - w.boss.x, fr.at.z - w.boss.y) < 60;
      // (the pads lie 39-76 beyond his edge: a frog goes at his run within 80, within 55 at all)
      const near = d < (sp > 60 ? 80 : 55);
      if (near || bossNear) {
        // (a hop off the pad into the water, away from him)
        const fx = bossNear && !near ? w.boss.x : p.x, fz = bossNear && !near ? w.boss.y : p.y;
        const a = Math.atan2(fr.at.z - fz, fr.at.x - fx) + (rand() - 0.5) * 0.6;
        fr.to.set(fr.at.x + Math.cos(a) * 13, WATER_Y, fr.at.z + Math.sin(a) * 13);
        fr.yaw = Math.atan2(fr.to.x - fr.at.x, fr.to.z - fr.at.z);
        fr.state = "hop";
        fr.t = 0;
        return;
      }
      fr.next -= dt;
      if (fr.next <= 0) ((fr.puff = 0.9), (fr.next = 2 + rand() * 5));
      fr.puff = Math.max(0, fr.puff - dt);
      const pf = fr.puff > 0 ? Math.max(0, Math.sin((fr.puff / 0.9) * Math.PI * 3)) : 0;
      fr.throat.scale.set(0.55 + pf * 0.35, 0.35 + pf * 0.3, 0.4 + pf * 0.25);
      fr.body.scale.y = 1 + Math.sin(fr.t * 2.2) * 0.02;
      fr.g.position.copy(fr.at);
      fr.g.rotation.set(0, fr.yaw, 0);
      fr.g.visible = true;
      return;
    }
    if (fr.state === "hop") {
      const u = Math.min(1, fr.t / 0.42);
      fr.g.position.lerpVectors(fr.at, fr.to, u);
      fr.g.position.y += Math.sin(u * Math.PI) * 6 - u * 1.5;
      fr.g.rotation.set(-0.6 + u * 1.4, fr.yaw, 0);
      if (u >= 1) {
        const [px, py] = toImg(fr.to.x, WATER_Y, fr.to.z);
        ripple(px, py, 0.8, clock);
        // (the drops can't go under the clearing's level, 0 — they start from the point at 0 that looks the same on screen)
        const g0 = toLevel(px, py, 0);
        burst?.(g0.x, g0.z, 7, { speed: 22, spread: TAU, life: 0.45, cols: DROP, grav: 520, vz: 57, z: 0.5, size: 0.8, drag: 0.93, kind: "water" });
        snd("frogPlop", 0.15);
        fr.state = "under";
        fr.wait = 7 + rand() * 10;
        fr.g.visible = false;
      }
      return;
    }
    if (fr.state === "under") {
      fr.wait -= dt;
      if (fr.wait > 0 || Math.hypot(fr.at.x - p.x, fr.at.z - p.y) < 90) return;
      const [px, py] = toImg(fr.at.x, fr.at.y, fr.at.z);
      ripple(px, py, 0.5, clock);
      fr.state = "rise";
      fr.t = 0;
      fr.g.visible = true;
      return;
    }
    if (fr.state === "rise") {
      // (up out of the water onto its pad)
      const u = Math.min(1, fr.t / 0.5);
      fr.g.position.copy(fr.at);
      fr.g.position.y -= (1 - u) * 2.5;
      fr.g.rotation.set(0, fr.yaw, 0);
      if (u >= 1) ((fr.state = "sit"), (fr.next = 1 + rand() * 3));
    }
  }

  // --- dragonflies -------------------------------------------------------------------------------------------------------
  // (over the clearing's pools and the swamp's edge: a spread of water pixels near the clearing, on the water's level)
  const flySpots = [];
  if (mask) for (let k = 0; k < 6000 && flySpots.length < 160; k++) {
    const px = IW * 0.08 + rand() * IW * 0.84, py = IH * 0.15 + rand() * IH * 0.8;
    if (waterAt(px, py) < 0.8) continue;
    const g0 = toLevel(px, py, 0), d0 = Math.hypot(g0.x, g0.z);
    const lvl = d0 < 130 ? 0 : WATER_Y;
    const g = toLevel(px, py, lvl);
    if (Math.hypot(g.x, g.z) < 260) flySpots.push(g);
  }
  let flies = flySpots.length ? [0x2aa6a0, 0x3f7fd6, 0x8fbf3a, 0x2aa6a0].map((c) => {
    const m = makeFly(c);
    const at = flySpots[Math.floor(rand() * flySpots.length)].clone();
    at.y += 6 + rand() * 6;
    m.g.scale.setScalar(SIZE.fly);
    return { ...m, pos: at.clone(), from: at.clone(), to: at.clone(), t: 0, dur: 1, hold: rand() * 2, yaw: rand() * TAU, seed: rand() * 100 };
  }) : [];
  // (three more round the clearing's top-left pool, keeping to it — the owner, 2026-10-15: "Add a few more dragonflies around
  // the top left small pool in the arena")
  const poolSpots = [];
  if (mask) for (let k = 0; k < 4000 && poolSpots.length < 40; k++) {
    const px = 393 + (rand() - 0.5) * 140, py = 660 + (rand() - 0.5) * 70;
    if (waterAt(px, py) > 0.6) poolSpots.push(toLevel(px, py, 0));
  }
  if (poolSpots.length > 4) for (const c of [0x3f7fd6, 0x2aa6a0, 0xb04a3a]) {
    const m = makeFly(c);
    const at = poolSpots[Math.floor(rand() * poolSpots.length)].clone();
    at.y += 5 + rand() * 5;
    m.g.scale.setScalar(SIZE.fly);
    flies.push({ ...m, pos: at.clone(), from: at.clone(), to: at.clone(), t: 0, dur: 1, hold: rand() * 2, yaw: rand() * TAU, seed: rand() * 100, spots: poolSpots });
  }
  function stepFly(fl, w, dt, now) {
    const spotsOf = fl.spots || flySpots;
    const p = w.player;
    fl.t += dt;
    // (scared when he comes within 30 — unless already flying somewhere clear of him: re-planning every quarter second while
    // every spot was near him replayed the same short dart, and they hovered on him — the owner, 2026-10-15: "they seems to
    // get stuck on him")
    const near = Math.hypot(fl.pos.x - p.x, fl.pos.z - p.y) < 30;
    const leaving = fl.t < fl.dur && Math.hypot(fl.to.x - p.x, fl.to.z - p.y) >= 36;
    if (fl.t >= fl.dur + fl.hold || (near && !leaving && fl.t > 0.15)) {
      // a dart to another spot, not far, the one most clear of him when he is close
      let best = null, bestD = -1;
      for (const s of spotsOf) {
        const dd = Math.hypot(s.x - fl.pos.x, s.z - fl.pos.z);
        if (dd < (fl.spots ? 4 : 10) || dd > (near ? 120 : 70)) continue;
        const dp = Math.hypot(s.x - p.x, s.z - p.y);
        if (dp < 36) continue;
        const score = near ? dp : rand();
        if (score > bestD) (bestD = score), (best = s);
      }
      fl.from.copy(fl.pos);
      if (best) fl.to.copy(best);
      else {
        // (nowhere clear of him among its spots: straight away from him, 45-65 units, then back to its spots later)
        const ax = fl.pos.x - p.x, az = fl.pos.z - p.y, al = Math.hypot(ax, az) || 1;
        const d = 45 + rand() * 20;
        fl.to.set(fl.pos.x + (ax / al) * d, fl.from.y, fl.pos.z + (az / al) * d);
      }
      fl.to.y = best ? best.y + 5 + rand() * 7 : fl.from.y; // (fleeing with no spot: at its own height)
      fl.t = 0;
      fl.dur = 0.3 + Math.hypot(fl.to.x - fl.from.x, fl.to.z - fl.from.z) / (near ? 190 : 140);
      fl.hold = 0.6 + rand() * 2.4;
      fl.yaw = Math.atan2(fl.to.x - fl.from.x, fl.to.z - fl.from.z);
    }
    const u = Math.min(1, fl.t / fl.dur), e = u * u * (3 - 2 * u);
    fl.pos.lerpVectors(fl.from, fl.to, e);
    const s = fl.seed + now;
    fl.g.position.set(fl.pos.x + Math.sin(s * 3.1) * 0.35, fl.pos.y + Math.sin(s * 4.7) * 0.5, fl.pos.z + Math.cos(s * 2.6) * 0.35);
    fl.g.rotation.set(Math.sin(s * 2.0) * 0.08, fl.yaw, 0);
    // (wings a blur: flickering in length, never still)
    const k = 0.75 + 0.25 * Math.sin(now * 90 + fl.seed);
    for (const wg of fl.wings) wg.scale.set(1.7 * k, 0.36, 1);
  }

  // (the pools are 8-15 units across and a running stride 20: a step seldom lands in one, so while he moves through the
  // water it is thrown up from round his legs all the time, and rings spread behind him — the steps' own splashes on top)
  let sprayT = 0, wakeT = 0;
  function wade(w, dt) {
    const p = w.player, sp = Math.hypot(p.vx || 0, p.vy || 0);
    if (sp < 15 || wet(p.x, p.y) < 0.5) return;
    sprayT -= dt;
    wakeT -= dt;
    const k = Math.min(1, sp / 94);
    if (sprayT <= 0 && burst) {
      sprayT = 0.05;
      const back = Math.atan2(-(p.vy || 0), -(p.vx || 0));
      burst(p.x, p.y, 2, { speed: 24 * k, dir: back, spread: 2.2, life: 0.35, cols: DROP, grav: 520, vz: (45 + 45 * k) * 0.71, z: 1.5, size: (u) => 0.6 + u * 0.7, drag: 0.93, kind: "water" });
    }
    if (wakeT <= 0) {
      wakeT = 0.16;
      snd("wade", 0.3);
      const [px, py] = toImg(p.x, 0, p.y);
      ripple(px, py, 0.35 + 0.35 * k, clock);
    }
  }
  let fishNext = 1;
  const ripBuf = Array.from({ length: 8 }, () => [0, 0, 0, 0]), ripOut = [];
  const shockBuf = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], shockOut = [];
  return {
    objects: [root],
    wet,
    splash,
    /** Startle what is near (x, y) within r: the bell, Gnasher landing, a roar — the birds take off, the frogs dive. */
    startle(x, y, rr = 120) {
      for (const b of birds) if (b.state === "perch" && Math.hypot(b.pos.x - x, b.pos.z - y) < rr) takeOff(b, x, y);
      for (const fr of frogs) if (fr.state === "sit" && Math.hypot(fr.at.x - x, fr.at.z - y) < rr) {
        const a = Math.atan2(fr.at.z - y, fr.at.x - x);
        fr.to.set(fr.at.x + Math.cos(a) * 13, WATER_Y, fr.at.z + Math.sin(a) * 13);
        fr.yaw = Math.atan2(fr.to.x - fr.at.x, fr.to.z - fr.at.z);
        fr.state = "hop";
        fr.t = 0;
      }
    },
    update(w, now, dt) {
      clock = now;
      dt = Math.min(dt, 0.1);
      if (w?.player) {
        for (const b of birds) stepBird(b, w, dt);
        for (const fr of frogs) stepFrog(fr, w, dt);
        for (const fl of flies) stepFly(fl, w, dt, now);
        wade(w, dt);
      }
      fishNext -= dt;
      if (fishNext <= 0 && fishAt.length) {
        const [px, py] = fishAt[Math.floor(rand() * fishAt.length)];
        ripple(px, py, 0.35 + rand() * 0.25, now);
        fishNext = 1.2 + rand() * 3;
      }
      while (rips.length && now - rips[0].t0 > 2.4) rips.shift();
    },
    /** The rings on the water now, for backdrop3d.js setRipples: [image x, image y, age, strength]. */
    /** A shockwave on the ground round (x, y), radius r (world units): a landing. */
    shock,
    /** The live ones: up to 2 of [image x, image y, age s, half axis x, half axis y, sweep s]. */
    // (both fill the same arrays every frame: backdrop3d.js reads them at once and keeps none)
    shocks(now) {
      while (shocks.length && now - shocks[0].t0 > shocks[0].sweep * 1.6) shocks.shift();
      shockOut.length = shocks.length;
      for (let i = 0; i < shocks.length; i++) {
        const q = shocks[i], o = (shockOut[i] = shockBuf[i]);
        (o[0] = q.cx), (o[1] = q.cy), (o[2] = Math.max(0, now - q.t0)), (o[3] = q.rx), (o[4] = q.ry), (o[5] = q.sweep);
      }
      return shockOut;
    },
    ripples(now) {
      ripOut.length = rips.length;
      for (let i = 0; i < rips.length; i++) {
        const q = rips[i], o = (ripOut[i] = ripBuf[i]);
        (o[0] = q.px), (o[1] = q.py), (o[2] = Math.max(0, now - q.t0)), (o[3] = q.k);
      }
      return ripOut;
    },
    /** (checks) where everything is. */
    probe() {
      const img = (v) => toImg(v.x, v.y, v.z).map((u) => Math.round(u));
      return { birds: birds.map((b) => ({ state: b.state, at: b.pos.toArray().map((v) => +v.toFixed(1)), img: img(b.g.position) })), frogs: frogs.map((fr) => ({ state: fr.state, img: img(fr.g.position) })), flies: flies.map((fl) => ({ img: img(fl.g.position) })), ripples: rips.length, splashes, fish: fishAt.length, flySpots: flySpots.length };
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
