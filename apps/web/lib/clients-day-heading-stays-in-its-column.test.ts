/**
 * ✂ THE CLIENTS DAY HEADING STAYS IN ITS COLUMN (supplier walk on live, 24 Nov 2026; controller brief).
 *
 * Measured on live at 1280: the right pane read "obile bar by Setnaprod" and "roduction sheet". `elementsFromPoint`
 * on the cut letter returned the LEFT list's sticky day heading ("SAT 22 MAY 2027", `lg:-mx-8`, z 3): its 32 px
 * right bleed crossed the column line and painted the canvas colour over the pane's first letters.
 *
 * Fails if the two-column frame stops pinning the heading's right edge, or a heading loses the attribute the rule keys on.
 * SABOTAGE (seen red, restored): delete the `.sn-cols-list [data-customers-group-heading]` rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const read = (f: string) => readFileSync(join(WEB, f), 'utf8');

test('in two columns the day heading bleeds left only', () => {
  const css = read('app/vendor-dashboard/_components/supplier-frame.css');
  const m = css.match(/\.sn-cols-list \[data-customers-group-heading\],\s*\.sn-cols-list \[data-dates-day-heading\] \{\s*margin-right: 0;/);
  assert.ok(m, 'the right-bleed stop is gone');
  // inside the 701px media block, where the two columns exist
  const media = css.indexOf('@media (min-width: 701px)');
  assert.ok(media >= 0 && css.indexOf('.sn-cols-list [data-customers-group-heading]') > media);
});

test('both bleeding headings carry the attribute the rule keys on', () => {
  assert.match(read('app/vendor-dashboard/customers/_components/customers-roster.tsx'), /lg:-mx-8 lg:px-8"[\s\S]{0,140}data-customers-group-heading=/);
  assert.match(read('app/vendor-dashboard/customers/_components/customers-calendar.tsx'), /lg:-mx-8 lg:px-8"[\s\S]{0,140}data-dates-day-heading=/);
});
