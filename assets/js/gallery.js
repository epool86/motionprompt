// Renders the style gallery from styles/styles.json.
// Demos load only when their card scrolls near the screen, so the page stays light.
import { fillPrompt, loadStyles, loadTemplate, copyText } from "./prompt.js";

const grid = document.getElementById("gallery");

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function chipList(style) {
  const list = el("ul", { class: "chips", "aria-label": "Details" });
  list.append(el("li", { class: "chip library" }, style.library));
  for (const ratio of style.ratios ?? []) list.append(el("li", { class: "chip" }, ratio));
  for (const tag of style.tags ?? []) list.append(el("li", { class: "chip" }, `#${tag}`));
  return list;
}

function card(style) {
  const demoUrl = `styles/${style.slug}/demo.html`;
  const preview = el("div", { class: "preview", "data-src": demoUrl, "data-title": `${style.name} demo` },
    el("span", { class: "loading" }, "Loading demo..."));

  const promptBox = el("pre", { class: "prompt-text" }, "Loading prompt...");
  const details = el("details", {}, el("summary", {}, "Read the prompt"), promptBox);
  const status = el("p", { class: "status", role: "status", "aria-live": "polite" });
  const copyButton = el("button", { class: "button", type: "button", "aria-label": `Copy the ${style.name} prompt` }, "Copy prompt");
  const openLink = el("a", { class: "button secondary", href: demoUrl, target: "_blank", rel: "noopener", "aria-label": `Open the ${style.name} demo full screen` }, "Full screen");

  let prompt = "";
  const ready = loadTemplate(style.slug).then((template) => {
    prompt = fillPrompt(template, { library: style.library });
    promptBox.textContent = prompt;
  }).catch(() => {
    promptBox.textContent = "Could not load this prompt. Try refreshing the page.";
  });

  copyButton.addEventListener("click", async () => {
    await ready;
    if (!prompt) return;
    try {
      await copyText(prompt);
      status.textContent = "Copied. Paste it into Claude.";
    } catch {
      status.textContent = "Could not copy. Open \"Read the prompt\" and copy it by hand.";
    }
  });

  return el("article", { class: "card", id: style.slug },
    preview,
    el("div", { class: "card-body" },
      el("h2", {}, style.name),
      el("p", {}, style.summary),
      chipList(style),
      details,
      el("div", { class: "card-actions" }, copyButton, openLink),
      status));
}

function loadDemo(preview) {
  const frame = el("iframe", {
    src: preview.dataset.src,
    title: preview.dataset.title,
    loading: "lazy",
    tabindex: "-1",
  });
  preview.replaceChildren(frame);
}

function watchPreviews() {
  const previews = grid.querySelectorAll(".preview[data-src]");
  if (!("IntersectionObserver" in window)) {
    previews.forEach(loadDemo);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      loadDemo(entry.target);
    }
  }, { rootMargin: "200px 0px" });
  previews.forEach((preview) => observer.observe(preview));
}

try {
  const styles = await loadStyles();
  grid.replaceChildren(...styles.map(card));
  watchPreviews();
} catch {
  grid.replaceChildren(el("p", { class: "error" },
    "The gallery could not load. If you opened this file straight from your computer, view it through a web server instead."));
}
