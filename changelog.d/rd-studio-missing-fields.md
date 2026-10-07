## 2026-10-07 · feat(studio): the missing fields — For ▾, Love Story title + order, registry link, Look extras, one main colour, QR on/off

Owner 2026-10-07 (DECISION_LOG "THE MISSING FIELDS ARE APPROVED — STEP 4c"),
verbatim *"approve all"* on the pieces PR 4 (#6388) could not store. Everything
new is drawn only in the new Maker's Studio (`makerStagesStudioEnabled`).

- **Migration `20271265788160_studio_missing_fields.sql`** (pipeline-applied):
  `event_schedule_blocks.audience` (NULL = Everyone; CHECK entourage · sponsors ·
  family · suppliers), `events.gift_registry_url` (http(s), ≤ 500, CHECK) and
  `events.qr_shown` (NULL/true = shown), and the two inspiration slot CHECKs widened. Both `events` columns: SELECT + UPDATE
  to `authenticated`, nothing to `anon`, `events_host` rebuilt (recipe of
  20271263730696). Nothing else needed a column — measured: the Love Story's
  moments live in `events.love_story.moments[]`, the main background in the hero
  row's `config_json.main`, the five main colours in `role_palette.reception`.
- **Schedule › For ▾** (`lib/schedule-audience.ts`): one PickMenu in the moment
  inspector, saved by `updateScheduleBlock` (live, like every schedule edit). The
  guests' schedule is the Everyone moments only (`fetchPublicScheduleBlocks`,
  `filterBlocksForAudience` guest); `momentsForAudience` is the Arrive by reader
  PR 6 uses.
- **Love Story › title + the couple's own order** (`lib/love-story-moments.ts`):
  `title` and `order` keys on each moment; no `order` = today's chapter + date
  order (nothing moves until a drag). Studio cards (`moment-order-cards.tsx`):
  photo · year · title · first line · grip, drag (or ↑/↓) posts one
  `intent=order` to the draft. The sheet gains Title; guests see the title.
- **E-Gifts › Registry link** (`lib/gift-registry.ts`): saved live by
  `savePabuyaMessage` (each field only when its form carries it), shown on the
  guest Gifts page as "Our gift registry ↗".
- **Look › Background extras** (`lib/hub-canvas.ts` `HubMainLook`): Pattern ▾
  (a new `{ ground: 'pattern' }`), Focus ▾, Blur ▾, Shade ▾ — drafted on the main
  background, free. The guest page lays Shade's veil (`mainGroundShade`, the
  contrast floor kept) and flips the words light on a dark one (`shadeWordVars`),
  blurs, focuses and draws the pattern (`PatternGround`).
- **Look › Colours — one at a time** (`lib/main-colours.ts`): the five main
  colours with their jobs; a pick drafts `main_colours` (slot → hex), laid into
  the Mood Board's main colours on the canvas and at Apply, every other board key
  kept. Free. Imports the palette rules, never edits them.
- **The draft holds a PAINTED palette** (controller addition): `role_palette` in
  the draft accepts a board the couple painted, through the Mood Board's own
  `sanitizeRolePalette` (`sanitizePaintedPalette`, lib/main-colours.ts); a theme
  seed keeps its fill rule; overlaid whole, compared as the Mood Board reads it,
  free, never held with a refused theme; Apply writes it the `saveRolePalette`
  way (board + `mood_board_updated_at`). Studio › Mood Board's picker, ✨ Auto
  and part palettes now write INTO the draft (`mood-board-studio.tsx`, was
  `saveRolePalette` live); S5's tripwire test now asserts the drafted path.
- **Bridal bouquet · Centrepieces slots** (controller addition): the migration
  widens both slot gates (`event_inspiration_assets_slot_key_check_v3`, same
  name, and `moodboard_library_assets_supplier_gallery_shape`), every existing
  value kept; `MOODBOARD_SLOT_KEYS`, the trades (florist; florist ·
  stylist_decorator · catering), the gallery labels, the render-part aliases
  (centrepieces → tables, bouquet → the bride), a Studio Inspiration card each
  and a tile each on the shipped board.
- **Info › QR on/off**: drafted `qr_shown`; off leaves the event QR off the print
  set and the guest keepsake.

Guards (each seen red by sabotage): `a-schedule-moment-is-for-someone`,
`the-love-story-keeps-the-couples-order`, `the-registry-link-is-a-real-link`,
`the-main-background-extras-reach-the-page`, `one-main-colour-waits-for-apply`,
`the-event-qr-can-be-switched-off`, `the-draft-holds-a-painted-palette`,
`bouquet-and-centrepieces-have-a-slot`.

SPEC IMPACT: None beyond the 2026-10-07 DECISION_LOG row "THE MISSING FIELDS ARE
APPROVED" (written by the controller). Recorded here: the Love Story title and
order are keys of the existing moment blob, not columns.
