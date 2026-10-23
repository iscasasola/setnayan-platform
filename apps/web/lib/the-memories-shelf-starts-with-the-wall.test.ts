/**
 * the-memories-shelf-starts-with-the-wall.test.ts — Memories does not make a
 * phone wait for the album shelf to START until the wall has finished.
 *
 * MEASURED 2026-10-23 (the speed pass), `app/dashboard/(account)/library/memories-page-reads.harness.ts`
 * — the REAL Memories page, then the `<AlbumShelf>` it draws, against a
 * database that counts how deep each request ran. React draws the shelf only
 * after the page returns, and the page awaited the wall first, so the shelf's
 * reads began only when the wall's had all come back: **7 deep** (1,068 ms at
 * 150 ms a trip). The page now STARTS the shelf's read (`getPhotosAlbums`,
 * cache()d per request) beside the wall, so the shelf finds it in flight:
 * **5 deep** (763 ms). The page also uses the remembered sign-in
 * (`getCurrentUser`) instead of asking the auth server a second time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type View = { calls: number; depth: number; ms: number; steps: string[]; repeats: string[]; authReads: number; shelfDrawn: boolean };

const WEB = join(__dirname, '..');

function measure(): { defaultView: View } {
  const out = execFileSync(join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'), [join(WEB, 'app', 'dashboard', '(account)', 'library', 'memories-page-reads.harness.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '', MEMORIES_PAGE_READS_DELAY_MS: '3' },
    timeout: 180_000,
  });
  const line = out.split('\n').find((l) => l.startsWith('MEMORIES_PAGE_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('MEMORIES_PAGE_READS '.length)) as { defaultView: View };
}

const VIEW = measure().defaultView;
const shape = (v: View) => `${v.calls} requests, ${v.depth} deep\n  ${v.steps.join('\n  ')}`;
const stepOf = (what: RegExp) => Number(VIEW.steps.find((s) => what.test(s))?.split(' ')[0] ?? NaN);

test('0 · the page drew the shelf and the fixture reached both the wall and the albums', () => {
  // Since #6778 the page reads the albums itself (the shelf retired with the Papic gallery) — `shelfDrawn` is now
  // "the albums were read in this view".
  assert.ok(VIEW.shelfDrawn, 'the Memories page no longer reads its albums — re-point this guard');
  assert.ok(Number.isFinite(stepOf(/ people\(person_id/)), `the wall never read who I am:\n${shape(VIEW)}`);
  assert.ok(Number.isFinite(stepOf(/ events\(event_id,slug/)), `the shelf never read its addresses:\n${shape(VIEW)}`);
});

test('1 · the shelf’s reads start beside the wall’s, not after them', () => {
  assert.ok(
    stepOf(/ events\(event_id,slug/) < stepOf(/ people\(person_id/) + 1,
    `the album shelf waits for the wall to finish before it starts again:\n${shape(VIEW)}`,
  );
});

/** sign-in → my events → the event rows → (wall · albums together) → the last of either. MEASURED: 7 before, 5 after. */
const MEMORIES_MAX_DEPTH = 5;

test(`2 · Memories with its shelf is at most ${MEMORIES_MAX_DEPTH} trips deep (it was 7)`, () => {
  assert.ok(VIEW.depth <= MEMORIES_MAX_DEPTH, `Memories waits on reads one after another again:\n${shape(VIEW)}`);
  assert.deepEqual(VIEW.repeats, [], `a read is sent twice in one view:\n${shape(VIEW)}`);
});
