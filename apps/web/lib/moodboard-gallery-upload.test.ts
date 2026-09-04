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
  // assertion below (a free shop at 40 event-linked photos was refused), which
  // is exactly the failure the brief names — a shop rationed for the weddings
  // it actually worked. Restored.
  const free = tierCaps('free').galleryBackCatalogPhotos;
  assert.equal(free, 0, 'free tier holds no back-catalogue allowance');

  const eventLinked = backCatalogueQuotaVerdict({
    mode: 'event_linked',
    cap: free,
    backCatalogueUsed: 40,
  });
  assert.equal(eventLinked.allowed, true, 'event-linked is never rationed');
  assert.equal(eventLinked.message, '');
});

test('free tier can event-link but not back-catalogue', () => {
  const cap = tierCaps('free').galleryBackCatalogPhotos;
  assert.equal(
    backCatalogueQuotaVerdict({ mode: 'event_linked', cap, backCatalogueUsed: 0 })
      .allowed,
    true,
  );
  const back = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap,
    backCatalogueUsed: 0,
  });
  assert.equal(back.allowed, false);
  // The refusal must say what they CAN do, not just what they cannot.
  assert.match(back.message, /booked on/);
});

test('the owner’s two figures are the ladder: pro 20 · enterprise 100', () => {
  assert.equal(TIER_CAPS.pro.galleryBackCatalogPhotos, 20);
  assert.equal(TIER_CAPS.enterprise.galleryBackCatalogPhotos, 100);
  // Custom runs as Enterprise on every axis (vendor-tier-caps.ts lock).
  assert.equal(TIER_CAPS.custom.galleryBackCatalogPhotos, 100);
});

test('the NEW ladder never overwrote the portfolio ladder beside it', () => {
  // MB11: "add the 20/100 pair ALONGSIDE the existing quota precedent — never
  // overwriting it". These are the shipped portfolioPhotos figures; if a future
  // edit collapses the two axes into one, this goes red.
  assert.equal(TIER_CAPS.free.portfolioPhotos, 30);
  assert.equal(TIER_CAPS.pro.portfolioPhotos, 100);
  assert.equal(TIER_CAPS.enterprise.portfolioPhotos, 300);
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'] as const) {
    assert.notEqual(
      TIER_CAPS[tier].portfolioPhotos,
      TIER_CAPS[tier].galleryBackCatalogPhotos,
      `${tier}: the two photo ladders must stay distinct numbers`,
    );
  }
});

test('the ceiling refuses the (cap+1)th and names the remedy', () => {
  const cap = TIER_CAPS.pro.galleryBackCatalogPhotos;
  assert.equal(
    backCatalogueQuotaVerdict({ mode: 'back_catalogue', cap, backCatalogueUsed: cap - 1 })
      .allowed,
    true,
  );
  const full = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap,
    backCatalogueUsed: cap,
  });
  assert.equal(full.allowed, false);
  assert.match(full.message, new RegExp(String(cap)));
  assert.match(full.message, /never count/);
});

test('an over-cap shop is refused a NEW row, never told to delete one', () => {
  // Grandfathering is the default behaviour: the check is on new inserts, so a
  // shop that is already over (a looser ladder, or an event deleted and its
  // photos demoted) keeps everything it has.
  const v = backCatalogueQuotaVerdict({
    mode: 'back_catalogue',
    cap: 20,
    backCatalogueUsed: 55,
  });
  assert.equal(v.allowed, false);
  assert.equal(v.used, 55, 'the true count is reported, not clamped to the cap');
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
