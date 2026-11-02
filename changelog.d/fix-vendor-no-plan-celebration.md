## 2026-08-05 · fix(vendor-dashboard): the shop overview no longer hands a vendor the couple's plan-your-own-event flow

Owner, looking at the live vendor Overview (`SetnaProd`, 2026-08-05): *"on vendor why is there plan a celebration? there shouldn't be"*.

**What was there.** The business-milestone pill shipped 2026-07-13 (PR #3221) as a pair: a gold "🎉 {shop} — your Nth month in business · in N days" badge **plus** a `Plan a celebration →` link. That link pointed at `/dashboard/create-event` — the **couple-side** create-event picker, the flow where a customer starts a wedding / birthday / debut and begins planning it.

**Why it's wrong.** `/vendor-dashboard` is the business doorway. Sending a shop owner from "your shop, today" into the customer doorway inverts the role the whole surface is built around: the vendor reads their own anniversary and the only action offered is to go be a customer. It was derived from the owner's 07-13 phrasing (*"reasons to celebrate and create events"*) and picked from a 2-question elicit at the time; seen on the real screen, it reads as a mis-routed CTA. The 07-13 pick is hereby reversed by the owner.

**The delta.** Deleted the `<Link href="/dashboard/create-event">Plan a celebration →</Link>` from the milestone row in `apps/web/app/vendor-dashboard/page.tsx`; the wrapper collapses from a `flex flex-wrap items-center gap-2` row (it existed only to sit the badge beside the link) to plain `pt-1.5`. **The milestone badge itself stays** — that was the explicit 07-13 ask and the owner did not object to it. `lib/vendor-milestone.ts` (`businessMilestone()`) is untouched and still fully tested; `Link` is still imported and used elsewhere in the file (the verification banner), `PartyPopper` still renders the badge.

Swept the rest of the vendor surface for the same class of mis-route: `grep` for `href="/dashboard/…"` across `app/vendor-dashboard` + `components` returns **zero** other couple-doorway links, and no test or lint script asserted the CTA copy. A `⚠ RETIRED 2026-08-05` note sits at the milestone derivation so a future session extending the pill doesn't re-add the link.

SPEC IMPACT: `DECISION_LOG.md` — appended a 2026-08-05 row reversing the "celebratory-line + create-event CTA" half of the 2026-07-13 monthsary row (line 2275). The monthsary/anniversary model and every couple-side anchor in that row are unchanged.
