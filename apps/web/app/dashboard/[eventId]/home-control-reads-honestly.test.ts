/**
 * home-control-reads-honestly.test.ts — A FAILED READ ALWAYS SAYS SO; IT NEVER SHOWS 0 OR ₱0 (owner-approved 2026-10-24,
 * `home_control_center_2026-10-24_fable.html`: *"'Couldn't load · not zero · unread' + Reload is the single face"*;
 * the rule of `lib/guests-read-is-honest.test.ts`, carried onto every upper widget).
 *
 *   1 · RENDERED: with every read failed, each upper widget — on the phone and from md up — says it could not load,
 *       offers ⟳ Reload, and draws no 0, no ₱0, no dots and no rotation.
 *   2 · THE MODEL: a failed widget is ONE face that never rotates; a payment ledger that could not be resolved never
 *       draws a payment face and says so on the summary.
 *   3 · THE READS: each widget's reader answers 'unread' on a refusal (Supabase RESOLVES with `{ error }`), and the
 *       page hands 'unread' — never an empty count — to the widget.
 *
 * SABOTAGE (seen red): render the failed Guests tile with `big: '0'` (1 red) · drop `threadsRes.error` from the
 * Suppliers refusal (3 red) · hand the Budget `pays: []` when the ledger is unresolved (2 + 3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl, fixtureControlUnread } from '@/lib/home-control-fixture';
import { HOME_CONTROL_KEYS, homeControlTiles } from './_components/home-control-faces';
import { count, drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
/** What a person reads. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
/** What a person reads, without the words that SAY it is not zero ("not ₱0", "not zero"). */
const figures = (html: string) => text(html).replace(/not (₱0|zero)/g, '');

test('1 · every failed widget says so, offers Reload, and draws no 0 / ₱0 — on the phone and from md up', () => {
  const html = drawHome({ control: fixtureControlUnread('e1') });
  const compact = slice(html, 'data-home-control="compact"', ['data-home-control="detail"']);
  const detail = slice(html, 'data-home-control="detail"', ['data-home-services']);
  const failing = HOME_CONTROL_KEYS.filter((k) => k !== 'count');
  for (const key of failing) {
    const tile = slice(compact, `data-home-tile="${key}"`, HOME_CONTROL_KEYS.map((k) => `data-home-tile="${k}"`).filter((m) => m !== `data-home-tile="${key}"`));
    assert.ok(tile.length > 0, `compact: the ${key} tile is not drawn`);
    assert.match(text(tile), /couldn.t load/i, `compact: the failed ${key} tile does not say it could not load`);
    assert.match(tile, /data-home-tile-failed=""/);
    assert.match(tile, /aria-label="Reload"/, `compact: the failed ${key} tile offers no Reload`);
    assert.doesNotMatch(figures(tile), /(^|\s)0(\s|$)|₱0/, `compact: the failed ${key} tile prints a zero`);
    assert.equal(count(tile, 'data-hc-dot'), 0, `compact: a failed ${key} tile has faces to swipe`);
    assert.doesNotMatch(tile, /data-home-tile-rotates/, `compact: a failed ${key} tile rotates`);

    const card = slice(detail, `data-home-card-key="${key}"`, HOME_CONTROL_KEYS.map((k) => `data-home-card-key="${k}"`).filter((m) => m !== `data-home-card-key="${key}"`));
    assert.ok(card.length > 0, `detail: the ${key} card is not drawn`);
    assert.match(text(card), /couldn.t load/i, `detail: the failed ${key} card does not say it could not load`);
    assert.match(card, /aria-label="Reload"/, `detail: the failed ${key} card offers no Reload`);
    assert.doesNotMatch(figures(card), /(^|\s)0(\s|$)|₱0/, `detail: the failed ${key} card prints a zero`);
  }
  // …and the Today line names the failure, never "on track".
  assert.doesNotMatch(text(html), /Nothing waits on you|on track/i, 'a failed read reads as calm');
});

test('2 · a failed widget is ONE face that never rotates; an unresolved ledger draws no payment', () => {
  const { tiles } = homeControlTiles(fixtureControlUnread('e1'));
  for (const t of tiles.filter((x) => x.key !== 'count')) {
    assert.equal(t.failed, true, `${t.key}: not marked failed`);
    assert.equal(t.faces.length, 1, `${t.key}: a failed widget must be a single face`);
    assert.equal(t.faces[0]!.action?.href, null, `${t.key}: the failed face's action must be ⟳ Reload`);
  }
  const ledgerUnread = homeControlTiles(fixtureControl('e1', { budget: { paidPhp: 120450, owingPhp: 44550, pays: 'unread' } })).tiles.find((t) => t.key === 'budget')!;
  assert.deepEqual(ledgerUnread.faces.map((f) => f.id), ['budget-summary'], 'an unresolved ledger drew payment faces');
  assert.match(ledgerUnread.faces[0]!.sm, /payments couldn.t load/, 'the summary does not say the payments were unread');
  // A measured, empty ledger is a fact and may be said: just the summary, no "couldn't load".
  const none = homeControlTiles(fixtureControl('e1', { budget: { paidPhp: 0, owingPhp: 0, pays: [] } })).tiles.find((t) => t.key === 'budget')!;
  assert.doesNotMatch(none.faces[0]!.sm, /couldn.t/);
});

test('3 · each reader answers "unread" on a refusal, and the page hands it on — never an empty count', () => {
  const reads = read('lib/home-control.server.ts');
  assert.match(reads, /if \(vendorsRes\.error \|\| threadsRes\.error\) \{[\s\S]{0,200}?return 'unread';/, 'Suppliers: a refused read is not "unread"');
  assert.match(reads, /if \(!standings\) return 'unread';/, 'Suppliers: a refused standing read is not "unread"');
  assert.match(reads, /const raw = await readChecklistItems\(supabase, eventId\)[^;]*;\s*if \(raw === null\) return 'unread';/, 'Checklist: a refused read is not "unread"');
  const page = read('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /guestsMeasured \? \{ coming: homeRoster\.yes, noReply: homeRoster\.none, toInvite: homeRoster\.toInvite, declined: homeRoster\.no, total: homeRoster\.total \} : 'unread'/, 'Guests: an unmeasured read reaches the widget as a count');
  assert.match(page, /moneyNow === null \? 'unread'/, 'Budget: a failed money read reaches the widget as a figure');
  assert.match(page, /guardMoney && moneyReadsAllOk\(guardMoney\)[\s\S]{0,600}?: 'unread';/, 'Budget: an unresolved ledger reaches the widget as "nothing to settle"');
  for (const r of ['homeSuppliersRead', 'homeChecklistRead', 'homeHubRead']) {
    assert.match(page, new RegExp(`const ${r} = startAhead\\([\\s\\S]*?\\.catch\\(\\(\\): 'unread' => 'unread'\\),\\s*\\);`), `${r}: a throw is not "unread"`);
  }
});
