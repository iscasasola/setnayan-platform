/**
 * ✋📖 THE LOVE STORY KEEPS THE COUPLE'S ORDER AND EACH MOMENT'S TITLE (owner
 * 2026-10-06 DECISION_LOG "STUDIO › SCHEDULE AND LOVE STORY": *"one card per
 * moment — photo · year · title · first line · grip"*; approved 2026-10-07).
 *
 * Holds: nothing moves until the couple drags (no `order` = today's chapter +
 * date order); a drag (`intent=order`) puts every moment where it was dropped;
 * a moment added later follows them; an edit keeps a moment's place and its
 * title; the title is read, capped and drawn for guests; and the Studio cards
 * post ONE `intent=order` through the moment action's own door.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOMENT_TITLE_MAX, loveStoryScenes, readMoment, sortMoments, withMomentOrder, type LoveStoryMoment } from './love-story-moments';
import { applyMomentIntent } from './love-story-moment-intent';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

const story: LoveStoryMoment[] = [
  { id: 'm-yes', date: { y: 2025 }, line: 'She said yes.', anchor: 'yes', canvas: {} },
  { id: 'm-met', date: { y: 2019 }, line: 'We met.', anchor: 'met', canvas: {} },
  { id: 'm-trip', date: { y: 2021 }, line: 'Baguio.', canvas: {} },
];

test('no drag yet: the story reads in its own order, exactly as before', () => {
  assert.deepEqual(sortMoments(story).map((m) => m.id), ['m-met', 'm-trip', 'm-yes']);
});

test('a drag puts every moment where it was dropped; a later one follows', () => {
  const r = applyMomentIntent(story, 'order', fd({ order: 'm-yes,m-trip,m-met' }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(sortMoments(r.after).map((m) => m.id), ['m-yes', 'm-trip', 'm-met']);
  assert.deepEqual(r.after.map((m) => m.order), [0, 2, 1]);
  const later = [...r.after, { id: 'm-new', date: { y: 2018 }, line: 'Before.', canvas: {} } as LoveStoryMoment];
  assert.deepEqual(sortMoments(later).map((m) => m.id), ['m-yes', 'm-trip', 'm-met', 'm-new'], 'an undragged moment follows the dragged ones');
  assert.deepEqual(withMomentOrder(story, ['m-trip', 'nope']).map((m) => m.order), [2, 1, 0], 'unknown ids drop; the rest keep reading order');
  assert.equal(applyMomentIntent(story, 'order', fd({ order: '' })).ok, false, 'an empty order is refused, never a reset');
});

test('an edit keeps the moment’s place and reads its title', () => {
  const ordered = withMomentOrder(story, ['m-trip', 'm-met', 'm-yes']);
  const r = applyMomentIntent(ordered, 'edit', fd({ id: 'm-trip', date_y: '2021', line: 'Baguio, in the rain.', title: '  The   first trip ' }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const m = r.after.find((x) => x.id === 'm-trip')!;
  assert.equal(m.order, 0, 'the edit moved the moment out of the couple’s order');
  assert.equal(m.title, 'The first trip');
  const kept = applyMomentIntent(r.after, 'edit', fd({ id: 'm-trip', date_y: '2021', line: 'Baguio.' }));
  assert.ok(kept.ok && kept.after.find((x) => x.id === 'm-trip')!.title === 'The first trip', 'a form without the title field dropped it');
});

test('the title is read, capped, and reaches the guests’ scenes', () => {
  const m = readMoment({ id: 'm-1', line: 'x', title: 'T'.repeat(200), order: 3 })!;
  assert.equal(m.title!.length, MOMENT_TITLE_MAX);
  assert.equal(m.order, 3);
  assert.equal(readMoment({ id: 'm-2', line: 'x', order: -1 })!.order, undefined, 'a bad order is dropped');
  assert.equal(loveStoryScenes({ moments: [{ id: 'm-1', line: 'x', title: 'Hello' }] })[0]!.title, 'Hello');
  for (const f of ['app/[slug]/_components/our-love-story-widget.tsx', 'app/[slug]/_components/our-love-story-styles.tsx']) {
    assert.match(read(f), /data-love-title=""/, `${f} does not draw the title`);
  }
});

test('the Studio cards post ONE intent=order through the moment door, in the Studio only', () => {
  const book = read('app/dashboard/[eventId]/website/our-story/_components/love-story-book.tsx');
  assert.match(book, /\{p\.studio \? \(\s*<MomentOrderCards/);
  assert.match(book, /<MomentOrderCards[\s\S]{0,200}action=\{p\.action\}/);
  assert.match(read('app/dashboard/[eventId]/website/our-story/_components/moment-order-cards.tsx'), /fd\.set\('intent', 'order'\);\s*fd\.set\('order', next\.join\(','\)\);\s*void action\(fd\);/);
  assert.match(read('app/dashboard/[eventId]/website/our-story/_components/love-story-live.tsx'), /studio=\{studio\}/);
  assert.match(read('app/dashboard/[eventId]/website/our-story/actions.ts'), /const MOMENT_INTENTS = \[[^\]]*'order'/);
  assert.match(read('app/dashboard/[eventId]/website/our-story/_components/moment-sheet.tsx'), /name="title"/);
});
