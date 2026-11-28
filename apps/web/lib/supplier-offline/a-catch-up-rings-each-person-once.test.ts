/**
 * GUARD — A PHONE CATCHING UP RINGS EACH PERSON ONCE (controller review #2 item 16).
 *
 * A supplier's phone that comes back online replays its queued actions one by one through the SHIPPED actions, and each
 * shipped action tells whoever it concerns. Without grouping, ten offline messages ring the couple ten times in a
 * minute. The rule (`lib/supplier-offline/replay-notices.ts`): inside a replay ONLY, a notice the recipient already holds
 * unread — same kind, same place, last 30 minutes — is not sent again; a refused read rings; nothing outside a replay
 * changes; no new notice or email type.
 *
 * Sabotages (2026-11-25), each turns its test red:
 *   · the window check dropped from `alreadyRangForReplay` (any unread mutes)        → "a window, not any unread"
 *   · `offlineReplayNow() &&` dropped from emitNotification (every notice groups)     → "only inside a replay"
 *   · the grouping check moved below the bell-row insert                              → "before anything is sent"
 *   · `return false` on a refused read changed to `return true`                       → "fails toward ringing"
 *   · one replay moved just after `runAsOfflineReplay`'s callback in the engine         → "every replay is in the scope"
 *     (a first version of this check ran to the `catch` and stayed GREEN on that move — measured, then tightened)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';

// `replay-notices.ts` starts with `import 'server-only'` (Next's marker); under node:test it is a no-op stand-in.
{
  const Mod = createRequire(import.meta.url)('node:module') as { _load: (r: string, ...a: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
const notices = () => import('./replay-notices');

const root = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => stripComments(readFileSync(path.join(root, p), 'utf8'));

test('a window, not any unread: a fresh standing notice groups; an old, future or unreadable one never mutes', async () => {
  const { alreadyRangForReplay, REPLAY_GROUP_WINDOW_MS } = await notices();
  const now = Date.parse('2026-11-25T08:00:00.000Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  assert.equal(alreadyRangForReplay([ago(60_000)], now), true, 'a notice from a minute ago did not group the catch-up');
  assert.equal(alreadyRangForReplay([ago(REPLAY_GROUP_WINDOW_MS + 60_000)], now), false, 'last week’s unread notice muted today');
  assert.equal(alreadyRangForReplay([ago(-60_000)], now), false, 'a notice dated in the future muted somebody');
  assert.equal(alreadyRangForReplay(['not a time'], now), false, 'an unreadable time muted somebody');
  assert.equal(alreadyRangForReplay([], now), false);
  assert.equal(alreadyRangForReplay(null, now), false, 'a refused read muted somebody');
  assert.equal(REPLAY_GROUP_WINDOW_MS, 30 * 60 * 1000);
});

test('only inside a replay: the scope is the replay itself, and two replays at once each see their own', async () => {
  const { runAsOfflineReplay, offlineReplayNow } = await notices();
  assert.equal(offlineReplayNow(), null);
  const a = { member: 'ana', shop: 'shop-1', phoneTime: '2026-11-25T06:14:00.000Z' };
  const b = { member: 'ben', shop: 'shop-1', phoneTime: '2026-11-25T06:20:00.000Z' };
  const seen = await Promise.all([
    runAsOfflineReplay(a, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return offlineReplayNow();
    }),
    runAsOfflineReplay(b, async () => offlineReplayNow()),
  ]);
  assert.deepEqual(seen, [a, b]);
  assert.equal(offlineReplayNow(), null, 'the scope leaked past the replay');

  const emit = read('lib/notification-emit.ts');
  const body = emit.slice(emit.indexOf('export async function emitNotification('));
  assert.match(body, /if \(offlineReplayNow\(\) && \(await replayNoticeStanding\(userId, type, relatedUrl\)\)\) return;/, 'every notice is grouped, not only a replay’s');
});

test('before anything is sent: the check comes before the bell row (and so before the email and the phone notice)', () => {
  const emit = read('lib/notification-emit.ts');
  const body = emit.slice(emit.indexOf('export async function emitNotification('));
  const check = body.indexOf('replayNoticeStanding(userId');
  const insert = body.indexOf(".from('notifications').insert(");
  assert.ok(check > 0 && insert > 0 && check < insert, 'a grouped notice still wrote its bell row');
});

test('fails toward ringing: a refused read of the standing notices sends the notice', () => {
  const emit = read('lib/notification-emit.ts');
  const fn = emit.slice(emit.indexOf('async function replayNoticeStanding('), emit.indexOf('export async function emitNotification('));
  assert.match(fn, /if \(error\) \{[^}]*return false;\s*\}/, 'a refused read mutes the notice');
  assert.match(fn, /catch \{\s*return false;\s*\}/, 'a thrown read mutes the notice');
  assert.match(fn, /\.is\('read_at', null\)/, 'a notice already read groups the catch-up');
  assert.match(fn, /\.eq\('type', type\)/);
  assert.match(fn, /base\.eq\('related_url', relatedUrl\)/, 'notices about different places are grouped together');
});

test('every replay is in the scope: the shipped doors, money, gifts and messages', () => {
  const engine = read('lib/supplier-offline/engine.server.ts');
  const sync = engine.slice(engine.indexOf('async function syncOne('), engine.indexOf('async function registerDevice('));
  // The scope is the replay's own callback: from `runAsOfflineReplay(` to the `});` that closes it — not to the `catch`,
  // which would count a call placed just after the scope as inside it.
  const start = sync.indexOf('runAsOfflineReplay(');
  const scope = sync.slice(start, sync.indexOf('\n    });', start));
  assert.ok(start > 0 && scope.length > 0, 'the engine has no replay scope');
  for (const call of ['rowStillAsSeen(ctx, item)', 'moneyAction(ctx, item)', 'clientAdd(ctx, item)', 'messageSend(ctx, item)', 'replayDoor(door, item)']) {
    assert.ok(scope.includes(call), `${call} runs outside the replay scope`);
    assert.equal(sync.split(call).length - 1, 1, `${call} is also called outside the replay scope`);
  }
});
