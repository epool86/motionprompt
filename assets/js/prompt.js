// Fills a style's prompt template. Shared by the gallery and (later) the builder.

// Defaults are written so a template still reads well when nobody changes them.
export const DEFAULTS = {
  ratio: "9:16",
  duration: "8 seconds",
  colors: "a deep navy background with a bright coral accent and warm white text",
  text: "Make it move",
};

const PLACEHOLDER = /\{(ratio|duration|colors|text|library)\}/g;

export function fillPrompt(template, values = {}) {
  const all = { ...DEFAULTS, ...values };
  return template.replace(PLACEHOLDER, (match, key) => all[key] ?? match).trim();
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
