## 2026-07-25 · feat(vendor-pricing): wire the Vendor AI Basic/Advanced ladder (flag-dark)

The code half of the AI ladder, on top of the verified-applied schema
(`20271003111715`). Still sells nothing: the Advanced catalog row remains
`is_active = false` until its capabilities exist.

- `lib/vendor-ai-level.ts` (**new, pure**) — the rungs, the level↔price-band map,
  and the gates: `coerceVendorAiLevel`, `vendorAiAdvancedActive`,
  `vendorAiBasicActive`, `vendorAiLevelForServiceKey`, `nextVendorAiLevel`.
- `lib/vendor-ai-ladder-flag.ts` (**new**) — `NEXT_PUBLIC_VENDOR_AI_LADDER`.
- `lib/sku-activation.ts` — the Advanced SKU gets a second `EXACT_HOOKS` entry
  pointing at the **same** activation hook (which derives the level to stamp from
  the order's own `service_key`), joins the window-deactivation branch, and gains
  a level re-derive on reversal.

### Four invariants, each pinned by a test

1. **Least privilege on every unknown input.** Anything that is not exactly
   `'advanced'` — `null`, `undefined`, `'Advanced'`, a missing column on a row
   fetched flag-off — reads as **Basic**.
2. **A lapsed window revokes Advanced.** Lapse is automatic at read time and
   nothing clears the level marker, so checking the level alone would grant
   Advanced forever after one paid cycle. Both halves are required.
3. **Advanced is a superset, never a swap.** An Advanced vendor still passes every
   Basic gate, so upgrading can't remove a feature.
4. **Only the Advanced `service_key` promotes, and promotion never demotes.** The
   two rungs share ONE window, so a Basic re-up while Advanced must not strip time
   the vendor paid more for.

### The reversal trap this had to route around

`deactivateVendorAddonWindow` returns **early** when a later cycle still owns the
window (`if (newExpiry === currentExpiry) return`) — which is exactly the
refunded-Advanced-over-live-Basic case. A level reset written inside it would be
skipped in the one scenario that matters, leaving *"refund the Advanced money,
keep the Advanced capability."* So the demotion is a **separate** step with its
own try/catch, and it **re-derives** rather than blind-clears: if another live
Advanced order still entitles the vendor, the level stays. The vendor loses the
rung, not their Basic time.

### Why every level read/write is flag-gated

PostgREST answers a `select` naming an unknown column with `42703` and returns
`null` for the **whole row**. With the flag off no query mentions
`ai_addon_level`, so an environment that hasn't received the migration cannot have
a vendor profile blanked out from under it.

Typecheck clean · 3339/3339 unit tests (11 new) · `lint:entitlement-gates` clean.

SPEC IMPACT: None (implements the already-locked § 8 capability line).
