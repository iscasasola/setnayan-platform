/**
 * ONE GUEST PASS PER EVENT — opening event B's personal link never evicts event A's pass.
 *
 * The fault (handovers/safari-pass.md, reproduced exactly in WebKit 2026-10-12): a browser held ONE
 * guest pass (`setnayan_guest_session`). Tab A = maria-and-jose's landing; tab B opens Bean's marco-marga
 * link → the pass is now marco-marga's → A's Reply → A's stranger door, once the landing's 30-minute
 * `?k=` code (#6480) is gone. A guest invited to two events (wedding season; the owner's own Safari on
 * 2026-10-11) loses the first the moment they open the second.
 *
 * WHAT IS HELD — each over REAL signed tokens, through the same functions the middleware and the
 * route handlers call (a browser jar of two cookies, driven hop by hop):
 *   (1) Two events' links in one browser → Reply on the FIRST still opens the questions, no `?k=`.
 *   (2) …and the second's, in the other tab, too — each request carries its own event's pass.
 *   (3) A stranger (no pass, no code) still meets the door — and a book holding A and B opens nothing on C.
 *   (4) A guest sign-out on A removes A's pass ONLY; B's stays and is the active one again.
 *       "Sign out everywhere" (/auth/sign-out) deletes the pass book with the pass.
 *   (5) The OLD single cookie still works — read as it always was, and moved into the book on the next link.
 *   (6) One pass per event, the newest 8 kept, the cookie well under 4 KB; expired passes fall out;
 *       a book token is never a pass and a pass token is never a book.
 *   (7) The wiring: the middleware swaps BEFORE the body and persists only on a plain read (one writer
 *       per hop); the event reader looks in the book by event id; every pass write goes through the book.
 *   (8) Evidence: the Reply's re-key / door writes one Problems-log row with what the browser held.
 *
 * SABOTAGE RUN 2026-10-12: see the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
  clearedPassCookies,
  nextPassCookies,
  passSwapForPath,
  signGuestPassBook,
  signGuestSession,
  verifyGuestPassBook,
  verifyGuestSessionToken,
  type GuestSessionPayload,
  type PassJar,
} from '@/lib/guest-session';
import {
  GUEST_PASS_BOOK_CAP,
  GUEST_PASS_BOOK_COOKIE_NAME,
  bookEntryForPath,
  type GuestPassBookEntry,
} from '@/lib/guest-pass-book';
import { mayRefreshGuestPass, passHopMissFault, replyEntry } from '@/lib/guest-pass-hop';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

process.env.GUEST_SESSION_SECRET = 'p'.repeat(64);

const A: GuestSessionPayload = { guest_id: '2a1d5a99-0000-4000-8000-00000000000a', event_id: 'eeeeeeee-0000-4000-8000-00000000000a', qr_token: 'a'.repeat(32) };
const B: GuestSessionPayload = { guest_id: 'bea00000-0000-4000-8000-00000000000b', event_id: 'eeeeeeee-0000-4000-8000-00000000000b', qr_token: 'b'.repeat(32) };
const SLUGS: Record<string, string> = { [A.event_id]: 'maria-and-jose', [B.event_id]: 'marco-marga' };
const lookup = async (ids: readonly string[]) => Object.fromEntries(ids.filter((id) => SLUGS[id]).map((id) => [id, SLUGS[id]!]));

/** A personal link's redeem: `setGuestSession` over the jar. */
async function openLink(jar: PassJar, pass: GuestSessionPayload, slugs = lookup): Promise<PassJar> {
  const next = await nextPassCookies(jar, pass, slugs);
  return { active: next.active.value, book: next.book ? next.book.value : null };
}

/**
 * One request through the middleware's swap (middleware.ts `activatePassForEvent`): returns the pass the
 * REQUEST carries (what the page reads) and the jar after the response (the swap persists only on a plain read).
 */
async function hop(jar: PassJar, pathname: string, method = 'GET'): Promise<{ seen: GuestSessionPayload | null; jar: PassJar; requestJar: PassJar }> {
  const swap = await passSwapForPath({ jar, pathname });
  const requestJar = swap ? { ...jar, active: swap.value } : jar;
  const after = swap && mayRefreshGuestPass(method, pathname, '') ? requestJar : jar;
  const seen = requestJar.active ? ((await verifyGuestSessionToken(requestJar.active))?.payload ?? null) : null;
  return { seen, jar: after, requestJar };
}

/** The reply page's gate (`readGuestSessionForEvent` → `replyEntry`), for this event, carrying no code. */
async function reply(jar: PassJar, slug: string, eventId: string) {
  const { seen, jar: after } = await hop(jar, `/${slug}/invite/reply`);
  return { entry: replyEntry({ slug, hasPass: seen?.event_id === eventId, code: null }), jar: after };
}

test('(1) two events\' links in one browser → Reply on the FIRST still opens the questions — no ?k=', async () => {
  let jar: PassJar = {};
  jar = await openLink(jar, A); // tab A: maria-and-jose's personal link
  jar = await openLink(jar, B); // tab B: Bean's marco-marga link — this used to evict A
  assert.equal((await verifyGuestSessionToken(jar.active!))?.payload.event_id, B.event_id, 'the newest link is the active pass');

  const { entry } = await reply(jar, 'maria-and-jose', A.event_id);
  assert.deepEqual(entry, { kind: 'ask' }, 'THE FAULT: A\'s Reply met the stranger door because B\'s link replaced A\'s pass');

  // Without the book (the old single cookie) the same press is the door — the book is what saves it.
  const { entry: old } = await reply({ active: jar.active }, 'maria-and-jose', A.event_id);
  assert.equal(old.kind, 'door', 'the guard no longer proves the book is what keeps A');
});

test('(2) …and B\'s Reply in the other tab too — each request carries its own event\'s pass', async () => {
  let jar = await openLink(await openLink({}, A), B);
  const first = await reply(jar, 'maria-and-jose', A.event_id);
  assert.equal(first.entry.kind, 'ask');
  jar = first.jar; // the plain read made A active
  assert.equal((await verifyGuestSessionToken(jar.active!))?.payload.event_id, A.event_id, 'a plain read did not persist the swap');
  const second = await reply(jar, 'marco-marga', B.event_id);
  assert.equal(second.entry.kind, 'ask', 'B lost its pass to A\'s tab');
  // A Server Action (POST) on A reads A's pass on the request, without a second writer on the response.
  const post = await hop(second.jar, '/maria-and-jose');
  const action = await hop(second.jar, '/maria-and-jose', 'POST');
  assert.equal(action.seen?.event_id, A.event_id, 'a Server Action on A read another event\'s pass');
  assert.equal(action.jar.active, second.jar.active, 'a POST wrote the pass from the middleware (two writers on a hop)');
  assert.equal(post.seen?.event_id, A.event_id);
});

test('(3) a stranger still gets the door; a book holding A and B opens nothing on C', async () => {
  const stranger = await reply({}, 'maria-and-jose', A.event_id);
  assert.deepEqual(stranger.entry, { kind: 'door', href: '/maria-and-jose' }, 'a browser with no pass is let in');
  const jar = await openLink(await openLink({}, A), B);
  const other = await reply(jar, 'someone-else', 'eeeeeeee-0000-4000-8000-00000000000c');
  assert.equal(other.entry.kind, 'door', 'another event\'s pass opened a third event');
  assert.equal((await passSwapForPath({ jar, pathname: '/someone-else/invite/reply' })), null);
});

test('(4) a guest sign-out on A removes A\'s pass ONLY; B\'s stays (and is active again); everywhere removes all', async () => {
  let jar = await openLink(await openLink({}, A), B);
  // POST /maria-and-jose/sign-out: a pass hop — swapped on the request, never on the response.
  const { requestJar } = await hop(jar, '/maria-and-jose/sign-out', 'POST');
  assert.equal((await verifyGuestSessionToken(requestJar.active!))?.payload.event_id, A.event_id, 'the sign-out read another event\'s pass');
  const cleared = await clearedPassCookies(requestJar, { eventId: A.event_id, slug: 'maria-and-jose' });
  assert.notEqual(cleared.active, 'keep');
  assert.ok(cleared.book !== 'keep' && cleared.book !== null, 'the book was dropped whole');
  jar = {
    active: cleared.active === 'delete' ? null : (cleared.active as { value: string }).value,
    book: (cleared.book as { value: string }).value,
  };
  const left = await verifyGuestPassBook(jar.book);
  assert.deepEqual(left.map((e) => e.event_id), [B.event_id], 'the sign-out on A took the wrong pass');
  assert.equal((await verifyGuestSessionToken(jar.active!))?.payload.event_id, B.event_id, 'B is not the active pass after A signed out');
  assert.equal((await reply(jar, 'maria-and-jose', A.event_id)).entry.kind, 'door', 'A is still signed in after its sign-out');
  assert.equal((await reply(jar, 'marco-marga', B.event_id)).entry.kind, 'ask', 'signing out of A signed B out');

  // Signing out on A while the active pass is B's (A unknown here) keeps B active.
  const keep = await clearedPassCookies({ active: jar.active }, { eventId: A.event_id, slug: 'maria-and-jose' });
  assert.equal(keep.active, 'keep', 'a sign-out on A deleted B\'s active pass');
  // The last pass out: nothing is left active.
  const last = await clearedPassCookies(jar, { eventId: B.event_id, slug: 'marco-marga' });
  assert.equal(last.active, 'delete');
  assert.equal(last.book, null, 'an empty book is left behind instead of deleted');

  // "Sign out everywhere": the pass AND the pass book are deleted on the response.
  const out = code('app/auth/sign-out/route.ts');
  const loop = /for \(const name of \[([^\]]*)\]\)/.exec(out);
  assert.ok(loop && /GUEST_SESSION_COOKIE_NAME/.test(loop[1]!) && /GUEST_PASS_BOOK_COOKIE_NAME/.test(loop[1]!), 'sign out everywhere leaves a pass behind');
  assert.match(out, /readEveryGuestPass\(\)/, 'sign out everywhere no longer erases the selfie of every pass');
  // The guest's own sign-out names its event.
  assert.match(code('app/[slug]/sign-out/route.ts'), /clearGuestSession\(\{ slug, eventId \}\)/, 'the event sign-out clears whatever pass is active');
  assert.match(code('app/[slug]/welcome/actions.ts'), /clearGuestSession\(\{ slug \}\)/, '"not me" clears another event\'s pass');
});

test('(5) the OLD single cookie still works, and moves into the book on the next link', async () => {
  // A browser that got its pass before this deploy: the active cookie and nothing else.
  const legacy: PassJar = { active: await signGuestSession(A) };
  assert.equal(await passSwapForPath({ jar: legacy, pathname: '/maria-and-jose/invite/reply' }), null, 'a legacy pass is rewritten');
  assert.equal((await reply(legacy, 'maria-and-jose', A.event_id)).entry.kind, 'ask', 'the deploy signed out a guest holding the old cookie');
  // Opening another event's link keeps A — it moves into the book with its own expiry.
  const jar = await openLink(legacy, B);
  const book = await verifyGuestPassBook(jar.book);
  assert.deepEqual(book.map((e) => [e.slug, e.event_id]), [['marco-marga', B.event_id], ['maria-and-jose', A.event_id]]);
  const legacyExp = (await verifyGuestSessionToken(legacy.active!))!.expiresAtSeconds;
  assert.equal(book[1]!.exp, legacyExp, 'the old pass gained a fresh expiry by riding the book');
  assert.equal((await reply(jar, 'maria-and-jose', A.event_id)).entry.kind, 'ask', 'the old pass was evicted by the next link');
  // A slug lookup that fails still writes the pass, and the entry is still found by event id (/join).
  const blind = await openLink({}, A, async () => { throw new Error('db down'); });
  assert.ok(blind.active);
  const blindBook = await verifyGuestPassBook(blind.book);
  assert.equal(blindBook[0]!.slug, null);
  assert.equal(bookEntryForPath(blindBook, `/join/${A.event_id}`, Date.now() / 1000)?.event_id, A.event_id);
});

test('(6) one pass per event, the newest 8 kept, under 4 KB; expired out; a book is never a pass', async () => {
  // Re-opening an event with another guest's link (the host's phone) REPLACES that event's pass.
  const other = { ...A, guest_id: '2a1d5a99-0000-4000-8000-0000000000ff', qr_token: 'c'.repeat(32) };
  const rekeyed = await verifyGuestPassBook((await openLink(await openLink(await openLink({}, A), B), other)).book);
  assert.deepEqual(rekeyed.map((e) => e.guest_id), [other.guest_id, B.guest_id], 'two passes for one event');

  let jar: PassJar = {};
  const slugs: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    const id = `eeeeeeee-0000-4000-8000-${String(i).padStart(12, '0')}`;
    slugs[id] = `a-very-long-event-slug-number-${String(i).padStart(2, '0')}`.slice(0, 32);
    jar = await openLink(jar, { guest_id: `9a1d5a99-0000-4000-8000-${String(i).padStart(12, '0')}`, event_id: id, qr_token: 'f'.repeat(32) }, async (ids) =>
      Object.fromEntries(ids.map((x) => [x, slugs[x]!])),
    );
  }
  const book = await verifyGuestPassBook(jar.book);
  assert.equal(book.length, GUEST_PASS_BOOK_CAP);
  assert.equal(book[0]!.slug, slugs['eeeeeeee-0000-4000-8000-000000000011'], 'the newest pass is not first');
  assert.ok(!book.some((e) => e.event_id.endsWith('000000000000')), 'the oldest pass was kept over the cap');
  const header = `${GUEST_PASS_BOOK_COOKIE_NAME}=${jar.book}; Path=/; Max-Age=${GUEST_SESSION_COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=lax`;
  assert.ok(header.length < 3000, `the pass book is ${header.length} bytes — too near the 4 KB cookie limit`);

  // An expired pass is neither swapped in nor kept.
  const stale: GuestPassBookEntry = { slug: 'maria-and-jose', ...A, exp: Math.floor(Date.now() / 1000) - 5 };
  const live: GuestPassBookEntry = { slug: 'marco-marga', ...B, exp: Math.floor(Date.now() / 1000) + 3600 };
  const mixed = await signGuestPassBook([stale, live]);
  assert.equal(await passSwapForPath({ jar: { book: mixed }, pathname: '/maria-and-jose' }), null, 'an expired pass was made active');
  const swapped = await passSwapForPath({ jar: { book: mixed }, pathname: '/marco-marga' });
  assert.ok(swapped && swapped.maxAge <= 3600, 'a pass from the book outlived its own expiry');
  assert.deepEqual((await verifyGuestPassBook((await openLink({ book: mixed }, other)).book)).map((e) => e.event_id), [A.event_id, B.event_id]);

  // The two tokens never stand in for each other; a forged book is nothing.
  assert.equal(await verifyGuestSessionToken(mixed), null, 'a pass book was read as a pass');
  assert.deepEqual(await verifyGuestPassBook(await signGuestSession(A)), [], 'a pass was read as a pass book');
  assert.deepEqual(await verifyGuestPassBook(`${mixed.slice(0, -4)}AAAA`), [], 'a forged book was trusted');
  // The nested address finds its event (the middleware hands over the rewritten path).
  assert.equal(bookEntryForPath(book, `/${book[2]!.slug}/hub`, Date.now() / 1000)?.event_id, book[2]!.event_id);
});

test('(7) the wiring: swap before the body, persisted only on a plain read; readers ask the book by event', () => {
  const mw = code('middleware.ts');
  const main = mw.slice(mw.indexOf('export async function middleware('));
  const act = main.indexOf('await activatePassForEvent(request)');
  assert.ok(act > -1 && act < main.indexOf('await middlewareCore(request)'), 'the pass is swapped after the body has rendered');
  const persist = main.slice(main.indexOf('if (activated'), main.indexOf('response.cookies.set('));
  assert.match(persist, /mayRefreshGuestPass\(request\.method, request\.nextUrl\.pathname, request\.nextUrl\.search\)/, 'the swap is written on a pass hop (two writers)');
  const fn = mw.slice(mw.indexOf('async function activatePassForEvent('), mw.indexOf('async function refreshGuestSessionCookie('));
  assert.match(fn, /request\.cookies\.set\(GUEST_SESSION_COOKIE_NAME, swap\.value\)/, 'the swap no longer reaches the render');
  assert.match(fn, /userNestingRewritePath\(pathname\)/, 'the nested /u/ address lost its event');
  // The refresh slides the book entry with the pass.
  assert.match(mw.slice(mw.indexOf('async function refreshGuestSessionCookie(')), /refreshedPassBook\(/);

  const reader = code('lib/guest-one-path.server.ts');
  assert.match(reader, /readGuestSession\(\{ eventId \}\)/, 'the event reader ignores the pass book');
  const gs = code('lib/guest-session.ts');
  const set = gs.slice(gs.indexOf('export async function setGuestSession('));
  assert.match(set.slice(0, set.indexOf('\n}\n')), /nextPassCookies\(/, 'a pass write skips the pass book');
  // Nothing else writes the pass cookie by hand.
  assert.equal((gs.match(/cookieStore\.set\(\{ name: COOKIE_NAME/g) ?? []).length, 2, 'a new writer of the active pass');
});

test('(8) evidence: a Reply that re-keys or meets the door writes ONE row with what the browser held', () => {
  const row = passHopMissFault({ rule: 'reply:door', steps: ['reply', 'door'], userAgent: 'Mozilla/5.0 (Macintosh) Version/26.6 Safari/605.1.15', held: 'other-event', carriedCode: false, bookPasses: 1 });
  assert.equal(row.filePath, '/[slug]/invite/reply');
  assert.equal(row.trace.held, 'other-event');
  assert.equal(row.trace.book, 1);
  assert.equal(row.trace.ua, 'desktop/safari');
  assert.ok(!JSON.stringify(row).includes(A.qr_token));
  const page = code('app/[slug]/invite/reply/page.tsx');
  const gate = page.slice(page.indexOf('const entry = replyEntry('));
  const rec = gate.indexOf('await recordReplyMiss(');
  assert.ok(rec > -1 && rec < gate.indexOf('redirect(entry.href)'), 'the Reply sends a guest away with no record of what the browser held');
  assert.match(page, /guestPassEvidence\(eventId\)/);
});
