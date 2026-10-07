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
  // Studio (1) + the stage form and Details share one `getIn` / `asks` element.
  console.log(`maker mounts: GuestsGetIn ${count(MAKER, /<GuestsGetIn\b/g)} · RsvpAsks ${count(MAKER, /<RsvpAsks\b/g)} · ReplyBy ${count(MAKER, /<ReplyBy\b/g)}`);
  assert.equal(count(MAKER, /<GuestsGetIn\b/g), 2, 'the shared getIn element + the Studio mount');
  assert.equal(count(MAKER, /<RsvpAsks\b/g), 2, 'the shared asks element + the Studio mount');
  assert.ok(/<ReplyBy\s+layout="print"/.test(MAKER), 'Studio › RSVP prints Reply by (read only)');
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
