#!/usr/bin/env node
// aurea-studio driver — the part of the Stitch workflow that runs OUTSIDE the model.
//
// The Stitch MCP tools (create_project, generate_screen_from_text, list_screens, ...)
// can only be called by the agent. But everything *after* generation — pulling the
// HTML/CSS assets and rendering previews — is plain HTTP + a headless browser, and
// costs ZERO LLM tokens. That is what this script does.
//
// Typical flow:
//   1. Agent calls mcp__stitch__list_screens and saves the JSON to a file, e.g. screens.json
//   2. node driver.mjs pull screens.json ./out/<project-name>
//        -> downloads every htmlCode.downloadUrl + screenshot.downloadUrl
//        -> renders each .html to a full-page PNG with headless Chrome
//        -> writes manifest.json + a gallery index.html
//   3. Agent opens out/<project-name>/index.html (or the per-screen PNGs) to show the user.
//
// No npm install. Node >= 18 (global fetch). Uses google-chrome-stable / chromium if present.
//
// Commands:
//   node driver.mjs check
//   node driver.mjs pull <screens.json> [outdir]      (download + render + gallery)
//   node driver.mjs render <outdir>                    (re-render previews for *.html)
//   node driver.mjs gallery <outdir>                   (rebuild index.html from manifest)
//   node driver.mjs projects <projects.json>           (summarize a huge list_projects dump)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, basename } from "node:path";

const CHROME_CANDIDATES = [
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
];

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    const r = spawnSync("which", [c], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return c;
  }
  return null;
}

function slug(s, max = 48) {
  return (s || "screen")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "screen";
}

function extFor(mime) {
  if (!mime) return "bin";
  if (mime.includes("html")) return "html";
  if (mime.includes("markdown")) return "md";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "bin";
}

// Accepts the raw list_screens result in several shapes and returns screens[].
function parseScreens(raw) {
  let data = raw;
  if (typeof raw === "string") data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (data.screens) return data.screens;
  // Some harnesses wrap MCP results in {result:{...}} or {content:[{text}]}
  if (data.result) return parseScreens(data.result);
  return [];
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 80)}...`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

function renderHtml(chrome, htmlPath, pngPath, width, height) {
  const w = Math.min(Math.max(parseInt(width) || 1440, 360), 2560);
  // Stitch screens can be very tall (full landing pages). Old headless captures
  // exactly window-size, so pass the real height (capped) to get the full page.
  const h = Math.min(Math.max(parseInt(height) || 2200, 600), 12000);
  const args = [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${w},${h}`,
    `--screenshot=${pngPath}`,
    `file://${resolve(htmlPath)}`,
  ];
  const r = spawnSync(chrome, args, { encoding: "utf8", timeout: 120000 });
  // dbus / GPU warnings on stderr are harmless; only fail if no file produced.
  return existsSync(pngPath);
}

function buildGallery(outdir, manifest) {
  const cards = manifest
    .map((m) => {
      const img = m.files.preview || m.files.screenshot;
      const imgTag = img
        ? `<img loading="lazy" src="./${basename(img)}" alt="${m.title}">`
        : `<div class="noimg">no preview</div>`;
      const open = m.files.html
        ? `<a href="./${basename(m.files.html)}" target="_blank">open html ↗</a>`
        : "";
      return `<figure>
  ${imgTag}
  <figcaption>
    <strong>${m.title}</strong>
    <span>${m.deviceType || ""} ${m.dimensions || ""}</span>
    ${open}
  </figcaption>
</figure>`;
    })
    .join("\n");
  const html = `<!doctype html><html><head><meta charset="utf8">
<title>aurea-studio · preview</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;background:#f5f3ee;color:#2b2b2b;margin:0;padding:32px}
  h1{font-weight:600;letter-spacing:-.02em}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px;margin-top:24px}
  figure{margin:0;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  figure img{width:100%;display:block;border-bottom:1px solid #eee}
  .noimg{height:200px;display:grid;place-items:center;color:#aaa}
  figcaption{padding:12px 16px;display:flex;flex-direction:column;gap:4px}
  figcaption span{color:#888;font-size:12px}
  figcaption a{color:#9a6a3c;font-size:13px;text-decoration:none}
</style></head>
<body><h1>aurea-studio · ${manifest.length} screen(s)</h1>
<div class="grid">${cards}</div></body></html>`;
  writeFileSync(join(outdir, "index.html"), html);
}

async function cmdPull(screensFile, outdir) {
  if (!screensFile) throw new Error("usage: pull <screens.json> [outdir]");
  outdir = resolve(outdir || "./stitch-output");
  mkdirSync(outdir, { recursive: true });
  const screens = parseScreens(readFileSync(screensFile, "utf8"));
  if (!screens.length) {
    console.log("No screens found in JSON. Still generating? Re-run list_screens later.");
    return;
  }
  const chrome = findChrome();
  if (!chrome) console.log("⚠ no Chrome found — will download assets but skip PNG previews.");

  const manifest = [];
  const seen = new Set();
  for (const s of screens) {
    const screenId = (s.name || "").split("/").pop() || Math.random().toString(36).slice(2, 8);
    let base = slug(s.title);
    if (seen.has(base)) base = `${base}-${screenId.slice(0, 6)}`;
    seen.add(base);
    const files = {};
    const dims = s.width && s.height ? `${s.width}×${s.height}` : "";

    // 1. HTML / md / svg asset
    if (s.htmlCode?.downloadUrl) {
      const ext = extFor(s.htmlCode.mimeType);
      const dest = join(outdir, `${base}.${ext}`);
      try {
        const n = await download(s.htmlCode.downloadUrl, dest);
        files[ext === "html" ? "html" : ext] = dest;
        console.log(`✓ ${base}.${ext} (${(n / 1024).toFixed(0)} KB)`);
      } catch (e) {
        console.log(`✗ ${base}.${ext}: ${e.message}`);
      }
    }

    // 2. Stitch's own screenshot (PNG from googleusercontent)
    if (s.screenshot?.downloadUrl) {
      const dest = join(outdir, `${base}-screenshot.png`);
      try {
        await download(s.screenshot.downloadUrl, dest);
        files.screenshot = dest;
      } catch (e) {
        console.log(`  (screenshot failed: ${e.message})`);
      }
    }

    // 3. Our own full-page render of the HTML
    if (files.html && chrome) {
      const png = join(outdir, `${base}.preview.png`);
      if (renderHtml(chrome, files.html, png, s.width, s.height)) {
        files.preview = png;
        console.log(`  rendered ${base}.preview.png`);
      }
    }

    manifest.push({
      title: s.title || base,
      screenName: s.name,
      deviceType: s.deviceType,
      dimensions: dims,
      files,
    });
  }

  writeFileSync(join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));
  buildGallery(outdir, manifest);
  console.log(`\n→ ${manifest.length} screen(s) in ${outdir}`);
  console.log(`→ gallery: ${join(outdir, "index.html")}`);
}

function cmdRender(outdir) {
  outdir = resolve(outdir);
  const chrome = findChrome();
  if (!chrome) throw new Error("no Chrome binary found");
  const htmls = readdirSync(outdir).filter((f) => f.endsWith(".html") && f !== "index.html");
  for (const f of htmls) {
    const png = join(outdir, f.replace(/\.html$/, ".preview.png"));
    const ok = renderHtml(chrome, join(outdir, f), png, 1440, 6000);
    console.log(`${ok ? "✓" : "✗"} ${f} -> ${basename(png)}`);
  }
}

function cmdGallery(outdir) {
  outdir = resolve(outdir);
  const manifest = JSON.parse(readFileSync(join(outdir, "manifest.json"), "utf8"));
  buildGallery(outdir, manifest);
  console.log(`→ rebuilt ${join(outdir, "index.html")}`);
}

// list_projects returns ~80KB and overflows the model context. Summarize it here.
function cmdProjects(file) {
  if (!file) throw new Error("usage: projects <projects.json>");
  const data = JSON.parse(readFileSync(file, "utf8"));
  const projects = data.projects || data;
  const rows = projects.map((p) => ({
    id: (p.name || "").split("/").pop(),
    title: p.title,
    created: p.createTime,
  }));
  rows.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  console.log(`${rows.length} project(s):\n`);
  for (const r of rows) console.log(`  ${r.id}  ${r.created?.slice(0, 10) || ""}  ${r.title || ""}`);
}

function cmdCheck() {
  const node = process.version;
  const chrome = findChrome();
  console.log(`node:   ${node} ${parseInt(node.slice(1)) >= 18 ? "✓ (global fetch)" : "✗ need >=18"}`);
  console.log(`chrome: ${chrome ? "✓ " + chrome : "✗ none (PNG previews disabled; assets still download)"}`);
  console.log(`\nThe MCP tools themselves are checked by the agent, not this script:`);
  console.log(`  Stitch  -> mcp__stitch__list_projects`);
  console.log(`  Astral  -> mcp__claude_ai_Astral_Guide__ask_astral_guide_v1`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  switch (cmd) {
    case "check": cmdCheck(); break;
    case "pull": await cmdPull(rest[0], rest[1]); break;
    case "render": cmdRender(rest[0]); break;
    case "gallery": cmdGallery(rest[0]); break;
    case "projects": cmdProjects(rest[0]); break;
    default:
      console.log("commands: check | pull <screens.json> [outdir] | render <outdir> | gallery <outdir> | projects <projects.json>");
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("error:", e.message);
  process.exit(1);
}
