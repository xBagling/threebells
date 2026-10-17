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
import { Mesh, BufferGeometry, BufferAttribute, DynamicDrawUsage, SphereGeometry, ShaderMaterial, AdditiveBlending, DoubleSide } from "./three-lib.js?v=79a60b0-466c2a40";
import { ARENA } from "../config.js?v=79a60b0-466c2a40";

const RINGS = 34;
const SIDES = 12;
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
  const aT = new Float32Array(RINGS * SIDES * 2);
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SIDES; s++) (aT[(r * SIDES + s) * 2] = r / (RINGS - 1)), (aT[(r * SIDES + s) * 2 + 1] = (s / SIDES + 0.75) % 1);
  geo.setAttribute("aT", new BufferAttribute(aT, 2));
  const material = wetMaterial(false);
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const tipMat = wetMaterial(true);
  const tip = new Mesh(new SphereGeometry(1, 16, 12), tipMat);
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
  const ring = []; // (this frame's centre line and radius, for the streaks)
  for (let r = 0; r < RINGS; r++) ring.push({ x: 0, y: 0, z: 0, rad: 0 });

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
      // 2026-10-03). The distance along the lane counts from his mouth's place on it.
      const d0 = Math.max(0, Math.min(L - 4, (mouth[0] - at.x) * ux + (mouth[2] - at.y) * uy));
      for (let r = 0; r < RINGS; r++) {
        const t = r / (RINGS - 1);
        const d = d0 + t * (L - d0);
        const dm = d - d0; // from the mouth
        // Out of the mouth and down to the floor within 15 units, then along the lane. (A level arc over
        // 35 was tried and looked worse: the owner, 2026-10-03.)
        // (down over at least 15 units, or two fifths of its reach: an arc onto the floor, as the owner's pick draws it)
        const drop = Math.min(1, dm / Math.max(15, 0.4 * (L - d0)));
        const hgt = mouth[1] * (1 - drop * drop * (3 - 2 * drop)) + 1.2 * drop;
        // the whip: a sideways wave running out to the tip as it shoots, settled in about 0.2 s
        const whip = 1.8 * Math.exp(-age * 16) * Math.sin(Math.PI * t) * Math.sin(9 * t - age * 46);
        const cx = at.x + ux * d;
        const cz = at.y + uy * d;
        // The first few units bend from the mouth onto the lane's centre line.
        const x = mouth[0] + (cx - mouth[0]) * Math.min(1, dm / 6 + 0.001) - uy * whip;
        const z = mouth[2] + (cz - mouth[2]) * Math.min(1, dm / 6 + 0.001) + ux * whip;
        // Leaving the toad's own mouth it starts slimmer, so it fits between his lips; it tapers toward the tip.
        const rad = radius * (0.62 + 0.38 * (1 - t)) * (own ? Math.min(1, 0.5 + dm / 12) : 1);
        Object.assign(ring[r], { x, y: hgt, z, rad });
        for (let s = 0; s < SIDES; s++) {
          const a = (s / SIDES) * Math.PI * 2;
          // A ring across the lane (side) and up.
          const sx = -uy * Math.cos(a);
          const sz = ux * Math.cos(a);
          const sy = Math.sin(a);
          const o = (r * SIDES + s) * 3;
          pos[o] = x + sx * rad;
          pos[o + 1] = hgt + sy * rad * 0.7;
          pos[o + 2] = z + sz * rad;
          nrm[o] = sx;
          nrm[o + 1] = sy;
          nrm[o + 2] = sz;
        }
      }
      pa.needsUpdate = true;
      na.needsUpdate = true;
      geo.computeBoundingSphere();
      const end = ring[RINGS - 1];
      tip.position.set(end.x + ux * radius * 0.5, Math.max(1.6, end.y), end.z + uy * radius * 0.5); // (on the tongue's end while it is still in the air)
      tip.scale.set(radius * 1.35, radius * 0.95, radius * 1.35); // (a fat sticky pad, flattened on the floor)
      this.tipAt[0] = end.x + ux * radius * 0.5;
      this.tipAt[1] = end.z + uy * radius * 0.5;
      // the streaks: strongest on its outer half, gone 0.22 s after it fired
      const fade = Math.max(0, 1 - age / 0.3);
      streaks.visible = fade > 0;
      if (fade > 0) {
        const offs = [[1, 0.2], [-1, 0.2], [0, 1.2]];
        for (let s2 = 0; s2 < STREAKS; s2++) {
          const [sd, su] = offs[s2];
          for (let r = 0; r < RINGS; r++) {
            const c = ring[r];
            const t = r / (RINGS - 1);
            const off = (c.rad + 1.6) * Math.abs(sd);
            // (a ribbon lying flat, 1.3 wide: stood upright it was a line a pixel thin from the fight's camera)
            const hw = 1.0;
            const bx = c.x - uy * sd * off;
            const bz = c.z + ux * sd * off;
            const by = c.y + su * c.rad;
            const o = (s2 * RINGS + r) * 2 * 3;
            spos[o] = bx - uy * hw;
            spos[o + 1] = by;
            spos[o + 2] = bz + ux * hw;
            spos[o + 3] = bx + uy * hw;
            spos[o + 4] = by;
            spos[o + 5] = bz - ux * hw;
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
