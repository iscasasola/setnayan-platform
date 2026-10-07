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
  /* ⚖ 2026-09-30: the Guest list's "Pair these 2" (and its `paired` flag) left
     with "walks with" — it lives only in the Maker's Wedding March now
     (DECISION_LOG "WALKING TOGETHER IS NOT BEING A COUPLE"). `unpaired` stays:
     `unpairGuestAction` keeps its redirect for a form-bound caller. */
  assert.ok(
    FLAGS.length >= 1,
    `expected at least 1 success flag, found ${FLAGS.length} — the regex has ` +
      'stopped matching, or the action stopped signalling success',
  );
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

test('the new list holds its own selection; Done is the way out (Maker PR 4f)', () => {
  // ⤷ 2026-10-07: the roster table and its `recentlyApplied` reset are retired
  // with the old list. The prototype keeps Select mode after a Set… (the host
  // may set a group and then a table for the same people) and leaves it on
  // ☑ Done — pairing left the list on 2026-09-30.
  const screen = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx'), 'utf8');
  assert.match(screen, /label="Done" onClick=\{leaveSelect\}/, 'Select mode lost its Done');
  assert.doesNotMatch(screen, /\bpair(ed|With)?\b/i, 'pairing is back on the list');
});
