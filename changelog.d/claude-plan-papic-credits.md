## 2026-11-13 · feat(catalog): Event Plus 1,000 · Event Pro 3,000 included Papic credits

Data migration `20271344038763_plan_papic_credits.sql` sets `platform_retail_catalog_v2.included_papic_credits` to 1000 for `EVENT_PLUS` (was 100) and 3000 for `COUPLE_WEBSITE_PRO` (was 1000). Owner, 13 Nov: "event plus make it 1000 / event pro make it 3000". Readers (`lib/sku-activation.ts`, front door) already read the row. Only a stale comment in `lib/iap/products.ts` named the old numbers. No admin field edits `included_papic_credits` yet (follow-up).

SPEC IMPACT: DECISION_LOG row 2026-11-13 "PAPIC CREDITS IN THE EVENT PLANS".
