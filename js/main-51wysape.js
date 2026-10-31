import {
  es,
  Dr,
  ja,
  eo,
  no,
  tn,
  bt,
  fn,
  ii,
  we,
  et,
  Xe,
  ot,
  Tt,
  Fn,
  Kt
} from "./main-6mhe1mqq.js?v=88e40de-1ff3b19c";
import {
  BACK,
  RIGHT,
  UP
} from "./main-drnmg1te.js?v=88e40de-1ff3b19c";
import {
  pictureLoader,
  rawTex
} from "./main-74g1a3n8.js?v=88e40de-1ff3b19c";
import {
  loadEdit2,
  emptyEdit2,
  loadPieces2,
  attachPieces2
} from "./main-ybx00bvq.js?v=88e40de-1ff3b19c";
import {
  unitQuad,
  NOISE_GLSL
} from "./main-jv075w3r.js?v=88e40de-1ff3b19c";
import {
  __preload,
  maxTextureSize
} from "./main-4hwc579a.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/backdrop3d.js
var QS = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams;
var MIP_BIAS = QS.has("refbias") ? Number(QS.get("refbias")) : -0.5;
var maxTex = maxTextureSize;
function loadFallback(bd) {
  if (bd.fallback)
    return bd.fallback;
  const base = `art3d/${bd.id}/${bd.id}`;
  const tl = pictureLoader();
  bd.fallback = Promise.all([tl.loadAsync(`${base}-color.webp`).catch(() => tl.loadAsync(`${base}-color.png`)), tl.loadAsync(`${base}-depth.png`)]).then(([color, depth]) => {
    rawTex(color);
    rawTex(depth, tn);
    color.needsUpdate = depth.needsUpdate = true;
    bd.color = color;
    bd.depth = depth;
    return bd;
  });
  return bd.fallback;
}
async function loadBackdrop2(id) {
  try {
    const base = `art3d/${id}/${id}`;
    const meta = await (await fetch(`${base}.json`)).json();
    const tl = pictureLoader();
    const bd = { id, meta, color: null, depth: null, fallback: null };
    bd.loadFallback = () => loadFallback(bd);
    let refOk = false;
    if (meta.ref) {
      try {
        await loadRef(bd, tl, base);
        refOk = true;
      } catch {
        bd.refImage = bd.refDepth = null;
      }
    }
    if (!refOk || QS.get("refcam") === "0")
      await loadFallback(bd);
    return bd;
  } catch {
    return null;
  }
}
async function loadRef(bd, tl, base) {
  const { id, meta } = bd;
  const tex = (url) => tl.loadAsync(url).catch(() => null);
  const hi = maxTex() >= 8192 && meta.ref.hi;
  const look = QS.get("reflook") ? `-hi-${QS.get("reflook")}` : null;
  const pics = Promise.all([(look ? tl.loadAsync(`${base}-ref${look}.webp`) : Promise.reject()).catch(() => tl.loadAsync(`${base}-ref${hi ? "-hi" : ""}.webp`)).catch(() => tl.loadAsync(`${base}-ref.webp`)), tl.loadAsync(`${base}-refdepth.png`)]);
  const size = pics.then(([, rd]) => ({ w: rd.image.width, h: rd.image.height }));
  const edits = Promise.all([loadEdit2(id, size), loadPieces2(id, size, true)]);
  const b3url = QS.get("bell3d") ? `art3d/${QS.get("bell3d")}/bell.gltf` : meta.bell3d?.file ? `art3d/${id}/${meta.bell3d.file}` : null;
  const bell3d = b3url ? (__preload("qv4jc8dc"), import("./gltf-qv4jc8dc.js?v=88e40de-1ff3b19c")).then(({ GLTFLoader }) => new GLTFLoader().loadAsync(b3url)).catch(() => null) : null;
  const bell = meta.bell?.file && !QS.get("bell3d") ? tex(`art3d/${id}/${meta.bell.file}`) : null;
  const answer = meta.answer?.file ? tex(`art3d/${id}/${meta.answer.file}`) : null;
  const life = meta.life?.file ? Promise.all([meta.life.file, meta.life.file2].map((f) => f ? tex(`art3d/${id}/${f}`) : null)) : [null, null];
  const fxp = tex(`${base}-fx.png`);
  const [ri, rd] = await pics;
  for (const t of [ri, rd]) {
    t.colorSpace = ii;
    t.flipY = false;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
  ri.magFilter = bt;
  const MIP_ON = QS.get("refmip") ? QS.get("refmip") !== "0" : !!meta.ref.mip;
  ri.minFilter = MIP_ON ? fn : bt;
  ri.generateMipmaps = MIP_ON;
  ri.anisotropy = 4;
  rd.minFilter = rd.magFilter = tn;
  bd.refImage = ri;
  bd.refDepth = rd;
  const [ed0, pieces] = await edits;
  bd.edit = ed0 || (pieces ? emptyEdit2(rd.image.width, rd.image.height) : null);
  if (bd.edit && pieces)
    attachPieces2(bd.edit, pieces);
  bd.editDepth = rd;
  const [bt2, at] = await Promise.all([bell, answer]);
  for (const t of [bt2, at])
    if (t)
      rawTex(t, bt, { needsUpdate: true });
  if (bt2)
    bd.refBell = bt2;
  const b3 = await bell3d;
  if (b3)
    bd.bell3d = b3;
  if (at)
    bd.refAnswer = at;
  const [lt, lt2] = await life;
  for (const t of [lt, lt2])
    if (t)
      rawTex(t, bt, { needsUpdate: true });
  if (lt)
    bd.refLife = lt;
  if (lt2)
    bd.refLife2 = lt2;
  const fx = await fxp;
  if (fx) {
    rawTex(fx, bt, { needsUpdate: true });
    bd.refFx = fx;
  }
}
var vert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
var frag = `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uRange;      // d0, d1 (metres)
  uniform float uK, uU;     // dot(Blender camera, view) and units a metre
  uniform float uCamBack;   // dot(the game camera's position, BACK)
  uniform vec2 uNearFar;
  uniform float uTime;
  uniform float uFlicker;   // the fire light's swing (share of it)
  uniform float uGlowPass;  // 1: the glow layer (only the hot parts)
  uniform vec2 uTexel;      // 1 / picture size
  uniform float uTest;
  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    vec4 dq = texture2D(tDepth, vUv);
    float q = floor(dq.r * 255.0 + 0.5) * 256.0 + floor(dq.g * 255.0 + 0.5);
    if (q > 65534.5) discard;   // nothing there: the clear colour
    float d = uRange.x + q / 65534.0 * (uRange.y - uRange.x);
    float s = -(d + uK) * uU;
    float view = uCamBack - s;
    gl_FragDepth = clamp((view - uNearFar.x) / (uNearFar.y - uNearFar.x), 0.0, 1.0);

    vec4 c = texture2D(tColor, vUv);
    c.rgb = mix(c.rgb / 12.92, pow((c.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, c.rgb));  // sRGB -> linear
    // the fires breathe: their share of the light brightens and dims, a slow swell and a quick flutter, each patch of the
    // picture (each fire's own pool) on its own beat
    vec2 cell = vUv * vec2(7.0, 9.0);
    float t = uTime;
    float fl = (noise(cell + vec2(t * 1.3, -t * 0.9)) - 0.5) * 0.7 + (noise(cell * 2.3 + vec2(-t * 4.1, t * 3.3)) - 0.5) * 0.3;
    float fire = dq.b;
    vec3 col = c.rgb * (1.0 + fire * uFlicker * fl * 2.0);
    if (uGlowPass > 0.5) {
      // the glow layer: only what burns (fire light, bright) — the bloom's source
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= smoothstep(0.45, 0.95, lum) * smoothstep(0.5, 0.9, fire) * 0.6;
    }
    if (uTest > 0.5) col = uGlowPass > 0.5 ? vec3(0.0) : vec3(0.2140);  // (a check: linear 0.214 should reach the screen as sRGB 128)
    gl_FragColor = vec4(col, 1.0);
  }
`;
function makeBackdrop2(bd, { fallback = true } = {}) {
  const m = bd.meta;
  const [tx, ty, tz] = m.topLeft;
  const { right: R, down: D } = m;
  const corner = (u, v) => [tx + R[0] * u + D[0] * v, ty + R[1] * u + D[1] * v, tz + R[2] * u + D[2] * v];
  const geo = new ot;
  geo.setAttribute("position", new Xe([...corner(0, 0), ...corner(1, 0), ...corner(0, 1), ...corner(1, 1)], 3));
  geo.setAttribute("uv", new Xe([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  geo.computeBoundingSphere();
  const uniforms = () => ({
    tColor: { value: bd.color },
    tDepth: { value: bd.depth },
    uRange: { value: [m.depth.d0, m.depth.d1] },
    uK: { value: m.depth.k },
    uU: { value: m.depth.u },
    uCamBack: { value: 0 },
    uNearFar: { value: [1, 3000] },
    uTime: { value: 0 },
    uFlicker: { value: 0.18 },
    uGlowPass: { value: 0 },
    uTexel: { value: [1 / m.image.w, 1 / m.image.h] },
    uTest: { value: typeof location !== "undefined" && new URLSearchParams(location.search).has("bdtest") ? 1 : 0 }
  });
  const make = (glow) => {
    const mat = new Kt({ uniforms: uniforms(), vertexShader: vert, fragmentShader: frag, toneMapped: false, depthWrite: !glow, depthTest: true, side: 2 });
    mat.uniforms.uGlowPass.value = glow ? 1 : 0;
    const mesh = new Tt(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    if (glow)
      mesh.layers.set(1);
    return mesh;
  };
  const main = make(false);
  const glow = make(true);
  if (!bd.color || !bd.depth) {
    main.material.visible = glow.material.visible = false;
    if (fallback)
      bd.loadFallback?.().then(() => {
        for (const mesh of [main, glow]) {
          const u = mesh.material.uniforms;
          u.tColor.value = bd.color;
          u.tDepth.value = bd.depth;
          mesh.material.visible = true;
        }
      }, () => {});
  }
  const lanterns = (m.fires || []).slice(0, 8).map(([x, y, z]) => ({ x, y: y + 8, z, w: 1 }));
  return {
    main,
    glow,
    lanterns,
    fires: m.fires || [],
    update(camera, now) {
      const cb = camera.position.x * BACK[0] + camera.position.y * BACK[1] + camera.position.z * BACK[2];
      for (const mesh of [main, glow]) {
        const u = mesh.material.uniforms;
        u.uCamBack.value = cb;
        u.uNearFar.value[0] = camera.near, u.uNearFar.value[1] = camera.far;
        u.uTime.value = now;
      }
    },
    dispose() {
      geo.dispose();
      main.material.dispose();
      glow.material.dispose();
    }
  };
}
var flameVert = `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
var flameFrag = `
  uniform float uTime;
  uniform float uGlowPass;
  varying vec2 vUv;
  varying float vSeed;
  ${NOISE_GLSL}
  void main() {
    float t = uTime * 1.6 + vSeed * 17.0;
    vec2 p = vUv;
    // licks: the flame sways more toward its top
    p.x += (noise(vec2(p.y * 3.0 - t * 2.2, vSeed * 9.0)) - 0.5) * 0.35 * p.y;
    float x = (p.x - 0.5) * 2.0;
    float y = p.y;
    float n = noise(vec2(x * 3.0, y * 5.0 - t * 3.5)) * 0.6 + noise(vec2(x * 7.0, y * 11.0 - t * 6.0)) * 0.4;
    // (a bushy fire: three tongues side by side, the middle one tallest)
    float tongues = 0.55 + 0.45 * sin(x * 7.0 + t * 1.7) * smoothstep(0.15, 0.6, y);
    float width = (1.0 - y * 0.85) * (0.6 + 0.4 * sin(min(1.0, y * 4.0) * 1.57)) * (0.85 + 0.25 * tongues);
    float shape = 1.0 - smoothstep(width * 0.55, width, abs(x));
    float body = shape * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.35 + n * 0.55, 1.0, y));
    body *= 0.55 + 0.6 * n;
    float heat = clamp(body * (1.2 - y * 0.9), 0.0, 1.0);
    vec3 col = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.5, 0.08), smoothstep(0.1, 0.45, heat));
    col = mix(col, vec3(1.0, 0.92, 0.6), smoothstep(0.55, 0.95, heat));
    float a = clamp(body * 1.4, 0.0, 1.0);
    gl_FragColor = vec4(col * a * (uGlowPass > 0.5 ? 1.4 : 1.5), 1.0);
  }
`;
var fogVert = `
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
var fogFrag = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  varying vec3 vW;
  ${NOISE_GLSL}
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main() {
    vec2 q = vW.xz / 90.0 + vec2(uTime * 0.012, uTime * 0.007);
    float n = fbm(q + fbm(q * 0.7 - uTime * 0.01));
    float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    float a = smoothstep(0.35, 0.8, n) * edge * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;
var emberVert = `
  attribute vec4 aSeed;     // x, z start (game units), phase, speed
  uniform float uTime;
  uniform vec3 uBox;        // half width, height range, half depth
  uniform vec3 uRight, uUp; // the screen's axes in the world (a card square to the screen)
  uniform float uFly;       // 1: fireflies (the Bog Shrine) — low over the clearing and the water, wandering, blinking;
                            // 2: the Drowned Hall's wisps — the same wander, slower, pale sea-green;
                            // 3: the salt flat's salt — fine glinting grains blown low across the flat
  varying float vA;
  varying vec2 vUv;
  void main() {
    if (uFly > 2.5) {
      // (a grain of salt on the wind, 2026-10-28 — the salt flat had the Drowned Hall's sea-green wisps: carried across the flat
      // on the breeze 2-30 units up, looped round the arena's box, catching the low sun now and then as a glint)
      float sp = 9.0 + aSeed.w * 10.0, ph = aSeed.z * 40.0;
      float x = mod(aSeed.x + uTime * sp + 210.0, 420.0) - 210.0;
      vec3 q = vec3(x, 2.0 + aSeed.w * 28.0 + sin(uTime * 0.8 + ph) * 2.5, aSeed.y + sin(uTime * 0.37 + ph) * 8.0);
      float glint = pow(max(0.0, sin(uTime * (0.9 + aSeed.w * 1.3) + ph * 3.0)), 18.0);
      vA = (0.22 + 0.78 * glint) * smoothstep(210.0, 170.0, abs(x));
      vUv = position.xy;
      vec3 wq = q + (uRight * position.x + uUp * position.y) * (0.28 + aSeed.w * 0.22 + glint * 0.5);
      gl_Position = projectionMatrix * viewMatrix * vec4(wq, 1.0);
      return;
    }
    if (uFly > 0.5) {
      // (a firefly: hovers 3-26 units up, drifts round a slow loop of its own, glows for a second or two and goes dark)
      float sp = (0.25 + aSeed.w * 0.35) * (uFly > 1.5 ? 0.55 : 1.0), ph = aSeed.z * 40.0;
      vec3 q = vec3(aSeed.x, 3.0 + aSeed.w * 23.0, aSeed.y);
      q.x += sin(uTime * sp + ph) * 14.0 + sin(uTime * sp * 2.3 + ph * 1.7) * 5.0;
      q.z += cos(uTime * sp * 0.8 + ph * 1.3) * 14.0;
      q.y += sin(uTime * sp * 1.7 + ph) * 3.0;
      float blink = smoothstep(0.55, 0.85, sin(uTime * (0.6 + aSeed.w * 0.5) + ph * 3.0) * 0.5 + 0.5);
      vA = blink * (0.6 + 0.4 * sin(uTime * 7.0 + ph));
      vUv = position.xy;
      vec3 wq = q + (uRight * position.x + uUp * position.y) * (0.45 + aSeed.w * 0.35);
      gl_Position = projectionMatrix * viewMatrix * vec4(wq, 1.0);
      return;
    }
    float life = 6.0 + aSeed.w * 6.0;
    float t = mod(uTime * (0.6 + aSeed.w * 0.6) + aSeed.z * life, life) / life;   // 0..1 along its rise
    vec3 p = vec3(aSeed.x, -60.0 + t * uBox.y, aSeed.y);
    p.x += sin(uTime * 0.7 + aSeed.z * 20.0) * 9.0 + t * 25.0;
    p.z += cos(uTime * 0.5 + aSeed.z * 13.0) * 9.0;
    vA = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.7, 1.0, t)) * (0.55 + 0.45 * sin(uTime * 6.0 + aSeed.z * 40.0));
    vUv = position.xy;
    float size = 0.55 + aSeed.w * 0.6;
    vec3 w = p + (uRight * position.x + uUp * position.y) * size;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
var emberFrag = `
  uniform float uGlowPass;
  uniform float uFly;
  varying float vA;
  varying vec2 vUv;
  void main() {
    float d = length(vUv);
    float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
    vec3 col = uFly > 2.5 ? mix(vec3(1.0, 0.78, 0.9), vec3(1.0, 0.97, 0.99), 1.0 - smoothstep(0.0, 0.5, d)) * 0.8
             : uFly > 1.5 ? mix(vec3(0.15, 0.75, 0.6), vec3(0.75, 1.0, 0.95), 1.0 - smoothstep(0.0, 0.45, d)) * 0.7
             : uFly > 0.5 ? mix(vec3(0.75, 0.95, 0.25), vec3(1.0, 1.0, 0.75), 1.0 - smoothstep(0.0, 0.45, d))
                          : mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.8, 0.4), 1.0 - smoothstep(0.0, 0.5, d));
    gl_FragColor = vec4(col * a * (uGlowPass > 0.5 ? 2.0 : 1.6), 1.0);
  }
`;
function makeBackdropFx2(bd) {
  const U = bd.meta.depth.u;
  const fires = bd.meta.fires || [];
  const pos = [], uv = [], seed = [], idx = [];
  fires.forEach(([x, y, z], i) => {
    const w = 1 * U, h = 1.8 * U;
    const b = pos.length / 3;
    const r = [RIGHT[0] * w / 2, 0, RIGHT[2] * w / 2];
    const base = [x, y - 0.12 * U, z];
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      pos.push(base[0] + r[0] * (u * 2 - 1), base[1] + h * v, base[2] + r[2] * (u * 2 - 1));
      uv.push(u, v);
      seed.push(i * 0.37 + 0.1);
    }
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  });
  const fg = new ot;
  fg.setAttribute("position", new Xe(pos, 3));
  fg.setAttribute("uv", new Xe(uv, 2));
  fg.setAttribute("aSeed", new Xe(seed, 1));
  fg.setIndex(idx);
  const flameMat = (glow) => new Kt({ uniforms: { uTime: { value: 0 }, uGlowPass: { value: glow ? 1 : 0 } }, vertexShader: flameVert, fragmentShader: flameFrag, transparent: true, depthWrite: false, blending: Dr, toneMapped: false, side: 2, forceSinglePass: true });
  const flames = new Tt(fg, flameMat(false));
  const flamesGlow = new Tt(fg, flameMat(true));
  flames.frustumCulled = flamesGlow.frustumCulled = false;
  flamesGlow.layers.set(1);
  const banks = [];
  const fogMat = (alpha, col) => new Kt({ uniforms: { uTime: { value: 0 }, uColor: { value: col }, uAlpha: { value: alpha } }, vertexShader: fogVert, fragmentShader: fogFrag, transparent: true, depthWrite: false, blending: es, toneMapped: false, side: 2, forceSinglePass: true });
  for (const [h, size, alpha] of bd.meta.fx?.fog === false ? [] : [[-30, 900, 0.35], [-70, 1000, 0.4], [-120, 1100, 0.45]]) {
    const g = new ot;
    const s = size / 2;
    g.setAttribute("position", new Xe([-s, h, -s, s, h, -s, -s, h, s, s, h, s], 3));
    g.setAttribute("uv", new Xe([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    const m = new Tt(g, fogMat(alpha, [0.035, 0.05, 0.07]));
    m.frustumCulled = false;
    m.renderOrder = 5;
    banks.push(m);
  }
  const salt = bd.meta.fx?.particles === "salt";
  const wisps = bd.meta.fx?.particles === "wisps";
  const fly = wisps || bd.meta.fx?.particles === "fireflies";
  const N = salt ? 160 : wisps ? 70 : fly ? 150 : 380;
  const eg = unitQuad();
  const seeds = new Float32Array(N * 4);
  let h = 1234567;
  const rnd = () => (h = (h * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0;i < N; i++)
    seeds.set([(rnd() - 0.5) * 420, (rnd() - 0.5) * 420 - 40, rnd(), rnd()], i * 4);
  eg.setAttribute("aSeed", new Fn(seeds, 4));
  eg.instanceCount = N;
  const emberMat = (glow) => new Kt({ uniforms: { uTime: { value: 0 }, uBox: { value: [210, 170, 210] }, uRight: { value: RIGHT }, uUp: { value: UP }, uGlowPass: { value: glow ? 1 : 0 }, uFly: { value: salt ? 3 : wisps ? 2 : fly ? 1 : 0 } }, vertexShader: emberVert, fragmentShader: emberFrag, transparent: true, depthWrite: false, blending: Dr, toneMapped: false });
  const embers = new Tt(eg, emberMat(false));
  const embersGlow = new Tt(eg, emberMat(true));
  embers.frustumCulled = embersGlow.frustumCulled = false;
  embersGlow.layers.set(1);
  return {
    objects: [flames, flamesGlow, ...banks, embers, embersGlow],
    update(now) {
      flames.material.uniforms.uTime.value = flamesGlow.material.uniforms.uTime.value = now;
      embers.material.uniforms.uTime.value = embersGlow.material.uniforms.uTime.value = now;
      for (const b of banks)
        b.material.uniforms.uTime.value = now;
    },
    dispose() {
      fg.dispose();
      eg.dispose();
      embers.material.dispose();
      embersGlow.material.dispose();
      flames.material.dispose();
      flamesGlow.material.dispose();
      for (const b of banks)
        b.geometry.dispose(), b.material.dispose();
    }
  };
}
var FLICK = `
  float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fhash(i), fhash(i + vec2(1, 0)), f.x), mix(fhash(i + vec2(0, 1)), fhash(i + vec2(1, 1)), f.x), f.y);
  }
  float flick(float t, float p) {
    return (fnoise(vec2(t * 5.0, p * 61.0)) * 2.0 - 1.0) * 0.6 + (fnoise(vec2(t * 13.0, p * 61.0 + 7.0)) * 2.0 - 1.0) * 0.4;
  }
`;
var fract = (x) => x - Math.floor(x);
var fhash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function fnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = fhash(ix, iy), b = fhash(ix + 1, iy), c = fhash(ix, iy + 1), d = fhash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
var flickJS = (t, p) => (fnoise(t * 5, p * 61) * 2 - 1) * 0.6 + (fnoise(t * 13, p * 61 + 7) * 2 - 1) * 0.4;
var refVert = `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
var refFrag = `
  uniform sampler2D tImage;
  uniform sampler2D tDepth;
  uniform vec4 uCrop;      // the frame's top-left in the image and its size (image pixels)
  uniform vec2 uTarget;    // the render target's size (texels)
  uniform vec2 uImage;     // the image's size (pixels)
  uniform vec2 uRange;     // the depth map's d0, d1 (metres, planar from the camera)
  uniform float uU;        // game units a metre
  uniform vec2 uNearFar;
  // (which pass this program draws, fixed when it is built — three programs, each holding only its own code: as uniforms,
  // every pass ran past the others' branches, and the main pass carried the glow's and the overlay's — makeRefBackdrop)
  #define uGlowPass float(GLOW)
  uniform sampler2D tFx;    // the light round the live flames (tools/arena/liveflames.py): G how much, B that flame's phase
  uniform float uTime;
  uniform float uHasFx;
  uniform sampler2D tEdit;   // the owner's corrections (ui/mapedit.js), at the depth map's size: R stands in front, G never in
  uniform sampler2D tEditD;  //   front, B a comment's area; tEditD the depth of what R adds (R high, G low, as tDepth)
  uniform float uHasEdit;
  uniform float uEditShow;   // 1: the edit mode's tint — nearer than the hero (blue), added (green), taken out (red), comments
  uniform float uHeroZ;      // the hero's planar depth (game units), for the tint
  uniform sampler2D tPiece;  // the object each pixel belongs to (mapedit3d.js; R high, G low)
  uniform sampler2D tFlags;  // per object (render3d.js campCover): R 255 covers him now, G 255 it has a line of the owner's
  uniform float uHasPiece;
  uniform vec3 uHeroPx;      // the hero in the image: his chest (px), and how far round him the rule holds (px)
  uniform sampler2D tObjFlags; // per object (imagecam3d.js objCover): R covers 3D thing 0, G thing 1
  uniform vec4 uObjRect[2];  // each 3D thing's rectangle in the picture (px: x0, y0, x1, y1)
  uniform vec2 uObjZ[2];     // and its nearest and farthest planar depth (game units)
  uniform float uObjN;       // how many
  uniform sampler2D tLife;   // (the Bog Shrine, tools/bog/life.py) R water, G a crown's sway, B a reed's sway
  uniform float uHasLife;
  uniform float uLifeGlint;  // 1: its G is crystal that glints (the salt flat, tools/salt/glints.py), not a crown's sway
  uniform sampler2D tLife2;  // (and its second map) R lotuses, G the big tree's hanging strands
  uniform float uHasLife2;
  uniform vec4 uRip[8];      // ripples on its water: image px, age (s), strength (0: none) — boglife3d.js
  uniform vec4 uShockA[2];   // shockwaves on the ground (a landing): image px, age (s), on — boglife3d.js shock
  uniform vec4 uShockB[2];   //   the landing circle's half axes in the picture (px), the seconds its front takes to reach them
  uniform float uMipBias;    // the picture read this many mip levels sharper (its mipmaps: zoomed out, no sparkle)
  #define uOverlay float(OVER) // 1: the pass after the characters — what the owner added, laid over them by its soft edge
  ${FLICK}
  float depthOf(float d, float n, float f) { return d > f ? 0.99999 : clamp(f * (d - n) / (d * (f - n)), 0.0, 0.99999); }
  // The pixel's depth (game units, planar) with the owner's corrections and the objects round the hero, and what they
  // said on the way: the edit layer, the added depth, how blue, whether its object covers him now, the picture's own depth.
  float depthAt(vec2 px, vec2 uv, out vec4 ed, out float se, out float pa, out float pcov, out float d0) {
    vec4 dq = texture2D(tDepth, uv);
    float q = floor(dq.r * 255.0 + 0.5) * 256.0 + floor(dq.g * 255.0 + 0.5);
    float d = q > 65534.5 ? 1e6 : (uRange.x + q / 65534.0 * (uRange.y - uRange.x)) * uU;
    // (the owner's corrections, the edit mode: taken out never covers anyone; added covers whoever stands behind its depth —
    // hard here at half its painted edge, softly by the overlay pass after the characters)
    d0 = d;
    ed = uHasEdit > 0.5 ? texture2D(tEdit, uv) : vec4(0.0);
    se = 1e6;
    if (ed.r > 0.0) {
      vec4 eq = texture2D(tEditD, uv);
      se = (uRange.x + (floor(eq.r * 255.0 + 0.5) * 256.0 + floor(eq.g * 255.0 + 0.5)) / 65534.0 * (uRange.y - uRange.x)) * uU;
    }
    if (ed.g > 0.5) d = 1e6;
    else if (ed.r > 0.5) d = min(d, se);
    // The camp's one truth, round the hero (the owner, 2026-10-14: "It should be able to edit the same things in the arenas
    // as the camp"): blue — the arena's standing things (its objects, tools/arena/pieces.py) and his Mask, less his Clear —
    // covers him wherever they overlap, an object with a line of his only while he stands behind it (render3d.js campCover);
    // what is not blue never covers him. No depth decides it near him; away from him (the boss, the adds) the depth still does.
    pa = 0.0;          // (how blue: what covers him if he is here)
    pcov = 1.0;        // (its object covers him now)
    if (uHasPiece > 0.5) {
      vec4 pq = texture2D(tPiece, uv);
      vec2 pb = floor(pq.rg * 255.0 + 0.5);
      vec4 fl = texture2D(tFlags, (vec2(pb.y, pb.x) + 0.5) / 256.0);
      pa = clamp(max(pb.x + pb.y > 0.0 ? 1.0 : 0.0, ed.r) * (1.0 - ed.g), 0.0, 1.0);
      pcov = fl.r;
      vec2 hd = (px - uHeroPx.xy) / max(uHeroPx.z, 1.0);
      // (the same for the 3D things standing in it - the salt flat's stone arch: over its rectangle each object of the picture
      // lies wholly in front of it or wholly behind it by its line, not pixel by pixel by the painting's depth, which had the
      // fence at its foot lying on the floor's plane, under the arch's plinth. What is not an object keeps its depth: the floor)
      float lo = -1e6, hi = 1e6;
      if (uHeroPx.z > 0.0 && dot(hd, hd) < 1.0 && d < 1e5) {
        if (pa * pcov > 0.5) hi = uHeroZ - 12.0; else lo = uHeroZ + 12.0;
      }
      if (pa > 0.5 && d < 1e5) {
        vec4 of = texture2D(tObjFlags, (vec2(pb.y, pb.x) + 0.5) / 256.0);
        for (int i = 0; i < 2; i++) {
          if (float(i) >= uObjN) break;
          vec4 r = uObjRect[i];
          if (px.x < r.x || px.y < r.y || px.x > r.z || px.y > r.w) continue;
          float cov = i == 0 ? of.r : of.g;
          if (cov > 0.5) hi = min(hi, uObjZ[i].x - 2.0); else lo = max(lo, uObjZ[i].y + 2.0);
        }
      }
      // (both: kept where they agree; where the hero's and a thing's answers clash, his - the camp's one truth - holds)
      if (lo <= hi) d = clamp(d, lo, hi);
      else d = pa * pcov > 0.5 ? min(d, uHeroZ - 12.0) : max(d, uHeroZ + 12.0);
    }
    return d;
  }
  void shockAt(vec2 px, inout vec2 duv, inout float shade, inout float glint) {
    // A landing's shockwave (boglife3d.js shock): the painted ground ripples as water does round a falling drop — a short train
    // of rings running out from his feet to the edge of where the landing hits, fading as it goes and as it ages
    for (int i = 0; i < 2; i++) {
      vec4 sa = uShockA[i];
      if (sa.w <= 0.0) continue;
      vec2 dv = px - sa.xy, rad = max(uShockB[i].xy, vec2(1.0));
      // (the front as the sim's (sim/hazards.js sweep): from 12% of the circle to its edge in uShockB.z s — it hurts where it
      // has reached — then on a little further as it dies away; the whole ripple 1.4 times as long)
      float sw = max(uShockB[i].z, 0.1), u = sa.z / (sw * 1.4);
      float e = length(dv / rad);
      if (u >= 1.0 || e > 1.2) continue;
      float front = 0.12 + 0.88 * sa.z / sw;            // (where the leading ring is, in landing radii)
      float behind = front - e;                         // (how far inside the front)
      float train = smoothstep(-0.03, 0.0, behind) * (1.0 - smoothstep(0.0, 0.03, -behind)) * (1.0 - smoothstep(0.1, 0.5, behind));
      float ph = behind * 34.0;
      float env = (1.0 - u) * (1.0 - smoothstep(0.95, 1.2, e)) * (0.55 + 0.45 * (1.0 - e));
      float wv = sin(ph) * train * env * 7.0;
      duv += (e > 0.001 ? dv / length(dv) : vec2(0.0)) * wv;
      shade += cos(ph) * train * env * 0.32;
      glint += max(0.0, cos(ph)) * train * env * 0.35;
    }
  }
  // The picture at this pixel, shifted, lit and glinting: linear colour.
  vec3 pictureAt(vec2 uv, vec2 duv, float shade, float glint) {
    vec3 c = texture2D(tImage, uv + duv / uImage, uMipBias).rgb;
    c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
    c *= 1.0 + shade;
    c += vec3(0.085, 0.105, 0.115) * clamp(glint, 0.0, 1.5);
    if (uHasFx > 0.5) {
      // the light each live flame casts on what is round it rises and falls with that very flame (makeRefFlames)
      vec3 fx = texture2D(tFx, uv).rgb;
      c *= 1.0 + fx.g * 0.3 * flick(uTime, fx.b);
    }
    return c;
  }
  void main() {
    vec2 t = gl_FragCoord.xy / uTarget;
    vec2 px = vec2(uCrop.x + t.x * uCrop.z, uCrop.y + (1.0 - t.y) * uCrop.w);
    vec2 uv = px / uImage;
    // Past the image's sides (a landscape screen framing the Ash Floor's altar and its lower terrace at once is wider than
    // the image, render3d.js refFrame): its edge carried on, sinking into its own night fog within 60 image pixels; far away
    float past = max(max(-uv.x, uv.x - 1.0) * uImage.x, max(-uv.y, uv.y - 1.0) * uImage.y);
    if (past > 0.0) {
      if (uOverlay > 0.5) discard;
      // (blurred along the edge, wider the further out — copied straight out, each row of the edge ran on as a long streak: a band of
      // stripes beside the picture on a phone held sideways, where the picture is held clear of the touch buttons, 2026-10-31)
      vec2 cu = clamp(uv, 0.0, 1.0);
      vec2 along = max(-uv.x, uv.x - 1.0) * uImage.x >= max(-uv.y, uv.y - 1.0) * uImage.y ? vec2(0.0, 1.0 / uImage.y) : vec2(1.0 / uImage.x, 0.0);
      float spread = 3.0 + past * 0.9;
      vec3 e = vec3(0.0);
      for (int i = -4; i <= 4; i++) {
        vec3 s = texture2D(tImage, clamp(cu + along * spread * float(i) * 0.25, 0.0, 1.0)).rgb;
        e += mix(s / 12.92, pow((s + 0.055) / 1.055, vec3(2.4)), step(0.04045, s));
      }
      e /= 9.0;
      gl_FragDepth = 0.99999;
      gl_FragColor = vec4(uGlowPass > 0.5 ? vec3(0.0) : mix(e, vec3(0.019, 0.028, 0.043), smoothstep(0.0, 60.0, past)), 1.0);
      return;
    }
    float n = uNearFar.x, f = uNearFar.y;
    // (the overlay lays only what the owner added over the characters: elsewhere it ends here, before any other read —
    // it ran the whole shader over the frame to discard nearly all of it, 2026-10-16)
    if (uOverlay > 0.5 && uHasEdit < 0.5) discard;
    if (uOverlay > 0.5) {
      vec4 e0 = texture2D(tEdit, uv);
      if (e0.r * (1.0 - e0.g) < 0.004) discard;
    }
    // The glow layer: the picture's hot, warm pixels (its fires, embers, glowing cracks), by the same light the main pass
    // gives them (the bog's own motion aside). Worked out first: only a hot pixel needs its depth (to hide behind whoever
    // stands in front of it), and the rest — nearly all of the frame — ends here, black, as it came out before: the pass ran
    // the depth, the edits and the objects for every pixel to multiply most of them by nought (the bloom reads only the
    // colour). 2026-10-16.
    if (uGlowPass > 0.5) {
      vec2 gduv = vec2(0.0);
      float gshade = 0.0, gglint = 0.0;
      shockAt(px, gduv, gshade, gglint);
      vec3 c = pictureAt(uv, gduv, gshade, gglint);
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float warm = clamp((c.r - c.b) * 3.0, 0.0, 1.0);
      float hot = smoothstep(0.25, 0.7, lum) * warm;
      if (hot <= 0.0) discard;
      vec4 ged; float gse, gpa, gpcov, gd0;
      gl_FragDepth = depthOf(depthAt(px, uv, ged, gse, gpa, gpcov, gd0), n, f);
      gl_FragColor = vec4(c * (hot * 0.7), 1.0);
      return;
    }
    vec4 ed; float se, pa, pcov, d0;
    float d = depthAt(px, uv, ed, se, pa, pcov, d0);
    if (uOverlay > 0.5) {
      float ea = ed.r * (1.0 - ed.g);
      if (uHasPiece > 0.5) {
        // (his painted mask's soft edge, laid over him only where it covers him by the rule above)
        vec2 hd = (px - uHeroPx.xy) / max(uHeroPx.z, 1.0);
        if (uHeroPx.z > 0.0 && dot(hd, hd) < 1.0) { if (pcov < 0.5) discard; se = min(se, uHeroZ - 12.0); }
      }
      if (ea < 0.004 || se > 1e5) discard;
      gl_FragDepth = depthOf(se, n, f);
      vec3 oc = texture2D(tImage, uv).rgb;
      oc = mix(oc / 12.92, pow((oc + 0.055) / 1.055, vec3(2.4)), step(0.04045, oc));
      // (in the edit mode the part laid over him is tinted as the rest of the mask)
      if (uEditShow > 0.5) oc = mix(oc, vec3(0.15, 0.45, 1.0), 0.45);
      gl_FragColor = vec4(oc, ea);
      return;
    }
    gl_FragDepth = depthOf(d, n, f);
    vec2 duv = vec2(0.0);
    float glint = 0.0, spark = 0.0;
    if (uHasLife > 0.5 && uGlowPass < 0.5) {
      vec3 lf = texture2D(tLife, uv).rgb;
      float t = uTime;
      if (uLifeGlint > 0.5) {
        // (the salt flat's crystals catching the low sun, 2026-10-28 — the Crystal Crab's polish pass: the painting lay still
        // round him): each few pixels of crystal flashes now and then on a beat of its own, under a slow sheen across them
        if (lf.g > 0.004) {
          // (each flash a soft point with a short four-armed star, at a place of its own inside its 6 px cell — the whole cell lit
          // evenly flashed as a white square, 5 css px on a phone, by the crystals and over the bright sea behind them: the visual
          // loop, 2026-10-30)
          vec2 cell = floor(px / 6.0);
          float hh = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float tw = pow(max(0.0, sin(t * (0.8 + hh * 2.2) + hh * 60.0)), 40.0) * step(0.45, hh);
          vec2 dq = (px - (cell + 0.5) * 6.0 - (vec2(fract(hh * 37.1), fract(hh * 91.7)) - 0.5) * 1.6) / 3.0;
          float pt = (exp(-dot(dq, dq) * 3.0) + 0.7 * (exp(-abs(dq.x) * 8.0 - abs(dq.y) * 2.0) + exp(-abs(dq.y) * 8.0 - abs(dq.x) * 2.0)))
                   * (1.0 - smoothstep(0.7, 1.0, max(abs(dq.x), abs(dq.y))));
          spark += (tw * 1.6 * pt + 0.05 * (0.5 + 0.5 * sin(t * 0.6 + px.x * 0.013 - px.y * 0.007))) * lf.g;
        }
      } else if (lf.g > 0.004) {
        // (its phase blended between the 170 px cells' own, not one per cell: where a crown crossed a cell's edge its two halves
        // swayed apart, a straight cut up to 3.2 px through the leaves — the bog's right bush at x 1360; the visual loop, 2026-10-30)
        vec2 cq = px / 170.0, ci = floor(cq), cf = smoothstep(0.0, 1.0, cq - ci);
        vec4 ch = fract(sin(vec4(dot(ci, vec2(12.9898, 78.233)), dot(ci + vec2(1.0, 0.0), vec2(12.9898, 78.233)),
                                 dot(ci + vec2(0.0, 1.0), vec2(12.9898, 78.233)), dot(ci + vec2(1.0, 1.0), vec2(12.9898, 78.233)))) * 43758.5453);
        float ph = mix(mix(ch.x, ch.y, cf.x), mix(ch.z, ch.w, cf.x), cf.y) * 6.2831;
        // (a little more, and a bob up and down with it — 2026-10-15: "make the tree branches feel like they are slightly bobbing
        // in the wind (just slightly)")
        vec2 sw = vec2(sin(t * 1.15 + ph) * 1.35 + sin(t * 2.7 + ph * 1.7) * 0.4 + sin(t * 5.3 + px.x * 0.11 + px.y * 0.07) * 0.2,
                       sin(t * 0.9 + ph * 0.6) * 0.6 + sin(t * 2.1 + ph * 1.3 + px.x * 0.02) * 0.25 + sin(t * 4.1 + px.y * 0.13) * 0.12);
        duv += sw * lf.g;
      }
      if (lf.b > 0.004) {
        float gust = 0.6 + 0.4 * sin(t * 0.37 + px.x * 0.004);
        duv.x += (sin(t * 1.9 + px.x * 0.05 + px.y * 0.012) * 0.75 + sin(t * 3.3 + px.x * 0.13) * 0.25) * 1.8 * gust * lf.b;
      }
      if (uHasLife2 > 0.5) {
        vec3 l2 = texture2D(tLife2, uv).rgb;
        // the big tree's hanging strands, swinging a little more the lower they hang
        if (l2.g > 0.004) duv.x += (sin(t * 1.3 + px.y * 0.035 + px.x * 0.012) * 1.1 + sin(t * 2.9 + px.y * 0.08) * 0.35) * l2.g;
        // a lotus nudged a pixel aside now and then, on its own beat
        // (each 26 px cell's nudge blended into its neighbours' across the cell: one cell's alone cut a 1 px tear along the cell's
        // edge through any lotus crossing it, ~3,000 px of seams at a time — the visual loop, 2026-10-30)
        if (l2.b > 0.3) {
          vec2 lq = px / 26.0 - 0.5, li = floor(lq), lw = smoothstep(0.0, 1.0, lq - li);
          vec4 lh = fract(sin(vec4(dot(li, vec2(41.3, 289.1)), dot(li + vec2(1.0, 0.0), vec2(41.3, 289.1)),
                                   dot(li + vec2(0.0, 1.0), vec2(41.3, 289.1)), dot(li + vec2(1.0, 1.0), vec2(41.3, 289.1)))) * 43758.5453);
          vec4 nd = step(0.86, fract(t * 0.11 + lh * 7.0)) * step(0.35, lh) * (step(0.67, lh) * 2.0 - 1.0);
          duv.x += mix(mix(nd.x, nd.y, lw.x), mix(nd.z, nd.w, lw.x), lw.y) * smoothstep(0.3, 0.7, l2.b);
        }
      }
      if (lf.r > 0.3) {
        // (the camp's water, camp3d.js: two layers of noise drifting different ways, 3.2 and 1.4 px — the swamp lay still
        // under 0.55 px of sine, the owner, 2026-10-15: "Right now the water around the area is fully still, utilize the water
        // effect from the camp 2.0")
        vec2 w1 = vec2(fnoise(px * 0.045 + vec2(t * 0.35, t * 0.22)), fnoise(px * 0.045 + vec2(17.0 - t * 0.27, 5.0 + t * 0.31))) - 0.5;
        vec2 w2 = vec2(fnoise(px * 0.11 + vec2(-t * 0.6, t * 0.45) + 40.0), fnoise(px * 0.11 + vec2(t * 0.5, -t * 0.4) + 80.0)) - 0.5;
        vec2 wd = w1 * 3.2 + w2 * 1.4;
        float crest = fnoise(px * vec2(0.09, 0.16) + vec2(t * 0.7, -t * 0.25) + w1 * 3.0);
        glint += smoothstep(0.74, 0.94, crest) * 0.9 * (0.6 + 0.4 * sin(t * 2.3 + px.x * 0.05)) * clamp((lf.r - 0.3) / 0.4, 0.0, 1.0);
        for (int i = 0; i < 8; i++) {
          vec4 rp = uRip[i];
          if (rp.w <= 0.0) continue;
          vec2 dv = px - rp.xy;
          dv.y *= 2.0;
          float dd = length(dv);
          float fade = rp.w * clamp(1.0 - rp.z / 2.4, 0.0, 1.0);
          for (int k = 0; k < 2; k++) {
            float rr = rp.z * (k == 0 ? 26.0 : 17.0) * (0.6 + 0.4 * rp.w);
            float ring = exp(-pow((dd - rr) / 2.2, 2.0)) * fade * (k == 0 ? 1.0 : 0.6);
            wd += (dd > 0.01 ? dv / dd : vec2(0.0)) * ring * 1.6;
            glint += ring;
          }
        }
        vec2 tu = uv + wd / uImage;
        // (the pads and flowers stay put: only open water drifts, and only from open water — bog-life2 R; the camp's lotuses
        // the owner had stilled the same way)
        float ow = uHasLife2 > 0.5 ? texture2D(tLife2, uv).r : 1.0;
        float ows = uHasLife2 > 0.5 ? texture2D(tLife2, tu).r : texture2D(tLife, tu).r;
        if (ows > 0.4) duv += wd * clamp((lf.r - 0.3) / 0.4, 0.0, 1.0) * smoothstep(0.3, 0.7, ow);
      }
    }
    float shade = 0.0;   // (its crests lit, its troughs dark: on a busy painted floor only the light shows a ripple)
    shockAt(px, duv, shade, glint);
    vec3 c = pictureAt(uv, duv, shade, glint);
    c += vec3(1.0, 0.86, 0.95) * spark;
    if (uEditShow > 0.5 && uGlowPass < 0.5) {
      // (one colour: masked — nearer than the hero, or painted so — or not)
      c = mix(c, vec3(0.15, 0.45, 1.0), 0.45 * (uHasPiece > 0.5 ? pa : max(step(d0, uHeroZ), ed.r) * (1.0 - ed.g)));
      c = mix(c, vec3(1.0, 0.9, 0.05), 0.7 * ed.b);
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;
function makeRefBackdrop2(bd) {
  const r = bd.meta.ref;
  const geo = new ot;
  geo.setAttribute("position", new Xe([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  const make = (glow) => {
    const mat = new Kt({
      uniforms: {
        tImage: { value: bd.refImage },
        tDepth: { value: bd.refDepth },
        uCrop: { value: [0, 0, r.image.w, r.image.h] },
        uTarget: { value: [1, 1] },
        uImage: { value: [r.image.w, r.image.h] },
        uRange: { value: [r.depth.d0, r.depth.d1] },
        uU: { value: r.depth.u },
        uNearFar: { value: [5, 4000] },
        uGlowPass: { value: glow === true ? 1 : 0 },
        tFx: { value: bd.refFx || null },
        uTime: { value: 0 },
        uHasFx: { value: bd.refFx ? 1 : 0 },
        tEdit: { value: null },
        tEditD: { value: null },
        uHasEdit: { value: 0 },
        uEditShow: { value: 0 },
        uHeroZ: { value: 0 },
        uOverlay: { value: glow === "over" ? 1 : 0 },
        tPiece: { value: null },
        tFlags: { value: null },
        uHasPiece: { value: 0 },
        uHeroPx: { value: [0, 0, 0] },
        tObjFlags: { value: null },
        uObjRect: { value: [new et, new et] },
        uObjZ: { value: [new we, new we] },
        uObjN: { value: 0 },
        uMipBias: { value: MIP_BIAS },
        tLife: { value: bd.refLife || null },
        uHasLife: { value: bd.refLife ? 1 : 0 },
        uLifeGlint: { value: bd.meta.life?.glint ? 1 : 0 },
        tLife2: { value: bd.refLife2 || null },
        uHasLife2: { value: bd.refLife2 ? 1 : 0 },
        uRip: { value: Array.from({ length: 8 }, () => new et) },
        uShockA: { value: [new et, new et] },
        uShockB: { value: [new et, new et] }
      },
      defines: { GLOW: glow === true ? 1 : 0, OVER: glow === "over" ? 1 : 0 },
      vertexShader: refVert,
      fragmentShader: refFrag,
      toneMapped: false,
      depthWrite: !glow,
      depthTest: true,
      transparent: glow === "over"
    });
    const m = new Tt(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = glow === "over" ? 4 : -10;
    if (glow === true)
      m.layers.set(1);
    return m;
  };
  const main = make(false), glow = make(true), over = make("over");
  over.visible = false;
  main.add(over);
  return {
    main,
    glow,
    ref: r,
    depthMap: { tex: bd.refDepth, range: [r.depth.d0 * r.depth.u, r.depth.d1 * r.depth.u] },
    setEdit(cov, dep, show = false) {
      for (const m of [main, glow, over]) {
        const u = m.material.uniforms;
        u.tEdit.value = cov;
        u.tEditD.value = dep;
        u.uHasEdit.value = cov && dep ? 1 : 0;
        u.uEditShow.value = show && cov ? 1 : 0;
      }
      over.visible = !!(cov && dep);
    },
    setShocks(list) {
      for (const m of [main, glow]) {
        const a = m.material.uniforms.uShockA.value, b = m.material.uniforms.uShockB.value;
        for (let i = 0;i < 2; i++) {
          const q = i < list.length ? list[i] : null;
          if (q)
            a[i].set(q[0], q[1], q[2], 1), b[i].set(q[3], q[4], q[5] || 0.42, 0);
          else
            a[i].set(0, 0, 0, 0);
        }
      }
    },
    setRipples(list) {
      for (const m of [main, glow]) {
        const u = m.material.uniforms.uRip.value;
        for (let i = 0;i < 8; i++) {
          const q = i < list.length ? list[i] : null;
          if (q)
            u[i].set(q[0], q[1], q[2], q[3]);
          else
            u[i].set(0, 0, 0, 0);
        }
      }
    },
    setHeroZ(z, px = null) {
      for (const m of [main, glow, over]) {
        m.material.uniforms.uHeroZ.value = z;
        if (px)
          m.material.uniforms.uHeroPx.value = px;
      }
    },
    setObjects(n, rects, zs, flags) {
      for (const m of [main, glow, over]) {
        const u = m.material.uniforms;
        u.uObjN.value = n || 0;
        if (!n)
          continue;
        u.tObjFlags.value = flags;
        for (let i = 0;i < 2; i++)
          u.uObjRect.value[i].fromArray(rects[i]), u.uObjZ.value[i].fromArray(zs[i]);
      }
    },
    setPieces(pid, flags) {
      for (const m of [main, glow, over]) {
        const u = m.material.uniforms;
        u.tPiece.value = pid;
        u.tFlags.value = flags;
        u.uHasPiece.value = pid && flags ? 1 : 0;
      }
    },
    setTime(now) {
      main.material.uniforms.uTime.value = glow.material.uniforms.uTime.value = over.material.uniforms.uTime.value = now;
    },
    setCrop(x0, y0, w, h, W, H, near, far) {
      for (const m of [main, glow, over]) {
        const u = m.material.uniforms;
        const c = u.uCrop.value, t = u.uTarget.value, nf = u.uNearFar.value;
        c[0] = x0, c[1] = y0, c[2] = w, c[3] = h;
        t[0] = W, t[1] = H;
        nf[0] = near, nf[1] = far;
      }
    },
    dispose() {
      geo.dispose();
      main.material.dispose();
      glow.material.dispose();
      over.material.dispose();
    }
  };
}
var flameCardVert = `
  attribute vec3 aBase;     // the flame's foot (game units)
  attribute vec4 aShape;    // its width, height, phase, kind (0 body, 1 tongue, 2 spark, 3 candle)
  attribute vec2 aRand;     // this card's own two random numbers
  uniform float uTime;
  uniform vec3 uRight, uUp, uBack;
  varying vec2 vUv;
  varying float vA, vHeat;
  varying vec4 vShape;
  varying vec2 vRand;
  ${FLICK}
  void main() {
    float w = aShape.x, h = aShape.y, ph = aShape.z, kind = aShape.w;
    float r1 = aRand.x, r2 = aRand.y;
    float t = uTime;
    vec2 at = vec2(0.0), size = vec2(1.0);
    float lift = 0.15 * w;   // (towards the camera, off the coals or the wax it stands on)
    vA = 1.0; vHeat = 1.0;
    vUv = position.xy;
    if (kind < 0.5) {
      // the body: a card round the whole flame (-0.65..0.65 of its width, -0.2..1.3 of its height)
      size = vec2(w * 0.65, h * 0.75);
      at = vec2(0.0, h * 0.55);
    } else if (kind < 1.5) {
      // a tongue: born in the bowl, licking up past the body's top; each lives 0.5-0.9 s
      float life = 0.5 + 0.4 * r2;
      float cyc = t / life + r1 * 13.7;
      float age = fract(cyc);
      float x0 = (fract(r1 * 7.31 + floor(cyc) * 0.618) * 2.0 - 1.0) * 0.33 * w;
      float sway = (fnoise(vec2(t * 2.3 + r1 * 9.0, age * 3.0)) - 0.5) * 0.35 * w * age;
      at = vec2(x0 * 0.6 * (1.0 - 0.5 * age) + sway, h * (0.6 + age * 0.6));
      float s = w * (0.07 + 0.05 * r2) * (1.0 - 0.6 * age);
      size = vec2(s, s * 2.4);
      vA = smoothstep(0.0, 0.2, age) * (1.0 - smoothstep(0.3, 1.0, age));
      vHeat = 0.65 - age * 0.5;
    } else if (kind < 2.5) {
      // a spark: thrown up from the fire, drifting on the draught, winking; each lives 1.2-2.6 s
      float life = 1.2 + 1.4 * r2;
      float cyc = t / life + r1 * 7.31;
      float age = fract(cyc);
      float k = floor(cyc);
      float x0 = (fract(r1 * 3.7 + k * 0.618) * 2.0 - 1.0) * 0.3 * w;
      float drift = (fnoise(vec2(t * 0.9 + r1 * 31.0, k)) - 0.5) * 1.2 * w * age;
      at = vec2(x0 + drift, h * (0.55 + age * 2.4 * (0.7 + 0.6 * fract(r1 * 5.3 + k * 0.37))));
      size = vec2(max(0.035 * w, 0.25)) * (1.0 - 0.5 * age);
      vA = smoothstep(0.0, 0.06, age) * (1.0 - smoothstep(0.45, 1.0, age)) * (0.55 + 0.45 * sin(t * 23.0 + r1 * 50.0));
      vHeat = 1.0 - age * 0.6;
    } else {
      // a candle: a card round its flame and halo
      size = vec2(h * 1.1, h * 1.1);
      at = vec2(0.0, h * 0.45);
      lift = 0.6;
    }
    vShape = aShape; vRand = aRand;
    vec3 p = aBase + uBack * lift + uRight * (at.x + position.x * size.x) + uUp * (at.y + position.y * size.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
var flameCardFrag = `
  uniform float uTime;
  uniform float uGain;      // (an arena's own flame strength: meta.fx.flameGain — the Bog Shrine's lanterns burned too bright)
  uniform float uGreen;     // 1: a green fire (the Drowned Hall's braziers, hall.json fx.flame "green"), 0 the fire's own orange
  uniform float uGlowPass;
  varying vec2 vUv;
  varying float vA, vHeat;
  varying vec4 vShape;
  varying vec2 vRand;
  ${FLICK}
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * fnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
  // The Drowned Hall's spectral green, from the same fire: its orange's strength laid on green and sea-blue — deep red ->
  // dark sea-green, orange -> teal-green, white-hot -> a pale mint white (the painting's own braziers: cyan-green, near white
  // at the heart)
  vec3 tint(vec3 c) {
    if (uGreen < 0.5) return c;
    return vec3(c.b * 0.6 + c.g * 0.25, c.r, c.r * 0.55 + c.g * 0.45);
  }
  // heat 0..1 -> fire colour (linear): deep red, orange, yellow, white-hot
  vec3 fireCol(float k) {
    vec3 c = mix(vec3(0.35, 0.03, 0.005), vec3(1.0, 0.22, 0.02), smoothstep(0.0, 0.35, k));
    c = mix(c, vec3(1.0, 0.55, 0.12), smoothstep(0.3, 0.65, k));
    return mix(c, vec3(1.0, 0.88, 0.6), smoothstep(0.65, 1.0, k));
  }
  void main() {
    float kind = vShape.w, ph = vShape.z;
    float t = uTime;
    vec3 col = vec3(0.0);
    float a = 0.0;
    if (kind < 0.5) {
      // the body. p: x across the flame (-1..1 at its foot), y up it (0 foot, 1 top)
      vec2 p = vec2(vUv.x * 0.65 / 0.5, vUv.y * 0.75 + 0.55);
      float fl = flick(t, ph);
      float y = p.y / (1.0 + 0.12 * fl);
      // it leans and sways, more toward its top
      float sway = (fbm(vec2(y * 1.2 - t * 0.9, ph * 40.0)) - 0.5) * 0.7 * y * y;
      float x = p.x - sway;
      // noise rising through it (warped by a slower noise, so the tongues curl), quicker than the flame itself
      vec2 q = vec2(x * 2.3 + ph * 9.0, y * 1.5 - t * 2.1);
      float n = fbm(q * 1.7 + vec2(fbm(q * 1.1 + vec2(0.0, t * 0.5)) * 1.1, 0.0));
      // a column of heat narrowing as it rises, falling off toward its top, torn into tongues by the noise (more so
      // higher up); a crisp edge, as the image paints them
      float colm = exp(-pow(x / (0.68 * (1.0 - 0.5 * clamp(y, 0.0, 1.0)) + 0.02), 2.0) * 1.6);
      // (several tongues side by side, wandering: the heat is uneven across the flame)
      colm *= 0.6 + 0.6 * fnoise(vec2(x * 2.6 + ph * 17.0, t * 0.9 + y * 0.6));
      float f = colm * (1.25 - y * 1.05) * 1.55 - n * (0.5 + 1.0 * y);
      f *= smoothstep(-0.2, 0.2, y);   // (its foot melts into the coals, no edge)
      float heat = clamp(f * 1.05 - y * 0.15, 0.0, 1.0);
      col = mix(vec3(0.85, 0.12, 0.01), vec3(1.0, 0.36, 0.04), smoothstep(0.05, 0.35, heat));
      col = mix(col, vec3(1.0, 0.7, 0.2), smoothstep(0.45, 0.75, heat));
      col = mix(col, vec3(1.0, 0.93, 0.75), smoothstep(0.8, 1.0, heat));
      col *= 1.0 + 0.15 * fl;
      a = smoothstep(0.04, 0.14, f);
      gl_FragColor = vec4(tint(col) * uGain * a * (uGlowPass > 0.5 ? 0.5 : 1.0), a * 0.6);
      return;
    } else if (kind < 1.5) {
      // a tongue: a soft teardrop, pointed upward, frayed by noise
      vec2 q = vUv;
      float e = length(vec2(q.x / (1.0 - 0.55 * max(q.y, 0.0)), q.y));
      float n = fnoise(q * 2.5 + vec2(vRand.x * 40.0, -t * 4.0));
      a = smoothstep(0.75, 0.45, e + (n - 0.5) * 0.3) * vA * 0.5;
      col = fireCol(clamp(vHeat * 0.6 + (1.0 - e) * 0.15, 0.0, 1.0));
    } else if (kind < 2.5) {
      float e = length(vUv);
      a = (1.0 - smoothstep(0.1, 1.0, e)) * vA;
      col = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.8, 0.45), (1.0 - e) * vHeat);
    } else {
      // a candle (c: game units from its foot)
      float h = vShape.y, w = vShape.x;
      float fl = flick(t, ph);
      float jit = fnoise(vec2(t * 9.0, ph * 61.0 + 3.0)) - 0.5;
      vec2 c = vec2(vUv.x * 1.1 * h, vUv.y * 1.1 * h + h * 0.45);
      float hs = h * (0.8 + 0.2 * fl + 0.14 * jit);                  // it stretches and dips
      float y = c.y / hs;
      float lean = (fnoise(vec2(t * 1.7, ph * 61.0 + 11.0)) - 0.5) * 0.5 * w * y * y;
      float x = (c.x - lean) / (w * 0.5);
      // a teardrop: round at its foot, drawn to a point at its tip
      float prof = y < 0.3 ? sqrt(clamp(y, 0.0, 1.0) / 0.3) : pow(clamp((1.0 - y) / 0.7, 0.0, 1.0), 0.85);
      float d = prof - abs(x);
      float flame = smoothstep(0.0, 0.35, d) * step(0.0, y) * step(y, 1.0);
      float core = smoothstep(0.25, 0.75, d) * smoothstep(0.75, 0.25, y);
      vec3 fc = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.7, 0.25), smoothstep(0.0, 0.5, d));
      fc = mix(fc, vec3(1.0, 0.95, 0.8), core);
      fc = mix(fc, vec3(0.25, 0.3, 0.8), (1.0 - smoothstep(0.0, 0.12, y)) * 0.5);   // (its foot a little blue)
      // the halo: the warm light round it, breathing with it
      float r = length(vec2(c.x, c.y - hs * 0.45)) / (h * 1.05);
      float halo = exp(-r * r * 4.0) * (0.22 + 0.1 * fl);
      col = fc * flame * (1.6 + 0.3 * fl) + vec3(1.0, 0.45, 0.12) * halo;
      gl_FragColor = vec4(tint(col) * uGain * (uGlowPass > 0.5 ? 0.9 : 1.0), clamp(flame, 0.0, 1.0) * 0.5);
      return;
    }
    gl_FragColor = vec4(tint(col) * uGain * a * (uGlowPass > 0.5 ? 0.6 : 1.0), a * 0.35);
  }
`;
function makeRefFlames2(bd) {
  const fl = bd.meta.ref?.flames;
  if (!fl)
    return null;
  const r = bd.meta.ref;
  const base = [], shape = [], rand = [];
  let h = 97531;
  const rnd = () => (h = (h * 1103515245 + 12345) % 2147483648) / 2147483648;
  const q8 = (p) => Math.round(p * 255) / 255;
  const card = (x, y, z, w, hh, ph, kind) => {
    base.push(x, y, z);
    shape.push(w, hh, q8(ph), kind);
    rand.push(rnd(), rnd());
  };
  for (const [x, y, z, w, hh, ph] of fl.fires) {
    card(x, y, z, w, hh, ph, 0);
    for (let i = 0;i < 7; i++)
      card(x, y, z, w, hh, ph, 1);
    for (let i = 0;i < 16; i++)
      card(x, y, z, w, hh, ph, 2);
  }
  for (const [x, y, z, w, hh, ph] of fl.candles)
    card(x, y, z, w, hh, ph, 3);
  const g = unitQuad();
  g.setAttribute("aBase", new Fn(new Float32Array(base), 3));
  g.setAttribute("aShape", new Fn(new Float32Array(shape), 4));
  g.setAttribute("aRand", new Fn(new Float32Array(rand), 2));
  g.instanceCount = base.length / 3;
  const mat = (glow) => new Kt({
    uniforms: { uTime: { value: 0 }, uGlowPass: { value: glow ? 1 : 0 }, uRight: { value: r.right }, uUp: { value: r.up }, uBack: { value: r.back }, uGain: { value: bd.meta.fx?.flameGain ?? 1 }, uGreen: { value: bd.meta.fx?.flame === "green" ? 1 : 0 } },
    vertexShader: flameCardVert,
    fragmentShader: flameCardFrag,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: ja,
    blendSrc: eo,
    blendDst: no,
    toneMapped: false
  });
  const flames = new Tt(g, mat(false));
  const glow = new Tt(g, mat(true));
  flames.frustumCulled = glow.frustumCulled = false;
  flames.renderOrder = glow.renderOrder = 4;
  glow.layers.set(1);
  const fires = fl.fires.map(([x, y, z, , hh, ph]) => ({ x, y: y + hh * 0.5, z, ph: q8(ph) }));
  const lamps = fires.slice(0, 8).map((f) => ({ x: f.x, y: f.y, z: f.z, w: 1 }));
  return {
    objects: [flames, glow],
    update(now) {
      flames.material.uniforms.uTime.value = glow.material.uniforms.uTime.value = now;
    },
    lanterns(now) {
      for (let i = 0;i < lamps.length; i++)
        lamps[i].w = 1 + 0.25 * flickJS(now, fires[i].ph);
      return lamps;
    },
    dispose() {
      g.dispose();
      flames.material.dispose();
      glow.material.dispose();
    }
  };
}
function makeRefBell2(bd, which = "bell") {
  const B = bd.meta[which], r = bd.meta.ref;
  const tex = which === "answer" ? bd.refAnswer : bd.refBell;
  if (!B || !tex)
    return null;
  const [AMP, BEAT, DAMP] = B.swing || [0.22, 6.5, 1.1];
  const W = r.image.w, H = r.image.h, f = H / 2 / Math.tan(r.vfov * Math.PI / 360);
  const [px, py, pz] = r.pos, { right: R, up: UP, back: BK } = r;
  const ray = (u, v) => {
    const a = (u - W / 2) / f, b = -(v - H / 2) / f;
    return [0, 1, 2].map((k) => -BK[k] + a * R[k] + b * UP[k]);
  };
  const dg = ray(B.ground[0], B.ground[1]), tg = (B.h - py) / dg[1];
  const G = [px + dg[0] * tg, B.h, pz + dg[2] * tg];
  const fh = [-BK[0], 0, -BK[2]], fl = Math.hypot(fh[0], fh[2]);
  fh[0] /= fl;
  fh[2] /= fl;
  const onPlane = (u, v) => {
    const d = ray(u, v), t = ((G[0] - px) * fh[0] + (G[2] - pz) * fh[2]) / (d[0] * fh[0] + d[2] * fh[2]);
    return [px + d[0] * t, py + d[1] * t, pz + d[2] * t];
  };
  const [x0, y0, x1, y1] = B.box;
  const hook = onPlane(B.hook[0], B.hook[1]);
  const corners = [onPlane(x0, y0), onPlane(x1, y0), onPlane(x0, y1), onPlane(x1, y1)];
  const rel = corners.map((c) => [c[0] - hook[0], c[1] - hook[1], c[2] - hook[2]]);
  const geo = new ot;
  geo.setAttribute("position", new Xe(rel.flat(), 3));
  geo.setAttribute("uv", new Xe([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  geo.computeBoundingSphere();
  const mat = new Kt({
    uniforms: { tBell: { value: tex } },
    vertexShader: vert,
    fragmentShader: `
      uniform sampler2D tBell;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tBell, vUv);
        if (c.a < 0.02) discard;
        c.rgb = mix(c.rgb / 12.92, pow((c.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, c.rgb));
        gl_FragColor = vec4(c.rgb, c.a);
      }`,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    side: 2,
    forceSinglePass: true
  });
  mat.alphaTest = 0;
  const mesh = new Tt(geo, mat);
  mesh.position.set(...hook);
  mesh.frustumCulled = false;
  mesh.renderOrder = -9;
  const axis = { x: -BK[0], y: -BK[1], z: -BK[2] };
  const strikes = [];
  return {
    mesh,
    strike(a, now) {
      const across = Math.cos(a) * Math.SQRT1_2 - Math.sin(a) * Math.SQRT1_2;
      if (strikes.length >= 6)
        strikes.shift();
      strikes.push([now, across >= 0 ? -1 : 1]);
    },
    update(now) {
      let sum = 0;
      for (const [t0, side] of strikes) {
        const t = now - t0;
        if (t >= 0 && t <= 14)
          sum += AMP * side * Math.exp(-DAMP * t) * Math.sin(BEAT * t);
      }
      const ang = AMP * 1.3 * Math.tanh(sum / (AMP * 1.3));
      mesh.quaternion.setFromAxisAngle(axis, -ang);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    }
  };
}

export { loadBackdrop2, makeBackdrop2, makeBackdropFx2, makeRefBackdrop2, makeRefFlames2, makeRefBell2 };
