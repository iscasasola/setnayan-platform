/**
 * The vendor's card LIST and the card EDITOR draw the same card.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * *"we want to show the actual service cards."* The list row was a grey wrench
 * glyph, a title and one line of text; the real card — cover, discount badge,
 * inclusions, the Setnayan Exclusive teaser — existed only inside the collapsed
 * "Edit details" editor. The instruction the preview component already carried,
 * *"when we create a service card, we want to see the exact card"*, had reached
 * the editor and never the list.
 *
 * 🔑 THE RISK IN FIXING IT WAS A SECOND RENDERER. A card is a promise about
 * what a couple sees; two implementations of "from ₱X", of which discount wins,
 * of what counts as not-included, agree on the day they are written and drift
 * at the first pricing change. So the list feeds the STORED row through the very
 * same `readSnapshot` the live form uses, and both draw `ServiceCardFace`.
 *
 * These tests pin that: the two snapshot paths agree on identical input, and
 * neither surface hand-draws a card of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { readSnapshot, snapshotFromService } from '@/lib/service-card-snapshot';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

test('a stored row and the equivalent form produce the SAME snapshot', () => {
  const card = {
    title: 'Live Band',
    category: 'live_band',
    pricing_basis: 'fixed',
    starting_price_php: 35000,
    crew_meal_included: true,
    transport_included: false,
    transport_flat_fee_php: 2000,
    exclusive_perk_text: 'Free 1-hour extension',
    primary_photo_r2_key: 'r2://media/cover.jpg',
  };
  const discounts = [{ discount_type: 'early_booking', rate: 10, unit: 'pct' }];
  const inclusions = [{ label: 'Sound system', worth_php: 5000 }];

  const fd = new FormData();
  fd.append('title', 'Live Band');
  fd.append('category', 'live_band');
  fd.append('pricing_basis', 'fixed');
  fd.append('starting_price_php', '35000');
  fd.append('crew_meal_included', 'on');
  fd.append('transport_flat_fee_php', '2000');
  fd.append('exclusive_perk_text', 'Free 1-hour extension');
  fd.append('primary_photo_r2_key', 'r2://media/cover.jpg');
  fd.append('discount_type', 'early_booking');
  fd.append('discount_rate', '10');
  fd.append('discount_unit', 'pct');
  fd.append('inclusion_label', 'Sound system');
  fd.append('inclusion_worth', '5000');

  assert.deepEqual(
    snapshotFromService(card, { discounts, inclusions }),
    readSnapshot(fd),
    'the list and the editor would show different cards for the same service',
  );
});

test('an unchecked "included" flag is OMITTED, not sent as "false"', () => {
  // `readSnapshot` tests these against the literal 'on'. Writing 'false' would
  // read as "not on" by accident, and would keep working right up until someone
  // made the check truthiness-based — at which point every card would silently
  // claim a crew meal it does not include.
  const snap = snapshotFromService({
    title: 'X',
    pricing_basis: 'fixed',
    starting_price_php: 1,
    crew_meal_included: false,
    transport_included: false,
  });
  assert.ok(
    snap.notIncluded.includes('crew meal'),
    'an unincluded crew meal stopped being listed as not-included',
  );
});

test('a card with no price still draws — it does not throw or blank', () => {
  const snap = snapshotFromService({ title: 'Host Mc', pricing_basis: 'fixed' });
  assert.equal(snap.name, 'Host Mc');
  assert.match(snap.priceText, /₱—/, 'a priceless card lost its "from ₱—" placeholder');
});

test('the LIST renders the COUPLE\'S card, built by the shared builder', () => {
  // Superseded the interim step: the list first showed `ServiceCardFace` (the
  // vendor-side approximation) instead of a wrench glyph, and now shows the
  // real thing — owner: *"there is already a template of how a service card
  // looks like. all we want is for that to show instead of this."*
  const manager = src('../app/vendor-dashboard/services/_components/services-manager.tsx');
  assert.match(manager, /<ServiceCardView\b/, 'the card list stopped rendering the couple’s card');
  assert.match(
    manager,
    /toServiceCard\(/,
    'the list builds its card some other way than the builder the public profile uses',
  );
  assert.ok(
    !/<ServiceCardFace\b/.test(manager),
    'the list is back to the vendor-side approximation instead of the real card',
  );
});

test('the EDITOR renders the same face, and re-implements neither half', () => {
  const preview = src(
    '../app/vendor-dashboard/services/_components/service-card-live-preview.tsx',
  );
  assert.match(preview, /<ServiceCardFace\b/, 'the editor preview stopped using the shared face');
  assert.match(preview, /readSnapshot/, 'the editor preview stopped using the shared reader');
  assert.ok(
    !/function readSnapshot/.test(preview),
    'the editor preview grew its own copy of readSnapshot — the two will drift',
  );
});

test('the face itself holds no form access and no state', () => {
  const face = src('../app/vendor-dashboard/services/_components/service-card-face.tsx');
  assert.ok(
    !/useState|useEffect|FormData|closest\('form'\)/.test(face),
    'the presentational face grew state or form access; it is rendered on the ' +
      'server in the list, where neither exists',
  );
});

/**
 * ── AND NOTHING OFFERS A CHOICE THE GATE WILL REFUSE ───────────────────────
 * Measured 2026-09-08, owner watching a save fail: the maker's price region
 * read *"Add a price — couples look for it first. **Or leave it as
 * price-on-request.**"* while `PUBLISH_REQUIREMENTS` has included `'price'`
 * since the owner drew the rule on 2026-08-28 (`prototypes/
 * shop_rooms_made_easy_2026-08-28.html`: *"Publish stays shut until the price
 * is in"*), and the DB trigger `enforce_service_publish_gate` enforces it.
 *
 * So a live card left at price-on-request could not be saved at all, and the
 * refusal named a field the copy had just told the supplier was optional.
 *
 * 🔑 THE COPY WAS THE STALE HALF, NOT THE GATE. The gate is a dated owner
 * decision with a prototype behind it; the sentence was an older promise nobody
 * retired. This fails if that promise comes back while the requirement stands —
 * change the requirement first, and this test will let the sentence back in.
 */
test('no supplier-facing copy offers price-on-request while a price is required', async () => {
  const { PUBLISH_REQUIREMENTS } = await import('@/lib/service-publish-gate');
  if (!(PUBLISH_REQUIREMENTS as readonly string[]).includes('price')) return; // rule changed; the offer is legitimate again
  for (const rel of [
    '../app/vendor-dashboard/services/_components/canvas-maker.tsx',
    '../app/vendor-dashboard/services/_components/services-manager.tsx',
    '../app/vendor-dashboard/services/_components/service-wizard.tsx',
  ]) {
    assert.ok(
      !/price-on-request|price on request|leave it blank/i.test(src(rel)),
      `${rel} still offers price-on-request, but a price is required to publish — ` +
        'a supplier who takes that offer cannot save the card at all',
    );
  }
});

/**
 * ── AND THE PREVIEW MUST NOT CLAIM TO BE THE COUPLE'S CARD ─────────────────
 * Measured 2026-09-08: this preview captioned itself *"Card preview · exactly
 * what couples see"*, and it is not. The card a couple actually gets is
 * `ServiceCardView` in `app/v/[slug]/_components/services-gallery.tsx`, which
 * shows the showcase PHOTO STRIP, the showcase VIDEO, inclusions as a ✓
 * checklist with "+N more included", and the shop's `CardRecordSection` —
 * none of which this preview draws.
 *
 * 🔑 A CAPTION IS A CLAIM. Calling an approximation "exactly what couples see"
 * is how a vendor concludes their card has no photos on it, or that it does.
 * The preview is useful; the promise was not true. If the two are ever really
 * unified, delete this test in the same PR that unifies them.
 */
test('the preview does not claim to be exactly what couples see', () => {
  const preview = src(
    '../app/vendor-dashboard/services/_components/service-card-live-preview.tsx',
  );
  assert.ok(
    !/exactly what couples see|what couples see/i.test(preview),
    'the preview claims to be the couple-facing card. It is not — the real one ' +
      'is ServiceCardView in app/v/[slug]/_components/services-gallery.tsx, and ' +
      'it carries the photo strip, the video and the card record this does not.',
  );
});

/**
 * ── ONE CARD, ONE BUILDER, ACROSS BOTH SIDES OF THE APP ────────────────────
 * `toServiceCard` and `ServiceCardView` moved out of `app/v/[slug]` so the
 * vendor's own list can render the identical card. The failure mode this
 * prevents is not a crash — it is a vendor being shown a card that is subtly
 * not the one couples get, and having no way to tell.
 */
test('the PUBLIC PROFILE still uses the same builder and the same view', () => {
  const page = src('../app/v/[slug]/page.tsx');
  const gallery = src('../app/v/[slug]/_components/services-gallery.tsx');
  assert.match(page, /toServiceCard\(/, 'the public profile stopped using the shared builder');
  assert.ok(
    !/^function toServiceCard\(/m.test(page),
    'the public profile grew its own copy of toServiceCard — the two will drift',
  );
  assert.match(gallery, /<ServiceCardView\b/, 'the public gallery stopped rendering the shared view');
  assert.ok(
    !/^function ServiceCardView\(/m.test(gallery),
    'the public gallery grew its own copy of ServiceCardView',
  );
});

test('the card view can be rendered by a SERVER component', () => {
  // The vendor list is a server component. If `onOpen` were required again, the
  // only ways out are a client wrapper that exists to satisfy a type, or a
  // second non-interactive copy of the card — and the second copy is precisely
  // what moving this component out was meant to prevent.
  const view = src('../app/_components/service-card-view.tsx');
  assert.match(view, /onOpen\?:\s*\(\)\s*=>\s*void/, 'onOpen went back to required');
  assert.ok(
    !/onOpen:\s*\(\)\s*=>\s*void;/.test(view),
    'onOpen is required again — a server component can no longer render the card',
  );
});

test('the vendor sees its own figures — the list never strips prices', () => {
  // `hidePrices` is a PUBLIC choice. Passing the shop's own setting here would
  // hide a vendor's prices from the vendor, on the screen where they set them.
  const manager = src('../app/vendor-dashboard/services/_components/services-manager.tsx');
  const call = manager.slice(manager.indexOf('toServiceCard('));
  const args = call.slice(0, call.indexOf('detailsEnabled={false}'));
  assert.ok(
    !/hidePrices/.test(args),
    'the vendor list passes a hidePrices flag; a shop must always see its own numbers',
  );
});
