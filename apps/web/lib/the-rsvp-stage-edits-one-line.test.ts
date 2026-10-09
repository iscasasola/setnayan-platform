/**
 * the-rsvp-stage-edits-one-line.test.ts — ON THE RSVP STAGE, EDIT IS THE PICKED LINE'S WORDS AND NOTHING ELSE.
 *
 * Owner, on the live Maker's RSVP stage (2026-10-09, verbatim): "why is this grouped?" · "shouldn't it be per
 * element?" · "why is this scrolling? the bottom toolbar is not aligned to our design" — and on the prototype
 * (`public/review/rsvp-per-element.html`): "i like this idea. heading message then the whole group?"
 *
 * Held here (the parts themselves are `the-rsvp-stage-is-parts.test.ts` §8):
 *   1 · EXECUTED — with a line picked and the toolbar on Edit, the stage's panel draws THAT line's words and its own
 *       Start from, and no other word; with the group picked it draws the group's settings and NO word at all (the
 *       long list is gone). Every line that has words gets a row; the pass's Save button has none.
 *   2 · The three lines that had no words (eyebrow · question · hint) are stored like the others, capped, and absent
 *       they draw the card's own words — byte-identical to before.
 *   3 · Nothing else grew: the desktop's stage and Studio › RSVP list the same words they did.
 *   4 · WIRING — the toolbar hands Edit to the stage's panel only for a line with words.
 *
 * Sabotages seen red (each restored): Edit drawing the scene's whole list · a line mapped to the wrong word · the
 * card not reading the couple's question · the group's list keeping its words · the toolbar keeping its own Edit.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { RSVP_WORD_KEYS, RSVP_WORD_LINES, RSVP_WORD_MAX, sanitizeRsvpAskConfig, type RsvpAskConfig } from './rsvp-ask';
import { RSVP_FORM_WORD_DEFAULT, RSVP_LINE_WORD, rsvpFormWord, rsvpLineWord } from './rsvp-form-words';
import { RSVP_SCENE_WORDS, RSVP_STAGE_KEY, RSVP_WORD_LABEL, rsvpPreviewMessages, type RsvpStageScene } from './rsvp-stage';
import { makerPartOfTap } from './maker-parts';
import { RSVP_CANVAS_SECTIONS, RSVP_LINE_NAME, RSVP_SECTION_LINES, RSVP_WORD_SECTION } from '../app/[slug]/_components/rsvp-canvas-parts';

(globalThis as { React?: typeof React }).React = React;
/* The RSVP settings import the draft action, whose module is `server-only`: stubbed for this render, as
   `details-words-and-plans.test.ts` does. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';

/** The stage's panel, drawn: the word fields it holds, in order. */
async function panel(scene: RsvpStageScene, picked: { tool: string; part: string | null; line: string | null } | undefined, current: RsvpAskConfig = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${L}/maker-rsvp-ask`);
  const html = renderToStaticMarkup(
    React.createElement(MakerRsvpSettings as React.FC<Record<string, unknown>>, {
      eventId: 'e-1',
      current,
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: false },
      replyByOwn: { deadline: '2026-11-18', pricingMode: 'final_only' },
      requests: { count: null, list: null },
      scene,
      ...(picked ? { picked } : {}),
    }),
  );
  return { html, fields: [...html.matchAll(/data-rsvp-word-field="(\w+)"/g)].map((m) => m[1]!), starts: (html.match(/data-rsvp-word-lines/g) ?? []).length };
}

/** Each screen's sections, as (screen, section, the Maker part a tap on it picks). */
const PARTS = (Object.keys(RSVP_CANVAS_SECTIONS) as RsvpStageScene[]).flatMap((screen) =>
  (RSVP_CANVAS_SECTIONS[screen] as readonly string[]).map((section) => ({ screen, section, part: makerPartOfTap(RSVP_STAGE_KEY, screen, section, null) })),
);

test('1 · Edit on a picked line draws THAT line’s words and its Start from — and no other word', async () => {
  let seen = 0;
  for (const { screen, section, part } of PARTS) {
    for (const line of RSVP_SECTION_LINES[section] ?? []) {
      const word = rsvpLineWord(part, line);
      const drawn = await panel(screen, { tool: 'edit', part, line }, { words: { attending: 'Count me in', thanksMessage: 'So glad.', question: 'Coming?' } });
      if (!word) {
        /* A line with no words (the pass's Save button): no field — the toolbar keeps its own Edit for it (4). */
        assert.equal(section, 'f:pass');
        assert.deepEqual(drawn.fields, []);
        continue;
      }
      seen++;
      assert.deepEqual(drawn.fields, [word], `${screen} › ${line} drew ${drawn.fields.join(', ') || 'nothing'}`);
      assert.equal(RSVP_WORD_SECTION[word], section, `${line} types a word of another section`);
      assert.ok(RSVP_WORD_LABEL[word] && RSVP_LINE_NAME[line], `${line} has no name`);
      /* ONE Start from at most — the line's own; none where there is nothing to start from and nothing written. */
      const expectStart = RSVP_WORD_LINES[word].celebrate.length > 0 || ['attending', 'thanksMessage', 'question'].includes(word);
      assert.equal(drawn.starts > 0, expectStart, `${line}: Start from`);
      assert.match(drawn.html, new RegExp(`data-rsvp-stage-line-edit="${line}"`));
    }
  }
  assert.equal(seen, 9, 'a line with words went untested');
  /* The couple's own words are what the row holds. */
  assert.match((await panel('form', { tool: 'edit', part: 'rsvp', line: 'question' }, { words: { question: 'Coming?' } })).html, /Coming\?/);
});

test('1 · the GROUP’s panel holds its settings and no word: the long list is gone', async () => {
  for (const { screen, part } of PARTS.filter((p) => p.part === 'rsvp' || p.part === 'yesnote' || p.part === 'nonote')) {
    for (const tool of ['style', 'edit']) {
      const drawn = await panel(screen, { tool, part, line: null });
      assert.deepEqual(drawn.fields, [], `${screen} (${tool}) still lists words`);
    }
  }
  /* Nothing picked is the group too — and the form keeps the reply's own settings. */
  const form = await panel('form', { tool: 'style', part: null, line: null });
  assert.deepEqual(form.fields, []);
  assert.match(form.html, /data-rsvp-setting="how-guests-answer"/);
  /* A line picked under Style (until its own looks land) is not the words either. */
  assert.deepEqual((await panel('form', { tool: 'style', part: 'rsvp', line: 'question' })).fields, []);
});

test('2 · the three new lines are stored like the others, and absent they are the card’s own words', async () => {
  for (const key of ['eyebrow', 'question', 'hint'] as const) {
    assert.ok((RSVP_WORD_KEYS as readonly string[]).includes(key));
    assert.equal(sanitizeRsvpAskConfig({ words: { [key]: `  x${'y'.repeat(300)}  ` } }).words?.[key]?.length, RSVP_WORD_MAX[key]);
    assert.equal(sanitizeRsvpAskConfig({ words: { [key]: '   ' } }).words, undefined, 'an empty line is stored');
    /* No invented presets: the one shipped wording is "Automatic" itself. */
    assert.deepEqual(RSVP_WORD_LINES[key], { celebrate: [], solemn: [] });
  }
  /* Byte-identical to what the card printed before these keys existed. */
  assert.deepEqual(RSVP_FORM_WORD_DEFAULT, {
    eyebrow: { celebrate: 'Your reply', solemn: 'Your reply' },
    question: { celebrate: 'Will you celebrate with us?', solemn: 'Will you be with us?' },
    hint: { celebrate: 'Tap one to continue', solemn: 'Tap one to continue' },
  });
  assert.equal(rsvpFormWord(null, 'question', false), 'Will you celebrate with us?');
  assert.equal(rsvpFormWord({}, 'question', true), 'Will you be with us?');
  assert.equal(rsvpFormWord({ question: 'Coming?' }, 'question', true), 'Coming?');
  /* THE CARD reads them — the legend's two lines… */
  const WIDGET = src('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(WIDGET, /<span data-rsvp-line="eyebrow" \{\.\.\.formWordAttrs\('eyebrow'\)\}[^>]*>\s*\{rsvpFormWord\(answerWords, 'eyebrow', words\.solemn\)\}/);
  assert.match(WIDGET, /<span data-rsvp-line="question" \{\.\.\.formWordAttrs\('question'\)\}[^>]*>\s*\{rsvpFormWord\(answerWords, 'question', words\.solemn\)\}/);
  assert.match(WIDGET, /<RsvpOneAtATimeLive initial=\{oneAtATime\} hint=\{answerWords\?\.hint\} \/> : oneAtATime \? <RsvpOneAtATime hint=\{answerWords\?\.hint\} \/>/);
  /* …and the hint, EXECUTED: the couple's, else the card's; named for the Maker's canvas either way. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpStepNext } = await import('../app/[slug]/_components/rsvp-one-at-a-time');
  const hint = (own: string | null) => renderToStaticMarkup(React.createElement(RsvpStepNext, { awaitingTap: true, onNext: () => {}, hint: own }));
  assert.match(hint(null), /<p data-rsvp-line="hint" data-rsvp-word="rsvp:hint" data-rsvp-default="Tap one to continue"[^>]*>Tap one to continue<\/p>/);
  assert.match(hint('Choose one'), /data-rsvp-default="Tap one to continue"[^>]*>Choose one<\/p>/);
  /* The Maker's canvas is told every word — a new one empty, so the page draws its own. */
  const sent = rsvpPreviewMessages({ words: { hint: 'Choose one' } }, false).filter((m) => m.t === 'words');
  assert.deepEqual(sent.filter((m) => /rsvp:(eyebrow|question|hint)/.test(m.key)).map((m) => [m.key, m.t === 'words' ? m.text : null]), [['rsvp:eyebrow', ''], ['rsvp:question', ''], ['rsvp:hint', 'Choose one']]);
});

test('3 · nothing else grew: the desktop’s stage lists the words it did, and every line’s word is a real one', async () => {
  assert.deepEqual(RSVP_SCENE_WORDS, { form: ['attending', 'declined'], thanks: ['thanksHeading', 'thanksMessage'], decline: ['declineHeading', 'declineMessage'] });
  for (const scene of ['form', 'thanks', 'decline'] as const) assert.deepEqual((await panel(scene, undefined)).fields, [...RSVP_SCENE_WORDS[scene]]);
  /* Said outright (never derived from the map it checks): which word each line types. */
  assert.deepEqual(RSVP_LINE_WORD, {
    rsvp: { eyebrow: 'eyebrow', question: 'question', yes: 'attending', no: 'declined', hint: 'hint' },
    yesnote: { heading: 'thanksHeading', message: 'thanksMessage' },
    nonote: { heading: 'declineHeading', message: 'declineMessage' },
  });
  const mapped = Object.values(RSVP_LINE_WORD).flatMap((lines) => Object.values(lines));
  assert.equal(new Set(mapped).size, mapped.length, 'two lines type the same word');
  assert.deepEqual([...mapped].sort(), [...RSVP_WORD_KEYS].sort(), 'a stored word has no line, or a line has no stored word');
  assert.equal(rsvpLineWord('pass', 'save'), null);
  assert.equal(rsvpLineWord('rsvp', null), null);
  assert.equal(rsvpLineWord(null, 'question'), null);
});

test('4 · WIRING: the toolbar hands Edit to the stage’s panel only for a line with words', () => {
  const TOOLS = src(`${L}/stage-tools.tsx`);
  assert.match(TOOLS, /const rsvpLineTypes = rsvpLineWord\(picked, rsvpLine\) !== null;/);
  /* Its own Edit rows stand aside… */
  assert.match(TOOLS, /\{editOn && !rsvpLineTypes \? \(\s*<StageEdit /);
  /* …and the stage's panel — hidden under Edit for every other part — stays in sight. */
  assert.match(TOOLS, /data-stage-edit-own=\{rsvpLineTypes && shownTool === 'edit' \? '' : undefined\}/);
  assert.match(TOOLS, /\[data-phone-chrome="panel"\]\{visibility:hidden;pointer-events:none\}' \+\s*'\[data-maker-shell\]:has\(\[data-stage-tools\]\[data-stage-edit-own\]\) \[data-phone-chrome="panel"\]\{visibility:visible;pointer-events:auto\}'/, 'the lift is not written right under the rule it lifts');
  /* The toolbar stepping away still hides the panel: that rule comes AFTER the lift and is the more specific. */
  assert.ok(TOOLS.indexOf(':has([data-stage-tools][aria-hidden="true"]) [data-phone-chrome="panel"]{visibility:hidden') > TOOLS.indexOf(':has([data-stage-tools][data-stage-edit-own])'));
  /* "You're editing" names the line IN PLACE of its part: "RSVP › Form › Question". */
  assert.match(TOOLS, /if \(rsvpLineName && picked\) \{\s*if \(linePieces\[linePieces\.length - 1\] === makerPartLabelOn\(stageKey, picked\)\) linePieces\.pop\(\);\s*linePieces\.push\(rsvpLineName\);\s*\}/);
  /* The stage tells its panel the tool, the part and the line. */
  const STAGE = src(`${L}/maker-rsvp-stage.tsx`);
  assert.match(STAGE, /const pickedLine = useStagePanelNow\(\)\.line \?\? null;\s*const stageTool = useStageTool\(\);/);
  assert.match(STAGE, /picked=\{\{ tool: stageTool, part: pickedPart, line: pickedLine \}\}/);
  assert.equal((STAGE.match(/picked=\{\{/g) ?? []).length, 1, 'the desktop’s stage was handed the phone’s picked line');
  /* THE LAB shows what the owner looks at: the app's own chrome (the cookie card) stays off its RSVP screens too — it
     covered "Sadly, no", the hint and the Save button. The lab's page only; no real page is touched. */
  const LAB = src('app/dev/maker-lab/guest/page.tsx');
  assert.match(LAB, /\{play === null \? <RsvpCanvasBridge \/> : null\}[\s{}]*<style>\{EDITOR_CANVAS_HIDES_APP_CHROME\}<\/style>/);
});
