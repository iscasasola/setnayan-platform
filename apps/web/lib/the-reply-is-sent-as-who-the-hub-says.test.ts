/**
 * the-reply-is-sent-as-who-the-hub-says.test.ts — THE REPLY IS SENT AS EXACTLY WHOM THE EVENT HUB SAYS IT IS VIEWING AS
 * (owner bug 2026-10-24, cale-ice).
 *
 * ⚖ The host, signed in, read "This browser also holds Indalecia's invitation. Viewing as you." and tapped Reply. The
 * reply sheet greeted "Gabriel dela Peña" and asked HIM to answer Gabriel's RSVP. Root cause: the host's Reply card
 * (`hostReplyCard`, site-body.tsx) linked to `/{slug}/invite/reply?preview=draft` — the Maker's PREVIEW of the reply,
 * whose sample guest is named after the event's first non-couple guest (`loadPreviewPerson`). Nothing was written (the
 * sample's Send writes nothing, and `submitRsvp` binds every write to the request's own identity), but the page said
 * one person and the reply drew another.
 *
 * The rule, held here against the REAL readers (cookies, auth and database answered by stand-ins — the harness of
 * `the-account-outranks-the-pass.test.ts`):
 *   1 · a signed-in HOST, this browser holding TWO passes for the event (Indalecia's active one and Gabriel's in the
 *       pass book) → the reply is the host's OWN row. Neither pass answers;
 *   2 · a signed-in account with no row of its own here → `not_on_list` (the page says so) — never a pass, never a
 *       sample; bound to two rows → `several_rows`, never one of them silently;
 *   3 · a host who pressed "Open as Indalecia" (the Hub then says "You're viewing as Indalecia") → Indalecia;
 *   4 · signed OUT with the two passes → the ACTIVE pass, the same one the Event Hub's own reader honours;
 *   5 · the page and the save ask ONE function (`readReplyIdentityForEvent`), and the Hub's host card no longer opens
 *       the Maker's sample (`?preview=draft`) — so the form and the write can never name two different people.
 *
 * Sabotages seen red (each restored): `resolveReplyIdentity` returning the first of several own rows (2 red) ·
 * `readReplyIdentityForEvent` skipping the own-row read (1 red) · `submitRsvp` back on `readGuestSessionForEvent`
 * (5 red) · the host card's `?preview=draft` put back (5 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-0123456789abcdef';
process.env.GUEST_SESSION_SECRET = 'a-guest-session-secret-for-tests-only-0123456789';

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

const { signGuestSession, forgetRecentGuestSessionChecksForTest, GUEST_SESSION_COOKIE_NAME, signGuestPassBook } =
  require('./guest-session') as typeof import('./guest-session');
const { GUEST_PASS_BOOK_COOKIE_NAME } = require('./guest-pass-book') as typeof import('./guest-pass-book');
const { resolveReplyIdentity } = require('./guest-one-path') as typeof import('./guest-one-path');
const { readReplyIdentityForEvent } = require('./guest-one-path.server') as typeof import('./guest-one-path.server');
const rule = require('./pass-account-rule') as typeof import('./pass-account-rule');

const EVENT = '00000000-0000-4000-8000-0000000000e1';
const INDALECIA = '00000000-0000-4000-8000-00000000a001'; // the active pass (her personal link, opened here)
const GABRIEL = '00000000-0000-4000-8000-00000000a004'; // a second pass, in the pass book
const GROOM = '00000000-0000-4000-8000-00000000a002'; // the host's own row
const BEST_MAN = '00000000-0000-4000-8000-00000000a005'; // a second row on one account
const HOST = '00000000-0000-4000-8000-0000000000b1';
const COORDINATOR = '00000000-0000-4000-8000-0000000000b4';

type Guest = { guest_id: string; qr_token: string; deleted: boolean };
type Member = { user_id: string | null; guest_id: string | null; member_type: string };
const guests: Guest[] = [
  { guest_id: INDALECIA, qr_token: 'qr_tok_indalecia_aaaaaaaaaaaaaaaa', deleted: false },
  { guest_id: GABRIEL, qr_token: 'qr_tok_gabriel_bbbbbbbbbbbbbbbbbb', deleted: false },
  { guest_id: GROOM, qr_token: 'qr_tok_groom_cccccccccccccccccccc', deleted: false },
  { guest_id: BEST_MAN, qr_token: 'qr_tok_bestman_dddddddddddddddddd', deleted: false },
];
const tokenOf = (id: string) => guests.find((g) => g.guest_id === id)!.qr_token;
let members: Member[] = [];
let signedInAs: string | null = null;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('/auth/v1/user')) {
    return json({ id: signedInAs, aud: 'authenticated', role: 'authenticated', email: 'a@example.test' });
  }
  const u = new URL(url);
  const eq = (k: string) => {
    const v = u.searchParams.get(k);
    return v?.startsWith('eq.') ? v.slice(3) : null;
  };
  if (u.pathname.endsWith('/rest/v1/guests')) {
    const one = eq('guest_id');
    const many = /^in\.\((.*)\)$/.exec(u.searchParams.get('guest_id') ?? '')?.[1]?.split(',').map((s) => s.replace(/"/g, ''));
    const rows = guests
      .filter((g) => !g.deleted)
      .filter((g) => (one ? g.guest_id === one : many ? many.includes(g.guest_id) : true));
    return json(rows.map((g) => ({ guest_id: g.guest_id, qr_token: g.qr_token, events: { slug: 'cale-ice' } })));
  }
  if (u.pathname.endsWith('/rest/v1/event_members')) {
    const or = decodeURIComponent(u.searchParams.get('or') ?? '');
    if (or) {
      const user = /user_id\.eq\.([0-9a-f-]+)/.exec(or)?.[1];
      const guest = /guest_id\.eq\.([0-9a-f-]+)/.exec(or)?.[1];
      return json(members.filter((m) => m.user_id === user || m.guest_id === guest));
    }
    const user = eq('user_id');
    const type = eq('member_type');
    return json(
      members
        .filter((m) => m.user_id === user && m.guest_id !== null)
        .filter((m) => (type ? m.member_type === type : true))
        .map((m) => ({ guest_id: m.guest_id })),
    );
  }
  if (u.pathname.endsWith('/rest/v1/event_moderators')) return json([]);
  return realFetch(input as RequestInfo);
}) as typeof fetch;

/** This browser: Indalecia's pass (active) and Gabriel's (in the pass book) — and, signed in, an account session. */
async function browser(opts: { account: string | null; hostOpens?: string | null }) {
  jar = new Map();
  forgetRecentGuestSessionChecksForTest();
  jar.set(GUEST_SESSION_COOKIE_NAME, await signGuestSession({ guest_id: INDALECIA, event_id: EVENT, qr_token: tokenOf(INDALECIA) }));
  jar.set(
    GUEST_PASS_BOOK_COOKIE_NAME,
    await signGuestPassBook([
      { slug: 'cale-ice', guest_id: GABRIEL, event_id: EVENT, qr_token: tokenOf(GABRIEL), exp: Math.floor(Date.now() / 1000) + 3600 },
    ]),
  );
  signedInAs = opts.account;
  if (opts.account) {
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
  }
  if (opts.hostOpens) jar.set(rule.HOST_PREVIEW_PASS_COOKIE_NAME, opts.hostOpens);
}

test('1 · signed-in HOST, two passes held → the reply is the host’s OWN row; neither pass answers', async () => {
  members = [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }];
  await browser({ account: HOST });
  const who = await readReplyIdentityForEvent(EVENT);
  assert.equal(who.kind, 'own_row', `the host replied as ${JSON.stringify(who)}`);
  assert.equal(who.kind !== 'none' ? who.session.guest_id : null, GROOM, 'the host’s reply was not their own row');
  assert.notEqual(who.kind !== 'none' ? who.session.guest_id : null, INDALECIA, 'a set-aside pass answered');
  assert.notEqual(who.kind !== 'none' ? who.session.guest_id : null, GABRIEL, 'the other held pass answered');
});

test('2 · signed in with no row here → not_on_list (told, never a sample); two rows → never one silently', async () => {
  members = [{ user_id: COORDINATOR, guest_id: null, member_type: 'coordinator' }];
  await browser({ account: COORDINATOR });
  assert.deepEqual(await readReplyIdentityForEvent(EVENT), { kind: 'none', why: 'not_on_list' });
  members = [
    { user_id: HOST, guest_id: GROOM, member_type: 'couple' },
    { user_id: HOST, guest_id: BEST_MAN, member_type: 'couple' },
  ];
  await browser({ account: HOST });
  assert.deepEqual(await readReplyIdentityForEvent(EVENT), { kind: 'none', why: 'several_rows' });
});

test('3 · a host who pressed "Open as Indalecia" → Indalecia, as the Hub says ("You’re viewing as Indalecia")', async () => {
  members = [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }];
  await browser({ account: HOST, hostOpens: rule.hostPreviewCookieValue(EVENT, INDALECIA) });
  const who = await readReplyIdentityForEvent(EVENT);
  assert.equal(who.kind, 'pass');
  assert.equal(who.kind !== 'none' ? who.session.guest_id : null, INDALECIA);
});

test('4 · signed OUT, two passes held → the ACTIVE pass (the one the Event Hub honours), never the book’s other one', async () => {
  members = [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }];
  await browser({ account: null });
  const who = await readReplyIdentityForEvent(EVENT);
  assert.equal(who.kind, 'pass');
  assert.equal(who.kind !== 'none' ? who.session.guest_id : null, INDALECIA);
});

test('the pure rule, every answer', () => {
  const pass = { guest_id: INDALECIA, event_id: EVENT, qr_token: 't1' };
  const anon = { kind: 'anonymous' as const, reason: null };
  assert.equal(resolveReplyIdentity({ eventId: EVENT, viewer: { kind: 'cookie', session: pass }, signedIn: true, ownRows: [] }).kind, 'pass');
  assert.equal(resolveReplyIdentity({ eventId: EVENT, viewer: { kind: 'seat', session: pass }, signedIn: true, ownRows: [] }).kind, 'seat');
  assert.deepEqual(resolveReplyIdentity({ eventId: EVENT, viewer: anon, signedIn: false, ownRows: [] }), { kind: 'none', why: 'no_key' });
  assert.deepEqual(resolveReplyIdentity({ eventId: EVENT, viewer: anon, signedIn: true, ownRows: null }), { kind: 'none', why: 'unread' });
  assert.deepEqual(resolveReplyIdentity({ eventId: EVENT, viewer: anon, signedIn: true, ownRows: [] }), { kind: 'none', why: 'not_on_list' });
  assert.deepEqual(
    resolveReplyIdentity({ eventId: EVENT, viewer: anon, signedIn: true, ownRows: [{ guestId: GROOM, qrToken: 'g' }] }),
    { kind: 'own_row', session: { guest_id: GROOM, event_id: EVENT, qr_token: 'g' } },
  );
  // The same row named twice (two memberships on one row) is ONE row, not "several".
  assert.equal(
    resolveReplyIdentity({ eventId: EVENT, viewer: anon, signedIn: true, ownRows: [{ guestId: GROOM, qrToken: 'g' }, { guestId: GROOM, qrToken: 'g' }] }).kind,
    'own_row',
  );
  assert.deepEqual(
    resolveReplyIdentity({ eventId: EVENT, viewer: anon, signedIn: true, ownRows: [{ guestId: GROOM, qrToken: 'g' }, { guestId: BEST_MAN, qrToken: 'b' }] }),
    { kind: 'none', why: 'several_rows' },
  );
});

test('5 · the page and the save ask ONE function, and the host’s card never opens the Maker’s sample', () => {
  const root = join(__dirname, '..');
  const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));
  const page = read('app/[slug]/invite/reply/page.tsx');
  assert.match(page, /readReplyIdentityForEvent\(/, 'the reply page does not ask who the reply is sent as');
  assert.doesNotMatch(page, /readGuestSessionForEvent\(/, 'the reply page reads a second, different identity');
  const actions = read('app/[slug]/actions.ts');
  const save = actions.slice(actions.indexOf('export async function submitRsvp('));
  assert.ok(save.length > 0, 'submitRsvp is gone — find the reply save and point this guard at it');
  const body = save.slice(0, save.indexOf('\nexport ', 1) > 0 ? save.indexOf('\nexport ', 1) : undefined);
  assert.match(body, /readReplyIdentityForEvent\(/, 'the save checks a different identity from the one the form was drawn for');
  assert.doesNotMatch(body, /readGuestSessionForEvent\(/, 'the save checks a different identity from the one the form was drawn for');
  const site = read('app/[slug]/_components/site-body.tsx');
  const card = site.slice(site.indexOf('const hostReplyCard'), site.indexOf('const strangerCoverRsvp'));
  assert.ok(card.length > 0, 'the host’s Reply card moved — point this guard at it');
  assert.doesNotMatch(card, /preview=draft|editor=1/, 'the host’s Reply opens the Maker’s sample again (a real guest’s name, not the host)');
  assert.doesNotMatch(card, /rsvpStatus:\s*'pending'/, 'the host’s card ignores the host’s own reply');
});
