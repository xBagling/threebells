// The start screen. Pocket Quest opens on a glowing door in a dark wood and one clear button; this
// opens on the Warden under the empty bell arch at dawn, and the same one clear button.
//
// The picture is the painted story title (public/art/title.png, 4:3, and title-tall.png, 2:3, for an upright
// phone; the owner's pick of 2026-10-18, its story in docs/OWNER-DECISIONS.md) when there is one, and the pixel
// scene gfx/art/title.js generates at boot when there is not. Everything alive on it — the arch's lanterns
// flickering, the sun breathing and glittering on the sea, motes drifting (the generated one: the fire, the bells
// catching its light, moon, stars, caps, embers and fireflies) — is drawn over the top each frame, at points that come
// with the picture (for the paintings, public/art/title.json and title-tall.json).
//
// Practice is always here, whatever the day holds (the owner's 2.4): it opens a choice of the
// bosses reached this week, and never counts.
import { ART } from "../gfx/atlas.js?v=48fd128-df87a96f";
import { html, raw, TAU, untilNext, rng } from "../util.js?v=48fd128-df87a96f";
import { sfx, unlock } from "../audio.js?v=48fd128-df87a96f";
import { CONFIG } from "../config.js?v=48fd128-df87a96f";
import { dayNumber, weekNumber, dayOfWeek, weekModifier } from "../daily.js?v=48fd128-df87a96f";
import { get as getSave, nextTier, weekCleared } from "../store.js?v=48fd128-df87a96f";
import { BOSS_ORDER, BOSSES, MODELLED } from "../content/bosses.js?v=48fd128-df87a96f";

// `noView` is main.js's word when this device cannot draw the fight (no WebGL2), shown under the rest.
export function renderTitle(root, { onBegin, onCamp, onCamp2, onHelp, onSettings, onPractice, noView = "" }) {
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

  // (the big practise button always there, the day spent or not — the owner, 2026-10-10: "The practise a fight button should
  // always be visible"; it was only shown once the day was spent)
  root.innerHTML = html`<section class="title">
    <canvas class="title-canvas" aria-label="The Warden, seen from behind, under an old stone arch whose three bell hooks hang empty, looking out at dawn over a village and the three far shrines where the bells are now"></canvas>
    <div class="title-veil"></div>
    <div class="title-top">
      <div class="tt-kicker">One life a day · ${CONFIG.SEASON}</div>
      <h1 class="tt-name">Three <br />Bells</h1>
      <div class="tt-rule" aria-hidden="true"><i></i><span></span><i></i></div>
    </div>
    <div class="title-bottom">
      <div class="tt-week">Week ${week} · Day ${dayOfWeek(day)} of 7${mod.id !== "none" ? ` · ${mod.name}` : ""}</div>
      ${done
        ? html`<div class="tt-done">
            <div class="tt-done-line">Today is spent.</div>
            ${left ? html`<div class="tt-sub">You left in the middle of a fight, and that counts as a death.</div>` : ""}
            <div class="tt-sub">Next life in ${untilNext()}</div>
          </div>`
        : html`<button class="tt-begin" data-begin type="button"><span class="tt-tap">[Tap]</span> ${cleared ? "for a victory lap" : "to face " + (BOSS_ORDER[tier - 1] === "king" ? "the Drowned King" : "Boss " + ["I", "II", "III"][tier - 1])}</button>
            <div class="tt-sub">${label} · ${save.week.cleared.length} of ${BOSS_ORDER.length} felled this week</div>`}
      <button class="btn btn-go tt-practise" data-practice type="button">Practise a fight</button>
      ${noView ? html`<div class="tt-sub tt-view">${noView}</div>` : ""}
      <div class="tt-round">
        <button class="rnd" data-camp type="button" aria-label="Camp"><span>Camp</span></button>
        <button class="rnd rnd-camp2" data-camp2 type="button" aria-label="Camp 2.0"><span>Camp 2.0</span></button>
        <button class="rnd" data-help type="button" aria-label="How to play"><span>How</span></button>
        <button class="rnd" data-settings type="button" aria-label="Settings"><span>Settings</span></button>
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
  // Glints on the sea under the sun: a spot each down the light's path, each with its own twinkle.
  const glints = Array.from({ length: 18 }, () => ({ v: rand(), h: rand() * 2 - 1, ph: rand() * TAU, sp: 1.6 + rand() * 2.4 }));

  function fit() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    // Read each frame: the painting may arrive after the screen is up. An upright window gets the tall picture of the
    // same scene when there is one: past the shape halfway (geometrically) between the two pictures, 4:3 and 2:3.
    const tall = ART.titleTall && cv.width / cv.height < Math.sqrt((ART.title?.w / ART.title?.h || 4 / 3) * (ART.titleTall.w / ART.titleTall.h));
    const art = tall ? ART.titleTall : ART.title;
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
    const glow = (x, y, r, stops) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      for (const [at, c] of stops) g.addColorStop(at, c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };
    ctx.globalCompositeOperation = "lighter";

    // The brazier breathes (the generated title; the story title has none).
    if (art.fire) {
      const [fx, fy] = P(art.fire[0], art.fire[1]);
      const flick = 0.72 + Math.sin(time * 7.3) * 0.12 + Math.sin(time * 17.1) * 0.06;
      const fr = art.fire[2] * s * (2.6 + Math.sin(time * 5) * 0.18);
      glow(fx, fy, fr, [[0, `rgba(255, 200, 110, ${0.5 * flick})`], [0.45, `rgba(255, 140, 40, ${0.2 * flick})`], [1, "rgba(255,120,30,0)"]]);
    }

    // The arch's two stone lanterns flicker, each on its own beat; a far fire (`fires`, none on the story title now)
    // would smoulder slower.
    (art.lanterns || []).forEach(([lx, ly, lr], i) => {
      const [px, py] = P(lx, ly);
      const flick = 0.7 + Math.sin(time * 6.1 + i * 2.3) * 0.13 + Math.sin(time * 15.7 + i) * 0.07;
      glow(px, py, lr * s * (1.9 + Math.sin(time * 4.3 + i) * 0.12), [[0, `rgba(255, 196, 110, ${0.42 * flick})`], [0.5, `rgba(255, 140, 50, ${0.14 * flick})`], [1, "rgba(255,120,30,0)"]]);
    });
    (art.fires || []).forEach(([fx, fy, fr], i) => {
      const [px, py] = P(fx, fy);
      const k = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.9 + i)) + Math.sin(time * 9.7) * 0.06;
      glow(px, py, fr * s * 1.6, [[0, `rgba(255, 120, 50, ${0.26 * k})`], [1, "rgba(255,90,30,0)"]]);
    });

    // The bells catch the light, one after another, like something is walking past them (the generated title; the
    // story title's far bells went with its far shrines: the owner, 2026-10-18, "you dont have to show the places for
    // the three Bells in the background. Instead show a vast biome").
    (art.bells || []).forEach(([bx, by, br], i) => {
      const k = 0.35 + 0.65 * Math.max(0, Math.sin(time * 0.8 - i * 0.7));
      const [px, py] = P(bx, by);
      glow(px, py, br * s * 3.4, [[0, `rgba(255, 214, 107, ${0.3 * k})`], [1, "rgba(255,214,107,0)"]]);
    });

    // The rising sun, breathing slowly.
    if (art.sun) {
      const [sx, sy] = P(art.sun[0], art.sun[1]);
      const k = 0.85 + 0.15 * Math.sin(time * 0.6);
      glow(sx, sy, art.sun[2] * s * 4.2, [[0, `rgba(255, 236, 190, ${0.2 * k})`], [0.4, `rgba(255, 200, 130, ${0.08 * k})`], [1, "rgba(255,190,120,0)"]]);
    }
    // ... and glitters on the sea below it: `glitter` is [x, top, bottom, half-width] of the painted light path, the
    // glints narrower near the horizon and wider toward the shore, as a path of light on water is.
    if (art.glitter) {
      const [gx, g0, g1, gw] = art.glitter;
      for (const g of glints) {
        const k = Math.max(0, Math.sin(time * g.sp + g.ph)) ** 3; // mostly dark, a short flash
        if (k < 0.02) continue;
        const [px, py] = P(gx + g.h * gw * (0.35 + 0.65 * g.v), g0 + (g1 - g0) * g.v);
        glow(px, py, Math.max(1.5, s * u * (0.8 + g.v)), [[0, `rgba(255, 246, 220, ${0.75 * k})`], [1, "rgba(255,240,210,0)"]]);
      }
    }

    // The moon, steady.
    if (art.moon) {
      const [mx, my] = P(art.moon[0], art.moon[1]);
      glow(mx, my, art.moon[2] * s * 3.2, [[0, "rgba(220, 232, 255, 0.22)"], [1, "rgba(220,232,255,0)"]]);
    }

    // Stars twinkling.
    const stars = art.stars || [];
    for (let i = 0; i < stars.length; i++) {
      const [sx, sy, b] = stars[i];
      const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * (1.2 + (i % 7) * 0.31) + i));
      const [px, py] = P(sx, sy);
      ctx.fillStyle = `rgba(248, 244, 234, ${k * b * 0.8})`;
      ctx.fillRect(px, py, Math.max(1, s * 0.8 * u), Math.max(1, s * 0.8 * u));
    }

    // The glowing caps along the path, each at its own pace.
    (art.caps || []).forEach(([cx2, cy2, r], i) => {
      const k = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * (0.7 + r * 0.4) + i * 2.1));
      const [px, py] = P(cx2, cy2);
      glow(px, py, 7 * s * r * u, [[0, `rgba(122, 228, 255, ${0.35 * k})`], [1, "rgba(122,228,255,0)"]]);
    });

    // Embers rising off the fire.
    if (art.fire) {
      for (const e of embers) {
        const k = (time * e.sp + e.t) % 1;
        const [px, py] = P(art.fire[0] + e.off * k * u, art.fire[1] - (4 + k * 56) * u);
        ctx.fillStyle = `rgba(255, ${Math.round(170 + 60 * (1 - k))}, 80, ${(1 - k) * 0.8})`;
        ctx.fillRect(px, py, Math.max(1, s * u), Math.max(1, s * u));
      }
    }
    ctx.globalCompositeOperation = "source-over";

    // On the story title, motes of dust and pollen drift in the morning light, soft and round; on the night one,
    // fireflies in the grass, the one thing there that is alive.
    for (const f of flies) {
      const x = (f.x + Math.sin(time * f.sp + f.ph) * 0.05) * W;
      const k = 0.25 + 0.75 * Math.max(0, Math.sin(time * 1.7 + f.ph));
      if (art.motes) {
        const yf = (((f.y - 0.55) / 0.45) * 0.8 + 0.12 - ((time * f.sp * 0.03) % 1) + 1) % 1; // rising, fading at the edges
        const a = k * 0.55 * Math.sin(Math.PI * yf);
        glow(x, yf * H, Math.max(1.5, s * f.r * u * 1.4), [[0, `rgba(255, 240, 200, ${a})`], [1, "rgba(255,240,200,0)"]]);
        continue;
      }
      const y = (f.y + Math.cos(time * f.sp * 0.8 + f.ph) * 0.035) * H;
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
  root.querySelector("[data-camp2]").onclick = go(onCamp2);
  root.querySelector("[data-help]").onclick = go(onHelp);
  root.querySelector("[data-settings]").onclick = go(onSettings); // (UI review P06: the settings from the hill)
  const beginBtn = root.querySelector("[data-begin]");
  if (beginBtn) {
    // (Begin and the hill are one tap: a second within the bell's 620 ms began the day twice; after it main.js's loading card
    // guards, and a load cancelled there leaves the hill to begin from again)
    let going = false;
    const begin = (e) => {
      e?.stopPropagation();
      if (going) return;
      going = true;
      unlock();
      sfx.bellSmall(); // (a small bell to set out; the fight's own bell is the big one)
      const t = root.querySelector(".title");
      t.classList.add("is-going");
      setTimeout(() => ((going = false), t.classList.remove("is-going"), onBegin()), 620);
    };
    beginBtn.onclick = begin;
    root.querySelector(".title-canvas").onclick = begin;
  }
  // Practice opens the choice over the hill; a tap outside it closes it again, and never falls
  // through to the hill itself, which would begin the day's scored fight.
  const pick = root.querySelector("[data-pick]");
  const openPick = (open) => (pick.hidden = !open);
  // (the big "Practise a fight" button, always there; the round one beside Camp opened the same list and went — the owner,
  // 2026-10-18, UI review P03: "the blue practice button can be removed")
  for (const el of root.querySelectorAll("[data-practice]")) el.onclick = go(() => openPick(true));
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
