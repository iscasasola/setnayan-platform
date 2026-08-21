/**
 * subprocessor-drift.test.ts — the two lists of outside companies must agree.
 *
 * 🚨 NOTHING CHECKED THEM AGAINST EACH OTHER. That is the whole defect. The
 * public `/privacy` page named three companies the internal compliance record
 * did not (Sentry, Google, TikTok), and the record named two that are not used
 * at all (the Persona/Veriff/Onfido trio, SendGrid). Neither list was wrong on
 * purpose — adding a processor to one is a different commit from adding it to
 * the other, and no test ever read both. The internal record had not been
 * touched since 2026-07-06.
 *
 * 🔑 THE PUBLIC PAGE'S JSX IS DELIBERATELY NOT REFACTORED. It is legal copy with
 * links and scoped explanations; rewriting it to render from an array would put
 * the wording at risk to fix a bookkeeping problem. These tests cross-check by
 * NAME, which is what actually drifted.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SUBPROCESSORS,
  PUBLIC_SUBPROCESSOR_NAMES,
  RETIRED_SUBPROCESSOR_NAMES,
  complianceRecordShape,
} from './subprocessors';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const privacy = () => readFileSync(join(WEB, 'app/privacy/page.tsx'), 'utf8');
const sql = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

test('every company we say handles data is named on the public page', () => {
  const page = privacy();
  for (const name of PUBLIC_SUBPROCESSOR_NAMES) {
    assert.ok(
      page.includes(name),
      `"${name}" handles data for us and the public privacy page never names it. ` +
        `Under-disclosure is the direction that costs a regulator's trust.`,
    );
  }
});

test('no retired company is presented as an active processor', () => {
  const page = privacy();
  for (const name of RETIRED_SUBPROCESSOR_NAMES) {
    // The page may still mention them to say they are NOT active — that is
    // honest and stays. What must not exist is a claim that they process data.
    //
    // ⚠ WORD BOUNDARIES, AND EVERY OCCURRENCE. A plain `indexOf('Persona')`
    // matched inside "Personal Information Controller" and inside "Patiktok
    // Personal tier" — two sentences with nothing to do with ID verification —
    // and checking only the FIRST hit would clear the file on the strength of an
    // unrelated word. Both mistakes made this test lie.
    const re = new RegExp(`\\b${name}\\b`, 'g');
    for (const m of page.matchAll(re)) {
      const idx = m.index ?? 0;
      const around = page.slice(Math.max(0, idx - 400), idx + 400);
      assert.ok(
        /not currently active|no longer|retired|not used/i.test(around),
        `"${name}" appears on the public page at offset ${idx} with nothing ` +
          `nearby saying it is inactive. It is not wired at all — only stubs ` +
          `exist — so presenting it as a processor is its own inaccuracy.`,
      );
    }
  }
  for (const s of SUBPROCESSORS) {
    assert.ok(
      !RETIRED_SUBPROCESSOR_NAMES.some((r) => s.name.includes(r)),
      `"${s.name}" is back on the active list. It is not used.`,
    );
  }
});

test('the retired list keeps every name that was verified unused', () => {
  // ⚠ A LIST THAT CAN SHRINK SILENTLY IS NOT A GUARD. Dropping a name from
  // RETIRED_SUBPROCESSOR_NAMES makes the check above stop looking for it, and
  // nothing else notices — so the four names verified unused on 2026-08-06 are
  // pinned here. Removing one now takes a deliberate edit to this assertion,
  // which is the point.
  for (const name of ['Persona', 'Veriff', 'Onfido', 'SendGrid']) {
    assert.ok(
      RETIRED_SUBPROCESSOR_NAMES.includes(name),
      `"${name}" left the retired list. It was verified NOT wired — stubs only — ` +
        `so dropping it here quietly stops anyone checking whether it came back.`,
    );
  }
});

test('the compliance record is written from this same list', () => {
  const s = sql();
  assert.ok(
    /platform_compliance_facts[\s\S]{0,400}sub_processors/.test(s),
    'No migration writes the compliance record, so the internal list still says ' +
      'whatever it said on 2026-07-06 while this file says something else.',
  );
  for (const entry of complianceRecordShape()) {
    assert.ok(
      s.includes(`"${entry.name}"`),
      `"${entry.name}" is in the source list but no migration puts it in the ` +
        `compliance record. The two lists are drifting again, which is the exact ` +
        `defect this file exists for.`,
    );
  }
});

test('in-house work is not presented as a third party', () => {
  const inHouse = SUBPROCESSORS.filter((s) => !s.publicListed);
  assert.ok(inHouse.length > 0, 'the in-house entry vanished from the record');
  for (const s of inHouse) {
    assert.ok(
      /in-house|no third party/i.test(s.role) || /in-house/i.test(s.name),
      `"${s.name}" is hidden from the public list but does not say it is ours. ` +
        `Hiding a genuine third party is under-disclosure.`,
    );
  }
});

test('the record still tells the truth about signed agreements', () => {
  // Every entry is `dpa_on_file: false` today. If someone flips one to true it
  // must be because an agreement was signed — not to make a dashboard look
  // finished. This pins the honest state so the change is deliberate.
  const signed = SUBPROCESSORS.filter((s) => s.dpa_on_file);
  assert.equal(
    signed.length,
    0,
    `${signed.map((s) => s.name).join(', ')} now claims a signed data agreement. ` +
      `As of 2026-08-06 there were none. Only flip this when one is actually on file.`,
  );
});
