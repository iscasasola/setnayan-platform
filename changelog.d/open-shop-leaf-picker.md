## 2026-08-09 · feat(open-shop): the primary service now drills parent → branch → leaf — and a trap that would have made vendors invisible is closed with it

Owner, 2026-08-09: *"primary service must branch from parent category until it reaches leaf category."*

Step 1 of Open your shop offered a flat `<select>` over ~45 **coarse** categories. The real taxonomy is **15 groups → 70 branches → ~237 specific services**, so a vendor could not actually say what they do — a pre-nup photographer and a wedding photographer picked the same word. Now a drill-down with a breadcrumb, plus a search box that jumps straight to a service and shows `Group › Branch` under each hit, so the vendor learns the hierarchy while using it.

**Phone first.** ~237 leaves cannot be a list at 375px; drilling shows at most 15 rows at a time. **The flat select survives as the fallback for an empty tree** — a failed taxonomy read must not become "you cannot open a shop".

**RULE 0:** the tree, its pruning and the crumb/row grammar all come from the shipped coverage editor. What is deliberately NOT reused is that component — it is welded to an existing vendor profile, its own server actions and per-leaf "add coverage" state that `/open-shop` has none of. Copying the markup is the reuse; importing it would have meant faking four dependencies.

### 🔴 The trap the picker would have introduced

**Nine first-party Setnayan SKUs are ordinary marketplace-visible leaves in that tree**, sitting beside the real trades — verified in production: `setnayan_papic`, `setnayan_ai_edited_highlight` and `setnayan_save_the_date_mp4` under **Documentary › Photo & Video, right next to `photography`**; `setnayan_panood` under Livestream; `setnayan_patiktok` under Booths › Photo Booth; `setnayan_concierge` under Planning › Coordinator; `setnayan_pakanta` / `setnayan_pailaw` / `setnayan_custom_monogram` under Design › Digital Services.

`vendor_market_stats` computes `is_setnayan_service` by array-membership of `vendor_profiles.services` against exactly those keys, and `/explore` excludes every row where it is true. **A vendor who drilled into Photo & Video, tapped "Setnayan · Papic", finished onboarding and got verified would never appear in the marketplace** — no error, no log, nothing to notice. The same silent-refusal family as the phantom column, the phantom enum value and the phantom RPC argument.

⚠ **It would have been a regression the picker created, not a pre-existing bug** — the flat select it replaces is built from coarse categories and physically cannot express a first-party key. So the filter ships in the same change, as a **prefix rule rather than a copied list** (a tenth `setnayan_*` SKU is covered the day it is seeded), and `tests/db/open-shop-service-tree.db.test.ts` asserts that convention still matches the live view.

### ⚠ A premise correction

Earlier notes in this session — and the brief this work started from — said `vendor_profiles.services` is a `vendor_category[]`. **It is `TEXT[]` with no CHECK.** Verified live: `SetnaProd → ['pabati']`, the fixture shop → `['live_band','host_mc']` — none of those are coarse categories. Leaves were already being stored; nothing about the column blocked this.

### What gets stored, and why both

`[coarse, leaf, ...existing]`, de-duplicated, coarse first:
- **index 0 is read as "the primary service"** by the shop hero, the marketplace card and the vendor overview, and `?category=` filters with `.contains('services',[coarse])` — coarse must be present or the shop is missing from its own category browse.
- **the leaf must also be present**: `?tile=` filters with `.overlaps()` against canonical leaf keys, so a coarse-only shop is invisible to every tile-scoped browse. The more specific the couple's search, the more certainly they would miss it.

The server **re-resolves the posted leaf** against the same filtered tree rather than trusting the form. That one lookup makes three attacks impossible at once: a hand-rolled POST cannot smuggle a first-party key, a retired leaf, or a leaf paired with someone else's branch (the coarse category is derived from the tile the **tree** says).

⏭ **Not written: a `vendor_coverages` row.** `syncProfileFromCoverages` rebuilds `services` from coverage rows and would drop the leaf — but only once a vendor uses the coverage editor, at which point coverage is legitimately the source of truth. Writing from `/open-shop` would make it the first real writer of a table holding 1 row in all of production. Flagged, not done.

### Fixed alongside: a database key was being printed at couples

`displayServiceLabel` returned the raw string for anything outside the coarse list — so a stored leaf rendered as `pre_nup_photographer` on the public shop page's "Services offered" chips, on the marketplace card, and inside schema.org JSON-LD. Production's `SetnaProd` already advertises `pabati`. Storing leaves deliberately would have made that universal, so it now humanises. Not a lookup — the pretty name lives in the database and this is a pure function; "Pre Nup Photographer" is the floor, and callers holding the taxonomy should still prefer its label. No test pinned the passthrough (checked).

### 🪤 The guard could not run at first

`isFirstPartyService` was written behind `import 'server-only'`, and the db test could not load the module at all — **a guard you cannot run is not a guard**. Split into a pure `open-shop-service-vocab.ts` plus the fetching half, the same shape as `booking-fee-gate.ts` / `booking-fee-charge.ts`.

Verified: **7257/7257** unit tests · 11/11 across both db guards · all 20 `lint-*.mjs`. The first-party guard is neutralisation-checked — a permissive filter must let the SKUs leak, or case 2 proves nothing.

SPEC IMPACT: `Vendor_Onboarding_Redesign_Verdict_2026-07-21.md` — its TARGET FLOW called for exactly this (type-ahead over leaves with `Parent › Branch` breadcrumbs). Event types are still ASKED via chips rather than inferred from the leaf's `applicable_event_types`; that inference is the verdict's stated end state and remains an owner call. `DECISION_LOG.md` row added.
