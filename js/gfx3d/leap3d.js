// Gnasher's hop as drawn, for the 3D view: a line-for-line port of render.js bossPose, so the 3D
// toad lands where the 2D one does and his shadow runs along the same path. Pure: no three.js.
//
// The sim keeps a leaping boss at his take-off point and sets him down on the mark when he lands;
// drawn there he would sit still in the air and then pop across the floor. So he is drawn on an arc
// from take-off to the mark over the jump's own time (take-off beat to landing beat). `lift` is in
// 2D screen units, as in render.js; the 3D view turns it into a height (camera3d.heightTo3D).
import { clamp } from "../util.js?v=8898846";

export const LEAP_APEX = 44; // a full hop; the frenzy's quick hops (no `airborne` window) go 20

export function makeLeap() {
  const leaps = new WeakMap();
  return function bossPose(b, moveT = b.moveT) {
    if (b.jumpTo && b.clip === "leap" && b.move) {
      let L = leaps.get(b);
      if (!L || L.to !== b.jumpTo) leaps.set(b, (L = { from: [b.x, b.y], to: b.jumpTo, t0: b.moveT }));
      const land = b.move.airborne?.[1] > L.t0 ? b.move.airborne[1] : (b.move.beats || []).find((e) => e.at > L.t0 + 1e-6)?.at ?? L.t0 + 0.6;
      const u = clamp((moveT - L.t0) / Math.max(0.05, land - L.t0), 0, 1);
      const k = u * u * (3 - 2 * u);
      const apex = b.move.apex ?? (b.move.airborne ? LEAP_APEX : 20); // (the bell entrance sets its own: a leap in from beyond the wall)
      return { x: L.from[0] + (L.to[0] - L.from[0]) * k, y: L.from[1] + (L.to[1] - L.from[1]) * k, lift: Math.sin(Math.PI * u) * apex, apex, u };
    }
    const lift = b.airborne ? Math.sin(clamp((moveT - (b.move?.airborne?.[0] || 0)) / 0.85, 0, 1) * Math.PI) * LEAP_APEX : 0;
    return { x: b.x, y: b.y, lift, apex: LEAP_APEX, u: 0 };
  };
}
