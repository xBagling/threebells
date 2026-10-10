// The chest after a win (sim/world.js stepChest, FIGHT.chest; the owner, 2026-10-09: "spawn a chest ... add some
// particles around it so that it is clearly visible and pretty. When the player hits the chest it should open, and
// out of it should be clear rainbows and shiny particles coming out creating a dopamine feeling").
//
// A wooden chest bound in gold, made here from boxes (no model of one yet: a modelled one can take its place). It
// falls from the sky down a beam of light, lands with a bounce, and waits: a pool of light under it, a soft beam up
// from it, gold motes rising round it, and every so often a little hop that lifts the lid a crack and lets the light
// out. Struck, the lid flies open with the light pouring out of it — a flash, rays fanning up, three rainbows
// arching out over it, a fountain of rainbow sparkles and gold coins bouncing on the grass — and the light keeps
// glowing on under the result card, which is see-through to it.
//
// Everything bright is additive and on the glow layer (camera layer 1: the bloom); the rainbows are blended plain
// so their colours stay clear on the lawn. Time is the view's real clock; where the chest is, the sim's.
import { Group, Mesh, BoxGeometry, CylinderGeometry, BufferAttribute, Color, DoubleSide } from "./three-lib.js?v=df092a6";
import { billboard, sprites, sparkFrag, coinFrag } from "./fxsprites3d.js?v=df092a6";
import { paintMaterial, outlineMaterial } from "./materials3d.js?v=df092a6";
import { makeBlob } from "./fx3d.js?v=df092a6";
import { FIGHT } from "../config.js?v=df092a6";
import { rng } from "../util.js?v=df092a6";

const W = 15; // across (its local x)
const D = 10; // front to back (z: +z the front, towards the camera)
const BH = 7.4; // the body's height; the lid is a half round of radius D/2 on it
const LR = D / 2;
const FALL = 150; // how high it falls from
const LID_OPEN = -2.0; // radians, back past upright

const RAINBOW = ["#ff4d6d", "#ff9f43", "#ffe066", "#7bed6a", "#4dd8ff", "#6c8cff", "#c77dff", "#ffffff", "#fff3b0"].map((h) => new Color(h));
const GOLDS = ["#ffd66b", "#fff3c4", "#ffcf5a", "#ffffff"].map((h) => new Color(h));

/** An outline hull for a box shape: pushed out from its middle, so its corners stay closed (face normals split them). */
function hullOf(geo) {
  const g = geo.clone();
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(g.boundingBox.min.clone());
  const pos = g.getAttribute("position");
  const n = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - c.x, y = pos.getY(i) - c.y, z = pos.getZ(i) - c.z;
    const l = Math.hypot(x, y, z) || 1;
    n.set([x / l, y / l, z / l], i * 3);
  }
  g.setAttribute("normal", new BufferAttribute(n, 3));
  return g;
}

export function makeChest3D(look) {
  const rand = rng(91);
  const wood = paintMaterial(look, { color: 0x8a5428, char: true });
  const woodDark = paintMaterial(look, { color: 0x5e3416, char: true });
  const gold = paintMaterial(look, { color: 0xf0c04a, emissive: 0x3a2604, char: true });
  const lock = paintMaterial(look, { color: 0xffe08a, emissive: 0x5a3c08, char: true });
  const outlines = [];
  const solid = (geo, mat, x, y, z, hull = true) => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    if (hull) {
      const om = outlineMaterial(look, { color: 0x1c0f06, warm: 0x5a3a10, px: 1.2 });
      outlines.push(om);
      m.add(new Mesh(hullOf(geo), om));
    }
    return m;
  };

  const root = new Group(); // on the ground where it stands, turned to face the camera
  root.rotation.y = Math.PI / 4;
  const body = new Group(); // squash, hop and wobble
  root.add(body);
  // the box: planks, gold bands up its sides and corners, a lock on the front
  body.add(solid(new BoxGeometry(W, BH, D), wood, 0, BH / 2, 0));
  for (const y of [BH * 0.3, BH * 0.68]) body.add(solid(new BoxGeometry(W + 0.12, 0.35, D + 0.12), woodDark, 0, y, 0, false));
  for (const x of [-W * 0.3, W * 0.3]) body.add(solid(new BoxGeometry(1.5, BH + 0.1, D + 0.3), gold, x, BH / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.add(solid(new BoxGeometry(1.1, BH + 0.15, 1.1), gold, sx * (W / 2 - 0.4), BH / 2, sz * (D / 2 - 0.4), false));
  body.add(solid(new BoxGeometry(2.6, 2.8, 0.9), lock, 0, BH - 1.0, D / 2 + 0.35));
  const keyhole = new Mesh(new BoxGeometry(0.5, 1.0, 0.2), paintMaterial(look, { color: 0x1a0e04, char: true }));
  keyhole.position.set(0, BH - 1.2, D / 2 + 0.85);
  body.add(keyhole);
  // the light inside, seen when the lid lifts
  const glowIn = billboard(1, { size: [W - 1.6, D - 1.6], col: 0xfff0b0, flat: true });
  glowIn.visible = true;
  glowIn.position.set(0, BH - 0.25, 0);
  body.add(glowIn);
  const inside = glowIn.material;
  // the lid: a half round hinged along the top back edge
  const lid = new Group();
  lid.position.set(0, BH, -D / 2);
  body.add(lid);
  const half = new CylinderGeometry(LR, LR, W, 14, 1, false, 0, Math.PI);
  half.rotateZ(Math.PI / 2); // its axis along x, the round half (θ 0..π, +x) turned upwards
  lid.add(solid(half, paintMaterial(look, { color: 0x7a4a22, char: true, side: DoubleSide }), 0, 0, D / 2)); // (both sides: open, its inside shows)
  for (const x of [-W * 0.3, W * 0.3]) {
    const band = new CylinderGeometry(LR + 0.2, LR + 0.2, 1.5, 14, 1, false, 0, Math.PI);
    band.rotateZ(Math.PI / 2);
    lid.add(solid(band, gold, x, 0, D / 2, false));
  }
  const blob = makeBlob(W * 0.62, 0.4);

  // the light round it
  const beam = billboard(0, { size: [16, 170], col: 0xffd36b });
  const pool = billboard(1, { size: [70, 70], col: 0xffc94a, flat: true });
  const rings = [0, 1, 2].map(() => billboard(2, { size: [1, 1], col: 0xfff2c0, flat: true }));
  const rays = billboard(4, { size: [80, 64], col: 0xfff0b8 });
  const flash = billboard(5, { size: [48, 48], anchor: [0.5, 0.5], col: 0xfff6d8 });
  const bows = [0, 1, 2].map(() => billboard(3, { size: [1, 1], normal: true }));
  const sparks = sprites(700, sparkFrag, true);
  const coins = sprites(90, coinFrag, false);
  const fx = [beam, pool, ...rings, rays, flash, ...bows];
  const objects = [root, blob, ...fx, sparks.mesh, coins.mesh];
  root.visible = blob.visible = false;

  let dropAt = null; // real time of the fall's start, the landing, the opening
  let landAt = null;
  let openAt = null;
  let openA = 0;
  let lastNow = null;
  let moteAcc = 0;
  let fountainAcc = 0;
  let orbitAcc = 0;
  const ringT = [null, null, null];
  const at = { x: 0, z: 0 };

  const spark = (o) =>
    sparks.add({ x: at.x, y: 2, z: at.z, vx: 0, vy: 0, vz: 0, t: 0, life: 1.5, size: 2, spin: rand() * 6.3, spinV: (rand() - 0.5) * 4, grav: 0, drag: 1, tw: 10 + rand() * 14, ph: rand() * 6.3, ...o });
  const pick = (cols) => cols[Math.floor(rand() * cols.length)];

  function burst() {
    // the opening: rainbow sparkles up and out, gold coins thrown into the air to bounce on the grass
    for (let i = 0; i < 170; i++) {
      const a = rand() * Math.PI * 2;
      const out = 20 + rand() * 60;
      const c = pick(RAINBOW);
      spark({ y: BH, vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy: 70 + rand() * 110, grav: 95, drag: 0.975, life: 1.3 + rand() * 1.5, size: 1.6 + rand() * 2.6, r: c.r, g: c.g, b: c.b });
    }
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const out = 18 + rand() * 42;
      coins.add({ x: at.x, y: BH, z: at.z, vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy: 80 + rand() * 70, t: 0, life: 2.8 + rand() * 1.2, size: 2.4 + rand() * 0.8, r: 1, g: 1, b: 1, spin: rand() * 6.3, spinV: 10 + rand() * 14, grav: 230, drag: 0.99, bounce: 0.38 });
    }
  }

  return {
    objects,
    /** The outlines are pushed out in render-target texels. */
    setView(Wt, Ht) {
      for (const m of outlines) m.userData.outline.uView.value.set(Wt, Ht);
    },
    drop(now) {
      dropAt = now;
      landAt = openAt = null;
      sparks.clear();
      coins.clear();
    },
    land(now) {
      landAt = now;
      ringT[0] = now;
      for (let i = 0; i < 40; i++) {
        const a = rand() * Math.PI * 2;
        const c = pick(GOLDS);
        spark({ y: 1, vx: Math.cos(a) * (40 + rand() * 50), vz: Math.sin(a) * (40 + rand() * 50), vy: 20 + rand() * 40, grav: 60, drag: 0.93, life: 0.6 + rand() * 0.5, size: 1.4 + rand() * 1.4, r: c.r, g: c.g, b: c.b });
      }
    },
    open(now, a = 0) {
      openAt = now;
      openA = a;
      ringT[1] = now;
      ringT[2] = now + 0.12;
      burst();
    },
    update(w, now) {
      const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.1, now - lastNow));
      lastNow = now;
      const c = w.chest;
      const shown = !!c;
      root.visible = blob.visible = shown;
      if (!shown) {
        for (const m of fx) m.visible = false;
        sparks.mesh.visible = coins.mesh.visible = false;
        return;
      }
      if (dropAt == null) dropAt = now - c.t; // (a frame drawn without its event: a bench jumping in)
      if (c.landed && landAt == null) landAt = now;
      if (c.openAt != null && openAt == null) this.open(now);
      at.x = c.x;
      at.z = c.y;
      const C = FIGHT.chest;
      // the fall, quickening, then the landing's squash and the waiting hop
      const u = Math.min(1, c.t / C.drop);
      const h = c.landed ? 0 : FALL * (1 - u * u);
      root.position.set(c.x, h, c.y);
      blob.position.set(c.x, 0.08, c.y);
      blob.scale.setScalar(0.4 + 0.6 * u);
      let sy = 1;
      let hop = 0;
      let tilt = 0;
      let lidA = 0;
      if (landAt != null) {
        const tl = now - landAt;
        sy = 1 - 0.28 * Math.exp(-7 * tl) * Math.cos(16 * tl);
        if (openAt == null && tl > 1.0) {
          // every 1.7 s a little hop and rattle, the lid lifting a crack to let the light out
          const k = (tl - 1.0) % 1.7;
          if (k < 0.42) {
            const s = Math.sin((Math.PI * k) / 0.42);
            hop = 2.4 * s;
            tilt = 0.07 * Math.sin(k * 42) * (1 - k / 0.42);
            lidA = -0.22 * s;
          }
        }
      }
      if (openAt != null) {
        const to = now - openAt;
        // knocked by the blow, then the lid flies back past upright, overshooting and settling
        lidA = LID_OPEN * (1 - Math.exp(-8 * to) * Math.cos(13 * to));
        sy = 1 - 0.18 * Math.exp(-9 * to) * Math.cos(20 * to);
        tilt = 0.12 * Math.exp(-6 * to) * Math.sin(24 * to) * Math.sign(Math.cos(openA - Math.PI / 4) || 1);
      }
      body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      body.position.y = hop;
      body.rotation.z = tilt;
      lid.rotation.x = lidA;
      inside.uniforms.uA.value = openAt != null ? 1.4 + 0.25 * Math.sin(now * 9) : Math.min(1, -lidA * 6);

      // the light: a beam it falls down and that stays, soft, while it waits; the pool under it
      const pulse = 0.5 + 0.5 * Math.sin(now * 2.6);
      const to = openAt != null ? now - openAt : -1;
      beam.visible = pool.visible = true;
      beam.position.set(c.x, h, c.y);
      beam.material.uniforms.uT.value = now;
      beam.material.uniforms.uA.value = !c.landed ? 0.95 : openAt == null ? 0.32 + 0.12 * pulse : 0.55 + 0.6 * Math.exp(-2 * to);
      pool.position.set(c.x, 0.15, c.y);
      pool.material.uniforms.uA.value = (c.landed ? 0.95 + 0.3 * pulse : 0.5 * u) + (openAt != null ? 0.6 * Math.exp(-1.5 * to) + 0.2 : 0);
      // rings over the grass: gold at the landing, white and then rainbow at the opening
      rings.forEach((m, i) => {
        const t0 = ringT[i];
        const k = t0 == null ? 1 : (now - t0) / (i === 0 ? 0.55 : 0.75);
        m.visible = k >= 0 && k < 1;
        if (!m.visible) return;
        const R = (i === 0 ? 40 : 70) * (1 - Math.pow(1 - k, 2.5)) + 6;
        m.position.set(c.x, 0.2, c.y);
        m.material.uniforms.uSize.value = { x: R * 2, y: R * 2 };
        m.material.uniforms.uA.value = (1 - k) * (i === 0 ? 0.8 : 1.1);
        m.material.uniforms.uReveal.value = i === 2 ? 1 : 0;
        m.material.uniforms.uT.value = now;
      });
      // the opening's flash, the rays pouring up out of it, and the rainbows arching out over it
      flash.visible = to >= 0 && to < 0.4;
      if (flash.visible) {
        flash.position.set(c.x, BH + 2, c.y);
        flash.material.uniforms.uA.value = 1.6 * (1 - to / 0.4);
        flash.material.uniforms.uSize.value = { x: 30 + 60 * to, y: 30 + 60 * to };
      }
      rays.visible = to >= 0;
      if (rays.visible) {
        rays.position.set(c.x, BH - 1, c.y);
        rays.material.uniforms.uT.value = now;
        rays.material.uniforms.uA.value = Math.min(1, to / 0.15) * (0.55 + 0.45 * Math.exp(-1.2 * to));
        const g = 1 + 0.25 * Math.exp(-3 * to);
        rays.material.uniforms.uSize.value = { x: 80 * g, y: 64 * g };
      }
      bows.forEach((m, i) => {
        const delay = i === 0 ? 0.08 : 0.2 + i * 0.06;
        const k = to - delay;
        m.visible = k > 0 && k < 3.4;
        if (!m.visible) return;
        const grow = 1 - Math.pow(1 - Math.min(1, k / 0.9), 3); // out fast, easing in
        const R = (i === 0 ? 36 : 22) * (0.25 + 0.75 * grow);
        m.position.set(c.x, BH * 0.6, c.y);
        m.material.uniforms.uSize.value = { x: R * 2.2, y: R * 1.1 };
        m.material.uniforms.uRot.value = i === 0 ? 0 : i === 1 ? 0.55 : -0.55;
        m.material.uniforms.uReveal.value = Math.min(1, k / 0.55);
        m.material.uniforms.uA.value = k < 2.4 ? 1 : Math.max(0, 1 - (k - 2.4) / 1.0);
      });

      // gold motes rising round it while it waits (rainbow ones once it is open), and the fountain after the burst
      moteAcc += dt * (!c.landed ? 0 : openAt == null ? 48 : 22);
      while (moteAcc >= 1) {
        moteAcc -= 1;
        const a = rand() * Math.PI * 2;
        const r = 5 + rand() * 13;
        const col = openAt == null ? pick(GOLDS) : pick(RAINBOW);
        spark({ x: c.x + Math.cos(a) * r, z: c.y + Math.sin(a) * r, y: rand() * 5, vx: -Math.sin(a) * 6, vz: Math.cos(a) * 6, vy: 10 + rand() * 16, life: 1.5 + rand() * 1.5, size: 1.4 + rand() * 2.0, r: col.r, g: col.g, b: col.b });
      }
      // three sparks circling it, each leaving a comet's tail of fading stars, rising and falling as they go round
      if (c.landed) {
        orbitAcc += dt * 50;
        while (orbitAcc >= 1) {
          orbitAcc -= 1;
          for (let i = 0; i < 3; i++) {
            const a = now * 2.1 + (i * Math.PI * 2) / 3;
            const r = openAt == null ? 13 : 13 + Math.min(1, to) * 6;
            const col = openAt == null ? GOLDS[i % 2] : RAINBOW[(i * 3 + Math.floor(now * 3)) % 7];
            spark({ x: c.x + Math.cos(a) * r, z: c.y + Math.sin(a) * r, y: BH * 0.6 + Math.sin(now * 3 + i * 2) * 4, life: 0.5, size: 2.6, grow: -0.85, tw: 0, r: col.r, g: col.g, b: col.b });
          }
        }
      }
      if (to >= 0 && to < 1.8) {
        fountainAcc += dt * 90 * (1 - to / 1.8);
        while (fountainAcc >= 1) {
          fountainAcc -= 1;
          const a = rand() * Math.PI * 2;
          const out = 8 + rand() * 30;
          const col = pick(RAINBOW);
          spark({ x: c.x, z: c.y, y: BH, vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy: 60 + rand() * 80, grav: 80, drag: 0.98, life: 1.2 + rand() * 1.2, size: 1.3 + rand() * 2.2, r: col.r, g: col.g, b: col.b });
        }
      }
      sparks.mesh.visible = coins.mesh.visible = true;
      sparks.step(dt, now);
      coins.step(dt, now);
    },
    dispose() {
      sparks.dispose();
      coins.dispose();
      for (const m of fx) (m.geometry.dispose(), m.material.dispose());
    },
  };
}
