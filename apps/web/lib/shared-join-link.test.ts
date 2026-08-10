/**
 * GUARD — nobody hands out the shared join link without asking whether it works.
 *
 * 🚨 FOUND ON THE LIVE SITE BY THE OWNER (2026-08-10), not by any test. He
 * opened his own event's shared guest QR and got **"Link not found."**
 *
 * `/{slug}/invite` refuses a PRIVATE event on purpose — hardened 2026-08-06,
 * because a stranger who guessed the address could otherwise type a name, join
 * the guest list, receive a guest session and use it to open the couple's
 * private page. That fix is right and stays. The defect was that FOUR screens
 * kept printing the QR anyway, from the slug alone, with no explanation: the
 * Papic crew page, the printable poster, the guest list's Share-invite, and the
 * guest-invite page. Three of the owner's five events are private, so the code
 * was dead on all three and nothing said so.
 *
 * 🔑 A DOOR THAT REFUSES AND A DOOR THAT IS BROKEN LOOK IDENTICAL FROM OUTSIDE.
 * Same family as the phantom column, the phantom enum value, the phantom RPC
 * argument, the blocked iframe and the unresolved r2:// reference — something
 * DECLINES and the only symptom is an absence.
 *
 * 🔑 THE CALL-SITE LIST IS DERIVED FROM DISK, NOT TYPED HERE. A hand-typed list
 * is silent about whatever nobody typed into it — the same lesson as the admin
 * queue guard the same week. A fifth screen that builds this link tomorrow is
 * checked without anyone remembering to add it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedJoinLinkState } from './shared-join-link';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, '..');

/** Strip comments — the subject is the CODE, never the prose explaining it. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 · THE RULE — it must match what the DOOR actually does
   ══════════════════════════════════════════════════════════════════════════════ */

const PUBLIC_EVENT = { slug: 'cale-ice', landing_page_visibility: 'public' as const };

test('a public event with a live token is handed out', () => {
  const r = sharedJoinLinkState({ event: PUBLIC_EVENT, tokenValid: true });
  assert.equal(r.state, 'ready');
  assert.equal(r.usable, true);
  assert.equal(r.notice, null, 'a working link must not nag');
});

test('an UNLISTED event still works — link-only is not private', () => {
  const r = sharedJoinLinkState({
    event: { slug: 'x', landing_page_visibility: 'unlisted' },
    tokenValid: true,
  });
  assert.equal(r.usable, true);
});

test('🚨 a PRIVATE event is refused, and the host is told why — the live bug', () => {
  // Exactly the owner's Movie Night: a real slug, a live token, private.
  const r = sharedJoinLinkState({
    event: { slug: 'movie-night', landing_page_visibility: 'private' },
    tokenValid: true,
  });
  assert.equal(r.state, 'private');
  assert.equal(r.usable, false, 'a private event must never hand out this link');
  assert.ok(r.notice, 'silence is the defect — the refusal itself is correct');
  assert.match(r.notice, /private/i, 'name the reason');
  assert.match(r.notice, /public|unlisted/i, 'name the thing they can change');
});

test('no address yet reads as no address, NOT as private', () => {
  // Sending a host to change their privacy setting when the real problem is a
  // missing address is worse than saying nothing — they would change the wrong
  // thing and the link still would not work.
  for (const slug of [null, undefined, '', '   ']) {
    const r = sharedJoinLinkState({
      event: { slug, landing_page_visibility: 'public' },
      tokenValid: true,
    });
    assert.equal(r.state, 'no_address', `slug ${JSON.stringify(slug)}`);
    assert.ok(r.notice && !/private/i.test(r.notice), 'must not blame privacy');
  }
});

test('a revoked or expired token is its own answer, not "private"', () => {
  const r = sharedJoinLinkState({ event: PUBLIC_EVENT, tokenValid: false });
  assert.equal(r.state, 'link_expired');
  assert.ok(r.notice && /expired|turned off/i.test(r.notice));
});

test('privacy is checked BEFORE the token — the door refuses in that order', () => {
  // Both wrong at once. Telling the host to reissue a token first would send
  // them to do the wrong thing, and the link would still be dead afterwards.
  const r = sharedJoinLinkState({
    event: { slug: 'x', landing_page_visibility: 'private' },
    tokenValid: false,
  });
  assert.equal(r.state, 'private');
});

test('a DUE scheduled launch counts as public — the door already thinks so', () => {
  // resolveSiteReachability folds this in. If this module re-derived visibility
  // from the raw column instead of asking it, an event that auto-launched an
  // hour ago would still be told it was private.
  const r = sharedJoinLinkState({
    event: {
      slug: 'x',
      landing_page_visibility: 'private',
      scheduled_launch_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
    tokenValid: true,
  });
  assert.equal(r.usable, true, 'a launch that has come due must open the link');
});

test('a launch still in the future is refused, and says so in its own words', () => {
  const r = sharedJoinLinkState({
    event: {
      slug: 'x',
      landing_page_visibility: 'private',
      scheduled_launch_at: new Date(Date.now() + 86_400_000).toISOString(),
    },
    tokenValid: true,
  });
  assert.equal(r.usable, false);
  assert.match(r.notice ?? '', /launch/i, 'do not tell them to change a setting they scheduled');
});

test('launched-then-hidden gets its own sentence, not the generic one', () => {
  // "You have not launched" would be false and useless — they DID launch.
  const r = sharedJoinLinkState({
    event: {
      slug: 'x',
      landing_page_visibility: 'private',
      std_launched_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    tokenValid: true,
  });
  assert.equal(r.usable, false);
  assert.match(r.notice ?? '', /launched/i);
});

test('every refusal names something the host can act on', () => {
  const cases = [
    { event: { slug: null, landing_page_visibility: 'public' as const }, tokenValid: true },
    { event: { slug: 'x', landing_page_visibility: 'private' as const }, tokenValid: true },
    { event: { slug: 'x', landing_page_visibility: 'public' as const }, tokenValid: false },
  ];
  for (const c of cases) {
    const r = sharedJoinLinkState(c);
    assert.equal(r.usable, false);
    assert.ok(r.notice && r.notice.trim().length > 40, 'a stub sentence is the same silence');
    // No machine words in host copy.
    assert.ok(
      !/slug|landing_page_visibility|notFound|null|undefined/.test(r.notice),
      `host copy leaked a machine word: ${JSON.stringify(r.notice)}`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · EVERY SCREEN THAT BUILDS THE LINK MUST ASK  (list derived from disk)
   ══════════════════════════════════════════════════════════════════════════════ */

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) filesUnder(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Any file whose CODE builds a `/{slug}/invite` URL. Comments are stripped
 * first: four of these files explain the link in prose, and a scan that matched
 * prose would "find" call sites that do not exist while missing real ones.
 */
function buildsThePublicDoor(code: string): boolean {
  // Every quoted/templated chunk that ends in `/invite`, with what precedes it.
  for (const m of code.matchAll(/[`'"][^`'"\n]*\/invite[`'"]/g)) {
    const literal = m[0];
    // ⚠ NOT the dashboard's OWN /guests/invite screen. A first cut of this scan
    // matched that too and reported two innocent files — and a guard that cries
    // wolf teaches you to skim past the one time it is right.
    if (literal.includes('dashboard')) continue;
    // The public door is always built by interpolating an address:
    // `${appUrl}/${slug}/invite` or `${appUrl}${publicEventPath(...)}/invite`.
    if (/\}\/invite/.test(literal) || /\}invite/.test(literal)) return true;
  }
  return false;
}

const BUILDERS = filesUnder(resolve(WEB_ROOT, 'app/dashboard'))
  .map((full) => ({ path: relative(WEB_ROOT, full), code: codeOnly(readFileSync(full, 'utf8')) }))
  .filter((f) => buildsThePublicDoor(f.code));

test('the scan finds the builders (a guard reading nothing passes everything)', () => {
  assert.ok(
    BUILDERS.length >= 3,
    `expected the screens that build /{slug}/invite, found ${BUILDERS.length}: ${JSON.stringify(BUILDERS.map((b) => b.path))}`,
  );
});

test('🚨 every screen that builds the shared link asks whether it works', () => {
  const offenders = BUILDERS.filter((f) => !/sharedJoinLinkState\s*\(/.test(f.code)).map(
    (f) => f.path,
  );
  // ⚠ CALLING IT IS NOT USING IT. A first cut of this test asserted only that
  // `sharedJoinLinkState(` appeared, and a mutation that reverted the crew page
  // to `const posterUrl = eventSlug ? …` — the ORIGINAL BUG, verbatim — stayed
  // green, because the call was still sitting there with its answer thrown away.
  // "Keep the call, discard its result" is the sabotage that beats a
  // presence-check every time; see the `.usable` assertion below.
  assert.deepEqual(
    offenders,
    [],
    `these hand out /{slug}/invite without checking it can be opened — a private event gets a QR that answers "Link not found":\n  ${offenders.join('\n  ')}`,
  );

  // The ANSWER has to reach the link. Either the statement that builds the URL
  // consults `.usable`, or the file bails out on it earlier (redirect / return).
  const ignored = BUILDERS.filter((f) => {
    const gatesEarly = /if\s*\(\s*!\s*[\w.]*\bsharedJoinLinkState[\s\S]{0,400}?\)\s*\{?\s*(return|redirect)/.test(f.code)
      || /if\s*\(\s*!\s*\w+\.usable\s*\)\s*(\{\s*)?(return|redirect)/.test(f.code);
    // The statement that produces the public-door URL, with its condition.
    const urlStatements = [...f.code.matchAll(/const\s+\w+\s*=[\s\S]{0,600}?\/invite`[\s\S]{0,200}?;/g)].map(
      (m) => m[0],
    );
    const everyUrlGated =
      urlStatements.length > 0 && urlStatements.every((st) => /\.usable/.test(st));
    return !(gatesEarly || everyUrlGated);
  }).map((f) => f.path);

  assert.deepEqual(
    ignored,
    [],
    `these CALL sharedJoinLinkState and then ignore the answer — the link is still built from the slug alone:\n  ${ignored.join('\n  ')}`,
  );
});

test('the printable poster REFUSES to render rather than print a dead QR', () => {
  // A poster goes on a table at a real party. There is no way to correct a
  // printed sheet, so this one must not fall back to a notice — it must not
  // render at all.
  const poster = codeOnly(
    readFileSync(
      resolve(WEB_ROOT, 'app/dashboard/[eventId]/studio/papic/crew/poster/page.tsx'),
      'utf8',
    ),
  );
  assert.match(poster, /sharedJoinLinkState\s*\(/);
  assert.match(
    poster,
    /if\s*\(\s*!\s*\w+\.usable\s*\)\s*redirect\(/,
    'an unusable link must send the host back to the page that explains why, never print',
  );
});
