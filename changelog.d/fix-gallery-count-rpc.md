## 2026-07-01 · perf(account-switcher): stop pulling every photo row just to count them

`getSwitcherData()` (consumed by every dashboard layout's account switcher —
customer/vendor/admin all call it) computed the gallery photo count per event
with `.from('papic_photos').select('event_id').in('event_id', eventIds)` —
transferring one row per photo across every event the user belongs to just to
tally them in JS. For a wedding with a full Papic gallery (thousands of tagged
photos), that's thousands of rows crossing the wire on every render of any
dashboard chrome.

Added `public.current_user_gallery_counts()` — a `SECURITY DEFINER` RPC that
does the `GROUP BY`/`COUNT(*)` in Postgres and returns only the per-event
totals. Self-gated via the existing `current_event_ids()` helper (no event-id
input, so there's nothing to validate/spoof). Verified against prod (rolled-
back txn): matches the manual per-event counts exactly for a real member/
event pair (8 and 5 photos).

SPEC IMPACT: None.
