## 2026-10-08 · feat(egifts): "I sent it" — the guest's gift record (wish list 4/5)

Owner 2026-10-08: "when people send gcash, they also give screenshot of their
payment and the vallue and their message for the couple. this will be the way
to measure." Stacked on #6440 → #6435 → #6432. **No migration** (the two tables
landed in 1/5).

**What a guest can now do** on `/[slug]/pabuya`: open a wish → **✓ I sent it** →
"Show ‹hosts›": their screenshot (asked for first, never demanded), the amount
(prefilled with what was left), a word, and From — the invitation's own name,
or a Name field when the invitation carries none. ➤ Send → "Thank you, ‹name›."
Under the ways to give: **"Sent a gift? Show ‹hosts› ›"** for a gift toward no
wish. A wish they sent toward reads "You sent ₱500 ✓ · ₱4,500 of ₱4,500". A wish
marks itself got when what guests say they sent reaches its price.

**The fence** (`lib/gift-record.server.ts` · `recordGift`, service role — the
table gives no browser role INSERT): the reader is a guest of THIS event by the
RSVP's own identity read (`readGuestSessionForEvent`), not removed from the
list; the event accepts gifts and has a way to give on; the wish is this
event's; the amount is whole pesos above zero (no cap exists in the product, so
none is invented — nine digits, the column's size); the word and name fit their
columns; the screenshot is in that guest's own private folder. Rate-limited per
guest with the existing limiter (`gift_record` 10 / 10 min, `gift_shot` 20 / 10
min). Every refusal is said in the sheet, in place.

**+0 routes, +0 server actions** — both requests ride `POST /api/guest-selfie`
(`purpose: 'gift-shot' | 'gift-record'` → `lib/gift-door.server.ts`); a body
with no purpose is the RSVP selfie exactly as before. The sheet is loaded on the
press (`next/dynamic`), not with the gift page.

**The screenshot**: PRIVATE bucket `setnayan-thread-files`,
`gift-shots/<event>/<guest>/…`, key minted by the server from the session
(`giftShotPolicy`); no public URL. Deleted with the event (media sweep), and on
the giver's account erasure (object + pointer — `purgeUserGuestBiometrics`,
`ERASURE_COLUMN_WRITES.event_gift_records`); the name, amount and words stay as
the host's list (PARTIALLY_PURGED — an open DPO/owner question, flagged).
"Download my data" gains `gifts_you_said_you_sent`, scoped to the subject's own
guest ids (`lib/export-own-gift-records.ts`) — a host's file holds none of their
guests' gifts. Data-subject register: `event_gift_records.giver_name` anchored
in the guest category.

`ugat-both-ends` baseline 44 → 43: `event_gift_records` has its writer.

Tests: `tests/db/a-gift-record-is-a-guests-own.db.test.ts` (12, replayed schema
— a stranger, a guest of another event, a borrowed guest id, a removed guest, a
declined guest, the browser's own role, the export) · `lib/gift-record.test.ts`
(9) · `lib/the-gift-record-follows-the-drawing.test.ts` (10) ·
`erasure-completeness.db` +1 · `export-reads-are-subject-scoped` +1 ·
`the-guest-text-is-honest` extended (now also refuses "refund").
Also from the CI fix merged up from 3/5: the list's count line is a sentence
whose figures carry commas.

SPEC IMPACT: None. Build status in the corpus:
`EGIFTS_WISH_LIST_BUILD_STATUS_2026-10-08.md`.
