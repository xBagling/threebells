import {
  Oh,
  Xe,
  Fn,
  hs,
  Ml
} from "./main-6mhe1mqq.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/quad3d.js
function unitQuad() {
  const g = new Ml;
  g.setAttribute("position", new Xe([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  g.instanceCount = 0;
  return g;
}
function planeQuad(uv = false) {
  const quad = new hs(1, 1);
  const geo = new Ml;
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  if (uv)
    geo.setAttribute("uv", quad.getAttribute("uv"));
  geo.instanceCount = 0;
  return { geo, quad };
}
function perInstance(g, n, attrs) {
  const out = {};
  for (const [name, size] of attrs) {
    const a = new Fn(new Float32Array(n * size), size);
    a.setUsage(Oh);
    g.setAttribute(name, a);
    out[name] = a;
  }
  return out;
}
var NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

export { unitQuad, planeQuad, perInstance, NOISE_GLSL };
