## 2026-09-25 · fix(onboarding): a Simple Event never asks about suppliers

Owner, verbatim: "i noticed that simple event has questions for suppliers. the
simple event is only for our own services." `/onboarding/[type]` only ever
refused `wedding`, so `/onboarding/simple_event` — reachable directly, not
only through the create-event picker's `onboarding_href` redirect — rendered
the full generic wizard: vendor-category tiles, the "How much do you want to
do?" effort question that sizes them, and the "We'll line up …" reveal, even
though `event-type-profile.ts`'s `SIMPLE_PROFILE.marketplaceEnabled` is
`false`.

Fixed on the existing gate, never on the type's name, so any future
vendor-free type is covered automatically:

- `app/onboarding/[type]/page.tsx` — a `marketplaceEnabled !== true` type is
  redirected to its own `onboarding_href` when it has one (Simple Event's
  `/onboarding/simple`), and otherwise falls through with `tiles=[]` and a new
  `vendorFree` prop.
- `app/onboarding/[type]/_components/generic-onboarding.tsx` — `vendorFree`
  drops the "effort" axis from the screen sequence, rewords the region
  sub-line and the reveal's no-picks fallback, and zeroes
  `picks`/`inquiriesPerCategory` in the commit payload (already empty via
  `tiles=[]`, zeroed again for defense in depth). `interestedServices`
  (Setnayan's own in-app services) is deliberately left ungated.
- `app/admin/event-types/[eventType]/onboarding/page.tsx` — "Preview flow"
  follows the type's `onboarding_href` instead of always linking
  `/onboarding/[type]`, and the vendor-category option picker is hidden for a
  vendor-free type.
- `lib/checklist.ts` — new shared `checklistItemAllowedForProfile()` gate
  (vendor-category tasks when `marketplaceEnabled` is false; the budget task
  when the type's `budget` surface is off), consumed by both:
  - `app/dashboard/[eventId]/checklist-actions.ts` (`ensureChecklistSeeded`) —
    filters the per-type template before seeding, so a NEW Simple Event never
    gets a "Book a photographer" / "Set your budget" row;
  - `app/dashboard/[eventId]/checklist/page.tsx` — filters already-fetched
    rows before display. Seeding is top-up-only and never deletes, so every
    Simple Event created before this fix keeps those rows in the database —
    they are hidden at READ time on the same gate, not deleted, so the data
    survives in case the type is ever reprofiled.

6 new test files (23 tests total; each probed both ways — sabotaged to red,
then restored) pin all four behaviours on the `marketplaceEnabled` /
`enabledSurfaces` gate rather than on `eventType === 'simple_event'`.

Regenerated `apps/web/scripts/port-control-baseline.json` — the admin preview
link's destination is now conditional, which is a deliberate control removal
the `lint-port-no-lost-controls` guard needed a new baseline for.

SPEC IMPACT: None — this closes a gap against the standing 2026-06-27 Simple
Event / vendor-free-type decision (`SIMPLE_PROFILE.marketplaceEnabled: false`
in `event-type-profile.ts`); no new decision was made.
