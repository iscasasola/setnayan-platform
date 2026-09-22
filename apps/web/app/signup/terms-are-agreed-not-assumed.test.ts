/**
 * terms-are-agreed-not-assumed.test.ts — CTRL-B3 build 2.
 *
 * ── THE DEFECT, measured 2026-09-22 ────────────────────────────────────────
 * `/signup` carried BROWSEWRAP: *"By signing up, you agree to our Terms and
 * Privacy"* as a footnote BELOW the submit button. No checkbox, nothing
 * required, and nothing recorded — so there was no answer to "what did this
 * person agree to, and when?", which is the only question that matters if it
 * is ever asked. Browsewrap is materially weaker in Philippine courts and under
 * the NPC's consent standard than a clickwrap the person performs.
 *
 * ── THE SIBLING THIS EXTENDS ───────────────────────────────────────────────
 * `consent-is-affirmative.test.ts` holds that no door may consent on a couple's
 * behalf, after one door posted a hidden `public_summary_consent`. This is the
 * same rule about a different agreement, and it is deliberately APP-WIDE for
 * the same reason that one is: the ruling was obeyed in one place and nothing
 * noticed the second.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  TERMS_FIELD,
  TERMS_VERSION,
  hasAgreedToTerms,
  TERMS_REQUIRED_MESSAGE,
} from '@/lib/terms-agreement';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

// ── THE RULE, EXECUTED ─────────────────────────────────────────────────────

// SABOTAGE: return true for an absent value → RED.
test('an unticked box posts NOTHING, and nothing is a refusal', () => {
  for (const v of [null, undefined, '', '   ', 'off', 'false', '0', 'no', 'maybe']) {
    assert.equal(
      hasAgreedToTerms(v as never),
      false,
      `${JSON.stringify(v)} must be refused — an unticked HTML checkbox omits the key entirely, so if absent passed, the one state meaning "they did not agree" would be the state that lets everyone through`,
    );
  }
  for (const v of ['on', 'yes', 'true', '1', 'ON', ' Yes ']) {
    assert.equal(hasAgreedToTerms(v), true, `${JSON.stringify(v)} is an affirmative tick`);
  }
});

// SABOTAGE: change TERMS_VERSION without touching /terms → RED.
test('the version recorded is the version a person can actually read', () => {
  const terms = readCode('app/(shell)/terms/page.tsx');
  assert.ok(
    terms.includes(`Effective ${TERMS_VERSION}`),
    `TERMS_VERSION is ${TERMS_VERSION} but /terms does not say "Effective ${TERMS_VERSION}" — an agreement recorded against a version nobody can look up is not evidence of anything`,
  );
});

// ── THE DOOR ───────────────────────────────────────────────────────────────

// SABOTAGE: remove `required` from the checkbox → RED.
// SABOTAGE: add `defaultChecked` → RED.
test('the box is on the page, above the submit, and starts UNTICKED', () => {
  const page = readCode('app/signup/page.tsx');
  assert.equal(
    count(page, new RegExp(`name=\\{TERMS_FIELD\\}`)),
    1,
    'the agreement must be a checkbox the person ticks, not a sentence under the button',
  );
  assert.match(page, /name=\{TERMS_FIELD\}[\s\S]{0,120}required/, 'the browser half must be present');
  assert.equal(
    count(page, /name=\{TERMS_FIELD\}[\s\S]{0,200}(defaultChecked|checked=\{true\})/),
    0,
    'pre-ticked is not agreement — the Stories box beside it starts unticked by an explicit 2026-07-12 ruling, and this is the same rule',
  );
  // 🪤 THE FIRST VERSION OF THIS ANCHOR LOOKED FOR `type="submit"`, which this
  // page does not contain — it uses the shared `<SubmitButton>`. The assertion
  // below could therefore never have run. It failed loudly (both indexes must
  // be > 0) rather than passing vacuously, which is the only reason the real
  // placement error underneath it was found: the checkbox had landed where the
  // footnote was, BELOW the button, reproducing the exact browsewrap being fixed.
  const box = page.indexOf('name={TERMS_FIELD}');
  const submit = page.indexOf('<SubmitButton');
  assert.ok(box > 0, 'the agreement checkbox is not on this page');
  assert.ok(submit > 0, 'the submit control moved — this guard is pointed at nothing');
  assert.ok(
    box < submit,
    'the agreement must be ABOVE the button that performs it — a footnote below the submit is the browsewrap this replaces',
  );
});

// SABOTAGE: delete the server-side check → RED.
test('the server refuses too — `required` is a hint, not a gate', () => {
  const actions = readCode('app/signup/actions.ts');
  assert.equal(
    count(actions, /hasAgreedToTerms\(formData\.get\(TERMS_FIELD\)\)/),
    1,
    'this is a server action reached by an HTTP POST: a hand-built form, a replay, or a browser with validation off all arrive with the field absent',
  );
  assert.match(actions, /error=terms_required/, 'the refusal must be nameable');
  const page = readCode('app/signup/page.tsx');
  assert.match(
    page,
    /terms_required: TERMS_REQUIRED_MESSAGE/,
    'a refusal with no sentence bounces the person back to a page that says nothing',
  );
  assert.ok(TERMS_REQUIRED_MESSAGE.length > 20, 'and the sentence must actually say something');
});

// SABOTAGE: drop terms_version from the write → RED.
test('the agreement is RECORDED, both halves', () => {
  const actions = readCode('app/signup/actions.ts');
  assert.match(actions, /terms_accepted_at: new Date\(\)\.toISOString\(\)/, 'when');
  assert.match(actions, /terms_version: TERMS_VERSION/, 'and WHAT — a timestamp alone says somebody clicked, not what they agreed to');
});

// SABOTAGE: drop the CHECK or the REVOKE from the migration → RED.
test('the subject of the record cannot author it, and half a record is refused', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.includes('users_record_the_terms_they_agreed_to'));
  assert.ok(file, 'the migration is missing');
  const sql = readFileSync(join(dir, file), 'utf8');
  assert.match(
    sql,
    /REVOKE UPDATE \(terms_accepted_at, terms_version\) ON public\.users FROM anon, authenticated/,
    'RLS is row-level and cannot hide a column, and users is owner-updatable — without this a person could stamp or clear their own consent record with one PostgREST call',
  );
  assert.match(
    sql,
    /CHECK \(\(terms_accepted_at IS NULL\) = \(terms_version IS NULL\)\)/,
    'a version with no timestamp is a claim with no date; a timestamp with no version points at nothing',
  );
  assert.equal(
    count(sql, /UPDATE public\.users\s+SET/i),
    0,
    'never backfilled: stamping existing accounts would manufacture a clickwrap record for a click that never happened',
  );
});
