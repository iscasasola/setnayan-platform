import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The couple tree and the vendor tree must not point at each other.
 *
 * ── WHAT HAPPENED ───────────────────────────────────────────────────────────
 * A signed-in account could not load the site at all. Safari ended with:
 *
 *     Load cannot follow more than 20 redirections
 *
 * and, before giving up, a `history.replaceState` storm — because the client
 * router counts every hop of a server redirect chain.
 *
 * `/dashboard` sent anyone whose `users.account_type` LABEL said `vendor` to
 * `/vendor-dashboard`. `/vendor-dashboard` sent anyone with no shop and no team
 * seat back to `/dashboard`. **Neither side was wrong on its own.** They were
 * answering the same question — "is this person a vendor?" — from two different
 * sources, and an account can satisfy one and not the other the moment a shop is
 * deleted without its label being reset. That is exactly how it reached
 * production: a test account's shop was deleted and the label left behind.
 *
 * 🔑 TWO SOURCES OF TRUTH FOR ONE FACT IS THE BUG. Not the redirects, which are
 * each individually correct and desirable.
 *
 * ── WHY THIS TEST IS SHAPED LIKE THIS ───────────────────────────────────────
 * It cannot execute two Next layouts, so it asserts the one structural property
 * that made the cycle possible: the hop TOWARDS the vendor tree must be
 * conditioned on the same predicate the vendor tree requires to keep you. If
 * someone ever re-conditions it on the bare label again, this fails.
 */

const WEB = process.cwd();
const COUPLE = readFileSync(join(WEB, 'app/dashboard/layout.tsx'), 'utf8');
const VENDOR = readFileSync(join(WEB, 'app/vendor-dashboard/layout.tsx'), 'utf8');

test('the vendor tree still bounces people who own nothing — that half is correct', () => {
  // Stated so the test documents BOTH halves. This redirect is not the bug and
  // must not be "fixed" by deleting it: a person with no shop has nothing to see
  // there.
  assert.match(
    VENDOR,
    /hasVendor\b[\s\S]{0,120}redirect\('\/dashboard'\)/,
    'the vendor tree no longer sends shop-less visitors away',
  );
});

test('the hop TOWARDS the vendor tree requires real access, not just the label', () => {
  // 🔴 THE REGRESSION THIS EXISTS FOR. `account_type === 'vendor'` alone is a
  // claim; `hasVendorAccess` is the fact. Redirecting on the claim while the
  // other side keeps you on the fact is a closed loop.
  const hop = COUPLE.slice(COUPLE.indexOf("account_type === 'vendor'"));
  const upToRedirect = hop.slice(0, hop.indexOf("redirect('/vendor-dashboard')"));
  assert.ok(
    upToRedirect.includes('hasVendorAccess'),
    "/dashboard redirects to /vendor-dashboard on the account_type LABEL alone. " +
      'The vendor tree sends anyone without a real shop or seat straight back, so ' +
      'an account whose label says vendor but owns nothing bounces forever — this ' +
      'took production down on 2026-08-10.',
  );
});

test('both sides read the same canonical helper', () => {
  // The helper is the single definition: owns a vendor_profiles row OR sits on
  // a vendor_team_members row. Two hand-rolled equivalents would drift back
  // apart, which is the whole failure being prevented.
  assert.match(COUPLE, /fetchUserRoleSummary/);
  const roles = readFileSync(join(WEB, 'lib/roles.ts'), 'utf8');
  assert.match(
    roles,
    /hasVendorAccess: vendorProfiles\.length > 0/,
    'the canonical rule moved — re-check both layouts against its new shape',
  );
});

test('the cheap check still comes first, so customers pay nothing', () => {
  // The authoritative lookup is a query. Running it for every signed-in couple
  // to catch a rare inconsistent account would be a real cost on the hottest
  // page in the product.
  const labelAt = COUPLE.indexOf("account_type === 'vendor'");
  const lookupAt = COUPLE.indexOf('fetchUserRoleSummary(');
  assert.ok(labelAt > 0 && lookupAt > labelAt, 'the role lookup must be nested inside the label check');
});

test('the temporary outage probe is gone', () => {
  // It existed only to name this bug. Leaving instrumentation wrapping
  // history.replaceState in production forever is its own hazard.
  assert.doesNotMatch(
    readFileSync(join(WEB, 'app/layout.tsx'), 'utf8'),
    /HistoryStormProbe/,
    'the diagnostic probe is still mounted in the root layout',
  );
});
