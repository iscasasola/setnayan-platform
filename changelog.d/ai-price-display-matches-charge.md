## 2026-07-30 · fix(pricing): what a host is SHOWN for Setnayan AI is now what checkout CHARGES, in either flag state

Closes the "price display mismatch" from the security register — after verifying it, because that register has been wrong four times today.

### What the mismatch actually was

- **Display** (`studio/setnayan-ai/page.tsx`) resolved the price with `resolveSetnayanAiTypePricePhp` — **ungated**.
- **Charge** (`lib/order-charge-authority.ts:143`) takes the per-type branch **only when** `resolveSetnayanAiPerEventPricingEnabled()` is true, otherwise falling through to the flat `SETNAYAN_AI` retail row.

With the flag **off**, a `date` event (tier D) was shown **₱99** and charged **₱1,499** — a mismatch **in the customer's disfavour**, on the one screen where the number is a promise.

### It was not live, and the register's advice was stale

`platform_settings.setnayan_ai_per_event_pricing_enabled` is **`true`** in prod, so the charge path takes the per-type branch and calls **the same resolver the display calls**. The two agree today. The register's *"settle before flipping the flag"* is moot — flipping it on is what closed the gap.

Prod ladder for the record: `SETNAYAN_AI` ₱1,499 · `_B` ₱899 · `_C` ₱499 · `_D` ₱99 (the tier rows are `is_active = false` by design — price *sources*, not sellable cards).

### Why it still needed fixing

The correctness of a customer-facing price was a property of a **setting**, not of the code. And the display's own comment asserted *"checkout re-resolves this same per-type amount server-side"* — true only while the flag is on. **Turn the flag off and the overcharge returns, while that comment reassures the next reader that it can't.**

So the decision moved into **one function both sides share**, `resolveSetnayanAiDisplayPricePhp`: the flag still chooses the *model*, but it can no longer make the shown and charged prices disagree. Flag on ⇒ both per-type. Flag off ⇒ both flat. Tier E (no vendors) still shows nothing in both branches — that's a product fact, not a pricing one, and the off-branch must not start quoting ₱1,499 for a type the product doesn't serve.

### A regression I caused and my own suite caught

My first placement put the function in `lib/setnayan-ai-event-pricing.ts`. Importing `integration-config` for the flag pulled **`server-only`** in transitively and broke that module's *own* unit test — it is deliberately import-light so the tier ladder stays testable under `tsx --test`.

Moved to `lib/setnayan-ai-server.ts`, which already declares `server-only` — the same pure/server split as `r2-client-ref.ts` / `r2-client-ref.server.ts`. **There's now a test asserting the pricing module stays free of `server-only`**, so the next person reaching for the flag from there is told where it belongs instead of discovering it via a red suite.

### Tests — 5 cases

Structural, because what broke was structural (two call sites deciding the same thing independently), not arithmetic: the display goes through the shared resolver · **it must not call the per-type resolver directly** · **one switch name governs both sides** · the flag-off branch prices from the flat `SETNAYAN_AI` row · Tier E returns 0 in both branches · plus the `server-only` boundary guard.

**Probed:** reverting the page to the ungated `resolveSetnayanAiTypePricePhp` — the original bug — fails *"the studio DISPLAY goes through the shared resolver"* by name.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,569/5,569 pass** (including the pricing test my first attempt broke).

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. **No price moves**: with the flag on (as in prod) behaviour is byte-identical; the fix only governs what happens if it is ever turned off. Security register's "price display mismatch" entry can be closed.
