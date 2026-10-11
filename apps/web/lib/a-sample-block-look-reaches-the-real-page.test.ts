/**
 * a-sample-block-look-reaches-the-real-page.test.ts — A LOOK KEPT FOR A BLOCK THE MAKER DRAWS AS A SAMPLE IS DRAWN ON
 * THE GUEST'S REAL ONE, AND COSTS A GUEST NOTHING UNTIL THEN.
 *
 * Controller's rule (2026-10-10): the look is saved against the block's REAL guest surface, never the Maker's sample
 * alone — "a setting that shows in the Maker and never reaches a guest is the fault this work removes" — and a
 * guest's page is byte-identical unless a look is stored for that block.
 *
 * Proved on the REAL guest page (`SiteBody`, drawn by `lib/site-body-fixture-render.ts` — every line of it, an empty
 * database behind it), for a guest who has a table:
 *   · nothing kept → the page is the same bytes whether or not this work exists (no mark, no style);
 *   · a look kept  → the page gains EXACTLY the block's hidden mark, right before the block's own root, and the one
 *     style that carries the rules — and not one other byte moves;
 *   · the rules that style carries find the real block from that mark.
 *
 * Sabotages seen red (each restored): the mark served with nothing kept · the mark parted from the block’s root.
 *
 * 🎫 THE DIGITAL PASS is mounted by the page, not by `SiteBody` (`app/[slug]/page.tsx` `meSlotFor`), so it is proved
 * on the ticket itself (`GuestTicket`, drawn by React's own HTML renderer): with no mark handed in it is the same
 * bytes; with one, the ticket gains exactly that span, right before its own root — and the reply button (a guest who
 * has not replied) and the one line (a guest who cannot come) take none. Sabotages seen red: a stray element drawn
 * beside the mark · the mark drawn before the reply button.
 *
 * 🖼 PHOTOS OF YOU — ANIMATE ONLY (owner 2026-10-10, verbatim: "animate only"). Proved on the real page for BOTH
 * moments it is drawn at — THE DAY (`dayOfPhase: 'live'`, the Stages page) and AFTER IT (`'post'`, under the Post
 * Event story) — for a guest with photos, with none yet, and whose photos could not be read: nothing kept (or a
 * background alone, which this block refuses) is the same bytes; a motion kept adds exactly the block's hidden mark
 * right before the gallery's own root and the one style, and not one other byte; and that root is a chapter's own
 * child at both moments, so a timed Build in is started by the page's one observer for a guest. Sabotages seen red:
 * the mark served with nothing kept · the mark parted from the gallery's root (drawn after it) · a stored
 * background kept for this block · the gallery wrapped in an element of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCK_LOOKS_PREF_KEY, BLOCK_LOOKS_STYLE_ATTR, BLOCK_MARK_ATTR, blockLooksCss, readBlockLooks } from './block-looks';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderSiteBodyFixture } from './site-body-fixture-render';
import { siteBodyFixtureProps, FIXTURE_EVENT, type SiteBodyFixtureProps } from './site-body-fixture';

/** The fixture guest, given a table (the page draws their own seat only then). */
async function seated(looks: unknown): Promise<string> {
  const base = siteBodyFixtureProps();
  const identity = base.identity as unknown as Record<string, unknown> & { guestHubData: Record<string, unknown> };
  return renderSiteBodyFixture({
    identity: { ...identity, seatMap: { plan: '<svg data-fixture-plan=""></svg>' }, guestHubData: { ...identity.guestHubData, tableLabel: 'Table 7' } } as unknown as SiteBodyFixtureProps['identity'],
    /* `style_preferences` is not on the row's type (the page reads it through a cast, as here). */
    event: (looks === undefined ? FIXTURE_EVENT : { ...FIXTURE_EVENT, style_preferences: { [BLOCK_LOOKS_PREF_KEY]: looks } }) as SiteBodyFixtureProps['event'],
  });
}

test('Your seat: nothing kept is the same page; a look kept adds the mark before the real block and the one style — nothing else', async () => {
  const plain = await seated(undefined);
  /* Anti-vacuity: the guest's OWN seat is on this page, once, with no mark and no style. */
  assert.equal((plain.match(/data-your-table=""/g) ?? []).length, 1, 'the fixture guest has no seat drawn: this proves nothing');
  assert.doesNotMatch(plain, new RegExp(`${BLOCK_MARK_ATTR}|${BLOCK_LOOKS_STYLE_ATTR}`));
  /* Nothing kept, in every spelling of nothing: the very same bytes. */
  for (const nothing of [{}, { find_your_seat: {} }, { find_your_seat: { g: 'paper' } }, { find_your_seat: { motion: {} } }]) {
    assert.equal(await seated(nothing), plain, `a page with ${JSON.stringify(nothing)} kept differs from one with nothing kept`);
  }

  for (const look of [{ g: 'frost' }, { g: 'none' }, { motion: { in: { fade: true } } }, { g: 'frost', motion: { in: { fade: true, move: 'below' } } }] as const) {
    const dressed = await seated({ find_your_seat: look });
    const mark = `<span hidden="" ${BLOCK_MARK_ATTR}="find_your_seat"></span>`;
    const css = blockLooksCss(readBlockLooks({ [BLOCK_LOOKS_PREF_KEY]: { find_your_seat: look } }));
    assert.ok(css.length > 0);
    /* React writes a <style>'s text as it is given (no entity is made of `>` or `"`). */
    const style = `<style ${BLOCK_LOOKS_STYLE_ATTR}="">${css}</style>`;
    /* THE MARK, ONCE, IMMEDIATELY BEFORE THE REAL BLOCK'S ROOT (the Map's plate) — where the rules look from. */
    assert.equal(dressed.split(mark).length, 2, `${JSON.stringify(look)}: the mark is not on the page exactly once`);
    assert.ok(dressed.includes(`${mark}<section class="pahina-plate sm:p-6 ">`), `${JSON.stringify(look)}: the mark is not right before the seat’s own root`);
    assert.equal(dressed.split(style).length, 2, `${JSON.stringify(look)}: the one style is not on the page exactly once`);
    /* …AND NOT ONE OTHER BYTE: take the two away and it is the page with nothing kept. */
    assert.equal(dressed.replace(mark, '').replace(style, ''), plain, `${JSON.stringify(look)}: the page changed somewhere else`);
  }
});

test('The Digital pass: the ticket with no mark is the same bytes; with one, it gains that span right before its root — and only a ticket does', async () => {
  const { GuestTicket } = await import('../app/[slug]/_components/guest-ticket');
  const mark = React.createElement('span', { hidden: true, [BLOCK_MARK_ATTR]: 'pass' });
  const span = `<span hidden="" ${BLOCK_MARK_ATTR}="pass"></span>`;
  const draw = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(GuestTicket as unknown as React.FC<Record<string, unknown>>, { name: 'Teresita Cruz', invitationUrl: 'https://example.test/i', ...props }));
  /* React lifts the picture's preload hint (`<link rel="preload" as="image">`) to the front of what it writes; the
     ticket's own markup follows it. */
  const parts = (html: string) => /^((?:<link [^>]*\/>)*)([\s\S]*)$/.exec(html)!.slice(1) as [string, string];
  for (const state of ['pass', 'awaiting'] as const) {
    const plain = draw({ state });
    const [hints, body] = parts(plain);
    assert.ok(body.startsWith(`<section id="site-pass" data-motion="pass" data-guest-ticket="${state}"`), body.slice(0, 120));
    assert.equal(draw({ state, mark: null }), plain);
    /* The mark, then the ticket's own root — and nothing else moved. */
    assert.equal(draw({ state, mark }), `${hints}${span}${body}`, `${state}: the mark is not right before the ticket’s root (or something else changed)`);
  }
  /* Not a ticket: the reply button before a reply, the one line when they cannot come, nothing at all. No mark. */
  for (const props of [{ state: 'pass', replyHref: '#reply' }, { state: 'cannotCome' }, { state: 'none' }] as const) {
    const plain = draw(props);
    assert.doesNotMatch(plain, /data-motion="pass"/, 'anti-vacuity: this state draws no ticket');
    assert.equal(draw({ ...props, mark }), plain, `${JSON.stringify(props)}: a mark is drawn where there is no ticket`);
  }
});

/** Two photographs of the fixture guest, as the loader hands them over (`lib/guest-live-gallery.ts`). */
const TWO_PHOTOS = {
  total: 2,
  photos: [
    { id: 'p1', url: 'https://example.test/1.jpg', sourceTable: 'papic_photos', capturedAt: '2026-12-12T08:30:00Z', capturedBy: null, wall: 'off' },
    { id: 'p2', url: 'https://example.test/2.jpg', sourceTable: 'papic_guest_captures', capturedAt: null, capturedBy: 'Tita Remy', wall: 'posted' },
  ],
};
/** The two moments a guest's page draws "Photos of you": The Day's own page, and after it under the Post Event story. */
const MOMENTS = {
  /* `kicker`: the gallery's own first line as React writes it — "so far" (and the live dot before it) only on the day. */
  'The Day': { lifecyclePhase: 'event', dayOfPhase: 'live', kicker: '</span>Photos of you<!-- --> — so far</p>' },
  'Post Event': { lifecyclePhase: 'editorial', dayOfPhase: 'post', kicker: 'tracking-[0.2em]">Photos of you</p>' },
} as const;

/** The fixture guest's page at one of those moments, with their gallery as the loader answered (null = the read failed). */
async function pictured(moment: keyof typeof MOMENTS, gallery: unknown, looks: unknown): Promise<string> {
  const base = siteBodyFixtureProps();
  const { lifecyclePhase, dayOfPhase } = MOMENTS[moment];
  return renderSiteBodyFixture({
    lifecyclePhase,
    dayOfPhase,
    identity: { ...(base.identity as unknown as Record<string, unknown>), guestLiveGallery: gallery } as unknown as SiteBodyFixtureProps['identity'],
    event: (looks === undefined ? FIXTURE_EVENT : { ...FIXTURE_EVENT, style_preferences: { [BLOCK_LOOKS_PREF_KEY]: looks } }) as SiteBodyFixtureProps['event'],
  });
}

for (const moment of Object.keys(MOMENTS) as Array<keyof typeof MOMENTS>) {
  test(`Photos of you, ${moment}: nothing kept is the same page; a motion kept adds the mark before the gallery’s own root and the one style — nothing else; a background is never kept`, async () => {
    const ROOT = '<section aria-label="Photos of you" class="sn-gal p-5 sm:p-6">';
    const mark = `<span hidden="" ${BLOCK_MARK_ATTR}="photos_of_you"></span>`;
    for (const [state, gallery] of [['two photos', TWO_PHOTOS], ['none yet', { photos: [], total: 0 }], ['the read failed', null]] as const) {
      const plain = await pictured(moment, gallery, undefined);
      /* Anti-vacuity: the guest's OWN gallery is on this page, once, at THIS moment (its kicker says which), with what
         the state draws — and no mark and no style. */
      assert.equal(plain.split(ROOT).length, 2, `${state}: the fixture guest’s gallery is not drawn once: this proves nothing`);
      assert.ok(plain.includes(MOMENTS[moment].kicker), `${state}: this is not the page of ${moment}`);
      assert.equal(plain.split('class="sn-gal-tile group aspect-square"').length - 1, gallery ? gallery.photos.length : 0, `${state}: the photos are not drawn`);
      assert.equal(plain.includes('We couldn’t load your photos just now.'), gallery === null);
      assert.doesNotMatch(plain, new RegExp(`${BLOCK_MARK_ATTR}|${BLOCK_LOOKS_STYLE_ATTR}`));
      /* 🧱 Its root is A CHAPTER'S OWN CHILD at this moment — what the page's one observer marks (`.pahina-in`), which
         is what starts a timed Build in for a guest. The Day files it in its page's group; after the day it stands
         in the page's one article. (Outside a chapter the Build in would be seen in the Maker and never by a guest.) */
      const before = plain.slice(0, plain.indexOf(ROOT));
      const chapters = before.lastIndexOf('data-pahina-chapters=');
      assert.ok(chapters > 0, `${state}: no chapters before the gallery`);
      const between = before.slice(before.indexOf('>', chapters) + 1);
      let depth = 0;
      for (const tag of between.match(/<\/?(?:div|section|article|main|ol|ul|li|p|span|a|header|footer|nav|figure|form|svg|h[1-6])\b[^>]*>/g) ?? []) depth += tag.startsWith('</') ? -1 : 1;
      assert.equal(depth, 0, `${state}: the gallery’s root is not a direct child of the chapters before it`);

      /* NOTHING KEPT, in every spelling of nothing — and A BACKGROUND IS NOTHING HERE (owner: "animate only"): the
         very same bytes, so no guest is served a mark for it. */
      for (const nothing of [{}, { photos_of_you: {} }, { photos_of_you: { motion: {} } }, { photos_of_you: { g: 'frost' } }, { photos_of_you: { g: 'none' } }, { photos_of_you: { g: 'plain' } }]) {
        assert.equal(await pictured(moment, gallery, nothing), plain, `${state}: a page with ${JSON.stringify(nothing)} kept differs from one with nothing kept`);
      }

      for (const look of [{ motion: { in: { fade: true } } }, { motion: { in: { fade: true, move: 'below' }, during: 'drift' } }, { motion: { timeline: 'scroll', in: { fade: true }, out: { fade: true } } }, { g: 'frost', motion: { in: { fade: true } } }] as const) {
        const dressed = await pictured(moment, gallery, { photos_of_you: look });
        /* The style is the MOTION's alone — a background stored beside it writes nothing. */
        const css = blockLooksCss(readBlockLooks({ [BLOCK_LOOKS_PREF_KEY]: { photos_of_you: { motion: look.motion } } }));
        assert.ok(css.length > 0);
        assert.doesNotMatch(css, /background|backdrop-filter|border/, 'a ground is written for Photos of you');
        const style = `<style ${BLOCK_LOOKS_STYLE_ATTR}="">${css}</style>`;
        /* THE MARK, ONCE, IMMEDIATELY BEFORE THE GALLERY'S OWN ROOT — where the rules look from. */
        assert.equal(dressed.split(mark).length, 2, `${state} · ${JSON.stringify(look)}: the mark is not on the page exactly once`);
        assert.ok(dressed.includes(`${mark}${ROOT}`), `${state} · ${JSON.stringify(look)}: the mark is not right before the gallery’s own root`);
        assert.equal(dressed.split(style).length, 2, `${state} · ${JSON.stringify(look)}: the one style is not on the page exactly once`);
        /* …AND NOT ONE OTHER BYTE: take the two away and it is the page with nothing kept. */
        assert.equal(dressed.replace(mark, '').replace(style, ''), plain, `${state} · ${JSON.stringify(look)}: the page changed somewhere else`);
      }
    }
  });
}
