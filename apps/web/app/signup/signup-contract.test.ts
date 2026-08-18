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
const POSTED_FIELDS = [
  'account_type',
  'email',
  'first_name',
  'last_name',
  'next',
  'password',
  'public_summary_consent',
  'ref',
  'refc',
  'remember',
  'src_event',
] as const;

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

test('the two account-type radios still share one name — that is what makes it a choice', () => {
  const code = SRC();
  const radios = [...code.matchAll(/<AccountTypeOption\b/g)].length;
  assert.equal(radios, 2, 'Couple and vendor: two options, one question.');
  assert.match(
    code,
    /name="account_type"/,
    'Both radios must post under the same name or the choice stops being a choice.',
  );
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

test('the four typed fields keep their autocomplete hints', () => {
  // Not cosmetic: these are what let a phone fill the form in one tap, and a
  // restyle that rewrites the JSX is exactly where they get dropped.
  const code = SRC();
  for (const hint of ['given-name', 'family-name', 'email', 'new-password']) {
    assert.match(
      code,
      new RegExp(`autoComplete="${hint}"`),
      `autoComplete="${hint}" went missing — the form got harder to fill on a phone.`,
    );
  }
});
