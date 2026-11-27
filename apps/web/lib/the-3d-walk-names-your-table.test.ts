/**
 * The guest's 3D walk names their table by its NAME, never its code (defect 24 Nov:
 * the caption read "You're at S89TBL-LAB0000006"). `public_venue_scene` sends only
 * public ids, so the page and the live-refresh route both join the guest's own
 * table name through ONE helper; the caption reads it through `youAreAtWords`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { withYourTableName, yourTableName, youAreAtWords, type WithYou } from './venue-your-table';

const WEB = join(__dirname, '..');
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

/** A one-query admin stand-in: records what it was asked, answers with `answer`. */
function fakeAdmin(answer: { data: unknown; error: unknown }) {
  const asked: { table?: string; cols?: string; eq?: [string, string] } = {};
  const client = {
    from(table: string) {
      asked.table = table;
      return {
        select(cols: string) {
          asked.cols = cols;
          return {
            eq(col: string, val: string) {
              asked.eq = [col, val];
              return { maybeSingle: async () => answer };
            },
          };
        },
      };
    },
  };
  return { admin: client as unknown as SupabaseClient, asked };
}

test('the caption says the name, or "your table", and never the code', () => {
  assert.equal(youAreAtWords({ tableName: "Ninong's table" }), "Ninong's table");
  assert.equal(youAreAtWords({ tableName: null }), 'your table');
  assert.equal(youAreAtWords({}), 'your table');
});

test('a joined set answers to its group name; a blank name is no name', () => {
  assert.equal(yourTableName({ table_label: 'Table 3', link_group_label: 'Table 3 & 4' }), 'Table 3 & 4');
  assert.equal(yourTableName({ table_label: 'Table 3', link_group_label: null }), 'Table 3');
  assert.equal(yourTableName({ table_label: '  ', link_group_label: ' ' }), null);
  assert.equal(yourTableName(null), null);
});

test("the join reads only the guest's own table, by its public id", async () => {
  // 🪑 27 Nov: the name is the one the table SHOWS (lib/table-auto-name.ts) — read server-side for this event; only the
  // guest's own table's name comes back.
  const { admin, asked } = fakeAdmin({ data: { table_id: 't6', event_id: 'ev' }, error: null });
  const out = await withYourTableName<WithYou>(admin, { you: { table: 'S89TBL-LAB0000006' } }, async (_a, eventId) => {
    assert.equal(eventId, 'ev');
    return new Map([['t6', 'Family'], ['t7', 'Barkada']]);
  });
  assert.equal(asked.table, 'event_tables');
  assert.deepEqual(asked.eq, ['public_id', 'S89TBL-LAB0000006']);
  assert.equal(out.you?.tableName, 'Family');
  assert.equal(out.you?.table, 'S89TBL-LAB0000006', 'the id stays the key the 3D scene matches tables by');
});

test('no token, no read; a failed read is "your table", not the code', async (t) => {
  t.mock.method(console, 'error', () => {});
  const none = fakeAdmin({ data: null, error: null });
  const anon = await withYourTableName<WithYou>(none.admin, { you: null }, async () => new Map());
  assert.equal(none.asked.table, undefined, 'a tokenless scene names no table');
  assert.equal(anon.you, null);
  const failed = fakeAdmin({ data: { table_label: 'Family', link_group_label: null }, error: { message: 'boom' } });
  const out = await withYourTableName<WithYou>(failed.admin, { you: { table: 'S89TBL-LAB0000006' } }, async () => new Map());
  assert.equal(out.you?.tableName, null);
  assert.equal(youAreAtWords(out.you!), 'your table');
});

test('the page and the live-refresh route both join the name; the caption reads it', () => {
  assert.match(read('app', '[slug]', 'venue', 'page.tsx'), /withYourTableName\(admin, scene, readShownTableNames\)/, 'the page draws the code');
  assert.match(read('app', 'api', 'venue-scene', '[slug]', 'route.ts'), /withYourTableName\(admin, /, 'a live refresh brings the code back');
  const walk = read('app', '[slug]', 'venue', '_components', 'guest-venue-3d.tsx');
  assert.match(walk, /You&rsquo;re at \{youAreAtWords\(scene\.you\)\}/);
  assert.doesNotMatch(walk, /re at \{scene\.you\.table\}/, 'the caption prints the table code again');
});
