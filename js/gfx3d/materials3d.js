// The 3D view's materials (docs/3D-PLAN.md 5.4, 5.5, 4.10, 4.11).
//
// One "paint" material for everything lit — the floor, stone, props, foliage, grass, flowers and
// the characters: three's toon material, extended. The sun, its shadow and the leaf dapples are
// combined first and only then stepped through a few flat bands (left alone, three steps only N·L
// and leaves shadow edges smooth, where the target's pool and the frog's shadow are hard and
// notched), with a little brush noise so band edges come out jagged like paint. Shade is a colour,
// not just darker: the unlit side leans teal, the lit side a touch warm. The lanterns are one
// analytic term in every material (no light slots, no bake). Variants by define: wind (grass
// bends by height², cards sway), flattened depth for lawn ground cover (so a marking paints over a
// tuft), fade groups, and the character extras (flash, tint, fill, a hard rim, i-frame alpha,
// the death dissolve).
//
// Outlines are inverted hulls, pushed out in clip space so the line is 1.2–1.4 low-resolution
// texels wide at any zoom, dark all round and warmed to olive-brown where they face the sun.
import { MeshToonMaterial, MeshBasicMaterial, MeshDepthMaterial, RGBADepthPacking, BackSide, DataTexture, RGBAFormat, Vector2, Vector3, Vector4, Color, LinearFilter, RepeatWrapping } from "./three-lib.js?v=df092a6";

/** The uniforms every paint material shares, owned by one renderer. */
export function makeLookUniforms() {
  const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  white.needsUpdate = true;
  const grey = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, RGBAFormat);
  grey.needsUpdate = true;
  return {
    uSunMask: { value: white },
    uSunMaskScale: { value: new Vector4(1 / 320, 1 / 320, 0.5, 0.5) }, // world XZ → uv: xz·scale + offset
    uSunDrift: { value: new Vector2(0, 0) },
    uPool: { value: new Vector4(0, 0, 60, 40) }, // centre x, z; radii across and along the screen (tuned at G1)
    uPoolOn: { value: 0 },
    uAlbedo: { value: 0 }, // 1: every painted surface shows its plain base colour, unlit (the bench's ?albedo=1)
    uPoolFloor: { value: 0.3 }, // how much sun reaches outside the pool
    uNoise: { value: grey },
    uNoiseAmt: { value: 0.07 },
    uBandLo: { value: new Vector4(0.1, 0.34, 0.64, 0) }, // band thresholds
    uBandVal: { value: new Vector4(0.0, 0.34, 0.68, 1.0) }, // band values
    uShadeTint: { value: new Vector3(0.62, 1.12, 1.12) },
    uLitTint: { value: new Color(0xffe9a0) },
    uLant: { value: Array.from({ length: 8 }, () => new Vector4()) },
    uLantCount: { value: 0 },
    uLantColor: { value: new Color(0xffa640) },
    uLantRange: { value: 60 },
    uLantPower: { value: 30 }, // tuned in a capture (4.10); the wall's stone scales it by its own lant.k (props3d.js STONE_LIGHT), so the coping beside every lantern reaches the target's #dfaa5c
    uWind: { value: new Vector4(0.7, 0.7, 0, 0) }, // dir x, dir z, gust 0..1, time
    uWindAmp: { value: 0.3 }, // world units at the tip (clamped to half a texel)
    uTexelWorld: { value: 0.5 }, // one low-resolution texel, in world units
    uWindStep: { value: 0 }, // 1: sway in whole texels, stepped at 9 Hz
    uFadeMask: { value: 0 },
    uFadeMode: { value: 0 }, // 0: main pass (faded groups dropped); 1: the fade layer (only them)
    tSceneDepth: { value: null }, // the main pass's depth: the fade layer draws a prop only where it is in front
    uFadeTex: { value: new Vector2(1, 1) },
    uFadeA: { value: new Float32Array(17).fill(1) }, // each group's opacity on the fade layer (fade3d.js)
    uFlatR: { value: 120 },
  };
}

const PARS_VERTEX = /* glsl */ `
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
const PROJECT = /* glsl */ `
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

const PARS_FRAGMENT = /* glsl */ `
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
  uniform vec3 uTintCol;
  uniform float uTintAmt;
  uniform float uAlpha;
  uniform float uDissolve;
  uniform vec3 uFill;
  uniform vec3 uRimCol;
  uniform float uRimAmt;
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
        float lit = min(max(ndl, 0.0), sh) * sunMaskAt() + paintNoise() * uNoiseAmt * 2.0;
        float band = bandOf(lit);
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

const OUTGOING = /* glsl */ `
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
      float fb = fl < -0.15 ? 0.34 : fl < 0.3 ? 0.68 : 1.0;
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
          kOut = max(kOut, pale * (0.58 + 0.3 * smoothstep(-0.6, 0.7, fl)) * float(PAINT_CHAR_MAX));
        }
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
  if (uAlbedo > 0.5) outgoingLight = diffuseColor.rgb;
  outgoingLight = mix(outgoingLight, uTintCol, uTintAmt);
  outgoingLight = mix(outgoingLight, vec3(1.0), uFlash);
  diffuseColor.a *= uAlpha;
  if (uDissolve > 0.0) {
    vec2 c = mod(floor(gl_FragCoord.xy), 2.0);
    float b = (c.x + c.y * 2.0 + 0.5) / 4.0;
    if (uDissolve > b) discard;
  }
`;

/**
 * The ground's deep shade (the floor and the grass tufts; paintMaterial shadeLift): linear
 * irradiance added where the sun band is 0, so a leaf dapple or canopy shadow outside the pool, or
 * a body's shadow, reads dark green on the lawn (the target's #101c12-#1b2c1a) and dark teal-green
 * on the terrace, not black (M4a's sky-only shade gave #000a00-#001700 holes).
 */
export const GROUND_SHADE_LIFT = [0.85, 0.6, 1.1]; // near neutral: a bluer lift turns the terrace's (bluer) slabs navy

/**
 * A paint material. `look` is makeLookUniforms() (shared); options: color, map, vertexColors,
 * alphaTest, side, wind (1 grass/flowers, 2 cards), flatten (lawn ground cover), group (fade
 * groups: an `aGroup` attribute), char (the character extras, with the brush noise in UV space, as
 * it moves), emissive, fill (a flat fill light, [r, g, b] linear irradiance or an sRGB
 * hex, added after the shade tint: the wall's stone), lant ({ k, wrap, sat, top, tint, green }:
 * this material's take on the lantern term, tint a linear [r, g, b] on the flame's colour where a
 * warm surface faces up, green one where the albedo is green; the defaults
 * 1, 0.2, 0, 0, white, white are the plain term, 4.10), sunRim ({ light: [r, g, b] linear
 * irradiance, edge }: the sun's lit edge on the screen-right side of a round prop, where the view
 * normal's x passes `edge`; the trunks, props3d.js BARK_LIGHT), shadeLift ([r, g, b] linear
 * irradiance added in the lowest sun band only: the ground and its cover, GROUND_SHADE_LIFT).
 */
export function paintMaterial(look, { color = 0xffffff, map = null, vertexColors = false, alphaTest = 0, side, wind = 0, flatten = false, group = false, char = false, emissive = 0x000000, lantLit = true, fill = null, lant = null, sunRim = null, shadeLift = null } = {}) {
  const m = new MeshToonMaterial({ color, map, vertexColors, alphaTest, emissive });
  if (side !== undefined) m.side = side;
  const own = {
    uFlash: { value: 0 },
    uTintCol: { value: new Color(0x8b96b8) },
    uTintAmt: { value: 0 },
    uAlpha: { value: 1 },
    uDissolve: { value: 0 },
    uFill: { value: new Color(0x2a2016) },
    uRimCol: { value: new Color(0xfdcd21) },
    uRimAmt: { value: char ? 0.85 : 0 },
    uShadeFill: { value: Array.isArray(fill) ? new Color(...fill) : new Color(fill ?? 0x000000) }, // [r, g, b] linear, or an sRGB hex
    uLantK: { value: lant?.k ?? 1 },
    uLantWrap: { value: lant?.wrap ?? 0.2 },
    uLantSat: { value: lant?.sat ?? 0 },
    uLantTop: { value: lant?.top ?? 0 },
    uLantTint: { value: new Color(...(lant?.tint ?? [1, 1, 1])) }, // linear
    uLantGreen: { value: new Color(...(lant?.green ?? [1, 1, 1])) }, // linear
  };
  if (sunRim) {
    own.uSunRim = { value: new Color(...sunRim.light) }; // linear
    own.uSunRimEdge = { value: sunRim.edge ?? 0.55 };
  }
  if (shadeLift) own.uShadeLift = { value: new Color(...shadeLift) }; // linear irradiance, in the lowest sun band only
  m.userData.paint = own;
  m.defines = { ...(m.defines || {}) };
  if (wind) m.defines.PAINT_WIND = wind;
  if (flatten) m.defines.PAINT_FLATTEN = 1;
  if (group) m.defines.PAINT_GROUP = 1;
  if (char) m.defines.PAINT_CHAR = 1;
  if (!lantLit) m.defines.PAINT_NOLANT = 1; // a lantern's own body: its bevels glow from a mask, not its flame (4.9)
  if (char) m.defines.PAINT_UVNOISE = 1;
  if (fill != null) m.defines.PAINT_FILL = 1;
  if (sunRim) m.defines.PAINT_SUNRIM = 1;
  if (shadeLift) m.defines.PAINT_SHADELIFT = 1;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, look, own);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>\n${PARS_VERTEX}`).replace("#include <project_vertex>", PROJECT);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <lights_toon_pars_fragment>", `#include <lights_toon_pars_fragment>\n#undef RE_Direct\n#undef RE_IndirectDiffuse\n${PARS_FRAGMENT}`)
      .replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;", OUTGOING)
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
#ifdef PAINT_GROUP
if (uFadeMode == 1) gl_FragColor.a = uFadeA[int(vGroup + 0.5)];
#endif`);
  };
  m.customProgramCacheKey = () => `paint:${wind}:${flatten}:${group}:${char}:${char}:${lantLit}:${fill != null}:${!!sunRim}:${!!shadeLift}`;
  return m;
}

/** The shadow-casting twin of a swaying or cut-out paint material (customDepthMaterial). */
export function paintDepth(look, { wind = 0, map = null, alphaTest = 0 } = {}) {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map, alphaTest });
  if (wind) {
    m.defines = { PAINT_WIND: wind };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, look);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>\n${PARS_VERTEX}`).replace("#include <project_vertex>", PROJECT);
    };
    m.customProgramCacheKey = () => `paintdepth:${wind}`;
  }
  return m;
}

/**
 * An outline hull: drawn with front faces culled, pushed out `px` low-resolution texels in clip
 * space. `uView` is the render target's size in texels (set every frame).
 */
export function outlineMaterial(look, { color = 0x100f0b, warm = 0x5a4a10, px = 1.3, group = false } = {}) {
  const m = new MeshBasicMaterial({ color, side: BackSide });
  const own = { uView: { value: new Vector2(480, 1030) }, uPx: { value: px }, uWarm: { value: new Color(warm) }, uSun: { value: new Vector3(0, 0.906, -0.423).normalize() }, uAlpha: { value: 1 } };
  m.userData.outline = own;
  if (group) m.defines = { PAINT_GROUP: 1 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, look, own);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec2 uView; uniform float uPx; uniform vec3 uSun; varying float vWarm;
         #ifdef PAINT_GROUP
           attribute float aGroup; varying float vGroup;
         #endif`
      )
      .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3( normal );\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif")
      .replace(
        "#include <project_vertex>",
        `vec4 pw = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           pw = instanceMatrix * pw;
         #endif
         pw = modelMatrix * pw;
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
         if (dot(cn, cn) > 1e-10) gl_Position.xy += normalize(cn) * uPx * 2.0 / uView * gl_Position.w;`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uWarm; uniform float uAlpha; uniform int uFadeMask; uniform int uFadeMode; uniform sampler2D tSceneDepth; uniform vec2 uFadeTex; uniform float uFadeA[17]; varying float vWarm;
         #ifdef PAINT_GROUP
           varying float vGroup;
         #endif`
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `vec4 diffuseColor = vec4( mix(diffuse, uWarm, vWarm), opacity * uAlpha );
         #ifdef PAINT_GROUP
           { int g = int(vGroup + 0.5); bool faded = g > 0 && ((uFadeMask >> g) & 1) == 1;
             if (uFadeMode == 0 && faded) discard; if (uFadeMode == 1 && !faded) discard;
             if (uFadeMode == 1 && texture2D(tSceneDepth, gl_FragCoord.xy / uFadeTex).r < gl_FragCoord.z) discard; }
         #endif`
      )
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
#ifdef PAINT_GROUP
if (uFadeMode == 1) gl_FragColor.a = uFadeA[int(vGroup + 0.5)];
#endif`);
  };
  m.customProgramCacheKey = () => `outline:${group}`;
  return m;
}

/** A small grey noise texture, made by our own code (brush noise, docs/3D-PLAN.md 5.4). */
export function makeBrushNoise(rand, size = 128) {
  const data = new Uint8Array(size * size * 4);
  // Blobby value noise: a few octaves of random cells, bilinear.
  const cells = [8, 16, 32].map((n) => ({ n, v: Float32Array.from({ length: n * n }, () => rand()) }));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let s = 0;
      let wsum = 0;
      for (const [i, { n, v }] of cells.entries()) {
        const fx = (x / size) * n;
        const fy = (y / size) * n;
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
      const g = Math.round((s / wsum) * 255);
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = g;
      data[o + 3] = 255;
    }
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}
