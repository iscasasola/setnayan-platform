## 2026-08-24 · fix(db): a vendor cannot be charged for a token pack, even if one is switched back on

The vendor token currency was retired product-wide on 2026-08-07. **The charge path and the grant
path were retired at different layers, and only the grant half actually came out.**

`create_vendor_subscription` still carried the entire add-on machinery: it priced a pack from
`vendor_billing_catalog WHERE offering_type = 'token_pack' AND is_active = TRUE`, folded the price
into `amount_php` — the function's own comment calls that *"the grand total the vendor pays"* — and
stored the count. It is `EXECUTE`-granted to `authenticated`, so the checkout sending
`p_addon_token_pack_sku: null` was never the control.

**The only thing refusing that call was `is_active = FALSE` on six catalog rows**, whose prices
(₱400 … ₱20,000) are still sitting in them. Re-activate one — the sort of tidy-up somebody does
while cleaning a catalog — and a vendor is quoted plan + pack, pays the grand total by bank
transfer, an admin confirms it, and nothing is granted.

🔑 **A DATA FLAG IN ANOTHER TABLE IS NOT A REFUSAL.** The rule now lives in the function that
charges, where an `UPDATE` cannot switch it off.

**Re-measured in production before anything was written** (`pg_get_functiondef` · `pg_proc.proacl` ·
row counts — never `schema_migrations`, never a migration comment): all five of the brief's claims
confirmed unchanged. Plus one the brief did not have — **`create_vendor_subscription` is the only
function in the database that writes those columns (0 others)**, so this closes the path rather than
one door onto it.

⚠ **The parameter is KEPT.** PostgREST resolves a function by its exact set of named arguments, and
the checkout sends `p_addon_token_pack_sku: null` deliberately. Dropping it would make every vendor
plan purchase fail — rejected, not thrown. A db test pins the signature.

🔑 **The error code is REUSED, not invented.** `INVALID_PACK` is already handled in the vendor
checkout, which renders *"That token add-on is no longer available."* — the correct sentence for
this refusal, already shipped. A new code would have arrived with no reader.

⛔ Columns not dropped · the six catalog rows untouched · no price, SKU or tier-ladder change.

SPEC IMPACT: None — this enforces the 2026-08-07 retirement that is already recorded
(`Pricing.md § 0.C`, DECISION_LOG 2026-08-07) in the one place that had not caught up.
