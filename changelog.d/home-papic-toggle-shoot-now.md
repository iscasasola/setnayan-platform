## 2026-10-30 · feat(home-papic): the Papic card's head switch is "Let everybody shoot now" once Papic is on

Owner: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic on papic's
widget with that toggle switch"*.

- **Papic on** (live `papic_on`, guest access not 'off') → Home's Papic card head switch is **Let everybody shoot now**
  (`ShootNowSwitch`): `events.papic_guest_capture_early`, saved LIVE in place through the shipped
  `setPapicGuestCaptureEarly` (via the Papic in-place door `papicSaveInPlace`) — no Apply, no navigation. The line under
  the title says "Guests can shoot now" / "Guests shoot on the event day" and follows the press; a refused save puts the
  switch and the line back and says why under the card's head (in the card's flow — said inside the switch's slot it threw the
  switch over the camera mark at 390 px). An unread saved value says "Couldn’t check just now", disabled.
- **Papic off** (or no guest cameras) → the head keeps the Papic on/off switch, unchanged.
- The settings' **"When guests can shoot"** button row is removed — one control per fact (its only seat was this card).
  `guest-cameras-choice.tsx` now only reads (`readShootNow`, React-`cache`d: the head, its line and the ⓘ read once —
  the same reads the removed row made). The window's exact close times moved into the settings' ⓘ.
- 🐛 `papicInPlaceAnswer` read `?guestCameras=error` / `?faceTagging=error` / `?vendorMedia=error` as **saved** (the
  outcome is in the value, not the key, and the `#papic` fragment rode on it) — a refused shoot-now save would have
  stayed on. Now a refusal; pinned in `papic-saves-in-place.test.ts`.
- Papic on/off while the head is shoot-now: Event Details › Photos from guests (`details/page.tsx` row `papic-answer`)
  and the Maker's Your info (`details-answers-parts.tsx` `editors.papic`).
- `/dev/home-lab?card=1&shoot=on|off|unread|papic[&save=fail]` draws each state with no server.
- Guard: `app/dashboard/[eventId]/home-papic-head-is-shoot-now.test.ts` (executed rule + per-component anchors +
  sabotage). Port baseline regenerated (`PapicSwitch` now mounts through `PapicHeadControl`).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-30 "HOME'S PAPIC CARD HEAD SWITCH IS "LET EVERYBODY SHOOT NOW" ONCE PAPIC IS
ON" (pushed to the corpus `main`).
