import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE_PAGES } from '@/lib/feature-pages';
import { renderLlmsTxt } from '@/lib/llms-txt';
import { INPUT_FOR_GUARDS } from '@/lib/llms-txt-guard-input';

/**
 * VERIFICATION NEEDS THREE PAPERS, NOT FOUR (owner, DECISION_LOG 14 Nov 2026): DTI or SEC · BIR 2303 · Mayor's or
 * Business Permit. Bank proof was removed. The supplier feature pages and /llms.txt — what an ad visitor and an AI
 * assistant read — must never ask for it again.
 *
 * Scope: these two surfaces only. /for-suppliers, /for-coordinators, the Help article and the verification code move
 * in #7627 ("three papers, one Submit"); extend this list to them once that lands.
 *
 * SABOTAGE: put "bank proof" back in suppliers-b.ts or llms-txt.ts → RED.
 */

const BANK_PROOF = /\bbank (account )?proof\b|\bpatunay ng bank/i;

/**
 * Pages whose copy another open PR is already changing — left alone here so the two PRs do not collide. Each entry
 * EXPIRES: the test below fails once the page no longer says "bank proof", telling whoever merges next to delete it.
 */
const PENDING_IN_OTHER_PR: Readonly<Record<string, string>> = {
  // `marketplace` expired here: #7627 rewrote lib/feature-pages/plan-b.ts to the three papers, so /features/marketplace
  // is held by the test above like every other page. /for-suppliers, /for-coordinators and the Help article are held by
  // lib/three-verification-papers.test.ts (#7627).
};

const pageText = (f: (typeof FEATURE_PAGES)[number], l: 'en' | 'tl') =>
  [f.description[l], f.answer[l], ...f.steps[l], ...f.different[l], ...f.faq[l].map((x) => `${x.q} ${x.a}`)].join(' ');

test('no feature page asks for bank proof', () => {
  for (const f of FEATURE_PAGES) {
    if (PENDING_IN_OTHER_PR[f.slug]) continue;
    for (const l of ['en', 'tl'] as const) {
      assert.doesNotMatch(pageText(f, l), BANK_PROOF, `/features/${f.slug} (${l}) still asks for bank proof`);
    }
  }
});

test('every pending exemption is still needed — delete it the moment its PR lands', () => {
  for (const [slug, why] of Object.entries(PENDING_IN_OTHER_PR)) {
    const f = FEATURE_PAGES.find((p) => p.slug === slug);
    assert.ok(f, `${slug} is gone — delete its exemption`);
    assert.match(pageText(f, 'en'), BANK_PROOF, `/features/${slug} no longer says bank proof (${why}) — delete its exemption`);
  }
});

test('the Get Verified page names the three papers, in both languages', () => {
  const f = FEATURE_PAGES.find((p) => p.slug === 'supplier-verified');
  assert.ok(f, 'the supplier-verified page is gone — re-point this guard');
  for (const l of ['en', 'tl'] as const) {
    const text = [f.description[l], f.answer[l], ...f.faq[l].map((x) => x.a)].join(' ');
    for (const paper of ['DTI', 'SEC', 'BIR 2303', 'Permit']) assert.ok(text.includes(paper), `${l}: ${paper} is not named`);
  }
});

test('/llms.txt never asks for bank proof and names the three papers', () => {
  const body = renderLlmsTxt(INPUT_FOR_GUARDS);
  assert.doesNotMatch(body, BANK_PROOF);
  assert.match(body, /three business papers — DTI or SEC registration, BIR 2303, and a Mayor’s or Business Permit/);
});
