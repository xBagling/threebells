// Lighting moods: whole-scene lighting presets for exploring other looks (the owner, 2026-10-02:
// "10 different types of lighting … I want to explore some different visuals"). None is the game's
// own look; the bench shows one with &mood=<id> (dev-fight.html), and render3d.js applies it once
// at start. Each sets any of:
//
//   sun        colour (hex), intensity, elev (degrees above the ground), az (degrees round from the
//              far side, the default's direction; + turns it towards the screen's right)
//   sky        top and bottom colours (hex) and intensity: the hemisphere light, the shade's colour
//   litTint    the warm lean of lit paint (hex); shadeTint: the shade's lean, [r, g, b] multipliers
//   pool       the light pool round the hero: its size (1 = default) and floor (sun outside it, 0–1)
//   lant       the lanterns' colour (hex) and power
//   clear      the void's colour (hex)
//   bloom, vignette, vigCol [r, g, b]: the final pass; exposure, saturation, contrast, and split
//              toning: shadowCol / shadowAmt and hiCol / hiAmt (sRGB 0–1)
export const MOODS = {
  "blue-hour": {
    name: "Blue Hour Lanterns",
    sun: { color: 0x8fa8ff, intensity: 5.5, elev: 22, az: 35 },
    sky: { top: 0x23306e, bottom: 0x0d1024, intensity: 3.2 },
    litTint: 0xb8c8ff,
    shadeTint: [0.7, 0.85, 1.35],
    pool: { size: 1.1, floor: 0.35 },
    lant: { color: 0xffa040, power: 75 },
    clear: 0x05071a,
    bloom: 0.9,
    vignette: 0.85,
    vigCol: [0.35, 0.4, 0.7],
    exposure: 1.4,
    saturation: 1.1,
    shadowCol: [0.05, 0.08, 0.25],
    shadowAmt: 0.25,
  },
  moonlight: {
    name: "Moonlit Night",
    sun: { color: 0xc8d8ff, intensity: 7, elev: 50, az: -40 },
    sky: { top: 0x1a2440, bottom: 0x060810, intensity: 1.8 },
    litTint: 0xd8e4ff,
    shadeTint: [0.75, 0.85, 1.25],
    pool: { size: 0.9, floor: 0.12 },
    lant: { color: 0xff8a30, power: 60 },
    clear: 0x020308,
    bloom: 0.7,
    vignette: 1.0,
    vigCol: [0.2, 0.25, 0.4],
    exposure: 1.35,
    saturation: 0.55,
    contrast: 1.1,
    shadowCol: [0.02, 0.04, 0.12],
    shadowAmt: 0.35,
    hiCol: [0.8, 0.88, 1.0],
    hiAmt: 0.15,
  },
  noon: {
    name: "Harsh Noon",
    sun: { color: 0xfffaf0, intensity: 15, elev: 85, az: 0 },
    sky: { top: 0x7fb4d8, bottom: 0x3c4a28, intensity: 2.6 },
    litTint: 0xffffff,
    shadeTint: [0.85, 0.95, 1.1],
    pool: { size: 3, floor: 0.95 },
    lant: { power: 8 },
    clear: 0x1a2a14,
    bloom: 0.15,
    vignette: 0.25,
    vigCol: [0.8, 0.8, 0.8],
    exposure: 1.05,
    saturation: 1.05,
    contrast: 1.18,
  },
  autumn: {
    name: "Autumn Amber",
    sun: { color: 0xff9a3c, intensity: 12, elev: 30, az: 25 },
    sky: { top: 0x6a4a2a, bottom: 0x2a1408, intensity: 2.6 },
    litTint: 0xffb060,
    shadeTint: [1.15, 0.85, 0.75],
    pool: { size: 1.4, floor: 0.4 },
    lant: { color: 0xffb050, power: 35 },
    clear: 0x140804,
    bloom: 0.5,
    vignette: 0.8,
    vigCol: [0.6, 0.4, 0.25],
    saturation: 1.25,
    contrast: 1.05,
    shadowCol: [0.25, 0.08, 0.04],
    shadowAmt: 0.2,
    hiCol: [1.0, 0.75, 0.4],
    hiAmt: 0.15,
  },
  mist: {
    name: "Misty Morning",
    sun: { color: 0xfff2dc, intensity: 6, elev: 18, az: -25 },
    sky: { top: 0xa8c4c8, bottom: 0x5a6a60, intensity: 4.5 },
    litTint: 0xfff4e0,
    shadeTint: [0.95, 1.02, 1.05],
    pool: { size: 2.2, floor: 0.7 },
    lant: { color: 0xffd8a0, power: 15 },
    clear: 0x8a9a96,
    bloom: 0.6,
    vignette: 0.35,
    vigCol: [0.92, 0.95, 0.95],
    exposure: 1.1,
    saturation: 0.75,
    contrast: 0.85,
    shadowCol: [0.55, 0.62, 0.62],
    shadowAmt: 0.18,
  },
  storm: {
    name: "Storm Light",
    sun: { color: 0xd8f0c0, intensity: 9, elev: 40, az: 70 },
    sky: { top: 0x2a3430, bottom: 0x0c100c, intensity: 2.2 },
    litTint: 0xe0ffd0,
    shadeTint: [0.8, 0.9, 0.95],
    pool: { size: 1.3, floor: 0.15 },
    lant: { color: 0xffc070, power: 25 },
    clear: 0x070a08,
    bloom: 0.3,
    vignette: 1.2,
    vigCol: [0.25, 0.3, 0.28],
    saturation: 0.65,
    contrast: 1.3,
    shadowCol: [0.04, 0.07, 0.07],
    shadowAmt: 0.3,
  },
  spotlight: {
    name: "Theatre Spotlight",
    sun: { color: 0xfff0d0, intensity: 16, elev: 75, az: 0 },
    sky: { top: 0x101418, bottom: 0x040404, intensity: 0.9 },
    litTint: 0xfff0d0,
    shadeTint: [0.9, 0.9, 1.0],
    pool: { size: 0.55, floor: 0.0 },
    lant: { color: 0xff9030, power: 12 },
    clear: 0x000000,
    bloom: 0.5,
    vignette: 1.4,
    vigCol: [0.05, 0.05, 0.07],
    contrast: 1.15,
  },
  storybook: {
    name: "Pastel Storybook",
    sun: { color: 0xfff0f4, intensity: 9, elev: 55, az: -15 },
    sky: { top: 0xb8a8e0, bottom: 0x7a8a70, intensity: 4.2 },
    litTint: 0xffe8f0,
    shadeTint: [1.1, 0.95, 1.25],
    pool: { size: 2.5, floor: 0.75 },
    lant: { color: 0xffc8e0, power: 20 },
    clear: 0x3a2e48,
    bloom: 0.45,
    vignette: 0.3,
    vigCol: [0.85, 0.75, 0.9],
    exposure: 1.22,
    saturation: 0.7,
    contrast: 0.85,
    shadowCol: [0.45, 0.35, 0.6],
    shadowAmt: 0.4,
    hiCol: [1.0, 0.85, 0.92],
    hiAmt: 0.3,
  },
  synthset: {
    name: "Crimson Sunset",
    sun: { color: 0xff4a5a, intensity: 15, elev: 15, az: 40 },
    sky: { top: 0x5a1e6e, bottom: 0x1a0828, intensity: 3.4 },
    litTint: 0xff8070,
    shadeTint: [1.0, 0.7, 1.35],
    pool: { size: 1.2, floor: 0.35 },
    lant: { color: 0xffb040, power: 40 },
    clear: 0x12041c,
    bloom: 0.85,
    vignette: 0.9,
    vigCol: [0.45, 0.2, 0.55],
    exposure: 1.35,
    saturation: 1.2,
    contrast: 1.08,
    shadowCol: [0.2, 0.04, 0.3],
    shadowAmt: 0.2,
    hiCol: [1.0, 0.6, 0.45],
    hiAmt: 0.15,
  },
  enchanted: {
    name: "Enchanted Glade",
    sun: { color: 0x9affd8, intensity: 6, elev: 60, az: -10 },
    sky: { top: 0x0f5a5a, bottom: 0x06201a, intensity: 3.2 },
    litTint: 0xb0ffe8,
    shadeTint: [0.7, 1.2, 1.3],
    pool: { size: 1.0, floor: 0.2 },
    lant: { color: 0x40e8ff, power: 40 },
    clear: 0x021210,
    bloom: 1.1,
    vignette: 0.95,
    vigCol: [0.15, 0.45, 0.45],
    saturation: 1.2,
    contrast: 1.05,
    shadowCol: [0.0, 0.15, 0.16],
    shadowAmt: 0.3,
    hiCol: [0.75, 1.0, 0.9],
    hiAmt: 0.12,
  },
};

/** Apply a mood to a renderer's lights and shared uniforms, once (the final pass reads it per frame). */
export function applyMood(mood, { sun, sky, look, clear }) {
  if (mood.sun) {
    if (mood.sun.color != null) sun.color.setHex(mood.sun.color);
    if (mood.sun.intensity != null) sun.intensity = mood.sun.intensity;
    if (mood.sun.elev != null || mood.sun.az != null) {
      const e = ((mood.sun.elev ?? 65) * Math.PI) / 180;
      const a = ((mood.sun.az ?? 0) * Math.PI) / 180;
      sun.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(250);
    }
  }
  if (mood.sky) {
    if (mood.sky.top != null) sky.color.setHex(mood.sky.top);
    if (mood.sky.bottom != null) sky.groundColor.setHex(mood.sky.bottom);
    if (mood.sky.intensity != null) sky.intensity = mood.sky.intensity;
  }
  if (mood.litTint != null) look.uLitTint.value.setHex(mood.litTint);
  if (mood.shadeTint) look.uShadeTint.value.set(...mood.shadeTint);
  if (mood.pool) {
    if (mood.pool.size != null) look.uPool.value.set(0, 0, 60 * mood.pool.size, 40 * mood.pool.size);
    if (mood.pool.floor != null) look.uPoolFloor.value = mood.pool.floor;
  }
  if (mood.lant) {
    if (mood.lant.color != null) look.uLantColor.value.setHex(mood.lant.color);
    if (mood.lant.power != null) look.uLantPower.value = mood.lant.power;
  }
  if (mood.clear != null) clear.setHex(mood.clear);
}
