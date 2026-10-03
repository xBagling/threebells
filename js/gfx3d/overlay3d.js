// The 3D view's text layer: damage numbers and the stagger "!" (docs/3D-PLAN.md 8.6), and the
// admin frame-time panel. A plain 2D canvas over the 3D one, at full resolution, never pixelated
// and never graded — the numbers in the target image are crisp. Placed with cam.toBuffer, which is
// exactly right in 3D too (the 3D camera is built from the 2D one), so every number sits where 2D
// puts it.
//
// Dealt damage takes the target image's look (D8a): cream with a dark green outline and a faint
// shadow. Heals, damage taken, crits and shield numbers keep their 2D colours.
import { toScreen } from "../gfx/iso.js?v=8898846";

const easeOut = (k) => 1 - (1 - k) * (1 - k);

export function makeOverlay(canvasEl) {
  const cv = document.createElement("canvas");
  cv.className = "fight-overlay";
  cv.setAttribute("aria-hidden", "true");
  canvasEl.after(cv);
  const ctx = cv.getContext("2d");
  let dirty = false;

  return {
    canvas: cv,
    resize(w, h) {
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        dirty = false;
      }
    },
    /** Draw this frame's text; `stats` (admin FPS panel) is a list of lines or null. */
    draw(w, cam, stats) {
      const live = w.floaters.length > 0 || w.boss?.stagger > 0 || stats;
      if (!live && !dirty) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      dirty = !!live;
      if (!live) return;
      const z = cam.zoom;
      const [ox, oy] = cam.origin();
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.font = `700 ${Math.round(11 * z)}px "Fraunces", Georgia, serif`;
      for (const f of w.floaters) {
        const k = f.t / 0.9;
        const [bx, by] = toScreen(f.x, f.y);
        const x = ox + bx * z;
        const y = oy + by * z - (26 + easeOut(k) * 22) * z * 0.6;
        ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        const dealt = f.kind === "dmg";
        if (dealt) {
          // The image's "21": cream, dark green outline, a faint drop shadow.
          ctx.fillStyle = "rgba(4, 16, 8, 0.45)";
          ctx.fillText(f.v, x + z * 0.35, y + z * 0.45);
          ctx.lineWidth = Math.max(2.5, z * 1.3);
          ctx.strokeStyle = "#09331d";
          ctx.strokeText(f.v, x, y);
          ctx.fillStyle = "#e1d8ae";
        } else {
          ctx.lineWidth = Math.max(2, z * 1.2);
          ctx.strokeStyle = "rgba(8,6,14,0.85)";
          ctx.strokeText(f.v, x, y);
          ctx.fillStyle = f.kind === "heal" ? "#8fffd0" : f.kind === "taken" ? "#ff7b7b" : f.kind === "crit" ? "#ffd66b" : f.kind === "shield" ? "#9fd8ff" : "#fbf7ee";
        }
        ctx.fillText(f.v, x, y);
      }
      ctx.globalAlpha = 1;
      const b = w.boss;
      if (b && b.stagger > 0) {
        const [bx, by] = toScreen(b.x, b.y);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "#ffd66b";
        ctx.font = `700 ${Math.round(15 * z)}px "Fraunces", Georgia, serif`;
        ctx.fillText("!", ox + bx * z, oy + by * z - (w.spec.hitH + 14) * z * 0.7);
        ctx.globalAlpha = 1;
      }
      if (stats) {
        const fs = Math.round(11 * (cam.dpr || 1));
        ctx.font = `600 ${fs}px ui-monospace, monospace`;
        ctx.textAlign = "left";
        const x = 8 * (cam.dpr || 1);
        let y = cv.height - (8 + stats.length * 14) * (cam.dpr || 1);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x - 4, y - fs, 260 * (cam.dpr || 1), (stats.length * 14 + 6) * (cam.dpr || 1));
        ctx.fillStyle = "#cfe8c0";
        for (const line of stats) {
          ctx.fillText(line, x, y);
          y += 14 * (cam.dpr || 1);
        }
      }
    },
    dispose() {
      cv.remove();
    },
  };
}
