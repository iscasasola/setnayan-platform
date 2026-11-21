/**
 * ⚖ OWNER 2026-11-17: every payment enters BDO — *"So we show them QRPH with the
 * exact data. Show QR."* — and *"should auto save the QR Code"*, with a Share
 * button. One open rail is ONE row ("Pay to BDO via QR"), never a picker; the
 * QR is handed over through Share (Web Share API with the image, download
 * fallback), never "Save image".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { advanceLabel } from '@/lib/pay-stages';

// tsconfig `"jsx": "preserve"` ⇒ tsx compiles components to the CLASSIC runtime
// (bare `React.createElement`), so React must be global BEFORE the dynamic import
// — precedent: app/pay/[reference]/_components/one-stage-at-a-time.test.ts.
(globalThis as unknown as { React: unknown }).React = React;
const rails = () => import('./payment-rails');

const src = readFileSync(join(process.cwd(), 'app/_components/payment/payment-rails.tsx'), 'utf8');

test('one open rail renders ONE row reading "Pay to BDO via QR" — no radio, no switch', async () => {
  const { ChannelToggle, payToRailLine } = await rails();
  const html = renderToStaticMarkup(
    React.createElement(ChannelToggle, {
      channel: 'bdo',
      onChange: () => {},
      rails: [{ id: 'bdo', label: 'BDO', kind: 'bank' }],
    }),
  );
  assert.match(html, /Pay to BDO via QR/);
  assert.doesNotMatch(html, /role="radio/, 'a single rail still renders a picker');
  assert.equal(payToRailLine({ label: 'BDO' }), 'Pay to BDO via QR');
});

test('the QR is handed over through Share, with a download fallback', () => {
  assert.doesNotMatch(src, /Save image · scan from your photos/, '"Save image" is back');
  assert.match(src, /data-pay-qr-share=""/);
  // SaveFileLink IS the Web Share path: share sheet with the file on a phone,
  // a plain download on a computer (print-save-button.tsx `canShare`).
  assert.match(src, /<SaveFileLink\s+href=\{mintedQr\}/);
  const save = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/print-save-button.tsx'), 'utf8');
  assert.match(save, /navigator\.share\(\{ files: \[file\] \}\)/);
  assert.match(save, /downloadBlob\(file\)/);
});

test('the step-2 button reads "Upload Payment Receipt"', () => {
  assert.equal(advanceLabel(2), 'Upload Payment Receipt');
});
