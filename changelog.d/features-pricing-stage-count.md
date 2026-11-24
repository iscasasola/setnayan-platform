## 2026-11-24 · fix(pricing): the Event Hub's stages are read from the Maker's list

Found while the December articles were checked against the live site.

- **The fault:** the /pricing "Included with every event" tip for The Event Hub said "all five stages — Save-the-Date, RSVP, the day, Memories, Post Event". Memories is not a stage, and the Invitation was missing.
- **The fix:** the tip and its short line now read the count and the names from `MAKER_PAGE_STAGES` and `makerStageLabel`. They read "5 stages: Save the Date, RSVP, Invitation, The Day, Post Event".
- **New test:** `app/(shell)/pricing/the-hub-stages-are-read.test.ts` checks that the count and names are read, never typed. It was sabotage-run red against the old line.
- **Checked and left as they are:** the /features "5 stages" lines already match the Maker's list.
- **Not in this PR:** the Pabuya rows in `lib/features-page.ts` (a60, b07). #8271, #8265 and #8255 all edit that file.

SPECS IMPACT: None. This is a copy fix to an existing page under the 24 Sep stage-names ruling.
