## 2026-09-06 · feat(bench): the inline "More in {category}" row

Owner, 2026-09-06: *"when they also click the find reception button, it must show
a lower row that will show other vendors for that category and a search button
also"* — and, decisively, **"we do not want to leave the page."**

"Find {category}" used to open `CategorySearchOverlay`, which is
`position:fixed; inset:0`. It does not navigate, but it **covers** the bench,
which is the same feeling. It now opens a second rail directly under the
considered carousel:

```
▸ Reception                       one only · 3 considering
  [ Hacienda ][ Villa ][ Glasshouse ]   ← row 1, unchanged
  MORE IN RECEPTION      [search field]      [ See all → ]
  [ Casa Almeria ][ Antonio's ][ Balai ]     ← row 2, NEW
```

- **No second ranking.** Row 2's data comes from `searchCategoryVendors` — the
  same action the full sheet uses — so the owner-locked order (favorites →
  boosted by `ad_rank` → top-10 by reviews → nearest) and the hybrid-anonymity
  name resolution cannot drift between the row and the sheet. Fetched on expand,
  never on page load: the bench renders ~53 categories.
- **The row's search field filters row 2** through that same action.
- **Save uses `saveVendorToPicks`** — the call the overlay's Add already makes.
- **"See all →" still opens `CategorySearchOverlay`.** It owns filters and facets
  the inline row does not. It becomes opt-in; it is NOT deleted.

The three constraints, and where each is enforced:

1. **Save and Inquire only — no Lock, no Add-to-build.** Enforced by absence:
   `lib/inline-more-row.ts` exposes no lock/build decision, and `InlineMoreCard`
   has exactly two action slots. `shortlist-categories.tsx` says in its own
   docblock that the bench is read-only about picks and carries none of that
   machinery "so it can't destabilise those tabs"; saving to *considering* is
   what row 1 already displays, so it stays inside that boundary.
2. **Row 2 inherits the shared-date sink.** `classifyInlineMoreRow` runs the same
   `classifyAgainstBuildWindow` + `partitionByBuildFit` row 1 runs, against the
   **same window instance** — `vendors/page.tsx` already resolves it once for
   `buildFitByVendorId`, and now passes it down rather than letting the row's
   server action resolve a second copy that could drift. Sunk cards get the same
   dim, the same `noSharedDateBadge(clashWith)` and the same
   `DOESNT_FIT_DIVIDER`.
3. **Fail open on availability.** No calendar signal, no probe window, an
   anchored date, or a read that threw → no verdict, nothing sunk. Asserted in
   the unit tests rather than inherited by luck.

**The mis-tap gap, closed.** `saveVendorToPicks` writes to the database and the
bench has no × on a row-1 card, so a fresh save from row 2 keeps its card in
place wearing "Saved to {category} — it's in the row above." plus an **Undo**
that calls the shipped `deleteVendor`. Undo is offered for `status: 'ok'` only —
the action is idempotent, and an undo on `'already_saved'` would delete a pick
the couple made days ago and never asked to lose.

**Flag.** Row 2 rides `isExploreReplanEnabled()`, and not by a new decision: the
"Find" affordance is only a *button* under that flag — with the flag off it is
still the shipped `/explore?tile=` `<Link>`, untouched.

Verified, since the previous session did not: `searchCategoryVendors` is callable
from this context as-is (a plain server action taking `eventId` + `groupId` +
`tile`, with its own membership gate); the un-save path is `deleteVendor` in
`vendors/actions.ts`, the same × the legacy accordion's cards use.

**Known, pre-existing, not fixed here:** `saveVendorToPicks` resolves the
couple's *primary host event*, not the event whose bench is on screen. A couple
hosting two events can save from event B's bench into event A. Row 2 inherits
this from the shipped sheet and the marketplace Save button; fixing it is a
change to a shared action and belongs in its own PR.

SPEC IMPACT: `DECISION_LOG.md` — new row for the 2026-09-06 "we do not want to
leave the page" ruling and the three constraints it fixes on row 2. Applied
directly in the corpus at `~/Documents/Claude/Projects/Setnayan/`.
