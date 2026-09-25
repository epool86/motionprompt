# MotionPrompt

A free static site that helps people make short animated "videos" with Claude. Claude writes
an HTML page that animates (Motion, GSAP, Three.js, WebGL, Canvas), and the user records it
for Reels, TikTok or YouTube. The site gives them:

1. **Style gallery**: live demos of animation styles, each with a ready prompt.
2. **Prompt builder**: pick style, library, aspect ratio, duration, colours and text, get a prompt to copy.
3. **Guide**: how to prompt, how to iterate, how to export the animation to MP4.

Audience: friends and followers, not developers. Plain English, short sentences, no jargon
without a one-line explanation.

## Hard rules

- **Static only. No build step, no npm, no framework, no backend.** Plain HTML, CSS and JS
  (ES modules). The same files are served locally by nginx and in production by GitHub Pages.
- **Relative URLs only.** Production lives under a sub-path (`https://epool86.github.io/motionprompt/`),
  so a leading `/` breaks links. Write `assets/css/site.css`, never `/assets/css/site.css`.
- **Third-party libraries from a CDN, pinned to an exact version** (cdn.jsdelivr.net or cdnjs).
  No `@latest`.
- **Every demo must respect `prefers-reduced-motion`** (pause or show a still frame).
- **Never use em dashes or en dashes as punctuation** in copy, code or comments. Use a comma,
  colon, parentheses, or two sentences.
- English only.

## Layout

```
index.html              home = the style directory: search, tag filters, grid of live tiles.
                        Tapping a tile slides the list out and a full detail view in (preview,
                        prompt, copy); Back slides it back. Each style links as #slug
gallery.html            old address, redirects to index.html
builder.html            prompt builder form, copy-to-clipboard output
guide.html              prompting tips + export to MP4
assets/css/site.css     shared styles (design tokens on :root, light and dark)
assets/js/*.js          shared scripts (ES modules); gallery.js drives the directory
assets/img/logo.svg     logo mark and favicon
styles/styles.json      list of styles (the single source of truth for the gallery and builder)
styles/<slug>/demo.html self-contained animation, loads its own library from a CDN
styles/<slug>/prompt.txt prompt template for that style, with {placeholders}
scripts/check.mjs       validation, run before every commit
```

Pages that are listed above but missing are not built yet.

Design: mobile first and compact. The home page is the app itself (no marketing sections).
Dark "film studio" look with a light variant; tokens live on `:root` in `site.css`.

### `styles/styles.json` entry

```json
{
  "slug": "kinetic-type",
  "name": "Kinetic typography",
  "summary": "Words that punch in on the beat.",
  "library": "GSAP",
  "ratios": ["9:16", "1:1", "16:9"],
  "tags": ["text", "social"]
}
```

`slug` must match a folder in `styles/` that has both `demo.html` and `prompt.txt`.

### Prompt template placeholders

`{ratio}`, `{duration}`, `{colors}`, `{text}`, `{library}`. The builder fills these in.
A template must still read well if a placeholder is left at its default.

## Verify

```bash
node scripts/check.mjs     # must print OK
```

Local site: `https://motionprompt.test` (nginx, already running). Do not start any other web
server. In a cloud session there is no nginx; open files directly or rely on `check.mjs`.

## Git

- Default branch `main`. GitHub Pages publishes from `main` (root).
- Work on a branch and open a pull request. Never push straight to `main`.
