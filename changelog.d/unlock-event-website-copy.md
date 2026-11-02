# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · refactor(website): make the public event site's copy event-type-adaptive (Stage 1 of "unlock all")

Owner-decided 2026-07-12 ("no not wedding-first at V1, we unlock all now"). The public event website (`app/[slug]`) is wedding-hardcoded; before the surface flags can be flipped for non-wedding event types, its guest-facing copy has to stop saying "wedding" on a birthday. **Stage 1 (this PR): generalize the copy. Weddings are byte-identical.** Stage 2 (next) flips the `website`/`rsvp`/`save_the_date` surface flags for non-wedding profiles, browser-verified.

- **`app/[slug]/page.tsx`** — new pure helper `eventNounOf(event)` → `'wedding'` for weddings (and legacy/null `event_type`), `'event'` otherwise. Routed the ~4 visible hardcoded "wedding" strings through it: the private-page metadata title, `YourPhotosWidget` ("snaps you on the {noun} day"), and `TierComparisonWidget` ("RSVP for the {noun}", "branded {noun} selfie cam") — threaded a single `eventNoun` prop to each (both wrappers already receive `event`). Added `event_type?` to the `EventRow` prop type. The public OG metadata already used `event.display_name` (generic).
- **`app/[slug]/recap/page.tsx`** — the recap SEO description "…'s wedding recap" → "…'s {noun} recap".

Because `eventNounOf` returns `'wedding'` for every existing (wedding) event, **every wedding string renders identically** — this is safe prep, not a behavior change. Non-wedding events still don't render the site (their `website` surface isn't enabled yet — that's Stage 2).

The remaining 60-odd "wedding" hits in the file are code identifiers, comments, and `Save-the-Date` (event-agnostic) — not guest-facing copy.

Verified: `tsc --noEmit` clean; grep confirms no guest-facing hardcoded "wedding" copy remains on the reachable public event surfaces.

SPEC IMPACT: Prep for unlocking non-wedding event websites (owner "unlock all now", reverses weddings-first). No behavior change yet (weddings byte-identical; non-weddings' website surface still off until Stage 2). See `DECISION_LOG.md`.
