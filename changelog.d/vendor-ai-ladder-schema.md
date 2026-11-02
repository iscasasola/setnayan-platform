## 2026-07-25 · feat(vendor-pricing): Vendor AI Basic/Advanced ladder — SCHEMA ONLY (nothing sellable yet)

The schema half of the AI Chatbot ladder. **Ships no behaviour and sells nothing**
— the Advanced SKU is seeded `is_active = FALSE` because every Advanced capability
is still unbuilt. The code half follows in its own PR, only after this migration
is **verified applied**.

The capability line was **not invented here.** It already exists in
`Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` § 8 and is already mirrored
in the shipped auto-reply schema (`20270822679405`):

- **Basic** = the § 8 "Free (all tiers)" column — deterministic front desk,
  neutral house-voice templates, handoff, ~30/day cap, reply log.
- **Advanced** = the § 8 "Pro/Enterprise" column, i.e. `vendor_bot_config.mode='smart'`
  — voice-match, natural phrasing (**precomputed**, so per-reply cost stays ₱0),
  reply-in-the-couple's-language, lead analytics, higher cap.

### What lands

- `vendor_profiles.ai_addon_level` (`'basic'|'advanced'`, CHECKed, defaults
  `'basic'`, backfilled for every existing row).
- `vendor_ai_addon_advanced` catalog row — ₱3,000, `vendor_addon_recurring`,
  **`is_active = FALSE`**. Seeded at the **entry** band (the higher figure) so a
  catalog fallback can never under-charge. Existing flat row retitled to "Basic";
  its price is untouched.
- The level marker joins the self-grant guard, so a vendor cannot promote
  themselves to Advanced.

### Three constraints that dictated the shape

1. **One window + a level marker, not two windows.** `lib/sku-activation.ts`
   hardcodes `expiryColumn: 'ai_addon_expires_at' | 'booth_addon_expires_at'`, so
   a per-variant expiry column would not typecheck. Both variants stack into the
   existing `ai_addon_expires_at`.
2. **`vendor_bot_config.mode` cannot be the entitlement.** It is vendor-writable
   under `vendor_bot_config_write` — a *preference* that must be **gated by** the
   server-written level, never used **as** it.
3. **The SKU code must start `vendor_`.** `lib/orders.ts isVatInclusiveServiceKey`
   keys off that prefix; without it the admin payment shortfall guard strands
   every order. (The shipped `booth_studio` seed violates this — `20270907924171`
   is the template that was copied instead.)

### Why schema ships alone

PostgREST answers an unknown column with `42703` and nulls the **entire row**, not
one field. Code naming `ai_addon_level` ahead of the migration would blank vendor
reads fleet-wide — and this repo's migration auto-apply is unreliable on bursty
merges. So: migrate, verify, then ship code. The verification queries are at the
foot of the migration file.

### Verified both ways

`tests/db/vendor-addon-selfgrant-guard.db.test.ts` gains 4 tests. With the
migration removed they fail; with it, **13/13 pass** — covering self-promotion
being blocked, the `'basic'` default, the CHECK rejecting junk levels,
service-role still being able to promote, and the Advanced SKU being inactive at
the entry price with a `vendor_` prefix.

Typecheck clean · 150/150 db tests · migration-timestamp guard clean.

SPEC IMPACT: None (implements the already-locked § 8 capability line + § 2 prices).
