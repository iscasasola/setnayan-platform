/**
 * 🎞 EVERY PHOTO A MOMENT HOLDS REACHES THE GUEST — owner 2026-10-17 (DECISION_LOG "A LOVE STORY MOMENT'S PHOTOS SHOW
 * AS GLIMPSE"), on live cale-ice, verbatim: *"photos uploaded were up to 3, it only showed 1, and i was hoping to have
 * a better way to present those photos (up to 3)"* → *"Use the Glimpse swipe for a moment's photos: one big, the next
 * peeking, swipe or auto-scroll; one photo stays as now."*
 *
 * The fault was a look that drew `photos[0]` and dropped the rest — the couple uploaded three and the guest saw one,
 * with nothing on either page to say so. Held here as a PROPERTY over every look the scene offers
 * (`STAGE_SCENE_STYLE_SETS`), so a look added later is held too:
 *   1 · a moment's EVERY photo is drawn inside that moment's own `<article>` — except the two named looks that never
 *       had a photo slot per moment (`NO_PHOTO_SLOT`, each with its reason);
 *   2 · in the two-voices looks (Conversation · Timeline · Swipe cards) two or more photos are the Photos scene's OWN
 *       Glimpse rail — one card per photo, in order — never a second carousel;
 *   3 · ONE photo renders exactly as it did before: one `<img>`, no rail, the look's own tag, byte for byte;
 *   4 · the Maker's empty samples of those three looks draw the Glimpse shape at the photo slot.
 *
 * 🪤 Same harness as the neighbouring render tests: `globalThis.React` before the DYNAMIC imports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { STAGE_SCENE_STYLE_SETS } from './scene-styles-stages';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = path.resolve(__dirname, '..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

const ref = (n: string) => `r2://setnayan-media/events/E1/love-story/${n}.jpg`;
const url = (n: string) => `https://img.test/${n}.jpg`;
const MEDIA_URLS: Record<string, string> = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => [ref(n), url(n)]));

const STORY = {
  moments: [
    { id: 'three', date: { y: 2019 }, title: 'First Out of the Country Together', voices: { a: 'Her side.', b: 'His side.' }, media: [ref('a'), ref('b'), ref('c')], order: 0, canvas: {} },
    { id: 'one', date: { y: 2020 }, title: 'One photo', line: 'Told together.', media: [ref('d')], order: 1, canvas: {} },
    { id: 'two', date: { y: 2021 }, title: 'Two photos', voices: { b: 'Only his.' }, media: [ref('e'), ref('f')], order: 2, canvas: {} },
  ],
};
const HOLDS: Record<string, string[]> = { three: [url('a'), url('b'), url('c')], one: [url('d')], two: [url('e'), url('f')] };

/**
 * Looks that never had a photo slot per moment — named, each with its reason, so a NEW look is held by default.
 *   · essay — the shipped `OurStory` prose (drop cap, pull quote, milestones): words only, by design.
 *   · years — a rail of years with one round thumbnail per year, and the open year's words under it; no moment
 *     draws a photo slot of its own.
 */
const NO_PHOTO_SLOT = new Set(['essay', 'years']);
/** The two-voices looks — owner 2026-10-17: their photo slot is the Glimpse rail when a moment holds two or more. */
const GLIMPSE_LOOKS = ['conversation', 'timeline', 'cards'] as const;

/** The exact tag each look drew for ONE photo before 2026-10-17 — the "one photo stays as now" contract. */
const ONE_PHOTO_TAG: Record<string, string> = {
  conversation: `<img src="${url('d')}" alt="" loading="lazy" data-love-fx="in" class="aspect-[4/5] w-[72%] max-w-full justify-self-center rounded-xl object-cover"/>`,
  timeline: `<img src="${url('d')}" alt="" loading="lazy" data-love-fx="in" style="--love-at:0.3s" class="mt-2.5 aspect-[4/5] w-[150px] max-w-full object-cover"/>`,
  // the second card is not the active one, so its photo carries no entrance
  cards: `<img src="${url('d')}" alt="" loading="lazy" class="aspect-[4/3] w-full max-w-full rounded-2xl object-cover"/>`,
  chapters: `<img src="${url('d')}" alt="" loading="lazy" class="aspect-[4/5] w-full object-cover"/>`,
};

/** Each `<article data-love-scene="id">`'s own markup. */
function articles(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<article[^>]*data-love-scene="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)) out[m[1]!] = m[2]!;
  return out;
}
const srcs = (html: string) => [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!);

async function render(style: string): Promise<string> {
  const { OurLoveStoryWidget } = await import('../app/[slug]/_components/our-love-story-widget');
  return renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: STORY, mediaUrls: MEDIA_URLS, sceneStyle: style, partners: ['Maria', 'Jose'] }));
}

const LOOKS = STAGE_SCENE_STYLE_SETS.find((x) => x.type === 'our_love_story')!.styles.map((s) => s.id);

test('the registry still offers the looks this guard names', () => {
  for (const id of [...NO_PHOTO_SLOT, ...GLIMPSE_LOOKS]) assert.ok(LOOKS.includes(id), `"${id}" is no longer a Love Story look — update this guard`);
});

test('1 · every photo a moment holds is drawn inside that moment, in every look with a photo slot', async () => {
  const held = LOOKS.filter((id) => !NO_PHOTO_SLOT.has(id));
  assert.ok(held.length >= 4, `only ${held.length} looks held — the registry read nothing`);
  for (const style of held) {
    const arts = articles(await render(style));
    for (const [id, want] of Object.entries(HOLDS)) {
      const art = arts[id];
      assert.ok(art, `${style}: moment "${id}" was not drawn`);
      const seen = srcs(art);
      for (const u of want) assert.ok(seen.includes(u), `${style}: moment "${id}" holds ${want.length} photos and dropped ${u}`);
    }
  }
});

test('2 · in the two-voices looks, two or more photos are the Photos scene’s own Glimpse rail — one card per photo, in order', async () => {
  for (const style of GLIMPSE_LOOKS) {
    const arts = articles(await render(style));
    for (const id of ['three', 'two']) {
      const art = arts[id]!;
      const want = HOLDS[id]!;
      assert.equal((art.match(/data-glimpse=""/g) ?? []).length, 1, `${style} · "${id}": not exactly one Glimpse rail`);
      assert.equal((art.match(/data-glimpse-card=""/g) ?? []).length, want.length, `${style} · "${id}": not one card per photo`);
      assert.deepEqual(srcs(art), want, `${style} · "${id}": the photos are not drawn once each, in the couple's order`);
      assert.match(art, new RegExp(`data-love-photos="${want.length}"`), `${style} · "${id}": the photo slot does not say how many it holds`);
    }
  }
  const styles = read('app/[slug]/_components/our-love-story-styles.tsx');
  assert.match(styles, /import \{ GlimpseRail \} from '\.\/glimpse-rail'/, 'the looks no longer import the one GlimpseRail');
  assert.match(styles, /<GlimpseRail urls=\{photos\}/, 'the moment\'s photo slot does not mount the one GlimpseRail');
});

test('3 · ONE photo renders exactly as before — one <img>, no rail, the look’s own tag', async () => {
  for (const [style, tag] of Object.entries(ONE_PHOTO_TAG)) {
    const art = articles(await render(style)).one!;
    assert.doesNotMatch(art, /data-glimpse|data-love-photos/, `${style}: a one-photo moment became a rail`);
    assert.equal((art.match(/<img/g) ?? []).length, 1, `${style}: a one-photo moment does not draw exactly one <img>`);
    assert.ok(art.includes(tag), `${style}: the one photo's tag changed:\n${art.match(/<img[^>]*>/)?.[0]}\n  expected\n${tag}`);
  }
});

test('4 · the Maker’s empty samples of the two-voices looks draw the Glimpse shape at the photo slot', async () => {
  const { SCENE_SAMPLE } = await import('../app/[slug]/_components/maker-scene-samples');
  for (const style of GLIMPSE_LOOKS) {
    const draw = SCENE_SAMPLE[`our_love_story:${style}`];
    assert.ok(draw, `our_love_story:${style} has no sample`);
    const out = renderToStaticMarkup(React.createElement(React.Fragment, null, draw({})));
    assert.ok((out.match(/aspect-\[3\/4\][^"]*shrink-0/g) ?? []).length >= 3, `our_love_story:${style}: the sample's photo slot is not the Glimpse shape (a card and two peeking)`);
  }
});
