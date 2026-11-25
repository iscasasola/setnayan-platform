## 2026-11-25 · fix(final check, area 3, batch 4): Event Hub and live saves stop saying "saved" after a refused write

From the final check of the staging copy (area 3, lane A: no screen change beyond a failure line).

- **E-01:** Hero photo Save / Remove, Invitation backdrop Save / Turn off, Open browsing (Which version guests see) and the story's last word now check the row was written. RLS refuses by matching zero rows with no error. A refused hero write comes back with "That did not save. Nothing changed — please try again."; in the Maker the version picker puts the choice back; the story says the last word did not save.
- **L-05:** Live Watch setup's watch link, Facebook link and Remove link come back with the failure line when refused. Go live says when the Event Hub could not show the player; End broadcast says when the finished player is still up, and points at Remove link.
- **L-01:** The live controller no longer shows "Now on Channel 1.", "Channel 1 cleared.", "Watch link saved" and the rest after a failed write; one failure banner says it did not go through. Deleting a channel revokes its camera link only after the channel is really gone. "End" on a by-hand broadcast says when the on-air light could not be turned off.
- **L-02:** When the controller cannot read whether the event is on air, the tally reads "Not checked" with a banner, never "Off air".
- Guard: `lib/live-and-hub-writes-are-honest.test.ts`. Unread-error baseline shrunk for the five files fixed.
- **Server actions:** no new export. No migration. No price, plan or sign-in rule changed.

SPEC IMPACT: None. Honest-state fixes on shipped pages; no product decision changes.
