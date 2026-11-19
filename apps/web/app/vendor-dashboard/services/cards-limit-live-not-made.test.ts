/**
 * 🔒 CARDS ARE UNLIMITED TO MAKE — THE PLAN COUNTS THE LIVE ONES.
 *
 * Owner, 19 Nov 2026, verbatim: "service cards. you can create to the limit of your cards. but you can choose if you
 * want to add all." → "or we keep it unlimited" → "sorry. we already agreed they can add as many" → "so we can
 * motivate them to upgrade". DECISION_LOG 2026-11-10 "UNLIMITED CARDS, ONLY 3 LIVE" and the 17 Nov rule.
 *
 * #7975 (18 Nov) shipped the plan's `serviceCardsTotal` as a refusal on CREATE. This guard holds the reverse:
 *   · making a card past the plan's number is ALLOWED (no create path refuses on a card total);
 *   · turning a card LIVE past it is REFUSED — on every path that sets `is_active = true` (the list's switch and the
 *     maker's Publish / wizard finish), with the plan's number read from the plan source, never typed;
 *   · a NEW card asked to go live at the cap is saved HIDDEN, never refused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { heldHiddenMessage, LIVE_CARDS_UNREAD, liveCardsCapMessage, liveCardsVerdict } from '@/lib/live-cards-cap';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';

const ACTIONS = readFileSync(join(process.cwd(), 'app/vendor-dashboard/services/actions.ts'), 'utf8');

/** The body of one exported action — from its signature to the next top-level `export`. */
function bodyOf(name: string): string {
  const start = ACTIONS.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from services/actions.ts — this guard lost its subject`);
  const next = ACTIONS.indexOf('\nexport ', start + 10);
  return ACTIONS.slice(start, next < 0 ? undefined : next);
}

test('the module under test actually loaded', () => {
  assert.equal(typeof liveCardsVerdict, 'function');
  assert.ok(Number.isFinite(TIER_CAPS.free.serviceCardsTotal), 'Free has no finite live total — the cap cases below would test nothing');
});

test('activating past the plan\'s live total is REFUSED, with Problem → Solution words', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    const cap = TIER_CAPS[tier].serviceCardsTotal;
    if (!Number.isFinite(cap)) continue;
    assert.equal(liveCardsVerdict({ cap, liveOthers: cap - 1, isBranchCopy: false }), null, `${tier}: the last free slot was refused`);
    const at = liveCardsVerdict({ cap, liveOthers: cap, isBranchCopy: false });
    assert.equal(at, liveCardsCapMessage(cap), `${tier}: a card past the live total went live`);
    assert.ok(at && at.includes(String(cap)) && /live/.test(at) && /Hide one/.test(at) && /upgrade/i.test(at), at ?? '');
  }
});

test('a branch copy and an unlimited plan are never capped', () => {
  assert.equal(liveCardsVerdict({ cap: 1, liveOthers: 9, isBranchCopy: true }), null);
  assert.equal(liveCardsVerdict({ cap: Infinity, liveOthers: 999, isBranchCopy: false }), null);
});

test('CREATING past the plan\'s number is allowed — no create path refuses on a card total', () => {
  assert.doesNotMatch(ACTIONS, /serviceCardsTotalRefusal/, 'the create-time card-total refusal came back');
  assert.doesNotMatch(ACTIONS, /existing\.length\s*>=\s*caps\.serviceCardsTotal/, 'a create path counts cards made against the plan again');
  // The list's Add writes a hidden card, so it can never go live without the live count being asked.
  assert.match(bodyOf('createVendorService'), /is_active:\s*false/, 'the list\'s Add stopped writing a hidden card');
  assert.doesNotMatch(bodyOf('createVendorService'), /serviceCardsTotal\s*(!==|>=|>)/, 'the list\'s Add judges a card total again');
});

test('every path that turns a card LIVE asks the live count', () => {
  const toggle = bodyOf('toggleVendorServiceActive');
  assert.match(toggle, /liveCardsCapRefusal\(/, 'the list\'s on/off switch turns cards live without the plan\'s live total');
  assert.match(toggle, /fetchCapsWithAddOns\(/, 'the switch stopped reading the cap from the plan source');
  const commit = bodyOf('commitVendorService');
  assert.match(commit, /liveCardsCapRefusal\(\s*supabase,\s*profile\.vendor_profile_id,\s*caps\.serviceCardsTotal/, 'Publish / wizard finish no longer asks the live total from the plan caps');
  // An EDIT past the total is refused; a NEW card is held hidden, never refused.
  assert.match(commit, /if \(overLive && !isCreate\) return back\(overLive\)/, 'an edit turned live past the total is no longer refused');
  assert.match(commit, /publish = false;\s*heldHidden = overLive;/, 'a new card at the cap is refused instead of saved hidden');
  // The number is never typed beside the gate.
  assert.doesNotMatch(ACTIONS, /liveCardsCapRefusal\([^)]*\b\d+\s*[,)]/, 'a live-cards cap was hard-coded');
});

test('the sentences say what happened and what to do', () => {
  assert.match(heldHiddenMessage(liveCardsCapMessage(3)), /saved and hidden/);
  assert.match(LIVE_CARDS_UNREAD, /could not/);
});
