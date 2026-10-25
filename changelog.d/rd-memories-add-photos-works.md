## 2026-10-25 · fix(memories): + Add photos sits over the bar, says what it costs, and every upload ends in words

Owner, live: *"adding photos on event memories is not fixed. and adding photos will use up papic credits"* — the ADD
PHOTOS sheet's lower part ran behind the event bar and off the screen.

- **The sheet clears the bar at every width.** The event layout's `<main>` (`.sn-vt-page`) carries a
  `view-transition-name`, so it is the containing block for `position: fixed` and a stacking context: the Sheet was
  placed against the page (starting under the top bar, a full screen-height from there) and layered under the bar.
  Earlier fixes padded the sheet's body by the dock's height — which never covered the top-bar offset and dropped to
  16 px from `lg:` on a tree whose line is `tab:`. All three of the gallery's sheets (the photo's, ⚙ settings,
  + Add photos) now render into `<body>` (`OnBody`, the `PapicBuySheet` pattern); the dock pads are gone.
- **Credits, before choosing.** The sheet shows what this camera can still spend — the presign gate's own read
  (`papic_capture_points_available`; the Unlock pass reads "Your pass covers these"; an unread pot "Couldn't check",
  never 0) — with one short line; the ladder lives in the ⓘ, built from `PAPIC_CLIP_COST_BANDS`. A pick is priced with
  `papicCaptureCost` (the function `recordSeatCapture` bills with) BEFORE anything uploads; if the pot is short it
  says "These need N credits — you have M. Nothing was uploaded." with the shipped Add more door (Apple's in the app;
  none in the app without Apple's shop).
- **Every file ends, and says how.** Bytes go through the shared `sendToStorage` (`lib/upload-send.ts`, now accepting a
  seat token): per-file %, the stall watchdog on the signing and the PUT, and the record step on a 60 s clock. Landed
  files refresh the Memories grid (`router.refresh()`) and say "N added to your Memories."
- **Refusals that were unreachable now say the truth.** Both seams send `camera_points_exhausted` for an empty pot; the
  sheet only knew `out_of_points`/`pool_exhausted`, so an out-of-credits couple was told "Try again in a moment". Added:
  `awaiting_payment`, `event_put_away`, `revoked`/`not_your_seat`, `camera_points_unavailable`; "switched off" now
  points at Memories settings (the control left the Papic page).
- Lab: `/dev/bar-lab/dashboard/ev-lab/memories` opens the real uploader (`?pot=24|0|pass|x`).
- Guards: `app/_components/memories/the-add-photos-sheet-clears-the-bar.test.ts`,
  `app/dashboard/[eventId]/studio/papic/_lib/the-sheet-and-the-server-share-one-ladder.test.ts`;
  `an-upload-is-a-capture.test.ts` follows the sender.

- **💰 A photo ADDED BY HAND costs 3 credits — triple a camera photo's 1** (owner 2026-10-26: *"uploads take 2
  credits"* · *"regardless of event or supplier"*, then the same day *"Sorry change the concept. Not 2 but 3. So it will be triple the credits to upload instead of coming from papic"*). One source:
  `papicCaptureCost(kind, durationMs, source)` with `PAPIC_POINTS_PER_UPLOADED_PHOTO = 3`; the source is read off the
  seat (`papicSeatCaptureSource` — the Uploads camera, index 150). The presign gate, `recordSeatCapture` (it passes
  `p_cost`; the SQL spends what it is handed, so no migration), the sheet's pre-check and ⓘ, the Memories "Turn this on"
  line, and the supplier portfolio import (`/api/vendor/papic-portfolio-import`: checks `left < cost`, records
  `credits_spent: cost`, button "Import a photo · 3 credits") all read it. ⏸ Clips added by hand keep the camera ladder
  until the owner rules — a one-line change in the `clip` arm.

SPEC IMPACT: Owner price ruling 2026-10-26 (uploads 3 credits — triple a camera photo) needs its DECISION_LOG row — flagged to the controller, not written by this builder. Otherwise implements the shipped rulings (DECISION_LOG 2026-09-16 PAP-13 ladder; 2026-10-23 Memories joins
the event bar; details inside the ⓘ).
