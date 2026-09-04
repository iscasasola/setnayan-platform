/**
 * moodboard-gallery-upload.test.ts — MB11's decision core, under attack.
 *
 * Every rule here was SABOTAGED before it was trusted: the rule was inverted or
 * widened on purpose, this file was run, the failure was read, and the rule was
 * restored. What each sabotage proved is recorded on the test it proved it for.
 * A guard that has never gone red is a guard nobody has tested.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backCatalogueQuotaVerdict,
  contentRejectionMessage,
  findOwnContactHits,
  isUsableNeedle,
  ownContactNeedles,
  qrHit,
  slotUploadVerdict,
  uploadableSlotsForShop,
  GALLERY_SLOT_LABEL,
  RIGHTS_WARRANTY_TEXT,
  RIGHTS_WARRANTY_VERSION,
} from './moodboard-gallery-upload';
import { TIER_CAPS, tierCaps } from './vendor-tier-caps';
import { GALLERY_SLOT_KEYS, canonicalServicesForSlot } from './moodboard-gallery';

/* ══════════════════════════════════════════════════════════════════════════
   THE TRADE GATE — the lock that kept this page unused since May 2026
   ══════════════════════════════════════════════════════════════════════════ */

test('the supplying trades can upload — not just reception_decor', () => {
  // The shipped gate was `services.includes('reception_decor')`. These five
  // trades are the ones MB11 names, and every one of them was refused by it.
  const cases: Array<[string, string]> = [
    ['flowers', 'florist'],
    ['cake', 'cake'],
    ['bride', 'brides_attire'],
    ['table', 'stylist_decorator'],
    ['cocktail', 'mobile_bar'],
  ];
  for (const [slot, tile] of cases) {
    const services = canonicalServicesForSlot(slot);
    assert.ok(
      services.length > 0,
      `${slot} should have canonical services (via ${tile})`,
    );
    const verdict = slotUploadVerdict(slot, services);
    assert.equal(verdict.allowed, true, `${slot} should admit its own trades`);
  }
});

test('a florist cannot upload into the cake shelf', () => {
  const floristServices = canonicalServicesForSlot('flowers');
  const verdict = slotUploadVerdict('cake', floristServices);
  assert.equal(verdict.allowed, false);
  if (!verdict.allowed) assert.equal(verdict.reason, 'wrong_trade');
});

test('palette admits nobody — a colour reference is no shop’s portfolio', () => {
  const everyService = GALLERY_SLOT_KEYS.flatMap((k) => canonicalServicesForSlot(k));
  const verdict = slotUploadVerdict('palette', everyService);
  assert.equal(verdict.allowed, false);
  assert.equal(GALLERY_SLOT_LABEL.palette, null);
});

test('every gallery slot has a supplier-facing label', () => {
  // The Record is over the FULL slot union, so a new slot is a compile error.
  // This asserts the runtime half: a slot that HAS a supplying trade must have
  // a name to show the supplier, or the picker renders a blank option.
  for (const k of GALLERY_SLOT_KEYS) {
    assert.ok(GALLERY_SLOT_LABEL[k], `slot ${k} needs a supplier-facing label`);
  }
});

test('the picker offers only the shop’s own shelves', () => {
  const florist = uploadableSlotsForShop(canonicalServicesForSlot('flowers'));
  assert.ok(florist.length > 0);
  assert.ok(florist.every((s) => s.label.length > 0));
  assert.equal(uploadableSlotsForShop([]).length, 0);
  assert.equal(uploadableSlotsForShop(null).length, 0);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE QUOTA — back-catalogue only, and event-linked NEVER counted
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: the quota counts back-catalogue and nothing else', () => {
  // Sabotage run: `backCatalogueQuotaVerdict` was changed to drop the
  // `mode === 'event_linked'` early return, so event-linked uploads fell
  // through to the same `used >= cap` branch. This test went RED on the first
  // assertion below (a shop at 40 event-linked photos, cap 20, was refused),
  // which is exactly the failure the brief names — a shop rationed for the
  // weddings it actually worked. Restored.
  const cap = tierCaps('free').galleryBackCatalogPhotosPerCategory;
  assert.equal(
    cap,
    20,
    'MB19: every tier, including free, now holds a per-category back-catalogue allowance',
  );

  const eventLinked = backCatalogueQuotaVerdict({
    mode: 'event_linked',
    cap,
    backCatalogueUsed: 40,
    categoryLabel: 'Flowers',
  });
  assert.equal(eventLinked.allowed, true, 'event-linked is never rationed, even past the cap');
  assert.equal(eventLinked.message, '');
});

test('MB19: a free-tier shop may now back-catalogue at all', () => {
  // Before MB19, free/verified/solo read 0 here and the branch below refused
  // unconditionally. The owner's 2026-09-04 ruling opens back-catalogue
  // uploads to every tier, free included, at 20 per category.
  const cap = tierCaps('free').galleryBackCatalogPhotosPerCategory;
  assert.equal(
    backCatalogueQuotaVerdict({ mode: 'event_linked', cap, backCatalogueUsed: 0, categoryLabel: 'Flowers' })
      .allowed,
    true,
  );
  const back = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap,
    backCatalogueUsed: 0,
    categoryLabel: 'Flowers',
  });
  assert.equal(back.allowed, true, 'free tier is no longer shut out of back-catalogue uploads');
});

test('the owner’s figure is the ladder: 20, per category, every tier', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'] as const) {
    assert.equal(
      TIER_CAPS[tier].galleryBackCatalogPhotosPerCategory,
      20,
      `${tier}: MB19 opened back-catalogue to every tier at the same per-category cap`,
    );
  }
});

test('the NEW ladder never overwrote the portfolio ladder beside it', () => {
  // MB11: "add the per-category pair ALONGSIDE the existing quota precedent —
  // never overwriting it". These are the shipped portfolioPhotos figures; if a
  // future edit collapses the two axes into one, this goes red.
  assert.equal(TIER_CAPS.free.portfolioPhotos, 30);
  assert.equal(TIER_CAPS.pro.portfolioPhotos, 100);
  assert.equal(TIER_CAPS.enterprise.portfolioPhotos, 300);
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'] as const) {
    assert.notEqual(
      TIER_CAPS[tier].portfolioPhotos,
      TIER_CAPS[tier].galleryBackCatalogPhotosPerCategory,
      `${tier}: the two photo ladders must stay distinct numbers`,
    );
  }
});

test('the ceiling refuses the (cap+1)th, names the category, and drops the tier framing', () => {
  const cap = TIER_CAPS.pro.galleryBackCatalogPhotosPerCategory;
  assert.equal(
    backCatalogueQuotaVerdict({
      mode: 'back_catalogue',
      cap,
      backCatalogueUsed: cap - 1,
      categoryLabel: 'Flowers',
    }).allowed,
    true,
  );
  const full = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap,
    backCatalogueUsed: cap,
    categoryLabel: 'Flowers',
  });
  assert.equal(full.allowed, false);
  assert.match(full.message, new RegExp(String(cap)));
  assert.match(full.message, /never count/);
  assert.match(full.message, /Flowers/, 'MB19: the refusal must name the category');
  assert.doesNotMatch(
    full.message,
    /on your plan/,
    'MB19: every tier shares the cap now, so this is no longer a tier statement',
  );
});

test('an over-cap shop is refused a NEW row, never told to delete one', () => {
  // Grandfathering is the default behaviour: the check is on new inserts, so a
  // shop that is already over (a looser ladder, or an event deleted and its
  // photos demoted) keeps everything it has.
  const v = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap: 20,
    backCatalogueUsed: 55,
    categoryLabel: 'Flowers',
  });
  assert.equal(v.allowed, false);
  assert.equal(v.used, 55, 'the true count is reported, not clamped to the cap');
});

test('the quota is scoped per category — the same shop, two different categories, two different verdicts', () => {
  // MB19's whole point: a shop full on Flowers may still upload to Tables.
  // This is the pure-function half of that guarantee; the DB half (the
  // `asset_subtype` predicate on the actual count query) is pinned in
  // tests/db/the-back-catalogue-quota-counts-the-right-rows.db.test.ts.
  const cap = TIER_CAPS.pro.galleryBackCatalogPhotosPerCategory;
  const flowersFull = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap,
    backCatalogueUsed: cap,
    categoryLabel: 'Flowers',
  });
  const tablesEmpty = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap,
    backCatalogueUsed: 0,
    categoryLabel: 'Table styling',
  });
  assert.equal(flowersFull.allowed, false, 'Flowers is full');
  assert.equal(tablesEmpty.allowed, true, 'Tables has its own, separate room');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE RIGHTS WARRANTY
   ══════════════════════════════════════════════════════════════════════════ */

test('the warranty version and its wording travel together', () => {
  assert.match(RIGHTS_WARRANTY_VERSION, /^gallery-rights-v\d+-\d{4}-\d{2}-\d{2}$/);
  assert.ok(RIGHTS_WARRANTY_TEXT.length > 80, 'the wording must be a real sentence');
  // The three things the warranty has to actually assert.
  assert.match(RIGHTS_WARRANTY_TEXT, /rights to publish/i);
  assert.match(RIGHTS_WARRANTY_TEXT, /agreed/i);
  assert.match(RIGHTS_WARRANTY_TEXT, /credited/i);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE CONTACT CHECK — scoped to ONE shop's own values
   ══════════════════════════════════════════════════════════════════════════ */

const BLOOM = {
  business_name: 'Bloom & Vine Wedding Studio',
  contact_phone: '0917 880 7163',
  contact_email: 'hello@bloomandvine.ph',
  website: 'https://bloomandvine.ph',
};

test('a photo carrying the shop’s OWN number is blocked, and told why', () => {
  const needles = ownContactNeedles(BLOOM);
  const hits = findOwnContactHits('Call us 0917-880-7163 for bookings', needles);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.kind, 'phone');
  const message = contentRejectionMessage(hits);
  assert.match(message, /your phone number/);
  assert.match(message, /clean version/);
  // NEVER a bare refusal, never a ban.
  assert.doesNotMatch(message, /invalid|banned|suspend/i);
});

test('+63 and 0917 are the same number', () => {
  const needles = ownContactNeedles(BLOOM);
  assert.equal(findOwnContactHits('+639178807163', needles).length, 1);
  assert.equal(findOwnContactHits('0 9 1 7 8 8 0 7 1 6 3', needles).length, 1);
});

test('SABOTAGE-PROVEN: a GENERIC phone pattern would bounce honest photos', () => {
  // Sabotage run: `findOwnContactHits` was widened so `digitsOnly` needles
  // matched ANY run of >= 10 digits in the photo's text rather than the shop's
  // own number. Every assertion in this test went RED — a save-the-date with
  // the COUPLE'S number on it, and a menu card with a long price list, both
  // became "we found your phone number in this photo", accusing a supplier of
  // something they did not do. Restored to the scoped match.
  const needles = ownContactNeedles(BLOOM);

  // The couple's own mobile, printed on their own save-the-date, in the
  // supplier's photograph of it. Not the supplier's number → not our business.
  assert.deepEqual(findOwnContactHits('RSVP to Ana 0918 224 5590', needles), []);

  // A price / pax line, the exact shape chat-contact-filter.ts had to retune
  // for its card profile.
  assert.deepEqual(
    findOwnContactHits('Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff', needles),
    [],
  );

  // Table numbers and a date.
  assert.deepEqual(findOwnContactHits('Table 12 · 02 14 2027', needles), []);
});

test('the shop’s name matches only when every distinctive word is present', () => {
  const needles = ownContactNeedles(BLOOM);
  assert.equal(findOwnContactHits('Bloom & Vine', needles).length, 1);
  // "Bloom" alone on a napkin, or the generic half of the name, is not a hit.
  assert.deepEqual(findOwnContactHits('bloom', needles), []);
  assert.deepEqual(findOwnContactHits('Wedding Studio', needles), []);
});

test('generic needles are dropped rather than matched', () => {
  // A shop whose website is a free host, and whose name is all generic words,
  // gives us nothing distinctive. The check must simply not run for those
  // fields — a block we cannot justify is worse than no block.
  const generic = ownContactNeedles({
    business_name: 'The Wedding Studio',
    website: 'https://www.facebook.com/thestudio',
    contact_email: 'a@b.co',
    contact_phone: '123',
  });
  assert.deepEqual(generic, [], 'nothing here is distinctive enough to accuse with');

  assert.equal(
    isUsableNeedle({ kind: 'website', needle: 'gmail.com', display: 'gmail.com' }),
    false,
  );
  assert.equal(
    isUsableNeedle({ kind: 'website', needle: 'bloomandvine.ph', display: 'bloomandvine.ph' }),
    true,
  );
});

test('a shop with no profile fields at all produces no needles and no hits', () => {
  const needles = ownContactNeedles({});
  assert.deepEqual(needles, []);
  assert.deepEqual(findOwnContactHits('anything at all 0917 880 7163', needles), []);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE REJECTION MESSAGE — a gate they can clear, not a wall
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: a generic rejection is caught', () => {
  // Sabotage run: `contentRejectionMessage` was replaced with a constant
  // "We can't add this photo." Both assertions below went RED — the message no
  // longer named what was found, which is the difference between a supplier
  // fixing it in a minute and re-uploading the same photo forever. Restored.
  const message = contentRejectionMessage([qrHit('https://example.com/book')]);
  assert.match(message, /a QR code/, 'the rejection must NAME what was found');
  assert.match(message, /without it/, 'and must say what to do about it');
});

test('several findings are all named, not summarised', () => {
  const message = contentRejectionMessage(
    findOwnContactHits('hello@bloomandvine.ph · bloomandvine.ph', ownContactNeedles(BLOOM)),
  );
  assert.match(message, /your email address/);
  assert.match(message, /your website address/);
});

test('nothing found is an empty message, never a refusal', () => {
  assert.equal(contentRejectionMessage([]), '');
});
