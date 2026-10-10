// Sound: recorded effects for the sword, the toad, the bells and the hero (public/audio/, SAMPLES below), the rest
// made in the browser, tuned by a number rather than re-recorded. Everything is short, dry and a little metallic — a hall at night.
//
// Nothing is created until the first gesture, as browsers require, and everything is routed
// through one gain so the settings screen has a single knob to turn.
let ac = null;
let master = null;
let musicGain = null;
let enabled = true;
let musicStop = null;

function ensure() {
  if (ac) return ac;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ac = new C();
  master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
  musicGain = ac.createGain();
  musicGain.gain.value = 0.3;
  musicGain.connect(master);
  return ac;
}
export function unlock() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume();
  loadSamples(); // (the recorded sounds, fetched and decoded once the first gesture allows audio)
}
// Out of sight (another app or tab, the phone locked — the owner, 2026-10-10: "the game is running in the background on
// my phone even when i go to another window. I hear the sound"): the audio is suspended, so nothing plays and the
// phone's audio hardware can sleep; it carries on where it was as the page comes back. (The drawing stops by itself:
// a hidden page gets no animation frames, and a fight pauses, fight.js.)
function sleepAudio() {
  if (ac && ac.state === "running") ac.suspend();
}
function wakeAudio() {
  if (ac && ac.state === "suspended") ac.resume();
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", () => (document.hidden ? sleepAudio() : wakeAudio()));
  // (some phones only send these when an app is switched away from or the page is put in the back/forward cache)
  window.addEventListener("pagehide", sleepAudio);
  window.addEventListener("pageshow", () => !document.hidden && wakeAudio());
}
export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.55 : 0;
}
export function setMusic(v) {
  if (musicGain) musicGain.gain.value = v ? 0.3 : 0;
}

const now = () => (ac ? ac.currentTime : 0);

/** One oscillator with an envelope. The workhorse. */
function tone({ type = "sine", f = 440, f2 = null, t = 0.12, a = 0.004, g = 0.3, delay = 0, curve = "exp", to = null }) {
  const c = ensure();
  if (!c || !enabled) return;
  const o = c.createOscillator();
  const gn = c.createGain();
  o.type = type;
  const t0 = now() + delay;
  o.frequency.setValueAtTime(f, t0);
  if (f2) (curve === "exp" ? o.frequency.exponentialRampToValueAtTime : o.frequency.linearRampToValueAtTime).call(o.frequency, Math.max(1, f2), t0 + t);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(g, t0 + a);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(gn).connect(to || master);
  o.start(t0);
  o.stop(t0 + t + 0.02);
}

/** A burst of noise, shaped by a filter: impacts, splashes, wind. */
function noise({ t = 0.14, g = 0.3, type = "lowpass", f = 1200, f2 = null, q = 1, delay = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const n = Math.floor(c.sampleRate * t);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const flt = c.createBiquadFilter();
  flt.type = type;
  const t0 = now() + delay;
  flt.frequency.setValueAtTime(f, t0);
  if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + t);
  flt.Q.value = q;
  const gn = c.createGain();
  gn.gain.setValueAtTime(g, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(flt).connect(gn).connect(master);
  src.start(t0);
}

const S = {
  // the hero
  swing: () => (noise({ t: 0.09, g: 0.16, type: "bandpass", f: 2600, f2: 900, q: 1.2 }), tone({ type: "triangle", f: 620, f2: 260, t: 0.08, g: 0.06 })),
  hit: () => {
    noise({ t: 0.08, g: 0.3, type: "highpass", f: 1400, f2: 500 });
    tone({ type: "square", f: 180, f2: 70, t: 0.09, g: 0.16 });
  },
  hitHeavy: () => {
    noise({ t: 0.16, g: 0.4, type: "lowpass", f: 2400, f2: 260 });
    tone({ type: "sawtooth", f: 140, f2: 46, t: 0.2, g: 0.22 });
  },
  clang: () => {
    tone({ type: "square", f: 1180, f2: 740, t: 0.22, g: 0.12 });
    tone({ type: "square", f: 1770, f2: 1200, t: 0.16, g: 0.06, delay: 0.01 });
  },
  roll: () => noise({ t: 0.22, g: 0.14, type: "lowpass", f: 900, f2: 200 }),

  // Cued by the painted frames (gfx/render.js), not by the buttons: a foot landing, the blade
  // actually cutting, a roll coming down, the heavy strike hitting the floor. Each is varied a
  // little every time, so eight footsteps a second never sound like one sample on repeat.
  step: (ground = "bog") => {
    const v = 0.85 + Math.random() * 0.3;
    if (ground === "hall") {
      // a splash in the shallow water
      noise({ t: 0.12, g: 0.07, type: "bandpass", f: 2200 * v, f2: 900, q: 1.4 });
      noise({ t: 0.06, g: 0.04, type: "highpass", f: 4200 * v });
    } else if (ground === "meadow" || ground === "meadow-night") {
      // a soft rustle through short grass, and the ground under it
      noise({ t: 0.09, g: 0.05, type: "bandpass", f: 3600 * v, f2: 2200, q: 0.8 });
      tone({ type: "sine", f: 105 * v, f2: 65, t: 0.05, g: 0.035 });
    } else if (ground === "ash") {
      // grit and cinders underfoot
      noise({ t: 0.07, g: 0.08, type: "highpass", f: 2600 * v, f2: 1400 });
      tone({ type: "sine", f: 95 * v, f2: 60, t: 0.06, g: 0.05 });
    } else {
      // a soft squelch in the mud
      noise({ t: 0.1, g: 0.08, type: "lowpass", f: 700 * v, f2: 240 });
      tone({ type: "sine", f: 120 * v, f2: 70, t: 0.07, g: 0.05 });
    }
  },
  rollLand: () => {
    noise({ t: 0.16, g: 0.16, type: "lowpass", f: 900, f2: 160 });
    tone({ type: "sine", f: 130, f2: 55, t: 0.14, g: 0.12 });
  },
  whoosh: () => {
    const v = 0.9 + Math.random() * 0.2;
    noise({ t: 0.13, g: 0.16, type: "bandpass", f: 3000 * v, f2: 700, q: 1.3 });
    tone({ type: "triangle", f: 640 * v, f2: 240, t: 0.1, g: 0.05 });
  },
  whooshHeavy: () => {
    noise({ t: 0.22, g: 0.22, type: "bandpass", f: 1900, f2: 380, q: 1.1 });
    tone({ type: "sawtooth", f: 260, f2: 90, t: 0.2, g: 0.07 });
  },
  slamGround: () => {
    noise({ t: 0.3, g: 0.3, type: "lowpass", f: 1500, f2: 110 });
    tone({ type: "sine", f: 96, f2: 38, t: 0.34, g: 0.24 });
    noise({ t: 0.12, g: 0.1, type: "highpass", f: 2800, f2: 1600, delay: 0.02 });
  },
  hurt: () => {
    tone({ type: "sawtooth", f: 300, f2: 90, t: 0.22, g: 0.2 });
    noise({ t: 0.16, g: 0.18, type: "lowpass", f: 900, f2: 200 });
  },
  death: () => {
    tone({ type: "sawtooth", f: 220, f2: 40, t: 1.1, g: 0.24 });
    tone({ type: "sine", f: 110, f2: 26, t: 1.4, g: 0.18, delay: 0.05 });
    noise({ t: 0.9, g: 0.12, type: "lowpass", f: 700, f2: 90 });
  },
  drink: () => tone({ type: "sine", f: 300, f2: 760, t: 0.3, g: 0.16 }),
  heal: () => (tone({ type: "sine", f: 520, f2: 880, t: 0.34, g: 0.12 }), tone({ type: "sine", f: 780, f2: 1320, t: 0.3, g: 0.07, delay: 0.06 })),
  throw: () => noise({ t: 0.08, g: 0.18, type: "bandpass", f: 3200, f2: 1400, q: 2 }),
  cast: () => tone({ type: "triangle", f: 220, f2: 900, t: 0.4, g: 0.12 }),
  blink: () => (tone({ type: "sine", f: 1200, f2: 300, t: 0.18, g: 0.12 }), noise({ t: 0.12, g: 0.1, type: "highpass", f: 2000 })),
  frost: () => (tone({ type: "sine", f: 1600, f2: 420, t: 0.5, g: 0.1 }), noise({ t: 0.4, g: 0.1, type: "highpass", f: 3000, f2: 900 })),
  shieldUp: () => (tone({ type: "triangle", f: 400, f2: 700, t: 0.3, g: 0.12 }), tone({ type: "sine", f: 900, t: 0.4, g: 0.05, delay: 0.05 })),
  buff: () => tone({ type: "triangle", f: 340, f2: 620, t: 0.35, g: 0.12 }),
  horn: () => (tone({ type: "sawtooth", f: 150, f2: 110, t: 0.8, g: 0.2 }), tone({ type: "sawtooth", f: 226, f2: 166, t: 0.75, g: 0.1, delay: 0.02 })),
  use: () => tone({ type: "triangle", f: 500, f2: 700, t: 0.12, g: 0.1 }),
  deny: () => tone({ type: "square", f: 180, f2: 120, t: 0.12, g: 0.1 }),

  // the bosses
  lash: () => (noise({ t: 0.18, g: 0.26, type: "bandpass", f: 1800, f2: 400, q: 1.5 }), tone({ type: "sawtooth", f: 420, f2: 110, t: 0.18, g: 0.12 })),
  hop: () => tone({ type: "sine", f: 160, f2: 420, t: 0.3, g: 0.14 }),
  slam: () => {
    noise({ t: 0.4, g: 0.45, type: "lowpass", f: 1400, f2: 90 });
    tone({ type: "sine", f: 110, f2: 32, t: 0.5, g: 0.3 });
  },
  spit: () => noise({ t: 0.16, g: 0.2, type: "bandpass", f: 900, f2: 300, q: 1 }),
  swarm: () => tone({ type: "sawtooth", f: 90, f2: 130, t: 0.7, g: 0.1 }),
  fire: () => noise({ t: 0.5, g: 0.2, type: "lowpass", f: 2600, f2: 400 }),
  nova: () => {
    noise({ t: 0.6, g: 0.3, type: "lowpass", f: 3000, f2: 200 });
    tone({ type: "sawtooth", f: 240, f2: 60, t: 0.5, g: 0.16 });
  },
  veil: () => noise({ t: 0.9, g: 0.16, type: "bandpass", f: 700, f2: 1800, q: 0.7 }),
  storm: () => noise({ t: 1.2, g: 0.18, type: "bandpass", f: 1400, q: 0.6 }),
  wave: () => noise({ t: 0.8, g: 0.26, type: "lowpass", f: 1800, f2: 220 }),
  chain: () => {
    for (let i = 0; i < 5; i++) tone({ type: "square", f: 900 + i * 60, f2: 700, t: 0.05, g: 0.05, delay: i * 0.035 });
  },
  hands: () => (noise({ t: 0.5, g: 0.2, type: "lowpass", f: 900, f2: 200 }), tone({ type: "sawtooth", f: 80, f2: 160, t: 0.5, g: 0.12 })),
  flood: () => (noise({ t: 1.6, g: 0.3, type: "lowpass", f: 2400, f2: 180 }), tone({ type: "sine", f: 70, f2: 40, t: 1.4, g: 0.2 })),
  stagger: () => (tone({ type: "square", f: 300, f2: 120, t: 0.3, g: 0.16 }), noise({ t: 0.3, g: 0.2, type: "lowpass", f: 1800, f2: 300 })),
  phase: () => {
    tone({ type: "sawtooth", f: 120, f2: 300, t: 0.7, g: 0.18 });
    noise({ t: 0.6, g: 0.16, type: "lowpass", f: 1200 });
  },
  enrage: () => {
    for (let i = 0; i < 3; i++) tone({ type: "sawtooth", f: 200 + i * 40, f2: 90, t: 0.5, g: 0.12, delay: i * 0.1 });
  },

  // the frame
  bell: () => {
    // A struck bell: a fundamental, a minor third above it, and a long hum underneath.
    [1, 2.4, 3.2, 4.6].forEach((m, i) => tone({ type: "sine", f: 262 * m, t: 2.6 - i * 0.3, g: 0.2 / (i + 1.4), a: 0.002 }));
    tone({ type: "sine", f: 131, t: 3.2, g: 0.1 });
    noise({ t: 0.12, g: 0.12, type: "highpass", f: 4000 });
  },
  click: () => (tone({ type: "triangle", f: 700, f2: 1000, t: 0.06, g: 0.1 }), noise({ t: 0.03, g: 0.05, type: "highpass", f: 3000 })),
  coin: () => (tone({ type: "square", f: 1200, t: 0.06, g: 0.08 }), tone({ type: "square", f: 1800, t: 0.12, g: 0.06, delay: 0.05 })),
  win: () => [0, 4, 7, 12].forEach((s, i) => tone({ type: "triangle", f: 330 * Math.pow(2, s / 12), t: 0.5, g: 0.12, delay: i * 0.1 })),
  lose: () => [0, -2, -5, -9].forEach((s, i) => tone({ type: "triangle", f: 330 * Math.pow(2, s / 12), t: 0.7, g: 0.1, delay: i * 0.14 })),
  open: () => tone({ type: "sine", f: 300, f2: 620, t: 0.25, g: 0.1 }),
};

// ---------------------------------------------------------------------------------------------
// Recorded sounds (2026-10-08, the owner: "Add the sounds to the correct places in the game, use the recommended"):
// generated locally with Stable Audio Open (tools/sfx/gen_sfx.py), the recommended take of each picked by measure
// (tools/sfx/pick_sfx.py) and kept in public/audio/. Each game sound below plays its file once it has loaded, a little
// varied in pitch each time (rate ± RATE_JITTER) so a repeated hit never sounds like one sample; until then, or if a
// file fails, the made-up sound above it plays as before. A function picks the file from the call's argument (the
// cut: each of the sword's three has its own swing). Gains set them in the mix the made-up sounds were tuned to.
// (`slam` and `cast` are Gnasher's landing and croak — the only boss in the season; another boss that sends them will
// want its own.)
// ---------------------------------------------------------------------------------------------
const SAMPLES = {
  whoosh: [(step) => (step === 1 ? "sword_swing_2" : "sword_swing_1"), 0.5],
  swing: [() => "sword_swing_1", 0.5],
  whooshHeavy: [() => "sword_swing_1", 0.6], // (the first cut's swing: the owner, 2026-10-08, "The 3rd swing can have the same sound as the first swing")
  hit: [() => "sword_hit", 0.55],
  hitHeavy: [() => "sword_hit_heavy", 0.65],
  clang: [() => "sword_clang", 0.45],
  lash: [() => "toad_tongue_lash", 0.6],
  hop: [() => "toad_hop", 0.55],
  slam: [() => "toad_land", 0.75], // (his hops: the owner, 2026-10-09, take A of the five heavy landings)
  arrive: [() => "toad_arrive", 0.9], // (his first landing, after the bell: take C — "a lot heavier")
  // the chest after a win (sim/world.js stepChest): its landing, and its opening — the reward's chime and glitter
  chestLand: [() => "chest_land", 0.7],
  chestOpen: [() => "chest_open", 0.75], // (both the owner's take A of four, 2026-10-09)
  // and a reward tune under it, on past the loot card (the owner, 2026-10-09: "dopamine music"; tune B, "make it longer":
  // B played twice, joined; then "add some bass and tempo": 15% faster and re-rendered from itself with a bass line
  // and drums asked for (tools/sfx/remix_sfx.py): the owner's pick B, level 12 — about half its sound below 150 Hz, 7.4 s
  chestMusic: [() => "mus_chest", 0.5],
  spit: [() => "toad_spit", 0.55],
  cast: [() => "toad_croak", 0.6],
  stagger: [() => "toad_hurt", 0.6],
  swarm: [() => "toad_flies", 0.4],
  bell: [() => "bell_strike", 0.6],
  bellSmall: [() => "bell_small", 0.5],
  roll: [() => "hero_dash", 0.45], // (the owner, 2026-10-09: dash A of five)
  hurt: [(dmg) => (dmg >= 20 ? "hero_hurt_heavy" : "hero_hurt"), 0.6], // (a big blow, a heavier thud)
  // 2026-10-09, the owner: "add sounds for more things that we have missed such as when the hero gets hit": his grunt
  // with every blow (one of three, no made-up twin), his fall, Gnasher's last croak, his rage and his new phase, the
  // knives, a spell, a spit landing, a shot rolled through
  hurtVoice: [() => ["hero_grunt_a", "hero_grunt_b", "hero_grunt_c"][Math.floor(Math.random() * 3)], 0.5],
  death: [() => "hero_death", 0.6],
  bossDeath: [() => "toad_death", 0.65],
  enrage: [() => "toad_enrage", 0.6],
  phase: [() => "toad_phase", 0.6],
  throw: [() => "knife_throw", 0.5],
  buff: [() => "magic_buff", 0.45],
  shieldUp: [() => "magic_buff", 0.45],
  splat: [() => "goo_splat", 0.5],
  graze: [() => "sword_swing_2", 0.22],
  // the jump: up, down, and a low attack passing under him (the owner, 2026-10-09)
  jump: [() => "hero_jump", 0.5],
  jumpLand: [() => "hero_jump_land", 0.5],
  vault: [() => "sword_swing_1", 0.3],
  drink: [() => "hero_drink", 0.5],
  // his cry as the blade lands, one of three, a beat after the hit (the owner, 2026-10-08: "add sounds for when hitting
  // the toad so that we can hear it get hurt"); no made-up twin, and at most one each CRY_GAP s
  bossHurt: [() => (now() - lastCry < CRY_GAP ? null : ((lastCry = now()), ["toad_pain_a", "toad_pain_b", "toad_pain_c"][Math.floor(Math.random() * 3)])), 0.5, 0.06],
};
const CRY_GAP = 0.2;
let lastCry = -1;
const RATE_JITTER = 0.04;
const buffers = new Map(); // file name → AudioBuffer (or null while loading / failed)
let samplesAsked = false;
function loadSamples() {
  const c = ensure();
  if (!c || samplesAsked || typeof fetch !== "function") return;
  samplesAsked = true;
  const names = new Set(["sword_swing_1", "sword_swing_2", "sword_hit", "sword_hit_heavy", "sword_clang", "toad_tongue_lash", "toad_hop", "toad_land", "toad_arrive", "chest_land", "chest_open", "mus_chest", "toad_spit", "toad_croak", "toad_hurt", "toad_flies", "bell_strike", "bell_small", "hero_dash", "hero_jump", "hero_jump_land", "hero_hurt", "hero_hurt_heavy", "hero_grunt_a", "hero_grunt_b", "hero_grunt_c", "hero_death", "toad_death", "toad_enrage", "toad_phase", "knife_throw", "magic_buff", "goo_splat", "hero_drink", "toad_pain_a", "toad_pain_b", "toad_pain_c", "amb_meadow"]);
  for (const n of names) {
    buffers.set(n, null);
    fetch(`audio/${n}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => (buffers.set(n, buf), n === "amb_meadow" && ambientWanted && startAmbient()))
      .catch(() => buffers.delete(n));
  }
}
function playSample(name, gain, delay = 0) {
  const c = ensure();
  if (name == null) return true; // (chose to stay quiet: a cry too soon after the last)
  const buf = buffers.get(name);
  if (!c || !enabled || !buf) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = name.startsWith("mus_") ? 1 : 1 + (Math.random() * 2 - 1) * RATE_JITTER; // (never music: out of tune)
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(now() + delay);
  return true;
}

// ---------------------------------------------------------------------------------------------
// The garden's air under a fight (the owner, 2026-10-08: "create some very light ambient sound in the background"): a
// soft breeze and far-off birds (public/audio/amb_meadow.mp3, made as a loop: its end crossfaded into its start), looped
// quietly — AMBIENT_GAIN — faded in over 2 s and out over 1 s. Looped between its first and last real sound: an MP3's
// encoder pads both ends with a little silence, which would click each time round.
// ---------------------------------------------------------------------------------------------
const AMBIENT_GAIN = 0.16;
let ambient = null;
let ambientWanted = false;
export function startAmbient() {
  ambientWanted = true;
  const c = ensure();
  loadSamples();
  const buf = buffers.get("amb_meadow");
  if (!c || !buf || ambient) return; // (not loaded yet: it starts when it has)
  const d = buf.getChannelData(0);
  let a = 0, z = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < 1e-4) a++;
  while (z > a && Math.abs(d[z]) < 1e-4) z--;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = a / buf.sampleRate;
  src.loopEnd = z / buf.sampleRate;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(AMBIENT_GAIN, now() + 2);
  src.connect(g).connect(master);
  src.start(now(), src.loopStart);
  ambient = { src, g };
}
export function stopAmbient() {
  ambientWanted = false;
  if (!ambient) return;
  const { src, g } = ambient;
  ambient = null;
  g.gain.cancelScheduledValues(now());
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now());
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 1);
  src.stop(now() + 1.05);
}
// (the small bell has no made-up twin: the big one stands in until it has loaded)
S.bellSmall = (...a) => S.bell(...a);
// (nor his arrival: his hops' landing stands in)
S.arrive = (...a) => S.slam(...a);
// (nor the chest's: the heavy's floor slam, and the win's fanfare)
S.chestLand = (...a) => S.slamGround(...a);
S.chestOpen = (...a) => S.win(...a);

export const sfx = new Proxy(
  {},
  {
    get: (_, k) => {
      const made = S[k];
      const smp = SAMPLES[k];
      if (!smp) return made || (() => {});
      return (...args) => {
        loadSamples();
        if (!playSample(smp[0](...args), smp[1], smp[2] || 0)) made?.(...args);
      };
    },
  }
);

// ---------------------------------------------------------------------------------------------
// A slow drone under the fight: two detuned notes and a heartbeat that quickens with the enrage.
// ---------------------------------------------------------------------------------------------
export function startDrone(root = 98) {
  const c = ensure();
  if (!c) return () => {};
  stopDrone();
  const nodes = [];
  const mk = (f, type, g, pan) => {
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = type;
    o.frequency.value = f;
    gn.gain.value = 0;
    gn.gain.linearRampToValueAtTime(g, now() + 2.5);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) {
      p.pan.value = pan;
      o.connect(gn).connect(p).connect(musicGain);
    } else o.connect(gn).connect(musicGain);
    o.start();
    nodes.push([o, gn]);
  };
  mk(root, "sine", 0.18, -0.3);
  mk(root * 1.005, "sine", 0.14, 0.3);
  mk(root * 1.5, "triangle", 0.05, 0);
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = 0.07;
  lg.gain.value = 3;
  lfo.connect(lg).connect(nodes[0][0].frequency);
  lfo.start();
  nodes.push([lfo, lg]);
  musicStop = () => {
    for (const [o, gn] of nodes) {
      try {
        gn.gain.cancelScheduledValues(now());
        gn.gain.setValueAtTime(gn.gain.value, now());
        gn.gain.linearRampToValueAtTime(0, now() + 0.6);
        o.stop(now() + 0.7);
      } catch {
        /* already stopped */
      }
    }
  };
  return musicStop;
}
export function stopDrone() {
  if (musicStop) musicStop();
  musicStop = null;
}
