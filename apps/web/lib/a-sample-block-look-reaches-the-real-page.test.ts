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
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCK_LOOKS_PREF_KEY, BLOCK_LOOKS_STYLE_ATTR, BLOCK_MARK_ATTR, blockLooksCss, readBlockLooks } from './block-looks';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderSiteBodyFixture } from './site-body-fixture-render';
import type { SiteBodyFixtureProps } from './site-body-fixture';

/** The fixture guest, given a table (the page draws their own seat only then). */
async function seated(looks: unknown): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { siteBodyFixtureProps, FIXTURE_EVENT } = require('./site-body-fixture') as typeof import('./site-body-fixture');
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
