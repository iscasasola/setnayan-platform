## 2026-08-07 · chore(tokens): finish the retirement — the currency had two writers nobody had found

Owner lock 2026-07-21, verbatim: *"token can retire, there should be nothing that
needs token anymore."* PR #4216 took the vendor-facing copy. This takes the rest,
and two paths that were still MINTING.

**The two live writers — neither was on any handoff list.**

1. **`_apply_subscription_credit`** granted a "free bundle" (Pro 5/50 ·
   Enterprise 10/100) plus any folded-in pack every time an admin confirmed a
   vendor's plan payment. #4216 removed the copy advertising that bundle and
   left the grant running. Migration `20271120530202` removes it.
2. **`setVendorTier`** did the same on an admin tier-set.

🔑 **TRACE TO THE WRITE, NOT THE FLAG.** The verification bonus was retired back
in June (`20270110320020`) and every token pack is `is_active=false`, which made
the currency look dormant. It was not: both writers had no flag, no copy and no
UI — only a caller.

**Deleted** (retired means deleted): `/admin/token-purchases` ·
`/admin/token-bands` · the Token bands tab in the pricing studio ·
`/vendor-dashboard/tokens` · the never-mounted token wallet section · the
token-purchase webhook + its notifier · `grantTokensToVendor` · three dead
exports in `vendor-tier-caps` · the token-pack add-on in the plan checkout ·
the **Grant tokens** voucher type in the admin form (its redeem RPC has **zero
callers** — every such voucher was unredeemable from the hour it was created).

**`/admin/vendors/[id]/tokens` was NOT deleted — it was split.** `setVendorTier`
has exactly one caller: that page. Deleting it wholesale would have removed the
only way to put a vendor on Pro/Enterprise. The tier form now lives at
`/admin/vendors/[id]/plan`; the token half is gone.

**Measured in prod before writing** — 0 packs bought · 0 redemptions · 0 holds ·
0 boosters · 0 member wallets · 0 couple briefs. Non-zero: 6 grants · 5 rewards ·
5 vouchers (100 each, unspent) · **5 wallets holding 500 tokens**. Nobody ever
bought or spent one. Balances and audit rows are left alone — the point is that
nothing NEW is minted, not that history is erased.

**Guards:** the admin nav shape guard was verified to FAIL on a re-added orphan
slot before being trusted. `lint-port-no-lost-controls` fired on the deliberate
removals; its baseline is regenerated here so each one is a readable diff line.
7031 unit tests green under both UTC and Asia/Manila.

**Not touched, needs the owner:** `/vendor-dashboard/creators` (a whole feature
whose meter is tokens) and the ACTIVE `vendor_custom_included_token` ₱100/cycle
row on the Custom plan. Both are product/pricing calls.

SPEC IMPACT: `Pricing.md` § 0.C narrated a live vendor token economy while item 8
of the same file already said packs were retired — corrected in this commit.
