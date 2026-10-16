/**
 * a-failed-refresh-shows-the-last-copy-as-old.test.ts — 🔒 A COPY IS NEVER PASSED OFF AS FRESH, AND A FAILURE
 * IS NEVER "NO GUESTS" (lib/guests.ts, guests-read-is-honest.test.ts; controller brief 2026-10-16: "if the
 * refresh FAILS, the cached list stays but says so plainly … It must never look fresh, and a failure must
 * never look like 'No guests'").
 *
 * What is held, on the REAL screen:
 *   · a copy on screen always wears the mark — "Showing your last copy · updating…" while the fresh list
 *     comes, "Couldn't update — showing your last copy from <when>. It may be out of date." + Try again
 *     when it did not (offline, too long, or the read refused) — and never "Updated just now";
 *   · a failed copy is dimmed, and neither kind offers anything that writes (Select, Remove, Add);
 *   · a REFUSED fresh read draws the phone's copy as FAILED when there is one (`useKeptGuestList` on
 *     `!measured`) — and the page's own "We couldn't load your guest list" when there is none — never the
 *     empty list's "No guests yet";
 *   · a refused read is never kept as the copy, and a copy on screen never re-keeps itself.
 *
 * Sabotage (2026-10-16): the 'failed' mark reading "updating…" → test 1 red; the keep gate without
 * `measured` → test 3 red. Both reverted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from './_components/render-guests-screen';
import { REFRESH_TIMEOUT_MS, refreshPhase } from '@/app/_components/last-seen/last-seen-mark';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, '_components', 'guests-screen.tsx'), 'utf8'));

const guests = [
  guestRow({ role: 'bride', rsvp_status: 'attending', custom_tags: [] } as never),
  guestRow({ role: 'groom', side: 'groom', rsvp_status: 'attending', custom_tags: [] } as never),
  ...Array.from({ length: 6 }, (_, i) => guestRow({ first_name: `Guest${i}`, custom_tags: [] } as never)),
];
const SAVED = Date.UTC(2026, 9, 15, 7, 42);

test('1 · a failed refresh keeps the list and says so — never fresh, never empty', async () => {
  const html = await renderGuestsScreen({ guests, copy: { phase: 'failed', savedAt: SAVED } });
  assert.match(html, /data-last-seen-mark="failed"/);
  assert.match(html, /Couldn(’|&#x27;|&rsquo;|')t update — showing your last copy from /);
  assert.match(html, /It may be\s+out of date/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /updating…|Updated just now/, 'a failed refresh never claims to be updating or current');
  assert.match(html, /data-guest-row=""/, 'the rows stay');
  assert.doesNotMatch(html, /No guests yet|Nobody here yet/, 'a failure is never an empty list');
  assert.match(html, /data-guests-copy="failed"[^>]*style="opacity:0.7"/, 'and the old list is dimmed');
});

test('2 · while the fresh list comes, the copy says it is the last copy — and offers nothing that writes', async () => {
  const html = await renderGuestsScreen({ guests, copy: { phase: 'updating', savedAt: SAVED } });
  assert.match(html, /Showing your last copy · updating…/);
  assert.doesNotMatch(html, /Updated just now/);
  for (const write of ['data-testid="thumb-select"', '>Remove<', 'data-testid="thumb-add"']) {
    assert.equal(html.includes(write), false, `no ${write} on a copy`);
  }
  const fresh = await renderGuestsScreen({ guests });
  assert.doesNotMatch(fresh, /data-last-seen-mark|last copy/, 'the fresh list wears no copy mark');
  assert.ok(fresh.includes('data-testid="thumb-select"') && fresh.includes('>Remove<'), 'and keeps its tools');
});

test('3 · a refused read shows the copy as failed (or the honest "couldn’t load"), and is never kept', () => {
  assert.match(SCREEN, /useKeptGuestList\(!props\.measured && props\.gview === 'list' && !props\.copy\)/);
  assert.match(SCREEN, /copy: \{ phase: 'failed', savedAt: unread\.savedAt \}/, 'a refused read draws the copy as FAILED');
  assert.match(
    SCREEN,
    /useKeepGuestList\([\s\S]{0,200}?!copy && measured && gview === 'list' && !initialQuery && !initialSelect,\s*\)/,
    'only the fresh, measured List keeps itself',
  );
  assert.match(SCREEN, /\{empty && !q \? <Handed>\{empty\}<\/Handed> : null\}/, 'no copy → the page’s own unread words');
});

test('4 · offline or too long without the fresh list → failed', () => {
  assert.equal(refreshPhase({ online: true, waitedMs: 0 }), 'updating');
  assert.equal(refreshPhase({ online: false, waitedMs: 0 }), 'failed');
  assert.equal(refreshPhase({ online: true, waitedMs: REFRESH_TIMEOUT_MS }), 'failed');
});
