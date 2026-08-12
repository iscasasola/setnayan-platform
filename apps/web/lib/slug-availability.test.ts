/**
 * ONE NAMESPACE, ONE ANSWER — and a retired address is NOT free.
 *
 * Two live defects this locks down (2026-08-09):
 *   7. The couple's rename form checked the shape and the events table only.
 *      No reserved-word check at all, so a wedding could rename itself onto
 *      /creators or /open-shop — real pages of ours, live and in the sitemap —
 *      and no check against shop addresses or person handles either.
 *   8. A retired address went straight back into the pool while its 90-day
 *      forwarding row was still live, so a guest holding a printed invitation
 *      could land on a stranger's page.
 *
 * Run: pnpm --filter @setnayan/web test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  SLUG_CONFLICT_MESSAGE,
  findSlugConflict,
  isSlugForwarding,
  type SlugConflict,
} from './slug-availability';
import { isSlugTaken } from './slugs';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Probe = { data: unknown; error: unknown };
const empty: Probe = { data: null, error: null };
const noRows: Probe = { data: [], error: null };

/**
 * Minimal chainable stand-in for the admin client's query builder.
 *
 * ⚠ IT HONOURS `.eq('entity_type', …)` AND `.in('entity_type', […])`, AND IT
 * HAS TO. `slug_change_log` holds three kinds of row — a RENAME, which forwards
 * visitors to where something went, and the two CLOSURE holds (a closed shop, a
 * deleted wedding), which forward nobody anywhere and are only held so nobody
 * else takes the word. Two probes read that table and they differ ONLY by that
 * filter.
 *
 * The closure probe moved from `.eq` to `.in` when deleted weddings joined
 * closed shops; a stub missing `.in` does not return wrong rows, it throws
 * "is not a function" — which at least fails loudly. Both are honoured here so
 * the fixtures keep meaning what they say.
 *
 * A stub that ignored it returned the same rows to both, so whichever probe ran
 * first won and a rename fixture came back as a closed shop. Not a wrong answer
 * in production — Postgres filters — but the tests could no longer tell the two
 * apart, which is the whole thing they exist to check. **A double that ignores
 * the one filter under test makes every result meaningless in the same
 * direction.**
 */
function fakeAdmin(tables: Record<string, Probe>, seen: string[] = []): SupabaseClient {
  return {
    from(table: string) {
      seen.push(table);
      const result = tables[table] ?? empty;
      const builder: Record<string, unknown> = {};
      let entityType: string | null = null;
      for (const method of ['select', 'ilike', 'gt', 'neq', 'order']) {
        builder[method] = () => builder;
      }
      let entityTypes: string[] | null = null;
      builder.eq = (column: string, value: unknown) => {
        if (column === 'entity_type') entityType = String(value);
        return builder;
      };
      builder.in = (column: string, values: unknown) => {
        if (column === 'entity_type' && Array.isArray(values)) {
          entityTypes = values.map(String);
        }
        return builder;
      };
      // A fixture row declares its own kind; one that does not is a rename,
      // which is what every row in this table was before closures existed.
      const filtered = (): Probe => {
        const wanted =
          entityTypes ?? (entityType === null ? null : [entityType]);
        if (wanted === null || !Array.isArray(result.data)) return result;
        const rows = (result.data as Array<{ entity_type?: string }>).filter((r) =>
          wanted.includes(r.entity_type ?? 'event'),
        );
        return { data: rows, error: result.error };
      };
      builder.limit = () => Promise.resolve(filtered());
      builder.maybeSingle = () => Promise.resolve(filtered());
      return builder;
    },
  } as unknown as SupabaseClient;
}

const freeWorld = {
  events: empty,
  vendor_profiles: empty,
  users: empty,
  slug_change_log: noRows,
};

test('a genuinely free word is free', async () => {
  assert.equal(await findSlugConflict(fakeAdmin(freeWorld), 'ana-and-luis'), null);
});

test('a bad shape is refused before any lookup runs', async () => {
  const seen: string[] = [];
  assert.equal(await findSlugConflict(fakeAdmin(freeWorld, seen), 'ab'), 'invalid_format');
  assert.deepEqual(seen, [], 'a malformed word must not reach the database');
});

test('one of our own page names cannot be claimed', async () => {
  // The 14 that were claimable on 2026-08-09; these two are LIVE and sitemapped.
  for (const word of ['creators', 'open-shop', 'samahan', 'receipts', 'proposals']) {
    const seen: string[] = [];
    assert.equal(
      await findSlugConflict(fakeAdmin(freeWorld, seen), word),
      'reserved',
      `${word} is one of our own pages and must be refused`,
    );
    assert.deepEqual(seen, [], 'a reserved word must not reach the database');
  }
});

test('another wedding, shop or person already holding the word blocks it', async () => {
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, events: { data: { event_id: 'evt-other' }, error: null } }),
      'ana-and-luis',
    ),
    'taken',
  );
  assert.equal(
    await findSlugConflict(
      fakeAdmin({
        ...freeWorld,
        vendor_profiles: { data: { vendor_profile_id: 'vp-1' }, error: null },
      }),
      'ana-and-luis',
    ),
    'taken_by_shop',
  );
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, users: { data: { user_id: 'usr-1' }, error: null } }),
      'ana-and-luis',
    ),
    'taken_by_person',
  );
});

test('renaming to a word you already hold is not a conflict', async () => {
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, events: { data: { event_id: 'evt-mine' }, error: null } }),
      'ana-and-luis',
      { eventId: 'evt-mine' },
    ),
    null,
  );
});

// --- item 8 -----------------------------------------------------------------

test('a RETIRED address still forwarding cannot be re-taken', async () => {
  const world = {
    ...freeWorld,
    slug_change_log: { data: [{ entity_id: 'evt-someone-else' }], error: null },
  };
  assert.equal(
    await findSlugConflict(fakeAdmin(world), 'ana-and-luis'),
    'forwarding',
    'a printed invitation still points here — it must not be handed to a stranger',
  );
  assert.equal(
    await isSlugTaken(fakeAdmin(world), 'ana-and-luis'),
    true,
    'the CREATE path must refuse it too, not just the rename form',
  );
});

test('your own retired address is still yours to take back', async () => {
  const world = {
    ...freeWorld,
    slug_change_log: { data: [{ entity_id: 'evt-mine' }], error: null },
  };
  assert.equal(await findSlugConflict(fakeAdmin(world), 'ana-and-luis', { eventId: 'evt-mine' }), null);
  assert.equal(await isSlugForwarding(fakeAdmin(world), 'ana-and-luis', { eventId: 'evt-mine' }), false);
});

test('an EXPIRED forwarding row does not block (the query filters it out)', async () => {
  // The redirect_until filter happens in the query; an expired row simply is
  // not returned, so an empty result must read as free.
  assert.equal(await isSlugForwarding(fakeAdmin(freeWorld), 'ana-and-luis'), false);
});

// --- failing closed ---------------------------------------------------------

test('a lookup that FAILS is not proof the word is free', async () => {
  // ⚠ Supabase resolves { error } — it never throws, so a catch block never
  // runs and a failed read looks exactly like "nothing found".
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, events: { data: null, error: { message: 'boom' } } }),
      'ana-and-luis',
    ),
    'unverified',
  );
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, vendor_profiles: { data: null, error: { message: 'boom' } } }),
      'ana-and-luis',
    ),
    'unverified',
  );
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, users: { data: null, error: { message: 'boom' } } }),
      'ana-and-luis',
    ),
    'unverified',
  );
  assert.equal(
    await isSlugForwarding(
      fakeAdmin({ ...freeWorld, slug_change_log: { data: null, error: { message: 'boom' } } }),
      'ana-and-luis',
    ),
    true,
    'an unreadable forwarding ledger must refuse, not allow',
  );
});

// --- the rename path must keep checking -------------------------------------

/** The body of one exported function, with comments stripped. */
function shippedBody(file: string, fnName: string): string {
  const source = readFileSync(path.join(WEB_DIR, file), 'utf8');
  const start = source.indexOf(`export async function ${fnName}(`);
  assert.notEqual(start, -1, `${fnName} not found in ${file} — was it renamed?`);
  const after = source.indexOf('\nexport ', start + 1);
  const body = source.slice(start, after === -1 ? source.length : after);
  // Scope to what SHIPS: a guard that greps the whole text would pass forever
  // on the comment explaining the bug.
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the couple’s rename form still asks the availability question', () => {
  const body = shippedBody('app/dashboard/[eventId]/invitation/actions.ts', 'updateEventSlug');
  assert.match(
    body,
    /findSlugConflict\(\s*admin\s*,\s*requested\s*,\s*\{\s*eventId\s*\}/,
    'updateEventSlug stopped running the shared availability check — a wedding could take one of our own page names, a shop address, a person’s handle, or a retired address that still forwards printed invitations',
  );
  assert.match(
    body,
    /slug_error=\$\{encodeURIComponent\(conflict\)\}/,
    'the refusal is computed but never shown — a guard that refuses in silence is indistinguishable from one that passed',
  );
});

test('the live availability endpoint refuses a still-forwarding address', () => {
  const source = readFileSync(path.join(WEB_DIR, 'app/api/slugs/check/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.match(
    source,
    /isSlugForwarding\(/,
    'the availability oracle stopped checking the forwarding ledger — it would tell a couple a retired address is free',
  );
});

test('every refusal reason has a sentence a person can read', () => {
  const reasons: SlugConflict[] = [
    'invalid_format',
    'reserved',
    'taken',
    'taken_by_shop',
    'taken_by_person',
    'forwarding',
    'unverified',
  ];
  for (const reason of reasons) {
    const copy = SLUG_CONFLICT_MESSAGE[reason];
    assert.ok(copy && copy.length > 10, `${reason} has no readable copy`);
  }
  // And the couple's page must actually use that map, or a new reason renders
  // as its own bare key ("forwarding").
  const page = readFileSync(
    path.join(WEB_DIR, 'app/dashboard/[eventId]/invitation/page.tsx'),
    'utf8',
  ).replace(/^\s*\/\/.*$/gm, '');
  assert.match(page, /\.\.\.SLUG_CONFLICT_MESSAGE/);
});

// --- closed shops (owner-locked 2026-08-10) ---------------------------------

test('a CLOSED shop keeps its address, and it is refused for its own reason', async () => {
  // Owner: "the slug will be kept for the closed shop. slug will be available
  // again after 1 year from date of deletion." A shop's address is printed on
  // cards and pasted into messages months ahead — handing it to a different
  // company the minute the business closes points all of that at a stranger.
  const world = {
    ...freeWorld,
    slug_change_log: {
      data: [{ entity_id: 'shop-that-closed', entity_type: 'vendor_closed' }],
      error: null,
    },
  };
  assert.equal(await findSlugConflict(fakeAdmin(world), 'banaweflorals'), 'retired_shop');
  assert.equal(
    await isSlugTaken(fakeAdmin(world), 'banaweflorals'),
    true,
    'the CREATE path must refuse a held address too, not just the rename form',
  );
});

test('a closed shop is not described as forwarding — it sends nobody anywhere', async () => {
  // 🔑 SAME ANSWER, WRONG REASON, AND THE REASON IS THE WHOLE MESSAGE. Both
  // rows live in one ledger and the forwarding probe matches on old_slug alone,
  // so if it ran first every closed address would be explained with wording
  // about redirects that do not exist — and would never mention that the word
  // frees up in a year.
  const world = {
    ...freeWorld,
    slug_change_log: {
      data: [{ entity_id: 'shop-that-closed', entity_type: 'vendor_closed' }],
      error: null,
    },
  };
  const reason = await findSlugConflict(fakeAdmin(world), 'banaweflorals');
  assert.notEqual(reason, 'forwarding');
  assert.match(SLUG_CONFLICT_MESSAGE[reason as SlugConflict], /year/i);
});

test('the shop that closed can still take its own address back', async () => {
  const world = {
    ...freeWorld,
    slug_change_log: {
      data: [{ entity_id: 'shop-mine', entity_type: 'vendor_closed' }],
      error: null,
    },
  };
  assert.equal(
    await findSlugConflict(fakeAdmin(world), 'banaweflorals', { vendorProfileId: 'shop-mine' }),
    null,
  );
});

test('a rename is still a rename — the new probe does not swallow the old one', async () => {
  const world = {
    ...freeWorld,
    slug_change_log: { data: [{ entity_id: 'evt-someone-else', entity_type: 'event' }], error: null },
  };
  assert.equal(await findSlugConflict(fakeAdmin(world), 'ana-and-luis'), 'forwarding');
});

test('an unreadable ledger never reads as free', async () => {
  // Fails closed, like the forwarding probe beside it: handing out a held
  // address is worse than asking someone to try again.
  const world = { ...freeWorld, slug_change_log: { data: null, error: { message: 'boom' } } };
  assert.equal(await findSlugConflict(fakeAdmin(world), 'banaweflorals'), 'unverified');
});
