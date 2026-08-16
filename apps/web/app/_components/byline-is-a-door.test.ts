/**
 * byline-is-a-door.test.ts — the storyteller's name presses through to them.
 *
 * A story card names the person who wrote it. That name is a DOOR to their own
 * page at `/u/{slug}` — on every public shelf, not on three of the four. This
 * file pins the two things that fail SILENTLY:
 *
 *   1. THE DOOR GOES MISSING FROM ONE SURFACE. The same story renders four
 *      different ways across the front door, /realstories, a shop page and the
 *      Journal. A fix applied to one rendering and not its twin is the shape
 *      this repo keeps re-learning, so every surface is asserted SEPARATELY —
 *      a file-level count cannot say which card still carries it.
 *
 *   2. THE DOOR IS DRAWN BUT UNPRESSABLE. The card's own press target is an
 *      anchor stretched over the whole card. If the byline link is not raised
 *      ABOVE that overlay it is still coloured, still underlined on hover in
 *      the markup, still announced by a screen reader as a link — and nothing
 *      happens when a finger lands on it. It looks exactly like a working
 *      feature. So the stacking order is asserted as arithmetic, not as prose.
 *
 * ⚠ AND THE STRUCTURE ITSELF IS A GUARD. These cards carry TWO anchors. An
 * `<a>` inside an `<a>` is invalid HTML and browsers recover by SPLITTING the
 * outer link, silently breaking the card's own tap target. Nothing in CI
 * catches that — `lint-nested-forms.mjs` tracks `<form>` depth and does not
 * tokenize anchors at all — so the "shell, not a Link" assertions below are
 * the only thing standing between a refactor and a broken card.
 *
 * Every assertion here was mutation-checked: the rule was broken on purpose,
 * the occurrence count was printed before and after to prove the sabotage
 * LANDED, and the test was confirmed to go RED. An unmeasured mutation proves
 * nothing, and a guard nobody has seen fail is decoration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const WEB = resolve(APP, '..');

/**
 * Strip comments so a rule DESCRIBED in prose can never satisfy a check.
 * This file is full of prose about links to `/u/`; without this, deleting every
 * link would still leave the words behind and the suite would stay green.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

const FEED = code(readFileSync(join(HERE, 'frontdoor', 'front-door-feed.tsx'), 'utf8'));
/**
 * ⚠ CSS COMMENTS ARE STRIPPED, AND THAT IS NOT TIDINESS.
 * The first cut of this file read the raw stylesheet, and `zIndexOf('.fd-chan')`
 * landed on the DOCBLOCK above the rule — which mentions `.fd-chan` while
 * explaining why it needs a z-index — then parsed to the next `}` and reported
 * that the property was missing. The guard failed against correct code because
 * it matched prose. Same disease it exists to catch: a sentence is not a
 * mechanism.
 */
const CSS = readFileSync(join(HERE, 'frontdoor', 'front-door.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const DATA = code(readFileSync(join(HERE, 'frontdoor', 'data.ts'), 'utf8'));
const TILE = code(readFileSync(join(HERE, 'storyteller-tile.tsx'), 'utf8'));
const JOURNAL = code(readFileSync(join(APP, 'blog', '[slug]', 'page.tsx'), 'utf8'));
const STORYTELLERS = code(readFileSync(join(WEB, 'lib', 'storytellers.ts'), 'utf8'));
const CREATOR_PUBLIC = code(readFileSync(join(WEB, 'lib', 'creator-public.ts'), 'utf8'));
const PROFILE = code(readFileSync(join(APP, 'u', '[userSlug]', 'page.tsx'), 'utf8'));

/**
 * The front door renders the SAME story twice — a 16:9 card and a 9:16 row.
 * Slice them apart so an assertion can name WHICH one lost the door. A check
 * run over the whole file passes while one of the two is gone, which is the
 * precise way this page has regressed before.
 */
function storyCardSlice(): string {
  const from = FEED.indexOf('function StoryCard');
  const to = FEED.indexOf('function ShopCard');
  assert.ok(from >= 0 && to > from, 'StoryCard/ShopCard anchors moved — re-anchor this slice');
  return FEED.slice(from, to);
}

/**
 * The 9:16 shelf renders BOTH kinds — storyteller cards first, then Journal
 * articles padding the row out. Only the story branch carries a byline; the
 * article branch is legitimately a single `<Link className="fd-story">` and
 * always will be.
 *
 * ⚠ THIS SLICE STARTS NARROW ON PURPOSE. The first cut ran from `fd-storyrow`
 * to end-of-file and its no-nested-anchor check fired on the ARTICLE card,
 * which is correct code. A guard that cries wolf teaches you to skim past the
 * one time it is right.
 */
function storyRowSlice(): string {
  const from = FEED.indexOf('shownStories.slice(0, 6).map');
  const to = FEED.indexOf('{shownArticles', from);
  assert.ok(from >= 0 && to > from, 'story-row anchors moved — re-anchor this slice');
  return FEED.slice(from, to);
}

/** Pull `z-index: N` out of one CSS rule body, by selector. */
function zIndexOf(selector: string): number {
  const i = CSS.indexOf(selector);
  assert.ok(i >= 0, `selector ${selector} is gone from front-door.css`);
  const body = CSS.slice(i, CSS.indexOf('}', i));
  const m = /z-index:\s*(-?\d+)/.exec(body);
  assert.ok(m, `${selector} declares no z-index — the byline cannot be pressed without one`);
  return Number(m![1]);
}

// ── 1. THE DOOR EXISTS, ON EACH SURFACE SEPARATELY ────────────────────────

test('the 16:9 story card byline is a link to the storyteller', () => {
  const card = storyCardSlice();
  assert.match(
    card,
    /<ChannelLink[^>]*slug=\{s\.ownerSlug\}/,
    'the big story card no longer sends the storyteller’s name to their page',
  );
  // The card must still open the STORY — a byline door that swallowed the
  // card's own destination would be a regression dressed as a feature.
  assert.match(card, /href=\{s\.href\}/, 'the story card no longer opens the story');
});

test('the 9:16 story row byline is a link to the storyteller', () => {
  const row = storyRowSlice();
  assert.match(
    row,
    /<ChannelLink[^>]*slug=\{s\.ownerSlug\}/,
    'the story ROW lost the door while the card above it kept one — the twin-rendering regression',
  );
  assert.match(row, /href=\{s\.href\}/, 'the story row no longer opens the story');
});

test('the storyteller tile byline is a link to the storyteller', () => {
  // One component, THREE public routes: /realstories, /v/{slug}, and the
  // bare-root shop address /{slug}.
  assert.match(
    TILE,
    /<Link\s+href=\{`\/u\/\$\{item\.ownerSlug\}`\}/,
    'the storyteller tile prints the handle without linking it',
  );
  assert.ok(
    !/<span[^>]*>\s*A chapter by @\{item\.ownerSlug\}/.test(TILE),
    'the tile reverted to a plain <span> byline',
  );
});

test('the Journal’s chapter block byline is a link to the storyteller', () => {
  assert.match(
    JOURNAL,
    /<Link\s+href=\{`\/u\/\$\{resolved\.ownerSlug\}`\}/,
    'a chapter embedded in a Journal article names its author without linking them',
  );
});

test('the front door carries the handle from the loader instead of parsing it out of a URL', () => {
  assert.match(DATA, /ownerSlug:\s*string/, 'FrontDoorStory dropped ownerSlug');
  assert.match(DATA, /ownerSlug:\s*s\.ownerSlug/, 'the front-door mapping stopped carrying ownerSlug');
  // `href` is `/u/{slug}/c/{id}` today, so a slice of it would work — until the
  // chapter route moves and the byline silently points at a URL fragment.
  assert.ok(
    !/ownerSlug[^\n]*(href\.split|href\.slice|href\.match)/.test(DATA),
    'ownerSlug is being recovered from href — carry the field, never re-derive it',
  );
});

// ── 2. TWO ANCHORS, NEVER NESTED ──────────────────────────────────────────

test('the story cards are shells, not anchors, so the byline is a sibling', () => {
  const card = storyCardSlice();
  assert.ok(
    !/<Link[^>]*className="fd-item"/.test(card),
    'the 16:9 card went back to being one <Link> — the byline link inside it is now a nested anchor',
  );
  assert.match(card, /<div className="fd-item">/, 'the 16:9 card lost its shell');

  const row = storyRowSlice();
  assert.ok(
    !/<Link[^>]*className="fd-story"/.test(row),
    'the 9:16 row went back to being one <Link> — nested anchor',
  );
});

test('the storyteller tile is a shell, not an anchor', () => {
  assert.ok(
    !/<Link\s+href=\{item\.href\}\s*\n?\s*className="group/.test(TILE),
    'the tile card is a <Link> again — its byline link is now nested inside it',
  );
  assert.match(
    TILE,
    /after:absolute after:inset-0/,
    'the tile lost the stretched title link, so only the title text opens the chapter',
  );
});

// ── 3. THE DOOR IS ACTUALLY PRESSABLE ─────────────────────────────────────

test('the byline is stacked ABOVE the card’s stretched press target', () => {
  const overlay = zIndexOf('.fd-stretch::after');
  const byline = zIndexOf('.fd-chan');
  assert.ok(
    byline > overlay,
    `the channel line (z-index ${byline}) sits under the card overlay (z-index ${overlay}) — ` +
      'it renders as a link and cannot be pressed',
  );
  assert.match(
    CSS,
    /\.fd-chan\s*\{[^}]*position:\s*relative/,
    '.fd-chan has no positioning, so its z-index does nothing at all',
  );
});

test('the tile’s byline is raised above its stretched title link', () => {
  assert.match(
    TILE,
    /className="relative z-20 flex flex-wrap/,
    'the tile byline lost its raised layer — the title overlay now covers it',
  );
});

// ── 4. THE DOOR LEADS SOMEWHERE ───────────────────────────────────────────

test('a story only reaches a public shelf when its author’s page can render', () => {
  // `/u/[userSlug]` refuses a reserved word outright, and the reserved set is
  // GENERATED from the route folders on disk — so it grows as new pages ship,
  // while a handle is checked only when it is claimed.
  assert.match(
    STORYTELLERS,
    /isReservedSlug\(u\.slug\)/,
    'the shelf can list a storyteller whose handle collides with a route — the byline 404s',
  );
  assert.match(
    STORYTELLERS,
    /public_profile_enabled !== true/,
    'the shelf stopped checking that the author has a public page at all',
  );
});

test('a refused read is not reported as “this person has published nothing”', () => {
  assert.match(
    CREATOR_PUBLIC,
    /const \{ data, error \}[\s\S]{0,400}?if \(error\)/,
    'the published-chapters read ignores its error again — a rejected query resolves, it does not throw',
  );
  // The harm is specific: with the read empty and one ongoing event, the
  // profile REDIRECTS, so pressing a byline lands on a stranger's wedding.
  assert.match(
    PROFILE,
    /!hasChapters && chaptersRead\.ok/,
    'the profile redirects on a failed chapter read — a byline can now land on the wrong page',
  );
});

test('the shelf’s owner read reports its own failure', () => {
  assert.match(
    STORYTELLERS,
    /const \{ data, error \}[\s\S]{0,300}?console\.error\('\[storytellers\] owner read failed'/,
    'a refused owner read empties the whole shelf and looks like a quiet week',
  );
});
