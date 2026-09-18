import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * The property: no surface tells anyone that accepting a quote puts it in the
 * couple's plan.
 *
 * Owner, 2026-09-18: *"Plan should only fill at lock. not when accepted.
 * accepting it allows the user to test different builds properly"* — different
 * combinations of suppliers, compared before any of them is committed.
 *
 * The SHIPPED BEHAVIOUR already agreed with him: `respond_vendor_proposal`
 * upserts `event_vendors` at status `shortlisted`, and a guard from 2026-09-10
 * records that accepting "does not book anything". Measured on the platform's
 * first real quote — accepted 06:46, `event_vendor_line_items` **0**.
 *
 * 🔑 ONE SENTENCE DISAGREED, and it was the one suppliers read while writing
 * the quote: *"accepting just adds it to their plan."* Nothing was broken
 * except what we said about it — and a supplier who believes it tells the
 * couple their booking is in the plan when it is not.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

test('no copy says that accepting a quote fills the plan', () => {
  // ⚖ NARROW ON PURPOSE. "adds it to your plan" is TRUE of other things — the
  // onboarding step says exactly that about Setnayan AI, correctly. What is
  // false is the conjunction: ACCEPTING (a quote) + the PLAN filling.
  const near = [
    /accept\w*[^.!?]{0,70}?adds? it to (their|your) plan/i,
    /accept\w*[^.!?]{0,70}?(in|into) (their|your) (plan|budget)/i,
    /adds? it to (their|your) plan[^.!?]{0,70}?accept/i,
  ];
  const offenders: string[] = [];
  for (const file of sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')))) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const re of near) {
      const m = re.exec(code);
      if (m) offenders.push(`${relative(WEB, file)} — "${m[0].replace(/\s+/g, ' ').slice(0, 90)}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Accepting shortlists a supplier at a price; the plan fills at Lock. Say ' +
      'that, or a supplier will tell a couple their quote is committed when it ' +
      'is not:\n  ' + offenders.join('\n  '),
  );
});

test('the floor — the rule that makes this narrow rather than a phrasing ban', () => {
  const near = [
    /accept\w*[^.!?]{0,70}?adds? it to (their|your) plan/i,
    /accept\w*[^.!?]{0,70}?(in|into) (their|your) (plan|budget)/i,
  ];
  // TRUE sentences that must keep passing. A rule that convicts these is worse
  // than no rule — it teaches people to work around the guard.
  for (const ok of [
    'Added to your plan',
    'Add Setnayan AI to my wedding',
    'accepting shortlists you at this price so they can compare combinations',
    'their plan fills only when they Lock',
  ]) {
    for (const re of near) {
      assert.equal(re.test(ok), false, `convicted a true sentence: "${ok}"`);
    }
  }
  // And it must actually catch the sentence that shipped.
  const shipped = 'The couple reviews + accepts it — accepting just adds it to their plan, never a payment.';
  assert.ok(near.some((re) => re.test(shipped)), 'the guard would have let the original ship');
});

test('the builder now states the rule the product actually follows', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app/_components/proposal-maker.tsx'), 'utf8'),
  );
  assert.match(src, /shortlists you at this price/i, 'the quote builder stopped saying what accept does');
  assert.match(src, /fills only when they Lock/i, 'it no longer names Lock as the moment the plan fills');
});
