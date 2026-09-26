/**
 * 🔁 THE ONE-TIME TERMS RE-ASK (owner 2026-09-25, "yes" to re-prompting).
 * Who is asked (pure), and that the dashboard actually mounts the ask and the
 * save refuses without the box and never overwrites an earlier agreement.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLICKWRAP_SINCE, needsTermsAgreement } from './terms-agreement';

const APP = join(__dirname, '..', 'app', 'dashboard');

test('an account made since the clickwrap with no agreement is asked', () => {
  assert.equal(needsTermsAgreement({ terms_accepted_at: null, created_at: '2026-09-25T10:00:00Z' }), true);
  assert.equal(needsTermsAgreement({ terms_accepted_at: null, created_at: `${CLICKWRAP_SINCE}T00:00:01Z` }), true);
});

test('an account that agreed is never asked again', () => {
  assert.equal(needsTermsAgreement({ terms_accepted_at: '2026-09-25T10:00:00Z', created_at: '2026-09-25T10:00:00Z' }), false);
});

test('an account older than the clickwrap is not swept in', () => {
  assert.equal(needsTermsAgreement({ terms_accepted_at: null, created_at: '2026-09-21T23:59:59Z' }), false);
});

test('a failed read or an anonymous planner is never locked out (fails open)', () => {
  assert.equal(needsTermsAgreement(null), false);
  assert.equal(needsTermsAgreement({ terms_accepted_at: null, created_at: null }), false);
  assert.equal(needsTermsAgreement({ terms_accepted_at: null, created_at: '2026-09-25' }, { isAnonymous: true }), false);
});

test('the dashboard layout reads both columns and mounts the ask in place of the page', () => {
  const src = readFileSync(join(APP, 'layout.tsx'), 'utf8');
  assert.match(src, /\.select\('[^']*terms_accepted_at[^']*created_at[^']*'\)/);
  assert.match(src, /termsAsk \? \(\s*<TermsReaccept \/>/);
  assert.doesNotMatch(src, /redirect\([^)]*terms/i, 'the ask must render in place — a redirect can loop');
});

test('the save refuses without the ticked box and never overwrites an earlier agreement', () => {
  const src = readFileSync(join(APP, '_components', 'terms-reaccept-actions.ts'), 'utf8');
  assert.match(src, /if \(!hasAgreedToTerms\(formData\.get\(TERMS_FIELD\)\)\) return;/);
  assert.match(src, /\.eq\('user_id', user\.id\)\s*\.is\('terms_accepted_at', null\)/);
  assert.match(src, /terms_version: TERMS_VERSION/);
});
