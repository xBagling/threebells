// The telegraph markings, the aim line and the shield ring, for the 3D view (docs/3D-PLAN.md 8.1).
//
// One flat disc over the floor, drawn into its own low-resolution layer with a shader that works
// out, for every texel, which markings cover it: the exact shapes of the sim (shapes3d.js is the
// same maths in JS, tested against hits()), and 2D's phases and colours (render.js drawHazard):
// a faint fill and an edge while it winds up, a fill creeping in from the middle (the time left, as
// a shape), a pale pulse on the edge in the last third, a flash of its own colour lightened when it
// goes off, then a fading fill. Unlit and composited after the grade (post3d.js), so a marking reads
// the same in sun and shade. Anything standing in front of it (the hero, the toad, a prop) covers
// it: the shader compares its depth with the scene's.
//
// Positions are the in-between ones from lerp3d, so a marking never steps at 60 Hz on a faster
// screen; the shapes, the phases and hits() are untouched.
import { Mesh, CircleGeometry, ShaderMaterial, Vector2, Vector4, Scene } from "./three-lib.js?v=df092a6";
import { KIND, phaseOf, teleK, radiusOf, shown } from "../sim/hazards.js?v=df092a6";
import { ARENA, PLAYER } from "../config.js?v=df092a6";
import { clamp } from "../util.js?v=df092a6";
import { KIND_ID } from "./shapes3d.js?v=df092a6";

const MAX_HAZARDS = 24;
const MAX_SAFE = 8;

const frag = /* glsl */ `
  #define MAXH ${MAX_HAZARDS}
  #define MAXS ${MAX_SAFE}
  #define R_ARENA ${ARENA.R.toFixed(1)}
  uniform vec4 uA[MAXH]; // x, y, a, r
  uniform vec4 uB[MAXH]; // r0, half, len, w
  uniform vec4 uC[MAXH]; // colour (sRGB 0..1), kind
  uniform vec4 uD[MAXH]; // phase (0 wind-up, 1 live, 2 fade), k, flash alpha, every
  uniform int uN;
  uniform vec4 uSafe[MAXS];
  uniform int uNSafe;
  uniform float uTime;
  uniform vec4 uAim;    // x, y, angle, length (0: none)
  uniform vec4 uShield; // x, y, alpha, on
  uniform float uZoom;
  uniform sampler2D tDepth;
  uniform vec2 uTex;
  varying vec2 vW;

  float wrapA(float a) { return mod(a + 3.14159265, 6.2831853) - 3.14159265; }
  float shapeDist(int kind, vec2 p, vec4 A, vec4 B, float owner) {
    vec2 d = p - A.xy;
    float dl = length(d);
    float r = A.w;
    if (kind == 0) return dl - r;
    if (kind == 1) return max(dl - r, B.x - dl);
    if (kind == 2) return abs(dl - r) - B.w * 0.5;
    if (kind == 3) {
      float radial = max(dl - r, B.x - dl);
      if (dl < 1.0) return radial;
      float off = abs(wrapA(atan(d.y, d.x) - A.z)) - B.y;
      return max(radial, off > 0.0 ? sin(min(off, 1.5707963)) * dl : off * dl);
    }
    if (kind == 4) {
      vec2 u = vec2(cos(A.z), sin(A.z));
      float along = dot(d, u) - B.z * 0.5;
      float across = -d.x * u.y + d.y * u.x;
      vec2 q = vec2(abs(along) - B.z * 0.5, abs(across) - B.w * 0.5);
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    }
    // flood: the floor minus its own safe shallows (uSafe[j].w is the flood they belong to)
    float s = length(p) - R_ARENA;
    for (int j = 0; j < MAXS; j++) {
      if (j >= uNSafe) break;
      if (abs(uSafe[j].w - owner) > 0.5) continue;
      s = max(s, uSafe[j].z - length(p - uSafe[j].xy));
    }
    return s;
  }
  vec4 acc;
  void over(vec3 c, float a) {
    a = clamp(a, 0.0, 1.0);
    acc.rgb = c * a + acc.rgb * (1.0 - a);
    acc.a = a + acc.a * (1.0 - a);
  }
  void main() {
    vec2 p = vW;
    if (length(p) > R_ARENA + 2.0) discard;
    // Covered by something standing in front of the floor here?
    float sceneZ = texture2D(tDepth, gl_FragCoord.xy / uTex).r;
    if (sceneZ < gl_FragCoord.z - 0.0005) discard; // about 1.5 units: flat ground cover still takes the paint
    acc = vec4(0.0);
    // One texel of floor, in world units, for strokes. Every stroke lies just inside its edge, never
    // across it: what is drawn stops exactly where what hurts stops.
    float px = max(fwidth(p.x), fwidth(p.y));

    // The aim line (drawn under the markings, as in 2D): dashed gold from 12 units out, a chevron.
    if (uAim.w > 0.0) {
      vec2 u = vec2(cos(uAim.z), sin(uAim.z));
      vec2 d = p - uAim.xy;
      float along = dot(d, u);
      float across = abs(-d.x * u.y + d.y * u.x);
      float lw = max(2.2 / uZoom, px) * 0.5;
      float dash = mod(along - 12.0, (5.0 + 4.0) / uZoom);
      if (along >= 12.0 && along <= uAim.w && across <= lw && dash < 5.0 / uZoom) over(vec3(1.0, 0.839, 0.42), 0.85);
      vec2 h = uAim.xy + u * uAim.w;
      for (int s = 0; s < 2; s++) {
        float sa = uAim.z + (s == 0 ? 2.576 : -2.576);
        vec2 v = vec2(cos(sa), sin(sa));
        vec2 e = p - h;
        float t = clamp(dot(e, v), 0.0, 7.0);
        if (length(e - v * t) <= lw) over(vec3(1.0, 0.839, 0.42), 0.85);
      }
    }
    for (int i = 0; i < MAXH; i++) {
      if (i >= uN) break;
      int kind = int(uC[i].w + 0.5);
      vec3 base = uC[i].rgb;
      float sd = shapeDist(kind, p, uA[i], uB[i], float(i));
      float ph = uD[i].x;
      float k = uD[i].y;
      bool inside = sd <= 0.0;
      if (ph < 0.5) {
        if (inside) {
          over(base, 0.13 + k * 0.08);
          // The fill creeping in from the middle, or along a lane.
          bool creep;
          if (kind == 4) {
            vec2 u = vec2(cos(uA[i].z), sin(uA[i].z));
            creep = dot(p - uA[i].xy, u) <= uB[i].z * k;
          } else {
            float rc = (kind == 2 ? uA[i].w + uB[i].w : kind == 5 ? R_ARENA : uA[i].w) * k;
            creep = length(p - uA[i].xy) <= rc;
          }
          if (creep) over(base, 0.34);
        }
        if (inside && sd >= -px * 1.2) over(base, 0.6 + k * 0.4);
        if (k > 0.66) {
          float pulse = (sin(uTime * 30.0) * 0.5 + 0.5) * (k - 0.66) * 3.0;
          if (inside && sd >= -px * 2.2) over(vec3(1.0, 0.925, 0.824), pulse * 0.9);
        }
      } else if (ph < 1.5) {
        if (inside) {
          if (uD[i].w > 0.5) over(base, 0.26 + sin(uTime * 9.0) * 0.06);
          else over(base + (1.0 - base) * 0.55, uD[i].z);
        }
        if (inside && sd >= -px * 1.7) over(base, 0.95);
      } else if (inside) {
        over(base, 0.26 * k);
      }
      if (kind == 5) {
        for (int j = 0; j < MAXS; j++) {
          if (j >= uNSafe) break;
          if (abs(uSafe[j].w - float(i)) > 0.5) continue;
          float ds = length(p - uSafe[j].xy) - uSafe[j].z;
          if (ds <= 0.0) over(vec3(0.561, 1.0, 0.816), 0.1);
          if (ds <= 0.0 && ds >= -px * 1.7) over(vec3(0.561, 1.0, 0.816), ph < 0.5 ? 0.6 + k * 0.4 : 0.95);
        }
      }
    }
    // The shield ring.
    if (uShield.w > 0.5 && abs(length(p - uShield.xy) - 13.0) <= max(1.6 / uZoom, px) * 0.6) over(vec3(0.624, 0.847, 1.0), uShield.z);
    if (acc.a <= 0.0) discard;
    gl_FragColor = acc; // premultiplied, sRGB values: the final pass composites it after the grade
  }
`;

const vert = /* glsl */ `
  varying vec2 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const rgb = (s) => s.split(",").map((v) => Number(v) / 255);
const HOT = rgb("255, 72, 68");
const COLD = rgb("255, 150, 60");
const FRIEND = rgb("120, 220, 255");

export function makeHazardLayer() {
  const scene = new Scene();
  const vec4s = (n) => Array.from({ length: n }, () => new Vector4());
  const uniforms = {
    uA: { value: vec4s(MAX_HAZARDS) },
    uB: { value: vec4s(MAX_HAZARDS) },
    uC: { value: vec4s(MAX_HAZARDS) },
    uD: { value: vec4s(MAX_HAZARDS) },
    uN: { value: 0 },
    uSafe: { value: vec4s(MAX_SAFE) },
    uNSafe: { value: 0 },
    uTime: { value: 0 },
    uAim: { value: new Vector4() },
    uShield: { value: new Vector4() },
    uZoom: { value: 1 },
    tDepth: { value: null },
    uTex: { value: new Vector2(1, 1) },
  };
  const mat = new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false, transparent: false, toneMapped: false });
  const geo = new CircleGeometry(ARENA.R + 3, 128);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, mat);
  mesh.position.y = 0.05;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    scene,
    /**
     * Fill the uniforms for this frame. `at(h)` gives a hazard's in-between { x, y, a };
     * `now` is real time (the pulses); `aim` is aimPreview(); `p` the (in-between) hero.
     */
    update(w, at, now, aim, p, zoom, depthTex, W, H) {
      let n = 0;
      let nSafe = 0;
      for (const h of w.hazards) {
        if (n >= MAX_HAZARDS) break;
        if (!shown(h)) continue;
        const ph = phaseOf(h);
        const r = radiusOf(h);
        const pos = at(h);
        const base = h.friendly ? FRIEND : h.style === "cold" ? COLD : HOT;
        let k = 0;
        let flashA = 0;
        if (ph === "tele") k = teleK(h);
        else if (ph === "active") {
          const live = (h.t - h.tele) / Math.max(0.001, h.active);
          k = live;
          const area = h.kind === KIND.LANE ? h.len * h.w : h.kind === KIND.FLOOD ? 40000 : Math.PI * r * r;
          const big = clamp(1 - (area - 3000) / 26000, 0.35, 1);
          flashA = (0.62 * (1 - live) + 0.14) * big;
        } else k = 1 - (h.t - h.tele - h.active) / Math.max(0.001, h.fade);
        uniforms.uA.value[n].set(pos.x, pos.y, pos.a, r);
        uniforms.uB.value[n].set(h.r0 || 0, h.half || 0, h.len || 0, h.w || 0);
        uniforms.uC.value[n].set(base[0], base[1], base[2], KIND_ID[h.kind] ?? 0);
        uniforms.uD.value[n].set(ph === "tele" ? 0 : ph === "active" ? 1 : 2, k, flashA, h.every ? 1 : 0);
        if (h.kind === KIND.FLOOD) for (const [sx, sy, sr] of h.safe || []) if (nSafe < MAX_SAFE) uniforms.uSafe.value[nSafe++].set(sx, sy, sr, n);
        n++;
      }
      uniforms.uN.value = n;
      uniforms.uNSafe.value = nSafe;
      uniforms.uTime.value = now;
      uniforms.uZoom.value = zoom;
      if (aim && !p.dead) uniforms.uAim.value.set(p.x, p.y, aim.angle, aim.slot == null ? (p.moveset?.[0] ?? PLAYER.combo[0]).range + 6 : 64);
      else uniforms.uAim.value.set(0, 0, 0, 0);
      uniforms.uShield.value.set(p.x, p.y, 0.55 + Math.sin(now * 7) * 0.15, p.shield > 0 ? 1 : 0);
      uniforms.tDepth.value = depthTex;
      uniforms.uTex.value.set(W, H);
      return n > 0 || !!aim || p.shield > 0;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
