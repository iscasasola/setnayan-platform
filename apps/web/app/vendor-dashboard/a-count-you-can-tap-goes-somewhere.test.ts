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
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const src = () =>
  stripComments(
    readFileSync(join(WEB, 'app/vendor-dashboard/_components/overview-sections.tsx'), 'utf8'),
  );

test('every headline count on the vendor overview has a destination', () => {
  const s = src();
  // Slice each <EnergyKpi …/> call and require an href in it. A count is the
  // answer to "what needs me" — it must say where.
  // ⚠ THE WINDOW MUST END AT THE ELEMENT'S OWN CLOSING TAG. My first version
  // was `/<EnergyKpi[\s\S]*?\/>/` and it stopped at the ICON's self-close —
  // `icon={<Inbox … />}` — several lines before the href, so every tile read as
  // dead and the guard failed against correct code. A window that ends at the
  // first plausible boundary rather than the right one is this repo's oldest
  // guard bug. Anchor on the closing `/>` that sits alone on its own line.
  const calls = s.match(/<EnergyKpi[\s\S]*?\n\s*\/>/g) ?? [];
  assert.ok(calls.length >= 3, `only ${calls.length} KPI tiles found — the scan has gone blind`);
  const dead = calls
    .filter((c) => !/href=/.test(c))
    .map((c) => (/label="([^"]+)"/.exec(c)?.[1] ?? c.slice(0, 40)));
  assert.deepEqual(
    dead,
    [],
    `These counts render a number and go nowhere: ${dead.join(', ')}. A supplier ` +
      'taps them expecting the list behind the number. Give each an href, or ' +
      'state in a comment why this one is display-only.',
  );
});

test('the component can actually BE a link — not just accept the prop', () => {
  // The failure that would pass the test above: add `href` to the type, never
  // read it. Keep the call, discard its result — this repo has been beaten by
  // that exact shape twice.
  const s = src();
  assert.match(s, /href \? \(/, 'EnergyKpi takes an href and never branches on it');
  assert.match(s, /<Link\s+href=\{href\}/, 'the href is not passed to a Link');
});

test('the destinations exist as routes', () => {
  const s = src();
  const hrefs = [...s.matchAll(/<EnergyKpi[\s\S]*?href="([^"]+)"[\s\S]*?\n\s*\/>/g)].map((m) => m[1]!);
  assert.ok(hrefs.length >= 3, `found ${hrefs.length} KPI hrefs`);
  for (const h of hrefs) {
    const rel = h.replace(/^\//, '').split('?')[0]!;
    const page = join(WEB, 'app', rel, 'page.tsx');
    assert.ok(
      statSync(page, { throwIfNoEntry: false }),
      `${h} has no page.tsx — a count that links to a 404 is worse than one that ` +
        'links nowhere, because it looks like it worked',
    );
  }
});

test('the neighbouring money tile still links — the pattern was already here', () => {
  // EarnedTile is why this was a defect rather than a design: one tile in the
  // row linked and three did not.
  assert.match(src(), /href="\/vendor-dashboard\/earnings"/);
});
