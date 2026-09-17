import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAPIC_FREE_CREDIT_CONDITION } from './papic-free-credit-promise';
import { stripComments } from './strip-comments';

/**
 * The property: no surface anywhere may say the free CREDIT POOL comes with
 * every event. It is claimed once per ACCOUNT — a repeat celebration gets a
 * 1-credit floor, which is a fence, not a perk.
 *
 * 🔑 WHY THIS FILE EXISTS RATHER THAN A WIDER SCOPE ON THE OLD ONE.
 * `the-free-credit-promise-is-true.test.ts` already asserts exactly the right
 * thing — *"the page may not say every"* — and it was green while three live
 * strings said it, because its surface list is four `/papic` page files:
 *
 *     lib/help.ts:479      "Every wedding starts with 50 credits free"
 *     lib/help.ts:484      "every wedding starts with a free pool of credits"
 *     lib/llms-txt.ts:498  "50 credits free on every event"
 *     lib/llms-txt.ts:533  "50 free on every event"
 *
 * A correct guard facing the wrong files. So this one sweeps the TREE.
 *
 * ⚠ AND IT IS DELIBERATELY NARROW, because the obvious wide version convicts
 * eight innocent lines. These are all TRUE and must keep passing:
 *   • one free CAMERA every event (owner-locked 2026-07-29)
 *   • Kwento free for every event · Live Wall free for every event
 *   • free cameras per event, from config
 * "Free on every event" is not the falsehood. **A free CREDIT POOL on every
 * event** is. The subject is what makes it false, so the subject is what this
 * matches on.
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

/** The recurrence words a claim can use. */
const EVERY = String.raw`\b(?:every|each|all)\s+(?:event|events|wedding|weddings|celebration|celebrations)\b`;
/** The SUBJECT that makes recurrence false: the pool of credits, or a count of them. */
const POOL = String.raw`(?:\d+\s*(?:credits?|shots?|free)|(?:free\s+)?(?:pool|pot)\s+of\s+credits|credits?\s+free|free\s+credits?)`;

test('no live copy says the free credit POOL comes with every event', () => {
  const offenders: string[] = [];
  const near = [
    new RegExp(`${POOL}[^.!?]{0,60}?${EVERY}`, 'i'),
    new RegExp(`${EVERY}[^.!?]{0,60}?${POOL}`, 'i'),
  ];
  for (const file of sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')))) {
    // Comments are not copy — but a stale one misleads the next session, so
    // they are corrected by hand, not policed here. Strip, then look.
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const re of near) {
      const m = re.exec(code);
      if (m) offenders.push(`${relative(WEB, file)} — "${m[0].replace(/\s+/g, ' ').slice(0, 90)}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `The free pool is claimed ONCE PER ACCOUNT. A repeat celebration gets 1 ` +
      `credit. Say "${PAPIC_FREE_CREDIT_CONDITION}":\n  ` + offenders.join('\n  '),
  );
});

test('the floor that keeps this guard honest — true "every event" copy still passes', () => {
  // A phrasing ban fails in BOTH directions: it misses a reword and convicts
  // innocent code. These are real sentences from the tree and each is TRUE.
  const innocent = [
    "every wedding gets one free camera of its own",
    "Kwento is FREE for every event",
    "Live Wall became free for every event",
    "How many free cameras every event gets",
    "Cameras are free and unlimited",
  ];
  const near = [
    new RegExp(`${POOL}[^.!?]{0,60}?${EVERY}`, 'i'),
    new RegExp(`${EVERY}[^.!?]{0,60}?${POOL}`, 'i'),
  ];
  for (const s of innocent) {
    for (const re of near) {
      assert.equal(re.test(s), false, `convicted a true sentence: "${s}"`);
    }
  }
});

test('the guard actually fires on each of the four strings it was written for', () => {
  // A zero from a harness is not evidence. These are the exact strings that
  // shipped, and every one of them must be caught.
  const shipped = [
    'Every wedding starts with 50 credits free, so you can try it',
    'every wedding starts with a free pool of credits plus one free camera',
    '50 credits free on every event, then the ladder',
    '50 free on every event',
  ];
  const near = [
    new RegExp(`${POOL}[^.!?]{0,60}?${EVERY}`, 'i'),
    new RegExp(`${EVERY}[^.!?]{0,60}?${POOL}`, 'i'),
  ];
  for (const s of shipped) {
    assert.ok(
      near.some((re) => re.test(s)),
      `the guard would have let this ship: "${s}"`,
    );
  }
});

test('the honest condition is the one the corrected copy uses', () => {
  assert.equal(PAPIC_FREE_CREDIT_CONDITION, 'on your first celebration');
  for (const rel of ['lib/help.ts', 'lib/llms-txt.ts']) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    assert.match(
      src,
      /first celebration/,
      `${rel} no longer names the condition at all — silence is not honesty here, ` +
        `the reader still has to know the pool comes once`,
    );
  }
});
