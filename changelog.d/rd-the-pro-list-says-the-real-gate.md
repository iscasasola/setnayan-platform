## 2026-10-22 · fix(pro): free is ready, Pro is personal — every guest's ticket and the QR sheet download free; the Pro list says the real gate

Owner 2026-10-22, verbatim: *"the goal of the free is to keep everything minimum ready but no personalization."* ·
*"they pay to customize it."* · *"my issue is the data storage if i keep accepting free photos which uses more data."*

- **Free now:** every guest's ticket in one file (`passes`, every size, the Phone card's included) and the Guest QR sheet
  (`qr-codes`). `isAllInOnePrint` (`lib/print-pieces.ts`) no longer covers them. The route asks no Pro question for them, and
  Studio › Prints and Details show a plain Download (no ◆) on every event, store shell included. A free event's passes stay
  plain white (`printLookForEvent`, #6744).
- **Still Pro:** the whole set in one file, Everything, the place-card pack, and the digital ticket zip (its own 2026-09-29 ◆).
  Love Story photos are unchanged; free keeps 5 word-only moments.
- **The Pro list** (`WEBSITE_PRO_ITEMS`): "More upload space — 500 MB per event" (computed from the cap) · "Photos in your
  Love Story, and more than 5 moments" (computed from `FREE_MOMENT_CAP`, which moved to `lib/love-story-cap.ts` so a client list
  can read it) · "One download of the whole designed set" · "Prints in your Event Hub look". The buy page's `BENEFITS` name none
  of these and are unchanged.
- Retired: `PASSES_PRO_NOTE`, `QR_SHEET_PRO_NOTE` (`lib/studio-prints-six.ts`).
- Guards: `lib/the-pro-list-names-only-real-gates.test.ts` § 4c, 5a–5c (the list matches the gates both ways; the two free files
  in no mode; plain white for free; the Love Story number is the cap) · `lib/all-in-one-prints-are-pro.test.ts` (route serves a
  free event's passes and QR sheet, still refuses the set and Everything; the Prints screen draws them as free saves).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — row 2026-10-22 "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND THE QR SHEET ARE
FREE" (corpus `ae226a4e`), which supersedes the 2026-10-16/17 "every guest's pass / the QR sheet is Pro" lines and the earlier
2026-10-22 "THE PRO LIST SAYS THE REAL GATE" wording.
