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
import { SlugNamespaceUnreadableError, generateUniqueSlug, isSlugTaken } from './slugs';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Probe = { data: unknown; error: unknown };
const empty: Probe = { data: null, error: null };
const noRows: Probe = { data: [], error: null };

/** Minimal chainable stand-in for the admin client's query builder. */
function fakeAdmin(tables: Record<string, Probe>, seen: string[] = []): SupabaseClient {
  return {
    from(table: string) {
      seen.push(table);
      const result = tables[table] ?? empty;
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'ilike', 'eq', 'gt', 'neq', 'order']) {
        builder[method] = () => builder;
      }
      builder.limit = () => Promise.resolve(result);
      builder.maybeSingle = () => Promise.resolve(result);
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

/**
 * ⚠ THE CREATE PATH IS A DIFFERENT FUNCTION AND IT ASKED A SHORTER QUESTION.
 *
 * `isSlugTaken` — reached by EVERY event creation through `generateUniqueSlug`
 * — queried `events` and the forwarding ledger and nothing else. Because
 * `app/[slug]/page.tsx` resolves the EVENT first, an auto-minted wedding name
 * that happened to equal a live shop's address silently took over that shop's
 * public page, one that is in our sitemap.
 */
test('the CREATE path refuses a word a shop or a person already holds', async () => {
  assert.equal(
    await isSlugTaken(
      fakeAdmin({
        ...freeWorld,
        vendor_profiles: { data: { vendor_profile_id: 'vp-1' }, error: null },
      }),
      'bb-gandang-hari',
    ),
    true,
    'a new wedding must not be minted onto a live shop’s public address',
  );
  assert.equal(
    await isSlugTaken(
      fakeAdmin({ ...freeWorld, users: { data: { user_id: 'usr-1' }, error: null } }),
      'bb-gandang-hari',
    ),
    true,
    'a new wedding must not be minted onto someone’s handle',
  );
  assert.equal(
    await isSlugTaken(fakeAdmin(freeWorld), 'bb-gandang-hari'),
    false,
    'precondition: the same word is free when nobody holds it',
  );
});

test('the CREATE path asks all four namespaces, not two', async () => {
  const seen: string[] = [];
  await isSlugTaken(fakeAdmin(freeWorld, seen), 'ana-and-luis');
  assert.deepEqual(
    [...new Set(seen)].sort(),
    ['events', 'slug_change_log', 'users', 'vendor_profiles'],
  );
});

test('the auto-minted name skips a word a shop holds and takes the next one', async () => {
  // The shop probe answers for EVERY candidate, so the first free name is the
  // one produced once the shop's word is out of the way.
  let calls = 0;
  const admin = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'ilike', 'eq', 'gt', 'order']) builder[m] = () => builder;
      const answer = () => {
        if (table !== 'vendor_profiles') {
          return Promise.resolve(table === 'slug_change_log' ? noRows : empty);
        }
        calls += 1;
        // Only the FIRST candidate ("ana-and-luis") is the shop's address.
        return Promise.resolve(
          calls === 1 ? { data: { vendor_profile_id: 'vp-1' }, error: null } : empty,
        );
      };
      builder.limit = answer;
      builder.maybeSingle = answer;
      return builder;
    },
  } as unknown as SupabaseClient;

  assert.equal(await generateUniqueSlug(admin, 'Ana and Luis'), 'ana-and-luis-2');
});

test('an unreadable namespace refuses to mint rather than guessing', async () => {
  // Fail closed, and fail FAST: looping 100 candidates through an unreadable
  // database cannot succeed, and the 100th path returns a name never checked
  // against anything.
  await assert.rejects(
    () =>
      generateUniqueSlug(
        fakeAdmin({ ...freeWorld, events: { data: null, error: { message: 'boom' } } }),
        'Ana and Luis',
      ),
    (err: unknown) => err instanceof SlugNamespaceUnreadableError,
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
  assert.equal(
    await findSlugConflict(
      fakeAdmin({ ...freeWorld, slug_change_log: { data: null, error: { message: 'boom' } } }),
      'ana-and-luis',
    ),
    'unverified',
    'an unreadable ledger is not the same fact as "somebody is forwarding here"',
  );

  // ⚠ AND THE CREATE PATH, WHICH HAD THE SAME HOLE IN ITS OWN COPY OF THE
  // QUERY: it destructured `{ data }` and dropped `error`, so an unreadable
  // events table came back `data: null` and the word was handed out.
  for (const table of ['events', 'vendor_profiles', 'users', 'slug_change_log'] as const) {
    assert.equal(
      await isSlugTaken(
        fakeAdmin({ ...freeWorld, [table]: { data: null, error: { message: 'boom' } } }),
        'ana-and-luis',
      ),
      true,
      `an unreadable ${table} must refuse to hand the word out, not hand it out`,
    );
  }
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
