## 2026-10-25 · fix(legal): /privacy, /terms and /acceptable-use use today's product words

The owner asked for every footer legal page to be checked and brought up to date
(25 Oct). This change fixes **names only**. No right, duty, retention period,
refund term, data category, processor, governing law or liability changes.

- **"vendor" → "supplier"** everywhere a reader sees it on /privacy, /terms and
  /acceptable-use, including section titles ("Suppliers", "Supplier conduct",
  "Supplier interest counts" and so on). None of the three pages used "vendor"
  as a defined term or named the Vendor Agreement. So the three pages leave
  `LEGAL_PENDING` in `lib/public-pages-say-supplier.test.ts`, and that guard now
  holds them like every other public page.
- **"celebration" → "event"** (/privacy ×2, /acceptable-use ×1) and **"event
  website" → "Event Hub"** (/privacy). The two allowlist rows that only existed
  for those words are dropped from `lib/the-app-says-event-in-plain-words.test.ts`.
- /privacy quotes the coordinator option by its real label, **"Can book
  suppliers"** (`consent-gated-invite-form.tsx`). It used to say "Can finalize
  vendors", a label that no longer exists. The `the-couple-books-never-locks`
  allowlist row for /privacy is dropped because nothing on the page matches it
  any more.
- /privacy no longer names retired things: the Patiktok "Personal tier" and
  "Setnayan tier" (Patiktok has been one flat SKU since 2026-06-29, and the
  same two posting targets are still described), "Papic (the V1.5+ camera
  mesh)", and the iteration number "Photo Delivery (0009)". The internal line
  "Per CLAUDE.md decision-log 2026-05-19 row 426" is also removed from the page.
- The "last updated" dates on /privacy and /terms move to 2026-10-25, and
  /acceptable-use gets a "last updated" line. **Effective dates are unchanged**:
  /terms still says `Effective 2026-06-30` = `TERMS_VERSION`, so nobody is asked
  to agree again.
- /cookies and /refunds were checked and are already true (every cookie name
  is still set in the code, and the no-refunds wording matches the 2026-10-08
  ruling). They are unchanged.

Guards updated in step: `privacy-live-flow-disclosure` (date pin),
`legal-retention-promises-have-a-mechanism` (two quotes now say "supplier").

SPEC IMPACT: None. This is wording only. The legal-substance gaps found during
the check (the booking fee is missing from the supplier terms, the T+27d reminder
email has no sender, TikTok auto-posting is a stub, the Live Watch "single
camera free" line) were reported to the owner/DPO for sign-off. They are not
changed here.
