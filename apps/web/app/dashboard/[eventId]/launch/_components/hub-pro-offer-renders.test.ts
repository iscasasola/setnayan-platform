/**
 * hub-pro-offer-renders.test.ts — THE OFFER REACHES THE PIXELS, AND SO DOES ITS
 * SILENCE.
 *
 * `lib/event-hub-pro.test.ts` proves the ruling. This proves what a person sees,
 * and the difference is the whole disease this stream exists to cure: a decision
 * taken correctly and then dropped one layer above. So this MOUNTS the panel and
 * reads the emitted HTML — composed the way `page.tsx` composes it, resolver
 * first, render second, so an owning couple's `null` is proved as an EMPTY
 * SCREEN rather than as a return value.
 *
 * The three things it will not let through:
 *
 *   1. 🔑 SHOW IT WORKING — DO NOT DIM AND LOCK (owner-locked 2026-07-25). No
 *      lock glyph, no greyscale, no opacity, no overlay. "We did not add one" is
 *      not a claim a reader can verify; this is.
 *   2. ⛔ NO TYPED PRICE. The figure arrives from the live catalog or not at all,
 *      and "not at all" must render a legible offer rather than a broken one.
 *   3. An owning couple must see nothing — not a dimmed something.
 *
 * ⚠ AND THE SILENCE IS THREE OBSERVATIONS, NOT TWO. `hubOffersAllowed` is one
 * line doing three jobs — the day, the days after (the owner's 2026-08-21
 * ruling), AND an UNMEASURED phase. The third is the one that reads as a
 * corollary of the other two and is not: a refused read has no date to be
 * before or after, and a page that sells into that state is selling on a guess.
 * All three are asserted below at the RENDER, because a resolver returning null
 * changes nothing until something paints differently.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS AND IS NOT A HACK TO BE
 * TIDIED AWAY. tsconfig sets `"jsx": "preserve"` for Next, so `tsx` compiles
 * these components to the CLASSIC runtime — bare `React.createElement` with no
 * import of its own — and the imports must be DYNAMIC because a static one is
 * hoisted above the assignment. Precedent: `hub-stage-renders.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type LifecyclePhase = import('@/lib/invitation-widgets').LifecyclePhase;
type MenuLifecyclePhase = import('@/lib/day-of-mode').MenuLifecyclePhase;

/**
 * Exactly the page's own composition: resolve, then render if there is anything
 * to render. Returns '' for the branch where the controller says nothing.
 */
async function paint(opts: {
  channel: LifecyclePhase | null;
  phase: MenuLifecyclePhase | null;
  ownsPro: boolean;
  priceLabel?: string | null;
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubProOffer } = await import('./hub-pro-offer');
  const { resolveHubProOffer } = await import('@/lib/event-hub-pro');
  const { PUBLIC_SITE_PAGES } = await import('@/lib/public-site-pages');

  const offer = resolveHubProOffer({
    channel: opts.channel,
    phase: opts.phase,
    ownsPro: opts.ownsPro,
  });
  if (!offer) return '';
  const channelName = PUBLIC_SITE_PAGES.find((p) => p.phaseParam === opts.channel)?.name ?? null;
  return renderToStaticMarkup(
    React.createElement(HubProOffer, {
      offer,
      channelName,
      priceLabel: opts.priceLabel === undefined ? '₱3,500' : opts.priceLabel,
      base: '/dashboard/S89E-ABCDEFGHJK',
    }),
  );
}

test('🪤 AN OWNING COUPLE SEES AN EMPTY SCREEN, NOT A DIMMED ONE', async () => {
  for (const channel of ['save_the_date', 'rsvp', 'event', 'editorial'] as LifecyclePhase[]) {
    const html = await paint({ channel, phase: 'plan', ownsPro: true });
    assert.equal(html, '', `a couple who paid was still shown an offer on ${channel}`);
  }
});

test('⛔ THE DAY AND THE DAYS AFTER RENDER NOTHING AT ALL', async () => {
  assert.equal(await paint({ channel: 'save_the_date', phase: 'dayof', ownsPro: false }), '');
  assert.equal(await paint({ channel: 'rsvp', phase: 'dayof', ownsPro: false }), '');
  assert.equal(await paint({ channel: 'editorial', phase: 'after', ownsPro: false }), '');
});

test('⛔ AN UNMEASURED PHASE RENDERS NOTHING — an unread state is not a sale', async () => {
  /*
    The third job of the one-line gate, and the one most easily mistaken for a
    corollary of the other two. A refused `events` read yields a null date, and
    BOTH phase resolvers answer a null date honestly — so without this the
    controller would sell the reveal to a couple whose wedding was last month,
    on the strength of a query that never came back.

    Both arms are asserted: a null CHANNEL (nothing to attach an offer to) and a
    null PHASE with a channel present — which is the arm the gate itself owns,
    and the one that goes red when `hubOffersAllowed` is forced true.
  */
  assert.equal(
    await paint({ channel: null, phase: null, ownsPro: false }),
    '',
    'a refused read painted an offer',
  );
  assert.equal(
    await paint({ channel: 'save_the_date', phase: null, ownsPro: false }),
    '',
    'an unmeasured phase cannot tell us it is not their wedding day — it must not sell',
  );
  assert.equal(
    await paint({ channel: 'rsvp', phase: null, ownsPro: false }),
    '',
    'and that holds on every channel, not just the first',
  );
});

test('the couple who has not bought it sees the offer, and the whole of it', async () => {
  const html = await paint({ channel: 'save_the_date', phase: 'plan', ownsPro: false });
  assert.notEqual(html, '', 'the offer must actually render');
  assert.match(html, /cinematic reveal/i, 'the item they are standing in front of, by name');
  assert.match(html, /Event Hub Pro/, 'the catalog’s own title for the one unlock');
  assert.match(html, /Unlock all seven/, 'one CTA, for all seven');
  assert.match(html, /\/studio\/website-pro/, 'pointing at the shipped buy surface');
  // All seven are named, including the free one — the unlock genuinely covers it.
  for (const item of [
    'Cinematic Reveal',
    'Save-the-Date video',
    'Photo gallery',
    'Background music',
    'Editorial editing',
    'Background color',
    'Button color',
  ]) {
    assert.ok(html.includes(item), `"${item}" is one of the seven and must be shown`);
  }
});

test('🔑 SHOW IT WORKING — the offer dims, greys and locks NOTHING', async () => {
  const html = await paint({ channel: 'save_the_date', phase: 'plan', ownsPro: false });
  /*
    The Live Studio Wave 3 correction, owner-locked 2026-07-25, verbatim: "Seeing
    the cameras actually working IS the conversion mechanism; hiding or dimming
    them recreates the exact defect Wave 3 exists to fix — asking ₱3,000 for an
    experience the couple has never felt, for a day that cannot be redone."
  */
  assert.doesNotMatch(html, /opacity-\d/, 'no dimming');
  assert.doesNotMatch(html, /grayscale|greyscale/i, 'no greyscale tile');
  assert.doesNotMatch(html, /lucide-lock|\block\b/i, 'no lock badge over the content');
  assert.doesNotMatch(html, /pointer-events-none/, 'nothing is made unclickable');
  assert.doesNotMatch(html, /aria-disabled/, 'and nothing is announced as disabled');
});

test('⛔ AN UNREADABLE CATALOG OMITS THE FIGURE — it never remembers one', async () => {
  const priced = await paint({ channel: 'rsvp', phase: 'plan', ownsPro: false, priceLabel: '₱3,500' });
  assert.match(priced, /₱3,500/, 'the live figure is shown when the catalog answered');

  const unpriced = await paint({ channel: 'rsvp', phase: 'plan', ownsPro: false, priceLabel: null });
  assert.notEqual(unpriced, '', 'a failed price read must not blank the offer');
  assert.doesNotMatch(unpriced, /₱/, 'and must not fall back to a number from anywhere');
  assert.match(unpriced, /Event Hub Pro/, 'the offer still names itself');
  assert.match(unpriced, /Unlock all seven/, 'and still has its one CTA');
});
