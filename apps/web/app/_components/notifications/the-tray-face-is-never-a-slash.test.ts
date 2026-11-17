/**
 * the-tray-face-is-never-a-slash.test.ts — THE BELL'S FOUR LIVE FAULTS (owner, 17 Nov 2026, phone screenshot: "Yes, fix it").
 *
 *   1 · "New message from Liwanag Lights & Sound" drew a "/" where its face should be. Measured on prod: the row's place
 *       is the couple's event "Indalecio & Claire" (no monogram text), so the face is the letter "I" — drawn in the
 *       display face's ITALIC, which reads as a slash. The letter comes from the NAME (never a link or a path) and is
 *       drawn upright.
 *   2 · the place line "Indalecio & Claire · You org…" was cut on one line: it wraps to two, never truncates.
 *   3 · "Get an alert for every new inquiry" was crushed to a word per line in the bell's 320px card: the bell lays its
 *       notices out by ITS width (`BY_ITS_OWN_WIDTH`), with the buttons in one balanced row under the sentence.
 *   4 · the to-do's dashed ring read as a loading spinner: the alerts ask wears the bar's own Bell.
 *
 * SABOTAGE (seen red, then restored): `italic` back on the mark letter (1 red); `truncate` back on PLACE_WORDS (2 red);
 * the section without BY_ITS_OWN_WIDTH (3 red); the registrar without `mark=` (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeMarkLetter } from '@/lib/notification-place';
import { deriveVendorInitials } from '@/app/_components/vendor-avatar';
import { stripComments } from '@/lib/strip-comments';

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));

test('1 · the face letter comes from the name, never a slash, a path or a URL', () => {
  assert.equal(placeMarkLetter({ monogram_text: null, display_name: 'Indalecio & Claire' }), 'I');
  for (const name of ['/indalecio-claire', 'https://setnayan.com/x', '/', '// & /']) {
    const ch = placeMarkLetter({ monogram_text: null, display_name: name });
    assert.notEqual(ch, '/', `${name} → ${ch}`);
    assert.match(ch, /^[\p{L}\p{N}?]$/u, `${name} → ${ch}`);
  }
  assert.equal(placeMarkLetter({ monogram_text: '/', display_name: 'Maria & Jose' }), 'M');
  // The shop face's initials, the shared helper: letters of the name.
  assert.equal(deriveVendorInitials('Liwanag Lights & Sound'), 'LL');
});

test('1 · the event face letter is drawn upright — an italic "I" reads as "/"', () => {
  const list = read('app', '_components', 'notifications', 'notifications-list.tsx');
  const at = list.indexOf('data-notice-mark-letter');
  assert.ok(at > 0, 'the event face is found');
  const tag = list.slice(list.lastIndexOf('<span', at), at);
  assert.match(tag, /\bnot-italic\b/, 'the mark letter says not-italic');
  assert.doesNotMatch(tag.replace(/\bnot-italic\b/g, ''), /\bitalic\b/, 'the mark letter is never italic');
});

test('2 · the place line wraps to two lines, never cut on one', () => {
  const list = read('app', '_components', 'notifications', 'notifications-list.tsx');
  const m = list.match(/const PLACE_WORDS = '([^']+)'/);
  assert.ok(m, 'PLACE_WORDS is found');
  assert.doesNotMatch(m![1]!, /\btruncate\b/);
  assert.match(m![1]!, /\bline-clamp-2\b/);
});

test('3 · the bell lays its notices out by its own width, buttons balanced under the sentence', () => {
  const src = read('app', '_components', 'notices', 'notices.tsx');
  const at = src.indexOf('export function NoticesWaiting');
  const body = src.slice(at, src.indexOf('\n}', at));
  assert.match(body, /BY_ITS_OWN_WIDTH/);
  assert.match(body, /BELL_ACTIONS_BALANCED/);
  assert.match(src, /const BELL_ACTIONS_BALANCED = '[^']*\[&_\[data-notice-actions\]>\*\]:flex-1/);
});

test('4 · the alerts ask wears the bar’s Bell, not the to-do ring', () => {
  const reg = read('app', 'vendor-dashboard', '_components', 'push-notification-registrar.tsx');
  assert.match(reg, /import \{ Bell \} from 'lucide-react'/);
  assert.match(reg, /mark=\{<Bell\b/);
});
