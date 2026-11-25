## 2026-11-24 · feat(social): the 21 supplier Facebook posts, kept out of the queue until the Meta app is Live

The owner approved Batch 1 on 24 Nov ("supplier posts to december appoved"). It includes 21 Facebook posts that bring suppliers to Setnayan, shown in the approved image look. Meta's business verification is still in review, so the controller ruled that the posts "must NOT post until I confirm the Meta app is Live".

- New source: `lib/supplier-facebook-series.ts` holds the 21 captions, with at most 3 lines of at most 12 words each. Each post links once, to /for-suppliers or /open-shop.
- New images: `public/marketing/2026-11-24/facebook/supplier-01…21.jpg`, each a 1080 × 1080 JPEG.
- Held by staying **out of the queue**: this PR writes no `social_posts` row and has no migration.
  - A far-future `publish_after` would also have held the posts, but the governor would give each row a far-future `scheduled_for`. The evergreen floor counts any such row as recent activity, so it would have gone silent for as long as the hold lasted.
- The release comes later, after the controller confirms Meta is Live, in three steps:
  1. Run `pnpm migration:new`.
  2. Fill in `SUPPLIER_SERIES_RELEASE` (the file, the start day, the days between posts).
  3. Run `npx tsx scripts/gen-supplier-facebook-series.ts --write`.

  That migration queues each post as an `announcement`, with its own image (a photo post), the link in the caption, and `publish_after` set to its day at 11:00 Manila. The cadence governor and both switches still apply.
- New test `lib/supplier-facebook-series.test.ts` checks:
  - no migration queues the series while the release is unset, and the release migration equals the source once it is set;
  - the caption limits and real pages;
  - no typed peso figure or retired word;
  - the images exist, at 1080 × 1080;
  - the release SQL, which never uses a `journal:` ref, so it cannot double with the Articles sweep (#8268).

  Each check was sabotage-run red.

SPECS IMPACT: None. This is content under the Social Sharing Program § 8 queue. The owner's Batch 1 approval is recorded by the controller.

**Owner, 25 Nov ("reword both"):** two captions now follow the word rules.
- #20 was "0% fee on clients you bring. Your couple never pays a Setnayan fee." It now reads "No booking fee on clients you bring. Hosts pay 0% commission.". That is the one allowed 0% line, and couples do pay for Event plans.
- #21 was "Try it. No risk." (too close to a promise). It now reads "Try it. Open free, no card. Leave anytime from your Profile."

The images carry no caption text, so they are unchanged.
