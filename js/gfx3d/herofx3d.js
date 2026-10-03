// The hero's motion effects in 3D (docs/3D-PLAN.md 7.3), the 2D ones rebuilt:
//
//   afterimages   during a roll and 0.1 s after, four ghost copies of the body, one taken every 2
//                 ticks, shown 2/4/6/8 ticks old at 0.35/0.25/0.15/0.08 — mint while the roll
//                 cannot be hit, grey once it can, so the ghosts show the invulnerable window
//   sword trail   a ribbon over the blade's outer part to its tip (hero3d.js bladeBase, bladeTip),
//                 sampled every screen frame (not every tick) and filled in along the arc round the
//                 hero between samples, the whole cut from its release (the last 30% of the
//                 wind-up) through the live window, fading late (wider for the heavy); ages on
//                 sim-view time, so at the moment of impact the hit-stop holds it on screen; where
//                 the hero's own body and cape hide it (cutting away from the camera) it shows
//                 through them at half strength
//   blade ghosts  in the live window, three faint copies of the blade 25/50/75 ms behind it
//
// One slash only, the sword's own (the owner: "there are two slashes when he is attacking. It
// should only be one, and that should be based on the length of his sword"): the ground crescent
// at the sim's reach that 2D draws is not drawn here.
import { Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage, MeshBasicMaterial, AdditiveBlending, DoubleSide, GreaterDepth, Vector3, Quaternion, SkeletonUtils, Color } from "./three-lib.js?v=8898846";
import { PLAYER, TICK } from "../config.js?v=8898846";
import { STATE } from "../sim/player.js?v=8898846";

const GHOSTS = [
  [2, 0.35],
  [4, 0.25],
  [6, 0.15],
  [8, 0.08],
];
const MINT = new Color(0x8fffd0);
const GREY = new Color(0x9aa3b5);
/** How strongly the sword trail shows through whatever stands in front of it (the hero himself, most often). */
export const TRAIL_XRAY = 0.5;
/** The sword trail starts this share of the wind-up before the live window (the release) and holds the whole cut from there. */
export const TRAIL_FROM_RELEASE = 0.3;
/** The blade's ghosts in a cut: [seconds behind, opacity]. */
const BLADE_GHOSTS = [
  [0.025, 0.3],
  [0.05, 0.18],
  [0.075, 0.09],
];

/**
 * A point between two blade samples, along the arc round the hero (`cx`, `cz`) rather than the
 * straight chord between them: a cut turns about the body, so at 60 frames a second (0.4 rad a frame)
 * a trail drawn through the chords would come out as a polygon. The angle goes the short way; the
 * distance from the hero and the height go straight.
 */
export function arcLerp(p, q, u, cx, cz, out) {
  const a0 = Math.atan2(p.z - cz, p.x - cx);
  let da = Math.atan2(q.z - cz, q.x - cx) - a0;
  da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
  const r = Math.hypot(p.x - cx, p.z - cz) * (1 - u) + Math.hypot(q.x - cx, q.z - cz) * u;
  const a = a0 + da * u;
  return out.set(cx + Math.cos(a) * r, p.y + (q.y - p.y) * u, cz + Math.sin(a) * r);
}

export function makeHeroFx(scene, hero) {
  // --- afterimages -------------------------------------------------------------------------------------
  const ghosts = GHOSTS.map(([, alpha]) => {
    const root = SkeletonUtils.clone(hero.model);
    const mat = new MeshBasicMaterial({ color: MINT, transparent: true, opacity: alpha, depthWrite: false, toneMapped: false });
    const bones = [];
    root.traverse((o) => {
      if (o.isSkinnedMesh && o.material?.userData?.outline) o.visible = false; // no outline on a ghost
      else if (o.isSkinnedMesh) {
        o.material = mat;
        o.castShadow = false;
        o.frustumCulled = false;
      } else if (o.isMesh) o.visible = false; // hulls and the sword stay off the ghost
      if (o.isBone) bones.push(o);
    });
    root.visible = false;
    root.matrixAutoUpdate = false;
    scene.add(root);
    return { root, mat, bones, alpha };
  });
  const srcBones = [];
  hero.model.traverse((o) => o.isBone && srcBones.push(o));
  const snaps = []; // newest first: { t, matrix, quats, poss, mint }
  let lastSnapT = -1;
  let rollSeen = -1;

  // --- the sword trail ---------------------------------------------------------------------------------
  const N = 64; // points along the ribbon (samples, and the arcs filled in between them)
  const tPos = new Float32Array(N * 2 * 3);
  const tCol = new Float32Array(N * 2 * 4);
  const tGeo = new BufferGeometry();
  const tIdx = [];
  for (let i = 0; i < N - 1; i++) tIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  tGeo.setIndex(tIdx);
  const tpa = new BufferAttribute(tPos, 3);
  const tca = new BufferAttribute(tCol, 4);
  tpa.setUsage(DynamicDrawUsage);
  tca.setUsage(DynamicDrawUsage);
  tGeo.setAttribute("position", tpa);
  tGeo.setAttribute("color", tca);
  // Painted over the scene (not added to it): added light washes out to a pale film on the sunny
  // lawn, where 2D's slash is a crisp cyan stroke with a white edge.
  const trail = new Mesh(tGeo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false }));
  trail.frustumCulled = false;
  trail.renderOrder = 5;
  scene.add(trail);
  // ...and where something stands in front of it — the hero's own body and cape, most of all, when
  // he cuts facing away from the camera (the view of most of a fight) — seen through it, fainter,
  // so every cut's arc reads whichever way he faces.
  const trailX = new Mesh(tGeo, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: TRAIL_XRAY, depthWrite: false, depthFunc: GreaterDepth, side: DoubleSide, toneMapped: false }));
  trailX.frustumCulled = false;
  trailX.renderOrder = 5;
  scene.add(trailX);
  const samples = []; // newest first: { t, base: Vector3, tip: Vector3, pos: Vector3, quat: Quaternion }
  const baseW = new Vector3();
  const tipW = new Vector3();
  const path = Array.from({ length: N }, () => ({ b: new Vector3(), t: new Vector3(), age: 0 }));

  // --- the blade's afterimages -----------------------------------------------------------------------
  // Faint copies of the blade along its path in the live window, 25, 50 and 75 ms behind it: the
  // sword's own ghosts, as the roll has the body's.
  const bladeMesh = hero.sword?.meshes?.[0];
  const bladeGhosts = bladeMesh
    ? BLADE_GHOSTS.map(([, alpha]) => {
        const m = new Mesh(bladeMesh.geometry, new MeshBasicMaterial({ color: 0xcdefff, transparent: true, opacity: alpha, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
        m.visible = false;
        m.frustumCulled = false;
        m.renderOrder = 5;
        scene.add(m);
        return m;
      })
    : [];
  const gPos = new Vector3();
  const gQuat = new Quaternion();
  const gScale = new Vector3();

  return {
    /** After the hero is posed. `p` the hero, `s` = lerp3d.hero, `viewT` sim-view seconds. */
    update(p, s, viewT) {
      hero.object.updateMatrixWorld(true);
      // Afterimages: a snapshot every 2 ticks while rolling and just after.
      if (s.state === STATE.ROLL) rollSeen = viewT;
      const rolling = rollSeen >= 0 && viewT - rollSeen < 0.1;
      if (rolling && (lastSnapT < 0 || viewT - lastSnapT >= 2 * TICK - 1e-6)) {
        lastSnapT = viewT;
        const old = snaps.length >= GHOSTS.length ? snaps.pop() : { quats: srcBones.map((b) => b.quaternion.clone()), poss: srcBones.map((b) => b.position.clone()), matrix: hero.model.matrixWorld.clone() };
        srcBones.forEach((b, i) => (old.quats[i].copy(b.quaternion), old.poss[i].copy(b.position)));
        old.matrix.copy(hero.model.matrixWorld);
        old.t = viewT;
        old.mint = p.iFrames > 0;
        old.x = p.x;
        old.y = p.y;
        snaps.unshift(old);
      }
      if (!rolling) snaps.length = 0;
      ghosts.forEach((g, i) => {
        const snap = snaps[i + 1]; // the newest is under the body itself
        const show = rolling && snap && Math.hypot(snap.x - p.x, snap.y - p.y) > 3;
        g.root.visible = !!show;
        if (!show) return;
        g.root.matrix.copy(snap.matrix);
        g.root.matrixWorldNeedsUpdate = true;
        g.bones.forEach((b, k) => (b.quaternion.copy(snap.quats[k]), b.position.copy(snap.poss[k])));
        g.mat.color.copy(snap.mint ? MINT : GREY);
        g.mat.opacity = g.alpha;
      });

      // The sword trail, sampled every frame.
      // The blade's base and tip (sword3d.js), and its whole frame for the ghosts; a frozen frame
      // (the hit-stop) adds nothing, so the trail holds as it was.
      const blade = hero.blade;
      const live = s.state === STATE.ATTACK;
      if (blade && live && (!samples.length || viewT > samples[0].t + 1e-6)) {
        blade.localToWorld(baseW.copy(hero.bladeBase));
        blade.localToWorld(tipW.copy(hero.bladeTip));
        blade.matrixWorld.decompose(gPos, gQuat, gScale);
        samples.unshift({ t: viewT, base: baseW.clone(), tip: tipW.clone(), pos: gPos.clone(), quat: gQuat.clone() });
      }
      const heavy = p.step === 2 && live;
      const c = PLAYER.combo[Math.min(2, p.step || 0)];
      // The ribbon holds the whole cut, from the release to the blade (the third review: holding
      // only the last 90 ms, swing2's trail was a 60° fan at his right; the dip to the hip and the
      // rise across the front were gone before the live window ended, where the 2D swing2 draws its
      // whole wide arc at once).
      const keep = Math.max(heavy ? 0.13 : 0.09, TRAIL_FROM_RELEASE * c.wind + c.active + 0.02);
      while (samples.length && (viewT - samples[samples.length - 1].t > Math.max(keep, 0.08) || samples.length > 40)) samples.pop();
      const inWindow = live && s.t >= c.wind * (1 - TRAIL_FROM_RELEASE) && s.t <= c.wind + c.active + 0.06;
      trail.visible = trailX.visible = inWindow && samples.length > 1;
      if (trail.visible) {
        // The path: every sample, and between two samples points along the arc round the hero, so
        // the ribbon is a smooth crescent at any frame rate. It spans the blade's outer part (more
        // of it for the heavy), bright at the tip and at the leading end, fading with age.
        let n = 0;
        for (let i = 0; i < samples.length && n < N; i++) {
          const a = samples[i];
          const b = samples[i + 1];
          const steps = b ? Math.min(8, Math.max(1, Math.ceil(a.tip.distanceTo(b.tip) / 1.2))) : 1;
          for (let k = 0; k < steps && n < N; k++) {
            const u = k / steps;
            const pt = path[n++];
            if (!b || k === 0) {
              pt.b.copy(a.base);
              pt.t.copy(a.tip);
              pt.age = viewT - a.t;
            } else {
              arcLerp(a.base, b.base, u, p.x, p.y, pt.b);
              arcLerp(a.tip, b.tip, u, p.x, p.y, pt.t);
              pt.age = viewT - (a.t + (b.t - a.t) * u);
            }
          }
        }
        // As 2D's slash: a near-white edge at the tip over a cyan body (warm gold for the heavy),
        // the colours linear.
        const edge = heavy ? [1, 0.86, 0.55] : [0.62, 1, 1];
        const body = heavy ? [1, 0.45, 0.08] : [0.02, 0.6, 0.92];
        const inner = heavy ? 0.2 : 0.3; // where on the blade the ribbon starts
        for (let i = 0; i < N; i++) {
          const pt = path[Math.min(i, n - 1)];
          // (Fading late: the start of the arc stays on until the cut is done.)
          const fade = i < n ? Math.max(0, 1 - (pt.age / keep) ** 2) : 0;
          baseW.copy(pt.b).lerp(pt.t, inner);
          // Never under the ground (the heavy's tip meets it): seen through the lawn it would show.
          tPos.set([baseW.x, Math.max(0.3, baseW.y), baseW.z, pt.t.x, Math.max(0.3, pt.t.y), pt.t.z], i * 6);
          tCol.set([...body, fade * 0.12, ...edge, fade * fade * 0.95], i * 8);
        }
        tpa.needsUpdate = true;
        tca.needsUpdate = true;
      }
      // The blade's ghosts, in the live window and just after.
      const ghostsOn = live && s.t >= c.wind && s.t <= c.wind + c.active + 0.05 && samples.length > 1;
      bladeGhosts.forEach((g, i) => {
        g.visible = false;
        if (!ghostsOn) return;
        const want = viewT - BLADE_GHOSTS[i][0];
        for (let k = 0; k < samples.length - 1; k++) {
          const a = samples[k];
          const b = samples[k + 1];
          if (b.t <= want && a.t >= want) {
            const u = a.t > b.t ? (a.t - want) / (a.t - b.t) : 0;
            arcLerp(a.pos, b.pos, u, p.x, p.y, g.position);
            g.quaternion.slerpQuaternions(a.quat, b.quat, u);
            g.scale.copy(gScale);
            g.material.color.setHex(heavy ? 0xffe0b0 : 0xcdefff);
            g.visible = true;
            break;
          }
        }
      });
    },
    dispose() {
      for (const g of ghosts) g.mat.dispose();
      for (const g of bladeGhosts) g.material.dispose();
      tGeo.dispose();
      trail.material.dispose();
      trailX.material.dispose();
    },
  };
}
