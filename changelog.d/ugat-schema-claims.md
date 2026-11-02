## 2026-07-30 · feat(ugat): the joint registry can no longer lie about what exists — and it caught a fourth false claim on its first run

`lib/ugat/graph.ts` documents how the platform's entities are bonded. The 2026-07-30 findings re-audit showed the prose rots independently of the verdict: **three references to columns that do not exist anywhere in the 1,002 migrations** (`events.qr_revoked_at`, `payment_inbox_messages`, `order_ledger_entries`) had looked authoritative for weeks. Nothing failed, because nothing was checking.

**The fix is not to derive the registry from the schema.** Foreign keys cannot express "this column is *named* `vendor_id` but holds the BOOKING id", or "`ON DELETE SET NULL` silently orphans instead of failing". Deriving everything would produce a technically-correct map that had lost the only part worth reading. So: keep the prose, and make every **structural** sentence inside it a claim the database can refute.

**`lib/ugat/schema-claims.ts`** — six claim kinds (`table` · `column` · `no_column` · `fk` · `no_fk` · `unique`) and a pure `verifyUgatClaims()`. Deliberately free of PGlite and `fs`, so every interesting case unit-tests in milliseconds against a synthetic schema.

The negative kinds are as load-bearing as the positive ones. Several joints exist precisely to warn that a bond is **absent** — `guests` has no `user_id`; `vendor_services.category` has no FK. Left unchecked, the day someone finally *adds* that FK the registry would keep warning about a trap that no longer exists: stale in the opposite direction and exactly as misleading. `no_fk` therefore fails **loudly** when the FK appears, telling you to delete the annotation.

Vacuity is treated as failure too: a `no_column` claim on a table that has been dropped does not pass — it reports as vacuous. Otherwise a guard would grow *stronger* as the schema disappeared.

**`claims` is REQUIRED on `UgatJoint`, not optional.** An unclaimed joint is the loophole. Making it required is what forced all twelve to be authored rather than the easy three.

**Every claim authored from the prod snapshot, never from the prose** — and checking mattered. The obvious guesses were wrong in four places: the vendor-org membership table is `vendor_team_members` (not `vendor_members`), keyed by `vendor_profile_id` (not `vendor_id`); `guest_claims` uses `target_guest_id` (not `guest_id`); activations key on `service_code` while orders use `service_key`.

**`tests/db/ugat-schema-claims.db.test.ts`** replays all 1,002 migrations into PGlite and introspects `pg_constraint` / `pg_attribute`. Chosen over regex-parsing the migration text because this repo already built and **threw away** that parser — per `schema-drift.db.test.ts` it produced 18 false positives out of 32 findings, since it unions every migration and never processes `DROP` or `RENAME`. After a replay, a dropped constraint is actually gone. It needs no production credentials, and `test:db:ci`'s glob picks it up with no CI wiring to forget.

Three anti-vacuity floors run **before** the check (≥500 migrations applied, >2000 columns, >100 FKs, >100 uniques) so "the harness died" can never be mistaken for "the schema is fine". And a **canary test asserts a deliberately false claim FAILS** — using the exact `events.qr_revoked_at` phantom that sat in the registry for 25 days. A green suite that cannot go red is decoration.

### 🔴 It found a fourth false claim immediately

J13 stated `onboarding_refinements.tile_id` is "a real FK into **`canonical_service_taxonomy`** — the one safe anchor in the taxonomy cluster." Probing the replayed schema:

- the FK is real, but it references **`service_categories`**, not `canonical_service_taxonomy`
- **zero foreign keys point at `canonical_service_taxonomy`** from anywhere in the schema
- that table's PK is on `canonical_service`, so an FK to it on `tile_id` is structurally impossible

The joint's *point* survives — couple picks are FK-anchored where vendor cards are string-glued — but it was anchored to a different table than the registry claimed. Corrected in both the claim and the prose, and the trap text now records the sharper truth: **nothing in the entire schema carries referential integrity into the canonical taxonomy.** That strengthens F9 rather than softening it.

Four wrong identifiers in one registry, none of which broke anything, none of which anyone would have found by reading. That is the case for machine-checking documentation.

**Honest limit, stated not buried:** this proves the claims hold against the *declared* schema. A constraint that silently no-opped in prod (inside an exception-swallowing `DO` block, say) would exist here and not there. `schema-drift.db.test.ts` covers the column half of that gap; constraints are not yet in the committed prod snapshot.

SPEC IMPACT: `DECISION_LOG.md` row — J13's taxonomy anchor corrected (`service_categories`, not `canonical_service_taxonomy`); nothing in the schema FKs into `canonical_service_taxonomy`. No schema change, no RLS edit, no flag — a test and a registry annotation only, so no exposure-baseline regeneration.
