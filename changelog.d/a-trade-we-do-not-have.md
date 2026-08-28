## 2026-08-28 · feat(taxonomy): a trade we do not have arrives ready to press (C4)

When a supplier tells us about a service we have no word for, the request no
longer lands in the admin queue as a bare label. It arrives with a drafted
proposal attached: a cleaner name, the branch it might belong under, and the
near-matches that were considered and **rejected with a reason each** — rendered
**above** the Promote button, never below it.

**Ships dark.** `CATEGORY_PROPOSAL_DRAFT_ENABLED` defaults OFF. Production has
held **zero** category requests, ever (read by the object 2026-08-28), so
nothing is drafted for anybody until the owner switches it on.

- ⛔ **It drafts; it never mints.** There is no path from the drafter to
  `promoteCategoryRequest`, `canonical_service_schemas` or
  `canonical_service_taxonomy` — asserted, not asserted-in-prose, by
  `lib/category-proposal-mints-nothing.test.ts`, which censuses every file in
  the app that so much as names the mint and fails on a new one. A person
  presses. Three measured reasons in § 4 of the plan: removing a leaf strands
  the shops that listed under it (`vendor_coverages.canonical_service` has no
  FK at all); the mint's duplicate check is a SLUG match, so a machine would
  create "Sorbetes Cart" beside "Ice Cream Cart"; and the owner's standing rule
  is that the assistant may prepare and may hold back, never let a publish
  through.
- **Two arms, and the free one runs first.** The shipped ranker
  (`lib/taxonomy-search-rank.ts`, carrying C2's reviewed aliases) is asked
  first: a hit becomes a draft that says *"we think we already have this — Map
  it"*, at ₱0 with no model and no key. Only when the live list has nothing at
  all does a model write a proposal. Nothing new matches anything: no second
  matcher, no second slugifier, no second Anthropic client, no second key check.
- **The reviewer can correct the minted name.** `promoteCategoryRequest` takes
  an optional `proposed_label_override` (absent → byte-identical to before).
  Without a reader the drafted "clean name" would have been a stored value
  nothing consumes.
- 🔒 **The supplier is never blocked, and never meets an error about an
  assistant they did not ask for.** The request is INSERTed and safe before
  anything is drafted; the drafter cannot throw and returns nothing to handle;
  and both dead ends now say on screen that a card can ship under
  **Miscellaneous** today and be moved later.
- 🚨 **The exposure-freeze guard caught a real widening in the first cut** — the
  schema's default ACL handed `authenticated` SELECT/INSERT/UPDATE on all nine
  new columns (11 capabilities). Regenerating the baseline would have recorded
  that as intended; both roles are revoked instead, and the baseline grows by
  exactly **one** line: the admin-only policy. Verified against production in a
  rolled-back transaction (9 columns · RLS on · 1 policy · **0** table grants ·
  **0** column grants for anon/authenticated).
- 🪤 **A trap named rather than worked around silently:** written the obvious way
  (`if (overrideRaw && overrideRaw.length < 2 …)`), the optional name box is
  published to the ⌘K checklist as `refusedWhenEmpty` — `scan-admin-jobs.ts`
  cannot tell an optional RANGE check from a required-field check. The action's
  shape avoids it and a test pins the field as optional.

Proof: TSC_EXIT=0 / 0 errors · unit `# tests 11040`, 0 fail · db `# tests 1717`,
0 fail · **15 measured mutations, every one landed (occurrence count or byte
offset, before → after) and every one red.**

SPEC IMPACT: `WHATS_NEXT_The_Category_Suggester_2026-08-28.md` § 4 and
`WHATS_NEXT_Category_Suggester_SESSIONS_2026-08-28.md` — C4 is built and dark;
the remaining owner decision is when to switch it on. `DECISION_LOG.md` row
added 2026-08-28.
