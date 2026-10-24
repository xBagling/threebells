// Writes to the page made only when the value changes (2026-10-16). The HUD and the touch pad are updated every frame;
// writing a text, a width or a custom property again — even the same one — marks the page for styling, and a text node
// replaced (textContent) for layout too: the clock and the boss's percentage alone laid the page out again every frame.
const shown = new WeakMap();
function changed(el, key, v) {
  let m = shown.get(el);
  if (!m) shown.set(el, (m = new Map()));
  if (m.get(key) === v) return false;
  m.set(key, v);
  return true;
}
/** el.textContent = v, when it differs from the last written. */
export const setText = (el, v) => void (changed(el, "#text", v) && (el.textContent = v));
/** el.style[key] = v (a plain property: width, opacity), when it differs. */
export const setStyle = (el, key, v) => void (changed(el, key, v) && (el.style[key] = v));
/** el.style.setProperty(name, v) (a custom property: --v, --k), when it differs. */
export const setVar = (el, name, v) => void (changed(el, name, v) && el.style.setProperty(name, v));
