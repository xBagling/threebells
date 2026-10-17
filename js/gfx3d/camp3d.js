// Camp 2.0's village (the owner, 2026-10-12: "build this new area as part of the camp"; "They should be moving layers. The
// split should be extremely fine"): the owner's painting itself as the arena, drawn through the camera fitted to it, as the
// Ash Floor is (the owner: "Instead look at arena 2 setup and how that is done with stairs as well"; the painting has
// perspective — its lanterns 49 px wide at the top, 97 at the bottom — so sizing the hero by the row he stood on was
// "quite strange"). Its quads lie on that camera's image plane and write each pixel's depth, so the hero walks behind a
// lantern, a fence post, a tree, an eave, and in front of them, pixel by pixel (tools/camp2/: SAM 2 split the props into
// ~1060 objects, each pixel stands on the vertical plane over its object's base; camera.py, levels.py, persp.py).
//
//   camp2-c<rc>.webp  the picture at 2x, in 2 x 2 tiles (each under a phone's 4096 texture limit)
//   camp2-view.json   the camera (render3d.js draws through it), the depth's range, the ground's heights, lanterns, trees
//   camp2-pdepth.png  each pixel's planar depth from that camera (game units), 16 bits in R (high) and G (low) over z0..z1
//   camp2-depth.png   (without a view: each pixel's dot(P, BACK) in the game's own orthographic view, over s0..s1)
//   camp2-fx.png      what moves: R 0..0.5 water (soft), 0.63 the water round a lotus, 0.86 a lotus; G the waterfalls;
//                     B the lanterns' light
//   camp2.json        K (image px a view unit), the middle (at the world's origin), s0..s1, the tiles, the lanterns, the
//                     cherry trees (world: x, height, z, radius) the petals fall from
//
// Moving, in the shader: the water shimmers and flows (its own painted pixels drawn through two layers of drifting noise,
// light glinting on the ripples), the waterfalls pour (the painted fall drawn sliding down, a flow-map blend so it never
// jumps, white streaks racing down it), the lanterns' light flickers, each on its own beat. Over it all,
// cherry petals drift down from the trees and settle.
import { Mesh, Group, BufferGeometry, Float32BufferAttribute, ShaderMaterial, NoColorSpace, NearestFilter, LinearFilter, InstancedBufferGeometry, InstancedBufferAttribute, NormalBlending, LinearMipmapLinearFilter, Vector4 } from "./three-lib.js?v=79a60b0-466c2a40";
import { BACK, RIGHT, UP } from "./camera3d.js?v=79a60b0-466c2a40";
import { loadEdit, loadPieces, emptyEdit, attachPieces } from "./mapedit3d.js?v=79a60b0-466c2a40";
import { pictureLoader } from "./texload.js?v=79a60b0-466c2a40";
import { loadFxEdit } from "./fxedit.js?v=79a60b0-466c2a40";

/** Fetch Camp 2.0's arena (art3d/<id>/): its json, picture tiles, depth and fx maps; null when missing. */
export async function loadCamp(id) {
  try {
    const base = `art3d/${id}/`;
    // Everything asked for at once (2026-10-16): one stage after another — the json, the view, the picture, the empty map,
    // the matte, the edits, the lines, the effects — the village's 15 MB came in seven round trips plus their waits.
    const tl = pictureLoader(); // (decoded off the page's thread: texload.js)
    const tex = (url) => tl.loadAsync(url);
    const opt = (p) => p.catch(() => null);
    const [meta, view] = await Promise.all([fetch(`${base}${id}.json`).then((r) => r.json()), fetch(`${base}${id}-view.json`).then((r) => (r.ok ? r.json() : null), () => null)]);
    // (the image camera, persp.py: its lanterns and trees stand in its world, not the orthographic one)
    if (view) Object.assign(meta, { view, lanterns: view.lanterns, trees: view.trees });
    const files = meta.tiles.files;
    const main = Promise.all([Promise.all(files.map((f) => tex(base + f))), tex(`${base}${id}-${view ? "pdepth" : "depth"}.png`), tex(`${base}${id}-fx.png`)]);
    // (under the crowns: the empty map's tiles and the bare ground's depth — tools/camp2/occl.py; optional)
    const under = view ? Promise.all([opt(Promise.all(files.map((f) => tex(base + f.replace("-c", "-e"))))), opt(tex(`${base}${id}-gdepth.png`))]) : [null, null];
    // (the soft cut-out of what stands, drawn over him at its edges — tools/camp2/matte.py; optional)
    const over = view ? Promise.all([opt(Promise.all(files.map((f) => tex(base + f.replace("-c", "-m"))))), opt(tex(`${base}${id}-odepth.png`)), opt(tex(`${base}${id}-crown.png`))]) : [null, null, null];
    // (the owner's own corrections, the edit mode — mapedit3d.js; optional)
    // (and the objects the blue is made of, each covering whoever stands behind its line — tools/camp2/pieces.py; optional)
    // (on the depth map's grid, and the effects on the fx map's: checked once those are in)
    const size = (i) => main.then((m) => ({ w: m[i].image.width, h: m[i].image.height }));
    const edits = view ? Promise.all([loadEdit(id, size(1)), loadPieces(id, size(1))]) : [null, null];
    // (the owner's painted effects: water, waterfalls, petals — fxedit.js; optional)
    const fxEditP = view ? loadFxEdit(id, size(2)).catch(() => null) : null;
    const [tiles, depth, fx] = await main;
    const [empty, gdepth] = await under;
    const [matte, odepth, crown] = await over;
    if (crown) (crown.colorSpace = NoColorSpace), (crown.flipY = false), (crown.generateMipmaps = false), (crown.minFilter = crown.magFilter = LinearFilter), (crown.needsUpdate = true);
    for (const t of [...(matte || []), ...(odepth ? [odepth] : [])]) {
      t.colorSpace = NoColorSpace;
      t.flipY = false;
      t.needsUpdate = true;
    }
    for (const t of matte || []) (t.generateMipmaps = true), (t.minFilter = LinearMipmapLinearFilter), (t.magFilter = LinearFilter);
    if (odepth) (odepth.generateMipmaps = false), (odepth.minFilter = odepth.magFilter = NearestFilter);
    for (const t of [...tiles, depth, fx, ...(empty || []), ...(gdepth ? [gdepth] : [])]) {
      t.colorSpace = NoColorSpace; // (decoded from sRGB in the shader: left to three.js the picture came out encoded twice)
      t.flipY = false;
      t.generateMipmaps = false;
      t.needsUpdate = true;
    }
    for (const t of [...tiles, fx]) t.minFilter = t.magFilter = LinearFilter;
    // (the picture is drawn smaller than its 2x tiles on every screen — 0.17-0.32 of a 4x pixel a screen pixel: without
    // mipmaps it shimmered and lost its detail, SSIM 0.83 against the painting)
    for (const t of [...tiles, ...(empty || [])]) (t.generateMipmaps = true), (t.minFilter = LinearMipmapLinearFilter), (t.anisotropy = 4);
    for (const t of [depth, ...(gdepth ? [gdepth] : [])]) t.minFilter = t.magFilter = NearestFilter;
    const dw = depth.image.width, dh = depth.image.height;
    const [edit0, pieces] = await edits;
    const edit = edit0 || (pieces ? emptyEdit(dw, dh) : null);
    const fxEdit = await fxEditP;
    if (edit && pieces) attachPieces(edit, pieces);
    return { id, meta, tiles, depth, fx, empty: empty && gdepth ? empty : null, gdepth, matte: matte && odepth ? matte : null, odepth, crown, edit, editDepth: view ? depth : null, fxEdit, camp: true };
  } catch {
    return null;
  }
}

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform sampler2D tColor;   // this tile of the picture
  uniform sampler2D tEmpty;   // this tile of the empty map (what is under a crown)
  uniform sampler2D tGround;  // the bare ground's depth, the whole picture
  uniform vec4 uHero;         // the hero: his middle (image px), the crown's opening radius (image px), his planar depth
  uniform float uHasEmpty;
  uniform sampler2D tDepth;   // the whole picture's depth
  uniform sampler2D tFx;      // the whole picture's moving parts
  uniform sampler2D tFxEdit;  // the owner's painted effects (ui/mapedit.js Effects): R water, G waterfall, B none (takes the
  uniform float uHasFxEdit;   //   map's own away), A falling petals (the petals themselves: makeCampFx)
  uniform vec4 uTile;         // this tile's place in the whole picture (u0, v0, du, dv)
  uniform vec2 uImage;        // the whole picture's size (1x pixels)
  uniform vec2 uRange;        // s0, s1 (orthographic) or z0, z1 (the image camera's planar depth)
  uniform float uCamBack;     // dot(the camera's position, BACK)
  uniform vec2 uNearFar;
  uniform float uPersp;       // 1: drawn through the image camera
  uniform float uTime;
  // (which pass this program draws, fixed when it is built: the main picture, its glow, or the overlay 1 / 2 laid over him —
  // as uniforms every pass ran past the others' branches; backdrop3d.js makeRefBackdrop the same)
  #define uGlowPass float(GLOW)
  uniform vec4 uFlames[24];   // the stone lanterns' flames: foot x, y, width, height (1x image px; camp2.json "flames")
  uniform int uNFlames;
  uniform vec4 uForge;        // the blacksmith's forge: fire x, y, its radius, its light's radius (1x image px; camp2.json "forge")
  uniform sampler2D tMatte;   // this tile's soft cut-out of what stands: RGB its own colour at its edge, A how much of it (matte.py)
  uniform sampler2D tOdepth;  // the whole picture: the depth of the standing thing a pixel is at, or next to (B: there is one)
  uniform float uHasMatte;
  uniform sampler2D tCrown;   // how much of each pixel is a tree's crown or a bush, soft (matte.py); else the depth map's B
  uniform float uHasCrown;
  #define uOverlay float(OVER) // 1: the pass drawn after him — what stands in front of him, by its soft cut-out
  uniform float uSee;         // his silhouette over what covers him, 0..1 (render3d.js: by how much of him is covered)
  uniform sampler2D tEdit;    // the owner's corrections (ui/mapedit.js), the whole picture at 1x: R stands in front of him, G
  uniform sampler2D tEditD;   //   never in front, B a comment's area; tEditD the depth of what R adds (R high, G low, as tDepth)
  uniform float uHasEdit;
  uniform sampler2D tPiece;   // the object each pixel of the blue belongs to (R high, G low; mapedit3d.js), the whole picture
  uniform sampler2D tFlags;   // whether each object covers him now (render3d.js campCover): 256 x 256, at (low byte, high byte)
  uniform float uHasPiece;
  uniform vec2 uGrid;         // tPiece's size
  uniform float uEditShow;    // 1: the edit mode's tint — what stands (blue), added (green), taken out (red), comments (yellow)
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 dec(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  // (a sample of this tile at a point of the whole picture given in 1x pixels; off the tile it holds its edge)
  vec3 at(vec2 px) {
    vec2 u = (px / uImage - uTile.xy) / uTile.zw;
    // (a mip level half a step finer than the GPU picks: trilinear filtering alone left the painting softer than it is)
    return dec(texture2D(tColor, clamp(u, vec2(0.0005), vec2(0.9995)), -0.6).rgb);
  }

  vec3 atEmpty(vec2 px) {
    vec2 u = (px / uImage - uTile.xy) / uTile.zw;
    return dec(texture2D(tEmpty, clamp(u, vec2(0.0005), vec2(0.9995)), -0.6).rgb);
  }
  // (a 4 x 4 ordered dither: the screen-door threshold of the crown's opening — no blending, no sorting)
  float bayer(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    return (mod(i * 11.0, 16.0) + 0.5) / 16.0;
  }

  // (how far behind his middle the picture is put wherever it must not cover him: past his own depth. His figure is pressed
  // to 6% of its depth spread round his middle (render3d.js figWrap) — his sword's tip up to 1.5 units behind it — and at
  // 0.5-2 units the picture there cut through the sword and patches of him as he moved: they flashed (the owner,
  // 2026-10-13: "some flashing of the sword, and some small flashing on the character asset")
  const float HB = 3.0;
  // (whether the object at a texel of tPiece covers him now: 1 for no object — blue no object holds covers, as before)
  float flagAt(vec2 t) {
    vec4 p = texture2D(tPiece, (t + 0.5) / uGrid);
    vec2 b = floor(p.rg * 255.0 + 0.5);
    return texture2D(tFlags, (vec2(b.y, b.x) + 0.5) / 256.0).r;
  }
  // (blended over the 4 nearest texels: where an object that covers him meets one that does not, the seam is soft)
  float coverK(vec2 uv) {
    vec2 g = uv * uGrid - 0.5, i = floor(g), w = g - i;
    return mix(mix(flagAt(i), flagAt(i + vec2(1.0, 0.0)), w.x), mix(flagAt(i + vec2(0.0, 1.0)), flagAt(i + vec2(1.0, 1.0)), w.x), w.y);
  }
  void main() {
    vec2 uv = uTile.xy + vUv * uTile.zw;          // in the whole picture
    vec2 px = uv * uImage;
    // (an overlay is laid only round him — below, soft holds nowhere else: away from him it ends here, before any read; it
    // ran the whole picture's shader over every tile to discard nearly all of it, 2026-10-16)
    if (uOverlay > 0.5) {
      if (uHero.z <= 0.0) discard;
      vec2 o2 = (px - uHero.xy) / vec2(uHero.z * 3.0, uHero.z * 3.0);
      if (dot(o2, o2) >= 1.0) discard;
    }
    vec4 dq = texture2D(tDepth, uv);
    float q = floor(dq.r * 255.0 + 0.5) * 256.0 + floor(dq.g * 255.0 + 0.5);
    float s = uRange.x + q / 65534.0 * (uRange.y - uRange.x);
    // (trees and bushes follow the one rule every cut-out does — blue in the edit mode, in front of him when he is behind it.
    // They used to open round him besides (the owner, 2026-10-12: "when walking under e.g trees ... state of the art"),
    // a second rule the edit mode could not show: "I only want one truth of the overlay, im getting confused" — he chose
    // trees like every other mask, 2026-10-13. A tree he wants him seen through, he clears)
    const float open = 0.0;
    const bool cut = false;
    float n = uNearFar.x, f = uNearFar.y;
    // What stands in front of him, by its soft cut-out (the owner's /goal, 2026-10-13: rails and rail posts "cropped out
    // correctly ... no pixel hard edges ... quality cropped/masked"): the 1x depth hid him in blocks of 2-4 screen px along
    // every rail, and where it and the cut-out disagreed it left a straight hard edge across a lantern's roof. Near him (an
    // ellipse round him), wherever a standing thing nearer than he is lies (odepth: the thing's depth at and round it), the
    // picture does not hide him — he is drawn — and the overlay pass after him lays the thing over him by the cut-out's alpha
    // (matte.py: SAM 2 at 2x, the painting's depth at 4x, a colour-guided filter at 4x): inside it the live picture (flames,
    // flicker and all), along its edge the thing's own colour. The overlay is drawn only where he is: its depth is just behind
    // his (he is pressed flat to his middle, render3d.js figWrap), tested greater-or-equal, so the picture behind is untouched.
    // Much of him covered, the overlay is tinted as his silhouette (uSee).
    // ONE truth, the mask (the owner, 2026-10-14: "disable the depth map for now. Only go for one ground truth which is if
    // he is behind it or not. Which the mask will decide ... Only have the blue color, which i also will edit"): round
    // him, whatever is masked — the map's cut-out (tMatte) and his own Mask (ed.r), less his Clear (ed.g) — is laid over
    // him, by its soft edge; whatever is not masked never covers him. No depth decides it.
    vec4 ed = uHasEdit > 0.5 ? texture2D(tEdit, uv) : vec4(0.0);
    vec4 mt0 = uHasMatte > 0.5 ? texture2D(tMatte, vUv) : vec4(0.0);
    float aEff = clamp(max(mt0.a, ed.r) * (1.0 - ed.g), 0.0, 1.0);
    bool soft = false;
    // (what covers him: the blue, where its object covers him now — an object with a line of the owner's only while he stands
    // behind it (the owner, 2026-10-14: "let the character be both behind and in front of an object"), every other one
    // wherever they overlap. Worked out round him only)
    float aCov = aEff;
    vec4 mt = vec4(mt0.rgb, aEff);
    if (uHero.z > 0.0 && !cut) {
      // (round all of him and as far as his sword reaches)
      vec2 d2 = (px - uHero.xy) / vec2(uHero.z * 3.0, uHero.z * 3.0);
      if (dot(d2, d2) < 1.0) {
        if (aEff > 0.004 && uHasPiece > 0.5) aCov = aEff * coverK(uv);
        mt.a = aCov;
        if (aCov > 0.004) {
          soft = true;
          // (the picture moved well behind him there — the overlay after him lays the thing back over him; that depth is
          // no surface: his shadow falls on the painting's own depth, shadow3d.js tRecv)
          s = max(s, uHero.w + 10.0);
        }
        // (not masked: never in front of him, whatever the picture's depth says — his shadow still falls on the true depth)
        else if (s < uHero.w + HB) s = uHero.w + HB;
      }
    }
    float oa = soft ? aCov : 0.0;
    if (uOverlay > 0.5) {
      if (oa < 0.004) discard;
      float zo = uHero.w + (uOverlay > 1.5 ? 9.5 : 8.0);
      gl_FragDepth = clamp(f * (zo - n) / (zo * (f - n)), 0.0, 0.99999);
    }
    else if (uPersp > 0.5) gl_FragDepth = clamp(f * (s - n) / (s * (f - n)), 0.0, 0.99999);   // (as the Ash Floor's, backdrop3d.js)
    else gl_FragDepth = clamp((uCamBack - s - n) / (f - n), 0.0, 1.0);

    vec3 fx = texture2D(tFx, uv).rgb;
    vec4 fe = uHasFxEdit > 0.5 ? texture2D(tFxEdit, uv) : vec4(0.0);
    float t = uTime;
    vec3 c = at(px);
    float wat = fx.r < 0.55 ? fx.r / 0.498 : 0.0;   // (R: 0..0.5 how much water; 0.63 round a lotus; 0.86 a lotus)
    // (and the owner's: his water added, the map's taken away where he painted none — the owner, 2026-10-14: "add a select in
    // the camp Edit as well to add the sakura bloom effect, and the water effect, and the waterfall effect")
    wat = max(wat * (1.0 - fe.b), fe.r);
    fx.g = max(fx.g * (1.0 - fe.b), fe.g);
    if (wat > 0.02) {
      // water: its own pixels drawn through two layers of noise drifting different ways (it flows and shimmers), and light
      // glinting where the ripples crest; blended in by how much water it is, so its edge never tears
      vec2 w1 = vec2(noise(px * 0.045 + vec2(t * 0.35, t * 0.22)), noise(px * 0.045 + vec2(17.0 - t * 0.27, 5.0 + t * 0.31))) - 0.5;
      vec2 w2 = vec2(noise(px * 0.11 + vec2(-t * 0.6, t * 0.45) + 40.0), noise(px * 0.11 + vec2(t * 0.5, -t * 0.4) + 80.0)) - 0.5;
      // (only from water: a sample that lands on a rock, a post or the bridge would tear shards into the water's edge)
      vec2 sp = px + w1 * 3.2 + w2 * 1.4;
      float ws = texture2D(tFx, sp / uImage).r;
      vec4 fs = uHasFxEdit > 0.5 ? texture2D(tFxEdit, sp / uImage) : vec4(0.0);
      vec3 moved = (ws < 0.55 && ws > 0.3 && fs.b < 0.5) || fs.r > 0.5 ? at(sp) : c;
      float crest = noise(px * vec2(0.09, 0.16) + vec2(t * 0.7, -t * 0.25) + w1 * 3.0);
      moved += vec3(0.55, 0.75, 0.8) * smoothstep(0.72, 0.92, crest) * 0.12 * (0.6 + 0.4 * sin(t * 2.3 + px.x * 0.05));
      c = mix(c, moved, clamp(wat, 0.0, 1.0));
    }
    // (the lotuses and the water round them, R 0.63 / 0.86, stay as painted: their drift and bob are gone — the owner,
    // 2026-10-12: "Remove the lotus special effects")
    if (fx.g > 0.05) {
      // a waterfall: the painted fall slides down (two copies a half period apart, crossfaded, so it never jumps back), and
      // white streaks race down it
      float P = 14.0, ft = t * 1.1;
      float p1 = fract(ft), p2 = fract(ft + 0.5);
      vec3 a1 = at(px - vec2(0.0, p1 * P)), a2 = at(px - vec2(0.0, p2 * P));
      vec3 fall = mix(a1, a2, abs(2.0 * p1 - 1.0));
      float streak = noise(vec2(px.x * 0.32, px.y * 0.05 - t * 5.5)) * noise(vec2(px.x * 0.7 + 9.0, px.y * 0.08 - t * 7.0));
      fall += vec3(0.85, 0.92, 1.0) * smoothstep(0.25, 0.55, streak) * 0.35;
      c = mix(c, fall, fx.g);
    }
    // The stone lanterns, out (the owner, 2026-10-14: "update the camp fire lanterns to not have any lights in them since it is
    // broad daylight"): repainted unlit in the picture itself (tools/camp2/unlit.py); here the painted light round each
    // cooled to the daylight's tone. No live flame, no flicker (they burned and pulsed here till then, uFlames).
    if (fx.b > 0.02) c = mix(c, c * vec3(0.86, 0.9, 1.02), fx.b * 0.7);
    // The blacksmith's forge, alive (the owner, 2026-10-15: "replace one of the buildings to a blacksmith"; tools/camp2/gptcamp.py):
    // the painted fire licks upward (its own pixels drawn through rising noise) and flickers, and the warm light it throws on
    // the floor, the tools and the walls round it pulses on the same beat
    if (uForge.w > 0.0) {
      vec2 dq = px - uForge.xy;
      float dl = length(dq);
      if (dl < uForge.w) {
        float fl = 0.88 + 0.08 * sin(t * 11.0) + 0.1 * noise(vec2(t * 7.0, 4.0)) - 0.05 * noise(vec2(t * 17.0, 9.0));
        float df = dl / uForge.z;
        if (df < 1.0) {
          float k = 1.0 - smoothstep(0.55, 1.0, df);
          vec2 lick = vec2(noise(vec2(px.x * 0.4, px.y * 0.25 + t * 6.0)) - 0.5, noise(vec2(px.x * 0.3 + 5.0, px.y * 0.2 + t * 5.0)) * 1.4) * 1.6;
          c = mix(c, at(px + lick), k);
        }
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float warm = clamp((c.r - c.b) * 2.5, 0.0, 1.0) * smoothstep(0.2, 0.7, lum);
        float fall = 1.0 - smoothstep(0.0, 1.0, dl / uForge.w);
        c *= mix(1.0, fl, warm * fall);
      }
    }
    if (uOverlay > 0.5 && uOverlay < 1.5) {
      // (the colour: the live picture, blended to the cut-out's own colour only over its last soft edge — a hard switch at
      // 0.97 drew a dark line inside every edge where the two differ)
      // (along a soft edge the thing's own colour, matte.py's — where the cut-out is his alone there is none: the live
      // picture)
      vec3 oc = mix(mt0.a > 0.05 ? dec(mt0.rgb) : c, c, smoothstep(0.5, 0.95, mt.a));
      // (in the edit mode the part laid over him is tinted as the rest of the mask: drawn plain it read as something else
      // added on top of him — the owner, 2026-10-13: "Is the visible mask behaving differently than the mask I'm actually
      // adding?")
      if (uEditShow > 0.5) oc = mix(oc, vec3(0.15, 0.45, 1.0), 0.45);
      // (his silhouette: where it lays a thing over him the overlay is his shape, tinted his cloak's teal — the owner,
      // 2026-10-13: "now there are no marking that he is behind the tree")
      // (keeping the light and shade of what covers him: a flat teal read as a teal object)
      oc = mix(oc, vec3(0.16, 0.55, 0.5) * (0.45 + 1.4 * dot(oc, vec3(0.2126, 0.7152, 0.0722))), uSee);
      gl_FragColor = vec4(oc, oa);
      return;
    }
    if (uGlowPass > 0.5) {
      // the glow layer (bloom): the lanterns, the lit windows, the glints
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= smoothstep(0.45, 0.9, lum) * clamp((c.r - c.b) * 3.0, 0.0, 1.0) * 0.18 * (1.0 - fx.b);   // (the lanterns are out by day: no bloom from them)
    }
    if (uEditShow > 0.5 && uGlowPass < 0.5) {
      // (one colour: masked — what covers whoever stands behind it, as mapped and as painted — or not)
      // (one truth: blue is what covers him where he stands now — masked and in front of him, by the very test the overlay
      // makes; masked but behind him from there, pale. A blue tint on all that was masked said "covers him" of things his
      // depth put behind him — the owner, 2026-10-14: "the feet is above the table even though i masked it")
      // (blue: masked — covers him wherever they overlap. One colour, the one truth)
      c = mix(c, vec3(0.15, 0.45, 1.0), 0.5 * aEff);
      c = mix(c, vec3(1.0, 0.9, 0.05), 0.7 * ed.b);
    }
    gl_FragColor = vec4(c, uOverlay > 1.5 ? oa : 1.0);
  }
`;

/** The village's quads: `main` (layer 0) and `glow` (layer 1) groups, the lanterns as the characters' lights. */
export function makeCampBackdrop(bd) {
  const m = bd.meta;
  const { w: IW, h: IH } = m.image;
  const K = m.K, [CX, CY] = m.center;
  const vr = m.view?.ref;
  // (through the image camera: each image pixel on its own ray, on the image plane 1000 units out — inside near..far; the
  // depth the shader writes is the map's, not the plane's)
  const D = 1000;
  const P = vr
    ? (px, py) => {
        const a = ((px - vr.image.w / 2) / vr.f) * D, b = (-(py - vr.image.h / 2) / vr.f) * D;
        return [0, 1, 2].map((k) => vr.pos[k] - vr.back[k] * D + a * vr.right[k] + b * vr.up[k]);
      }
    : (px, py) => {
        const a = (px - CX) / K, b = -(py - CY) / K;
        return [a * RIGHT[0] + b * UP[0], a * RIGHT[1] + b * UP[1], a * RIGHT[2] + b * UP[2]];
      };
  const range = vr ? [m.view.depth.z0, m.view.depth.z1] : [m.depth.s0, m.depth.s1];
  const { cols, rows } = m.tiles;
  const main = new Group(), glow = new Group();
  const mats = [], geos = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x0 = (c * IW) / cols, x1 = ((c + 1) * IW) / cols, y0 = (r * IH) / rows, y1 = ((r + 1) * IH) / rows;
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute([...P(x0, y0), ...P(x1, y0), ...P(x0, y1), ...P(x1, y1)], 3));
      geo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geo.setIndex([0, 2, 1, 1, 2, 3]);
      geos.push(geo);
      for (const isGlow of [false, true]) {
        const mat = new ShaderMaterial({
          uniforms: {
            tColor: { value: bd.tiles[r * cols + c] }, tDepth: { value: bd.depth }, tFx: { value: bd.fx }, tFxEdit: { value: bd.fxEdit?.tex || null }, uHasFxEdit: { value: bd.fxEdit?.tex ? 1 : 0 },
            tEmpty: { value: bd.empty ? bd.empty[r * cols + c] : null }, tGround: { value: bd.gdepth || null }, uHero: { value: new Vector4(0, 0, 0, 0) }, uHasEmpty: { value: bd.empty ? 1 : 0 },
            uTile: { value: [x0 / IW, y0 / IH, (x1 - x0) / IW, (y1 - y0) / IH] }, uImage: { value: [IW, IH] },
            uRange: { value: range }, uCamBack: { value: 0 }, uNearFar: { value: [1, 3000] }, uPersp: { value: vr ? 1 : 0 },
            uTime: { value: 0 }, uGlowPass: { value: isGlow ? 1 : 0 },
            uFlames: { value: Array.from({ length: 24 }, (_, i) => new Vector4(...(m.flames?.[i] || [0, 0, 0, 0]))) }, uNFlames: { value: Math.min(24, m.flames?.length || 0) }, uForge: { value: new Vector4(...(m.forge || [0, 0, 0, 0])) },
            tMatte: { value: bd.matte ? bd.matte[r * cols + c] : null }, tOdepth: { value: bd.odepth || null }, uHasMatte: { value: bd.matte ? 1 : 0 }, tCrown: { value: bd.crown || null }, uHasCrown: { value: bd.crown ? 1 : 0 }, uOverlay: { value: 0 }, uSee: { value: 0 },
            tEdit: { value: null }, tEditD: { value: null }, uHasEdit: { value: 0 }, uEditShow: { value: 0 },
            tPiece: { value: null }, tFlags: { value: null }, uHasPiece: { value: 0 }, uGrid: { value: [1, 1] },
          },
          defines: { GLOW: isGlow ? 1 : 0, OVER: 0 },
          vertexShader: vert, fragmentShader: frag, toneMapped: false, depthWrite: !isGlow, depthTest: true, side: 2,
        });
        mats.push(mat);
        const mesh = new Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = -10; // (first: everything else tests against its depth)
        if (isGlow) mesh.layers.set(1);
        (isGlow ? glow : main).add(mesh);
        // (the soft edges of what stands in front of him, after him: see the shader — only where he is drawn)
        if (!isGlow && bd.matte) {
          const om = new ShaderMaterial({
            uniforms: { ...mat.uniforms, uOverlay: { value: 1 } },
            defines: { GLOW: 0, OVER: 1 },
            vertexShader: vert, fragmentShader: frag, toneMapped: false, transparent: true, depthWrite: false, depthTest: true, side: 2, forceSinglePass: true, // (one pass: backdrop3d.js flameMat)
          });
          om.depthFunc = 5; // (GreaterEqualDepth)
          mats.push(om);
          const over = new Mesh(geo, om);
          over.frustumCulled = false;
          // (after him, his cape, his swing's trail (5) and the dust and sparks (10) over him; before the petals)
          over.renderOrder = 10.5;
          main.add(over);
          // (and the thing laid back over all else drawn round him that keeps no depth — the dust and sparks, the swing's
          // trail, his old round contact shadow — which the pass above, tested against his depth, never saw: they showed on
          // top of the tree he stood behind (the owner, 2026-10-13: "particles and some old round small shadowing still
          // shows up underneath the overlay"). Only where the picture was moved behind him (Less than 9.5 behind him: not
          // on him, so his silhouette stays); the live picture by the cut-out's alpha, so where nothing was drawn it is the
          // picture over itself — no change)
          const om2 = new ShaderMaterial({
            uniforms: { ...mat.uniforms, uOverlay: { value: 2 } },
            defines: { GLOW: 0, OVER: 2 },
            vertexShader: vert, fragmentShader: frag, toneMapped: false, transparent: true, depthWrite: false, depthTest: true, side: 2, forceSinglePass: true,
          });
          om2.depthFunc = 2; // (LessDepth)
          mats.push(om2);
          const over2 = new Mesh(geo, om2);
          over2.frustumCulled = false;
          over2.renderOrder = 11;
          main.add(over2);
        }
      }
    }
  if (glow.children.length) glow.layers.set(1);
  // The stone lanterns as the characters' lights (look.uLant: the nearest eight), each breathing a little.
  // (out by day — the owner, 2026-10-14: no lights in them — so they light no one)
  const lanterns = [];
  return {
    main,
    glow,
    lanterns,
    fires: [],
    camp: true,
    meta: m,
    /** The painting's own depth (the surface his shadow falls on, shadow3d.js): the texture and its planar range. */
    depthMap: { tex: bd.depth, range },
    /** Where the hero is in the picture (image px), how wide a crown opens round him (image px) and his planar depth. */
    setHero(px, py, r, z, see = 0) {
      for (const mat of mats) {
        mat.uniforms.uHero.value.set(px, py, r, z);
        mat.uniforms.uSee.value = see;
      }
    },
    /** The edit mode's layers (ui/mapedit.js): `cov` R add / G take out / B comments, `dep` the added depth; and its tint. */
    setEdit(cov, dep, show = false) {
      for (const mat of mats) {
        const u = mat.uniforms;
        u.tEdit.value = cov; u.tEditD.value = dep; u.uHasEdit.value = cov && dep ? 1 : 0; u.uEditShow.value = show && cov ? 1 : 0;
      }
    },
    /** The owner's painted effects (fxedit.js texture), or null. */
    setFxEdit(tex) {
      for (const mat of mats) (mat.uniforms.tFxEdit.value = tex), (mat.uniforms.uHasFxEdit.value = tex ? 1 : 0);
    },
    /** The objects (mapedit3d.js attachPieces: `pid` the texture, w x h) and whether each covers him now (render3d.js). */
    setPieces(pid, flags, w, h) {
      for (const mat of mats) {
        const u = mat.uniforms;
        u.tPiece.value = pid; u.tFlags.value = flags; u.uHasPiece.value = pid && flags ? 1 : 0; u.uGrid.value = [w || 1, h || 1];
      }
    },
    update(camera, now) {
      const cb = camera.position.x * BACK[0] + camera.position.y * BACK[1] + camera.position.z * BACK[2];
      for (const mat of mats) {
        const u = mat.uniforms;
        u.uCamBack.value = cb;
        u.uNearFar.value = [camera.near, camera.far];
        u.uTime.value = now;
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const mt of mats) mt.dispose();
    },
  };
}

// --- the cherry petals: drifting down from the trees, turning as they fall, settling and fading ----------------------
const petalVert = /* glsl */ `
  attribute vec4 aSeed;     // the tree's x, z offset (0..1 each), phase, size
  attribute vec4 aTree;     // the tree: x, height, z, radius
  uniform float uTime;
  uniform vec3 uRight, uUp;
  varying vec2 vUv;
  varying float vA, vShade;
  void main() {
    float life = 10.0 + aSeed.w * 7.0;   // (slower, and each lies on the ground a while)
    float k = mod(uTime + aSeed.z * life, life) / life;          // 0..1 along its fall
    float cyc = floor((uTime + aSeed.z * life) / life);
    float rx = fract(aSeed.x + cyc * 0.618) * 2.0 - 1.0, rz = fract(aSeed.y + cyc * 0.382) * 2.0 - 1.0;
    float fallT = 0.78;                                          // (the rest: lying on the ground, fading)
    float f = min(k / fallT, 1.0);
    vec3 p = vec3(aTree.x + rx * aTree.w, aTree.y * (1.0 - f) + 0.3, aTree.z + rz * aTree.w);
    // the breeze carries it off one way, and it sways and flutters as it falls
    p.x += f * 14.0 + sin(uTime * 1.3 + aSeed.z * 30.0) * 3.0 * f;
    p.z += f * 6.0 + cos(uTime * 1.1 + aSeed.z * 17.0) * 3.0 * f;
    float turn = uTime * (2.0 + aSeed.w * 3.0) + aSeed.z * 20.0;
    vec2 q = position.xy;
    q = vec2(q.x * cos(turn) - q.y * sin(turn), q.x * sin(turn) + q.y * cos(turn));
    q.y *= k < fallT ? 0.45 + 0.55 * abs(sin(turn * 0.7)) : 0.5; // (seen edge-on now and then as it tumbles)
    float size = 0.75 + aSeed.w * 0.45;   // (a petal about a hand across: smaller ones were specks a pixel wide on a phone)
    vec3 w = p + (uRight * q.x + uUp * q.y) * size;
    vA = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.86, 1.0, k));
    vShade = 0.8 + 0.2 * sin(turn);
    vUv = position.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
const petalFrag = /* glsl */ `
  varying vec2 vUv;
  varying float vA, vShade;
  void main() {
    // a petal: a rounded teardrop with a notch, pale pink with a deeper heart
    vec2 p = vUv;
    float d = length(vec2(p.x * 1.25, p.y + 0.15 * p.x * p.x));
    float notch = smoothstep(0.12, 0.0, length(p - vec2(0.0, 0.95)));
    float a = (1.0 - smoothstep(0.75, 1.0, d)) * (1.0 - notch) * vA;
    if (a < 0.02) discard;
    vec3 col = mix(vec3(0.98, 0.55, 0.68), vec3(1.0, 0.82, 0.88), smoothstep(0.0, 0.8, d)) * vShade;
    a *= 0.8;
    gl_FragColor = vec4(col * a, a);
  }
`;

/** The petals (and nothing else for now): `objects` for the scene, `update(now)`. */
export function makeCampFx(bd) {
  // (the map's cherry trees, less those the owner took the petals from, and the places he painted petals falling — fxedit.js)
  const fe = bd.fxEdit;
  const trees = [...(bd.meta.trees || []).filter((_, i) => !fe?.drop?.includes(i)), ...(fe?.petals || [])];
  // (a few, drifting: 26 a tree, up to 600, was a snowstorm — the owner, 2026-10-12: "the falling sakura leaves can be toned
  // down a lot, they are exagerrated now")
  const N = Math.min(220, trees.length * 6);
  if (!N) return { objects: [], update() {}, dispose() {} };
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  const seed = new Float32Array(N * 4), tree = new Float32Array(N * 4);
  let h = 24681357;
  const rnd = () => ((h = (h * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < N; i++) {
    const t = trees[i % trees.length];
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    tree.set([t[0], t[1], t[2], t[3]], i * 4);
  }
  g.setAttribute("aSeed", new InstancedBufferAttribute(seed, 4));
  g.setAttribute("aTree", new InstancedBufferAttribute(tree, 4));
  g.instanceCount = N;
  const mat = new ShaderMaterial({
    // (square to the camera they are drawn through: the image camera's, when there is one)
    uniforms: { uTime: { value: 0 }, uRight: { value: bd.meta.view?.ref.right || RIGHT }, uUp: { value: bd.meta.view?.ref.up || UP } },
    vertexShader: petalVert, fragmentShader: petalFrag, transparent: true, depthWrite: false, depthTest: true,
    blending: NormalBlending, premultipliedAlpha: true, toneMapped: false,
  });
  const petals = new Mesh(g, mat);
  petals.frustumCulled = false;
  petals.renderOrder = 12; // (after the cut-out laid over him and what is round him, camp3d.js: they fall in front of it all)
  return {
    objects: [petals],
    update(now) {
      mat.uniforms.uTime.value = now;
    },
    dispose() {
      g.dispose();
      mat.dispose();
    },
  };
}
