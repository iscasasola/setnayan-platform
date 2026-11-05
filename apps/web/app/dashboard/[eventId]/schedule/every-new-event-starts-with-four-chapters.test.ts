/**
 * every-new-event-starts-with-four-chapters.test.ts — 📖 the four default chapters, swipe left to delete with Undo, and
 * chapters that may overlap (owner 2026-11-03, DECISION_LOG "EVERY EVENT IS BUILT FROM PREBUILT PARTS" · "ALL FOUR
 * PREBUILT PARTS ARE DEFAULT PUBLIC CHAPTERS" · "SWIPE LEFT TO DELETE ON EVERY LIST ROW"; approved prototype
 * "Event chapters — 4 Nov 2026", frames 1, 3, 4 and 10).
 *
 *   1 · a new wedding's day is Prep · Ceremony · Cocktail + Reception · After Party, every one PUBLIC, After Party on
 *       (no end — "onward"), each holding the SHIPPED template's moments (built from `buildScheduleSeed`, never a
 *       second list); a dance-free rite keeps the shipped rule (no cocktail hour, no After Party);
 *   2 · the page seeds them once, through the one fail-soft seed, only for someone who may write the schedule; the
 *       marker that says "this event is new" is claimed BEFORE anything is written (the database half:
 *       tests/db/every-new-event-starts-with-four-chapters.db.test.ts);
 *   3 · a chapter swipes left with the SHARED gesture; the swipe only ASKS (the one warning); the delete is gone at once
 *       with an Undo and the one removal is sent only when the Undo window closes;
 *   4 · chapters MAY overlap — nothing warns between two chapters; a flag is only the same person in two places.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { DEFAULT_CHAPTERS_TELL, DEFAULT_CHAPTER_LABELS, buildDefaultChapters, buildScheduleSeed, defaultChaptersUnfilled } from '@/lib/schedule';
import { chapterWindowFlags, clashesForMoment } from '@/lib/schedule-chapters';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const web = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

const DAY = '2099-12-18';

test('1 · four public chapters, After Party onward, the shipped moments inside', () => {
  const { chapters, moments } = buildDefaultChapters('catholic', DAY, { ceremony_type: 'catholic', secondary_ceremony_type: null });
  assert.deepEqual(
    chapters.map((c) => c.label),
    [DEFAULT_CHAPTER_LABELS.prep, DEFAULT_CHAPTER_LABELS.ceremony, DEFAULT_CHAPTER_LABELS.cocktail_reception, DEFAULT_CHAPTER_LABELS.after_party],
  );
  assert.deepEqual(DEFAULT_CHAPTER_LABELS, { prep: 'Prep', ceremony: 'Ceremony', cocktail_reception: 'Cocktail + Reception', after_party: 'After Party' });
  assert.ok(chapters.every((c) => c.is_public), 'a default chapter is hidden from guests');
  assert.ok(chapters.every((c) => c.start_at.startsWith(DAY)), 'a default chapter is not on the event day');
  assert.equal(chapters.find((c) => c.key === 'after_party')!.end_at, null, 'After Party has an end — it runs onward');
  assert.equal(new Set(chapters.map((c) => c.sort_order)).size, chapters.length, 'two chapters share an order key (the seed maps ids by it)');
  // The prototype's hours (frame 1): 7–12 · 1:30–3:30 · 5–10 · 10:30 onward.
  assert.deepEqual(
    chapters.map((c) => [c.start_at.slice(11, 16), c.end_at?.slice(11, 16) ?? null]),
    [['07:00', '12:00'], ['13:30', '15:30'], ['17:00', '22:00'], ['22:30', null]],
  );
  // Every moment sits inside its chapter.
  for (const m of moments) {
    const c = chapters.find((x) => x.key === m.parent_key)!;
    assert.ok(m.start_at >= c.start_at && (!c.end_at || m.end_at <= c.end_at), `${m.label} falls outside ${c.label}`);
  }

  // The moments are the shipped seed's, never a second list.
  const seed = buildScheduleSeed('catholic', DAY, { ceremony_type: 'catholic', secondary_ceremony_type: null }).buildChildren({ ceremony: '', reception: '' });
  const inCeremony = moments.filter((m) => m.parent_key === 'ceremony').map((m) => m.label);
  assert.deepEqual(inCeremony, seed.filter((p) => p.parent_key === 'ceremony').map((p) => p.label));
  assert.ok(inCeremony.includes('Communion'), 'a Catholic ceremony lost its Mass');
  const inReception = moments.filter((m) => m.parent_key === 'cocktail_reception').map((m) => m.label);
  assert.equal(inReception[0], 'Cocktail hour', 'the cocktail hour is not the first moment of Cocktail + Reception');
  assert.deepEqual(inReception.slice(1), seed.filter((p) => p.parent_key === 'reception').map((p) => p.label));
  assert.ok(moments.every((m) => m.is_public === false), 'a seeded moment is shown to guests (the shipped seed keeps parts private)');
  assert.ok(!moments.some((m) => m.parent_key === 'prep' || m.parent_key === 'after_party'), 'Prep or After Party got moments no template has');

  // A civil wedding never gets another faith's liturgy.
  const civil = buildDefaultChapters('civil', DAY, { ceremony_type: 'civil', secondary_ceremony_type: null });
  assert.ok(!civil.moments.some((m) => m.label === 'Communion'), 'a civil wedding was handed a Mass');
});

test('1b · a dance-free rite keeps the shipped rule — no cocktail hour, no After Party', () => {
  const inc = buildDefaultChapters('inc', DAY, { ceremony_type: 'inc', secondary_ceremony_type: null });
  assert.deepEqual(inc.chapters.map((c) => c.label), ['Prep', 'Ceremony', 'Reception']);
  assert.ok(!inc.moments.some((m) => m.block_type === 'cocktails'), 'a dance-free day got a cocktail hour');
  // Read on BOTH rite columns.
  const mixed = buildDefaultChapters('catholic', DAY, { ceremony_type: 'catholic', secondary_ceremony_type: 'inc' });
  assert.ok(!mixed.chapters.some((c) => c.key === 'after_party'), 'a mixed wedding with an INC side got an After Party');
});

test('2 · the page seeds them once, through the one fail-soft seed, for someone who may write', () => {
  const page = code('page.tsx');
  assert.match(
    page,
    /scheduleBlocks\.length === 0 &&\s*\(eventRow\?\.event_type \?\? 'wedding'\) === 'wedding' &&\s*viewerAreaLevel\(viewer, 'schedule'\) === 'edit'\s*\)\s*\{\s*scheduleBlocks = await seedDefaultChapters\(eventId\);/,
    'the Schedule page no longer seeds the default chapters (or seeds them for a viewer who may not write)',
  );
  const seed = web('lib/schedule-seed.server.ts');
  const fn = seed.slice(seed.indexOf('export async function seedDefaultChapters'));
  assert.match(fn, /buildDefaultChapters\(/, 'the seed no longer builds from the shipped template');
  // Claim before write: the marker is deleted (and the claim checked) before the first insert.
  const claim = fn.search(/from\('event_default_chapters_pending'\)\s*\.delete\(\)\s*\.eq\('event_id', eventId\)\s*\.is\('placeholder_day', null\)\s*\.select\(/);
  const write = fn.indexOf('insertScheduleBlocks(');
  assert.ok(claim > 0 && write > claim, 'the seed writes before it claims the marker — two opens could seed twice');
  assert.match(fn, /if \(!claimed \|\| claimed\.length === 0\) return \[\];/, 'an unclaimed marker still seeds');
  assert.match(fn, /event_date_precision === 'day'/, 'the seed writes chapters on a day the event does not have');
  // 📅 No day yet: the placeholder day is STAMPED on the marker (the claim), so the database can move them later.
  assert.match(fn, /\.update\(\{ placeholder_day: placeholder \}\)\.eq\('event_id', eventId\)\.is\('placeholder_day', null\)/, 'an undated event is seeded without stamping its placeholder day');
  assert.match(fn, /buildDefaultChapters\([\s\S]{0,120}?day \?\? placeholder/, 'an undated event is not seeded on the placeholder day');
  assert.doesNotMatch(fn, /revalidatePath/, 'the seed revalidates during a render');
});

test('3 · swipe left only asks; the delete has an Undo; the one removal waits for the window', () => {
  const rail = code('_components/day-rail.tsx');
  assert.match(rail, /from '@\/app\/_components\/swipe-to-delete'/, 'the rail grew its own swipe gesture');
  // 📋 Slice 8: a chapter on the day is a row of the day LIST (`day-list.tsx`) — its swipe still only ASKS.
  assert.match(rail, /onDelete=\{\(id\) => ch\.askDelete\(id\)\}/, 'a swipe on a day chapter does not ask');
  const list = web('app/dashboard/[eventId]/schedule/_components/day-list.tsx');
  assert.match(list, /<SwipeToDelete label=\{\`Delete \$\{r\.chapter\.label\}\`\} onDelete=\{\(close\) => \{ close\(\); onDelete\(r\.id\); \}\}/, 'a day chapter does not swipe with the shared gesture');
  // The Time TBA row uses the ONE shared row (main's `SwipeToDelete`): off for anyone who may not edit, and it asks.
  assert.match(rail, /<SwipeToDelete label=\{`Delete \$\{m\.label\}`\} disabled=\{!\(Boolean\(ch\) && canEdit\)\}/, 'a Time TBA chapter does not swipe');
  assert.match(rail, /onDelete=\{\(close\) => \{ close\(\); ch\?\.askDelete\(m\.block_id\); \}\}/, 'a swipe on a Time TBA chapter does not ask');
  assert.doesNotMatch(rail, /deleteScheduleBlock|doors\.remove/, 'the rail deletes by itself');

  const host = code('_components/chapters-host.tsx');
  // The swipe's warning is the SAME words as the sheet's.
  assert.match(host, /<ChapterDeleteWords c=\{deleteAsk\} suppliers=\{suppliersOn\(deleteAsk\)\} \/>/, 'the swipe warns in words of its own');
  // Undo is a toast action; the removal is sent from ONE place, when the window closes or the page is left.
  assert.match(host, /action=\{\{ label: 'Undo', onPress: \(\) => setPendingDelete\(null\) \}\}/, 'the delete has no Undo');
  assert.equal((host.match(/doors\.remove\(/g) ?? []).length, 1, 'a chapter is removed from more than one place');
  assert.match(host, /commitDelete\.current = \(c: Chapter\) => \{[\s\S]{0,200}?doors\.remove\(c\.block_id\)/, 'the removal is not the window’s commit');
  assert.match(host, /addEventListener\('pagehide', send\)/, 'leaving the page inside the window drops a confirmed delete');
  // The sheet's own Delete chapter goes through the same window.
  assert.match(host, /doors=\{sheetDoors\}/, 'the chapter sheet deletes at once, with no Undo');

  const swipe = web('app/_components/swipe-to-delete.tsx');
  assert.doesNotMatch(swipe, /deleteScheduleBlock|server|fetch\(/, 'the shared swipe deletes by itself — it may only ask');
});

test('3b · the tip shows only while the defaults are unfilled; the warning names who loses their parts', () => {
  const { chapters } = buildDefaultChapters('catholic', DAY, null);
  const rows = chapters.map((c) => ({ label: c.label, location: null as string | null }));
  assert.equal(defaultChaptersUnfilled(rows), true);
  assert.equal(defaultChaptersUnfilled([{ ...rows[0]!, location: 'Seda Vertis North' }, ...rows.slice(1)]), false, 'the tip stays after a venue is set');
  assert.equal(defaultChaptersUnfilled([{ label: 'Despedida', location: null }]), false, 'the tip shows on a schedule the host built');
  assert.equal(defaultChaptersUnfilled([]), false);
  assert.match(DEFAULT_CHAPTERS_TELL, /Your event starts with four chapters\. Fill each one, or swipe one left if you don't have it\./);
  const line = code('_components/schedule-one-line.tsx');
  assert.match(line, /chapters\?\.canEdit && defaultChaptersUnfilled\(chapters\.chapters\)/, 'the tip is not drawn, or is drawn for someone who cannot change the chapters');
  const words = code('_components/chapter-sheets.tsx');
  assert.match(words, /taken off \$\{suppliers\.length === 1 \? 'its' : 'their'\} parts/, 'the warning no longer names the suppliers');
  assert.match(words, /No moments are in it yet, so no photos move/, 'an empty chapter’s warning talks about photos it cannot have');
});

test('4 · chapters may overlap — nothing warns between two chapters', () => {
  // Prep to 2:30 PM while Ceremony starts at 1:30 PM (frame 10): no flag on either.
  const prep = { block_id: 'p', start_at: `${DAY}T07:00:00.000Z`, end_at: `${DAY}T14:30:00.000Z`, egress_minutes_after: null, location: 'Seda', spot: null };
  const ceremony = { block_id: 'c', start_at: `${DAY}T13:30:00.000Z`, end_at: `${DAY}T15:30:00.000Z`, egress_minutes_after: null, location: 'San Vicente', spot: null };
  assert.deepEqual(chapterWindowFlags(prep), []);
  assert.deepEqual(chapterWindowFlags(ceremony), []);
  // A chapter's own flags read the chapter alone — never its neighbours.
  assert.equal(chapterWindowFlags.length, 1, 'a chapter flag now reads other chapters');
  // A clash is the same person or crew in two places; two chapters with nobody on them never clash.
  assert.equal(clashesForMoment('x', [], [], [prep, ceremony], { suppliers: new Map(), guests: new Map(), groups: new Map(), roles: new Map() }).size, 0);
  // And nothing on the page words a chapter-to-chapter overlap.
  for (const f of ['_components/day-rail.tsx', '_components/chapters-host.tsx', '_components/chapter-sheets.tsx']) {
    assert.doesNotMatch(code(f), /chapters? (overlap|intersect)|overlaps? (another|a) chapter/i, `${f} warns between chapters`);
  }
});
