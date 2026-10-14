/**
 * the-fee-sentence-tells-the-lock.test.ts — THE OVERDUE SENTENCE STATES THE LOCK THE GATE ENFORCES.
 *
 * Batch-5 walk F (2026-10-14, controller measured production): the overdue booking-fee sentence chose between
 * "Your booking is not affected…" and "…this event's details and day-of tools stay locked…" from the env flag
 * `NEXT_PUBLIC_FEE_UNLOCKS_EVENT` ALONE — unset in production — while the real lock is
 * `platform_settings.fee_unlocks_event_enforced = TRUE`, which the gate ORs in (`resolveFeeEnforcement`,
 * `lib/vendor-event-fee-access.server.ts`). Suppliers were told "not affected" while their event was locked.
 *
 * WHAT THIS HOLDS
 *   1. `feeEnforcementSentence` has NO default — it cannot fall back to the env flag on its own.
 *   2. `feeDueCopy` takes `enforced` as a REQUIRED argument and hands it to the sentence.
 *   3. Every shipped caller of `feeDueCopy` (app/, not the labs) passes a value read from `resolveFeeEnforcement()`
 *      in the same file — the gate's own answer, no second source.
 *   4. `resolveFeeEnforcement` reads the platform switch (the gate), not only the env flag.
 *
 * SABOTAGE (2026-10-14): Today's page passes `false` instead of its `feeEnforced` → test 3 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · the sentence has no default — it is always handed the lock state', () => {
  const s = src('lib/event-access-stage.ts');
  const body = s.slice(s.indexOf('export function feeEnforcementSentence'), s.indexOf('\n}\n', s.indexOf('export function feeEnforcementSentence')));
  assert.ok(body.length > 50, 'feeEnforcementSentence moved — re-anchor, do not drop');
  assert.match(body, /feeEnforcementSentence\(opts: \{ enforced: boolean \}\)/, 'the lock state is optional again');
  assert.doesNotMatch(body, /isFeeUnlocksEventEnabled|process\.env/, 'the sentence reads the env flag on its own');
});

test('2 · feeDueCopy requires the lock state and hands it to the sentence', () => {
  const s = src('lib/booking-fee-disclosure.ts');
  assert.match(s, /export function feeDueCopy\(\s*bill: DueFeeBill,\s*todayPh: string,\s*enforced: boolean,\s*\): FeeDisclosure/);
  assert.match(s, /feeEnforcementSentence\(\{ enforced \}\)/);
});

test('3 · every shipped caller passes the gate’s own answer (`resolveFeeEnforcement()`)', () => {
  const files = walk(resolve(WEB, 'app'));
  assert.ok(files.length > 500, `only ${files.length} files walked`);
  const callers = files.map((f) => relative(WEB, f)).filter((rel) => /\bfeeDueCopy\(/.test(src(rel)));
  assert.ok(callers.length >= 3, `only ${callers.length} shipped callers found — the scan is blind`);
  for (const rel of callers) {
    const s = src(rel);
    const calls = [...s.matchAll(/\bfeeDueCopy\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => m[1]!);
    assert.ok(calls.length > 0, `${rel}: no feeDueCopy call parsed`);
    for (const args of calls) {
      const third = args.split(',').map((a) => a.trim())[2] ?? '';
      assert.match(third, /^[A-Za-z_]\w*$/, `${rel}: feeDueCopy(${args}) — the lock state is not a value read from the gate`);
      assert.match(
        s,
        new RegExp(`\\b${third}\\b[\\s\\S]{0,400}resolveFeeEnforcement\\(\\)|\\[[^\\]]*\\b${third}\\b[^\\]]*\\]\\s*=\\s*await Promise\\.all\\(\\[[\\s\\S]*?resolveFeeEnforcement\\(\\)`),
        `${rel}: \`${third}\` is not read from resolveFeeEnforcement() — the sentence would not tell the real lock`,
      );
    }
  }
});

test('4 · the gate’s answer includes the platform switch, not only the env flag', () => {
  const s = src('lib/vendor-event-fee-access.server.ts');
  assert.match(s, /export const resolveFeeEnforcement = cache\(async \(\): Promise<boolean> =>\s*feeEnforcementFromSources\(\{\s*envFlag: isFeeUnlocksEventEnabled\(\),\s*platformSwitch: await readFeeEnforcementSwitch\(\),/);
  assert.match(s, /\.select\('fee_unlocks_event_enforced'\)/);
});
