/**
 * the-invitation-says-who-it-cannot-reach.test.ts — CTRL-B4 builds 1 & 3.
 *
 * Two silences on the couple's invitation screen:
 *   · marking 146 guests was 146 individual toggles, so nobody finished and the
 *     Invite step could never complete (production: 0 of 146 marked);
 *   · the screen reported only what was MARKED, never that 141 of those guests
 *     have no email and no mobile and therefore cannot be sent anything at all.
 *
 * 🛡 Mutation-checked — all sabotages confirmed RED, each verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const ACTIONS = 'app/dashboard/[eventId]/invitation/actions.ts';
const PAGE = 'app/dashboard/[eventId]/invitation/page.tsx';

function bulkBody(): string {
  const src = readCode(ACTIONS);
  const start = src.indexOf('export async function markGuestsInvitationSent');
  assert.ok(start > 0, 'markGuestsInvitationSent not found — this guard is pointed at nothing');
  const next = src.indexOf('\nexport ', start + 10);
  const body = src.slice(start, next > 0 ? next : undefined);
  assert.ok(body.length > 400, `window collapsed to ${body.length} chars — a guard that cannot see the body cannot fail`);
  return body;
}

// SABOTAGE: report ids.length instead of data.length → RED.
test('the count the couple is shown is the count that was WRITTEN', () => {
  const body = bulkBody();
  assert.match(
    body,
    /\.select\('guest_id'\)/,
    'a zero-row UPDATE is success-shaped — without the rows back this claims a write that never happened',
  );
  assert.match(
    body,
    /n=\$\{data\.length\}/,
    'echoing the REQUESTED count tells a couple that 143 people were recorded who were not — a partial write is a real outcome',
  );
  assert.equal(
    count(body, /n=\$\{ids\.length\}/),
    0,
    'the requested count must never reach the screen',
  );
});

// SABOTAGE: drop the event_id scope → RED (a guest id from another event would write).
test('the bulk write is scoped to this event, like the single writer', () => {
  const body = bulkBody();
  assert.match(body, /\.eq\('event_id', eventId\)/, 'the batch must not be able to write another event\'s guests');
  assert.match(body, /\.in\('guest_id', ids\)/, 'the batch is the single writer with .in() — not a second writer');
  assert.match(body, /new Set\(/, 'a double-submitted checkbox must not make the requested and written counts disagree for a non-database reason');
});

// SABOTAGE: return silently instead of redirecting on error → RED.
test('a refused batch says so — it is not the 74th silent write', () => {
  const body = bulkBody();
  assert.match(
    body,
    /invite=failed/,
    '73 couple-dashboard reads already swallow their errors; a refused batch that leaves the screen unchanged and silent is the 74th',
  );
});

// SABOTAGE: delete the unreachable line from the page → RED.
// SABOTAGE: move it far from the marked count → RED.
test('the unreachable count is rendered WITH the marked count, not instead of it', () => {
  const page = readCode(PAGE);
  assert.match(page, /unreachableSentence\(invitationReach\(guests\)\)/, 'the page must compute it from the one pure module');
  assert.equal(count(page, /\{unreachableLine\}/), 1, 'rendered exactly once');
  const u = page.indexOf('{unreachableLine}');
  const m = page.indexOf('invitationsMarked === 0');
  assert.ok(u > 0 && m > 0, 'both numbers must be on this page');
  assert.ok(
    Math.abs(m - u) < 1200,
    `the two numbers are ${Math.abs(m - u)} chars apart — they must be read together, or a couple sees "3 marked" with no hint that 141 people cannot be reached at all`,
  );
});
