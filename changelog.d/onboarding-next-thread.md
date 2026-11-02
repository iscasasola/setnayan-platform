## 2026-06-30 · feat(onboarding): carry the vendor-invite return path through wedding onboarding

Closes the last tail of the vendor-import workstream (#2448 free import · #2449
QR invite · #2450 review-on-import): the **0-event WEDDING** QR-claim loop is now
seamless. PR #2449 threaded `next` through the inline create-event form, but the
**wedding** type routes into the tailored `/onboarding/wedding` flow (not the
inline form), so a couple who scanned a vendor QR with no event yet landed on
their new dashboard and had to reopen the vendor link. Now they return to
`/vendor-invite/[slug]` to finish shortlisting.

- **`event-type-picker.tsx`** — a `withNext()` helper appends the (already-passed)
  `next` query param to the onboarding navigations (`onboardingHref` for wedding +
  the generic `/onboarding/[type]`), so the return path survives the route hop.
- **`onboarding/wedding/page.tsx`** — reads `next` (via `safeNext()`), passes it
  to the shell as `nextPath`.
- **`onboarding-shell.tsx`** — new optional `nextPath` prop; the post-commit
  `goToDashboard` returns to `nextPath` on a plain "continue free" finish instead
  of landing on Home. Purchase/bundle/AI-keep CTAs keep precedence (the override
  only replaces the Home fallback). Added to the `handleFinish` deps.

All additive + internal-path-validated (`safeNext`): default behavior is
byte-identical when `next` is absent. No schema/RLS/pricing change.

Note: the generic `/onboarding/[type]` route (experience-quiz on · non-wedding)
now *carries* `next` in its URL but doesn't yet honor it post-commit — forward
prep; wedding (the V1 primary) is fully wired, and the inline non-wedding create
path already honored `next` (#2449).

SPEC IMPACT: None — UX continuity for the vendor-invite onboarding loop; no
schema/SKU/flow change. DECISION_LOG.md (2026-06-30) + memory
project_setnayan_vendor_import_crm_workstream updated.
