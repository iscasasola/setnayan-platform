# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(events): unlock the guest website / RSVP / Save-the-Date for all event types (unlock Stage 2)

Owner-decided 2026-07-12 ("no not wedding first at v1, we unlock all now"). Stage 2 of the unlock: flip the surface flags so non-wedding events render their public event site. Follows Stage 1 (PR #3207, copy generalization) — stacked on it, and **must land after it** or a non-wedding would briefly show the old wedding copy.

- **migration `20270804110223_unlock_nonwedding_guest_surfaces.sql`** — adds `website`, `save_the_date`, `rsvp` to `enabled_surfaces` for every non-wedding `event_type_profiles` row (`WHERE event_type <> 'wedding'`; `array_agg(DISTINCT …)` → idempotent). `website` is the master flag — it drives the whole guest lifecycle (`save_the_date → rsvp → event → editorial`) in `app/[slug]/page.tsx`. `monogram` stays off (couple-initials-shaped; a later call).
- **`lib/event-type-profile.ts`** — `GENERIC_PROFILE.enabledSurfaces` gains the same three (the code fallback for types without a DB row), kept in lockstep with the seed.

Weddings are untouched: `WEDDING_PROFILE` already carries `ALL_SURFACES`, and the UPDATE is scoped away from `wedding`. The render path is null-safe for non-weddings (`ceremony_type ?? null`, `Array.isArray(our_photos)`, `love_story` a nullable prop) — no crash; wedding-only content *sections* (love story, entourage) may render empty until the Stage-3 polish (hide/adapt them per profile).

**Verification (honest):** `tsc --noEmit` clean; migration doctor "Healthy — db push will run clean"; timestamp in order; static null-safety scan of the render path clean; weddings provably unaffected. An **interactive browser check could not run in this worktree** (no local Supabase / no Supabase env — the dev server has no DB), and the flag's effect only appears once the migration is applied to prod. So the non-wedding `/[slug]` render is to be **verified on prod immediately after the migration deploys**, and Stage 3 (polish the wedding-only sections) follows.

SPEC IMPACT: Non-wedding event types now expose the public website + RSVP + Save-the-Date surfaces (owner "unlock all now", reverses weddings-first surface gating). This also un-blocks the surprise-party experience deferred earlier. See `DECISION_LOG.md`.
