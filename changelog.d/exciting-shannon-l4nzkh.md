## 2026-11-24 · [migration] Deep Search: the ₱499 sale is retired, 1 search a month on Plus · Pro · Ultra

Owner rulings, DECISION_LOG 2026-11-22: ✂️ "DEEP SEARCH IS RETIRED" (*"Retire it"*), 🧰✅ "SPECIAL TOOLS STAY INSIDE THE PLANS" and 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH" (*"Deep Search 1 a month"*). Measured 24 Nov: `vendor_billing_catalog.vendor_deep_search` was still on sale at ₱499, /llms.txt said "Deep Search ₱499 a search", and /features called it Paid.

- **Migration** `20271362032052_deep_search_sale_retired_monthly_allowance.sql`:
  - It retires the `vendor_deep_search` row (`is_active = false`, `retired_at`, and a `retirement_reason` that quotes the owner). The row is kept, not deleted.
  - It adds `platform_settings.deep_search_runs_per_month` (1–31, NULL means none included), seeded to the owner's 1.
  - It adds `vendor_deep_search_uses.allowance_slot`, with a unique index on (shop, paid-month start, slot). This replaces the old one-free-per-28-days index.
- **The run:**
  - `runVendorDeepSearch` now mints no order and no payment, and reads no price.
  - The gates run in this order: plan (Plus, Pro, Ultra) → verified → the research engine is on → the admin's monthly number is read → one of the month's runs is claimed before the search (`claimIncludedDeepSearchRun`, atomic on the index).
  - The search runs after the response (`after`, `maxDuration = 300` on the Deep Search page and Shop › Details). A failed run hands its claim back (`releaseIncludedDeepSearchRun`).
  - Runs reset each paid month (`deepSearchMonth`, counted from `tier_expires_at`; the Manila calendar month when there is no future expiry). Unused runs don't carry over.
  - An order paid before the retirement still runs on approval (`activateVendorDeepSearchOrder` is kept).
- **Free and Verified:** they get no runs, whatever the paywall switch says. They see what a search finds, then "Included in Plus · Upgrade" (a button to the Plans page).
- **Admin:** a new field on Admin › Settings, "Deep Search — searches each paid month on Plus, Pro and Ultra". It is saved by the existing settings action (no new server action) and locked when its value can't be read.
- **Sale doors removed:**
  - the runner's "Run Deep Search — ₱N" button, its pay rails and its price line
  - `lib/vendor-deep-search-offer.ts`: price and rails replaced by this month's runs
  - `deep_search_about_you` removed from the add-on band map, along with `resolveDeepSearchPricePhp`, `fetchVendorDeepSearchPricePhp` and the ₱499 fallback
  - the Plans page row, the plan table and so `/llms.txt`: a Tools row, "N searches a month" on Plus, Pro and Ultra, "Not included" on Free
  - `buyMoreLine`, the Shop › Details ⓘ ("What your plan includes")
  - `/features` C30: a new `in-plans` price kind, "Included in Plus · Pro · Ultra"; its line now says what Deep Search does
  - the privacy notice's "a paid tool"
- **Guards:**
  - new `lib/deep-search-is-never-sold.test.ts`: no order, price or pay page in the run; no price reader; the SKU only on the paid-before path; no peso or "a search" on any public line, `/llms.txt` included; no later migration puts the row back on sale; the allowance is the admin's
  - new `tests/db/deep-search-is-included-monthly.db.test.ts`
  - updated, citing the 22 Nov rows: `vendor-deep-search-addon`, `shop-details-v13-holds`, `the-plan-is-rows`, `supplier-plan-table-tells-the-truth`, `upsells-obey-the-switch`, `vendor-addon-tier-pricing`, `vendor-addon-first5-free`, `money-names-and-reach`, `every-buy-button-lands-on-the-payment-page`, `order-price-authority`, `s41c-supplier-batch-c-reads-are-honest`, `deep-search-one-price-and-plan-caps.db`

SPEC IMPACT: None. It builds the 22 Nov rulings as written. The controller's call "unused runs do not carry over" is already in the 🔎 row.
