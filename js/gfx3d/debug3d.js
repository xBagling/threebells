// The admin overlays in 3D (docs/3D-PLAN.md 8.11): the bodies and the live sword arc drawn as the
// sim tests them — line loops just above the floor for the hero (r 6), the boss (his radius, with a
// line up to his hit height), adds and shots; the swing's arc as a fan while it is live. Built
// fresh each frame only while the admin menu has hitboxes on.
import { LineSegments, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Mesh, PlaneGeometry, ShaderMaterial, CanvasTexture, SRGBColorSpace, LinearFilter } from "./three-lib.js?v=df092a6";
import { swingArc } from "../sim/player.js?v=df092a6";
import { H_TO_3D } from "./camera3d.js?v=df092a6";
import { LANTERN, R_SEEN } from "./layout3d.js?v=df092a6";
import { ARENA } from "../config.js?v=df092a6";

export function makeDebug3D(scene) {
  const geo = new BufferGeometry();
  const mat = new LineBasicMaterial({ color: 0x8fffd0, toneMapped: false, depthTest: false, transparent: true, opacity: 0.9 });
  const lines = new LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 50;
  lines.visible = false;
  scene.add(lines);
  const v = [];
  const ring = (x, y, r, h = 0.15, n = 40) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      v.push(x + Math.cos(a0) * r, h, y + Math.sin(a0) * r, x + Math.cos(a1) * r, h, y + Math.sin(a1) * r);
    }
  };
  return {
    update(w, on) {
      lines.visible = !!on;
      if (!on) return;
      v.length = 0;
      const p = w.player;
      ring(p.x, p.y, 6);
      const b = w.boss;
      if (b) {
        ring(b.x, b.y, b.r);
        if (b.hurt) {
          // the blade's target (sim/player.js bladeHits): the hurt ellipse, turned with him
          const [ha, hc] = b.hurt, c = Math.cos(b.face), s = Math.sin(b.face), n = 40;
          const pt = (i) => { const t = (i / n) * Math.PI * 2, u = Math.cos(t) * ha, q = Math.sin(t) * hc; return [b.x + u * c - q * s, b.y + u * s + q * c]; };
          for (let i = 0; i < n; i++) { const [x0, y0] = pt(i), [x1, y1] = pt(i + 1); v.push(x0, 0.3, y0, x1, 0.3, y1); }
        }
        v.push(b.x, 0.15, b.y, b.x, (b.hitH || 34) * H_TO_3D, b.y);
      }
      for (const a of w.adds) if (a.alive) ring(a.x, a.y, a.r || 7);
      for (const s of w.shots) if (!s.dead) ring(s.x, s.y, s.r || 6, 5);
      const arc = swingArc(p);
      if (arc) {
        // what the blade swept this tick
        const n = 4;
        for (let i = 0; i <= n; i++) {
          const a = arc.a0 + ((arc.a1 - arc.a0) * i) / n;
          v.push(arc.x, 0.2, arc.y, arc.x + Math.cos(a) * arc.r, 0.2, arc.y + Math.sin(a) * arc.r);
        }
      }
      geo.setAttribute("position", new Float32BufferAttribute(v, 3));
      geo.computeBoundingSphere();
    },
  };
}

/**
 * Bench-only overlays, never player-facing (docs/3D-PLAN.md 4.1, 11): `bogplane` lays the 2D
 * painting public/art/bog.webp on the ground on the exact mapping 2D uses (u = 0.5 + (x − y)·ppu/W,
 * v = 0.5 − (x + y)·0.5·ppu/H, ppu from bog.json), to prove the camera maths and check prop bases;
 * `layout` draws every prop's base from the layout (L), the floor's edge (R 118) and the ground
 * that must stay seen (r 116), just above the ground and through everything.
 */
export function makeBenchOverlays(scene, L, { bogplane = false, layout = false } = {}) {
  const made = [];
  if (bogplane) {
    const W = 2988;
    const H = 2080;
    const PPU = 6.5317;
    const mat = new ShaderMaterial({
      uniforms: { tMap: { value: null }, uK: { value: [PPU / W, (0.5 * PPU) / H] } },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap;
        uniform vec2 uK;
        varying vec3 vW;
        void main() {
          vec2 uv = vec2(0.5 + (vW.x - vW.z) * uK.x, 0.5 - (vW.x + vW.z) * uK.y);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          gl_FragColor = texture2D(tMap, vec2(uv.x, 1.0 - uv.y));
          #include <colorspace_fragment>
        }`,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const plane = new Mesh(new PlaneGeometry(700, 700), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.02;
    plane.renderOrder = -1;
    plane.visible = false;
    const img = new Image();
    img.onload = () => {
      const t = new CanvasTexture(img);
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearFilter;
      t.generateMipmaps = false;
      mat.uniforms.tMap.value = t;
      plane.visible = true;
    };
    img.src = "art/bog.webp";
    scene.add(plane);
    made.push(plane);
  }
  if (layout) {
    const v = [];
    const ring = (x, y, r, n = 32) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        v.push(x + Math.cos(a0) * r, 0.3, y + Math.sin(a0) * r, x + Math.cos(a1) * r, 0.3, y + Math.sin(a1) * r);
      }
    };
    const cross = (x, y, r) => v.push(x - r, 0.3, y, x + r, 0.3, y, x, 0.3, y - r, x, 0.3, y + r);
    for (const t of L.trees) (ring(t.x, t.y, t.flare), cross(t.x, t.y, t.flare * 0.6));
    for (const l of L.lanterns) (ring(l.x, l.y, LANTERN.plinth / 2, 4), cross(l.x, l.y, 2));
    for (const b of L.bushes) ring(b.x, b.y, b.radius);
    ring(L.topiary.x, L.topiary.y, L.topiary.radius);
    for (const l of L.lupines) ring(l.x, l.y, 2, 12);
    for (const c of L.clovers) ring(c.x, c.y, c.across / 2, 16);
    const props = new BufferGeometry();
    props.setAttribute("position", new Float32BufferAttribute(v, 3));
    const lines = new LineSegments(props, new LineBasicMaterial({ color: 0xff4fd8, toneMapped: false, depthTest: false, transparent: true, opacity: 0.95 }));
    v.length = 0;
    ring(0, 0, ARENA.R, 128);
    const edgeGeo = new BufferGeometry();
    edgeGeo.setAttribute("position", new Float32BufferAttribute(v.slice(), 3));
    const edge = new LineSegments(edgeGeo, new LineBasicMaterial({ color: 0x4fe8ff, toneMapped: false, depthTest: false, transparent: true, opacity: 0.9 }));
    v.length = 0;
    ring(0, 0, R_SEEN, 128);
    const seenGeo = new BufferGeometry();
    seenGeo.setAttribute("position", new Float32BufferAttribute(v.slice(), 3));
    const seen = new LineSegments(seenGeo, new LineBasicMaterial({ color: 0xfff27a, toneMapped: false, depthTest: false, transparent: true, opacity: 0.6 }));
    for (const o of [lines, edge, seen]) {
      o.frustumCulled = false;
      o.renderOrder = 49;
      scene.add(o);
      made.push(o);
    }
  }
  return {
    dispose() {
      for (const o of made) {
        scene.remove(o);
        o.geometry.dispose();
        o.material.uniforms?.tMap.value?.dispose();
        o.material.dispose();
      }
    },
  };
}
