/**
 * a-new-shop-is-counted-for-what-it-was-asked.test.ts — owner "Yes to all", 2026-10-22
 * (`prototypes/journey_fixes_2026-10-22.html` § Supplier 2 · Option A).
 *
 * A new shop opened "unfinished" for two things the opening steps never asked (the logo and the
 * "in business since" year), and its document count said "of 7", "of 4" or "of 8" depending on the page;
 * the contacts step could never finish while texting was "coming soon". Held as properties:
 *   1 · EST is asked ONCE, on open-shop step 2, as one dropdown ("Just starting" first) — and written once;
 *   2 · the logo is its own Today first step, out of "fields left" — and approval still needs it;
 *   3 · ONE document count: the three required papers (four until the owner's 2026-11-14 ruling, DECISION_LOG f69ec167) — on the stepper, Today, the Shop ⚙ and each card;
 *   4 · the contacts step counts only what can be confirmed ("0 of 1" until a text number exists).
 *
 * SABOTAGE (each seen red before this shipped — PR body has the runs): the step-2 dropdown removed → 1 ·
 * the logo step dropped from the rail → 2 · `onlyLogoMissing` letting submit through → 2 · the stepper
 * back on `vendorTotal` → 3 · the card back on "Item n of 8" → 3 · contacts needing the text again → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { inBusinessSinceChoices, parseInBusinessSince, SINCE_FLOOR } from '@/lib/in-business-since';
import { buildFirstStepsRail, type FirstStepsInput } from '@/lib/vendor-first-steps';
import { businessProfileChecklist, profileGaps } from '@/lib/vendor-profile';
import {
  DOC_SLOTS,
  REQUIRED_DOC_COUNT,
  REQUIRED_DOC_SLOT_KEYS,
  countCompleteRequiredSlots,
  requiredDocPosition,
  verificationSubmitMissing,
} from '@/lib/vendor-verification';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ─── 1 · EST, ASKED ONCE ON STEP 2 ─────────────────────────────────────── */

// 🔁 RETARGETED 2026-11-06 — owner, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED": "In business since" LEAVES the
// sign-up door (Your details on Today asks it, with the same dropdown). The door must not ask it again; the choices
// and the parser it uses everywhere are still pinned, and the action still never moves a year a shop already has.
test('1 · "In business since" is off the sign-up door; its choices are "Just starting" first, never a year twice', () => {
  const wizard = code('app/open-shop/_components/open-shop-wizard.tsx');
  const step2 = wizard.slice(wizard.indexOf("step === 2 ? 'space-y-4'"), wizard.indexOf("step === 3 ? 'space-y-4'"));
  assert.ok(step2.length > 500, 'anti-vacuity: step 2 not found in the wizard');
  assert.doesNotMatch(wizard, /in_business_since_year|sinceChoices|In business since/, 'the year is back on the sign-up door');

  const choices = inBusinessSinceChoices(2026);
  assert.deepEqual(choices[0], { key: '2026', label: 'Just starting' });
  assert.deepEqual(choices.slice(1, 3).map((c) => c.key), ['2025', '2024'], 'newest first');
  assert.equal(choices.at(-1)!.key, String(SINCE_FLOOR));
  assert.equal(new Set(choices.map((c) => c.key)).size, choices.length, 'a year is offered twice');

  assert.equal(parseInBusinessSince('2019', 2026), 2019);
  for (const bad of ['', '2027', '1800', '19', 'x', null, undefined]) {
    assert.equal(parseInBusinessSince(bad, 2026), null, `${String(bad)} was accepted`);
  }
  const action = code('app/open-shop/actions.ts');
  assert.match(action, /parseInBusinessSince\(formData\.get\('in_business_since_year'\)/, 'the action never reads the year');
  assert.match(
    action,
    /if \(sinceYear && !\(existing[^)]*\)\?\.in_business_since_year\)/,
    'the wizard can move a year the shop already has — that clears the DTI experience check behind Your details’ back',
  );
});

/* ─── 2 · THE LOGO IS ITS OWN STEP ──────────────────────────────────────── */

const NEW_SHOP: FirstStepsInput = {
  verified: false,
  profileDone: 7,
  profileTotal: 7,
  hasLogo: false,
  serviceCount: 0,
  docsStatus: 'none',
  docsIn: 0,
  docsTotal: REQUIRED_DOC_COUNT,
  submitMissing: ['Add your logo'],
  customerCount: 0,
};

test('2 · the logo is the second first step, out of "fields left" — and, since 2026-11-14, it no longer blocks Submit', () => {
  const rail = buildFirstStepsRail(NEW_SHOP);
  const logo = rail.steps.find((s) => s.key === 'logo');
  assert.ok(logo, 'the rail has no logo step');
  assert.equal(logo.n, 2);
  assert.equal(logo.title, 'Add your logo');
  // Owner 2026-11-14 (DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"; profile gate: "Yes, remove it").
  assert.doesNotMatch(logo.body, /needed to go live/i, 'the logo step claims it gates going live again');
  assert.equal(logo.state, 'now', 'details done, no logo — the logo is not the next thing');
  assert.equal(rail.steps.find((s) => s.key === 'shop_details')?.state, 'done');
  assert.equal(rail.steps.find((s) => s.key === 'documents')?.blockedBy, null, 'a missing logo blocks the papers again');
  assert.equal(buildFirstStepsRail({ ...NEW_SHOP, hasLogo: true }).steps.find((s) => s.key === 'logo')?.state, 'done');

  // "Fields left" leaves the logo out — the gate does not.
  const fresh = businessProfileChecklist({ business_name: 'Lumina', logo_url: null } as never);
  const gaps = profileGaps(fresh);
  assert.ok(gaps.logoMissing);
  assert.equal(gaps.fieldsLeft, fresh.items.filter((i) => !i.ok).length - 1, 'the logo is still counted as a field left');
  const onlyLogo = profileGaps({ items: fresh.items.map((i) => ({ ...i, ok: i.key !== 'logo' })) });
  assert.deepEqual(onlyLogo, { fieldsLeft: 0, logoMissing: true, onlyLogoMissing: true });
  const allIn = Object.fromEntries([...REQUIRED_DOC_SLOT_KEYS].map((k) => [k, { r2_key: `k/${k}` }]));
  assert.deepEqual(
    verificationSubmitMissing({ uploads: allIn }),
    [],
    'a shop with the three papers in cannot submit',
  );
  for (const rel of ['app/vendor-dashboard/shop/inline-docs-actions.ts', 'app/vendor-dashboard/profile/details-data.ts', 'lib/vendor-first-steps.server.ts']) {
    assert.match(code(rel), /verificationSubmitMissing\(\{/, `${rel} stopped calling the one submit gate`);
    assert.doesNotMatch(code(rel), /verificationSubmitMissing\(\{[^}]*(?:profileComplete|onlyLogoMissing)/, `${rel} feeds the business profile into the submit gate again`);
  }
  for (const rel of ['app/vendor-dashboard/shop/page.tsx', 'app/vendor-dashboard/profile/details-data.ts']) {
    assert.match(code(rel), /fieldsLeft: profileGaps\(/, `${rel} counts "fields left" its own way`);
  }
});

/* ─── 3 · ONE DOCUMENT COUNT ────────────────────────────────────────────── */

test('3 · every document count is "n of 3 required"; optional items carry none', () => {
  // Owner 2026-11-14 (DECISION_LOG f69ec167): "just the 3. DTI/SEC, BIR, Mayor's/Business Permit".
  assert.equal(REQUIRED_DOC_COUNT, 3);
  const req = DOC_SLOTS.filter((s) => REQUIRED_DOC_SLOT_KEYS.has(s.key)).map((s) => requiredDocPosition(s.key));
  assert.deepEqual(req, [1, 2, 3]);
  for (const s of DOC_SLOTS.filter((x) => !REQUIRED_DOC_SLOT_KEYS.has(x.key))) assert.equal(requiredDocPosition(s.key), null, s.key);
  assert.equal(countCompleteRequiredSlots({ dti_certificate: { r2_key: 'a' }, portfolio_samples: [{ r2_key: 'b' }] } as never), 1, 'an optional upload counts toward the three');

  const rail = buildFirstStepsRail(NEW_SHOP);
  assert.equal(rail.steps.find((s) => s.key === 'documents')?.meter, '0 of 3 required');
  const verify = code('app/vendor-dashboard/shop/_components/verify-section.tsx');
  assert.match(verify, /of \{formatCount\(REQUIRED_DOC_COUNT\)\} required<\/StepPill>/, 'the stepper is not "n of 3 required"');
  assert.doesNotMatch(verify, /vendorTotal\)\}/, 'the stepper counts every upload again ("of 7")');
  const card = code('app/_components/verification/doc-slot-card.tsx');
  assert.match(card, /`Required · \$\{formatCount\(requiredDocPosition\(slot\.key\)!\)\} of \$\{formatCount\(REQUIRED_DOC_COUNT\)\}`/);
  assert.doesNotMatch(card, /DOC_SLOTS\.length/, 'a card says "Item n of 8" again');
  // The documents fold MOVED from Shop › Details to the Shop ⚙ › Verification and documents (owner 2026-10-31, "Yes
  // follow your recommendation" — DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"); its count is held where it draws,
  // fed the same Details read.
  assert.match(code('app/vendor-dashboard/shop/_components/shop-settings-rows.tsx'), /of \$\{formatCount\(docs\.docsTotal\)\} required\b/, 'the Shop ⚙ documents fold is not "n of 4 required"');
  assert.match(code('app/vendor-dashboard/shop/_components/shop-settings-body.tsx'), /docsTotal: d\.docsTotal,/, 'the Shop ⚙ counts the documents from something other than the Details read');
  assert.match(code('lib/vendor-first-steps.server.ts'), /docsTotal: REQUIRED_DOC_COUNT/, 'Today counts every upload again');
});

/* ─── 4 · ONE STEP: THE PAPERS, THEN SUBMIT ────────────────────────────── */

// Owner 2026-11-14 (DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"): *"verification process is simple.
// submit the 3 documents and press submit. that's it. no other steps needed. we wait for admin cofirmation first."*
// The contacts step (VALIDATE email + text), the profile banner and the Google Meet are gone from Get verified.
test('4 · Get verified is the papers and Submit — no VALIDATE step, no profile banner, no Google Meet', () => {
  const verify = code('app/vendor-dashboard/shop/_components/verify-section.tsx');
  assert.doesNotMatch(verify, /ContactsStep|VALIDATE|validateEmail|emailConfirmedAt/, 'the VALIDATE contacts step is back');
  assert.doesNotMatch(verify, /finish your business profile|profileComplete|profileFieldsLeft/i, 'the profile gate is back on Get verified');
  assert.doesNotMatch(verify, /Google Meet|final confirmation|meetScheduledAt|short call/i, 'the Google Meet step is back');
  assert.doesNotMatch(verify, /steps done/, 'a multi-step progress bar is back');
  assert.equal((verify.match(/<DocsStep\b/g) ?? []).length, 1, 'the papers are not the one step');
  assert.match(verify, /<SubmitBlock missing=\{verify\.submitMissing\} \/>/, 'Submit no longer reads the one server gate');
});