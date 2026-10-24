// Gnasher's tongue (docs/3D-PLAN.md 7.4): a tube along a spline, rebuilt every frame from the lash
// hazard itself, so it cannot disagree with the hitbox. A skinned chain could not reach 210 units,
// and a tongue at mouth height would look as if it missed the lane on the floor, so the spline
// leaves the mouth, comes down to the floor within 15 units and runs along the lane's centre line
// to its end — stopping, with its round tip pad, where the lane's marking is clipped at the floor's
// edge rather than running through the wall. It shoots out in about 0.08 s from the fire, holds
// while the lane is live, and draws back with a little wobble.
// Its look (the owner's pick of three ChatGPT concepts, 2026-10-15: "C", the dramatic whip — .scratch/tongue/concept-C.png):
// a glossy wet tongue (its own shader: pink on top, a deep red underneath, a hard wet highlight and sheen, a darker groove
// down its middle, darker toward the tip), tapering to a fat sticky tip pad, arcing down from the mouth onto the floor;
// whipping as it shoots out (a wave running to its tip, settling in a fifth of a second), with pale speed streaks along
// it. Its impact burst (mud, moss, water, spit, rings) is render3d.js's, where `tipAt` lands.
// Smooth and full at the mouth (the owner, 2026-10-18: "kinda hard edges when he attacks ... a lot smoother, maybe bezier
// curve", "a bit thinner when it comes out of the mouth"). Measured before (.scratch/tongue/smooth): 34 rings of 12 sides up
// to 4.8 units apart, a kink 6 units out (the sideways move onto the lane was a straight blend), neighbouring segments
// turning up to 63° as it fired and 50° in the wide sweep; its rings stood square to the lane, not to the curve, so where it
// ran down or sideways it flattened (0.1 wide at the mouth in the sweep); and it left the mouth at half its width (4.5 x 3.1
// in an opening 12 wide and 5.5 high). Now its centre line is one smooth curve (cubic eases for the drop to the floor and
// the move onto the lane), 160 rings of 24 sides placed by length and bend (at most 2.5 units and 2.5° apart), each ring
// square to the curve, and it fills the mouth's opening where it leaves it (9 x 6.3 at the root covered his lower lip and
// showed its cut end), full 8 units out, tapering to the tip pad.
import { Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage, SphereGeometry, ShaderMaterial, AdditiveBlending, DoubleSide } from "./three-lib.js?v=48fd128-df87a96f";
import { ARENA } from "../config.js?v=48fd128-df87a96f";

const RINGS = 160;
const SIDES = 24;
const FINE = 480; // (the curve sampled this finely first, then the rings placed along it by length and bend)
const SEG = 2.5, TURN = (2.5 * Math.PI) / 180;
const STREAKS = 3;

/**
 * Where the tongue leaves the mouth, from the rigged toad himself: boss3d.js sets `at` to a function
 * giving the root of the tongue in his open mouth this frame (world, [x, y, z]), and the tongue then
 * starts there instead of the point its caller passes (render3d.js's fixed height, at his chest).
 * Null, or a function returning null: the caller's point.
 */
export const tongueMouth = { at: null };
/**
 * The fight's floor (render3d.js sets `out`: sim/arena.js's, how far a point lies outside its edge). The tongue stops at
 * it: clipped at the old circle, on the Bog Shrine's own floor it ran on past the edge into the painted wall, and its tip
 * and splash were hidden behind it (2026-10-15).
 */
export const tongueFloor = { out: null };
/** The last tongue drawn, for the bench's probes (dev-fight.js `__bench.tongue`): its rings' vertices and centre line. */
export const tongueSeen = { pos: null, ring: null, rings: 0, sides: 0, visible: false, mouth: null, tip: null };
/** His tongue's colour: the lash and the tongue lying in his open mouth (53_anim_toad.py "tongue") are one. */
export const TONGUE_COLOR = 0xd0505f;

const WET_VERT = /* glsl */ `
  attribute vec2 aT;       // along it (0 the mouth, 1 the tip), round it (0 on top)
  varying vec2 vT;
  varying vec3 vN, vWN, vP;
  void main() {
    vT = aT;
    vN = normalize(normalMatrix * normal);
    vWN = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vP = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const WET_FRAG = /* glsl */ `
  uniform float uTip;      // 1: the sticky tip pad
  varying vec2 vT;
  varying vec3 vN, vWN, vP;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    vec3 N = normalize(vN), V = normalize(-vP);
    vec3 L = normalize((viewMatrix * vec4(0.35, 1.0, 0.3, 0.0)).xyz);
    float up = vWN.y;
    vec3 pink = lin(vec3(0.80, 0.27, 0.34)), deep = lin(vec3(0.30, 0.04, 0.09)), tipc = lin(vec3(0.70, 0.17, 0.26));   // (a deep red-pink, as concept C: brighter read hot pink)
    vec3 base = mix(deep, pink, smoothstep(-0.55, 0.75, up));
    base = mix(base, base * 0.72, vT.x * 0.45);                                    // darker toward the tip
    float groove = exp(-pow(min(vT.y, 1.0 - vT.y) / 0.07, 2.0));                    // a furrow down its top
    base *= 1.0 - 0.28 * groove * (1.0 - uTip);
    if (uTip > 0.5) base = mix(tipc, deep, smoothstep(0.2, -0.8, up));
    float dif = 0.42 + 0.78 * max(dot(N, L), 0.0);
    float sp = pow(max(dot(reflect(-L, N), V), 0.0), 34.0);
    float sheen = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 col = base * dif + vec3(1.0, 0.92, 0.94) * sp * (uTip > 0.5 ? 1.1 : 0.85) + lin(vec3(1.0, 0.72, 0.78)) * sheen * 0.3;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const STREAK_VERT = /* glsl */ `
  attribute float aA;
  varying float vA;
  void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const STREAK_FRAG = /* glsl */ `
  varying float vA;
  void main() { gl_FragColor = vec4(vec3(1.0, 0.93, 0.9) * vA, vA); }
`;
const wetMaterial = (tip) => new ShaderMaterial({ vertexShader: WET_VERT, fragmentShader: WET_FRAG, uniforms: { uTip: { value: tip ? 1 : 0 } } });

/** The lashing tongue (its own wet material: the argument once given a paint material is no longer used). */
export function makeTongue() {
  const geo = new BufferGeometry();
  const pos = new Float32Array(RINGS * SIDES * 3);
  const nrm = new Float32Array(RINGS * SIDES * 3);
  const idx = [];
  for (let r = 0; r < RINGS - 1; r++)
    for (let s = 0; s < SIDES; s++) {
      const a = r * SIDES + s;
      const b = r * SIDES + ((s + 1) % SIDES);
      const c = (r + 1) * SIDES + s;
      const d = (r + 1) * SIDES + ((s + 1) % SIDES);
      idx.push(a, c, b, b, c, d);
    }
  geo.setIndex(idx);
  const pa = new BufferAttribute(pos, 3);
  const na = new BufferAttribute(nrm, 3);
  pa.setUsage(DynamicDrawUsage);
  na.setUsage(DynamicDrawUsage);
  geo.setAttribute("position", pa);
  geo.setAttribute("normal", na);
  // (round it: the distance from the top, 0..0.5 — folded so no seam runs down the groove on top; along it: set each frame)
  const aT = new Float32Array(RINGS * SIDES * 2);
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SIDES; s++) { const v = (s / SIDES + 0.75) % 1; aT[(r * SIDES + s) * 2 + 1] = Math.min(v, 1 - v); }
  const ta = new BufferAttribute(aT, 2);
  ta.setUsage(DynamicDrawUsage);
  geo.setAttribute("aT", ta);
  const material = wetMaterial(false);
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const tipMat = wetMaterial(true);
  const tip = new Mesh(new SphereGeometry(1, 28, 20), tipMat);
  tip.castShadow = true;
  mesh.add(tip);
  mesh.visible = false;
  // the speed streaks: thin pale ribbons along it, beside and above, while it whips out
  const sgeo = new BufferGeometry();
  const spos = new Float32Array(STREAKS * RINGS * 2 * 3);
  const salpha = new Float32Array(STREAKS * RINGS * 2);
  const sidx = [];
  for (let k = 0; k < STREAKS; k++)
    for (let r = 0; r < RINGS - 1; r++) {
      const a = (k * RINGS + r) * 2;
      sidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  sgeo.setIndex(sidx);
  const spa = new BufferAttribute(spos, 3);
  const saa = new BufferAttribute(salpha, 1);
  spa.setUsage(DynamicDrawUsage);
  saa.setUsage(DynamicDrawUsage);
  sgeo.setAttribute("position", spa);
  sgeo.setAttribute("aA", saa);
  const streaks = new Mesh(sgeo, new ShaderMaterial({ vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true })); // (one pass: added light in any order — backdrop3d.js flameMat)
  streaks.frustumCulled = false;
  mesh.add(streaks);
  const ring = []; // (this frame's centre line, radius, sideways direction and share of the length, for the streaks)
  for (let r = 0; r < RINGS; r++) ring.push({ x: 0, y: 0, z: 0, rad: 0, sx: 0, sz: 0, u: 0 });
  const fine = new Float32Array((FINE + 1) * 3);
  const cost = new Float32Array(FINE + 1);
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const ease5 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));

  return {
    mesh,
    /**
     * `mouth` [x, y, z] (world); `h` the live lash hazard with its in-between { x, y, a }; `k` how
     * far out it is (0..1). Hidden when `h` is null.
     */
    /** Where its tip pad lies (world x, z), after update. */
    tipAt: [0, 0],
    /** `age`: seconds since it fired (the whip and the streaks). */
    update(mouth, h, at, k, radius = 4.5, age = 1) {
      if (!h || k <= 0.001) {
        mesh.visible = false;
        tongueSeen.visible = false;
        return;
      }
      mesh.visible = true;
      const own = tongueMouth.at?.() || null;
      if (own) mouth = own;
      const ux = Math.cos(at.a);
      const uy = Math.sin(at.a);
      // How far along the lane it runs: its length, clipped where the marking ends (R + 2).
      let reach = h.len || 90;
      if (h.kind === "cone") reach = h.r || 90;
      // Solve |at + u·t| = R + 2 for the exit point.
      const bq = at.x * ux + at.y * uy;
      const cq = at.x * at.x + at.y * at.y - (ARENA.R + 2) ** 2;
      const disc = bq * bq - cq;
      if (disc > 0) reach = Math.min(reach, -bq + Math.sqrt(disc));
      if (tongueFloor.out) for (let d = 0; d < reach; d += 2) if (tongueFloor.out(at.x + ux * d, at.y + uy * d) > 1) {
        reach = Math.max(4, d - 2);
        break;
      }
      const L = Math.max(4, reach * k);
      // It starts at the mouth, not at the lane's own start: the lane stays where he stood when the
      // lash began, and he lunges along it, so measured from there the first stretch of the tongue ran
      // back under and beside his body — seen from behind, a tongue coming out of his side (the owner,
      // 2026-10-03). The distance along the lane counts from his mouth's place on it (p0 along, e0 across).
      const p0 = (mouth[0] - at.x) * ux + (mouth[2] - at.y) * uy;
      const e0 = -(mouth[0] - at.x) * uy + (mouth[2] - at.y) * ux;
      const d0 = Math.max(0, p0);
      const Lm = Math.max(3, L - d0); // (its length from the mouth)
      // Out of the mouth and down to the floor over at least 15 units, or two fifths of its length (an arc onto the floor,
      // as the owner's pick draws it; a level arc over 35 was tried and looked worse: the owner, 2026-10-03), and across
      // onto the lane's centre line over at least 10 units (three times the mouth's offset from it): both cubic eases, so
      // the line has no corner (a straight blend over 6 units made one).
      const D = Math.max(15, 0.4 * Lm);
      const Dl = Math.max(10, 3 * Math.abs(e0));
      // (centred in the opening: the root sits on the tongue lying in his mouth, 0.5 under the opening's floor, and the
      // opening rises to the roof of his mouth 4.5 above it)
      const hm = mouth[1] + 1.5;
      const back = 3; // (it starts this far back inside the mouth, so its cut end hides behind his lips)
      const wAmp = 1.8 * Math.exp(-age * 16);
      const centre = (dm, o, i) => {
        const t = Math.max(0, dm) / Lm;
        const sd = ease(dm / D);
        const sl = 1 - ease5(dm / Dl);
        // the whip: a sideways wave running out to the tip as it shoots, settled in about 0.2 s (eased in over its first 8
        // units: started at full slope it kinked at the lips, 8-13° between rings as each lash fired)
        const lat = e0 * sl + wAmp * Math.sin(Math.PI * t) * ease(dm / 8) * Math.sin(9 * t - age * 46);
        const al = d0 + dm + (p0 - d0) * sl;
        o[i] = at.x + ux * al - uy * lat;
        o[i + 1] = hm * (1 - sd) + 1.2 * sd;
        o[i + 2] = at.y + uy * al + ux * lat;
      };
      // The rings, placed along the finely sampled curve so each step is at most SEG long and turns at most TURN.
      const span = Lm + back;
      for (let i = 0; i <= FINE; i++) centre((span * i) / FINE - back, fine, i * 3);
      let px = 0, py = 0, pz = 0;
      cost[0] = 0;
      for (let i = 1; i <= FINE; i++) {
        const o = i * 3;
        const dx = fine[o] - fine[o - 3], dy = fine[o + 1] - fine[o - 2], dz = fine[o + 2] - fine[o - 1];
        const l = Math.hypot(dx, dy, dz) || 1e-6;
        const turn = i > 1 ? Math.acos(Math.max(-1, Math.min(1, (dx * px + dy * py + dz * pz) / l))) : 0;
        cost[i] = cost[i - 1] + l / SEG + turn / TURN;
        (px = dx / l), (py = dy / l), (pz = dz / l);
      }
      const C = cost[FINE];
      const tmp = [0, 0, 0];
      for (let r = 0, i = 0; r < RINGS; r++) {
        const want = (C * r) / (RINGS - 1);
        while (i < FINE - 1 && cost[i + 1] < want) i++;
        const f = Math.max(0, Math.min(1, (want - cost[i]) / Math.max(1e-6, cost[i + 1] - cost[i])));
        const dm = (span * (i + f)) / FINE - back;
        centre(dm, tmp, 0);
        const t = Math.max(0, dm) / Lm;
        // Filling the opening where it leaves the mouth (7.6 x 5.3 in an opening 12 wide and 5.5 high: it was 4.5 x 3.1),
        // full (9 x 6.3) 8 units out, tapering from there toward the tip.
        const rad = radius * (0.62 + 0.38 * (1 - t)) * (0.84 + 0.16 * ease(dm / 8));
        Object.assign(ring[r], { x: tmp[0], y: tmp[1], z: tmp[2], rad, u: t });
      }
      // Each ring square to the curve: its sideways direction level (the tongue's top stays up, where the shader's pink
      // and groove are), its up at right angles to that and the curve.
      const dr = (0.38 * radius) / Lm; // (how fast it narrows: its surface leans that much toward the tip)
      for (let r = 0; r < RINGS; r++) {
        const A = ring[Math.max(0, r - 1)], B = ring[Math.min(RINGS - 1, r + 1)], c = ring[r];
        let tx = B.x - A.x, ty = B.y - A.y, tz = B.z - A.z;
        const tl = Math.hypot(tx, ty, tz) || 1;
        (tx /= tl), (ty /= tl), (tz /= tl);
        let sx = -tz, sz = tx;
        const sl = Math.hypot(sx, sz) || 1;
        (sx /= sl), (sz /= sl);
        // (up = side x tangent)
        const vx = -sz * ty, vy = sz * tx - sx * tz, vz = sx * ty;
        (c.sx = sx), (c.sz = sz);
        for (let s = 0; s < SIDES; s++) {
          const a = (s / SIDES) * Math.PI * 2;
          const ca = Math.cos(a), sa = Math.sin(a);
          const o = (r * SIDES + s) * 3;
          pos[o] = c.x + sx * ca * c.rad + vx * sa * c.rad * 0.7;
          pos[o + 1] = c.y + vy * sa * c.rad * 0.7;
          pos[o + 2] = c.z + sz * ca * c.rad + vz * sa * c.rad * 0.7;
          // (the flattened ring's own normal, leaning toward the tip as it narrows)
          const nx = sx * ca * 0.7 + vx * sa + tx * dr, ny = vy * sa + ty * dr, nz = sz * ca * 0.7 + vz * sa + tz * dr;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nrm[o] = nx / nl;
          nrm[o + 1] = ny / nl;
          nrm[o + 2] = nz / nl;
          aT[(r * SIDES + s) * 2] = c.u;
        }
      }
      pa.needsUpdate = true;
      na.needsUpdate = true;
      ta.needsUpdate = true;
      geo.computeBoundingSphere();
      Object.assign(tongueSeen, { pos, ring, rings: RINGS, sides: SIDES, visible: true, mouth: [...mouth], radius, e0, p0 });
      // (the tip pad on its end, a little on along its last stretch — on the tongue's end while it is still in the air)
      const end = ring[RINGS - 1], pre = ring[RINGS - 2];
      let ex = end.x - pre.x, ez = end.z - pre.z;
      const el = Math.hypot(ex, ez);
      if (el > 1e-4) (ex /= el), (ez /= el);
      else (ex = ux), (ez = uy);
      tip.position.set(end.x + ex * radius * 0.5, Math.max(1.6, end.y), end.z + ez * radius * 0.5);
      tip.scale.set(radius * 1.35, radius * 0.95, radius * 1.35); // (a fat sticky pad, flattened on the floor)
      this.tipAt[0] = end.x + ex * radius * 0.5;
      this.tipAt[1] = end.z + ez * radius * 0.5;
      // the streaks: strongest on its outer half, gone 0.22 s after it fired
      const fade = Math.max(0, 1 - age / 0.3);
      streaks.visible = fade > 0;
      if (fade > 0) {
        const offs = [[1, 0.2], [-1, 0.2], [0, 1.2]];
        for (let s2 = 0; s2 < STREAKS; s2++) {
          const [sd, su] = offs[s2];
          for (let r = 0; r < RINGS; r++) {
            const c = ring[r];
            const t = c.u;
            const off = (c.rad + 1.6) * Math.abs(sd);
            // (a ribbon lying flat, 1.3 wide: stood upright it was a line a pixel thin from the fight's camera)
            const hw = 1.0;
            const bx = c.x + c.sx * sd * off;
            const bz = c.z + c.sz * sd * off;
            const by = c.y + su * c.rad;
            const o = (s2 * RINGS + r) * 2 * 3;
            spos[o] = bx + c.sx * hw;
            spos[o + 1] = by;
            spos[o + 2] = bz + c.sz * hw;
            spos[o + 3] = bx - c.sx * hw;
            spos[o + 4] = by;
            spos[o + 5] = bz - c.sz * hw;
            const a = 1.0 * fade * Math.max(0, Math.min(1, (t - 0.15) / 0.5)) * (1 - Math.max(0, (t - 0.9) / 0.1)) * (s2 === 2 ? 0.7 : 1);
            salpha[(s2 * RINGS + r) * 2] = salpha[(s2 * RINGS + r) * 2 + 1] = a;
          }
        }
        spa.needsUpdate = true;
        saa.needsUpdate = true;
        sgeo.computeBoundingSphere();
      }
    },
    dispose() {
      geo.dispose();
      tip.geometry.dispose();
      sgeo.dispose();
      material.dispose();
      tipMat.dispose();
      streaks.material.dispose();
    },
  };
}
