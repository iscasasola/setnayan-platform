## 2026-09-05 · fix(mood-board): "In your colors" tells the truth (MB23)

Owner's bug report, verbatim: *"we do not have a design yet for the palette and there are already
samples on in your colors."* A couple who had chosen nothing saw fully coloured figures and a
random stock photograph labelled "Ceremony". Every colour on that screen was one they did not
choose — while the caption underneath read "Set this palette above to see it here."

Owner ruling, same day: **"In your colors" is RECOLOURED DRAWINGS ONLY** — never a photograph,
never a Make-it-real render, never another couple's anything.

### Attire recolours, and the reason it did not was a SELECT

`page.tsx`'s attire query asked for `asset_subtype, label, storage_path` and never for
`moodboard_asset_color_ranges`, so `attireCards` had no `regions` and `BoardCardView.recolorable`
was false for every attire card. All 75 live figures already carried tagged ranges.

⛔ **Two comments said otherwise, and they were false.** `moodboard-board.tsx`'s header and the
`page.tsx` attire query both claimed the figures were "on a no-CORS host, so they can't be
canvas-recolored". Measured 2026-09-05 — the R2 host echoes `https://www.setnayan.com`,
`https://setnayan.com`, `*.vercel.app` (including per-branch preview URLs) and
`http://localhost:3000`. Both comments are replaced by the measured fact and the one-line curl
that re-measures it, and a guard now allows the old claim to appear **only inside a comment block
that refutes it**.

The allowlist is precise rather than permissive. `setnayan.ph` and `www.setnayan.ph` get no
`Access-Control-Allow-Origin` at all — which is **correct**, because we do not own that domain
(owner, verbatim 2026-08-11: *"we do not have setnayan.ph"*). Recorded only so the next session
does not read the absence as a gap; nothing to fix.

### No palette → no colour

`BoardCardView` now renders an honest empty when `paletteColors` is empty: the same drawing, from
the same source, desaturated to neutral greys through the same canvas path. Verified in a real
browser render — **max saturation 0 on every one of the eight cards**. If the drawing cannot be
painted at all (load failure, tainted canvas) the card shows its caption alone; it never shows the
stock-coloured figure.

### The placeholder photographs come down

Migration `20271205919528` sets `retired_at` on every `moodboard_library_assets` row that is
`source = 'internet_placeholder'` or hosted on picsum. On prod that is the two live `venue_scene`
rows (church + reception); the ten `figure_attire` ones were already retired. **Retired, never
deleted** — a seeded photo is never deleted (owner decisions, 2026-09-04).

With no live `venue_scene`, `churchRow` is undefined and the Ceremony card does not build. That is
the intended end state. **Owner owes one Ceremony drawing** (SVG, colour regions tagged) before the
card returns; nothing substitutes a photograph.

`lib/moodboard-library-placeholder.ts` carries the rule and `approveAsset` refuses on it, so the
retirement cannot be undone by a click.

### 🔑 The white, measured rather than assumed

All 40 figures behind the 8 cards were rasterised at the component's own `MAX_PREVIEW_PX` (520)
and pushed through the real `recolorRGBA`. **10 carry an opaque background rect; in 4 of them it
fell inside the slot's tolerance and 100% of the outer frame recoloured** — the gown and the page
behind her both turned burgundy.

Three are fixed in the DATA (re-sampled from the garment, tolerance set below that file's measured
distance to its own background): `bridgerton-regal/groom` → `#E7C99F/12`,
`tropical-heritage/male_ps` → `#F7D79E/12`, `bridgerton-regal/male_ps` → `#F4DDAC/10`.

⚠ **The fourth is not a tolerance problem.** `modern-minimalist/bride` draws the gown in `#ECEBE7`
— the *same colour*, ΔE 0.0, as its own background rect, across 76.6% of the figure column. No
range can isolate the dress. The migration **deletes** that range rather than inventing a value for
it, and the representative-figure pick now prefers a variant that has one. Re-cutting that artwork
is an owner decision.

Also measured: the old `#FAFAFA ± 15` on that file matched the background (ΔE 6.0) and **missed the
gown** (ΔE 15.6) — the couple's colour would have landed on everything except the dress.

Verified in a real browser render on an allowed origin: backgrounds at max saturation 7–9
(unchanged from source), garments at 56–137 across 11–94% of each card.

### Guards (each seen red under sabotage before landing)

- `attire-recolours-because-the-query-asks.test.ts` — the SELECT asks, `attireCards` passes,
  the pick prefers a recolourable variant, `crossOrigin` is set, the false claim stays refuted.
- `the-background-never-wears-the-palette.test.ts` — per-region pixel assertions over the real
  engine; **slot values are PARSED out of the migration**, not restated.
- `no-palette-means-no-colour.test.ts` — mounts `BoardCardView` with `paletteColors: []`.
- `tests/db/no-placeholder-photo-is-ever-live.db.test.ts` — retired, not deleted, nothing else hit.
- `lib/moodboard-library-placeholder.test.ts` — the rule, and that `approveAsset` calls it
  **before** the UPDATE.

Two of these were **written wrong first and caught by their own sabotage pass**: the pixel guard
restated the migration's tolerances (tightening them all to 1 left 22 assertions green), and the
comment guard used a ±600-character window that reached into the neighbouring docblock and borrowed
its "FALSE". Both are recorded in the files.

SPEC IMPACT: None. Owner ruling of 2026-09-05 ("In your colors" = recoloured drawings only) is
already carried in `build-sessions/MB23.md`; no `DECISION_LOG.md` row changes. One item for the owner is
surfaced in the PR body rather than the corpus: the Ceremony drawing.
