## 2026-10-18 · fix(product-pages): the public product pages say what ships

Follow-up named by #6640. The rail's product doorways outside `/features` still sold removed features.
Fixed, each against the shipped code:

- **/budget** — the suggested split, Save / Standard / Splurge, the per-category typical range and the
  overdue call-out (all gone since the B2 redo) → Target · Agreed · Paid · Owed with a meter, the Next
  line with Pay, one list in three groups (booked suppliers · bought on Setnayan · your expenses),
  All / Owing / Paid + search, spreadsheet / print / calendar-file exports.
- **/guest-list** — "Yes, No or Maybe" → yes or no (`lib/rsvp-ask.ts`); "Allow plus-one" tick → a
  +1 / +2 pick with a row and QR per extra seat; "paste your spreadsheet" → paste many names or import
  a CSV file.
- **/schedule** — "invitation site" ×8 → Event Hub.
- **/pakanta, /patiktok** — "cleared for sharing / cleared to share" removed (a licence fact no code
  shows); Patiktok says Setnayan's own catalogue, Music Maker says made to order.
- **/setnayan-ai** — "one calm weekly digest" (no caller) and "chases quiet suppliers / lines up their
  quotes" (`chase` removed from the in-app value copy 2026-08-12) removed.
- House words: "celebration" → "event" and our own "website" → "Event Hub" on /about, /panood, /palogo,
  /papic (5 files), the /pricing Papic estimator, /samahan, /suppliers, /realstories, /explore.

Guard: `app/(shell)/product-pages-say-what-ships.test.ts` (sibling of the /features guard) — banned
phrases with reasons, plus the house words. Legal pages are not scanned; /pawebsite keeps "wedding
website" (it names the category it replaces). Not changed: `PAPIC_FREE_CREDIT_CONDITION`
("on your first celebration") in lib, pinned word-for-word by `the-free-credit-promise-is-true.test.ts`.

SPEC IMPACT: None (copy now matches shipped behaviour and existing rulings).
