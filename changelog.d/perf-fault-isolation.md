## 2026-07-02 · fix(vendor-performance): fault-isolate the My Performance data batch

The vendor **My Performance** cockpit (`/vendor-dashboard/performance`) crashed
into the `/vendor-dashboard` segment error boundary ("Your shop console is
temporarily unavailable") for the founder vendor. Root cause was NOT schema or
data — a live-DB audit confirmed every column (`vendor_profiles.tier_state`) and
all 16 analytics RPCs exist and return cleanly for the founder's real data, and
every card is already designed to degrade to an empty state.

The defect was **missing fault isolation**: the page fans ~15 analytics reads
across two `Promise.all` batches. The readers handle a PostgREST `.error`
gracefully, but a reader that *rejects* (transient network blip, cold-start
hiccup, statement-timeout surfacing as a thrown fetch) rejected the whole
`Promise.all` and blanked the ENTIRE surface — even though only one reader
failed. Only 2 of the ~15 readers (`services` + `catalog`) were already guarded
with `.catch(fallback)`.

Fixed:

- New `safeRead(promise, fallback, label)` helper in
  `app/vendor-dashboard/performance/page.tsx` — `Promise.resolve()`-wraps so it
  also adopts the raw PostgREST query builders (thenable, no `.catch` of their
  own), logs on failure (Sentry still captures via the global handler), and
  yields the SAME fallback the reader returns on `.error`.
- Every reader in both batches + the standalone `serviceBookedCount` now routes
  through `safeRead` with its card-appropriate fallback (`null` / `[]` /
  `EMPTY_RADAR` / empty funnel totals). One reader failing now costs one empty
  card, never the whole cockpit.
- Exported `EMPTY_RADAR` from `lib/demand-radar.ts` for reuse as a fallback.

No success-path behavior change — identical values render when every reader
succeeds; the only new behavior is graceful per-card degradation on failure.

SPEC IMPACT: None (defensive hardening of an existing surface; no SKU, schema,
pricing, or product-decision change).
