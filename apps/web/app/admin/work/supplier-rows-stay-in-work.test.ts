/**
 * supplier-rows-stay-in-work.test.ts — the three promises of Admin › Work's supplier section (admin supplier slice,
 * owner 2026-10-28: "done in its row (no jumping)"):
 *
 *   1. AN ACTION IN WORK NEVER NAVIGATES AWAY — every form the section draws carries `back` / `return_to`, and every
 *      action it posts to sends a Work-posted press back to Work (never to its own page).
 *   2. A DECLINE / NEEDS-A-FIX WITHOUT A REASON IS REFUSED — the refusal sits BEFORE the write, in each action.
 *   3. ONLY ADMINS REACH THESE ACTIONS — each one's first statement is the admin gate; the new table writes only
 *      through is_admin().
 *
 * The reason RULE itself is called in lib/admin/supplier-work.test.ts; this file pins that each action is wired to
 * it, per action (a file-level match cannot say which action still does the thing).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (s: string) => stripComments(s);

/** The body of `[export] async function <name>(` up to the next top-level `\n}`. */
function bodyOf(src: string, name: string): string {
  const m = new RegExp(`(?:export )?async function ${name}\\(`).exec(src);
  assert.ok(m, `${name} is missing`);
  const end = src.indexOf('\n}', m.index);
  assert.ok(end > m.index, `${name} has no end`);
  return src.slice(m.index, end);
}

const INBOX = code(read('app/admin/work/_components/supplier-inbox.tsx'));
const VERIFY = code(read('app/admin/verify/actions.ts'));
const WORK = code(read('app/admin/work/actions.ts'));
const REPOST = code(read('app/admin/repost-watch/actions.ts'));
const CATS = code(read('app/admin/categories/actions.ts'));
const HELP = code(read('app/admin/help/actions.ts'));
const SCOPE = code(read('app/admin/categories/event-type-actions.ts'));

/** Every action the section posts to, with the file that holds it. */
const POSTED: ReadonlyArray<[string, string]> = [
  ['settleVerificationFromWorkList', VERIFY],
  ['settleCorrectionFromWorkList', WORK],
  ['resolveRepostFlag', REPOST],
  ['createEventTypeRoster', CATS],
  ['setEventTypeStatus', CATS],
  ['setFolderEventTypeOffered', SCOPE],
  ['settleHelpFromWorkList', WORK],
];

test('1 · every form the section draws comes back to Work (back / return_to), bar the one that opens a file', () => {
  const forms = INBOX.match(/<form\b[\s\S]*?<\/form>|<form\b[^>]*\/>/g) ?? [];
  assert.ok(forms.length >= 10, `found ${forms.length} forms — the scan is not reading the section`);
  for (const f of forms) {
    if (/action=\{openApplicationDocument\}/.test(f)) continue; // opens the paper itself — a file, not a decision
    assert.match(f, /name="(back|return_to)"/, `a Work form posts no way back — it would leave Work:\n${f.slice(0, 160)}`);
  }
  // Every action the forms name is one this guard follows below — a new action cannot slip in unfollowed.
  const named = new Set([...INBOX.matchAll(/action=\{(\w+)\}/g)].map((m) => m[1]!));
  named.delete('openApplicationDocument');
  assert.deepEqual([...named].sort(), POSTED.map(([n]) => n).sort());
});

test('1 · each posted action answers a Work press ON Work', () => {
  assert.match(bodyOf(VERIFY, 'settleVerificationFromWorkList'), /redirect\(workBackHref\(back,/);
  assert.doesNotMatch(bodyOf(VERIFY, 'settleVerificationFromWorkList'), /redirect\(['`]\/admin\/verify/);
  assert.match(bodyOf(REPOST, 'resolveRepostFlag'), /if \(fromWork\) \{[\s\S]*redirect\(workBackHref\(back,/);
  // Categories: the shared redirect honours a Work return BEFORE it builds the categories address.
  const rb = CATS.slice(CATS.indexOf('function redirectBack('), CATS.indexOf('function workReturnTo('));
  const ret = rb.indexOf('if (returnTo) redirect(workBackHref(');
  assert.ok(ret > 0 && ret < rb.indexOf('redirect(backHref('), 'redirectBack no longer returns a Work press to Work');
  const sr = SCOPE.slice(SCOPE.indexOf('function scopedRedirect('), SCOPE.indexOf('function scopedRedirect(') + 600);
  assert.ok(sr.indexOf('if (returnTo) redirect(workBackHref(') > 0 && sr.indexOf('if (returnTo) redirect(workBackHref(') < sr.indexOf('redirect(backHref('), 'Scope categories no longer returns a Work press to Work');
  assert.match(bodyOf(WORK, 'settleViaRedirectingAction'), /redirect\(workBackHref\(back, outcome\)\)/);
});

test('2 · a decline / needs-a-fix without a reason from the list is refused BEFORE anything is written', () => {
  const v = bodyOf(VERIFY, 'settleVerificationFromWorkList');
  assert.ok(v.indexOf("pickedReason('docs'") > 0 && v.indexOf("pickedReason('docs'") < v.indexOf('applyApplicationDecision('));
  assert.match(v, /decision === 'needs_fix' && !reason\)\s*\{\s*redirect\(workBackHref\(back, 'refused'/);

  const c = bodyOf(WORK, 'settleCorrectionFromWorkList');
  const refuse = c.indexOf("decision === 'decline' && !pickedReason('names'");
  assert.ok(refuse > 0 && refuse < c.indexOf('settleViaRedirectingAction('), 'the correction decline no longer refuses first');

  const r = bodyOf(REPOST, 'resolveRepostFlag');
  const refuseCard = r.indexOf("fromWork && action === 'confirm_theft' && !reason");
  assert.ok(refuseCard > 0 && refuseCard < r.indexOf(".from('vendor_image_flags')"), 'a card sent back without a reason is written');
});

test('3 · only admins reach these actions: the gate is each one’s first statement', () => {
  const gated: ReadonlyArray<[string, string]> = [...POSTED, ['setCategoryHubTools', CATS], ['setHelpMessageStatus', HELP]];
  for (const [name, src] of gated) {
    const b = bodyOf(src, name);
    const first = b.slice(b.indexOf('{') + 1).trim().split('\n')[0]!;
    assert.match(first, /await requireAdmin\(\)/, `${name} does not start with the admin gate: ${first}`);
  }
  // The decision engine the badge rides is not a route of its own (it has no gate).
  assert.doesNotMatch(VERIFY, /export async function applyApplicationDecision/);
});

test('3 · the new tables are written only through is_admin(); the reason column is bounded', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_admin_supplier_slice.sql'));
  assert.ok(file, 'the slice migration is missing');
  const sql = readFileSync(join(dir, file!), 'utf8');
  for (const t of ['hub_tools', 'category_hub_tool_switches', 'category_hub_settings']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`), `${t} has no RLS at CREATE`);
  }
  assert.match(sql, /ARRAY\['hub_tools', 'category_hub_tool_switches', 'category_hub_settings'\]/);
  assert.match(sql, /FOR ALL TO authenticated USING \(\(SELECT public\.is_admin\(\)\)\) WITH CHECK \(\(SELECT public\.is_admin\(\)\)\)/);
  assert.match(sql, /FOR SELECT TO authenticated USING \(true\)/);
  // A tool is a record with one of the eight templates — never a free name.
  assert.match(sql, /template IN\s*\('checklist', 'per_person', 'live_timeline', 'counter', 'ordered_list', 'plan', 'media', 'log'\)/);
  assert.match(sql, /REFERENCES public\.hub_tools\(tool_key\) ON DELETE RESTRICT/);
  assert.match(sql, /decline_reason IS NULL OR char_length\(decline_reason\) BETWEEN 1 AND 300/);
});
