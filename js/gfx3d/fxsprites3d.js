// Glowing sprites for the 3D view's effects, shared by the chest (chest3d.js) and the fight's sparks (sparks3d.js):
// camera-facing billboards and flat ground glows drawn by one shader with a mode each (a beam, a pool of light, a ring
// going out, a rainbow, rays, a flash), and instanced sparkles and coins stepped on the view's real clock. Everything
// bright is additive and on the glow layer (camera layer 1: the bloom).
import { Mesh, PlaneGeometry, InstancedBufferGeometry, InstancedBufferAttribute, ShaderMaterial, AdditiveBlending, DynamicDrawUsage, Color } from "./three-lib.js?v=df092a6";

// --- the billboards and flat glows: one shader, a mode each ----------------------------------------------------------
const bbVert = /* glsl */ `
  uniform vec2 uSize;
  uniform vec2 uAnchor;
  uniform float uRot;
  uniform float uFlat;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    if (uFlat > 0.5) {
      // lying on the ground, centred on the object's place
      vec3 p = vec3((uv.x - 0.5) * uSize.x, 0.0, (uv.y - 0.5) * uSize.y);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      return;
    }
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 q = (uv - uAnchor) * uSize;
    float c = cos(uRot), s = sin(uRot);
    mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    gl_Position = projectionMatrix * mv;
  }
`;
const bbFrag = /* glsl */ `
  uniform float uA;
  uniform float uT;
  uniform float uReveal;
  uniform vec3 uCol;
  varying vec2 vUv;
  vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
  void main() {
    float a = 0.0;
    vec3 col = uCol;
    #if MODE == 0
      // the beam: a bright core and a soft halo, fading up into the sky, shimmering
      float x = vUv.x * 2.0 - 1.0;
      float y = vUv.y;
      float core = exp(-x * x * 40.0);
      float halo = exp(-x * x * 5.0) * 0.4;
      float fade = smoothstep(0.0, 0.06, y) * pow(1.0 - y, 1.4);
      a = (core + halo) * fade * (0.85 + 0.15 * sin(uT * 6.0 - y * 18.0));
      col = mix(uCol, vec3(1.0, 0.98, 0.9), core);
    #elif MODE == 1
      // the pool of light on the ground
      float d = length(vUv * 2.0 - 1.0);
      a = pow(max(0.0, 1.0 - d), 2.2);
    #elif MODE == 2
      // a ring going out over the ground
      float d = length(vUv * 2.0 - 1.0);
      a = exp(-pow((d - 0.86) / 0.07, 2.0));
      col = mix(uCol, hue(atan(vUv.y - 0.5, vUv.x - 0.5) / 6.2832 + uT * 0.3), uReveal);
    #elif MODE == 3
      // a rainbow: bands red outside to violet inside, drawn out from left to right (uReveal), its feet faded
      vec2 p = vec2((vUv.x - 0.5) * 2.2, vUv.y * 1.1);
      float r = length(p);
      float ang = atan(p.y, p.x);
      float t = (r - 0.7) / 0.3;
      float band = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.93, t);
      float sweep = smoothstep(uReveal * 3.3 - 0.15, uReveal * 3.3, 3.1416 - ang);
      float feet = smoothstep(0.0, 0.22, p.y);
      col = hue((1.0 - clamp(t, 0.0, 1.0)) * 0.8);
      col = mix(col, vec3(1.0), 0.12);
      a = band * (1.0 - sweep) * feet * 0.9;
    #elif MODE == 4
      // light pouring out of the open chest: rays fanning upwards, turning slowly
      vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
      float r = length(p);
      float ang = atan(p.x, p.y);
      float rays = pow(0.5 + 0.5 * sin(ang * 11.0 + uT * 1.2), 6.0) + 0.7 * pow(0.5 + 0.5 * sin(ang * 6.0 - uT * 0.7 + 1.3), 8.0);
      float cone = smoothstep(1.25, 0.25, abs(ang));
      float fade = (1.0 - smoothstep(0.2, 1.0, r)) * smoothstep(0.0, 0.04, r);
      a = (rays * 0.85 + 0.25) * cone * fade;
      col = mix(uCol, vec3(1.0), 0.4 * rays);
    #elif MODE == 5
      // the flash: a hot core and a four-pointed star
      vec2 p = vUv * 2.0 - 1.0;
      float d = length(p);
      float arms = exp(-abs(p.x) * 30.0) * max(0.0, 1.0 - abs(p.y)) + exp(-abs(p.y) * 30.0) * max(0.0, 1.0 - abs(p.x));
      a = pow(max(0.0, 1.0 - d), 3.0) + arms * 0.9;
      col = mix(uCol, vec3(1.0), 0.6);
    #endif
    a *= uA;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;
export function billboard(mode, { size, anchor = [0.5, 0], col = 0xffd66b, flat = false, normal = false } = {}) {
  const mat = new ShaderMaterial({
    defines: { MODE: mode },
    uniforms: { uSize: { value: { x: size[0], y: size[1] } }, uAnchor: { value: { x: anchor[0], y: anchor[1] } }, uRot: { value: 0 }, uFlat: { value: flat ? 1 : 0 }, uA: { value: 0 }, uT: { value: 0 }, uReveal: { value: 0 }, uCol: { value: new Color(col) } },
    vertexShader: bbVert,
    fragmentShader: bbFrag,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  if (!normal) mat.blending = AdditiveBlending;
  const m = new Mesh(new PlaneGeometry(1, 1), mat);
  m.frustumCulled = false;
  m.layers.enable(1);
  m.renderOrder = normal ? 6 : 7;
  m.visible = false;
  return m;
}

// --- sparkles and coins: instanced quads facing the camera -----------------------------------------------------------
const spVert = /* glsl */ `
  attribute vec4 iPos; // x, height, z, size
  attribute vec4 iCol;
  attribute float iSpin;
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vSpin;
  void main() {
    vUv = uv * 2.0 - 1.0;
    vCol = iCol;
    vSpin = iSpin;
    vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
    mv.xy += position.xy * iPos.w;
    gl_Position = projectionMatrix * mv;
  }
`;
export const sparkFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vSpin;
  void main() {
    float c = cos(vSpin), s = sin(vSpin);
    vec2 p = vec2(c * vUv.x - s * vUv.y, s * vUv.x + c * vUv.y);
    float d = length(vUv);
    float arms = exp(-abs(p.x) * 9.0) * max(0.0, 1.0 - abs(p.y)) + exp(-abs(p.y) * 9.0) * max(0.0, 1.0 - abs(p.x));
    float a = (pow(max(0.0, 1.0 - d), 2.5) * 0.9 + arms * 0.8) * vCol.a;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(vCol.rgb, vec3(1.0), pow(max(0.0, 1.0 - d * 2.2), 2.0)), a);
  }
`;
export const coinFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vCol;
  varying float vSpin;
  void main() {
    float w = max(0.12, abs(cos(vSpin)));
    vec2 p = vec2(vUv.x / w, vUv.y);
    float d = length(p);
    if (d > 1.0 || vCol.a < 0.01) discard;
    // a gold face with a darker rim and a glint that runs across it as it turns
    vec3 gold = vec3(1.0, 0.78, 0.25);
    vec3 col = mix(gold, vec3(0.62, 0.38, 0.06), smoothstep(0.62, 0.95, d));
    col += vec3(1.0, 0.95, 0.7) * smoothstep(0.35, 0.0, abs(vUv.x + vUv.y * 0.6 - sin(vSpin) * 0.8)) * 0.8;
    gl_FragColor = vec4(col, vCol.a);
  }
`;
export function sprites(max, frag, additive) {
  const quad = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  geo.setAttribute("uv", quad.getAttribute("uv"));
  const pos = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const col = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const spin = new InstancedBufferAttribute(new Float32Array(max), 1);
  for (const a of [pos, col, spin]) a.setUsage(DynamicDrawUsage);
  geo.setAttribute("iPos", pos);
  geo.setAttribute("iCol", col);
  geo.setAttribute("iSpin", spin);
  geo.instanceCount = 0;
  const mat = new ShaderMaterial({ vertexShader: spVert, fragmentShader: frag, transparent: true, depthWrite: false, toneMapped: false });
  if (additive) mat.blending = AdditiveBlending;
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 9 : 8;
  if (additive) mesh.layers.enable(1);
  const list = []; // { x, y, z, vx, vy, vz, t, life, size, r, g, b, spin, spinV, grav, drag, tw, bounce }
  return {
    mesh,
    add(o) {
      if (list.length < max) list.push(o);
    },
    step(dt, now) {
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.t += dt;
        if (q.t >= q.life) {
          list[i] = list[list.length - 1];
          list.pop();
          continue;
        }
        const dr = Math.pow(q.drag, dt * 60);
        q.vx *= dr;
        q.vz *= dr;
        q.vy -= q.grav * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z += q.vz * dt;
        if (q.y < 0.3 && q.vy < 0) {
          // on the grass: a coin bounces and settles, a spark just goes out
          if (q.bounce) {
            q.y = 0.3;
            q.vy = -q.vy * q.bounce;
            q.vx *= 0.6;
            q.vz *= 0.6;
            q.spinV *= 0.6;
            if (Math.abs(q.vy) < 8) (q.vy = 0), (q.grav = 0), (q.spinV *= 0.2);
          } else q.y = 0.3;
        }
        q.spin += q.spinV * dt;
      }
      for (const q of list) {
        const k = q.t / q.life;
        const fade = k < 0.08 ? k / 0.08 : k > 0.7 ? (1 - k) / 0.3 : 1;
        const tw = q.tw ? 0.55 + 0.45 * Math.sin(now * q.tw + q.ph) : 1;
        pos.array.set([q.x, q.y, q.z, q.size * (q.grow ? 1 + k * q.grow : 1)], n * 4);
        col.array.set([q.r, q.g, q.b, fade * tw], n * 4);
        spin.array[n] = q.spin;
        n++;
      }
      geo.instanceCount = n;
      for (const a of [pos, col, spin]) a.needsUpdate = true;
    },
    clear() {
      list.length = 0;
      geo.instanceCount = 0;
    },
    dispose() {
      quad.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}

