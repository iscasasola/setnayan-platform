/**
 * opening-an-event-shows-its-name-at-once.test.ts — ⚡ A TAP ON AN EVENT DRAWS ITS NAME AT ONCE.
 *
 * Owner, 2026-10-16: "Opening my events takes so long." Measured on a production build with his
 * rows replayed (375 px, 4× CPU, Fast 4G): the tap changed the URL at ~240 ms, then a skeleton,
 * then the branded veil over everything, and the couple's names first appeared ~1.1 s after the
 * tap — once the whole Home had been read and sent. The layout (already on the phone, prefetched
 * with the card) has read the event, so it hands the cover's words to the Home's loading screen,
 * which draws the real cover band at the tap.
 *
 * Holds:
 *   1. ONE wording: the Home and the loading screen both take `homeCoverWords`;
 *   2. the layout hands it THIS request's event row (with the one-picked-date rule the Home uses);
 *   3. rendered: on the Home's path the loading screen draws the names and no veil; on any other
 *      route that inherits it, the plain skeleton (and the veil) as before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '../../../lib/strip-comments';
import { homeCoverWords } from '../../../lib/home-cover-words';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
(globalThis as unknown as { React: unknown }).React = React;

test('the cover words: type · date over the names, "Your <type>" for an unnamed event', () => {
  assert.deepEqual(homeCoverWords({ event_type: 'wedding', event_date: '2026-12-18', display_name: ' Indalecio & Claire ' }), {
    eyebrow: 'Wedding · December 18, 2026',
    name: 'Indalecio & Claire',
  });
  assert.deepEqual(homeCoverWords({ event_type: 'debut', event_date: null, display_name: '' }), { eyebrow: 'Debut', name: 'Your Debut' });
});

test('the Home and the layout take the same words from the same function', () => {
  const page = read('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /const homeCover0 = homeCoverWords\(/);
  assert.match(page, /cover=\{homeCover0\}/);
  const layout = read('app/dashboard/[eventId]/layout.tsx');
  assert.match(layout, /<HomeCoverWordsProvider\s+eventId=\{eventId\}\s+words=\{homeCoverWords\(\s*withPickedDate\(/);
  assert.match(layout, /\{children\}\s*<\/HomeCoverWordsProvider>/);
  assert.match(read('app/dashboard/[eventId]/loading.tsx'), /<HomeLoadingScreen/);
});

async function renderLoading(path: string): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const { HomeCoverWordsProvider, HomeLoadingScreen } = await import('./_components/home-loading-cover');
  return renderToStaticMarkup(
    React.createElement(
      PathnameContext.Provider,
      { value: path },
      // Children as arguments (react/no-children-prop); the props cast is only for tsc's
      // required-children overload.
      React.createElement(
        HomeCoverWordsProvider,
        { eventId: 'e1', words: { eyebrow: 'Wedding · December 18, 2026', name: 'Indalecio & Claire' } } as never,
        React.createElement(
          HomeLoadingScreen,
          { label: 'Loading your event', hero: React.createElement('i', { 'data-sk-hero': '' }) } as never,
          React.createElement('b', null, 'rest'),
        ),
      ),
    ),
  );
}

test("on the Home's path the loading screen draws the couple's names, not a skeleton hero", async () => {
  const html = await renderLoading('/dashboard/e1');
  assert.match(html, /Indalecio &amp; Claire/);
  assert.match(html, /Wedding · December 18, 2026/);
  assert.match(html, /data-home-cover="colour"/);
  assert.doesNotMatch(html, /data-sk-hero/);
});

test('every other route that inherits it keeps the plain skeleton', async () => {
  const html = await renderLoading('/dashboard/e1/guests');
  assert.doesNotMatch(html, /Indalecio/);
  assert.match(html, /data-sk-hero/);
});
