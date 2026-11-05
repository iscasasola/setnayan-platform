/**
 * chapters-live-on-the-schedule.test.ts — 📖 the chapters are made, changed and deleted on the SCHEDULE PAGE, and only
 * there (owner 2026-11-01, DECISION_LOG "CHAPTERS LIVE ON THE SCHEDULE PAGE, NOT EVENT SETTINGS": *"Why is the chapters
 * there? Shouldn't it be in schedules?"*; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3, §12 Step 3).
 *
 * Held here, as properties:
 *   1 · chapters are editable ONLY on the Schedule page: the chapter sheets are mounted by the Schedule's chapter host
 *       alone, the page mounts that host, and a tap on a rail chapter opens its page;
 *   2 · Event Settings has NO Chapters row — not a row, not a link to the Schedule (house rule: no go-edit-elsewhere
 *       links), and a `?row=chapters` link lands nowhere;
 *   3 · a chapter's time can be TBA: it is posted, written and read back as TBA, and every place that draws a chapter
 *       says "Time TBA" — never the 12:00 AM its day is stored at (the database half:
 *       tests/db/a-chapter-time-can-be-tba.db.test.ts);
 *   4 · Delete chapter WARNS before it deletes: the button only asks; the one call that removes is behind Continue;
 *   5 · the writes still go through the Schedule's own doors, read back, and never show a chapter to guests (carried
 *       over from Step 2's guard, which this file replaces).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { EVENT_SETTINGS_ROWS } from '@/lib/people-with-access-href';
import { CHAPTER_FIELDS, TIME_TBA, chapterLine, chapterStage, chapterWhen, chaptersFromBlocks, gapWords, momentSection } from '@/lib/schedule-chapters';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..');
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
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  throw new Error(`${name} never closes`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · chapters are editable only on the Schedule page', () => {
  const SHEETS = /from '[^']*chapter-sheets'|<(?:ChapterSheet|NewChapterSheet)\b/;
  const HOST = /from '[^']*chapters-host'|<ChaptersHost\b/;
  const sheetsAt: string[] = [];
  const hostAt: string[] = [];
  for (const f of walk(APP)) {
    const rel = relative(APP, f);
    if (rel.startsWith('dev/')) continue; // the labs draw the same pieces on fake data
    const src = stripComments(readFileSync(f, 'utf8'));
    if (SHEETS.test(src) && !rel.endsWith('chapter-sheets.tsx')) sheetsAt.push(rel);
    if (HOST.test(src) && !rel.endsWith('chapters-host.tsx')) hostAt.push(rel);
  }
  assert.deepEqual(sheetsAt, ['dashboard/[eventId]/schedule/_components/chapters-host.tsx'], 'a chapter is edited somewhere other than the Schedule page');
  for (const rel of hostAt) {
    assert.ok(rel.startsWith('dashboard/[eventId]/schedule/'), `the chapters' host is mounted outside the Schedule page: ${rel}`);
  }
  // The page mounts the host around its views, and a tap on a rail chapter opens the chapter's page.
  const page = code('page.tsx');
  assert.match(page, /<ChaptersHost eventId=\{eventId\} input=\{input\} dateLine=\{dateLine\}>/, 'the Schedule page does not mount the chapters');
  assert.match(page, /<ChaptersFrame eventId=\{eventId\} input=\{chaptersInput\}/, 'the Schedule page does not hand its views to the chapters');
  const rail = code('_components/day-rail.tsx');
  assert.match(body(rail, 'onMomentClick'), /if \(ch\) return ch\.open\(m\.block_id\);/, 'a tapped chapter on the rail does not open its page');
  assert.match(body(rail, 'openAdd'), /if \(ch\) return ch\.add\(\);/, 'the rail adds a moment where a chapter is asked for');
  // Never in the Maker: Details › Schedule keeps its moment inspector.
  assert.match(rail, /const ch = live \? null : chaptersApi;/, 'the Maker’s Details › Schedule was turned into chapters');
});

test('2 · Event Settings has no Chapters row, and no link to one', () => {
  assert.ok(!(EVENT_SETTINGS_ROWS as readonly string[]).includes('chapters'), 'a link can still land on a chapters row in Event Settings');
  const rows = code('../_components/event-settings-rows.tsx');
  assert.doesNotMatch(rows, /row="chapters"|title="Chapters"|[Cc]hapters?\b/, 'Event Settings still draws chapters');
  assert.doesNotMatch(rows, /\/schedule\b/, 'Event Settings points at the Schedule — no go-edit-elsewhere links');
  const action = code('../_components/open-event-settings.tsx');
  assert.doesNotMatch(action, /readChapters|chapters=/, 'Event Settings still reads the chapters');
});

test('3 · a chapter’s time can be TBA — posted, written, read and said "Time TBA"', () => {
  // Read back: the flag is among the chapter's fields and survives the reader.
  assert.match(CHAPTER_FIELDS, /\btime_tba\b/, 'the chapter reader does not ask for time_tba');
  const [c] = chaptersFromBlocks([{ block_id: 'a', parent_block_id: null, label: 'Send-off', start_at: '2026-12-18T00:00:00.000Z', time_tba: true }]);
  assert.equal(c!.time_tba, true);
  // Said: every chapter line reads "Time TBA", never its stored midnight.
  assert.equal(chapterWhen(c!), TIME_TBA);
  assert.equal(chapterLine(c!), `${TIME_TBA} · Venue TBA`);
  assert.equal(chapterWhen({ ...c!, time_tba: false, start_at: '2026-12-18T13:30:00.000Z', end_at: '2026-12-18T15:30:00.000Z' }), '1:30 PM – 3:30 PM');
  // Posted: a blank Starts creates a TBA chapter, and ✕ on Starts makes one TBA.
  const sheets = code('_components/chapter-sheets.tsx');
  assert.match(body(sheets, 'realChapterDoors'), /\.\.\.\(tba \? \{ time_tba: '1' \} : \{\}\)/, 'a chapter with no time is not posted as TBA');
  assert.match(body(sheets, 'NewChapterSheet'), /time === '' \|\|/, 'a new chapter cannot be made without a time');
  assert.match(body(sheets, 'ChapterSheet'), /\{ start_at: local, time_tba: '1' \}/, 'clearing a chapter’s start does not make it TBA');
  // Written: both doors take it, a TBA chapter is never shown to guests, and has no end.
  const actions = code('actions.ts');
  const create = body(actions, 'createScheduleBlock');
  assert.match(create, /if \(formData\.get\('time_tba'\) === '1'\) \{[\s\S]{0,200}?insertRow\.time_tba = true;[\s\S]{0,60}?insertRow\.end_at = null;[\s\S]{0,60}?insertRow\.is_public = false;/, 'createScheduleBlock does not save a TBA chapter');
  const update = body(actions, 'updateScheduleBlock');
  assert.match(update, /patch\.time_tba = tbaRaw === '1'/, 'updateScheduleBlock does not save TBA');
  assert.match(update, /if \(patch\.time_tba\) \{[\s\S]{0,240}?patch\.is_public = false;/, 'a chapter made TBA can stay shown to guests');
  // Drawn: never on the rail at a guessed hour — listed under it as "Time TBA".
  const rail = code('_components/day-rail.tsx');
  assert.match(rail, /topLevel\.filter\(\(m\) => !m\.time_tba && chapterStage\(m, ch\.eventDay\) === 'day'\)/, 'a TBA chapter is drawn on the rail');
  assert.match(rail, /data-chapter-tba=\{m\.block_id\}[\s\S]{0,400}?\{TIME_TBA\}/, 'a TBA chapter is not listed as "Time TBA"');
});

test('4 · Delete chapter warns before it deletes', () => {
  const sheet = body(code('_components/chapter-sheets.tsx'), 'ChapterSheet');
  // The button only asks.
  assert.match(sheet, /label="Delete chapter" onClick=\{\(\) => setStage\('ask'\)\}/, 'Delete chapter does not ask first');
  // The one call that removes sits behind Continue, which is drawn only once the warning is.
  const removes = sheet.match(/doors\.remove\(/g) ?? [];
  assert.equal(removes.length, 1, 'a chapter can be removed from more than one place');
  const continueAt = sheet.indexOf('label="Continue"');
  const removeAt = sheet.indexOf('doors.remove(');
  const warnAt = sheet.indexOf('<ChapterDeleteWords c={c}');
  assert.ok(warnAt > 0 && continueAt > warnAt && removeAt > continueAt, 'the chapter is removed without the warning and Continue');
  assert.match(sheet, /\? \(\s*<>[\s\S]*?\) : \(\s*<div data-chapter-delete=\{stage\}/, 'the warning is not its own stage');
  // The warning says what goes and what stays — ONE warning, read by the sheet and by a swipe on the rail (2026-11-03).
  const words = body(code('_components/chapter-sheets.tsx'), 'ChapterDeleteWords');
  assert.match(words, /c\.moments > 0 \? ` and its \$\{c\.moments\} moment/, 'the warning does not name the moments');
  assert.match(words, /Its photos stay safe in Memories,\s+under Unsorted/, 'the warning does not say the photos stay');
  // 🗑 Since 2026-11-03 a delete has an Undo (prototype frame 4) — the warning says so, never "cannot be undone".
  assert.match(words, /You can undo it/, 'the warning does not say it can be undone');
  assert.doesNotMatch(words, /cannot be\s+undone/, 'the warning still says it cannot be undone');
  assert.match(sheet, /setStage\('deleting'\);\s*const ok = await doors\.remove\(c\.block_id\);/, 'there is no deleting state');
});

test('5 · the Schedule’s own doors, read back, never a chapter shown to guests', () => {
  const sheets = code('_components/chapter-sheets.tsx');
  assert.doesNotMatch(sheets, /['"]use server['"]/, 'the chapter sheets carry a server action of their own');
  assert.match(sheets, /import \{ createScheduleBlock, deleteScheduleBlock, updateScheduleBlock \} from '\.\.\/actions'/, 'chapters are written through a second door');
  assert.doesNotMatch(sheets, /['"]is_public['"]|is_public:\s*['"]|set\(\s*['"]is_public/, 'the chapter sheets post the guest switch');
  assert.match(sheets, /const ok = \(p: Promise<unknown>\) => p\.then\(\(\) => true, \(\) => false\)/, 'a thrown refusal is not caught as a failure');
  assert.match(sheets, /if \(!ok\) return NOT_SAVED;/, 'a refused save is drawn as saved');
  const actions = code('actions.ts');
  for (const name of ['updateScheduleBlock', 'deleteScheduleBlock']) {
    assert.match(body(actions, name), /\.length === 0\) throw new Error\(NOTHING_CHANGED\)/, `${name} says nothing when nothing changed`);
  }
  assert.match(body(actions, 'createScheduleBlock'), /is_public: formData\.get\('is_public'\) === 'on' &&/, 'a block not asked to be shown is shown to guests');
});

test('the pure pieces: where a chapter lives, the time between, a moment’s section', () => {
  assert.equal(chapterStage({ start_at: '2026-12-05T15:00:00.000Z' }, '2026-12-18'), 'planning');
  assert.equal(chapterStage({ start_at: '2026-12-18T06:00:00.000Z' }, '2026-12-18'), 'day');
  assert.equal(chapterStage({ start_at: '2026-12-05T15:00:00.000Z' }, null), 'day', 'an undated event hides a chapter');
  assert.equal(gapWords(90), '1h 30m');
  assert.equal(gapWords(120), '2h');
  assert.equal(gapWords(45), '45m');
  const c = { start_at: '2026-12-18T18:00:00.000Z', end_at: '2026-12-18T23:00:00.000Z', time_tba: false };
  assert.equal(momentSection('2026-12-18T12:00:00.000Z', c), 'Ingress');
  assert.equal(momentSection('2026-12-18T19:00:00.000Z', c), 'Event');
  assert.equal(momentSection('2026-12-18T23:30:00.000Z', c), 'Egress');
});
