/**
 * the-cards-tab-decides-through-one-door — Integrity watch › Cards (service card checks, owner 2026-10-26).
 *
 * Properties of the source, anchored on symbols:
 *   · a card goes live ONLY through `approve_service_card()` — no verdict flips `is_active` itself;
 *   · bulk approve re-checks words-only on the server, never trusting the tick box;
 *   · every verdict writes an audit row and tells the supplier with `service_card_check` — in the app, no email;
 *   · the older Dismiss cannot close a card's hold;
 *   · the tab's choices are dropdowns (LinkPickMenu), not a pill row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = join(process.cwd(), 'app', 'admin', 'integrity-watch');
const actions = stripComments(readFileSync(join(HERE, 'card-actions.ts'), 'utf8'));
const shared = stripComments(readFileSync(join(HERE, 'actions.ts'), 'utf8'));
const tab = stripComments(readFileSync(join(HERE, '_cards', 'cards-tab.tsx'), 'utf8'));

function fn(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = src.indexOf('\nexport async function ', start + 10);
  const nextLocal = src.indexOf('\nasync function ', start + 10);
  const ends = [next, nextLocal].filter((n) => n > 0);
  return src.slice(start, ends.length ? Math.min(...ends) : undefined);
}

test('no verdict writes is_active — the card goes live only through approve_service_card()', () => {
  assert.doesNotMatch(actions, /is_active/, 'a verdict flips is_active outside the one door');
  const approve = fn(actions, 'approveOne');
  assert.match(approve, /\.rpc\('approve_service_card'/);
});

test('bulk approve re-checks words-only on the server', () => {
  const bulk = fn(actions, 'bulkApproveServiceCards');
  assert.match(bulk, /isWordsOnly\(reasonsFromDetail\(flag\.detail\)\)/);
  assert.match(bulk, /approveOne\(/);
});

test('every verdict audits and tells the supplier in the app — never by email', () => {
  for (const name of ['approveOne', 'askToFixServiceCard', 'rejectServiceCard']) {
    const b = fn(actions, name);
    assert.match(b, /await audit\(/, `${name} writes no audit row`);
    assert.match(b, /await tellSupplier\(/, `${name} tells nobody`);
  }
  assert.match(actions, /type: 'service_card_check'/);
  assert.doesNotMatch(actions, /sendEmail|resend|EMAIL_ENABLED/i, 'a card verdict sends an email');
});

test('an unfinished check is checked again before Approve', () => {
  const approve = fn(actions, 'approveOne');
  const recheck = approve.indexOf('recheckStoredCard(');
  const rpc = approve.indexOf(".rpc('approve_service_card'");
  assert.ok(recheck > 0 && recheck < rpc, `recheck at ${recheck}, approve at ${rpc}`);
});

test('the old Dismiss cannot close a card', () => {
  assert.match(shared, /if \(kind === 'service_card'\) \{\s*throw new Error/);
});

test('the Cards tab’s choices are dropdowns', () => {
  const picks = [...tab.matchAll(/<LinkPickMenu/g)].length;
  assert.equal(picks, 2, `status + reason should be two dropdowns, found ${picks}`);
});
