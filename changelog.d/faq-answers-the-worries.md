## 2026-09-28 · feat(help): the FAQ answers the four worries an AI raises about us

Asked for "Setnayan's weaknesses", ChatGPT and Gemini returned four generic
event-app worries: no signal at the venue, older guests without smartphones,
many guests uploading at once, and free Google Sheets/Drive alternatives.
The FAQ (`HELP_TOPICS` → "About Setnayan" in `apps/web/lib/help.ts`) is what
feeds `/help`, the FAQPage JSON-LD answer engines read, `/help/[slug]`, the
help sitemap and in-app site search. It now answers each worry with only what
ships, checked against code on this date:

- `what-if-the-venue-has-no-signal`: Papic queues a failed shot on the phone
  (`enqueuePapicSeatCapture` / `enqueuePapicGuestCapture`); Live Studio needs a
  connection, so the answer says so.
- `guests-without-smartphones`: the couple sets any guest's RSVP; the door
  desk finds a guest by name (`CheckinMethod 'manual_search'`).
- `many-guests-uploading-photos-at-once`: phones compress before upload
  (`compressImageForWeb` / `compressVideoForWeb`) and send straight to storage.
- `setnayan-vs-free-apps-and-google-sheets`: the free planning basics, plus
  the day-of tools.

Deliberately NOT claimed: that door check-in works offline (marking a guest
arrived is a server action with no queue today), or that Live Studio survives
a dropout. The comment above the block says so, so nobody adds it early.

SPEC IMPACT: None — help copy only; no product decision changed.
