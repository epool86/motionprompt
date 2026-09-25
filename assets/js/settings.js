// Video settings on a style page: format, size and length. Never the visitor's content.
// Remembered in this browser and shared by every style.
import { FORMATS, QUALITIES, DURATIONS, DEFAULT_SETTINGS } from "./prompt.js";

const STORAGE_KEY = "motionprompt:settings";

function load() {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {};
    if (FORMATS.some((f) => f.value === saved.ratio)) settings.ratio = saved.ratio;
    if (QUALITIES.some((q) => q.value === saved.quality)) settings.quality = saved.quality;
    if (DURATIONS.includes(saved.duration)) settings.duration = saved.duration;
  } catch {}
  return settings;
}

export const settings = load();

let listener = () => {};
export function onChange(fn) { listener = fn; }

function segmented(container, options, key) {
  const buttons = options.map(({ value, label, hint }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment";
    button.setAttribute("aria-pressed", String(value === settings[key]));
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    if (hint) {
      const small = document.createElement("small");
      small.textContent = hint;
      button.append(small);
    }
    button.addEventListener("click", () => {
      settings[key] = value;
      for (const b of buttons) b.setAttribute("aria-pressed", String(b === button));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
      listener(key);
    });
    return button;
  });
  container.replaceChildren(...buttons);
}

segmented(document.getElementById("formats"), FORMATS, "ratio");
segmented(document.getElementById("qualities"), QUALITIES, "quality");
segmented(document.getElementById("durations"), DURATIONS.map((d) => ({ value: d, label: `${d}s` })), "duration");
