/**
 * What a queue may and may not settle from the fast list.
 *
 * Three more queues gain a drawer here — corrections, subscriptions and payout
 * destinations — taking settle-in-place from 7 of 19 to 10. These are the rules
 * that made them safe, and each is pinned because each was a real choice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const peek = code(read('lib/admin/queue-peek.ts'));
const actions = code(read('app/admin/work/actions.ts'));

test('an irreversible control is never reachable from the fast list', () => {
  // `removePaymentMethod` deletes where a supplier gets paid. It belongs on the
  // page with its confirmation, not on a list built for speed.
  assert.ok(
    !/removePaymentMethod/.test(actions),
    'the work list can now REMOVE a payout destination — that is irreversible and ' +
      'belongs on its own page with a confirmation, never in a speed drawer',
  );
  // The offered choices are exactly the two safe ones.
  assert.match(peek, /options: \['approve', 'hold'\]/);
});

test('every settle refuses an unknown answer instead of defaulting', () => {
  // 🔑 A default here silently picks a side of somebody's decision. Each wrapper
  // must throw on anything it does not recognise.
  for (const [fn, a, b] of [
    ['settleCorrectionFromWorkList', 'apply', 'decline'],
    ['settleSubscriptionFromWorkList', 'approve', 'reject'],
    ['settlePaymentOptionFromWorkList', 'approve', 'hold'],
  ] as const) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}`));
    const end = body.indexOf('\n}');
    const src = body.slice(0, end);
    assert.ok(src.length > 0, `${fn} is missing`);
    assert.match(src, new RegExp(`decision !== '${a}' && decision !== '${b}'`),
      `${fn} does not refuse an unrecognised decision`);
    assert.match(src, /throw new Error\('Choose /, `${fn} must throw, not default`);
  }
});

test('only a redirect is swallowed — a refusal still travels', () => {
  /* ⚠ THIS ASSERTION WAS DECORATION ON ITS FIRST WRITING. It sliced from the
     helper to END OF FILE and matched `throw e;` anywhere in the remainder —
     so deleting the digest check from the helper left another function's
     `throw e;` satisfying it, and a well-formed sabotage reported GREEN.
     Scoped to the helper's OWN body now, and it asserts the guard LINE, not
     the two words. */
  const start = actions.indexOf('async function settleViaRedirectingAction');
  assert.notEqual(start, -1, 'the shared redirect helper is gone');
  const body = actions.slice(start, actions.indexOf('\n}', start));
  // The rethrow and its condition are ONE line — matching them together is what
  // makes deleting the condition fail.
  assert.match(
    body,
    /!digest\.startsWith\('NEXT_REDIRECT'\)\)\s*throw e;/,
    'the helper no longer rethrows non-redirect errors — a refusal would read as success',
  );
});

test('money with nothing to check it against gets no form', () => {
  // The same rule the payments queue lives by: approving a plan activates it,
  // so a purchase with no reference offers a sentence, never a control.
  assert.match(peek, /const hasProof = row\.reference_code != null/);
  assert.match(peek, /form: hasProof\s*\?/);
  assert.match(peek, /No payment reference yet/);
});

test('partnerships is deliberately NOT settleable from the list', () => {
  // Its own queue definition: these rows wait on the RECIPIENT VENDOR, and the
  // only admin control is a veto. A lone Reject button on a fast list is the
  // wrong affordance — there is nothing here to approve.
  assert.ok(
    !/'vendor-partnerships'/.test(peek.slice(peek.indexOf('const PEEK_QUEUES'), peek.indexOf('] as const;'))),
    'partnerships joined the peek queues — it has no approve action, only a veto',
  );
});
