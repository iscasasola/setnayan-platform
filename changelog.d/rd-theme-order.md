## 2026-09-29 · feat(themes): one theme order — the three free first, then Pro lightest to heaviest

Owner, verbatim: *"arrange the themes to have the free as the first 3 and the rest will
be based on size also"* (DECISION_LOG "THEME ORDER: THE THREE FREE FIRST…").

- `lib/invite-themes.ts`: `INVITE_THEME_IDS` (and so `HUB_THEMES`, `FREE_THEMES`,
  `PRO_THEMES`, `pickableInviteThemes`) is now Classic · Modern · Cyber Neon · Luxe ·
  Vintage · Regency · Rustic · Cinderella · Great Gatsby · Whimsical. Each theme carries
  `loopMb` (its background loop, measured 2026-09-28) as the documented reason for the
  Pro order — written out, never sorted at runtime.
- Every list reads it: the Details picker and store shell (via `pickableInviteThemes` →
  `tilesShown`, filtered not re-sorted), Prints & Tickets' theme choice, the Pro pitch
  that names the themes, and the Maker's theme panel on the editor page and the dev hero
  lab (both used `Object.values(INVITE_THEMES)` — the object's key order — and now read
  `HUB_THEMES`).
- Guard: `lib/theme-order.test.ts` — the order is pinned AND is "free first, then Pro by
  `loopMb`"; every surface reads it; no surface uses the object's key order or a local sort.

SPEC IMPACT: None — the DECISION_LOG row already records the decision; no spec file lists
the order.
