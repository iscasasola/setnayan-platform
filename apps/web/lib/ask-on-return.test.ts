/**
 * ask-on-return.test.ts — 🔒 "DID YOU SEND IT?" IS ASKED ONLY WHEN THE HOST LEFT TO SEND AND CAME BACK.
 *
 * Owner 2026-10-27 (DECISION_LOG "AFTER INVITE OPENS ANOTHER APP, ASK ON RETURN: \"SENT\" OR \"NOT YET\"").
 *
 *   · The pure step (`askOnReturnStep`): arm → hidden → visible asks ONCE; no leave, no question; a stale arm asks
 *     nothing; settle clears.
 *   · Both send surfaces — `SendInviteActions` (guest card + one-by-one run) and `GuestInviteCell` (the list's Invite) —
 *     arm after an app opens and after a copy, draw the ONE question (`SentOrNotYet`), and answer Sent through their
 *     own `mark(true)` (the one writer) — never a second write path.
 *   · The phone's share sheet does NOT arm: it already stamps Sent ✓ when an app took the message.
 *
 * Sabotage (2026-10-27, each reverted): `visible` asks without a leave → red · the TTL check dropped → red · the arm
 * removed from Send invite's `viaApp` → red · the cell's Sent wired to a fresh server call → red · the share path
 * armed → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { ARM_TTL_MS, RETURN_IDLE, askOnReturnStep, type ReturnEvent, type ReturnState } from './ask-on-return';

function run(events: Array<[ReturnEvent['kind'], number]>): boolean[] {
  let s: ReturnState = RETURN_IDLE;
  return events.map(([kind, at]) => {
    const r = askOnReturnStep(s, { kind } as ReturnEvent, at);
    s = r.state;
    return r.ask;
  });
}

test('left to send and came back → asked once', () => {
  assert.deepEqual(run([['arm', 0], ['hidden', 1_000], ['visible', 30_000], ['hidden', 40_000], ['visible', 50_000]]), [
    false,
    false,
    true,
    false,
    false,
  ]);
});

test('never left → never asked (a copy that stayed on the page)', () => {
  assert.deepEqual(run([['arm', 0], ['visible', 5_000]]), [false, false]);
});

test('a stale arm asks nothing — a later, unrelated app switch is not a send', () => {
  assert.deepEqual(run([['arm', 0], ['hidden', ARM_TTL_MS + 1], ['visible', ARM_TTL_MS + 10_000]]), [false, false, false]);
});

test('settle clears a pending question', () => {
  assert.deepEqual(run([['arm', 0], ['settle', 100], ['hidden', 200], ['visible', 300]]), [false, false, false, false]);
});

test('nothing armed → nothing asked', () => {
  assert.deepEqual(run([['hidden', 0], ['visible', 100]]), [false, false]);
});

const HERE = dirname(fileURLToPath(import.meta.url));
const GUESTS = join(HERE, '..', 'app', 'dashboard', '[eventId]', 'guests', '_components');
const SEND = stripComments(readFileSync(join(GUESTS, 'send-invite.tsx'), 'utf8'));
const CELL = stripComments(readFileSync(join(GUESTS, 'guest-invite-cell.tsx'), 'utf8'));

/** The body of `name` up to the next top-level-in-component function. */
function fnBody(src: string, head: string): string {
  const at = src.indexOf(head);
  assert.ok(at > -1, `${head} not found`);
  const next = src.indexOf('\n  }\n', at);
  return src.slice(at, next);
}

for (const [label, src, appFn, copyFns, shareFn] of [
  ['SendInviteActions', SEND, 'async function viaApp(', ['async function copyText('], 'async function send('],
  ['GuestInviteCell', CELL, 'async function viaApp(', ['async function copyMessage(', 'async function copyLink('], 'async function share('],
] as const) {
  test(`${label}: an app or a copy arms the question; the share sheet does not`, () => {
    assert.match(fnBody(src, appFn), /back\.arm\(\)/, `${label}: opening an app does not ask on return`);
    for (const f of copyFns) assert.match(fnBody(src, f), /back\.arm\(\)/, `${label}: ${f} does not ask on return`);
    assert.doesNotMatch(fnBody(src, shareFn), /back\.arm\(\)/, `${label}: the share sheet asks although it already stamps`);
  });

  test(`${label}: one question, answered through the one writer`, () => {
    assert.match(src, /const back = useAskOnReturn\(\);/);
    const sheet = src.slice(src.indexOf('<SentOrNotYet'), src.indexOf('/>', src.indexOf('<SentOrNotYet')));
    assert.match(sheet, /open=\{back\.asking && !sentAt\}/, `${label}: asks about a guest already marked sent`);
    assert.match(sheet, /back\.settle\(\);\s*mark\(true\);/, `${label}: Sent does not go through mark(true)`);
    assert.match(sheet, /onNotYet=\{back\.settle\}/, `${label}: Not yet does more than close`);
  });
}
