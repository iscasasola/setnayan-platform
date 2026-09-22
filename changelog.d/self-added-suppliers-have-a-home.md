## 2026-09-22 · fix(taxonomy): a supplier the couple added themselves has a home, and it is not "Escort"

A couple's self-added supplier whose trade we could not name was filed under
**"Cars & transport › Escort"**.

`misc` is the FALLBACK `VendorCategory` — `eventVendorCategoryForCardKind`
returns it for an unknown trade and `vendorCategoryForLeaf` for an unknown leaf —
so it is what a self-added supplier is stamped with whenever the app cannot
classify them. It had no tile of its own, so `shortlist-taxonomy.ts` pinned it to
`escort`, a tier-2 tile whose parent is `transport`.

Measured on production 2026-09-22, event 044f7e64 (a live wedding): `Seda Hotel`
and `Saysay Live Band & Hosting` both carry `event_vendors.category = 'misc'`, so
the bench filed a HOTEL and a BAND under Escort. **Visible — and in the last
place a couple would look for either.**

- **New tile** `logistics_safety › everything_else` ("Everything else"), seeded
  by `20271240202428_self_added_suppliers_have_a_home.sql`. `misc` now bridges to
  it; `security` keeps `escort`, because a security detail genuinely is one.
- **Why that folder:** the plan group that owns `misc` is `logistics`, labelled
  **"Logistics & Misc"**, whose hint reads "Transportation, security, giveaways,
  and the rest". An existing budget test already asserts unbucketable rows
  "belong in Logistics & Misc (where `misc` already lives)" — the bench was the
  odd one out.
- **`marketplace_hidden = TRUE`, and that is safe.** `buildShortlistFolders`
  qualifies all three scope filters with `vendors.length === 0`, under an
  invariant it states itself: *"A COUPLE'S EXISTING PICK MUST NEVER VANISH FROM
  THEIR OWN SHORTLIST."* So the tile is invisible while empty (it holds no
  canonical service — offering it would be a fake door) and appears the moment a
  supplier is filed there. **I had this backwards at first** and wrote a comment
  claiming the bench drops hidden tiles outright; corrected in the same commit.
- **It is the FIRST hidden tile.** That branch's comment said "No tile is hidden
  today (no-op)" — also corrected, since the branch is now load-bearing.
- **Joined the registries the compiler and the guards demanded**, not just the
  two obvious ones: the `WeddingTile` union, `TILE_PARENT`, `WEDDING_TILE_ORDER`,
  `WEDDING_TILE_LABEL`, `WEDDING_TILE_SLUG`, `WEDDING_TILE_ICON` (`Boxes` — reads
  as "assorted", not as a trade), `booth-templates.ts`, `TILE_HINTS`, and
  `ADMIN_ONLY_TILES`.
- **`ADMIN_ONLY_TILES`' own heading is amended**, because it said "branches a
  couple never sees, and never should" and that is now true of only four of its
  five members. Hidden here means "not offered for browsing", not "never
  rendered".
- **`applicable_event_types` is NULL** (universal). A wedding, a wake and a
  tournament can each acquire a supplier we cannot classify; a list would
  silently drop the fallback for every type missing from it.

Proof:

- `lib/a-self-added-supplier-has-a-home.test.ts` — 4 tests, EXECUTING
  `buildShortlistFolders`. The load-bearing one asserts the hidden tile still
  renders once it holds the two real production rows, in `logistics_safety`, with
  nothing left stranded under `transport`; another walks five event types. It
  uses the untouched `fallbackSnapshot()` rather than injecting the hidden flag,
  which pins the `ADMIN_ONLY_TILES` membership too — so the constant and the DB
  row cannot disagree.
- `tests/db/everything-else-is-a-real-tile.db.test.ts` — 4 tests pinning the
  row's parent, tier, label, slug, hidden flag and NULL scope, that its parent
  folder exists, and that no canonical service was seeded under it.

⚠ Sabotage-checked in both directions: dropping the `vendors.length === 0`
qualifier fails tests 3 and 4 (every self-added supplier vanishes), and reverting
`misc → 'escort'` fails tests 1, 3 and 4.

Verified: `tsc` clean · 1263/1263 across every test touching the taxonomy
(92 files) · exposure freeze + both Ugat guards 16/16 · migration timestamp,
dup-rule, exposure-baseline, page-masthead and nav-icon-source guards pass.

SPEC IMPACT: None. No locked decision changes — this gives an existing fallback
category a home; it does not add a sellable trade or alter a price.

**Owner decisions, flagged not taken:** (1) `PLAN_GROUPS.logistics.catalogFolder`
is still `'transport'`, so that group's doorway opens a different folder from
where its `misc` tile now lives — retargeting a whole group is a bigger move than
this. (2) `security → escort` is untouched and reads oddly under Cars & transport
too, but a security detail plausibly is an escort; worth a look, not a silent
change.
