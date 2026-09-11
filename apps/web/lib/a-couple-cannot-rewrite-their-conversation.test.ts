/**
 * A PARTY TO A CONVERSATION MAY CHANGE ONLY WHAT THEIR SIDE MAY CHANGE — the APP
 * half of migration 20271222263716 (N4 part 1).
 *
 * The database refuses a browser session that moves a thread, accepts its own
 * inquiry or stamps a lock (tests/db/a-couple-cannot-rewrite-their-conversation.
 * db.test.ts, as a real `authenticated` role). What that test cannot see is the
 * APP: the one legitimate lock writer must now write on the service role — or
 * every "Lock this deal" fails — and it must write only the thread it proved.
 *
 *   1. every app write of the three lock columns is lockDeal's, on
 *      createAdminClient(), pinned to the proven thread AND its event, checked;
 *   2. lockDeal binds the Deal it freezes to THIS conversation (event, supplier,
 *      thread) — the service-role write is only as honest as that proof;
 *   3. the supplier's accept maps the database's refusal to a sentence;
 *   4. no later migration disarms the guard or turns it DEFINER.
 * Needles match comment-stripped source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { scanWriteSites } from './security/query-column-scan';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const LOCK_COLUMNS = ['agreed_price_centavos', 'locked_at', 'locked_by_user_id'];

test('the lock columns are written in exactly ONE place: lockDeal, on the service role', () => {
  const sites = scanWriteSites().filter(
    (s) => s.table === 'chat_threads' && s.columns.some((c) => LOCK_COLUMNS.includes(c)),
  );
  assert.ok(scanWriteSites().filter((s) => s.table === 'chat_threads').length >= 10, 'the write scan is blind');
  assert.deepEqual(
    sites.map((s) => s.file),
    ['app/_components/negotiation-actions.ts'],
    `a new writer of the thread lock: ${sites.map((s) => `${s.file}:${s.line}`).join(', ')} — a browser session is refused by the database; write it on the service role after proving the thread`,
  );
  const src = read('app/_components/negotiation-actions.ts');
  assert.match(
    src,
    /await createAdminClient\(\)\s*\.from\('chat_threads'\)\s*\.update\(\{\s*agreed_price_centavos: agreedCentavos,\s*locked_at: now,\s*locked_by_user_id: ctx\.userId,\s*\}\)\s*\.eq\('thread_id', threadId\)\s*\.eq\('event_id', ctx\.thread\.event_id\);/,
    'lockDeal no longer freezes the price on the service role, pinned to the proven thread and its event',
  );
  assert.match(src, /if \(freezeError\) \{[\s\S]{0,200}failBack\(/, 'the freeze’s error is not checked — a refused freeze would read as a lock');
  assert.doesNotMatch(
    src,
    /await supabase\s*\.from\('chat_threads'\)\s*\.update\(\{\s*agreed_price_centavos/,
    'the session client still writes the lock — the database now refuses it',
  );
});

test('lockDeal proves the caller is the COUPLE and the Deal is THIS conversation’s before the service-role write', () => {
  const src = read('app/_components/negotiation-actions.ts');
  const start = src.indexOf('export async function lockDeal(');
  const freeze = src.indexOf("await createAdminClient()\n    .from('chat_threads')", start);
  assert.ok(start > 0 && freeze > start, 'lockDeal or its freeze moved');
  const body = src.slice(start, freeze);
  assert.match(body, /if \(!ctx \|\| ctx\.role !== 'couple'\) redirect\(dest\);/, 'the couple-only check is gone');
  assert.match(
    body,
    /am\.event_id !== ctx\.thread\.event_id \|\|\s*am\.vendor_profile_id !== ctx\.thread\.vendor_profile_id \|\|\s*\(am\.thread_id != null && am\.thread_id !== threadId\)/,
    'a Deal from another conversation could be frozen onto this one',
  );
});

test('the supplier’s accept reads the database refusal as a sentence, not an error page', () => {
  const src = read('lib/chat-actions.ts');
  assert.match(src, /error\.message\.includes\('CHAT_THREAD_SIDE_REFUSED'\)[\s\S]{0,120}fail\(/);
});

test('no later migration disarms the guard, drops it, or makes it SECURITY DEFINER', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const LOCK = '20271222263716';
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const mine = files.find((f) => f.startsWith(LOCK));
  assert.ok(mine, `migration ${LOCK} is missing`);
  const sql = readFileSync(join(dir, mine), 'utf8').replace(/--[^\n]*/g, '');
  assert.match(sql, /CREATE TRIGGER chat_threads_guard_sides\s+BEFORE INSERT OR UPDATE ON public\.chat_threads/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /IF current_user NOT IN \('authenticated', 'anon'\) OR public\.is_admin\(\) THEN/);
  const bad = files
    .filter((f) => f > mine)
    .filter((f) => {
      const s = readFileSync(join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
      return (
        /DROP TRIGGER[^;]*chat_threads_guard_sides/i.test(s) ||
        /DISABLE TRIGGER\s+(chat_threads_guard_sides|ALL)/i.test(s) ||
        /FUNCTION public\.tg_chat_threads_guard_sides\(\)[\s\S]*?SECURITY DEFINER/i.test(s)
      );
    });
  assert.deepEqual(bad, [], `these migrations weaken the thread guard: ${bad.join(', ')}`);
});
