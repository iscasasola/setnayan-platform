## feat(vendor-tiers): Solo/Pro/Enterprise 3-tier model replaces Free/Verified marketing surface

**Owner directive 2026-06-25:** retire the Free + Verified public-marketing tier framing;
replace with a paid-only 3-tier ladder: Solo ₱2,000/28d · Pro ₱6,000/28d · Enterprise ₱10,000/28d.
Free and Verified remain as legacy DB states for backward compatibility.

### Changes

**DB migration** `20270218000000_vendor_tier_solo.sql`
- `ALTER TYPE public.vendor_tier_state ADD VALUE IF NOT EXISTS 'solo'`
- INSERT `solo_vendor_monthly` at ₱2,000/28d (max_categories=1, max_sub_seats=0)
- `CREATE OR REPLACE FUNCTION public.unlock_vendor_event` — Solo now treated as a paid tier
  (token-burn on inquiry accept, same as Pro/Enterprise; no weekly cap)

**`apps/web/lib/vendor-tier-caps.ts`** (capability SSOT)
- `VENDOR_TIERS` extended to include `'solo'`
- `TIER_CAPS.solo`: 1 category, 0 agent seats, 20km radius, 50 portfolio photos, `inAppGated=true`
- `TIER_PRICE_PHP.solo`: ₱2,000/28d (no annual yet)
- `TIER_SUBSCRIPTION_BUNDLE_TOKENS.solo`: 2 tokens/period
- `TIER_LABEL.solo`: `'Solo'`

**`apps/web/lib/v2-catalog.ts`**
- `getVendorPrices()` adds `soloMonthly` (reads `solo_vendor_monthly` from DB; fallback `'₱2,000'`)
- `num.soloMonthly` added for schema.org Offers
- Removed `verified` from the return value (no longer marketed)

**`apps/web/app/for-vendors/_components/vendor-pricing-matrix.tsx`**
- Complete rewrite: 4-tier 5-column → 3-tier 4-column (Solo / ★Pro / ⬢Enterprise)
- Fixed pre-existing bug: Pro categories showed as `'1'` — now correctly `'3'`
- Mobile switcher: 4 pills → 3 pills, `grid-template-columns: repeat(3, 1fr)`
- Default selection: Pro (index 1) unchanged
- `VendorMatrixPrices` interface updated (removed `verified`, added `soloMonthly`)

**`apps/web/app/for-vendors/_components/for-vendors-deep-dive.tsx`**
- Section intro "Free is a whole business · paid tiers are for growing" → Solo framing

**`apps/web/app/for-vendors/_components/page-tail.tsx`**
- `FAQ` component `vendorPrices` prop adds `soloMonthly`
- "How does Setnayan make money?" FAQ answer updated: 3-tier pricing + Solo token burns

**`apps/web/app/for-vendors/page.tsx`**
- `generateMetadata()` title/description now reference Solo/Pro/Enterprise prices
- JSON-LD: "Free vendor listing" + "Verified Vendor" Offers replaced by "Solo Vendor (28-day)"
- `<FAQ>` call updated to pass `soloMonthly`

**`apps/web/app/how-it-works/page.tsx`**
- Vendor card: "List your wedding business — free" → "List your wedding business on Setnayan"
- Copy now leads with Solo at {p.soloMonthly}/28d then Pro upsell

**`apps/web/app/tl/how-it-works/page.tsx`**
- Same update in Tagalog

**`apps/web/app/pricing/page.tsx`**
- Vendor article in "Start free" block updated: "Sign up free · subscribe to go live" framing
- Subscription grid: `sm:grid-cols-2` → `sm:grid-cols-2 lg:grid-cols-3` (3 tiers)
- Sub-seat label handles 0 correctly: "Solo operator · no agent seats"
- Category label: 1 category → "1 category" (not "1 categories")
- Checklist item "Your free vendor site" → "Verified profile + vendor microsite"

**`apps/web/app/vendor-dashboard/subscription/page.tsx`**
- `PaidTier` extended to include `'solo'`
- `PAID_TIERS = ['solo', 'pro', 'enterprise']`
- `TIER_PITCH.solo` added
- `keyCapLines` handles 0 agent seats gracefully
- `isPaid` includes solo
- Current-plan display badge handles solo
- Solo skipped from annual cycle view (monthly-only; annual SKU not seeded)

**`apps/web/app/vendor-dashboard/subscription/_components/subscription-cards.tsx`**
- `SubscriptionCardData.tier` extended to `'solo' | 'pro' | 'enterprise'`

### Also supersedes

PR #2131 (`fix/how-it-works-pro-copy`) — same file touched; that PR should be closed.

SPEC IMPACT: `02_Specifications/16_Vendor_Benefits_with_App_Evidence.md` — vendor tier table needs
Solo row added. `DECISION_LOG.md` — append 2026-06-25 row for Solo/Pro/Enterprise 3-tier launch.
