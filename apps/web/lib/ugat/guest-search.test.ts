/**
 * guest-search.test.ts — an admin can find a guest by name, and finding them
 * discloses nothing more than that.
 *
 * ── WHAT THIS GUARDS ────────────────────────────────────────────────────────
 * Owner ruling 2026-08-27: an admin may search ANY guest by name across EVERY
 * celebration. That opens the most sensitive population in the product (RA
 * 10173, and this company has a DPO), so the rules are narrow and every one of
 * them is a silent failure if it breaks:
 *
 *   1. It searches the columns that HOLD a name. Measured in prod, not
 *      assumed: `display_name` is empty on 40 of 40 guests while `first_name`
 *      and `last_name` are on 40 of 40. A search written against the obvious
 *      column returns nothing forever and looks like a feature nobody uses.
 *   2. It NEVER selects a contact detail. `email` / `mobile` / `address` must
 *      not appear in the guest read at all — not filtered out downstream,
 *      absent, so there is no arm where one reaches a screen.
 *   3. A deleted guest is not a record.
 *   4. The rest of the off-limits lock — message bodies, face data, file
 *      contents — is untouched by this change.
 *
 * ⚠ THE WIRING HALF IS THE HALF THAT MATTERS. Every assertion on the pure
 * helpers passes with the search never calling them — which is precisely the
 * state `UgatSearchHit.href` shipped in for its whole life. The source
 * assertions below read the real files, because "existing is not reachable".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import {
  sanitizeIlikeTerm,
  guestNameOrFilter,
  guestDisplayName,
  guestRsvpLabel,
} from './data-pure';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..', '..');
const DATA_TS = join(HERE, 'data.ts');
const CONSOLE_TSX = join(WEB_ROOT, 'app', 'admin', 'ugat', '_components', 'ugat-console.tsx');
const ACTIONS_TS = join(WEB_ROOT, 'app', 'admin', 'ugat', 'actions.ts');

/** The guest read, isolated — so a count below is about THAT query, not the file. */
function guestSelectBlock(): string {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));
  const start = src.indexOf(".from('guests')");
  assert.ok(start > 0, "the search no longer reads from('guests') at all");
  // From the guests read to the end of its chained call. Deliberately scoped:
  // a file-level match cannot say WHICH query named a column, and this repo has
  // shipped a decorative guard that way more than once.
  return src.slice(start, start + 900);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PURE HALF — the filter string handed to PostgREST.
   ═══════════════════════════════════════════════════════════════════════════ */

test('the name filter searches first_name and last_name, not display_name alone', () => {
  const filter = guestNameOrFilter('maria');
  assert.ok(filter, 'a two-character query produced no filter');
  assert.match(filter!, /first_name\.ilike/, 'first_name is not searched');
  assert.match(filter!, /last_name\.ilike/, 'last_name is not searched');
  assert.match(filter!, /display_name\.ilike/, 'display_name is not searched');
});

test('a FULL name matches across the two columns it is split over', () => {
  // "Maria Santos" is in neither column on its own. Without the and() pairs the
  // owner types somebody's whole name and gets nothing — the expected case.
  const filter = guestNameOrFilter('Maria Santos')!;
  assert.match(
    filter,
    /and\(first_name\.ilike\.%Maria%,last_name\.ilike\.%Santos%\)/,
    'first-then-last full-name matching is gone',
  );
  assert.match(
    filter,
    /and\(first_name\.ilike\.%Santos%,last_name\.ilike\.%Maria%\)/,
    'reversed "Santos Maria" matching is gone',
  );
});

test('a comma in a name cannot break the filter it is interpolated into', () => {
  // `.or()` splits on commas. Before this, "Dela Cruz, Maria" built a malformed
  // filter, PostgREST refused the WHOLE query, and the box said "No matches".
  const filter = guestNameOrFilter('Dela Cruz, Maria')!;
  const structuralClauses = filter.split(',').filter((c) => !c.startsWith('%'));
  for (const clause of structuralClauses) {
    // Every top-level clause must still be a real filter or an and() fragment.
    assert.ok(
      /^(and\(|\)|[a-z_]+\.ilike\.|%|first_name|last_name|display_name)/.test(clause) ||
        clause.includes('.ilike.'),
      `a comma in the query produced a junk clause: "${clause}"`,
    );
  }
  assert.ok(!filter.includes('Cruz,'), 'the raw comma survived into the filter');
});

test('LIKE wildcards are escaped, so a search is a search and not a match-everything', () => {
  assert.equal(sanitizeIlikeTerm('100%'), '100\\%');
  assert.equal(sanitizeIlikeTerm('a_b'), 'a\\_b');
  // Backslash is escaped FIRST — doing it last double-escapes what was added.
  assert.equal(sanitizeIlikeTerm('a\\b'), 'a\\\\b');
});

test('parens and quotes cannot forge PostgREST filter structure', () => {
  const cleaned = sanitizeIlikeTerm('a(b)c"d');
  for (const ch of ['(', ')', '"']) {
    assert.ok(!cleaned.includes(ch), `${ch} survived sanitizing: "${cleaned}"`);
  }
});

test('a query too short to be worth a round trip returns no filter at all', () => {
  assert.equal(guestNameOrFilter('a'), null);
  assert.equal(guestNameOrFilter('   '), null);
  // Punctuation-only must not survive as a "long enough" query.
  assert.equal(guestNameOrFilter('(),'), null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT A HIT IS CALLED
   ═══════════════════════════════════════════════════════════════════════════ */

test('a guest is named from the parts when nobody set a display name', () => {
  assert.equal(guestDisplayName({ first_name: 'Maria', last_name: 'Santos' }), 'Maria Santos');
  assert.equal(
    guestDisplayName({ display_name: 'Ate Maria', first_name: 'Maria', last_name: 'Santos' }),
    'Ate Maria',
  );
  // Blank-but-present must not win over the real parts.
  assert.equal(
    guestDisplayName({ display_name: '   ', first_name: 'Maria', last_name: 'Santos' }),
    'Maria Santos',
  );
  assert.equal(guestDisplayName({ first_name: 'Maria' }), 'Maria');
  assert.equal(guestDisplayName({}), 'Guest');
});

test('an unknown RSVP value shows itself instead of reading as "never answered"', () => {
  assert.equal(guestRsvpLabel('attending'), 'Attending');
  assert.equal(guestRsvpLabel('declined'), 'Declined');
  assert.equal(guestRsvpLabel('maybe'), 'Maybe');
  assert.equal(guestRsvpLabel('pending'), 'No reply yet');
  assert.equal(guestRsvpLabel(null), 'No reply yet');
  // A future enum label must look wrong on screen, never quietly become "pending".
  assert.equal(guestRsvpLabel('rescinded'), 'rescinded');
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRIVACY FENCE — what the query is not allowed to ask for.
   ═══════════════════════════════════════════════════════════════════════════ */

test('the guest search NEVER selects a contact detail', () => {
  const block = guestSelectBlock();
  for (const column of ['email', 'mobile', 'address']) {
    assert.ok(
      !new RegExp(`\\b${column}\\b`).test(block),
      `the guest read selects or filters "${column}" — a hit must identify the record, not expose contact details`,
    );
  }
});

test('the guest search is BY NAME only — not a reverse lookup from a contact detail', () => {
  // The ruling was "search any guest by name". Finding a person from their
  // phone number is a different power, and nobody granted it.
  const filter = guestNameOrFilter('maria')!;
  for (const column of ['email', 'mobile', 'phone', 'address', 'qr_token']) {
    assert.ok(!filter.includes(column), `the name filter searches "${column}"`);
  }
});

test('a removed guest is not a record the search hands back', () => {
  const block = guestSelectBlock();
  assert.match(
    block,
    /\.is\('deleted_at', null\)/,
    'the guest search stopped excluding deleted guests',
  );
});

test('the rest of the off-limits lock is untouched by this change', () => {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));
  // Face data, message bodies and file contents were never in scope of the
  // owner's ruling. If any of them appears in this module, the lock moved.
  for (const forbidden of ['face_vector', 'face_enrollment', 'message_body', 'body,', 'file_contents']) {
    assert.ok(
      !src.includes(forbidden),
      `"${forbidden}" reached the Ugat data layer — the off-limits lock was widened`,
    );
  }
});

test('browsing every guest stays aggregate-only — the ruling opened SEARCH, not the table', () => {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));
  const guestsTableArm = src.slice(src.indexOf("case 'guests':"), src.indexOf("case 'vendors':"));
  assert.ok(guestsTableArm.length > 100, 'the guests table arm could not be located');
  assert.ok(
    !/first_name|last_name/.test(guestsTableArm),
    'the guests TABLE browser started loading individual guest names — that was not ruled on',
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE WIRING. Everything above passes with the search never calling any of it.
   ═══════════════════════════════════════════════════════════════════════════ */

test('the search actually CALLS the helpers rather than re-implementing them', () => {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));
  for (const fn of ['guestNameOrFilter', 'guestDisplayName', 'guestRsvpLabel', 'sanitizeIlikeTerm']) {
    // Imported AND called — an import alone is what a gutted call site leaves
    // behind, and it is how a guard here once reported a clean pass.
    const called = (src.match(new RegExp(`${fn}\\(`, 'g')) ?? []).length;
    assert.ok(called >= 1, `${fn} is never called by the search`);
  }
});

test('a guest hit is built through the resolver and joins the results', () => {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));
  assert.match(
    src,
    /ugatRecordHref\(\{\s*kind: 'guest'/,
    'guest hits stopped resolving their destination through ugatRecordHref',
  );
  assert.match(
    src,
    /groups\.push\(\{ category: 'Guests'/,
    'guest hits are built but never pushed into the results — found and unreachable',
  );
});

test('the search bar SAYS it finds guests', () => {
  // A door nobody knows about is a door nobody opens. The placeholder is the
  // only place this announces itself.
  const src = stripComments(readFileSync(CONSOLE_TSX, 'utf8'));
  const placeholder = src.match(/placeholder="([^"]*⌘K[^"]*)"/)?.[1];
  assert.ok(placeholder, 'the omnibox placeholder could not be found');
  assert.match(placeholder!, /guests/i, 'the search bar does not mention guests');
});

test('the guest read is gated behind the admin check, like every other read', () => {
  // ugatSearchInner uses the SERVICE-ROLE client, which is outside every RLS
  // rule — so this app-side gate is the whole fence. Four screens in this repo
  // kept handing out guest names after the policy closed, and two had no
  // authorization at all.
  const src = stripComments(readFileSync(ACTIONS_TS, 'utf8'));
  const fn = src.slice(src.indexOf('export async function fetchUgatSearch'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /await requireAdminAction\(\)/, 'fetchUgatSearch lost its admin gate');
  // The gate must come FIRST — before the query reaches the service role.
  const gateAt = body.indexOf('requireAdminAction');
  const searchAt = body.indexOf('ugatSearch(');
  assert.ok(gateAt >= 0 && gateAt < searchAt, 'the search runs before the admin gate');
});

test('the assistant still only ROUTES — the search reads, it never writes', () => {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));
  for (const write of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
    assert.ok(!src.includes(write), `the Ugat data layer gained a write (${write}) — it is read-only`);
  }
});
