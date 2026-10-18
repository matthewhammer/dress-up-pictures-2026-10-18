// The front page of a dated archive (dress-up-pictures or dress-up-music):
// every day in it, newest first, each with the game version it recorded
// (from the day's source.json, written by archive-today.sh). Also days.json,
// the same list as data, for pages that show the newest day (the Dress Up
// pages under matthewhammer.org/hazel/dress-up/).
// (Dress Up ticket 262) A day can hold later runs, YYYY/MM/DD/HH-MM, each listed after the day's first; every run with
// when it was made in Matthew's time (Mountain), from its source.json, so two runs a day are told apart.
//   node days_index.mjs <archive root> <title> <intro html>
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [root, title, intro] = process.argv.slice(2);
const days = [];
for (const y of readdirSync(root).filter(d => /^[0-9]{4}$/.test(d)))
  for (const m of readdirSync(join(root, y)).filter(d => /^[0-9]{2}$/.test(d)))
    for (const d of readdirSync(join(root, y, m)).filter(d => /^[0-9]{2}$/.test(d)))
      for (const k of [`${y}/${m}/${d}`, ...readdirSync(join(root, y, m, d)).filter(t => /^[0-9]{2}-[0-9]{2}$/.test(t)).map(t => `${y}/${m}/${d}/${t}`)]) {
        if (!existsSync(join(root, k, "index.html"))) continue;
        const src = existsSync(join(root, k, "source.json")) ? JSON.parse(readFileSync(join(root, k, "source.json"), "utf8")) : {};
        days.push({ k, src });
      }
days.sort((a, b) => b.k.localeCompare(a.k));
// (when a run was made, in Mountain time: "Sat, Oct 17, 2026, 10:58 PM MDT")
const when = src => { const t = src.made_at && new Date(src.made_at); return t && !isNaN(t) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(t) : null; };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
writeFileSync(join(root, "index.html"), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;margin:16px;max-width:820px;background:#faf8f3;color:#222} li{margin:8px 0} small{color:#777}</style>
<h1>${esc(title)}</h1><p>${intro}</p><ul>` +
  days.map(({ k, src }) => `<li><a href="${k}/index.html">${k}</a>` + (when(src) ? ` <small>· made ${esc(when(src))}</small>` : "") + (src.version ? ` <small>· Messed Up Dress Up ${esc(src.version)}` +
    (src.commit ? ` (<a href="https://github.com/matthewhammer/kids-choice-games/commit/${esc(src.commit)}">${esc(src.commit.slice(0, 7))}</a>)` : "") + `</small>` : "") + `</li>`).join("") +
  `</ul>`);
writeFileSync(join(root, "days.json"), JSON.stringify(days.map(({ k, src }) => ({ day: k, when: when(src), version: src.version ?? null, commit: src.commit ?? null, made_at: src.made_at ?? null })), null, 1) + "\n");
console.log(days.length, "days listed in", join(root, "index.html"));
