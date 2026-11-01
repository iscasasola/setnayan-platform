## 2026-10-31 · fix(papic): a selfie retake only adds from the photos that missed; "Write a column" hidden in the app, Camera Bridge hidden on the seat camera

Owner rulings, DECISION_LOG "SEVEN OWNER ANSWERS" (31 Oct), items 2 and 6.

**(2) A retake never re-checks a tagged photo.** Owner: *"no. if they are already tagged that's it. we just add more from other photos that missed."*
- What existed: a retake (Me › Face tagging › Retake selfie → `enrollGuestFace`) retires the old enrolment and inserts a new one, and writes no tag. The look-back is the one end-of-event rescan (`lib/face-rescan.ts`), which a selfie newer than the last finished pass restarts. Per photo, the matcher (`autoTagCapture`) already excluded every guest with a `photo_tags` row, live or tombstoned.
- Delta: the rescan now reads each page's `photo_tags` (live AND tombstoned) in one query and does not even open a photo in which every searched guest already has a row; it looks for a guest only in photos that missed them. Who is searched for is now ONE read shared by both callers (`searchedEnrollments` in `lib/face-match.ts`). And the matcher no longer treats an UNREAD tag list as an empty one: a failed read used to let every tombstone stop excluding its guest, and now it writes nothing. A failed page read stops the pass there (it is not marked finished).
- Held by `lib/a-retake-only-adds-from-missed-photos.test.ts` (executed against a recording fake whose upsert does not dedupe, so a resurrected tombstone shows up as a second row): live tags, the guest's "Not me", the hosts' Tag removal and an admin's removal are each left exactly as they were; only the missed photos get the tag; the retake action never touches `photo_tags`.

**(6) Hidden until the owner says so.** Owner: *"hide this for now. it will not be present until we say so."*
- `lib/hidden-guest-extras.ts`: `WRITE_A_COLUMN_SHOWN_IN_APP = false` and `CAMERA_BRIDGE_SHOWN_ON_CAMERA = false`, with the bring-back steps in the docblock. The guest camera's `CameraColumn` asks its constant first; the seat camera's `bridgeEnabled` ANDs its constant in front of `?bridge=demo` and `NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED`. No code deleted.
- Held by `lib/the-hidden-extras-stay-hidden.test.ts`.
- The Event Hub **Recap**'s own `GuestColumnCard` mount (`app/[slug]/_components/site-body.tsx`) is gated by the same `WRITE_A_COLUMN_SHOWN_IN_APP`, asked before the card's `GUEST_COLUMNS_ENABLED` gate ("hidden in our app" covers the Recap too — decision relayed by the coordinator on this PR's open question). The guard scans all of `app/` for both mounts. Host-side column tools (story editor panel, `/studio/guest-columns`) are not gated here; they stay behind `GUEST_COLUMNS_ENABLED`, default OFF.

No migration. `every-guest-read-asks-the-blur-gate.test.ts` gains one classified reader (`lib/face-rescan.ts` reads tag rows, serves no image key).

SPEC IMPACT: DECISION_LOG.md, two "AS BUILT" rows for SEVEN OWNER ANSWERS items 2 and 6 (the second: Write a column hidden in the Event Hub Recap too), including the bring-back steps for both hidden extras.
