const out = document.getElementById("out");
const ONLY = new URLSearchParams(location.search).get("only");
const err = document.getElementById("err");
const scaleFor = (w) => (w > 90 ? 3 : w > 48 ? 4 : 6);
function show(title, items) {
  if (ONLY && !title.includes(ONLY)) return;
  const h = document.createElement("h2");
  h.textContent = title;
  const row = document.createElement("div");
  row.className = "row";
  for (const [name, spr] of items) {
    const list = Array.isArray(spr) ? spr : [spr];
    list.forEach((s, i) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      const k = scaleFor(s.w);
      const cv = document.createElement("canvas");
      cv.width = s.w * k;
      cv.height = s.h * k;
      const cx = cv.getContext("2d");
      cx.imageSmoothingEnabled = false;
      cx.drawImage(s.cv, 0, 0, cv.width, cv.height);
      cell.append(cv);
      const lab = document.createElement("span");
      lab.textContent = list.length > 1 ? `${name} ${i}` : name;
      cell.append(lab);
      row.append(cell);
    });
  }
  out.append(h, row);
}
window.__show = show;
for (const [mod, fn, label] of [
  ["./gfx/art/fx.js", "buildFx", "fx"],
  ["./gfx/art/arena.js", "buildArenas", "arenas"],
  ["./gfx/art/icons.js", "buildIcons", "icons"],
  ["./gfx/art/adds.js", "buildAdds", "adds"],
  ["./gfx/art/decor.js", "buildDecor", "decor"],
  ["./gfx/art/title.js", "buildTitle", "title"],
]) {
  try {
    if (ONLY && !label.includes(ONLY)) continue;
    const m = await import(mod);
    if (!m[fn]) continue;
    let built = m[fn]();
    if (built.img) built = { scene: { title: built.img } };
    for (const [group, set] of Object.entries(built)) show(`${label} · ${group}`, Object.entries(set));
  } catch (e) {
    if (!String(e).includes("Failed to fetch")) err.textContent += label + ": " + (e.stack || e) + "\n";
  }
}
