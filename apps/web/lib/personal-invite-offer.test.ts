/**
 * THE PERSONAL INVITE'S OFFER — what the admin form accepts and what the card, the door and the message say.
 * Prototype `supplier_personal_invite_2026-10-23.html` (owner-approved), frames A2 · A3 · B1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERSONAL_INVITE_PHOTO_ALLOWANCE,
  doorOffer,
  offerFromInvite,
  offerPill,
  offerResultLine,
  offerUntilInstant,
  parsePersonalInviteOffer,
  personalInviteMessage,
  planChoicesLine,
  planMenuNote,
} from './personal-invite-offer';
import { personalInviteCardSvg } from './personal-invite-card';
import { FIRST_BOOKING_ON_US } from './booking-fee-lock';
import { PORTFOLIO_FREE_BASE } from './vendor-tier-caps';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRICES = { solo: 1000, pro: 2500, enterprise: 8000 };

test('the 100 is the owner’s number, above the every-plan base', () => {
  assert.equal(PERSONAL_INVITE_PHOTO_ALLOWANCE, 100);
  assert.ok(PERSONAL_INVITE_PHOTO_ALLOWANCE > PORTFOLIO_FREE_BASE);
});

test('the form: Free + switch off is no offer; a plan needs a day after today; the switch gives exactly 100', () => {
  const today = '2026-10-23';
  assert.deepEqual(parsePersonalInviteOffer({ tier: 'free', until: null, photos: null }, today), {
    ok: true,
    offer: { tier: null, untilDay: null, photos: null },
  });
  assert.deepEqual(parsePersonalInviteOffer({ tier: '', until: '', photos: 'on' }, today), {
    ok: true,
    offer: { tier: null, untilDay: null, photos: 100 },
  });
  assert.deepEqual(parsePersonalInviteOffer({ tier: 'pro', until: '2027-01-31', photos: 'on' }, today), {
    ok: true,
    offer: { tier: 'pro', untilDay: '2027-01-31', photos: 100 },
  });
  assert.equal(parsePersonalInviteOffer({ tier: 'pro', until: '', photos: null }, today).ok, false);
  assert.equal(parsePersonalInviteOffer({ tier: 'pro', until: today, photos: null }, today).ok, false, 'a gift that ends today');
  assert.equal(parsePersonalInviteOffer({ tier: 'verified', until: '2027-01-31', photos: null }, today).ok, false);
  assert.equal(parsePersonalInviteOffer({ tier: 'custom', until: '2027-01-31', photos: null }, today).ok, false);
});

test('the last free day ends at 23:59:59 Manila, and reads back as that day', () => {
  const iso = offerUntilInstant('2027-01-31');
  assert.equal(iso, '2027-01-31T15:59:59.000Z');
  assert.deepEqual(offerFromInvite({ offer_tier: 'pro', offer_until: iso, offer_photo_allowance: 100 }), {
    tier: 'pro',
    untilDay: '2027-01-31',
    photos: 100,
  });
  // An unknown plan or an unreadable date is no plan — never a guess.
  assert.deepEqual(offerFromInvite({ offer_tier: 'gold', offer_until: iso, offer_photo_allowance: null }), {
    tier: null,
    untilDay: null,
    photos: null,
  });
});

test('the card pill, the result line and the door rows say the prototype’s words', () => {
  const o = { tier: 'pro' as const, untilDay: '2027-01-31', photos: null };
  assert.equal(offerPill(o), 'Pro · free until 31 Jan 2027');
  assert.equal(offerPill({ ...o, photos: 100 }), 'Pro · free until 31 Jan 2027 · 100 portfolio photos');
  assert.equal(offerResultLine(o), 'Pro, free until 31 Jan 2027 — written when they claim.');
  assert.equal(offerPill({ tier: null, untilDay: null, photos: null }), null);
  const door = doorOffer({ ...o, photos: 100 });
  assert.deepEqual(door?.plan, { word: 'Pro', until: '31 Jan 2027' });
  assert.equal(door?.photos, 100);
  assert.equal(door?.note, 'Nothing to pay, nothing renews by itself. On 1 Feb you choose: stay on Free, or keep Pro.');
  assert.equal(doorOffer({ tier: 'enterprise', untilDay: '2027-01-31', photos: null })?.plan?.word, 'Ultra');
  assert.equal(doorOffer({ tier: null, untilDay: null, photos: null }), null, 'no offer → no rows');
});

test('the dropdown and the message read the catalogue — a plan with no price is named without one', () => {
  assert.equal(planMenuNote('free', PRICES), 'no gift');
  assert.equal(planMenuNote('pro', PRICES), '₱2,500 / 28 days');
  assert.equal(planMenuNote('enterprise', { solo: 1000 }), null);
  assert.equal(planChoicesLine(PRICES), 'Free, Solo ₱1,000, Pro ₱2,500 or Ultra ₱8,000 / 28 days');
  assert.equal(planChoicesLine({ solo: 1000, pro: 2500 }), 'Free, Solo ₱1,000, Pro ₱2,500 or Ultra / 28 days');
});

test('the message: the offer, the live free-booking sentence, the launch offer only while it runs, the link', () => {
  const base = {
    businessName: 'Tita Nena’s Catering',
    offer: { tier: 'pro' as const, untilDay: '2027-01-31', photos: 100 },
    prices: PRICES,
    claimUrl: 'https://setnayan.com/vendor/claim/abc',
  };
  const open = personalInviteMessage({ ...base, launchCapWords: '2,000' });
  assert.match(open, /^Hi Tita Nena’s Catering — your Setnayan shop is set up\./);
  assert.match(open, /Your offer: Pro, free until 31 Jan 2027, and 100 portfolio photos, yours to keep\./);
  assert.match(open, /Free, Solo ₱1,000, Pro ₱2,500 or Ultra ₱8,000 \/ 28 days\. Nothing renews by itself\./);
  assert.ok(open.includes(FIRST_BOOKING_ON_US), 'the free booking is not the live sentence');
  assert.match(open, /While Setnayan's first 2,000 bookings run, there is no booking fee at all\./);
  assert.ok(open.trimEnd().endsWith(base.claimUrl));
  const closed = personalInviteMessage({ ...base, launchCapWords: null });
  assert.doesNotMatch(closed, /2,000/, 'the launch offer is said while it is not running');
  const none = personalInviteMessage({ ...base, offer: { tier: null, untilDay: null, photos: null }, launchCapWords: null });
  assert.doesNotMatch(none, /Your offer/);
});

test('the card is one SVG: the name, the styled QR with the Setnayan mark, the pill, the link in words — escaped', () => {
  const svg = personalInviteCardSvg({
    businessName: 'Rosa & <Co>',
    categoryLabel: 'Catering',
    claimUrl: 'https://setnayan.com/vendor/claim/abc',
    pill: 'Pro · free until 31 Jan 2027',
  });
  assert.match(svg, /^<svg [^>]*data-invite-card=""/);
  assert.ok(svg.includes('Rosa &amp; &lt;Co&gt;'), 'the name is not escaped');
  assert.ok(!svg.includes('<Co>'));
  assert.match(svg, /data-qr-centre="setnayan"/, 'the QR is not the shipped drawing with the Setnayan mark');
  assert.match(svg, /data-card-offer="">Pro · free until 31 Jan 2027</);
  assert.ok(svg.includes('setnayan.com/vendor/claim/abc'));
  assert.ok(svg.includes('CATERING · YOUR SHOP IS READY'));
  const bare = personalInviteCardSvg({ businessName: 'X', categoryLabel: null, claimUrl: 'https://s.com/c/x', pill: null });
  assert.doesNotMatch(bare, /data-card-offer/);
});

test('no price is typed in the offer module or the card — they read what they are handed', () => {
  for (const f of ['lib/personal-invite-offer.ts', 'lib/personal-invite-card.ts', 'app/admin/vendors/_components/invite-vendor-form.tsx']) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.doesNotMatch(src, /₱\s?\d|\b(?:1000|2500|8000|1,000|2,500|8,000)\b/, `${f} types a price`);
  }
});
