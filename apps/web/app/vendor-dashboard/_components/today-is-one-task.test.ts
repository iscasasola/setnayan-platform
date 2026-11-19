/**
 * today-is-one-task.test.ts — 📋 TODAY v2 IS MOUNTED, AND IT ANSWERS WITH THE SHIPPED ACTIONS (owner 18 Nov 2026,
 * `Today, one task` v2: *"i just wanted to reply to a review … keep focus on one task"*).
 *
 *   1 · the Today page hands the v2 rows to the screen, and the screen draws them in place of the jumping rows;
 *   2 · every quick kind mounts its SHIPPED form with its SHIPPED action (no new `use server` export);
 *   3 · the bigger kinds open ONE risen screen (`SupplierOpenRow rise`), never a whole page;
 *   4 · the focused review has NO "Flag as fake" (it stays on Shop › Your page), and a quick row has one main button;
 *   5 · the two answers that used to jump away come back to Today through ONE exact literal.
 *
 * SABOTAGE (each seen red once): mount `vendorAgreeToLock` as the review's action → 2 red; drop `rise` → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const V2 = code('app/vendor-dashboard/_components/today-v2.tsx');

test('1 · the page mounts v2 and the screen draws it', () => {
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /const \{ view: viewV2, v2 \} = buildTodayV2\(/);
  assert.match(page, /view=\{viewV2\}\s+v2=\{v2\}/);
  assert.match(code('app/vendor-dashboard/_components/today-v2-assemble.tsx'), /<TodayV2Needs\b/);
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.match(first, /\{needsRows\}\s+\{needsRows \? null : needs\.map/, 'the jumping rows still draw beside the v2 rows');
});

test('2 · each quick kind mounts its shipped form and action', () => {
  for (const [body, action] of [
    ['ReviewBody', 'postReviewReply=\\{postVendorReply\\}'],
    ['LockBody', 'confirmLock=\\{vendorAcknowledgeDeposit\\}'],
    ['DateChangeBody', 'answerDateChange=\\{vendorAnswerDateChange\\}'],
    ['MarkCompleteBody', 'markServiceComplete=\\{vendorMarkServiceComplete\\}'],
    ['MeetingBody', 'respondMeeting=\\{respondAppointment\\}'],
  ]) {
    assert.match(V2, new RegExp(`<${body} card=\\{card\\} ${action}`), `${body} is not mounted with its shipped action`);
  }
  assert.ok(!/['"]use server['"]/.test(readFileSync(join(WEB, 'app/vendor-dashboard/_components/today-v2.tsx'), 'utf8')), 'Today v2 grew a server action');
});

test('3 · a bigger kind opens ONE risen screen', () => {
  assert.match(V2, /<SupplierOpenRow[\s\S]{0,600}?\brise\b[\s\S]{0,200}?<ScreenBody/);
});

test('4 · no "Flag as fake" on Today; one main button inside a quick row', () => {
  assert.ok(!/submitFlagAsFake|Flag as fake/i.test(V2));
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  const review = sections.slice(sections.indexOf('export function ReviewBody('), sections.indexOf('export function DisputeBody('));
  assert.ok(!/Open the review/.test(review), 'the review row kept a second button');
  const lock = sections.slice(sections.indexOf('export function LockBody('), sections.indexOf('export function ReviewBody('));
  assert.ok(!/View the payment/.test(lock), 'the payment row kept a second button');
});

test('5 · answered on a row → back to Today, through one exact literal', () => {
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.ok((sections.match(/name="return_to" value="\/vendor-dashboard"/g) ?? []).length >= 3);
  const ret = code('lib/vendor-client-return.ts');
  assert.match(ret, /if \(raw === TODAY_PATH\)/);
  const actions = code('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(actions, /if \(formData\.get\('return_to'\) === '\/vendor-dashboard'\) \{\s*revalidatePath\('\/vendor-dashboard'\);\s*redirect\('\/vendor-dashboard\?completed=1'\);/);
});
