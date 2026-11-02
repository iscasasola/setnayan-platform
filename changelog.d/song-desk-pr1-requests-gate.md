## 2026-07-30 · fix(security): the act's song-requests window is a paid switch — close the API path that let any free-tier band flip it

**The defect.** `vendor_dayof_configs.song_requests_open` (20271014100000) was governed by `vendor_dayof_configs_vendor_update`, which asks exactly one question: *is this your row* (`current_vendor_profile_ids()`). It never asked whether the vendor holds the `song_desk` specialization — the thing actually being sold (`SPECIALIZATION_MIN_TIER = 'solo'`).

Postgres RLS is ROW-level, never COLUMN-level. The anon key is public and PostgREST is reachable directly, so a **free-tier band booked on an event** could

```
PATCH /rest/v1/vendor_dayof_configs?vendor_profile_id=eq.<their own>
{ "song_requests_open": true }
```

and start collecting guest song requests they had not paid for.

**Verified, not assumed:** `resolveVendorSpecializationAccess` is imported only by `vendor-dayof-frame.ts`, `specialization-slot.tsx` and `live/[eventId]/page.tsx` — the RENDER path. No write path checked it. This is the frame's own documented warning landing as a real hole: *"the frame guarantees your component is only MOUNTED for an entitled vendor — it does not authorise your queries."*

**Harm today is nil** — no UI writes the column and the window defaults FALSE. That is exactly why it closes now, *before* the song-desk UI ships (PR 2 of `Song_Desk_BUILD_ORDER_2026-07-27.md`).

### The fix — a structural control, not another guard

Migration `20271020159662` applies the same mechanism as `20271005100000` (events column privileges): RLS keeps deciding WHICH ROWS, the grant decides WHICH COLUMNS. Postgres cannot subtract a column from a table-level grant, so table-level INSERT/UPDATE is revoked from `authenticated` and an allow-list is granted back — **computed at apply time** as "every column MINUS the deny-set", never hand-enumerated. The deny-set is one column; a defect is not an excuse to lock neighbours no exploit names.

`SELECT` is untouched: a vendor reading the state of their own switch is not the sale.

The migration carries three **post-conditions** asserted against the live catalog, so a half-applied or silently-ineffective grant fails the migration rather than shipping: the column is unwritable, `enabled_modules` is still writable, and the column is still readable.

**The write path becomes `setSongRequestsOpen`** (`app/vendor-dashboard/on-the-day/actions.ts`) — auth → booking → `resolveVendorSpecializationAccessForVendor` → `holdsSpecialization(access, 'song_desk')` → write as `service_role`. The entitlement is resolved in TypeScript deliberately: that resolver folds in the admin free-window promotion and the mid-event lapse, and a SQL copy of those rules would drift from the copy every render path already uses. Because `service_role` bypasses RLS entirely, the two checks RLS used to make are re-made explicitly above the write.

### A trap found while building it, worth more than the fix

The obvious implementation — upsert the flag onto `vendor_dayof_configs` — **would have silently switched off the vendor's entire generic day-of kit.** A fresh row defaults `enabled_modules` to `'[]'`, `fetchDayOfOverride` returns that empty array (truthy), and `resolveModules` treats a present override as authoritative → every module resolves `enabled: false`. Opening the requests window would have darkened the whole console as a side effect.

So the action **updates when the row exists, and seeds `enabled_modules` with the vendor's current defaults when it does not** — which is exactly equivalent to "no override". Anyone adding a third column to this table must do the same; the empty array is not a neutral value here.

### Exposure baseline — includes one unrelated, pre-existing narrowing

Regenerated in this PR (the freeze requires it in the same PR as the migration). Two intended lines:

- `tpriv public.vendor_dayof_configs|authenticated` `SIU` → `S`
- `col …song_requests_open` `authenticated=SIU` → `authenticated=S`

The diff **also** drops `papic_event_point_grants` and `papic_event_pool_config`. Those are not from this change: migration `20271019231590` (#3868, 2026-07-29) `REVOKE ALL`'d both tables and did not regenerate the baseline. Removals are narrowings, so CI never failed and the stale lines survived. They are absorbed here rather than hand-edited out — the baseline is a generated file and a partially-regenerated one is worse than an honest one.

**Verification:** `test:db` 619 pass (5 new, section 7 of `tests/db/song-requests.db.test.ts`, asserting the privilege by `has_column_privilege` for both verbs, both roles) · `test:unit` 5381 pass · `typecheck` clean · `lint` + `lint:entitlement-gates` clean.

SPEC IMPACT: None — no SKU, price, flag or product-surface change. Enforces the already-locked 2026-07-26 rule ("specializations work only if they are subscribed") on a write path that was missing it.
