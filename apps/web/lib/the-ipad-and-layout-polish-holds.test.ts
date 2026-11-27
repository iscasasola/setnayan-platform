/**
 * 📐 THE iPAD AND LAYOUT POLISH HOLDS (lane OLD-L8, walkthrough 27 Nov 2026 — passes 1 and 2 at 375 and iPad 820).
 *
 * Each fix is small and easy to undo by accident, so each one is pinned by its shape:
 *
 *   1 · Unihome's event card is the drawing's cover-left / words-right card from a tablet's width (768), so one cover
 *       no longer fills the iPad's first screen.
 *   2 · Unihome's jump row: a tapped icon stays lit until the person scrolls by hand, and the foot-of-page rule lights
 *       the last part only once it fills the upper half of the view (it lit Discover while Events was at the top).
 *   3 · Unihome's public address is one unit with its "· off": it never breaks mid-word, "· off" never lands alone.
 *   4 · The account switcher's other accounts draw no "@" mark, and the email only under a real name.
 *   5 · The couple's Supplier contracts page draws the back (it is not a bar tab — the 16 Nov back rule).
 *   6 · The Maker's look sample card wears the plate's own ink, as a guest page's plates do.
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// SABOTAGE: put `.dgrid2` back under `min-width: 1024px` → RED.
test('1 · Unihome draws the cover-left card from a tablet width', () => {
  const css = read('app/dashboard/(launcher)/_components/unihome.module.css');
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.dgrid2 \{\s*display: grid;\s*grid-template-columns: 1\.25fr 1fr;/, 'the two-column card starts later than 768');
});

// SABOTAGE: restore `held.current = Date.now() + …` or the unconditional foot rule → RED.
test('2 · the jump row keeps a tapped icon lit, and the foot lights the last part only when it fills the view', () => {
  const src = read('app/dashboard/(launcher)/_components/unihome-jump.tsx');
  assert.match(src, /held\.current = true;/, 'a tap does not hold its icon');
  assert.doesNotMatch(src, /Date\.now\(\)/, 'the hold is a timer again — it lets go before a short page settles');
  for (const ev of ['wheel', 'touchstart', 'keydown']) {
    assert.match(src, new RegExp(`addEventListener\\('${ev}'`), `a hand on the page (${ev}) does not release the hold`);
  }
  assert.match(src, /top <= line \+ \(window\.innerHeight - line\) \/ 2\) next = last;/, 'the foot rule lights the last part regardless');
});

// SABOTAGE: move `· off` back outside the address span → RED.
test('3 · the public address and its "· off" are one unit that never breaks mid-word', () => {
  const tsx = read('app/dashboard/(launcher)/_components/unihome.tsx');
  assert.match(
    tsx,
    /<span className=\{u\.addr\}>\s*<Link href=\{`\/u\/\$\{handle\.slug\}`\} className=\{u\.addrLink\}[\s\S]{0,160}?<\/Link>\s*\{handle\.publicOn === false \? <span className=\{u\.addrOff\}>/,
    'the address and its "off" are not one unit',
  );
  const css = read('app/dashboard/(launcher)/_components/unihome.module.css');
  assert.match(css, /\.page \.prof \.addr > \.addrLink \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/, 'the address can break mid-word');
  assert.match(css, /\.addrOff \{\s*white-space: nowrap;/, '"· off" can wrap on its own');
});

// SABOTAGE: put the circled "@" back in the other-accounts row → RED.
test('4 · the switcher rows draw no "@" mark and no second email', () => {
  const src = read('app/_components/account-switcher/account-switcher.tsx');
  const from = src.indexOf('(data.otherAccounts ?? []).map(');
  const rows = src.slice(from, src.indexOf('data-sheet-place="add-account"', from));
  assert.ok(from >= 0 && rows.length > 0, 'anti-vacuity: the other-accounts rows were not found');
  assert.doesNotMatch(rows, />@</, 'the "@" mark is back');
  assert.match(rows, /\{realNameOrNull\(acct\.name\) \? \(\s*<span className=\{SUB\}>/, 'the email shows twice for an unnamed account');
});

// SABOTAGE: remove the BackButton from the contracts page → RED.
test('5 · Supplier contracts draws its back', () => {
  const src = read('app/dashboard/[eventId]/contracts/page.tsx');
  assert.match(src, /<BackButton route="\/dashboard\/\[eventId\]\/contracts" params=\{\{ eventId \}\}/, 'no back on the contracts page');
});

// SABOTAGE: drop `style={PLATE_INK}` from the sample card → RED.
test('6 · the look sample card wears the plate ink, never a self-naming fallback', () => {
  const src = read('app/dashboard/[eventId]/launch/_components/look-sample.tsx');
  assert.match(src, /const PLATE_INK = \{ '--color-ink': 'var\(--color-ink-on-plate, var\(--color-ink-page\)\)' \}/, 'the plate ink is not the guest plate’s');
  assert.match(src, /data-look-sample-card=""[\s\S]{0,200}?style=\{PLATE_INK\}/, 'the sample card does not wear the plate ink');
});
