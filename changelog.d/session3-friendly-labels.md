## 2026-08-12 · feat(marketplace): say the words people actually type — the 15 category labels, Journal → Articles, and a search that bridges their word to our shelf

Redesign **Session 3**. The live marketplace showed customers our *internal* vocabulary — **Look · Feast · Documentary · Booths · Prints · Program**. Nobody types those. "Photographer" and "videographer" both lived inside *Documentary*; catering was *Feast*; hosts and bands were *Program*. Owner approved all fifteen replacements on 2026-08-12, unchanged from the drafted list.

### 🚨 The brief said "a blast radius of exactly one map." It was wrong, and the wrong version half-lands silently.

The session brief scoped this to `WEDDING_FOLDER_LABEL` in `lib/taxonomy.ts`. Measured against `origin/main` and prod, these words render from **three independent sources**:

1. **`lib/taxonomy.ts`** — read *directly* by the icon-tile strip (`icon-tile-folder-strip.tsx:211`) and by the search autocomplete list, which is built at module load.
2. **`service_categories.label_en` / `label_short` in the DATABASE** — read by the live catalog **section headings** via `getTaxonomy()` (`lib/taxonomy-db.ts`), which falls back to the constant *only* when that read is empty or errors. `explore/page.tsx:3554` shadows the imported constants with the DB snapshot for the whole `CatalogView`. **Prod held the old internal words** (verified by query, all 15 tier-1 rows).
3. **A third hand-typed copy inside the couple's setup wizard** — `PICK_GROUPS_FALLBACK` group labels + a `FOLDER_LABEL` map whose own comment said it "mirrors WEDDING_FOLDER_LABEL".

**So doing what the brief said would have shipped one page speaking two vocabularies**: chips reading *Photo & video* directly above section headings still reading *Documentary*, with nothing thrown and nothing logged. Same family as the phantom column · phantom enum value · phantom RPC argument · blocked iframe — **the only symptom is an absence.**

**All three moved in one commit:**

- `lib/taxonomy.ts` — both label maps. `WEDDING_FOLDER_SLUG` is **untouched**, so every `?folder=` link, anchor and saved/printed URL resolves exactly as before. Zero address or SEO cost.
- `supabase/migrations/20271139755588_friendly_category_labels.sql` — moves the 15 DB rows. **Idempotent and non-clobbering**: each field updates only while it still holds the exact retired word, so a re-run is a no-op and an admin's own Taxonomy Studio edit is never overwritten. Ends with a `DO` block that **raises** if any retired word survives — a migration that silently matched nothing looks exactly like one that worked.
- `onboarding-shell.tsx` — the wizard now **imports** `WEDDING_FOLDER_LABEL` instead of carrying its own copy (10 hand-typed group labels → 0). Also deleted the `PICK_INFO.g` field: **53 entries of dead data** carrying the retired words, read by nothing (only `.d` is ever used — confirmed by typecheck).

### 🛡 There was no guard on any of this. There is now.

`tests/db/taxonomy-labels-match-code.db.test.ts` asserts the DB and the constant agree on **every** tier-1 folder, in `label_en`, `label_short` **and** `slug`, in both directions — plus a named list of retired words that must never reach a customer. The two copies had only ever been kept in step by hand, and the generator that seeds the DB (`scripts/gen-taxonomy-seed.ts`) is run manually.

**Both guards mutation-tested, occurrence counts printed before → after:**
- Reverting one code label (`documentary`, occurrences 2→1): **4 pass, 1 fail**, naming the folder and both sides. The other four assertions correctly stayed green.
- Neutering the migration's `UPDATE` (`AND sc.tier = 1` → `… AND FALSE`): the migration's **own** assertion fired during replay and named all **14** stale folders.

### 🔴 A live search defect, found by testing the done-criteria instead of assuming it

The criteria required "photographer", "caterer", "emcee" and **"photobooth"** each to surface the right folder. Simulated against the real 276-service list: **"photobooth" returned ZERO results.** `photo_booth` is stored as two words, so the startsWith tier, the contains tier and the snake tier were *all* blind to the single word Filipinos actually write. An empty panel, no error.

Fixed with a fourth, lowest-ranked tier that matches ignoring spaces and punctuation. The whole ranker moved out of an inline `useMemo` into `lib/taxonomy-search-rank.ts` — **pure and testable**; inside a `'use client'` component importing `next/navigation` it was unreachable from any test, so a regression could only ever have surfaced as a customer finding nothing. `lib/taxonomy-search-rank.test.ts` runs the five acceptance terms against the **real** `TAXONOMY_MAP`, not a fixture. Mutation-tested: removing the new tier turns exactly the 3 photobooth assertions red and leaves the other 8 green.

Search rows now read **`photography · in Photo & video · 12 services`** — their word on the left, our folder on the right **as a place**, never as a correction. The leading "in" is load-bearing. Counts are derived from the taxonomy with the marketplace's own two exclusions, never re-typed.

### Words that outlived their decisions

- **Journal → Articles** everywhere a reader can see it (blog index + article header + breadcrumbs + metadata + schema.org, homepage nav and section, marketing footer, the `/realstories` rail heading, vendor benefits). 22 reader-visible strings → 0. `lib/blog.ts` and the `Journal*` component/type names are unchanged — those are module names, not copy. Admin's "Journal Spotlights" is deliberately untouched: internal surface, not a reader.
- **Real weddings / Real stories → Stories**, owner-approved to include the consent line. The shelf already carried **two different names for itself** (`/realstories` said *Real stories*, its own detail page said *Real weddings*). Settled on one proper noun — **Stories** — with **"Their stories"** as the browse chip among other people's, matching the Session 5 chip vocabulary. Both consent surfaces re-read for grammar: *"Include my wedding in Setnayan's Stories showcase."* 21 strings → 0.

### ⏭ Named, not built

The second half of build item 4 — *"where a folder has no live shops, say so and offer to notify"* — is **deliberately not built**. It needs a live per-folder vendor count threaded into a module-level option list, and an intake keyed on **folder**; the only notify intake that exists (`EventTypeNotifyForm`) is keyed on **event type** and lands in `couple_event_type_notify_signups`. Building it needs new schema, which this session's own "no migration, no schema" constraint excludes. It is a separate build, not an oversight of this one.

**Verified:** typecheck clean · eslint clean (pre-existing warnings only) · all 21 `lint-*.mjs` scripts pass · 45 taxonomy unit tests pass · 11 search-rank tests pass · 5 label-drift db tests pass · `check-migration-timestamps.mjs` ✓ 1121 unique. Live counts re-measured and matching: Attire & make-up 54 · Booths & carts 42 · Venues 28 · Styling 26 · Hosts & music 20 · Invites & prints 15 · Planners 12 · Photo & video 12 · Cars 11 · Catering 7 · Insurance 3 · Experiences 2 · Logistics 2 · Dining 1 · Specialty 1.

SPEC IMPACT: Customer-facing category vocabulary changed (15 labels, owner-approved 2026-08-12) and the stories/articles shelves renamed. No SKU, price, schema or address change — `WEDDING_FOLDER_SLUG` is untouched and every `?folder=` URL still resolves. `DECISION_LOG.md` row added 2026-08-12.
