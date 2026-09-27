// Validates the static site: styles.json entries, their files, and URL rules.
// Run: node scripts/check.mjs
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const errors = [];

// styles.json: valid, unique slugs, files present
const stylesPath = join(root, "styles/styles.json");
let styles = [];
try {
  styles = JSON.parse(readFileSync(stylesPath, "utf8"));
  if (!Array.isArray(styles)) errors.push("styles/styles.json must be an array");
} catch (e) {
  errors.push(`styles/styles.json: ${e.message}`);
}

const seen = new Set();
for (const s of styles) {
  for (const key of ["slug", "name", "summary", "library"]) {
    if (!s[key]) errors.push(`style ${s.slug ?? "?"}: missing "${key}"`);
  }
  if (seen.has(s.slug)) errors.push(`style ${s.slug}: duplicate slug`);
  seen.add(s.slug);
  // Styles in the gallery also need their tile clip and still (node scripts/tiles.mjs <slug>).
  const files = s.hidden ? ["demo.html", "prompt.txt"] : ["demo.html", "prompt.txt", "tile.mp4", "tile.webp"];
  for (const file of files) {
    if (!existsSync(join(root, "styles", s.slug ?? "", file))) {
      errors.push(`style ${s.slug}: missing styles/${s.slug}/${file}`);
    }
  }
}

// Every HTML/CSS/JS file: no root-relative URLs, no unpinned CDN libraries, no em/en dashes
const skip = new Set([".git", "node_modules"]);
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if ([".html", ".css", ".js", ".mjs", ".txt", ".md", ".json"].includes(extname(name))) checkFile(path);
  }
}

function checkFile(path) {
  const rel = path.slice(root.length);
  const text = readFileSync(path, "utf8");
  if (/[\u2013\u2014]/.test(text)) errors.push(`${rel}: contains an em or en dash`);
  if ([".html", ".css", ".js"].includes(extname(path))) {
    if (/(?:href|src)=["']\/(?!\/)/.test(text) || /url\(\s*["']?\/(?!\/)/.test(text)) {
      errors.push(`${rel}: root-relative URL (use a relative path)`);
    }
    if (/@latest\b/.test(text)) errors.push(`${rel}: unpinned CDN version (@latest)`);
  }
}

walk(root);

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  console.error(`\n${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`OK (${styles.length} styles)`);
