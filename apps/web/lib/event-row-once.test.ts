/**
 * event-row-once.test.ts — THE EVENT'S ROW IS READ ONCE PER RENDER, AND NEVER
 * HANDED TO THE WRONG ASKER.
 *
 * `lib/event-row-once.ts` lets the guest tree's one read of the event answer
 * every reader that used to ask the database for a few columns of the same
 * row. What is held here:
 *
 *   1 · inside a render, a service-role asker is answered from the held row —
 *       its own read is not sent — with exactly the columns it named, as a copy;
 *   2 · a signed-in viewer's client is NEVER answered from it (its own read,
 *       under its own RLS, is sent);
 *   3 · another event, a column the row does not carry, or a select that is not
 *       plain column names → the asker's own read;
 *   4 · outside a render nothing is held at all;
 *   5 · every call site names the same columns it would have read, of the same
 *       event, as one row — so "in hand" and "from the database" are one answer;
 *   6 · every extra column exists in production and none repeats the shell's;
 *   7 · the page's own row carries none of the extras.
 *
 * How many requests that saves per viewer is counted in
 * `lib/guest-page-reads.test.ts` (`events` reads per view = 1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  DASHBOARD_ROW_CARRIES,
  EVENT_ROW_ONCE_EXTRA_COLUMNS,
  eventRowOnce,
  openDashboardEventRow,
  eventRowOnceBySlug,
  holdEventRow,
  withEventRowScopeForTest,
  withoutOnceExtras,
} from './event-row-once';
import { markServiceRoleClient } from './request-once';

const WEB = join(__dirname, '..');
const ROOT = join(WEB, '..', '..');
const EVENT = '00000000-0000-4000-8000-0000000000e1';
const ROW = { event_id: EVENT, event_date: '2027-06-12', papic_on: false, role_names: { bridesmaid: "Bride's Crew" } };

type Answer = { data: Record<string, unknown> | null; error: null | { message: string } };
const fromDatabase = (calls: string[], label: string) => (): PromiseLike<Answer> => {
  calls.push(label);
  return Promise.resolve({ data: { from: 'database' }, error: null });
};

test('1 · inside a render a service-role asker is answered from the held row — its own read is not sent', async () => {
  await withEventRowScopeForTest(async () => {
    const admin = markServiceRoleClient({});
    holdEventRow(EVENT, ROW);
    const calls: string[] = [];
    const one = await eventRowOnce(admin, EVENT, 'papic_on', fromDatabase(calls, 'papic_on'));
    assert.deepEqual(one, { data: { papic_on: false }, error: null, count: null, status: 200, statusText: 'OK' });
    const two = await eventRowOnce(admin, EVENT, 'role_names, event_date', fromDatabase(calls, 'two'));
    assert.deepEqual(two.data, { role_names: { bridesmaid: "Bride's Crew" }, event_date: '2027-06-12' }, 'exactly the columns named — no more');
    assert.deepEqual(calls, [], 'a read was sent for a row already in hand');
    // A copy per reader: one reader changing its answer cannot change the next one's.
    (two.data as { role_names: Record<string, string> }).role_names.bridesmaid = 'changed';
    const again = await eventRowOnce(admin, EVENT, 'role_names', fromDatabase(calls, 'again'));
    assert.deepEqual(again.data, { role_names: { bridesmaid: "Bride's Crew" } });
    // A second service-role client is the same authority (`lib/request-once.ts`).
    const other = await eventRowOnce(markServiceRoleClient({}), EVENT, 'papic_on', fromDatabase(calls, 'other'));
    assert.deepEqual(other.data, { papic_on: false });
    assert.deepEqual(calls, []);
  });
});

test('2 · a signed-in viewer’s client is never answered from the service role’s row', async () => {
  await withEventRowScopeForTest(async () => {
    holdEventRow(EVENT, ROW);
    const calls: string[] = [];
    const viewer = {};
    const got = await eventRowOnce(viewer, EVENT, 'papic_on', fromDatabase(calls, 'viewer'));
    assert.deepEqual(calls, ['viewer'], 'a session client was answered from a row read past RLS');
    assert.deepEqual(got.data, { from: 'database' });
  });
});

test('3 · another event, a column the row does not carry, or a select that is not plain columns → the asker’s own read', async () => {
  await withEventRowScopeForTest(async () => {
    const admin = markServiceRoleClient({});
    holdEventRow(EVENT, ROW);
    const calls: string[] = [];
    await eventRowOnce(admin, '00000000-0000-4000-8000-0000000000e2', 'papic_on', fromDatabase(calls, 'another event'));
    await eventRowOnce(admin, EVENT, 'papic_on, not_held', fromDatabase(calls, 'a column not held'));
    await eventRowOnce(admin, EVENT, '*', fromDatabase(calls, 'star'));
    await eventRowOnce(admin, EVENT, 'papic_on, orders(order_id)', fromDatabase(calls, 'an embed'));
    await eventRowOnce(admin, EVENT, 'on:papic_on', fromDatabase(calls, 'an alias'));
    assert.deepEqual(calls, ['another event', 'a column not held', 'star', 'an embed', 'an alias']);
  });
});

test('3b · the asker’s own read keeps its own failure — a refused read arrives as it was, a thrown one still throws', async () => {
  await withEventRowScopeForTest(async () => {
    const admin = markServiceRoleClient({});
    const refused = await eventRowOnce(admin, EVENT, 'papic_on', () => Promise.resolve({ data: null, error: { message: 'permission denied' } }));
    assert.deepEqual(refused, { data: null, error: { message: 'permission denied' } });
    await assert.rejects(
      eventRowOnce(admin, EVENT, 'papic_on', () => Promise.reject(new Error('the read threw'))),
      /the read threw/,
    );
    await assert.rejects(
      eventRowOnce(admin, EVENT, 'papic_on', () => {
        throw new Error('the read threw before it left');
      }),
      /before it left/,
    );
  });
});

test('4 · outside a render nothing is held — an action’s gate reads every time', async () => {
  const admin = markServiceRoleClient({});
  holdEventRow(EVENT, ROW); // no render: this lands in a Map nobody will be handed again
  const calls: string[] = [];
  await eventRowOnce(admin, EVENT, 'papic_on', fromDatabase(calls, 'first'));
  await eventRowOnce(admin, EVENT, 'papic_on', fromDatabase(calls, 'second'));
  assert.deepEqual(calls, ['first', 'second']);
  // …and one render's row is gone when the render is.
  await withEventRowScopeForTest(async () => holdEventRow(EVENT, ROW));
  await withEventRowScopeForTest(async () => {
    await eventRowOnce(admin, EVENT, 'papic_on', fromDatabase(calls, 'the next render'));
  });
  assert.deepEqual(calls, ['first', 'second', 'the next render']);
});

// ── 4b · by slug — the guest's two invite doors ─────────────────────────────

/** A REAL client of the installed library, on a database that counts and answers nothing useful. */
function countingClient() {
  const sent: string[] = [];
  const client = createClient('http://db.test', 'test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (async (input: RequestInfo | URL) => {
        sent.push(String(input));
        return new Response(JSON.stringify({ from: 'database' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    },
  });
  return { client, sent };
}

test('4b · by slug: the door’s own read is built but NOT sent when it asks what the one read already answered', async () => {
  await withEventRowScopeForTest(async () => {
    const { client, sent } = countingClient();
    markServiceRoleClient(client);
    holdEventRow(EVENT, { ...ROW, slug: 'maria-and-jose', display_name: 'Maria & Jose' }, 'Maria-and-Jose');
    const got = await eventRowOnceBySlug(client, 'Maria-and-Jose', () =>
      client.from('events').select(`event_id, slug,   display_name, papic_on`).ilike('slug', 'Maria-and-Jose').maybeSingle(),
    );
    assert.deepEqual(got.data, { event_id: EVENT, slug: 'maria-and-jose', display_name: 'Maria & Jose', papic_on: false });
    assert.equal(got.error, null);
    assert.deepEqual(sent, [], 'the query was sent although the row was in hand — the installed client no longer shows what it would ask');
  });
});

test('4c · by slug: any OTHER question is sent as it is — another slug, another filter, a column not held, many rows, a session client', async () => {
  await withEventRowScopeForTest(async () => {
    const { client, sent } = countingClient();
    markServiceRoleClient(client);
    holdEventRow(EVENT, { ...ROW, slug: 'maria-and-jose' }, 'maria-and-jose');
    const ask = async (label: string, slug: string, read: () => PromiseLike<unknown>) => {
      const before = sent.length;
      await eventRowOnceBySlug(client, slug, read);
      assert.equal(sent.length, before + 1, `${label}: answered from the held row`);
    };
    await ask('another slug', 'ana-and-ben', () => client.from('events').select('event_id').ilike('slug', 'ana-and-ben').maybeSingle());
    await ask('a different case — not the question that was asked', 'Maria-And-Jose', () => client.from('events').select('event_id').ilike('slug', 'Maria-And-Jose').maybeSingle());
    await ask('an exact match, not ilike', 'maria-and-jose', () => client.from('events').select('event_id').eq('slug', 'maria-and-jose').maybeSingle());
    await ask('a second filter', 'maria-and-jose', () => client.from('events').select('event_id').ilike('slug', 'maria-and-jose').eq('archived', false).maybeSingle());
    await ask('a column not held', 'maria-and-jose', () => client.from('events').select('event_id, not_held').ilike('slug', 'maria-and-jose').maybeSingle());
    await ask('many rows', 'maria-and-jose', () => client.from('events').select('event_id').ilike('slug', 'maria-and-jose'));
    await ask('another table', 'maria-and-jose', () => client.from('guests').select('event_id').ilike('slug', 'maria-and-jose').maybeSingle());
    await ask('something that is not a query at all', 'maria-and-jose', () => client.from('events').select('event_id').ilike('slug', 'maria-and-jose').maybeSingle().then((r) => r));
    // A viewer's own client never gets the service role's row.
    const viewer = countingClient();
    await eventRowOnceBySlug(viewer.client, 'maria-and-jose', () => viewer.client.from('events').select('event_id').ilike('slug', 'maria-and-jose').maybeSingle());
    assert.equal(viewer.sent.length, 1, 'a session client was answered from a row read past RLS');
  });
  // …and outside a render nothing is held.
  const { client, sent } = countingClient();
  markServiceRoleClient(client);
  holdEventRow(EVENT, { ...ROW, slug: 'maria-and-jose' }, 'maria-and-jose');
  await eventRowOnceBySlug(client, 'maria-and-jose', () => client.from('events').select('event_id').ilike('slug', 'maria-and-jose').maybeSingle());
  assert.equal(sent.length, 1);
});

// ── 5 · every call site ─────────────────────────────────────────────────────

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.harness.ts')) out.push(full);
  }
  return out;
}

/** Every `eventRowOnce(client, id, columns, () => …)` in the app, with its whole call text. */
function callSites(): Array<{ file: string; call: string }> {
  const sites: Array<{ file: string; call: string }> = [];
  for (const file of [...sources(join(WEB, 'lib')), ...sources(join(WEB, 'app'))]) {
    if (file.endsWith('event-row-once.ts')) continue;
    const src = readFileSync(file, 'utf8');
    let at = 0;
    for (;;) {
      const start = src.indexOf('eventRowOnce(', at);
      if (start === -1) break;
      let depth = 0;
      let end = start + 'eventRowOnce'.length;
      for (; end < src.length; end++) {
        if (src[end] === '(') depth++;
        else if (src[end] === ')' && --depth === 0) break;
      }
      sites.push({ file: file.slice(WEB.length + 1), call: src.slice(start, end + 1) });
      at = end;
    }
  }
  return sites;
}

test('5 · every call site names the columns it would have read, of the same event, as one row', () => {
  const sites = callSites();
  assert.ok(sites.length >= 15, `only ${sites.length} call sites were found — the scan is not seeing them`);
  for (const { file, call } of sites) {
    const m = /^eventRowOnce\(\s*([\w.]+),\s*([\w.]+),\s*('[^']*'|[A-Z_]+),\s*\(\) =>\s*([\s\S]*)\)$/.exec(call);
    assert.ok(m, `${file}: this call is not in the one shape the guard can read:\n${call}`);
    const [, client = '', id = '', columns = '', read = ''] = m;
    const rest = read.replace(/\s+/g, '');
    assert.ok(rest.startsWith(`${client}.from('events').select(`), `${file}: the read is not this client's read of events:\n${call}`);
    const named = columns.replace(/\s+/g, '');
    assert.ok(
      rest.includes(`.select(${named})`) || rest.includes(`.select(${named},)`),
      `${file}: the columns asked of the held row (${columns}) are not the columns the read selects:\n${call}`,
    );
    assert.ok(rest.includes(`.eq('event_id',${id})`), `${file}: the read is not keyed by the same event id (${id}):\n${call}`);
    assert.ok(/\.maybeSingle\(\),?$/.test(rest), `${file}: the read is not a one-row read:\n${call}`);
    assert.equal((rest.match(/\.(eq|neq|in|is|not|or|ilike|like|gt|lt|gte|lte|filter|match)\(/g) ?? []).length, 1, `${file}: the read filters on more than the event id — the held row cannot answer it:\n${call}`);
  }
});

// ── 6 · the extras ──────────────────────────────────────────────────────────

const LOADERS = readFileSync(join(WEB, 'app', '[slug]', '_lib', 'loaders.ts'), 'utf8');
const SHELL_COLUMNS = (/loadEventShell = cache[\s\S]*?\.select\(\s*'([^']+)'/.exec(LOADERS)?.[1] ?? '').split(',').map((c) => c.trim());

test('6 · every extra column exists in production, and none repeats one of the shell’s', () => {
  assert.ok(SHELL_COLUMNS.length > 40, 'the shell’s own select was not found — update this guard');
  const snapshot = readFileSync(join(ROOT, 'supabase', 'security', 'prod-schema.snapshot.txt'), 'utf8');
  const inProd = new Set(snapshot.split('\n').filter((l) => l.startsWith('events.')).map((l) => l.slice('events.'.length).trim()));
  assert.ok(inProd.has('event_id'), 'the production snapshot was not read');
  for (const column of EVENT_ROW_ONCE_EXTRA_COLUMNS) {
    assert.ok(
      inProd.has(column),
      `events.${column} is not in production's schema snapshot: the one read would be refused on EVERY view (42703) and fall back to reading the shell alone — a request added, not saved`,
    );
    assert.ok(!SHELL_COLUMNS.includes(column), `${column} is already one of the shell's own columns — asked twice in one select`);
  }
  assert.equal(new Set(EVENT_ROW_ONCE_EXTRA_COLUMNS).size, EVENT_ROW_ONCE_EXTRA_COLUMNS.length, 'an extra column is listed twice');
});

test('6b · the one read falls back to the shell alone ONLY for an unknown column, and holds what it read', () => {
  const start = LOADERS.indexOf('function theOneEventRead(');
  const one = LOADERS.slice(start, LOADERS.indexOf('async function eventStampBySlug(', start));
  assert.ok(start > -1 && one.length > 200, 'theOneEventRead is gone or renamed — update this guard');
  // A refusal of an unknown column → the shell alone, holding nothing; any other refusal is handed back as it is.
  assert.match(
    one,
    /if \(whole\.error\) return whole\.error\.code === '42703' \? \{ \.\.\.\(await read\(columns\)\), held: false \} : \{ \.\.\.whole, held: false \};/,
    'the fallback is gone, or now retries on any failure',
  );
  // The hold happens AFTER the read, in `readEventShellRow` (the stamp-aware read `loadEventShell` goes
  // through, lib/event-shared-reads.ts) — so a row remembered under the stamp is left in hand exactly like one just read.
  const shell = LOADERS.slice(LOADERS.indexOf('export const loadEventShell = cache('), LOADERS.indexOf('export type EventShellRow'));
  assert.match(shell, /await readEventShellRow\(admin, slug, \(\) =>\s*theOneEventRead\(admin, slug\)\.select\(/, 'loadEventShell no longer reads through the stamp-aware read — update this guard');
  const stamped = LOADERS.slice(LOADERS.indexOf('async function readEventShellRow'), LOADERS.indexOf('export const loadEventShell = cache('));
  assert.match(stamped, /const \{ held, \.\.\.rest \} = read;\s*if \(rest\.data && held\) \{[\s\S]*?holdEventRow\(row\.event_id, row, slug\)/, 'the row that was read is no longer left in hand');
  assert.match(stamped, /data: withoutOnceExtras\(row\)/, 'the page is handed the extras — its row is no longer the row it always was');
});

// ── 6c · the two invite doors ───────────────────────────────────────────────

/** A column-list constant, read from its own source (`'…'`, or another constant's name). */
function constantIn(rel: string, name: string): string {
  const src = readFileSync(join(WEB, rel), 'utf8');
  const literal = new RegExp(`export const ${name} =\\s*'([^']+)'`).exec(src)?.[1];
  if (literal) return literal;
  const alias = new RegExp(`export const ${name} = ([A-Z_]+);`).exec(src)?.[1];
  assert.ok(alias, `${name} was not found in ${rel} — update this guard`);
  return constantIn('app/[slug]/_lib/hub-look.ts', alias);
}

test('6c · each invite door awaits the one read first, and asks only for columns it carries — so its own read is not sent', () => {
  const constants: Record<string, string> = {
    INVITE_LOOK_COLUMNS: constantIn('app/[slug]/invite/_lib/load-invite-look.ts', 'INVITE_LOOK_COLUMNS'),
    INVITE_MARK_COLUMNS: constantIn('app/[slug]/invite/_lib/load-invite-look.ts', 'INVITE_MARK_COLUMNS'),
    QR_LOOK_COLUMNS_AFTER_INVITE_MARK: constantIn('lib/qr-look.server.ts', 'QR_LOOK_COLUMNS_AFTER_INVITE_MARK'),
  };
  const inHand = new Set<string>([...SHELL_COLUMNS, ...EVENT_ROW_ONCE_EXTRA_COLUMNS]);
  for (const door of ['enter', 'reply']) {
    const src = readFileSync(join(WEB, 'app', '[slug]', 'invite', door, 'page.tsx'), 'utf8');
    const m = /await loadEventShell\(slug\)\.catch\(\(\) => null\);\s*const \{ data: liveEvent, error: eventError \} = await eventRowOnceBySlug\(admin, slug, \(\) =>\s*admin\s*\.from\('events'\)\s*\.select\(\s*(?:\/\/[^\n]*\n\s*)*`([^`]*)`,?\s*\)\s*(?:\/\/[^\n]*\n\s*)*\.ilike\('slug', slug\)\s*\.maybeSingle\(\),\s*\);/.exec(src);
    assert.ok(m, `invite/${door}: the door no longer awaits the one read and then asks the held row — update this guard, do not delete it`);
    const columns = (m[1] ?? '').replace(/\$\{(\w+)\}/g, (_, name: string) => {
      assert.ok(constants[name], `invite/${door}: unknown column constant ${name} — add it to this guard`);
      return constants[name];
    });
    for (const column of columns.split(',').map((c) => c.trim())) {
      assert.ok(
        inHand.has(column),
        `invite/${door} asks for events.${column}, which the one read does not carry — its own read is sent on every view (a second read of the row). Add the column to EVENT_ROW_ONCE_EXTRA_COLUMNS, or drop it here.`,
      );
    }
  }
});

test('7 · the page’s own row carries none of the extras, and keeps its own columns in their order', () => {
  const whole: Record<string, unknown> = { event_id: EVENT, slug: 'maria-and-jose', gifts_on: true };
  for (const column of EVENT_ROW_ONCE_EXTRA_COLUMNS) whole[column] = 'extra';
  whole.date_candidates = null;
  assert.deepEqual(Object.keys(withoutOnceExtras(whole)), ['event_id', 'slug', 'gifts_on', 'date_candidates']);
  assert.equal('rsvp_backdrop' in withoutOnceExtras(whole), false, 'a guest’s row would read as a host’s drafted backdrop (`loadLiveLayer`)');
});

// ── 8–10 · 👤 the couple's dashboard: the row, once, as the viewer ─────────

/** A session client that answers `events` with `answer` and counts what it sent. */
function viewerClient(answer: (url: URL) => Response) {
  const sent: URL[] = [];
  const client = createClient('http://db.test', 'test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        sent.push(url);
        return answer(url);
      }) as typeof fetch,
    },
  });
  return { client, sent };
}
const asJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const rowFor = (url: URL) => Object.fromEntries((url.searchParams.get('select') ?? '').split(',').map((c) => [c.trim(), `db:${c.trim()}`]));

test('8 · inside a render, ONE read as the viewer answers every asker of that client — exactly its columns, as copies', async () => {
  await withEventRowScopeForTest(async () => {
    const { client, sent } = viewerClient((url) => asJson([rowFor(url)]));
    openDashboardEventRow(client, EVENT);
    openDashboardEventRow(client, EVENT); // idempotent: still one read
    const own = (cols: string) => () => client.from('events').select(cols).eq('event_id', EVENT).maybeSingle();
    const a = await eventRowOnce(client, EVENT, 'role_names', own('role_names'));
    const b = await eventRowOnce(client, EVENT, 'event_date, event_end_date, event_date_precision', own('event_date, event_end_date, event_date_precision'));
    assert.deepEqual(a.data, { role_names: 'db:role_names' });
    assert.deepEqual(b.data, { event_date: 'db:event_date', event_end_date: 'db:event_end_date', event_date_precision: 'db:event_date_precision' });
    assert.equal(sent.length, 1, `the row was read ${sent.length} times for one viewer in one render`);
    assert.equal(sent[0]!.searchParams.get('event_id'), `eq.${EVENT}`);
    assert.deepEqual((sent[0]!.searchParams.get('select') ?? '').split(','), [...DASHBOARD_ROW_CARRIES], 'the one read is not the dashboard columns');
    // A column the one read does not carry → that asker's own read.
    await eventRowOnce(client, EVENT, 'estimated_budget_centavos', own('estimated_budget_centavos'));
    assert.equal(sent.length, 2, 'a column the one read does not carry was answered from it');
    // Another event → its own read.
    await eventRowOnce(client, 'another-event', 'role_names', () => client.from('events').select('role_names').eq('event_id', 'another-event').maybeSingle());
    assert.equal(sent.length, 3, 'another event was answered from this one’s row');
  });
});

test('8b · never across authorities: another viewer, and the service role, each send their own read', async () => {
  await withEventRowScopeForTest(async () => {
    const one = viewerClient((url) => asJson([rowFor(url)]));
    const two = viewerClient((url) => asJson([rowFor(url)]));
    openDashboardEventRow(one.client, EVENT);
    await eventRowOnce(two.client, EVENT, 'role_names', () => two.client.from('events').select('role_names').eq('event_id', EVENT).maybeSingle());
    assert.equal(two.sent.length, 1, 'a second viewer was handed the first viewer’s row');
    const admin = viewerClient((url) => asJson([rowFor(url)]));
    markServiceRoleClient(admin.client);
    openDashboardEventRow(admin.client, EVENT); // a no-op for the service role
    assert.equal(admin.sent.length, 0, 'the service role opened a viewer’s row');
    await eventRowOnce(admin.client, EVENT, 'role_names', () => admin.client.from('events').select('role_names').eq('event_id', EVENT).maybeSingle());
    assert.equal(admin.sent.length, 1, 'the service role was answered from a row read under a viewer’s RLS');
  });
  // …and outside a render nothing is opened or sent at all.
  const out = viewerClient((url) => asJson([rowFor(url)]));
  openDashboardEventRow(out.client, EVENT);
  assert.equal(out.sent.length, 0, 'outside a render the one read was sent for nobody to keep');
  await eventRowOnce(out.client, EVENT, 'role_names', () => out.client.from('events').select('role_names').eq('event_id', EVENT).maybeSingle());
  assert.equal(out.sent.length, 1);
});

test('9 · the one read REFUSED → every asker sends its own read and keeps its own failure; no row is an answer only from a success', async () => {
  await withEventRowScopeForTest(async () => {
    // The one (wide) read is refused; each asker's own small read answers as the database would.
    const { client, sent } = viewerClient((url) =>
      (url.searchParams.get('select') ?? '').split(',').length > 10
        ? asJson({ code: '42703', message: 'column events.a_new_column does not exist' }, 400)
        : url.searchParams.get('select') === 'role_names'
          ? asJson({ code: '42501', message: 'permission denied' }, 403)
          : asJson([rowFor(url)]),
    );
    openDashboardEventRow(client, EVENT);
    const refused = await eventRowOnce(client, EVENT, 'role_names', () => client.from('events').select('role_names').eq('event_id', EVENT).maybeSingle());
    assert.equal(refused.data, null);
    assert.equal(refused.error?.code, '42501', 'the asker’s own failure was replaced — a refusal must stay a refusal');
    const fine = await eventRowOnce(client, EVENT, 'event_date', () => client.from('events').select('event_date').eq('event_id', EVENT).maybeSingle());
    assert.deepEqual(fine.data, { event_date: 'db:event_date' });
    assert.equal(sent.length, 3, 'the askers did not each read for themselves after the one read was refused');
  });
  await withEventRowScopeForTest(async () => {
    // The one read SUCCEEDED with no row (RLS: not theirs) → every asker is told "no row", as its own read would.
    const { client, sent } = viewerClient(() => asJson([]));
    openDashboardEventRow(client, EVENT);
    const none = await eventRowOnce(client, EVENT, 'role_names', () => client.from('events').select('role_names').eq('event_id', EVENT).maybeSingle());
    assert.equal(none.data, null);
    assert.equal(none.error, null);
    assert.equal(sent.length, 1);
  });
  await withEventRowScopeForTest(async () => {
    // The one read never answered (the network) → own reads, never "no row".
    let first = true;
    const { client, sent } = viewerClient((url) => {
      if (first) {
        first = false;
        throw new TypeError('fetch failed');
      }
      return asJson([rowFor(url)]);
    });
    openDashboardEventRow(client, EVENT);
    const got = await eventRowOnce(client, EVENT, 'role_names', () => client.from('events').select('role_names').eq('event_id', EVENT).maybeSingle());
    assert.deepEqual(got.data, { role_names: 'db:role_names' }, 'a read that never answered was handed out as an answer');
    assert.ok(sent.length >= 2);
  });
});

test('10 · every dashboard column is a production column the signed-in couple may read — never a host-only private one', () => {
  const snapshot = readFileSync(join(ROOT, 'supabase', 'security', 'prod-schema.snapshot.txt'), 'utf8');
  const inProd = new Set(snapshot.split('\n').filter((l) => l.startsWith('events.')).map((l) => l.slice('events.'.length).trim()));
  for (const column of DASHBOARD_ROW_CARRIES) {
    assert.ok(inProd.has(column), `events.${column} is not in production's schema snapshot: the one read would be refused on EVERY view and every asker would read for itself — a request added, not saved`);
  }
  // The private columns: SELECT is revoked from `authenticated` on the base table (the lockdown's
  // `private_columns`, restated in full by each later lockdown migration — read the newest one).
  const migrations = readdirSync(join(ROOT, 'supabase', 'migrations')).sort();
  const lockdowns = migrations.filter((f) => /private_columns\s+TEXT\[\]\s*:=/i.test(readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8')));
  assert.ok(lockdowns.length > 0, 'no lockdown migration was found — this guard is blind');
  const privateColumns = new Set<string>();
  for (const f of lockdowns) {
    const sql = readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8');
    const list = /private_columns\s+TEXT\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i.exec(sql)?.[1] ?? '';
    for (const m of list.matchAll(/'([a-z_0-9]+)'/g)) privateColumns.add(m[1]!);
  }
  assert.ok(privateColumns.has('estimated_budget_centavos'), 'the private column list was not read — this guard is blind');
  for (const column of DASHBOARD_ROW_CARRIES) {
    assert.ok(!privateColumns.has(column), `events.${column} is host-only (not granted on events): the one read would be refused on every view`);
  }
  assert.equal(new Set(DASHBOARD_ROW_CARRIES).size, DASHBOARD_ROW_CARRIES.length, 'a dashboard column is listed twice');
});

test('10b · every dashboard asker names only columns the one read carries — or it quietly sends its own read on every view', () => {
  const DASHBOARD_LIBS = ['lib/event-viewer.server.ts', 'lib/event-needs-read.server.ts', 'lib/pax.ts', 'lib/role-names.server.ts'];
  const carried = new Set<string>(DASHBOARD_ROW_CARRIES);
  const sites = callSites().filter(({ file }) => file.startsWith('app/dashboard/') || DASHBOARD_LIBS.includes(file));
  assert.ok(sites.length >= 10, `only ${sites.length} dashboard askers were found — the scan is not seeing them`);
  for (const { file, call } of sites) {
    const named = /^eventRowOnce\(\s*[\w.]+,\s*[\w.]+,\s*('[^']*'|[A-Z_]+),/.exec(call)?.[1] ?? '';
    let columns = named.startsWith("'") ? named.slice(1, -1) : '';
    if (!columns) {
      const src = readFileSync(join(WEB, file), 'utf8');
      columns = new RegExp(`const ${named} =\\s*'([^']+)'`).exec(src)?.[1] ?? '';
      assert.ok(columns, `${file}: the column constant ${named} was not found — update this guard`);
    }
    for (const c of columns.split(',').map((x) => x.trim())) {
      assert.ok(carried.has(c), `${file} asks the dashboard's row for events.${c}, which DASHBOARD_ROW_CARRIES does not carry — add it (a granted, non-private column) or the asker reads for itself`);
    }
  }
});
