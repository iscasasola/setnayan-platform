## 2026-07-01 · fix(vendor-dashboard): cut a round trip off every sidebar navigation

`VendorDashboardLayout` re-renders server-side on every sidebar click (it reads
cookies via `getCurrentUser()`, so Next.js can't cache it across navigations).
It was awaiting the layout's whole chrome `Promise.all` — including
`getSwitcherData()`'s own 3-stage sequential chain (membership batch → events →
gallery counts) — before even issuing the vendor tier/wallet queries, then
awaiting those as an unrelated 4th sequential round trip. That serialized an
independent 2-query read behind the slowest, unrelated fetch in the layout on
every single click.

Fix: chain the tier/wallet fetch directly off the already-parallel
`vendorProfilePromise` instead of the full batch, so it fires as soon as the
vendor profile resolves and overlaps with `getSwitcherData()`'s remaining
stages rather than queuing behind them. Cuts one full Supabase round trip off
the critical path of every vendor sidebar navigation. No behavior change —
same data, same fail-soft/expiry-sweep semantics.

SPEC IMPACT: None.
