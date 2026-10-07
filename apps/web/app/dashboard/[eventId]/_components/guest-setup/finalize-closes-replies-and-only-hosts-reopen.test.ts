/**
 * finalize-closes-replies-and-only-hosts-reopen.test.ts — owner, 2026-10-07,
 * verbatim: *"finalize means the guestlist is finalized and guests cannot answer
 * anymore. but the host of the event not the supplier and coordinator always
 * have the power to unfinalize it as needed in case they will replace or fill up
 * the guests that still needs to be covered last minute"*.
 *
 *   1 · a finalized list blocks guest replies (the reply door asks the one rule);
 *   2 · Reopen is ALLOWED for a host (`couple` member — the couple and co-hosts)
 *       and REFUSED for a supplier, the coordinator or a helper — on the server,
 *       before anything is written (a hidden button is not a fence);
 *   3 · the confirm never says "cannot be undone"; the locked row offers Reopen.
 *
 * 🛡 Sabotage: let `callerHostsEvent` accept any member (drop the
 * `member_type = 'couple'` filter) → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { FINALIZE_SHEET, REOPEN_LABEL, headcountLockedLine } from '@/lib/headcount-row';
import { callerHostsEvent, reopenGuestList } from '@/lib/pax';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A fake session client over ONE event's members — it honours every `.eq` filter, like PostgREST. */
function membersClient(rows: Array<{ event_id: string; user_id: string; member_type: string }>): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, 'event_members');
      const filters: Array<[string, unknown]> = [];
      const q = {
        select: () => q,
        eq: (col: string, v: unknown) => (filters.push([col, v]), q),
        limit: async () => ({ data: rows.filter((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v)), error: null }),
      };
      return q;
    },
  } as unknown as SupabaseClient;
}
const EVENT = 'e1';
/* `event_members.member_type` is 'couple' | 'coordinator' (the CHECK). A supplier and a
   helper (delegate) hold no couple row at all — they are asked by user id and must come back 'no'. */
const MEMBERS = [
  { event_id: EVENT, user_id: 'u-bride', member_type: 'couple' },
  { event_id: EVENT, user_id: 'u-cohost', member_type: 'couple' },
  { event_id: EVENT, user_id: 'u-coordinator', member_type: 'coordinator' },
];
const ASKERS = [
  ['u-bride', 'yes'],
  ['u-cohost', 'yes'],
  ['u-coordinator', 'no'],
  ['u-supplier', 'no'],
  ['u-helper', 'no'],
] as const;

test('1 · a finalized list blocks guest replies', () => {
  assert.equal(guestListIsClosed({ lockedAt: '2026-10-07T08:00:00Z' }), true);
  assert.equal(guestListIsClosed({ lockedAt: null }), false);
  const reply = read('app/[slug]/actions.ts');
  assert.match(reply, /const replyLocked = guestListIsClosed\(\{\s*lockedAt: evRsvp\?\.guest_count_locked_at,/, 'the reply door stopped asking whether the list is finalized');
});

test('2 · Reopen: allowed for a host, refused for a supplier, the coordinator or a helper', async () => {
  const client = membersClient(MEMBERS);
  const verdicts: string[] = [];
  for (const [who, want] of ASKERS) {
    const v = await callerHostsEvent(client, EVENT, who);
    verdicts.push(`${who}:${v}`);
    assert.equal(v, want, `${who} → ${v}`);
  }
  console.log(`reopen fence: ${verdicts.join(' · ')}`);
  for (const who of ['u-supplier', 'u-coordinator', 'u-helper']) {
    const res = await reopenGuestList(client, EVENT, who);
    assert.deepEqual(res, { ok: false, error: 'Only the hosts can reopen this guest list.' }, `${who} reopened the list`);
  }
  // The write sits behind the fence, and the action calls it for `false`.
  const pax = read('lib/pax.ts');
  const body = pax.slice(pax.indexOf('export async function reopenGuestList'), pax.indexOf('\n}\n', pax.indexOf('export async function reopenGuestList')));
  assert.ok(body.indexOf('callerHostsEvent(') >= 0 && body.indexOf('callerHostsEvent(') < body.indexOf('.update('), 'reopen writes before the host check');
  assert.match(read('app/dashboard/[eventId]/guests/finalize-actions.ts'), /: await reopenGuestList\(supabase, eventId, user\.id\)/);
});

test('3 · the confirm never says "cannot be undone"; the locked row offers Reopen', async () => {
  assert.equal(FINALIZE_SHEET.body(), 'Guests can’t reply after this. You can reopen it any time.');
  assert.doesNotMatch(`${FINALIZE_SHEET.title(7)} ${FINALIZE_SHEET.body()} ${headcountLockedLine(7)}`, /cannot be undone|stays locked/i);
  const html = await renderSetup({ headcount: { locked: true, heads: 120 } });
  const at = html.indexOf('data-setup-row="finalize"');
  const row = html.slice(at, html.indexOf('</section>', at));
  assert.match(row, /Guest list finalized/);
  assert.ok(row.includes(`aria-label="${REOPEN_LABEL}"`), 'the locked row has no Reopen');
});
