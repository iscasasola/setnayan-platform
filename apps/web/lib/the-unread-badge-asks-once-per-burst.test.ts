/**
 * The Messages badge used to fire `count_unread_message_threads()` once PER
 * chat message the caller could see — a burst of five replies was five
 * identical RPCs. It now asks once, after the burst settles (`settleBurst`).
 *
 * Two halves, because either alone is a green that proves nothing:
 *   · the helper: N pokes inside the quiet window → exactly ONE run, after the
 *     last poke; a poke after the window → a second run; cancel → none.
 *   · the wiring: the badge's INSERT handler pokes the settler instead of
 *     calling refresh directly, and its cleanup cancels it.
 *
 * Sabotage-checked: making `poke` call `fn` immediately fails the helper half;
 * putting `void refresh()` back in the INSERT handler fails the wiring half.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { settleBurst } from './settle-burst';
import { stripComments } from './strip-comments';

test('a burst of pokes runs the call once, after the burst goes quiet', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let runs = 0;
    const s = settleBurst(() => {
      runs += 1;
    }, 1500);
    for (let i = 0; i < 5; i += 1) {
      s.poke();
      mock.timers.tick(200);
    }
    assert.equal(runs, 0, 'ran before the burst settled');
    mock.timers.tick(1500);
    assert.equal(runs, 1, 'a burst of five must ask exactly once');
    s.poke();
    mock.timers.tick(1500);
    assert.equal(runs, 2, 'a later message must still be counted');
    s.poke();
    s.cancel();
    mock.timers.tick(5000);
    assert.equal(runs, 2, 'cancel must drop the pending run');
  } finally {
    mock.timers.reset();
  }
});

test('the badge pokes the settler on INSERT and cancels it on cleanup', () => {
  const src = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'app', '_components', 'unread-messages-badge.tsx'), 'utf8'),
  );
  const handler = /event:\s*'INSERT'[\s\S]*?\}\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s{8}\},/.exec(src);
  assert.ok(handler, 'could not find the INSERT handler in unread-messages-badge.tsx');
  const body = handler[1]!;
  assert.match(body, /settle\.poke\(\)/, 'the INSERT handler no longer goes through the settler');
  assert.doesNotMatch(body, /refresh\(\)/, 'the INSERT handler calls refresh() directly again — one RPC per message');
  assert.match(src, /return \(\) => \{[\s\S]*?settle\.cancel\(\)/, 'the effect cleanup no longer cancels a pending count');
});
