// The 2D art the game still draws, made at boot in the browser out of the pixel kit: the small
// things (flies, embers), the meadow's critters and plants, sparks, the HUD's icons and the title.
// The fight itself is drawn in 3D (gfx3d/).
//
// build() yields between groups so the loading bar can move and the page never locks up.
import { buildAdds } from "./art/adds.js?v=48fd128-df87a96f";
import { buildDecor } from "./art/decor.js?v=48fd128-df87a96f";
import { buildFx } from "./art/fx.js?v=48fd128-df87a96f";
import { buildIcons } from "./art/icons.js?v=48fd128-df87a96f";
import { buildTitle } from "./art/title.js?v=48fd128-df87a96f";
import { loadPainting, asSprite } from "./painted.js?v=48fd128-df87a96f";
import { BOSSES, BOSS_ORDER } from "../content/bosses.js?v=48fd128-df87a96f";

export const ART = { add: {}, fx: {}, arena: {}, icon: {}, decor: null, title: null, titleTall: null };

// A yield between groups. Deliberately a timer rather than an animation frame: a tab loaded in
// the background never gets an animation frame, and the game would sit on the loading screen for
// as long as it stayed there.
const idle = () => new Promise((r) => setTimeout(r, 0));

/**
 * The paintings the game still uses: the title (with the points its overlays breathe on,
 * tools/title-anchors.py), and each arena's sidecar (tools/iso-arena.py), which says what the arena
 * looks like — Gnasher's "bog" is a spring meadow, its sidecar says look: "meadow" — and that its
 * props are placed (iso). The fight itself is drawn in 3D: the 2D boss, hero and arena paintings are
 * no longer loaded (they are kept in assets-3d/unused/2d-art/).
 */
async function loadPaintings() {
  const arenas = BOSS_ORDER.map((id) => BOSSES[id].arena); // the offered bosses' arenas
  const sidecars = await Promise.all(arenas.map((n) => fetch(`art/${n}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  arenas.forEach((name, i) => {
    const cut = sidecars[i];
    if (cut) ART.arena[name] = { painted: true, iso: !!cut.iso, look: cut.look || name };
  });
  // The title comes as two pictures of one scene: 4:3 for desktops and phones on their side, 2:3 for an upright
  // phone (which sees only the middle 35% of the 4:3 one; the owner, 2026-10-18: "it must look good on both desktop
  // and mobile view"). ui/title.js picks between them by the window's shape.
  const [title, tall] = await Promise.all(["title", "title-tall"].map(async (name) => {
    const pic = await loadPainting(name);
    const anchors = pic && (await fetch(`art/${name}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    return anchors ? { ...anchors, img: asSprite(pic.img), w: pic.w, h: pic.h, smooth: true } : null;
  }));
  if (title) ART.title = title;
  if (tall) ART.titleTall = tall;
  return sidecars.filter(Boolean).length + (title ? 1 : 0);
}

export async function buildArt(onProgress = () => {}) {
  const steps = [
    ["the small things", () => Object.assign(ART.add, buildAdds().add)],
    ["what grows here", () => (ART.decor = buildDecor())],
    ["steel and sparks", () => Object.assign(ART.fx, buildFx())],
    ["icons", () => Object.assign(ART.icon, buildIcons().ui)],
    ["the title", () => (ART.title = buildTitle())],
  ];
  for (let i = 0; i < steps.length; i++) {
    onProgress(i / steps.length, steps[i][0]);
    steps[i][1]();
    await idle();
  }
  // The paintings load over the network, so they come after the generated art is standing.
  try {
    const n = await loadPaintings();
    if (n) console.info(`[art] ${n} painting(s) loaded`);
  } catch (err) {
    console.warn("[art] paintings could not be loaded, using the generated ones:", err.message);
  }
  onProgress(1, "");
}

/** Make sure a fight's art exists before it starts. */
export function ensure() {
  if (!ART.decor) ART.decor = buildDecor();
}

/** Pick a frame from a clip by time, either looping or holding on the last frame. */
export function frameOf(clip, t, fps = 10, loop = true) {
  if (!clip || !clip.length) return null;
  const i = Math.floor(t * fps);
  return clip[loop ? ((i % clip.length) + clip.length) % clip.length : Math.min(clip.length - 1, Math.max(0, i))];
}
