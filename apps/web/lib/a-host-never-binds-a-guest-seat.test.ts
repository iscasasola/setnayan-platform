/**
 * a-host-never-binds-a-guest-seat.test.ts — A HOST HOLDS A GUEST'S LINK TO LOOK, NEVER TO KEEP (owner 2026-10-21).
 *
 * ⚖ Owner, signed in as himself — the HOST of his own wedding — on Pam's personal invitation, was offered:
 * *"This invitation is for Pam. Save it to <his own email>? [Yes, save to my account]"*. One press would have run the
 * seat binder for the host's account on Pam's row. The rule (`lib/seat-binding.ts` `seatBindRefusal` → `'manager'`),
 * extending the 2026-09-30 ruling "A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE":
 *
 *   1 · the rule, as a PROPERTY: for every seat role, extra role and couple flag, an account that manages the event is
 *       refused any seat that is not already its own — and its own seat answers exactly as it did before;
 *   2 · the page's account state, as a PROPERTY: a managing viewer is never handed `link_this_seat` (the press) for a
 *       seat that is not theirs — `host_viewing` instead, carrying the seat's name for the quiet line;
 *   3 · the SERVER, executed: the real `linkGuestSessionToUser` — its cookies, its auth read and its database reads
 *       answered by stand-ins — refuses a couple member, a coordinator, a co-host and a limited helper who carry the
 *       guest's pass on purpose ("Open as Pam"), and WRITES NOTHING; an ordinary guest with the same pass is still
 *       bound (the control); a standing read that fails refuses (fail closed);
 *   4 · the SERVER's other door, executed: `findSeatToConnect` (the `/join/{id}/connect/confirm` question) marks the
 *       host's seat refused, so `connectEventForUser` binds nothing.
 *
 * Sabotages seen red (each restored), recorded in `changelog.d/rd-host-never-binds-a-guest-seat.md`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-0123456789abcdef';
process.env.GUEST_SESSION_SECRET = 'a-guest-session-secret-for-tests-only-0123456789';

// ── the cookie jar `next/headers` hands the readers ────────────────────────────────────────────────────────────
let jar = new Map<string, string>();
const store = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  has: (name: string) => jar.has(name),
  set: () => undefined,
  delete: () => undefined,
};
{
  const Module = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const real = Module._load;
  Module._load = function (request: string, ...rest: unknown[]) {
    if (request === 'next/headers') return { cookies: async () => store, headers: async () => new Headers() };
    if (request === 'server-only') return {};
    return real.call(this, request, ...rest);
  };
}

const { signGuestSession, forgetRecentGuestSessionChecksForTest, GUEST_SESSION_COOKIE_NAME } =
  require('./guest-session') as typeof import('./guest-session');
const { linkGuestSessionToUser } = require('./link-guest-account') as typeof import('./link-guest-account');
const { findSeatToConnect } = require('./event-account-link') as typeof import('./event-account-link');
const { seatBindRefusal, hostViewingLine } = require('./seat-binding') as typeof import('./seat-binding');
const { guestAccountState } = require('./guest-one-path') as typeof import('./guest-one-path');
const rule = require('./pass-account-rule') as typeof import('./pass-account-rule');

const EVENT = '00000000-0000-4000-8000-0000000000e1';
const PAM = '00000000-0000-4000-8000-00000000a001'; // the guest whose link the host opened
const GROOM = '00000000-0000-4000-8000-00000000a002'; // the host's own row
const HELPER_ROW = '00000000-0000-4000-8000-00000000a003'; // a co-host's own guest row
const HOST = '00000000-0000-4000-8000-0000000000b1';
const GUEST_ACCOUNT = '00000000-0000-4000-8000-0000000000b2';
const TOKEN = 'qr_tok_pam_aaaaaaaaaaaaaaaaaaaaaaaaa';

type Member = { user_id: string | null; guest_id: string | null; member_type: string };
type Moderator = { user_id: string; guest_id: string | null; role_subtype: string };
let signedInAs: string | null = null;
let members: Member[] = [];
let moderators: Moderator[] = [];
let standingRefused = false;
let writes: string[] = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('/auth/v1/user')) {
    return json({ id: signedInAs, aud: 'authenticated', role: 'authenticated', email: 'host@example.test' });
  }
  if (!url.includes('/rest/v1/')) return realFetch(input as RequestInfo, init);
  // Every write is recorded — the refusals below must leave this EMPTY.
  if (method !== 'GET' && method !== 'HEAD') {
    writes.push(`${method} ${new URL(url).pathname}`);
    return json([], 201);
  }
  const u = new URL(url);
  const eq = (col: string) => /^eq\.(.+)$/.exec(decodeURIComponent(u.searchParams.get(col) ?? ''))?.[1];
  if (u.pathname.endsWith('/guests')) {
    return json([
      {
        guest_id: PAM,
        event_id: EVENT,
        qr_token: TOKEN,
        role: 'guest',
        extra_roles: null,
        display_name: 'Pam',
        first_name: 'Pamela',
        last_name: 'Labriaga',
      },
    ]);
  }
  if (u.pathname.endsWith('/event_members')) {
    if (standingRefused && !u.searchParams.get('or')) {
      return json({ code: '42501', message: 'permission denied for table event_members' }, 401);
    }
    const or = decodeURIComponent(u.searchParams.get('or') ?? '');
    const user = /user_id\.eq\.([0-9a-f-]+)/.exec(or)?.[1] ?? eq('user_id');
    const guest = /guest_id\.eq\.([0-9a-f-]+)/.exec(or)?.[1] ?? eq('guest_id');
    return json(members.filter((m) => (user && m.user_id === user) || (guest && m.guest_id === guest)));
  }
  if (u.pathname.endsWith('/event_moderators')) {
    const user = eq('user_id');
    return json(
      moderators.filter((m) => m.user_id === user).map((m) => ({ moderator_id: 1, guest_id: m.guest_id })),
    );
  }
  return json([]);
}) as typeof fetch;

/** The browser: Pam's pass (her personal link was opened), signed in as `account`, maybe "Open as Pam" pressed. */
async function browser(opts: { account: string; hostOpensPam?: boolean }) {
  jar = new Map();
  forgetRecentGuestSessionChecksForTest();
  writes = [];
  jar.set(GUEST_SESSION_COOKIE_NAME, await signGuestSession({ guest_id: PAM, event_id: EVENT, qr_token: TOKEN }));
  signedInAs = opts.account;
  const now = Math.floor(Date.now() / 1000);
  jar.set(
    'sb-db-auth-token',
    JSON.stringify({
      access_token: 'header.payload.signature',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'refresh-token',
      user: { id: opts.account, aud: 'authenticated', role: 'authenticated' },
    }),
  );
  if (opts.hostOpensPam) jar.set(rule.HOST_PREVIEW_PASS_COOKIE_NAME, rule.hostPreviewCookieValue(EVENT, PAM));
}
const fresh = () => {
  members = [];
  moderators = [];
  standingRefused = false;
};

// ── 1 · THE RULE, AS A PROPERTY ────────────────────────────────────────────────────────────────────────────────

const ROLES = ['guest', 'bride', 'groom', 'celebrant', 'best_man', 'principal_sponsor', null] as const;
const EXTRAS = [null, [], ['groom'], ['ninong']] as const;
const BOOLS = [false, true] as const;

test('1 · a managing account is refused EVERY seat that is not its own — and its own seat answers as before', () => {
  let cases = 0;
  for (const seatRole of ROLES)
    for (const seatExtraRoles of EXTRAS)
      for (const accountIsCouple of BOOLS)
        for (const coupleSentTheLink of BOOLS) {
          const base = { seatRole, seatExtraRoles, accountIsCouple, coupleSentTheLink };
          const before = seatBindRefusal(base);
          assert.equal(
            seatBindRefusal({ ...base, accountManagesEvent: true }),
            'manager',
            `a manager was offered a ${seatRole}/${JSON.stringify(seatExtraRoles)} seat`,
          );
          assert.equal(seatBindRefusal({ ...base, accountManagesEvent: true, seatIsAccountsOwn: true }), before, 'a manager lost their OWN seat');
          assert.equal(seatBindRefusal({ ...base, accountManagesEvent: false }), before, 'a guest’s answer changed');
          cases += 1;
        }
  assert.equal(cases, ROLES.length * EXTRAS.length * 4);
});

// ── 2 · THE PAGE'S ACCOUNT STATE, AS A PROPERTY ────────────────────────────────────────────────────────────────

test('2 · a managing viewer is never handed the press for a seat that is not theirs', () => {
  for (const seatHolderUserId of [null, HOST, GUEST_ACCOUNT])
    for (const seatIsCouple of BOOLS)
      for (const seatName of ['Pam', null]) {
        const state = guestAccountState({
          viewerUserId: HOST,
          viewerEmail: 'host@example.test',
          seatHolderUserId,
          seatName,
          seatIsCouple,
          viewerManagesEvent: true,
        });
        if (seatHolderUserId === HOST) {
          assert.equal(state.kind, 'linked', 'the host’s own seat stopped reading as theirs');
        } else {
          assert.equal(state.kind, 'host_viewing', `a host on a ${seatHolderUserId ? 'held' : 'free'} seat got ${state.kind}`);
          assert.equal('seatName' in state ? state.seatName : undefined, seatName);
        }
      }
  // The same viewer WITHOUT standing is still asked — the guest's own path is untouched.
  assert.equal(
    guestAccountState({ viewerUserId: GUEST_ACCOUNT, viewerEmail: 'g@x.test', seatHolderUserId: null, seatName: 'Pam' }).kind,
    'link_this_seat',
  );
  assert.equal(hostViewingLine('Pam'), 'You’re viewing Pam’s invitation as the host. Only they can save it to their account.');
  assert.match(hostViewingLine(null), /^You’re viewing this guest’s invitation as the host\./);
});

// ── 3 · THE SERVER REFUSES, EXECUTED ───────────────────────────────────────────────────────────────────────────

const MANAGERS: Array<{ who: string; members: Member[]; moderators: Moderator[] }> = [
  { who: 'the couple (the owner on his own wedding)', members: [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }], moderators: [] },
  { who: 'a coordinator', members: [{ user_id: HOST, guest_id: null, member_type: 'coordinator' }], moderators: [] },
  {
    who: 'a co-host from the guest list',
    members: [{ user_id: HOST, guest_id: HELPER_ROW, member_type: 'guest' }],
    moderators: [{ user_id: HOST, guest_id: HELPER_ROW, role_subtype: 'co_host' }],
  },
  { who: 'a limited helper', members: [], moderators: [{ user_id: HOST, guest_id: null, role_subtype: 'viewer' }] },
];

for (const m of MANAGERS) {
  test(`3 · ${m.who} carrying Pam’s pass on purpose ("Open as Pam") is refused, and nothing is written`, async () => {
    fresh();
    members = m.members;
    moderators = m.moderators;
    await browser({ account: HOST, hostOpensPam: true });
    const result = await linkGuestSessionToUser(HOST, { eventId: EVENT });
    assert.deepEqual(result, { linked: false, reason: 'manager' }, `${m.who} was bound to Pam’s seat`);
    assert.deepEqual(writes, [], `${m.who}: the refusal wrote ${writes.join(', ')}`);
  });
}

test('3 · the control: an ordinary signed-in guest with the same pass IS bound (the guest’s own path is untouched)', async () => {
  fresh();
  await browser({ account: GUEST_ACCOUNT });
  const result = await linkGuestSessionToUser(GUEST_ACCOUNT, { eventId: EVENT });
  assert.deepEqual(result, { linked: true, reason: 'linked' });
  assert.ok(writes.includes('POST /rest/v1/event_members'), `the guest's membership was not written: ${writes.join(', ')}`);
});

test('3 · the host’s OWN row, held as a pass, is still theirs to keep', async () => {
  fresh();
  members = [{ user_id: HOST, guest_id: PAM, member_type: 'couple' }];
  await browser({ account: HOST });
  const result = await linkGuestSessionToUser(HOST, { eventId: EVENT });
  assert.notEqual(result.reason, 'manager', 'a host was refused their own seat');
});

test('3 · a standing read that fails refuses (fail closed) — and writes nothing', async () => {
  fresh();
  standingRefused = true;
  await browser({ account: GUEST_ACCOUNT });
  const result = await linkGuestSessionToUser(GUEST_ACCOUNT, { eventId: EVENT });
  assert.deepEqual(result, { linked: false, reason: 'manager' });
  assert.deepEqual(writes, []);
});

// ── 4 · THE CONNECT QUESTION REFUSES TOO ───────────────────────────────────────────────────────────────────────

test('4 · the /join/{id}/connect question marks the host’s seat refused — `connectEventForUser` binds only un-refused', async () => {
  fresh();
  moderators = [{ user_id: HOST, guest_id: null, role_subtype: 'co_host' }];
  await browser({ account: HOST, hostOpensPam: true });
  const seat = await findSeatToConnect(EVENT, HOST, 'host@example.test');
  assert.equal(seat?.guestId, PAM, 'the stand-ins no longer reach the cookie arm — this test proves nothing');
  assert.equal(seat?.refusal, 'manager', 'the confirm page would ask the host “Save it to <you>?”');
  // …and an ordinary guest is still asked.
  fresh();
  await browser({ account: GUEST_ACCOUNT });
  assert.equal((await findSeatToConnect(EVENT, GUEST_ACCOUNT, 'g@example.test'))?.refusal, null);
});
