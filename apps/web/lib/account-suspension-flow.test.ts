/**
 * ⏸ A SUSPENDED PERSON CANNOT SIGN IN — and an unsuspended one can again. Runs the REAL suspend / lift sequence
 * (lib/account-suspension-flow.ts) against a fake GoTrue + database, because the sign-in refusal is GoTrue's own
 * (`banned_until`) and no db test can reach it. The database half (the person's row and their shops) is proven in
 * tests/db/account-suspend.db.test.ts.
 *
 * Owner 2026-11-13, "Yes, add both" (DECISION_LOG "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN CONTENTS").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  finishLiftWith,
  liftSuspensionWith,
  suspendAccountWith,
  type SuspensionIo,
} from './account-suspension-flow';
import { BAN_LIFTED, SUSPENDED_SIGN_IN, UNTIL_LIFTED_BAN_HOURS } from './account-suspension';
import { explainFailedSignIn } from './sign-in-door';

/** A tiny GoTrue: a ban stores banned_until; sign-in is refused while it lies in the future — GoTrue's rule. */
function fakeWorld(opts: { banFails?: boolean; suspendRefusal?: string } = {}) {
  const now = new Date('2026-11-13T02:00:00Z');
  let bannedUntil: Date | null = null;
  let dbSuspended = false;
  const calls: string[] = [];
  const notices: { type: string; title: string; body: string }[] = [];
  let sessions = 3;
  const io: SuspensionIo = {
    suspendInDb: async () => {
      calls.push('db:suspend');
      if (opts.suspendRefusal) return { data: null, error: opts.suspendRefusal };
      dbSuspended = true;
      return { data: { shops: ['shop-1'] }, error: null };
    },
    liftInDb: async () => {
      calls.push('db:lift');
      const was = dbSuspended;
      dbSuspended = false;
      return was
        ? { data: { shops: ['shop-1'], was_suspended_until: '2026-12-13T02:00:00.000Z', was_reason: 'Spam' }, error: null }
        : { data: null, error: 'suspend_not_suspended' };
    },
    ban: async (_id, duration) => {
      calls.push(`ban:${duration}`);
      if (opts.banFails) return { error: 'gotrue down' };
      if (duration === BAN_LIFTED) bannedUntil = null;
      else bannedUntil = new Date(now.getTime() + Number(duration.replace('h', '')) * 3600_000);
      return { error: null };
    },
    revokeSessions: async () => {
      calls.push('revoke');
      const n = sessions;
      sessions = 0;
      return { sessionsRevoked: n, error: null };
    },
    notify: async (_u, type, title, body) => {
      calls.push(`notify:${type}`);
      notices.push({ type, title, body });
    },
    shopsChanged: () => {},
    log: () => {},
  };
  /** GoTrue's sign-in: refused with "User is banned" while banned_until is in the future. */
  const signIn = (at: Date) =>
    bannedUntil && bannedUntil.getTime() > at.getTime() ? { error: 'User is banned' } : { error: null };
  return { io, now, calls, notices, signIn, state: () => ({ dbSuspended, bannedUntil, sessions }) };
}

test('a suspended person cannot sign in, is signed out everywhere, and is told in words', async () => {
  const w = fakeWorld();
  const until = new Date(w.now.getTime() + 30 * 86_400_000);
  const r = await suspendAccountWith(w.io, { userId: 'u1', reason: 'Spam', until, now: w.now });
  assert.equal(r.ok, true);
  assert.deepEqual(w.calls, ['db:suspend', 'ban:720h', 'revoke', 'notify:account_suspended']);
  assert.equal(w.state().sessions, 0, 'their sessions were not revoked');
  assert.equal(w.signIn(new Date(w.now.getTime() + 86_400_000)).error, 'User is banned', 'a suspended person signed in');
  // …until the Until date passes (GoTrue's ban runs out on its own).
  assert.equal(w.signIn(new Date(until.getTime() + 3600_000)).error, null);
  assert.equal(w.notices[0]!.title, 'Your account is on hold');
  assert.match(w.notices[0]!.body, /until 13 Dec 2026/);
  assert.match(w.notices[0]!.body, /Nothing has been deleted/);
  // And the sign-in card says it in plain words, not GoTrue's.
  assert.equal(explainFailedSignIn({ authMessage: 'User is banned', door: null }).message, SUSPENDED_SIGN_IN);
});

test('"until lifted" bans for about a hundred years, not a day', async () => {
  const w = fakeWorld();
  const r = await suspendAccountWith(w.io, { userId: 'u1', reason: 'Other', until: null, now: w.now });
  assert.equal(r.ok, true);
  assert.ok(w.calls.includes(`ban:${UNTIL_LIFTED_BAN_HOURS}h`));
  assert.equal(w.signIn(new Date(w.now.getTime() + 5 * 365 * 86_400_000)).error, 'User is banned');
  assert.match(w.notices[0]!.body, /until our team lifts it/);
});

test('if the sign-in ban cannot be set, the database half is rolled back — never "suspended" but able to sign in', async () => {
  const w = fakeWorld({ banFails: true });
  const r = await suspendAccountWith(w.io, { userId: 'u1', reason: 'Spam', until: null, now: w.now });
  assert.equal(r.ok, false);
  assert.deepEqual(w.calls.slice(0, 3), ['db:suspend', `ban:${UNTIL_LIFTED_BAN_HOURS}h`, 'db:lift']);
  assert.equal(w.state().dbSuspended, false, 'the person stayed recorded as suspended');
  assert.ok(!w.calls.includes('notify:account_suspended'), 'they were told about a hold that did not happen');
});

test('a database refusal changes nothing at GoTrue and says why', async () => {
  const w = fakeWorld({ suspendRefusal: 'ERROR: suspend_internal_account' });
  const r = await suspendAccountWith(w.io, { userId: 'u1', reason: 'Spam', until: null, now: w.now });
  assert.deepEqual(r, { ok: false, message: 'An internal account (§ 10a) is never suspended.' });
  assert.deepEqual(w.calls, ['db:suspend']);
});

test('unsuspend lets them sign in again, tells them, and hands back the hold for Undo', async () => {
  const w = fakeWorld();
  await suspendAccountWith(w.io, { userId: 'u1', reason: 'Spam', until: null, now: w.now });
  const r = await liftSuspensionWith(w.io, 'u1');
  assert.equal(r.ok, true);
  assert.equal(w.signIn(w.now).error, null, 'an unsuspended person still cannot sign in');
  assert.ok(w.calls.includes(`ban:${BAN_LIFTED}`));
  assert.equal(w.notices.at(-1)!.type, 'account_unsuspended');
  assert.match(w.notices.at(-1)!.body, /hidden from search until our team lists it again/);
  if (r.ok) {
    assert.equal(r.wasReason, 'Spam');
    assert.equal(r.wasUntil, '2026-12-13T02:00:00.000Z');
  }
});

test('the expiry lift (database already lifted) still clears the ban and tells them', async () => {
  const w = fakeWorld();
  const r = await finishLiftWith(w.io, 'u1', { shops: [] });
  assert.equal(r.ok, true);
  assert.deepEqual(w.calls, [`ban:${BAN_LIFTED}`, 'notify:account_unsuspended']);
  assert.doesNotMatch(w.notices[0]!.body, /shop/, 'a person with no shop was told about one');
});
