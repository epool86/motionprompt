# MotionPrompt

A free static site that helps people make short animated videos with Claude. The visitor picks a
style, makes it theirs (words, colours, format, length), copies the prompt and pastes it into
Claude on the web or Claude Code. Claude builds the animation and sends back a finished MP4.
The site gives them:

1. **Style gallery** (the home page): live demos of animation styles. Each style page has a
   "Make it yours" panel with a live preview and a prompt to copy. This is also the prompt builder.
2. **Guide** (not built yet): how to prompt, iterate, and what to do if a render times out.

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
guide.html              prompting tips + export to MP4
assets/css/site.css     shared styles (design tokens on :root, light and dark)
assets/js/*.js          shared scripts (ES modules): gallery.js (directory and views),
                        customize.js (Make it yours panel), prompt.js (palettes, formats, fill)
assets/img/logo.svg     logo mark and favicon
styles/styles.json      list of styles (the single source of truth for the gallery)
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
  "tags": ["text", "social"],
  "text": {"label": "Your words", "hint": "Short and punchy works best.", "max": 60}
}
```

`text` sets the label, hint and length limit of the style's text field.

`slug` must match a folder in `styles/` that has both `demo.html` and `prompt.txt`.

### Prompt template placeholders

`{text}`, `{ratio}` (becomes a pixel size such as "1080 x 1920 pixels (vertical 9:16)"),
`{duration}`, `{colors}` (four hex colours), `{library}` and `{notes}` (the visitor's extra
notes, or nothing). `assets/js/prompt.js` fills them in.

Prompts ask Claude for the final MP4 only (visitors want the video, not the source). Keep them in plain
language: describe the look and motion, list the visitor's choices, and give a one-line build
hint. Claude knows how to render video, so do not spell out the technical steps.

### Demo parameters

Every `demo.html` reads `?text=` and the colours `?bg= &ink= &accent= &accent2=` (hex, no `#`)
from its URL, so the live preview shows the visitor's own content. It must fit any window shape,
because the preview is reshaped to 9:16, 1:1 or 16:9.

## Verify

```bash
node scripts/check.mjs     # must print OK
```

Local site: `https://motionprompt.test` (nginx, already running). Do not start any other web
server. In a cloud session there is no nginx; open files directly or rely on `check.mjs`.

## Git

- Default branch `main`. GitHub Pages publishes from `main` (root).
- Work on a branch and open a pull request. Never push straight to `main`.
