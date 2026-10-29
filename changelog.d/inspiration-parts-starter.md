## 2026-10-29 · feat(inspiration): seed the 272 approved starter inspiration looks

Owner, 29 Oct, verbatim: *"proposed inspiration starter yes."* — approving the review set
`setnayan-handoff-src/carry-2026-10-29/inspiration-parts-starter/` with its drafted defaults (~10 looks
per service; officiants and counseling left out as marketplace-hidden; the Farewell group's six sober
parts kept).

One data-only migration, `supabase/migrations/20271296836679_seed_the_starter_inspiration_parts.sql`,
adds the review set's **272 NEW parts** to `inspiration_parts` and their **2,384 service links** to
`inspiration_part_services`. Each part keeps its label exactly as written in `parts.csv`; its home is
the tier-2 tile of its first listed service (read at apply time); its order and its links' order follow
`/admin/categories`' own "Add part". The 29 existing parts and their links are not touched.

One-time guard: parts are `ON CONFLICT DO NOTHING`, and links go **only** to the parts this run
inserted. So a second apply writes nothing, and a link an admin removes is never re-made. A service
missing from the database (the five the owner added in production on 29 Oct are not in any migration)
is skipped with a NOTICE, not a failure. The ③a double-write trigger is paused for the one bulk insert,
and its rows are written once, set-based.

The SQL block is generated from the CSV by `apps/web/scripts/gen-inspiration-parts-starter-seed.ts`
(`--check` compares; the CSV's sha256 is on the block). It is held by
`apps/web/tests/db/the-starter-inspiration-parts-seed-once.db.test.ts`, which applies the seed twice.

SPEC IMPACT: `DECISION_LOG.md` row "APPROVED — STARTER INSPIRATION LOOKS SEEDED" (owner approval verbatim
plus counts). No iteration spec changes.
