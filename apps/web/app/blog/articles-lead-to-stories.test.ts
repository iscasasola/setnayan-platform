/**
 * ARTICLES LEAD TO STORIES (owner 2026-10-23).
 *
 * Real events are the post-event editorials, and their one home is
 * `/realstories` ("Stories"). The blog's own "Real Weddings" category was
 * removed for that reason, so the Articles must carry the way there instead:
 * a card on the `/blog` index and a link at the foot of every article.
 * `/realstories` already shows articles on its one shelf — this is the way back.
 *
 * SABOTAGE (2026-10-23): delete the card's `href="/realstories"` from
 * `page.tsx` → RED; delete the article foot's link → RED; re-add a
 * `real-weddings` category to `lib/blog.ts` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('the /blog index links to /realstories', () => {
  assert.match(read('app/blog/page.tsx'), /href="\/realstories"/, '/blog has no way to Stories');
});

test('every article page links to /realstories', () => {
  assert.match(
    read('app/blog/[slug]/page.tsx'),
    /href="\/realstories"/,
    'an article page has no way to Stories',
  );
});

test('Articles keep no category of their own for real events', () => {
  assert.doesNotMatch(
    read('lib/blog.ts'),
    /key: 'real-(weddings|stories|events)'/,
    'a real-events category is back in Articles — real events live at /realstories',
  );
});
