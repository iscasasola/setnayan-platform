/**
 * ONE PAYMENT SURFACE — the cards, the code and the account rows come from one
 * component, and the page that can mint on the server still does.
 *
 * Owner, 2026-09-20, holding the Papic payment screen next to the couple's
 * checkout drawer: *"they have a different payment process… cant we have 1
 * type of payment process? and just have this one that pops up on the right
 * corner?"*
 *
 * Two surfaces had rendered the same three facts in two layouts with two sets
 * of words — the drawer said "Save image · scan from gallery", /pay said "Save
 * code to my photos", the same button, drifted, and nothing could tell you
 * because each was only ever compared against itself.
 *
 * ⚠ THE SECOND TEST IS THE ONE THAT MATTERS MOST, and it guards the opposite
 * direction from the consolidation. Merging the LOOK must not merge the worse
 * MECHANISM: the drawer draws its code in the browser, so the static merchant
 * code — scannable, worth ₱0 — holds the screen until the `qrcode` chunk
 * lands. The owner paid through exactly that window on /pay earlier the same
 * day (*"the amount is not filled up. it only shows 0."*), which is why /pay
 * mints the image on the SERVER. Sharing a component must not hand /pay a
 * payload to draw.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const RAILS = 'app/_components/payment/payment-rails.tsx';
const DRAWER = 'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx';
const PANEL = 'app/pay/[reference]/_components/pay-panel.tsx';

test('both payment surfaces render the SAME rails, and neither keeps a copy', () => {
  const rails = read(RAILS);
  for (const name of ['ChannelToggle', 'MethodCard', 'PaymentDetailsBlock']) {
    assert.match(rails, new RegExp(`function ${name}\\(`), `${RAILS} lost ${name}`);
  }

  for (const rel of [DRAWER, PANEL]) {
    const src = read(rel);
    assert.match(
      src,
      /from '@\/app\/_components\/payment\/payment-rails'/,
      `${rel} no longer imports the shared rails`,
    );
    assert.match(src, /<ChannelToggle\b/, `${rel} does not render the shared rail cards`);
    assert.match(src, /<PaymentDetailsBlock\b/, `${rel} does not render the shared code block`);
    // A second copy is how the two drifted the first time. Any locally-declared
    // rail component here is that copy coming back, whatever it is called.
    assert.doesNotMatch(
      src,
      /function (ChannelTab|QrTile|MethodCard|ChannelToggle|PaymentDetailsBlock)\(/,
      `${rel} has grown its own rail component again`,
    );
  }
});

test('/pay hands down the SERVER-drawn code, and nothing for a browser to draw', () => {
  const panel = read(PANEL);
  const at = panel.indexOf('<PaymentDetailsBlock');
  assert.ok(at > 0, 'the shared block is gone from the payment page');
  const end = panel.indexOf('/>', at);
  assert.ok(end > at, 'could not find the end of the call');
  const call = panel.slice(at, end);

  assert.match(call, /mintedUrl:/, '/pay must pass the image the server drew');
  assert.doesNotMatch(
    call,
    /payload:/,
    '/pay must pass NO payload — a payload is something for the browser to draw, and ' +
      'until it has, the static ₱0 code holds the screen',
  );

  // And the page must still be the thing that mints it.
  assert.match(
    read('app/pay/[reference]/page.tsx'),
    /mintedQrImage\(/,
    'the payment page stopped minting its own code on the server',
  );
});

/**
 * The surfaces that used to hand out a code of their own.
 *
 * Each printed the receiving accounts beside their STATIC QR — a code carrying
 * NO amount, which is the ₱0 scan the owner hit paying a real ₱837.50 booking
 * fee. Neither could take the proof afterwards: the booking-fee page still told
 * a supplier to "log it below" about a form that had moved to /pay in August,
 * and the subscription tile offered nowhere to say you had paid at all.
 */
const SECOND_SURFACES = [
  'app/vendor-dashboard/booking-fees/[orderId]/page.tsx',
  'app/vendor-dashboard/subscription/page.tsx',
] as const;

test('no page hands out a payment code of its own — they point at /pay', () => {
  for (const rel of SECOND_SURFACES) {
    const src = read(rel);

    // The static merchant image is the tell: it is the one that carries no
    // amount. A payload is fine — `qr-amount-truth` reads it to decide what a
    // page may CLAIM about a code, without drawing one.
    assert.doesNotMatch(
      src,
      /settings\.(gcash|bdo)_qr_url/,
      `${rel} draws the static ₱0 code again — sending money belongs on /pay`,
    );
    assert.doesNotMatch(
      src,
      /settings\.(gcash_number|bdo_account_number)/,
      `${rel} prints a receiving account again, which is a second way to pay one bill`,
    );

    // And the way out must exist, or removing the tile stranded somebody.
    assert.match(
      src,
      /payPath\(/,
      `${rel} no longer points anywhere payable — that is worse than the tile it replaced`,
    );
  }
});
