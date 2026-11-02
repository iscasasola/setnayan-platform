## 2026-06-22 · feat(monogram): the couple's mark on the editorial masthead

Animated-logo surface rollout (owner 2026-06-22). The post-wedding editorial /
"newspaper front page" masthead drew a local initials text-circle (`Monogram`),
bypassing the canonical cascade. It now renders the couple's REAL mark via
`<HeroMonogram>`, mirroring the public hero / recap / live-wall — animated when
they own the paid ANIMATED_MONOGRAM, their bespoke/uploaded SVG when present,
else their chosen lockup/initials.

- `EditorialContent` resolves the mark with the shared `resolveEventMonogram`
  (the seam landed in the recap/wall PR), via an admin client (the editorial is
  publicly viewable) + a best-effort `try/catch` so the module keeps its
  "never throws" contract; null → the existing text-circle fallback.
- The masthead sits on a cream ground, so the mark renders BARE (no dark-bg
  lozenge needed — unlike the recap photo-hero / live wall).

One file. No DB, no SKU. Falls back to the prior text-circle when no mark resolves.

SPEC IMPACT: None (canonical mark already specced under 0038 editorial + 0037
monogram; visual parity with the public hero). Rollout progress in `DECISION_LOG.md`.
