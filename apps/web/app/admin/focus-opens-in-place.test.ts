/**
 * 🔒 ADMIN FOCUS OPENS IN PLACE (Today v3 part 4 — owner 19 Nov 2026: *"this applies to admin and supplier's today"*;
 * ruled: one list by urgency, a tap opens the item's card in place with no sheet over the list, drag right = its page,
 * drag left = tomorrow for THAT admin only, the Reply · N / Fix · N headings go and each row keeps its ↩ or ! mark;
 * drawing `Today, tap opens a card` v3.5, V3 · 4).
 *
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): `<FocusCardSheet` put back in Focus (red: 1) · a
 * `Reply · N` heading back (red: 2) · scope 'admin' dropped from the row's put-off (red: 3) · the `canPutOff` gate
 * dropped from the open card (red: 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const HOME = read('app/admin/_components/focus-home.tsx');
const ROW = read('app/admin/_components/focus-row.tsx');

test('1 · the tapped item opens where it sits — no sheet over the list', () => {
  assert.doesNotMatch(HOME, /<FocusCardSheet\b|<Sheet\b/, 'Focus opens a card in a sheet over the list again');
  assert.match(HOME, /open=\{!r\.goes && r\.key === cardKey\}/);
  assert.match(HOME, /<RequestCardView card=\{opened\.item\.card\}/);
});

test('2 · one list by urgency, each row with its mark and its word', () => {
  assert.doesNotMatch(HOME, /FOCUS_KIND_LABEL\[g\.kind\]|groups\.map/, 'the Reply · N / Fix · N headings are back');
  assert.match(HOME, /splitFocusPutOffs\(orderFocusRows\(rows\), putOff\)/);
  assert.match(HOME, /mark=\{KIND_MARK\[r\.kind\]\}/);
  assert.match(HOME, /sub=\{r\.level \? `\$\{r\.level\.word\} · \$\{r\.sub\}` : r\.sub\}/, 'a level is shown by colour alone');
});

test('3 · the drags are Today’s, and tomorrow is this admin’s only — never on a red item', () => {
  assert.match(ROW, /import \{ TwoWayPanes, useTodayDrag \} from '@\/app\/_components\/two-way-drag';/, 'Focus grew a second gesture');
  assert.match(ROW, /todayPutOff\(\{ op, key, scope: 'admin' \}\)/, 'an admin put-off is not scoped to the admin');
  assert.match(ROW, /\{canPutOff\(level\) \? \(/, '"Do it tomorrow" is offered on a red item');
  assert.match(ROW, /onOpen: \(\) => router\.push\(pageHref\)/);
  assert.doesNotMatch(ROW, /Trash2|data-swipe-delete/, 'a Focus item can be deleted');
});

/**
 * L7 · D2 (walk 27 Nov 2026): Problems took three hops — a row whose card said "Nothing to press here", then
 * "Open in page ›", then Work's "Open Problems". A list worked on its own page is now ONE tap to that page.
 * 🛡 SABOTAGE (seen RED, then restored): the Problems row pointed back at `/admin/work?open=` (red: 4) · the
 * "Nothing to press here" card put back (red: 4) · `goes` dropped from the row's tap (red: 4).
 */
test('4 · a list worked on its own page is one tap to that page', () => {
  assert.doesNotMatch(HOME, /Nothing to press here/, 'the empty in-place card for a list is back');
  assert.match(HOME, /href: items\.length > 0 \|\| settlesHere \? `\/admin\/work\?open=\$\{encodeURIComponent\(q\.key\)\}` : q\.href,/);
  assert.match(HOME, /goes: true,/);
  assert.match(HOME, /goes=\{r\.goes === true\}/);
  assert.match(ROW, /onClick=\{goes \? undefined : intend\}/, 'a list row still tries to open a card in place');
});
