/**
 * ❓ HOW GUESTS ANSWER ▾ IS `oneAtATime` (owner 2026-10-06, verbatim: *"on RSVP,
 * it can show all the questions or the data to fill like a form or ask one by
 * one"*; DECISION_LOG "'ASK ONE BY ONE' IS HOW THE GUEST'S RSVP ASKS").
 *
 *   1 · ONE dropdown, two choices — All at once · One by one — whose value is
 *       read from `oneAtATime` and whose pick saves `{ oneAtATime }` and nothing
 *       else, through the panel's one drafted save (counted on ✓ Apply).
 *   2 · Rendered (Studio › RSVP), the button names the stored answer both ways,
 *       and "How guests get in" IS in Studio › RSVP — the shared `GuestsGetIn`
 *       part, the same one Guests › Setup mounts (owner 2026-10-07,
 *       HOME_AND_GUESTS_CHECK § "Setup ↔ Event Hub Maker": *"make sure to make the
 *       adjustments and mapping on event hub maker as well"* — supersedes the
 *       2026-10-06 reading that Studio › RSVP has no get-in switch).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const FILE = 'app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx';

test('1 · one dropdown over oneAtATime — read from it, writing only it', async () => {
  const src = stripComments(readFileSync(join(WEB, FILE), 'utf8'));
  const at = src.indexOf('if (studio) {');
  assert.ok(at > 0, 'the Studio branch moved — re-read this guard');
  const block = src.slice(at, src.indexOf('\n  }\n', at));
  const pick = block.slice(block.indexOf('dataAttr="data-rsvp-answer-pick"') - 200, block.indexOf('</section>', block.indexOf('dataAttr="data-rsvp-answer-pick"')));
  assert.match(pick, /value=\{oneAtATime \? 'one' : 'all'\}/, 'the dropdown does not read oneAtATime');
  assert.match(pick, /options=\{HOW_GUESTS_ANSWER_OPTIONS\}/);
  assert.match(pick, /save\(\{ oneAtATime: next \}, /, 'the pick does not save oneAtATime');
  assert.equal((pick.match(/save\(/g) ?? []).length, 1, 'the pick saves more than one thing');
  assert.doesNotMatch(block, /<Switch[^>]*oneAtATime/, 'a second, switch-shaped control for the same answer is drawn');
  assert.equal((block.match(/data-rsvp-answer-pick/g) ?? []).length, 1);
  assert.match(src, /const oneAtATime = readOneAtATime\(local\);/);
  const { HOW_GUESTS_ANSWER_OPTIONS } = await import(`../${FILE}`);
  assert.deepEqual(
    HOW_GUESTS_ANSWER_OPTIONS.map((o: { key: string; label: string }) => [o.key, o.label]),
    [['all', 'All at once'], ['one', 'One by one']],
  );
});

test('2 · rendered: the stored answer, both ways — and no "How guests get in"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${FILE}`);
  const paint = (oneAtATime: boolean) =>
    renderToStaticMarkup(
      React.createElement(MakerRsvpSettings, {
        eventId: 'ev-1',
        studio: true,
        current: oneAtATime ? { oneAtATime: true } : {},
        drafted: false,
        replyBy: null,
        replyByOwn: { deadline: null, pricingMode: 'realtime' },
        requests: { count: 0, list: null },
        draftAction: async () => ({ ok: true }),
        replyByAction: async () => {},
      }),
    );
  for (const [on, label] of [[true, 'One by one'], [false, 'All at once']] as const) {
    const html = paint(on);
    const btn = html.slice(html.indexOf('data-rsvp-answer-pick'));
    assert.ok(btn.slice(0, 600).includes(label), `stored ${on}, the dropdown does not read "${label}"`);
    assert.match(html, /data-studio-rsvp=""/);
    // How guests get in is the shared `GuestsGetIn` part, loaded lazily (first-load budget) — see the source check below.
    assert.doesNotMatch(html, /Ask one question at a time/, 'the old switch is drawn beside the dropdown');
  }
  const src = readFileSync(join(WEB, FILE), 'utf8');
  const studio = src.slice(src.indexOf('if (studio) {'), src.indexOf('return (\n    <div className="flex flex-col gap-5 px-1" data-made-once="rsvp-page">'));
  assert.equal((studio.match(/<GuestsGetIn\b/g) ?? []).length, 1, 'Studio › RSVP draws ONE How guests get in — the shared part');
});
