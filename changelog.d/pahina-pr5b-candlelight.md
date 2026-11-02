## 2026-07-26 · feat(guest-site): Pahina wave A PR-5b — the Candlelight art direction

Final planned PR of Pahina wave A (design spec §4). **Carries a migration.**

The deliberate variation axis: one switch, two genuinely different-feeling sites. `daylight` is the
default and is byte-identical to today; `candlelight` flips the guest site to the dark direction —
warm near-black stock, warm cream type, a brightened gild so the metallic still reads, and a
candle-glow veil.

- **Migration `20271003190000_events_site_art_direction.sql`** — `events.site_art_direction text NOT
  NULL DEFAULT 'daylight'` + a named CHECK constraint, both idempotent, plus a post-condition that
  fails the migration if any row lands non-daylight. No new relation is created, so the 2026-07-26
  standing rule about REVOKE-ing default privileges does not apply — the column inherits `events`'
  existing grants and RLS.
- **The dark recipe overrides the SAME `--color-*` vars** `buildSitePaletteVars` emits, at the
  shell. That is the point: everything downstream (plates, gild, veil, the couple's accent, Pro
  custom colours layered last) keeps working through the one pipe instead of needing a second set
  of dark-only component rules. Two exceptions that genuinely need their own dark rule: the paper
  grain switches to `screen` blend (multiply turns to mud on dark stock) and the letterpress shadow
  inverts.
- **`data-art` is stamped ONLY for candlelight**, so a daylight event's DOM is unchanged.
- **Editor control** lands in the existing Pro `ColorsPanel`, posting to the SAME `updateSiteColors`
  action — no new write path, per the editor's shared-fields rule. Already gated server-side by
  `eventCoupleWebsiteProActive`.

### Two traps worth naming

1. **The column had to be added to two explicit `.select()` lists** (`[slug]/_lib/loaders.ts` and
   the editor `page.tsx`). Without that the column exists, the write succeeds, and the guest site
   silently never changes. This repo has no generated Supabase types, so a column name in a select
   string is unchecked free text — exactly the class of defect recorded in `DECISION_LOG` earlier
   today.
2. **The write is present-or-absent, never defaulted.** `updateSiteColors` is posted by two
   different forms; if a form that doesn't carry the field were read as posting `'daylight'`, it
   would silently reset a couple's Candlelight choice on every colour save. Absent field ⇒ column
   untouched. The control is a radio PAIR rather than a checkbox for the same reason — an unchecked
   checkbox posts nothing, which would make the dark direction impossible to turn back off.

Verified: `tsc --noEmit` clean · `next lint` 0 errors · **3356/3356** unit + golden tests pass ·
production build compiles (352 static pages) · `check-migration-timestamps` passes (931 migrations,
unique prefixes).

⚠ **Post-merge:** migrations in this repo auto-apply unreliably. After the wave merges to `main`,
confirm the column exists and run `gh workflow run supabase-migrations.yml --ref main` if it was
skipped.

SPEC IMPACT: None beyond the design spec §4 recipe this implements.
