## 2026-09-05 · feat(mood-board): event-linked gallery photos rank first, with a badge

MB22 — "the standing-out happens where the couple is actually comparing photos." MB20 gave every
event-linked inspiration photo a discreet seal instead of the ordinary URL stamp; this session
does the other half in the picker itself.

**THE TRAP THAT CHANGED THE PLAN.** `moodboard_library_assets.source_event_id` is REVOKED from
`anon`/`authenticated` (MB11, `20271202522764`) — the couple-facing picker (`fetchGalleryAssets`,
the RLS-scoped client) has no SELECT privilege on that column at all, so it cannot read it or
`.order()` by it; either would throw, not silently fall back. New migration
`20271204967268` adds `is_event_linked` — a `GENERATED ALWAYS AS (source_event_id IS NOT NULL)
STORED` boolean, granted to `anon`/`authenticated` while `source_event_id` itself stays exactly as
withheld as MB11 left it. A boolean "came from some celebration" is not the disclosure MB11's
revoke exists to prevent (that was the correlation handle on WHICH event), and it is arguably
already public: MB20's watermark bakes the same fact into the photo's own pixels (seal vs. stamp).
`supabase/security/exposure-surface.baseline.txt` regenerated — the one intended widening is
exactly this column, read-only, nothing else moved.

- `fetchGalleryAssets` (`app/dashboard/[eventId]/studio/mood-board/actions.ts`) now selects
  `is_event_linked` and orders `.order('is_event_linked', { ascending: false })` BEFORE
  `.order('created_at', …)` — event-linked photos first, recency ordering each partition. `total`,
  `withheld` and `hasMore` are untouched: `hasMore` stays `query.offset + query.limit < total`,
  never `assets.length` (that was the named trap — a page may legitimately drop rows, which is why
  the shape is offset-based to begin with).
- `GalleryAsset.isEventLinked` (`lib/moodboard-gallery.ts`) carries the flag through
  `shapeGalleryPage`, which does not itself sort — ordering is the query's job, never the shaper's.
- New `EventLinkedBadge` (`_components/event-linked-badge.tsx`) — "A Setnayan celebration" — mounted
  per-row in `gallery-picker.tsx` from `asset.isEventLinked`, never hard-coded.

**Guards, each sabotaged and confirmed red before restoring** (repeating this arc's own lesson —
MB20's hard-coded watermark variant passed all 35 pixel guards while every seal silently vanished):
dropping the `is_event_linked` order clause, hard-coding the badge's `show` prop to `true`, and
swapping `hasMore` to an `assets.length` check each failed their respective guard. A new
`tests/db/the-gallery-ranks-event-linked-first.db.test.ts` proves the generated column, the grant
(behaviourally, via `SET ROLE`), the FK's `ON DELETE SET NULL` demotion, and the exact `ORDER BY`
clause against real Postgres.

SPEC IMPACT: None — no product-facing decision changed; MB20's earlier owner decisions already
covered the seal/stamp split this session's ordering and badge make visible in the picker.
