## 2026-10-12 · feat(hub): "What guests see" — the rows that are not scenes become real boxes (pass 2); the RSVP column folds (pass 3, in part)

Owner, on the parked list: *"this was already always supposed to be built but move everytime"*. Pass 1 (the
table, the sheet, `stage_show`) is in Batch B. This is the parked rest. Built on `preview/batch-b-event-hub`
(d2becf325), then joined onto main d2e38b7c1 (no textual conflict). **Built, not live.**

### Pass 2 — the fixed rows

- **One more stored value, on the road the first one took.** `invitation_widgets.config_json.part_show.<part>.<stage>`
  on the HERO row (`lib/stage-scenes.ts`: `PART_SHOW_KEY`, `FIXED_PARTS`, `sanitizePartShow`, `partShown`,
  `configWithPartShow`). Same shape as `stage_show` (false hidden · true shown · absent = our pick), same road:
  draft sanitiser → `mergeHubDraft` (part by part, stage by stage) → `overlayHubDraftWidgets` → ONE free Apply item
  → the live key in `hub-draft-actions.ts` → a change line by part name ("E-Gifts · Hidden on The Day"). No migration.
- **One reading.** `lib/what-guests-see.ts` gains `partChoice` · `partOnStage` · `partsHiddenOn`.
- **Real boxes** (each flipped on the real page of its stage in `lib/fixed-rows-are-real-boxes.test.ts`):
  E-Gifts · Entourage · Your seat · Live on the four lifecycle stages; Camera on The Day; Photos of you on The Day and
  Post Event. Our picks arrive ticked with the dot.
- **Withheld at the source.** `site-body.tsx` puts a hidden part's own fact into the page's existing "there is none"
  state (`partsOff`), so the body, the Event Bar and the menu stand down together.
- **Every other place a guest could meet it** (`lib/a-hidden-part-closes-its-doors.test.ts`): the page's frame
  (`app/[slug]/page.tsx` — Me's seat line, the bar's camera and photos doors); the part's own page for a guest who
  kept the address (`/pabuya` → not found, as "Accept gifts? — No"; `/find-seat` and `/find-my-table` → back to the
  event's page; `/everyone` → its own "hasn't been shared yet" line); the Day hub's seat card, gift door, stream, wall
  and camera (`/hub`); the rail of doors on every sub-page (`_lib/room-links.server.ts`); the live wall's data
  (`/live-wall`). All through one helper, `app/[slug]/_lib/part-door.server.ts`, which reads the PUBLISHED hero row.
- **The Maker shows the same.** `makerStageList` drops a hidden part's fixed tile from that stage's list and the canvas
  drops its stand-in (`MAKER_FIXED_PART`, `fixedTileHidden`).
- **Still fixed, and why** — Names and date, Place, Reply card (always shown: how a guest knows the event and answers);
  Digital pass (drawn in five places and is how a guest gets in — a box that hid one of five would be untrue);
  Announcements (mounted by `app/[slug]/layout.tsx`, outside the page's reading); Reveal (`events.reveal_stages`, its
  own setting); Camera before The Day (the bar has no camera slot there).

### Pass 3 — the RSVP column

- **Built:** the prototype's fold — "Hide the RSVP column" / "Show RSVP", its two sentences.
- **Not built, and why:** the reply screens' ＋ lines (`lib/rsvp-layout-edit.ts`) add a Heading or a Message the
  couple types (`RSVP_ADD_KINDS = ['h', 'm']`). Nothing in that engine can put a Schedule, a Map or a Countdown on a
  reply screen, so the column's boxes would be boxes that draw nothing. The column stays "Not on the reply screens yet".

### From the owner's run (2026-10-11)

- The Studio list's "What guests see" row has its neighbours' shape: an eye icon, and on the right "Our picks" or
  "N changed" (`guestsSeeRowStatus` — the count the sheet opens on).
- ＋ files Dress code under **The details**, as the table does (`lib/maker-part-groups.ts`: Schedule · Map ·
  Dress code · What to bring).
- **Apply reached the canvas in ~6 s with ✓ reading 0.** Cause: the sheet's save is unheld, so the canvas changed only
  after the whole-Maker render it owes, and the Apply bar's count came with that render. Now the count comes back
  with the write (`HUB_DRAFT_BAR_FIELD`) and every page the Maker shows redraws in place as soon as the write lands
  (`requestCanvasRedraw`); the Maker's render still follows for the navigator.

### After the join onto main (2026-10-12)

- **Door reads through `guestRead`.** `app/[slug]/_lib/part-door.server.ts` reads the published hero row through the
  released failure handling, so a part door fails the way the other doors do.
- **Two cells moved to the prototype's.** Live × Save the Date is a dash ("Live opens on the day."). The mount is
  unchanged: the player still follows the broadcast (owner 2026-09-02), so a stream on air on a Save the Date is still
  drawn there and cannot be unticked. Your seat stays ticked on Save the Date and Post Event: the one seat rule shows a
  table after the day, and before it when seats were opened early, so unticking by default would hide what a guest
  sees today.
- **`/seat` (the venue QR).** Both ways in (a table sign's code; the clean address after the claim hop) go back to the
  event's page when "Your seat" is hidden. The claim hop itself is not gated: it signs the guest in and records the scan.
- **The lab's Day.** `/dev/maker-lab` drew the Day's live hub, Photos of you and Your seat whatever the table said
  (found by the lab walk of 2026-10-12: the Maker's own list dropped them, its canvas did not). A part the couple hid
  now leaves the lab's Day as its tile leaves the list (`app/dev/maker-lab/guest/lab-day.tsx`; pinned in
  `the-lab-canvas-is-the-stage-the-maker-lists.test.ts` G1, sabotaged red then green).

### Tests re-aimed (each carries its reason in place)

`lib/guests-see-table.test.ts` (the counts, now that fixed rows are boxes) · `lib/a-fixed-block-has-its-own-motion.test.ts`
(the photos mount gained its gate) · `lib/maker-part-groups.test.ts` (the new group) ·
`lib/the-guests-see-sheet-is-lazy.test.ts` (the row's new shape).

SPEC IMPACT: None applied. The corpus has no row for what a hidden part's own page says; each page takes the exit it
already had. Flagged for the owner in the report, not written into the corpus.
