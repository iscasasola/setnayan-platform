/**
 * A HELD ASK OFFERS THE PICK, NOT AGREE (owner 2026-11-06, SERVICES LIFE CYCLE; coordinator review of #7374).
 *
 * While the asked-for service is on PLAN hold the database refuses the yes (`a_held_service_takes_no_booking`), so an
 * active "Agree to this booking" could only be refused again. The real panel, drawn both ways:
 *   · held → no Agree form; the forward pill "Pick which stay on" (terracotta, main) to My Shop's section; the
 *     "Can't take this booking?" no is unchanged;
 *   · not held → Agree as always, no pill;
 *   · the red line names the service and carries NO link (the pill is the one door).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

// tsconfig sets "jsx": "preserve" — the panel's JSX needs React in scope before the DYNAMIC import.
(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));
const noop = async () => {};

async function panel(heldService: string | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LockRequestAnswer } = await import('./booking-ask-panel');
  return renderToStaticMarkup(
    React.createElement(LockRequestAnswer, {
      eventVendorId: '00000000-0000-4000-8000-0000000000bb',
      expiresAt: '2026-10-13T20:00:00Z',
      payoutReadiness: 'ready',
      feeForecast: null,
      returnTo: '/vendor-dashboard/clients/x',
      agreeLock: noop,
      declineLock: noop,
      heldService,
      now: new Date('2026-10-12T04:00:00Z'),
    }),
  );
}

test('held: no Agree — the forward pill to Which services stay on, and the no is unchanged', async () => {
  const html = await panel('Same-Day Edit');
  assert.doesNotMatch(html, /Agree to this booking/);
  assert.match(html, /data-testid="held-ask-pick"/);
  assert.match(html, /href="\/vendor-dashboard\/shop#stay-on"/);
  assert.match(html, /Pick which stay on/);
  assert.match(html, /data-tone="brand"[^>]*data-main=""/, 'the pill is the forward (terracotta, main) button');
  assert.match(html, /Can(?:&#x27;|&rsquo;|’)t take this booking\?/);
  assert.match(html, /Turn it down/);
});

test('not held: Agree as always, no pill', async () => {
  const html = await panel(null);
  assert.match(html, /Agree to this booking/);
  assert.doesNotMatch(html, /held-ask-pick/);
});

test('the red line names the service and carries no link', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LockAnswerLine } = await import('./booking-ask-panel');
  const { lockAgreeNotice } = await import('@/lib/lock-answer-notice');
  const named = lockAgreeNotice('service_on_hold', { heldService: 'Same-Day Edit' })!;
  assert.match(named.text, /^Upgrade to accept this booking — Same-Day Edit is on hold on your plan\./);
  const html = renderToStaticMarkup(React.createElement(LockAnswerLine, { notice: named }));
  assert.doesNotMatch(html, /<a\b/, 'the pill is the one door — no link inside the red line');
  // Unknown → still a sentence, never an empty name.
  assert.match(lockAgreeNotice('service_on_hold')!.text, /— the service they asked for is on hold/);
});

test('both surfaces that draw the panel read the held service and hand it over', () => {
  const card = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  assert.match(card, /heldServiceOfAsk\(supabase, lockRequest\.event_vendor_id\)/);
  assert.match(card, /heldService=\{heldService\}/);
  const thread = stripComments(readFileSync(join(HERE, '..', '..', '..', 'messages', '[threadId]', 'page.tsx'), 'utf8'));
  assert.match(thread, /heldServiceOfAsk\(supabase, lockHandshake\.eventVendorId\)/);
  assert.match(thread, /heldService=\{heldAskService\}/);
});
