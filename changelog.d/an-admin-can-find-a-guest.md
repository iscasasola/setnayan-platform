## 2026-08-27 · feat(admin): the admin's own search box finds a guest by name

The owner ruled that an admin must be able to find any guest by name across
every celebration — *"we must be able to find them and have our actions as admin
available when we find them"* — and, asked directly whether that was acceptable
as a privacy call, answered **yes**.

**That search already existed and was not the problem. The DOOR was.**
`ugatSearchInner` gained a guest arm earlier the same day and it is correct. It
lives inside the Entity map console at `/admin/ugat/map` — a page you have to
already know about. The box on the admin bar, the one the owner asked for by
name after saying *"i do not see the AI searchbar"*, searched **no database
record at all**: measured, its only reads are `platform_retail_catalog_v2` (the
price rows) and `admin_search_phrases` (the learned-phrase memory), so its whole
corpus was the curated menu, the scanned route tree, the job vocabulary and the
SKU list. Typing a guest's name into it returned nothing, and the AI fallback
could not rescue that — every href it answers with is re-validated against the
route map, so it can only ever return a page.

🔑 **A fix nobody can reach is no fix — the fifth time this project has written
that sentence down**, and the palette's own docblock is where the fourth is
recorded. Nothing was rebuilt: the box now calls the shipped search.

**What changed**
- `lib/admin-map/admin-record-rows.ts` (new) — the presentation rule between the
  shipped search and the box.
- `app/admin/_components/record-search.ts` (new) — a module that exposes exactly
  ONE read, delegating to the already-gated search.
- `lib/admin-map/palette-nav.ts` — record rows join the ONE list the keyboard
  walks; `hitOffsetOf` now counts only the rows *before* the hits.
- `app/admin/_components/admin-command-palette.tsx` — debounced record search,
  rendered under the page and job hits.

🔒 **THE OWNER'S FENCE IS ENFORCED IN CODE, NOT IN A COMMENT.** A result row
shows only what identifies the record — a name, a status, and which celebration
it belongs to. `redactContactDetail` drops a subtitle carrying an email or a
phone number rather than editing it (partial redaction leaves whatever the
pattern did not recognise on screen). It is applied to **every** category, not
the one that needs it today: the guest arm already selects no contact column,
but the user arm's subtitle *is* an email address, and a seventh arm would
inherit whatever this layer tolerates.

⚠ **NINE, NOT SEVEN, DIGITS.** The phone rule's first floor redacted an ISO date
(`2026-08-27` is eight digits with separators) — so a celebration named for its
date lost its subtitle. Nine clears every real number and leaves dates alone.

🔑 **EVERY CATEGORY GETS ONE ROW BEFORE ANY CATEGORY GETS TWO, and that IS the
ruling surviving the cap.** The search returns vendors first and caps each arm at
6; a plain "sort by score, take the top 8" spends every slot before the guest arm
is read, so the one thing the ruling is about would be the row silently dropped.

🪤 **A ROW SOMEWHERE ELSE REINTRODUCED A BUG IN A FUNCTION NOBODY TOUCHED.**
`hitOffsetOf` counted *every* non-destination row — correct while the ask row was
the only one and always first. Records append **after** the hits, so that version
counted them too and every page row would have highlighted N places away from the
row Enter opened: the exact defect that function's own docblock says it exists to
make unwritable.

🔒 **THE PALETTE STILL CANNOT ACT.** `admin-job-ask-form.test.ts` refuses any
`/actions` import, and it fired on the first draft — rightly. It was satisfied
properly rather than weakened: `ugat/actions.ts` exports four functions and all
four are reads *today*, but the property worth keeping is "the box cannot reach a
mutation", not "that file happens to be read-only". A new guard pins that the
read-only door has exactly one export and delegates.

🛡 **13 mutations, every one measured before → after, all 13 RED.** One is worth
recording: M13 is *additive*, so it keeps the string it anchors on and the
harness's "occurrences → 0" check reported a landed sabotage as unlanded. It was
re-measured by **export count** (1 → 2). *An unmeasured mutation proves nothing —
and the measurement has to match the shape of the change.*

⏭ **NAMED, NOT BUILT — `people` is deliberately still absent, and this was
re-measured in prod rather than inherited.** Of 34 people, **all 9** claimed by an
account carry no name of their own and **both** who do have a name are unclaimed:
the two populations are disjoint, so `/admin/users/[userId]` resolves for none of
the people you could find by name, and there is no `people` or `person_id`
reference anywhere in the admin tree. Giving them a home needs a surface first.

⏭ **AND A FOUND GUEST STILL OFFERS NO ACTION.** Of 286 admin jobs, 43 are
record-keyed and guests have **zero**. The row opens the celebration they belong
to — a guest has no admin page, and inventing admin actions over guests is a
product decision with a privacy dimension, not this PR's call.

SPEC IMPACT: None. No schema change, no migration, no pricing or SKU change. The
ruling itself (an admin may search any guest by name; desktop only; a row shows
no contact detail) is recorded in `DECISION_LOG.md` under 2026-08-27.
