## 2026-08-07 · fix(add-ons): the empty photo slot — deleted, not filled

The register said an add-on map left the photo entry as an empty array behind a
to-do, and to **fill it before anything uses it**. Filling it would have created
the defect the entry warns about.

**Papic ownership is not an `orders` question.** Papic is free to start and its
grant writes a points row, not an order. Prod holds **13 seats and 9 grants
against 0 orders** — so an orders-keyed lookup answers *"not owned"* for every
Papic-active event in existence. That is precisely the July incident recorded in
that file's own header, pointed at a different feature: a host who had paid was
shown a **buy button instead of their control room**.

The key is removed, with the reasoning written where it used to be. The
authority is the existing `eventPapicActive()`, already used by nine call sites.

**Also deleted: `eventOwnsFeature`.** Zero callers repo-wide, and its
`if (skus.length === 0) return false;` is the loaded gun — it is the function a
future session reaches for by name, and it answers "you don't own this" for any
feature whose SKU list is empty.

Plus: the module docblock named a consumer that has never imported it, and the
stats query counted only `paid` while the ownership resolver counts
`paid OR fulfilled`. Aligned.

### 🛡 The guard took three drafts, and two were dropped

1. **Existence check against `sku-catalog.ts`** — flagged all four live codes.
   The module's own header says to verify against the live catalog and **never**
   against that file. Any code-file version is two hand-typed lists agreeing
   with each other, which is not a guard; a db test would read the replay seed,
   not the production catalog. **Dropped, not weakened into something that passes.**
2. **"No feature may map to an empty list"** — sounds right, is false here. Four
   entries are legitimately empty; the save-the-date is the free page-opening
   reveal with no SKU at all. **A rule that reddens on four correct entries
   teaches you to skim past the one time it is right.**
3. **What shipped:** the two things that are actually true — the incident's SKUs
   are still mapped, and `papic` must stay absent. Sabotage-tested: re-adding a
   `papic` key fails with the reason.

The dropped drafts are recorded in the file so the next person doesn't rebuild
them.

SPEC IMPACT: None — closes the last engineering item in `WHAT_IS_LEFT.md` §1.
