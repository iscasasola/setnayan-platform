## 2026-11-15 · fix(notifications): the admin gets one email a day — the morning digest; every other admin notice stays in the app

Owner, 15 Nov 2026: *"i see the emails but i dont want to flood my mail. i want everything organized here."* … *"on
the app"* — then *"morning digest is fine. 1 email a day. not every notification"*.

- `emitAdminNotice` (lib/notification-emit.ts) — every admin fan-out (payment and subscription alerts, verification
  submitted, help messages and supplier reports, force-majeure and fee-dispute cases) sends through it. The bell row
  and the phone push land as before; the email is withheld. The gate is the notice's audience, not the kind (the same
  kinds reach suppliers) and not the person (the owner's account is also a couple's).
- The morning digest and its switch are unchanged — it is the admin's one email a day.
- Couples, guests and suppliers are emailed exactly as before. No prod data written.
- Guard: `lib/admin-notices-stay-in-the-app.test.ts` (an admin notice never reaches `sendEmail`; every admin fan-out
  uses `emitAdminNotice`; the digest still sends). `you-are-told-when-you-are-paid.test.ts` now holds the urgent push
  as the way "you have been paid" leaves the app; `couple-supplier-notices-reach-email.test.ts` reads the new gate.

SPEC IMPACT: DECISION_LOG.md row 2026-11-15 "ADMIN GETS ONE EMAIL A DAY — THE MORNING DIGEST; EVERY OTHER ADMIN NOTICE
STAYS IN THE APP" (repo copy). The spec corpus DECISION_LOG lives outside this container and still needs the same row.
