// The garden's small life (docs/3D-PLAN.md 4.12): pollen motes drifting over the lawn and petals
// falling from the two blossom trees.
//
//   motes    46 specks in the meadow colours (#fff3b0, #f4f8d8, #d9f08a), 3–25 units up, drifting
//            with the wind and wandering a little on their own; brighter inside the sun pool, dim
//            in the shade round it, twinkling; written very faintly into the bloom layer
//   petals   one every 0.5–1.5 s from under T0's or T1's canopy, pink or peach, fluttering down
//            (turning over as they fall), pushed by the wind; they settle, lie 4 s, then fade
//
// One instanced quad each, facing the camera, sized in texels so a mote is a single crisp dot at
// any zoom. View-only: its own seeded random, never the world's. Real time.
import { Mesh, InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial, DynamicDrawUsage, Color } from "./three-lib.js?v=8898846";

const MOTES = 46;
const PETALS = 28;
const MOTE_COLS = ["#fff3b0", "#f4f8d8", "#d9f08a"];
const PETAL_COLS = ["#e8a080", "#d3a468", "#e8a080", "#c98a78"];
// With the painted garden (M4b, critique #16): the owner's petals pick (small 37), its peach
// petals' light and mid values and its pink petals' light and edge values (#fcc6aa #fca992
// #fcb2b8 #e3858d), scaled in linear light to the flat colours' mean luminance, so the petals
// keep M4a's tuned brightness and take the picked painting's hues.
const PETAL_PAINTED = ["#e2b198", "#e29782", "#e29fa5", "#cb777e"];
const LAWN = 110; // motes stay over the lawn
const SETTLE = 4; // seconds a petal lies before it fades
const GONE = 0.8; // and the fade

const vert = /* glsl */ `
  attribute vec4 iData;  // x, height, z, size in texels
  attribute vec4 iCol;   // linear rgb, alpha
  attribute vec2 iTurn;  // width share (a petal turning over), 1 = a mote
  uniform float uTexelWorld;
  varying vec4 vCol;
  void main() {
    vCol = iCol;
    vec4 mv = viewMatrix * vec4(iData.xyz, 1.0);
    mv.xy += position.xy * vec2(iTurn.x, iTurn.y) * iData.w * uTexelWorld;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform float uGlow;
  varying vec4 vCol;
  void main() {
    if (vCol.a <= 0.003) discard;
    gl_FragColor = vec4(vCol.rgb * uGlow, vCol.a);
  }
`;

const lin = (hex) => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

/**
 * `look` the shared uniforms (the pool, the texel size), `trees` the blossom canopies petals fall
 * from ([{ x, y, cy, rx, ry }]), `wind` gfx/wind.js, `rand` a seeded random. `painted`: the
 * garden is painted (M4b), so the petals take the picked petals' colours; else M4a's.
 */
export function makeLife3D(look, { trees = [], wind, rand, painted = false }) {
  const petalCols = painted ? PETAL_PAINTED : PETAL_COLS;
  const n = MOTES + PETALS;
  const quad = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  const data = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const col = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const turn = new InstancedBufferAttribute(new Float32Array(n * 2), 2);
  for (const a of [data, col, turn]) a.setUsage(DynamicDrawUsage);
  geo.setAttribute("iData", data);
  geo.setAttribute("iCol", col);
  geo.setAttribute("iTurn", turn);
  geo.instanceCount = 0;
  const shared = { uTexelWorld: look.uTexelWorld };
  const mat = new ShaderMaterial({ uniforms: { ...shared, uGlow: { value: 1 } }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  // The bloom layer gets the motes again, very faint (petals are not light).
  const glowGeo = new InstancedBufferGeometry();
  glowGeo.index = quad.index;
  for (const k of ["position", "iData", "iCol", "iTurn"]) glowGeo.setAttribute(k, geo.getAttribute(k));
  glowGeo.instanceCount = 0;
  const glowMat = new ShaderMaterial({ uniforms: { ...shared, uGlow: { value: 0.22 } }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, toneMapped: false });
  const glow = new Mesh(glowGeo, glowMat);
  glow.frustumCulled = false;
  glow.layers.set(1);

  const spot = () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * LAWN;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const motes = Array.from({ length: MOTES }, () => {
    const [x, z] = spot();
    return { x, z, h0: 3 + rand() * 22, ph: rand() * 100, wander: 2 + rand() * 3, rgb: lin(MOTE_COLS[Math.floor(rand() * MOTE_COLS.length)]), size: rand() < 0.25 ? 2 : 1.3 };
  });
  const petals = Array.from({ length: PETALS }, () => ({ live: false, x: 0, z: 0, h: 0, ph: 0, spin: 0, lie: 0, rgb: null }));
  let nextPetal = 0.5 + rand();

  /**
   * How lit a point is: 1 in the sun pool, down to the pool's floor in the shade round it — the
   * ground's own envelope (materials3d.js sunMaskAt: the ellipse on the screen's axes, fading over
   * 0.55–1 of its radii), so the motes over a patch of lawn are as lit as the lawn.
   */
  const lit = (x, z) => {
    const p = look.uPool.value;
    const dx = x - p.x;
    const dz = z - p.y;
    const d = Math.hypot((dx - dz) * Math.SQRT1_2 / p.z, (dx + dz) * Math.SQRT1_2 / p.w);
    const floor = look.uPoolFloor.value;
    const u = Math.min(1, Math.max(0, (d - 0.55) / 0.45));
    return 1 - (1 - floor) * u * u * (3 - 2 * u);
  };

  return {
    mesh,
    glow,
    /** Once a frame, on real time. */
    update(dt, now) {
      const d = data.array;
      const c = col.array;
      const tu = turn.array;
      let k = 0;
      for (const m of motes) {
        const [wx, wz] = wind.drift(m.x, m.z, 1);
        m.x += (wx * 0.35 + Math.sin(now * 0.6 + m.ph) * m.wander) * dt;
        m.z += (wz * 0.35 + Math.cos(now * 0.47 + m.ph * 1.3) * m.wander) * dt;
        if (Math.hypot(m.x, m.z) > LAWN + 6) {
          // Blown off the lawn: back in on the far side, upwind.
          const [x, z] = spot();
          m.x = x;
          m.z = z;
        }
        const h = m.h0 + Math.sin(now * 0.9 + m.ph) * 2;
        const tw = 0.55 + 0.45 * Math.sin(now * 2.1 + m.ph * 3.7);
        const l = lit(m.x, m.z);
        d.set([m.x, h, m.z, m.size], k * 4);
        c.set([m.rgb[0] * (0.5 + 0.8 * l), m.rgb[1] * (0.5 + 0.8 * l), m.rgb[2] * (0.5 + 0.8 * l), tw * (0.35 + 0.65 * l)], k * 4);
        tu.set([1, 1], k * 2);
        k++;
      }
      glowGeo.instanceCount = k; // the motes come first; the bloom layer stops there
      // Petals.
      nextPetal -= dt;
      if (nextPetal <= 0 && trees.length) {
        nextPetal = 0.5 + rand();
        const p = petals.find((q) => !q.live);
        if (p) {
          const t = trees[Math.floor(rand() * trees.length)];
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * t.rx * 0.8;
          Object.assign(p, { live: true, x: t.x + Math.cos(a) * r, z: t.y + Math.sin(a) * r, h: t.cy - t.ry * (0.1 + rand() * 0.4), ph: rand() * 100, spin: rand() * 6, lie: 0, rgb: lin(petalCols[Math.floor(rand() * petalCols.length)]) });
        }
      }
      for (const p of petals) {
        if (!p.live) continue;
        let alpha = 1;
        let w = 1;
        let hgt = 0.6;
        if (p.h > 0.2) {
          const [wx, wz] = wind.drift(p.x, p.z, 1);
          p.h = Math.max(0.2, p.h - (4.5 + Math.sin(now * 2.3 + p.ph) * 1.5) * dt);
          p.x += (wx * 0.6 + Math.sin(now * 3 + p.ph) * 4) * dt;
          p.z += (wz * 0.6 + Math.cos(now * 2.6 + p.ph) * 2) * dt;
          p.spin += dt * (5 + Math.sin(p.ph) * 2);
          w = Math.max(0.25, Math.abs(Math.cos(p.spin)));
          hgt = 0.6 + 0.4 * Math.abs(Math.sin(p.spin));
        } else {
          p.lie += dt;
          alpha = p.lie < SETTLE ? 1 : 1 - (p.lie - SETTLE) / GONE;
          if (alpha <= 0) {
            p.live = false;
            continue;
          }
        }
        const l = lit(p.x, p.z);
        d.set([p.x, p.h, p.z, 2.2], k * 4);
        c.set([p.rgb[0] * (0.35 + 0.75 * l), p.rgb[1] * (0.35 + 0.75 * l), p.rgb[2] * (0.35 + 0.75 * l), alpha], k * 4);
        tu.set([w, hgt], k * 2);
        k++;
      }
      geo.instanceCount = k;
      for (const a of [data, col, turn]) {
        a.needsUpdate = true;
        a.clearUpdateRanges();
        a.addUpdateRange(0, k * a.itemSize);
      }
    },
    dispose() {
      quad.dispose();
      geo.dispose();
      glowGeo.dispose();
      mat.dispose();
      glowMat.dispose();
    },
  };
}
