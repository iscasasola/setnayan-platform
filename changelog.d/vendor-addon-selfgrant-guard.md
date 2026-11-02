## 2026-07-25 · fix(security): close the vendor self-grant hole on the paid ADD-ON entitlement columns

**A live revenue vulnerability on production.** An authenticated vendor could hand
themselves the paid Vendor AI and 3D Plan Ads add-ons for free, and re-arm their
one-time free trials indefinitely, with a single PostgREST request against their
own row.

### Why it was open

`vendor_profiles_owner` (`20260513120000:62-67`) is
`FOR ALL TO authenticated USING (user_id = auth.uid())`. **Postgres RLS is
row-level, never column-level**, and there is no column-scoped GRANT on the table
— so a vendor may PATCH *any* column of their *own* row unless a trigger says
otherwise. `guard_vendor_profiles_entitlement` (`20270920020000`) exists for
exactly that reason, but guarded only `tier_state`, `tier_expires_at`,
`extra_agent_seats`. The four paid add-on columns shipped later and were never
added to it.

```
PATCH /rest/v1/vendor_profiles?user_id=eq.<self>
{ "booth_addon_expires_at": "2099-01-01", "ai_addon_expires_at": "2099-01-01",
  "ai_addon_trial_used_at": null,          "booth_addon_trial_used_at": null }
```

- `booth_addon_expires_at` → a free branded 3D booth in their couples' **live
  published** 3D Plans (`isVendor3dBoothActive` → `boothIsBranded`) and the
  vendor-side 3D Plan unlock (`vendor-3d-plan-unlock-actions.ts:86`). ₱1,500–2,000/28d.
- `ai_addon_expires_at` → a free Vendor AI window (the auto-reply engine's
  `no_addon` gate). ₱1,500–2,000/28d.
- `*_trial_used_at → NULL` → re-arms the **one-time** free first cycle on demand,
  forever. This also defeats the atomic `WHERE … IS NULL` trial claims in
  `ai-addon-actions.ts` / `booth-addon-actions.ts`, whose entire safety argument
  is that the marker is write-once.

Revenue only — no other vendor's row is reachable (the `USING` clause still pins
`user_id = auth.uid()`).

### The fix

Migration `20271002456914` extends the **same** guard to all four columns, on both
the UPDATE and INSERT branches. Verified safe: every legitimate writer is the
**service-role** client (`ai-addon-actions.ts:179`, `booth-addon-actions.ts:246,256`,
`sku-activation.ts` activation hooks), which never matches
`current_user IN ('authenticated','anon')`; `public.is_admin()` still exempts the
admin console; and an ordinary profile edit keeps every guarded column `= OLD`, so
it no-ops.

### Proof, not assertion

New `tests/db/vendor-addon-selfgrant-guard.db.test.ts` replays the real migrations
against PGlite and impersonates the vendor role. **Verified both ways:** with the
migration removed, 6 of 9 tests fail — every self-grant vector succeeds, which is
today's production behaviour. With it, 9/9 pass. Coverage includes each column,
the trial re-arm, the pre-granted INSERT, that service-role activation still
works, and that an ordinary profile save is unaffected.

*(Aside found while testing: the DELETE-then-re-INSERT variant is separately
unreachable — deleting the profile trips `VENDOR_LAST_ADMIN` in
`vendor_team_guard_trg`.)*

The function comment now carries the standing rule: **every new paid entitlement
column must be added to this guard**, or it is vendor-writable the day it ships.

Typecheck clean · 3295/3295 unit · 146/146 db tests pass · migration-timestamp guard clean.

SPEC IMPACT: None (defensive fix; no pricing or capability change).
