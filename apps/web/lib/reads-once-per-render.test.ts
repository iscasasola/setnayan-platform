/**
 * 🔒 THREE ROWS EVERY DASHBOARD RENDER READS — EACH ASKED ONCE (speed pass 2026-11-18).
 *
 *   1. The signed-in person's `users` row: the dashboard, supplier and admin layouts and the account switcher each
 *      read it — two round trips per page. All four ask `getUserRow` (`lib/user-row.ts`, `React.cache`).
 *   2. The delegate's grant (`event_moderators.permissions_json`): `fetchEventViewer`, the People page, the Schedule's
 *      advance check and the budget's visibility sent the identical request. All ask `eventDelegateGrantOnce`.
 *   3. The event row on the couple's dashboard: a page that reads columns the layout's one read already carries
 *      (`DASHBOARD_ROW_CARRIES`) asks through `eventRowOnce`, which answers from that read or sends the page's own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { DASHBOARD_ROW_CARRIES } from '@/lib/event-row-once';

const ROOT = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

test('1 · the users row: the layouts and the switcher ask getUserRow, never their own users read', () => {
  for (const f of [
    'app/dashboard/layout.tsx',
    'app/vendor-dashboard/layout.tsx',
    'app/admin/layout.tsx',
    'app/_components/account-switcher/get-switcher-data.ts',
  ]) {
    const src = read(f);
    assert.match(src, /getUserRow\(/, `${f} no longer asks getUserRow`);
    assert.doesNotMatch(src, /\.from\('users'\)/, `${f} reads the users row itself again — a second round trip per page`);
  }
  const lib = read('lib/user-row.ts');
  assert.match(lib, /export const getUserRow = cache\(/, 'getUserRow is no longer cache()d per render');
  for (const col of ['account_type', 'deleted_at', 'tour_seen_keys', 'terms_version', 'profile_photo_url', 'theme_preference', 'is_internal', 'is_team_member']) {
    assert.ok(lib.includes(col), `getUserRow no longer reads ${col}, which a caller needs`);
  }
  assert.match(lib, /select\('\*'\)/, 'the column-drift fallback is gone');
});

test('2 · the delegate grant: the identical event_moderators read is asked once', () => {
  for (const f of ['lib/event-viewer.server.ts', 'app/dashboard/[eventId]/people/page.tsx', 'app/dashboard/[eventId]/schedule/page.tsx', 'lib/budget-visibility.ts']) {
    const src = read(f);
    assert.match(src, /eventDelegateGrantOnce\(/, `${f} no longer asks eventDelegateGrantOnce`);
  }
  assert.doesNotMatch(read('lib/event-viewer.server.ts'), /\.from\('event_moderators'\)/, 'fetchEventViewer reads the grant itself again');
  assert.match(read('lib/event-delegate-once.ts'), /askedOnce\(client, 'event_moderators\.permissions_json'/);
});

/** Pages owned by another open PR (#7795) — adopted when it lands. */
const WAITING = new Set(['app/dashboard/[eventId]/vendors/page.tsx', 'app/dashboard/[eventId]/website/editor/page.tsx']);
const SIMPLE_EVENTS_READ =
  /\bsupabase\s*\.from\('events'\)\s*\.select\(\s*(['`])([^'`$]*)\1\s*\)\s*\.eq\('event_id',\s*eventId\)\s*\.maybeSingle\(\)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

function unwrappedCarriedReads(src: string): string[] {
  const carried = new Set<string>(DASHBOARD_ROW_CARRIES);
  const out: string[] = [];
  for (const m of src.matchAll(SIMPLE_EVENTS_READ)) {
    const before = src.slice(Math.max(0, (m.index ?? 0) - 700), m.index);
    const opener = before.lastIndexOf('eventRowOnce(');
    if (opener >= 0 && before.slice(opener).includes('=>')) continue;
    const cols = m[2].split(',').map((c) => c.trim()).filter(Boolean);
    if (cols.length > 0 && cols.every((c) => carried.has(c))) out.push(cols.join(', '));
  }
  return out;
}

test('3 · the detector flags a carried read that is not wrapped, and passes a wrapped one', () => {
  const bare = "await supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle();";
  assert.deepEqual(unwrappedCarriedReads(bare), ['event_date']);
  assert.deepEqual(unwrappedCarriedReads(`await eventRowOnce(supabase, eventId, 'event_date', () =>\n  ${bare.replace('await ', '')})`), []);
  assert.deepEqual(unwrappedCarriedReads("supabase.from('events').select('love_story').eq('event_id', eventId).maybeSingle()"), [], 'a column the row does not carry is the page\'s own read');
});

test('3 · every [eventId] page asks the dashboard\'s one event read for the columns it already carries', () => {
  const files = walk(join(ROOT, 'app/dashboard/[eventId]'));
  assert.ok(files.length > 100, `anti-vacuity: walked ${files.length} pages`);
  const offenders = files
    .map((f) => relative(ROOT, f))
    .filter((f) => !WAITING.has(f))
    .flatMap((f) => unwrappedCarriedReads(read(f)).map((cols) => `${f} (${cols})`));
  assert.deepEqual(offenders, [], `wrap these in eventRowOnce(supabase, eventId, cols, () => …): ${offenders.join(' · ')}`);
});
