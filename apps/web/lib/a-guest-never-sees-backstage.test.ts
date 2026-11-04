/**
 * a-guest-never-sees-backstage.test.ts — 🎭 event chapters slice 4 (owner 2026-11-04; approved prototype "Event chapters
 * — 4 Nov 2026", frames 2 and 8: *"Ingress and egress are back-end plans … They never show on the Event Hub. Only the
 * chapter and its front-of-house moments do."*).
 *
 * 🔒 THE GUARD: the guests' schedule — Event Hub › Me (`your-schedule`), the invitation's programme
 * (`invitation-chapters`), the Event Hub's schedule (`schedule-widget`) and the host's View as a guest — never contains a
 * chapter's Ingress or Egress: not a moment in them, even one whose eye was left on, and not the setup or pack-up times.
 *
 *   1 · each guest reader, run on a chapter holding a PUBLIC moment in its Ingress, its Event and its Egress, keeps
 *       only the Event moment;
 *   2 · no guest reader asks for, or reads, a chapter's setup or pack-up (`ingress_minutes_before` ·
 *       `egress_minutes_after` · `ingressAt` · `egressAt`) — scanned across every file under app/[slug] and the guest libs;
 *   3 · the backstage words are drawn where the host, the coordinator and the supplier read it — and nowhere a guest does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { chaptersFromBlocks, isBackstage, withoutBackstage } from '@/lib/schedule-chapters';
import { guestScheduleByChapter, invitationChapters } from '@/lib/invitation-chapters';
import { yourSchedule } from '@/lib/guest-your-schedule';
import { guestDay } from '@/lib/schedule-view-as';
import type { ScheduleBlockRow } from '@/lib/schedule';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

const DAY = '2099-12-18';
const at = (hhmm: string) => `${DAY}T${hhmm}:00.000Z`;
const CHAPTER = {
  block_id: 'rec', parent_block_id: null, label: 'Cocktail + Reception', start_at: at('17:00'), end_at: at('22:00'),
  location: 'Blue Leaf', spot: null, notes: null, ingress_minutes_before: 240, egress_minutes_after: 390,
  on_invitation: true, is_public: true, sort_order: 300, time_tba: false,
};
const moment = (id: string, label: string, hhmm: string) => ({
  block_id: id, public_id: '', event_id: 'e1', parent_block_id: 'rec', label, block_type: 'custom', start_at: at(hhmm), end_at: null,
  location: null, notes: null, is_public: true, sort_order: 10, created_at: '', run_state: 'upcoming', actual_start_at: null,
  actual_end_at: null, audience: null, time_tba: false,
});
// Every one of them has its eye ON — the backstage ones still never reach a guest.
const MOMENTS = [moment('in', 'Catering sets up', '13:00'), moment('ev', 'Dinner', '18:00'), moment('out', 'Lights out, pack-up', '22:30')];
const FRONT = ['ev'];

test('1a · the shared rule: before the start and at or after the end is backstage', () => {
  assert.equal(isBackstage(at('13:00'), CHAPTER), true);
  assert.equal(isBackstage(at('18:00'), CHAPTER), false);
  assert.equal(isBackstage(at('22:00'), CHAPTER), true, 'the end itself is Egress');
  assert.equal(isBackstage(at('13:00'), { ...CHAPTER, time_tba: true }), false, 'a Time TBA chapter has no backstage by time');
  assert.deepEqual(withoutBackstage([CHAPTER, ...MOMENTS]).map((b) => b.block_id), ['rec', ...FRONT]);
});

test('1b · the invitation’s programme (invitation-chapters) keeps only front of house', () => {
  const rows = guestScheduleByChapter(invitationChapters([CHAPTER]), MOMENTS as unknown as ScheduleBlockRow[]);
  assert.deepEqual(rows?.filter((r) => !r.chapter_heading).map((r) => r.block_id), FRONT);
});

test('1c · Event Hub › Me (your-schedule) keeps only front of house', () => {
  const chapters = chaptersFromBlocks([CHAPTER] as unknown as Parameters<typeof chaptersFromBlocks>[0]);
  const s = yourSchedule({
    chapters,
    moments: MOMENTS.map((m) => ({ ...m, staged: false })),
    tasks: [],
    viewer: { guestId: 'g1', roles: ['guest'], groupIds: [] },
    released: true,
    pro: true,
    guestsArriveBy: null,
  });
  assert.equal(s.kind, 'ok');
  const lines = s.kind === 'ok' ? s.chapters.flatMap((c) => c.lines.map((l) => l.id)) : [];
  assert.deepEqual(lines, FRONT, 'a backstage moment reached the guest’s Me card');
  const text = JSON.stringify(s);
  assert.doesNotMatch(text, /sets up|pack-up|1:00 PM|11:30 PM/, 'the setup or pack-up reached the guest’s Me card');
});

test('1d · the Event Hub’s schedule (schedule-widget) and View as a guest drop backstage', () => {
  const widget = code('app/[slug]/_components/schedule-widget.tsx');
  assert.match(widget, /const blocks = useMemo\(\(\) => withoutBackstage\(givenBlocks\), \[givenBlocks\]\);/, 'the widget draws the blocks it was given, backstage and all');
  const widgetBody = widget.slice(widget.indexOf('export function ScheduleWidget('));
  const after = widgetBody.slice(widgetBody.indexOf('\n', widgetBody.indexOf('const blocks = useMemo')));
  assert.doesNotMatch(after, /givenBlocks/, 'the widget reads the unfiltered blocks after filtering them');
  const chapters = chaptersFromBlocks([CHAPTER] as unknown as Parameters<typeof chaptersFromBlocks>[0]);
  const view = guestDay(chapters, { moments: MOMENTS.map((m) => ({ ...m, staged: false, vendor_ids: [], is_optional: false })), tasks: [] } as unknown as Parameters<typeof guestDay>[1]);
  assert.deepEqual(view.chapters.flatMap((c) => c.rows.map((r) => r.id)), FRONT, 'View as a guest shows backstage');
});

/** Every source file a guest page is built from: app/[slug] (the Event Hub) and the guest libs. */
function guestSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app', '[slug]'));
  return [...out, 'lib/guest-your-schedule.ts', 'lib/invitation-chapters.ts'];
}

test('2 · no guest reader asks for, or reads, a chapter’s setup or pack-up', () => {
  const files = guestSources();
  assert.ok(files.length > 20, `the guest scan found only ${files.length} files — it is pointed at nothing`);
  const hits = files.filter((f) => /ingress_minutes_before|egress_minutes_after|\bingressAt\(|\begressAt\(/.test(code(f)));
  assert.deepEqual(hits, [], `a guest page reads backstage times:\n  ${hits.join('\n  ')}`);
});

test('3 · the backstage words are drawn for the host and the supplier, never for a guest', () => {
  assert.match(code('app/dashboard/[eventId]/schedule/_components/chapters-host.tsx'), /\{BACKSTAGE_WORDS\} <Tip>\{BACKSTAGE_TIP\}<\/Tip>/);
  assert.match(code('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx'), /\{m\.section\} · \{BACKSTAGE_WORDS\}/);
  assert.equal(code('lib/chapter-section.ts').includes("Backstage · guests don’t see this"), true);
  const leak = guestSources().filter((f) => /BACKSTAGE_WORDS|Backstage ·/.test(code(f)));
  assert.deepEqual(leak, [], 'a guest page draws the backstage words');
});
