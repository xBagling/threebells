import {
  Bt,
  ja,
  _i,
  Qa,
  eo,
  vi,
  yi,
  tn,
  Ls,
  bt,
  mn,
  Ch,
  kn,
  we,
  Ct,
  U,
  et,
  Pe,
  Se,
  Xe,
  ot,
  gn,
  Tt,
  os,
  Fn,
  ks,
  ol,
  aa,
  Kt,
  dl,
  oa
} from "./main-6mhe1mqq.js?v=88e40de-1ff3b19c";
import {
  rng,
  ARENA
} from "./main-4hwc579a.js?v=88e40de-1ff3b19c";
import {
  BACK,
  RIGHT,
  UP
} from "./main-drnmg1te.js?v=88e40de-1ff3b19c";

// site/js/gfx3d/materials3d.js
function makeLookUniforms() {
  const white = new os(new Uint8Array([255, 255, 255, 255]), 1, 1, mn);
  white.needsUpdate = true;
  const grey = new os(new Uint8Array([128, 128, 128, 255]), 1, 1, mn);
  grey.needsUpdate = true;
  return {
    uSunMask: { value: white },
    uSunMaskScale: { value: new et(1 / 320, 1 / 320, 0.5, 0.5) },
    uSunDrift: { value: new we(0, 0) },
    uPool: { value: new et(0, 0, 60, 40) },
    uPoolOn: { value: 0 },
    uAlbedo: { value: 0 },
    uPoolFloor: { value: 0.3 },
    uNoise: { value: grey },
    uNoiseAmt: { value: 0.07 },
    uBandLo: { value: new et(0.1, 0.34, 0.64, 0) },
    uBandVal: { value: new et(0, 0.34, 0.68, 1) },
    uShadeTint: { value: new U(0.62, 1.12, 1.12) },
    uLitTint: { value: new Se(16771488) },
    uLant: { value: Array.from({ length: 8 }, () => new et) },
    uLantCount: { value: 0 },
    uLantColor: { value: new Se(16754240) },
    uLantRange: { value: 60 },
    uLantPower: { value: 30 },
    uWind: { value: new et(0.7, 0.7, 0, 0) },
    uWindAmp: { value: 0.3 },
    uTexelWorld: { value: 0.5 },
    uWindStep: { value: 0 },
    uFadeMask: { value: 0 },
    uFadeMode: { value: 0 },
    tSceneDepth: { value: null },
    uFadeTex: { value: new we(1, 1) },
    uFadeA: { value: new Float32Array(17).fill(1) },
    uFlatR: { value: 120 }
  };
}
var PARS_VERTEX = `
  uniform vec4 uWind;
  uniform float uWindAmp;
  uniform float uTexelWorld;
  uniform float uWindStep;
  uniform float uFlatR;
  varying vec3 vPaintWorld;
  #ifdef PAINT_GROUP
    attribute float aGroup;
    varying float vGroup;
  #endif
  #ifdef PAINT_WIND
    vec3 paintWind(vec3 world, float h) {
      float t = uWind.w;
      if (uWindStep > 0.5) t = floor(t * 9.0) / 9.0;
      float ph = dot(world.xz, vec2(0.071, 0.053));
      float s = sin(t * 1.7 + ph) * 0.55 + sin(t * 2.9 + ph * 1.7) * 0.3 + sin(t * 4.3 + ph * 0.6) * 0.15;
      float g = 0.35 + uWind.z * 0.65;
      float amp = min(uWindAmp, uTexelWorld * (uWindStep > 0.5 ? 1.0 : 0.5));
      float sway = s * g * amp * h;
      if (uWindStep > 0.5) sway = floor(sway / uTexelWorld + 0.5) * uTexelWorld;
      return vec3(uWind.x * sway, 0.0, uWind.y * sway);
    }
  #endif
`;
var PROJECT = `
  vec4 pw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    pw = instanceMatrix * pw;
  #endif
  pw = modelMatrix * pw;
  #ifdef PAINT_WIND
    #if PAINT_WIND == 1
      float wh = clamp(position.y / 4.0, 0.0, 1.0); // grass and flowers: bend grows with height²
      pw.xyz += paintWind(pw.xyz, wh * wh);
    #else
      pw.xyz += paintWind(pw.xyz, 1.0); // cards: the whole card sways
    #endif
  #endif
  vPaintWorld = pw.xyz;
  #ifdef PAINT_GROUP
    vGroup = aGroup;
  #endif
  vec4 mvPosition = viewMatrix * pw;
  #ifdef PAINT_FLATTEN
    // Lawn ground cover writes the depth of the ground it covers (2·Y further along the view), so
    // the telegraph layer paints over it as over bare ground. 95% of it (1.9·Y): a twentieth of the
    // relief is kept, at most 0.3 units at the flowers' 3-unit cap (layout3d.js LAWN_CAP; clovers
    // 0.2 at their 2, tufts 0.13 at 1.3; the markings allow 1.5), so a prop's own parts keep their
    // order; flattened all the way, every part at a texel wrote the same depth and
    // a clover's outline hull, drawn after it, showed through its leaves in black bands.
    vec4 root = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
      root = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    #endif
    if (length(root.xz) < uFlatR) mvPosition.z -= 1.9 * max(pw.y, 0.0);
  #endif
  gl_Position = projectionMatrix * mvPosition;
`;
var PARS_FRAGMENT = `
  uniform sampler2D uSunMask;
  uniform vec4 uSunMaskScale;
  uniform vec2 uSunDrift;
  uniform vec4 uPool;
  uniform float uPoolOn;
  uniform float uAlbedo;
  uniform float uPoolFloor;
  uniform sampler2D uNoise;
  uniform float uNoiseAmt;
  uniform vec4 uBandLo;
  uniform vec4 uBandVal;
  uniform vec3 uShadeTint;
  uniform vec3 uLitTint;
  uniform vec4 uLant[8];
  uniform int uLantCount;
  uniform vec3 uLantColor;
  uniform float uLantRange;
  uniform float uLantPower;
  uniform float uLantK;
  uniform float uLantWrap;
  uniform float uLantSat;
  uniform float uLantTop;
  uniform vec3 uLantTint;
  uniform vec3 uLantGreen;
  uniform vec3 uShadeFill;
  #ifdef PAINT_SHADELIFT
    uniform vec3 uShadeLift;
  #endif
  #ifdef PAINT_SUNRIM
    uniform vec3 uSunRim;
    uniform float uSunRimEdge;
  #endif
  uniform int uFadeMask;
  uniform int uFadeMode;
  uniform sampler2D tSceneDepth;
  uniform vec2 uFadeTex;
  uniform float uFadeA[17];
  uniform float uFlash;
  uniform vec3 uFlashCol; // (what the flash turns him to: white, the hero's hurt a light red — hero3d.js)
  uniform vec4 uFlashAt; // (where a blow struck, world, and how far round it the flash reaches — 0: the whole body)
  uniform vec3 uTintCol;
  uniform float uTintAmt;
  uniform float uRipeRim; // (the riposte open, on a dark boss: a gold rim round her and a warm lift — render3d.js ripe)
  uniform float uAlpha;
  uniform float uDissolve;
  uniform float uCrystalGlow; // (the Crystal Crab's crystals lit from inside: his phases, render3d.js)
  uniform vec2 uBurnY;
  uniform vec2 uSinkY; // (a hole he is in: the floor's height and how far under it he is all dark — render3d.js, crabrise3d.js)
  uniform vec3 uFill;
  uniform vec3 uRimCol;
  uniform float uRimAmt;
  uniform vec3 uBackRim;
  varying vec3 vPaintWorld;
  #ifdef PAINT_GROUP
    varying float vGroup;
  #endif
  float gSunBand = 0.0;
  float gSunNdl = 0.0;
  float paintNoise() {
    #ifdef PAINT_UVNOISE
      // three names the varying after the map it serves (r152+): vMapUv with a texture, vUv without.
      #if defined( USE_MAP )
        return texture2D(uNoise, vMapUv * 3.0).r - 0.5;
      #elif defined( USE_UV )
        return texture2D(uNoise, vUv * 3.0).r - 0.5;
      #else
        return 0.0;
      #endif
    #else
      return texture2D(uNoise, vPaintWorld.xz / 23.0).r - 0.5;
    #endif
  }
  float sunMaskAt() {
    // Higher points sample further from the sun, like a real canopy's shadow (the sun is at 65°,
    // from sim −y, which is −Z here).
    vec2 p = vPaintWorld.xz + vec2(0.0, vPaintWorld.y * 0.4663) + uSunDrift;
    float m = texture2D(uSunMask, p * uSunMaskScale.xy + uSunMaskScale.zw).r;
    if (uPoolOn > 0.5) {
      vec2 d = vPaintWorld.xz - uPool.xy;
      vec2 q = vec2(dot(d, vec2(0.7071, -0.7071)) / uPool.z, dot(d, vec2(0.7071, 0.7071)) / uPool.w);
      float env = 1.0 - smoothstep(0.55, 1.0, length(q)); // (smoothstep with edge0 > edge1 is undefined in GLSL ES)
      m *= mix(uPoolFloor, 1.0, env);
    }
    return m;
  }
  float bandOf(float x) {
    return x < uBandLo.x ? uBandVal.x : x < uBandLo.y ? uBandVal.y : x < uBandLo.z ? uBandVal.z : uBandVal.w;
  }
  void RE_Direct_Paint(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
    float ndl = dot(geometryNormal, directLight.direction);
    #if NUM_DIR_LIGHTS > 0
      if (all(equal(directLight.direction, directionalLights[0].direction))) {
        // The sun: N·L, the shadow and the dapples, combined, then stepped.
        vec3 full = directionalLights[0].color;
        float sh = clamp(dot(directLight.color, vec3(1.0)) / max(dot(full, vec3(1.0)), 1e-4), 0.0, 1.0);
        #ifdef PAINT_CHAR_SMOOTH
          // (a painted creature: the sun turns smoothly over him too, no stepped, brush-jagged bands — Gnasher's cream belly
          // took a hard pale stripe across it)
          float lit = min(max(ndl, 0.0), sh) * sunMaskAt();
          float band = mix(uBandVal.x, uBandVal.w, smoothstep(uBandLo.x - 0.1, uBandLo.z + 0.15, lit));
        #else
          float lit = min(max(ndl, 0.0), sh) * sunMaskAt() + paintNoise() * uNoiseAmt * 2.0;
          float band = bandOf(lit);
        #endif
        gSunBand = band;
        gSunNdl = ndl;
        vec3 warm = mix(vec3(1.0), uLitTint, 0.1 * band);
        reflectedLight.directDiffuse += full * band * warm * BRDF_Lambert(material.diffuseColor);
        return;
      }
    #endif
    // Everything else (the dynamic pool: hit flashes, casts): two soft steps.
    float l = smoothstep(0.0, 0.25, ndl) * 0.6 + smoothstep(0.35, 0.6, ndl) * 0.4;
    reflectedLight.directDiffuse += directLight.color * l * BRDF_Lambert(material.diffuseColor);
  }
  void RE_IndirectDiffuse_Paint(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
  }
  #define RE_Direct RE_Direct_Paint
  #define RE_IndirectDiffuse RE_IndirectDiffuse_Paint
`;
var OUTGOING = `
  #ifdef PAINT_GROUP
    {
      int g = int(vGroup + 0.5);
      bool faded = g > 0 && ((uFadeMask >> g) & 1) == 1;
      if (uFadeMode == 0 && faded) discard;
      if (uFadeMode == 1 && !faded) discard;
      // In the fade layer, only where the prop is in front of what the main pass drew there.
      if (uFadeMode == 1 && texture2D(tSceneDepth, gl_FragCoord.xy / uFadeTex).r < gl_FragCoord.z) discard;
    }
  #endif
  // Shade leans teal where the sun does not reach.
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), uShadeTint, 0.35 * (1.0 - gSunBand));
  #ifdef PAINT_FILL
    // A flat fill after the tint: the wall's stone faces the camera from the sun's shade side, where
    // the teal sky alone leaves it black; the painting keeps it a readable blue-grey (V30, V32).
    reflectedLight.indirectDiffuse += uShadeFill * BRDF_Lambert(diffuseColor.rgb);
  #endif
  #ifdef PAINT_SHADELIFT
    // Deep shade on the ground (the lowest sun band: a canopy's or a leaf's shadow outside the
    // pool, a body's shadow): the teal sky alone leaves the dark greens black, holes punched in the
    // lawn; the painting keeps that shade a dark green (#101c12-#1b2c1a). Only in band 0, so the
    // lit and half-lit ground keeps its colours.
    reflectedLight.indirectDiffuse += uShadeLift * BRDF_Lambert(diffuseColor.rgb) * (1.0 - step(0.01, gSunBand));
  #endif
  #ifdef PAINT_SUNRIM
    // The sun's lit edge on a trunk (V27: bark #141112 with a lit right edge #83611d). The sun
    // stands behind the fight and a little to the screen's right, so a trunk's screen-right side
    // is the one it catches; outside the pool, under the canopy's own shadow, the plain sun term
    // leaves that side black where the painting keeps a hard warm edge. A flat band where the view
    // normal leans right past uSunRimEdge (jagged by the brush noise), only on the sun's side.
    {
      float rimE = step(uSunRimEdge, normalize(normal).x + paintNoise() * uNoiseAmt * 2.0) * step(0.0, gSunNdl);
      reflectedLight.directDiffuse += uSunRim * rimE * BRDF_Lambert(diffuseColor.rgb);
    }
  #endif
  // The lanterns: one analytic term (docs/3D-PLAN.md 4.10). Per material: uLantWrap wraps N·L
  // (0.2), uLantK scales the term (1), uLantTop adds that much more on up-facing surfaces (0),
  // uLantSat > 0 rolls the summed light off softly towards 1 / uLantSat, so near two lanterns it
  // does not add up past the lit colour, and uLantTint colours the flame's light on up-facing
  // surfaces (white). The wall's stone sets all of them (props3d.js STONE_LIGHT). uLantTop and
  // uLantTint go in by N.y and only on a warm albedo (green no more than red): the stone's tops,
  // not its green moss or its blue-grey blocks. uLantGreen colours the flame's light on a green
  // albedo (green well over red, blue well under green: the moss on the stone), whichever way it
  // faces: the orange flame times green moss comes out ochre, where the painting keeps the moss
  // beside a lantern yellow-green. The blue-grey blocks keep the plain term.
  #ifndef PAINT_NOLANT
  {
    vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      if (i >= uLantCount) break;
      if (uLant[i].w <= 0.0) continue; // an unlit lantern (Low lights only the nearest four)
      vec3 L = uLant[i].xyz - vPaintWorld;
      float d = length(L);
      float cut = pow(clamp(1.0 - pow(d / uLantRange, 4.0), 0.0, 1.0), 2.0);
      float fall = cut / (1.0 + d * d * 0.004);
      float wrapNL = max((dot(nW, L / max(d, 1e-3)) + uLantWrap) / (1.0 + uLantWrap), 0.0);
      acc += uLant[i].w * fall * wrapNL;
    }
    // Which light a surface takes goes by its flat albedo (the colour times the vertex colour), not
    // the painted texel: a ratio cell's lighter or yellower texels would otherwise drop out of the
    // green class (the moss tops' lit dabs came out ochre beside L2 and L3) or into the warm one.
    vec3 lantAlb = diffuse;
    #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
      lantAlb *= vColor.rgb;
    #endif
    float gr = lantAlb.g / max(lantAlb.r, 1e-4);
    float up = max(nW.y, 0.0) * (1.0 - smoothstep(0.95, 1.15, gr));
    float green = smoothstep(1.1, 1.25, gr) * (1.0 - smoothstep(0.4, 0.7, lantAlb.b / max(lantAlb.g, 1e-4)));
    acc *= 1.0 + uLantTop * up;
    if (uLantSat > 0.0) acc = (1.0 - exp(-acc * uLantSat)) / uLantSat;
    vec3 lantTint = mix(mix(vec3(1.0), uLantTint, up), uLantGreen, green);
    reflectedLight.directDiffuse += uLantColor * lantTint * acc * uLantPower * uLantK * BRDF_Lambert(diffuseColor.rgb);
  }
  #endif
  #ifdef PAINT_CHAR
    // The character light. The sun stands behind the fight (the far side), so the side of a
    // character the camera sees gets no sun and would sink into the teal shade (the painted hero
    // came out nearly black but for the top of his hood). A fill from the camera's side, up and to
    // the left, stepped into three flat bands with the same brush-jagged edges as the sun's, keeps
    // the painted colours readable and gives the body form. uFill is its colour and strength: faint
    // by default; the painted characters set their own (hero3d.js, boss3d.js). View space, so it
    // lights what the camera sees at any camera.
    // The painted characters' texture is already the lit painting (projected from painted views), so
    // the light here only shapes it: every light on the character (the sun on its band, the
    // lanterns, the sky, the fill) is summed as a multiplier on the paint, and that multiplier is
    // (a) mostly grey: only PAINT_CHAR_TINT of the light's own colour reaches the paint, so the
    // golden sun and the warm fill cannot turn the teal hood green or the steel cream, and (b) on a
    // soft knee to at most PAINT_CHAR_MAX× the paint, so a light-grey pauldron in the sun stays steel
    // and never passes white. PAINT_CHAR_SAT (1 = the paint's own) mutes a character's colour, the
    // toad's lime towards the target's green. The side towards the camera (the fill alone) comes out
    // at about half the paint's light, the target's shade; a face in the sun at about the paint.
    // The character sets all three as defines (hero3d.js, boss3d.js); steel keeps its own roll-off.
    #ifndef PAINT_CHAR_MAX
      #define PAINT_CHAR_MAX 1.15
    #endif
    #ifndef PAINT_CHAR_TINT
      #define PAINT_CHAR_TINT 0.2
    #endif
    #ifndef PAINT_CHAR_SAT
      #define PAINT_CHAR_SAT 1.0
    #endif
    {
      float fl = dot(normalize(normal), vec3(-0.4472, 0.6261, 0.6389)) + paintNoise() * uNoiseAmt * 2.0;
      #ifdef PAINT_CHAR_SMOOTH
        // (a painted creature's form turns smoothly: the three stepped bands, brush-jagged at their edges, cut hard
        // stair-stepped patches across Gnasher's cream jaw and belly — the owner, 2026-10-14: "bad jagging coloring around
        // the mouth")
        float fb = mix(0.34, 1.0, smoothstep(-0.6, 0.65, dot(normalize(normal), vec3(-0.4472, 0.6261, 0.6389))));
      #else
        float fb = fl < -0.15 ? 0.34 : fl < 0.3 ? 0.68 : 1.0;
      #endif
      #ifndef PAINT_METAL
        vec3 kAll = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(1e-3)) + uFill * fb;
        float kY = max(dot(kAll, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
        vec3 kHue = mix(vec3(1.0), kAll / kY, float(PAINT_CHAR_TINT));
        float kOut = float(PAINT_CHAR_MAX) * (1.0 - exp(-kY / float(PAINT_CHAR_MAX)));
        // PAINT_CHAR_PALE: a pale, unsaturated paint (the toad's cream belly) keeps that much more of
        // its light, so dimming a character's greens does not grey its belly (0 for the hero: his
        // light steel must not brighten).
        float paleK = 0.0;
        #if defined(PAINT_CHAR_PALE)
        {
          vec3 c0 = diffuseColor.rgb;
          float mx = max(max(c0.r, c0.g), c0.b);
          float sat0 = (mx - min(min(c0.r, c0.g), c0.b)) / max(mx, 1e-3);
          // (pale and warm-to-neutral: the belly's cream, which the painted views keep between
          // about 0.25 and 0.6 saturation; a grey or a pale green is not lifted)
          float pale = smoothstep(0.25, 0.5, dot(c0, vec3(0.2126, 0.7152, 0.0722))) * (1.0 - smoothstep(0.6, 0.85, sat0)) * smoothstep(-0.02, 0.04, c0.r - c0.b);
          paleK = pale;
          kOut = min(kOut * (1.0 + pale * float(PAINT_CHAR_PALE)), float(PAINT_CHAR_MAX));
          // The cream never sinks to grey: in the fill's lowest band the sac and belly read grey
          // with a hard stair-stepped edge against the lit cream (G10 re-review), where the 2D
          // frames and the target shade it only a little. A floor under its light, and its own
          // colour kept (not muted with the greens). The floor follows the fill's direction smoothly
          // (no bands), so the sac and belly keep their round form.
          #ifdef PAINT_CHAR_SMOOTH
            kOut = max(kOut, pale * (0.58 + 0.3 * smoothstep(-0.6, 0.7, dot(normalize(normal), vec3(-0.4472, 0.6261, 0.6389)))) * float(PAINT_CHAR_MAX));
          #else
            kOut = max(kOut, pale * (0.58 + 0.3 * smoothstep(-0.6, 0.7, fl)) * float(PAINT_CHAR_MAX));
          #endif
        }
        #endif
        #ifdef PAINT_CHAR_HILITE
          // The paint's own highlights kept bright (the Crystal Crab, 2026-10-25, the owner: "make sure that the highlights are
          // brighter"): his skin is ChatGPT's hand-painted repaint, its glints, glassy crystal and glowing windows painted in,
          // and the knee above showed them at 63-80% of the paint — his brightest 5% rendered at L 79-82 where the approved
          // sheet's are at 91. Where the paint itself is bright, the light is at least PAINT_CHAR_HILITE x the paint (from paint
          // luminance 0.65, fully at 0.95: from 0.45 a fifth of him passed L 85 and his brights clipped white; this way 9%, as the
          // sheet, brightest 5% at L 93-96).
          kOut = mix(kOut, max(kOut, float(PAINT_CHAR_HILITE)), smoothstep(0.65, 0.95, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))));
        #endif
        vec3 paintC = diffuseColor.rgb;
        paintC = mix(vec3(dot(paintC, vec3(0.2126, 0.7152, 0.0722))), paintC, mix(float(PAINT_CHAR_SAT), 1.0, paleK));
        reflectedLight.directDiffuse = paintC * kHue * kOut;
        reflectedLight.indirectDiffuse = vec3(0.0);
      #else
        vec3 k = reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(1e-3));
        reflectedLight.directDiffuse = diffuseColor.rgb * 1.6 * (vec3(1.0) - exp(-k / 1.6));
        reflectedLight.directDiffuse += uFill * fb * diffuseColor.rgb;
        // Steel (sword3d.js defines PAINT_METAL, its cap). In a cut the blade's flats turn to the
        // sky (the edge leading) and take the sun on its knee, the fill and the sky at once: several
        // times the paint, and the silver blows out to pure white. On steel the light rolls off
        // from 80% of PAINT_METAL× the paint to at most PAINT_METAL× it, so the blade keeps its
        // silver, its bright edge line and its darker fuller at every angle.
        vec3 kl = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb, vec3(1e-3));
        float kmax = float(PAINT_METAL);
        float k0 = 0.8 * kmax;
        vec3 kc = mix(kl, k0 + (kmax - k0) * (vec3(1.0) - exp(-(kl - k0) / (kmax - k0))), step(k0, kl));
        vec3 ks = kc / max(kl, vec3(1e-3));
        reflectedLight.directDiffuse *= ks;
        reflectedLight.indirectDiffuse *= ks;
      #endif
    }
  #endif
  vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
  #ifdef PAINT_CHAR
    // The rim: a hard band on the sun side's silhouette.
    // Only the true silhouette: a faceted mesh has oblique faces everywhere, and a looser test gilds it all.
    float rim = step(0.74, 1.0 - max(dot(normal, geometryViewDir), 0.0)) * step(0.3, gSunNdl);
    #ifdef PAINT_METAL
      outgoingLight = mix(outgoingLight, uRimCol, rim * uRimAmt);
    #else
      // The paint's own colour lit a little past the knee and leaning to the rim's warmth: a lighter
      // teal edge on the cape, a bright steel one on the pauldron, never a flat cream band.
      outgoingLight = mix(outgoingLight, diffuseColor.rgb * float(PAINT_CHAR_MAX) * 1.25 * mix(vec3(1.0), uRimCol, 0.5) + uRimCol * 0.02, rim * uRimAmt);
    #endif
  #endif
  #ifdef PAINT_BACKRIM
    // The light from behind him (the Bog Shrine's lanterns stand behind the fight): a warm band round his whole outline,
    // strongest on what faces up, soft at its inner edge — his reference's gold rim (the owner's pick, 2026-10-14: "make
    // sure that the lightning and everything else matches the reference image")
    {
      float fr = 1.0 - max(dot(normal, geometryViewDir), 0.0);
      float br = smoothstep(0.55, 0.88, fr) * (0.15 + 0.85 * smoothstep(-0.1, 0.6, normal.y));
      outgoingLight += uBackRim * br * (0.35 + 0.65 * diffuseColor.rgb / max(max(diffuseColor.r, diffuseColor.g), 0.05));
    }
  #endif
  if (uAlbedo > 0.5) outgoingLight = diffuseColor.rgb;
  if (uCrystalGlow > 0.0) {
    // (his crystal — the pink to violet of his painted skin, saturated, rose and blue over green — lit from inside as his fight
    // goes on: "The cathedral's bells begin to hum", 2026-10-28, his polish pass)
    vec3 dc = diffuseColor.rgb;
    float mx = max(max(dc.r, dc.g), dc.b), sat = (mx - min(min(dc.r, dc.g), dc.b)) / max(mx, 0.01);
    float crystal = smoothstep(0.12, 0.32, sat) * smoothstep(0.0, 0.08, min(dc.r, dc.b) - dc.g) * smoothstep(0.25, 0.6, mx);
    outgoingLight += vec3(1.0, 0.5, 0.85) * crystal * uCrystalGlow;
  }
  // (down in a hole — the Crystal Crab climbing out of the salt: lit full under the floor, he showed bright down in the dark; the
  // hole's own walls go near black by 45 under, crabrise3d.js)
  if (uSinkY.y > 0.0) outgoingLight *= mix(1.0, 0.05, smoothstep(0.0, uSinkY.y, uSinkY.x - vPaintWorld.y));
  outgoingLight = mix(outgoingLight, uTintCol, uTintAmt);
  if (uRipeRim > 0.0) {
    // (a blend toward gold lifted Sister Cinder's near-black robe to a pale grey ghost through her whole stagger: on a dark boss the
    // pulse is a gold band round her outline and a warm lift of what is lit, her darks kept dark — the visual audit, 2026-10-29)
    float fr = 1.0 - max(dot(normal, geometryViewDir), 0.0);
    outgoingLight = outgoingLight * (1.0 + vec3(0.9, 0.55, 0.12) * uRipeRim) + vec3(1.0, 0.7, 0.28) * smoothstep(0.5, 0.95, fr) * 0.55 * uRipeRim;
  }
  // (a big boss flashes where he was struck, not all over: the Crystal Crab, 102 tall, went white across a quarter of the phone's
  // screen at every cut of a combo — the visual audit, 2026-10-29)
  float flashK = uFlashAt.w > 0.0 ? 1.0 - smoothstep(uFlashAt.w * 0.5, uFlashAt.w, distance(vPaintWorld, uFlashAt.xyz)) : 1.0;
  outgoingLight = mix(outgoingLight, uFlashCol, uFlash * flashK);
  diffuseColor.a *= uAlpha;
  if (uDissolve > 0.0) {
    vec2 c = mod(floor(gl_FragCoord.xy), 2.0);
    float b = (c.x + c.y * 2.0 + 0.5) / 4.0;
    if (uDissolve > b) discard;
  } else if (uDissolve < 0.0) {
    // Burning away (a negative uDissolve, 0 to -1: Sister Cinder's death and her arrival out of the fire, render3d.js poseToad
    // — her polish pass, 2026-10-20): the fire eats her from her hood down to her hem (uBurnY: her feet's height and her own),
    // through brush noise, a charred band and an ember-bright edge before each part goes — not the dither fade.
    float k = -uDissolve;
    float hgt = clamp((vPaintWorld.y - uBurnY.x) / max(1.0, uBurnY.y), 0.0, 1.0);
    // (coarse noise and a wide band: fine noise read as glitter at the fight's distance)
    float v = texture2D(uNoise, vPaintWorld.xz / 22.0 + vPaintWorld.y / 30.0).r * 0.5 + hgt * 0.5;
    float th = 1.02 - k * 1.1;
    if (v > th) discard;
    outgoingLight = mix(outgoingLight, vec3(0.05, 0.04, 0.04), smoothstep(th - 0.26, th - 0.1, v) * 0.85);
    outgoingLight += mix(vec3(0.9, 0.18, 0.03), vec3(1.0, 0.6, 0.18), smoothstep(th - 0.1, th, v)) * smoothstep(th - 0.1, th - 0.02, v) * 2.2;
  }
`;
var GROUND_SHADE_LIFT = [0.85, 0.6, 1.1];
function paintMaterial(look, { color = 16777215, map = null, vertexColors = false, alphaTest = 0, side, wind = 0, flatten = false, group = false, char = false, emissive = 0, lantLit = true, fill = null, lant = null, sunRim = null, shadeLift = null } = {}) {
  const m = new dl({ color, map, vertexColors, alphaTest, emissive });
  if (side !== undefined)
    m.side = side;
  if (char && map)
    map.anisotropy = Math.max(map.anisotropy, 4);
  const own = {
    uFlash: { value: 0 },
    uFlashCol: { value: new Se(1, 1, 1) },
    uFlashAt: { value: new et(0, 0, 0, 0) },
    uTintCol: { value: new Se(9148088) },
    uTintAmt: { value: 0 },
    uRipeRim: { value: 0 },
    uAlpha: { value: 1 },
    uDissolve: { value: 0 },
    uCrystalGlow: { value: 0 },
    uBurnY: { value: new we(0, 34) },
    uSinkY: { value: new we(0, 0) },
    uFill: { value: new Se(2760726) },
    uRimCol: { value: new Se(16633121) },
    uRimAmt: { value: char ? 0.85 : 0 },
    uBackRim: { value: new Se(0) },
    uShadeFill: { value: Array.isArray(fill) ? new Se(...fill) : new Se(fill ?? 0) },
    uLantK: { value: lant?.k ?? 1 },
    uLantWrap: { value: lant?.wrap ?? 0.2 },
    uLantSat: { value: lant?.sat ?? 0 },
    uLantTop: { value: lant?.top ?? 0 },
    uLantTint: { value: new Se(...lant?.tint ?? [1, 1, 1]) },
    uLantGreen: { value: new Se(...lant?.green ?? [1, 1, 1]) }
  };
  if (sunRim) {
    own.uSunRim = { value: new Se(...sunRim.light) };
    own.uSunRimEdge = { value: sunRim.edge ?? 0.55 };
  }
  if (shadeLift)
    own.uShadeLift = { value: new Se(...shadeLift) };
  m.userData.paint = own;
  m.defines = { ...m.defines || {} };
  if (wind)
    m.defines.PAINT_WIND = wind;
  if (flatten)
    m.defines.PAINT_FLATTEN = 1;
  if (group)
    m.defines.PAINT_GROUP = 1;
  if (char)
    m.defines.PAINT_CHAR = 1;
  if (!lantLit)
    m.defines.PAINT_NOLANT = 1;
  if (char)
    m.defines.PAINT_UVNOISE = 1;
  if (fill != null)
    m.defines.PAINT_FILL = 1;
  if (sunRim)
    m.defines.PAINT_SUNRIM = 1;
  if (shadeLift)
    m.defines.PAINT_SHADELIFT = 1;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, look, own);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
${PARS_VERTEX}`).replace("#include <project_vertex>", PROJECT);
    sh.fragmentShader = sh.fragmentShader.replace("#include <lights_toon_pars_fragment>", `#include <lights_toon_pars_fragment>
#undef RE_Direct
#undef RE_IndirectDiffuse
${PARS_FRAGMENT}`).replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;", OUTGOING).replace("#include <dithering_fragment>", `#include <dithering_fragment>
#ifdef PAINT_GROUP
if (uFadeMode == 1) gl_FragColor.a = uFadeA[int(vGroup + 0.5)];
#endif`);
  };
  m.customProgramCacheKey = () => `paint:${wind}:${flatten}:${group}:${char}:${char}:${lantLit}:${fill != null}:${!!sunRim}:${!!shadeLift}`;
  return m;
}
function charLight(m, L) {
  const p = m.userData.paint;
  p.uFill.value.setHex(L.fill).multiplyScalar(L.fillAmt);
  p.uRimCol.value.setHex(L.rim);
  p.uRimAmt.value = L.rimAmt;
  m.defines.PAINT_CHAR_MAX = L.max.toFixed(3);
  m.defines.PAINT_CHAR_TINT = L.tint.toFixed(3);
  m.defines.PAINT_CHAR_SAT = L.sat.toFixed(3);
  if (L.pale)
    m.defines.PAINT_CHAR_PALE = L.pale.toFixed(3);
  if (L.hilite)
    m.defines.PAINT_CHAR_HILITE = L.hilite.toFixed(3);
  if (L.smooth)
    m.defines.PAINT_CHAR_SMOOTH = 1;
  if (L.backRim) {
    m.defines.PAINT_BACKRIM = 1;
    p.uBackRim.value.setHex(L.backRim).multiplyScalar(L.backRimAmt ?? 1);
  }
}
function paintDepth(look, { wind = 0, map = null, alphaTest = 0 } = {}) {
  const m = new oa({ depthPacking: Ch, map, alphaTest });
  if (wind) {
    m.defines = { PAINT_WIND: wind };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, look);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
${PARS_VERTEX}`).replace("#include <project_vertex>", PROJECT);
    };
    m.customProgramCacheKey = () => `paintdepth:${wind}`;
  }
  return m;
}
function outlineMaterial(look, { color = 1052427, warm = 5917200, px = 1.3, group = false } = {}) {
  const m = new gn({ color, side: Bt });
  const own = { uView: { value: new we(480, 1030) }, uPx: { value: px }, uWarm: { value: new Se(warm) }, uSun: { value: new U(0, 0.906, -0.423).normalize() }, uAlpha: { value: 1 }, uBurn: { value: 0 }, uBurnY: { value: new we(0, 34) } };
  m.userData.outline = own;
  if (group)
    m.defines = { PAINT_GROUP: 1 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, look, own);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
         uniform vec2 uView; uniform float uPx; uniform vec3 uSun; varying float vWarm; varying float vOutY;
         #ifdef PAINT_GROUP
           attribute float aGroup; varying float vGroup;
         #endif`).replace("#include <beginnormal_vertex>", `vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`).replace("#include <project_vertex>", `vec4 pw = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           pw = instanceMatrix * pw;
         #endif
         pw = modelMatrix * pw;
         vOutY = pw.y;
         // On a skinned mesh objectNormal is already skinned (skinnormal_vertex ran above); a plain
         // basic material never declares it, so it reads the attribute.
         #if defined( USE_SKINNING ) || defined( USE_ENVMAP )
           vec4 nw4 = vec4(objectNormal, 0.0);
         #else
           vec4 nw4 = vec4(normal, 0.0);
         #endif
         #ifdef USE_INSTANCING
           nw4 = instanceMatrix * nw4;
         #endif
         vec3 nW = normalize((modelMatrix * nw4).xyz);
         vWarm = step(0.35, dot(nW, uSun));
         #ifdef PAINT_GROUP
           vGroup = aGroup;
         #endif
         vec4 mvPosition = viewMatrix * pw;
         gl_Position = projectionMatrix * mvPosition;
         vec2 cn = (projectionMatrix * viewMatrix * vec4(nW, 0.0)).xy;
         if (dot(cn, cn) > 1e-10) gl_Position.xy += normalize(cn) * uPx * 2.0 / uView * gl_Position.w;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
         uniform vec3 uWarm; uniform float uAlpha; uniform float uBurn; uniform vec2 uBurnY; varying float vOutY; uniform int uFadeMask; uniform int uFadeMode; uniform sampler2D tSceneDepth; uniform vec2 uFadeTex; uniform float uFadeA[17]; varying float vWarm;
         #ifdef PAINT_GROUP
           varying float vGroup;
         #endif`).replace("vec4 diffuseColor = vec4( diffuse, opacity );", `vec4 diffuseColor = vec4( mix(diffuse, uWarm, vWarm), opacity * uAlpha );
         if (uBurn > 0.0 && 0.25 + 0.5 * clamp((vOutY - uBurnY.x) / max(1.0, uBurnY.y), 0.0, 1.0) > 1.02 - uBurn * 1.1 - 0.08) discard;
         #ifdef PAINT_GROUP
           { int g = int(vGroup + 0.5); bool faded = g > 0 && ((uFadeMask >> g) & 1) == 1;
             if (uFadeMode == 0 && faded) discard; if (uFadeMode == 1 && !faded) discard;
             if (uFadeMode == 1 && texture2D(tSceneDepth, gl_FragCoord.xy / uFadeTex).r < gl_FragCoord.z) discard; }
         #endif`).replace("#include <dithering_fragment>", `#include <dithering_fragment>
#ifdef PAINT_GROUP
if (uFadeMode == 1) gl_FragColor.a = uFadeA[int(vGroup + 0.5)];
#endif`);
  };
  m.customProgramCacheKey = () => `outline:${group}`;
  return m;
}
function makeBrushNoise(rand, size = 128) {
  const data = new Uint8Array(size * size * 4);
  const cells = [8, 16, 32].map((n) => ({ n, v: Float32Array.from({ length: n * n }, () => rand()) }));
  for (let y = 0;y < size; y++)
    for (let x = 0;x < size; x++) {
      let s = 0;
      let wsum = 0;
      for (const [i, { n, v }] of cells.entries()) {
        const fx = x / size * n;
        const fy = y / size * n;
        const x0 = Math.floor(fx) % n;
        const y0 = Math.floor(fy) % n;
        const x1 = (x0 + 1) % n;
        const y1 = (y0 + 1) % n;
        const tx = fx - Math.floor(fx);
        const ty = fy - Math.floor(fy);
        const a = v[y0 * n + x0] * (1 - tx) + v[y0 * n + x1] * tx;
        const b = v[y1 * n + x0] * (1 - tx) + v[y1 * n + x1] * tx;
        const w = 1 / (i + 1);
        s += (a * (1 - ty) + b * ty) * w;
        wsum += w;
      }
      const g = Math.round(s / wsum * 255);
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = g;
      data[o + 3] = 255;
    }
  const t = new os(data, size, size, mn);
  t.wrapS = t.wrapT = vi;
  t.magFilter = bt;
  t.needsUpdate = true;
  return t;
}
// site/art3d/meadow.layout.json
var meadow_layout_default = {
  _about: "Where every prop of the 3D garden stands (docs/3D-PLAN.md 4.2). Edit and reload: r is the distance from the arena's centre and th the angle in degrees (0 = towards the camera's right, sim +x; 90 = sim +y, towards the camera's left). Sizes are in sim units. The layout tests (bun tools/test.mjs, 'The 3D garden') check every rule after an edit: nothing solid on the sim's floor (r < 119) and nothing that does not fade may hide the lawn.",
  lanterns: [
    { id: "L1", r: 124, th: -126 },
    { id: "L2", r: 124, th: -113 },
    { id: "L3", r: 160, th: -38, _note: "terrace: at 155 it would hide lawn; at 160 it hides none" },
    { id: "L4", r: 124, th: 132, _note: "measured on the lawn (110), pushed to the bed" },
    { id: "L5", r: 168, th: 31 }
  ],
  trees: [
    { id: "T0", kind: "blossom", tint: "pink", r: 124, th: 162, base: 1.9, flare: 4.5, fork: 17.5, w: 36, h: 27, bottom: 19, apples: 5, cards: 950 },
    { id: "T1", kind: "blossom", tint: "pink", r: 124, th: -171, base: 2, flare: 4.5, fork: 18.5, w: 37, h: 28, bottom: 19, apples: 7, cards: 950 },
    { id: "T2", kind: "blossom", tint: "white", r: 124, th: -144, base: 1.85, flare: 4.5, fork: 19.5, w: 35, h: 30, bottom: 20, apples: 4, cards: 950 },
    { id: "T3", kind: "round", tint: "green", r: 123.5, th: 116, base: 1.5, flare: 3, fork: 14, w: 34, h: 32, bottom: 13, apples: 0, cards: 900 },
    { id: "T4", kind: "conifer", tint: "conifer", r: 146, th: -98, base: 1, flare: 1.6, fork: 2, w: 18, h: 40, bottom: 2.5, apples: 0, cards: 800 }
  ],
  _trees: "base: trunk radius at the foot; flare: root flare radius; fork: where the trunk forks; w, h, bottom: the canopy's width, height and lowest point; cards: leaf cards (the coverage test wants 90% of the canopy covered from the camera, on High and Low, through the procedural and the painted cells; T4 has 800, not M4a's 700, because the painted conifer cells cover only about a third of a card)",
  topiary: { id: "B1", r: 127.5, th: -159, radius: 8.4, cards: 420 },
  bushes: [
    { id: "BB1", r: 164, th: -7, w: 26, h: 16, flowers: 0, cards: 820 },
    { id: "BB2", r: 167, th: -15, w: 18, h: 14, flowers: 6, cards: 480 },
    { id: "BB3", r: 162, th: -28, w: 29, h: 18, flowers: 7, cards: 880 },
    { id: "BB4", r: 158, th: -50, w: 22, h: 15, flowers: 5, cards: 600 },
    { id: "BB5", r: 170, th: 23, w: 24, h: 16, flowers: 5, cards: 660 }
  ],
  _bushes: "BB1-BB3 are the target's three front bushes; BB4 and BB5 follow bog.png",
  lupines: [
    { id: "LU1", r: 148, th: 49, h: 23 },
    { id: "LU2", r: 148, th: 58, h: 30 },
    { id: "LU3", r: 148, th: 67, h: 24 },
    { id: "LU4", r: 150, th: -74, h: 28 }
  ],
  lawnClovers: [
    { x: -97, y: -7.3, across: 7 },
    { x: -85.1, y: 54, across: 6 },
    { x: -45.4, y: 86.1, across: 8 },
    { x: 27.1, y: -1.5, across: 5.5 },
    { x: 74.1, y: -31.1, across: 7 },
    { x: 27.4, y: 85.1, across: 12.7, _note: "C1" },
    { x: 80.9, y: 51.2, across: 12.7, _note: "C2" }
  ],
  _lawnClovers: "bog.png's seven lawn clovers, at sim x, y",
  bedClovers: [
    { r: 123.5, th: 178, across: 6 },
    { r: 123, th: 95, across: 5.5 },
    { r: 123, th: -100, across: 6 },
    { r: 123.5, th: 146, across: 5 },
    { r: 123, th: -62, across: 5.5 },
    { r: 123, th: 72, across: 6 }
  ],
  pillar: { r: 150, th: 170, w: 6, h: 22 },
  hedges: [
    { id: "H1", r: 158, th: 150, len: 46, depth: 10, h: 12, cards: 340 },
    { id: "H2", r: 162, th: -176, len: 36, depth: 9, h: 13, cards: 270 },
    { id: "H3", r: 154, th: -120, len: 40, depth: 9, h: 10, cards: 300 },
    { id: "S1", r: 152, th: 138, len: 12, depth: 10, h: 10, cards: 80, lit: true }
  ],
  _hedges: "near hedges: behind the back-left wall (the target's top-left masses) and beyond the right flank; S1 is the lit shrub",
  mounds: [-24, 4, 30],
  _mounds: "hedge mounds in gaps of the camera-side wall, by angle",
  mossPatches: [-68, -88, -100, 62, 80, 98],
  _mossPatches: "moss patches on the flank walls' inner faces, by angle"
};

// site/js/gfx3d/layout3d.js
var DEG = Math.PI / 180;
var hyp = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c);
var R_SEEN = ARENA.R - 2;
var R_SOLID = ARENA.R + 1;
var R_FLAT = ARENA.R + 2;
var HIDE = Math.sqrt(3);
var HIDE_XY = HIDE / Math.SQRT2;
var LAWN_CAP = { tuft: 1.3, clover: 2, flower: 3 };
var TIERS = {
  low: { tufts: 1500, flowers: 90, cards: 0.6 },
  medium: { tufts: 2500, flowers: 150, cards: 1 },
  high: { tufts: 4000, flowers: 150, cards: 1 }
};
function at(r, thDeg) {
  const a = Math.PI / 4 + thDeg * DEG;
  return [r * Math.cos(a), r * Math.sin(a)];
}
function thetaOf(x, y) {
  let t = Math.atan2(y, x) - Math.PI / 4;
  if (t <= -Math.PI)
    t += 2 * Math.PI;
  else if (t > Math.PI)
    t -= 2 * Math.PI;
  return t;
}
var smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
var wrap = (t) => t > Math.PI ? t - 2 * Math.PI : t <= -Math.PI ? t + 2 * Math.PI : t;
var BACK_ARC = [140 * DEG, 155 * DEG];
var backArc = (th) => smooth(BACK_ARC[0], BACK_ARC[1], Math.abs(th));
var wallR = (th) => 128 + 8 * backArc(th);
var WALL_DEPTH = 7;
function hMax(r, th) {
  const c = Math.cos(th);
  const s = r * Math.sin(th);
  if (c <= 0 || Math.abs(s) >= R_SEEN)
    return Infinity;
  return (r * c - Math.sqrt(R_SEEN * R_SEEN - s * s)) / HIDE;
}
var hMaxAt = (x, y) => hMax(hyp(x, y), thetaOf(x, y));
var LANTERN = { plinth: 7, plinthH: 2.5, post: 5, postH: 22, tray: 8, trayH: 1, head: 6.5, roof: 9, roofH: 3, finial: 1, height: 36, flame: 28.75 };
var CLOVER = { across: 12.7, leafR: 3.05, leafD: 3.3, dome: 0.4, tilt: 15 };
var FLOWER_TILT = 20;
var CARD = { canopy: [1.6, 3], bush: [1.7, 2.8], topiary: [1.3, 2.2], hedge: [1.8, 3.2], mound: [1.1, 1.9], moss: [1, 1.8], conifer: [1.4, 2.4] };
var LUPINE = { floret: 4.4, jitter: 1, leaf: 5, leafH: 1.2 };
var MOSS_H = 0.35;
var SWAY = 0.5;
var LANTERNS = meadow_layout_default.lanterns.map((l) => [l.id, l.r, l.th]);
var TREES = meadow_layout_default.trees;
var TOPIARY = meadow_layout_default.topiary;
var BUSHES = meadow_layout_default.bushes;
var LUPINES = meadow_layout_default.lupines;
var LAWN_CLOVERS = meadow_layout_default.lawnClovers.map((c) => [c.x, c.y, c.across]);
var BED_CLOVERS = meadow_layout_default.bedClovers.map((c) => [c.r, c.th, c.across]);
var PILLAR = meadow_layout_default.pillar;
var HEDGES = meadow_layout_default.hedges;
var MOUNDS = meadow_layout_default.mounds;
var MOSS_PATCHES = meadow_layout_default.mossPatches;
function box(cx, cy, ang, hl, hd, y0, y1, extra = {}) {
  return { cx, cy, ang, hl, hd, y0, y1, ...extra };
}
function boxCorners(b) {
  const nx = Math.cos(b.ang);
  const ny = Math.sin(b.ang);
  const tx = -ny;
  const ty = nx;
  return [
    [b.cx - tx * b.hl - nx * b.hd, b.cy - ty * b.hl - ny * b.hd],
    [b.cx + tx * b.hl - nx * b.hd, b.cy + ty * b.hl - ny * b.hd],
    [b.cx + tx * b.hl + nx * b.hd, b.cy + ty * b.hl + ny * b.hd],
    [b.cx - tx * b.hl + nx * b.hd, b.cy - ty * b.hl + ny * b.hd]
  ];
}
function outline(b, step = 1) {
  const c = boxCorners(b);
  const pts = [];
  for (let i = 0;i < 4; i++) {
    const [ax, ay] = c[i];
    const [bx, by] = c[(i + 1) % 4];
    const n = Math.max(1, Math.ceil(hyp(bx - ax, by - ay) / step));
    for (let k = 0;k < n; k++)
      pts.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return pts;
}
var allowedTop = (b) => Math.min(...outline(b, 0.5).map(([x, y]) => hMaxAt(x, y)));
function chord(t0, t1, rIn, depth, set, turn) {
  const tc = (t0 + t1) / 2;
  const a = Math.PI / 4 + tc;
  const rc = rIn + depth / 2 + set;
  const len = 2 * (rIn + depth) * Math.sin((t1 - t0) / 2);
  return { cx: rc * Math.cos(a), cy: rc * Math.sin(a), ang: a + turn, len, tc };
}
function buildWall(seed) {
  const r = rng(seed * 7919 + 101);
  const N = 60;
  const slot = 2 * Math.PI / N;
  const b = Array.from({ length: N }, (_, k) => -Math.PI + (k + (r() - 0.5) * 0.36) * slot);
  const span = (k) => [b[k], k + 1 < N ? b[k + 1] : b[0] + 2 * Math.PI];
  const centre = (k) => wrap((span(k)[0] + span(k)[1]) / 2);
  const gaps = new Set(MOUNDS.map((m) => [...b.keys()].reduce((best, k) => Math.abs(wrap(centre(k) - m * DEG)) < Math.abs(wrap(centre(best) - m * DEG)) ? k : best, 0)));
  const TALL = 55 * DEG;
  const tall = (k) => Math.abs(centre(k)) >= TALL;
  const phase = r() * 6.28;
  const H1 = (t) => 5.4 + 0.4 * Math.sin(3 * t + phase) + (4.3 - 5.4) * backArc(t);
  const H2 = (t) => H1(t) + 5 + 0.4 * Math.sin(5 * t + phase * 2) + (4.3 - 5) * backArc(t);
  const COPE = (t) => 0.8 - 0.2 * backArc(t);
  const pieces = [];
  const mounds = [];
  for (let k = 0;k < N; k++) {
    const [t0, t1] = span(k);
    const tc = centre(k);
    const rIn = wallR(tc);
    const depth = 6.4 + r() * 1.2;
    const set = (r() - 0.5) * 0.6;
    const turn = (r() - 0.5) * 3 * DEG;
    const shade = Math.floor(r() * 3);
    const chips = Array.from({ length: 8 }, () => r() < 0.14 ? 0.9 + r() * 0.8 : 0);
    const mossy = r();
    const ch = chord(t0, t1, rIn, depth, set, turn);
    if (gaps.has(k)) {
      const m = CARD.mound[1] * 0.71 + SWAY;
      const env = box(ch.cx, ch.cy, ch.ang, ch.len / 2 + m, depth / 2 + 0.5 + m, 0, 0);
      const h = Math.min(6, allowedTop(env) - 0.4 - m);
      mounds.push({ id: `M${mounds.length + 1}`, cx: ch.cx, cy: ch.cy, ang: ch.ang, hl: ch.len / 2, hd: depth / 2 + 0.5, h, cards: 85 });
      continue;
    }
    const hl = ch.len / 2 - 0.15;
    const hd = depth / 2;
    if (!tall(k)) {
      const capH = 1.2 + r() * 0.3;
      const moss = mossy < 0.55;
      const cap = box(ch.cx, ch.cy, ch.ang, hl + 0.2, hd + 0.5, 0, 0, { kind: "cap", shade, chips: chips.map((c) => c * 0.6) });
      const top = Math.min(5.3 + r() * 0.6 + capH, allowedTop(cap) - 0.4 - (moss ? MOSS_H : 0));
      cap.y0 = top - capH;
      cap.y1 = top;
      pieces.push(box(ch.cx, ch.cy, ch.ang, hl, hd, 0, cap.y0, { kind: "block", course: 1, shade, chips, low: true }), cap);
      if (moss) {
        const f = 0.25 + r() * 0.25;
        const off = (r() < 0.5 ? -1 : 1) * hl * (1 - f) * 0.9;
        pieces.push(box(ch.cx - Math.sin(ch.ang) * off, ch.cy + Math.cos(ch.ang) * off, ch.ang, hl * f, hd + 0.1, top, top + MOSS_H, { kind: "moss" }));
      }
      continue;
    }
    const cope = COPE(tc);
    const moss = mossy < 0.4;
    const coping = box(ch.cx, ch.cy, ch.ang, hl + 0.1, hd + 0.3, 0, 0, { kind: "coping", shade });
    let c1 = H1(tc);
    let c2 = H2(tc);
    const lim = allowedTop(coping) - 0.4 - (moss ? MOSS_H : 0) - cope;
    if (c2 > lim) {
      c1 *= lim / c2;
      c2 = lim;
    }
    coping.y0 = c2;
    coping.y1 = c2 + cope;
    pieces.push(box(ch.cx, ch.cy, ch.ang, hl, hd, 0, c1, { kind: "block", course: 1, shade, chips }), coping);
    if (moss)
      pieces.push(box(ch.cx, ch.cy, ch.ang, hl * (0.45 + r() * 0.45), hd, coping.y1, coping.y1 + MOSS_H, { kind: "moss" }));
  }
  for (let k = 0;k < N; k++) {
    if (!tall(k) || gaps.has(k))
      continue;
    const k2 = (k + 1) % N;
    const [t0a, t1a] = span(k);
    const s0 = (t0a + t1a) / 2;
    let s1;
    if (tall(k2)) {
      const [t0b, t1b] = span(k2);
      s1 = (t0b + t1b) / 2 + (k2 === 0 ? 2 * Math.PI : 0);
    } else
      s1 = t1a;
    const k0 = (k + N - 1) % N;
    const parts = [[s0, s1]];
    if (!tall(k0))
      parts.unshift([t0a, s0]);
    for (const [u0, u1] of parts) {
      const tc = wrap((u0 + u1) / 2);
      const rIn = wallR(tc);
      const depth = 6.2 + r() * 1;
      const ch = chord(u0, u1, rIn, depth, (r() - 0.5) * 0.5, (r() - 0.5) * 2 * DEG);
      const y0 = Math.min(H1(wrap(u0)), H1(wrap(u1)), H1(tc));
      const under = pieces.filter((p) => p.kind === "coping" && hyp(p.cx - ch.cx, p.cy - ch.cy) < 16).map((p) => p.y0);
      const y1 = under.length ? Math.min(...under) : H2(tc);
      if (y1 - y0 < 1)
        continue;
      pieces.push(box(ch.cx, ch.cy, ch.ang, ch.len / 2 - 0.15, depth / 2, y0, y1, { kind: "block", course: 2, shade: Math.floor(r() * 3), chips: Array.from({ length: 8 }, () => r() < 0.12 ? 0.9 + r() * 0.7 : 0) }));
    }
  }
  const [px, py] = at(PILLAR.r, PILLAR.th);
  const pa = Math.PI / 4 + PILLAR.th * DEG;
  let y = 0;
  for (let i = 0;i < 4; i++) {
    const hh = PILLAR.h / 4.6 + (r() - 0.5) * 0.6;
    const w = PILLAR.w / 2 - 0.2 + r() * 0.3;
    pieces.push(box(px + (r() - 0.5) * 0.3, py + (r() - 0.5) * 0.3, pa + (r() - 0.5) * 0.08, w, w, y, y + hh, { kind: "pillar", shade: Math.floor(r() * 3), chips: Array.from({ length: 8 }, () => r() < 0.2 ? 0.8 : 0) }));
    y += hh;
  }
  pieces.push(box(px, py, pa, PILLAR.w / 2 + 0.5, PILLAR.w / 2 + 0.5, y, y + 1.4, { kind: "cap", shade: 1, chips: [] }));
  return { pieces, mounds };
}
var cache = new Map;
function gardenLayout(seed = 1, { fresh = false } = {}) {
  if (!fresh && cache.has(seed))
    return cache.get(seed);
  const r = rng(seed * 104729 + 17);
  const groups = [];
  const group = (name, kind, x, y, radius, height, parts = null) => {
    const g = { id: groups.length + 1, name, kind, x, z: y, radius, height };
    if (parts)
      g.parts = parts;
    groups.push(g);
    return g.id;
  };
  const trees = TREES.map((t) => {
    const [x, y] = at(t.r, t.th);
    const la = Math.PI / 4 + t.th * DEG + (r() - 0.5) * 1.2;
    const cone = t.kind === "conifer";
    const lean = cone ? 0 : 1 + r() * 1.2;
    const topX = x + Math.cos(la) * lean;
    const topY = y + Math.sin(la) * lean;
    const canopy = cone ? { shape: "cone", x: topX, y: topY, y0: t.bottom, y1: t.bottom + t.h, rx: t.w / 2 } : { shape: "ellipsoid", x: topX, y: topY, cy: t.bottom + t.h / 2, rx: t.w / 2, ry: t.h / 2 };
    const top = cone ? canopy.y1 : canopy.cy + canopy.ry;
    const id = group(t.id, "tree", x, y, t.w / 2 + lean, top);
    groups[id - 1].parts = [
      { x, z: y, r: t.flare, y0: 0, y1: 1 },
      { x: (x + topX) / 2, z: (y + topY) / 2, r: t.base * 1.2 + lean / 2, y0: 0, y1: t.bottom },
      cone ? { x: topX, z: topY, r: t.w / 2, y0: t.bottom, y1: top } : { x: topX, z: topY, r: canopy.rx, cy: canopy.cy, ry: canopy.ry }
    ];
    const apples = [];
    for (let i = 0;i < t.apples; i++) {
      let dx;
      let dy;
      let dz;
      do {
        dx = r() * 2 - 1;
        dy = r() * 1.6 - 0.5;
        dz = r() * 2 - 1;
      } while (dx * dx + dy * dy + dz * dz > 1 || dx + dz < 0.2);
      const n = hyp(dx, dy, dz) || 1;
      apples.push({ x: canopy.x + dx / n * canopy.rx * 0.97, y: canopy.y + dz / n * canopy.rx * 0.97, h: canopy.cy + dy / n * canopy.ry * 0.97 });
    }
    return { ...t, x, y, topX, topY, group: id, fade: true, canopy, apples, seed: Math.floor(r() * 1e9) };
  });
  const lanterns = LANTERNS.map(([name, rr, th]) => {
    const [x, y] = at(rr, th);
    return { id: name, r: rr, th, x, y, group: group(name, "lantern", x, y, LANTERN.roof * 0.71, LANTERN.height), fade: true, flame: LANTERN.flame };
  });
  const bushes = BUSHES.map((b) => {
    const [x, y] = at(b.r, b.th);
    return { ...b, x, y, radius: b.w / 2, cy: b.h * 0.45, ry: b.h * 0.55, group: group(b.id, "bush", x, y, b.w / 2, b.h, [{ x, z: y, r: b.w / 2, cy: b.h * 0.45, ry: b.h * 0.55 }]), fade: true, seed: Math.floor(r() * 1e9) };
  });
  const [tx, ty] = at(TOPIARY.r, TOPIARY.th);
  const topiary = { ...TOPIARY, x: tx, y: ty, cy: TOPIARY.radius * 0.96, group: group(TOPIARY.id, "topiary", tx, ty, TOPIARY.radius, TOPIARY.radius * 1.96, [{ x: tx, z: ty, r: TOPIARY.radius, cy: TOPIARY.radius * 0.96, ry: TOPIARY.radius }]), fade: true, seed: Math.floor(r() * 1e9) };
  const { pieces, mounds } = buildWall(seed);
  const lupines = LUPINES.map((l) => {
    const [x, y] = at(l.r, l.th);
    return { ...l, x, y, florets: 12 + Math.floor(r() * 5) };
  });
  const clovers = [
    ...LAWN_CLOVERS.map(([x, y, s]) => ({ x, y, across: s, yaw: (r() - 0.5) * 60 * DEG })),
    ...BED_CLOVERS.map(([rr, th, s]) => {
      const [x, y] = at(rr, th);
      return { x, y, across: s, yaw: (r() - 0.5) * 60 * DEG };
    })
  ];
  const hedges = HEDGES.map((h) => {
    const [x, y] = at(h.r, h.th);
    return { ...h, cx: x, cy: y, ang: Math.PI / 4 + h.th * DEG, hl: h.len / 2, hd: h.depth / 2, seed: Math.floor(r() * 1e9) };
  });
  const mossPatches = MOSS_PATCHES.map((th, i) => {
    const t = th * DEG;
    const rr = wallR(t) - 0.3;
    const [x, y] = at(rr, th);
    return { id: `MP${i + 1}`, cx: x, cy: y, ang: Math.PI / 4 + t, hl: 2 + r() * 1.5, hd: 0.5, y0: 2 + r() * 3, y1: 6 + r() * 3, cards: 26 };
  });
  const foliage = [
    ...trees.map((t) => ({ id: t.id, group: t.group, palette: t.tint, kind: t.kind === "conifer" ? "conifer" : "canopy", ...t.canopy, count: t.cards, seed: t.seed })),
    { id: topiary.id, group: topiary.group, palette: "topiary", kind: "topiary", shape: "ellipsoid", x: tx, y: ty, cy: topiary.cy, rx: topiary.radius, ry: topiary.radius, count: topiary.cards, seed: topiary.seed, floor: 0.4 },
    ...bushes.map((b) => ({ id: b.id, group: b.group, palette: "bush", kind: "bush", shape: "ellipsoid", x: b.x, y: b.y, cy: b.cy, rx: b.radius, ry: b.ry, count: b.cards, seed: b.seed, floor: 0.4, rim: true })),
    ...hedges.map((h) => ({ id: h.id, group: 0, palette: h.lit ? "shrub" : "hedge", kind: "hedge", shape: "box", cx: h.cx, cy: h.cy, ang: h.ang, hl: h.hl, hd: h.hd, y0: 0, y1: h.h, count: h.cards, seed: h.seed })),
    ...mounds.map((m) => ({ id: m.id, group: 0, palette: "hedge", kind: "mound", shape: "mound", cx: m.cx, cy: m.cy, ang: m.ang, hl: m.hl, hd: m.hd, y0: 0, y1: m.h, count: m.cards, seed: Math.floor(r() * 1e9) })),
    ...mossPatches.map((m) => ({ id: m.id, group: 0, palette: "moss", kind: "moss", shape: "box", cx: m.cx, cy: m.cy, ang: m.ang, hl: m.hl, hd: m.hd, y0: m.y0, y1: m.y1, count: m.cards, seed: Math.floor(r() * 1e9) }))
  ];
  const farHedges = [];
  const FAR_HEDGE_MIN_R = 216;
  const NF = 22;
  for (let i = 0;i < NF; i++) {
    const th = -180 + (i + 0.5 + (r() - 0.5) * 0.5) * (360 / NF);
    const front = Math.abs(th) < 60;
    const rr = front ? 272 + r() * 28 : 222 + r() * 78;
    const [x, y] = at(rr, th);
    const w = 60 + r() * 30;
    const H = front ? 18 + r() * 8 : 20 + r() * 20;
    const n = 12;
    const ph = r() * 6.28;
    const tops = [];
    for (let k = 0;k <= n; k++) {
      const s = k / n;
      const along = (s - 0.5) * w;
      let vx = x + along * Math.SQRT1_2;
      let vy = y - along * Math.SQRT1_2;
      const vr = Math.hypot(vx, vy);
      if (vr < FAR_HEDGE_MIN_R)
        vx *= FAR_HEDGE_MIN_R / vr, vy *= FAR_HEDGE_MIN_R / vr;
      const env = Math.sqrt(Math.max(0, 1 - Math.pow(2 * s - 1, 4)));
      let h = H * env * (0.72 + 0.18 * Math.sin(ph + s * 9.1) + 0.1 * r());
      h = Math.max(1, Math.min(h, hMaxAt(vx, vy) - 0.4));
      tops.push([vx, vy, h]);
    }
    farHedges.push({ x, y, w, tops, shade: r() });
  }
  const L = { seed, trees, lanterns, bushes, topiary, lupines, clovers, hedges, mounds, mossPatches, pieces, foliage, farHedges, groups };
  if (!fresh)
    cache.set(seed, L);
  return L;
}
function keepOut(L) {
  const c = [];
  for (const k of L.clovers)
    c.push([k.x, k.y, k.across / 2, true]);
  for (const t of L.trees)
    c.push([t.x, t.y, t.flare + 0.4]);
  for (const l of L.lanterns)
    c.push([l.x, l.y, LANTERN.plinth / 2 * Math.SQRT2 + 0.3]);
  for (const b of L.bushes)
    c.push([b.x, b.y, b.radius * 0.75]);
  c.push([L.topiary.x, L.topiary.y, L.topiary.radius * 0.9]);
  for (const h of L.hedges)
    c.push([h.cx, h.cy, hyp(h.hl, h.hd) * 0.8]);
  for (const l of L.lupines)
    c.push([l.x, l.y, 2]);
  const [px, py] = at(PILLAR.r, PILLAR.th);
  c.push([px, py, PILLAR.w * 0.75 + 0.4]);
  return c;
}
function thickRings(L) {
  return [...L.trees.map((t) => [t.x, t.y, t.flare]), ...L.lanterns.map((l) => [l.x, l.y, 4.5]), ...L.bushes.map((b) => [b.x, b.y, b.radius]), [L.topiary.x, L.topiary.y, L.topiary.radius]];
}
function makeNoise(rand, cell = 26) {
  const N = 32;
  const v = Float32Array.from({ length: N * N }, () => rand());
  const at2 = (i, j) => v[(j % N + N) % N * N + (i % N + N) % N];
  return (x, y) => {
    const fx = x / cell + 500;
    const fy = y / cell + 500;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    let tx = fx - i;
    let ty = fy - j;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = at2(i, j) + (at2(i + 1, j) - at2(i, j)) * tx;
    const b = at2(i, j + 1) + (at2(i + 1, j + 1) - at2(i, j + 1)) * tx;
    return a + (b - a) * ty;
  };
}
function coverLimit(x, y, reach) {
  if (Math.abs(thetaOf(x, y)) > 100 * DEG)
    return Infinity;
  let m = hMaxAt(x, y);
  for (let k = 0;k < 8; k++) {
    const a = k / 8 * 2 * Math.PI;
    m = Math.min(m, hMaxAt(x + Math.cos(a) * reach, y + Math.sin(a) * reach));
  }
  return m;
}
var TUFT_REACH = 1.3;
var GV = Math.hypot(UP[0], UP[2]);
var HV = UP[1];
var toScreen = (x, y, h = 0) => [x * RIGHT[0] + y * RIGHT[2], x * UP[0] + y * UP[2] + h * HV];
function coversClover(k, a, v, ra, rv, down) {
  const [ca, cv] = toScreen(k.x, k.y);
  const R = k.across / 2;
  const da = a - ca;
  const dv0 = v - cv;
  const dv = dv0 - Math.max(0, Math.min(cloverTop(k.across) * HV + down, dv0));
  return (da / (R + ra)) ** 2 + (dv / (R * GV + rv)) ** 2 < 1;
}
function flowerDiscs(x, y, head, stem) {
  const [a, v] = toScreen(x, y, stem);
  const lf = head * 0.55;
  const F = Math.SQRT1_2;
  const [la, lv] = toScreen(x + (RIGHT[0] * 0.3 + F * 0.1) * lf, y + (RIGHT[2] * 0.3 + F * 0.1) * lf, 0.15 * lf);
  return [
    [a, v, head / 2 + SWAY, 0],
    [a, v, 0.16 + SWAY, stem * HV],
    [la, lv, lf * 0.78, 0]
  ];
}
function tuftShape(x, y, cr, h) {
  const reach = cr * TUFT_REACH + SWAY;
  const [a, v] = toScreen(x, y, h);
  return [a, v, reach, reach * GV, h * HV];
}
function scatter(rand, counts, L = gardenLayout(1)) {
  const rt = rng(Math.floor(rand() * 4294967296));
  const rf = rng(Math.floor(rand() * 4294967296));
  const noise = makeNoise(rng(Math.floor(rand() * 4294967296)));
  const out = keepOut(L);
  const rings = thickRings(L);
  const lawnOut = out.filter((c) => c[3]);
  const blocked = (x, y, pad = 0, reach = 0) => (x * x + y * y > 110 * 110 ? out : lawnOut).some(([cx, cy, cr, clover]) => hyp(x - cx, y - cy) < cr + pad + (clover ? reach : 0));
  const onClover = (x, y, shapes) => L.clovers.some((k) => hyp(x - k.x, y - k.y) < k.across / 2 + 16 && shapes.some(([a, v, ra, rv, down]) => coversClover(k, a, v, ra, rv, down)));
  const flowerOnClover = (x, y, head, stem) => onClover(x, y, flowerDiscs(x, y, head, stem).map(([a, v, r, down]) => [a, v, r, r, down]));
  const underWall = (x, y) => {
    const rr = hyp(x, y);
    const rw = wallR(thetaOf(x, y));
    return rr > rw - 0.6 && rr < rw + WALL_DEPTH + 0.6;
  };
  const ZONES = [0.55, 0.28, 0.085, 0.085];
  const tufts = [];
  for (let guard = 0;tufts.length < counts.tufts && guard < counts.tufts * 40; guard++) {
    const zu = rt();
    const a = rt() * 2 * Math.PI;
    const u = rt();
    const cr = 0.75 + rt() * 0.75;
    const yaw = (rt() - 0.5) * 50 * DEG;
    const tone = rt();
    const hr = rt();
    const keep = rt();
    let x;
    let y;
    if (zu < ZONES[0]) {
      const rr = ARENA.R * Math.sqrt(u);
      x = rr * Math.cos(a);
      y = rr * Math.sin(a);
      if (keep > (0.05 + 0.2 * smooth(78, 116, rr) + 0.2 * smooth(0.58, 0.8, noise(x, y))) / 0.45)
        continue;
    } else if (zu < ZONES[0] + ZONES[1] + ZONES[2]) {
      const rw = wallR(wrap(a - Math.PI / 4));
      const rr = zu < ZONES[0] + ZONES[1] ? Math.sqrt(ARENA.R * ARENA.R + u * (rw * rw - ARENA.R * ARENA.R)) : rw + WALL_DEPTH + 0.7 + u * 6 * u;
      x = rr * Math.cos(a);
      y = rr * Math.sin(a);
    } else {
      const [cx, cy, crr] = rings[Math.floor(keep * rings.length)];
      const d = crr + u * u * 6;
      x = cx + d * Math.cos(a);
      y = cy + d * Math.sin(a);
      if (hyp(x, y) > 196)
        continue;
    }
    const rr = hyp(x, y);
    if (underWall(x, y) || blocked(x, y, cr * 0.5, cr * (TUFT_REACH - 0.5)))
      continue;
    let h;
    if (rr < R_FLAT)
      h = rr < 80 ? 0.7 + hr * 0.45 : 0.8 + hr * 0.5;
    else {
      h = 1.3 + 2.6 * Math.pow(hr, 0.8);
      h = Math.min(h, coverLimit(x, y, cr * TUFT_REACH + SWAY) - 0.1);
      if (h < 0.6)
        continue;
    }
    if (onClover(x, y, [tuftShape(x, y, cr, h)]))
      continue;
    tufts.push({ x, y, h, cr, yaw, tone });
  }
  const flowers = [];
  const total = counts.flowers;
  const nLawn = Math.round(total * 0.19);
  const nBush = Math.min(L.bushes.reduce((s, b) => s + b.flowers, 0), Math.round(total * 0.16));
  const kindOf = (u, front) => u < 0.55 ? "daisy" : u < 0.85 || !front ? "buttercup" : "cosmos";
  const HEAD = { daisy: 5, buttercup: 3, cosmos: 4.4 };
  const sinT = Math.sin(FLOWER_TILT * DEG);
  for (let guard = 0;flowers.length < nLawn && guard < 5000; guard++) {
    const a = rf() * 2 * Math.PI;
    const rr = 100 + rf() * 17;
    const x = rr * Math.cos(a);
    const y = rr * Math.sin(a);
    const kind = rf() < 0.65 ? "daisy" : "buttercup";
    const head = HEAD[kind] * (0.85 + rf() * 0.15);
    const stem = Math.min(2.1, LAWN_CAP.flower - head / 2 * sinT - 0.02) * (0.7 + rf() * 0.3);
    if (blocked(x, y, 1, head / 2) || flowerOnClover(x, y, head, stem))
      continue;
    flowers.push({ x, y, z: 0, kind, head, stem, tilt: FLOWER_TILT, top: stem + head / 2 * sinT, group: 0, lawn: true });
  }
  let left = nBush;
  for (const b of L.bushes) {
    for (let i = 0;i < b.flowers && left > 0; i++, left--) {
      let dx;
      let dy;
      let dz;
      do {
        dx = rf() * 2 - 1;
        dy = rf();
        dz = rf() * 2 - 1;
      } while (dx * dx + dy * dy + dz * dz > 1 || dx + dz < 0.3 || dy < 0.2);
      const n = hyp(dx, dy, dz);
      const kind = rf() < 0.6 ? "daisy" : "cosmos";
      const head = HEAD[kind] * (0.8 + rf() * 0.2);
      const z = b.cy + dy / n * b.ry * 0.95;
      const stem = 0.3 + rf() * 0.4;
      flowers.push({ x: b.x + dx / n * b.radius * 0.95, y: b.y + dz / n * b.radius * 0.95, z, kind, head, stem, tilt: FLOWER_TILT, top: z + stem + head / 2 * sinT, group: b.group, lawn: false });
    }
  }
  for (let guard = 0;flowers.length < total && guard < 20000; guard++) {
    const a = rf() * 2 * Math.PI;
    const th = wrap(a - Math.PI / 4);
    const rw = wallR(th);
    const bed = rf() < 0.7;
    const rr = bed ? R_FLAT + 0.5 + rf() * (rw - R_FLAT - 1.5) : rw + WALL_DEPTH + 1 + rf() * 6;
    const x = rr * Math.cos(a);
    const y = rr * Math.sin(a);
    const kind = kindOf(rf(), Math.abs(th) < 60 * DEG);
    const head = HEAD[kind] * (0.8 + rf() * 0.2);
    let stem = 1.5 + rf() * 1.5;
    if (blocked(x, y, 1, head / 2))
      continue;
    const lim = coverLimit(x, y, head / 2 + SWAY) - head / 2 * sinT - 0.1;
    if (lim < 0.8)
      continue;
    stem = Math.min(stem, lim);
    if (flowerOnClover(x, y, head, stem))
      continue;
    flowers.push({ x, y, z: 0, kind, head, stem, tilt: FLOWER_TILT, top: stem + head / 2 * sinT, group: 0, lawn: false });
  }
  return { tufts, flowers };
}
var SLAB = { w: 10, d: 8, grout: 8 / 12.8 };
var FLOOR_DECALS = (() => {
  const [sx, sy] = at(176, -147);
  const cx = (Math.floor(sx / SLAB.w) + 0.5) * SLAB.w;
  const cy = (Math.floor(sy / SLAB.d) + 0.5) * SLAB.d;
  const g = SLAB.grout / 2;
  const slab = { cell: "slabEngraved", x: cx, y: cy, hx: SLAB.w / 2 - g, hy: SLAB.d / 2 - g, yaw: 0 };
  const stones = [
    [183, -12.5, 3.3],
    [188, -15.5, 3],
    [183.5, -18.5, 3.4],
    [189, -21.5, 3.1]
  ].map(([r, th, rad], i) => {
    const [x, y] = at(r, th);
    return { cell: `step${i}`, x, y, hx: rad, hy: rad, yaw: -Math.PI / 4, rim: 0.8, tone: 0.6 };
  });
  return [slab, ...stones];
})();
var cloverTop = (across) => across / CLOVER.across * (2 * CLOVER.leafR * Math.sin(CLOVER.tilt * DEG) + CLOVER.dome);

// site/js/gfx3d/props3d.js
var linCache = new Map;
function lin(hex) {
  let v = linCache.get(hex);
  if (!v) {
    const c = new Se(hex);
    v = [c.r, c.g, c.b];
    linCache.set(hex, v);
  }
  return v;
}
var mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
var mul3 = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var norm = (a) => {
  const l = hyp(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function rotAxis(v, k, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}

class Geo {
  constructor({ group = false, uv = false, cell = false } = {}) {
    this.p = [];
    this.n = [];
    this.c = [];
    this.g = group ? [] : null;
    this.u = uv ? [] : null;
    this.k = cell ? [] : null;
  }
  v(p, n, c, g = 0, u = null, k = 0) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(c[0], c[1], c[2]);
    if (this.g)
      this.g.push(g);
    if (this.u)
      this.u.push(u ? u[0] : 0, u ? u[1] : 0);
    if (this.k)
      this.k.push(k);
  }
  tri(a, b, c, ca, cb = ca, cc = ca, g = 0, inside = null, uvf = null, cell = 0) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = hyp(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    if (inside && nx * ((a[0] + b[0] + c[0]) / 3 - inside[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - inside[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - inside[2]) < 0) {
      [b, c] = [c, b];
      [cb, cc] = [cc, cb];
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const n = [nx, ny, nz];
    this.v(a, n, ca, g, uvf ? uvf(a, n) : null, cell);
    this.v(b, n, cb, g, uvf ? uvf(b, n) : null, cell);
    this.v(c, n, cc, g, uvf ? uvf(c, n) : null, cell);
  }
  triN(a, b, c, na, nb, nc, ca, cb = ca, cc = ca, g = 0, ua = null, ub = null, uc = null, cell = 0) {
    const f = cross(sub(b, a), sub(c, a));
    if (dot(f, [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]]) < 0) {
      this.v(a, na, ca, g, ua, cell);
      this.v(c, nc, cc, g, uc, cell);
      this.v(b, nb, cb, g, ub, cell);
    } else {
      this.v(a, na, ca, g, ua, cell);
      this.v(b, nb, cb, g, ub, cell);
      this.v(c, nc, cc, g, uc, cell);
    }
  }
  build() {
    const geo = new ot;
    geo.setAttribute("position", new Xe(this.p, 3));
    geo.setAttribute("normal", new Xe(this.n, 3));
    geo.setAttribute("color", new Xe(this.c, 3));
    if (this.g)
      geo.setAttribute("aGroup", new Xe(this.g, 1));
    if (this.u)
      geo.setAttribute("uv", new Xe(this.u, 2));
    if (this.k)
      geo.setAttribute("aCell", new Xe(this.k, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}
function aabb(geo, x0, y0, z0, x1, y1, z1, col, g = 0, uvf = null, cell = 0) {
  const P = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const inside = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces = [
    [[0, 2, 6, 4], [-1, 0, 0]],
    [[1, 3, 7, 5], [1, 0, 0]],
    [[0, 1, 5, 4], [0, -1, 0]],
    [[2, 3, 7, 6], [0, 1, 0]],
    [[0, 1, 3, 2], [0, 0, -1]],
    [[4, 5, 7, 6], [0, 0, 1]]
  ];
  for (const [q, n] of faces) {
    const c = typeof col === "function" ? col(n) : col;
    geo.tri(P(q[0]), P(q[1]), P(q[2]), c, c, c, g, inside, uvf, cell);
    geo.tri(P(q[0]), P(q[2]), P(q[3]), c, c, c, g, inside, uvf, cell);
  }
}
function hullBox(geo, x0, y0, z0, x1, y1, z1, g = 0) {
  const P = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const N = (i) => norm([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
  const k = [0, 0, 0];
  for (const q of [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]]) {
    geo.triN(P(q[0]), P(q[1]), P(q[2]), N(q[0]), N(q[1]), N(q[2]), k, k, k, g);
    geo.triN(P(q[0]), P(q[2]), P(q[3]), N(q[0]), N(q[2]), N(q[3]), k, k, k, g);
  }
}
function patchPaint(m, key, { vert = [], frag = [] } = {}) {
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    for (const [a, b] of vert)
      sh.vertexShader = sh.vertexShader.replace(a, b);
    for (const [a, b] of frag)
      sh.fragmentShader = sh.fragmentShader.replace(a, b);
  };
  const k0 = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${k0()}:${key}`;
  return m;
}
var WIND_BY_HEIGHT = ["clamp(position.y / 4.0, 0.0, 1.0)", "clamp(pw.y / 4.0, 0.0, 1.0)"];
function flattenHull(m) {
  return patchPaint(m, "flat", {
    vert: [
      ["#include <common>", `#include <common>
uniform float uFlatR;`],
      [
        "vec4 mvPosition = viewMatrix * pw;",
        `vec4 mvPosition = viewMatrix * pw;
         {
           vec4 root = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           #ifdef USE_INSTANCING
             root = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           #endif
           if (length(root.xz) < uFlatR) mvPosition.z -= 1.9 * max(pw.y, 0.0);
         }`
      ]
    ]
  });
}
function cardAtlas(data, W, H) {
  return mipTexture(cardMips(data, W, H));
}
var S2L = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});
var L2S = new Uint8Array(16384).map((_, i) => {
  const c = i / 16383;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
});
function cardMips(data, W, H, { linear = false } = {}) {
  const get = linear ? (v) => S2L[v] : (v) => v;
  const put = linear ? (a) => L2S[Math.min(16383, Math.round(a * 16383))] : (a) => a;
  const mips = [{ data, width: W, height: H }];
  let src = data;
  let w = W;
  let h = H;
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1);
    const nh = Math.max(1, h >> 1);
    const dst = new Uint8Array(nw * nh * 4);
    for (let y = 0;y < nh; y++)
      for (let x = 0;x < nw; x++) {
        let n = 0;
        let a0 = 0;
        let a1 = 0;
        let a2 = 0;
        for (let dy = 0;dy < 2; dy++)
          for (let dx = 0;dx < 2; dx++) {
            const o = (Math.min(h - 1, y * 2 + dy) * w + Math.min(w - 1, x * 2 + dx)) * 4;
            if (src[o + 3] > 127) {
              n++;
              a0 += get(src[o]);
              a1 += get(src[o + 1]);
              a2 += get(src[o + 2]);
            }
          }
        const o = (y * nw + x) * 4;
        if (n >= 2) {
          dst[o] = put(a0 / n);
          dst[o + 1] = put(a1 / n);
          dst[o + 2] = put(a2 / n);
          dst[o + 3] = 255;
        }
      }
    mips.push({ data: dst, width: nw, height: nh });
    src = dst;
    w = nw;
    h = nh;
  }
  return mips;
}
function mipTexture(mips) {
  const t = new os(mips[0].data, mips[0].width, mips[0].height, mn);
  t.mipmaps = mips;
  t.generateMipmaps = false;
  t.colorSpace = kn;
  t.magFilter = tn;
  t.minFilter = Ls;
  t.needsUpdate = true;
  return t;
}
var inst = (arr, size) => new Fn(new Float32Array(arr), size);
function fillMatrices(mesh, list) {
  const m = new Pe;
  const q = new Ct;
  const up = new U(0, 1, 0);
  const p = new U;
  const s = new U;
  list.forEach((t, i) => {
    q.setFromAxisAngle(up, t[3] || 0);
    m.compose(p.set(t[0], t[1], t[2]), q, s.set(t[4] ?? 1, t[5] ?? t[4] ?? 1, t[6] ?? t[4] ?? 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
var STONE = [lin(4082269), lin(4674665), lin(3555407)];
var STONE_LOW = lin(5264222);
var CAP_TOP = [1, 0.8, 1.15].map((k) => mul3(lin(6314063), k));
var CAP_SIDE = lin(5657692);
var COPING = lin(6050890);
var COPING_BACK = lin(3422554);
var MOSS_TOP = lin(4871708);
var MOSS_SIDE = lin(3820054);
var STONE_LIGHT = { fill: [0.9, 0.85, 0.95], lant: { k: 2.9, wrap: 1, sat: 5, top: 0.5, tint: [0.9, 1.6, 4], green: [0.48, 1, 3] } };
function chamfer(geo, b, { bevel = 0.3, chips = [], col, split = 0, uvf = null, cellOf = null }) {
  const hh = (b.y1 - b.y0) / 2;
  const my = (b.y0 + b.y1) / 2;
  const nx = Math.cos(b.ang);
  const nz = Math.sin(b.ang);
  const W = (lx, ly, lz) => [b.cx - nz * lx + nx * lz, my + ly, b.cy + nx * lx + nz * lz];
  const inside = [b.cx, my, b.cy];
  const lim = Math.min(b.hl, hh, b.hd) * 0.8;
  const P = [];
  for (let i = 0;i < 8; i++) {
    const sx = i & 4 ? 1 : -1;
    const sy = i & 2 ? 1 : -1;
    const sz = i & 1 ? 1 : -1;
    const e = Math.min(bevel + (chips[i] || 0), lim);
    P.push({ x: W(sx * b.hl, sy * (hh - e), sz * (b.hd - e)), y: W(sx * (b.hl - e), sy * hh, sz * (b.hd - e)), z: W(sx * (b.hl - e), sy * (hh - e), sz * b.hd) });
  }
  const C = (p, kind, top) => col(p[1], kind, top);
  const tri = (a, bb, c, kind, top = false) => geo.tri(a, bb, c, C(a, kind, top), C(bb, kind, top), C(c, kind, top), 0, inside, uvf, cellOf ? cellOf(kind, top) : 0);
  const quad = (q, kind, top = false) => {
    tri(q[0], q[1], q[2], kind, top);
    tri(q[0], q[2], q[3], kind, top);
  };
  const side = (q) => {
    const ys = b.y0 + split;
    const lo = Math.min(...q.map((p) => p[1]));
    const hi = Math.max(...q.map((p) => p[1]));
    if (!split || ys <= lo + 0.05 || ys >= hi - 0.05)
      return quad(q, "face");
    const idx = [0, 1, 2, 3];
    const bot = idx.filter((i) => q[i][1] < (lo + hi) / 2);
    const partner = (i) => [(i + 1) % 4, (i + 3) % 4].find((j) => q[j][1] > (lo + hi) / 2);
    if (bot.length !== 2)
      return quad(q, "face");
    const [b0, b1] = bot;
    const t0 = partner(b0);
    const t1 = partner(b1);
    if (t0 === undefined || t1 === undefined || t0 === t1)
      return quad(q, "face");
    const at = (i, j) => {
      const t = (ys - q[i][1]) / (q[j][1] - q[i][1]);
      return [q[i][0] + (q[j][0] - q[i][0]) * t, ys, q[i][2] + (q[j][2] - q[i][2]) * t];
    };
    const m0 = at(b0, t0);
    const m1 = at(b1, t1);
    quad([q[b0], q[b1], m1, m0], "face");
    quad([m0, m1, q[t1], q[t0]], "face");
  };
  side([4, 6, 7, 5].map((i) => P[i].x));
  side([0, 2, 3, 1].map((i) => P[i].x));
  side([1, 5, 7, 3].map((i) => P[i].z));
  side([0, 4, 6, 2].map((i) => P[i].z));
  quad([2, 6, 7, 3].map((i) => P[i].y), "face", true);
  quad([0, 4, 5, 1].map((i) => P[i].y), "face");
  for (const [sy, sz] of [[0, 0], [2, 0], [0, 1], [2, 1]])
    quad([P[sy | sz].y, P[4 | sy | sz].y, P[4 | sy | sz].z, P[sy | sz].z], "bevel", sy > 0);
  for (const [sx, sz] of [[0, 0], [4, 0], [0, 1], [4, 1]])
    quad([P[sx | sz].x, P[sx | 2 | sz].x, P[sx | 2 | sz].z, P[sx | sz].z], "bevel");
  for (const [sx, sy] of [[0, 0], [4, 0], [0, 2], [4, 2]])
    quad([P[sx | sy].x, P[sx | sy | 1].x, P[sx | sy | 1].y, P[sx | sy].y], "bevel", sy > 0);
  for (let i = 0;i < 8; i++)
    tri(P[i].x, P[i].y, P[i].z, "corner", (i & 2) > 0);
}
var STONE_CELLS = ["stoneA", "stoneB", "stoneC", "stoneChip", "capTop", "mossStrip", "mossTop"];
var CELL = Object.fromEntries(STONE_CELLS.map((n, i) => [n, i]));
var TEX_PER_UNIT = 11;
var CELL_W = 128 / TEX_PER_UNIT;
var CELL_H = 64 / TEX_PER_UNIT;
var MOSS_H2 = 32 / TEX_PER_UNIT;
var hash01 = (i) => (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
function stoneUV(b, index, { cellH = CELL_H, band = null } = {}) {
  const hh = (b.y1 - b.y0) / 2;
  const my = (b.y0 + b.y1) / 2;
  const nx = Math.cos(b.ang);
  const nz = Math.sin(b.ang);
  const sl = Math.max(2 * b.hl, CELL_W);
  const sd = Math.max(2 * b.hd, CELL_W);
  const u0 = hash01(2 * index) * (1 - 2 * b.hl / sl);
  const u1 = hash01(2 * index + 1) * (1 - 2 * b.hd / sd);
  const sh = Math.max(2 * hh, cellH);
  const st = Math.max(2 * b.hd, cellH);
  const mirror = hash01(7 * index + 5003);
  const fu = (u) => mirror < 0.5 ? 1 - u : u;
  const fv = (v) => mirror * 4 % 1 < 0.5 ? 1 - v : v;
  return (p, n) => {
    const dx = p[0] - b.cx;
    const dz = p[2] - b.cy;
    const lx = -nz * dx + nx * dz;
    const ly = p[1] - my;
    const lz = nx * dx + nz * dz;
    const ax = Math.abs(-nz * n[0] + nx * n[2]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(nx * n[0] + nz * n[2]);
    if (ay >= ax && ay >= az)
      return [fu(clamp01(u0 + (lx + b.hl) / sl)), fv(clamp01((lz + b.hd) / st))];
    const u = clamp01(az >= ax ? u0 + (lx + b.hl) / sl : u1 + (lz + b.hd) / sd);
    if (band)
      return [u, clamp01(band[0] + (band[1] - band[0]) * clamp01((hh - ly) / (2 * hh || 1)))];
    return [fu(u), fv(clamp01((hh - ly) / sh))];
  };
}
function buildStoneGeo(L) {
  const geo = new Geo({ uv: true, cell: true });
  L.pieces.forEach((p, index) => {
    const course1 = p.kind === "block" && p.course === 1;
    const base = p.low ? STONE_LOW : STONE[p.shade ?? 0];
    const foot = p.y0;
    let col;
    if (p.kind === "moss")
      col = (y, kind, top) => mul3(top ? MOSS_TOP : MOSS_SIDE, kind === "face" ? 1 : 0.7);
    else if (p.kind === "cap")
      col = (y, kind, top) => {
        const c = top && kind === "face" ? CAP_TOP[p.shade ?? 0] : CAP_SIDE;
        return mul3(c, kind === "face" ? 1 : kind === "bevel" ? top ? 0.75 : 0.5 : 0.45);
      };
    else if (p.kind === "coping") {
      const cop = mix3(COPING, COPING_BACK, backArc(thetaOf(p.cx, p.cy)));
      col = (y, kind, top) => mul3(top ? cop : base, kind === "face" ? 1 : 0.6);
    } else
      col = (y, kind, top) => {
        let f = kind === "face" ? 1 : kind === "bevel" ? 0.38 : 0.3;
        if (top)
          f *= 1.2;
        if (course1 || p.kind === "pillar")
          f *= 0.12 + 0.88 * smooth(0, 1.5, y - foot);
        return mul3(base, f * (0.9 + 0.1 * Math.min(1, y / 10)));
      };
    if (p.kind === "moss" || p.kind === "coping") {
      const nx = Math.cos(p.ang);
      const nz = Math.sin(p.ang);
      const my = (p.y0 + p.y1) / 2;
      const hh = (p.y1 - p.y0) / 2;
      const W = (lx, ly, lz) => [p.cx - nz * lx + nx * lz, my + ly, p.cy + nx * lx + nz * lz];
      const inside = [p.cx, my, p.cy];
      const P = (i) => W(i & 4 ? p.hl : -p.hl, i & 2 ? hh : -hh, i & 1 ? p.hd : -p.hd);
      const moss = p.kind === "moss";
      const uvf = stoneUV(p, index, moss ? { cellH: MOSS_H2, band: [0.75, 1] } : {});
      for (const q of [[0, 4, 5, 1], [2, 6, 7, 3], [0, 2, 3, 1], [4, 6, 7, 5], [0, 4, 6, 2], [1, 5, 7, 3]]) {
        const top = q[0] === 2;
        const c = col(top ? p.y1 : my, "face", top);
        const cell = moss ? top ? CELL.mossTop : CELL.mossStrip : top ? CELL.stoneB : p.shade ?? 0;
        geo.tri(P(q[0]), P(q[1]), P(q[2]), c, c, c, 0, inside, uvf, cell);
        geo.tri(P(q[0]), P(q[2]), P(q[3]), c, c, c, 0, inside, uvf, cell);
      }
      return;
    }
    const stone = p.kind === "block" && (p.chips || []).filter(Boolean).length >= 2 ? CELL.stoneChip : p.shade ?? 0;
    const cellOf = p.kind === "cap" ? (kind, top) => top && kind === "face" ? CELL.capTop : stone : () => stone;
    chamfer(geo, p, { bevel: 0.32, chips: p.chips || [], col, split: course1 || p.kind === "pillar" && foot === 0 ? 1.5 : 0, uvf: stoneUV(p, index), cellOf });
  });
  return geo.build();
}
var BARK_DARK = lin(1315090);
var BARK = lin(3350031);
var BARK_HI = lin(4007444);
var BARK_LIGHT = { fill: [1.6, 2, 3], sunRim: { light: [12.8, 17.4, 4.65], edge: 0.55 } };
var BARK_V = 8;
function tube(geo, path, sides, g, rand, v0 = 0) {
  const frame = (i) => {
    const a = path[Math.max(0, i - 1)].p;
    const b = path[Math.min(path.length - 1, i + 1)].p;
    const T = norm(sub(b, a));
    const ref = Math.abs(T[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const N = norm(cross(ref, T));
    return { T, N, B: cross(T, N) };
  };
  const mid = frame(path.length >> 1);
  const S = cross(mid.T, BACK);
  const start = Math.atan2(dot(S, mid.B), dot(S, mid.N));
  let arc = v0;
  const arcs = [];
  const rings = path.map((node, i) => {
    const { N, B } = frame(i);
    const shade = mix3(BARK_DARK, node.p[1] > 3 ? BARK_HI : BARK, Math.min(1, Math.max(0, node.p[1] / 6))).map((v) => v * (0.85 + rand() * 0.3));
    if (i > 0)
      arc += hyp(node.p[0] - path[i - 1].p[0], node.p[1] - path[i - 1].p[1], node.p[2] - path[i - 1].p[2]);
    arcs.push(arc);
    const pts = [];
    for (let s = 0;s <= sides; s++) {
      const ang = s % sides / sides * 2 * Math.PI;
      const lobe = node.lobes ? node.lobes(ang) : 1;
      const d = [N[0] * Math.cos(ang) + B[0] * Math.sin(ang), N[1] * Math.cos(ang) + B[1] * Math.sin(ang), N[2] * Math.cos(ang) + B[2] * Math.sin(ang)];
      const u = [(s / sides * 2 * Math.PI - start) / Math.PI, arc / BARK_V];
      pts.push({ p: [node.p[0] + d[0] * node.r * lobe, node.p[1] + d[1] * node.r * lobe, node.p[2] + d[2] * node.r * lobe], n: d, c: shade, u });
    }
    return pts;
  });
  for (let i = 0;i + 1 < rings.length; i++)
    for (let s = 0;s < sides; s++) {
      const a = rings[i][s];
      const b = rings[i][s + 1];
      const c = rings[i + 1][s + 1];
      const d = rings[i + 1][s];
      geo.triN(a.p, b.p, c.p, a.n, b.n, c.n, a.c, b.c, c.c, g, a.u, b.u, c.u);
      geo.triN(a.p, c.p, d.p, a.n, c.n, d.n, a.c, c.c, d.c, g, a.u, c.u, d.u);
    }
  return arcs;
}
function buildTrunkGeo(L, rng) {
  const geo = new Geo({ group: true, uv: true });
  for (const [ti, t] of L.trees.entries()) {
    const rand = rng(t.seed);
    const v0 = hash01(ti + 9001) * 2 * BARK_V;
    const x0 = t.x;
    const z0 = t.y;
    const dx = t.topX - x0;
    const dz = t.topY - z0;
    const ph = rand() * 6.28;
    const flare = (ang) => 1 + (t.flare - t.base) / t.base * Math.pow(0.5 + 0.5 * Math.cos(5 * ang + ph), 2);
    const half = (ang) => 1 + 0.45 * ((t.flare - t.base) / t.base) * Math.pow(0.5 + 0.5 * Math.cos(5 * ang + ph), 2);
    const H = t.fork;
    const along = (y) => {
      const u = Math.min(1, Math.max(0, y / H));
      return [x0 + dx * Math.pow(u, 1.5) + Math.sin(u * 5 + ph) * 0.25, y, z0 + dz * Math.pow(u, 1.5) + Math.cos(u * 4 + ph) * 0.25];
    };
    if (t.kind === "conifer") {
      tube(geo, [{ p: [x0, -0.6, z0], r: t.base, lobes: flare }, { p: [x0, 1, z0], r: t.base * 1.1 }, { p: [x0, 7, z0], r: t.base * 0.7 }], 7, t.group, rand, v0);
      continue;
    }
    const path = [{ p: along(-0.6), r: t.base, lobes: flare }, { p: along(0.5), r: t.base, lobes: half }, { p: along(2), r: t.base * 1.12 }];
    for (let y = 5;y < H; y += 4)
      path.push({ p: along(y), r: t.base * (1.05 - 0.3 * (y / H)) });
    const top = along(H);
    path.push({ p: top, r: t.base * 0.72 });
    const trunkArcs = tube(geo, path, t.kind === "round" ? 8 : 10, t.group, rand, v0);
    const vTop = trunkArcs[trunkArcs.length - 1];
    const nb = t.kind === "round" ? 3 : 2 + (rand() < 0.5 ? 1 : 0);
    const reach = t.canopy.ry ?? 12;
    for (let k = 0;k < nb; k++) {
      const az = ph + k / nb * 2 * Math.PI + (rand() - 0.5) * 0.6;
      const out = 0.45 + rand() * 0.35;
      const dir = norm([Math.cos(az) * out, 1, Math.sin(az) * out]);
      const len = reach * (0.6 + rand() * 0.3);
      const pts = [];
      for (let i = 0;i <= 3; i++) {
        const u = i / 3;
        pts.push({ p: [top[0] + dir[0] * len * u + Math.cos(az) * u * u * 2, top[1] + dir[1] * len * u, top[2] + dir[2] * len * u + Math.sin(az) * u * u * 2], r: t.base * (0.62 - 0.42 * u) });
      }
      const branchArcs = tube(geo, pts, 7, t.group, rand, vTop);
      const mid = pts[1].p;
      const tw = norm([Math.cos(az + 0.9) * 1.2, 0.35, Math.sin(az + 0.9) * 1.2]);
      const tl = 5 + rand() * 3;
      tube(geo, [{ p: mid, r: 0.4 }, { p: [mid[0] + tw[0] * tl * 0.5, mid[1] + tw[1] * tl * 0.5, mid[2] + tw[2] * tl * 0.5], r: 0.28 }, { p: [mid[0] + tw[0] * tl, mid[1] + tw[1] * tl + 1, mid[2] + tw[2] * tl], r: 0.15 }], 5, t.group, rand, branchArcs[1]);
    }
  }
  return geo.build();
}
var WOOD = lin(2167310);
var LANTERN_IRON_SHADE = 0.68;
var IRON = mul3(lin(1512464), LANTERN_IRON_SHADE);
var TRIM = lin(3743756);
var ROOF = WOOD;
var ONE = [1, 1, 1];
var LANTERN_UV = { post: [0, 0, 48, 224], iron: [56, 0, 64, 64], gold: [56, 72, 64, 24], roof: [128, 0, 128, 96] };
var LANTERN_CELL = 256;
var LANT_TPU = 10;
var LANTERN_GLOW = [0.03, 0.09];
var LANTERN_LIGHT = { fill: [6.4, 5.2, 5.2] };
function faceAB(p, n) {
  if (n[0])
    return [n[0] > 0 ? -p[2] : p[2], -p[1]];
  if (n[2])
    return [n[2] > 0 ? p[0] : -p[0], -p[1]];
  return [p[0], n[1] > 0 ? p[2] : -p[2]];
}
function lanternGeo({ paint = false } = {}) {
  const g = new Geo({ uv: paint });
  const Lt = LANTERN;
  const R = LANTERN_UV;
  const S = LANTERN_CELL;
  const CORE = [0.65, 0.65, 0.65];
  const IRON_K = [LANTERN_IRON_SHADE, LANTERN_IRON_SHADE, LANTERN_IRON_SHADE];
  const col = (c) => !paint || c === CORE ? c : c === IRON ? IRON_K : ONE;
  const regionUV = (region, a, b, a0, a1, b0, b1, fit = false) => {
    const [X, Y, W, H] = region === "goldShade" ? [R.gold[0], R.gold[1] + 8, R.gold[2], R.gold[3] - 8] : R[region];
    const sa = fit ? W : Math.max(1, Math.min(W, (a1 - a0) * LANT_TPU));
    const sb = fit ? H : Math.max(1, Math.min(H, (b1 - b0) * LANT_TPU));
    const fa = a1 > a0 ? (a - a0) / (a1 - a0) : 0;
    const fb = b1 > b0 ? (b - b0) / (b1 - b0) : 0;
    return [(X + 0.5 + fa * (sa - 1)) / S, (Y + 0.5 + fb * (sb - 1)) / S];
  };
  const corners = (x0, y0, z0, x1, y1, z1) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
  const range = (pts, n) => {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const q of pts) {
      const [a, b] = faceAB(q, n);
      a0 = Math.min(a0, a);
      a1 = Math.max(a1, a);
      b0 = Math.min(b0, b);
      b1 = Math.max(b1, b);
    }
    return [a0, a1, b0, b1];
  };
  const boxUV = (region, pts, over = pts) => (p, n) => {
    const reg = typeof region === "function" ? region(n) : region;
    const [a, b] = faceAB(p, n);
    const r = range(over, n);
    return reg === "post" && n[1] ? postTopUV(a, b, r) : regionUV(reg, a, b, ...r, reg === "post");
  };
  const postTopUV = (a, b, [a0, a1, b0, b1]) => {
    const [X, Y, W] = R.post;
    return [(X + 0.5 + (a - a0) / (a1 - a0) * (W - 1)) / S, (Y + 0.5 + (b - b0) / (b1 - b0) * 13) / S];
  };
  const box = (x0, y0, z0, x1, y1, z1, c, region, over) => {
    const pts = corners(x0, y0, z0, x1, y1, z1);
    aabb(g, x0, y0, z0, x1, y1, z1, typeof c === "function" ? (n) => col(c(n)) : col(c), 0, paint ? boxUV(region, pts, over) : null);
  };
  const sq = (h, y0, y1, c, region, over) => box(-h, y0, -h, h, y1, h, c, region, over);
  sq(Lt.plinth / 2, 0, 1.25, IRON, "iron");
  sq(Lt.plinth / 2 - 0.6, 1.25, Lt.plinthH, IRON, "iron");
  const p0 = Lt.plinthH;
  const p1 = p0 + Lt.postH;
  const h = Lt.post / 2;
  const post = corners(-h, p0, -h, h, p1, h);
  sq(h - 0.4, p0, p1, paint ? CORE : mul3(WOOD, 0.65), "post", post);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(sx > 0 ? h - 0.8 : -h, p0, sz > 0 ? h - 0.8 : -h, sx > 0 ? h : -h + 0.8, p1, sz > 0 ? h : -h + 0.8, WOOD, "post", post);
  sq(h, p0, p0 + 1.4, WOOD, "post", post);
  sq(h, p1 - 1.4, p1, WOOD, "post", post);
  const t0 = p1;
  const t1 = t0 + Lt.trayH;
  const th = Lt.tray / 2;
  sq(th, t0, t1, (n) => n[1] ? IRON : TRIM, (n) => n[1] ? "iron" : "goldShade");
  box(-th, t1, -th, th, t1 + 0.5, -th + 0.4, TRIM, "gold");
  box(-th, t1, th - 0.4, th, t1 + 0.5, th, TRIM, "gold");
  box(-th, t1, -th + 0.4, -th + 0.4, t1 + 0.5, th - 0.4, TRIM, "gold");
  box(th - 0.4, t1, -th + 0.4, th, t1 + 0.5, th - 0.4, TRIM, "gold");
  const hy0 = t1;
  const hy1 = hy0 + Lt.head;
  const hh = Lt.head / 2;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(sx > 0 ? hh - 0.8 : -hh, hy0, sz > 0 ? hh - 0.8 : -hh, sx > 0 ? hh : -hh + 0.8, hy1, sz > 0 ? hh : -hh + 0.8, IRON, "iron");
  for (const [y0, y1] of [[hy0, hy0 + 0.5], [hy1 - 0.5, hy1]]) {
    box(-hh, y0, -hh, hh, y1, -hh + 0.5, IRON, "iron");
    box(-hh, y0, hh - 0.5, hh, y1, hh, IRON, "iron");
    box(-hh, y0, -hh + 0.5, -hh + 0.5, y1, hh - 0.5, IRON, "iron");
    box(hh - 0.5, y0, -hh + 0.5, hh, y1, hh - 0.5, IRON, "iron");
  }
  const rh = Lt.roof / 2;
  sq(rh, hy1, hy1 + 0.5, TRIM, "gold");
  const apex = [0, hy1 + Lt.roofH, 0];
  const base = [[-rh, hy1 + 0.5, -rh], [rh, hy1 + 0.5, -rh], [rh, hy1 + 0.5, rh], [-rh, hy1 + 0.5, rh]];
  const inside = [0, hy1 + 1, 0];
  const [RX, RY] = R.roof;
  const roofUV = (i) => (p) => p === apex ? [(RX + 64) / S, (RY + 4) / S] : p === base[i] ? [(RX + 126) / S, (RY + 94) / S] : [(RX + 2) / S, (RY + 94) / S];
  for (let i = 0;i < 4; i++)
    g.tri(base[i], base[(i + 1) % 4], apex, col(ROOF), col(ROOF), col(ROOF), 0, inside, paint ? roofUV(i) : null);
  const f0 = hy1 + Lt.roofH - 0.5;
  box(-0.45, f0, -0.45, 0.45, f0 + 0.5, 0.45, TRIM, "gold");
  const fa = [0, Lt.height, 0];
  const fb = [[-0.45, f0 + 0.5, -0.45], [0.45, f0 + 0.5, -0.45], [0.45, f0 + 0.5, 0.45], [-0.45, f0 + 0.5, 0.45]];
  const [GX, GY] = R.gold;
  const finUV = (i) => (p) => p === fa ? [(GX + 5) / S, (GY + 0.5) / S] : p === fb[i] ? [(GX + 9.5) / S, (GY + 3.5) / S] : [(GX + 0.5) / S, (GY + 3.5) / S];
  for (let i = 0;i < 4; i++)
    g.tri(fb[i], fb[(i + 1) % 4], fa, col(TRIM), col(TRIM), col(TRIM), 0, [0, f0 + 0.6, 0], paint ? finUV(i) : null);
  return g.build();
}
var LANTERN_GOLD_LOOK = { goldLit: 0.005, glowK: 0.105, glowPow: 1.5 };
function lanternPaint(mat, box, flick, { size = 1024 } = {}) {
  const own = { uLantBox: { value: box }, uFlick: { value: flick }, uGlowK: { value: LANTERN_GOLD_LOOK.glowK }, uGoldLit: { value: LANTERN_GOLD_LOOK.goldLit }, uGlowPow: { value: LANTERN_GOLD_LOOK.glowPow }, uLantGrad: { value: 8 / size } };
  mat.userData.lantern = own;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, own);
  };
  const [lo, hi] = LANTERN_GLOW.map((v) => v.toFixed(4));
  return patchPaint(mat, `paint:lantern:${flick.length}`, {
    vert: [
      ["#include <common>", `#include <common>
attribute float aLant;
varying float vLant;
uniform vec4 uLantBox;`],
      ["#include <uv_vertex>", `#include <uv_vertex>
vMapUv = uLantBox.xy + uv * uLantBox.zw;
vLant = aLant;`]
    ],
    frag: [
      ["#include <common>", `#include <common>
varying float vLant;
uniform float uFlick[${flick.length}];
uniform float uGlowK;
uniform float uGoldLit;
uniform float uGlowPow;
uniform float uLantGrad;`],
      [
        "#include <map_fragment>",
        `vec4 lantTexel = vec4(0.0);
         float lantKey = 0.0;
         float lantLum = 0.115;
         #ifdef USE_MAP
         {
           vec2 gx = dFdx(vMapUv);
           vec2 gy = dFdy(vMapUv);
           gx *= min(1.0, uLantGrad / max(length(gx), 1e-9));
           gy *= min(1.0, uLantGrad / max(length(gy), 1e-9));
           lantTexel = textureGrad(map, vMapUv, gx, gy);
           lantLum = dot(lantTexel.rgb, vec3(0.2126, 0.7152, 0.0722));
           lantKey = smoothstep(${lo}, ${hi}, lantLum);
           diffuseColor.rgb *= lantTexel.rgb * mix(1.0, uGoldLit, lantKey);
         }
         #endif`
      ],
      [
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += lantTexel.rgb * lantKey * uFlick[int(vLant + 0.5)] * uGlowK * pow(max(lantLum, 1e-4) / 0.115, uGlowPow);`
      ]
    ]
  });
}
function lanternHullGeo() {
  const g = new Geo;
  const Lt = LANTERN;
  const sq = (h, y0, y1) => hullBox(g, -h, y0, -h, h, y1, h);
  sq(Lt.plinth / 2, 0, Lt.plinthH);
  sq(Lt.post / 2, Lt.plinthH, Lt.plinthH + Lt.postH);
  const t0 = Lt.plinthH + Lt.postH;
  sq(Lt.tray / 2, t0, t0 + Lt.trayH + 0.5);
  sq(Lt.head / 2, t0 + Lt.trayH, t0 + Lt.trayH + Lt.head);
  const r0 = t0 + Lt.trayH + Lt.head;
  sq(Lt.roof / 2, r0, r0 + 0.5);
  const rh = Lt.roof / 2;
  const apex = [0, r0 + Lt.roofH, 0];
  const base = [[-rh, r0 + 0.5, -rh], [rh, r0 + 0.5, -rh], [rh, r0 + 0.5, rh], [-rh, r0 + 0.5, rh]];
  const k = [0, 0, 0];
  for (let i = 0;i < 4; i++) {
    const a = base[i];
    const b = base[(i + 1) % 4];
    g.triN(a, b, apex, norm([a[0], 0.3, a[2]]), norm([b[0], 0.3, b[2]]), [0, 1, 0], k);
  }
  hullBox(g, -0.45, r0 + Lt.roofH - 0.5, -0.45, 0.45, Lt.height, 0.45);
  return g.build();
}
var FADE_GLSL = `
  uniform int uFadeMask;
  uniform int uFadeMode;
  uniform sampler2D tSceneDepth;
  uniform vec2 uFadeTex;
  uniform float uFadeA[17];
  varying float vGroup;
  float fadeA() { return uFadeMode == 1 ? uFadeA[int(vGroup + 0.5)] : 1.0; }
  bool faded() {
    int g = int(vGroup + 0.5);
    bool f = g > 0 && ((uFadeMask >> g) & 1) == 1;
    // The fade layer draws a prop only where it is in front of what the main pass drew there.
    if (uFadeMode == 1 && f && texture2D(tSceneDepth, gl_FragCoord.xy / uFadeTex).r < gl_FragCoord.z) return true;
    return (uFadeMode == 0 && f) || (uFadeMode == 1 && !f);
  }
`;
var FLAME_VERT = `
  attribute float aLant;
  attribute float aGroup;
  attribute float aPhase;
  uniform float uTime;
  uniform float uFlick[8];
  varying vec2 vUv;
  varying float vF;
  varying float vGroup;
  varying float vPh;
  void main() {
    vUv = uv;
    vF = uFlick[int(aLant + 0.5)];
    vGroup = aGroup;
    vPh = aPhase;
    vec3 p = position;
    // The tip wavers along screen right; the base stays on the wick.
    float w = sin(uTime * 7.1 + aPhase * 6.0) * 0.22 + sin(uTime * 12.7 + aPhase * 2.3) * 0.1;
    p += vec3(0.7071, 0.0, -0.7071) * w * uv.y * uv.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
var FLAME_FRAG = `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uBody;
  varying vec2 vUv;
  varying float vF;
  varying float vPh;
  ${FADE_GLSL}
  void main() {
    if (faded()) discard;
    float y = vUv.y;
    float x = vUv.x * 2.0 - 1.0 + 0.16 * y * sin(y * 7.0 - uTime * 9.0 + vPh * 5.0);
    float w = 1.75 * sqrt(max(y, 0.0)) * pow(max(1.0 - y, 0.0), 1.1) * (0.92 + 0.12 * vF);
    float a = abs(x) / max(w, 1e-3);
    if (a > 1.0 || y > 0.98) discard;
    vec3 c = a < 0.42 && y < 0.62 ? uCore : a < 0.75 ? uMid : uBody;
    gl_FragColor = vec4(c * (0.85 + 0.3 * vF), fadeA());
  }
`;
var PANE_VERT = `
  attribute float aLant;
  attribute float aGroup;
  uniform float uFlick[8];
  varying vec2 vUv;
  varying float vF;
  varying float vGroup;
  void main() {
    vUv = uv;
    vF = uFlick[int(aLant + 0.5)];
    vGroup = aGroup;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;
var PANE_FRAG = `
  uniform vec3 uAmberLo;
  uniform vec3 uAmberHi;
  varying vec2 vUv;
  varying float vF;
  ${FADE_GLSL}
  void main() {
    if (faded()) discard;
    // Brighter towards the flame, in the middle of the pane.
    vec2 d = (vUv - vec2(0.5, 0.45)) * vec2(1.6, 1.2);
    float glow = clamp(1.0 - length(d), 0.0, 1.0);
    gl_FragColor = vec4(mix(uAmberLo, uAmberHi, glow) * (0.55 + 0.45 * glow) * vF * 0.9, 1.0);
  }
`;
function lanternLightGeos(L, rand) {
  const flame = new Geo({ uv: true });
  const pane = new Geo({ uv: true });
  const fl = { lant: [], grp: [], ph: [] };
  const pl = { lant: [], grp: [] };
  const R = RIGHT;
  const n0 = [0, 0, 0];
  L.lanterns.forEach((l, i) => {
    const c = [l.x, l.flame, l.y];
    for (const [off, w, hgt, y0] of [[0, 4.4, 5.1, -2.3], [-1.35, 2.8, 3.8, -2], [1.4, 2.7, 3.6, -2.1]]) {
      const ph = rand();
      const o = [c[0] + R[0] * off - 0.2 * Math.abs(off), c[1] + y0, c[2] + R[2] * off - 0.2 * Math.abs(off)];
      const P = (u, v) => [o[0] + R[0] * (u - 0.5) * w, o[1] + v * hgt, o[2] + R[2] * (u - 0.5) * w];
      const k = [1, 1, 1];
      flame.triN(P(0, 0), P(1, 0), P(1, 1), n0, n0, n0, k, k, k, 0, [0, 0], [1, 0], [1, 1]);
      flame.triN(P(0, 0), P(1, 1), P(0, 1), n0, n0, n0, k, k, k, 0, [0, 0], [1, 1], [0, 1]);
      for (let v = 0;v < 6; v++)
        fl.lant.push(i), fl.grp.push(l.group), fl.ph.push(ph);
    }
    const hh = LANTERN.head / 2 - 0.25;
    const y0 = LANTERN.plinthH + LANTERN.postH + LANTERN.trayH + 0.5;
    const y1 = y0 + LANTERN.head - 1;
    const w = LANTERN.head / 2 - 0.8;
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = l.x + ax * hh;
      const cz = l.y + az * hh;
      const tx = az;
      const tz = -ax;
      const P = (u, v) => [cx + tx * (u - 0.5) * 2 * w, v, cz + tz * (u - 0.5) * 2 * w];
      const k = [1, 1, 1];
      const nn = [ax, 0, az];
      pane.triN(P(0, y0), P(1, y0), P(1, y1), nn, nn, nn, k, k, k, 0, [0, 0], [1, 0], [1, 1]);
      pane.triN(P(0, y0), P(1, y1), P(0, y1), nn, nn, nn, k, k, k, 0, [0, 0], [1, 1], [0, 1]);
      for (let v = 0;v < 6; v++)
        pl.lant.push(i), pl.grp.push(l.group);
    }
  });
  const flameGeo = flame.build();
  flameGeo.setAttribute("aLant", new Xe(fl.lant, 1));
  flameGeo.setAttribute("aGroup", new Xe(fl.grp, 1));
  flameGeo.setAttribute("aPhase", new Xe(fl.ph, 1));
  const paneGeo = pane.build();
  paneGeo.setAttribute("aLant", new Xe(pl.lant, 1));
  paneGeo.setAttribute("aGroup", new Xe(pl.grp, 1));
  return { flameGeo, paneGeo };
}
function lanternLightMaterials(look, flick) {
  const shared = { uFadeMask: look.uFadeMask, uFadeMode: look.uFadeMode, tSceneDepth: look.tSceneDepth, uFadeTex: look.uFadeTex, uFadeA: look.uFadeA, uFlick: { value: flick }, uTime: { value: 0 } };
  const flame = new Kt({
    uniforms: { ...shared, uCore: { value: new Se(16511656) }, uMid: { value: new Se(16569161) }, uBody: { value: new Se(15309611) } },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    toneMapped: false
  });
  const pane = new Kt({
    uniforms: { ...shared, uAmberLo: { value: new Se(9784082) }, uAmberHi: { value: new Se(13663014) } },
    vertexShader: PANE_VERT,
    fragmentShader: PANE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: ja,
    blendEquation: _i,
    blendSrc: eo,
    blendDst: eo,
    blendSrcAlpha: Qa,
    blendDstAlpha: eo,
    toneMapped: false
  });
  return { flame, pane, time: shared.uTime };
}
var APPLE_R = 2.25;
function appleGeo() {
  return new aa(APPLE_R, 10, 7);
}
var APPLE_FILL = [1.2, 1.1, 1.1];
var APPLE_CELLS = ["apple", "appleLeaf"];
var APPLE_PAINT = { body: [285, 290, 729, 712], leaf: [452, 148, 712, 304], depth: 1.2 };
function applePaintGeo() {
  const s = appleGeo();
  const sp = s.getAttribute("position").array;
  const sn = s.getAttribute("normal").array;
  const n = sp.length / 3;
  const pos = [...sp];
  const nor = [...sn];
  const uv = [];
  const cell = [];
  for (let i = 0;i < n; i++) {
    const p = [sp[3 * i], sp[3 * i + 1], sp[3 * i + 2]];
    uv.push(0.5 - dot(p, RIGHT) / (2 * APPLE_R), 0.5 - dot(p, UP) / (2 * APPLE_R));
    cell.push(0);
  }
  const [bx0, by0, bx1, by1] = APPLE_PAINT.body;
  const sx = (x) => APPLE_R - 2 * APPLE_R * (x - bx0) / (bx1 - bx0);
  const sy = (y) => APPLE_R - 2 * APPLE_R * (y - by0) / (by1 - by0);
  const [lx0, ly0, lx1, ly1] = APPLE_PAINT.leaf;
  const d = APPLE_PAINT.depth;
  const at = (a, b) => [a * RIGHT[0] + b * UP[0] + d * BACK[0], a * RIGHT[1] + b * UP[1] + d * BACK[1], a * RIGHT[2] + b * UP[2] + d * BACK[2]];
  const corners = [
    [at(sx(lx1), sy(ly0)), [1, 0]],
    [at(sx(lx1), sy(ly1)), [1, 1]],
    [at(sx(lx0), sy(ly1)), [0, 1]],
    [at(sx(lx0), sy(ly0)), [0, 0]]
  ];
  for (const [p, t] of corners) {
    pos.push(...p);
    nor.push(...BACK);
    uv.push(...t);
    cell.push(1);
  }
  const index = [...s.index.array, n, n + 1, n + 2, n, n + 2, n + 3];
  s.dispose();
  const geo = new ot;
  geo.setAttribute("position", new Xe(pos, 3));
  geo.setAttribute("normal", new Xe(nor, 3));
  geo.setAttribute("uv", new Xe(uv, 2));
  geo.setAttribute("aCell", new Xe(cell, 1));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}
function appleDepth() {
  const m = new oa({ depthPacking: Ch });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
attribute float aCell;`).replace("#include <project_vertex>", `#include <project_vertex>
if (aCell > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`);
  };
  m.customProgramCacheKey = () => "appledepth";
  return m;
}
var CLOVER_CELLS = ["cloverA", "cloverB"];
function cloverGeos() {
  const { leafR: R, leafD: D, dome, tilt } = CLOVER;
  const lift = R * Math.sin(tilt * DEG);
  const main = new Geo({ uv: true, cell: true });
  const hull = new Geo;
  const LIGHT = lin(3889456);
  const MID = lin(2837029);
  const DARK = lin(1123089);
  const UNDER = lin(463880);
  const k0 = [0, 0, 0];
  const up = [0, 1, 0];
  for (let k = 0;k < 3; k++) {
    const phi = (-135 + k * 120) * DEG;
    const c = [D * Math.cos(phi), lift, D * Math.sin(phi)];
    const tiltP = (p) => {
      const q = rotAxis(sub(p, c), RIGHT, tilt * DEG);
      return [q[0] + c[0], q[1] + c[1], q[2] + c[2]];
    };
    const tiltN = (n) => norm(rotAxis(n, RIGHT, tilt * DEG));
    const out = [Math.cos(phi), 0, Math.sin(phi)];
    const side = [-Math.sin(phi), 0, Math.cos(phi)];
    const leafUV = (o) => [0.5 + 0.5 * dot(o, side) / (1.035 * R), 0.5 - 0.5 * dot(o, out) / (1.035 * R)];
    const cell = k === 1 ? 0 : 1;
    const rim = [];
    const inner = [];
    for (let j = 0;j < 12; j++) {
      let a = j / 12 * 2 * Math.PI;
      const aw = a > Math.PI ? a - 2 * Math.PI : a;
      const rho = R * (1 - 0.3 * Math.exp(-((aw / 0.33) ** 2))) * (1 + 0.035 * Math.cos(6 * a));
      a += phi;
      const d = [Math.cos(a), 0, Math.sin(a)];
      rim.push({ p: tiltP([c[0] + d[0] * rho, c[1], c[2] + d[2] * rho]), n: tiltN([d[0] * 0.6, 1, d[2] * 0.6]), h: tiltN(d), u: leafUV(mul3(d, rho)) });
      inner.push({ p: tiltP([c[0] + d[0] * rho * 0.55, c[1] + dome * 0.7, c[2] + d[2] * rho * 0.55]), n: tiltN([d[0] * 0.3, 1, d[2] * 0.3]), h: tiltN([d[0] * 0.5, 1, d[2] * 0.5]), u: leafUV(mul3(d, rho * 0.55)) });
    }
    const mid = [0.5, 0.5];
    const top = { p: tiltP([c[0], c[1] + dome, c[2]]), n: tiltN(up), h: tiltN(up) };
    const bot = { p: tiltP([c[0], c[1] - 0.12, c[2]]), n: tiltN([0, -1, 0]), h: tiltN([0, -1, 0]) };
    for (let j = 0;j < 12; j++) {
      const a = inner[j];
      const b = inner[(j + 1) % 12];
      const ra = rim[j];
      const rb = rim[(j + 1) % 12];
      main.triN(top.p, a.p, b.p, top.n, a.n, b.n, LIGHT, MID, MID, 0, mid, a.u, b.u, cell);
      main.triN(a.p, ra.p, rb.p, a.n, ra.n, rb.n, MID, DARK, DARK, 0, a.u, ra.u, rb.u, cell);
      main.triN(a.p, rb.p, b.p, a.n, rb.n, b.n, MID, DARK, MID, 0, a.u, rb.u, b.u, cell);
      main.triN(bot.p, rb.p, ra.p, bot.n, bot.n, bot.n, UNDER, UNDER, UNDER, 0, mid, rb.u, ra.u, cell);
      hull.triN(top.p, a.p, b.p, top.h, a.h, b.h, k0);
      hull.triN(a.p, ra.p, rb.p, a.h, ra.h, rb.h, k0);
      hull.triN(a.p, rb.p, b.p, a.h, rb.h, b.h, k0);
      hull.triN(bot.p, rb.p, ra.p, bot.h, [rb.h[0], -0.3, rb.h[2]], [ra.h[0], -0.3, ra.h[2]], k0);
    }
  }
  return { geo: main.build(), hull: hull.build() };
}
var FCELL = 32;
var FLOWER_GRID = { daisy: [0, 0], buttercup: [1, 0], cosmos: [2, 0], lupine: [3, 0], leaf: [0, 1], lupineLeaf: [1, 1], stem: [2, 1] };
var FLOWER_FILL = [1.4, 1.3, 1.1];
var FLOWER_PROC = { stem: "stem", daisyA: "daisy", daisyB: "daisy", buttercup: "buttercup", cosmos: "cosmos", flowerLeaf: "leaf", lupineFloret: "lupine", lupineLeaf: "lupineLeaf" };
function flowerBox(name) {
  const [cx, cy] = FLOWER_GRID[FLOWER_PROC[name]];
  return [(cx + 0.06) / 4, (cy + 0.94) / 2, 0.22, -0.44];
}
function flowerAtlas() {
  const W = FCELL * 4;
  const H = FCELL * 2;
  const data = new Uint8Array(W * H * 4);
  const hex = (h) => [h >> 16 & 255, h >> 8 & 255, h & 255];
  const cell = ([cx, cy], fn) => {
    for (let j = 0;j < FCELL; j++)
      for (let i = 0;i < FCELL; i++) {
        const u = (i + 0.5) / FCELL * 2 - 1;
        const v = (j + 0.5) / FCELL * 2 - 1;
        const c = fn(u, v, hyp(u, v), Math.atan2(v, u));
        if (!c)
          continue;
        const o = ((cy * FCELL + j) * W + cx * FCELL + i) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
  };
  cell(FLOWER_GRID.daisy, (u, v, r, a) => r < 0.3 ? hex(r < 0.18 ? 15249456 : 14721056) : r < 0.94 && (Math.cos(6 * a) > -0.35 || r < 0.42) ? hex(r > 0.78 ? 14079688 : 15789280) : null);
  cell(FLOWER_GRID.buttercup, (u, v, r, a) => r < 0.24 ? hex(13139974) : r < 0.9 * (0.72 + 0.28 * Math.cos(5 * a)) ? hex(r > 0.6 ? 13142544 : 14723096) : null);
  cell(FLOWER_GRID.cosmos, (u, v, r, a) => r < 0.22 ? hex(14725168) : r < 0.95 * (0.66 + 0.34 * Math.abs(Math.cos(4 * a))) ? hex(r > 0.65 ? 13647968 : 14703226) : null);
  cell(FLOWER_GRID.lupine, (u, v) => {
    for (const [cx, cy, rr, col] of [[-0.35, -0.2, 0.42, 9066696], [0.35, -0.15, 0.4, 10382040], [0, 0.35, 0.44, 11832038]])
      if (hyp(u - cx, v - cy) < rr)
        return hex(col);
    return null;
  });
  cell(FLOWER_GRID.leaf, (u, v) => {
    const t = (v + 1) / 2;
    const w = 0.55 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
    return Math.abs(u) < w ? hex(Math.abs(u) < 0.06 ? 5933620 : 3828260) : null;
  });
  cell(FLOWER_GRID.lupineLeaf, (u, v, r, a) => r < 0.95 && r > 0.08 && Math.cos(5 * (a - 0.3)) > 0.7 - 0.5 * r ? hex(4156970) : r < 0.12 ? hex(3497506) : null);
  cell(FLOWER_GRID.stem, () => hex(3103264));
  return cardAtlas(data, W, H);
}
function flowerGeo() {
  const g = new Geo({ uv: true });
  const part = [];
  const R = RIGHT;
  const F = [Math.SQRT1_2, 0, Math.SQRT1_2];
  const tiltN = (n, ang) => norm(rotAxis(n, R, ang));
  const up = [0, 1, 0];
  const w = [1, 1, 1];
  const S = (s, y) => [R[0] * s, y, R[2] * s];
  const st = [0.5, 0.5];
  g.triN(S(-0.5, 0), S(0.5, 0), S(0.5, 1), up, up, up, w, w, w, 0, st, st, st);
  g.triN(S(-0.5, 0), S(0.5, 1), S(-0.5, 1), up, up, up, w, w, w, 0, st, st, st);
  for (let i = 0;i < 6; i++)
    part.push(0);
  const card = (o, ang, rot, p) => {
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const P = (u, v) => {
      const a = (u - 0.5) * cr - (v - 0.5) * sr;
      const b = (u - 0.5) * sr + (v - 0.5) * cr;
      const q = rotAxis([R[0] * a - F[0] * b, 0, R[2] * a - F[2] * b], R, ang);
      return [o[0] + q[0], o[1] + q[1], o[2] + q[2]];
    };
    const n = tiltN(up, ang);
    const U = (u, v) => [u, 1 - v];
    g.triN(P(0, 0), P(1, 0), P(1, 1), n, n, n, w, w, w, 0, U(0, 0), U(1, 0), U(1, 1));
    g.triN(P(0, 0), P(1, 1), P(0, 1), n, n, n, w, w, w, 0, U(0, 0), U(1, 1), U(0, 1));
    for (let i = 0;i < 6; i++)
      part.push(p);
  };
  card([0, 0, 0], FLOWER_TILT * DEG, 0, 1);
  card([R[0] * 0.3 + F[0] * 0.1, 0.15, R[2] * 0.3 + F[2] * 0.1], 35 * DEG, 0.6, 2);
  const geo = g.build();
  geo.deleteAttribute("color");
  geo.setAttribute("aPart", new Xe(part, 1));
  return geo;
}
function flowerMaterial(look, { atlas = null, stem = null, size = 1024 } = {}) {
  const map = atlas || flowerAtlas();
  const m = paintMaterial(look, { map, alphaTest: 0.5, wind: 1, flatten: true, group: true, fill: FLOWER_FILL });
  const own = { uStem: { value: new et(...stem || flowerBox("stem")) }, uFlowerGrad: { value: 8 / size } };
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    Object.assign(sh.uniforms, own);
  };
  const headFill = ["reflectedLight.indirectDiffuse += uShadeFill * BRDF_Lambert(diffuseColor.rgb);", "reflectedLight.indirectDiffuse += uShadeFill * BRDF_Lambert(diffuseColor.rgb) * vFlowerHead;"];
  patchPaint(m, atlas ? "flower:paint" : "flower", {
    vert: [
      ["#include <common>", `#include <common>
attribute float aPart;
attribute vec4 aFlower;
attribute vec4 aHead;
attribute vec4 aLeaf;
uniform vec4 uStem;
varying float vFlowerHead;`],
      [
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vFlowerHead = aPart > 0.5 && aPart < 1.5 ? 1.0 : 0.0;
         if (aPart < 0.5) { transformed.xz *= aFlower.w; transformed.y *= aFlower.y; }
         else if (aPart < 1.5) { transformed = transformed * aFlower.x + vec3(0.0, aFlower.y, 0.0); }
         else { transformed *= aFlower.z; }`
      ],
      ["#include <uv_vertex>", `#include <uv_vertex>
{ vec4 b = aPart > 1.5 ? aLeaf : (aPart > 0.5 ? aHead : uStem); vMapUv = b.xy + uv * b.zw; }`],
      WIND_BY_HEIGHT
    ],
    frag: atlas ? [
      ["#include <common>", `#include <common>
uniform float uFlowerGrad;
varying float vFlowerHead;`],
      headFill,
      [
        "#include <map_fragment>",
        `{
               vec2 gx = dFdx(vMapUv);
               vec2 gy = dFdy(vMapUv);
               gx *= min(1.0, uFlowerGrad / max(length(gx), 1e-9));
               gy *= min(1.0, uFlowerGrad / max(length(gy), 1e-9));
               diffuseColor *= textureGrad(map, vMapUv, gx, gy);
             }`
      ]
    ] : [["#include <common>", `#include <common>
varying float vFlowerHead;`], headFill]
  });
  if (!atlas)
    m.addEventListener("dispose", () => map.dispose());
  return m;
}
function flowerInstances(L, scat, rand) {
  const list = [];
  const flower = [];
  const head = [];
  const leaf = [];
  const group = [];
  let daisies = 0;
  for (const f of scat.flowers) {
    list.push([f.x, f.z, f.y, (rand() - 0.5) * 40 * DEG]);
    const onBush = f.group > 0;
    flower.push(f.head, f.stem, onBush ? 0 : f.head * 0.55, onBush ? 0 : 0.32);
    head.push(f.kind === "daisy" ? daisies++ % 2 ? "daisyB" : "daisyA" : f.kind);
    leaf.push("flowerLeaf");
    group.push(f.group);
  }
  for (const l of L.lupines) {
    const n = l.florets;
    for (let k = 0;k < n; k++) {
      const u = k / (n - 1);
      const y = l.h * (0.38 + 0.62 * u) - LUPINE.floret * 0.2;
      const s = LUPINE.floret * (1 - 0.35 * u);
      const jx = (rand() - 0.5) * LUPINE.jitter * Math.SQRT2 * (1 - 0.5 * u);
      list.push([l.x + jx, 0, l.y - jx, (rand() - 0.5) * 60 * DEG]);
      flower.push(s, y, k === 0 ? LUPINE.leaf : 0, k === n - 1 ? 0.55 : 0);
      head.push("lupineFloret");
      leaf.push("lupineLeaf");
      group.push(0);
    }
  }
  return { list, flower, head, leaf, group };
}
function instanced(geo, mat, n, { cast = false, receive = false } = {}) {
  const m = new ks(geo, mat, n);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.frustumCulled = false;
  return m;
}
function plain(geo, mat, { cast = false, receive = false } = {}) {
  const m = new Tt(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.frustumCulled = false;
  return m;
}

// site/js/gfx3d/paint3d.js
var DIR = "art3d/garden/";
var CARD_CELLS2 = [
  "leafA",
  "leafB",
  "leafC",
  "leafD",
  "pinkA",
  "pinkB",
  "pinkC",
  "whiteA",
  "whiteB",
  "whiteC",
  "whiteD",
  "whiteBigA",
  "whiteBigB",
  "conA",
  "conB",
  "conC",
  "hedgeA",
  "hedgeB",
  "hedgeC",
  "hedgeD",
  "mossA",
  "mossB",
  "mossC"
];
var FLOWER_CELLS2 = ["stem", "daisyA", "daisyB", "buttercup", "cosmos", "flowerLeaf", "lupineFloret", "lupineLeaf"];
var TILES = ["grass", "terrace", "floor"];
function fnv1a32(bytes) {
  let h = 2166136261;
  for (let i = 0;i < bytes.length; i++)
    h = Math.imul(h ^ bytes[i], 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}
async function fetchJSON(name) {
  try {
    const r = await fetch(DIR + name);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
async function fetchImage(file, meta) {
  if (!meta || typeof createImageBitmap !== "function")
    return null;
  for (const ext of ["webp", "png"]) {
    const want = meta[ext];
    if (!want)
      continue;
    try {
      const r = await fetch(`${DIR}${file}.${ext}`);
      if (!r.ok)
        continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length !== want.bytes || fnv1a32(buf) !== want.fnv1a32) {
        console.warn(`3D view: ${file}.${ext} does not match its record (stale file?); not used`);
        continue;
      }
      const bmp = await createImageBitmap(new Blob([buf], { type: `image/${ext}` }), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
      if (bmp.width === meta.w && bmp.height === meta.h)
        return bmp;
      bmp.close?.();
    } catch {}
  }
  return null;
}
function pixelsOf(bmp) {
  const { width: w, height: h } = bmp;
  const cv = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
}
async function loadAtlas() {
  const json = await fetchJSON("atlas.json");
  const img = json?.image;
  if (!img || !json.cells || img.w !== json.size || img.h !== json.size)
    return null;
  const bmp = await fetchImage("atlas", img);
  if (!bmp)
    return null;
  try {
    const t0 = performance.now();
    const mips = cardMips(pixelsOf(bmp), img.w, img.h, { linear: true });
    return { cells: json.cells, size: json.size, mips, ms: performance.now() - t0 };
  } finally {
    bmp.close?.();
  }
}
var ROOT_N = 256;
function rootSamples(bmp) {
  const n = bmp.width;
  if (bmp.height !== n || n % ROOT_N)
    return null;
  const px = pixelsOf(bmp);
  const k = n / ROOT_N;
  const lut = new Float32Array(256).map((_, i) => ((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)(i / 255));
  const out = new Float32Array(ROOT_N * ROOT_N * 3);
  for (let j = 0;j < n; j++)
    for (let i = 0;i < n; i++) {
      const o = (j * n + i) * 4;
      const q = ((j / k | 0) * ROOT_N + (i / k | 0)) * 3;
      out[q] += lut[px[o]];
      out[q + 1] += lut[px[o + 1]];
      out[q + 2] += lut[px[o + 2]];
    }
  const w = 1 / (k * k);
  for (let q = 0;q < out.length; q++)
    out[q] *= w;
  return out;
}
function floorRootAt2(roots, x, y, over = 160) {
  const f = (v) => Math.min(ROOT_N - 1, Math.max(0, (v / (2 * over) + 0.5) * ROOT_N - 0.5));
  const fx = f(x);
  const fy = f(y);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(ROOT_N - 1, x0 + 1);
  const y1 = Math.min(ROOT_N - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (i, j, c) => roots[(j * ROOT_N + i) * 3 + c];
  return [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x1, y0, c) * tx) * (1 - ty) + (at(x0, y1, c) * (1 - tx) + at(x1, y1, c) * tx) * ty);
}
async function loadTiles() {
  const json = await fetchJSON("tiles.json");
  if (!json)
    return {};
  const out = {};
  await Promise.all(TILES.map(async (name) => {
    const meta = json[name];
    const bitmap = meta?.file ? await fetchImage(meta.file, meta) : null;
    if (!bitmap)
      return;
    if (name !== "floor")
      return void (out[name] = { meta, bitmap });
    let roots = null;
    try {
      roots = rootSamples(bitmap);
    } catch {
      roots = null;
    }
    if (roots)
      out[name] = { meta, bitmap, roots };
    else
      bitmap.close?.();
  }));
  return out;
}
async function loadGardenPaint2() {
  try {
    const [atlas, tiles] = await Promise.all([loadAtlas().catch(() => null), loadTiles().catch(() => ({}))]);
    const garden = { atlas, grass: tiles.grass || null, terrace: tiles.terrace || null, floor: tiles.floor || null };
    return atlas || garden.grass || garden.terrace || garden.floor ? garden : null;
  } catch {
    return null;
  }
}
function gardenTextures2(garden, gl) {
  if (!garden)
    return null;
  const textures = [];
  const out = { atlas: null, cells: null, grass: null, terrace: null, floor: null, floorRoots: null, meta: {}, textures, dispose: () => textures.forEach((t) => t.dispose()) };
  if (garden.atlas) {
    out.atlas = mipTexture(garden.atlas.mips);
    out.atlas.name = "garden-atlas";
    out.cells = garden.atlas.cells;
    textures.push(out.atlas);
  }
  const aniso = Math.max(1, Math.min(4, gl?.capabilities?.getMaxAnisotropy?.() || 1));
  for (const name of TILES) {
    const src = garden[name];
    if (!src)
      continue;
    const t = new ol(src.bitmap);
    t.name = `garden-${name}`;
    t.colorSpace = kn;
    t.flipY = false;
    t.wrapS = t.wrapT = name === "floor" ? yi : vi;
    t.magFilter = name === "floor" ? bt : tn;
    t.anisotropy = aniso;
    out[name] = t;
    out.meta[name] = src.meta;
    if (name === "floor")
      out.floorRoots = src.roots;
    textures.push(t);
  }
  return textures.length ? out : null;
}
function cellTable2(paint, names) {
  const cells = paint?.atlas && paint.cells;
  if (!cells)
    return null;
  const box = [];
  const inv = [];
  for (const n of names) {
    const c = cells[n];
    if (!c || !Array.isArray(c.uv) || c.uv.length !== 4)
      return null;
    box.push(new et(c.uv[0], c.uv[1], c.uv[2], c.uv[3]));
    const m = c.mode === "ratio" && Array.isArray(c.mean) ? c.mean : null;
    if (m && !m.every((x) => x > 0.0001))
      return null;
    inv.push(m ? new U(1 / m[0], 1 / m[1], 1 / m[2]) : new U(1, 1, 1));
  }
  return { box, inv };
}
function barkCells2(mat, table, size) {
  const own = { uBark: { value: table.box[0] }, uBarkInv: { value: table.inv[0] }, uBarkGrad: { value: 8 / size } };
  mat.userData.bark = own;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, own);
  };
  return patchPaint(mat, "paint:bark", {
    vert: [
      ["#include <common>", `#include <common>
varying vec2 vRep;`],
      ["#include <uv_vertex>", `#include <uv_vertex>
vRep = uv;`]
    ],
    frag: [
      ["#include <common>", `#include <common>
varying vec2 vRep;
uniform vec4 uBark;
uniform vec3 uBarkInv;
uniform float uBarkGrad;`],
      [
        "#include <map_fragment>",
        `{
           vec2 t = abs(fract(vRep * 0.5) * 2.0 - 1.0);
           vec2 gx = dFdx(vRep) * uBark.zw;
           vec2 gy = dFdy(vRep) * uBark.zw;
           gx *= min(1.0, uBarkGrad / max(length(gx), 1e-9));
           gy *= min(1.0, uBarkGrad / max(length(gy), 1e-9));
           vec4 sampledDiffuseColor = textureGrad(map, uBark.xy + t * uBark.zw, gx, gy);
           diffuseColor *= sampledDiffuseColor;
           diffuseColor.rgb *= uBarkInv;
         }`
      ]
    ]
  });
}
function atlasCells2(mat, table, { attr = "aCell", flipV = false, key = "cells", maxLevel = null, size = 1024, glints = false } = {}) {
  const N = table.box.length;
  const own = { uCellBox: { value: table.box }, uCellInv: { value: table.inv }, uCellGrad: { value: maxLevel == null ? 1 : 2 ** maxLevel / size } };
  mat.userData.cells = own;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base.call(mat, sh, r);
    Object.assign(sh.uniforms, own);
  };
  const uv = flipV ? "vec2(uv.x, 1.0 - uv.y)" : "uv";
  const read = maxLevel == null ? `#include <map_fragment>
         vec4 cellTexel = vec4(0.0);
         #ifdef USE_MAP
           ${glints ? "cellTexel = texture2D(map, vMapUv);" : ""}
         #endif` : `vec4 cellTexel = vec4(0.0);
         #ifdef USE_MAP
         {
           vec2 gx = dFdx(vMapUv);
           vec2 gy = dFdy(vMapUv);
           gx *= min(1.0, uCellGrad / max(length(gx), 1e-9));
           gy *= min(1.0, uCellGrad / max(length(gy), 1e-9));
           cellTexel = textureGrad(map, vMapUv, gx, gy);
           diffuseColor *= cellTexel;
         }
         #endif`;
  const glint = glints ? [["#include <color_fragment>", `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, cellTexel.rgb, smoothstep(0.45, 0.6, cellTexel.r));`]] : [];
  return patchPaint(mat, `paint:${key}:${attr}:${N}:${flipV ? 1 : 0}:${maxLevel ?? "-"}:${glints ? "g" : "-"}`, {
    vert: [
      ["#include <common>", `#include <common>
attribute float ${attr};
uniform vec4 uCellBox[${N}];
uniform vec3 uCellInv[${N}];
varying vec3 vCellInv;`],
      ["#include <uv_vertex>", `#include <uv_vertex>
{ int ci = int(${attr} + 0.5); vec4 b = uCellBox[ci]; vMapUv = b.xy + ${uv} * b.zw; vCellInv = uCellInv[ci]; }`]
    ],
    frag: [
      ["#include <common>", `#include <common>
varying vec3 vCellInv;
uniform float uCellGrad;`],
      ["#include <map_fragment>", `${read}
diffuseColor.rgb *= vCellInv;`],
      ...glint
    ]
  });
}

export { makeLookUniforms, GROUND_SHADE_LIFT, paintMaterial, charLight, paintDepth, outlineMaterial, makeBrushNoise, R_SEEN, TIERS, WALL_DEPTH, LANTERN, CLOVER, CARD, gardenLayout, TUFT_REACH, scatter, FLOOR_DECALS, lin, mix3, mul3, norm, Geo, patchPaint, WIND_BY_HEIGHT, flattenHull, cardAtlas, inst, fillMatrices, STONE_LIGHT, STONE_CELLS, buildStoneGeo, BARK_LIGHT, buildTrunkGeo, LANTERN_LIGHT, lanternGeo, lanternPaint, lanternHullGeo, lanternLightGeos, lanternLightMaterials, appleGeo, APPLE_FILL, APPLE_CELLS, applePaintGeo, appleDepth, CLOVER_CELLS, cloverGeos, flowerBox, flowerGeo, flowerMaterial, flowerInstances, instanced, plain, CARD_CELLS2, FLOWER_CELLS2, floorRootAt2, loadGardenPaint2, gardenTextures2, cellTable2, barkCells2, atlasCells2 };
