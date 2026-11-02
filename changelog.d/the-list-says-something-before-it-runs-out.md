## 2026-09-09 · fix(chat): a generated preview line is written short, not truncated

The conversation list's preview line (`lib/conversation-list.ts`'s `previewFor`)
now rewrites a card **this app authored** — a proposal sent, a meeting
requested, an Exclusive unlocked — into a short, fact-first line ("Quote
₱187,500 sent") instead of printing the card's full in-thread body, which was
written for the thread, not for the ~32-character desktop / ~50-character
phone budget a row measures out to. A message a PERSON typed is left alone;
CSS `truncate` already ellipsizes it correctly (verified in-browser at both
widths, not just read off the stylesheet).

Two examples in the original brief — "guest count changed" and "deposit
received" — were measured against the shipped code and don't exist as stored
`chat_messages` rows: the first is a card computed live from `event_vendors`
in the thread page and never written to the table; the second is only an
`emitNotification` body. Neither reaches this column, so neither needed a
pattern — corrected rather than built against.

Also:

- **`app/vendor-dashboard/bookings/surface.tsx`** — a second, independent
  inbox over the same threads (where every new-inquiry notification lands) —
  reused `previewFor` instead of printing `last?.body` raw. It could not
  previously say who spoke last; a couple's question and the supplier's own
  reply read identically.
- That same page's "latest message per thread" read was **unbounded** — every
  message of every thread, on every load, uncapped. Bounded to
  `.order('created_at', { ascending: false }).limit(600)`, mirroring the cap
  `VendorThreadPage`'s identical read already accepts.
- The supplier's own row tags (`serviceTagVaries`, `isDateTagWorthShowing`,
  both new pure exports in `lib/conversation-list.ts`) now suppress the
  service tag when every row in the inbox would show the same one anyway (a
  caterer's whole inbox no longer says "Catering" on every row), and the date
  tag when the wedding is more than ~60 days off in either direction. The
  couple's own column was already correct here and untouched — it
  deliberately never shows a date tag at all (every row there is the SAME
  wedding).

SPEC IMPACT: None — presentation-only change to an already-shipped surface;
no schema, no new columns, no API change.
