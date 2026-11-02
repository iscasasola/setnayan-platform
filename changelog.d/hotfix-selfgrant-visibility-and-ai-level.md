## 2026-07-26 · fix(security): close two live self-grant holes — vendor self-verification, and an AI Advanced re-arm

Two reviewer-flagged findings on `main`, both verified by reproduction before
fixing (a third claimed hole was checked and found already guarded, so nothing
was shipped for it).

### L1 · A vendor could mark themselves "Verified" — and undo a suspension

Same root cause as `20271002456914`: `vendor_profiles_owner` is
`FOR ALL USING (user_id = auth.uid())`, Postgres RLS is **row**-level only, and
there is no column-scoped GRANT — so any column
`guard_vendor_profiles_entitlement` doesn't NAME is vendor-writable. It covered
tier/seats and the add-on windows, but not the two **trust** columns:

```
PATCH /rest/v1/vendor_profiles?user_id=eq.<self>
{ "verification_state": "verified", "public_visibility": "verified" }
```

- `verification_state` drives the public **Verified badge** (`is_verified`,
  `app/v/[slug]/page.tsx:397`) — a trust/safety failure, not just revenue. The
  badge is what tells a couple this business was checked.
- `public_visibility` restores marketplace visibility, **reversing the admin
  visibility freeze** applied to a suspended vendor.

Migration `20271004444950` extends the guard to both, on UPDATE and INSERT.
Audited safe: every writer of either column lives under `app/admin/`; there is no
vendor-facing write path.

⚠ The INSERT branch compares against the **real column defaults** — `'unverified'`
and **`'coming_soon'`** (not `'hidden'`), both enum-cast. A first draft guessed
`'hidden'` and would have rejected every vendor registration; a test now pins it.

### L2 · Buy AI Advanced once, renew on Basic forever — a bug I shipped yesterday

`activateVendorAiAddonOrder` read `ai_addon_level` with **no window check**, and
`nextVendorAiLevel` takes the higher rung. Nothing clears the marker on lapse
(expiry is evaluated at read time — there is no cron). So: buy Advanced → let it
lapse → buy **Basic** → Advanced re-arms, indefinitely. ~₱1,000/cycle × 13 cycles
= **~₱13,000/vendor/yr**.

It was harmless while Advanced was an empty rung — the voice-match work is what
would have made it worth exploiting.

The pure function was right; the **caller** was wrong. It now passes `null` once
`isVendorAiAddonActive(currentExpiry)` is false — a lapsed rung is spent, and the
new purchase alone decides the level. The caller contract is documented on
`nextVendorAiLevel`, because my own test had encoded the buggy behaviour as
intended.

### Verification

- L1: 4 new DB tests; **verified failing without the migration** (2 self-grant
  vectors succeed), passing with it — plus tests that admin verification and
  ordinary registration still work.
- L2: 2 new unit tests pinning the lapse composition. Honest scope: these pin the
  *contract*, not `sku-activation.ts` end-to-end, which has no DB test harness.

Typecheck clean · 3415/3415 unit · 185/185 db · migration-timestamp guard clean.

SPEC IMPACT: None (defensive fixes; no pricing or capability change).
