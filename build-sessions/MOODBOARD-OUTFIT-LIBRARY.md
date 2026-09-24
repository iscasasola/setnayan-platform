# MOODBOARD-OUTFIT-LIBRARY — recolourable sample outfits for "In your colors"

> ⏸ **DO NOT OPEN YET.** Owner, 2026-09-21: *"we will do it next time."* Parked by the Mood board
> session [0d96e1] for the Overall Controller to schedule.
>
> **Model · effort:** Opus · high for step 1–2 (asset generation + owner review is judgement-heavy);
> a build session for step 4+ can run Sonnet · medium.
> `cd ~/Documents/Claude/Projects/setnayan-platform && claude --model claude-opus-5`

## What already shipped (do not rebuild)

- **PR #5826** `claude/guest-colors-are-options` — at time of writing OPEN, CI 15/16 green, auto-merge
  armed. Re-check with `gh pr view 5826`. It adds a required `meaning` on `PALETTE_LIMITS`
  (`lib/mood-board.ts`): every attire key is `outfit` (color 1 = **Main**, color 2 = **Accent**, labelled
  in the editor via `OUTFIT_SLOT_LABELS`); only `guest` is `options` — "In your colors" draws one
  figure per guest color. Guard: `guest-colors-are-options.test.ts`. Decision row appended to the
  corpus `DECISION_LOG.md` (2026-09-21, 🎨 ATTIRE COLORS).
- The recolour engine: `lib/color-recolor.ts` + `_components/recolor-studio.tsx`; admin tagging at
  `app/admin/moodboard-library`. Areas are found by COLOUR (sampled hex ± tolerance), so a figure
  drawn with flat, distinct fills tags exactly.
- Per-role outfit style list: `ATTIRE_STYLES` in `lib/role-dress-code.ts` (long_gown · cocktail_dress ·
  filipiniana · barong_tagalog · suit · formal · smart_casual), set in the dress-code editor
  (`dashboard/[eventId]/website/dress-code`), shipped 2026-09-20.

## Measured problems this plan answers

1. **The accent is never painted.** All 75 live `figure_attire` rows carry exactly ONE colour range
   (`region_label = 'attire'`) — measured on prod 2026-09-21:
   `select a.asset_subtype, count(distinct r.slot_id) from moodboard_library_assets a join moodboard_asset_color_ranges r using (asset_id) where a.asset_type='figure_attire' and a.retired_at is null group by 1;`
   So a couple's Accent is a swatch and a label only.
2. **Figures are sorted by role, not by outfit.** 15 role subtypes × 5 style families. There is no
   Barong figure a Ninong-set-to-barong can show, etc.
3. **The event-level dress-code list does not exist in the app** (White Tie … Other) — searched app,
   lib, migrations and the corpus.

## Owner decisions (2026-09-21, verbatim where quoted — do not re-ask)

- *"for everybody except the guests, it is main color + accent color"* — incl. Bridesmaids/Groomsmen.
- Wants *"a collection of 1 and 2 tone outfit for everybody except the guests"*, one sample outfit per:
  - Men: Casual · Smart Casual · Suit and Tie · Barong Tagalog
  - Women: Cocktail · Dress · Long Gown · **Filipiniana** (added mid-message)
  - Event dress code: White Tie · Black Tie · Traditional · Formal · Cocktail · Semi-Formal ·
    Smart Casual · Casual · Other
- **Traditional = Barong + Filipiniana.** Regional/other attire → listed under **Other**.
- **The event-level dress code REPLACES the per-role style picker.** ⚠ Load-bearing: that picker
  (`ATTIRE_STYLES`, `dress_code_config.roles`) shipped 2026-09-20 and feeds the guest invitation's
  "what YOU wear" panel (`resolveGuestDressCode`, guarded by `each-role-wears-its-own.test.ts`).
  **Confirm the scope with the owner before removing anything** — read it back as a one-line
  "this retires X; the invitation will then say Y" and get a yes.
- Asked whether a pack could be bought: searched. **Nothing online fits** (below). Owner chose to
  **generate with Recraft**, 3 samples first.

## Online search result (2026-09-21) — why we generate instead of buy

- Closest: Etsy **GASCEStudio "Wedding Guest Attire Clipart Bundle"** (listing 4504584139, ~₱1,010):
  270 watercolour PNGs in 10 FIXED palettes, guests only, no barong/filipiniana, no bride/groom.
  Pre-painted watercolour cannot be recoloured cleanly by a colour-range engine. Licence allows
  "templates … websites" but forbids redistributing the files — serving to every couple (and in
  PDFs) would need the seller's written OK. Owner's reference image for the LOOK was from this shop.
- Freepik/Magnific barong-filipiniana: ~5 cartoon vectors, mismatched styles. iStock/Envato: plenty
  of Western dress-code vectors, but mixed artists.
- ⛔ Do not copy the GASCEStudio (or the owner's own invitation vendor's) figures.

## Proposed library (one art style first, ~12 figures; the other 4 families later)

Every figure: slim faceless fashion-croquis, front view, white background, garments in **two flat
distinct fills** — MAIN and ACCENT — so each is one tight colour range. One colour chosen → the whole
outfit takes it (current `autoEdits` cycling); two → accent area gets colour 2.

| Men | Main | Accent |
|---|---|---|
| Casual (shirt + trousers) | shirt | trousers |
| Smart casual (long sleeve + blazer) | blazer | shirt |
| Suit and tie | suit | tie + pocket square |
| Barong Tagalog | barong | trousers |
| Tuxedo (Black Tie) | jacket | bow tie |
| Tailcoat (White Tie) | coat | waistcoat |

| Women | Main | Accent |
|---|---|---|
| Casual dress | dress | belt / cardigan |
| Cocktail dress | dress | sash / belt |
| Long gown | gown | sash / wrap |
| Filipiniana | terno | butterfly sleeves / panuelo |
| Ball gown (White Tie) | gown | bodice / gloves |

Dress-code level → figures: White Tie → tailcoat/ball gown · Black Tie → tuxedo/long gown ·
Formal → suit & tie/long gown · Traditional → barong/filipiniana · Cocktail & Semi-Formal →
suit/cocktail dress · Smart Casual → smart casual/cocktail dress · Casual → casual/casual dress ·
Other → couple's note, no figure.

## Steps

1. **Recraft key (owner action).** `RECRAFT_API_KEY` is NOT set anywhere on this machine (checked
   `~/.claude/settings.json`, shell rc files). The recraft skill's claim that it is loaded is stale.
   Owner runs (never paste the key into chat):
   `read -rs "k?Recraft key: " && echo "export RECRAFT_API_KEY=\"$k\"" >> ~/.zshenv && unset k && echo " saved"`
2. **Generate 3 samples** — Barong, Filipiniana, Long gown — `recraftv3`, `vector_illustration`,
   `1024x1536`, n=1 each. Prompt = subject line + common block (each under 1000 chars):
   - Barong: *"A Filipino man wearing a Barong Tagalog (sheer long-sleeve embroidered formal shirt,
     untucked) with straight trousers and black shoes. MAIN color: dusty rose on the whole barong,
     with fine same-color embroidery lines. ACCENT color: deep burgundy on the trousers."*
   - Filipiniana: *"A Filipina woman wearing a floor-length Filipiniana terno gown with stiff upright
     butterfly sleeves and a fitted bodice. MAIN color: dusty rose on the gown skirt and bodice.
     ACCENT color: deep burgundy on the butterfly sleeves and a thin waist sash."*
   - Long gown: *"A Filipina woman wearing an elegant floor-length formal gown with a V-neckline and
     flowing skirt. MAIN color: dusty rose on the whole gown. ACCENT color: deep burgundy on a wide
     satin waist sash tied at the side."*
   - Common: *"Elegant fashion illustration, single full-body figure standing, front view, slim
     fashion-croquis proportions, faceless simple head with dark hair, plain pure white background,
     no text, no shadow on the ground. Clean flat vector style: every garment area is ONE solid flat
     color with only very subtle shading, crisp edges, no gradients, no texture, no pattern. Exactly
     two garment colors: MAIN color and ACCENT color, clearly separated."*
   Send to the owner (SendUserFile) and get a style verdict before generating more.
3. **Prove recolourability before scaling:** tag MAIN + ACCENT on each sample and render it through
   `RecolorStudio` with 2–3 real palettes. Watch for: white/ecru main colliding with the background
   (the MB23 `modern-minimalist/bride` trap), skin tones inside a range's tolerance, and embroidery
   lines. Remember [[presence-of-ink-is-not-fit-of-ink]] — assert WHERE colour landed, not that it did.
4. **Generate the rest** (~12 total), owner approves each.
5. **Build** (separate PR, after step 5's scope confirmation): event-level dress-code setting,
   figures keyed by outfit style, "In your colors" picks the figure from the style, MAIN + ACCENT
   ranges seeded by migration (via the pipeline — never applied directly to prod).

## Still open for the owner

- Confirm "replace" scope (see ⚠ above).
- Bridesmaids / Groomsmen / Wedding Party still have `min: 3` (soft editor warning) from the old
  "coordinated palette" meaning — relax to 1? Lowering `max` is NOT safe (sanitize clamps saved
  palettes).
- Existing 75 figures: add accent ranges to them, or retire them once the new library lands?
