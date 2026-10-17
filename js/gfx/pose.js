// A boss clip's timing, for the 3D animation (gfx3d/anim/boss-anim3d.js) and the checks.

/**
 * How long the boss's current clip will actually run, in seconds.
 *
 * A pose is a curve over its clip's own length, and a clip only lasts until the move's next beat
 * changes it — timing every clip against the whole move meant the King's raise peaked 0.08 s
 * before the slam replaced it and Gnasher's held crouch never finished rising. A move's beats are
 * functions, so its clip timeline is read once by running them against a stub that only records
 * clip changes.
 */
export function clipLength(b) {
  if (b.clip === "idle") return 1;
  if (b.clip === "dead") return 1.4;
  const m = b.move;
  if (!m) return 0.6;
  const start = b.moveT - b.clipT; // move time at which the current clip began
  const next = clipTimeline(m).find((e) => e.at > start + 1e-6);
  return Math.max(0.25, (next ? next.at : m.dur) - start);
}

const timelines = new WeakMap();
function clipTimeline(m) {
  let tl = timelines.get(m);
  if (tl) return tl;
  tl = [{ at: 0, clip: m.clip || "idle" }];
  const boss = { x: 0, y: -40, vx: 0, vy: 0, face: Math.PI / 2, hp: 1, hpMax: 1, r: 20, used: {} };
  const noop = () => {};
  const target = { player: { x: 0, y: 40, vx: 0, vy: 0 }, boss, adds: [], hazards: [], shots: [], events: [], rand: () => 0.5, aimAtPlayer: () => Math.PI / 2, hazard: (o) => o };
  // Anything a beat calls that is not stubbed above is a no-op; nothing it does can leak out.
  const fake = new Proxy(target, { get: (t, k) => (k in t ? t[k] : noop) });
  for (const beat of [...m.beats].sort((x, y) => x.at - y.at)) {
    target.clip = (_, name) => tl.push({ at: beat.at, clip: name });
    try {
      beat.do(fake, boss);
    } catch {
      // A beat that needs the real world just contributes no clip change.
    }
  }
  timelines.set(m, tl);
  return tl;
}
