/**
 * event-hub-pro.test.ts — ONE UNLOCK, AND EVERY WAY IT MUST STAY SILENT.
 *
 * The offer is `null` far more often than it is an offer, and every `null` is a
 * ruling somebody made:
 *
 *   owned ......... the couple already paid. 🪤 THE PAPIC BRANCH — see below.
 *   unmeasured .... a refused read is not a channel to sell on.
 *   the day ....... `hubOffersAllowed`, EH1's, called and never re-derived.
 *   after .........  a finished celebration is not a sales opportunity.
 *   already free .. `NOT_SOLD_ON` — EDITORIAL_PRO is free for everyone.
 *
 * 🪤 WHY THE OWNING EVENT IS CONSTRUCTED AND NOT ASSUMED. Papic's card could
 * never light up for a YEAR because it was gated on a retired SKU with zero
 * orders ever — so the one page that exists to say "start this now, it's your
 * wedding day" was permanently stuck on the upsell branch for every couple. A
 * gate that can only ever answer one way renders IDENTICALLY to a gate that
 * works, and no test that only exercises the upsell can tell them apart. So the
 * first test below builds an event that OWNS the unlock and asserts the offer is
 * gone from all four channels.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHubProOffer } from '@/lib/event-hub-pro';
import { WEBSITE_PRO_ITEMS, NOT_SOLD_ON } from '@/lib/website-pro-items';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';

const CHANNELS: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const PHASES: MenuLifecyclePhase[] = ['plan', 'dayof', 'after'];

test('🪤 AN OWNING EVENT IS OFFERED NOTHING — on any channel, in any phase', () => {
  let checked = 0;
  for (const channel of CHANNELS) {
    for (const phase of PHASES) {
      const offer = resolveHubProOffer({ channel, phase, ownsPro: true });
      assert.equal(
        offer,
        null,
        `a couple who paid was still sold Event Hub Pro on ${channel} / ${phase}`,
      );
      checked += 1;
    }
  }
  // A loop that ran zero times passes silently. The Papic defect was invisible
  // for a year precisely because nothing counted what it had looked at.
  assert.equal(checked, 12, 'the owning-event sweep must cover all four channels × three phases');
});

test('a couple who does NOT own it is offered exactly one unlock, on the live channel', () => {
  const offer = resolveHubProOffer({
    channel: 'save_the_date',
    phase: 'plan',
    ownsPro: false,
  });
  assert.ok(offer, 'the offer must render for a couple who has not bought it');
  assert.equal(offer.lead, 'Cinematic Reveal', 'the reveal is what the save-the-date is missing');
  assert.equal(offer.channel, 'save_the_date');
  assert.equal(offer.ctaPath, '/studio/website-pro', 'the SHIPPED buy surface, not a new route');
});

test('the invitation is sold on the photos, not on the reveal', () => {
  const offer = resolveHubProOffer({ channel: 'rsvp', phase: 'plan', ownsPro: false });
  assert.ok(offer);
  assert.equal(offer.lead, 'Photo gallery');
});

test('SEVEN chips, in catalog order, with exactly ONE lit', () => {
  const offer = resolveHubProOffer({ channel: 'rsvp', phase: 'plan', ownsPro: false });
  assert.ok(offer);
  assert.deepEqual(
    offer.chips.map((c) => c.name),
    [...WEBSITE_PRO_ITEMS],
    'the chips ARE the seven items — one list, not a second copy of it',
  );
  const lit = offer.chips.filter((c) => c.here);
  assert.equal(lit.length, 1, 'one price seven times, not seven prices — exactly one chip is lit');
  assert.equal(lit[0]?.name, offer.lead, 'and the lit one is where the couple is standing');
});

test('⛔ NO OFFER ON THE DAY, AND NONE AFTER IT — the ruling is EH1’s, not a second copy', () => {
  for (const channel of CHANNELS) {
    assert.equal(
      resolveHubProOffer({ channel, phase: 'dayof', ownsPro: false }),
      null,
      `an offer outranked the wedding day on ${channel}`,
    );
    assert.equal(
      resolveHubProOffer({ channel, phase: 'after', ownsPro: false }),
      null,
      `a finished celebration was sold an upgrade on ${channel}`,
    );
  }
});

test('an UNMEASURED read sells nothing — a refused query is not a channel', () => {
  assert.equal(
    resolveHubProOffer({ channel: null, phase: 'plan', ownsPro: false }),
    null,
    'a null stage means the event read was refused; selling on it is guessing',
  );
  assert.equal(
    resolveHubProOffer({ channel: 'save_the_date', phase: null, ownsPro: false }),
    null,
    'and an unmeasured phase cannot tell us it is not their wedding day',
  );
});

test('⛔ THE UMBRELLA IS NEVER SOLD ON SOMETHING THAT IS ALREADY FREE', () => {
  /*
    EDITORIAL_PRO joined FREE_FOR_ALL_SKUS on 2026-08-23 — every couple already
    passes `isEditorialProActive`. `couple-website-pro.ts` states the constraint
    in its own words: "Event Hub PRO may NOT be SOLD on this inclusion while it
    is free." Showing the item is right; leading on it is asking for money for
    something the couple already has.
  */
  assert.ok(NOT_SOLD_ON.includes('Editorial editing'), 'the free item must be on the list');
  for (const channel of CHANNELS) {
    const offer = resolveHubProOffer({ channel, phase: 'plan', ownsPro: false });
    if (offer === null) continue;
    assert.ok(
      !NOT_SOLD_ON.includes(offer.lead),
      `${channel} led on "${offer.lead}", which every couple already has for free`,
    );
  }
});

test('all seven items are still SHOWN, including the free one', () => {
  const offer = resolveHubProOffer({ channel: 'save_the_date', phase: 'plan', ownsPro: false });
  assert.ok(offer);
  assert.ok(
    offer.chips.some((c) => c.name === 'Editorial editing'),
    'the unlock genuinely covers it — hiding it would misdescribe what is bought',
  );
});
