/**
 * A FLAG A PERSON SETS MUST ACCEPT WHAT A PERSON TYPES.
 *
 * ── 🔴 WHAT IT COST ────────────────────────────────────────────────────────
 * The owner turned the public gifts page on and redeployed. It still answered
 * **404**. Every other gate was measured and passed — the event exists, weddings
 * carry the `website` surface, and the visibility gate redirects rather than
 * 404s. The cause was one line:
 *
 *     return v === '1' || v === 'true';
 *
 * Two exact spellings, case-sensitive, untrimmed. `TRUE`, `True`, and `true `
 * with a trailing space each failed **silently**, and a flag that is off renders
 * as a feature that was never built. There is no error to find.
 *
 * 🔑 The repo already had `envFlagEnabled` — true · 1 · yes · on, trimmed and
 * case-insensitive. The gifts flag was a PRIVATE re-implementation of a shared
 * rule, and being private is exactly why it drifted stricter than the rule it
 * copied.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { envFlagEnabled } from './env-flag';

test('🔴 the spellings that silently cost a redeploy now work', () => {
  for (const spelling of ['true', 'TRUE', 'True', ' true ', '1', 'yes', 'on', 'ON']) {
    assert.equal(
      envFlagEnabled(spelling),
      true,
      `"${spelling}" does not turn a flag on — somebody setting it in a web form gets a 404 with no error`,
    );
  }
});

test('…and the values that genuinely mean OFF still mean off', () => {
  for (const spelling of ['', ' ', 'false', 'FALSE', '0', 'no', 'off', 'maybe', undefined, null]) {
    assert.equal(
      envFlagEnabled(spelling as string | undefined | null),
      false,
      `"${String(spelling)}" turned a flag ON — a public surface must not ship on a typo`,
    );
  }
});

test('🔒 the gifts flag reads the SHARED helper, not a private copy of the rule', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('./strip-comments');
  /* 🪤 WHITESPACE COLLAPSED FIRST. `stripComments` replaces a comment with
     SPACES OF THE SAME LENGTH so offsets survive — so a window measured in
     characters is mostly blank once a docblock sits inside it, and the line you
     are looking for falls off the end. This is the THIRD time today I have
     written that bug into a guard; collapsing first is the fix, and the reason
     it keeps happening is that the broken version looks correct. */
  const src = stripComments(readFileSync(join(process.cwd(), 'lib/egift.ts'), 'utf8'));
  const start = src.indexOf('isPabuyaPublicRouteEnabled');
  assert.ok(start > 0, 'the gifts flag is gone — this guard points at nothing');
  const body = src.slice(start).replace(/\s+/g, ' ').slice(0, 220);
  assert.ok(
    body.includes('envFlagEnabled('),
    'the gifts flag re-implements the rule instead of asking the shared helper — that is what made it stricter than every other flag and 404ed a page the owner had switched on',
  );
  assert.ok(
    !/===\s*['"]true['"]/.test(body),
    'the gifts flag compares the raw value again — `TRUE` and `true ` will silently fail',
  );
});
