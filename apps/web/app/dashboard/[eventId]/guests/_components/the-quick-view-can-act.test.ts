/**
 * the-quick-view-can-act.test.ts — the guest card can delete its guest.
 *
 * ── HISTORY ────────────────────────────────────────────────────────────────
 * The card once could only be READ; on 2026-09-06 it gained a "Remove guest"
 * behind a second tap, posting `softDeleteGuest` — a second remove path that
 * kept the "reset their RSVP first" rule and had no Undo.
 *
 * ── RE-ANCHORED 2026-10-03 ─────────────────────────────────────────────────
 * Owner, after the live iPhone test where an accepted guest's delete was
 * silently refused (DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
 * ACCEPTED"): *"add a way to delete someone even if they accepted … add delete
 * function on the guest card and when we select guests"*. So:
 *   · Delete is in the card's ⋯ (`GuestMoreMenu`, `deletable`), never for the
 *     couple, who keep their sentence instead of a button that always fails;
 *   · the first tap only opens the in-page warning (`DeleteGuestFlow` →
 *     `DeleteGuestSheet`) — Delete there is the second, deliberate tap;
 *   · it is the SAME delete as the swipe and the selection bar
 *     (`useGuestRemoval` → `bulkSoftDeleteGuestsForUndo`, with Undo), and the
 *     old path (`softDeleteGuest`, `RemoveGuestConfirm`) no longer exists;
 *   · no RSVP gate anywhere — not re-spelled in the UI, not kept in the action.
 *
 * 🛡 Sabotaged (see the PR): dropping `deletable={!isCouple}` from the card → RED.
 *
 * ── RE-ANCHORED 2026-10-23 ─────────────────────────────────────────────────
 * Owner's groups for the card (prototype `guest_card_groups_and_papic_2026-10-23.html`): Delete LEFT the ⋯ and is the card's
 * own last group (`GuestDeleteControl`, handed in as `DeleteControl`) — moved, not re-made: the same warning, the same flow,
 * the same Undo. Never for the couple, who keep their sentence in that group instead.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const BODY = read('guest-card-body.tsx');
const DATA = read('guest-card-data.ts');
const MENU = read('guest-ticket-parts.tsx');
const DELETE = read('guest-delete.tsx');
const DETAIL = stripComments(readFileSync(resolve(HERE, '..', '[guestId]', 'page.tsx'), 'utf8'));
const GUEST_ACTIONS = stripComments(readFileSync(resolve(HERE, '..', '[guestId]', 'actions.ts'), 'utf8'));
const GROUP_ACTIONS = stripComments(readFileSync(resolve(HERE, '..', 'groups-actions.ts'), 'utf8'));

test('the card can delete its guest — from its own Delete group, never for the couple', () => {
  const group = BODY.slice(BODY.indexOf('<K.Fold summary="Delete"'));
  assert.ok(group.length > 0 && BODY.indexOf('<K.Fold summary="Delete"') > 0, 'the card has no Delete group');
  assert.match(BODY, /\{isCouple \? \(\s*<K\.Fold summary="Delete"[^>]*>\s*<p[^>]*>Foundation of the event[\s\S]*?\) : DeleteControl \? \(\s*<K\.Fold summary="Delete"[\s\S]*?<DeleteControl\b/, 'the Delete group offers Delete to the couple (or none to a guest)');
  assert.match(MENU, /<span data-guest-delete="">\s*<ActionButton tone="danger" icon=\{Trash2\} label="Delete guest" onClick=\{\(\) => setConfirmDelete\(true\)\} \/>/, 'the Delete group has no Delete guest button');
  // THE card hands in its Delete for every surface (2026-10-24, one card everywhere).
  assert.match(stripComments(readFileSync(resolve(HERE, 'guest-card.tsx'), 'utf8')), /DeleteControl=\{GuestDeleteControl\}/, 'the card is drawn without its Delete');
  assert.match(MENU, /<DeleteGuestFlow\b/, 'the card’s Delete does not go through the one delete flow');
  /* …and the ⋯ no longer carries it (one Delete on the card, not two). */
  const more = MENU.slice(MENU.indexOf('export function GuestMoreMenu('), MENU.indexOf('export function GuestDeleteControl('));
  assert.doesNotMatch(more, /data-guest-delete=""|DeleteGuestFlow/, 'the ⋯ still offers Delete too');
});

test('the first tap only WARNS — Delete is the second, deliberate tap', () => {
  const item = MENU.slice(MENU.indexOf('data-guest-delete=""') - 400, MENU.indexOf('data-guest-delete=""') + 200);
  assert.match(item, /setConfirmDelete\(true\)/, 'the ⋯ item no longer opens the warning');
  assert.doesNotMatch(item, /remove\(/, 'the ⋯ item deletes on its first tap');
  assert.match(DELETE, /data-guest-delete-confirm=""/, 'the warning has no Delete button');
  assert.doesNotMatch(DELETE, /window\.confirm\(|\bconfirm\(\s*['"`]/, 'a browser confirm() — the owner asked for an in-page warning');
});

test('there is ONE delete path — the old card remove is gone', () => {
  assert.equal(existsSync(join(HERE, 'remove-guest-confirm.tsx')), false, 'RemoveGuestConfirm is back');
  assert.doesNotMatch(GUEST_ACTIONS, /export async function softDeleteGuest\s*\(/, 'softDeleteGuest is back — a second delete with no Undo');
  assert.match(DELETE, /bulkSoftDeleteGuestsForUndo\(/);
  assert.match(DETAIL, /<GuestCard\b/, 'the standalone route no longer renders the same card');
});

test('the couple gets the sentence, not a button that always fails', () => {
  assert.ok(/const isCouple = guest\.role === 'bride' \|\| guest\.role === 'groom';/.test(DATA));
  assert.ok(/Foundation of the event/.test(BODY), 'the couple is no longer told why they cannot be removed');
});

test('the RSVP gate is retired — not re-spelled in the UI, not kept in the action', () => {
  for (const [label, src] of [['card', BODY], ['delete flow', DELETE], ['⋯', MENU]] as const) {
    assert.doesNotMatch(src, /rsvp_status !== 'pending'/, `the ${label} re-implements the retired RSVP gate`);
  }
  const at = GROUP_ACTIONS.indexOf('export async function bulkSoftDeleteGuestsForUndo(');
  const fn = GROUP_ACTIONS.slice(at, GROUP_ACTIONS.indexOf('export async function restoreDeletedGuests(', at));
  assert.doesNotMatch(fn, /rsvp_status !== 'pending'|Reset their RSVP/, 'the delete still refuses a guest who replied');
  assert.match(fn, /role === 'bride' \|\| r\.role === 'groom'/, 'the couple gate is gone from the action');
});
