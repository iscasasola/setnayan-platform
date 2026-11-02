## 2026-07-21 · feat(admin): Catalog Studio hides retired rows behind a closed drawer — 117 visible rows → 49

Owner: *"on admin pricing. there are so many old pricing that can be deleted already."* The cleanup council audited every pricing row in prod and concluded the opposite of what the request assumed: **the clutter is a missing UI filter, not surplus data.** Nearly every "old price" is already `is_active=false` — invisible to customers, already unsellable — and hard-deleting the rows is both unsafe (`bundle_components` cascades, `papic_tier_config` FKs, orders that would silently lose their labels) and futile (`20260516000000` re-seeds the v1 rows with `ON CONFLICT DO UPDATE`, so a prod DELETE resurrects on the next `db reset`). What was actually wrong is that `/admin/pricing` rendered all of them inline, with no way to collapse them, burying the ~49 rows an admin edits under ~117 total.

**Each of the three catalog sections now renders its live rows, then tucks its retired rows into a closed `<details>` drawer** — `21 retired SKUs — hidden from customers; still editable here`. Measured against prod: Customer SKUs 22 active / 21 retired · Bundles 2 / 2 · Vendor pricing 25 / 2. Section headings became `Customer SKUs (22 active · 21 retired)`. Opening a drawer restores the old view exactly.

**`<details>`, deliberately — NOT conditional rendering.** Every row on this surface is a set of named inputs (`retail.price.<code>`, `bundle.active.<code>`, …) inside the page's single "Save all changes" form, and `saveAllPricing` recovers *which rows to process* from the submitted FormData keys ("Text + number inputs always POST, so the set of row codes is recoverable from them" — its own header docs). Unmounting the retired rows would shrink the POST body and silently change what the batch save covers. A native `<details>` keeps them mounted and submitted, just visually collapsed, so save semantics are byte-identical to before — this is a pure presentation change. It also needs no client JS, which matters in a Server Component.

Also fixed while in here: **`platform_package_catalog` was the one catalog query missing `.order('is_active', { ascending: false })`.** Ordering by price alone is why the removed ₱12,999 *Setnayan Essentials* bundle sorted **above** the live ₱15,000 *Unlock all of Papic* — the dead row led the section. Now active-first like its retail + vendor siblings.

Row → editor-prop mapping for all three tables extracted into local helpers (`retailEditorRow` / `bundleEditorRow` / `vendorEditorRow`) so the live list and the drawer render byte-identical editors; a drifted prop shape between the two would have made a retired row save differently from a live one.

No rows deleted, no migration, no schema change, no change to what any customer sees.

Typecheck + lint clean.

SPEC IMPACT: None — admin-surface presentation only. The audit behind it is logged in the corpus at `Admin_Pricing_Cleanup_Council_Verdict_2026-07-21.md`, which carries the remaining steps (retiring the structurally-broken Add-ons tab, dropping the zombie `token_burn_bands` table, the `vendor_additional_branch` dedupe) and 7 open owner sign-off items — most urgently that the Papic One ladder has no readable price in prod, because `papic_pass_tiers` is active while its four catalog rows are not.
