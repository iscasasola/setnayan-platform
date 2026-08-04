## 2026-07-22 · fix(vendors): capture served event types at onboarding so non-wedding vendors are discoverable

Non-wedding vendors were **invisible** in the marketplace. The marketplace
`?event_type=` filter reads `vendor_profiles.event_types`, but `/open-shop`
onboarding captured no event-type signal and seeded no coverage rows — so every
newly-onboarded shop kept the column default `['wedding']` and never surfaced for
the birthdays, debuts, christenings, etc. it actually serves, until the vendor
separately discovered the My Shop → Services coverage editor.

Fix (no schema change — the column, index, CHECK, view, and read filter already
exist; the only gap was the missing write):

- **`open-shop/page.tsx`** loads the admin-driven event-type roster
  (`getEventTypeVocab()` — same source the coverage editor + marketplace filter
  use) and seeds the wizard's selection from the shop's *current* `event_types`,
  so re-running onboarding never clobbers a richer set from the coverage editor.
- **`open-shop-wizard.tsx`** adds a compact "Events you serve" chip multi-select
  to step 1 (default `['wedding']`).
- **`becomeVendor`** parses `event_types`, validates against the roster keys
  (invalid/empty → `['wedding']` so a NOT NULL column is never event-typeless),
  and writes it into the profile patch.

Note: the coverage editor's `syncProfileFromCoverages` remains the source of
truth once a vendor adds coverage rows; this onboarding write is the initial,
immediately-visible value so a shop isn't invisible on day one.

SPEC IMPACT: Implements the "non-wedding vendors are INVISIBLE" fix the vendor
onboarding redesign already targets; DECISION_LOG row + memory updated.
