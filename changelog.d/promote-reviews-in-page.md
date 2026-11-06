## 2026-11-06 · feat(shop): reply to reviews in place — Shop › Page › Reviews and stories

Owner, 6 Nov: *"Use fable to decide. Find the best location for each. Make the pages live there and not jump to
another menu."* — DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL": **Page › Reviews and stories** = read +
reply to reviews in place; `/reviews` forwards there.

- RULE 0: the review card, the one public reply form, the read-only posted reply and Flag as fake existed on
  `/vendor-dashboard/reviews`; Page's fold had a "Reply to a review" row that jumped there. Delta: the card and its
  forms are LIFTED into `website/_components/review-replies.tsx` (server-drawn, handed to `PageParts` as
  `reviewsBody`, the `domainBody` slot pattern) and drawn inside the fold; the row is gone.
- One read: `page-data.ts`'s reviews read now serves the pin picker (its first 20, as before) AND the reply list (up
  to 200, the old page's limit — the cap is said). A refused read is said, never "no reviews". Waiting reviews first.
- `reviews/actions.ts`: reply and flag revalidate `/vendor-dashboard/website` (the desk's own revalidation stays).
- `/vendor-dashboard/reviews` forwards to `/vendor-dashboard/website#reviews` (its loading skeleton removed). A link
  to ONE review (`#reply_<id>`, from Today and the Answers Desk) now points at `/vendor-dashboard/website#reply_<id>`;
  Page opens the fold through its `#reviews` anchor and brings that reply box into view.
- Doors retargeted: Today's review task, the Answers Desk's "Open the review", the couple-side review notifications
  (`relatedUrl`), the growth recommendation; Reviews left the shop shelves (Settings › More tools 13 → 12) and the
  Shop tab's `activeMatch`.
- Not carried over from the old page: the stats tile (star breakdown, per-axis averages), the "Recommended by N
  couples" pill and the Track record list. Track record keeps its own page (Settings › More tools); the rating and
  count stay on the fold's line and on Analytics.
- Baselines moved with the lifted code (field template 1, dark label contrast 1; the card line was fixed instead —
  the flag popover dropped its border). Port baseline + screens map regenerated; the fixed "Reply to a review"
  wrong-words line dropped.

SPEC IMPACT: None — implements DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL" (reviews row); no corpus edit.
