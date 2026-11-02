## 2026-06-23 · refactor(event-type): profile-drive the public-site gates — iteration 0053 Phase 1a

Replaces the hard-coded `event_type === 'wedding'` / `!== 'wedding'` RENDER gates on the public `/[slug]` surface with profile-driven `surfaceEnabled(profile, …)` checks (spec `0053_event_type_engine`). After this, turning a public surface on for an event type is a config change (a profile row), not a code change. **Behavior is byte-identical** — proven, not assumed.

Architectural call: every public guest-facing `/[slug]` page is the **`website`** profile surface (find-seat, find-my-table, recap are public sub-pages of the couple's site). The STD view beacon is the **`save_the_date`** sub-surface. The `seating`/`gallery`/`budget`/`schedule` surfaces in the profile refer to the couple's *dashboard* tools, which live elsewhere and are already un-gated. Because the GENERIC (non-wedding) profile enables neither `website` nor `save_the_date`, non-wedding events stay 404/suppressed exactly as today.

8 gates rewired across 5 files (all server-side):
- `app/[slug]/page.tsx` — generateMetadata + body master gates + the `phasesEnabled` clause → `website`.
- `app/[slug]/find-seat/page.tsx`, `app/[slug]/find-my-table/page.tsx` → `website`.
- `app/[slug]/recap/page.tsx` — generateMetadata stub + body gate → `website` (restructured to preserve the exact stub-return cases, incl. not calling `isRecapPublished` on null/non-website events).
- `app/api/std/view/route.ts` — the view beacon → `save_the_date`.

NOT touched (correctly, per the discovery audit): the 6 DATA-shape branches keyed on `event_type` that write/read `ceremony_type`/`venue_setting`/`bride_name`/`groom_name` or feed the `events_wedding_fields_consistency` CHECK (create-event actions, date-selection, ceremony-type-chip, event-meta-line, taxonomy-filters, budget allocation). Those stay keyed on `event_type === 'wedding'` until a later phase relaxes the CHECK. Showcase/marketplace eligibility queries (showcase-db, recap-vendor, realstories, editorial edition-count) also left as-is — they scope data populations, not couple surfaces.

**Safe to merge with the Phase 0 migration still un-applied:** `resolveProfile` degrades to `WEDDING_PROFILE` (website + save_the_date on) for wedding and `GENERIC_PROFILE` (both off) for everything else when the table is missing — so the gates are byte-identical pre- and post-migration. Verified: `pnpm typecheck` clean, `pnpm lint` clean (no warnings in the touched files), and a 3-lens adversarial review (behavior-equivalence · pre-migration fallback · RSC/edge-cases) returned byte_identical with zero divergences.

SPEC IMPACT: Iteration 0053 Phase 1a. Logged in `DECISION_LOG.md`. Builds on the Phase 0 spine (`lib/event-type-profile.ts`, PR #2102). Deferred to a later phase: the terminology resolver (`term()`) + reframing wedding-literal copy — only user-visible once a non-wedding surface is actually enabled.
