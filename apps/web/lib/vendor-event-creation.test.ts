/**
 * vendor-event-creation.test.ts — the ruling moved; it must not evaporate.
 *
 * ─── THE RULING ────────────────────────────────────────────────────────────
 * Owner, 2026-08-15: *"supplier/vendors also has their own user account. but
 * they cannot make from their vendor account."* Asked what happens to the
 * personal side, he chose **keep both, block only creating**.
 *
 * ─── WHY THIS FILE IS DANGEROUS TO GET WRONG ───────────────────────────────
 * 🔴 THE ONLY THING ENFORCING THE RULING WAS A LAYOUT REDIRECT, AND THIS CHANGE
 * DELETES IT. That redirect bounced a shop account off the entire couple tree —
 * which took away the events they had already planned, their profile, and the
 * account-deletion request (an RA 10173 right). Removing it is the fix. But
 * removing it WITHOUT putting the block on creation would quietly repeal the
 * owner's lock and nothing would fail.
 *
 * So the two halves are asserted together, on purpose:
 *   1 · the blanket bounce is GONE from the couple tree;
 *   2 · every server entry point that creates an event asks the shared gate.
 *
 * 🔑 AND THE OLD GUARD COULD NEVER HAVE HELD THE RULE ANYWAY. Two of the four
 * creation paths commit from `/onboarding/*`, entirely outside `/dashboard`, so
 * a shop account could always have made an event through the wizard. The
 * redirect only looked like the rule because no shop account existed to try it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const GATE = 'shopAccountMayNotCreateEvents';

/** Every server entry point that inserts an event row. */
const CREATION_PATHS = [
  {
    name: 'the create-event form',
    file: join(APP, 'dashboard', '(account)', 'create-event', 'actions.ts'),
    fn: 'createWeddingEvent',
  },
  {
    name: 'plan next year',
    file: join(APP, 'dashboard', '(account)', 'create-event', 'actions.ts'),
    fn: 'planNextYearEvent',
  },
  {
    name: 'the onboarding wizard (every non-wedding type)',
    file: join(APP, 'onboarding', '_shared', 'commit-event.ts'),
    fn: 'commitOnboardingEvent',
  },
  {
    name: 'the simple-event form',
    file: join(APP, 'onboarding', 'simple', 'actions.ts'),
    fn: 'commitSimpleEvent',
  },
];

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

/** The balanced body of `export async function <name>(` . */
function fnBody(src: string, name: string): string {
  const m = new RegExp(`export async function ${name}\\s*\\(`).exec(src);
  if (!m) return '';
  const open = src.indexOf('{', m.index + m[0].length - 1);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return '';
}

test('the anchor: every file this guard reasons about exists', () => {
  for (const p of [
    join(HERE, 'vendor-event-creation.ts'),
    join(HERE, 'vendor-event-creation-copy.ts'),
    join(APP, 'dashboard', 'layout.tsx'),
    ...CREATION_PATHS.map((c) => c.file),
  ]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 200,
      `${p} is missing or a stub — every assertion below would pass vacuously.`,
    );
  }
});

/* ─── HALF 1 · THE PERSONAL SIDE IS NOT TAKEN AWAY ──────────────────────── */

test('a shop account is no longer bounced off the whole couple tree', () => {
  const src = code(join(APP, 'dashboard', 'layout.tsx'));
  /*
    Anchored on the ACT — a redirect to the shop console inside this layout —
    not on the word "vendor", which appears throughout the file's prose and in
    unrelated reads. Restoring the blanket bounce is what this must catch:
    it takes away events the person already made, with no way back.
  */
  assert.doesNotMatch(
    src,
    /redirect\(\s*['"`]\/vendor-dashboard/,
    'The couple tree redirects a shop account to the shop console again. That ' +
      'takes away the events they already planned, their profile, and the ' +
      'account-deletion request — far wider than the owner’s ruling, which is ' +
      'about CREATING only.',
  );
});

/* ─── HALF 2 · CREATING IS STILL BLOCKED, AT EVERY DOOR ─────────────────── */

for (const path of CREATION_PATHS) {
  test(`${path.name}: asks the shared gate before creating`, () => {
    const body = fnBody(code(path.file), path.fn);
    assert.ok(body.length > 0, `${path.fn} not found — did it move or get renamed?`);
    assert.match(
      body,
      new RegExp(`await ${GATE}\\(`),
      `${path.name}: does not call ${GATE}. The owner's ruling — a shop account ` +
        'cannot make events — is now enforced ONLY here, because the layout ' +
        'redirect that used to imply it has been removed. A creation path that ' +
        'skips this gate repeals the ruling silently.',
    );
  });
}

test('the gate asks BOTH halves, not just the label', () => {
  const src = code(join(HERE, 'vendor-event-creation.ts'));
  assert.match(
    src,
    /account_type/,
    'The cheap label check is gone — every customer would pay for the ' +
      'authoritative lookup on every create.',
  );
  assert.match(
    src,
    /hasVendorAccess/,
    'The gate trusts the label alone. An account whose shop was deleted keeps ' +
      'the label, so it would be refused forever with no shop to show for it — ' +
      'the same disagreement that caused the 2026-08-10 redirect loop.',
  );
});

/* ─── THE BOUNDARY THAT BROKE THE BUILD ONCE ────────────────────────────── */

test('the refusal copy carries no server boundary', () => {
  /*
    🪤 STRIPPED, AND ANCHORED ON THE IMPORT STATEMENT — NOT THE WORD. The first
    cut read the raw file and matched `/server-only/`, which this module's own
    docblock says four times while EXPLAINING why it must not carry the
    boundary. A correct file, reported broken, by a guard reading prose as code.
    Third time in one day; the rule is the same every time — match the ACT.
  */
  const copy = code(join(HERE, 'vendor-event-creation-copy.ts'));
  assert.doesNotMatch(
    copy,
    /import\s+['"]server-only['"]/,
    'The sentence must stay importable by the onboarding wizard, which is a ' +
      'client component. Putting it behind `server-only` breaks the production ' +
      'build — it did once, before this test existed.',
  );
  const wizard = code(
    join(APP, 'onboarding', '[type]', '_components', 'generic-onboarding.tsx'),
  );
  assert.doesNotMatch(
    wizard,
    /from '@\/lib\/vendor-event-creation'/,
    'The client wizard imports the SERVER module. Import the copy module instead.',
  );
});

test('the refusal says what to do instead of failing silently', () => {
  const copy = code(join(HERE, 'vendor-event-creation-copy.ts'));
  const sentence = /export const SHOP_ACCOUNT_CANNOT_CREATE_COPY\s*=\s*([\s\S]*?);/.exec(copy)?.[1] ?? '';
  assert.match(
    sentence,
    /personal account/,
    'The refusal must name the way forward. The behaviour it replaced was a ' +
      'silent flick back to the shop with no message, which is indistinguishable ' +
      'from a broken button — and nothing in the product tells a supplier that ' +
      'planning happens on a separate account.',
  );
  assert.doesNotMatch(
    sentence,
    /try again/i,
    'Never "try again" here: retrying is exactly what cannot work.',
  );
});
