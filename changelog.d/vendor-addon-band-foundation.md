## 2026-07-25 · feat(vendor-pricing): put the AI Chatbot + Deep Search on the tier band (flag-dark)

The plumbing foundation both variant splits need, **without** committing to where
the Basic/Advanced line falls. Today's flat SKUs now price off the code SSOT band
when `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` is on:

- **AI Chatbot** → `ai_chatbot_basic` band — **₱2,000** Free/Solo · **₱1,500** Pro/Ent.
- **Deep Search** → `deep_search_about_you` band — **₱1,000** Free/Solo · **₱500** Pro/Ent.

Safe to land before the Basic/Advanced question is answered because **today's
capability set lands in Basic under every candidate split** — repricing the
existing flat SKU to the Basic band commits to nothing about the Advanced line.

**No migration.** Both entitlement gates are 100% TypeScript (unlike Papic, whose
`papic_create_vendor_challenge` RPC carried a SQL tier `RAISE`). Both catalog rows
and both `offering_type` values already exist. No SKUs added, none renamed.

### The band is INJECTED as the input, never as the output

Both resolvers short-circuit to ₱0 **before** they read `cyclePricePhp`:
`resolveVendorAiAddonPricePhp` on the free first cycle, and
`resolveDeepSearchPricePhp` on a Pro+ vendor's first run of the 28-day cycle.
Replacing the resolver's *result* with the band price — the obvious-looking
edit — would have **silently deleted the Pro+ free search** and **billed the AI
trial**, with no type error and no failing test anywhere else. The band therefore
goes in as `cyclePricePhp`, matching `booth-addon-actions.ts`. Six new tests pin
this on both resolvers.

- `subscription/ai-addon-actions.ts` · `subscription/page.tsx`
- `deep-search/actions.ts` · `deep-search/page.tsx` · the Deep Search doorway tile
- Also removes the last two hardcoded `₱1,500` strings in AI user-facing copy
  (wrong on the entry band); they now print the vendor's own renewal price.

### ⚠ One owner-visible consequence at flag-flip

This implements the **already-locked** price table
(`Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 2), so it is not a new pricing
decision — but it is worth stating plainly rather than burying: **Solo pays more.**
AI ₱1,500 → ₱2,000/28d (+33%) and Deep Search ₱500 → ₱1,000/search (2×), with no
capability change. Pro/Enterprise/Custom are unchanged at ₱1,500 / ₱500, and the
Pro+ free search stays free. **Nobody loses an entitlement:** active windows are
untouched, in-flight orders settle at the price they were created with, and no
`service_key` is renamed. If existing Solo holders should be grandfathered (there
is precedent — the Website Pro ₱3,500 grandfather), that is a separate call.

### Deliberately NOT done here

The tier gates stay at **Solo+** for both. Opening them lower would need
`sku-activation.ts:327/:573` to become flag-aware — the same activation-floor trap
fixed for the Pro+ add-ons in the preceding PR — and that is its own decision.

Typecheck clean · 3295/3295 unit tests pass (6 new) · `lint:entitlement-gates` clean.

SPEC IMPACT: None (implements the already-locked § 2 price table).
