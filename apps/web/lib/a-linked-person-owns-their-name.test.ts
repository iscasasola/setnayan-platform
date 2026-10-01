/**
 * 👤 A LINKED PERSON OWNS THEIR NAME — four owner rulings of 2026-09-30
 * (DECISION_LOG): "A GUEST ROW LINKED TO AN ACCOUNT SHOWS THE ACCOUNT PROFILE'S
 * DETAILS", "THE EVENT'S FORMAL NAME FILLS THE PERSON'S OWN PROFILE — ONE TAP",
 * "A FIRST-TIME ACCOUNT MADE FROM AN INVITATION STARTS WITH ITS PROFILE ALREADY
 * FILLED", and the photo note: a person's own photo always shows on their own row.
 *
 * The rules run for real; the wiring is pinned where a screen or an action could
 * quietly stop honouring them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { profileFormalName, withProfileName } from './formal-name';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── the rule, executed ──────────────────────────────────────────────────────

test('a profile name counts only with a first AND a last name', () => {
  assert.equal(profileFormalName({ first_name: 'Manuel', last_name: null }), null);
  assert.equal(profileFormalName({ first_name: '  ', last_name: 'Casasola' }), null);
  assert.deepEqual(
    profileFormalName({ name_prefix: ' Mr. ', first_name: 'Manuel', middle_name: 'Cortez', last_name: 'Casasola' }),
    { name_prefix: 'Mr.', first_name: 'Manuel', middle_name: 'Cortez', last_name: 'Casasola', name_suffix: null },
  );
});

test('a linked row wears the profile’s five parts; the couple’s nickname and unlinked rows stay', () => {
  const name = { name_prefix: 'Mr.', first_name: 'Indalecio', middle_name: 'Sacdalan', last_name: 'Casasola', name_suffix: 'II' };
  const linked = { guest_id: 'g1', first_name: 'Ice', last_name: 'Casasola', name_prefix: null, middle_name: null, name_suffix: null, display_name: 'Ice' };
  const other = { ...linked, guest_id: 'g2' };
  const names = { g1: { name } };
  assert.deepEqual(withProfileName(linked, names), { ...linked, ...name, display_name: 'Ice' });
  assert.equal(withProfileName(other, names), other);
});

// ── (1) the list and the card read the SAME name ────────────────────────────

test('🔒 the roster overlays the profile name BEFORE anything reads the rows', () => {
  const page = read('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(
    page,
    /const guests = guestsRead\.rows\.map\(\(g\) => withProfileName\(g, profileNames\)\);/,
    'the list prints the row’s name while the card prints the profile’s',
  );
  assert.match(page, /const profileNames = await accountNamesByGuest\(supabase, eventId\);/);
});

test('🔒 the card loader wears the same name, and knows when it is YOU', () => {
  const data = read('app/dashboard/[eventId]/guests/_components/guest-card-data.ts');
  assert.match(data, /const guest = withProfileName\(stored, profileNames\);/);
  assert.match(data, /profileName: linkedProfile \? \{ isYou: linkedProfile\.userId === viewerId \} : null/);
});

test('🔒 a locked name is read-only on the card — no boxes — and says whose it is', () => {
  const card = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(card, /const nameLocked = Boolean\(profileName\) \|\| nameLinked;/);
  const at = card.indexOf('{nameLocked ? (');
  assert.ok(at > -1, 'the card no longer branches on a locked name');
  const locked = card.slice(at, card.indexOf(') : (', at));
  assert.doesNotMatch(locked, /<Field\b/, 'the couple can type over a linked person’s name');
  assert.match(locked, /Edit on your profile ›/, 'the person has no way from their own row to their profile');
  assert.match(card, /PROFILE_NAME_WORDS/);
});

test('🔒 the save refuses the name for a linked profile — and an unread state locks it', () => {
  const a = read('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  assert.match(a, /const nameLocked = await linkedNameLocked\(createAdminClient\(\), eventId, guestId\);/);
  const fn = a.slice(a.indexOf('async function linkedNameLocked('));
  assert.match(fn, /profileFormalName\(/, 'the save no longer asks whether the profile holds a name');
  assert.match(fn, /if \(pErr\) \{[^}]*return true;/, 'an unread profile unlocks the name');
});

test('🔒 the profile-name read is gated like the photo read: caller first, five parts only', () => {
  const lib = read('lib/linked-profile-names.ts');
  const member = lib.indexOf(".from('event_members')");
  const admin = lib.indexOf('createAdminClient()');
  assert.ok(member > -1 && admin > member, 'the admin read runs before the RLS-gated membership read');
  assert.match(lib, /\.select\(`user_id, \$\{FORMAL_NAME_FIELDS\.join\(', '\)\}`\)/, 'the admin read carries more than the name');
  assert.match(lib, /\.in\('user_id', \[\.\.\.new Set\(rows\.map/);
});

// ── (2) one tap on the person's own profile, never silent ──────────────────

test('🔒 the profile boxes show what is SAVED; the event’s name is a one-tap offer of the empty parts', () => {
  const p = read('app/dashboard/(account)/profile/page.tsx');
  assert.match(p, /const formalNameShown = savedFormalName;/, 'a name somebody else typed fills the boxes silently');
  assert.match(p, /!normalizeNamePart\(savedFormalName\[f\]\) && formalNameSuggestion\.name\[f\]/, 'the tap can overwrite a part the person typed');
  assert.match(p, /<input key=\{f\} type="hidden" form="use-event-name"/);
  assert.match(p, /<button type="submit" form="use-event-name"/);
  assert.match(p, /<form id="use-event-name" action=\{updatePersonalInfo\}/);
});

test('the offer finds seats saved to the account, not only the claimed person', () => {
  const lib = read('lib/formal-name-from-guest-list.ts');
  assert.match(lib, /from\('event_members'\)\s*\.select\('guest_id'\)\s*\.eq\('user_id', userId\)/);
  assert.match(lib, /guest_id\.in\.\(/);
});

// ── (3) a first-time account starts with its name ──────────────────────────

test('🔒 the seat’s name fills a profile that never held one — every part guarded on its own NULL', () => {
  const l = read('lib/link-guest-account.ts');
  const fn = l.slice(l.indexOf('export async function fillAccountNameFromSeat('), l.indexOf('export async function isCoupleMember('));
  assert.match(fn, /for \(const f of FORMAL_NAME_FIELDS\) fill = fill\.is\(f, null\);/, 'the fill can overwrite a name the person typed');
});

// ── (4) your own face on your own row ──────────────────────────────────────

test('🔒 your own photo shows on your own row, read as YOU — both pages pass the viewer', () => {
  const lib = read('lib/guest-account-photos.ts');
  assert.match(lib, /await supabase\s*\.from\('users'\)\s*\.select\('user_id, profile_photo_url'\)\s*\.eq\('user_id', viewerUserId\)/);
  assert.match(lib, /userIds\.includes\(viewerUserId\)/, 'the viewer’s photo can reach a list they are not on');
  for (const f of ['app/dashboard/[eventId]/guests/page.tsx', 'app/dashboard/[eventId]/guests/[guestId]/page.tsx']) {
    assert.match(read(f), /accountPhotoRefsByGuest\(supabase, eventId, user\.id\)/, `${f} does not pass the viewer`);
  }
});
