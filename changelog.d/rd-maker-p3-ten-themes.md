## 2026-09-25 · feat(event-hub): ten themes, one registry — the whole look chosen in one place

Event Hub Maker **Phase 3** (build plan `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` §3).

- **One registry of ten** — `lib/invite-themes.ts` now holds Classic · Rustic · Modern · Cinderella · Luxe ·
  Vintage · Whimsical · Regency · Great Gatsby · Cyber Neon, each a whole look: palette (canvas · surface · ink ·
  muted · accent · accent-ink · heading + the light/dark ink pair), fonts, ornament, loop + still (none for
  Classic), default reveal (+ its future signature reveal), motion preset, transition pattern, radius, scrim, foil,
  and the spec's measured contrast. Values copied from `assets/theme-backgrounds-2026-09-24/THEMES-2026-09-24.md`.
  Exported for the Maker's Theme panel: `HUB_THEMES`, `resolveInviteTheme` (pure) / `resolveHubTheme`
  (server, `app/[slug]/_lib/hub-look.ts`), `normalizeThemeId`, `inviteDoorFor`.
- **Ids kept / added / retired** — kept `house`→Classic, `abaca`→Rustic, `galeriya`→Modern, `velvet`→Luxe;
  added `vintage` (made ready), `cinderella`, `whimsical`, `regency`, `gatsby`, `cyber`; retired `capiz`,
  `minimalist`, `fairytale`, `custom`. Prod on 2026-09-25: NULL 13 · capiz 1 (the owner's `cale-ice`), 0 for
  every other id. `capiz` is READ as Vintage (`LEGACY_THEME_ALIASES`) and stays admissible in the CHECK — no
  backfill, so the owner's page renders correctly whichever of migration and code lands first.
- **Migration `20271245782629_the_ten_event_hub_themes.sql`** — widens `events_invite_theme_check` to the ten
  (+ `capiz`). Constraint only; no grant, no view rebuild. Applied only by the pipeline.
- **The page wears the theme** — `globals.css` "THE TEN THEMES ON THE PAGE": one block per Pro theme,
  generated from the registry palette (held channel-for-channel by `lib/invite-themes.test.ts`), with the
  fixed-page repairs folded in (eyebrow and CTA label ≥ 4.5:1 on the canvas). The old capiz/velvet/galeriya/abaca
  page mappings are replaced; the four door materials stay.
- **The loop** — `GuestLookScope`'s ground now draws the theme's muted inline loop + still under a scrim in the
  page's own paper (`app/[slug]/_lib/theme-ground.ts`), on every guest page; hidden under reduced motion.
  Loops are served from the public R2 bucket. ⚠ **Not uploaded yet** — `scripts/upload-theme-loops-to-r2.ts`
  (dry run lists the 18 keys, 16.8 MB); until an admin runs it with `--apply`, Pro themes render on their plain
  canvas, fully readable.
- **Readable for everyone, free** — new `lib/hub-legibility.ts` (`hubLegibility`, `requiredScrim`,
  `contrastRatio`, `compositeOver`, `hubLegibilityVars`): the theme's ink over a solid colour
  (`readableTextOn`), its own ground (spec scrim as the floor, strengthened to AA over the loop's lightest and
  darkest clusters) or a couple's own media (tone flip, weakest veil that reads). `lib/hub-legibility.test.ts`:
  every theme × light / dark / mid backgrounds → body ≥ 4.5, heading ≥ 3, accent passes or falls back.
- **Foil names** on by default in Luxe and Great Gatsby (`data-hub-foil`, 6 s glint, static under reduced motion),
  only over the theme's own ground.
- **The door** — ten themes open through the four owner-approved door compositions (`INVITE_THEMES[id].door`);
  the door guards now iterate compositions. The four undrawn site-skin stylesheets are deleted.
- **Picker** — `invite-theme-picker.tsx` lists the ten with palette swatches; in the store shell Pro themes are
  hidden (not locked, no ₱), keeping only the couple's own saved Pro theme. `WEBSITE_PRO_ITEMS`
  "Invite link theme" → "9 Event Hub themes, invite link included".
- **Fonts** — faces already committed stand in where the spec's face is not yet in `app/_fonts` (each block's
  comment names the stand-in); the registry keeps the spec's names for the fetch (D8).

SPEC IMPACT: `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 3 — (1) D3 applied as a READ alias, not a
backfill (capiz→Vintage etc.), because the one stored `capiz` row is the owner's live page; (2) the CHECK keeps
`capiz` until a follow-up backfill after deploy; (3) the theme fonts ship as stand-ins pending the font fetch
(owner approval to download the OFL faces); (4) the loops await the admin upload. Classic keeps today's House
page (white, not the spec's ivory `#f6f1e7`) so no free couple's page changes — flagged for the owner.
