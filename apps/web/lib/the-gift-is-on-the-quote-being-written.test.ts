/**
 * THE GIFT LINE IS MOUNTED — in BOTH composers, and fed by the server.
 *
 * ── WHY A MOUNT TEST AND NOT ANOTHER COPY TEST ──────────────────────────────
 * `giftQuoteLine` shipped in lib/setnayan-gift.ts with a `'supplier'` branch, a
 * passing unit test, and NO IMPORTER but that test. It was written, tested, and
 * dead — while the sent-quote page rendered its own inline duplicate, so the
 * guard faced the corpse and the live copy was unguarded. A pure-function test
 * cannot tell those two states apart; only a mount test can.
 *
 * 🔑 AND THE SECOND COMPOSER IS THE ONE THAT MATTERS MOST. Measured on
 * origin/main: every deep link in the product — the clients action bar, the
 * chat info rail — points at `#send-proposal` (SendProposalCard). `#build-quote`
 * (the fuller ProposalMaker) has ZERO inbound links anywhere in the repo. A
 * feature mounted only in ProposalMaker would be invisible to every supplier
 * who followed a Quote button, which is all of them — present and inert, the
 * exact disease this project keeps paying for.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const MAKER = 'app/_components/proposal-maker.tsx';
const CARD = 'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx';
const THREAD = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const SENT = 'app/proposals/[publicId]/page.tsx';

test('BOTH composers render the gift block', () => {
  for (const f of [MAKER, CARD]) {
    const src = read(f);
    assert.match(
      src,
      /data-testid="compose-setnayan-gift"/,
      `${f} does not render the gift block — the supplier never sees it while pricing`,
    );
    assert.match(
      src,
      /giftCopy\??\.headline/,
      `${f} renders a block but not the shared headline`,
    );
    assert.match(src, /giftCopy\??\.detail/, `${f} drops the detail — that is the COST half`);
  }
});

test('both composers DERIVE the number — never a local estimate', () => {
  // The composer must call the shared preview, which runs the same
  // bookingFeePhp → setnayanGiftForFee pair the bill is priced from. A local
  // `× 0.05` would quote a figure the invoice does not match.
  for (const f of [MAKER, CARD]) {
    const src = read(f);
    assert.match(src, /previewGiftForTotal\(/, `${f} does not call previewGiftForTotal`);
    assert.ok(
      !/\*\s*0?\.4|\*\s*0?\.05|GIFT_SHARE_OF_FEE_PCT/.test(src),
      `${f} appears to compute the gift or the fee itself — it must not`,
    );
  }
});

test('the server FEEDS both composers, from one resolved basis', () => {
  const src = read(THREAD);
  assert.match(src, /giftQuoteBasis\(/, 'the thread page never resolves the gift basis');
  const passes = src.match(/giftBasis=\{composerGiftBasis\}/g) ?? [];
  assert.equal(
    passes.length,
    2,
    `the basis reaches ${passes.length} composer(s), expected 2 — a composer with no basis ` +
      'silently shows nothing, which is indistinguishable from "this booking has no gift"',
  );
});

test('ONE copy of the sentence — the sent quote and the composers share it', () => {
  // Three surfaces now show this gift. If any of them re-types the words, they
  // drift the first time the wording changes and only one gets corrected.
  const sent = read(SENT);
  assert.match(sent, /giftQuoteCopy\(/, 'the sent quote page re-types the gift copy again');
  assert.ok(
    !/Includes (a|your) Setnayan gift/.test(sent),
    'the sent quote page still holds an inline copy of the gift sentence',
  );
  for (const f of [MAKER, CARD]) {
    const src = read(f);
    assert.ok(
      !/Includes (a|your) Setnayan gift/.test(src),
      `${f} hard-codes the gift sentence instead of using giftQuoteCopy`,
    );
  }
});

test('the retired helper is really gone, not merely unused', () => {
  // Leaving it would re-create the original trap: two copies, one of them dead,
  // and a future edit landing on whichever the author happened to open.
  const lib = read('lib/setnayan-gift.ts');
  assert.ok(
    !/export function giftQuoteLine/.test(lib),
    'giftQuoteLine still exports — it was replaced by giftQuoteCopy',
  );
});
