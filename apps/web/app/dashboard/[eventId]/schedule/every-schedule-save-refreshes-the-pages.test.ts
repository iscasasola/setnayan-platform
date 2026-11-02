/**
 * every-schedule-save-refreshes-the-pages.test.ts — 🔄 A SCHEDULE SAVE REFRESHES HOME, PLANNING AND SCHEDULE (audit
 * 2026-11-02 #6). The chapter and moment sheets always sent the Maker's quiet flag, so `revalidateScheduleUnlessMaker`
 * returned early, and the task and march branches never revalidated at all — Home and Planning lied for up to 60 s
 * (`staleTimes.dynamic`). Held as properties:
 *   1. the sheets do not send the quiet flag — they are never in the Maker (the page reads no chapters there);
 *   2. a task or march that SAVED revalidates (a read — the Papic count — does not);
 *   3. the revalidation reaches the Schedule, Home and Booked › Schedule (/vendors), and still skips a Maker write.
 * Sabotage (2026-11-02, each reverted, each red): `fd.set(MAKER_QUIET_FIELD, '1')` back in moment-sheets (1) · the
 * moment_op branch returning before it revalidates (2) · the /vendors path dropped (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const S = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'schedule');
const code = (...p: string[]) => stripComments(readFileSync(join(S, ...p), 'utf8'));
const body = (src: string, name: string) => {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  return src.slice(at, src.indexOf('\n}\n', at));
};

test('1 · the chapter and moment sheets send no quiet flag — and never sit in the Maker', () => {
  for (const f of ['chapter-sheets.tsx', 'moment-sheets.tsx']) {
    const form = body(code('_components', f), 'form');
    assert.doesNotMatch(form, /MAKER_QUIET_FIELD|maker_quiet/, `${f}: a sheet save asks its action to revalidate nothing`);
  }
  const page = code('page.tsx');
  assert.match(page, /inMaker \? Promise\.resolve\(null\) : readChapterBook\(/, 'the Maker reads chapters now — its saves must stay quiet');
});

test('2 · a task or march that saved revalidates; the Papic count does not', () => {
  const update = body(code('actions.ts'), 'updateScheduleBlock');
  const branch = update.slice(update.indexOf("const momentOp = formData.get('moment_op')"), update.indexOf('type Patch'));
  assert.match(branch, /if \(answer\.ok && momentOp !== 'papic_count'\) revalidateScheduleUnlessMaker\(eventId, formData\);\s*return answer;/, 'a task or march save returns before it revalidates');
  assert.doesNotMatch(branch, /return run(?:MomentOp|MomentMarch)\(/, 'a moment op returns straight from its runner, revalidating nothing');
});

test('3 · the revalidation reaches the Schedule, Home and Booked › Schedule — and still skips a Maker write', () => {
  const fn = body(code('actions.ts'), 'revalidateScheduleUnlessMaker');
  assert.match(fn, /if \(makerQuietWrite\(formData\)\) return;/);
  for (const call of ['revalidatePath(`/dashboard/${eventId}/schedule`)', 'revalidatePath(`/dashboard/${eventId}`)', 'revalidatePath(`/dashboard/${eventId}/vendors`)']) {
    assert.ok(fn.includes(call), `no ${call}`);
  }
});
