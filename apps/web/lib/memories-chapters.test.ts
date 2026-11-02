/**
 * 📸 MEMORIES BY CHAPTER — the dropdown, the filter, Add to Chapter's list, and the read's wiring (owner 2026-11-01,
 * DECISION_LOG "A CHAPTER'S PHOTOS: WHO + WHEN; ADD TO OTHER CHAPTERS"). The rules themselves are the database's
 * (`tests/db/memories-by-chapter.db.test.ts`); this holds the two halves a database test cannot see:
 *   1 · the dropdown lists ONLY what the server listed for this viewer (+ All chapters, + Unsorted when there is any);
 *   2 · a photo the server withheld never leaves `readEventMemories`, and a refused chapter read fails CLOSED;
 *   3 · Add to Chapter offers only the chapters the viewer may add to, keeps a shot's own chapter, and asks before
 *       showing a photo to the whole guest list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  ALL_CHAPTERS,
  UNSORTED,
  canAddFrom,
  chapterFilterOptions,
  chapterTargets,
  inChapterFilter,
  validFilter,
  widensTo,
  type MemoriesChapter,
} from './memories-chapters';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ch = (id: string, over: Partial<MemoriesChapter> = {}): MemoriesChapter => ({
  id,
  label: id,
  who: 'chapter',
  listed: true,
  mayAdd: false,
  isIn: false,
  photos: 1,
  ...over,
});
const shot = (inIds: string[], shotIn: string[] = []) => ({ table: 'papic_guest_captures', chapters: { in: inIds, shotIn } });

test('🔒 1 · the dropdown lists ONLY the chapters the server listed for this viewer', () => {
  const opts = chapterFilterOptions(
    [ch('Tasting'), ch('Groom prep', { listed: false, mayAdd: true }), ch('Despedida')],
    [shot(['Tasting'])],
  );
  assert.deepEqual(
    opts.map((o) => o.key),
    [ALL_CHAPTERS, 'Tasting', 'Despedida'],
    'a chapter the server did not list for this viewer was offered in the dropdown',
  );
});

test('1 · Unsorted appears only when something the viewer was given sits in no chapter — never for a Hub file', () => {
  const chapters = [ch('Tasting')];
  assert.ok(!chapterFilterOptions(chapters, [shot(['Tasting'])]).some((o) => o.key === UNSORTED));
  assert.ok(!chapterFilterOptions(chapters, [{ table: 'hub', chapters: null }]).some((o) => o.key === UNSORTED));
  assert.ok(chapterFilterOptions(chapters, [shot([])]).some((o) => o.key === UNSORTED));
});

test('1 · the filter: a chapter shows its photos, Unsorted the rest, and a stale pick falls back to All', () => {
  assert.ok(inChapterFilter(shot(['A', 'B']), 'B'), 'a photo in two chapters shows in both');
  assert.ok(!inChapterFilter(shot(['A']), 'B'));
  assert.ok(inChapterFilter(shot([]), UNSORTED));
  assert.ok(!inChapterFilter({ table: 'hub', chapters: null }, UNSORTED), 'a Hub file is never "Unsorted"');
  assert.ok(inChapterFilter({ table: 'hub', chapters: null }, ALL_CHAPTERS));
  assert.equal(validFilter('gone', [{ key: ALL_CHAPTERS }, { key: 'A' }]), ALL_CHAPTERS);
  assert.equal(validFilter('A', [{ key: ALL_CHAPTERS }, { key: 'A' }]), 'A');
});

test('🔒 2 · a withheld photo never leaves the Memories read, and a refused chapter read fails closed', () => {
  const read = code('lib/event-memories.server.ts');
  assert.match(read, /readMemoriesChapters\(supabase, eventId\)/, 'the Memories read no longer asks the chapter rules');
  assert.match(
    read,
    /photos\.filter\(\(p\) => !chapterFile\(p\) \|\| \(!byChapter\.refused && !byChapter\.withheld\.has\(p\.id\)\)\)/,
    'a photo the viewer sees in no chapter (or every chapter-able photo, on a refused read) is no longer dropped before the page',
  );
  assert.match(read, /photos: status\.refused\.length > 0 \|\| byChapter\.refused/, 'a refused chapter read no longer says "couldn’t load"');
  // The reads run on the viewer's OWN session — the database answers for auth.uid(), never an id this code sends.
  const server = code('lib/memories-chapters.server.ts');
  assert.match(server, /rpc\('papic_memories_chapters', \{ p_event_id: eventId \}\)/);
  assert.match(server, /rpc\('papic_memories_photo_chapters', \{ p_event_id: eventId \}\)/);
  assert.ok(!/createAdminClient|p_user_id/.test(server), 'the chapter read must run as the viewer, never the service role');
  // The page hands the gallery the server's list, and the gallery builds its dropdown from it.
  assert.match(code('app/dashboard/[eventId]/memories/page.tsx'), /chapterList=\{read\.chapterList\}/);
  assert.match(code('app/_components/memories/event-memories-gallery.tsx'), /chapterFilterOptions\(chapterList, items\)/);
});

test('3 · Add to Chapter: only chapters the viewer may add to; the shot’s own chapter stays; wider asks first', () => {
  const chapters = [
    ch('Tasting', { mayAdd: true, isIn: true }),
    ch('Dinner', { mayAdd: true, isIn: true }),
    ch('VIP', { mayAdd: false }),
    ch('Everyone', { mayAdd: true, who: 'everybody' }),
  ];
  const t = chapterTargets(shot(['Tasting'], ['Tasting']), chapters);
  assert.deepEqual(t.options.map((o) => o.key), ['Tasting', 'Dinner', 'Everyone'], 'a chapter the viewer may not add to was offered');
  assert.deepEqual(t.picked, ['Tasting']);
  assert.ok(t.options.find((o) => o.key === 'Tasting')?.disabledNote, 'the chapter it was shot in can be unticked');
  // Who may move it: a host; else one of its chapter's people.
  assert.ok(canAddFrom(shot(['Tasting']), chapters, false));
  assert.ok(!canAddFrom(shot(['VIP']), chapters, false));
  assert.ok(canAddFrom(shot([]), chapters, true), 'a host places an Unsorted photo');
  assert.ok(!canAddFrom(shot([]), chapters, false));
  assert.ok(!canAddFrom({ table: 'vendor_papic_captures', chapters: null }, chapters, true), 'a supplier file cannot sit in a chapter');
  // Wider: into an Everybody chapter from none.
  assert.equal(widensTo(shot(['Tasting']), 'Everyone', chapters)?.id, 'Everyone');
  assert.equal(widensTo(shot(['Everyone']), 'Everyone', chapters), null);
  assert.equal(widensTo(shot(['Tasting']), 'Dinner', chapters), null);
  // The viewer's press is the shipped action's chapter op, which the database decides.
  const action = code('app/dashboard/[eventId]/memories/photo-tag-actions.ts');
  assert.match(action, /input\.op === 'chapter'[\s\S]{0,400}supabase\.rpc\('papic_memories_set_chapter'/);
});
