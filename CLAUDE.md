# MotionPrompt

A free static site that helps people make short animated videos with Claude. The visitor picks a
style, chooses video settings (format, size, length), copies the style and pastes it under their
own video request in Claude on the web or Claude Code. Claude sends back a finished MP4.
The site gives them:

1. **Style gallery** (the home page): live demos of animation styles. Each style page has video
   settings (format, size, length), the style prompt to copy, and a one-line tip.
2. **Questions?** link in the header goes to the owner's Facebook (no guide page for now).

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
index.html              home = the style directory: search, tag filters, grid of tiles that play clips.
                        Tapping a tile slides the list out and a full detail view in (preview,
                        prompt, copy); Back slides it back. Each style links as #slug
gallery.html            old address, redirects to index.html
assets/css/site.css     shared styles (design tokens on :root, light and dark)
assets/js/*.js          shared scripts (ES modules): gallery.js (directory and views),
                        settings.js (video settings), prompt.js (load, fill, copy)
assets/img/logo.svg     logo mark and favicon
styles/styles.json      list of styles (the single source of truth for the gallery)
styles/<slug>/demo.html self-contained animation, loads its own library from a CDN
styles/<slug>/prompt.txt prompt template for that style, with {placeholders}
styles/<slug>/tile.mp4  short looping clip of the demo for the gallery tile, and tile.webp its still
scripts/check.mjs       validation, run before every commit
scripts/tiles.mjs       makes tile.mp4 and tile.webp (an owner tool, see Tiles below)
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
  "tags": ["text", "social"]
}
```


`slug` must match a folder in `styles/` that has both `demo.html` and `prompt.txt`.

`"hidden": true` keeps a style (and its #slug link) but leaves it out of the gallery list.

Tags are grouped into a few filter chips in `assets/js/gallery.js` (FILTERS). Reuse the existing
tags so a style lands in the right chip: text, 3d, product, explainer,
background, promo, retro, photos, data, social, brand, handmade, malaysia, festive, food,
travel, cute. The list order in
`styles.json` is the gallery order; mix looks so neighbouring tiles differ.

### Style prompts

A style prompt is general: the visitor writes their own video request in Claude and pastes the
style underneath. So a prompt never contains the visitor's content. It describes the look, the
motion, type and colour (with default colours, "use my brand colours if I give them"), and how
to fit any message. It asks for the final MP4 only.

Placeholders, filled from the page's video settings by `assets/js/prompt.js`:
`{size}` (for example "1080 x 1920 pixels (vertical 9:16)") and `{duration}` ("8 seconds").

Optional sound: a prompt may have a "Sound" section between "Type and colour" and "Output",
in exactly this form (the site parses it):

```
Sound
- Effects: <style-specific effects, timed to the motion>
- Music: <style-specific simple background music or ambience>
- Make every sound with code, so there is no copyrighted audio, and mix it into the MP4.
```

The Sound setting (Off, Effects, Effects + music) removes the section or the Music line.
It starts at Off on every style page and is not remembered.

Keep prompts in plain language with a one-line build hint. Claude knows how to render video, so
do not spell out the technical steps.

### Demos

Each `demo.html` must fit any window shape, because the preview is reshaped to the chosen format
(9:16, 4:5, 1:1, 16:9). Demos also accept `?text=` and colours `?bg= &ink= &accent= &accent2=`
(hex, no `#`) in the URL; the site does not use these at the moment.

Demos with sound make it with Web Audio (no files) and stay silent until the parent page sends
`postMessage({ type: "motionprompt-sound", on, music }, origin)`; `?sound=1` or `?sound=effects`
also turns it on for testing. Grid tiles never get the message, so they are always silent.
Sound must follow the animation clock and stop with reduced motion.

### Tiles

Gallery tiles do not run the live demo (too heavy with many on screen). Each shows `tile.webp` at
once, then plays `tile.mp4`, a 4 second seamless loop of the demo, while it is on screen. Reduced
motion and data saver get the still only. The live demo runs in the detail view.

Remake a style's tile whenever its demo changes, and for every new style (check.mjs fails without it):

```bash
node scripts/tiles.mjs <slug> [<slug> ...] [--base <site url>]
```

It needs Chrome, ffmpeg and puppeteer-core outside the repo (see the top of the script).
`"tileStart"` in styles.json sets where the loop starts in the demo (seconds, default 2): pick a
moment where the demo looks its best, because the first frame is also the still.

## Verify

```bash
node scripts/check.mjs     # must print OK
```

Local site: `https://motionprompt.test` (nginx, already running). Do not start any other web
server. In a cloud session there is no nginx; open files directly or rely on `check.mjs`.

## Git

- Default branch `main`. GitHub Pages publishes from `main` (root).
- Work on a branch and open a pull request. Never push straight to `main`.
