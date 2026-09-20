import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every success flag a guests server action redirects with has to be REGISTERED
 * in three places, or the host is told nothing and left holding a stale bar.
 *
 * Pairing shipped registering none of them. `pairSelectedGuests` redirected
 * with `?paired=2`, and `page.tsx` had never heard of `paired`: it was absent
 * from the searchParams type, from `pickFlash` (so a finished pair produced no
 * confirmation at all), and from `recentlyApplied` (so the floating
 * SelectionBar kept showing "2 selected" for two guests it had already acted
 * on — which is what the owner reported: "after applying the selected, this
 * should already reset and be gone since the task is complete").
 *
 * 🔑 THE FLAG NAMES ARE DERIVED FROM THE ACTION, NEVER LISTED HERE. A
 * hand-typed list is a list of the flags someone remembered on the day. A
 * seventh redirect added to pair-actions.ts must arrive in this test by itself
 * or the guard is decoration. The counts are printed and floored so a regex
 * that silently stops matching fails LOUDLY instead of passing on nothing.
 */

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const pairActions = readFileSync(join(HERE, 'pair-actions.ts'), 'utf8');
const page = readFileSync(join(HERE, 'page.tsx'), 'utf8');

/** Every key handed to `backToList(eventId, { … })`, minus the error channel. */
function redirectFlagsIn(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/backToList\(\s*eventId\s*,\s*\{([^}]*)\}/g)) {
    const args = m[1] ?? '';
    for (const k of args.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
      const key = k[1];
      // `error` has its own banner + guestListErrorCopy path, not a flash.
      if (key && key !== 'error') found.add(key);
    }
  }
  return [...found].sort();
}

const FLAGS = redirectFlagsIn(pairActions);

test('the pair action still redirects with success flags at all', () => {
  console.log(`pair-actions.ts success flags: ${FLAGS.join(', ') || '(none)'}`);
  assert.ok(
    FLAGS.length >= 2,
    `expected at least 2 success flags, found ${FLAGS.length} — the regex has ` +
      'stopped matching, or the action stopped signalling success',
  );
  assert.ok(FLAGS.includes('paired'), 'the `paired` flag is gone');
  assert.ok(FLAGS.includes('unpaired'), 'the `unpaired` flag is gone');
});

test('every pair flag is declared on the page searchParams type', () => {
  const props = /searchParams:\s*Promise<\{([\s\S]*?)\}>;/.exec(page);
  const decl = props?.[1] ?? '';
  assert.ok(decl, 'could not find the searchParams type — this guard is blind');
  for (const flag of FLAGS) {
    assert.match(
      decl,
      new RegExp(`\\b${flag}\\?:`),
      `\`${flag}\` is not declared on the page's searchParams`,
    );
  }
});

test('every pair flag produces a message the host can read', () => {
  // 🪤 The window must face the BODY. Slicing to the first `\n}` stopped at the
  // end of pickFlash's destructured parameter type — where `search.<flag>` is
  // never written — so the guard passed on a page that read the flag nowhere.
  // Take everything from the signature to the next top-level declaration.
  const start = page.indexOf('function pickFlash(');
  assert.notEqual(start, -1, 'could not find pickFlash — this guard is blind');
  const after = page.slice(start + 'function pickFlash('.length);
  const end = after.search(/\n(?:export )?(?:function|const|type) /);
  const body = end === -1 ? after : after.slice(0, end);
  assert.ok(
    body.includes('return null;'),
    'the pickFlash window does not reach the end of the function',
  );

  for (const flag of FLAGS) {
    assert.match(
      body,
      new RegExp(`search\\.${flag}\\b`),
      `pickFlash never reads \`${flag}\`, so a finished action says nothing`,
    );
  }
});

test('a finished PAIR retracts the selection bar, and an unpair does not', () => {
  const expr = /recentlyApplied=\{Boolean\(([\s\S]*?)\)\}/.exec(page);
  const body = expr?.[1] ?? '';
  assert.ok(body, 'could not find the recentlyApplied expression');
  console.log(`recentlyApplied reads: ${body.replace(/\s+/g, ' ').trim()}`);

  assert.match(
    body,
    /search\.paired\b/,
    'pairing does not clear the bar — the host is left holding two guests the ' +
      'action already finished with',
  );
  // An unpair is one ROW's own control. Clearing the selection from it would
  // throw away a selection the host is still assembling.
  assert.doesNotMatch(
    body,
    /search\.unpaired\b/,
    'an unpair must not discard the host\'s in-progress selection',
  );
  // The bulk flags this mechanism was built for must not have been dropped
  // while adding pairing to it.
  for (const flag of ['bulk_assigned', 'bulk_grouped', 'bulk_sided']) {
    assert.match(body, new RegExp(`search\\.${flag}\\b`), `${flag} fell out`);
  }
});
