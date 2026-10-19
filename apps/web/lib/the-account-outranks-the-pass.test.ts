/**
 * the-account-outranks-the-pass.test.ts — SIGNED IN, WHO IS LOOKING COMES FROM THE ACCOUNT (owner bug 2026-10-19).
 *
 * ⚖ Owner, signed in to his own event as its groom, met the guest page marked "Mrs. Milagros E. Buanhog · YOU":
 * *"why was milagros highlighted when i was not logged in on her?"* — the browser still held her 60-day guest pass
 * from opening her personal link, and every pass reader believed the pass over the account. The rule
 * (`lib/pass-account-rule.ts`) now lives inside the ONE reader every pass consumer calls (`readGuestSession`):
 *
 *   1 · signed-in HOST + another guest's pass → no pass (nobody is marked "You"); the page says it set one aside;
 *   2 · signed-in account bound to guest X + a pass for guest Y → no pass for Y; the viewer resolves to X (the seat);
 *   3 · signed OUT + a pass for Y → Y, exactly as before;
 *   4 · a host who pressed "Open as <name>" → that guest, for this browser session; a stale mark for another guest
 *       or another event opens nothing;
 *   5 · a signed-in claimant (no standing on the event) + a pass nobody holds → the pass (the "Save it to <email>?"
 *       prompt needs it); + a pass another account holds → no pass;
 *   6 · the facts cannot be read → no pass (fail closed) — and a lapsed sign-in (4xx) is SIGNED OUT, never a lockout;
 *   7 · every file that touches the pass cookies or verifies a pass token is on a short, reasoned list — anything
 *       new must read the pass through `readGuestSession`, or this fails.
 *
 * Executed against the REAL reader — its cookies, its auth read and its database reads answered by stand-ins
 * (`next/headers` stubbed, `fetch` answered) — not a copy of the rule.
 *
 * Sabotages seen red (each restored): `readGuestSession` returning the held pass without asking the account (1, 2,
 * 5, 6 red) · `isHost` forced false (1 red) · the host-preview cookie honoured for any guest (4 red) · a 4xx sign-in
 * error treated as unknown (6 red) · a new route reading `GUEST_SESSION_COOKIE_NAME` itself (7 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-0123456789abcdef';
process.env.GUEST_SESSION_SECRET = 'a-guest-session-secret-for-tests-only-0123456789';

// ── the cookie jar `next/headers` hands the reader ─────────────────────────────────────────────────────────────
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

const { readGuestSession, readGuestPassStanding, signGuestSession, forgetRecentGuestSessionChecksForTest, GUEST_SESSION_COOKIE_NAME } =
  require('./guest-session') as typeof import('./guest-session');
const { resolveGuestViewer } = require('./guest-one-path') as typeof import('./guest-one-path');
const rule = require('./pass-account-rule') as typeof import('./pass-account-rule');

const EVENT = '00000000-0000-4000-8000-0000000000e1';
const OTHER_EVENT = '00000000-0000-4000-8000-0000000000e2';
const MILAGROS = '00000000-0000-4000-8000-00000000a001'; // the pass this browser holds
const GROOM = '00000000-0000-4000-8000-00000000a002'; // the host's own row
const COUSIN = '00000000-0000-4000-8000-00000000a003'; // a guest's own row
const HOST = '00000000-0000-4000-8000-0000000000b1';
const ACCOUNT = '00000000-0000-4000-8000-0000000000b2';
const SOMEONE_ELSE = '00000000-0000-4000-8000-0000000000b3';
const TOKEN = 'qr_tok_milagros_aaaaaaaaaaaaaaaaaaaa';

type Member = { user_id: string | null; guest_id: string | null; member_type: string };
let signedInAs: string | null = null;
let authFault: 'none' | 'expired' | 'down' = 'none';
let members: Member[] = [];
let moderators: string[] = [];
let factsRefused = false;
let factReads = 0;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('/auth/v1/user')) {
    if (authFault === 'expired') return json({ code: 401, msg: 'invalid JWT', error_code: 'bad_jwt' }, 401);
    if (authFault === 'down') throw new TypeError('fetch failed');
    return json({ id: signedInAs, aud: 'authenticated', role: 'authenticated', email: 'a@example.test' });
  }
  if (url.includes('/rest/v1/guests?')) return json([{ qr_token: TOKEN }]);
  if (url.includes('/rest/v1/event_members?')) {
    factReads += 1;
    if (factsRefused) return json({ code: '42501', message: 'permission denied for table event_members' }, 401);
    const u = new URL(url);
    const or = decodeURIComponent(u.searchParams.get('or') ?? '');
    const user = /user_id\.eq\.([0-9a-f-]+)/.exec(or)?.[1];
    const guest = /guest_id\.eq\.([0-9a-f-]+)/.exec(or)?.[1];
    return json(members.filter((m) => m.user_id === user || m.guest_id === guest));
  }
  if (url.includes('/rest/v1/event_moderators?')) {
    return json(signedInAs && moderators.includes(signedInAs) ? [{ moderator_id: 1 }] : []);
  }
  return realFetch(input as RequestInfo);
}) as typeof fetch;

/** The browser: Milagros's pass (from opening her personal link), and — when signed in — an account session. */
async function browser(opts: { account: string | null; hostOpens?: string | null }) {
  jar = new Map();
  forgetRecentGuestSessionChecksForTest();
  factReads = 0;
  jar.set(GUEST_SESSION_COOKIE_NAME, await signGuestSession({ guest_id: MILAGROS, event_id: EVENT, qr_token: TOKEN }));
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
const fresh = () => {
  members = [];
  moderators = [];
  factsRefused = false;
  authFault = 'none';
};

test('1 · signed-in HOST + another guest’s pass → no pass; nobody is marked; the page is told what it set aside', async () => {
  fresh();
  members = [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }];
  await browser({ account: HOST });
  assert.equal(await readGuestSession(), null, 'the host was handed Milagros’s pass');
  const standing = await readGuestPassStanding({ eventId: EVENT });
  assert.equal(standing.session, null);
  assert.equal(standing.setAside?.standing, 'set_aside_host');
  assert.equal(standing.setAside?.pass.guest_id, MILAGROS, 'the line must name the pass it set aside');
  // …and the identity the page builds from it marks nobody — the entourage marks only `session.guest_id`.
  const viewer = resolveGuestViewer({ eventId: EVENT, cookie: await readGuestSession(), seat: null });
  assert.equal(viewer.kind, 'anonymous', 'the host’s page drew Milagros’s guest tree');
  // A delegate (accepted moderator) is a host too.
  members = [];
  moderators = [HOST];
  await browser({ account: HOST });
  assert.equal(await readGuestSession(), null, 'a delegate was handed another guest’s pass');
});

test('1b · …and the host’s OWN row, held as a pass (the groom opening his own link) is still him', async () => {
  fresh();
  members = [{ user_id: HOST, guest_id: MILAGROS, member_type: 'couple' }];
  await browser({ account: HOST });
  assert.equal((await readGuestSession())?.guest_id, MILAGROS);
  assert.equal((await readGuestPassStanding()).standing, 'own');
});

test('2 · signed-in account bound to guest X + a pass for guest Y → X', async () => {
  fresh();
  members = [{ user_id: ACCOUNT, guest_id: COUSIN, member_type: 'guest' }];
  await browser({ account: ACCOUNT });
  const cookie = await readGuestSession({ eventId: EVENT });
  assert.equal(cookie, null, 'the cousin’s account was handed Milagros’s pass');
  assert.equal((await readGuestPassStanding({ eventId: EVENT })).setAside?.standing, 'set_aside_seat');
  const viewer = resolveGuestViewer({ eventId: EVENT, cookie, seat: { guestId: COUSIN, qrToken: 'qr_tok_cousin' } });
  assert.equal(viewer.kind, 'seat');
  assert.equal(viewer.kind === 'anonymous' ? null : viewer.session.guest_id, COUSIN, 'the viewer is not their own seat');
});

test('3 · signed OUT + a pass for Y → Y, unchanged — and the database is not asked about accounts', async () => {
  fresh();
  members = [{ user_id: SOMEONE_ELSE, guest_id: MILAGROS, member_type: 'guest' }];
  await browser({ account: null });
  assert.equal((await readGuestSession())?.guest_id, MILAGROS);
  assert.equal((await readGuestSession({ eventId: EVENT }))?.guest_id, MILAGROS);
  assert.equal((await readGuestPassStanding()).standing, 'signed_out');
  assert.equal(factReads, 0, 'a signed-out guest paid for an account read');
});

test('4 · a host who pressed "Open as Milagros" sees her — only her, only on this event', async () => {
  fresh();
  members = [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }];
  await browser({ account: HOST, hostOpens: rule.hostPreviewCookieValue(EVENT, MILAGROS) });
  assert.equal((await readGuestSession())?.guest_id, MILAGROS, 'the host’s own press did not open her');
  assert.equal((await readGuestPassStanding()).standing, 'host_preview');
  await browser({ account: HOST, hostOpens: rule.hostPreviewCookieValue(EVENT, COUSIN) });
  assert.equal(await readGuestSession(), null, 'a mark for another guest opened Milagros');
  await browser({ account: HOST, hostOpens: rule.hostPreviewCookieValue(OTHER_EVENT, MILAGROS) });
  assert.equal(await readGuestSession(), null, 'a mark for another event opened her here');
  // A non-host cannot use the mark at all.
  members = [{ user_id: ACCOUNT, guest_id: COUSIN, member_type: 'guest' }];
  await browser({ account: ACCOUNT, hostOpens: rule.hostPreviewCookieValue(EVENT, MILAGROS) });
  assert.equal(await readGuestSession(), null, 'a guest used the host’s preview mark');
});

test('5 · a signed-in claimant keeps a pass nobody holds; a pass another account holds is not theirs', async () => {
  fresh();
  await browser({ account: ACCOUNT });
  assert.equal((await readGuestSession())?.guest_id, MILAGROS, 'the "Save it to your account" prompt lost its pass');
  assert.equal((await readGuestPassStanding()).standing, 'claimant');
  members = [{ user_id: SOMEONE_ELSE, guest_id: MILAGROS, member_type: 'guest' }];
  await browser({ account: ACCOUNT });
  assert.equal(await readGuestSession(), null, 'another account’s invitation spoke for this one');
  assert.equal((await readGuestPassStanding()).setAside?.standing, 'set_aside_held');
});

test('6 · facts unreadable → no pass (fail closed); a lapsed sign-in is signed OUT, never a lockout', async () => {
  fresh();
  factsRefused = true;
  await browser({ account: ACCOUNT });
  assert.equal(await readGuestSession(), null, 'a refused read let the pass speak for a signed-in account');
  assert.equal((await readGuestPassStanding()).setAside?.standing, 'set_aside_unread');
  fresh();
  members = [{ user_id: HOST, guest_id: GROOM, member_type: 'couple' }];
  authFault = 'expired';
  await browser({ account: HOST });
  assert.equal((await readGuestSession())?.guest_id, MILAGROS, 'a stale sign-in cookie locked a guest out of their pass');
  fresh();
  authFault = 'down';
  await browser({ account: ACCOUNT });
  assert.equal(await readGuestSession(), null, 'an auth outage let the pass speak for a signed-in browser');
});

test('the rule, every standing, in one table', () => {
  const facts = (f: Partial<import('./pass-account-rule').PassAccountFacts>) => ({
    ownGuestIds: [],
    isHost: false,
    passRowHolders: [],
    ...f,
  });
  const at = (userId: string | null, f: ReturnType<typeof facts> | null, preview: string | null = null) =>
    rule.passStanding({ userId, passGuestId: MILAGROS, facts: f, hostPreviewGuestId: preview });
  assert.equal(at(null, null), 'signed_out');
  assert.equal(at(HOST, null), 'set_aside_unread');
  assert.equal(at(HOST, facts({ ownGuestIds: [MILAGROS], isHost: true })), 'own');
  assert.equal(at(HOST, facts({ ownGuestIds: [GROOM], isHost: true })), 'set_aside_host');
  assert.equal(at(HOST, facts({ isHost: true }), MILAGROS), 'host_preview');
  assert.equal(at(ACCOUNT, facts({ ownGuestIds: [COUSIN] })), 'set_aside_seat');
  assert.equal(at(ACCOUNT, facts({ ownGuestIds: [COUSIN] }), MILAGROS), 'set_aside_seat');
  assert.equal(at(ACCOUNT, facts({ passRowHolders: [SOMEONE_ELSE] })), 'set_aside_held');
  assert.equal(at(ACCOUNT, facts({})), 'claimant');
  for (const s of ['signed_out', 'own', 'claimant', 'host_preview'] as const) assert.equal(rule.passIsHonoured(s), true, s);
  for (const s of ['set_aside_host', 'set_aside_seat', 'set_aside_held', 'set_aside_unread'] as const) {
    assert.equal(rule.passIsHonoured(s), false, s);
  }
  assert.equal(rule.heldPassLine('Milagros'), 'This browser also holds Milagros\u2019s invitation. Viewing as you.');
  assert.equal(rule.hostPreviewGuestFor('garbage', EVENT), null);
  assert.equal(rule.hostPreviewGuestFor(rule.hostPreviewCookieValue(EVENT, MILAGROS), EVENT), MILAGROS);
});

/*
  7 · ONE READER. A file that reads the pass cookies or verifies a pass token itself decides "who is this guest" without
  the account rule. Each file below touches them for a reason that is NOT identity; anything else must call
  `readGuestSession` (or `readGuestPassStanding`). Comments are stripped first — a docblock naming the cookie is fine.
*/
const MAY_TOUCH_THE_PASS_COOKIES: Record<string, string> = {
  'lib/guest-session.ts': 'THE resolver — the account rule lives here',
  'lib/guest-pass-book.ts': 'defines the pass book cookie name and its wire format',
  'middleware.ts': 'slides the pass’s expiry and swaps the active pass per path — never decides who is looking',
  'app/[slug]/live-pulse/route.ts': 'a change stamp with no name, id or content — the signature is the whole door',
  'app/auth/sign-out/route.ts': 'sign out everywhere: deletes every pass cookie',
  'app/[slug]/redeem/route.ts': 'Problems-log evidence: whether a pass cookie is PRESENT (a boolean, never an identity)',
  'app/[slug]/invite/enter/page.tsx': 'Problems-log evidence: whether a pass cookie is PRESENT (a boolean, never an identity)',
  'lib/guest-one-path.server.ts': 'Problems-log evidence: whether a pass cookie is PRESENT (a boolean, never an identity)',
};
const RAW_PASS = /\bGUEST_SESSION_COOKIE_NAME\b|\bGUEST_PASS_BOOK_COOKIE_NAME\b|\bverifyGuestSessionToken\b|\bverifyGuestPassBook\b|['"`]setnayan_guest_(?:session|passes)['"`]/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('7 · every file that touches the pass cookies is on the reasoned list — everything else reads through the resolver', () => {
  const root = join(__dirname, '..');
  const files = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'lib')), join(root, 'middleware.ts')];
  assert.ok(files.length > 500, `walked only ${files.length} files`);
  const touching = files
    .filter((f) => RAW_PASS.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(root, f).split('\\').join('/'));
  const strays = touching.filter((f) => !(f in MAY_TOUCH_THE_PASS_COOKIES));
  assert.deepEqual(strays, [], `read the pass through readGuestSession instead: ${strays.join(', ')}`);
  for (const f of Object.keys(MAY_TOUCH_THE_PASS_COOKIES)) {
    assert.ok(touching.includes(f), `${f} no longer touches the pass cookies — take it off the list`);
  }
  // The readers really do come through it: the page, the reply, Me's actions, Papic, the check-in pass.
  const readers = files.filter((f) => /\breadGuestSession\b|\breadGuestPassStanding\b|\breadGuestSessionForEvent\b/.test(readFileSync(f, 'utf8')));
  assert.ok(readers.length >= 60, `only ${readers.length} files read the pass through the resolver`);
});
