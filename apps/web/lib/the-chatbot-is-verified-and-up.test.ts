import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLAN_CHATBOT_LEVEL, planChatbotLevel, vendorAiAdvancedActive, vendorAiBasicActive } from './vendor-ai-level';
import { canUse, LOCKS } from './locks';

/**
 * 💬 Owner 2026-11-21, verbatim: "AI Chatbot is for verified and up but smarter chatbot is for pro and up"
 * (DECISION_LOG 21 Nov; replaces the 14 Nov split — chatbot on Pro, smarter on Ultra). Both levels come with the plan;
 * neither is sold on its own. A chatbot window a shop bought still runs to its end.
 */
const NOW = Date.parse('2026-11-21T00:00:00Z');
const FUTURE = '2027-01-01T00:00:00Z';
const PAST = '2026-11-01T00:00:00Z';
const shop = (tier: string, verification: string | null, expires: string | null = FUTURE) => ({
  tier_state: tier,
  tier_expires_at: tier === 'free' || tier === 'verified' ? null : expires,
  verification_state: verification,
});

test('the table: Free none · Verified and Plus basic · Pro and Ultra the smarter level', () => {
  assert.deepEqual({ ...PLAN_CHATBOT_LEVEL }, { free: 'none', verified: 'basic', solo: 'basic', pro: 'advanced', enterprise: 'advanced' });
});

test('an unverified Free shop has no chatbot — the 🔒', () => {
  for (const v of [null, 'unverified', 'pending_review', 'rejected', 'demoted']) {
    assert.equal(planChatbotLevel(shop('free', v), NOW), 'none', String(v));
    assert.equal(vendorAiBasicActive({ level: null, windowActive: false, plan: shop('free', v) }), false, String(v));
  }
  assert.deepEqual(canUse('chatbot', { verified: false, tier: 'free' }), { ok: false, needs: 'verify' });
  assert.equal(LOCKS.chatbot.opens, 'verified');
});

test('a verified Free shop gets the basic chatbot — approval does not rewrite tier_state, so verification_state counts', () => {
  for (const s of [shop('free', 'verified'), shop('verified', 'verified')]) {
    assert.equal(planChatbotLevel(s, NOW), 'basic');
    assert.equal(vendorAiBasicActive({ level: null, windowActive: false, plan: s }), true);
    assert.equal(vendorAiAdvancedActive({ level: null, windowActive: false, plan: s }), false);
  }
  assert.deepEqual(canUse('chatbot', { verified: true, tier: 'free' }), { ok: true });
});

test('Plus gets the basic chatbot, not the smarter one', () => {
  const s = shop('solo', 'verified');
  assert.equal(planChatbotLevel(s, NOW), 'basic');
  assert.equal(vendorAiBasicActive({ level: null, windowActive: false, plan: s }), true);
  assert.equal(vendorAiAdvancedActive({ level: null, windowActive: false, plan: s }), false);
});

test('Pro and Ultra get the smarter chatbot (and so the basic one)', () => {
  for (const tier of ['pro', 'enterprise']) {
    const s = shop(tier, 'verified');
    assert.equal(planChatbotLevel(s, NOW), 'advanced', tier);
    assert.equal(vendorAiAdvancedActive({ level: null, windowActive: false, plan: s }), true, tier);
    assert.equal(vendorAiBasicActive({ level: null, windowActive: false, plan: s }), true, tier);
  }
});

test('a Pro plan whose day passed reads as Verified (basic) for a verified shop, none for an unverified one', () => {
  assert.equal(planChatbotLevel(shop('pro', 'verified', PAST), NOW), 'basic');
  assert.equal(planChatbotLevel(shop('pro', 'unverified', PAST), NOW), 'none');
});

test('a bought chatbot window still runs to its end on any plan', () => {
  assert.equal(vendorAiBasicActive({ level: 'basic', windowActive: true, plan: shop('free', null) }), true);
  assert.equal(vendorAiAdvancedActive({ level: 'advanced', windowActive: true, plan: shop('solo', 'verified') }), true);
});

test('the inbox gate reads verification_state, so a verified Free shop is answered', () => {
  const src = readFileSync(join(__dirname, 'vendor-autoreply/inbox-hook.ts'), 'utf8');
  assert.match(src, /\.select\('ai_addon_expires_at, tier_state, tier_expires_at, verification_state'\)/);
});
