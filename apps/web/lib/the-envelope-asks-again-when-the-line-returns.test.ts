/**
 * the-envelope-asks-again-when-the-line-returns.test.ts — 📶 A PHONE WOKEN FROM SLEEP GETS ITS COUNT.
 *
 * Live fault (app_telemetry_logs, "readUnreadMessageThreads could not be read", 8× to 21 Nov 2026). The Supabase
 * gateway logged every `rpc/count_unread_message_threads` around those rows as 200, so not one failing read reached the
 * database: each was a fetch with NO answer. The Messages envelope asks the moment a tab is shown again, and a phone
 * woken from sleep has not got its line back yet. The badge stayed honest (null changes nothing) but kept an old count
 * for a minute, and the row said nothing of why.
 *
 * Holds (`readEnvelopeCount`, lib/unread-polls.ts):
 *   1 · a read with no answer waits for the line, asks ONCE more, and draws the real count;
 *   2 · a refusal FROM the database is not asked again (asking again changes nothing, and loads it twice);
 *   3 · two failures stay `null` — never a 0 — and carry their reason;
 *   4 · `readUnreadMessageThreads` names a no-answer read as `network`, a database refusal as not.
 * Sabotage: drop the second ask in `readEnvelopeCount` → (1) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEnvelopeCount } from './unread-polls';
import { readUnreadMessageThreads, type UnreadReadFailure } from './chat';

type Answer = { n: number | null; why?: UnreadReadFailure };
function reads(...answers: Answer[]) {
  let calls = 0;
  const read = async (onFail: (why: UnreadReadFailure) => void) => {
    const a = answers[Math.min(calls++, answers.length - 1)]!;
    if (a.n === null && a.why) onFail(a.why);
    return a.n;
  };
  return { read, calls: () => calls };
}
const NO_ANSWER: UnreadReadFailure = { network: true, detail: 'TypeError: Load failed' };
const REFUSED: UnreadReadFailure = { network: false, detail: '42501 permission denied' };

test('1 · a read with no answer (a phone just woken) waits for the line and asks once more — the real count is drawn', async () => {
  let waited = 0;
  const r = reads({ n: null, why: NO_ANSWER }, { n: 3 });
  const out = await readEnvelopeCount(r.read, async () => void waited++);
  assert.deepEqual(out, { n: 3, why: null });
  assert.equal(r.calls(), 2, 'asked once more');
  assert.equal(waited, 1, 'waited for the line first');
});

test('2 · a refusal from the database is not asked again', async () => {
  const r = reads({ n: null, why: REFUSED }, { n: 3 });
  const out = await readEnvelopeCount(r.read, async () => undefined);
  assert.deepEqual(out, { n: null, why: REFUSED });
  assert.equal(r.calls(), 1);
});

test('3 · two failures stay null — never a 0 — and carry the reason; a good first read asks nothing more', async () => {
  const twice = reads({ n: null, why: NO_ANSWER }, { n: null, why: NO_ANSWER });
  assert.deepEqual(await readEnvelopeCount(twice.read, async () => undefined), { n: null, why: NO_ANSWER });
  const fine = reads({ n: 0 });
  assert.deepEqual(await readEnvelopeCount(fine.read, async () => undefined), { n: 0, why: null }, 'a real 0 is a real 0');
  assert.equal(fine.calls(), 1);
});

test('4 · readUnreadMessageThreads says which kind of failure it was', async () => {
  const client = (answer: unknown) => ({ rpc: async () => answer }) as unknown as SupabaseClient;
  const seen: UnreadReadFailure[] = [];
  const quiet = console.error;
  console.error = () => undefined;
  try {
    assert.equal(
      await readUnreadMessageThreads(client({ data: null, status: 0, error: { message: 'TypeError: Failed to fetch', code: '' } }), (w) => seen.push(w)),
      null,
    );
    assert.equal(
      await readUnreadMessageThreads(client({ data: null, status: 401, error: { message: 'permission denied', code: '42501' } }), (w) => seen.push(w)),
      null,
    );
    assert.equal(await readUnreadMessageThreads(client({ data: 4, status: 200, error: null }), (w) => seen.push(w)), 4);
  } finally {
    console.error = quiet;
  }
  assert.equal(seen.length, 2, 'only the two failures are reported');
  assert.equal(seen[0]!.network, true, 'no HTTP answer → network');
  assert.equal(seen[1]!.network, false, 'a database refusal is not the network');
  assert.match(seen[1]!.detail, /^42501/);
});
