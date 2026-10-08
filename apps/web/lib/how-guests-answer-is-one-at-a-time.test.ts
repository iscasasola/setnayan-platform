/**
 * ❓ HOW GUESTS ANSWER IS `oneAtATime` (owner 2026-10-06, verbatim: *"on RSVP,
 * it can show all the questions or the data to fill like a form or ask one by
 * one"*; DECISION_LOG "'ASK ONE BY ONE' IS HOW THE GUEST'S RSVP ASKS").
 *
 *   1 · ONE control, two choices — All at once · One by one — whose value is
 *       read from `oneAtATime` and whose pick saves `{ oneAtATime }` and nothing
 *       else, through the panel's one drafted save (counted on ✓ Apply). Two
 *       NAMED things are a PILL SELECTOR (owner 2026-10-08, `INTERACTION_RULES.md`
 *       § 9: a dropdown is for three or more, a switch for on / off) — it was a
 *       dropdown of two in Studio and a switch "Ask one question at a time" on the
 *       RSVP stage and in Event Details: three controls for one setting.
 *   2 · Rendered in EVERY door (Studio › RSVP, the RSVP stage's form, Event
 *       Details), the SAME pill names the stored answer both ways — and
 *       "How guests get in" IS in Studio › RSVP — the shared `GuestsGetIn`
 *       part, the same one Guests › Setup mounts (owner 2026-10-07,
 *       HOME_AND_GUESTS_CHECK § "Setup ↔ Event Hub Maker": *"make sure to make the
 *       adjustments and mapping on event hub maker as well"* — supersedes the
 *       2026-10-06 reading that Studio › RSVP has no get-in switch).
 *
 * 🛡 Sabotage (2026-10-08, each red alone, each restored): the pill reading `!oneAtATime` → 1 and 2; its pick also
 * saving `ask` → 1; the old switch drawn again beside it in Event Details → 1 and 2.
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

test('1 · ONE pill selector over oneAtATime — read from it, writing only it', async () => {
  const src = stripComments(readFileSync(join(WEB, FILE), 'utf8'));
  const at = src.indexOf('const answerRow = (');
  assert.ok(at > 0, 'the How guests answer row moved — re-read this guard');
  const row = src.slice(at, src.indexOf('\n  );\n', at));
  assert.match(row, /<PillSelector\s+label=\{HOW_GUESTS_ANSWER_LABEL\}/, 'two named things are not a pill selector');
  assert.match(row, /value=\{oneAtATime \? 'one' : 'all'\}/, 'the pill does not read oneAtATime');
  assert.match(row, /options=\{HOW_GUESTS_ANSWER_OPTIONS\}/);
  assert.match(row, /void save\(\{ oneAtATime: next \}, /, 'the pick does not save oneAtATime');
  assert.equal((row.match(/save\(/g) ?? []).length, 1, 'the pick saves more than one thing');
  assert.match(row, /if \(next !== oneAtATime\) /, 'picking the answer already stored still writes');
  // ONE control for the setting in the whole panel: this row, drawn by the reply's rows (Studio › RSVP and the
  // stage's form) and by Event Details — never a switch or a dropdown for the same answer beside it.
  assert.equal((src.match(/\{answerRow\}/g) ?? []).length, 2, 'the row is not the one drawn in every door');
  assert.equal((src.match(/save\(\{ oneAtATime: /g) ?? []).length, 1, 'a second control writes the same answer');
  assert.doesNotMatch(src, /role="switch"|<Switch\b|<SwitchRow\b|Ask one question at a time/, 'a switch-shaped control for the same answer is drawn');
  assert.doesNotMatch(src, /<PickMenu\b/, 'a dropdown of the panel’s own is drawn (two choices are a pill; three or more ride a Form row)');
  assert.match(src, /const oneAtATime = readOneAtATime\(local\);/);
  const { HOW_GUESTS_ANSWER_OPTIONS, HOW_GUESTS_ANSWER_ABOUT } = await import(`../${FILE}`);
  assert.deepEqual(
    HOW_GUESTS_ANSWER_OPTIONS.map((o: { key: string; label: string }) => [o.key, o.label]),
    [['all', 'All at once'], ['one', 'One by one']],
  );
  // What each means is behind the row's ⓘ — the options' own lines, word for word.
  assert.equal(HOW_GUESTS_ANSWER_ABOUT, 'All at once: Every question on one page, like a form. One by one: One question per screen · Next › Send.');
});

test('2 · rendered in every door: the SAME pill names the stored answer, both ways — and Studio draws the shared "How guests get in"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${FILE}`);
  const paint = (oneAtATime: boolean, door: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(MakerRsvpSettings, {
        eventId: 'ev-1',
        ...door,
        current: oneAtATime ? { oneAtATime: true } : {},
        drafted: false,
        replyBy: null,
        replyByOwn: { deadline: null, pricingMode: 'realtime' },
        requests: { count: 0, list: null },
        draftAction: async () => ({ ok: true }),
        replyByAction: async () => {},
      }),
    );
  const DOORS = [
    ['Studio › RSVP', { studio: true }, /data-studio-rsvp=""/],
    ['the RSVP stage’s form', { scene: 'form' }, /data-rsvp-stage-controls="form"/],
    ['Event Details', {}, /data-made-once="rsvp-page"/],
  ] as const;
  for (const [name, door, mark] of DOORS) {
    for (const [on, label] of [[true, 'One by one'], [false, 'All at once']] as const) {
      const html = paint(on, door);
      assert.match(html, mark, `anti-vacuity: ${name} was not drawn`);
      assert.equal((html.match(/data-pill-selector="rsvp-answer"/g) ?? []).length, 1, `${name} draws no pill for How guests answer (or two)`);
      const pill = html.slice(html.indexOf('data-pill-selector="rsvp-answer"'));
      const pressed = [...pill.slice(0, 2400).matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*data-seg="(all|one)"[^>]*>([^<]*)</g)].map((m) => `${m[2]}:${m[1]}:${m[3]}`);
      assert.deepEqual(pressed, on ? ['all:false:All at once', 'one:true:One by one'] : ['all:true:All at once', 'one:false:One by one'], `${name}: stored ${on}, the pill does not read "${label}"`);
      assert.match(html, /How guests answer/);
      assert.doesNotMatch(html, /Ask one question at a time|role="switch"/, `${name}: the old switch is drawn beside the pill`);
    }
  }
  // How guests get in is the shared `GuestsGetIn` part, loaded lazily (first-load budget): ONE framed mount for the
  // reply's rows (Studio › RSVP and the stage's form draw that same element), ONE for Event Details' own row.
  const src = stripComments(readFileSync(join(WEB, FILE), 'utf8'));
  assert.equal((src.match(/<GuestsGetIn\b/g) ?? []).length, 2, 'the Maker does not draw the shared How guests get in once per look');
  assert.match(src, /const getInRow = <GuestsGetIn frame=\{getInFrame\} value=\{getInNow\} onPick=\{pickGetIn\} \/>;/);
  assert.equal((src.match(/\{formRows\}/g) ?? []).length, 2, 'Studio › RSVP and the stage’s form do not draw the same rows');
});
