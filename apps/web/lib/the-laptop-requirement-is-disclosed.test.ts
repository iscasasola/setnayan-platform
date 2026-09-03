/**
 * the-laptop-requirement-is-disclosed.test.ts
 *
 * 💻 THE ONE REQUIREMENT A COUPLE CANNOT RECOVER FROM, SAID BEFORE THEY PAY.
 *
 * Live Studio needs a Windows or Mac laptop at the celebration running an encoder —
 * a browser cannot push a livestream, and the phones only feed the controller.
 * `ENCODER_NOTICE` has always said so, and is returned on every readiness branch
 * including the green one. But readiness is a POST-PURCHASE surface: the buy sheet
 * carried the payment lead time and YouTube's activation wait and never mentioned
 * needing a computer, and the public product page mentioned OBS only inside a FAQ
 * answer about YouTube — not where somebody deciding whether this fits them looks.
 *
 * 🔑 WHY THIS ONE RANKS ABOVE THE OTHER TWO. A couple who meets the YouTube 24-hour
 * wait too late can still wait. A couple who meets the payment SLA too late can be
 * approved early next time. A couple with NO LAPTOP on the wedding morning has no
 * broadcast, and nothing fixes it — on a date that cannot move.
 *
 * 🛡 Comments stripped with the repo's ONE canonical stripper — a new file carrying
 * its own would fail `scripts/lint-one-comment-stripper.mjs`, and the prose here names
 * every string asserted below.
 *
 * Run from apps/web: `npx tsx --test lib/the-laptop-requirement-is-disclosed.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { ENCODER_BUY_NOTICE, ENCODER_NOTICE } from './live-studio-readiness';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(resolve(HERE, '..', p), 'utf8'));

const BUY_PAGE = 'app/dashboard/[eventId]/studio/live-studio-control/page.tsx';
const PUBLIC_PAGE = 'app/(shell)/panood/page.tsx';

test('⭐ the buy sheet names the laptop BEFORE the money moves', () => {
  // A constant nobody renders is not a disclosure.
  const page = src(BUY_PAGE);
  assert.match(
    page,
    /notice: \[LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE, ENCODER_BUY_NOTICE\]/,
    'the buy sheet no longer receives all three pre-purchase facts',
  );
});

test('⭐ the notice says WHICH machine, and that a phone will not do', () => {
  // "You need an encoder" is not actionable to someone deciding what to bring.
  assert.match(ENCODER_BUY_NOTICE, /Windows or Mac laptop/i, 'never names the machine');
  assert.match(ENCODER_BUY_NOTICE, /phone or tablet/i, 'never rules out the obvious wrong guess');
  assert.match(ENCODER_BUY_NOTICE, /browser/i, 'never says a browser alone cannot do it');
});

test('⭐ the public product page answers it FIRST, not inside a YouTube answer', () => {
  // It was previously reachable only via "does it run on my own channel?", which nobody
  // deciding whether this product fits them would open.
  const page = src(PUBLIC_PAGE);
  const laptopQ = page.indexOf('What do I need on the day?');
  assert.ok(laptopQ > -1, 'the public page no longer asks what the couple must bring');
  const guestsQ = page.indexOf('How do my guests watch?');
  assert.ok(guestsQ > -1);
  assert.ok(laptopQ < guestsQ, 'the requirement must lead the FAQ, not trail it');
  assert.match(page.slice(laptopQ, guestsQ), /Windows or Mac laptop/i, 'the answer never names the machine');
});

test('🔒 the two encoder sentences must not drift apart on the FACT', () => {
  // Two strings answer two questions — "what must I own?" before paying, "what do I do
  // with it?" after. They may word it differently; they may not disagree that a
  // computer running an encoder is required. If a native encoder or a relay ever
  // removes that need, BOTH move in the same commit.
  for (const notice of [ENCODER_BUY_NOTICE, ENCODER_NOTICE]) {
    assert.match(notice, /OBS/i, 'one of the encoder sentences stopped naming the software');
    assert.ok(
      /laptop|computer/i.test(notice),
      'one of the encoder sentences stopped requiring a machine',
    );
  }
});
