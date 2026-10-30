## 2026-10-30 · feat(event-hub): Papic on = a Camera tab on every stage · Memories once there are photos

Owner ruling 2026-10-30 (DECISION_LOG "PAPIC ON = A CAMERA TAB ON EVERY STAGE", points 1 and 2 only).

- **Camera on every stage.** While Papic is on for the event (`hostAllowsCamera`, which is the same
  `eventPapicGuestActive` answer the camera button follows, with the couple's "What guests see" hide still
  applied), an invited guest's bar carries a live **Camera** on Save the Date, the Invitation, The Day and Post
  Event. It goes to the same address as the camera button (`guestCameraHref`), which opens the existing
  full-screen camera with its ✕. This widens 2026-10-14 ("early shooting adds a Camera tab"). On Post Event,
  E2 ("no more camera") now applies only when Papic is off, and Suppliers (a scroll inside the Recap) gives up
  its slot first to keep the five-slot shape. With Papic off nothing changes: no Camera before or after the
  day, and the locked camera on the day. Strangers and suppliers never get a Camera.
- **Memories once there are photos.** `resolveSiteNav` takes `memoriesHasPhotos`, which is the event's Papic
  shots + uploads counted with the Memories grid's own filters (`countGalleryFrames`). At least one shows a
  guest's Memories on the day and after it, public chapter or not. If there are none and the page draws no
  photographs there, nobody gets a Memories tab on any stage. A count that was not asked or was refused
  leaves the old rules in charge. The count is asked only where it can change a bar (never for a stranger),
  from `site-body.tsx`.
- The Maker's Page ▾ / Stages pages (`guestBarForStage`) keep the pages there are to design: they ask with the
  switch open on The Day only, so the Invitation's pages and Post Event's Suppliers page do not change. The
  canvas still draws the guest's real bar, Camera included.
- The inline camera (consent card) still mounts only where the stage lists Camera, which is The Day and after.
  `STAGE_BAR` is unchanged.
- Guard: `apps/web/app/[slug]/_lib/papic-on-camera-every-stage.test.ts`. Updated pins (Papic off keeps the old
  shapes; Papic on adds Camera): `site-nav.test.ts`, `each-tab-is-its-own-page.test.ts`,
  `the-guest-text-is-honest.test.ts`, `lib/each-stage-does-one-job.test.ts`,
  `lib/the-event-bar-is-the-stages-own.test.ts`, `lib/the-page-dropdown-is-the-guest-bar.test.ts`,
  `lib/the-post-event-bar.test.ts`.

SPEC IMPACT: None. This implements points 1–2 of the 2026-10-30 DECISION_LOG row as written. On merge, change
the row's "Nothing built" to name this PR for (1)(2). Points 3–4 (Memories ⚙ · Only tagged · chapters ·
uploads) are not built.
