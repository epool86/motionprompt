// Makes the gallery tile clips: styles/<slug>/tile.mp4 (a short seamless loop) and
// styles/<slug>/tile.webp (its first frame, shown at once and for reduced motion).
// Run it again for a style whenever its demo changes.
//
//   node scripts/tiles.mjs [slug ...] [--base <site url>] [--jobs 4]
//
// With no slugs it makes tiles for every style shown in the gallery. The demos are loaded from --base
// (default: the local site). A tile starts at the style's "tileStart" in styles.json (seconds into
// the demo, default 2), so pick a moment where the demo looks its best.
//
// This is a tool for the site owner, not part of the site. It needs Google Chrome, ffmpeg with
// libx264 and libwebp, and puppeteer-core (not in this repo: install it anywhere and point
// PUPPETEER_CORE at its entry file). Env: CHROME, FFMPEG, PUPPETEER_CORE.
//
// Every clock the demos read (performance.now, Date, requestAnimationFrame, GSAP and three.js run
// on those, and CSS animations) is replaced by a virtual clock that moves exactly one frame per
// screenshot, so the clips are smooth whatever the machine load.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const root = new URL("..", import.meta.url).pathname;
const W = 360, H = 450, DPR = 1.2; // layout size of a big tile; the video is 432 x 540
const FPS = 30, LENGTH = 4, FADE = 0.5; // a 4 s loop whose last 0.5 s dissolves into its first frame
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const PUPPETEER_CORE = process.env.PUPPETEER_CORE || "puppeteer-core";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args.splice(i, 2)[1];
};
const base = opt("base", "https://motionprompt.test/").replace(/\/?$/, "/");
const jobs = Number(opt("jobs", 4));
const styles = JSON.parse(readFileSync(join(root, "styles/styles.json"), "utf8"));
// Hidden styles are not in the gallery, so they only get a tile when named.
const todo = args.length ? styles.filter((s) => args.includes(s.slug)) : styles.filter((s) => !s.hidden);
const unknown = args.filter((a) => !styles.some((s) => s.slug === a));
if (unknown.length) {
  console.error(`unknown style: ${unknown.join(", ")}`);
  process.exit(2);
}

// CDN files (GSAP, three.js, fonts) are cached on disk, so parallel captures load them once.
const CACHE = join(tmpdir(), "motionprompt-cdn-cache");
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
async function cached(url) {
  const file = join(CACHE, createHash("sha1").update(url).digest("hex"));
  if (existsSync(`${file}.json`)) return { body: readFileSync(file), ...JSON.parse(readFileSync(`${file}.json`, "utf8")) };
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const hit = { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "application/octet-stream" };
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(`${file}.${process.pid}`, hit.body);
      renameSync(`${file}.${process.pid}`, file);
      writeFileSync(`${file}.json`, JSON.stringify({ type: hit.type }));
      return hit;
    } catch (e) {
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

// Injected before any page script: all time comes from `vt`, which only moves in step().
function clockShim() {
  let vt = 0;
  const RealDate = Date, DATE0 = 1767225600000;
  function VDate(...a) {
    if (!new.target) return new RealDate(DATE0 + vt).toString();
    return a.length ? new RealDate(...a) : new RealDate(DATE0 + vt);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => DATE0 + vt;
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  window.Date = VDate;
  Object.defineProperty(performance, "now", { value: () => vt, configurable: true });

  // Seeded random, so grain and sparkles are the same on every run.
  let seed = 0x9e3779b9;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let queue = new Map(), running = null, nextId = 1;
  window.requestAnimationFrame = (cb) => { queue.set(nextId, cb); return nextId++; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); running?.delete(id); };

  const started = new WeakMap();
  const errors = [];
  window.__tile = {
    step(ms, n) {
      for (let k = 0; k < n; k++) {
        vt += ms;
        for (const a of document.getAnimations?.() ?? []) {
          if (!started.has(a)) started.set(a, vt - (a.currentTime || 0));
          try { a.pause(); a.currentTime = vt - started.get(a); } catch {}
        }
        running = queue;
        queue = new Map();
        for (const [id, cb] of running) {
          if (!running.has(id)) continue;
          running.delete(id);
          try { cb(vt); } catch (e) { errors.push(String(e?.stack || e)); }
        }
        running = null;
      }
    },
    pending: () => queue.size,
    errors,
  };
}

const puppeteer = (await import(PUPPETEER_CORE)).default;

async function makeTile(style) {
  const t0 = Date.now();
  const dir = join(root, "styles", style.slug);
  const start = style.tileStart ?? 2;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--ignore-certificate-errors", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
      "--hide-scrollbars", "--force-color-profile=srgb", "--mute-audio"],
    defaultViewport: { width: W, height: H, deviceScaleFactor: DPR },
    protocolTimeout: 600000,
  });
  const problems = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => problems.push(String(e.message || e)));
    page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()}`));
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "no-preference" },
      { name: "prefers-color-scheme", value: "dark" },
    ]);
    await page.evaluateOnNewDocument(clockShim);
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      if (req.method() !== "GET" || !CDN.test(req.url())) return req.continue();
      try {
        const hit = await cached(req.url());
        await req.respond({ status: 200, body: hit.body, headers: { "content-type": hit.type, "access-control-allow-origin": "*" } });
      } catch {
        req.continue();
      }
    });
    await page.goto(`${base}styles/${style.slug}/demo.html`, { waitUntil: "networkidle0", timeout: 120000 });
    // Wait (in real time, the virtual clock stays at 0) for fonts, images and the first queued frame.
    await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 200; i++) {
        if (window.__tile.pending() > 0 && [...document.images].every((im) => im.complete) && document.fonts.status === "loaded") break;
        await wait(50);
      }
      await wait(400);
      await document.fonts.ready;
    });

    const cdp = await page.createCDPSession();
    // A raw screenshot comes out at CSS size unless the clip scales it up to the pixel ratio.
    const clip = { x: 0, y: 0, width: W, height: H, scale: DPR };
    const shot = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true, clip })).data, "base64");
    const step = async (n) => {
      for (; n > 0; n -= 15) await page.evaluate((ms, k) => window.__tile.step(ms, k), 1000 / FPS, Math.min(n, 15));
    };

    // Frames [0, FADE) are dissolved into the end of the loop; the loop itself starts at frame F.
    const F = Math.round(FADE * FPS), total = Math.round((LENGTH + FADE) * FPS);
    const tail = (LENGTH - FADE).toFixed(3);
    const ff = spawn(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
      "-filter_complex",
      `[0:v]split[a][b];` +
      `[a]trim=start_frame=${F},setpts=PTS-STARTPTS[loop];` +
      `[b]trim=end_frame=${F},setpts=PTS-STARTPTS+${tail}/TB,format=yuva444p,fade=t=in:st=${tail}:d=${FADE}:alpha=1[head];` +
      `[loop][head]overlay=eof_action=pass,format=yuv420p[v]`,
      "-map", "[v]", "-r", String(FPS), "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high",
      "-g", String(FPS * 2), "-movflags", "+faststart", join(dir, "tile.mp4"),
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
    const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));

    await step(Math.max(1, Math.round(start * FPS)));
    for (let i = 0; i < total; i++) {
      if (i) await step(1);
      const png = await shot();
      if (i === F) writeFileSync(join(dir, "tile.png"), png);
      await write(png);
    }
    ff.stdin.end();
    await done;
    problems.push(...(await page.evaluate(() => window.__tile.errors.slice(0, 5))));
  } finally {
    await browser.close().catch(() => {});
  }

  // The poster is the loop's first frame, so the clip starts with no jump.
  await new Promise((res, rej) => spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", join(dir, "tile.png"),
    "-c:v", "libwebp", "-quality", "74", join(dir, "tile.webp")], { stdio: "inherit" })
    .on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  await import("node:fs/promises").then((fs) => fs.rm(join(dir, "tile.png")));

  const kb = (f) => Math.round(readFileSync(join(dir, f)).length / 1024);
  console.log(`${style.slug}: ${kb("tile.mp4")} KB mp4, ${kb("tile.webp")} KB webp, ${((Date.now() - t0) / 1000).toFixed(0)} s` +
    (problems.length ? `\n  problems: ${problems.join("\n  ")}` : ""));
  return problems.length === 0;
}

let next = 0, failed = 0;
await Promise.all(Array.from({ length: Math.min(jobs, todo.length) }, async () => {
  while (next < todo.length) {
    const style = todo[next++];
    try {
      if (!(await makeTile(style))) failed++;
    } catch (e) {
      failed++;
      console.error(`${style.slug}: ${e.message}`);
    }
  }
}));
if (failed) {
  console.error(`${failed} tile(s) had problems`);
  process.exit(1);
}
