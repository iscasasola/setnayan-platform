/**
 * signup-contract.test.ts — the sign-up form still posts what it posted.
 *
 * WHY THIS EXISTS, AND WHY IT WAS WRITTEN BEFORE THE CHANGE, NOT AFTER.
 * `/signup` is the one screen in this product where a mistake costs a real
 * customer. A dropped field here does not throw, does not fail a lint, and does
 * not fail typecheck — `signUp` reads it off FormData and gets `null`. The only
 * symptom is somebody who never arrived, and nothing in this repo would tell us.
 *
 * That is the same family as every other silent failure recorded here: the
 * phantom column, the phantom enum value, the phantom RPC argument, the blocked
 * iframe. **Rejected or absent, never thrown.**
 *
 * ⚠ THIS FILE PINS THE CONTRACT, NOT THE DESIGN. It says nothing about layout,
 * colour, wording or which column a field sits in — the 2026-08-17 port changes
 * all of that on purpose. If a redesign needs this file edited to go green, a
 * FIELD was added or removed, and that is a product decision that belongs in the
 * PR description, not a test tweak.
 *
 * 🛡 Captured from `origin/main` BEFORE the register port, by counting
 * `name="…"` across the file (the four fields render through <FormField>, so an
 * `<input name=>` scan alone finds only 8 of the 11 and would have passed while
 * three real fields went missing — that was the first draft of this guard).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = () => {
  const raw = readFileSync(join(HERE, 'page.tsx'), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
};

/**
 * Every field the server action can read, as of the pre-port contract.
 *
 * `account_type` is one NAME shared by two radios — that is what makes it a
 * single choice, so it is counted once and asserted as a pair separately.
 */
// ── 2026-09-22 · THE CONTRACT MOVED, ON PURPOSE (owner: "small card for signup").
// Three names left this page and this list with them, each to a named home:
//   • first_name · last_name  → /signup/you (the "You" card, right after the
//     account exists — app/signup/you/page.tsx posts them to saveYou);
//   • public_summary_consent  → the You card too, for now, couples only and in
//     event-neutral words (owner 2026-09-22: "why is it asking about wedding?
//     we have multiple events"); its final home is event creation, per event
//     (build 2). The field, its value and its guardrails are unchanged.
// The Terms box (name={TERMS_FIELD}) is pinned by terms-are-agreed-not-assumed.
const POSTED_FIELDS = [
  'account_type',
  'email',
  'next',
  'password',
  'ref',
  'refc',
  'remember',
  'src_event',
] as const;

test('what LEFT this page is not quietly back — it has a named home', () => {
  const code = SRC();
  for (const gone of ['first_name', 'last_name', 'public_summary_consent']) {
    assert.doesNotMatch(
      code,
      new RegExp(`\\bname="${gone}"`),
      `${gone} is back on /signup. It moved on 2026-09-22 to /signup/you. Put it there, not here.`,
    );
  }
});

test('every field the sign-up form posted is still posted', () => {
  const code = SRC();
  const present = new Set(
    [...code.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1] as string),
  );
  const missing = POSTED_FIELDS.filter((f) => !present.has(f));
  assert.deepEqual(
    missing,
    [],
    'A field vanished from /signup. Nothing else in this repo will tell you: the ' +
      'server action reads FormData, so a missing field is `null`, not an error — ' +
      `the only symptom is a customer who never arrived. Missing: ${missing.join(', ')}`,
  );
});

test('no field was silently ADDED either — the contract is exact', () => {
  // A port should not grow the form. If it did, that is a product change and
  // wants saying out loud rather than appearing in a styling diff.
  const code = SRC();
  // `.filter(Boolean)` with a type predicate is REQUIRED, not tidiness:
  // `noUncheckedIndexedAccess` types a capture group as `string | undefined`.
  const present = [
    ...new Set(
      [...code.matchAll(/\bname="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((n): n is string => typeof n === 'string'),
    ),
  ];
  const extra = present.filter((f) => !(POSTED_FIELDS as readonly string[]).includes(f));
  assert.deepEqual(extra, [], `Unexpected new field(s) on /signup: ${extra.join(', ')}`);
});

/**
 * ⚠ THIS TEST WAS REWRITTEN ON 2026-09-20, AND THE DOCBLOCK ABOVE SAYS WHEN
 * THAT IS ALLOWED: *"If a redesign needs this file edited to go green, a FIELD
 * was added or removed, and that is a product decision that belongs in the PR
 * description, not a test tweak."* No field was added or removed —
 * `account_type` still posts — but it stopped being a QUESTION and became a
 * value, which is the same class of product decision. It is owner-locked and it
 * is in the PR description. It was two radios, "I'm a couple / I'm a vendor".
 */
test('account_type posts exactly once, and nothing on screen asks for it', () => {
  const code = SRC();
  assert.equal(
    [...code.matchAll(/<AccountTypeOption\b/g)].length,
    0,
    'The Couple/Vendor chooser is back. An NFC vendor card sends a COUPLE here ' +
      '(?as=couple) and asking them whether they are a vendor is the defect ' +
      'this file now pins — owner-locked 2026-09-20.',
  );
  assert.equal(
    [...code.matchAll(/type="radio"/g)].length,
    0,
    'A radio reappeared on /signup. If it is a new account_type chooser, see above.',
  );
  const fields = [...code.matchAll(/\bname="account_type"/g)].length;
  assert.equal(
    fields,
    1,
    `account_type must post from exactly ONE input, not ${fields}. Two inputs ` +
      'sharing the name is how a radio group works — and how a stray second ' +
      'field would silently win, since FormData.get() returns the first.',
  );
  assert.match(
    code,
    /<input type="hidden" name="account_type" value=\{accountType\} \/>/,
    'account_type must carry the value the URL decided (accountTypeForSignup), ' +
      'not a hard-coded string — /signup?as=vendor is still the vendor door.',
  );
});

test('the account type is decided by the shared helper, not re-derived here', () => {
  // The decision is a pure module precisely so signup-intent.test.ts can RUN
  // it. A local `params.as === 'vendor'` would go green on both files while
  // the two drifted apart — that is how `as=couple` came to be ignored for
  // months in the first place.
  const code = SRC();
  assert.match(code, /accountTypeForSignup\(params\.as\)/, 'use the shared helper');
  assert.doesNotMatch(
    code,
    /params\.as === 'vendor'/,
    'The account type was re-derived inline. One rule, one place.',
  );
});

test('no consent block on this page at all — not even a CSS-gated one', () => {
  const code = SRC();
  assert.doesNotMatch(code, /data-couple-only/, 'the old CSS gate must not return');
  assert.doesNotMatch(code, /coupleConsent/, 'the consent left /signup on 2026-09-22 (now on /signup/you)');
});

test('the form still submits to the same server action', () => {
  assert.match(
    SRC(),
    /<form[^>]*action=\{signUp\}/,
    'The port changes how /signup looks, never where it posts.',
  );
});

test('the bot check is still on the form', () => {
  // Renders nothing until a Turnstile site key is set, but sign-up is one of the
  // endpoints Supabase's captcha exists to protect. Losing it in a restyle would
  // be invisible until the day it is switched on.
  assert.match(SRC(), /<TurnstileField/, 'TurnstileField must survive the port.');
});

test('the two typed fields keep their autocomplete hints (the name fields moved to /signup/you)', () => {
  // Not cosmetic: these are what let a phone fill the form in one tap, and a
  // restyle that rewrites the JSX is exactly where they get dropped.
  const code = SRC();
  for (const hint of ['email', 'new-password']) {
    assert.match(
      code,
      new RegExp(`autoComplete="${hint}"`),
      `autoComplete="${hint}" went missing — the form got harder to fill on a phone.`,
    );
  }
});
