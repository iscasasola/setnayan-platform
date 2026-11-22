## 2026-11-22 · fix(papic): the Event Hub camera opens for the host, "On — everyone, now" means now, and the Memories dropdown is live

Owner, 22 Nov (priority live fix): Papic showed "On — everyone, now · Guests' cameras are open now" on his own event
and the Hub camera did not work. Specs DECISION_LOG 2026-11-22 "THE PAPIC DROPDOWN IN MEMORIES IS LIVE — NO APPLY".

- **The cause (measured on his event):** the Hub's bar always gives the couple a live Camera and sends it to
  `/papic/guest`, which knew only an invited guest's session. A host has none, so the tab ended on "Open your invitation
  first." Now a signed-in host of that Hub is sent to their OWN existing host camera (`/papic/seat/[token]` — the same
  seat, mint and claim Memories' "Add photos" uses; never a second camera). When it cannot open (adding is off, no camera
  yet, every host camera taken) the page says why and links to Memories. `lib/papic-host-door.ts` + `.server.ts`.
- **"On — everyone, now" means now:** `guestCaptureGate` no longer refuses before a STORED `papic_window_start` when the
  host has opened cameras early. The window END (tail included) still closes. The default (event day) is unchanged.
- **The Memories Papic dropdown is live — no Apply:** Off · On — event day · On — everyone, now write `papic_on` and
  `papic_guest_capture_early` in ONE live write through the existing `setPapicGuestCaptureEarly` (no new action; hosts
  only). The `papic_on` waiting in the Event Hub draft is cleared so a later Apply cannot undo it; Memories, the
  couple's pages and the Event Hub are re-rendered. No line says "after you Apply". Event Details › Photos from guests
  keeps its draft path.
- Guards updated on purpose (not weakened): `home-papic-head-is-shoot-now.test.ts`, `papic-guest-cameras-line.test.ts`,
  `guest-cameras-open-when-the-host-says.test.ts`, `the-uploads-camera-has-no-back-door.test.ts` (a third, host-checked
  minter), `the-allotment-row-never-draws-a-failed-read.test.ts`. New: `lib/papic-host-door.test.ts`.

SPEC IMPACT: None — implements the 22 Nov ruling already in DECISION_LOG. For the owner: a host camera's shots are
metered as that camera always was (the "added by hand" rate, ×3) — unchanged here, flagged on the PR.
