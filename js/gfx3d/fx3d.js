// Particles and contact shadows for the 3D view (docs/3D-PLAN.md 8.7, 5.3).
//
// The particles are 2D's own pool (gfx/particles.js: the same bursts, the same stepping on real
// time); only the drawing is new: one instanced quad per live particle, facing the camera, at
// (x, z × √⅔, y) — 2D's particle heights are screen units. 2D's alpha rules: dust at k·0.75, the
// rest full until the last quarter. `ring` particles lie flat on the ground.
import { floorAt } from "./floorh3d.js?v=48fd128-df87a96f";
import { Mesh, InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial, DynamicDrawUsage, CircleGeometry, MeshBasicMaterial, Color } from "./three-lib.js?v=48fd128-df87a96f";
import { H_TO_3D } from "./camera3d.js?v=48fd128-df87a96f";
import { PAL } from "../gfx/particles.js?v=48fd128-df87a96f";

// The lit particles, the only ones drawn into the glow layer: steel sparks, fire, gold, brine and
// mint (gfx/particles.js PAL) — never blood, dust, ash or bog.
const GLOWS = new Set([...PAL.steel, ...PAL.fire, ...PAL.gold, ...PAL.brine, ...PAL.mint, "#9fd8ff", "#e2f6ee"]);

const vert = /* glsl */ `
  attribute vec4 iData; // x, height, y, size (view units)
  attribute vec4 iCol;
  attribute float iGlow; // 1 a light; +2 round (water: boglife3d.js)
  uniform float uGlowPass;
  varying vec4 vCol;
  varying vec2 vQ;
  varying float vRound;
  void main() {
    vCol = iCol;
    vQ = position.xy * 2.0;
    vRound = step(1.5, iGlow);
    if (uGlowPass > 0.5 && mod(iGlow, 2.0) < 0.5) vCol.a = 0.0; // not a light: nothing in the glow layer
    vec4 mv = viewMatrix * vec4(iData.xyz, 1.0);
    mv.xy += position.xy * iData.w;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  varying vec4 vCol;
  varying vec2 vQ;
  varying float vRound;
  void main() {
    if (vCol.a <= 0.003) discard;
    // (a drop of water is round, its edge soft, a glint at its top: the pixel squares read as confetti over the pools)
    if (vRound > 0.5) {
      float r = length(vQ);
      if (r > 1.0) discard;
      gl_FragColor = vec4(vCol.rgb * (1.0 + 0.5 * smoothstep(0.6, 0.0, length(vQ - vec2(-0.3, 0.35)))), vCol.a * smoothstep(1.0, 0.6, r));
      return;
    }
    gl_FragColor = vCol;
  }
`;

const cache = new Map();
function hexRGB(hex) {
  let c = cache.get(hex);
  if (!c) {
    const col = new Color(hex); // three converts the sRGB hex to linear, as the scene expects
    c = [col.r, col.g, col.b];
    cache.set(hex, c);
  }
  return c;
}

export function makeParticleMesh() {
  const max = 900;
  const quad = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  const data = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const col = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const glow = new InstancedBufferAttribute(new Float32Array(max), 1);
  data.setUsage(DynamicDrawUsage);
  col.setUsage(DynamicDrawUsage);
  glow.setUsage(DynamicDrawUsage);
  geo.setAttribute("iData", data);
  geo.setAttribute("iCol", col);
  geo.setAttribute("iGlow", glow);
  geo.instanceCount = 0;
  const mat = new ShaderMaterial({ uniforms: { uGlowPass: { value: 0 } }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;

  return {
    mesh,
    /** Set while the glow layer is drawn, so only the lit particles go into it. */
    glowPass(on) {
      mat.uniforms.uGlowPass.value = on ? 1 : 0;
    },
    /** Copy the live particles in. */
    update(parts) {
      let n = 0;
      const d = data.array;
      const c = col.array;
      for (const q of parts.list) {
        if (!q.live || n >= max) continue;
        const k = 1 - q.t / q.life;
        const water = q.kind === "water";
        const size = Math.max(water ? 0.4 : 1, q.size * (q.kind === "spark" ? k : 1)) / Math.SQRT2; // screen units → view units
        const [r, g, b] = hexRGB(q.col);
        const a = q.kind === "dust" ? k * 0.75 : k > 0.25 ? 1 : k * 4;
        d[n * 4] = q.x;
        d[n * 4 + 1] = q.z * H_TO_3D + floorAt(q.x, q.y); // (over the ground there: the Ash Floor's stairs and altar)
        d[n * 4 + 2] = q.y;
        d[n * 4 + 3] = size;
        c[n * 4] = r;
        c[n * 4 + 1] = g;
        c[n * 4 + 2] = b;
        c[n * 4 + 3] = a;
        glow.array[n] = (GLOWS.has(q.col) ? 1 : 0) + (water ? 2 : 0);
        n++;
      }
      geo.instanceCount = n;
      data.needsUpdate = true;
      col.needsUpdate = true;
      data.addUpdateRange(0, n * 4);
      col.addUpdateRange(0, n * 4);
      glow.needsUpdate = true;
      glow.addUpdateRange(0, n);
    },
    dispose() {
      quad.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}

/** A soft-edged dark blob on the floor under something: a contact shadow. */
export function makeBlob(radius, opacity) {
  const geo = new CircleGeometry(1, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new MeshBasicMaterial({ color: 0x0b140a, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const mesh = new Mesh(geo, mat);
  mesh.scale.set(radius, 1, radius);
  mesh.position.y = 0.08;
  mesh.renderOrder = 1;
  mesh.userData.baseOpacity = opacity;
  return mesh;
}
