/**
 * story-suppliers.test.ts — the story's supplier list follows the owner's 13 Nov rulings
 * (specs DECISION_LOG 2026-11-13: "every booked supplier is tappable" · "order by supplier plan" · "100 suppliers").
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORY_SUPPLIERS_TOP,
  groupStorySuppliers,
  orderStorySuppliers,
  searchStorySuppliers,
  storySupplierBadge,
  storySupplierTags,
  storySupplierTap,
  storySuppliersLead,
  storySuppliersSearchable,
  supplierInitials,
  ultraSuppliers,
  type StorySupplierLike,
} from './story-suppliers';
import type { VendorTier } from './vendor-tier-caps';

const s = (name: string, tier: VendorTier | null, slug: string | null = tier ? name.toLowerCase().replace(/\W+/g, '-') : null) =>
  ({ name, tier, slug, category: null }) as StorySupplierLike & { category: string | null };

describe('the tap follows the supplier plan', () => {
  it('Supplier Pro and Ultra raise the rich card first', () => {
    assert.equal(storySupplierTap(s('A', 'enterprise')), 'card');
    assert.equal(storySupplierTap(s('B', 'pro')), 'card');
  });
  it('Supplier Plus, Verified and Free open the shop directly — every booked supplier is tappable', () => {
    for (const t of ['solo', 'verified', 'free'] as const) assert.equal(storySupplierTap(s('C', t)), 'shop');
  });
  it('a supplier the couple added (no shop) is a plain name', () => {
    assert.equal(storySupplierTap(s('Tita Baby’s Cakes', null)), 'none');
    assert.equal(storySupplierTap(s('Shop with no address', 'pro', null)), 'none');
  });
});

describe('the order is Ultra → Pro → Plus → Verified → Free → the couple’s own', () => {
  const list = [s('free1', 'free'), s('own', null), s('ver', 'verified'), s('plus', 'solo'), s('pro', 'pro'), s('ultra', 'enterprise'), s('free2', 'free')];
  it('orders by plan and keeps the couple’s order within one plan', () => {
    assert.deepEqual(orderStorySuppliers(list).map((x) => x.name), ['ultra', 'pro', 'plus', 'ver', 'free1', 'free2', 'own']);
  });
  it('badges read the plan names, never the internal codes', () => {
    assert.deepEqual([storySupplierBadge('enterprise'), storySupplierBadge('pro'), storySupplierBadge('solo'), storySupplierBadge('verified'), storySupplierBadge('free'), storySupplierBadge(null)], [
      'Ultra',
      'Pro',
      'Plus',
      'Verified',
      'Free',
      null,
    ]);
  });
});

describe('a story with 100 suppliers', () => {
  const tiers: VendorTier[] = ['enterprise', 'pro', 'solo', 'verified', 'free'];
  const hundred = Array.from({ length: 100 }, (_, i) => s(`S${i}`, tiers[i % 5]!));
  it('the scene shows the top 8 and "See all N"', () => {
    const lead = storySuppliersLead(hundred);
    assert.equal(lead.shown.length, STORY_SUPPLIERS_TOP);
    assert.equal(lead.more, 92);
    assert.equal(lead.total, 100);
    assert.equal(lead.shown.every((x) => x.tier === 'enterprise'), true);
  });
  it('the sheet groups by plan with counts, Free folded', () => {
    const groups = groupStorySuppliers(hundred);
    assert.deepEqual(groups.map((g) => [g.label, g.items.length, g.folded]), [
      ['Supplier Ultra', 20, false],
      ['Supplier Pro', 20, false],
      ['Supplier Plus', 20, false],
      ['Verified', 20, false],
      ['Free', 20, true],
    ]);
  });
  it('search appears only over 20 and finds by name or service', () => {
    assert.equal(storySuppliersSearchable(20), false);
    assert.equal(storySuppliersSearchable(21), true);
    const list = [{ ...s('Kusina ni Rosa', 'solo'), category: 'catering' }, { ...s('Liwanag Studio', 'pro'), category: 'photo_film' }];
    assert.deepEqual(searchStorySuppliers(list, 'kusina').map((x) => x.name), ['Kusina ni Rosa']);
    assert.deepEqual(searchStorySuppliers(list, 'photo film').map((x) => x.name), ['Liwanag Studio']);
    assert.equal(searchStorySuppliers(list, '  ').length, 2);
  });
  it('a moment shows at most 3 tags, then +N', () => {
    const t = storySupplierTags(hundred.slice(0, 7));
    assert.equal(t.shown.length, 3);
    assert.equal(t.more, 4);
  });
  it('EVERY Supplier Ultra gets a scene — no cap', () => {
    assert.equal(ultraSuppliers(hundred).length, 20);
  });
});

describe('a small story', () => {
  it('one group only is never folded, and the couple’s own come last', () => {
    const g = groupStorySuppliers([s('a', 'free'), s('own', null)]);
    assert.deepEqual(g.map((x) => [x.key, x.folded]), [
      ['free', true],
      ['own', false],
    ]);
    assert.equal(groupStorySuppliers([s('a', 'free')])[0]!.folded, false);
  });
  it('initials', () => {
    assert.equal(supplierInitials('Talulot Florals'), 'TF');
    assert.equal(supplierInitials('The Ridge, Tagaytay'), 'TR');
    assert.equal(supplierInitials('Tita Baby’s Cakes'), 'TB');
    assert.equal(supplierInitials('Emcee'), 'E');
  });
});

describe('the views carry the links, decided on the server', () => {
  it('a Pro card opens the shop attributed to the story, Book opens its Inquire pop-up; a self-added one links nowhere', async () => {
    const { toStorySupplierViews } = await import('./story-suppliers');
    const views = toStorySupplierViews(
      [
        { name: 'Own cake', tier: null, slug: null, category: 'cake', logoUrl: null },
        { name: 'Liwanag Studio', tier: 'pro', slug: 'liwanag', category: 'photo_film', logoUrl: null, card: { coverUrl: null, bestWork: [], rating: 4.9, reviews: 41 } },
      ],
      'maria-jose',
    );
    assert.equal(views[0]!.name, 'Liwanag Studio');
    assert.equal(views[0]!.tap, 'card');
    assert.equal(views[0]!.service, 'Photo film');
    assert.match(views[0]!.shopHref!, /^\/v\/liwanag\?src=/);
    assert.match(views[0]!.bookHref!, /inquire=1/);
    assert.equal(views[0]!.planName, 'Supplier Pro');
    assert.equal(views[1]!.shopHref, null);
    assert.equal(views[1]!.bookHref, null);
    assert.equal(views[1]!.card, null);
  });
});
