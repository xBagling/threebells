// Written by tools/publish-site.mjs: start the game only once the page is the live release.
(function () {
  var R = "bf1d10c-62b06777";
  // (main.js names the release in the addresses of the arena data, sounds and models the 3D view fetches itself)
  window.__TB_RELEASE = R;
  // (and the 3D view's modules, for main.js to ask for side by side: release.js MODS3D)
  window.__TB_MODS3D = ["js/load3d-wc6besm4.js","js/render3d-xts8kb1b.js","js/main-6mhe1mqq.js","js/main-akbhw2fy.js","js/main-zy899q2b.js","js/main-njyf0m5m.js","js/main-74g1a3n8.js","js/main-ybx00bvq.js","js/main-zjv566fx.js","js/main-8mbq885r.js","js/gltf-qv4jc8dc.js","js/main-t8n6e5mf.js","js/main-3vr08xr3.js","js/paint3d-svjc2gav.js","js/boss-profiles-n6f72qce.js","js/bosses-04v7w43j.js","js/backdrop3d-yh93cp7x.js","js/camp3d-r7n72ntc.js","js/three-lib-fgk75wn7.js"].map(function (m) { return m + "?v=" + R; });
  function go() { var s = document.createElement("script"); s.type = "module"; s.src = "js/main.js?v=" + R; document.body.appendChild(s); }
  fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (v) {
    if (v && v.release && v.release !== R) {
      var u = new URL(location.href);
      if (u.searchParams.get("r") !== v.release) { u.searchParams.set("r", v.release); location.replace(u.href); return; }
    }
    go();
  }).catch(go);
})();
