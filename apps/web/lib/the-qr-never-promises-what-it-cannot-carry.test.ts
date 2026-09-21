/**
 * NO PAYMENT SURFACE PROMISES A PRE-FILLED AMOUNT FOR A CODE THAT CARRIES NONE.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚨 WHAT THIS GUARD IS FOR. Owner, 2026-09-20, paying a real ₱837.50 booking
 * fee (reference SN9B7485DD): *"the amount is not filled up. it only shows 0."*
 * One screen said three things about one code, two of them false at that
 * moment — the parent page and /pay step 1 both promised the figure was inside
 * it, while the caption six lines under the code said to type it yourself.
 *
 * 🔑 A PAIR OF HAND-WRITTEN SENTENCES CAN DISAGREE. The resolver already knew
 * the answer (`mintOrderQr` returns null when it cannot mint); what was missing
 * was that its answer never reached the WORDS. So the assertions below are in
 * two halves and both are needed:
 *
 *   · EXECUTED — run the resolver against real static and real dynamic QR Ph
 *     payloads and assert the sentences it produces. A source grep passes
 *     while the thing it names does nothing.
 *   · ANCHORED — assert each surface reads its sentence off `qrWords` and
 *     keeps none of its own. An executed test of a shared helper cannot see a
 *     file that stopped calling it.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  AGREED_AMOUNT,
  everyOpenRailCarriesAmount,
  payloadCarriesOwnAmount,
  qrWords,
  resolveQrAmount,
} from './qr-amount-truth';
import { buildTlv, crc16, mintOrderQr, parseTlv, verifyCrc } from './emv-qr';
import { payAmount } from './pay-amount';

/** Setnayan's real GCash receiving payload — STATIC (tag 01 = '11'). */
const GCASH_STATIC =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';
/** Setnayan's real BDO receiving payload — also STATIC. */
const BDO_STATIC =
  '00020101021127590012com.p2pqrpay0111BNORPHMMXXX02089996440304120065400279655204601653036085802PH5903BDO6011Makati City6304EA14';

/** The exact figure from the report. */
const OWED = 837.5;

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

/**
 * Every surface that shows a payment QR or describes one.
 *
 * ⛔ ADDING A SURFACE MEANS ADDING A ROW. The whole defect was a fourth
 * sentence nobody knew about; a list that quietly stops covering a screen is
 * the same failure with a test beside it.
 */
/**
 * 🔁 TWO SURFACES NOW DELEGATE THEIR SENTENCE (2026-09-20). The cards, the code
 * and the account rows moved into ONE component that both the checkout drawer
 * and /pay render — owner: *"cant we have 1 type of payment process?"* — and
 * the `qrWords` call went with them.
 *
 * 🔑 `phrasedBy` FOLLOWS THE RULE WITHOUT LETTING GO OF THE FILE. The import
 * and the call-count are asked of whoever actually phrases it; the "no
 * hand-written promise" checks below still run on the ORIGINAL file, because a
 * delegating surface growing its own sentence is exactly the regression this
 * suite exists for. Dropping those two rows instead would have ended their
 * coverage silently, which is the trap `the-figure-and-the-qr-agree` records.
 */
const RAILS = 'app/_components/payment/payment-rails.tsx';

const SURFACES: ReadonlyArray<{
  rel: string;
  qrWordsCalls: number;
  phrasedBy?: string;
}> = [
  { rel: 'app/pay/[reference]/page.tsx', qrWordsCalls: 1 },
  { rel: 'app/pay/[reference]/_components/pay-panel.tsx', qrWordsCalls: 2, phrasedBy: RAILS },
  { rel: 'app/vendor-dashboard/booking-fees/[orderId]/page.tsx', qrWordsCalls: 2 },
  { rel: 'app/dashboard/[eventId]/orders/[orderId]/page.tsx', qrWordsCalls: 1 },
  {
    rel: 'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx',
    qrWordsCalls: 2,
    phrasedBy: RAILS,
  },
  { rel: 'app/dashboard/[eventId]/_components/vendor-direct-pay.tsx', qrWordsCalls: 1 },
];

// ── EXECUTED ────────────────────────────────────────────────────────────────

test('a static merchant code is refused an amount-carrying verdict only when it cannot mint', () => {
  // Setnayan's own codes CAN be re-minted, so the honest verdict for them is
  // "carries" — the fault was never that minting is impossible, it was that
  // the page showed the un-minted image while promising the minted one.
  for (const src of [GCASH_STATIC, BDO_STATIC]) {
    const v = resolveQrAmount(src, OWED);
    assert.equal(v.carriesAmount, true, 'a mintable source lost its verdict');
    assert.ok(v.payload && v.payload !== src, 'the payload handed back is the SOURCE, unmodified');
  }
  // And a source we cannot mint from answers static, every time.
  for (const junk of [null, undefined, '', 'https://gcash.example/pay/123', GCASH_STATIC.slice(0, -1)]) {
    assert.equal(resolveQrAmount(junk, OWED).carriesAmount, false, `minted from ${String(junk)}`);
  }
});

test('a static verdict never produces a sentence that promises a pre-filled amount', () => {
  const words = qrWords(false, payAmount(OWED), { reference: 'SN9B7485DD' });
  for (const [where, sentence] of Object.entries(words)) {
    // The three things the owner asked for, 2026-09-20.
    if (where === 'note') continue;
    assert.match(sentence, /no amount/, `${where} does not say the code carries no amount`);
    assert.match(sentence, /₱837\.50/, `${where} does not name the exact figure to type`);
    assert.doesNotMatch(
      sentence,
      /already in it|already has the amount|fills the amount in|nothing to type|already filled/i,
      `${where} promises a pre-filled amount for a code that has none`,
    );
  }
  assert.match(words.caption, /exactly/, 'the caption does not say to type it EXACTLY');
  assert.match(words.note, /SN9B7485DD/, 'the reference is not sent to the transfer note');
});

test('the two verdicts never produce the same sentence', () => {
  const yes = qrWords(true, payAmount(OWED));
  const no = qrWords(false, payAmount(OWED));
  for (const key of ['scanStep', 'caption', 'pointer'] as const) {
    assert.notEqual(yes[key], no[key], `${key} says the same thing either way`);
  }
  // The pointer is the sentence that was false on the two parent pages.
  assert.match(no.pointer, /no amount/);
  assert.match(yes.pointer, /nothing to type/);
});

test('a screen that does not know the figure still says what to do', () => {
  const words = qrWords(false, AGREED_AMOUNT);
  assert.match(words.caption, /no amount/);
  assert.match(words.caption, /the amount you agreed/);
  // "Type exactly." with nothing after it would be worse than saying nothing.
  assert.doesNotMatch(words.caption, /Type\s+exactly/);
});

test('one rail that cannot mint drags the shared sentence down to the truth', () => {
  const both = { amountPhp: OWED };
  assert.equal(
    everyOpenRailCarriesAmount({
      ...both,
      rails: [
        { open: true, payload: GCASH_STATIC },
        { open: true, payload: BDO_STATIC },
      ],
    }),
    true,
  );
  assert.equal(
    everyOpenRailCarriesAmount({
      ...both,
      rails: [
        { open: true, payload: GCASH_STATIC },
        { open: true, payload: null },
      ],
    }),
    false,
    'one unmintable OPEN rail still let the page promise a pre-filled amount',
  );
  // …but a CLOSED rail is not a rail. Its tab is not even rendered.
  assert.equal(
    everyOpenRailCarriesAmount({
      ...both,
      rails: [
        { open: true, payload: GCASH_STATIC },
        { open: false, payload: null },
      ],
    }),
    true,
    'a switched-off rail dragged the sentence down',
  );
  // No rail at all promises nothing.
  assert.equal(everyOpenRailCarriesAmount({ ...both, rails: [] }), false);
  assert.equal(
    everyOpenRailCarriesAmount({ ...both, rails: [{ open: false, payload: GCASH_STATIC }] }),
    false,
  );
});

test('a payload we did not mint is read, not assumed', () => {
  // The supplier's own uploaded code. Static → no amount.
  assert.equal(payloadCarriesOwnAmount(GCASH_STATIC), false);
  assert.equal(payloadCarriesOwnAmount(BDO_STATIC), false);
  // A genuinely dynamic one → it does carry an amount, and we must not tell
  // that supplier's customer otherwise.
  const dynamic = mintOrderQr(GCASH_STATIC, 1234.5);
  assert.ok(dynamic);
  assert.equal(payloadCarriesOwnAmount(dynamic), true);
  const tags = new Map(parseTlv(dynamic).map((f) => [f.id, f.value]));
  assert.equal(tags.get('01'), '12', 'the dynamic marker is not what we think it is');
  assert.equal(tags.get('54'), '1234.50');
  // ⚠ A 54 ON A STATIC ('11') PAYLOAD IS A CODE GCASH REJECTS, not one that
  // pays a figure — so it must NOT read as amount-carrying. Built properly,
  // CRC and all, because a malformed fixture would answer false for the wrong
  // reason and the tag-01 half of the rule would never be exercised.
  const staticWithAmount = (() => {
    const fields = parseTlv(GCASH_STATIC).filter((f) => f.id !== '63');
    const at = fields.findIndex((f) => Number(f.id) > 54);
    fields.splice(at, 0, { id: '54', value: '12.00' });
    const b = buildTlv(fields) + '6304';
    return b + crc16(b);
  })();
  assert.equal(verifyCrc(staticWithAmount).ok, true, 'the fixture is malformed, so it proves nothing');
  const staticTags = new Map(parseTlv(staticWithAmount).map((f) => [f.id, f.value]));
  assert.equal(staticTags.get('01'), '11');
  assert.equal(staticTags.get('54'), '12.00');
  assert.equal(payloadCarriesOwnAmount(staticWithAmount), false);
  // Not a QR Ph payload at all.
  for (const junk of [null, undefined, '', 'https://example.test/pay', 'hello']) {
    assert.equal(payloadCarriesOwnAmount(junk), false, String(junk));
  }
});

// ── ANCHORED ────────────────────────────────────────────────────────────────

test('every payment surface reads its sentence off the shared resolver', () => {
  for (const { rel, qrWordsCalls, phrasedBy } of SURFACES) {
    const src = code(phrasedBy ?? rel);
    assert.match(
      src,
      /from '@\/lib\/qr-amount-truth'/,
      `${phrasedBy ?? rel} does not import the shared QR wording`,
    );
    // ⚠ A FILE-LEVEL MATCH CANNOT SEE ONE CALL SITE GO — the same trap
    // `the-figure-and-the-qr-agree.test.ts` records. Floored per file: a new
    // sentence is welcome and raises the floor, losing one is a regression.
    const calls = (src.match(/qrWords\(/g) ?? []).length;
    assert.ok(
      calls >= qrWordsCalls,
      `${phrasedBy ?? rel} calls qrWords ${calls}x, below its floor of ${qrWordsCalls}`,
    );
  }
});

test('no surface keeps a hand-written promise about the amount', () => {
  /**
   * ⚠ THIS IS A PHRASING CHECK AND IT IS DELIBERATELY NARROW. A reword makes
   * the identical promise without any of these words, which is why the
   * EXECUTED half above carries the real weight. What this catches is the
   * specific regression that happened: somebody pasting one of these exact
   * sentences back into a page because it reads nicely.
   *
   * It runs on COMMENT-STRIPPED source, so the long notes in these files
   * quoting the false sentences do not convict them.
   */
  const BANNED =
    /(already (has|have) the amount|amount is already in it|is already filled in)/i;
  for (const { rel } of SURFACES) {
    const src = code(rel);
    const hit = src.split('\n').find((line) => BANNED.test(line));
    assert.equal(
      hit,
      undefined,
      `${rel} states a pre-filled amount in its own words: ${String(hit).trim()}`,
    );
  }
});

test('the surfaces list still covers every file that shows a payment QR', () => {
  // A guard that stops covering a screen is the original defect with a test
  // beside it, so the list is checked against the files themselves.
  for (const { rel } of SURFACES) {
    assert.ok(read(rel).length > 0, `${rel} has moved or gone — re-anchor this guard`);
  }
  assert.equal(SURFACES.length, 6, 'a surface was added or removed without a decision');
});
