// Fills a style's prompt template from the visitor's choices, and builds the demo URL
// that previews those choices. Shared by the directory and (later) any other page.

// Colour palettes. Each has four colours: background, text, accent and a second accent.
export const PALETTES = [
  { id: "coral", name: "Coral", bg: "10131f", ink: "f6f3ea", accent: "ff5a4e", accent2: "ffd23f" },
  { id: "neon", name: "Neon", bg: "0b0a1f", ink: "f4f2ff", accent: "8b6cff", accent2: "ff4fd8" },
  { id: "sunset", name: "Sunset", bg: "2a0f2d", ink: "fff3e3", accent: "ff6b3d", accent2: "ffc23c" },
  { id: "mint", name: "Mint", bg: "0c2621", ink: "eafff6", accent: "2fd6a0", accent2: "ffe066" },
  { id: "ocean", name: "Ocean", bg: "071a2e", ink: "e9f4ff", accent: "2ea8ff", accent2: "7cf0e0" },
  { id: "paper", name: "Paper", bg: "f3ede2", ink: "1b1a17", accent: "e4572e", accent2: "2e86ab" },
  { id: "mono", name: "Mono", bg: "0d0d0d", ink: "ffffff", accent: "ffffff", accent2: "9a9a9a" },
];

export const COLOR_KEYS = [
  { key: "bg", label: "Background" },
  { key: "ink", label: "Text" },
  { key: "accent", label: "Accent" },
  { key: "accent2", label: "Second accent" },
];

// Video sizes Claude should render, by aspect ratio.
export const FORMATS = {
  "9:16": { label: "9:16", hint: "Reels, TikTok, Shorts", size: "1080 x 1920 pixels (vertical 9:16)" },
  "1:1": { label: "1:1", hint: "Feed post", size: "1080 x 1080 pixels (square 1:1)" },
  "16:9": { label: "16:9", hint: "YouTube", size: "1920 x 1080 pixels (widescreen 16:9)" },
};

export const DURATIONS = [6, 8, 10, 15];

export const DEFAULTS = {
  text: "Make it move",
  palette: "coral",
  colors: { bg: PALETTES[0].bg, ink: PALETTES[0].ink, accent: PALETTES[0].accent, accent2: PALETTES[0].accent2 },
  ratio: "9:16",
  duration: 8,
  notes: "",
};

const PLACEHOLDER = /\{(ratio|duration|colors|text|library|notes)\}/g;

function colorPhrase(c) {
  return `background #${c.bg}, text #${c.ink}, accent #${c.accent}, second accent #${c.accent2}`;
}

// choices: { text, colors, ratio, duration, notes }; style gives the library hint.
export function fillPrompt(template, choices = {}, style = {}) {
  const all = { ...DEFAULTS, ...choices };
  const values = {
    text: all.text.trim() || DEFAULTS.text,
    colors: colorPhrase(all.colors),
    ratio: (FORMATS[all.ratio] ?? FORMATS["9:16"]).size,
    duration: `${all.duration} seconds`,
    library: style.library ?? "any animation library you like",
    notes: all.notes.trim() ? `\nAlso: ${all.notes.trim()}` : "",
  };
  return template
    .replace(PLACEHOLDER, (match, key) => values[key] ?? match)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The demo page reads the same choices from its URL, so the preview matches the prompt.
export function demoSrc(style, choices = {}) {
  const all = { ...DEFAULTS, ...choices };
  const params = new URLSearchParams({ text: all.text.trim() || DEFAULTS.text });
  for (const { key } of COLOR_KEYS) params.set(key, all.colors[key]);
  return `styles/${style.slug}/demo.html?${params}`;
}

export async function loadStyles() {
  const res = await fetch("styles/styles.json");
  if (!res.ok) throw new Error(`styles.json: ${res.status}`);
  return res.json();
}

export async function loadTemplate(slug) {
  const res = await fetch(`styles/${slug}/prompt.txt`);
  if (!res.ok) throw new Error(`${slug}/prompt.txt: ${res.status}`);
  return res.text();
}

// Clipboard API needs a secure context; fall back to a hidden textarea.
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy failed");
}
