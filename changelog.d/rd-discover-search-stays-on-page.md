## 2026-10-24 · feat(discover): the search answers on Discover — results in place, Clear brings Discover back

Owner, 24 Oct: on Discover he searched "seda" and was taken to `/dashboard/search` — *"it went to a different page?"* —
and pressing Clear there left him on a page that said "Type what you're looking for in the search at the top." with
no search at the top or the bottom. Ruling (same as Suppliers and Guests, #6864): *"we will show the result on the
page itself. not a new screen."*

- **Discover's search row stays on Discover.** Enter puts the words in the page's own `?q=` (`stayOnPageSearchHref`,
  `lib/shell-search.ts` — it only edits the query string), the results take the sections' place under the same row,
  and ✕ / emptying the box / the results' Clear bring the sections back. `app/page.tsx` no longer redirects a member's
  `?q=` to `/dashboard/search`; `FrontDoor` draws the shell's results form (`place="discover"`: your events and
  suppliers, people, shops, stories and guides; no door out to the marketplace).
- **No words is Discover, never a blank page.** `/dashboard/search` with an empty `q` goes to `/` before drawing
  anything (its "search at the top" sentence is gone); with words it still answers for the palette's step-out and
  the store app.
- **A supplier you added yourself says so:** "Your own supplier · on Indalecio & Claire" (`YOUR_OWN_SUPPLIER`, the
  add walk's own words) where `event_vendors.marketplace_vendor_id` is null; a shop on your event keeps "On your event".
- **Nothing found, one event you host:** the last row is "＋ Add “…” as your own supplier" (`SearchAddRow`, the same
  file as #6864) → "What they do" → the shipped `AddYourOwnWalk` (name filled in; step 1 checks Setnayan by name,
  step 4 the link + QR), in place. "What they do" is the event's bench scope (`readAddOwnCategories`, the Find list's
  own source). No new server action.
- `resolveShellSearchContext` — the people / find-suppliers / event read, moved out of the search page so Discover
  and `/dashboard/search` read it one way.
- Guards: `app/_components/frontdoor/discover-search-stays-on-page.test.ts`; `lib/shell-search.test.ts` test 3
  re-stated for the ruling (a member's `/?q=` answers on Discover, in the shell form) and its branch anchor.
- Lab: `/dev/search-lab?state=discover`.
- Regenerated: `scripts/port-control-baseline.json`, `lib/ugat/screens.generated.json`.

SPEC IMPACT: None — applies the owner's 2026-10-24 "results on the page itself" ruling to Discover; supersedes the
2026-10-22 hop to `/dashboard/search` for a member on Discover only (the palette's step-out and the store app keep it).
