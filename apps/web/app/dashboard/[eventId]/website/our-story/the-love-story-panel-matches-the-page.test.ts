/**
 * the-love-story-panel-matches-the-page.test.ts — owner 2026-09-27, looking at
 * Maker → Love Story: *"align this to what I see on the editing part."*
 *
 * The page (the scrapbook, `love-story-book.tsx`) groups moments into five
 * chapters. The Maker's panel beside it used a DIFFERENT set of headings (The
 * beginning · The spark · The almost · The yes · The little things · Your
 * timeline) and a "Written" chip while the page said "0 moments". This proves,
 * from what each one RENDERS:
 *
 *   1. the panel's chapters are the page's chapters — same names, same order;
 *   2. each moment sits under the chapter the page puts it in, and each chapter
 *      has its own "Add a moment" (or the cap line once five are told);
 *   3. the panel is NOT a second editor: it holds no form of its own, and its
 *      buttons only ask the page (`love-story-open.ts`) — an ask the page's
 *      sheet answers;
 *   4. the words form still posts EVERY field `updateOurStory` reads;
 *   5. the chip counts what the page counts.
 *
 * 🪤 `globalThis.React` before the dynamic imports (tsx → classic runtime).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const noop = () => {};
type M = { id: string; date?: { y: number }; line: string; anchor?: 'met' | 'yes'; canvas: object };
const STORY_MOMENTS: M[] = [
  { id: 'm-dog', date: { y: 2012 }, line: 'The dog, before either of us', canvas: {} },
  { id: 'm-met', date: { y: 2018 }, line: 'A jeepney in the rain', anchor: 'met', canvas: {} },
  { id: 'm-trip', date: { y: 2020 }, line: 'Our first trip', canvas: {} },
  { id: 'm-yes', date: { y: 2024 }, line: 'The ridge at sunrise', anchor: 'yes', canvas: {} },
];

async function paintPanel(story: Record<string, unknown>, ownsPro = false): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LoveStoryChaptersPanel } = await import('./_components/love-story-chapters-panel');
  return renderToStaticMarkup(React.createElement(LoveStoryChaptersPanel, { story, ownsPro }));
}

async function paintBook(moments: M[]): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LoveStoryBook } = await import('./_components/love-story-book');
  return renderToStaticMarkup(
    React.createElement(LoveStoryBook, {
      eventId: 'E1',
      names: 'Ana & Ben',
      partners: ['Ana', 'Ben'],
      eyebrow: '14 Feb 2027',
      moments: moments as never,
      since: 2012,
      daysToTheDay: 100,
      themeName: 'Vintage',
      motionLabel: 'Calm',
      makerHref: '/dashboard/E1/launch',
      guestHref: null,
      ownsPro: false,
      storeShell: false,
      proHref: '/pro',
      proPrice: null,
      refused: null,
      sectionHidden: false,
      mediaUrls: {},
      action: noop,
      pickSlot: null,
    }),
  );
}

/** The chapter ids a render carries, in document order. */
const chaptersOf = (html: string, attr: string) => [...html.matchAll(new RegExp(`${attr}="([a-z]+)"`, 'g'))].map((m) => m[1]);
/** The chapter a moment button sits under (the last panel chapter opened before it). */
function panelChapterOf(html: string, momentId: string): string | null {
  const at = html.indexOf(`data-panel-moment="${momentId}"`);
  if (at < 0) return null;
  const before = [...html.slice(0, at).matchAll(/data-love-story-panel-chapter="([a-z]+)"/g)];
  return before.length ? before[before.length - 1]![1]! : null;
}
function bookChapterOf(html: string, momentId: string): string | null {
  const at = html.indexOf(`data-moment="${momentId}"`);
  if (at < 0) return null;
  const before = [...html.slice(0, at).matchAll(/data-love-story-chapter="([a-z]+)"/g)];
  return before.length ? before[before.length - 1]![1]! : null;
}

test('📖 the panel lists the page’s chapters — same names, same order', async () => {
  const { LOVE_STORY_CHAPTER_LABEL } = await import('@/lib/love-story-moments');
  const panel = await paintPanel({ moments: STORY_MOMENTS });
  const book = await paintBook(STORY_MOMENTS);
  const panelChapters = chaptersOf(panel, 'data-love-story-panel-chapter');
  const bookChapters = chaptersOf(book, 'data-love-story-chapter');
  assert.deepEqual(panelChapters, ['before', 'met', 'falling', 'yes', 'toward']);
  assert.deepEqual(panelChapters, bookChapters, 'the panel and the page list the same chapters in the same order');
  for (const c of panelChapters) {
    const label = LOVE_STORY_CHAPTER_LABEL[c as keyof typeof LOVE_STORY_CHAPTER_LABEL];
    assert.match(panel, new RegExp(`<h3[^>]*>${label}</h3>`), `the panel names “${label}”`);
    assert.match(book, new RegExp(`<h2[^>]*>${label}</h2>`), `the page names “${label}”`);
  }
  for (const retired of ['The beginning', 'The spark', 'The almost']) {
    assert.doesNotMatch(panel, new RegExp(`>${retired}<`), `the retired heading “${retired}” is gone`);
  }
});

test('🧷 each moment sits under the chapter the page puts it in, and each chapter can add', async () => {
  const panel = await paintPanel({ moments: STORY_MOMENTS });
  const book = await paintBook(STORY_MOMENTS);
  for (const m of STORY_MOMENTS) {
    const inPanel = panelChapterOf(panel, m.id);
    assert.ok(inPanel, `${m.id} is listed in the panel`);
    assert.equal(inPanel, bookChapterOf(book, m.id), `${m.id}: panel chapter = page chapter`);
  }
  assert.deepEqual(chaptersOf(panel, 'data-panel-add'), ['before', 'met', 'falling', 'yes', 'toward']);
  // Five told, free: every chapter says so instead of offering a sixth.
  const five = [...STORY_MOMENTS, { id: 'm-five', date: { y: 2025 }, line: 'The fitting', canvas: {} }];
  const capped = await paintPanel({ moments: five });
  assert.equal(chaptersOf(capped, 'data-panel-add').length, 0);
  assert.equal((capped.match(/5 of 5 free stories told/g) ?? []).length, 5);
  assert.equal(chaptersOf(await paintPanel({ moments: five }, true), 'data-panel-add').length, 5, 'Pro may add past five');
});

test('🚫 not a second editor: no form of its own, and every button only asks the page', async () => {
  const panel = await paintPanel({ moments: STORY_MOMENTS });
  assert.doesNotMatch(panel, /<form\b/, 'the panel renders inside the words form — a nested form is invalid');
  const buttons = [...panel.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(buttons.length >= STORY_MOMENTS.length + 5);
  for (const b of buttons) {
    if (/data-panel-(moment|add)=/.test(b)) assert.match(b, /type="button"/, `${b} must not submit the words form`);
  }
  // The page answers the ask with its OWN sheet: one Edit sheet per moment, and
  // exactly one add sheet (the foot's), keyed the way the panel asks.
  const book = readFileSync(join(HERE, '_components', 'love-story-book.tsx'), 'utf8');
  assert.match(book, /moment=\{m\}\s+opensFor=\{m\.id\}/);
  assert.equal((book.match(/addButton\('add'\)/g) ?? []).length, 1);
  assert.equal((book.match(/addButton\(\)/g) ?? []).length, 1);
});

test('🧭 an ask is answered only by a sheet that hears it; unheard asks wait for the page', async () => {
  const g = globalThis as unknown as { window?: unknown };
  const had = 'window' in g;
  const prior = g.window;
  g.window = new EventTarget();
  try {
    const { askThePageToOpen, LOVE_STORY_OPEN_EVENT, queueOpen, takeQueuedOpen } = await import(
      './_components/love-story-open'
    );
    assert.equal(askThePageToOpen({ target: 'm-met' }), false, 'nothing mounted — the panel must know');
    const heard: string[] = [];
    const sheet = (e: Event) => {
      const ask = (e as CustomEvent<{ target: string; chapter?: string }>).detail;
      if (ask.target !== 'add') return;
      e.preventDefault();
      heard.push(ask.chapter ?? '');
    };
    (g.window as EventTarget).addEventListener(LOVE_STORY_OPEN_EVENT, sheet);
    assert.equal(askThePageToOpen({ target: 'm-met' }), false, 'a sheet for another target does not answer');
    assert.equal(askThePageToOpen({ target: 'add', chapter: 'yes' }), true);
    assert.deepEqual(heard, ['yes']);
    queueOpen({ target: 'm-trip' });
    assert.equal(takeQueuedOpen('m-dog'), null, 'another sheet does not take it');
    assert.deepEqual(takeQueuedOpen('m-trip'), { target: 'm-trip' });
    assert.equal(takeQueuedOpen('m-trip'), null, 'taken once');
  } finally {
    if (had) g.window = prior;
    else delete g.window;
  }
});

test('📝 the words form still posts every field updateOurStory reads', async () => {
  // The fields `updateOurStory` reads are `lib/love-story-words.ts`'s lists —
  // the ONE reading it shares with the Maker's instant words panel (2026-09-30).
  const src = readFileSync(join(HERE, 'actions.ts'), 'utf8');
  assert.match(src, /mergeStoryWords\(base, formData\)/, 'updateOurStory no longer reads the words through the shared lists');
  const W = await import('../../../../../lib/love-story-words');
  const anchors = W.STORY_ANCHOR_KEYS.map((k) => `anchor_${k}`);
  const read = [...W.STORY_TEXT_FIELDS, ...W.STORY_SHORT_FIELDS, ...W.STORY_YEAR_FIELDS, ...anchors, 'ms_year', 'ms_title'];
  assert.ok(read.length >= 17);
  const panel = await paintPanel({ moments: STORY_MOMENTS, how_we_met: 'x' });
  const posted = new Set([...panel.matchAll(/\bname="([a-z_]+)"/g)].map((m) => m[1]));
  for (const f of read) assert.ok(posted.has(f), `the panel must post “${f}” or a save would blank it`);
});

test('🏷 the chip counts what the page counts — never “Written” for an empty story', async () => {
  const { loveStoryRowStatus } = await import('./_components/love-story-status');
  assert.deepEqual(loveStoryRowStatus({}), { label: 'Not started', filled: false });
  assert.deepEqual(loveStoryRowStatus({ moments: [] }), { label: 'Not started', filled: false });
  assert.deepEqual(
    loveStoryRowStatus({ how_we_met: '', spark: '  ', anchors: { song: '' }, milestones: [] }),
    { label: 'Not started', filled: false },
    'a save of blank answers is not a story',
  );
  assert.deepEqual(loveStoryRowStatus({ moments: STORY_MOMENTS }), { label: '4 moments', filled: true });
  assert.deepEqual(loveStoryRowStatus({ how_we_met: 'A jeepney' }), { label: '1 moment', filled: true }, 'seeded, as the page seeds');
  assert.deepEqual(loveStoryRowStatus({ moments: [], spark_why: 'Her laugh' }), { label: 'Words only', filled: true });
  const page = readFileSync(join(HERE, '..', 'editor', 'page.tsx'), 'utf8');
  const row = page.slice(page.indexOf("key: 'story'"), page.indexOf('<StoryPanel'));
  assert.match(row, /status: loveStoryRowStatus\(story\)/, 'the Story row asks the one counter');
  assert.doesNotMatch(row, /status: (done|todo)\(/, 'no hand-typed chip for this row');
});
