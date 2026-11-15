/**
 * RW-309 (W1's walk, 15 Nov 2026, on 4c094d4) — two live faults that must not come back.
 *
 *  1. /dashboard/[eventId]/studio/live-studio-control was 400 px wide at a 375 viewport: the free-controller doorway is
 *     an ActionButton (`.ab` — one line, `white-space: nowrap`, 13 px, 14 px padding each side) and its label ran off
 *     the edge. Every `.ab` label on that page must fit the 343 px a 375 phone leaves inside its 16 px gutters.
 *  2. /dashboard drew three controls under the 44 px floor: the profile pens (a 26 × 26 box), the "Choose your @handle"
 *     link (an 18-px line) and the Search field (42 tall). Each box is 44 now, from the shared profile header and the
 *     section's shared find row — no hand-made button.
 *
 * SABOTAGE: put the old 55-character label back → 1 is RED; a 26-px pen box, a 42-px field, or the handle link without
 * its 44 floor → 2 is RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A generous width for 13-px sans: no glyph in a plain sentence averages wider than 7.2 px. */
const PX_PER_CHAR = 7.2;
/** `.ab`: 14 px padding each side, a 16 px icon and its 7 px gap. */
const AB_CHROME = 14 * 2 + 16 + 7;
/** A 375 phone, less 16 px gutters each side. */
const ROOM = 375 - 16 * 2;

test('1 · every ActionButton label on the Live Studio page fits a 375 phone', () => {
  const page = read('app/dashboard/[eventId]/studio/live-studio-control/page.tsx');
  const css = read('app/globals.css');
  const ab = css.match(/(?:^|\n)\.ab \{([^}]*)\}/)?.[1] ?? '';
  assert.match(ab, /white-space: nowrap;/, 'the .ab rule changed — re-measure this guard');
  assert.match(ab, /font-size: 13px;/, 'the .ab rule changed — re-measure this guard');
  const labels = [...page.matchAll(/<Link[^>]*className="ab\b[^"]*"[^>]*>\s*([^<{]+?)\s*</g)].map((m) => m[1]!.trim());
  assert.ok(labels.length >= 1, 'no .ab link found on the page — did the doorway move?');
  for (const label of labels) {
    const width = label.length * PX_PER_CHAR + AB_CHROME;
    assert.ok(width <= ROOM, `"${label}" is ~${Math.round(width)} px on one line — wider than the ${ROOM} px a 375 phone has`);
  }
  assert.doesNotMatch(page, /Open the controller — go live with one camera, included/);
});

test('2 · /dashboard: the pens, the handle link and the Search field each press at 44', () => {
  const header = read('app/u/_components/profile-header.tsx');
  const pen = header.match(/\n {2}\.uprof-pen \{([^}]*)\}/)?.[1] ?? '';
  assert.match(pen, /width: 44px;/, 'the profile pen box is under 44 wide');
  assert.match(pen, /height: 44px;/, 'the profile pen box is under 44 tall');
  assert.match(pen, /min-height: 44px;/);
  assert.match(header, /\.uprof-head\[data-layout='home'\] \.uprof-handle a \{[^}]*min-height: 44px;/, 'the handle link is an 18-px line again');
  const home = read('app/dashboard/(launcher)/_components/home-profile.tsx');
  assert.match(home, /className="uprof-pen"/, 'Home draws its own pen — use the shared one');
  const css = readFileSync(join(WEB, 'app/dashboard/(launcher)/_components/home-profile.module.css'), 'utf8');
  const input = css.match(/\.find input \{([^}]*)\}/)?.[1] ?? '';
  const h = Number(input.match(/\bheight:\s*(\d+)px/)?.[1]);
  assert.ok(h >= 44, `the Search field is ${h} px tall`);
});
