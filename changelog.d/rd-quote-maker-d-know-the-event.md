## 2026-09-22 · feat(quote): step 1 "Know the event" — the brief beside the quote

Owner, 2026-09-22: *"when creating a quotation, the vendor must see the basic information we can
provide to them to help them build for the event as well."* The brief existed in the customer
rail and on the client page; the quote tool showed only pax and hours.

- NEW pure `lib/quote-event-brief.ts`: `briefForQuote` = the rail's own rows VERBATIM
  (`buildCustomerEventSummary(...).facts`, including its "Not set yet"; private notes never copied)
  + the stage-1 facts of the 2026-09-20 ruling: Area (`regionLabel`, never the venue), Asked for,
  Budget band with the live per-head median (`budget_band_config`), Style (mood + ceremony),
  Already locked (categories, deduped and sorted). The withheld fields are NAMED (`feeLockCopy`,
  `WITHHELD_FIELD_LABEL`) only while `quoting` — with `NEXT_PUBLIC_FEE_UNLOCKS_EVENT` unset (prod
  today) nothing is withheld and nothing is announced. Executed by `quote-event-brief.test.ts`;
  three sabotages watched red.
- `ProposalMaker` gains `brief`, drawn once at the top of step 1 as a `<dl>` with a "Full brief ›"
  link; the folded step-1 line is the brief's "Wedding · date · area".
- The thread page reads `budget_band, mood_feel_key, ceremony_type` with the event and builds the
  brief from the same summary the rail shows. The conversation NEVER imports the fee gate
  (`the-fee-unlocks-the-event` stays green): the stage is derived from the flag alone, and the
  page gates nothing. The rail's formatted date is reused (one formatting site, not a third —
  `one-long-date-everywhere` unchanged). The summary and the brief are built before the eagerly
  created tool mounts.
- Guard `app/_components/the-quote-knows-the-event.test.ts` (mounted once, inside step 1, area not
  venue, the three columns read); one sabotage watched red.

SPEC IMPACT: None beyond the 2026-09-22 DECISION_LOG row.
