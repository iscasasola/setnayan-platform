/**
 * description-field-is-never-hidden.test.ts — the STRUCTURAL half of the
 * description-blanking fix (lib/admin/pricing-row-diff.test.ts is the other
 * half, for the parsing/diff logic).
 *
 * The bug lived in the DOM, not the diff: the OLD bulk editor's description
 * textarea only existed while a per-row ⓘ disclosure was open — a component
 * called `InfoPanel` that returned `null` when its `open` flag was false, so
 * a closed row's description field was never even in the form to submit. No
 * amount of correct diff logic saves you from a field the browser never sent.
 *
 * This guards the STRUCTURE: the redesigned per-row card renders `name="desc"`
 * unconditionally inside the same `<form>` as `name="price"` — one open/close
 * toggle for the WHOLE card, never a second one hiding just the note. If a
 * future edit reintroduces a per-field disclosure around the description
 * (the exact shape of the original bug), this fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = stripComments(readFileSync(join(HERE, 'catalog-editor.tsx'), 'utf8'));

test('the description field has no per-field disclosure gate any more', () => {
  assert.ok(
    !/InfoPanel|InfoToggle/.test(src),
    'the old per-field open/close component came back — that mechanism IS the description-blanking bug',
  );
});

/**
 * True when `needle` (e.g. `<textarea` or `<input`) is the JSX element that
 * `name="desc"`/`name="price"` sits inside AND that element's opening tag is
 * immediately preceded — allowing only whitespace/newlines — by a
 * `{someFlag &&` conditional. Scans the ~120 chars before the field's `name=`
 * attribute rather than a single split line, because the original bug's shape
 * (`{open && <textarea\n  name="desc"`) puts the conditional and the `name=`
 * attribute on DIFFERENT lines — a per-line check would miss it, same failure
 * shape as a guard that reads only line-local context.
 */
function hasOwnConditionalGate(body: string, nameAttr: string): boolean {
  const idx = body.indexOf(nameAttr);
  if (idx < 0) return false;
  const before = body.slice(Math.max(0, idx - 160), idx);
  return /\{\s*[A-Za-z0-9_.]+\s*&&\s*<\w+[^>]*$/.test(before);
}

test('the description textarea and the price input are in the same always-rendered function', () => {
  const fnStart = src.indexOf('function SaveSection(');
  assert.ok(fnStart >= 0, 'SaveSection (the per-row save form) must exist');
  const fnBody = src.slice(fnStart, src.indexOf('\nfunction ', fnStart + 1));

  assert.match(fnBody, /name="desc"/, 'the description field must live inside the save form');
  assert.match(fnBody, /name="price"/, 'the price field must live inside the same save form');

  // Neither field may sit behind its OWN conditional inside this function —
  // both must render whenever the card (the function's one caller-controlled
  // gate) is open. A `{someFlag && <textarea\n  name="desc"` here would be
  // the regression, in the exact split-line shape the original bug had.
  assert.ok(
    !hasOwnConditionalGate(fnBody, 'name="desc"'),
    'the description field must not sit behind its own conditional',
  );
  assert.ok(
    !hasOwnConditionalGate(fnBody, 'name="price"'),
    'the price field must not sit behind its own conditional',
  );
});

test('exactly one description field exists per retail/bundle/vendor row', () => {
  const count = (src.match(/name="desc"/g) ?? []).length;
  assert.equal(count, 1, 'one shared description field for all three row kinds, not one per kind that could drift');
});
