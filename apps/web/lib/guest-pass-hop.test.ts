/**
 * A PERSONAL LINK ALWAYS OPENS THAT GUEST'S INVITATION — whatever the phone
 * already holds (owner's live iPhone test, 2026-10-02: on the host's own phone
 * `/cale-ice?invite=<token>` landed on the Event Hub's "Get inside", signed in
 * and signed out; the same link worked on another phone).
 *
 *   1 · the predicate: which requests write or clear the guest pass;
 *   2 · the service worker carries the SAME predicate (it cannot import it) and
 *       leaves those navigations to the browser — run here, not grepped;
 *   3 · the middleware never re-signs the old pass on those requests (or on a
 *       Server Action) — a second writer of the cookie the route is writing;
 *   4 · the redeem writes the link's pass UNCONDITIONALLY before it opens the
 *       landing — it never asks what the phone held first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  isGuestPassHop,
  isLinkPreviewFetch,
  mayRefreshGuestPass,
  passHeldKind,
  passHopMissFault,
  uaFamily,
  type PassHopMissRule,
} from './guest-pass-hop';
import { createRequire } from 'node:module';

/* `server-only` shim — lib/telemetry/fault-log.ts opens with `import 'server-only'`,
   a BUNDLER assertion with no runtime behaviour that does not exist in
   node_modules. Resolved to an empty module (same shim and reasoning as
   app/[slug]/_components/editorial/recap-voice.test.ts) so § 7 drives the REAL
   `shapeFaultArgs` — the one chokepoint that shapes what is stored. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(__filename);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_pass_hop__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
const { shapeFaultArgs } = nodeRequire('@/lib/telemetry/fault-log') as typeof import('@/lib/telemetry/fault-log');

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));

/** [path+query, is a pass hop] */
const TABLE: Array<[string, boolean]> = [
  ['/cale-ice?invite=S89G-ABC', true],
  ['/cale-ice?invite=%20', false],
  ['/cale-ice?invite=', false],
  ['/u/ice/cale-ice?invite=tok', true],
  ['/cale-ice/redeem?slug=cale-ice&token=tok', true],
  // the re-entry code's exchange (the tile's start, the landing's "Open in Safari")
  ['/cale-ice/redeem?slug=cale-ice&k=code&to=hub', true],
  ['/cale-ice/invite/enter?k=code', false],
  ['/cale-ice/seat/claim?t=1', true],
  ['/cale-ice/sign-out', true],
  ['/auth/sign-out', true],
  ['/papic/me/tok123/session', true],
  ['/cale-ice', false],
  ['/cale-ice?save=1', false],
  ['/cale-ice/invite/enter', false],
  ['/cale-ice/invite/reply', false],
  ['/cale-ice/find-my-table', false],
  ['/cale-ice/seat', false],
  ['/papic/me/tok123', false],
  ['/dashboard/ev-1', false],
  ['/', false],
];

test('1 · a personal link, its redeem, a claim, a hand-off and a sign-out are pass hops — nothing else is', () => {
  for (const [href, want] of TABLE) {
    const u = new URL(href, 'https://www.setnayan.com');
    assert.equal(isGuestPassHop(u.pathname, u.search), want, href);
    assert.equal(isGuestPassHop(u.pathname, u.searchParams), want, `${href} (URLSearchParams)`);
  }
});

test('2 · the service worker runs the SAME predicate, and lets every pass hop go to the browser', () => {
  const sw = raw('public/sw.js');
  const src = /function isGuestPassHop\(url\) \{[\s\S]*?\n\}/.exec(sw)?.[0];
  assert.ok(src, 'public/sw.js lost isGuestPassHop');
  // eslint-disable-next-line no-new-func
  const swHop = new Function(`${src}; return isGuestPassHop;`)() as (u: URL) => boolean;
  for (const [href] of TABLE) {
    const u = new URL(href, 'https://www.setnayan.com');
    assert.equal(swHop(u), isGuestPassHop(u.pathname, u.search), `sw.js and lib/guest-pass-hop.ts disagree on ${href}`);
  }
  // …and asks it BEFORE the day-of handler can take the navigation.
  const body = stripComments(sw);
  const fetchAt = body.indexOf("self.addEventListener('fetch'");
  const hop = body.indexOf('if (isNavigation && isGuestPassHop(url)) return;', fetchAt);
  const dayOf = body.indexOf('if (isNavigation && isDayOfGuestNavigation(url))', fetchAt);
  assert.ok(hop > fetchAt, 'the fetch handler never asks isGuestPassHop');
  assert.ok(hop < dayOf, 'the day-of handler takes a pass hop before it is let go');
});

test('3 · the middleware slides the pass only on a plain read that is not a pass hop', () => {
  assert.equal(mayRefreshGuestPass('GET', '/cale-ice', ''), true);
  assert.equal(mayRefreshGuestPass('HEAD', '/cale-ice/hub', ''), true);
  assert.equal(mayRefreshGuestPass('GET', '/cale-ice', '?invite=tok'), false, 'the old pass is re-signed onto the personal link');
  assert.equal(mayRefreshGuestPass('GET', '/cale-ice/redeem', '?slug=cale-ice&token=tok'), false, 'two writers on the redeem');
  assert.equal(mayRefreshGuestPass('GET', '/auth/sign-out', ''), false, 'the old pass is re-signed over a sign-out');
  assert.equal(mayRefreshGuestPass('POST', '/cale-ice', ''), false, 'a Server Action that writes the pass races a refresh');
  const mw = read('middleware.ts');
  const fn = mw.slice(mw.indexOf('async function refreshGuestSessionCookie('));
  const gate = fn.indexOf('if (!mayRefreshGuestPass(request.method, request.nextUrl.pathname, request.nextUrl.search)) return;');
  assert.ok(gate > -1, 'the refresh no longer asks mayRefreshGuestPass');
  assert.ok(gate < fn.indexOf('signGuestSession('), 'the pass is re-signed before the hop is checked');
});

test('4 · the redeem writes the link\'s pass unconditionally, then opens that guest\'s landing', () => {
  const whole = read('app/[slug]/redeem/route.ts');
  // The TOKEN path — everything after the re-entry code's own branch (which is
  // spent, so it does ask the phone first: lib/guest-reentry.test.ts § 6).
  const route = whole.slice(whole.indexOf('const { data: keyRow }'));
  assert.ok(whole.includes('const { data: keyRow }'), 'the redeem lost its token read');
  assert.doesNotMatch(route, /readGuestSession\(|readGuestSessionForEvent\(/, 'the redeem consults the pass the phone already held');
  const set = route.indexOf('await setGuestSession({');
  const land = route.lastIndexOf('return NextResponse.redirect(landing);');
  assert.ok(set > -1 && land > set, 'the landing opens before the link\'s pass is written');
  // The page hands EVERY tokened URL to the redeem before it reads anything else.
  const page = read('app/[slug]/page.tsx');
  const body = page.slice(page.indexOf('export default async function PublicInvitationPage('));
  const hand = body.indexOf('if (invite) {');
  assert.ok(hand > -1 && hand < body.indexOf('loadEventShell('), 'the page reads the event (or a session) before handing the link to redeem');
});

/* ══ 2026-10-04 · I4 — THE CAUSE: A LINK PREVIEW DROPPED THE TOKEN ══════════ */

const UA = {
  facebookCrawler: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  iMessagePreview: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
  whatsappPreview: 'WhatsApp/2.23.20.0 A',
  metaAgent: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  telegram: 'TelegramBot (like TwitterBot)',
  // People — every one of these must be redirected to the redeem as before.
  messengerIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/MessengerForiOS;FBAV/480.0.0.40.109;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0.0.40.109;]',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0]',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_0; en_US)',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Safari Line/14.16.0',
  viber: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Viber/22.0.0.0',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  homeScreenTile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  setnayanApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp/1.0',
} as const;

/** [visit scenario, user agent, is a link-preview fetcher (answered in place)] */
const VISITS: Array<[string, string, boolean]> = [
  ['Messenger draws the card under the link', UA.facebookCrawler, true],
  ['iMessage draws the card', UA.iMessagePreview, true],
  ['WhatsApp draws the card', UA.whatsappPreview, true],
  ['Meta\'s newer fetcher', UA.metaAgent, true],
  ['Telegram draws the card', UA.telegram, true],
  ['first visit — the guest taps the link in Messenger (iPhone)', UA.messengerIos, false],
  ['first visit — Messenger on Android', UA.messengerAndroid, false],
  ['first visit — the Facebook app', UA.facebookIos, false],
  ['first visit — Instagram DM', UA.instagram, false],
  ['first visit — Line', UA.line, false],
  ['first visit — Viber', UA.viber, false],
  ['second visit in Safari (service worker installed)', UA.safari, false],
  ['the home-screen tile', UA.homeScreenTile, false],
  ['Chrome on Android', UA.chromeAndroid, false],
  ['the Setnayan app', UA.setnayanApp, false],
  ['no user agent at all', '', false],
];

test('5 · only a link-preview FETCHER is answered in place — every person, in every app, still takes the hop', () => {
  for (const [visit, ua, want] of VISITS) {
    assert.equal(isLinkPreviewFetch(ua), want, visit);
  }
});

test('6 · the event page answers a fetcher with a 200 whose og:url IS the personal link — never the bare Event Hub', () => {
  const page = read('app/[slug]/page.tsx');
  const body = page.slice(page.indexOf('export default async function PublicInvitationPage('));
  const hop = body.slice(body.indexOf('if (invite) {'), body.indexOf('const admin = createAdminClient();'));
  const asks = hop.indexOf("isLinkPreviewFetch((await headers()).get('user-agent'))");
  const leaves = hop.indexOf('redirect(redeemHref);');
  assert.ok(asks > -1, 'a link-preview fetcher is redirected through the redeem again');
  assert.ok(leaves > asks, 'the page redirects before it asks who is fetching');
  // …and the metadata such a fetcher reads names the personal link.
  const meta = page.slice(page.indexOf('export async function generateMetadata('), page.indexOf('export default async function PublicInvitationPage('));
  assert.match(meta, /const personalLink = isUrlSecretShaped\(search\.invite\?\.trim\(\)\)\s*\?\s*invitationLinkOn\(canonicalUrl, search\.invite!\.trim\(\)\)/);
  assert.match(meta, /url: personalLink \?\? canonicalUrl,/, 'og:url is the bare Event Hub under a personal link');
  assert.match(meta, /canonical: personalLink \?\? canonicalUrl/);
  assert.match(meta, /preview\.indexable && !personalLink \?/, 'a personal link could be indexed');
});

/* ══ EVIDENCE — A PERSONAL-LINK VISIT THAT MISSED THE LANDING IS LOGGED ══════ */

// Fixtures shaped like a pass token and a re-entry code — repeated letters, no real value.
const SECRET_TOKEN = 't'.repeat(32);
const SECRET_CODE = 'k'.repeat(43);

test('7 · a miss becomes ONE grouped Problems row — rule, path template, steps, UA family, what the phone held — and never a token, code or name', () => {
  const rules: PassHopMissRule[] = ['enter:no-key', 'enter:guest-gone', 'redeem:missing', 'redeem:unknown-token', 'reentry:refused'];
  for (const rule of rules) {
    const fault = passHopMissFault({
      rule,
      steps: ['link', 'redeem', 'enter'],
      userAgent: UA.messengerIos,
      held: 'other-event',
      carriedCode: true,
      reason: rule === 'reentry:refused' ? 'expired' : undefined,
    });
    const args = shapeFaultArgs(fault, 'sha');
    assert.equal(args.p_kind, 'DEAD_END');
    assert.equal(args.p_action, `guest-pass-hop#${rule}`, 'misses do not group per rule');
    const trace = args.p_trace as Record<string, unknown>;
    assert.equal(trace.rule, rule);
    assert.equal(trace.steps, 'link>redeem>enter');
    assert.equal(trace.ua, 'ios/messenger');
    assert.equal(trace.held, 'other-event');
    assert.equal(trace.code, 'carried');
    assert.ok(String(trace.path).startsWith('/[slug]/'), 'the path is not a template');
    const stored = JSON.stringify(args);
    assert.ok(!stored.includes(SECRET_TOKEN) && !stored.includes(SECRET_CODE), 'a token or code reached the log');
    assert.ok(!stored.includes('FBAN/MessengerForiOS'), 'the raw user agent reached the log (a family only)');
    // Exactly these facts — a new key is a new thing stored about a guest, and must be decided here.
    assert.deepEqual(
      Object.keys(trace).sort(),
      ['code', 'held', 'path', 'rule', 'steps', 'sw', 'ua', ...(rule === 'reentry:refused' ? ['why'] : [])].sort(),
      'the Problems row stores something new',
    );
  }
  assert.equal(uaFamily(UA.safari), 'ios/safari');
  assert.equal(uaFamily(UA.homeScreenTile), 'ios/ios-webview');
  assert.equal(uaFamily(UA.facebookCrawler), 'link-preview');
});

test('8 · the misses are recorded where they happen — and no recorder is handed the URL, the token or the code', () => {
  const route = read('app/[slug]/redeem/route.ts');
  const enter = read('app/[slug]/invite/enter/page.tsx');
  // redeem: a missing link, an unknown token, a refused code
  for (const rule of ['redeem:missing', 'redeem:unknown-token', 'reentry:refused']) {
    assert.ok(route.includes(`rule: '${rule}'`), `the redeem does not record ${rule}`);
  }
  // the landing: no key in this browser, or the guest row is gone → logged, then the Event Hub
  const noKey = enter.indexOf("return leaveForTheHub(home, event.event_id as string, 'enter:no-key', false);");
  const gone = enter.indexOf("if (!guest) return leaveForTheHub(home, event.event_id as string, 'enter:guest-gone', carriedCode);");
  assert.ok(noKey > -1 && gone > noKey, 'the landing leaves for the Event Hub without a record');
  const leave = enter.slice(enter.indexOf('async function leaveForTheHub('));
  // The ONLY thing that skips the record is a link-preview robot.
  assert.match(leave, /if \(!isLinkPreviewFetch\(userAgent\)\) \{\s*await recordFault\(\s*passHopMissFault\(/, 'the landing\'s miss is not recorded for a person');
  assert.match(route, /if \(isLinkPreviewFetch\(userAgent\)\) return;\s*await recordFault\(passHopMissFault\(/, 'the redeem\'s miss is not recorded for a person');
  assert.ok(leave.indexOf('await recordFault(') > -1 && leave.indexOf('await recordFault(') < leave.indexOf('redirect(`/${home}`)'), 'the miss is logged after the redirect (never)');
  assert.doesNotMatch(enter, /redirect\(`\/\$\{home\}`\);\n\s*\n\s*const \{ data: guest/, 'a bare redirect to the Event Hub is back');
  // No recorder call is ever handed a secret.
  for (const [file, src] of [['redeem', route], ['enter', enter]] as const) {
    const calls = src.match(/(recordMiss\(request, \{[^}]*\}|passHopMissFault\(\s*\{[^}]*\})/g) ?? [];
    assert.ok(calls.length > 0, `${file}: no recorder call found`);
    for (const c of calls) {
      // Identifiers only — a rule NAME like 'redeem:unknown-token' is a word, not a value.
      const code = c.replace(/'[^']*'/g, "''");
      assert.doesNotMatch(code, /\btoken\b|reentryCode|search\.k|url\b|qr_token/, `${file} hands a secret to the Problems log: ${c}`);
    }
  }
});

/* ══ 9 · A LINK-PREVIEW FETCHER NEVER SPENDS A GUEST'S CODE (2026-10-04 audit) ══
   A chat app previewing a pasted landing address (`/{slug}/invite/enter?k=`)
   followed it to the redeem, EXCHANGED the single-use code and took the
   Set-Cookie. Driven through the REAL route: every database read goes through
   `fetch`, so a fetcher's request must reach no `fetch` at all — while a
   person's identical request does (the anti-vacuity half). */
async function redeemAs(userAgent: string, query: string) {
  const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, fetch: globalThis.fetch };
  const calls: string[] = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(64);
  globalThis.fetch = (async (input: unknown) => {
    calls.push(String(input instanceof Request ? input.url : input));
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const { GET } = nodeRequire('@/app/[slug]/redeem/route') as typeof import('@/app/[slug]/redeem/route');
    const { NextRequest } = nodeRequire('next/server') as typeof import('next/server');
    let res: Response | null = null;
    try {
      res = await GET(new NextRequest(`https://setnayan.test/maria-and-jose/redeem?${query}`, { headers: { 'user-agent': userAgent } }));
    } catch {
      res = null; // a person's request runs on into request-scoped reads this harness does not provide
    }
    return { res, calls };
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  }
}

test('9 · a link-preview fetcher on a `?k=` (or a token) is answered in place — no code spent, no cookie, no redirect', async () => {
  for (const ua of [UA.facebookCrawler, UA.iMessagePreview, UA.whatsappPreview, UA.telegram]) {
    for (const query of [`slug=maria-and-jose&k=${SECRET_CODE}&to=landing`, `slug=maria-and-jose&k=${SECRET_CODE}&to=hub`, `slug=maria-and-jose&token=${SECRET_TOKEN}`]) {
      const { res, calls } = await redeemAs(ua, query);
      assert.ok(res, `${uaFamily(ua)} ${query}: the route threw`);
      assert.equal(res!.status, 200, `${uaFamily(ua)}: a fetcher was redirected (it would follow it)`);
      assert.equal(res!.headers.get('set-cookie'), null, `${uaFamily(ua)}: a fetcher was handed a cookie`);
      assert.equal(res!.headers.get('location'), null);
      assert.deepEqual(calls, [], `${uaFamily(ua)}: a fetcher reached the database (a code could be spent)`);
      const html = await res!.text();
      assert.ok(!html.includes(SECRET_CODE) && !html.includes(SECRET_TOKEN), 'the answer echoes the secret');
    }
  }
  // Anti-vacuity: the SAME request from a person reaches the database.
  const person = await redeemAs(UA.safari, `slug=maria-and-jose&k=${SECRET_CODE}&to=landing`);
  assert.ok(person.calls.length > 0, 'the harness cannot see a database read — the fetcher half proves nothing');
});

test('9b · the landing answers a fetcher carrying `?k=` in place — it is never sent on to the redeem', () => {
  const enter = read('app/[slug]/invite/enter/page.tsx');
  const body = enter.slice(enter.indexOf('export default async function InviteEnterPage('));
  const branch = body.slice(body.indexOf('if (carriedCode) {'));
  assert.ok(body.includes('if (carriedCode) {'), 'anti-vacuity: the landing lost its code branch');
  const asks = branch.indexOf("isLinkPreviewFetch((await headers()).get('user-agent'))");
  const sends = branch.indexOf("redirect(reentryRedeemPath(home, search.k!, 'landing'));");
  assert.ok(asks > -1 && sends > asks, 'a fetcher is redirected to the redeem before anyone asks who is fetching');
  assert.ok(/return <LinkPreviewAnswer href=\{reentryRedeemPath\(home, search\.k!, 'landing'\)\} \/>;/.test(branch.slice(asks, sends)), 'a fetcher is not answered in place');
  const answer = enter.slice(enter.indexOf('function LinkPreviewAnswer('), enter.indexOf('async function heldKind('));
  assert.ok(answer.length > 0 && !/redirect\(|setGuestSession|cookies\(\)/.test(answer), 'the in-place answer redirects or writes a pass');
});

/* ══ 10 · WHAT THE PHONE HELD IS SAID HONESTLY (2026-10-04 audit) ═════════════ */
test('10 · the held label: a pass for THIS event (any guest) is `this-event`, never `other-event`', () => {
  const E = 'ev-1';
  assert.equal(passHeldKind({ cookiePresent: false, pass: null, eventId: E }), 'none');
  assert.equal(passHeldKind({ cookiePresent: true, pass: null, eventId: E }), 'revoked');
  assert.equal(passHeldKind({ cookiePresent: true, pass: { event_id: E }, eventId: E }), 'this-event');
  assert.equal(passHeldKind({ cookiePresent: true, pass: { event_id: 'ev-2' }, eventId: E }), 'other-event');
  // The redeem and the landing both say it through the ONE answer.
  const route = read('app/[slug]/redeem/route.ts');
  const refused = route.slice(route.indexOf("rule: 'reentry:refused'"), route.indexOf('carriedCode: true', route.indexOf("rule: 'reentry:refused'")));
  assert.ok(refused.length > 0, 'anti-vacuity: the refused-code record moved');
  assert.match(refused, /held: passHeldKind\(\{[\s\S]*?pass: held,[\s\S]*?eventId: event\.event_id,?\s*\}\)/, 'the redeem guesses what the phone held');
  assert.doesNotMatch(route, /held \? 'other-event'/, 'any pass is logged as another event again');
  const enter = read('app/[slug]/invite/enter/page.tsx');
  assert.match(enter, /return passHeldKind\(\{ cookiePresent, pass: cookiePresent \? await readGuestSession\(\) : null, eventId \}\);/);
});
