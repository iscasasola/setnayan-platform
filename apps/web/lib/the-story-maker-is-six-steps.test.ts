/**
 * THE STORY MAKER IS SIX STEPS, WITH A RAIL — and its panels are HIDDEN, never unmounted.
 *
 * 🔴 WHY THIS GUARD EXISTS. Every one of the six steps was BUILT and CORRECT, and then appended
 * to the bottom of the old single-scroll editor. Measured in the live browser at 1907px on
 * 2026-09-10: **no rail anywhere**, and twelve headings for six steps — "The story" existed only
 * as seven loose sections between the desk and the theme. The owner, who approved the prototype,
 * said *"this looks like the old editorial setup page."*
 *
 * 🔑 **A CHECKLIST OF CAPABILITIES IS NOT A PORT.** The verification pass before it asked whether
 * each piece existed, got yes six times, and reported the desk as working. Nobody asked whether
 * the PAGE was the one that had been approved. That is what this file now asks.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { stripComments } from './strip-comments';

const BASE = join(process.cwd(), 'app/dashboard/[eventId]/story');
const editor = stripComments(readFileSync(join(BASE, '_components/editorial-editor.tsx'), 'utf8'));
const page = stripComments(readFileSync(join(BASE, 'page.tsx'), 'utf8'));
const rail = stripComments(readFileSync(join(BASE, '_components/story-rail.tsx'), 'utf8'));

test('the six steps exist, in the order the prototype sets them', () => {
  const order = ['desk', 'story', 'theme', 'cover', 'next', 'publish'];
  const at = order.map((k) => ({ k, i: editor.indexOf(`panel('${k}')`) }));
  for (const { k, i } of at) assert.ok(i > 0, `step "${k}" has no panel`);
  for (let i = 1; i < at.length; i += 1) {
    assert.ok(
      at[i]!.i > at[i - 1]!.i,
      `step "${at[i]!.k}" renders before "${at[i - 1]!.k}" — the six steps are an order, not a set`,
    );
  }
});

/**
 * 🔴 THE DATA-LOSS RULE. The story, theme and publish panels share ONE unsaved form — twelve
 * pieces of state, no autosave, saved only on a publish-rung press. Unmounting a panel throws
 * away everything the host typed the moment they tap another step: silently, with `dirty` still
 * true, and no test would notice. `service-wizard.tsx` in this same app already states the rule.
 */
test('panels are HIDDEN, never conditionally rendered', () => {
  assert.match(
    editor,
    /const panel = \(key: StoryStepKey\) => \(\{ hidden: step !== key/,
    'the panel helper must switch with `hidden`',
  );
  for (const k of ['story', 'theme', 'publish']) {
    assert.ok(
      !new RegExp(`step === '${k}' &&`).test(editor),
      `step "${k}" is conditionally rendered — switching away would destroy the host's typing`,
    );
  }
});

test('the desk is step one, handed in as a slot — not a section above the switcher', () => {
  assert.match(editor, /desk\?: React\.ReactNode;/, 'the editor must take a desk slot');
  assert.match(page, /desk=\{/, 'the page must hand the desk in');
  assert.ok(
    page.indexOf('desk={') < page.indexOf('cover={'),
    'the desk slot should sit with its sibling slots',
  );
});

test('the rail exists, is sticky, and is the only place the step is chosen', () => {
  assert.match(rail, /STORY_STEPS = \['desk', 'story', 'theme', 'cover', 'next', 'publish'\]/);
  assert.match(rail, /sticky/, 'the rail must be sticky, as the prototype has it');
  assert.match(editor, /<StoryRail/, 'the editor must mount the rail');
  // One selection drives both surfaces. Two copies of "which step is open" is how a phone strip
  // and a rail come to disagree about one fact.
  assert.equal(
    (rail.match(/useState/g) ?? []).length,
    0,
    'the rail must not own the selection — it is handed `active` and `onSelect`',
  );
});

test('the rail recounts nothing — its meter is handed the number the page computed', () => {
  assert.match(editor, /percentDecided=\{deskPercentDecided\}/);
  assert.ok(
    !/deskItems|loadDesk|\.filter\(/.test(rail),
    'the rail must not derive counts of its own',
  );
});

/**
 * ⚠ The chip WORD comes from the prototype; the mode NAME comes from the app. Typing `'auto'`
 * from the prototype's chip made a comparison that can never be true, and the chip would have
 * read "Neutral" forever. Only the typecheck knew.
 */
test('the theme chip compares against a mode the union actually contains', () => {
  assert.match(editor, /theme\.mode === 'board'/, "the shipped mode is 'board', not 'auto'");
  assert.ok(!/theme\.mode === 'auto'/.test(editor), "'auto' is not a StoryThemeMode");
});
