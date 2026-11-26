## 2026-11-26 · fix(event-hub): "Your checklist" drops the motif colours item

Owner, 26 Nov, on the Event Hub's guest checklist: *"it shows the motif colors. it should be their assign colors for the event"* · *"motif color is for the event but their attire is inidcated to what color they should wear"*. Shown the list, he decided: *"remove motif colors. just keep what to wear · Arrive by yes · Your Table · Your QR Pass Yes"*.

- **Removed:** the "Motif colors" item. It drew the Mood Board's whole pool (`paletteSwatches`) for every guest, falling back to the retired `dress_code_config.palette`.
- **What the checklist shows now:** What to wear · Arrive by · Your table · Your QR pass. Each item appears only when it has something true to say, as before.
- **Ticks:** `CHECKLIST_KEYS` loses `motif`. An old stored `motif` tick in `guest_checklist_ticks` is dropped on read by `sanitizeTicks`. No migration: the column has no key constraint.
- **Reminder emails:** they use the same builder, so their list loses the colours line too (`pendingLine`'s motif branch is gone).
- **Guard:** `the-guest-pathway-me-and-checklist.test.ts` › "NO COLOURS ITEM". Seen red on the old code, along with the updated count tests ("2 of 4 ready").
- No new server action, no new route.

SPEC IMPACT: Removes "motif colours (Mood Board palette)" from DECISION_LOG 2026-09-26 "THE LAST 30 DAYS: EACH GUEST GETS YOUR CHECKLIST". The new DECISION_LOG row is drafted and waiting for the controller to append it (a direct push to the specs repo was refused in this session).
