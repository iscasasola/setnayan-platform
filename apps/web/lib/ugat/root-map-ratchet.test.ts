/**
 * root-map-ratchet.test.ts — the ratchet (Root map part 2, slice 6).
 *
 * A finding in the baseline passes; a NEW one is reported as fresh (CI fails
 * on it for an enforced check); a baselined one that is gone is "fixed"
 * (passes, asks to be dropped). The baseline line carries its reason and the
 * reason never changes the key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BASELINE_DIR, parseBaseline, ratchet, writeBaselineText } from './root-map-findings';
import { CHECKS, type Finding } from './root-map-checks';

const f = (check: Finding['check'], key: string): Finding => ({ check, key, screens: ['/x'], file: 'app/x/page.tsx', plain: key });

test('a baseline line is `key<TAB># reason`, and the key survives a "#" inside it', () => {
  const text = writeBaselineText('dropped-field', [f('dropped-field', 'app/x/actions.ts#save drops tour')]);
  assert.match(text, /^app\/x\/actions\.ts#save drops tour\t# first run 2026-10-02 · /m);
  assert.deepEqual([...parseBaseline(text)], ['app/x/actions.ts#save drops tour']);
});

test('new is fresh, baselined passes, gone is fixed', () => {
  const root = mkdtempSync(join(tmpdir(), 'ugat-ratchet-'));
  mkdirSync(join(root, BASELINE_DIR), { recursive: true });
  writeFileSync(
    join(root, BASELINE_DIR, 'typed-number.baseline.txt'),
    writeBaselineText('typed-number', [f('typed-number', 'a "190 days to go"'), f('typed-number', 'b "52%"')]),
  );
  const r = ratchet(root, [f('typed-number', 'a "190 days to go"'), f('typed-number', 'c "128 guests"')]).find((x) => x.check === 'typed-number')!;
  assert.deepEqual(r.fresh.map((x) => x.key), ['c "128 guests"']);
  assert.deepEqual(r.fixed, ['b "52%"']);
  assert.equal(CHECKS['typed-number'].enforced, true, 'a new typed number fails CI');
});

test('the six kinds the owner named fail CI; the judgement checks warn', () => {
  const enforced = Object.entries(CHECKS).filter(([, c]) => c.enforced).map(([k]) => k).sort();
  assert.deepEqual(enforced, ['broken-door', 'duplicate', 'dropped-field', 'missing-section', 'no-door', 'one-home', 'outside-home', 'typed-number'].sort());
});
