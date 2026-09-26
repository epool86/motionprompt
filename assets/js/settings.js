// Video settings on a style page: format, size, length and sound. Never the visitor's content.
// Remembered in this browser and shared by every style, except sound: it starts at Off
// on every style page, because the preview only plays after the visitor picks a sound.
import { FORMATS, QUALITIES, DURATIONS, SOUNDS, DEFAULT_SETTINGS } from "./prompt.js";

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
      try {
        const { sound, ...saved } = settings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch {}
      listener(key);
    });
    return button;
  });
  container.replaceChildren(...buttons);
}

segmented(document.getElementById("formats"), FORMATS, "ratio");
segmented(document.getElementById("qualities"), QUALITIES, "quality");
segmented(document.getElementById("durations"), DURATIONS.map((d) => ({ value: d, label: `${d}s` })), "duration");
segmented(document.getElementById("sounds"), SOUNDS, "sound");

// Put sound back to Off (used each time a style page opens).
export function resetSound() {
  settings.sound = "off";
  for (const b of document.querySelectorAll("#sounds .segment")) {
    b.setAttribute("aria-pressed", String(b === document.querySelector("#sounds .segment")));
  }
}

// Only styles whose prompt has a Sound section show the sound setting.
export function showSoundSetting(visible) {
  document.getElementById("sound-setting").hidden = !visible;
}
