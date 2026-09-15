/**
 * a-ruled-question-stops-saying-unruled.test.ts — a docblock may not describe a
 * settled decision as open.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `lib/event-hub-control.ts` said, of the named-guest preview, that rendering an
 * actual named person "remains unbuilt and unruled". **It was ruled on
 * 2026-09-14** — "Preview as a guest" shows a GENERIC guest, never a real named
 * one, on both pages (DECISION_LOG.md, the owner's Part A acceptance).
 *
 * 🔑 THE COST OF THAT WORD IS A REAL ONE, NOT TIDINESS. A session sweeping for
 * open decisions greps exactly these phrases, finds one, and puts a settled
 * question back on the owner's desk. That happened repeatedly in the week this
 * was written: rows marked open were closed, a "CONFIRMED OPEN" privacy leak had
 * been fixed three days earlier, and a badge deadline that did not exist reached
 * the owner twice. **A stale "open" is more expensive than a stale "done"** —
 * "done" gets checked because somebody wants to use the thing; "open" gets
 * ACTED ON.
 *
 * ── What this pins, and what it deliberately does not ──────────────────────
 * It does NOT ban the phrases. Plenty of questions are genuinely open and saying
 * so is the honest thing — `IDEAL_PHOTOGRAPHS_PER_GUEST` in `(shell)/papic/page.tsx`
 * says "awaiting the owner" and that is TRUE today.
 *
 * It pins the two specific claims that have already gone stale, so they cannot
 * come back without someone re-reading the ruling. A general ban would cry wolf
 * on every honest one — and this repo's own note is that a guard which cries
 * wolf teaches you to skim past the time it is right.
 *
 * 🛡 Mutation-checked: restoring "unbuilt and unruled" goes RED; deleting the
 * ruling's date goes RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HUB = readFileSync(join(HERE, 'event-hub-control.ts'), 'utf8');

test('the named-guest preview is not described as unruled — it was ruled', () => {
  assert.doesNotMatch(
    HUB,
    /unbuilt and unruled/,
    'event-hub-control.ts calls the named-guest preview "unruled". It was RULED on 2026-09-14: ' +
      '"Preview as a guest" shows a GENERIC guest, never a real named one, on both pages. ' +
      'A session sweeping for open decisions will find this word and re-ask a settled question.',
  );
});

test('and it cites the ruling, so the next reader can check it rather than trust it', () => {
  assert.match(
    HUB,
    /RULED 2026-09-14/,
    'the correction must carry the ruling DATE. A docblock that merely stops saying "unruled" ' +
      'leaves the next reader with no way to tell a decision from an omission — which is the ' +
      'same ambiguity one step quieter.',
  );
});
