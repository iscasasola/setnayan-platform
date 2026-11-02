## 2026-08-12 · fix(live-studio): the printed camera cards now match the channels on screen — and can be reached

**The printable hand-out had no doorway, and would have been wrong if it had one.**

**① It described the QR in a vocabulary the control room does not use.** The sheet
printed one card per camera SEAT, titled `Camera 3` from the seat's own index — the
retired per-seat model. The controller a host actually operates mints one join code
**per CHANNEL** and names it the way the host named it: `CH 3 · Main stage`. Two names
for the same QR, so the operator holding "Camera 3" had nothing on screen to match it
to. Linking the sheet as it stood would have handed out cards nobody could place.

**② It printed codes that lead nowhere.** It rendered every unclaimed seat, including
seats bound to no channel at all. Those QRs *work* — a phone claims the seat — and the
camera then appears on no channel and can never go on air. A card that leads nowhere,
handed out at a venue, on a day that cannot be re-run.

**③ Nobody could get to it.** Its only link sat on the cameras page, and every link to
*that* page sits on the retired control room, which redirects away on sight once the
unified controller is on. The one artefact you carry to a venue was reachable only by
typing its URL.

**The rework.** The sheet now reads through `fetchChannelCameras` — the SAME reader the
controller uses — and composes its captions with `formatChannel`, the one place channel
captions are composed anywhere in Live Studio. A card can only exist for a channel the
controller would also show a QR for, and it reads identically on paper and on screen.
The venue label rides along when the host set one.

**The doorway** now sits on the controller, directly under the join QRs it prints —
the surface that survives the flag flip, the same reasoning the recording handoff
already records in that file. It appears **only when there is something to print**,
because a link onto "nothing to print yet" is a fake door.

**No silent omissions.** `buildCameraCards()` splits every channel into *printable* or
*waiting, and here is why* (`no join code yet` / `a phone has already joined` / `its
code was retired`). The waiting list is shown on screen, off the printed page. An
absence a host cannot see is how you arrive at a venue one camera short — a test
asserts every channel lands in exactly one list.

**One function, both callers.** The doorway's count and the sheet's contents come from
the same `buildCameraCards()`, so the door cannot promise cards the sheet would not
produce. Claimed and revoked seats already resolve to a null claim URL inside
`fetchChannelCameras`; nothing here re-derives that.

**⚠ One deliberate authorization change, flagged for the owner.** The print page used
`requirePanoodControlRoomMember`; it now uses `isLiveStudioSetupHost`, the controller's
own gate, which additionally admits a **coordinator**. The controller already shows that
same coordinator every one of these join QRs on screen, so this grants no data they
cannot already see — and without it the new doorway would bounce the very person sent
through it. Stated rather than slipped in.

Tests: 12 unit tests on the card builder (the sheet previously had none).

SPEC IMPACT: None.
