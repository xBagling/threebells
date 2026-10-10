// Can this device draw the game? The fight is drawn in 3D (WebGL2). Asked once, when the title first
// comes up, and remembered for the page: a WebGL2 context is made and released at once.
let can = null;

export function canView3D() {
  if (can !== null) return can;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    can = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    can = false;
  }
  return can;
}
