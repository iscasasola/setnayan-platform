/**
 * one-matcher-two-surfaces.test.ts — the dropdown and the Enter-results match
 * with the SAME function, and neither grows its own copy again.
 *
 * ─── 🔴 WHAT HAPPENED ────────────────────────────────────────────────────
 * Both filtered the same index with their own copy of the rule, and the copies
 * were not the same: the palette matched `label + sublabel + KIND_LABEL`, the
 * results page matched `label + sublabel`. So typing "event" listed rows in
 * the dropdown that vanished on Enter — measured live on www.setnayan.com
 * 2026-09-23, `?q=event` → 21 results, ZERO of the searcher's own.
 *
 * Directly above the results page's copy sat a comment claiming they were
 * "filtered exactly as the palette filters them — the same fields, the same
 * lowercase includes — so pressing Enter can never show fewer of your own
 * things than the dropdown you pressed Enter from." That sentence described an
 * intention the code beside it did not implement, and each half passed its own
 * tests, so nothing could notice.
 *
 * 🔑 TWO MECHANISMS THAT DISAGREE ABOUT ONE FACT ARE EACH GREEN. The only
 * fix that stays fixed is one function — and a guard that fails when a second
 * one appears, because "we'll remember" is what failed the first time.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..', '..', '..');
const SURFACES: Array<[name: string, path: string]> = [
  ['the palette dropdown', join(ROOT, 'app/dashboard/(launcher)/_components/home-command-bar.tsx')],
  ['the results page', join(ROOT, 'app/_components/frontdoor/front-door-results.tsx')],
];

/**
 * ⚠ COMMENTS STRIPPED, AND THIS GUARD WOULD CONVICT ITSELF WITHOUT IT. Both
 * files now carry a comment QUOTING the old inline haystack in order to
 * explain why it is gone — so an unstripped scan would find the banned pattern
 * in the very paragraph recording its removal.
 *
 * 🔑 THE REPO'S ONE STRIPPER, NOT A HAND-ROLLED PAIR OF `.replace()` CALLS.
 * The obvious two-liner strips BLOCK comments first, so a `//` line containing
 * a block opener — `content-type video/*`, which this codebase writes
 * constantly — opens a comment that never existed and swallows everything to
 * the next real close. That is silent in the direction that matters here:
 * every assertion below is a NEGATIVE (`!BANNED.test(code)`), so an
 * over-eager strip makes them pass against a blank. `lint-one-comment-
 * stripper.mjs` blocks a second implementation for exactly this reason, and it
 * caught this file.
 */
const strip = stripComments;

test('the fixtures are real, and stripping actually removed the prose', () => {
  for (const [name, path] of SURFACES) {
    const raw = readFileSync(path, 'utf8');
    assert.ok(raw.length > 2000, `${name} did not load`);
    const code = strip(raw);
    assert.ok(code.includes('matchesCommandQuery'), `comment stripping ate ${name}'s code`);
    // The old haystack is quoted in each file's explanatory comment. If it
    // survives stripping, every assertion below is unsound.
    assert.ok(
      raw.includes('KIND_LABEL') || raw.includes('kind_label'),
      `${name} lost the explanation of what changed`,
    );
  }
});

test('🔴 both surfaces call the ONE matcher', () => {
  for (const [name, path] of SURFACES) {
    const code = strip(readFileSync(path, 'utf8'));
    assert.match(
      code,
      /matchesCommandQuery\(/,
      `${name} stopped calling the shared matcher`,
    );
    assert.match(
      code,
      /from '@\/lib\/command-match'/,
      `${name} does not import from lib/command-match`,
    );
  }
});

test('🔒 neither surface builds its own haystack', () => {
  // The exact shape both copies had: template-joining the display fields and
  // testing the result. If this fires, a second matcher is being born — fix it
  // in `lib/command-match.ts` instead, where both callers get it.
  const BANNED = /\$\{\s*\w+\.label\s*\}[^`]*\$\{\s*\w+\.sublabel\s*\}/;
  for (const [name, path] of SURFACES) {
    const code = strip(readFileSync(path, 'utf8'));
    assert.ok(
      !BANNED.test(code),
      `${name} is assembling label+sublabel itself again — that is how Enter and the dropdown drifted`,
    );
    assert.ok(
      !/\.toLowerCase\(\)\s*\.includes\(/.test(code),
      `${name} is running its own lowercase-includes match`,
    );
  }
});

test('🔑 the palette scopes BEFORE it matches', () => {
  const code = strip(
    readFileSync(join(ROOT, 'app/dashboard/(launcher)/_components/home-command-bar.tsx'), 'utf8'),
  );
  assert.match(code, /itemInScope\(/, 'the dropdown stopped honouring the scope');
  const scopeAt = code.indexOf('itemInScope(');
  const matchAt = code.indexOf('matchesCommandQuery(');
  assert.ok(
    scopeAt !== -1 && matchAt !== -1 && scopeAt < matchAt,
    'matching runs before scoping — which rows EXIST must be settled first',
  );
});
