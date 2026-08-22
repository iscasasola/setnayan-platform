/**
 * Guard — the story maker opens as two boxes, not six.
 *
 * Owner 2026-08-22, on the story maker: it should be *"very easy to handle."*
 *
 * A couple opens this page to correct the story Setnayan wrote about their day.
 * The two things they came to write are the HEADLINE and the STORY. The eyebrow,
 * the sub-headline, the pull quote and the byline are magazine furniture — slots
 * our composer already fills, whose names are a newsroom's words, not a couple's.
 * Six equal boxes made the page read as a form to complete rather than a story to
 * correct, so the four are folded away behind a disclosure.
 *
 * 🔑 WHAT THIS SUITE IS REALLY DEFENDING: a fold is one edit away from a
 * DELETION. The cheapest way to "simplify" a form is to stop rendering fields,
 * and that silently drops whatever a couple had already written into them. Every
 * assertion below exists to make that impossible to do by accident.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const EDITOR = join(
  process.cwd(),
  'app/dashboard/[eventId]/website/editorial/_components/editorial-editor.tsx',
);
const src = () => readFileSync(EDITOR, 'utf8');

/** Strip comments — a docblock naming a field must not satisfy a field check. */
function code(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const FOLDED = [
  { label: 'Eyebrow', state: 'superKicker' },
  { label: 'Sub-headline', state: 'deck' },
  { label: 'Pull quote', state: 'pullQuote' },
  { label: 'Byline', state: 'byline' },
] as const;

const UP_FRONT = [
  { label: 'Headline', state: 'headline' },
  { label: 'Your story', state: 'leadParagraphs' },
] as const;

test('every field still exists — folding is not deleting', () => {
  const s = code(src());
  for (const { label, state } of [...UP_FRONT, ...FOLDED]) {
    assert.ok(
      s.includes(`label="${label}"`),
      `The "${label}" field is gone from the story maker. Simplifying by ` +
        'removing a field silently discards whatever a couple already wrote in it.',
    );
    assert.ok(
      s.includes(`form.${state}`) && s.includes(`set('${state}'`),
      `"${label}" no longer reads AND writes form.${state} — a field rendered ` +
        'without its handler looks editable and throws the typing away.',
    );
  }
});

test('the two the couple came to write are ABOVE the fold', () => {
  const s = code(src());
  const fold = s.indexOf('<details');
  assert.ok(fold > 0, 'The disclosure is gone — the story maker is a flat six-box form again.');
  for (const { label } of UP_FRONT) {
    const at = s.indexOf(`label="${label}"`);
    assert.ok(at > 0, `"${label}" is missing entirely.`);
    assert.ok(
      at < fold,
      `"${label}" was pushed inside the fold. It is one of the two things a ` +
        'person opens this page intending to write; hiding it is the opposite ' +
        'of the change.',
    );
  }
});

test('the magazine furniture is BELOW the fold', () => {
  const s = code(src());
  const fold = s.indexOf('<details');
  for (const { label } of FOLDED) {
    const at = s.indexOf(`label="${label}"`);
    assert.ok(at > fold, `"${label}" is back on the top level — the fold is decorative.`);
  }
});

test('the fold keeps its fields in the DOM, so an edit inside it still submits', () => {
  // A `<details>` keeps its children mounted; swapping it for a conditional
  // render would UNMOUNT them, and React would drop any unsaved edit the moment
  // the fold was collapsed — losing a pull quote somebody just typed.
  const s = code(src());
  assert.match(
    s,
    /<details[\s\S]{0,4000}label="Byline"[\s\S]{0,400}<\/details>/,
    'The folded fields are no longer inside a <details>. If they are behind a ' +
      'conditional render instead, collapsing the fold unmounts them and throws ' +
      'away an edit that was never saved.',
  );
});

test('the fold is openable without a mouse', () => {
  const s = code(src());
  assert.match(
    s,
    /<summary[^>]*className="[^"]*cursor-pointer/,
    'The disclosure lost its <summary>. A div-with-onClick is not keyboard ' +
      'reachable, so the four fields become unreachable for anyone tabbing.',
  );
});
