## 2026-09-25 · feat(event-hub): your own background, and the theme follows its colours (Maker Phase 10, part 1 — adaptive theme)

The Maker's **Main** ("behind every scene") gains **Your own background**: a couple swaps their theme's
moving loop for their own short clip or photo, and — the adaptive theme, owner 2026-09-25 *"Adaptive
theme is for PRO – i like this"* — the theme's **button, accent and ornament** move toward the colours of
their footage. Fonts, ornament shapes, the reveal, transitions and motion do not change. All in the
browser: no server, no migration, no new server action. The five signature reveals are separate PRs.

- **`lib/adaptive-theme.ts` (new, pure).** `measureFrame` turns a frame's pixels into its dominant colours
  plus the lightest and darkest 5 % clusters (the same method as the theme loops' measured samples; never
  padded). `frameCast` finds the footage's hue in OKLab (grey footage → none). `mainGroundLegibility`
  re-measures the theme's own ink over the frame and raises a paper-coloured scrim until body text is
  WCAG AA over every measured colour (free — drawn whatever the toggle says); past 50 % it advises a
  calmer clip. `adaptiveTint` moves the button / accent / ornament onto the footage's hue with
  `oklchOfHex`/`hexOfOklch`, walking lightness away from the paper until each keeps its contract (button
  ≥ 4.5:1 under its paper label; accent ≥ 4.5:1 on the paper AND over the veiled frame) — a colour that
  cannot is not tinted. `adaptiveThemeVars` emits the same tokens the theme blocks paint through
  (`--color-mulberry*`, `--color-gild`, `--color-terracotta*`, `--hub-accent*`, `--accent`); `{}` when the
  couple keeps the theme's colours, and a couple's own button colour outranks the tint.
- **Storage — `canvas.tint` on the Main background.** The Main background is `config_json.main` on the
  event's HERO row (`hubMainGround` / `sanitizeHubMainGround` in `lib/hub-canvas.ts`): `{ kind: photo |
  snippet, media, poster?, tint?: { match, frame } }`, every ref behind the same `hubMediaRef` public-bucket
  fence. `tint` stores the measured FRAME and the toggle, never tinted hexes — the tint is re-derived at
  render from frame × theme, so changing theme later cannot leave a stale colour.
- **The draft.** `widgets.hero.main` rides `event_site_drafts` (dropped on any other section);
  `overlayHubDraftWidgets` shows it in the host preview; `classifyHubDraft` → `mainGroundChange`: own
  media and the colour toggle are Pro (try in the draft, pay at Apply), going back to the theme's own is
  free. Apply (`hubDraftAction`) holds the clip and still to this event's `main-background/` uploads
  (`not_your_photo`) and merges `main` beside `canvas`, both into one `config_json` patch.
- **The guest page.** `app/[slug]/_components/main-ground.tsx`, mounted by `SiteBody` (never the layout —
  the private landing must not show couple footage): the still, the clip (host only while
  `GUEST_HERO_VIDEO_PLAYBACK` is closed — guests get the still), the measured scrim, and the tint as an
  `!important` rule on `[data-guest-look]` (it must beat the scope's inline palette). The theme's own loop
  is switched off under it. Themed pages only — Classic is plain paper.
- **The Maker.** `main-background-panel.tsx` (first row of Main): pick a clip (≤ 15 s, compressed, silent)
  or photo → one frame is read in the browser (`extractPosterFrame`, now exported from
  `std-media-picker.tsx`, for clips) and the clip's still uploaded beside it; then "Match my video's
  colours" (default) / "Keep the theme's colours", swatches of what matching does, the contrast it reads
  at, the calmer-clip advice, and "Use the theme's own background again". Everything posts
  `hubDraftAction` intent=save. Footage whose colours could not be read is never saved. Hidden in the
  store shell. First-visit hint `customer_adaptive_theme_v1` (`MiniTour`/`TOURS`) opens with the panel.
- `app/api/upload/route.ts`: `main-background` joins the couple's 100 MB media meter.
- Tests: `lib/adaptive-theme.test.ts` (six painted fixture frames × ten themes: body text ≥ 4.5 over every
  frame or the scrim rises; tinted button/accent ≥ 4.5 or untinted; Modern + warm → warm buttons; toggle
  off → no vars, scrim unchanged; sanitiser), `lib/the-main-background-drafts.test.ts` (fence, overlay,
  free refused / owning applied, removal free, toggle is a look change).
- Browser check (local harness bundling the real `extractPosterFrame` + `adaptive-theme`, Modern's real
  theme CSS): a warm clip → button `rgb(58,74,28)` → `rgb(110,46,0)`, body text 4.57:1 over the frame at a
  24 % veil; "Keep the theme's colours" → `rgb(58,74,28)` again; the `!important` tint beat an inline var.

**Deferred:** the two-`<video>` seamless cross-fade loop (native `loop` for now); a still picker for print
(the grabbed frame is stored as `poster` for it); guest playback of the clip itself (needs the hero-video
screening that `GUEST_HERO_VIDEO_PLAYBACK` waits for).

SPEC IMPACT: `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 10 — "As built — adaptive part" bullet
added: the Main-background swap did not exist and is built here (hero row `config_json.main`, no
migration); `extractPaletteFromFile` deliberately not used (drops extremes, pads with cream); `canvas.tint`
stores the frame, not tinted hexes; the scrim starts from zero, not the theme's spec scrim; an unscreened
clip plays for the host only. Flagged for the owner: storing the Main background on the hero row, and the
50 % calmer-clip threshold (a design call).
