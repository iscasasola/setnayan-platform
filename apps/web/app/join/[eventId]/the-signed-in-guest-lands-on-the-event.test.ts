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

// ── THE EMAIL THEY TYPED AT THE DOOR ────────────────────────────────────────
//
// The shared invite door asks for "Email (optional)". It used that address to
// send a sign-in link and NEVER WROTE IT DOWN — so the host, whose own guest
// page carries an Email box, never received it, and the reply card asked the
// same person for the same address again thirty seconds later.
// Owner, 2026-08-21: stop asking for what the app already knows.

/** The accountless door only. `entry_source: 'self_added_unlisted'` appears
 *  TWICE — the signed-in path writes it too, and that one deliberately stores no
 *  email. Anchoring on the first hit guards the wrong function. */
function selfJoinBody(): string {
  const at = ACTIONS.indexOf('export async function selfJoinAction');
  assert.ok(at > -1, 'selfJoinAction was renamed — re-point these guards');
  return ACTIONS.slice(at);
}

test('a self-joined guest keeps the email they just typed', () => {
  const body = selfJoinBody();
  const at = body.indexOf("entry_source: 'self_added_unlisted'");
  assert.ok(at > -1, 'the self-join insert moved — re-point this guard');
  const insert = body.slice(at, body.indexOf('.select(', at));
  assert.match(insert, /email: email \|\| null/, 'the email is asked for and thrown away again');
});

test('🔒 a matched seat FILLS A BLANK and never overwrites', () => {
  // That row was written by the HOST, and the token reaching this branch is
  // printed on a poster. An address the host already has must not be replaceable
  // by whoever scanned it.
  // 🪤 Anchor on the CALL, not on the string — the first occurrence of
  // `self_join_bound_seed` is inside recordJoinScan's own type signature.
  const body = selfJoinBody();
  const at = body.indexOf("recordJoinScan(admin, eventId, match.candidate.guestId");
  assert.ok(at > -1, 'the bound-seed branch moved');
  const branch = body.slice(at, at + 700);
  assert.match(branch, /!match\.candidate\.email/, 'the write is no longer conditional on the seat being blank');
  assert.match(
    branch,
    /\.is\('email', null\)/,
    'the database-side no-op filter is gone — the app check is now the only guard, and app checks get forgotten',
  );
  // Vacuity: the slice must actually contain the update.
  assert.match(branch, /\.update\(\{ email \}\)/, 'the slice does not contain the write this guard is about');
});

test('the signed-in path deliberately has no email of its own to store', () => {
  // A signed-in joiner's address is already on their account, and the reply card
  // prefills from it. Adding a second copy here would be two sources for one fact.
  const at = ACTIONS.indexOf('async function admitAsUnlisted');
  const sig = ACTIONS.slice(at, ACTIONS.indexOf(') {', at));
  assert.doesNotMatch(sig, /email/, 'admitAsUnlisted grew an email argument — say which source wins before adding one');
});
