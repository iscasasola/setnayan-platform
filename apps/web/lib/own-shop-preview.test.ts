/**
 * THE RULE for who may open a shop's page — lib/own-shop-preview.ts. Owner, 23 Oct 2026: "why can't i see
 * setnaprod's website?" Every corner of the rule, as a property over every combination of the three columns, plus the
 * owner's own shop as it stands in the record (SetnaProd: listed + verified + `is_demo`, DECISION_LOG 2026-09-29).
 *
 * 🧪 2026-11-06 (owner, DECISION_LOG "DEMO SHOPS + DEMO EVENTS"): a live demo shop is PUBLIC, marked "(DEMO ONLY)" —
 * so a stranger opens exactly the `isShopLive` set, demo or not.
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

test('a stranger opens ONLY a live shop — a demo shop included (2026-11-06), never an unlisted or unverified one', () => {
  let open = 0;
  let demoOpen = 0;
  for (const row of everyRow()) {
    const gate = shopPageGate(row, { isTeam: false, adminDemoMode: false });
    const expected = isShopLive(row);
    if (expected && row.is_demo === true) demoOpen += 1;
    assert.equal(gate.open === 'public', expected, JSON.stringify(row));
    // A stranger never sees a preview: it is public or it is not-found.
    assert.notEqual(gate.open, 'team', JSON.stringify(row));
    if (expected) open += 1;
  }
  assert.ok(open > 0, 'the positive control: at least one row opens for a stranger');
  assert.ok(demoOpen > 0, 'a live demo shop opens for a stranger (owner 2026-11-06)');
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
  // A listed, verified demo shop is public (2026-11-06) — no banner, it is the same page for everyone.
  assert.equal(reason({ public_visibility: 'verified', verification_state: 'verified', is_demo: true }), 'public');
  // A demo shop that is not live yet: its team is told it is a demo shop waiting to be listed.
  assert.equal(reason({ public_visibility: 'hidden', verification_state: 'unverified', is_demo: true }), 'demo');
});

test('a listed, verified demo shop (SetnaProd as migration 20271256763663 marked it) opens for everyone', () => {
  const setnaprod = { public_visibility: 'verified', verification_state: 'verified', is_demo: true };
  assert.deepEqual(shopPageGate(setnaprod, { isTeam: true, adminDemoMode: false }), { open: 'public' });
  assert.deepEqual(shopPageGate(setnaprod, { isTeam: false, adminDemoMode: false }), { open: 'public' });
  // …but a demo shop still needs the two halves: unlisted or unverified, a stranger gets not-found.
  assert.deepEqual(shopPageGate({ ...setnaprod, public_visibility: 'hidden' }, { isTeam: false, adminDemoMode: false }), { open: 'nobody' });
  assert.deepEqual(shopPageGate({ ...setnaprod, verification_state: 'pending_review' }, { isTeam: false, adminDemoMode: false }), { open: 'nobody' });
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
    // A dashboard address — Today itself (`/vendor-dashboard#setup-docs`) or one of its pages.
    assert.match(copy.action.href, /^\/vendor-dashboard(\/|#)/, reason);
    assert.ok(copy.action.label.length > 0, reason);
    assert.doesNotMatch(`${copy.line} ${copy.action.label}`, /\b(vendor|website|site|celebration)\b/i, `house words: ${reason}`);
  }
});

// ── 🔗 DECISION_LOG 2026-11-07 ruling (3): a not-yet-decided shop's own link opens ──────────────────────────────────

const NOT_FROZEN = { fraud_suspended_at: null, fraud_banned_at: null, fraud_tombstoned: false } as const;

test('ruling (3): an undecided shop opens for a stranger — before its first inquiry AND after the lock', () => {
  for (const verification_state of ['unverified', 'pending_review'] as const) {
    for (const find_locked_at of [null, '2026-11-07T00:00:00Z']) {
      const row = { public_visibility: 'hidden', verification_state, is_demo: false, find_locked_at, ...NOT_FROZEN };
      assert.deepEqual(shopPageGate(row, { isTeam: false, adminDemoMode: false }), { open: 'public' }, JSON.stringify(row));
    }
  }
});

test('ruling (3) never opens a demo, archived, rejected, demoted or fraud-frozen shop', () => {
  const stranger = { isTeam: false, adminDemoMode: false };
  const base = { public_visibility: 'hidden', verification_state: 'unverified', is_demo: false, ...NOT_FROZEN };
  assert.equal(shopPageGate({ ...base, is_demo: true }, stranger).open, 'nobody', 'demo keeps its own rule');
  assert.equal(shopPageGate({ ...base, public_visibility: 'archived' }, stranger).open, 'nobody');
  for (const verification_state of ['rejected', 'demoted']) {
    assert.equal(shopPageGate({ ...base, verification_state }, stranger).open, 'nobody', verification_state);
  }
  assert.equal(shopPageGate({ ...base, fraud_suspended_at: '2026-11-01T00:00:00Z' }, stranger).open, 'nobody');
  assert.equal(shopPageGate({ ...base, fraud_banned_at: '2026-11-01T00:00:00Z' }, stranger).open, 'nobody');
  assert.equal(shopPageGate({ ...base, fraud_tombstoned: true }, stranger).open, 'nobody');
});

test('ruling (3) FAILS CLOSED on a short select — a row without the fraud columns never opens by it', () => {
  // The same undecided shop, read without the fraud columns: "not read" must never mean "not frozen".
  const short = { public_visibility: 'hidden', verification_state: 'unverified', is_demo: false };
  assert.equal(shopPageGate(short, { isTeam: false, adminDemoMode: false }).open, 'nobody');
});
