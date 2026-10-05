/**
 * THE GUEST PATH SAYS "EVENT" — NEVER "CELEBRATION" FOR THE THING.
 *
 * Owner, 2026-10-04 (DECISION_LOG "ONE WORD: EVENT"): *"yes, use event
 * everywhere"* — every label, button and heading that NAMES the thing says
 * event. Found live by the controller, 2026-10-05, on maria-and-jose: the
 * Welcome's button read **"RSVP for the celebration"**, and the host's Me tab
 * **"You don't need an invitation to your own celebration"**. The word came in
 * through `EventWords.occasion`, whose default is 'celebration' for every type
 * but the funeral — so these strings now say "event" outright instead of
 * borrowing that noun. (The noun itself, and the words a couple typed, are not
 * changed here; the verb "celebrate" in a sentence is not the name of a thing.)
 *
 * Rendered where the component is pure enough to render; read (comments
 * stripped) where it is the server page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { inviteEventPhrase } from '@/lib/guest-invite-message';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
/** The noun, as a name for the thing — "celebrate"/"celebrating" (verbs) do not match. */
const NOUN = /\bcelebrations?\b/i;

test('1 · the Welcome’s reply button says "RSVP for the event" — even with the default occasion word', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SpotlightCard } = await import('./_components/spotlight-card');
  // maria-and-jose is a wedding: its occasion word is the default, 'celebration'.
  const html = renderToStaticMarkup(
    React.createElement(SpotlightCard, { spotlight: { kind: 'rsvp' } as never, occasion: 'celebration' }),
  );
  assert.match(html, /RSVP for the event/);
  assert.doesNotMatch(html, NOUN);
});

test('2 · a guest holding another event’s invite is told "a different event"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FindModeCard } = await import('./_components/empty-states');
  const html = renderToStaticMarkup(
    React.createElement(FindModeCard, { slug: 'maria-and-jose', reason: 'wrong_event', occasion: 'celebration' }),
  );
  assert.match(html, /That invite is for a different event/);
  assert.doesNotMatch(html, NOUN);
});

test('3 · the host’s Me tab, the reply card’s pitch and Me’s fallback name say "event"', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /You don&rsquo;t need an invitation to your own event\./);
  assert.doesNotMatch(body, /invitation to your own \{clientWords\.occasion\}/);

  const reply = read('app/[slug]/_components/rsvp-widget.tsx');
  const pitch = /headline="([^"]*)"/.exec(reply)?.[1] ?? '';
  assert.equal(pitch, 'Planning your own event?');

  const page = read('app/[slug]/page.tsx');
  const name = /eventName=\{event\.display_name \?\? '([^']*)'\}/.exec(page)?.[1] ?? '';
  assert.equal(name, 'the event');
});

test('4 · the invite message, with nothing known, names "our event"', () => {
  assert.equal(inviteEventPhrase({}), 'our event');
  assert.doesNotMatch(inviteEventPhrase({}, 'guest'), NOUN);
});
