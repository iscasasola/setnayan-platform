/**
 * A couple's (customer) account cannot spend a supplier claim link.
 * See lib/claim-account-gate.ts for the case and the signal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimAccountVerdict } from './claim-account-gate';
import { stripComments } from './strip-comments';

test('a supplier account passes — by account type or by owning/helping a shop', () => {
  assert.deepEqual(claimAccountVerdict({ accountType: 'vendor', hasVendorAccess: false }), { ok: true });
  assert.deepEqual(claimAccountVerdict({ accountType: 'customer', hasVendorAccess: true }), { ok: true });
  assert.deepEqual(claimAccountVerdict({ accountType: 'admin', hasVendorAccess: false }), { ok: true });
  // A shop is a fact; it outranks an unreadable type.
  assert.deepEqual(claimAccountVerdict({ accountType: null, hasVendorAccess: true }), { ok: true });
});

test('a couple account with no shop is refused', () => {
  assert.deepEqual(claimAccountVerdict({ accountType: 'customer', hasVendorAccess: false }), {
    ok: false,
    reason: 'not_a_supplier',
  });
});

test('a read that failed is refused as unmeasured, never guessed', () => {
  assert.deepEqual(claimAccountVerdict({ accountType: null, hasVendorAccess: false }), { ok: false, reason: 'unmeasured' });
  assert.deepEqual(claimAccountVerdict({ accountType: 'customer', hasVendorAccess: null }), {
    ok: false,
    reason: 'unmeasured',
  });
});

test('finalize asks BEFORE anything can spend the link', () => {
  const page = stripComments(readFileSync('app/vendor/claim/[token]/finalize/page.tsx', 'utf8'));
  // The three reads live in ONE reader since the claim door's finish asks too (A6) — and that reader judges with the rule.
  const reader = stripComments(readFileSync('lib/claim-account-gate.server.ts', 'utf8'));
  assert.match(reader, /return claimAccountVerdict\(\{/, 'the shared reader no longer judges with claimAccountVerdict');
  const gate = page.indexOf('readClaimAccountVerdict(');
  assert.ok(gate > 0, 'finalize no longer checks the account type');
  for (const spend of ["rpc('claim_ready_the_shop'", "rpc('claim_ready_the_invited_shop'", 'applyClaimAutoLink(']) {
    const at = page.indexOf(spend);
    assert.ok(at > gate, `${spend} runs before the account check — a couple account would spend the link`);
  }
});

test('the claim door’s finish asks BEFORE it writes anything (A6)', () => {
  const act = stripComments(readFileSync('app/open-shop/claim-actions.ts', 'utf8'));
  const gate = act.indexOf('readClaimAccountVerdict(');
  assert.ok(gate > 0, 'the claim door’s finish no longer checks the account type');
  // The shop call names both claim functions since Setnayan's own invite joined the door (7 Nov): a couple's link →
  // claim_ready_the_shop, the admin's personal invite → claim_ready_the_invited_shop. Both after the account check.
  for (const write of [
    "rpc(fromSetnayan ? 'claim_ready_the_invited_shop' : 'claim_ready_the_shop'",
    ".from('vendor_profiles').update(",
    'createVendorService(',
    'savePackage(',
  ]) {
    const at = act.indexOf(write);
    assert.ok(at > gate, `${write} runs before the account check — a couple account would get a shop`);
  }
});

test('the token wallet is retired: the claim no longer burns a token', () => {
  const actions = stripComments(readFileSync('lib/vendor-invite-actions.ts', 'utf8'));
  assert.doesNotMatch(actions, /claim_unlock_vendor_event/);
});

test('the couple’s-own-link door offers "Sign in & claim" to a supplier who already has an account', () => {
  const door = stripComments(readFileSync('app/vendor/claim/[token]/_components/claim-parts.tsx', 'utf8'));
  const body = door.slice(door.indexOf('export function CoupleLinkDoor('), door.indexOf('export function TeamInviteDoor('));
  assert.match(body, /label="Sign in & claim"\s+href=\{signInUrl\}/);
  const page = stripComments(readFileSync('app/vendor/claim/[token]/page.tsx', 'utf8'));
  const branch = page.slice(page.indexOf("if (invite.source === 'auto_share_link') {"), page.indexOf("if (invite.source === 'admin') {"));
  assert.match(branch, /const signInUrl = `\/login\?next=\$\{encodeURIComponent\(finalizeUrl\)\}&as=vendor`;/);
  assert.match(branch, /signInUrl=\{signInUrl\}/);
});
