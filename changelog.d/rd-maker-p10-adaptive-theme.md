## 2026-09-25 · feat(event-hub): your hero behind every scene, and the theme follows its colours (Maker Phase 10, part 1 — adaptive theme)

The Maker's **Main** ("behind every scene") now puts the couple's **hero** behind every scene in place of the
theme's moving loop, and — the adaptive theme, owner 2026-09-25 *"Adaptive theme is for PRO – i like this"* —
the theme's **button, accent and ornament** move toward the hero photo's colours. Per the owner's ruling the same
day (DECISION_LOG "OWNER ANSWERS — SIX CONTROLLER QUESTIONS" item 6: *"whatever they make on the hero scene will be
their cover and the main background"*), **the hero is the source of truth**: there is no second upload by default.
An own clip or photo is an opt-in override ("A different clip or photo"). Fonts, ornament shapes, the reveal,
transitions and motion do not change. All in the browser: no server, no migration, no new server action. The five
signature reveals are separate PRs.

- **`lib/adaptive-theme.ts` (new, pure).** `measureFrame` turns a frame's pixels into its dominant colours plus the
  lightest and darkest 5 % clusters (the theme loops' own method; never padded). `frameCast` finds the footage's hue
  in OKLab (grey → none). `mainGroundLegibility` re-measures the theme's ink over the frame and raises a paper scrim
  until body text is WCAG AA over every measured colour (free — whatever the toggle says); past 50 % it advises a
  calmer photo/clip. `adaptiveTint` moves button / accent / ornament onto the footage's hue with
  `oklchOfHex`/`hexOfOklch`, each kept at ≥ 4.5:1 (button under its paper label; accent on the paper AND over the
  veiled frame) or left untinted. `adaptiveThemeVars` emits the tokens the theme blocks already paint through; `{}`
  when the couple keeps the theme's colours; a couple's own button colour outranks the tint.
- **Storage — `canvas.tint` on the Main background, `config_json.main` on the hero row** (`lib/hub-canvas.ts`):
  **follow** `{ follow: 'hero', of, tint }` (the default — the frame measured off hero photo `of`; used only while
  `of` IS the hero, so a new hero is never tinted by the old frame) or **own** `{ kind, media, poster?, tint? }` (the
  override). `resolveMainGround(main, resolveHero(event), heroVideoRefForGuests)` is the one answer; nothing measured,
  or a card hero, = the theme's own loop. `tint` stores the measured frame + toggle, never tinted hexes — the tint is
  re-derived at render from frame × theme.
- **Measuring the hero, automatically.** `HeroFrameSync` reads the hero photo straight off its public URL (the media
  bucket answers the app's origins with CORS — probed) in the Main panel AND beside the Hero workspace, so a new hero
  is measured where it was made. It writes only a follow, never over an override.
- **The draft.** `widgets.hero.main` rides `event_site_drafts` (dropped on any other section); `mainGroundChange`:
  the tint on the hero and an own clip/photo are Pro (try in the draft, pay at Apply); back to the plain hero is
  free. Apply holds an override's clip and still to this event's `main-background/` uploads (`not_your_photo`) and
  merges `main` beside `canvas` into one `config_json` patch.
- **The guest page.** `app/[slug]/_components/main-ground.tsx`, mounted by `SiteBody` (never the layout — the private
  landing must not show couple media): the still, the clip (host only while `GUEST_HERO_VIDEO_PLAYBACK` is closed),
  the measured scrim, and the tint as an `!important` rule on `[data-guest-look]` (it must beat the scope's inline
  palette). The theme's own loop is switched off under it. Themed pages only — Classic is plain paper.
- **The Maker.** `main-background-panel.tsx` (first row of Main, "Behind every scene"): "Same as my hero" (default) /
  "A different clip or photo" (≤ 15 s, compressed, silent — frame read with `extractPosterFrame`, now exported from
  `std-media-picker.tsx`); "Match my photo's colours" (default) / "Keep the theme's colours", swatches, the contrast
  it reads at, calmer advice. Hidden in the store shell. First-visit hint `customer_adaptive_theme_v1`.
- `app/api/upload/route.ts`: `main-background` joins the couple's 100 MB media meter.
- Tests: `lib/adaptive-theme.test.ts` (six painted fixture frames × ten themes: body ≥ 4.5 or the scrim rises;
  tinted colours ≥ 4.5 or untinted; Modern + warm → warm buttons; toggle off → no vars), and
  `lib/the-main-background-drafts.test.ts` (the hero is the default and only once measured; a new hero waits for
  its frame; an override wins; free refused / owning applied; sabotage of the Pro gate turns it red).
- Browser check (local harness bundling the real modules and the real panel, server edges stubbed): a warm clip on
  Modern → button `rgb(58,74,28)` → `rgb(110,46,0)`, body 4.57:1 at a 24 % veil; "Keep the theme's colours" →
  `rgb(58,74,28)`; the panel measured the hero on mount and saved `{follow:'hero', …}`; override → back to hero
  re-measured on its own.

**Deferred:** the two-`<video>` seamless cross-fade loop (native `loop`); a still picker for print (an override
clip's frame is stored as `poster`); guest playback of any clip (waits on hero-video screening). Not checked in a
signed-in live Maker session.

SPEC IMPACT: `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 10 — "As built — adaptive part" bullet: the hero is the
Main background by default (owner item 6), stored as a follow on the hero row's `config_json.main`, own media an
opt-in override; `extractPaletteFromFile` deliberately not used (drops extremes, pads with cream); `canvas.tint`
stores the frame, not tinted hexes; the scrim starts from zero; an unscreened clip plays for the host only. Flagged:
the 50 % calmer threshold is a design call, and measuring the hero writes a draft key (so a couple sees one change
to Apply after their hero is first measured).
