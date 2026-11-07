/**
 * view-as-a-named-guest-and-the-coordinator.test.ts — 👤📋 event chapters slice 6 (owner 2026-11-04).
 *
 *   1 · a NAMED GUEST's view is exactly their Event Hub card (`yourSchedule`, "What they see now"): before Release only
 *       their chapters and call; after Release their own lines; never a chapter the hosts took them off; never another
 *       guest's task; a refused guest read is said, never drawn as an empty day;
 *   2 · the COORDINATOR's view is every chapter and moment the host reads — backstage included — with their own tasks
 *       marked "theirs" and their call time ("Everything + their tasks");
 *   3 · the menu offers "Coordinator · <shop>" for a coordinator and every guest by name, both Pro; a Free menu lists
 *       neither; the keys round-trip;
 *   4 · the PDF prints exactly the drawn day: `readPrintDay` passes a good day and refuses anything else or anything
 *       too large, and the route checks sign-in, the Schedule and Pro BEFORE it reads the body ("Any View as person, Pro");
 *   5 · the screen and the file come from ONE function (`dayFor`), so the paper can never say more than the screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LAB_SCHEDULE_CHAPTERS } from '@/app/dev/chapters-lab/lab-chapters';
import { LAB_RECEPTION, labViewAs } from '@/app/dev/chapters-lab/lab-view-as';
import { lensFromKey, lensKey, viewAsMenuOptions, viewAsOptions } from '@/lib/schedule-view-as';
import { coordDay, personDay, printDayFromCard, printDayFromView, readPrintDay, PRINT_DAY_LIMITS } from '@/lib/schedule-view-as-people';
import { personDayDoc } from '@/lib/schedule-pdf';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const CH = LAB_SCHEDULE_CHAPTERS;
/** A plain guest's card after Release — every chapter on the invitation. */
const rey0 = () => {
  const r = personDay(CH, labViewAs(true, true).data, 'g-rey');
  assert.ok(r?.kind === 'ok');
  return r as Extract<NonNullable<typeof r>, { kind: 'ok' }>;
};

test('1 · a named guest sees exactly their own card — before and after Release', () => {
  const before = personDay(CH, labViewAs(true).data, 'g-cara');
  assert.equal(before?.kind, 'ok');
  if (before?.kind !== 'ok') return;
  assert.equal(before.stage, 'before');
  assert.ok(before.chapters.every((c) => c.lines.length === 0), 'lines were shown before Release');
  assert.equal(before.call?.label, 'Estimated call time', 'a bridesmaid’s call is not her estimated one');

  const after = personDay(CH, labViewAs(true, true).data, 'g-cara');
  assert.equal(after?.kind === 'ok' && after.stage, 'after');
  if (after?.kind !== 'ok') return;
  const lines = after.chapters.flatMap((c) => c.lines);
  assert.ok(lines.some((l) => l.mine && /In robes, hair first/.test(l.sub ?? l.title)), 'her own task is missing after Release');
  // Never another guest's or a supplier's line.
  assert.ok(!lines.some((l) => /hair and make-up, one chair each|Lines up the entourage/.test(`${l.title} ${l.sub ?? ''}`)), 'somebody else’s task reached her');

  // Lola Nena was taken off the Reception (on the invitation for everyone else): it is never hers.
  assert.ok(rey0().chapters.some((c) => c.id === LAB_RECEPTION), 'the Reception is not on the invitation — this check is pointed at nothing');
  const nena = personDay(CH, labViewAs(true, true).data, 'g-nena');
  assert.ok(nena?.kind === 'ok' && !nena.chapters.some((c) => c.id === LAB_RECEPTION), 'a chapter the hosts took her off was shown');
  // A plain guest's call is the invitation's Arrive by.
  const rey = personDay(CH, labViewAs(true).data, 'g-rey');
  assert.equal(rey?.kind === 'ok' && rey.call?.label, 'Arrive by');

  // A refused guest read, or refused tasks, is not a day.
  assert.equal(personDay(CH, { ...labViewAs(true).data, people: null }, 'g-cara'), null);
  assert.equal(personDay(CH, { ...labViewAs(true).data, tasks: null }, 'g-cara'), null);
  const view = code('app/dashboard/[eventId]/schedule/_components/schedule-view-as.tsx');
  assert.match(view, /if \(input\.data\.people === null\) return \{ kind: 'unread'/, 'a refused guest read is drawn as a day');
});

test('2 · the coordinator sees every moment, their own marked, with their call time', () => {
  const data = labViewAs(true).data;
  const day = coordDay(CH, data, 'v-coord');
  const ids = day.chapters.flatMap((c) => c.rows.map((r) => r.id));
  for (const m of data.moments) {
    if (CH.some((c) => c.block_id === m.parent_block_id)) assert.ok(ids.includes(m.block_id), `${m.label} is missing from the coordinator’s day`);
  }
  const mine = day.chapters.flatMap((c) => c.rows).filter((r) => r.mine);
  assert.ok(mine.some((r) => /Lines up the entourage/.test(r.sub)), 'the coordinator’s own task is not marked');
  assert.ok(day.chapters.flatMap((c) => c.rows).some((r) => !r.mine), 'every line is marked theirs');
  // Never another supplier's task under "You:".
  const yours = day.chapters.flatMap((c) => c.rows).map((r) => r.sub).filter((s) => s.startsWith('You:')).join(' | ');
  for (const t of data.tasks ?? []) if (t.vendor_id !== 'v-coord') assert.ok(!yours.includes(t.what), `another supplier’s task is the coordinator’s: ${t.what}`);
  assert.ok(day.call, 'the coordinator has no call time');
  // A Time-TBA chapter never sorts before its day's timed chapters.
  const order = day.chapters.map((c) => c.chapter);
  for (let i = 1; i < order.length; i++) {
    const [a, b] = [order[i - 1]!, order[i]!];
    if (a.time_tba && a.start_at.slice(0, 10) === b.start_at.slice(0, 10)) assert.ok(b.time_tba, `${a.label} (Time TBA) sorts before ${b.label}`);
  }
});

test('3 · the menu: Coordinator and every guest by name, on Pro only; keys round-trip', () => {
  const data = labViewAs(true).data;
  const keys = viewAsOptions(data).map((o) => o.key);
  assert.ok(keys.includes('coord=v-coord'), 'the coordinator is not offered');
  for (const p of data.people ?? []) assert.ok(keys.includes(`guest=${p.guest_id}`), `${p.name} is not offered`);
  const free = viewAsMenuOptions(data, false, true).map((o) => o.key);
  assert.ok(!free.some((k) => k.startsWith('guest=') || k.startsWith('coord=')), 'a Free event lists a per-person view');
  for (const k of ['guest=g-cara', 'coord=v-coord']) assert.equal(lensKey(lensFromKey(k)), k);
  assert.equal(lensFromKey('guest=').kind, 'everyone', 'an empty guest key guessed a person');
});

test('4 · the PDF prints exactly the drawn day, and the route checks before it reads', () => {
  const data = labViewAs(true, true).data;
  const card = personDay(CH, data, 'g-cara');
  assert.ok(card?.kind === 'ok');
  if (card?.kind !== 'ok') return;
  const print = printDayFromCard('Cara Lim', card);
  assert.deepEqual(readPrintDay(JSON.parse(JSON.stringify(print))), print, 'a good day was refused or changed');
  const coord = printDayFromView('Coordinator · The Planning Desk', coordDay(CH, data, 'v-coord'));
  assert.ok(readPrintDay(coord));
  const doc = personDayDoc({ eventName: 'Ana & Ben', eventDate: '18 Dec 2026', day: print, generatedAt: new Date(0) });
  assert.equal(doc.sections.length, print.chapters.length);
  assert.equal(doc.sections[0]!.rows.length, print.chapters[0]!.rows.length);

  assert.equal(readPrintDay(null), null);
  assert.equal(readPrintDay({ ...print, person: '' }), null, 'a day with no person printed');
  assert.equal(readPrintDay({ ...print, chapters: [{ name: 'x', line: 'y', rows: [{ time: 1, title: 'x' }] }] }), null, 'a number passed as a time');
  assert.equal(readPrintDay({ ...print, person: 'x'.repeat(PRINT_DAY_LIMITS.text + 1) }), null, 'an over-long string printed');
  const many = Array.from({ length: PRINT_DAY_LIMITS.rows + 1 }, () => ({ time: '1 PM', title: 'x', sub: null }));
  assert.equal(readPrintDay({ ...print, chapters: [{ name: 'x', line: 'y', rows: many }] }), null, 'too many rows printed');

  const route = code('app/api/schedule/[eventId]/export/route.ts');
  const post = route.slice(route.indexOf('export async function POST'));
  const order = ['auth.getUser()', "viewerAreaLevel(viewer, 'schedule') === null", 'if (!pro)', 'req.text()', 'readPrintDay('];
  let at = -1;
  for (const step of order) {
    const i = post.indexOf(step);
    assert.ok(i > at, `the route's "${step}" is missing or out of order — the body must be read only after every door`);
    at = i;
  }
});

test('5 · the screen and the file are one day', () => {
  const view = code('app/dashboard/[eventId]/schedule/_components/schedule-view-as.tsx');
  assert.match(view, /const drawn = useMemo\(\(\) => \(lens\.kind === 'suptime' \|\| lens\.kind === 'everyone' \? null : dayFor\(lens, input, chapters\)\)/);
  assert.match(view, /const print = drawn \? printOf\(words, drawn\) : null;/);
  assert.match(view, /body=\{JSON\.stringify\(print\)\}/, 'the file is not the drawn day');
  // A day drawn over refused tasks is never handed out as a file.
  assert.match(view, /if \(d\.kind === 'day'\) return d\.day\.tasksUnread \? null : printDayFromView/);
});
