/**
 * 🆓 THE FREE TIER STAYS FREE — and the paid unlock decides only what it was sold for.
 *
 * Owner, 2026-11-09 (DECISION_LOG "BUILD 4 ANSWERS"): the free tier of Specialized tools is *Scanner + Headcount ·
 * Run of show · Emcee script · Song Desk · Floor Command + March · Live Watch* — every supplier, no purchase. The
 * ₱499 / ₱4,990 unlock (migration 20271331982978) opens the PAID tools only: Papic challenge, the 3D plan's branded
 * booth, every future tool.
 *
 * WHAT THIS PROVES, by reading the tree rather than trusting a comment:
 *   1 · the free list is the owner's list, and none of it needs the unlock;
 *   2 · nothing in the day-of console (where every free tool lives) and none of the free tools' lib modules reads
 *       the unlock — so Build 4 put no new gate in front of them;
 *   3 · the unlock read has a closed list of callers in the app, and in SQL exactly the two gates it replaced;
 *   4 · every day-of specialization desk (Floor Command, Song Desk, Script & cues = Emcee script) is in the free set;
 *   5 · the pure decisions: the unlock mirror, who may buy, the window stacking, the trial answer failing closed,
 *       and the usage shape keys refusing entered data.
 *
 * SABOTAGE (2026-11-08): `import { fetchVendorSpecializedToolsUnlocked } from '@/lib/entitlements'` added to
 * song-desk.tsx → tests 2 + 3a RED; 'song_desk' removed from FREE_SPECIALIZATION_SETS → test 4 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import {
  FREE_SPECIALIZED_TOOLS,
  PAID_SPECIALIZED_TOOLS,
  SPECIALIZED_TOOLS_ANNUAL_PERIOD_DAYS,
  SPECIALIZED_TOOLS_ANNUAL_SKU_CODE,
  SPECIALIZED_TOOLS_PERIOD_DAYS,
  SPECIALIZED_TOOLS_SKU_CODE,
  isShapeKey,
  nextSpecializedToolsExpiry,
  parseTrialClaim,
  specializedToolsPeriodDays,
  specializedToolsPurchaseEligibility,
  specializedToolsUnlockFrom,
  toolNeedsUnlock,
  type SpecializedToolsFacts,
} from './specialized-tools';
import { FREE_SPECIALIZATION_SETS, VENDOR_SPECIALIZATIONS } from './vendor-specialization-gate';
import { vendorPaysSetnayan } from './vendor-pays-setnayan';

const WEB = join(import.meta.dirname, '..');
const REPO = join(WEB, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** The unlock READ — what would gate a tool. (Usage counting, `recordSpecializedToolUse`, gates nothing.) */
const UNLOCK_READ = /fetchVendorSpecializedToolsUnlocked|vendor_specialized_tools_unlocked|specialized_tools_claim_trial|toolNeedsUnlock|specializedToolsUnlockFrom/;

// ── 1 ─────────────────────────────────────────────────────────────────────────

test('1 · the free tier is the owner’s list, and none of it needs the unlock', () => {
  assert.deepEqual(
    [...FREE_SPECIALIZED_TOOLS],
    ['scanner', 'headcount', 'run_of_show', 'emcee_script', 'song_desk', 'floor_command', 'march', 'live_watch'],
  );
  for (const t of FREE_SPECIALIZED_TOOLS) assert.equal(toolNeedsUnlock(t), false, t);
  for (const t of PAID_SPECIALIZED_TOOLS) assert.equal(toolNeedsUnlock(t), true, t);
  assert.equal(toolNeedsUnlock('a_tool_nobody_named'), true, 'an unknown tool fails closed');
  assert.equal(toolNeedsUnlock('forms_maker'), true, 'Forms Maker is not a specialized tool; it is free by its own rule');
});

// ── 2 ─────────────────────────────────────────────────────────────────────────

test('2 · nothing in the day-of console or the free tools’ lib modules reads the unlock', () => {
  const console_ = walk(join(WEB, 'app', 'vendor-dashboard', 'on-the-day'));
  const libs = walk(join(WEB, 'lib')).filter((f) =>
    /\/(floor-command|stage-script|song-desk|songs|vendor-dayof-[^/]+|vendor-specialization-gate[^/]*|supplier-scan[^/]*|headcount[^/]*|run-of-show[^/]*|live-watch[^/]*)\.tsx?$/.test(f),
  );
  assert.ok(console_.length > 20, `walked only ${console_.length} console files — the path moved`);
  assert.ok(libs.length >= 4, `matched only ${libs.length} free-tool lib modules — the names moved`);
  const offenders = [...console_, ...libs].filter((f) => UNLOCK_READ.test(stripComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(offenders.map((f) => relative(WEB, f)), [], 'a free tool now reads the paid unlock');
});

// ── 3 ─────────────────────────────────────────────────────────────────────────

test('3a · the unlock read has a closed list of callers in the app', () => {
  const callers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => UNLOCK_READ.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f))
    .sort();
  assert.deepEqual(callers, [
    'lib/entitlements.ts', // the re-export
    'lib/specialized-tools.ts', // the definitions
    'lib/vendor-photo-challenge.ts', // Papic challenge — a PAID tool
  ]);
});

test('3b · in SQL the unlock is asked by exactly the two gates it replaced', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const callers = new Set<string>();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, name), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(([\s\S]*?)\n\$(?:\$|function\$);/g)) {
      if (m[1] !== 'vendor_specialized_tools_unlocked' && /vendor_specialized_tools_unlocked\(/.test(m[2]!)) callers.add(m[1]!);
    }
  }
  assert.deepEqual([...callers].sort(), ['event_branded_booth_vendor_ids', 'vendor_papic_challenge_entitled']);
});

// ── 4 ─────────────────────────────────────────────────────────────────────────

test('4 · every day-of desk is in the free set — Floor Command, Song Desk, Script & cues (Emcee script)', () => {
  for (const def of VENDOR_SPECIALIZATIONS) assert.ok(FREE_SPECIALIZATION_SETS.has(def.id), def.id);
});

// ── 5 · the pure decisions ────────────────────────────────────────────────────

const NOW = Date.parse('2026-11-10T04:00:00Z');
const LATER = '2026-12-01T00:00:00Z';
const EARLIER = '2026-11-01T00:00:00Z';
const facts = (f: Partial<SpecializedToolsFacts>): SpecializedToolsFacts => ({
  tier_state: 'verified',
  tier_expires_at: null,
  verification_state: 'verified',
  unlock_expires_at: null,
  trial_event_id: null,
  trial_ends_at: null,
  ...f,
});

test('5a · the unlock mirror: plan · paid · trial, and nothing else', () => {
  assert.deepEqual(specializedToolsUnlockFrom(facts({ tier_state: 'pro' }), null, NOW), { unlocked: true, source: 'plan' });
  assert.deepEqual(specializedToolsUnlockFrom(facts({ tier_state: 'enterprise', verification_state: null }), null, NOW), {
    unlocked: true,
    source: 'plan',
  });
  assert.equal(specializedToolsUnlockFrom(facts({ tier_state: 'pro', tier_expires_at: EARLIER }), null, NOW).unlocked, false);
  assert.deepEqual(specializedToolsUnlockFrom(facts({ unlock_expires_at: LATER }), null, NOW), { unlocked: true, source: 'paid' });
  assert.equal(specializedToolsUnlockFrom(facts({ unlock_expires_at: EARLIER }), null, NOW).unlocked, false);
  assert.equal(specializedToolsUnlockFrom(facts({ unlock_expires_at: LATER, verification_state: 'unverified' }), null, NOW).unlocked, false);
  assert.equal(specializedToolsUnlockFrom(facts({ unlock_expires_at: LATER, tier_state: 'free' }), null, NOW).unlocked, false);
  assert.equal(specializedToolsUnlockFrom(facts({ unlock_expires_at: LATER, tier_state: 'custom' }), null, NOW).unlocked, false);
  const trial = facts({ trial_event_id: 'e1', trial_ends_at: LATER });
  assert.deepEqual(specializedToolsUnlockFrom(trial, 'e1', NOW), { unlocked: true, source: 'trial' });
  assert.equal(specializedToolsUnlockFrom(trial, 'e2', NOW).unlocked, false, 'the next booking needs the unlock');
  assert.equal(specializedToolsUnlockFrom(trial, null, NOW).unlocked, false);
  assert.equal(specializedToolsUnlockFrom(facts({ trial_event_id: 'e1', trial_ends_at: EARLIER }), 'e1', NOW).unlocked, false);
  assert.equal(specializedToolsUnlockFrom(null, 'e1', NOW).unlocked, false);
});

test('5b · who may buy: Verified and Solo, verified — never Pro or Ultra, who already have it', () => {
  const buy = (tier: string | null, verification: string | null, tierExpiresAt: string | null = null) =>
    specializedToolsPurchaseEligibility({ tier, verification, tierExpiresAt, nowMs: NOW });
  assert.deepEqual(buy('verified', 'verified'), { ok: true });
  assert.deepEqual(buy('solo', 'verified'), { ok: true });
  assert.deepEqual(buy('pro', 'verified'), { ok: false, reason: 'included_in_plan' });
  assert.deepEqual(buy('enterprise', 'verified'), { ok: false, reason: 'included_in_plan' });
  assert.deepEqual(buy('pro', 'verified', EARLIER), { ok: true }, 'a lapsed Pro plan no longer includes it');
  assert.deepEqual(buy('solo', 'unverified'), { ok: false, reason: 'not_verified' });
  assert.deepEqual(buy('free', 'verified'), { ok: false, reason: 'tier_too_low' });
  assert.deepEqual(buy(null, null), { ok: false, reason: 'not_verified' });
});

test('5c · the window: 28 days or 365, stacking from the later of now and the current end', () => {
  assert.equal(specializedToolsPeriodDays(SPECIALIZED_TOOLS_SKU_CODE), SPECIALIZED_TOOLS_PERIOD_DAYS);
  assert.equal(specializedToolsPeriodDays(SPECIALIZED_TOOLS_ANNUAL_SKU_CODE), SPECIALIZED_TOOLS_ANNUAL_PERIOD_DAYS);
  assert.equal(specializedToolsPeriodDays('vendor_3d_booth'), null);
  assert.equal(nextSpecializedToolsExpiry(null, 28, NOW), new Date(NOW + 28 * 864e5).toISOString());
  assert.equal(nextSpecializedToolsExpiry(EARLIER, 28, NOW), new Date(NOW + 28 * 864e5).toISOString(), 'a lapsed window restarts now');
  assert.equal(
    nextSpecializedToolsExpiry(LATER, 365, NOW),
    new Date(Date.parse(LATER) + 365 * 864e5).toISOString(),
    'an early renewal keeps the time already paid for',
  );
});

test('5d · the trial answer fails CLOSED — anything unrecognised grants nothing', () => {
  assert.deepEqual(parseTrialClaim({ status: 'claimed', event_id: 'e1', ends_at: LATER }), {
    status: 'claimed',
    eventId: 'e1',
    endsAt: LATER,
  });
  for (const raw of [null, undefined, 'claimed', {}, { status: 'granted' }, { status: 42 }]) {
    assert.equal(parseTrialClaim(raw).status, 'unreadable', JSON.stringify(raw));
  }
});

test('5e · usage carries SHAPE only — a name, a phone, a sentence are not shape keys', () => {
  for (const ok of ['', 'check_in', 'guest_list', 'a', 'mode2']) assert.equal(isShapeKey(ok), true, ok);
  for (const bad of ['Juan Dela Cruz', 'juan dela cruz', '+639175550101', '09175550101', 'Table 12', '2x', 'a'.repeat(33), 'ana@x.ph']) {
    assert.equal(isShapeKey(bad), false, bad);
  }
});

test('5f · a Specialized tools order is a shop paying US — never a payout', () => {
  assert.equal(vendorPaysSetnayan(SPECIALIZED_TOOLS_SKU_CODE), true);
  assert.equal(vendorPaysSetnayan(SPECIALIZED_TOOLS_ANNUAL_SKU_CODE), true);
});
