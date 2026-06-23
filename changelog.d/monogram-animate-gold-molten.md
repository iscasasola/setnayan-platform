## 2026-06-22 · feat(monogram): Gold Turn + Molten Gold are monogram ANIMATIONS (from the editor's Animate side)

Owner 2026-06-22 ("this is not reveal save the date. this is monogram animation …
that and the gold monogram turn will be from the monogram editor. the animate
side"). The gold "monogram turn" (CSS) and the molten-gold (WebGL) effects — first
shipped as Save-the-Date *reveal openings* (#2079/#2086/#2088) — are re-homed as
two new MONOGRAM MOTIONS in the editor, and RETIRED as reveal openings.

**New motions**
- `lib/monogram-motion.ts`: `MonogramMotionKey` grows 6 → 8 (`+ 'gold' | 'molten'`)
  with two `MONOGRAM_MOTIONS` records (Gold Turn · Molten Gold). The first six are
  pure-CSS/SSR; gold is a composed CSS reveal, molten is a three.js shader — noted
  in the header. `resolveMonogramMotion` / `isMonogramMotionKey` derive
  automatically; default stays `draw`.
- Migration `20270219143725_monogram_motion_gold_molten.sql`: widen
  `events_monogram_motion_key_check` to the 8 keys (drop+re-add, idempotent) +
  backfill `std_reveal_template` off the retired `gold-monogram`/`molten-monogram`
  openings. **Must be applied before a gold/molten pick can persist.**

**Inline render mode** (so they animate the mark in place, not as a full-screen
reveal): both `gold-monogram-reveal.tsx` and `molten-monogram-reveal.tsx` (moved
to `app/_components/`) gain an `inline` prop — transparent, in-flow, ambient loop,
no dark stage / gesture / prompt, never fires onDone.

**Routing** — `HeroMonogram` (the one bridge every surface uses): a new branch
renders Gold Turn (CSS, `GoldMonogramReveal inline`) / Molten Gold for `gold` /
`molten`, and the bespoke short-circuit now defers to it (gold/molten consume the
bespoke SVG as their silhouette). Molten is WebGL → a new `allowWebgl` prop (via
the `MoltenMonogramInline` client wrapper that owns the `next/dynamic(ssr:false)`
so three.js stays code-split). Only large, never-co-mounted surfaces pass
`allowWebgl` (the STD film monogram beat · the editor preview); everywhere else
molten degrades to the CSS Gold Turn — no shader spin-up in chrome/thumbnails, no
WebGL-context exhaustion.

**The Animate side** — `app/dashboard/[eventId]/monogram/`:
- new `animate-picker.tsx` (the editor's Animate section) — pick from the 8
  motions, live preview of the selection (`allowWebgl` so molten renders live),
  Gold/Molten flagged Premium; non-owners pick + preview behind an Unlock CTA.
- new narrow `saveMonogramMotion` action (writes only `monogram_motion_key`, so it
  can't blank the studio-only mark like `saveMonogram` would).
- `save-the-date-film.tsx` FilmMonogram plays gold/molten (allowWebgl) on the film
  beat for every mark kind.

**Retired as reveal openings** (avoid the double-pick): removed `gold-monogram` /
`molten-monogram` from the `RevealTemplate`/`RevealTemplateId` unions, the ids
array, aliases, library, both `Record<RevealTemplateId>` maps, the overlay
branches, the dashboard chooser, and the admin studio. The 5 envelope/veil
openings are unchanged — they uncover a film whose monogram beat now plays the
couple's chosen animation.

SPEC IMPACT: None (0024 STD openings + 0037 monogram). ⚠ OWNER: (1) gold/molten
ride the existing ANIMATED_MONOGRAM unlock (no new tier) — pricing-pass item;
(2) gold ships as one fixed "Gold Turn" (DEFAULT_GOLD_DIALS trace·turn·shimmer), no
dial sub-picker for v1; (3) the public landing hero leaves molten at the gold-turn
fallback (no live WebGL on the most-trafficked page) — promote to live molten there
later if wanted. Progress in `DECISION_LOG.md`.
