## 2026-08-19 · fix(dashboard): the Overview stops counting reads that never happened

The couple's Overview computed its money and its headcounts from two reads whose
failures nothing could see.

🔑 THE CATCH COULD NEVER FIRE. Both were wrapped
`try { return await supabase… } catch { return { data: [], error: null } }` — but
Supabase RESOLVES with `{ error }` instead of throwing, so a refused query never
reaches a `catch`. It arrived as `data: null`, `?? []` made it an empty list, and
nothing anywhere read `.error`.

What a couple saw:

- **"₱0 committed of ₱800,000"** with a 0% ring — because `committed` is the SUM
  of both reads, so either refusal understates it. That is the screen they use to
  decide what they can still afford, showing progress they had not made.
- **"0 of 21 booked"** and *"No vendors booked yet — start with the ones that book
  out first"*, to a couple whose venue was already locked. An invitation to start
  work they had already done.

The try/catch is KEPT — a genuine throw is still worth catching. What was missing
is that nobody read the error.

SPEC IMPACT: None. Third instalment of the pattern set by
`vendor-dashboard/reads-are-honest.test.ts` (supplier side) and `lib/guests.ts`.

🪤 The new guard's first run printed **"# tests 0 … # fail 0"** and exited GREEN:
an explicit `app/dashboard/[eventId]/…` path handed to `--test` is read as a glob
CHARACTER CLASS and matches nothing. Confirmed the file really is picked up by
CI's own `app/**/*.test.ts` glob by grepping the run for a TEST NAME — not for a
filename, which TAP never prints.
