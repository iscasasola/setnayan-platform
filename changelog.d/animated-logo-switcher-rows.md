## 2026-06-22 · feat(monogram): the couple's real mark in the account-switcher event rows

Animated-logo surface rollout (owner 2026-06-22). The global account-switcher
(mobile sheet + desktop standalone) listed each event with a generic terracotta
**first-initial** chip (`ev.display_name.charAt(0)`) — violating the owner-locked
"show the custom mark everywhere" rule (2026-06-15). The dashboard chrome chip
already renders the couple's real mark via `EventMonogram`; the switcher rows now
do too.

- `get-switcher-data.ts`: `SwitcherEvent` + the events query carry the monogram
  design columns (`monogram_text/color/font_key/style/frame_key/custom_svg`),
  RLS-scoped to the user's own events.
- `account-switcher.tsx`: both row renderers swap the first-initial `<span>` for
  `<EventMonogram event={ev} size="md" />` — the same cascade (bespoke SVG →
  lockup → framed → letters) shown in the chrome chip, hero, recap, wall, and
  editorial.

Note: the switcher *chip* (`EventMonogram`) was already correct — the gap was
only these list rows. No bloom added (a per-session animation on a tiny chrome
chip would be noise, not delight). No DB, no SKU.

SPEC IMPACT: None (0000 event switcher + 0037 monogram; enforces the existing
"custom mark everywhere" lock). Rollout progress in `DECISION_LOG.md`.
