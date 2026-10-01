import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * The property: a number a supplier is shown as a headline count takes them to
 * the thing it counts.
 *
 * Owner, 2026-09-18: *"i cannot open the new inquiries"*. His dashboard read
 * "New inquiries · 1", he tapped it, nothing happened — while `EarnedTile`,
 * directly beside it, links to the full ledger. Three counts styled as tiles,
 * none reachable, next to one that is.
 *
 * 🔑 This file already carried the lesson, 180 lines below the defect:
 * *"href and no form: a control that looked pressable and did nothing."* The
 * same disease in the other direction — that one looked pressable and was
 * inert; these ARE the answer to "where next" and offered no way to get there.
 *
 * 📱 2026-10-01 — the KPI bento became THREE NUMBERS on Today's first screen
 * (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE RECOMMENDED
 * ANSWERS": new inquiries · events this week · ₱ owed to you). The property did
 * not change; the scan moved to `supplier-today-first-screen.tsx`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const src = () =>
  stripComments(
    readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx'), 'utf8'),
  );

/** The three-numbers block, from its marker to the Coming-up block after it. */
function numbersBlock(): string {
  const s = src();
  const a = s.indexOf('data-today-numbers');
  const b = s.indexOf('data-today-coming-up');
  assert.ok(a > 0 && b > a, 'the three-numbers block could not be found — the scan has gone blind');
  return s.slice(a, b);
}

test('every headline count on Today has a destination', () => {
  const block = numbersBlock();
  // Every number sits in its own <Link>; a <span>/<div> number would be a count
  // that goes nowhere.
  const links = block.match(/<Link\b[^>]*>/g) ?? [];
  assert.equal(links.length, 3, `${links.length} of the three numbers are links`);
  for (const l of links) assert.match(l, /href="\/vendor-dashboard[^"]*"/, `a number links nowhere real: ${l}`);
  for (const word of ['new inquiries', 'events this week', 'owed to you']) {
    assert.ok(block.includes(word), `the "${word}" number is gone`);
  }
});

test('the destinations exist as routes', () => {
  const hrefs = [...numbersBlock().matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(hrefs.length, 3, `found ${hrefs.length} number hrefs`);
  for (const h of hrefs) {
    const rel = h.replace(/^\//, '').split(/[?#]/)[0]!;
    const page = join(WEB, 'app', rel, 'page.tsx');
    assert.ok(
      statSync(page, { throwIfNoEntry: false }),
      `${h} has no page.tsx — a count that links to a 404 is worse than one that ` +
        'links nowhere, because it looks like it worked',
    );
  }
});

test('the money number goes to the money — Payday', () => {
  assert.match(numbersBlock(), /href="\/vendor-dashboard\/payday"/);
});

test('each Coming-up row opens its customer — the list under the numbers links too', () => {
  const s = src();
  const coming = s.slice(s.indexOf('data-today-coming-up'));
  assert.match(coming, /<Link href=\{row\.href\}/, 'a Coming-up row is drawn but goes nowhere');
});
