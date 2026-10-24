// The Drowned King's geysers (the owner, 2026-10-19: "I think one part of the fight should be that it could spray up water from
// the 4 watersinks"): what the sim's "geyser" circles (content/bosses.js GEYSER, at the Drowned Hall's drain grates) look like.
//   wind-up (1.0 s): water wells up in the grate and bubbles, a low dome of it rising, drops jumping off it, and the painted
//     floor round it ripples out to the edge of what will be hit (backdrop3d.js shockAt: the wet-telegraph language of
//     Gnasher's landings — the red marking only in Demo mode, render3d.js); a low rumble
//   live (0.6 s): a column of water shoots up out of the grate — a translucent body with streaks running up it, a foam crown,
//     spray thrown off it all the while — with a burst of drops and rings on the painted water near it; a big splash
//   after: it falls back — the column sinking, a ring of spray landing round it — and the water in the grate drains away (a
//     dark wet patch over the grate shrinking and drying), gurgling
// Only the view: nothing here reaches the sim. Its own random (never Math.random's) drives the drops.
import { Mesh, CylinderGeometry, CircleGeometry, ShaderMaterial, NormalBlending, Vector3 } from "./three-lib.js?v=48fd128-df87a96f";
import { phaseOf } from "../sim/hazards.js?v=48fd128-df87a96f";
import { rng } from "../util.js?v=48fd128-df87a96f";
import { sfx } from "../audio.js?v=48fd128-df87a96f";

const TAU = Math.PI * 2;
const COL_R = 11; // (the column's radius at its foot: the grates are 33-40 units across in the painting, the column most of one)
const COL_H = 64; // (its height at full: three times the hero's 19.6 — over the dais's braziers seen from the floor)
const GRATE_R = 16; // (the water in the grate)
const DROPS = ["#e6f4fa", "#b8d8e6", "#8fb8cc", "#cfeaf2"];

// (its noise hashed without sin(): ANGLE's Direct3D sin of the large numbers a scrolling hash feeds it came back nearly
// smooth, and the streaks melted into one even milky glare — "hash without sine", Dave Hoskins, MIT)
// The water: a cylinder pushed out and wobbled by noise, streaks running up it, see-through in its middle and bright at its
// edges (where a sheet of water is seen edge-on), foam at its crown; lit cold by the moon, a breath of the braziers' green.
const colVert = /* glsl */ `
  uniform float uTime, uH, uR, uRise;
  varying vec2 vUv;
  varying float vRim, vY;
  float h1(float n) { n = fract(n * 0.1031); n *= n + 33.33; n *= n + n; return fract(n); }
  float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
  void main() {
    vUv = uv;
    float y = position.y + 0.5;                 // 0 foot .. 1 crown
    vY = y;
    float a = atan(position.z, position.x);
    // (a jet: full at the grate, drawn in as it climbs, then fanning out at its crown where the water breaks and falls)
    float prof = mix(1.0, 0.55, smoothstep(0.0, 0.55, y)) + 0.9 * smoothstep(0.7, 1.0, y) * uRise;
    float wob = 1.0 + 0.22 * (n1(a * 2.0 + y * 7.0 - uTime * 10.0) - 0.5) * (0.4 + y) + 0.07 * sin(uTime * 23.0 + y * 17.0 + a * 3.0);
    vec3 p = vec3(position.x * uR * prof * wob, y * uH, position.z * uR * prof * wob);
    // (the crown droops as it fans: its outer water already falling)
    p.y -= 0.12 * uH * smoothstep(0.75, 1.0, y) * uRise * (0.6 + 0.4 * n1(a * 3.0 + uTime * 4.0));
    p.x += sin(uTime * 3.1) * 1.6 * y * y * uRise; p.z += cos(uTime * 2.7) * 1.3 * y * y * uRise;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 nv = normalize(mat3(modelViewMatrix) * vec3(position.x, 0.0, position.z));
    vRim = 1.0 - abs(nv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const colFrag = /* glsl */ `
  uniform float uTime, uA, uRise;
  varying vec2 vUv;
  varying float vRim, vY;
  float h2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float y = vY;
    // streaks running up the water, long and quick, and finer ones over them
    float s = n2(vec2(vUv.x * 36.0, y * 2.5 - uTime * 6.5)) * 0.55 + n2(vec2(vUv.x * 90.0, y * 6.0 - uTime * 12.0)) * 0.45;
    // (torn: gaps open in the sheet, more toward its crown, where it is spray)
    float tear = n2(vec2(vUv.x * 22.0, y * 9.0 - uTime * 9.0));
    if (tear < 0.12 + 0.55 * smoothstep(0.55, 1.0, y) * uRise) discard;
    float foam = smoothstep(0.6, 0.95, y) * uRise * smoothstep(0.35, 0.8, tear);
    foam = max(foam, smoothstep(0.86, 0.98, s) * 0.35);
    vec3 deep = vec3(0.012, 0.04, 0.075), lit = vec3(0.5, 0.68, 0.84);
    // (bright only along its streaks' crests: water catches the moon in thin lines — lit all over, it read as frosted glass;
    // the scene is linear, so a mid blue here shows pale)
    float line = smoothstep(0.62, 0.85, s);
    vec3 c = mix(deep, lit, line * (0.6 + 0.4 * vRim));
    c += vec3(0.01, 0.035, 0.028) * vRim;                      // (the braziers' green caught on its edges: a breath — linear light)
    c = mix(c, vec3(0.78, 0.88, 0.95), foam);
    // (see-through in its middle, a sheet of water seen edge-on at its sides)
    // (blended in the scene's linear light, where half black only dims a pale blue by a quarter: a water body this dark must be
    // mostly opaque to read darker than the moonlit sea behind it)
    float a = 0.5 + 0.25 * vRim + 0.25 * line;
    a = clamp(max(a, foam * 0.9), 0.0, 1.0) * uA;
    a *= smoothstep(0.0, 0.05, y);                              // (its foot melts into the water in the grate)
    gl_FragColor = vec4(c * a, a);
  }
`;
// The water in the grate and the wet patch round it: a disc on the floor, rippling as it wells up, darker as it drains.
const poolFrag = /* glsl */ `
  uniform float uTime, uFill, uWet;
  varying vec2 vUv;
  float h2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  void main() {
    vec2 d = vUv * 2.0 - 1.0;
    float r = length(d);
    if (r > 1.0) discard;
    // (the grate's own water, welling: bright rings running out over it, bubbles winking)
    float wob = h2(floor(vec2(atan(d.y, d.x) * 3.0, r * 4.0) + floor(uTime * 6.0))) * 0.8;
    float ring = pow(sin(r * 15.0 - uTime * 7.0 + wob) * 0.5 + 0.5, 4.0);
    float bub = step(0.97, h2(floor(d * 7.0) + floor(uTime * 7.0)));
    vec3 w = mix(vec3(0.04, 0.1, 0.15), vec3(0.5, 0.66, 0.8), ring * 0.35 + bub * 0.7);
    float a = uFill * (1.0 - smoothstep(0.6, 1.0, r)) * (0.42 + 0.18 * ring + bub * 0.4);
    // (and drained: only the wet dark left, shrinking to the middle as it dries)
    float wet = uWet * (1.0 - smoothstep(0.35 + 0.6 * uWet, 0.4 + 0.6 * uWet, r)) * 0.45;
    vec3 c = w * a;
    float aa = clamp(a + wet, 0.0, 0.9);
    gl_FragColor = vec4(c, aa);
  }
`;
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/**
 * `bd`: the loaded backdrop (its image camera, meta.ref — for the painted floor's ripples); `burst(x, y, n, o)`: the particles.
 * Returns { objects, update(w, now, dt), shocks(), ripples() } — shocks and ripples in backdrop3d.js setShocks/setRipples form.
 */
export function makeGeysers(bd, { burst } = {}) {
  const r = bd?.meta?.ref;
  const rand = rng(0x6e75);
  const f = r ? r.image.h / 2 / Math.tan((r.vfov * Math.PI) / 360) : 1;
  const P = r ? new Vector3(...r.pos) : null, RV = r ? new Vector3(...r.right) : null, UV = r ? new Vector3(...r.up) : null, BK = r ? new Vector3(...r.back) : null;
  const tmp = new Vector3();
  const toImg = (x, y, z) => {
    tmp.set(x, y, z).sub(P);
    const zc = -tmp.dot(BK);
    return [r.image.w / 2 + (tmp.dot(RV) / zc) * f, r.image.h / 2 - (tmp.dot(UV) / zc) * f];
  };
  const colGeo = new CylinderGeometry(1, 1, 1, 24, 16, true);
  const poolGeo = new CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  const live = new Map(); // hazard -> its look
  const objects = [];
  const mk = () => {
    const colMat = new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uH: { value: 1 }, uR: { value: COL_R }, uA: { value: 0 }, uRise: { value: 0 } }, vertexShader: colVert, fragmentShader: colFrag, transparent: true, depthWrite: false, depthTest: true, blending: NormalBlending, premultipliedAlpha: true, toneMapped: false, side: 2, forceSinglePass: true });
    const poolMat = new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uFill: { value: 0 }, uWet: { value: 0 } }, vertexShader: vert, fragmentShader: poolFrag, transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true, toneMapped: false, forceSinglePass: true });
    const col = new Mesh(colGeo, colMat), pool = new Mesh(poolGeo, poolMat);
    for (const m of [col, pool]) (m.frustumCulled = false), (m.visible = false), (m.renderOrder = 3);
    objects.push(col, pool);
    return { col, pool, colMat, poolMat, free: true };
  };
  const pool = [mk(), mk(), mk(), mk(), mk()]; // (four grates and one spare)
  let clock = 0;
  const shockList = [], ripList = []; // (this frame's, for the painting)
  const rips = []; // { px, py, t0, k }
  const ripple = (x, y, k) => {
    if (!r) return;
    const [px, py] = toImg(x, -1, y);
    if (rips.length >= 8) rips.shift();
    rips.push({ px, py, t0: clock, k });
  };
  const snd = {};
  const once = (name, gap = 0.15) => clock - (snd[name] ?? -9) >= gap && ((snd[name] = clock), sfx[name]());
  return {
    objects,
    update(w, now, dt) {
      clock = now;
      const seen = new Set();
      for (const h of w?.hazards || []) {
        if (h.tag !== "geyser" || h.friendly) continue;
        seen.add(h);
        let g = live.get(h);
        if (!g) {
          const look = pool.find((q) => q.free) || null;
          if (!look) continue;
          look.free = false;
          g = { look, x: h.x, y: h.y, ph: "", phT: now, end: null };
          live.set(h, g);
          look.col.position.set(h.x, 0, h.y);
          look.pool.position.set(h.x, 0.25, h.y);
          look.pool.scale.setScalar(GRATE_R);
        }
        const ph = phaseOf(h);
        if (ph !== g.ph) {
          g.ph = ph;
          g.phT = now;
          if (ph === "tele") once("geyserRumble", 0.3);
          if (ph === "active") {
            once("splashBig", 0.1);
            // (the burst: drops thrown high and wide off the column's crown, and rings on the painted water near it)
            burst?.(h.x, h.y, 34, { speed: 70, spread: TAU, life: 1.0, cols: DROPS, grav: 300, vz: 150, z: 18, size: (u) => 0.9 + u * 1.4, drag: 0.97, kind: "water" });
            burst?.(h.x, h.y, 18, { speed: 30, spread: TAU, life: 0.7, cols: DROPS, grav: 420, vz: 230, z: 4, size: (u) => 0.8 + u, drag: 0.95, kind: "water" });
            for (let k = 0; k < 4; k++) {
              const a = rand() * TAU, d = 18 + rand() * 30;
              ripple(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0.7 + rand() * 0.3);
            }
          }
          if (ph === "fade") {
            once("wade", 0.1);
            // (it falls back: a ring of spray landing round it)
            burst?.(h.x, h.y, 26, { speed: 55, spread: TAU, life: 0.55, cols: DROPS, grav: 520, vz: 60, z: 30, size: (u) => 0.8 + u * 1.1, drag: 0.95, kind: "water" });
          }
        }
        const t = h.t, L = g.look, U = L.colMat.uniforms;
        // (the shaders' clock kept small: their hash noise is sin() of the time times thousands, and at a page's hundreds of
        // seconds a float can no longer hold it — the streaks turned to an even milky glare)
        U.uTime.value = now % 64;
        L.poolMat.uniforms.uTime.value = now % 64;
        L.col.visible = L.pool.visible = true;
        let H = 0, A = 0, cr = COL_R, fill = 0, wet = 0;
        if (ph === "tele") {
          const k = Math.min(1, t / h.tele);
          // (welling up in the grate: the water filling it, a low dome rising, quicker as the burst nears)
          fill = Math.min(1, k * 1.6);
          H = 2 + 7 * k * k;
          cr = COL_R * (0.8 + 0.25 * k);
          A = 0.35 + 0.4 * k;
          // (bubbles and jumping drops, more and higher as it comes)
          if (rand() < dt * (8 + 30 * k)) burst?.(h.x + (rand() - 0.5) * 14, h.y + (rand() - 0.5) * 14, 1, { speed: 8, spread: TAU, life: 0.35, cols: DROPS, grav: 400, vz: 40 + 80 * k, z: 1, size: 0.8, drag: 0.9, kind: "water" });
        } else if (ph === "active") {
          const u = t - h.tele;
          // (shot up in 0.12 s, then holding, churning)
          H = COL_H * Math.min(1, u / 0.12) * (1 + 0.05 * Math.sin(now * 19));
          A = 1;
          fill = 1;
          // (spray off it the whole time)
          if (rand() < dt * 30) burst?.(h.x + (rand() - 0.5) * 12, h.y + (rand() - 0.5) * 12, 2, { speed: 60, spread: TAU, life: 0.8, cols: DROPS, grav: 360, vz: 60, z: COL_H * (0.75 + 0.25 * rand()), size: (q) => 0.8 + q * 1.2, drag: 0.96, kind: "water" });
        } else {
          const u = Math.min(1, (t - h.tele - h.active) / h.fade);
          // (falling back: sinking, thinning)
          H = COL_H * (1 - u) * (1 - u * 0.3);
          A = 1 - u * u;
          fill = 1;
          wet = u;
        }
        U.uH.value = Math.max(0.5, H);
        U.uR.value = cr;
        U.uA.value = A;
        U.uRise.value = ph === "active" ? 1 : 0.3;
        L.poolMat.uniforms.uFill.value = fill;
        L.poolMat.uniforms.uWet.value = wet;
      }
      // (gone from the sim: the water drains out of the grate and the wet dries, over 1.2 s)
      for (const [h, g] of live) {
        if (seen.has(h)) continue;
        if (g.end == null) g.end = now;
        const u = (now - g.end) / 1.2;
        const L = g.look;
        L.col.visible = false;
        L.poolMat.uniforms.uTime.value = now % 64;
        L.poolMat.uniforms.uFill.value = Math.max(0, 1 - u * 2.5);
        L.poolMat.uniforms.uWet.value = Math.max(0, 1 - u);
        if (u >= 1) (L.pool.visible = false), (L.free = true), live.delete(h);
      }
      // (the painted floor's ripples: each welling grate's ring running out to the circle's edge over its wind-up — the
      // landing's shockwave, backdrop3d.js shockAt; two at most)
      shockList.length = 0;
      if (r)
        for (const [h, g] of live) {
          if (!w?.hazards.includes(h) || phaseOf(h) !== "tele" || shockList.length >= 2) continue;
          const [cx, cy] = toImg(h.x, 0, h.y);
          let rx = 1, ry = 1;
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU, [qx, qy] = toImg(h.x + Math.cos(a) * h.r, 0, h.y + Math.sin(a) * h.r);
            rx = Math.max(rx, Math.abs(qx - cx));
            ry = Math.max(ry, Math.abs(qy - cy));
          }
          shockList.push([cx, cy, h.t, rx, ry, h.tele * 0.95]);
        }
      ripList.length = 0;
      for (const q of rips) if (clock - q.t0 < 2.4) ripList.push([q.px, q.py, clock - q.t0, q.k]);
    },
    shocks: () => shockList,
    ripples: () => ripList,
    dispose() {
      colGeo.dispose();
      poolGeo.dispose();
      for (const q of pool) q.colMat.dispose(), q.poolMat.dispose();
    },
  };
}
