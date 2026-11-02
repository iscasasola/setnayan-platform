## 2026-08-28 · feat(vendor): a service card is filed under the shop's own words

**Owner, asked and answered twice (2026-08-28):** *"1. yes 2. yes their own words."*

A supplier said what they sell **twice**, in two lists that did not agree. Coverage speaks the live
admin taxonomy — 262 visible leaves, and the owner's own shop covers a leaf called **Pabati**.
Service cards spoke `VENDOR_CATEGORIES`, 52 keys hardcoded in `lib/vendors.ts` with no *Pabati* in
it and no way to add one without a deploy. The maker bridged them **by family**, which is correct
and is not the same as the two lists agreeing: a Pabati shop was asked to file under *Photobooth*.

A card's kind may now be a **coverage leaf**. The chooser's leading band is the shop's own coverage
words, and the stored value is the leaf itself.

**Nothing was removed and nothing was migrated.** The 52 legacy kinds stay one tap below under
*"Something else I do"*, so a shop growing into something it does not yet cover is never stuck;
legacy pills whose family the shop's own words already lead with are **re-banded, not dropped**.

**Measured in production before writing a line** (`SERVICE_CARD_VOCABULARY_MEASURED_2026-08-28.md`):
262 visible leaves vs 52 kinds — 16 exact / 195 family-only / **51 leaves with no card kind at
all**. 2 shops · 2 coverage rows · 2 cards, and **both cards are one seeded fixture** (`created_at`
identical to the microsecond, shop hidden). **No supplier has ever authored a service card**, so
there is nothing to migrate and this was the last moment that was true.

**A couple's search is untouched, which is why this is safe.** Every supplier-discovery path filters
`vendor_profiles.services[]` — the coverage words — and every `?category=` link the app emits
carries a canonical leaf key. `vendor_services` is read on `/explore` only for the price floor, the
photo and the off-peak badge, never as the category filter.

**What changed**

- `lib/service-card-kind.ts` (new, **pure**) — the leaf index and the one fallback chain: the
  shop's own word → the legacy label → a humanised key. Never the raw key.
- `lib/card-kind-labeller.ts` (new) — the per-request wrapper. Six screens each wrote
  `isCanonicalService(cat) ? LABEL[cat] : cat`, and **that last branch prints a database key**;
  the chain is written once now.
- The save's gate (`parseCategory`) accepts a legacy key **or a live leaf**, checked against the
  same tree the chooser rendered — it is still a closed set. `vendor_services.category` is plain
  TEXT and `save_vendor_service` validates nothing (read out of production with
  `pg_get_functiondef`), so this function is the entire fence.
- Family/plan caps resolve leaf-first (`parentsOfKind`), so a leaf and its legacy pill count as
  **one** family — a Solo shop covering Pabati is not refused a Pabati card by its own coverage.
- `/services/new/[category]` accepts a leaf, or *"start from one of your cards"* would 404 on a
  card the new door legitimately created.

**Fixed on the way:** `parentsOfCategory` **threw** on any stored kind outside the 52 —
`VENDOR_CATEGORY_CANONICAL` is a Record over those keys, so an unknown one indexes to `undefined`
and `tilesForVendorCategory` dies on `.kind`. Both production cards hold `live_band` / `host_mc`,
which are tile ids in neither vocabulary, so this was reachable, not hypothetical. It is total now.

**Deliberately out of scope:** the public shop page (`app/v/[slug]`). Its raw-key fallback was
already closed today by another session, and the remaining delta is a leaf's exact display name vs
a humanised one — that is S5's scope, and two PRs landed in that file today.

**Proof.** `TSC_EXIT=0` · new guard `lib/service-card-kind.test.ts`, **11 assertions**,
**15 mutations, every one measured before → after and every one red.** 🪤 **Three of my own
assertions were decoration and only the mutation found them:** a file-level match on
`parentsOfKind(` stayed green with one of four call sites reverted; matching the bare identifier
`coverageKindOptions` stayed green with its source emptied; and a deny-list of raw-key fallback
spellings (`??`, `:`) missed the third one the mutation used (`||`) — the rule is inverted now, so
every use of a card's kind on those screens must sit inside the labeller. 🪤 And **the guard passed
while four files were missing their import** — a source-match guard cannot see that; `tsc` did.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-28 (the vocabulary ruling) ·
`SERVICE_CARD_VOCABULARY_MEASURED_2026-08-28.md` (the measurement it was decided from) ·
`WHATS_NEXT_Service_Card_SESSIONS_2026-08-28.md` § owner decisions #2 closed.
