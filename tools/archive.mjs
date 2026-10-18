// An archive of Dress Up's pictures, for one day: every background with the
// friend hidden and with the default friend; every option of every chip menu
// (each against the defaults: colors and sliders are left alone; a menu
// repeated for each castle, room, cat or horse taken once, for the first);
// and moves the defaults never show (ticket 183): the friend climbing each
// place's ladder, low, halfway and near the top (the climb set by hand, as
// the controller sets it, so the hands are where that height puts them).
// Each distinct drawing is three files, <folder>/<setting key>--<value>:
// .png (1920 wide), .svg (the drawing, animations and all) and .json (the
// settings, in the game's own save format: Load opens it). A repeat of a
// drawing points at its first; an option that draws nothing different under
// the defaults is noted. With an index and a manifest.
// A file the same, byte for byte, as the same file on the latest earlier day
// in the archive is a relative symlink to that day's (real) file, so a day
// costs only what changed; the day's page links to the real file itself.
// (Dress Up ticket 262, Matthew: "do the pictures in each scene, with and without 'what its made of' on. And with and
// without collision boxes on. So 3x the pictures in total") Each background, with and without the friend, twice more:
// with 🔬 🧩 what it is made of, and with 🔬 🧱 the collision boxes (folders <folder>-made-of, <folder>-collision-boxes):
// the picture with the game's own overlay drawn over it, its look (colours, lines) as the page's stylesheet gives it.
// ("use a localized timestamp ... in case we did that already today (and in general, for multiple runs per day)") A
// day's first run is its folder, YYYY/MM/DD; a later run that day is YYYY/MM/DD/HH-MM, in Matthew's time (Mountain);
// the run before is whichever is latest, a day or a run within one.
//   node archive.mjs <devtools port> <page url> <out dir: <archive>/YYYY/MM/DD[/HH-MM]> [music archive url]
import { writeFileSync, mkdirSync, rmSync, renameSync, existsSync, readFileSync, readdirSync, symlinkSync, realpathSync, unlinkSync } from "node:fs";
import { join, relative, dirname } from "node:path";
const [dport, url, finalDir, musicUrl] = process.argv.slice(2), outDir = finalDir + ".new";
rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const page = (await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json()).find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map(), errs = [];
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errs.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300)); });
const send = (method, params = {}) => new Promise(res => { const i = ++n; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "about:blank" }); await sleep(300);
await send("Page.navigate", { url }); await sleep(4000);
// 1. the list of pictures to take, from the page's own menus
const plan = (await send("Runtime.evaluate", { returnByValue: true, expression: `(() => {
  const slug = s => s.replace(/[^A-Za-z0-9]+/g, " ").trim().toLowerCase().replace(/ +/g, "-");
  const txt = (t, b) => typeof t === "function" ? t(b) : t;
  const shots = [];
  for (const [kind, label] of PLACES) {
    if (kind === "none") continue;
    if (kind === "castleroom") { for (const [st, sl] of CASTLE_ROOM_CHOICES) for (const friend of [false, true])
      shots.push({ folder: friend ? "backgrounds-with-friend" : "backgrounds", name: "castleroom--" + st, label: label + ": " + sl, bg: { kind: "castleroom", castle: "N", castleRoomsN: 6, castleRoom6N: st, castleRoom: 6 }, friend }); continue; }
    for (const friend of [false, true]) shots.push({ folder: friend ? "backgrounds-with-friend" : "backgrounds", name: kind, label, bg: { kind }, friend });
  }
  const walk = (rows, part, folder, tabLabel, group) => { for (const row of rows) {
    const [kind, key, label] = row;
    if (kind === "group") { walk(row[3], part, folder, tabLabel, label); continue; }
    if (part === "music" || part === "visible") continue;
    // (a menu repeated per castle, room, cat or horse: only castle N's, the first one's)
    if (/[MD]$/.test(key) && /^castle/.test(key) || (key.match(/[0-9]+/g) || []).some(d => +d >= 2)) continue;
    const opts = kind === "choice" ? row[3].map(o => [o[0], txt(o[1], DEFAULTS[part])]) : kind === "toggle" ? [[true, "on"], [false, "off"]] : kind === "flip" ? [[true, row[2][1]], [false, row[2][0]]] : null;
    if (!opts) continue;
    for (const [v, text] of opts) shots.push({ folder, name: key + "--" + slug(String(v)), label: (group ? group + " / " : "") + (kind === "flip" ? "" : label + ": ") + text, part, key, value: v, kindOf: kind, tab: tabLabel });
  } };
  for (const [tabLabel, part, rows] of TABS) {
    const folder = part === "background" ? "background-menus" : slug(tabLabel) || part;
    // (each tab's folder opens with the friend at the defaults: what its "same as default" means)
    if (part !== "background" && part !== "music" && part !== "visible") shots.push({ folder, name: "_default", label: "everything at its default", defaultOf: part, tab: tabLabel });
    walk(rows, part, folder, tabLabel, null);
  }
  return shots;
})()` })).result.result.value;
// (moves: the places with a ladder, the friend there at the defaults; each
// climbed at three heights. A game without climbs by hand has none.)
const ladderPlaces = (await send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
  if (typeof startClimb !== "function" || typeof bgShown === "undefined") return [];
  const out = [];
  for (const s of ${JSON.stringify(plan.filter(s => s.folder === "backgrounds-with-friend"))}) {
    for (const [p, v] of Object.entries(DEFAULTS)) if (state[p] && typeof v === "object") { for (const key of Object.keys(state[p])) delete state[p][key]; Object.assign(state[p], structuredClone(v)); }
    state.music.mute = true; Object.assign(state.background, s.bg); changed(); await new Promise(r => setTimeout(r, 60));
    if (bgShown.node && bgShown.node.querySelector("[data-ladder]")) out.push(s);
  }
  return out;
})()` })).result.result.value || [];
for (const s of ladderPlaces) for (const [at, word] of [[0.25, "low"], [0.5, "halfway"], [0.8, "near the top"]])
  plan.push({ folder: "moves", name: `climb--${s.name}--${Math.round(at * 100)}`, label: `${s.label}: 🧗 climbing its ladder, ${word}`, bg: s.bg, friend: true, move: { at } });
// (ticket 262) each background twice more, with an overlay of 🔬's on
const OVERLAYS = [["made", "made-of", "🔬 🧩 what it is made of"], ["boxes", "collision-boxes", "🔬 🧱 collision boxes"]];
for (const s of plan.filter(s => s.folder === "backgrounds" || s.folder === "backgrounds-with-friend"))
  for (const [overlay, suffix, word] of OVERLAYS) plan.push({ ...s, folder: s.folder + "-" + suffix, label: s.label + ": " + word, overlay });
console.log(plan.length, "pictures planned,", ladderPlaces.length, "places with a ladder");
// 2. take them, a batch at a time
const out = [];
for (let i = 0; i < plan.length; i += 20) {
  const batch = plan.slice(i, i + 20);
  const r = await send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const tick = () => new Promise(r => setTimeout(r, 60)), res = [];
    const h = s => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(16); };
    const reset = () => { for (const [p, v] of Object.entries(DEFAULTS)) if (state[p] && typeof v === "object") { for (const key of Object.keys(state[p])) delete state[p][key]; Object.assign(state[p], structuredClone(v)); }
      state.music.mute = true; };   // (the scene's LFO choices at the game's own defaults: a still leaves out their animations)
    const pic = document.getElementById("pic");
    const svgOf = () => { const c = pic.cloneNode(true), vb = pic.viewBox.baseVal; c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      c.setAttribute("width", Math.round(vb.width)); c.setAttribute("height", Math.round(vb.height)); c.removeAttribute("style"); c.removeAttribute("class");
      return '<?xml version="1.0" encoding="UTF-8"?>\\n' + new XMLSerializer().serializeToString(c); };
    const snap = async () => { const c = pic.cloneNode(true), vb = pic.viewBox.baseVal, w = 1920, hh = Math.round(1920 * vb.height / vb.width);
      c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); c.setAttribute("width", w); c.setAttribute("height", hh); c.removeAttribute("style"); c.removeAttribute("class");
      for (const a of c.querySelectorAll("animate,animateTransform,animateMotion")) a.remove();
      const img = new Image(); img.src = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml" })); await img.decode();
      const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; cv.getContext("2d").drawImage(img, 0, 0); return cv.toDataURL("image/png").split(",")[1]; };
    // (ticket 262: the picture with 🔬's overlay over it: #access-layer's drawings, each with its look from the page's
    // stylesheet written into it, over the picture at its size on the screen; 1920 wide)
    const LOOK = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
                  "opacity", "font-family", "font-size", "font-weight", "paint-order", "display", "visibility", "text-anchor", "dominant-baseline"];
    const overlayParts = () => { const L = document.getElementById("access-layer"), pr = pic.getBoundingClientRect(), outp = [];
      for (const o of L.querySelectorAll(":scope > svg")) { const r = o.getBoundingClientRect(), c = o.cloneNode(true);
        const a = [o, ...o.querySelectorAll("*")], b = [c, ...c.querySelectorAll("*")];
        a.forEach((el, i) => { const cs = getComputedStyle(el); b[i].setAttribute("style", LOOK.map(p => p + ":" + cs.getPropertyValue(p)).join(";")); b[i].removeAttribute("class"); });
        for (const x of c.querySelectorAll("animate,animateTransform,animateMotion,set")) x.remove();
        c.setAttribute("x", (r.left - pr.left).toFixed(1)); c.setAttribute("y", (r.top - pr.top).toFixed(1)); c.setAttribute("width", r.width.toFixed(1)); c.setAttribute("height", r.height.toFixed(1));
        if (!c.getAttribute("viewBox")) c.setAttribute("viewBox", "0 0 " + r.width.toFixed(1) + " " + r.height.toFixed(1));
        c.style.overflow = "hidden"; outp.push(new XMLSerializer().serializeToString(c)); }
      const leg = L.querySelector(".made-legend"); return { svgs: outp, legend: leg ? leg.textContent : "" }; };
    const overlaySvg = () => { const pr = pic.getBoundingClientRect(), c = pic.cloneNode(true);
      for (const a of c.querySelectorAll("animate,animateTransform,animateMotion")) a.remove();
      c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); c.setAttribute("x", 0); c.setAttribute("y", 0); c.setAttribute("width", pr.width.toFixed(1)); c.setAttribute("height", pr.height.toFixed(1));
      c.removeAttribute("style"); c.removeAttribute("class"); c.removeAttribute("id");
      const w = 1920, hh = Math.round(1920 * pr.height / pr.width);
      return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + hh + '" viewBox="0 0 ' + pr.width.toFixed(1) + " " + pr.height.toFixed(1) + '">' +
        new XMLSerializer().serializeToString(c) + overlayParts().svgs.join("") + "</svg>"; };
    const overlaySnap = async svg => { const m = /width="(\d+)" height="(\d+)"/.exec(svg.slice(0, 400)), w = +m[1], hh = +m[2];
      const img = new Image(); img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); await img.decode();
      const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; cv.getContext("2d").drawImage(img, 0, 0); return cv.toDataURL("image/png").split(",")[1]; };
    // (a still picture's markup: what an option draws is judged without the animations, which a
    // still cannot show, so an LFO's or a blink's choice draws nothing different)
    const markup = () => { const c = pic.cloneNode(true); for (const a of c.querySelectorAll("animate,animateTransform,animateMotion,set,style")) a.remove();
      return c.innerHTML.replace(/ begin="[^"]*"/g, "").replace(/animation:[^;"]*;?/g, ""); };
    // (a menu hidden under the defaults: the one setting of its own tab that shows it, if there is
    // one, chosen first: the nose's side shape with the nose set to a side view)
    const rowsOf = part => { const out = []; const walk = rows => { for (const r of rows) {
        if (r[0] === "group") walk(r[3]);
        else if (r[0] === "choice") out.push([r[1], r[2], r[3].map(o => [o[0], typeof o[1] === "function" ? o[1](DEFAULTS[part]) : o[1]])]);
        else if (r[0] === "toggle") out.push([r[1], r[2], [[true, "on"], [false, "off"]]]);
        else if (r[0] === "flip") out.push([r[1], "", [[true, r[2][1]], [false, r[2][0]]]]);
        else if (r[0] === "range") out.push([r[1], r[2], [[r[6], String(r[6])], [r[4], String(r[4])]]]); } };
      for (const [, p, rows] of TABS) if (p === part) walk(rows); return out; };
    const contextFor = (part, key) => { const rule = SHOWN_WHEN[part + "." + key]; if (!rule) return null; const P = state[part];
      let ok; try { ok = rule(P); } catch (_) { ok = true; } if (ok) return null;
      for (const [k2, label2, opts] of rowsOf(part)) { if (k2 === key) continue; const old = P[k2];
        for (const [v2, t2] of opts) { P[k2] = v2; let r = false; try { r = rule(P); } catch (_) {}
          if (r) { P[k2] = old; return { key: k2, value: v2, label: (label2 ? label2 + ": " : "") + t2 }; } }
        P[k2] = old; }
      return "none"; };
    // (a background menu: in the first place where it shows)
    const placeFor = key => { const f = SHOWN_WHEN["background." + key]; if (!f) return null;
      for (const [kind] of PLACES) { const b = { ...structuredClone(DEFAULTS.background), kind }; try { if (f(b)) return { kind }; } catch (_) {} }
      // (shown nowhere under the defaults: a place, and one setting of the background's that brings it out there)
      const rows = rowsOf("background");
      for (const [kind] of PLACES) for (const [k2, label2, opts] of rows) { if (k2 === key) continue;
        for (const [v2, t2] of opts) { const b = { ...structuredClone(DEFAULTS.background), kind, [k2]: v2 }; let r = false; try { r = f(b); } catch (_) {}
          if (r) return { kind, ctx: { key: k2, value: v2, label: (label2 ? label2 + ": " : "") + t2 } }; } }
      return null; };
    for (const s of ${JSON.stringify(batch)}) {
      reset();
      // (ticket 262: a background with an overlay of 🔬's on)
      if (s.overlay) {
        Object.assign(state.background, s.bg); for (const g of VISIBLE_PARTS) state.visible[g] = s.friend ? 100 : 0;
        Object.assign(state.access, s.overlay === "made" ? { showMadeOf: true } : { showSolids: true });
        changed(); await tick(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        madeShown = ""; solidsShown = ""; madeOfHud(); solidsHud(); await tick();
        const svg = overlaySvg(), ov = overlayParts();
        res.push({ ...s, label: s.label + (ov.legend ? " (" + ov.legend + ")" : ""), hash: h(markup() + "|" + s.overlay + "|" + ov.svgs.join("")), baseHash: null, same: false,
                   png: await overlaySnap(svg), svg, settings: JSON.stringify({ app: "dress-up", version: 1, saved: new Date().toISOString(), state }, null, 2) });
        reset(); changed();
        continue;
      }
      // (a move: up the ladder nearest where the friend stands, by hand to its height)
      if (s.move) {
        Object.assign(state.background, s.bg); for (const g of VISIBLE_PARTS) state.visible[g] = 100;
        state.body.anim = "climbup"; state.body.facing = "back"; climb = null; climbAnywhere = true;
        changed(); await tick(); if (!climb) startClimb();
        if (!climb || climb.none) { res.push({ ...s, hash: "", same: false, hidden: true, png: null, svg: null, settings: null }); climb = null; continue; }
        climb.manual = true; climb.got = 0; changed(); await tick();
        climb.got = s.move.at * (climb.all || 0); changed(); await tick();
        const m = markup();
        res.push({ ...s, hash: h(m), baseHash: null, same: false, png: await snap(), svg: svgOf(),
                   settings: JSON.stringify({ app: "dress-up", version: 1, saved: new Date().toISOString(), state }, null, 2) });
        climb = null; reset(); changed();
        continue;
      }
      if (s.defaultOf) { state.background.kind = "none"; changed(); await tick(); const m0 = markup();
        res.push({ ...s, hash: h(m0), same: false, png: await snap(), svg: svgOf(), settings: JSON.stringify({ app: "dress-up", version: 1, saved: new Date().toISOString(), state }, null, 2) }); continue; }
      if (s.bg) { Object.assign(state.background, s.bg); for (const g of VISIBLE_PARTS) state.visible[g] = s.friend ? 100 : 0; }
      else if (s.part === "background") {
        const at = placeFor(s.key);
        // (a menu that shows nowhere, even with one more setting chosen: noted, no picture)
        if (!at) { res.push({ ...s, hash: "", same: false, hidden: true, png: null, svg: null, settings: null }); continue; }
        state.background.kind = at.kind; for (const g of VISIBLE_PARTS) state.visible[g] = 0;
        if (at.ctx) { state.background[at.ctx.key] = at.ctx.value; s.label += " (with " + at.ctx.label + ")"; }
      }
      else state.background.kind = "none";
      let ctx = null;
      if (s.part && s.part !== "background") { ctx = contextFor(s.part, s.key);
        if (ctx === "none") { res.push({ ...s, hash: "", same: false, hidden: true, png: null, svg: null, settings: null }); continue; }
        if (ctx) state[s.part][ctx.key] = ctx.value; }
      changed(); await tick();
      let before = s.part ? markup() : null;
      if (ctx) s.label += " (with " + ctx.label + ")";
      if (s.part) { state[s.part][s.key] = s.value; changed(); await tick(); }
      let m = markup(), same = before !== null && before === m;
      // (the same as the defaults: try one more setting of its tab, under which it shows: spiky teeth with the mouth open)
      if (same && s.part && s.part !== "background" && !ctx) {
        const P = state[s.part];
        search: for (const [k2, label2, opts] of rowsOf(s.part)) { if (k2 === s.key) continue; const old2 = P[k2];
          for (const [v2, t2] of opts) { if (v2 === old2) continue;
            P[k2] = v2; P[s.key] = DEFAULTS[s.part][s.key]; changed(); const b2 = markup();
            P[s.key] = s.value; changed(); const a2 = markup();
            if (a2 !== b2) { before = b2; m = a2; same = false; s.label += " (with " + (label2 ? label2 + ": " : "") + t2 + ")"; break search; } }
          P[k2] = old2; }
        if (same) { P[s.key] = s.value; changed(); }
        await tick();
      }
      res.push({ ...s, hash: h(m), baseHash: before !== null ? h(before) : null, same, png: same ? null : await snap(), svg: same ? null : svgOf(),
                 settings: same ? null : JSON.stringify({ app: "dress-up", version: 1, saved: new Date().toISOString(), state }, null, 2) });
    }
    return res;
  })()` });
  if (r.result.exceptionDetails) { console.log("EXC", JSON.stringify(r.result.exceptionDetails).slice(0, 500)); process.exit(1); }
  out.push(...r.result.result.value);
  process.stdout.write(".");
}
// 3. files, a manifest, an index
// (the latest earlier day in the archive, to link unchanged files to)
// (the archive's root: above YYYY/MM/DD, and HH-MM when this is a later run that day)
const root = join(finalDir, ...Array(/[\/][0-9]{2}-[0-9]{2}\/?$/.test(finalDir) ? 4 : 3).fill("..")), day = relative(root, finalDir);
let lastDay = null;
const runOk = k => existsSync(join(root, k, "manifest.json"));
for (const y of readdirSync(root).filter(d => /^[0-9]{4}$/.test(d)))
  for (const m of readdirSync(join(root, y)).filter(d => /^[0-9]{2}$/.test(d)))
    for (const d of readdirSync(join(root, y, m)).filter(d => /^[0-9]{2}$/.test(d)))
      for (const k of [`${y}/${m}/${d}`, ...readdirSync(join(root, y, m, d)).filter(t => /^[0-9]{2}-[0-9]{2}$/.test(t)).map(t => `${y}/${m}/${d}/${t}`)])
        if (k < day && runOk(k) && (!lastDay || k > lastDay)) lastDay = k;
const linked = new Map();   // (a file of today's -> the path, from today's folder, of the real file it links to)
const put = (rel, data) => {
  const prev = lastDay && join(root, lastDay, rel);
  if (prev && existsSync(prev) && Buffer.compare(readFileSync(prev), Buffer.isBuffer(data) ? data : Buffer.from(data)) === 0) {
    const real = realpathSync(prev);
    symlinkSync(relative(dirname(join(finalDir, rel)), real), join(outDir, rel));
    linked.set(rel, relative(finalDir, real));
  } else writeFileSync(join(outDir, rel), data);
};
const href = rel => linked.get(rel) || rel;
// (a linked file's run: its day, and its HH-MM within the day when it has one; the path is from this run's folder)
const runOf = rel => { const parts = relative(root, join(finalDir, rel)).split("/"); return parts.slice(0, /^[0-9]{2}-[0-9]{2}$/.test(parts[3]) ? 4 : 3).join("/"); };
const manifest = [], firstOf = new Map();
for (const s of out) {
  let file = null, sameAs = null;
  if (!s.same && !s.hidden) {
    if (firstOf.has(s.hash)) { file = firstOf.get(s.hash); sameAs = file; }
    else { file = `${s.folder}/${s.name}.png`; firstOf.set(s.hash, file); mkdirSync(`${outDir}/${s.folder}`, { recursive: true });
      put(file, Buffer.from(s.png, "base64")); put(`${s.folder}/${s.name}.svg`, s.svg); put(`${s.folder}/${s.name}.json`, s.settings); }
  }
  manifest.push({ folder: s.folder, name: s.name, label: s.label, tab: s.tab || null, key: s.key || null, value: s.value ?? null, hash: s.hash, sameAsDefault: s.same, onlyWithOtherSettings: !!s.hidden,
                  sameAsFile: s.same ? firstOf.get(s.baseHash) || null : null,
                  png: file, svg: file && file.replace(/\.png$/, ".svg"), settings: file && file.replace(/\.png$/, ".json"), sameDrawingAs: sameAs,
                  unchangedSince: file && linked.has(file) ? runOf(linked.get(file)) : null });
}
writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 1));
const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const folders = [...new Set(manifest.map(m => m.folder))];
const nameOf = file => file.replace(/\.png$/, "");
writeFileSync(`${outDir}/index.html`, `<!doctype html><meta charset="utf-8"><title>Dress Up pictures</title>
<style>body{font-family:sans-serif;margin:16px;background:#faf8f3;color:#222} h2{margin:28px 0 8px} .g{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}
figure{margin:0;width:240px} img{width:240px;border:1px solid #ccc;background:#fff} figcaption{font-size:12px} figure.dflt img{border:3px solid #c9a227}
ul.rest{font-size:13px;color:#555;margin:8px 0 0;padding-left:20px} ul.rest li{margin:2px 0} h3{font-size:14px;margin:12px 0 0;color:#555}</style>
<h1>Messed Up Dress Up: every picture at its defaults</h1>
<p>Made ${esc(new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "full", timeStyle: "short" }).format(new Date()))}, Mountain time${/[0-9]{2}-[0-9]{2}$/.test(day) ? " (a later run that day: <a href=\"../index.html\">the day's first</a>)" : ""}.
Each place three ways: as it is, with 🔬 🧩 what it is made of, and with 🔬 🧱 the collision boxes.</p>
<p>${manifest.filter(m => m.png && !m.sameDrawingAs).length} distinct drawings, each a 1920-wide PNG, an SVG and its settings (the game's save format: Load opens it).
Each section opens with its default picture (gold frame). A menu hidden under the defaults is shown "with" the setting that brings it out.
Under each section's pictures: the options that draw nothing different, each with the picture it equals, and the menus that show only once other settings are chosen.</p>` +
  (lastDay ? `<p>A picture unchanged since an earlier day is that day's file (its link says which); the day before this one in the archive: <a href="${relative(finalDir, join(root, lastDay))}/index.html">${lastDay}</a>. <a href="${relative(finalDir, root)}/index.html">Every day</a>.</p>` : `<p><a href="${relative(finalDir, root)}/index.html">Every day</a>.</p>`) +
  (musicUrl ? `<p>🎵 <a href="${musicUrl}">The day's music</a>: every tune, one loop each.</p>` : "") +
  folders.map(f => { const all = manifest.filter(m => m.folder === f), pics = all.filter(m => m.png), same = all.filter(m => m.sameAsDefault), hidden = all.filter(m => m.onlyWithOtherSettings);
    return `<h2>${esc(f)}</h2><div class="g">` + pics.map(m =>
      `<figure${m.name === "_default" ? ' class="dflt"' : ""}><a href="${href(m.png)}"><img loading="lazy" src="${href(m.png)}"></a><figcaption>${esc(m.label)}<br><code>${esc(m.name)}</code> · <a href="${href(m.svg)}">svg</a> · <a href="${href(m.settings)}">settings</a>` +
      `${m.unchangedSince ? ` · <small>unchanged since ${m.unchangedSince}</small>` : ""}` +
      `${m.sameDrawingAs ? ` (the same drawing as <a href="${href(m.sameDrawingAs)}">${esc(nameOf(m.sameDrawingAs))}</a>)` : ""}</figcaption></figure>`).join("") + `</div>` +
      (same.length ? `<h3>Draw nothing different here</h3><ul class="rest">` + same.map(m => `<li>${esc(m.label)} <code>${esc(m.name)}</code>: the same as ${m.sameAsFile ? `<a href="${href(m.sameAsFile)}">${esc(nameOf(m.sameAsFile))}</a>` : "the default"}</li>`).join("") + `</ul>` : "") +
      (hidden.length ? `<h3>Show only once other settings are chosen</h3><ul class="rest">` + hidden.map(m => `<li>${esc(m.label)} <code>${esc(m.name)}</code></li>`).join("") + `</ul>` : ""); }).join(""));
// (the new day's folder in place of the old, all at once)
if (existsSync(finalDir)) renameSync(finalDir, finalDir + ".old");
renameSync(outDir, finalDir); rmSync(finalDir + ".old", { recursive: true, force: true });
console.log("\n" + firstOf.size, "distinct drawings written (png, svg, json),", out.filter(s => !s.same).length - firstOf.size, "repeats pointed at their first,", out.filter(s => s.same).length, "same as default,", out.filter(s => s.hidden).length, "shown only with other settings;", errs.length, "page errors", errs.slice(0, 2).join(" | "));
process.exit(0);
