/**
 * 🔁 THE ONE-TIME TERMS RE-ASK.
 *   · 2026-09-25 (owner "yes"): accounts with NO agreement on record are asked once.
 *   · 2026-10-25 (owner, verbatim "Yes" to: "after the no-refunds change, should everyone re-agree to the Terms once
 *     on next login?"): the ask is about the VERSION — every account whose agreement is older than the Terms in force
 *     (or absent) is asked once; a new sign-up, which records the current version, never is.
 *
 * What this pins:
 *   1. the prompt shows when the stored agreement is older than the current version (or absent);
 *   2. it is hidden after agreeing — the save writes the current version, which the predicate reads as agreed, and the
 *      sheet closes only on a save that came back ok;
 *   3. it never mounts on a guest route — its importers are exactly the couple, supplier and admin layouts;
 *   4. the agreement is affirmative (built inside the press, never a hidden or pre-set field), and a failed save is
 *      said, with Retry.
 *
 * Comments stripped before matching (`lib/strip-comments.ts`), so a fix's own explanation is never the finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { TERMS_VERSION, agreedToCurrentTerms, needsTermsAgreement } from './terms-agreement';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SHEET = 'app/_components/terms-reaccept/terms-reaccept-sheet.tsx';
const ACTION = 'app/_components/terms-reaccept/actions.ts';
/** The ONLY places the sheet may mount — every signed-in tree, and nothing a guest opens. */
const MOUNTS = ['app/dashboard/layout.tsx', 'app/vendor-dashboard/layout.tsx', 'app/admin/layout.tsx'];

// ── 1. WHO IS ASKED ────────────────────────────────────────────────────────

// SABOTAGE: make needsTermsAgreement return false for an older version → RED.
test('an agreement older than the Terms in force — or none at all — is asked', () => {
  assert.equal(needsTermsAgreement({ terms_version: '2026-06-30' }), true, 'the pre-no-refunds Terms');
  assert.equal(needsTermsAgreement({ terms_version: null }), true, 'no agreement on record (browsewrap, a forgetful door)');
  assert.equal(TERMS_VERSION, '2026-10-23', 'the version is the no-refunds Terms; bumping it re-asks everyone');
});

test('an agreement to the current Terms is never asked again', () => {
  assert.equal(needsTermsAgreement({ terms_version: TERMS_VERSION }), false);
  assert.equal(agreedToCurrentTerms(TERMS_VERSION), true);
});

test('a failed read, an unselected column or an anonymous planner is never locked out (fails open)', () => {
  assert.equal(needsTermsAgreement(null), false, 'no row / the read failed');
  assert.equal(needsTermsAgreement({}), false, 'terms_version was not selected — an unknown is not a "no"');
  assert.equal(needsTermsAgreement({ terms_version: null }, { isAnonymous: true }), false);
});

// ── 2. HIDDEN AFTER AGREEING ───────────────────────────────────────────────

// SABOTAGE: write a constant other than TERMS_VERSION in the save → RED.
// SABOTAGE: drop `setOpen(false)` from the ok branch → RED.
test('the save writes the current version, which reads as agreed; the sheet closes only on an ok save', () => {
  const action = read(ACTION);
  assert.match(action, /\.update\(\{ terms_accepted_at: new Date\(\)\.toISOString\(\), terms_version: TERMS_VERSION \}\)/);
  assert.equal(needsTermsAgreement({ terms_version: TERMS_VERSION }), false, 'what the save writes must end the ask');
  assert.match(
    action,
    /\.eq\('user_id', user\.id\)\s*\.or\(`terms_version\.is\.null,terms_version\.lt\.\$\{TERMS_VERSION\}`\)/,
    'own row only, and never re-dates an agreement to the current Terms',
  );
  assert.match(action, /revalidatePath\('\/dashboard', 'layout'\)/, 'the signed-in trees re-read the record');

  const sheet = read(SHEET);
  assert.match(sheet, /if \(res\.ok\) \{\s*setOpen\(false\);\s*router\.refresh\(\);\s*\} else \{\s*setError\(res\.message\);/);
});

// ── 3. EVERY SIGNED-IN TREE, AND NO GUEST PAGE ─────────────────────────────

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(tsx?|mts)$/.test(e) && !e.includes('.test.')) out.push(full);
  }
  return out;
}

// SABOTAGE: import the sheet from app/[slug]/layout.tsx (or any guest page) → RED.
test('the sheet mounts in exactly the couple, supplier and admin layouts — never on a guest route', () => {
  const importers = files(join(WEB, 'app'))
    .filter((f) => stripComments(readFileSync(f, 'utf8')).includes('terms-reaccept/terms-reaccept-sheet'))
    .map((f) => relative(WEB, f))
    .sort();
  assert.deepEqual(importers, [...MOUNTS].sort(), 'a new mount is a new decision — guests are not accounts');
  for (const m of importers) {
    assert.doesNotMatch(m, /^app\/(\[slug\]|papic|join|wall|live|tl|u|v)\//, `${m} is a guest route`);
  }
  assert.ok(!read('app/layout.tsx').includes('TermsReaccept'), 'the root layout covers guest pages');
});

// SABOTAGE: drop terms_version from a layout's select → RED (the predicate would fail open for everyone).
// SABOTAGE: render the sheet unconditionally → RED.
test('each layout reads the version, asks the predicate, and mounts the sheet over the page — never a redirect', () => {
  for (const m of MOUNTS) {
    const src = read(m);
    assert.match(src, /from\('users'\)\s*\.select\(\s*'[^']*\bterms_version\b[^']*'/, `${m} must select terms_version`);
    assert.match(src, /const termsAsk = needsTermsAgreement\(profile, \{ isAnonymous: !!user\.is_anonymous \}\);/, m);
    assert.match(src, /\{termsAsk \? <TermsReacceptSheet \/> : null\}/, `${m} must mount the sheet only when asked`);
    assert.doesNotMatch(src, /redirect\([^)]*terms/i, `${m}: a redirect can loop`);
  }
});

// ── 4. AFFIRMATIVE, AND NEVER A TRAP ───────────────────────────────────────

// SABOTAGE: add <input type="hidden" name={TERMS_FIELD} value="yes" /> to the sheet → RED.
// SABOTAGE: build the FormData outside the press handler → RED.
test('the agreement is built inside the press — no hidden field, no pre-set box', () => {
  const sheet = read(SHEET);
  assert.doesNotMatch(sheet, /type="hidden"|defaultChecked|checked=\{?true|<form/, 'nothing on the page pre-sets an agreement');
  assert.match(sheet, /function agree\(\) \{[\s\S]{0,200}fd\.set\(TERMS_FIELD, 'yes'\)/);
  assert.equal(sheet.match(/fd\.set\(TERMS_FIELD/g)?.length, 1, 'one place builds it');
  assert.match(sheet, /onClick=\{agree\}/);
  assert.match(read(ACTION), /if \(!hasAgreedToTerms\(formData\.get\(TERMS_FIELD\)\)\) \{\s*return \{ ok: false/);
});

// SABOTAGE: remove the role="alert" error line, or the "Retry" label → RED.
test('a failed save is said, with Retry, and the sheet stays', () => {
  const sheet = read(SHEET);
  assert.match(sheet, /\{error \? \(\s*<p role="alert"[^>]*>\s*\{error\}/);
  assert.match(sheet, /error \? 'Retry' : 'I agree'/);
  assert.match(sheet, /catch \{\s*res = \{ ok: false, message: TERMS_SAVE_FAILED_MESSAGE \}/, 'a thrown action is a failed save, not a blank');
  const action = read(ACTION);
  assert.ok((action.match(/return \{ ok: false, message: TERMS_SAVE_FAILED_MESSAGE \}/g) ?? []).length >= 2, 'an error and a throw both say so');
  assert.match(sheet, /<Link\s+href="\/terms"/, 'the Terms can always be read');
});
