// The fight screen: the loop that drives everything.
//
// The sim runs at a fixed 1/60 s and the drawing runs as fast as the screen does. Long frames are
// capped rather than simulated in one go, so a stutter never teleports a boss into you.
import { TICK, MAX_FRAME, FIGHT, CONFIG } from "../config.js?v=8898846";
import { World } from "../sim/world.js?v=8898846";
import { makeCamera } from "../gfx/camera.js?v=8898846";
import { ensure } from "../gfx/atlas.js?v=8898846";
import { mountHud } from "./hud.js?v=8898846";
import { mountTouch } from "./touch.js?v=8898846";
import { sfx, startDrone, stopDrone } from "../audio.js?v=8898846";
import { html, raw, clamp, mmss } from "../util.js?v=8898846";
import { get as getSave } from "../store.js?v=8898846";
import { DEBUG, openAdmin, isAdminOpen } from "./admin.js?v=8898846";

/** The pause card's controls, for whatever was used last: keys and mouse, a gamepad, or the thumbs.
 *  A phone has no WASD to read about. The camp's left-handed setting swaps the stick's side. */
function controlsFor(kind, hand) {
  if (kind === "pad") return [["Left stick", "move"], ["Right stick", "aim"], ["A / right trigger", "attack"], ["B / right bumper", "roll"], ["X · Y", "your two slots"]];
  if (kind === "touch")
    return [
      [`${hand === "left" ? "Right" : "Left"} thumb`, "move, wherever it lands; push further to run"],
      ["Aim", "automatic, at the nearest; drag off a button to aim it"],
      ["Big button", "attack"],
      ["The one beside it", "roll"],
      ["Two small buttons", "your two slots"],
    ];
  return [["WASD", "move"], ["Mouse", "aim"], ["Left click / J", "attack"], ["Space / right click", "roll"], ["1 · 2", "your two slots"]];
}

/**
 * What the camera keeps clear of the fight, in css pixels: the HUD's top strip and, with the touch
 * controls up, the button block — along the bottom when the screen is upright, and at the side
 * the buttons are on when it is wide (the right, or the left for the left-handed).
 */
export function safeInsets(touchUp, wide, hand = "right") {
  const side = touchUp && wide ? 220 : 0;
  return { top: 58, right: hand === "left" ? 0 : side, bottom: touchUp && !wide ? 215 : 0, left: hand === "left" ? side : 0 };
}

// Smoothing tries (the owner, 2026-10-02: "a bit of jaggy edges"), picked with ?smooth= in the
// address: 4 finer pixels with soft steps between them, 5 the same pixels with 4x multisampling
// (about 2.2 times today's pixels), 6 native resolution with 4x multisampling (about 9 times),
// 9 supersampled, 0 the old hard texels (3 screen pixels each). Without it, the view's own look:
// 6 on a desktop, 5 on a phone or tablet (render3d.js), the owner's picks.
const SMOOTH = { 0: { legacy: true }, 4: { texel: 2, upscale: "sharp" }, 5: { texel: 2, msaa: 4, upscale: "sharp" }, 6: { texel: 1, msaa: 4 }, 9: { texel: 0.5 } };
function smoothing() {
  try {
    return SMOOTH[new URLSearchParams(location.search).get("smooth")] || null;
  } catch {
    return null; // no address (tests)
  }
}

export function runFight(root, opts, onEnd) {
  const { spec, blessing, modifier, loadout, mods, seed, tier, practice, input } = opts;
  ensure();

  root.innerHTML = html`<div class="fight">
    <canvas class="fight-canvas" id="game" aria-label="${spec.name}, ${spec.title}"></canvas>
    <div class="fight-hud" data-hud></div>
    <div class="fight-pad" data-pad></div>
    <div class="fight-over" data-over></div>
  </div>`;
  const canvas = root.querySelector("#game");
  const hudRoot = root.querySelector("[data-hud]");
  const padRoot = root.querySelector("[data-pad]");
  const overRoot = root.querySelector("[data-over]");

  const save = getSave();
  // A real fight starts at the bell when the boss has one (FIGHT.entrance); the admin menu's jump to a
  // later phase skips it.
  const world = new World({ boss: spec, blessing, loadout, mods, seed, practice, debug: DEBUG, entrance: !opts.phase });
  globalThis.__fight = { world, input: opts.input }; // (a handle for checking a live fight from the console; read only)
  // The admin menu can drop you in at a later phase, so an attack that only exists below a third
  // can be looked at without playing the first two thirds again.
  if (opts.phase) {
    const at = spec.phases[Math.min(spec.phases.length - 1, opts.phase)]?.at ?? 1;
    world.boss.hp = Math.max(1, Math.round(world.boss.hpMax * (at - 0.01)));
  }
  if (blessing?.apply) blessing.apply(world);
  if (modifier?.apply) modifier.apply(world);

  const cam = makeCamera();
  // The painted hero's frames cue their own sounds (a footstep, the blade's whoosh on the frame it
  // cuts, a roll landing, the heavy's slam); they are played here, with everything else.
  // `aimPreview` is the thumb being dragged off a button to aim, for an aim line from the hero:
  // { angle, slot } while a drag is past its threshold, else null (input.js has the details).
  // The fight is drawn by the 3D view (`opts.makeRenderer`, loaded by main.js before the fight). If
  // it fails mid-fight (a lost graphics context, say) it says so through onFail: the fight pauses and
  // the view is made again on a fresh canvas, once. The sim is never touched by any of it.
  const rendererOpts = { debug: DEBUG, onCue: (name, arg) => sfx[name]?.(arg), aimPreview: () => input.aimPreview, aa: smoothing() };
  let canvasEl = canvas;
  let remade = false;
  const freshCanvas = () => {
    const fresh = document.createElement("canvas");
    fresh.className = canvasEl.className;
    fresh.id = canvasEl.id;
    fresh.setAttribute("aria-label", canvasEl.getAttribute("aria-label") || "");
    canvasEl.replaceWith(fresh);
    canvasEl = fresh;
    return fresh;
  };
  const onFail = () => {
    // Deferred: it can be called from inside the frame the view failed in.
    setTimeout(() => {
      if (!running) return;
      if (!ended && world.state === "fight") togglePause(true);
      try {
        renderer.destroy?.();
      } catch {
        // it has already failed
      }
      if (remade) {
        overRoot.insertAdjacentHTML("beforeend", html`<div class="ci-view">The view stopped working on this device. Reload the page to try again.</div>`);
        return;
      }
      remade = true;
      renderer = opts.makeRenderer(freshCanvas(), { ...rendererOpts, onFail });
      renderer.seedAmbient(spec.arena);
      renderer.fitCamera(cam);
    }, 0);
  };
  let renderer;
  const viewNote = opts.viewNote || "";
  try {
    renderer = opts.makeRenderer(canvas, { ...rendererOpts, onFail });
  } catch (err) {
    // The view could not even start (no context, say): no fight, and the day is not touched.
    console.error("3D view: could not start", err);
    try {
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // nothing held
    }
    opts.onNoView?.(err);
    return () => {};
  }
  opts.onStart?.();
  renderer.seedAmbient(spec.arena);

  const hud = mountHud(hudRoot, { spec, modifier, blessing, tier, practice });
  hud.buildHearts(Math.ceil(world.player.hpMax / 20));
  hud.buildSlots(world.player, input.kind === "pad" ? ["X", "Y"] : ["1", "2"]);
  const pad = mountTouch(padRoot, input, { loadout, hand: save.settings.hand });
  padRoot.classList.toggle("is-on", input.kind === "touch");
  // Left-handed, the buttons sit bottom left, so the hearts and stamina move to the bottom right.
  hudRoot.classList.toggle("is-left", save.settings.hand === "left");
  let padKind = "";

  let raf = 0;
  let watchdog = 0;
  let lastFrameAt = performance.now();
  let last = performance.now();
  let acc = 0;
  let running = true;
  let paused = false;
  let ended = false;
  let clock = 0; // wall-clock seconds, for animations that should not stop on hitstop
  const drone = startDrone(spec.tier === 1 ? 98 : spec.tier === 2 ? 110 : 87);

  // The name card at the start.
  overRoot.innerHTML = html`<div class="card-intro" data-intro ${world.state === "bell" ? raw('style="opacity:0"') : ""}>
    <div class="ci-season">${CONFIG.SEASON}</div>
    <div class="ci-tier">Boss ${["I", "II", "III"][tier - 1] || "?"}${practice ? " · practice" : ""}</div>
    <h2 class="ci-name">${spec.name}</h2>
    <div class="ci-title">${spec.title}</div>
    <p class="ci-blurb">${spec.blurb}</p>
    ${viewNote ? html`<div class="ci-view">${viewNote}</div>` : ""}
    ${modifier && modifier.id !== "none" ? html`<div class="ci-affix"><b>${modifier.name}</b> — ${modifier.desc}</div>` : ""}
  </div>`;
  if (world.state === "bell") overRoot.insertAdjacentHTML("beforeend", html`<div class="bell-ask" data-bell>Strike the bell</div>`);
  sfx.open();

  function aimForTouch() {
    // On a phone the blade points at whatever is nearest, so a thumb never has to aim.
    const p = world.player;
    let best = null;
    let bd = 1e9;
    const consider = (x, y, w) => {
      const d = Math.hypot(x - p.x, y - p.y) * w;
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    };
    consider(world.boss.x, world.boss.y, 1);
    for (const a of world.adds) if (a.alive) consider(a.x, a.y, 1.35);
    if (best) input.setTouchAim(Math.atan2(best[1] - p.y, best[0] - p.x));
  }

  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    tick(t);
  }

  function tick(t) {
    if (!running) return;
    lastFrameAt = t;
    const real = Math.min((t - last) / 1000, MAX_FRAME);
    last = t;
    if (paused) return;
    if (contextLost && world.state === "fight" && !ended) {
      togglePause(true);
      return;
    }
    clock += real;

    renderer.fitCamera(cam); // size the view before anything is framed or aimed against it
    // Keep the fight out from under the HUD's top strip and, with the touch controls up, the
    // button block: at its side when the screen is wide, along the bottom when it is upright.
    cam.setInsets(safeInsets(input.kind === "touch", cam.vw >= cam.vh, save.settings.hand));
    input.poll(cam, world.player);
    if (input.kind === "touch") aimForTouch();

    // Time can be slowed or stopped from the admin menu, and "." advances exactly one tick.
    let dt = real * (world.state === "lost" ? world.slow : 1) * (DEBUG.slow ?? 1);
    if (DEBUG.step) {
      dt = DEBUG.stepOnce ? TICK : 0;
      DEBUG.stepOnce = false;
      acc = 0;
    }
    acc += dt;
    let guard = 8;
    while (acc >= TICK && guard-- > 0) {
      acc -= TICK;
      // The input reads the hero to keep the combo going while the attack button is held, and to
      // hand over, once he can take them, the presses it keeps back (an attack pressed with a
      // roll, an aimed swing or throw let go mid-swing). A tick the sim will not move him in —
      // a hitstop, the name card — gets none of those, and one that takes no input at all — the
      // name card, the fight over — drops them, as it drops a fresh press.
      const closed = world.state !== "fight" && world.state !== "bell";
      const intent = input.consume(world.player, { hold: save.settings.holdToAttack, frozen: world.hitstop > 0 || closed, closed });
      if (isAdminOpen()) break;
      if (intent.pause && !ended) {
        togglePause(true);
        return;
      }
      renderer.beforeStep(world); // so the frame can be drawn between this tick and the next
      const events = world.step(intent, TICK);
      renderer.consume(events, world, cam);
      for (const e of events) if (e.t === "sfx") sfx[e.name]?.();
      for (const e of events) {
        if (e.t === "roll") sfx.roll();
        if (e.t === "swing" && !renderer.cuesHeroSounds) sfx.swing(); // otherwise the frame cues it
        if (e.t === "hurt") sfx.hurt();
        if (e.t === "death") sfx.death();
      }
      // Only these two end it. "intro" is also not "fight", and checking for that ended every
      // fight before it began.
      if ((world.state === "won" || world.state === "lost") && !ended) finish();
    }

    cam.trauma = Math.max(cam.trauma, Math.min(1, world.shakeAmt / 22) * save.settings.shake);
    // Frame and draw everything where it is between the last tick and the next, not where the last
    // tick left it — on a 120/144 Hz screen that is what makes movement glide instead of step.
    const restore = renderer.lerpWorld(world, acc / TICK);
    try {
      // (before the boss arrives the camera frames the hero and the bell he is to strike)
      cam.follow(world.player, world.state === "won" ? null : world.boss.hidden && world.bell ? world.bell : world.boss, real, world.hazards);
      renderer.parts.step(real);
      renderer.draw(world, cam, clock);
    } finally {
      restore();
    }
    hud.update(world, input.kind);
    pad.update(world.player);
    // The on-screen controls follow whatever was last used: they come up on a touch and step
    // aside for a mouse, so a touchscreen laptop is not stuck with both.
    if (input.kind !== padKind) {
      padKind = input.kind;
      padRoot.classList.toggle("is-on", padKind === "touch");
      padRoot.classList.toggle("is-off", padKind !== "touch");
      hudRoot.classList.toggle("is-touch", padKind === "touch");
    }

    // The name card fades as the fight starts (held back, unseen, through the bell and the entrance).
    const intro = overRoot.querySelector("[data-intro]");
    if (intro) {
      const k = world.stateT / FIGHT.intro;
      if (world.state === "bell" || world.state === "entrance") {
        intro.style.opacity = "0";
      } else if (world.state !== "intro") {
        intro.remove();
      } else {
        intro.style.opacity = String(k < 0.2 ? k / 0.2 : k > 0.82 ? (1 - k) / 0.18 : 1);
      }
    }
    // The bell's prompt, while it waits to be struck.
    const ask = overRoot.querySelector("[data-bell]");
    if (ask && world.state !== "bell") ask.remove();
  }

  let finishT = 0;
  function finish() {
    if (ended) return;
    ended = true;
    const won = world.state === "won";
    // The win or the death is settled now, not when the result screen comes up: the victory pose
    // or the fall still has two seconds to play, and a page closed in them must not read as a
    // fight left mid-way. (The sim's clock stops here, so this result is the one the screen shows.)
    const result = world.result();
    opts.onSettle?.(result, world);
    sfx[won ? "win" : "lose"]();
    input.enabled = false;
    setTimeout(() => {
      stopDrone();
      onEnd(result, world);
    }, won ? 1900 : 2200);
  }

  function togglePause(on) {
    paused = on;
    input.flush();
    overRoot.innerHTML = on
      ? html`<div class="card-pause">
          <h2>Paused</h2>
          <p class="cp-note">${practice ? "A practice run. Nothing you do here counts." : "Leaving now counts as a death — the attempt is already spent."}</p>
          <div class="cp-keys">${controlsFor(input.kind, save.settings.hand).map(([how, what]) => html`<div><b>${how}</b> ${what}</div>`)}</div>
          <button class="btn btn-go" data-resume type="button">Back to it</button>
          <button class="btn btn-quiet" data-quit type="button">Give up</button>
        </div>`
      : "";
    if (on) {
      overRoot.querySelector("[data-resume]").onclick = () => (sfx.click(), togglePause(false));
      overRoot.querySelector("[data-quit]").onclick = () => {
        sfx.click();
        paused = false;
        world.player.hp = 0;
        world.player.dead = true;
        world.setState("lost");
        finish();
      };
    }
  }

  const onResize = () => renderer.resize(cam);
  window.addEventListener("resize", onResize);
  // A lost graphics context pauses at once, so the fight never runs on unseen; the view either gets
  // it back or is made again through onFail. Lost during the name card, there
  // is nothing to pause yet: the fight is paused the moment it would begin (in the frame loop).
  let contextLost = false;
  const onLost = () => {
    contextLost = true;
    if (!ended && !paused && world.state === "fight") togglePause(true);
  };
  const onRestored = () => {
    contextLost = false;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  const onVis = () => {
    if (document.hidden && !ended && world.state === "fight") togglePause(true);
  };
  document.addEventListener("visibilitychange", onVis);
  // The button top-right is how a phone pauses (a keyboard has Esc, a pad Start). Like them it
  // works from the name card on, until the fight is settled.
  hud.onPause(() => {
    if (ended || paused) return;
    sfx.click();
    togglePause(true);
  });
  // A scored fight asks before the page goes, because closing or reloading it now is a death (the
  // save's live-fight marker is found on the next load). The browser words the question itself.
  // Practice asks nothing, and nor does a fight that has already been settled.
  const onLeave = (e) => {
    if (ended) return;
    e.preventDefault();
    e.returnValue = true; // older browsers only ask when this is set
  };
  if (!practice) window.addEventListener("beforeunload", onLeave);

  input.enabled = true;
  raf = requestAnimationFrame((t) => ((last = t), frame(t)));
  // Some embedded browsers and minimised windows starve requestAnimationFrame while still
  // reporting the page as visible. A game that quietly freezes in that state is a bug, so a timer
  // steps the loop when no frame has arrived for a quarter of a second. A genuinely hidden page is
  // paused by the visibility handler above, so this never runs the fight behind the player back.
  watchdog = setInterval(() => {
    if (!running || paused || document.hidden) return;
    const now = performance.now();
    if (now - lastFrameAt > 120) tick(now);
  }, 60);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(watchdog);
    stopDrone();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("beforeunload", onLeave);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    // A 3D view holds a graphics context; browsers keep only a few alive, so it is given back.
    try {
      renderer.destroy?.();
    } catch {
      // nothing more to free
    }
    pad.destroy();
    input.enabled = false;
  };
}
