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

## Progress (builder, 2026-10-18)
- [x] /budget product page: split / Save-Standard-Splurge / typical range / overdue call-out → Target·Agreed·Paid·Owed, Next line, three groups, filter/search, exports (mirrors lib/feature-pages/plan-a.ts, already fixed by #6640).
- [x] /guest-list: Maybe → yes/no; Allow plus-one → +1/+2 pick; paste → paste names / CSV.
- [x] schedule/patiktok/pakanta/setnayan-ai fixed (also removed setnayan-ai "chases quiet suppliers / lines up quotes" — value-copy removed `chase` 2026-08-12 as never reaching a person). [ ] celebration/website sweep remaining. Others found by scan: /schedule "invitation site" → Event Hub; /patiktok + /pakanta "cleared for sharing"; /setnayan-ai "weekly digest"; "celebration" on papic/panood/samahan/about/suppliers/pricing/explore/realstories; "website" in palogo/panood/patiktok/papic closings.
- [ ] guard app/(shell)/product-pages-say-what-ships.test.ts + sabotage.
- Decisions: legal pages (privacy, terms, refunds, cookies, acceptable-use) NOT touched — legal text. /pawebsite keeps "wedding website" (it names the category it replaces). lib PAPIC_FREE_CREDIT_CONDITION ("on your first celebration") pinned by the-free-credit-promise-is-true.test.ts — left, named.
- No TL twins exist for the product pages (only /tl/features, from the registry, already fixed by #6640).
