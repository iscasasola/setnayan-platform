/**
 * THE RULE for who may open a shop's page — lib/own-shop-preview.ts. Owner, 23 Oct 2026: "why can't i see
 * setnaprod's website?" Every corner of the rule, as a property over every combination of the three columns, plus the
 * owner's own shop as it stands in the record (SetnaProd: listed + verified + `is_demo`, DECISION_LOG 2026-09-29).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_PREVIEW_COPY, TEAM_PREVIEW_HEAD, shopPageGate } from './own-shop-preview';
import { VENDOR_PUBLIC_VISIBILITIES, isShopLive } from './vendor-visibility';
import { VERIFICATION_STATES } from './vendor-verification';

const STATES = [...VERIFICATION_STATES, null, undefined, 'garbage'] as const;
const VISIBILITIES = [...VENDOR_PUBLIC_VISIBILITIES, null, 'garbage'] as const;
const DEMO = [true, false, null] as const;

function* everyRow() {
  for (const public_visibility of VISIBILITIES)
    for (const verification_state of STATES)
      for (const is_demo of DEMO) yield { public_visibility, verification_state, is_demo };
}

test('a stranger opens ONLY a live, non-demo shop — the same set the sitemap lists', () => {
  let open = 0;
  for (const row of everyRow()) {
    const gate = shopPageGate(row, { isTeam: false, adminDemoMode: false });
    const expected = isShopLive(row) && row.is_demo !== true;
    assert.equal(gate.open === 'public', expected, JSON.stringify(row));
    // A stranger never sees a preview: it is public or it is not-found.
    assert.notEqual(gate.open, 'team', JSON.stringify(row));
    if (expected) open += 1;
  }
  assert.ok(open > 0, 'the positive control: at least one row opens for a stranger');
});

test('the owner and helpers open every not-yet-public shop, with a reason — never a not-found', () => {
  let previews = 0;
  for (const row of everyRow()) {
    const stranger = shopPageGate(row, { isTeam: false, adminDemoMode: false });
    const team = shopPageGate(row, { isTeam: true, adminDemoMode: false });
    if (row.public_visibility === 'archived') {
      assert.equal(team.open, 'nobody', `a closed shop stays shut for its team too: ${JSON.stringify(row)}`);
      continue;
    }
    if (stranger.open === 'public') {
      assert.equal(team.open, 'public', 'a live page is the same page for the team — no banner');
      continue;
    }
    assert.equal(team.open, 'team', `the team sees its own page before couples can: ${JSON.stringify(row)}`);
    previews += 1;
  }
  assert.ok(previews > 20, `previews counted: ${previews}`);
});

test('the reason names what couples are really waiting on', () => {
  const team = { isTeam: true, adminDemoMode: false };
  const reason = (row: Parameters<typeof shopPageGate>[0]) => {
    const g = shopPageGate(row, team);
    return g.open === 'team' ? g.reason : g.open;
  };
  assert.equal(reason({ public_visibility: 'hidden', verification_state: 'unverified', is_demo: false }), 'documents');
  assert.equal(reason({ public_visibility: 'hidden', verification_state: 'rejected', is_demo: false }), 'documents');
  assert.equal(reason({ public_visibility: 'verified', verification_state: 'demoted', is_demo: false }), 'documents');
  assert.equal(reason({ public_visibility: 'hidden', verification_state: 'pending_review', is_demo: false }), 'in_review');
  assert.equal(reason({ public_visibility: 'hidden', verification_state: 'verified', is_demo: false }), 'listing');
  // SetnaProd as the record has it (migration 20271256763663): listed, verified, demo.
  assert.equal(reason({ public_visibility: 'verified', verification_state: 'verified', is_demo: true }), 'demo');
  // Demo wins over the documents: no document step makes a demo shop public.
  assert.equal(reason({ public_visibility: 'hidden', verification_state: 'unverified', is_demo: true }), 'demo');
});

test('SetnaProd: its owner sees it with the banner; a stranger gets not-found', () => {
  const setnaprod = { public_visibility: 'verified', verification_state: 'verified', is_demo: true };
  assert.deepEqual(shopPageGate(setnaprod, { isTeam: true, adminDemoMode: false }), { open: 'team', reason: 'demo' });
  assert.deepEqual(shopPageGate(setnaprod, { isTeam: false, adminDemoMode: false }), { open: 'nobody' });
});

test('an admin in demo mode keeps exactly the old reach: listed demo/unverified rows open, hidden ones do not', () => {
  const admin = { isTeam: false, adminDemoMode: true };
  assert.equal(shopPageGate({ public_visibility: 'verified', verification_state: 'unverified', is_demo: true }, admin).open, 'public');
  assert.equal(shopPageGate({ public_visibility: 'hidden', verification_state: 'verified', is_demo: false }, admin).open, 'nobody');
});

test('every reason has the owner\'s first line, a "Couples will see it once" line and one dashboard button', () => {
  assert.equal(TEAM_PREVIEW_HEAD, 'Only you and your team can see this.');
  for (const [reason, copy] of Object.entries(TEAM_PREVIEW_COPY)) {
    assert.match(copy.line, /^Couples will see it once /, reason);
    assert.match(copy.action.href, /^\/vendor-dashboard\//, reason);
    assert.ok(copy.action.label.length > 0, reason);
    assert.doesNotMatch(`${copy.line} ${copy.action.label}`, /\b(vendor|website|site|celebration)\b/i, `house words: ${reason}`);
  }
});
