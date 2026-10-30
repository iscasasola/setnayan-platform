## 2026-10-30 · feat(home-papic): the Papic card's head is one dropdown — Off · On — event day · On — everyone, now

Owner: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic on papic's
widget with that toggle switch"* — then, told Home would lose its Papic off switch: *"If we cannot turn it off, then
maybe assign partial turn on?"*.

- Home's Papic card head is ONE compact `PickMenu` (`PapicHeadPicker`) with three positions over the two existing columns:
  - **Off** → `papic_on` false through the SAME path the old Papic switch used (Event Hub draft via `hubDraftAction`,
    live on Apply — no new live write). `papic_guest_capture_early` is left as it is.
  - **On — event day** → `papic_on` true (the draft, only when it was off) + `papic_guest_capture_early` false, LIVE
    through the shipped `setPapicGuestCaptureEarly` (`papicSaveInPlace` — no navigation).
  - **On — everyone, now** → `papic_on` true + `papic_guest_capture_early` true.
- The line under the title states the position — "Off" / "Guests shoot on the event day" / "Guests can shoot now" — and
  says "Off after you Apply" / "On after you Apply — …" while `papic_on` waits for Apply (Home now reads the draft for
  it; it used to show the live value only). It follows the pick at once; a refused write reverts to what IS stored and
  says why under the head, in the card's flow (inside the control's absolute slot a sentence threw the control over the
  camera mark at 390 px). Unread → disabled + "Couldn’t check just now".
- The settings' **"When guests can shoot"** button row is removed — one control per fact (its only seat was this card).
  `guest-cameras-choice.tsx` now only reads (`readPapicHead`, React-`cache`d: the early column + the draft). The
  window's exact close times moved into the settings' ⓘ. `PapicSwitch` is retired (the dropdown replaces it).
- 🐛 `papicInPlaceAnswer` read `?guestCameras=error` / `?faceTagging=error` / `?vendorMedia=error` as **saved** (the
  outcome is in the value, not the key, and the `#papic` fragment rode on it). Now a refusal; pinned in
  `papic-saves-in-place.test.ts`.
- Papic on/off also stays in Event Details › Photos from guests (`details/page.tsx` row `papic-answer`) and the Maker's
  Your info (`details-answers-parts.tsx` `editors.papic`) — the same draft column.
- `/dev/home-lab?card=1&head=off|eventday|now|offwait|onwait|unread[&save=fail]` draws each state with no server.
- Guard: `app/dashboard/[eventId]/home-papic-head-is-shoot-now.test.ts` (three positions → two columns, executed; the
  doors; one control; Event Details path; sabotage). Port baseline regenerated.

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-30 "HOME'S PAPIC CARD HEAD IS ONE DROPDOWN: OFF · ON — EVENT DAY · ON —
EVERYONE, NOW" (pushed to the corpus `main`).
