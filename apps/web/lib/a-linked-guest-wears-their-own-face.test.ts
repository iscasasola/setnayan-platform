import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ⚖ Owner 2026-09-20, on his own row of his own guest list: *"why is my account
 * not showing. i registered on the event as me"* — then *"so when users create
 * their accounts, when they have a profile photo, it will show here too"*.
 *
 * His registration was fine: `event_members.guest_id` linked his row to his
 * user with role `groom`. The roster simply never looked at the account, so a
 * guest who had joined, claimed their invite and set a profile photo was drawn
 * exactly like a name typed in once and never heard from again.
 *
 * Two properties are worth guarding and neither is about pixels:
 *   1. the couple's own upload still wins, and
 *   2. the ADMIN read that makes this possible cannot quietly grow.
 */

const LIB = readFileSync(join(process.cwd(), 'lib', 'guest-account-photos.ts'), 'utf8');
const LIST = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'),
  'utf8',
);
const PAGE = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'),
  'utf8',
);
const MIGRATION = readFileSync(
  join(process.cwd(), '..', '..', 'supabase', 'migrations', '20271236036451_share_profile_photo_with_hosts.sql'),
  'utf8',
);
const PROFILE = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '(account)', 'profile', 'page.tsx'),
  'utf8',
);

test("the couple's own upload wins; the account photo is the fallback", () => {
  // `photo_url` is what the couple (or the guest's RSVP selfie) chose for THIS
  // wedding. Reversing this would let a profile picture overwrite a selfie
  // taken for the seating chart.
  const at = LIST.indexOf('const faceFor');
  assert.notEqual(at, -1, 'faceFor is gone — this guard is blind');
  const body = LIST.slice(at, LIST.indexOf(';', LIST.indexOf('accountFaceByGuest[g.guest_id]', at)));
  const guestFirst = body.indexOf("photoDisplayUrls[g.photo_url");
  const accountSecond = body.indexOf('accountFaceByGuest[g.guest_id]');
  assert.ok(guestFirst !== -1 && accountSecond !== -1, 'faceFor no longer reads both sources');
  assert.ok(
    guestFirst < accountSecond,
    "the account photo is being preferred over the couple's own upload",
  );
});

test('every row surface resolves its face through the ONE helper', () => {
  // 🔑 Six surfaces ask for a face. When each spelled the lookup out itself,
  // five could gain the fallback and the sixth silently not — a guest with a
  // face in the list and initials in the grid.
  const spelledOut = LIST.match(/photoDisplayUrls\[guest\.photo_url/g) ?? [];
  assert.deepEqual(
    spelledOut,
    [],
    `${spelledOut.length} surface(s) still resolve the face inline instead of calling faceFor`,
  );
  // ⚖ SIX BECAME FOUR, BY RULING — owner 2026-09-20: "remove the grid view on
  // guest list. make it same sa row view only." The two photo-grid surfaces
  // (the card and its self-join variant) are gone, so a floor of `>= 6` went
  // red on a deliberate removal.
  //
  // 🔑 NAMED, NOT COUNTED — and stricter than the floor it replaces. `>= 6`
  // let any one surface quietly drop out as long as enough others remained;
  // it could not say WHICH. This asserts the exact set, so a surface that stops
  // asking the helper fails by name, and a new one has to be added here on
  // purpose rather than slipping under a number.
  const viaHelper = [...LIST.matchAll(/displayUrl=\{faceFor\(guest\)\}/g)].map((m) => {
    const opened = [...LIST.slice(0, m.index!).matchAll(/<([A-Z][A-Za-z]+)\b/g)];
    return opened[opened.length - 1]![1];
  });
  assert.deepEqual(
    [...viaHelper].sort(),
    ['DesktopRow', 'MobileListRow', 'MobileSelfJoinCard', 'SelfJoinDesktopRow'],
    `the row surfaces resolving a face through faceFor are: ${viaHelper.join(', ') || 'none'}`,
  );
});

test('🔒 the admin read is gated by a policy, not by an if', () => {
  // The membership read runs as the CALLER, so RLS decides. A caller who is not
  // on the event gets zero rows, there are no user ids, and the admin client is
  // never asked anything.
  const memberAt = LIB.indexOf("from('event_members')");
  const adminAt = LIB.indexOf('createAdminClient()');
  assert.ok(memberAt !== -1 && adminAt !== -1, 'the two reads are no longer both present');
  assert.ok(
    memberAt < adminAt,
    'the admin read now runs BEFORE the RLS-gated membership read — the gate is gone',
  );
  assert.match(LIB, /\.in\('user_id', userIds\)/, 'the admin read is no longer keyed to the gated ids');
});

test('🔒 the admin read carries the photo and nothing else', () => {
  // Another account's `users` row is invisible under RLS by design. An admin
  // read is a visibility surface; widening this select is how an email or a
  // display name reaches a screen it was never meant to.
  const select = /from\('users'\)\s*\.select\('([^']+)'\)/.exec(LIB);
  assert.ok(select, 'could not find the admin users select — this guard is blind');
  const columns = (select[1] ?? '').split(',').map((c) => c.trim()).sort();
  assert.deepEqual(
    columns,
    ['profile_photo_url', 'user_id'],
    `the admin read now selects ${columns.join(', ')} — it may carry only the photo and its key`,
  );
});

test('🪤 the account ref is RESOLVED, never handed to an <img> raw', () => {
  // The stored value is an `r2://…` ref, not a URL. A raw ref in an <img src>
  // is a broken-image glyph — the exact defect a-guest-face-is-resolved.test.ts
  // was written for after it shipped in four loaders at once.
  const at = PAGE.indexOf('accountRefByGuest');
  assert.notEqual(at, -1, 'the page no longer loads account photo refs');
  const window = PAGE.slice(at, at + 900);
  assert.match(
    window,
    /guestPhotoDisplayUrls\(/,
    'the account refs are not put through guestPhotoDisplayUrls — an r2:// ref would reach an <img>',
  );
});

test('a refused read degrades to initials rather than throwing', () => {
  // Initials are what the roster drew before this existed, so a failure is no
  // worse than yesterday — but it is logged, because a refused read and an
  // event where nobody has joined look identical from the outside.
  const returns = LIB.match(/return \{\};/g) ?? [];
  assert.ok(returns.length >= 3, `expected the empty-map fallbacks, found ${returns.length}`);
  const logs = LIB.match(/logQueryError\(/g) ?? [];
  assert.ok(logs.length >= 2, `both reads must log their failure, found ${logs.length}`);
});

// ── ⚖ Owner 2026-09-20: "keep it opt-in, add the preference column" ─────────

test('🔒 the read is gated on the opt-in, and NULL is excluded', () => {
  // `.eq(true)` excludes NULL, and NULL is what every account that has never
  // been asked holds. Silence has to mean no, or "opt-in" is a label on an
  // opt-out.
  assert.match(
    LIB,
    /\.eq\('share_profile_photo_with_hosts', true\)/,
    'the account photo is no longer gated on the opt-in — this shares every photo',
  );
});

test('🔒 the preference is FILTERED on, never selected', () => {
  // Somebody's privacy setting is not a fact this function needs to hand back,
  // and keeping it out of the select is what lets the exact-columns guard above
  // stay meaningful.
  const select = /from\('users'\)\s*\.select\('([^']+)'\)/.exec(LIB);
  assert.ok(select, 'could not find the admin users select');
  assert.ok(
    !(select[1] ?? '').includes('share_profile_photo_with_hosts'),
    'the preference is now being read out of the table as well as filtered on',
  );
});

test('🔑 the column has NO default, so "not asked" is not recorded as "said no"', () => {
  // A `NOT NULL DEFAULT TRUE` would perform the disclosure the owner declined,
  // once, silently, on every existing account. A `DEFAULT FALSE` would be a
  // decision nobody made, written down as though they had.
  const add = /ADD COLUMN IF NOT EXISTS share_profile_photo_with_hosts([^;]*);/.exec(MIGRATION);
  assert.ok(add, 'the migration no longer adds the column');
  const decl = (add[1] ?? '').toUpperCase();
  assert.ok(!decl.includes('DEFAULT'), `the column gained a DEFAULT: ${decl.trim()}`);
  assert.ok(!decl.includes('NOT NULL'), `the column gained NOT NULL: ${decl.trim()}`);
});

test('the profile reads the preference as OFF when it has never been set', () => {
  // Its sibling `discoverable_by_name` reads `?? true` because a row predating
  // that column must mean its default. This one is the opposite question and
  // must read the opposite way.
  assert.match(
    PROFILE,
    /share_profile_photo_with_hosts \?\? false/,
    'the profile defaults the photo-sharing preference to ON',
  );
});

test('there is a control to turn it on — a preference nobody can set is not one', () => {
  assert.match(PROFILE, /updateSharePhotoWithHosts/, 'the profile has no toggle for it');
  assert.match(
    PROFILE,
    /name="share_profile_photo_with_hosts"/,
    'the toggle does not post the preference',
  );
});
