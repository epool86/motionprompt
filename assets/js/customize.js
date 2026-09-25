// "Make it yours": the visitor's words, colours, format, length and notes.
// Choices are shared by every style and remembered in this browser, so a returning
// visitor sees their own content straight away.
import { PALETTES, COLOR_KEYS, FORMATS, DURATIONS, DEFAULTS } from "./prompt.js";

const STORAGE_KEY = "motionprompt:choices";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const colors = { ...DEFAULTS.colors };
      for (const key of Object.keys(colors)) {
        if (/^[0-9a-f]{6}$/i.test(saved.colors?.[key] ?? "")) colors[key] = saved.colors[key];
      }
      return { ...DEFAULTS, ...saved, colors };
    }
  } catch {}
  return { ...DEFAULTS, colors: { ...DEFAULTS.colors } };
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choices)); } catch {}
}

export const choices = load();

const $ = (id) => document.getElementById(id);
const textInput = $("f-text");
const textLabel = $("f-text-label");
const textHint = $("f-text-hint");
const palettes = $("palettes");
const colorInputs = $("color-inputs");
const formats = $("formats");
const durations = $("durations");
const notes = $("f-notes");

let listener = () => {};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

// what: "text" | "colors" | "ratio" | "duration" | "notes", so the page can skip work it does not need.
function changed(what) {
  save();
  listener(what);
}

function swatches(colors) {
  return el("span", { class: "swatch", "aria-hidden": "true" },
    ...COLOR_KEYS.map(({ key }) => {
      const dot = el("span");
      dot.style.background = `#${colors[key]}`;
      return dot;
    }));
}

function renderPalettes() {
  const options = [...PALETTES, { id: "custom", name: "Custom" }];
  palettes.replaceChildren(...options.map((p) => {
    const button = el("button", { type: "button", class: "palette", "aria-pressed": String(choices.palette === p.id), "data-id": p.id, title: p.name },
      swatches(p.id === "custom" ? choices.colors : p), el("span", { class: "palette-name" }, p.name));
    button.addEventListener("click", () => {
      choices.palette = p.id;
      if (p.id !== "custom") choices.colors = { bg: p.bg, ink: p.ink, accent: p.accent, accent2: p.accent2 };
      syncPalettes();
      changed("colors");
    });
    return button;
  }));
  syncPalettes();
}

function syncPalettes() {
  for (const b of palettes.querySelectorAll(".palette")) b.setAttribute("aria-pressed", String(b.dataset.id === choices.palette));
  colorInputs.hidden = choices.palette !== "custom";
  for (const input of colorInputs.querySelectorAll("input")) input.value = `#${choices.colors[input.dataset.key]}`;
  const custom = palettes.querySelector('[data-id="custom"] .swatch');
  custom?.replaceWith(swatches(choices.colors));
}

function renderColorInputs() {
  colorInputs.replaceChildren(...COLOR_KEYS.map(({ key, label }) => {
    const input = el("input", { type: "color", "data-key": key, value: `#${choices.colors[key]}` });
    input.addEventListener("input", () => {
      choices.colors = { ...choices.colors, [key]: input.value.slice(1) };
      palettes.querySelector('[data-id="custom"] .swatch')?.replaceWith(swatches(choices.colors));
      changed("colors");
    });
    return el("label", { class: "color-input" }, input, el("span", {}, label));
  }));
}

function segmented(container, options, current, onPick) {
  container.replaceChildren(...options.map(({ value, label, hint }) => {
    const button = el("button", { type: "button", class: "segment", "aria-pressed": String(value === current), "data-value": String(value) },
      el("span", {}, label), ...(hint ? [el("small", {}, hint)] : []));
    button.addEventListener("click", () => {
      for (const b of container.querySelectorAll(".segment")) b.setAttribute("aria-pressed", String(b === button));
      onPick(value);
    });
    return button;
  }));
}

// Show the panel for one style (its text label and available formats).
export function showFor(s) {
  textLabel.textContent = s.text?.label ?? "Your text";
  textHint.textContent = s.text?.hint ?? "";
  textInput.maxLength = s.text?.max ?? 60;
  textInput.value = choices.text;
  notes.value = choices.notes;
  if (!(s.ratios ?? []).includes(choices.ratio)) choices.ratio = s.ratios?.[0] ?? "9:16";
  segmented(formats, (s.ratios ?? ["9:16"]).map((r) => ({ value: r, label: FORMATS[r]?.label ?? r, hint: FORMATS[r]?.hint })),
    choices.ratio, (v) => { choices.ratio = v; changed("ratio"); });
  syncPalettes();
}

export function onChange(fn) {
  listener = fn;
}

textInput.addEventListener("input", () => {
  choices.text = textInput.value;
  changed("text");
});

notes.addEventListener("input", () => {
  choices.notes = notes.value;
  changed("notes");
});

// Enter in the text field should not submit anything.
document.getElementById("customize").addEventListener("submit", (event) => event.preventDefault());

renderColorInputs();
renderPalettes();
segmented(durations, DURATIONS.map((d) => ({ value: d, label: `${d}s` })), choices.duration,
  (v) => { choices.duration = v; changed("duration"); });
