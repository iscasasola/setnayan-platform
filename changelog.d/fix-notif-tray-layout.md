## 2026-11-17 · fix(notices): the bell tray's four live faults — crushed prompt, spinner ring, cut place line, "/" face

Owner, 17 Nov 2026, phone screenshot of the live bell tray: "Yes, fix it". Reposition only; no new design.

- **"Get an alert for every new inquiry" crushed to a word per line.** From 1024 px the bell is a 320 px card, but a
  notice line went to its one-row look by the SCREEN's width (768). The bell's "Waiting on this page" group now lays out
  by its OWN width (`BY_ITS_OWN_WIDTH`, the shared part made for exactly this), so the sentence takes its own line and
  the two buttons share one balanced row under it.
- **The dashed ring read as a loading spinner.** The supplier alerts ask now wears the bar's own `Bell` (lucide, as
  `unread-bell-badge.tsx`).
- **"Indalecio & Claire · You org…" cut on one line.** The place line wraps to two lines (`line-clamp-2`), never
  truncates on one.
- **"/" where the face should be.** Measured on prod: the row's place is the couple's event (no monogram text), so the
  face was the one letter "I" — italic in Hanken Grotesk, which ships no italic, so the browser slanted it into a bar.
  The event face is now its INITIALS ("IC"), upright, by the shop face's shared `deriveVendorInitials`, from the name's
  words (`placeMarkWords` drops "&", "/" and other letterless words). Replaces the one-letter mark of the 13 Nov drawing.
- Guard: `app/_components/notifications/the-tray-face-is-never-a-slash.test.ts` (sabotaged red, then restored).

SPEC IMPACT: None in the corpus text — the 13 Nov notifications-place drawing's "ONE letter" event mark becomes two
initials; owner approved, 18 Nov 2026: "Two initials OK".
