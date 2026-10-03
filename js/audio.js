// Sound, made in the browser. No files to download, and every sound can be tuned by a number
// rather than re-recorded. Everything is short, dry and a little metallic — a hall at night.
//
// Nothing is created until the first gesture, as browsers require, and everything is routed
// through one gain so the settings screen has a single knob to turn.
let ac = null;
let master = null;
let musicGain = null;
let enabled = true;
let musicOn = true;
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
}
export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.55 : 0;
}
export function setMusic(v) {
  musicOn = v;
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
  tick: () => tone({ type: "square", f: 900, t: 0.03, g: 0.05 }),
  click: () => (tone({ type: "triangle", f: 700, f2: 1000, t: 0.06, g: 0.1 }), noise({ t: 0.03, g: 0.05, type: "highpass", f: 3000 })),
  coin: () => (tone({ type: "square", f: 1200, t: 0.06, g: 0.08 }), tone({ type: "square", f: 1800, t: 0.12, g: 0.06, delay: 0.05 })),
  win: () => [0, 4, 7, 12].forEach((s, i) => tone({ type: "triangle", f: 330 * Math.pow(2, s / 12), t: 0.5, g: 0.12, delay: i * 0.1 })),
  lose: () => [0, -2, -5, -9].forEach((s, i) => tone({ type: "triangle", f: 330 * Math.pow(2, s / 12), t: 0.7, g: 0.1, delay: i * 0.14 })),
  open: () => tone({ type: "sine", f: 300, f2: 620, t: 0.25, g: 0.1 }),
};

export const sfx = new Proxy(
  {},
  {
    get: (_, k) => S[k] || (() => {}),
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
    return o;
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
