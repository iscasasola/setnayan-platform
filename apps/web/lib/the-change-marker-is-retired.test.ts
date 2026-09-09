/**
 * the-change-marker-is-retired.test.ts — the fourth chat marker is CLOSED, not broken.
 *
 * ── What this exists to stop ────────────────────────────────────────────────
 * `chat_messages` carries four card markers — `proposal_id` · `appointment_id`
 * · `amendment_id` · `change_order_id` — and three of them render. Read cold,
 * the fourth looks like an unfinished job, and on 2026-09-09 it was written
 * down as one: *"MEASURED GAP: the `change_order_id` marker has NO card
 * renderer at all, so Decisions would silently omit changes today."*
 *
 * The first half is true. The second is an invented consequence, and this file
 * is the correction, made executable.
 *
 * 🔑 THE CARD IS NOT MISSING. IT WAS BUILT, THEN DELETED ON PURPOSE.
 * Commit `d3350b8e2` (2026-07-24), *"collapse negotiation money cards to ONE
 * 'Deal' (council verdict)"*, deleted `chat-change-order-card.tsx` (129 lines)
 * and its stream branch, on the owner's *"as simple as possible"*. Its own
 * message states the reasoning: **the bundled amendment is a superset, so
 * couples see ONE money card.** The chip that produced these
 * (`change-request-suggest-chip.tsx`) was deleted in the same sweep.
 *
 * ── Why Decisions cannot omit a change ──────────────────────────────────────
 * A filter can only omit what could be there. Nothing can put this marker on a
 * message: the ONLY writers of `chat_messages.change_order_id` are
 * `createChangeRequestFromChat` and `counterChangeRequestFromChat`, and NOTHING
 * IMPORTS EITHER (assertion 1). Production agrees — zero rows carry it — but
 * production is not the evidence here: prod holds 3 chat messages total and
 * zero rows on ALL FOUR markers, including the two that demonstrably work, so
 * emptiness cannot tell reachable from unused. The import count can.
 *
 * ⚠ A CHANGE ORDER IS A LIVE FEATURE — only its CHAT bridge is retired.
 * `vendor_change_orders` is written every day from the supplier workspace
 * (`raiseChangeOrder`, couple side) and the shop's client page
 * (`vendorRaiseChangeOrder`), and renders in `ChangeOrderTrail` (assertion 4).
 * Whoever reads assertion 1 and concludes "dead table, drop it" is wrong, so
 * assertion 4 is here to say so in the same breath.
 *
 * ── If the owner wants changes in chat after all ────────────────────────────
 * That reverses a council verdict, so it is a decision, not a build. This file
 * goes red the moment someone starts — which is the point: the reversal should
 * be deliberate and signed off, never a session quietly re-adding a second
 * money card beside Deal.
 *
 * 🛡 Every assertion is a COUNT, not a presence check, and runs on
 * comment-stripped source — a guard that matches its own explanation guards
 * nothing, and a renamed symbol must not pass vacuously.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const STREAM = join(WEB, 'app/_components/chat-message-stream.tsx');
const ACTIONS = join(WEB, 'app/_components/negotiation-actions.ts');
const WORKSPACE = join(WEB, 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');

/** Comment-stripped source of one file. */
function src(path: string): string {
  return stripComments(readFileSync(path, 'utf8'));
}

/** Count non-overlapping matches. */
function count(haystack: string, re: RegExp): number {
  return (haystack.match(re) ?? []).length;
}

/**
 * Every file under app/ + lib/ (excluding the declaring file and tests) whose
 * comment-stripped source names `symbol`. `git grep -l` is a fixed-string scan
 * over tracked files — no `\b` (git grep -E cannot match one), no globbing of
 * bracketed route dirs, and it cannot silently return a false zero the way a
 * hand-rolled walk over `[eventId]` paths does.
 */
function importersOf(symbol: string, declaredIn: string): string[] {
  let out = '';
  try {
    out = execFileSync(
      'git',
      ['grep', '-l', '--fixed-strings', symbol, '--', 'apps/web/app', 'apps/web/lib'],
      { cwd: join(WEB, '../..'), encoding: 'utf8' },
    );
  } catch {
    // git grep exits 1 with no output when nothing matches — that is a real zero.
    return [];
  }
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !p.endsWith(declaredIn))
    .filter((p) => !p.includes('.test.'))
    .filter((p) => count(src(join(WEB, '../..', p)), new RegExp(symbol, 'g')) > 0);
}

test('the two writers of chat_messages.change_order_id have NO caller', () => {
  // Guard the guard: the symbols must still exist where we think they do, or
  // "zero importers" would pass for a renamed function that is fully wired.
  const actions = src(ACTIONS);
  for (const fn of ['createChangeRequestFromChat', 'counterChangeRequestFromChat']) {
    assert.equal(
      count(actions, new RegExp(`export async function ${fn}\\b`, 'g')),
      1,
      `${fn} is no longer declared in negotiation-actions.ts — this guard is now blind. ` +
        `Re-anchor it on the new name before changing anything else.`,
    );
  }

  // insertChangeRequest is the single function that writes the marker. If a
  // second writer appears, the reachability argument above stops holding.
  //
  // The lookbehind is load-bearing and was paid for: without it this matched 3,
  // because `p_change_order_id: changeOrderId` — the RPC parameter on the
  // accept/decline calls — CONTAINS the column assignment as a substring. Two
  // of those three are reads, not writes.
  assert.equal(
    count(actions, /(?<!p_)change_order_id: changeOrderId/g),
    1,
    'A second writer of chat_messages.change_order_id appeared. The "no producer" ' +
      'argument in this file only covers insertChangeRequest — re-measure it.',
  );

  for (const fn of ['createChangeRequestFromChat', 'counterChangeRequestFromChat']) {
    const callers = importersOf(fn, 'negotiation-actions.ts');
    assert.deepEqual(
      callers,
      [],
      `${fn} now has ${callers.length} caller(s): ${callers.join(', ')}.\n` +
        'That un-retires the in-chat change order, which commit d3350b8e2 (2026-07-24, ' +
        'council verdict "as simple as possible") deleted because the bundled Deal is a ' +
        'superset. It also puts a SECOND money card beside Deal in the thread.\n' +
        'This is an owner decision, not a build. Get sign-off, then update this file.',
    );
  }
});

test('the chat stream has no renderer for change_order_id — only negative guards', () => {
  const stream = src(STREAM);

  const all = count(stream, /change_order_id/g);
  const negated = count(stream, /!\s*m\.change_order_id/g);

  // > 0 keeps a rename from passing vacuously: if the column were renamed and
  // both counts fell to 0, equality alone would still hold.
  assert.ok(
    negated > 0,
    'change_order_id no longer appears as a negative guard in chat-message-stream.tsx. ' +
      'Either the column was renamed (re-anchor this guard) or the guards were dropped.',
  );
  assert.equal(
    all,
    negated,
    `chat-message-stream.tsx mentions change_order_id ${all} times but only ${negated} are ` +
      'negative guards, so something now READS the marker to render it. See the note above: ' +
      'the card was deleted deliberately on 2026-07-24, not left unfinished.',
  );
});

test('Deal — the superset that replaced it — is still reachable and still mounted', () => {
  // The retirement is only defensible while its successor works. If Deal ever
  // goes away, "changes are covered by Deal" stops being true and this whole
  // file needs re-reading rather than trusting.
  const stream = src(STREAM);
  assert.ok(
    count(stream, /<ChatAmendmentCard\b/g) >= 1,
    'ChatAmendmentCard is no longer mounted in the chat stream. Deal is the card that ' +
      'replaced the change-order card; without it the thread has NO money card at all.',
  );
  assert.ok(
    importersOf('createAmendmentFromChat', 'negotiation-actions.ts').length >= 1,
    'Nothing can raise a Deal any more — createAmendmentFromChat lost its callers. The ' +
      'in-chat change order was retired in its favour; re-open that decision before shipping.',
  );
});

test('a change order is still a LIVE feature outside chat — do not drop the table', () => {
  // Assertions 1-2 say the CHAT bridge is closed. Read alone they invite the
  // wrong cleanup. vendor_change_orders is written from two live surfaces and
  // settles real money into the budget ledger on accept.
  assert.ok(
    count(src(WORKSPACE), /<ChangeOrderTrail\b/g) >= 1,
    'ChangeOrderTrail is no longer mounted in the supplier workspace. Change orders are ' +
      'raised there today (raiseChangeOrder) and settle into event_vendor_line_items on ' +
      'accept — only their CHAT card was retired, never the feature.',
  );
});
