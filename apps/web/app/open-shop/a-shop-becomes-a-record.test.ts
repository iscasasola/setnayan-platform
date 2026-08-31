/**
 * GUARD — opening a shop must keep creating the business's own record, exactly
 * once, and it must never be able to cost the vendor their shop.
 *
 * WHY A SOURCE-SHAPE GUARD. `becomeVendor` is a server action: it constructs its
 * own Supabase clients, calls `redirect()` (which throws) and ends in a redirect,
 * so there is no seam to drive it through without a database. The three
 * properties below are nonetheless the ones that would be silently lost by an
 * ordinary edit, and each is a specific, greppable shape rather than a vibe:
 *
 *   1 · the write EXISTS at all (it is the whole of piece 1),
 *   2 · it is READ-THEN-WRITE against the idempotency key — never a bare insert,
 *   3 · it CANNOT redirect. `redirect()` inside the block would turn a
 *       record-keeping failure into a supplier losing the shop they just opened.
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

const SOURCE = readFileSync(join(process.cwd(), 'app/open-shop/actions.ts'), 'utf8');

/** The block, sliced from its own header to the redirect that ends the action. */
function alagaBlock(): string {
  const start = SOURCE.indexOf('AND THE BUSINESS BECOMES A RECORD');
  assert.notEqual(start, -1, 'the business-alaga block has been removed from becomeVendor');
  const end = SOURCE.indexOf("revalidatePath('/vendor-dashboard')", start);
  assert.notEqual(end, -1, 'the block no longer sits before the action’s final redirect');
  return SOURCE.slice(start, end);
}

/** The same slice with every comment removed — what actually EXECUTES. */
function alagaCode(): string {
  return alagaBlock()
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

test('opening a shop writes the business its own dependents row', () => {
  const block = alagaBlock();
  assert.match(block, /buildBusinessAlagaInsert\(/);
  assert.match(block, /\.from\('dependents'\)[\s\S]*?\.insert\(alaga\)/);
  // owner_user_id comes from the AUTHENTICATED caller, never a form value — the
  // admin client means that assignment IS the ownership boundary.
  assert.match(block, /ownerUserId: user\.id/);
  assert.match(block, /\.eq\('owner_user_id', user\.id\)/);
});

test('the write is read-then-write against the idempotency key, not a bare insert', () => {
  const block = alagaBlock();
  assert.match(block, /\.eq\('vendor_profile_id', vendorProfileId\)/);
  assert.match(block, /if \(!readErr && !already\)/);
  // …and the database's half of the promise is honoured rather than surfaced.
  assert.match(block, /isAlreadyRecorded\(insErr\)/);
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
  assert.ok(code.includes('.insert(alaga)'), 'comment-stripping ate the code it was asked to check');
  assert.equal(/\bredirect\(/.test(code), false, 'the record-keeping write must never redirect');
  assert.equal(/\bthrow\b/.test(code), false);
});

/** Behind the same pair the surface that renders it is gated behind. */
test('the write is gated exactly like every other write to dependents', () => {
  const block = alagaBlock();
  assert.match(block, /dependentPeopleEnabled\(\)/);
  assert.match(block, /isDataPrivacyControlActive\('dependent_minor_profiles'\)/);
});
