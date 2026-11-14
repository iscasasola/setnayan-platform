## 2026-11-14 · fix(walk): round 8 of the re-walk (F-W1-61 · F-W2-40)

- **F-W1-61** Every admin page prints a stored moment in Manila time, not the server's UTC: /admin/verify's "Submitted …"
  and "Decided …" lines and the other admin dates and times that named no zone (each `new Date(…).toLocale…` call now
  carries `timeZone: 'Asia/Manila'`; a call that names its zone on purpose, `'UTC'` on a bare day key, is left alone).
- **F-W2-40** The public Hub's cover shows the event's own first moment ("Ceremony 1:30 PM"), never the Prep chapter
  every event starts with ("Prep 7:00 AM"). `coverMoment` in `lib/guests-arrive.ts`; Prep stays public in the schedule.
- **F-W2-29 is NOT in this PR**: the "Event Hub Pro" → "Event Pro" rename on this page and its links is in flight in
  #7605, and selling Event Plus / Ultra from it is an owner question (see the PR).
- **RW-167 (re-walk at c0c8ff4)**
  - Website › "Services shown first" no longer lists a ghost "Lights Sound" beside "Lights & Sound": one row per service
    (`distinctShopServices`), an older spelling of the same key folded into the key the category list knows.
  - Their work's subtitle is a sentence for the supplier: "Photos from the events this card was booked for".
  - A challenge never shows a raw "{who}": the couple's add sheet, its switch label, the library and the live wall all
    read `displayChallengePrompt` (neutral "the couple" / "the host" where no guest is known).
  - The recap draws no empty "What They Said" plate (never an empty scene, the F-W2-53 rule).
- Guard: `apps/web/lib/the-walk-round-8.test.ts`.

SPEC IMPACT: None.
