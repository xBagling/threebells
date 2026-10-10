// The 3D view's render targets and its final pass (docs/3D-PLAN.md 3.5, 5.7).
//
// The scene is drawn into a low-resolution target, k device pixels per texel, with nearest
// filtering and a depth texture; the telegraph markings are drawn into a second target of the same
// size. The final pass runs once per display pixel: it enlarges the scene with hard edges, shifted
// by the camera's part-texel offset so motion stays smooth, grades it (vignette, the hurt edge, the
// heal glow), and only then lays the markings on top, so nothing can dim a marking.
//
// Colour: the scene target is stored as sRGB (so dark greens do not band) and read back as linear;
// the final pass encodes to sRGB itself and composites the markings in sRGB, as 2D's canvas does,
// so a marking's colour and alpha mean the same as in 2D.
import { WebGLRenderTarget, DepthTexture, NearestFilter, LinearFilter, HalfFloatType, SRGBColorSpace, NoColorSpace, ShaderMaterial, UnsignedIntType, Vector2, Vector3, FullScreenQuad } from "./three-lib.js?v=df092a6";

const FINAL = {
  uniforms: () => ({
    tScene: { value: null },
    tDecal: { value: null },
    uTex: { value: new Vector2(1, 1) },
    uOff: { value: new Vector2(0, 0) },
    uView: { value: new Vector2(1, 1) },
    uK: { value: 1 },
    uVig: { value: 0.75 },
    uHurt: { value: 0 },
    uHurtCol: { value: new Vector3(0.5, 0.05, 0.07) },
    uHeal: { value: 0 },
    uLift: { value: 0 },
    uFocus: { value: new Vector2(0.5, 0.5) },
    tBloom: { value: null },
    uBloom: { value: 0.35 },
    tFade: { value: null },
    uFade: { value: 0 },
    uGrade: { value: 1 },
    // A lighting mood's grade (moods3d.js), neutral by default: exposure, saturation, contrast, and
    // split toning (shadows towards one colour, highlights towards another).
    uExpo: { value: 1 },
    uSat: { value: 1 },
    uCon: { value: 1 },
    uShadowCol: { value: new Vector3(0, 0, 0) },
    uShadowAmt: { value: 0 },
    uHiCol: { value: new Vector3(1, 1, 1) },
    uHiAmt: { value: 0 },
    uVigCol: { value: new Vector3(0.55, 0.66, 0.66) },
    // Smoothing (the bench's &upscale= &fxaa=): how the low-resolution scene is enlarged — 0 hard
    // texels (the default), 1 smooth (bilinear), 2 sharp-bilinear (crisp texels, a one-pixel soft
    // step between them) — and an FXAA pass over the scene's edges.
    uFilt: { value: 0 },
    uFxaa: { value: 0 },
  }),
  vertexShader: /* glsl */ `
    void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene;
    uniform sampler2D tDecal;
    uniform vec2 uTex;
    uniform vec2 uOff;
    uniform vec2 uView;
    uniform float uK;
    uniform float uVig;
    uniform float uHurt;
    uniform vec3 uHurtCol;
    uniform float uHeal;
    uniform float uLift;
    uniform vec2 uFocus;
    uniform sampler2D tBloom;
    uniform float uBloom;
    uniform sampler2D tFade;
    uniform float uFade;
    uniform float uGrade;
    uniform float uExpo;
    uniform float uSat;
    uniform float uCon;
    uniform vec3 uShadowCol;
    uniform float uShadowAmt;
    uniform vec3 uHiCol;
    uniform float uHiAmt;
    uniform vec3 uVigCol;
    uniform float uFilt;
    uniform float uFxaa;
    // FXAA (after Lottes' FXAA 3.11, the small console form) on the scene texture, px = one texel.
    vec3 fxaa(vec2 uv, vec2 px) {
      vec3 cM = texture2D(tScene, uv).rgb;
      const vec3 W = vec3(0.299, 0.587, 0.114);
      float lNW = dot(texture2D(tScene, uv + vec2(-1.0, -1.0) * px).rgb, W);
      float lNE = dot(texture2D(tScene, uv + vec2(1.0, -1.0) * px).rgb, W);
      float lSW = dot(texture2D(tScene, uv + vec2(-1.0, 1.0) * px).rgb, W);
      float lSE = dot(texture2D(tScene, uv + vec2(1.0, 1.0) * px).rgb, W);
      float lM = dot(cM, W);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, -8.0, 8.0) * px;
      vec3 A = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 B = A * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
      float lB = dot(B, W);
      return (lB < lMin || lB > lMax) ? A : B;
    }
    vec3 toSRGB(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    void main() {
      // Display pixel (y down) -> texel of the low-resolution scene.
      vec2 X = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
      vec2 t = (X - uOff) / uK;
      if (uFilt > 1.5) {
        // Sharp-bilinear: flat across each texel, a soft step one display pixel wide at its edge.
        vec2 q = t - 0.5;
        vec2 i = floor(q);
        vec2 fr = clamp((q - i - 0.5) * max(uK, 1.0) + 0.5, 0.0, 1.0);
        t = i + fr + 0.5;
      }
      vec2 uv = vec2(t.x / uTex.x, 1.0 - t.y / uTex.y);
      vec3 c = uFxaa > 0.5 ? fxaa(uv, 1.0 / uTex) : texture2D(tScene, uv).rgb;
      // Props that would hide the fight, drawn on their own layer, laid over at each one's own
      // opacity (its alpha there: 1 easing to 0.35; 4.11).
      if (uFade > 0.0) {
        vec4 fl = texture2D(tFade, uv);
        c = mix(c, fl.rgb, fl.a * uFade);
      }
      // Bloom, only from true light sources (the emissive layer), sampled smoothly.
      if (uBloom > 0.0) c += texture2D(tBloom, uv).rgb * uBloom;
      c = toSRGB(c * uExpo);
      // The grade (3D-PLAN 5.7): shadows lean teal, highlights warm, a little more contrast and
      // saturation; analytic, no lookup file. Then the lifted-shadow option for the look test.
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, vec3(0.055, 0.165, 0.165), 0.12 * (1.0 - smoothstep(0.0, 0.45, lum)) * uGrade);
      c = mix(c, vec3(1.0, 0.89, 0.604), 0.08 * smoothstep(0.5, 1.0, lum) * uGrade);
      c = mix(vec3(lum), c, mix(1.0, 1.03, uGrade));
      c = (c - 0.4) * mix(1.0, 1.08, uGrade) + 0.4;
      c = c + (1.0 - c) * uLift * 0.12;
      // The mood's grade (neutral unless a mood sets it).
      float ml = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, uShadowCol, uShadowAmt * (1.0 - smoothstep(0.0, 0.5, ml)));
      c = mix(c, uHiCol, uHiAmt * smoothstep(0.45, 1.0, ml));
      ml = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(ml), c, uSat);
      c = (c - 0.45) * uCon + 0.45;
      // The vignette, centred on the action (the camera's focus), not the screen: to about 60% at
      // the corners, a touch teal.
      vec2 q = (gl_FragCoord.xy - uFocus) / uView.y;
      float r2 = dot(q, q);
      float v = uVig * smoothstep(0.05, 0.5, r2);
      c = mix(c, c * uVigCol, v);
      // The hurt edge (2D's hurtAmt) and the heal glow.
      float edge = smoothstep(0.06, 0.42, r2);
      c = mix(c, uHurtCol, uHurt * edge);
      c += vec3(0.56, 1.0, 0.82) * uHeal * 0.12;
      // The markings, after the grade: premultiplied, in sRGB.
      vec4 d = texture2D(tDecal, uv);
      c = c * (1.0 - d.a) + d.rgb;
      // A 1/255 ordered dither against banding in the dark gradients.
      vec2 bp = mod(floor(gl_FragCoord.xy), 4.0);
      float bay = mod(bp.x * 4.0 + bp.y * 11.0, 16.0) / 16.0 - 0.47;
      c += bay / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

// The bloom chain (3D-PLAN 5.6): the dual-filter method. A 13-tap downsample that blurs as it goes
// (three levels, from half the low-resolution size), then 9-tap tent upsamples that add as they go.
const DOWN = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst;
  varying vec2 vUv;
  void main() {
    vec2 t = uTexel;
    vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb, b = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb, c = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
    vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb, e = texture2D(tSrc, vUv).rgb, f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
    vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb, h = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb, i = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
    vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb, k = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb, l = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb, m = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
    vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    gl_FragColor = vec4(max(o, 0.0), 1.0);
  }
`;
const UP = /* glsl */ `
  uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec2 t = uTexel;
    vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
    s += (texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, t.y)).rgb) * 2.0;
    s += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
    gl_FragColor = vec4(s / 16.0 + texture2D(tAdd, vUv).rgb, 1.0);
  }
`;
const VUV = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function makePost(renderer, aa = {}) {
  // Smoothing options (the bench's &upscale=linear|sharp, &msaa=4, &fxaa=1); none by default.
  const filt = aa.upscale === "sharp" ? 2 : aa.upscale === "linear" ? 1 : 0;
  const smooth = filt > 0 || aa.fxaa;
  const sceneFilter = smooth ? LinearFilter : NearestFilter;
  let scene = null;
  let decal = null;
  let emissive = null; // the glow layer, drawn against the scene's own depth
  let fade = null; // the faded props (4.11), with their own depth
  let levels = []; // bloom: [half, quarter, eighth] down, then the ups
  const downMat = new ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uFirst: { value: 0 } }, vertexShader: VUV, fragmentShader: DOWN, depthTest: false, depthWrite: false });
  const upMat = new ShaderMaterial({ uniforms: { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new Vector2() } }, vertexShader: VUV, fragmentShader: UP, depthTest: false, depthWrite: false });
  const downQuad = new FullScreenQuad(downMat);
  const upQuad = new FullScreenQuad(upMat);
  const rt = (w, h) => new WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: false, type: HalfFloatType });
  const mat = new ShaderMaterial({ uniforms: FINAL.uniforms(), vertexShader: FINAL.vertexShader, fragmentShader: FINAL.fragmentShader, depthTest: false, depthWrite: false, toneMapped: false });
  const quad = new FullScreenQuad(mat);

  function ensure(W, H) {
    if (scene && scene.width === W && scene.height === H) return;
    scene?.dispose();
    scene?.depthTexture?.dispose();
    decal?.dispose();
    scene = new WebGLRenderTarget(W, H, { minFilter: sceneFilter, magFilter: sceneFilter, generateMipmaps: false, depthBuffer: true, colorSpace: SRGBColorSpace, samples: aa.msaa || 0 });
    scene.depthTexture = new DepthTexture(W, H);
    scene.depthTexture.type = UnsignedIntType;
    decal = new WebGLRenderTarget(W, H, { minFilter: sceneFilter, magFilter: sceneFilter, generateMipmaps: false, depthBuffer: false, colorSpace: NoColorSpace });
    emissive?.dispose();
    emissive = new WebGLRenderTarget(W, H, { minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: true, type: HalfFloatType });
    fade?.dispose();
    fade = new WebGLRenderTarget(W, H, { minFilter: sceneFilter, magFilter: sceneFilter, generateMipmaps: false, depthBuffer: true, colorSpace: SRGBColorSpace });
    emissive.depthTexture = scene.depthTexture; // nothing hidden may glow
    for (const l of levels) l.dispose();
    levels = [rt(W >> 1, H >> 1), rt(W >> 2, H >> 2), rt(W >> 3, H >> 3), rt(W >> 2, H >> 2), rt(W >> 1, H >> 1)];
  }
  /** Blur the glow layer down and back up (5 passes); the final pass samples the last. */
  function bloom() {
    let src = emissive.texture;
    let sw = emissive.width;
    let sh = emissive.height;
    for (let i = 0; i < 3; i++) {
      downMat.uniforms.tSrc.value = src;
      downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      renderer.setRenderTarget(levels[i]);
      downQuad.render(renderer);
      src = levels[i].texture;
      sw = levels[i].width;
      sh = levels[i].height;
    }
    for (let i = 0; i < 2; i++) {
      upMat.uniforms.tSrc.value = src;
      upMat.uniforms.tAdd.value = levels[1 - i].texture;
      upMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      renderer.setRenderTarget(levels[3 + i]);
      upQuad.render(renderer);
      src = levels[3 + i].texture;
      sw = levels[3 + i].width;
      sh = levels[3 + i].height;
    }
    return src;
  }

  return {
    ensure,
    get scene() {
      return scene;
    },
    get decal() {
      return decal;
    },
    get emissive() {
      return emissive;
    },
    get fade() {
      return fade;
    },
    /** The final pass to the canvas. `f` is the frame from cameraFrame; `vw, vh` the canvas size. */
    finish(f, vw, vh, grade) {
      const u = mat.uniforms;
      u.tScene.value = scene.texture;
      u.tDecal.value = decal.texture;
      u.uBloom.value = grade.bloom ?? 0.35;
      u.tFade.value = fade.texture;
      u.uFade.value = grade.fade ? 1 : 0;
      if (u.uBloom.value > 0) u.tBloom.value = bloom();
      u.uTex.value.set(f.W, f.H);
      u.uOff.value.set(f.offX, f.offY);
      u.uView.value.set(vw, vh);
      u.uK.value = f.k;
      u.uFilt.value = filt;
      u.uFxaa.value = aa.fxaa ? 1 : 0;
      u.uHurt.value = grade.hurt || 0;
      u.uHeal.value = grade.heal || 0;
      u.uVig.value = grade.vignette ?? 0.75;
      u.uLift.value = grade.lift || 0;
      u.uGrade.value = grade.grade ?? 1;
      const m = grade.mood || {};
      u.uExpo.value = m.exposure ?? 1;
      u.uSat.value = m.saturation ?? 1;
      u.uCon.value = m.contrast ?? 1;
      u.uShadowCol.value.set(...(m.shadowCol ?? [0, 0, 0]));
      u.uShadowAmt.value = m.shadowAmt ?? 0;
      u.uHiCol.value.set(...(m.hiCol ?? [1, 1, 1]));
      u.uHiAmt.value = m.hiAmt ?? 0;
      u.uVigCol.value.set(...(m.vigCol ?? [0.55, 0.66, 0.66]));
      // The focus sits at the middle of the camera's safe rectangle (3D-PLAN 3.2), GL's y up.
      if (grade.focus) u.uFocus.value.set(grade.focus[0], vh - grade.focus[1]);
      renderer.setRenderTarget(null);
      quad.render(renderer);
    },
    dispose() {
      scene?.dispose();
      scene?.depthTexture?.dispose();
      decal?.dispose();
      emissive?.dispose();
      fade?.dispose();
      for (const l of levels) l.dispose();
      mat.dispose();
      quad.dispose();
      downMat.dispose();
      upMat.dispose();
      downQuad.dispose();
      upQuad.dispose();
    },
  };
}
