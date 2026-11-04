/**
 * approve-all-is-every-change-you-saw.test.ts — ✅ APPROVE ALL.
 *
 * Owner 2026-11-01: *"also have an approve all"* (DECISION_LOG "APPROVE ALL"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6b):
 * pinned at the foot of the Requests sheet when 2 or more changes wait. A suggestion in words gets Noted and is not in
 * it — it changes nothing by itself.
 *
 *   1 · who is in it: every change, never a suggestion in words, and only from two;
 *   2 · the sheet pins it, behind the house confirm, posting the ids ON THE SHEET; a note gets Noted, not Approve;
 *   3 · the server keeps a suggestion in words out too, and approves through the ONE accept path (which tells the
 *       supplier), never a second copy of it;
 *   4 · it approves what was shown — the posted ids — never "whatever is open now".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { APPROVE_ALL_MIN, approvableTogether } from '@/lib/schedule-ros';

const S = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'schedule');
const read = (...p: string[]) => stripComments(readFileSync(join(S, ...p), 'utf8'));

/** The body of `function <name>(…) {…}`, brace-matched from its first `{` after the name's `)` + return type. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  const open = src.indexOf('{\n', src.indexOf(')', at)) + 0;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}

const R = (id: string, over: Partial<{ kind: string; proposed_label: string | null; proposed_start_at: string | null; proposed_end_at: string | null; proposed_location: string | null }> = {}) => ({
  suggestion_id: id,
  kind: 'adjust',
  proposed_label: null,
  proposed_start_at: '2026-12-18T14:30:00Z',
  proposed_end_at: null,
  proposed_location: null,
  ...over,
});
const WORDS = { proposed_start_at: null };

test('1 · every change, never a suggestion in words, and only from two', () => {
  assert.equal(APPROVE_ALL_MIN, 2);
  const together = approvableTogether([R('a'), R('n', WORDS), R('b', { kind: 'new', proposed_label: 'Cake' }), R('c', { kind: 'remove', proposed_start_at: null })]);
  assert.deepEqual(together.map((r) => r.suggestion_id), ['a', 'b', 'c']);
  assert.deepEqual(approvableTogether([R('a'), R('n', WORDS)]), [], 'one change and a note is not "all"');
  assert.deepEqual(approvableTogether([R('n', WORDS), R('m', WORDS)]), [], 'notes alone offered Approve all');
});

test('2 · the sheet pins Approve all behind the house confirm, with the ids it shows; a note gets Noted', () => {
  const sheet = body(read('_components', 'day-sheets.tsx'), 'RequestsSheet');
  assert.match(sheet, /const together = approvableTogether\(requests\)/, 'Approve all counts something other than the changes on the sheet');
  const foot = sheet.slice(sheet.indexOf('together.length > 0 ?'));
  assert.ok(foot.length > 0 && /sticky bottom-0/.test(foot), 'Approve all is not pinned at the foot');
  // 🔁 Saved in place since 2026-11-02 (audit #15): the confirm's action reads the door's answer instead of redirecting.
  assert.match(foot, /<ConfirmForm\s+action=\{async \(fd\) => \{[\s\S]*?await resolveScheduleSuggestion\(fd\)/, 'Approve all fires without the house confirm');
  assert.match(foot, /<input type="hidden" name="decision" value="accept_all" \/>/, 'the press is not marked as Approve all');
  assert.match(foot, /together\.map\(\(r\) => \(\s*<input key=\{r\.suggestion_id\} type="hidden" name="suggestion_id" value=\{r\.suggestion_id\} \/>/, 'it posts something other than the ids shown');
  assert.match(foot, /Approve all \{formatCount\(together\.length\)\}/, 'the button does not say how many');
  // One request's Decline · Approve / Noted is `RequestDecision` (saved in place, 2026-11-02).
  assert.match(sheet, /<RequestDecision [^>]*noteOnly=\{isNoteOnlySuggestion\(r\)\} decide=\{resolveScheduleSuggestion\} \/>/, 'a request does not decide through the one door');
  const decision = stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'schedule', '_components', 'request-decision.tsx'), 'utf8'));
  assert.match(decision, /noteOnly \? 'Noted' : 'Approve'/, 'a suggestion in words is Approved, not Noted');
  assert.match(decision, /\{noteOnly \? null : \([\s\S]*?press\('decline'\)/, 'a suggestion in words can be Declined');
});

test('3 · the server keeps notes out and approves through the one accept path', () => {
  const actions = read('actions.ts');
  const all = body(actions, 'approveAllScheduleSuggestions');
  assert.match(all, /decideSuggestion\(supabase, user\.id, eventId, id, 'accept', true\)/, 'Approve all does not use the one accept path');
  assert.doesNotMatch(all, /\.from\('event_schedule_blocks'\)/, 'Approve all writes the schedule itself — a second accept path');
  // The one accept path lives in lib since Step 4b (Auto-agree runs it too).
  const decide = body(stripComments(readFileSync(join(__dirname, 'schedule-suggestion-decide.server.ts'), 'utf8')), 'decideSuggestion');
  const out = decide.search(/if \(onlyChanges && isNoteOnlySuggestion\(suggestion\)\) return 'words';/);
  const firstWrite = decide.search(/\.from\('event_schedule_blocks'\)/);
  assert.ok(out > 0 && out < firstWrite, 'a suggestion in words can be applied by Approve all');
  assert.match(decide, /emitNotification\(/, 'an approved supplier is not told');
  const one = body(actions, 'resolveScheduleSuggestion');
  assert.match(one, /if \(formData\.get\('decision'\) === 'accept_all'\) return approveAllScheduleSuggestions\(formData\);/, 'Approve all is not reachable');
  assert.match(one, /decideSuggestion\(supabase, user\.id, eventId, suggestionId, decision\)/, 'one Approve left the shared path');
  assert.doesNotMatch(actions, /export async function approveAllScheduleSuggestions/, 'a new exported action — each is a Vercel route');
});

test('4 · it approves the ids that were shown, never whatever is open now', () => {
  const all = body(read('actions.ts'), 'approveAllScheduleSuggestions');
  assert.match(all, /formData\.getAll\('suggestion_id'\)/);
  assert.doesNotMatch(all, /\.from\('event_schedule_suggestions'\)/, 'Approve all reads the open list itself');
  assert.match(all, /refused > 0[\s\S]*?ok: false/, 'a refused change ends in the look of success');
});
