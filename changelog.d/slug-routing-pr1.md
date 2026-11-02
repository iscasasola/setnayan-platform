## 2026-07-01 · feat(routing): users.slug foundation for /u/[user]/[event] routing (PR1 of 8)

First, additive-only step of the three-tier public-URL reshuffle (owner-directed):

- **vendor** → `setnayan.com/[vendor-slug]` (bare root, was `/v/[slug]`)
- **user** → `setnayan.com/u/[user-slug]` (new public profile: 1 event → redirect to it, 2+ → picker, 0 → public editorials)
- **event** → `setnayan.com/u/[user-slug]/[event-slug]` (nested under the owning account, was bare-root `/[event-slug]`)
- **custom BYO domains** (`sny.theirdomain.com`) via Vercel Domains API (later PR)

This PR ships schema only — **nothing reads `users.slug` yet**, so it is safe to deploy well ahead of the routing cutover.

- Migration `20270424889744` — adds `public.users.slug` mirroring the `events.slug` contract exactly (`^[a-z0-9-]{3,32}$`, case-insensitive unique partial index, nullable during backfill). No RLS change needed: the existing `user_owns_row` (FOR ALL, `user_id = auth.uid()`) already makes it self-owned.
- Same migration backfills every existing account (idempotent `WHERE slug IS NULL`) from `display_name` with diacritic folding (`Niño`→`nino`, `José`→`jose`, matching `lib/slugs.ts` `slugify()`), falling back to the already-unique `public_id`; case-insensitive collisions get a `-2`/`-3` suffix.
- Same migration widens `slug_change_log.entity_type` CHECK to include `'user'` so user-slug renames get the same 90-day redirect ledger as events/vendors.
- `slug` stays **NULLABLE** — a later migration flips it `NOT NULL` once live slug-generation for *new* accounts is wired (routing PR) and every row is confirmed populated.

SPEC IMPACT: Introduces a new public-URL architecture that supersedes the locked iteration-0002 bare-root `setnayan.com/[event-slug]` pattern. A `DECISION_LOG.md` row should be appended (corpus) recording the three-tier scheme + custom-domain decision. Flagged to owner — this changes a live, printed-QR-committed URL shape; backward-compat redirects land in PR3/PR6.
