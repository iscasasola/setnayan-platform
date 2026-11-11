/**
 * 🚫 FAIR PRESENTATION — the rules (owner 2026-11-08). The wiring is proven by
 * `app/vendor-dashboard/fair-presentation-is-asked-everywhere.test.ts`.
 *
 * Every case the owner named is here verbatim: "N0. 1 · b e s t · #1️⃣", "0001 is still number 1", "no emojis as
 * well", and the quantities that must PASS ("100 guests", "1 photographer").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BAIT_PRICE_RULE_ON,
  CARD_NAME_MAX,
  FAIR_FIELD_CHECKS,
  FAIR_LINE_LEAD,
  FAIR_PRESENTATION_CHECKS,
  FAIR_WHY_WE_CHECK,
  baitPriceVerdict,
  fairLine,
  fairNoticeLine,
  fairRefusal,
  findEmoji,
  findFairHits,
  findRankForm,
  findShouting,
  findStuffing,
  isPlaceholder,
  type FairField,
} from './fair-presentation';
import { findClaimWords } from './service-card-checks';

/** The 8 Nov list as #7480 seeds it (a slice is enough to prove the matcher). */
const WORDS = ['best', 'the best', '#1', 'no. 1', 'number one', 'top', 'trending', 'official', 'as seen on', 'sikat'].map((phrase) => ({ phrase, why: 'w' }));

const checksOf = (field: FairField, value: string, extra: Partial<{ siblings: string[] }> = {}) =>
  findFairHits([{ field, value }], { words: WORDS, siblingNames: extra.siblings }).map((h) => h.check);

// ── disguised claim words ────────────────────────────────────────────────────

test('disguised forms of a listed word are found: spaced, dotted, look-alike, full-width, keycap', () => {
  const hit = (v: string) => findClaimWords([{ field: 'name', value: v }], WORDS).map((h) => h.phrase);
  assert.deepEqual(hit('b e s t mobile bar'), ['best']);
  assert.deepEqual(hit('B.E.S.T Lights'), ['best']);
  assert.deepEqual(hit('B-E-S-T Lights'), ['best']);
  assert.deepEqual(hit('B3ST photo booth'), ['best']);
  assert.deepEqual(hit('ＢＥＳＴ Catering'), ['best']);
  assert.deepEqual(hit('0fficial caterer'), ['official']);
  assert.deepEqual(hit('Trend1ng setups'), ['trending']);
  assert.ok(hit('#1️⃣ booth').includes('#1'));
  assert.ok(hit('N0. 1 booth').includes('no. 1'));
});

test('honest text is never read as a claim — joining needs three single letters, look-alikes need a letter beside them', () => {
  const hit = (v: string) => findClaimWords([{ field: 'name', value: v }], WORDS).length;
  assert.equal(hit('Photo & Video'), 0);
  assert.equal(hit('A La Carte buffet'), 0);
  assert.equal(hit('We bestow a gift'), 0);
  assert.equal(hit('Good for 100 guests'), 0);
  assert.equal(hit('Tabletop setup'), 0);
});

// ── rank forms ("0001 is still number 1") ────────────────────────────────────

test('every rank form the owner named reads as number 1', () => {
  for (const v of ['0001 booth', 'Booth #01', '# 1 caterer', 'No. 1 lights', 'N0. 1 lights', 'No.01 lights', 'Nr. 1 band', 'N° 1 band', '\u21161 band', 'Number 1 host', 'Numero uno sounds', 'Your first choice caterer', '1st choice caterer', 'The one and only DJ', 'Top 3 florist', 'Top10 venues', 'Weddings by Lea — the one', 'N o . 1 booth']) {
    assert.ok(findRankForm(v), `“${v}” passed as if it were not a rank`);
  }
});

test('a number that is a quantity, a time, a date or a floor is never a rank', () => {
  for (const v of ['Good for 100 guests', '1 photographer, 1 videographer', '2 hours of coverage', 'Up to 150 pax', 'Ceremony 10:01 call time', '2026-01-15 promo', '1st floor, Ayala Mall', 'First dance song', '0917 123 4567', 'Package 2', 'Version 1.1', 'Option 1', 'Room 101']) {
    assert.equal(findRankForm(v), null, `“${v}” was read as a rank`);
  }
});

// ── emoji ────────────────────────────────────────────────────────────────────

test('no emoji: pictographs, keycaps, flags and ZWJ sequences are found; © ® ™ are text', () => {
  assert.equal(findEmoji('Lights 🔥'), '🔥');
  assert.ok(findEmoji('Booth 1️⃣'));
  assert.ok(findEmoji('Pinoy 🇵🇭 food'));
  assert.ok(findEmoji('Team 👩‍❤️‍👨'));
  assert.equal(findEmoji('Sounds ⭐'), '⭐');
  assert.equal(findEmoji('Sounds ★'), null, '★ is a decoration (check 1, shouting), not an emoji');
  assert.equal(findEmoji('Brand™ Studio ®'), null);
  assert.equal(findEmoji('Plain words'), null);
});

test('About is not covered by the emoji ruling; every name field is', () => {
  for (const f of ['shop_name', 'tagline', 'card_name', 'included', 'extras', 'package_name'] as const) {
    assert.ok(FAIR_FIELD_CHECKS[f].has('emoji'), `${f} lets an emoji through`);
  }
  assert.equal(FAIR_FIELD_CHECKS.about.has('emoji'), false, 'About now refuses emoji — the ruling leaves it out');
  assert.ok(FAIR_FIELD_CHECKS.about.has('claim'), 'About lost the claim words');
  assert.ok(FAIR_FIELD_CHECKS.about.has('contact'), 'About lost the contact check');
});

// ── the other checks ─────────────────────────────────────────────────────────

test('1 · shouting: ALL CAPS, "!!!", decorations — acronyms and the degree sign pass', () => {
  assert.ok(findShouting('BEST LIGHTS AND SOUNDS'));
  assert.ok(findShouting('Mobile bar!!!'));
  assert.ok(findShouting('Mobile bar ✿'));
  assert.ok(findShouting('~ Mobile bar ~'));
  assert.equal(findShouting('LED Wall rental'), null);
  assert.equal(findShouting('HMUA by Lea'), null);
  assert.equal(findShouting('360° booth'), null);
  assert.equal(findShouting('Photo & Video · same-day edit'), null);
});

test('4 · a "was" price or "% off" in text is refused; 5 · "free" only on a What’s included line', () => {
  assert.ok(checksOf('card_name', 'Booth was ₱20,000').includes('discount'));
  assert.ok(checksOf('card_name', 'Booth 50% off').includes('discount'));
  assert.ok(checksOf('card_name', 'Free photo booth').includes('free'));
  assert.ok(checksOf('extras', 'Free album').includes('free'), 'an extra is the paid part — free belongs under What’s included');
  assert.equal(checksOf('included', 'Free album').includes('free'), false, 'an inclusion IS the ₱0 line');
  assert.equal(checksOf('card_name', 'Free-flowing iced tea').includes('free'), false);
  assert.equal(checksOf('card_name', 'Gluten-free cakes').includes('free'), false);
  assert.equal(checksOf('shop_name', 'Free Spirit Studio').includes('free'), false, 'a brand is not an offer');
});

test('7 · keyword stuffing: four services strung together, hashtags, one word thrice — "Hair, Makeup & Styling" passes', () => {
  assert.ok(findStuffing('Photo | Video | Booth | Lights | Sounds'));
  assert.ok(findStuffing('Booth #wedding #debut'));
  assert.ok(findStuffing('Booth booth booth rental'));
  assert.equal(findStuffing('Hair, Makeup & Styling'), null);
  assert.equal(findStuffing('Photo & Video'), null);
});

test('9 · a card named the same as another of the shop’s cards is flooding', () => {
  assert.ok(checksOf('card_name', 'Classic Booth', { siblings: ['classic booth', 'Deluxe'] }).includes('duplicate'));
  assert.equal(checksOf('card_name', 'Classic Booth', { siblings: ['Deluxe'] }).includes('duplicate'), false);
});

test('12 · unverifiable counts and ratings — "100 guests" and "good for 2 events" pass', () => {
  for (const v of ['500+ weddings done', '1,000 happy couples', '5★ service', '4.9 stars', 'Rated 4.9', '10 years of experience', '15+ yrs in the business', '50 events']) {
    assert.ok(checksOf('card_name', v).includes('numbers'), `“${v}” passed`);
  }
  for (const v of ['Good for 100 guests', 'Good for 2 events', '3 hours coverage', '1 photographer']) {
    assert.equal(checksOf('card_name', v).includes('numbers'), false, `“${v}” was refused`);
  }
});

test('13 · "Setnayan" in a name speaks as Setnayan; About may mention us, never claim standing', () => {
  assert.ok(checksOf('card_name', 'Setnayan Wedding Booth').includes('setnayan'));
  assert.ok(checksOf('shop_name', 'S E T N A Y A N Lights').includes('setnayan'));
  assert.ok(checksOf('about', 'We are a Setnayan partner since 2025.').includes('setnayan'));
  assert.equal(checksOf('about', 'Message us here on Setnayan for dates.').includes('setnayan'), false);
});

test('16 · fake urgency', () => {
  for (const v of ['Only 2 slots left', 'Almost fully booked', 'Book now', 'Few dates', 'Selling fast']) {
    assert.ok(checksOf('card_name', v).includes('urgency'), `“${v}” passed`);
  }
  assert.equal(checksOf('card_name', 'Booking for 2 dates').includes('urgency'), false);
});

test('18 · placeholder names — an auto-name and a blank are never one', () => {
  for (const v of ['test', 'Test 2', 'asdfgh', 'qwerty', 'Untitled', 'Lorem ipsum dolor', 'aaaa', 'x', '12345', 'Sample card']) {
    assert.ok(isPlaceholder(v), `“${v}” passed as a name`);
  }
  for (const v of ['Option 2', 'Inclusion 3', 'Package 1', 'Classic Booth', '', 'Bar']) {
    assert.equal(isPlaceholder(v), false, `“${v}” was called a placeholder`);
  }
});

test('+ · a card name over 50 characters, and a price in a name', () => {
  assert.ok(checksOf('card_name', 'x'.repeat(10) + ' ' + 'Booth '.repeat(8)).includes('too_long'));
  assert.equal(checksOf('card_name', 'Classic Booth').includes('too_long'), false);
  assert.equal(CARD_NAME_MAX, 50);
  for (const v of ['Booth ₱15,000', 'Booth PHP 15000', 'Booth P15,000', 'Booth 15000 pesos']) {
    assert.ok(checksOf('card_name', v).includes('price_in_name'), `“${v}” passed`);
  }
  assert.equal(checksOf('card_name', 'Booth for 150 pax').includes('price_in_name'), false);
});

test('the reported live card "Best mobile bar" is refused on every name field', () => {
  for (const f of ['shop_name', 'card_name', 'package_name', 'tagline'] as const) {
    assert.ok(checksOf(f, 'Best mobile bar').includes('claim'), `${f} let it through`);
  }
});

test('a claim is quoted as the supplier wrote it, and said once when one listed phrase holds another', () => {
  const hits = findFairHits([{ field: 'about', value: 'We are the No. 1 caterer — simply the best.' }], { words: WORDS });
  assert.deepEqual(hits.map((h) => h.fix), ['reword “the best”', 'reword “No. 1”']);
  assert.match(fairLine(hits.map((h) => h.fix)), /Please reword “the best” and reword “No\. 1” —/);
});

test('an unread word list skips ONLY the word check — the other checks still run', () => {
  const hits = findFairHits([{ field: 'card_name', value: 'Best booth 🔥' }], { words: null }).map((h) => h.check);
  assert.deepEqual(hits, ['emoji']);
});

// ── the ruled copy (owner: no law or agency named) ───────────────────────────

test('the copy is the ruled sentence and names no law or agency', () => {
  assert.equal(
    fairLine(['reword “best”']),
    'Setnayan presents every service on the same fair footing, so couples choose on what you actually offer. Please reword “best” — your photos, inclusions and price will speak for you.',
  );
  assert.equal(
    fairNoticeLine('reword “best” in the card name'),
    'One of your cards needs a quick edit to meet our fair-presentation standard: reword “best” in the card name. It stays visible while you fix it.',
  );
  assert.match(FAIR_WHY_WE_CHECK, /^Why we check: couples compare services side by side\./);
  for (const s of [FAIR_LINE_LEAD, FAIR_WHY_WE_CHECK, fairLine(['x']), fairNoticeLine('x')]) {
    assert.doesNotMatch(s, /DTI|RA\s*7394|Consumer Act|law|government|agency/i, 'the copy names a law or an agency — the owner removed it');
  }
  assert.match(fairRefusal(findFairHits([{ field: 'shop_name', value: 'Best Lights' }], { words: WORDS }))!, /reword “Best” in your shop name/);
});

// ── the 18 checks, as built ──────────────────────────────────────────────────

test('all 18 checks are accounted for, each with a status — none silently missing', () => {
  const numbered = FAIR_PRESENTATION_CHECKS.filter((c) => c.n !== '+').map((c) => c.n);
  assert.deepEqual(numbered, Array.from({ length: 18 }, (_, i) => i + 1));
  for (const c of FAIR_PRESENTATION_CHECKS) assert.ok(c.where.length > 10, `check ${c.n} says nothing about where it is`);
});

test('3 · bait price is built behind its rule, and the rule is OFF (26 Oct vs 8 Nov — the owner rules)', () => {
  assert.equal(BAIT_PRICE_RULE_ON, false);
  assert.equal(baitPriceVerdict({ pricePhp: 1, bandLowPhp: 50_000 }), 'unmeasured');
});
