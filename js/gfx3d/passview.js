// The scene as one of the frame's later passes sees it (2026-10-16): the glow layer, the faded props, the shadows'
// silhouettes and mask — each drawn after the main pass, with the camera on other layers.
//
// three.js keeps its light state per scene object: a pass whose layers hold other lights (the glow layer none) changed
// that state, so the next main pass found every lit material's lights "changed" and worked out its shader again — the
// Bog's critters and the hero, 18 materials a frame, 0.9 ms of the frame's 7 ms of script here (a phone several times
// that); and each pass walked the whole scene again to update matrices the main pass had just updated. A view made with
// Object.create shares everything of the scene — its children, layers, override material, fog — but is its own object to
// three.js: its own light state and render list, so the main pass's stay as they were, and it leaves the matrices alone
// (only ever drawn after the main pass of the same frame, which updated them).
const views = new WeakMap();

/** The view of `scene` for the pass named `key`. */
export function passView(scene, key) {
  let m = views.get(scene);
  if (!m) views.set(scene, (m = new Map()));
  let v = m.get(key);
  if (!v) {
    v = Object.create(scene);
    v.matrixWorldAutoUpdate = false;
    m.set(key, v);
  }
  return v;
}
