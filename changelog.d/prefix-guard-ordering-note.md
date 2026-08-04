## 2026-08-04 · docs(migrations): kill the "a low prefix means it never applies" belief

**A false claim was circulating in this repo and it cost a session's reasoning.** The belief:
*a migration whose 14-digit prefix has fallen below prod's applied head "merges with green CI and
creates nothing."*

**It is false.** `deploy-prod.yml:184` and `supabase-migrations.yml:203` both run
`supabase db push --include-all --yes`, and `--include-all` exists precisely to apply migrations
dated before the remote head.

**Measured 13 ways, not inferred:**
- 12 migrations were historically added out of order — found by diffing each file's first-commit
  date against the max prefix that existed at that moment (e.g. `20271032407062` added
  2026-08-02 when the head was already `20271033104200`). **All 12 are applied in prod.**
- The open-browse launch migration `20271102765509` applied on 2026-08-04 while sitting **two
  prefixes below the head** (`20271103100614`). `events.website_open_browse`'s `column_default`
  reads `true` in prod.

**Where the belief came from, and how it spread:** a `count(*) WHERE version = <prefix>` run
against an **unmerged** PR's migration returned `0`, which was read as *"it will be skipped."*
Zero was because the PR had not merged. The fact was right; the consequence was invented. It was
then written into migration headers, from which the next reader inherited it.

**What a low prefix ACTUALLY costs — the replay, not prod.**
`apps/web/tests/db/replay-migrations.ts:268-271` replays with
`readdirSync(...).filter('.sql').sort()` — **filename order**. A low-prefixed migration that
depends on an object created by a higher-prefixed, already-merged one fails **every**
`*.db.test.ts` while prod is fine. Prod applies in merge order; the tests apply in prefix order,
and only one of those is the filename. That, plus the UNIQUE rule, is why `pnpm migration:new`
allocates forward — a good habit for a different reason than the one advertised.

⚠ **Two MERGED migration headers still assert the false version** —
`20271102765509_open_browse_default_new_events_on.sql` and
`20271102810371_vendor_lines_library.sql`. They are applied, so they are deliberately **not
edited** (never edit an applied migration). The guard's docblock is the correction, because that
is where anyone reasoning about prefixes actually looks.

No behaviour change: comments only. Guard passes (1,036 migrations), its 5 unit tests pass.

SPEC IMPACT: **Yes — applied.** `WHATS_NEXT_INDEX.md`'s 2026-08-04 section was rewritten from the
wrong finding to this correction, and the memory note was replaced.
