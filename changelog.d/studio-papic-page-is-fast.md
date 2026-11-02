## 2026-10-22 · perf(papic): the couple's Studio › Papic page starts its independent reads together

The page's loader asked its database questions one after another — the event row, the Drive grant and
config, the camera rates, the tier config, the One tiers, the entitlement client, the catalogue batch,
the three self-heals, the uploads seat, the guest count, the snapshot, three seat counts, the standings —
though almost none needs another's answer. Each is now STARTED together right after the auth gate
(`lib/start-read.ts`, the Suppliers page's pattern) and awaited where it always was, so every
graceful-degrade branch reads exactly as before. The three self-heal writes (free cameras, free pool,
uploads camera — three different rows) run together, still only after the event row is confirmed and the
host-only entitlement client has answered; every read that must see them (uploads seat, extra cameras,
claim-link seats, standings) still starts after them, and the seat counts after the guest sync. The
gallery's run of show and the connected-Drive panel's two reads also travel together. The page's auth
gate is the shared `getCurrentUser()` the dashboard layout already asks.

Lab (stand-in Supabase, 150 ms per answer, 3 runs, median): content arrives 3.30 s → 1.30 s (document),
3.13 s → 1.23 s (tab tap); 20 → 8 sequential trips; requests unchanged (71). 375 px Chromium: content
visible 3.69 s → 1.92 s; full-page screenshots byte-identical. Client JS unchanged (server-only change).

Guard: `app/dashboard/[eventId]/studio/papic/the-papic-page-opens-fast.test.ts` (7 sabotage runs, each
red → green).

SPEC IMPACT: None
