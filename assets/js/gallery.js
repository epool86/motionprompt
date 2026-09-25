// The style directory on the home page: search, tag filters, a grid of live tiles,
// and a sheet with the big preview and the prompt. Each style has its own link (#slug).
import { fillPrompt, loadStyles, loadTemplate, copyText } from "./prompt.js";

const grid = document.getElementById("gallery");
const search = document.getElementById("search");
const filters = document.getElementById("filters");
const count = document.getElementById("count");

const sheet = document.getElementById("sheet");
const sheetPreview = document.getElementById("sheet-preview");
const sheetTitle = document.getElementById("sheet-title");
const sheetSummary = document.getElementById("sheet-summary");
const sheetChips = document.getElementById("sheet-chips");
const sheetCopy = document.getElementById("sheet-copy");
const sheetOpen = document.getElementById("sheet-open");
const sheetStatus = document.getElementById("sheet-status");
const sheetPrompt = document.getElementById("sheet-prompt");

let styles = [];
let activeTag = "all";
const prompts = new Map();

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

const demoUrl = (style) => `styles/${style.slug}/demo.html`;

function frame(style) {
  return el("iframe", { src: demoUrl(style), title: `${style.name} demo`, tabindex: "-1" });
}

// Tiles play their demo only while on screen, so a long list stays light.
const observer = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const style = styles.find((s) => s.slug === target.dataset.slug);
        if (isIntersecting && !target.querySelector("iframe")) target.replaceChildren(frame(style));
        if (!isIntersecting && target.querySelector("iframe")) target.replaceChildren();
      }
    }, { rootMargin: "300px 0px" })
  : null;

function tile(style) {
  const thumb = el("div", { class: "thumb", "data-slug": style.slug });
  const link = el("a", { class: "tile", href: `#${style.slug}`, "aria-label": `${style.name}: ${style.summary}` },
    thumb,
    el("span", { class: "tile-meta" },
      el("span", { class: "tile-name" }, style.name),
      el("span", { class: "tile-lib" }, style.library)));
  if (observer) observer.observe(thumb);
  else thumb.append(frame(style));
  return link;
}

function matches(style, query) {
  if (activeTag !== "all" && !(style.tags ?? []).includes(activeTag)) return false;
  if (!query) return true;
  const text = [style.name, style.summary, style.library, ...(style.tags ?? [])].join(" ").toLowerCase();
  return query.split(/\s+/).every((word) => text.includes(word));
}

function render() {
  const query = search.value.trim().toLowerCase();
  const shown = styles.filter((s) => matches(s, query));
  observer?.disconnect();
  grid.replaceChildren(...(shown.length ? shown.map(tile) : [el("p", { class: "empty" }, "No styles match. Try another word or tag.")]));
  count.textContent = `${shown.length} ${shown.length === 1 ? "style" : "styles"}`;
}

function renderFilters() {
  const tags = [...new Set(styles.flatMap((s) => s.tags ?? []))].sort();
  filters.replaceChildren(...["all", ...tags].map((tag) => {
    const button = el("button", { class: "filter", type: "button", "aria-pressed": String(tag === activeTag), "data-tag": tag },
      tag === "all" ? "All" : tag);
    button.addEventListener("click", () => {
      activeTag = tag;
      filters.querySelectorAll(".filter").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
      render();
    });
    return button;
  }));
}

function getPrompt(style) {
  if (!prompts.has(style.slug)) {
    prompts.set(style.slug, loadTemplate(style.slug).then((t) => fillPrompt(t, { library: style.library })));
  }
  return prompts.get(style.slug);
}

async function openSheet(slug) {
  const style = styles.find((s) => s.slug === slug);
  if (!style) return;
  sheet.dataset.slug = slug;
  sheetTitle.textContent = style.name;
  sheetSummary.textContent = style.summary;
  sheetChips.replaceChildren(
    el("li", { class: "chip library" }, style.library),
    ...(style.ratios ?? []).map((r) => el("li", { class: "chip" }, r)),
    ...(style.tags ?? []).map((t) => el("li", { class: "chip" }, `#${t}`)));
  sheetOpen.href = demoUrl(style);
  sheetOpen.setAttribute("aria-label", `Open the ${style.name} demo full screen`);
  sheetStatus.textContent = "";
  sheetPrompt.textContent = "Loading prompt...";
  sheetPreview.replaceChildren(frame(style));
  if (!sheet.open) sheet.showModal();
  sheetPrompt.scrollTop = 0;
  try {
    sheetPrompt.textContent = await getPrompt(style);
  } catch {
    sheetPrompt.textContent = "Could not load this prompt. Try refreshing the page.";
  }
}

function closeSheet() {
  if (sheet.open) sheet.close();
}

sheet.addEventListener("close", () => {
  sheetPreview.replaceChildren();
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
});

// Tap on the dimmed area outside the panel closes the sheet.
sheet.addEventListener("click", (event) => {
  if (event.target === sheet) closeSheet();
});

document.getElementById("sheet-close").addEventListener("click", closeSheet);

sheetCopy.addEventListener("click", async () => {
  const style = styles.find((s) => s.slug === sheet.dataset.slug);
  if (!style) return;
  try {
    await copyText(await getPrompt(style));
    sheetStatus.textContent = "Copied. Now paste it into Claude.";
  } catch {
    sheetStatus.textContent = "Could not copy. Select the prompt below and copy it by hand.";
  }
});

window.addEventListener("hashchange", () => {
  const slug = location.hash.slice(1);
  if (slug) openSheet(slug);
  else closeSheet();
});

search.addEventListener("input", render);

// Mark the toolbar as stuck once the intro has scrolled away under the header.
const toolbar = document.querySelector(".toolbar");
const intro = document.querySelector(".intro");
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => toolbar.classList.toggle("stuck", !entry.isIntersecting),
    { rootMargin: "-57px 0px 0px 0px" }).observe(intro);
}

try {
  styles = await loadStyles();
  renderFilters();
  render();
  if (location.hash) openSheet(location.hash.slice(1));
} catch {
  grid.replaceChildren(el("p", { class: "empty" },
    "The styles could not load. If you opened this file straight from your computer, view it through a web server instead."));
}
