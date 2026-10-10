// The ground (docs/3D-PLAN.md 4.3, 4.8): the floor, the outer ground, the far hedge ring and the
// static contact blobs.
//
// - The floor is one 64×64-segment plane over ±210, lit by the paint material, receiving shadows.
//   For M4a its colours are worked out in the shader from the world position — the lawn's four mid
//   greens in hard-edged dabs with faint seams on the world grid, contact darkness at the wall's
//   foot, and beyond the wall the terrace's 10 × 8 slabs with grout and a ragged moss edge (V21,
//   V22, V35). M4b's painted tiles multiply their painting onto those colours, and its macro map
//   (tools/3d/floor.py, step 8) takes over the lawn's colours themselves (its dabs, every contact
//   band, the petals) and lays only the footprints' contact and two warm specks on the terrace,
//   whose slab tones, mottling and moss stay per pixel as in M4a. The engraved slab and the stepping
//   stones are decals from the atlas (layout3d.js FLOOR_DECALS), chosen per texel, never discarded.
// - From r 184 the floor fades into the outer ground's own colour and stops at 210; the outer ground
//   (a disc to r 1000, unlit, no shadows) runs from that colour to the clear colour #0b140a over
//   r 200–260, so even the widest pull-back never shows an edge (V37).
// - The far hedge ring: flat dark silhouettes facing the camera, their bumpy tops cut by geometry
//   rather than a texture. Unlit, one draw, no shadows.
// - Contact blobs: soft dark discs under L3, L5 and BB1–BB5, which stand past the reach of the
//   shadow map, and without the macro map (M4a) under the bed's trunks, plinths and the topiary
//   too, whose contact bands the macro map bakes. One draw.
import { PlaneGeometry, RingGeometry, MeshBasicMaterial, Color, Float32BufferAttribute, BufferGeometry, DoubleSide, Vector3, Vector4, CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor } from "./three-lib.js?v=df092a6";
import { paintMaterial, GROUND_SHADE_LIFT } from "./materials3d.js?v=df092a6";
import { WALL_DEPTH, FLOOR_DECALS } from "./layout3d.js?v=df092a6";
import { patchPaint, plain, lin, mix3, Geo } from "./props3d.js?v=df092a6";
import { cellTable } from "./paint3d.js?v=df092a6";

const OUTER_NEAR = 0x1c2a1a; // where the outer ground meets the floor: the terrace's average
const OUTER_FAR = 0x0b140a; // the clear colour

const FLOOR_PARS = /* glsl */ `
  uniform vec3 uGrassA;
  uniform vec3 uGrassB;
  uniform vec3 uGrassC;
  uniform vec3 uGrassD;
  uniform vec3 uSlabA;
  uniform vec3 uSlabB;
  uniform vec3 uSlabC;
  uniform vec3 uGrout;
  uniform vec3 uMossC;
  uniform vec3 uContact;
  uniform vec3 uOuterNear;
  uniform vec3 uOuterFar;
  float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  #ifdef FLOOR_GRASS_TILE
    uniform sampler2D uGrassTile;
    uniform vec3 uGrassMean;
    // The painted lawn as a ratio on the flat greens (design D-a). Screen-aligned by default: one
    // repeat is 48 world units across the screen, the painted blades stand upright as in the
    // target; GRASS_WORLD lays it on the world axes instead (the plan's, an owner pick at G3).
    vec3 grassRatio(vec2 p) {
      #ifdef GRASS_WORLD
        vec2 gu = p / 48.0;
      #else
        vec2 gu = vec2(p.x - p.y, 0.5 * (p.x + p.y)) * (0.70710678 / 48.0);
      #endif
      return texture2D(uGrassTile, gu).rgb / uGrassMean;
    }
  #endif
  #ifdef FLOOR_TERRACE_TILE
    uniform sampler2D uTerraceTile;
    uniform vec3 uTerrMean;
    // The painted terrace as a ratio: 40-unit tiles, each one of the tile's two 4 × 5-slab variants
    // (its slab lattice is floor(p / (10, 8)), grout included). textureGrad takes the derivatives
    // of the unwrapped position, so the jump at every tile edge never picks a tiny mip.
    vec3 terraceRatio(vec2 p) {
      vec2 tq = p / 40.0;
      float v = step(0.5, fHash(floor(tq) + 17.0));
      vec2 tu = vec2((fract(tq.x) + v) * 0.5, fract(tq.y));
      return textureGrad(uTerraceTile, tu, dFdx(tq) * vec2(0.5, 1.0), dFdy(tq) * vec2(0.5, 1.0)).rgb / uTerrMean;
    }
  #endif
  #ifdef FLOOR_MACRO
    uniform sampler2D uMacro;
    uniform vec3 uTerrBase;
  #endif
  #ifdef FLOOR_DECALS
    uniform sampler2D uDecalAtlas;
    uniform vec4 uDecalAt[FLOOR_DECALS];   // centre x, z; cos and sin of the yaw
    uniform vec4 uDecalHalf[FLOOR_DECALS]; // half size along the decal's u and v; z its contact rim, w its tone
    uniform vec4 uDecalBox[FLOOR_DECALS];  // its cell's box in the atlas (u, v, w, h; v down)
    uniform float uDecalGrad;
    // The painted decals (layout3d.js FLOOR_DECALS): the engraved slab and the stepping stones, as
    // albedo from their atlas cells. A texel's alpha picks the decal's colour or the floor's — a
    // choice of colour, never a discard: the fade and marking layers read this floor's depth
    // (critique #18). The texel gradient is capped at 8 atlas texels (mip level 3), so the widest
    // pull-back never reads past a cell's 8-texel pad.
    vec3 floorDecals(vec2 p, vec3 col) {
      for (int i = 0; i < FLOOR_DECALS; i++) {
        vec4 a = uDecalAt[i];
        vec2 q = p - a.xy;
        vec2 l = vec2(a.z * q.x + a.w * q.y, a.z * q.y - a.w * q.x) / uDecalHalf[i].xy;
        vec4 b = uDecalBox[i];
        vec2 gx = dFdx(l) * 0.5 * b.zw;
        vec2 gy = dFdy(l) * 0.5 * b.zw;
        gx *= min(1.0, uDecalGrad / max(length(gx), 1e-9));
        gy *= min(1.0, uDecalGrad / max(length(gy), 1e-9));
        vec4 t = textureGrad(uDecalAtlas, b.xy + clamp(l * 0.5 + 0.5, 0.0, 1.0) * b.zw, gx, gy);
        float on = step(max(abs(l.x), abs(l.y)), 1.0) * step(0.5, t.a);
        // A round decal's contact rim (uDecalHalf.z, 0 for none): the floor darkens just round
        // it, so a stepping stone sits in the terrace rather than on it.
        col = mix(col, uContact, uDecalHalf[i].z * (1.0 - smoothstep(0.9, 1.35, length(l))) * (1.0 - on));
        col = mix(col, t.rgb * uDecalHalf[i].w, on);
      }
      return col;
    }
  #endif
  // The wall's inner face: 128, easing over |θ| 140–155° to 136 on the back arc (layout3d.js wallR).
  float fWallR(float th) { return 128.0 + 8.0 * smoothstep(2.4435, 2.7053, abs(th)); }
  vec3 floorAlbedo(vec2 p) {
    float r = length(p);
    float th = atan(p.y, p.x) - 0.7853982;
    th = th > 3.1415927 ? th - 6.2831853 : (th < -3.1415927 ? th + 6.2831853 : th);
    float rw = fWallR(th);
    float n1 = texture2D(uNoise, p / 41.0).r;
    float n2 = texture2D(uNoise, p / 13.0 + vec2(0.31, 0.77)).r;
    float n3 = texture2D(uNoise, p / 4.7 + vec2(0.53, 0.11)).r;
    #ifdef FLOOR_MACRO
      // The painted macro map (tools/3d/floor.py) over ±160, clamped beyond (its edge is plain
      // terrace, #2e422e): on the lawn the albedo itself (the soft mid greens and worn patches,
      // every contact band, the petals); on the terrace a ratio over uTerrBase laid on M4a's own
      // terrace below (the footprints' contact and the warm specks; plain elsewhere, a ratio of 1).
      // Rows follow +z.
      vec3 macro = texture2D(uMacro, clamp(p / 320.0 + 0.5, 0.0, 1.0)).rgb;
      vec3 grass = macro;
      #ifdef FLOOR_GRASS_TILE
        grass *= grassRatio(p);
      #endif
    #else
      // The lawn: four mid greens in hard-edged dabs; light and shade come from the lighting (V22).
      float g = n1 * 0.62 + n2 * 0.28 + n3 * 0.1;
      #ifdef FLOOR_GRASS_TILE
        // Under the painted tile the dabs blend softly; the painting brings the hard edges.
        vec3 grass = mix(mix(uGrassA, uGrassB, smoothstep(0.40, 0.48, g)), mix(uGrassC, uGrassD, smoothstep(0.52, 0.60, g)), smoothstep(0.46, 0.54, g));
        grass *= grassRatio(p);
      #else
        vec3 grass = g < 0.44 ? uGrassA : (g < 0.5 ? uGrassB : (g < 0.56 ? uGrassC : uGrassD));
      #endif
    #endif
    // Faint seams on the world grid, like a buried grid (±23–27° on screen, V21).
    vec2 gq = abs(fract(p / 16.0 + 0.5) - 0.5) * 16.0;
    grass *= 1.0 - 0.07 * step(min(gq.x, gq.y), 0.3);
    #ifndef FLOOR_MACRO
      // Darkness baked at the wall's foot (V8).
      float din = rw - r;
      grass = mix(grass, uContact, (1.0 - smoothstep(0.0, 3.0 + 3.0 * n2, din)) * 0.85);
    #endif
    // The terrace: slabs of 10 × 8 on the world grid, three tones, grout, broad mottling (V35).
    vec2 s = p / vec2(10.0, 8.0);
    vec2 cell = floor(s);
    vec2 f = fract(s);
    float h = fHash(cell);
    vec3 slab = h < 0.34 ? uSlabA : (h < 0.67 ? uSlabB : uSlabC);
    slab *= 0.86 + 0.28 * step(0.5, n3) * n2;
    #ifdef FLOOR_MACRO
      slab = min(slab * macro / uTerrBase, vec3(1.0)); // the map's footprint contact and warm specks on M4a's slab
    #endif
    #ifdef FLOOR_TERRACE_TILE
      slab *= terraceRatio(p); // the tile carries the grout
    #else
      vec2 e = min(f, 1.0 - f) * vec2(10.0, 8.0);
      slab = mix(slab, uGrout, step(min(e.x, e.y), 0.32));
    #endif
    // A ragged moss edge along the wall's outer foot, mossy patches, and the outer foot's contact
    // (per pixel with the macro map too: its texels are too coarse for them).
    float rOut = rw + ${WALL_DEPTH.toFixed(1)};
    float moss = max(1.0 - smoothstep(1.5 + 3.0 * n2, 2.5 + 3.0 * n2, r - rOut), step(0.66, n1) * step(0.45, n3));
    slab = mix(slab, uMossC, moss * 0.85);
    slab = mix(slab, uContact, (1.0 - smoothstep(0.0, 2.5, r - rOut)) * 0.75);
    // Grass runs under the wall to its middle, where the wall hides the switch.
    vec3 col = r < rw + 3.5 ? grass : slab;
    #ifdef FLOOR_DECALS
      col = floorDecals(p, col);
    #endif
    return col;
  }
  vec3 outerCol(float r) { return mix(uOuterNear, uOuterFar, smoothstep(200.0, 260.0, r)); }
`;

/** A tile's linear mean from tiles.json as a Vector3, or null if it is missing or not usable as a divisor. */
function tileMean(meta) {
  const m = meta?.mean;
  return Array.isArray(m) && m.length === 3 && m.every((x) => Number.isFinite(x) && x > 1e-4) ? new Vector3(m[0], m[1], m[2]) : null;
}

/**
 * The painted macro map (tools/3d/floor.py; M4b step 8), if it loaded: { tex, terrBase }, or null.
 * On the terrace the map is a ratio over terrBase (tiles.json floor.terraceBase, linear #2e422e,
 * its plain terrace and its clamped edge) laid on M4a's own per-pixel terrace, so the terrace keeps
 * M4a's fine mottling, moss and brightness, and past ±160 is exactly M4a's. A map without that
 * record (an older bake, whose terrace was albedo) is not used: the floor stays M4a. The garden
 * (arena3d.js) gates the blob trim and the tuft roots on this same test, so the props' contact and
 * the grass always agree with the floor that is drawn.
 */
export function floorMacro(paint) {
  const meta = paint?.meta?.floor;
  if (!paint?.floor || !meta || !paint.floorRoots) return null;
  const m = meta.terraceBase;
  if (!(Array.isArray(m) && m.length === 3 && m.every((v) => Number.isFinite(v) && v > 1e-4))) return null;
  return { tex: paint.floor, terrBase: new Color().setRGB(m[0], m[1], m[2]) };
}

/**
 * The floor's decals (layout3d.js FLOOR_DECALS) as the shader's uniform arrays, or null if the atlas
 * lacks any of their cells (then there are none, as in M4a).
 */
function floorDecals(paint) {
  const table = cellTable(paint, FLOOR_DECALS.map((d) => d.cell));
  if (!table || !FLOOR_DECALS.length) return null;
  return {
    at: FLOOR_DECALS.map((d) => new Vector4(d.x, d.y, Math.cos(d.yaw), Math.sin(d.yaw))),
    half: FLOOR_DECALS.map((d) => new Vector4(d.hx, d.hy, d.rim || 0, d.tone ?? 1)),
    box: table.box,
  };
}

/**
 * The floor: a plane over ±210, its colours worked out from the world position. `paint` is the
 * renderer's painted swatches (paint3d.js gardenTextures) or null: with its grass tile the lawn's
 * flat greens carry the painted lawn as a ratio, with its terrace tile the slabs carry the painted
 * slabs and grout (M4b step 2). With its macro map the lawn's and the terrace's colours come from
 * the map, and with the atlas's decal cells the engraved slab and the stepping stones are drawn
 * (step 8). A texture that did not load leaves its part exactly as M4a.
 * The grass tile is laid screen-aligned unless tiles.json says `map: "world"` (G3's pick).
 */
export function buildFloor(look, paint = null) {
  const geo = new PlaneGeometry(420, 420, 64, 64).rotateX(-Math.PI / 2);
  const mat = paintMaterial(look, { color: 0xffffff, shadeLift: GROUND_SHADE_LIFT }); // deep shade reads dark green, not black
  const grassMean = paint?.grass ? tileMean(paint.meta?.grass) : null;
  const terrMean = paint?.terrace ? tileMean(paint.meta?.terrace) : null;
  const grassWorld = !!grassMean && paint.meta.grass.map === "world";
  const macro = floorMacro(paint);
  const decals = floorDecals(paint);
  // Never through `map:`: three would then sample with the plane's own ±210 uv.
  if (grassMean) mat.defines.FLOOR_GRASS_TILE = 1;
  if (grassWorld) mat.defines.GRASS_WORLD = 1;
  if (terrMean) mat.defines.FLOOR_TERRACE_TILE = 1;
  if (macro) mat.defines.FLOOR_MACRO = 1;
  if (decals) mat.defines.FLOOR_DECALS = decals.at.length;
  const u = {
    uGrassA: { value: new Color(0x263d1c) },
    uGrassB: { value: new Color(0x31471d) },
    uGrassC: { value: new Color(0x3b4f1e) },
    uGrassD: { value: new Color(0x485a1f) },
    uSlabA: { value: new Color(0x2c4030) },
    uSlabB: { value: new Color(0x3a5036) },
    uSlabC: { value: new Color(0x223020) },
    uGrout: { value: new Color(0x0e140d) },
    uMossC: { value: new Color(0x3b4c1a) },
    uContact: { value: new Color(0x041914) },
    uOuterNear: { value: new Color(OUTER_NEAR) },
    uOuterFar: { value: new Color(OUTER_FAR) },
  };
  if (grassMean) Object.assign(u, { uGrassTile: { value: paint.grass }, uGrassMean: { value: grassMean } });
  if (terrMean) Object.assign(u, { uTerraceTile: { value: paint.terrace }, uTerrMean: { value: terrMean } });
  if (macro) Object.assign(u, { uMacro: { value: macro.tex }, uTerrBase: { value: macro.terrBase } });
  if (decals) Object.assign(u, { uDecalAtlas: { value: paint.atlas }, uDecalAt: { value: decals.at }, uDecalHalf: { value: decals.half }, uDecalBox: { value: decals.box }, uDecalGrad: { value: 8 / (paint.atlas.image?.width || 1024) } });
  mat.userData.floor = u;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    Object.assign(sh.uniforms, u);
    base(sh, r);
  };
  patchPaint(mat, `floor:${grassMean ? (grassWorld ? "gw" : "gs") : "-"}:${terrMean ? "t" : "-"}:${macro ? "m" : "-"}:${decals ? decals.at.length : 0}`, {
    frag: [
      ["void main() {", `${FLOOR_PARS}\nvoid main() {`],
      ["#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= floorAlbedo(vPaintWorld.xz);"],
      [
        "#include <opaque_fragment>",
        `{
           float rr = length(vPaintWorld.xz);
           if (rr > 210.0) discard;
           // G3 fix: over 26 units, not 10 (M4a's 200–210): the lit terrace ended in a hard edge
           // against the outer ground, a dark box in the landscape frame's corner.
           outgoingLight = mix(outgoingLight, outerCol(rr), smoothstep(184.0, 210.0, rr));
         }
         #include <opaque_fragment>`,
      ],
    ],
  });
  return plain(geo, mat, { receive: true });
}

/** The outer ground: a disc (ring) from r 200 to 1000 just under the floor, unlit, into the clear colour. */
export function buildOuterGround() {
  const geo = new RingGeometry(200, 1000, 96, 6).rotateX(-Math.PI / 2);
  const mat = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const u = { uOuterNear: { value: new Color(OUTER_NEAR) }, uOuterFar: { value: new Color(OUTER_FAR) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvXZ = position.xz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vXZ;\nuniform vec3 uOuterNear;\nuniform vec3 uOuterFar;")
      .replace("#include <opaque_fragment>", "diffuseColor.rgb = mix(uOuterNear, uOuterFar, smoothstep(200.0, 260.0, length(vXZ)));\noutgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey = () => "outerGround";
  const m = plain(geo, mat);
  m.position.y = -0.05;
  m.renderOrder = -1;
  return m;
}

/** The far hedge ring: flat dark silhouettes facing the camera, their tops from the layout. */
export function buildFarHedges(L) {
  const g = new Geo();
  const TOP = lin(0x132414);
  // G3 fix: each silhouette's foot takes the outer ground's own colour where it stands (buildOuterGround:
  // #1c2a1a at r 200 to the clear colour at r 260), not a fixed #0b140a. The quads run along screen
  // right, so a foot darker than the ground in front of it drew a hard horizontal line: the hedges
  // standing at r 222–260 read as flat cut-out bands stacked at the frame's edge (landscape, and
  // any frame near the terrace). Now they rise out of the ground.
  const NEAR = lin(OUTER_NEAR);
  const FAR = lin(OUTER_FAR);
  const foot = (x, y) => {
    const t = Math.min(1, Math.max(0, (Math.hypot(x, y) - 200) / 60));
    return mix3(NEAR, FAR, t * t * (3 - 2 * t));
  };
  const n = [0, 1, 0];
  for (const f of L.farHedges) {
    const tint = 0.85 + f.shade * 0.3;
    const top = TOP.map((v) => v * tint);
    for (let k = 0; k + 1 < f.tops.length; k++) {
      const [ax, ay, ah] = f.tops[k];
      const [bx, by, bh] = f.tops[k + 1];
      const a0 = [ax, -0.5, ay];
      const b0 = [bx, -0.5, by];
      const a1 = [ax, ah, ay];
      const b1 = [bx, bh, by];
      const fa = foot(ax, ay);
      const fb = foot(bx, by);
      const ca = mix3(fa, top, Math.min(1, ah / 30));
      const cb = mix3(fb, top, Math.min(1, bh / 30));
      g.triN(a0, b0, b1, n, n, n, fa, fb, cb);
      g.triN(a0, b1, a1, n, n, n, fa, cb, ca);
    }
  }
  // Face every quad towards the camera (its width runs along screen right).
  const p = g.p;
  for (let i = 0; i < p.length; i += 9) {
    const e1 = [p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]];
    const e2 = [p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]];
    const fx = e1[1] * e2[2] - e1[2] * e2[1];
    const fz = e1[0] * e2[1] - e1[1] * e2[0];
    if (fx + fz < 0) for (const arr of [g.p, g.c]) for (let k = 0; k < 3; k++) [arr[i + 3 + k], arr[i + 6 + k]] = [arr[i + 6 + k], arr[i + 3 + k]];
  }
  const geo = g.build();
  return plain(geo, new MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: DoubleSide }));
}

/**
 * Soft dark discs on the ground: [x, y, radius, strength]. One mesh, vertex alpha, no depth write.
 * under: drawn in the opaque pass (blended all the same) at render order 0.5, so lawn cover given
 * a later order draws over it. Lawn cover writes flattened depth (4.11), nearly the ground's, so a
 * disc drawn after it (the transparent pass) lay over a clover's own leaves.
 */
export function buildBlobs(spots, { under = false } = {}) {
  const pos = [];
  const col = [];
  const C = lin(0x041914);
  const SEG = 20;
  for (const [x, y, r, a] of spots)
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * 2 * Math.PI;
      const a1 = ((s + 1) / SEG) * 2 * Math.PI;
      // A centre, a solid inner ring at 55% and a fading outer ring: a soft edge from 6 triangles.
      const ring = (ang, k) => [x + Math.cos(ang) * r * k, 0.06, y + Math.sin(ang) * r * k];
      const quad = (k0, k1, al0, al1) => {
        const v = [ring(a0, k0), ring(a1, k0), ring(a1, k1), ring(a0, k1)];
        const al = [al0, al0, al1, al1];
        for (const i of [0, 2, 1, 0, 3, 2]) (pos.push(...v[i]), col.push(...C, al[i]));
      };
      quad(0, 0.55, a, a * 0.85);
      quad(0.55, 1, a * 0.85, 0);
    }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new Float32BufferAttribute(col, 4));
  const mat = new MeshBasicMaterial({ vertexColors: true, transparent: !under, depthWrite: false, toneMapped: false, side: DoubleSide });
  if (under) Object.assign(mat, { blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor });
  const m = plain(geo, mat);
  m.renderOrder = under ? 0.5 : 1;
  return m;
}
