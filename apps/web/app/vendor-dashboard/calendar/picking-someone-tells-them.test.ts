/**
 * picking-someone-tells-them.test.ts — the waitlist pick must reach the person
 * it happened to, and their own view must show it.
 *
 * ── THE DEFECT THIS PINS ───────────────────────────────────────────────────
 * `pickWaitlistCouple` stamped `accepted_at` on one row and stopped. The shop
 * was shown "picked"; the couple learned nothing. Their own view of the
 * waitlist queried `status IN ('pending','notified')` and never read
 * `accepted_at` — and the pick writes `accepted_at` while leaving `status`
 * alone — so after being chosen they still read *"we'll email you the moment it
 * opens up."*
 *
 * 🔑 THE ASYMMETRY IS THE POINT, and it is what makes this easy to reintroduce.
 * THREE shipped paths already say "a slot opened" and email EVERY couple
 * waiting on a date. Somebody reading this area sees a well-notified feature.
 * The one event with no message is the one that is time-critical:
 * `max_waitlist_acceptances` lets the shop pick somebody else, so a couple who
 * is never told can lose a date that was being held for them.
 *
 * ⚠ A SOURCE SCAN, and deliberately. The action is a `'use server'` module that
 * pulls in Supabase, `server-only` transitively and a redirect that throws;
 * `lib/rpcs-have-callers.test.ts` and the admin-map guards use the same shape
 * for the same reason. What it can prove is that the wiring is still there —
 * which is exactly the thing that was missing.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE MATCHING. Every rule below is NAMED in a
 * docblock in the files it checks; a raw-source scan would find the words that
 * describe the defect and report the fix as the defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const ACTIONS = join(HERE, 'actions.ts');
const SHOP_PAGE = join(WEB, 'app', 'v', '[slug]', 'page.tsx');

/** A real stripper — a line-prefix filter leaves block-comment bodies behind. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'str' | 'tpl' = 'code';
  let quote = '';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; i += 2; continue; }
      if (two === '/*') { mode = 'block'; i += 2; continue; }
      if (src[i] === '"' || src[i] === "'") { mode = 'str'; quote = src[i]!; out += src[i]; i++; continue; }
      if (src[i] === '`') { mode = 'tpl'; out += src[i]; i++; continue; }
      out += src[i]; i++; continue;
    }
    if (mode === 'line') { if (src[i] === '\n') { mode = 'code'; out += '\n'; } i++; continue; }
    if (mode === 'block') { if (two === '*/') { mode = 'code'; i += 2; } else i++; continue; }
    if (mode === 'str') {
      if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === quote) mode = 'code';
      out += src[i]; i++; continue;
    }
    if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
    if (src[i] === '`') mode = 'code';
    out += src[i]; i++; continue;
  }
  return out;
}

const actions = stripComments(readFileSync(ACTIONS, 'utf8'));
const shopPage = stripComments(readFileSync(SHOP_PAGE, 'utf8'));

/** The `pickWaitlistCouple` body alone — a file-level match cannot say WHICH
 *  action notifies, and this file contains a second one that already did. */
function pickBody(): string {
  const start = actions.indexOf('export async function pickWaitlistCouple');
  assert.ok(start > 0, 'pickWaitlistCouple is gone from calendar/actions.ts');
  const next = actions.indexOf('\nexport async function ', start + 10);
  return actions.slice(start, next > 0 ? next : undefined);
}

test('the sources survive stripping — this guard can actually fail', () => {
  assert.ok(actions.length > 3_000, `actions stripped to ${actions.length} chars`);
  assert.ok(shopPage.length > 20_000, `shop page stripped to ${shopPage.length} chars`);
  assert.ok(pickBody().length > 400, 'the pick body did not survive stripping');
});

// ── 1 · THE PICK TELLS THE PERSON IT HAPPENED TO ──────────────────────────

test('pickWaitlistCouple emits a notification', () => {
  const body = pickBody();
  assert.ok(
    /emitNotification\(/.test(body),
    'the waitlist pick stopped telling the couple — it stamps a timestamp and nobody hears',
  );
  assert.ok(
    /type:\s*'waitlist_picked'/.test(body),
    "the pick no longer sends 'waitlist_picked' — a generic type files it beside profile notices and no email allowlist can separate them",
  );
});

test('it notifies the person who was PICKED, not the shop', () => {
  const body = pickBody();
  assert.ok(
    /\.select\('waitlist_id,\s*user_id'\)/.test(body),
    'the pick stopped reading user_id — there is nobody to notify without it',
  );
  assert.ok(
    /userId:\s*picked\.user_id/.test(body),
    'the notification is no longer addressed to the picked couple',
  );
});

test('the notice names the DATE — it does not make somebody open a page to find out', () => {
  const body = pickBody();
  assert.ok(
    /prettyWaitlistDate\(requestedDate\)/.test(body),
    'the date left the notice title',
  );
  // And the date is rendered in the venue's civil day, not UTC. `new Date` on a
  // bare DATE reads the day BEFORE anywhere west of Greenwich — the mistake this
  // repo has paid for across 41 screens.
  //
  // ⚠ SCOPED TO THE FORMATTER'S OWN BODY. A file-level match was DECORATION:
  // `actions.ts` carries a second `+08:00` (the schedule block's `blocked_at`),
  // so dropping the anchor here left 1 of 2 standing and the guard stayed green.
  // Measured by mutation, 2 → 1. *A file-level count cannot say which site.*
  const formatter = (() => {
    const start = actions.indexOf('function prettyWaitlistDate');
    assert.ok(start > 0, 'prettyWaitlistDate is gone — the notice has no date formatter');
    const next = actions.indexOf('\nfunction ', start + 10);
    const end = actions.indexOf('\nexport ', start + 10);
    const stop = [next, end].filter((n) => n > 0).sort((a, b) => a - b)[0];
    return actions.slice(start, stop ?? undefined);
  })();
  assert.match(
    formatter,
    /T00:00:00\+08:00/,
    'the waitlist date is formatted without the +08:00 anchor — it will read a day early',
  );
});

test('the notify is best-effort and REPORTED, never silently swallowed', () => {
  const body = pickBody();
  // A notifier that threw would roll a real decision back over a message; one
  // that swallows is how the silence came back.
  assert.ok(/catch\s*\(e\)/.test(body), 'the notify has no error arm at all');
  assert.ok(
    /console\.error\(\s*'\[waitlist\] pick notify failed/.test(body),
    'a failed pick notification is now discarded silently',
  );
});

test('the notify runs AFTER the write, so a message cannot undo a decision', () => {
  const body = pickBody();
  const write = body.indexOf(".update({ accepted_at");
  const notify = body.indexOf('emitNotification(');
  assert.ok(write > 0 && notify > 0, 'the write or the notify is gone');
  assert.ok(notify > write, 'the notification moved ahead of the write it reports');
});

// ── 2 · AND THEIR OWN VIEW SHOWS IT ───────────────────────────────────────

test('the couple’s waitlist read looks at accepted_at', () => {
  // 🔴 THE HALF THAT MADE THE SILENCE INVISIBLE. The pick writes `accepted_at`
  // and leaves `status` alone, so a query filtered on status alone could never
  // move — a chosen couple read the same words as one still waiting.
  assert.ok(
    /\.select\('waitlist_id,\s*accepted_at'\)/.test(shopPage),
    'the couple’s waitlist read stopped selecting accepted_at — being picked is invisible to them again',
  );
  assert.ok(
    /waitlistPicked\s*=/.test(shopPage),
    'the picked state is no longer derived on the couple’s side',
  );
});

test('the picked state is rendered, and BEFORE the still-waiting one', () => {
  const picked = shopPage.indexOf('waitlistPicked ?');
  const waiting = shopPage.indexOf("alreadyWaitlisted || waitlistNotice === 'joined'");
  assert.ok(picked > 0, 'the picked branch is not rendered');
  assert.ok(waiting > 0, 'the still-waiting branch vanished');
  assert.ok(
    picked < waiting,
    'the still-waiting branch now shadows the picked one — a chosen couple would read "we’ll email you" again',
  );
});

test('it says the date is HELD, never that it is theirs', () => {
  // The shop may pick more than one couple (max_waitlist_acceptances) and
  // nothing here books anything. Promising more than "held" is a promise the
  // product cannot keep.
  assert.ok(
    /has kept this date for you/.test(shopPage),
    'the picked copy changed — check it still promises only a hold',
  );
  assert.ok(
    !/(is yours|reserved for you|booked for you)/i.test(shopPage),
    'the picked copy now promises a booking the pick does not make',
  );
});
