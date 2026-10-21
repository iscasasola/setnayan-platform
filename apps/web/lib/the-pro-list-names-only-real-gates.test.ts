/**
 * the-pro-list-names-only-real-gates.test.ts — THE PRO LIST SAYS EVERYTHING PRO COVERS, AND NOTHING IT DOES NOT.
 *
 * Owner 2026-10-22, "Yes to all" (`Setnayan/prototypes/journey_fixes_2026-10-22.html` § Host 5, DECISION_LOG
 * "THE PRO LIST NAMES EVERY GATE"). The list a couple reads (`WEBSITE_PRO_ITEMS`) named nine things, while Pro also
 * gated six more elsewhere in the code — a host met each of them first at the Apply sheet. They joined the list in
 * the prototype's words, and the free "Editorial editing" left it. No gate moved.
 *
 * WHAT THIS HOLDS (each a property of the CODE, not of the words):
 *   1 · THE LIST IS THE DRAWN LIST, in the drawn order (the theme count is the registry's, never typed).
 *   2 · EVERY ADDED LINE NAMES A GATE THAT IS ON — read from the gate itself (`ART_KIT_IS_PRO`, `FREE_MOMENT_CAP`,
 *       `MAKER_EVENT_MEDIA_BYTES_CAP`, `isProPrint`, `isAllInOnePrint`, `HUB_ELEMENT_PRO_FIELDS`). Turn a gate off
 *       and this fails, telling you to take its line off the list (or to put the gate back) — never both silently.
 *       The numbers in two lines ("6th", "10 MB") are held to the constants they come from.
 *   3 · NO LINE NAMES SOMETHING FREE: while `EDITORIAL_PRO` is in `FREE_FOR_ALL_SKUS` no line says "editorial" —
 *       and if it ever stops being free, this fails the other way and asks for the line back.
 *
 * ⛔ NO PRICE. The list never carries one; the figure is `platform_retail_catalog_v2`'s, read at render.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): `ART_KIT_IS_PRO` flipped to false · `FREE_MOMENT_CAP` 5 → 6 ·
 * "Editorial editing" put back on the list · a drawn line dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRO_THEMES_ITEM, WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';
import { ART_KIT_IS_PRO } from '@/lib/art-kit-pro';
import { FREE_MOMENT_CAP } from '@/lib/love-story-moments';
import { MAKER_EVENT_MEDIA_BYTES_CAP } from '@/lib/maker-media-limits';
import { CLASSIC_PRINT_THEME, isAllInOnePrint, isProPrint } from '@/lib/print-pieces';
import { HUB_ELEMENT_PRO_FIELDS } from '@/lib/hub-look-pro';
import { PRO_THEMES, FREE_THEMES } from '@/lib/invite-themes';
import { FREE_FOR_ALL_SKUS } from '@/lib/entitlements';

const items = WEBSITE_PRO_ITEMS as readonly string[];

/** The prototype's "Proposed" list, line for line (07-host5-pro-list.png). */
const DRAWN = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photo gallery',
  'Background music',
  'Photo and video backgrounds',
  PRO_THEMES_ITEM,
  'Animated logo',
  'Your logo on every QR code',
  'Style and animation for every part',
  'Decorations',
  'A 6th Love Story moment, with photos',
  'Uploads over 10 MB',
  'Print files in Pro themes',
  "One download of every guest's ticket",
];

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const MiB = 1024 * 1024;

/** Each added line → is the gate it names ON, read from the gate. */
const GATES: Record<string, () => true | string> = {
  'Style and animation for every part': () =>
    (HUB_ELEMENT_PRO_FIELDS as readonly string[]).includes('motion') ||
    'HUB_ELEMENT_PRO_FIELDS no longer holds a part’s animation (motion) — the line sells a free thing',
  Decorations: () => ART_KIT_IS_PRO === true || 'ART_KIT_IS_PRO is off — decorations are free, take the line off',
  'A 6th Love Story moment, with photos': () =>
    ordinal(FREE_MOMENT_CAP + 1) === '6th' ||
    `FREE_MOMENT_CAP is ${FREE_MOMENT_CAP} — the first Pro story is the ${ordinal(FREE_MOMENT_CAP + 1)}, not the 6th`,
  'Uploads over 10 MB': () =>
    (MAKER_EVENT_MEDIA_BYTES_CAP.free === 10 * MiB && MAKER_EVENT_MEDIA_BYTES_CAP.pro > MAKER_EVENT_MEDIA_BYTES_CAP.free) ||
    `the free allowance is ${MAKER_EVENT_MEDIA_BYTES_CAP.free / MiB} MB (Pro ${MAKER_EVENT_MEDIA_BYTES_CAP.pro / MiB} MB) — the line says 10`,
  'Print files in Pro themes': () =>
    (PRO_THEMES.length > 0 && PRO_THEMES.every((t) => isProPrint(t.id)) && !isProPrint(CLASSIC_PRINT_THEME) && FREE_THEMES.every((t) => !isProPrint(t.id))) ||
    'isProPrint no longer splits Pro themes from free ones — the line misdescribes the print gate',
  "One download of every guest's ticket": () =>
    (isAllInOnePrint('passes', 'print') && !isAllInOnePrint('pass', 'print')) ||
    'every guest’s pass in one file is no longer Pro (isAllInOnePrint) — take the line off',
};

test('1 · the Pro list is the drawn list, in the drawn order', () => {
  assert.ok(PRO_THEMES.length > 0, 'no Pro theme is shipped — the themes line would sell nothing');
  assert.deepEqual([...items], DRAWN, 'WEBSITE_PRO_ITEMS is not the list the owner approved on 2026-10-22');
});

test('2 · every line added on 2026-10-22 names a gate that is on', () => {
  const added = Object.keys(GATES);
  assert.equal(added.length, 6, 'the six gates — the table scanned short');
  for (const line of added) {
    assert.ok(items.includes(line), `"${line}" is gated in the code but missing from the list a couple reads`);
    const on = GATES[line]!();
    assert.equal(on, true, `"${line}": ${on}`);
  }
});

test('3 · no line names something every couple already has', () => {
  assert.ok(FREE_FOR_ALL_SKUS.size > 0, 'FREE_FOR_ALL_SKUS read empty — the check is blind');
  const editorialFree = FREE_FOR_ALL_SKUS.has('EDITORIAL_PRO');
  const named = items.some((i) => /editorial/i.test(i));
  if (editorialFree) {
    assert.equal(named, false, 'the Pro list names editorial editing, which FREE_FOR_ALL_SKUS gives every couple');
  } else {
    assert.equal(named, true, 'EDITORIAL_PRO is no longer free — Event Hub Pro covers it again, put its line back');
  }
  assert.ok(!items.some((i) => /colou?r/i.test(i)), 'the Pro list sells a colour, which is free');
  assert.ok(!items.some((i) => /₱|\bPHP\b/.test(i)), 'a price was written into the list — it is the catalogue’s');
});
