## 2026-09-24 · feat(home): each Planning card is the event's poster — names and date printed once

Step B2 of the owner-approved collection template (DECISION_LOG 2026-09-24, "the template is good";
prototype `prototypes/collection_template_posters_add_flow_v4_2026-09-24.html`, poster language
`build-sessions/prototypes/public_profile_icecasa_FABLE3_2026-09-23.html`). Planning shelf only.

- **`lib/event-poster.ts` (`posterFor`)** decides the poster from the resolvers that own each fact:
  the words (`invitationCard` → solemn ⇒ `null`), the theme (`resolveHubLook` → `resolveInviteTheme`,
  the one place a theme is decided), the accent (`monogram_color`, validated to a plain hex before it
  reaches a style), the hero (the launcher's presigned, `renderableImageSrc`-narrowed own hero).
  Order: **solemn → quiet masthead** · **hero photo** · accent that carries white type (WCAG ≥ 4.5) →
  **deep** (Capiz panes only when the invite wears Capiz) · accent that cannot → **moon** · nothing
  chosen → **the hub's own invitation card** (eyebrow · their mark · names · invitation line · date).
- **`app/_components/event-poster.tsx` + `.module.css`** draw the five treatments in `cqw`, 3:4.
  The whole poster is `aria-hidden`.
- **`CollectionCard layout="poster"`**: the cover fills the card; the kicker chips sit on it; a private
  glass strip over the foot carries ONE attention item (the total only when it says more than the
  label) and the ring + "N days / to go". Unknown ≠ zero: a null count reads "Couldn't load what needs
  you", a null ring reads "–". The title and meta are NOT printed again — they are the link's
  accessible name (one `sr-only` sentence; every visual layer is `aria-hidden`). `CollectionGrid` and
  `NewThingTile` gain the poster layout (2 → 3 → 4 → 5 columns; a dashed 3:4 ghost).
- The launcher reads `invite_theme` for the page's events only (granted column; a refused read costs
  only the Capiz panes, logged). A Planning card whose words cannot be resolved keeps the glass cover
  rather than guessing — a wake must never get a celebration poster from a failed read.
- Guard re-anchored, not relaxed: `one-event-card-everywhere.test.ts` counts `<CollectionGrid\b`
  (Planning's grid now takes `layout="poster"`; still one grid per shelf).

Tests: `lib/event-poster.test.ts` (every branch, the order, date-from-day, hostile colours),
`app/_components/collection-card-poster.test.ts` (rendered: printed once, the one strip item,
unknown ≠ zero, accessible name). Sabotage (photo before solemn; the name made visible) went red.

SPEC IMPACT: None — implements the 2026-09-24 DECISION_LOG row. Open for the owner: the prototype's
letterpress **playbill** (used for accent-less single-title events) is not drawn — this build gives an
accent-less event the hub's invitation card, per the ruling's "the cover follows the hero the couple
built"; the other shelves (Now happening, Untold, Told, put away) keep the glass card.
