/**
 * the-maker-reads-start-together.test.ts — ⚡ OPENING THE MAKER IS NOT A QUEUE OF READS.
 *
 * MEASURED 2026-10-23 (the speed pass), `app/dashboard/[eventId]/launch/maker-page-reads.harness.ts` —
 * the REAL `LaunchHubPage`, then the REAL `WebsiteEditorPage` it mounts (React draws it only after the
 * page returns), against a database that counts how deep each request ran:
 *
 *   · the page was 25 trips deep: whether the address was renamed, the internal reading, the event
 *     type's profile and the tour keys were each awaited on their own line; inside the work the draft
 *     waited for the Menu's sources, the RSVP deadline for Your event, the background for the seat plan,
 *     where the reveal plays and the See-as role names for everything above them, and two query builders
 *     only left at their await;
 *   · the editor then added 14 more in single file — its gate, the draft, the scenes, the fixed styles,
 *     the schedule, the names, the rite, the roles, the role names, the entourage count — 39 in all.
 *
 * Each read is now STARTED as soon as what it needs is in (`lib/start-ahead.ts`) and awaited where it
 * always was. The property held is the DEPTH — what a couple waits for before the Maker is drawn — and
 * that the event-only reads leave together. It also holds the index that `eventHasRenamed`'s read needs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type View = { calls: number; depth: number; pageDepth: number; ms: number; steps: string[]; repeats: string[]; editorDrawn: boolean };

const WEB = join(__dirname, '..');

function measure(): View {
  const out = execFileSync(join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'), [join(WEB, 'app', 'dashboard', '[eventId]', 'launch', 'maker-page-reads.harness.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '', MAKER_PAGE_READS_DELAY_MS: '3' },
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = out.split('\n').find((l) => l.startsWith('MAKER_PAGE_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return (JSON.parse(line.slice('MAKER_PAGE_READS '.length)) as { maker: View }).maker;
}

const VIEW = measure();
const shape = (v: View) => `${v.calls} requests, ${v.depth} deep (page ${v.pageDepth})\n  ${v.steps.join('\n  ')}`;
const stepOf = (what: RegExp) => Number(VIEW.steps.find((s) => what.test(s))?.split(' ')[0] ?? NaN);

test('0 · the fixture drew the new Maker and its editor — or the depth below would be about nothing', () => {
  assert.ok(VIEW.editorDrawn, `the Maker no longer mounts the editor page — re-point this guard:\n${shape(VIEW)}`);
  for (const read of [/ slug_change_log\(/, / users\(tour_seen_keys/, / event_site_drafts\(/, /events\(slug,landing_page_visibility,launch_mode/, / invitation_widgets\(widget_id/]) {
    assert.ok(Number.isFinite(stepOf(read)), `the fixture never made the Maker read ${read}:\n${shape(VIEW)}`);
  }
});

/** MEASURED: the page 25 → 14, the page and its editor 39 → 19. */
const PAGE_MAX_DEPTH = 14;
const MAKER_MAX_DEPTH = 19;

test(`1 · the Maker page is at most ${PAGE_MAX_DEPTH} trips deep (it was 25)`, () => {
  assert.ok(VIEW.pageDepth <= PAGE_MAX_DEPTH, `the Maker page waits on reads one after another again:\n${shape(VIEW)}`);
});

test(`2 · the Maker with its editor is at most ${MAKER_MAX_DEPTH} trips deep (it was 39)`, () => {
  assert.ok(VIEW.depth <= MAKER_MAX_DEPTH, `the Maker's editor waits on reads one after another again:\n${shape(VIEW)}`);
});

test('3 · the event-only reads leave together, right after the host gate', () => {
  const renamed = stepOf(/ slug_change_log\(/);
  const seen = stepOf(/ users\(tour_seen_keys/);
  const gate = stepOf(/ event_members\(member_type\)/);
  assert.equal(renamed, gate + 1, `whether the address was renamed waits for more than the host gate:\n${shape(VIEW)}`);
  assert.equal(seen, gate + 1, `the tour keys wait for more than the host gate:\n${shape(VIEW)}`);
});

test('4 · slug_change_log has the index its by-event read needs', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const hit = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .some((f) => /CREATE INDEX[^;]*ON\s+public\.slug_change_log\s*\(\s*entity_type\s*,\s*entity_id\s*\)/i.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(hit, '`eventHasRenamed` filters slug_change_log on (entity_type, entity_id) and no migration indexes it');
});
