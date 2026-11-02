## 2026-10-26 · fix(memories): + Add photos is one press — the camera is always there, the pick claims it, a refusal is said

Owner, live on his phone: *"on memories. it seems there is no add photos"* · *"the turn on is not working as well fix it"*.

**Root cause (measured in production, read-only).** + Add photos opened a sheet whose not-yet-claimed branch was a
paragraph and a "Turn this on" form (`claimUploadsCamera`). That action reads the event's Uploads camera
(`paparazzi_seats`, seat 150) and, finding **no row**, redirected `uploads_error=no_camera` — "could not be turned on
just now. Please try again." No retry could fix it: the row is minted only by a couple-checked render, and since
2026-10-24 the only one (the studio Papic page, `provisionUploadsCameraAdmin`) redirects the couple to Home before it
gets there. 7 of 13 live events had no Uploads camera. The edge logs show the press at 12:24:23Z and 12:27:33Z reading
the seat and never reaching `papic_claim_seat`; the row appeared at 12:30:33Z. The button itself wore `sn-btn-primary`,
a modifier of a base `.sn-btn` no TSX applies — a raw gold rectangle, no padding or radius.

- **Memories mints the camera** inside its host branch (the viewer's own couple membership, the route's event id —
  the same two facts as the studio render), before it reads it. `the-uploads-camera-has-no-back-door.test.ts` now
  allows exactly those two couple-checked renders and holds the Memories call inside `if (host)` with the real window.
- **One press.** The sheet is the shipped uploader (`AddToLibrary`) at once. Its main button — the brand ActionButton,
  full width, "Choose photos" — opens the picker; on an unclaimed camera the pick claims it on the way
  (`startAddingPhotos`, replacing `claimUploadsCamera`: helper gate → couple check → service-role token read → claim
  on the caller's session via `papic_claim_seat`; never redirects, never mints). Any refusal is said on the sheet
  (`lib/uploads-seat-claim.ts`), and the other host's camera is said up front.
- **Copy:** title + one line — "From your phone or laptop · 3 credits a photo" (`photoCostLine`, from
  `papicCaptureCost`); snippets and older memories moved into the ⓘ.
- **Every raw `sn-btn-*` fixed:** the 6 TSX uses (Memories' "Turn this on", the uploads and guest-allotment switches,
  three guest-allotment Saves) now wear the ActionButton classes; a guard fails any modifier without its base.
- Tests: `lib/uploads-seat-claim.test.ts`, `app/dashboard/[eventId]/memories/add-photos-is-one-press.test.ts`,
  `tests/db/the-uploads-camera-is-claimed-once.db.test.ts` (minted once · host claims · second press a no-op · other
  host 'taken' · a non-host reads neither membership nor token). Lab: `/dev/bar-lab/dashboard/ev-lab/memories?claim=1`.

SPEC IMPACT: None (the approved + Add photos door and uploader are unchanged in intent; this removes a broken extra
step and fixes the provisioning seam).
