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
 * Sabotage (2026-10-16): the failed line reading "Your last copy · updating…" → test 1 red; the keep gate
 * without `measured` → test 3 red; the line moved out of the flow (fixed) → test 2 red. All reverted.
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

test('1 · a failed refresh keeps the list and says so, in ONE line under the selector — never fresh, never empty', async () => {
  const html = await renderGuestsScreen({ guests, copy: { freshness: 'failed', savedAt: SAVED } });
  assert.match(html, /data-guests-status="failed"/);
  assert.match(html, /Couldn(’|&#x27;|&rsquo;|')t update · showing your copy from /);
  assert.match(html, /<button type="button" class="statusTry">Try again<\/button>/, 'Try again is a small text button on the line');
  assert.doesNotMatch(html, /updating…|Updated just now/, 'a failed refresh never claims to be updating or current');
  assert.match(html, /data-guest-row=""/, 'the rows stay');
  assert.doesNotMatch(html, /No guests yet|Nobody here yet/, 'a failure is never an empty list');
  assert.match(html, /data-guests-copy="failed"/);
  const css = readFileSync(join(HERE, '_components', 'guests-screen.module.css'), 'utf8');
  assert.match(css, /\.screen\[data-guests-copy='failed'\] \[data-guest-rows\] \{\s*opacity: 0\.6;/, 'the old rows are dimmed');
});

test('2 · while the fresh list comes, the line says it is the last copy — in the flow, offering nothing that writes', async () => {
  const html = await renderGuestsScreen({ guests, copy: { freshness: 'updating', savedAt: SAVED } });
  assert.match(html, /Your last copy · updating…/);
  assert.doesNotMatch(html, /Updated just now/);
  // NOTHING COVERS CONTENT (owner rule): the line is inside the sticky block, right after the selector — not
  // a fixed layer over it — and it is not the floating last-seen pill.
  const stick = html.slice(html.indexOf('data-guests-stick'), html.indexOf('data-roster-counts'));
  assert.match(stick, /<\/nav><p role="status"[^>]*data-guests-status="updating"/, 'the line follows the selector in the flow');
  assert.doesNotMatch(html, /data-last-seen-mark|class="[^"]*\bfixed\b[^"]*"[^>]*data-guests-status/);
  for (const write of ['>Remove<', 'data-testid="thumb-add"']) {
    assert.equal(html.includes(write), false, `no ${write} on a copy`);
  }
  const fresh = await renderGuestsScreen({ guests });
  assert.doesNotMatch(fresh, /data-guests-status|last copy/, 'the fresh list draws no line (until a copy was on screen)');
  assert.ok(fresh.includes('data-testid="thumb-add"') && fresh.includes('>Remove<'), 'and keeps its tools');
  const mark = readFileSync(join(HERE, '_components', 'guest-copy-mark.tsx'), 'utf8');
  assert.match(mark, /if \(copy \|\| !fresh\) return;\s*if \(!takeLastSeenShown\('guests'\)\) return;/, 'a refused read is never "Updated just now"');
});

test('3 · a refused read shows the copy as failed (or the honest "couldn’t load"), and is never kept', () => {
  assert.match(SCREEN, /useKeptGuestList\(!props\.measured && props\.gview === 'list' && !props\.copy\)/);
  assert.match(SCREEN, /copy: \{ freshness: 'failed', savedAt: unread\.savedAt \}/, 'a refused read draws the copy as FAILED');
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
