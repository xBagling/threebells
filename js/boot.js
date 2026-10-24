// Written by tools/publish-site.mjs: start the game only once the page is the live release.
(function () {
  var R = "48fd128-df87a96f";
  // (main.js names the release in the addresses of the arena data, sounds and models the 3D view fetches itself)
  window.__TB_RELEASE = R;
  function go() { var s = document.createElement("script"); s.type = "module"; s.src = "js/main.js?v=" + R; document.body.appendChild(s); }
  fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (v) {
    if (v && v.release && v.release !== R) {
      var u = new URL(location.href);
      if (u.searchParams.get("r") !== v.release) { u.searchParams.set("r", v.release); location.replace(u.href); return; }
    }
    go();
  }).catch(go);
})();
