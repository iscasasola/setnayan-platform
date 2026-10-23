## 2026-10-23 · perf(memories): the album shelf starts beside the wall; one sign-in check

Owner priority (23 Oct): *"consistency and reliability that we run smoothly … And fast."* Measured with
`app/dashboard/(account)/library/memories-page-reads.harness.ts` — the REAL Memories page, then the `<AlbumShelf>` it
draws (React draws it only after the page returns), against a database that counts how deep each request ran:

- **Depth 7 → 5**; simulated at 150 ms a trip, **1,068 → 763 ms**. Same 14 requests.
- `app/dashboard/(account)/library/page.tsx`: STARTS `getPhotosAlbums(user.id)` beside the wall it awaits, so the shelf
  finds its answer in flight instead of beginning after the wall; uses `getCurrentUser()` (remembered per request)
  instead of a second `supabase.auth.getUser()` round trip.
- `_data/photos-albums.ts` `getPhotosAlbums` is `cache()`d per request — the shelf and the Albums view (both drawn on
  that view) now share one read instead of making it twice.
- No markup changed; a refused album read is still the shelf's to report.
- Guard: `lib/the-memories-shelf-starts-with-the-wall.test.ts` (shelf reads leave beside the wall's · depth ≤ 5 · no
  read sent twice).

SPEC IMPACT: None.
