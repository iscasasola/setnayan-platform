/**
 * a-month-tap-never-freezes-the-page.test.ts — ‹ › on the Clients month must never strand the page (owner 2026-11-12:
 * "When calendar is pressed on the different month, i cannot leave the page… even if i return to the original month,
 * the page is stuck").
 *
 * The cause, reproduced on next@15.5.28 + react@19.2.6: the month wrote its `?m=` with `history.replaceState(null, …)`.
 * Next patches replaceState; a state WITHOUT its `__NA` mark is treated as an outside URL change and dispatched as a
 * router RESTORE, which DISCARDS the router action still pending — the previous tap's month fetch (a server action).
 * A discarded action's promise is never settled, so after two quick taps no tab, link or Back could navigate again.
 * Writing the address with `window.history.state` (which carries `__NA`) only moves the address bar.
 *
 *   1 · THE MONTH NEVER HANDS NEXT A FOREIGN HISTORY STATE — every replaceState / pushState passes `window.history.state`.
 *   2 · THE CLIENTS TAB, TAPPED AGAIN, PUTS THE MONTH BACK — this month, no day picked, every schedule; and the tab's
 *       own navigation is NOT cancelled (the handler returns nothing), so the address is cleared too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MONTH = stripComments(readFileSync(join(HERE, '_components', 'customers-calendar.tsx'), 'utf8'));

test('1 · the month writes its address with the router’s own history state', () => {
  const writes = [...MONTH.matchAll(/window\.history\.(?:replaceState|pushState)\(\s*([^,]+),/g)].map((m) => m[1]!.trim());
  assert.ok(writes.length >= 2, `the month no longer writes ?m= (found ${writes.length} writes)`);
  for (const state of writes) {
    assert.equal(state, 'window.history.state', `a history write passes \`${state}\` — Next reads it as a navigation and strands the month fetch`);
  }
});

test('2 · a Clients tab re-tap puts the month back, without cancelling the tab', () => {
  assert.match(MONTH, /import \{ useTabReselect \} from '@\/app\/_components\/nav\/use-chrome-away'/);
  const at = MONTH.indexOf("useTabReselect(\n    'customers'");
  assert.ok(at > 0, 'the month does not hear the Clients tab tapped again');
  const handler = MONTH.slice(at, MONTH.indexOf(');', MONTH.indexOf('}, [', at)) + 2);
  assert.match(handler, /if \(onClients && oneScreen\) backToStart\(\);/, 'only the one Clients screen resets');
  assert.doesNotMatch(handler, /return true/, 'the re-tap cancels the tab’s own navigation, so the address keeps ?m=');
  const reset = MONTH.slice(MONTH.indexOf('const backToStart = useCallback('), at);
  assert.match(reset, /setScope\(ALL_SCHEDULES\)/, 'the schedule pick is not let go');
  assert.match(reset, /goToMonth\(\{ y: Number\(todayIso\.slice\(0, 4\)\), m: Number\(todayIso\.slice\(5, 7\)\) \}\)/, 'the month does not return to this month');
  assert.match(reset, /setPicked\(null\)/, 'a picked day survives the re-tap');
});
