/**
 * "MAKE IT YOURS" KEEPS WHAT THE BROWSER FOUND (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 4).
 *
 * Each rule below was found by DRIVING the editor in a real browser — the prototype's rounds 1
 * and 3 (`10a_MAKE_IT_YOURS_TEST_PLAN_2026-09-10.md`) and this port's own Playwright drive at 1280
 * mouse and 390 touch — and none of them can be seen by reading a diff. The drive proves the
 * behaviour; it needs a browser, so it is not in CI.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ────────────────────────────────────────────────────────────
 * That the LINE each behaviour depends on is still in the shipped source — so a tidy-up that
 * deletes one fails here instead of in front of a host. It does not re-prove the behaviour; the
 * pure moves have their own tests (`lib/make-it-yours.test.ts`). Source is read through the repo's
 * one comment stripper, so a rule that survives only as a comment describing it is MISSING.
 *
 * Sabotage-checked: each rule was removed on its own and this file failed naming it; restored,
 * it passes. The count is printed on every run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const tsx = stripComments(readFileSync(join(HERE, '_components', 'make-it-yours.tsx'), 'utf8'));
const css = stripComments(readFileSync(join(HERE, '_components', 'make-it-yours.module.css'), 'utf8'));

const RULES: Array<{ rule: string; holds: boolean }> = [
  {
    // prompt/confirm return nothing in a frame that forbids them; five buttons silently did nothing.
    rule: 'no browser pop-up anywhere (no prompt, confirm or alert)',
    holds: !/\b(?:window\.)?(?:prompt|confirm|alert)\s*\(/.test(tsx),
  },
  {
    // A disabled button swallows the press, so it can never say why it refused.
    rule: 'aria-disabled, never a plain `disabled`',
    holds: !/(?<![\w-])disabled\s*[={]/.test(tsx) && /aria-disabled=\{/.test(tsx),
  },
  {
    // Spread over a neighbour, an invisible tap area on the × took off the wrong photo (round 3).
    rule: 'the × has no invisible halo',
    holds: !/\.x\b[^{]*::(?:after|before)/.test(css),
  },
  {
    // The owner could not find the × on a photo, and a hover-only × vanished on the way to it.
    rule: 'the × on a photo is always showing, and counter-scaled',
    holds: /\.x\s*\{[^}]*display:\s*grid[^}]*transform:\s*scale\(var\(--inv/.test(css),
  },
  {
    // Found by this port's drive at 390: an older save said "Saved" while a drag still waited.
    rule: '"Saved" only when no newer change is waiting',
    holds: /if \(saveTimer\.current\) return;\s*setSaveState\('saved'\)/.test(tsx),
  },
  {
    // An unreadable pool looks exactly like a day with no photos; saving it empties every page.
    rule: 'nothing is saved while a source was unreadable, or after another tab won',
    holds: /const flush = useCallback\(async \(\) => \{[\s\S]{0,200}if \(unreadable \|\| conflictRef\.current\) return;/.test(tsx),
  },
  {
    // A tap whose finger drifts 3px is still a tap (10a DW-08).
    rule: 'a drag starts past 4px, or 10px for a finger',
    holds: /e\.pointerType === 'touch' \? 10 : 4/.test(tsx),
  },
  {
    // A held Delete removed every photo on the page (10a F3); a held Enter added a row (r3 R1).
    rule: 'a held key acts once',
    holds:
      /if \(e\.repeat\) return;/.test(tsx) &&
      /e\.repeat && \(e\.key === 'Enter' \|\| e\.key === ' '\)/.test(tsx),
  },
  {
    // A double tap added the NEXT photo, which slides under the finger (10a G1).
    rule: 'a double tap on the tray adds one photo',
    holds: /if \(performance\.now\(\) < trayQuietUntil\.current\) return;/.test(tsx),
  },
  {
    // The whole editor saves through step 3's one action, never a write of its own.
    rule: 'it saves through step 3’s action and saves what it shows',
    holds: /from '\.\.\/arrangement-actions'/.test(tsx) && /storedFromResolved\(stateRef\.current\)/.test(tsx),
  },
];

test('Make it yours keeps every rule a real browser found', () => {
  const missing = RULES.filter((r) => !r.holds).map((r) => r.rule);
  console.log(`# [make-it-yours] rules: ${RULES.length}, missing: ${missing.length}`);
  assert.deepEqual(missing, [], `missing from make-it-yours: ${missing.join(' · ')}`);
});
