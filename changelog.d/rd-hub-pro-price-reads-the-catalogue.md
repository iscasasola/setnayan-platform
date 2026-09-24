## 2026-09-24 · fix(event-hub): the editor's PRO unlock button reads its price from the catalogue

The website editor told couples "Unlock Event Hub PRO · ₱3,500" on three buttons (the locked-row
panel, the editorial panel and the rail's umbrella CTA) as a typed literal, while the owner had
repriced `COUPLE_WEBSITE_PRO` in `platform_retail_catalog_v2` on 2026-09-23. The editor's server
page now reads the row once with `formatV2Sku('COUPLE_WEBSITE_PRO')` — the same read the launch and
save-the-date pages make — and passes a formatted `priceLabel: string | null` to the three client
components. A failed read renders "Unlock Event Hub PRO" with no figure: never a remembered number,
never ₱0. The label logic is one pure helper (`website/editor/_components/unlock-label.ts`), held by
`unlock-label.test.ts`, which executes it and source-scans the editor for any typed peso figure or a
re-spelled unlock CTA. Comment-only statements of the old price in `(shell)/pricing/page.tsx`,
`onboarding-pricing.ts` and `lib/entitlements.ts` no longer state a number.

SPEC IMPACT: None
