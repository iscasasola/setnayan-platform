/**
 * seat-links-only-on-purpose.test.ts — A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE.
 *
 * The incident (owner's own wedding, 2026-09-30): a test account held the
 * owner's GROOM row. The groom row's key had been opened on a device; account
 * sign-out left the guest pass behind; the next plain LOGIN bound whatever seat
 * the pass named — no question asked, no role check. Owner: "he is not the
 * groom". Rules and why: lib/seat-binding.ts.
 *
 * Each block below guards one rule, and each was sabotaged once (the rule
 * reverted in the source) to watch it go red — see the changelog fragment
 * `changelog.d/rd-seat-links-only-on-purpose.md`.
 *
 *   1 · login and signup bind nothing; only the two on-purpose doors call the binder
 *   2 · account sign-out clears the guest pass
 *   3 · a couple seat refuses a non-couple account (executed) — at every guest door
 *   4 · suggestions and the Link picker never offer a couple seat (executed)
 *   5 · the connect return ASKS before it binds
 *   6 · the unlink rotates first and deletes only its one membership
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  isCoupleSeat,
  seatBindRefusal,
  seatConfirmLine,
  seatDisplayName,
  COUPLE_SEAT_ROLES,
} from '@/lib/seat-binding';
import { suggestRequestMatch } from '@/lib/guest-requests';
import { unlinkedCandidates } from '@/lib/unlisted-guests';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** The body of one top-level function, by name (up to the next top-level declaration). */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*[(<]`));
  assert.ok(start >= 0, `function ${name} not found — the guard is looking at the wrong file`);
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:export\s+)?(?:async\s+)?function\s|\nexport\s+(?:const|type)\s/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

// ── 1 · LOGIN AND SIGNUP BIND NOTHING ──────────────────────────────────────

test('1 · login and signup never bind a seat', () => {
  for (const rel of ['app/login/actions.ts', 'app/signup/actions.ts']) {
    const src = code(rel);
    assert.doesNotMatch(src, /linkGuestSessionToUser/, `${rel} binds a guest seat on sign-in again`);
    assert.doesNotMatch(src, /connectEventForUser/, `${rel} connects an event on sign-in`);
    assert.doesNotMatch(src, /link-guest-account/, `${rel} imports the seat binder`);
  }
});

test('1 · only the two on-purpose doors call the seat binder', () => {
  // A NEW caller of `linkGuestSessionToUser` is a new way for a guest pass to
  // become an account's seat. Every one of them must be an act on the seat's
  // own page — add it here only with that argument written next to it.
  const ALLOWED = new Set([
    'app/[slug]/actions.ts', // linkThisSeatAction — "This invitation is for <name>. Save it to <email>?"
    'lib/event-account-link.ts', // connectEventForUser — only with the confirmed guest id
    'lib/link-guest-account.ts', // the definition
  ]);
  const callers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => /linkGuestSessionToUser\s*\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.ok(callers.length >= 2, 'the sweep found no callers at all — the walk is broken, not the rule');
  const stray = callers.filter((c) => !ALLOWED.has(c));
  assert.deepEqual(stray, [], `a new door binds a guest pass to an account: ${stray.join(', ')}`);
});

test('1 · every binder call is told WHICH event (a pass for another celebration binds nothing)', () => {
  const binder = fn(code('lib/link-guest-account.ts'), 'linkGuestSessionToUser');
  assert.match(binder, /if \(event_id !== expect\.eventId\) return \{ linked: false, reason: 'wrong_event' \}/);
  assert.match(code('app/[slug]/actions.ts'), /linkGuestSessionToUser\(user\.id, \{ eventId \}\)/);
  assert.match(
    code('lib/event-account-link.ts'),
    /linkGuestSessionToUser\(userId, \{ eventId, guestId: seat\.guestId \}\)/,
  );
});

// ── 2 · SIGN-OUT CLEARS THE GUEST PASS ─────────────────────────────────────

test('2 · account sign-out clears the guest pass on the response it returns', () => {
  const src = code('app/auth/sign-out/route.ts');
  const loop = src.match(/for \(const name of \[([^\]]*)\]\) \{\s*response\.cookies\.set\(name, '', \{\s*maxAge: 0,\s*path: '\/'/);
  assert.ok(loop, 'sign-out no longer expires a list of cookies on the response');
  assert.match(loop![1]!, /GUEST_SESSION_COOKIE_NAME/, 'sign-out leaves the guest pass for the next person on this phone');
  assert.ok(src.indexOf('response.cookies.set(name') < src.lastIndexOf('return response'));
});

// ── 3 · A COUPLE SEAT REFUSES A NON-COUPLE ACCOUNT ─────────────────────────

test('3 · the rule, executed: couple seats refuse anyone but the couple (or the couple’s own link)', () => {
  assert.deepEqual([...COUPLE_SEAT_ROLES].sort(), ['bride', 'celebrant', 'groom']);
  for (const role of ['bride', 'groom', 'celebrant']) {
    assert.equal(seatBindRefusal({ seatRole: role, accountIsCouple: false }), 'couple_seat', `${role} was bindable by a stranger`);
    assert.equal(seatBindRefusal({ seatRole: role, accountIsCouple: true }), null, `${role} refused its own couple`);
    assert.equal(seatBindRefusal({ seatRole: role, accountIsCouple: false, coupleSentTheLink: true }), null);
  }
  // An extra role counts: a guest row carrying "groom" as a second role is the groom.
  assert.equal(seatBindRefusal({ seatRole: 'guest', seatExtraRoles: ['groom'], accountIsCouple: false }), 'couple_seat');
  for (const role of ['guest', 'best_man', 'bride_parents', 'principal_sponsor', null]) {
    assert.equal(seatBindRefusal({ seatRole: role, accountIsCouple: false }), null, `${role} was refused`);
  }
  assert.equal(isCoupleSeat('groom'), true);
  assert.equal(isCoupleSeat('groomsman'), false);
});

test('3 · every guest door asks the rule before it writes a membership', () => {
  // The cookie binder: refusal BEFORE the upsert.
  const binder = fn(code('lib/link-guest-account.ts'), 'linkGuestSessionToUser');
  const refuse = binder.indexOf("reason: 'couple_seat'");
  const write = binder.indexOf(".from('event_members').upsert(");
  assert.ok(refuse > 0 && write > 0 && refuse < write, 'the cookie binder writes before it asks about a couple seat');
  // The connect step: a refused seat binds nothing.
  const connect = fn(code('lib/event-account-link.ts'), 'connectEventForUser');
  assert.match(connect, /if \(!seat \|\| seat\.guestId !== confirmed \|\| seat\.refusal\) return \{ connected: false \}/);
  // The join door's email fast path.
  const join = fn(code('app/join/[eventId]/actions.ts'), 'joinEventAction');
  const gate = join.indexOf('!isCoupleSeat(emailSeed.role');
  const bind = join.indexOf('bindMemberToSeed(admin');
  assert.ok(gate > 0 && gate < bind, 'the join door binds an emailed couple seat again');
  // The couple's own Link on a request.
  const link = fn(code('app/dashboard/[eventId]/guests/claims/actions.ts'), 'linkGuestAction');
  const linkGate = link.indexOf('if (isCoupleSeat(target.role');
  const move = link.indexOf(".update({ guest_id: targetId");
  assert.ok(linkGate > 0 && linkGate < move, 'a request can be linked onto a couple seat again');
});

test('3 · only the couple’s OWN link can carry an approval — never a guest pass', () => {
  const find = fn(code('lib/event-account-link.ts'), 'findSeatToConnect');
  assert.match(find, /coupleSentTheLink:\s*via === 'email' &&/);
  // …and only the couple's own action asks for one.
  const signers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => /sentByCouple:\s*true/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(signers, ['app/dashboard/[eventId]/guests/[guestId]/actions.ts']);
});

// ── 4 · NEVER OFFERED ──────────────────────────────────────────────────────

test('4 · "Same as …" never suggests a couple seat (executed)', () => {
  const groom = { guestId: 'g-groom', name: 'Ice Casasola', email: null, role: 'groom' };
  assert.equal(suggestRequestMatch('Ice Casasola', [groom]), null, 'a request was matched to the groom');
  const guest = { ...groom, guestId: 'g-guest', role: 'guest' };
  assert.equal(suggestRequestMatch('Ice Casasola', [guest])?.guestId, 'g-guest', 'the filter removed ordinary guests too');
});

test('4 · the Link picker never lists a couple seat (executed)', () => {
  const rows = [
    { guest_id: 'a', first_name: 'Cale', last_name: 'X', display_name: null, role: 'bride' },
    { guest_id: 'b', first_name: 'Ice', last_name: 'Y', display_name: null, role: 'guest', extra_roles: ['groom'] },
    { guest_id: 'c', first_name: 'Ana', last_name: 'Z', display_name: null, role: 'guest' },
  ];
  assert.deepEqual(unlinkedCandidates(rows, new Set()).map((r) => r.guest_id), ['c']);
  // The page reads the role — without it the filter has nothing to decide on.
  assert.match(code('app/dashboard/[eventId]/guests/claims/page.tsx'), /\.select\('guest_id, first_name, last_name, display_name, role, extra_roles(?:, [a-z_, ]+)?'\)/);
});

// ── 5 · ASKED BEFORE IT BINDS ──────────────────────────────────────────────

test('5 · the connect route binds nothing itself — a new binding goes through the question', () => {
  const route = code('app/join/[eventId]/connect/route.ts');
  const ask = route.indexOf('/connect/confirm${carry}');
  const connect = route.indexOf('await connectEventForUser(');
  assert.ok(ask > 0 && ask < connect, 'the connect route no longer sends a new binding to the confirm page first');
  assert.doesNotMatch(route, /confirmedGuestId/, 'the connect route binds on its own again');
  const lib = fn(code('lib/event-account-link.ts'), 'connectEventForUser');
  const noConfirm = lib.indexOf('if (!confirmed) return { connected: false }');
  const firstWrite = Math.min(
    ...[lib.indexOf('linkGuestSessionToUser('), lib.indexOf('.upsert(')].filter((i) => i >= 0),
  );
  assert.ok(noConfirm > 0 && noConfirm < firstWrite, 'connectEventForUser binds without a confirmed seat');
  // The only caller that passes a confirmed seat is the confirm page's Yes.
  const confirmers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => /confirmedGuestId:/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(confirmers, ['app/join/[eventId]/connect/confirm/actions.ts']);
});

test('5 · the question says whose invitation and which account (executed)', () => {
  assert.deepEqual(seatConfirmLine({ seatName: 'Ice Casasola', accountEmail: 'test@x.com' }), {
    whose: 'This invitation is for Ice Casasola.',
    where: 'Save it to test@x.com?',
  });
  assert.equal(seatDisplayName({ first_name: 'Ice', last_name: 'Casasola' }), 'Ice Casasola');
  assert.equal(seatDisplayName({ display_name: 'Tito Ice', first_name: 'Ice' }), 'Tito Ice');
  // Both surfaces that offer the one-press link say it before the press.
  for (const rel of ['app/[slug]/_components/save-to-account.tsx', 'app/[slug]/_components/guest-account-card.tsx']) {
    const src = code(rel);
    const at = src.indexOf("state.kind === 'link_this_seat'");
    const block = src.slice(at, src.indexOf('linkThisSeatAction.bind', at));
    assert.match(block, /seatConfirmLine\(/, `${rel}: the one-press link binds without saying whose invitation it is`);
    assert.match(block, /if \(state\.coupleSeat\)/, `${rel}: a couple seat offers the press again`);
  }
});

// ── 6 · THE UNLINK ─────────────────────────────────────────────────────────

test('6 · unlink rotates the key FIRST and deletes only its one guest membership', () => {
  const src = fn(code('lib/seat-unlink.ts'), 'unlinkSeatFromAccount');
  const refuseAccess = src.indexOf("if (binding.member_type !== 'guest') return { ok: false, reason: 'holds_access' }");
  const rotate = src.indexOf("supabase.rpc('rotate_guest_qr_token'");
  const abort = src.indexOf("if (rpcError || !rotated?.ok) return { ok: false, reason: 'failed' }");
  const del = src.indexOf(".from('event_members')\n    .delete()");
  assert.ok(refuseAccess > 0 && refuseAccess < rotate, 'a live Co-host / couple membership can be unlinked');
  assert.ok(rotate > 0 && rotate < abort && abort < del, 'the membership is deleted before (or without) a new key');
  const scope = src.slice(del, src.indexOf('if (delErr)', del));
  for (const filter of [
    ".eq('event_id', eventId)",
    ".eq('user_id', accountId)",
    ".eq('member_type', 'guest')",
    ".eq('guest_id', guestId)",
  ]) {
    assert.ok(scope.includes(filter), `the unlink delete lost its ${filter} filter — it could take more than one row`);
  }
  // Only the account's own marks on the row are undone.
  assert.match(src, /personWasTheirs \? \{ person_id: null \} : \{\}/);
  assert.match(src, /email: emailWasTheirs \? null : rowEmail/);
  // The caller is the couple or staff.
  assert.match(fn(code('lib/seat-unlink.ts'), 'callerMayUnlink'), /return couple \|\| isAdminProfile\(me\) \? user\.id : null;/);
});

test('6 · the guest card offers Unlink on every bound row, couple rows included', () => {
  // ⤷ 2026-09-30 (the Fable card, frame D): Unlink moved into the ⋯ menu at the
  // top of the card — ONE place. The ⋯ is built once, BEFORE the couple branch,
  // and drawn on the couple rows too, so the groom row can still be taken back.
  const card = code('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  const at = card.indexOf('const more = MoreMenu ? (');
  assert.ok(at > 0, 'the guest card no longer builds its ⋯');
  assert.match(card.slice(at, at + 400), /<MoreMenu[\s\S]*linked=\{Boolean\(linkedAccount\)\}/, 'the ⋯ is not told who holds the invitation');
  const foundation = card.indexOf('Foundation of the event');
  assert.ok(foundation > 0, 'the couple-row branch moved — re-anchor this guard');
  assert.ok(at < foundation, 'the ⋯ moved inside the couple / non-couple branch — the groom row could not be taken back');
  assert.match(card, /isCouple \? 'A host — nothing to send\.'[\s\S]*\{more\}/, 'a host row no longer draws the ⋯');
  const menu = code('app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx');
  assert.match(menu, /\{linked \? \([\s\S]{0,600}Unlink account/, 'Unlink is not offered on a bound row');
  assert.match(menu, /name="unlink_account" value="1"/);
  assert.match(
    code('app/dashboard/[eventId]/guests/[guestId]/actions.ts'),
    /if \(formData\.get\('unlink_account'\) === '1'\) return unlinkSeatAccount\(eventId, guestId\);/,
  );
});

// ── 7 · A COUPLE ROW TAKES NO TYPED EMAIL FROM THE GUEST SIDE ─────────────

test('7 · the RSVP and the keep-link never write a couple row’s email from the guest side', () => {
  // 🚂 Train 2026-09-30: #6157 ("no email to guests") removed the email box
  // from the RSVP entirely, so the reply writes NO row's email — a stronger
  // floor than the couple-row gate this test first pinned. Held as: the reply
  // neither reads `contact_email` nor writes `email`.
  const rsvp = fn(code('app/[slug]/actions.ts'), 'submitRsvp');
  assert.ok(rsvp.length > 0, 'submitRsvp moved — re-anchor this guard');
  assert.doesNotMatch(rsvp, /formData\.get\('contact_email'\)/, 'the RSVP reads a typed email again');
  assert.doesNotMatch(rsvp, /email: contactEmail/, 'the RSVP writes a typed email onto a guest row again');
  const send = fn(code('lib/event-account-link.ts'), 'sendEventAccountMagicLink');
  const stampGate = send.indexOf('if (!coupleRow || params.sentByCouple) {');
  const stamp = send.indexOf(".update({ email, updated_at");
  assert.ok(stampGate > 0 && stamp > stampGate, 'the keep-link stamps a typed email onto a couple row again');
});
