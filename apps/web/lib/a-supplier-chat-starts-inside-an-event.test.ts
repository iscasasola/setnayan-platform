/**
 * A SUPPLIER CHAT STARTS ONLY INSIDE AN EVENT (owner 2026-10-28, verbatim: *"users can only chat a supplier inside an
 * event"*; and *"i want isolation per event"*).
 *
 * There is NO account-level way to start a supplier chat: the account's ✎ offers groups (and, later, connected people —
 * slice C4), never suppliers; a supplier chat is born inside an event — the event's Chats ✎ (that event's suppliers
 * only), its Suppliers page, a supplier's card. One `chat_threads` row per event + supplier; nothing crosses events.
 *
 * What holds it, from the bottom up:
 *   1. THE SCHEMA — `chat_threads.event_id` is NOT NULL and (event_id, vendor_profile_id) is UNIQUE, and no later
 *      migration loosens either. A thread with no event cannot exist.
 *   2. EVERY WRITE in the app names the event — each `.from('chat_threads')` insert/upsert carries `event_id`.
 *   3. THE ACCOUNT SURFACES OPEN NONE — no file under the account, launcher, groups or public trees imports a thread
 *      starter or writes a thread.
 *   4. THE EVENT'S ✎ LISTS THAT EVENT'S SUPPLIERS — the inbox reads `event_vendors` for this `eventId` only, and the
 *      picker opens through the shipped `contactShortlistVendor` with that event.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];

test('the scan read the app (an empty walk is a green lie)', () => {
  assert.ok(SOURCES.length > 2000, `walked only ${SOURCES.length} files`);
});

test('1 · the schema: a thread cannot exist without its event, and one event + supplier is one thread', () => {
  const migDir = join(REPO, 'supabase', 'migrations');
  const migs = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const all = migs.map((f) => readFileSync(join(migDir, f), 'utf8')).join('\n');
  const create = all.match(/CREATE TABLE IF NOT EXISTS public\.chat_threads \(([\s\S]*?)\n\);/);
  assert.ok(create, 'the chat_threads CREATE TABLE was not found');
  assert.match(create[1]!, /event_id\s+UUID NOT NULL REFERENCES public\.events/, 'chat_threads.event_id is not NOT NULL');
  assert.match(create[1]!, /UNIQUE \(event_id, vendor_profile_id\)/, 'one event + supplier is no longer one thread');
  assert.doesNotMatch(
    all,
    /ALTER TABLE[^;]*chat_threads[^;]*ALTER COLUMN\s+event_id\s+DROP NOT NULL/i,
    'a migration lets a supplier thread exist with no event',
  );
});

test('2 · every write to chat_threads names its event', () => {
  let writes = 0;
  const bad: string[] = [];
  for (const f of SOURCES) {
    const s = stripComments(readFileSync(f, 'utf8'));
    for (const m of s.matchAll(/\.from\('chat_threads'\)\s*\.(insert|upsert)\(/g)) {
      writes += 1;
      const window = s.slice(m.index!, m.index! + 600);
      if (!/\bevent_id\b/.test(window)) bad.push(relative(WEB, f));
    }
  }
  assert.ok(writes >= 4, `found only ${writes} thread writes — the scan is not seeing them`);
  assert.deepEqual(bad, [], 'a thread is written without naming its event');
});

test('3 · no account-level surface starts a supplier chat', () => {
  const ACCOUNT_TREES = ['app/dashboard/(account)', 'app/dashboard/(launcher)', 'app/samahan', 'app/(shell)'];
  const STARTERS = /\b(contactShortlistVendor|startThreadByVendorEmail|startServiceInquiry)\b|\.from\('chat_threads'\)\s*\.(insert|upsert)\(/;
  const hits: string[] = [];
  let read = 0;
  for (const f of SOURCES) {
    const rel = relative(WEB, f);
    if (!ACCOUNT_TREES.some((t) => rel.startsWith(t + '/'))) continue;
    read += 1;
    if (STARTERS.test(stripComments(readFileSync(f, 'utf8')))) hits.push(rel);
  }
  assert.ok(read > 50, `read only ${read} account-level files`);
  assert.deepEqual(hits, [], 'an account-level surface can start a supplier chat — it must start inside an event');
});

test("4 · the event's ✎ lists THIS event's suppliers, through the shipped opener", () => {
  const page = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/messages/page.tsx'), 'utf8'));
  const team = page.slice(page.indexOf(".from('event_vendors')"), page.indexOf(".from('event_vendors')") + 200);
  assert.match(team, /\.eq\('event_id', eventId\)/, "the ✎ list is not scoped to this event's suppliers");
  assert.match(page, /<StartThreadPicker eventId=\{eventId\} team=\{team\} variant="rows" \/>/, 'the ✎ sheet is not the event picker');
  const picker = stripComments(
    readFileSync(join(WEB, 'app/dashboard/[eventId]/messages/_components/start-thread-picker.tsx'), 'utf8'),
  );
  assert.match(picker, /contactShortlistVendor\(\{ eventId, vendorId \}\)/, 'the picker no longer opens a thread inside this event');
});
