## 2026-06-28 · feat(faith/inc): deepen INC (Iglesia ni Cristo) wedding support

Made an INC wedding "work properly" beyond the taxonomy spine that already
shipped (auto-resolving `inc_minister`, `inc_counseling`, `inc_chapel`). Three
self-contained changes, no migration:

- `lib/wedding-traditions.ts` — enriched the `inc:` guide (shown on
  `/dashboard/[eventId]/paperwork`) from 5 thin items to the real INC spine:
  arranged through the local congregation (lokal), ~1–1.5h congregation-directed
  ceremony + seating, **modest formal attire required of GUESTS too** (no
  sleeveless/short), **principal sponsors — non-member Ninong/Ninang limited to
  one pair**, **simplicity over spectacle** (no entourage/choir/elaborate props
  in the chapel), members-in-good-standing + baptism-path timeline note, and a
  reception that opens with prayer and is traditionally alcohol-free / no-dance
  (with honest "some families decide differently" framing).
- `lib/auspicious-date.ts` — **suppress the numerology + astrology date layers
  for `ceremony_type='inc'`** (`computeAuspiciousReasonsDetailed`). INC doctrine
  rejects luck/superstition, so those folk-luck reasons no longer surface for INC
  couples; the practical/community layers (personal resonance, ceremony notes,
  day-of-week/season, practical reframes) stay — they reflect INC's real date
  drivers. Deliberately INC-ONLY: Catholic intentionally keeps numerology with an
  honest "folk observance" overlay, so this is not a blanket religious gate.
- `app/dashboard/[eventId]/website/dress-code/page.tsx` — when an INC host opens
  the dress-code editor with nothing saved yet, pre-fill modest/formal starter
  guidance (the no-sleeveless/no-short rule that applies to guests). Non-
  destructive: it only seeds the form's default values; nothing persists until
  the host reviews and clicks Save, and a note explains the prefill.

Verified: typecheck + lint + production build all pass.

SPEC IMPACT: Documented in
02_Specifications/INC_Wedding_Practices_Reference_2026-06-28.md (new) +
DECISION_LOG.md row 2026-06-28. No schema/SKU/pricing change. Deferred to owner
sign-off (per that doc § 7): new INC vendor taxonomy leaves (need the admin
governance queue) and any membership handling beyond advisory copy.
