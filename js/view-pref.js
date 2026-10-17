// Can this device draw the game? The fight is drawn in 3D (WebGL2). Asked once, when the title first
// comes up, and remembered for the page: a WebGL2 context is made and released at once.
let can = null;
let maxTex = 4096;

export function canView3D() {
  if (can !== null) return can;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    can = !!gl;
    if (gl) maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    can = false;
  }
  return can;
}

/** The largest texture this GPU holds (backdrop3d.js: the painted arena's 4x picture or its 2x), from the same probe: a
 *  context of its own for it cost the fight's load 0.1-0.8 s more (2026-10-16). 4096 where WebGL2 is missing. */
export function maxTextureSize() {
  canView3D();
  return maxTex;
}
