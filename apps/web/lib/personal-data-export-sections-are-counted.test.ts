/**
 * "Download my data" — two promises the file makes, pinned against its builder.
 *
 * 1 · EVERY SECTION IS COUNTED. `export_complete` is TRUE only when no section
 *     failed. A section unwrapped with listOutcome()/singleOutcome() but left out
 *     of collectIncomplete([...]) can fail and still ship `[]` under
 *     `export_complete: true` — "you have no such records" when we did not look.
 *     Measured 2026-11-05: ten shipped sections were in exactly that state
 *     (samahan_stories, samahan_messages, papic_free_grant_claims,
 *     user_unfollows, invite_mutes, event_type_requests, vendor_reuse_requests,
 *     inspiration_suggestions_sent, event_removals_asked_for, years_you_grouped).
 *
 * 2 · "EXPORTED" MEANS READ. lib/export-completeness.ts says, per table, that a
 *     person's rows are in their file. That sentence is only true while the
 *     builder actually reads the table. A table marked exported that nothing
 *     reads would satisfy the DB guard and still be missing from every file.
 *
 * Source-text checks, deliberately: the builder imports 'server-only' and needs
 * a live Supabase, so it cannot run here. Comments are stripped first so prose
 * that mentions a table or a variable cannot satisfy either check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportedTables } from './export-completeness';
import { stripComments } from './strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const BUILDER = path.join(HERE, 'personal-data-export.ts');

function code(file: string): string {
  return stripComments(fs.readFileSync(file, 'utf8'));
}

test('every section the builder unwraps is counted towards export_complete', () => {
  const src = code(BUILDER);
  const unwrapped = [...src.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*(?:listOutcome|singleOutcome)\s*(?:<[^>]*>)?\s*\(/g)].map(
    (m) => m[1] as string,
  );
  // Anti-vacuity: the builder had 60+ sections on 2026-11-05.
  assert.ok(unwrapped.length >= 50, `found only ${unwrapped.length} unwrapped sections — the pattern has drifted`);

  const start = src.indexOf('collectIncomplete([');
  assert.ok(start >= 0, 'collectIncomplete([ … ]) not found in the builder');
  const end = src.indexOf(']);', start);
  const counted = new Set(src.slice(start, end).match(/[A-Za-z0-9_]+/g) ?? []);

  // A section that only feeds another one through `.incomplete` (the media
  // read, folded into vendorMediaIncomplete) is counted through that variable.
  const FOLDED = new Set(['media']);
  const uncounted = unwrapped.filter((v) => !counted.has(v) && !FOLDED.has(v));
  assert.deepEqual(
    uncounted,
    [],
    `These sections are read but NOT passed to collectIncomplete(): ${uncounted.join(', ')}. ` +
      'A failed read of any of them would ship an empty list under export_complete: true. ' +
      'Add each to the collectIncomplete([...]) list in lib/personal-data-export.ts.',
  );
});

test('every table marked "exported" is actually read by the builder', () => {
  // The builder plus the small per-table readers it calls (export-own-*.ts).
  const files = [
    BUILDER,
    ...fs
      .readdirSync(HERE)
      .filter((f) => /^export-own-.*\.ts$/.test(f) && !f.endsWith('.test.ts'))
      .map((f) => path.join(HERE, f)),
  ];
  const src = files.map(code).join('\n');
  const read = new Set<string>();
  for (const m of src.matchAll(/\.from\(\s*'([a-z0-9_]+)'\s*\)/g)) read.add(m[1] as string);
  // PostgREST embeds inside a select string, e.g. 'communities(…, samahan_reads(…))'.
  for (const lit of src.matchAll(/'([^'\\\n]*)'/g)) {
    for (const e of (lit[1] ?? '').matchAll(/([a-z0-9_]+)\(/g)) read.add(e[1] as string);
  }

  const notRead = exportedTables()
    .map((t) => t.table)
    .filter((t) => !read.has(t));
  assert.deepEqual(
    notRead,
    [],
    `lib/export-completeness.ts says these tables are in every person's file, but the builder never reads them: ` +
      `${notRead.join(', ')}. Read them in lib/personal-data-export.ts (scoped to the subject), or change the decision.`,
  );
});
