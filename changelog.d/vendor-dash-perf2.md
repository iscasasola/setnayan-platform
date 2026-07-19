## 2026-07-01 · perf(vendor-dashboard): close the remaining shell + subpage latency gaps

Follow-up to PR #2529. Addresses the gaps that PR left open:

- **`getSwitcherData` waterfall flattened** (heaviest remaining layout loader,
  runs on every render incl. Server-Action re-renders). The `vendor_favorites`
  query depends only on `userId`, so it moves into the first parallel batch
  instead of running as a tail query; the profile-photo presign now overlaps the
  events→gallery chain instead of awaiting after it. No data dropped — the
  vendor doorway still receives full events/gallery/favorites (a vendor who is
  also a couple keeps their switcher content).
- **Token-expiry sweep gated** — the `after()` sweep now only schedules when the
  wallet holds `earned_tokens > 0`. Only earned tokens expire, so it's a
  guaranteed no-op otherwise; this drops a pointless background write on every
  render for vendors with a zero earned balance.
- **`clients/[eventId]` "launch a client" waterfall collapsed** — editorial
  eligibility, completion handshake, cocktail-editability, the timeline/
  suggestions/contract trio, and delivery handovers were five sequential steps
  after the booked-gate. They're independent, so they now run in one parallel
  batch; only the change-order trail (needs the event_vendor id from the
  completion row) follows it.

Gap #2 (Server Actions re-rendering the dynamic layout) is framework-inherent —
there is no per-action opt-out in the App Router. The mitigation is a cheap
layout, which PR #2529 + this change deliver.

Verified: `tsc --noEmit` clean · `next lint` clean · full `next build`
succeeds (all vendor-dashboard routes compile).

SPEC IMPACT: None. Behavior-preserving perf work.
