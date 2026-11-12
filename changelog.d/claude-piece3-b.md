## 2026-11-12 · feat(files): This booking · portfolio mapping (no copy) · one stored copy per file · the date window + couple approval · Hub by service (Piece 3b)

Piece 3 of the negotiation-chat redesign (DECISION_LOG 2026-11-12: "UPLOADS BELONG TO THE QUOTED SERVICE", "DOCUMENTS
BELONG TO THE BOOKING", "A SHARED PORTFOLIO PHOTO IS A MAPPING, NEVER A COPY", "ONE STORED COPY PER PHOTO", "EVENT
PHOTOS CAN'T BE PADDED — THREE GUARDS", "FIVE GUARDS" (4), "FILES · HUB · FORMS DESIGN APPROVED"; prototype legend
rows 139–143 · 149 · 150).

- **Schema** (`20271339773560_a_supplier_files_an_event_under_its_quoted_services`, RLS at CREATE TABLE):
  `supplier_media` — ONE stored copy per file per shop (UNIQUE shop × sha256, its EXIF `taken_at`, private folder
  `supplier-files/<shop>/` enforced); `event_supplier_files` — per event: `service` (photo/video under a service of
  THIS event's sent/seen/accepted quote) · `booking` (documents, never under a service) · `linked` (a portfolio photo
  MAPPED — no copy, keeps its own service, never counts) · `unfiled` + `links` (chat, for 3c). Trigger: thread with
  the event, quoted service, own card/copy, `taken_at` copied from the copy, `counts`/`dedupe_of` recomputed every
  write (a partial UNIQUE index holds "counts once" even without the trigger), re-filing resets the couple's choice.
  View `event_supplier_photos_listed` — THE one listing rule (counts · couple shown · the day before → the day after,
  or undated), live. RPC `couple_decide_supplier_file` — the couple's only write.
- **Supplier · client › Files**: the thumb row Search files · Show & sort · ＋ (From your portfolio · Upload new);
  This booking · From the chat · Links · one grid per quoted service (full-bleed, 3 columns, 2 px gaps, "+N"); per
  photo state Waiting · Shown · Not from this event's dates · Already in your portfolio · linked · Kept private.
  Upload new asks For a service / For this booking first; each file is hashed on the phone and an already-stored
  file is never uploaded again. The shipped finder stays below ("Shared in the chat · contracts · handover").
- **Hub**: "Event photos · by service" — service groups only, the count line, greyed while the fee is unsettled.
- **Couple · picked supplier › Files**: "<shop> wants to show N photos as from your day · Review" → Show · Hide per
  photo, Approve all; a decision posts a private line in the supplier's chat.
- `/api/upload`: new private root `supplier-files` in `setnayan-thread-files` (vendor tenancy).
- Server-action budget 1243 → 1244: ONE dispatcher `eventFilesAction` (known · file · map · remove · decide).
- Guards: `tests/db/a-supplier-files-an-event-under-its-quoted-services.db.test.ts` (6) · `lib/supplier-files.test.ts` (7) · Ugat J69.
- Dev lab: `/dev/files-lab`.

SPEC IMPACT: None
