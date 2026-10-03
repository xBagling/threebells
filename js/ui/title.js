// The start screen. Pocket Quest opens on a glowing door in a dark wood and one clear button; this
// opens on three bells over a brazier, and the same one clear button.
//
// The picture is the painted title (public/art/title.png) when there is one, and the pixel scene
// gfx/art/title.js generates at boot when there is not. Everything alive on it — the fire
// breathing, the bells catching the light, stars, embers drifting up the hill — is drawn over the
// top each frame, at points that come with the picture (for the painting, public/art/title.json).
//
// Practice is always here, whatever the day holds (the owner's 2.4): it opens a choice of the
// bosses reached this week, and never counts.
import { ART } from "../gfx/atlas.js?v=8898846";
import { html, raw, clamp, TAU, untilNext, rng } from "../util.js?v=8898846";
import { sfx, unlock } from "../audio.js?v=8898846";
import { CONFIG } from "../config.js?v=8898846";
import { dayNumber, weekNumber, dayOfWeek, weekModifier } from "../daily.js?v=8898846";
import { get as getSave, nextTier, weekCleared } from "../store.js?v=8898846";
import { BOSS_ORDER, BOSSES, MODELLED } from "../content/bosses.js?v=8898846";

// `noView` is main.js's word when this device cannot draw the fight (no WebGL2), shown under the rest.
export function renderTitle(root, { onBegin, onCamp, onHelp, onPractice, noView = "" }) {
  const save = getSave();
  const day = dayNumber();
  const week = weekNumber(day);
  const tier = nextTier();
  const mod = weekModifier(week);
  const done = save.today.done;
  const left = done && save.today.left; // spent by closing or reloading a fight, not by dying in it
  const cleared = weekCleared();
  const label = cleared ? "Victory lap" : tier === 1 ? "Boss I waits" : tier === 2 ? "Boss II waits" : "The Drowned King waits";
  // The bosses reached this week: every one felled, and the one you are up to — all three once the
  // week is cleared.
  const reached = BOSS_ORDER.slice(0, cleared ? BOSS_ORDER.length : tier).map((id, i) => ({ tier: i + 1, spec: BOSSES[id] }));
  // And the bosses made in 3D but not in the season yet, to practise as a preview (the owner, 2026-10-03:
  // "so that I can select from the practice menu").
  const previews = MODELLED.filter((id) => !BOSS_ORDER.includes(id) && BOSSES[id]).map((id) => BOSSES[id]).sort((a, b) => a.tier - b.tier);

  root.innerHTML = html`<section class="title">
    <canvas class="title-canvas" aria-label="Three bells hanging in a broken arch on a dark hill, a brazier burning beneath them"></canvas>
    <div class="title-veil"></div>
    <div class="title-top">
      <div class="tt-kicker">One life a day · ${CONFIG.SEASON}</div>
      <h1 class="tt-name">Three<br />Bells</h1>
      <div class="tt-rule" aria-hidden="true"><i></i><span></span><i></i></div>
    </div>
    <div class="title-bottom">
      <div class="tt-week">Week ${week} · Day ${dayOfWeek(day)} of 7${mod.id !== "none" ? ` · ${mod.name}` : ""}</div>
      ${done
        ? html`<div class="tt-done">
            <div class="tt-done-line">Today is spent.</div>
            ${left ? html`<div class="tt-sub">You left in the middle of a fight, and that counts as a death.</div>` : ""}
            <div class="tt-sub">Next life in ${untilNext()}</div>
            <button class="btn btn-go" data-practice type="button">Practise a fight</button>
          </div>`
        : html`<button class="tt-begin" data-begin type="button"><span class="tt-tap">[Tap]</span> ${cleared ? "for a victory lap" : "to face " + (BOSS_ORDER[tier - 1] === "king" ? "the Drowned King" : "Boss " + ["I", "II", "III"][tier - 1])}</button>
            <div class="tt-sub">${label} · ${save.week.cleared.length} of ${BOSS_ORDER.length} felled this week</div>`}
      ${noView ? html`<div class="tt-sub tt-view">${noView}</div>` : ""}
      <div class="tt-round">
        <button class="rnd" data-camp type="button" aria-label="Camp"><span>Camp</span></button>
        ${done ? "" : html`<button class="rnd" data-practice type="button" aria-label="Practice"><span>Practice</span></button>`}
        <button class="rnd" data-help type="button" aria-label="How to play"><span>How</span></button>
        <button class="rnd" data-gold type="button" aria-label="Gold" disabled><span>${save.gold}g</span></button>
      </div>
    </div>
    <div class="modal tt-pick" data-pick role="dialog" aria-label="Practice" hidden>
      <div class="modal-box">
        <h2>Practice</h2>
        <p class="pick-note">Any boss you have reached this week, as often as you like. It never counts and pays nothing, and your life and blessing for today stay as they are.</p>
        <div class="pick-list">
          ${reached.map(
            ({ tier: t, spec }) => html`<button class="btn pick-boss" data-practice-tier="${t}" type="button">
              <b>${spec.name}</b><i>Boss ${["I", "II", "III"][t - 1]} · ${save.week.cleared.includes(t) ? "felled this week" : "still standing"}</i>
            </button>`
          )}
          ${previews.map(
            (spec) => html`<button class="btn pick-boss" data-practice-boss="${spec.id}" type="button">
              <b>${spec.name}</b><i>Boss ${["I", "II", "III"][spec.tier - 1]} · preview, not in the season yet</i>
            </button>`
          )}
        </div>
        <button class="btn btn-quiet" data-pick-close type="button">Not now</button>
      </div>
    </div>
  </section>`;

  const cv = root.querySelector(".title-canvas");
  const ctx = cv.getContext("2d");
  let raf = 0;
  let t0 = performance.now();
  const rand = rng(4242);
  const flies = Array.from({ length: 26 }, () => ({ x: rand(), y: 0.55 + rand() * 0.45, ph: rand() * TAU, sp: 0.2 + rand() * 0.5, r: 0.6 + rand() * 1.2 }));
  const embers = Array.from({ length: 22 }, () => ({ t: rand(), sp: 0.25 + rand() * 0.5, off: (rand() - 0.5) * 22 }));

  function fit() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    const art = ART.title; // read each frame: the painting may arrive after the screen is up
    if (!art) return;
    const time = (now - t0) / 1000;
    // Overlay sizes are given in pixels of the 384-wide generated title; `u` scales them to a
    // bigger painting, so a spark is the same size on screen whichever picture is up.
    const u = art.unit || 1;
    ctx.imageSmoothingEnabled = !!art.smooth;
    ctx.imageSmoothingQuality = "high";
    // The canvas is capped at 2× the CSS size; on a 3× screen the browser stretches it, and that
    // stretch has to be smooth for a painting (the CSS default is pixelated, for the pixel title).
    const rendering = art.smooth ? "auto" : "pixelated";
    if (cv.style.imageRendering !== rendering) cv.style.imageRendering = rendering;
    const W = cv.width;
    const H = cv.height;
    // Cover the window with the painting, keeping the arch a little above the middle.
    const s = Math.max(W / art.w, H / art.h);
    const ox = (W - art.w * s) / 2;
    const oy = (H - art.h * s) * 0.42;
    ctx.fillStyle = "#08060e";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(art.img.cv, ox, oy, art.w * s, art.h * s);

    const P = (x, y) => [ox + x * s, oy + y * s];
    ctx.globalCompositeOperation = "lighter";

    // The brazier breathes.
    const [fx, fy] = P(art.fire[0], art.fire[1]);
    const flick = 0.72 + Math.sin(time * 7.3) * 0.12 + Math.sin(time * 17.1) * 0.06;
    const fr = art.fire[2] * s * (2.6 + Math.sin(time * 5) * 0.18);
    const g1 = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    g1.addColorStop(0, `rgba(255, 200, 110, ${0.5 * flick})`);
    g1.addColorStop(0.45, `rgba(255, 140, 40, ${0.2 * flick})`);
    g1.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, TAU);
    ctx.fill();

    // The bells catch it, one after another, like something is walking past them.
    art.bells.forEach(([bx, by, br], i) => {
      const k = 0.35 + 0.65 * Math.max(0, Math.sin(time * 0.8 - i * 0.7));
      const [px, py] = P(bx, by);
      const rr = br * s * 3.4;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(255, 214, 107, ${0.3 * k})`);
      g.addColorStop(1, "rgba(255,214,107,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, TAU);
      ctx.fill();
    });

    // The moon, steady.
    const [mx, my] = P(art.moon[0], art.moon[1]);
    const mr = art.moon[2] * s * 3.2;
    const gm = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    gm.addColorStop(0, "rgba(220, 232, 255, 0.22)");
    gm.addColorStop(1, "rgba(220,232,255,0)");
    ctx.fillStyle = gm;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();

    // Stars twinkling.
    for (let i = 0; i < art.stars.length; i++) {
      const [sx, sy, b] = art.stars[i];
      const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * (1.2 + (i % 7) * 0.31) + i));
      const [px, py] = P(sx, sy);
      ctx.fillStyle = `rgba(248, 244, 234, ${k * b * 0.8})`;
      ctx.fillRect(px, py, Math.max(1, s * 0.8 * u), Math.max(1, s * 0.8 * u));
    }

    // The glowing caps along the path, each at its own pace.
    art.caps.forEach(([cx2, cy2, r], i) => {
      const k = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * (0.7 + r * 0.4) + i * 2.1));
      const [px, py] = P(cx2, cy2);
      const rr = 7 * s * r * u;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(122, 228, 255, ${0.35 * k})`);
      g.addColorStop(1, "rgba(122,228,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, TAU);
      ctx.fill();
    });

    // Embers rising off the fire.
    for (const e of embers) {
      const k = (time * e.sp + e.t) % 1;
      const [px, py] = P(art.fire[0] + e.off * k * u, art.fire[1] - (4 + k * 56) * u);
      ctx.fillStyle = `rgba(255, ${Math.round(170 + 60 * (1 - k))}, 80, ${(1 - k) * 0.8})`;
      ctx.fillRect(px, py, Math.max(1, s * u), Math.max(1, s * u));
    }
    ctx.globalCompositeOperation = "source-over";

    // Fireflies in the grass, the one thing here that is alive.
    for (const f of flies) {
      const x = (f.x + Math.sin(time * f.sp + f.ph) * 0.05) * W;
      const y = (f.y + Math.cos(time * f.sp * 0.8 + f.ph) * 0.035) * H;
      const k = 0.25 + 0.75 * Math.max(0, Math.sin(time * 1.7 + f.ph));
      ctx.fillStyle = `rgba(228, 255, 138, ${k * 0.85})`;
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, s * f.r * u), Math.max(1, s * f.r * u));
    }
  }

  fit();
  raf = requestAnimationFrame(draw);
  const onResize = () => fit();
  window.addEventListener("resize", onResize);

  const go = (fn) => (e) => {
    e?.stopPropagation();
    unlock();
    sfx.click();
    fn();
  };
  root.querySelector("[data-camp]").onclick = go(onCamp);
  root.querySelector("[data-help]").onclick = go(onHelp);
  const beginBtn = root.querySelector("[data-begin]");
  if (beginBtn) {
    const begin = (e) => {
      e?.stopPropagation();
      unlock();
      sfx.bell();
      root.querySelector(".title").classList.add("is-going");
      setTimeout(onBegin, 620);
    };
    beginBtn.onclick = begin;
    root.querySelector(".title-canvas").onclick = begin;
  }
  // Practice opens the choice over the hill; a tap outside it closes it again, and never falls
  // through to the hill itself, which would begin the day's scored fight.
  const pick = root.querySelector("[data-pick]");
  const openPick = (open) => (pick.hidden = !open);
  root.querySelector("[data-practice]").onclick = go(() => openPick(true));
  root.querySelector("[data-pick-close]").onclick = go(() => openPick(false));
  pick.onclick = (e) => {
    if (e.target === e.currentTarget) go(() => openPick(false))(e);
  };
  for (const el of root.querySelectorAll("[data-practice-tier]")) el.onclick = go(() => onPractice(Number(el.dataset.practiceTier)));
  for (const el of root.querySelectorAll("[data-practice-boss]")) el.onclick = go(() => onPractice(BOSSES[el.dataset.practiceBoss].tier, el.dataset.practiceBoss));

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  };
}
