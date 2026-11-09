// Written by tools/publish-site.mjs: start the game only once the page is the live release.
(function () {
  var R = "052f365-86c048e2";
  // (main.js names the release in the addresses of the arena data, sounds and models the 3D view fetches itself)
  window.__TB_RELEASE = R;
  // (and the 3D view's modules, for main.js to ask for side by side: release.js MODS3D)
  window.__TB_MODS3D = ["js/load3d-73w4qe3v.js","js/render3d-xx87sy3g.js","js/main-6mhe1mqq.js","js/main-da0vcgq8.js","js/main-m1k21n9f.js","js/main-k6xx22ms.js","js/main-74g1a3n8.js","js/main-4ypth4gv.js","js/main-87k41mf6.js","js/main-8mbq885r.js","js/gltf-hy8wrs0p.js","js/main-bhq6drgn.js","js/main-yh6b0k6j.js","js/paint3d-48h2rvav.js","js/boss-profiles-ny6g9683.js","js/camp3d-1pxp3v4p.js","js/backdrop3d-rj0h0nxq.js","js/bosses-b12f7b88.js","js/three-lib-fgk75wn7.js"].map(function (m) { return m + "?v=" + R; });
  function go() { var s = document.createElement("script"); s.type = "module"; s.src = "js/main.js?v=" + R; document.body.appendChild(s); }
  fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (v) {
    if (v && v.release && v.release !== R) {
      var u = new URL(location.href);
      if (u.searchParams.get("r") !== v.release) { u.searchParams.set("r", v.release); location.replace(u.href); return; }
    }
    go();
  }).catch(go);
})();
