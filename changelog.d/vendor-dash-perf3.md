## 2026-07-01 · perf(vendor-dashboard): collapse the messages-thread + services waterfalls

Third pass, closing the deep per-page waterfalls left after #2529/#2533:

- **`messages/[threadId]` (the vendor chat thread — the worst offender at ~14
  serial reads after the ownership gate)**: every read below the gate is
  independent except `paxProposals` (needs `livePax`), so they now run in ONE
  parallel batch. `markThreadRead` — previously an **awaited write blocking the
  render path** — joins the batch as a concurrent fire (result ignored): it still
  clears unread on this load but adds zero serial round-trips. Only `paxProposals`
  follows the batch.
- **`services` page**: four consecutive independent reads (linked-services,
  tier/verification soft-probe, time-bound slots, payment schedules) collapse
  into one batch; each keeps its graceful-degrade contract.
- **`fetchVendorOverviewData`**: `eventMeta` + `lockRequests` (independent) now
  run together instead of one after the other.

Deliberately NOT changed:
- **`profile` page** (14 awaits) — it's a cold settings surface; the perf
  complaint is about hot paths (overview/clients/messages). Parallelizing its
  large interleaved body carries real edit risk for negligible user benefit.
- **`getSwitcherData` cross-request caching** — its internal waterfall was
  already flattened in #2533; a proper cache needs revalidation tags wired into
  every event/favorite/photo mutation. Shipping `unstable_cache` without that is
  a staleness bug, so it stays per-render until done properly.

Verified: `tsc --noEmit` clean · `next lint` clean · full `next build` succeeds.

SPEC IMPACT: None. Behavior-preserving; the only visible change is that "mark
thread read" completes concurrently rather than before first paint.
