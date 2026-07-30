## 2026-07-30 · feat(ugat): a new subsystem can no longer ship invisible to the map — and the first run found 59 already were

`schema-claims` (shipped earlier today) closed the hole where the Ugat map could **say** something untrue. This closes the opposite one: the map silently falling **behind** a schema that grows weekly.

**The failure this prevents, concretely.** `20270808218211_samahan_communities_foundation.sql` created `communities`, `community_members`, `community_invite_tokens` and an `events.community_id` FK — an entire product concept — and `/admin/ugat/map` did not learn about it for three weeks. Nobody erred. There was no signal.

**Three sensors, unioned, because each has a blind spot the others cover:**

- **hub** — a table two or more distinct tables reference (Samahan's `communities` had three)
- **spine-referenced** — a table a mapped *core* table points at; the signature of a new concept attaching to the platform spine
- **name-family** — three or more tables sharing a prefix with no mapped member; catches star-shaped clusters that hang off `events` rather than off each other, which the first two miss

The mapped set is **derived from `graph.ts` at check time** (node tables + joint tables + claim tables), never hand-listed — so properly mapping a concept greens the check with no baseline edit. A second hand-maintained list would drift, which is the disease this treats.

**Why it cannot cry wolf.** Every input comes from `pg_catalog` *after* executing all 1,002 migrations in PGlite. A finding can never point at something that doesn't exist. Its findings are judgement prompts — "is this three-table feature a concept?" — never factual errors. That distinction is exactly what the deleted regex parser lacked (18 false positives of 32 findings; autopsy in `schema-drift.db.test.ts`). If it ever feels noisy the response is a threshold bump, not deletion — both thresholds are parameters for that reason, with a test proving one silences a borderline hub.

**Ordinary PRs cost nothing.** Columns, indexes, RLS policies, seeds, reprices, single leaf tables: structurally invisible. Asserted directly — a lone table with one FK to `events` must NOT fire, and a family whose concept is already mapped must NOT fire.

**It lives in `tests/db/*.db.test.ts`** — inside the `typecheck + lint` job, which is a **required** status check on main. Verified against branch protection: there are 12 required checks, and a guard in a non-required job can go red while the PR merges anyway. That is false coverage, so nothing new was put there.

### 🔴 The first run found 59 unaccounted things, and most were real

Not a tuning problem — a measurement. The map has 10 concepts; the product has roughly 25–30. It shipped as "slice 1", explicitly platform-level, and had never covered the rest.

The big absences: **Papic (13 tables, a flagship SKU)** · the **person spine** (`people`, `person_connections`, `households`, `dependents` — the basis of the family tree) · packages and proposals · seating and floor plan · Live Studio / Panood / Patiktok · the song catalogue · the `event_vendor_*` booking cluster (9 tables) · and `chat_messages` — the map knows conversations exist but not that they contain messages.

**So the baseline is seeded honestly, with two distinct prefixes.** `declined —` for the ~7 genuine ops families that should stay off the map forever. `map-backlog —` for the ~44 real product subsystems, each an admission rather than a decision, each a candidate node. Writing `declined` against Papic would have been a lie that read as green. The count of `map-backlog` lines is a debt figure and should shrink.

**The escape hatch is itself rot-proofed.** A baseline line whose table no longer exists fails. A line for a table that has *since been mapped* fails too — promoting a concept must remove its "declined" record, or the file contradicts itself. Reasons under 12 characters, or `TODO`/`TBD`, fail. Prefix keys (`papic_*`) exist so declining a 13-table subsystem is one readable line rather than thirteen — a file nobody reads is a file whose reasons stop being true.

**Two honest characteristics, asserted in tests so nobody "fixes" them later:** the family sensor cannot match a plural mapped table against its singular family (`users` vs `user_*`, `communities` vs `community_*`), because plural-stemming would be fragile guesswork; both cases are covered by the other sensors or by an explicit baseline line. And a wrong-but-plausible classification stays green — the guard forces the *moment* of decision, never the quality of it. That part is review-only, and saying so is the point.

Also lands the `CLAUDE.md` rule, **in the same PR as the check it cites** — a rule that arrives before its enforcement is a polite request, and decays exactly like the health findings did.

SPEC IMPACT: `DECISION_LOG.md` row — the Ugat map covers ~10 of ~25-30 product concepts; the gap is now recorded as a `map-backlog` in `apps/web/tests/db/ugat-concept.baseline.txt` and enforced by a required check. No schema change, no RLS edit, no flag; no exposure-baseline regeneration.
