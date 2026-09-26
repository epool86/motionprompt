// Loads the style list and each style's prompt, and copies text to the clipboard.
// Shared by the directory and any later page.

export async function loadStyles() {
  const res = await fetch("styles/styles.json");
  if (!res.ok) throw new Error(`styles.json: ${res.status}`);
  return res.json();
}

// A style prompt is general: the visitor pastes it under their own video request.
// Only the video settings (size and length) are filled in, never the visitor's content.
export async function loadPrompt(slug) {
  const res = await fetch(`styles/${slug}/prompt.txt`);
  if (!res.ok) throw new Error(`${slug}/prompt.txt: ${res.status}`);
  return (await res.text()).trim();
}

export const FORMATS = [
  { value: "9:16", label: "9:16", hint: "Reels, TikTok", name: "vertical 9:16" },
  { value: "4:5", label: "4:5", hint: "Feed", name: "portrait 4:5" },
  { value: "1:1", label: "1:1", hint: "Square", name: "square 1:1" },
  { value: "16:9", label: "16:9", hint: "YouTube", name: "widescreen 16:9" },
];

// The short side of the video, in pixels.
export const QUALITIES = [
  { value: 480, label: "480p" },
  { value: 720, label: "720p" },
  { value: 1080, label: "1080p" },
];

export const DURATIONS = [6, 8, 10, 15, 30];

export const SOUNDS = [
  { value: "off", label: "Off" },
  { value: "effects", label: "Effects" },
  { value: "music", label: "Effects + music" },
];

export const DEFAULT_SETTINGS = { ratio: "9:16", quality: 1080, duration: 8, sound: "off" };

// A style with sound has a "Sound" section with "- Effects:" and "- Music:" bullets.
export function hasSound(template) {
  return /^Sound\n- Effects:/m.test(template);
}

// Off drops the whole Sound section, Effects drops the music bullet.
function applySound(template, sound) {
  if (!hasSound(template)) return template;
  if (sound === "off") return template.replace(/^Sound\n(?:- .*\n?)+\n*/m, "");
  if (sound === "effects") return template.replace(/^- Music:.*\n/m, "");
  return template;
}

// For example 9:16 at 1080p is 1080 x 1920 pixels.
export function videoSize({ ratio, quality }) {
  const [w, h] = ratio.split(":").map(Number);
  const short = quality;
  const long = Math.round((short * Math.max(w, h)) / Math.min(w, h) / 2) * 2;
  const [width, height] = w >= h ? [long, short] : [short, long];
  const name = FORMATS.find((f) => f.value === ratio)?.name ?? ratio;
  return `${width} x ${height} pixels (${name})`;
}

export function fillPrompt(template, settings) {
  return applySound(template, settings.sound)
    .replace("{size}", videoSize(settings))
    .replace("{duration}", `${settings.duration} seconds`);
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
