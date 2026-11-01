## 2026-11-01 · fix(budget,schedule,guests): money fields take only money · a request strip keeps to its time · RSVP asks is a dropdown with ticks

From the walk of the dev labs (Step 0 "Fix first").

- **Budget — a money field takes only money.** The Target took letters ("2,250,000abc"), and so did the sheets'
  Amount / Paid so far fields: plain inputs storing whatever was typed. One keeper, `keepPesoTyping`
  (`lib/peso-as-you-type.ts`), now runs from every Budget money field's `onInput` and from the shared Form row's amount
  (which had the same logic inline): letters never survive, commas are put in as typed, the caret stays put.
  Guard: `app/dashboard/[eventId]/budget/a-money-field-takes-only-money.test.ts`.
- **Schedule — a supplier's request strip keeps to its time.** A 30-minute request ("Lumière Photo proposes ·
  Post-ceremony photos", 3:30–4:00) drew 44 px tall over Cocktails at 4:00: the global 44-px `<button>` floor beat its
  time-sized height. It now drops the floor (`min-h-0`), as the moments already do; so do the rail's ＋ gaps.
  Guard (renders the rail): `app/dashboard/[eventId]/schedule/the-rail-draws-time-at-its-height.test.ts`.
- **Guests lab — the ⚙ sheet's rows sit in its gutter.** Lab only: the page's `InvitePanel` already wraps
  `GuestSetupRows` in `px-4`; the lab handed the bare rows in, so it drew them to the screen's edge. The lab now wraps
  them the same way. Guard (every mount of the rows): `app/dashboard/[eventId]/_components/guest-setup/the-settings-rows-sit-in-the-sheet-gutter.test.ts`.

- **Guests › RSVP asks is one dropdown with ticks** (owner 2026-11-01, DECISION_LOG "GUESTS › RSVP ASKS IS A DROPDOWN
  WITH TICKS, NOT CHIPS"). The six chips are now the shared `PickMenu` with `picked` — a tick keeps it open, Done
  closes it, its face reads "4 of 6 on" — in Guests › Setup's row, the Maker's RSVP list row and the part's own row
  (Event Details), exactly as the Maker card toolbar already drew them. The face and the pick live once in
  `lib/rsvp-ask.ts` (`rsvpAsksFace`, `rsvpAsksPick`); the toolbar's `rsvpAsksDd` uses them too. The guards that locked
  in chips now hold the new property (one shared PickMenu with ticks, the same row in both doors):
  `setup-and-maker-mount-the-same-parts.test.ts`, `lib/studio-rsvp-wears-the-templates.test.ts`. Port-control baseline
  regenerated (the asks' chip control is gone on purpose).

Not changed: Budget's Agreed / Paid differing between two loads is the owner-ruled count-up (`components/count.tsx`)
caught mid-count; the "Saved." under the file buttons is the calendar file's share sheet, not a database write.

SPEC IMPACT: None in this PR — the owner's ruling is already recorded in the corpus `DECISION_LOG.md` (2026-11-01).
