## 2026-06-22 · feat(monogram): the couple's mark on the live Recap hero + Venue Live Photo Wall

Animated-logo surface rollout (owner 2026-06-22). Two LIVE guest-facing "moment"
screens carried no real mark: the Auto-Recap hero drew a hand-rolled gold-circle
of initials (bypassing the cascade), and the venue Live Photo Wall was text-only.
Both now render the couple's CANONICAL mark via `<HeroMonogram>`, mirroring the
public wedding-site hero — animated when they own the paid ANIMATED_MONOGRAM,
their bespoke/uploaded SVG when present, else their chosen lockup/initials.

- **New shared resolver `lib/hero-monogram-data.ts`** — `resolveEventMonogram(client,
  eventId, row)` returns the four `<HeroMonogram>` inputs (design cols · MonogramConfig
  · `animatedMonogram` motion key|false gated on `eventAnimatedMonogramActive` · bespoke
  SVG with uploaded→AI precedence) exactly the way the public hero resolves them. The
  result is serializable, so an RSC resolves it and hands it to a client component.
  This is the one-true-path seam future surfaces reuse (editorial masthead, switcher…).
- **Recap** (`[slug]/recap/page.tsx`): fetch the monogram columns, resolve with an admin
  client (the recap is publicly viewable → viewer may be anonymous), and render
  `<HeroMonogram>` in BOTH hero variants — bare on the cream body (replacing the gold
  circle), on a cream medallion over the dark photo-hero overlay so it stays legible.
- **Live Photo Wall** (`wall/[eventId]/page.tsx` + `_components/wall-projection.tsx`):
  resolve in the RSC, pass a serializable `mono` prop to the client projection, and
  render a prominent `<HeroMonogram>` (cream medallion, scaled up for projector
  distance) on the teaser/standby screen — the branded moment before the collage goes
  live. (Live-collage header left clean; the photos are the star once live.)

Both surfaces fall back to their prior text/circle treatment when no mark resolves.
No DB, no SKU, no new render pipeline — pure DOM/React mirror of the public hero.

SPEC IMPACT: None (the canonical mark already specced under 0012 Papic recap/wall +
0037 monogram; visual parity with the public hero). Rollout progress in `DECISION_LOG.md`.
