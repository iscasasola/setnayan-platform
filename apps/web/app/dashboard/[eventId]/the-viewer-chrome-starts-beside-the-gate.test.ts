import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * THE VIEWER'S CHROME READS START BESIDE THE MEMBERSHIP GATE (walkthrough 28 Nov 2026: event home ~1.2 s to first
 * byte, Guests ~0.8 s — both behind this layout).
 *
 * The layout's await chain was: membership → the one wait (chrome + event row → profile) → the logo gate. The chrome
 * reads (bell, switcher, unread messages, locale, rail account, search index, referral toggle, nav registry, store
 * shell) name no event, so they now start BEFORE the membership trip and run beside it; the logo gate is chained off
 * the event read inside the one wait instead of being awaited after it.
 *
 * The failure is an absence with no symptom — move a read back below the gate, or await the logo on its own again,
 * and every page renders the same, one trip later. So this checks the source:
 *   1. each chrome read is STARTED (not awaited) before the membership await;
 *   2. nothing that names this event starts before the gate (the event row, the guest count, the co-host notice,
 *      the logo gate) — the gate's own order guard is `the-notice-follows-the-payer.test.ts`;
 *   3. the logo gate rides the event read and is not awaited before the one wait.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const layout = stripComments(readFileSync(join(HERE, 'layout.tsx'), 'utf8'));

const gateAt = layout.indexOf('await eventMemberTypeOnce(supabase, eventId, user.id)');
const waitAt = layout.indexOf('] = await Promise.all([');
const beforeGate = layout.slice(0, gateAt);

test('anchors: the gate and the one wait are where this guard looks', () => {
  assert.ok(gateAt > 0, 're-anchor — the membership await moved');
  assert.ok(waitAt > gateAt, 're-anchor — the one wait moved');
});

test('1 · the chrome reads start before the membership trip, unawaited', () => {
  for (const started of [
    /const shellRead = getDashboardShell\(user\.id\);/,
    /void resolveRailAccount\(\)\.catch\(/,
    /void resolveCommandItems\(\)\.catch\(/,
    /const unreadMessagesRead = countUnreadMessages\(supabase, user\.id\)\.catch\(/,
    /const localeRead = Promise\.resolve\(getLocale\(\)\)/,
    /const switcherDataRead = getSwitcherData\(user\.id\)\.catch\(/,
    /const referralEnabledRead = isReferralProgramEnabled\(\);/,
    /const navSlotsRead = getNavSlotMap\(\);/,
    /const storeShellRead = isStoreShellRequest\(\);/,
  ]) {
    assert.match(beforeGate, started, `${started} no longer starts beside the gate — it waits a trip for membership`);
  }
  assert.doesNotMatch(
    beforeGate.slice(beforeGate.indexOf('const shellRead')),
    /await\s+(?:getDashboardShell|getSwitcherData|countUnreadMessages|isReferralProgramEnabled|getNavSlotMap|isStoreShellRequest|resolveRailAccount|resolveCommandItems)\b/,
    'a chrome read is awaited before the gate — the wait it was moved to save is back',
  );
});

test('2 · nothing that names this event starts before the gate', () => {
  for (const eventRead of [/from\('events'\)/, /openDashboardEventRow\(/, /countGuestsByEvent\(/, /cohostWelcomeNotice\(/, /logoPlaysFor\(/]) {
    assert.doesNotMatch(beforeGate, eventRead, `${eventRead} runs before a non-member is refused`);
  }
});

test('3 · the logo gate rides the event read, inside the one wait', () => {
  const chained = layout.indexOf('const railMarkPlaysRead = eventRead');
  assert.ok(chained > gateAt && chained < waitAt, 'the logo gate is not chained off the event read before the one wait');
  assert.match(layout.slice(chained, waitAt), /logoPlaysFor\(/);
  assert.match(layout, /const railMarkPlays = await railMarkPlaysRead;/);
  assert.equal(layout.match(/await logoPlaysFor\(/g)?.length ?? 0, 0, 'the logo gate is awaited on its own again — a trip in a row');
});
