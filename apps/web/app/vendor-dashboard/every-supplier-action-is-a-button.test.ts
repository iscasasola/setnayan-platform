/**
 * every-supplier-action-is-a-button.test.ts — THE SUPPLIER SWEEP of the button
 * rule (owner 2026-10-07, corpus `BUTTON_RULE_2026-10-07_fable.md`; supplier
 * redesign S-PR0, `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 6: "Guard:
 * no `<button>` without `ActionButton` in swept supplier files").
 *
 * ── ANCHORED PER COMPONENT, AND IT PRINTS THE COUNT ─────────────────────────
 * A file-level match cannot say WHICH component still holds a bare button: a
 * file with two components, one swept and one not, reads the same as a file
 * with one — and a sabotage that lands in the other component moves a count
 * from 2 to 1 and stays green (repo CLAUDE.md, the 2026-08-20 trap). So this
 * guard cuts every swept file into its top-level components, counts the bare
 * `<button` in EACH, prints the table, and names the component that fails.
 *
 * A swept file is swept WHOLE: every component in it is held to zero, including
 * one added later. `SWEPT` GROWS with each supplier PR (S-PR1 adds Today's
 * files, and so on); it never shrinks.
 *
 * What counts as going through the rule: `<ActionButton …>` (the button), and
 * `<SupplierSubmit …>` (a form's submit — `SubmitButton` wearing ActionButton's
 * class list; `supplier-submit.tsx`). A bare `<button` is neither.
 *
 * SABOTAGE, each seen red before this shipped (S-PR0 PR body has the runs):
 *   · a bare `<button>` added to `SupplierThumbRow`      → names that component
 *   · the fixture's second component given the button    → names the SECOND one
 *   · the cutter told to return one slice per file       → the fixture test fails
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

/**
 * The supplier files swept so far, each with the components it is KNOWN to
 * hold. Naming them is the anchor: a component that is renamed or moved out of
 * the file fails here, instead of silently leaving the sweep.
 */
export const SWEPT: ReadonlyArray<readonly [file: string, components: readonly string[]]> = [
  ['app/vendor-dashboard/_components/supplier-thumb-row.tsx', ['SupplierThumbRow', 'ThumbFit']],
  ['app/vendor-dashboard/_components/supplier-submit.tsx', ['SupplierSubmit']],
];

export type ComponentCount = { component: string; bare: number; ruled: number };

/**
 * Cut a source file into its top-level components and count, in each, the bare
 * `<button` and the rule-shaped controls. A top-level component starts at a
 * line that begins `function Name(`, `export function Name(`, `export default
 * function Name(`, `export async function Name(` or `const Name = ` with a
 * capital first letter, and runs to the next such line (or the end of file).
 * Anything before the first one is counted under `(module)`.
 */
export function countByComponent(source: string): ComponentCount[] {
  const src = stripComments(source);
  const starts: Array<{ name: string; at: number }> = [];
  const re = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Z]\w*)\s*[(<]|const\s+([A-Z]\w*)\s*(?::[^=]+)?=)/gm;
  for (const m of src.matchAll(re)) starts.push({ name: (m[1] ?? m[2])!, at: m.index! });
  const slices: Array<{ name: string; body: string }> = [];
  if (starts.length === 0 || starts[0]!.at > 0) slices.push({ name: '(module)', body: src.slice(0, starts[0]?.at ?? src.length) });
  starts.forEach((s, i) => slices.push({ name: s.name, body: src.slice(s.at, starts[i + 1]?.at ?? src.length) }));
  return slices.map(({ name, body }) => ({
    component: name,
    bare: (body.match(/<button(?=[\s>/])/g) ?? []).length,
    ruled: (body.match(/<(?:ActionButton|SupplierSubmit)(?=[\s>/])/g) ?? []).length,
  }));
}

test('the cutter names the component that holds the bare button (fixtures)', () => {
  const twoComponents = [
    "import { ActionButton } from '@/components/action-button';",
    'export function Swept() {',
    '  return <ActionButton tone="brand" icon={<Plus />} label="Add" main />;',
    '}',
    '',
    'function StillBare() {',
    '  // a comment may say <button> and is not a control',
    '  return (',
    '    <button',
    '      type="button"',
    '    >',
    '      Old',
    '    </button>',
    '  );',
    '}',
  ].join('\n');
  const got = countByComponent(twoComponents);
  assert.deepEqual(
    got.filter((c) => c.component !== '(module)'),
    [
      { component: 'Swept', bare: 0, ruled: 1 },
      { component: 'StillBare', bare: 1, ruled: 0 },
    ],
    'a file-level count would say "1 bare button" and not whose it is',
  );
  // The shapes that must NOT read as a bare button.
  for (const ok of [
    'export function A() { return <ActionButton tone="ok" icon={<Check />} label="Agree" main />; }',
    'export function B() { return <SupplierSubmit tone="ok" icon={<Check />} label="Move" pendingLabel="Moving…" main />; }',
    'export function C() { return <ButtonRow />; }',
    'export function D() { return <buttonish-thing />; }',
  ]) {
    assert.equal(
      countByComponent(ok).reduce((n, c) => n + c.bare, 0),
      0,
      `read as a bare button: ${ok}`,
    );
  }
  // The shapes that must.
  for (const bad of [
    'export function A() { return <button onClick={go}>Add</button>; }',
    'export function B() { return <button\n type="submit">Save</button>; }',
    'const C = () => <button>x</button>;',
    'export default async function Page() { return <form><button>Go</button></form>; }',
  ]) {
    assert.equal(
      countByComponent(bad).reduce((n, c) => n + c.bare, 0),
      1,
      `missed a bare button: ${bad}`,
    );
  }
});

test('every swept supplier component has no bare <button> — counted per component', () => {
  assert.ok(SWEPT.length >= 2, 'the sweep list is empty — a guard over nothing is green by accident');
  const table: string[] = [];
  const failures: string[] = [];
  for (const [rel, expected] of SWEPT) {
    const abs = join(WEB, rel);
    assert.ok(existsSync(abs), `swept file is gone: ${rel} (a moved file must move here too)`);
    const source = readFileSync(abs, 'utf8');
    assert.ok(source.length > 200, `${rel} read as ${source.length} chars — an empty read is a green lie`);
    const counts = countByComponent(source);
    const names = counts.map((c) => c.component);
    for (const want of expected) {
      assert.ok(names.includes(want), `${rel}: component "${want}" is not in the file any more (found: ${names.join(', ')})`);
    }
    for (const c of counts) {
      table.push(`${rel} › ${c.component}: ${c.bare} bare <button>, ${c.ruled} through the rule`);
      if (c.bare > 0) failures.push(`${rel} › ${c.component} holds ${c.bare} bare <button> — use ActionButton (or SupplierSubmit in a form)`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[supplier button sweep] ${SWEPT.length} files\n  ${table.join('\n  ')}`);
  assert.deepEqual(failures, []);
});

test('the submit goes through the one pending mechanism and wears the button rule', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-submit.tsx'), 'utf8'));
  assert.match(src, /<SubmitButton\b/, 'SupplierSubmit no longer renders the shipped SubmitButton — the pending word and the no-touch veil are gone');
  assert.match(src, /className=\{actionButtonClass\(tone, \{ main, extra: className \}\)\}/, 'it no longer wears ActionButton’s class list');
  assert.match(src, /<span className="lbl">\{label\}<\/span>/, 'the word is not the rule’s `.lbl` span (the fit pass cannot hide it)');
  assert.match(src, /aria-label=\{label\}/, 'icon-only would not read');
  assert.match(src, /tone: ActionTone;/, 'tone is no longer required');
});
