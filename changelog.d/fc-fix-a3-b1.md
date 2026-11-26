## 2026-11-25 · fix(final check, area 3, batch 1): Story Assignments works, and failed saves say so

From the final check of the staging copy (area 3, lane A: no screen change).

- **B-01 (blocker):** Story Assignments read its guests with an RSVP value that does not exist (`confirmed`), so Postgres refused the read and every moment said "No guests to assign". It now reads `attending`, drops deleted rows, and counts through `countsTowardEvent`. Guard: `lib/every-rsvp-filter-names-a-real-reply.test.ts` (every `rsvp_status` filter in app/ and lib/ names a real reply; seen red on the old line).
- **M-08 (assignments part):** a failed read on that page says "Couldn't read your story assignments" instead of empty moments.
- **M-05:** a refused "Remove" on an assignment says it could not remove the guest.
- **P-05:** Recap "Publish" / "Make it private" come back with a failure line when the write is refused; the socials switch says when it flips back.
- **P-03:** Photo delivery "Disconnect" no longer says "Drive disconnected" when either write was refused.
- **P-06:** Papic crew "Copy link" shows the link to press and hold when the clipboard is blocked.
- **L-06:** the Memory lane "Flash to Memory lane" switch says when a save failed.
- **N-02:** Memory lane's "Showing now" line reads plain words instead of the internal mode name ("coming-soon (auto)").
- **N-11 / P-08 (recap counts):** Recap stats read "1 photo", not "1 PHOTOS"; an unknown guest count draws "—", never 0.
- **I-05:** Event QR "Regenerate QR" says it made a new code, or that it could not.
- **I-04:** "Save monogram" checks the row was written (RLS refuses by matching zero rows) and never echoes database text; the page now reads the `?invite=` outcome of Mark sent (failed, none picked, or how many were marked).
- **Server actions:** no new export. No migration. No price, plan or sign-in rule changed.

SPEC IMPACT: None. Honest-state and wording fixes on shipped pages; no product decision changes.
