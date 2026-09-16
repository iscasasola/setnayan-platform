/**
 * A LIMIT IS NOT A RESERVATION — and the allotment screen must not say it is.
 *
 * ── THE DEFECT, MEASURED 2026-09-16 ─────────────────────────────────────────
 * `papic_guest_spend_ceilings.ceiling_points` is a CEILING: the most one guest
 * may take. `papic_record_guest_capture` reads it, compares it against THAT
 * GUEST'S OWN spend, and refuses her above it. That is the whole mechanism.
 *
 * `papic_event_pool_status` — the function every capture path asks how much is
 * left — subtracts `papic_seat_allocations` from the shared pot and NOTHING
 * ELSE. It has never read `papic_guest_spend_ceilings`. So a named guest's
 * number holds nothing back for her: every credit comes out of the one pot,
 * first come first served.
 *
 * The screen said the opposite, four times over:
 *   · "Each guest has their own number of credits."
 *   · "Whatever a named guest does not use stays theirs."
 *   · "Credits you gave a named guest stay hers."
 *   · "everyone who comes gets at least one photograph."
 *
 * Two named guests at 500 each on a pot of 600 is not an error state the couple
 * is warned about — the sheet's own over-commit line only fires when the
 * numbers exceed the POT, and 500 + 500 against 600 does fire, but 300 + 300
 * does not, and the second guest to pick up a phone can still find nothing.
 *
 * 🔑 THE TELL WAS ALREADY IN THE TREE. "Open the rest to everyone"
 * (`papic_guest_spend_ceiling_released_at`) only means something if something
 * was being held back. The control for releasing a reservation shipped; the
 * reservation did not. Same shape as every other entry in this codebase's
 * ledger: a mechanism fully present, cancelling itself, rendering as nothing
 * happened.
 *
 * ── WHAT THIS FILE PINS, AND WHY IT IS TWO-SIDED ────────────────────────────
 * The prohibition is KEYED TO THE MECHANISM, not written down as a permanent
 * rule. `papic_event_pool_status` is read from the migrations, and:
 *
 *   • while it does NOT withhold for `papic_guest_spend_ceilings`, the screen
 *     may not use reservation language;
 *   • the moment somebody DOES build the withholding, the last test in this
 *     file goes RED and says so — because then the copy is true again and
 *     keeping the weaker wording forever would be its own quiet lie.
 *
 * That is the difference between a guard and a note. A note would freeze
 * today's weaker sentence into the product.
 *
 * ⚖ RULED 2026-09-16. Asked whether the couple's numbers should reserve, the
 * owner answered in one word: "ceiling." The number is THE MOST a guest may
 * take. No reservation is to be built, and his earlier phrasing — "assign
 * minimum shots per guest" — is superseded; he meant a cap.
 *
 * So the sentences below are not a holding position until somebody decides.
 * They are the product as ruled.
 *
 * 🔑 AND THE LAST TEST IN THIS FILE CHANGED MEANING WITH THAT RULING. It used
 * to mean "the owner has decided — come back and fix the copy." It now means
 * a ruling is being contradicted in code. Whoever makes the pool withhold is
 * UNDOING a decision, not completing one, and needs a new ruling rather than a
 * copy edit.
 *
 * ⚠ THE DURABLE LESSON IS NOT THE ANSWER. It is that three screens had already
 * answered — the couple's sheet, the console's confirmations, and the guest's
 * own phone at the moment she was refused — while the owner had never been
 * asked. A screen that answers an unruled question is not a placeholder; it is
 * the product making the decision.
 *
 * ── STRIPPED FIRST ──────────────────────────────────────────────────────────
 * Comments come off with the repo's one string-aware stripper before any match,
 * because this docblock quotes every banned sentence verbatim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SCREEN = join(
  HERE,
  '..',
  'app',
  'dashboard',
  '[eventId]',
  'studio',
  'papic',
  '_components',
  'guest-allotments-choice.tsx',
);
const SUMMARY = join(HERE, 'papic-guest-allotments.ts');
/**
 * ⚠ THE SECOND SURFACE. The console page prints its OWN confirmations and
 * errors for the same control — two of them carried the same false promise, and
 * a guard pointed only at the component would have passed while the couple read
 * "Credits you gave a named guest stay hers" one line above it. Found by
 * grepping the banned sentences across apps/web rather than by opening the file
 * the change was in.
 */
/**
 * ⚠ AND THE THIRD SURFACE — the guest's own phone. When the couple's ceiling
 * refuses her, the camera explained it as "the number the host set aside for
 * you". Nothing is set aside. This is the surface where the sentence costs the
 * most, because she is standing at the celebration reading it, and it was the
 * last one found: two greps of the console's vocabulary did not reach it,
 * because it is written in the second person and shares no phrase with the
 * couple's screen.
 */
const GUEST_CAMERA = join(
  HERE,
  '..',
  'app',
  'papic',
  'guest',
  '_components',
  'papic-guest-capture.tsx',
);
const CONSOLE_PAGE = join(
  HERE,
  '..',
  'app',
  'dashboard',
  '[eventId]',
  'studio',
  'papic',
  'page.tsx',
);
const MIGRATIONS = join(REPO, 'supabase', 'migrations');

const screen = () => stripComments(readFileSync(SCREEN, 'utf8'));
const summary = () => stripComments(readFileSync(SUMMARY, 'utf8'));
const consolePage = () => stripComments(readFileSync(CONSOLE_PAGE, 'utf8'));
const guestCamera = () => stripComments(readFileSync(GUEST_CAMERA, 'utf8'));

/**
 * The LAST migration that defines `papic_event_pool_status` — the one that is
 * actually in force. Filename order is the apply order, which is why the whole
 * directory is sorted rather than a single file being named: pinning a filename
 * would make this guard read a superseded definition the day somebody replaces
 * the function, which is exactly the day it matters.
 */
function poolStatusDefinition(): { file: string; body: string } {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let found: { file: string; body: string } | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const at = sql.indexOf('FUNCTION public.papic_event_pool_status');
    if (at === -1) continue;
    // From the CREATE to the end of its dollar-quoted body. `$$;` closes it.
    const end = sql.indexOf('$$;', at);
    found = { file: f, body: end === -1 ? sql.slice(at) : sql.slice(at, end + 3) };
  }
  assert.ok(found, 'papic_event_pool_status must exist in supabase/migrations');
  return found;
}

/**
 * Each entry carries `sample` — the sentence as it was actually on the screen
 * before 2026-09-16 — so a pattern that rots into matching nothing fails HERE
 * rather than going quiet. That failure mode is the only one a banned-list
 * guard has.
 */
const BANNED: Array<{ why: string; pattern: RegExp; sample: string }> = [
  {
    why: 'their own number OF CREDITS reads as an allocation; the number is a limit',
    pattern: /own number of credits/i,
    sample: 'Each guest has their own number of credits.',
  },
  {
    why: 'an unused limit is not kept for her — it stays in the pot',
    pattern: /does not use stays (theirs|hers)/i,
    sample: 'Whatever a named guest does not use stays theirs.',
  },
  {
    why: 'nothing was given, so nothing can stay hers',
    pattern: /gave a named guest stay hers/i,
    sample: 'Credits you gave a named guest stay hers.',
  },
  {
    why: 'the pot can empty before she ever opens the camera',
    pattern: /gets at least one photograph/i,
    sample: 'everyone who comes gets at least one photograph',
  },
  {
    why: '"set aside" is the reservation word said to the guest herself',
    pattern: /set aside for you/i,
    sample: 'This is the number the host set aside for you — they can open up more at any time.',
  },
  {
    why: '"promised" is the reservation word; limits are not promises',
    pattern: /named guests are promised/i,
    sample: 'your named guests are promised 40 credits more than this celebration holds',
  },
];

/** True sentences that must keep passing — a guard that cries wolf gets skimmed. */
const STILL_SAYABLE = [
  'Each guest has their own LIMIT.',
  'This is the limit the host set for you — they can raise it at any time.',
  'A limit she does not use is not held for her: it stays in the pot and anybody may take it.',
  'everyone else capped at 14 credits each',
  'Lifts every limit so any guest can keep taking from the pot.',
];

test('every banned pattern still matches the sentence it was written for', () => {
  for (const b of BANNED) {
    assert.match(
      b.sample,
      b.pattern,
      `the pattern for "${b.why}" no longer matches its own sample — it has rotted into ` +
        'a guard that can never fire, which is worse than no guard',
    );
  }
});

test('no banned pattern fires on a sentence that is TRUE today', () => {
  for (const s of STILL_SAYABLE) {
    for (const b of BANNED) {
      assert.doesNotMatch(
        s,
        b.pattern,
        `"${s}" is true and must stay sayable, but the pattern for "${b.why}" refuses it`,
      );
    }
  }
});

test('the allotment screen does not promise a reservation', () => {
  const src = screen();
  for (const b of BANNED) {
    assert.doesNotMatch(src, b.pattern, `guest-allotments-choice.tsx: ${b.why}`);
  }
});

test('the summary line does not promise a reservation either', () => {
  const src = summary();
  for (const b of BANNED) {
    assert.doesNotMatch(src, b.pattern, `papic-guest-allotments.ts: ${b.why}`);
  }
});

test('the console page\'s own confirmations do not promise a reservation either', () => {
  const src = consolePage();
  for (const b of BANNED) {
    assert.doesNotMatch(src, b.pattern, `studio/papic/page.tsx: ${b.why}`);
  }
});

test('the GUEST\'S OWN CAMERA does not tell her credits were set aside for her', () => {
  const src = guestCamera();
  for (const b of BANNED) {
    assert.doesNotMatch(src, b.pattern, `papic-guest-capture.tsx: ${b.why}`);
  }
});

test('the screen still says, in so many words, that credits come from one pot', () => {
  // 🔑 The only assertion here that PINS something. Every test above asserts an
  // absence, and an absence is also satisfied by a blank page — deleting the
  // explanation entirely would pass all four of them. This one fails if the
  // correction is tidied away.
  const src = screen();
  assert.match(
    src,
    /it does not hold credits back for her/i,
    'the screen must keep saying that a limit holds nothing back — deleting the sentence ' +
      'passes every banned-pattern test above and leaves the couple with no explanation at all',
  );
});

test('⚖ THE KEY: if the pool ever WITHHOLDS for named guests, come back and say so', () => {
  const { file, body } = poolStatusDefinition();
  assert.ok(
    !body.includes('papic_guest_spend_ceilings'),
    `papic_event_pool_status (${file}) now reads papic_guest_spend_ceilings, which means a ` +
      "named guest's credits are being held back for her. ⚖ THAT CONTRADICTS AN OWNER RULING: " +
      'asked on 2026-09-16 whether a per-guest number should reserve, he answered "ceiling" — ' +
      'the number is the most she may take, and no reservation was to be built. This is not a ' +
      'test that has gone stale. Take a new ruling before you change this, then rewrite this ' +
      'file to pin whatever he says. Do not silence it; it fired exactly when it was supposed to.',
  );
});
