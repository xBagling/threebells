// The map edit mode (the owner, 2026-10-13: "create a mode where i can mark on the images manually and update it, i should be
// able to do little at a time, and i should be able to do it on all current maps that are using this technology ... mask
// everything manually along with how it is mapped today already so i can do only refinements too. And then it should also be
// able to mask one area and tag a comment along with it ... an edit mode button in the top that i can toggle on both on mobile
// and desktop, when it is toggled on I dont expect to be able to move the character ... everything is paused ... zoom in and
// out on the image ... increase and decrease the mask pen size, and have a undo/forward button for all changes"; then "I just
// want the masking to be either the color that is masked, or it isnt. So a button for 'Masking' and 'Clear' ... a 'Save'
// button ... instead of an autosave ... 1 more backup copy ... 'Undo all' ... with a confirmation popup ... 'edit walk area'
// ... when switching between the modes if there are any changes it should be a popup asking to save").
//
// A button at the top of Camp 2.0 and of every fight on a painted map (the Ash Floor). On: the game stops where it is and the
// map is drawn wherever the owner pans and zooms. Two views:
//   Masks      blue: what covers whoever stands behind it (as the map is cut today, and as painted). Mask paints it, Clear
//              takes it away; Note paints a yellow area and asks for a comment about it (for Claude: <id>-comments.json).
//   Walk area  green: where the hero can walk (Camp 2.0: where his middle may stand). Mask paints it, Clear takes it away.
// Camp 2.0's blue is made of objects (tools/camp2/pieces.py: a lantern, a post, a rail, the umbrella; the owner, 2026-10-14,
// option 1 of the baseline proposal): in Move a tap picks one (a white outline and a card). An object with no line covers the
// hero wherever they overlap, as always; "Add line" gives it a white line on the ground where it stands (Claude's guess), and
// from then on it covers him only while he stands behind that line (render3d.js campCover). Its dots drag, the line drags
// whole, a tap on it adds a dot. With an object picked, Mask paints into it (a rail joined to its post shares its line); with
// none, a stroke is a new object. The hero himself can be dragged anywhere he can walk, to see the answer as the game draws
// it ("Hero here" brings him to the middle); leaving the mode puts him back.
// Undo and redo for every change since the view was opened; Undo all back to how it was then (asked first); Save writes it
// into the game (server.js — the file it replaces is backed up first); leaving a view or the mode with changes not saved asks.
import { ARENA_SHAPES } from "../content/arenas.js?v=79a60b0-466c2a40";
import { WALK_EDITS } from "../content/walkedits.js?v=79a60b0-466c2a40";
import { walkCells, shapeFromCells } from "../sim/arena.js?v=79a60b0-466c2a40";
import { PLAYER } from "../config.js?v=79a60b0-466c2a40";

// (gfx3d/mapedit3d.js is loaded when the mode is first turned on: the 2D game never imports the 3D view statically)
let emptyEdit, packEdit, fill, lineOfE, fillFx, packFx;

const TILE = 64;
/** Every save names itself (server.js): a custom header a page elsewhere cannot send without the browser asking first. */
const EDIT_HEADERS = (type) => ({ "Content-Type": type, "X-TB-Edit": "1" });

/** Mounts the toggle (shown once the map is up); `onToggle(on)` pauses and resumes the screen. */
export function mountMapEdit(host, { renderer, onToggle, place = "right", world = () => null, cam = () => null }) {
  const btn = document.createElement("button");
  btn.className = `me-toggle me-at-${place}`;
  btn.type = "button";
  btn.textContent = "Edit map";
  btn.hidden = true;
  host.append(btn);
  let info = null;
  const poll = setInterval(() => {
    const i = renderer.mapEdit?.info;
    if (i && i.depthImage) {
      info = i;
      btn.hidden = false;
      clearInterval(poll);
    }
  }, 400);
  let ed = null, busy = false, destroyed = false;
  btn.onclick = async () => {
    if (busy) return;
    busy = true;
    try {
      if (!ed) {
        // (the screen can be torn down while the editor loads: then it never finishes — its key handler, swallowing Space,
        // 1-5, [ ] h and Escape, and its beforeunload stayed on the window for good)
        const e = await startEditor(host, renderer, info, { world, cam, gone: () => destroyed });
        if (destroyed) return void e.close(true);
        ed = e;
        onToggle(true);
        host.classList.add("is-editing");
        btn.textContent = "Done";
        btn.classList.add("is-on");
      } else if (await ed.close()) {
        ed = null;
        host.classList.remove("is-editing");
        btn.textContent = "Edit map";
        btn.classList.remove("is-on");
        onToggle(false);
      }
    } catch (err) {
      if (err !== GONE) console.error("map edit:", err);
    } finally {
      busy = false;
    }
  };
  return {
    get on() {
      return !!ed;
    },
    destroy() {
      destroyed = true;
      clearInterval(poll);
      // (the screen going away — the admin menu's jump, say — with changes not saved: asked, as leaving the mode asks; the
      // page cannot wait for the in-page card, so the browser's own)
      ed?.close(true); // (first: a stroke still down is ended into the history)
      if (ed?.dirty() && confirm("The map has changes that are not saved. Save them now?")) ed.save();
      btn.remove();
    },
  };
}

// --- the editor ---------------------------------------------------------------------------------------------------------
const GONE = new Error("map edit: the screen went away");
async function startEditor(host, renderer, info, { world, cam, gone = () => false }) {
  ({ emptyEdit, packEdit, fill, lineOf: lineOfE } = await import("../gfx3d/mapedit3d.js?v=79a60b0-466c2a40"));
  ({ fillFx, packFx } = await import("../gfx3d/fxedit.js?v=79a60b0-466c2a40"));
  if (gone()) throw GONE;
  const bd = info.bd, id = info.id;
  const canvas = host.querySelector("canvas");
  const rect = () => canvas.getBoundingClientRect();

  // --- the view: where the owner looks (image pixels) ---
  const c0 = renderer.refCrop;
  const view = c0 ? { cx: c0.x0 + c0.w / 2, cy: c0.y0 + c0.h / 2, h: c0.h } : { cx: info.IW / 2, cy: info.IH / 2, h: info.IH };
  const hMax = () => {
    const r = rect();
    return Math.max(info.IH, (info.IW * r.height) / r.width) * 1.15;
  };
  const toImg = (clientX, clientY) => {
    const r = rect();
    const w = (view.h * r.width) / r.height;
    return [view.cx - w / 2 + ((clientX - r.left) / r.width) * w, view.cy - view.h / 2 + ((clientY - r.top) / r.height) * view.h];
  };
  const toScreen = (ix, iy) => {
    const r = rect();
    const w = (view.h * r.width) / r.height;
    return [((ix - (view.cx - w / 2)) / w) * r.width, ((iy - (view.cy - view.h / 2)) / view.h) * r.height];
  };

  // --- the screen's parts ---
  const ui = document.createElement("div");
  ui.className = "me-ui";
  ui.innerHTML = `
    <canvas class="me-walk" data-walk></canvas>
    <canvas class="me-walk" data-fx></canvas>
    <canvas class="me-lines" data-lines></canvas>
    <div class="me-layer" data-layer></div>
    <div class="me-pins" data-pins></div>
    <div class="me-cursor" data-cursor hidden></div>
    <div class="me-bar" role="toolbar" aria-label="Map edit tools">
      <div class="me-group me-modes" role="group" aria-label="What to edit">
        <button type="button" class="me-tool" data-mode="mask">Masks</button>
        <button type="button" class="me-tool" data-mode="walk">Walk area</button>
        <button type="button" class="me-tool" data-mode="fx" hidden>Effects</button>
      </div>
      <div class="me-group" data-tools>
        <button type="button" class="me-tool" data-tool="move" title="Move (1)">Move</button>
        <button type="button" class="me-tool me-add" data-tool="add" title="Mask (2)">Mask</button>
        <button type="button" class="me-tool me-rem" data-tool="rem" title="Clear (3)">Clear</button>
        <button type="button" class="me-tool me-notetool" data-tool="note" title="Note (4)">Note</button>
        <button type="button" class="me-tool me-fxtool" data-tool="water" title="Water (2)"><span class="me-chip" style="background:#2cc8ff"></span>Water</button>
        <button type="button" class="me-tool me-fxtool" data-tool="fall" title="Waterfall (3)"><span class="me-chip" style="background:#e8e8ff"></span>Waterfall</button>
        <button type="button" class="me-tool me-fxtool" data-tool="petal" title="Sakura petals (4)"><span class="me-chip" style="background:#ff7ab4"></span>Petals</button>
        <button type="button" class="me-tool me-fxtool" data-tool="none" title="No effect (5)"><span class="me-chip" style="background:#ff4a3d"></span>No effect</button>
      </div>
      <div class="me-group">
        <button type="button" class="me-btn" data-size="-1" title="Smaller pen ([)" aria-label="Smaller pen">−</button>
        <span class="me-size" data-sizeval title="Pen size, screen pixels"></span>
        <button type="button" class="me-btn" data-size="1" title="Bigger pen (])" aria-label="Bigger pen">+</button>
      </div>
      <div class="me-group">
        <button type="button" class="me-btn" data-zoom="out" title="Zoom out" aria-label="Zoom out">⊖</button>
        <button type="button" class="me-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">⊕</button>
        <button type="button" class="me-btn" data-zoom="fit" title="Whole map">Fit</button>
        <button type="button" class="me-btn" data-show title="Show or hide the colours">Colours</button>
        <button type="button" class="me-btn" data-herohere title="Put the hero in the middle of the view (H)" hidden>Hero here</button>
      </div>
      <div class="me-group">
        <button type="button" class="me-btn" data-undo title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" class="me-btn" data-redo title="Redo (Ctrl+Y)">Redo</button>
        <button type="button" class="me-btn" data-undoall title="Back to how it was when this view was opened">Undo all</button>
        <button type="button" class="me-btn me-primary" data-save title="Save (Ctrl+S)">Save</button>
      </div>
      <div class="me-status" data-status aria-live="polite"></div>
    </div>
    <form class="me-notebox" data-note hidden>
      <label for="me-note-text" data-notelabel>Note about the yellow area</label>
      <textarea id="me-note-text" rows="3" data-notetext placeholder="What should change here?"></textarea>
      <div class="me-notebox-row">
        <button type="submit" class="me-btn me-primary" data-notesave>Add note</button>
        <button type="button" class="me-btn" data-notedel>Discard</button>
        <button type="button" class="me-btn" data-noteclose>Close</button>
      </div>
    </form>
    <div class="me-card" data-card hidden>
      <span data-cardtext></span>
      <div class="me-notebox-row">
        <button type="button" class="me-btn me-primary" data-addline>Add line</button>
        <button type="button" class="me-btn" data-resetline>Reset line</button>
        <button type="button" class="me-btn" data-delline>Remove line</button>
        <button type="button" class="me-btn" data-deldot>Remove point</button>
        <button type="button" class="me-btn" data-cardclose>Close</button>
      </div>
    </div>
    <div class="me-modal" data-modal hidden role="dialog" aria-modal="true" aria-labelledby="me-modal-title">
      <div class="me-modal-card">
        <h3 id="me-modal-title" data-mtitle></h3>
        <p data-mtext></p>
        <div class="me-notebox-row" data-mbtns></div>
      </div>
    </div>`;
  host.append(ui);
  const $ = (s) => ui.querySelector(s);
  const layerEl = $("[data-layer]"), cursor = $("[data-cursor]"), pinsEl = $("[data-pins]"), statusEl = $("[data-status]");
  const walkEl = $("[data-walk]");
  const noteForm = $("[data-note]"), noteText = $("[data-notetext]");
  const setStatus = (t) => (statusEl.textContent = t);

  /** An in-page question (the frame's own confirm() is not used): resolves to the chosen button's id. */
  function ask(title, text, buttons) {
    const m = $("[data-modal]");
    $("[data-mtitle]").textContent = title;
    $("[data-mtext]").textContent = text;
    const row = $("[data-mbtns]");
    row.textContent = "";
    return new Promise((done) => {
      for (const [bid, label, cls] of buttons) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `me-btn ${cls || ""}`;
        b.textContent = label;
        b.onclick = () => {
          m.hidden = true;
          done(bid);
        };
        row.append(b);
      }
      m.hidden = false;
      row.querySelector("button")?.focus();
    });
  }

  // --- history: per view, everything since it was opened ---
  let hist = [], hpos = 0, savedAt = 0, layer = null, mode = "mask";
  const dirty = () => hpos !== savedAt;
  const syncHist = () => {
    $("[data-undo]").disabled = hpos === 0;
    $("[data-redo]").disabled = hpos >= hist.length;
    $("[data-undoall]").disabled = !hist.length && !layer?.wasSaved();
    $("[data-save]").disabled = !dirty();
    if (dirty()) setStatus("Not saved");
  };
  const push = (h) => {
    if (savedAt > hpos) savedAt = -1; // (the saved state was undone past and is now gone from the history)
    hist.length = hpos;
    hist.push(h);
    hpos = hist.length;
    syncHist();
  };
  let stroke = null;
  const undo = () => {
    if (stroke || hpos === 0) return;
    hist[--hpos].undo();
    syncHist();
  };
  const redo = () => {
    if (stroke || hpos >= hist.length) return;
    hist[hpos++].redo();
    syncHist();
  };

  // (the object picked in the Masks view, Camp 2.0, and the dot of its line picked; 0 / -1: none)
  let sel = 0, selDot = -1;

  // ===== the masks ====================================================================================================
  const maskLayer = await (async () => {
    if (!bd.editBase) bd.editBase = await decodeDepth(info.depthImage);
    const base = bd.editBase;
    // (the built-in cut-outs' depth, Camp 2.0's odepth: what his mask takes where it meets them)
    if (bd.odepth?.image && !bd.editOdepth) bd.editOdepth = await decodeDepth(bd.odepth.image, true);
    const O = bd.editOdepth && bd.editOdepth.w === base.w && bd.editOdepth.h === base.h ? bd.editOdepth : null;
    const gw = base.w, gh = base.h, N = gw * gh;
    const sxg = gw / info.IW, syg = gh / info.IH; // (grid pixels an image pixel)
    if (!bd.edit || bd.edit.w !== gw || bd.edit.h !== gh) bd.edit = emptyEdit(gw, gh);
    const E = bd.edit;
    if (!bd.editComments) bd.editComments = await fetch(`art3d/${id}/${id}-comments.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : []), () => []);
    let notes = bd.editComments;
    const draft = new Uint8Array(N), union = new Uint8Array(N);
    const snapshot = () => ({ add: E.add.slice(), rem: E.rem.slice(), pc: E.pc?.slice(), lines: JSON.parse(JSON.stringify(E.lines || {})), next: E.next, notes: JSON.parse(JSON.stringify(notes)) });
    let opened = snapshot(), saved = opened;
    function rebuildUnion() {
      union.fill(0);
      for (const n of notes) for (const [y, x, len] of n.runs) union.fill(170, y * gw + x, y * gw + x + len);
    }
    rebuildUnion();
    /** After paint over a rectangle: the masked pieces' depth, the textures' bytes, the GPU's copy. */
    function refresh(x0, y0, x1, y1) {
      // (Camp 2.0: his mask's bottom edges, rows — camp3d.js covers him by them; the Ash Floor: depths, its depth is true)
      // (Camp 2.0: the mask alone decides — no depth to work out; the Ash Floor: depths, its depth is a true render)
      const u = info.kind === "camp" ? [Math.max(0, x0), Math.max(0, y0), Math.min(gw, x1), Math.min(gh, y1)] : computeDepth(E, base.d, gw, gh, x0, y0, x1, y1, O);
      for (let y = u[1]; y < u[3]; y++) for (let x = u[0], i = y * gw + u[0]; x < u[2]; x++, i++) E.com[i] = Math.max(draft[i], union[i]);
      fill(E, u[0], u[1], u[2], u[3]);
      renderer.mapEdit.upload(E.cov, u[1], u[3]);
      renderer.mapEdit.upload(E.depTex, u[1], u[3]);
      if (E.pidTex) renderer.mapEdit.upload(E.pidTex, u[1], u[3]);
    }
    function restore(sn) {
      E.add.set(sn.add);
      E.rem.set(sn.rem);
      if (sn.pc && E.pc) E.pc.set(sn.pc);
      E.lines = JSON.parse(JSON.stringify(sn.lines));
      E.next = sn.next;
      notes = bd.editComments = JSON.parse(JSON.stringify(sn.notes));
      draft.fill(0);
      rebuildUnion();
      refresh(0, 0, gw, gh);
      placePins();
      pickPiece(0);
    }
    // (masks saved by the old rules get their depths again by these: if any changed, Save is offered)
    const depBefore = E.dep.slice();
    refresh(0, 0, gw, gh);
    E.cov.needsUpdate = E.depTex.needsUpdate = true;
    let stale = false;
    for (let i = 0; i < N && !stale; i++) if (E.add[i] && E.dep[i] !== depBefore[i]) stale = true;

    const copyTile = (tx, ty) => {
      const x0 = tx * TILE, y0 = ty * TILE, x1 = Math.min(gw, x0 + TILE), y1 = Math.min(gh, y0 + TILE);
      const o = { tx, ty, add: [], rem: [], draft: [], pc: [] };
      for (let y = y0; y < y1; y++) {
        o.add.push(E.add.slice(y * gw + x0, y * gw + x1));
        o.rem.push(E.rem.slice(y * gw + x0, y * gw + x1));
        o.draft.push(draft.slice(y * gw + x0, y * gw + x1));
        if (E.pc) o.pc.push(E.pc.slice(y * gw + x0, y * gw + x1));
      }
      return o;
    };
    const putTile = (o) => {
      const x0 = o.tx * TILE, y0 = o.ty * TILE;
      o.add.forEach((row, j) => E.add.set(row, (y0 + j) * gw + x0));
      o.rem.forEach((row, j) => E.rem.set(row, (y0 + j) * gw + x0));
      o.draft.forEach((row, j) => draft.set(row, (y0 + j) * gw + x0));
      o.pc.forEach((row, j) => E.pc.set(row, (y0 + j) * gw + x0));
    };
    let st = null;
    const snap = (x0, y0, x1, y1) => {
      for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty <= Math.min(Math.ceil(gh / TILE) - 1, Math.floor((y1 - 1) / TILE)); ty++)
        for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.min(Math.ceil(gw / TILE) - 1, Math.floor((x1 - 1) / TILE)); tx++) {
          const k = ty * 1e4 + tx;
          if (!st.tiles.has(k)) st.tiles.set(k, { before: copyTile(tx, ty) });
        }
    };
    function stamp(ix, iy, Rimg, tool) {
      const gx = ix * sxg, gy = iy * syg, R = Rimg * syg;
      const x0 = Math.max(0, Math.floor(gx - R - 1)), x1 = Math.min(gw, Math.ceil(gx + R + 1));
      const y0 = Math.max(0, Math.floor(gy - R - 1)), y1 = Math.min(gh, Math.ceil(gy + R + 1));
      if (x1 <= x0 || y1 <= y0) return;
      snap(x0 - 10, y0 - 10, x1 + 10, y1 + 10);
      const inner = R * 0.45;
      for (let y = y0; y < y1; y++)
        for (let x = x0, i = y * gw + x0; x < x1; x++, i++) {
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
          if (d >= R) continue;
          let t = d <= inner ? 1 : 1 - (d - inner) / (R - inner);
          t = t * t * (3 - 2 * t); // (a soft edge: smoothstep)
          const v = Math.round(255 * t);
          if (tool === "add") {
            E.add[i] = Math.max(E.add[i], v);
            E.rem[i] = Math.min(E.rem[i], 255 - v);
            // (and the object it paints into: the picked one, or the stroke's new one — its faint fringe too where no other
            // object is: left to none, the fringe was a thin outline laid over him when the object stood behind him)
            if (st.piece && (v >= 128 || (v >= 8 && !E.pc[i] && !E.pieces?.ids[i]))) E.pc[i] = st.piece;
          }
          else if (tool === "rem") (E.rem[i] = Math.max(E.rem[i], v)), (E.add[i] = Math.min(E.add[i], 255 - v)), (draft[i] = Math.min(draft[i], 255 - v));
          else if (tool === "note") draft[i] = Math.max(draft[i], v);
        }
      const b = st.box;
      b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], y0); b[2] = Math.max(b[2], x1); b[3] = Math.max(b[3], y1);
      // (shown once a frame, over all the dabs since: one per dab — the depth worked out and whole rows sent to the GPU each
      // time — took 11 ms a mouse move here, and the pen fell behind the hand; the owner, 2026-10-13: "it lags")
      dirty = dirty ? [Math.min(dirty[0], x0), Math.min(dirty[1], y0), Math.max(dirty[2], x1), Math.max(dirty[3], y1)] : [x0, y0, x1, y1];
      if (!raf) raf = requestAnimationFrame(flush);
    }
    let dirty = null, raf = 0;
    function flush() {
      raf = 0;
      if (!dirty) return;
      const d = dirty;
      dirty = null;
      refresh(...d);
    }
    const paintEntry = (tiles, box, piece) => ({
      undo: () => (tiles.forEach((t) => putTile(t.before)), refresh(...box), pieces && pickPiece(sel)),
      redo: () => (tiles.forEach((t) => putTile(t.after)), refresh(...box), pieces && pickPiece(sel)),
    });

    // --- notes ---
    const clearDraft = (box) => {
      for (let y = box[1]; y < box[3]; y++) draft.fill(0, y * gw + box[0], y * gw + box[2]);
    };
    let noteOpen = null;
    function openNote(n) {
      noteOpen = n;
      noteForm.hidden = false;
      $("[data-notelabel]").textContent = n ? `Note ${notes.indexOf(n) + 1}` : "Note about the yellow area";
      $("[data-notesave]").textContent = n ? "Keep" : "Add note";
      $("[data-notedel]").textContent = n ? "Delete note" : "Discard";
      noteText.value = n ? n.text : noteText.dataset.draft || "";
      if (matchMedia("(pointer: fine)").matches) noteText.focus();
    }
    noteText.oninput = () => {
      if (!noteOpen) noteText.dataset.draft = noteText.value;
    };
    noteForm.onsubmit = (e) => {
      e.preventDefault();
      const text = noteText.value.trim();
      if (noteOpen) {
        const n = noteOpen, before = n.text;
        if (text !== before) {
          n.text = text;
          push({ undo: () => (n.text = before), redo: () => (n.text = text) });
        }
        noteForm.hidden = true;
        noteOpen = null;
        return;
      }
      let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
      const runs = [];
      for (let y = 0; y < gh; y++) {
        const row = y * gw;
        let x = 0;
        while (x < gw) {
          if (draft[row + x] < 64) {
            x++;
            continue;
          }
          const a = x;
          while (x < gw && draft[row + x] >= 64) x++;
          runs.push([y, a, x - a]);
          x0 = Math.min(x0, a); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
        }
      }
      if (!runs.length) {
        setStatus("Paint the area with Note first, then write the note.");
        return;
      }
      let sx = 0, sy = 0, sn = 0;
      for (const [y, a, len] of runs) (sx += (a + len / 2) * len), (sy += (y + 0.5) * len), (sn += len);
      const box = [x0, y0, x1, y1];
      const note = {
        id: Date.now().toString(36), text, map: id, made: new Date().toISOString(), grid: [gw, gh],
        image: [Math.round(x0 / sxg), Math.round(y0 / syg), Math.round(x1 / sxg), Math.round(y1 / syg)],
        at: [sx / sn, sy / sn], box, runs,
      };
      const draftRows = [];
      for (let y = y0; y < y1; y++) draftRows.push(draft.slice(y * gw + x0, y * gw + x1));
      const add = () => {
        notes.push(note);
        clearDraft(box);
        rebuildUnion();
        refresh(...box);
        placePins();
      };
      add();
      noteText.dataset.draft = "";
      noteForm.hidden = true;
      push({
        undo: () => {
          notes = bd.editComments = notes.filter((n) => n !== note);
          draftRows.forEach((row, j) => draft.set(row, (y0 + j) * gw + x0));
          rebuildUnion();
          refresh(...box);
          placePins();
        },
        redo: add,
      });
    };
    $("[data-notedel]").onclick = () => {
      if (noteOpen) {
        const note = noteOpen, at = notes.indexOf(note);
        const del = () => {
          notes = bd.editComments = notes.filter((n) => n !== note);
          rebuildUnion();
          refresh(...note.box);
          placePins();
        };
        del();
        push({ undo: () => (notes.splice(at, 0, note), rebuildUnion(), refresh(...note.box), placePins()), redo: del });
      } else {
        let box = null;
        for (let y = 0; y < gh; y++)
          for (let x = 0, i = y * gw; x < gw; x++, i++)
            if (draft[i]) box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + 1), y + 1] : [x, y, x + 1, y + 1];
        if (box) {
          st = { tiles: new Map(), box: [...box] };
          snap(...box);
          clearDraft(box);
          refresh(...box);
          const tiles = [...st.tiles.values()];
          for (const t of tiles) t.after = copyTile(t.before.tx, t.before.ty);
          st = null;
          push(paintEntry(tiles, box));
        }
        noteText.dataset.draft = "";
      }
      noteForm.hidden = true;
      noteOpen = null;
    };
    $("[data-noteclose]").onclick = () => {
      noteForm.hidden = true;
      noteOpen = null;
    };
    function placePins() {
      pinsEl.textContent = "";
      if (mode !== "mask") return;
      const r = rect();
      notes.forEach((n, k) => {
        const [x, y] = toScreen(n.at[0] / sxg, n.at[1] / syg);
        if (x < -20 || y < -20 || x > r.width + 20 || y > r.height + 20) return;
        const p = document.createElement("button");
        p.type = "button";
        p.className = "me-pin";
        p.textContent = String(k + 1);
        p.title = n.text || "Note";
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.onclick = (e) => {
          e.stopPropagation();
          openNote(n);
        };
        pinsEl.append(p);
      });
    }
    return {
      tools: ["move", "add", "rem", "note"],
      get stale() {
        return stale;
      },
      show(on, colours) {
        renderer.mapEdit.setLayers(E.cov, E.depTex, on && colours);
        placePins();
        if (!on) noteForm.hidden = true;
      },
      begin(tool) {
        st = { tiles: new Map(), box: [gw, gh, 0, 0], piece: 0 };
        // (Camp 2.0: Mask paints into the picked object, or, with none picked, makes a new one)
        if (tool === "add" && E.pid) st.piece = sel || E.next++;
      },
      stamp,
      end(keep, tool) {
        if (!st) return;
        const s = st;
        st = null;
        if (raf) cancelAnimationFrame(raf);
        flush();
        const tiles = [...s.tiles.values()];
        if (!keep || !tiles.length) {
          tiles.forEach((t) => putTile(t.before));
          if (tiles.length) refresh(...s.box);
          return;
        }
        for (const t of tiles) t.after = copyTile(t.before.tx, t.before.ty);
        push(paintEntry(tiles, s.box, s.piece));
        if (tool === "note") openNote(null);
        // (the object painted: picked, its outline grown; cleared: the picked one's outline shrunk — or, cleared away, unpicked)
        if (s.piece) pickPiece(s.piece);
        else if (tool === "rem" && sel) pickPiece(sel);
      },
      placePins,
      opened: () => restore(opened),
      discard: () => restore(saved),
      async save() {
        // (what is sent is what is marked saved, both taken now: a stroke made while it uploads is not saved, and stays unsaved)
        const snap = snapshot(), packed = packEdit(E), noteJson = JSON.stringify(notes);
        const bin = await gzip(packed);
        const r1 = await fetch(`/api/mapedit?id=${id}`, { method: "POST", body: bin, headers: EDIT_HEADERS("application/octet-stream") });
        if (!r1.ok) throw new Error(`masks ${r1.status}`);
        const r2 = await fetch(`/api/mapcomments?id=${id}`, { method: "POST", body: noteJson, headers: EDIT_HEADERS("application/json") });
        if (!r2.ok) throw new Error(`notes ${r2.status}`);
        saved = snap;
        stale = false;
      },
      wasSaved: () => saved !== opened,
      rebaseOpened() {
        opened = saved = snapshot();
      },
    };
  })();
  if (gone()) throw (ui.remove(), GONE);

  // ===== the walk area ================================================================================================
  const walkLayer = (() => {
    const shape = ARENA_SHAPES[id];
    if (!shape || !renderer.mapEdit.toImage) return null;
    // (the cells as the game has them now: this session's save, else the file's)
    const C = bd.walkNow ? { ...bd.walkNow, inside: bd.walkNow.inside.slice() } : walkCells(id, WALK_EDITS[id]);
    if (!C) return null;
    const { x0, y0, cell, nx, ny } = C;
    const N = nx * ny;
    // (every cell's corners in the image, through the image camera; its middle for the pen)
    const cx = new Float32Array((nx + 1) * (ny + 1)), cy = new Float32Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const p = renderer.mapEdit.toImage(x0 + i * cell, y0 + j * cell);
        cx[j * (nx + 1) + i] = p[0];
        cy[j * (nx + 1) + i] = p[1];
      }
    const mx = new Float32Array(N), my = new Float32Array(N), hr = new Float32Array(N);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + nx + 2;
        mx[j * nx + i] = (cx[a] + cx[b]) / 2;
        my[j * nx + i] = (cy[a] + cy[b]) / 2;
        // (half the cell's size in the image: the pen takes every cell it touches — by the middles alone a pen smaller than
        // a cell, zoomed in, fell between them and painted nothing; the owner, 2026-10-13: "sometimes not actually paint")
        hr[j * nx + i] = 0.5 * Math.max(Math.abs(cx[b] - cx[a]), Math.abs(cy[b] - cy[a]), Math.abs(cx[a + 1] - cx[a + nx + 1]), Math.abs(cy[a + 1] - cy[a + nx + 1]));
      }
    // (the cells by where they fall in the image, in 8-pixel buckets, to find those under the pen)
    const BK = 8, bw = Math.ceil(info.IW / BK) + 2, bh = Math.ceil(info.IH / BK) + 2;
    const bOf = (i) => {
      const x = Math.floor(mx[i] / BK) + 1, y = Math.floor(my[i] / BK) + 1;
      return x < 0 || y < 0 || x >= bw || y >= bh ? -1 : y * bw + x;
    };
    const start = new Int32Array(bw * bh + 1), list = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const b = bOf(i);
      if (b >= 0) start[b + 1]++;
    }
    for (let b = 0; b < bw * bh; b++) start[b + 1] += start[b];
    const fillAt = start.slice(0, -1);
    for (let i = 0; i < N; i++) {
      const b = bOf(i);
      if (b >= 0) list[fillAt[b]++] = i;
    }
    // (drawn: the walkable cells as the ground they cover, green, into a picture of the map at up to 2048 px across)
    const ws = Math.min(1, 2048 / Math.max(info.IW, info.IH));
    const pic = document.createElement("canvas");
    pic.width = Math.ceil(info.IW * ws);
    pic.height = Math.ceil(info.IH * ws);
    const pg = pic.getContext("2d");
    const P = (ii, jj) => [cx[jj * (nx + 1) + ii] * ws, cy[jj * (nx + 1) + ii] * ws];
    let shown = false, colours = true;
    function draw() {
      pg.clearRect(0, 0, pic.width, pic.height);
      pg.fillStyle = "rgb(60, 235, 110)";
      pg.beginPath();
      for (let j = 0; j < ny; j++) {
        let i = 0;
        while (i < nx) {
          if (!C.inside[j * nx + i]) {
            i++;
            continue;
          }
          const a = i;
          while (i < nx && C.inside[j * nx + i] && i - a < 8) i++;
          const q = [P(a, j), P(i, j), P(i, j + 1), P(a, j + 1)];
          pg.moveTo(q[0][0], q[0][1]);
          for (let k = 1; k < 4; k++) pg.lineTo(q[k][0], q[k][1]);
          pg.closePath();
        }
      }
      pg.fill();
      blit();
    }
    function blit() {
      const r = rect(), dpr = devicePixelRatio || 1;
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (walkEl.width !== W || walkEl.height !== H) (walkEl.width = W), (walkEl.height = H);
      const g = walkEl.getContext("2d");
      g.clearRect(0, 0, W, H);
      if (!shown || !colours) return;
      const w = (view.h * r.width) / r.height;
      g.globalAlpha = 0.42;
      g.drawImage(pic, (view.cx - w / 2) * ws, (view.cy - view.h / 2) * ws, w * ws, view.h * ws, 0, 0, W, H);
      g.globalAlpha = 1;
    }
    const snapshot = () => C.inside.slice();
    let opened = snapshot(), saved = opened;
    const restore = (s) => (C.inside.set(s), draw());
    let st = null, raf = 0;
    const later = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), draw()));
    };
    function stamp(ix, iy, R, tool) {
      const v = tool === "add" ? 1 : 0;
      const RR = R + 16;   // (cells up to 16 image px across: their middles may lie outside the pen while it touches them)
      const bx0 = Math.max(0, Math.floor((ix - RR) / BK) + 1), bx1 = Math.min(bw - 1, Math.floor((ix + RR) / BK) + 1);
      const by0 = Math.max(0, Math.floor((iy - RR) / BK) + 1), by1 = Math.min(bh - 1, Math.floor((iy + RR) / BK) + 1);
      let any = false;
      for (let by = by0; by <= by1; by++)
        for (let bx = bx0; bx <= bx1; bx++) {
          const b = by * bw + bx;
          for (let k = start[b]; k < start[b + 1]; k++) {
            const i = list[k];
            if (C.inside[i] === v || Math.hypot(mx[i] - ix, my[i] - iy) > R + hr[i]) continue;
            if (!st.before.has(i)) st.before.set(i, C.inside[i]);
            C.inside[i] = v;
            any = true;
          }
        }
      if (any) later();
    }
    return {
      tools: ["move", "add", "rem"],
      show(on, c) {
        shown = on;
        colours = c;
        if (on) draw();
        else blit();
      },
      blit,
      begin() {
        st = { before: new Map() };
      },
      stamp,
      end(keep) {
        if (!st) return;
        const s = st;
        st = null;
        if (raf) (cancelAnimationFrame(raf), (raf = 0), draw());
        if (!s.before.size) return;
        const idx = [...s.before.keys()], before = Uint8Array.from(s.before.values()), after = Uint8Array.from(idx, (i) => C.inside[i]);
        if (!keep) {
          idx.forEach((i, k) => (C.inside[i] = before[k]));
          draw();
          return;
        }
        push({ undo: () => (idx.forEach((i, k) => (C.inside[i] = before[k])), draw()), redo: () => (idx.forEach((i, k) => (C.inside[i] = after[k])), draw()) });
      },
      placePins() {},
      opened: () => restore(opened),
      discard: () => restore(saved),
      async save() {
        // (the changes against the map's own floor, as runs: content/walkedits.js)
        const base = walkCells(id);
        const add = [], rem = [];
        for (let j = 0; j < ny; j++)
          for (const [want, out] of [[1, add], [0, rem]]) {
            let i = 0;
            while (i < nx) {
              const k = j * nx + i;
              if (!(C.inside[k] === want && base.inside[k] !== want)) {
                i++;
                continue;
              }
              const a = i;
              while (i < nx && C.inside[j * nx + i] === want && base.inside[j * nx + i] !== want) i++;
              out.push([j, a, i - a]);
            }
          }
        const snap = snapshot(); // (what is sent, not what stands once it is: see the masks' save)
        const r = await fetch(`/api/walkedit?id=${id}`, { method: "POST", body: JSON.stringify({ x0, y0, cell, nx, ny, add, rem }), headers: EDIT_HEADERS("application/json") });
        if (!r.ok) throw new Error(`walk ${r.status}`);
        saved = snap;
        bd.walkNow = { ...C, inside: saved.slice() };
        // (and in the game now: where he can walk from this moment)
        const w = world();
        if (w) {
          w.arena = shapeFromCells({ ...C, inside: saved.slice() }, shape);
          cam()?.setArena?.(w.arena);
        }
      },
      wasSaved: () => saved !== opened,
      rebaseOpened() {
        opened = saved = snapshot();
      },
    };
  })();


  // ===== the effects (Camp 2.0) =========================================================================================
  // (the owner, 2026-10-14: "add a select in the camp Edit as well to add the sakura bloom effect, and the water effect, and
  // the waterfall effect. It can be updated in the Edit menu and added in a easier to select way": a view of its own, a pen
  // for each — Water, Waterfall, Petals — and No effect to take the map's own away; fxedit.js keeps them, camp3d.js shows them)
  const fxLayer = await (async () => {
    const F = bd.fxEdit;
    if (info.kind !== "camp" || !F || !renderer.mapEdit.refreshPetals) return null;
    const { w: fw, h: fh, planes: P } = F, N = fw * fh;
    const sx = fw / info.IW, sy = fh / info.IH;
    // (the map's own water and waterfalls, to show them: camp2-fx.png R water, G falls)
    const base = await (async () => {
      const img = bd.fx.image, c = document.createElement("canvas");
      c.width = fw;
      c.height = fh;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, fw, fh);
      const px = g.getImageData(0, 0, fw, fh).data, wat = new Uint8Array(N), fal = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const r = px[i * 4];
        wat[i] = r < 140 ? Math.min(255, Math.round((r / 127) * 255)) : 0;
        fal[i] = px[i * 4 + 1];
      }
      return { wat, fal };
    })();
    const el = $("[data-fx]");
    const pic = document.createElement("canvas");
    pic.width = fw;
    pic.height = fh;
    const pg = pic.getContext("2d");
    const im = pg.createImageData(fw, fh);
    function paint(x0, y0, x1, y1) {
      const d = im.data;
      for (let y = y0; y < y1; y++)
        for (let x = x0, i = y * fw + x0; x < x1; x++, i++) {
          const no = P.none[i] / 255, wa = Math.max((base.wat[i] / 255) * (1 - no), P.water[i] / 255);
          const fa = Math.max((base.fal[i] / 255) * (1 - no), P.fall[i] / 255), pe = P.petal[i] / 255;
          let r = 0, g = 0, b = 0, a = 0;
          const add = (cr, cg, cb, k) => {
            if (k <= 0) return;
            r = r * (1 - k) + cr * k; g = g * (1 - k) + cg * k; b = b * (1 - k) + cb * k; a = Math.max(a, k);
          };
          add(40, 200, 255, wa);
          add(235, 235, 255, fa);
          add(255, 110, 180, pe);
          if (no > 0 && (base.wat[i] || base.fal[i])) add(255, 70, 60, no * 0.8);
          const o = i * 4;
          d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(a * 120);
        }
      pg.putImageData(im, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }
    paint(0, 0, fw, fh);
    let shown = false, colours = true;
    function blit() {
      const r = rect(), dpr = devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (el.width !== W || el.height !== H) (el.width = W), (el.height = H);
      const g = el.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      if (!shown || !colours) return;
      const w = (view.h * r.width) / r.height;
      g.drawImage(pic, (view.cx - w / 2) * sx, (view.cy - view.h / 2) * sy, w * sx, view.h * sy, 0, 0, W, H);
      // (the map's cherry trees the petals fall from: a pink ring; one he took away, grey and crossed)
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      (bd.meta.trees || []).forEach(([x, top, z, rad], k) => {
        const c = renderer.mapEdit.toImage(x, z, Math.max(0, top - 10));
        if (!c) return;
        const [qx, qy] = toScreen(c[0], c[1]), rr = Math.max(8, (rad * r.height) / view.h);
        const off = F.drop.includes(k);
        g.lineWidth = 3;
        g.strokeStyle = off ? "rgba(160,160,160,0.9)" : "rgba(255,120,190,0.95)";
        g.beginPath();
        g.arc(qx, qy, rr, 0, Math.PI * 2);
        g.stroke();
        if (off) {
          g.beginPath();
          g.moveTo(qx - rr * 0.7, qy - rr * 0.7); g.lineTo(qx + rr * 0.7, qy + rr * 0.7);
          g.moveTo(qx + rr * 0.7, qy - rr * 0.7); g.lineTo(qx - rr * 0.7, qy + rr * 0.7);
          g.stroke();
        }
      });
    }
    function upload(x0, y0, x1, y1) {
      fillFx(F, x0, y0, x1, y1);
      renderer.mapEdit.upload(F.tex, y0, y1);
      paint(x0, y0, x1, y1);
      blit();
    }
    // (the petals' little "trees": one over every 40 px cell a quarter painted, 40 units up, as wide as the cell)
    function emitters() {
      const C = Math.round(40 * sx), out = [];
      for (let cy = 0; cy < fh; cy += C)
        for (let cx = 0; cx < fw; cx += C) {
          let n = 0, m = 0;
          for (let y = cy; y < Math.min(fh, cy + C); y += 2)
            for (let x = cx; x < Math.min(fw, cx + C); x += 2) (n++, P.petal[y * fw + x] > 127 && m++);
          if (!n || m / n < 0.25) continue;
          const g = renderer.mapEdit.toGround((cx + C / 2) / sx, (cy + C / 2) / sy);
          if (g) out.push([Math.round(g[0] * 10) / 10, 40, Math.round(g[1] * 10) / 10, 12]);
        }
      return out.slice(0, 40);
    }
    const TL = 64;
    let st = null, dirty = null, raf = 0;
    const tileOf = (tx, ty) => {
      const x0 = tx * TL, y0 = ty * TL, x1 = Math.min(fw, x0 + TL), y1 = Math.min(fh, y0 + TL), o = { tx, ty };
      for (const k in P) {
        o[k] = [];
        for (let y = y0; y < y1; y++) o[k].push(P[k].slice(y * fw + x0, y * fw + x1));
      }
      return o;
    };
    const putTile = (o) => {
      const x0 = o.tx * TL, y0 = o.ty * TL;
      for (const k in P) o[k].forEach((row, j) => P[k].set(row, (y0 + j) * fw + x0));
    };
    function stamp(ix, iy, Rimg, tool) {
      const gx = ix * sx, gy = iy * sy, R = Rimg * sy;
      const x0 = Math.max(0, Math.floor(gx - R - 1)), x1 = Math.min(fw, Math.ceil(gx + R + 1));
      const y0 = Math.max(0, Math.floor(gy - R - 1)), y1 = Math.min(fh, Math.ceil(gy + R + 1));
      if (x1 <= x0 || y1 <= y0) return;
      for (let ty = Math.floor(y0 / TL); ty <= Math.floor((y1 - 1) / TL); ty++)
        for (let tx = Math.floor(x0 / TL); tx <= Math.floor((x1 - 1) / TL); tx++) {
          const k = ty * 1e4 + tx;
          if (!st.tiles.has(k)) st.tiles.set(k, { before: tileOf(tx, ty) });
        }
      const inner = R * 0.6, plane = { water: P.water, fall: P.fall, petal: P.petal, none: P.none }[tool];
      for (let y = y0; y < y1; y++)
        for (let x = x0, i = y * fw + x0; x < x1; x++, i++) {
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
          if (d >= R) continue;
          let t = d <= inner ? 1 : 1 - (d - inner) / (R - inner);
          t = t * t * (3 - 2 * t);
          const v = Math.round(255 * t);
          plane[i] = Math.max(plane[i], v);
          if (tool === "none") for (const k of ["water", "fall", "petal"]) P[k][i] = Math.min(P[k][i], 255 - v);
          else P.none[i] = Math.min(P.none[i], 255 - v);
        }
      dirty = dirty ? [Math.min(dirty[0], x0), Math.min(dirty[1], y0), Math.max(dirty[2], x1), Math.max(dirty[3], y1)] : [x0, y0, x1, y1];
      st.box = st.box ? [Math.min(st.box[0], x0), Math.min(st.box[1], y0), Math.max(st.box[2], x1), Math.max(st.box[3], y1)] : [x0, y0, x1, y1];
      if (!raf) raf = requestAnimationFrame(flush);
    }
    function flush() {
      raf = 0;
      if (!dirty) return;
      const d = dirty;
      dirty = null;
      upload(...d);
    }
    // (petals and the trees taken away: worked out again after each stroke)
    function settlePetals() {
      F.petals = emitters();
      F.drop = (bd.meta.trees || []).flatMap(([x, top, z], k) => {
        const c = renderer.mapEdit.toImage(x, z, Math.max(0, top - 10));
        if (!c) return [];
        const i = Math.floor(c[1] * sy) * fw + Math.floor(c[0] * sx);
        return i >= 0 && i < N && P.none[i] > 127 ? [k] : [];
      });
      renderer.mapEdit.refreshPetals();
      blit();
    }
    const snapshot = () => ({ planes: Object.fromEntries(Object.entries(P).map(([k, a]) => [k, a.slice()])), petals: JSON.parse(JSON.stringify(F.petals)), drop: [...F.drop] });
    let opened = snapshot(), saved = opened;
    const restore = (sn) => {
      for (const k in P) P[k].set(sn.planes[k]);
      F.petals = JSON.parse(JSON.stringify(sn.petals));
      F.drop = [...sn.drop];
      upload(0, 0, fw, fh);
      renderer.mapEdit.refreshPetals();
    };
    return {
      tools: ["move", "water", "fall", "petal", "none"],
      show(on, c) {
        shown = on;
        colours = c;
        blit();
      },
      blit,
      begin() {
        st = { tiles: new Map(), box: null, petals: JSON.parse(JSON.stringify(F.petals)), drop: [...F.drop] };
      },
      stamp,
      end(keep) {
        if (!st) return;
        const s0 = st;
        st = null;
        if (raf) cancelAnimationFrame(raf), (raf = 0);
        flush();
        const tiles = [...s0.tiles.values()];
        if (!tiles.length) return;
        if (!keep) {
          tiles.forEach((t) => putTile(t.before));
          upload(...s0.box);
          return;
        }
        for (const t of tiles) t.after = tileOf(t.before.tx, t.before.ty);
        settlePetals();
        const after = { petals: JSON.parse(JSON.stringify(F.petals)), drop: [...F.drop] }, box = s0.box;
        const apply = (which, pd) => {
          tiles.forEach((t) => putTile(t[which]));
          F.petals = JSON.parse(JSON.stringify(pd.petals));
          F.drop = [...pd.drop];
          upload(...box);
          renderer.mapEdit.refreshPetals();
        };
        push({ undo: () => apply("before", s0), redo: () => apply("after", after) });
      },
      placePins() {},
      opened: () => restore(opened),
      discard: () => restore(saved),
      async save() {
        const snap = snapshot(), j = packFx(F); // (what is sent, not what stands once it is: see the masks' save)
        const r = await fetch(`/api/fxedit?id=${id}`, { method: "POST", body: JSON.stringify(j), headers: EDIT_HEADERS("application/json") });
        if (!r.ok) throw new Error(`effects ${r.status}`);
        saved = snap;
      },
      wasSaved: () => saved !== opened,
      rebaseOpened() {
        opened = saved = snapshot();
      },
    };
  })();
  if (gone()) throw (ui.remove(), GONE);

  // --- the view and the mode ---
  let colours = true;
  const setView = () => {
    view.h = Math.max(24, Math.min(hMax(), view.h));
    renderer.mapEdit.setView(view);
    layer.placePins();
    if (layer === walkLayer) walkLayer.blit();
    if (fxLayer && layer === fxLayer) fxLayer.blit();
    drawLines();
  };
  const zoomAt = (clientX, clientY, k) => {
    const r = rect();
    const fx = (clientX - r.left) / r.width - 0.5, fy = (clientY - r.top) / r.height - 0.5;
    const h0 = view.h, w0 = (h0 * r.width) / r.height;
    view.h = Math.max(24, Math.min(hMax(), h0 * k));
    const w1 = (view.h * r.width) / r.height;
    view.cx += fx * (w0 - w1);
    view.cy += fy * (h0 - view.h);
    setView();
  };
  let tool = "add", size = 18;
  const setTool = (t) => {
    if (!layer.tools.includes(t)) t = layer.tools[1];
    tool = t;
    for (const b of ui.querySelectorAll("[data-tool]")) {
      b.classList.toggle("is-on", b.dataset.tool === t);
      b.hidden = !layer.tools.includes(b.dataset.tool);
    }
    layerEl.style.cursor = t === "move" ? "grab" : "none";
    cursor.className = `me-cursor me-c-${t}${mode === "walk" ? " me-walkpen" : ""}`;
    cursor.style.borderColor = { water: "#2cc8ff", fall: "#e8e8ff", petal: "#ff7ab4", none: "#ff4a3d" }[t] || "";
  };
  const setSize = (s) => {
    size = Math.max(2, Math.min(200, Math.round(s)));
    $("[data-sizeval]").textContent = String(size);
    cursor.style.width = cursor.style.height = `${size * 2}px`;
  };
  function setMode(m) {
    mode = m;
    layer = m === "walk" ? walkLayer : m === "fx" ? fxLayer : maskLayer;
    maskLayer.show(m === "mask", colours);
    walkLayer?.show(m === "walk", colours);
    fxLayer?.show(m === "fx", colours);
    for (const b of ui.querySelectorAll("[data-mode]")) b.classList.toggle("is-on", b.dataset.mode === m);
    hist = [];
    hpos = savedAt = 0;
    layer.rebaseOpened();
    if (layer.stale) savedAt = -1;
    setTool(tool);
    syncHist();
    $("[data-herohere]").hidden = !pieces || m !== "mask";
    pickPiece(0);
    drawLines();
    setStatus(
      layer.stale ? "Your masks were updated to work like the built-in ones. Press Save to keep that."
        : m === "walk" ? "Green: where the hero can walk."
        : m === "fx" ? "Paint where there is moving water, a waterfall or falling sakura petals; No effect takes the map's own away. Pink rings: the trees petals fall from."
        : pieces ? "Blue covers the hero. In Move, tap a thing to pick it: with a white line it covers him only when he stands behind the line. Drag the hero to try it."
        : "Blue covers the hero wherever they overlap. Mask adds blue, Clear takes it away.",
    );
  }

  // ===== Camp 2.0's objects and their lines ===========================================================================
  const EP = bd.edit, pieces = !!EP?.pid && !!renderer.mapEdit.toGround;   // (Camp 2.0 and the painted arenas: tools/arena/pieces.py)
  const linesEl = $("[data-lines]"), card = $("[data-card]");
  const gsx = EP ? EP.w / info.IW : 1, gsy = EP ? EP.h / info.IH : 1; // (grid px an image px)
  const HERO_H = 19.6; // (render3d.js: his height, game units)
  const OWN = 40000; // (mapedit3d.js OWN_PIECES: his own objects' numbers from here)
  let outline = null; // (the picked object's edge, at grid size: { c, x0, y0, W, H })
  let gest = null; // (a press in Move: a tap picks; a drag moves a dot, the line or the hero — or pans)
  const lineOf = (id) => (id ? lineOfE(EP, id) : null);
  const clone = (L) => (L ? L.map((q) => [q[0], q[1]]) : null);
  const heroFeet = () => {
    const w = world();
    return w ? renderer.mapEdit.toImage(w.player.x, w.player.y, 0) : null;
  };
  // (where he stood when the mode was turned on: put back when it is turned off)
  const home = pieces && world() ? [world().player.x, world().player.y] : null;

  /** The object at image px (ix, iy): the one there, else the commonest within 5 px. */
  function pieceAt(ix, iy) {
    const gx = Math.floor(ix * gsx), gy = Math.floor(iy * gsy);
    if (gx < 0 || gy < 0 || gx >= EP.w || gy >= EP.h) return 0;
    const p0 = EP.pid[gy * EP.w + gx];
    if (p0) return p0;
    const n = new Map();
    const rr = Math.max(5, Math.round(6 * gsx)); // (a finger's width, in the object map's own pixels)
    for (let y = Math.max(0, gy - rr); y <= Math.min(EP.h - 1, gy + rr); y++)
      for (let x = Math.max(0, gx - rr); x <= Math.min(EP.w - 1, gx + rr); x++) {
        const q = EP.pid[y * EP.w + x];
        if (q) n.set(q, (n.get(q) || 0) + 1);
      }
    let best = 0, bn = 0;
    for (const [q, c] of n) if (c > bn) (best = q), (bn = c);
    return best;
  }
  /**
   * An object whose mask is in separate parts becomes one object a part (the owner, 2026-10-15: "if maskings are fully
   * separated from each other, they should be separate selections"): the parts (8-connected) of `id`; every part but the
   * biggest gets a new number of his own, a copy of the line it had (so what covers him is as before), undoable. Specks
   * under SPECK grid px stay with the biggest. Returns the number of the part at image px (ix, iy) (or the nearest).
   */
  const SPECK = 30;
  function splitPiece(id, ix, iy) {
    const { w, h, pid } = EP;
    const own = [];
    for (let i = 0; i < pid.length; i++) if (pid[i] === id) own.push(i);
    if (own.length < 2 * SPECK) return id;
    const comp = new Int32Array(pid.length).fill(-1), parts = [];
    for (const s of own) {
      if (comp[s] >= 0) continue;
      const k = parts.length, list = [s];
      comp[s] = k;
      for (let q = 0; q < list.length; q++) {
        const i = list[q], x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (pid[j] === id && comp[j] < 0) (comp[j] = k), list.push(j);
          }
      }
      parts.push(list);
    }
    const big = parts.filter((p) => p.length >= SPECK);
    if (big.length < 2) return id;
    big.sort((a, b) => b.length - a.length);
    const before = [], after = [], L = EP.lines[id] ? clone(EP.lines[id]) : null, made = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const part of big.slice(1)) {
      const nid = EP.next++;
      made.push(nid);
      for (const i of part) {
        before.push(EP.pc[i]);
        after.push(nid);
        const x = i % w, y = (i / w) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const idx = big.slice(1).flat();
    const apply = (vals, lines) => {
      idx.forEach((i, n) => (EP.pc[i] = vals[n]));
      for (const nid of made) lines ? (EP.lines[nid] = clone(lines)) : delete EP.lines[nid];
      fill(EP, x0, y0, x1 + 1, y1 + 1);
      renderer.mapEdit.upload(EP.pidTex, y0, y1 + 1);
    };
    apply(after, L);
    push({ undo: () => (apply(before, null), pickPiece(id)), redo: () => apply(after, L) });
    // (the part tapped: the one under the finger, else the nearest of its pixels)
    const gx = Math.floor(ix * gsx), gy = Math.floor(iy * gsy);
    let best = id, bd2 = Infinity;
    for (const i of own) {
      const d2 = (i % w - gx) ** 2 + (((i / w) | 0) - gy) ** 2;
      if (d2 < bd2) (bd2 = d2), (best = pid[i]);
    }
    return best;
  }
  function buildOutline() {
    outline = null;
    if (!sel) return;
    const { w, h, pid } = EP;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const r = y * w;
      for (let x = 0; x < w; x++)
        if (pid[r + x] === sel) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
    }
    if (x1 < 0) return;
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    const W = x1 - x0 + 1, H = y1 - y0 + 1, c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d"), im = g.createImageData(W, H), d = im.data;
    const inP = (x, y) => x >= 0 && y >= 0 && x < w && y < h && pid[y * w + x] === sel;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const gx = x0 + x, gy = y0 + y, a = inP(gx, gy);
        if (a === inP(gx + 1, gy) && a === inP(gx - 1, gy) && a === inP(gx, gy + 1) && a === inP(gx, gy - 1)) continue;
        // (white on its own edge, dark just outside it: seen on any colour)
        const o = (y * W + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = a ? 255 : 16;
        d[o + 3] = a ? 255 : 200;
      }
    g.putImageData(im, 0, 0);
    outline = { c, x0, y0, W, H };
  }
  /** The lines (every object's that has one; the picked one's with its dots), the picked one's outline, his feet's dot. */
  function drawLines() {
    const r = rect(), dpr = devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (linesEl.width !== W || linesEl.height !== H) (linesEl.width = W), (linesEl.height = H);
    const g = linesEl.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!pieces || mode !== "mask" || !colours) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (outline) {
      const [ax, ay] = toScreen(outline.x0 / gsx, outline.y0 / gsy), [bx, by] = toScreen((outline.x0 + outline.W) / gsx, (outline.y0 + outline.H) / gsy);
      g.imageSmoothingEnabled = false;
      g.drawImage(outline.c, ax, ay, bx - ax, by - ay);
    }
    g.lineCap = g.lineJoin = "round";
    for (const key of [...Object.keys(EP.lines), ...(EP.autoLines ? Object.keys(EP.pieces?.guess || {}) : [])]) {
      const pts = lineOf(Number(key));
      if (EP.autoLines && Number(key) !== sel) continue; // (a painted arena: only the picked one's — hundreds otherwise)
      if (!pts?.length) continue;
      const on = Number(key) === sel, sp = pts.map(([x, y]) => toScreen(x, y)), a = sp[0], b = sp[sp.length - 1];
      // (past its ends it carries on level, as the game takes it: shown faint)
      const ext = Math.max(40, (b[0] - a[0]) * 0.5);
      g.setLineDash([4, 5]);
      g.strokeStyle = "rgba(255, 255, 255, 0.6)";
      g.lineWidth = on ? 2 : 1.5;
      g.beginPath();
      g.moveTo(a[0] - ext, a[1]);
      g.lineTo(a[0], a[1]);
      g.moveTo(b[0], b[1]);
      g.lineTo(b[0] + ext, b[1]);
      g.stroke();
      g.setLineDash([]);
      for (const [lw, col] of [[on ? 6 : 4, "rgba(10, 8, 16, 0.85)"], [on ? 3 : 2, "#ffffff"]]) {
        g.lineWidth = lw;
        g.strokeStyle = col;
        g.beginPath();
        sp.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        if (sp.length === 1) g.lineTo(a[0] + 0.01, a[1]);
        g.stroke();
      }
      if (on)
        sp.forEach(([x, y], k) => {
          g.beginPath();
          g.arc(x, y, k === selDot ? 9 : 7, 0, Math.PI * 2);
          g.fillStyle = k === selDot ? "#ffd447" : "#ffffff";
          g.fill();
          g.lineWidth = 2;
          g.strokeStyle = "rgba(10, 8, 16, 0.9)";
          g.stroke();
        });
    }
    // (his feet: the point every line is tested against)
    const f = heroFeet();
    if (f) {
      const [x, y] = toScreen(f[0], f[1]);
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = "rgba(10, 8, 16, 0.9)";
      g.stroke();
    }
  }
  function updateCard() {
    card.hidden = !pieces || mode !== "mask" || !sel;
    if (card.hidden) return;
    const L = lineOf(sel);
    $("[data-cardtext]").textContent = L
      ? `This covers him when he stands behind its white line. ${renderer.mapEdit.covers(sel) ? "He is behind it now." : "He is in front of it now."}`
      : "No line: this covers him wherever they overlap. Add a line to let him walk in front of it too.";
    $("[data-addline]").hidden = !!L;
    $("[data-resetline]").hidden = $("[data-delline]").hidden = !L;
    $("[data-deldot]").hidden = !(L && selDot >= 0 && L.length > 1);
  }
  // (the card says whether he is behind: the game works it out as it draws the next frame)
  const laterCard = () => requestAnimationFrame(() => requestAnimationFrame(updateCard));
  function pickPiece(id) {
    if (!pieces) return;
    sel = id;
    selDot = -1;
    buildOutline();
    if (sel && !outline) sel = 0; // (nothing of it left masked: gone)
    updateCard();
    drawLines();
  }
  /** A first line for an object: Claude's guess (tools/camp2/pieces.py), or for one of his own a dot under its middle. */
  function guessLine(id) {
    const g0 = id < OWN ? EP.pieces?.guess?.[id] : null;
    if (g0?.length) return clone(g0);
    if (!outline) return null;
    const { x0, y0, W, H } = outline, { w, pid } = EP;
    let lo = -1, sx = 0, n = 0;
    for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) if (pid[y * w + x] === id) (lo = Math.max(lo, y)), (sx += x), n++;
    if (!n) return null;
    const cx = sx / n;
    let bot = lo;
    for (let y = lo; y >= y0; y--) if (pid[y * w + Math.round(cx)] === id) { bot = y; break; }
    return [[cx / gsx, (bot + 1) / gsy]];
  }
  function setLine(id, L) {
    if (L) EP.lines[id] = clone(L);
    // (no line: in a painted arena that must be said — its guess would come back — so [] stands for "none")
    else if (EP.autoLines) EP.lines[id] = [];
    else delete EP.lines[id];
    if (selDot >= (L?.length ?? 0)) selDot = -1;
    drawLines();
    laterCard();
  }
  /** A change to a line, undoable. */
  function lineEdit(id, before, after) {
    setLine(id, after);
    push({ undo: () => setLine(id, before), redo: () => setLine(id, after) });
  }
  const segDist = (x, y, a, b) => {
    const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1)));
    return Math.hypot(a[0] + ex * t - x, a[1] + ey * t - y);
  };
  /** What a press at the screen point lands on: a dot of the picked line, the hero, the picked line — or nothing. */
  function hitAt(cx, cy) {
    if (!pieces || mode !== "mask" || !colours) return null;
    const r = rect(), x = cx - r.left, y = cy - r.top;
    const L = lineOf(sel), sp = L ? L.map(([a, b]) => toScreen(a, b)) : [];
    for (let k = 0; k < sp.length; k++) if (Math.hypot(sp[k][0] - x, sp[k][1] - y) <= 14) return { kind: "dot", k };
    const w = world();
    if (w) {
      const f = toScreen(...renderer.mapEdit.toImage(w.player.x, w.player.y, 0)), hd = toScreen(...renderer.mapEdit.toImage(w.player.x, w.player.y, HERO_H));
      const hh = Math.max(14, f[1] - hd[1]);
      if (Math.abs(x - f[0]) <= hh * 0.35 && y >= hd[1] - hh * 0.1 && y <= f[1] + 8) return { kind: "hero", off: [f[0] - x, f[1] - y] };
    }
    for (let k = 1; k < sp.length; k++) if (segDist(x, y, sp[k - 1], sp[k]) <= 8) return { kind: "line", k };
    return null;
  }
  /** The hero put down where image px (ix, iy) lies on the ground, held where he can walk — drawing only, the sim untouched. */
  function putHero(ix, iy) {
    const w = world(), g = renderer.mapEdit.toGround(ix, iy);
    if (!w || !g) return;
    const o = { x: g[0], y: g[1] };
    w.arena?.keep?.(o, PLAYER.radius + 2);
    w.player.x = o.x;
    w.player.y = o.y;
    renderer.mapEdit.heroMoved();
    drawLines();
    laterCard();
  }
  function dragTo(cx, cy) {
    // (a guessed line is copied into his own before it moves: the guess itself stays as it was)
    if ((gest.h.kind === "dot" || gest.h.kind === "line") && sel && !EP.lines[sel] && lineOf(sel)) EP.lines[sel] = clone(lineOf(sel));
    const h = gest.h, [ix, iy] = toImg(cx, cy), L = lineOf(sel);
    if (h.kind === "dot" && L) {
      L[h.k] = [ix, iy];
      selDot = h.k;
    } else if (h.kind === "line" && L) {
      const [lx, ly] = gest.last;
      for (const q of L) (q[0] += ix - lx), (q[1] += iy - ly);
      gest.last = [ix, iy];
    } else if (h.kind === "hero") putHero(...toImg(cx + h.off[0], cy + h.off[1]));
    drawLines();
    laterCard();
  }
  function endGest() {
    const g = gest;
    gest = null;
    if (!g) return;
    const L = lineOf(sel);
    if (!g.moved) {
      if (!g.h) {
        const [ix, iy] = toImg(g.x, g.y), id = pieceAt(ix, iy);
        pickPiece(id ? splitPiece(id, ix, iy) : 0);
      }
      else if (g.h.kind === "dot") (selDot = g.h.k), updateCard(), drawLines();
      else if (g.h.kind === "line" && L) {
        // (a tap on the line: a dot there, on the line)
        const [ix, iy] = toImg(g.x, g.y), a = L[g.h.k - 1], b = L[g.h.k];
        const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((ix - a[0]) * ex + (iy - a[1]) * ey) / (ex * ex + ey * ey || 1)));
        const after = clone(L);
        after.splice(g.h.k, 0, [a[0] + ex * t, a[1] + ey * t]);
        selDot = g.h.k;
        lineEdit(sel, g.before, after);
      }
      return;
    }
    if (L && (g.h?.kind === "dot" || g.h?.kind === "line")) {
      // (kept left to right: the game reads it by his feet's column)
      const moved = g.h.kind === "dot" ? L[g.h.k] : null;
      L.sort((a, b) => a[0] - b[0]);
      if (moved) selDot = L.indexOf(moved);
      lineEdit(sel, g.before, clone(L));
    }
  }
  $("[data-addline]").onclick = () => sel && lineEdit(sel, null, guessLine(sel));
  $("[data-resetline]").onclick = () => {
    if (!sel) return;
    if (!EP.autoLines) return lineEdit(sel, clone(lineOf(sel)), guessLine(sel));
    // (a painted arena: back to its guess, which stays its own)
    const before = EP.lines[sel] ? clone(EP.lines[sel]) : undefined;
    const back = (v) => {
      if (v === undefined) delete EP.lines[sel];
      else EP.lines[sel] = clone(v);
      drawLines();
      laterCard();
    };
    back(undefined);
    push({ undo: () => back(before), redo: () => back(undefined) });
  };
  $("[data-delline]").onclick = () => sel && ((selDot = -1), lineEdit(sel, clone(lineOf(sel)), null));
  $("[data-deldot]").onclick = () => {
    const L = lineOf(sel);
    if (!L || selDot < 0 || L.length < 2) return;
    const after = clone(L);
    after.splice(selDot, 1);
    selDot = -1;
    lineEdit(sel, clone(L), after);
  };
  $("[data-cardclose]").onclick = () => pickPiece(0);
  const heroHere = () => pieces && putHero(view.cx, view.cy + view.h * 0.1);
  $("[data-herohere]").onclick = heroHere;

  if (!walkLayer) $('[data-mode="walk"]').hidden = true;
  $('[data-mode="fx"]').hidden = !fxLayer;
  setSize(18);
  setMode("mask");
  setView();

  /** Leaving the view (or the mode) with changes not saved: save them, throw them away, or stay. False: stay. */
  async function settle(what) {
    if (!dirty()) return true;
    const a = await ask("Save your changes?", `You have changes to the ${mode === "walk" ? "walk area" : mode === "fx" ? "effects" : "masks"} that are not saved. ${what}`, [
      ["save", "Save", "me-primary"],
      ["discard", "Don't save"],
      ["cancel", "Cancel"],
    ]);
    if (a === "cancel") return false;
    if (a === "save") return doSave();
    layer.discard();
    return true;
  }
  // (one save at a time: a second — Ctrl+S, the button, a leave asking — waits for it and then saves only what is still not
  // saved; two at once raced each other to the server, and the older could land last)
  let saving = null;
  function doSave() {
    if (saving) return saving.then((ok) => (ok && dirty() ? doSave() : ok));
    saving = saveNow().finally(() => (saving = null));
    return saving;
  }
  async function saveNow() {
    setStatus("Saving…");
    $("[data-save]").disabled = true;
    // (the history's place as it is sent: edits made while it uploads stay unsaved — marked after the awaits, they were not)
    const h = hist, at = hpos, mark = hist[at - 1];
    try {
      await layer.save();
      if (hist === h && hist[at - 1] === mark) savedAt = at;
      else if (hist === h) savedAt = -1; // (undone past and changed meanwhile: what was saved is no longer in the history)
      syncHist();
      setStatus("Saved. The version before it is kept as a backup.");
      return true;
    } catch (err) {
      console.error("map edit save:", err);
      setStatus("Could not save. Save works only in the game the PC runs (localhost:8083 there, or its Wi-Fi address on a phone at home), not on the live site.");
      syncHist();
      return false;
    }
  }

  // --- pointers: one draws (or moves, with Move), two pinch and pan; the wheel zooms; space, the middle or right button pan ---
  const ptrs = new Map();
  let pan = null, pinch = null, spaceDown = false, lastPt = null;
  const penImg = () => (size * view.h) / rect().height;
  const strokeTo = (clientX, clientY) => {
    const [ix, iy] = toImg(clientX, clientY), R = penImg();
    if (!lastPt) {
      layer.stamp(ix, iy, R, stroke.tool);
      lastPt = [ix, iy];
      return;
    }
    // (dabs a third of the pen apart along the way, from the last dab — not from the last mouse event: a mouse sends many
    // moves shorter than that, and measured from each one no dab was ever due; only the first click painted — the owner,
    // 2026-10-14: "Still not painting while dragging")
    const [lx, ly] = lastPt, L = Math.hypot(ix - lx, iy - ly), step = Math.max(0.5, R * 0.3);
    if (L < step) return;
    let s = step;
    for (; s <= L + 0.01; s += step) layer.stamp(lx + ((ix - lx) * s) / L, ly + ((iy - ly) * s) / L, R, stroke.tool);
    s -= step;
    lastPt = [lx + ((ix - lx) * s) / L, ly + ((iy - ly) * s) / L];
  };
  const endStroke = (keep) => {
    if (!stroke) return;
    const t = stroke.tool;
    stroke = null;
    lastPt = null;
    layer.end(keep, t);
  };
  layerEl.addEventListener("contextmenu", (e) => e.preventDefault());
  // (no native drag or text selection to take the stroke over)
  layerEl.addEventListener("dragstart", (e) => e.preventDefault());
  layerEl.addEventListener("pointerdown", (e) => {
    layerEl.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      endStroke(false);
      if (gest) (gest.moved = true), endGest();
      pan = null;
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (ptrs.size > 2) return;
    if (tool === "move" || e.button === 1 || e.button === 2 || spaceDown) {
      // (Move, the left button or a finger: a tap picks an object; a drag on the picked line's dot, the line or the hero moves
      // it; elsewhere a drag pans)
      if (tool === "move" && e.button === 0 && !spaceDown && pieces) {
        const h = hitAt(e.clientX, e.clientY);
        gest = { x: e.clientX, y: e.clientY, h, moved: false, before: clone(lineOf(sel)), last: toImg(e.clientX, e.clientY) };
        if (h) return;
      }
      pan = { x: e.clientX, y: e.clientY };
      layerEl.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;
    stroke = { tool };
    layer.begin(tool);
    strokeTo(e.clientX, e.clientY);
  });
  layerEl.addEventListener("pointermove", (e) => {
    const r = rect();
    cursor.hidden = tool === "move" || e.pointerType !== "mouse";
    cursor.style.transform = `translate(${e.clientX - r.left - size}px, ${e.clientY - r.top - size}px)`;
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      view.cx -= ((mx - pinch.mx) * view.h) / r.height;
      view.cy -= ((my - pinch.my) * view.h) / r.height;
      if (d > 4 && pinch.d > 4) zoomAt(mx, my, pinch.d / d);
      else setView();
      pinch = { d, mx, my };
      return;
    }
    if (gest) {
      if (!gest.moved && Math.hypot(e.clientX - gest.x, e.clientY - gest.y) > 5) gest.moved = true;
      if (gest.moved && gest.h) {
        dragTo(e.clientX, e.clientY);
        return;
      }
    }
    if (pan) {
      view.cx -= ((e.clientX - pan.x) * view.h) / r.height;
      view.cy -= ((e.clientY - pan.y) * view.h) / r.height;
      pan = { x: e.clientX, y: e.clientY };
      setView();
      return;
    }
    // (every position the browser gathered since the last move — but when it gathered none it hands an empty list, which is
    // still "something": the stroke then painted nothing while dragging, only the first click (the owner, 2026-10-14)
    if (stroke) {
      const list = e.getCoalescedEvents?.();
      for (const c of list && list.length ? list : [e]) strokeTo(c.clientX, c.clientY);
    }
  });
  layerEl.addEventListener("pointerup", (e) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (pan && !ptrs.size) {
      pan = null;
      layerEl.style.cursor = tool === "move" ? "grab" : "none";
    }
    if (stroke && !ptrs.size) endStroke(true);
    if (gest && !ptrs.size) endGest();
  });
  // (a cancelled pointer — the browser took the drag over — keeps what was painted so far: thrown away, a stroke vanished)
  layerEl.addEventListener("pointercancel", (e) => {
    ptrs.delete(e.pointerId);
    pinch = pan = null;
    endStroke(true);
    if (gest) (gest.moved = true), endGest();
  });
  layerEl.addEventListener("pointerleave", () => (cursor.hidden = true));
  layerEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004));
  }, { passive: false });

  // --- the bar ---
  for (const b of ui.querySelectorAll("[data-tool]")) b.onclick = () => setTool(b.dataset.tool);
  for (const b of ui.querySelectorAll("[data-mode]"))
    b.onclick = async () => {
      if (b.dataset.mode === mode) return;
      if (await settle("You are switching to the other view.")) setMode(b.dataset.mode);
    };
  for (const b of ui.querySelectorAll("[data-size]")) b.onclick = () => setSize(size * (b.dataset.size === "1" ? 1.3 : 1 / 1.3));
  for (const b of ui.querySelectorAll("[data-zoom]"))
    b.onclick = () => {
      const r = rect();
      if (b.dataset.zoom === "fit") {
        view.cx = info.IW / 2;
        view.cy = info.IH / 2;
        view.h = hMax() / 1.15;
        setView();
      } else zoomAt(r.left + r.width / 2, r.top + r.height / 2, b.dataset.zoom === "in" ? 1 / 1.5 : 1.5);
    };
  $("[data-show]").onclick = () => {
    colours = !colours;
    $("[data-show]").classList.toggle("is-on", colours);
    layer.show(true, colours);
    drawLines();
  };
  $("[data-show]").classList.add("is-on");
  $("[data-undo]").onclick = undo;
  $("[data-redo]").onclick = redo;
  $("[data-undoall]").onclick = async () => {
    const what = mode === "walk" ? "walk area" : mode === "fx" ? "effects" : "masks";
    const a = await ask("Undo all?", `Every change to the ${what} since you opened this view goes back to how it was then.${layer.wasSaved() ? " That includes what you saved since: save again afterwards to keep it that way." : ""}`, [
      ["yes", "Undo all", "me-danger"],
      ["no", "Cancel"],
    ]);
    if (a !== "yes") return;
    endStroke(false);
    const savedSince = layer.wasSaved();
    layer.opened();
    hist = [];
    hpos = 0;
    savedAt = savedSince ? -1 : 0;
    syncHist();
    setStatus(savedSince ? "Back to how it was. Not saved yet." : "Back to how it was.");
  };
  $("[data-save]").onclick = () => doSave();
  const onKey = (e) => {
    if (e.target === noteText || !$("[data-modal]").hidden) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") (e.preventDefault(), e.shiftKey ? redo() : undo());
    else if ((e.ctrlKey || e.metaKey) && k === "y") (e.preventDefault(), redo());
    else if ((e.ctrlKey || e.metaKey) && k === "s") (e.preventDefault(), e.type === "keydown" && !saving && dirty() && doSave());
    else if (k === "[") setSize(size / 1.2);
    else if (k === "]") setSize(size * 1.2);
    else if (k === " ") (e.preventDefault(), (spaceDown = e.type === "keydown"));
    else if (e.type === "keydown" && ["1", "2", "3", "4", "5"].includes(k)) setTool(layer.tools[Number(k) - 1] || tool);
    else if (e.type === "keydown" && k === "escape") (noteForm.hidden = true), pickPiece(0);
    else if (e.type === "keydown" && (k === "delete" || k === "backspace") && pieces && selDot >= 0) $("[data-deldot]").click();
    else if (e.type === "keydown" && k === "h" && pieces) heroHere();
    else return;
    e.stopPropagation();
  };
  const onKeyUp = (e) => {
    if (e.key === " ") spaceDown = false;
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp, true);
  const onResize = () => setView();
  window.addEventListener("resize", onResize);
  // (leaving or reloading the page with changes not saved: the browser asks first — a reload once threw away an evening's
  // unsaved masks without a word, 2026-10-15)
  const onLeave = (e) => {
    if (!dirty()) return;
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", onLeave);

  return {
    dirty,
    save: doSave,
    /** Done: asks about changes not saved first; false if the owner stayed. `now`: the screen is going away — no asking. */
    async close(now = false) {
      endStroke(true);
      if (!now && !(await settle("You are leaving the edit mode."))) return false;
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("beforeunload", onLeave);
      ui.remove();
      // (the hero back where he stood: the test hero was drawing only)
      const w = world();
      if (home && w) {
        [w.player.x, w.player.y] = home;
        renderer.mapEdit.heroMoved();
      }
      renderer.mapEdit.setView(null);
      maskLayer.show(false, false);
      return true;
    },
  };
}

// --- the depth of what the owner masks: from what it rests on ----------------------------------------------------------------
/**
 * Over a rectangle of the grid (and the whole of every masked piece's row and column runs through it): each masked pixel's
 * depth is the nearer of (a) along its row, between what is just left and just right of its run (a rail between its posts)
 * and (b) down its column, what its run rests on (a post's foot on the ground) — never behind what the map itself shows
 * there. The depth map's own units (camp2-pdepth.png, ash-refdepth.png). Returns the rectangle touched.
 */
export function computeDepth(E, D, W, H, x0, y0, x1, y1, O = null) {
  const add = E.add, dep = E.dep;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  let ux0 = x0, ux1 = x1, uy0 = y0, uy1 = y1;
  for (let y = y0; y < y1; y++) {
    let x = x0;
    if (add[y * W + x]) while (x > 0 && add[y * W + x - 1]) x--;
    ux0 = Math.min(ux0, x);
    x = x1 - 1;
    if (add[y * W + x]) while (x < W - 1 && add[y * W + x + 1]) x++;
    ux1 = Math.max(ux1, x + 1);
  }
  for (let x = x0; x < x1; x++) {
    let y = y0;
    if (add[y * W + x]) while (y > 0 && add[(y - 1) * W + x]) y--;
    uy0 = Math.min(uy0, y);
    y = y1 - 1;
    if (add[y * W + x]) while (y < H - 1 && add[(y + 1) * W + x]) y++;
    uy1 = Math.max(uy1, y + 1);
  }
  const RW = ux1 - ux0, RH = uy1 - uy0;
  const along = new Float32Array(RW * RH).fill(65535);
  // (the built-in cut-outs' own depth, odepth (matte.py), where there is one: Camp 2.0)
  const findO = (row, from, step) => {
    for (let k = from, n = 0; n < 24 && k >= 0 && k < W; k += step, n++) if (O.ok[row + k]) return O.d[row + k];
    return -1;
  };
  const near = (a, b, i0) => {
    let m = 65535;
    for (let k = a; k <= b; k++) m = Math.min(m, D[i0 + k]);
    return m;
  };
  for (let y = uy0; y < uy1; y++) {
    const row = y * W;
    let x = ux0;
    while (x < ux1) {
      if (!add[row + x]) {
        x++;
        continue;
      }
      let a = x;
      while (a > 0 && add[row + a - 1]) a--;
      let b = x;
      while (b < W - 1 && add[row + b + 1]) b++;
      // (a piece joined to a built-in one — a rail between its posts: the depth of the pieces it joins, as the built-in
      // cut-out takes its piece's (matte.py odepth), across the run from one to the other)
      const Lo = O ? findO(row, a - 1, -1) : -1, Ro = O ? findO(row, b + 1, 1) : -1;
      const useO = Lo >= 0 || Ro >= 0;
      const L = useO ? (Lo >= 0 ? Lo : 65535) : a > 0 ? near(Math.max(0, a - 8), a - 1, row) : 65535;
      const R = useO ? (Ro >= 0 ? Ro : 65535) : b < W - 1 ? near(b + 1, Math.min(W - 1, b + 8), row) : 65535;
      for (let k = Math.max(a, ux0); k <= Math.min(b, ux1 - 1); k++) {
        let q;
        if (L < 65535 && R < 65535) q = b > a ? L + ((R - L) * (k - a)) / (b - a) : Math.min(L, R);
        else q = Math.min(L, R);
        along[(y - uy0) * RW + (k - ux0)] = q;
      }
      x = b + 1;
    }
  }
  for (let x = ux0; x < ux1; x++) {
    let y = uy0;
    while (y < uy1) {
      if (!add[y * W + x]) {
        y++;
        continue;
      }
      let a = y;
      while (a > 0 && add[(a - 1) * W + x]) a--;
      let b = y;
      while (b < H - 1 && add[(b + 1) * W + x]) b++;
      let foot = 65535;
      for (let k = b + 1; k <= Math.min(H - 1, b + 3); k++) foot = Math.min(foot, D[k * W + x]);
      for (let k = Math.max(a, uy0); k <= Math.min(b, uy1 - 1); k++) {
        const i = k * W + x, j = (k - uy0) * RW + (x - ux0);
        // (the nearest of: along its row (the pieces it joins), what it rests on (below its painted run), the picture's own
        // depth, and a built-in piece's under it — his mask only ever brings a thing nearer. Taking the built-in piece's depth
        // exactly made his mask do nothing where that depth was wrong: a tabletop 5 units behind the hero let his feet show
        // over it though he had masked it — the owner, 2026-10-14: "the feet is above the table even though i masked it")
        dep[i] = Math.round(Math.min(along[j], foot, D[i], O && O.ok[i] ? O.d[i] : 65535));
      }
      y = b + 1;
    }
  }
  return [ux0, uy0, ux1, uy1];
}

async function decodeDepth(img, flag = false) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const bmp = await createImageBitmap(img, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, w, h).data;
  const d = new Uint16Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = px[i * 4] * 256 + px[i * 4 + 1];
  if (!flag) return { w, h, d };
  // (odepth: B says whether there is a piece's depth there)
  const ok = new Uint8Array(w * h);
  for (let i = 0; i < ok.length; i++) ok[i] = px[i * 4 + 2] > 127 ? 1 : 0;
  return { w, h, d, ok };
}

async function gzip(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}
