/**
 * 🧭 A FILTER ON A MERGED VIEW STAYS ON THAT VIEW (admin reorg v7 — `lib/admin/admin-pages.ts`).
 *
 * The reorg mounts each old page's body inside a merged page (`app/admin/_components/merged-view.ts`): Payouts is drawn
 * at `/admin/payments?view=payouts`, Disputes at `/admin/work?view=disputes`. A `<form method="get">` with NO `action`
 * submits to the address in the bar with its query REPLACED by the form's fields — so the `view=` is dropped and the
 * filter opens a DIFFERENT page: Payouts' supplier filter landed on Payments to confirm, the Disputes filter on the
 * All list, the Receipts month on Everything. Nothing errors; the admin just sees the wrong page.
 *
 * The rule: every GET form inside a page that is mounted as a view names where it submits. The old address is enough —
 * the middleware forwards it to the view, the form's fields riding along (`adminMergedForward`).
 *
 * SABOTAGE (run 2026-11-17): removing `action="/admin/payouts"` from payouts/page.tsx turns this red naming that file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_MERGED_FORWARDS } from './admin-pages';

const APP = path.resolve(import.meta.dirname, '../../app');

function sources(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    // A nested page (`[id]`, `new`) is its own address, not part of the mounted body.
    if (statSync(full).isDirectory()) {
      if (!existsSync(path.join(full, 'page.tsx'))) sources(full, out);
    } else if (/\.tsx$/.test(name) && !/\.(test|lab)\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

/** Each `<form …>` opening tag (it may span lines). */
function formTags(src: string): string[] {
  return [...src.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
}

test('every GET form in a mounted view says where it submits', () => {
  const olds = [...ADMIN_MERGED_FORWARDS.keys()];
  assert.ok(olds.length > 30, `expected the forward table, got ${olds.length}`);
  const lost: string[] = [];
  let checked = 0;
  for (const old of olds) {
    for (const file of sources(path.join(APP, old))) {
      for (const tag of formTags(readFileSync(file, 'utf8'))) {
        if (!/method=["']get["']/i.test(tag)) continue;
        checked += 1;
        if (!/\baction=/.test(tag)) lost.push(`${path.relative(APP, file)} (${old})`);
      }
    }
  }
  // Two GET forms are left (force-majeure, disputes). The admin clean port (#8018) replaced the payouts and receipts
  // forms with picks and links, which the test below holds to the same rule.
  assert.ok(checked >= 2, `expected to check the shipped GET forms, checked ${checked}`);
  assert.deepEqual(lost, [], `these filters drop the ?view= and open another page: ${lost.join(', ')}`);
});

test('the payouts and receipts filters, no longer forms, still land on their own view', () => {
  // Payouts: every filter link is built by payoutsHref, which goes to the old address the middleware forwards.
  const payouts = readFileSync(path.join(APP, 'admin/payouts/payouts-filters.ts'), 'utf8');
  assert.match(payouts, /`\/admin\/payouts\?\$\{qs\}`/, 'payoutsHref must build /admin/payouts?… links');
  assert.doesNotMatch(readFileSync(path.join(APP, 'admin/payouts/page.tsx'), 'utf8'), /<form\b[^>]*method=["']get["'](?![^>]*\baction=)/i);
  // Receipts: the month is an InsightsParamPick, which moves one param and keeps the rest of the address (its ?view=).
  const receipts = readFileSync(path.join(APP, 'admin/receipts/page.tsx'), 'utf8');
  assert.match(receipts, /<InsightsParamPick[\s\S]*?param="month"/, 'the receipts month must be the one param pick');
});
