## 2026-08-26 · feat(papic): the couple's Uploads camera — a shutter that is a file picker

Owner 2026-08-26: *"papic is the source where they collect media files for that event"* and *"they can upload their work via papic credits as well per event"*, with an uploaded photo taking *"the same spot as 1 papic photo"*.

🔑 **AN UPLOAD IS NOT A NEW KIND OF THING NEEDING NEW RULES.** It is a camera taking a shot — so it inherits, verbatim and untouched, the credit metering, the always-on safety screen, the derivative pipeline and the Drive copy that every capture already gets. **No second capture path, no second meter, no second screen.** This PR mints the camera; the picker that feeds it follows.

## ⛔ Provisioned in ONE place, and that is a security decision

`provisionUploadsCameraAdmin` is a **service-role write**. The obvious shape — *"one server action that mints-or-fetches the event's Uploads camera"* — takes a **client-supplied event id**, and would let a signed-in stranger mint a live seat on somebody else's wedding and claim it. After that, **every gate downstream waves them through**: the upload presign and the record path both check **claimer identity** and nothing else. A takeover door assembled entirely out of legitimate, fully-gated parts.

So it is called only from the studio page's render, **after the couple check that page already performs** — the same block that provisions the free cameras. 🔑 **The rule is the CALL SITE, not the function**, and nothing in the function's own body can express that. Which is exactly why it needed a test rather than a comment.

## 🪤 The proposed index would have created nothing and reported success

The build plan specified `seat_index = 110`. **Measured in production, 110 already holds the free dedicated camera — on four events.** The upsert uses `ignoreDuplicates: true`, so minting there would have created **NOTHING**, returned success, and left the couple with no Uploads camera and no error anywhere. A gate with no handle, on every event that already exists.

`150` sits clear of the free block (100–102), clear of 110, and below the paid base (200).

## Two more details that are load-bearing

**It takes the event's real capture window.** `captureWindowState` returns `'open'` on null bounds — deliberate, so a legacy seat is never bricked mid-party. A null-window seat here would be **the only camera in the product exempt from the dates the couple picked**, inventing a rule silently.

**Idempotency is the `(event_id, seat_index)` UNIQUE constraint, in SQL.** Two concurrent renders both read "missing" and both insert; only the database can settle that. And a *refused* read returns 0 and retries next render rather than inserting on an unread.

## 🛡 Guard `lib/the-uploads-camera-has-no-back-door.test.ts` — 6 rules

An anti-vacuum floor (>500 files walked) · **the index collides with no other reserved index, the free block, or the paid range** · **the provisioner has exactly ONE caller and it is the couple-checked studio render** · **no server action mints it** · it takes the real window, never null · idempotency names the database constraint.

**Mutations**, counts printed before → after: index moved to 110 (1→0) 🔴 · camera made exempt from the window (2→1) 🔴 · idempotency left to TypeScript (3→2) 🔴 · **a server action added that mints it** 🔴 **two rules**. Green on both clean sides. `tsc --noEmit` exit **0**, printed rather than piped.

**SPEC IMPACT:** None — under the purpose lock in `DECISION_LOG.md` 2026-08-26.
