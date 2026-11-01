/**
 * chapters-are-in-event-settings.test.ts — 📖 the hosts and the coordinator make, change and delete chapters from Home's
 * ⚙ Event Settings, through the Schedule's OWN doors, with no guest-visible change (owner 2026-11-01, corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §8 step 3 "Chapters + Event Settings … No guest change", §12 Step 2).
 *
 * Held here, as properties:
 *   1 · the sheet mounts THE chapters editor once, between the venues and the parents;
 *   2 · it writes only through the Schedule's own actions (no second door, no new server action) and never posts the
 *       guest switch, so a chapter made here is hidden from guests (`createScheduleBlock` shows a block to guests only
 *       when `is_public` is posted "on");
 *   3 · a chapter's save and delete are never a quiet success over an unchanged schedule (RLS answers a refusal with
 *       zero rows): both read back, and say so;
 *   4 · putting a chapter ON the invitation is the hosts' and the coordinator's call — the rule for showing guests
 *       anything (`mayShowToGuests`);
 *   5 · a new start moves its moments with it, in one statement in the database (`move_schedule_chapter`).
 * The database half (who may read and write, the run-of-show shape) is
 * tests/db/a-chapter-holds-moments-and-parallel-tasks.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { EVENT_SETTINGS_ROWS } from '@/lib/people-with-access-href';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

/** The body of `function <name>(…) {…}` in `src`: its parameter list paren-matched, then its body brace-matched. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`function\\s+${name}\\s*\\(`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  let i = src.indexOf('(', at);
  for (let d = 0; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')' && --d === 0) break;
  }
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}

test('1 · the sheet mounts THE chapters editor once, between the venues and the parents', () => {
  const rows = code('event-settings-rows.tsx');
  assert.match(rows, /from '\.\/event-settings-chapters'/, 'the sheet draws its own chapters editor — not THE one');
  assert.equal((rows.match(/<EventSettingsChapters\b/g) ?? []).length, 1, 'the chapters editor is not mounted exactly once');
  const order = ['row="venues"', 'row="chapters"', 'row="parents"'].map((r) => rows.indexOf(r));
  assert.ok(order.every((i) => i >= 0), `a section is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'Chapters is not between the venues and the parents');
  assert.ok((EVENT_SETTINGS_ROWS as readonly string[]).includes('chapters'), 'a link cannot land on the chapters (`?row=chapters`)');
});

test('2 · it writes only through the Schedule’s own doors, and never shows a chapter to guests', () => {
  const ui = code('event-settings-chapters.tsx');
  assert.doesNotMatch(ui, /['"]use server['"]/, 'the chapters editor carries a server action of its own');
  assert.match(ui, /import \{ createScheduleBlock, deleteScheduleBlock, updateScheduleBlock \} from '\.\.\/schedule\/actions'/, 'chapters are written through a second door');
  const doors = body(ui, 'realDoors');
  assert.match(doors, /createScheduleBlock\(/);
  assert.match(doors, /updateScheduleBlock\(/);
  assert.match(doors, /deleteScheduleBlock\(/);
  // The guest switch is never posted from here, so `createScheduleBlock` keeps a new chapter hidden from guests.
  assert.doesNotMatch(ui, /['"]is_public['"]|is_public:\s*['"]|set\(\s*['"]is_public/, 'the chapters editor posts the guest switch');
  assert.doesNotMatch(ui, /is_public:\s*true/, 'a chapter made here is drawn as shown to guests');
  const create = body(code('../schedule/actions.ts'), 'createScheduleBlock');
  assert.match(create, /is_public: formData\.get\('is_public'\) === 'on' &&/, 'a block not asked to be shown is shown to guests');
});

test('3 · a chapter’s save and delete read back, never a quiet success', () => {
  const actions = code('../schedule/actions.ts');
  for (const name of ['updateScheduleBlock', 'deleteScheduleBlock']) {
    const b = body(actions, name);
    assert.match(b, /\.select\('block_id'\)/, `${name} does not read back what it changed`);
    assert.match(b, /\.length === 0\) throw new Error\(NOTHING_CHANGED\)/, `${name} says nothing when nothing changed`);
  }
  // The editor turns a refused door into words, never a tick.
  const ui = code('event-settings-chapters.tsx');
  assert.match(ui, /const ok = \(p: Promise<unknown>\) => p\.then\(\(\) => true, \(\) => false\)/, 'a thrown refusal is not caught as a failure');
  assert.match(ui, /if \(!ok\) return NOT_SAVED;/, 'a refused save is drawn as saved');
});

test('4 · putting a chapter on the invitation is the hosts’ and the coordinator’s call', () => {
  const b = body(code('../schedule/actions.ts'), 'updateScheduleBlock');
  const at = b.indexOf("formData.get('on_invitation')");
  assert.ok(at >= 0, 'updateScheduleBlock no longer reads on_invitation');
  assert.match(b.slice(at, at + 900), /patch\.on_invitation === true && !\(await mayShowToGuests\(supabase, user\.id, eventId\)\)/, 'anyone who may edit the day can put a chapter on the invitation');
});

test('5 · a new start moves its moments with it, in one statement', () => {
  const b = body(code('../schedule/actions.ts'), 'updateScheduleBlock');
  assert.match(b, /formData\.get\('with_moments'\) === '1' && patch\.start_at !== undefined/);
  assert.match(b, /rpc\('move_schedule_chapter'/, 'a chapter’s moments stay behind when it moves');
  const ui = code('event-settings-chapters.tsx');
  assert.match(body(ui, 'ChapterSheet'), /keep\(\{ start_at: local, with_moments: '1' \}/, 'the chapter editor moves a chapter without its moments');
});
