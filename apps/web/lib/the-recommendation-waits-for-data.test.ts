/**
 * GUARD — NOTHING TELLS A COUPLE HOW MANY CREDITS TO BUY UNTIL WE HAVE MEASURED
 * WHAT EVENTS ACTUALLY USE.
 *
 * ⚖ Owner, 2026-09-23: *"we will also collect data of how much photo is used
 * for an event and that will indicate what credits is ideal for that event and
 * that is the recommendation. until a data is collected, nothing to
 * recommend."*
 *
 * This is the SECOND time. On 2026-08-31 he rejected a shipped
 * `DEFAULT_CAPTURE_MIX` in one word — *"don't guess"* — and the decision log
 * records that it had been labelled a guess in the code, the changelog AND the
 * PR body, and shipping it was still wrong. **A number that sizes money is not
 * improved by being annotated.**
 *
 * ── 🔑 WHY THIS ASSERTS A PROPERTY AND NOT A WORD ─────────────────────────
 * The first inventory of what to remove was built by grepping `recommend`. It
 * was wrong in BOTH directions: it caught a "Recommended" badge on CHALLENGES
 * (nothing to do with credits) and it MISSED the worst surface, because
 * `event-dashboard.tsx` never says the word. What it did instead was:
 *
 *     href: `${base}/studio/papic?topup=${papicVerdict.shortfall}`
 *
 * A number nobody measured, pre-selecting how much money a couple was about to
 * spend. **A phrasing ban would not have seen it.** So this guard names the
 * MECHANISMS — the modules that turn a guest count into a credit figure — and
 * the checkout pre-fill, not the vocabulary.
 *
 * ── WHAT IS DELIBERATELY STILL ALLOWED ────────────────────────────────────
 *   • The BALANCE. `HostPoolMeterCard` / `PapicPoolCard` say what an event
 *     holds and has spent. Those are facts and they stay.
 *   • The ADMIN editor. `papic_event_pool_config` is admin-editable and is
 *     where a number is SUPPOSED to live; the ruling is "stop showing couples a
 *     guess", not "delete the knob".
 *   • The per-guest ALLOTMENT ceiling/floor a couple sets themselves — that is
 *     their instruction, not our opinion.
 *
 * Run from apps/web:  npx tsx --test lib/the-recommendation-waits-for-data.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠ THE REPO'S ONE STRIPPER, NOT A HAND-ROLLED REGEX. A naive
// `/\/\*[\s\S]*?\*\//g` treats a LINE comment containing `/*` as opening a
// block comment, blanks everything to the next real `*/`, and the guard then
// asserts against a blank and PASSES. `lint-one-comment-stripper.mjs` exists to
// stop exactly that, and it caught this file.
import { stripComments } from './security/source-text';

const WEB = dirname(fileURLToPath(import.meta.url)).replace(/\/lib$/, '');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Every non-test source file the app ships. */
const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];

test('the sweep found the app — a zero here would make every rule below vacuous', () => {
  assert.ok(
    SOURCES.length > 500,
    `only ${SOURCES.length} source files scanned; the walk is pointed at the wrong place`,
  );
});

test('🚨 no module turns a guest count into a credit figure to quote', () => {
  // These are the mechanisms, not the words. `papic-credit-estimate.ts` was
  // deleted whole; `recommendedCredits()` was cut out of papic-pool-sizing.ts.
  assert.ok(
    !existsSync(join(WEB, 'lib/papic-credit-estimate.ts')),
    'lib/papic-credit-estimate.ts is back — it existed only to quote a figure nobody measured',
  );

  for (const symbol of ['recommendedCredits', 'papicCreditVerdict', 'estimateCreditsNeeded']) {
    const offenders = SOURCES.filter((f) => {
      // A mention inside a comment is the record of the removal, not a use.
      const code = stripComments(readFileSync(f, 'utf8'));
      return new RegExp(`\\b${symbol}\\b`).test(code);
    });
    assert.deepEqual(
      offenders.map((f) => f.slice(WEB.length + 1)),
      [],
      `${symbol} is back in shipped code — it derives a credit figure from a guest count, ` +
        'which is the thing that waits for measured usage',
    );
  }
});

test('🚨 no purchase link arrives with the quantity already chosen', () => {
  // ⚠ THE ONE A WORD-BASED GUARD MISSES. `?topup=${…}` pre-filled the top-up
  // amount from the unmeasured shortfall, so the couple reached the buy screen
  // with the figure decided for them. A literal (`?topup=1`) would be just as
  // wrong; what is allowed is no pre-filled quantity at all.
  const offenders: string[] = [];
  for (const f of SOURCES) {
    const code = stripComments(readFileSync(f, 'utf8'));
    if (/[?&]topup=/.test(code)) offenders.push(f.slice(WEB.length + 1));
  }
  assert.deepEqual(
    offenders,
    [],
    'a link carries a `topup=` quantity. Sending someone to the credits page is fine; ' +
      'deciding how many credits they should buy is what waits for data.',
  );
});

test('the balance itself is untouched — this guard must not have silenced the facts', () => {
  // A cut that also removed the meter would pass every rule above while making
  // the page worse. The event must still be able to say what it HOLDS.
  const page = readFileSync(
    join(WEB, 'app/dashboard/[eventId]/studio/papic/page.tsx'),
    'utf8',
  );
  // 🎨 One band now carries the balance, the meter and Buy more (owner 2026-10-14).
  assert.match(page, /<PapicTopBand\b/, 'the live credit balance is gone from the Papic page');
});

test('🎟 onboarding recommends NOTHING either — each pack states its own estimate (owner 2026-10-15)', () => {
  // ⚖ Owner, 2026-10-15 (DECISION_LOG "SIX OWNER ANSWERS", answer 1): the
  // onboarding Papic card's "We recommend N credits for your X guests" — the one
  // exception the 2026-10-01 ruling had carved out — is REMOVED. Each pack now
  // says what it buys ("about N photos, or N short clips") and no module may turn
  // a guest count into a credit figure to show a couple. `points_per_guest` stays,
  // as the SPENDING CEILING for paying events — that is a cap, not advice.

  // 1. The module that used to do it is gone, and so are its functions.
  assert.ok(
    !existsSync(join(WEB, 'lib/onboarding/papic-recommendation.ts')),
    'lib/onboarding/papic-recommendation.ts is back — onboarding no longer sizes a pack from the guest count',
  );
  for (const symbol of ['recommendedPackStep', 'nearestPackStep', 'targetPoolPoints', 'PapicSizing']) {
    const offenders = SOURCES.filter((f) => new RegExp(`\\b${symbol}\\b`).test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => f.slice(WEB.length + 1));
    assert.deepEqual(offenders, [], `${symbol} is back in shipped code — it picks a pack from the guest count`);
  }

  // 2. pointsPerGuest is read ONLY where it is the ceiling or its admin editor —
  //    never by the onboarding view model that feeds the card.
  const readers = SOURCES.filter((f) => /\bpointsPerGuest\b/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(WEB.length + 1));
  assert.ok(readers.length > 0, 'no pointsPerGuest reader at all — the ceiling itself is gone, or the walk is blind');
  const outside = readers.filter(
    (f) => !/papic-pool-sizing|papic-pool-learning|papic-event-pool|papic-type-sizing-editor|price-control-actions/.test(f),
  );
  assert.deepEqual(outside, [], 'a module outside the ceiling/admin set reads pointsPerGuest — is it sizing what a couple is told to buy?');

  // 3. The card takes no guest count at all, and every pack states its estimate.
  const step = stripComments(readFileSync(join(WEB, 'app/onboarding/_shared/services-step.tsx'), 'utf8'));
  assert.ok(!/\bguests\b/.test(step), 'the onboarding Papic card takes a guest count again');
  const estimates = step.match(/papicPackEstimatePhrase\(/g)?.length ?? 0;
  assert.ok(estimates >= 3, `only ${estimates} estimate call(s) — the pack picker, the running stepper and the ladder each state one`);
  assert.match(step, /Add Papic/, 'the card must still need an explicit "Add Papic"');
  const data = stripComments(readFileSync(join(WEB, 'lib/onboarding/services-step-server.ts'), 'utf8'));
  assert.ok(!/fetchEventPoolSizing/.test(data), 'the onboarding view reads the per-guest sizing again');

  // 4. The estimate's numbers are the capture-path weights, never typed.
  const copy = stripComments(readFileSync(join(WEB, 'lib/papic-tier-copy.ts'), 'utf8'));
  const body = copy.slice(copy.indexOf('export function papicPackEstimatePhrase'));
  const fn = body.slice(0, body.indexOf('\n}\n') + 2);
  assert.match(fn, /PAPIC_POINTS_PER_PHOTO/);
  assert.match(fn, /PAPIC_POINTS_PER_SNIPPET/);
  assert.match(fn, /formatCount\(photos\)[\s\S]*formatCount\(clips\)/, 'both figures go through formatCount');
  const literals = (fn.match(/(?<![\w.])\d+(?:[_.]\d+)*/g) ?? []).filter((n) => n !== '0');
  assert.deepEqual(literals, [], 'a number was typed into the pack estimate');
});
