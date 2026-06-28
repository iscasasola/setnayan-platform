## 2026-06-28 · feat(vendors): surface the onboarding plan on the non-wedding Shortlist

Closes the "dead data" gap from the per-type onboarding: a non-wedding couple
answered tailored questions and the reveal promised "we'll line up [categories]",
but the dashboard never read `style_preferences.interested_categories` — they
landed on a blank Vendors bench. Now their plan is front-and-center where they act
on it.

- `lib/shortlist-taxonomy.ts` — `buildShortlistFolders` accepts `plannedTiles`
  (the onboarding picks; taxonomy ids == shortlist tile ids, verified). Each
  `ShortlistTile` gains `planned`, each folder a `plannedCount`.
- `app/dashboard/[eventId]/vendors/page.tsx` — reads `style_preferences.
  interested_categories` and passes it as `plannedTiles`, **scoped to non-wedding**
  (wedding keeps its own plan/build machinery byte-identical).
- `shortlist-categories.tsx` — a "From your plan" chip strip atop the bench (tap a
  chip → opens that folder + category and scrolls to it) + an "In your plan" marker
  on planned categories that have no vendor yet. Respects the owner's
  folders-collapsed-by-default directive (the strip surfaces the plan without
  auto-expanding folders).
- New `lib/shortlist-taxonomy.test.ts` (3 cases — default unplanned, plannedTiles
  flags + counts, unknown id harmless).

Zero blast radius: there are 0 non-wedding events in prod today, and the wedding
path passes `plannedTiles=undefined` → its Shortlist is unchanged. typecheck +
lint clean; full lib suite green.

SPEC IMPACT: None — surfaces existing onboarding data on an existing surface; no schema/SKU/pricing change.
