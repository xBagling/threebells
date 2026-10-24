// The Drowned King's chain and anchor, drawn at run time. The owner, 2026-10-21: "make it so that his chain is expandable on his
// attacks so that he can do big swings with it", then "Update it so that the anchor is on the tip of the chain while he is
// walking instead of in a separate hand, so it is being dragged behind him while he walks around". His model's chain
// (56_stump_king.py) is 18 links on 18 bones, 2.15 units apart, and his anchor a bone in his left fist; his chain lane reaches 240,
// his cleaves 74-78, his slams wherever the hero stands. So the skinned chain and anchor are hidden, and drawn here — his own link
// (cut out of the chain mesh, its texture, paint and ink outline) on instances, his own anchor on the chain's tip:
//   always      a heavy chain from his right fist (its first three links on the model's own bones, through the fist), the anchor
//               hanging from its last link: lying beside him when he stands, dragged behind him over the floor when he walks;
//   his chain   (sim tag "chain": a lane 240 long, 0.85 s of warning) whirled at his side as it is marked, paid out longer as the
//               wind-up runs, the anchor snapped out along the whole lane as it goes live — the chain lying on the floor from his
//               fist to the lane's end — then reeled back in, or, if it caught the hero, held on him while he is dragged in;
//   his cleaves (sim tag "cleave": a cone r 74-78, half 0.7-0.8) whirled at his side, paid out and swung wide round him so the
//               anchor sweeps the cone's own arc through its live window — his big swing — then let fly and fall;
//   his slams   (sim tag "slam": a circle, 1.1 s of warning, often round the hero) whirled overhead, then hurled up and over in a
//               high arc to smash down in the circle's middle as it goes live, left lying in it, then dragged back;
//   after       taken back in to its resting length and left to lie, wherever it fell.
// The rope: Verlet points one link apart, the fist pinned, gravity, the floor; links paid out and taken in at the fist; the anchor
// its last point, heavy (it moves a quarter as much as a link when the chain pulls) and gripping the floor.
import { InstancedMesh, Mesh, BufferGeometry, BufferAttribute, Matrix4, Vector3, Quaternion, DynamicDrawUsage } from "./three-lib.js?v=48fd128-df87a96f";
import { floorAt } from "./floorh3d.js?v=48fd128-df87a96f";
import { phaseOf } from "../sim/hazards.js?v=48fd128-df87a96f";

const MAX = 150; // links (the lane's 240 is 112 of them, his reach from the fist to its start a few more)
const REST = 18; // (the model's: chain_00 .. chain_17)
// (the first three always on the model's own bones: 56_stump_king.py pins the chain's first links through his fist — king_fists.py,
// boss-profiles.js chainGrip — so the rope leaves his hand where the chain does, not from inside the fist)
const FIST = 3;
const IDLE = 15; // links beyond the fist when nothing is thrown: 32 units, down to the floor and the anchor lying a stride off
const G = 520; // gravity, u/s² (a heavy chain: it drops fast and lies flat)
const HEAVY = 0.25; // (the anchor's share of a pull, a link's 0.5: dragged, it lags and ploughs)

export function makeKingChain() {
  let mesh = null; // the links (InstancedMesh)
  let ink = null; // their ink outline: the chain's own hull material on the same instances (boss3d.js hulls)
  let anc = null; // the anchor (its outline a child of it)
  let bones = null; // chain_00 .. chain_17
  let hidden = []; // the skinned chain and anchor and their outlines, hidden while attached
  let pitch = 2.15, scale = 134.6; // (world units a link; the model's own scale, read on attach)
  let flatAxis = 2; // (the anchor's thin axis in its own frame, 0 = x or 2 = z: it lies on the floor flat on it)
  // the rope
  const P = [], Q = []; // points now, points a step ago; P[last] is the anchor's ring
  let seeded = false;
  let holdId = -1; // the hazard the rope is following
  let freeT = 0; // seconds since the last attack let the rope go
  const v = new Vector3(), v2 = new Vector3(), up = new Vector3(0, 1, 0), m4 = new Matrix4(), q4 = new Quaternion(), sc = new Vector3();
  const xs = new Vector3(), ys = new Vector3(), zs = new Vector3(), tw = new Quaternion(), flat = new Vector3(0, 1, 0);
  const grip = new Vector3(), tip = new Vector3(), lastGrip = new Vector3(), from = new Vector3();
  // His trunk, a cylinder the chain wraps round and never passes through (the owner, 2026-10-21: "The chain in the spin needs to
  // be outside of his body like it is Wrapped around a cylinder"): along his spine — from his hips bone to his head bone, run
  // on below to the floor and above to his crown, so it leans with him — 17 round. Measured on his mesh (king.gltf, the trunk's
  // own vertices): 11.4 round at his shins, 14.0-14.5 from 12 to 21 up, 15.6 at 24-27 (his widest, moss and all); 17 is that
  // and half a link (the links are 2.6 x 2.3 across). It was a post 10.5 round on his feet — 6 units off his spine, since the
  // model's trunk stands 6 back of its origin — and the wound chain cut through his trunk.
  const body = { a: new Vector3(), b: new Vector3(), r: 17, ready: false };
  let spineA = null, spineB = null; // (his hips and head bones)
  const dAB = new Vector3(), cp = new Vector3();
  /** Out of his trunk: p pushed square from his spine's line to the cylinder's skin. */
  function outOfBody(p) {
    if (!body.ready) return;
    dAB.subVectors(body.b, body.a);
    const L2 = dAB.lengthSq() || 1;
    const s = Math.max(-0.7, Math.min(1.35, v2.subVectors(p, body.a).dot(dAB) / L2));
    cp.copy(body.a).addScaledVector(dAB, s);
    v2.subVectors(p, cp);
    const d = v2.length();
    if (d >= body.r) return;
    if (d < 1e-4) v2.set(1, 0, 0);
    else v2.multiplyScalar(1 / d);
    p.copy(cp).addScaledVector(v2, body.r);
  }
  /** For the checks: the least room between a rope point and his trunk's skin (15.6 from the spine) this frame. */
  function clearance() {
    if (!body.ready) return null;
    let m = Infinity;
    dAB.subVectors(body.b, body.a);
    const L2 = dAB.lengthSq() || 1;
    for (let i = 1; i < P.length; i++) {
      const s = v.subVectors(P[i], body.a).dot(dAB) / L2;
      if (s < -0.7 || s > 1.35) continue;
      cp.copy(body.a).addScaledVector(dAB, s);
      m = Math.min(m, P[i].distanceTo(cp) - 15.6);
    }
    return m;
  }

  /** A rigid piece of a skinned mesh in bone j's own frame: the triangles whose corners all ride on j (`own`), or all of them. */
  function cutRigid(sk, j, own) {
    const g = sk.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const bind = new Matrix4().copy(sk.skeleton.boneInverses[j]).multiply(sk.bindMatrix);
    const keep = new Map(), P3 = [], N3 = [], U2 = [];
    const on = (i) => {
      if (!own) return true;
      let best = -1, bw = 0;
      for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) (bw = sw.getComponent(i, k)), (best = si.getComponent(i, k));
      return best === j;
    };
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    const tris = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (!on(a) || !on(b) || !on(c)) continue;
      for (const i of [a, b, c]) {
        if (!keep.has(i)) {
          keep.set(i, keep.size);
          v.fromBufferAttribute(pos, i).applyMatrix4(bind);
          P3.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nor, i).transformDirection(bind); // (its bind is a turn and an even scale: no normal matrix needed)
          N3.push(v.x, v.y, v.z);
          if (uv) U2.push(uv.getX(i), uv.getY(i));
        }
        tris.push(keep.get(i));
      }
    }
    const out = new BufferGeometry();
    out.setAttribute("position", new BufferAttribute(new Float32Array(P3), 3));
    out.setAttribute("normal", new BufferAttribute(new Float32Array(N3), 3));
    if (uv) out.setAttribute("uv", new BufferAttribute(new Float32Array(U2), 2));
    out.setIndex(tris);
    return out;
  }

  /** The chain hung from his fist straight down to the floor, then laid out behind him (a fight's start, or a jump across it). */
  function seed(face) {
    P.length = Q.length = 0;
    const bx = -Math.cos(face), bz = -Math.sin(face);
    const fl = floorAt(grip.x, grip.z) + 0.55;
    let x = grip.x, y = grip.y, z = grip.z;
    for (let i = 0; i <= IDLE; i++) {
      P.push(new Vector3(x, y, z));
      if (y - pitch > fl) y -= pitch;
      else (y = fl), (x += bx * pitch), (z += bz * pitch);
    }
    for (const p of P) Q.push(p.clone());
    seeded = true;
  }

  /** Pay out (more links at the fist) or take in (links drawn into it) toward n links. */
  function setLinks(n, rate, dt) {
    n = Math.max(2, Math.min(MAX, Math.round(n)));
    let k = Math.max(1, Math.round(rate * dt));
    while (P.length - 1 < n && k-- > 0) {
      P.splice(1, 0, P[0].clone());
      Q.splice(1, 0, P[0].clone());
    }
    while (P.length - 1 > n && k-- > 0) {
      P.splice(1, 1);
      Q.splice(1, 1);
    }
  }

  /** One Verlet step: gravity, the floor (friction on it), the links' length; the fist pinned, the anchor pinned when given. */
  function stepRope(dt, pinTip) {
    const n = P.length;
    for (let i = 1; i < n; i++) {
      const p = P[i], q = Q[i];
      const fl = floorAt(p.x, p.z) + 0.55;
      const onFloor = p.y <= fl + 0.05;
      // (the anchor grips the floor harder than a link: its flukes plough)
      const damp = onFloor ? (i === n - 1 ? 0.7 : 0.82) : 0.995;
      const vx = (p.x - q.x) * damp, vy = (p.y - q.y) * 0.995, vz = (p.z - q.z) * damp;
      q.copy(p);
      p.x += vx;
      p.y += vy - G * dt * dt;
      p.z += vz;
    }
    P[0].copy(grip);
    if (pinTip) P[n - 1].copy(tip);
    for (let it = 0; it < 14; it++) {
      // (forward then back: a long chain pulled from both its ends)
      const pass = (i) => {
        const a = P[i], b = P[i + 1];
        v.subVectors(b, a);
        const d = v.length() || 1e-6, e = (d - pitch) / d;
        const wa = i === 0 ? 0 : 0.5, wb = i + 1 === n - 1 ? (pinTip ? 0 : HEAVY) : 0.5;
        const s = wa + wb || 1;
        a.addScaledVector(v, (e * wa) / s);
        b.addScaledVector(v, (-e * wb) / s);
      };
      if (it & 1) for (let i = n - 2; i >= 0; i--) pass(i);
      else for (let i = 0; i < n - 1; i++) pass(i);
      // (pushed out of his trunk: wound round him, the chain wraps him instead of cutting through)
      for (let i = 1; i < (pinTip ? n - 1 : n); i++) outOfBody(P[i]);
    }
    for (let i = 1; i < n; i++) {
      const p = P[i], fl = floorAt(p.x, p.z) + 0.55;
      if (p.y < fl) p.y = fl;
    }
  }

  /** The rope laid straight from the fist to the tip (the snap along his lane): no slack, at rest on it. */
  function layStraight(waveK) {
    const n = P.length - 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      P[i].lerpVectors(grip, tip, u);
      // (a last ripple running down it as it lands)
      P[i].y += waveK * 3 * Math.sin(u * 18) * (1 - u) * u * 4;
      const fl = floorAt(P[i].x, P[i].z) + 0.55;
      if (i > 0 && P[i].y < fl) P[i].y = fl;
      Q[i].copy(P[i]);
    }
  }

  /** Each link on its two points, every other one turned a quarter about the chain, as a chain's links are; the anchor on the last. */
  function draw() {
    const n = P.length - 1;
    for (let i = 0; i < FIST; i++) mesh.setMatrixAt(i, bones[i].matrixWorld);
    xs.set(1, 0, 0).transformDirection(bones[FIST - 1].matrixWorld);
    for (let i = 0; i < n; i++) {
      ys.subVectors(P[i + 1], P[i]);
      const len = ys.length();
      if (len < 1e-5) ys.set(0, -1, 0);
      else ys.multiplyScalar(1 / len);
      // (its x carried on from the link before, square to this one: no link spins about the chain)
      xs.addScaledVector(ys, -xs.dot(ys));
      if (xs.lengthSq() < 1e-6) xs.set(ys.y, -ys.x, 0);
      xs.normalize();
      zs.crossVectors(xs, ys);
      m4.makeBasis(xs, ys, zs);
      q4.setFromRotationMatrix(m4);
      if (i & 1) q4.multiply(tw);
      // (a link stretched to meet the next point when the rope runs taut faster than it can settle — never shrunk)
      sc.set(scale, scale * Math.max(1, len / pitch), scale);
      m4.compose(P[i], q4, sc);
      mesh.setMatrixAt(i + FIST, m4);
    }
    mesh.count = n + FIST;
    if (ink) ink.count = n + FIST;
    mesh.instanceMatrix.needsUpdate = true;
    if (!anc) return;
    // The anchor: its ring on the chain's end, its shank on along the chain (its own frame hangs it down its -y from the ring);
    // flat side as near the floor as the chain lets it — lying on the floor flat, dragged flukes first after the chain. On the
    // floor its shank lies level (the last link climbing back to his fist would stand it on its crown).
    const a = P[n], b = P[n - 1];
    ys.subVectors(b, a);
    if (a.y <= floorAt(a.x, a.z) + 0.6) ys.y = Math.min(ys.y, 0.15 * Math.hypot(ys.x, ys.z));
    if (ys.lengthSq() < 1e-8) ys.set(0, 1, 0);
    ys.normalize();
    // (its flat side's normal: up, square to the shank; kept from the last frame while the shank stands near vertical)
    v.copy(up).addScaledVector(ys, -up.dot(ys));
    if (v.lengthSq() > 0.04) flat.copy(v.normalize());
    else flat.addScaledVector(ys, -flat.dot(ys)).normalize();
    if (flatAxis === 2) (zs.copy(flat), xs.crossVectors(ys, zs));
    else (xs.copy(flat), zs.crossVectors(xs, ys));
    m4.makeBasis(xs, ys, zs);
    q4.setFromRotationMatrix(m4);
    sc.set(scale, scale, scale);
    anc.matrix.compose(a, q4, sc);
    anc.matrixWorldNeedsUpdate = true;
  }

  /** His current chain attack: the newest live "chain", "cleave" or "slam" mark (sim/hazards.js). */
  function attackOf(w) {
    let h = null;
    for (const x of w.hazards || []) if (!x.done && (x.tag === "chain" || x.tag === "cleave" || x.tag === "slam" || x.tag === "spin") && phaseOf(x) !== "fade") h = x;
    // (a lane that caught the hero is held through its fade, while he is dragged in; a slam's anchor lies in it through its fade)
    if (!h) for (const x of w.hazards || []) if (!x.done && x.id === holdId && ((x.tag === "chain" && x.caught) || x.tag === "slam")) h = x;
    return h;
  }

  return {
    /** Everything drawn: the links, their outline, the anchor. */
    get objects() {
      return [mesh, ink, anc].filter(Boolean);
    },
    /** What casts his shadow (shadow3d.js): the links and the anchor. */
    get casters() {
      return [mesh, anc].filter(Boolean);
    },
    /** Onto his model (boss3d.js makeBoss3D's object), or off it (null: another boss). Returns what to add to the scene. */
    attach(obj) {
      for (const o of hidden) (o.visible = true), (o.userData.off = false);
      hidden = [];
      for (const o of [mesh, ink, anc]) o?.removeFromParent();
      mesh?.geometry.dispose();
      anc?.geometry.dispose();
      mesh = ink = anc = bones = null;
      seeded = false;
      if (!obj) return null;
      let chain = null, anchor = null;
      obj.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        if (o.skeleton.bones.some((b) => b.name === "chain_04") && (o.name === "chain" || o.parent?.name === "chain")) chain = o;
        if (o.name === "anchor" || o.parent?.name === "anchor") anchor = o;
      });
      if (!chain) return null;
      const sk = chain.skeleton;
      bones = Array.from({ length: REST }, (_, i) => sk.bones.find((b) => b.name === `chain_${String(i).padStart(2, "0")}`));
      spineA = sk.bones.find((b) => b.name === "hips") || null;
      spineB = sk.bones.find((b) => b.name === "head") || null;
      if (bones.some((b) => !b)) return (bones = null);
      const link0 = cutRigid(chain, sk.bones.indexOf(bones[4]), true);
      mesh = new InstancedMesh(link0, chain.material, MAX);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      // (the hulls — boss3d.js: hull.userData.of — go with them, kept off by boss3d.js outline(): left on, the hidden chain's hull
      // was drawn alone at the baked links in the outline's own olive and dark green, over the new links)
      obj.traverse((o) => (o === chain || o === anchor || (o.userData?.of && (o.userData.of === chain || o.userData.of === anchor))) && hidden.push(o));
      for (const o of hidden) (o.visible = false), (o.userData.off = true);
      const hull = hidden.find((o) => o.userData?.of === chain);
      if (hull) {
        ink = new InstancedMesh(link0, hull.material, MAX);
        ink.instanceMatrix = mesh.instanceMatrix; // (the same instances: drawn wherever the links are)
        ink.frustumCulled = false;
        ink.userData.noShadow = true;
      }
      // (its bone loads as "anchor_1": three.js names the mesh node "anchor" first and makes the bone's name unique)
      const ab = anchor && anchor.skeleton.bones.find((b) => /^anchor(_\d+)?$/.test(b.name));
      if (ab) {
        const geo = cutRigid(anchor, anchor.skeleton.bones.indexOf(ab), false);
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        flatAxis = bb.max.x - bb.min.x < bb.max.z - bb.min.z ? 0 : 2; // (it is drawn face-on: flat across one of x, z)
        anc = new Mesh(geo, anchor.material);
        anc.matrixAutoUpdate = false;
        anc.frustumCulled = false;
        anc.castShadow = true;
        const aHull = hidden.find((o) => o.userData?.of === anchor);
        if (aHull) {
          const ai = new Mesh(geo, aHull.material);
          ai.frustumCulled = false;
          ai.userData.noShadow = true;
          anc.add(ai);
        }
      }
      obj.updateMatrixWorld(true);
      scale = bones[4].matrixWorld.getMaxScaleOnAxis();
      pitch = 0.016 * scale;
      tw.setFromAxisAngle(up, Math.PI / 2);
      return this.objects;
    },
    /**
     * Each frame, after his bones are posed. `w` the world; `bx`, `by` where he is drawn; `dt` the view's step; `shown` his
     * model shown (not before his entrance, not once gone).
     */
    update(w, bx, by, dt, shown = true) {
      if (!mesh || !bones) return;
      for (const o of [mesh, ink, anc]) if (o) o.visible = shown;
      if (!shown) return void (seeded = false);
      dt = Math.min(dt, 1 / 30);
      mesh.parent?.updateMatrixWorld(true);
      bones[FIST].parent.updateWorldMatrix(true, true);
      bones[FIST].getWorldPosition(grip);
      // (laid out afresh at a fight's start, or when he is somewhere else at once: a new fight, a bench jump)
      if (!seeded || grip.distanceTo(lastGrip) > 80) seed(w.boss?.face ?? 0);
      lastGrip.copy(grip);
      if (spineA && spineB) {
        spineA.getWorldPosition(body.a);
        spineB.getWorldPosition(body.b);
        body.ready = body.a.distanceToSquared(body.b) > 1;
      }
      const h = attackOf(w);
      if (!h) {
        // his chain at rest: taken back in to its resting length a while after a throw, the anchor left to lie or be dragged
        if (holdId !== -1) (holdId = -1), (freeT = 0);
        freeT += dt;
        if (freeT > 0.35) setLinks(IDLE, 40, dt);
        stepRope(dt, false);
        return draw();
      }
      holdId = h.id;
      const ph = phaseOf(h), t = h.t, T = h.tele;
      const fl = floorAt(bx, by);
      // (the side he whirls it at: out from his body through his fist, level)
      v.set(grip.x - bx, 0, grip.z - by);
      if (v.lengthSq() < 1) v.set(-Math.sin(h.a), 0, Math.cos(h.a));
      v.normalize();
      if (h.tag === "chain") {
        const L = h.len;
        const endX = h.x + Math.cos(h.a) * L, endZ = h.y + Math.sin(h.a) * L;
        if (ph === "tele" && t < T - 0.07) {
          // the whirl at his side: wider and faster as the warning runs (his tell: the chain is coming)
          const k = t / T, rho = 8 + 14 * Math.min(1, k * 1.6), om = 6 + 8 * k;
          const th = om * t;
          v2.copy(grip).addScaledVector(v, rho * 1.05);
          tip.set(v2.x + Math.cos(th) * rho, grip.y + 6 + 4 * k, v2.z + Math.sin(th) * rho);
          setLinks((rho * 2.1) / pitch + 2, 60, dt);
          stepRope(dt, true);
        } else if (ph === "tele") {
          // the snap: out along the whole lane in its last 0.07 s, from the whirl to the lane's end
          const u = Math.min(1, (t - (T - 0.07)) / 0.07);
          tip.set(grip.x + (endX - grip.x) * u, 0, grip.z + (endZ - grip.z) * u);
          tip.y = floorAt(tip.x, tip.z) + 0.55 + 6 * (1 - u) * u * 4;
          setLinks(grip.distanceTo(tip) / pitch + 1, 4000, dt);
          layStraight(0);
        } else {
          // live, then (caught) held on the hero as he is dragged in, or reeled back in along the floor
          const since = t - T;
          const caught = h.caught && w.player && !w.player.dead;
          if (caught) tip.set(w.player.x, floorAt(w.player.x, w.player.y) + 6, w.player.y);
          else {
            const back = Math.max(0, since - h.active * 0.6) * 360;
            const d = Math.max(4, L - back);
            tip.set(h.x + Math.cos(h.a) * d, 0, h.y + Math.sin(h.a) * d);
            tip.y = floorAt(tip.x, tip.z) + 0.55;
          }
          setLinks(grip.distanceTo(tip) / pitch + 1, 900, dt);
          if (since < 0.12) layStraight(1 - since / 0.12);
          else stepRope(dt, true);
        }
      } else if (h.tag === "cleave") {
        // a cleave: the whirl at his side, then wide round him onto the cone's arc, the anchor sweeping it as it is live
        const r = h.r, half = h.half, act = h.active;
        // (the anchor crosses the cone's middle — where he aimed it, at the hero — on the tick the cone goes live, the moment it
        // hurts anywhere in it, and reaches the far edge as it ends; the whirl before turns at the same speed into it)
        const om = half / act;
        const th = h.a + om * Math.min(act, t - T);
        const k = ph === "tele" ? Math.max(0, (t - T * 0.55) / (T * 0.45)) : 1; // (0 at his side, 1 on the arc)
        const e = k * k * (3 - 2 * k);
        const rho = (8 + 14 * Math.min(1, t / (T * 0.5))) * (1 - e) + r * e;
        // (the whirl's middle beside his fist, moving to his own middle as it opens onto the arc)
        v2.copy(grip).addScaledVector(v, rho * 1.05 * (1 - e));
        v2.x += (bx - v2.x) * e;
        v2.z += (by - v2.z) * e;
        tip.set(v2.x + Math.cos(th) * rho, grip.y + 6 + (fl + 5 - grip.y - 6) * e, v2.z + Math.sin(th) * rho);
        setLinks(grip.distanceTo(tip) / pitch + 1.5, 600, dt);
        stepRope(dt, true);
      } else if (h.tag === "spin") {
        // the chain spin: wound round his body through the warning — three rounds, faster and faster, close round his trunk at his
        // fist's height — opened out in its last 0.25 s, and flung once round the circle's edge as it is live while he spins.
        // (wound with an even pick-up, the rounds end at 2 x 3 rounds / 1.5 s = 25 rad/s, the release's own speed: one round in
        // 0.25 s — no hitch between them; the same way round as his body turns, boss3d.js spinTag)
        const WIND = 3 * 2 * Math.PI, act = h.active;
        const th = ph === "tele" ? h.a + WIND * (t / T) ** 2 : h.a + WIND + (2 * Math.PI * Math.min(act, t - T)) / act;
        const k = ph === "tele" ? Math.max(0, (t - (T - 0.25)) / 0.25) : 1, e = k * k * (3 - 2 * k);
        // (wound round his spine — his trunk's own middle, 6 behind his feet's: round his feet the anchor went into him on one
        // side — 23 out growing to 30, a little above his fist: the anchor is 11 across, so its flukes clear his trunk's 15.6;
        // closer, at 15-22, his trunk hid it half of each round — .scratch/king-chain/spin-c.jpg; opening out onto the circle,
        // centred on him, as it is let go)
        const rho = (23 + 7 * Math.min(1, t / T)) * (1 - e) + h.r * e;
        const cx = body.ready ? (body.a.x + body.b.x) / 2 : bx, cz = body.ready ? (body.a.z + body.b.z) / 2 : by;
        const ox = cx + (bx - cx) * e, oz = cz + (by - cz) * e;
        tip.set(ox + Math.cos(th) * rho, grip.y + 5 + (fl + 4 - grip.y - 5) * e, oz + Math.sin(th) * rho);
        setLinks(grip.distanceTo(tip) / pitch * 1.06 + 2, ph === "tele" ? 300 : 2000, dt);
        stepRope(dt, true);
      } else {
        // a slam: whirled overhead through the warning, hurled up and over for its last 0.35 s to smash into the circle's middle
        // as it goes live, and left lying there through its live window and fade
        const gx = h.x, gz = h.y, gy = floorAt(gx, gz) + 0.55;
        const whirl = (tt, out) => {
          const k = Math.min(1, tt / T), rho = 10 + 10 * Math.min(1, k * 1.5), th = (7 + 6 * k) * tt;
          return out.set(bx + Math.cos(th) * rho, fl + 50 + 4 * k, by + Math.sin(th) * rho);
        };
        const FLY = Math.min(0.35, T * 0.4);
        if (ph === "tele" && t < T - FLY) whirl(t, tip);
        else if (ph === "tele") {
          const u = (t - (T - FLY)) / FLY, e = u * u; // (falling: slow over the top, fast into the floor)
          whirl(T - FLY, from);
          tip.lerpVectors(from, v2.set(gx, gy, gz), e);
          tip.y += 30 * Math.sin(Math.PI * Math.min(1, u * 1.3)) * (1 - e);
        } else tip.set(gx, gy, gz);
        setLinks(grip.distanceTo(tip) / pitch * 1.08 + 1.5, ph === "tele" ? 900 : 120, dt);
        stepRope(dt, true);
      }
      draw();
    },
    /** For the checks: the links drawn now and the anchor's ring (world). */
    probe: () => ({ links: P.length - 1 + FIST, tip: P.length ? P[P.length - 1].clone() : null, holding: holdId, clear: clearance() }),
  };
}
