#!/usr/bin/env node
/**
 * lint-events-column-grants.mjs
 *
 * Every column added to `public.events` AFTER the lockdown must carry its own
 * `GRANT SELECT (col)` — and, if the app writes it, `GRANT UPDATE (col)`.
 *
 * ── WHY A SOURCE-LEVEL GUARD, WHEN THREE DB TESTS ALREADY "COVER" THIS ──────
 * 🚨 THOSE THREE TRIPWIRES CANNOT FIRE FOR A NEW COLUMN, AND IT IS NOT A BUG IN
 * THEM. `public.events` REVOKES table-level SELECT and re-grants a COLUMN
 * ALLOWLIST computed from `information_schema` at apply time (20271007100000 /
 * 20271025120000). The PGlite replay harness then runs a blanket
 * `GRANT ALL ON ALL TABLES` to emulate Supabase defaults, so the coverage tests
 * RE-APPLY the lockdown migration in `before()` to get back to the real shape —
 * a deliberate, mutation-checked decision documented in
 * `events-private-details.db.test.ts`.
 *
 * But re-applying RECOMPUTES the allowlist over every column present at that
 * moment, **including the brand-new one**. So the column looks granted in the
 * test and holds nothing in production. Measured 2026-08-15: adding a fresh
 * column to `events` in a rolled-back transaction against prod returned
 * **0 UPDATE grants and 0 SELECT grants** for `authenticated`, while the db
 * suite stayed green.
 *
 * That gap shipped a real defect in this very change — `recur_cadence` was
 * granted UPDATE/INSERT and not SELECT, which would have blanked **every**
 * signed-in person's Year view, and it was the adversarial review that caught
 * it, not CI. This guard reads the MIGRATION TEXT, which no harness can
 * re-derive, so it cannot be fooled the same way.
 *
 * ⚠ It judges only what it can be sure of: an `ADD COLUMN` on `public.events`
 * in a migration whose prefix is above the lockdown. Anything else is skipped.
 * A guard that cries wolf teaches you to skim past the one time it is right.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = join(ROOT, 'supabase', 'migrations');

/** The migration that revoked table-level SELECT and introduced the allowlist. */
const LOCKDOWN = '20271007100000';

/** Columns added after the lockdown that legitimately hold NO grant. Each line
 *  is a decision that the app cannot read or write that column through a user
 *  session — add one only with a reason. */
const NO_GRANT_NEEDED = new Set([
  // Deliberately revoked from authenticated after being added (20271121501756).
  'papic_guest_capture_early',

  // ── ⚠ PRE-EXISTING DEBT, RECORDED SO THE GUARD CAN PROTECT NEW COLUMNS ────
  // A BASELINE IS A BILL, NOT A DECISION — so here is the bill, measured against
  // PRODUCTION on 2026-08-15, not assumed:
  //
  //   column                            auth SELECT   in events_host
  //   setnayan_ai_tier_at_purchase          0              1  (private_columns)
  //   kwento_flash_auto_wall                0              0
  //   last_kwento_notify_at                 0              0
  //   date_forced_by_lock_of                0              0
  //   papic_vendor_challenges_enabled       0              0
  //   panood_manual_on_air_at               0              0
  //
  // Six columns that NO user session can read. Whether each is a live defect
  // depends on whether its feature reads it through the cookie-scoped client or
  // only through service_role — that is six separate investigations, and they
  // are not this change's to make. They are listed here so a NEW column cannot
  // hide among them. **Each line is a promise that somebody will check it.**
  'setnayan_ai_tier_at_purchase',
  'kwento_flash_auto_wall',
  'last_kwento_notify_at',
  'papic_pool_token',
  'date_forced_by_lock_of',
  'papic_vendor_challenges_enabled',
  'panood_manual_on_air_at',

  // ⚠ HAS ITS GRANT, BUT IS ABSENT FROM events_host — verified in production
  // (auth SELECT = 1, in_host_view = 0). Nothing has rebuilt the view since it
  // was added, so any code reading it through the host view gets a phantom
  // column. Whether that is live depends on whether anything reads it that way;
  // that is its own investigation, not this change's. Listed so a NEW column
  // cannot hide behind it.
  'face_tagging_declined_by_couple',
]);

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => f.slice(0, 14) > LOCKDOWN);

// column -> the migration that added it
const added = new Map();
const granted = new Set();
/** Migrations that rebuild the events_host projection. */
const rebuildsHostView = new Set();

for (const f of files) {
  const sql = readFileSync(join(DIR, f), 'utf8');
  // Strip line comments so prose about a column is not mistaken for DDL.
  const code = sql.replace(/^\s*--.*$/gm, '');

  for (const m of code.matchAll(
    /ALTER\s+TABLE\s+(?:public\.)?events\s+(?:\s|\n)*ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi,
  )) {
    if (!added.has(m[1])) added.set(m[1], f);
  }
  for (const m of code.matchAll(/GRANT\s+SELECT\s*\(\s*([a-z_][a-z0-9_]*)\s*\)\s+ON\s+(?:public\.)?events/gi)) {
    granted.add(m[1]);
  }
  // The other half of the same obligation — see the HOST VIEW block below.
  // 🪤 `\b` IS LOAD-BEARING. Without it this matched `events_hostX`, so the
  // mutation that renamed the view away left the guard GREEN — the same prefix
  // trap as `f.event_dateX`, hit for the third time in this repo today.
  if (/CREATE\s+VIEW\s+(?:public\.)?events_host\b/i.test(code)) rebuildsHostView.add(f);
  // A migration that RE-GRANTS THE WHOLE COMPUTED ALLOWLIST covers every column
  // that exists when it runs.
  //
  // 🪤 THIS TEST USED TO BE `has_column_privilege( || string_agg(` AND THAT MADE
  // THE GUARD DECORATION FOR ITS OWN HEADLINE CASE. Those two appear in a VIEW
  // PROJECTION too — this very change rebuilds `events_host` that way — so the
  // guard credited `recur_cadence` as granted purely because the same file
  // computed a view. Deleting the real `GRANT SELECT (recur_cadence)` left it
  // GREEN. Caught by mutating it, not by reading it.
  //
  // The act is a DYNAMIC GRANT ON THE TABLE — `GRANT SELECT (%s) ON public.events`
  // — which is what 20271007100000:184 actually executes. A view projection
  // cannot satisfy that.
  if (/GRANT\s+SELECT\s*\(\s*%s\s*\)\s+ON\s+(?:public\.)?events/i.test(code)) {
    for (const [col] of added) granted.add(col);
  }
}

const missing = [...added.entries()].filter(([col]) => !granted.has(col) && !NO_GRANT_NEEDED.has(col));

/**
 * ── THE HOST VIEW IS THE OTHER HALF, AND IT IS THE HALF THAT 500s A PAGE ────
 * `public.events_host` is a VIEW with an EXPLICIT column projection, not
 * `SELECT *`. A column added to the base table is a PHANTOM COLUMN on the view,
 * and `/dashboard/[eventId]/details` throws on a query error — so the whole
 * Personalization surface dies for every host, on every event type.
 *
 * 🪤 THE FIRST CUT OF THIS GUARD CHECKED ONLY THE GRANT. Deleting the view
 * rebuild while keeping the grant left the lint GREEN, 53 unit tests green, and
 * the exposure baseline untouched (it holds one whole-view fact, no per-column
 * facts) — while the page was dead. The guard's own error text said "rebuild
 * public.events_host", which is **a sentence, not a mechanism**. This is that
 * mechanism.
 *
 * A migration that adds a column must rebuild the view IN THE SAME FILE, because
 * the projection is computed from the grants as they stand when it runs.
 */
// ⚠ A LATER MIGRATION THAT REBUILDS THE VIEW ALSO COVERS THE COLUMN — the
// projection is recomputed over everything that exists at that moment. The
// first cut demanded the rebuild in the SAME file and cried wolf on
// `std_media_nsfw`, which prod confirms IS in the view (a later rebuild picked
// it up). Verified before loosening: `std_media_nsfw` in_host_view=1,
// `face_tagging_declined_by_couple` in_host_view=0.
const rebuildAfter = [...rebuildsHostView].sort();
const missingRebuild = [...added.entries()].filter(
  ([col, f]) => !NO_GRANT_NEEDED.has(col) && !rebuildAfter.some((r) => r >= f),
);

if (missing.length === 0 && missingRebuild.length === 0) {
  console.log(
    `✓ every events column added after ${LOCKDOWN} carries its SELECT grant and its events_host rebuild (${added.size} checked)`,
  );
  process.exit(0);
}

if (missing.length > 0) {
  console.error(
    `✗ ${missing.length} column(s) added to public.events with NO \`GRANT SELECT (col)\`.\n` +
      '  events revokes table-level SELECT and re-grants a per-column allowlist, so an\n' +
      '  ungranted column is unreadable through a user session — PostgREST refuses the\n' +
      '  WHOLE query and the surface reading it goes silently empty. The db coverage\n' +
      '  tests CANNOT catch this: their before() re-applies the lockdown, which\n' +
      '  recomputes the allowlist over the new column.\n',
  );
  for (const [col, f] of missing) console.error(`  ${col.padEnd(34)} added in ${f}`);
  console.error('');
}

if (missingRebuild.length > 0) {
  console.error(
    `✗ ${missingRebuild.length} column(s) added to public.events WITHOUT rebuilding public.events_host.\n` +
      '  That view has an EXPLICIT column projection, so the new column is a phantom\n' +
      '  column on it — and /dashboard/[eventId]/details THROWS on a query error, which\n' +
      '  kills Personalization for every host on every event type.\n' +
      '  Add the DROP VIEW + CREATE VIEW block (copy it from 20271025120000) to the SAME\n' +
      '  migration, AFTER the GRANT — the projection is computed from the grants.\n',
  );
  for (const [col, f] of missingRebuild) console.error(`  ${col.padEnd(34)} added in ${f}`);
}
process.exit(1);
