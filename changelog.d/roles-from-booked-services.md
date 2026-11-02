## 2026-08-01 · fix(vendor): read a supplier's roles from what they were booked to DO

**A booking has always been able to say "band AND emcee". The day-of console just never read it.**

`event_vendors.requested_service_ids` lists the services on a booking, and each `vendor_services`
row carries its own category. The narrowing that decides which desks a supplier gets read only
`event_vendors.category` — **one** value, because the booking row has one field for it. So a
supplier hired for two jobs resolved to one role and the second desk was unreachable.

The information was recorded. Nothing read it.

> ⚠️ **Correcting an earlier conclusion in this repo's own history.** A note recorded hours before
> this said the booking model *could not express* two roles and proposed a schema change with three
> options. That was wrong — it looked at the summary column and missed the services underneath.
> **No new tables, no booking-model decision, no migration.** The corpus note is corrected in the
> same session.

### The fix

`eventTilesForBooking()` unions the booking's summary category with the categories of the services
actually booked, then maps the result through the **shipped** `tilesForVendorCategories`.

**UNION, never replace — this is the part that matters.** Every booking made before services existed
carries only the summary category and an empty services list. Replacing would narrow those to
nothing and blank the day-of console for every historic booking. Union means the fix can only ever
**add** a role; a supplier who sees one desk today keeps seeing it.

**Both vocabularies, safely.** `vendor_services.category` is genuinely ambiguous today — written as a
canonical tile key on one path, read as a legacy enum on another, with zero rows in production to
settle it (the 2026-07-31 fault-reporting fix exists to catch the first real one). `tilesForVendorCategories`
already handles both: it maps a known legacy category and **passes an unrecognised value through
unchanged**, because an unmapped string is more likely a tile already. So feeding it both sources is
correct under either reading, and **no second mapping table is introduced** — a taxonomy kept in two
places is what caused the original desk blackout.

**Best-effort read.** If the services lookup fails or returns nothing, the answer is exactly the
summary category — the behaviour that shipped before this PR.

### Verification

**7 new tests.** The one that matters most is the **no-regression** case: for a booking carrying only
a summary category, the new function returns *byte-identical* output to the old call, asserted across
four category shapes. Plus: two jobs now yield both tiles · the summary tile is never dropped ·
services written in either vocabulary both resolve · nothing on either side returns `null` (**not**
an empty array — an empty array is truthy and a caller treating it as a narrowing set would hide
every desk) · duplicates collapse · junk is skipped rather than thrown on.

- `tsc --noEmit` **exit 0, 0 errors** · `next lint` clean · **`test:unit` 6,003 / 6,003**
- No migration, no policy, no schema.

### What this does and does not unblock

It makes the role picker and the role-scoped run of day **reachable** — they were dormant only
because the second role was never read.

They still will not appear in production **yet**, for an ordinary reason: `vendor_services` has zero
rows, so no vendor has listed their services. That resolves itself the first time a real vendor sets
up shop — no code change required.

SPEC IMPACT: Yes — `Role_Scoped_Day_Of_DESIGN_2026-08-01.md` § 5a is corrected in the same session:
the "booking model cannot express two roles" blocker and its three schema options are withdrawn.
