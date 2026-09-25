// The style directory on the home page: search, tag filters and a grid of live tiles.
// Tapping a tile slides the list away and slides in a full detail view for that style.
// Each style has its own link (#slug), so the browser back button and shared links work.
import { loadStyles, loadPrompt, fillPrompt, copyText } from "./prompt.js";
import { settings, onChange } from "./settings.js";

const grid = document.getElementById("gallery");
const search = document.getElementById("search");
const filters = document.getElementById("filters");
const count = document.getElementById("count");

const listView = document.getElementById("list-view");
const detailView = document.getElementById("detail-view");
const detailPreview = document.getElementById("detail-preview");
const previewDock = document.querySelector(".preview-dock");
const detailTitle = document.getElementById("detail-title");
const detailSummary = document.getElementById("detail-summary");
const detailCopy = document.getElementById("detail-copy");
const detailStatus = document.getElementById("detail-status");
const detailPrompt = document.getElementById("detail-prompt");

const baseTitle = document.title;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

let styles = [];
let activeTag = "all";
let current = null; // slug shown in the detail view, or null when the list is showing
let listScroll = 0; // where the list was scrolled to, restored on the way back
let cameFromList = false; // true when the detail was opened from a tile (so Back can use history)
let running = null; // finishes the slide in progress, if any
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

const findStyle = (slug) => styles.find((s) => s.slug === slug);

const demoUrl = (style) => `styles/${style.slug}/demo.html`;

function frame(style) {
  return el("iframe", { src: demoUrl(style), title: `${style.name} demo`, tabindex: "-1" });
}

// Tiles play their demo only while on screen, so a long list stays light.
const observer = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const style = findStyle(target.dataset.slug);
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
  link.addEventListener("click", () => { cameFromList = true; });
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
      tag === "all" ? "All" : tag === "3d" ? "3D" : tag);
    button.addEventListener("click", () => {
      activeTag = tag;
      filters.querySelectorAll(".filter").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === tag)));
      render();
    });
    return button;
  }));
}

async function getPrompt(style) {
  if (!prompts.has(style.slug)) prompts.set(style.slug, loadPrompt(style.slug));
  return fillPrompt(await prompts.get(style.slug), settings);
}

// The preview takes the shape of the chosen format; every demo adapts to its window.
function setPreviewShape() {
  const [w, h] = settings.ratio.split(":").map(Number);
  previewDock.style.setProperty("--ar", String(w / h));
}

async function showPrompt(style) {
  try {
    const text = await getPrompt(style);
    if (current === style.slug) detailPrompt.textContent = text;
  } catch {
    detailPrompt.textContent = "Could not load this style. Try refreshing the page.";
  }
}

onChange((key) => {
  const style = findStyle(current);
  if (!style) return;
  detailStatus.textContent = "";
  if (key === "ratio") setPreviewShape();
  showPrompt(style);
});

async function fillDetail(style) {
  detailTitle.textContent = style.name;
  detailSummary.textContent = style.summary;
  detailStatus.textContent = "";
  detailPrompt.textContent = "Loading style...";
  setPreviewShape();
  detailPreview.replaceChildren(frame(style));
  document.title = `${style.name} · ${baseTitle}`;
  showPrompt(style);
}

// Slide one view out and the other in. The outgoing view is lifted out of the page flow
// and pinned where it was on screen, so the page can jump to the right scroll position
// underneath it without anything visibly moving.
function slide(from, to, direction, scrollTo) {
  // A slide still running (a quick double tap) is wrapped up at once, so views never mix.
  running?.();
  const before = scrollY;

  to.hidden = false;
  if (reduceMotion.matches) {
    from.hidden = true;
    scrollTo_(scrollTo);
    return;
  }

  from.classList.add("leaving");
  from.style.top = `${scrollTo - before}px`;
  scrollTo_(scrollTo);

  const ease = "cubic-bezier(0.32, 0.72, 0, 1)";
  const duration = 420;
  const outgoing = direction === "forward"
    ? [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(-28%)", opacity: 0 }]
    : [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(100%)", opacity: 1 }];
  const incoming = direction === "forward"
    ? [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]
    : [{ transform: "translateX(-28%)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }];

  // The view on top casts a soft shadow onto the one beneath.
  (direction === "forward" ? to : from).classList.add("on-top");
  const a = from.animate(outgoing, { duration, easing: ease });
  const b = to.animate(incoming, { duration, easing: ease });

  const done = () => {
    if (running !== done) return;
    running = null;
    a.cancel();
    b.cancel();
    from.hidden = true;
    from.classList.remove("leaving", "on-top");
    if (to.classList.contains("on-top")) {
      to.classList.replace("on-top", "settling");
      setTimeout(() => to.classList.remove("settling"), 400);
    }
    from.style.top = "";
  };
  running = done;
  b.finished.then(done, () => {});
}

function scrollTo_(y) {
  window.scrollTo({ top: y, behavior: "instant" });
}

function showDetail(slug) {
  const style = findStyle(slug);
  if (!style) return showList();
  const fromList = current === null;
  current = slug;
  fillDetail(style);
  if (fromList) {
    listScroll = scrollY;
    slide(listView, detailView, "forward", 0);
  }
  detailTitle.focus({ preventScroll: true });
}

function showList() {
  if (current === null) return;
  const slug = current;
  current = null;
  cameFromList = false;
  document.title = baseTitle;
  slide(detailView, listView, "back", listScroll);
  // Stop the big demo once the detail is off screen (unless another style opened meanwhile).
  setTimeout(() => { if (current === null) detailPreview.replaceChildren(); }, 500);
  const tileLink = grid.querySelector(`a[href="#${CSS.escape(slug)}"]`);
  tileLink?.focus({ preventScroll: true });
}

function goBack() {
  if (cameFromList) history.back();
  else {
    history.replaceState(null, "", location.pathname + location.search);
    showList();
  }
}

document.getElementById("detail-back").addEventListener("click", goBack);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && current !== null) goBack();
});

detailCopy.addEventListener("click", async () => {
  const style = findStyle(current);
  if (!style) return;
  try {
    await copyText(await getPrompt(style));
    detailStatus.textContent = "Copied. Paste it under your video idea in Claude.";
  } catch {
    detailStatus.textContent = "Could not copy. Select the style below and copy it by hand.";
  }
});

function route() {
  const slug = decodeURIComponent(location.hash.slice(1));
  if (slug) showDetail(slug);
  else showList();
}

window.addEventListener("hashchange", route);

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
  // Opened straight on a style link: show its detail without a slide.
  const slug = decodeURIComponent(location.hash.slice(1));
  if (findStyle(slug)) {
    current = slug;
    listView.hidden = true;
    detailView.hidden = false;
    fillDetail(findStyle(slug));
  }
} catch {
  grid.replaceChildren(el("p", { class: "empty" },
    "The styles could not load. If you opened this file straight from your computer, view it through a web server instead."));
}
