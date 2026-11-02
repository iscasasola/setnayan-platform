## 2026-08-05 · fix(guest-site): the 3D venue stops refusing every event that is not a wedding

**SPEC IMPACT:** None (the decision moves from a string literal into the
`event_type_profiles` table the rest of the product already asks; no schema
change, no new column, no behaviour change for any event type in production).

`public_venue_scene` resolved the event with
`WHERE e.slug ILIKE p_slug AND e.event_type = 'wedding'` and returned
`{"published": false}` when that found nothing. So a debut, birthday or
christening host could build a floor plan, **publish it**, and their guests were
told *"The 3D venue isn't ready yet"* forever.

Same defect as the Custom QR seat pass (#4139), same reasoning: nothing on the
couple's side gates the seating editor by event type, so if 3D venues were meant
to be wedding-only the limit belongs at the point of sale — not inside a
`SECURITY DEFINER` function quietly answering "not published" to a host who
published.

**All 16 rows of `event_type_profiles` already enable `seating`**, so this
changes no existing behaviour. What changes is where the decision lives.

🔑 **`seating`, not `website`.** The guest route is a website surface and is
gated as one at the page. This function serves the seating plan specifically, so
it asks whether the event type has seating at all — a future type with a website
but no seating must not be handed a 3D seating view.

🔑 **A missing profile row means ENABLED.** The check is `NOT EXISTS(disabled)`,
not `EXISTS(enabled)`, matching `GENERIC_PROFILE` and the codebase's "degrade to
yesterday" contract: a new event type added to the enum before its profile row
lands must not silently lose its venue.

🔑 **The migration EDITS the deployed body rather than restating it.** The
function is ~200 lines amended by several migrations, and `schema_migrations` has
lied about this repo before — a hand-retyped `CREATE OR REPLACE` would silently
revert any amendment that landed after whatever file was copied from. It reads
`pg_get_functiondef`, asserts the old predicate appears **exactly once**, and
replaces it. Verified read-only against prod before writing: 1 occurrence, and
the rewritten region is the new predicate with everything around it untouched.

Post-conditions assert against the **catalog**, not this file: the wedding-only
predicate is gone, the profile check landed, and `SECURITY DEFINER`, the pinned
`search_path`, the `published_at` gate, `venue_photo_visibility` and the
`qr_token` seat scoping all survived — each one a thing a careless rewrite drops,
and each protecting a different person.
