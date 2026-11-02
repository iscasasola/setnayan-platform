## 2026-09-11 · fix(verified-badge): point the couple/public badge sites at hasVerifiedBadge

PR #5433 built `hasVerifiedBadge` (`lib/verified-badge.ts`) so the Verified badge comes off at its Q4/Q5 deadline, and wired it into the marketplace cards + admin desk, but its own body flagged roughly a dozen other sites still reading `verification_state` alone for their badge.

RULE 0 on this PR found the real picture narrower than that list: most of those sites feed `resolveVendorDisplayName`'s hybrid-anonymity name-reveal gate (a different question, never deadlined, must stay on the raw state per the owner's "open it up" lock) or a compat-score ranking input, or the `public_visibility` listing/bookability state (Q5: a shop stays listed and bookable past its badge deadline — untouched). Seven sites genuinely fed a rendered "Verified" text off the raw state (six found by the initial pass; the guard itself caught a seventh — `lib/vendor-og-description.ts`, the share-card description, landed by a parallel session mid-PR), and this PR points all seven at `hasVerifiedBadge`:

- `lib/wizard-recommendations.ts` — the shared vendor-recommendation reader (feeds category search, onboarding venues, the tour) now also selects `next_renewal_due_at` alongside `verification_state`.
- `app/dashboard/[eventId]/vendors/_actions/category-search.ts` — the bench category search's own badge field.
- `app/dashboard/[eventId]/vendors/page.tsx` — the couple's Vendors page enrichment (feeds `plan-budget-accordion.tsx`, `shortlist-categories.tsx`, `vendor-quickview-inspector.tsx` as pure consumers, unchanged).
- `app/onboarding/wedding/actions.ts` — the onboarding venue picker's badge (feeds `onboarding-shell.tsx`).
- `app/tour/vendors/page.tsx` — the signed-out tour's shortlist badge (feeds `tour-shortlist.tsx`); its compat-score ranking input stays on the raw state, split into its own variable.
- `app/_components/frontdoor/data.ts` — the front door's shop search result badge (feeds `front-door-results.tsx` / `front-door-feed.tsx`).
- `lib/vendor-og-description.ts` — the shop's share-card (Open Graph) description, `"category · city · Verified"`. `app/v/[slug]/page.tsx`'s `fetchVendor` select (+ its legacy-column fallback + `PublicVendorRow` type) now also carries `next_renewal_due_at` so this reader has the deadline to pass through.

`app/v/[slug]/page.tsx`'s own on-page badge render (`verification_state === 'verified'` at its Verified pill, line ~2132) is deliberately **not** touched here — a parallel session (HONEST SHOP, PR #5450) was editing that file mid-PR, and that specific fix is PART 3 of this build (L2), a separate PR, after #5450 merged.

Added `lib/the-badge-has-a-deadline.test.ts` — a guard scanning `app/` + `lib/` (excluding the admin and vendor-dashboard trees, and `app/v/[slug]/page.tsx` per the note above) for a raw `verification_state`/`public_visibility === 'verified'` comparison. Every remaining occurrence is billed at its exact count with a reason (name-reveal, ranking input, listing gate, a shop's own dashboard concern); a NEW site, or an existing one whose count moves, fails the guard.

Tests: `lib/the-badge-has-a-deadline.test.ts` (5 cases) + `lib/vendor-og-description.test.ts` (+3 deadline-aware cases: no-deadline / future / past). Mutation-checked twice (reverted the vendors/page.tsx badge fix, then separately the OG description fix, each back to raw `verification_state`/`public_visibility === 'verified'`; the guard and/or the affected suite went RED both times as expected; restored from explicit backups, verified against the commit). Typecheck clean (empty log). Lint clean (no `Error:`).

SPEC IMPACT: None (implementation detail — the badge's meaning was already decided by DECISION_LOG Q4/Q5; this PR only widens where the code already-decided rule applies).
