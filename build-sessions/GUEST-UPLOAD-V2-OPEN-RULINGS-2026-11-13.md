# Guest upload v2 — the 4 open rulings (needs owner)

Design: specs `prototypes/guest_phone_uploads_2026-11-13/index.html` (artifact 5HS4Koz7utgzFgNSNZ2uby),
APPROVED 13 Nov with "its 4 small rulings still open" (DECISION_LOG row "Prototypes approved", 13 Nov;
`prototypes/approved_2026-11-13/ARTIFACTS-INDEX.md`). Nothing in DECISION_LOG after that row answers
them, so the build is held — each one changes what a guest is charged or sees.

Each is drawn in the prototype with an `OPEN` box or a `proposal` tag (grep the file for `proptag` / `openbox`).

1. **The couple's credits run out** — what does a guest see in the add sheet? (DECISION_LOG 13 Nov:
   "not ruled, do not guess". Prototype state "Credits ran out (OPEN)" is an empty placeholder.)
2. **Photos with no taken-date** (screenshots, photos sent over chat) — left out, or a
   "N have no date — add them anyway?" tick, off by default, charged like any other? (proposal)
3. **Where a long video is cut** — trimmed on the guest's phone so only the chosen 3–10 s is sent
   and charged, or sent whole and cut on our side? (proposal: on the phone; DECISION_LOG 13 Nov
   "Proposal (unruled)")
4. **"After I check" mode, at story publish** — photos the couple did not check stay out of the
   Recap and Memories until kept; a kept photo costs nothing more; leaving one out does NOT refund
   its credits. (proposal)

Shipped pieces this extends (Rule 0): `AddToLibrary`
(`app/dashboard/[eventId]/studio/papic/_components/add-to-library.tsx`, cost = camera price ×
`PAPIC_UPLOAD_MULTIPLIER`) · guest camera `app/papic/guest/_components/papic-guest-capture.tsx`
(`MAX_CLIP_MS`, no minimum, no trimmer today).
