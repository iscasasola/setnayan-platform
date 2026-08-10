import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A vendor's name is their account name — owner-locked 2026-08-10.
 *
 * 🔑 THE OBVIOUS READING WOULD HAVE BEEN A DEAD END, and that is what this file
 * mostly protects. "Not editable" sounds like: lock the box, point at the
 * account profile. But a vendor CANNOT REACH that page —
 * `/vendor-dashboard/profile` permanently redirects to My Shop, and the
 * couple-side profile sits under a layout that bounces anyone who owns a shop
 * back to the vendor tree. Locking would have left the name uneditable
 * everywhere, by anyone, forever.
 *
 * So My Shop's box IS the account name editor, and it writes both rows.
 */
const WEB = process.cwd();

test('the one reachable editor writes the account row too', () => {
  const actions = readFileSync(join(WEB, 'app/vendor-dashboard/actions.ts'), 'utf8');
  const branch = actions.slice(actions.indexOf("case 'business_owner_name'"));
  // Sliced to the next `case '` WITH ITS QUOTE, not the bare word: the branch's
  // own comment contains "Worst case the two disagree", and slicing on `case `
  // truncated the body before the line under test — a guard that fails on prose,
  // which is the exact hazard this repo keeps recording.
  const body = branch.slice(0, branch.indexOf("case '", 10));
  assert.match(
    body,
    /from\('users'\)\s*\.update\(\{ display_name/,
    'editing the vendor\'s name no longer updates the account name — the two will drift',
  );
  assert.match(body, /business_owner_name: nextName/, 'the shop row must still be written');
});

test('the vendor still HAS somewhere to edit it — the rule must not create a dead end', () => {
  // If this ever becomes read-only, check first that a vendor can reach some
  // other editor. Today they cannot.
  const row = readFileSync(
    join(WEB, 'app/vendor-dashboard/shop/_components/editable-row.tsx'),
    'utf8',
  );
  const field = row.slice(row.indexOf('htmlFor="business_owner_name"') - 200);
  assert.match(
    field.slice(0, 600),
    /<PlainInput/,
    'the vendor name is no longer editable on My Shop — and there is nowhere else, ' +
      'because /vendor-dashboard/profile redirects here and the couple profile bounces vendors',
  );
});

test('the screen says it is the account name, so the link is visible to a person', () => {
  const row = readFileSync(
    join(WEB, 'app/vendor-dashboard/shop/_components/editable-row.tsx'),
    'utf8',
  );
  assert.match(row, /This is your account name/, 'nothing tells the vendor the two are one thing');
});

/*
 * ⏭ The matching assertion for the SIGNUP side — that `contactName` is
 * `accountName ?? typedName` — lives with that change (PR #4330), not here.
 * Asserting another branch's content from this one would fail CI on whichever
 * merged first, which is a test that breaks correct code.
 */
