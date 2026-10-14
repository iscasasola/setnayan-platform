/**
 * COUPLES ARE NOT TOLD ABOUT THE BOOKING FEE (owner 2026-10-12, DECISION_LOG,
 * answer 4: "Couples are NOT told that a supplier they added themselves skips
 * the booking fee (the fee is between Setnayan and the supplier)").
 *
 * The approved 2026-10-10 prototype's leak card said "…and the supplier skips
 * the booking fee"; the ruling two days later takes that sentence off every
 * couple's screen. This scans what the couple's "Add your own" screens SAY —
 * the string literals and JSX text of each file, comments stripped — for the
 * words a fee sentence needs. Identifiers (`stampManualLeakMatch`,
 * `fee_leak_price_tolerance` inside a server call) are not words on a screen and
 * are not scanned: only quoted strings and text between tags are.
 *
 * Sabotage (run 2026-10-12): adding "and the supplier skips the booking fee" to
 * the walk's leak line turns this red; restoring it turns it green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every file whose words a couple reads while adding or keeping their own supplier. */
const COUPLE_SCREENS = [
  'app/dashboard/[eventId]/_components/add-your-own-walk.tsx',
  'app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx',
  'app/dashboard/[eventId]/_components/supplier-connect-panel.tsx',
  'app/dashboard/[eventId]/_components/connect-supplier-modal.tsx',
  'lib/add-your-own.ts',
  'lib/supplier-invite-status.ts',
];

const FEE_WORDS = /\b(booking fee|fee|fees|sourced|commission|billable|credited|attribut\w*)\b/i;

/** The words a file can put on a screen: its string literals and its JSX text. */
function sayings(src: string): string[] {
  const out: string[] = [];
  const code = stripComments(src);
  // '…' "…" `…` (no nesting needed for a scan of words)
  for (const m of code.matchAll(/'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`/g)) out.push(m[0]);
  // text between a tag's end and the next tag
  for (const m of code.matchAll(/>([^<>]*[A-Za-z][^<>]*)</g)) out.push(m[1]!);
  return out;
}

test('the scan reaches every couple screen and reads its words', () => {
  for (const rel of COUPLE_SCREENS) {
    const said = sayings(readFileSync(join(ROOT, rel), 'utf8'));
    assert.ok(said.length >= 5, `${rel}: only ${said.length} sayings found — the scan did not reach it`);
  }
  // Anchors: a sentence each of these files is known to say.
  const walk = sayings(readFileSync(join(ROOT, COUPLE_SCREENS[0]!), 'utf8')).join('\n');
  assert.match(walk, /who already sent you a quote/, 'the leak line moved — re-point this guard');
});

test('no couple screen of "Add your own" says anything about a fee', () => {
  const offenders: string[] = [];
  for (const rel of COUPLE_SCREENS) {
    for (const s of sayings(readFileSync(join(ROOT, rel), 'utf8'))) {
      // A class list or an import path is not a sentence.
      if (/^['"`][@./]|className|^['"`][a-z0-9-]+(\s[a-z0-9:/[\]().%-]+)*['"`]$/.test(s)) continue;
      if (FEE_WORDS.test(s)) offenders.push(`${rel}: ${s.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(offenders, [], 'a couple screen speaks of the fee (owner 2026-10-12: couples are not told)');
});
