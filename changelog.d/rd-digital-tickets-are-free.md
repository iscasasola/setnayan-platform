## 2026-10-22 · fix(prints): the digital ticket zip is free — every guest's ticket picture, for sending by phone

Owner 2026-10-22, "yes" to the recommendation, under his rule (verbatim): *"the goal of the free is to keep everything minimum
ready but no personalization."* The zip is how couples hand out tickets — readiness, not personalization. It supersedes the
2026-09-29 ruling that made the zip Event Hub Pro.

- **Route** `app/api/guest/pass-card/all`: no Pro question any more (host gate and the eligible-guest rule stay). The cards are
  drawn from the one kit (`loadPassCardKit` → `loadPrintSet`), whose look door (`printLookForEvent`, #6744) draws a free event's
  tickets PLAIN WHITE and a Pro event's in its Hub look — unchanged.
- **Screens**: Studio › Prints' Digital ticket "All guests" and the shipped Details' "Download all tickets (.zip)" are a plain
  Download (`freeAllGuestsFile`, #6767's free side) for every event, store shell included — no ◆, no door.
- **Retired**: `PASS_CARD_ZIP_PRO_MESSAGE` (the route's 403), `PASS_ZIP_PRO_NOTE` (the ◆ note).
- **Still Pro, unchanged**: the whole set in one file, Everything, the place-card pack; prints in the Hub look. The Pro list
  (`WEBSITE_PRO_ITEMS`) named no zip, so its words are unchanged.
- **Guards**: `lib/all-in-one-prints-are-pro.test.ts` § 1d (the zip route CALLED for a free and a Pro event: no 403, reaches the
  guest list and the print-set kit) and § 2 (both screens draw a free save, store shell included) ·
  `lib/the-pro-list-names-only-real-gates.test.ts` § 5d (no Pro line names a ticket or a zip) · `paid-mark`, `the-pass-card-is-a-card`,
  `studio-prints-money-is-unchanged` updated; the money golden re-recorded (only the zip's PRO word and door moved).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — row 2026-10-22 "THE DIGITAL TICKET ZIP IS FREE", which supersedes the 2026-09-29
"THE ZIP IS PRO" lines and the 2026-10-22 "FREE IS READY, PRO IS PERSONAL" row's "the digital ticket zip stays ◆".
