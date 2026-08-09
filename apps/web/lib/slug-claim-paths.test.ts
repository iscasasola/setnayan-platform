/**
 * THE THREE PATHS THAT HAND OUT A PUBLIC WEB ADDRESS, EXERCISED FOR REAL.
 *
 * A wedding rename, a shop address and a person handle all write into the ONE
 * namespace at `setnayan.com/{word}`. The protection for the rename path used
 * to be a regex over its own source text — and a reviewer broke it by keeping
 * the `findSlugConflict(...)` call and THROWING ITS RESULT AWAY. All twelve
 * tests stayed green, because none of them ran the function.
 *
 * So these tests RUN the shipped server actions. Only the two Supabase client
 * factories are replaced (plus `server-only`, which has no Node resolution
 * outside the Next bundler); every line of decision logic in the action is the
 * real one. A refusal that is computed and discarded fails here, because the
 * action would then reach its write and return success.
 *
 * `bb-gandang-hari` is the address actually forwarding in production until
 * 2026-08-22 — the concrete harm: printed invitations landing guests on a
 * stranger's business page.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

type Probe = { data: unknown; error: unknown; count?: number | null };
type World = Record<string, Probe>;

const EMPTY: Probe = { data: null, error: null };
const NO_ROWS: Probe = { data: [], error: null, count: 0 };

type Write = { table: string; op: 'update' | 'insert'; row: unknown };

/**
 * A chainable, THENABLE stand-in for the Supabase query builder. Thenable
 * because the actions await some chains without a terminal `.maybeSingle()`
 * (the rename rate-limit counts with `{ head: true }`).
 */
function fakeClient(world: World, user: { id: string } | null, writes: Write[]) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from(table: string) {
      const answer = () => world[table] ?? EMPTY;
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'ilike', 'eq', 'neq', 'gt', 'gte', 'lt', 'in', 'is', 'order', 'limit']) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = () => Promise.resolve(answer());
      builder.single = () => Promise.resolve(answer());
      builder.update = (row: unknown) => {
        writes.push({ table, op: 'update', row });
        return builder;
      };
      builder.insert = (row: unknown) => {
        writes.push({ table, op: 'insert', row });
        return builder;
      };
      builder.then = (
        resolve: (v: Probe) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(answer()).then(resolve, reject);
      return builder;
    },
  };
}

/** Installed once per test file; node:test gives each file its own process. */
let sessionWorld: World = {};
let adminWorld: World = {};
let sessionUser: { id: string } | null = { id: 'usr-me' };
let writes: Write[] = [];

const M = Module as unknown as { _load: (...args: unknown[]) => unknown };
const realLoad = M._load;
M._load = function patchedLoad(this: unknown, request: unknown, ...rest: unknown[]) {
  // `server-only` is provided by the Next bundler and does not resolve here.
  if (request === 'server-only') return {};
  if (request === '@/lib/supabase/admin') {
    return {
      createAdminClient: () => fakeClient(adminWorld, sessionUser, writes),
      createMoneyWriterClient: () => fakeClient(adminWorld, sessionUser, writes),
    };
  }
  if (request === '@/lib/supabase/server') {
    return { createClient: async () => fakeClient(sessionWorld, sessionUser, writes) };
  }
  return realLoad.call(this, request, ...rest);
} as typeof realLoad;

function reset() {
  sessionUser = { id: 'usr-me' };
  writes = [];
  sessionWorld = { events: EMPTY, vendor_profiles: EMPTY, users: EMPTY, slug_change_log: NO_ROWS };
  adminWorld = { events: EMPTY, vendor_profiles: EMPTY, users: EMPTY, slug_change_log: NO_ROWS };
}

/** The path a Next `redirect()` aimed at, pulled out of the thrown digest. */
async function redirectFrom(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      return digest.split(';')[2] ?? '';
    }
    throw err;
  }
  return '<no redirect — the action ran to completion>';
}

function form(slug: string): FormData {
  const fd = new FormData();
  fd.set('slug', slug);
  return fd;
}

// ── The couple's RENAME form ────────────────────────────────────────────────

test('a wedding cannot rename itself onto a live shop’s address', async () => {
  reset();
  adminWorld.vendor_profiles = { data: { vendor_profile_id: 'vp-someone-else' }, error: null };

  const { updateEventSlug } = await import('../app/dashboard/[eventId]/invitation/actions');
  const to = await redirectFrom(() => updateEventSlug('evt-1', form('bb-gandang-hari')));

  assert.equal(to, '/dashboard/evt-1/invitation?slug_error=taken_by_shop');
  assert.deepEqual(writes, [], 'a refused rename must not write anything');
});

test('a wedding cannot rename itself onto one of our own page names', async () => {
  reset();
  const { updateEventSlug } = await import('../app/dashboard/[eventId]/invitation/actions');
  const to = await redirectFrom(() => updateEventSlug('evt-1', form('open-shop')));
  assert.equal(to, '/dashboard/evt-1/invitation?slug_error=reserved');
  assert.deepEqual(writes, []);
});

test('a wedding cannot rename itself onto an address that still forwards', async () => {
  reset();
  adminWorld.slug_change_log = { data: [{ entity_id: 'evt-someone-else' }], error: null };
  const { updateEventSlug } = await import('../app/dashboard/[eventId]/invitation/actions');
  const to = await redirectFrom(() => updateEventSlug('evt-1', form('bb-gandang-hari')));
  assert.equal(to, '/dashboard/evt-1/invitation?slug_error=forwarding');
  assert.deepEqual(writes, []);
});

test('a free word still renames — the guard refuses, it does not block everything', async () => {
  reset();
  // Reaching the write is the proof. `revalidatePath` needs Next's request
  // store, which no unit test has, so the action throws AFTER the update — the
  // recorded write is what we assert on.
  const { updateEventSlug } = await import('../app/dashboard/[eventId]/invitation/actions');
  await updateEventSlug('evt-1', form('ana-and-luis')).catch(() => undefined);
  assert.deepEqual(
    writes.filter((w) => w.table === 'events' && w.op === 'update').map((w) => (w.row as { slug: string }).slug),
    ['ana-and-luis'],
  );
});

// ── The person's HANDLE form ────────────────────────────────────────────────

test('a person cannot claim a live shop’s address as their handle', async () => {
  reset();
  adminWorld.vendor_profiles = { data: { vendor_profile_id: 'vp-someone-else' }, error: null };

  const { updateUserSlug } = await import('../app/dashboard/(account)/profile/actions');
  const to = await redirectFrom(() => updateUserSlug(form('bb-gandang-hari')));

  assert.match(to, /^\/dashboard\/profile\?slug_error=/);
  assert.match(
    decodeURIComponent(to),
    /belongs to a business page/,
    'the person must be told WHICH kind of address they collided with',
  );
  assert.deepEqual(writes, [], 'a refused handle claim must not write anything');
});

test('a person cannot claim a live wedding’s address, or one of our page names', async () => {
  reset();
  adminWorld.events = { data: { event_id: 'evt-someone-else' }, error: null };
  const { updateUserSlug } = await import('../app/dashboard/(account)/profile/actions');
  assert.match(decodeURIComponent(await redirectFrom(() => updateUserSlug(form('ana-and-luis')))), /already taken/);
  assert.deepEqual(writes, []);

  reset();
  assert.match(
    decodeURIComponent(await redirectFrom(() => updateUserSlug(form('creators')))),
    /reserved by Setnayan/,
  );
  assert.deepEqual(writes, []);
});

test('an unreadable namespace refuses a handle instead of granting it', async () => {
  reset();
  adminWorld.users = { data: null, error: { message: 'boom' } };
  const { updateUserSlug } = await import('../app/dashboard/(account)/profile/actions');
  const to = await redirectFrom(() => updateUserSlug(form('ana-and-luis')));
  assert.match(decodeURIComponent(to), /couldn’t check/);
  assert.deepEqual(writes, []);
});

test('a free handle still saves', async () => {
  reset();
  const { updateUserSlug } = await import('../app/dashboard/(account)/profile/actions');
  await updateUserSlug(form('ana-and-luis')).catch(() => undefined);
  assert.deepEqual(
    writes.filter((w) => w.table === 'users' && w.op === 'update').map((w) => (w.row as { slug: string }).slug),
    ['ana-and-luis'],
  );
});

// ── The vendor's SHOP-ADDRESS form ──────────────────────────────────────────

function shopForm(slug: string): FormData {
  const fd = new FormData();
  fd.set('field', 'business_slug');
  fd.set('business_slug', slug);
  return fd;
}

/** This shop is Pro (the tier gate) and is the row the write targets. */
function mineIsPro() {
  sessionWorld.vendor_profiles = {
    data: {
      vendor_profile_id: 'vp-mine',
      business_slug: 'my-old-address',
      services: [],
      portfolio_r2_keys: [],
      tier_state: 'pro',
    },
    error: null,
  };
}

test('a shop cannot claim a live wedding’s address', async () => {
  reset();
  mineIsPro();
  adminWorld.events = { data: { event_id: 'evt-someone-else' }, error: null };

  const { updateVendorWebsiteField } = await import('../app/vendor-dashboard/actions');
  const res = await updateVendorWebsiteField(null, shopForm('ana-and-luis'));

  assert.equal(res.ok, false);
  assert.match(res.ok === false ? res.error : '', /already taken/);
  assert.deepEqual(
    writes.filter((w) => w.op === 'update'),
    [],
    'a refused address must not reach the update',
  );
});

test('a shop cannot claim an address that still forwards printed invitations', async () => {
  reset();
  mineIsPro();
  adminWorld.slug_change_log = { data: [{ entity_id: 'evt-someone-else' }], error: null };

  const { updateVendorWebsiteField } = await import('../app/vendor-dashboard/actions');
  const res = await updateVendorWebsiteField(null, shopForm('bb-gandang-hari'));

  assert.equal(res.ok, false);
  assert.match(res.ok === false ? res.error : '', /sends visitors to its old page/);
  assert.deepEqual(writes.filter((w) => w.op === 'update'), []);
});

test('a shop keeps the address it already holds', async () => {
  reset();
  mineIsPro();
  // The shop probe finds THIS shop — its own row must not read as a conflict.
  adminWorld.vendor_profiles = { data: { vendor_profile_id: 'vp-mine' }, error: null };

  const { updateVendorWebsiteField } = await import('../app/vendor-dashboard/actions');
  await updateVendorWebsiteField(null, shopForm('my-old-address')).catch(() => undefined);

  assert.deepEqual(
    writes
      .filter((w) => w.table === 'vendor_profiles' && w.op === 'update')
      .map((w) => (w.row as { business_slug: string }).business_slug),
    ['my-old-address'],
  );
});

test('an unreadable namespace refuses a shop address instead of granting it', async () => {
  reset();
  mineIsPro();
  adminWorld.users = { data: null, error: { message: 'boom' } };

  const { updateVendorWebsiteField } = await import('../app/vendor-dashboard/actions');
  const res = await updateVendorWebsiteField(null, shopForm('ana-and-luis'));

  assert.equal(res.ok, false);
  assert.match(res.ok === false ? res.error : '', /couldn’t check/);
  assert.deepEqual(writes.filter((w) => w.op === 'update'), []);
});
