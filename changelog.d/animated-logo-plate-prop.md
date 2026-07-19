## 2026-06-22 · fix(monogram): HeroMonogram `plate` prop — single cream backing on dark surfaces

Cleans up the known double-ring shipped with the recap + live-wall monograms
(#2007). Those dark surfaces wrapped the WHOLE `<HeroMonogram>` in a cream lozenge
for legibility — but three of its branches (bespoke · animated · legacy circle)
already draw their OWN cream disc, so the lozenge double-backed them into a faint
cream-on-cream ring.

- `HeroMonogram` gains an opt-in `plate` prop: it adds a cream backing to ONLY the
  otherwise-bare branches — the type-only lockup (bar/duo/script/infinity) and the
  framed mark — so they read on dark. The self-disc branches ignore it. Result:
  exactly ONE backing per branch, no double-ring. Default off → the public hero,
  editorial, STD film, and recap cream-body render byte-identically (the non-plate
  className/style are unchanged).
- Recap photo-hero overlay + Live Wall teaser drop their cream-lozenge wrappers and
  pass `plate` instead.

HeroMonogram now owns its own dark-bg legibility — the reusable path for any future
dark surface.

SPEC IMPACT: None (visual polish on 0012 recap/wall + 0037 monogram). Rollout
progress in `DECISION_LOG.md`.
