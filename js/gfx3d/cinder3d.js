// Sister Cinder's fire (her polish pass, 2026-10-20 — the owner: "go through the full attacks and everything around the boss to
// make sure that it is high quality with timings, and particles etc."). Before it her spells were the garden's flat red marks
// with a few square specks in the bog's green, her fireball the toad's green goo ball, her embers 2D pixel cards, a blow on her
// threw blood and steel sparks, and she died in the dither fade with gold motes. What is here is the view's alone: it reads the
// sim (her marks by their tags, her shots and embers, her move's clock) and hangs off its beats and her bones (hands, chest) —
// never her clips: her attack clips are being remade from the owner's videos (docs/MONSTER-ANIM-FROM-VIDEO.md), and all of this
// keeps working when they are swapped. Its own random, never the sim's; real time (`now`), so a hit-stop never freezes a blast.
//
//   flames   instanced flame cards standing square to the camera — the Ash Floor's own flame (backdrop3d.js flameCardFrag),
//            so her fire burns like the shrine's bowls: a flame in each hand (the owner's pick for her look, OWNER-DECISIONS
//            A8: "a flame in each hand, a burning hem"), the lanes' walls of fire, the nova's ring, burning ground, the falling
//            and thrown fireballs, her embers; and round glows (a fireball's core, an ember's heart)
//   puffs    soft fire puffs (additive, white-hot to deep red as they age) and smoke and ash (normal, darkening, growing)
//   scorch   burnt ground left where a blast landed, its glowing cracks cooling over a few seconds
//   sparks   the fight's glints (sparks3d.js): ember sparks, flashes, rings
// Sizes are world units (the hero is 19.6 tall, about 3 px a unit on a phone: polish-boss-fight skill §8).
import { Mesh, InstancedBufferGeometry, InstancedBufferAttribute, Float32BufferAttribute, ShaderMaterial, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, DynamicDrawUsage, Vector3, Vector4, Color, SphereGeometry, PlaneGeometry, BackSide, DoubleSide } from "./three-lib.js?v=48fd128-df87a96f";
import { floorAt } from "./floorh3d.js?v=48fd128-df87a96f";
import { KIND, phaseOf, radiusOf } from "../sim/hazards.js?v=48fd128-df87a96f";
import { rng } from "../util.js?v=48fd128-df87a96f";
import { sfx } from "../audio.js?v=48fd128-df87a96f";

const TAU = Math.PI * 2;
const pal = (...h) => h.map((x) => new Color(x));
/** Ember sparks: her fire's own orange and gold (sparks3d.js palettes). */
export const EMBER = pal("#ffb347", "#ff7a1a", "#ffd27a", "#ff5a1f");
const HOT = pal("#fff3c4", "#ffd27a", "#ffe9a8");
const ASHC = pal("#cfc8c0", "#a8a29a", "#e6e0d8");
/** The bubble's film: glassy whites and its thin-film tints. */
const FILM = pal("#ffffff", "#e8f4ff", "#ffe8f4", "#e8fff0", "#fff4d8");

// (noise hashed without sin(): ANGLE's Direct3D sin of big numbers comes back nearly smooth — geyser3d.js; "hash without sine",
// Dave Hoskins, MIT)
const NOISE = /* glsl */ `
  float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
`;

// --- the flame cards -----------------------------------------------------------------------------------------------------
const cardVert = /* glsl */ `
  attribute vec3 aBase;   // its foot (a glow: its middle), world
  attribute vec4 aShape;  // width, height, phase, strength 0..1
  attribute vec2 aKind;   // 0 a flame, 1 a glow, 2 a sheet of flame (a wall's piece); how hot (1 as the bowls, more is whiter)
  uniform vec3 uRight, uUp, uBack;
  varying vec2 vUv;
  varying vec4 vShape;
  varying vec2 vKind;
  void main() {
    float w = aShape.x, h = aShape.y;
    vUv = position.xy; vShape = aShape; vKind = aKind;
    vec2 size = vec2(w * 0.65, h * 0.75), at = vec2(0.0, h * 0.55);   // (a flame: -0.65..0.65 of its width, -0.2..1.3 of its height)
    if (aKind.x > 0.5 && aKind.x < 1.5) { size = vec2(w); at = vec2(0.0); }
    vec3 p = aBase + uBack * (0.15 * w) + uRight * (at.x + position.x * size.x) + uUp * (at.y + position.y * size.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
// (the body of the Ash Floor's flame, backdrop3d.js flameCardFrag kind 0, with a strength and a heat of its own)
const cardFrag = /* glsl */ `
  uniform float uTime, uGlowPass;
  varying vec2 vUv;
  varying vec4 vShape;
  varying vec2 vKind;
  ${NOISE}
  void main() {
    float A = vShape.w, ph = vShape.z, hk = vKind.y, t = uTime;
    if (vKind.x > 0.5 && vKind.x < 1.5) {
      float d = length(vUv);
      float core = smoothstep(0.42, 0.0, d), halo = exp(-d * d * 5.0);
      vec3 col = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.95, 0.8), core) * (core * 1.5 + halo * 0.55) * min(1.6, hk);
      float a = clamp(core + halo * 0.35, 0.0, 1.0) * A;
      gl_FragColor = vec4(col * A * (uGlowPass > 0.5 ? 0.7 : 1.0), a * 0.45);
      return;
    }
    vec2 p = vec2(vUv.x * 0.65 / 0.5, vUv.y * 0.75 + 0.55);
    float fl = (vn(vec2(t * 5.0, ph * 61.0)) * 2.0 - 1.0) * 0.6 + (vn(vec2(t * 13.0, ph * 61.0 + 7.0)) * 2.0 - 1.0) * 0.4;
    float y = p.y / (1.0 + 0.12 * fl);
    float sway = (fbm(vec2(y * 1.2 - t * 0.9, ph * 40.0)) - 0.5) * 0.7 * y * y;
    float x = p.x - sway;
    vec2 q = vec2(x * 2.3 + ph * 9.0, y * 1.5 - t * 2.1);
    float n = fbm(q * 1.7 + vec2(fbm(q * 1.1 + vec2(0.0, t * 0.5)) * 1.1, 0.0));
    float colm = vKind.x > 1.5
      ? (1.0 - smoothstep(0.75, 1.25, abs(x))) * (0.8 + 0.25 * vn(vec2(x * 1.7 + ph * 13.0, t * 0.7)))   // (a sheet: wide, its ends faded)
      : exp(-pow(x / (0.68 * (1.0 - 0.5 * clamp(y, 0.0, 1.0)) + 0.02), 2.0) * 1.6);
    colm *= 0.6 + 0.6 * vn(vec2(x * 2.6 + ph * 17.0, t * 0.9 + y * 0.6));
    float f = colm * (1.25 - y * 1.05) * 1.55 - n * (0.5 + 1.0 * y);
    f *= smoothstep(-0.2, 0.2, y);
    float heat = clamp((f * 1.05 - y * 0.15) * hk, 0.0, 1.0);
    vec3 col = mix(vec3(0.85, 0.12, 0.01), vec3(1.0, 0.36, 0.04), smoothstep(0.05, 0.35, heat));
    col = mix(col, vec3(1.0, 0.7, 0.2), smoothstep(0.45, 0.75, heat));
    col = mix(col, vec3(1.0, 0.93, 0.75), smoothstep(0.8, 1.0, heat));
    float a = smoothstep(0.04, 0.14, f) * A;
    gl_FragColor = vec4(col * a * (uGlowPass > 0.5 ? 0.5 : 1.1), a * 0.6);
  }
`;

// --- the puffs: fire (additive) and smoke / ash (darkening) -----------------------------------------------------------------
const puffVert = /* glsl */ `
  attribute vec4 iPos;   // x, y, z (world), size
  attribute vec4 iData;  // age 0..1, seed, kind (0 fire, 1 smoke, 2 ash flake), strength
  uniform vec3 uRight, uUp;
  varying vec2 vUv;
  varying vec4 vData;
  void main() {
    vUv = position.xy; vData = iData;
    vec3 p = iPos.xyz + (uRight * position.x + uUp * position.y) * iPos.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const puffFrag = /* glsl */ `
  uniform float uGlowPass;
  varying vec2 vUv;
  varying vec4 vData;
  ${NOISE}
  void main() {
    float age = vData.x, seed = vData.y, kind = vData.z, A = vData.w;
    float d = length(vUv);
    if (kind > 1.5 && kind < 2.5) {
      // an ash flake: small, pale, a soft-cornered speck
      float a = smoothstep(1.0, 0.45, d) * A * (1.0 - smoothstep(0.6, 1.0, age)) * smoothstep(0.0, 0.1, age);
      gl_FragColor = vec4(vec3(0.42, 0.4, 0.38) * a, a * 0.85);
      return;
    }
    float c = cos(seed * 6.28), s = sin(seed * 6.28);
    vec2 r = vec2(c * vUv.x - s * vUv.y, s * vUv.x + c * vUv.y);
    float n = vn(r * 2.2 + seed * 37.0 + vec2(0.0, -age * 2.5)) * 0.6 + vn(r * 5.0 + seed * 11.0) * 0.4;
    float m = smoothstep(1.0, 0.2, d + (n - 0.5) * 0.75);
    if (kind > 0.5) {
      // (smoke dark; kind 3, the veil's ash, a pale warm grey that reads over the dark floor)
      vec3 col = kind > 2.5 ? mix(vec3(0.16, 0.15, 0.14), vec3(0.34, 0.31, 0.28), n) : mix(vec3(0.03, 0.026, 0.026), vec3(0.11, 0.095, 0.09), n);
      float a = m * A * smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.35, 1.0, age)) * 0.65;
      if (uGlowPass > 0.5) a = 0.0;
      gl_FragColor = vec4(col * a, a);
      return;
    }
    // (orange to deep red, white only at the hottest cores: added over the floor's blue-grey a pale yellow read green-white)
    float heat = clamp(1.0 - age * 1.3, 0.0, 1.0) * (0.75 + 0.45 * n);
    vec3 col = mix(vec3(0.42, 0.04, 0.008), vec3(1.0, 0.28, 0.035), smoothstep(0.08, 0.45, heat));
    col = mix(col, vec3(1.0, 0.58, 0.16), smoothstep(0.5, 0.82, heat));
    col = mix(col, vec3(1.0, 0.9, 0.7), smoothstep(0.9, 1.0, heat));
    float a = m * A * smoothstep(0.0, 0.05, age) * (1.0 - smoothstep(0.5, 1.0, age));
    gl_FragColor = vec4(col * a * (uGlowPass > 0.5 ? 0.6 : 1.1), a * 0.5);
  }
`;

// --- the scorch left on the ground -------------------------------------------------------------------------------------------
const scorchVert = /* glsl */ `
  attribute vec4 iPos;   // x, y, z (world), radius
  attribute vec3 iData;  // age 0..1 (a pool of light: its strength), seed, kind (0 scorch, 1 a pool of light)
  varying vec2 vUv;
  varying vec3 vData;
  void main() {
    vUv = position.xy; vData = iData;
    vec3 p = iPos.xyz + vec3(position.x, 0.0, position.y) * iPos.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const scorchFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vData;
  ${NOISE}
  void main() {
    float age = vData.x, seed = vData.y;
    float d = length(vUv);
    if (vData.z > 0.5) {
      // a pool of firelight on the ground (her charge): warm, soft, flickering a little
      float g = exp(-d * d * 3.2) * age * (0.85 + 0.15 * vn(vUv * 3.0 + seed * 40.0));
      if (g < 0.003) discard;
      gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * g * 0.9, 0.0);
      return;
    }
    float n = vn(vUv * 3.0 + seed * 20.0) * 0.6 + vn(vUv * 7.0 + seed * 7.0) * 0.4;
    float edge = d + (n - 0.5) * 0.5;
    float charA = smoothstep(1.0, 0.5, edge) * 0.62 * (1.0 - smoothstep(0.45, 1.0, age));
    float cr = 1.0 - smoothstep(0.0, 0.09, abs(vn(vUv * 2.4 + seed * 31.0) - 0.5) * (0.7 + 0.6 * n));
    float glow = cr * smoothstep(0.95, 0.25, edge) * (1.0 - smoothstep(0.0, 0.55, age));
    vec3 g = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.62, 0.18), clamp(1.0 - age * 2.2, 0.0, 1.0)) * glow * 1.3;
    if (charA < 0.003 && glow < 0.003) discard;
    gl_FragColor = vec4(g, charA);
  }
`;

// --- her bubble (her opening: she waits in it at the altar till the bell is struck; her seal: sealed in it in the fight) --------
// A soap film: nearly clear in its middle, its rim catching the light (no refraction of the picture behind: it is drawn after
// it). Made calmer and finer (the owner, 2026-10-21: "Make the ball around cinder sister cooler with some tranquil effects around
// her while in that state"): its colours marbled by a slow swirl that drains toward its foot as a real film does (thin and pale at
// its crown, the bands drifting a few seconds each — the old swirl turned three times as fast, a full rainbow all over), held
// toward the shrine's golds and a cool teal; her fire's warmth breathing slowly inside it (`uBreath`, one breath in 5.2 s); a
// sheen of light sweeping round it once in 14 s; the far side's film seen through the near (`uBack`); two highlights, the
// braziers' and the sky's. Her seal's telegraph (`uForm` 0 to 1): the film drawn up round her from the floor, a bright seam on
// its rising edge. A blow on it (`uHit`: the struck point's direction from its middle, and the seconds since): a ripple running
// out over the film from there, the film swelling with it.
const bubbleVert = /* glsl */ `
  uniform vec4 uHit;
  varying vec3 vN, vV, vP;
  void main() {
    vec3 n = normalize(position);
    float ang = acos(clamp(dot(n, uHit.xyz), -1.0, 1.0)), ht = uHit.w;
    float rip = ht >= 0.0 ? sin(ang * 9.0 - ht * 22.0) * exp(-ht * 4.0) * smoothstep(ht * 6.0 + 0.4, ht * 6.0 - 0.2, ang) : 0.0;
    vec4 wp = modelMatrix * vec4(position + normal * rip * 0.8, 1.0);
    vP = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const bubbleFrag = /* glsl */ `
  uniform float uTime, uA, uGlowPass, uForm, uBreath, uR, uBack;
  uniform vec4 uHit;
  varying vec3 vN, vV, vP;
  ${NOISE}
  vec3 film(float d) { return 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + d)); }
  void main() {
    vec3 P = vP / uR;
    // (drawn up from the floor as it forms: its foot is 0.62 of its radius below its middle, bubbleAt)
    float edgeY = mix(-0.64, 1.04, uForm);
    if (P.y > edgeY) discard;
    float seam = uForm < 0.999 ? exp(-pow((edgeY - P.y) / 0.06, 2.0)) : 0.0;
    vec3 N = normalize(vN), V = normalize(vV);
    float nv = abs(dot(N, V));
    float rim = pow(1.0 - nv, 2.4);
    float t = uTime;
    float a0 = atan(P.z, P.x);
    vec2 q = vec2(a0 * 1.25 + t * 0.045, P.y * 1.7 + t * 0.06);
    vec2 warp = vec2(fbm(q * 0.8 + vec2(0.0, t * 0.03)), fbm(q * 0.8 + vec2(5.2, -t * 0.025)));
    float swirl = fbm(q + warp * 1.5);
    float thick = 0.5 + 0.22 * (1.0 - P.y) + (swirl - 0.5) * 2.4;
    vec3 irid = film(thick * 1.15 + nv * 0.45 + 0.1);
    irid = mix(vec3(dot(irid, vec3(0.333))), irid, 0.72) * vec3(1.05, 0.98, 0.92);
    irid *= 0.55 + 0.45 * smoothstep(0.98, 0.35, P.y);   // (its crown thinned to a pale clear film)
    vec3 warm = vec3(1.0, 0.56, 0.24) * (0.5 + 0.5 * uBreath) * (0.75 - 0.35 * P.y);
    vec3 L1 = normalize(vec3(-0.45 + 0.06 * sin(t * 0.21), 0.8, 0.4));
    vec3 L2 = normalize(vec3(0.6, 0.55, -0.2 + 0.06 * cos(t * 0.17)));
    float s1 = pow(max(dot(reflect(-L1, N), V), 0.0), 70.0);
    float s2 = pow(max(dot(reflect(-L2, N), V), 0.0), 24.0);
    float sweep = pow(0.5 + 0.5 * cos(a0 - t * 0.45), 16.0) * (0.35 + 0.65 * rim);
    float ang = acos(clamp(dot(normalize(P), uHit.xyz), -1.0, 1.0)), ht = uHit.w;
    float rip = ht >= 0.0 ? pow(abs(sin(ang * 9.0 - ht * 22.0)), 3.0) * exp(-ht * 3.5) * smoothstep(ht * 6.0 + 0.4, ht * 6.0 - 0.2, ang) : 0.0;
    vec3 col = irid * (0.03 + rim * 0.6 + sweep * 0.4 + rip * 0.65)
             + warm * (0.012 + 0.22 * rim)
             + vec3(1.0, 0.92, 0.8) * s1 * 0.85 + vec3(0.72, 0.88, 1.0) * s2 * 0.22
             + vec3(1.0, 0.95, 0.86) * seam * 1.5;
    float a = (0.03 + rim * 0.3 + s1 * 0.5 + sweep * 0.1 + rip * 0.45 + seam * 0.7) * uA;
    if (uBack > 0.5) { col *= 0.35; a *= 0.3; }
    if (uGlowPass > 0.5) { col *= 0.4; a *= 0.3; }
    gl_FragColor = vec4(col * uA, a * 0.6);
  }
`;
// --- a ring of rune light on the ground (round her bubble; at the bell while she is sealed) -------------------------------------
// Two thin circles with a band of small glyphs between them (strokes, dots and little bars in cells round it, faint), the bands
// turning slowly against each other, a soft pool of light inside; all of it breathing (`uBreath`) and pulsing (`uPulse`). Added
// light only, laid on the floor (the painted floor's own depth keeps it off walls and from in front of what stands on it).
const ringVert = /* glsl */ `
  uniform vec3 uC;
  uniform float uR;
  varying vec2 vUv;
  void main() {
    vUv = position.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(uC + vec3(position.x, 0.0, position.y) * uR, 1.0);
  }
`;
const ringFrag = /* glsl */ `
  uniform float uTime, uA, uBreath, uPulse, uSpin, uPool;
  uniform vec3 uCol;
  varying vec2 vUv;
  ${NOISE}
  float line(float d, float at, float w) { return exp(-pow((d - at) / w, 2.0)); }
  void main() {
    float d = length(vUv);
    if (d > 1.0) discard;
    float a = atan(vUv.y, vUv.x);
    // the glyph band (0.7 to 0.86 of it): 28 cells turning one way, each a stroke, a dot or two short bars by its own hash
    float ag = a + uTime * 0.06 * uSpin;
    float cells = 28.0, u = ag / 6.2832 * cells, id = floor(u), x = fract(u) - 0.5;
    float y = (d - 0.78) / 0.07;
    float h = h12(vec2(id, 7.0));
    float g = h < 0.4 ? exp(-pow(x / 0.06, 2.0)) * smoothstep(1.0, 0.7, abs(y))
            : h < 0.7 ? exp(-(x * x + y * y * 0.12) / 0.012)
            : (exp(-pow((y - 0.4) / 0.18, 2.0)) + exp(-pow((y + 0.4) / 0.18, 2.0))) * smoothstep(0.32, 0.22, abs(x));
    g *= 0.55 + 0.45 * sin(uTime * 0.9 + id * 1.7);
    // the inner circle's ticks, turning the other way
    float at = a - uTime * 0.09 * uSpin;
    float ticks = pow(0.5 + 0.5 * cos(at * 48.0), 12.0) * line(d, 0.62, 0.03);
    float rings = line(d, 0.92, 0.012) + line(d, 0.7, 0.01) * 0.8 + line(d, 0.86, 0.008) * 0.6;
    float pool = exp(-d * d * 2.6) * uPool;
    float k = (0.55 + 0.45 * uBreath) * (1.0 + uPulse);
    vec3 col = uCol * (rings * 0.9 + g * 0.55 + ticks * 0.5) * k + uCol * vec3(1.0, 0.8, 0.6) * pool * (0.6 + 0.4 * uBreath);
    gl_FragColor = vec4(col * uA, 0.0);
  }
`;

const premult = (extra = {}) => ({ transparent: true, depthWrite: false, depthTest: true, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, toneMapped: false, ...extra });
const quadGeo = (n, attrs) => {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  const out = {};
  for (const [name, size] of attrs) {
    const a = new InstancedBufferAttribute(new Float32Array(n * size), size);
    a.setUsage(DynamicDrawUsage);
    g.setAttribute(name, a);
    out[name] = a;
  }
  g.instanceCount = 0;
  return { g, a: out };
};

/**
 * Her fire. `sparks` the fight's glints (sparks3d.js). Add `objects` to the scene; feed it the sim's events (telegraph, fire,
 * hit, hurt, …) and call update() every frame after she is posed.
 */
export function makeCinderFx({ sparks }) {
  const rand = rng(0xc1de7);
  const R = (lo, hi) => lo + (hi - lo) * rand();
  const right = new Vector3(1, 0, 0), up = new Vector3(0, 1, 0), back = new Vector3(0, 0, 1);

  // --- flame cards: filled afresh every frame ---------------------------------------------------------------------------
  const MAXC = 480;
  const C = quadGeo(MAXC, [["aBase", 3], ["aShape", 4], ["aKind", 2]]);
  const cardU = () => ({ uTime: { value: 0 }, uGlowPass: { value: 0 }, uRight: { value: right }, uUp: { value: up }, uBack: { value: back } });
  const cardMat = (glow) => {
    const u = cardU();
    u.uGlowPass.value = glow ? 1 : 0;
    return new ShaderMaterial({ uniforms: u, vertexShader: cardVert, fragmentShader: cardFrag, ...premult() });
  };
  const cards = new Mesh(C.g, cardMat(false));
  const cardsGlow = new Mesh(C.g, cardMat(true));
  cards.frustumCulled = cardsGlow.frustumCulled = false;
  cards.renderOrder = cardsGlow.renderOrder = 8;
  cardsGlow.layers.set(1);
  let nC = 0;
  /** A flame (kind 0: its foot at x, y, z) or a glow (kind 1: its middle there), w x h world units, `a` its strength. */
  function card(x, y, z, w, h, ph, a, kind = 0, heat = 1) {
    if (nC >= MAXC || !(a > 0.01) || !(w > 0.05)) return;
    C.a.aBase.array.set([x, y, z], nC * 3);
    C.a.aShape.array.set([w, h, ph, Math.min(1, a)], nC * 4);
    C.a.aKind.array.set([kind, heat], nC * 2);
    nC++;
  }
  /** A flame standing on the ground at sim (x, y). */
  const groundCard = (x, y, w, h, ph, a, heat) => card(x, floorAt(x, y), y, w, h, ph, a, 0, heat);

  // --- puffs --------------------------------------------------------------------------------------------------------------
  const MAXF = 900, MAXS = 420;
  const puffMat = (glow, kind) => new ShaderMaterial({ uniforms: { uGlowPass: { value: glow ? 1 : 0 }, uRight: { value: right }, uUp: { value: up } }, vertexShader: puffVert, fragmentShader: puffFrag, ...premult() });
  const F = quadGeo(MAXF, [["iPos", 4], ["iData", 4]]);
  const S = quadGeo(MAXS, [["iPos", 4], ["iData", 4]]);
  const fireMesh = new Mesh(F.g, puffMat(false));
  const fireGlow = new Mesh(F.g, puffMat(true));
  const smokeMesh = new Mesh(S.g, puffMat(false));
  for (const m of [fireMesh, fireGlow, smokeMesh]) m.frustumCulled = false;
  smokeMesh.renderOrder = 7;
  fireMesh.renderOrder = fireGlow.renderOrder = 9;
  fireGlow.layers.set(1);
  const fireL = [], smokeL = [];
  /**
   * A puff at world (x, y, z) moving (vx, vy, vz) u/s. kind 0 fire, 1 smoke, 2 an ash flake; `life` s; sizes from s0 to s1;
   * `buoy` its rise (u/s²; fire and smoke float up), `drag` per 1/60 s.
   */
  function puff(kind, x, y, z, vx, vy, vz, life, s0, s1, { buoy = kind === 0 ? 40 : kind === 1 || kind === 3 ? 14 : -6, drag = 0.95, a = 1, swirl = 0, cx = 0, cz = 0, jet = null, off = 0, v = 0, d0 = 0 } = {}) {
    const L = kind === 0 ? fireL : smokeL;
    if (L.length >= (kind === 0 ? MAXF : MAXS)) return;
    L.push({ kind, x, y, z, vx, vy, vz, t: 0, life: life * R(0.75, 1.25), s0, s1, buoy, drag, a, seed: rand(), swirl, cx, cz, jet, off, v, d: d0 });
  }
  function stepPuffs(L, A, dt) {
    let n = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.t += dt;
      if (q.t >= q.life) {
        L[i] = L[L.length - 1];
        L.pop();
        continue;
      }
      const dr = Math.pow(q.drag, dt * 60);
      if (q.jet) {
        // (riding the firestorm's cone as it turns: out along its angle now, never where it pointed when the puff left her — a
        // spray left behind as a spiral read as fire where the cone no longer was)
        q.d += q.v * dt;
        const a = q.jet.a + q.off, r = q.jet.r0 + q.d;
        q.x = q.jet.x + Math.cos(a) * r;
        q.z = q.jet.y + Math.sin(a) * r;
        q.vy += q.buoy * dt;
        q.y += q.vy * dt;
        continue;
      }
      if (q.swirl) {
        // (round a centre: the veil's ash vortex)
        const ox = q.x - q.cx, oz = q.z - q.cz, d = Math.hypot(ox, oz) || 1;
        q.vx += (-oz / d) * q.swirl * dt - (ox / d) * 6 * dt;
        q.vz += (ox / d) * q.swirl * dt - (oz / d) * 6 * dt;
      }
      q.vx *= dr;
      q.vz *= dr;
      q.vy = q.vy * dr + q.buoy * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.kind === 2) (q.x += Math.sin(q.t * 7 + q.seed * 20) * 4 * dt), (q.z += Math.cos(q.t * 5 + q.seed * 13) * 4 * dt);
    }
    for (const q of L) {
      const k = q.t / q.life;
      A.iPos.array.set([q.x, q.y, q.z, q.s0 + (q.s1 - q.s0) * Math.sqrt(k)], n * 4);
      A.iData.array.set([k, q.seed, q.kind, q.a], n * 4);
      n++;
    }
    return n;
  }

  // --- scorch on the ground -------------------------------------------------------------------------------------------
  const MAXD = 48;
  const D = quadGeo(MAXD + 4, [["iPos", 4], ["iData", 3]]);
  const scorchMesh = new Mesh(D.g, new ShaderMaterial({ vertexShader: scorchVert, fragmentShader: scorchFrag, ...premult() }));
  scorchMesh.frustumCulled = false;
  scorchMesh.renderOrder = 2;
  const scorchL = [];
  const pools = []; // (this frame's pools of light: [x, y, r, strength])
  /** A pool of firelight on the ground at sim (x, y), `r` across, this frame. */
  const glowPool = (x, y, r, a) => pools.length < 4 && pools.push([x, y, r, a]);
  /** Burnt ground at sim (x, y), `r` across, its cracks cooling over `life` s. */
  function scorch(x, y, r, life = 4) {
    if (scorchL.length >= MAXD) scorchL.shift();
    scorchL.push({ x, y, r, t: 0, life, seed: rand() });
  }

  // --- her bubble (her opening; her seal in the fight) ---------------------------------------------------------------------
  const BUBBLE_R = 18; // (sim/world.js her bubble's solid radius: the hero comes up to its film)
  // (one set of uniforms for its three draws: the far side's film, the near side's, its glow — spread, they share each value)
  const bubbleU = { uTime: { value: 0 }, uA: { value: 0 }, uForm: { value: 1 }, uBreath: { value: 0.5 }, uR: { value: BUBBLE_R }, uHit: { value: new Vector4(0, 1, 0, -1) } };
  const bubbleMat = (glow, back) => new ShaderMaterial({ uniforms: { ...bubbleU, uGlowPass: { value: glow ? 1 : 0 }, uBack: { value: back ? 1 : 0 } }, vertexShader: bubbleVert, fragmentShader: bubbleFrag, ...premult(back ? { side: BackSide } : {}) });
  const bubbleGeo = new SphereGeometry(BUBBLE_R, 48, 32);
  const bubbleBack = new Mesh(bubbleGeo, bubbleMat(false, true));
  const bubble = new Mesh(bubbleGeo, bubbleMat(false, false));
  const bubbleGlow = new Mesh(bubbleGeo, bubbleMat(true, false));
  bubbleGlow.layers.set(1);
  const bubbleParts = [bubbleBack, bubble, bubbleGlow];
  for (const m of bubbleParts) (m.visible = false), (m.renderOrder = 10), (m.frustumCulled = false);
  bubbleBack.renderOrder = 7.5; // (behind the motes of light inside it, cards 8; the near film over them)
  // the rings of rune light on the ground: round her bubble, and at the bell while she is sealed in the fight
  const ringMat = () => new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uBreath: { value: 0.5 }, uPulse: { value: 0 }, uSpin: { value: 1 }, uPool: { value: 0.3 }, uCol: { value: new Color(0xffc87c) }, uC: { value: new Vector3() }, uR: { value: 30 } }, vertexShader: ringVert, fragmentShader: ringFrag, ...premult({ side: DoubleSide }) });
  const ringGeo = new PlaneGeometry(2, 2);
  const seatRing = new Mesh(ringGeo, ringMat());
  const bellRing = new Mesh(ringGeo, ringMat());
  for (const m of [seatRing, bellRing]) (m.visible = false), (m.renderOrder = 2), (m.frustumCulled = false);
  bellRing.material.uniforms.uSpin.value = -1.6;
  let bubbleA = 0, formK = 1, popAt = -1, moteT = 0, bellA = 0;
  /** How high off the floor its rising seam is as it forms (bubbleFrag's edgeY, its middle 0.62 of its radius up). */
  const seamH = (f) => BUBBLE_R * (1.68 * f - 0.02);
  let hit = null; // (the last blow on it: { x, y, t } — the "ward" event; its ripple runs from there)
  // the motes of light adrift round her in it: inside the film and a few outside, each on its own slow orbit and its own slow
  // rise and fall, glowing up and down — tranquil, not busy: the fastest goes round once in 14 s
  const MOTES = Array.from({ length: 20 }, (_, i) => {
    const out = i >= 13;
    return { out, r: out ? R(22, 34) : R(4, 14), a0: rand() * TAU, w: (rand() < 0.5 ? -1 : 1) * R(0.18, 0.45) * (out ? 0.6 : 1), h0: out ? R(4, 18) : R(6, 20), hA: R(2, 5), hw: R(0.25, 0.6), ph: rand() * TAU, tw: R(0.6, 1.3), s: R(1.1, 1.9), heat: R(1.0, 1.35) };
  });
  let shock = null; // (her waking's shockwave rolling out over the floor: { x, y, t0, speed, range } — the "wake" event)

  // --- helpers -----------------------------------------------------------------------------------------------------------
  const v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3();
  const gy = (x, y, h = 0) => floorAt(x, y) + h;
  /** Fire thrown up from the ground at sim (x, y): `n` puffs, a little smoke after. */
  function blast(x, y, r, n, { up = 60, out = 60, smoke = 0.4, sparkN = 0, hot = 1, crown = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, d = r * Math.sqrt(rand());
      const px = x + Math.cos(a) * d, pz = y + Math.sin(a) * d;
      const s = R(3, 5.5) * (0.6 + 0.4 * hot);
      puff(0, px, gy(px, pz, R(1, 5)), pz, Math.cos(a) * out * R(0.4, 1.1), up * R(0.5, 1.3), Math.sin(a) * out * R(0.4, 1.1), R(0.35, 0.6), s, s * 2.4, { drag: 0.92 });
    }
    // (a crown of flames standing up out of it for a moment: puffs alone read as a soft cloud)
    for (let i = 0; i < crown; i++) {
      const a = (i / crown) * TAU + rand() * 0.5, d = r * R(0.1, 0.6);
      trail.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, t: 0, life: R(0.35, 0.6), w: R(10, 15), h: R(22, 34), ph: rand(), grow: 0.06, heat: 1.2 });
    }
    for (let i = 0; i < Math.round(n * smoke); i++) {
      const a = rand() * TAU, d = r * 0.8 * Math.sqrt(rand());
      const px = x + Math.cos(a) * d, pz = y + Math.sin(a) * d;
      puff(1, px, gy(px, pz, R(6, 14)), pz, Math.cos(a) * out * 0.25, up * R(0.2, 0.45), Math.sin(a) * out * 0.25, R(1.0, 1.8), R(6, 9), R(14, 22));
    }
    if (sparkN) sparks.burst(x, y, 4, sparkN, { speed: out * 1.6, up: up * 1.2, life: 0.7, size: 1.7, grav: 90, palette: EMBER });
  }
  /** Embers rising off a spot of ground (sim x, y within r), `n` of them. */
  const riseEmbers = (x, y, r, n, h = 1) => sparks.rise(x, y, r, n, { h, up: 26, life: 1.1, size: 1.4, palette: EMBER });
  const onFloor = (w, x, y) => !w.arena || w.arena.out(x, y) <= 0;

  // --- what it remembers between frames ----------------------------------------------------------------------------------
  const seen = new Map(); // hazard → its own record (spots for burning ground, when its fire started …)
  const shotSeen = new Map(); // her fireball → its last place
  const bolts = []; // fire thrown up out of her hands into the sky (the rain's), { x, y, z, vx, vy, vz, t, life }
  const trail = []; // flames that stand a moment on their own — the sweep's left behind her, a blast's crown — { x, y, t, life, w, h, ph, grow }
  let lastNow = null;
  let ignitedAt = -1; // (fire_ignite, held to one a 0.18 s: four burning patches catch at once)
  let handA = [0, 0]; // (the hand flames' strength, eased)
  let flare = 0; // (a flare of both hand flames: a spell leaving her, a phase; decays)
  let gutter = 0; // (her flames guttering: a blow that staggers her)
  let hemT = 0, gatherT = 0, ashT = 0, smoulderT = 0, smoulderUntil = -1;
  let lastMove = null, sweepOn = false, introSeen = false, introBurst = false, deathAt = -1, veilWas = false, lanesAt = -1;
  const hand = [new Vector3(), new Vector3()];
  const chest = new Vector3(), head = new Vector3();

  /** The ash veil closing round her (her immune window opening), or thrown off her again. */
  function veilFx(on, b) {
    if (on) {
      for (let i = 0; i < 26; i++) {
        const a = rand() * TAU, d = R(4, 14);
        const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
        puff(3, x, gy(x, y, R(2, 24)), y, Math.cos(a) * 30, R(5, 20), Math.sin(a) * 30, R(1.0, 1.6), R(5, 7), R(12, 18), { swirl: 70, cx: b.x, cz: b.y });
      }
      return;
    }
    // (the veil dropping: the ash thrown off her all round, her flames back)
    flare = Math.max(flare, 1.2);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU;
      puff(3, b.x + Math.cos(a) * 8, gy(b.x, b.y, R(4, 24)), b.y + Math.sin(a) * 8, Math.cos(a) * R(60, 110), R(5, 20), Math.sin(a) * R(60, 110), R(0.8, 1.3), 6, 16, { drag: 0.92 });
      puff(2, b.x + Math.cos(a) * 8, gy(b.x, b.y, R(6, 26)), b.y + Math.sin(a) * 8, Math.cos(a) * R(50, 120), R(5, 30), Math.sin(a) * R(50, 120), R(1.0, 1.6), 0.8, 0.6, { drag: 0.93 });
    }
  }
  /** A spell leaving her hands: a flash at each, fire bursting off them. */
  function release(k = 1) {
    flare = Math.max(flare, k);
    for (const hv of hand) {
      sparks.flash(hv.x, hv.z, hv.y - floorAt(hv.x, hv.z), { size: 14 * k, life: 0.16, col: 0xffd890, a: 1.4 });
      for (let i = 0; i < 6 * k; i++) puff(0, hv.x, hv.y, hv.z, R(-30, 30), R(10, 50), R(-30, 30), R(0.25, 0.45), R(2.5, 4), R(5, 8));
    }
  }

  return {
    objects: [scorchMesh, smokeMesh, cards, cardsGlow, fireMesh, fireGlow, ...bubbleParts, seatRing, bellRing],

    // ---- the sim's events (render3d.js consume, Sister Cinder's fight only) -------------------------------------------------
    /** A mark laid (the "telegraph" event): the rain's bolt thrown up out of her hands toward where it will fall. */
    telegraph(h, hands) {
      if (h.friendly) return;
      if (h.tag === "rain" && hands) {
        const hv = hands[bolts.length % 2];
        bolts.push({ x: hv.x, y: hv.y, z: hv.z, vx: (h.x - hv.x) * 0.25, vy: 260, vz: (h.y - hv.z) * 0.25, t: 0, life: 0.45 });
        flare = Math.max(flare, 0.6);
        sfx.fireThrow?.();
      }
    },
    /** A mark going live (the "fire" event, the tick it can first hurt): the blast that lands with it. */
    fire(h, w, at) {
      if (h.friendly) return;
      const p = at ? at(h) : h;
      switch (h.tag) {
        case "wall":
        case "lane": {
          // (both walls of fire at once: the shake and the sound are one)
          const ux = Math.cos(p.a), uy = Math.sin(p.a);
          for (let s = 6; s < h.len; s += 9) {
            const x = p.x + ux * s, y = p.y + uy * s;
            if (!onFloor(w, x, y)) continue;
            const o = (rand() - 0.5) * h.w * 0.7;
            const px = x - uy * o, py = y + ux * o;
            puff(0, px, gy(px, py, 2), py, R(-12, 12), R(50, 95), R(-12, 12), R(0.4, 0.7), R(4, 6), R(9, 13));
            if (rand() < 0.35) puff(1, px, gy(px, py, 12), py, 0, R(10, 22), 0, R(1.2, 1.8), 7, 18);
          }
          // (one sound and one release for the pair: the second lane goes live on the same tick; the wall's sound is the sim's own)
          if (h.tag === "wall") release(1.6), sparks.flash(chest.x, chest.z, chest.y - floorAt(chest.x, chest.z), { size: 48, life: 0.25, col: 0xfff0c0, a: 2 });
          else if (lanesAt !== lastNow) (lanesAt = lastNow), sfx.fireLanes?.(), release(1);
          break;
        }
        case "rain":
        case "boom": {
          // a fireball (or one of her embers) bursting: a hot flash, fire thrown up and out, smoke, sparks, a ring, the ground
          // scorched
          const r = radiusOf(h);
          const big = h.tag === "boom" ? 1.25 : 1;
          blast(p.x, p.y, r * 0.55, Math.round(26 * big), { up: 85 * big, out: 70 * big, smoke: 0.45, sparkN: Math.round(16 * big), crown: 6 });
          sparks.flash(p.x, p.y, 8, { size: 27 * big, life: 0.18, col: 0xffe2a0, a: 1.7 });
          sparks.ring(p.x, p.y, { r: r * 1.05, life: 0.4, col: 0xffa040, a: 0.85 });
          scorch(p.x, p.y, r * 0.9, 4.5);
          if (h.tag === "boom") sfx.emberBoom?.();
          else sfx.fireImpact?.();
          break;
        }
        case "nova":
          // (the ring itself burns in update(); here the blast off her: her chest, both hands)
          release(1.4);
          sparks.flash(chest.x, chest.z, chest.y - floorAt(chest.x, chest.z), { size: 42, life: 0.22, col: 0xfff0c0, a: 2 });
          sparks.ring(p.x, p.y, { r: h.r + 10, life: 0.35, col: 0xffc060, a: 0.9 });
          blast(p.x, p.y, h.r * 0.6, 26, { up: 70, out: 140, smoke: 0.3, sparkN: 18, crown: 6 });
          break;
        case "storm": {
          // (the torrent along the whole cone on the tick it can first hurt — poured from her it reached a hero 90 away 0.19 s
          // after his hit: .scratch/cinder-polish/probe/hitframe.sh)
          release(1.2);
          const rec = seen.get(h) || {};
          rec.jet ??= { x: p.x, y: p.y, a: p.a, r0: h.r0 };
          seen.set(h, rec);
          for (let i = 0; i < 90; i++) {
            const d0 = rand() * (h.r - h.r0) * 0.9;
            puff(0, p.x, gy(p.x, p.y, R(5, 12)), p.y, 0, R(-4, 10), 0, R(0.5, 0.7) * (1 - d0 / h.r), R(4, 6) + d0 * 0.03, R(13, 17), { buoy: 14, jet: rec.jet, off: (rand() * 2 - 1) * h.half * 0.85, v: R(430, 520), a: 0.8, d0 });
          }
          break;
        }
        case "burn": {
          // the ground catching: a soft whoomp of flame up off it, a ring
          blast(p.x, p.y, h.r * 0.6, 10, { up: 55, out: 35, smoke: 0.3, crown: 3 });
          sparks.ring(p.x, p.y, { r: h.r, life: 0.35, col: 0xff9a40, a: 0.6 });
          if (lastNow - ignitedAt > 0.18) (ignitedAt = lastNow), sfx.fireIgnite?.();
          break;
        }
      }
    },
    /** A blow on her (the "hit" event with its damage): embers and ash knocked off her robe along the blow, a warm flash. */
    hit(e, big) {
      sparks.flash(e.x, e.y, 13, { size: big ? 18 : 10, life: big ? 0.15 : 0.09, a: big ? 1.4 : 0.9, col: e.crit ? 0xffe9a8 : 0xffe8cc });
      sparks.burst(e.x, e.y, 13, big ? 16 : 9, { speed: big ? 95 : 65, up: 35, dir: e.a, spread: 1.9, life: 0.55, size: 1.6, grav: 70, palette: EMBER });
      const z = floorAt(e.x, e.y);
      for (let i = 0; i < (big ? 7 : 4); i++) puff(1, e.x, z + R(9, 17), e.y, Math.cos(e.a) * R(10, 30), R(4, 14), Math.sin(e.a) * R(10, 30), R(0.6, 1.0), R(3, 4.5), R(7, 11));
      for (let i = 0; i < (big ? 8 : 4); i++) puff(2, e.x, z + R(10, 18), e.y, Math.cos(e.a + R(-0.8, 0.8)) * R(15, 45), R(5, 25), Math.sin(e.a + R(-0.8, 0.8)) * R(15, 45), R(0.9, 1.5), 0.7, 0.6, { drag: 0.93 });
      if (big) {
        for (let i = 0; i < 6; i++) puff(0, e.x, z + R(10, 16), e.y, Math.cos(e.a) * R(20, 50), R(10, 40), Math.sin(e.a) * R(20, 50), R(0.25, 0.4), 3, 7);
        sparks.ring(e.x, e.y, { r: 30, life: 0.35, col: 0xffb060, a: 0.5 });
      }
    },
    /** One of her embers struck (a "hit" with no damage — sim/world.js hurtAdd): sparks off it. */
    hitAdd(e) {
      sparks.burst(e.x, e.y, 12, 8, { speed: 70, up: 30, life: 0.4, size: 1.5, palette: EMBER });
      sparks.flash(e.x, e.y, 12, { size: 10, life: 0.08, col: 0xfff0d0, a: 1 });
    },
    /** The hero struck by her fire: embers and smoke off him, and he smoulders for a moment after. */
    hurt(e, now) {
      sparks.burst(e.x, e.y, 10, 12, { speed: 60, up: 40, life: 0.6, size: 1.5, grav: 60, palette: EMBER });
      const z = floorAt(e.x, e.y);
      for (let i = 0; i < 6; i++) puff(0, e.x + R(-4, 4), z + R(4, 14), e.y + R(-4, 4), R(-20, 20), R(15, 40), R(-20, 20), R(0.25, 0.45), 2.5, 6);
      for (let i = 0; i < 4; i++) puff(1, e.x + R(-4, 4), z + R(8, 16), e.y + R(-4, 4), R(-8, 8), R(8, 18), R(-8, 8), R(0.8, 1.3), 3, 9);
      smoulderUntil = now + 0.9;
    },
    /** Her poise broken: a burst of sparks and smoke, her flames guttering. */
    stagger(e) {
      gutter = 1;
      blast(e.x, e.y, 8, 10, { up: 50, out: 60, smoke: 1.2, sparkN: 20 });
    },
    /** Her next phase: fire bursts out of her in a ring and her flames flare. */
    phase(b) {
      flare = Math.max(flare, 1.8);
      sparks.ring(b.x, b.y, { r: 90, life: 0.7, col: 0xff8a3a, a: 0.9 });
      sparks.ring(b.x, b.y, { r: 50, life: 0.45, col: 0xffd070, a: 0.8 });
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU;
        const x = b.x + Math.cos(a) * 12, y = b.y + Math.sin(a) * 12;
        puff(0, x, gy(x, y, R(2, 10)), y, Math.cos(a) * R(90, 150), R(10, 40), Math.sin(a) * R(90, 150), R(0.45, 0.7), 5, 11, { buoy: 30, drag: 0.93 });
      }
      sparks.burst(b.x, b.y, 18, 24, { speed: 120, up: 60, life: 0.9, size: 1.9, palette: EMBER });
    },
    /** The killing blow: a last burst of embers and a cloud of smoke as her fire goes out. */
    death(b, now) {
      deathAt = now;
      sparks.flash(b.x, b.y, 18, { size: 46, life: 0.35, col: 0xffe2b0, a: 2 });
      blast(b.x, b.y, 10, 26, { up: 80, out: 70, smoke: 1.2, sparkN: 34 });
    },
    /** One of her embers spawning (the "spawn" event): it rises out of a burst of flame. */
    spawn(e) {
      blast(e.x, e.y, 6, 12, { up: 60, out: 30, smoke: 0.4, sparkN: 10 });
      sparks.ring(e.x, e.y, { r: 16, life: 0.4, col: 0xff9a40, a: 0.7 });
    },
    /** One of her embers killed (the "pop" event): it bursts; its blast is the "boom" mark that follows. */
    pop(e) {
      sparks.flash(e.x, e.y, 12, { size: 16, life: 0.14, col: 0xfff0c0, a: 1.5 });
      sparks.burst(e.x, e.y, 12, 14, { speed: 90, up: 40, life: 0.5, size: 1.6, palette: EMBER });
    },
    /** Her fireball bursting on the hero (the "burst" event, art "ember"). */
    burst(e) {
      blast(e.x, e.y, 6, 18, { up: 70, out: 70, smoke: 0.5, sparkN: 14, crown: 4 });
      sparks.flash(e.x, e.y, 10, { size: 26, life: 0.18, col: 0xffe2a0, a: 1.7 });
      sparks.ring(e.x, e.y, { r: 20, life: 0.35, col: 0xffa040, a: 0.8 });
      for (const [s] of shotSeen) if (s.dead) shotSeen.get(s).done = true;
      sfx.fireImpact?.();
    },
    veil: veilFx,

    /**
     * Every frame, after she is posed. `w` the world (in between), `now` real time; `ctx`: { camera, at(h) a hazard's in-between
     * place, bone(name, out) her bones, at the place she is drawn (`bx`, `by`), her facing, the picker's clip key, the hero's
     * in-between place, `intro` 0..1 through the name card (or null), `dissolve` the view's own fade of her body }.
     */
    update(w, now, ctx) {
      const dt = lastNow == null ? 0 : Math.max(0, Math.min(0.1, now - lastNow));
      lastNow = now;
      nC = 0;
      // the camera's axes (cards and puffs stand square to it: the Ash Floor's image camera is a perspective one)
      const e = ctx.camera.matrixWorld.elements;
      right.set(e[0], e[1], e[2]).normalize();
      up.set(e[4], e[5], e[6]).normalize();
      back.set(e[8], e[9], e[10]).normalize();
      for (const m of [cards, cardsGlow]) m.material.uniforms.uTime.value = now;
      const b = w.boss;
      const cin = !!ctx.cinder; // (her fight: everything; another fight only draws the hero's own Firebolt)
      const alive = cin && b && !b.hidden && b.hp > 0 && w.state !== "won" && w.state !== "chest" && w.state !== "looted";
      const bx = ctx.bx ?? b?.x ?? 0, by = ctx.by ?? b?.y ?? 0;
      // her bones (her hands, chest and head, where the fire hangs), or a guess round her place
      const okHands = ctx.bone?.("hand_L", hand[0]) && ctx.bone("hand_R", hand[1]);
      if (!okHands) for (let k = 0; k < 2; k++) hand[k].set(bx + (k ? 6 : -6), gy(bx, by, 16), by);
      if (!ctx.bone?.("chest", chest)) chest.set(bx, gy(bx, by, 22), by);
      if (!ctx.bone?.("head", head)) head.set(bx, gy(bx, by, 30), by);
      // (the flames sit in her palms, a little past the wrist bone toward the fingers)
      for (let k = 0; k < 2; k++) {
        if (ctx.bone?.(k ? "middle_01_R" : "middle_01_L", v1)) hand[k].lerp(v1, 0.6);
      }
      const clip = ctx.clip || "idle";
      const move = b?.move ? b.lastMove : null;
      const mt = b?.moveT || 0;
      const phase = b?.phase || 0;
      const rage = w.enraged ? 1.5 : phase >= 2 ? 1.45 : phase >= 1 ? 1.2 : 1;
      if (b?.move && lastMove !== b.move) {
        // (a move begins: the wind-up's sound, a charge gathering in her hands — her spells, not the veil)
        lastMove = b.move;
        if (b.move.clip === "cast" || b.move.clip === "nova") sfx.cinderCast?.();
        sweepOn = false;
      }
      if (!b?.move) lastMove = null;
      flare = Math.max(0, flare - dt * 2.2);
      gutter = Math.max(0, gutter - dt * 0.55);

      // ---- her arrival: out of a column of fire as the name card comes (view only — the fight starts as before) ----
      if (ctx.intro != null && alive) {
        const k = ctx.intro;
        if (!introSeen) (introSeen = true), sfx.cinderRise?.();
        const rise = Math.max(0, 1 - Math.abs(k - 0.25) / 0.25);
        if (k < 0.62) {
          // (a ring of flame round her spot, its tongues swirling up — taller as she forms inside it)
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + now * 2.4;
            const r = 10 - 4 * k;
            groundCard(bx + Math.cos(a) * r, by + Math.sin(a) * r, 9, 16 + 22 * rise, i * 0.13, Math.min(1, k * 8) * (1 - Math.max(0, (k - 0.45) / 0.17)), 1.15);
          }
          if (rand() < dt * 60) {
            const a = rand() * TAU;
            puff(0, bx + Math.cos(a) * 9, gy(bx, by, 2), by + Math.sin(a) * 9, -Math.sin(a) * 30, R(50, 90), Math.cos(a) * 30, 0.6, 4, 9);
          }
        }
        if (k > 0.42 && !introBurst) {
          introBurst = true;
          blast(bx, by, 10, 30, { up: 80, out: 90, smoke: 0.5, sparkN: 26 });
          sparks.ring(bx, by, { r: 46, life: 0.5, col: 0xffa040, a: 0.9 });
          flare = 1.5;
        }
      }
      if (ctx.intro == null) introSeen = introBurst = false;

      // ---- the flame in each hand ----
      let want = alive ? 1 : 0;
      // (her opening — sim/world.js stepOpening: in the "bell" state she waits in her bubble, then charges; not the ash veil)
      const opening = cin && (w.state === "bell" || w.state === "entrance") && b && !b.hidden;
      // (immune sealed in her bubble too, but fighting on from inside it: not the ash veil — sim/world.js seal)
      const veiled = !opening && !b?.sealed && (!!b?.immune || clip === "veil" || clip === "veiled");
      if (veiled) want = 0.22; // (wrapped in ash: her fire down to embers)
      if (opening && w.state === "bell") want = 0.3; // (asleep in her bubble: her fire low)
      if (b?.stagger > 0) want *= 0.5;
      if (cin && w.state === "won" && deathAt >= 0) want = Math.max(0, 1 - (now - deathAt) / 0.55) * 0.8;
      // the wind-up: the flames swell as the spell gathers (her cast and nova clips, by the move's own clock)
      let charge = 0;
      if (alive && b.move && (b.move.clip === "cast" || b.move.clip === "nova")) {
        const beat = move === "lanes" ? 1.15 : move === "nova" ? 1.25 : move === "storm" ? 1.2 : move === "chase" ? 0.6 : move === "sweep" ? 0.8 : move === "rain" ? 1.2 : 1;
        charge = Math.min(1, mt / beat);
        if (move === "storm" && mt > 1.2 && mt < 3.8) charge = 1; // (the flamethrower: full while it pours out of her)
        if (mt > beat + 0.25 && !(move === "storm" && mt < 3.8)) charge = Math.max(0, 1 - (mt - beat - 0.25) / 0.4);
      }
      for (let k = 0; k < 2; k++) {
        const target = want * (1 + 0.7 * charge + 0.6 * flare) * rage * (1 - 0.55 * gutter * (0.5 + 0.5 * Math.sin(now * 31 + k)));
        handA[k] += (target - handA[k]) * Math.min(1, dt * 10);
        const a = handA[k];
        if (a < 0.03) continue;
        const hv = hand[k];
        const hot = 1.05 + 0.35 * charge + 0.25 * flare + (phase >= 2 ? 0.2 : 0);
        // (her flame's size held to 1.4x its rest: swollen with a spell's charge and a flare and her rage together it stood as
        // tall as her head, a candle floating beside her)
        const sa = Math.min(1.4, a);
        card(hv.x, hv.y - 1.2, hv.z, 4 * sa, 7.5 * sa, 0.31 + k * 0.47, Math.min(1, 0.55 + 0.5 * a), 0, hot);
        card(hv.x, hv.y + 0.6 * sa, hv.z, 2.8 * sa, 2.8 * sa, 0, Math.min(1, 0.6 * a), 1, hot);
        // (a lick of fire off it now and then, more as it swells)
        if (rand() < dt * (3 + 14 * charge) * a) puff(0, hv.x, hv.y + 1, hv.z, R(-5, 5), R(15, 30), R(-5, 5), R(0.3, 0.5), 1.6 * a, 3.4 * a);
      }
      // the gathering: fire drawn in to her hands from round her through the wind-up, faster as it nears the beat
      if (alive && charge > 0 && charge < 1 && !(move === "storm" && mt > 1.2)) {
        gatherT -= dt;
        while (gatherT <= 0) {
          gatherT += 0.035 - 0.02 * charge;
          const hv = hand[rand() < 0.5 ? 0 : 1];
          const a = rand() * TAU, d = R(22, 40);
          const sx = bx + Math.cos(a) * d, sz = by + Math.sin(a) * d, sy = gy(sx, sz, R(2, 20));
          const T = R(0.35, 0.5);
          puff(0, sx, sy, sz, (hv.x - sx) / T, (hv.y - sy) / T, (hv.z - sz) / T, T, R(2.5, 3.5), 1.2, { buoy: 0, drag: 1, a: 0.85 });
        }
      }
      // her burning hem: embers lifting off it as she drifts, more when she moves or rages (the owner's pick: "a burning hem")
      if (alive && !veiled) {
        hemT -= dt * (1 + Math.min(2, Math.hypot(b.vx || 0, b.vy || 0) / 15)) * rage;
        while (hemT <= 0) {
          hemT += 0.11;
          const a = rand() * TAU;
          sparks.rise(bx + Math.cos(a) * 6.5, by + Math.sin(a) * 6.5, 1.5, 1, { h: 1.5, up: 18, life: 0.9, size: 1.2, palette: EMBER });
        }
      }
      // her rage: ash drifting round her from her second phase ("Ash gathers round her"), embers off the floor in her last
      // ("The floor remembers every fire")
      if (alive && phase >= 1 && !veiled) {
        ashT -= dt;
        while (ashT <= 0) {
          ashT += phase >= 2 ? 0.05 : 0.09;
          const a = rand() * TAU, d = R(10, 26);
          puff(2, bx + Math.cos(a) * d, gy(bx, by, R(2, 30)), by + Math.sin(a) * d, -Math.sin(a) * 18, R(2, 10), Math.cos(a) * 18, R(1.2, 2), 0.7, 0.6, { buoy: 4, swirl: 25, cx: bx, cz: by, drag: 0.99 });
          if (phase >= 2 && rand() < 0.3) riseEmbers(bx, by, 34, 1);
        }
      }
      // the ash veil: a vortex of smoke and ash round her while she cannot be hurt
      if (alive && veiled) {
        if (!veilWas) veilFx(true, { x: bx, y: by });
        ashT -= dt;
        while (ashT <= 0) {
          ashT += 0.03;
          const a = rand() * TAU, d = R(7, 13);
          const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d;
          if (rand() < 0.55) puff(3, x, gy(x, y, R(0, 26)), y, -Math.sin(a) * 40, R(4, 14), Math.cos(a) * 40, R(0.8, 1.3), R(4, 6), R(9, 14), { swirl: 90, cx: bx, cz: by, buoy: 6, drag: 0.97, a: 0.8 });
          else puff(2, x, gy(x, y, R(0, 30)), y, -Math.sin(a) * 50, R(4, 20), Math.cos(a) * 50, R(0.8, 1.4), 0.8, 0.6, { swirl: 110, cx: bx, cz: by, buoy: 6, drag: 0.98 });
        }
      } else if (veilWas && alive) veilFx(false, { x: bx, y: by });
      veilWas = alive && veiled;
      // staggered or dying: smoke rising off her
      if ((b?.stagger > 0 && alive) || (w.state === "won" && deathAt >= 0 && now - deathAt < 2.6)) {
        if (rand() < dt * (w.state === "won" ? 26 : 10)) {
          const x = chest.x + R(-4, 4), z = chest.z + R(-4, 4);
          puff(1, x, chest.y + R(-6, 4), z, R(-4, 4), R(10, 22), R(-4, 4), R(1.2, 2.0), R(4, 6), R(12, 20));
        }
        if (w.state === "won" && rand() < dt * 30) riseEmbers(bx, by, 9, 1, R(2, 20));
      }

      // ---- her waking's shockwave (the owner, 2026-10-21: "a small shockwave similar to how the hero is staggered in the bog"):
      // a low wall of ash rolling out over the floor at the sim's own speed (sim/world.js stepOpening staggers the hero as it
      // reaches him), thinning as it goes; only over the floor ----
      if (shock) {
        const r = (now - shock.t0) * shock.speed, fade = 1 - r / shock.range;
        if (fade <= 0) shock = null;
        else {
          const n = Math.round(dt * r * 1.6 * fade + rand());
          for (let i = 0; i < n; i++) {
            const a = rand() * TAU, x = shock.x + Math.cos(a) * r, z = shock.y + Math.sin(a) * r;
            if (!(w.arena?.out?.(x, z) < 4)) continue;
            puff(1, x, gy(x, z, R(0.5, 3)), z, Math.cos(a) * R(50, 90), R(6, 18), Math.sin(a) * R(50, 90), R(0.45, 0.75), R(3, 5), R(8, 13), { a: 0.6 * fade, drag: 0.9, buoy: 4 });
            if (rand() < 0.15 * fade) puff(2, x, gy(x, z, R(1, 4)), z, Math.cos(a) * R(40, 80), R(20, 50), Math.sin(a) * R(40, 80), R(0.6, 1.0), 0.9, 0.7, { drag: 0.95, buoy: -30 });
          }
        }
      }

      // ---- her bubble: waiting in it at the altar (her opening), or sealed in it in the fight (her seal: sim/world.js seal) ----
      const O = w.spec?.opening;
      const sealM = w.spec?.moves?.seal; // (not S: the smoke's buffers)
      // (waiting: till the sim pops it, 0.4 s after the strike — on the "bell" state alone it faded out before the bell's ring
      // reached it, and nothing was there to pop)
      const waiting = opening && !!w.bubble;
      const sealed = alive && !!b.sealed;
      // (her seal's telegraph: the film drawn up round her from the floor through the move's first `seal.at` s)
      const forming = alive && sealM && b.move === sealM && !b.sealed && mt < sealM.seal.at ? mt / sealM.seal.at : null;
      const wantBubble = waiting || sealed || forming != null ? 1 : 0;
      bubbleA += (wantBubble - bubbleA) * Math.min(1, dt * (forming != null ? 14 : 4));
      if (forming != null) formK = 1 - (1 - forming) * (1 - forming); // (quick up off the floor, slowing as it closes over her)
      else if (wantBubble) formK = 1; // (and a seal broken off as it formed fades as far up as it had come)
      if (popAt >= 0 && now - popAt < 0.05) bubbleA = 0;
      const shown = bubbleA > 0.01;
      for (const m of bubbleParts) m.visible = shown;
      seatRing.visible = shown;
      if (shown) {
        // the light breathing in it: one slow breath in 5.2 s, the film, the motes, the ring and the pool of light on the floor
        // all on it
        const breath = 0.5 + 0.5 * Math.sin((now * TAU) / 5.2);
        bubble.position.set(bx, gy(bx, by, BUBBLE_R * 0.62), by);
        // (it breathes a little, as a film does in a draught)
        const br = 1 + 0.012 * Math.sin(now * 1.7) + 0.008 * Math.sin(now * 2.9);
        bubble.scale.set(br, 2 - br, br);
        for (const m of [bubbleBack, bubbleGlow]) m.position.copy(bubble.position), m.scale.copy(bubble.scale);
        bubbleU.uTime.value = now;
        bubbleU.uA.value = bubbleA;
        bubbleU.uForm.value = formK;
        bubbleU.uBreath.value = breath;
        // a blow's ripple, from where it was struck (its direction from the film's middle, at the blade's height)
        const H = bubbleU.uHit.value;
        if (hit && now - hit.t < 2) {
          v1.set(hit.x - bx, 12 - BUBBLE_R * 0.62, hit.y - by).normalize();
          H.set(v1.x, v1.y, v1.z, now - hit.t);
        } else H.w = -1;
        // the ring of rune light round it on the floor, turning slowly (grown out from her as the film rises); its outer line at
        // 22, inside the altar's flat top round her seat (flat to 22, the stairs dropping from 24: at 28 it hung in the air
        // over the top step)
        const RU = seatRing.material.uniforms;
        RU.uC.value.set(bx, floorAt(bx, by) + 0.35, by);
        RU.uR.value = 24 * (0.4 + 0.6 * formK);
        RU.uTime.value = now;
        RU.uBreath.value = breath;
        RU.uA.value = bubbleA * 0.8;
        glowPool(bx, by, 26, bubbleA * (0.16 + 0.12 * breath));
        // the motes of light (MOTES), drawn as small glows: inside it kept inside its film
        for (const m of MOTES) {
          const a = m.a0 + now * m.w, r = m.r * (1 + 0.08 * Math.sin(now * 0.3 + m.ph));
          let h = m.h0 + m.hA * Math.sin(now * m.hw + m.ph);
          if (!m.out) {
            const half = Math.sqrt(Math.max(0, BUBBLE_R * BUBBLE_R - r * r)) * 0.85;
            h = Math.min(BUBBLE_R * 0.62 + half, Math.max(Math.max(1.5, BUBBLE_R * 0.62 - half), h));
            if (h > seamH(formK)) continue; // (not yet inside a film still rising)
          }
          const x = bx + Math.cos(a) * r, z = by + Math.sin(a) * r;
          const tw = 0.5 + 0.5 * Math.sin(now * m.tw + m.ph * 3);
          card(x, gy(x, z, h), z, m.s * (0.8 + 0.3 * tw), m.s * (0.8 + 0.3 * tw), 0, bubbleA * (0.35 + 0.55 * tw) * (m.out ? 0.75 : 1), 1, m.heat);
        }
        // ash motes adrift inside it, and an ember now and then rising slowly
        moteT -= dt;
        while (moteT <= 0) {
          moteT += 0.16;
          const a = rand() * TAU, d = R(3, BUBBLE_R * 0.7);
          puff(2, bx + Math.cos(a) * d, gy(bx, by, R(3, 20)), by + Math.sin(a) * d, R(-2, 2), R(-0.5, 2), R(-2, 2), R(2.2, 3.2), 0.7, 0.6, { buoy: 0.4, drag: 0.99, swirl: 5, cx: bx, cz: by });
          if (rand() < 0.2) sparks.rise(bx, by, BUBBLE_R * 0.55, 1, { h: R(4, 18), up: 3, life: 2.4, size: 1.1, palette: EMBER });
        }
        // forming: glints of film drawn in to its rising seam from round her
        if (forming != null && rand() < dt * 50) {
          const a = rand() * TAU, d = R(30, 46), T = R(0.25, 0.4);
          const sx = bx + Math.cos(a) * d, sz = by + Math.sin(a) * d, sy = gy(sx, sz, R(2, 10));
          const ey = gy(bx, by, seamH(formK));
          const ex = bx + Math.cos(a) * BUBBLE_R * 0.9, ez = by + Math.sin(a) * BUBBLE_R * 0.9;
          sparks.burst(sx, sz, sy - floorAt(sx, sz), 1, { speed: Math.hypot(ex - sx, ez - sz) / T, up: (ey - sy) / T, dir: Math.atan2(ez - sz, ex - sx), spread: 0.2, life: T, size: 1.3, grav: 0, drag: 1, palette: FILM });
        }
      }
      // the bell calling while she is sealed: its own ring of rune light at its foot, pulsing, and a pool of light
      bellA += ((sealed && w.bell ? 1 : 0) - bellA) * Math.min(1, dt * 3);
      bellRing.visible = bellA > 0.01 && !!w.bell;
      if (bellRing.visible) {
        const BU = bellRing.material.uniforms, pulse = 0.5 + 0.5 * Math.sin((now * TAU) / 1.2);
        BU.uC.value.set(w.bell.x, floorAt(w.bell.x, w.bell.y) + 0.35, w.bell.y);
        BU.uR.value = 17;
        BU.uTime.value = now;
        BU.uBreath.value = 1;
        BU.uPulse.value = 0.6 * pulse;
        BU.uA.value = bellA;
        glowPool(w.bell.x, w.bell.y, 20, bellA * (0.2 + 0.15 * pulse));
      }
      if (opening && w.state === "entrance" && O && b.popped) {
        // (seconds from the strike, as the opening's beats)
        const t = ctx.stateT ?? 0;
        const k = Math.min(1, Math.max(0, (t - O.spin[0]) / (O.spin[1] - O.spin[0]))); // the charge, 0 to 1 by the spin's end, held burning through her name card to the thrust
        if (t < O.fire + 0.1) {
          // a vortex of fire round her, tighter, faster and taller as the charge grows; sparks pulled in to her
          // (thin enough to see her turning inside it: at 180 a second and 11 across it was one orange cloud with her lost in it)
          const n = Math.round(dt * (14 + 90 * k) + rand());
          for (let i = 0; i < n; i++) {
            const a = rand() * TAU, d = R(14, 28) - 4 * k;
            const x = bx + Math.cos(a) * d, z = by + Math.sin(a) * d;
            puff(0, x, gy(x, z, R(0, 8 + 22 * k)), z, -Math.sin(a) * (40 + 90 * k) - Math.cos(a) * 20, R(15, 40 + 50 * k), Math.cos(a) * (40 + 90 * k) - Math.sin(a) * 20, R(0.3, 0.5), 2.5 + 1.5 * k, 5 + 3 * k, { swirl: 120 + 280 * k, cx: bx, cz: by, buoy: 25 });
          }
          if (rand() < dt * (8 + 40 * k)) {
            const a = rand() * TAU, d = R(40, 70);
            const sx = bx + Math.cos(a) * d, sz = by + Math.sin(a) * d, sy = gy(sx, sz, R(2, 12));
            const T = R(0.3, 0.45);
            puff(0, sx, sy, sz, (chest.x - sx) / T, (chest.y - sy) / T, (chest.z - sz) / T, T, 2.2, 1.0, { buoy: 0, drag: 1 });
          }
          // the light swelling on the floor under her, and a white-hot heart at her chest as her fists come to it
          glowPool(bx, by, 20 + 40 * k, 0.25 + 0.75 * k);
          if (k > 0.75) card(chest.x, chest.y, chest.z, 4 + 32 * (k - 0.75), 4 + 32 * (k - 0.75), 0, 1, 1, 1.6);
          flare = Math.max(flare, 0.4 * k);
          if (k > 0 && k < 1) sparks.orbit("charge", bx, by, 14 + 10 * k, 16 - 6 * k, now + 0.05);
        }
      }

      // (and coming down from the altar after it, gliding in fire as her sweep does)
      if (opening && w.state === "entrance" && O?.descend && b.fired && (ctx.stateT ?? 0) >= O.descend[0] && (ctx.stateT ?? 0) < O.descend[1]) {
        if (!trail.length || Math.hypot(trail[trail.length - 1].x - bx, trail[trail.length - 1].y - by) > 9) trail.push({ x: bx, y: by, t: 0, life: R(0.35, 0.55), w: R(7, 10), h: R(10, 16), ph: rand() });
        if (rand() < dt * 40) puff(0, bx + R(-4, 4), gy(bx, by, R(2, 10)), by + R(-4, 4), R(-10, 10), R(15, 35), R(-10, 10), R(0.3, 0.45), 3, 7);
      }

      // ---- the moves ----
      if (alive && move === "sweep" && mt > 0.78 && mt < 1.7) {
        // the sweep: she crosses the floor in a rush of fire — flames left standing where she passed, sparks thrown back
        if (!sweepOn) (sweepOn = true), sfx.fireSweep?.(), release(0.8);
        if (!trail.length || Math.hypot(trail[trail.length - 1].x - bx, trail[trail.length - 1].y - by) > 7) trail.push({ x: bx, y: by, t: 0, life: R(0.45, 0.7), w: R(9, 13), h: R(16, 24), ph: rand() });
        for (let i = 0; i < 3; i++) puff(0, bx + R(-5, 5), gy(bx, by, R(2, 12)), by + R(-5, 5), R(-15, 15), R(20, 50), R(-15, 15), R(0.3, 0.5), 4, 9);
        if (rand() < dt * 30) sparks.burst(bx, by, 6, 2, { speed: 40, up: 30, life: 0.6, size: 1.5, palette: EMBER });
      }
      for (let i = trail.length - 1; i >= 0; i--) {
        const f = trail[i];
        f.t += dt;
        if (f.t >= f.life) {
          trail.splice(i, 1);
          continue;
        }
        const k = f.t / f.life;
        const g = f.grow ? Math.min(1, f.t / f.grow) : 1;
        groundCard(f.x, f.y, f.w * (1 - 0.3 * k), f.h * g * (1 - k * 0.8), f.ph, Math.min(1, (1 - k) * 1.4), f.heat || 1.1);
      }
      // the rain's bolts thrown up out of her hands
      for (let i = bolts.length - 1; i >= 0; i--) {
        const q = bolts[i];
        q.t += dt;
        if (q.t >= q.life) {
          bolts.splice(i, 1);
          continue;
        }
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z += q.vz * dt;
        card(q.x, q.y, q.z, 4.5, 4.5, 0, 1 - q.t / q.life, 1, 1.3);
        puff(0, q.x, q.y, q.z, R(-6, 6), R(-40, -10), R(-6, 6), 0.25, 3.5, 2, { buoy: 0, a: 0.8 });
      }

      for (const h of cin ? w.hazards : []) {
        if (h.friendly) continue;
        const ph = phaseOf(h);
        const p = ctx.at ? ctx.at(h) : h;
        let rec = seen.get(h);
        if (!rec) seen.set(h, (rec = { spots: null }));
        if (h.tag === "lane" || h.tag === "wall") {
          const tall = h.tag === "wall" ? 1.45 : 1; // (her opening's wall of fire stands higher than a lane's)
          // its wind-up: sparks lifting off the scorching line, more as it nears; then the wall of fire, up 0.06 s before it
          // can hurt (on real time from there: a freeze holds the sim, not the fire) and standing through its live window
          const left = h.tele - h.t;
          const ux = Math.cos(p.a), uy = Math.sin(p.a);
          if (ph === "tele") {
            const k = h.t / h.tele;
            if (rand() < dt * 30 * k * k * tall) {
              const s = rand() * h.len, x = p.x + ux * s, y = p.y + uy * s;
              if (onFloor(w, x, y)) sparks.rise(x, y, h.w * 0.35, 1, { h: 0.5, up: 22, life: 0.7, size: 1.3, palette: EMBER });
            }
            // (the wall's heat: faint smoke shimmering up off its line as its warning runs out)
            if (h.tag === "wall" && rand() < dt * 14 * k) {
              const s = rand() * h.len, x = p.x + ux * s, y = p.y + uy * s;
              if (onFloor(w, x, y)) puff(1, x, gy(x, y, R(2, 8)), y, 0, R(10, 18), 0, R(0.8, 1.2), 4, 12, { a: 0.35 });
            }
          }
          if (ph !== "tele" || left < 0.06) {
            if (rec.lit == null) {
              // (its flames' spots, once: jittered along it and across it in two staggered rows, each its own size and the
              // moment it catches — a row of equal flames read as a saw's teeth)
              rec.lit = now;
              rec.spots = [];
              // (sheets of flame laid edge to edge along it, two rows, a taller single flame now and then: a row of single flames
              // stood as a fence of candle tips, 2026-10-20)
              for (let s = R(0, 4); s < h.len; s += R(8, 11)) {
                const o = (rand() - 0.5) * h.w * 0.4;
                rec.spots.push([s, o, R(14, 18) * (tall > 1 ? 1.15 : 1), R(18, 34) * tall, rand(), tall > 1 ? s / 6000 : R(0, 0.07), 2]);
                if (rand() < 0.3) rec.spots.push([s + R(-3, 3), (rand() - 0.5) * h.w * 0.5, R(12, 18), R(30, 46) * tall, rand(), tall > 1 ? s / 6000 : R(0, 0.07), 0]);
              }
            }
            const age = now - rec.lit;
            const fadeK = ph === "fade" ? 1 - (h.t - h.tele - h.active) / h.fade : 1;
            for (const [s, o, ww, hh, sd, delay, kind] of rec.spots) {
              const x = p.x + ux * s - uy * o, y = p.y + uy * s + ux * o;
              if (!onFloor(w, x, y)) continue;
              const grow = Math.min(1, Math.max(0, age - delay) / 0.08);
              // (dying down as it fades — lower, not paler: faded by strength alone the wall went a milky haze)
              const hgt = hh * grow * (0.2 + 0.8 * fadeK) * (0.85 + 0.15 * Math.sin(now * 8 + sd * 20));
              card(x, floorAt(x, y), y, ww * (0.7 + 0.3 * grow), hgt, sd, Math.sqrt(fadeK) * grow, kind, ph === "active" ? 1.15 : 1.0);
            }
            // (fire rolling up off it while it is live, and smoke after)
            if (ph === "active" && rand() < dt * 40) {
              const s = rand() * h.len, o = (rand() - 0.5) * h.w * 0.6;
              const x = p.x + ux * s - uy * o, y = p.y + uy * s + ux * o;
              if (onFloor(w, x, y)) puff(0, x, gy(x, y, R(4, 14)), y, R(-8, 8), R(40, 80), R(-8, 8), R(0.35, 0.6), R(5, 7), R(10, 15));
            }
            if (ph === "fade" && rand() < dt * 18) {
              const s = rand() * h.len, x = p.x + ux * s, y = p.y + uy * s;
              if (onFloor(w, x, y)) puff(1, x, gy(x, y, R(6, 14)), y, 0, R(10, 20), 0, R(1.0, 1.6), 6, 16);
            }
          }
        } else if (h.tag === "rain" && ph === "tele") {
          // the fireball falling on its mark: in sight for its last 0.5 s, landing on the tick it can hurt
          const left = h.tele - h.t;
          const FALL = 0.5;
          if (left < FALL) {
            const u = left / FALL;
            const hh = 190 * u * u;
            const x = p.x + 22 * u, z = p.y - 14 * u, y = gy(p.x, p.y, 6 + hh);
            // (a ball of fire with a short tail: a long trail of big puffs stood behind it as a pillar)
            card(x, y, z, 7, 7, 0, 1, 1, 1.4);
            card(x, y - 4, z, 10, 15, h.id * 0.37, 0.9, 0, 1.25);
            puff(0, x + R(-1.5, 1.5), y + R(0, 3), z + R(-1.5, 1.5), R(-6, 6), R(10, 30), R(-6, 6), R(0.12, 0.22), R(3.5, 5), R(5, 7), { buoy: 10 });
            if (rand() < 0.25) puff(1, x, y + 6, z, R(-4, 4), 10, R(-4, 4), R(0.5, 0.8), 4, 9);
          }
        } else if (h.tag === "nova" && ph !== "tele") {
          // the ring of fire running out with the mark's own edge (radiusOf: the sim's)
          const r = radiusOf(h);
          const fadeK = ph === "fade" ? 1 - (h.t - h.tele - h.active) / h.fade : 1;
          const hgt = (34 - 14 * Math.min(1, (r - h.r) / 126)) * (0.6 + 0.4 * fadeK);
          if (!rec.ring) {
            // (its flames' spots, once: 80 round it, jittered in angle, depth and size — equal flames read as a crown's teeth;
            // as it widens every one is drawn, close in every second one)
            rec.ring = [];
            for (let i = 0; i < 80; i++) rec.ring.push([((i + R(-0.35, 0.35)) / 80) * TAU, R(-5, 2), R(0.75, 1.3), R(0.65, 1.3), rand()]);
          }
          const step = Math.max(1, Math.round(8 / ((TAU * r) / 80)));
          for (let i = 0; i < 80; i += step) {
            const [a, dr, ws, hs, sd] = rec.ring[i];
            const x = p.x + Math.cos(a) * (r - 4 + dr), y = p.y + Math.sin(a) * (r - 4 + dr);
            if (!onFloor(w, x, y)) continue;
            card(x, floorAt(x, y), y, 15 * ws, hgt * hs * (0.85 + 0.15 * Math.sin(now * 9 + sd * 20)), sd, fadeK, sd < 0.25 ? 0 : 2, 1.05); // (sheets, a single flame in four)
            if (rand() < dt * 6 * step) puff(0, x, gy(x, y, R(2, 10)), y, Math.cos(a) * 60, R(20, 45), Math.sin(a) * 60, R(0.3, 0.5), 4, 9);
          }
        } else if (h.tag === "nova" && ph === "tele") {
          // its wind-up: the ring of ground under it smoking and sparking, hotter as it nears
          const k = h.t / h.tele;
          if (rand() < dt * 26 * k) {
            const a = rand() * TAU, d = R(h.r0, h.r);
            sparks.rise(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2, 1, { h: 0.5, up: 24, life: 0.7, size: 1.3, palette: EMBER });
          }
        } else if (h.tag === "storm") {
          if (ph === "active") {
            // the firestorm: a torrent of fire pouring out of her along the cone as it turns, a root of flame at her feet
            rec.jet ??= { x: p.x, y: p.y, a: p.a, r0: h.r0 };
            Object.assign(rec.jet, { x: p.x, y: p.y, a: p.a });
            // (dense enough to merge into one torrent: at 170 a second, 9-13 across, it showed as separate blobs)
            const cnt = Math.round(dt * 260 + rand());
            for (let i = 0; i < cnt; i++) {
              const off = (rand() * 2 - 1) * h.half * 0.85;
              puff(0, p.x, gy(p.x, p.y, R(5, 12)), p.y, 0, R(-4, 10), 0, R(0.5, 0.7), R(4, 6), R(13, 17), { buoy: 14, jet: rec.jet, off, v: R(430, 520), a: 0.8 });
            }
            if (rand() < dt * 16) puff(1, p.x + Math.cos(p.a) * R(60, 200), gy(p.x, p.y, R(10, 24)), p.y + Math.sin(p.a) * R(60, 200), Math.cos(p.a) * 60, 20, Math.sin(p.a) * 60, R(1.0, 1.6), 8, 22);
            for (let j = 0; j < 3; j++) {
              const a = p.a + (j - 1) * h.half * 0.5;
              const x = p.x + Math.cos(a) * (h.r0 + 6), y = p.y + Math.sin(a) * (h.r0 + 6);
              groundCard(x, y, 14, 22 + 6 * Math.sin(now * 9 + j), j * 0.4, 1, 1.35);
            }
            if (rand() < dt * 20) {
              const d = R(40, h.r), a = p.a + (rand() * 2 - 1) * h.half;
              const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
              if (onFloor(w, x, y)) sparks.burst(x, y, 6, 3, { speed: 50, up: 40, life: 0.6, size: 1.5, palette: EMBER });
            }
          } else if (ph === "tele") {
            // its wind-up: fire circling her, drawn tighter and faster as it nears
            const k = h.t / h.tele;
            if (rand() < dt * 50 * k) {
              const a = rand() * TAU, d = 24 - 10 * k;
              const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
              puff(0, x, gy(x, y, R(2, 16)), y, -Math.sin(a) * 70, R(10, 30), Math.cos(a) * 70, R(0.3, 0.5), 3, 6, { swirl: 160, cx: p.x, cz: p.y, buoy: 20 });
            }
          }
        } else if (h.tag === "burn") {
          // burning ground: a few flames in it, smoke going up, a spark now and then; dying down as it fades
          if (!rec.spots) {
            rec.spots = [];
            // (low sheets of flame over the patch and a taller flame or two: four or seven single flames stood up in it like
            // candles)
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * TAU + rand(), d = h.r * (i === 0 ? 0.05 : R(0.3, 0.6));
              rec.spots.push([Math.cos(a) * d, Math.sin(a) * d, i < 3 ? h.r * R(0.55, 0.75) : R(8, 11), i < 3 ? R(9, 14) : R(14, 20), rand(), i < 3 ? 2 : 0]);
            }
          }
          if (ph !== "tele") {
            const live = h.t - h.tele;
            const k = ph === "fade" ? Math.max(0, 1 - (live - h.active) / h.fade) : Math.min(1, live / 0.12);
            for (const [ox, oy, ww, hh, sd, kind] of rec.spots) {
              const x = p.x + ox, y = p.y + oy;
              if (!onFloor(w, x, y)) continue;
              card(x, floorAt(x, y), y, ww * (0.6 + 0.4 * k), hh * (0.4 + 0.6 * k) * (0.7 + 0.3 * Math.sin(now * (2 + sd * 3) + sd * 9)), sd, k * (0.75 + 0.25 * sd), kind, 1.0);
            }
            if (rand() < dt * 2.2 * k) puff(1, p.x + R(-8, 8), gy(p.x, p.y, R(10, 16)), p.y + R(-8, 8), R(-3, 3), R(8, 16), R(-3, 3), R(1.4, 2.2), 6, 18);
            if (rand() < dt * 4 * k) riseEmbers(p.x, p.y, h.r * 0.7, 1);
          }
        } else if (h.tag === "boom" && ph === "tele") {
          // one of her embers about to burst: a ball of fire swelling and flickering where it stood
          const k = h.t / h.tele;
          const fl = 0.75 + 0.25 * Math.sin(now * 40);
          card(p.x, gy(p.x, p.y, 10), p.y, (6 + 9 * k) * fl, (6 + 9 * k) * fl, 0, 1, 1, 1.2 + 0.6 * k);
          groundCard(p.x, p.y, 10 + 6 * k, 14 + 10 * k, h.id * 0.3, 0.8, 1.2);
        }
      }
      for (const h of seen.keys()) if (!w.hazards.includes(h)) seen.delete(h);

      // ---- her fireballs (the chase) ----
      // (and the hero's own Firebolt — content/items.js, "Cinder's own trick, taken off her" — the same fire; it was the toad's
      // green goo ball too)
      for (const s of w.shots) {
        if (s.dead || s.art !== "ember") continue;
        const sx = s.x, sz = s.y, sy = gy(sx, sz, 9);
        let r = shotSeen.get(s);
        if (!r) {
          // (hers thrown: out of her hands, a flash and a burst of flame at them, its own whoosh)
          shotSeen.set(s, (r = { x: sx, y: sz, done: false }));
          if (s.tag === "chase" && ctx.cinder) release(0.9), sfx.fireBolt?.();
        }
        r.x = sx;
        r.y = sz;
        const dx = s.vx || 0, dz = s.vy || 0, sp = Math.hypot(dx, dz) || 1;
        card(sx, sy, sz, 6.5, 6.5, 0, 1, 1, 1.4);
        card(sx - (dx / sp) * 3, sy - 4, sz - (dz / sp) * 3, 10, 15, (s.spin || 0) * 0.1, 0.9, 0, 1.3);
        // (its trail: flame shed behind it, going to smoke)
        if (rand() < dt * 70) puff(0, sx - (dx / sp) * 4 + R(-2, 2), sy + R(-2, 2), sz - (dz / sp) * 4 + R(-2, 2), -dx * 0.15, R(5, 20), -dz * 0.15, R(0.3, 0.5), R(4, 5.5), R(6, 9), { buoy: 25 });
        if (rand() < dt * 10) puff(1, sx - (dx / sp) * 8, sy + 3, sz - (dz / sp) * 8, 0, 8, 0, R(0.6, 1.0), 4, 10);
        if (rand() < dt * 12) sparks.burst(sx, sz, 9, 1, { speed: 25, up: 15, life: 0.5, size: 1.3, palette: EMBER });
      }
      for (const [s, r] of shotSeen) {
        if (w.shots.includes(s) && !s.dead) continue;
        shotSeen.delete(s);
        // (out of time or off the floor without hitting him: it gutters out in a puff of smoke and sparks)
        if (!r.done) {
          for (let i = 0; i < 5; i++) puff(1, r.x, gy(r.x, r.y, 9), r.y, R(-10, 10), R(8, 20), R(-10, 10), R(0.8, 1.2), 4, 11);
          sparks.burst(r.x, r.y, 9, 8, { speed: 50, up: 25, life: 0.5, size: 1.4, palette: EMBER });
        }
      }

      // ---- her embers (the veil's adds): balls of fire hovering, beating faster as the veil's end comes ----
      const veilLeft = b?.move && move === "veil" ? Math.max(0, 5.6 - mt) : null;
      for (const a of w.adds) {
        if (a.type !== "ember" || !a.alive) continue;
        const rise = a.spawn > 0 ? 1 - a.spawn / 0.5 : 1;
        const beat = veilLeft != null ? 2 + 12 * Math.max(0, 1 - veilLeft / 5) : 3;
        const pulse = 0.5 + 0.5 * Math.sin(now * beat * TAU * 0.5 + a.x);
        const hh = (4 + 8 * rise) + Math.sin(now * 2.3 + a.x * 0.1) * 1.2;
        const y = gy(a.x, a.y, hh);
        const hit = a.flash > 0 ? 1 : 0;
        card(a.x, y, a.y, (6 + 2.5 * pulse) * rise, (6 + 2.5 * pulse) * rise, 0, 1, 1, 1.2 + 0.5 * pulse + hit);
        card(a.x, y - 4, a.y, 9 * rise, (13 + 4 * pulse) * rise, a.x * 0.01, 0.85, 0, 1.2 + hit);
        if (rand() < dt * 10) puff(0, a.x + R(-2, 2), y + 2, a.y + R(-2, 2), R(-4, 4), R(10, 22), R(-4, 4), R(0.3, 0.45), 2.5, 5);
        if (rand() < dt * 5) sparks.burst(a.x, a.y, hh, 1, { speed: 20, up: 20, life: 0.5, size: 1.2, palette: EMBER });
      }

      // ---- the hero smouldering after her fire caught him ----
      if (now < smoulderUntil && ctx.hero) {
        smoulderT -= dt;
        if (smoulderT <= 0) {
          smoulderT = 0.07;
          const hx = ctx.hero.x + R(-3, 3), hz = ctx.hero.y + R(-3, 3);
          puff(1, hx, gy(hx, hz, R(6, 16)), hz, R(-3, 3), R(10, 18), R(-3, 3), R(0.7, 1.1), 2.5, 7);
          if (rand() < 0.4) sparks.rise(hx, hz, 3, 1, { h: R(4, 14), up: 20, life: 0.6, size: 1.2, palette: EMBER });
        }
      }

      // ---- draw ----
      for (let i = scorchL.length - 1; i >= 0; i--) if ((scorchL[i].t += dt) >= scorchL[i].life) scorchL.splice(i, 1);
      scorchL.forEach((q, i) => {
        D.a.iPos.array.set([q.x, floorAt(q.x, q.y) + 0.4, q.y, q.r], i * 4);
        D.a.iData.array.set([q.t / q.life, q.seed, 0], i * 3);
      });
      pools.forEach(([x, y, r, a], i) => {
        const j = scorchL.length + i;
        D.a.iPos.array.set([x, floorAt(x, y) + 0.5, y, r], j * 4);
        D.a.iData.array.set([a, 0.37 * i, 1], j * 3);
      });
      D.g.instanceCount = scorchL.length + pools.length;
      pools.length = 0;
      D.a.iPos.needsUpdate = D.a.iData.needsUpdate = true;
      F.g.instanceCount = stepPuffs(fireL, F.a, dt);
      S.g.instanceCount = stepPuffs(smokeL, S.a, dt);
      F.a.iPos.needsUpdate = F.a.iData.needsUpdate = S.a.iPos.needsUpdate = S.a.iData.needsUpdate = true;
      C.g.instanceCount = nC;
      C.a.aBase.needsUpdate = C.a.aShape.needsUpdate = C.a.aKind.needsUpdate = true;
    },
    /** Her bubble popping (the "bubblePop" event, her opening): a glassy burst — shards of film flung out and falling, a ring and a flash. */
    bubblePop(e, now) {
      popAt = now;
      bubbleA = 0;
      sparks.flash(e.x, e.y, 14, { size: 40, life: 0.18, col: 0xe8f4ff, a: 1.6 });
      sparks.ring(e.x, e.y, { r: BUBBLE_R + 26, life: 0.45, col: 0xd8ecff, a: 0.9 });
      sparks.ring(e.x, e.y, { r: BUBBLE_R + 6, life: 0.3, col: 0xffe2c0, a: 0.7 });
      for (let i = 0; i < 46; i++) {
        // (from the film's surface: a point on the sphere, flung out along it)
        const a = rand() * TAU, el = Math.asin(R(-0.2, 1));
        const cx = Math.cos(a) * Math.cos(el), cz = Math.sin(a) * Math.cos(el), cy = Math.sin(el);
        sparks.burst(e.x + cx * BUBBLE_R, e.y + cz * BUBBLE_R, 11 + cy * BUBBLE_R, 1, { speed: R(50, 110), up: 20 + cy * 60, dir: a, spread: 0.3, life: R(0.5, 0.9), size: R(1.2, 2.0), grav: 120, palette: FILM });
      }
      for (let i = 0; i < 10; i++) {
        const a = rand() * TAU;
        puff(1, e.x + Math.cos(a) * BUBBLE_R, gy(e.x, e.y, R(4, 24)), e.y + Math.sin(a) * BUBBLE_R, Math.cos(a) * 30, R(5, 15), Math.sin(a) * 30, R(0.6, 1.0), 4, 10, { a: 0.5 });
      }
    },
    /** Her waking (the "wake" event, her opening's pop): a heavy thump — the floor's dust and ash thrown out round her, a ring,
     *  embers — and the shockwave it sends over the floor (drawn in update). */
    wake(e, now) {
      // (`small`: her seal's bubble popped in the fight by the bell's ring — a smaller one, 130 across the floor, not 380)
      const k = e.small ? 0.45 : 1;
      shock = { x: e.x, y: e.y, t0: now, speed: e.speed, range: e.small ? 130 : 380 };
      sparks.ring(e.x, e.y, { r: 70 * k, life: 0.5, col: 0xffc890, a: 0.9 });
      for (let i = 0, n = Math.round(40 * k); i < n; i++) {
        const a = (i / n) * TAU + rand() * 0.15;
        puff(1, e.x + Math.cos(a) * 10, gy(e.x, e.y, R(1, 4)), e.y + Math.sin(a) * 10, Math.cos(a) * R(110, 190) * k, R(10, 30), Math.sin(a) * R(110, 190) * k, R(0.7, 1.1), 5, 15, { drag: 0.88, buoy: 6, a: 0.8 });
      }
      sparks.burst(e.x, e.y, 3, Math.round(26 * k), { speed: 120 * k, up: 70, life: 0.8, size: 1.6, grav: 120, palette: EMBER });
    },
    /** Sealed (the "seal" event, her seal's film closing over her): a soft flash of film, a ring of light out over the floor,
     *  glints of film thrown off it. */
    seal(e) {
      sparks.flash(e.x, e.y, 12, { size: 34, life: 0.24, col: 0xeaf4ff, a: 1.2 });
      sparks.ring(e.x, e.y, { r: BUBBLE_R + 16, life: 0.55, col: 0xffe2b0, a: 0.75 });
      for (let i = 0; i < 18; i++) {
        const a = rand() * TAU, el = Math.asin(R(0, 1));
        const cx = Math.cos(a) * Math.cos(el), cz = Math.sin(a) * Math.cos(el), cy = Math.sin(el);
        sparks.burst(e.x + cx * BUBBLE_R, e.y + cz * BUBBLE_R, BUBBLE_R * 0.62 + cy * BUBBLE_R, 1, { speed: R(15, 35), up: 10 + cy * 20, dir: a, spread: 0.4, life: R(0.6, 1.0), size: R(1.1, 1.6), grav: 10, palette: FILM });
      }
    },
    /** A blow glancing off her bubble (the "ward" event — sim/world.js ward): the film ripples out from where it was struck (the
     *  shader, from `hit`), a cold glint and a few glints of film thrown back at the blade. */
    ward(e, now) {
      hit = { x: e.x, y: e.y, t: now };
      sparks.flash(e.x, e.y, 12, { size: 13, life: 0.12, col: 0xe8f4ff, a: 1.1 });
      sparks.burst(e.x, e.y, 12, 8, { speed: 45, up: 25, dir: (e.a ?? 0) + Math.PI, spread: 1.8, life: 0.45, size: 1.3, grav: 60, palette: FILM });
    },
    /** The shockwave reaching the hero (the "shockHit" event): dust kicked up round his feet as he is shoved back. */
    shockHit(e) {
      for (let i = 0; i < 14; i++) {
        const a = rand() * TAU;
        puff(1, e.x + Math.cos(a) * 4, gy(e.x, e.y, R(0.5, 3)), e.y + Math.sin(a) * 4, Math.cos(a) * R(30, 60), R(8, 25), Math.sin(a) * R(30, 60), R(0.5, 0.8), 3, 8, { drag: 0.9, buoy: 5, a: 0.7 });
      }
    },
    /** The chest landing on her ashes (the "chestLand" event): grey ash and her last embers thrown up round it. */
    ashes(x, y) {
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * TAU + rand() * 0.2;
        puff(1, x + Math.cos(a) * 9, gy(x, y, R(1, 6)), y + Math.sin(a) * 9, Math.cos(a) * R(60, 110), R(15, 45), Math.sin(a) * R(60, 110), R(0.9, 1.5), 6, 18, { drag: 0.9, buoy: 6 });
        puff(2, x + Math.cos(a) * 9, gy(x, y, R(2, 8)), y + Math.sin(a) * 9, Math.cos(a) * R(40, 120), R(30, 70), Math.sin(a) * R(40, 120), R(1.0, 1.8), 0.9, 0.7, { drag: 0.94, buoy: -20 });
      }
      sparks.burst(x, y, 4, 22, { speed: 90, up: 60, life: 0.9, size: 1.6, grav: 80, palette: EMBER });
    },
    /** For the checks (.scratch/cinder-polish/probe): her fire drawn this frame within r of sim (x, y) — flame cards and fire puffs. */
    fireNear(x, y, r) {
      let n = 0;
      for (let i = 0; i < nC; i++) if (Math.hypot(C.a.aBase.array[i * 3] - x, C.a.aBase.array[i * 3 + 2] - y) < r) n++;
      for (const q of fireL) if (Math.hypot(q.x - x, q.z - y) < r) n++;
      return n;
    },
    /** The hands' places this frame (world), for a telegraph's bolt. */
    hands: () => hand,
    /** Everything gone (a new fight on the same renderer). */
    clear() {
      fireL.length = smokeL.length = scorchL.length = bolts.length = trail.length = 0;
      shock = hit = null;
      bubbleA = bellA = 0;
      seen.clear();
      shotSeen.clear();
      deathAt = -1;
      flare = gutter = 0;
    },
    dispose() {
      for (const g of [C.g, F.g, S.g, D.g, bubbleGeo, ringGeo]) g.dispose();
      for (const m of [cards, cardsGlow, fireMesh, fireGlow, smokeMesh, scorchMesh, ...bubbleParts, seatRing, bellRing]) m.material.dispose();
    },
  };
}
