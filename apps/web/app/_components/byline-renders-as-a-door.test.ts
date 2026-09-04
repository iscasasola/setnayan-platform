/**
 * byline-renders-as-a-door.test.ts — the same rule, proved on real HTML.
 *
 * Its sibling `byline-is-a-door.test.ts` reads SOURCE. That is the right tool
 * for "does this file still say `/u/${slug}`", and the wrong tool for the two
 * things that actually break a card, because neither is visible in the text:
 *
 *   1. NESTED ANCHORS. These cards carry two links. An `<a>` inside an `<a>`
 *      is invalid HTML; browsers recover by SPLITTING the outer link, which
 *      silently breaks the card's own tap target. **Nothing else in this repo
 *      catches it** — `lint-nested-forms.mjs` counts `<form>` depth and never
 *      tokenizes anchors, and `next lint` was measured on this branch not to
 *      complain. A source regex cannot see nesting either: JSX that reads as
 *      two siblings can still nest once a component is inlined. So this file
 *      renders the component and looks at the emitted DOM.
 *
 *   2. THAT THE DOOR SURVIVES RENDERING AT ALL. A byline can be present in the
 *      source of a component nothing reaches. Rendering asserts the anchor
 *      exists in the output a browser would receive.
 *
 * 🪤 WHY `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS, AND WHY IT IS
 * NOT A HACK TO BE TIDIED AWAY. The repo's tsconfig sets `"jsx": "preserve"`
 * for Next, so when `tsx` compiles a component for this runner it emits the
 * CLASSIC runtime — bare `React.createElement` calls with no import of their
 * own. Without the global, every component here throws "React is not defined"
 * before a single assertion runs. The imports must therefore be DYNAMIC: a
 * static import is hoisted above the assignment and fails again.
 *
 * ⚠ THIS IS A PROOF ABOUT STRUCTURE, NOT ABOUT WHAT A PERSON SEES. Production
 * holds zero featured chapters, so none of these cards renders on any live
 * shelf today and there is nothing to screenshot. Do not upgrade this to
 * "verified on the live site".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

/**
 * Does any anchor OPEN before a previous one has closed?
 *
 * Scans the tag stream rather than regex-matching across `</a>`, because a
 * lazy pattern silently reports "no nesting" the moment two sibling anchors
 * sit close together.
 */
function nestedAnchorAt(html: string): string | null {
  let depth = 0;
  for (const m of html.matchAll(/<a\b[^>]*>|<\/a>/g)) {
    if (m[0] === '</a>') {
      depth -= 1;
      continue;
    }
    if (depth > 0) return m[0];
    depth += 1;
  }
  return null;
}

const OWNER_SLUG = 'ana-at-marco';

const STORY = {
  href: `/u/${OWNER_SLUG}/c/S89C-CK46HS1VSS`,
  title: 'Our Batanes wedding, told in full',
  ownerName: 'Ana & Marco',
  ownerSlug: OWNER_SLUG,
  kindLabel: 'Wedding',
  hasVideo: false,
  readingMinutes: 3,
  thumbUrl: null,
  excerpt: 'It rained the whole morning and nobody minded.',
};

const FRONT_DOOR_DATA = {
  articles: [],
  articleTotal: 0,
  stories: [STORY],
  storyCount: 1,
  shops: [],
  liveShopCount: 0,
  realWeddingCount: 0,
};

const TILE_ITEM = {
  href: STORY.href,
  publicId: 'S89C-CK46HS1VSS',
  title: STORY.title,
  kind: 'wedding',
  kindLabel: 'Wedding',
  ownerSlug: OWNER_SLUG,
  ownerName: STORY.ownerName,
  viewCount: 7,
  thumbUrl: null,
  excerpt: STORY.excerpt,
  readingMinutes: 3,
  hasVideo: false,
  publishedAt: null,
  eventId: null,
};

async function renderFrontDoorFeed(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorFeed } = await import('@/app/_components/frontdoor/front-door-feed');
  return renderToStaticMarkup(
    React.createElement(FrontDoorFeed, { data: FRONT_DOOR_DATA } as never),
  );
}

async function renderTile(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StorytellerTile } = await import('@/app/_components/storyteller-tile');
  return renderToStaticMarkup(
    React.createElement(StorytellerTile, { item: TILE_ITEM } as never),
  );
}

test('the front door emits a link to the storyteller for their story', async () => {
  const html = await renderFrontDoorFeed();
  const doors = html.match(new RegExp(`<a [^>]*href="/u/${OWNER_SLUG}"`, 'g')) ?? [];
  /*
    ⚠ 2026-09-03 — THIS USED TO EXPECT 2. The front door drew the same story
    twice on the same page — a 16:9 card and a duplicate 9:16 "row" — and a
    byline fix landing on one rendering and not its twin was a real
    regression this test existed to catch. The 2026-09-03 redesign dropped
    the second rendering entirely: `StoryCard` is now the only place a story
    renders on this page (New uploads and Trending both reuse it), so there
    is exactly one door to check, not two kept in sync by hand. See
    `front-door-invariants.test.ts` test 18 and `byline-is-a-door.test.ts`
    for the same call made on their own slices.
  */
  assert.equal(
    doors.length,
    1,
    `expected exactly one channel-line door to the storyteller, got ${doors.length}`,
  );
  // And the story itself is still reachable.
  const stories = html.match(new RegExp(`<a [^>]*href="${STORY.href}"`, 'g')) ?? [];
  assert.equal(stories.length, 1, `expected the card to still open the story, got ${stories.length}`);
});

test('the front door nests no anchors', async () => {
  const html = await renderFrontDoorFeed();
  const nested = nestedAnchorAt(html);
  assert.equal(
    nested,
    null,
    `an anchor opens inside another anchor (${nested}) — browsers split the outer link and the card's tap target breaks`,
  );
});

test('the storyteller tile emits a link to the storyteller and nests no anchors', async () => {
  const html = await renderTile();
  assert.match(
    html,
    new RegExp(`<a [^>]*href="/u/${OWNER_SLUG}"`),
    'the tile rendered no door to the storyteller',
  );
  assert.match(html, new RegExp(`href="${STORY.href}"`), 'the tile no longer opens the chapter');
  const nested = nestedAnchorAt(html);
  assert.equal(nested, null, `the tile nests an anchor (${nested})`);
});

test('the storyteller’s name is what a person presses, not an empty overlay', async () => {
  // An empty stretched anchor would satisfy every check above while announcing
  // nothing to a screen reader. The door must carry the visible name.
  const html = await renderTile();
  const m = new RegExp(`<a [^>]*href="/u/${OWNER_SLUG}"[^>]*>([\\s\\S]*?)</a>`).exec(html);
  assert.ok(m, 'no channel anchor found');
  const text = (m![1] ?? '').replace(/<[^>]+>/g, '').trim();
  assert.ok(text.length > 0, 'the channel anchor is empty — nothing is announced and nothing is visible');
  assert.match(text, /ana-at-marco/, `the channel anchor does not name the storyteller (got "${text}")`);
});
