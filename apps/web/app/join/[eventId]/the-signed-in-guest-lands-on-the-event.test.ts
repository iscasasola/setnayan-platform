/**
 * THE SIGNED-IN GUEST LANDS ON THE CELEBRATION, NOT ON A DASHBOARD.
 *
 * Owner, 2026-08-21: "if they login, they just confirm if they are coming or
 * not, and they get their QR code?" — they did not. Every signed-in ending sent
 * them to a success page whose only way on was "Go to your dashboard", while
 * the guest with NO account was redirected onto the event page and greeted by
 * name. The one who signed in got the worse ending.
 *
 * 🔴 THE ONE-LINE VERSION OF THIS FIX IS THE WHOLE BUG. `/{slug}` decides
 * "guest or stranger" from the guest-session cookie and nothing else, so
 * swapping the redirect string alone typechecks, lints, passes every existing
 * test, and ships the STRANGER view to the person who just joined. The mint is
 * the change; the redirect is its consequence. These guards exist so the mint
 * cannot be removed while the redirect stays.
 *
 * Behavioural proof lives in tests/db/signing-in-keeps-your-seat.db.test.ts —
 * the schema facts a grep cannot see. This file pins the wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Strip comments before matching — a docblock that NAMES the thing it forbids
 *  satisfies a raw search, which has fooled several guards in this repo. */
function code(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
const ACTIONS = code(readFileSync(join(__dirname, 'actions.ts'), 'utf8'));
const SUCCESS = code(readFileSync(join(__dirname, 'success', 'page.tsx'), 'utf8'));
const count = (h: string, n: RegExp) => (h.match(n) ?? []).length;

test('every guest ending mints a session before it sends them anywhere', () => {
  // Four: the returning member, the two clean binds, and the optimistic admit.
  assert.equal(
    count(ACTIONS, /await enterAsGuest\(/g),
    4,
    'a signed-in ending stopped minting — that one lands the joiner as a stranger',
  );
});

test('the mint is the real one, from the seat the join just wrote', () => {
  const helper = ACTIONS.slice(ACTIONS.indexOf('async function enterAsGuest'));
  const body = helper.slice(0, helper.indexOf('\n}'));
  assert.match(body, /findGuestSeatForUser\(eventId, userId\)/, 'the seat is not looked up');
  assert.match(body, /if \(!seat\) return null;/, 'a missing seat must fall back, not redirect to /undefined');
  assert.match(body, /setGuestSession\(/, 'no session is minted — the redirect would show the stranger view');
  assert.match(body, /qr_token: seat\.qrToken/, 'the session is signed with something other than the live token');
  assert.match(body, /return `\/\$\{seat\.slug\}`/, 'the destination is not built from the database slug');
});

test('the destination comes from the database, never from the caller', () => {
  // The open-redirect lesson `[slug]/redeem` paid for on live prod.
  const helper = ACTIONS.slice(ACTIONS.indexOf('async function enterAsGuest'));
  const body = helper.slice(0, helper.indexOf('\n}'));
  assert.doesNotMatch(body, /slug\s*=\s*(formData|params|searchParams|token)/, 'the slug came from input');
});

test('every mint site keeps a fallback — a failed lookup must not strand anyone', () => {
  const sites = ACTIONS.split('await enterAsGuest(').slice(1);
  const withFallback = sites.filter((tail) =>
    /dest \?\? `\/join\/\$\{eventId\}\/success/.test(tail.slice(0, 220)),
  ).length;
  // Three of the four redirect on the result; the unlisted one deliberately
  // keeps the success page (it carries the only "you weren't on the list"
  // sentence), so it mints without consuming a destination.
  assert.equal(withFallback, 3, 'a mint site lost its fallback to the success page');
});

test('🔒 the ORGANISER still goes to their dashboard', () => {
  // An organiser dropped on their own event page gets a read-only ribbon whose
  // only way out is the website editor. This branch must never be rerouted.
  assert.equal(count(ACTIONS, /redirect\(`\/dashboard\/\$\{eventId\}`\)/g), 1);
  const at = ACTIONS.indexOf('redirect(`/dashboard/${eventId}`)');
  const before = ACTIONS.slice(Math.max(0, at - 260), at);
  assert.match(before, /member_type === 'couple'/, 'the dashboard redirect left the couple branch');
  assert.doesNotMatch(before, /enterAsGuest/, 'the organiser is being routed through the guest path');
});

test('the mint stays out of the module that must not contain one', () => {
  // A test in lib/ asserts that file holds zero mints, for a reason (a <Link>
  // prefetch once executed it). The mint belongs in this Server Action.
  const lib = code(
    readFileSync(join(__dirname, '..', '..', '..', 'lib', 'guest-membership-session.ts'), 'utf8'),
  );
  assert.equal(count(lib, /setGuestSession/g), 0);
});

test('the unlisted admit reports whether it actually bound', () => {
  // The mint reads the membership row this writes; a swallowed bind error is
  // the difference between recognised and stranger.
  assert.match(ACTIONS, /return !bindErr;/, 'admitAsUnlisted discards its bind error again');
  assert.match(ACTIONS, /if \(admitted\) await enterAsGuest\(/, 'the unlisted mint is unconditional');
});

test('the success page stopped promising an invitation that already exists', () => {
  assert.doesNotMatch(SUCCESS, /on its way/, 'the false promise is back');
  assert.doesNotMatch(
    SUCCESS,
    /Go to your dashboard[\s\S]{0,60}<\/Link>\s*\)\s*;?\s*}\s*$/,
    'the dashboard is the only way on again',
  );
  assert.match(SUCCESS, /Open your invitation/, 'the way onto the celebration is gone');
  assert.match(SUCCESS, /href=\{`\/\$\{event\.slug\}`\}/, 'the link is not the event address');
  // …and the slug it needs is actually read.
  assert.match(SUCCESS, /public_id, slug/, 'the page links to a slug it never selected');
  // The dashboard survives ONLY as the fallback for an event with no address.
  assert.match(SUCCESS, /event\.slug \?/, 'the no-address fallback was collapsed away');
});

test('the "you weren’t on the list" sentence survives', () => {
  // It is the only place anyone is told this; the unlisted ending keeps the
  // success page precisely so it is not lost.
  assert.match(
    readFileSync(join(__dirname, 'success', 'page.tsx'), 'utf8'),
    /weren&rsquo;t on the original list/,
    'the only notice a self-added guest gets was deleted',
  );
  assert.match(ACTIONS, /unlisted=1/, 'the unlisted ending stopped reaching its own notice');
});

// ── ONE WRITER FOR THE GUEST'S EMAIL ────────────────────────────────────────
//
// 🔴 THIS GUARD EXISTS BECAUSE I ADDED A SECOND WRITER AND SHIPPED IT.
//
// The invite door asks for "Email (optional)". I followed that value as far as
// the CALL to sendEventAccountMagicLink, saw the word "magic link", concluded
// the address was used for mail and thrown away, and wrote a second copy into
// the insert — with tests locking the duplicate in place.
//
// Opening the callee would have taken ten seconds. `lib/event-account-link.ts`
// step 1 stamps the address onto the guest row BEFORE it generates any mail,
// with the identical fill-a-blank rule, and all three join endings call it.
// The feature already worked. **I read the call site and never opened the
// callee** — the exact failure this repo writes down as "a sentence is not a
// mechanism; grep the WRITER".
//
// It was not harmless. A second writer means two places to keep in step, and
// mine wrote at INSERT time while the real one writes on UPDATE — and prod
// carries a trigger firing `BEFORE INSERT OR UPDATE OF email` that binds the
// guest to a person identity, so the duplicate quietly moved WHEN that binding
// happens. A redundant write is not a no-op when something is listening.

test('🔴 exactly ONE place writes a guest email from the join door', () => {
  const writes = (ACTIONS.match(/\.update\(\{\s*email/g) ?? []).length;
  assert.equal(
    writes,
    0,
    'the join door writes the guest email directly again — sendEventAccountMagicLink already does it, with the same fill-a-blank rule',
  );
  const inserts = ACTIONS.slice(ACTIONS.indexOf('export async function selfJoinAction'));
  const at = inserts.indexOf("entry_source: 'self_added_unlisted'");
  assert.ok(at > -1, 'the self-join insert moved — re-point this guard');
  const insert = inserts.slice(at, inserts.indexOf('.select(', at));
  assert.doesNotMatch(
    insert,
    /(^|[^_a-zA-Z])email\s*:/,
    'the self-join insert carries an email again — that is the SECOND writer, and it fires the person-binding trigger at a different moment than the real one',
  );
});

test('…and the one that does it is reached from every ending that asks for an email', () => {
  // Three endings ask: the returning device, the matched seat, and the new row.
  // If one stopped calling it, that guest's address would be the one the host
  // never gets — and nothing else would notice.
  assert.equal(
    (ACTIONS.match(/sendEventAccountMagicLink\(/g) ?? []).length,
    3,
    'an ending stopped sending the address to the one writer',
  );
  const lib = readFileSync(
    join(__dirname, '..', '..', '..', 'lib', 'event-account-link.ts'),
    'utf8',
  );
  const step = lib.slice(lib.indexOf('async function sendEventAccountMagicLink'));
  assert.match(step, /\.update\(\{ email/, 'the one writer stopped writing');
  assert.match(
    step,
    /\.is\('email', null\)/,
    "the fill-a-blank rule is gone — a stranger scanning a poster could overwrite an address the host recorded",
  );
});
