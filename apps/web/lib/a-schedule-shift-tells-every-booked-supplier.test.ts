/**
 * a-schedule-shift-tells-every-booked-supplier.test.ts — owner, tracker 2026-10-23: YES. When the couple shifts the
 * schedule (Running late on the couple's schedule, or the day-of floor's +N), every booked supplier on the event gets
 * ONE in-app notice — "Schedule moved +30 min from 4:00 PM" — opening their event Hub's schedule. One per shift,
 * never one per block; no email.
 *
 *   ⓵ The words, from the moment the shift starts at (a stored wall clock — never converted).
 *   ⓶ Where it opens: the live console on the day; the customer card any other day (the console redirects then).
 *   ⓷ Once per shift: each action calls the notifier ONCE, after its write loop — never inside it; Running late sends
 *      `shift_notice` and a drag of one moment does not; the floor always does.
 *   ⓸ Who: booked shops' owners, once per person, never the person who pressed it — as `schedule_shifted`, a type the
 *      database knows, kept off the email allowlist.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { isOnTheDay, scheduleShiftBody, scheduleShiftHref, scheduleShiftTitle, shiftAmount } from '@/lib/schedule-shift-notice';
import { NOTIFICATION_TYPE_LABEL } from '@/lib/notifications';
import { coupleSupplierNotice } from '@/lib/couple-supplier-notices';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ACTIONS = 'app/dashboard/[eventId]/schedule/actions.ts';
const FLOOR = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts';
const SHEETS = 'app/dashboard/[eventId]/schedule/_components/day-sheets.tsx';
const RAIL = 'app/dashboard/[eventId]/schedule/_components/day-rail.tsx';
const NOTIFY = 'lib/schedule-shift-notify.server.ts';
const HUB = 'app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx';

function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  const head = /\)(?:\s*:\s*[\w<>[\]., |']+)?\s*\{\n/.exec(src.slice(at));
  assert.ok(head, `${name} has no body brace`);
  const open = at + head.index + head[0].length - 2;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}
/** The text of the first `for (…) { … }` loop in `src`, brace-matched. */
function firstLoop(src: string): { start: number; end: number } {
  const start = src.search(/\bfor \(const \w+ of patches\) \{/);
  assert.ok(start >= 0, 'no write loop over patches — re-point this guard');
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { start, end: i };
  }
  throw new Error('loop never closes');
}

test('⓵ the words: "Schedule moved +30 min from 4:00 PM", from the stored wall clock', () => {
  assert.equal(scheduleShiftTitle(30, '2026-12-18T16:00:00Z'), 'Schedule moved +30 min from 4:00 PM');
  assert.equal(scheduleShiftTitle(-15, '2026-12-18T09:05:00Z'), 'Schedule moved −15 min from 9:05 AM');
  assert.equal(scheduleShiftTitle(75, '2026-12-18T00:30:00Z'), 'Schedule moved +1 h 15 min from 12:30 AM');
  assert.equal(scheduleShiftTitle(60, null), 'Schedule moved +1 h');
  assert.equal(shiftAmount(5), '+5 min');
  assert.match(scheduleShiftBody('Ana & Paolo', 'Ceremony'), /^Ana & Paolo shifted the day from Ceremony on\./);
});

test('⓶ it opens the live console’s schedule on the day, and the customer card any other day', () => {
  assert.equal(scheduleShiftHref('e1', true), '/vendor-dashboard/on-the-day/live/e1#schedule');
  assert.equal(scheduleShiftHref('e1', false), '/vendor-dashboard/clients/e1');
  assert.equal(isOnTheDay('2026-12-18', null, '2026-12-18'), true);
  assert.equal(isOnTheDay('2026-12-18', '2026-12-19', '2026-12-19'), true);
  assert.equal(isOnTheDay('2026-12-18', null, '2026-12-17'), false);
  assert.equal(isOnTheDay(null, null, '2026-12-18'), false);
  // the fragment lands on a block the console ALWAYS draws (a fragment to a missing id fails in silence)
  const hub = read(HUB);
  assert.match(hub, /<div id="schedule" className="scroll-mt-4">/);
});

test('⓷ once per shift — after the write loop, never inside it; Running late asks for it, a drag does not', () => {
  for (const [file, fn] of [[ACTIONS, 'bulkRetimeScheduleBlocks'], [FLOOR, 'floorRetimeFrom']] as const) {
    const b = body(read(file), fn);
    const calls = [...b.matchAll(/notifyScheduleShifted\(/g)].map((m) => m.index!);
    assert.equal(calls.length, 1, `${fn} tells the suppliers ${calls.length} times — once per shift`);
    const loop = firstLoop(b);
    assert.ok(calls[0]! > loop.end, `${fn} tells the suppliers inside its write loop — one notice per block`);
  }
  const retime = body(read(ACTIONS), 'bulkRetimeScheduleBlocks');
  assert.match(retime, /if \(formData\.get\('shift_notice'\) === '1'\) \{[\s\S]*?notifyScheduleShifted\(/, 'every retime — a drag too — notifies');
  const submit = body(body(read(SHEETS), 'ShiftSheet'), 'submit');
  assert.match(submit, /shift_notice: '1'/, 'the Running-late sheet no longer asks for the notice');
  const rail = read(RAIL);
  assert.doesNotMatch(rail, /shift_notice/, 'a drag of one moment would tell every supplier the day moved');
});

test('⓸ booked shops’ owners, once each, never the actor — an in-app type the database knows', () => {
  const n = read(NOTIFY);
  assert.match(n, /\.in\('status', \[\.\.\.BOOKED_EVENT_VENDOR_STATUSES\]\)/);
  assert.match(n, /\.is\('archived_at', null\)/);
  assert.match(n, /o\.user_id === input\.actorUserId/, 'the person who shifted it is told about their own shift');
  assert.match(n, /told\.has\(o\.user_id\)/, 'a person with two booked shops is told twice');
  assert.match(n, /type: 'schedule_shifted'/);
  assert.equal(NOTIFICATION_TYPE_LABEL.schedule_shifted, 'Schedule moved');
  assert.equal(coupleSupplierNotice('schedule_shifted')?.reach, 'app_only');
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('const EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /'schedule_shifted'/, 'the shift notice is emailed — owner: no email');
  const mig = join(WEB, '..', '..', 'supabase', 'migrations');
  const adds = readdirSync(mig).filter((f) => /ADD VALUE IF NOT EXISTS 'schedule_shifted'/.test(readFileSync(join(mig, f), 'utf8')));
  assert.equal(adds.length, 1, 'the database has never heard of schedule_shifted — every INSERT is refused in silence');
});
