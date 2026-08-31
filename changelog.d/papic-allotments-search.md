## 2026-08-31 · feat(papic): find one guest among two hundred in the allotment picker

Owner, 2026-08-31: *"there might be over 200 guests, and we should not list them
all. or let the user search a guest from the list and show what they have?"*

`GuestAllotmentsChoice` fetched every guest (no `.limit()`) and rendered all of
them with `guests.map(...)` inside a ~288px scroll box, in first-name order.
Fine for a dozen; a haystack for a real Filipino guest list — and the couple's
own named guests were scattered through it at whatever letter they happened to
start with.

**Two changes, neither touching the allotment model.** The per-guest ceiling
system (`papic_guest_spend_ceilings`, `splitTheRest`, the role multipliers) ships
already and is untouched:

1. **A search box** filters the list by name, case-insensitively, on substring —
   what somebody typing "lola" expects.
2. **Named guests sort first, always**, including while searching. Their saved
   numbers are what the couple came back to check or change.

🔑 **ZERO IS A NAMED GUEST.** `ceiling_points = 0` is the documented way to say
"this guest may not spend", so the partition tests `!= null`, never truthiness.
A truthiness test would sort her in with the un-named and hide the couple's most
surprising decision at the bottom of a 200-row list. That is one of the mutants
below.

⚖ **IT IS A FILTER, NOT A FETCH.** Every guest is still loaded and rendered by
the server component; the client only decides which rows are visible. Clearing
the box restores the full list with no round trip, and a non-matching guest is
hidden, never unloaded. **Each row is still its own `<form>` posting the same
`setGuestAllotment` server action**, so naming a guest works exactly as it did,
JavaScript or not.

🏗 **The ordering rule is pure and lives in `lib/papic-guest-allotments.ts`**,
beside the split arithmetic it belongs with, rather than inside the client
component — a rule buried in a component cannot be unit-tested, and this project
has paid for undefendable rules before. The component calls
`orderAllotmentPickerRows` and renders.

**Proved by mutation** (18 tests in this suite, 47 across the related ones;
`lint-server-only-boundary` clean at 674 client files):

- truthiness instead of `!= null` → the zero-is-named test goes red
- dropping the named-first partition → 3 tests red
- case-sensitive matching → 2 tests red

Each applied, measured, reverted.

SPEC IMPACT: None. No schema, pricing or allotment-logic change — only which
rows the picker shows and in what order.
