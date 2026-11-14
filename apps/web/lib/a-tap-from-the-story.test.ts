/**
 * A TAP FROM THE STORY — guards.
 *
 * Each assertion is a way the attribution could lie: inventing a `src` the
 * receiving side discards, writing a campaign for a story that cannot name
 * itself, rendering a link for a supplier who has no profile, or letting copy
 * promise identity the analytics model forbids.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { stripComments } from './strip-comments';

import {
  REACH_MUST_NEVER_SAY,
  REACH_SENTENCE,
  STORY_TAP_SRC,
  storyTapHref,
} from './a-tap-from-the-story';

test('it reuses `editorial` — the receiving side DISCARDS anything else', () => {
  assert.equal(STORY_TAP_SRC, 'editorial');
  const href = storyTapHref('kubo-films', 'ana-and-marco');
  assert.ok(href);
  assert.ok(href.includes('src=editorial'), href);
  assert.ok(!href.includes('src=story'), 'inventing src=story silently loses the attribution');
});

test('the campaign names the story', () => {
  const href = storyTapHref('kubo-films', 'ana-and-marco');
  assert.ok(href && href.includes(encodeURIComponent('story:ana-and-marco')), String(href));
});

test('a story that cannot name itself still attributes — and never writes "story:null"', () => {
  const href = storyTapHref('kubo-films', null);
  assert.ok(href);
  assert.ok(href.includes('src=editorial'), 'attribution survives');
  assert.ok(!/utm=/.test(href), 'no campaign rather than a poisoned one');
  assert.ok(!/null/.test(href), href);
});

test('a supplier with no marketplace profile gets NO href — never a dead link', () => {
  assert.equal(storyTapHref(null, 'ana-and-marco'), null);
  assert.equal(storyTapHref('', 'ana-and-marco'), null);
});

test('nothing in the reach copy promises identity', () => {
  for (const forbidden of REACH_MUST_NEVER_SAY) {
    assert.ok(
      !REACH_SENTENCE.toLowerCase().includes(forbidden),
      `the reach sentence promises identity: "${forbidden}"`,
    );
  }
  assert.ok(/how many/i.test(REACH_SENTENCE));
});

/**
 * 🔒 THE BOUNDARY THE OWNER MOVED ON 2026-11-13 (specs DECISION_LOG "every booked supplier is tappable; Supplier Pro /
 * Ultra get a rich card", amending "Supplier Free, Verified and Solo … not tappable"). Owner: *"or we keep everything
 * tappable?"* → *"okay do that."* Paying now changes WHAT A TAP OPENS, never WHETHER a booked supplier is reachable:
 *   · Supplier Pro / Ultra → the rich card first, then their shop;
 *   · Supplier Plus · Verified · Free → their shop directly;
 *   · a supplier the couple added themselves (no Setnayan shop) → a plain name, NEVER a link.
 * The last line is the one that must not move: a link to nowhere, or to a shop the couple did not book, is a lie.
 */
test('every booked supplier is tappable by its plan — and a supplier with no shop never links', async () => {
  const { storySupplierTap } = await import('./story-suppliers');
  const { toStorySupplierViews } = await import('./story-suppliers-views');
  assert.equal(storySupplierTap({ name: 'x', tier: 'enterprise', slug: 'x' }), 'card');
  assert.equal(storySupplierTap({ name: 'x', tier: 'pro', slug: 'x' }), 'card');
  for (const tier of ['solo', 'verified', 'free'] as const) assert.equal(storySupplierTap({ name: 'x', tier, slug: 'x' }), 'shop');
  assert.equal(storySupplierTap({ name: 'x', tier: null, slug: null }), 'none');
  assert.equal(storySupplierTap({ name: 'x', tier: 'pro', slug: null }), 'none');
  const [own] = toStorySupplierViews([{ name: 'Own cake', tier: null, slug: 'ignored', category: null, logoUrl: null }], 'e');
  assert.equal(own!.shopHref, null, 'a self-added supplier must carry no link');

  // The page draws every link through the one tap, which renders a plain <span> when there is no shop.
  const ui = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/story/story-suppliers.tsx'), 'utf8'));
  assert.ok(/s\.tap\s*===\s*'shop'\s*&&\s*s\.shopHref/.test(ui), 'a shop link must stay gated on the tap AND on having an href');
  assert.ok(/return\s*<span className=\{className\}>/.test(ui), 'a supplier with no shop must render as a plain name');
  const page = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/editorial/editorial-content.tsx'), 'utf8'));
  assert.ok(/toStorySupplierViews\(data\.vendors/.test(page), 'the story must take its supplier links from toStorySupplierViews, the one place they are decided');
});
