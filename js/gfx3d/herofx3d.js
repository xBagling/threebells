// The hero's motion effects in 3D (docs/3D-PLAN.md 7.3), the 2D ones rebuilt:
//
//   afterimages   during a roll and 0.1 s after, four ghost copies of the body, one taken every 2
//                 ticks, shown 2/4/6/8 ticks old at 0.35/0.25/0.15/0.08 — mint while the roll
//                 cannot be hit, grey once it can, so the ghosts show the invulnerable window
//   sword trail   a ribbon over the blade's outer part to its tip (hero3d.js bladeBase, bladeTip),
//                 sampled every screen frame (not every tick) and filled in along the arc round the
//                 hero between samples, the whole cut from its release (the last 30% of the
//                 wind-up) through the live window, fading late (wider for the heavy); ages on
//                 sim-view time, so at the moment of impact the hit-stop holds it on screen; hidden
//                 where his own body and cape stand in front of it
//                 — a cut fitted to the owner's video (the sword's) draws the video's own blur instead: pale
//                 see-through white over the blade's outer third, by the tip's speed, the blade turned between samples
//
// No blade ghosts (faint copies of the blade 25/50/75 ms behind it): a light line after the slash, the
// owner, 2026-10-04 — the trail alone shows the cut.
//
// One slash only, the sword's own (the owner: "there are two slashes when he is attacking. It
// should only be one, and that should be based on the length of his sword"): the ground crescent
// at the sim's reach that 2D draws is not drawn here.
import { Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage, MeshBasicMaterial, DoubleSide, Vector3, Quaternion, SkeletonUtils, Color } from "./three-lib.js?v=df092a6";
import { TICK } from "../config.js?v=df092a6";
import { STATE, moveOf } from "../sim/player.js?v=df092a6";
import { smoothstep } from "./anim/procedural.js?v=df092a6";

const GHOSTS = [
  [2, 0.35],
  [4, 0.25],
  [6, 0.15],
  [8, 0.08],
];
const MINT = new Color(0x8fffd0);
const GREY = new Color(0x9aa3b5);
/** The sword trail starts this share of the wind-up before the live window (the release) and holds the whole cut from there. */
const TRAIL_FROM_RELEASE = 0.3;

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

/**
 * A blade between two samples turned about its base: the base along the straight line between the two, the blade's
 * direction turned the short way and its length in between — a cut in any plane comes out a smooth fan.
 */
const qTurn = new Quaternion(), vA = new Vector3(), vB = new Vector3();
function bladeLerp(pb, pt, qb, qt, u, outB, outT) {
  outB.copy(pb).lerp(qb, u);
  vA.subVectors(pt, pb); vB.subVectors(qt, qb);
  const la = vA.length(), lb = vB.length();
  if (la < 1e-6 || lb < 1e-6) return outT.copy(pt).lerp(qt, u);
  qTurn.setFromUnitVectors(vA.normalize(), vB.normalize());
  qTurn.slerp(new Quaternion(), 1 - u); // (from no turn to the whole turn by u)
  return outT.copy(vA).applyQuaternion(qTurn).multiplyScalar(la + (lb - la) * u).add(outB);
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

  // --- the sword trails: the striking blade's, and a paired attack's second blade's ---------------------
  const N = 160; // points along the ribbon (samples, and the arcs filled in between them; 64 cut a video cut's turn-stepped ribbon short)
  const tIdx = [];
  for (let i = 0; i < N - 1; i++) tIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const makeTrail = () => {
    const pos = new Float32Array(N * 2 * 3);
    const col = new Float32Array(N * 2 * 4);
    const geo = new BufferGeometry();
    geo.setIndex(tIdx);
    const pa = new BufferAttribute(pos, 3);
    const ca = new BufferAttribute(col, 4);
    pa.setUsage(DynamicDrawUsage);
    ca.setUsage(DynamicDrawUsage);
    geo.setAttribute("position", pa);
    geo.setAttribute("color", ca);
    // Painted over the scene (not added to it): added light washes out to a pale film on the sunny
    // lawn, where 2D's slash is a crisp cyan stroke with a white edge.
    const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    mesh.visible = false;
    scene.add(mesh);
    // (Hidden where his body or cape stands in front of it, as anything is: a fainter copy drawn through him
    // read as wrong seen from behind — the owner, 2026-10-04.)
    const samples = []; // newest first: { t, base: Vector3, tip: Vector3 }
    const path = Array.from({ length: N }, () => ({ b: new Vector3(), t: new Vector3(), age: 0, speed: 0 }));
    return { mesh, geo, pos, col, pa, ca, samples, path };
  };
  const trails = [makeTrail(), makeTrail()];
  const baseW = new Vector3();
  const tipW = new Vector3();

  return {
    /** What it adds to the scene (the trails, the afterimages): the bench's empty stage keeps them. */
    objects: [...trails.map((tr) => tr.mesh), ...ghosts.map((g) => g.root)],
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

      // The sword trails, sampled every frame: the striking blade (the off weapon's in an off-hand chain), and in a
      // paired attack the off blade too (the sim's second blade, arc.alt). The blade's base and tip (sword3d.js); a
      // frozen frame (the hit-stop) adds nothing, so the trail holds as it was.
      const blade = hero.blade;
      const live = s.state === STATE.ATTACK;
      const strikes = [hero.strikeOf ? hero.strikeOf(p) : blade && { group: blade, base: hero.bladeBase, tip: hero.bladeTip }, live && hero.pairedOf ? hero.pairedOf(p) : null];
      // (the move under way: any weapon's, its finisher or slam the heavy one)
      const c = moveOf(p);
      const heavy = c.fx === "heavy" && live;
      // The ribbon holds the whole cut, from the release to the blade (the third review: holding
      // only the last 90 ms, swing2's trail was a 60° fan at his right; the dip to the hip and the
      // rise across the front were gone before the live window ended, where the 2D swing2 draws its
      // whole wide arc at once).
      // (the lead before the live window at most 0.16 s: at the owner's video's slow tempo a share of the wind-up
      // lit the ribbon through the chop's whole high hold, where the video shows the blade's blur only from 0.06-0.16 s
      // before each sweep; at the game's pace every lead is under it, 0.03-0.05 s)
      const lead = Math.min(TRAIL_FROM_RELEASE * c.wind, 0.16);
      const keep = Math.max(heavy ? 0.13 : 0.09, lead + c.active + 0.02);
      // (a cut fitted to the owner's video: only through the hit itself — the owner, 2026-10-08: "the sword trail should
      // only be visible in the 'heavy' part of the swings where it is actually hitting"; the blur by the tip's speed in it)
      const videoTrail = !!hero.cutPose?.track;
      const inWindow = live && (videoTrail ? s.t >= c.wind - 0.02 && s.t <= c.wind + c.active + 0.06 : s.t >= c.wind - lead && s.t <= c.wind + c.active + 0.06);
      trails.forEach((tr, j) => {
        const st = strikes[j];
        const { samples, path } = tr;
        if (!st) samples.length = 0;
        else if (live && (!samples.length || viewT > samples[0].t + 1e-6)) {
          st.group.updateWorldMatrix(true, false);
          st.group.localToWorld(baseW.copy(st.base));
          st.group.localToWorld(tipW.copy(st.tip));
          // (the tip's speed into this sample: a cut fitted to the owner's video draws its blur as the video's camera did —
          // faint where the blade moves slowly, as in the chop's slow lift overhead, where a full ribbon was a flat sheet)
          const prev = samples[0], dtS = prev ? viewT - prev.t : 0;
          const speed = prev && dtS > 1e-6 ? tipW.distanceTo(prev.tip) / dtS : prev?.speed ?? 0;
          samples.unshift({ t: viewT, base: baseW.clone(), tip: tipW.clone(), speed, st: s.t, step: p.step });
        }
        while (samples.length && (viewT - samples[samples.length - 1].t > Math.max(keep, 0.08) || samples.length > 40)) samples.pop();
        // (the video cut's ribbon starts at the hit: nothing kept from the wind-up before it)
        if (videoTrail && live) while (samples.length > 1 && (samples[samples.length - 1].step !== p.step || samples[samples.length - 1].st < c.wind - 0.02)) samples.pop();
        tr.mesh.visible = !!st && inWindow && samples.length > 1 && !globalThis.__noTrail;
        if (!tr.mesh.visible) return;
        // The path: every sample, and between two samples points along the arc round the hero, so
        // the ribbon is a smooth crescent at any frame rate. It spans the blade's outer part (more
        // of it for the heavy), bright at the tip and at the leading end, fading with age.
        let n = 0;
        // (a video cut's ribbon is the sweep under way only: back to where the tip last turned back — through the chop's
        // turn at the top of its lift the ribbon folded on itself, a jagged sheet; a blur shows one sweep)
        let lastI = samples.length - 1;
        if (videoTrail) for (let i = 1; i + 1 < samples.length; i++) {
          const d0 = samples[i - 1].tip.clone().sub(samples[i].tip), d1 = samples[i].tip.clone().sub(samples[i + 1].tip);
          if (d0.lengthSq() > 1e-6 && d1.lengthSq() > 1e-6 && d0.angleTo(d1) > 1.3) { lastI = i; break; } // (or turned sharply: over 75°)
        }
        for (let i = 0; i <= lastI && n < N; i++) {
          const a = samples[i];
          const b = i < lastI ? samples[i + 1] : null;
          // (a video cut's blade turned between the samples: steps by the turn too, every 6° — at the game's pace the chop
          // turns 60°+ a frame, and 8 steps by the tip's travel folded the ribbon into a jagged sheet seen from the side)
          const turn = b && videoTrail ? a.tip.clone().sub(a.base).angleTo(b.tip.clone().sub(b.base)) : 0;
          const steps = b ? Math.min(videoTrail ? 16 : 8, Math.max(1, Math.ceil(a.tip.distanceTo(b.tip) / 1.2), Math.ceil(turn / 0.1))) : 1;
          for (let k = 0; k < steps && n < N; k++) {
            const u = k / steps;
            const pt = path[n++];
            if (!b || k === 0) {
              pt.b.copy(a.base);
              pt.t.copy(a.tip);
              pt.age = viewT - a.t;
              pt.speed = a.speed;
            } else if (videoTrail) {
              // (a cut fitted to the owner's video: the blade itself turned between the samples about its sliding base —
              // round the hero's upright axis the overhead lift of the chop came out a flat sheet with straight edges)
              bladeLerp(a.base, a.tip, b.base, b.tip, u, pt.b, pt.t);
              pt.age = viewT - (a.t + (b.t - a.t) * u);
              pt.speed = a.speed + (b.speed - a.speed) * u;
            } else {
              arcLerp(a.base, b.base, u, p.x, p.y, pt.b);
              arcLerp(a.tip, b.tip, u, p.x, p.y, pt.t);
              pt.age = viewT - (a.t + (b.t - a.t) * u);
            }
          }
        }
        // As 2D's slash: a near-white edge at the tip over a cyan body (warm gold for the heavy),
        // the colours linear.
        // A cut fitted to the owner's video draws the video's own blur (the owner, 2026-10-08: "The sword trail, should be as
        // in the images in the video"): a pale, see-through white crescent over the blade's outer third, brightest and
        // crispest along the tip's path, soft towards the hilt — no colour.
        const edge = videoTrail ? [0.97, 0.98, 1] : heavy ? [1, 0.86, 0.55] : [0.62, 1, 1];
        const body = videoTrail ? [0.9, 0.92, 0.95] : heavy ? [1, 0.45, 0.08] : [0.02, 0.6, 0.92];
        const inner = videoTrail ? 0.65 : heavy ? 0.2 : 0.3; // where on the blade the ribbon starts
        const [aBody, aEdge] = videoTrail ? [0.06, 0.55] : [0.12, 0.95];
        for (let i = 0; i < N; i++) {
          const pt = path[Math.min(i, n - 1)];
          // (Fading late: the start of the arc stays on until the cut is done.)
          const fade = i < n ? Math.max(0, 1 - (pt.age / keep) ** 2) * (videoTrail ? smoothstep(25, 80, pt.speed) : 1) : 0;
          baseW.copy(pt.b).lerp(pt.t, inner);
          // Never under the ground (the heavy's tip meets it): seen through the lawn it would show.
          tr.pos.set([baseW.x, Math.max(0.3, baseW.y), baseW.z, pt.t.x, Math.max(0.3, pt.t.y), pt.t.z], i * 6);
          tr.col.set([...body, fade * aBody, ...edge, (videoTrail ? fade : fade * fade) * aEdge], i * 8);
        }
        tr.pa.needsUpdate = true;
        tr.ca.needsUpdate = true;
      });
    },
    dispose() {
      for (const g of ghosts) g.mat.dispose();
      for (const tr of trails) {
        tr.geo.dispose();
        tr.mesh.material.dispose();
      }
    },
  };
}
