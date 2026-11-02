## 2026-10-13 · fix(reply): every step of a guest's reply wears screen 1, and the progress is dots only

The owner's live walk of his own invitation as a guest (production 820508f): screen 1 read "1 of 3", and after
"Joyfully accepts" screen 2 read "2 of 4"; and screen 2 ("Want to be tagged in the photos?") showed grey filled
italic pills under screen 1's white outlined ones.

- **The count.** One question at a time counts the steps the answers so far ask for — a yes opens the questions only
  somebody coming is asked, so the total grew mid-way. The progress is now dots only (no "N of M", the screen reader
  hears "Question 2"), one fixed-size dot per step known so far: a yes adds dots quietly at the end, and going forward
  always fills one more (the old bar's `flex-1` segments drew less filled when a yes added steps).
  `rsvp-one-at-a-time.tsx` `RsvpStepProgress`.
- **The look.** The tagging question drew its own pills — The question style's, hard-coded, with no Look › Buttons
  hook. Each style's answer is now ONE class (`RSVP_ANSWER_CLASS`, `rsvp-styles.tsx`) drawn by screen 1's answers
  and by the tagging question, with the hook; on the reply card the tagging answers also wear the couple's own Yes /
  No look (`data-rsvp-wears`, `lib/rsvp-look.ts`).
- Guard: `app/[slug]/_lib/every-reply-step-wears-step-one.test.ts` (rendered, 72 cards; 5 sabotages red).
  Golden `the-reply-card-is-todays-page.golden.json` re-recorded: only the three "tagging question asked" cases move.
- Lab: `/dev/maker-lab/guest?rsvp=form&door=1` draws the reply page as a guest walks it (`&ask=all`, `&plus=<n>`,
  `&scene=`, `&look=`).

SPEC IMPACT: None in the corpus — implements the owner's live fault report under the 2026-10-11 "OK ALL" delegation
(controller's call: dots only, no number). Still differs and NOT changed here: a later step's heading is 20 px and
does not wear the question line's look (screen 1's question is the 32 px Fable line).
