/**
 * 📐 THE PAY NOTICE LAYS OUT BY ITS PANE, NOT THE SCREEN (W1 tablet/desktop walk, RW-351, 16 Nov 2026).
 *
 * In the supplier's chat the "Couples pay you directly… Add a payment method · Not now" notice stands in
 * the thread pane beside the list. The notice look switches to one row at a 768px SCREEN, so at 768 the
 * sentence went one word per line under overlapping buttons and at 1280 it was 96px wide. The nudge now
 * makes its box a size container and, while the BOX is under 600px, keeps the phone's stacked layout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../lib/strip-comments';
import { BY_ITS_OWN_WIDTH } from '../../_components/notices/notice-styles';

const NUDGE = stripComments(readFileSync(join(__dirname, 'payout-method-nudge.tsx'), 'utf8'));

test('the rule makes the box a container and stacks the line + actions while the box is narrow', () => {
  const parts = BY_ITS_OWN_WIDTH.split(/\s+/);
  assert.ok(parts.includes('[container-type:inline-size]'), 'the box must be a size container');
  assert.ok(parts.includes('[@container(max-width:599px)]:[&_[data-notice-key]]:block'), 'a narrow box stacks the row');
  assert.ok(parts.includes('[@container(max-width:599px)]:[&_[data-notice-actions]]:mt-2'), 'a narrow box gaps the actions like the phone');
  // A screen-width variant here would bring back exactly the fault this fixes.
  assert.ok(!parts.some((p) => /^(sm|md|lg|xl):/.test(p)), 'no screen-width variant in a pane-width rule');
});

test('the inline nudge (the chat one) wears it', () => {
  const inline = NUDGE.match(/<InlineNotice\b[^>]*\/>/g) ?? [];
  assert.equal(inline.length, 1, 'one inline render');
  assert.match(inline[0]!, /BY_ITS_OWN_WIDTH/, 'the inline nudge must lay out by its own width');
});

test('the shared notice keeps the hooks the rule reaches for', () => {
  const notices = readFileSync(join(__dirname, '../../_components/notices/notices.tsx'), 'utf8');
  assert.match(notices, /data-notice-key/);
  assert.match(notices, /data-notice-actions/);
});
