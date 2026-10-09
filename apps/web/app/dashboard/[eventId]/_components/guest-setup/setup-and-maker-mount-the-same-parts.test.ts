/**
 * setup-and-maker-mount-the-same-parts.test.ts — ONE SETTING, TWO DOORS (owner
 * 2026-10-07, HOME_AND_GUESTS_CHECK § "Setup ↔ Event Hub Maker": *"make sure to
 * make the adjustments and mapping on event hub maker as well"*).
 *
 * Guests › Setup (`guest-setup-rows.tsx`) and the Maker's RSVP settings
 * (`maker-rsvp-ask.tsx`, which Studio › RSVP, the RSVP stage and Event Details
 * all draw) both mount `GuestsGetIn`, `RsvpAsks`, `ReplyBy` — and neither
 * draws a get-in dropdown or an ask switch of its own. Both save the same blob
 * through the same door (`hubDraftAction`, `rsvp_ask_config`).
 *
 * 🛡 Sabotage: a local `<PickMenu … guestsGetInOptions()` back in the Maker → red;
 * the Maker's asks drawn as `<Switch … RSVP_ASK_LABEL` again → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const SETUP = read('guest-setup-rows.tsx');
const MAKER = read('..', '..', 'launch', '_components', 'maker-rsvp-ask.tsx');
const lazy = readFileSync(join(HERE, 'guest-setup-lazy.tsx'), 'utf8');
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

test('both doors import the three shared parts from guest-setup/', () => {
  for (const [name, src, from] of [
    ['Setup', SETUP, './'],
    ['Maker', MAKER, '../../_components/guest-setup/'],
  ] as const) {
    for (const [part, file] of [['GuestsGetIn', 'guests-get-in'], ['RsvpAsks', 'rsvp-asks'], ['ReplyBy', 'reply-by']]) {
      // Setup imports it; the Maker loads the SAME module lazily (its first-load budget).
      const imported =
        src.includes(`import { ${part} } from '${from}${file}'`) ||
        (name === 'Maker' && /import \{ GuestsGetIn, ReplyBy, RsvpAsks \} from '\.\.\/\.\.\/_components\/guest-setup\/guest-setup-lazy'/.test(src) &&
          lazy.includes(`import(/* webpackChunkName: "maker-guest-setup" */ './${file}').then((m) => m.${part})`));
      assert.ok(imported, `${name} does not import ${part}`);
      assert.ok(count(src, new RegExp(`<${part}\\b`, 'g')) >= 1, `${name} does not mount <${part}>`);
    }
  }
});

test('the Maker mounts the parts in its Studio, its stage form and its Details editor', () => {
  // ONE framed mount for the reply's rows — the SAME list Studio › RSVP and the stage's form draw (2026-10-08, the
  // templates) — and one for Event Details' own row.
  console.log(`maker mounts: GuestsGetIn ${count(MAKER, /<GuestsGetIn\b/g)} · RsvpAsks ${count(MAKER, /<RsvpAsks\b/g)} · ReplyBy ${count(MAKER, /<ReplyBy\b/g)}`);
  assert.equal(count(MAKER, /<GuestsGetIn\b/g), 2, 'the reply’s rows (Studio + the stage) and Event Details');
  assert.equal(count(MAKER, /<RsvpAsks\b/g), 2, 'the reply’s rows (Studio + the stage) and Event Details');
  assert.equal(count(MAKER, /\{formRows\}/g), 2, 'Studio › RSVP and the stage’s form do not draw the same rows');
  assert.match(MAKER, /<FormRows data="rsvp">\s*\{replyByRow\}\s*\{answerRow\}\s*\{wordRows\('form'\)\}\s*\{getInRow\}\s*\{asksRow\}\s*<\/FormRows>/);
  /* Owner on the preview 2026-10-08: *"where it the reply by date?"* → *"date is not changeable on studio."* —
     the Maker mounts the part as an EDITABLE row (it printed the date read-only), drafted. */
  assert.ok(/<ReplyBy\s+layout="frame"\s+frame=\{replyByFrame\}[^>]*\baction=\{replyByAction\}\s+draft\s*\/>/.test(MAKER), 'the Maker does not mount an editable, drafted Reply by row');
  assert.ok(!/layout="print"/.test(MAKER), 'Studio › RSVP prints Reply by read-only again');
});

test('a door may draw the ROW — the part still owns the value, the choices and the writer; the six asks are the part’s own chips', () => {
  const part = (file: string) => read(file);
  // The Maker hands each part a frame; what the frame is given comes from the part, never spelled in the Maker.
  assert.match(MAKER, /const getInRow = <GuestsGetIn frame=\{getInFrame\} value=\{getInNow\} onPick=\{pickGetIn\} \/>;/);
  assert.match(MAKER, /const asksRow = <RsvpAsks frame=\{asksFrame\} config=\{local\} onToggle=\{toggleAsk\} \/>;/);
  const getIn = part('guests-get-in.tsx');
  assert.match(getIn, /name: GUESTS_GET_IN_LABEL,\s*value,\s*buttonText: guestsGetInLabel\(value\),\s*hint: choice\.hint,\s*options: guestsGetInOptions\(\),\s*onPick: pick,/);
  assert.match(getIn, /const pick = \(next: string\) => \(next === value \|\| !isGuestsGetIn\(next\) \? undefined : onPick\(next\)\);/, 'a framed pick of the stored choice (or of a made-up one) is sent');
  const replyBy = part('reply-by.tsx');
  assert.match(replyBy, /frame\(\{ name: REPLY_BY_LABEL, own: value, fallback, keep: pick, attrs: /, 'the framed row is handed something other than the part’s own value and writer');
  // The six asks: the CHIPS are drawn by the part in both doors (one look); only the row around them is the door's.
  const asks = part('rsvp-asks.tsx');
  assert.match(asks, /<Chips<RsvpAskField>\s+label=\{RSVP_ASKS_TITLE\}/);
  assert.equal(count(asks, /<Chips\b/g), 1, 'the asks are drawn twice (a look per door)');
  assert.match(asks, /value=\{RSVP_ASK_FIELDS\.filter\(\(field\) => rsvpAsks\(config, field\)\)\}\s*onToggle=\{onToggle\}/);
  assert.doesNotMatch(asks, /ActionButton|<button\b/, 'the asks are hand-made toggles again');
  // No part wraps a framed row (a row must stay a direct child of its list — its hairline is `first:`'s).
  for (const src of [getIn, replyBy, asks]) assert.doesNotMatch(src, /className="contents"/, 'a part wraps the row its frame draws');
  // …and neither of the two parts whose row the Maker draws carries a template: Guests › Setup downloads none.
  for (const src of [getIn, replyBy]) assert.doesNotMatch(src, /form-row|\/calendar|\/chips/, 'a shared part imports the Form row or the calendar');
});

test('neither door draws a get-in dropdown or an ask switch of its own', () => {
  for (const [name, src] of [['Setup', SETUP], ['Maker', MAKER]] as const) {
    assert.doesNotMatch(src, /guestsGetInOptions\(/, `${name} draws its own get-in dropdown`);
    assert.doesNotMatch(src, /RSVP_ASK_FIELDS\.map\(/, `${name} draws its own ask controls`);
    assert.doesNotMatch(src, /type="date"/, `${name} draws its own reply-by field`);
  }
});

test('both doors save the ONE blob through the ONE draft door', () => {
  for (const [name, src] of [['Setup', SETUP], ['Maker', MAKER]] as const) {
    assert.match(src, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ rsvp_ask_config: next \} \}\)\)/, `${name} saves something else`);
    assert.match(src, /hubDraftAction|draftAction\(/, `${name} leaves the draft door`);
    assert.match(src, /guestsGetInPatch\(/, `${name} writes the get-in keys some other way`);
  }
});
