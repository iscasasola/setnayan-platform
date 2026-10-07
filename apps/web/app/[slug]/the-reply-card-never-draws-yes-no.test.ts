/**
 * ✉ THE REPLY CARD NEVER DRAWS YES / NO — it is the doorway to the reply sheet,
 * never a second form.
 *
 * Owner, 2026-10-06 (DECISION_LOG "THE INVITATION HAS A REPLY CARD, NOT A SECOND
 * FORM"): the Invitation gets a Reply card under the names on Welcome and at the
 * top of Me — before a reply "Will you join us? · Reply by … · Reply", after it
 * "You're coming · 2 seats · Change my reply" or "You can't make it · Change my
 * reply". *"It never repeats the Yes/No buttons."*
 *
 * RENDERED (`ReplyCardRow` from `replyCardOf`) in every reply state, then the
 * body read as source for where it is mounted:
 *   1. exactly ONE control, the one main action, pointing at the reply sheet;
 *   2. no Yes / No / Maybe button, no form, no radio — the answer is given in
 *      the sheet, once;
 *   3. the words of each state; "Reply by" only for a date the host set;
 *   4. on the day and after, no card — the page's action keeps its own words;
 *   5. site-body mounts it under the names and at the top of Me, behind the
 *      guest-side switch, and the Welcome action is still mounted once.
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

const controls = (html: string) => html.match(/<(a|button|summary|input|select|form)\b/g) ?? [];
const YES_NO = />\s*(Yes|No|Maybe|Attending|Not attending|Joyfully accept|Regretfully decline)\b[^<]*</i;

async function cardFor(rsvpStatus: 'pending' | 'maybe' | 'attending' | 'declined', today = '2026-09-20', replyBy: string | null = null, seats = 1) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { resolveArrivalAction } = await import('@/lib/arrival-action');
  const { replyCardOf } = await import('@/lib/guest-me-parts');
  const { ReplyCardRow } = await import('./_components/guest-me-parts');
  const action = resolveArrivalAction({ slug: 'ana-ben', eventDate: '2026-12-18', today, rsvpStatus });
  const card = replyCardOf({ action, replyBy, seats });
  return { card, html: card ? renderToStaticMarkup(React.createElement(ReplyCardRow, { card })) : '' };
}

test('1–2 · one control into the reply sheet, and never a Yes / No button, in every reply state', async () => {
  for (const s of ['pending', 'maybe', 'attending', 'declined'] as const) {
    const { html } = await cardFor(s);
    assert.ok(html, `${s}: no card`);
    assert.equal(controls(html).length, 1, `${s}: ${controls(html).length} controls in the card`);
    assert.match(html, /href="\/ana-ben#your-details"/, `${s}: the card does not open the reply sheet`);
    assert.doesNotMatch(html, YES_NO, `${s}: the card draws a Yes / No answer`);
    assert.doesNotMatch(html, /<form|type="radio"|<button/, `${s}: the card is a form`);
  }
});

test('3 · the words of each state', async () => {
  const before = await cardFor('pending', '2026-09-20', 'Friday, November 20, 2026');
  assert.match(before.html, /Will you join us\?/);
  assert.match(before.html, /Reply by Friday, November 20, 2026/);
  assert.match(before.html, />Reply</);
  const noDate = await cardFor('pending');
  assert.doesNotMatch(noDate.html, /Reply by/, 'a "Reply by" line with no date the host set');
  const coming = await cardFor('attending', '2026-09-20', null, 2);
  assert.match(coming.html, /You’re coming · 2 seats/);
  assert.match(coming.html, />Change my reply</);
  assert.match((await cardFor('attending')).html, /You’re coming · 1 seat</);
  const cant = await cardFor('declined');
  assert.match(cant.html, /You can’t make it/);
  assert.match(cant.html, />Change my reply</);
});

test('4 · on the day and after, there is no card — the action keeps its own words', async () => {
  assert.equal((await cardFor('attending', '2026-12-18')).card, null, 'a card on the day');
  assert.equal((await cardFor('attending', '2026-12-19')).card, null, 'a card after the day');
});

test('5 · mounted under the names and at the top of Me, behind the switch; the Welcome action stays one mount', () => {
  const body = stripComments(readFileSync(join(__dirname, '_components/site-body.tsx'), 'utf8'));
  assert.match(body, /guestStages && pageStage === 'rsvp' && plan\.rsvpShouldRender && !isMakerCanvas\s*\?\s*replyCardOf\(/, 'the card is not behind the guest-side switch and the sheet’s own gate');
  assert.match(body, /\{replyCard \? \(\s*<ReplyCardRow card=\{replyCard\}[^]*?\) : \(\s*<ArrivalActionRow/, 'the card does not stand in the Welcome action’s place');
  assert.equal(body.split('<ArrivalActionRow').length - 1, 1, 'the Welcome action is mounted more than once');
  const me = body.slice(body.lastIndexOf('data-me-stage'));
  const card = me.search(/\{replyCard && replyCard\.kind !== 'ask' \? <ReplyCardRow card=\{replyCard\} \/> : null\}/);
  assert.ok(card >= 0 && card < me.indexOf('meSection'), 'the card is not at the top of Me (before the ticket and the rest of Me)');
});
