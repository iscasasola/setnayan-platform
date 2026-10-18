# HANDOVER — rd/product-pages-truth · started 2026-10-18 ~19:50 PHT by the controller

Follow-up named by the features-pages refresh (#6640, LIVE e3e6434): the public PRODUCT pages outside /features still say
false things: `app/(shell)/budget/page.tsx` + `lib/feature-pages/plan-a.ts` describe Save / Standard / Splurge estimates
(removed); the /guest-list product page says "Allow plus-one" (it is now a +1 / +2 pick) and possibly "Maybe" replies.
Fix the words to what ships, EN + TL twins, same guard style as `app/features/features-page-says-what-ships.test.ts`
(extend that guard or add a sibling that covers these pages — ban the false phrases with reasons). Search the other
public marketing pages for the same stale claims (grep "Splurge", "Allow plus-one", "Maybe", "invitation site",
"celebration") and fix any you find. Say "Event Hub", never "website/site"; "event", never "celebration".
Small PR. Commit + push after every step; HANDOVER current — the account may stop you any time.
Fragment changelog.d/rd-product-pages-truth.md.
