// Camp 2.0 (the owner, 2026-10-12: "build this new area as part of the camp. Add a button next to the old camp Saying
// "camp 2.0" do not remove the old camp for now"): the village to walk round — its paths, stairs, bridges and docks — in the
// fight's own view, drawn by the same 3D renderer (camp3d.js draws the village; sim/arena.js holds where you can walk). The
// people of the camp (the smith, the shopkeepers) come later; for now you walk, roll and swing. The old camp stays as it is.
//
// The world under it is a fight's World with nobody to fight: a stand-in "boss" kept hidden and still (never drawn, never
// moving, never hit), the clock's enrage off, the hero unhurt.
import { TICK, MAX_FRAME } from "../config.js?v=79a60b0-466c2a40";
import { World } from "../sim/world.js?v=79a60b0-466c2a40";
import { makeCamera } from "../gfx/camera.js?v=79a60b0-466c2a40";
import { ensure } from "../gfx/atlas.js?v=79a60b0-466c2a40";
import { mountTouch } from "./touch.js?v=79a60b0-466c2a40";
import { safeInsets } from "./fight.js?v=79a60b0-466c2a40";
import { sfx, startAmbient, stopAmbient } from "../audio.js?v=79a60b0-466c2a40";
import { html } from "../util.js?v=79a60b0-466c2a40";
import { get as getSave } from "../store.js?v=79a60b0-466c2a40";
import { mountMapEdit } from "./mapedit.js?v=79a60b0-466c2a40";

/** The village as a World's "boss": what its constructor reads, nothing that acts. */
const VILLAGE = {
  id: "village",
  tier: 0,
  name: "The Village",
  title: "",
  blurb: "",
  arena: "camp2",
  art: "gnasher",
  hp: 1,
  radius: 1,
  body: 0,
  hurt: [0, 0],
  hitH: 1,
  contact: 0,
  poise: 1,
  moveSpeed: 0,
  gap: [1, 1],
  phases: [{ at: 1, moves: [], gapScale: 1 }],
  moves: {},
};

// (the view: render3d.js campFrame draws the village through the camera fitted to the painting, a crop of it kept on the hero
// and inside the painting — the 2D camera here only follows him for the safe rectangle, the zoom and the stick)
export function renderCamp2(root, { input, makeRenderer, onBack }) {
  ensure();
  root.innerHTML = html`<div class="fight camp2">
    <canvas class="fight-canvas" id="game" aria-label="Camp 2.0: the village"></canvas>
    <div class="fight-pad" data-pad></div>
    <div class="camp2-top">
      <button class="btn btn-quiet camp2-back" data-back type="button">Back</button>
      <div class="camp2-name">Camp 2.0 · the village</div>
    </div>
  </div>`;
  const canvas = root.querySelector("#game");
  const padRoot = root.querySelector("[data-pad]");
  const save = getSave();
  const world = new World({ boss: VILLAGE, loadout: [null, null], arms: save.arms, seed: 1, practice: true, debug: { god: true, freezeBoss: true, noEnrage: true } });
  world.state = "fight";
  const b = world.boss;
  b.hidden = b.airborne = true; // (nobody there: never drawn, never in the way)
  b.x = b.y = 1e5;
  const [sx, sy] = world.arena.spawn || [0, 0];
  world.player.x = sx;
  world.player.y = sy;
  world.player.face = Math.PI * 0.25;
  globalThis.__camp2 = { world }; // (read only, for the checks)
  const cam = makeCamera();
  cam.setArena(world.arena);
  globalThis.__camp2.cam = cam;
  // (drawn at the screen's own resolution: the fight's half-resolution look on a phone softened the painting — SSIM 0.84
  // against it at half, the build-arena skill's measurement, tools/camp2/fid.py)
  const renderer = makeRenderer(canvas, { debug: {}, onCue: (name, arg) => sfx[name]?.(arg), aa: { texel: 1, msaa: 4 } });
  globalThis.__camp2.view = () => renderer;
  const pad = mountTouch(padRoot, input, { loadout: [null, null], hand: save.settings.hand, offAct: world.player.arms.offAct, offIcon: world.player.arms.offAct === "jump" ? "jump" : `arm_${world.player.arms.off || world.player.arms.main}` });
  padRoot.classList.toggle("is-on", input.kind === "touch");
  let padKind = "";
  startAmbient();

  let raf = 0, last = performance.now(), acc = 0, clock = 0, running = true;
  // (the map edit mode, ui/mapedit.js: on, the walk stops where it is — nothing moves — and the village is only drawn, as the
  // owner pans, zooms and paints)
  let editing = false;
  const editor = mountMapEdit(root.querySelector(".fight"), {
    renderer,
    world: () => world,
    cam: () => cam,
    onToggle(on) {
      editing = on;
      input.enabled = !on;
      input.flush?.();
      padRoot.classList.toggle("is-on", !on && input.kind === "touch");
      padRoot.classList.toggle("is-off", on || input.kind !== "touch");
      if (on) pad.release();
      acc = 0;
    },
  });
  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const real = Math.min((t - last) / 1000, MAX_FRAME);
    last = t;
    if (editing) {
      renderer.fitCamera(cam);
      renderer.draw(world, cam, clock);
      return;
    }
    clock += real;
    renderer.fitCamera(cam);
    cam.setInsets({ ...safeInsets(input.kind === "touch", cam.vw >= cam.vh, save.settings.hand), top: 52 });
    input.poll(cam, world.player);
    acc += real;
    let guard = 8;
    while (acc >= TICK && guard-- > 0) {
      acc -= TICK;
      const intent = input.consume(world.player, { hold: save.settings.holdToAttack });
      if (intent.pause) {
        leave();
        return;
      }
      renderer.beforeStep(world);
      const events = world.step(intent, TICK);
      renderer.consume(events, world, cam);
      for (const e of events) {
        if (e.t === "roll") sfx.roll();
        if (e.t === "jump") sfx.jump();
        if (e.t === "jumpLand") sfx.jumpLand();
        if (e.t === "swing" && !renderer.cuesHeroSounds) sfx.swing();
      }
      world.state = "fight"; // (nothing ends a walk)
    }
    const restore = renderer.lerpWorld(world, acc / TICK);
    try {
      cam.follow(world.player, null, real, []);
      renderer.parts.step(real);
      renderer.draw(world, cam, clock);
    } finally {
      restore();
    }
    pad.update(world.player);
    if (input.kind !== padKind) {
      padKind = input.kind;
      padRoot.classList.toggle("is-on", padKind === "touch");
      padRoot.classList.toggle("is-off", padKind !== "touch");
      if (padKind !== "touch") pad.release();
    }
  }
  const leave = () => {
    sfx.click();
    onBack();
  };
  root.querySelector("[data-back]").onclick = leave;
  // (the checks and films: n ticks with the stick held at (mx, my), screen space, then one frame drawn; the loop stops)
  globalThis.__camp2.tick = (n = 1, mx = 0, my = 0, at = null, extra = null) => {
    running = false;
    if (at) [world.player.x, world.player.y] = at;
    for (let i = 0; i < n; i++) {
      const intent = { ...input.consume(world.player, {}), mx, my, ...(i === 0 ? extra : null) };
      renderer.beforeStep(world);
      renderer.consume(world.step(intent, TICK), world, cam);
      world.state = "fight";
      clock += TICK;
    }
    renderer.fitCamera(cam);
    cam.follow(world.player, null, n * TICK, []);
    renderer.draw(world, cam, clock);
    return [world.player.x, world.player.y];
  };
  globalThis.__camp2.ready = true;
  input.enabled = true;
  raf = requestAnimationFrame((t) => ((last = t), frame(t)));
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    stopAmbient();
    try {
      renderer.destroy?.();
    } catch {
      // nothing more to free
    }
    pad.destroy();
    editor.destroy();
    input.enabled = false;
    delete globalThis.__camp2;
  };
}
