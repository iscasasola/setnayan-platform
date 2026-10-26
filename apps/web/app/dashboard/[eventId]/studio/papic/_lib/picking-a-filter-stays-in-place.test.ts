/**
 * 🎨 PICKING A FILTER STAYS IN PLACE — the tapped look is highlighted at once, saved behind it, never a navigation.
 *
 * Owner, on his phone 2026-10-26: *"on papic, picking a filter reload the whole screen and not just the filter to be
 * highlighted"*. Each look in the strip was a `<form action={setPapicStyle}>` whose action ENDS IN `redirect(...)` — a
 * navigation, so every tap re-drew Home (or the Papic page) from the top, and the ring moved only once that new page
 * arrived.
 *
 *   (1) the strip's tap is answered in the browser (`preventDefault`, `pick`) — the form's redirecting action is only
 *       the no-JavaScript path;
 *   (2) the save it makes (`setPapicStyleInPlace`) answers and never redirects — the same gate, check and column;
 *   (3) the ring follows the TAP (`picked ?? saved`), a refused save puts it back and says why on the row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../../../../lib/strip-comments';

const PAPIC = join(__dirname, '..');
const picker = stripComments(readFileSync(join(PAPIC, 'style-picker.tsx'), 'utf8'));
const strip = picker.slice(picker.indexOf("if (variant === 'strip')"), picker.indexOf('grid-cols-2', picker.indexOf("if (variant === 'strip')")));
const actions = stripComments(readFileSync(join(PAPIC, 'actions.ts'), 'utf8'));
const inPlace = (() => {
  const at = actions.indexOf('export async function setPapicStyleInPlace');
  const next = actions.indexOf('\nexport ', at + 10);
  return actions.slice(at, next < 0 ? undefined : next);
})();

test('(1) a tap on a look is answered in place — never the form\'s redirecting submit', () => {
  assert.ok(strip.length > 100, 'premise: the strip branch');
  assert.match(strip, /onClick=\{\(e\) => \{\s*e\.preventDefault\(\);\s*pick\(s\.id\);\s*\}\}/, 'a tap on a look submits the form again — its action redirects, and the whole screen reloads');
});

test('(2) the in-place save answers — it never redirects', () => {
  assert.ok(inPlace.length > 200, 'premise: `setPapicStyleInPlace` exists');
  assert.doesNotMatch(inPlace, /\bredirect\(|refuseLimitedHelper\(/, 'the in-place filter save navigates (a redirect, or the redirecting gate)');
  assert.match(inPlace, /limitedHelperRefusal\(eventIdRaw, 'photos'\)/, 'the in-place save lost the helper gate');
  assert.match(inPlace, /\.update\(\{ papic_style: style \}\)/, 'the in-place save no longer writes the one column');
  assert.match(picker, /await setPapicStyleInPlace\(eventId, id\)/, 'the strip saves through something other than the in-place action');
});

test('(3) the ring follows the tap; a refusal puts it back and is said on the row', () => {
  assert.match(picker, /const active: PapicStyle = picked \?\? saved;/, 'the ring waits for the server again');
  assert.match(picker, /setPicked\(was === saved \? null : was\);\s*setError\(r\.error\);/, 'a refused save leaves the ring on a look that was not saved');
  assert.match(strip, /role="alert"[^>]*data-papic-filter-error/, 'a refused save is not said under the row');
});
