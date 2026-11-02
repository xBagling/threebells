// Written by tools/publish-site.mjs: start the game only once the page is the live release.
(function () {
  var R = "86060bd-fe114eac";
  // (main.js names the release in the addresses of the arena data, sounds and models the 3D view fetches itself)
  window.__TB_RELEASE = R;
  // (and the 3D view's modules, for main.js to ask for side by side: release.js MODS3D)
  window.__TB_MODS3D = ["js/load3d-xe7r2qnn.js","js/render3d-fwskbzhs.js","js/main-6mhe1mqq.js","js/main-g90df43y.js","js/main-cqacbqc4.js","js/main-rbjqmxbv.js","js/main-74g1a3n8.js","js/main-ybx00bvq.js","js/main-3tm083bp.js","js/main-jv075w3r.js","js/gltf-qv4jc8dc.js","js/main-d9sttapv.js","js/main-3vr08xr3.js","js/paint3d-4qgrvjyr.js","js/boss-profiles-p019r9js.js","js/bosses-6zhbvbc2.js","js/backdrop3d-7f1yr037.js","js/camp3d-h8n5j04r.js","js/three-lib-fgk75wn7.js"].map(function (m) { return m + "?v=" + R; });
  function go() { var s = document.createElement("script"); s.type = "module"; s.src = "js/main.js?v=" + R; document.body.appendChild(s); }
  fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (v) {
    if (v && v.release && v.release !== R) {
      var u = new URL(location.href);
      if (u.searchParams.get("r") !== v.release) { u.searchParams.set("r", v.release); location.replace(u.href); return; }
    }
    go();
  }).catch(go);
})();
