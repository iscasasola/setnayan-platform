import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * ⚖ OWNER 2026-09-23, arranging his own Principal Sponsors:
 *   *"when i move someone, the whole screen refreshes. feels laggy."*
 *   *"when it reloads, it goes back up and does not stay on where we are
 *    editing. this is hassle because we need to always scroll back down. we
 *    want them to move and pair people easily and fast."*
 *
 * MEASURED, not inferred — production runtime logs, his own session:
 *   POST …/guests 303 at 05:51:33 → the page's two GETs at 05:51:36-37
 *   POST …/guests 303 at 05:52:17 → 05:52:19-20
 * A 303 from a form action is a full document load. That is the refresh, and a
 * document load starts at the top, which is the lost scroll position.
 *
 * 🔑 THE THREE WAYS THIS COMES BACK. It is not enough that today's code does
 * not redirect — the next hand reaches for the shape that is already
 * everywhere else in this repo:
 *   1. an action ending in `redirect(...)`;
 *   2. a `<form action={serverAction}>` around a march control;
 *   3. the order write going back to one UPDATE per person in a loop, which is
 *      what made the round trip seconds long in the first place.
 * Each is checked by itself, because a file that stops doing one of them and
 * starts doing another would still be slow and would still lose his place.
 */

const G = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(G, ...p), 'utf8'));

const ACTION_FILES = ['march-actions.ts', 'entourage-order-actions.ts'] as const;

test('no Wedding March action sends the couple on a navigation', () => {
  for (const file of ACTION_FILES) {
    const src = read(file);
    assert.doesNotMatch(
      src,
      /\bredirect\s*\(/,
      `${file} redirects again — that is a 303, i.e. the whole page reloading and landing at the top`,
    );
    assert.doesNotMatch(
      src,
      /from 'next\/navigation'/,
      `${file} imports next/navigation again — the only thing it wanted from there was redirect`,
    );
  }
});

test('every Wedding March move RETURNS its verdict, so the island can say it', () => {
  for (const file of ACTION_FILES) {
    const src = read(file);
    const exported = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]!);
    assert.ok(exported.length > 0, `${file} exports no actions`);
    for (const fn of exported) {
      const at = src.indexOf(`export async function ${fn}(`);
      const sig = src.slice(at, src.indexOf('{', src.indexOf(')', at)));
      assert.match(
        sig,
        /Promise<MarchResult>/,
        `${fn} in ${file} does not return a MarchResult — a refusal it cannot hand back is a refusal nobody is told`,
      );
    }
  }
});

test('the march controls are buttons, not forms — a form action reloads the page', () => {
  for (const file of [
    ['_components', 'walking-order-lines.tsx'],
    ['_components', 'entourage-order-panel.tsx'],
    ['_components', 'march-button.tsx'],
  ] as const) {
    const src = read(...file);
    assert.doesNotMatch(
      src,
      /<form\b/,
      `${file.join('/')} builds a <form> again — its action posts and redirects, and the couple loses their place`,
    );
  }
});

test('a refusal reaches the RENDER, not just a live region', () => {
  // 🔑 The reason used to travel as `?error=<sentence>` through a page load.
  // Returned-and-dropped would be worse than that, not better: the move would
  // simply appear not to happen. Both surfaces that run an action must draw it.
  for (const [file, state] of [
    [['_components', 'walking-order-lines.tsx'], 'problem'],
    [['_components', 'march-button.tsx'], 'problem'],
  ] as const) {
    const src = read(...file);
    assert.match(src, new RegExp(`set${state[0]!.toUpperCase()}${state.slice(1)}\\(result\\.reason\\)`),
      `${file.join('/')} never stores the refused reason`);
    assert.match(src, new RegExp(`\\{${state}\\}`), `${file.join('/')} stores the reason and never draws it`);
    assert.match(src, /role="status"/, `${file.join('/')} draws the reason with nothing to announce it`);
  }
});

test('the order write is ONE round trip, not one per person', () => {
  // 50 sponsors meant 50 sequential UPDATEs to Singapore for one tap of Move ↑.
  const src = stripComments(
    readFileSync(join(process.cwd(), 'lib', 'entourage-write.ts'), 'utf8'),
  );
  assert.match(src, /rpc\('set_entourage_order'/, 'the batched order write is gone');
  const write = src.slice(src.indexOf('export async function writeLineOrder'));
  assert.doesNotMatch(
    write.slice(0, write.indexOf('\n}')),
    /await supabase\s*\n?\s*\.from\('guests'\)/,
    'writeLineOrder is back to a per-row UPDATE — that is the latency the owner felt',
  );
});

test('the island owns its arrows — never handed them down by index', () => {
  /*
    🪤 The arrows used to be built in the panel, one <form> each, and drawn by
    the island as `children[i]` — `i` from the island's OPTIMISTIC order while
    the array was in the SERVER's order. They agree until a move is in flight,
    which is exactly when somebody is tapping, and in that window every arrow
    below the moved line was bound to whoever used to stand at its position.
  */
  const island = read('_components', 'walking-order-lines.tsx');
  assert.doesNotMatch(island, /children\[/, 'the island indexes a children array again');
  assert.doesNotMatch(
    island,
    /children: React\.ReactNode\[\]/,
    'the island takes an array of controls again',
  );
  assert.match(island, /function MoveArrow\(/, 'the island no longer draws its own arrows');

  const panel = read('_components', 'entourage-order-panel.tsx');
  const open = panel.indexOf('<WalkingOrderLines');
  assert.ok(open > -1, 'the panel no longer mounts the island');
  const mount = panel.slice(open, panel.indexOf('>', panel.indexOf('}))}', open)) + 1);
  assert.doesNotMatch(mount, /<MoveButton/, 'the panel passes move controls into the island again');
});
