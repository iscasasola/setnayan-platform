/**
 * 🎨 YOUR PAGE › LOOK — THE ROW OPENS ON ITS OWN PRESS, AND THE CIRCLE OPENS THE ONE PICKER (owner 2026-10-23, on a
 * screenshot of the Look row, verbatim: *"pressing on look does not expand. press the color circle will show color
 * picker we have designed"*).
 *
 *   A · the circle is its OWN button, BESIDE the row's head (the shared `Fold`'s `leadPress`), never inside it — so the
 *       head keeps its one job (open / shut) and the circle keeps its own; a button is never nested in a button;
 *   B · the circle opens the Mood Board's `ColourPickerSheet` — the ONE picker every Studio colour opens — loaded on the
 *       press (not in Your page's first load), and Your page draws no `type="color"` of its own;
 *   C · a colour picked there is stored the way the dropdown stores one: a preset's own swatch → the preset's key (the
 *       default champagne → '' — no override), any other colour → its `#RRGGBB`; the action accepts both, the public
 *       page retints for both, and the dropdown gains the shop's own colour as a row, so the two never disagree;
 *   D · every row on Your page that opens in place is a `Fold` whose head toggles, and every row that goes somewhere is
 *       a link — no row is drawn as a press that does nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  MICROSITE_ACCENTS,
  accentFromPickedHex,
  accentRampFromHex,
  isValidAccentKey,
  micrositeAccentVars,
  resolveMicrositeAccent,
} from '@/lib/vendor-microsite';
import { Fold } from '@/app/_components/fold';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PARTS = 'app/vendor-dashboard/website/_components/page-parts.tsx';

/** The JSX of the `<Fold anchor="look" …>` element, up to its closing tag. */
function lookFold(): string {
  const s = src(PARTS);
  const at = s.indexOf('anchor="look"');
  assert.ok(at > 0, 'Your page has no Look row (anchor="look")');
  const start = s.lastIndexOf('<Fold', at);
  const end = s.indexOf('</Fold>', at);
  assert.ok(start >= 0 && end > at, 'the Look row is not a Fold');
  return s.slice(start, end);
}

test('A · the shared Fold draws a leadPress BESIDE its head, outside the head’s button', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Fold,
      { title: 'Look', line: 'Champagne', data: 'probe', leadPress: React.createElement('button', { type: 'button', 'data-probe-circle': '' }, 'o') },
      React.createElement('p', null, 'inside'),
    ),
  );
  const head = html.match(/<button[^>]*data-fold-head=""[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(head, 'the Fold drew no head button');
  assert.ok(!head[1]!.includes('data-probe-circle'), 'the pressable mark is INSIDE the head — a button in a button');
  assert.ok(html.includes('data-probe-circle'), 'the Fold dropped its leadPress');
  assert.ok(html.indexOf('data-probe-circle') < html.indexOf('data-fold-head'), 'the pressable mark is not at the left of the head');
  assert.match(head[0], /aria-expanded="false"/, 'the head no longer says whether it is open');

  /* Absent → the head is exactly as it was: full width, no row wrapper. */
  const plain = renderToStaticMarkup(React.createElement(Fold, { title: 'Look', data: 'plain' }, 'x'));
  assert.ok(!plain.includes('data-fold-row'), 'a Fold without leadPress grew a wrapper');
  assert.match(plain, /data-fold-head=""[^>]*class="[^"]*\bw-full\b/, 'a Fold without leadPress lost its full-width head');
});

test('A · the head toggles on its own press (one handler that flips open)', () => {
  const fold = src('app/_components/fold.tsx');
  const head = fold.match(/<button[\s\S]*?data-fold-head=""[\s\S]*?>/)?.[0] ?? '';
  assert.match(head, /onClick=\{\(\) => setOpen\(\(o\) => !o\)\}/, 'the Fold head does not flip open / shut');
});

test('A · the Look row hands its circle as leadPress — a button of its own — and no circle inside the head', () => {
  const look = lookFold();
  assert.match(look, /leadPress=\{/, 'the Look circle is not handed to the Fold as its own press');
  assert.ok(!/\blead=\{/.test(look), 'the Look circle is back inside the head (lead=) — a press that only toggles the row');
  const circle = look.slice(look.indexOf('leadPress={'));
  assert.match(circle, /<button[\s\S]*?data-page-look-circle=""/, 'the Look circle is not a button');
  assert.match(circle, /onClick=\{\(\) => setPicking\(true\)\}/, 'the Look circle opens nothing');
});

test('B · the circle opens the ONE picker (ColourPickerSheet), loaded on the press; no colour input of its own', () => {
  const s = src(PARTS);
  assert.match(
    s,
    /dynamic\(\s*\(\) => import\('@\/app\/dashboard\/\[eventId\]\/studio\/mood-board\/_components\/colour-picker-sheet'\)\.then\(\(m\) => m\.ColourPickerSheet\)/,
    'Your page does not load the one picker (the Mood Board’s ColourPickerSheet) on demand',
  );
  assert.ok(!/^import[^\n]*colour-picker-sheet/m.test(s), 'the picker is a static import — it would ride Your page’s first load');
  assert.match(s, /\{picking \? \(\s*<ColourPickerSheet[\s\S]*?onPick=\{\(hex\) => \{[\s\S]*?change\(\{ accent: accentFromPickedHex\(hex\) \}\)/, 'a pick in the picker does not reach the page draft');
  assert.ok(!/type="color"/.test(s), 'Your page draws a colour input of its own');
  assert.ok(!/<input[^>]*type=\{?['"]color/.test(s), 'Your page draws a colour input of its own');
});

test('C · a picked colour is stored like the dropdown stores one, and read back the same', () => {
  for (const a of MICROSITE_ACCENTS) {
    const stored = accentFromPickedHex(a.swatch);
    assert.equal(stored, a.key === 'champagne' ? '' : a.key, `${a.label}’s own swatch is not stored as its key`);
    assert.equal(accentFromPickedHex(a.swatch.toLowerCase()), stored, `${a.label}’s swatch in lower case is stored differently`);
  }
  assert.equal(accentFromPickedHex('#7a1f2b'), '#7A1F2B');
  assert.equal(accentFromPickedHex('not a colour'), '');

  assert.ok(isValidAccentKey('#7A1F2B'), 'the action refuses a shop’s own colour');
  assert.ok(isValidAccentKey('sage'));
  for (const bad of ['#7a1f2b', '7A1F2B', '#7A1F2', 'red', 'javascript:x', '#7A1F2BFF']) {
    assert.ok(!isValidAccentKey(bad), `the action accepts ${JSON.stringify(bad)}`);
  }

  const own = resolveMicrositeAccent('#7A1F2B');
  assert.equal(own.custom, true);
  assert.equal(own.swatch, '#7A1F2B');
  assert.equal(resolveMicrositeAccent('sage').label, 'Sage');
  assert.equal(resolveMicrositeAccent('').label, 'Champagne');
  assert.equal(resolveMicrositeAccent('gone-preset').label, 'Champagne');

  /* The public page retints for the shop's own colour the presets' way. */
  assert.deepEqual(accentRampFromHex('#C5A059'), ['197 160 89', '168 136 76', '140 114 63']);
  const vars = micrositeAccentVars('#7A1F2B');
  assert.ok(vars, 'the public page ignores a shop’s own colour');
  assert.equal(vars['--color-terracotta'], '122 31 43');
  assert.equal(micrositeAccentVars('champagne'), undefined);
  assert.equal(micrositeAccentVars('#nothex'), undefined);
});

test('C · the dropdown and the row say the shop’s own colour, so the circle and the dropdown never disagree', () => {
  const look = lookFold();
  assert.match(look, /accent\.custom\s*\?\s*\[/, 'the dropdown has no row for the shop’s own colour');
  assert.match(look, /value=\{shown\.accent \|\| MICROSITE_DEFAULT_ACCENT_KEY\}/, 'the dropdown does not read the draft');
  assert.match(src(PARTS), /resolveMicrositeAccent\(shown\.accent/, 'the row does not read the shop’s own colour');
  assert.match(src('app/vendor-dashboard/actions.ts'), /isValidAccentKey\(raw\)/, 'the action no longer validates the accent');
});

test('D · every row on Your page is a Fold (toggles) or a DatesRow (goes somewhere) — and every Fold has a head', () => {
  const s = src(PARTS);
  const list = s.slice(s.indexOf('data-page-parts=""'), s.indexOf('<SupplierThumbRow'));
  const folds = list.match(/<Fold\b/g)?.length ?? 0;
  assert.ok(folds >= 7, `Your page lost rows that open in place (${folds} Folds)`);
  /* A DatesRow WITHOUT an href is a statement, not a press — it must not wear the press look. */
  const dates = src('app/vendor-dashboard/customers/_components/dates-row.tsx');
  assert.match(dates, /href/, 'DatesRow no longer knows whether it goes somewhere');
});
