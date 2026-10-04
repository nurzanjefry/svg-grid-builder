[![tests](https://github.com/nurzanjefry/svg-grid-builder/actions/workflows/test.yml/badge.svg)](https://github.com/nurzanjefry/svg-grid-builder/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

# svg-grid-builder

**Click cells on a grid. Get a clean, hand-editable SVG.**

A single-file web app for drawing pixel art, icons and glyphs on a grid of
boxes and exporting them as vector SVG. No build step, no dependencies, no
server — open one HTML file and start clicking.

Works with a mouse, a trackpad, a stylus or your finger, and every change is
mirrored live into a real `<svg>` document you can copy or download.

---

## Try it

- **Hosted demo:** `https://nurzanjefry.github.io/svg-grid-builder/`
  (enable GitHub Pages on `main` / root — see [Deploying](#deploying))
- **Locally:** download `index.html` and double-click it. That is the whole app.

```powershell
# or from a terminal
Invoke-Item .\index.html
```

Nothing is uploaded anywhere. It runs entirely in the browser, and it works
offline.

---

## Features

**Drawing**

- Click or drag to paint; the stroke follows your pointer, so you can sweep
  whole regions in one gesture
- Right-click to erase, or pick the eraser tool / press `E`
- Clicking a cell that is already the current colour erases it (toggles off)
- 18-colour palette plus a full colour picker
- Fill every cell at once, or clear the grid — both undoable

**Grid**

- Any size from 1×1 to 128×128, not just squares
- Presets: 8×8, 16×16, 24×24, 32×32, 48×32, 64×64
- Resizing keeps your existing art, anchored to the top-left
- Zoom the editing view from 6px to 48px per cell, and toggle grid lines —
  neither affects the exported SVG

**Editing**

- 120 steps of undo/redo
- Flip horizontally, flip vertically, rotate 90° (rotating a non-square grid
  swaps its dimensions, as you would expect)

**Output**

- Live SVG preview and source, updated as you draw
- Copy to clipboard, or download as `.svg`
- Save and load grids as plain JSON
- Debounced autosave to `localStorage`, so a refresh does not lose your work

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `P` | Paint with the current colour |
| `E` | Erase |
| `B` | Paint (alias for `P`) |
| `C` | Clear the grid (undoable with `Ctrl+Z`) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |

Modifier chords are deliberately excluded from the single-letter shortcuts, so
`Ctrl+C` still copies instead of clearing your work. Keys pressed while a form
field has focus (for example the grid-size box) are ignored.

---

## What the SVG looks like

The exporter does not emit one `<rect>` per cell. It merges filled cells into
as few rectangles as possible in two passes — first collapsing each row into
horizontal runs, then stacking vertically-adjacent runs that share the same `x`
and width.

This 7×6 heart is 27 filled cells, and exports as **6 rectangles**:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="7" height="6" viewBox="0 0 7 6" shape-rendering="crispEdges">
  <title>grid-7x6</title>
  <desc>Pixel grid 7x6. One rect per merged run of same-coloured cells; empty cells are transparent.</desc>
  <g fill="#e0245e">
    <rect x="0" y="1" width="7" height="2"/>
    <rect x="1" y="0" width="2" height="1"/>
    <rect x="1" y="3" width="5" height="1"/>
    <rect x="2" y="4" width="3" height="1"/>
    <rect x="3" y="5" width="1" height="1"/>
    <rect x="4" y="0" width="2" height="1"/>
  </g>
</svg>
```

Two of those rows were identical full-width runs, so they became a single
`height="2"` rectangle. On a larger drawing the saving is substantial: a solid
32×32 block is 1024 cells and exports as a single `<rect>`.

Cells are emitted at 1 unit each, so the grid is `viewBox="0 0 W H"`. Scale it
with CSS or change `unit` in the writer if you want a different intrinsic size.

---

## Grid files

**Save .json** writes a plain, diffable document:

```json
{
  "width": 3,
  "height": 2,
  "pixels": ["#e0245e", null, "", "#111827", "#e0245e", null],
  "format": "click-grid-v1"
}
```

- `pixels` is row-major and must contain exactly `width × height` entries
- Each entry is a `#rgb` or `#rrggbb` string, or `null` / `""` for an empty cell

**Load .json** validates before touching your canvas: dimensions must be whole
numbers from 1 to 128, the pixel count must match, and every value must be a
valid hex colour. A malformed or hostile file is rejected with a readable
message rather than corrupting the grid.

---

## Running the tests

The app is one self-contained HTML file with no module boundary, so rather than
importing it, the suite pulls the real functions and the real `keydown` handler
out of `index.html` by their source text and exercises those. The tests
therefore run against shipped code — not a retyped copy that could quietly
drift away from it.

```bash
node test.js
```

**77 checks**, covering:

- **SVG merging** — solid blocks, horizontal runs, vertical stacking, cases
  where merging must *not* happen, colour separation, plus an invariant check
  that merged rectangles preserve the filled area exactly and never overlap
- **JSON validation** — every rejection path, including a script-injection
  attempt in a colour field
- **DOM wiring** — every `$('id')` the script references actually exists in the
  markup, which is the most likely way to break the app at boot
- **Keyboard shortcuts** — the real listener is invoked with synthetic events,
  asserting that `P`/`E`/`C` work and that `Ctrl+C`, `Cmd+C` and `Alt+C` do
  **not** clear the grid
- **Canvas centring** — the layout rules, including the `margin:auto` that
  keeps an oversized grid reachable by scrolling

No dependencies, no install step. Node 18+.

---

## Deploying

The app is static, so GitHub Pages serves it with no configuration:

1. Push this repo to GitHub
2. **Settings → Pages**
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`
4. It goes live at `https://nurzanjefry.github.io/svg-grid-builder/`

`index.html` at the repo root is why no further setup is needed.

CI runs `node test.js` on every push and pull request via
`.github/workflows/test.yml`.

---

## Project layout

```
.
├── index.html                     the entire application
├── test.js                        77-check suite, no dependencies
├── LICENSE
├── NOTICE                         third-party attribution
├── .gitignore
└── .github/
    └── workflows/
        └── test.yml               runs the tests on push
```

## Browser support

Targets modern evergreen browsers. The features that set the floor are Pointer
Events, `replaceChildren`, and CSS `aspect-ratio` — roughly Chrome/Edge 86+,
Firefox 78+, Safari 15+. The app degrades politely rather than erroring on
older browsers, but it is not tested against them.

`localStorage` is unavailable under `file://` in some browsers; it is wrapped in
`try`/`catch` so it fails silently. Use **Save .json** for anything you care
about when working from a local file.

---

## Credits and prior art

**This project adapts code from Gridsmith, and that attribution is a license
condition, not a courtesy.** The two-pass run-merging strategy in
`mergedRects()` — horizontal runs first, then vertical stacking of matching
runs — is adapted from Gridsmith's `gridToSvg()`:

> **Gridsmith**
> Copyright (c) 2026 Martial Systems LLC
> Licensed under the MIT License.
>
> Gridsmith is a retro pixel-art to SVG editor and library, by Martial Systems
> LLC / Martial Games. This project is an independent implementation and is not
> affiliated with, endorsed by, or sponsored by them.

The specific adaptation is documented in a comment at the top of the function in
`index.html`, and the full notice is reproduced in [`NOTICE`](NOTICE).

**Prior art that informed the project.** These were surveyed while designing
this tool. No code was taken from any of them — they are credited because they
shaped what this app does and does not try to be:

- **svg-pixel-editor** by TheRealSmeddy — MIT. The closest existing tool: a single-file pencil/eraser grid that exports SVG.
- **pixel-forge** by BataJini — MIT. A far more ambitious client-side pixel editor with layers, frames and GIF export.
- **Widget-Pixel-Art-Editor** by XerVth — ISC. Similar feature set, but packaged as an Electron desktop app rather than a web page.

**Deliberately not used.** Two of the most visible projects in this space ship
**no license at all**, which under default copyright means the code is not
legally reusable regardless of it being publicly readable:

- **SvgPixelArt** by jerosoler — ~28 stars, no `LICENSE` file.
- **logo-designer** by JuliusBrussee — ~44 stars, no `LICENSE` file.

If you are building in this area, check for a license before you copy.

---

## Contributing

Issues and pull requests are welcome. If you change behaviour, please run
`node test.js` and add a check for it — the suite exists to stop the subtle
things regressing, particularly the SVG merging and the modifier-key handling.

## License

[MIT](LICENSE) © 2026 nurzan — with third-party attribution in [NOTICE](NOTICE).
