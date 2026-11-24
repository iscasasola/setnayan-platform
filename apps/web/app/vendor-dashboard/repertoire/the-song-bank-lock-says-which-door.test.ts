/**
 * 🔒 THE SONG BANK'S LOCK SAYS WHICH DOOR (owner a02673ac, 23 Nov 2026): a paid widget opens only when bought AND on
 * Plus, Pro or Ultra. A shop that BOUGHT the Song bank and is now on Free or Verified keeps it, locked: it reads
 * "Works again when you subscribe" and gets the plans door, never a second Buy. A shop that never bought it gets the
 * Toolkit door and the plan notice. A status that could not be read is a failed read, never a guessed lock.
 *
 * Held on all three places that answer: the page (which lock), the lock (its words and door), the actions (a refused
 * write says the same).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PAID_WIDGET_RESUBSCRIBE_WORDS } from '@/lib/special-tools';

const read = (f: string) => stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/repertoire', f), 'utf8'));
const PAGE = read('page.tsx');
const VIEW = read('_components/repertoire-view.tsx');
const ACTIONS = read('actions.ts');

test('the words are the ruling’s', () => {
  assert.equal(PAID_WIDGET_RESUBSCRIBE_WORDS, 'Works again when you subscribe');
});

test('the page reads the Toolkit status with its batch, and an unread status is a failed read', () => {
  assert.match(PAGE, /Promise\.all\(\[[\s\S]*?readShopSpecialToolOpen\([\s\S]*?readPaidWidgetStatus\(admin, profile\.vendor_profile_id, 'song_bank'\)/);
  assert.match(PAGE, /if \(widget\.kind === 'unread'\) return <RepertoireUnread \/>;/);
  assert.match(PAGE, /<RepertoireLocked saved=\{repertoire\.length\} owned=\{widget\.kind === 'resubscribe'\} \/>/);
});

test('an owned lock reads "Works again when you subscribe" with the plans door; only the unbought lock sells', () => {
  const lock = VIEW.slice(VIEW.indexOf('export function RepertoireLocked('), VIEW.indexOf('export function RepertoireUnread('));
  assert.ok(lock.length > 200, 'RepertoireLocked moved — re-point this guard');
  const owned = lock.slice(lock.indexOf('{owned ? ('), lock.indexOf(') : (', lock.indexOf('{owned ? (')));
  assert.match(owned, /PAID_WIDGET_RESUBSCRIBE_WORDS/, 'the owned lock lost "Works again when you subscribe"');
  assert.doesNotMatch(owned, /Get it once/, 'an owner is told to buy again');
  const buttons = lock.slice(lock.lastIndexOf('{owned ? ('));
  assert.match(buttons, /\{owned \? \([\s\S]*?href=\{routes\.vendorDashboard\.subscription\(\)\}[\s\S]*?\) : \([\s\S]*?href=\{SONG_BANK_IN_TOOLKIT\}/, 'owned → plans door; not bought → the Toolkit');
});

test('a refused write says the same two locks', () => {
  assert.match(ACTIONS, /if \(widget\.kind === 'resubscribe'\) return `[^`]*\$\{PAID_WIDGET_RESUBSCRIBE_WORDS\}/);
  assert.match(ACTIONS, /if \(widget\.kind === 'unread'\) return SONG_BANK_UNREAD;/);
});
