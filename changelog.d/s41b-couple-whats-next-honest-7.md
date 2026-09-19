## 2026-09-19 · fix(home): "What's next" says which dates couldn't load instead of dropping them (S41b · couple 7)

One of the four on-screen cases S41 left for later. #5658 and #5653 kept the
reason; the source still vanished. COUPLE-FACING tier of `result-dropped-silently`.

Every fetcher in `lib/upcoming-items.ts` returned `[]` on a refused read. A refused
payments read therefore removed every payment falling due from Home's "Dates
coming up" group, which still rendered calm and complete-looking. With no other
dates, the group vanished altogether.

- A refused source (appointments, schedule, supplier payments, renewals) now
  returns an empty list TAGGED as refused.
- `fetchUpcomingItems` reports these in the new `unreadableSources`.
- The board renders the group on a refusal alone. Its first row reads "Some dates
  couldn't load — We couldn't check your payments … just now". A throw marks
  every fetched source unreadable.

Stacked on #5658 + #5653 (S41), which add the logged reason in the same fetchers.
Kept clear of #5655's hunks, which removes `fetchVendorMeetings`. A trial merge
with #5655 is clean.

Proof: `lib/whats-next-says-what-it-could-not-read.test.ts` executes
`fetchUpcomingItems` against a client that refuses per table (4/4). Each of four
sabotages turns 1–2 tests red.

SPEC IMPACT: None
