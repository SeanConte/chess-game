# Chess0_23 — Unified piece set, centred dials, legible heatmap

This build contains four fully art-directed themes, each matching its approved
mockup — **Stone & Onyx** (carved fantasy plates), **Neon** (holographic HUD),
**Parchment** (warm editorial print), and **Art Deco** (gold on black marble)
— alongside the untouched **Classic Slate** baseline. Every theme in the
picker is now implemented; none are marked "planned". All five share the same
information architecture and the single-render rules in `FABLE_HANDOFF.md`.

New in 0_21-22: theme-matched sound design for every theme; a two-stage
restoration of the piece renders (contamination, then sculpt geometry); a
polish pass on Parchment and Art Deco; and two board-layout fixes — the grid
no longer stretches as pieces are placed, and the squares are now exactly
square. Clock dials read like a stopwatch, so the hands agree with the digits
beside them.

## Project layout

- `index.html` — semantic application structure (plus small `aria-hidden`
  decorative hooks, class `deco`, hidden outside themed views)
- `js/game.js` — game state, rules, rendering, clocks, AI, undo, theme
  switching, and the theme-aware sound system. Presentation-only hooks, no
  behavior changes: the previous action's square is tagged `last-action`; the
  hovered legal target square is tagged `hover-target`; and the live clock
  fraction is exposed as `--clock-fraction`.
- `css/app.css` — shared layout / component behavior used by all themes
- `css/themes.css` — shared design tokens and Classic Slate values
- `css/theme-stone-onyx.css`, `css/theme-neon.css`, `css/theme-parchment.css`,
  `css/theme-deco.css`
- `assets/pieces/stone-onyx-renders/` — 12 approved piece renders, restored
  in 0_21 (see below), with `*.orig.png` backups alongside; Neon, Parchment
  and Art Deco re-grade them (chrome/violet, warm ivory/ink, and gilded
  marble) with CSS filters
- `assets/fonts/` — Cinzel, Orbitron, Rajdhani, Playfair Display, and
  Source Sans 3, all bundled under the SIL Open Font License (see OFL-*.txt)
- `assets/themes/stone-onyx/` — textures, gems, generated panel line art
- `assets/themes/parchment/` — generated laurel and sprig ornaments
- `assets/themes/deco/` — generated sunray fan, sunburst, flourish and
  stepped corner brackets

## Theme notes

**Stone & Onyx** — carved ivory/onyx plates with ogee-scalloped silhouettes,
bronze rims, engraved hairline frames and chevron gems; Cinzel typography;
physical clocks; integrated board frame with gold coordinates. The
fixed-geometry plate layout engages at viewports ≥1380px and falls back to the
stable rectangular layout below.

**Neon** — holographic HUD: cyan circuitry for White, magenta/violet for
Black; outlined panels with corner brackets; digital clocks with tick-ring
dials, live hands, and a charge bar driven by the real clock fraction;
octagon-chamfered action buttons; a target reticle on the hovered legal square
with soft attack-coverage tints; move-log ribbon with a glowing current-move
box and the event log presented as a HUD popover.

**Parchment** — warm editorial print: cream paper, white cards with soft
shadows, olive for White and terracotta for Black. Playfair Display (with
lining figures) for the wordmark, headings, caps labels and numerals; Source
Sans 3 for helper copy. Laurel branches flank the wordmark and a sprig motif
sits on the divider rules, the clock rule, the turn counter and the move-log
header — all generated as SVG by sampling a bezier stem and placing leaves at
computed angles. Ring clocks with live hands, an olive last-move square,
outlined buttons with a terracotta Exit, and the move log as a wrapping grid
of numbered cells with the current move highlighted.

**Art Deco** — gold on black marble: every frame is a chamfered octagon with
a double gold line, built from nested clip-paths so it stays crisp at any
size. Cinzel caps in a gilded gradient for the wordmark and labels; Playfair
lining figures for clocks and the log. Bank pieces sit on gold-framed marble
tiles with engraved nameplates and corner count badges; a sunray fan flanks
the title, a sunburst closes each side panel, and stepped brackets mark the
board, log and page corners. The move log runs four rows deep in columns with
gold `W:` and copper `B:` prefixes, and the status bar is a diamond-flanked
gold cartouche.

Neon, Parchment and Art Deco are fluid at every width. All themes verified: no duplicated
live content, all controls hit-tested clickable, modals functional, theme
switching preserves game state, and no horizontal overflow from 390px to
1600px wide.

## Sound design

Each theme carries its own five-voice sound set — action (select / place /
move), deny (illegal action), alert (threat warning), shatter (elimination),
and end (game over) — synthesized live with WebAudio, no samples:

- **Classic Slate** keeps the original neutral studio set.
- **Stone & Onyx** — stone mass: a hard marble-on-marble knock for actions, a
  beating low drone for threats, crack-and-rubble eliminations, and a
  three-partial cathedral bell at game end.
- **Neon** — tactical espionage: codec blips, a low denial buzz, an alert
  sting resolving onto a tense minor second, a heavy impact for
  eliminations, and a sombre minor cadence at game end.
- **Parchment** — the study: felt-on-wood taps, a soft double "tut",
  page-turn crinkles for threats, a paper tear for eliminations, and a small
  brass desk bell.
- **Art Deco** — the lounge: a marble tick with a piano-ish ping, a
  muted-brass "wah", a two-note brass motif for threats, glass over marble
  for eliminations, and a rolled major-sixth fanfare.

All twenty-five voices are exercised in verification by rendering each
through an OfflineAudioContext and measuring RMS and peak.

## Board geometry

The board grid uses `minmax(0,1fr)` tracks so piece images cannot inflate
their row, and the shell's middle row is `auto` so the board's own 1:1
aspect ratio governs — squares are exactly square and the geometry is stable
as pieces are placed. Boards render around 700px with pieces scaled to sit
comfortably inside a square.

## Piece set

All twelve pieces come from a single supplied sheet — one sculpt set rendered
in two materials — so ivory and onyx share structure exactly and only the
material differs. They are composed onto one canvas size at one global scale
and bottom-aligned to a common baseline, which preserves true relative
heights (pawn 0.67, king 1.00). Themes therefore use a single glyph width and
let the art carry the proportions; per-theme character comes from CSS
grading, never from altering structure.

## Local testing

Usually, unzip the folder and open `index.html`.

If your browser restricts local assets, run a local server inside this folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.
