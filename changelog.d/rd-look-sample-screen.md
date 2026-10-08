## 2026-10-08 · feat(studio): Look shows a sample screen, not the guest page (amendment PR 0)

Owner, verbatim (2026-10-08, shown the guest page's cover above the Look panel):
*"our preview should not be this. but a sample of the header text, buttons on
the actual screen"* · *"this should be a preview of whatever we edit here."*
(DECISION_LOG "THE LOOK PREVIEW IS A SAMPLE OF WHAT IS BEING EDITED — NOT THE
COVER PAGE" and "APPROVED — THE LOOK AMENDMENT PROTOTYPE"; contract
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.D and § 8 PR 0, prototype
part D.) Stacked on `rd/background-source-cards` (#6431).

The new Maker's Studio only — the shipped Maker (the flag off) keeps its page
frame. No new data, no migration, no new server action, no new read.

- **The sample screen** (`look-sample.tsx`): the small label, the names in the
  Headings face with the "&" in Accent 2, a rule, the date, one line of text and
  the two real buttons ("Reply to the invitation" · "Details"), on the real
  background — the page colour or its blend, or the picture / film behind every
  scene under the veil the page's own rule measures. One sample for Background,
  Elements and Music (Music adds the speaker while it is the tab open).
- **It is the guest page's own look, not a drawing of one.** The sample wears
  the guest scope's attributes and variables, resolved by `guestLookFrom`'s own
  sequence (`lib/look-sample.ts`), and its buttons are the guest page's classes.
  The guard RUNS the guest page's function beside the sample's over 4,200 looks
  and fails on the first value that differs.
- **It answers at the tap, with no request.** Each Look control tells the sample
  what it drew (`lib/look-sample-store.ts`: a Background pick, a picture while
  its colours are read, a button shape, one of the five colours, the font); a
  refusal puts the old value back. The store asks for nothing and starts no timer.
- **Look mounts no guest-page frame.** Opening Studio › Look fetches no
  guest-page document for Look (it mounted its own frame of the page), and a
  pick redraws one page fewer. The whole page is where it always was — Stages.
- The sample's seed is built by the editor page from values it already read
  (the drafted look columns, the main background, the addresses the Background
  panel was given); the theme's faces travel as class names from the server.
- `globals.css`: inside the dashboard the guest button classes are re-pointed to
  the dashboard's gold; under `[data-look-sample]` they are handed back the
  guest page's own tokens, before the host's Buttons rules.

Guard: `lib/the-look-sample-is-the-guest-look.test.ts` (6 tests; 21 sabotages
seen red).

SPEC IMPACT: None beyond the contract above —
`LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md` in the corpus is updated with this step.
