/**
 * 🫥 AN UNKNOWN IS NEVER DRAWN AS NONE (ship review of #8044, 20 Nov 2026 — the honest-read rule).
 *
 *   1 · a counter whose amount did not come back reads "₱ — amount not loaded", never ₱0;
 *   2 · the inquiry card, when the quotes read failed (`hasQuote: null`), says it could not check — it does not
 *       offer "Reply with an offer" as if no quote existed, and the picked client page passes null on that failure.
 * Rendered, not grepped, for what the reader sees.
 * Run from apps/web: node --import tsx --test app/_components/chat/cards/an-unknown-is-never-drawn-as-none.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..', '..', '..', '..');
const C = (php: number) => php * 100;

async function render(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

test('1 · a counter with no amount is unknown, not ₱0', async () => {
  const { NegotiationCard } = await import('./negotiate-cards');
  const quote = {
    proposalId: 'p', title: 'Lights and sound', status: 'sent', totalCentavos: C(51_000),
    lines: [{ key: 'l0', label: 'Lights and sound', detail: null, amountCentavos: C(51_000) }],
    planRows: [], creditCentavos: 0, floorCentavos: null, paidSeqs: [], locks: { quote: false, plan: false },
  };
  const ask = (amountCentavos: number | null) => ({
    askId: 'c1', subject: 'quote' as const, note: 'Can we meet lower?', askedAt: '2026-11-20T02:00:00Z', status: 'open' as const,
    proposalId: 'p', amountCentavos, scopeLabel: null, goodUntil: '2026-11-24', raisedBy: 'host' as const,
  });
  const el = (a: number | null) =>
    React.createElement(NegotiationCard, { threadId: 't', kind: 'counter', askedAt: '2026-11-20T02:00:00Z', viewer: 'vendor', seed: { ask: ask(a), quote, today: '2026-11-20' } });
  const missing = await render(el(null));
  assert.match(missing, /data-counter-amount-unknown=""[^>]*>₱ — amount not loaded/);
  assert.doesNotMatch(missing, /₱0(?![\d,])/);
  // Anti-vacuity: a real amount still draws as itself.
  assert.match(await render(el(C(40_000))), /₱40,000/);
});

test('1b · the counter FACE, its ⓘ details and its folded line say unknown too — never ₱0 (part C)', async () => {
  const { NegotiationCard } = await import('./negotiate-cards');
  const quote = {
    proposalId: 'p', title: 'Lights and sound', status: 'sent', totalCentavos: C(51_000),
    lines: [{ key: 'l0', label: 'Lights and sound', detail: null, amountCentavos: C(51_000) }],
    planRows: [], creditCentavos: 0, floorCentavos: null, paidSeqs: [], locks: { quote: false, plan: false },
  };
  const ask = (amountCentavos: number | null, over: Record<string, unknown> = {}) => ({
    askId: 'c1', subject: 'quote' as const, note: 'Can we meet lower?', askedAt: '2026-11-20T02:00:00Z', status: 'open' as const,
    proposalId: 'p', amountCentavos, scopeLabel: null, goodUntil: '2026-11-24', raisedBy: 'host' as const, ...over,
  });
  const el = (a: number | null, over: Record<string, unknown> = {}) =>
    React.createElement(NegotiationCard, { threadId: 't', kind: 'counter', askedAt: '2026-11-20T02:00:00Z', viewer: 'vendor', seed: { ask: ask(a, over), quote, today: '2026-11-20', lowestCentavos: null } });
  // The open face: the title is the unknown words, not "₱51,000 → ₱0".
  const face = await render(el(null));
  assert.match(face, /data-counter-title="total"[\s\S]{0,1500}data-counter-amount-unknown=""[^>]*>₱ — amount not loaded/);
  assert.doesNotMatch(face, /₱0(?![\d,])/);
  // One line of the quote: "Lights and sound → ₱ — amount not loaded".
  const line = await render(el(null, { scopeLabel: 'Lights and sound' }));
  assert.match(line, /data-counter-title="line"[\s\S]{0,1500}₱ — amount not loaded/);
  assert.doesNotMatch(line, /₱0(?![\d,])/);
  // Settled: the folded line (and the details it opens) say unknown.
  for (const status of ['accepted', 'declined', 'countered'] as const) {
    const settled = await render(el(null, { status }));
    assert.match(settled, /₱ — amount not loaded/, `${status}: the folded line says unknown`);
    assert.doesNotMatch(settled, /₱0(?![\d,])/, `${status}: never ₱0`);
  }
  // The ⓘ sheet's body is the same `details` the settled card opens — rendered above; its source carries no ₱0 fallback.
  const src = stripComments(readFileSync(join(WEB, 'app/_components/chat/cards/negotiate-cards.tsx'), 'utf8'));
  const card = src.slice(src.indexOf('export function NegotiationCard'), src.indexOf('function Status('));
  assert.doesNotMatch(card, /amountCentavos \?\? 0/, 'no ₱0 fallback on the counter card, its title, its folded words or its halfway');
  // Anti-vacuity: a real amount still draws as itself on the face.
  assert.match(await render(el(C(40_000))), /₱51,000[\s\S]{0,1500}₱40,000/);
});

test('2 · a failed quotes read is said as unknown on the inquiry card', async () => {
  const { InquiryCard } = await import('./inquiry-card');
  const facts = (hasQuote: boolean | null) => ({ date: '2027-03-13', guests: '150', venue: 'Fernwood Gardens', budget: null, hasQuote });
  const el = (hasQuote: boolean | null) =>
    React.createElement(InquiryCard, { threadId: 't', body: 'Inquiry', from: 'Claire', at: 'Today', facts: facts(hasQuote), calendar: null });
  const unknown = await render(el(null));
  assert.match(unknown, /data-inquiry-quote-unknown=""/);
  assert.doesNotMatch(unknown, /data-inquiry-reply=""/);
  assert.doesNotMatch(unknown, /You replied with a quote/);
  assert.match(await render(el(false)), /data-inquiry-reply=""/, 'no quote, read fine: the reply is offered');
  // The picked client page passes the failure through, the way its strip already does.
  const page = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'));
  assert.equal((page.match(/hasQuote: proposalRowsError \? null : Boolean\(sentQuote\)/g) ?? []).length, 2, 'the strip and the inquiry facts both');
});
