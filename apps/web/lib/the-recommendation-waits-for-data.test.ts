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
      const src = readFileSync(f, 'utf8');
      // A mention inside a comment is the record of the removal, not a use.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
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
    const code = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
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
  assert.match(page, /<HostPoolMeterCard\b/, 'the live credit balance is gone from the Papic page');
  assert.match(page, /<PapicPoolCard\b/, 'the pool card is gone from the Papic page');
});
