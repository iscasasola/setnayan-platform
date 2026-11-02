## 2026-08-05 · fix(admin): restaurants (and multi-purpose halls) get a home they can live in

**SPEC IMPACT:** Applied — `DECISION_LOG.md` 2026-08-05 (owner: *"build a home for
them - Restaurant"*).

🔴 **THE DIRECTORY HELD ZERO RESTAURANTS BECAUSE THE FORM HAD NO SUCH OPTION.**
`venue_directory_type` allows **19** values; the admin's `VENUE_TYPES` offered
**13**, and `restaurant` was not among them. So after a host could finally set
their venue to "Restaurant" (#4144), the marketplace had nothing to show them —
permanently, with no error anywhere. Not a missing row: a missing option.

`multi_purpose_hall` was missing for the same reason and is the same class of
gap — a parish or barangay hall is where a very large share of Philippine
christenings and children's birthdays actually happen.

⚠ **Four enum values stay deliberately absent** and now say so in code:
`banquet_hall`, `garden_estate`, `beach_resort` and `heritage_hacienda` are
second-era duplicates of `hotel_ballroom`, `garden`, `beach` and `heritage`, and
no directory row uses any of them. Offering both halves of each pair would let
two admins file the same venue under different types and get different results —
a merge to perform on purpose, not a picker to widen.

**`venue-types-have-a-home.test.ts`** makes the assertion two-sided: a value must
be OFFERED or EXPLICITLY EXCLUDED WITH A REASON, and a placeholder reason
("TBD") fails. A new enum value fails the test until someone decides. It also
checks both admin surfaces carry a label — a type an admin can create but cannot
filter for is one they can lose. Mutation-verified across all three files.

**Restaurants are not wedding-scoped**, which is the point: a directory venue
with an empty `compatible_ceremony_types` is "open to all", so a date, hangout,
travel or birthday host who picks Restaurant is matched the same way a couple is.
