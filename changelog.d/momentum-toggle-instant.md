## 2026-07-01 · perf(vendor): instant Momentum window toggle (no full-page re-fetch)

Fixes the slow Daily/Monthly/Annual switch on `/vendor-dashboard/performance`
Momentum card. The toggle was a server-navigation URL param (`?momentum=…` via
`<Link>`), so every click re-ran the ENTIRE performance page — ~18 analytics
queries (inquiries, conversion, reputation, capacity, demand, funnel, per-service
scope) under `force-dynamic` (no caching) — just to change one card's window.

Root cause, not a band-aid: all three windows (day/month/year) + both chart
series are already fetched server-side once and passed to `MomentumCard` as
props, so the toggle needs zero re-fetch. `MomentumCard` is now a client
component that switches windows via `useState` — instant, no navigation. The
`mode` prop seeds initial state (SSR / deep-link); toggling keeps `?momentum` in
the URL in sync via `history.replaceState` (no navigation), so share/refresh
still reflect the view and a later service-scope change preserves the window.

Single-file change (`momentum-card.tsx`: `ToggleLink`→`ToggleButton`). Import
graph verified client-safe (`perf-links` importless; `momentum-chart` pulls only
the pure `formatPhp`). No schema change.

SPEC IMPACT: None.
