import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * 🖥 THE COUPLE'S SECONDARY PAGES READ AT THE SYSTEM WIDTH (owner 2026-11-13 "yes to all", rule D1;
 * tablet/desktop lane 1).
 *
 * The large-screen system has three page widths from the `tab` line (701px): reading 48rem
 * (`tab:max-w-3xl`), wide 64rem (`tab:max-w-5xl`), full body (`tab:max-w-none`). These pages
 * never joined it — some ran the full viewport minus the rail, some kept their own phone cap
 * (`max-w-2xl`, `max-w-xl`) all the way to a 1440px desktop. Each now states its width at
 * the `tab:` line, and below 701 nothing changes (the `tab:` utilities do not exist there).
 *
 * What fails this: a listed page with no system width, a page on the wrong one, or a page
 * whose own phone cap (`mx-auto … max-w-*`) has no `tab:` width beside it — the shape a
 * second early-return root left behind takes.
 */

const EV = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const read = (rel: string) => stripComments(readFileSync(join(EV, rel), 'utf8'));

const READING = 'tab:max-w-3xl';
const WIDE = 'tab:max-w-5xl';

const PAGES: ReadonlyArray<readonly [string, string]> = [
  ['memories/page.tsx', WIDE],
  ['galleries/page.tsx', WIDE],
  ['alaala/page.tsx', READING],
  ['refer/page.tsx', READING],
  ['guests/new/page.tsx', READING],
  ['guests/import/page.tsx', READING],
  ['guests/quick/page.tsx', READING],
  ['guests/[guestId]/page.tsx', READING],
  ['guests/send/page.tsx', READING],
  ['guests/invite/page.tsx', READING],
  ['guests/checkin/page.tsx', READING],
  ['guests/souvenirs/page.tsx', READING],
  ['guests/tea-ceremony/page.tsx', READING],
  ['vendors/categories/page.tsx', READING],
  ['vendors/packages/[bookingId]/page.tsx', READING],
  ['story/page.tsx', READING],
  ['invitation/page.tsx', READING],
];

for (const [rel, width] of PAGES) {
  test(`${rel} carries the system width (${width}) from 701`, () => {
    const src = read(rel);
    assert.ok(src.includes(width), `${rel} has no ${width} — it never joined the large-screen system`);
    // Every own-capped centred column on the page also states its width at the tab line.
    const classes = src.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? [];
    const orphans = classes.filter(
      (c) => /\bmx-auto\b/.test(c) && /(?:^|[\s"`])max-w-/.test(c) && !/\btab:max-w-(?:3xl|5xl|none)\b/.test(c),
    );
    assert.deepEqual(orphans, [], `${rel} keeps a phone-capped column with no tab: width`);
  });
}

test('`.sn-col` is the 48rem reading column from 701, with a 64rem wide opt-out', () => {
  const css = stripComments(readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8'));
  const block = css.match(/@media \(min-width: 701px\) \{\s*\.sn-col \{\s*max-width: ([\d.]+rem);\s*\}\s*\.sn-col\.sn-col-wide \{\s*max-width: ([\d.]+rem);\s*\}\s*\}/);
  assert.ok(block, '`.sn-col` lost its 701px reading-column block');
  assert.equal(block[1], '48rem', '`.sn-col` from 701 is not the 48rem reading column');
  assert.equal(block[2], '64rem', '`.sn-col-wide` from 701 is not the 64rem wide stage');
});

test('the wide-stage `.sn-col` users keep 64rem', () => {
  for (const rel of ['schedule/page.tsx', 'vendors/page.tsx', 'details/page.tsx', 'paperwork/page.tsx']) {
    assert.match(read(rel), /\bsn-col sn-col-wide\b/, `${rel} lost its wide stage and would shrink to 48rem`);
  }
});
