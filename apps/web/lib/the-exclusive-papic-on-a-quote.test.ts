/**
 * the-exclusive-papic-on-a-quote.test.ts — the supplier writing a quote is told
 * the FEE it will incur and the MAXIMUM Papic they may add on top.
 *
 * ⚖ OWNER, 2026-09-20, verbatim: *"When they create a quote, similar to service
 * cards, they get to see the booking fee for that, and the maximum additional
 * papic service they can also purchase on top to offer that exclusive deal."*
 *
 * ── The defect, measured on production the same day ────────────────────────
 * The "additional papic service" already existed — the SETNAYAN GIFT, owner-
 * locked 2026-09-09: free Papic photos for the couple at 40% of the booking
 * fee, capped at 50,000, billed to the supplier on top of the fee. The composer
 * showed it ONLY when the booking's service card already had it switched on.
 *
 *   select count(*), count(*) filter (where includes_setnayan_gift)
 *     from vendor_services;      →  2 services, 0 with the gift on
 *
 * So on every quote written in production so far, the composer said NOTHING
 * about Papic. `giftQuoteBasis` collapses four distinct database answers —
 * `card_says_no`, `free_booking`, `not_sourced`, `no_booking` — into one
 * `null`, and `null` renders nothing. Right for the PROMISE (never quote photos
 * a bill will not carry), wrong for the supplier's question.
 *
 * ── What this file holds ───────────────────────────────────────────────────
 *   1. THE QUOTER — the maximum, executed across free · paid · read-failure ·
 *      catalogue-missing, and pinned to `previewGiftForTotal` so it can never
 *      become a second source of truth for one number.
 *   2. NO INVENTED NUMBER — every arm that cannot price prints no figure.
 *   3. THE ARM MAPPING — every answer the SQL can give, including one it
 *      cannot give yet.
 *   4. THE GATE IS NOT RELAXED — a basis reaches the couple's promise only on
 *      'applies'.
 *   5. THE MOUNTS — both quote surfaces carry BOTH lines, counted per surface.
 *   6. BOTH ENDS — the couple never sees the supplier's ceiling, and still
 *      never sees pesos.
 *
 * 🛡 Mutation-checked: every rule below was broken on purpose and confirmed RED
 * before being trusted. The sabotages are listed beside each test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  GIFT_CAP_CREDITS,
  GIFT_SHARE_OF_FEE_PCT,
  giftLadderIsPriceable,
  giftQuoteCopy,
  previewGiftForTotal,
  setnayanGiftForFee,
  type GiftQuoteBasis,
  type GiftRung,
} from '@/lib/setnayan-gift';
import {
  VENDOR_SERVICE_CARDS_PATH,
  giftBasisFrom,
  papicTopUpForQuote,
  standingForGiftArm,
  type PapicQuoteStanding,
} from '@/lib/papic-on-a-quote';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { feePesos } from '@/lib/booking-fee-disclosure';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

/**
 * THE LIVE LADDER, read from production on 2026-09-20 —
 * `select service_code, retail_price_php from platform_retail_catalog_v2
 *    where service_code like 'PAPIC_GUEST%'` joined to `papic_pass_tiers.points`.
 * Only the rungs the arithmetic actually lands on are needed; the 50,000 one is
 * mandatory because the cap is priced off it.
 */
const LADDER: GiftRung[] = [
  { credits: 100, priceCentavos: 7_000 },
  { credits: 200, priceCentavos: 14_000 },
  { credits: 500, priceCentavos: 35_000 },
  { credits: 1_000, priceCentavos: 70_000 },
  { credits: 5_000, priceCentavos: 280_000 },
  { credits: 50_000, priceCentavos: 1_500_000 },
];

/** The live owner-set fee schedule, as `getBookingFeeSchedule` returns it. */
const BASIS: GiftQuoteBasis = { schedule: BOOKING_FEE, ladder: LADDER };

/** The owner's own booking, to the centavo: ₱16,750 → ₱837.50 fee. */
const OWNERS_TOTAL_CENTAVOS = 1_675_000;

/* ═══ 1 · THE QUOTER ════════════════════════════════════════════════════════ */

// SABOTAGE: in the 'available' arm, replace `previewGiftForTotal(...)` with a
// hand-rolled `Math.floor(total * 0.004)` → RED (the printed count stops
// matching the bill's).
test('the maximum a quote can carry IS the gift the bill will charge', () => {
  for (const totalCentavos of [350_000, 1_675_000, 5_000_000, 90_000_000, 900_000_000]) {
    const gift = previewGiftForTotal(totalCentavos, BASIS);
    const notice = papicTopUpForQuote({ kind: 'available', basis: BASIS }, totalCentavos);
    assert.ok(notice, `no line at ${totalCentavos} centavos`);
    if (!gift) continue;
    const photos = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(
      gift.credits,
    );
    assert.match(
      notice.headline,
      new RegExp(photos.replace(/,/g, ',')),
      `the line must print the gift's own count (${photos}) at ${totalCentavos}`,
    );
    // …and the charge, through the SAME centavo-precise formatter the fee line
    // uses. A ₱837.50-shaped figure must never read "₱838" here either.
    const pesos = feePesos(gift.chargeCentavos / 100);
    assert.ok(
      notice.headline.includes(pesos),
      `the line must print the gift's own charge (${pesos}) at ${totalCentavos}, got: ${notice.headline}`,
    );
    assert.match(notice.headline, /₱[\d,]+\.\d{2}\b/, 'a fee-sized figure is never rounded');
  }
});

// SABOTAGE: give the supplier the ceiling on a FREE booking (return the
// 'available' copy for `free_booking`) → RED.
test('a free booking is told the deal is a share of a fee it does not pay', () => {
  const free = papicTopUpForQuote({ kind: 'free_booking' }, OWNERS_TOTAL_CENTAVOS);
  assert.ok(free);
  assert.doesNotMatch(free.headline + free.detail, /₱|\d+ (?:free )?Papic photos/);
  assert.match(free.detail, /waived/);
});

// SABOTAGE: return `{ tone: 'good', headline: 'No Papic deal…' }` for
// 'unreadable' → RED (a failed read would read as an honest absence).
test('a read failure says so, and prints no number', () => {
  const bad = papicTopUpForQuote({ kind: 'unreadable' }, OWNERS_TOTAL_CENTAVOS);
  assert.ok(bad, 'a failed read must still say something');
  assert.match(bad.headline, /could not/i);
  assert.doesNotMatch(bad.headline + bad.detail, /₱|\d{2,}/);
});

// SABOTAGE: drop the 50,000 rung from `giftLadderIsPriceable`'s test (return
// `ladder.length > 0`) → RED: an unpriceable catalogue would reach 'available'
// and be explained to the supplier as "your quote is too small".
test('a catalogue that cannot price the cap is unreadable, never "too small"', () => {
  const noCapRung = LADDER.filter((r) => r.credits !== GIFT_CAP_CREDITS);
  assert.equal(giftLadderIsPriceable(noCapRung), false);
  assert.equal(giftLadderIsPriceable([]), false);
  assert.equal(giftLadderIsPriceable(LADDER), true);

  // The gift itself already refuses such a ladder — this is the rule they share.
  assert.equal(setnayanGiftForFee(83_750, noCapRung).credits, 0);

  // And the server hands `null` for that ladder, which maps to `unreadable`.
  const standing = standingForGiftArm('card_says_no', null);
  assert.equal(standing.kind, 'unreadable');
  const notice = papicTopUpForQuote(standing, OWNERS_TOTAL_CENTAVOS);
  assert.match(notice!.headline, /could not/i);
});

// SABOTAGE: return the 'available' number-bearing copy when `totalCentavos` is
// 0 → RED (a composer with nothing typed would quote a ₱0 deal).
test('nothing typed yet invites a price instead of quoting zero', () => {
  const empty = papicTopUpForQuote({ kind: 'available', basis: BASIS }, 0);
  assert.ok(empty);
  assert.doesNotMatch(empty.headline, /₱0|0 free Papic/);
  assert.equal(empty.cta?.href, VENDOR_SERVICE_CARDS_PATH);
});

// SABOTAGE: return a copy for 'silent' → RED.
test('silence is reserved for "there is no question here"', () => {
  assert.equal(papicTopUpForQuote({ kind: 'silent' }, OWNERS_TOTAL_CENTAVOS), null);
  // The gift is already on and already priced: the count is printed ONCE, by
  // the gift block, and this line only qualifies it as the maximum.
  const included = papicTopUpForQuote({ kind: 'included', basis: BASIS }, OWNERS_TOTAL_CENTAVOS);
  assert.ok(included);
  const gift = previewGiftForTotal(OWNERS_TOTAL_CENTAVOS, BASIS)!;
  assert.doesNotMatch(
    included.headline + included.detail,
    new RegExp(String(gift.credits)),
    'the photo count must not be printed twice on one screen',
  );
  // …and with no total there is no gift block to qualify, so nothing renders.
  assert.equal(papicTopUpForQuote({ kind: 'included', basis: BASIS }, 0), null);
});

/* ═══ 2 · NO INVENTED NUMBER ════════════════════════════════════════════════ */

// SABOTAGE: write `40%` or `50,000` as a literal in the copy → RED.
test('the percentage and the cap are read from their constants, never typed', () => {
  const src = read('lib/papic-on-a-quote.ts');
  assert.doesNotMatch(
    src,
    /\b(?:0\.4|50000|50_000|50,000)\b/,
    'the ceiling must come from GIFT_CAP_CREDITS / GIFT_SHARE_OF_FEE_PCT',
  );
  // And the rendered sentence really carries them.
  const notice = papicTopUpForQuote({ kind: 'available', basis: BASIS }, OWNERS_TOTAL_CENTAVOS)!;
  assert.match(notice.detail, new RegExp(`${GIFT_SHARE_OF_FEE_PCT}%`));

  // At the cap, the copy names the 50,000-photo ceiling — from the constant.
  const huge = papicTopUpForQuote({ kind: 'available', basis: BASIS }, 900_000_000)!;
  const capText = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(
    GIFT_CAP_CREDITS,
  );
  assert.ok(
    huge.headline.includes(capText) || huge.detail.includes(capText),
    'a capped quote must say where it stopped',
  );
});

/* ═══ 3 · THE ARM MAPPING ═══════════════════════════════════════════════════ */

// SABOTAGE: `default: return { kind: 'silent' }` → RED (an arm the SQL grows
// later would be silently swallowed as "nothing to say").
test('every arm the SQL returns, and one it does not', () => {
  assert.equal(standingForGiftArm('no_booking', BASIS).kind, 'silent');
  assert.equal(standingForGiftArm('not_sourced', BASIS).kind, 'not_sourced');
  assert.equal(standingForGiftArm('free_booking', BASIS).kind, 'free_booking');
  assert.equal(standingForGiftArm('applies', BASIS).kind, 'included');
  assert.equal(standingForGiftArm('card_says_no', BASIS).kind, 'available');
  // An arm we do not recognise, and an empty string (a refused/odd read).
  assert.equal(standingForGiftArm('covered_package', BASIS).kind, 'unreadable');
  assert.equal(standingForGiftArm('', BASIS).kind, 'unreadable');
  // Eligible but unpriceable.
  assert.equal(standingForGiftArm('applies', null).kind, 'unreadable');
  assert.equal(standingForGiftArm('card_says_no', null).kind, 'unreadable');

  // The server must not decide any of this itself — it reads, then delegates.
  const server = read('lib/papic-on-a-quote.server.ts');
  assert.match(server, /standingForGiftArm\(arm, basis\)/);
  assert.equal(
    count(server, /kind: '(?:included|available|free_booking|not_sourced)'/),
    0,
    'the server file must not pick an arm — that decision is executed in the pure sibling',
  );
});

/* ═══ 4 · THE GATE IS NOT RELAXED ═══════════════════════════════════════════ */

// SABOTAGE: `standing.kind === 'included' || standing.kind === 'available'` in
// giftBasisFrom → RED. The couple would be promised photos on a card that never
// offered them, and the bill would carry none.
test('a basis — and therefore a promise to the couple — only on "applies"', () => {
  const all: PapicQuoteStanding[] = [
    { kind: 'silent' },
    { kind: 'available', basis: BASIS },
    { kind: 'free_booking' },
    { kind: 'not_sourced' },
    { kind: 'unreadable' },
  ];
  for (const s of all) {
    assert.equal(giftBasisFrom(s), null, `${s.kind} must not yield a gift basis`);
  }
  assert.equal(giftBasisFrom({ kind: 'included', basis: BASIS }), BASIS);
});

/* ═══ 5 · THE MOUNTS ════════════════════════════════════════════════════════ */

// SABOTAGE: delete the <BookingFeeNotice testId="papic-quote-notice" …/> from
// either composer → RED. Counted PER FILE and PER LINE: a file-level match for
// `BookingFeeNotice` cannot say which of the two rows survived.
test('both quote surfaces carry BOTH lines — the fee and the Papic ceiling', () => {
  const surfaces = [
    'app/_components/proposal-maker.tsx',
    'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx',
  ];
  for (const file of surfaces) {
    const src = read(file);
    assert.equal(
      count(src, /<BookingFeeNotice/),
      2,
      `${file} must mount exactly two notices: the fee and the Papic ceiling`,
    );
    assert.equal(
      count(src, /testId="papic-quote-notice"/),
      1,
      `${file} lost its Papic ceiling line`,
    );
    assert.match(src, /papicTopUpForQuote\(/, `${file} must price the ceiling itself`);
    assert.match(
      src,
      /cta=\{papicCopy\?\.cta\}/,
      `${file} must carry the door to the gift switch`,
    );
  }

  // The page resolves the standing ONCE and hands it to both composers, and the
  // gift basis is DERIVED from that same read.
  const page = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.equal(count(page, /resolvePapicQuoteStanding\(/), 1, 'one read, one answer');
  assert.equal(count(page, /papicStanding=\{composerPapicStanding\}/), 2);
  assert.match(page, /const composerGiftBasis = giftBasisFrom\(composerPapicStanding\)/);
  assert.doesNotMatch(
    page,
    /giftQuoteBasis\(/,
    'asking the same RPC twice lets the two lines answer to different moments',
  );

  // The row can be named per line — the shared component takes the id.
  const notice = read('app/_components/booking-fee-notice.tsx');
  assert.match(notice, /data-testid=\{testId\}/);
});

/* ═══ 6 · BOTH ENDS ═════════════════════════════════════════════════════════ */

// SABOTAGE: import papic-on-a-quote into the couple's proposal page → RED.
test('the couple never sees the supplier’s ceiling, and never sees pesos', () => {
  const coupleSurfaces = [
    'app/proposals/[publicId]/page.tsx',
    'app/dashboard/[eventId]/vendors/page.tsx',
  ];
  for (const file of coupleSurfaces) {
    const src = read(file);
    assert.doesNotMatch(
      src,
      /papic-on-a-quote|papicTopUpForQuote|standingForGiftArm/,
      `${file} is a COUPLE surface — the supplier's cost and ceiling are not their business`,
    );
  }

  // The couple's half of the gift is untouched by this change: photographs,
  // never pesos, and nothing at all when no gift is promised.
  const gift = previewGiftForTotal(OWNERS_TOTAL_CENTAVOS, BASIS)!;
  const couple = giftQuoteCopy(gift, 'couple')!;
  assert.doesNotMatch(couple.headline + couple.detail, /₱/);
  assert.equal(giftQuoteCopy(null, 'couple'), null);

  // And a quote whose card says no promises the couple nothing — the supplier
  // is shown a ceiling they have not bought yet.
  assert.equal(giftBasisFrom({ kind: 'available', basis: BASIS }), null);
});
