# Chess II visual handoff

The goal of the next pass is to bring the **Stone & Onyx** theme much closer to the supplied fantasy mockup **without changing game behavior or reintroducing clipping / duplicate-content bugs**.

## Where to work

For the aesthetic pass, prefer editing only:

1. `css/theme-stone-onyx.css`
2. files added under `assets/themes/stone-onyx/`
3. if absolutely necessary, small presentational markup additions in `index.html`

Avoid touching `js/game.js` unless a visual change truly requires a new state hook. The game logic is already functional.

## Existing semantic regions

The markup already supplies distinct live regions for:

- `.app-header` / `.brand-block` — title and app controls
- `#panelWhite`, `#panelBlack` — player banks
- `.bank .piece` — six live bank cards per side
- `.player-footer` / `.clock-block` — live time display
- `.board-shell` / `#board` — board frame and 64 live squares
- `.turn-console` — turn / mode status
- `.center-actions` — Undo / Restart / Exit
- `.history-panel` — live Move Log
- Settings and Rules modals

These are the correct things to "paint." Do not replace them with a screenshot or second visual copy.

## Critical architecture rule

**A changing game region must render exactly once.**

Do NOT:

- use the reference screenshot, or a crop of it, as a broad background behind a live panel if that crop contains pieces, squares, clocks, labels, move entries, or other game-state content
- place large decorative images above the board / banks with `z-index`
- use negative `inset` values to make a pseudo-element from one component cover neighboring components
- use `clip-path` on `.player-panel`, `.center-stage`, `.board-shell`, `.history-panel`, or another container if doing so can clip its live children
- absolutely position the clock or other footer over the bank card grid
- create a second DOM/canvas copy of live pieces, squares, clocks, or move history merely for appearance

These techniques caused the previous failures.

## Safe ways to add the mockup's richness

Good approaches include:

- material textures contained inside the component they decorate
- isolated corner ornaments / gems / icons
- `border-image` or 9-slice assets whose center is transparent and whose border does not cover the live content well
- CSS borders, shadows, gradients, and pseudo-elements that stay within `inset: 0` (or positive inset) of their own component
- separate tiny button icons or bezels
- replacing a CSS material with a seamless WebP texture
- adding decorative child elements specifically reserved for chrome, as long as they remain behind the content and within the same component box

## Visual target from the supplied mockup

Priority order:

1. **Panel silhouettes and depth** — White Bank should feel carved ivory stone; Black Bank carved onyx, with stepped frame detail and restrained gold trim.
2. **Card wells** — shallow carved plaques, not generic web cards. Pieces remain the visual hero.
3. **Board surround** — tighter and richer, with coordinates integrated into a physical-looking frame.
4. **Clock treatment** — physical clock object + prominent digital time; do not let it overlap cards.
5. **Title / gems / fine linework** — faceted blue gems and varied fine brass ornament.
6. **Buttons** — large, tactile, stone/metal controls with theme-native icons.
7. **Move Log** — compact horizontal ribbon, not a spreadsheet.
8. **Heatmap** — preserve the current luminous dot approach; strong blue/red signals with a small footprint so the stone board remains visible.

## Existing piece art

The 12 files in `assets/pieces/stone-onyx-renders/` are the current approved piece direction. Keep them unless deliberately replacing them with a clearly superior coherent set.

## Before handing back a revision

Check at a minimum:

- no decorative content appears twice
- no board square / piece / clock / label is visible underneath or above another version of itself
- bank cards remain fully clickable
- clocks do not intercept clicks on the lower bank cards
- board and coordinates are not clipped
- Undo / Restart / Exit remain clickable
- Settings and Rules still open
- switching Classic Slate ↔ Stone & Onyx does not alter game state
- viewport widths around 1600px, 1200px, 900px, and 390px do not create horizontal overflow

---

## 0_17 delivery notes

The pass above was completed in `Chess0_17`. Verified against the checklist
with a headless-browser harness: no duplicated decorative or live content;
bank cards, action buttons, and history nav hit-tested clickable; clocks do
not intercept the bottom card row; Settings and Rules open; Classic Slate is
untouched and theme switching preserves game state; no horizontal overflow at
any width from 390px to 1600px. The carved-panel silhouette uses fixed
clip-path geometry, so the ornate layout is gated to viewports ≥1380px and
degrades to the stable rectangular layout below that.

## 0_18 delivery notes

`Chess0_18` adds the **Neon** theme as a third selectable option (the settings
entry is no longer "planned"). It follows the same containment rules: all
decoration is per-component, scoped under `html[data-theme="neon"]`, with no
fixed-geometry layouts — the theme is fluid at every width. Three
presentation-only hooks now exist in `js/game.js`: `last-action` square
tagging, `hover-target` tagging of the hovered legal square, and a
`--clock-fraction` custom property on the clock blocks. Verified with the same
headless-browser harness as 0_17: hit-tested controls, working modals,
state-preserving theme cycling across all three themes, no JS errors, and no
horizontal overflow from 390px to 1600px.

## 0_19 delivery notes

`Chess0_19` adds the **Parchment** theme as a fourth selectable option (its
settings entry is no longer "planned"); Art Deco remains the only planned
theme. Parchment follows the same containment rules: decoration is
per-component, scoped under `html[data-theme="parchment"]`, with no
fixed-geometry layouts. Its laurel and sprig ornaments are generated SVG
(`assets/themes/parchment/`), and it reuses the existing `heading-rule`,
`clock-minute` and `hover-target` hooks rather than adding new ones — no
further JS changes were needed for this theme.

Two shared-CSS interactions worth knowing for future themes: `app.css` sets
`font-variant-numeric:tabular-nums` on `.clock-value` and
`.move-history-table`, which silently resets `lining-nums` (Playfair defaults
to old-style figures, so Parchment overrides with
`lining-nums tabular-nums`); and `.move-history-table` carries
`min-width:460px`, which must be neutralised by any theme that reflows the log
into a non-scrolling layout, or it forces page overflow on narrow screens.

Verified with the same headless-browser harness: hit-tested controls, working
modals, state-preserving cycling across all four themes, no JS errors, and no
horizontal overflow from 390px to 1600px in any theme.

## 0_20 delivery notes

`Chess0_20` adds the **Art Deco** theme, completing the picker — every listed
theme is now implemented and none are marked "planned".

Art Deco's frames are chamfered octagons with a double gold line, built from
nested `clip-path` polygons (element = gold, `::before` = marble face,
`.panel-gem` = inner hairline) rather than SVG frames, so they stay crisp at
any size instead of distorting when stretched. Fixed-size SVGs supply only the
motifs: sunray fan, sunburst, flourish and stepped corner brackets, all
generated in `assets/themes/deco/`. The page border is drawn with fixed
background layers on `body::before` — no click-intercepting overlay.

Two containment traps worth noting for future themes. Blanket child rules like
`.player-panel > *` outrank a later single-class rule on a specific child, so
positioned decoration must be excluded explicitly
(`> *:not(.panel-gem):not(.panel-point-gem)`); this silently forced
`position:relative` onto the sunburst and the bank count badge. And any hand or
needle that must pivot on a dial centre should be laid out as a grid item in
the dial's own cell with `align-self:start` and half the cell's height, so its
bottom edge lands on the centre — anchoring it to a sibling text element
instead leaves it stranded when that element is centred.

Verified with the same headless-browser harness: hit-tested controls, working
modals, state-preserving cycling across all five themes, no JS errors, and no
horizontal overflow from 390px to 1600px in any theme.

## 0_21 delivery notes

`Chess0_21` is a refinement release: no new themes, three quality passes.

**Audio.** The five global sound functions (`woodClick`, `errorMuffle`,
`parchment`, `breakCrunch`, `bell`) are now thin dispatchers over a
theme-keyed `SFX` table (action / deny / alert / shatter / end per theme),
selected live from `document.documentElement.dataset.theme`, so call sites
are unchanged and new themes only add a table entry. Shared `tone()` /
`noise()` primitives route through one master gain at 0.55 to keep the mix
headroom safe. Verification renders all twenty-five voices offline and
checks RMS > 0.002 and peak < 0.95.

**Piece renders.** All twelve renders were restored (shadow-skirt removal,
matte decontamination, speck removal, alpha firming); the untouched
originals sit alongside as `*.orig.png` and the pipeline is idempotent from
those backups. Any future re-render should go through the same pass before
shipping.

**Parchment / Art Deco polish.** Parchment moved to a full-width header bar
and a larger scale throughout; Art Deco gained near-black marble squares,
taller cards, symmetric crest fans and frame diamonds. One trap fixed on the
way: the ornament generators wrote to absolute paths that still pointed at
the pre-rename folder, silently recreating a ghost directory — generator
output paths must be updated whenever the build folder is renamed.

Verified as before: hit-tested controls, working modals, state-preserving
cycling across all five themes, no JS errors, no horizontal overflow from
390px to 1600px in any theme, and the offline audio-render check above.

## 0_22 delivery notes

Fixes from review feedback.

**Board geometry (two real bugs).** `.board` used `repeat(8,1fr)`; a `1fr`
track has an `auto` minimum, so each placed piece image raised its row's
min-content height and the grid grew as the game went on. Tracks are now
`repeat(8,minmax(0,1fr))` and `.sq` carries `min-width/min-height:0`. Second,
the shell's middle row was pinned to `minmax(0,var(--board-max))` while the
board's width came from the column, so squares rendered rectangular
(e.g. 80x89). The middle row is now `auto`, letting the board's own
`aspect-ratio:1/1` set it. Verified: squares are exactly square and geometry
does not drift by even 0.1px across six placements, in all five themes.
Boards were enlarged (~700-716px) and board pieces scaled down to match.

**Clock dials.** Hand angles were `-28deg + elapsed*310deg` — an arbitrary
sweep that agreed with nothing. Hands now read the clock like a stopwatch:
`--clock-second-angle` is one sweep per minute, `--clock-hand-angle` is
minutes, both at 12 o'clock at 0:00, so the dial corroborates the digits
(15:00 puts the minute hand at 90deg). Themes bind their long hand to
`--clock-second-angle` instead of `hand-angle * 12`. Art Deco's hands were
also mis-pivoting: they were grid items sized to half the dial with
`align-self:start`, which only lands on the centre if the row is exactly the
dial's height — the taller clock text pushed them ~3px high. They are now
full-dial boxes pivoting on their own centre, immune to row height.

**Piece geometry.** 0_21 fixed contamination; the remaining defects were
sculpt-level and inherent to the renders (confirmed: the cleanup pass removed
0.0% of base mass, so it was not the cause). The footing of most pieces was
ragged and asymmetric (white queen worst). `piecegeo.py` re-cuts the footing
to a fitted elliptical arc — trim-only, biased to the shallow side, extending
a column only when it falls short by <=4px. Note for future work: unioning a
silhouette with its mirror was tried and rejected — on an off-axis render it
doubles the form and mirrors the lighting.

**Audio.** Stone & Onyx's action was a low-passed thud; it is now a hard
marble knock (bright transient, brief pitched ring, minimal body) — measured
brightness rose from ~13 to ~96 zero-crossings. Neon was re-voiced from
chirpy arcade to tactical: codec-blip actions, a low denial buzz, an
alert sting with a tense minor-second pair, a heavy impact shatter, and a
sombre minor cadence at game end.

**Generator paths.** `decogen.py` / `laurelgen.py` had absolute output paths
that went stale on every folder rename, silently recreating ghost
directories and serving stale ornaments. They now resolve the newest
`Chess0_*` directory at run time.

## 0_23 delivery notes

**Piece set replaced.** The previous twelve renders were effectively twelve
separate generations — ivory and onyx bishops had different bases, the two
knights had different silhouettes (IoU 0.89), and the mismatch was visible
everywhere. They are replaced by a single supplied sheet: one sculpt set in
two materials, so structure is shared and only material differs. `pieceset.py`
segments the sheet (it ships with a clean alpha channel), un-mixes any white
matte from edge pixels, and composes all twelve onto one canvas size at one
global scale, bottom-aligned to a common baseline.

Because true relative heights now survive in the art (pawn 0.67, king 1.00),
every theme's per-type `.glyph` width hacks were deleted — all pieces use a
single width and the proportions come from the sculpt. Any future set should
be built the same way. The old `piecefix.py` / `piecegeo.py` repair passes are
obsolete for this set and are no longer part of the build.

**Clock dials, root cause.** Hands sat several pixels off the dial centre in
three themes. The dial pseudo-elements were `content-box`: a `*{box-sizing}`
reset does **not** match `::before`/`::after`, so a 102px dial with a 4px
border occupied 110px and its centre fell 4px below the hand pivot (5px in
Parchment). Each dial now sets `box-sizing:border-box` explicitly. Worth
checking on any new themed dial.

**Parchment.** Heat markers were near-indistinguishable on cream; friendly and
enemy coverage now differ by hue *and* shape (green circle vs rust diamond),
so they stay legible without relying on colour alone. The status console's
chips could overflow the card because the flex child holding the detail text
had `min-width:auto` and could not shrink — fixed with `min-width:0` plus
`overflow:hidden` on the console.

**Stone action sound.** The previous knock read as a tin can: a sustained
1-4kHz partial is what makes a click sound thin and metallic. It is now a dry
stone knock with a fast broadband transient and mid body, no ringing tail.

Note on hit-test verification: with the larger boards, elements below the fold
report as unclickable unless the harness scrolls them into view first. Use
`hittest.js`, which does. Stone & Onyx hides the event log by design, so it
correctly reports no box there.
