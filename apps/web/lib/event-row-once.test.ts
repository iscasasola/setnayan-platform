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
import {
  EVENT_ROW_ONCE_EXTRA_COLUMNS,
  eventRowOnce,
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
    const [, client, id, columns, read] = m;
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
  const one = LOADERS.slice(start, LOADERS.indexOf('export const loadEventShell = cache('));
  assert.ok(start > -1 && one.length > 200, 'theOneEventRead is gone or renamed — update this guard');
  assert.match(one, /if \(whole\.error\) return whole\.error\.code === '42703' \? await read\(columns\) : whole;/, 'the fallback is gone, or now retries on any failure');
  assert.match(one, /holdEventRow\(row\.event_id, row\)/, 'the row that was read is no longer left in hand');
  assert.match(one, /data: withoutOnceExtras\(row\)/, 'the page is handed the extras — its row is no longer the row it always was');
});

test('7 · the page’s own row carries none of the extras, and keeps its own columns in their order', () => {
  const whole: Record<string, unknown> = { event_id: EVENT, slug: 'maria-and-jose', gifts_on: true };
  for (const column of EVENT_ROW_ONCE_EXTRA_COLUMNS) whole[column] = 'extra';
  whole.date_candidates = null;
  assert.deepEqual(Object.keys(withoutOnceExtras(whole)), ['event_id', 'slug', 'gifts_on', 'date_candidates']);
  assert.equal('rsvp_backdrop' in withoutOnceExtras(whole), false, 'a guest’s row would read as a host’s drafted backdrop (`loadLiveLayer`)');
});
