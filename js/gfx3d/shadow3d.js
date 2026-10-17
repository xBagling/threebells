// The projected character shadow (the owner, 2026-10-12: "a shadow that perfectly mimics my character's animations and
// automatically wraps over complex 3D geometry like stairs or slopes, while giving me 100% manual control over its
// direction, length, and skew, entirely independent of the scene's actual lighting"). The render-texture-and-projector way:
//
//   1. Silhouette: for each caster (the hero, the boss) a hidden orthographic camera looks at him along the shadow's own
//      direction and draws only his meshes (their own layer, SIL_LAYER + i) as a flat white shape into a small render
//      texture of its own, with its depth (how far along the shadow's direction each of his points is). Every bone and
//      cloth fold he has this frame is in it: the shadow is his animation.
//   2. Projection: one full-screen pass over the frame. Each pixel's world position is rebuilt from the scene's own depth
//      (post.scene.depthTexture: the floor, the stairs, a wall, the painted backdrops' per-pixel depth) and projected into
//      each caster's silhouette camera; where it lands inside his shape and lies beyond him along the shadow's direction,
//      it is in his shadow. So the shadow lies over whatever is drawn there: a step's riser and tread, a slope, a wall.
//   3. Control: `params` (live, any frame): rotation (degrees round the vertical, the way the shadow falls), length (shadow
//      length / his height on flat ground), stretch and skew (in the shadow's own plane), offset (world units on the
//      ground), opacity, softness (blur, in silhouette texels), reach (how far beyond him a surface can still take it),
//      tint. Nothing reads the scene's lights.
//   4. Culling: his own pixels never take it — a mask of the casters drawn through the main camera, tested against the
//      scene's depth (so only where he is actually seen), is cut out of the shadow; and the casters are left out of every
//      silhouette but their own, so the hero is never shadowed by the boss's silhouette landing on him.
//
// The pass writes the shadow's strength into its own target (post.shadow); post3d.js multiplies the scene by the tint
// there before the grade, so it darkens as a shadow does, under the markings and the bloom.
import {
  OrthographicCamera, WebGLRenderTarget, DepthTexture, UnsignedIntType, NearestFilter, LinearFilter, MeshBasicMaterial,
  ShaderMaterial, Matrix4, Vector2, Vector3, Vector4, Color, FullScreenQuad,
} from "./three-lib.js?v=79a60b0-466c2a40";
import { passView } from "./passview.js?v=79a60b0-466c2a40";

export const SIL_LAYER = 6; // (casters: layers 6, 7, …; 0 main, 1 glow, 2 fade are the renderer's)
const MAXC = 2;

/** The look the owner tunes (window.__shadows.params in the browser; dev-fight.html &shrot= &shlen= … — render3d.js). */
export const SHADOW_DEFAULTS = {
  on: true,
  rotation: 10, // degrees: the way the shadow falls, round the vertical from the world's +x (45: straight down the screen, -45: to its right; 10: down and to the right)
  length: 1.0, // shadow length on flat ground / his height (the light's elevation: atan(1 / length))
  stretch: 1, // in the shadow's own plane, along its length
  skew: 0, // shear across its length, per unit along it
  offset: [0, 0], // world units on the ground
  opacity: 0.62, // (0.45 darkened the cobbles by 22 of 255 on average: lost in their pattern)
  softness: 1.5, // blur radius, silhouette texels
  reach: 70, // world units beyond him along its direction where it fades out (a wall far behind takes none)
  tint: [0.16, 0.18, 0.28], // what fully shadowed ground is multiplied by
};

// A model's tree changes now and then — the hero's equip (hero3d.js) swaps his weapon's meshes in and out under his hand —
// and every node of a caster is listened to once for it (three.js's childadded / childremoved), so the casters are tagged
// again only when that happens, not walked twice a frame (render3d.js reads the same count for its own one-time tags).
const watched = new WeakSet();
let treeGen = 0;
const bump = () => treeGen++;
/** Listen to every node under `root` for children added or removed (once a node); the count `treeGeneration` goes up then. */
export function watchTree(root) {
  root?.traverse((o) => {
    if (watched.has(o)) return;
    watched.add(o);
    o.addEventListener("childadded", bump);
    o.addEventListener("childremoved", bump);
  });
}
export const treeGeneration = () => treeGen;

const RECV = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #define MAXC ${MAXC}
    uniform sampler2D tDepth;          // the scene's depth
    uniform sampler2D tMask;           // the casters as the main camera sees them
    uniform sampler2D tSil[MAXC];      // each caster's silhouette (r: coverage)
    uniform sampler2D tSilD[MAXC];     // and its depth along the shadow's direction
    uniform mat4 uSilVP[MAXC];         // world -> each silhouette camera's clip space
    uniform vec4 uAnchor[MAXC];        // his feet in that clip space (xy), the offset there (zw)
    uniform float uSpan[MAXC];         // the silhouette camera's far - near (world units)
    uniform mat2 uWarp;                // stretch and skew, inverse, in the silhouette's plane
    uniform int uN;
    uniform mat4 uInvProj, uCamWorld;  // the main camera
    uniform float uOpacity, uSoft, uReach;
    uniform vec2 uTexel;               // one silhouette texel
    uniform vec2 uScr;                 // one screen texel
    uniform sampler2D tRecv;           // (Camp 2.0) the painting's own depth (R high, G low byte, as camp3d.js reads it)
    uniform float uRecv;               //   on (1) or off
    uniform vec4 uRecvRect;            //   the screen's crop of the painting (u0, v0, du, dv; v down)
    uniform vec2 uRecvRange;           //   its planar depth's range (z0, z1)
    uniform vec2 uRecvHero;            //   his feet's planar depth; the depth camp3d.js gives what covers him (his middle + 10)
    uniform float uRecvFeetY;          //   the height of the ground under his feet (world)
    varying vec2 vUv;
    float sil(int i, vec2 uv) {
      // (an array of samplers is indexed by a constant only, in WebGL 1's rules)
      if (i == 0) return texture2D(tSil[0], uv).r;
      return texture2D(tSil[1], uv).r;
    }
    float silD(int i, vec2 uv) {
      if (i == 0) return texture2D(tSilD[0], uv).r;
      return texture2D(tSilD[1], uv).r;
    }
    void main() {
      float d = texture2D(tDepth, vUv).r;
      // (nothing drawn there — but on a painting, the owner's Clear ("never covers him") is drawn at no depth at all: the
      // painting's own depth is the surface there; the owner, 2026-10-14: "it is nog visible in the bog", most of whose floor he
      // had cleared)
      bool none = d >= 0.99999;
      if (none && uRecv < 0.5) { gl_FragColor = vec4(0.0); return; }
      // (a caster: never on himself — nor on the 2 px round him: his ink outline is a hull pushed out in its own shader, which
      // the flat mask does not draw, and a shadow traced it as a dark line through whatever covers him)
      vec2 mt = 2.0 * uScr;
      float mk = texture2D(tMask, vUv).r;
      mk = max(mk, max(texture2D(tMask, vUv + vec2(mt.x, 0.0)).r, texture2D(tMask, vUv - vec2(mt.x, 0.0)).r));
      mk = max(mk, max(texture2D(tMask, vUv + vec2(0.0, mt.y)).r, texture2D(tMask, vUv - vec2(0.0, mt.y)).r));
      if (mk > 0.5) { gl_FragColor = vec4(0.0); return; }
      vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, none ? 0.0 : d * 2.0 - 1.0, 1.0);
      vec3 V = v.xyz / v.w;
      float fade = 1.0;
      // (the camp: the surface is the painting's own depth. camp3d.js writes a depth for whether he is hidden, not for what is
      // there — round him it moves the picture back behind him (the mask alone decides what covers him) — and his shadow,
      // cast on that, fell on a wall standing behind him: a long streak straight down from his feet instead of down and to
      // the right over the ground (the owner, 2026-10-14: "the shadow of the character seems broken now"). The picture is
      // only ever moved back, never forward, so the nearer of the two is the true surface — and a thing of the scene's own
      // standing in front of the picture keeps its depth)
      if (uRecv > 0.5) {
        vec2 pu = vec2(uRecvRect.x + vUv.x * uRecvRect.z, uRecvRect.y + (1.0 - vUv.y) * uRecvRect.w);
        vec4 dq = texture2D(tRecv, pu);
        float pq = floor(dq.r * 255.0 + 0.5) * 256.0 + floor(dq.g * 255.0 + 0.5);
        float ps = uRecvRange.x + pq / 65534.0 * (uRecvRange.y - uRecvRange.x);
        if (none) {
          // (the painting's own depth along this pixel's ray: none past its edge or where it has none, the sky)
          if (pq > 65534.5 || pu.x < 0.0 || pu.y < 0.0 || pu.x > 1.0 || pu.y > 1.0) { gl_FragColor = vec4(0.0); return; }
          V *= ps / -V.z;
        }
        // (what covers him — a thing in front of him by the one truth, the mask — camp3d.js moves to his middle + 10 round him:
        // his shadow never lands on it, as it never could on a thing between him and the camera; the owner, 2026-10-14: "the
        // shadow stills show up on things that are in front of the hero sometimes")
        // (only a pixel moved there — its own depth far from that one — is such a thing: ground that truly lies at that depth
        // lost his shadow too, a stripe cut across it 10 behind his middle; the owner, 2026-10-14: "in the camp there are some
        // issues with it")
        if (abs(-V.z - uRecvHero.y) < 0.6 && abs(ps + V.z) > 1.0) { gl_FragColor = vec4(0.0); return; }
        if (ps < -V.z) V *= ps / -V.z;
        // (nor on anything nearer the camera than his feet: the camp's light comes from the camera's side, so his shadow falls
        // away behind him — a lantern roof below and before him took a dark patch from the painting's rough depth there)
        fade = smoothstep(uRecvHero.x - 3.0, uRecvHero.x - 1.0, -V.z);
      }
      vec3 P = (uCamWorld * vec4(V, 1.0)).xyz;
      // (but the ground he stands on always takes it: cut at his feet's depth, the half of his shadow on the near side of them
      // went too — a sliver with a hard straight lower edge, a dark line across the flowers; the owner, 2026-10-14: "in the
      // camp there are some issues with it". Only what rises 1.5+ over his feet — a roof, a rail — keeps the cut)
      if (uRecv > 0.5) fade = max(fade, 1.0 - smoothstep(1.5, 3.0, P.y - uRecvFeetY));
      if (fade <= 0.0) { gl_FragColor = vec4(0.0); return; }
      float s = 0.0;
      for (int i = 0; i < MAXC; i++) {
        if (i >= uN) break;
        vec4 c = uSilVP[i] * vec4(P, 1.0);
        vec2 q = uAnchor[i].xy + uWarp * (c.xy + uAnchor[i].zw - uAnchor[i].xy);   // (the receiver taken back through the offset, stretch and skew)
        vec2 uv = q * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue;
        float rz = c.z * 0.5 + 0.5;
        // soft edge: 9 taps in a ring of uSoft texels
        float cov = 0.0, near = 1.0;
        for (int k = 0; k < 9; k++) {
          float a = float(k) * 0.6981317;   // (2 pi / 9)
          vec2 o = k == 0 ? vec2(0.0) : vec2(cos(a), sin(a)) * uSoft * uTexel;
          float cv = sil(i, uv + o);
          cov += cv;
          if (cv > 0.5) near = min(near, silD(i, uv + o));
        }
        cov /= 9.0;
        if (cov <= 0.0) continue;
        // only beyond him along its direction (a roof between him and the "light" takes none), fading out over uReach
        float behind = (rz - near) * (i == 0 ? uSpan[0] : uSpan[1]);
        float k = smoothstep(-1.5, 0.5, behind) * (1.0 - smoothstep(uReach * 0.6, uReach, behind));
        s = max(s, cov * k);
      }
      gl_FragColor = vec4(0.0, 0.0, 0.0, s * fade * uOpacity);
    }
  `,
};

export function makeProjectedShadows(gl, { size = 384 } = {}) {
  // (this renderer's own: render3d.js wraps its shader with uniforms of the renderer's (figWrap) — one material shared by every
  // renderer kept the first, destroyed one's, and the next fight's or Camp 2.0's mask was drawn with that one's frozen values)
  const silMat = new MeshBasicMaterial({ color: 0xffffff });
  const params = { ...SHADOW_DEFAULTS, offset: [...SHADOW_DEFAULTS.offset], tint: [...SHADOW_DEFAULTS.tint] };
  const casters = Array.from({ length: MAXC }, () => {
    const rt = new WebGLRenderTarget(size, size, { minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: true });
    rt.depthTexture = new DepthTexture(size, size);
    rt.depthTexture.type = UnsignedIntType;
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = NearestFilter;
    return { rt, cam: new OrthographicCamera(-1, 1, 1, -1, 0.1, 400), vp: new Matrix4(), anchor: new Vector4(), on: false };
  });
  let mask = null, out = null;
  const mat = new ShaderMaterial({
    uniforms: {
      tDepth: { value: null }, tMask: { value: null },
      tSil: { value: casters.map((c) => c.rt.texture) }, tSilD: { value: casters.map((c) => c.rt.depthTexture) },
      uSilVP: { value: casters.map((c) => c.vp) }, uAnchor: { value: casters.map((c) => c.anchor) }, uSpan: { value: casters.map(() => 1) },
      uWarp: { value: [1, 0, 0, 1] }, uN: { value: 0 },
      uInvProj: { value: new Matrix4() }, uCamWorld: { value: new Matrix4() },
      uOpacity: { value: 0.5 }, uSoft: { value: 1 }, uReach: { value: 70 }, uTexel: { value: new Vector2(1 / size, 1 / size) }, uScr: { value: new Vector2(1, 1) },
      tRecv: { value: null }, uRecv: { value: 0 }, uRecvRect: { value: new Vector4() }, uRecvRange: { value: new Vector2() }, uRecvHero: { value: new Vector2() }, uRecvFeetY: { value: 0 },
    },
    vertexShader: RECV.vertexShader, fragmentShader: RECV.fragmentShader, depthTest: false, depthWrite: false,
  });
  const quad = new FullScreenQuad(mat);
  const tmp = new Vector3(), dir = new Vector3(), foot = new Vector3(), off = new Vector4(), prevClear = new Color();
  // (the screen rectangle the shadows can fall in: scissorRect)
  const invVP = new Matrix4(), camVP = new Matrix4(), corner = new Vector4(), rect = [0, 0, 0, 0];
  /**
   * Where on the target (texels, y up) a caster's shadow can land at all: the receiver pass gives a pixel some only when its
   * surface point lies in his silhouette camera's square (the stretch, skew and offset taken back through) and from 1.5
   * units before his silhouette to `reach` behind its far end — a box, whose corners through the main camera bound every
   * pixel whose ray meets it. The pass ran over the whole frame for a shadow on a few percent of it (2026-10-16). Grown into
   * `rect`; false if a corner lies behind the camera (then the whole frame, as before).
   */
  function growRect(S, warp, span, camera, W, H) {
    invVP.copy(S.vp).invert();
    camVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    // (the shader's q = A + M (c + Z - A) in [-1, 1]: c = M^-1 (q - A) + A - Z; M column-major [a, b, c, d])
    const [a, b, c, d] = warp, det = a * d - c * b;
    if (Math.abs(det) < 1e-9) return false;
    const A = S.anchor, ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
    // (rz from -1.5 / span to 1 + reach / span: clip z = 2 rz - 1)
    const zs = [2 * (-1.5 / span) - 1, 2 * (1 + params.reach / span) - 1];
    for (const qx of [-1, 1])
      for (const qy of [-1, 1])
        for (const cz of zs) {
          const ux = qx - A.x, uy = qy - A.y;
          const cx = ia * ux + ic * uy + A.x - A.z, cy = ib * ux + id * uy + A.y - A.w;
          corner.set(cx, cy, cz, 1).applyMatrix4(invVP);
          corner.multiplyScalar(1 / corner.w).setW(1).applyMatrix4(camVP);
          if (corner.w <= 1e-6) return false;
          const sx = ((corner.x / corner.w) * 0.5 + 0.5) * W, sy = ((corner.y / corner.w) * 0.5 + 0.5) * H;
          rect[0] = Math.min(rect[0], sx), rect[1] = Math.min(rect[1], sy), rect[2] = Math.max(rect[2], sx), rect[3] = Math.max(rect[3], sy);
        }
    return true;
  }
  const tagged = Array.from({ length: MAXC }, () => ({ a: null, b: null, gen: -1 })); // (what each slot was tagged for)

  /**
   * Mark a caster's meshes for its silhouette (layer SIL_LAYER + i) and the mask; meshes with userData.noShadow skipped, and
   * the ink outlines' hulls (materials3d.js outlineMaterial): drawn with silMat they are the very body under them again, the
   * same skinned shape (a hull is pushed out only in its own shader) — every skinned body was drawn twice in each pass. Only
   * when the slot's casters or a caster's tree changed (watchTree).
   */
  function tag(objs, i) {
    const T = tagged[i], a = objs[0] || null, b = objs[1] || null;
    if (T.a === a && T.b === b && T.gen === treeGen) return;
    for (const o of objs) {
      watchTree(o);
      o?.traverse((m) => {
        if (!m.isMesh) return;
        for (let k = 0; k < MAXC; k++) m.layers.disable(SIL_LAYER + k);
        if (!m.userData.noShadow && !m.material?.userData?.outline) m.layers.enable(SIL_LAYER + i);
      });
    }
    // (another slot that had these casters lost them just now: tagged again when it next draws them)
    for (const U of tagged) if (U !== T && ((a && (U.a === a || U.b === a)) || (b && (U.a === b || U.b === b)))) U.gen = -1;
    (T.a = a), (T.b = b), (T.gen = treeGen);
  }

  return {
    params,
    /** The flat material the casters are drawn with (silhouettes and the mask): render3d.js gives it the camp's one-figure depth. */
    silMat,
    /** (Camp 2.0, render3d.js campFrame) the painting's depth as the surface: { tex, rect: the screen's crop of it, range } or null. */
    recv: null,
    /** The target post3d.js multiplies the scene by (a: the shadow's strength), or null when there is none this frame. */
    get target() {
      return out;
    },
    get tint() {
      return params.tint;
    },
    /**
     * One frame. `list`: up to two casters, each { objects: [Object3D…], at: [x, y, z] his feet (world), h: his height,
     * r: how far round him the silhouette must reach (his swings, his cape) } — or null. `depthTex` is the scene's depth,
     * `camera` the main one, W x H the scene's size.
     */
    render(scene, camera, list, depthTex, W, H) {
      out = null;
      if (!params.on || !list?.length) return;
      // (the mask shares the scene's depth: made again whenever that is)
      if (!mask || mask.width !== W || mask.height !== H || mask.depthTexture !== depthTex) {
        mask?.dispose();
        mask = new WebGLRenderTarget(W, H, { minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false, depthBuffer: true });
        mask.depthTexture = depthTex;
        this._out?.dispose();
        this._out = new WebGLRenderTarget(W, H, { minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: false });
      }
      // the shadow's direction: falling `rotation` round the vertical, `length` per unit of height
      const a = (params.rotation * Math.PI) / 180;
      dir.set(Math.cos(a) * params.length, -1, Math.sin(a) * params.length).normalize();
      const prevOverride = scene.overrideMaterial, prevTarget = gl.getRenderTarget(), prevLayers = camera.layers.mask;
      gl.getClearColor(prevClear);
      const prevAlpha = gl.getClearAlpha();
      const sw = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      scene.overrideMaterial = silMat;
      gl.setClearColor(0x000000, 0);
      let n = 0;
      for (let ci = 0; ci < list.length && ci < MAXC; ci++) {
        const c = list[ci];
        const S = casters[n];
        tag(c.objects, n);
        // the silhouette camera: square to the shadow's direction, round his middle, wide enough for him and his swings
        const r = c.r;
        foot.set(c.at[0], c.at[1], c.at[2]);
        tmp.set(c.at[0], c.at[1] + c.h * 0.5, c.at[2]);
        S.cam.left = S.cam.bottom = -r;
        S.cam.right = S.cam.top = r;
        S.cam.near = 1;
        S.cam.far = 200 + r * 2;
        S.cam.position.copy(tmp).addScaledVector(dir, -(100 + r));
        S.cam.up.set(0, 1, 0);
        if (Math.abs(dir.y) > 0.999) S.cam.up.set(1, 0, 0);
        S.cam.lookAt(tmp);
        S.cam.updateProjectionMatrix();
        S.cam.updateMatrixWorld(true);
        S.cam.layers.set(SIL_LAYER + n);
        S.vp.multiplyMatrices(S.cam.projectionMatrix, S.cam.matrixWorldInverse);
        // his feet (offset on the ground) in that camera: the stretch and skew are about them
        tmp.copy(foot).applyMatrix4(S.vp);
        off.set(foot.x - params.offset[0], foot.y, foot.z - params.offset[1], 1).applyMatrix4(S.vp);
        S.anchor.set(tmp.x, tmp.y, off.x - tmp.x, off.y - tmp.y);
        mat.uniforms.uSpan.value[n] = S.cam.far - S.cam.near;
        gl.setRenderTarget(S.rt);
        gl.clear(true, true, false);
        gl.render(passView(scene, "shadow"), S.cam); // (its own light state, the matrices left as the main pass made them: passview.js)
        n++;
      }
      // the mask: every caster through the main camera, only where the scene shows him (its own depth: equal or nearer)
      camera.layers.disableAll();
      for (let i = 0; i < n; i++) camera.layers.enable(SIL_LAYER + i);
      gl.setRenderTarget(mask);
      gl.clear(true, false, false);
      silMat.depthFunc = 3; // (LessEqualDepth; pulled a hair toward the camera, so his own depth always passes)
      silMat.depthWrite = false;
      silMat.polygonOffset = true;
      silMat.polygonOffsetFactor = -1;
      silMat.polygonOffsetUnits = -4;
      gl.render(passView(scene, "shadow"), camera);
      silMat.depthWrite = true;
      silMat.polygonOffset = false;
      camera.layers.mask = prevLayers;
      scene.overrideMaterial = prevOverride;
      gl.shadowMap.autoUpdate = sw;
      // the receivers
      const u = mat.uniforms;
      u.tDepth.value = depthTex;
      u.tMask.value = mask.texture;
      u.uN.value = n;
      u.uInvProj.value.copy(camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(camera.matrixWorld);
      u.uOpacity.value = params.opacity;
      u.uSoft.value = params.softness;
      u.uReach.value = params.reach;
      const rc = this.recv;
      u.uRecv.value = rc ? 1 : 0;
      if (rc) {
        u.tRecv.value = rc.tex;
        u.uRecvRect.value.fromArray(rc.rect);
        u.uRecvRange.value.fromArray(rc.range);
        u.uRecvHero.value.set(rc.near ?? -1e9, rc.cover ?? -1e9);
        u.uRecvFeetY.value = rc.feetY ?? -1e9;
      }
      u.uScr.value.set(1 / W, 1 / H);
      // stretch along its length (the silhouette's up, y) and skew across it, as the inverse the shader takes the receiver
      // back through (column-major mat2: [a, b, c, d] is ((a, c), (b, d)))
      const st = Math.max(0.05, params.stretch), sk = params.skew;
      const wp = u.uWarp.value;
      (wp[0] = 1), (wp[1] = 0), (wp[2] = -sk / st), (wp[3] = 1 / st);
      gl.setRenderTarget(this._out);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, false, false);
      // (only over where the shadows can fall — growRect; the rest stays cleared, as the pass left it before)
      rect[0] = rect[1] = Infinity;
      rect[2] = rect[3] = -Infinity;
      let fit = true;
      for (let i = 0; i < n && fit; i++) fit = growRect(casters[i], wp, mat.uniforms.uSpan.value[i], camera, W, H);
      const x0 = Math.max(0, Math.floor(rect[0]) - 2), y0 = Math.max(0, Math.floor(rect[1]) - 2);
      const x1 = Math.min(W, Math.ceil(rect[2]) + 2), y1 = Math.min(H, Math.ceil(rect[3]) + 2);
      if (fit && x1 > x0 && y1 > y0) {
        this._out.scissor.set(x0, y0, x1 - x0, y1 - y0);
        this._out.scissorTest = true;
        gl.setRenderTarget(this._out); // (the target's scissor takes effect as it is bound)
      }
      if (!fit || (x1 > x0 && y1 > y0)) quad.render(gl);
      this._out.scissorTest = false;
      gl.setRenderTarget(prevTarget);
      gl.setClearColor(prevClear, prevAlpha);
      out = this._out;
    },
    /** (checks) How much of each silhouette, the mask and the shadow layer is lit: sums of their first channel / alpha. */
    probe() {
      const sum = (rt, ch) => {
        const b = new Uint8Array(rt.width * rt.height * 4);
        gl.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, b);
        let t = 0;
        for (let i = ch; i < b.length; i += 4) t += b[i];
        return Math.round(t / 255);
      };
      return { sil: casters.map((c) => sum(c.rt, 0)), mask: mask ? sum(mask, 0) : null, shadow: this._out ? sum(this._out, 3) : null };
    },
    dispose() {
      for (const c of casters) {
        c.rt.depthTexture.dispose();
        c.rt.dispose();
      }
      mask?.dispose();
      this._out?.dispose();
      mat.dispose();
      silMat.dispose();
      quad.dispose();
    },
  };
}
