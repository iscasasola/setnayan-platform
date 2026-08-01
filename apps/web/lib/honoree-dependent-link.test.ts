/**
 * honoree-dependent-link — the ownership boundary on `events.honoree_dependent_id`.
 *
 * THE DEFECT (origin/main, 2026-08-01): nothing ever WROTE this column, so the
 * cap's strongest key was dead code and two alaga with the same first name
 * shared one in-planning slot. Originating it means accepting an id from the
 * client — so these tests pin the refusals, not just the happy path:
 *   - an id the caller does not own is refused,
 *   - a handed-over record is refused,
 *   - a read error resolves to NULL (drop the link, never fail the create),
 *   - a label the user edited away from the alaga's name drops the link.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  honoreeLabelMatchesDependent,
  isDependentId,
  resolveHonoreeDependentId,
} from './honoree-dependent-link';

const OWNER = 'user-1';
const DEP = '11111111-2222-4333-8444-555555555555';
const OTHER_DEP = '99999999-2222-4333-8444-555555555555';

type Row = {
  dependent_id: string;
  name: string | null;
  owner_user_id: string;
  handed_over_at: string | null;
};

/** Minimal PostgREST-shaped fake honouring the filters this resolver applies. */
function fakeClient(rows: Row[], opts: { error?: string } = {}) {
  const calls: { table: string; filters: Record<string, unknown> }[] = [];
  const client = {
    calls,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      calls.push({ table, filters });
      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return builder;
        },
        is(col: string, val: unknown) {
          filters[col] = val;
          return builder;
        },
        async maybeSingle() {
          if (opts.error) return { data: null, error: { message: opts.error } };
          if (table !== 'dependents') return { data: null, error: null };
          const hit = rows.find(
            (r) =>
              r.dependent_id === filters.dependent_id &&
              r.owner_user_id === filters.owner_user_id &&
              (filters.handed_over_at !== null || r.handed_over_at === null),
          );
          return { data: hit ? { dependent_id: hit.dependent_id, name: hit.name } : null, error: null };
        },
      };
      return builder;
    },
  };
  // The resolver only ever calls .from(...).select().eq().eq().is().maybeSingle().
  return client as unknown as Parameters<typeof resolveHonoreeDependentId>[0] & {
    calls: typeof calls;
  };
}

const MINE: Row = {
  dependent_id: DEP,
  name: 'Nina',
  owner_user_id: OWNER,
  handed_over_at: null,
};

test('isDependentId accepts a uuid and nothing else', () => {
  assert.equal(isDependentId(DEP), true);
  assert.equal(isDependentId(` ${DEP} `), true);
  for (const bad of ['', 'self', 'unspecified', 'not-a-uuid', null, undefined, 42, {}]) {
    assert.equal(isDependentId(bad), false, JSON.stringify(bad));
  }
});

test('label/name agreement folds case and whitespace, and a blank never matches', () => {
  assert.equal(honoreeLabelMatchesDependent('Nina', 'nina'), true);
  assert.equal(honoreeLabelMatchesDependent('  Ma.   Sofia ', 'Ma. Sofia'), true);
  assert.equal(honoreeLabelMatchesDependent('Jose', 'Nina'), false);
  assert.equal(honoreeLabelMatchesDependent('', 'Nina'), false);
  assert.equal(honoreeLabelMatchesDependent(null, 'Nina'), false);
  assert.equal(honoreeLabelMatchesDependent('Nina', null), false);
  assert.equal(honoreeLabelMatchesDependent(null, null), false);
});

test('the happy path: my own alaga, label untouched → the link is written', async () => {
  const got = await resolveHonoreeDependentId(fakeClient([MINE]), {
    userId: OWNER,
    dependentId: DEP,
    honoreeLabel: 'Nina',
  });
  assert.equal(got, DEP);
});

test('AN UNOWNED ID IS REFUSED — the whole reason this resolver exists', async () => {
  const theirs: Row = { ...MINE, owner_user_id: 'user-2' };
  const got = await resolveHonoreeDependentId(fakeClient([theirs]), {
    userId: OWNER,
    dependentId: DEP,
    honoreeLabel: 'Nina',
  });
  assert.equal(got, null, 'writing another account’s dependent_id would leak a relationship');
});

test('the ownership predicate is actually sent to the DB, not assumed', async () => {
  const client = fakeClient([MINE]);
  await resolveHonoreeDependentId(client, {
    userId: OWNER,
    dependentId: DEP,
    honoreeLabel: 'Nina',
  });
  const call = client.calls.at(-1);
  assert.equal(call?.table, 'dependents');
  assert.equal(call?.filters.owner_user_id, OWNER);
  assert.equal(call?.filters.dependent_id, DEP);
  assert.equal(call?.filters.handed_over_at, null);
});

test('an id that matches nothing on the account resolves to NULL', async () => {
  const got = await resolveHonoreeDependentId(fakeClient([MINE]), {
    userId: OWNER,
    dependentId: OTHER_DEP,
    honoreeLabel: 'Nina',
  });
  assert.equal(got, null);
});

test('a handed-over record is no longer this account’s alaga', async () => {
  const gone: Row = { ...MINE, handed_over_at: '2026-07-01T00:00:00.000Z' };
  const got = await resolveHonoreeDependentId(fakeClient([gone]), {
    userId: OWNER,
    dependentId: DEP,
    honoreeLabel: 'Nina',
  });
  assert.equal(got, null);
});

test('an edited label drops the link rather than filing it under the old person', async () => {
  const got = await resolveHonoreeDependentId(fakeClient([MINE]), {
    userId: OWNER,
    dependentId: DEP,
    honoreeLabel: 'Jose',
  });
  assert.equal(got, null, 'the label and the link must describe the same person');
});

test('a read error DROPS the link — it must never cost anyone their event', async () => {
  const got = await resolveHonoreeDependentId(fakeClient([MINE], { error: 'boom' }), {
    userId: OWNER,
    dependentId: DEP,
    honoreeLabel: 'Nina',
  });
  assert.equal(got, null);
});

test('no caller identity, no link — and no round-trip spent looking', async () => {
  const client = fakeClient([MINE]);
  assert.equal(
    await resolveHonoreeDependentId(client, {
      userId: '',
      dependentId: DEP,
      honoreeLabel: 'Nina',
    }),
    null,
  );
  assert.equal(
    await resolveHonoreeDependentId(client, {
      userId: OWNER,
      dependentId: 'self',
      honoreeLabel: 'Nina',
    }),
    null,
  );
  assert.equal(client.calls.length, 0, 'a malformed id must be rejected before the DB');
});
