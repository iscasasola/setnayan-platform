## 2026-08-05 · feat(venues): a host can say their reception is at a RESTAURANT

**SPEC IMPACT:** Applied — `DECISION_LOG.md` 2026-08-05 (owner: *"we should allow
restaurants to be venues as well?"*).

The product could not describe a restaurant reception at **four layers at once**:
`events.venue_setting` had 7 values and `restaurant` was not one, so a couple
could not say it; `venue_directory_type` **did** have the word, so the
marketplace's vocabulary knew a concept the couple's did not; both mapping
functions returned `null` for it; and the 3D plan drew a hotel ballroom. Nothing
errored anywhere — it simply could not be expressed.

It matters most for the event types opened the same day (#4139 seat pass, #4140
3D venue): a christening, birthday or debut reception at a restaurant is
arguably the commonest Philippine case.

**Now:** the couple picks it, the marketplace matches it (`restaurant` ↔
`restaurant`, both directions), Explore labels it, and the 3D plan draws an
indoor hall.

🔑 **The 3D room is mapped EXPLICITLY, not left to `default`.** It renders
identically either way — the point is that the next reader can tell a restaurant
was *considered* and mapped, rather than falling through alongside `heritage`,
`destination` and `civil_registrar`, which do fall through and are wrong for it.
A bespoke restaurant look (smaller, closer-packed, bar-led) is still an open
design question and was deliberately not invented here.

🔑 **THE REAL RISK WAS SEVEN HAND-WRITTEN COPIES OF ONE LIST** — the DB CHECK,
three server-action allowlists, the couple's `<select>`, and two Explore label
maps. Each omission fails DIFFERENTLY and none of them throw: a rejected save · a
legal value nobody can choose · a chip rendering raw snake_case · a write that
fails at the database after the form accepted it.

So the list now lives in `lib/venue-settings.ts` and `venue-settings.test.ts`
checks every copy against it. **Mutation-verified by deleting `restaurant` from
each of the six copies in turn** — five went red immediately; the sixth did not,
because a whole-file `includes` could not tell the two mapping directions apart
and passed with only the inverse wired. That is exactly the half-wired state the
test claims to prevent, so it now slices each function separately.

⚠ **Still empty: the directory holds ZERO restaurant rows** (110 venues, none a
restaurant). A host can now say it and be filtered to it; there is nothing yet to
recommend. That is content, not code.
