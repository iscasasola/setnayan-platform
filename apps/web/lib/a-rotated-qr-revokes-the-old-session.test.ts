import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { guestSessionSurvivesTokenCheck } from '@/lib/guest-session-token-rule';
import { stripComments } from '@/lib/strip-comments';

/**
 * ROTATING A LEAKED GUEST QR MUST REVOKE THE LEAKED SESSION.
 *
 * 🔴 IT DID NOT. The re-validation existed, was correct, and sat at the
 * chokepoint all 24 consumers of `readGuestSession` pass through — behind
 * `GUEST_SESSION_TOKEN_CHECK`, which is NOT SET in production. `envFlagEnabled`
 * returns false for a non-string, so the check never ran. Verified 2026-09-17:
 * absent from `vercel env ls production`.
 *
 * The consequence inverted the feature: a couple rotating a leaked guest QR
 * left the leaked browser signed in — and because that session was still
 * valid, the app showed it the REPLACEMENT code. Revoking the leak handed the
 * leak the new key.
 *
 * 🔑 EXECUTED, NOT GREPPED. Grepping for the flag's absence proves the string
 * is gone; it does not prove the decision changed. Every case below is a real
 * call to the pure rule.
 */

const OLD = 'qr_tok_leaked_aaaaaaaaaaaaaaaa';
const NEW = 'qr_tok_rotated_bbbbbbbbbbbbbbbb';

let ran = 0;
const survives = (f: Parameters<typeof guestSessionSurvivesTokenCheck>[0]) => {
  ran++;
  return guestSessionSurvivesTokenCheck(f);
};

// ── (old token, new token) × (rotated, not rotated) ───────────────────────

test('🔒 THE WHOLE POINT — after rotation, the OLD session is refused', () => {
  assert.equal(
    survives({ cookieToken: OLD, dbToken: NEW, lookupFailed: false }),
    false,
    'a rotated QR left the leaked browser signed in — and it would then be shown the new code',
  );
});

test('after rotation, the NEW session is accepted', () => {
  assert.equal(survives({ cookieToken: NEW, dbToken: NEW, lookupFailed: false }), true);
});

test('with no rotation, the existing session keeps working', () => {
  assert.equal(survives({ cookieToken: OLD, dbToken: OLD, lookupFailed: false }), true);
});

test('with no rotation, a token that was never issued is refused', () => {
  assert.equal(survives({ cookieToken: NEW, dbToken: OLD, lookupFailed: false }), false);
});

// ── The failure asymmetry, which is the design ────────────────────────────

test('⚠ a lookup that did NOT COMPLETE fails OPEN — a blip must not sign out a wedding', () => {
  /*
    Deliberate and unchanged. A database error mid-reception would otherwise
    sign out every guest simultaneously, and their only way back in is
    re-scanning a QR they may no longer have.
  */
  for (const cookieToken of [OLD, NEW, '']) {
    assert.equal(
      survives({ cookieToken, dbToken: null, lookupFailed: true }),
      true,
      'a transport error revoked a session — that is a mass sign-out',
    );
  }
});

test('🔒 but a COMPLETED lookup that found no row REVOKES — absence is an answer', () => {
  /*
    The distinction the pure rule exists to keep: "we could not ask" and "we
    asked and there is nobody there" must not collapse into one value. A
    deleted guest, a removed seat, a row soft-deleted — all definitive.
  */
  assert.equal(
    survives({ cookieToken: OLD, dbToken: null, lookupFailed: false }),
    false,
    'a deleted guest kept their session',
  );
});

test('🔒 an empty cookie token cannot match an empty column', () => {
  ran++;
  assert.equal(
    guestSessionSurvivesTokenCheck({ cookieToken: '', dbToken: '', lookupFailed: false }),
    false,
    'two empty strings compared equal and admitted a session with no token at all',
  );
});

// ── The flag is gone, and the chokepoint is unconditional. ────────────────

test('the check is UNCONDITIONAL — no flag, no env read', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'lib/guest-session.ts'), 'utf8'),
  );
  /*
    ⚠ The flag was DELETED, not set. A flag whose production value nobody can
    read is how this shipped dark for months; setting it would leave the same
    mechanism for the next person to get wrong.
  */
  assert.ok(
    !src.includes('GUEST_SESSION_TOKEN_CHECK'),
    'the flag is back — and its production value is unreadable from a session',
  );
  assert.ok(
    !src.includes('guestSessionTokenCheckEnabled'),
    'the gate function is back',
  );
  // The call must not sit inside any conditional.
  assert.match(
    src,
    /const ok = await sessionTokenMatchesDb\([^)]*\);\s*if \(!ok\) return null;/,
    'the re-validation is gated again, or its refusal no longer returns null',
  );
});

test('the decision comes from the shared pure rule, not a re-derivation', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'lib/guest-session.ts'), 'utf8'),
  );
  const calls = (src.match(/guestSessionSurvivesTokenCheck\(/g) ?? []).length;
  assert.equal(
    calls,
    3,
    `expected the rule on all 3 paths (ok / error / throw), found ${calls}`,
  );
  assert.ok(
    !/return data\?\.qr_token === qrToken/.test(src),
    'the comparison was re-inlined, so the empty-token and missing-row cases drift',
  );
});

test('case count', () => {
  console.log(`      (${ran} token decisions executed)`);
  assert.ok(ran >= 9, `expected >= 9 executed decisions, ran ${ran}`);
});
