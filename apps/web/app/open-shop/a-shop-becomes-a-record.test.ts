/**
 * GUARD — opening a shop must keep creating the business's own record, and it
 * must never be able to cost the vendor their shop.
 *
 * WHY A SOURCE-SHAPE GUARD. `becomeVendor` is a server action: it constructs its
 * own Supabase clients, calls `redirect()` (which throws) and ends in a redirect,
 * so there is no seam to drive it through without a database. The properties
 * below are nonetheless the ones that would be silently lost by an ordinary
 * edit, and each is a specific, greppable shape rather than a vibe:
 *
 *   1 · the write EXISTS at all, through the ONE writer (`ensureBusinessAlaga`),
 *       for the AUTHENTICATED caller and the shop this action just wrote,
 *   2 · it CANNOT redirect. `redirect()` inside the block would turn a
 *       record-keeping failure into a supplier losing the shop they just opened.
 *
 * What the write itself guarantees — gated on the People pair, read-then-write
 * against the idempotency key, a 23505 read as success, a refused read writing
 * nothing — is asserted by BEHAVIOUR in `lib/business-alaga-ensure.test.ts`,
 * where it is driven through a fake client instead of read off the source
 * (2026-10-22: the write moved out of this file so the claim flow could share
 * it; before that these were source-shape assertions on an inline block).
 *
 * ⚠ ANCHORED ON THE BLOCK, NOT ON THE FILE. A file-level match cannot say WHICH
 * part of a 500-line action still holds a property — sabotage has slipped past
 * exactly that shape here before. So the block is sliced out by its own opening
 * and closing markers first, and every assertion runs against the slice.
 *
 * ⚠ AND AGAINST CODE, NOT PROSE. The block's own comments say the words
 * "redirect" and "throw" (they explain why neither may appear), so a guard
 * reading the raw slice reports a violation written by the guard's own subject.
 * Comments are stripped before the forbidden-shape assertions run — the first
 * draft of this file failed exactly that way, which is the check proving it can.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SOURCE = readFileSync(join(process.cwd(), 'app/open-shop/actions.ts'), 'utf8');

/** The block, sliced from its own header to the redirect that ends the action. */
function alagaBlock(): string {
  const start = SOURCE.indexOf('AND THE BUSINESS BECOMES A RECORD');
  assert.notEqual(start, -1, 'the business-alaga block has been removed from becomeVendor');
  const end = SOURCE.indexOf("revalidatePath('/vendor-dashboard')", start);
  assert.notEqual(end, -1, 'the block no longer sits before the action’s final redirect');
  return SOURCE.slice(start, end);
}

/**
 * The same slice with every comment removed — what actually EXECUTES.
 *
 * ⚠ `stripComments` IS THE REPO'S ONE STRIPPER, and hand-rolling a second is a
 * blocking guard (`scripts/lint-one-comment-stripper.mjs`). The obvious two-line
 * version strips BLOCK comments first, so a `//` line holding a block opener
 * ("content-type video/*") opens a comment that never existed and swallows every
 * line to the next real close — silently, in the direction that makes a guard
 * pass while asserting against a blank. This file's first draft did exactly that
 * and CI refused it.
 */
function alagaCode(): string {
  return stripComments(alagaBlock());
}

test('opening a shop writes the business its own dependents row, through the one writer', () => {
  const code = alagaCode();
  assert.match(code, /await ensureBusinessAlaga\(admin, \{/);
  // owner comes from the AUTHENTICATED caller, never a form value — the admin
  // client means that assignment IS the ownership boundary.
  assert.match(code, /ownerUserId: user\.id/);
  assert.match(code, /\bvendorProfileId\b/);
  assert.match(code, /\bshopName\b/);
});

/**
 * 🔴 THE ONE THAT PROTECTS THE VENDOR. Every other failure path in this action
 * redirects; this block must not. A `redirect()` here would mean an unreadable
 * `dependents` table stops a supplier from opening a shop.
 */
test('nothing in the block can redirect, throw, or fail the shop', () => {
  const code = alagaCode();
  // The stripper must not have eaten the block itself — an empty string passes
  // every "does not contain" assertion below, which is the classic check that
  // cannot fail.
  assert.ok(code.includes('ensureBusinessAlaga('), 'comment-stripping ate the code it was asked to check');
  assert.equal(/\bredirect\(/.test(code), false, 'the record-keeping write must never redirect');
  assert.equal(/\bthrow\b/.test(code), false);
});
