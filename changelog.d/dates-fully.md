## 2026-08-05 · fix: the "what's next" order, and every date that read a day early

**The list order.** Your event home mixes two kinds of thing: moments from the
wedding timeline, written in the venue's time, and meetings and appointments,
written as real world moments. It sorted them together as if they were the same
kind of value, so timeline moments sat eight hours out of position — a 4 PM
vendor meeting would list above a 2 PM ceremony. Timeline moments are now
converted as they enter the list, so everything in it is the same kind of thing
before anything is sorted.

You couldn't see this yet: it needs a couple who has both a timeline and a
booking, and nobody does.

**The dates.** Eight more screens rendered a calendar date in the reader's
timezone, so anyone in the Americas or Europe saw it **one day early** — a
vendor's payment deadline, a quotation's expiry, a wedding date on four
different screens. The worst version turns 1 January into 31 December of the
previous year.

There is now one way to render a day, and these screens use it. It reads the
digits and prints them, with no moment involved for a timezone to shift.

Some screens were already right — pinning a date to local midnight also works,
and several did that. Those were left alone rather than churned.

I said this was "fully fixed" this morning. It wasn't; these are the rest.

SPEC IMPACT: None.
